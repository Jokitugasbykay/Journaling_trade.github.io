const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const bootstrap=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const routes=['home','journal','statistics','calculator','economic-news','economic-news/calendar','economic-news/social','profile','login','pro','analytics','heatmap','strategies','risk','reviews','reports','ai','ai/behaviour','ai/market','ai/journal','ai/chat','global-news'];
for(const prefix of ['','Journaling_trade.github.io/'])for(const route of [...routes,'index.html','']){
 const base={href:''};
 vm.runInNewContext(bootstrap,{location:{pathname:'/'+prefix+route+(route && !route.endsWith('.html')?'/':'')},document:{getElementById:()=>base}});
 assert.equal(base.href,'/'+prefix,'Asset base for '+prefix+route);
}
console.log('Single HTML routing: all 22 routes resolve assets at root and GitHub Pages project paths.');
