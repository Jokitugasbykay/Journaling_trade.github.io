// Real page markup/styles; scripts and external services are excluded from this layout regression.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Maulana Riski/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');let browser;
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  if(name.endsWith('.js')){res.setHeader('Content-Type','application/javascript');res.end('');return;}
  const file=path.resolve(root,'.'+(name.endsWith('.css') || name.endsWith('.svg')?name:'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({reducedMotion:'reduce'});
  const origin='http://127.0.0.1:'+server.address().port;
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin+'/home/',{waitUntil:'load'});
  for(const width of [1920,768,390]){
    await page.setViewportSize({width,height:1000});
    for(const view of ['beranda','statistik','kalkulator']){
      const size=await page.evaluate(view=>{
        document.querySelectorAll('.view-content').forEach(node=>node.classList.toggle('active',node.id==='view-'+view));
        const main=document.querySelector('.main-wrap').getBoundingClientRect(),home=document.querySelector('.home-rolling').getBoundingClientRect();
        return {width:main.width,left:main.left,home:home.width,overflow:document.documentElement.scrollWidth>innerWidth};
      },view);
      assert.ok(size.width<=Math.min(width,1280)+1,`${view} at ${width}: content exceeded its container (${JSON.stringify(size)})`);
      assert.ok(Math.abs(size.left-(width-size.width)/2)<2,`${view} is not centered`);
      if(view==='beranda')assert.ok(size.home<=1121,'Home lost its own maximum width');
      assert.equal(size.overflow,false,`${view} overflow at ${width}`);
    }
  }
  console.log('Home, Statistics and Calculator retain centered widths at 1920, 768 and 390 pixels.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
