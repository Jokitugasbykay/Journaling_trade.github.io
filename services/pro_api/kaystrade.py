"""Kaystrade evidence from closed bars. Thresholds are explicit, never an ML forecast."""
from datetime import timedelta
from decimal import Decimal

from .analytics import timestamp, wire
from .models import MarketSignal

VERSION = "kaystrade-closed-bars-v1"
ZERO = Decimal(0)


def rsi_series(candles, period=14):
    closes = [c.close for c in candles]
    values = [None] * min(period, len(closes))
    if len(closes) <= period:
        return values
    changes = [b - a for a, b in zip(closes, closes[1:])]
    gain = sum(max(x, ZERO) for x in changes[:period]) / period
    loss = sum(max(-x, ZERO) for x in changes[:period]) / period
    for index in range(period, len(closes)):
        if index > period:
            gain = (gain * (period - 1) + max(changes[index - 1], ZERO)) / period
            loss = (loss * (period - 1) + max(-changes[index - 1], ZERO)) / period
        values.append(Decimal(100) if loss == 0 and gain > 0 else Decimal(50) if loss == 0 else 100 - 100 / (1 + gain / loss))
    return values


def atr_values(candles, period=14):
    ranges = [max(b.high - b.low, abs(b.high - a.close), abs(b.low - a.close)) for a, b in zip(candles, candles[1:])]
    values = [None] * min(period, len(candles))
    if len(ranges) < period:
        return values
    result = sum(ranges[:period]) / period
    values.append(result)
    for value in ranges[period:]:
        result = (result * (period - 1) + value) / period
        values.append(result)
    return values


def atr(candles, period=14):
    values = atr_values(candles, period)
    return values[-1] if values else None


def pivots(candles, seconds=0):
    points = []
    for i in range(2, len(candles) - 2):
        neighbors = candles[i - 2:i] + candles[i + 1:i + 3]
        for kind in ("high", "low"):
            price = getattr(candles[i], kind)
            if all(price > getattr(c, kind) for c in neighbors) if kind == "high" else all(price < getattr(c, kind) for c in neighbors):
                points.append({"kind": kind, "index": i, "price": price, "confirmed_at": (candles[i + 2].timestamp + timedelta(seconds=seconds)).isoformat()})
    return points


def structure(points):
    highs = [p for p in points if p["kind"] == "high"]
    lows = [p for p in points if p["kind"] == "low"]
    if len(highs) < 2 or len(lows) < 2:
        return "insufficient_swings"
    if highs[-1]["price"] > highs[-2]["price"] and lows[-1]["price"] > lows[-2]["price"]:
        return "HH_HL"
    if highs[-1]["price"] < highs[-2]["price"] and lows[-1]["price"] < lows[-2]["price"]:
        return "LH_LL"
    return "consolidation"


def levels(candles, points, tolerance):
    groups = []
    for point in points:
        group = next((g for g in groups if g["kind"] == point["kind"] and abs(g["price"] - point["price"]) <= tolerance), None)
        if group is None:
            group = {"kind": point["kind"], "price": point["price"], "reactions": 0, "last_index": point["index"]}
            groups.append(group)
        group["reactions"] += 1
        group["last_index"] = point["index"]
        group["timestamp"] = point["confirmed_at"]
    for group in groups:
        group["label"] = "Resistance" if group["kind"] == "high" else "Support"
        if group["kind"] == "low":
            later = candles[group["last_index"] + 3:]
            broke = False
            for c in later:
                if broke and c.high >= group["price"] - tolerance and c.close < group["price"] - tolerance and c.close < c.open:
                    group["label"] = "SBR"
                if c.close < group["price"] - tolerance:
                    broke = True
    return groups


