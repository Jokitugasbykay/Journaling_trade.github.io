const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const reader = {innerHTML:'', querySelectorAll:()=>[]};
const browse = {classList:{toggle(){}}};
const ctx = {URLSearchParams, location:{search:'?article=a'}, pagePath:()=>'/economic-news/', canReadNews:()=>true,
  $:id=>id==='publisher-news-reader'?reader:browse, newsSourceInRegion:()=>true,
  publisherUrl:(url)=>url.startsWith('https://www.federalreserve.gov/')?url:null,
  publisherImageUrl:()=>null,publisherTime:()=> '8 Oct 2026 WIB',newsText:(id,en)=>en,
  esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  publisherNews:{sources:[{id:'federal_reserve',name:'Federal Reserve'}],items:[{id:'a',source:'federal_reserve',title:'Speech <script>',url:'https://www.federalreserve.gov/newsevents/speech/test.htm',body:['First paragraph','Second paragraph'],contentRights:'public-domain'}]}};
vm.runInNewContext(app.slice(app.indexOf('      function newsArticlePath('),app.indexOf('      window.closeNewsArticle =')),ctx);
ctx.renderNewsReader(); assert.equal(reader.hidden,false); assert.equal(browse.hidden,true);
assert.match(reader.innerHTML,/Full text/);assert.match(reader.innerHTML,/Second paragraph/);assert.doesNotMatch(reader.innerHTML,/<script>/);
ctx.publisherNews.items[0].contentRights='unknown';ctx.renderNewsReader();assert.doesNotMatch(reader.innerHTML,/Second paragraph/);
ctx.newsSourceInRegion=()=>false;ctx.renderNewsReader();assert.match(reader.innerHTML,/Story unavailable/);assert.doesNotMatch(reader.innerHTML,/Speech/);
ctx.canReadNews=()=>false;ctx.renderNewsReader();assert.equal(reader.innerHTML,'');assert.equal(reader.hidden,true);
assert.equal(ctx.newsArticlePath('a&b'),'/economic-news/?article=a%26b');
console.log('Reader routes, escaping, region access, logout clearing and public-domain gate passed');

ctx.canReadNews=()=>true;
ctx.publisherUrl=url=>url.startsWith('https://')?url:null;
const current={id:'waller',source:'fed',title:'Fed Waller discusses inflation and interest rates',url:'https://fed.example/waller',category:'markets',topics:['fed']};
const known=[{id:'fed'},{id:'reuters'},{id:'cn'}];
const articles=[current,
 {id:'r1',source:'reuters',title:'Waller signals further rate hikes as inflation rises',url:'https://news.example/waller',topics:['fed'],category:'markets'},
 {id:'r2',source:'reuters',title:'Powell speaks on monetary policy',url:'https://news.example/powell',topics:['fed']},
 {id:'sports',source:'reuters',title:'Football team wins national title',url:'https://news.example/sport'},
 {id:'copy',source:'reuters',title:current.title,url:'https://news.example/copy'},
 {id:'locked',source:'cn',title:'Waller discusses inflation and interest rates',url:'https://cn.example/waller',topics:['fed']},
 {id:'invalid',source:'reuters',title:'Waller inflation interest rates',url:'javascript:alert(1)',topics:['fed']}];
assert.deepEqual(Array.from(ctx.relatedNews(current,articles,known,id=>id!=='cn'),row=>row.id),['r1','r2']);
const noMatch={...current,title:'Specific unrelated scientific discovery',topics:[]};
assert.equal(ctx.relatedNews(noMatch,articles,known,()=>true).length,0);
const many=Array.from({length:12},(_,i)=>({...articles[1],id:'many'+i,title:'Waller inflation policy interest rates '+String.fromCharCode(65+i),url:'https://news.example/'+i}));
assert.equal(ctx.relatedNews(current,many,known,()=>true).length,5);
console.log('Related stories: topic relevance, ranking, self/duplicate exclusion, region guards, URL safety and five-result limit passed');

const bbc={id:'bbc1',source:'reuters',title:"Britain's BBC, Channel 4 discuss broader tie-up to cut costs, sources say",url:'https://news.example/bbc'};
const bbcRows=[bbc,
 {id:'duplicate',source:'reuters',title:'Exclusive-Britain’s BBC, Channel 4 discuss broader tie-up to cut costs, sources say',url:'https://news.example/copy'},
 {id:'broadcast',source:'reuters',title:'BBC and Channel 4 in talks to join operations in latest plan to cut costs',url:'https://news.example/broadcast'},
 {id:'pepsi',source:'reuters',title:'PepsiCo to cut costs as weak N.America business hurts annual core profit forecast',url:'https://news.example/pepsi'}];
assert.deepEqual(Array.from(ctx.relatedNews(bbc,bbcRows,known,()=>true),row=>row.id),['broadcast']);
console.log('Related news excludes syndicated duplicate titles and generic cost-cutting matches');

const media={...bbc,category:'world'};
const reported={id:'reporting',source:'reuters',title:'Syrian general accused of atrocities, BBC finds',url:'https://news.example/reporting',category:'world'};
assert.deepEqual(Array.from(ctx.relatedNews(media,[...bbcRows,reported],known,()=>true),row=>row.id),['broadcast']);
console.log('A publisher mentioned in an unrelated reporting topic does not count as the article subject');
