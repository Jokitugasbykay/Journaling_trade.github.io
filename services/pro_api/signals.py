"""Paper monitoring is separate from manually confirmed execution and broker outcomes."""
import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx

from .market import Snapshot, TIMEFRAMES, instrument_catalog, load_market
from .store import Settings, Store, entitlements

log = logging.getLogger("journalingtrade.monitor")


def performance(rows):
    result = {"total_accepted_signals": sum(bool(row.get("accepted_at")) for row in rows), "categories": {}}
    for mode in ("actual", "paper"):
        accepted = [row for row in rows if row.get("accepted_at") and row["mode"] == mode]
        executed = [row for row in accepted if row["execution_confirmed"]]
        # Actual outcomes require reconciliation to verified execution evidence, not user clicks or OHLC touches.
        closed = [row for row in executed if mode == "paper" and row["outcome"] in ("win", "loss", "breakeven")]
        wins = sum(row["outcome"] == "win" for row in closed)
        losses = sum(row["outcome"] == "loss" for row in closed)
        result["categories"][mode] = {"accepted": len(accepted), "confirmed_executions": len(executed),
            "closed_wins": wins, "closed_losses": losses, "breakeven": sum(row["outcome"] == "breakeven" for row in closed),
            "ambiguous": sum(row["outcome"] == "AMBIGUOUS" for row in executed),
            "open": sum(not row["outcome"] for row in executed), "winrate": wins / (wins + losses) if wins + losses else None,
            "winrate_definition": "Closed winning / (closed winning + closed losing); breakeven excluded",
            "average_planned_risk_reward": str(sum(Decimal(str(row["risk_reward"])) for row in accepted) / len(accepted)) if accepted else None,
            "realized_pnl": None, "maximum_drawdown": None,
            "warning": "Actual outcomes are unavailable until verified execution reconciliation is configured." if mode == "actual" else "Paper results use closed OHLC bars; they are not actual broker fills."}
        for field in ("instrument", "trading_style", "model_version"):
            groups = {}
            for row in closed:
                key = json.dumps(row[field], sort_keys=True) if isinstance(row[field], dict) else row[field]
                counts = groups.setdefault(key, {"wins": 0, "losses": 0, "breakeven": 0})
                counts[{"win": "wins", "loss": "losses", "breakeven": "breakeven"}[row["outcome"]]] += 1
            result["categories"][mode]["by_" + field] = groups
    result["historical_backtest"] = {"status": "Not requested; not included in live signal performance"}
    return result


def price_events(signal, alerts, candles, now, current_intelligence=None):
    # ponytail: closed OHLC bars; an authorized tick feed is needed for exact trigger order and time.
    events, outcome = [], None
    created = datetime.fromisoformat(signal["created_at"].replace("Z", "+00:00"))
    executed = datetime.fromisoformat(signal["executed_at"].replace("Z", "+00:00")) if signal.get("executed_at") else None
    timeframe = TIMEFRAMES[signal["timeframe"]]
    last_observed = datetime.fromisoformat(signal["monitored_through"].replace("Z", "+00:00")) if signal.get("monitored_through") else None
    covered_until, missing_coverage = last_observed or executed or created, not signal.get("coverage_complete", True)
    pending = {row["kind"]: row for row in alerts if row["enabled"] and not row.get("triggered_at")}

    def emit(kind, moment, price, explanation):
        if kind in pending:
            events.append({"alert_id": pending.pop(kind)["id"], "kind": kind, "timestamp": moment.isoformat(),
                           "price": str(price) if price is not None else None, "explanation": explanation})

    if not signal["execution_confirmed"] and datetime.fromisoformat(signal["expires_at"].replace("Z", "+00:00")) <= now:
        emit("expired", now, None, "Analysis validity window expired; this was not an executed trade.")
        return {"events": events, "status": "expired", "outcome": None, "execution_timestamp": signal.get("executed_at")}
    for candle in candles:
        close_time = candle.timestamp + timedelta(seconds=timeframe)
        if close_time > now or close_time < created or last_observed and close_time <= last_observed:
            continue
        if executed and signal["trading_style"] == "INTRADAY" and close_time > executed + timedelta(hours=24):
            break
        watch = pending.get("entry_watch")
        if watch and watch.get("trigger_price") is not None and candle.low <= Decimal(str(watch["trigger_price"])) <= candle.high:
            emit("entry_watch", close_time, watch["trigger_price"], "Closed-bar price range reached the watch level; exact touch order/time and execution are not established.")
        if not executed or close_time < executed:
            covered_until = close_time
            continue
        if candle.timestamp > covered_until:
            missing_coverage = True
        covered_until = close_time
        stop, target = Decimal(str(signal["stop_loss"])), Decimal(str(signal["take_profit"]))
        stop_hit = candle.low <= stop if signal["direction"] == "BUY" else candle.high >= stop
        target_hit = candle.high >= target if signal["direction"] == "BUY" else candle.low <= target
        if not stop_hit and not target_hit:
            continue
        ambiguous = stop_hit and target_hit or candle.timestamp < executed or missing_coverage
        if stop_hit:
            emit("stop_loss", close_time, stop, "Stop level occurred in the observed bar. " + ("Order or relation to execution is AMBIGUOUS." if ambiguous else "This is a price alert, not proof of a broker exit."))
        if target_hit:
            emit("take_profit_1", close_time, target, "Target level occurred in the observed bar. " + ("Order or relation to execution is AMBIGUOUS." if ambiguous else "This is a price alert, not proof of a broker exit."))
        if signal["mode"] == "paper":
            outcome = "AMBIGUOUS" if ambiguous else "loss" if stop_hit else "win"
            break
    status = "closed" if outcome else signal["status"]
    if executed and signal["trading_style"] == "INTRADAY" and now >= executed + timedelta(hours=24) and not outcome:
        emit("expired", now, None, "Historical Kaystrade intraday limit of 24 hours exceeded; no broker exit is assumed.")
        if signal["mode"] == "paper":
            outcome, status = "AMBIGUOUS", "closed"
    if current_intelligence:
        assessment = current_intelligence["signal"]
        original = {event["event_id"]: event for event in signal.get("fundamental_events", [])}
        major = [event for event in current_intelligence["fundamental"]["events"] if event["severity"] == "high" and
                 (datetime.fromisoformat(event["published_at"]) > datetime.fromisoformat(signal["analyzed_at"].replace("Z", "+00:00")) or event != original.get(event["event_id"]))]
        if major:
            emit("fundamental", now, None, "New verified high-impact fundamental evidence requires a fresh analysis: " + "; ".join(event["event_id"] for event in major))
            emit("invalidated", now, None, "The original analysis predates material fundamental evidence; no automatic broker action is taken.")
            if not outcome:
                status = "invalidated"
        elif status == "active" and assessment["direction"] == signal["direction"] and all(assessment.get(key) is not None and Decimal(str(assessment[key])) == Decimal(str(signal[key])) for key in ("entry", "stop_loss", "take_profit")):
            emit("entry_confirmed", now, assessment["entry"], "Current independent technical and fundamental rules confirm this setup. This does not establish a broker fill.")
        closed = [bar for bar in candles if bar.timestamp + timedelta(seconds=timeframe) <= now]
        if closed and not signal["execution_confirmed"] and (closed[-1].close < Decimal(str(signal["stop_loss"])) if signal["direction"] == "BUY" else closed[-1].close > Decimal(str(signal["stop_loss"]))):
            emit("invalidated", now, closed[-1].close, "A closed bar breached the stored structural invalidation; this is not an executed trade.")
            status = "invalidated"
    return {"events": events, "status": status, "outcome": outcome, "monitored_through": covered_until.isoformat(), "coverage_complete": not missing_coverage,
            "execution_timestamp": signal.get("executed_at")}


