"""Explicit synthetic bars test rules, not provider availability or strategy profitability."""
import math
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

from pydantic import ValidationError

from services.pro_api.kaystrade import analyze, atr, base_retest, frame_evidence, gaps, head_shoulders, levels, pivots, rsi_series, structure, zones
from services.pro_api.market import Candle, Snapshot, TIMEFRAMES
from services.pro_api.models import MarketSignal

NOW = datetime(2026, 10, 10, 12, tzinfo=timezone.utc)


def bars(values, seconds=900):
    return [Candle(timestamp=NOW - timedelta(seconds=(len(values) - i) * seconds),
                   open=str(value), close=str(value), high=str(value + 1), low=str(value - 1)) for i, value in enumerate(values)]


def candle(index, opened, high, low, close, seconds=900):
    return Candle(timestamp=NOW - timedelta(seconds=(70 - index) * seconds), open=str(opened), high=str(high), low=str(low), close=str(close))


class Methodology(unittest.TestCase):
    def test_wilder_rsi_and_atr_and_sma(self):
        rising = bars(list(range(100, 160)))
        falling = bars(list(range(160, 100, -1)))
        self.assertEqual(rsi_series(rising)[-1], 100)
        self.assertEqual(rsi_series(falling)[-1], 0)
        self.assertEqual(rsi_series(bars([100] * 60))[-1], 50)
        self.assertEqual(atr(rising), 2)
        evidence = frame_evidence(rising, 900)
        self.assertEqual(evidence["rsi_sma14"], 100)
        self.assertEqual(evidence["momentum"], "neutral")  # RSI is not above its flat MA.
        self.assertEqual(evidence["rsi_thresholds"], [70, 50, 30])

    def test_confirmed_pivots_have_no_lookahead(self):
        source = bars([100, 101, 105, 102, 100, 101, 104])
        self.assertEqual(pivots(source[:4]), [])
        high = next(p for p in pivots(source[:5]) if p["kind"] == "high")
        self.assertEqual(high["index"], 2)
        self.assertEqual(high["confirmed_at"], source[4].timestamp.isoformat())
        self.assertEqual(pivots(bars([100] * 20)), [])
        pts = [{"kind": kind, "price": Decimal(value)} for kind, value in [("high", 110), ("low", 95), ("high", 120), ("low", 100)]]
        self.assertEqual(structure(pts), "HH_HL")
        self.assertEqual(structure([{**p, "price": -p["price"]} for p in pts]), "LH_LL")
        self.assertEqual(structure([]), "insufficient_swings")

    def test_support_merging_reactions_and_sbr(self):
        source = bars([101] * 15)
        source[-2] = source[-2].model_copy(update={"open": Decimal(99), "close": Decimal(98), "high": Decimal(100), "low": Decimal(97)})
        source[-1] = source[-1].model_copy(update={"open": Decimal(99), "close": Decimal(98), "high": Decimal(101), "low": Decimal(97)})
        pts = [{"kind": "low", "price": Decimal(value), "index": i, "confirmed_at": source[i + 2].timestamp.isoformat()} for i, value in [(2, "100"), (6, "100.05")]]
        result = levels(source, pts, Decimal("0.1"))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["reactions"], 2)
        self.assertEqual(result[0]["label"], "SBR")

    def test_supply_demand_requires_displacement_bos_and_freshness(self):
        source = bars([100] * 20)
        source.append(candle(20, 100, 101, 98, 99))
        source.append(candle(21, 100, 110, 99, 109))
        pts = [{"kind": "high", "index": 10, "price": Decimal(105)}]
        self.assertEqual(zones(source, pts)[0]["status"], "fresh")
        self.assertEqual(zones(source, []), [])
        already_broken = source[:20] + [candle(20, 115, 116, 112, 114), candle(21, 114, 124, 113, 123)]
        self.assertEqual(zones(already_broken, pts), [])
        source.append(candle(22, 103, 104, 100, 102))
        self.assertEqual(zones(source, pts)[0]["status"], "mitigated")
        source.append(candle(23, 99, 100, 96, 97))
        self.assertEqual(zones(source, pts)[0]["status"], "invalidated")

    def test_fvg_displacement_mitigation_and_session_gaps(self):
        source = bars([100] * 20)
        source += [candle(20, 100, 101, 99, 100), candle(21, 100, 108, 99, 107), candle(22, 107, 110, 106, 108)]
        found = gaps(source, 900)
        self.assertEqual(found[-1]["status"], "fresh")
        source.append(candle(23, 108, 109, 105, 107))
        self.assertEqual(gaps(source, 900)[-1]["status"], "mitigated")
        source.append(candle(24, 104, 105, 98, 99))
        self.assertEqual(gaps(source, 900)[-1]["status"], "invalidated")
        interrupted = source[:23]
        interrupted[-1] = interrupted[-1].model_copy(update={"timestamp": interrupted[-1].timestamp + timedelta(days=1)})
        self.assertEqual(gaps(interrupted, 900), [])

    def test_base_body_breakout_wick_retest_and_cancellation(self):
        source = bars([100] * 60)
        source += [candle(i, 100.5, 101, 100, 100.6) for i in range(60, 63)]
        source += [candle(63, 100.6, 105, 100.5, 104.5), candle(64, 103, 105, 100.9, 104)]
        result = base_retest(source)
        self.assertEqual(result["status"], "confirmed")
        self.assertEqual(result["direction"], "BUY")
        source[-1] = candle(64, 103, 104, 100, 100.8)
        self.assertEqual(base_retest(source)["status"], "invalidated")
        self.assertNotEqual(base_retest(source[:63])["status"], "confirmed")

    def test_neckline_break_required_for_head_shoulders(self):
        source = bars([100] * 20)
        pts = [{"kind": kind, "price": Decimal(price), "index": i} for i, kind, price in [(2, "high", 110), (5, "low", 100), (8, "high", 120), (11, "low", 100), (14, "high", 110)]]
        self.assertEqual(head_shoulders(source, pts, Decimal(1))["status"], "not_confirmed")
        source[-1] = source[-1].model_copy(update={"close": Decimal(99), "low": Decimal(98)})
        self.assertEqual(head_shoulders(source, pts, Decimal(1))["status"], "confirmed")
        inverse = [{**p, "kind": "low" if p["kind"] == "high" else "high", "price": 200 - p["price"]} for p in pts]
        source[-1] = source[-1].model_copy(update={"close": Decimal(101), "high": Decimal(102)})
        self.assertEqual(head_shoulders(source, inverse, Decimal(1))["direction"], "BUY")

    def test_period_high_trendline_liquidity_and_divergence_fields(self):
        source = bars([100 + i / 5 + math.sin(i) * 5 for i in range(80)])
        result = frame_evidence(source, 900)
        self.assertEqual(result["period_high"], max(c.high for c in source))
        self.assertIsNotNone(result["trendline"])
        self.assertEqual(result["trendline"]["status"], "context_only")
        self.assertIn("not evidence of resting orders", result["liquidity"]["warning"])
        self.assertIn(result["divergence"], ("none", "bullish_price_triggered", "bearish_price_triggered"))

    def snapshot(self):
        source = bars([100] * 60)
        return Snapshot(instrument="XAUUSD", timeframe="15m", provider="synthetic test only", license_reference="Not production prices",
                        as_of=NOW, valid_until=NOW + timedelta(hours=1), market_open=True, candles=source,
                        other_timeframes={f: bars([100] * 60, TIMEFRAMES[f]) for f in ("4h", "1h", "1d")}, price_tick="0.1")

    def test_missing_ratings_neutral_h4_and_unfinished_bar_never_trade(self):
        snap = self.snapshot()
        result = analyze(snap, TIMEFRAMES)
        self.assertEqual(result["signal"]["direction"], "NO TRADE")
        self.assertIsNone(result["signal"]["entry"])
        self.assertTrue(any("unverified" in item for item in result["warnings"]))
        snap.candles.append(snap.candles[-1].model_copy(update={"timestamp": NOW, "high": Decimal(200)}))
        self.assertEqual(analyze(snap, TIMEFRAMES)["frames"]["15m"]["period_high"], "101")

    def test_decision_requires_independent_confirmations_and_nearest_barrier(self):
        snap = self.snapshot()
        rating = {"summary": "buy", "moving_averages": "buy", "oscillators": "buy", "timestamp": NOW, "tradingview_symbol": "TVC:GOLD", "source_url": "https://www.tradingview.com/symbols/TVC-GOLD/technicals/"}
        snap = Snapshot.model_validate({**snap.model_dump(), "technicals": [{**rating, "timeframe": f} for f in ("4h", "1d")]})
        fixture = {"structure": "HH_HL", "momentum": "bullish", "pivots": [{"kind": "low", "price": Decimal(95)}, {"kind": "high", "price": Decimal(110)}, {"kind": "high", "price": Decimal(105)}],
                   "base_retest": {"status": "confirmed", "direction": "BUY", "low": Decimal(96)}, "head_shoulders": {"status": "not_confirmed"}}
        with patch("services.pro_api.kaystrade.frame_evidence", return_value=fixture):
            signal = analyze(snap, TIMEFRAMES)["signal"]
        self.assertEqual(signal["direction"], "BUY")
        self.assertEqual(signal["take_profit"], "105")
        self.assertEqual(signal["stop_loss"], "94.9")
        self.assertEqual(Decimal(signal["risk_reward"]), Decimal(5) / Decimal("5.1"))
        with patch("services.pro_api.kaystrade.frame_evidence", return_value={**fixture, "momentum": "neutral"}):
            self.assertEqual(analyze(snap, TIMEFRAMES)["signal"]["direction"], "NO TRADE")

        supply = {"label": "Supply", "low": Decimal(102), "high": Decimal(103), "status": "fresh"}
        with patch("services.pro_api.kaystrade.frame_evidence", return_value={**fixture, "supply_demand": [supply]}):
            self.assertEqual(analyze(snap, TIMEFRAMES)["signal"]["take_profit"], "102")
        with patch("services.pro_api.kaystrade.frame_evidence", return_value={**fixture, "supply_demand": [{**supply, "low": Decimal(99)}]}):
            self.assertEqual(analyze(snap, TIMEFRAMES)["signal"]["direction"], "NO TRADE")
        with patch("services.pro_api.kaystrade.frame_evidence", side_effect=lambda candles, seconds: {**fixture, "structure": "consolidation"} if seconds == 3600 else fixture):
            self.assertEqual(analyze(snap, TIMEFRAMES)["signal"]["direction"], "NO TRADE")

        opposite_base = {**fixture, "base_retest": {**fixture["base_retest"], "direction": "SELL"},
                         "head_shoulders": {"status": "confirmed", "direction": "BUY"}}
        with patch("services.pro_api.kaystrade.frame_evidence", return_value=opposite_base):
            self.assertEqual(analyze(snap, TIMEFRAMES)["signal"]["direction"], "NO TRADE")

    def test_dxy_requires_recent_timestamp_alignment(self):
        snap = self.snapshot()
        for points in ([{"timestamp": "1990-01-01T00:00:00Z", "close": "103"}],
                       [{"timestamp": c.timestamp.isoformat(), "close": "103"} for c in snap.candles[:-1]]):
            snap.cross_market["DXY"] = points
            self.assertTrue(any("DXY context unavailable" in warning for warning in analyze(snap, TIMEFRAMES)["warnings"]))
        snap.cross_market["DXY"] = [{"timestamp": c.timestamp.isoformat(), "close": "103"} for c in snap.candles]
        self.assertFalse(any("DXY context unavailable" in warning for warning in analyze(snap, TIMEFRAMES)["warnings"]))

    def test_sell_levels_choose_nearest_demand(self):
        snap = self.snapshot()
        rating = {"summary": "sell", "moving_averages": "sell", "oscillators": "sell", "timestamp": NOW, "tradingview_symbol": "TVC:GOLD", "source_url": "https://www.tradingview.com/symbols/TVC-GOLD/technicals/"}
        snap = Snapshot.model_validate({**snap.model_dump(), "technicals": [{**rating, "timeframe": f} for f in ("4h", "1d")]})
        fixture = {"structure": "LH_LL", "momentum": "bearish", "pivots": [{"kind": "high", "price": Decimal(105)}, {"kind": "low", "price": Decimal(90)}, {"kind": "low", "price": Decimal(95)}],
                   "base_retest": {"status": "confirmed", "direction": "SELL", "high": Decimal(104)}, "head_shoulders": {"status": "not_confirmed"},
                   "supply_demand": [{"label": "Demand", "low": Decimal(97), "high": Decimal(98), "status": "fresh"}]}
        with patch("services.pro_api.kaystrade.frame_evidence", return_value=fixture):
            signal = analyze(snap, TIMEFRAMES)["signal"]
        self.assertEqual((signal["direction"], signal["stop_loss"], signal["take_profit"]), ("SELL", "105.1", "98"))
        self.assertEqual(Decimal(signal["risk_reward"]), Decimal(2) / Decimal("5.1"))

    def test_divergence_needs_price_trigger(self):
        source = bars([102] * 60)
        for index, value in ((30, 100), (40, 95)):
            source[index] = source[index].model_copy(update={"open": Decimal(value), "close": Decimal(value), "low": Decimal(value - 1), "high": Decimal(value + 1)})
        oscillator = [None] * 14 + [Decimal(50)] * 46
        oscillator[30], oscillator[40] = Decimal(20), Decimal(30)
        with patch("services.pro_api.kaystrade.rsi_series", return_value=oscillator):
            self.assertEqual(frame_evidence(source, 900)["divergence"], "bullish_price_triggered")
            source[-1] = source[-1].model_copy(update={"open": Decimal(96), "close": Decimal(96), "low": Decimal(95), "high": Decimal(97)})
            self.assertEqual(frame_evidence(source, 900)["divergence"], "none")

    def test_signal_schema_rejects_fabricated_levels_or_rr(self):
        no_trade = {"direction": "NO TRADE", "bias": "NEUTRAL", "status": "WAITING FOR CONFIRMATION", "analysis_horizon": "15m", "confirmations": [], "invalidation_conditions": [], "timestamp": NOW}
        MarketSignal.model_validate(no_trade)
        with self.assertRaises(ValidationError):
            MarketSignal.model_validate({**no_trade, "entry": "100"})
        with self.assertRaises(ValidationError):
            MarketSignal.model_validate({**no_trade, "direction": "BUY", "status": "CONDITIONAL SETUP", "entry": 100, "stop_loss": 90, "take_profit": 120, "risk_reward": 9, "confirmations": ["a", "b", "c"]})


if __name__ == "__main__":
    unittest.main()
