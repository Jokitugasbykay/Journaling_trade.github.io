"""Deterministic engine and API contract tests; upstream HTTP is simulated explicitly."""
import json
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from pypdf import PdfReader

from services.pro_api.ai import validate_explanation
from services.pro_api.analytics import heatmap, open_exposure, overview, position_size, realized, records
from services.pro_api.app import create_app
from services.pro_api.market import load_market
from services.pro_api.models import ImportTrade, RiskRule
from services.pro_api.reports import generate_pdf
from services.pro_api.store import Settings
from services.pro_api.worker import period_bounds
from services.pro_api.models import Review

UID = "b0b10000-0000-4000-a000-000000000001"
ACCOUNT = "b0b10000-0000-4000-a000-000000000011"
JOB = "b0b10000-0000-4000-a000-000000000021"
ACCOUNTS = [{"id": ACCOUNT, "currency": "USD", "initial_balance": "1000"}]
TRADES = [{"id": str(uuid4()), "account_id": ACCOUNT, "symbol": "EURUSD", "side": "long", "status": "closed",
           "opened_at": f"2026-10-0{index+1}T23:30:00Z", "pnl": pnl,
           "entry_price": "100", "stop_loss": "90", "take_profit": "120"}
          for index, pnl in enumerate(("100", "-50", "0"))]


class Engines(unittest.TestCase):
    def test_exact_metrics_timezone_and_heatmap(self):
        rows, warnings = records(TRADES, ACCOUNTS, tz="Asia/Jakarta")
        result = overview(rows, Decimal(1000))
        self.assertEqual(Decimal(result["metrics"]["expectancy"]), Decimal(50) / 3)
        self.assertEqual(result["metrics"]["profit_factor"], "2")
        self.assertEqual(result["metrics"]["maximum_drawdown"], "50")
        self.assertEqual(result["metrics"]["average_risk_reward"], "2")
        self.assertEqual(rows[0]["date"], date(2026, 10, 2))
        days = {item["date"]: item for item in heatmap(rows, 2026)["days"]}
        self.assertEqual(days["2026-10-01"]["state"], "no_activity")
        self.assertEqual(days["2026-10-04"]["state"], "zero")
        self.assertEqual(days["2026-10-02"]["trade_ids"], [TRADES[0]["id"]])
        self.assertIsNone(overview([])["metrics"]["expectancy"])
        dst = [{**TRADES[0], "opened_at": "2026-11-01T05:30:00Z"}, {**TRADES[1], "opened_at": "2026-11-01T06:30:00Z"}]
        local, _ = records(dst, ACCOUNTS, tz="America/New_York")
        self.assertEqual([row["hour"] for row in local], [1, 1])

    def test_fees_partial_exits_and_explicit_contracts(self):
        self.assertEqual(realized({"pnl": "10", "fees": "2"}, []), Decimal(10))
        self.assertEqual(realized({"pnl": "10", "fees": "2", "pnl_is_net": False}, []), Decimal(8))
        self.assertIsNone(realized({"entry_price": "10", "exit_price": "12"}, []))
        trade = {"side": "long", "contract_size": "1", "fx_rate": "1", "fees": "0"}
        executions = [{"side": side, "quantity": qty, "price": price, "commission": "0", "executed_at": f"2026-10-01T0{i}:00:00Z"}
                      for i, (side, qty, price) in enumerate((("open", "2", "100"), ("close", "1", "110"), ("close", "1", "105")))]
        self.assertEqual(realized(trade, executions), Decimal(15))
        executions[-1]["quantity"] = "2"
        with self.assertRaises(ValueError): realized(trade, executions)
        sized = position_size("10000", "1", "100", "90", "1", "1", "1")
        self.assertEqual(sized["quantity"], "10")
        with self.assertRaises(ValueError): position_size("100", "1", "10", "10", "1", "1", "1")

    def test_pdf_is_real_and_untrusted_text_is_escaped(self):
        rows, _ = records(TRADES, ACCOUNTS)
        pdf = generate_pdf({"period": "<script>notes</script>", "analytics": overview(rows, Decimal(1000))})
        self.assertTrue(pdf.startswith(b"%PDF-"))
        reader = PdfReader(BytesIO(pdf))
        text = "".join(page.extract_text() for page in reader.pages)
        self.assertIn("Performance Analytics", text)
        self.assertIn("Profit Factor", text)

    def test_ai_evidence_and_validation(self):
        output = {"observations": [{"text": "One recorded trade.", "evidence_ids": ["t1"]}]}
        self.assertEqual(validate_explanation(output, ["t1"])["observations"][0]["text"], "One recorded trade.")
        with self.assertRaises(ValueError): validate_explanation(output, ["other-user"])
        for claim in ("confidence: 90%", "90% confidence", "confidence of 90%", "entry at $100", "stop loss is 90", "clinical depression"):
            output["observations"][0]["text"] = claim
            with self.subTest(claim=claim), self.assertRaises(ValueError): validate_explanation(output, ["t1"])
        with self.assertRaises(ValidationError): RiskRule(name="x", kind="max_trades_per_day", threshold="1.5")
        with self.assertRaises(ValidationError): ImportTrade(account_id=ACCOUNT, symbol="x", side="long", opened_at="2026-10-01T12:00:00", pnl="1")
        start, end, _, _ = period_bounds(Review(period="monthly", start="2024-02-20"))
        self.assertEqual((start, end), (date(2024, 2, 1), date(2024, 2, 29)))
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(HTTPException) as error: load_market(Settings(market_root=Path(directory)), "XAUUSD", "1h")
            self.assertEqual(error.exception.status_code, 503)

    def test_open_exposure_requires_actual_specs(self):
        now = datetime(2026, 10, 10, 12, tzinfo=timezone.utc)
        position = {"status": "open", "opened_at": now.isoformat(), "entry_price": "100", "stop_loss": "90",
                    "quantity": "2", "contract_size": "1", "fx_rate": "1"}
        self.assertEqual(open_exposure([position], now=now)["daily_exposure"], "20")
        position.pop("fx_rate")
        result = open_exposure([position], now=now)
        self.assertIsNone(result["open_exposure"])
        self.assertEqual(result["unknown_positions"], 1)

    def test_market_snapshot_freshness_and_source_evidence(self):
        now = datetime(2026, 10, 10, 12, tzinfo=timezone.utc)
        candles = [{"timestamp": (now - timedelta(hours=50-index)).isoformat(), "open": str(100+index),
                    "close": str(100+index), "high": str(101+index), "low": str(99+index), "volume": "10"} for index in range(51)]
        snapshot = {"instrument": "XAUUSD", "timeframe": "1h", "provider": "explicit test fixture",
                    "license_reference": "test-only synthetic bars; never published", "as_of": now.isoformat(),
                    "valid_until": (now+timedelta(hours=1)).isoformat(), "market_open": True, "candles": candles}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / "manifest.json").write_text(json.dumps({"instruments": {"XAUUSD": {"tradingview_symbol": "OANDA:XAUUSD"}}}))
            path = root / "XAUUSD_1h.json"
            path.write_text(json.dumps(snapshot))
            result = load_market(Settings(market_root=root), "XAUUSD", "1h", now=now)
            self.assertEqual(result["data_freshness"], "fresh")
            self.assertEqual(result["statistical_forecast"]["status"], "insufficient_data")
            snapshot["macro"] = [{"timestamp": (now+timedelta(hours=1)).isoformat(), "source_url": "https://source.invalid/test"}]
            path.write_text(json.dumps(snapshot))
            with self.assertRaises(HTTPException) as invalid: load_market(Settings(market_root=root), "XAUUSD", "1h", now=now)
            self.assertEqual(invalid.exception.status_code, 503)
            snapshot["macro"] = []
            for candle in candles:
                candle["timestamp"] = (datetime.fromisoformat(candle["timestamp"]) - timedelta(hours=3)).isoformat()
            path.write_text(json.dumps(snapshot))
            with self.assertRaises(HTTPException) as stale: load_market(Settings(market_root=root), "XAUUSD", "1h", now=now)
            self.assertEqual(stale.exception.status_code, 409)
        explanation = {"market_outcome": "No Trade", "observations": [{"text": "Evidence is incomplete.", "evidence_ids": ["technical"]}]}
        self.assertEqual(validate_explanation(explanation, ["technical"], market=True)["market_outcome"], "No Trade")


