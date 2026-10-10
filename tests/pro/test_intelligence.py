"""Synthetic evidence checks, never a claim about market accuracy or live delivery."""
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from pydantic import ValidationError

from services.pro_api.intelligence import FundamentalEvent, fundamentals, synthesize
from services.pro_api.market import Candle
from services.pro_api.signals import performance, price_events

NOW = datetime(2026, 10, 10, 12, tzinfo=timezone.utc)


def event(**changes):
    return {"event_id": "fixture-event", "title": "Synthetic event", "category": "monetary policy", "region": "US",
            "source_url": "https://fixture.invalid/evidence", "published_at": NOW - timedelta(minutes=5),
            "event_at": NOW - timedelta(minutes=5), "valid_until": NOW + timedelta(minutes=5),
            "verification": "confirmed", "affected_instruments": ["XAUUSD"], "relevance": "high", "severity": "medium",
            "mechanism": "Synthetic sourced mechanism, not real market news", "evidence": ["Synthetic observation"],
            "bias": "bullish", **changes}


def technical():
    return {"signal": {"direction": "BUY", "bias": "BUY", "status": "CONDITIONAL SETUP", "entry": "100", "stop_loss": "90",
                       "take_profit": "120", "risk_reward": "2", "confirmations": ["structure", "location", "momentum"],
                       "invalidation_conditions": ["Closed structural invalidation"], "timestamp": NOW.isoformat()},
            "scenarios": {"bullish": "Confirmed bullish structure", "bearish": "Confirmed bearish structure"}}


class Intelligence(unittest.TestCase):
    def test_sourced_events_reject_bad_times_and_urls(self):
        for change in ({"source_url": "http://fixture.invalid"}, {"published_at": NOW.replace(tzinfo=None)}, {"valid_until": NOW - timedelta(days=1)}):
            with self.assertRaises(ValidationError):
                FundamentalEvent.model_validate(event(**change))

    def test_stale_rumor_future_unrelated_and_duplicate_events(self):
        rows = [event(), event(), event(event_id="stale", valid_until=NOW - timedelta(minutes=1)),
                event(event_id="rumor", verification="rumor"), event(event_id="future", published_at=NOW + timedelta(minutes=1)),
                event(event_id="other", affected_instruments=["EURUSD"])]
        result = fundamentals(rows, "XAUUSD", NOW)
        self.assertEqual(len(result["events"]), 1)
        self.assertEqual(len(result["excluded"]), 3)

    def test_conflict_missing_style_and_event_risk_withhold_entry(self):
        for events, style in (([event(bias="bearish")], "INTRADAY"), ([], "SCALPING"), ([event()], None),
                              ([event(severity="high", event_at=NOW + timedelta(minutes=1))], "INTRADAY")):
            result = synthesize(technical(), events, "XAUUSD", style, NOW)
            self.assertEqual(result["signal"]["direction"], "NO TRADE")
            self.assertIsNone(result["signal"]["entry"])
            self.assertEqual(len(result["scenarios"]), 2)
            self.assertTrue(all(row["probability"] is None and row["probability_status"] == "Not calibrated" for row in result["scenarios"]))

    def test_aligned_scenario_preserves_deterministic_levels(self):
        result = synthesize(technical(), [event()], "XAUUSD", "INTRADAY", NOW)
        self.assertEqual(result["comparison"]["agreement"], "ALIGNED")
        self.assertEqual(result["signal"]["entry"], "100")
        self.assertEqual(result["scenarios"][0]["setup_status"], "CONFIRMED")
        self.assertIsNone(result["scenarios"][1]["entry"])
        self.assertIsNone(result["scenarios"][0]["take_profit_2"])

    def test_watch_levels_do_not_authorize_conflicting_trade(self):
        result = synthesize(technical(), [event(bias="bearish")], "XAUUSD", "SCALPING", NOW)
        self.assertEqual(result["comparison"]["agreement"], "CONFLICTING")
        self.assertEqual(result["scenarios"][0]["setup_status"], "AWAITING CONFIRMATION")
        self.assertEqual(result["scenarios"][0]["entry"], "100")

    def test_material_revision_and_contradictory_events(self):
        newer=event(published_at=NOW-timedelta(minutes=1),bias='bearish')
        self.assertEqual(fundamentals([event(),newer],'XAUUSD',NOW)['bias'],'bearish')
        self.assertEqual(fundamentals([event(),event(event_id='second',bias='bearish')],'XAUUSD',NOW)['bias'],'conflicting')


def signal(**changes):
    return {"created_at": (NOW - timedelta(hours=1)).isoformat(), "analyzed_at": (NOW - timedelta(hours=1)).isoformat(),
            "expires_at": (NOW + timedelta(hours=1)).isoformat(), "executed_at": (NOW - timedelta(minutes=30)).isoformat(),
            "execution_confirmed": True, "entry": "100", "stop_loss": "90", "take_profit": "120", "risk_reward": "2",
            "direction": "BUY", "mode": "paper", "timeframe": "15m", "status": "active", "outcome": None,
            "accepted_at": (NOW - timedelta(minutes=31)).isoformat(), "action": "take", "instrument": "XAUUSD",
            "trading_style": "INTRADAY", "model_version": {"digest": "synthetic-test"}, **changes}


