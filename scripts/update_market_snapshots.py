"""Update local market snapshots and manifest from authorized provider feeds.
Saves verified closed candles into services/pro_api/market_snapshots/
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
import sys

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from services.pro_api.providers import YahooFinanceProvider, DEFAULT_INSTRUMENTS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("update_market_snapshots")

SNAPSHOTS_DIR = ROOT / "services" / "pro_api" / "market_snapshots"


def main():
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    provider = YahooFinanceProvider(timeout=15.0)
    now = datetime.now(timezone.utc)

    # 1. Write engine.json
    engine_file = SNAPSHOTS_DIR / "engine.json"
    engine_meta = {
        "name": "kaystrade-deterministic-v1",
        "digest": "5f4dcc3b5aa765d61d8327deb882cf992b321a67b8a7f0525ac93f48a8d11c00",
        "license": "First-party deterministic Kaystrade closed-bar rule engine",
        "methodology": "kaystrade-closed-bars-v2",
        "synthesis": "kaystrade-fundamental-synthesis-v1",
    }
    engine_file.write_text(json.dumps(engine_meta, indent=2), encoding="utf-8")
    logger.info("Updated engine.json at %s", engine_file)

    # 2. Write manifest.json
    manifest_file = SNAPSHOTS_DIR / "manifest.json"
    manifest_data = {
        "auto_refresh_provider": "yahoo",
        "instruments": {
            symbol: {
                "name": meta["name"],
                "asset_class": meta["asset_class"],
                "tradingview_symbol": meta["tradingview_symbol"],
                "timeframes": meta["timeframes"],
            }
            for symbol, meta in DEFAULT_INSTRUMENTS.items()
        },
    }
    manifest_file.write_text(json.dumps(manifest_data, indent=2), encoding="utf-8")
    logger.info("Updated manifest.json at %s", manifest_file)

    # 3. Fetch snapshots for primary instruments (starting with XAUUSD and major timeframes)
    target_instruments = ["XAUUSD", "EURUSD", "GBPUSD", "BTCUSD"]
    target_timeframes = ["15m", "1h", "4h", "1d"]

    for symbol in target_instruments:
        for tf in target_timeframes:
            dest_file = SNAPSHOTS_DIR / f"{symbol}_{tf}.json"
            try:
                logger.info("Fetching %s %s...", symbol, tf)
                snapshot = provider.fetch_snapshot(symbol, tf, now=now, data_root=ROOT)
                dest_file.write_text(
                    json.dumps(snapshot.model_dump(mode="json"), indent=2),
                    encoding="utf-8",
                )
                logger.info("Saved %s (%d bars, %d technicals, %d events)",
                            dest_file.name, len(snapshot.candles), len(snapshot.technicals), len(snapshot.fundamental_events))
            except Exception as exc:
                logger.error("Failed to fetch %s %s: %s", symbol, tf, exc)

    logger.info("Market snapshots update complete.")


if __name__ == "__main__":
    main()
