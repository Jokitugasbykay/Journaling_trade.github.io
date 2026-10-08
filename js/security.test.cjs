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
const readNews=vm.runInNewContext(source.slice(source.indexOf('      function canReadNews()'),source.indexOf('      async function refreshAccountAccess('))+'\ncanReadNews', {cloudUser:{id:'a'},cloudReady:false,nicknameReady:true,accountAccess:{plan:'pro'}});assert.equal(readNews(),false);
for(const name of ['toggleBillingCycle','openQuickTrade','openProfileModal']) assert.ok(!source.includes('window.'+name+' ='));
(async()=>{
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
  const schedule = {cloudUser:null, cloudReady:true, nicknameReady:true, cloudTimer:null, clearTimeout(){}, setTimeout:()=>++queued, syncCloud(){}, $:()=>({}),language:'en'};
  vm.runInNewContext(source.slice(source.indexOf('      function scheduleCloudSave()'),source.indexOf('      function migrateLegacyJournal()')),schedule);
  schedule.scheduleCloudSave(); assert.equal(queued,1);
  schedule.cloudUser={id:'a'}; schedule.scheduleCloudSave(); assert.equal(queued,2);
  assert(source.includes("window.addEventListener('online', scheduleCloudSave)"));
  console.log('Account ownership, stale sync/restore/nickname, vendor integrity and calendar checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
