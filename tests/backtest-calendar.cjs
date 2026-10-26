const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},document:{baseURI:'https://example.test/'},URL,URLSearchParams,AbortController,AbortSignal,DOMException,Blob,Date,Intl,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../js/pro.js'),'utf8'),context);
const {isBacktestSessionOpen:open,runKaystradeBacktestEngine:run}=context.window.JTPRO;
const epoch=s=>Date.parse(s)/1000;
for(const date of ['2026-10-24T05:55:00Z','2026-10-25T10:44:00Z'])assert.equal(open('XAUUSD',epoch(date)),false,'Screenshot weekend entry must be closed');
assert.equal(open('XAUUSD',epoch('2026-10-23T20:30:00Z')),true,'Saturday 03:30 WIB is still Friday New York trading');
assert.equal(open('XAUUSD',epoch('2026-10-23T21:00:00Z')),false);
assert.equal(open('XAUUSD',epoch('2026-10-25T22:04:00Z')),false);
assert.equal(open('XAUUSD',epoch('2026-10-25T22:05:00Z')),true,'Summer reopening');
assert.equal(open('XAUUSD',epoch('2026-01-04T22:30:00Z')),false);
assert.equal(open('XAUUSD',epoch('2026-01-04T23:05:00Z')),true,'Winter reopening adjusts for DST');
assert.equal(open('XAUUSD',epoch('2026-01-09T21:30:00Z')),true);
assert.equal(open('XAUUSD',epoch('2026-01-09T22:00:00Z')),false);
assert.equal(open('EURUSD',epoch('2026-10-25T21:05:00Z')),true,'FX opens earlier than metals');
assert.equal(open('XAUUSD',epoch('2026-10-26T21:30:00Z')),false,'Daily metals break');
for(const instrument of ['BTCUSDT','BTCUSD','PAXGUSDT'])assert.equal(open(instrument,epoch('2026-10-25T10:44:00Z')),true,'Crypto remains available on weekends');
assert.throws(()=>open('UNKNOWN',epoch('2026-10-26T10:00:00Z')),/Kalender/);
assert.throws(()=>run(null,{instrument:'XAUUSD'}),/historis belum tersedia/);
assert.throws(()=>run([{synthetic:true}],{instrument:'XAUUSD'}),/sintetis/);
assert.throws(()=>run([{sourceInstrument:'PAXGUSDT'}],{instrument:'XAUUSD'}),/proxy/);
// Explicitly synthetic test fixture, never a provider or performance claim.
const candles=[];let last=2000;
for(let i=0;i<7200;i++){
 const close=2000+Math.sin(i/25)*8+Math.sin(i/90)*15;
 candles.push({time:epoch('2024-01-05T08:00:00Z')+i*60,open:last,high:Math.max(last,close)+0.03,low:Math.min(last,close)-0.03,close});last=close;
}
const result=run(candles,{instrument:'XAUUSD',timeframe:'1m',period:'1-2_YEARS',tradingStyle:'INTRADAY'});
assert.ok(result.excludedClosedSession>0);
assert.ok(result.candlesCount<candles.length);
assert.ok(result.totalTrades>0,'Fixture must exercise actual trade-entry checks');
for(const trade of result.trades){assert.ok(open('XAUUSD',trade.entryTime));assert.ok(!trade.reason.includes('7/7'));}
assert.equal(result.dataStatus,'partial');
const crypto=run(candles,{instrument:'BTCUSDT',timeframe:'1m',period:'1-2_YEARS'});
assert.equal(crypto.excludedClosedSession,0);assert.equal(crypto.candlesCount,candles.length);
assert.throws(()=>run([{time:Date.now()/1000+3600,open:2000,high:2001,low:1999,close:2000}],{instrument:'XAUUSD'}),/tidak cukup/);
console.log('Backtest calendar: screenshot weekend entries rejected, Saturday WIB overlap preserved, DST and daily breaks respected, crypto remains 24/7, demo/proxy/missing data rejected; '+result.totalTrades+' fixture trades verified.');
