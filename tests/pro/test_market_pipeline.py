"""Synthetic worker transport contracts; no provider, model or live SQL proof."""
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from services.pro_api.market import TIMEFRAMES
from services.pro_api.models import MarketSignal
from services.pro_api.store import Settings, Store
from services.pro_api.worker import process_job, run_job
from services.pro_api.signals import monitor_once


class MarketPipeline(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name).resolve()
        now = datetime.now(timezone.utc)

        def bars(frame):
            return [{"timestamp": (now - timedelta(seconds=TIMEFRAMES[frame] * (51 - index))).isoformat(),
                     "open": "100", "close": "100", "high": "101", "low": "99", "volume": "10"}
                    for index in range(51)]

        def source(group):
            return [{"title": "Synthetic " + group, "timestamp": now.isoformat(),
                     "source_url": "https://fixture.invalid/" + group}]
        snapshot = {
            "instrument": "XAUUSD", "timeframe": "15m", "provider": "Synthetic transport fixture",
            "license_reference": "Test bars only; never served as market prices", "as_of": now.isoformat(),
            "valid_until": (now + timedelta(hours=1)).isoformat(), "market_open": True, "price_tick": "0.1",
            "candles": bars("15m"), "other_timeframes": {frame: bars(frame) for frame in ("1h", "4h", "1d")},
            "technicals": [{"timeframe": frame, "summary": "buy", "moving_averages": "buy", "oscillators": "buy",
                            "timestamp": now.isoformat(), "tradingview_symbol": "TVC:GOLD",
                            "source_url": "https://www.tradingview.com/symbols/TVC-GOLD/technicals/"}
                           for frame in ("4h", "1d")],
            "macro": source("macro"), "news": source("news"), "geopolitics": source("geopolitics"),
            "cross_market": {"DXY": [{"timestamp": bar["timestamp"], "close": "101"} for bar in bars("15m")]},
        }
        (root / "manifest.json").write_text(json.dumps({"instruments": {
            "XAUUSD": {"tradingview_symbol": "TVC:GOLD", "timeframes": ["15m"]}}}), encoding="utf-8")
        (root / "XAUUSD_15m.json").write_text(json.dumps(snapshot), encoding="utf-8")
        benchmark = root / "benchmark.json"
        benchmark.write_text(json.dumps({"model": "fixture-local-model", "digest": "d" * 64,
                                         "validated_runs": 3, "max_seconds": 1}), encoding="utf-8")
        self.settings = Settings(publishable_key="fixture-public-key", service_key="fixture-service-key",
                                 market_root=root, ollama_model="fixture-local-model", model_digest="d" * 64,
                                 model_license="Synthetic model metadata fixture", model_benchmark=benchmark,
                                 ai_timeout=10)
        self.job = {"id": "b0b10000-0000-4000-a000-000000000021", "worker_id": "fixture-worker",
                    "user_id": "b0b10000-0000-4000-a000-000000000001", "kind": "market",
                    "payload": {"instrument": "XAUUSD", "timeframe": "15m", "trading_style": "INTRADAY"}}
        self.output = {"market_outcome": "Bullish", "observations": [{
            "text": "Data sintetis belum menunjukkan struktur terkonfirmasi.",
            "evidence_ids": ["kaystrade", "macro-0", "news-0", "geopolitics-0", "correlation-DXY"]}]}
        self.chat_requests, self.finishes, self.runtime_timeout = [], [], False
        self.monitored=[]
        self.signal={"id":self.job['id'],"user_id":self.job['user_id'],"job_id":self.job['id'],"direction":"BUY","instrument":"XAUUSD","timeframe":"15m","trading_style":"INTRADAY",
                     "entry":"100","stop_loss":"90","take_profit":"120","risk_reward":"2","status":"active","action":"watch","mode":None,"execution_confirmed":False,"executed_at":None,
                     "analyzed_at":(now-timedelta(hours=1)).isoformat(),"created_at":(now-timedelta(hours=1)).isoformat(),"expires_at":(now+timedelta(hours=1)).isoformat()}
        self.client = httpx.AsyncClient(transport=httpx.MockTransport(self.upstream))
        self.addAsyncCleanup(self.client.aclose)
        self.store = Store(self.client, self.settings, "fixture-service-token", privileged=True)

    def upstream(self, request):
        if request.url.path=='/rest/v1/market_signals':return httpx.Response(200,json=[self.signal])
        if request.url.path=='/rest/v1/signal_alerts':return httpx.Response(200,json=[{'id':self.job['id'],'kind':'entry_watch','enabled':True,'trigger_price':'100','triggered_at':None}])
        if request.url.path=='/rest/v1/rpc/journal_monitor_signal':
            self.monitored.append(json.loads(request.content));return httpx.Response(200,json=self.signal)
        if request.url.path == "/rest/v1/rpc/journal_user_access":
            self.assertEqual(json.loads(request.content), {"p_user_id": self.job["user_id"]})
            return httpx.Response(200, json={"plan": "pro", "aiRemaining": 30})
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": [{"name": self.settings.ollama_model,
                                                        "digest": self.settings.model_digest}]})
        if request.url.path == "/api/chat":
            self.chat_requests.append(json.loads(request.content))
            if self.runtime_timeout:
                raise httpx.ReadTimeout("Synthetic local runtime timeout", request=request)
            return httpx.Response(200, json={"message": {"content": json.dumps(self.output)}})
        if request.url.path == "/rest/v1/rpc/journal_finish_job":
            self.finishes.append(json.loads(request.content))
            return httpx.Response(200, json={"status": "failed" if self.finishes[-1]["p_error"] else "succeeded"})
        raise AssertionError("Unexpected fixture HTTP operation: " + str(request.url))

    def assert_market_result(self, result):
        signal = MarketSignal.model_validate(result["signal"])
        self.assertEqual(signal.direction, "NO TRADE")
        self.assertEqual(signal.status, "INSUFFICIENT DATA")
        self.assertIsNone(signal.entry)
        self.assertEqual(result["market_outcome"], "Insufficient Data")
        self.assertEqual(result["model_version"], {"name": self.settings.ollama_model,
                                                 "digest": self.settings.model_digest,
                                                 "license": self.settings.model_license,
                                                 "methodology": "kaystrade-closed-bars-v2",
                                                 "synthesis": "kaystrade-fundamental-synthesis-v1"})
        self.assertEqual(result["analysis_horizon"], "15m")
        self.assertIsNotNone(datetime.fromisoformat(result["generated_at"]).tzinfo)
        context = result["quantitative"]["market"]
        self.assertEqual(context["technical"]["rsi14"], "50")
        self.assertEqual(set(context["kaystrade"]["frames"]), {"15m", "1h", "4h", "1d"})
        prompt = json.loads(self.chat_requests[-1]["messages"][1]["content"])
        self.assertEqual(set(prompt["evidence_ids"]), {"technical", "multi_timeframe", "statistical_baseline",
                                                      "kaystrade", "macro-0", "news-0", "geopolitics-0", "correlation-DXY"})
        self.assertEqual(prompt["evidence"]["market"], context)
        for group in ("macro", "news", "geopolitics"):
            self.assertEqual(context[group][0]["evidence_id"], group + "-0")
            self.assertTrue(context[group][0]["source_url"].startswith("https://fixture.invalid/"))

    async def test_process_job_uses_rule_signal_and_source_evidence(self):
        self.assert_market_result(await process_job(self.store, self.settings, self.job))
        self.assertEqual(self.finishes, [])

    async def test_run_job_sends_validated_result_to_finish_transaction(self):
        await run_job(self.store, self.settings, self.job)
        self.assertEqual(len(self.finishes), 1)
        finish = self.finishes[0]
        self.assertEqual(finish["p_job_id"], self.job["id"])
        self.assertEqual(finish["p_worker_id"], self.job["worker_id"])
        self.assertIsNone(finish["p_error"])
        self.assert_market_result(finish["p_result"])

    async def test_fabricated_indonesian_levels_finish_without_success_payload(self):
        self.output["observations"][0]["text"] = "Harga masuk adalah 2300, batas kerugian 2290, sasaran keuntungan 2320."
        await run_job(self.store, self.settings, self.job)
        self.assert_failed_finish()

    async def test_runtime_timeout_finishes_without_success_payload(self):
        self.runtime_timeout = True
        await run_job(self.store, self.settings, self.job)
        self.assert_failed_finish()

    async def test_background_monitor_reads_validated_feed_without_browser_or_ai(self):
        await monitor_once(self.store,self.settings)
        self.assertEqual(len(self.monitored),1)
        self.assertEqual(self.monitored[0]['p_result']['events'][0]['kind'],'entry_watch')
        self.assertIsNone(self.monitored[0]['p_result']['outcome'])
        self.assertEqual(self.chat_requests,[])
        self.assertEqual(self.finishes,[])

    def assert_failed_finish(self):
        self.assertEqual(len(self.chat_requests), 1)
        self.assertEqual(len(self.finishes), 1)
        self.assertEqual(self.finishes[0]["p_job_id"], self.job["id"])
        self.assertEqual(self.finishes[0]["p_worker_id"], self.job["worker_id"])
        self.assertIsNone(self.finishes[0]["p_result"])
        self.assertTrue(self.finishes[0]["p_error"])


if __name__ == "__main__":
    unittest.main()
