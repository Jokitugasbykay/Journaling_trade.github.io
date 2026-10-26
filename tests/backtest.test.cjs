const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Maulana Riski/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.join(__dirname, '..');
let historyEnabled=false,historyCalls=0;
const historyRows=Array.from({length:2000},(_,i)=>({time:Date.parse('2024-01-08T08:00:00Z')/1000+i*60,open:2000,high:2001,low:1999,close:2000}));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/v1/')) {
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname.includes('/entitlements')) return res.end(JSON.stringify({ plan: 'pro', effective_until: '2099-01-01T00:00:00Z', ai: { remaining: 30, limit: 30 } }));
    if (url.pathname.includes('/accounts')) return res.end(JSON.stringify({ items: [{ id: '111', name: 'Trading' }] }));
    if (url.pathname.includes('/strategies')) return res.end(JSON.stringify({ items: [{ id: '222', name: 'Kaystrade Breakout', description: 'Breakout setup' }] }));
    if (url.pathname.includes('/market/preference')) return res.end(JSON.stringify({ trading_style: 'INTRADAY' }));
    if (url.pathname.includes('/market/history')) {historyCalls++;if(!historyEnabled){res.statusCode=503;return res.end(JSON.stringify({detail:'Fixture history unavailable'}));}return res.end(JSON.stringify({instrument:url.searchParams.get('instrument'),timeframe:url.searchParams.get('timeframe'),candles:historyRows,has_more:false}));}
    if (url.pathname.includes('/market/instruments')) return res.end(JSON.stringify({ items: [{ symbol: 'XAUUSD', name: 'Gold', timeframes: ['15m', '4h'] }] }));
    if (url.pathname.includes('/market/signals')) return res.end(JSON.stringify({ items: [] }));
    if (url.pathname.includes('/market/alerts')) return res.end(JSON.stringify({ items: [] }));
    if (url.pathname.includes('/market/notifications')) return res.end(JSON.stringify({ items: [] }));
    if (url.pathname.includes('/news')) return res.end(JSON.stringify({ items: [] }));
    return res.end(JSON.stringify({ status: 'ok' }));
  }
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="/css/pro.css">
</head>
<body>
  <main><section class="pro-workspace active" id="view-pro-workspace"></section></main>
  <script src="/js/pro-import.js"></script>
  <script src="/js/market-history.js"></script>
  <script src="/js/pro.js"></script>
  <script>
    JTPRO.configure({ apiBase: location.origin, getToken: async () => 'test-token', getUserId: () => 'test-user' });
  </script>
