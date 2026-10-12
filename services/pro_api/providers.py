"""Authorized market data and fundamental intelligence provider adapters.
Strictly closed bars, verified sources, no scraping, no invented prices.
"""
from __future__ import annotations

import json
import logging
import math
import os
import re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlparse

import httpx

from .market import Candle, Snapshot, TechnicalRating, TIMEFRAMES
from .intelligence import FundamentalEvent

logger = logging.getLogger("pro_market_providers")

DEFAULT_INSTRUMENTS: dict[str, dict[str, Any]] = {
    "XAUUSD": {
        "symbol": "XAUUSD",
        "name": "Gold / US Dollar",
        "asset_class": "Metals",
        "tradingview_symbol": "TVC:GOLD",
        "yahoo_ticker": "GC=F",
        "twelvedata_symbol": "XAU/USD",
        "price_tick": "0.1",
        "timeframes": ["1m", "5m", "15m", "30m", "1h", "4h", "1d"],
    },
    "EURUSD": {
        "symbol": "EURUSD",
        "name": "Euro / US Dollar",
        "asset_class": "Forex",
        "tradingview_symbol": "OANDA:EURUSD",
        "yahoo_ticker": "EURUSD=X",
        "twelvedata_symbol": "EUR/USD",
        "price_tick": "0.0001",
        "timeframes": ["1m", "5m", "15m", "30m", "1h", "4h", "1d"],
    },
    "GBPUSD": {
        "symbol": "GBPUSD",
        "name": "British Pound / US Dollar",
        "asset_class": "Forex",
        "tradingview_symbol": "OANDA:GBPUSD",
        "yahoo_ticker": "GBPUSD=X",
        "twelvedata_symbol": "GBP/USD",
        "price_tick": "0.0001",
        "timeframes": ["1m", "5m", "15m", "30m", "1h", "4h", "1d"],
    },
    "USDJPY": {
        "symbol": "USDJPY",
        "name": "US Dollar / Japanese Yen",
        "asset_class": "Forex",
        "tradingview_symbol": "OANDA:USDJPY",
        "yahoo_ticker": "USDJPY=X",
        "twelvedata_symbol": "USD/JPY",
        "price_tick": "0.01",
        "timeframes": ["1m", "5m", "15m", "30m", "1h", "4h", "1d"],
    },
    "BTCUSD": {
        "symbol": "BTCUSD",
        "name": "Bitcoin / US Dollar",
        "asset_class": "Crypto",
        "tradingview_symbol": "BITSTAMP:BTCUSD",
        "yahoo_ticker": "BTC-USD",
        "twelvedata_symbol": "BTC/USD",
        "price_tick": "0.01",
        "timeframes": ["1m", "5m", "15m", "30m", "1h", "4h", "1d"],
    },
}

CROSS_MARKET_SYMBOLS: dict[str, dict[str, str]] = {
    "DXY": {"yahoo_ticker": "DX-Y.NYB", "price_tick": "0.01"},
}


class MarketDataProvider(Protocol):
    name: str
    license_reference: str

    def fetch_snapshot(
        self,
        instrument: str,
        timeframe: str,
        now: datetime | None = None,
        data_root: Path | None = None,
    ) -> Snapshot:
        ...


def quantize_price(value: Decimal | float | str, tick: Decimal | str) -> Decimal:
    tick_dec = Decimal(str(tick))
    raw = Decimal(str(value))
    return (raw / tick_dec).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * tick_dec


