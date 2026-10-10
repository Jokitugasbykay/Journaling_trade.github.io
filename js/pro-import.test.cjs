const assert=require('node:assert/strict'),{parse}=require('./pro-import.js');
const header='symbol,side,entry_price,date,time,notes,net_pnl';
const trade=parse(header+'\nEURUSD,Buy,1.1,2026-10-10,09:00,"A note, with comma",-5','account')[0];
assert.equal(trade.reason,'A note, with comma');assert.equal(trade.openedAt,'2026-10-10T09:00:00+07:00');
assert.equal(trade.sl,null);assert.equal(trade.tp,null);assert.equal(trade.vol,null);assert.equal(trade.riskPct,null);assert.equal(trade.tf,'');assert.equal(trade.result,'Loss');
const missing=parse('symbol;side;entry_price;opened_at\nXAUUSD;long;2000;2026-10-10T02:00:00Z','account')[0];assert.equal(missing.actualPnl,null);assert.equal(missing.result,'');
assert.throws(()=>parse(header+'\nEURUSD,unknown,1.1,2026-10-10,09:00,note,5','a'));
assert.throws(()=>parse(header+'\nEURUSD,Buy,1.1,2026-02-30,09:00,note,5','a'));
assert.throws(()=>parse(header+'\nEURUSD,Buy,Infinity,2026-10-10,09:00,note,5','a'));
assert.throws(()=>parse('EURUSD,Buy,1.1,1.0,1.2','a'));
assert.throws(()=>parse(header+'\nEURUSD,Buy,1.1,2026-10-10,09:00,"unclosed,5','a'));
console.log('Strict Pro import preview preserves unknown values, quoted fields and source timestamps; ambiguous and invalid records rejected.');

(async()=>{
  const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(__dirname+'/app.js','utf8');
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{value:'USD',disabled:false});return nodes.get(id);};
  const row={market:'EURUSD',direction:'Buy',date:'2026-10-10',time:'09:00',entry:1.1,exit:1.2,volume:1,profit:-5};
  let preview;
  const scope={crypto:require('node:crypto').webcrypto,TextEncoder,currentScan:{name:'statement.png',text:'explicit test evidence'},
    scanHistoryRows:()=>[row],currentAccount:()=>({id:'a',currency:'USD'}),$:node,trades:[],JTPRO_CONFIG:{apiBase:'https://gateway.example',journalApiBase:'https://gateway.example'},
    uiText:(_id,en)=>en,showUploadPreview:rows=>preview=rows,saveData(){throw Error('Quota bypass: local save called');}};
  scope.window=scope;
  vm.runInNewContext(source.slice(source.indexOf('      window.importScanToJournal ='),source.indexOf('      function renderScanRecognition(')),scope);
  await scope.importScanToJournal();
  assert.equal(preview.length,1);assert.equal(preview[0].actualPnl,-5);assert.equal(preview[0].sl,null);assert.equal(scope.trades.length,0);
  assert.equal(node('btn-import-scan').disabled,false);
  preview=null;node('scan-profit-currency').value='IDR';await scope.importScanToJournal();
  assert.equal(preview,null);assert.match(node('upload-status-msg').textContent,/same currency/);
  console.log('Configured PDF/image imports require private confirmation and preserve profit currency without bypassing server quota.');
})().catch(error=>{console.error(error);process.exitCode=1;});
