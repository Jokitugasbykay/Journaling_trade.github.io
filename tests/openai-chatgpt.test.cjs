const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Maulana Riski/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.join(__dirname, '..');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/v1/')) {
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/api/v1/entitlements') return res.end(JSON.stringify({ plan: 'pro', effective_until: '2099-01-01T00:00:00Z', ai: { remaining: 30, limit: 30 } }));
      if (url.pathname === '/api/v1/market/preference') return res.end(JSON.stringify({ trading_style: 'INTRADAY' }));
      if (url.pathname === '/api/v1/market/instruments') return res.end(JSON.stringify({ items: [{ symbol: 'XAUUSD', name: 'Gold', asset_class: 'Metals', tradingview_symbol: 'TVC:GOLD', timeframes: ['15m', '1h', '4h'] }] }));
      if (url.pathname === '/api/v1/market/context') return res.end(JSON.stringify({ instrument: 'XAUUSD', timeframe: '15m', current_price: '2650.50', as_of: '2026-10-14T00:00:00Z', provider: 'Live Feeds' }));
      if (url.pathname === '/api/v1/analytics/overview') return res.end(JSON.stringify({ metrics: { expectancy: '15', profit_factor: '2.1', maximum_drawdown: '12', average_risk_reward: '2.4', win_rate: '65%' } }));
      if (url.pathname === '/api/v1/ai/engine') return res.end(JSON.stringify({ status: 'ready', available: true, provider: 'OpenAI Test' }));
      if (url.pathname === '/api/v1/ai/history') return res.end(JSON.stringify({ items: [] }));
      if (url.pathname === '/api/v1/ai/chat/history') return res.end(JSON.stringify({ items: [] }));
      return res.end(JSON.stringify({ ok: true }));
    }
    if (url.pathname === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/pro.css"></head><body><main><section class="pro-workspace active" id="view-pro-workspace"></section></main><script src="/js/pro.js"></script><script>JTPRO.configure({apiBase:location.origin,getToken:async()=>"openai-test-token",getUserId:()=>"openai-user"});</script></body></html>');
    }
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8');
    res.end(fs.readFileSync(file));
  } catch (e) {
    res.statusCode = 500;
    res.end(e.message);
  }
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const openAiRequests = [];
  let openAiMockResponse = {
    id: 'chatcmpl-test12345',
    object: 'chat.completion',
    created: 1729000000,
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: `### Analisis Pasar Kaystrade (XAUUSD M15) - OpenAI GPT-4o\n\n| Parameter | Nilai |\n|---|---|\n| Bias Arah | **BUY** |\n| Status Setup | CONFIRMED |\n| Entry Level | 2650.00 |\n| Stop Loss | 2642.00 |\n| Take Profit | 2666.00 |\n| Risk:Reward | 1:2 |\n\n#### Konfirmasi Teknikal Kaystrade\n- **Big Trend H4**: Bullish continuation (HH/HL terkonfirmasi).\n- **Struktur H1**: Break of Structure (BOS) bullish di 2648.50.\n- **Eksekusi M15**: Rejection pada fresh Demand base 2649.00 - 2651.00 disertai imbalance FVG.\n- **RSI(14)**: Rebound dari level 45 cross naik SMA(14).\n\n> **Kondisi Invalidasi**: Setup batal jika candle H1 close di bawah swing low 2642.00.`
        },
        finish_reason: 'stop'
      }
    ]
  };
  let openAiStatus = 200;

  await page.route('https://api.openai.com/v1/chat/completions', async route => {
    const req = route.request();
    openAiRequests.push({
      url: req.url(),
      method: req.method(),
      headers: req.headers(),
      postData: req.postDataJSON()
    });
    if (openAiStatus === 429) {
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'You exceeded your current quota', type: 'insufficient_quota' } })
      });
    }
    if (openAiStatus === 401) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Incorrect API key provided', type: 'invalid_request_error' } })
      });
    }
    return route.fulfill({
      status: openAiStatus,
      contentType: 'application/json',
      body: JSON.stringify(openAiMockResponse)
    });
  });

  await page.route('https://s.tradingview.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Mock Chart</p>' }));

  await page.goto('http://127.0.0.1:' + port + '/');

  // Suite 1: Test Banned Models Regex & Protection
  const bannedCheck = await page.evaluate(() => {
    const banned = [
      'GPT 6- Astra',
      'GPT-6.1 Sol',
      'GPT 6-SOL',
      'GPT 5.6 SOL',
      'GPT 5.6 Terra',
      'GPT 6.1 Astra',
      'gpt-6',
      'gpt 6',
      'gpt-5.6',
      'astra-v1',
      'sol-fast',
      'terra-pro'
    ];
    const allowed = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'];

    const bannedResults = banned.map(m => ({ model: m, blocked: JTPRO.isBannedAiModel(m) }));
    const allowedResults = allowed.map(m => ({ model: m, blocked: JTPRO.isBannedAiModel(m) }));

    return { bannedResults, allowedResults };
  });

  for (const b of bannedCheck.bannedResults) {
    assert.equal(b.blocked, true, `Model "${b.model}" MUST be blocked!`);
  }
  for (const a of bannedCheck.allowedResults) {
    assert.equal(a.blocked, false, `Model "${a.model}" must be allowed!`);
  }

  // Suite 2: Test callOpenAiApi throws on banned model
  const callBannedError = await page.evaluate(async () => {
    JTPRO.setOpenAiApiKey('sk-proj-testKey123');
    try {
      await JTPRO.callOpenAiApi({ contents: 'test', model: 'GPT 6- Astra' });
      return null;
    } catch (e) {
      return e.message;
    }
  });
  assert.ok(callBannedError && callBannedError.includes('dilarang untuk digunakan'), 'Banned model call must throw rejection');

  // Suite 3: Test OpenAI Key Storage, Auto-Detection & Provider Resolution
  await page.evaluate(() => {
    localStorage.clear();
  });
  assert.equal(await page.evaluate(() => JTPRO.hasOpenAiApiKey()), false);
  assert.equal(await page.evaluate(() => JTPRO.hasGeminiApiKey()), false);

  // Set OpenAI Key explicitly
  await page.evaluate(() => JTPRO.setOpenAiApiKey('sk-proj-1234567890abcdef'));
  assert.equal(await page.evaluate(() => JTPRO.getOpenAiApiKey()), 'sk-proj-1234567890abcdef');
  assert.equal(await page.evaluate(() => JTPRO.hasOpenAiApiKey()), true);
  assert.equal(await page.evaluate(() => JTPRO.hasGeminiApiKey()), true); // backward compatible
  assert.equal(await page.evaluate(() => JTPRO.getActiveAiProvider()), 'openai');

  // Test Auto-Detection when pasted into setGeminiApiKey
  await page.evaluate(() => {
    localStorage.clear();
    JTPRO.setGeminiApiKey('sk-antigravityKey999');
  });
  assert.equal(await page.evaluate(() => JTPRO.getOpenAiApiKey()), 'sk-antigravityKey999');
  assert.equal(await page.evaluate(() => JTPRO.getActiveAiProvider()), 'openai');

  // Suite 4: Test Modal UI for ChatGPT (OpenAI)
  await page.evaluate(() => JTPRO.open('ai-market'));
  await page.evaluate(() => JTPRO.openGeminiConfigModal());
  await page.waitForSelector('#pro-gemini-modal');

  // Click ChatGPT (OpenAI) tab
  await page.click('button:has-text("ChatGPT (OpenAI)")');
  const modalTitle = await page.locator('#pro-gemini-modal-title').textContent();
  assert.ok(modalTitle.includes('ChatGPT (OpenAI) API Configuration'));

  // Enter new OpenAI key
  await page.fill('#pro-gemini-api-key-input', 'sk-proj-superSecretLiveKey');
  await page.click('#pro-gemini-save-btn');
  await page.waitForSelector('.pro-modal-status.success');
  const successText = await page.locator('.pro-modal-status.success').textContent();
  assert.ok(successText.includes('ChatGPT (OpenAI) API Key berhasil disimpan'));

  // Check saved key
  assert.equal(await page.evaluate(() => localStorage.getItem('openai_api_key')), 'sk-proj-superSecretLiveKey');
  assert.equal(await page.evaluate(() => JTPRO.getActiveAiProvider()), 'openai');

  // Check AI Engine Status Card reflects ChatGPT
  await page.waitForSelector('.pro-engine-status-badge');
  const engineText = await page.locator('.pro-panel:has-text("AI engine status")').textContent();
  assert.ok(engineText.includes('available: true (ChatGPT Connected)'));
  assert.ok(engineText.includes('OpenAI API (gpt-4o)'));

  // Suite 5: Test Execution of AI Market Intelligence via OpenAI GPT-4o
  await page.waitForSelector('#pro-gemini-modal', { state: 'detached' });
  await page.waitForSelector('#pro-ai-generate:not([disabled])');
  await page.click('#pro-ai-generate');
  await page.waitForSelector('.pro-markdown');
  const marketResultText = await page.locator('.pro-panel:has-text("AI entry signal")').textContent();
  assert.ok(marketResultText.includes('Analisis Pasar Kaystrade'));
  assert.ok(marketResultText.includes('OpenAI GPT-4o'));

  // Verify request sent to OpenAI
  assert.ok(openAiRequests.length > 0);
  const lastMarketReq = openAiRequests[openAiRequests.length - 1];
  assert.equal(lastMarketReq.method, 'POST');
  assert.equal(lastMarketReq.headers['authorization'], 'Bearer sk-proj-superSecretLiveKey');
  assert.equal(lastMarketReq.postData.model, 'gpt-4o');
  assert.equal(lastMarketReq.postData.messages[0].role, 'system');
  assert.ok(lastMarketReq.postData.messages[0].content.includes('Kaystrade'));

  // Suite 6: Test Kayla AI Chat via OpenAI GPT-4o
  openAiMockResponse = {
    id: 'chatcmpl-chatturn1',
    object: 'chat.completion',
    created: 1729000100,
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'Halo! Sebagai Asisten AI Trading, saya siap membantu pemetaan Support Become Resistance (SBR) dan manajemen lot Anda.'
        },
        finish_reason: 'stop'
      }
    ]
  };
  await page.evaluate(() => JTPRO.open('ai-chat'));
  await page.fill('#pro-ai-chat-message', 'Halo Kayla AI, jelaskan validasi SBR!');
  await page.click('#pro-ai-chat-send');
  await page.waitForSelector('.pro-chat-message[data-role="assistant"] .pro-markdown');
  const chatBubbleText = await page.locator('.pro-chat-message[data-role="assistant"]').textContent();
  assert.ok(chatBubbleText.includes('Support Become Resistance (SBR)'));

  const lastChatReq = openAiRequests[openAiRequests.length - 1];
  assert.equal(lastChatReq.headers['authorization'], 'Bearer sk-proj-superSecretLiveKey');
  assert.equal(lastChatReq.postData.model, 'gpt-4o');
  assert.equal(lastChatReq.postData.messages[0].role, 'system');
  assert.ok(lastChatReq.postData.messages[0].content.includes('Asisten AI Trading'));
  assert.equal(lastChatReq.postData.messages[1].role, 'user');
  assert.equal(lastChatReq.postData.messages[1].content, 'Halo Kayla AI, jelaskan validasi SBR!');

  // Suite 7: Test Rate Limit 429 Error Handling
  openAiStatus = 429;
  await page.evaluate(() => JTPRO.open('ai-journal'));
  await page.click('#pro-ai-generate');
  await page.waitForSelector('.pro-modal-status.error, [role="alert"]');
  const error429Text = await page.locator('#view-pro-workspace').textContent();
  assert.ok(error429Text.includes('kuota kayla telah habis atau dibatasi'));

  // Suite 8: Test 401 Invalid Key Error Handling
  openAiStatus = 401;
  await page.evaluate(() => JTPRO.open('ai-behaviour'));
  await page.click('#pro-ai-generate');
  await page.waitForSelector('.pro-modal-status.error, [role="alert"]');
  const error401Text = await page.locator('#view-pro-workspace').textContent();
  assert.ok(error401Text.includes('OpenAI / ChatGPT API Key tidak valid'));

  await browser.close();
  server.close();
  console.log('All 8 OpenAI ChatGPT integration test suites passed successfully!');
})().catch(err => {
  console.error(err);
  server.close();
  process.exit(1);
});
