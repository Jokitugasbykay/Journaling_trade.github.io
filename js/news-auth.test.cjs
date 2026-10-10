const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const extract = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));
const founder = {id:'a', email:'kaylafisika24@gmail.com', email_confirmed_at:'2026-10-01'};
const deferred = () => { let resolve; const promise = new Promise(yes => resolve = yes); return {promise, resolve}; };

function authHarness(user = founder, plan = 'free') {
  const nodes = new Map();
  const ctx = {
    cloudUser:user, cloudReady:false, nicknameReady:false, accountAccess:null, hydratingUserId:'',
    journalOwner:'a', trades:[], accounts:[], profile:{name:''}, onboarding:{}, language:'en', uiText:(_id,en)=>en,
    cloudAccountIds:new Map(), cloudTradeIds:new Map(), cloudStrategyIds:new Map(), localAccountIds:new Map(), cloudSnapshot:'',
    localStorage:{getItem:()=>null}, structuredClone, confirm:()=>false,
    serverUser:user, serverPlan:plan, journalError:Error('Temporary journal HTTP 503'), errors:[], publisherNews:{items:['saved headline']}, closeMenuCalls:0,
    console:{error:(...values)=>ctx.errors.push(values)}, cloudMessage:error=>error.message,
    renderNewsRegionControls(){}, renderAccountAccess(){}, renderNewsReader(){}, renderJournalTable(){}, renderStatistics(){}, renderProfileView(){}, runAllCalculators(){},
    updateAccess(){}, resetNewsRegion(){}, selectJournalOwner:id=>ctx.journalOwner = id, closeNavAccountDropdown(){ctx.closeMenuCalls++;},
    resetNewsData:()=>ctx.publisherNews = null, persistOnboarding(){}, persistCloudMaps(){}, saveLocalData(){}, scheduleCloudSave(){},
    googleAccountProfile:()=>null, switchTab(){}, setAuthMode(){}, uploadAllowanceText:()=>'',
    $:id=>{ if (!nodes.has(id)) nodes.set(id, {textContent:'',value:'',classList:{contains:()=>false}}); return nodes.get(id); }
  };
  ctx.cloudClient = {
    auth:{getUser:async()=>({data:{user:ctx.serverUser},error:null})},
    rpc:async()=>({data:{plan:ctx.serverPlan,allowed:true,remaining:10}}),
    from(table) {
      const query = {select:()=>query,eq:()=>query,
        maybeSingle:async()=>({data:{display_name:'Verified reader',nickname_set:true}}),
        then:resolve=>table === 'trading_accounts' && ctx.journalPromise ? ctx.journalPromise.then(resolve) : resolve(table === 'trading_accounts' ? {data:null,error:ctx.journalError} : {data:[]})};
      return query;
    }
  };
  vm.createContext(ctx);
  vm.runInContext(extract('      const FOUNDER_EMAILS =','      let accountAccess =') +
    extract('      function canReadNews()', '      function uploadAllowanceText()') +
    extract('      function handleCloudSignedOut()', '      function saveLocalData()'), ctx);
  return {ctx,get:code=>vm.runInContext(code,ctx)};
}

