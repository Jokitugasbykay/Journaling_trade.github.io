const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(__dirname,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
{
  const helpers = source.slice(source.indexOf('      const publisherDomains ='), source.indexOf('      const newsText ='))
    + source.slice(source.indexOf('      function publisherUrl('), source.indexOf('      function publisherTime('));
  const urlFor = vm.runInNewContext(helpers + '\npublisherUrl', {URL});
  for (const [id, url] of Object.entries({ap:'https://apnews.com/article/example', bbc:'https://www.bbc.co.uk/news/articles/example', afp:'https://www.afp.com/en', wsj:'https://www.wsj.com/sports/example', guardian:'https://www.theguardian.com/world/example', ft:'https://www.ft.com/content/example', dw:'https://www.dw.com/en/example/a-123'})) {
    assert.equal(urlFor(url,id), url);
  }
  assert.equal(urlFor('https://www.bbc.com/news','bbc'), 'https://www.bbc.com/news');
  assert.equal(urlFor('https://bbc.co.uk.evil.test/news','bbc'), null);
  assert.equal(urlFor('https://bbc.com@evil.test/news','bbc'), null);
  assert.equal(urlFor('https://apnews.com/article/example','unknown'), null);
  const imageFor = vm.runInNewContext(helpers + "\npublisherDomains.china='chinadaily.com.cn';\n" + source.slice(source.indexOf('      function publisherImageUrl('), source.indexOf('      function newsArticlePath(')) + '\npublisherImageUrl', {URL, document:{baseURI:'https://example.com/Journaling_trade.github.io/', location:{origin:'https://example.com'}}, pagePath:route=>'/Journaling_trade.github.io/'+route+'/'});
  for (const url of ['https://live-production.wcms.abc-cdn.net.au/photo.jpg','https://static.ffx.io/photo.jpg','https://www.chinadaily.com.cn/photo.jpg']) assert.equal(imageFor(url),url);
  const localImage = 'news/images/' + 'a'.repeat(64) + '.webp';
  assert.equal(imageFor(localImage), 'https://example.com/Journaling_trade.github.io/' + localImage);
  assert.equal(imageFor('../news/images/' + 'a'.repeat(64) + '.webp'), null);
  for (const url of ['http://static.ffx.io/photo.jpg','https://ffx.io.evil.test/photo.jpg','https://user:password@static.ffx.io/photo.jpg','https://unknown.test/photo.jpg','javascript:alert(1)']) assert.equal(imageFor(url),null);
}
{
  const context = {cloudUser:null, URL};
  vm.runInNewContext(source.slice(source.indexOf('      function googleAccountProfile()'), source.indexOf('      window.renderProfileView =')), context);
  assert.equal(context.googleAccountProfile(), null);
  context.cloudUser = {email:'test@example.com', app_metadata:{provider:'email'}, user_metadata:{name:'Local'}};
  assert.equal(context.googleAccountProfile(), null);
  context.cloudUser = {email:'test@example.com', identities:[{provider:'google', identity_data:{name:'Google Name', picture:'https://lh3.googleusercontent.com/photo'}}]};
  assert.equal(context.googleAccountProfile().name, 'Google Name');
  assert.equal(context.googleAccountProfile().avatar, 'https://lh3.googleusercontent.com/photo');
  context.cloudUser.user_metadata = {picture:'https://evilgoogleusercontent.com/photo'};
  assert.equal(context.googleAccountProfile().avatar, '');
}
const vendor=fs.readFileSync(path.join(__dirname,'vendor/supabase-2.86.0.js'));
assert.ok(html.includes('sha384-'+crypto.createHash('sha384').update(vendor).digest('base64')));
assert.ok(html.includes("object-src 'none'"));assert.ok(!html.includes('src="https://cdn.jsdelivr.net/npm/@supabase'));
assert.ok(!source.includes('buildDefaultCalendarEvents'));assert.ok(!source.includes('(Live)'));
const readNews=vm.runInNewContext(source.slice(source.indexOf('      function canReadNews()'),source.indexOf('      async function refreshAccountAccess('))+'\ncanReadNews', {cloudUser:{id:'a'},cloudReady:false,verifiedNewsUserId:'',nicknameReady:true,accountAccess:{plan:'pro'}});assert.equal(readNews(),false);
for(const name of ['toggleBillingCycle','openQuickTrade','openProfileModal']) assert.ok(!source.includes('window.'+name+' ='));
{
  const headerNodes=new Map();
  const header={cloudUser:{id:'a'},onboarding:{name:'Alice'},profile:{name:'Alice'},accountAccess:null,founder:false,window:{},uiText:(_id,en)=>en,
    googleAccountProfile:()=>null,isNewsFounder:()=>header.founder,renderProNavigation(){},uploadAllowanceText:()=>'',canReadNews:()=>false,
    $:id=>{if(!headerNodes.has(id))headerNodes.set(id,{hidden:false,classList:{contains:()=>false}});return headerNodes.get(id);}};
  vm.runInNewContext(source.slice(source.indexOf('      function renderAccountAccess()'),source.indexOf('      function disciplineMetrics(')),header);
  header.renderAccountAccess();assert.equal(headerNodes.get('nav-account-plan').textContent,'Checking plan…');
  header.accountAccess={plan:'plus'};header.renderAccountAccess();assert.equal(headerNodes.get('nav-account-plan').textContent,'Plus');assert.equal(headerNodes.get('nav-dd-plan').textContent,'Plus');
  header.accountAccess={plan:'pro'};header.renderAccountAccess();assert.equal(headerNodes.get('nav-account-plan').textContent,'Pro');
  header.founder=true;header.renderAccountAccess();assert.equal(headerNodes.get('nav-account-plan').textContent,'Founder');
  header.founder=false;header.cloudUser=null;header.accountAccess=null;header.onboarding.name='';header.profile.name='Trader';header.renderAccountAccess();
  assert.equal(headerNodes.get('nav-login-label').hidden,false);assert.equal(headerNodes.get('nav-account-copy').hidden,true);assert.equal(headerNodes.get('nav-dd-username').textContent,'Welcome');
}
(async()=>{
  {
    const nodes = new Map();
    const get = id => { if(!nodes.has(id)) nodes.set(id,{hidden:false,disabled:false,setAttribute(){},classList:{toggle(){},contains(){return false;}}});return nodes.get(id); };
    const buttons = [Object.assign(get('nav-pro'),{dataset:{proTab:'workspace'}})];
    let bridge, opened = [];
    const pro = {cloudUser:{id:'user-a'},verifiedNewsUserId:'user-a',cloudReady:true,nicknameReady:true,$:get,clearTimeout(){},setTimeout:()=>1,
      JTPRO:{configure(options){bridge=options;},open(feature){opened.push(feature);}},JTPRO_CONFIG:{apiBase:''},
      document:{querySelectorAll:selector=>selector==='.nav-tab'||selector==='[data-pro-tab]'?buttons:[],body:{classList:{remove(){}}}},
      location:{pathname:'/analytics/'},history:{pushState(){}},pagePath:path=>'/'+path+'/',scrollTo(){}};
    pro.window=pro;
    vm.runInNewContext(source.slice(source.indexOf('      const proFeatures ='),source.indexOf('      function renderAccountAccess()')),pro);
    pro.renderProNavigation();assert.equal(get('nav-ai-trading').hidden,false);assert.ok(buttons.every(b=>b.hidden&&b.disabled));
    bridge.onAccessChange({plan:'pro',effective_until:'2099-01-01T00:00:00Z'});
    assert.equal(get('nav-ai-trading').hidden,true);assert.ok(buttons.every(b=>!b.hidden&&!b.disabled));
    await pro.openProWorkspace();assert.deepEqual(opened,['ai-market']);
    await pro.openProAnalytics(9);assert.deepEqual(opened,['ai-market','global-news']);
    await pro.openProAnalytics(10);assert.equal(opened.at(-1),'ai-chat');
    await pro.openProAnalytics(11);assert.equal(opened.length,3);
    bridge.onAccessChange({plan:'pro',effective_until:'2000-01-01T00:00:00Z'});
    assert.equal(get('nav-ai-trading').hidden,false);assert.ok(buttons.every(b=>b.hidden&&b.disabled));
    bridge.onAccessChange({plan:'plus'});assert.equal(get('nav-ai-trading').disabled,true);
    pro.isNewsFounder=()=>true;bridge.onAccessChange({plan:'free'});assert.ok(buttons.every(b=>b.hidden&&b.disabled),'Founder label alone must not unlock Pro');
    bridge.onAccessChange({plan:'pro',effective_until:'2099-01-01T00:00:00Z'});pro.cloudUser={id:'user-b'};pro.renderProNavigation();
    assert.ok(buttons.every(b=>b.hidden&&b.disabled),'Account changes must deny old verified Pro entitlements');
    assert.equal(bridge.getUserId(),'');pro.verifiedNewsUserId='user-b';assert.equal(bridge.getUserId(),'user-b');pro.cloudReady=false;assert.equal(bridge.getUserId(),'user-b');pro.nicknameReady=false;assert.equal(bridge.getUserId(),'');
    const stack=['/home/','/pro?section=ai-market'];let cursor=1,restored='';
    const move=path=>{const url=new URL(path,'https://example.test');Object.assign(pro.location,{pathname:url.pathname,search:url.search,hash:url.hash});};
    Object.assign(pro,{URL,URLSearchParams,pageRoutes:{beranda:'home'},onboarding:{started:true},switchTab:tab=>{restored=tab;}});
    pro.document.baseURI='https://example.test/';
    pro.history={pushState(_state,_title,path){stack.splice(cursor+1);stack.push(path);cursor++;move(path);},replaceState(_state,_title,path){stack[cursor]=path;move(path);}};
    pro.JTPRO.open=feature=>{opened.push(feature);bridge.onRoute(feature);};
    vm.runInNewContext(source.slice(source.indexOf('      function restoreRoute()'),source.indexOf('      /* Initial Startup */')),pro);
    move(stack[cursor]);pro.restoreRoute();
    assert.deepEqual(stack,['/home/','/pro/'],'Restoring an explicit market deep link must replace its URL without adding a history entry');
    assert.equal(cursor,1);assert.equal(opened.at(-1),'ai-market');
    move(stack[--cursor]);pro.restoreRoute();
    assert.equal(restored,'beranda');assert.equal(cursor,0);assert.equal(pro.location.pathname,'/home/');assert.deepEqual(stack,['/home/','/pro/']);
  }
  const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
  assert.equal((html.match(/data-pro-tab=/g)||[]).length,1);
  assert.ok(html.includes('onclick="openProWorkspace()"'));
  assert.ok(!/<button[^>]*id="nav-ai-trading"[^>]*onclick=/.test(html));
  const shellNav=html.match(/<nav\b[^>]*\bclass="[^"]*\bshell-nav\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  const topButtons=[...shellNav.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(match=>match[0]).filter(button=>!button.includes('id="nav-ai-trading"'));
  assert.equal(topButtons.filter(button=>button.includes('id="nav-pro"')).length,1,'The shell must have exactly one Pro navigation button');
  const proPosition=topButtons.findIndex(button=>button.includes('id="nav-pro"'));
  assert.ok(topButtons[proPosition].includes('>Pro</button>'));assert.ok(topButtons[proPosition-1].includes('data-tab="berita"'),'Pro must follow Economic news');
  const appRevision=html.match(/<script src="js\/app\.js\?v=([^"]+)"/)?.[1];
  assert.ok(appRevision);assert.notEqual(appRevision,'20261010-account-switch','The new Pro handler requires a revised app.js URL for returning clients');
  const calls=[];
  const ctx={accounts:[{id:'a',startBalance:1}],trades:[{id:'t',accountId:'a',strategy:'s'}],profile:{name:'A'},cloudUser:{id:'user-a'},cloudReady:true,nicknameReady:true,cloudBusy:false,localRevision:0,
    cloudAccountIds:new Map([['a','a-id']]),cloudTradeIds:new Map([['t','t-id']]),cloudStrategyIds:new Map([['s','s-id']]),localAccountIds:new Map(),
    uuidFor:(map,id)=>map.get(id),journalFingerprint:()=> 'snapshot',tradeTimestamp:()=>null,finiteOrNull:()=>null,
    persistCloudMaps(){throw new Error('Stale maps persisted')},scheduleCloudSave(){},cloudMessage:()=>'', $:()=>null,console,
    cloudClient:{from(table){return {async upsert(rows){calls.push({table,rows});ctx.cloudUser={id:'user-b'};ctx.trades=[{id:'b'}];return {}}}}}};
  vm.runInNewContext(source.slice(source.indexOf('      async function syncCloud()'),source.indexOf('      const cloudTradeIds')),ctx);
  assert.equal(await ctx.syncCloud(),false);assert.equal(calls.length,1);assert.equal(calls[0].rows[0].user_id,'user-a');
  const node={classList:{remove(){}},replaceChildren(){},hidden:false};
  const scope={cloudTimer:null,scanJob:0,currentScan:{text:'private'},parsedTradesToImport:[{}],currentEditingTradeId:'t',cloudSnapshot:'',cloudAccountIds:new Map(),cloudStrategyIds:new Map(),cloudTradeIds:new Map(),localAccountIds:new Map(),updateAccess(){},renderJournalTable(){},renderProfileView(){},renderStatistics(){},runAllCalculators(){},clearTimeout(){},closeUploadModal(){},closeTradeForm(){},loadData(){},onboarding:{},profile:{name:'A'},$:()=>node};
  vm.runInNewContext(source.slice(source.indexOf('      function selectJournalOwner('),source.indexOf('      function handleCloudSignedOut()')),scope);
  scope.selectJournalOwner('user-a');assert.equal(scope.K_TRADES,'fncjt_trades_user-a');assert.equal(scope.scanStorageKey,'fncjt_scans_user-a');assert.equal(scope.currentScan,null);
  scope.selectJournalOwner('user-b');assert.equal(scope.K_TRADES,'fncjt_trades_user-b');scope.selectJournalOwner();assert.equal(scope.scanStorageKey,'fncjt_scans');
  const persistedGuestProfiles=[];
  Object.assign(scope,{cloudAuthRevision:0,founderUserId:'user-a',verifiedNewsUserId:'user-a',hydratingUserId:'user-a',cloudUser:{id:'user-a'},cloudReady:true,nicknameReady:true,accountAccess:{plan:'pro'},resetNewsData(){},resetNewsRegion(){},persistOnboarding(){persistedGuestProfiles.push(JSON.stringify(scope.onboarding));}});
  scope.loadData=()=>{scope.profile={name:'Trader'};};
  scope.onboarding.name='Previous server trader';
  vm.runInNewContext(source.slice(source.indexOf('      function handleCloudSignedOut()'),source.indexOf('      async function hydrateCloud(')),scope);
  scope.handleCloudSignedOut();
  assert.equal(scope.cloudUser,null);assert.equal(scope.accountAccess,null);assert.equal(scope.verifiedNewsUserId,'');
  assert.equal(scope.onboarding.name,'','The default guest name must not create a signed-in header');
  assert.equal(JSON.parse(persistedGuestProfiles.at(-1)).name,'','Logout must persist the cleared guest identity');
  scope.loadData=()=>{scope.profile={name:'Local analyst'};};
  scope.handleCloudSignedOut();
  assert.equal(scope.onboarding.name,'Local analyst','A meaningful guest name must survive returning from a cloud account');
  assert.equal(JSON.parse(persistedGuestProfiles.at(-1)).name,'Local analyst');
  const input={value:'Alice',setCustomValidity(){},reportValidity:()=>true};
  const nickname={cloudUser:{id:'user-a'},journalOwner:'user-a',profile:{name:'Bob'},onboarding:{},nicknameReady:false,language:'en',cloudMessage:()=>'', $:id=>id==='nickname-input'?input:{querySelector:()=>({})},
    cloudClient:{from:()=>({async upsert(){nickname.cloudUser={id:'user-b'};nickname.journalOwner='user-b';return{}}})}};
  nickname.window=nickname;
  vm.runInNewContext(source.slice(source.indexOf('      window.saveNickname ='),source.indexOf("      $('nickname-input').addEventListener")),nickname);
  await nickname.saveNickname({preventDefault(){}});assert.equal(nickname.profile.name,'Bob');assert.equal(nickname.nicknameReady,false);
  let reader;
  const restore={journalOwner:'user-a',accounts:['B'],FileReader:class{constructor(){reader=this}readAsText(){}},window:{}};
  vm.runInNewContext(source.slice(source.indexOf('      window.handleRestoreFile ='),source.indexOf('      window.exportCSV')),restore);
  restore.window.handleRestoreFile({files:[{size:1}]});restore.journalOwner='user-b';reader.onload({target:{result:'{"accounts":[],"trades":[]}'}});assert.equal(restore.accounts[0],'B');
  let queued = 0, saved = {};
  const autosave = {localRevision:0, accounts:[{id:'a'}], trades:[{id:'t'}], settings:{}, profile:{name:'Alice'}, K_ACCOUNTS:'accounts',K_TRADES:'trades',K_SETTINGS:'settings',K_PROFILE:'profile', localStorage:{setItem:(key,value)=>saved[key]=value}, scheduleCloudSave:()=>queued++, window:{}, console};
  vm.runInNewContext(source.slice(source.indexOf('      function saveData()'),source.indexOf('      function cloudMessage(')),autosave);
  autosave.saveData(); assert.equal(JSON.parse(saved.trades)[0].id,'t'); assert.equal(queued,1);
  const schedule = {cloudUser:null, cloudReady:true, nicknameReady:true, cloudTimer:null, clearTimeout(){}, setTimeout:()=>++queued, syncCloud(){}, $:()=>({}),language:'en',uiText:(_id,en)=>en};
  vm.runInNewContext(source.slice(source.indexOf('      function scheduleCloudSave()'),source.indexOf('      function migrateLegacyJournal()')),schedule);
  schedule.scheduleCloudSave(); assert.equal(queued,1);
  schedule.cloudUser={id:'a'}; schedule.scheduleCloudSave(); assert.equal(queued,2);
  assert(source.includes("window.addEventListener('online', scheduleCloudSave)"));
  console.log('Account ownership, Pro navigation/history/cache, stale sync/restore/nickname, vendor integrity and calendar checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
