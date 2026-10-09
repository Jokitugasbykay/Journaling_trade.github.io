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
  esc:String, kalCountryFlag:code => code, renderEconomicCalendar() {}, updateAccess() {}, renderPublisherNews() {}, renderNewsReader() {}, resetNewsData() {},
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
  assert.ok(Object.values(registry).flat().length >= 487);
  for (const id of ['federal_reserve','stocktwits','barrons','yahoo_finance']) {
    assert.equal(vm.runInContext(`publisherCountries['${id}']`, ctx), 'US');
  }
  assert.equal(vm.runInContext('publisherCountries.economic_times', ctx), 'IN');
  for (const [country, portals] of Object.entries(registry)) {
    assert.ok(portals.length >= 4, country+' has fewer than four portals');
    if (['global_founder','DEFAULT','GLOBAL'].includes(country)) continue;
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
    assert.equal(ctx.newsSourceInRegion('aljazeera'),true);
    for (const region of ['QA','JO','LB','IQ','KW','OM','BH','IL']) assert.ok(registry[region].every(portal=>ctx.newsSourceInRegion(portal.id)));
    for (const strict of ['SA','AE']) assert.ok(registry[strict].every(portal=>ctx.newsSourceInRegion(portal.id)===(country===strict)), country+' accessing '+strict);
    assert.equal(ctx.newsSourceInRegion('de_2'),false);
  }
  ctx.renderNewsRegionControls();nodes.get('news-region').value='JO';ctx.changeNewsRegion();assert.equal(set('activeNewsRegion()'),'JO');
  for (const country of ['IN','CN','PK','BD','TW','SA','AE','TR','IR','LK','ID','MY','SG','TH','PH','VN','JP','KR','ZA','NG','KE','EG','MA','GH','ET','DZ','UG','TZ']) {
    set(`newsCountry = '${country}'; newsRegionMode = 'auto'`);
    assert.ok(registry[country].every(portal=>ctx.newsSourceInRegion(portal.id)));
    for (const other of ['IN','CN','TW','SA','AE','ZA','NG']) if (other!==country) assert.ok(registry[other].every(portal=>!ctx.newsSourceInRegion(portal.id)), country+' leaked '+other);
  }
  set("newsCountry = 'ID'; newsRegionMode = 'auto'");
  assert.equal(registry.CN.length,10);
  assert.equal(registry.CN[8].url,'https://peoplesdaily.pdnews.cn');
  assert.equal(registry.CN[9].url,'https://www.huanqiu.com');
  assert.equal(registry.TW.length,12);
  assert.deepEqual(registry.TW.slice(8).map(portal=>portal.url), ['https://www.ettoday.net','https://www.setn.com','https://news.tvbs.com.tw','https://www.ftvnews.com.tw']);
  for (const region of ['CN','TW']) for (const country of ['CN','HK','TW','ID','SG','US','GB']) {
    set(`newsCountry = '${country}'; newsRegionMode = 'auto'`);
    nodes.get('news-source').value='ASIA';
    for (const portal of registry[region]) assert.equal(ctx.newsSourceInRegion(portal.id),country===region,country+' accessing '+region);
    nodes.get('news-source').value='';
    nodes.get('news-region').value=region; ctx.changeNewsRegion();
    assert.equal(set('activeNewsRegion()')===region,country===region,'Manual '+region+' bypass from '+country);
  }
  set("newsCountry = 'ID'; newsRegionMode = 'auto'");
  assert.ok(!('DIRECTORIES' in registry));
  assert.throws(()=>ctx.registerRegionalSources({DIRECTORIES:[]}), /Invalid region registry/);
  const directoryOptions=ctx.newsSourceOptions([...registry.GLOBAL,...registry.ID]);
  assert.ok(!directoryOptions.includes('International Directories'));
  assert.ok(!directoryOptions.includes('dir_worldpress'));
  assert.equal(registry.GLOBAL.find(portal=>portal.id==='us_pbs').feed,'https://www.pbs.org/newshour/feeds/rss/headlines');
  assert.equal(registry.GB.find(portal=>portal.id==='gb_independent').feed,'https://www.independent.co.uk/news/rss');
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
  for (const region of ['CN','TW']) assert.ok(registry[region].every(portal=>ctx.newsSourceInRegion(portal.id)), 'Founder cannot access '+region);

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
  for (const [area, inside, outside] of [
    ['AFRICA','ng_p1','no_nrk'], ['ANTARCTICA',null,'ng_p1'], ['ASIA','lk_p1','au_abc'],
    ['EUROPE','no_nrk','ca_cbc'], ['NORTH_AMERICA','ca_cbc','ar_clarin'],
    ['SOUTH_AMERICA','ar_clarin','ca_cbc'], ['OCEANIA','au_abc','lk_p1']
  ]) {
    nodes.get('news-region').value=area; ctx.changeNewsRegion();
    assert.equal(set('activeNewsRegion()'),area);
    if (inside) assert.ok(ctx.newsSourceInRegion(inside),area);
    assert.equal(ctx.newsSourceInRegion(outside),false,area);
    assert.ok(registry.GLOBAL.every(portal=>ctx.newsSourceInRegion(portal.id)),area+' locked Global');
    set("newsRegion = 'NO'"); nodes.get('news-source').value=area;
    if (inside) assert.ok(ctx.newsSourceInRegion(inside),area+' source selection');
    assert.equal(ctx.newsSourceMatchesSelection(outside,area),false);
    const options=ctx.newsSourceOptions([]);
    for (const code of ['AFRICA','ANTARCTICA','ASIA','EUROPE','NORTH_AMERICA','SOUTH_AMERICA','OCEANIA']) assert.ok(options.includes('value="'+code+'"'));
    nodes.get('news-source').value='';
  }
  const sorted=ctx.newsSourceOptions([{id:'ca_cbc',name:'Zebra'}, {id:'ca_ctv',name:'Alpha'}]);
  assert.ok(sorted.indexOf('Alpha') < sorted.indexOf('Zebra'));
  const display=ctx.newsItemsForDisplay(Array.from({length:1100},(_,i)=>({source:i<550?'a':'b',publishedAt:new Date(1700000000000+i*1000).toISOString(),id:i})));
  assert.equal(display.length,1000);
  assert.equal(display.filter(row=>row.source==='a').length,500);
  assert.equal(display.filter(row=>row.source==='b').length,500);
  assert.ok(display[0].id > display[499].id);
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
  console.log('Regional/global entries, restored Middle East portals, founder persistence, region lock and verified logout checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
