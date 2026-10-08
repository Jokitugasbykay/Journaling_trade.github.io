const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/app.js', 'utf8');
const registry = JSON.parse(fs.readFileSync(__dirname + '/../regional-sources.json', 'utf8'));
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const nodes = new Map();
const storage = new Map();
const ctx = {
  cloudUser:{id:'a', email:'kaylafisika24@gmail.com'}, cloudReady:true, nicknameReady:true, accountAccess:{plan:'free'},
  publisherDomains:{reuters:'reuters.com'}, newsSelectedSource:'', newsVisibleCount:12,
  kalCountryCodes:'US GB ID DE NO DK FI CZ RO HU IE AT JP CN HK IN SG MY KR TH QA JO LB IQ KW OM BH IL SA AE PK BD TW TR IR LK ZA NG KE EG MA GH ET DZ UG TZ PH VN FR IT ES NL CH SE PL UA CA MX AR CO CL PE AU NZ CR UY'.split(' '), kalCountries:['US'], kalCountriesKey:'countries',
  URL, Intl, AbortSignal, console, language:'en',
  esc:String, kalCountryFlag:code => code, renderEconomicCalendar() {}, updateAccess() {}, renderPublisherNews() {},
  localStorage:{getItem:key=>storage.get(key) ?? null, setItem:(key,value)=>storage.set(key,value)},
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
  assert.equal(Object.values(registry).flat().length, 559);
  for (const [country, portals] of Object.entries(registry)) {
    assert.equal(portals.length, country === 'GLOBAL' ? 16 : country === 'DIRECTORIES' ? 5 : ['ID','SG'].includes(country) ? 9 : 8);
    if (['global_founder','DEFAULT','GLOBAL','DIRECTORIES'].includes(country)) continue;
    set(`newsCountry = '${country}'`);
    assert.ok(portals.every(portal => ctx.newsSourceInRegion(portal.id)));
    if (['NO','DK','FI','CZ','RO','HU','IE','AT'].includes(country)) assert.equal(ctx.newsSourceInRegion('cnbc'), false);
  }
  for (const [zone, country] of Object.entries({'America/Toronto':'CA','America/Mexico_City':'MX','America/Argentina/Buenos_Aires':'AR','America/Bogota':'CO','America/Santiago':'CL','America/Lima':'PE','Australia/Sydney':'AU','Pacific/Auckland':'NZ','America/Costa_Rica':'CR','America/Montevideo':'UY'})) {
    const timezoneContext={...ctx,window:{},localStorage:{getItem:()=>null},Intl:{DateTimeFormat:()=>({resolvedOptions:()=>({timeZone:zone})})},isNewsFounder:()=>false};
    vm.runInNewContext(extract('      const newsText =','      function newsMatchesSearch(')+'\nwindow.country = activeNewsRegion();',timezoneContext);
    assert.equal(timezoneContext.window.country,country, 'Timezone fallback: '+zone);
  }
  for (const country of ['ID','NO','CA','JP','']) {
    set(`newsCountry = '${country}'`);
    assert.ok(registry.GLOBAL.every(portal => ctx.newsSourceInRegion(portal.id)), 'Global source locked in '+country);
    assert.equal(ctx.newsSourceInRegion('mx_reforma'),false, 'Foreign local source leaked');
  }
  for (const country of ['GB','DE','FR','IT','ES','NL','CH','SE','PL','UA','NO','DK','FI','CZ','RO','HU','IE','AT']) {
    set(`newsCountry = '${country}'; newsRegionMode = 'auto'`);
    assert.equal(set('activeNewsRegion()'),'EUROPE');
    for (const region of ['GB','DE','FR','IT','ES','NL','CH','SE','PL','UA','NO','DK','FI','CZ','RO','HU','IE','AT']) assert.ok(registry[region].every(portal=>ctx.newsSourceInRegion(portal.id)), country+' cannot access '+region);
    assert.equal(ctx.newsSourceInRegion('ca_cbc'),false);
  }
  ctx.renderNewsRegionControls(); assert.equal(nodes.get('news-region').disabled,false);
  nodes.get('news-region').value='FR';ctx.changeNewsRegion();
  assert.equal(set('activeNewsRegion()'),'FR');
  assert.equal(ctx.newsSourceInRegion('fr_1'),true);assert.equal(ctx.newsSourceInRegion('no_nrk'),false);
  nodes.get('news-source').value='EUROPE';
  assert.equal(ctx.newsSourceInRegion('no_nrk'),true);
  assert.equal(ctx.newsSourceMatchesSelection('bbc','EUROPE'),true);
  assert.equal(ctx.newsSourceMatchesSelection('us_npr','EUROPE'),false);
  assert.equal(ctx.newsSourceMatchesSelection('ca_cbc','EUROPE'),false);
  nodes.get('news-source').value='';
  nodes.get('news-region').value='CA';ctx.changeNewsRegion();assert.equal(set('activeNewsRegion()'),'FR');
  set("newsCountry = 'ID'; newsRegionMode = 'auto'");
  assert.equal(ctx.newsSourceInRegion('fr_1'),false);
  for (const country of ['QA','JO','LB','IQ','KW','OM','BH','IL','SA','AE']) {
    set(`newsCountry = '${country}'; newsRegionMode = 'auto'`);
    assert.equal(set('activeNewsRegion()'),'MIDDLE_EAST');
    for (const region of ['QA','JO','LB','IQ','KW','OM','BH','IL']) assert.ok(registry[region].every(portal=>ctx.newsSourceInRegion(portal.id)));
    assert.equal(ctx.newsSourceInRegion('sa_p1'),country==='SA');
    assert.equal(ctx.newsSourceInRegion('ae_p1'),country==='AE');
    assert.equal(ctx.newsSourceInRegion('de_2'),false);
  }
  ctx.renderNewsRegionControls();nodes.get('news-region').value='JO';ctx.changeNewsRegion();assert.equal(set('activeNewsRegion()'),'JO');
  for (const country of ['IN','CN','PK','BD','TW','SA','AE','TR','IR','LK','ID','MY','SG','TH','PH','VN','JP','KR','ZA','NG','KE','EG','MA','GH','ET','DZ','UG','TZ']) {
    set(`newsCountry = '${country}'; newsRegionMode = 'auto'`);
    assert.ok(registry[country].every(portal=>ctx.newsSourceInRegion(portal.id)));
    for (const other of ['IN','CN','SA','AE','ZA','NG']) if (other!==country) assert.ok(registry[other].every(portal=>!ctx.newsSourceInRegion(portal.id)), country+' leaked '+other);
    assert.ok(registry.DIRECTORIES.every(portal=>ctx.newsSourceInRegion(portal.id)));
  }
  set("newsCountry = 'ID'; newsRegionMode = 'auto'");
  const directoryOptions=ctx.newsSourceOptions([...registry.GLOBAL,...registry.ID,...registry.DIRECTORIES]);
  assert.ok(directoryOptions.indexOf('International Directories') < directoryOptions.indexOf('label="Global News"'));
  assert.equal(ctx.newsSourceInRegion('aljazeera'),false);
  const dropdown=ctx.newsSourceOptions([...registry.GLOBAL,...registry.NO]);
  assert.equal((dropdown.match(/<optgroup /g)||[]).length,2);
  assert.ok(dropdown.includes('label="Global News"'));
  assert.match(dropdown, /label="Local News[^"]*Norway"/);
  assert.equal((dropdown.match(/value="ap"/g)||[]).length,1);
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
  set("newsCountry = 'JP'");
  assert.ok(registry.DEFAULT.filter(portal=>!['dw','france24','aljazeera'].includes(portal.id)).every(portal=>ctx.newsSourceInRegion(portal.id)), 'Unconfigured country did not fall back to DEFAULT');
  assert.equal(ctx.newsSourceInRegion('dw'),false); assert.equal(ctx.newsSourceInRegion('france24'),false);
  assert.equal(ctx.newsSourceInRegion('no_nrk'),false);
  nodes.get('news-region').value='SG'; ctx.changeNewsRegion();
  assert.equal(set('activeNewsRegion()'),'JP', 'Regular user bypassed detected region');
  storage.set('fncjt_news_region',JSON.stringify({region:'SG',mode:'manual'}));
  const reopened={...ctx,window:{},isNewsFounder:()=>false};
  vm.runInNewContext(extract('      const newsText =','      function newsMatchesSearch(')+'\nwindow.restored = activeNewsRegion();',reopened);
  assert.notEqual(reopened.window.restored,'SG', 'Old manual preference bypassed regular region lock');
  set("newsRegionMode = 'manual'; newsRegion = 'SG'; newsLocationChecked = false");
  ctx.fetch=async()=>({ok:true,text:async()=> 'CA'});
  await ctx.detectNewsRegion();
  assert.equal(set('activeNewsRegion()'),'CA');
  assert.equal(JSON.parse(storage.get('fncjt_news_region')).mode,'auto');
  set("newsRegionMode = 'auto'");
  ctx.cloudClient.auth.getUser = async()=>({data:{user:{id:'a', email:'  KAYLAFISIKA24@GMAIL.COM  ', email_confirmed_at:'2026-10-01'}}});
  await ctx.verifyNewsIdentity('a'); assert.equal(ctx.isNewsFounder(), true); assert.equal(ctx.canReadNews(), true);
  assert.equal(nodes.get('news-founder-badge').hidden, false);
  assert.equal(nodes.get('news-region').disabled, false);
  assert.equal(set('activeNewsRegion()'),'');
  assert.ok(registry.global_founder.every(portal => ctx.newsSourceInRegion(portal.id)));
  assert.equal(ctx.newsSourceInRegion('no_nrk'),true);
  set("newsRegionMode = 'manual'; newsRegion = ''");
  assert.ok(Object.values(registry).flat().every(portal => ctx.newsSourceInRegion(portal.id)));
  for (const country of ['CA','MX','AR','CO','CL','PE','AU','NZ','CR','UY']) {
    nodes.get('news-region').value=country; ctx.changeNewsRegion();
    assert.equal(set('activeNewsRegion()'),country);
    assert.ok(registry[country].every(portal=>ctx.newsSourceInRegion(portal.id)));
    assert.equal(ctx.newsSourceInRegion('no_nrk'),false);
  }
  const restoredFounder={...ctx,window:{},isNewsFounder:()=>true};
  vm.runInNewContext(extract('      const newsText =','      function newsMatchesSearch(')+'\nwindow.restored = activeNewsRegion();',restoredFounder);
  assert.equal(restoredFounder.window.restored,'UY');
  set("newsRegion = 'CZ'"); assert.equal(ctx.newsSourceInRegion('cz_ct24'), true); assert.equal(ctx.newsSourceInRegion('no_nrk'), false);
  set("newsRegion = 'ASIA'"); assert.equal(ctx.newsSourceInRegion('kompas'), true); assert.equal(ctx.newsSourceInRegion('cnbc'), false);
  set("newsRegion = 'DEFAULT'"); assert.equal(ctx.newsSourceInRegion('reuters'), true); assert.equal(ctx.newsSourceInRegion('bbc'), true);
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
  nodes.get('news-region').value='global_founder';ctx.changeNewsRegion();
  assert.notEqual(set('activeNewsRegion()'),'global_founder');
  console.log('559 regional/global/directory entries, founder persistence, DEFAULT/Tier 1 scopes, regular region lock, verified founder and logout checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
