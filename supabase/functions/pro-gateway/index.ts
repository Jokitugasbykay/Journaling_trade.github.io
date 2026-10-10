declare const EdgeRuntime:{waitUntil(task:Promise<unknown>):void};
import {pdfBytes} from './report.ts';
// Hosted deterministic endpoints use the caller's JWT/RLS. Python handles AI when provisioned.
const PROJECT = 'https://nmddjuqkdyhcobddinkc.supabase.co';
const SITE = 'https://jokitugasbykay.github.io';
class Failure extends Error { constructor(public status: number, message: string) { super(message); } }
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('Origin') || '';
  const headers = {'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin',
    'Access-Control-Allow-Origin': origin === SITE ? origin : SITE,
    'Access-Control-Allow-Headers':'authorization,content-type,idempotency-key,apikey',
    'Access-Control-Allow-Methods':'GET,POST,PATCH,PUT,DELETE,OPTIONS'};
  const respond = (data: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), {status, headers});
  if (origin && origin !== SITE) return respond({detail:'Origin not allowed'},403);
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
  try {
    const auth = req.headers.get('Authorization') || '';
    if (!/^Bearer \S{10,8192}$/.test(auth)) throw new Failure(401,'Sign in to continue');
    const apiKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const call = async (path: string, method='GET', body?: unknown) => {
      const res = await fetch(PROJECT+path,{method,headers:{apikey:apiKey,Authorization:auth,'Content-Type':'application/json','Prefer':'return=representation'},
        body:body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(20000)});
      const data = await res.json().catch(()=>null);
      if (!res.ok) {
        const status = data?.code === 'P0001' ? 429 : data?.code === '42501' ? 403 : ['22023','22P02','22007','22008'].includes(data?.code) ? 422 : res.status;
        throw new Failure(status >= 500 ? 503 : status, status===403 ? 'Authentication, entitlement or ownership check failed' : status===422 ? 'Invalid values, dates or identifiers' : data?.code==='23505' ? 'This record already exists' : 'Database operation could not be completed');
      }
      return data;
    };
    const rpc = (name: string, body={}) => call('/rest/v1/rpc/'+name,'POST',body);
    const user = await call('/auth/v1/user');
    if (!user?.id || !uuid(user.id)) throw new Failure(401,'Invalid authentication token');
    if (await rpc('journal_rate_limit',{p_bucket:'pro_api',p_limit:120,p_window_seconds:60}) !== true) throw new Failure(429,'Try again shortly');
    const raw = await rpc('journal_entitlements');
    const access = {plan:raw.plan,effective_until:raw.effectiveUntil,countries:raw.countries || [],
      ai:{limit:raw.aiLimit,used:raw.aiUsed,reserved:raw.aiReserved,remaining:raw.aiRemaining,period_start:raw.periodStart,period_end:raw.periodEnd}};
    const url = new URL(req.url); let route = url.pathname.replace(/^\/(?:functions\/v1\/)?pro-gateway/,'').replace(/^\/api\/v1/,'');
    if (route === '/entitlements' && req.method === 'GET') return respond(access);
    if (raw.plan !== 'pro' || Date.parse(raw.effectiveUntil) <= Date.now()) throw new Failure(403,'An active Pro subscription is required');
    const privileged=async(path:string,method:string,payload?:unknown,bytes?:Uint8Array)=>{
      const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      const res=await fetch(PROJECT+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':bytes?'application/pdf':'application/json'},body:bytes?new Uint8Array(bytes).buffer:(payload===undefined?undefined:JSON.stringify(payload)),signal:AbortSignal.timeout(20000)});
      if(!res.ok)throw new Failure(503,'Report storage or completion could not be completed. Retry the operation.');return res.json().catch(()=>null);
    };
    let body: Record<string,unknown> = {};
    if (['POST','PATCH','PUT'].includes(req.method)) {
      const input = await req.text();
      if (input.length>32768) throw new Failure(413,'Request too large');
      try {body=JSON.parse(input || '{}');} catch {throw new Failure(422,'Invalid JSON');}
      if (!body || Array.isArray(body) || typeof body !== 'object') throw new Failure(422,'Invalid request');
    }
    const filters = Object.fromEntries(url.searchParams);
    const analytics = (config=filters) => rpc('journal_edge_analytics',{p_filters:config});
    const rows = async (table: string, extra='') => call('/rest/v1/'+table+'?select=*&user_id=eq.'+user.id+'&limit=1000'+extra);
    const shape=(job:any)=>({...job,state:job.status});
    const reportPreview=async(config:Record<string,unknown>)=>{
      if(!Array.isArray(config.sections) || !config.sections.length || config.sections.some(s=>!['analytics','heatmap','risk','reviews'].includes(String(s))))throw new Failure(422,'Select valid report sections');
      const data=await analytics(config as Record<string,string>),preview:any={period:(config.start || 'Beginning')+' to '+(config.end || 'Present')};
      for(const section of config.sections as string[])preview[section]=section==='analytics'?data.overview:section==='reviews'?(await rows('performance_reviews')).filter((r:any)=>(!config.account_id || r.account_id===config.account_id) && (!config.start || r.period_start>=config.start) && (!config.end || r.period_start<=config.end)):data[section];return preview;
    };
    const ownedJob=async(id:string,kind:string)=>{if(!uuid(id))throw new Failure(422,'Invalid identifier');const jobs=await rows('platform_jobs','&id=eq.'+id+'&kind=eq.'+kind+'&deleted_at=is.null');if(!jobs.length)throw new Failure(404,'Job not found');return jobs[0];};
    if(route==='/reports' || route.startsWith('/reports/'))await privileged('/rest/v1/rpc/journal_recover_jobs','POST',{});
    if (req.method==='GET' && ['/accounts','/strategies'].includes(route)) return respond({items:await rows(route==='/accounts'?'trading_accounts':'strategies')});
    if (route==='/analytics/overview' && req.method==='GET') return respond((await analytics()).overview);
    if (route==='/analytics/heatmap' && req.method==='GET') return respond((await analytics()).heatmap);
    if (route==='/analytics/risk' && req.method==='GET') return respond((await analytics()).risk);
    if (route==='/analytics/strategies' && req.method==='GET') {
      const ids = (filters.strategy_ids || '').split(',');
      if (ids.length<2 || ids.length>6 || ids.some(id=>!uuid(id))) throw new Failure(422,'Select between two and six strategies');
      const owned=await rows('strategies');
      if (ids.some(id=>!owned.some((row:any)=>row.id===id))) throw new Failure(404,'Strategy not found');
      const strategies=[];
      for (const id of ids) {const data=(await analytics({...filters,strategy_id:id})).overview; strategies.push({...owned.find((row:any)=>row.id===id),metrics:data.metrics,equity:data.equity,sample_warning:data.metrics.trade_count<30?'Fewer than 30 trades; compare cautiously.':null});}
      return respond({strategies});
    }
    if (route==='/risk/calculate' && req.method==='POST') return respond(await rpc('journal_edge_position',{p_inputs:body}));
    if (route==='/reviews' && req.method==='GET') return respond({items:await rows('performance_reviews','&order=period_start.desc')});
    if (route==='/reviews' && req.method==='POST') return respond(await rpc('journal_edge_review',{p_config:body}),202);
    const retry=route.match(/^\/reports\/([^/]+)\/retry$/);
    if(retry && req.method==='POST'){const old=await ownedJob(retry[1],'report');if(!['failed','expired','cancelled'].includes(old.status))throw new Failure(409,'Only failed reports can be retried');body=old.payload;route='/reports';}
    if(route==='/reports/preview' && req.method==='POST')return respond(await reportPreview(body));
    if(route==='/reports' && req.method==='GET')return respond({items:(await rows('platform_jobs','&kind=eq.report&deleted_at=is.null&order=created_at.desc')).map(shape)});
    if(route==='/reports' && req.method==='POST') {
      const preview=await reportPreview(body),key=req.headers.get('Idempotency-Key') || '';
      if(!uuid(key))throw new Failure(422,'A valid idempotency key is required');
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body))))).map(n=>n.toString(16).padStart(2,'0')).join('');
      const job=await rpc('journal_create_job',{p_kind:'report',p_payload:body,p_idempotency_key:key,p_payload_hash:hash});
      const generate=async()=>{
        const worker=crypto.randomUUID();
        const claimed=await privileged('/rest/v1/rpc/journal_edge_claim_report','POST',{p_id:job.id,p_worker:worker});
        if(!claimed)return;
        const path=user.id+'/'+job.id+'.pdf';
        try {const bytes=await pdfBytes(preview);await privileged('/storage/v1/object/journal-reports/'+path,'POST',undefined,bytes);
          await privileged('/rest/v1/rpc/journal_finish_job','POST',{p_job_id:job.id,p_worker_id:worker,p_result:{storage_path:path,bytes:bytes.length},p_error:null});
        }catch {await privileged('/rest/v1/rpc/journal_finish_job','POST',{p_job_id:job.id,p_worker_id:worker,p_result:null,p_error:'PDF generation failed. Retry the report.'});}
      };
      if(job.status==='queued')EdgeRuntime.waitUntil(generate());return respond(shape(job),202);
    }
    const reportMatch=route.match(/^\/reports\/([^/]+)(?:\/(download|retry))?$/);
    if(reportMatch){const job=await ownedJob(reportMatch[1],'report');
      if(req.method==='GET' && !reportMatch[2])return respond(shape(job));
      if(req.method==='GET' && reportMatch[2]==='download'){
        if(job.status!=='succeeded' || Date.now()-Date.parse(job.finished_at)>30*86400000)throw new Failure(409,'Report is incomplete or its download retention has expired');
        const path=user.id+'/'+job.id+'.pdf';if(job.result?.storage_path!==path)throw new Failure(409,'Invalid report location');
        const signed=await call('/storage/v1/object/sign/journal-reports/'+path,'POST',{expiresIn:60});return respond({url:PROJECT+'/storage/v1'+signed.signedURL});
      }
      if(req.method==='DELETE' && !reportMatch[2]){
        if(['queued','running'].includes(job.status))throw new Failure(409,'Wait for this report to finish before deleting it');
        const path=user.id+'/'+job.id+'.pdf';
        if(job.result?.storage_path){
          if(job.result.storage_path!==path)throw new Failure(409,'Invalid report location');
          await privileged('/storage/v1/object/journal-reports','DELETE',{prefixes:[path]});
        }
        if(await rpc('journal_delete_job',{p_job_id:job.id})!==true)throw new Failure(409,'Report deletion could not be completed');return respond(null,204);
      }
      if(req.method==='POST' && reportMatch[2]==='retry')throw new Failure(409,'Choose Generate PDF to create a new report from your current records');
    }
    for(const [base,table] of [['/strategies','strategies'],['/risk/rules','risk_rules']]) {
      if (route!==base && !route.startsWith(base+'/')) continue;
      if (req.method==='GET' && route===base) return respond({items:await rows(table)});
      const id=route===base?null:route.slice(base.length+1);
      if(id && !uuid(id))throw new Failure(422,'Invalid identifier');
      const payload:any={user_id:user.id};
      if(req.method!=='DELETE') {
        if(typeof body.name!=='string' || !body.name.trim() || body.name.length>160)throw new Failure(422,'Enter a valid name');
        payload.name=body.name.trim();
        if(table==='strategies') {if(body.description!==undefined && (typeof body.description!=='string' || body.description.length>2000))throw new Failure(422,'Invalid description');payload.description=body.description || '';}
        else {if(!['max_risk_percent','max_daily_loss','max_weekly_loss','max_trades_per_day'].includes(String(body.kind)) || !/^(?:\d+)(?:\.\d+)?$/.test(String(body.threshold)) || !(Number(body.threshold)>0) || Number(body.threshold)>=1e12)throw new Failure(422,'Enter a valid risk rule');payload.kind=body.kind;payload.threshold=body.threshold;}
      }
      if(req.method==='POST' && !id)return respond((await call('/rest/v1/'+table,'POST',payload))[0],201);
      if(id && ['PATCH','DELETE'].includes(req.method)) {
        const result=await call('/rest/v1/'+table+'?id=eq.'+id+'&user_id=eq.'+user.id,req.method,req.method==='DELETE'?undefined:payload);
        if(!result?.length)throw new Failure(404,'Record not found');return respond(req.method==='DELETE'?null:result[0],req.method==='DELETE'?204:200);
      }
    }
    if(route==='/market/preference' && ['GET','PUT'].includes(req.method)) {
      if(req.method==='PUT' && !['SCALPING','INTRADAY','SWING'].includes(String(body.trading_style)))throw new Failure(422,'Select a valid trading style');
      return respond(await rpc('journal_market_preference',{p_style:req.method==='PUT'?body.trading_style:null}) || {});
    }
    if(route==='/market/instruments' && req.method==='GET')return respond({items:[],status:'No authorized backend market feed is configured'});
    if(route==='/market/notification-preference' && req.method==='PUT'){if(typeof body.browser_notifications!=='boolean')throw new Failure(422,'Invalid notification preference');return respond(await rpc('journal_notification_preference',{p_enabled:body.browser_notifications}));}
    if(route==='/market/signals' && req.method==='GET')return respond({items:await rows('market_signals','&order=created_at.desc')});
    if(route==='/market/alerts' && req.method==='GET')return respond({items:await rows('signal_alerts','&order=created_at.desc')});
    if(route==='/market/notifications' && req.method==='GET')return respond({items:await rows('signal_notifications','&order=created_at.desc')});
    if(route==='/ai/engine' && req.method==='GET')return respond({available:false,status:'Self-hosted Python model not connected',fundamental_monitoring:'Unavailable',probabilities:'Not calibrated'});
    if((route==='/ai/chat/history' || route==='/ai/history') && req.method==='GET'){
      const chat=route==='/ai/chat/history',kind=chat?'journal':filters.kind || 'journal';
      if(!['journal','market','behaviour'].includes(kind))throw new Failure(422,'Invalid analysis type');
      const jobs=await rows('platform_jobs','&kind=eq.'+kind+'&deleted_at=is.null&order=created_at.desc'+(chat?'&payload->>purpose=eq.chat':'&payload->>purpose=is.null'));
      return respond({items:jobs.map((job:any)=>({...shape(job),...(chat?{message:job.payload.message,reply:job.status==='succeeded'?job.result?.reply:null}:{})}))});
    }
    const aiJob=route.match(/^\/ai\/jobs\/([^/]+)$/);
    if(aiJob && req.method==='GET'){if(!uuid(aiJob[1]))throw new Failure(422,'Invalid identifier');const jobs=await rows('platform_jobs','&id=eq.'+aiJob[1]+'&kind=in.(journal,market,behaviour)&deleted_at=is.null');if(!jobs.length)throw new Failure(404,'Analysis not found');return respond(shape(jobs[0]));}
    if(route==='/news' || route==='/news/filters') {
      const read=async(path:string)=>{const res=await fetch(SITE+'/Journaling_trade.github.io/'+path,{signal:AbortSignal.timeout(15000)});if(!res.ok)throw new Failure(503,'Publisher feed unavailable');return res.json();};
      const [feed,registry,regions]=await Promise.all([read('berita.json'),read('regional-sources.json'),read('news-regions.json')]);
      const countries=Object.keys(registry).filter(code=>/^[A-Z]{2}$/.test(code)),allowedSources=new Map<string,Set<string>>();
      for(const code of countries)for(const source of registry[code]){if(!allowedSources.has(source.id))allowedSources.set(source.id,new Set());allowedSources.get(source.id)!.add(code);}
      if(route==='/news/filters')return respond({countries,regions:Object.keys(regions),categories:[...new Set(feed.items.flatMap((r:any)=>[r.category,...r.topics || []]).filter(Boolean))].sort()});
      const limit=Number(filters.limit || 30),offset=Number(filters.offset || 0);
      if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000||(filters.region && !regions[filters.region])||(filters.country && !countries.includes(filters.country))||(filters.q || '').length>200)throw new Failure(422,'Invalid news filters');
      const seen=new Set(),items=feed.items.map((row:any)=>({...row,countries:row.countries?.length?row.countries:[...allowedSources.get(row.source) || []],source_label:feed.sources.find((s:any)=>s.id===row.source)?.name || row.source})).filter((row:any)=>{
        if(!String(row.url).startsWith('https://') || seen.has(row.url))return false;seen.add(row.url);
        return (!filters.country || row.countries.includes(filters.country)) && (!filters.region || row.countries.some((c:string)=>regions[filters.region].includes(c))) && (!filters.source_id || row.source===filters.source_id) && (!filters.category || row.category===filters.category || row.topics?.includes(filters.category)) && (!filters.q || (row.title+' '+(row.excerpt || '')).toLowerCase().includes(filters.q.toLowerCase())) && (!filters.start || row.publishedAt?.slice(0,10)>=filters.start) && (!filters.end || row.publishedAt?.slice(0,10)<=filters.end);
      });
      return respond({items:items.slice(offset,offset+limit),total:items.length,checked_at:feed.checkedAt,attribution:'Publisher excerpts and links to original sources'});
    }
    if(route.startsWith('/ai/') || route.startsWith('/market/'))throw new Failure(503,'The self-hosted Python AI and authorized market feed are not connected yet. No AI credit was used.');
    throw new Failure(404,'Endpoint not found');
  } catch(error) {return respond({detail:error instanceof Failure?error.message:'The service could not complete this request'},error instanceof Failure?error.status:503);}
}
if(import.meta.main)Deno.serve(handler);
