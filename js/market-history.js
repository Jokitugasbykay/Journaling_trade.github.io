(function(global){
  'use strict';
  const frames={'1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400};
  const targetBars=tf=>frames[tf] && frames[tf]<=3600?2000:500;
  const cryptoSymbol=symbol=>/^[A-Z0-9]{2,25}(?:USDT|USDC)$/.test(symbol);
  function validate(symbol,tf){if(!/^[A-Z0-9_]{1,30}$/.test(symbol)||!frames[tf])throw new Error('Instrumen atau timeframe histori tidak valid.');}
  async function binance(symbol,tf,count=2000,{signal,start,onProgress=()=>{}}={}){
    validate(symbol,tf);
    if(!Number.isInteger(count)||count<1||count>2000000)throw new Error('Jumlah candle tidak valid.');
    const rows=new Map();let cursor=start?Number(start)*1000:null,older=null;
    const now=Date.now(),duration=frames[tf]*1000;
    while(rows.size<count){
      signal?.throwIfAborted();
      const params=new URLSearchParams({symbol,interval:tf,limit:String(Math.min(1000,count-rows.size+1))});
      if(cursor!==null)params.set('startTime',String(cursor));else if(older!==null)params.set('endTime',String(older));
      let response,lastError;
      for(const host of ['https://data-api.binance.vision','https://api.binance.com']){
        try{response=await fetch(host+'/api/v3/klines?'+params,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000),cache:'no-store'});if(response.status===429||response.status===418)throw new Error('Batas permintaan feed tercapai. Tunggu sebelum menjalankan ulang.');if(response.ok)break;lastError=new Error('Feed histori Binance tidak tersedia ('+response.status+').');}
        catch(e){if(signal?.aborted)throw e;lastError=e;if(response?.status===429||response?.status===418)throw e;}
      }
      if(!response?.ok)throw lastError||new Error('Feed histori Binance tidak tersedia.');
      const raw=await response.json();if(!Array.isArray(raw))throw new Error('Format histori Binance tidak valid.');if(!raw.length)break;
      const before=rows.size;
      for(const k of raw){const time=Number(k[0]);if(!Number.isFinite(time)||time+duration>now)continue;rows.set(time,{time:time/1000,open:Number(k[1]),high:Number(k[2]),low:Number(k[3]),close:Number(k[4]),closeTime:time+duration,sourceInstrument:symbol,provider:'Binance'});}
      onProgress(rows.size);
      if(cursor!==null){const next=Number(raw[raw.length-1][0])+duration;if(next<=cursor)throw new Error('Pagination histori tidak maju.');cursor=next;if(cursor>=now)break;}
      else{const next=Number(raw[0][0])-1;if(older!==null&&next>=older)throw new Error('Pagination histori tidak mundur.');older=next;}
      if(rows.size===before||raw.length<Number(params.get('limit')))break;
    }
    const sorted=[...rows.values()].sort((a,b)=>a.time-b.time);
    return cursor===null?sorted.slice(-count):sorted.slice(0,count);
  }
  function parseCSV(source,symbol,tf){
    validate(symbol,tf);
    if(source.length>100*1024*1024)throw new Error('CSV maksimum 100 MB.');
    const parser=global.JTPRO_IMPORT?.cells;
    if(!parser)throw new Error('Parser CSV belum dimuat.');
    const first=source.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0],delimiter=['\t',';',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
    const rows=parser(source.replace(/^\uFEFF/,''),delimiter),headers=(rows.shift()||[]).map(h=>h.toLowerCase().trim());
    const columns=Object.fromEntries(['time','open','high','low','close'].map(k=>[k,headers.indexOf(k)]));
    if(columns.time<0)columns.time=headers.indexOf('timestamp');
    if(Object.values(columns).some(i=>i<0))throw new Error('CSV wajib memuat time, open, high, low, close.');
    if(rows.length>2000000)throw new Error('Maksimum 2 juta candle per CSV.');
    const parsed=rows.map((r,index)=>{
      const raw=r[columns.time]||'';let time;
      if(/^\d+(?:\.\d+)?$/.test(raw)){time=Number(raw);if(time>1e12)time/=1000;}
      else{if(!/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw))throw new Error('Waktu CSV harus Unix atau ISO8601 dengan zona waktu; baris '+(index+2)+'.');time=Date.parse(raw)/1000;}
      const row={time,sourceInstrument:symbol,provider:'CSV pengguna'};
      for(const key of ['open','high','low','close']){const value=r[columns[key]];if(!value||!/^\d+(?:\.\d+)?$/.test(value)||!Number.isFinite(Number(value)))throw new Error('OHLC tidak valid pada baris '+(index+2)+'.');row[key]=Number(value);}
      if(!Number.isFinite(time))throw new Error('Timestamp CSV tidak valid.');return row;
    });
    parsed.sort((a,b)=>a.time-b.time);
    let step=Infinity;for(let i=1;i<parsed.length;i++)if(parsed[i].time>parsed[i-1].time)step=Math.min(step,parsed[i].time-parsed[i-1].time);
    const duration=frames[tf];
    if(step===Infinity||step===duration)return parsed;
    if(step>duration||duration%step!==0)throw new Error('Resolusi CSV tidak dapat dipakai pada '+tf.toUpperCase()+'. Gunakan candle dengan resolusi sama atau lebih kecil.');
    const buckets=new Map();for(const bar of parsed){const key=Math.floor(bar.time/duration)*duration;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(bar);}
    const aggregated=[];
    for(const [time,bars]of buckets){if(bars.length!==duration/step||bars.some((bar,i)=>bar.time!==time+i*step))continue;aggregated.push({time,open:bars[0].open,high:Math.max(...bars.map(b=>b.high)),low:Math.min(...bars.map(b=>b.low)),close:bars[bars.length-1].close,sourceInstrument:symbol,provider:'CSV pengguna (agregasi '+tf+')'});}
    return aggregated;
  }
  async function load({instrument,timeframe,period,signal,request,supplied,onProgress=()=>{}}){
    validate(instrument,timeframe);const count=period==='2000_BARS'?2000:period==='500_BARS'?500:2000;
    const start=period==='1-2_YEARS'?Date.UTC(2024,0,1)/1000:period==='6_MONTHS'?Date.now()/1000-180*86400:null;
    let serverError;
    if(request){try{const candles=[];let offset=0;for(;;){signal?.throwIfAborted();const params=new URLSearchParams({instrument,timeframe,limit:String(Math.min(2000,count-candles.length)),offset:String(offset)});if(start)params.set('start',new Date(start*1000).toISOString());const data=await request('/market/history?'+params,{signal});if(data.instrument!==instrument||data.timeframe!==timeframe||!Array.isArray(data.candles))throw new Error('Histori backend tidak cocok dengan pilihan.');if(!start&&offset===0&&Number.isInteger(data.total)&&data.total>count){offset=data.total-count;continue;}candles.push(...data.candles);onProgress(candles.length);if(!data.has_more||candles.length>=count)break;if(!Number.isInteger(data.next_offset)||data.next_offset<=offset)throw new Error('Pagination histori backend tidak valid.');offset=data.next_offset;}if(candles.length>=80)return candles;}catch(e){if(signal?.aborted)throw e;serverError=e;}}
    if(cryptoSymbol(instrument))return binance(instrument,timeframe,count,{start,signal,onProgress});
    const isMatch=(src,tgt)=>{if(!src)return true;const s=String(src).toUpperCase().replace(/[^A-Z0-9]/g,''),t=String(tgt).toUpperCase().replace(/[^A-Z0-9]/g,'');if(s===t||s===t+'T'||s===t+'USDT'||t===s+'T'||t===s+'USDT')return true;if((t==='XAUUSD'||t==='GOLD')&&(s==='PAXGUSDT'||s==='PAXGUSD'||s==='XAUUSD'||s==='GOLD'))return true;if((t==='BTCUSD'||t==='BTCUSDT')&&(s==='BTCUSDT'||s==='BTCUSD'))return true;if(t==='EURUSD'&&(s==='EURUSDT'||s==='EURUSD'))return true;if(t==='GBPUSD'&&(s==='GBPUSDT'||s==='GBPUSD'))return true;if(t==='AUDUSD'&&(s==='AUDUSDT'||s==='AUDUSD'))return true;return false;};
    const valid=(supplied||[]).filter(c=>!c.synthetic&&isMatch(c.sourceInstrument,instrument));
    if(valid.length>=80)return valid;
    throw new Error('Histori '+instrument+' belum tersedia pada sumber Kayla engine. Muat CSV OHLC instrumen ini atau sambungkan feed histori backend. '+(serverError?'Backend: '+serverError.message:''));
  }
  global.JTMarketHistory={frames,targetBars,binance,parseCSV,load};
  if(typeof module!=='undefined')module.exports=global.JTMarketHistory;
})(globalThis);