def zones(candles, points):
    # ponytail: bounded 10,000-bar history scans; use incremental zone state if measured feed latency requires it.
    result = []
    thresholds = atr_values(candles)
    for i in range(5, len(candles) - 1):
        origin, departure = candles[i], candles[i + 1]
        threshold = thresholds[i]
        if threshold is None or abs(departure.close - departure.open) < threshold:
            continue
        prior = [p for p in points if p["index"] + 2 <= i]
        for side, opposite, kind in (("Demand", origin.close <= origin.open, "high"), ("Supply", origin.close >= origin.open, "low")):
            swings = [p for p in prior if p["kind"] == kind]
            if not opposite or not swings:
                continue
            swing = swings[-1]
            boundary = swing["price"]
            if any(c.close > boundary if side == "Demand" else c.close < boundary for c in candles[swing["index"] + 3:i + 1]):
                continue
            if not (departure.close > boundary and departure.close > origin.high if side == "Demand" else departure.close < boundary and departure.close < origin.low):
                continue
            later = candles[i + 2:]
            invalid = any(c.close < origin.low if side == "Demand" else c.close > origin.high for c in later)
            touched = any(c.low <= origin.high and c.high >= origin.low for c in later)
            result.append({"label": side, "low": origin.low, "high": origin.high,
                           "status": "invalidated" if invalid else "mitigated" if touched else "fresh",
                           "timestamp": departure.timestamp.isoformat(), "structure_break": boundary})
    return result[-20:]


def gaps(candles, seconds):
    # ponytail: bounded history scan for zone freshness; use incremental mitigation state for larger feeds.
    result = []
    thresholds = atr_values(candles)
    for i in range(2, len(candles)):
        a, b, c = candles[i - 2:i + 1]
        threshold = thresholds[i - 1]
        if threshold is None or abs(b.close - b.open) < threshold:
            continue
        # Cash-session opening gaps are not treated as intrasesion FVGs.
        if b.timestamp - a.timestamp != timedelta(seconds=seconds) or c.timestamp - b.timestamp != timedelta(seconds=seconds):
            continue
        side = "Demand" if c.low > a.high and b.close > b.open else "Supply" if c.high < a.low and b.close < b.open else None
        if side is None:
            continue
        low, high = (a.high, c.low) if side == "Demand" else (c.high, a.low)
        later = candles[i + 1:]
        invalid = any(d.close < low if side == "Demand" else d.close > high for d in later)
        touched = any(d.low <= high and d.high >= low for d in later)
        result.append({"label": side + " FVG", "low": low, "high": high, "timestamp": c.timestamp.isoformat(),
                       "status": "invalidated" if invalid else "mitigated" if touched else "fresh"})
    return result[-20:]


def base_retest(candles):
    last = {"status": "not_found"}
    thresholds = atr_values(candles)
    # ponytail: bounded 100-bar setup scan; expand only after measured missed setups.
    for i in range(max(14, len(candles) - 100), len(candles) - 3):
        threshold = thresholds[i - 1]
        if threshold is None or threshold <= 0:
            continue
        base = candles[i:i + 3]
        low, high = min(c.low for c in base), max(c.high for c in base)
        if high - low > threshold * Decimal("1.5") or any(abs(c.close - c.open) > threshold / 2 for c in base):
            continue
        departure = candles[i + 3]
        direction = "BUY" if departure.close > high else "SELL" if departure.close < low else None
        if direction is None or abs(departure.close - departure.open) < threshold:
            continue
        prior = candles[i - 1]
        continuation = (direction == "BUY" and prior.close > prior.open) or (direction == "SELL" and prior.close < prior.open)
        found = {"status": "awaiting_retest", "direction": direction, "low": low, "high": high,
                 "timestamp": departure.timestamp.isoformat(), "pattern": ("Rally-Base-Rally" if direction == "BUY" else "Drop-Base-Drop") if continuation else "base_breakout"}
        for j in range(i + 4, len(candles)):
            c = candles[j]
            if c.close <= high if direction == "BUY" else c.close >= low:
                found["status"] = "invalidated"
                break
            touches = c.low <= high if direction == "BUY" else c.high >= low
            rejects = c.close > c.open if direction == "BUY" else c.close < c.open
            if touches and rejects:
                found.update(status="confirmed" if j == len(candles) - 1 else "older_retest", rejection_at=c.timestamp.isoformat())
        last = found
    return last


