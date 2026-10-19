const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Maulana Riski/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..');

const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname.startsWith('/api/v1/')) {
      res.setHeader('Content-Type','application/json');
      if(url.pathname==='/api/v1/entitlements') return res.end(JSON.stringify({plan:'pro',effective_until:'2099-01-01T00:00:00Z',ai:{remaining:30,limit:30}}));
      if(url.pathname==='/api/v1/market/preference') return res.end(JSON.stringify({trading_style:'INTRADAY'}));
      if(url.pathname==='/api/v1/market/instruments') return res.end(JSON.stringify({items:[{symbol:'XAUUSD',name:'Gold',asset_class:'Metals',tradingview_symbol:'TVC:GOLD',timeframes:['15m','1h','4h']}]}));
      if(url.pathname==='/api/v1/market/context') return res.end(JSON.stringify({instrument:'XAUUSD',timeframe:'15m',current_price:'2650.50',as_of:'2026-10-14T00:00:00Z',provider:'Live Feeds'}));
      if(url.pathname==='/api/v1/analytics/overview') return res.end(JSON.stringify({metrics:{expectancy:'15',profit_factor:'2.1',maximum_drawdown:'12',average_risk_reward:'2.4',win_rate:'65%'}}));
      if(url.pathname==='/api/v1/ai/engine') return res.end(JSON.stringify({status:'ready',available:true,provider:'Gemini Test'}));
      if(url.pathname==='/api/v1/ai/history') return res.end(JSON.stringify({items:[]}));
      if(url.pathname==='/api/v1/ai/chat/history') return res.end(JSON.stringify({items:[]}));
      if(url.pathname==='/api/v1/market/signals') return res.end(JSON.stringify({items:[]}));
      if(url.pathname==='/api/v1/market/performance') return res.end(JSON.stringify({total_accepted_signals:0,categories:{}}));
      if(url.pathname==='/api/v1/market/alerts') return res.end(JSON.stringify({items:[]}));
      if(url.pathname==='/api/v1/market/notifications') return res.end(JSON.stringify({items:[]}));
      return res.end(JSON.stringify({ok:true}));
    }
    if(url.pathname==='/') {
      res.setHeader('Content-Type','text/html; charset=utf-8');
      return res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/pro.css"></head><body><main><section class="pro-workspace active" id="view-pro-workspace"></section></main><script src="/js/pro.js"></script><script>JTPRO.configure({apiBase:location.origin,getToken:async()=>"gemini-test-token",getUserId:()=>"gemini-user"});</script></body></html>');
    }
    const file=path.resolve(root,'.'+url.pathname);
    if(!file.startsWith(root+path.sep)) throw new Error('Invalid path');
    res.setHeader('Content-Type',file.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8');
    res.end(fs.readFileSync(file));
  } catch(e) {
    res.statusCode=500;
    res.end(e.message);
  }
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});

  const geminiRequests=[];
  let geminiMockResponse={
    candidates:[
      {
        content:{
          parts:[
            {
              text:`### Analisis Pasar Kaystrade (XAUUSD M15)

| Parameter | Nilai |
|---|---|
| Bias Arah | **BUY** |
| Status Setup | CONFIRMED |
| Entry Level | 2650.00 |
| Stop Loss | 2642.00 |
| Take Profit | 2666.00 |
| Risk:Reward | 1:2 |

#### Konfirmasi Teknikal Kaystrade
- **Big Trend H4**: Bullish continuation (HH/HL terkonfirmasi).
- **Struktur H1**: Break of Structure (BOS) bullish di 2648.50.
- **Eksekusi M15**: Rejection pada fresh Demand base 2649.00 - 2651.00 disertai imbalance FVG.
- **RSI(14)**: Rebound dari level 45 cross naik SMA(14).

> **Kondisi Invalidasi**: Setup batal jika candle H1 close di bawah swing low 2642.00.`
            }
          ]
        }
      }
    ]
  };
  let geminiStatus=200;

  await page.route('https://generativelanguage.googleapis.com/**',async route=>{
    const req=route.request();
    geminiRequests.push({
      url:req.url(),
      method:req.method(),
      postData:req.postDataJSON()
    });
    if(geminiStatus===429){
      return route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:{message:'Resource exhausted',status:'RESOURCE_EXHAUSTED'}})});
    }
    if(geminiStatus===400){
      return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{message:'API key not valid',status:'INVALID_ARGUMENT'}})});
    }
    return route.fulfill({status:geminiStatus,contentType:'application/json',body:JSON.stringify(geminiMockResponse)});
  });

  await page.route('https://s.tradingview.com/**',route=>route.fulfill({contentType:'text/html',body:'<p>Mock Chart</p>'}));

  await page.goto('http://127.0.0.1:'+port+'/');

  // 1. Test markdown rendering utility
  const markdownTest = await page.evaluate(()=>{
    const md = `## Header 2\n\n**Tebal** dan *Miring* dan \`code\`\n\n- Item 1\n- Item 2\n\n> Kutipan\n\n| Kolom A | Kolom B |\n|---|---|\n| Nilai 1 | Nilai 2 |`;
    return JTPRO.renderMarkdown(md);
  });
  assert.ok(markdownTest.includes('<h2>Header 2</h2>'));
  assert.ok(markdownTest.includes('<strong>Tebal</strong>'));
  assert.ok(markdownTest.includes('<em>Miring</em>'));
  assert.ok(markdownTest.includes('<code>code</code>'));
  assert.ok(markdownTest.includes('<li>Item 1</li>'));
  assert.ok(markdownTest.includes('<blockquote>Kutipan</blockquote>'));
  assert.ok(markdownTest.includes('<table class="pro-markdown-table">'));
  assert.ok(markdownTest.includes('<th scope="col">Kolom A</th>'));
  assert.ok(markdownTest.includes('<td>Nilai 1</td>'));

  // 2. Test Centralized API Key Modal & localStorage storage
  await page.evaluate(()=>JTPRO.open('ai-market'));
  assert.equal(await page.evaluate(()=>JTPRO.hasGeminiApiKey()), false);

  // Open modal via JTPRO.openGeminiConfigModal
  await page.evaluate(()=>JTPRO.openGeminiConfigModal());
  await page.waitForSelector('#pro-gemini-modal');
  assert.equal(await page.locator('#pro-gemini-modal h2').textContent(),'Google Gemini API Configuration');

  // Input API key and save
  await page.fill('#pro-gemini-api-key-input','AIzaSyFakeKeyForTesting123');
  await page.click('#pro-gemini-save-btn');
  await page.waitForSelector('.pro-modal-status.success');

  // Check localStorage key
  const savedKey = await page.evaluate(()=>localStorage.getItem('gemini_api_key'));
  assert.equal(savedKey,'AIzaSyFakeKeyForTesting123');
  assert.equal(await page.evaluate(()=>JTPRO.hasGeminiApiKey()), true);

  // Check AI engine status card shows connected
  await page.waitForSelector('.pro-engine-status-badge');
  const engineText = await page.locator('.pro-panel:has-text("AI engine status")').textContent();
  assert.ok(engineText.includes('available: true (Gemini Connected)'));
  assert.ok(engineText.includes('ready (Connected)'));
  assert.ok(engineText.includes('gemini-3.8-flash'));

  // 3. Test Module 1: AI Market Intelligence with Kaystrade prompt
  await page.waitForSelector('#pro-gemini-modal', { state: 'detached' });
  await page.waitForSelector('#pro-ai-generate:not([disabled])');
  await page.click('#pro-ai-generate');
  await page.waitForSelector('.pro-markdown');
  await page.waitForSelector('.pro-vinzx-card');
  const marketResultText = await page.locator('.pro-panel:has-text("AI entry signal")').textContent();
  assert.ok(marketResultText.includes('Analisis Pasar Kaystrade'));
  assert.ok(marketResultText.includes('Big Trend H4'));
  assert.ok(marketResultText.includes('Struktur H1'));
  assert.ok(marketResultText.includes('Eksekusi M15'));

  // Verify Vinzx Intelligent Terminal components
  const vinzxSignalDir = await page.locator('.pro-vinzx-signal-direction').textContent();
  assert.equal(vinzxSignalDir, 'BUY');
  assert.ok((await page.locator('.pro-vinzx-next-candle').textContent()).includes('NEXT CANDLE:'));
  assert.ok((await page.locator('.pro-vinzx-metric-value.sl').textContent()).length > 0);
  assert.ok((await page.locator('.pro-vinzx-metric-value.tp').textContent()).length > 0);

  // Verify Kaystrade system prompt was sent to Gemini
  assert.ok(geminiRequests.length > 0);
  const lastMarketReq = geminiRequests[geminiRequests.length - 1];
  assert.ok(lastMarketReq.url.includes('key=AIzaSyFakeKeyForTesting123'));
  assert.ok(lastMarketReq.postData.systemInstruction.parts[0].text.includes('Kaystrade'));
  assert.ok(lastMarketReq.postData.systemInstruction.parts[0].text.includes('H4'));
  assert.ok(lastMarketReq.postData.systemInstruction.parts[0].text.includes('SNR/SBR'));

  // 4. Test Module 2: AI Behaviour Analysis with Trading Psychology prompt
  geminiMockResponse = {
    candidates:[
      {
        content:{
          parts:[
            {
              text:`### Evaluasi Psikologi & Perilaku Trading

#### 1. Diagnosa Kebiasaan
- **Pola FOMO**: Terdeteksi 2 transaksi membuka posisi saat candle impulsif panjang tanpa menunggu retest.
- **Kedisiplinan SL/TP**: SL ditaati dengan baik, tidak ada pergeseran SL negatif.

#### 2. Rekomendasi Action Plan
- Buat checklist 3 konfirmasi sebelum klik order.
- Batasi maksimal 2 trade per sesi untuk mencegah overtrading.`
            }
          ]
        }
      }
    ]
  };
  await page.evaluate(()=>JTPRO.open('ai-behaviour'));
  await page.click('#pro-ai-generate');
  await page.waitForSelector('.pro-markdown');
  const behaviourResult = await page.locator('.pro-panel:has-text("Analysis result")').textContent();
  assert.ok(behaviourResult.includes('Evaluasi Psikologi & Perilaku Trading'));
  assert.ok(behaviourResult.includes('Pola FOMO'));

  const lastBehaviourReq = geminiRequests[geminiRequests.length - 1];
  assert.ok(lastBehaviourReq.postData.systemInstruction.parts[0].text.includes('Analis Psikologi Trading'));
  assert.ok(lastBehaviourReq.postData.systemInstruction.parts[0].text.includes('FOMO'));
  assert.ok(lastBehaviourReq.postData.systemInstruction.parts[0].text.includes('Revenge Trading'));

  // 5. Test Module 3: AI Journal Analyst with Strategy Optimization prompt
  geminiMockResponse = {
    candidates:[
      {
        content:{
          parts:[
            {
              text:`### Evaluasi Jurnal & Optimasi Strategi

| Metrik | Nilai | Rekomendasi |
|---|---|---|
| Winrate | 65% | Pertahankan edge |
| Profit Factor | 2.1 | Baik |
| Risk-Reward | 2.4 | Optimal |

#### Rekomendasi Optimasi
- Tingkatkan alokasi lot pada setup Breakout terkonfirmasi.
- Hindari trading menjelang rilis news high impact.`
            }
          ]
        }
      }
    ]
  };
  await page.evaluate(()=>JTPRO.open('ai-journal'));
  await page.click('#pro-ai-generate');
  await page.waitForSelector('.pro-markdown');
  const journalResult = await page.locator('.pro-panel:has-text("Analysis result")').textContent();
  assert.ok(journalResult.includes('Evaluasi Jurnal & Optimasi Strategi'));
  assert.ok(journalResult.includes('Profit Factor'));

  const lastJournalReq = geminiRequests[geminiRequests.length - 1];
  assert.ok(lastJournalReq.postData.systemInstruction.parts[0].text.includes('Senior Trading Journal Analyst'));
  assert.ok(lastJournalReq.postData.systemInstruction.parts[0].text.includes('Winrate'));

  // 6. Test Module 4: AI Chat (interactive 2-way conversation with context retention & thought filtering)
  geminiMockResponse = {
    candidates:[
      {
        content:{
          parts:[
            {
              thought: true,
              text: `• User says: "hi ai chat."\n• Context: I am Kayla AI, a professional AI Trading Assistant & Financial Mentor\n• Tone: Friendly, polite`
            },
            {
              text:`Halo! Sebagai Asisten AI Trading, saya siap membantu Anda memahami konsep pasar seperti pemetaan **Support Become Resistance (SBR)** atau manajemen risiko.`
            }
          ]
        }
      }
    ]
  };
  await page.evaluate(()=>JTPRO.open('ai-chat'));
  await page.fill('#pro-ai-chat-message','Bagaimana cara validasi SBR menurut Kaystrade?');
  await page.click('#pro-ai-chat-send');
  await page.waitForSelector('.pro-chat-message[data-role="assistant"] .pro-markdown');
  const chatBubbleText = await page.locator('.pro-chat-message[data-role="assistant"]').textContent();
  assert.ok(chatBubbleText.includes('Support Become Resistance (SBR)'));
  assert.ok(!chatBubbleText.includes('Context: I am Kayla AI'), 'Internal thought part must be filtered out');
  assert.ok(!chatBubbleText.includes('• User says:'), 'Bullet thought reasoning must not leak into chat');

  const lastChatReq = geminiRequests[geminiRequests.length - 1];
  assert.ok(lastChatReq.postData.systemInstruction.parts[0].text.includes('Asisten AI Trading'));
  assert.ok(lastChatReq.postData.systemInstruction.parts[0].text.includes('Imut, Ramah, & Manis'));
  assert.ok(lastChatReq.postData.systemInstruction.parts[0].text.includes('DILARANG KERAS MEMBAHAS CODING'));
  assert.ok(lastChatReq.postData.systemInstruction.parts[0].text.includes('POLITIK BERBAHAYA'));
  assert.ok(lastChatReq.postData.systemInstruction.parts[0].text.includes('Konteks Lokasi & Waktu Pengguna'));
  assert.ok(lastChatReq.postData.systemInstruction.parts[0].text.includes('Instruksi Format Output & Larangan Bocor Chain-of-Thought'));
  assert.equal(lastChatReq.postData.contents[0].parts[0].text,'Bagaimana cara validasi SBR menurut Kaystrade?');

  // Test chat context preservation on follow-up message
  geminiMockResponse = {
    candidates:[
      {
        content:{
          parts:[
            {
              text:`Untuk retest SBR, tunggu body candle reject di level bekas support tersebut.`
            }
          ]
        }
      }
    ]
  };
  await page.fill('#pro-ai-chat-message','Lalu bagaimana konfirmasi retest-nya?');
  await page.click('#pro-ai-chat-send');
  await page.waitForFunction(()=>document.querySelectorAll('.pro-chat-message[data-role="assistant"] .pro-markdown').length===2);

  const followUpChatReq = geminiRequests[geminiRequests.length - 1];
  // Verify conversation history contains both turns!
  assert.equal(followUpChatReq.postData.contents.length, 3); // user turn 1, model reply 1, user turn 2
  assert.equal(followUpChatReq.postData.contents[0].role, 'user');
  assert.equal(followUpChatReq.postData.contents[1].role, 'model');
  assert.equal(followUpChatReq.postData.contents[2].role, 'user');
  assert.equal(followUpChatReq.postData.contents[0].time, undefined);
  assert.equal(followUpChatReq.postData.contents[1].time, undefined);
  // Verify persistence of chat history across page reload / refresh
  const storedChatRaw = await page.evaluate(() => localStorage.getItem('gemini_chat_history'));
  assert.ok(storedChatRaw, 'gemini_chat_history should be stored in localStorage');
  const storedChat = JSON.parse(storedChatRaw);
  assert.equal(storedChat.length, 4); // 2 user messages, 2 model replies

  // Perform full page reload (simulating user refresh / leaving and returning)
  await page.reload();
  await page.evaluate(() => JTPRO.open('ai-chat'));
  await page.waitForSelector('.pro-chat-message[data-role="assistant"]');
  const restoredAssistants = await page.locator('.pro-chat-message[data-role="assistant"]').count();
  const restoredUsers = await page.locator('.pro-chat-message[data-role="user"]').count();
  assert.equal(restoredAssistants, 2);
  assert.equal(restoredUsers, 2);
  const reloadedChatText = await page.locator('.pro-chat-messages').textContent();
  assert.ok(reloadedChatText.includes('Bagaimana cara validasi SBR'));
  assert.ok(reloadedChatText.includes('Support Become Resistance'));
  assert.ok(reloadedChatText.includes('Lalu bagaimana konfirmasi retest-nya?'));
  assert.ok(reloadedChatText.includes('tunggu body candle reject'));

  // Test zero-leak sanitization on inline planning checklist response
  geminiMockResponse = {
    candidates:[
      {
        content:{
          parts:[
            {
              text:`"imuttt nyaaa" (So cuteeee). The user is complimenting the AI's personality/style. Kayla AI (Cute, sweet, energetic, supportive, professional in trading).

• Acknowledge the compliment with a cute, energetic, and sweet response.
• Maintain the persona (Kayla AI).
• Gently steer the conversation back to the core purpose: Trading.
• Ensure no forbidden symbols (no skull emojis, no em/en dashes).
• Use Markdown for a neat look.

• Check: No skull emojis? Yes.
• Check: No em/en dashes? Yes (use "-" or ":").
• Check: Tone? Cute, sweet, energetic.
• Check: Topic? Steering towards trading.

"Hehe, makasih banyak yaaa! Kamu bisa aja deh bikin Kayla jadi malu-malu kucing~ Tapi meskipun imut, Kayla tetep asisten cerdas yang disiplin! Yuk kita langsung bahas trading aja!"`
            }
          ]
        }
      }
    ]
  };
  await page.fill('#pro-ai-chat-message','imuttt nyaaa');
  await page.click('#pro-ai-chat-send');
  await page.waitForFunction(()=>document.querySelectorAll('.pro-chat-message[data-role="assistant"] .pro-markdown').length===3);
  const thirdBubbleText = await page.locator('.pro-chat-message[data-role="assistant"]').nth(2).textContent();
  assert.ok(!thirdBubbleText.includes('Check: No skull emojis'), 'Checklist rules must not leak');
  assert.ok(!thirdBubbleText.includes('• Acknowledge'), 'Planning bullets must not leak');
  assert.ok(!thirdBubbleText.includes('The user is complimenting'), 'User analysis must not leak');
  assert.ok(thirdBubbleText.includes('Hehe, makasih banyak yaaa!'), 'Clean dialogue must be presented');

  // Verify unit sanitization utility in page context
  const unitSanitizationResult = await page.evaluate(()=>{
    const rawWithAllArtifacts = `Kayla AI\n• User says: "halo"\n• Context: I am Kayla AI\n• Check: No skull emojis? Yes.\n• Tone: "Halo halo! Semangat trading yaaa!"`;
    return JTPRO.sanitizeChatOutput(rawWithAllArtifacts);
  });
  assert.ok(!unitSanitizationResult.includes('User says:'));
  assert.ok(!unitSanitizationResult.includes('Check:'));
  assert.ok(unitSanitizationResult.includes('Halo halo! Semangat trading yaaa!'));

  // Test clear chat button
  const dialogHandler = async dialog => { await dialog.accept(); };
  page.on('dialog', dialogHandler);
  await page.click('#pro-ai-chat-clear');
  await page.waitForFunction(() => !document.querySelector('.pro-chat-message'));
  assert.equal(await page.evaluate(() => localStorage.getItem('gemini_chat_history')), null);
  page.off('dialog', dialogHandler);

  // 7. Test Error Handling: Rate Limit 429
  geminiStatus = 429;
  await page.evaluate(()=>JTPRO.open('ai-journal'));
  await page.click('#pro-ai-generate');
  await page.waitForSelector('.pro-modal-status.error, [role="alert"]');
  const error429Text = await page.locator('#view-pro-workspace').textContent();
  assert.ok(error429Text.includes('kuota kayla telah habis atau dibatasi'));

  // 8. Test Error Handling: Invalid API Key 400
  geminiStatus = 400;
  await page.evaluate(()=>JTPRO.open('ai-behaviour'));
  await page.click('#pro-ai-generate');
  await page.waitForSelector('.pro-modal-status.error, [role="alert"]');
  const error400Text = await page.locator('#view-pro-workspace').textContent();
  assert.ok(error400Text.includes('Google Gemini API Key tidak valid'));

  // 9. Test Removal of Key & Missing Key Warning
  await page.evaluate(()=>localStorage.removeItem('gemini_api_key'));
  await page.evaluate(()=>JTPRO.open('ai-market'));
  assert.equal(await page.evaluate(()=>JTPRO.hasGeminiApiKey()), false);

  await browser.close();
  server.close();
  console.log('All 9 Gemini AI integration test suites passed successfully!');
})().catch(err=>{
  console.error(err);
  server.close();
  process.exit(1);
});
