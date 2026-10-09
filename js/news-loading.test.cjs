const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const extract = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));
const stamp = '2026-10-09T00:00:00+00:00';
const sources = ['alpha','beta'].map(id=>({id,name:id,url:'https://'+id+'.example',kind:'rss',status:'ok'}));
const item = (source, n, title=source+' story '+n)=>({id:n.toString(16).padStart(20,'0'),source,title,url:'https://'+source+'.example/story/'+n,publishedAt:stamp});
const feed = (items, selected=sources, checkedAt=stamp)=>({version:1,checkedAt,sources:selected,items});
const response = data => new Response(JSON.stringify(data));
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no)=>{resolve=yes;reject=no}); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve=>setImmediate(resolve));
function harness() {
  const nodes = new Map(), cache = new Map();
  const ctx = {URL,URLSearchParams,AbortSignal,console,document:{baseURI:'https://journal.example/'},location:{search:''},
    cloudUser:{id:'first'},permitted:true,canReadNews:()=>!!ctx.cloudUser && ctx.permitted,
    publisherDomains:{alpha:'alpha.example',beta:'beta.example'},
    publisherUrl:(url,id)=>typeof url==='string' && url.startsWith('https://'+id+'.example')?url:null,
    publisherTime:value=>value && Number.isFinite(Date.parse(value))?value:null,
    newsSourceInRegion:()=>true,NEWS_REGIONS:{},newsAreaCodes:[],loadRegionalSources:async()=>{},
    renderPublisherNews() {},renderNewsReader() {},fetch:async()=>{throw Error('offline')},
    caches:{open:async()=>({match:async url=>cache.get(url)?.clone(),put:async(url,value)=>cache.set(url,value.clone())})},
    $:id=>{if (!nodes.has(id)) nodes.set(id,{value:'',disabled:false,setAttribute(){},querySelectorAll:()=>[]});return nodes.get(id);}};
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext(extract('      let publisherNews =','      const publisherDomains =')+
    extract('      function newsItemsForDisplay(', '      function newsMatchesSearch(')+
    extract('      window.reloadPublisherNews =','      setInterval(() => { if (!document.hidden) reloadPublisherNews();'),ctx);
  const get = code=>vm.runInContext(code,ctx);
  return {ctx,cache,nodes,get,set:(key,value)=>{ctx.testValue=value;get(key+' = testValue');},
    select:id=>{ctx.$('news-source').value=id;ctx.testValue=id;get('newsSelectedSource = testValue');}};
}
(async()=>{
  const a=item('alpha',1), b=item('beta',2);
  const h=harness(), pending=deferred();
  h.cache.set('https://journal.example/news/index.json',response(feed([a])));
  h.ctx.fetch=()=>pending.promise;
  const initial=h.ctx.reloadPublisherNews();
  await tick();
  assert.equal(h.get('publisherNews.items[0].id'),a.id,'Saved headlines were withheld while the network was pending');
  pending.reject(Error('offline'));
  await initial;
  assert.equal(h.get('publisherNewsFailed'),true);
  assert.equal(h.get('publisherNews.items[0].id'),a.id);
  h.ctx.fetch=async()=>response(feed([b]));
  await h.ctx.reloadPublisherNews();
  assert.equal(h.get('publisherNews.items[0].id'),b.id);
  assert.equal(h.get('publisherNewsFailed'),false);
  h.cache.clear();h.ctx.fetch=async()=>{throw Error('503')};
  await h.ctx.reloadPublisherNews();
  assert.equal(h.get('publisherNews.items[0].id'),b.id,'Failed refresh erased the working feed');
  h.ctx.permitted=false;await h.ctx.reloadPublisherNews();
  assert.equal(h.get('publisherNews.items[0].id'),b.id,'Temporary access initialization erased memory');
  console.log('Cached headlines appear immediately; offline/failed refresh retains the last valid feed');

  const registry=harness(), registryNetwork=deferred();
  registry.ctx.regionalSourcesPromise=null;
  registry.ctx.registerRegionalSources=()=>{};
  registry.cache.set('https://journal.example/regional-sources.json',response({GB:[]}));
  registry.ctx.fetch=()=>registryNetwork.promise;
  vm.runInContext(extract('      async function loadRegionalSources()', '      function hasEuropeNewsAccess()'),registry.ctx);
  let registryReady=false;
  const ready=registry.ctx.loadRegionalSources().then(()=>{registryReady=true});
  await tick();
  assert.equal(registryReady,true,'Cached registry blocked news while its network refresh was pending');
  registryNetwork.resolve(response({GB:[]}));await ready;
  console.log('Saved publisher registry is ready without waiting for a slow network');

  const corrupt=harness();
  corrupt.cache.set('https://journal.example/news/index.json',response({version:0,items:[]}));
  corrupt.ctx.fetch=async()=>response(feed([a]));
  await corrupt.ctx.reloadPublisherNews();
  assert.equal(corrupt.get('publisherNews.items[0].id'),a.id,'Invalid cache prevented a valid network response');
  corrupt.ctx.fetch=async()=>response({version:0,items:[]});
  await corrupt.ctx.reloadPublisherNews();
  assert.equal(corrupt.get('publisherNews.items[0].id'),a.id,'Invalid network snapshot replaced saved headlines');
  console.log('Both cached and network payloads are validated before use');

  for (const unavailable of ['disabled','quota']) {
    const storage=harness();
    storage.ctx.caches={open:async()=>{if (unavailable==='disabled') throw Error('Unavailable'); return {match:async()=>null,put:async()=>{throw Error('Quota exceeded')}}}};
    storage.ctx.fetch=async()=>response(feed([a]));
    await storage.ctx.reloadPublisherNews();
    assert.equal(storage.get('publisherNews.items[0].id'),a.id,'Cache failure blocked a valid feed');
  }
  console.log('Disabled/full browser cache never blocks a valid network feed');

  const race=harness(), requests=[];
  race.set('publisherNews',feed([a,b]));
  race.ctx.fetch=url=>{const request=deferred();requests.push({url,...request});return request.promise};
  race.select('alpha');const firstA=race.ctx.loadNewsSource('alpha');
  race.select('beta');const firstB=race.ctx.loadNewsSource('beta');
  race.select('alpha');const lastA=race.ctx.loadNewsSource('alpha');
  await tick();assert.equal(requests.length,3);
  requests[0].resolve(response(feed([item('alpha',3)],sources.slice(0,1))));await firstA;
  assert.equal(race.get('newsSourceFeed'),null,'First A request returned after a newer A request and was applied');
  requests[1].resolve(response(feed([b],sources.slice(1))));await firstB;
  assert.equal(race.get('newsSourceFeed'),null,'Beta replaced the current Alpha selection');
  requests[2].resolve(response(feed([a],sources.slice(0,1))));await lastA;
  assert.equal(race.get('newsSourceFeed.items[0].id'),a.id);
  assert.equal(race.get('newsSourceLoading'),'');
  race.ctx.fetch=async()=>{throw Error('offline')};
  await race.ctx.loadNewsSource('alpha',true);
  assert.equal(race.get('newsCurrentItems().find(row=>row.source === "alpha").id'),a.id);
  assert.equal(race.get('newsSourceFailed'),true);
  console.log('Source A→B→A ignores stale responses; failed source refresh keeps its saved stories');

  const late=harness(), lateRequests=[];
  late.set('publisherNews',feed([a,b]));
  late.ctx.fetch=()=>{const request=deferred();lateRequests.push(request);return request.promise};
  late.select('alpha');const outdated=late.ctx.loadNewsSource('alpha');
  late.select('beta');const other=late.ctx.loadNewsSource('beta');
  late.select('alpha');const newest=late.ctx.loadNewsSource('alpha');
  await tick();
  lateRequests[2].resolve(response(feed([a],sources.slice(0,1))));await newest;
  lateRequests[0].resolve(response(feed([item('alpha',3)],sources.slice(0,1),'2026-10-08T23:00:00+00:00')));await outdated;
  lateRequests[1].resolve(response(feed([b],sources.slice(1))));await other;
  assert.equal(late.get('newsSourceFeed.items[0].id'),a.id);
  const savedSource=await late.cache.get('https://journal.example/news/sources/alpha.json').clone().json();
  assert.equal(savedSource.items[0].id,a.id,'A late obsolete request overwrote the newest offline cache');
  console.log('Late source responses cannot overwrite the newest offline snapshot');

  const category=harness(), olderFed={...item('alpha',900,'Older Waller inflation story'),category:'markets',topics:['fed']};
  category.set('publisherNews',feed([a,b]));category.set('newsCategory','fed');
  let categoryPath='';
  category.ctx.fetch=async url=>{categoryPath=url;return response(feed([olderFed]))};
  await category.ctx.loadNewsCategory('fed');
  assert.equal(categoryPath,'https://journal.example/news/categories/fed.json');
  assert.ok(!category.get('publisherNews.items').some(row=>row.id===olderFed.id));
  assert.equal(category.get('newsCurrentItems()[0].id'),olderFed.id,'The Fed tab still searched only bootstrap headlines');
  category.cache.clear();category.ctx.fetch=async()=>{throw Error('503')};
  await category.ctx.loadNewsCategory('fed',true);
  assert.equal(category.get('newsCategoryFailed'),true);
  assert.equal(category.get('newsCurrentItems()[0].id'),olderFed.id,'Failed category refresh discarded saved stories');
  category.set('newsCategory','');category.set('newsQuery','Waller');
  assert.equal(category.get('newsCategoryKey()'),'all');
  category.ctx.fetch=async()=>response(feed([a,olderFed]));
  await category.ctx.loadNewsCategory('all');
  assert.ok(category.get('newsCurrentItems()').some(row=>row.id===olderFed.id),'All-source search could not access an older headline');
  category.set('newsQuery','');category.set('newsVisibleCount',24);
  assert.equal(category.get('newsCategoryKey()'),'all','Show-more used only bootstrap headlines');
  category.set('newsVisibleCount',12);
  assert.equal(category.get('newsCategoryKey()'),'');
  assert.equal(category.get('newsCurrentItems()[0].id'),a.id,'A category archive leaked into the unfiltered latest view');
  console.log('Fed/search/show-more load older archive rows; a failed refresh preserves results');

  const categoryRace=harness(), categoryRequests=[];
  categoryRace.set('publisherNews',feed([a,b]));
  categoryRace.ctx.fetch=()=>{const request=deferred();categoryRequests.push(request);return request.promise};
  categoryRace.set('newsCategory','fed');const firstFed=categoryRace.ctx.loadNewsCategory('fed');
  categoryRace.set('newsCategory','markets');const marketLoad=categoryRace.ctx.loadNewsCategory('markets');
  categoryRace.set('newsCategory','fed');const latestFed=categoryRace.ctx.loadNewsCategory('fed');
  await tick();assert.equal(categoryRequests.length,3);
  categoryRequests[0].resolve(response(feed([{...olderFed,title:'Obsolete Fed response'}])));await firstFed;
  categoryRequests[1].resolve(response(feed([{...b,category:'markets'}])));await marketLoad;
  assert.equal(categoryRace.get('newsCategoryFeed'),null,'An obsolete category response replaced the current selection');
  categoryRequests[2].resolve(response(feed([olderFed])));await latestFed;
  assert.equal(categoryRace.get('newsCategoryFeed.items[0].title'),olderFed.title);
  const abandoned=deferred();categoryRace.ctx.fetch=()=>abandoned.promise;
  const abandonedLoad=categoryRace.ctx.loadNewsCategory('fed',true);
  categoryRace.set('newsCategory','');
  abandoned.resolve(response(feed([{...olderFed,title:'Abandoned category'}])));await abandonedLoad;
  assert.equal(categoryRace.get('newsCategoryFeed.items[0].title'),olderFed.title,'An unchanged request number bypassed the current category guard');
  console.log('Category A→B→A and leaving a category reject late responses');

  for (const operation of ['category','article']) {
    const returned=harness(), abandonedRequest=deferred();let fetches=0;
    returned.set('publisherNews',feed([]));
    const payload=operation==='category'?feed([olderFed]):{version:1,checkedAt:stamp,items:[olderFed]};
    if (operation==='category') returned.set('newsCategory','fed');
    else returned.ctx.location.search='?article='+olderFed.id;
    returned.ctx.fetch=()=>{fetches++;return abandonedRequest.promise};
    const pendingLoad=operation==='category'?returned.ctx.loadNewsCategory('fed'):returned.ctx.loadNewsArticle(olderFed.id);
    await tick();
    if (operation==='category') returned.set('newsCategory','');else returned.ctx.location.search='';
    abandonedRequest.resolve(response(payload));await pendingLoad;
    assert.equal(returned.get(operation==='category'?'newsCategoryFeed':'newsArticleDetail'),null);
    if (operation==='category') returned.set('newsCategory','fed');else returned.ctx.location.search='?article='+olderFed.id;
    returned.ctx.fetch=async()=>{fetches++;return response(payload)};
    await (operation==='category'?returned.ctx.loadNewsCategory('fed'):returned.ctx.loadNewsArticle(olderFed.id));
    assert.equal(fetches,2,'Returning to an abandoned '+operation+' never retried');
    assert.equal(returned.get(operation==='category'?'newsCategoryFeed.items[0].id':'newsArticleDetail.id'),olderFed.id);
  }
  console.log('Returning to a category or article after an abandoned request completes starts a new request');

  const malformed=harness();malformed.set('publisherNews',feed([a]));malformed.set('newsCategory','fed');
  malformed.ctx.fetch=async()=>response(feed([a]));await malformed.ctx.loadNewsCategory('fed');
  assert.equal(malformed.get('newsCategoryFeed'),null,'An unrelated headline entered a category archive');
  assert.equal(malformed.get('newsCategoryFailed'),true);

  const archive=harness(), old=item('alpha',501,'Old bookmarked story');
  archive.set('publisherNews',feed(Array.from({length:500},(_,n)=>item('alpha',n+1000))));
  archive.ctx.location.search='?article='+old.id;
  let archivePath='';
  archive.ctx.fetch=async url=>{archivePath=url;return response({version:1,checkedAt:stamp,items:[old]})};
  await archive.ctx.loadNewsArticle(old.id);
  assert.ok(!archive.get('publisherNews.items').some(row=>row.id===old.id));
  assert.equal(archive.get('newsArticleDetail.id'),old.id);
  assert.equal(archivePath,'https://journal.example/news/archive/'+old.id.slice(0,2)+'.json');
  console.log('An old bookmark outside the 500-story list loads directly from its archive bucket');

  const articles=harness(), articleRequests=[];
  articles.set('publisherNews',feed([a,b]));
  articles.ctx.fetch=()=>{const request=deferred();articleRequests.push(request);return request.promise};
  articles.ctx.location.search='?article='+a.id;const articleA=articles.ctx.loadNewsArticle(a.id);
  articles.ctx.location.search='?article='+b.id;const articleB=articles.ctx.loadNewsArticle(b.id);
  articles.ctx.location.search='?article='+a.id;const newestA=articles.ctx.loadNewsArticle(a.id);
  await tick();assert.equal(articleRequests.length,3);
  articleRequests[0].resolve(response({version:1,checkedAt:stamp,items:[{...a,title:'Old A'}]}));await articleA;
  assert.equal(articles.get('newsArticleDetail'),null);
  articleRequests[1].resolve(response({version:1,checkedAt:stamp,items:[b]}));await articleB;
  assert.equal(articles.get('newsArticleDetail'),null);
  articleRequests[2].resolve(response({version:1,checkedAt:stamp,items:[a]}));await newestA;
  assert.equal(articles.get('newsArticleDetail.title'),a.title);
  assert.equal(articles.get('newsArticleLoading'),'');
  console.log('Article A→B→A ignores stale history/navigation responses');

  for (const operation of ['index','source','article','category']) {
    const session=harness(), request=deferred();
    session.set('publisherNews',feed([a]));session.select('alpha');session.ctx.location.search='?article='+a.id;
    session.ctx.fetch=()=>request.promise;
    session.set('newsCategory','all');
    if (operation==='category') session.ctx.location.search='';
    const loading=operation==='index'?session.ctx.reloadPublisherNews():operation==='source'?session.ctx.loadNewsSource('alpha'):operation==='category'?session.ctx.loadNewsCategory('all'):session.ctx.loadNewsArticle(a.id);
    await tick();session.ctx.cloudUser=null;session.ctx.resetNewsData();
    request.resolve(response(operation==='article'?{version:1,checkedAt:stamp,items:[a]}:feed([a],operation==='source'?sources.slice(0,1):sources)));
    await loading;
    assert.equal(session.get('publisherNews'),null,operation+' restored feed after logout');
    assert.equal(session.get('newsSourceFeed'),null,operation+' restored source after logout');
    assert.equal(session.get('newsArticleDetail'),null,operation+' restored article after logout');
    assert.equal(session.get('newsCategoryFeed'),null,operation+' restored category after logout');
  }
  for (const operation of ['index','source','article','category']) {
    const changed=harness(), changedRequest=deferred();
    changed.set('publisherNews',feed([a]));changed.select('alpha');changed.ctx.location.search='?article='+a.id;
    changed.ctx.fetch=()=>changedRequest.promise;
    changed.set('newsCategory','all');
    if (operation==='category') changed.ctx.location.search='';
    const oldUser=operation==='index'?changed.ctx.reloadPublisherNews():operation==='source'?changed.ctx.loadNewsSource('alpha'):operation==='category'?changed.ctx.loadNewsCategory('all'):changed.ctx.loadNewsArticle(a.id);
    await tick();changed.ctx.cloudUser={id:'second'};
    changedRequest.resolve(response(operation==='article'?{version:1,checkedAt:stamp,items:[a]}:feed([b],operation==='source'?sources.slice(0,1):sources)));await oldUser;
    assert.equal(changed.get('publisherNews.items[0].id'),a.id,operation+' applied a feed to a different user');
    assert.equal(changed.get('newsSourceFeed'),null,operation+' applied source data to a different user');
    assert.equal(changed.get('newsArticleDetail'),null,operation+' applied article data to a different user');
    assert.equal(changed.get('newsCategoryFeed'),null,operation+' applied category data to a different user');
  }
  console.log('Pending index/source/article/category responses cannot restore data after logout or an account change');

  const channels=harness();channels.set('publisherNews',feed([a],[{...sources[0],status:'stale'},{...sources[1],kind:'external'}]));
  channels.ctx.renderNewsRegionControls=()=>{};channels.ctx.detectNewsRegion=()=>{};
  channels.ctx.activeNewsRegion=()=>'';channels.ctx.GLOBAL_NEWS_SOURCES=[];channels.ctx.canSelectNewsArea=()=>false;
  channels.ctx.newsSourceOptions=rows=>{channels.options=rows.map(row=>row.id);return ''};
  channels.ctx.newsSourceMatchesSelection=()=>true;channels.ctx.newsMatchesSearch=()=>true;
  channels.ctx.newsText=(_id,en)=>en;channels.ctx.publisherImageUrl=()=>null;channels.ctx.esc=String;
  channels.ctx.newsArticlePath=id=>'/economic-news/?article='+id;
  channels.ctx.document.querySelectorAll=()=>[];channels.ctx.document.querySelector=()=>({});
  vm.runInContext(extract('      window.renderPublisherNews =','      window.selectNewsCategory ='),channels.ctx);
  channels.ctx.renderPublisherNews();
  assert.deepEqual(Array.from(channels.options),['alpha'],'Empty channels remained selectable or saved stale headlines were hidden');
  console.log('The real source dropdown hides empty channels while preserving saved stale publishers');

  const reconnect=harness(), sessionRead=deferred(), recovery=[];
  reconnect.ctx.cloudAuthRevision=1;reconnect.ctx.cloudReady=false;reconnect.ctx.permitted=false;
  reconnect.ctx.cloudClient={auth:{getSession:()=>sessionRead.promise}};
  reconnect.ctx.hydrateCloud=async user=>recovery.push('hydrate:'+user.id);
  reconnect.ctx.verifyNewsIdentity=async id=>recovery.push('verify:'+id);
  const recovering=reconnect.ctx.retryNewsConnection();
  sessionRead.resolve({data:{session:{user:{id:'first'}}}});await recovering;
  assert.deepEqual(recovery,['hydrate:first']);
  reconnect.ctx.cloudReady=true;await reconnect.ctx.retryNewsConnection();
  assert.deepEqual(recovery,['hydrate:first','verify:first']);
  const staleSession=deferred();reconnect.ctx.cloudClient.auth.getSession=()=>staleSession.promise;
  const staleRecovery=reconnect.ctx.retryNewsConnection();reconnect.ctx.cloudAuthRevision++;reconnect.ctx.cloudUser=null;
  staleSession.resolve({data:{session:{user:{id:'first'}}}});await staleRecovery;
  assert.equal(recovery.length,2,'Online recovery restored a session after logout');
  console.log('Connection recovery rehydrates/verifies the active session and ignores logout races');
})().catch(error=>{console.error(error);process.exitCode=1});