</body>
</html>`);
  }
  const file = path.resolve(root, '.' + url.pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'application/javascript');
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.route('https://data-api.binance.vision/**',route=>route.abort());
    await page.route('https://api.binance.com/**',route=>route.abort());
    await page.goto('http://127.0.0.1:' + port + '/');

    await page.evaluate(() => {
      window.backtestFixture = Array.from({length:160}, (_,i) => {
        const close=2000+i*0.05;
        return {time:Date.parse('2024-01-08T08:00:00Z')/1000+i*60,open:close-0.02,high:close+0.1,low:close-0.1,close};
      });
    });
    // 1. Explicit transport fixtures only; missing history must never be invented.
    const engineResult = await page.evaluate(() => {
      return JTPRO.runKaystradeBacktestEngine(window.backtestFixture, {
        instrument: 'XAUUSD',
        timeframe: '1m',
        tradingStyle: 'INTRADAY',
        initialBalance: 1000,
        riskPercent: 2,
        targetRR: 2.5
      });
    });

    assert.equal(engineResult.initialBalance, 1000);
    assert.equal(engineResult.instrument, 'XAUUSD');
    assert.equal(engineResult.maxDrawdownLimit, 30.0, 'GOLD max drawdown limit should be 30% according to SKILL.md Bagian IV.2');
    assert.ok(typeof engineResult.winRate === 'number');
    assert.ok(typeof engineResult.profitFactor === 'number');
    assert.ok(typeof engineResult.finalEquity === 'number');
    assert.ok(engineResult.equityCurve.length > 0, 'Equity curve must contain data points');
    console.log('Engine test passed! WinRate: ' + engineResult.winRate + '%, Total Trades: ' + engineResult.totalTrades + ', Final: $' + engineResult.finalEquity);

    // 2. Forex / Crypto Max Drawdown Limit verification (20%)
    const fxResult = await page.evaluate(() => {
      return JTPRO.runKaystradeBacktestEngine(window.backtestFixture, {
        instrument: 'EURUSD',
        timeframe: '1m',
        tradingStyle: 'INTRADAY'
      });
    });
    assert.equal(fxResult.maxDrawdownLimit, 20.0, 'Forex max drawdown limit should be 20% according to SKILL.md Bagian IV.2');
    console.log('Forex drawdown limit check passed (20.0%)');

    // Valid explicit fixture history renders actual sample coverage without full-method claims.
    await page.evaluate(() => JTPRO.openBacktestModal({pair:'XAUUSD',timeframe:'1m',candles:window.backtestFixture}));
    await page.waitForFunction(()=>document.querySelector('.backtest-modal-sub').textContent.includes('Backtest parsial'));
    assert.ok((await page.locator('.backtest-modal-sub').textContent()).includes('Backtest parsial'));
    assert.ok(!(await page.locator('.backtest-modal-sub').textContent()).includes('7/7'));
    assert.equal(await page.locator('#btCopyReportBtn').isEnabled(), true);
    await page.locator('#btCloseBottomBtn').click();

    // 3. UI test: open ai-market and verify Backtest button exists in actionGrid
    await page.evaluate(() => JTPRO.open('ai-market'));
    await page.waitForSelector('#pro-btn-backtest');
    assert.ok(await page.locator('#pro-btn-backtest').isVisible(), 'Backtest button should be visible in actionGrid');

    // 4. Click Backtest button and verify modal opens
    await page.locator('#pro-btn-backtest').click();
    await page.waitForSelector('#backtestModalBackdrop');
    assert.ok(await page.locator('.backtest-modal-dialog').isVisible(), 'Backtest modal dialog should appear');
    await page.waitForFunction(()=>!document.querySelector('#btRunBtn').disabled);
    assert.ok((await page.locator('#backtestModalBackdrop').textContent()).includes('Backtest belum tersedia'), 'Missing real feed must display an unavailable state');
    assert.equal(await page.locator('#btCopyReportBtn').isDisabled(), true);
    assert.ok(await page.locator('#btStatWinRate').isVisible(), 'Win Rate stat card should be visible');
    assert.ok(await page.locator('#btStatTrades').isVisible(), 'Total Trades stat card should be visible');
    assert.ok(await page.locator('#btStatProfit').isVisible(), 'Net profit stat card should be visible');
    assert.ok(await page.locator('#btStatPF').isVisible(), 'Profit factor stat card should be visible');
    assert.ok(await page.locator('#btStatDD').isVisible(), 'Max Drawdown stat card should be visible');
    assert.ok(await page.locator('#btStatEquity').isVisible(), 'Final Equity stat card should be visible');

    // 5. Test changing parameters and re-running backtest in modal
    await page.locator('#btInstrumentSelect').selectOption('BTCUSDT');
    await page.locator('#btStyleSelect').selectOption('SCALPING');
    await page.locator('#btRunBtn').click();
    await page.waitForTimeout(300);

    await page.waitForFunction(()=>!document.querySelector('#btRunBtn').disabled);
    assert.ok((await page.locator('#backtestModalBackdrop').textContent()).includes('Backtest belum tersedia'), 'Switching instruments must not reuse unrelated candle history');
    assert.equal(await page.locator('#btCopyReportBtn').isDisabled(), true);

    // A fresh rerun must request the current selection, not the modal's original array.
    historyEnabled=true;
    await page.evaluate(()=>{document.querySelector('#btTimeframeSelect').value='1m';document.querySelector('#btPeriodSelect').value='2000_BARS';});
    await page.locator('#btRunBtn').click();
    await page.waitForFunction(()=>!document.querySelector('#btRunBtn').disabled);
    assert.equal(await page.locator('#btCopyReportBtn').isEnabled(),true);
    assert.ok((await page.locator('#btStatTrades').textContent())!=='—');
    const beforeRerun=historyCalls;
    await page.locator('#btRunBtn').click();await page.waitForFunction(()=>!document.querySelector('#btRunBtn').disabled);
    assert.ok(historyCalls>beforeRerun,'Rerun must reload history');
    const csv='time,open,high,low,close\n'+historyRows.map(r=>[r.time,r.open,r.high,r.low,r.close].join(',')).join('\n');
    await page.locator('#btHistoryFile').setInputFiles({name:'ohlc-2024.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
    await page.waitForFunction(()=>!document.querySelector('#btRunBtn').disabled&&document.querySelector('#btCopyReportBtn').disabled===false);
    assert.ok((await page.locator('.backtest-modal-sub').textContent()).includes('2024'));
    assert.ok((await page.locator('#backtestModalBackdrop').textContent()).includes('CSV pengguna'));

    // 6. Test modal close
    await page.locator('#btCloseBottomBtn').click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#backtestModalBackdrop').count(), 0, 'Modal should close after clicking close button');

    // 7. Test strategyComparison view: Backtest button in strategies table
    await page.evaluate(() => JTPRO.open('strategies'));
    await page.waitForSelector('table');
    const stratBtBtn = page.getByRole('button', { name: 'Backtest' }).first();
    assert.ok(await stratBtBtn.isVisible(), 'Backtest button should exist in strategy comparison table');
    await stratBtBtn.click();
    await page.waitForSelector('#backtestModalBackdrop');
    assert.ok((await page.locator('#backtestModalBackdrop').textContent()).includes('Kaystrade Breakout'), 'Modal should reflect strategy name');
    await page.locator('#btCloseBottomBtn').click();

    await page.evaluate(()=>JTPRO.openBacktestModal({pair:'BTCUSDT',timeframe:'1m'}));
    await page.waitForSelector('#backtestModalBackdrop');
    await page.evaluate(()=>JTPRO.reset());
    assert.equal(await page.locator('#backtestModalBackdrop').count(),0,'Account reset must close and cancel the historical job');

    console.log('Backtest engine, rerun, 2000 bars, CSV 2024, strategy entry and account cancellation passed using explicit fixtures.');
    await browser.close();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    await browser.close();
    server.close();
    process.exit(1);
  }
})();
