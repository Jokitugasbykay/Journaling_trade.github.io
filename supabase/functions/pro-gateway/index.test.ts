import {handler} from './index.ts';
import {pdfBytes} from './report.ts';
import {PDFDocument} from 'npm:pdf-lib@1.17.1';
const assert=(value:unknown,message='Assertion failed')=>{if(!value)throw new Error(message);};
const uid='acb10000-0000-4000-a000-000000000001',jobId='acb10000-0000-4000-a000-000000000003';
const origin='https://jokitugasbykay.github.io',url='https://example.invalid/functions/v1/pro-gateway/api/v1';
const send=(route:string,method='GET',body?:unknown)=>handler(new Request(url+route,{method,headers:{Origin:origin,Authorization:'Bearer fixture-token-not-real','Content-Type':'application/json','Idempotency-Key':jobId},body:body?JSON.stringify(body):undefined}));
Deno.test('Gateway authentication, ownership, contracts and real PDF generation (provider fixtures)',async()=>{
  const original=globalThis.fetch;let pro=true,reportStatus='succeeded';const calls:string[]=[];const background:Promise<unknown>[]=[];
  Object.assign(globalThis,{EdgeRuntime:{waitUntil:(task:Promise<unknown>)=>background.push(task)}});
  const overview={metrics:{trade_count:2,expectancy:5,profit_factor:2,win_rate:50},groups:{instrument:[{label:'EURUSD',trade_count:2,net_pnl:10,win_rate:50}]},equity:[],currency:'USD',warnings:[]};
  const analytics={overview,heatmap:{days:[]},risk:{overview:{},violations:[],warnings:[]}};
  globalThis.fetch=(input:any,init?:RequestInit)=>{
    const path=new URL(String(input)).pathname;calls.push(path);
    if(path==='/auth/v1/user')return Promise.resolve(Response.json({id:uid}));
    if(path.endsWith('/journal_rate_limit')){assert(JSON.parse(String(init?.body)).p_bucket==='pro_api');return Promise.resolve(Response.json(true));}
    if(path.endsWith('/journal_entitlements'))return Promise.resolve(Response.json({plan:pro?'pro':'free',effectiveUntil:'9999-12-31T23:59:59Z',aiLimit:30,aiRemaining:30}));
    if(path.endsWith('/journal_edge_analytics'))return Promise.resolve(Response.json(analytics));
    if(path.endsWith('/journal_create_job')){const payload=JSON.parse(String(init?.body));assert(payload.p_idempotency_key===jobId && payload.p_payload_hash.length===64);return Promise.resolve(Response.json({id:jobId,status:'queued',kind:'report'}));}
    if(path.endsWith('/journal_edge_claim_report'))return Promise.resolve(Response.json({id:jobId}));
    if(path.endsWith('/journal_recover_jobs'))return Promise.resolve(Response.json(0));
    if(path.startsWith('/storage/v1/object/journal-reports/')){assert(init?.body instanceof ArrayBuffer,'PDF bytes missing');return Promise.resolve(Response.json({Key:'private'}));}
    if(path.endsWith('/journal_finish_job')){assert(JSON.parse(String(init?.body)).p_result.storage_path.startsWith(uid+'/'));return Promise.resolve(Response.json({status:'succeeded'}));}
    if(path==='/storage/v1/object/journal-reports'){assert(init?.method==='DELETE' && JSON.parse(String(init.body)).prefixes[0]===uid+'/'+jobId+'.pdf');return Promise.resolve(Response.json([]));}
    if(path.endsWith('/journal_delete_job'))return Promise.resolve(Response.json(true));
    if(path.endsWith('/trading_accounts')){assert(String(input).includes('user_id=eq.'+uid));return Promise.resolve(Response.json([{id:uid,name:'Owned'}]));}
    if(path.endsWith('/performance_reviews'))return Promise.resolve(Response.json([]));
    if(path.endsWith('/platform_jobs'))return Promise.resolve(Response.json([{id:jobId,status:reportStatus,result:{storage_path:uid+'/'+jobId+'.pdf'}}]));
    if(path.endsWith('/berita.json'))return Promise.resolve(Response.json({items:[{title:'Publisher headline',url:'https://publisher.invalid/story',source:'publisher',category:'Markets',publishedAt:'2026-10-01'}],sources:[{id:'publisher',name:'Publisher'}]}));
    if(path.endsWith('/regional-sources.json'))return Promise.resolve(Response.json({ID:[{id:'publisher'}]}));
    if(path.endsWith('/news-regions.json'))return Promise.resolve(Response.json({asia:['ID']}));
    throw new Error('Unexpected dependency '+path);
  };
  try {
    assert((await handler(new Request(url+'/analytics/overview'))).status===401);
    assert((await handler(new Request(url+'/entitlements',{headers:{Origin:'https://foreign.invalid'}}))).status===403);
    assert((await send('/entitlements')).status===200);
    assert((await handler(new Request('https://example.invalid/pro-gateway/api/v1/entitlements',{headers:{Origin:origin,Authorization:'Bearer fixture-token-not-real'}}))).status===200);
    pro=false;assert((await send('/analytics/overview')).status===403);pro=true;
    assert((await (await send('/analytics/overview')).json()).metrics.expectancy===5);
    assert((await (await send('/accounts')).json()).items[0].name==='Owned');
    assert((await send('/ai/history?kind=unexpected')).status===422);
    assert((await send('/reports/preview','POST',{sections:['unexpected']})).status===422);
    assert((await send('/ai/chat','POST',{message:'Hi'})).status===503);
    assert(!calls.some(path=>path.endsWith('/journal_create_job')),'Unavailable inference reserved quota');
    assert((await send('/reports','POST',{sections:['analytics']})).status===202);await Promise.all(background);
    assert(calls.some(path=>path.endsWith('/journal_finish_job')),'PDF completion not persisted');
    reportStatus='running';assert((await send('/reports/'+jobId,'DELETE')).status===409);reportStatus='succeeded';
    assert((await send('/reports/'+jobId,'DELETE')).status===204);
    assert(calls.includes('/storage/v1/object/journal-reports'),'Private PDF was not removed');
    assert((await (await send('/news/filters')).json()).countries[0]==='ID');
    assert((await (await send('/news?country=ID&region=asia')).json()).items.length===1);
    assert((await send('/news?country=INVALID')).status===422);
    const bytes=await pdfBytes({period:'October 2026',analytics:overview}),pdf=await PDFDocument.load(bytes);
    assert(pdf.getPageCount()>0 && pdf.getTitle()==='journalingtrade Performance Report');
  }finally{globalThis.fetch=original;}
});
