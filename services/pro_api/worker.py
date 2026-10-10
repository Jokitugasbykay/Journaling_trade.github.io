"""Durable leased jobs live in PostgreSQL; process death is recovered by the next worker."""
import asyncio
import logging
import re
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import httpx

from .ai import explain
from .analytics import overview, review, risk_analysis
from .app import dataset, report_preview
from .market import load_market
from .models import Analysis, Import, Report, Review
from .reports import generate_pdf
from .store import Settings, Store, entitlements

log = logging.getLogger("journalingtrade.worker")


def period_bounds(config):
    start = config.start
    if config.period == "weekly":
        start -= timedelta(days=start.weekday())
        end = start + timedelta(days=6)
        previous_start, previous_end = start - timedelta(days=7), start - timedelta(days=1)
    else:
        start = start.replace(day=1)
        next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        end = next_month - timedelta(days=1)
        previous_end = start - timedelta(days=1)
        previous_start = previous_end.replace(day=1)
    return start, end, previous_start, previous_end


async def process_job(store, settings, job):
    uid, kind, payload = job["user_id"], job["kind"], job["payload"]
    access = entitlements(await store.rpc("journal_user_access", {"p_user_id": uid}))
    if kind != "import" and access["plan"] != "pro":
        raise ValueError("Subscription expired before the job started")
    if kind == "import":
        config = Import.model_validate(payload)
        if not re.fullmatch(re.escape(uid) + "/" + config.file_sha256 + r"\.(pdf|png|jpg|jpeg|csv|txt)", config.storage_path):
            raise ValueError("Import file ownership mismatch")
        # Insert and completion share a database transaction; failures cannot charge quota.
        await store.rpc("journal_confirm_import", {"p_job_id": job["id"], "p_worker_id": job["worker_id"],
                                                   "p_trades": [trade.model_dump(mode="json") for trade in config.trades]})
        return None
    if kind == "report":
        config = Report.model_validate(payload)
        preview = await report_preview(store, uid, config)
        pdf = await asyncio.to_thread(generate_pdf, preview)
        path = f"{uid}/{job['id']}.pdf"
        await store.request("POST", "/storage/v1/object/journal-reports/" + path, content=pdf,
                             headers={"Content-Type": "application/pdf", "x-upsert": "true"})
        return {"storage_path": path, "bytes": len(pdf), "generated_at": datetime.now(timezone.utc).isoformat(),
                "sections": config.sections, "ai_quota_consumed": False}
    if kind == "review":
        config = Review.model_validate(payload)
        start, end, previous_start, previous_end = period_bounds(config)
        current_filter = config.model_copy(update={"start": start, "end": end})
        previous_filter = config.model_copy(update={"start": previous_start, "end": previous_end})
        rows, initial, strategies, warnings = await dataset(store, uid, current_filter)
        previous, _, _, _ = await dataset(store, uid, previous_filter)
        rules = await store.rows("risk_rules", {"user_id": f"eq.{uid}"})
        result = review(rows, previous, initial, strategies, rules)
        result["warnings"] = warnings
        entry = {"user_id": uid, "account_id": str(config.account_id) if config.account_id else None,
                 "period": config.period, "period_start": start.isoformat(), "timezone": config.tz, "summary": result}
        saved = await store.insert("performance_reviews", entry, upsert=True,
                                   conflict="user_id,account_id,period,period_start,timezone")
        return {"review": saved[0]}
    config = Analysis.model_validate(payload)
    if kind == "market":
        context = await asyncio.to_thread(load_market, settings, config.instrument, config.timeframe)
        evidence = {"market": context}
        ids = ["technical", "multi_timeframe", "statistical_baseline"]
        for group in ("macro", "news", "geopolitics"):
            for index, item in enumerate(context[group]):
                item["evidence_id"] = f"{group}-{index}"
                ids.append(item["evidence_id"])
        for symbol in context["correlations"]:
            ids.append(f"correlation-{symbol}")
    else:
        rows, initial, strategies, warnings = await dataset(store, uid, config)
        if not rows:
            raise ValueError("No validated trades are available")
        rules = await store.rows("risk_rules", {"user_id": f"eq.{uid}"})
        metrics = overview(rows, initial, strategies, warnings)
        risk = risk_analysis(rows, rules)
        evidence = {"analysis_type": config.analysis_type, "metrics": metrics["metrics"], "warnings": warnings,
                    "trades": [{"id": row["id"], "symbol": row["symbol"], "pnl": str(row["net_pnl"]),
                                "date": row["date"].isoformat(), "strategy_id": row.get("strategy_id"),
                                "risk_percent": row.get("risk_percent"), "notes": (row.get("notes") or "")[:500]}
                               for row in rows[-50:]]}
        ids = [row["id"] for row in rows[-50:]]
        if kind == "behaviour" or config.analysis_type in ("risk", "consistency"):
            evidence["risk_violations"] = [row for row in risk["violations"] if row["trade_id"] in ids]
            evidence["frequency"] = metrics["groups"]["weekday"]
            evidence["strategy_consistency"] = metrics["groups"]["strategy"]
        elif config.analysis_type == "strategy":
            evidence["strategy_performance"] = metrics["groups"]["strategy"]
        elif config.analysis_type == "review":
            evidence["reviews"] = await store.rows("performance_reviews", {"user_id": f"eq.{uid}", "limit": 5, "order": "period_start.desc"})
    result = await explain(store.client, settings, kind, evidence, ids)
    result["analysis_horizon"] = config.timeframe if kind == "market" else "Selected journal period"
    result["generated_at"] = datetime.now(timezone.utc).isoformat()
    return result