class ApiContracts(unittest.TestCase):
    def setUp(self):
        self.plan, self.expired, self.job_calls, self.uploads = "pro", False, 0, 0
        self.directory = tempfile.TemporaryDirectory()
        root = Path(self.directory.name)
        (root / "regional-sources.json").write_text(json.dumps({"ID": [{"id": "id"}], "US": [{"id": "us"}]}))
        (root / "services/pro_api").mkdir(parents=True)
        (root / "services/pro_api/regions.json").write_text(json.dumps({"Asia": ["ID"], "North America": ["US"]}))
        (root / "berita.json").write_text(json.dumps({"sources": [], "items": [
            {"source": "id", "title": "Indonesia", "url": "https://publisher.invalid/id", "publishedAt": "2026-10-01T00:00:00Z", "topics": ["International"]},
            {"source": "us", "title": "USA", "url": "https://publisher.invalid/us", "publishedAt": "2026-10-01T00:00:00Z", "topics": ["International"]}]}))
        self.app = create_app(Settings(publishable_key="public-test-key", data_root=root), httpx.MockTransport(self.upstream))
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.headers = {"Authorization": "Bearer verified-fixture", "Idempotency-Key": str(uuid4())}

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.directory.cleanup()

    def upstream(self, request):
        path = request.url.path
        if path == "/auth/v1/user":
            if request.headers.get("authorization") != "Bearer verified-fixture": return httpx.Response(401, json={"code": "invalid"})
            return httpx.Response(200, json={"id": UID})
        if path.endswith("journal_rate_limit"): return httpx.Response(200, json=True)
        if path.endswith("journal_entitlements"):
            end = datetime.now(timezone.utc) + timedelta(days=-1 if self.expired else 1)
            return httpx.Response(200, json={"plan": self.plan, "countries": ["ID"], "effectiveUntil": end.isoformat(), "aiRemaining": 30})
        if path.startswith("/rest/v1/rpc/journal_create_job"):
            self.job_calls += 1
            return httpx.Response(200, json={"id": JOB, "kind": json.loads(request.content)["p_kind"], "status": "queued"})
        if path.endswith("journal_job"): return httpx.Response(200, json=None)
        if path.startswith("/rest/v1/"):
            self.assertEqual(request.url.params.get("user_id"), f"eq.{UID}")
            table = path.rsplit("/", 1)[-1]
            return httpx.Response(200, json=ACCOUNTS if table == "trading_accounts" else TRADES if table == "trades" else [])
        if path.startswith("/storage/v1/object/authenticated/"): return httpx.Response(200)
        if path.startswith("/storage/v1/object/journal-imports/"):
            self.assertEqual(request.headers["x-upsert"], "false")
            self.uploads += 1
            return httpx.Response(200 if self.uploads == 1 else 409, json={} if self.uploads == 1 else {"code": "Duplicate"})
        raise AssertionError("Unexpected upstream operation: " + path)

    def test_authentication_entitlements_and_cross_owner_filters(self):
        self.assertEqual(self.client.get("/api/v1/analytics/overview").status_code, 401)
        self.assertEqual(self.client.get("/api/v1/analytics/overview", headers={"Authorization": "Bearer invalid"}).status_code, 403)
        for plan in ("free", "plus"):
            self.plan = plan
            self.assertEqual(self.client.get("/api/v1/analytics/overview", headers=self.headers).status_code, 403)
        self.plan, self.expired = "pro", True
        self.assertEqual(self.client.get("/api/v1/analytics/overview", headers=self.headers).status_code, 403)
        self.expired = False
        result = self.client.get("/api/v1/analytics/overview", headers=self.headers)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["metrics"]["net_pnl"], "50")
        other = self.client.get("/api/v1/analytics/overview?account_id=" + str(uuid4()), headers=self.headers)
        self.assertEqual(other.status_code, 404)
        for endpoint in ("/analytics/heatmap?year=2026", "/analytics/strategies?strategy_ids=", "/reviews?period=weekly", "/analytics/risk"):
            response = self.client.get("/api/v1" + endpoint, headers=self.headers)
            self.assertEqual(response.status_code, 200, response.text)

    def test_ai_unavailable_does_not_reserve_and_pdf_queues(self):
        result = self.client.post("/api/v1/ai/journal-analysis", headers=self.headers, json={})
        self.assertEqual(result.status_code, 503)
        self.assertEqual(self.job_calls, 0)
        result = self.client.post("/api/v1/reports", headers=self.headers, json={"sections": ["analytics"]})
        self.assertEqual(result.status_code, 202, result.text)
        self.assertEqual(self.job_calls, 1)
        self.assertEqual(self.client.get(f"/api/v1/reports/{JOB}/download", headers=self.headers).status_code, 404)

    def test_plus_international_cannot_bypass_country_limit(self):
        self.plan = "plus"
        response = self.client.get("/api/v1/news?category=International", headers=self.headers)
        self.assertEqual([row["title"] for row in response.json()["items"]], ["Indonesia"])
        self.assertEqual(self.client.get("/api/v1/news?country=US", headers=self.headers).status_code, 403)
        catalog = self.client.get("/api/v1/news/filters", headers=self.headers).json()
        self.assertEqual(catalog["countries"], ["ID"])
        self.assertEqual(catalog["regions"], ["Asia"])
        self.plan = "pro"
        self.assertEqual(len(self.client.get("/api/v1/news", headers=self.headers).json()["items"]), 2)

    def test_private_upload_retry_and_chunked_size_limit(self):
        headers = {**self.headers, "Content-Type": "text/csv"}
        first = self.client.post("/api/v1/imports/files", headers=headers, content=b"symbol,side\nEURUSD,long")
        second = self.client.post("/api/v1/imports/files", headers=headers, content=b"symbol,side\nEURUSD,long")
        self.assertEqual(first.status_code, 201, first.text)
        self.assertEqual(first.json(), second.json())
        self.assertTrue(first.json()["storage_path"].startswith(UID + "/"))
        oversized = self.client.post("/api/v1/reports", headers=self.headers, content=iter([b"x" * 1_100_000, b"x" * 1_100_000]))
        self.assertEqual(oversized.status_code, 413)


if __name__ == "__main__":
    unittest.main()