def head_shoulders(candles, points, tolerance):
    alternating = []
    for p in points:
        if alternating and alternating[-1]["kind"] == p["kind"]:
            alternating[-1] = p
        else:
            alternating.append(p)
    if len(alternating) < 5:
        return {"status": "not_confirmed"}
    a, b, c, d, e = alternating[-5:]
    side = "SELL" if [p["kind"] for p in (a, b, c, d, e)] == ["high", "low", "high", "low", "high"] else "BUY" if [p["kind"] for p in (a, b, c, d, e)] == ["low", "high", "low", "high", "low"] else None
    if side is None or abs(a["price"] - e["price"]) > tolerance:
        return {"status": "not_confirmed"}
    head = c["price"] > max(a["price"], e["price"]) + tolerance if side == "SELL" else c["price"] < min(a["price"], e["price"]) - tolerance
    slope = (d["price"] - b["price"]) / (d["index"] - b["index"])
    neckline = b["price"] + slope * (len(candles) - 1 - b["index"])
    previous = neckline - slope
    crossed = candles[-1].close < neckline and candles[-2].close >= previous if side == "SELL" else candles[-1].close > neckline and candles[-2].close <= previous
    return {"status": "confirmed" if head and crossed else "not_confirmed", "direction": side,
            "neckline": neckline, "label": "Head and Shoulders" if side == "SELL" else "Inverse Head and Shoulders"}


def frame_evidence(candles, seconds):
    points = pivots(candles, seconds)
    threshold = atr(candles)
    values = rsi_series(candles)
    ma = [sum(values[i - 13:i + 1]) / 14 if i >= 27 else None for i in range(len(values))]
    direction = "bullish" if values[-1] > 50 and values[-1] > ma[-1] else "bearish" if values[-1] < 50 and values[-1] < ma[-1] else "neutral"
    crossed_up = values[-2] <= ma[-2] and values[-1] > ma[-1]
    crossed_down = values[-2] >= ma[-2] and values[-1] < ma[-1]
    tolerance = threshold * Decimal("0.1")
    mapped = levels(candles, points, tolerance)
    latest = candles[-1]
    sweeps = [{"side": "potential_high_liquidity", "price": p["price"]}
              for p in points[-10:] if p["kind"] == "high" and latest.high > p["price"] > latest.close]
    sweeps += [{"side": "potential_low_liquidity", "price": p["price"]}
               for p in points[-10:] if p["kind"] == "low" and latest.low < p["price"] < latest.close]
    lows = [p for p in points if p["kind"] == "low"]
    trendline = None
    if len(lows) >= 2:
        a, b = lows[-2:]
        trendline = {"anchors": [a, b], "slope_per_bar": (b["price"] - a["price"]) / (b["index"] - a["index"]), "status": "context_only"}
    divergence = "none"
    for kind, name in (("low", "bullish"), ("high", "bearish")):
        selected = [p for p in points if p["kind"] == kind and values[p["index"]] is not None]
        if len(selected) >= 2:
            a, b = selected[-2:]
            diverges = b["price"] < a["price"] and values[b["index"]] > values[a["index"]] if kind == "low" else b["price"] > a["price"] and values[b["index"]] < values[a["index"]]
            trigger = latest.close > candles[b["index"]].high if kind == "low" else latest.close < candles[b["index"]].low
            if diverges and trigger:
                divergence = name + "_price_triggered"
    return {"structure": structure(points), "pivots": points[-20:], "levels": mapped[-30:], "level_merge_tolerance": tolerance,
            "period_high": max(c.high for c in candles), "period_low": min(c.low for c in candles),
            "rsi14": values[-1], "rsi_sma14": ma[-1], "rsi_thresholds": [70, 50, 30], "momentum": direction,
            "oversold_recovery_cross": crossed_up and min(values[-5:]) <= 30,
            "overbought_weakening_cross": crossed_down and max(values[-5:]) >= 70,
            "divergence": divergence, "atr14": threshold, "supply_demand": zones(candles, points),
            "fvg": gaps(candles, seconds), "liquidity": {"equal_extrema": [p for p in mapped if p["reactions"] >= 2], "sweep_reclaim": sweeps,
            "warning": "Potential liquidity, not evidence of resting orders"}, "trendline": trendline,
            "base_retest": base_retest(candles), "head_shoulders": head_shoulders(candles, points, threshold / 2),
            "timestamp": latest.timestamp.isoformat(), "bars": len(candles)}


