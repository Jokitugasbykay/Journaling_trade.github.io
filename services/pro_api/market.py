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
from .kaystrade import analyze

TIMEFRAMES = {"1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400}


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


class TechnicalRating(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timeframe: str
    summary: str
    moving_averages: str
    oscillators: str
    timestamp: datetime
    source_url: str
    tradingview_symbol: str = Field(pattern=r"^[A-Z0-9_.]+:[A-Z0-9_.]+$")

    @model_validator(mode="after")
    def valid_rating(self):
        source = urlparse(self.source_url)
        if self.timeframe not in ("4h", "1d") or any(getattr(self, key) not in ("buy", "sell", "neutral") for key in ("summary", "moving_averages", "oscillators")):
            raise ValueError("Invalid Technicals rating")
        if self.timestamp.tzinfo is None or source.scheme != "https" or source.hostname not in ("www.tradingview.com", "tradingview.com") or source.username or source.password:
            raise ValueError("Technicals require verified TradingView source and timestamp")
        if source.path.rstrip("/") != "/symbols/" + self.tradingview_symbol.replace(":", "-") + "/technicals":
            raise ValueError("Technicals source does not match its instrument")
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
    price_tick: Decimal | None = Field(default=None, gt=0, allow_inf_nan=False)
    delayed: bool = False
    delay_seconds: int = Field(default=0, ge=0, le=86400)
    technicals: list[TechnicalRating] = Field(default_factory=list, max_length=2)
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
        if len({r.timeframe for r in self.technicals}) != len(self.technicals) or any(r.timestamp > self.as_of or self.as_of - r.timestamp > timedelta(seconds=TIMEFRAMES[r.timeframe]) for r in self.technicals):
            raise ValueError("Technicals timestamps are stale or duplicated")
        for items in (self.macro, self.news, self.geopolitics):
            for item in items:
                reference = urlparse(item.get("source_url", ""))
                moment = timestamp(item.get("timestamp"))
                if reference.scheme != "https" or not reference.hostname or reference.username or reference.password or moment is None or moment > self.as_of:
                    raise ValueError("Context evidence requires HTTPS source and timestamp")
        for points in self.cross_market.values():
            if any(not isinstance(row, dict) for row in points):
                raise ValueError("Invalid cross-market evidence")
            stamps = [timestamp(row.get("timestamp")) for row in points]
            prices = [number(row.get("close")) for row in points]
            if len(points) > 10000 or any(t is None or t > self.as_of for t in stamps) or stamps != sorted(set(stamps)) or any(p is None or not p.is_finite() or p <= 0 for p in prices):
                raise ValueError("Invalid cross-market evidence")
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
    if not candles:
        return {"correlation": None, "sample_size": 0, "warning": "No closed bars are available"}
    a = {c.timestamp: c.close for c in candles}
    b = {timestamp(row["timestamp"]): number(row["close"]) for row in other}
    common = sorted(a.keys() & b.keys())
    if not common or common[-1] != candles[-1].timestamp:
        return {"correlation": None, "sample_size": max(0, len(common) - 1), "warning": "Latest closed-bar timestamps are not aligned"}
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


def instrument_catalog(settings):
    path = settings.market_root / "manifest.json"
    try:
        if path.stat().st_size > 100000:
            raise ValueError("Manifest too large")
        manifest = json.loads(path.read_text(encoding="utf-8"))
        items = []
        for symbol, row in manifest["instruments"].items():
            if not re.fullmatch(r"[A-Z0-9_]{1,30}", symbol) or not re.fullmatch(r"[A-Z0-9_.:-]{1,100}", row["tradingview_symbol"], re.I):
                raise ValueError("Invalid instrument mapping")
            frames = row.get("timeframes", [frame for frame in TIMEFRAMES if (settings.market_root / f"{symbol}_{frame}.json").is_file()])
            if not frames or any(frame not in TIMEFRAMES for frame in frames):
                raise ValueError("Invalid provider timeframe mapping")
            items.append({"symbol": symbol, "name": row.get("name", symbol), "asset_class": row.get("asset_class", "Unspecified"),
                          "tradingview_symbol": row["tradingview_symbol"], "timeframes": frames})
        return {"items": items, "timeframes": list(TIMEFRAMES)}
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise HTTPException(503, "An authorized provider instrument manifest is unavailable or invalid") from exc


def load_market(settings, instrument, timeframe, now=None):
    if not re.fullmatch(r"[A-Z0-9_]{1,30}", instrument) or timeframe not in TIMEFRAMES:
        raise HTTPException(422, "Unsupported instrument or timeframe")
    # Operator configuration is the authorization boundary; users cannot supply a URL or path.
    mapped = next((row for row in instrument_catalog(settings)["items"] if row["symbol"] == instrument), None)
    if mapped is None or timeframe not in mapped["timeframes"]:
        raise HTTPException(422, "Instrument or timeframe is not configured by the authorized provider")
    path = (settings.market_root / f"{instrument}_{timeframe}.json").resolve()
    if path.parent != settings.market_root or not path.is_file() or path.stat().st_size > 5_000_000:
        raise HTTPException(503, "Market snapshot is unavailable")
    try:
        snapshot = Snapshot.model_validate_json(path.read_bytes())
        now = now or datetime.now(timezone.utc)
        if snapshot.instrument != instrument or snapshot.timeframe != timeframe:
            raise ValueError("Snapshot mapping mismatch")
        if any(r.tradingview_symbol != mapped["tradingview_symbol"] for r in snapshot.technicals):
            raise ValueError("Technicals belong to another instrument")
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
        closed = [c for c in snapshot.candles if c.timestamp + timedelta(seconds=TIMEFRAMES[timeframe]) <= snapshot.as_of]
        closed_frames = {frame: [c for c in candles if c.timestamp + timedelta(seconds=TIMEFRAMES[frame]) <= snapshot.as_of] for frame, candles in snapshot.other_timeframes.items()}
        return {"instrument": instrument, "timeframe": timeframe, "tradingview_symbol": mapped["tradingview_symbol"],
                "name": mapped["name"], "asset_class": mapped["asset_class"],
                "as_of": snapshot.as_of.isoformat(), "provider": snapshot.provider,
                "license_reference": snapshot.license_reference, "market_open": snapshot.market_open,
                "current_price": str(snapshot.candles[-1].close), "delayed": snapshot.delayed, "delay_seconds": snapshot.delay_seconds,
                "kaystrade": analyze(snapshot, TIMEFRAMES),
                "technical": technical(closed) if len(closed) >= 51 else {"status": "insufficient_closed_bars"}, "macro": snapshot.macro, "news": snapshot.news,
                "geopolitics": snapshot.geopolitics,
                "multi_timeframe": {frame: technical(candles) for frame, candles in closed_frames.items() if len(candles) >= 51},
                "correlations": {symbol: correlation(closed, points) for symbol, points in snapshot.cross_market.items()},
                "statistical_forecast": forecast(closed),
                "data_freshness": "delayed" if snapshot.delayed else "fresh"}
    except HTTPException:
        raise
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(503, "The configured market snapshot failed validation") from exc
