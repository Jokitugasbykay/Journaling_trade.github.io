const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/app.js', 'utf8');
const registry = JSON.parse(fs.readFileSync(__dirname + '/../regional-sources.json', 'utf8'));
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const nodes = new Map();
const storage = new Map();
const ctx = {
  cloudUser:{id:'a', email:'kaylafisika24@gmail.com'}, cloudReady:true, nicknameReady:true, accountAccess:{plan:'free'},
  publisherDomains:{reuters:'reuters.com'}, newsSelectedSource:'', newsVisibleCount:12,
  kalCountryCodes:'US GB ID DE NO DK FI CZ RO HU IE AT JP CN HK IN SG MY KR TH'.split(' '), kalCountries:['US'], kalCountriesKey:'countries',
  URL, Intl, AbortSignal, console, language:'en',
  esc:String, kalCountryFlag:code => code, renderEconomicCalendar() {}, updateAccess() {}, renderPublisherNews() {},
  localStorage:{getItem:key=>storage.get(key) ?? null},
  $:id=>{ if (!nodes.has(id)) nodes.set(id,{value:'',hidden:true,innerHTML:'',textContent:''}); return nodes.get(id); },
  cloudClient:{auth:{getUser:async()=>({data:{user:{id:'a',email:'regular@example.com',email_confirmed_at:'2026-10-01'}}})}}
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(extract('      const FOUNDER_EMAILS =', '      let accountAccess =') +
  extract('      function canReadNews()', '      async function refreshAccountAccess(') +
  extract('      const newsText =', '      function newsMatchesSearch(') +
  extract('      function handleCloudSignedOut()', '      async function hydrateCloud('), ctx);
const set = code => vm.runInContext(code, ctx);
(async () => {
  await ctx.verifyNewsIdentity('a');
  assert.equal(ctx.isNewsFounder(), false, 'Cached/local founder email granted access');
  assert.equal(ctx.canReadNews(), false);
  ctx.registerRegionalSources(registry);
  assert.equal(Object.values(registry).flat().length, 64);
  for (const [country, portals] of Object.entries(registry)) {
    assert.equal(portals.length, 8);
    set(`newsCountry = '${country}'`);
    assert.ok(portals.every(portal => ctx.newsSourceInRegion(portal.id)));
    assert.equal(ctx.newsSourceInRegion('cnbc'), false);
    assert.equal(Object.values(registry).flat().filter(portal => ctx.newsSourceInRegion(portal.id)).length, 8);
  }
  assert.throws(() => ctx.registerRegionalSources({NO:[{id:'no_fake',name:'Fake',url:'https://user@evil.test'}]}));
  set("newsCountry = 'NO'; newsLocationChecked = false");
  ctx.accountAccess = {plan:'plus'};
  ctx.fetch = async()=>({ok:true,text:async()=> 'DK\n'});
  await ctx.detectNewsRegion();
  assert.equal(set('newsCountry'), 'DK');
  assert.equal(JSON.stringify(ctx.kalCountries), '["DK"]');
  storage.set('countries', '["US","GB"]'); ctx.kalCountries = ['US','GB'];
  set("newsCountry = 'NO'"); ctx.defaultCalendarRegion();
  assert.deepEqual(ctx.kalCountries, ['US','GB'], 'Automatic location replaced saved calendar choices');
  set('newsLocationChecked = false'); ctx.fetch = async()=>{throw Error('offline')};
  await ctx.detectNewsRegion(); assert.equal(set('newsCountry'), 'NO');
  ctx.cloudClient.auth.getUser = async()=>({data:{user:{id:'a', email:'KAYLAFISIKA24@GMAIL.COM', email_confirmed_at:'2026-10-01'}}});
  await ctx.verifyNewsIdentity('a'); assert.equal(ctx.isNewsFounder(), true); assert.equal(ctx.canReadNews(), true);
  assert.equal(nodes.get('news-founder-badge').hidden, false);
  assert.equal(nodes.get('news-region').disabled, false);
  assert.ok(Object.values(registry).flat().every(portal => ctx.newsSourceInRegion(portal.id)));
  set("newsRegion = 'CZ'"); assert.equal(ctx.newsSourceInRegion('cz_ct24'), true); assert.equal(ctx.newsSourceInRegion('no_nrk'), false);
  set("newsRegion = 'ASIA'"); assert.equal(ctx.newsSourceInRegion('kompas'), true); assert.equal(ctx.newsSourceInRegion('cnbc'), false);
  set("newsRegion = 'GLOBAL'"); assert.equal(ctx.newsSourceInRegion('reuters'), true); assert.equal(ctx.newsSourceInRegion('bbc'), false);
  ctx.cloudClient.auth.getUser = async()=>({data:{user:{id:'a',email:'gamingyoga14@gmail.com'}}});
  await ctx.verifyNewsIdentity('a'); assert.equal(ctx.isNewsFounder(), false, 'Unconfirmed founder email accepted');
  let resolve;
  ctx.cloudClient.auth.getUser = ()=>new Promise(done => {resolve=done});
  const pending = ctx.verifyNewsIdentity('a');
  ctx.hydratingUserId = 'a'; ctx.selectJournalOwner = ()=>{};
  ctx.handleCloudSignedOut();
  resolve({data:{user:{id:'a',email:'kaylafisika24@gmail.com',email_confirmed_at:'2026-10-01'}}});
  await pending;
  assert.equal(ctx.isNewsFounder(), false, 'Stale result restored founder after cross-tab logout');
  assert.equal(nodes.get('news-founder-badge').hidden, true);
  ctx.cloudUser = {id:'b',email:'regular@example.com'};
  ctx.cloudClient.auth.getUser = async()=>({data:{user:{id:'b',email:'regular@example.com',email_confirmed_at:'2026-10-01'}}});
  await ctx.verifyNewsIdentity('b'); assert.equal(ctx.isNewsFounder(), false);
  assert.equal(nodes.get('news-region').disabled, true);
  console.log('64 portals, country scopes, verified founders, IP fallback, saved calendar and stale logout checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
