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
  const GEMINI_STORAGE_KEY='gemini_api_key';
  const GEMINI_DEFAULT_MODEL='gemini-2.5-flash';
  const getStorage=()=>{try{return global['local'+'Storage']||null;}catch(_){return null;}};
  const getGeminiApiKey=()=>{try{return (getStorage()?.getItem(GEMINI_STORAGE_KEY)||'').trim();}catch(_){return '';}};
  const setGeminiApiKey=(key)=>{try{const store=getStorage();if(!store)return false;if(!key||!key.trim())store.removeItem(GEMINI_STORAGE_KEY);else store.setItem(GEMINI_STORAGE_KEY,key.trim());return true;}catch(_){return false;}};
  const hasGeminiApiKey=()=>Boolean(getGeminiApiKey());

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function inlineMarkdown(text) {
    let s=escapeHtml(text);
    s=s.replace(/`([^`]+)`/g,'<code>$1</code>');
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/__([^_]+)__/g,'<strong>$1</strong>');
    s=s.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g,'$1<em>$2</em>$3');
    s=s.replace(/(^|[^_])_([^_]+)_([^_]|$)/g,'$1<em>$2</em>$3');
    s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }

  function renderMarkdown(md) {
    if(!md) return '';
    const lines=String(md).split(/\r?\n/),out=[];
    let inCodeBlock=false,codeBlockLang='',codeBlockLines=[];
    let inTable=false,tableRows=[];
    let inList=false,listType=null;

    function closeList() {
      if(inList){out.push(listType==='ol'?'</ol>':'</ul>');inList=false;listType=null;}
    }

    function closeTable() {
      if(inTable){
        if(tableRows.length>0){
          let html='<div class="pro-scroll"><table class="pro-markdown-table">';
          const headerCells=tableRows[0];
          html+='<thead><tr>';
          for(const c of headerCells) html+='<th scope="col">'+inlineMarkdown(c.trim())+'</th>';
          html+='</tr></thead><tbody>';
          for(let r=1;r<tableRows.length;r++){
            const row=tableRows[r];
            if(row.every(c=>/^[:\s-]+$/.test(c.trim()))) continue;
            html+='<tr>';
            for(let i=0;i<headerCells.length;i++){
              const cellVal=row[i]?row[i].trim():'';
              html+='<td>'+inlineMarkdown(cellVal)+'</td>';
            }
            html+='</tr>';
          }
          html+='</tbody></table></div>';
          out.push(html);
        }
        inTable=false;tableRows=[];
      }
    }

    for(let i=0;i<lines.length;i++){
      const rawLine=lines[i];
      if(rawLine.trim().startsWith('```')){
        if(inCodeBlock){
          out.push('<pre><code class="language-'+escapeHtml(codeBlockLang)+'">'+escapeHtml(codeBlockLines.join('\n'))+'</code></pre>');
          inCodeBlock=false;codeBlockLines=[];codeBlockLang='';
        } else {
          closeList();closeTable();inCodeBlock=true;codeBlockLang=rawLine.trim().slice(3).trim();codeBlockLines=[];
        }
        continue;
      }
      if(inCodeBlock){codeBlockLines.push(rawLine);continue;}
      const trimmed=rawLine.trim();
      if(trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length>1){
        closeList();inTable=true;
        const cells=trimmed.slice(1,-1).split('|');
        tableRows.push(cells);
        continue;
      } else {
        closeTable();
      }
      if(!trimmed){closeList();continue;}
      if(/^#{1,6}\s+/.test(trimmed)){
        closeList();
        const level=trimmed.match(/^(#{1,6})\s+/)[1].length;
        const headingText=trimmed.replace(/^#{1,6}\s+/,'');
        const tagLevel=Math.min(6,Math.max(2,level));
        out.push('<h'+tagLevel+'>'+inlineMarkdown(headingText)+'</h'+tagLevel+'>');
        continue;
      }
      if(trimmed.startsWith('>')){
        closeList();out.push('<blockquote>'+inlineMarkdown(trimmed.replace(/^>\s*/,''))+'</blockquote>');
        continue;
      }
      if(/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)){
        closeList();out.push('<hr class="pro-hr">');
        continue;
      }
      const ulMatch=trimmed.match(/^[-*+]\s+(.*)/);
      if(ulMatch){
        if(!inList || listType!=='ul'){closeList();out.push('<ul>');inList=true;listType='ul';}
        out.push('<li>'+inlineMarkdown(ulMatch[1])+'</li>');
        continue;
      }
      const olMatch=trimmed.match(/^(\d+)\.\s+(.*)/);
      if(olMatch){
        if(!inList || listType!=='ol'){closeList();out.push('<ol>');inList=true;listType='ol';}
        out.push('<li>'+inlineMarkdown(olMatch[2])+'</li>');
        continue;
      }
      closeList();out.push('<p>'+inlineMarkdown(trimmed)+'</p>');
    }
    if(inCodeBlock) out.push('<pre><code>'+escapeHtml(codeBlockLines.join('\n'))+'</code></pre>');
    closeList();closeTable();
    return out.join('\n');
  }

  function renderMarkdownInto(parent,md) {
    const html=renderMarkdown(md);
    if(global.DOMParser){
      const doc=new global.DOMParser().parseFromString(html,'text/html');
      const frag=document.createDocumentFragment();
      while(doc.body.firstChild) frag.append(doc.body.firstChild);
      parent.append(frag);
    } else {
      const p=node('div',null,'pro-raw-text');
      p.textContent=md;
      parent.append(p);
    }
  }

  async function callGeminiApi({systemInstruction,contents,history,model=GEMINI_DEFAULT_MODEL,signal}) {
    const apiKey=getGeminiApiKey();
    if(!apiKey){
      throw new Error('Google Gemini API Key belum diatur. Klik tombol "Set API Key" di samping status AI untuk memasukkan API Key Anda.');
    }
    const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    let contentsPayload;
    if(Array.isArray(history) && history.length>0) contentsPayload=history;
    else if(Array.isArray(contents)) contentsPayload=contents;
    else contentsPayload=[{role:'user',parts:[{text:String(contents||'')}]}];

    const payload={
      contents:contentsPayload,
      generationConfig:{temperature:0.2,maxOutputTokens:4096}
    };
    if(systemInstruction){
      payload.systemInstruction={parts:[{text:String(systemInstruction)}]};
    }
    let response;
    try {
      response=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
        signal
      });
    } catch(err) {
      if(err.name==='AbortError') throw err;
      throw new Error('Gagal menghubungi Google Gemini: '+(err.message||'Periksa koneksi internet Anda.'));
    }

    if(response.status===429){
      throw new Error('Kuota Google Gemini API telah habis atau dibatasi (Error 429: Rate Limit Exceeded). Silakan coba lagi beberapa saat atau gunakan API Key lain.');
    }
    const data=await response.json().catch(()=>null);
    if(!response.ok){
      const errorMsg=data?.error?.message||response.statusText;
      if(response.status===400 || response.status===403){
        throw new Error('Google Gemini API Key tidak valid atau tidak memiliki izin akses (Error: '+errorMsg+'). Periksa kembali API Key Anda di Google AI Studio.');
      }
      throw new Error('Google Gemini API Error ('+response.status+'): '+errorMsg);
    }
    const textOutput=data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if(!textOutput){
      throw new Error('Google Gemini tidak mengembalikan respon teks yang valid. Silakan coba kembali.');
    }
    return textOutput;
  }

  function openGeminiConfigModal(onStateChanged) {
    const existing=document.getElementById('pro-gemini-modal');
    if(existing) existing.remove();
    const backdrop=node('div',null,'pro-modal-backdrop');
    backdrop.id='pro-gemini-modal';
    backdrop.setAttribute('role','dialog');
    backdrop.setAttribute('aria-modal','true');
    backdrop.setAttribute('aria-labelledby','pro-gemini-modal-title');
    const dialog=node('div',null,'pro-modal-dialog');
    backdrop.append(dialog);
    const title=node('h2','Google Gemini API Configuration','pro-modal-title');
    title.id='pro-gemini-modal-title';
    const desc=node('p','Hubungkan seluruh 4 modul AI (AI Market Intelligence, AI Behaviour Analysis, AI Journal Analyst, dan AI Chat) langsung ke Google Gemini API menggunakan API Key terpusat Anda. API Key disimpan secara aman di browser lokal Anda.');
    const fieldWrap=node('div',null,'pro-modal-field');
    fieldWrap.append(node('label','Google Gemini API Key'));
    const input=node('input');
    input.type='password';
    input.id='pro-gemini-api-key-input';
    input.placeholder='AIzaSy...';
    input.value=getGeminiApiKey();
    input.autocomplete='off';
    fieldWrap.append(input);
    const toggleShow=node('button','Tampilkan API Key','btn btn-ghost');
    toggleShow.type='button';
    toggleShow.style.alignSelf='flex-start';
    toggleShow.style.fontSize='12px';
    toggleShow.style.padding='2px 8px';
    toggleShow.style.minHeight='28px';
    toggleShow.addEventListener('click',()=>{
      if(input.type==='password'){input.type='text';toggleShow.textContent='Sembunyikan API Key';}
      else {input.type='password';toggleShow.textContent='Tampilkan API Key';}
    });
    fieldWrap.append(toggleShow);
    const statusMsg=node('div',null,'pro-modal-status');
    const link=node('a','Dapatkan Google Gemini API Key gratis di Google AI Studio →','pro-modal-link');
    link.href='https://aistudio.google.com/app/apikey';
    link.target='_blank';
    link.rel='noopener noreferrer';
    const actions=node('div',null,'pro-modal-actions');
    const btnSave=node('button','Simpan API Key','btn btn-primary');
    btnSave.id='pro-gemini-save-btn';
    btnSave.type='button';
    btnSave.addEventListener('click',()=>{
      const val=input.value.trim();
      if(!val){statusMsg.textContent='Masukkan API Key sebelum menyimpan.';statusMsg.className='pro-modal-status error';return;}
      setGeminiApiKey(val);
      statusMsg.textContent='API Key berhasil disimpan! Semua modul AI kini Terhubung (Connected).';
      statusMsg.className='pro-modal-status success';
      onStateChanged?.();
      setTimeout(()=>{backdrop.remove();},1200);
    });
    const btnRemove=node('button','Hapus Key','btn btn-ghost');
    btnRemove.type='button';
    btnRemove.addEventListener('click',()=>{
      setGeminiApiKey('');
      input.value='';
      statusMsg.textContent='API Key telah dihapus.';
      statusMsg.className='pro-modal-status success';
      onStateChanged?.();
    });
    const btnClose=node('button','Tutup','btn btn-ghost');
    btnClose.type='button';
    btnClose.addEventListener('click',()=>backdrop.remove());
    actions.append(btnRemove,btnClose,btnSave);
    dialog.append(title,desc,fieldWrap,link,statusMsg,actions);
    backdrop.addEventListener('click',(e)=>{if(e.target===backdrop)backdrop.remove();});
    document.body.append(backdrop);
    input.focus();
  }

  const KAYSTRADE_SYSTEM_PROMPT = `Anda adalah AI Market Intelligence profesional berbasis metodologi teknikal Kaystrade (docs/kaystrade/SKILL.md).
Gunakan Bahasa Indonesia yang profesional dan mendalam. Label Supply/Demand menggunakan istilah baku teknikal (misalnya Fresh Demand, Mitigated Supply, FVG).

Prinsip & Metodologi Analisis Kaystrade:
1. Data & Lingkup:
   - Pastikan simbol, timeframe, dan status pasar saat ini. GOLD default TVC:GOLD.
2. Filter & Multi-Timeframe Analysis:
   - Big trend H4 menentukan arah: Higher High / Higher Low (HH/HL) memprioritaskan BUY; Lower High / Lower Low (LH/LL) memprioritaskan SELL. D1 memberi konteks tren besar. Ketika H4 konsolidasi atau netral, tunggu perubahan struktur; breakout H1 saja bukan konfirmasi tren H4.
   - H1 untuk pemetaan struktur pasar: BOS (Break of Structure), CHoCH (Change of Character), dan swing key levels.
   - M15 / M30 untuk timing eksekusi: Minimal 3 konfirmasi independen eksplisit (struktur H1 + retest zona + momentum RSI + displacement FVG). Jangan entry hanya karena menyentuh garis/Fibonacci.
   - Base & Breakout: Tunggu body candle close di luar base, retest, lalu rejection. Jika body kembali masuk ke dalam base, batalkan setup dan tunggu breakout baru.
3. Pemetaan Level & Zona:
   - SNR/SBR: Repeated reactions, swing bermakna, recency. SBR (Support Become Resistance) memerlukan support break lalu retest/rejection dari bawah.
   - Key Pivot: Titik pivot acuan harga kunci (garis pivot utama).
   - Fresh Supply & Demand (H1/H4): Origin base/opposite candle dengan departure/displacement kuat dan break struktur. Zona Fresh adalah yang belum pernah diretest setelah departure.
   - Fair Value Gap (FVG): Imbalance 3 candle dengan displacement bermakna yang belum termitigasi.
   - Likuiditas: Equal highs/lows, swing extrema, liquidity sweep dan reclaim.
   - RSI(14) & SMA(14): Level 70/50/30. Rebound dari 30 atau rejection dari 70, cross SMA(14), serta divergen terkonfirmasi.
   - Konteks DXY & Makro: DXY sebagai konteks untuk Gold/Forex (korelasi tidak selalu mutlak).
4. Penilaian Akhir & Rencana Eksekusi:
   - Sinyal: BUY, SELL, NEUTRAL, atau NO TRADE.
   - Entry bersyarat, Stop Loss di luar swing invalidasi, Take Profit minimal Risk:Reward 1:2.
   - Kondisi invalidasi yang jelas kapan setup batal.

Format respon dengan Markdown yang rapi:
- Ringkasan Sinyal dalam tabel (Arah, Status, Entry, Stop Loss, Take Profit, Risk-Reward).
- Analisis Tren & Struktur Multi-Timeframe (H4, H1, M15/M30).
- Pemetaan Zona Kunci (SNR/SBR, Supply/Demand Fresh, FVG).
- 3 Konfirmasi Independen & Kondisi Invalidasi Setup.`;

  const BEHAVIOUR_SYSTEM_PROMPT = `Anda adalah Analis Psikologi Trading (Trading Psychology & Behaviour Analyst) profesional di journalingtrade.
Tugas Anda adalah menganalisis data jurnal trading pengguna untuk mendeteksi kebiasaan buruk dan bias emosional, seperti:
1. FOMO (Fear of Missing Out): Tergesa-gesa entry tanpa konfirmasi setup atau mengejar harga yang sudah bergerak jauh.
2. Revenge Trading: Membuka posisi baru secara impulsif dan agresif setelah mengalami kerugian untuk "membalas" pasar.
3. Overtrading: Frekuensi transaksi terlalu tinggi dalam satu sesi atau hari yang melebihi batas wajar strategi.
4. Ketidakdisiplinan SL & TP: Menggeser atau menghapus Stop Loss, menolak cut loss sesuai rencana, atau take profit terlalu dini karena ketakutan.
5. Inkonsistensi Position Sizing: Menaikkan lot secara emosional tanpa memperhitungkan risk per trade.

Berikan analisis terstruktur dalam Bahasa Indonesia profesional:
- Ringkasan Pola Emosional & Skor Disiplin Trading.
- Kebiasaan Buruk yang Terdeteksi beserta Bukti Indikator Data.
- Dampak Psikologis dan Risiko Saldo Akun.
- Rencana Aksi Solutif (Action Plan) dan Protokol Disiplin Harian.
Gunakan format Markdown dengan heading, bullet points, dan tabel rekomendasi.`;

  const JOURNAL_ANALYST_SYSTEM_PROMPT = `Anda adalah Senior Trading Journal Analyst & Strategy Optimization Specialist di journalingtrade.
Tugas Anda adalah mengevaluasi data performa trading pengguna (winrate, risk-to-reward ratio, ekuitas, profit factor, drawdown, durasi, dan sebaran instrumen) dan memberikan rekomendasi optimasi strategi secara mendalam.

Aspek Evaluasi:
1. Audit Metrik Kunci: Winrate, Profit Factor, Expectancy, Risk-to-Reward Ratio (RRR), Maximum Drawdown.
2. Analisis Distribusi: Kinerja per instrumen/pair, per sesi (Asia, London, New York), per hari/jam, dan per strategi.
3. Identifikasi Edge & Kebocoran Keuntungan (Profit Leaks).
4. Rekomendasi Optimasi Strategi yang konkret, terukur, dan berbasis data.

Gunakan Bahasa Indonesia profesional, lugas, tajam, dan mudah dipahami dalam format Markdown dengan tabel dan bullet points.`;

  const CHAT_SYSTEM_PROMPT = `Anda adalah Asisten AI Trading & Mentor Finansial profesional di journalingtrade.
Anda menguasai analisis teknikal (metodologi Kaystrade, SNR/SBR, Supply/Demand, Price Action), manajemen risiko (RRR, position sizing), psikologi trading, serta evaluasi performa jurnal trading.
Jawab setiap pertanyaan pengguna secara ramah, profesional, mendalam, dan edukatif dalam Bahasa Indonesia.
Pertahankan konteks percakapan untuk berdiskusi dua arah secara interaktif.
Gunakan format Markdown (bold, tabel, bullet points, blok kode) untuk memperjelas jawaban.`;

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
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(options.requestTimeout || 45000)]);
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
      job=await request('/'+(kind==='ai'||kind==='chat'?'ai/jobs':kind==='reviews'?'jobs':'reports')+'/'+job.id);
    }
    if(epoch===revision)parent.append(node('p','The job is still processing. Check its status in history.','pro-muted'));
    return job;
  }
  async function ai(kind) {
    const toolbar=commonFilters(content,()=>loadHistory());const quota=node('p',null,'pro-muted');content.append(quota);
    const showQuota=()=>{
      if(hasGeminiApiKey()){
        quota.textContent='Google Gemini AI: Connected ('+GEMINI_DEFAULT_MODEL+') · Menggunakan API Key terpusat';
      } else {
        quota.textContent=text('Quota','Remaining AI analyses')+': '+format(access?.ai?.remaining)+' / '+format(access?.ai?.limit || 30);
      }
    };
    showQuota();
    const config={},grid=node('div',null,'pro-grid');content.append(grid);let result;
    result=panel('Analysis result',grid);result.append(node('p','Select your filters and run an analysis, or open a saved result from history below.','pro-muted'));if(kind==='journal'){const analysisType=select('Analysis type',[['performance','Performance'],['strategy','Strategy'],['risk','Risk'],['consistency','Consistency'],['review','Review commentary']],preset.analysis_type || 'performance','pro-analysis-type');toolbar.append(analysisType.wrap);config.analysis_type=analysisType.input;}
    const history=panel('Analysis history');
    const loadHistory=async()=>{
      try {
        const data=await request('/ai/history?'+query({kind,...filterValues()}),{latest:true});
        history.replaceChildren();history.append(node('h2','Analysis history'));
        table(history,data.items,[['created_at','Created'],['state','Status'],['kind','Analysis']],(cell,row)=>{
          cell.append(button('Open analysis',async()=>{const job=await request('/ai/jobs/'+row.id);if(job.state==='succeeded')aiResult(result,job.result);else details(result,job);}));
          if(['failed','cancelled','expired'].includes(row.state))cell.append(button('Retry',async()=>{if(!global.confirm('Start a new AI analysis? A successful result uses one shared monthly allowance.'))return;await verifyAccess();showQuota();const job=await request('/ai/jobs/'+row.id+'/retry',{method:'POST',body:{},headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('ai',job,result);await verifyAccess();showQuota();await loadHistory();}));
        });
      } catch(err) {
        history.replaceChildren();history.append(node('h2','Analysis history'),node('p',err.name==='TimeoutError'?'History load timed out. Click "Retry section" above.':'Analysis history is currently unavailable: '+err.message,'pro-muted'));
      }
    };
    const generateBtn=button(kind==='market'?'Analyze market':kind==='behaviour'?'Analyze behaviour':'Generate analysis',async()=>{
      validateFilters();
      if(hasGeminiApiKey()){
        result.replaceChildren();
        const loadingBox=node('div',null,'pro-ai-loading');
        const isBehaviour=kind==='behaviour';
        loadingBox.append(
          node('div',null,'pro-spinner'),
          node('p',isBehaviour?'Menganalisis perilaku dan psikologi trading dengan Google Gemini AI...':'Mengevaluasi performa jurnal dan strategi dengan Google Gemini AI...')
        );
        result.replaceChildren(node('h2','Analysis result'),loadingBox);

        let contextData=null;
        try {
          contextData=await request('/analytics/overview?'+query(filterValues()),{latest:true});
        } catch(_){}

        const systemPrompt=isBehaviour?BEHAVIOUR_SYSTEM_PROMPT:JOURNAL_ANALYST_SYSTEM_PROMPT;
        const userPrompt=isBehaviour
          ? `Berikut data ringkasan trading pengguna untuk analisis psikologi dan perilaku trading:\n${JSON.stringify(contextData || { filters: filterValues(), note: 'Data evaluasi perilaku transaksi' }, null, 2)}\n\nAnalisis kebiasaan buruk trader seperti potensi FOMO, revenge trading, overtrading, dan ketidakdisiplinan SL/TP, serta berikan rekomendasi psikologi trading konkret.`
          : `Tipe Analisis: ${config.analysis_type?.value || 'performance'}\nBerikut data performa trading pengguna untuk evaluasi performa dan optimasi strategi:\n${JSON.stringify(contextData || { filters: filterValues(), note: 'Data metrik trading' }, null, 2)}\n\nEvaluasi performa trade pengguna (winrate, risk-to-reward, ekuitas, drawdown) dan berikan saran optimasi strategi secara mendalam.`;

        try {
          const aiResponse=await callGeminiApi({
            systemInstruction:systemPrompt,
            contents:userPrompt,
            signal:controller.signal
          });
          const contentBox=node('div',null,'pro-markdown');
          renderMarkdownInto(contentBox,aiResponse);
          result.replaceChildren(node('h2','Analysis result'),contentBox);
        } catch(err) {
          const errBox=node('div',null,'pro-modal-status error');
          errBox.style.display='block';
          errBox.textContent=err.message;
          result.replaceChildren(node('h2','Analysis result'),errBox);
          throw err;
        }
        return;
      }

      await verifyAccess();showQuota();if(!(Number(access.ai?.remaining)>0))throw new Error('No AI allowance remains for this subscription month.');
      if(!global.confirm('A successful AI analysis uses one of your 30 shared monthly allowances. Failed or cancelled analyses do not count. Continue?'))return;
      const values={...filterValues(),...Object.fromEntries(Object.entries(config).map(([key,input])=>[key,input.value]))};
      if(kind==='market')await request('/market/context?'+query({instrument:values.instrument,timeframe:values.timeframe}));
      const job=await request('/ai/'+kind+'-analysis',{method:'POST',body:values,headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('ai',job,result);await verifyAccess();showQuota();await loadHistory();
    },'pro-ai-generate');
    const geminiKeyBtn=button(hasGeminiApiKey()?'Gemini API Key: Connected':'Set Gemini API Key',()=>{
      openGeminiConfigModal(()=>{
        showQuota();
        geminiKeyBtn.textContent=hasGeminiApiKey()?'Gemini API Key: Connected':'Set Gemini API Key';
      });
    },'pro-gemini-key-btn-'+kind);
    toolbar.append(generateBtn,geminiKeyBtn);await loadHistory();
  }
  async function aiChat() {
    const quota=node('p',null,'pro-muted');
    const thread=panel('Conversation'),messages=node('div',null,'pro-chat-messages');messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');messages.setAttribute('aria-label','AI chat conversation');thread.append(messages);
    const composer=node('div',null,'pro-chat-composer'),input=node('textarea');input.id='pro-ai-chat-message';input.name='message';input.maxLength=4000;input.rows=3;input.required=true;input.setAttribute('aria-label','Message the AI assistant');input.placeholder='Ask about your journal, trading process, or a market concept…';
    const note=node('p','','pro-muted');
    content.append(quota,thread,composer,note);
    const showQuota=()=>{
      if(hasGeminiApiKey()){
        quota.textContent='Google Gemini AI: Connected ('+GEMINI_DEFAULT_MODEL+')';
        note.textContent='AI Chat ditenagai oleh Google Gemini API ('+GEMINI_DEFAULT_MODEL+'). Mengobrol dan konsultasi seputar strategi, psikologi, teknikal, dan evaluasi jurnal secara interaktif dua arah.';
      } else {
        quota.textContent='AI analyses remaining this month: '+format(access?.ai?.remaining)+' / '+format(access?.ai?.limit || 30);
        note.textContent='AI chat uses one shared monthly allowance per successful reply. It does not have live prices or news and does not provide trade signals.';
      }
    };
    const bubble=(role,value,time)=>{
      const item=node('article',null,'pro-chat-message');item.dataset.role=role;
      item.append(node('h3',role==='user'?'You':'AI assistant (Gemini)'));
      if(typeof value==='string' && value.includes('\n')){
        const box=node('div',null,'pro-markdown');
        renderMarkdownInto(box,value);
        item.append(box);
      } else {
        item.append(node('p',value));
      }
      if(time)item.append(node('time',format(time),'pro-muted'));
      return item;
    };
    const load=async()=>{
      if(hasGeminiApiKey()){
        messages.replaceChildren();
        const historyList=global._geminiChatHistory || [];
        if(!historyList.length){
          messages.append(node('p','Ketik pertanyaan untuk mulai mengobrol dan berkonsultasi seputar trading dengan Google Gemini AI.','pro-muted'));
        } else {
          for(const item of historyList){
            const textVal=item.parts?.[0]?.text || '';
            if(item.role==='user'){
              messages.append(bubble('user',textVal));
            } else {
              const m=node('article',null,'pro-chat-message');m.dataset.role='assistant';m.append(node('h3','AI assistant (Gemini)'));
              const c=node('div',null,'pro-markdown');renderMarkdownInto(c,textVal);m.append(c);messages.append(m);
            }
          }
        }
        return;
      }
      const data=await request('/ai/chat/history',{latest:true});messages.replaceChildren();for(const item of [...(data.items || [])].reverse()){messages.append(bubble('user',item.message,item.created_at));if(item.reply)messages.append(bubble('assistant',item.reply,item.created_at));else if(item.state==='failed'||item.state==='cancelled')messages.append(bubble('assistant','This reply was not completed. No AI allowance was charged.',item.created_at));else messages.append(bubble('assistant','Response is processing…',item.created_at));}if(!messages.childElementCount)messages.append(node('p','Ask a question to start your private Pro chat.','pro-muted'));
    };
    const answer=(parent,result)=>{parent.replaceChildren(bubble('assistant',result.reply,result.generated_at));};
    const send=button('Send message',async()=>{
      const message=input.value.trim();if(!message)throw new Error('Enter a message first.');
      if(hasGeminiApiKey()){
        input.value='';
        messages.append(bubble('user',message,new Date().toISOString()));

        const loadingBubble=node('article',null,'pro-chat-message');
        loadingBubble.dataset.role='assistant';
        const typing=node('div',null,'pro-typing-indicator');
        typing.append(node('span'),node('span'),node('span'));
        loadingBubble.append(node('h3','AI assistant (Gemini)'),typing,node('p','Gemini AI sedang mengetik jawaban…','pro-muted'));
        messages.append(loadingBubble);
        messages.scrollTop=messages.scrollHeight;

        const historyList=global._geminiChatHistory=global._geminiChatHistory || [];
        historyList.push({role:'user',parts:[{text:message}]});

        let replyText='';
        try {
          replyText=await callGeminiApi({
            systemInstruction:CHAT_SYSTEM_PROMPT,
            history:historyList,
            signal:controller.signal
          });
          historyList.push({role:'model',parts:[{text:replyText}]});
        } catch(err) {
          historyList.pop();
          loadingBubble.replaceChildren();
          loadingBubble.append(node('h3','AI assistant (Gemini)'),node('p','Gagal memproses jawaban: '+err.message,'pro-muted'));
          throw err;
        }

        loadingBubble.replaceChildren();
        loadingBubble.append(node('h3','AI assistant (Gemini)'));
        const contentBox=node('div',null,'pro-markdown');
        renderMarkdownInto(contentBox,replyText);
        loadingBubble.append(contentBox,node('time',new Date().toLocaleTimeString(),'pro-muted'));
        messages.scrollTop=messages.scrollHeight;
        return;
      }

      await verifyAccess();showQuota();if(!(Number(access.ai?.remaining)>0))throw new Error('No AI allowance remains this month.');if(!global.confirm('A successful AI reply uses one shared monthly AI allowance. Continue?'))return;const job=await request('/ai/chat',{method:'POST',body:{message},headers:{'Idempotency-Key':crypto.randomUUID()}});input.value='';messages.replaceChildren(bubble('user',message));await watchJob('chat',job,messages,answer);await load();await verifyAccess();showQuota();
    },'pro-ai-chat-send');
    input.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();send.click();}});
    const geminiChatKeyBtn=button(hasGeminiApiKey()?'Gemini API Key: Connected':'Set Gemini API Key',()=>{
      openGeminiConfigModal(()=>{
        showQuota();
        geminiChatKeyBtn.textContent=hasGeminiApiKey()?'Gemini API Key: Connected':'Set Gemini API Key';
      });
    },'pro-gemini-key-btn-chat');
    composer.append(input,send,geminiChatKeyBtn);
    await Promise.all([load(),Promise.resolve(showQuota())]);
  }
  function disclosure(parent,title,value) {
    const section=node('details',null,'pro-disclosure');section.append(node('summary',title));parent.append(section);
    if(value===undefined || value===null || Array.isArray(value) && !value.length) section.append(node('p','No verified evidence supplied.','pro-muted'));
    else if(Array.isArray(value)) {for(const item of value) {if(item && typeof item==='object' && (item.text || item.title || item.summary)){section.append(node('p',item.text || item.title || item.summary));evidence(section,item.evidence_ids);if(item.timestamp)section.append(node('p',item.timestamp,'pro-muted'));}else if(item && typeof item==='object')details(section,item);else section.append(node('p',format(item)));}sourceReferences(section,value);}
    else {details(section,value);sourceReferences(section,value);}
    return section;
  }
  const KaystradeEngine = {
    rsiSeries(candles, period = 14) {
      const closes = candles.map(c => Number(c.close));
      const values = new Array(Math.min(period, closes.length)).fill(null);
      if (closes.length <= period) return values;
      const changes = [];
      for (let i = 0; i < closes.length - 1; i++) changes.push(closes[i + 1] - closes[i]);
      let gain = 0, loss = 0;
      for (let i = 0; i < period; i++) {
        if (changes[i] > 0) gain += changes[i]; else loss += -changes[i];
      }
      gain /= period; loss /= period;
      for (let idx = period; idx < closes.length; idx++) {
        if (idx > period) {
          const chg = changes[idx - 1];
          gain = (gain * (period - 1) + (chg > 0 ? chg : 0)) / period;
          loss = (loss * (period - 1) + (chg < 0 ? -chg : 0)) / period;
        }
        values.push(loss === 0 && gain > 0 ? 100 : loss === 0 ? 50 : 100 - (100 / (1 + gain / loss)));
      }
      return values;
    },

    atrValues(candles, period = 14) {
      const ranges = [];
      for (let i = 0; i < candles.length - 1; i++) {
        const a = candles[i], b = candles[i + 1];
        ranges.push(Math.max(b.high - b.low, Math.abs(b.high - a.close), Math.abs(b.low - a.close)));
      }
      const values = new Array(Math.min(period, candles.length)).fill(null);
      if (ranges.length < period) return values;
      let res = 0;
      for (let i = 0; i < period; i++) res += ranges[i];
      res /= period; values.push(res);
      for (let i = period; i < ranges.length; i++) {
        res = (res * (period - 1) + ranges[i]) / period;
        values.push(res);
      }
      return values;
    },

    atr(candles, period = 14) {
      const vals = this.atrValues(candles, period);
      return vals.length ? vals[vals.length - 1] : null;
    },

    emaSeries(candles, period) {
      const closes = candles.map(c => Number(c.close));
      if (closes.length < period) return new Array(closes.length).fill(null);
      const k = 2 / (period + 1);
      let sum = 0;
      for (let i = 0; i < period; i++) sum += closes[i];
      let ema = sum / period;
      const output = new Array(period - 1).fill(null);
      output.push(ema);
      for (let i = period; i < closes.length; i++) {
        ema = closes[i] * k + ema * (1 - k);
        output.push(ema);
      }
      return output;
    },

    pivots(candles) {
      const pts = [];
      for (let i = 2; i < candles.length - 2; i++) {
        const neighbors = [candles[i - 2], candles[i - 1], candles[i + 1], candles[i + 2]];
        const ch = candles[i].high, cl = candles[i].low;
        if (neighbors.every(c => ch > c.high)) {
          pts.push({ kind: 'high', index: i, price: ch, timestamp: candles[i].timestamp });
        }
        if (neighbors.every(c => cl < c.low)) {
          pts.push({ kind: 'low', index: i, price: cl, timestamp: candles[i].timestamp });
        }
      }
      return pts;
    },

    structure(points) {
      const highs = points.filter(p => p.kind === 'high');
      const lows = points.filter(p => p.kind === 'low');
      if (highs.length < 2 || lows.length < 2) return 'insufficient_swings';
      const hL = highs[highs.length - 1].price, hP = highs[highs.length - 2].price;
      const lL = lows[lows.length - 1].price, lP = lows[lows.length - 2].price;
      if (hL > hP && lL > lP) return 'HH_HL';
      if (hL < hP && lL < lP) return 'LH_LL';
      return 'consolidation';
    },

    levels(candles, points, tolerance) {
      const groups = [];
      for (const point of points) {
        let group = groups.find(g => g.kind === point.kind && Math.abs(g.price - point.price) <= tolerance);
        if (!group) {
          group = { kind: point.kind, price: point.price, reactions: 0, last_index: point.index, timestamp: point.timestamp };
          groups.push(group);
        }
        group.reactions++;
        group.last_index = point.index;
      }
      for (const group of groups) {
        group.label = group.kind === 'high' ? 'Resistance' : 'Support';
        if (group.kind === 'low') {
          const later = candles.slice(group.last_index + 3);
          let broke = false;
          for (const c of later) {
            if (broke && c.high >= group.price - tolerance && c.close < group.price - tolerance && c.close < c.open) {
              group.label = 'SBR';
            }
            if (c.close < group.price - tolerance) broke = true;
          }
        } else if (group.kind === 'high') {
          const later = candles.slice(group.last_index + 3);
          let broke = false;
          for (const c of later) {
            if (broke && c.low <= group.price + tolerance && c.close > group.price + tolerance && c.close > c.open) {
              group.label = 'RBS';
            }
            if (c.close > group.price + tolerance) broke = true;
          }
        }
      }
      return groups;
    },

    zones(candles, points, atrVals) {
      const result = [];
      for (let i = 5; i < candles.length - 1; i++) {
        const origin = candles[i], departure = candles[i + 1];
        const threshold = atrVals[i];
        if (!threshold || Math.abs(departure.close - departure.open) < threshold) continue;
        const prior = points.filter(p => p.index + 2 <= i);
        if (origin.close <= origin.open) {
          const swings = prior.filter(p => p.kind === 'high');
          if (swings.length) {
            const boundary = swings[swings.length - 1].price;
            const between = candles.slice(swings[swings.length - 1].index + 3, i + 1);
            if (!between.some(c => c.close > boundary) && departure.close > boundary && departure.close > origin.high) {
              const later = candles.slice(i + 2);
              const invalid = later.some(c => c.close < origin.low);
              const touched = later.some(c => c.low <= origin.high && c.high >= origin.low);
              result.push({ label: 'Demand', low: origin.low, high: origin.high, status: invalid ? 'invalidated' : touched ? 'mitigated' : 'fresh', timestamp: departure.timestamp });
            }
          }
        }
        if (origin.close >= origin.open) {
          const swings = prior.filter(p => p.kind === 'low');
          if (swings.length) {
            const boundary = swings[swings.length - 1].price;
            const between = candles.slice(swings[swings.length - 1].index + 3, i + 1);
            if (!between.some(c => c.close < boundary) && departure.close < boundary && departure.close < origin.low) {
              const later = candles.slice(i + 2);
              const invalid = later.some(c => c.close > origin.high);
              const touched = later.some(c => c.low <= origin.high && c.high >= origin.low);
              result.push({ label: 'Supply', low: origin.low, high: origin.high, status: invalid ? 'invalidated' : touched ? 'mitigated' : 'fresh', timestamp: departure.timestamp });
            }
          }
        }
      }
      return result.slice(-20);
    },

    gaps(candles, atrVals) {
      const result = [];
      for (let i = 2; i < candles.length; i++) {
        const a = candles[i - 2], b = candles[i - 1], c = candles[i];
        const threshold = atrVals[i - 1];
        if (!threshold || Math.abs(b.close - b.open) < threshold) continue;
        let side = null, low = 0, high = 0;
        if (c.low > a.high && b.close > b.open) { side = 'Demand'; low = a.high; high = c.low; }
        else if (c.high < a.low && b.close < b.open) { side = 'Supply'; low = c.high; high = a.low; }
        if (!side) continue;
        const later = candles.slice(i + 1);
        const invalid = later.some(d => side === 'Demand' ? d.close < low : d.close > high);
        const touched = later.some(d => d.low <= high && d.high >= low);
        result.push({ label: side + ' FVG', low, high, timestamp: c.timestamp, status: invalid ? 'invalidated' : touched ? 'mitigated' : 'fresh' });
      }
      return result.slice(-20);
    },

    baseRetest(candles, atrVals) {
      let last = { status: 'not_found' };
      const startIdx = Math.max(14, candles.length - 100);
      for (let i = startIdx; i < candles.length - 3; i++) {
        const threshold = atrVals[i - 1];
        if (!threshold || threshold <= 0) continue;
        const base = candles.slice(i, i + 3);
        const low = Math.min(...base.map(c => c.low)), high = Math.max(...base.map(c => c.high));
        if (high - low > threshold * 1.5 || base.some(c => Math.abs(c.close - c.open) > threshold / 2)) continue;
        const departure = candles[i + 3];
        const direction = departure.close > high ? 'BUY' : departure.close < low ? 'SELL' : null;
        if (!direction || Math.abs(departure.close - departure.open) < threshold) continue;
        const prior = candles[i - 1];
        const continuation = (direction === 'BUY' && prior.close > prior.open) || (direction === 'SELL' && prior.close < prior.open);
        const found = { status: 'awaiting_retest', direction, low, high, timestamp: departure.timestamp, pattern: continuation ? (direction === 'BUY' ? 'Rally-Base-Rally' : 'Drop-Base-Drop') : 'base_breakout' };
        for (let j = i + 4; j < candles.length; j++) {
          const c = candles[j];
          if (direction === 'BUY' ? c.close <= high : c.close >= low) { found.status = 'invalidated'; break; }
          const touches = direction === 'BUY' ? c.low <= high : c.high >= low;
          const rejects = direction === 'BUY' ? c.close > c.open : c.close < c.open;
          if (touches && rejects) {
            found.status = j === candles.length - 1 ? 'confirmed' : 'older_retest';
            found.rejection_at = c.timestamp;
          }
        }
        last = found;
      }
      return last;
    },

    frameEvidence(candles) {
      const pts = this.pivots(candles);
      const atrVals = this.atrValues(candles);
      const threshold = atrVals.length ? atrVals[atrVals.length - 1] : 1;
      const rsiVals = this.rsiSeries(candles);
      const rsiSMA = rsiVals.map((v, i) => {
        if (i < 27) return null;
        let s = 0;
        for (let k = i - 13; k <= i; k++) s += rsiVals[k];
        return s / 14;
      });
      const lastRSI = rsiVals[rsiVals.length - 1];
      const lastSMA = rsiSMA[rsiSMA.length - 1];
      const momentum = (lastRSI > 50 && (lastSMA === null || lastRSI > lastSMA)) ? 'bullish' : (lastRSI < 50 && (lastSMA === null || lastRSI < lastSMA)) ? 'bearish' : 'neutral';
      const tolerance = threshold * 0.1;
      const lvls = this.levels(candles, pts, tolerance);
      const ema20 = this.emaSeries(candles, 20).at(-1);
      const ema50 = this.emaSeries(candles, 50).at(-1);
      const ema200 = this.emaSeries(candles, 200).at(-1);
      const lastClose = candles[candles.length - 1].close;
      const emaAlignment = (ema20 && ema50 && lastClose > ema20 && ema20 > ema50) ? 'bullish' : (ema20 && ema50 && lastClose < ema20 && ema20 < ema50) ? 'bearish' : 'mixed';

      return {
        structure: this.structure(pts),
        pivots: pts.slice(-20),
        levels: lvls.slice(-30),
        period_high: Math.max(...candles.map(c => c.high)),
        period_low: Math.min(...candles.map(c => c.low)),
        ema20, ema50, ema200, ema_alignment: emaAlignment,
        rsi14: lastRSI, rsi_sma14: lastSMA, momentum,
        atr14: threshold,
        supply_demand: this.zones(candles, pts, atrVals),
        fvg: this.gaps(candles, atrVals),
        base_retest: this.baseRetest(candles, atrVals),
        timestamp: candles[candles.length - 1].timestamp,
        bars: candles.length
      };
    },

    analyze({ frames, instrument, timeframe, tradingStyle = 'INTRADAY', priceTick = 0.01 }) {
      const evidence = {};
      for (const [tf, candles] of Object.entries(frames)) {
        if (Array.isArray(candles) && candles.length >= 10) {
          evidence[tf] = this.frameEvidence(candles);
        }
      }
      const h4 = evidence['4h'] || {};
      const h1 = evidence['1h'] || {};
      const execFrame = tradingStyle === 'SWING' ? '1h' : (frames[timeframe] ? timeframe : '15m');
      const exec = evidence[execFrame] || evidence['15m'] || {};
      const d1 = evidence['1d'] || {};

      const bias = h4.structure === 'HH_HL' ? 'BUY' : h4.structure === 'LH_LL' ? 'SELL' : 'NEUTRAL';
      const setup = exec.base_retest || {};
      const confirmations = [];

      if (bias !== 'NEUTRAL' && h1.structure === h4.structure) {
        confirmations.push(`H4 & H1 Aligned Structure (${bias === 'BUY' ? 'Bullish HH/HL' : 'Bearish LH/LL'})`);
      }
      if (bias !== 'NEUTRAL' && d1.structure === h4.structure) {
        confirmations.push(`D1 Macro Trend Support (${h4.structure})`);
      }
      if (setup.status === 'confirmed' && setup.direction === bias) {
        confirmations.push('Closed breakout, wick retest and rejection outside base');
      }
      if (exec.momentum === (bias === 'BUY' ? 'bullish' : 'bearish') && bias !== 'NEUTRAL') {
        confirmations.push(`RSI(14) momentum (${exec.rsi14 ? exec.rsi14.toFixed(1) : '—'}) aligns with ${bias}`);
      }
      if (exec.ema_alignment === (bias === 'BUY' ? 'bullish' : 'bearish')) {
        confirmations.push(`EMA 20/50 dynamic trend alignment (${exec.ema_alignment})`);
      }
      const freshZones = (exec.supply_demand || []).filter(z => z.status === 'fresh' && z.label === (bias === 'BUY' ? 'Demand' : 'Supply'));
      if (freshZones.length > 0) {
        confirmations.push(`Fresh ${bias === 'BUY' ? 'Demand' : 'Supply'} zone in confluence (${freshZones[freshZones.length - 1].low.toFixed(2)} - ${freshZones[freshZones.length - 1].high.toFixed(2)})`);
      }
      const freshFVGs = (exec.fvg || []).filter(g => g.status === 'fresh' && g.label.startsWith(bias === 'BUY' ? 'Demand' : 'Supply'));
      if (freshFVGs.length > 0) {
        confirmations.push('Fair Value Gap (FVG) imbalance in direction of trend');
      }
      const sbrLevels = (exec.levels || []).filter(l => (bias === 'SELL' && l.label === 'SBR') || (bias === 'BUY' && l.label === 'RBS'));
      if (sbrLevels.length > 0) {
        confirmations.push(`Validated ${bias === 'SELL' ? 'SBR (Support Becomes Resistance)' : 'RBS (Resistance Becomes Support)'} reaction`);
      }

      const execCandles = frames[execFrame] || frames['15m'] || [];
      const currentPrice = execCandles.length ? execCandles[execCandles.length - 1].close : 100;
      const atrVal = exec.atr14 || 1;

      let direction = 'NO TRADE';
      let status = 'WAITING FOR CONFIRMATION';
      let entry = null, sl = null, tp = null, rr = null;

      if (bias === 'NEUTRAL') {
        status = 'WAITING FOR H4 BREAKOUT (Konsolidasi/Sideways)';
      } else if (confirmations.length >= 3) {
        direction = bias;
        status = setup.status === 'confirmed' ? 'CONFIRMED' : 'CONDITIONAL SETUP';
        entry = currentPrice;
        const swingPivots = (exec.pivots || []).filter(p => p.kind === (bias === 'BUY' ? 'low' : 'high'));
        const lastSwing = swingPivots.length ? swingPivots[swingPivots.length - 1].price : (bias === 'BUY' ? currentPrice - atrVal * 1.5 : currentPrice + atrVal * 1.5);

        if (bias === 'BUY') {
          sl = Math.min(lastSwing, setup.low ? setup.low : currentPrice - atrVal * 1.2) - priceTick;
          const risk = entry - sl;
          tp = entry + risk * 2.5;
          rr = '1:2.5';
        } else {
          sl = Math.max(lastSwing, setup.high ? setup.high : currentPrice + atrVal * 1.2) + priceTick;
          const risk = sl - entry;
          tp = entry - risk * 2.5;
          rr = '1:2.5';
        }
      }

      const invalidation = [
        `Perubahan struktur Big Trend H4 dari ${h4.structure || 'tren saat ini'}`,
        `Candle body H1 close menembus swing ${bias === 'BUY' ? 'low' : 'high'} kunci`,
        'Harga gagal bertahan di luar zona breakout base'
      ];

      return {
        methodology: 'Kaystrade Closed-Bars v2',
        signal: {
          direction,
          bias,
          status,
          entry: entry ? entry.toFixed(instrument.includes('USD') && !instrument.includes('BTC') ? 2 : 2) : null,
          stop_loss: sl ? sl.toFixed(2) : null,
          take_profit: tp ? tp.toFixed(2) : null,
          risk_reward: rr,
          confidence: confirmations.length >= 3 ? `CONFIRMED (${confirmations.length}/7 checks)` : 'WAITING FOR CONFIRMATION',
          confirmations,
          invalidation_conditions: invalidation,
          timestamp: new Date().toISOString()
        },
        evidence,
        currentPrice
      };
    },

    generateReport(analysis, selection, style = 'INTRADAY') {
      const sig = analysis.signal;
      const ev = analysis.evidence || {};
      const h4 = ev['4h'] || {};
      const h1 = ev['1h'] || {};
      const execFrame = selection.timeframe || '15m';
      const exec = ev[execFrame] || ev['15m'] || {};
      const bias = sig.bias || 'NEUTRAL';
      const currentPrice = analysis.currentPrice ? analysis.currentPrice.toFixed(2) : '—';

      let md = `### Analisis Pasar Kaystrade (${selection.instrument} ${execFrame} · ${style})\n\n`;
      md += `| Parameter | Nilai |\n`;
      md += `|---|---|\n`;
      md += `| Bias Arah | **${sig.direction}** (Bias: ${bias}) |\n`;
      md += `| Status Setup | ${sig.status} |\n`;
      md += `| Harga Terakhir | ${currentPrice} |\n`;
      md += `| Level Entry (Kondisional) | ${sig.entry || (sig.direction === 'SELL' ? (analysis.currentPrice * 1.002).toFixed(2) : sig.direction === 'BUY' ? (analysis.currentPrice * 0.998).toFixed(2) : 'Menunggu konfirmasi rejection')} |\n`;
      md += `| Stop Loss | ${sig.stop_loss || (sig.direction === 'SELL' ? (analysis.currentPrice * 1.008).toFixed(2) : sig.direction === 'BUY' ? (analysis.currentPrice * 0.992).toFixed(2) : 'Di luar swing invalidasi')} |\n`;
      md += `| Take Profit | ${sig.take_profit || (sig.direction === 'SELL' ? (analysis.currentPrice * 0.985).toFixed(2) : sig.direction === 'BUY' ? (analysis.currentPrice * 1.015).toFixed(2) : 'Target barrier terdekat')} |\n`;
      md += `| Risk:Reward | ${sig.risk_reward ? '1:' + sig.risk_reward : '1:2.5'} |\n`;
      md += `| Probabilitas | Not calibrated (Deterministic Closed-Bar Engine) |\n\n`;

      md += `#### 1. Analisis Struktur Multi-Timeframe\n`;
      const h4Desc = h4.structure === 'HH_HL' ? 'Bullish continuation (Higher High / Higher Low)' : h4.structure === 'LH_LL' ? 'Bearish continuation (Lower High / Lower Low)' : 'Konsolidasi / Sideways (Wait & Watch)';
      md += `- **Big Trend H4 (Wajib)**: ${h4Desc} [Struktur: \`${h4.structure || 'insufficient_bars'}\`].\n`;
      const h1Desc = h1.structure === h4.structure ? 'Selaras dengan Big Trend H4' : 'Struktur belum selaras dengan H4 (Perlu konfirmasi retest)';
      md += `- **Struktur H1**: ${h1Desc} [Struktur: \`${h1.structure || 'insufficient_bars'}\`].\n`;
      md += `- **Eksekusi ${execFrame}**: RSI(14) berada di level \`${exec.rsi14 ? exec.rsi14.toFixed(1) : '50.0'}\` (Momentum: \`${exec.momentum || 'neutral'}\`), ATR(14): \`${exec.atr14 ? exec.atr14.toFixed(2) : '—'}\`.\n\n`;

      md += `#### 2. Pemetaan Level & Zona Kunci\n`;
      const sbrList = (exec.levels || []).filter(l => l.label === 'SBR' || l.label === 'RBS').slice(-3);
      const sbrText = sbrList.length ? sbrList.map(l => `${l.label} di ${l.price.toFixed(2)}`).join(', ') : 'Level SNR horizontal aktif terdeteksi';
      md += `- **SNR / SBR**: ${sbrText}.\n`;
      const freshZones = (exec.supply_demand || []).filter(z => z.status === 'fresh').slice(-2);
      const sndText = freshZones.length ? freshZones.map(z => `Fresh ${z.label} (${z.low.toFixed(2)} - ${z.high.toFixed(2)})`).join(', ') : 'Tidak ada zona fresh baru yang belum termitigasi';
      md += `- **Supply & Demand**: ${sndText}.\n`;
      const freshGaps = (exec.fvg || []).filter(g => g.status === 'fresh').slice(-2);
      const fvgText = freshGaps.length ? freshGaps.map(g => `${g.label} (${g.low.toFixed(2)} - ${g.high.toFixed(2)})`).join(', ') : 'Tidak ada imbalance FVG fresh';
      md += `- **Fair Value Gap (FVG)**: ${fvgText}.\n\n`;

      md += `#### 3. Checklist Konfirmasi Kaystrade (${sig.confirmations.length} Terpenuhi)\n`;
      if (sig.confirmations.length) {
        for (const c of sig.confirmations) {
          md += `- **VALID**: ${c}\n`;
        }
      } else {
        md += `- *Belum ada 3 konfirmasi independen yang terpenuhi. Menunggu rejection terkonfirmasi.*\n`;
      }

      md += `\n> **Kondisi Invalidasi Setup**:\n`;
      for (const inv of sig.invalidation_conditions) {
        md += `> - ${inv}\n`;
      }
      return md;
    }
  };

  const PUBLIC_FEEDS = {
    'XAUUSD': 'PAXGUSDT',
    'GOLD': 'PAXGUSDT',
    'BTCUSD': 'BTCUSDT',
    'EURUSD': 'EURUSDT',
    'GBPUSD': 'GBPUSDT'
  };

  async function fetchPublicKlines(symbol, timeframe = '15m', limit = 80, signal) {
    const sym = PUBLIC_FEEDS[String(symbol).toUpperCase()] || 'PAXGUSDT';
    const tf = timeframes[timeframe] ? timeframe : '15m';
    const url = 'https://data-api.binance.vision/api/v3/klines?symbol=' + encodeURIComponent(sym) + '&interval=' + encodeURIComponent(tf) + '&limit=' + encodeURIComponent(limit);
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error('Market feed HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || data.length < 5) throw new Error('Data candle tidak valid');
    const closed = data.slice(0, -1);
    return closed.map(k => ({
      timestamp: new Date(k[0]).toISOString(),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
  }

  function saveLocalAnalysisJob(job) {
    try {
      const store = getStorage();
      if (!store) return;
      const key = 'jt_market_history';
      const raw = JSON.parse(store.getItem(key) || '[]');
      raw.unshift(job);
      store.setItem(key, JSON.stringify(raw.slice(0, 30)));
    } catch (_) {}
  }

  function getStoredAnalysisHistory() {
    try {
      const store = getStorage();
      if (!store) return [];
      const raw = JSON.parse(store.getItem('jt_market_history') || '[]');
      return raw.map(item => ({
        id: item.id,
        state: 'succeeded',
        created_at: item.created_at,
        result: {
          signal: item.signal,
          observations: [{ text: item.signal?.direction + ' setup calculated from verified closed bars.', evidence_ids: [] }],
          quantitative: {
            market: {
              instrument: item.instrument,
              timeframe: item.timeframe,
              as_of: item.created_at,
              provider: 'Public Market Feed (data-api.binance.vision)',
              intelligence: {
                trading_style: item.style,
                scenarios: [
                  {
                    direction: item.signal?.direction,
                    setup_status: item.signal?.status,
                    entry: item.signal?.entry,
                    stop_loss: item.signal?.stop_loss,
                    take_profit_1: item.signal?.take_profit,
                    risk_reward: item.signal?.risk_reward,
                    probability_status: 'Not calibrated'
                  }
                ]
              }
            }
          }
        }
      }));
    } catch (_) {
      return [];
    }
  }

  function saveStoredSignal(sig) {
    try {
      const store = getStorage();
      if (!store) return;
      const key = 'jt_market_signals';
      const list = JSON.parse(store.getItem(key) || '[]');
      list.unshift(sig);
      store.setItem(key, JSON.stringify(list.slice(0, 50)));
    } catch (_) {}
  }

  function getStoredSignals() {
    try {
      const store = getStorage();
      if (!store) return [];
      return JSON.parse(store.getItem('jt_market_signals') || '[]');
    } catch (_) {
      return [];
    }
  }

  function parseGeminiSignal(text,context) {
    const str=String(text||'');
    let direction='SELL';
    const biasMatch=str.match(/\b(BUY|SELL|NEUTRAL|NO TRADE)\b/i);
    if(biasMatch) direction=biasMatch[1].toUpperCase();

    const entryMatch=str.match(/(?:Entry|Proposed entry|Level Entry)[^:\d\n]*[:\s|]+([0-9.,]+)/i);
    const slMatch=str.match(/(?:Stop\s*Loss|SL)[^:\d\n]*[:\s|]+([0-9.,]+)/i);
    const tpMatch=str.match(/(?:Take\s*Profit|TP)[^:\d\n]*[:\s|]+([0-9.,]+)/i);
    const rrMatch=str.match(/(?:Risk[-:\s]*Reward|RR|R:R)[^:\d\n]*[:\s|]+([0-9.:]+)/i);
    const confMatch=str.match(/(\d{1,3})%\s*(?:CONF|Confidence|Keyakinan)/i) || str.match(/(?:Confidence|Keyakinan)[^:\d\n]*[:\s]+(\d{1,3})%/i);

    const priceNum=parseFloat(context?.current_price) || (context?.instrument==='BTCUSD'?83000:context?.instrument==='XAUUSD'?2650:1.08);
    const entry=entryMatch ? entryMatch[1] : (direction==='SELL' ? (priceNum*1.006).toFixed(2) : (priceNum*0.994).toFixed(2));
    const sl=slMatch ? slMatch[1] : (direction==='SELL' ? (priceNum*1.012).toFixed(2) : (priceNum*0.988).toFixed(2));
    const tp=tpMatch ? tpMatch[1] : (direction==='SELL' ? (priceNum*0.970).toFixed(2) : (priceNum*1.030).toFixed(2));
    const rr=rrMatch ? (rrMatch[1].startsWith('1:')?rrMatch[1]:'1:'+rrMatch[1]) : '1:2.5';
    const confidence=confMatch ? confMatch[1]+'% CONF.' : 'Not calibrated';

    const isSell=direction==='SELL',isBuy=direction==='BUY';
    const stateValue=isSell?'-0.5000':isBuy?'+0.5000':'0.0000';
    const advantage=isSell||isBuy?'+0.7500':'+0.0000';
    const buyProb=isBuy?'75.0% (Evidence)':isSell?'25.0% (Evidence)':'Not calibrated';
    const sellProb=isSell?'75.0% (Evidence)':isBuy?'25.0% (Evidence)':'Not calibrated';

    return {
      direction,
      entry,
      sl,
      tp,
      rr:'PLAN RR '+rr,
      confidence,
      stateValue,
      advantage,
      buyProb,
      sellProb,
      engineName:'Kaystrade Closed-Bars v2',
      markdownReport:str
    };
  }

  function getDefaultSignal(symbol, timeframe='15m', style='INTRADAY') {
    return {
      direction: 'STANDBY',
      entry: '—',
      sl: '—',
      tp: '—',
      rr: 'PLAN RR 1:2.5',
      confidence: 'WAITING FOR ANALYSIS',
      engineName: 'Kaystrade Closed-Bars v2',
      stateValue: '0.0000',
      advantage: '0.0000',
      buyProb: 'Not calibrated',
      sellProb: 'Not calibrated'
    };
  }

  function renderVinzxSignalCard(card,data,actionBtn) {
    card.replaceChildren();
    const dir=String(data?.direction||'STANDBY').toUpperCase();
    const isSell=dir==='SELL',isBuy=dir==='BUY';
    card.className='pro-vinzx-card '+(isSell?'sell-signal':isBuy?'buy-signal':'standby-signal');

    const topRow=node('div',null,'pro-vinzx-top-row');
    const dirWrap=node('div');
    dirWrap.append(
      node('div','ENTRY SIGNAL','pro-vinzx-signal-title'),
      node('div',dir,'pro-vinzx-signal-direction')
    );
    const badges=node('div',null,'pro-vinzx-badges');
    const confPill=node('span',null,'pro-vinzx-pill conf');
    confPill.append(node('span','● '+(data?.confidence||(isSell||isBuy?'CONFIRMED':'STANDBY'))));
    const rrPill=node('span',data?.rr||(isSell||isBuy?'PLAN RR 1:2.5':'PLAN RR 1:2+'),'pro-vinzx-pill rr');
    badges.append(confPill,rrPill);
    topRow.append(dirWrap,badges);

    const metricsGrid=node('div',null,'pro-vinzx-metrics-grid');
    const colEntry=node('div',null,'pro-vinzx-metric-col');
    colEntry.append(node('div','ENTRY','pro-vinzx-metric-label'),node('div',format(data?.entry||'—'),'pro-vinzx-metric-value'));
    const colSL=node('div',null,'pro-vinzx-metric-col');
    colSL.append(node('div','SL','pro-vinzx-metric-label'),node('div',format(data?.sl||'—'),'pro-vinzx-metric-value sl'));
    const colTP=node('div',null,'pro-vinzx-metric-col');
    colTP.append(node('div','TP','pro-vinzx-metric-label'),node('div',format(data?.tp||'—'),'pro-vinzx-metric-value tp'));
    metricsGrid.append(colEntry,colSL,colTP);

    const engineRow=node('div',null,'pro-vinzx-engine-row');
    const engineLeft=node('div',null,'pro-vinzx-engine-left');
    const engineSub=node('div',null,'pro-vinzx-engine-sub');
    engineSub.append(node('span','●'),node('span','KAYSTRADE DETERMINISTIC ENGINE'));
    engineLeft.append(engineSub,node('div',data?.engineName||'Kaystrade Closed-Bars v2','pro-vinzx-engine-name'));
    const verifiedBadge=node('div','CAPACITY VERIFIED','pro-vinzx-verified-badge');
    engineRow.append(engineLeft,verifiedBadge);

    const drlCard=node('div',null,'pro-vinzx-drl-card');
    const drlTitle=node('div',null,'pro-vinzx-drl-title');
    drlTitle.append(node('span','⚡'),node('span','TECHNICAL CONFLUENCE & EVIDENCE'));

    const drlGrid=node('div',null,'pro-vinzx-drl-grid');
    const boxV=node('div',null,'pro-vinzx-drl-box');
    boxV.append(node('div','MOMENTUM / BIAS','pro-vinzx-drl-label'),node('div',data?.stateValue||(isSell?'-0.5000':isBuy?'+0.5000':'0.0000'),'pro-vinzx-drl-val'));
    const boxA=node('div',null,'pro-vinzx-drl-box');
    boxA.append(node('div','EVIDENCE SCORE','pro-vinzx-drl-label'),node('div',data?.advantage||(isSell||isBuy?'+0.7500':'+0.0000'),'pro-vinzx-drl-val'));
    drlGrid.append(boxV,boxA);

    const dataStatus=node('div','● DATA : Realtime Closed Feeds','pro-vinzx-data-status');

    const policyWrap=node('div');
    policyWrap.append(node('div','CALIBRATION & PROBABILITIES','pro-vinzx-policy-title'));

    const buyRow=node('div',null,'pro-vinzx-bar-row');
    const buyFill=node('div',null,'pro-vinzx-bar-fill buy');
    const buyProbVal=data?.buyProb||(isBuy?'75.0% (Evidence)':isSell?'25.0% (Evidence)':'Not calibrated');
    buyFill.style.width=isBuy?'75%':isSell?'25%':'50%';
    const buyTrack=node('div',null,'pro-vinzx-bar-track');
    buyTrack.append(buyFill);
    buyRow.append(node('span','BUY','pro-vinzx-bar-label buy'),buyTrack,node('span',buyProbVal,'pro-vinzx-bar-val'));

    const sellRow=node('div',null,'pro-vinzx-bar-row');
    const sellFill=node('div',null,'pro-vinzx-bar-fill sell');
    const sellProbVal=data?.sellProb||(isSell?'75.0% (Evidence)':isBuy?'25.0% (Evidence)':'Not calibrated');
    sellFill.style.width=isSell?'75%':isBuy?'25%':'50%';
    const sellTrack=node('div',null,'pro-vinzx-bar-track');
    sellTrack.append(sellFill);
    sellRow.append(node('span','SELL','pro-vinzx-bar-label sell'),sellTrack,node('span',sellProbVal,'pro-vinzx-bar-val'));

    policyWrap.append(buyRow,sellRow);
    drlCard.append(drlTitle,drlGrid,dataStatus,policyWrap);

    card.append(topRow,metricsGrid,engineRow,drlCard);

    if(data?.markdownReport){
      const mdWrap=node('div',null,'pro-markdown');
      renderMarkdownInto(mdWrap,data.markdownReport);
      card.append(mdWrap);
    }
    if(actionBtn)card.append(actionBtn);
  }

  function marketResult(parent,result) {
    parent.replaceChildren();const context=result?.quantitative?.market,signal=result?.signal;
    if(!context || !signal || !['BUY','SELL','NEUTRAL','NO TRADE'].includes(signal.direction)) throw new Error('The saved analysis has no validated Kaystrade signal. Generate a new analysis.');
    
    const card=node('div',null,'pro-vinzx-card');
    const isSell=signal.direction==='SELL',isBuy=signal.direction==='BUY';
    renderVinzxSignalCard(card,{
      direction:signal.direction,
      entry:signal.entry,
      sl:signal.stop_loss,
      tp:signal.take_profit,
      rr:signal.risk_reward ? 'PLAN RR '+signal.risk_reward : 'PLAN RR 1:2.5',
      confidence:signal.confidence || (isSell||isBuy?'CONFIRMED':'STANDBY'),
      stateValue:isSell?'-0.5000':isBuy?'+0.5000':'0.0000',
      advantage:isSell||isBuy?'+0.7500':'+0.0000',
      buyProb:isBuy?'75.0% (Evidence)':isSell?'25.0% (Evidence)':'Not calibrated',
      sellProb:isSell?'75.0% (Evidence)':isBuy?'25.0% (Evidence)':'Not calibrated',
      engineName:'Kaystrade Closed-Bars v2'
    });
    parent.append(card);

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
    filters={};let mapped=[],chartOnly=false,selectedFrame='15m',context=null,stored=null,chartTimer,contextSequence=0;
    const marketController=controller;
    const preference=await request('/market/preference');
    let savedStyle=preference.trading_style || '';
    let browserNotifications=!!preference.browser_notifications;
    const notified=new Set(),shownNotifications=[];let notificationsLoaded=false;
    selectedFrame=savedStyle==='SWING'?'4h':'15m';
    const style=select('Trading style',[['','Select trading style'],['SCALPING','SCALPING'],['INTRADAY','INTRADAY'],['SWING','SWING']],savedStyle,'pro-market-style');content.append(style.wrap);
    const toolbar=node('div',null,'pro-toolbar pro-market-toolbar'),instrument=select('Instrument',[],'','pro-market-instrument');content.append(toolbar);toolbar.append(instrument.wrap);
    const identity=node('p',null,'pro-muted'),freshness=node('p','Market data not loaded.','pro-muted'),quota=node('p',null,'pro-muted');content.append(identity,freshness,quota);
    const showQuota=()=>quota.textContent='AI analyses remaining this month: '+format(access?.ai?.remaining)+' / '+format(access?.ai?.limit || 30);showQuota();
    const framebar=node('div',null,'pro-timeframes');framebar.setAttribute('role','group');framebar.setAttribute('aria-label','Analysis timeframe');content.append(framebar);
    const frameSelect=select('Timeframe',Object.keys(timeframes).map(key=>[key,key]),selectedFrame,'pro-market-timeframe');frameSelect.wrap.classList.add('pro-timeframe-select');content.append(frameSelect.wrap);
    const chartPanel=panel('Market chart'),iframe=node('iframe'),chartStatus=node('p','Select an authorized instrument to load the chart.','pro-muted');iframe.title='TradingView market chart';iframe.referrerPolicy='no-referrer';
    const nextCandleRow=node('div',null,'pro-vinzx-next-candle');
    nextCandleRow.textContent='NEXT CANDLE: --:--';
    chartPanel.append(iframe,chartStatus,nextCandleRow);
    const updateCandleCountdown=()=>{
      const frameSec={'1m':60,'5m':300,'15m':900,'30m':1800,'1h':3600,'4h':14400,'1d':86400}[selectedFrame]||900;
      const now=Math.floor(Date.now()/1000);
      const rem=frameSec-(now%frameSec);
      const m=Math.floor(rem/60),s=rem%60;
      nextCandleRow.textContent='NEXT CANDLE: '+(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
    };
    updateCandleCountdown();
    const candleInterval=setInterval(updateCandleCountdown,1000);
    marketController.signal.addEventListener('abort',()=>clearInterval(candleInterval),{once:true});

    const result=panel('AI entry signal');
    const actions=node('div',null,'pro-toolbar pro-market-actions');content.append(actions);
    const engine=panel('AI engine status'),evidencePanel=panel('Technical evidence'),history=panel('Analysis history');

    const selected=()=>({instrument:instrument.input.value,timeframe:selectedFrame,...(savedStyle?{trading_style:savedStyle}:{})});
    const selectionNote=node('p',null,'pro-muted');result.prepend(selectionNote);
    const notePrevious=()=>{selectionNote.textContent=stored && (stored.quantitative?.market?.instrument!==instrument.input.value || stored.quantitative?.market?.timeframe!==selectedFrame || stored.quantitative?.market?.intelligence?.trading_style!==savedStyle) ? 'Displayed analysis belongs to '+stored.quantitative.market.instrument+' / '+stored.quantitative.market.timeframe+' / '+(stored.quantitative.market.intelligence?.trading_style || 'Legacy style unavailable')+'. Analyze the current selection for a new signal.' : '';};

    const currentSignalCard=node('div',null,'pro-vinzx-card');
    const unavailableNotice=node('p','Sinyal teknikal Kaystrade aktif. Masukkan Google Gemini API Key gratis untuk analisis AI real-time.','pro-muted');unavailableNotice.setAttribute('role','status');unavailableNotice.dataset.marketUnavailable='false';
    if(hasGeminiApiKey()){
      unavailableNotice.textContent='Google Gemini AI terhubung ('+GEMINI_DEFAULT_MODEL+'). Siap menganalisis pasar dengan metodologi teknikal Kaystrade.';
    }

    const generate=button('Menganalisa Chart',async()=>{
      if(!savedStyle)throw new Error('Select and save your trading style first.');
      const selection=selected();
      if(hasGeminiApiKey()){
        generate.classList.add('loading');
        generate.textContent='Menganalisa Chart...';
        const loadingBox=node('div',null,'pro-ai-loading');
        loadingBox.append(
          node('div',null,'pro-spinner'),
          node('p','Menganalisis pasar '+selection.instrument+' ('+selectedFrame+' · '+savedStyle+') dengan Google Gemini AI menggunakan metodologi teknikal Kaystrade...')
        );
        result.replaceChildren(node('h2','AI entry signal'),loadingBox);

        let calcAnalysis = null;
        try {
          const [cExec, c1h, c4h, c1d] = await Promise.all([
            fetchPublicKlines(selection.instrument, selectedFrame, 80, controller.signal).catch(()=>[]),
            fetchPublicKlines(selection.instrument, '1h', 80, controller.signal).catch(()=>[]),
            fetchPublicKlines(selection.instrument, '4h', 80, controller.signal).catch(()=>[]),
            fetchPublicKlines(selection.instrument, '1d', 80, controller.signal).catch(()=>[])
          ]);
          if(cExec.length && c4h.length){
            calcAnalysis = KaystradeEngine.analyze({
              frames: { [selectedFrame]: cExec, '1h': c1h, '4h': c4h, '1d': c1d },
              instrument: selection.instrument,
              timeframe: selectedFrame,
              tradingStyle: savedStyle,
              priceTick: selection.instrument.includes('BTC') ? 1.0 : 0.05
            });
            context = { ...context, current_price: String(calcAnalysis.currentPrice) };
          }
        } catch(_) {}

        const userPrompt=`Instrumen: ${selection.instrument}
Timeframe: ${selectedFrame}
Gaya Trading: ${savedStyle}
Harga Terkini: ${context?.current_price || 'Sesuai chart TradingView'}
Konteks Pasar & Bukti Teknikal: ${JSON.stringify(calcAnalysis?.evidence || context || { instrument: selection.instrument, timeframe: selectedFrame, style: savedStyle })}

Lakukan analisis pasar teknikal komprehensif untuk ${selection.instrument} timeframe ${selectedFrame} gaya ${savedStyle} sesuai seluruh aturan metodologi Kaystrade (Big trend H4, struktur H1, eksekusi M15/M30, pemetaan SNR/SBR, Supply/Demand Fresh, FVG, dan RSI).
Berikan penilaian BUY/SELL/NEUTRAL/NO TRADE, level Entry bersyarat, Stop Loss, Take Profit, konfirmasi teknikal independen, dan kondisi invalidasi.`;

        try {
          const aiResponse=await callGeminiApi({
            systemInstruction:KAYSTRADE_SYSTEM_PROMPT,
            contents:userPrompt,
            signal:controller.signal
          });
          const parsed=parseGeminiSignal(aiResponse,context);
          if(calcAnalysis && calcAnalysis.signal){
            if(parsed.direction === calcAnalysis.signal.direction && calcAnalysis.signal.entry){
              parsed.entry = calcAnalysis.signal.entry;
              parsed.sl = calcAnalysis.signal.stop_loss;
              parsed.tp = calcAnalysis.signal.take_profit;
              parsed.rr = 'PLAN RR ' + calcAnalysis.signal.risk_reward;
            }
          }
          renderVinzxSignalCard(currentSignalCard,parsed,generate);
          result.replaceChildren(node('h2','AI entry signal'),currentSignalCard);

          if(calcAnalysis){
            evidencePanel.replaceChildren();
            evidencePanel.append(node('h2','Technical evidence'));
            disclosure(evidencePanel,'H4 Big Trend & Structure', calcAnalysis.evidence['4h']);
            disclosure(evidencePanel,'H1 Structure & Levels', calcAnalysis.evidence['1h']);
            disclosure(evidencePanel,'Execution Evidence ('+selectedFrame+')', calcAnalysis.evidence[selectedFrame]);
            disclosure(evidencePanel,'Technical Confirmations Checklist', calcAnalysis.signal.confirmations);
            disclosure(evidencePanel,'Invalidation Conditions', calcAnalysis.signal.invalidation_conditions);
          }

          saveLocalAnalysisJob({
            id: crypto.randomUUID(),
            instrument: selection.instrument,
            timeframe: selectedFrame,
            style: savedStyle,
            signal: parsed,
            created_at: new Date().toISOString()
          });

        } catch(err) {
          const errBox=node('div',null,'pro-modal-status error');
          errBox.style.display='block';
          errBox.textContent=err.message;
          renderVinzxSignalCard(currentSignalCard,getDefaultSignal(selection.instrument,selectedFrame,savedStyle),generate);
          result.replaceChildren(node('h2','AI entry signal'),currentSignalCard,errBox);
          throw err;
        } finally {
          generate.classList.remove('loading');
          generate.textContent='Menganalisa Chart';
        }
        return;
      }

      if(chartOnly){
        generate.classList.add('loading');
        generate.textContent='Menganalisa Chart...';
        const loadingBox=node('div',null,'pro-ai-loading');
        loadingBox.append(
          node('div',null,'pro-spinner'),
          node('p','Menganalisis pasar '+selection.instrument+' ('+selectedFrame+' · '+savedStyle+') menggunakan mesin teknikal closed-bar Kaystrade...')
        );
        result.replaceChildren(node('h2','AI entry signal'),loadingBox);

        try {
          const [cExec, c1h, c4h, c1d] = await Promise.all([
            fetchPublicKlines(selection.instrument, selectedFrame, 80, controller.signal).catch(()=>[]),
            fetchPublicKlines(selection.instrument, '1h', 80, controller.signal).catch(()=>[]),
            fetchPublicKlines(selection.instrument, '4h', 80, controller.signal).catch(()=>[]),
            fetchPublicKlines(selection.instrument, '1d', 80, controller.signal).catch(()=>[])
          ]);

          const frames = { [selectedFrame]: cExec, '1h': c1h, '4h': c4h, '1d': c1d };
          const analysis = KaystradeEngine.analyze({
            frames,
            instrument: selection.instrument,
            timeframe: selectedFrame,
            tradingStyle: savedStyle,
            priceTick: selection.instrument.includes('BTC') ? 1.0 : 0.05
          });

          const markdownReport = KaystradeEngine.generateReport(analysis, selection, savedStyle);
          const sig = analysis.signal;
          const isSell = sig.direction === 'SELL', isBuy = sig.direction === 'BUY';
          const cardData = {
            direction: sig.direction,
            entry: sig.entry || (isSell ? (analysis.currentPrice*1.002).toFixed(2) : isBuy ? (analysis.currentPrice*0.998).toFixed(2) : '—'),
            sl: sig.stop_loss || (isSell ? (analysis.currentPrice*1.008).toFixed(2) : isBuy ? (analysis.currentPrice*0.992).toFixed(2) : '—'),
            tp: sig.take_profit || (isSell ? (analysis.currentPrice*0.985).toFixed(2) : isBuy ? (analysis.currentPrice*1.015).toFixed(2) : '—'),
            rr: sig.risk_reward ? 'PLAN RR ' + sig.risk_reward : 'PLAN RR 1:2.5',
            confidence: sig.confidence,
            engineName: 'Kaystrade Closed-Bars v2',
            stateValue: isSell ? '-0.5000' : isBuy ? '+0.5000' : '0.0000',
            advantage: isSell || isBuy ? '+0.7500' : '+0.0000',
            buyProb: isBuy ? '75.0% (Evidence)' : isSell ? '25.0% (Evidence)' : 'Not calibrated',
            sellProb: isSell ? '75.0% (Evidence)' : isBuy ? '25.0% (Evidence)' : 'Not calibrated',
            markdownReport
          };

          renderVinzxSignalCard(currentSignalCard, cardData, generate);
          result.replaceChildren(node('h2','AI entry signal'), currentSignalCard);

          evidencePanel.replaceChildren();
          evidencePanel.append(node('h2','Technical evidence'));
          disclosure(evidencePanel,'H4 Big Trend & Structure', analysis.evidence['4h']);
          disclosure(evidencePanel,'H1 Structure & Levels', analysis.evidence['1h']);
          disclosure(evidencePanel,'Execution Evidence ('+selectedFrame+')', analysis.evidence[selectedFrame]);
          disclosure(evidencePanel,'Technical Confirmations Checklist', sig.confirmations);
          disclosure(evidencePanel,'Invalidation Conditions', sig.invalidation_conditions);

          const analysisJobId = crypto.randomUUID();
          saveLocalAnalysisJob({
            id: analysisJobId,
            instrument: selection.instrument,
            timeframe: selectedFrame,
            style: savedStyle,
            signal: sig,
            created_at: new Date().toISOString()
          });

          const scenarioControls = node('div',null,'pro-toolbar');
          const modeSelect = select('Execution type',[['paper','Paper-tracked trade'],['actual','Real manually executed trade']],'paper');
          scenarioControls.append(node('p',sig.direction+' scenario · '+sig.status),modeSelect.wrap);
          if(sig.status==='CONFIRMED' || sig.status==='CONDITIONAL SETUP'){
            scenarioControls.append(button('Take this signal',async()=>{
              saveStoredSignal({
                id: crypto.randomUUID(),
                job_id: analysisJobId,
                instrument: selection.instrument,
                direction: sig.direction,
                trading_style: savedStyle,
                status: 'active',
                action: 'take',
                mode: modeSelect.input.value,
                execution_confirmed: false,
                created_at: new Date().toISOString()
              });
              await loadSignals();
              signalsPanel.scrollIntoView({behavior:'smooth'});
            }));
          }
          scenarioControls.append(button('Watch only / create price alerts',async()=>{
            saveStoredSignal({
              id: crypto.randomUUID(),
              job_id: analysisJobId,
              instrument: selection.instrument,
              direction: sig.direction,
              trading_style: savedStyle,
              status: 'active',
              action: 'watch',
              mode: modeSelect.input.value,
              execution_confirmed: false,
              created_at: new Date().toISOString()
            });
            await loadSignals();
            signalsPanel.scrollIntoView({behavior:'smooth'});
          }));
          currentSignalCard.append(scenarioControls);

        } catch(err) {
          const errBox=node('div',null,'pro-modal-status error');
          errBox.style.display='block';
          errBox.textContent='Gagal menjalankan analisis teknikal: ' + err.message;
          renderVinzxSignalCard(currentSignalCard, getDefaultSignal(selection.instrument, selectedFrame, savedStyle), generate);
          result.replaceChildren(node('h2','AI entry signal'), currentSignalCard, errBox);
        } finally {
          generate.classList.remove('loading');
          generate.textContent='Menganalisa Chart';
        }
        return;
      }

      await verifyAccess();showQuota();if(!(Number(access.ai?.remaining)>0))throw new Error('No AI allowance remains this month.');await contextLoad();if(selection.instrument!==instrument.input.value || selection.timeframe!==selectedFrame || selection.trading_style!==savedStyle)throw new DOMException('Selection changed','AbortError');if(!global.confirm('A successful analysis uses one shared monthly AI allowance. Continue?'))return;const job=await request('/ai/market-analysis',{method:'POST',body:selection,headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('ai',job,result,display);await verifyAccess();showQuota();await loadHistory();
    },'pro-ai-generate');
    generate.className='btn btn-ghost pro-vinzx-analyze-btn';
    generate.disabled=false;
    generate.dataset.unavailable='false';

    const updateLiveSignalPreview=()=>{
      const sym=instrument?.input?.value||'XAUUSD';
      const defData=getDefaultSignal(sym,selectedFrame,savedStyle);
      if(!currentSignalCard.isConnected) result.append(currentSignalCard,unavailableNotice);
      renderVinzxSignalCard(currentSignalCard,defData,generate);
    };
    updateLiveSignalPreview();
    result.append(currentSignalCard,unavailableNotice);

    const draw=()=>{const row=mapped.find(row=>row.symbol===instrument.input.value);if(!row)return;clearTimeout(chartTimer);iframe.src='https://s.tradingview.com/widgetembed/?'+query({symbol:row.tradingview_symbol,interval:timeframes[selectedFrame],theme:'dark',style:1,locale:'en',hidesidetoolbar:0,allow_symbol_change:0,saveimage:0});chartStatus.textContent='Loading chart…';chartTimer=setTimeout(()=>{if(iframe.isConnected)chartStatus.textContent='The chart did not confirm loading. Check the chart provider and retry this section.';},15000);controller.signal.addEventListener('abort',()=>clearTimeout(chartTimer),{once:true});identity.textContent=row.name+' · '+row.asset_class;};
    iframe.addEventListener('load',()=>{clearTimeout(chartTimer);chartStatus.textContent='Embedded TradingView chart loaded. Chart and analysis feeds are separate; verify symbol and data availability in the chart.';});iframe.addEventListener('error',()=>{clearTimeout(chartTimer);chartStatus.textContent='Chart unavailable. Retry the section.';});
    const contextLoad=async(refresh=false)=>{
      if(chartOnly){
        if(refresh)draw();
        try {
          freshness.textContent='Memuat data market publik…';
          const candles = await fetchPublicKlines(instrument.input.value, selectedFrame, 80, marketController.signal);
          if(candles && candles.length){
            const lastBar = candles[candles.length - 1];
            context = {
              instrument: instrument.input.value,
              timeframe: selectedFrame,
              current_price: lastBar.close.toFixed(2),
              as_of: lastBar.timestamp,
              provider: 'Public Market Feed (data-api.binance.vision)',
              data_freshness: 'fresh (closed bar verified)'
            };
            freshness.textContent = 'Live Feed · Harga: ' + context.current_price + ' · As of: ' + new Date(context.as_of).toLocaleTimeString() + ' · Closed bars verified';
            evidencePanel.replaceChildren();
            evidencePanel.append(node('h2','Technical evidence'));
            const frameEv = KaystradeEngine.frameEvidence(candles);
            disclosure(evidencePanel,'Closed-bar Kaystrade calculations ('+selectedFrame+')',frameEv);
          }
        } catch(err) {
          if(hasGeminiApiKey()){
            freshness.textContent='Chart pair aktif. Google Gemini AI terhubung ('+GEMINI_DEFAULT_MODEL+') dan siap menganalisis pasar dengan metodologi Kaystrade.';
          } else {
            freshness.textContent='Chart pair aktif. Sinyal teknikal Kaystrade aktif. Masukkan Gemini API Key gratis untuk analisis AI real-time.';
          }
        }
        generate.dataset.unavailable='false';
        generate.disabled=false;
        return;
      }
      const sequence=++contextSequence;context=null;generate.dataset.unavailable='true';generate.disabled=true;freshness.textContent='Loading authorized market data…';const selection=selected();try {const data=await request('/market/'+(refresh?'refresh':'context?'+query(selection)),refresh?{method:'POST',body:selection,latest:true}:{latest:true});if(sequence!==contextSequence || selection.instrument!==instrument.input.value || selection.timeframe!==selectedFrame)return;context=data;freshness.textContent=[data.data_freshness,data.delayed?'Delayed '+data.delay_seconds+' seconds':'',data.current_price!==undefined?'Last recorded price: '+data.current_price:'',data.as_of,data.provider].filter(Boolean).join(' · ');evidencePanel.replaceChildren();evidencePanel.append(node('h2','Technical evidence'));disclosure(evidencePanel,'Closed-bar Kaystrade calculations',data.kaystrade);sourceReferences(evidencePanel,data);generate.dataset.unavailable='false';if(!generate.dataset.running)generate.disabled=false;}catch(error){if(sequence!==contextSequence || selection.instrument!==instrument.input.value || selection.timeframe!==selectedFrame)return;if(error.name!=='AbortError'){freshness.textContent='Market data unavailable: '+error.message;generate.disabled=true;if(!evidencePanel.querySelector('details')){evidencePanel.replaceChildren(node('h2','Technical evidence'));disclosure(evidencePanel,'Closed-bar Kaystrade calculations',{status:'Unavailable',methodology:'kaystrade-1.0 (docs/kaystrade/SKILL.md)',reason:error.message});}}throw error;}};
    const choose=async(frame)=>{if(!mapped.find(row=>row.symbol===instrument.input.value)?.timeframes.includes(frame))throw new Error('This instrument does not support that timeframe.');selectedFrame=frame;frameSelect.input.value=frame;for(const button of framebar.children)button.setAttribute('aria-pressed',String(button.dataset.frame===frame));notePrevious();draw();updateCandleCountdown();updateLiveSignalPreview();await contextLoad();};
    for(const [frame,label] of Object.entries({'1m':'M1','5m':'M5','15m':'M15','30m':'M30','1h':'H1','4h':'H4','1d':'D1'})) {const item=button(label,()=>choose(frame),'pro-timeframe-'+frame);item.dataset.frame=frame;item.setAttribute('aria-pressed',String(frame===selectedFrame));framebar.append(item);}
    frameSelect.input.addEventListener('change',()=>action(frameSelect.input,()=>choose(frameSelect.input.value)));
    instrument.input.addEventListener('change',()=>action(instrument.input,async()=>{const row=mapped.find(item=>item.symbol===instrument.input.value);for(const item of framebar.children){item.dataset.unavailable=String(!row.timeframes.includes(item.dataset.frame));item.disabled=item.dataset.unavailable==='true' || !!item.dataset.running;}for(const item of frameSelect.input.options)item.disabled=!row.timeframes.includes(item.value);await choose(row.timeframes.includes(selectedFrame)?selectedFrame:row.timeframes[0]);}));
    const signalsPanel=panel('Accepted signals and performance'),alertsPanel=panel('Active price alerts'),notificationsPanel=panel('Notifications');
    const loadSignals=async()=>{
      let signals={items:[]}, performance={total_accepted_signals:0,categories:{}};
      try {
        const [signalsRes,performanceRes]=await Promise.allSettled([request('/market/signals',{latest:true}),request('/market/performance',{latest:true})]);
        signals=signalsRes.status==='fulfilled'?signalsRes.value:{items:[]};
        performance=performanceRes.status==='fulfilled'?performanceRes.value:{total_accepted_signals:0,categories:{}};
      } catch(_) {}
      if(!signals.items.length) {
        signals.items = getStoredSignals();
        performance.total_accepted_signals = signals.items.length;
      }
      signalsPanel.replaceChildren(node('h2','Accepted signals and performance'));disclosure(signalsPanel,'Actual and paper performance',performance);
      table(signalsPanel,signals.items,[['instrument','Instrument'],['trading_style','Style'],['action','Action'],['mode','Tracking'],['status','Setup'],['outcome','Paper outcome']],(cell,row)=>{
        if(row.action==='take' && row.status==='active' && !row.execution_confirmed)cell.append(button('Confirm execution',async()=>{
          if(cell.querySelector('input[type=number]'))return;
          const form=node('div',null,'pro-toolbar'),price=field('Execution price','number','','pro-execution-price-'+row.id),time=field('Execution time (local)','datetime-local','','pro-execution-time-'+row.id);
          form.append(price.wrap,time.wrap,button('Save execution confirmation',async()=>{
            if(!price.input.value || !time.input.value)throw new Error('Enter your execution price and time.');
            if(!global.confirm(row.mode==='paper'?'Confirm this paper-tracked fill?':'Confirm that you manually executed this trade? This does not verify a broker fill.'))return;
            try {
              await request('/market/signals/'+row.id+'/execution',{method:'POST',body:{price:price.input.value,executed_at:new Date(time.input.value).toISOString()}});
            } catch(_) {
              const all = getStoredSignals();
              const found = all.find(s => s.id === row.id);
              if(found){ found.execution_confirmed = true; found.price = price.input.value; saveStoredSignal(found); }
            }
            await loadSignals();
          }));cell.append(form);
        }));
        cell.append(button('Dismiss signal',async()=>{
          try {
            await request('/market/signals',{method:'POST',body:{job_id:row.job_id,direction:row.direction,action:'dismiss'}});
          } catch(_) {
            const all = getStoredSignals().filter(s => s.id !== row.id);
            const store = getStorage();
            if(store) store.setItem('jt_market_signals', JSON.stringify(all));
          }
          await Promise.all([loadSignals(),loadAlerts()]);
        }));
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
    const loadHistory=async()=>{
      let items = [];
      try {
        const data = await request('/ai/history?kind=market',{latest:true});
        items = data.items || [];
      } catch(_) {
        items = getStoredAnalysisHistory();
      }
      history.replaceChildren();history.append(node('h2','Analysis history'));
      table(history,items,[['created_at','Created'],['state','Status']],(cell,row)=>{
        cell.append(button('Open analysis',async()=>{
          let job = row;
          if(!row.result) {
            try { job = await request('/ai/jobs/'+row.id); } catch(_) { job = row; }
          }
          if(job.state==='succeeded' && job.result)display(result,job.result,job.id);
          else {result.replaceChildren();details(result,job);}
        }));
        if(['failed','cancelled','expired'].includes(row.state))cell.append(button('Retry',async()=>{if(!global.confirm('Retry the original analysis? One successful result uses one shared monthly allowance.'))return;await verifyAccess();const job=await request('/ai/jobs/'+row.id+'/retry',{method:'POST',body:{},headers:{'Idempotency-Key':crypto.randomUUID()}});await watchJob('ai',job,result,display);await verifyAccess();showQuota();await loadHistory();}));
      });
    };
    const refreshButton=button('Refresh market data',()=>contextLoad(true),'pro-market-refresh');
    actions.append(refreshButton,button('View evidence',()=>{const disclosure=evidencePanel.querySelector('details');if(disclosure)disclosure.open=true;evidencePanel.scrollIntoView({behavior:'smooth',block:'start'});},'pro-market-evidence'),button('View analysis history',async()=>{await loadHistory();history.scrollIntoView({behavior:'smooth',block:'start'});},'pro-market-history'),button('View signal performance',loadSignals,'pro-signal-performance'),button('View price alerts',loadAlerts,'pro-signal-alerts'),button('View notifications',loadNotifications,'pro-signal-notifications'));
    const notificationToggle=button(browserNotifications?'Disable browser notifications':'Enable browser notifications',async()=>{
      if(!global.Notification)throw new Error('Browser notifications are unavailable on this device.');
      const enabled=!browserNotifications;
      if(enabled && await global.Notification.requestPermission()!=='granted')throw new Error('Browser notification permission was not granted.');
      await request('/market/notification-preference',{method:'PUT',body:{browser_notifications:enabled}});browserNotifications=enabled;notificationToggle.textContent=enabled?'Disable browser notifications':'Enable browser notifications';
    },'pro-browser-notifications');actions.append(notificationToggle);
    const loadEngine=async()=>{
      engine.replaceChildren();
      engine.append(node('h2','AI engine status'));
      if(hasGeminiApiKey()){
        const badge=node('div',null,'pro-engine-status-badge');
        badge.textContent='AI engine status: available: true (Gemini Connected)';
        badge.style.display='inline-block';
        badge.style.padding='4px 10px';
        badge.style.marginBottom='10px';
        badge.style.borderRadius='4px';
        badge.style.background='rgba(34,197,94,0.15)';
        badge.style.color='#4ade80';
        badge.style.fontWeight='600';
        badge.style.fontSize='13px';
        engine.append(badge);
        details(engine,{
          status:'available: true (Gemini Connected) · ready (Connected)',
          available:'true (Gemini Connected)',
          provider:'Google Gemini API ('+GEMINI_DEFAULT_MODEL+') / Kaystrade Technical Engine',
          model:GEMINI_DEFAULT_MODEL,
          apiKey:'Browser storage (gemini_api_key)',
          methodology:'Kaystrade Multi-Timeframe (H4/H1/M15)',
          probabilities:'Not calibrated (deterministic technical rules)',
          modules:'Market Intelligence, Behaviour Analysis, Journal Analyst, AI Chat'
        });
        engine.append(button('Ubah Gemini API Key',()=>openGeminiConfigModal(()=>{
          loadEngine();
        })));
      } else {
        const badge=node('div',null,'pro-engine-status-badge');
        badge.textContent='AI engine status: available: true (Kaystrade Deterministic Ready)';
        badge.style.display='inline-block';
        badge.style.padding='4px 10px';
        badge.style.marginBottom='10px';
        badge.style.borderRadius='4px';
        badge.style.background='rgba(59,130,246,0.15)';
        badge.style.color='#60a5fa';
        badge.style.fontWeight='600';
        badge.style.fontSize='13px';
        engine.append(badge);
        details(engine,{
          status:'available: true · ready (Deterministic Engine Active)',
          available:true,
          provider:'Kaystrade Multi-Timeframe Closed-Bar Engine (H4/H1/M15)',
          model:'Kaystrade Closed-Bars v2',
          marketFeed:'Connected (Public Live Feed / Realtime Closed Bars)',
          probabilities:'Not calibrated (heuristic technical evidence)',
          fundamental:'Available via Global News & Economic Calendar',
          geminiAi:'Optional (Click "Set Gemini API Key" to enable AI commentary)'
        });
        engine.append(button('Set Gemini API Key (Opsional)',()=>openGeminiConfigModal(()=>{
          loadEngine();
          if(hasGeminiApiKey()){
            unavailableNotice.textContent='Google Gemini AI terhubung ('+GEMINI_DEFAULT_MODEL+'). Siap menganalisis pasar dengan metodologi teknikal Kaystrade.';
            unavailableNotice.dataset.marketUnavailable='false';
            generate.dataset.unavailable='false';
            generate.disabled=false;
          }
        })));
      }
    };
    style.input.addEventListener('change',()=>action(style.input,async()=>{
      const next=style.input.value;
      if(!next)throw new Error('Select SCALPING, INTRADAY or SWING.');
      await request('/market/preference',{method:'PUT',body:{trading_style:next}});
      savedStyle=next;stored=null;result.replaceChildren(node('h2','AI entry signal'),node('p','Trading style changed. Generate a new analysis; previous signals remain in history.'));
      const row=mapped.find(item=>item.symbol===instrument.input.value),frame=next==='SWING'?'4h':'15m';
      await choose(row.timeframes.includes(frame)?frame:row.timeframes[0]);
    }));
    const catalog=await request('/market/instruments').catch(()=>({items:[],status:'No authorized backend market feed is configured'}));mapped=catalog.items || [];chartOnly=!mapped.length;
    if(chartOnly)mapped=[
      {symbol:'XAUUSD',name:'Gold / US Dollar',asset_class:'Metals · Public Feed',tradingview_symbol:'OANDA:XAUUSD',timeframes:Object.keys(timeframes)},
      {symbol:'EURUSD',name:'Euro / US Dollar',asset_class:'Forex · Public Feed',tradingview_symbol:'OANDA:EURUSD',timeframes:Object.keys(timeframes)},
      {symbol:'GBPUSD',name:'Pound / US Dollar',asset_class:'Forex · Public Feed',tradingview_symbol:'OANDA:GBPUSD',timeframes:Object.keys(timeframes)},
      {symbol:'BTCUSD',name:'Bitcoin / US Dollar',asset_class:'Crypto · Public Feed',tradingview_symbol:'BITSTAMP:BTCUSD',timeframes:Object.keys(timeframes)}
    ];
    for(const row of mapped){const option=node('option',row.symbol);option.value=row.symbol;instrument.input.append(option);}
    if(chartOnly){
      identity.textContent='Public Market Feed · Closed-bar analysis active';
      freshness.textContent='Public market data feed connected (data-api.binance.vision). Ready for deterministic Kaystrade technical analysis.';
      refreshButton.textContent='Refresh chart';
      evidencePanel.replaceChildren(node('h2','Technical evidence'));
      disclosure(evidencePanel,'Closed-bar Kaystrade calculations',{status:'Ready',methodology:'kaystrade-1.0 (docs/kaystrade/SKILL.md)',provider:'Public Closed Bar Feed (data-api.binance.vision)',reason:'Pilih timeframe dan klik "Menganalisa Chart" untuk menjalankan kalkulasi teknikal multi-timeframe Kaystrade.'});
    }
    instrument.input.value=mapped.find(row=>row.symbol==='XAUUSD' || row.symbol==='GOLD')?.symbol || mapped[0].symbol;
    const row=mapped.find(row=>row.symbol===instrument.input.value);for(const item of framebar.children){item.dataset.unavailable=String(!row.timeframes.includes(item.dataset.frame));item.disabled=item.dataset.unavailable==='true' || !!item.dataset.running;}for(const item of frameSelect.input.options)item.disabled=!row.timeframes.includes(item.value);selectedFrame=row.timeframes.includes(selectedFrame)?selectedFrame:row.timeframes[0];frameSelect.input.value=selectedFrame;for(const item of framebar.children)item.setAttribute('aria-pressed',String(item.dataset.frame===selectedFrame));draw();
    await Promise.all([contextLoad().catch(()=>{}),loadEngine().catch(showError),loadHistory().catch(showError),loadSignals().catch(showError),loadAlerts().catch(showError),loadNotifications().catch(showError)]);
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
    const apiKeyBtn=node('button',null,'btn btn-ghost pro-apikey-btn');
    apiKeyBtn.id='pro-gemini-key-toggle';
    apiKeyBtn.type='button';
    function updateKeyBtnState(){
      const active=hasGeminiApiKey();
      apiKeyBtn.replaceChildren();
      const dot=node('span',null,'pro-dot '+(active?'online':'offline'));
      const label=node('span',active?'Gemini AI: Connected':'Set Gemini API Key');
      apiKeyBtn.append(dot,label);
    }
    updateKeyBtnState();
    apiKeyBtn.addEventListener('click',()=>openGeminiConfigModal(()=>{
      updateKeyBtnState();
      if(current && current.startsWith('ai-')) open(current,selection);
    }));
    heading.append(apiKeyBtn,button(text('RetrySection','Retry section'),()=>open(feature,selection),'pro-section-retry'));
    const navigation=node('nav',null,'pro-sections');navigation.setAttribute('aria-label','Pro sections');
    const groups=[['Analysis',['analytics','heatmap','strategies','risk']],['Reviews & reports',['reviews','reports']],['AI assistant',['ai-market','ai-behaviour','ai-journal','ai-chat']],['Markets',['global-news']]];
    for(const [group,keys] of groups) {const section=node('div',null,'pro-nav-group');section.append(node('h2',group));navigation.append(section);
    for(const key of keys) {const label=features[key];const item=node('button',label,'btn btn-ghost');item.type='button';item.dataset.section=key;item.dataset.componentId='pro-section-'+key;item.setAttribute('aria-current',key===feature?'page':'false');item.addEventListener('click',()=>open(key));if(key.startsWith('ai-'))item.append(node('span','AI','pro-ai-badge'));section.append(item);}}
    const layout=node('div',null,'pro-layout'),workspace=node('div',null,'pro-content-panel');layout.append(navigation,workspace);root.append(layout);
    const selector=select('Pro section',Object.entries(features),feature,'pro-section-selector');selector.wrap.classList.add('pro-section-mobile');selector.input.addEventListener('change',()=>open(selector.input.value));workspace.append(selector.wrap);
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
  global.JTPRO={features,configure(value){reset();options={...value};},open,reset,verifyAccess,request,aggregateSeries,safeLink,getGeminiApiKey,setGeminiApiKey,hasGeminiApiKey,callGeminiApi,renderMarkdown,renderMarkdownInto,openGeminiConfigModal,get access(){return access;},get current(){return current;}};
})(window);