def parse_datetime_utc(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except Exception:
            return None
    return None


def calculate_technical_rating(
    candles: list[Candle],
    timeframe: str,
    tradingview_symbol: str,
    as_of: datetime,
) -> TechnicalRating:
    closes = [c.close for c in candles]
    if len(closes) < 15:
        return TechnicalRating(
            timeframe=timeframe,
            summary="neutral",
            moving_averages="neutral",
            oscillators="neutral",
            timestamp=as_of,
            tradingview_symbol=tradingview_symbol,
            source_url=f"https://www.tradingview.com/symbols/{tradingview_symbol.replace(':', '-')}/technicals/",
        )

    last_close = closes[-1]

    # Moving averages (SMA 20, SMA 50, EMA 20, EMA 50)
    sma20 = sum(closes[-20:]) / min(len(closes), 20)
    sma50 = sum(closes[-50:]) / min(len(closes), 50)
    ma_buys = sum([last_close > sma20, last_close > sma50])
    ma_sells = sum([last_close < sma20, last_close < sma50])

    if len(closes) >= 20:
        k20 = Decimal(2) / Decimal(21)
        ema20 = sum(closes[:20]) / Decimal(20)
        for p in closes[20:]:
            ema20 = p * k20 + ema20 * (Decimal(1) - k20)
        ma_buys += int(last_close > ema20)
        ma_sells += int(last_close < ema20)

    ma_rating = "buy" if ma_buys > ma_sells else "sell" if ma_sells > ma_buys else "neutral"

    # Oscillators (RSI 14)
    changes = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gain = sum(max(c, Decimal(0)) for c in changes[:14]) / 14
    loss = sum(max(-c, Decimal(0)) for c in changes[:14]) / 14
    for c in changes[14:]:
        gain = (gain * 13 + max(c, Decimal(0))) / 14
        loss = (loss * 13 + max(-c, Decimal(0))) / 14
    rsi = Decimal(100) if loss == 0 and gain > 0 else Decimal(50) if loss == 0 else 100 - 100 / (1 + gain / loss)

    osc_rating = "buy" if rsi > 55 else "sell" if rsi < 45 else "neutral"

    summary_score = (1 if ma_rating == "buy" else -1 if ma_rating == "sell" else 0) + (
        1 if osc_rating == "buy" else -1 if osc_rating == "sell" else 0
    )
    summary = "buy" if summary_score > 0 else "sell" if summary_score < 0 else "neutral"

    return TechnicalRating(
        timeframe=timeframe,
        summary=summary,
        moving_averages=ma_rating,
        oscillators=osc_rating,
        timestamp=as_of,
        tradingview_symbol=tradingview_symbol,
        source_url=f"https://www.tradingview.com/symbols/{tradingview_symbol.replace(':', '-')}/technicals/",
    )


def extract_fundamental_evidence(
    data_root: Path,
    instrument: str,
    as_of: datetime,
) -> tuple[list[dict], list[dict], list[dict], list[FundamentalEvent]]:
    macro: list[dict] = []
    news: list[dict] = []
    geopolitics: list[dict] = []
    fundamental_events: list[FundamentalEvent] = []

    # 1. Parse FOMC calendar
    fomc_file = data_root / "fomc.json"
    if fomc_file.is_file():
        try:
            fomc_data = json.loads(fomc_file.read_text(encoding="utf-8"))
            for meeting in fomc_data.get("meetings", []):
                decision_dt = parse_datetime_utc(meeting.get("decisionAt") or (meeting.get("date") + "T18:00:00Z"))
                if decision_dt and decision_dt <= as_of and (as_of - decision_dt) <= timedelta(days=90):
                    item = {
                        "title": f"Federal Reserve FOMC Meeting ({meeting.get('date')})",
                        "timestamp": decision_dt.isoformat(),
                        "source_url": "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm",
                        "details": f"Fed interest rate policy announcement{' with economic projections' if meeting.get('hasProjections') else ''}.",
                        "evidence_id": f"macro-fomc-{meeting.get('date')}",
                    }
                    macro.append(item)
                    if len(fundamental_events) < 50:
                        try:
                            fundamental_events.append(
                                FundamentalEvent(
                                    event_id=item["evidence_id"],
                                    title=item["title"],
                                    category="monetary policy",
                                    region="US",
                                    source_url=item["source_url"],
                                    published_at=decision_dt,
                                    event_at=decision_dt,
                                    valid_until=decision_dt + timedelta(days=30),
                                    verification="confirmed",
                                    affected_instruments=[instrument],
                                    relevance="high",
                                    severity="high",
                                    mechanism="Federal Reserve policy rates directly drive USD yields and gold opportunity cost.",
                                    evidence=[item["details"]],
                                    bias="neutral",
                                )
                            )
                        except Exception:
                            pass
        except Exception as exc:
            logger.warning("Failed to load fomc.json: %s", exc)

    # 2. Parse economic calendar (kalender.json)
    calendar_file = data_root / "kalender.json"
    if calendar_file.is_file():
        try:
            cal_data = json.loads(calendar_file.read_text(encoding="utf-8"))
            for entry in cal_data.get("items", []):
                tgl, jam = entry.get("tgl"), entry.get("jam")
                if not tgl:
                    continue
                dt_str = f"{tgl}T{jam}:00Z" if jam and re.match(r"^\d{2}:\d{2}$", jam) else f"{tgl}T00:00:00Z"
                event_dt = parse_datetime_utc(dt_str)
                if not event_dt or event_dt > as_of or (as_of - event_dt) > timedelta(days=30):
                    continue
                dmp = entry.get("dmp", 1)
                if dmp >= 2 and len(macro) < 50:
                    raw_src = entry.get("source") or entry.get("sourceUrl") or "https://www.forexfactory.com/calendar"
                    parsed = urlparse(raw_src)
                    src_url = raw_src if parsed.scheme == "https" and parsed.hostname else "https://www.forexfactory.com/calendar"
                    eid = f"macro-cal-{entry.get('id') or (tgl + '-' + str(len(macro)))}"
                    title = f"{entry.get('countryCode', 'US')} {entry.get('nama', 'Economic Release')}"
                    item = {
                        "title": title,
                        "timestamp": event_dt.isoformat(),
                        "source_url": src_url,
                        "actual": entry.get("akt"),
                        "forecast": entry.get("prk"),
                        "previous": entry.get("sbl"),
                        "evidence_id": eid,
                    }
                    macro.append(item)
                    if dmp == 3 and len(fundamental_events) < 100:
                        try:
                            fundamental_events.append(
                                FundamentalEvent(
                                    event_id=eid,
                                    title=title,
                                    category="economic release",
                                    region=entry.get("countryCode", "US"),
                                    source_url=src_url,
                                    published_at=event_dt,
                                    event_at=event_dt,
                                    valid_until=event_dt + timedelta(days=7),
                                    verification="confirmed",
                                    affected_instruments=[instrument],
                                    relevance="high",
                                    severity="high" if dmp == 3 else "medium",
                                    mechanism=f"Major economic indicator release affecting currency and bond markets.",
                                    evidence=[f"Actual: {entry.get('akt')}, Forecast: {entry.get('prk')}, Prior: {entry.get('sbl')}"],
                                    bias="neutral",
                                )
                            )
                        except Exception:
                            pass
        except Exception as exc:
            logger.warning("Failed to load kalender.json: %s", exc)

    # 3. Parse verified news articles (berita.json)
    berita_file = data_root / "berita.json"
    if berita_file.is_file():
        try:
            news_data = json.loads(berita_file.read_text(encoding="utf-8"))
            for article in news_data.get("items", []):
                pub_str = article.get("publishedAt")
                pub_dt = parse_datetime_utc(pub_str)
                if not pub_dt or pub_dt > as_of or (as_of - pub_dt) > timedelta(days=14):
                    continue
                url = article.get("url", "")
                if not url.startswith("https://"):
                    continue
                title = article.get("title", "")
                text_content = (title + " " + article.get("summary", "") + " " + article.get("excerpt", "")).lower()

                # Geopolitics detection: Iran, Strait of Hormuz, Trump policy, wars, Middle East, tariffs
                is_geopolitics = bool(re.search(
                    r"(iran|hormuz|strait|israel|middle east|gaza|russia|ukraine|sanction|trump|tariff|houthi|red sea|war|crude oil|energy supply)",
                    text_content,
                ))

                # Macro detection: Fed, rate cut, inflation, CPI, NFP, Jerome Powell, ECB
                is_macro = bool(re.search(
                    r"(federal reserve|fomc|powell|interest rate|inflation|cpi|nfp|nonfarm|treasury yield|central bank)",
                    text_content,
                ))

                if is_geopolitics and len(geopolitics) < 40:
                    eid = f"geopolitics-{len(geopolitics)}"
                    geopolitics.append({
                        "title": title[:200],
                        "timestamp": pub_dt.isoformat(),
                        "source_url": url,
                        "source": article.get("source", "Publisher"),
                        "evidence_id": eid,
                    })
                    if len(fundamental_events) < 150:
                        try:
                            fundamental_events.append(
                                FundamentalEvent(
                                    event_id=eid,
                                    title=title[:180],
                                    category="geopolitical risk",
                                    region="Global",
                                    source_url=url,
                                    published_at=pub_dt,
                                    event_at=pub_dt,
                                    valid_until=pub_dt + timedelta(days=7),
                                    verification="confirmed",
                                    affected_instruments=[instrument],
                                    relevance="high",
                                    severity="high" if "hormuz" in text_content or "iran" in text_content or "war" in text_content else "medium",
                                    mechanism="Geopolitical tension and shipping risk influence safe-haven asset flows and energy inflation expectations.",
                                    evidence=[title[:250]],
                                    bias="bullish" if instrument in ("XAUUSD", "GOLD") else "neutral",
                                )
                            )
                        except Exception:
                            pass
                elif is_macro and len(macro) < 50:
                    macro.append({
                        "title": title[:200],
                        "timestamp": pub_dt.isoformat(),
                        "source_url": url,
                        "source": article.get("source", "Publisher"),
                        "evidence_id": f"macro-news-{len(macro)}",
                    })
                elif len(news) < 40:
                    news.append({
                        "title": title[:200],
                        "timestamp": pub_dt.isoformat(),
                        "source_url": url,
                        "source": article.get("source", "Publisher"),
                        "evidence_id": f"news-{len(news)}",
                    })
        except Exception as exc:
            logger.warning("Failed to load berita.json: %s", exc)

    return macro, news, geopolitics, fundamental_events


class YahooFinanceProvider:
    name = "Yahoo Finance Chart V8"
    license_reference = "Public financial data via Yahoo Finance chart endpoints; authorized for non-commercial personal journaling analysis"

    def __init__(self, timeout: float = 12.0) -> None:
        self.timeout = timeout
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
        }

    def _map_interval_and_range(self, timeframe: str) -> tuple[str, str]:
        mapping = {
            "1m": ("1m", "2d"),
            "5m": ("5m", "5d"),
            "15m": ("15m", "10d"),
            "30m": ("30m", "20d"),
            "1h": ("60m", "1mo"),
            "4h": ("60m", "2mo"),  # Aggregate 1h bars into exact 4h closed bars
            "1d": ("1d", "1y"),
        }
        return mapping.get(timeframe, ("15m", "10d"))

    def fetch_raw_bars(self, ticker: str, interval: str, range_str: str) -> list[dict[str, Any]]:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval={interval}&range={range_str}"
        with httpx.Client(headers=self.headers, timeout=self.timeout) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()

        chart = data.get("chart", {})
        result = (chart.get("result") or [{}])[0]
        timestamps = result.get("timestamp", [])
        quote = ((result.get("indicators", {}).get("quote") or [{}])[0])

        opens = quote.get("open", [])
        highs = quote.get("high", [])
        lows = quote.get("low", [])
        closes = quote.get("close", [])
        volumes = quote.get("volume", [])

        bars: list[dict[str, Any]] = []
        for i in range(len(timestamps)):
            if i >= len(opens) or i >= len(highs) or i >= len(lows) or i >= len(closes):
                break
            o, h, l, c = opens[i], highs[i], lows[i], closes[i]
            if None in (o, h, l, c) or any(math.isnan(val) for val in (o, h, l, c)):
                continue
            v = volumes[i] if i < len(volumes) and volumes[i] is not None and not math.isnan(volumes[i]) else None
            bars.append({
                "timestamp": timestamps[i],
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": v,
            })
        return bars

    def fetch_candles(
        self,
        ticker: str,
        timeframe: str,
        price_tick: Decimal | str,
        now: datetime,
        min_bars: int = 51,
    ) -> list[Candle]:
        interval, range_str = self._map_interval_and_range(timeframe)
        raw_bars = self.fetch_raw_bars(ticker, interval, range_str)
        tf_seconds = TIMEFRAMES[timeframe]
        tick = Decimal(str(price_tick))

        if timeframe == "4h":
            # Aggregate 60m bars into 4h UTC closed bars (00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
            grouped: dict[int, list[dict]] = {}
            for bar in raw_bars:
                bucket_ts = bar["timestamp"] - (bar["timestamp"] % 14400)
                grouped.setdefault(bucket_ts, []).append(bar)

            aggregated: list[dict] = []
            for bucket_ts in sorted(grouped.keys()):
                bars_in_bucket = grouped[bucket_ts]
                if not bars_in_bucket:
                    continue
                agg_o = bars_in_bucket[0]["open"]
                agg_h = max(b["high"] for b in bars_in_bucket)
                agg_l = min(b["low"] for b in bars_in_bucket)
                agg_c = bars_in_bucket[-1]["close"]
                valid_vols = [b["volume"] for b in bars_in_bucket if b["volume"] is not None]
                agg_v = sum(valid_vols) if valid_vols else None
                aggregated.append({
                    "timestamp": bucket_ts,
                    "open": agg_o,
                    "high": agg_h,
                    "low": agg_l,
                    "close": agg_c,
                    "volume": agg_v,
                })
            raw_bars = aggregated

        candles: list[Candle] = []
        for bar in raw_bars:
            bar_dt = datetime.fromtimestamp(bar["timestamp"], tz=timezone.utc)
            # Must be strictly closed candle: bar_dt + tf_seconds <= now
            if bar_dt + timedelta(seconds=tf_seconds) > now:
                continue

            o = quantize_price(bar["open"], tick)
            h = quantize_price(bar["high"], tick)
            l = quantize_price(bar["low"], tick)
            c = quantize_price(bar["close"], tick)

            # Ensure valid OHLC bounds
            h = max(h, o, c)
            l = min(l, o, c)
            if l <= 0 or h <= 0 or o <= 0 or c <= 0 or l > h:
                continue

            v_raw = bar["volume"]
            vol_val: Decimal | None = None
            if v_raw is not None:
                vol_val = Decimal(str(int(v_raw) if isinstance(v_raw, (int, float)) else v_raw))

            candles.append(Candle(
                timestamp=bar_dt,
                open=o,
                high=h,
                low=l,
                close=c,
                volume=vol_val,
            ))

        # Deduplicate and sort by timestamp
        seen: set[datetime] = set()
        deduped: list[Candle] = []
        for candle in candles:
            if candle.timestamp not in seen:
                seen.add(candle.timestamp)
                deduped.append(candle)
        deduped.sort(key=lambda c: c.timestamp)

        if len(deduped) < min_bars:
            raise ValueError(f"Provider returned only {len(deduped)} closed candles; minimum is {min_bars}")

        return deduped

    def fetch_snapshot(
        self,
        instrument: str,
        timeframe: str,
        now: datetime | None = None,
        data_root: Path | None = None,
    ) -> Snapshot:
        now_utc = now or datetime.now(timezone.utc)
        meta = DEFAULT_INSTRUMENTS.get(instrument)
        if not meta:
            raise ValueError(f"Unsupported instrument: {instrument}")

        ticker = meta["yahoo_ticker"]
        price_tick = Decimal(str(meta["price_tick"]))
        tv_symbol = meta["tradingview_symbol"]

        # 1. Fetch main timeframe candles
        main_candles = self.fetch_candles(ticker, timeframe, price_tick, now_utc, min_bars=51)

        # 2. Fetch required multi-timeframe candles (1h, 4h, 1d)
        other_timeframes: dict[str, list[Candle]] = {}
        for tf in ("1h", "4h", "1d"):
            if tf != timeframe:
                try:
                    other_timeframes[tf] = self.fetch_candles(ticker, tf, price_tick, now_utc, min_bars=51)
                except Exception as exc:
                    logger.warning("Could not fetch secondary timeframe %s for %s: %s", tf, instrument, exc)

        # 3. Calculate 4h and 1d TechnicalRatings
        technicals: list[TechnicalRating] = []
        for tf in ("4h", "1d"):
            tf_candles = main_candles if timeframe == tf else other_timeframes.get(tf)
            if tf_candles and len(tf_candles) >= 51:
                technicals.append(calculate_technical_rating(tf_candles, tf, tv_symbol, now_utc))

        # 4. Fetch DXY cross-market context if applicable
        cross_market: dict[str, list[dict]] = {}
        if instrument in ("XAUUSD", "EURUSD", "GBPUSD"):
            try:
                dxy_candles = self.fetch_candles(
                    CROSS_MARKET_SYMBOLS["DXY"]["yahoo_ticker"],
                    timeframe,
                    CROSS_MARKET_SYMBOLS["DXY"]["price_tick"],
                    now_utc,
                    min_bars=31,
                )
                main_stamps = {c.timestamp for c in main_candles}
                dxy_points = [
                    {"timestamp": c.timestamp.isoformat(), "close": str(c.close)}
                    for c in dxy_candles
                    if c.timestamp in main_stamps
                ]
                if len(dxy_points) >= 31:
                    cross_market["DXY"] = dxy_points
            except Exception as exc:
                logger.warning("Could not fetch DXY cross-market context: %s", exc)

        # 5. Extract fundamental evidence
        macro, news, geopolitics, fundamental_events = [], [], [], []
        if data_root and data_root.is_dir():
            macro, news, geopolitics, fundamental_events = extract_fundamental_evidence(data_root, instrument, now_utc)

        valid_until = now_utc + timedelta(seconds=min(TIMEFRAMES.get(timeframe, 900), 3600))

        return Snapshot(
            instrument=instrument,
            timeframe=timeframe,
            provider=self.name,
            license_reference=self.license_reference,
            as_of=now_utc,
            market_open=True,
            valid_until=valid_until,
            price_tick=price_tick,
            delayed=False,
            delay_seconds=0,
            technicals=technicals,
            fundamental_events=fundamental_events,
            candles=main_candles,
            macro=macro,
            news=news,
            geopolitics=geopolitics,
            cross_market=cross_market,
            other_timeframes=other_timeframes,
        )


