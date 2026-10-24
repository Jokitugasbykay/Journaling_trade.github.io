#!/usr/bin/env python3
"""Patch js/pro.js so DXY does not use USD/EUR (~0.92) live prices."""
from pathlib import Path
import re
import sys

p = Path('js/pro.js')
t = p.read_text(encoding='utf-8')

old_inst = "{ code: 'DXY', name: 'US Dollar Index Context', cat: 'INDICES', provider: 'CC', fsym: 'USD', tsym: 'EUR', tvSym: 'TVC:DXY', ccy: ['USD', 'EUR'] },"
new_inst = "{ code: 'DXY', name: 'US Dollar Index Context', cat: 'INDICES', provider: 'DXY', fsym: 'USD', tsym: 'EUR', tvSym: 'TVC:DXY', ccy: ['USD', 'EUR'] },"
if old_inst not in t:
    if "provider: 'DXY'" in t and 'fetchApproxDXYPrice' in t:
        print('already patched')
        sys.exit(0)
    raise SystemExit('DXY instrument line not found')
t = t.replace(old_inst, new_inst, 1)

marker = '  async function fetchForexOrMetalCC(fsym, tsym, tf, limit = 500, signal = null) {'
if marker not in t:
    raise SystemExit('fetchForexOrMetalCC marker missing')

if 'async function fetchApproxDXYPrice' not in t:
    helpers = r'''
  /** Approximate ICE DXY from major FX (CORS-friendly). Not 1:1 with futures print. */
  async function fetchApproxDXYPrice(signal = null) {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: signal || undefined });
      if (!res.ok) return null;
      const data = await res.json();
      const r = data.rates || {};
      const eurusd = r.EUR ? (1 / Number(r.EUR)) : NaN;
      const usdjpy = Number(r.JPY);
      const gbpusd = r.GBP ? (1 / Number(r.GBP)) : NaN;
      const usdcad = Number(r.CAD);
      const usdsek = Number(r.SEK);
      const usdchf = Number(r.CHF);
      if (![eurusd, usdjpy, gbpusd, usdcad, usdsek, usdchf].every((x) => Number.isFinite(x) && x > 0)) return null;
      const dxy = 50.14348112
        * Math.pow(eurusd, -0.576)
        * Math.pow(usdjpy, 0.136)
        * Math.pow(gbpusd, -0.119)
        * Math.pow(usdcad, 0.091)
        * Math.pow(usdsek, 0.042)
        * Math.pow(usdchf, 0.036);
      return +dxy.toFixed(3);
    } catch (_) {
      return null;
    }
  }

  async function fetchDXYCandles(tf, limit = 500, signal = null) {
    const stepSec = tfToSeconds(tf);
    const live = await fetchApproxDXYPrice(signal);
    const base = (live && live > 50 && live < 200) ? live : (SEED_PRICES.DXY || 104.2);
    return generateFallbackCandles(base, Math.min(limit, 500), stepSec);
  }

  function startDxyLiveTicker() {
    activeFeedInfo.textContent = 'Feed: DXY Approx (majors basket \u00b7 16:9)';
    const feedLabel = document.getElementById('feedSourceLabel');
    if (feedLabel) {
      feedLabel.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:-1px;margin-right:3px"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> STREAM: DXY APPROX (MAJORS)';
    }
    pollInterval = setInterval(async () => {
      try {
        const livePrice = await fetchApproxDXYPrice();
        if (!livePrice || currentCandles.length === 0) return;
        if (livePrice < 50 || livePrice > 200) return;
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
    t = t.replace(marker, helpers + marker, 1)

old_cc = """        } else {
          const fsym = currentPairObj.fsym || 'USD';
          const tsym = currentPairObj.tsym || 'EUR';
          activeFeedInfo.textContent = 'Feed: Forex/Spot (' + fsym + '/' + tsym + ' \u00b7 500 Bars \u00b7 16:9)';"""

# pro.js may use either unicode middle-dot or ascii
patterns = [
    old_cc,
    old_cc.replace('\u00b7', '·'),
    """        } else {
          const fsym = currentPairObj.fsym || 'USD';
          const tsym = currentPairObj.tsym || 'EUR';
          activeFeedInfo.textContent = 'Feed: Forex/Spot (' + fsym + '/' + tsym + ' · 500 Bars · 16:9)';""",
]

new_cc = """        } else if (currentPairObj.code === 'DXY' || currentPairObj.provider === 'DXY') {
          activeFeedInfo.textContent = 'Feed: DXY Approx (majors basket · 500 Bars · 16:9)';
          const [activeData, h1Data, h4Data, d1Data] = await Promise.all([
            fetchDXYCandles(selectedFrame, 500, controller.signal),
            fetchDXYCandles('1h', 500, controller.signal),
            fetchDXYCandles('4h', 500, controller.signal),
            fetchDXYCandles('1d', 500, controller.signal)
          ]);
          applyLoadedCandles(activeData, h1Data, h4Data, d1Data);
          startDxyLiveTicker();
        } else {
          const fsym = currentPairObj.fsym || 'USD';
          const tsym = currentPairObj.tsym || 'EUR';
          activeFeedInfo.textContent = 'Feed: Forex/Spot (' + fsym + '/' + tsym + ' · 500 Bars · 16:9)';"""

replaced = False
for pat in patterns:
    if pat in t and 'fetchDXYCandles(selectedFrame' not in t:
        t = t.replace(pat, new_cc, 1)
        replaced = True
        break

if not replaced and 'fetchDXYCandles(selectedFrame' not in t:
    # regex fallback
    m = re.search(
        r"\} else \{\s*const fsym = currentPairObj\.fsym \|\| 'USD';\s*const tsym = currentPairObj\.tsym \|\| 'EUR';\s*activeFeedInfo\.textContent = 'Feed: Forex/Spot ' \+ fsym \+ '/' \+ tsym \+ ' . 500 Bars . 16:9';",
        t,
    )
    if not m:
        idx = t.find('Feed: Forex/Spot')
        print('context:', repr(t[idx-80:idx+120]) if idx >= 0 else 'missing')
        raise SystemExit('CC branch start not found')
    t = t[:m.start()] + new_cc + t[m.end():]
    replaced = True

p.write_text(t, encoding='utf-8')
print('size', p.stat().st_size)
assert 'fetchApproxDXYPrice' in t
assert 'startDxyLiveTicker' in t
assert "provider: 'DXY'" in t
print('ok')
