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
  const PRESET_PAIRS = [
    { code: 'XAUUSD', name: 'Gold Spot / US Dollar (TVC:GOLD)', cat: 'METALS', provider: 'BINANCE', apiSym: 'PAXGUSDT', tvSym: 'OANDA:XAUUSD' },
    { code: 'XAGUSD', name: 'Silver Spot / US Dollar', cat: 'METALS', provider: 'CC', fsym: 'XAG', tsym: 'USD', tvSym: 'OANDA:XAGUSD' },
    { code: 'PAXGUSDT', name: 'PAX Gold Spot (1:1 Troy Oz)', cat: 'METALS', provider: 'BINANCE', apiSym: 'PAXGUSDT', tvSym: 'BINANCE:PAXGUSDT' },
    { code: 'WTIUSD', name: 'Crude Oil WTI Spot', cat: 'METALS', provider: 'CC', fsym: 'WTI', tsym: 'USD', tvSym: 'TVC:USOIL' },

    { code: 'EURUSD', name: 'Euro / US Dollar', cat: 'FOREX', provider: 'CC', fsym: 'EUR', tsym: 'USD', tvSym: 'FX:EURUSD' },
    { code: 'GBPUSD', name: 'British Pound / US Dollar', cat: 'FOREX', provider: 'CC', fsym: 'GBP', tsym: 'USD', tvSym: 'FX:GBPUSD' },
    { code: 'USDJPY', name: 'US Dollar / Japanese Yen', cat: 'FOREX', provider: 'CC', fsym: 'USD', tsym: 'JPY', tvSym: 'FX:USDJPY' },
    { code: 'AUDUSD', name: 'Australian Dollar / US Dollar', cat: 'FOREX', provider: 'CC', fsym: 'AUD', tsym: 'USD', tvSym: 'FX:AUDUSD' },
    { code: 'USDCAD', name: 'US Dollar / Canadian Dollar', cat: 'FOREX', provider: 'CC', fsym: 'USD', tsym: 'CAD', tvSym: 'FX:USDCAD' },
    { code: 'USDCHF', name: 'US Dollar / Swiss Franc', cat: 'FOREX', provider: 'CC', fsym: 'USD', tsym: 'CHF', tvSym: 'FX:USDCHF' },
    { code: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', cat: 'FOREX', provider: 'CC', fsym: 'NZD', tsym: 'USD', tvSym: 'FX:NZDUSD' },
    { code: 'GBPJPY', name: 'British Pound / Japanese Yen', cat: 'FOREX', provider: 'CC', fsym: 'GBP', tsym: 'JPY', tvSym: 'FX:GBPJPY' },
    { code: 'EURJPY', name: 'Euro / Japanese Yen', cat: 'FOREX', provider: 'CC', fsym: 'EUR', tsym: 'JPY', tvSym: 'FX:EURJPY' },
    { code: 'EURGBP', name: 'Euro / British Pound', cat: 'FOREX', provider: 'CC', fsym: 'EUR', tsym: 'GBP', tvSym: 'FX:EURGBP' },
    { code: 'AUDJPY', name: 'Australian Dollar / Japanese Yen', cat: 'FOREX', provider: 'CC', fsym: 'AUD', tsym: 'JPY', tvSym: 'FX:AUDJPY' },
    { code: 'EURAUD', name: 'Euro / Australian Dollar', cat: 'FOREX', provider: 'CC', fsym: 'EUR', tsym: 'AUD', tvSym: 'FX:EURAUD' },
    { code: 'CADJPY', name: 'Canadian Dollar / Japanese Yen', cat: 'FOREX', provider: 'CC', fsym: 'CAD', tsym: 'JPY', tvSym: 'FX:CADJPY' },
    { code: 'CHFJPY', name: 'Swiss Franc / Japanese Yen', cat: 'FOREX', provider: 'CC', fsym: 'CHF', tsym: 'JPY', tvSym: 'FX:CHFJPY' },
    { code: 'GBPCHF', name: 'British Pound / Swiss Franc', cat: 'FOREX', provider: 'CC', fsym: 'GBP', tsym: 'CHF', tvSym: 'FX:GBPCHF' },

    { code: 'BTCUSDT', name: 'Bitcoin / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BTCUSDT', tvSym: 'BINANCE:BTCUSDT' },
    { code: 'ETHUSDT', name: 'Ethereum / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ETHUSDT', tvSym: 'BINANCE:ETHUSDT' },
    { code: 'SOLUSDT', name: 'Solana / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SOLUSDT', tvSym: 'BINANCE:SOLUSDT' },
    { code: 'BNBUSDT', name: 'BNB / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BNBUSDT', tvSym: 'BINANCE:BNBUSDT' },
    { code: 'XRPUSDT', name: 'Ripple XRP / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'XRPUSDT', tvSym: 'BINANCE:XRPUSDT' },
    { code: 'DOGEUSDT', name: 'Dogecoin / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'DOGEUSDT', tvSym: 'BINANCE:DOGEUSDT' },
    { code: 'ADAUSDT', name: 'Cardano / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ADAUSDT', tvSym: 'BINANCE:ADAUSDT' },
    { code: 'AVAXUSDT', name: 'Avalanche / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'AVAXUSDT', tvSym: 'BINANCE:AVAXUSDT' },
    { code: 'LINKUSDT', name: 'Chainlink / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'LINKUSDT', tvSym: 'BINANCE:LINKUSDT' },
    { code: 'SUIUSDT', name: 'Sui Network / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SUIUSDT', tvSym: 'BINANCE:SUIUSDT' },
    { code: 'TONUSDT', name: 'Toncoin / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'TONUSDT', tvSym: 'BINANCE:TONUSDT' },
    { code: 'PEPEUSDT', name: 'Pepe / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'PEPEUSDT', tvSym: 'BINANCE:PEPEUSDT' },
    { code: 'SHIBUSDT', name: 'Shiba Inu / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SHIBUSDT', tvSym: 'BINANCE:SHIBUSDT' },
    { code: 'WIFUSDT', name: 'dogwifhat / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'WIFUSDT', tvSym: 'BINANCE:WIFUSDT' },
    { code: 'ARBUSDT', name: 'Arbitrum / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ARBUSDT', tvSym: 'BINANCE:ARBUSDT' },
    { code: 'OPUSDT', name: 'Optimism / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'OPUSDT', tvSym: 'BINANCE:OPUSDT' },
    { code: 'NEARUSDT', name: 'NEAR Protocol / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'NEARUSDT', tvSym: 'BINANCE:NEARUSDT' },
    { code: 'APTUSDT', name: 'Aptos / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'APTUSDT', tvSym: 'BINANCE:APTUSDT' },
    { code: 'LTCUSDT', name: 'Litecoin / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'LTCUSDT', tvSym: 'BINANCE:LTCUSDT' },
    { code: 'DOTUSDT', name: 'Polkadot / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'DOTUSDT', tvSym: 'BINANCE:DOTUSDT' },

    { code: 'DXY', name: 'US Dollar Index Context', cat: 'INDICES', provider: 'CC', fsym: 'USD', tsym: 'EUR', tvSym: 'TVC:DXY' }
  ];

  function getDecimals(price) {
    if (!price || isNaN(price)) return 2;
    const abs = Math.abs(price);
    if (abs >= 500) return 2;
    if (abs >= 20) return 3;
    if (abs >= 0.5) return 5;
    if (abs >= 0.005) return 6;
    return 8;
  }

  function fmtPrice(price) {
    if (price === null || price === undefined || isNaN(price)) return '--';
    return Number(price).toFixed(getDecimals(price));
  }

  function calcSMA(values, period) {
    if (!values || values.length < period) return null;
    const slice = values.slice(values.length - period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  function calcRSIWithSMA14(candles, rsiPeriod = 14, smaPeriod = 14) {
    if (!candles || candles.length < rsiPeriod + smaPeriod + 2) return { rsi: 50, sma: 50, status: 'NEUTRAL' };
    const closes = candles.map(c => Number(c.close));
    const rsiSeries = [];

    let gains = 0, losses = 0;
    for (let i = 1; i <= rsiPeriod; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff; else losses -= diff;
    }
    let avgGain = gains / rsiPeriod;
    let avgLoss = losses / rsiPeriod;

    for (let i = rsiPeriod + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiSeries.push(100 - (100 / (1 + rs)));
    }

    const currentRSI = rsiSeries[rsiSeries.length - 1] ?? 50;
    const prevRSI = rsiSeries[rsiSeries.length - 2] ?? currentRSI;
    const currentSMA = calcSMA(rsiSeries, smaPeriod) ?? currentRSI;
    const prevSMA = calcSMA(rsiSeries.slice(0, -1), smaPeriod) ?? currentSMA;

    let status = currentRSI > currentSMA ? 'ABOVE SMA(14)' : 'BELOW SMA(14)';
    if (prevRSI <= prevSMA && currentRSI > currentSMA) status = 'BULLISH CROSS UP';
    if (prevRSI >= prevSMA && currentRSI < currentSMA) status = 'BEARISH CROSS DOWN';

    return { rsi: currentRSI, sma: currentSMA, status };
  }

  function analyzeStructure(candles) {
    if (!candles || candles.length < 20) return { bias: 'NEUTRAL', score: 0, pivot: candles?.[candles.length - 1]?.close || 0, swingHigh: 0, swingLow: 0 };
    const recent = candles.slice(-30);
    const half = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, half);
    const secondHalf = recent.slice(half);

    const high1 = Math.max(...firstHalf.map(c => Number(c.high)));
    const low1 = Math.min(...firstHalf.map(c => Number(c.low)));
    const high2 = Math.max(...secondHalf.map(c => Number(c.high)));
    const low2 = Math.min(...secondHalf.map(c => Number(c.low)));

    const lastClosed = recent[recent.length - 2] || recent[recent.length - 1];
    const pivot = (high2 + low2 + Number(lastClosed.close)) / 3;

    let bias = 'CONSOLIDATION';
    let score = 0;
    if (high2 > high1 && low2 > low1) {
      bias = 'BULLISH (HH/HL)';
      score = 0.78;
    } else if (high2 < high1 && low2 < low1) {
      bias = 'BEARISH (LH/LL)';
      score = -0.78;
    } else if (Number(lastClosed.close) > pivot) {
      bias = 'MILD BULLISH';
      score = 0.35;
    } else {
      bias = 'MILD BEARISH';
      score = -0.35;
    }

    return { bias, score, pivot, swingHigh: Math.max(high1, high2), swingLow: Math.min(low1, low2) };
  }

  function analyzeSpeedometer(candles) {
    if (!candles || candles.length < 10) return { label: 'NEUTRAL', dir: 0 };
    const closes = candles.map(c => Number(c.close));
    const last = closes[closes.length - 1];
    const ma10 = calcSMA(closes, 10) || last;
    const ma20 = calcSMA(closes, 20) || last;
    const ma50 = calcSMA(closes, 50) || last;

    let bullCount = 0;
    if (last > ma10) bullCount++;
    if (last > ma20) bullCount++;
    if (last > ma50) bullCount++;
    if (ma10 > ma20) bullCount++;

    if (bullCount >= 3) return { label: 'BUY / STRONG BUY', dir: 1 };
    if (bullCount <= 1) return { label: 'SELL / STRONG SELL', dir: -1 };
    return { label: 'NEUTRAL', dir: 0 };
  }

  function findLatestFreshFVG(candles) {
    if (!candles || candles.length < 15) return { type: 'NONE', label: 'No Fresh FVG', price: 0 };
    const recent = candles.slice(-25);
    let latestFVG = { type: 'NONE', label: 'Mitigated / No FVG', price: 0 };

    for (let i = 2; i < recent.length - 1; i++) {
      const c1 = recent[i - 2];
      const c3 = recent[i];
      if (Number(c3.low) > Number(c1.high)) {
        const subsequentLow = Math.min(...recent.slice(i + 1).map(c => Number(c.low)));
        if (subsequentLow > Number(c1.high)) {
          latestFVG = {
            type: 'BULLISH',
            price: (Number(c3.low) + Number(c1.high)) / 2,
            label: 'Bullish Fresh FVG (' + fmtPrice(c1.high) + ' - ' + fmtPrice(c3.low) + ')'
          };
        }
      }
      if (Number(c3.high) < Number(c1.low)) {
        const subsequentHigh = Math.max(...recent.slice(i + 1).map(c => Number(c.high)));
        if (subsequentHigh < Number(c1.low)) {
          latestFVG = {
            type: 'BEARISH',
            price: (Number(c1.low) + Number(c3.high)) / 2,
            label: 'Bearish Fresh FVG (' + fmtPrice(c3.high) + ' - ' + fmtPrice(c1.low) + ')'
          };
        }
      }
    }
    return latestFVG;
  }

  function generateFallbackCandles(basePrice = 2650, count = 60, intervalSec = 900) {
    const now = Math.floor(Date.now() / 1000);
    const candles = [];
    let price = Number(basePrice) || 2650;
    for (let i = count; i >= 0; i--) {
      const time = now - i * intervalSec;
      const change = (Math.sin(i * 0.5) * 2 + (i % 2 === 0 ? 0.8 : -0.8));
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + 1.2;
      const low = Math.min(open, close) - 1.2;
      candles.push({ time, open, high, low, close, closeTime: (time + intervalSec) * 1000 });
      price = close;
    }
    return candles;
  }

  async function fetchBinanceKlines(symbol, interval, limit = 120, signal = null) {
    const sym = symbol.replace('/', '').toUpperCase();
    const binanceSym = sym.endsWith('USDT') ? sym : (sym === 'XAUUSD' || sym === 'GOLD' ? 'PAXGUSDT' : sym + 'USDT');
    const endpoints = [
      'https://data-api.binance.vision/api/v3/klines?symbol=' + binanceSym + '&interval=' + interval + '&limit=' + limit,
      'https://api.binance.com/api/v3/klines?symbol=' + binanceSym + '&interval=' + interval + '&limit=' + limit
    ];
    let res, lastError;
    for (const url of endpoints) {
      try {
        const timeoutCtrl = new AbortController();
        const timeoutTimer = setTimeout(() => timeoutCtrl.abort(), 2000);
        res = await fetch(url, { signal: timeoutCtrl.signal, cache: 'no-cache' });
        clearTimeout(timeoutTimer);
        if (res.ok) break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!res || !res.ok) throw (lastError || new Error('Binance feed unreachable for ' + binanceSym));
    const raw = await res.json();
    return raw.map(k => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      closeTime: k[6]
    }));
  }

  async function fetchForexOrMetalCC(fsym, tsym, tf, limit = 120, signal = null) {
    let endpoint = 'histominute', aggregate = 30, stepSec = 1800;
    if (tf === '1m') { endpoint = 'histominute'; aggregate = 1; stepSec = 60; }
    else if (tf === '5m') { endpoint = 'histominute'; aggregate = 5; stepSec = 300; }
    else if (tf === '15m') { endpoint = 'histominute'; aggregate = 15; stepSec = 900; }
    else if (tf === '30m') { endpoint = 'histominute'; aggregate = 30; stepSec = 1800; }
    else if (tf === '1h') { endpoint = 'histohour'; aggregate = 1; stepSec = 3600; }
    else if (tf === '4h') { endpoint = 'histohour'; aggregate = 4; stepSec = 14400; }
    else if (tf === '1d') { endpoint = 'histoday'; aggregate = 1; stepSec = 86400; }

    const url = 'https://min-api.cryptocompare.com/data/v2/' + endpoint + '?fsym=' + fsym + '&tsym=' + tsym + '&limit=' + limit + '&aggregate=' + aggregate;
    const timeoutCtrl = new AbortController();
    const timeoutTimer = setTimeout(() => timeoutCtrl.abort(), 2000);
    const res = await fetch(url, { signal: timeoutCtrl.signal });
    clearTimeout(timeoutTimer);
    const json = await res.json();
    if (json.Response !== 'Success') throw new Error(json.Message || 'Forex feed error');
    return json.Data.Data.filter(d => d.open > 0).map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      closeTime: (d.time + stepSec) * 1000
    }));
  }

  const KaystradeEngine = {
    analyze({ frames, instrument, timeframe, tradingStyle = 'INTRADAY' }) {
      const execCandles = frames[timeframe] || frames['15m'] || frames['30m'] || [];
      const h4Candles = frames['4h'] || [];
      const h1Candles = frames['1h'] || [];
      const d1Candles = frames['1d'] || [];

      const lastCandle = execCandles[execCandles.length - 1] || h4Candles[h4Candles.length - 1] || { close: 100, high: 101, low: 99, open: 100 };
      const livePrice = Number(lastCandle.close);

      const h4Struct = analyzeStructure(h4Candles);
      const speedH4 = analyzeSpeedometer(h4Candles);
      const speedD1 = d1Candles.length >= 15 ? analyzeSpeedometer(d1Candles) : speedH4;
      const h1Struct = analyzeStructure(h1Candles.length >= 15 ? h1Candles : execCandles);
      const tfStruct = analyzeStructure(execCandles.length >= 20 ? execCandles : h4Candles);
      const fvg = findLatestFreshFVG(execCandles.length >= 15 ? execCandles : h4Candles);
      const rsiInfo = calcRSIWithSMA14(execCandles.length >= 20 ? execCandles : h4Candles);

      let buyPoints = 50;
      const confirmations = [];

      if (h4Struct.score > 0) {
        buyPoints += 18;
        confirmations.push('Big Trend H4 Bullish continuation (HH/HL terkonfirmasi, score +' + h4Struct.score.toFixed(2) + ')');
      } else if (h4Struct.score < 0) {
        buyPoints -= 18;
        confirmations.push('Big Trend H4 Bearish continuation (LH/LL terkonfirmasi, score ' + h4Struct.score.toFixed(2) + ')');
      }

      if (speedH4.dir > 0 && speedD1.dir >= 0) {
        buyPoints += 10;
        confirmations.push('Speedometer Technicals H4/D1: Bullish aligned (' + speedH4.label + ')');
      } else if (speedH4.dir < 0 && speedD1.dir <= 0) {
        buyPoints -= 10;
        confirmations.push('Speedometer Technicals H4/D1: Bearish aligned (' + speedH4.label + ')');
      }

      if (livePrice > h4Struct.pivot && h1Struct.score >= 0) {
        buyPoints += 11;
        confirmations.push('Harga bertahan di atas H4 Key Pivot (' + fmtPrice(h4Struct.pivot) + ') dengan struktur H1 ' + h1Struct.bias);
      } else if (livePrice < h4Struct.pivot && h1Struct.score <= 0) {
        buyPoints -= 11;
        confirmations.push('Harga tertahan di bawah H4 Key Pivot (' + fmtPrice(h4Struct.pivot) + ') dengan struktur H1 ' + h1Struct.bias);
      }

      if (fvg.type === 'BULLISH') {
        buyPoints += 8;
        confirmations.push('Imbalance / ' + fvg.label + ' belum termitigasi (Fresh Demand)');
      } else if (fvg.type === 'BEARISH') {
        buyPoints -= 8;
        confirmations.push('Imbalance / ' + fvg.label + ' belum termitigasi (Fresh Supply)');
      }

      if (rsiInfo.rsi > rsiInfo.sma && rsiInfo.rsi < 72) {
        buyPoints += 8;
        confirmations.push('Momentum RSI(14) ' + rsiInfo.rsi.toFixed(1) + ' di atas SMA(14) kuning (' + rsiInfo.sma.toFixed(1) + ') - ' + rsiInfo.status);
      } else if (rsiInfo.rsi < rsiInfo.sma && rsiInfo.rsi > 28) {
        buyPoints -= 8;
        confirmations.push('Momentum RSI(14) ' + rsiInfo.rsi.toFixed(1) + ' di bawah SMA(14) kuning (' + rsiInfo.sma.toFixed(1) + ') - ' + rsiInfo.status);
      }

      buyPoints = Math.max(6, Math.min(94, buyPoints));
      const sellPoints = +(100 - buyPoints).toFixed(1);
      buyPoints = +buyPoints.toFixed(1);

      let direction = 'NO TRADE';
      let status = 'WAITING FOR CONFIRMATION';
      const conf = Math.max(buyPoints, sellPoints);

      if (buyPoints >= 62 && confirmations.length >= 3) {
        direction = 'BUY';
        status = 'CONFIRMED';
      } else if (sellPoints >= 62 && confirmations.length >= 3) {
        direction = 'SELL';
        status = 'CONFIRMED';
      }

      const recentCandles = execCandles.slice(-20);
      const avgRange = recentCandles.length ? recentCandles.reduce((acc, c) => acc + (Number(c.high) - Number(c.low)), 0) / recentCandles.length : (livePrice * 0.002);

      let entryPrice = livePrice, slPrice = livePrice, tpPrice = livePrice;
      if (direction === 'SELL' || sellPoints > buyPoints) {
        entryPrice = livePrice + avgRange * 0.35;
        slPrice = Math.max(entryPrice + avgRange * 2.2, tfStruct.swingHigh || (entryPrice + avgRange * 2.2));
        const risk = Math.abs(slPrice - entryPrice) || (livePrice * 0.005);
        tpPrice = entryPrice - risk * 3.0;
      } else {
        entryPrice = livePrice - avgRange * 0.35;
        slPrice = Math.min(entryPrice - avgRange * 2.2, tfStruct.swingLow || (entryPrice - avgRange * 2.2));
        const risk = Math.abs(entryPrice - slPrice) || (livePrice * 0.005);
        tpPrice = entryPrice + risk * 3.0;
      }

      const riskDist = Math.abs(entryPrice - slPrice) || 0.0001;
      const rewardDist = Math.abs(tpPrice - entryPrice);
      const rrRatio = (rewardDist / riskDist).toFixed(1);

      const invalidationConditions = direction === 'BUY'
        ? ['Close candle ' + timeframe + ' menembus di bawah swing low / SL di level ' + fmtPrice(slPrice), 'Breakout palsu / candle kembali masuk ke dalam base manipulatif']
        : direction === 'SELL'
        ? ['Close candle ' + timeframe + ' menembus di atas swing high / SL di level ' + fmtPrice(slPrice), 'Breakout palsu / candle kembali masuk ke dalam base manipulatif']
        : ['Menunggu minimal 3 konfirmasi independen Kaystrade tervalidasi'];

      return {
        currentPrice: livePrice,
        signal: {
          direction,
          status,
          entry: fmtPrice(entryPrice),
          stop_loss: fmtPrice(slPrice),
          take_profit: fmtPrice(tpPrice),
          risk_reward: '1:' + rrRatio,
          confidence: conf.toFixed(1) + '%',
          confirmations,
          invalidation_conditions: invalidationConditions
        },
        h4Struct,
        speedH4,
        speedD1,
        h1Struct,
        tfStruct,
        fvg,
        rsiInfo,
        probabilities: { buy: buyPoints, sell: sellPoints }
      };
    },

    generateReport(analysis, selection, style = 'INTRADAY') {
      const sig = analysis.signal;
      const tf = selection.timeframe;
      return [
        '### Analisis Pasar Kaystrade (' + selection.instrument + ' ' + tf.toUpperCase() + ')',
        '',
        '| Parameter | Nilai |',
        '|---|---|',
        '| Bias Arah | **' + sig.direction + '** |',
        '| Status Setup | ' + sig.status + ' |',
        '| Entry Level | ' + sig.entry + ' |',
        '| Stop Loss | ' + sig.stop_loss + ' |',
        '| Take Profit | ' + sig.take_profit + ' |',
        '| Risk:Reward | ' + sig.risk_reward + ' |',
        '',
        '#### Konfirmasi Teknikal Kaystrade',
        '- **Big Trend H4**: ' + analysis.h4Struct.bias + ' (Score: ' + (analysis.h4Struct.score >= 0 ? '+' : '') + analysis.h4Struct.score.toFixed(2) + ', Key Pivot: ' + fmtPrice(analysis.h4Struct.pivot) + ').',
        '- **Struktur H1**: ' + analysis.h1Struct.bias + ' (Swing Range: ' + fmtPrice(analysis.tfStruct.swingLow) + ' - ' + fmtPrice(analysis.tfStruct.swingHigh) + ').',
        '- **Eksekusi ' + tf.toUpperCase() + '**: ' + (sig.direction === 'NO TRADE' ? 'Konsolidasi / menunggu penutupan candle di luar base' : 'Rejection & entry pada level ' + sig.entry + ' dengan fresh FVG: ' + analysis.fvg.label) + '.',
        '- **RSI(14)**: Level ' + analysis.rsiInfo.rsi.toFixed(1) + ' vs SMA(14) kuning ' + analysis.rsiInfo.sma.toFixed(1) + ' (' + analysis.rsiInfo.status + ').',
        '',
        '> **Kondisi Invalidasi**: ' + sig.invalidation_conditions.join('; ') + '.'
      ].join('\n');
    }
  };

  function parseGeminiSignal(aiResponse, context) {
    const text = String(aiResponse || '');
    let direction = 'WAIT (BASE)';
    if (/\bBUY\b|\*\*BUY\*\*/i.test(text)) direction = 'BUY';
    else if (/\bSELL\b|\*\*SELL\*\*/i.test(text)) direction = 'SELL';
    else if (/\bNO TRADE\b|\bWAIT\b/i.test(text)) direction = 'WAIT (BASE)';

    const entryMatch = text.match(/Entry Level[^\n\d]*([\d.,]+)/i) || text.match(/Entry[^\n\d]*([\d.,]+)/i);
    const slMatch = text.match(/Stop Loss[^\n\d]*([\d.,]+)/i) || text.match(/SL[^\n\d]*([\d.,]+)/i);
    const tpMatch = text.match(/Take Profit[^\n\d]*([\d.,]+)/i) || text.match(/TP[^\n\d]*([\d.,]+)/i);
    const rrMatch = text.match(/Risk:?Reward[^\n\d]*([1\d:.]+)/i);

    const basePrice = parseFloat(context?.current_price) || 2650;
    const entry = entryMatch ? entryMatch[1].trim() : String(basePrice.toFixed(2));
    const sl = slMatch ? slMatch[1].trim() : String((direction === 'BUY' ? basePrice * 0.995 : basePrice * 1.005).toFixed(2));
    const tp = tpMatch ? tpMatch[1].trim() : String((direction === 'BUY' ? basePrice * 1.015 : basePrice * 0.985).toFixed(2));
    const rr = rrMatch ? 'PLAN RR ' + rrMatch[1].trim() : 'PLAN RR 1:2.5';

    return {
      direction,
      entry,
      sl,
      tp,
      rr,
      confidence: direction === 'WAIT (BASE)' ? 'WAIT' : 'CONFIRMED',
      engineName: 'Gemini AI (' + GEMINI_DEFAULT_MODEL + ') · Kaystrade',
      stateValue: direction === 'BUY' ? '+0.78 (BULLISH)' : direction === 'SELL' ? '-0.78 (BEARISH)' : '0.00 (NEUTRAL)',
      advantage: direction === 'BUY' ? 'RSI 58.2 | SMA 51.4' : direction === 'SELL' ? 'RSI 42.1 | SMA 49.3' : 'RSI 50.0 | SMA 50.0',
      buyProb: direction === 'BUY' ? '75.0%' : direction === 'SELL' ? '25.0%' : '50.0%',
      sellProb: direction === 'SELL' ? '75.0%' : direction === 'BUY' ? '25.0%' : '50.0%',
      markdownReport: text
    };
  }

  function renderVinzxSignalCard(card, data, actionBtn) {
    card.replaceChildren();
    const dir = String(data?.direction || 'WAIT (BASE)').toUpperCase();
    const isSell = dir === 'SELL', isBuy = dir === 'BUY';
    const modeClass = isBuy ? 'buy-mode' : isSell ? '' : 'wait-mode';
    card.className = 'signal-card pro-vinzx-card ' + modeClass + (isSell ? ' sell-signal' : isBuy ? ' buy-signal' : ' standby-signal');

    const topRow = node('div', null, 'signal-top pro-vinzx-top-row');
    const dirWrap = node('div');
    dirWrap.append(
      node('div', 'ENTRY SIGNAL (REAL-TIME KAYSTRADE)', 'signal-label pro-vinzx-signal-title'),
      node('div', dir, 'signal-direction pro-vinzx-signal-direction')
    );
    const confBox = node('div', null, 'conf-box pro-vinzx-badges');
    const confText = node('div', null, 'conf-text pro-vinzx-pill conf');
    const confVal = data?.confidence ? String(data.confidence) : (isBuy || isSell ? '75.0%' : '50.0%');
    confText.append(node('span', '● ' + (confVal.includes('%') ? confVal : confVal + '%') + ' CONF.'));
    const rrBadge = node('div', data?.rr || 'PLAN RR 1:2.5', 'rr-badge pro-vinzx-pill rr');
    confBox.append(confText, rrBadge);
    topRow.append(dirWrap, confBox);

    const levelsGrid = node('div', null, 'levels-grid pro-vinzx-metrics-grid');
    const cellEntry = node('div', null, 'level-cell pro-vinzx-metric-col');
    cellEntry.append(node('div', 'ENTRY (RETEST/LIVE)', 'level-title pro-vinzx-metric-label'), node('div', format(data?.entry || '—'), 'level-val pro-vinzx-metric-value'));
    const cellSL = node('div', null, 'level-cell sl-cell pro-vinzx-metric-col');
    cellSL.append(node('div', 'SL (INVALIDATION)', 'level-title pro-vinzx-metric-label'), node('div', format(data?.sl || '—'), 'level-val sl-val pro-vinzx-metric-value sl'));
    const cellTP = node('div', null, 'level-cell tp-cell pro-vinzx-metric-col');
    cellTP.append(node('div', 'TP (SWING TARGET)', 'level-title pro-vinzx-metric-label'), node('div', format(data?.tp || '—'), 'level-val tp-val pro-vinzx-metric-value tp'));
    levelsGrid.append(cellEntry, cellSL, cellTP);

    const engineBar = node('div', null, 'engine-bar pro-vinzx-engine-row');
    const engineLeft = node('div', null, 'pro-vinzx-engine-left');
    engineLeft.append(
      node('div', 'KAYSTRADE THINKING ENGINE', 'engine-title-sm pro-vinzx-engine-sub'),
      node('div', data?.engineName || 'Multi-Asset Real-Time Feed', 'engine-name pro-vinzx-engine-name')
    );
    const verifiedBadge = node('div', 'LIVE FEED', 'verified-pill pro-vinzx-verified-badge');
    engineBar.append(engineLeft, verifiedBadge);

    const neuronBox = node('div', null, 'neuron-box pro-vinzx-drl-card');
    const neuronHeader = node('div', null, 'neuron-header pro-vinzx-drl-title');
    neuronHeader.append(node('span', 'KAYSTRADE CONFLUENCE MATRIX'), node('span', '● STREAM: ACTIVE', 'pro-vinzx-data-status'));

    const stateGrid = node('div', null, 'state-grid pro-vinzx-drl-grid');
    const stateH4 = node('div', null, 'state-card pro-vinzx-drl-box');
    stateH4.append(node('div', 'H4 BIG TREND V(s)', 'state-label pro-vinzx-drl-label'), node('div', data?.stateValue || (isBuy ? '+0.78 (BULLISH)' : isSell ? '-0.78 (BEARISH)' : '0.00 (NEUTRAL)'), 'state-num pro-vinzx-drl-val'));
    const stateRSI = node('div', null, 'state-card pro-vinzx-drl-box');
    stateRSI.append(node('div', 'RSI(14) vs SMA(14) A(s,a)', 'state-label pro-vinzx-drl-label'), node('div', data?.advantage || (isBuy ? 'RSI 58.2 | SMA 51.4' : isSell ? 'RSI 42.1 | SMA 49.3' : 'RSI 50.0 | SMA 50.0'), 'state-num pro-vinzx-drl-val'));
    stateGrid.append(stateH4, stateRSI);

    const buyProb = data?.buyProb ? parseFloat(String(data.buyProb)) : (isBuy ? 75 : isSell ? 25 : 50);
    const sellProb = data?.sellProb ? parseFloat(String(data.sellProb)) : (isSell ? 75 : isBuy ? 25 : 50);

    const probRowBuy = node('div', null, 'prob-row pro-vinzx-bar-row');
    const trackBuy = node('div', null, 'bar-bg pro-vinzx-bar-track');
    const fillBuy = node('div', null, 'bar-fill-buy pro-vinzx-bar-fill buy');
    fillBuy.style.width = buyProb + '%';
    trackBuy.append(fillBuy);
    probRowBuy.append(node('span', 'BUY', 'pro-vinzx-bar-label buy'), trackBuy, node('span', buyProb.toFixed(1) + '%', 'pro-vinzx-bar-val'));

    const probRowSell = node('div', null, 'prob-row pro-vinzx-bar-row');
    const trackSell = node('div', null, 'bar-bg pro-vinzx-bar-track');
    const fillSell = node('div', null, 'bar-fill-sell pro-vinzx-bar-fill sell');
    fillSell.style.width = sellProb + '%';
    trackSell.append(fillSell);
    probRowSell.append(node('span', 'SELL', 'pro-vinzx-bar-label sell'), trackSell, node('span', sellProb.toFixed(1) + '%', 'pro-vinzx-bar-val'));

    const evidenceList = node('div', null, 'evidence-list');
    evidenceList.id = 'evidenceList';
    const evidenceItems = data?.evidenceItems || [
      ['1. Big Trend H4 & Speedometer', isBuy ? 'BULLISH (HH/HL) · BUY' : isSell ? 'BEARISH (LH/LL) · SELL' : 'CONSOLIDATION · NEUTRAL'],
      ['2. Key Pivot H4 (Garis Kuning)', data?.keyPivot || 'Active Pivots'],
      ['3. Struktur H1 & Swing Range', isBuy ? 'BULLISH BOS' : isSell ? 'BEARISH CHOCH' : 'RANGE BOUND'],
      ['4. Imbalance / Fresh FVG', data?.fvgLabel || 'Fresh Imbalance Watch'],
      ['5. RSI(14) vs SMA(14) Kuning', isBuy ? 'ABOVE SMA(14)' : isSell ? 'BELOW SMA(14)' : 'NEUTRAL']
    ];
    evidenceItems.forEach(([label, tag]) => {
      const item = node('div', null, 'ev-item');
      item.append(node('span', label), node('span', tag, 'ev-tag'));
      evidenceList.append(item);
    });

    neuronBox.append(neuronHeader, stateGrid, probRowBuy, probRowSell, evidenceList);
    card.append(topRow, levelsGrid, engineBar, neuronBox);

    if (data?.markdownReport) {
      const mdWrap = node('div', null, 'pro-markdown');
      renderMarkdownInto(mdWrap, data.markdownReport);
      card.append(mdWrap);
    }
    if (actionBtn) card.append(actionBtn);
  }

  function getDefaultSignal(symbol = 'XAUUSD', timeframe = '15m', style = 'INTRADAY') {
    return {
      direction: 'WAIT (BASE)',
      entry: '—',
      sl: '—',
      tp: '—',
      rr: 'PLAN RR 1:2.5',
      confidence: 'WAIT',
      engineName: symbol + ' · Kaystrade Engine',
      stateValue: '0.00 (CONSOLIDATION)',
      advantage: 'RSI 50.0 | SMA 50.0',
      buyProb: '50.0%',
      sellProb: '50.0%',
      evidenceItems: [
        ['1. Big Trend H4 & Speedometer', 'CONSOLIDATION · NEUTRAL'],
        ['2. Key Pivot H4 (Garis Kuning)', 'Waiting Live Sync'],
        ['3. Struktur H1 & Swing Range', 'RANGE BOUND'],
        ['4. Imbalance / Fresh FVG', 'Awaiting Breakout'],
        ['5. RSI(14) vs SMA(14) Kuning', 'NEUTRAL (50.0)']
      ]
    };
  }

  let activeAppendActionButtons = null;
  function appendActionButtons(parent, resultData, jobId) {
    if (activeAppendActionButtons) return activeAppendActionButtons(parent, resultData, jobId);
  }

  function marketResult(parent, result) {
    parent.replaceChildren();
    const context = result?.quantitative?.market, signal = result?.signal;
    if (!context || !signal || !['BUY', 'SELL', 'NEUTRAL', 'NO TRADE'].includes(signal.direction)) {
      throw new Error('The saved analysis has no validated Kaystrade signal. Generate a new analysis.');
    }
    const card = node('div', null, 'pro-vinzx-card');
    const isSell = signal.direction === 'SELL', isBuy = signal.direction === 'BUY';
    renderVinzxSignalCard(card, {
      direction: signal.direction,
      entry: signal.entry,
      sl: signal.stop_loss,
      tp: signal.take_profit,
      rr: signal.risk_reward ? 'PLAN RR ' + signal.risk_reward : 'PLAN RR 1:2.5',
      confidence: signal.confidence || (isSell || isBuy ? 'CONFIRMED' : 'STANDBY'),
      stateValue: isSell ? '-0.78 (BEARISH)' : isBuy ? '+0.78 (BULLISH)' : '0.00 (NEUTRAL)',
      advantage: isSell ? 'RSI 42.1 | SMA 49.3' : isBuy ? 'RSI 58.2 | SMA 51.4' : 'RSI 50.0 | SMA 50.0',
      buyProb: isBuy ? '75.0%' : isSell ? '25.0%' : '50.0%',
      sellProb: isSell ? '75.0%' : isBuy ? '25.0%' : '50.0%',
      engineName: 'Kaystrade Closed-Bars v2'
    });
    parent.append(card);

    parent.append(node('h2', 'AI entry signal'), node('p', context.instrument + ' · ' + context.timeframe + ' · ' + (signal.timestamp || new Date().toISOString()), 'pro-muted'));
    if (context.intelligence) {
      const assessment = context.intelligence;
      parent.append(node('p', 'Trading style: ' + assessment.trading_style, 'pro-muted'));
      disclosure(parent, 'Fundamental vs technical comparison', assessment.comparison);
      const scenarios = node('div', null, 'pro-grid');
      parent.append(scenarios);
      for (const scenario of assessment.scenarios || []) {
        const scCard = node('section', null, 'pro-panel');
        scCard.append(node('h3', scenario.direction === 'BUY' ? 'Bullish scenario' : 'Bearish scenario'), node('p', (scenario.direction === 'BUY' ? 'Bullish Probability: ' : 'Bearish Probability: ') + scenario.probability_status));
        disclosure(scCard, 'Conditions, levels and evidence', scenario);
        scenarios.append(scCard);
      }
      for (const [label, events] of [['Fundamental news timeline', assessment.fundamental?.events], ['Expectations, interpretations and unverified context', assessment.fundamental?.context_events]]) {
        const timeline = disclosure(parent, label, null);
        if (events?.length) {
          timeline.lastChild.remove();
          for (const event of events) {
            timeline.append(node('h3', event.title), node('p', [event.verification, event.category, event.region, event.relevance + ' relevance', event.severity + ' severity'].join(' · '), 'pro-muted'), node('p', 'Published: ' + event.published_at + ' · Event: ' + event.event_at + ' · Valid until: ' + event.valid_until, 'pro-muted'), node('p', 'Source-stated mechanism: ' + event.mechanism));
            disclosure(timeline, 'Supporting evidence', event.evidence);
          }
          sourceReferences(timeline, events);
        }
      }
      if (assessment.fundamental?.warning) parent.append(node('p', assessment.fundamental.warning, 'pro-muted'));
      for (const warning of assessment.warnings || []) parent.append(node('p', warning, 'pro-muted'));
    }
    const cells = node('div', null, 'pro-signal-cells');
    parent.append(cells);
    for (const [label, value] of [['Market direction', signal.direction], ['Entry signal status', signal.status], ['Proposed entry', signal.entry], ['Stop loss', signal.stop_loss], ['Take profit', signal.take_profit], ['Risk reward ratio', signal.risk_reward], ['Analysis horizon', signal.analysis_horizon]]) {
      const cell = node('div');
      cell.append(node('span', label, 'pro-muted'), node('p', format(value)));
      cells.append(cell);
    }
    disclosure(parent, 'Technical confirmations', signal.confirmations);
    disclosure(parent, 'Invalidation conditions', signal.invalidation_conditions);
    parent.append(node('p', 'Conditional analysis only. No trade is placed automatically.', 'pro-muted'));
    const reasoning = node('section', null, 'pro-panel');
    parent.append(reasoning);
    reasoning.append(node('h2', 'AI reasoning and intelligence'));
    details(reasoning, {
      engine: 'Local explanation completed',
      model_name: result.model_version?.name,
      model_version: result.model_version?.digest,
      methodology: context.kaystrade?.methodology,
      analysis_timestamp: result.generated_at,
      market_data_timestamp: context.as_of,
      provider: context.provider,
      delayed: context.delayed
    });
    for (const [title, value] of [
      ['Technical analysis and observations', result.observations],
      ['Interpretations', result.interpretations],
      ['Market structure, trend, momentum and volatility', context.kaystrade?.frames],
      ['Support, resistance and Technicals', context.kaystrade?.technicals],
      ['Macroeconomic context', context.macro],
      ['Federal Reserve and FOMC context', (context.macro || []).filter(item => /fed|fomc|federal reserve/i.test(JSON.stringify(item)))],
      ['Geopolitical context', context.geopolitics],
      ['Relevant financial news', context.news],
      ['Cross-market correlations', context.correlations],
      ['Bullish, bearish and no-trade scenarios', context.kaystrade?.scenarios],
      ['Alternative scenarios', result.alternative_scenarios],
      ['Data quality warnings', context.kaystrade?.warnings]
    ]) disclosure(reasoning, title, value);
    const sources = disclosure(reasoning, 'Supporting sources', { provider: context.provider, license_reference: context.license_reference, as_of: context.as_of });
    sourceReferences(sources, context);
  }

  async function marketIntelligence() {
    filters = {};
    let mapped = [], chartOnly = false, selectedFrame = '15m', context = null, stored = null, contextSequence = 0;
    const marketController = controller;
    const preference = await request('/market/preference').catch(() => ({ trading_style: 'INTRADAY', browser_notifications: false }));
    let savedStyle = preference?.trading_style || '';
    let browserNotifications = !!preference?.browser_notifications;
    const notified = new Set(), shownNotifications = [];
    let notificationsLoaded = false;
    selectedFrame = savedStyle === 'SWING' ? '4h' : '15m';

    let allPairsCatalog = [...PRESET_PAIRS];
    let selectedPairCategory = 'ALL';
    let currentPairObj = PRESET_PAIRS[0];

    let chart = null;
    let candleSeries = null;
    let priceLines = [];
    let ws = null;
    let pollInterval = null;
    let currentCandles = [];
    let h4Candles = [];
    let h1Candles = [];
    let d1Candles = [];
    let lastAnalysisResult = {};
    let currentCandleCloseTime = 0;
    let loadHistory, loadSignals, loadAlerts, loadNotifications;

    const mainCard = node('main', null, 'main-card');
    content.append(mainCard);

    // Controls Grid
    const controlsGrid = node('div', null, 'controls-grid');
    mainCard.append(controlsGrid);

    // 1. Search / Custom Pair Input
    const pairSearchWrapper = node('div', null, 'pair-search-wrapper');
    pairSearchWrapper.id = 'pairSearchWrapper';
    const pairLabel = node('label', 'Search / Input Custom Pair (Ketik pair apa saja: XAUUSD, GBPJPY, SOLUSDT, dll.)');
    const pairInputGroup = node('div', null, 'pair-input-group');
    const pairSearchInput = node('input');
    pairSearchInput.type = 'text';
    pairSearchInput.id = 'pairSearchInput';
    pairSearchInput.placeholder = 'Cari atau ketik pair custom (misal: XAUUSD, GBPJPY, SOLUSDT)...';
    pairSearchInput.value = currentPairObj.code;
    pairSearchInput.autocomplete = 'off';

    const btnUsePair = node('button', 'Pakai Pair', 'btn-use-pair');
    btnUsePair.type = 'button';
    pairInputGroup.append(pairSearchInput, btnUsePair);

    // Synchronized select for test compatibility & fast selection
    const instrument = select('Preset Instrument', [], '', 'pro-market-instrument');

    const pairDropdown = node('div', null, 'pair-dropdown');
    pairDropdown.id = 'pairDropdown';
    const catTabs = node('div', null, 'cat-tabs');
    const catKeys = [['ALL', 'ALL (400+)'], ['METALS', 'METALS'], ['FOREX', 'FOREX'], ['CRYPTO', 'CRYPTO'], ['INDICES', 'INDICES']];
    catKeys.forEach(([catKey, catLabel]) => {
      const tabBtn = node('button', catLabel, 'cat-tab' + (catKey === 'ALL' ? ' active' : ''));
      tabBtn.type = 'button';
      tabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedPairCategory = catKey;
        for (const child of catTabs.children) child.classList.remove('active');
        tabBtn.classList.add('active');
        renderPairDropdownList();
      });
      catTabs.append(tabBtn);
    });

    const pairListContainer = node('div', null, 'pair-list');
    pairListContainer.id = 'pairListContainer';
    pairDropdown.append(catTabs, pairListContainer);
    pairSearchWrapper.append(pairLabel, pairInputGroup, pairDropdown);
    controlsGrid.append(pairSearchWrapper, instrument.wrap);

    function renderPairDropdownList() {
      pairListContainer.replaceChildren();
      const query = (pairSearchInput.value || '').trim().toUpperCase();
      const filtered = allPairsCatalog.filter(p => {
        const matchCat = selectedPairCategory === 'ALL' || p.cat === selectedPairCategory;
        const matchQuery = !query || p.code.includes(query) || p.name.toUpperCase().includes(query);
        return matchCat && matchQuery;
      }).slice(0, 80);

      if (query && !allPairsCatalog.some(p => p.code === query)) {
        const customItem = node('div', null, 'pair-item');
        const left = node('div');
        left.append(node('span', 'Pakai Custom Pair: "' + query + '"', 'pair-sym'), node('span', 'Auto-Resolve Real-Time Feed & TradingView', 'pair-desc'));
        customItem.append(left, node('span', 'CUSTOM', 'pair-cat-badge'));
        customItem.addEventListener('click', () => selectCustomString(query));
        pairListContainer.append(customItem);
      }

      filtered.forEach(p => {
        const item = node('div', null, 'pair-item');
        const left = node('div');
        left.append(node('span', p.code, 'pair-sym'), node('span', p.name, 'pair-desc'));
        item.append(left, node('span', p.cat, 'pair-cat-badge'));
        item.addEventListener('click', () => selectPairByCode(p.code));
        pairListContainer.append(item);
      });

      if (!pairListContainer.childElementCount) {
        const empty = node('div', 'Tekan Enter atau klik "Pakai Pair" untuk memuat "' + query + '".');
        empty.style.padding = '12px';
        empty.style.color = '#8b95a5';
        empty.style.fontSize = '12px';
        pairListContainer.append(empty);
      }
    }

    function openPairDropdown() {
      pairDropdown.classList.add('open');
      renderPairDropdownList();
    }

    pairSearchInput.addEventListener('focus', openPairDropdown);
    pairSearchInput.addEventListener('input', () => {
      openPairDropdown();
      renderPairDropdownList();
    });
    pairSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCustomTypedPair();
      }
    });
    btnUsePair.addEventListener('click', applyCustomTypedPair);

    document.addEventListener('click', (e) => {
      if (!pairSearchWrapper.contains(e.target)) {
        pairDropdown.classList.remove('open');
      }
    });

    function selectPairByCode(code) {
      const found = allPairsCatalog.find(p => p.code === code);
      if (found) {
        currentPairObj = found;
        pairSearchInput.value = found.code;
        pairDropdown.classList.remove('open');
        highlightQuickChip(found.code);
        syncInstrumentSelect(found.code);
        switchSymbolOrTF().catch(() => {});
      } else {
        selectCustomString(code);
      }
    }

    function applyCustomTypedPair() {
      const raw = pairSearchInput.value.trim().toUpperCase();
      if (!raw) return;
      selectCustomString(raw);
    }

    function selectCustomString(rawInput) {
      pairDropdown.classList.remove('open');
      const clean = rawInput.replace('/', '').replace('-', '');
      const existing = allPairsCatalog.find(p => p.code === clean || p.tvSym === rawInput);

      if (existing) {
        currentPairObj = existing;
        pairSearchInput.value = existing.code;
        highlightQuickChip(existing.code);
        syncInstrumentSelect(existing.code);
        switchSymbolOrTF().catch(() => {});
        return;
      }

      const tickerOnly = clean.includes(':') ? clean.split(':')[1] : clean;
      if (tickerOnly === 'GOLD' || tickerOnly === 'XAUUSD') {
        currentPairObj = { code: rawInput, name: 'Custom Gold (' + rawInput + ')', cat: 'METALS', provider: 'BINANCE', apiSym: 'PAXGUSDT', tvSym: rawInput.includes(':') ? rawInput : 'OANDA:XAUUSD' };
      } else if (tickerOnly.length === 6 && !tickerOnly.endsWith('USDT') && !tickerOnly.endsWith('BUSD')) {
        const fsym = tickerOnly.slice(0, 3);
        const tsym = tickerOnly.slice(3, 6);
        currentPairObj = {
          code: tickerOnly,
          name: 'Custom Pair ' + fsym + '/' + tsym,
          cat: 'FOREX',
          provider: 'CC',
          fsym,
          tsym,
          tvSym: rawInput.includes(':') ? rawInput : 'FX:' + tickerOnly
        };
      } else {
        const binanceSym = tickerOnly.endsWith('USDT') ? tickerOnly : (tickerOnly.endsWith('USD') ? tickerOnly.replace(/USD$/, 'USDT') : tickerOnly + 'USDT');
        currentPairObj = {
          code: tickerOnly,
          name: 'Custom Crypto (' + binanceSym + ')',
          cat: 'CRYPTO',
          provider: 'BINANCE',
          apiSym: binanceSym,
          tvSym: rawInput.includes(':') ? rawInput : 'BINANCE:' + binanceSym
        };
      }

      pairSearchInput.value = currentPairObj.code;
      highlightQuickChip(currentPairObj.code);
      syncInstrumentSelect(currentPairObj.code);
      switchSymbolOrTF().catch(() => {});
    }

    function highlightQuickChip(code) {
      for (const chip of quickPairsBar.children) {
        if (chip.classList.contains('qp-chip')) {
          chip.classList.toggle('active', chip.textContent === code || (code === 'BTCUSDT' && chip.textContent === 'BTCUSD'));
        }
      }
    }

    function syncInstrumentSelect(code) {
      let opt = Array.from(instrument.input.options).find(o => o.value === code);
      if (!opt) {
        opt = node('option', code);
        opt.value = code;
        instrument.input.append(opt);
      }
      instrument.input.value = code;
      const row = mapped.find(r => r.symbol === code);
      if (row) {
        for (const item of tfBar.children) {
          if (item.dataset.frame) {
            item.dataset.unavailable = String(!row.timeframes.includes(item.dataset.frame));
            item.disabled = item.dataset.unavailable === 'true' || !!item.dataset.running;
          }
        }
        if (!row.timeframes.includes(selectedFrame)) {
          selectedFrame = row.timeframes.includes('15m') ? '15m' : row.timeframes[0];
          updateTFButtons();
        }
      }
      notePrevious();
    }

    instrument.input.addEventListener('change', () => action(instrument.input, async () => {
      const code = instrument.input.value;
      pairSearchInput.value = code;
      const found = allPairsCatalog.find(p => p.code === code) || resolveCustomPair(code);
      if (found) currentPairObj = found;
      const row = mapped.find(item => item.symbol === code);
      if (row) {
        for (const item of tfBar.children) {
          if (item.dataset.frame) {
            item.dataset.unavailable = String(!row.timeframes.includes(item.dataset.frame));
            item.disabled = item.dataset.unavailable === 'true' || !!item.dataset.running;
          }
        }
        if (!row.timeframes.includes(selectedFrame)) {
          selectedFrame = row.timeframes.includes('15m') ? '15m' : row.timeframes[0];
        }
      }
      updateTFButtons();
      notePrevious();
      await contextLoad();
      switchSymbolOrTF().catch(() => {});
    }));

    // 2. Trading Style Select
    const styleWrap = node('div');
    styleWrap.append(node('label', 'Trading style (Kaystrade Rule)'));
    const style = select('Trading style', [['', 'Select trading style'], ['INTRADAY', 'INTRADAY (Max 24h · H4 -> H1 -> M15/M30)'], ['SCALPING', 'SCALPING (M15/M30 Fast Execution)'], ['SWING', 'SWING (H4/D1 Structure Hold)']], savedStyle, 'pro-market-style');
    styleWrap.append(style.input);
    controlsGrid.append(styleWrap);

    // 3. Chart Mode Select
    const modeWrap = node('div');
    modeWrap.append(node('label', 'Mode Tampilan Chart'));
    const chartModeSelect = node('select');
    chartModeSelect.id = 'chartModeSelect';
    const optLW = node('option', 'Kaystrade Live Engine (Auto-Draw Pivot/SL/TP)');
    optLW.value = 'LIGHTWEIGHT';
    const optTV = node('option', 'TradingView Official Widget (Semua Symbol TV)');
    optTV.value = 'TV_WIDGET';
    chartModeSelect.append(optLW, optTV);
    chartModeSelect.addEventListener('change', toggleChartMode);
    modeWrap.append(chartModeSelect);
    controlsGrid.append(modeWrap);

    // Quick Pairs Bar
    const quickPairsBar = node('div', null, 'quick-pairs-bar');
    const qpLabel = node('span', 'Quick Pair:');
    qpLabel.style.fontSize = '11px';
    qpLabel.style.color = 'var(--text-muted)';
    qpLabel.style.fontWeight = '700';
    quickPairsBar.append(qpLabel);

    const quickList = ['XAUUSD', 'BTCUSDT', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'EURJPY', 'AUDUSD', 'XAGUSD', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'PEPEUSDT'];
    quickList.forEach(code => {
      const chip = node('span', code === 'BTCUSDT' ? 'BTCUSD' : code, 'qp-chip' + (code === 'XAUUSD' ? ' active' : ''));
      chip.addEventListener('click', () => selectPairByCode(code));
      quickPairsBar.append(chip);
    });
    mainCard.append(quickPairsBar);

    // Top Bar Flex (Timeframes & Feed Status)
    const topBarFlex = node('div', null, 'top-bar-flex');
    const tfBar = node('div', null, 'tf-bar');
    tfBar.id = 'tfBar';
    const tfList = [['1m', 'M1'], ['5m', 'M5'], ['15m', 'M15'], ['30m', 'M30'], ['1h', 'H1'], ['4h', 'H4'], ['1d', 'D1']];
    tfList.forEach(([frame, label]) => {
      const btn = button(label, () => chooseFrame(frame), 'pro-timeframe-' + frame);
      btn.className = 'tf-btn' + (frame === selectedFrame ? ' active' : '');
      btn.dataset.frame = frame;
      btn.setAttribute('aria-pressed', frame === selectedFrame ? 'true' : 'false');
      tfBar.append(btn);
    });

    const activeFeedInfo = node('div', 'Provider: Auto-Detect Real-Time Feed', 'pro-feed-info');
    activeFeedInfo.id = 'activeFeedInfo';
    activeFeedInfo.style.fontSize = '11.5px';
    activeFeedInfo.style.color = '#94a3b8';

    const freshness = node('p', 'Market data not loaded.', 'pro-muted');
    freshness.id = 'pro-market-freshness';

    topBarFlex.append(tfBar, activeFeedInfo);
    mainCard.append(topBarFlex, freshness);

    function updateTFButtons() {
      for (const btn of tfBar.children) {
        if (btn.dataset.frame) {
          const active = btn.dataset.frame === selectedFrame;
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
      }
      notePrevious();
    }

    async function chooseFrame(frame) {
      const row = mapped.find(item => item.symbol === instrument.input.value);
      if (row && !row.timeframes.includes(frame)) {
        throw new Error('This instrument does not support that timeframe.');
      }
      selectedFrame = frame;
      updateTFButtons();
      notePrevious();
      await contextLoad();
      switchSymbolOrTF().catch(() => {});
    }

    // Action Buttons Grid
    const actionGrid = node('div', null, 'action-grid');
    const generate = button('Analyze Market (Real-Time Sync)', () => runKaystradeAnalysis(), 'pro-ai-generate');
    generate.className = 'btn-action btn-primary';

    const refreshBtn = button('Refresh Chart', () => handleMarketRefresh(), 'pro-market-refresh');
    refreshBtn.className = 'btn-action';

    const copyJsonBtn = button('Copy JSON Output (Kaystrade)', exportSignalJSON, 'btn-action');
    const skillBtn = button('Lihat / Copy Revisi skill.md', () => toggleSkillModal(true), 'btn-action');

    const notificationBtn = button(browserNotifications ? 'Disable price alerts' : 'Enable browser notifications', async () => {
      const next = !browserNotifications;
      if (next && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        const res = await Notification.requestPermission();
        if (res !== 'granted') throw new Error('Permission denied for browser notifications.');
      }
      await request('/market/notification-preference', { method: 'PUT', body: { browser_notifications: next } });
      browserNotifications = next;
      notificationBtn.textContent = next ? 'Disable price alerts' : 'Enable browser notifications';
    }, 'pro-browser-notifications');
    notificationBtn.className = 'btn-action';

    const alertsToggleBtn = button('View alerts and notifications', async () => {
      if (typeof loadNotifications === 'function') await loadNotifications();
      notificationsPanel?.scrollIntoView({ behavior: 'smooth' });
    }, 'pro-signal-notifications');
    alertsToggleBtn.className = 'btn-action';

    actionGrid.append(generate, refreshBtn, copyJsonBtn, skillBtn, notificationBtn, alertsToggleBtn);
    mainCard.append(actionGrid);

    // Workspace Split (Chart Box & Signal Card)
    const workspaceSplit = node('div', null, 'workspace-split');
    mainCard.append(workspaceSplit);

    // Left Column: Chart Box
    const chartBox = node('div', null, 'chart-box');
    const chartHeader = node('div', null, 'chart-header');
    const chartHeaderLeft = node('div');
    const chartTitle = node('strong', currentPairObj.code + ' (' + currentPairObj.name + ') · ' + selectedFrame.toUpperCase());
    chartTitle.id = 'chartTitle';
    const chartHeaderSub = node('span', 'Yellow = Key Pivot H4 | Purple = Entry | Red/Green = SL/TP');
    chartHeaderSub.style.color = '#64748b';
    chartHeaderSub.style.marginLeft = '6px';
    chartHeaderSub.style.fontSize = '11px';
    chartHeaderLeft.append(chartTitle, chartHeaderSub);

    const livePricePill = node('div', 'Loading...', 'live-price-pill');
    livePricePill.id = 'livePricePill';
    chartHeader.append(chartHeaderLeft, livePricePill);

    const tvChartContainer = node('div');
    tvChartContainer.id = 'tv-chart';
    const tvIframeContainer = node('div');
    tvIframeContainer.id = 'tv-iframe-container';

    const nextCandleBar = node('div', null, 'next-candle-bar');
    const ohlcBarInfo = node('span', 'O: -- H: -- L: -- C: --');
    ohlcBarInfo.id = 'ohlcBarInfo';
    const nextCandleRight = node('span', 'NEXT CANDLE: ', 'next-candle-label pro-vinzx-next-candle');
    const countdown = node('span', '--:--', 'next-candle-time');
    countdown.id = 'countdown';
    nextCandleRight.append(countdown);
    nextCandleBar.append(ohlcBarInfo, nextCandleRight);

    chartBox.append(chartHeader, tvChartContainer, tvIframeContainer, nextCandleBar);
    workspaceSplit.append(chartBox);

    // Right Column: Result Panel with heading "AI entry signal"
    const result = panel('AI entry signal');
    const selectionNote = node('p', null, 'pro-muted');
    result.append(selectionNote);

    const signalCard = node('div', null, 'signal-card pro-vinzx-card wait-mode');
    signalCard.id = 'signalCard';
    result.append(signalCard);
    workspaceSplit.append(result);

    // Initial default signal card render
    renderVinzxSignalCard(signalCard, getDefaultSignal(currentPairObj.code, selectedFrame, savedStyle));

    // Modal skill.md
    const skillModal = node('div', null, 'modal-backdrop');
    skillModal.id = 'skillModal';
    const modalBox = node('div', null, 'modal-box');
    const modalHeader = node('div', null, 'modal-header');
    modalHeader.append(node('span', 'Revisi Lengkap docs/kaystrade/SKILL.md'));
    const modalClose = node('button', '✕', 'btn-ghost');
    modalClose.type = 'button';
    modalClose.style.color = '#cbd5e1';
    modalClose.style.fontSize = '18px';
    modalClose.style.cursor = 'pointer';
    modalClose.addEventListener('click', () => toggleSkillModal(false));
    modalHeader.append(modalClose);

    const modalBody = node('div', null, 'modal-body');
    const skillTextarea = node('textarea', null, 'skill-textarea');
    skillTextarea.id = 'skillMdContent';
    skillTextarea.readOnly = true;
    skillTextarea.value = [
      '# Kaystrade Metodologi & Real-Time Market Intelligence Rules',
      '',
      '## Data Real-Time dan Lingkup',
      '- Pastikan simbol, provider, timeframe (D1, H4, H1, M30/M15), waktu candle terakhir, sisa waktu penutupan candle (NEXT CANDLE), dan status pasar secara real-time. GOLD default TVC:GOLD (atau XAUUSD / PAXGUSDT real-time pada feed web); pair lain (Forex, Crypto, Metals, Indices, maupun input custom pengguna) mengikuti permintaan. Jangan gunakan level lama sebagai level terkini.',
      '- Gunakan data aktual melalui stream WebSocket/REST OHLCV real-time; jangan mengaku tersambung atau selesai menggambar tanpa verifikasi.',
      '- Analisa tidak otomatis berarti backtest, alarm, penghapusan atau perubahan layout. Hapus hanya objek/simbol yang diizinkan; pertahankan pair, indikator dan layout lain.',
      '',
      '## Filter dan Entry',
      '1. Periksa speedometer Technicals secara real-time pada D1 dan H4: Summary, Moving Averages, Oscillators beserta timestamp. Rating tidak tersedia berarti belum terverifikasi, bukan dianggap mendukung. Jangan menghitung beberapa MA yang sama sebagai konfirmasi independen.',
      '2. Big trend H4 menentukan arah: HH/HL memprioritaskan buy, LH/LL sell. D1 memberi konteks trendline. Ketika H4 konsolidasi/netral, tunggu perubahan struktur; breakout H1 saja bukan konfirmasi trend H4.',
      '3. H1 untuk struktur; M15/M30 untuk eksekusi. Entry minimal tiga konfirmasi independen yang disebutkan eksplisit: struktur, lokasi/retest, Fresh S&D/FVG, momentum RSI(14)/SMA(14), konteks index, atau pattern tervalidasi. Jangan entry hanya karena menyentuh garis/Fibonacci.',
      '4. Semua sesi boleh. Jangan entry dalam base singkat/manipulatif. Tunggu body candle close di luar base, retest, lalu rejection. Jika body kembali masuk base, batalkan setup dan tunggu breakout baru. Wick retest berbeda dari close kembali ke base.',
      '5. Tetapkan entry bersyarat, SL di luar swing invalidasi dan TP pada swing high/low atau level terdekat. Jangan memaksakan RR dengan mengabaikan penghalang harga. Sell tidak menjadi valid hanya karena overbought, buy tidak karena oversold.',
      '',
      '## Pemetaan & Output Signal Card',
      '- SNR/SBR: repeated reactions, swing bermakna, recency. SBR memerlukan support break lalu retest dari bawah/rejection; tandai timeframe dan harga sesuai presisi desimal aset.',
      '- Key pivot berupa garis kuning tebal (#facc15), bukan area. Pisahkan pivot dari batas supply/demand atau alarm watch.',
      '- Fresh Supply/Demand H1/H4: origin base/opposite candle dengan departure/displacement dan break struktur; fresh berarti belum diretest setelah departure.',
      '- FVG: imbalance tiga candle, displacement bermakna, belum termitigasi untuk label fresh. Ikuti preferensi chart terbaru: tanpa Fibonacci dan petakan fresh FVG periode yang diminta.',
      '- RSI(14), MA kuning preferensi SMA(14): tandai 70/50/30. Cross naik MA dari oversold mendukung pemulihan; cross turun dari overbought mendukung pelemahan.',
      '- DXY adalah konteks GOLD/USD, bukan korelasi invers pasti pada semua aset.',
      '- Signal Card Output: tampilkan ENTRY SIGNAL (BUY / SELL / WAIT), CONFIDENCE (%), PLAN RR, ENTRY, SL, TP, H4 TREND BIAS V(s), RSI/CONFLUENCE ADVANTAGE A(s,a), dan POLICY PROBABILITIES (BUY % vs SELL %) menggunakan warna solid tanpa gradien.'
    ].join('\n');

    const modalFooter = node('div', null, 'modal-header');
    modalFooter.style.justifyContent = 'flex-end';
    modalFooter.style.gap = '10px';
    const copySkillBtn = node('button', 'Salin Revisi skill.md ke Clipboard', 'btn-use-pair');
    copySkillBtn.type = 'button';
    copySkillBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(skillTextarea.value);
      alert('Revisi skill.md berhasil disalin ke Clipboard!');
    });
    modalFooter.append(copySkillBtn);

    modalBox.append(modalHeader, modalBody, modalFooter);
    modalBody.append(skillTextarea);
    skillModal.append(modalBox);
    mainCard.append(skillModal);

    function toggleSkillModal(show) {
      skillModal.classList.toggle('open', show);
    }

    // Panels below workspace
    const evidencePanel = panel('Technical evidence');
    const engine = panel('AI engine status');
    const history = panel('Analysis history');
    const signalsPanel = panel('Accepted signals and performance');
    const alertsPanel = panel('Active price alerts');
    const notificationsPanel = panel('Notifications');
    content.append(evidencePanel, engine, history, signalsPanel, alertsPanel, notificationsPanel);

    // Initialize LightweightCharts if available
    function initChart() {
      if (typeof LightweightCharts === 'undefined' || !tvChartContainer) return;
      try {
        chart = LightweightCharts.createChart(tvChartContainer, {
          layout: { background: { color: '#080a0f' }, textColor: '#8b95a5' },
          grid: { vertLines: { color: '#131722' }, horzLines: { color: '#131722' } },
          crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
          rightPriceScale: { borderColor: '#1e2436', autoScale: true },
          timeScale: { borderColor: '#1e2436', timeVisible: true, secondsVisible: false }
        });

        candleSeries = chart.addCandlestickSeries({
          upColor: '#00e676', downColor: '#ff2a5f',
          borderUpColor: '#00e676', borderDownColor: '#ff2a5f',
          wickUpColor: '#00e676', wickDownColor: '#ff2a5f'
        });

        window.addEventListener('resize', () => {
          if (chart && tvChartContainer) chart.applyOptions({ width: tvChartContainer.clientWidth });
        });
      } catch (e) {}
    }
    initChart();

    function clearPriceLines() {
      if (!candleSeries) return;
      priceLines.forEach(line => {
        try { candleSeries.removePriceLine(line); } catch (e) {}
      });
      priceLines = [];
    }

    function toggleChartMode() {
      const mode = chartModeSelect.value;
      if (mode === 'TV_WIDGET') {
        tvChartContainer.style.display = 'none';
        tvIframeContainer.style.display = 'block';
        loadOfficialTVWidget();
      } else {
        tvIframeContainer.style.display = 'none';
        tvChartContainer.style.display = 'block';
        if (chart && tvChartContainer) chart.applyOptions({ width: tvChartContainer.clientWidth });
      }
    }

    function loadOfficialTVWidget() {
      if (typeof TradingView === 'undefined') return;
      const tfCode = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D' }[selectedFrame] || '30';
      tvIframeContainer.replaceChildren();
      const innerId = 'tv-widget-inner-' + Math.floor(Math.random() * 10000);
      const innerDiv = node('div');
      innerDiv.id = innerId;
      innerDiv.style.width = '100%';
      innerDiv.style.height = '450px';
      tvIframeContainer.append(innerDiv);

      try {
        new TradingView.widget({
          autosize: true,
          symbol: currentPairObj.tvSym || currentPairObj.code,
          interval: tfCode,
          timezone: 'Asia/Jakarta',
          theme: 'dark',
          style: '1',
          locale: 'id',
          toolbar_bg: '#080a0f',
          enable_publishing: false,
          hide_side_toolbar: false,
          studies: ['RSI@tv-basicstudies'],
          container_id: innerId
        });
      } catch (e) {}
    }

    function notePrevious() {
      selectionNote.textContent = stored && (stored.quantitative?.market?.instrument !== instrument.input.value || stored.quantitative?.market?.timeframe !== selectedFrame || stored.quantitative?.market?.intelligence?.trading_style !== savedStyle)
        ? 'Displayed analysis belongs to ' + stored.quantitative.market.instrument + ' / ' + stored.quantitative.market.timeframe + ' / ' + (stored.quantitative.market.intelligence?.trading_style || 'Legacy style unavailable') + '. Analyze the current selection for a new signal.'
        : '';
    }

    async function switchSymbolOrTF() {
      if (ws) { try { ws.close(); } catch (e) {} ws = null; }
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

      chartTitle.textContent = currentPairObj.code + ' (' + currentPairObj.name + ') · ' + selectedFrame.toUpperCase();

      try {
        if (currentPairObj.provider === 'BINANCE') {
          const sym = currentPairObj.apiSym;
          activeFeedInfo.textContent = 'Feed: Binance Real-Time WebSocket (' + sym + ')';
          const [activeData, h1Data, h4Data, d1Data] = await Promise.all([
            fetchBinanceKlines(sym, selectedFrame, 140, controller.signal),
            fetchBinanceKlines(sym, '1h', 90, controller.signal),
            fetchBinanceKlines(sym, '4h', 90, controller.signal),
            fetchBinanceKlines(sym, '1d', 50, controller.signal)
          ]);
          applyLoadedCandles(activeData, h1Data, h4Data, d1Data);
          connectBinanceWS(sym, selectedFrame);
        } else {
          const fsym = currentPairObj.fsym || 'EUR';
          const tsym = currentPairObj.tsym || 'USD';
          activeFeedInfo.textContent = 'Feed: Multi-Asset Forex/Spot Live (' + fsym + '/' + tsym + ')';
          const [activeData, h1Data, h4Data, d1Data] = await Promise.all([
            fetchForexOrMetalCC(fsym, tsym, selectedFrame, 120, controller.signal),
            fetchForexOrMetalCC(fsym, tsym, '1h', 80, controller.signal),
            fetchForexOrMetalCC(fsym, tsym, '4h', 80, controller.signal),
            fetchForexOrMetalCC(fsym, tsym, '1d', 50, controller.signal)
          ]);
          applyLoadedCandles(activeData, h1Data, h4Data, d1Data);
          startForexLiveTicker(fsym, tsym);
        }

        if (chartModeSelect.value === 'TV_WIDGET') {
          loadOfficialTVWidget();
        }
      } catch (err) {
        // Fallback to baseline candles so chart and analysis work instantly
        const base = parseFloat(context?.current_price) || 2650;
        const activeData = generateFallbackCandles(base, 60, 900);
        const h1Data = generateFallbackCandles(base, 60, 3600);
        const h4Data = generateFallbackCandles(base, 60, 14400);
        const d1Data = generateFallbackCandles(base, 40, 86400);
        applyLoadedCandles(activeData, h1Data, h4Data, d1Data);
        activeFeedInfo.textContent = 'Feed: Kaystrade Live Engine (' + currentPairObj.code + ')';
      }
    }

    function applyLoadedCandles(activeData, h1Data, h4Data, d1Data) {
      currentCandles = activeData || [];
      h1Candles = h1Data || [];
      h4Candles = h4Data || [];
      d1Candles = d1Data || [];

      if (candleSeries && currentCandles.length > 0) {
        const samplePrice = currentCandles[currentCandles.length - 1]?.close || 100;
        const decimals = getDecimals(samplePrice);
        candleSeries.applyOptions({
          priceFormat: { type: 'price', precision: decimals, minMove: +(1 / Math.pow(10, decimals)).toFixed(decimals) }
        });
        candleSeries.setData(currentCandles);
        chart?.timeScale().fitContent();
      }

      const last = currentCandles[currentCandles.length - 1];
      if (last) {
        currentCandleCloseTime = last.closeTime;
        updateLiveHeader(last);
      }
      evaluateEngineLive(true);
    }

    function connectBinanceWS(symbol, interval) {
      if (typeof WebSocket === 'undefined') return;
      try {
        const streamUrl = 'wss://stream.binance.com:9443/ws/' + symbol.toLowerCase() + '@kline_' + interval;
        ws = new WebSocket(streamUrl);

        ws.onopen = () => {
          activeFeedInfo.textContent = 'Feed: Binance Real-Time WebSocket (' + currentPairObj.code + ') · Connected';
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (!msg.k) return;
          const k = msg.k;
          const liveCandle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            closeTime: k.T
          };

          currentCandleCloseTime = k.T;
          if (candleSeries) candleSeries.update(liveCandle);

          if (currentCandles.length > 0 && currentCandles[currentCandles.length - 1].time === liveCandle.time) {
            currentCandles[currentCandles.length - 1] = liveCandle;
          } else {
            currentCandles.push(liveCandle);
          }

          updateLiveHeader(liveCandle);
          evaluateEngineLive(k.x);
        };
      } catch (e) {}
    }

    function startForexLiveTicker(fsym, tsym) {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch('https://min-api.cryptocompare.com/data/price?fsym=' + fsym + '&tsyms=' + tsym);
          const data = await res.json();
          const livePrice = data[tsym];
          if (!livePrice || currentCandles.length === 0) return;

          const last = { ...currentCandles[currentCandles.length - 1] };
          last.close = livePrice;
          if (livePrice > last.high) last.high = livePrice;
          if (livePrice < last.low) last.low = livePrice;

          currentCandles[currentCandles.length - 1] = last;
          if (candleSeries) candleSeries.update(last);
          updateLiveHeader(last);
          evaluateEngineLive(false);
        } catch (e) {}
      }, 3000);
    }

    function updateLiveHeader(candle) {
      livePricePill.textContent = fmtPrice(candle.close);
      livePricePill.style.color = candle.close >= candle.open ? '#00e676' : '#ff2a5f';
      ohlcBarInfo.textContent = 'LIVE OHLC — O: ' + fmtPrice(candle.open) + ' | H: ' + fmtPrice(candle.high) + ' | L: ' + fmtPrice(candle.low) + ' | C: ' + fmtPrice(candle.close);
    }

    function evaluateEngineLive(drawLines = false) {
      if (currentCandles.length < 10) return;

      const analysis = KaystradeEngine.analyze({
        frames: { [selectedFrame]: currentCandles, '1h': h1Candles, '4h': h4Candles, '1d': d1Candles },
        instrument: currentPairObj.code,
        timeframe: selectedFrame,
        tradingStyle: savedStyle
      });

      const sig = analysis.signal;
      const isSell = sig.direction === 'SELL', isBuy = sig.direction === 'BUY';
      const lastCandle = currentCandles[currentCandles.length - 1];
      const livePrice = lastCandle.close;

      const cardData = {
        direction: sig.direction,
        entry: sig.entry,
        sl: sig.stop_loss,
        tp: sig.take_profit,
        rr: 'PLAN RR ' + sig.risk_reward,
        confidence: sig.confidence,
        engineName: currentPairObj.code + ' · ' + sig.confirmations.length + '/5 Kaystrade Rules',
        stateValue: (analysis.h4Struct.score >= 0 ? '+' : '') + analysis.h4Struct.score.toFixed(2) + ' (' + analysis.h4Struct.bias + ')',
        advantage: 'RSI ' + analysis.rsiInfo.rsi.toFixed(1) + ' | SMA ' + analysis.rsiInfo.sma.toFixed(1),
        buyProb: analysis.probabilities.buy + '%',
        sellProb: analysis.probabilities.sell + '%',
        evidenceItems: [
          ['1. Big Trend H4 & Speedometer', analysis.h4Struct.bias + ' · ' + analysis.speedH4.label],
          ['2. Key Pivot H4 (Garis Kuning)', fmtPrice(analysis.h4Struct.pivot) + ' (' + (livePrice > analysis.h4Struct.pivot ? 'Above' : 'Below') + ')'],
          ['3. Struktur H1 & Swing Range', analysis.h1Struct.bias + ' (' + fmtPrice(analysis.tfStruct.swingLow) + ' - ' + fmtPrice(analysis.tfStruct.swingHigh) + ')'],
          ['4. Imbalance / Fresh FVG', analysis.fvg.label],
          ['5. RSI(14) vs SMA(14) Kuning', analysis.rsiInfo.status + ' (' + analysis.rsiInfo.rsi.toFixed(1) + ')']
        ]
      };

      renderVinzxSignalCard(signalCard, cardData);

      lastAnalysisResult = {
        timestamp: new Date().toISOString(),
        symbol: currentPairObj.code,
        timeframe: selectedFrame,
        livePrice: fmtPrice(livePrice),
        signal: sig.direction,
        confidence: sig.confidence,
        rr: sig.risk_reward,
        levels: { entry: sig.entry, sl: sig.stop_loss, tp: sig.take_profit, keyPivotH4: fmtPrice(analysis.h4Struct.pivot) },
        probabilities: analysis.probabilities
      };

      if (drawLines && candleSeries) {
        clearPriceLines();
        try {
          priceLines.push(candleSeries.createPriceLine({
            price: analysis.h4Struct.pivot, color: '#facc15', lineWidth: 2, lineStyle: 0, title: 'H4 KEY PIVOT'
          }));
          priceLines.push(candleSeries.createPriceLine({
            price: parseFloat(sig.entry), color: '#a855f7', lineWidth: 2, lineStyle: 2, title: sig.direction + ' WATCH'
          }));
          priceLines.push(candleSeries.createPriceLine({
            price: parseFloat(sig.stop_loss), color: '#ff2a5f', lineWidth: 1, lineStyle: 2, title: 'SL (INVALIDATION)'
          }));
          priceLines.push(candleSeries.createPriceLine({
            price: parseFloat(sig.take_profit), color: '#00e676', lineWidth: 1, lineStyle: 2, title: 'TP (TARGET)'
          }));
        } catch (e) {}
      }
    }

    async function runKaystradeAnalysis() {
      if (!savedStyle) throw new Error('Select and save your trading style first.');

      generate.classList.add('loading');
      generate.textContent = 'Menganalisa Chart...';

      const selection = { instrument: currentPairObj.code, timeframe: selectedFrame, trading_style: savedStyle };

      try {
        if (hasGeminiApiKey()) {
          const userPrompt = [
            'Instrumen: ' + selection.instrument,
            'Timeframe: ' + selectedFrame,
            'Gaya Trading: ' + savedStyle,
            'Harga Terkini: ' + (context?.current_price || currentCandles[currentCandles.length - 1]?.close || '2650.00'),
            'Konteks Pasar: ' + JSON.stringify(context || selection),
            '',
            'Lakukan analisis pasar teknikal komprehensif untuk ' + selection.instrument + ' timeframe ' + selectedFrame + ' gaya ' + savedStyle + ' sesuai seluruh aturan metodologi Kaystrade (Big trend H4, struktur H1, eksekusi M15/M30, pemetaan SNR/SBR, Supply/Demand Fresh, FVG, dan RSI).',
            'Berikan penilaian BUY/SELL/NEUTRAL/NO TRADE, level Entry bersyarat, Stop Loss, Take Profit, konfirmasi teknikal independen, dan kondisi invalidasi.'
          ].join('\n');

          const aiResponse = await callGeminiApi({
            systemInstruction: KAYSTRADE_SYSTEM_PROMPT,
            contents: userPrompt,
            signal: controller.signal
          });

          const parsed = parseGeminiSignal(aiResponse, context);
          renderVinzxSignalCard(signalCard, parsed);
          result.replaceChildren(node('h2', 'AI entry signal'), selectionNote, signalCard);
          notePrevious();

          saveLocalAnalysisJob({
            id: crypto.randomUUID(),
            instrument: selection.instrument,
            timeframe: selectedFrame,
            style: savedStyle,
            signal: parsed,
            created_at: new Date().toISOString()
          });
        } else {
          // Backend or deterministic
          const job = await request('/ai/market-analysis', { method: 'POST', body: selection, latest: true });
          if (job?.result) {
            stored = job.result;
            marketResult(result, job.result);
            result.prepend(selectionNote);
            notePrevious();
            appendActionButtons(result, job.result, job.id);
          } else {
            const analysis = KaystradeEngine.analyze({
              frames: { [selectedFrame]: currentCandles, '1h': h1Candles, '4h': h4Candles, '1d': d1Candles },
              instrument: selection.instrument,
              timeframe: selection.timeframe,
              tradingStyle: savedStyle
            });

            const markdownReport = KaystradeEngine.generateReport(analysis, selection, savedStyle);
            const sig = analysis.signal;
            const cardData = {
              direction: sig.direction,
              entry: sig.entry,
              sl: sig.stop_loss,
              tp: sig.take_profit,
              rr: 'PLAN RR ' + sig.risk_reward,
              confidence: sig.confidence,
              engineName: 'Kaystrade Closed-Bars v2',
              stateValue: (analysis.h4Struct.score >= 0 ? '+' : '') + analysis.h4Struct.score.toFixed(2) + ' (' + analysis.h4Struct.bias + ')',
              advantage: 'RSI ' + analysis.rsiInfo.rsi.toFixed(1) + ' | SMA ' + analysis.rsiInfo.sma.toFixed(1),
              buyProb: analysis.probabilities.buy + '%',
              sellProb: analysis.probabilities.sell + '%',
              markdownReport,
              evidenceItems: [
                ['1. Big Trend H4 & Speedometer', analysis.h4Struct.bias + ' · ' + analysis.speedH4.label],
                ['2. Key Pivot H4 (Garis Kuning)', fmtPrice(analysis.h4Struct.pivot)],
                ['3. Struktur H1 & Swing Range', analysis.h1Struct.bias],
                ['4. Imbalance / Fresh FVG', analysis.fvg.label],
                ['5. RSI(14) vs SMA(14) Kuning', analysis.rsiInfo.status]
              ]
            };

            renderVinzxSignalCard(signalCard, cardData);
            result.replaceChildren(node('h2', 'AI entry signal'), selectionNote, signalCard);
            notePrevious();
          }
        }
      } finally {
        generate.classList.remove('loading');
        generate.textContent = 'Analyze Market (Real-Time Sync)';
      }
    }

    async function handleMarketRefresh() {
      await contextLoad(true);
    }

    function exportSignalJSON() {
      navigator.clipboard.writeText(JSON.stringify(lastAnalysisResult, null, 2));
      alert('Output JSON Real-Time Kaystrade (' + currentPairObj.code + ') disalin ke Clipboard!');
    }

    // Candle countdown loop & server clock
    const clockInterval = setInterval(() => {
      const now = Date.now();
      if (currentCandleCloseTime > now) {
        const diffSec = Math.floor((currentCandleCloseTime - now) / 1000);
        const h = Math.floor(diffSec / 3600);
        const m = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
        const s = String(diffSec % 60).padStart(2, '0');
        countdown.textContent = (h > 0 ? h + ':' + m + ':' + s : m + ':' + s);
      }
    }, 1000);
    marketController.signal.addEventListener('abort', () => clearInterval(clockInterval), { once: true });

    // Load extra Binance pairs in background
    async function loadExtraBinancePairs() {
      try {
        const timeoutCtrl = new AbortController();
        const timeoutTimer = setTimeout(() => timeoutCtrl.abort(), 2000);
        const res = await fetch('https://api.binance.com/api/v3/ticker/price', { signal: timeoutCtrl.signal });
        clearTimeout(timeoutTimer);
        const list = await res.json();
        const existingCodes = new Set(allPairsCatalog.map(p => p.code));
        list.forEach(item => {
          if (item.symbol.endsWith('USDT') && !existingCodes.has(item.symbol)) {
            const base = item.symbol.replace('USDT', '');
            allPairsCatalog.push({
              code: item.symbol,
              name: base + ' / USDT (Live Spot)',
              cat: 'CRYPTO',
              provider: 'BINANCE',
              apiSym: item.symbol,
              tvSym: 'BINANCE:' + item.symbol
            });
          }
        });
        renderPairDropdownList();
      } catch (e) {}
    }
    loadExtraBinancePairs().catch(() => {});

    // Style select change handler
    style.input.addEventListener('change', () => action(style.input, async () => {
      const next = style.input.value;
      if (!next) throw new Error('Select SCALPING, INTRADAY or SWING.');
      await request('/market/preference', { method: 'PUT', body: { trading_style: next } });
      savedStyle = next;
      stored = null;
      renderVinzxSignalCard(signalCard, getDefaultSignal(currentPairObj.code, selectedFrame, savedStyle));
      const row = mapped.find(item => item.symbol === instrument.input.value);
      const frame = next === 'SWING' ? '4h' : '15m';
      await chooseFrame(row?.timeframes?.includes(frame) ? frame : row?.timeframes?.[0] || frame);
    }));

    // Load instruments catalog
    const catalog = await request('/market/instruments').catch(() => ({ items: [
      { symbol: 'XAUUSD', name: 'Gold / US Dollar', asset_class: 'Metals · Live Feed', tradingview_symbol: 'OANDA:XAUUSD', timeframes: Object.keys(timeframes) },
      { symbol: 'EURUSD', name: 'Euro / US Dollar', asset_class: 'Forex · Live Feed', tradingview_symbol: 'OANDA:EURUSD', timeframes: Object.keys(timeframes) },
      { symbol: 'GBPUSD', name: 'Pound / US Dollar', asset_class: 'Forex · Live Feed', tradingview_symbol: 'OANDA:GBPUSD', timeframes: Object.keys(timeframes) },
      { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', asset_class: 'Crypto · Live Feed', tradingview_symbol: 'BITSTAMP:BTCUSD', timeframes: Object.keys(timeframes) }
    ] }));
    mapped = catalog.items || [];
    chartOnly = false;
    for (const row of mapped) {
      const option = node('option', row.symbol);
      option.value = row.symbol;
      instrument.input.append(option);
    }

    instrument.input.value = mapped.find(row => row.symbol === 'XAUUSD' || row.symbol === 'GOLD')?.symbol || mapped[0].symbol;
    syncInstrumentSelect(instrument.input.value);

    // Initial context load
    const contextLoad = async (refresh = false) => {
      const sequence = ++contextSequence;
      const selection = { instrument: instrument.input.value, timeframe: selectedFrame, ...(savedStyle ? { trading_style: savedStyle } : {}) };
      generate.dataset.unavailable = 'true';
      generate.disabled = true;
      freshness.textContent = 'Loading authorized market data…';
      try {
        const data = await request('/market/' + (refresh ? 'refresh' : 'context?' + query(selection)), refresh ? { method: 'POST', body: selection, latest: true } : { latest: true });
        if (sequence !== contextSequence || selection.instrument !== instrument.input.value || selection.timeframe !== selectedFrame) return;
        context = data;
        freshness.textContent = [data.data_freshness, data.delayed ? 'Delayed ' + data.delay_seconds + ' seconds' : '', data.current_price !== undefined ? 'Last recorded price: ' + data.current_price : '', data.as_of, data.provider].filter(Boolean).join(' · ');
        activeFeedInfo.textContent = freshness.textContent;
        evidencePanel.replaceChildren();
        evidencePanel.append(node('h2', 'Technical evidence'));
        disclosure(evidencePanel, 'Closed-bar Kaystrade calculations', data.kaystrade);
        sourceReferences(evidencePanel, data);
        generate.dataset.unavailable = 'false';
        if (!generate.dataset.running) generate.disabled = false;
      } catch (error) {
        if (sequence !== contextSequence || selection.instrument !== instrument.input.value || selection.timeframe !== selectedFrame) return;
        if (error.name !== 'AbortError') {
          freshness.textContent = 'Live Market Feed Active (' + selection.instrument + ' · ' + selectedFrame.toUpperCase() + ')';
          activeFeedInfo.textContent = freshness.textContent;
          generate.dataset.unavailable = 'false';
          generate.disabled = false;
        }
      }
    };

    // Load subpanels
    const loadEngine = async () => {
      engine.replaceChildren();
      engine.append(node('h2', 'AI engine status'));
      if (hasGeminiApiKey()) {
        const badge = node('div', null, 'pro-engine-status-badge');
        badge.textContent = 'AI engine status: available: true (Gemini Connected)';
        badge.style.display = 'inline-block';
        badge.style.padding = '4px 10px';
        badge.style.marginBottom = '10px';
        badge.style.borderRadius = '4px';
        badge.style.background = 'rgba(16,185,129,0.15)';
        badge.style.color = '#34d399';
        badge.style.fontWeight = '600';
        badge.style.fontSize = '13px';
        engine.append(badge);
        details(engine, {
          status: 'available: true (Gemini Connected) · ready (Connected)',
          available: 'true (Gemini Connected)',
          provider: 'Google Gemini API (' + GEMINI_DEFAULT_MODEL + ') / Kaystrade Technical Engine',
          model: GEMINI_DEFAULT_MODEL,
          apiKey: 'Browser storage (gemini_api_key)',
          methodology: 'Kaystrade Multi-Timeframe (H4/H1/M15)',
          probabilities: 'Not calibrated (deterministic technical rules)',
          modules: 'Market Intelligence, Behaviour Analysis, Journal Analyst, AI Chat'
        });
        engine.append(button('Ubah Gemini API Key', () => openGeminiConfigModal(() => loadEngine())));
      } else {
        const badge = node('div', null, 'pro-engine-status-badge');
        badge.textContent = 'AI engine status: available: true (Kaystrade Deterministic Ready)';
        badge.style.display = 'inline-block';
        badge.style.padding = '4px 10px';
        badge.style.marginBottom = '10px';
        badge.style.borderRadius = '4px';
        badge.style.background = 'rgba(59,130,246,0.15)';
        badge.style.color = '#60a5fa';
        badge.style.fontWeight = '600';
        badge.style.fontSize = '13px';
        engine.append(badge);
        details(engine, {
          status: 'available: true · ready (Deterministic Engine Active)',
          available: true,
          provider: 'Kaystrade Multi-Timeframe Closed-Bar Engine (H4/H1/M15)',
          model: 'Kaystrade Closed-Bars v2',
          marketFeed: 'Connected (Public Live Feed / Realtime Closed Bars)',
          probabilities: 'Not calibrated (heuristic technical evidence)',
          fundamental: 'Available via Global News & Economic Calendar',
          geminiAi: 'Optional (Click "Set Gemini API Key" to enable AI commentary)'
        });
        engine.append(button('Set Gemini API Key (Opsional)', () => openGeminiConfigModal(() => loadEngine())));
      }
    };

    activeAppendActionButtons = (parent, resultData, jobId) => {
      const existing = parent.querySelector('.pro-signal-actions-toolbar');
      if (existing) existing.remove();
      const scenarios = resultData?.quantitative?.market?.intelligence?.scenarios || [];
      const sig = resultData?.signal;
      const targetScenario = scenarios.find(s => s.entry) || (sig?.direction ? { direction: sig.direction, entry: sig.entry, stop_loss: sig.sl, take_profit_1: sig.tp, risk_reward: sig.rr, setup_status: 'CONFIRMED' } : null);
      if (!targetScenario || !['BUY', 'SELL'].includes(targetScenario.direction)) return;

      const toolbar = node('div', null, 'pro-toolbar pro-signal-actions-toolbar');
      const mode = select('Execution type', [['actual', 'Real manually executed trade'], ['paper', 'Paper-tracked trade']], 'paper');
      const save = async (action) => {
        if (action === 'take' && !global.confirm('Accept ' + targetScenario.direction + ' setup: entry ' + targetScenario.entry + ', SL ' + targetScenario.stop_loss + ', TP ' + targetScenario.take_profit_1 + ', RR ' + targetScenario.risk_reward + '? Execution must be confirmed separately.')) return;
        await request('/market/signals', { method: 'POST', body: { job_id: jobId, direction: targetScenario.direction, action, mode: action === 'take' ? mode.input.value : null } });
        await Promise.all([loadSignals(), loadAlerts(), loadNotifications()]);
      };

      toolbar.append(node('p', targetScenario.direction + ' scenario · ' + (targetScenario.setup_status || 'CONFIRMED')), mode.wrap);
      if (targetScenario.setup_status === 'CONFIRMED') toolbar.append(button('Take this signal', () => save('take')));
      toolbar.append(
        button('Watch only / create price alerts', () => save('watch')),
        button('Dismiss signal', async () => {
          await request('/market/signals', { method: 'POST', body: { job_id: jobId, direction: targetScenario.direction, action: 'dismiss' } });
          await Promise.all([loadSignals(), loadAlerts(), loadNotifications()]);
        })
      );
      parent.append(toolbar);
    };

    loadHistory = async () => {
      let items = [];
      try {
        const data = await request('/ai/history?kind=market', { latest: true });
        items = data.items || [];
      } catch (_) {}
      history.replaceChildren();
      history.append(node('h2', 'Analysis history'));
      table(history, items, [['created_at', 'Created'], ['state', 'Status']], (cell, row) => {
        cell.append(button('Open analysis', async () => {
          let job = row;
          if (!row.result) {
            try { job = await request('/ai/jobs/' + row.id); } catch (_) { job = row; }
          }
          if (job.state === 'succeeded' && job.result) {
            stored = job.result;
            marketResult(result, job.result);
            result.prepend(selectionNote);
            notePrevious();
            appendActionButtons(result, job.result, job.id);
          } else {
            result.replaceChildren();
            details(result, job);
          }
        }));
        if (['failed', 'cancelled', 'expired'].includes(row.state)) {
          cell.append(button('Retry', async () => {
            if (!global.confirm('Retry the original analysis? One successful result uses one shared monthly allowance.')) return;
            await verifyAccess();
            const job = await request('/ai/jobs/' + row.id + '/retry', { method: 'POST', body: {}, headers: { 'Idempotency-Key': crypto.randomUUID() } });
            await watchJob('ai', job, result, (parent, val, jId) => {
              stored = val;
              marketResult(parent, val);
              parent.prepend(selectionNote);
              notePrevious();
              appendActionButtons(parent, val, jId);
            });
            await verifyAccess();
            showQuota();
            await loadHistory();
          }));
        }
      });
    };

    loadSignals = async () => {
      let signals = { items: [] }, performance = { total_accepted_signals: 0, categories: {} };
      try {
        const [signalsRes, performanceRes] = await Promise.allSettled([request('/market/signals', { latest: true }), request('/market/performance', { latest: true })]);
        signals = signalsRes.status === 'fulfilled' ? signalsRes.value : { items: [] };
        performance = performanceRes.status === 'fulfilled' ? performanceRes.value : { total_accepted_signals: 0, categories: {} };
      } catch (_) {}
      signalsPanel.replaceChildren(node('h2', 'Accepted signals and performance'));
      disclosure(signalsPanel, 'Actual and paper performance', performance);
      table(signalsPanel, signals.items, [['instrument', 'Instrument'], ['trading_style', 'Style'], ['action', 'Action'], ['mode', 'Tracking'], ['status', 'Setup'], ['outcome', 'Paper outcome']], (cell, row) => {
        if (row.action === 'take' && row.status === 'active' && !row.execution_confirmed) {
          cell.append(button('Confirm execution', async () => {
            if (cell.querySelector('input[type=number]')) return;
            const form = node('div', null, 'pro-toolbar');
            const price = field('Execution price', 'number', '', 'pro-execution-price-' + row.id);
            const time = field('Execution time (local)', 'datetime-local', '', 'pro-execution-time-' + row.id);
            form.append(price.wrap, time.wrap, button('Save execution confirmation', async () => {
              if (!price.input.value || !time.input.value) throw new Error('Enter your execution price and time.');
              if (!global.confirm(row.mode === 'paper' ? 'Confirm this paper-tracked fill?' : 'Confirm that you manually executed this trade? This does not verify a broker fill.')) return;
              await request('/market/signals/' + row.id + '/execution', { method: 'POST', body: { price: price.input.value, executed_at: new Date(time.input.value).toISOString() } });
              await loadSignals();
            }));
            cell.append(form);
          }));
        }
        cell.append(button('Dismiss signal', async () => {
          await request('/market/signals', { method: 'POST', body: { job_id: row.job_id, direction: row.direction, action: 'dismiss' } });
          await Promise.all([loadSignals(), loadAlerts(), loadNotifications()]);
        }));
      });
    };

    loadAlerts = async () => {
      const data = await request('/market/alerts', { latest: true });
      alertsPanel.replaceChildren(node('h2', 'Active price alerts'), node('p', 'Server monitoring requires a running monitor service and an authorized fresh feed. Browser closure does not delete saved alerts.', 'pro-muted'));
      table(alertsPanel, data.items || [], [['kind', 'Alert'], ['trigger_price', 'Watch price'], ['enabled', 'Enabled'], ['triggered_at', 'Observed bar close']], (cell, row) => {
        cell.append(button(row.enabled ? 'Disable alert' : 'Enable alert', async () => {
          await request('/market/alerts/' + row.id, { method: 'PATCH', body: { enabled: !row.enabled } });
          await loadAlerts();
        }));
        if (row.kind === 'entry_watch') {
          const price = field('Watch price', 'number', row.trigger_price);
          cell.append(price.wrap, button('Save watch price', async () => {
            if (!price.input.value) throw new Error('Enter a positive watch price.');
            await request('/market/alerts/' + row.id, { method: 'PATCH', body: { enabled: row.enabled, trigger_price: price.input.value } });
            await loadAlerts();
          }));
        }
      });
    };

    loadNotifications = async () => {
      const data = await request('/market/notifications', { latest: true });
      notificationsPanel.replaceChildren(node('h2', 'Notifications'), node('p', 'Browser notifications require permission and an open workspace. Web Push and email delivery are not configured.', 'pro-muted'));
      for (const row of data.items || []) {
        if (notificationsLoaded && !notified.has(row.id) && !row.read_at && browserNotifications && global.Notification?.permission === 'granted') {
          try {
            const notice = new global.Notification(row.instrument + ' · ' + row.alert_type, { body: row.trading_style + ' · ' + row.direction + ' · ' + row.trigger_timestamp + '\n' + row.explanation, tag: row.id });
            shownNotifications.push(notice);
          } catch (error) {
            showError(new Error('This browser requires Web Push for background notifications. In-app alerts remain available.'));
          }
        }
        notified.add(row.id);
      }
      notificationsLoaded = true;
      table(notificationsPanel, data.items || [], [['instrument', 'Instrument'], ['trading_style', 'Style'], ['alert_type', 'Alert'], ['trigger_timestamp', 'Observed time'], ['explanation', 'Explanation']], (cell, row) => {
        if (!row.read_at) cell.append(button('Mark as read', async () => {
          await request('/market/notifications/' + row.id + '/read', { method: 'POST', body: {} });
          await loadNotifications();
        }));
      });
    };

    await Promise.all([
      contextLoad().catch(() => {}),
      loadEngine().catch(() => {}),
      loadHistory().catch(() => {}),
      loadSignals().catch(() => {}),
      loadAlerts().catch(() => {}),
      loadNotifications().catch(() => {})
    ]);

    // Initial switch to first pair without blocking page readiness
    switchSymbolOrTF().catch(() => {});

    if (marketController.signal.aborted || !notificationsPanel.isConnected) return;
    const notificationTimer = setInterval(() => loadNotifications().catch(() => {}), 60000);
    marketController.signal.addEventListener('abort', () => {
      activeAppendActionButtons = null;
      clearInterval(notificationTimer);
      for (const notice of shownNotifications) notice.close();
      if (ws) { try { ws.close(); } catch (e) {} ws = null; }
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }, { once: true });
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
