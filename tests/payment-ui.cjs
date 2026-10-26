const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Maulana Riski/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),calls=[];let browser,paid=false;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.endsWith('.js') && !['/js/custom-payment.js','/js/payment.js'].includes(url.pathname)){res.setHeader('Content-Type','application/javascript');res.end('');return;}
  const file=path.resolve(root,'.'+(/\.(css|js|svg)$/.test(url.pathname)?url.pathname:'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    window.JTPRO_CONFIG={apiBase:'https://nmddjuqkdyhcobddinkc.supabase.co/functions/v1/pro-gateway'};
    window.fixtureOwner='11111111-1111-4111-8111-111111111111';
    window.cloudClient={auth:{getSession:async()=>({data:{session:{access_token:'fixture-token-only',user:{id:window.fixtureOwner}}}}),onAuthStateChange:callback=>{window.changeFixtureOwner=id=>{window.fixtureOwner=id;callback('SIGNED_IN',{user:{id}});};return {data:{subscription:{unsubscribe(){}}}};}}};
  });
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.route('**/functions/v1/midtrans-custom-checkout',async route=>{
    const body=route.request().postDataJSON();calls.push(body);
    const total=body.plan==='plus' && body.interval==='annual'?111:22.2;
    const data=body.action==='quote'?{environment:'sandbox',quote:{amount:Math.round(total*16000),total_usd:total,conversion_rate:16000},methods:['qris','bca','bni','bri','permata']}:
      {order_id:'fixture-order-not-real',merchant_id:'fixture-merchant',amount:355200,currency:'IDR',status:paid?'settlement':'pending',payment_type:'bank_transfer',va_number:'000000000000',bank:'bca',expires_at:null};
    await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.route('**/functions/v1/midtrans-create-token',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({token:'fixture-snap-token-not-real'})}));
  await page.goto(origin+'/home/');await page.evaluate(()=>openCheckoutModal('pro','monthly'));
  await page.locator('#jt-terms-agree').check();await page.locator('#jt-checkout-pay-btn').evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelector('#jt-payment-status').textContent.includes('Pilih metode pembayaran'));
  assert.equal(calls.filter(row=>row.action==='charge').length,0,'Opening checkout created a charge');
  assert.equal(await page.locator('#jt-payment-create').isDisabled(),true);
  if(process.env.CHECKOUT_PREVIEW_DIR){fs.mkdirSync(process.env.CHECKOUT_PREVIEW_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.CHECKOUT_PREVIEW_DIR,'checkout-desktop.png')});}
  await page.locator('input[name=jt-payment-method][value=bca]').check();await page.locator('#jt-payment-create').click();
  await page.waitForFunction(()=>document.querySelector('#jt-payment-status').textContent.includes('Menunggu pembayaran'));
  assert.equal(await page.locator('#jt-payment-va').textContent(),'000000000000');assert.equal(calls.filter(row=>row.action==='charge').length,1);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.fixtureCopied=value;}}}));
  await page.locator('#jt-payment-copy').evaluate(el=>el.click());await page.waitForFunction(()=>window.fixtureCopied==='000000000000');
  paid=true;await page.locator('#jt-payment-check').evaluate(el=>el.click());await page.waitForFunction(()=>document.querySelector('#jt-payment-status').textContent.includes('diterima Midtrans'));
  assert.ok((await page.locator('#jt-payment-status').textContent()).includes('verifikasi server'));
  await page.evaluate(()=>window.changeFixtureOwner('22222222-2222-4222-8222-222222222222'));
  assert.equal(await page.locator('#checkout-modal').isVisible(),false);assert.equal(await page.locator('#jt-payment-va').textContent(),'');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>openCheckoutModal('plus','annual'));await page.locator('#jt-terms-agree').check();await page.locator('#jt-checkout-pay-btn').evaluate(el=>el.click());
  await page.waitForFunction(()=>document.querySelector('#jt-payment-status').textContent.includes('Pilih metode pembayaran'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(await page.locator('#jt-payment-step').isVisible());
  if(process.env.CHECKOUT_PREVIEW_DIR)await page.screenshot({path:path.join(process.env.CHECKOUT_PREVIEW_DIR,'checkout-mobile.png')});
  await page.locator('#jt-payment-back').evaluate(el=>el.click());assert.equal(await page.locator('.jt-checkout-layout').isVisible(),true);
  await page.locator('#jt-checkout-pay-btn').evaluate(el=>el.click());await page.waitForFunction(()=>document.querySelector('#jt-payment-status').textContent.includes('Pilih metode pembayaran'));
  await page.evaluate(()=>{window.snap={pay:token=>{window.fixtureSnapToken=token;}};});
  await page.locator('#jt-payment-other').evaluate(el=>el.click());await page.waitForFunction(()=>window.fixtureSnapToken==='fixture-snap-token-not-real');
  await page.waitForFunction(()=>!document.querySelector('#jt-checkout-pay-btn').disabled);
  await page.locator('#jt-checkout-pay-btn').evaluate(el=>el.click());await page.waitForFunction(()=>document.querySelector('#jt-payment-status').textContent.includes('Pilih metode pembayaran'));
  await page.keyboard.press('Escape');assert.equal(await page.locator('#checkout-modal').isVisible(),false);
  console.log('Custom checkout browser: method selection, no automatic charge, pending/paid feedback, account isolation, mobile overflow and Escape passed (provider fixtures).');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
