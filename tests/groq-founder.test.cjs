const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Maulana Riski/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.join(__dirname, '..');

let isCurrentUserFounder = false;
let backendFounderKey = 'gsk_secretFounderLiveKey9988';
let backendFounderStatus = 'Connected';
let backendFallbackEnabled = true;
const serverProxyCalls = [];

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/v1/')) {
      res.setHeader('Content-Type', 'application/json');

      if (url.pathname === '/api/v1/entitlements') {
        return res.end(JSON.stringify({
          plan: 'pro',
          founder: isCurrentUserFounder,
          effective_until: '2099-01-01T00:00:00Z',
          ai: { remaining: 30, limit: 30 }
        }));
      }

      // 1. Groq Public Status
      if (url.pathname === '/api/v1/groq/status' && req.method === 'GET') {
        const available = Boolean(backendFounderKey && backendFounderStatus === 'Connected');
        return res.end(JSON.stringify({
          available,
          default_provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          fallback_enabled: backendFallbackEnabled,
          status: available ? 'Connected' : 'Not Configured'
        }));
      }

      // 2. Groq Chat Proxy (Founder AI Default)
      if (url.pathname === '/api/v1/groq/chat' && req.method === 'POST') {
        let rawBody = '';
        req.on('data', chunk => { rawBody += chunk; });
        await new Promise(resolve => req.on('end', resolve));
        const parsed = JSON.parse(rawBody || '{}');
        serverProxyCalls.push({ route: '/groq/chat', body: parsed });

        if (!backendFounderKey) {
          res.statusCode = 503;
          return res.end(JSON.stringify({ error: 'Layanan Groq AI bawaan belum dikonfigurasi oleh Founder.' }));
        }

        if (backendFounderStatus === 'Rate Limited') {
          res.statusCode = 429;
          return res.end(JSON.stringify({ error: 'Terlalu banyak permintaan AI. Kuota rate limit Founder tercapai.' }));
        }

        return res.end(JSON.stringify({
          id: 'chatcmpl-groq-proxy-1',
          object: 'chat.completion',
          model: parsed.model || 'llama-3.3-70b-versatile',
          choices: [{
            message: {
              role: 'assistant',
              content: '### Analisis Pasar Kaystrade (Groq Bawaan Gratis)\nBias: BUY\nLevel Entry: 2650.00\nStop Loss: 2642.00\nTake Profit: 2666.00'
            }
          }]
        }));
      }

      // 3. Founder Management Endpoints (Requires true backend verification)
      if (url.pathname.startsWith('/api/v1/founder/')) {
        // Strict verification: check if authenticated user session is truly founder
        if (!isCurrentUserFounder) {
          res.statusCode = 403;
          return res.end(JSON.stringify({ error: 'Forbidden: Akses khusus Founder.' }));
        }

        if (url.pathname === '/api/v1/founder/groq-config') {
          if (req.method === 'GET') {
            return res.end(JSON.stringify({
              configured: Boolean(backendFounderKey),
              masked_key: backendFounderKey ? 'gsk_...' + backendFounderKey.slice(-4) : '',
              model: 'llama-3.3-70b-versatile',
              fallback_enabled: backendFallbackEnabled,
              status: backendFounderStatus,
              last_tested_at: new Date().toISOString()
            }));
          }
          if (req.method === 'POST') {
            let rawBody = '';
            req.on('data', chunk => { rawBody += chunk; });
            await new Promise(resolve => req.on('end', resolve));
            const data = JSON.parse(rawBody || '{}');
            if (data.api_key) backendFounderKey = data.api_key.trim();
            if (typeof data.fallback_enabled === 'boolean') backendFallbackEnabled = data.fallback_enabled;
            backendFounderStatus = 'Connected';
            return res.end(JSON.stringify({
              configured: Boolean(backendFounderKey),
              masked_key: backendFounderKey ? 'gsk_...' + backendFounderKey.slice(-4) : '',
              model: 'llama-3.3-70b-versatile',
              fallback_enabled: backendFallbackEnabled,
              status: backendFounderStatus
            }));
          }
          if (req.method === 'DELETE') {
            backendFounderKey = '';
            backendFounderStatus = 'Not Configured';
            return res.end(JSON.stringify({ ok: true, message: 'Founder Groq API Key telah dihapus' }));
          }
        }

        if (url.pathname === '/api/v1/founder/groq-test' && req.method === 'POST') {
          let rawBody = '';
          req.on('data', chunk => { rawBody += chunk; });
          await new Promise(resolve => req.on('end', resolve));
          const data = JSON.parse(rawBody || '{}');
          const keyToTest = data.api_key || backendFounderKey;
          if (!keyToTest) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ ok: false, status: 'Not Configured', message: 'Tidak ada API Key untuk diuji.' }));
          }
          return res.end(JSON.stringify({ ok: true, status: 'Connected', latency_ms: 85, message: 'Koneksi ke Groq API berhasil (85ms).' }));
        }
      }

      if (url.pathname === '/api/v1/market/preference') return res.end(JSON.stringify({ trading_style: 'INTRADAY' }));
      if (url.pathname === '/api/v1/market/instruments') return res.end(JSON.stringify({ items: [{ symbol: 'XAUUSD', name: 'Gold', asset_class: 'Metals', tradingview_symbol: 'TVC:GOLD', timeframes: ['15m', '1h', '4h'] }] }));
      if (url.pathname === '/api/v1/market/context') return res.end(JSON.stringify({ instrument: 'XAUUSD', timeframe: '15m', current_price: '2650.50', as_of: '2026-10-14T00:00:00Z', provider: 'Live Feeds' }));
      if (url.pathname === '/api/v1/analytics/overview') return res.end(JSON.stringify({ metrics: { expectancy: '15', win_rate: '65%' } }));
      if (url.pathname === '/api/v1/ai/engine') return res.end(JSON.stringify({ status: 'ready', available: true, provider: 'Groq Test' }));
      if (url.pathname === '/api/v1/ai/history') return res.end(JSON.stringify({ items: [] }));
      if (url.pathname === '/api/v1/ai/chat/history') return res.end(JSON.stringify({ items: [] }));
      if (url.pathname === '/api/v1/news/filters') return res.end(JSON.stringify({ countries: ['US'], regions: ['Global'], categories: ['Forex'] }));
      if (url.pathname.startsWith('/api/v1/news')) return res.end(JSON.stringify({ items: [] }));
      return res.end(JSON.stringify({ ok: true }));
    }

    if (url.pathname === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/pro.css"></head><body><main><section class="pro-workspace active" id="view-pro-workspace"></section></main><script src="/js/pro.js"></script><script>JTPRO.configure({apiBase:location.origin,getToken:async()=>"groq-test-token",getUserId:()=>"groq-test-user"});</script></body></html>');
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

  const directGroqCalls = [];
  let directGroqStatus = 200;

  // Intercept direct calls to api.groq.com
  await page.route('https://api.groq.com/**', async route => {
    const req = route.request();
    const authHeader = req.headers()['authorization'] || '';
    directGroqCalls.push({
      url: req.url(),
      method: req.method(),
      auth: authHeader,
      body: req.postDataJSON()
    });

    if (directGroqStatus === 401) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Invalid API Key', type: 'invalid_request_error' } })
      });
    }

    if (directGroqStatus === 429) {
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } })
      });
    }

    if (req.url().includes('/models')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [{ id: 'llama-3.3-70b-versatile' }] })
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'chatcmpl-direct-groq-1',
        object: 'chat.completion',
        model: 'llama-3.3-70b-versatile',
        choices: [{
          message: {
            role: 'assistant',
            content: 'Response from Personal Groq API directly.'
          }
        }]
      })
    });
  });

  // Intercept Gemini API
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Response from Google Gemini' }] } }]
      })
    });
  });

  // Intercept OpenAI API
  await page.route('https://api.openai.com/**', async route => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'chatcmpl-openai-1',
        choices: [{ message: { role: 'assistant', content: 'Response from ChatGPT OpenAI' } }]
      })
    });
  });

  console.log('--- SUITE 1: Pengguna tanpa Personal API Key menggunakan Founder API bawaan ---');
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => {
    localStorage.clear();
    JTPRO.reset();
  });

  // Call callAiApi when no keys exist in localStorage
  serverProxyCalls.length = 0;
  const replyDefault = await page.evaluate(async () => {
    return await JTPRO.callAiApi({ contents: 'Analisa XAUUSD M15' });
  });
  assert.ok(replyDefault.includes('Groq Bawaan Gratis'), 'Harus menerima respon dari Founder Groq bawaan');
  assert.equal(serverProxyCalls.length, 1, 'Harus memanggil proxy /groq/chat server');
  assert.equal(directGroqCalls.length, 0, 'Tidak boleh memanggil api.groq.com langsung tanpa personal key');
  console.log('Test 1 Passed: Pengguna tanpa key berhasil memakai AI bawaan melalui server proxy');

  console.log('--- SUITE 2: Pengguna dengan Personal API Key menggunakan key miliknya ---');
  await page.evaluate(() => {
    JTPRO.setPersonalGroqApiKey('gsk_myPersonalSecretKey123');
    JTPRO.setAiProviderPreference('groq');
  });
  assert.equal(await page.evaluate(() => JTPRO.hasPersonalGroqApiKey()), true);

  directGroqCalls.length = 0;
  serverProxyCalls.length = 0;
  const replyPersonal = await page.evaluate(async () => {
    return await JTPRO.callAiApi({ contents: 'Analisa EURUSD H1' });
  });
  assert.equal(replyPersonal, 'Response from Personal Groq API directly.');
  assert.equal(directGroqCalls.length, 1, 'Harus memanggil direct Groq API');
  assert.equal(directGroqCalls[0].auth, 'Bearer gsk_myPersonalSecretKey123', 'Harus menggunakan bearer personal key');
  assert.equal(serverProxyCalls.length, 0, 'Tidak boleh memanggil proxy backend saat personal key aktif');
  console.log('Test 2 Passed: Personal key diprioritaskan dan langsung dipanggil ke Groq');

  console.log('--- SUITE 3: Pengguna biasa tidak dapat mengakses Founder API Management ---');
  isCurrentUserFounder = false;
  await page.evaluate(async () => {
    await JTPRO.open('global-news');
  });
  const founderPanelRegular = await page.$('.pro-founder-panel');
  assert.equal(founderPanelRegular, null, 'Panel Founder TIDAK boleh tampil untuk pengguna biasa');

  // Direct backend call without founder authorization returns 403
  const forbiddenCheck = await page.evaluate(async () => {
    try {
      await JTPRO.request('/founder/groq-config');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  assert.equal(forbiddenCheck.ok, false, 'Backend harus menolak request founder dari user biasa');
  assert.ok(forbiddenCheck.error.includes('Forbidden') || forbiddenCheck.error.includes('Founder'), 'Pesan error harus Forbidden');
  console.log('Test 3 Passed: Panel Founder tersembunyi dan endpoint backend terproteksi 403');

  console.log('--- SUITE 4: Memalsukan role Founder melalui frontend tidak memberikan akses ---');
  const spoofAttempt = await page.evaluate(async () => {
    // Malicious attempt to spoof in-memory frontend object
    if (JTPRO.access) JTPRO.access.founder = true;
    try {
      await JTPRO.request('/founder/groq-config', {
        method: 'POST',
        body: { api_key: 'gsk_hackerSpoofedKey' }
      });
      return { hacked: true };
    } catch (err) {
      return { hacked: false, message: err.message };
    }
  });
  assert.equal(spoofAttempt.hacked, false, 'Backend harus menolak perubahan konfigurasi meski frontend dimanipulasi');
  console.log('Test 4 Passed: Manipulasi role klien tidak menembus otorisasi backend');

  console.log('--- SUITE 5: Founder API Key tidak bocor ke respons publik, log, atau frontend ---');
  const publicStatus = await page.evaluate(async () => {
    return await JTPRO.request('/groq/status');
  });
  assert.equal(publicStatus.available, true);
  assert.equal(publicStatus.api_key, undefined, 'Status publik tidak boleh menyertakan secret');
  assert.equal(publicStatus.secret, undefined);

  // When founder logs in, they only see masked key
  isCurrentUserFounder = true;
  await page.evaluate(async () => {
    await JTPRO.verifyAccess();
    await JTPRO.open('global-news');
  });
  const founderPanel = await page.$('.pro-founder-panel');
  assert.ok(founderPanel !== null, 'Founder panel harus tampil untuk akun founder');
  const panelText = await page.$eval('.pro-founder-panel', el => el.textContent);
  assert.ok(panelText.includes('gsk_...'), 'Kunci tersimpan harus dimasking');
  assert.ok(!panelText.includes('gsk_secretFounderLiveKey9988'), 'Secret lengkap TIDAK boleh bocor ke DOM');
  console.log('Test 5 Passed: Founder key dimasking dan tidak bocor');

  console.log('--- SUITE 6: API key tidak valid ditangani dengan benar ---');
  directGroqStatus = 401;
  const testInvalidKey = await page.evaluate(async () => {
    return await JTPRO.testGroqKey('gsk_invalidFakeKey999');
  });
  assert.equal(testInvalidKey.ok, false);
  assert.equal(testInvalidKey.status, 'Invalid Key');
  directGroqStatus = 200; // Reset
  console.log('Test 6 Passed: Invalid API key dideteksi dengan status Invalid Key');

  console.log('--- SUITE 7 & 8: Rate limit fallback dan pencegahan infinite loop ---');
  // Enable personal key
  await page.evaluate(() => {
    JTPRO.setPersonalGroqApiKey('gsk_rateLimitedPersonalKey');
    JTPRO.setGroqFallbackEnabled(true);
  });

  // Direct personal key responds with 429
  directGroqStatus = 429;
  directGroqCalls.length = 0;
  serverProxyCalls.length = 0;

  const fallbackResult = await page.evaluate(async () => {
    return await JTPRO.callAiApi({ contents: 'Analisa GBPUSD M15' });
  });
  assert.ok(fallbackResult.includes('Groq Bawaan Gratis'), 'Harus otomatis fallback ke Founder Groq saat Personal Groq 429');
  assert.equal(directGroqCalls.length, 1, 'Mencoba personal key 1 kali');
  assert.equal(serverProxyCalls.length, 1, 'Fallback ke proxy founder 1 kali');

  // Verify anti-infinite-loop when both personal AND founder are 429
  backendFounderStatus = 'Rate Limited';
  directGroqCalls.length = 0;
  serverProxyCalls.length = 0;

  const bothFailed = await page.evaluate(async () => {
    try {
      await JTPRO.callAiApi({ contents: 'Analisa USDJPY H4' });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  });
  assert.equal(bothFailed.ok, false);
  assert.equal(directGroqCalls.length, 1, 'Hanya mencoba personal key 1 kali');
  assert.equal(serverProxyCalls.length, 1, 'Hanya mencoba proxy founder 1 kali, TIDAK ADA infinite retry');
  backendFounderStatus = 'Connected'; // Reset
  directGroqStatus = 200; // Reset
  console.log('Test 7 & 8 Passed: Auto-fallback berfungsi dan loop retry tak terbatas dicegah');

  console.log('--- SUITE 9: Menghapus Personal API Key mengembalikan pengguna ke provider bawaan ---');
  await page.evaluate(() => {
    JTPRO.setPersonalGroqApiKey('');
  });
  assert.equal(await page.evaluate(() => JTPRO.hasPersonalGroqApiKey()), false);

  directGroqCalls.length = 0;
  serverProxyCalls.length = 0;
  const replyAfterDelete = await page.evaluate(async () => {
    return await JTPRO.callAiApi({ contents: 'Halo' });
  });
  assert.ok(replyAfterDelete.includes('Groq Bawaan Gratis'), 'Harus kembali ke Founder Groq setelah Personal key dihapus');
  assert.equal(serverProxyCalls.length, 1);
  assert.equal(directGroqCalls.length, 0);
  console.log('Test 9 Passed: Menghapus key mengembalikan sistem ke AI bawaan');

  console.log('--- SUITE 10: Fitur Gemini dan OpenAI yang sudah ada tetap berfungsi ---');
  await page.evaluate(() => {
    localStorage.clear();
    JTPRO.setGeminiApiKey('AIzaSyValidGeminiKey123');
    JTPRO.setAiProviderPreference('gemini');
  });
  assert.equal(await page.evaluate(() => JTPRO.hasGeminiApiKey()), true);
  const geminiReply = await page.evaluate(async () => {
    return await JTPRO.callAiApi({ contents: 'Halo Gemini' });
  });
  assert.equal(geminiReply, 'Response from Google Gemini');

  await page.evaluate(() => {
    JTPRO.setOpenAiApiKey('sk-proj-validOpenAiKey123');
    JTPRO.setAiProviderPreference('openai');
  });
  const openAiReply = await page.evaluate(async () => {
    return await JTPRO.callAiApi({ contents: 'Halo OpenAI' });
  });
  assert.equal(openAiReply, 'Response from ChatGPT OpenAI');
  console.log('Test 10 Passed: Google Gemini dan ChatGPT OpenAI tetap berfungsi 100%');

  console.log('--- SUITE 11: Modal UI dan Navigasi Groq Tab ---');
  await page.evaluate(() => {
    JTPRO.openGeminiConfigModal();
  });
  const modalTabs = await page.$$eval('.pro-modal-tabs button', btns => btns.map(b => b.textContent));
  assert.ok(modalTabs.includes('Groq AI'), 'Tab Groq AI harus tersedia di modal konfigurasi');
  assert.ok(modalTabs.includes('Google Gemini'), 'Tab Google Gemini harus tersedia');
  assert.ok(modalTabs.includes('ChatGPT (OpenAI)'), 'Tab ChatGPT OpenAI harus tersedia');

  await page.click('.pro-modal-tabs button:has-text("Groq AI")');
  const fieldLabel = await page.$eval('.pro-modal-field label', el => el.textContent);
  assert.ok(fieldLabel.includes('Groq'), 'Label harus mencerminkan Groq');
  console.log('Test 11 Passed: Modal UI mendukung tab Groq AI');

  await browser.close();
  server.close();
  console.log('\nSEMUA 11 PENGUJIAN GROQ & FOUNDER API MANAGEMENT LULUS DENGAN SUKSES 100%!\n');
  process.exit(0);
})().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
