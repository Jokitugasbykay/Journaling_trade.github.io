const assert=require('node:assert/strict');
require('../js/pro-import.js');const history=require('../js/market-history.js');
(async()=>{
 for(const tf of ['1m','5m','15m','30m','1h'])assert.equal(history.targetBars(tf),2000);
 assert.equal(history.targetBars('4h'),500);
 const requests=[],base=Date.UTC(2024,0,8),duration=60000;
 const raw=Array.from({length:3000},(_,i)=>[base+i*duration,'2000','2001','1999','2000','1',base+(i+1)*duration-1]);
 const original=global.fetch;
 try{
  global.fetch=async(url,options)=>{const u=new URL(url);requests.push(u);const limit=Number(u.searchParams.get('limit'));assert.ok(limit<=1000);let rows=raw.filter(r=>!u.searchParams.has('endTime')||r[0]<=Number(u.searchParams.get('endTime')));if(u.searchParams.has('startTime'))rows=rows.filter(r=>r[0]>=Number(u.searchParams.get('startTime'))).slice(0,limit);else rows=rows.slice(-limit);return {ok:true,status:200,json:async()=>rows};};
  const latest=await history.binance('BTCUSDT','1m',2000);
  assert.equal(latest.length,2000);assert.equal(latest[0].time,raw[1000][0]/1000);assert.equal(new Set(latest.map(x=>x.time)).size,2000);assert.ok(requests.length>=2);
  const old=await history.binance('BTCUSDT','1m',2000,{start:base/1000});assert.equal(old[0].time,base/1000);assert.equal(old.length,2000);
  const abort=new AbortController();abort.abort();await assert.rejects(()=>history.binance('BTCUSDT','1m',2000,{signal:abort.signal}),e=>e.name==='AbortError');
  global.fetch=async()=>({ok:false,status:429});await assert.rejects(()=>history.binance('BTCUSDT','1m',2000),/Batas permintaan/);
 }finally{global.fetch=original;}
 const csv='time,open,high,low,close\n2024-01-08T08:00:00Z,2000,2001,1999,2000';
 const parsed=history.parseCSV(csv,'XAUUSD','1m');assert.equal(parsed[0].time,Date.parse('2024-01-08T08:00:00Z')/1000);
 assert.throws(()=>history.parseCSV(csv.replace('T08:00:00Z','T08:00:00'),'XAUUSD','1m'),/zona waktu/);
 assert.throws(()=>history.parseCSV('time,open,high,low,close\n1,broken,2,1,2','XAUUSD','1m'),/OHLC/);
 const csvMinutes='time,open,high,low,close\n'+Array.from({length:120},(_,i)=>[Date.parse('2024-01-08T08:00:00Z')/1000+i*60,2000,2001,1999,2000].join(',')).join('\n');
 const hours=history.parseCSV(csvMinutes,'XAUUSD','1h');assert.equal(hours.length,2);assert.equal(hours[1].time-hours[0].time,3600);
 const csvHours='time,open,high,low,close\n'+hours.map(r=>[r.time,r.open,r.high,r.low,r.close].join(',')).join('\n');
 assert.throws(()=>history.parseCSV(csvHours,'XAUUSD','1m'),/Resolusi CSV/);
 const calls=[];const loaded=await history.load({instrument:'XAUUSD',timeframe:'1m',period:'2000_BARS',request:async path=>{calls.push(path);return {instrument:'XAUUSD',timeframe:'1m',candles:Array.from({length:2000},(_,i)=>({...parsed[0],time:parsed[0].time+i*60})),has_more:false};}});
 assert.equal(loaded.length,2000);assert.ok(calls[0].includes('limit=2000'));
 const offsets=[];const recent=await history.load({instrument:'XAUUSD',timeframe:'1m',period:'2000_BARS',request:async path=>{const offset=Number(new URL('https://fixture'+path).searchParams.get('offset'));offsets.push(offset);return {instrument:'XAUUSD',timeframe:'1m',total:3000,candles:Array.from({length:2000},(_,i)=>({...parsed[0],time:parsed[0].time+(i+offset)*60})),has_more:offset===0};}});
 assert.deepEqual(offsets,[0,1000]);assert.equal(recent[0].time,parsed[0].time+1000*60);
 await assert.rejects(()=>history.load({instrument:'XAUUSD',timeframe:'1m',period:'2000_BARS',supplied:[{synthetic:true}],request:async()=>{throw new Error('unavailable');}}),/Histori XAUUSD belum tersedia/);
 console.log('History: paginated 2000 real-provider fixture bars, 2024 start cursor, cancellation, rate limits, CSV timezone, and backend selection verified.');
})().catch(e=>{console.error(e);process.exitCode=1;});
