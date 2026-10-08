const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const reader = {innerHTML:'', querySelector:()=>null};
const browse = {};
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
