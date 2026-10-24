#!/usr/bin/env python3
"""Fix broken pair feeds: CC-dependent FX/metals + delisted Binance symbols."""
from pathlib import Path
import re
import sys

p = Path('js/pro.js')
t = p.read_text(encoding='utf-8')
orig = t

# --- 1) Remove delisted Binance symbols (klines return -1121) ---
for line_pat in [
    r"\s*\{ code: 'KASUSDT',[^\n]+\},\n",
    r"\s*\{ code: 'AKTUSDT',[^\n]+\},\n",
]:
    t2, n = re.subn(line_pat, '', t, count=1)
    if n:
        t = t2
        print('removed instrument match', line_pat[:40])
    else:
        print('WARN no match', line_pat[:40])

# --- 2) Retarget provider for CC pairs that have free live sources ---
replacements = [
    (
        "{ code: 'XAGUSD', name: 'Silver Spot / US Dollar', cat: 'METALS', provider: 'CC', fsym: 'XAG', tsym: 'USD', tvSym: 'TVC:SILVER', ccy: ['USD', 'XAG'] },",
        "{ code: 'XAGUSD', name: 'Silver Spot / US Dollar', cat: 'METALS', provider: 'SPOT', fsym: 'XAG', tsym: 'USD', tvSym: 'TVC:SILVER', ccy: ['USD', 'XAG'] },",
    ),
    (
        "{ code: 'WTIUSD', name: 'Crude Oil WTI Spot', cat: 'METALS', provider: 'CC', fsym: 'WTI', tsym: 'USD', tvSym: 'TVC:USOIL', ccy: ['USD', 'CAD'] },",
        "{ code: 'WTIUSD', name: 'Crude Oil WTI Spot', cat: 'METALS', provider: 'SEED', fsym: 'WTI', tsym: 'USD', tvSym: 'TVC:USOIL', ccy: ['USD', 'CAD'] },",
    ),
    (
        "{ code: 'USDCAD', name: 'US Dollar / Canadian Dollar', cat: 'FOREX', provider: 'CC', fsym: 'USD', tsym: 'CAD', tvSym: 'FX:USDCAD', ccy: ['USD', 'CAD'] },",
        "{ code: 'USDCAD', name: 'US Dollar / Canadian Dollar', cat: 'FOREX', provider: 'FX', fsym: 'USD', tsym: 'CAD', tvSym: 'FX:USDCAD', ccy: ['USD', 'CAD'] },",
    ),
    (
        "{ code: 'USDCHF', name: 'US Dollar / Swiss Franc', cat: 'FOREX', provider: 'CC', fsym: 'USD', tsym: 'CHF', tvSym: 'FX:USDCHF', ccy: ['USD', 'CHF'] },",
        "{ code: 'USDCHF', name: 'US Dollar / Swiss Franc', cat: 'FOREX', provider: 'FX', fsym: 'USD', tsym: 'CHF', tvSym: 'FX:USDCHF', ccy: ['USD', 'CHF'] },",
    ),
    (
        "{ code: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', cat: 'FOREX', provider: 'CC', fsym: 'NZD', tsym: 'USD', tvSym: 'FX:NZDUSD', ccy: ['NZD', 'USD'] },",
        "{ code: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', cat: 'FOREX', provider: 'FX', fsym: 'NZD', tsym: 'USD', tvSym: 'FX:NZDUSD', ccy: ['NZD', 'USD'] },",
    ),
]
for a, b in replacements:
    if a in t:
        t = t.replace(a, b, 1)
        print('retargeted', b[10:40])
    else:
        print('WARN missing', a[10:50])

# Update seed prices closer to live
t = t.replace("'XAGUSD': 32.20", "'XAGUSD': 54.00")
t = t.replace("'WTIUSD': 71.50", "'WTIUSD': 70.40")

