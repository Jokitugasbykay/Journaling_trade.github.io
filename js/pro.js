(function (global) {
  'use strict';
  const features = {
    analytics:'Advanced Analytics', heatmap:'Performance Heatmap', strategies:'Strategy Comparison',
    risk:'Risk Intelligence', reviews:'Weekly & Monthly Review', reports:'PDF Reports',
    'ai-behaviour':'AI Behaviour Analysis', 'ai-market':'AI Market Intelligence',
    'ai-journal':'AI Journal Analyst', 'ai-chat':'AI Chat', 'global-news':'Global News'
  };
  const timeframes = {'1m':'1','5m':'5','15m':'15','30m':'30','1h':'60','4h':'240','1d':'D'};
  let options={}, revision=0, controller=new AbortController(), access=null, current='', root=null, status=null, content=null, filters={}, preset={}, accounts=[], strategies=[];
  const latestReads=new Map();
  const text = (key,fallback) => options.labels?.(key,fallback) ?? global.JTI18n?.key('pro'+key,fallback) ?? fallback;
  function node(tag,value,className) {
    const element=document.createElement(tag);
    if(value!==undefined && value!==null) element.textContent=String(value);
    if(className) element.className=className;
    return element;
  }
  function clearAccess() { access=null; options.onAccessChange?.(null); }
  function apiBase(value) {
    if(!value) throw new Error(text('Unavailable','The Pro service is not configured. Your existing journal remains available.'));
    const url=new URL(value,document.baseURI);
    if(url.username || url.password || url.search || url.hash || !(url.protocol==='https:' || url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Invalid Pro API URL.');
    return url.href.replace(/\/$/,'').replace(/(?:\/api\/v1)?$/,'/api/v1');
  }
  async function abortable(promise,signal) {
    if(signal.aborted) throw signal.reason;
    let cancel;
    try { return await Promise.race([promise,new Promise((_,reject)=>{cancel=()=>reject(signal.reason);signal.addEventListener('abort',cancel,{once:true});})]); }
    finally { if(cancel) signal.removeEventListener('abort',cancel); }
  }
  async function request(path,settings={}) {
    if(!/^\/[a-z0-9/?=&_%.,:-]+$/i.test(path) || path.includes('..')) throw new Error('Invalid API path.');
    const owner=options.getUserId?.(), epoch=revision;
    const latestKey=settings.latest ? path.split('?')[0] : null, sequence=latestKey ? (latestReads.get(latestKey) || 0)+1 : 0;
    if(latestKey) latestReads.set(latestKey,sequence);
    const stale=()=>epoch!==revision || owner!==options.getUserId?.() || latestKey && latestReads.get(latestKey)!==sequence;
    if(!owner) throw new Error(text('SignIn','Sign in to use this feature.'));
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(options.requestTimeout || 30000)]);
    const base=apiBase(options.apiBase), token=await abortable(Promise.resolve(options.getToken?.()),signal);
    if(!token) throw new Error(text('SignIn','Sign in to use this feature.'));
    if(stale()) throw new DOMException('Selection changed','AbortError');
    if(settings.rawBody && (!(settings.body instanceof Blob) || settings.body.size>10*1024*1024 || !['application/pdf','image/png','image/jpeg','text/plain','text/csv'].includes(settings.contentType))) throw new Error('Invalid import upload.');
    const response=await fetch(base+path,{method:settings.method || 'GET',headers:{...settings.headers,'Content-Type':settings.rawBody?settings.contentType:'application/json',Authorization:'Bearer '+token},body:settings.body===undefined?undefined:settings.rawBody?settings.body:JSON.stringify(settings.body),signal,credentials:'omit',cache:'no-store'});
    if(stale()) throw new DOMException('Selection changed','AbortError');
    if(response.status===401 || response.status===403) { clearAccess(); content?.replaceChildren(); }
    if(response.status===204) return null;
    const data=await abortable(response.json().catch(()=>null),signal);
    if(!response.ok) throw new Error(typeof data?.detail==='string'?data.detail:typeof data?.error==='string'?data.error:text('RequestFailed','The request could not be completed. Try again.'));
    if(data===null || typeof data!=='object') throw new Error(text('InvalidResponse','The service returned an invalid response.'));
    if(stale()) throw new DOMException('Selection changed','AbortError');
    return data;
  }
  async function verifyAccess() {
    const result=options.apiBase ? await request('/entitlements') : await options.getEntitlements?.();
    if(!result) { clearAccess(); throw new Error(text('Unavailable','The Pro service is not configured.')); }
    if(!['free','plus','pro'].includes(result.plan)) { clearAccess(); throw new Error('Invalid entitlement response.'); }
    if(result.plan==='pro' && (!result.effective_until || !Number.isFinite(Date.parse(result.effective_until)) || Date.parse(result.effective_until)<=Date.now())) {
      clearAccess(); throw new Error(text('Expired','Your Pro access has expired.'));
    }
    access=result; options.onAccessChange?.(result); return result;
  }
  function showError(error) { if(error.name!=='AbortError' && status) { status.textContent=error.name==='TimeoutError' ? text('Timeout','The service did not respond in time. Retry the section.') : error.message; status.setAttribute('role','alert'); } }
  async function action(button,fn) {
    if(button.disabled) return;
    const epoch=revision; button.disabled=true;button.dataset.running='true'; status.textContent=text('Working','Working…'); status.setAttribute('role','status');
    try { await fn(); if(epoch===revision) status.textContent=''; }
    catch(error) { if(epoch===revision) showError(error); }
    finally { if(epoch===revision) {button.disabled=button.dataset.unavailable==='true';delete button.dataset.running;} }
  }
  function button(label,fn,id) {
    const element=node('button',label,'btn btn-ghost'); element.type='button'; if(id) element.id=id;
    element.dataset.componentId=id || current+'-'+String(label).toLowerCase().replace(/[^a-z0-9]+/g,'-');
    element.addEventListener('click',()=>action(element,fn)); return element;
  }
  function field(label,type,value='',id='') {
    const wrap=node('label',null,'field-group'), caption=node('span',label); wrap.append(caption);
    const input=node(type==='select'?'select':'input'); if(type!=='select') input.type=type;
    if(id) input.id=id; input.value=value; wrap.append(input); return {wrap,input};
  }
  function select(label,values,value,id) {
    const result=field(label,'select','',id);
    for(const [key,name] of values) { const item=node('option',name); item.value=key; result.input.append(item); }
    result.input.value=value; return result;
  }
  function panel(title,parent=content) { const section=node('section',null,'pro-panel'); section.append(node('h2',title)); parent.append(section); return section; }
  function table(parent,rows,columns,actions) {
    const wrap=node('div',null,'pro-scroll'), element=node('table'), head=node('thead'), tr=node('tr');
    for(const [,label] of columns) { const th=node('th',label); th.scope='col'; tr.append(th); }
    if(actions) tr.append(node('th',text('Actions','Actions')));
    head.append(tr); element.append(head); const body=node('tbody');
    for(const row of rows || []) {
      const line=node('tr'); for(const [key] of columns) line.append(node('td',format(row[key])));
      if(actions) { const cell=node('td'); actions(cell,row); line.append(cell); } body.append(line);
    }
    element.append(body); wrap.append(element); parent.append(wrap);
    if(!rows?.length) parent.append(node('p',text('Empty','No records for this selection.'),'pro-muted'));
  }
  function format(value) {
    if(value===null || value===undefined) return '—';
    if(typeof value==='object') return JSON.stringify(value);
    return String(value);
  }
  function details(parent,value) {
    if(!value || typeof value!=='object') { parent.append(node('p',format(value))); return; }
    const dl=node('dl');
    for(const [key,item] of Object.entries(value)) { dl.append(node('dt',key.replaceAll('_',' '))); dl.append(node('dd',format(item))); }
    parent.append(dl);
  }
  function journal(row,extra={}) { options.onJournalFilters?.({...filterValues(),...extra,...row}); }
  const groupColumns=[['label',text('Group','Group')],['trade_count',text('Trades','Trades')],['net_pnl',text('NetPnl','Net PnL')],['win_rate',text('WinRate','Win rate')]];
  function group(parent,rows,kind) { table(parent,rows,groupColumns,(cell,row)=>cell.append(button(text('ViewTrades','View trades'),()=>{
    let selection;
    if(kind==='instrument') selection={instrument:row.label};
    else if(kind==='strategy') selection={strategy_id:row.id || strategies.find(item=>item.name===row.label)?.id,strategy:row.label};
    else if(kind==='month' && /^\d{4}-\d{2}$/.test(row.label)) {const [year,month]=row.label.split('-').map(Number);selection={start:row.label+'-01',end:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)};}
    else selection={[kind]:row.label};
    journal({...selection,trade_ids:row.trade_ids});
  })) ); }
  function query(data) { const params=new URLSearchParams(); for(const [key,value] of Object.entries(data)) if(value!=='' && value!==undefined && value!==null) params.set(key,String(value)); return params.toString(); }
  function filterValues() { return Object.fromEntries(Object.entries(filters).map(([key,item])=>[key,item.value]).filter(([,value])=>value!=='')); }
  function commonFilters(parent,onChange,{dates=true,account=true}={}) {
    filters={}; const toolbar=node('form',null,'pro-toolbar'); parent.append(toolbar);
    if(account) { const entry=select(text('Account','Trading account'),[['',text('AllAccounts','All accounts')],...accounts.map(row=>[row.id,row.name])],preset.account_id || '','pro-account'); filters.account_id=entry.input; toolbar.append(entry.wrap); }
    if(dates) for(const key of ['start','end']) { const entry=field(key==='start'?text('Start','Start date'):text('End','End date'),'date',preset[key] || '','pro-'+key); filters[key]=entry.input; toolbar.append(entry.wrap); }
    const zone=field(text('Timezone','Timezone'),'text',preset.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC','pro-timezone'); filters.tz=zone.input; toolbar.append(zone.wrap);
    const apply=button(text('Apply','Apply filters'),async()=>{validateFilters(); await onChange();},'pro-apply-filters'); toolbar.append(apply);
    toolbar.addEventListener('submit',event=>{event.preventDefault(); apply.click();}); return toolbar;
  }
  function validateFilters() { const values=filterValues(); if(values.start && values.end && values.start>values.end) throw new Error(text('DateError','Start date must not be after end date.')); try {new Intl.DateTimeFormat('en',{timeZone:values.tz || 'UTC'});} catch {throw new Error(text('TimezoneError','Enter a valid IANA timezone.'));} }
  function chart(parent,title,series,key) {
    const section=panel(title,parent), data=(series || []).filter(item=>item[key]!==null && item[key]!=='' && Number.isFinite(Number(item[key])));
    if(!data.length) {section.append(node('p',text('Empty','No records for this selection.')));return;}
    const values=data.map(item=>Number(item[key])), low=Math.min(...values), high=Math.max(...values), span=high-low || 1;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 640 200'); svg.setAttribute('class','pro-chart'); svg.setAttribute('role','img'); svg.setAttribute('aria-label',title);
    const line=document.createElementNS(svg.namespaceURI,'polyline'); line.setAttribute('class','pro-chart-line'); line.setAttribute('points',values.map((value,index)=>`${20+index/(Math.max(1,values.length-1))*600},${175-(value-low)/span*145}`).join(' ')); svg.append(line);
    for(const [label,x,y] of [[format(high),20,18],[format(low),20,195]]) {const item=document.createElementNS(svg.namespaceURI,'text');item.setAttribute('class','pro-chart-label');item.setAttribute('x',x);item.setAttribute('y',y);item.textContent=label;svg.append(item);}
    section.append(svg); const disclosure=node('details'); disclosure.append(node('summary',text('ChartData','View chart data'))); table(disclosure,data,[['date',text('Date','Date')],[key,title]]); section.append(disclosure);
  }
  function warnings(parent,items) { for(const warning of items || []) parent.append(node('p',format(warning),'pro-muted')); }
  async function analytics() {
    const load=async()=>{
      const data=await request('/analytics/overview?'+query(filterValues()),{latest:true}); output.replaceChildren();
      const kpis=node('div',null,'pro-grid pro-kpis'); output.append(kpis);
      for(const [key,label] of [['expectancy','Expectancy'],['profit_factor','Profit Factor'],['maximum_drawdown','Maximum Drawdown'],['average_risk_reward','Average Risk Reward']]) {const card=panel(label,kpis);card.append(node('div',format(data.metrics?.[key]),'pro-value'));}
      const aggregation=select(text('Aggregation','Chart period'),[['trade','Per trade'],['day','Daily'],['week','Weekly'],['month','Monthly']],'trade','pro-chart-period'); output.append(aggregation.wrap);
      const charts=node('div',null,'pro-grid');output.append(charts);
      const draw=()=>{charts.replaceChildren(); const items=aggregateSeries(data.equity || [],aggregation.input.value);chart(charts,text('Equity','Equity curve'),items,'equity');chart(charts,text('Drawdown','Drawdown chart'),items,'drawdown');}; aggregation.input.addEventListener('change',draw);draw();
      const distribution=panel(text('Distribution','Win/loss distribution'),output);details(distribution,{...data.distribution,average_win:data.metrics?.average_win,average_loss:data.metrics?.average_loss,trade_count:data.metrics?.trade_count});
      const grouped=node('div',null,'pro-grid'); output.append(grouped);
      for(const key of ['instrument','strategy','weekday','hour','session']) group(panel(text('By'+key,'Performance by '+key),grouped),data.groups?.[key],key);
      warnings(output,data.warnings); output.append(node('p',text('Currency','Account currency')+': '+format(data.currency),'pro-muted'));
    };
    const toolbar=commonFilters(content,load); toolbar.append(button(text('ExportReport','Export report'),()=>open('reports',filterValues()),'pro-analytics-export'));
    const output=node('div');content.append(output); await load();
  }
  function aggregateSeries(rows,period) {
    if(period==='trade') return rows;
    const buckets=new Map();
    for(const row of rows) { const date=String(row.date || '').slice(0,10); if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      let key=date;
      if(period==='month') key=date.slice(0,7);
      if(period==='week') {const d=new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7); key=d.toISOString().slice(0,10);}
      buckets.set(key,{...row,date:key});
    }
    return [...buckets.values()];
  }
  async function heatmap() {
    let year=new Date().getFullYear(), metric='pnl';
    const load=async()=>{
      year=Number(yearInput.input.value); if(!Number.isInteger(year)||year<1900||year>2200) throw new Error('Select a valid year.');
      const data=await request('/analytics/heatmap?'+query({...filterValues(),year}),{latest:true}); output.replaceChildren();
      output.append(node('p',text('HeatmapLegend','Solid border: positive. Dashed border: negative. Dark: zero. Faded: no activity.'),'pro-muted'));
      const months=new Map(); for(const row of data.days || []) {const key=String(row.date).slice(0,7); if(!months.has(key))months.set(key,[]);months.get(key).push(row);}
      const grid=node('div',null,'pro-grid');output.append(grid);
      for(const [month,days] of months) {const section=panel(month,grid), cells=node('div',null,'pro-heatmap');section.append(cells);
        for(const day of days) {const cell=button(String(day.date).slice(8)+' · '+format(day[metric]),async()=>{detail.replaceChildren();details(detail,day);detail.append(button(text('ViewTrades','View trades'),()=>journal({start:day.date,end:day.date,trade_ids:day.trade_ids})));});cell.className='pro-day';cell.dataset.sign=day.state==='no_activity'?'none':day.state;cell.setAttribute('aria-label',`${day.date}: ${format(day[metric])}; ${day.state}`);cells.append(cell);}
      }
      const detail=panel(text('DateDetails','Date details'),output); detail.append(node('p',text('SelectDate','Select a calendar cell to view its trades.')));
      for(const [key,title] of [['months','Monthly performance'],['hours','Hourly performance'],['sessions','Session performance']]) group(panel(title,output),data[key],key==='hours'?'hour':key==='sessions'?'session':'month');
    };
    const toolbar=commonFilters(content,load,{dates:false}); const yearInput=field(text('Year','Year'),'number',year,'pro-year');toolbar.append(yearInput.wrap);
    const selection=select(text('Metric','Metric'),[['pnl','PnL'],['trade_count','Trade count']],metric,'pro-heatmap-metric');toolbar.append(selection.wrap);selection.input.addEventListener('change',()=>{metric=selection.input.value; action(selection.input,load);});
    toolbar.append(button(text('PreviousYear','Previous year'),async()=>{yearInput.input.value=--year;await load();}),button(text('NextYear','Next year'),async()=>{yearInput.input.value=++year;await load();}));
    const output=node('div');content.append(output);await load();
  }
  function strategyForm(parent,row,onSave) {
    parent.replaceChildren(); const name=field(text('Name','Strategy name'),'text',row?.name || '','pro-strategy-name'),description=field(text('Description','Description'),'text',row?.description || '','pro-strategy-description');name.input.maxLength=200;description.input.maxLength=2000;parent.append(name.wrap,description.wrap);
    parent.append(button(text('Save','Save strategy'),async()=>{if(!name.input.value.trim())throw new Error('Enter a strategy name.'); await request('/strategies'+(row?'/'+row.id:''),{method:row?'PATCH':'POST',body:{name:name.input.value.trim(),description:description.input.value}});parent.replaceChildren();await onSave();},'pro-strategy-save'),button(text('Cancel','Cancel'),()=>parent.replaceChildren())); name.input.focus();
  }
  async function strategyComparison() {
    const load=async()=>{
      strategies=(await request('/strategies')).items || []; selector.replaceChildren();
      for(const row of strategies) {const label=node('label',null,'pro-check'),input=node('input');input.type='checkbox';input.value=row.id; label.append(input,node('span',row.name));selector.append(label);}
      list.replaceChildren();table(list,strategies,[['name',text('Name','Name')],['description',text('Description','Description')]],(cell,row)=>cell.append(button(text('Edit','Edit'),()=>strategyForm(editor,row,load)),button(text('Delete','Delete'),async()=>{if(!global.confirm(text('DeleteStrategy','Delete this strategy? Existing trades are retained.')))return;await request('/strategies/'+row.id,{method:'DELETE'});await load();}),button(text('ViewTrades','View trades'),()=>journal({strategy_id:row.id}))));
    };
    commonFilters(content,()=>compare());
    const selector=panel(text('SelectStrategies','Select strategies to compare')),editor=panel(text('StrategyEditor','Strategy editor')),output=node('div'),list=panel(text('Strategies','Strategies'));
    const compare=async()=>{
      const ids=[...selector.querySelectorAll('input:checked')].map(item=>item.value);if(ids.length<2 || ids.length>6)throw new Error(text('SelectTwo','Select between two and six strategies.'));
      const data=await request('/analytics/strategies?'+query({...filterValues(),strategy_ids:ids.join(',')}),{latest:true});output.replaceChildren();
      for(const row of data.strategies || []) {const card=panel(row.name,output);details(card,row.metrics);if(row.sample_warning)warnings(card,[row.sample_warning]);chart(card,text('Equity','Equity curve'),row.equity,'equity');card.append(button(text('ViewTrades','View trades'),()=>journal({strategy_id:row.id})));}
    };
    const bar=node('div',null,'pro-toolbar');bar.append(button(text('Compare','Compare strategies'),compare,'pro-strategy-compare'),button(text('AddStrategy','Add strategy'),()=>strategyForm(editor,null,load)),button(text('Reset','Reset'),()=>{selector.querySelectorAll('input').forEach(item=>item.checked=false);output.replaceChildren();}));content.append(bar,output);await load();
  }
  async function risk() {
    const output=node('div');
    const load=async()=>{const data=await request('/analytics/risk?'+query(filterValues()),{latest:true});output.replaceChildren();details(panel(text('RiskOverview','Risk overview'),output),data.overview);table(panel(text('Rules','Risk rules'),output),data.rules,[['name','Name'],['kind','Rule'],['threshold','Threshold']],(cell,row)=>cell.append(button(text('Edit','Edit'),()=>editRule(row)),button(text('Delete','Delete'),async()=>{if(!global.confirm('Delete this risk rule?'))return;await request('/risk/rules/'+row.id,{method:'DELETE'});await load();})));table(panel(text('Violations','Risk violation history'),output),data.violations,[['date','Date'],['observed','Observed'],['threshold','Threshold']],(cell,row)=>cell.append(button(text('ViewTrade','View trade'),()=>journal({trade_id:row.trade_id}))));table(panel(text('Compliance','Compliance trends'),output),data.compliance,[['date','Date'],['checked','Checked'],['violations','Violations']]);warnings(output,data.warnings);};
    commonFilters(content,load);const tools=node('div',null,'pro-grid');content.append(tools);
    const calculator=panel(text('PositionSize','Position size calculator'),tools), entries={};
    const instrument=field(text('Instrument','Instrument'),'text','','pro-risk-instrument');calculator.append(instrument.wrap);
    for(const [key,label,value] of [['balance','Account balance',''],['risk_percent','Risk percentage','1'],['entry','Entry price',''],['stop','Stop loss',''],['contract_size','Contract size',''],['quantity_step','Minimum quantity step',''],['quote_to_account_rate','Quote-to-account currency rate','']]) {const item=field(label,'number',value,'pro-risk-'+key);item.input.step='any';entries[key]=item.input;calculator.append(item.wrap);}
    calculator.append(node('p',text('ContractHint','Enter your broker’s contract specifications and currency conversion rate. No symbol defaults are assumed.'),'pro-muted'));const calculation=node('div');
    calculator.append(button(text('Calculate','Calculate'),async()=>{const body=Object.fromEntries(Object.entries(entries).map(([key,item])=>[key,item.value]));if(Object.values(body).some(value=>value===''||!Number.isFinite(Number(value))))throw new Error('Complete every numeric input.');if(instrument.input.value.trim())body.instrument=instrument.input.value.trim();const result=await request('/risk/calculate',{method:'POST',body});calculation.replaceChildren();details(calculation,result);},'pro-risk-calculate'),button(text('Reset','Reset'),()=>{Object.values(entries).forEach(item=>item.value='');instrument.input.value='';calculation.replaceChildren();}),calculation);
    const editor=panel(text('RiskRule','Risk rule'),tools);
    function editRule(row) {editor.replaceChildren();editor.append(node('h2',text('RiskRule','Risk rule')));const name=field('Rule name','text',row?.name||''),kind=select('Rule type',[['max_risk_percent','Risk per trade (%)'],['max_daily_loss','Daily loss'],['max_weekly_loss','Weekly loss'],['max_trades_per_day','Daily trade count']],row?.kind||'max_risk_percent'),threshold=field('Threshold','number',row?.threshold||'');threshold.input.step='any';editor.append(name.wrap,kind.wrap,threshold.wrap,button('Save rule',async()=>{if(!name.input.value.trim()||!(Number(threshold.input.value)>0))throw new Error('Enter a name and positive threshold.');await request('/risk/rules'+(row?'/'+row.id:''),{method:row?'PATCH':'POST',body:{name:name.input.value,kind:kind.input.value,threshold:threshold.input.value}});await load();},'pro-risk-rule-save'));}
    editor.append(button(text('AddRule','Add rule'),()=>editRule(null)));content.append(output);await load();
  }
  async function reviews() {
    let period='weekly';const output=node('div');
    const load=async()=>{const data=await request('/reviews?'+query({...filterValues(),period}),{latest:true});output.replaceChildren();if(data.preview)details(panel(text('ReviewPreview','Current period preview'),output),data.preview);table(panel(text('ReviewHistory','Review history'),output),data.items,[['created_at','Created'],['period','Period'],['period_start','Start']],(cell,row)=>cell.append(button('Open review',()=>{const section=panel('Review',output);details(section,row.summary || row.result || row);evidence(section,(row.summary || row.result)?.evidence_ids);}),button('View evidence',()=>journal({trade_ids:row.summary?.evidence_ids,start:row.period_start || row.start,end:row.end})),button('Export PDF',()=>open('reports'))));};
    const bar=commonFilters(content,load); filters.start.value=preset.start || new Date().toISOString().slice(0,10);const toggle=select(text('Period','Period'),[['weekly','Weekly'],['monthly','Monthly']],period,'pro-review-period');bar.append(toggle.wrap);toggle.input.addEventListener('change',()=>{period=toggle.input.value;action(toggle.input,load);});
    const shift=async(direction)=>{const date=new Date(filters.start.value+'T12:00:00Z');if(!Number.isFinite(date.getTime()))throw new Error('Select a start date.');if(period==='weekly')date.setUTCDate(date.getUTCDate()+direction*7);else {date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+direction);}filters.start.value=date.toISOString().slice(0,10);await load();};
    bar.append(button('Previous period',()=>shift(-1)),button('Next period',()=>shift(1)),button('Generate review',async()=>{validateFilters();const job=await request('/reviews',{method:'POST',body:{...filterValues(),period},headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('reviews',job,output);await load();},'pro-review-generate'),button('Generate AI commentary',()=>open('ai-journal',{...filterValues(),analysis_type:'review'}),'pro-review-ai'),button('Export PDF',()=>open('reports',filterValues())));content.append(output);await load();
  }
  async function reports() {
    const grid=node('div',null,'pro-grid');content.append(grid);const config=panel(text('ReportConfiguration','Report configuration'),grid),preview=panel(text('Preview','Report preview'),grid),history=panel(text('ReportHistory','Report history'));
    commonFilters(config,()=>previewReport()); const choices={};
    for(const [key,label] of [['analytics','Include analytics'],['heatmap','Include heatmap'],['risk','Include risk'],['reviews','Include reviews']]) {const line=node('label',null,'pro-check'),input=node('input');input.type='checkbox';input.checked=true;choices[key]=input;line.append(input,node('span',label));config.append(line);}
    const strategy=select(text('Strategy','Strategy'),[['','All strategies'],...strategies.map(row=>[row.id,row.name])],'','pro-report-strategy');config.append(strategy.wrap);
    const configuration=()=>{validateFilters();return {...filterValues(),strategy_id:strategy.input.value || undefined,sections:Object.entries(choices).filter(([,item])=>item.checked).map(([key])=>key)};};
    const previewReport=async()=>{const data=await request('/reports/preview',{method:'POST',body:configuration()});preview.replaceChildren();preview.append(node('h2','Report preview'));details(preview,data);};
    const load=async()=>{const data=await request('/reports');history.replaceChildren();history.append(node('h2','Report history'));table(history,data.items,[['created_at','Created'],['state','Status']],(cell,row)=>{
      cell.append(button('View status',async()=>{const job=await request('/reports/'+row.id);preview.replaceChildren();details(preview,job);}));
      if(row.state==='succeeded')cell.append(button('Download',async()=>{const data=await request('/reports/'+row.id+'/download');const url=safeLink(data.url || data.download_url);if(!url)throw new Error('Invalid download URL.');const link=node('a','Download PDF');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.className='btn btn-ghost';preview.append(link);link.focus();}));
      if(['failed','expired'].includes(row.state))cell.append(button('Retry',async()=>{const job=await request('/reports/'+row.id+'/retry',{method:'POST',body:{},headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('reports',job,preview);await load();}));
      cell.append(button('Delete',async()=>{if(!global.confirm('Delete this report?'))return;await request('/reports/'+row.id,{method:'DELETE'});await load();}));
    });};
    config.append(button('Preview',previewReport,'pro-report-preview'),button('Generate PDF',async()=>{const body=configuration();if(!body.sections.length)throw new Error('Select at least one report section.');const job=await request('/reports',{method:'POST',body,headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('reports',job,preview);await load();},'pro-report-generate'));await load();
  }
  function safeLink(value) { try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;} catch {return null;} }
  function evidence(parent,ids) {if(!Array.isArray(ids))return;const bar=node('div',null,'pro-evidence');for(const id of ids.slice(0,100))if(/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(String(id)))bar.append(button('View trade '+String(id).slice(0,8),()=>journal({trade_id:id})));else bar.append(node('span','Evidence: '+id));parent.append(bar);}
  function sourceReferences(parent,context) {
    if(!context)return;const section=node('section'),seen=new Set();section.append(node('h3','Source references'));
    const items=Array.isArray(context)?context:[...(context.macro || []),...(context.news || []),...(context.geopolitics || []),...(context.kaystrade?.technicals || []),...(context.intelligence?.fundamental?.events || []),...(context.intelligence?.fundamental?.context_events || [])];
    for(const item of items) {const moment=item?.timestamp || item?.published_at,url=safeLink(item?.source_url || item?.url),key=url+'|'+moment;if(!url || seen.has(key))continue;seen.add(key);const link=node('a',item.title || item.name || item.timeframe || 'View source');link.href=url;link.target='_blank';link.rel='noopener noreferrer';section.append(link,node('span',' · '+format(moment),'pro-muted'),node('br'));}
    if(seen.size)parent.append(section);
  }

  function aiResult(parent,result) {
    parent.replaceChildren();if(!result){parent.append(node('p','No validated result is available.'));return;}
    sourceReferences(parent,result.quantitative?.market);
    for(const [key,value] of Object.entries(result)) {
      const section=node('section');section.append(node('h3',key.replaceAll('_',' ')));parent.append(section);
      if(Array.isArray(value)) for(const item of value) {if(item && typeof item==='object') {section.append(node('p',item.text || item.summary || format(item)));evidence(section,item.evidence_ids);if(item.url){const url=safeLink(item.url);if(url){const link=node('a',item.title||'View source');link.href=url;link.target='_blank';link.rel='noopener noreferrer';section.append(link);}}} else section.append(node('p',format(item)));}
      else if(typeof value==='object')details(section,value);else section.append(node('p',format(value)));
    }
  }
  async function watchJob(kind,first,parent,render=aiResult) {
    let job=first, epoch=revision;const owner=options.getUserId?.();
    for(let attempt=0;attempt<90 && epoch===revision && owner===options.getUserId?.();attempt++) {
      parent.replaceChildren();details(parent,{id:job.id,state:job.state,error:job.error});
      if(job.state==='succeeded'){if(kind==='ai'||kind==='chat')render(parent,job.result,job.id);return job;}
      if(['failed','cancelled','expired'].includes(job.state))return job;
      if(kind==='ai'||kind==='chat')parent.append(button(kind==='chat'?'Cancel response':'Cancel analysis',async()=>{await request('/ai/jobs/'+job.id+'/cancel',{method:'POST',body:{}});},'pro-ai-cancel'));
      await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,2000);const cancel=()=>{clearTimeout(timer);reject(new DOMException('Account changed','AbortError'));};controller.signal.addEventListener('abort',cancel,{once:true});setTimeout(()=>controller.signal.removeEventListener('abort',cancel),2100);});
      job=await request('/'+(kind==='ai'?'ai/jobs':kind==='reviews'?'jobs':'reports')+'/'+job.id);
    }
    if(epoch===revision)parent.append(node('p','The job is still processing. Check its status in history.','pro-muted'));
    return job;
  }
  async function ai(kind) {
    const toolbar=commonFilters(content,()=>loadHistory());const quota=node('p',null,'pro-muted');content.append(quota);
    const showQuota=()=>{quota.textContent=text('Quota','Remaining AI analyses')+': '+format(access?.ai?.remaining)+' / '+format(access?.ai?.limit || 30);};showQuota();
    const config={},grid=node('div',null,'pro-grid');content.append(grid);let result;
    result=panel('Analysis result',grid);if(kind==='journal'){const analysisType=select('Analysis type',[['performance','Performance'],['strategy','Strategy'],['risk','Risk'],['consistency','Consistency'],['review','Review commentary']],preset.analysis_type || 'performance','pro-analysis-type');toolbar.append(analysisType.wrap);config.analysis_type=analysisType.input;}
    const history=panel('Analysis history');
    const loadHistory=async()=>{const data=await request('/ai/history?'+query({kind,...filterValues()}),{latest:true});history.replaceChildren();history.append(node('h2','Analysis history'));table(history,data.items,[['created_at','Created'],['state','Status'],['kind','Analysis']],(cell,row)=>{cell.append(button('Open analysis',async()=>{const job=await request('/ai/jobs/'+row.id);if(job.state==='succeeded')aiResult(result,job.result);else details(result,job);}));if(['failed','cancelled','expired'].includes(row.state))cell.append(button('Retry',async()=>{if(!global.confirm('Start a new AI analysis? A successful result uses one shared monthly allowance.'))return;await verifyAccess();showQuota();const job=await request('/ai/jobs/'+row.id+'/retry',{method:'POST',body:{},headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('ai',job,result);await verifyAccess();showQuota();await loadHistory();}));});};
    toolbar.append(button(kind==='market'?'Analyze market':kind==='behaviour'?'Analyze behaviour':'Generate analysis',async()=>{
      validateFilters();await verifyAccess();showQuota();if(!(Number(access.ai?.remaining)>0))throw new Error('No AI allowance remains for this subscription month.');
      if(!global.confirm('A successful AI analysis uses one of your 30 shared monthly allowances. Failed or cancelled analyses do not count. Continue?'))return;
      const values={...filterValues(),...Object.fromEntries(Object.entries(config).map(([key,input])=>[key,input.value]))};
      if(kind==='market')await request('/market/context?'+query({instrument:values.instrument,timeframe:values.timeframe}));
      const job=await request('/ai/'+kind+'-analysis',{method:'POST',body:values,headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('ai',job,result);await verifyAccess();showQuota();await loadHistory();
    },'pro-ai-generate'));await loadHistory();
  }
  async function aiChat() {
    const quota=node('p',null,'pro-muted');
    const thread=panel('Conversation'),messages=node('div',null,'pro-chat-messages');messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');messages.setAttribute('aria-label','AI chat conversation');thread.append(messages);
    const composer=node('div',null,'pro-chat-composer'),input=node('textarea');input.id='pro-ai-chat-message';input.name='message';input.maxLength=4000;input.rows=3;input.required=true;input.setAttribute('aria-label','Message the AI assistant');input.placeholder='Ask about your journal, trading process, or a market concept…';
    const note=node('p','AI chat uses one shared monthly allowance per successful reply. It does not have live prices or news and does not provide trade signals.','pro-muted');
    content.append(quota,thread,composer,note);
    const showQuota=()=>{quota.textContent='AI analyses remaining this month: '+format(access?.ai?.remaining)+' / '+format(access?.ai?.limit || 30);};
    const bubble=(role,value,time)=>{const item=node('article',null,'pro-chat-message');item.dataset.role=role;item.append(node('h3',role==='user'?'You':'AI assistant'),node('p',value));if(time)item.append(node('time',format(time),'pro-muted'));return item;};
    const load=async()=>{const data=await request('/ai/chat/history',{latest:true});messages.replaceChildren();for(const item of [...(data.items || [])].reverse()){messages.append(bubble('user',item.message,item.created_at));if(item.reply)messages.append(bubble('assistant',item.reply,item.created_at));else if(item.state==='failed'||item.state==='cancelled')messages.append(bubble('assistant','This reply was not completed. No AI allowance was charged.',item.created_at));else messages.append(bubble('assistant','Response is processing…',item.created_at));}if(!messages.childElementCount)messages.append(node('p','Ask a question to start your private Pro chat.','pro-muted'));};
    const answer=(parent,result)=>{parent.replaceChildren(bubble('assistant',result.reply,result.generated_at));};
    const send=button('Send message',async()=>{const message=input.value.trim();if(!message)throw new Error('Enter a message first.');await verifyAccess();showQuota();if(!(Number(access.ai?.remaining)>0))throw new Error('No AI allowance remains this month.');if(!global.confirm('A successful AI reply uses one shared monthly AI allowance. Continue?'))return;const job=await request('/ai/chat',{method:'POST',body:{message},headers:{'Idempotency-Key':crypto.randomUUID()}});input.value='';messages.replaceChildren(bubble('user',message));await watchJob('chat',job,messages,answer);await load();await verifyAccess();showQuota();},'pro-ai-chat-send');
    input.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();send.click();}});composer.append(input,send);
    await Promise.all([load(),Promise.resolve(showQuota())]);
  }
  function disclosure(parent,title,value) {
    const section=node('details',null,'pro-disclosure');section.append(node('summary',title));parent.append(section);
    if(value===undefined || value===null || Array.isArray(value) && !value.length) section.append(node('p','No verified evidence supplied.','pro-muted'));
    else if(Array.isArray(value)) {for(const item of value) {if(item && typeof item==='object' && (item.text || item.title || item.summary)){section.append(node('p',item.text || item.title || item.summary));evidence(section,item.evidence_ids);if(item.timestamp)section.append(node('p',item.timestamp,'pro-muted'));}else if(item && typeof item==='object')details(section,item);else section.append(node('p',format(item)));}sourceReferences(section,value);}
    else {details(section,value);sourceReferences(section,value);}
    return section;
  }
  function marketResult(parent,result) {
    parent.replaceChildren();const context=result?.quantitative?.market,signal=result?.signal;
    if(!context || !signal || !['BUY','SELL','NEUTRAL','NO TRADE'].includes(signal.direction)) throw new Error('The saved analysis has no validated Kaystrade signal. Generate a new analysis.');
    parent.append(node('h2','AI entry signal'),node('p',context.instrument+' · '+context.timeframe+' · '+signal.timestamp,'pro-muted'));
    if(context.intelligence) {
      const assessment=context.intelligence;
      parent.append(node('p','Trading style: '+assessment.trading_style,'pro-muted'));
      disclosure(parent,'Fundamental vs technical comparison',assessment.comparison);
      const scenarios=node('div',null,'pro-grid');parent.append(scenarios);
      for(const scenario of assessment.scenarios) {const card=node('section',null,'pro-panel');card.append(node('h3',scenario.direction==='BUY'?'Bullish scenario':'Bearish scenario'),node('p',(scenario.direction==='BUY'?'Bullish Probability: ':'Bearish Probability: ')+scenario.probability_status));disclosure(card,'Conditions, levels and evidence',scenario);scenarios.append(card);}
      for(const [label,events] of [['Fundamental news timeline',assessment.fundamental.events],['Expectations, interpretations and unverified context',assessment.fundamental.context_events]]){
        const timeline=disclosure(parent,label,null);
        if(events?.length){timeline.lastChild.remove();for(const event of events){timeline.append(node('h3',event.title),node('p',[event.verification,event.category,event.region,event.relevance+' relevance',event.severity+' severity'].join(' · '),'pro-muted'),node('p','Published: '+event.published_at+' · Event: '+event.event_at+' · Valid until: '+event.valid_until,'pro-muted'),node('p','Source-stated mechanism: '+event.mechanism));disclosure(timeline,'Supporting evidence',event.evidence);}sourceReferences(timeline,events);}
      }
      parent.append(node('p',assessment.fundamental.warning,'pro-muted'));
      for(const warning of assessment.warnings)parent.append(node('p',warning,'pro-muted'));
    }
    const cells=node('div',null,'pro-signal-cells');parent.append(cells);
    for(const [label,value] of [['Market direction',signal.direction],['Entry signal status',signal.status],['Proposed entry',signal.entry],['Stop loss',signal.stop_loss],['Take profit',signal.take_profit],['Risk reward ratio',signal.risk_reward],['Analysis horizon',signal.analysis_horizon]]) {const cell=node('div');cell.append(node('span',label,'pro-muted'),node('p',format(value)));cells.append(cell);}
    disclosure(parent,'Technical confirmations',signal.confirmations);disclosure(parent,'Invalidation conditions',signal.invalidation_conditions);
    parent.append(node('p','Conditional analysis only. No trade is placed automatically.','pro-muted'));
    const reasoning=node('section',null,'pro-panel');parent.append(reasoning);reasoning.append(node('h2','AI reasoning and intelligence'));details(reasoning,{engine:'Local explanation completed',model_name:result.model_version?.name,model_version:result.model_version?.digest,methodology:context.kaystrade?.methodology,analysis_timestamp:result.generated_at,market_data_timestamp:context.as_of,provider:context.provider,delayed:context.delayed});
    for(const [title,value] of [['Technical analysis and observations',result.observations],['Interpretations',result.interpretations],['Market structure, trend, momentum and volatility',context.kaystrade?.frames],['Support, resistance and Technicals',context.kaystrade?.technicals],['Macroeconomic context',context.macro],['Federal Reserve and FOMC context',(context.macro || []).filter(item=>/fed|fomc|federal reserve/i.test(JSON.stringify(item)))],['Geopolitical context',context.geopolitics],['Relevant financial news',context.news],['Cross-market correlations',context.correlations],['Bullish, bearish and no-trade scenarios',context.kaystrade?.scenarios],['Alternative scenarios',result.alternative_scenarios],['Data quality warnings',context.kaystrade?.warnings]]) disclosure(reasoning,title,value);
    const sources=disclosure(reasoning,'Supporting sources',{provider:context.provider,license_reference:context.license_reference,as_of:context.as_of});sourceReferences(sources,context);
  }
  async function marketIntelligence() {
    filters={};let mapped=[],selectedFrame='15m',context=null,stored=null,chartTimer,contextSequence=0;
    const marketController=controller;
    const preference=await request('/market/preference');
    let savedStyle=preference.trading_style || '';
    let browserNotifications=!!preference.browser_notifications;
    const notified=new Set(),shownNotifications=[];let notificationsLoaded=false;
    selectedFrame=savedStyle==='SWING'?'4h':'15m';
    const style=select('Trading style',[['','Select trading style'],['SCALPING','SCALPING'],['INTRADAY','INTRADAY'],['SWING','SWING']],savedStyle,'pro-market-style');content.append(style.wrap);
    const toolbar=node('div',null,'pro-toolbar'),instrument=select('Instrument',[],'','pro-market-instrument');content.append(toolbar);toolbar.append(instrument.wrap);
    const identity=node('p',null,'pro-muted'),freshness=node('p','Market data not loaded.','pro-muted'),quota=node('p',null,'pro-muted');content.append(identity,freshness,quota);
    const showQuota=()=>quota.textContent='AI analyses remaining this month: '+format(access?.ai?.remaining)+' / '+format(access?.ai?.limit || 30);showQuota();
    const framebar=node('div',null,'pro-timeframes');framebar.setAttribute('role','group');framebar.setAttribute('aria-label','Analysis timeframe');content.append(framebar);
    const frameSelect=select('Timeframe',Object.keys(timeframes).map(key=>[key,key]),selectedFrame,'pro-market-timeframe');frameSelect.wrap.classList.add('pro-timeframe-select');content.append(frameSelect.wrap);
    const chartPanel=panel('Market chart'),iframe=node('iframe'),chartStatus=node('p','Select an authorized instrument to load the chart.','pro-muted');iframe.title='TradingView market chart';iframe.referrerPolicy='no-referrer';chartPanel.append(iframe,chartStatus);
    const engine=panel('AI engine status'),result=panel('AI entry signal'),evidencePanel=panel('Technical evidence'),history=panel('Analysis history');
    result.append(node('p','No analysis yet. Entry, stop loss and target remain unavailable until validated rules support them.'));
    const selected=()=>({instrument:instrument.input.value,timeframe:selectedFrame,...(savedStyle?{trading_style:savedStyle}:{})});
    const selectionNote=node('p',null,'pro-muted');result.prepend(selectionNote);
    const notePrevious=()=>{selectionNote.textContent=stored && (stored.quantitative?.market?.instrument!==instrument.input.value || stored.quantitative?.market?.timeframe!==selectedFrame || stored.quantitative?.market?.intelligence?.trading_style!==savedStyle) ? 'Displayed analysis belongs to '+stored.quantitative.market.instrument+' / '+stored.quantitative.market.timeframe+' / '+(stored.quantitative.market.intelligence?.trading_style || 'Legacy style unavailable')+'. Analyze the current selection for a new signal.' : '';};
    const draw=()=>{const row=mapped.find(row=>row.symbol===instrument.input.value);if(!row)return;clearTimeout(chartTimer);iframe.src='https://s.tradingview.com/widgetembed/?'+query({symbol:row.tradingview_symbol,interval:timeframes[selectedFrame],theme:'dark',style:1,locale:'en',hidesidetoolbar:0,allow_symbol_change:0,saveimage:0});chartStatus.textContent='Loading chart…';chartTimer=setTimeout(()=>{if(iframe.isConnected)chartStatus.textContent='The chart did not confirm loading. Check the chart provider and retry this section.';},15000);controller.signal.addEventListener('abort',()=>clearTimeout(chartTimer),{once:true});identity.textContent=row.name+' · '+row.asset_class;};
    iframe.addEventListener('load',()=>{clearTimeout(chartTimer);chartStatus.textContent='Embedded TradingView chart loaded. Chart and analysis feeds are separate; verify symbol and data availability in the chart.';});iframe.addEventListener('error',()=>{clearTimeout(chartTimer);chartStatus.textContent='Chart unavailable. Retry the section.';});
    const contextLoad=async(refresh=false)=>{const sequence=++contextSequence;context=null;generate.dataset.unavailable='true';generate.disabled=true;freshness.textContent='Loading authorized market data…';const selection=selected();try {const data=await request('/market/'+(refresh?'refresh':'context?'+query(selection)),refresh?{method:'POST',body:selection,latest:true}:{latest:true});if(sequence!==contextSequence || selection.instrument!==instrument.input.value || selection.timeframe!==selectedFrame)return;context=data;freshness.textContent=[data.data_freshness,data.delayed?'Delayed '+data.delay_seconds+' seconds':'',data.current_price!==undefined?'Last recorded price: '+data.current_price:'',data.as_of,data.provider].filter(Boolean).join(' · ');evidencePanel.replaceChildren();evidencePanel.append(node('h2','Technical evidence'));disclosure(evidencePanel,'Closed-bar Kaystrade calculations',data.kaystrade);sourceReferences(evidencePanel,data);generate.dataset.unavailable='false';if(!generate.dataset.running)generate.disabled=false;}catch(error){if(sequence!==contextSequence || selection.instrument!==instrument.input.value || selection.timeframe!==selectedFrame)return;if(error.name!=='AbortError'){freshness.textContent='Market data unavailable: '+error.message;generate.disabled=true;}throw error;}};
    const choose=async(frame)=>{if(!mapped.find(row=>row.symbol===instrument.input.value)?.timeframes.includes(frame))throw new Error('This instrument does not support that timeframe.');selectedFrame=frame;frameSelect.input.value=frame;for(const button of framebar.children)button.setAttribute('aria-pressed',String(button.dataset.frame===frame));notePrevious();draw();await contextLoad();};
    for(const [frame,label] of Object.entries({'1m':'M1','5m':'M5','15m':'M15','30m':'M30','1h':'H1','4h':'H4','1d':'D1'})) {const item=button(label,()=>choose(frame),'pro-timeframe-'+frame);item.dataset.frame=frame;item.setAttribute('aria-pressed',String(frame===selectedFrame));framebar.append(item);}
    frameSelect.input.addEventListener('change',()=>action(frameSelect.input,()=>choose(frameSelect.input.value)));
    instrument.input.addEventListener('change',()=>action(instrument.input,async()=>{const row=mapped.find(item=>item.symbol===instrument.input.value);for(const item of framebar.children){item.dataset.unavailable=String(!row.timeframes.includes(item.dataset.frame));item.disabled=item.dataset.unavailable==='true' || !!item.dataset.running;}for(const item of frameSelect.input.options)item.disabled=!row.timeframes.includes(item.value);await choose(row.timeframes.includes(selectedFrame)?selectedFrame:row.timeframes[0]);}));
    const signalsPanel=panel('Accepted signals and performance'),alertsPanel=panel('Active price alerts'),notificationsPanel=panel('Notifications');
    const loadSignals=async()=>{
      const [signals,performance]=await Promise.all([request('/market/signals',{latest:true}),request('/market/performance',{latest:true})]);
      signalsPanel.replaceChildren(node('h2','Accepted signals and performance'));disclosure(signalsPanel,'Actual and paper performance',performance);
      table(signalsPanel,signals.items,[['instrument','Instrument'],['trading_style','Style'],['action','Action'],['mode','Tracking'],['status','Setup'],['outcome','Paper outcome']],(cell,row)=>{
        if(row.action==='take' && row.status==='active' && !row.execution_confirmed)cell.append(button('Confirm execution',async()=>{
          if(cell.querySelector('input[type=number]'))return;
          const form=node('div',null,'pro-toolbar'),price=field('Execution price','number','','pro-execution-price-'+row.id),time=field('Execution time (local)','datetime-local','','pro-execution-time-'+row.id);
          form.append(price.wrap,time.wrap,button('Save execution confirmation',async()=>{
            if(!price.input.value || !time.input.value)throw new Error('Enter your execution price and time.');
            if(!global.confirm(row.mode==='paper'?'Confirm this paper-tracked fill?':'Confirm that you manually executed this trade? This does not verify a broker fill.'))return;
            await request('/market/signals/'+row.id+'/execution',{method:'POST',body:{price:price.input.value,executed_at:new Date(time.input.value).toISOString()}});await loadSignals();
          }));cell.append(form);
        }));
        cell.append(button('Dismiss signal',async()=>{await request('/market/signals',{method:'POST',body:{job_id:row.job_id,direction:row.direction,action:'dismiss'}});await Promise.all([loadSignals(),loadAlerts()]);}));
      });
    };
    const loadAlerts=async()=>{const data=await request('/market/alerts',{latest:true});alertsPanel.replaceChildren(node('h2','Active price alerts'),node('p','Server monitoring requires a running monitor service and an authorized fresh feed. Browser closure does not delete saved alerts.','pro-muted'));
      table(alertsPanel,data.items,[['kind','Alert'],['trigger_price','Watch price'],['enabled','Enabled'],['triggered_at','Observed bar close']],(cell,row)=>{
        cell.append(button(row.enabled?'Disable alert':'Enable alert',async()=>{await request('/market/alerts/'+row.id,{method:'PATCH',body:{enabled:!row.enabled}});await loadAlerts();}));
        if(row.kind==='entry_watch'){const price=field('Watch price','number',row.trigger_price);cell.append(price.wrap,button('Save watch price',async()=>{if(!price.input.value)throw new Error('Enter a positive watch price.');await request('/market/alerts/'+row.id,{method:'PATCH',body:{enabled:row.enabled,trigger_price:price.input.value}});await loadAlerts();}));}
      });
    };
    const loadNotifications=async()=>{const data=await request('/market/notifications',{latest:true});notificationsPanel.replaceChildren(node('h2','Notifications'),node('p','Browser notifications require permission and an open workspace. Web Push and email delivery are not configured.','pro-muted'));
      for(const row of data.items) {if(notificationsLoaded && !notified.has(row.id) && !row.read_at && browserNotifications && global.Notification?.permission==='granted') {
        try {const notice=new global.Notification(row.instrument+' · '+row.alert_type,{body:row.trading_style+' · '+row.direction+' · '+row.trigger_timestamp+'\n'+row.explanation,tag:row.id});shownNotifications.push(notice);}catch(error){showError(new Error('This browser requires Web Push for background notifications. In-app alerts remain available.'));}
      }notified.add(row.id);}notificationsLoaded=true;
      table(notificationsPanel,data.items,[['instrument','Instrument'],['trading_style','Style'],['alert_type','Alert'],['trigger_timestamp','Observed time'],['explanation','Explanation']],(cell,row)=>{if(!row.read_at)cell.append(button('Mark as read',async()=>{await request('/market/notifications/'+row.id+'/read',{method:'POST',body:{}});await loadNotifications();}));});
    };
    const display=(parent,value,jobId)=>{stored=value;marketResult(parent,value);parent.prepend(selectionNote);notePrevious();
      for(const scenario of value.quantitative?.market?.intelligence?.scenarios || [])if(scenario.entry && jobId){
        const controls=node('div',null,'pro-toolbar'),mode=select('Execution type',[['actual','Real manually executed trade'],['paper','Paper-tracked trade']],'paper');
        const save=async(action)=>{if(action==='take' && !global.confirm('Accept '+scenario.direction+' setup: entry '+scenario.entry+', SL '+scenario.stop_loss+', TP '+scenario.take_profit_1+', RR '+scenario.risk_reward+'? Execution must be confirmed separately.'))return;await request('/market/signals',{method:'POST',body:{job_id:jobId,direction:scenario.direction,action,mode:action==='take'?mode.input.value:null}});await Promise.all([loadSignals(),loadAlerts()]);};
        controls.append(node('p',scenario.direction+' scenario · '+scenario.setup_status),mode.wrap);
        if(scenario.setup_status==='CONFIRMED')controls.append(button('Take this signal',()=>save('take')));
        controls.append(button('Watch only / create price alerts',()=>save('watch')),button('Dismiss signal',()=>save('dismiss')));parent.append(controls);
      }
    };
    const loadHistory=async()=>{const data=await request('/ai/history?kind=market',{latest:true});history.replaceChildren();history.append(node('h2','Analysis history'));table(history,data.items,[['created_at','Created'],['state','Status']],(cell,row)=>{cell.append(button('Open analysis',async()=>{const job=await request('/ai/jobs/'+row.id);if(job.state==='succeeded')display(result,job.result,job.id);else {result.replaceChildren();details(result,job);}}));if(['failed','cancelled','expired'].includes(row.state))cell.append(button('Retry',async()=>{if(!global.confirm('Retry the original analysis? One successful result uses one shared monthly allowance.'))return;await verifyAccess();const job=await request('/ai/jobs/'+row.id+'/retry',{method:'POST',body:{},headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('ai',job,result,display);await verifyAccess();showQuota();await loadHistory();}));});};
    const generate=button('Analyze market',async()=>{if(!savedStyle)throw new Error('Select and save your trading style first.');const selection=selected();await verifyAccess();showQuota();if(!(Number(access.ai?.remaining)>0))throw new Error('No AI allowance remains this month.');await contextLoad();if(selection.instrument!==instrument.input.value || selection.timeframe!==selectedFrame || selection.trading_style!==savedStyle)throw new DOMException('Selection changed','AbortError');if(!global.confirm('A successful analysis uses one shared monthly AI allowance. Continue?'))return;const job=await request('/ai/market-analysis',{method:'POST',body:selection,headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('ai',job,result,display);await verifyAccess();showQuota();await loadHistory();},'pro-ai-generate');generate.disabled=true;generate.dataset.unavailable='true';
    toolbar.append(generate,button('Refresh market data',()=>contextLoad(true),'pro-market-refresh'),button('View evidence',()=>{const disclosure=evidencePanel.querySelector('details');if(disclosure)disclosure.open=true;evidencePanel.scrollIntoView({behavior:'smooth',block:'start'});},'pro-market-evidence'),button('View analysis history',async()=>{await loadHistory();history.scrollIntoView({behavior:'smooth',block:'start'});},'pro-market-history'));
    toolbar.append(button('View signal performance',loadSignals,'pro-signal-performance'),button('View price alerts',loadAlerts,'pro-signal-alerts'),button('View notifications',loadNotifications,'pro-signal-notifications'));
    const notificationToggle=button(browserNotifications?'Disable browser notifications':'Enable browser notifications',async()=>{
      if(!global.Notification)throw new Error('Browser notifications are unavailable on this device.');
      const enabled=!browserNotifications;
      if(enabled && await global.Notification.requestPermission()!=='granted')throw new Error('Browser notification permission was not granted.');
      await request('/market/notification-preference',{method:'PUT',body:{browser_notifications:enabled}});browserNotifications=enabled;notificationToggle.textContent=enabled?'Disable browser notifications':'Enable browser notifications';
    },'pro-browser-notifications');toolbar.append(notificationToggle);
    const loadEngine=async()=>{const data=await request('/ai/engine');engine.replaceChildren();engine.append(node('h2','AI engine status'));details(engine,data);};
    style.input.addEventListener('change',()=>action(style.input,async()=>{
      const next=style.input.value;
      if(!next)throw new Error('Select SCALPING, INTRADAY or SWING.');
      await request('/market/preference',{method:'PUT',body:{trading_style:next}});
      savedStyle=next;stored=null;result.replaceChildren(node('h2','AI entry signal'),node('p','Trading style changed. Generate a new analysis; previous signals remain in history.'));
      const row=mapped.find(item=>item.symbol===instrument.input.value),frame=next==='SWING'?'4h':'15m';
      await choose(row.timeframes.includes(frame)?frame:row.timeframes[0]);
    }));
    const catalog=await request('/market/instruments');mapped=catalog.items || [];for(const row of mapped){const option=node('option',row.symbol);option.value=row.symbol;instrument.input.append(option);}
    if(!mapped.length){freshness.textContent='No authorized instruments are configured.';return;}
    instrument.input.value=mapped.find(row=>row.symbol==='XAUUSD' || row.symbol==='GOLD')?.symbol || mapped[0].symbol;
    const row=mapped.find(row=>row.symbol===instrument.input.value);for(const item of framebar.children){item.dataset.unavailable=String(!row.timeframes.includes(item.dataset.frame));item.disabled=item.dataset.unavailable==='true' || !!item.dataset.running;}for(const item of frameSelect.input.options)item.disabled=!row.timeframes.includes(item.value);selectedFrame=row.timeframes.includes(selectedFrame)?selectedFrame:row.timeframes[0];frameSelect.input.value=selectedFrame;for(const item of framebar.children)item.setAttribute('aria-pressed',String(item.dataset.frame===selectedFrame));draw();
    await Promise.all([contextLoad().catch(showError),loadEngine().catch(showError),loadHistory().catch(showError),loadSignals().catch(showError),loadAlerts().catch(showError),loadNotifications().catch(showError)]);
    if(marketController.signal.aborted || !notificationsPanel.isConnected)return;
    const notificationTimer=setInterval(()=>loadNotifications().catch(error=>{if(error.name!=='AbortError')showError(error);}),60000);
    marketController.signal.addEventListener('abort',()=>{clearInterval(notificationTimer);for(const notice of shownNotifications)notice.close();},{once:true});
  }
  async function news() {
    const form=node('form',null,'pro-toolbar');content.append(form);filters={};
    const catalog=await request('/news/filters');
    for(const [key,label,type] of [['q','Search','search'],['country','Country','select'],['region','Region','select'],['category','Category','select'],['start','Publication start','date'],['end','Publication end','date']]) {
      const names=key==='country'?catalog.countries:key==='region'?catalog.regions:catalog.categories;
      const entry=type==='select'?select(label,[['','All'],...(names || []).map(value=>[value,value])],'','pro-news-'+key):field(label,type,'','pro-news-'+key);filters[key]=entry.input;form.append(entry.wrap);
    }
    let offset=0;const output=node('div',null,'pro-news-grid'),pagination=node('div',null,'pro-toolbar');content.append(output,pagination);
    const load=async()=>{const data=await request('/news?'+query({...filterValues(),offset,limit:24}),{latest:true});output.replaceChildren();for(const row of data.items || data.articles || []) {const card=node('article',null,'pro-panel'),url=safeLink(row.url || row.link);if(row.image_url || row.image){const imageUrl=safeLink(row.image_url || row.image);if(imageUrl){const image=node('img');image.src=imageUrl;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>image.remove());card.append(image);}}card.append(node('h2',row.title),node('p',[row.source_label || row.source?.name || row.source, row.publishedAt || row.published_at || row.date, (row.countries || []).join(", "),row.country,row.category].filter(Boolean).map(format).join(' · '),'pro-muted'));if(row.excerpt)card.append(node('p',row.excerpt));if(url){const link=node('a','Read original source');link.href=url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}output.append(card);}if(!output.childElementCount)output.append(node('p','No authorized articles match this selection.'));next.disabled=(data.items || data.articles || []).length<24;previous.disabled=offset===0;};
    const search=button('Search',async()=>{validateFilters();offset=0;await load();},'pro-news-search');form.append(search,button('Reset',async()=>{Object.values(filters).forEach(input=>input.value='');offset=0;await load();}));form.addEventListener('submit',event=>{event.preventDefault();search.click();});
    const previous=button('Previous page',async()=>{offset=Math.max(0,offset-24);await load();}),next=button('Next page',async()=>{offset+=24;await load();});pagination.append(previous,next);await load();
  }
  async function open(feature='ai-market',selection={}) {
    if(!features[feature])throw new Error('Unknown Pro feature.');
    revision++;controller.abort();controller=new AbortController(); preset={...selection};current=feature;root=document.getElementById('view-pro-workspace');if(!root)throw new Error('Pro workspace container is missing.');
    root.replaceChildren();const heading=node('header',null,'pro-heading');const title=node('div');title.append(node('h1',text('Title'+feature,features[feature])),node('p',text('WorkspaceDescription','Performance, risk, reports and AI insights from your trading journal.'),'pro-subtitle'));heading.append(title);root.append(heading);
    const navigation=node('nav',null,'pro-sections');navigation.setAttribute('aria-label','Pro sections');
    const groups=[['Analysis',['analytics','heatmap','strategies','risk']],['Reviews & reports',['reviews','reports']],['AI assistant',['ai-market','ai-behaviour','ai-journal','ai-chat']],['Markets',['global-news']]];
    for(const [group,keys] of groups) {const section=node('div',null,'pro-nav-group');section.append(node('h2',group));navigation.append(section);
    for(const key of keys) {const label=features[key];const item=node('button',label,'btn btn-ghost');item.type='button';item.dataset.section=key;item.dataset.componentId='pro-section-'+key;item.setAttribute('aria-current',key===feature?'page':'false');item.addEventListener('click',()=>open(key));if(key.startsWith('ai-'))item.append(node('span','AI','pro-ai-badge'));section.append(item);}}
    const layout=node('div',null,'pro-layout'),workspace=node('div',null,'pro-content-panel');layout.append(navigation,workspace);root.append(layout);
    const selector=select('Pro section',Object.entries(features),feature,'pro-section-selector');selector.wrap.classList.add('pro-section-mobile');selector.input.addEventListener('change',()=>open(selector.input.value));workspace.append(selector.wrap);
    heading.append(button(text('RetrySection','Retry section'),()=>open(feature,selection),'pro-section-retry'));
    status=node('p',text('Loading','Loading…'),'pro-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');workspace.append(status);content=node('div');workspace.append(content);options.onRoute?.(feature);
    const epoch=revision;
    try {
      await verifyAccess();if(access.plan!=='pro')throw new Error(text('ProRequired','An active Pro subscription is required.'));
      if(!['ai-market','ai-chat','global-news'].includes(feature)) {
        const [accountData,strategyData]=await Promise.all([request('/accounts'),request('/strategies')]);if(epoch!==revision)return;accounts=accountData.items || [];strategies=strategyData.items || [];
      }
      await ({analytics,heatmap,strategies:strategyComparison,risk,reviews,reports,'ai-behaviour':()=>ai('behaviour'),'ai-market':marketIntelligence,'ai-journal':()=>ai('journal'),'ai-chat':aiChat,'global-news':news})[feature]();if(epoch===revision && status.textContent===text('Loading','Loading…'))status.textContent='';
    } catch(error) {if(epoch===revision)showError(error);}
  }
  function reset() {revision++;controller.abort();controller=new AbortController();clearAccess();current='';filters={};preset={};accounts=[];strategies=[];root?.replaceChildren();status=null;content=null;}
  global.JTPRO={features,configure(value){reset();options={...value};},open,reset,verifyAccess,request,aggregateSeries,safeLink,get access(){return access;},get current(){return current;}};
})(window);