class SignalTracking(unittest.TestCase):
    def test_touch_is_not_fill_and_same_bar_outcome_is_ambiguous(self):
        alerts = [{"id": kind, "kind": kind, "enabled": True, "triggered_at": None, "trigger_price": "100"}
                  for kind in ("entry_watch", "stop_loss", "take_profit_1")]
        bar = Candle(timestamp=NOW - timedelta(minutes=15), open=100, high=125, low=85, close=100)
        watch = price_events(signal(execution_confirmed=False, executed_at=None, action="watch"), alerts, [bar], NOW)
        self.assertEqual([row["kind"] for row in watch["events"]], ["entry_watch"])
        self.assertIsNone(watch["outcome"])
        result = price_events(signal(), alerts, [bar], NOW)
        self.assertEqual(result["outcome"], "AMBIGUOUS")
        actual = price_events(signal(mode="actual"), alerts, [bar], NOW)
        self.assertIsNone(actual["outcome"])

    def test_expiry_without_feed_and_pre_execution_bar_ambiguity(self):
        alerts = [{"id": "expiry", "kind": "expired", "enabled": True, "triggered_at": None}]
        result = price_events(signal(execution_confirmed=False, executed_at=None, expires_at=(NOW-timedelta(seconds=1)).isoformat()), alerts, [], NOW)
        self.assertEqual(result["status"], "expired")
        bar = Candle(timestamp=NOW-timedelta(minutes=15), open=100, high=121, low=95, close=110)
        result = price_events(signal(executed_at=(NOW-timedelta(minutes=10)).isoformat()), [], [bar], NOW)
        self.assertEqual(result["outcome"], "AMBIGUOUS")

    def test_statistics_separate_actual_paper_watch_open_ambiguous_breakeven(self):
        rows = [signal(outcome="win"), signal(outcome="loss"), signal(outcome="breakeven"), signal(outcome="AMBIGUOUS"),
                signal(), signal(mode="actual", outcome="win"), signal(action="watch", accepted_at=None, execution_confirmed=False)]
        result = performance(rows)
        self.assertEqual(result["total_accepted_signals"], 6)
        self.assertEqual(result["categories"]["paper"]["winrate"], .5)
        self.assertEqual(result["categories"]["paper"]["breakeven"], 1)
        self.assertIsNone(result["categories"]["actual"]["winrate"])
        self.assertIsNone(result["categories"]["actual"]["realized_pnl"])

    def test_entry_confirmation_and_new_fundamental_invalidation(self):
        alerts=[{'id':kind,'kind':kind,'enabled':True,'triggered_at':None} for kind in ('entry_confirmed','fundamental','invalidated')]
        context=synthesize(technical(),[event()],'XAUUSD','INTRADAY',NOW)
        saved=signal(execution_confirmed=False,executed_at=None,fundamental_events=context['fundamental']['events'])
        result=price_events(saved,alerts,[],NOW,context)
        self.assertEqual([row['kind'] for row in result['events']],['entry_confirmed'])
        context=synthesize(technical(),[event(severity='high')],'XAUUSD','INTRADAY',NOW)
        result=price_events(saved,alerts,[],NOW,context)
        self.assertEqual(result['status'],'invalidated')
        self.assertNotIn('entry_confirmed',[row['kind'] for row in result['events']])

    def test_intraday_limit_does_not_claim_late_target_win(self):
        bar=Candle(timestamp=NOW-timedelta(minutes=15),open=100,high=121,low=99,close=110)
        result=price_events(signal(executed_at=(NOW-timedelta(hours=25)).isoformat()),[],[bar],NOW)
        self.assertEqual(result['outcome'],'AMBIGUOUS')

    def test_missing_bar_cannot_be_reported_as_a_target_win(self):
        bar=Candle(timestamp=NOW-timedelta(minutes=15),open=100,high=121,low=99,close=110)
        result=price_events(signal(executed_at=(NOW-timedelta(hours=1)).isoformat()),[],[bar],NOW)
        self.assertEqual(result['outcome'],'AMBIGUOUS')

    def test_durable_cursor_preserves_previously_verified_coverage(self):
        bar=Candle(timestamp=NOW-timedelta(minutes=15),open=100,high=121,low=99,close=110)
        saved=signal(executed_at=(NOW-timedelta(hours=1)).isoformat(),monitored_through=(NOW-timedelta(minutes=15)).isoformat(),coverage_complete=True)
        result=price_events(saved,[],[bar],NOW)
        self.assertEqual(result['outcome'],'win')
        saved['coverage_complete']=False
        self.assertEqual(price_events(saved,[],[bar],NOW)['outcome'],'AMBIGUOUS')


if __name__ == "__main__":
    unittest.main()
