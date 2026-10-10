// Browser transport contract checks use explicit fixtures, not production provider proof.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Maulana Riski/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.join(__dirname,'..'),requests=[],errors=[];
const ids={account:'11111111-1111-4111-8111-111111111111',strategy:'22222222-2222-4222-8222-222222222222',second:'33333333-3333-4333-8333-333333333333',job:'44444444-4444-4444-8444-444444444444',trade:'55555555-5555-4555-8555-555555555555'};
let strategyRows=[{id:ids.strategy,name:'Breakout',description:'Recorded setup'},{id:ids.second,name:'Reversal',description:'Recorded setup'}],ruleRows=[];
const metrics={expectancy:'12',profit_factor:'1.5',maximum_drawdown:'20',average_risk_reward:'2',trade_count:2,average_win:'30',average_loss:'-20'};
const equity=[{date:'2026-10-01',equity:'1000',drawdown:'0',pnl:'30'},{date:'2026-10-02',equity:'980',drawdown:'20',pnl:'-20'}];
const group=[{label:'EURUSD',trade_count:2,net_pnl:'10',win_rate:'0.5'}];
const job={id:ids.job,state:'succeeded',created_at:'2026-10-10',kind:'journal',result:{observations:[{text:'Two recorded trades.',evidence_ids:[ids.trade]}],model_version:'fixture-contract'}};
let activeKind='journal';
let actionableFixture=false,signalRows=[],alertRows=[],notificationRows=[];
const marketContext=(symbol='XAUUSD',frame='15m')=>({instrument:symbol,timeframe:frame,name:symbol,asset_class:'Explicit transport fixture',tradingview_symbol:symbol==='XAUUSD'?'TVC:GOLD':'OANDA:EURUSD',as_of:'2026-10-10T10:00:00Z',provider:'Synthetic transport fixture',data_freshness:'fresh',current_price:'100',macro:[],news:[],geopolitics:[],correlations:{},kaystrade:{methodology:'fixture-rule-contract',signal:{direction:'NO TRADE',bias:'NEUTRAL',status:'WAITING FOR CONFIRMATION',entry:null,stop_loss:null,take_profit:null,risk_reward:null,analysis_horizon:frame,confirmations:[],invalidation_conditions:['No confirmed setup'],timestamp:'2026-10-10T10:00:00Z'},frames:{},technicals:[],warnings:['Fixture evidence only'],scenarios:{no_trade:'No confirmed setup'}}});
const marketJob=()=>{const data=marketContext();if(actionableFixture){data.kaystrade.signal={...data.kaystrade.signal,direction:'BUY',bias:'BUY',status:'CONDITIONAL SETUP',entry:'100',stop_loss:'90',take_profit:'120',risk_reward:'2'};data.intelligence={trading_style:'INTRADAY',comparison:{agreement:'ALIGNED'},fundamental:{events:[],warning:'Synthetic action transport fixture only'},warnings:[],scenarios:[{direction:'BUY',setup_status:'CONFIRMED',entry:'100',stop_loss:'90',take_profit_1:'120',risk_reward:'2',probability_status:'Not calibrated'}]};}return {...job,kind:'market',result:{...job.result,quantitative:{market:data},signal:data.kaystrade.signal,model_version:{name:'transport-fixture',digest:'fixture-not-real-inference'}}};};
function api(url,method,body) {
  const route=url.pathname.replace('/api/v1','');requests.push({route,method,body,query:url.searchParams.toString()});
  if(route==='/entitlements')return {plan:'pro',effective_until:'2099-01-01T00:00:00Z',ai:{remaining:30,limit:30}};
  if(route==='/accounts')return {items:[{id:ids.account,name:'Trading account'}]};
  if(route==='/strategies') {if(method==='POST')strategyRows.push({id:'66666666-6666-4666-8666-666666666666',...body});return {items:strategyRows};}
  if(route.startsWith('/strategies/')) {const id=route.split('/').at(-1);if(method==='DELETE')strategyRows=strategyRows.filter(row=>row.id!==id);if(method==='PATCH')strategyRows=strategyRows.map(row=>row.id===id?{...row,...body}:row);return {id};}
  if(route==='/analytics/overview')return {metrics,equity,distribution:{wins:1,losses:1,breakeven:0},groups:Object.fromEntries(['instrument','strategy','weekday','hour','session'].map(key=>[key,group])),warnings:[],currency:'USD'};
  if(route==='/analytics/heatmap')return {year:2026,days:[{date:'2026-10-01',pnl:'30',trade_count:1,state:'positive'},{date:'2026-10-02',pnl:'-20',trade_count:1,state:'negative'},{date:'2026-10-03',pnl:'0',trade_count:0,state:'no_activity'}],months:group,hours:group,sessions:group};
  if(route==='/analytics/strategies')return {strategies:strategyRows.map(row=>({...row,metrics,equity,sample_warning:'Two trades is a small sample.'}))};
  if(route==='/analytics/risk')return {overview:{risk_per_trade:'1',daily_exposure:'20',weekly_exposure:'20'},rules:ruleRows,violations:[{trade_id:ids.trade,date:'2026-10-02',observed:'2',threshold:'1'}],compliance:[{date:'2026-10-02',checked:2,violations:1}]};
  if(route==='/risk/calculate')return {quantity:'0.5',maximum_loss:'100',assumptions:body};
  if(route==='/risk/rules') {if(method==='POST')ruleRows.push({id:ids.job,...body});return {items:ruleRows};}
  if(route.startsWith('/risk/rules/')) {if(method==='DELETE')ruleRows=[];else if(method==='PATCH')ruleRows=[{id:ids.job,...body}];return {id:ids.job};}
  if(route==='/reviews')return method==='POST'?{...job,kind:'review'}:{items:[{period:'weekly',period_start:'2026-10-01',summary:{performance:metrics,evidence_ids:[ids.trade]}}]};
  if(route==='/reports/preview')return {analytics:metrics,sections:body.sections};
  if(route==='/reports')return method==='POST'?job:{items:[job,{...job,id:ids.second,state:'failed'}]};
  if(route.endsWith('/download'))return {url:'https://storage.example.test/report.pdf'};
  if(route.startsWith('/reports/'))return job;
  if(route==='/ai/engine')return {status:'ready',name:'transport fixture',version:'not-real-inference'};
  if(route==='/ai/history'){const saved=url.searchParams.get('kind')==='market'?marketJob():job;return {items:[saved,{...saved,id:ids.second,state:'failed'}]};}
  if(route.startsWith('/ai/')){if(route.endsWith('-analysis'))activeKind=route.slice(4).replace('-analysis','');return activeKind==='market'?marketJob():job;}
  if(route==='/market/instruments')return {items:['XAUUSD','EURUSD'].map(symbol=>({symbol,name:symbol,asset_class:'fixture',tradingview_symbol:symbol==='XAUUSD'?'TVC:GOLD':'OANDA:EURUSD',timeframes:['1m','5m','15m','30m','1h','4h','1d']}))};
  if(route==='/market/preference')return {trading_style:body.trading_style || 'INTRADAY'};
  if(route==='/market/notification-preference')return {browser_notifications:body.browser_notifications};
  if(route==='/market/signals'){
    if(method==='POST'){let row=signalRows[0];if(!row){row={id:ids.trade,job_id:body.job_id,instrument:'XAUUSD',direction:body.direction,trading_style:'INTRADAY',status:'active',outcome:null,execution_confirmed:false};signalRows.push(row);}Object.assign(row,{action:body.action,mode:body.mode || row.mode});if(!alertRows.length)alertRows.push({id:ids.second,kind:'entry_watch',trigger_price:'100',enabled:true,triggered_at:null});if(!notificationRows.length)notificationRows.push({id:ids.account,instrument:'XAUUSD',trading_style:'INTRADAY',alert_type:'entry_watch',trigger_timestamp:'2026-10-10T10:00:00Z',explanation:'Synthetic price alert fixture',read_at:null});return row;}return {items:signalRows};
  }
  if(route.startsWith('/market/signals/')){Object.assign(signalRows[0],{execution_confirmed:true,...body});return signalRows[0];}
  if(route==='/market/alerts')return {items:alertRows};
  if(route.startsWith('/market/alerts/')){Object.assign(alertRows[0],body);return alertRows[0];}
  if(route==='/market/notifications')return {items:notificationRows};
  if(route.startsWith('/market/notifications/')){notificationRows[0].read_at='2026-10-10T10:01:00Z';return {read:true};}
  if(route==='/market/performance')return {total_accepted_signals:0,categories:{actual:{winrate:null},paper:{winrate:null}}};
  if(route.startsWith('/market/'))return marketContext(body.instrument || url.searchParams.get('instrument'),body.timeframe || url.searchParams.get('timeframe'));
  if(route==='/news/filters')return {countries:['US','ID'],regions:['Asia','North America'],categories:['Business']};
  if(route==='/news')return {items:[{title:'<img src=x onerror=alert(1)>',source:'Publisher',published_at:'2026-10-10',url:'https://publisher.example.test/article',country:'US',category:'Business',excerpt:'Authorized fixture excerpt.'}]};
  throw new Error('Unhandled fixture '+route);
}
const server=http.createServer(async(req,res)=>{
  try {const url=new URL(req.url,'http://127.0.0.1');if(url.pathname.startsWith('/api/v1/')) {let raw='';for await(const chunk of req)raw+=chunk;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(api(url,req.method,raw?JSON.parse(raw):{})));}
    if(url.pathname==='/') {res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/pro.css"></head><body><main><section class="pro-workspace active" id="view-pro-workspace"></section></main><script src="/js/pro.js"></script><script>window.routes=[];window.drills=[];JTPRO.configure({apiBase:location.origin,getToken:async()=>"fixture",getUserId:()=>"fixture-user",onRoute:f=>routes.push(f),onJournalFilters:f=>drills.push(f)});</script></body></html>');}
    const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))throw new Error('Invalid path');res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));
  } catch(error) {res.statusCode=500;res.end(error.message);}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.route('https://s.tradingview.com/**',route=>route.fulfill({contentType:'text/html',body:'<p>Chart embedding transport fixture</p>'}));
  await page.goto('http://127.0.0.1:'+port+'/');
  const open=feature=>page.evaluate(feature=>JTPRO.open(feature),feature);
  const click=async(selector)=>{await page.locator(selector).click();await page.waitForTimeout(100);};
  await open('ai-market');assert.equal(await page.locator('.pro-sections button').count(),10);
  {
    await page.route('**/api/v1/market/preference',route=>route.request().method()==='GET'?route.fulfill({contentType:'application/json',body:JSON.stringify({trading_style:null})}):route.continue());
    await open('ai-market');const count=requests.filter(row=>row.route==='/ai/market-analysis').length;
    await click('#pro-ai-generate');assert.equal(requests.filter(row=>row.route==='/ai/market-analysis').length,count,'Missing style submitted an AI job');
    assert.ok((await page.locator('#view-pro-workspace').textContent()).includes('Select and save your trading style first.'));
    await page.locator('#pro-market-style').selectOption('SWING');await page.waitForFunction(()=>!document.querySelector('#pro-market-style').disabled);
    assert.equal(await page.locator('#pro-timeframe-4h').getAttribute('aria-pressed'),'true');
    assert.equal(requests.filter(row=>row.route==='/ai/market-analysis').length,count,'Style change consumed AI quota');
    await page.evaluate(()=>{window.Notification=class {static permission='granted';static async requestPermission(){return 'granted';}close(){}};});
    await click('#pro-browser-notifications');assert.ok(requests.some(row=>row.route==='/market/notification-preference' && row.body.browser_notifications===true));
    await click('#pro-browser-notifications');assert.ok(requests.some(row=>row.route==='/market/notification-preference' && row.body.browser_notifications===false));
    await page.unroute('**/api/v1/market/preference');await open('ai-market');
  }
  {
    let releaseRefresh,refreshStarted;
    const refreshPending=new Promise(resolve=>releaseRefresh=resolve),refreshReceived=new Promise(resolve=>refreshStarted=resolve);
    await page.route('**/api/v1/market/refresh',async route=>{refreshStarted();await refreshPending;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Old M15 fixture unavailable'})});});
    await page.locator('#pro-market-refresh').click();await refreshReceived;
    await page.locator('#pro-timeframe-4h').click();
    await page.waitForFunction(()=>document.querySelector('#pro-timeframe-4h').getAttribute('aria-pressed')==='true' && !document.querySelector('#pro-ai-generate').disabled);
    const currentEvidence=await page.locator('#view-pro-workspace').textContent();
    releaseRefresh();await page.waitForFunction(()=>!document.querySelector('#pro-market-refresh').disabled);
    assert.equal(await page.locator('#pro-ai-generate').isDisabled(),false,'An old failed M15 refresh disabled the loaded H4 selection');
    assert.ok(!(await page.locator('#view-pro-workspace').textContent()).includes('Old M15 fixture unavailable'),'An old refresh failure replaced current market freshness');
    assert.ok(currentEvidence.includes('Last recorded price: 100'));
    await page.unroute('**/api/v1/market/refresh');
  }
  {
    await page.route('**/api/v1/market/instruments',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({items:['XAUUSD','EURUSD'].map(symbol=>({symbol,name:symbol,asset_class:'fixture',tradingview_symbol:symbol==='XAUUSD'?'TVC:GOLD':'OANDA:EURUSD',timeframes:symbol==='XAUUSD'?['15m','4h']:['15m']}))})}));
    await open('ai-market');
    let releaseH4,h4Started;
    const h4Pending=new Promise(resolve=>releaseH4=resolve),h4Received=new Promise(resolve=>h4Started=resolve);
    await page.route('**/api/v1/market/context?*',async route=>{const url=new URL(route.request().url());if(url.searchParams.get('timeframe')!=='4h')return route.continue();h4Started();await h4Pending;await route.fulfill({contentType:'application/json',body:JSON.stringify(marketContext('XAUUSD','4h'))});});
    await page.locator('#pro-timeframe-4h').click();await h4Received;
    await page.locator('#pro-market-instrument').selectOption('EURUSD');
    await page.waitForFunction(()=>!document.querySelector('#pro-market-instrument').disabled);
    assert.equal(await page.locator('#pro-timeframe-4h').isDisabled(),true);
    releaseH4();await page.waitForFunction(()=>!document.querySelector('#pro-timeframe-4h').dataset.running);
    assert.equal(await page.locator('#pro-timeframe-4h').isDisabled(),true,'A finished XAUUSD H4 action enabled an unsupported EURUSD timeframe');
    assert.equal(await page.locator('#pro-timeframe-15m').getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#pro-ai-generate').isDisabled(),false);
    await page.unroute('**/api/v1/market/context?*');await page.unroute('**/api/v1/market/instruments');
  }
  await click('.pro-sections [data-section=analytics]');assert.equal((await page.evaluate(()=>routes)).at(-1),'analytics');
  await open('analytics');assert.equal(await page.locator('.pro-kpis .pro-panel').count(),4);await page.locator('#pro-start').fill('2026-10-01');await click('#pro-apply-filters');assert.ok(requests.at(-1).query.includes('start=2026-10-01'));await page.locator('#pro-chart-period').selectOption('month');await page.getByRole('button',{name:'View trades',exact:true}).first().click();assert.equal((await page.evaluate(()=>drills))[0].instrument,'EURUSD');
  await open('heatmap');assert.equal(await page.locator('.pro-day').count(),3);await page.locator('.pro-day').first().click();await page.getByRole('button',{name:'View trades',exact:true}).first().click();await page.locator('#pro-heatmap-metric').selectOption('trade_count');await page.getByRole('button',{name:'Previous year'}).click();
  await open('strategies');await page.locator('.pro-check input').nth(0).check();await page.locator('.pro-check input').nth(1).check();await click('#pro-strategy-compare');assert.ok(requests.at(-1).query.includes('strategy_ids='));await page.getByRole('button',{name:'Add strategy'}).click();await page.locator('#pro-strategy-name').fill('New strategy');await page.locator('#pro-strategy-description').fill('Saved description');await click('#pro-strategy-save');assert.ok(strategyRows.some(row=>row.name==='New strategy'));await page.getByRole('button',{name:'Edit',exact:true}).first().click();await page.locator('#pro-strategy-name').fill('Edited strategy');await click('#pro-strategy-save');await page.getByRole('button',{name:'Delete',exact:true}).last().click();await page.getByRole('button',{name:'Reset',exact:true}).click();
  await open('risk');for(const [key,value] of Object.entries({balance:'10000',risk_percent:'1',entry:'2000',stop:'1980',contract_size:'100',quantity_step:'0.01',quote_to_account_rate:'1'}))await page.locator('#pro-risk-'+key).fill(value);await click('#pro-risk-calculate');assert.ok(requests.some(row=>row.route==='/risk/calculate'));await page.getByRole('button',{name:'Add rule'}).click();await page.getByText('Rule name',{exact:true}).locator('..').locator('input').fill('Daily loss');await page.getByText('Threshold',{exact:true}).locator('..').locator('input').fill('100');await click('#pro-risk-rule-save');assert.equal(ruleRows.length,1);await page.getByRole('button',{name:'Edit',exact:true}).click();await click('#pro-risk-rule-save');await page.getByRole('button',{name:'Delete',exact:true}).click();assert.equal(ruleRows.length,0);
  await open('reviews');await page.locator('#pro-review-period').selectOption('monthly');await page.getByRole('button',{name:'Previous period'}).click();await click('#pro-review-generate');assert.ok(requests.some(row=>row.route==='/reviews'&&row.method==='POST'));await page.getByRole('button',{name:'Open review'}).click();
  await open('reports');await click('#pro-report-preview');await click('#pro-report-generate');await page.getByRole('button',{name:'Download',exact:true}).click();await page.getByRole('link',{name:'Download PDF'}).waitFor();assert.equal(await page.getByRole('link',{name:'Download PDF'}).count(),1);await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('button',{name:'View status'}).first().click();await page.getByRole('button',{name:'Delete',exact:true}).first().click();
  for(const feature of ['ai-behaviour','ai-market','ai-journal']) {await open(feature);await click('#pro-ai-generate');assert.ok(requests.some(row=>row.route==='/ai/'+feature.slice(3)+'-analysis'));await page.getByRole('button',{name:'Open analysis'}).first().click();await page.getByRole('button',{name:'Retry',exact:true}).click();if(feature==='ai-market'){await page.locator('#pro-market-instrument').selectOption('EURUSD');await click('#pro-timeframe-4h');assert.ok((await page.locator('#view-pro-workspace').textContent()).includes('Displayed analysis belongs to XAUUSD / 15m'));await click('#pro-market-refresh');}}
  await open('global-news');await page.locator('#pro-news-q').fill('rates');await click('#pro-news-search');assert.ok(requests.at(-1).query.includes('q=rates'));assert.equal(await page.locator('img').count(),0);assert.ok((await page.locator('#view-pro-workspace').textContent()).includes('<img src=x onerror=alert(1)>'));await page.getByRole('button',{name:'Reset',exact:true}).click();
  actionableFixture=true;activeKind='market';await open('ai-market');await page.getByRole('button',{name:'Open analysis'}).first().click();
  await page.getByRole('button',{name:'Watch only / create price alerts'}).click();await page.waitForTimeout(100);assert.equal(signalRows[0].action,'watch');assert.equal(signalRows[0].execution_confirmed,false);
  await page.getByRole('button',{name:'Take this signal'}).click();await page.waitForTimeout(100);assert.equal(signalRows[0].action,'take');assert.equal(signalRows[0].execution_confirmed,false);
  await page.getByRole('button',{name:'Confirm execution',exact:true}).click();await page.locator('[id^=pro-execution-price-]').fill('101');await page.locator('[id^=pro-execution-time-]').fill('2026-10-10T12:30');await page.getByRole('button',{name:'Save execution confirmation'}).click();await page.waitForTimeout(100);assert.equal(signalRows[0].execution_confirmed,true);
  await page.getByLabel('Watch price',{exact:true}).fill('102');await page.getByRole('button',{name:'Save watch price'}).click();await page.waitForTimeout(100);assert.equal(alertRows[0].trigger_price,'102');
  await page.getByRole('button',{name:'Disable alert'}).click();await page.waitForTimeout(100);assert.equal(alertRows[0].enabled,false);await page.getByRole('button',{name:'Enable alert'}).click();await page.waitForTimeout(100);assert.equal(alertRows[0].enabled,true);
  await click('#pro-signal-notifications');await page.getByRole('button',{name:'Mark as read'}).scrollIntoViewIfNeeded();await page.waitForTimeout(100);await page.getByRole('button',{name:'Mark as read'}).click();await page.waitForTimeout(100);assert.ok(notificationRows[0].read_at,JSON.stringify({requests:requests.slice(-5),alerts:await page.locator('[role=alert]').allTextContents(),errors}));
  await page.getByRole('button',{name:'Dismiss signal',exact:true}).first().click();await page.waitForTimeout(100);assert.equal(signalRows[0].action,'dismiss');
  for(const feature of Object.keys(await page.evaluate(()=>JTPRO.features))) {await page.setViewportSize({width:375,height:900});await open(feature);assert.equal(await page.locator('#pro-section-selector').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'mobile overflow '+feature);}
  assert.deepEqual(errors,[]);assert.ok(requests.filter(row=>row.method==='POST').length>=10);console.log('Ten Pro pages, market selection races and control transport checks passed at desktop and mobile widths; provider integrations were fixtures.');await browser.close();server.close();
})().catch(error=>{console.error(error);server.close();process.exitCode=1;setTimeout(()=>process.exit(1),300);});