def analyze(snapshot, seconds):
    frames = {**snapshot.other_timeframes, snapshot.timeframe: snapshot.candles}
    evidence, warnings = {}, []
    for frame, candles in frames.items():
        if frame not in ("4h", "1d", "1h", snapshot.timeframe):
            continue
        closed = [c for c in candles if c.timestamp + timedelta(seconds=seconds[frame]) <= snapshot.as_of]
        if len(closed) >= 51:
            evidence[frame] = frame_evidence(closed, seconds[frame])
        if len(closed) != len(candles):
            warnings.append(f"{frame}: unfinished candle excluded")
    missing = [frame for frame in ("4h", "1d", "1h", snapshot.timeframe) if frame not in evidence]
    if snapshot.timeframe not in ("15m", "30m"):
        warnings.append("Kaystrade execution requires M15/M30; selected timeframe is context only")
    warnings += [f"Required closed-bar frame unavailable: {frame}" for frame in missing]
    ratings = {item.timeframe: item for item in snapshot.technicals}
    for frame in ("4h", "1d"):
        if frame not in ratings:
            warnings.append(f"TradingView Technicals {frame} summary/MA/oscillators unverified")
    if not snapshot.macro:
        warnings.append("No timestamped macro/Fed context supplied")
    if not snapshot.news:
        warnings.append("No timestamped financial news supplied; no news blackout assumed")
    h4 = evidence.get("4h", {})
    bias = "BUY" if h4.get("structure") == "HH_HL" else "SELL" if h4.get("structure") == "LH_LL" else "NEUTRAL"
    execution = evidence.get(snapshot.timeframe, {})
    setup = execution.get("base_retest", {})
    confirmations = []
    h1 = evidence.get("1h", {})
    if bias != "NEUTRAL" and h1.get("structure") == h4.get("structure"):
        confirmations.append("H4/H1 confirmed structure")
    if setup.get("status") == "confirmed" and setup.get("direction") == bias:
        confirmations.append("Closed breakout, wick retest and rejection outside base")
    if execution.get("momentum") == ("bullish" if bias == "BUY" else "bearish") and bias != "NEUTRAL":
        confirmations.append("RSI14 relative to 50 and its SMA14")
    if execution.get("head_shoulders", {}).get("status") == "confirmed" and execution["head_shoulders"]["direction"] == bias:
        confirmations.append("Pattern with confirmed neckline price trigger")
    aligned = bias != "NEUTRAL" and all(frame in ratings and all(getattr(ratings[frame], name) == ("buy" if bias == "BUY" else "sell") for name in ("summary", "moving_averages", "oscillators")) for frame in ("4h", "1d"))
    if not aligned:
        warnings.append("D1/H4 Technicals are missing, neutral or conflict with H4 structure")
    signal = {"direction": "NO TRADE", "bias": bias, "status": "INSUFFICIENT DATA" if missing else "WAITING FOR CONFIRMATION",
              "entry": None, "stop_loss": None, "take_profit": None, "risk_reward": None,
              "analysis_horizon": snapshot.timeframe, "confirmations": confirmations,
              "invalidation_conditions": ["H4 structure changes", "Body closes back into the breakout base", "Recorded swing invalidation is breached"],
              "timestamp": snapshot.as_of.isoformat()}
    if not missing and snapshot.timeframe in ("15m", "30m") and aligned and h1.get("structure") == h4.get("structure") and len(confirmations) >= 3 and setup.get("status") == "confirmed" and setup.get("direction") == bias:
        closed = [c for c in frames[snapshot.timeframe] if c.timestamp + timedelta(seconds=seconds[snapshot.timeframe]) <= snapshot.as_of]
        entry = closed[-1].close
        swings = [p["price"] for p in execution["pivots"] if p["kind"] == ("low" if bias == "BUY" else "high")]
        tick = snapshot.price_tick
        if swings and tick is not None:
            stop = min(swings[-1], setup["low"]) - tick if bias == "BUY" else max(swings[-1], setup["high"]) + tick
            barriers, obstructed = [], False
            for frame in dict.fromkeys((snapshot.timeframe, "1h", "4h")):
                mapped = evidence[frame]
                prices = [p["price"] for p in mapped["pivots"] if p["kind"] == ("high" if bias == "BUY" else "low")]
                prices += [p["price"] for p in mapped.get("levels", []) if p["label"] in (("Resistance", "SBR") if bias == "BUY" else ("Support",))]
                for zone in mapped.get("supply_demand", []) + mapped.get("fvg", []):
                    if zone["status"] == "invalidated" or not zone["label"].startswith("Supply" if bias == "BUY" else "Demand"):
                        continue
                    obstructed |= zone["low"] <= entry <= zone["high"]
                    prices.append(zone["low"] if bias == "BUY" else zone["high"])
                barriers += [p for p in prices if p > entry] if bias == "BUY" else [p for p in prices if p < entry]
            if barriers and not obstructed and (stop < entry if bias == "BUY" else stop > entry):
                target = min(barriers) if bias == "BUY" else max(barriers)
                if stop > 0 and all(price % tick == 0 for price in (entry, stop, target)):
                    signal.update(direction=bias, status="CONDITIONAL SETUP", entry=entry, stop_loss=stop, take_profit=target,
                                  risk_reward=abs(target - entry) / abs(entry - stop))
        if signal["entry"] is None:
            warnings.append("No validated tick/swing/nearest target combination; trade levels withheld")
    dxy = snapshot.cross_market.get("DXY")
    closed_stamps = {c.timestamp for c in frames[snapshot.timeframe] if c.timestamp + timedelta(seconds=seconds[snapshot.timeframe]) <= snapshot.as_of}
    dxy_stamps = {timestamp(row.get("timestamp")) for row in (dxy or [])} & closed_stamps
    if snapshot.instrument in ("GOLD", "XAUUSD") and (len(dxy_stamps) < 31 or not closed_stamps or max(closed_stamps) not in dxy_stamps):
        warnings.append("Timestamp-aligned DXY context unavailable; no inverse relationship assumed")
    signal = MarketSignal.model_validate(signal).model_dump(mode="json")
    return wire({"methodology": VERSION, "signal": signal, "frames": evidence, "technicals": [r.model_dump(mode="json") for r in snapshot.technicals],
                 "scenarios": {"bullish": "Requires HH/HL H4, aligned H1, closed bullish breakout/retest and independent momentum confirmation",
                               "bearish": "Requires LH/LL H4, aligned H1, closed bearish breakout/retest and independent momentum confirmation",
                               "no_trade": "Consolidation, conflicting/unverified ratings, invalidated base or missing data"},
                 "warnings": warnings, "model_diagnostics": None,
                 "scope": "Deterministic closed-bar implementation; no RL, learned probabilities, automatic orders or backtest claim"})
