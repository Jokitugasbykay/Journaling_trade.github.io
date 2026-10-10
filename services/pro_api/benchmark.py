"""Explicit local inference benchmark. No journal records or subscription quota are used."""
import argparse
import asyncio
import json
import platform
from datetime import datetime, timezone
from pathlib import Path
import httpx
from .ai import explain
from .store import Settings


async def benchmark(output):
    settings = Settings()
    settings.validate()
    durations = []
    async with httpx.AsyncClient(follow_redirects=False) as client:
        for _ in range(3):
            result = await explain(client, settings, "journal", {"trades": [{"id": "benchmark-trade", "net_pnl": "10"}],
                                   "metrics": {"trade_count": 1, "net_pnl": "10"}}, ["benchmark-trade"], require_benchmark=False)
            durations.append(result["runtime_seconds"])
    record = {"model": settings.ollama_model, "digest": settings.model_digest, "license": settings.model_license,
              "validated_runs": len(durations), "max_seconds": max(durations), "seconds": durations,
              "host": platform.platform(), "processor": platform.processor(), "created_at": datetime.now(timezone.utc).isoformat(),
              "scope": "Three small structured-output probes; not evidence of financial forecasting accuracy or production capacity"}
    if max(durations) > settings.ai_timeout:
        raise RuntimeError("The model exceeded the configured analysis timeout")
    Path(output).write_text(json.dumps(record, indent=2), encoding="utf-8")
    print(json.dumps(record, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    asyncio.run(benchmark(parser.parse_args().output))