async def monitor_once(store, settings, now=None):
    now = now or datetime.now(timezone.utc)
    try:
        catalog = await asyncio.to_thread(instrument_catalog, settings)
        for instrument in catalog["items"]:
            try:
                frame = "15m" if "15m" in instrument["timeframes"] else instrument["timeframes"][0]
                context = await asyncio.to_thread(load_market, settings, instrument["symbol"], frame, now)
                for event in context["intelligence"]["fundamental"]["events"]:
                    await store.insert("fundamental_events", {"event_id": context["provider"] + ":" + event["event_id"], "provider": context["provider"], "evidence": event, "observed_at": now.isoformat()}, upsert=True, conflict="event_id")
            except Exception as exc:
                log.warning("fundamental_snapshot_unavailable instrument=%s error_type=%s", instrument["symbol"], type(exc).__name__)
    except Exception as exc:
        log.warning("fundamental_monitoring_unavailable error_type=%s", type(exc).__name__)
    rows = await store.rows("market_signals", {"status": "in.(active,invalidated)", "action": "neq.dismiss"})
    for signal in rows:
        try:
            if entitlements(await store.rpc("journal_user_access", {"p_user_id": signal["user_id"]}))["plan"] != "pro":
                continue
            if not signal["execution_confirmed"] and datetime.fromisoformat(signal["expires_at"].replace("Z", "+00:00")) <= now:
                await store.rpc("journal_monitor_signal", {"p_id": signal["id"], "p_result": price_events(signal, await store.rows("signal_alerts", {"signal_id": f"eq.{signal['id']}"}), [], now)})
                continue
            context = await asyncio.to_thread(load_market, settings, signal["instrument"], signal["timeframe"], now, signal["trading_style"])
            # load_market validates the pinned file before it is read for closed-bar monitoring.
            snapshot = Snapshot.model_validate_json((settings.market_root / f"{signal['instrument']}_{signal['timeframe']}.json").read_bytes())
            candles = snapshot.candles
            if snapshot.as_of != datetime.fromisoformat(context["as_of"]):
                raise ValueError("Market snapshot changed while reading")
            alerts = await store.rows("signal_alerts", {"signal_id": f"eq.{signal['id']}"})
            result = price_events(signal, alerts, candles, now, context["intelligence"])
            await store.rpc("journal_monitor_signal", {"p_id": signal["id"], "p_result": result})
        except Exception as exc:
            log.warning("signal_monitor_unavailable signal_id=%s error_type=%s", signal["id"], type(exc).__name__)


async def main():
    settings = Settings()
    settings.validate(worker=True)
    async with httpx.AsyncClient(timeout=20, follow_redirects=False) as client:
        store = Store(client, settings, settings.service_key, privileged=True)
        while True:
            try:
                await monitor_once(store, settings)
            except Exception as exc:
                log.warning("monitor_cycle_failed error_type=%s", type(exc).__name__)
            await asyncio.sleep(settings.snapshot_poll_seconds)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