# --- 3) Add helpers if missing ---
if 'async function fetchGoldApiSpot' not in t:
    marker = '  async function fetchApproxDXYPrice(signal = null) {'
    if marker not in t:
        raise SystemExit('DXY helper marker missing — run DXY fix first')
    helpers = r'''
  async function fetchGoldApiSpot(symbol, signal = null) {
    try {
      const res = await fetch('https://api.gold-api.com/price/' + encodeURIComponent(symbol), { signal: signal || undefined });
      if (!res.ok) return null;
      const data = await res.json();
      const price = Number(data.price);
      return Number.isFinite(price) && price > 0 ? price : null;
    } catch (_) {
      return null;
    }
  }

  async function fetchFxSpot(fsym, tsym, signal = null) {
    try {
      if (fsym === 'NZD' && tsym === 'USD') {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: signal || undefined });
        if (!res.ok) return null;
        const data = await res.json();
        const nzd = Number(data.rates && data.rates.NZD);
        return Number.isFinite(nzd) && nzd > 0 ? +(1 / nzd).toFixed(6) : null;
      }
      const res = await fetch('https://open.er-api.com/v6/latest/' + encodeURIComponent(fsym), { signal: signal || undefined });
      if (!res.ok) return null;
      const data = await res.json();
      const px = Number(data.rates && data.rates[tsym]);
      return Number.isFinite(px) && px > 0 ? px : null;
    } catch (_) {
      return null;
    }
  }

  async function fetchAnchoredCandles(code, liveFetcher, tf, limit = 500, signal = null, minP = 0.0001, maxP = 1e9) {
    const stepSec = tfToSeconds(tf);
    let live = null;
    try { live = await liveFetcher(signal); } catch (_) {}
    const seed = SEED_PRICES[code] || SEED_PRICES[code.replace('/', '')] || 100;
    const base = (live && live > minP && live < maxP) ? live : seed;
    return generateFallbackCandles(base, Math.min(limit, 500), stepSec);
  }

  function startAnchoredLiveTicker(label, liveFetcher, minP, maxP) {
    activeFeedInfo.textContent = 'Feed: ' + label + ' \u00b7 16:9';
    const feedLabel = document.getElementById('feedSourceLabel');
    if (feedLabel) {
      feedLabel.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px;margin-right:3px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> STREAM: ' + label;
    }
    pollInterval = setInterval(async () => {
      try {
        const livePrice = await liveFetcher();
        if (!livePrice || currentCandles.length === 0) return;
        if (livePrice < minP || livePrice > maxP) return;
        const last = { ...currentCandles[currentCandles.length - 1] };
        last.close = livePrice;
        if (livePrice > last.high) last.high = livePrice;
        if (livePrice < last.low) last.low = livePrice;
        currentCandles[currentCandles.length - 1] = last;
        if (candleSeries) candleSeries.update(last);
        updateLiveHeader(last);
        evaluateKaystradeEngine(false);
      } catch (_) {}
    }, 5000);
  }

'''
    helpers = helpers.replace('\\u00b7', '\u00b7')
    t = t.replace(marker, helpers + marker, 1)
    print('inserted spot helpers')

# --- 4) Expand switchSymbolOrTF branch for FX / SPOT / SEED ---
# Insert before DXY branch if not already present
if "currentPairObj.provider === 'FX'" not in t:
    dxy_branch_start = "        } else if (currentPairObj.code === 'DXY' || currentPairObj.provider === 'DXY') {"
    if dxy_branch_start not in t:
        raise SystemExit('DXY branch not found')
    fx_branch = """        } else if (currentPairObj.provider === 'FX' || currentPairObj.provider === 'SPOT' || currentPairObj.provider === 'SEED') {
          const code = currentPairObj.code;
          const fsym = currentPairObj.fsym || 'USD';
          const tsym = currentPairObj.tsym || 'USD';
          let label = 'FX SPOT (' + fsym + '/' + tsym + ')';
          let liveFetcher;
          let minP = 0.0001, maxP = 1e7;
          if (code === 'XAGUSD' || currentPairObj.provider === 'SPOT') {
            label = 'XAG SPOT (gold-api)';
            liveFetcher = (sig) => fetchGoldApiSpot('XAG', sig);
            minP = 5; maxP = 500;
          } else if (code === 'WTIUSD' || currentPairObj.provider === 'SEED') {
            label = 'WTI SEED (no free OHLC)';
            liveFetcher = async () => SEED_PRICES.WTIUSD || 70.4;
            minP = 10; maxP = 300;
          } else {
            liveFetcher = (sig) => fetchFxSpot(fsym, tsym, sig);
            minP = 0.1; maxP = 10;
          }
          activeFeedInfo.textContent = 'Feed: ' + label + ' \u00b7 500 Bars \u00b7 16:9';
          const [activeData, h1Data, h4Data, d1Data] = await Promise.all([
            fetchAnchoredCandles(code, liveFetcher, selectedFrame, 500, controller.signal, minP, maxP),
            fetchAnchoredCandles(code, liveFetcher, '1h', 500, controller.signal, minP, maxP),
            fetchAnchoredCandles(code, liveFetcher, '4h', 500, controller.signal, minP, maxP),
            fetchAnchoredCandles(code, liveFetcher, '1d', 500, controller.signal, minP, maxP)
          ]);
          applyLoadedCandles(activeData, h1Data, h4Data, d1Data);
          startAnchoredLiveTicker(label, liveFetcher, minP, maxP);
        } else if (currentPairObj.code === 'DXY' || currentPairObj.provider === 'DXY') {"""
    fx_branch = fx_branch.replace('\\u00b7', '\u00b7')
    t = t.replace(dxy_branch_start, fx_branch, 1)
    print('inserted FX/SPOT/SEED branch')
else:
    print('FX branch already present')

if t == orig:
    print('no changes')
    sys.exit(0)

p.write_text(t, encoding='utf-8')
print('size', p.stat().st_size)
assert "provider: 'FX'" in t
assert 'fetchGoldApiSpot' in t
assert 'fetchFxSpot' in t
assert 'KASUSDT' not in t or t.count("code: 'KASUSDT'") == 0
print('ok')
