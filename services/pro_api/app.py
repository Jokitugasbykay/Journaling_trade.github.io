import asyncio
import hashlib
import json
import logging
import re
from io import BytesIO
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo
from PIL import Image

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .ai import model_available
from .analytics import heatmap, number, open_exposure, overview, position_size, records, review, risk_analysis, wire
from .kaystrade import VERSION
from .market import instrument_catalog, load_market
from .models import AlertChange, Analysis, ExecutionConfirmation, Filters, Import, MarketPreference, NotificationPreference, Position, Report, Review, RiskRule, SignalAction, Strategy
from .store import Settings, Store, entitlements

log = logging.getLogger("journalingtrade.pro")
bearer = HTTPBearer(auto_error=False)


@dataclass
class User:
    id: str
    store: Store
    access: dict


async def authenticated(request: Request, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    if credentials is None or credentials.scheme.lower() != "bearer" or len(credentials.credentials) > 8192:
        raise HTTPException(401, "Sign in to continue", headers={"WWW-Authenticate": "Bearer"})
    settings = request.app.state.settings
    if not settings.publishable_key:
        raise HTTPException(503, "The Pro gateway is not configured")
    store = Store(request.app.state.client, settings, credentials.credentials)
    identity = await store.request("GET", "/auth/v1/user")
    try:
        uid = str(UUID(identity["id"]))
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(401, "Invalid authentication token") from exc
    allowed = await store.rpc("journal_rate_limit", {"p_bucket": "pro_api", "p_limit": 120, "p_window_seconds": 60})
    if allowed is not True:
        raise HTTPException(429, "Too many requests; try again shortly")
    return User(uid, store, entitlements(await store.rpc("journal_entitlements")))


async def pro(user: Annotated[User, Depends(authenticated)]):
    expiry = user.access["effective_until"]
    if user.access["plan"] != "pro" or not expiry or datetime.fromisoformat(expiry.replace("Z", "+00:00")) <= datetime.now(timezone.utc):
        raise HTTPException(403, "An active Pro subscription is required")
    return user


async def plus(user: Annotated[User, Depends(authenticated)]):
    if user.access["plan"] not in ("plus", "pro"):
        raise HTTPException(403, "An active Plus or Pro subscription is required")
    return user


UserDep = Annotated[User, Depends(authenticated)]
ProDep = Annotated[User, Depends(pro)]
PlusDep = Annotated[User, Depends(plus)]
def query_filters(account_id: UUID | None = None, strategy_id: UUID | None = None,
                  start: date | None = None, end: date | None = None, tz: str = "UTC"):
    return Filters(account_id=account_id, strategy_id=strategy_id, start=start, end=end, tz=tz)


FilterDep = Annotated[Filters, Depends(query_filters)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]


def job_shape(job):
    return {**job, "state": job["status"]}


async def dataset(store, uid, filters):
    owned = {"user_id": f"eq.{uid}"}
    accounts, strategies = await asyncio.gather(store.rows("trading_accounts", owned), store.rows("strategies", owned))
    if filters.account_id and str(filters.account_id) not in {str(a["id"]) for a in accounts}:
        raise HTTPException(404, "Trading account not found")
    if filters.strategy_id and str(filters.strategy_id) not in {str(s["id"]) for s in strategies}:
        raise HTTPException(404, "Strategy not found")
    query = {**owned, "order": "opened_at.asc,id.asc"}
    if filters.account_id:
        query["account_id"] = f"eq.{filters.account_id}"
    if filters.strategy_id:
        query["strategy_id"] = f"eq.{filters.strategy_id}"
    trades, executions = await asyncio.gather(store.rows("trades", query), store.rows("trade_executions", owned))
    rows, warnings = records(trades, accounts, executions, filters.start, filters.end, filters.tz, filters.account_id, filters.strategy_id)
    relevant = [a for a in accounts if not filters.account_id or str(a["id"]) == str(filters.account_id)]
    currencies = {a["currency"] for a in relevant}
    if len(currencies) > 1:
        raise HTTPException(422, "Select one account before combining different account currencies")
    initial = sum((number(a["initial_balance"], Decimal(0)) for a in relevant), Decimal(0))
    if filters.start:
        preceding, _ = records(trades, accounts, executions, end=filters.start - timedelta(days=1), tz=filters.tz,
                               account_id=filters.account_id)
        initial += sum((row["net_pnl"] for row in preceding), Decimal(0))
    return rows, initial, strategies, warnings


async def report_preview(store, uid, config):
    rows, initial, strategies, warnings = await dataset(store, uid, config)
    result = {"period": f"{config.start or 'Beginning'} to {config.end or 'Present'} · {config.tz}", "sections": config.sections}
    if "analytics" in config.sections:
        result["analytics"] = overview(rows, initial, strategies, warnings)
    if "heatmap" in config.sections:
        result["heatmap"] = heatmap(rows, (config.end or config.start or date.today()).year)
    if "risk" in config.sections:
        rules = await store.rows("risk_rules", {"user_id": f"eq.{uid}"})
        result["risk"] = risk_analysis(rows, rules)
    if "reviews" in config.sections:
        filters = {"user_id": f"eq.{uid}", "order": "period_start.desc"}
        if config.account_id:
            filters["account_id"] = f"eq.{config.account_id}"
        result["reviews"] = [item for item in await store.rows("performance_reviews", filters)
                             if (not config.start or date.fromisoformat(item["period_start"]) >= config.start)
                             and (not config.end or date.fromisoformat(item["period_start"]) <= config.end)]
    return result


async def create_job(user, kind, payload, key):
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    job = await user.store.rpc("journal_create_job", {"p_kind": kind, "p_payload": payload,
                                                      "p_idempotency_key": str(key), "p_payload_hash": hashlib.sha256(encoded).hexdigest()})
    return job_shape(job)


@lru_cache(maxsize=8)
def read_file(path, modified):
    return json.loads(Path(path).read_text(encoding="utf-8"))


async def data_file(settings, filename):
    path = settings.data_root / filename
    try:
        modified = await asyncio.to_thread(lambda: path.stat().st_mtime_ns)
        return await asyncio.to_thread(read_file, str(path), modified)
    except (OSError, ValueError) as exc:
        raise HTTPException(503, "The publisher dataset is unavailable") from exc


def create_app(settings=None, transport=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        if settings.publishable_key:
            settings.validate()
        async with httpx.AsyncClient(timeout=20, follow_redirects=False, transport=transport) as client:
            app.state.client = client
            yield

    app = FastAPI(title="journalingtrade Pro Gateway", version="1.0.0", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.origins), allow_methods=["GET", "POST", "PATCH", "DELETE"],
                       allow_headers=["Authorization", "Content-Type", "Idempotency-Key"], allow_credentials=False)

    @app.middleware("http")
    async def security(request, call_next):
        if request.headers.get("content-length"):
            try:
                length = int(request.headers["content-length"])
            except ValueError:
                return JSONResponse({"detail": "Invalid body size"}, 400)
            if length > (10_000_000 if request.url.path.endswith("/imports/files") else 2_000_000):
                return JSONResponse({"detail": "Request is too large"}, 413)
        if request.method in ("POST", "PATCH", "PUT") and not request.url.path.endswith("/imports/files"):
            chunks, size = [], 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > 2_000_000:
                    return JSONResponse({"detail": "Request is too large"}, 413)
                chunks.append(chunk)
            request._body = b"".join(chunks)
        started = datetime.now(timezone.utc)
        response = await call_next(request)
        response.headers.update({"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
                                 "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
                                 "Referrer-Policy": "no-referrer", "Strict-Transport-Security": "max-age=31536000"})
        # Paths, query strings, JWTs, notes and provider payloads are intentionally omitted.
        log.info("request method=%s status=%s duration_ms=%d", request.method, response.status_code,
                 int((datetime.now(timezone.utc) - started).total_seconds() * 1000))
        return response

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse({"detail": [{"loc": error["loc"], "msg": error["msg"], "type": error["type"]} for error in exc.errors()]}, 422)

    @app.exception_handler(ValueError)
    async def invalid_data(request, exc):
        return JSONResponse({"detail": "Financial data or filters failed validation"}, 422)

    @app.get("/health")
    async def health():
        return {"status": "ok", "configured": bool(settings.publishable_key), "model_configured": bool(settings.ollama_model)}

    @app.get("/ready")
    async def ready(request: Request):
        try:
            settings.validate()
            response = await request.app.state.client.get(settings.supabase_url + "/auth/v1/health", headers={"apikey": settings.publishable_key})
        except (RuntimeError, httpx.RequestError) as exc:
            raise HTTPException(503, "Gateway configuration or database health is unavailable") from exc
        if response.status_code >= 400:
            raise HTTPException(503, "Supabase health check failed")
        return {"status": "ready"}

    @app.get("/api/v1/me")
    async def me(user: UserDep):
        return {"id": user.id, "subscription": user.access}

    @app.get("/api/v1/entitlements")
    @app.get("/api/v1/subscription")
    async def access(user: UserDep):
        return user.access

    @app.get("/api/v1/usage")
    async def usage(user: UserDep):
        since = datetime.now(timezone.utc) - timedelta(hours=12)
        imports = await user.store.rows("platform_jobs", {"user_id": f"eq.{user.id}", "kind": "eq.import",
                                       "status": "eq.succeeded", "finished_at": f"gt.{since.isoformat()}"})
        return {"ai": user.access["ai"], "imports": {"limit": 10 if user.access["plan"] == "free" else None,
                "used": len(imports), "remaining": max(0, 10 - len(imports)) if user.access["plan"] == "free" else None,
                "reset_at": min((datetime.fromisoformat(item["finished_at"].replace("Z", "+00:00")) + timedelta(hours=12)).isoformat()
                                for item in imports) if imports else None}}

    @app.get("/api/v1/accounts")
    async def accounts(user: ProDep):
        return {"items": await user.store.rows("trading_accounts", {"user_id": f"eq.{user.id}", "order": "name.asc,id.asc"})}

    @app.get("/api/v1/strategies")
    async def strategies(user: ProDep):
        return {"items": await user.store.rows("strategies", {"user_id": f"eq.{user.id}", "order": "name.asc,id.asc"})}

    @app.post("/api/v1/strategies", status_code=201)
    async def add_strategy(payload: Strategy, user: ProDep):
        return (await user.store.insert("strategies", {**payload.model_dump(), "user_id": user.id}))[0]

    @app.patch("/api/v1/strategies/{identifier}")
    async def edit_strategy(identifier: UUID, payload: Strategy, user: ProDep):
        return await user.store.update("strategies", identifier, payload.model_dump())

    @app.delete("/api/v1/strategies/{identifier}", status_code=204)
    async def delete_strategy(identifier: UUID, user: ProDep):
        await user.store.delete("strategies", identifier)

    @app.get("/api/v1/trades")
    async def trades(filters: FilterDep, user: UserDep):
        query = {"user_id": f"eq.{user.id}", "order": "opened_at.asc,id.asc"}
        if filters.account_id:
            query["account_id"] = f"eq.{filters.account_id}"
        if filters.strategy_id:
            query["strategy_id"] = f"eq.{filters.strategy_id}"
        items = await user.store.rows("trades", query)
        zone = ZoneInfo(filters.tz)
        return {"items": [item for item in items if item.get("opened_at") and
                (not filters.start or datetime.fromisoformat(item["opened_at"].replace("Z", "+00:00")).astimezone(zone).date() >= filters.start)
                and (not filters.end or datetime.fromisoformat(item["opened_at"].replace("Z", "+00:00")).astimezone(zone).date() <= filters.end)]}

    @app.get("/api/v1/analytics/overview")
    async def analytics(filters: FilterDep, user: ProDep):
        rows, initial, strategies, warnings = await dataset(user.store, user.id, filters)
        return overview(rows, initial, strategies, warnings)

    @app.get("/api/v1/analytics/heatmap")
    async def performance_heatmap(user: ProDep, filters: FilterDep, year: int = Query(default=date.today().year, ge=1970, le=2100)):
        rows, _, _, warnings = await dataset(user.store, user.id, filters)
        return {**heatmap(rows, year), "warnings": warnings}

    @app.get("/api/v1/analytics/strategies")
    async def compare_strategies(user: ProDep, filters: FilterDep, strategy_ids: str = Query(default="", max_length=2000)):
        identifiers = [str(UUID(value)) for value in strategy_ids.split(",") if value]
        if len(identifiers) > 10:
            raise HTTPException(422, "Compare at most ten strategies")
        rows, initial, strategies, warnings = await dataset(user.store, user.id, filters)
        available = {str(item["id"]): item for item in strategies}
        if any(identifier not in available for identifier in identifiers):
            raise HTTPException(404, "Strategy not found")
        compared = []
        for identifier in identifiers:
            selected = [row for row in rows if str(row.get("strategy_id")) == identifier]
            report = overview(selected, initial, strategies, warnings)
            compared.append({"id": identifier, "name": available[identifier]["name"], **report,
                             "sample_warning": "Fewer than 30 trades; results may not represent future performance" if len(selected) < 30 else None})
        return {"strategies": compared, "available": list(available.values())}

    @app.get("/api/v1/risk/rules")
    async def rules(user: ProDep):
        return {"items": await user.store.rows("risk_rules", {"user_id": f"eq.{user.id}"})}

    @app.post("/api/v1/risk/rules", status_code=201)
    async def add_rule(payload: RiskRule, user: ProDep):
        return (await user.store.insert("risk_rules", {**payload.model_dump(mode="json"), "user_id": user.id}))[0]

    @app.patch("/api/v1/risk/rules/{identifier}")
    async def edit_rule(identifier: UUID, payload: RiskRule, user: ProDep):
        return await user.store.update("risk_rules", identifier, payload.model_dump(mode="json"))

    @app.delete("/api/v1/risk/rules/{identifier}", status_code=204)
    async def remove_rule(identifier: UUID, user: ProDep):
        await user.store.delete("risk_rules", identifier)

    @app.post("/api/v1/risk/calculate")
    async def calculate(payload: Position, user: ProDep):
        return position_size(**payload.model_dump(exclude={"instrument"}))

    @app.get("/api/v1/analytics/risk")
    async def risk(user: ProDep, filters: FilterDep):
        rows, _, _, warnings = await dataset(user.store, user.id, filters)
        output = risk_analysis(rows, await user.store.rows("risk_rules", {"user_id": f"eq.{user.id}"}))
        output["warnings"] += warnings
        query = {"user_id": f"eq.{user.id}", "status": "eq.open"}
        if filters.account_id:
            query["account_id"] = f"eq.{filters.account_id}"
        positions = await user.store.rows("trades", query)
        output["overview"].update(open_exposure(positions, filters.tz))
        output["warnings"].append("Exposure uses recorded remaining position quantity or recorded risk amount, excluding unknown positions; fees and slippage are not estimated. Daily/weekly exposure groups positions by opening date.")
        return output

    @app.get("/api/v1/reviews")
    async def reviews(user: ProDep, filters: FilterDep, period: str = Query(default="weekly", pattern=r"^(weekly|monthly)$")):
        query = {"user_id": f"eq.{user.id}", "order": "period_start.desc"}
        query["period"] = f"eq.{period}"
        if filters.account_id:
            query["account_id"] = f"eq.{filters.account_id}"
        lower = Review(period=period, start=filters.start).start if filters.start else None
        return {"items": [item for item in await user.store.rows("performance_reviews", query)
                          if (not lower or date.fromisoformat(item["period_start"]) >= lower)
                          and (not filters.end or date.fromisoformat(item["period_start"]) <= filters.end)]}

    @app.post("/api/v1/reviews", status_code=202)
    async def generate_review(payload: Review, user: ProDep, key: Key):
        await dataset(user.store, user.id, payload)
        return await create_job(user, "review", payload.model_dump(mode="json"), key)

    @app.post("/api/v1/reports/preview")
    async def preview(payload: Report, user: ProDep):
        return await report_preview(user.store, user.id, payload)

    @app.post("/api/v1/reports", status_code=202)
    async def generate_report(payload: Report, user: ProDep, key: Key):
        await dataset(user.store, user.id, payload)
        return await create_job(user, "report", payload.model_dump(mode="json"), key)

    @app.get("/api/v1/reports")
    async def reports(user: ProDep):
        return {"items": [job_shape(item) for item in await user.store.rows("platform_jobs", {"user_id": f"eq.{user.id}", "kind": "eq.report", "deleted_at": "is.null", "order": "created_at.desc"})]}

    @app.get("/api/v1/reports/{identifier}/download")
    async def download(identifier: UUID, user: ProDep):
        job = await user.store.rpc("journal_job", {"p_job_id": str(identifier)})
        if not job or job["kind"] != "report" or job["status"] != "succeeded":
            raise HTTPException(404, "Report is not ready")
        path = job["result"]["storage_path"]
        if path != f"{user.id}/{identifier}.pdf":
            raise HTTPException(404, "Report not found")
        result = await user.store.request("POST", "/storage/v1/object/sign/journal-reports/" + path, json={"expiresIn": 60})
        url = result.get("signedURL", result.get("signedUrl"))
        if not url or not url.startswith("/object/sign/"):
            raise HTTPException(503, "Signed download could not be created")
        return {"url": settings.supabase_url + "/storage/v1" + url, "expires_in": 60}

    @app.get("/api/v1/reports/{identifier}")
    @app.get("/api/v1/jobs/{identifier}")
    @app.get("/api/v1/ai/jobs/{identifier}")
    async def get_job(identifier: UUID, user: UserDep):
        job = await user.store.rpc("journal_job", {"p_job_id": str(identifier)})
        if not job:
            raise HTTPException(404, "Job not found")
        return job_shape(job)

    @app.post("/api/v1/ai/jobs/{identifier}/cancel")
    @app.post("/api/v1/jobs/{identifier}/cancel")
    async def cancel_job(identifier: UUID, user: UserDep):
        return job_shape(await user.store.rpc("journal_cancel_job", {"p_job_id": str(identifier)}))

    @app.delete("/api/v1/reports/{identifier}", status_code=204)
    async def delete_report(identifier: UUID, user: ProDep):
        job = await user.store.rpc("journal_job", {"p_job_id": str(identifier)})
        if not job or job["kind"] != "report":
            raise HTTPException(404, "Report not found")
        path = (job.get("result") or {}).get("storage_path")
        if path:
            if path != f"{user.id}/{identifier}.pdf":
                raise HTTPException(404, "Report not found")
            await user.store.request("DELETE", "/storage/v1/object/journal-reports", json={"prefixes": [path]})
        await user.store.rpc("journal_delete_job", {"p_job_id": str(identifier)})

    @app.post("/api/v1/reports/{identifier}/retry", status_code=202)
    @app.post("/api/v1/ai/jobs/{identifier}/retry", status_code=202)
    async def retry(identifier: UUID, user: ProDep, key: Key, request: Request):
        job = await user.store.rpc("journal_job", {"p_job_id": str(identifier)})
        if not job or job["status"] not in ("failed", "expired", "cancelled") or job["kind"] not in ("report", "behaviour", "journal", "market"):
            raise HTTPException(409, "Only failed, expired or cancelled analyses and reports can be retried")
        if job["kind"] != "report":
            if job["kind"] == "market":
                preference = await user.store.rpc("journal_market_preference")
                if not preference or preference.get("trading_style") != job["payload"].get("trading_style"):
                    raise HTTPException(409, "Select a trading style and generate a new analysis for that style")
                await asyncio.to_thread(load_market, settings, job["payload"]["instrument"], job["payload"]["timeframe"], trading_style=preference["trading_style"])
            await model_available(request.app.state.client, settings)
        return await create_job(user, job["kind"], job["payload"], key)

    @app.get("/api/v1/ai/history")
    async def ai_history(user: ProDep, kind: str = Query(default="journal", pattern=r"^(journal|behaviour|market)$")):
        return {"items": [job_shape(item) for item in await user.store.rows("platform_jobs", {"user_id": f"eq.{user.id}", "kind": f"eq.{kind}", "deleted_at": "is.null", "order": "created_at.desc"})]}

    @app.post("/api/v1/ai/{kind}-analysis", status_code=202)
    async def analyze(kind: str, payload: Analysis, user: ProDep, key: Key, request: Request):
        if kind not in ("behaviour", "journal", "market"):
            raise HTTPException(404, "Analysis type not found")
        if kind == "market":
            if not payload.instrument or not payload.timeframe:
                raise HTTPException(422, "Select an instrument and timeframe")
            preference = await user.store.rpc("journal_market_preference")
            if not payload.trading_style or not preference or preference.get("trading_style") != payload.trading_style:
                raise HTTPException(409, "Save your trading style before analyzing the market")
            await asyncio.to_thread(load_market, settings, payload.instrument, payload.timeframe, trading_style=payload.trading_style)
        else:
            rows, _, _, _ = await dataset(user.store, user.id, payload)
            if not rows:
                raise HTTPException(422, "No validated closed trades are available for this period")
        await model_available(request.app.state.client, settings)
        return await create_job(user, kind, payload.model_dump(mode="json"), key)

    @app.get("/api/v1/market/instruments")
    async def market_instruments(user: ProDep):
        return await asyncio.to_thread(instrument_catalog, settings)

    @app.get("/api/v1/market/preference")
    async def market_preference(user: ProDep):
        return await user.store.rpc("journal_market_preference") or {"trading_style": None}

    @app.put("/api/v1/market/preference")
    async def save_market_preference(payload: MarketPreference, user: ProDep):
        return await user.store.rpc("journal_market_preference", {"p_style": payload.trading_style})

    @app.put("/api/v1/market/notification-preference")
    async def notification_preference(payload: NotificationPreference, user: ProDep):
        return await user.store.rpc("journal_notification_preference", {"p_enabled": payload.browser_notifications})

    @app.get("/api/v1/market/signals")
    async def signals(user: ProDep):
        return {"items": await user.store.rows("market_signals", {"user_id": f"eq.{user.id}", "order": "created_at.desc"})}

    @app.post("/api/v1/market/signals")
    async def signal_action(payload: SignalAction, user: ProDep):
        if payload.action != "dismiss":
            job = await user.store.rpc("journal_job", {"p_job_id": str(payload.job_id)})
            if not job or job.get("kind") != "market" or job.get("status") != "succeeded":
                raise HTTPException(404, "Completed market analysis not found")
            original = job["result"]["quantitative"]["market"]
            current = await asyncio.to_thread(load_market, settings, original["instrument"], original["timeframe"], trading_style=original["intelligence"]["trading_style"])
            selected_signal = current["intelligence"]["signal"] if payload.action == "take" else current["kaystrade"]["signal"]
            if selected_signal["direction"] != payload.direction:
                raise HTTPException(409, "Current evidence no longer supports this setup; generate a new analysis")
        return await user.store.rpc("journal_signal_action", {"p_job_id": str(payload.job_id), "p_direction": payload.direction,
                                                               "p_action": payload.action, "p_mode": payload.mode})

    @app.post("/api/v1/market/signals/{identifier}/execution")
    async def confirm_execution(identifier: UUID, payload: ExecutionConfirmation, user: ProDep):
        return await user.store.rpc("journal_signal_execution", {"p_id": str(identifier), "p_price": str(payload.price),
                                                                  "p_at": payload.executed_at.isoformat()})

    @app.get("/api/v1/market/alerts")
    async def alerts(user: ProDep):
        return {"items": await user.store.rows("signal_alerts", {"user_id": f"eq.{user.id}", "order": "created_at.desc"})}

    @app.patch("/api/v1/market/alerts/{identifier}")
    async def change_alert(identifier: UUID, payload: AlertChange, user: ProDep):
        return await user.store.rpc("journal_alert_change", {"p_id": str(identifier), "p_enabled": payload.enabled,
                                                              "p_price": str(payload.trigger_price) if payload.trigger_price is not None else None})

    @app.get("/api/v1/market/notifications")
    async def notifications(user: ProDep):
        return {"items": await user.store.rows("signal_notifications", {"user_id": f"eq.{user.id}", "order": "created_at.desc"})}

    @app.post("/api/v1/market/notifications/{identifier}/read")
    async def read_notification(identifier: UUID, user: ProDep):
        if not await user.store.rpc("journal_notification_read", {"p_id": str(identifier)}):
            raise HTTPException(404, "Notification not found")
        return {"read": True}

    @app.get("/api/v1/market/performance")
    async def signal_performance(user: ProDep):
        from .signals import performance
        return performance(await user.store.rows("market_signals", {"user_id": f"eq.{user.id}"}))

    @app.get("/api/v1/ai/engine")
    async def engine_status(user: ProDep, request: Request):
        try:
            model = await model_available(request.app.state.client, settings)
            return {"status": "ready", "name": model["name"], "version": model["digest"], "methodology": VERSION, "forecasting_model": None}
        except HTTPException as exc:
            return {"status": "unavailable", "detail": exc.detail, "forecasting_model": None}

    @app.get("/api/v1/market/context")
    async def market_context(user: ProDep, instrument: str = Query(pattern=r"^[A-Z0-9_]{1,30}$"), timeframe: str = Query(pattern=r"^(1m|5m|15m|30m|1h|4h|1d)$"), trading_style: str | None = Query(default=None, pattern=r"^(SCALPING|INTRADAY|SWING)$")):
        return await asyncio.to_thread(load_market, settings, instrument, timeframe, trading_style=trading_style)

    @app.post("/api/v1/market/refresh")
    async def refresh_market(payload: Analysis, user: ProDep):
        if not payload.instrument or not payload.timeframe:
            raise HTTPException(422, "Select an instrument and timeframe")
        return await asyncio.to_thread(load_market, settings, payload.instrument, payload.timeframe, trading_style=payload.trading_style)

    @app.post("/api/v1/imports", status_code=202)
    async def imports(payload: Import, user: UserDep, key: Key):
        if not re.fullmatch(re.escape(user.id) + "/" + payload.file_sha256 + r"\.(pdf|png|jpg|jpeg|csv|txt)", payload.storage_path):
            raise HTTPException(422, "Confirmed imports require the owned file returned by the upload endpoint")
        accounts = {row["id"] for row in await user.store.rows("trading_accounts", {"user_id": f"eq.{user.id}"})}
        strategies = {row["id"] for row in await user.store.rows("strategies", {"user_id": f"eq.{user.id}"})}
        if any(str(trade.account_id) not in accounts or trade.strategy_id and str(trade.strategy_id) not in strategies for trade in payload.trades):
            raise HTTPException(404, "Account or strategy not found")
        return await create_job(user, "import", payload.model_dump(mode="json"), key)

    @app.post("/api/v1/imports/files", status_code=201)
    async def upload(request: Request, user: UserDep):
        if await user.store.rpc("journal_rate_limit", {"p_bucket": "pro_upload", "p_limit": 10, "p_window_seconds": 600}) is not True:
            raise HTTPException(429, "Upload rate limit reached")
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > 10_000_000:
                raise HTTPException(413, "Maximum upload size is 10 MB")
            chunks.append(chunk)
        content = b"".join(chunks)
        mime = request.headers.get("content-type", "").split(";")[0]
        if mime == "application/pdf" and content.startswith(b"%PDF-"):
            extension = "pdf"
        elif mime in ("image/png", "image/jpeg"):
            try:
                with Image.open(BytesIO(content)) as image:
                    if image.format != ("PNG" if mime == "image/png" else "JPEG") or image.width * image.height > 12_000_000:
                        raise ValueError("Invalid image format or dimensions")
                    image.verify()
            except Exception as exc:
                raise HTTPException(422, "Image content or dimensions failed validation") from exc
            extension = "png" if mime == "image/png" else "jpg"
        elif mime in ("text/csv", "text/plain"):
            try:
                text = content.decode("utf-8-sig")
                if not text.strip() or "\x00" in text:
                    raise ValueError
            except (UnicodeDecodeError, ValueError) as exc:
                raise HTTPException(422, "Text imports must be nonempty UTF-8") from exc
            extension = "csv" if mime == "text/csv" else "txt"
        else:
            raise HTTPException(422, "Allowed uploads: verified PDF, PNG, UTF-8 CSV or TXT")
        digest = hashlib.sha256(content).hexdigest()
        path = f"{user.id}/{digest}.{extension}"
        try:
            await user.store.request("POST", "/storage/v1/object/journal-imports/" + path, content=content,
                                     headers={"Content-Type": mime, "x-upsert": "false"})
        except HTTPException as exc:
            if exc.status_code != 409:
                raise
            # A content-addressed retry reuses the immutable owned file, without UPDATE privileges.
            existing = await request.app.state.client.head(settings.supabase_url + "/storage/v1/object/authenticated/journal-imports/" + path,
                                                          headers=user.store.headers)
            if existing.status_code != 200:
                raise HTTPException(409, "The existing private upload could not be verified") from exc
        return {"file_sha256": digest, "storage_path": path, "private": True,
                "next_action": "Review extracted records in the existing importer before confirming"}

    @app.get("/api/v1/news")
    async def news(user: PlusDep, country: str = Query(default="", pattern=r"^(|[A-Z]{2})$"), region: str = Query(default="", max_length=30),
                   category: str = Query(default="", max_length=50), q: str = Query(default="", max_length=200),
                   source_id: str = Query(default="", pattern=r"^(|[a-z][a-z0-9_]{0,63})$"), archive_prefix: str = Query(default="", pattern=r"^(|[a-f0-9]{2})$"),
                   start: date | None = None, end: date | None = None, offset: int = Query(default=0, ge=0, le=100000), limit: int = Query(default=30, ge=1, le=100)):
        dataset = await data_file(settings, "berita.json")
        registry = await data_file(settings, "regional-sources.json")
        regions = await data_file(settings, "services/pro_api/regions.json") if region else {}
        country_set = set(regions.get(region, [])) if region else None
        if region and country_set is not None and not country_set:
            raise HTTPException(422, "Region is not configured")
        allowed = set(user.access["countries"])
        if user.access["plan"] == "plus" and country and country not in allowed:
            raise HTTPException(403, "This country is outside your subscription regions")
        source_countries = {}
        for code, sources in registry.items():
            if re.fullmatch(r"[A-Z]{2}", code):
                for source in sources:
                    source_countries.setdefault(source["id"], set()).add(code)
        sources = {source["id"]: source for source in dataset.get("sources", [])}
        archive = await data_file(settings, "news/archive/" + archive_prefix + ".json") if archive_prefix else dataset
        rows, seen = [], set()
        for article in archive.get("items", []):
            if source_id and article.get("source") != source_id:
                continue
            countries = set(article.get("countries", [])) or source_countries.get(article.get("source"), set())
            if user.access["plan"] == "plus" and (not countries or not countries <= allowed):
                continue
            if country and country not in countries or country_set is not None and not countries & country_set:
                continue
            if category and article.get("category") != category and category not in article.get("topics", []):
                continue
            if q and q.casefold() not in (article.get("title", "") + " " + article.get("excerpt", "")).casefold():
                continue
            published = article.get("publishedAt")
            day = datetime.fromisoformat(published.replace("Z", "+00:00")).date() if published else None
            if (start or end) and not day or day and (start and day < start or end and day > end):
                continue
            if article["url"] in seen or not article["url"].startswith("https://"):
                continue
            seen.add(article["url"])
            rows.append({**article, "countries": sorted(countries), "source_label": sources.get(article["source"], {}).get("name", article["source"])})
        return {"version": 1, "items": rows[offset:offset + limit], "total": len(rows), "offset": offset,
                "sources": [item for item in sources.values() if not source_id or item["id"] == source_id],
                "checkedAt": archive.get("checkedAt"), "intervalMinutes": dataset.get("intervalMinutes", 5),
                "checked_at": dataset.get("checkedAt"), "attribution": "Publisher excerpts and original links; full text requires a separate license"}

    @app.get("/api/v1/news/filters")
    async def news_filters(user: PlusDep):
        registry = await data_file(settings, "regional-sources.json")
        regions = await data_file(settings, "services/pro_api/regions.json")
        countries = sorted(code for code in registry if re.fullmatch(r"[A-Z]{2}", code)
                           and (user.access["plan"] == "pro" or code in user.access["countries"]))
        dataset = await data_file(settings, "berita.json")
        return {"countries": countries, "regions": [region for region, codes in regions.items() if set(codes) & set(countries)],
                "categories": sorted({str(value) for item in dataset.get("items", [])
                                      for value in [item.get("category"), *item.get("topics", [])] if value})}

    @app.get("/api/v1/economic-calendar")
    async def calendar(user: PlusDep, start: date | None = None, end: date | None = None,
                       country: str = Query(default="", pattern=r"^(|[A-Z]{2})$"), impact: int | None = Query(default=None, ge=1, le=3), tz: str = "UTC"):
        zone = ZoneInfo(Filters(start=start, end=end, tz=tz).tz)
        data = await data_file(settings, "kalender.json")
        items = []
        for item in data.get("items", []):
            if country and item.get("countryCode") != country or impact and item.get("dmp") != impact:
                continue
            values = {target: None if item.get(source) in (None, "") else item[source]
                      for target, source in (("previous", "sbl"), ("forecast", "prk"), ("actual", "akt"))}
            event = {**item, **values,
                     "time": None, "timezone": tz, "source_timezone": settings.calendar_timezone}
            day = date.fromisoformat(item["tgl"])
            if re.fullmatch(r"\d{2}:\d{2}", item.get("jam", "")):
                moment = datetime.fromisoformat(item["tgl"] + "T" + item["jam"]).replace(tzinfo=ZoneInfo(settings.calendar_timezone))
                event["time"] = moment.astimezone(zone).isoformat()
                day = moment.astimezone(zone).date()
            if start and day < start or end and day > end:
                continue
            items.append(event)
        return {"items": items, "checked_at": data.get("checkedAt"), "updated": data.get("updated"), "agenda": data.get("agenda", []),
                "coverageStart": data.get("coverageStart"), "coverageEnd": data.get("coverageEnd"),
                "source": data.get("source"), "status": data.get("status"), "timezone": tz}

    return app


app = create_app()
