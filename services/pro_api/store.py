"""Supabase requests retain the user's JWT and RLS; only the worker uses a secret."""
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

PROJECT = "nmddjuqkdyhcobddinkc"


@dataclass(frozen=True)
class Settings:
    supabase_url: str = os.getenv("SUPABASE_URL", f"https://{PROJECT}.supabase.co")
    publishable_key: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    service_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    origins: tuple = tuple(value.strip() for value in os.getenv("PRO_ALLOWED_ORIGINS", "http://localhost:8778,http://127.0.0.1:8778").split(",") if value.strip())
    data_root: Path = Path(os.getenv("PRO_DATA_ROOT", Path(__file__).resolve().parents[2])).resolve()
    market_root: Path = Path(os.getenv("PRO_MARKET_ROOT", Path(__file__).resolve().parent / "market_snapshots")).resolve()
    ollama_url: str = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "")
    model_license: str = os.getenv("OLLAMA_MODEL_LICENSE", "")
    model_digest: str = os.getenv("OLLAMA_MODEL_DIGEST", "")
    model_benchmark: Path | None = Path(os.environ["PRO_MODEL_BENCHMARK"]) if os.getenv("PRO_MODEL_BENCHMARK") else None
    ai_timeout: int = int(os.getenv("PRO_AI_TIMEOUT_SECONDS", "120"))
    snapshot_poll_seconds: int = int(os.getenv("PRO_SNAPSHOT_POLL_SECONDS", "60"))
    calendar_timezone: str = os.getenv("PRO_CALENDAR_SOURCE_TIMEZONE", "Asia/Jakarta")

    def validate(self, worker=False):
        if self.supabase_url.rstrip("/") != f"https://{PROJECT}.supabase.co":
            raise RuntimeError("This service is restricted to the journaltrading Supabase project")
        if not self.publishable_key or worker and not self.service_key:
            raise RuntimeError("Supabase configuration is incomplete")
        if "*" in self.origins:
            raise RuntimeError("Wildcard origins are forbidden")
        parsed = urlparse(self.ollama_url)
        if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost", "ollama") or parsed.username or parsed.password or parsed.path not in ("", "/"):
            raise RuntimeError("Ollama must be on the configured private local service")
        if not 10 <= self.ai_timeout <= 240:
            raise RuntimeError("AI timeout must be 10–240 seconds")
        if not 10 <= self.snapshot_poll_seconds <= 3600:
            raise RuntimeError("Snapshot polling must be 10–3600 seconds")


class Store:
    def __init__(self, client: httpx.AsyncClient, settings: Settings, token: str, privileged=False):
        self.client, self.settings, self.token = client, settings, token
        self.headers = {"apikey": settings.service_key if privileged else settings.publishable_key,
                        "Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def request(self, method, path, *, params=None, json=None, content=None, headers=None):
        try:
            response = await self.client.request(method, self.settings.supabase_url + path, params=params,
                                                 json=json, content=content, headers={**self.headers, **(headers or {})})
        except httpx.RequestError as exc:
            raise HTTPException(503, "The journal database is unavailable") from exc
        if response.status_code >= 400:
            code = response.json().get("code") if response.headers.get("content-type", "").startswith("application/json") else ""
            if response.status_code in (401, 403) or code in ("42501", "28000"):
                raise HTTPException(403, "Authentication, entitlement or ownership check failed")
            if response.status_code == 404:
                raise HTTPException(404, "Resource not found")
            if response.status_code == 409 or code in ("22023", "23505", "Duplicate"):
                raise HTTPException(409, "Conflicting or invalid request")
            if code == "P0001":
                raise HTTPException(429, "Usage or concurrency limit reached")
            raise HTTPException(503, "The database operation could not be completed")
        if not response.content:
            return None
        return response.json()

    async def rpc(self, name, payload=None):
        return await self.request("POST", f"/rest/v1/rpc/{name}", json=payload or {})

    async def rows(self, table, filters=None):
        collected = []
        for offset in range(0, 100001, 1000):
            rows = await self.request("GET", f"/rest/v1/{table}", params={"select": "*", "limit": 1000,
                                                                                   "offset": offset, **(filters or {})})
            collected.extend(rows)
            if len(rows) < 1000:
                return collected
        raise HTTPException(413, "Select a narrower date range for this account")

    async def insert(self, table, payload, *, upsert=False, conflict=None):
        return await self.request("POST", f"/rest/v1/{table}", json=payload,
                                  params={"on_conflict": conflict} if conflict else None,
                                  headers={"Prefer": "return=representation" + (",resolution=merge-duplicates" if upsert else "")})

    async def update(self, table, identifier, payload):
        rows = await self.request("PATCH", f"/rest/v1/{table}", params={"id": f"eq.{identifier}"}, json=payload,
                                  headers={"Prefer": "return=representation"})
        if not rows:
            raise HTTPException(404, "Resource not found")
        return rows[0]

    async def delete(self, table, identifier):
        rows = await self.request("DELETE", f"/rest/v1/{table}", params={"id": f"eq.{identifier}"},
                                  headers={"Prefer": "return=representation"})
        if not rows:
            raise HTTPException(404, "Resource not found")


def entitlements(raw):
    tier = raw.get("plan", "free")
    features = ["journal", "statistics", "risk_calculator", "imports", "backup"]
    if tier in ("plus", "pro"):
        features += ["calendar", "regional_news"]
    if tier == "pro":
        features += ["advanced_analytics", "heatmap", "strategy_comparison", "risk_intelligence", "reviews",
                     "reports", "ai_behaviour", "ai_market", "ai_journal", "global_news"]
    return {"plan": tier, "effective_until": raw.get("effectiveUntil"), "entitlements": features,
            "countries": raw.get("countries", []),
            "ai": {"limit": raw.get("aiLimit", 0), "used": raw.get("aiUsed", 0),
                   "reserved": raw.get("aiReserved", 0), "remaining": raw.get("aiRemaining", 0),
                   "period_start": raw.get("periodStart"), "period_end": raw.get("periodEnd")}}
