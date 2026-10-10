"""Authorized operator-supplied snapshots. No chart scraping or invented prices."""
import json
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from math import sqrt
from statistics import mean
from urllib.parse import urlparse

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .analytics import number, timestamp, wire
from .statistical import forecast

TIMEFRAMES = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400}


class Candle(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timestamp: datetime
    open: Decimal = Field(gt=0)
    high: Decimal = Field(gt=0)
    low: Decimal = Field(gt=0)
    close: Decimal = Field(gt=0)
    volume: Decimal | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def valid_candle(self):
        if self.timestamp.tzinfo is None or self.low > min(self.open, self.close) or self.high < max(self.open, self.close) or self.low > self.high:
            raise ValueError("Invalid OHLC or timestamp")
        return self


class Snapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    instrument: str
    timeframe: str
    provider: str = Field(min_length=1, max_length=100)
    license_reference: str = Field(min_length=1, max_length=1000)
    as_of: datetime
    market_open: bool
    valid_until: datetime
    candles: list[Candle] = Field(min_length=51, max_length=10000)
    macro: list[dict] = Field(default_factory=list, max_length=100)
    news: list[dict] = Field(default_factory=list, max_length=100)
    geopolitics: list[dict] = Field(default_factory=list, max_length=100)
    cross_market: dict[str, list[dict]] = Field(default_factory=dict)
    other_timeframes: dict[str, list[Candle]] = Field(default_factory=dict)

    @model_validator(mode="after")
    def timestamps(self):
        if self.as_of.tzinfo is None or self.valid_until.tzinfo is None:
            raise ValueError("Snapshot times must include timezone")
        stamps = [c.timestamp for c in self.candles]
        if stamps != sorted(set(stamps)) or stamps[-1] > self.as_of or self.as_of > self.valid_until:
            raise ValueError("Snapshot timestamps are inconsistent")
        for items in (self.macro, self.news, self.geopolitics):
            for item in items:
                reference = urlparse(item.get("source_url", ""))
                moment = timestamp(item.get("timestamp"))
                if reference.scheme != "https" or not reference.hostname or reference.username or reference.password or moment is None or moment > self.as_of:
                    raise ValueError("Context evidence requires HTTPS source and timestamp")
        return self


def technical(candles):
    closes = [c.close for c in candles]
    changes = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gain = sum(max(change, Decimal(0)) for change in changes[:14]) / 14
    loss = sum(max(-change, Decimal(0)) for change in changes[:14]) / 14
    for change in changes[14:]:
        gain = (gain * 13 + max(change, Decimal(0))) / 14
        loss = (loss * 13 + max(-change, Decimal(0))) / 14
    rsi = Decimal(100) if loss == 0 and gain > 0 else Decimal(50) if loss == 0 else 100 - 100 / (1 + gain / loss)
    ranges = [max(candles[i].high - candles[i].low, abs(candles[i].high - candles[i - 1].close),
                  abs(candles[i].low - candles[i - 1].close)) for i in range(1, len(candles))]
    atr = sum(ranges[:14]) / 14
    for value in ranges[14:]:
        atr = (atr * 13 + value) / 14
    sma20, sma50 = sum(closes[-20:]) / 20, sum(closes[-50:]) / 50
    swing_highs, swing_lows = [], []
    for i in range(2, len(candles) - 2):
        if candles[i].high == max(c.high for c in candles[i - 2:i + 3]):
            swing_highs.append(candles[i].high)
        if candles[i].low == min(c.low for c in candles[i - 2:i + 3]):
            swing_lows.append(candles[i].low)
    trend = "bullish" if closes[-1] > sma20 > sma50 else "bearish" if closes[-1] < sma20 < sma50 else "neutral"
    returns = [float(closes[i] / closes[i - 1] - 1) for i in range(1, len(closes))]
    volatility = sqrt(sum((value - mean(returns)) ** 2 for value in returns) / len(returns))
    volume = [c.volume for c in candles[-20:] if c.volume is not None]
    structure = "higher_highs_and_lows" if len(swing_highs) > 1 and len(swing_lows) > 1 and swing_highs[-1] > swing_highs[-2] and swing_lows[-1] > swing_lows[-2] else "lower_highs_and_lows" if len(swing_highs) > 1 and len(swing_lows) > 1 and swing_highs[-1] < swing_highs[-2] and swing_lows[-1] < swing_lows[-2] else "mixed_or_insufficient_swings"
    return wire({"trend": trend, "structure": structure, "sma20": sma20, "sma50": sma50, "rsi14": rsi,
                 "atr14": atr, "support": swing_lows[-3:], "resistance": swing_highs[-3:],
                 "volatility_per_bar": str(volatility), "momentum_10_bars": closes[-1] / closes[-11] - 1,
                 "average_volume20": sum(volume) / len(volume) if len(volume) == 20 else None})


def correlation(candles, other):
    a = {c.timestamp: c.close for c in candles}
    b = {timestamp(row["timestamp"]): number(row["close"]) for row in other}
    common = sorted(a.keys() & b.keys())
    if len(common) < 31:
        return {"correlation": None, "sample_size": max(0, len(common) - 1), "warning": "At least 30 aligned returns are required"}
    x, y = [], []
    for prev, current in zip(common, common[1:]):
        if b[prev] is None or b[prev] <= 0 or b[current] is None or b[current] <= 0:
            raise ValueError("Invalid cross-market close")
        x.append(float(a[current] / a[prev] - 1))
        y.append(float(b[current] / b[prev] - 1))
    xm, ym = mean(x), mean(y)
    denominator = sqrt(sum((v - xm) ** 2 for v in x) * sum((v - ym) ** 2 for v in y))
    return {"correlation": sum((u - xm) * (v - ym) for u, v in zip(x, y)) / denominator if denominator else None,
            "sample_size": len(x), "warning": "Historical correlation is not causation and may change"}


def load_market(settings, instrument, timeframe, now=None):
    if not re.fullmatch(r"[A-Z0-9_]{1,30}", instrument) or timeframe not in TIMEFRAMES:
        raise HTTPException(422, "Unsupported instrument or timeframe")
    # Operator configuration is the authorization boundary; users cannot supply a URL or path.
    manifest_file = settings.market_root / "manifest.json"
    if not manifest_file.is_file():
        raise HTTPException(503, "An authorized market provider and instrument manifest have not been configured")
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    if instrument not in manifest.get("instruments", {}):
        raise HTTPException(422, "Instrument is not configured by the authorized provider")
    path = (settings.market_root / f"{instrument}_{timeframe}.json").resolve()
    if path.parent != settings.market_root or not path.is_file() or path.stat().st_size > 5_000_000:
        raise HTTPException(503, "Market snapshot is unavailable")
    try:
        snapshot = Snapshot.model_validate_json(path.read_bytes())
        now = now or datetime.now(timezone.utc)
        if snapshot.instrument != instrument or snapshot.timeframe != timeframe:
            raise ValueError("Snapshot mapping mismatch")
        if snapshot.as_of > now + timedelta(seconds=30) or snapshot.valid_until < now:
            raise HTTPException(409, "Market data is stale or its timestamp is invalid")
        if snapshot.market_open and now - snapshot.as_of > timedelta(seconds=TIMEFRAMES[timeframe] * 2):
            raise HTTPException(409, "Market data is stale")
        if snapshot.market_open and now - snapshot.candles[-1].timestamp > timedelta(seconds=TIMEFRAMES[timeframe] * 2):
            raise HTTPException(409, "The latest market bar is stale")
        for frame, candles in snapshot.other_timeframes.items():
            stamps = [c.timestamp for c in candles]
            if frame not in TIMEFRAMES or len(candles) < 51 or candles[-1].timestamp > snapshot.as_of or stamps != sorted(set(stamps)):
                raise ValueError("Invalid multi-timeframe evidence")
            if snapshot.market_open and now - candles[-1].timestamp > timedelta(seconds=TIMEFRAMES[frame] * 2):
                raise HTTPException(409, "Multi-timeframe market data is stale")
        return {"instrument": instrument, "timeframe": timeframe, "tradingview_symbol": manifest["instruments"][instrument]["tradingview_symbol"],
                "as_of": snapshot.as_of.isoformat(), "provider": snapshot.provider,
                "license_reference": snapshot.license_reference, "market_open": snapshot.market_open,
                "technical": technical(snapshot.candles), "macro": snapshot.macro, "news": snapshot.news,
                "geopolitics": snapshot.geopolitics,
                "multi_timeframe": {frame: technical(candles) for frame, candles in snapshot.other_timeframes.items()},
                "correlations": {symbol: correlation(snapshot.candles, points) for symbol, points in snapshot.cross_market.items()},
                "statistical_forecast": forecast(snapshot.candles),
                "data_freshness": "fresh"}
    except HTTPException:
        raise
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(503, "The configured market snapshot failed validation") from exc
