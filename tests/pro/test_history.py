import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi import HTTPException
from fastapi.testclient import TestClient
from services.pro_api.app import create_app
from services.pro_api.market import historical_candles
from services.pro_api.store import Settings


class MarketHistory(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.root=Path(self.directory.name)
        self.plan="pro"
        self.settings=Settings(publishable_key="fixture-public",market_root=self.root)
        (self.root/"manifest.json").write_text(json.dumps({"instruments":{"XAUUSD":{"tradingview_symbol":"TVC:GOLD","timeframes":["1m"]}}}))
        start=datetime(2024,1,8,tzinfo=timezone.utc)
        self.snapshot={"instrument":"XAUUSD","timeframe":"1m","provider":"Explicit authorized fixture", "license_reference":"Local test fixture only", "as_of":datetime(2024,2,1,tzinfo=timezone.utc).isoformat(), "valid_until":datetime(2024,2,2,tzinfo=timezone.utc).isoformat(),"market_open":False,
            "candles":[{"timestamp":(start+timedelta(minutes=i)).isoformat(),"open":"2000","high":"2001","low":"1999","close":"2000"} for i in range(3000)]}
        (self.root/"XAUUSD_1m.json").write_text(json.dumps(self.snapshot))
        self.client=TestClient(create_app(self.settings,transport=httpx.MockTransport(self.upstream)))
        self.client.__enter__()

    def upstream(self,request):
        if request.url.path=="/auth/v1/user":return httpx.Response(200,json={"id":"11111111-1111-4111-8111-111111111111"})
        if request.url.path.endswith("journal_rate_limit"):return httpx.Response(200,json=True)
        if request.url.path.endswith("journal_entitlements"):return httpx.Response(200,json={"plan":self.plan,"effectiveUntil":"2099-01-01T00:00:00Z"})
        raise AssertionError("Unexpected operation "+str(request.url))

    def tearDown(self):
        self.client.__exit__(None,None,None)
        self.directory.cleanup()

    def test_pagination_of_actual_2024_snapshot(self):
        url="/api/v1/market/history?instrument=XAUUSD&timeframe=1m&limit=2000&start=2024-01-01T00:00:00Z"
        headers={"Authorization":"Bearer verified-fixture"}
        first=self.client.get(url,headers=headers)
        self.assertEqual(first.status_code,200,first.text)
        data=first.json();self.assertEqual(len(data["candles"]),2000);self.assertTrue(data["has_more"])
        self.assertEqual(data["candles"][0]["time"],int(datetime(2024,1,8,tzinfo=timezone.utc).timestamp()))
        second=self.client.get(url+"&offset=2000",headers=headers).json()
        self.assertEqual(len(second["candles"]),1000);self.assertFalse(second["has_more"])
        self.assertLess(data["candles"][-1]["time"],second["candles"][0]["time"])

    def test_auth_plan_and_input_validation(self):
        url="/api/v1/market/history?instrument=XAUUSD&timeframe=1m"
        self.assertEqual(self.client.get(url).status_code,401)
        self.plan="free"
        self.assertEqual(self.client.get(url,headers={"Authorization":"Bearer fixture"}).status_code,403)
        self.plan="pro"
        self.assertEqual(self.client.get(url+"&limit=2001",headers={"Authorization":"Bearer fixture"}).status_code,422)
        self.assertEqual(self.client.get(url+"&start=2024-01-01",headers={"Authorization":"Bearer fixture"}).status_code,422)

    def test_wrong_symbol_or_missing_snapshot_fails(self):
        self.snapshot["instrument"]="PAXGUSDT"
        (self.root/"XAUUSD_1m.json").write_text(json.dumps(self.snapshot))
        with self.assertRaises(HTTPException):historical_candles(self.settings,"XAUUSD","1m")
        (self.root/"XAUUSD_1m.json").unlink()
        with self.assertRaises(HTTPException):historical_candles(self.settings,"XAUUSD","1m")
