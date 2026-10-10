(function (global) {
  'use strict';
  function cells(source, delimiter) {
    const rows=[]; let row=[],value='',quoted=false;
    for(let i=0;i<source.length;i++) {
      const c=source[i];
      if(c==='"') { if(quoted && source[i+1]==='"') {value+='"';i++;} else if(!quoted && value.trim()) throw new Error('Invalid quoted field.'); else quoted=!quoted; }
      else if(c===delimiter && !quoted) {row.push(value.trim());value='';}
      else if((c==='\n'||c==='\r') && !quoted) {if(c==='\r'&&source[i+1]==='\n')i++;row.push(value.trim());if(row.some(Boolean))rows.push(row);row=[];value='';}
      else value+=c;
    }
    if(quoted)throw new Error('Unclosed quoted field.');
    row.push(value.trim());if(row.some(Boolean))rows.push(row);return rows;
  }
  const aliases={market:['market','symbol','instrument','pair'],side:['side','direction','posisi'],openedAt:['opened_at','entry_timestamp'],date:['date','tanggal'],time:['time','waktu','jam'],entry:['entry','entry_price'],exit:['exit','exit_price'],sl:['sl','stop_loss'],tp:['tp','take_profit'],vol:['quantity','lot','volume'],riskPct:['risk_percent','risk_pct'],actualPnl:['net_pnl','pnl','profit'],strategy:['strategy'],reason:['notes','reason']};
  function number(value,positive=false) {
    if(!value)return null;
    if(!/^[+-]?\d+(?:\.\d+)?$/.test(value)||!Number.isFinite(Number(value))||Math.abs(Number(value))>=1e12||positive&&Number(value)<=0)throw new Error('Use finite decimal values with a dot separator.');
    return value;
  }
  function parse(source,accountId) {
    source=source.replace(/^\uFEFF/,'');
    const first=source.split(/\r?\n/,1)[0],delimiter=['\t',';','|',','].sort((a,b)=>first.split(b).length-first.split(a).length)[0];
    const rows=cells(source,delimiter),header=rows.shift()?.map(value=>value.toLowerCase().replace(/\s+/g,'_'))||[];
    const columns=Object.fromEntries(Object.entries(aliases).map(([name,list])=>[name,header.findIndex(value=>list.includes(value))]));
    if(columns.market<0||columns.side<0||columns.entry<0||columns.openedAt<0&&(columns.date<0||columns.time<0))throw new Error('Include symbol, side, entry_price and opened_at (with timezone), or date and time in Asia/Jakarta.');
    if(!rows.length||rows.length>500)throw new Error('Import between 1 and 500 trades at a time.');
    return rows.map((values,index)=>{
      if(values.length!==header.length)throw new Error('Column count does not match on row '+(index+2)+'.');
      const value=name=>columns[name]<0?'':values[columns[name]];
      const market=value('market').trim().toUpperCase();
      if(!/^[A-Z0-9:_/-]{1,60}$/.test(market))throw new Error('Invalid symbol on row '+(index+2)+'.');
      const side=value('side').toLowerCase();
      if(!['buy','long','sell','short'].includes(side))throw new Error('Specify Buy/Long or Sell/Short on row '+(index+2)+'.');
      let openedAt=value('openedAt');
      if(!openedAt) {
        const date=value('date'),time=value('time');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))throw new Error('Specify a valid date and time on row '+(index+2)+'.');
        openedAt=date+'T'+time+(time.length===5?':00':'')+'+07:00';
      }
      if(!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(openedAt)||!Number.isFinite(Date.parse(openedAt)))throw new Error('Specify an ISO entry timestamp with timezone on row '+(index+2)+'.');
      const date=openedAt.slice(0,10),[year,month,day]=date.split('-').map(Number),check=new Date(Date.UTC(year,month-1,day));
      if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)throw new Error('Invalid calendar date on row '+(index+2)+'.');
      const actualPnl=number(value('actualPnl')),riskPct=number(value('riskPct'));
      if(riskPct!==null&&(Number(riskPct)<0||Number(riskPct)>100))throw new Error('Risk percentage must be between 0 and 100.');
      return {id:global.crypto.randomUUID(),accountId,market,posisi:['buy','long'].includes(side)?'Buy':'Sell',openedAt,date,jam:openedAt.slice(11,16),entry:number(value('entry'),true),exit:number(value('exit'),true),sl:number(value('sl'),true),tp:number(value('tp'),true),vol:number(value('vol'),true),riskPct,actualPnl,result:actualPnl===null?'':Number(actualPnl)>0?'Win':Number(actualPnl)<0?'Loss':'BE',strategy:value('strategy').slice(0,160),reason:value('reason').slice(0,10000),tf:''};
    });
  }
  global.JTPRO_IMPORT={parse};
  if(typeof module!=='undefined')module.exports=global.JTPRO_IMPORT;
})(globalThis);