async def run_job(store, settings, job):
    try:
        result = await asyncio.wait_for(process_job(store, settings, job), timeout=300)
        if job["kind"] != "import":
            await store.rpc("journal_finish_job", {"p_job_id": job["id"], "p_worker_id": job["worker_id"], "p_result": result, "p_error": None})
        log.info("job id=%s kind=%s outcome=succeeded", job["id"], job["kind"])
    except asyncio.CancelledError:
        # Abrupt worker shutdown leaves the durable lease for recovery; no successful charge.
        raise
    except Exception as exc:
        log.warning("job id=%s kind=%s outcome=failed error_type=%s", job["id"], job["kind"], type(exc).__name__)
        try:
            await store.rpc("journal_finish_job", {"p_job_id": job["id"], "p_worker_id": job["worker_id"], "p_result": None,
                                                   "p_error": "Analysis or report could not be completed. Verify source data, subscription and local runtime."})
        except Exception:
            log.warning("job id=%s awaiting_lease_recovery=true", job["id"])


async def expire_reports(store):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    jobs = await store.rows("platform_jobs", {"kind": "eq.report", "status": "eq.succeeded", "finished_at": f"lt.{cutoff}"})
    for job in jobs:
        expected = f"{job['user_id']}/{job['id']}.pdf"
        if (job.get("result") or {}).get("storage_path") != expected:
            continue
        await store.request("DELETE", "/storage/v1/object/journal-reports", json={"prefixes": [expected]})
        await store.update("platform_jobs", job["id"], {"status": "expired", "result": None, "error": "Report retention expired"})


async def main():
    settings = Settings()
    settings.validate(worker=True)
    worker_id = str(uuid4())
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        store = Store(client, settings, settings.service_key, privileged=True)
        next_cleanup = 0
        while True:
            try:
                await store.rpc("journal_recover_jobs")
                if asyncio.get_running_loop().time() >= next_cleanup:
                    await expire_reports(store)
                    next_cleanup = asyncio.get_running_loop().time() + 3600
                jobs = await store.rpc("journal_claim_jobs", {"p_worker_id": worker_id, "p_limit": 1})
                if not jobs:
                    await asyncio.sleep(2)
                    continue
                await run_job(store, settings, jobs[0])
            except Exception as exc:
                log.warning("worker_cycle_failed error_type=%s", type(exc).__name__)
                await asyncio.sleep(5)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