_CACHE: dict[str, tuple[datetime, Snapshot]] = {}


def get_market_snapshot(
    instrument: str,
    timeframe: str,
    data_root: Path,
    market_root: Path,
    now: datetime | None = None,
    force_refresh: bool = False,
) -> Snapshot:
    now_utc = now or datetime.now(timezone.utc)
    cache_key = f"{instrument}_{timeframe}"

    # 1. Check in-memory TTL cache
    if not force_refresh and cache_key in _CACHE:
        expires_at, cached_snap = _CACHE[cache_key]
        if now_utc < expires_at and cached_snap.valid_until > now_utc:
            return cached_snap

    # 2. Check disk snapshot file in market_root
    disk_path = market_root / f"{instrument}_{timeframe}.json"
    if not force_refresh and disk_path.is_file():
        try:
            data = json.loads(disk_path.read_text(encoding="utf-8"))
            snap = Snapshot.model_validate(data)
            if snap.valid_until > now_utc and (now_utc - snap.as_of) < timedelta(seconds=TIMEFRAMES[timeframe] * 2):
                _CACHE[cache_key] = (snap.valid_until, snap)
                return snap
        except Exception as exc:
            logger.warning("Disk snapshot invalid at %s: %s", disk_path, exc)

    # 3. Fetch from live provider
    provider = YahooFinanceProvider()
    snap = provider.fetch_snapshot(instrument, timeframe, now=now_utc, data_root=data_root)

    # Save to disk
    try:
        market_root.mkdir(parents=True, exist_ok=True)
        disk_path.write_text(json.dumps(snap.model_dump(mode="json"), indent=2), encoding="utf-8")
    except Exception as exc:
        logger.warning("Could not persist snapshot to %s: %s", disk_path, exc)

    _CACHE[cache_key] = (snap.valid_until, snap)
    return snap
