// Opt-in deployed-site check using only disposable identities, never customer credentials.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Maulana Riski/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const users=JSON.parse(fs.readFileSync(process.env.JT_PRO_SMOKE_CREDENTIALS,'utf8'));
assert.equal(users.length,2);for(const user of users)assert.match(user.email,/^pro-smoke-.*@example\.invalid$/);
const site='https://jokitugasbykay.github.io/Journaling_trade.github.io/';
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    for(const [index,user] of users.entries()) {
      const context=await browser.newContext({viewport:{width:index?375:1440,height:1000}}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(site+'login/',{waitUntil:'domcontentloaded'});
      await page.locator('#cloud-email').fill(user.email);await page.locator('#cloud-password').fill(user.password);await page.locator('#auth-signin-submit').click();
      await page.waitForFunction(()=>!document.querySelector('#nickname-form').hidden || !document.querySelector('#view-login').classList.contains('active'),{},{timeout:45000});
      if(await page.locator('#nickname-form').isVisible()) {await page.locator('#nickname-input').fill('Disposable tester');await page.locator('#nickname-form button[type=submit]').click();}
      if(index) {
        await page.locator('#nav-ai-trading').waitFor({state:'visible'});assert(await page.locator('#nav-ai-trading').isDisabled());assert(!(await page.locator('#nav-pro').isVisible()));
        await page.goto(site+'pro/?section=analytics',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>document.querySelector('#nav-ai-trading')?.hidden===false,{},{timeout:45000});
        assert.equal(await page.locator('.pro-kpis').count(),0,'Free direct route displayed protected analytics');
      } else {
        await page.locator('#nav-pro').waitFor({state:'visible'});await page.locator('#nav-pro').click();
        await page.getByText('No authorized backend market feed is configured.',{exact:false}).waitFor();
        for(const section of ['analytics','heatmap','strategies','risk','reviews','reports','global-news','ai-chat']) {
          const response=page.waitForResponse(r=>r.url().includes('/functions/v1/pro-gateway/api/v1/') && r.url().includes(section==='analytics'?'/analytics/overview':section==='heatmap'?'/analytics/heatmap':section==='strategies'?'/strategies':section==='risk'?'/analytics/risk':section==='global-news'?'/news?':section==='ai-chat'?'/ai/chat/history':'/'+section) && r.status()===200);
          await page.locator('[data-section="'+section+'"]').click();await response;
          assert(!/not configured|could not complete|Sign in to continue/i.test(await page.locator('.pro-status').textContent()));
        }
        await page.setViewportSize({width:375,height:1000});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Pro page overflows on mobile');
      }
      assert.deepEqual(errors,[]);await context.close();
    }
    console.log('Deployed website: real Pro/Free login, protected navigation, live deterministic sections, AI history and mobile overflow checks passed. Live inference remains unavailable.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
