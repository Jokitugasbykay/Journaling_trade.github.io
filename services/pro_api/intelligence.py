"""Independent sourced fundamental assessment; no headline-to-price predictions."""
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, model_validator

from .models import Input


class FundamentalEvent(Input):
    event_id: str = Field(min_length=1, max_length=160)
    title: str = Field(min_length=1, max_length=500)
    category: str = Field(min_length=1, max_length=100)
    region: str = Field(min_length=1, max_length=100)
    source_url: str
    published_at: datetime
    event_at: datetime
    valid_until: datetime
    verification: Literal["confirmed", "expectation", "interpretation", "rumor", "unverified"]
    affected_instruments: list[str] = Field(min_length=1, max_length=100)
    relevance: Literal["high", "medium", "low"]
    severity: Literal["high", "medium", "low"]
    mechanism: str = Field(min_length=1, max_length=2000)
    evidence: list[str] = Field(min_length=1, max_length=20)
    bias: Literal["bullish", "bearish", "neutral", "unknown"] = "unknown"

    @model_validator(mode="after")
    def provenance(self):
        source = urlparse(self.source_url)
        if source.scheme != "https" or not source.hostname or source.username or source.password:
            raise ValueError("An HTTPS original source is required")
        if any(value.tzinfo is None for value in (self.published_at, self.event_at, self.valid_until)):
            raise ValueError("Event timestamps require timezones")
        if self.valid_until < self.published_at:
            raise ValueError("Event freshness window is invalid")
        return self


def fundamentals(events, instrument, now):
    relevant, excluded, contextual, seen = [], [], [], set()
    for event in sorted((FundamentalEvent.model_validate(raw) for raw in events), key=lambda row: row.published_at, reverse=True):
        if event.event_id in seen:
            continue
        seen.add(event.event_id)
        if instrument not in event.affected_instruments:
            continue
        if event.published_at > now or event.valid_until < now:
            excluded.append({"event_id": event.event_id, "reason": "Stale, unpublished or not a confirmed fact"})
            continue
        if event.verification != "confirmed":
            contextual.append({**event.model_dump(mode="json"), "evidence_id": "fundamental:" + event.event_id})
            excluded.append({"event_id": event.event_id, "reason": "Not a confirmed fact; context only"})
            continue
        relevant.append({**event.model_dump(mode="json"), "evidence_id": "fundamental:" + event.event_id})
    directions = {row["bias"] for row in relevant if row["relevance"] != "low" and row["bias"] in ("bullish", "bearish")}
    bias = "conflicting" if len(directions) > 1 else next(iter(directions), "insufficient evidence")
    return {"bias": bias, "events": relevant, "context_events": contextual, "excluded": excluded,
            "major_event_risks": [row for row in relevant if row["severity"] == "high" and datetime.fromisoformat(row["event_at"]) >= now],
            "monitoring_status": "snapshot only" if relevant else "unavailable",
            "warning": "Fundamental monitoring is temporarily unavailable. Timestamped snapshot evidence is available; continuous ingestion has not been verified." if relevant else "Fundamental monitoring is temporarily unavailable."}


def synthesize(technical, events, instrument, style, now):
    fundamental = fundamentals(events, instrument, now)
    signal = dict(technical["signal"])
    technical_bias = {"BUY": "bullish", "SELL": "bearish", "NEUTRAL": "neutral"}[signal["bias"]]
    fundamental_bias = fundamental["bias"]
    agreement = "INSUFFICIENT EVIDENCE" if fundamental_bias == "insufficient evidence" or technical_bias == "neutral" else "ALIGNED" if fundamental_bias == technical_bias else "CONFLICTING"
    actionable = agreement == "ALIGNED" and signal["direction"] in ("BUY", "SELL") and not fundamental["major_event_risks"]
    if style is None:
        actionable = False
    if not actionable:
        signal.update(direction="NO TRADE", status="INSUFFICIENT DATA" if agreement == "INSUFFICIENT EVIDENCE" else "WAITING FOR CONFIRMATION",
                      entry=None, stop_loss=None, take_profit=None, risk_reward=None)
    scenarios = []
    for direction, name in (("BUY", "bullish"), ("SELL", "bearish")):
        supported = actionable and signal["direction"] == direction
        watch_levels = technical["signal"] if technical["signal"]["direction"] == direction else None
        scenarios.append({"direction": direction, "probability": None, "probability_status": "Not calibrated",
                          "setup_status": "CONFIRMED" if supported else "AWAITING CONFIRMATION",
                          "trigger_conditions": technical["scenarios"][name],
                          "confirmation_conditions": ["At least three independent Kaystrade confirmations", "Fresh fundamental evidence aligned with technical structure"],
                          "entry": watch_levels["entry"] if watch_levels else None, "stop_loss": watch_levels["stop_loss"] if watch_levels else None,
                          "entry_zone": {"confirmed_close_reference": watch_levels["entry"], "zone_bounds": None} if watch_levels else None,
                          "take_profit_1": watch_levels["take_profit"] if watch_levels else None, "take_profit_2": None,
                          "risk_reward": watch_levels["risk_reward"] if watch_levels else None,
                          "invalidation_conditions": signal["invalidation_conditions"],
                          "invalidation_level": technical.get("invalidation_level") if watch_levels else None, "forecast_horizon": None,
                          "technical_evidence": signal["confirmations"], "fundamental_evidence": fundamental["events"],
                          "timestamp": now.isoformat(), "trading_style": style})
    return {"trading_style": style, "signal": signal, "fundamental": fundamental,
            "comparison": {"technical_bias": technical_bias, "fundamental_bias": fundamental_bias, "agreement": agreement,
                           "supporting_evidence": {"technical": signal["confirmations"], "fundamental": [row for row in fundamental["events"] if row["bias"] == technical_bias]},
                           "conflicting_evidence": [row for row in fundamental["events"] if row["bias"] in ("bullish", "bearish") and row["bias"] != technical_bias],
                           "major_event_risks": fundamental["major_event_risks"],
                           "data_freshness": {"evaluated_at": now.isoformat(), "latest_publication": fundamental["events"][0]["published_at"] if fundamental["events"] else None},
                           "recommended_action": "BUY SETUP" if actionable and signal["direction"] == "BUY" else "SELL SETUP" if actionable else "INSUFFICIENT DATA" if agreement == "INSUFFICIENT EVIDENCE" else "WAIT FOR CONFIRMATION"},
            "scenarios": scenarios, "probability_model": None,
            "warnings": ["Risk reward is a price-distance ratio; execution costs and monetary risk require instrument specifications."]}