function routeHarness() {
  const nodes = new Map();
  const ctx = {URL,URLSearchParams,location:new URL('https://journal.example/economic-news/?article=00000000000000000001'),
    document:{baseURI:'https://journal.example/',body:{classList:{toggle(){}}},querySelectorAll:()=>[]},
    cloudUser:founder,cloudReady:false,nicknameReady:true,onboarding:{started:true},readerId:null,
    $:id=>{if (!nodes.has(id)) nodes.set(id,{classList:{toggle(){},contains:()=>false},focus(){}});return nodes.get(id);},
    showAuthMode(){},persistOnboarding(){},updateAccess(){},renderStatistics(){},renderJournalTable(){},renderProfileView(){},runAllCalculators(){},renderEconomicCalendar(){},reloadPublisherNews(){},applyLanguage(){},scrollTo(){},
    renderNewsReader:()=>ctx.readerId = new URLSearchParams(ctx.location.search).get('article'),
    renderPublisherNews:()=>ctx.renderNewsReader(),
    switchBeritaSub:()=>ctx.renderNewsReader(),
    history:{pushState:(_data,_title,path)=>ctx.location = new URL(path,ctx.location),replaceState:(_data,_title,path)=>ctx.location = new URL(path,ctx.location)}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(extract('      const pageRoutes =','      function persistOnboarding()') +
    extract('      function restoreRoute()', '      /* Initial Startup */'), ctx);
  return ctx;
}

(async()=>{
  for (const [user,plan] of [[founder,'free'],[{id:'a',email:'paid@example.com',email_confirmed_at:'2026-10-01'},'plus']]) {
    const h = authHarness(user,plan);
    await h.ctx.hydrateCloud(user);
    assert.equal(h.ctx.cloudUser?.id,user.id,'Journal failure cleared a still-verified authentication session');
    assert.equal(h.ctx.cloudReady,false,'Journal writes became available after incomplete hydration');
    assert.equal(h.ctx.canReadNews(),true,'A verified reader lost news access after an unrelated journal failure');
    assert.equal(h.ctx.publisherNews?.items[0],'saved headline','Journal failure discarded saved headlines');
  }
  console.log('A journal 503 preserves verified founder/paid news access while journal writes stay disabled');

  const delayed = authHarness({id:'a',email:'paid@example.com',email_confirmed_at:'2026-10-01'},'plus');
  const journal = deferred();delayed.ctx.journalPromise = journal.promise;
  const hydration = delayed.ctx.hydrateCloud(delayed.ctx.serverUser);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(delayed.ctx.canReadNews(),true,'A slow journal table blocked already-verified paid news access');
  assert.equal(delayed.ctx.cloudReady,false,'An incomplete journal became writable');
  journal.resolve({data:[]});await hydration;
  assert.equal(delayed.ctx.cloudReady,true);
  console.log('Verified news becomes available while unrelated journal rows are still loading');

  const retry = authHarness();
  await retry.ctx.hydrateCloud(founder);
  retry.ctx.cloudClient.auth.getUser = async()=>({data:{user:null},error:{name:'AuthRetryableFetchError',status:0,message:'Failed to fetch'}});
  assert.equal(await retry.ctx.verifyNewsIdentity('a'),true);
  assert.equal(retry.ctx.canReadNews(),true,'A retryable network outage revoked an already-verified identity');
  retry.ctx.cloudClient.auth.getUser = async()=>({data:{user:null},error:{name:'AuthApiError',status:401,message:'Invalid token'}});
  assert.equal(await retry.ctx.verifyNewsIdentity('a'),false);
  assert.equal(retry.ctx.canReadNews(),false,'An explicit invalid token retained news authorization');

  const unverified = authHarness();
  unverified.ctx.accountAccess = {plan:'pro'};
  unverified.ctx.nicknameReady = true;
  assert.equal(unverified.ctx.canReadNews(),false,'An unverified local paid plan granted news access');
  unverified.ctx.cloudClient.auth.getUser = async()=>({data:{user:null},error:{name:'AuthRetryableFetchError',status:0}});
  await unverified.ctx.hydrateCloud(founder);
  assert.equal(unverified.ctx.canReadNews(),false,'A cached founder email bypassed the initial server identity verification');
  const unconfirmed = authHarness({...founder,email_confirmed_at:null});
  await unconfirmed.ctx.hydrateCloud(unconfirmed.ctx.serverUser);
  assert.equal(unconfirmed.ctx.isNewsFounder(),false,'An unconfirmed founder email acquired founder status');
  assert.equal(unconfirmed.ctx.canReadNews(),false);
  const paidNoPlan = authHarness({id:'a',email:'paid@example.com',email_confirmed_at:'2026-10-01'},'plus');
  paidNoPlan.ctx.cloudClient.rpc = async()=>({error:Error('Plan HTTP 503')});
  await paidNoPlan.ctx.hydrateCloud(paidNoPlan.ctx.serverUser);
  assert.equal(paidNoPlan.ctx.canReadNews(),false,'A failed initial server plan check granted paid access');
  console.log('Retryable errors preserve prior verification; invalid tokens and unverified emails never grant access');

  const stale = authHarness();
  await stale.ctx.hydrateCloud(founder);
  const pending = deferred();
  stale.ctx.cloudClient.auth.getUser = ()=>pending.promise;
  const refresh = stale.ctx.verifyNewsIdentity('a');
  stale.ctx.handleCloudSignedOut();
  pending.resolve({data:{user:founder},error:null});
  assert.equal(await refresh,false);
  assert.equal(stale.ctx.canReadNews(),false);
  assert.equal(stale.ctx.publisherNews,null);
  assert.equal(stale.get('verifiedNewsUserId'),'');
  console.log('Logout rejects a late identity response and clears visible saved news');

  for (const ready of [false,true]) {
    const logout = authHarness();await logout.ctx.hydrateCloud(founder);
    const saved = new Map([['fncjt_trades_a','[{"id":"unsaved-local-copy"}]']]);
    logout.ctx.localStorage = {getItem:key=>saved.get(key) ?? null,setItem:(key,value)=>saved.set(key,value)};
    logout.ctx.cloudReady = ready;logout.ctx.cloudBusy = false;logout.ctx.cloudTimer = null;logout.ctx.clearTimeout = clearTimeout;
    let syncCalls=0,signOutCalls=0;
    logout.ctx.syncCloud = async()=>{syncCalls++;return false};
    logout.ctx.cloudClient.auth.signOut = async()=>{signOutCalls++;return {error:null}};
    logout.ctx.window = logout.ctx;
    vm.runInContext(extract('      window.signOutLocal =','      /* Header Account Dropdown Menu */'),logout.ctx);
    logout.ctx.signOutLocal();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(syncCalls,ready?1:0,'Incomplete journal hydration attempted a cloud overwrite before logout');
    assert.equal(signOutCalls,ready?0:1,'Logout was blocked by incomplete hydration or ignored an actual sync failure');
    assert.equal(logout.ctx.cloudUser?.id,ready?'a':undefined);
    assert.equal(logout.ctx.closeMenuCalls,ready?0:1,'The menu must close only after successful logout');
    assert.equal(saved.get('fncjt_trades_a'),'[{"id":"unsaved-local-copy"}]','Logout erased the account-scoped local journal');
  }
  console.log('Incomplete hydration allows explicit logout; failed ready-state sync protects the local journal');

  const route = routeHarness();
  route.restoreRoute();
  assert.equal(route.location.search,'?article=00000000000000000001','Cold route restoration cleared the bookmarked story');
  route.switchTab('berita',false);
  assert.equal(route.readerId,'00000000000000000001','Silent access updates closed the reader');
  route.switchTab('berita');
  assert.equal(route.location.search,'','Explicit News navigation did not exit the article route');
  assert.equal(route.readerId,null,'The URL changed but the article reader remained open');
  console.log('Cold bookmarks and silent updates preserve the reader; explicit News navigation returns to the list');
})().catch(error=>{console.error(error);process.exitCode=1;});
