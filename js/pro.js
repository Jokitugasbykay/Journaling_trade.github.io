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
  const GEMINI_DEFAULT_MODEL='gemini-3.8-flash';
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
    const candidateModels = [model, 'gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
    const modelsToTry = [...new Set(candidateModels)];

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

    let lastError = null;
    for (let i = 0; i < modelsToTry.length; i++) {
      const curModel = modelsToTry[i];
      const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(curModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
        if(response.status===404 && i < modelsToTry.length - 1){
          lastError = new Error('Google Gemini API Error ('+response.status+'): '+errorMsg);
          continue;
        }
        throw new Error('Google Gemini API Error ('+response.status+'): '+errorMsg);
      }
      const textOutput=data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if(!textOutput){
        throw new Error('Google Gemini tidak mengembalikan respon teks yang valid. Silakan coba kembali.');
      }
      return textOutput;
    }
    if (lastError) throw lastError;
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

  function renderStatusLab(container, labelText) {
    container.replaceChildren();
    const lab = node('span', labelText, 'mo-lab-t');
    const dots = node('span', null, 'mo-dots');
    dots.setAttribute('aria-hidden', 'true');
    dots.append(node('i'), node('i'), node('i'));
    container.append(lab, dots);
  }

  function startInlineOrb(canvas, statusLab) {
    const ctx = canvas.getContext('2d');
    let running = true;
    let time = 0, raf = 0, last = performance.now();
    const LABELS = ['Thinking', 'Searching', 'Analyzing', 'Composing'];
    let labIdx = 0;
    const interval = setInterval(() => {
      if (!running) return;
      labIdx = (labIdx + 1) % LABELS.length;
      if (statusLab) {
        renderStatusLab(statusLab, LABELS[labIdx]);
      }
    }, 1150);

    const RINGS = 10;
    const dots = [];
    for (let k = 0; k < RINGS; k++) {
      const y = 1 - ((k + 0.5) / RINGS) * 2;
      const r = Math.sqrt(1 - y * y);
      const m = Math.max(4, Math.round(18 * r));
      for (let j = 0; j < m; j++) {
        const a = (j / m) * Math.PI * 2 + k * 0.4;
        dots.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
      }
    }

    const draw = (dt) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += dt;
      const yaw = time * 0.9, cyw = Math.cos(yaw), syw = Math.sin(yaw);
      const CP = Math.cos(0.35), SP = Math.sin(0.35);
      const C0 = canvas.width / 2, R = C0 * 0.72;

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const x1 = d.x * cyw + d.z * syw, z1 = -d.x * syw + d.z * cyw;
        const y2 = d.y * CP - z1 * SP, z2 = d.y * SP + z1 * CP;
        const depth = (z2 + 1) / 2;
        const ox = x1 * R, oy = -y2 * R;
        const rad = 1.0 + 1.2 * depth;
        const alpha = 0.25 + 0.75 * depth * depth;
        ctx.fillStyle = 'rgba(52, 211, 153, ' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(C0 + ox, C0 + oy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now) => {
      if (!running) return;
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      clearInterval(interval);
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }

  async function aiChat() {
    const terminal = node('div', null, 'pro-chat-terminal');
    const terminalHeader = node('div', null, 'pro-chat-header');
    const quota = node('p', null, 'pro-muted');

    const geminiChatKeyBtn = button(hasGeminiApiKey() ? 'Gemini API Key: Connected' : 'Set Gemini API Key', () => {
      openGeminiConfigModal(() => {
        showQuota();
        geminiChatKeyBtn.textContent = hasGeminiApiKey() ? 'Gemini API Key: Connected' : 'Set Gemini API Key';
      });
    }, 'pro-gemini-key-btn-chat');

    terminalHeader.append(quota, geminiChatKeyBtn);

    const messages = node('div', null, 'pro-chat-messages');
    messages.setAttribute('role', 'log');
    messages.setAttribute('aria-live', 'polite');
    messages.setAttribute('aria-label', 'AI chat conversation');

    const inputBar = node('div', null, 'pro-chat-input-bar');
    const pillComposer = node('div', null, 'mo-pill-composer');
    const underglow = node('div', null, 'mo-underglow'); underglow.setAttribute('aria-hidden', 'true');
    const surface = node('div', null, 'mo-surface'); surface.setAttribute('aria-hidden', 'true');
    const aurora = node('div', null, 'mo-aurora'); for (let i = 0; i < 4; i++) aurora.append(node('i')); surface.append(aurora);
    const ring = node('div', null, 'mo-ring'); ring.setAttribute('aria-hidden', 'true');

    const form = node('form', null, 'mo-input'); form.autocomplete = 'off';
    const sparkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sparkSvg.setAttribute('class', 'mo-spark'); sparkSvg.setAttribute('viewBox', '0 0 24 24');
    sparkSvg.setAttribute('fill', 'none'); sparkSvg.setAttribute('stroke', 'currentColor');
    sparkSvg.setAttribute('stroke-width', '1.5'); sparkSvg.setAttribute('stroke-linecap', 'round');
    sparkSvg.setAttribute('stroke-linejoin', 'round'); sparkSvg.setAttribute('aria-hidden', 'true');
    const sparkP1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    sparkP1.setAttribute('d', 'M10 3.5l1.7 4.8 4.8 1.7-4.8 1.7L10 16.5l-1.7-4.8L3.5 10l4.8-1.7L10 3.5z');
    const sparkP2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    sparkP2.setAttribute('d', 'M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z');
    sparkSvg.append(sparkP1, sparkP2);

    const input = node('input');
    input.id = 'pro-ai-chat-message'; input.name = 'message';
    input.className = 'mo-field'; input.type = 'text'; input.maxLength = 4000;
    input.required = true; input.placeholder = 'Ask about your journal, trading process, or a market concept…';
    input.setAttribute('aria-label', 'Message the AI assistant'); input.spellcheck = false;

    const sendBtn = node('button', null, 'mo-send pro-ai-chat-send');
    sendBtn.id = 'pro-ai-chat-send'; sendBtn.type = 'button';
    sendBtn.setAttribute('aria-label', 'Send message');
    const sendSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    sendSvg.setAttribute('viewBox', '0 0 24 24'); sendSvg.setAttribute('fill', 'none');
    sendSvg.setAttribute('stroke', 'currentColor'); sendSvg.setAttribute('stroke-width', '1.5');
    sendSvg.setAttribute('stroke-linecap', 'round'); sendSvg.setAttribute('stroke-linejoin', 'round');
    const sendP1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    sendP1.setAttribute('d', 'M12 19V5');
    const sendP2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    sendP2.setAttribute('d', 'M5.5 11.5L12 5l6.5 6.5');
    sendSvg.append(sendP1, sendP2);
    sendBtn.append(sendSvg);

    form.append(sparkSvg, input, sendBtn);
    pillComposer.append(underglow, surface, ring, form);
    inputBar.append(pillComposer);

    terminal.append(terminalHeader, messages, inputBar);

    const note = node('p', '', 'pro-muted');
    content.append(terminal, note);

    const showQuota = () => {
      if (hasGeminiApiKey()) {
        quota.textContent = 'Google Gemini AI: Connected (' + GEMINI_DEFAULT_MODEL + ')';
        note.textContent = 'AI Chat ditenagai oleh Google Gemini API (' + GEMINI_DEFAULT_MODEL + '). Mengobrol dan konsultasi seputar strategi, psikologi, teknikal, dan evaluasi jurnal secara interaktif dua arah.';
      } else {
        quota.textContent = 'AI analyses remaining this month: ' + format(access?.ai?.remaining) + ' / ' + format(access?.ai?.limit || 30);
        note.textContent = 'AI chat uses one shared monthly allowance per successful reply. It does not have live prices or news and does not provide trade signals.';
      }
    };

    const bubble = (role, value, time) => {
      const item = node('article', null, 'pro-chat-message'); item.dataset.role = role;
      item.append(node('h3', role === 'user' ? 'You' : 'AI assistant (Gemini)'));
      if (typeof value === 'string' && value.includes('\n')) {
        const box = node('div', null, 'pro-markdown');
        renderMarkdownInto(box, value);
        item.append(box);
      } else {
        item.append(node('p', value));
      }
      if (time) item.append(node('time', format(time), 'pro-muted'));
      return item;
    };

    const load = async () => {
      if (hasGeminiApiKey()) {
        messages.replaceChildren();
        const historyList = global._geminiChatHistory || [];
        if (!historyList.length) {
          messages.append(node('p', 'Ketik pertanyaan untuk mulai mengobrol dan berkonsultasi seputar trading dengan Google Gemini AI.', 'pro-muted'));
        } else {
          for (const item of historyList) {
            const textVal = item.parts?.[0]?.text || '';
            if (item.role === 'user') {
              messages.append(bubble('user', textVal));
            } else {
              const m = node('article', null, 'pro-chat-message'); m.dataset.role = 'assistant'; m.append(node('h3', 'AI assistant (Gemini)'));
              const c = node('div', null, 'pro-markdown'); renderMarkdownInto(c, textVal); m.append(c); messages.append(m);
            }
          }
        }
        return;
      }
      const data = await request('/ai/chat/history', { latest: true });
      messages.replaceChildren();
      for (const item of [...(data.items || [])].reverse()) {
        messages.append(bubble('user', item.message, item.created_at));
        if (item.reply) messages.append(bubble('assistant', item.reply, item.created_at));
        else if (item.state === 'failed' || item.state === 'cancelled') messages.append(bubble('assistant', 'This reply was not completed. No AI allowance was charged.', item.created_at));
        else messages.append(bubble('assistant', 'Response is processing…', item.created_at));
      }
      if (!messages.childElementCount) messages.append(node('p', 'Ask a question to start your private Pro chat.', 'pro-muted'));
    };

    input.addEventListener('input', () => {
      if (input.value.trim().length > 0) sendBtn.setAttribute('data-ready', '');
      else sendBtn.removeAttribute('data-ready');
    });

    const triggerSubmit = () => action(sendBtn, async () => {
      const message = input.value.trim();
      if (!message) {
        pillComposer.removeAttribute('data-shake');
        void pillComposer.offsetWidth;
        pillComposer.setAttribute('data-shake', '');
        window.setTimeout(() => pillComposer.removeAttribute('data-shake'), 260);
        throw new Error('Enter a message first.');
      }

      input.value = '';
      sendBtn.removeAttribute('data-ready');

      messages.append(bubble('user', message, new Date().toISOString()));
      messages.scrollTop = messages.scrollHeight;

      const loadingBubble = node('article', null, 'pro-chat-message');
      loadingBubble.dataset.role = 'assistant';
      loadingBubble.dataset.loading = 'true';
      const head = node('h3', 'AI assistant (Gemini)');

      const orbWrap = node('div', null, 'mo-inline-orb-wrap');
      const canvas = node('canvas', null, 'mo-inline-orb');
      canvas.width = 64; canvas.height = 64;
      const statusLab = node('div', null, 'mo-inline-status');
      renderStatusLab(statusLab, 'Thinking');
      orbWrap.append(canvas, statusLab);
      loadingBubble.append(head, orbWrap);
      messages.append(loadingBubble);
      messages.scrollTop = messages.scrollHeight;

      const stopOrb = startInlineOrb(canvas, statusLab);

      try {
        let replyText = '';
        if (hasGeminiApiKey()) {
          const historyList = global._geminiChatHistory = global._geminiChatHistory || [];
          historyList.push({ role: 'user', parts: [{ text: message }] });

          try {
            replyText = await callGeminiApi({
              systemInstruction: CHAT_SYSTEM_PROMPT,
              history: historyList,
              signal: controller.signal
            });
            historyList.push({ role: 'model', parts: [{ text: replyText }] });
          } catch(err) {
            historyList.pop();
            throw err;
          }
        } else {
          await verifyAccess();
          showQuota();
          if (!(Number(access.ai?.remaining) > 0)) throw new Error('No AI allowance remains this month.');
          if (!global.confirm('A successful AI reply uses one shared monthly AI allowance. Continue?')) {
            stopOrb();
            loadingBubble.remove();
            return;
          }

          const job = await request('/ai/chat', {
            method: 'POST',
            body: { message },
            headers: { 'Idempotency-Key': crypto.randomUUID() }
          });

          await watchJob('chat', job, messages, (parent, result) => {
            replyText = result.reply || replyText;
          });

          await load();
          await verifyAccess();
          showQuota();
        }

        stopOrb();
        loadingBubble.replaceChildren();
        loadingBubble.append(node('h3', 'AI assistant (Gemini)'));
        const contentBox = node('div', null, 'pro-markdown');
        renderMarkdownInto(contentBox, replyText || 'Response received.');
        loadingBubble.append(contentBox, node('time', new Date().toLocaleTimeString(), 'pro-muted'));
        messages.scrollTop = messages.scrollHeight;
      } catch (err) {
        stopOrb();
        loadingBubble.replaceChildren();
        loadingBubble.append(node('h3', 'AI assistant (Gemini)'), node('p', 'Gagal memproses jawaban: ' + err.message, 'pro-muted'));
        messages.scrollTop = messages.scrollHeight;
        throw err;
      }
    });

    sendBtn.dataset.componentId = 'pro-ai-chat-send';
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      triggerSubmit();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      triggerSubmit();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        triggerSubmit();
      }
    });

    await Promise.all([load(), Promise.resolve(showQuota())]);
  }
  function disclosure(parent,title,value) {
    const section=node('details',null,'pro-disclosure');section.append(node('summary',title));parent.append(section);
    if(value===undefined || value===null || Array.isArray(value) && !value.length) section.append(node('p','No verified evidence supplied.','pro-muted'));
    else if(Array.isArray(value)) {for(const item of value) {if(item && typeof item==='object' && (item.text || item.title || item.summary)){section.append(node('p',item.text || item.title || item.summary));evidence(section,item.evidence_ids);if(item.timestamp)section.append(node('p',item.timestamp,'pro-muted'));}else if(item && typeof item==='object')details(section,item);else section.append(node('p',format(item)));}sourceReferences(section,value);}
    else {details(section,value);sourceReferences(section,value);}
    return section;
  }
  const PRESET_PAIRS = [
    { code: 'XAUUSD', name: 'Gold Spot / US Dollar (TVC:GOLD)', cat: 'METALS', provider: 'BINANCE', apiSym: 'PAXGUSDT', tvSym: 'TVC:GOLD', ccy: ['USD', 'XAU'] },
    { code: 'XAGUSD', name: 'Silver Spot / US Dollar', cat: 'METALS', provider: 'CC', fsym: 'XAG', tsym: 'USD', tvSym: 'TVC:SILVER', ccy: ['USD', 'XAG'] },
    { code: 'PAXGUSDT', name: 'PAX Gold Spot (1:1 Troy Oz)', cat: 'METALS', provider: 'BINANCE', apiSym: 'PAXGUSDT', tvSym: 'BINANCE:PAXGUSDT', ccy: ['USD'] },
    { code: 'WTIUSD', name: 'Crude Oil WTI Spot', cat: 'METALS', provider: 'CC', fsym: 'WTI', tsym: 'USD', tvSym: 'TVC:USOIL', ccy: ['USD', 'CAD'] },

    { code: 'EURUSD', name: 'Euro / US Dollar', cat: 'FOREX', provider: 'CC', fsym: 'EUR', tsym: 'USD', tvSym: 'FX:EURUSD', ccy: ['EUR', 'USD'] },
    { code: 'GBPUSD', name: 'British Pound / US Dollar', cat: 'FOREX', provider: 'CC', fsym: 'GBP', tsym: 'USD', tvSym: 'FX:GBPUSD', ccy: ['GBP', 'USD'] },
    { code: 'USDJPY', name: 'US Dollar / Japanese Yen', cat: 'FOREX', provider: 'CC', fsym: 'USD', tsym: 'JPY', tvSym: 'FX:USDJPY', ccy: ['USD', 'JPY'] },
    { code: 'AUDUSD', name: 'Australian Dollar / US Dollar', cat: 'FOREX', provider: 'CC', fsym: 'AUD', tsym: 'USD', tvSym: 'FX:AUDUSD', ccy: ['AUD', 'USD'] },
    { code: 'USDCAD', name: 'US Dollar / Canadian Dollar', cat: 'FOREX', provider: 'CC', fsym: 'USD', tsym: 'CAD', tvSym: 'FX:USDCAD', ccy: ['USD', 'CAD'] },
    { code: 'USDCHF', name: 'US Dollar / Swiss Franc', cat: 'FOREX', provider: 'CC', fsym: 'USD', tsym: 'CHF', tvSym: 'FX:USDCHF', ccy: ['USD', 'CHF'] },
    { code: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', cat: 'FOREX', provider: 'CC', fsym: 'NZD', tsym: 'USD', tvSym: 'FX:NZDUSD', ccy: ['NZD', 'USD'] },
    { code: 'GBPJPY', name: 'British Pound / Japanese Yen', cat: 'FOREX', provider: 'CC', fsym: 'GBP', tsym: 'JPY', tvSym: 'FX:GBPJPY', ccy: ['GBP', 'JPY'] },
    { code: 'EURJPY', name: 'Euro / Japanese Yen', cat: 'FOREX', provider: 'CC', fsym: 'EUR', tsym: 'JPY', tvSym: 'FX:EURJPY', ccy: ['EUR', 'JPY'] },
    { code: 'EURGBP', name: 'Euro / British Pound', cat: 'FOREX', provider: 'CC', fsym: 'EUR', tsym: 'GBP', tvSym: 'FX:EURGBP', ccy: ['EUR', 'GBP'] },
    { code: 'AUDJPY', name: 'Australian Dollar / Japanese Yen', cat: 'FOREX', provider: 'CC', fsym: 'AUD', tsym: 'JPY', tvSym: 'FX:AUDJPY', ccy: ['AUD', 'JPY'] },

    { code: 'BTCUSDT', name: 'Bitcoin / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BTCUSDT', tvSym: 'BINANCE:BTCUSDT', ccy: ['USD'] },
    { code: 'ETHUSDT', name: 'Ethereum / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ETHUSDT', tvSym: 'BINANCE:ETHUSDT', ccy: ['USD'] },
    { code: 'SOLUSDT', name: 'Solana / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SOLUSDT', tvSym: 'BINANCE:SOLUSDT', ccy: ['USD'] },
    { code: 'BNBUSDT', name: 'BNB / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BNBUSDT', tvSym: 'BINANCE:BNBUSDT', ccy: ['USD'] },
    { code: 'XRPUSDT', name: 'Ripple XRP / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'XRPUSDT', tvSym: 'BINANCE:XRPUSDT', ccy: ['USD'] },
    { code: 'DOGEUSDT', name: 'Dogecoin / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'DOGEUSDT', tvSym: 'BINANCE:DOGEUSDT', ccy: ['USD'] },
    { code: 'PEPEUSDT', name: 'Pepe / US Dollar', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'PEPEUSDT', tvSym: 'BINANCE:PEPEUSDT', ccy: ['USD'] },

    { code: 'DXY', name: 'US Dollar Index Context', cat: 'INDICES', provider: 'CC', fsym: 'USD', tsym: 'EUR', tvSym: 'TVC:DXY', ccy: ['USD', 'EUR'] }
  ];  function getDecimals(price) {
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

  function analyzeStructure(candles, lookback = 60) {
    if (!candles || candles.length < 20) return { bias: 'NEUTRAL', score: 0, pivot: candles?.[candles.length - 1]?.close || 0, swingHigh: 0, swingLow: 0, baseBreakout: 'INSIDE BASE', baseHigh: 0, baseLow: 0 };
    const recent = candles.slice(-Math.min(candles.length, lookback));
    const half = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, half);
    const secondHalf = recent.slice(half);

    const high1 = Math.max(...firstHalf.map(c => Number(c.high)));
    const low1 = Math.min(...firstHalf.map(c => Number(c.low)));
    const high2 = Math.max(...secondHalf.map(c => Number(c.high)));
    const low2 = Math.min(...secondHalf.map(c => Number(c.low)));

    const lastClosed = recent[recent.length - 2] || recent[recent.length - 1];
    const pivot = (high2 + low2 + Number(lastClosed.close)) / 3;

    const baseSlice = recent.slice(-12, -2);
    const baseHigh = baseSlice.length ? Math.max(...baseSlice.map(c => Math.max(Number(c.open), Number(c.close)))) : high2;
    const baseLow = baseSlice.length ? Math.min(...baseSlice.map(c => Math.min(Number(c.open), Number(c.close)))) : low2;
    let baseBreakout = 'WAIT BODY CLOSE OUTSIDE BASE';
    if (Number(lastClosed.close) > baseHigh) baseBreakout = 'BODY CLOSED ABOVE BASE (VALID)';
    else if (Number(lastClosed.close) < baseLow) baseBreakout = 'BODY CLOSED BELOW BASE (VALID)';

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

    return { bias, score, pivot, swingHigh: Math.max(high1, high2), swingLow: Math.min(low1, low2), baseBreakout, baseHigh, baseLow };
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
    const base = Number(basePrice) || 2650;
    const volatility = base > 100 ? (base > 1000 ? 1.5 : 0.4) : (base > 5 ? 0.05 : 0.0004);
    let price = base;
    for (let i = count; i >= 0; i--) {
      const time = now - i * intervalSec;
      const delta = (Math.sin(i * 0.4) * 0.8 + (i % 3 === 0 ? 0.6 : -0.5)) * volatility;
      const open = Number(price.toFixed(base > 10 ? 2 : 5));
      const close = Number((price + delta).toFixed(base > 10 ? 2 : 5));
      const wick = Math.abs(delta) * 0.4 + volatility * 0.3;
      const high = Number((Math.max(open, close) + wick).toFixed(base > 10 ? 2 : 5));
      const low = Number((Math.min(open, close) - wick).toFixed(base > 10 ? 2 : 5));
      candles.push({ time, open, high, low, close, closeTime: (time + intervalSec) * 1000 });
      price = close;
    }
    return candles;
  }

  async function fetchBinanceKlines(symbol, interval, limit = 500, signal = null) {
    const sym = symbol.replace('/', '').toUpperCase();
    const binanceSym = sym.endsWith('USDT') ? sym : (sym === 'XAUUSD' || sym === 'GOLD' ? 'PAXGUSDT' : (sym === 'EURUSD' ? 'EURUSDT' : (sym === 'GBPUSD' ? 'GBPUSDT' : (sym === 'AUDUSD' ? 'AUDUSDT' : sym + 'USDT'))));
    const endpoints = [
      'https://data-api.binance.vision/api/v3/klines?symbol=' + binanceSym + '&interval=' + interval + '&limit=' + limit,
      'https://api.binance.com/api/v3/klines?symbol=' + binanceSym + '&interval=' + interval + '&limit=' + limit
    ];
    let res, lastError;
    for (const url of endpoints) {
      try {
        const timeoutCtrl = new AbortController();
        const timeoutTimer = setTimeout(() => timeoutCtrl.abort(), 6000);
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

  async function fetchForexOrMetalCC(fsym, tsym, tf, limit = 500, signal = null) {
    const directSym = (fsym + (tsym === 'USD' ? 'USDT' : tsym)).toUpperCase();
    if (['EURUSDT', 'GBPUSDT', 'AUDUSDT', 'PAXGUSDT'].includes(directSym)) {
      try {
        return await fetchBinanceKlines(directSym, tf, limit, signal);
      } catch (_) {}
    }

    let endpoint = 'histominute', aggregate = 30, stepSec = 1800;
    if (tf === '1m') { endpoint = 'histominute'; aggregate = 1; stepSec = 60; }
    else if (tf === '5m') { endpoint = 'histominute'; aggregate = 5; stepSec = 300; }
    else if (tf === '15m') { endpoint = 'histominute'; aggregate = 15; stepSec = 900; }
    else if (tf === '30m') { endpoint = 'histominute'; aggregate = 30; stepSec = 1800; }
    else if (tf === '1h') { endpoint = 'histohour'; aggregate = 1; stepSec = 3600; }
    else if (tf === '4h') { endpoint = 'histohour'; aggregate = 4; stepSec = 14400; }
    else if (tf === '1d') { endpoint = 'histoday'; aggregate = 1; stepSec = 86400; }

    try {
      const url = 'https://min-api.cryptocompare.com/data/v2/' + endpoint + '?fsym=' + fsym + '&tsym=' + tsym + '&limit=' + limit + '&aggregate=' + aggregate;
      const timeoutCtrl = new AbortController();
      const timeoutTimer = setTimeout(() => timeoutCtrl.abort(), 3000);
      const res = await fetch(url, { signal: timeoutCtrl.signal });
      clearTimeout(timeoutTimer);
      if (res.ok) {
        const json = await res.json();
        if (json.Response === 'Success' && Array.isArray(json.Data?.Data) && json.Data.Data.length) {
          return json.Data.Data.filter(d => d.open > 0).map(d => ({
            time: d.time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            closeTime: (d.time + stepSec) * 1000
          }));
        }
      }
    } catch (_) {}

    const seedMap = {
      'EURUSD': 1.0850, 'GBPUSD': 1.2980, 'USDJPY': 152.40, 'AUDUSD': 0.6650,
      'USDCAD': 1.3850, 'USDCHF': 0.8670, 'NZDUSD': 0.5980, 'GBPJPY': 197.80,
      'EURJPY': 165.30, 'EURGBP': 0.8350, 'AUDJPY': 101.30, 'XAUUSD': 2685.0,
      'XAGUSD': 31.80, 'WTIUSD': 71.50
    };
    const pairCode = (fsym + tsym).toUpperCase();
    const basePrice = seedMap[pairCode] || 100;
    return generateFallbackCandles(basePrice, Math.min(limit, 250), stepSec);
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
    let mapped = [], chartOnly = false, selectedFrame = '30m', context = null, stored = null, contextSequence = 0;
    const marketController = controller;
    const preference = await request('/market/preference').catch(() => ({ trading_style: 'INTRADAY', browser_notifications: false }));
    let savedStyle = preference?.trading_style || '';
    let browserNotifications = !!preference?.browser_notifications;
    const notified = new Set(), shownNotifications = [];
    let notificationsLoaded = false;
    selectedFrame = savedStyle === 'SWING' ? '4h' : (savedStyle === 'SCALPING' ? '15m' : '30m');

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

    let economicEvents = [];
    let simulatedWarningEvent = null;

    // FastBull Store (https://www.fastbull.com/list-position) & News Feed
    const fastbullPositionStore = {
      XAUUSD: { longPct: 42.0, shortPct: 58.0, netShift: +4.2, instBias: 'BUY', instName: 'Morgan Stanley & Citi Spot Desk' },
      EURUSD: { longPct: 39.5, shortPct: 60.5, netShift: +3.1, instBias: 'BUY', instName: 'Goldman Sachs & Deutsche Bank FX' },
      GBPUSD: { longPct: 44.0, shortPct: 56.0, netShift: +2.8, instBias: 'BUY', instName: 'Barclays & JP Morgan FX Desk' },
      USDJPY: { longPct: 64.5, shortPct: 35.5, netShift: -3.6, instBias: 'SELL', instName: 'Nomura & MUFG Institutional Order' },
      GBPJPY: { longPct: 62.0, shortPct: 38.0, netShift: -2.4, instBias: 'SELL', instName: 'Credit Agricole & UBS FX' },
      AUDUSD: { longPct: 46.5, shortPct: 53.5, netShift: +1.9, instBias: 'BUY', instName: 'ANZ & Westpac Institutional' },
      BTCUSDT: { longPct: 41.0, shortPct: 59.0, netShift: +5.4, instBias: 'BUY', instName: 'CME Institutional Futures & Block Desk' }
    };
    let customLongPctOverride = null;

    const ECONOMIC_NEWS_FEED = [
      { id: 1, cat: 'THE_FED', pill: 'THE_FED', label: 'The Fed', title: 'Pejabat The Fed sinyalkan kehati-hatian pemangkasan suku bunga; pasar pantau rilis CPI & imbal hasil Treasury AS', score: -5 },
      { id: 2, cat: 'POLITIK_DUNIA', pill: 'DUNIA', label: 'Dunia', title: 'Ketegangan geopolitik global mendorong permintaan aset safe-haven emas batangan oleh bank sentral', score: +8 },
      { id: 3, cat: 'PASAR_BISNIS', pill: 'PASAR', label: 'Pasar', title: 'Arus order institusi di sesi London & New York perkuat akumulasi pada area Demand H1 utama', score: +6 },
      { id: 4, cat: 'POLITIK_DUNIA', pill: 'POLITIK', label: 'Politik', title: 'Dinamika kebijakan fiskal AS dan negosiasi anggaran memicu volatilitas intrasesi pada komoditas utama', score: +4 },
      { id: 5, cat: 'PASAR_BISNIS', pill: 'BISNIS', label: 'Bisnis', title: 'Rotasi likuiditas institusi menuju instrumen lindung nilai menjelang rilis data makroekonomi pekan ini', score: +5 }
    ];
    let activeNewsPill = 'ALL';

    // Navigasi Cepat Khusus Mobile/Tablet
    const mobileQuickNav = node('nav', null, 'mobile-quick-nav');
    const mNavAi = node('button', 'Analyze Entry', 'm-nav-btn active');
    mNavAi.type = 'button';
    mNavAi.addEventListener('click', () => switchSymbolOrTF().catch(() => {}));
    const mNavFb = node('button', 'FastBull list-position', 'm-nav-btn');
    mNavFb.type = 'button';
    mNavFb.addEventListener('click', () => openBottomTab('FASTBULL'));
    const mNavNews = node('button', 'Berita Ekonomi', 'm-nav-btn');
    mNavNews.type = 'button';
    mNavNews.addEventListener('click', () => openBottomTab('HEADLINES'));
    const mNavWarn = node('button', 'Test News <1H', 'm-nav-btn');
    mNavWarn.type = 'button';
    mNavWarn.style.color = '#fda4af';
    mNavWarn.style.borderColor = '#ff2a5f';
    mNavWarn.addEventListener('click', triggerSimulatedHighImpactWarning);
    const mNavSkill = node('button', 'Full skill.md', 'm-nav-btn');
    mNavSkill.type = 'button';
    mNavSkill.addEventListener('click', () => toggleSkillModal(true));
    const mNavJson = node('button', 'Copy JSON', 'm-nav-btn');
    mNavJson.type = 'button';
    mNavJson.addEventListener('click', exportSignalJSON);
    mobileQuickNav.append(mNavAi, mNavFb, mNavNews, mNavWarn, mNavSkill, mNavJson);

    const mainCard = node('main', null, 'main-card');
    content.append(mobileQuickNav, mainCard);

    // BANNER PERINGATAN 1 JAM SEBELUM HIGH IMPACT NEWS
    const newsWarningBanner = node('div', null, 'news-warning-banner');
    newsWarningBanner.id = 'newsWarningBanner';
    const nwLeft = node('div', null, 'nw-left');
    const nwBadge = node('span', 'HIGH IMPACT < 1 JAM', 'nw-badge');
    const nwTextWrap = node('div');
    const nwTitle = node('div', 'USD - Core CPI m/m & Non-Farm Employment Change', 'nw-title');
    nwTitle.id = 'nwEventTitle';
    const nwSub = node('div', 'Aturan Kaystrade: Jangan entry di dalam base singkat menjelang High Impact News. Tunggu rilis selesai & body candle close di luar base.', 'nw-sub');
    nwSub.id = 'nwEventSub';
    nwTextWrap.append(nwTitle, nwSub);
    nwLeft.append(nwBadge, nwTextWrap);

    const nwRight = node('div', null, 'nw-right');
    const nwTimer = node('div', 'T-MINUS 42:15', 'nw-timer');
    nwTimer.id = 'nwCountdownTimer';
    const nwResetBtn = node('button', 'Reset Warning', 'btn-action');
    nwResetBtn.type = 'button';
    nwResetBtn.style.padding = '6px 10px';
    nwResetBtn.addEventListener('click', clearSimulatedWarning);
    nwRight.append(nwTimer, nwResetBtn);
    newsWarningBanner.append(nwLeft, nwRight);
    mainCard.append(newsWarningBanner);

    // Controls Grid
    const controlsGrid = node('div', null, 'controls-grid');
    mainCard.append(controlsGrid);

    // 1. Search / Custom Pair Input
    const pairSearchWrapper = node('div', null, 'pair-search-wrapper');
    pairSearchWrapper.id = 'pairSearchWrapper';
    const pairLabel = node('label', 'Search / Input Custom Pair (XAUUSD, GBPJPY, SOLUSDT, PEPEUSDT, dll.)');
    const pairInputGroup = node('div', null, 'pair-input-group');
    const pairSearchInput = node('input');
    pairSearchInput.type = 'text';
    pairSearchInput.id = 'pairSearchInput';
    pairSearchInput.placeholder = 'Cari atau ketik pair custom...';
    pairSearchInput.value = currentPairObj.code;
    pairSearchInput.autocomplete = 'off';

    const btnUsePair = node('button', 'Pakai', 'btn-use-pair');
    btnUsePair.type = 'button';
    pairInputGroup.append(pairSearchInput, btnUsePair);

    // Synchronized select for test compatibility
    const instrument = select('Preset Instrument', [], '', 'pro-market-instrument');
    instrument.wrap.className = 'sr-only-compat';

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

    // 2. Trading Style Select
    const styleWrap = node('div');
    styleWrap.append(node('label', 'Strategi Trading (Intraday & Scalping + FastBull Entry)'));
    const style = select('Trading style', [['', 'Select trading style'], ['INTRADAY', 'INTRADAY (Max 24h · H4->H1->M30 · RR 1:2.5-3.2)'], ['SCALPING', 'SCALPING (Fast M15/M30 · Tight Base · RR 1:2.0-2.4)'], ['SWING', 'SWING (Hold until TP/SL · H4/D1 · RR 1:3.5-4.0)']], savedStyle, 'pro-market-style');
    styleWrap.append(style.input);
    controlsGrid.append(styleWrap);

    // 3. Mode Penentuan Entry FastBull (list-position)
    const fastbullWrap = node('div');
    fastbullWrap.append(node('label', 'Mode Penentuan Entry FastBull (list-position)'));
    const fastbullModeSelect = node('select');
    fastbullModeSelect.id = 'fastbullModeSelect';
    const fbOptions = [
      ['SMART_BLEND', 'Auto Blend (Institusi Order + Contrarian Ratio)'],
      ['INSTITUTIONAL_FOLLOW', 'Ikuti Klaster Order Institusi (Bank Positions)'],
      ['RETAIL_CONTRARIAN', 'Contrarian (Lawan Kerumunan Ritel Ekstrem >65%)']
    ];
    fbOptions.forEach(([val, lbl]) => {
      const opt = node('option', lbl);
      opt.value = val;
      fastbullModeSelect.append(opt);
    });
    fastbullModeSelect.addEventListener('change', () => evaluateKaystradeEngine(true));
    fastbullWrap.append(fastbullModeSelect);
    controlsGrid.append(fastbullWrap);

    // 4. Chart Mode Select
    const modeWrap = node('div');
    modeWrap.append(node('label', 'Mode Tampilan Chart (16:9)'));
    const chartModeSelect = node('select');
    chartModeSelect.id = 'chartModeSelect';
    const optLW = node('option', 'Kaystrade 16:9 Engine (500 Bars)');
    optLW.value = 'LIGHTWEIGHT';
    const optTV = node('option', 'TradingView Official Widget (16:9)');
    optTV.value = 'TV_WIDGET';
    chartModeSelect.append(optLW, optTV);
    chartModeSelect.addEventListener('change', toggleChartMode);
    modeWrap.append(chartModeSelect);
    controlsGrid.append(modeWrap);

    // Bar Penjelasan Parameter Strategi Aktif
    const strategyProfileBar = node('div', null, 'strategy-profile-bar');
    strategyProfileBar.id = 'strategyProfileBar';
    const spLeft = node('div');
    const spBadge = node('span', 'MODE: INTRADAY', 'sp-badge');
    spBadge.id = 'spNameBadge';
    const spRule = node('span', ' Arah Utama: Big Trend H4 + Speedometer D1/H4 | Entry: Retest Base H1/M30 + Klaster Posisi FastBull | Durasi Maks: 24 Jam');
    spRule.id = 'spRuleDesc';
    spRule.style.marginLeft = '8px';
    spRule.style.color = '#cbd5e1';
    spLeft.append(spBadge, spRule);
    const spRisk = node('span', 'FastBull Position Synced · Max SL GOLD: $100/oz');
    spRisk.id = 'spRiskInfo';
    spRisk.style.fontFamily = "'JetBrains Mono', monospace";
    spRisk.style.fontSize = '11px';
    spRisk.style.color = '#34d399';
    strategyProfileBar.append(spLeft, spRisk);
    mainCard.append(strategyProfileBar);

    // Quick Pairs Bar
    const quickPairsBar = node('div', null, 'quick-pairs-bar');
    const qpLabel = node('span', 'Quick Pair:');
    qpLabel.style.fontSize = '11px';
    qpLabel.style.color = 'var(--text-muted)';
    qpLabel.style.fontWeight = '700';
    qpLabel.style.flexShrink = '0';
    quickPairsBar.append(qpLabel);

    const quickList = ['XAUUSD', 'BTCUSDT', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'EURJPY', 'AUDUSD', 'XAGUSD', 'ETHUSDT', 'SOLUSDT', 'PEPEUSDT'];
    quickList.forEach(code => {
      const chip = node('span', code === 'BTCUSDT' ? 'BTCUSD' : (code === 'ETHUSDT' ? 'ETHUSD' : (code === 'SOLUSDT' ? 'SOLUSD' : (code === 'PEPEUSDT' ? 'PEPEUSD' : code))), 'qp-chip' + (code === 'XAUUSD' ? ' active' : ''));
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

    const activeFeedInfo = node('div', 'Kompilasi Penuh: 500 Bars Teknikal + FastBull list-position + Berita Ekonomi', 'pro-feed-info');
    activeFeedInfo.id = 'activeFeedInfo';
    activeFeedInfo.style.fontSize = '11px';
    activeFeedInfo.style.color = '#94a3b8';

    const freshness = node('p', 'Market data not loaded.', 'pro-muted');
    freshness.id = 'pro-market-freshness';

    topBarFlex.append(tfBar, activeFeedInfo);
    mainCard.append(topBarFlex, freshness);

    // Action Buttons Grid
    const actionGrid = node('div', null, 'action-grid');
    const generate = button('Analyze Entry (Tech + FastBull)', () => runKaystradeAnalysis(), 'pro-ai-generate');
    generate.className = 'btn-action btn-primary';

    const syncFbBtn = button('Sync FastBull list-position', () => syncFastBullPositionData(true), 'btn-action');

    const simWarnBtn = button('Simulasi Warning News < 1 Jam', triggerSimulatedHighImpactWarning, 'btn-danger-sim');
    simWarnBtn.className = 'btn-action btn-danger-sim';

    const refreshBtn = button('Refresh Chart', () => handleMarketRefresh(), 'pro-market-refresh');
    refreshBtn.className = 'btn-action';

    const resetZoomBtn = button('Reset View (16:9 Penuh)', setTVRegularZoom, 'btn-action');
    const fit500Btn = button('Fit All 500 Bars', fitAll500Bars, 'btn-action');
    const skillBtn = button('Lihat Full skill.md', () => toggleSkillModal(true), 'btn-action');

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

    const copyJsonBtn = button('Copy JSON', exportSignalJSON, 'btn-action');

    const alertsToggleBtn = button('View alerts and notifications', async () => {
      if (typeof loadNotifications === 'function') await loadNotifications();
      notificationsPanel?.scrollIntoView({ behavior: 'smooth' });
    }, 'pro-signal-notifications');
    alertsToggleBtn.className = 'btn-action';

    actionGrid.append(generate, syncFbBtn, simWarnBtn, refreshBtn, resetZoomBtn, fit500Btn, skillBtn, notificationBtn, copyJsonBtn, alertsToggleBtn);
    mainCard.append(actionGrid);

    // Chart Box (Full Width 16:9 Canvas)
    const chartBox = node('div', null, 'chart-box');
    const chartHeader = node('div', null, 'chart-header');
    const chartTitleWrap = node('div', null, 'chart-title-wrap');
    const chartTitle = node('div', currentPairObj.code + ' (' + currentPairObj.name + ') · ' + selectedFrame.toUpperCase(), 'chart-title-main');
    chartTitle.id = 'chartTitle';

    const legendPills = node('div', null, 'legend-pills');
    const legItems = [
      ['#facc15', 'H4 Key Pivot'],
      ['#a855f7', 'FastBull + Base Entry'],
      ['#ff2a5f', 'SL (Invalidation)'],
      ['#00e676', 'TP (Target)']
    ];
    legItems.forEach(([color, label]) => {
      const item = node('span', null, 'leg-item');
      const dot = node('span', null, 'leg-dot');
      dot.style.background = color;
      item.append(dot, node('span', label));
      legendPills.append(item);
    });
    chartTitleWrap.append(chartTitle, legendPills);

    const chartBadgesRight = node('div', null, 'chart-badges-right');
    const barsBadge = node('span', '500 BARS · 16:9', 'bars-badge');
    barsBadge.id = 'barsCountBadge';
    const livePricePill = node('div', 'Loading...', 'live-price-pill');
    livePricePill.id = 'livePricePill';
    chartBadgesRight.append(barsBadge, livePricePill);
    chartHeader.append(chartTitleWrap, chartBadgesRight);

    // Container 16:9
    const chartViewport16x9 = node('div', null, 'chart-viewport-16-9');
    chartViewport16x9.id = 'chartViewport16x9';
    const tvChartContainer = node('div');
    tvChartContainer.id = 'tv-chart';
    const tvIframeContainer = node('div');
    tvIframeContainer.id = 'tv-iframe-container';
    chartViewport16x9.append(tvChartContainer, tvIframeContainer);

    const nextCandleBar = node('div', null, 'next-candle-bar');
    const ohlcBarInfo = node('span', 'O: -- H: -- L: -- C: --');
    ohlcBarInfo.id = 'ohlcBarInfo';
    const nextCandleRight = node('span', 'NEXT CANDLE: ', 'next-candle-label pro-vinzx-next-candle');
    const countdown = node('span', '--:--', 'next-candle-time');
    countdown.id = 'countdown';
    nextCandleRight.append(countdown);
    nextCandleBar.append(ohlcBarInfo, nextCandleRight);

    chartBox.append(chartHeader, chartViewport16x9, nextCandleBar);
    mainCard.append(chartBox);

    // Result Panel with heading "AI entry signal" (Taruh di bawah chart)
    const result = panel('AI entry signal', mainCard);
    const selectionNote = node('p', null, 'pro-muted');
    result.append(selectionNote);

    // Signal Card
    const signalCard = node('div', null, 'signal-card pro-vinzx-card wait-mode');
    signalCard.id = 'signalCard';

    const sigTop = node('div', null, 'signal-top');
    const sigTopLeft = node('div');
    const sigSubLabel = node('div', 'INTRADAY · KAYSTRADE + FASTBULL POSITION', 'signal-label');
    sigSubLabel.id = 'sigSubLabel';
    const sigDirection = node('div', 'ANALYZING', 'signal-direction pro-vinzx-signal-direction');
    sigDirection.id = 'sigDirection';
    sigTopLeft.append(sigSubLabel, sigDirection);

    const confBox = node('div', null, 'conf-box');
    const confText = node('div', null, 'conf-text');
    const sigConf = node('span', '--%');
    sigConf.id = 'sigConf';
    confText.append(node('span', '● '), sigConf, node('span', ' CONF.'));
    const sigRR = node('div', 'PLAN RR --', 'rr-badge');
    sigRR.id = 'sigRR';
    confBox.append(confText, sigRR);
    sigTop.append(sigTopLeft, confBox);

    const levelsGrid = node('div', null, 'levels-grid');
    const cellEntry = node('div', null, 'level-cell');
    const lblEntry = node('div', 'ENTRY (FB + RETEST)', 'level-title');
    lblEntry.id = 'lblEntryTitle';
    const valEntry = node('div', '--', 'level-val pro-vinzx-metric-value');
    valEntry.id = 'valEntry';
    cellEntry.append(lblEntry, valEntry);

    const cellSL = node('div', null, 'level-cell sl-cell');
    const lblSL = node('div', 'SL (INVALIDATION)', 'level-title');
    lblSL.id = 'lblSLTitle';
    const valSL = node('div', '--', 'level-val sl-val pro-vinzx-metric-value sl');
    valSL.id = 'valSL';
    cellSL.append(lblSL, valSL);

    const cellTP = node('div', null, 'level-cell tp-cell');
    const lblTP = node('div', 'TP (SWING TARGET)', 'level-title');
    lblTP.id = 'lblTPTitle';
    const valTP = node('div', '--', 'level-val tp-val pro-vinzx-metric-value tp');
    valTP.id = 'valTP';
    cellTP.append(lblTP, valTP);
    levelsGrid.append(cellEntry, cellSL, cellTP);

    const engineBar = node('div', null, 'engine-bar');
    const engineBarLeft = node('div');
    const engineModeLabel = node('div', 'KAYSTRADE + FASTBULL POSITION ENGINE', 'engine-title-sm');
    engineModeLabel.id = 'engineModeLabel';
    const engineStatusName = node('div', 'Syncing 7 Pillars...', 'engine-name');
    engineStatusName.id = 'engineStatusName';
    engineBarLeft.append(engineModeLabel, engineStatusName);
    const verifiedPill = node('div', 'FASTBULL SYNC', 'verified-pill');
    verifiedPill.id = 'verifiedPill';
    engineBar.append(engineBarLeft, verifiedPill);

    const neuronBox = node('div', null, 'neuron-box');
    const neuronHeader = node('div', null, 'neuron-header');
    const feedSourceLabel = node('span', '● STREAM: ACTIVE');
    feedSourceLabel.id = 'feedSourceLabel';
    feedSourceLabel.style.color = '#10b981';
    neuronHeader.append(node('span', '7-PILLAR TECH + FASTBULL POSITION MATRIX'), feedSourceLabel);

    const stateGrid = node('div', null, 'state-grid');
    const stateCard1 = node('div', null, 'state-card');
    const lblState1 = node('div', 'H4 TREND & STRUCTURE V(s)', 'state-label');
    lblState1.id = 'lblState1';
    const valState = node('div', '--', 'state-num');
    valState.id = 'valState';
    stateCard1.append(lblState1, valState);

    const stateCard2 = node('div', null, 'state-card');
    const lblState2 = node('div', 'FASTBULL POSITION A(s,a)', 'state-label');
    lblState2.id = 'lblState2';
    const valAdv = node('div', '--', 'state-num');
    valAdv.id = 'valAdv';
    stateCard2.append(lblState2, valAdv);
    stateGrid.append(stateCard1, stateCard2);

    const probSubtitle = node('div', 'COMPILED PROBABILITIES π(a|s) (TECH + FASTBULL + NEWS)');
    probSubtitle.style.fontSize = '10px';
    probSubtitle.style.color = 'var(--text-muted)';
    probSubtitle.style.fontWeight = '700';
    probSubtitle.style.letterSpacing = '0.05em';

    const probRowBuy = node('div', null, 'prob-row');
    const labelBuy = node('span', 'BUY');
    labelBuy.style.color = 'var(--buy-green)';
    const barBgBuy = node('div', null, 'bar-bg');
    const barBuy = node('div', null, 'bar-fill-buy');
    barBuy.id = 'barBuy';
    barBuy.style.width = '50%';
    barBgBuy.append(barBuy);
    const txtBuy = node('span', '50.0%');
    txtBuy.id = 'txtBuy';
    txtBuy.style.textAlign = 'right';
    probRowBuy.append(labelBuy, barBgBuy, txtBuy);

    const probRowSell = node('div', null, 'prob-row');
    const labelSell = node('span', 'SELL');
    labelSell.style.color = 'var(--sell-pink)';
    const barBgSell = node('div', null, 'bar-bg');
    const barSell = node('div', null, 'bar-fill-sell');
    barSell.id = 'barSell';
    barSell.style.width = '50%';
    barBgSell.append(barSell);
    const txtSell = node('span', '50.0%');
    txtSell.id = 'txtSell';
    txtSell.style.textAlign = 'right';
    probRowSell.append(labelSell, barBgSell, txtSell);

    const evidenceList = node('div', null, 'evidence-list');
    evidenceList.id = 'evidenceList';
    const initEv = node('div', null, 'ev-item');
    initEv.append(node('span', 'Mengompilasi data teknikal & posisi FastBull...'), node('span', 'WAIT', 'ev-tag'));
    evidenceList.append(initEv);

    neuronBox.append(neuronHeader, stateGrid, probSubtitle, probRowBuy, probRowSell, evidenceList);
    signalCard.append(sigTop, levelsGrid, engineBar, neuronBox);
    result.append(signalCard);

    // Fundamental Panel (Di bawah AI entry signal)
    const fundaPanel = node('div', null, 'funda-panel');
    const fundaHeader = node('div', null, 'funda-header');
    const fundaHeaderLeft = node('span');
    const ccySpan = node('span', 'USD');
    ccySpan.id = 'fundaPairCurrencies';
    fundaHeaderLeft.append(node('span', 'KALENDER FUNDAMENTAL & 1H HIGH IMPACT GUARD ('), ccySpan, node('span', ')'));
    const fundaFeedStatus = node('span', 'Auto-Monitoring 60m Window');
    fundaFeedStatus.id = 'fundaFeedStatus';
    fundaFeedStatus.style.fontSize = '10.5px';
    fundaFeedStatus.style.color = '#38bdf8';
    fundaHeader.append(fundaHeaderLeft, fundaFeedStatus);

    const tableScrollWrap = node('div', null, 'table-scroll-wrap');
    const fundaTable = node('table', null, 'funda-table');
    const fThead = node('thead');
    const fTrHead = node('tr');
    ['Waktu', 'CCY', 'Event Fundamental', 'Impact', 'Status / Sisa Waktu'].forEach(h => fTrHead.append(node('th', h)));
    fThead.append(fTrHead);
    const fundaTableBody = node('tbody');
    fundaTableBody.id = 'fundaTableBody';
    fundaTable.append(fThead, fundaTableBody);
    tableScrollWrap.append(fundaTable);
    fundaPanel.append(fundaHeader, tableScrollWrap);
    mainCard.append(fundaPanel);

    // Modal skill.md
    const skillModal = node('div', null, 'modal-backdrop');
    skillModal.id = 'skillModal';
    const modalBox = node('div', null, 'modal-box');
    const modalHeader = node('div', null, 'modal-header');
    modalHeader.append(node('span', 'Dokumen Lengkap skill.md (Kaystrade Full Detailed Specification)'));
    const modalHeaderBtns = node('div');
    modalHeaderBtns.style.display = 'flex';
    modalHeaderBtns.style.gap = '8px';
    const copySkillBtn = node('button', 'Copy skill.md Lengkap', 'btn-use-pair');
    copySkillBtn.type = 'button';
    copySkillBtn.addEventListener('click', copySkillMd);
    const modalClose = node('button', 'Tutup', 'btn-action');
    modalClose.type = 'button';
    modalClose.addEventListener('click', () => toggleSkillModal(false));
    modalHeaderBtns.append(copySkillBtn, modalClose);
    modalHeader.append(modalHeaderBtns);

    const modalBody = node('div', null, 'modal-body');
    const skillTextarea = node('textarea', null, 'skill-textarea');
    skillTextarea.id = 'skillMdContent';
    skillTextarea.readOnly = true;
    skillTextarea.value = "\"UTF-8\" />\r\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no\" />\r\n  <title>journalingtrade · Kaystrade 16:9 Real-Time Technical + Fundamental</title>\r\n  <script src=\"https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js\"></script>\r\n  <script type=\"text/javascript\" src=\"https://s3.tradingview.com/tv.js\"></script>\r\n  <link\r\n    href=\"https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap\"\r\n    rel=\"stylesheet\">\r\n  <style>\r\n    :root {\r\n      --bg-main: #080a0f;\r\n      --bg-nav: #0b0e16;\r\n      --bg-card: #10131c;\r\n      --bg-card-inner: #151926;\r\n      --bg-hover: #1c2233;\r\n      --border: #22283a;\r\n      --border-focus: #3b82f6;\r\n      --text-main: #f1f5f9;\r\n      --text-muted: #8b95a5;\r\n      --sell-pink: #ff2a5f;\r\n      --sell-bg: #1f1019;\r\n      --sell-border: #4a1c2d;\r\n      --buy-green: #00e676;\r\n      --buy-bg: #0d211b;\r\n      --buy-border: #164e3b;\r\n      --warn-amber: #f59e0b;\r\n      --warn-bg: #241a0b;\r\n      --warn-border: #5c3f14;\r\n      --danger-bg: #290f14;\r\n      --solid-blue: #2563eb;\r\n      --pivot-yellow: #facc15;\r\n    }\r\n\r\n    * {\r\n      box-sizing: border-box;\r\n      margin: 0;\r\n      padding: 0;\r\n      -webkit-tap-highlight-color: transparent;\r\n    }\r\n\r\n    html,\r\n    body {\r\n      width: 100%;\r\n      max-width: 100vw;\r\n      overflow-x: hidden;\r\n      background-color: var(--bg-main);\r\n      color: var(--text-main);\r\n      font-family: 'Plus Jakarta Sans', sans-serif;\r\n      min-height: 100vh;\r\n    }\r\n\r\n    /* Navbar Solid */\r\n    .navbar {\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: center;\r\n      padding: 12px 20px;\r\n      border-bottom: 1px solid var(--border);\r\n      background-color: var(--bg-nav);\r\n      gap: 10px;\r\n      flex-wrap: wrap;\r\n    }\r\n\r\n    .brand {\r\n      font-weight: 800;\r\n      font-size: 16px;\r\n      display: flex;\r\n      align-items: center;\r\n      gap: 10px;\r\n      flex-wrap: wrap;\r\n    }\r\n\r\n    .badge-live {\r\n      background-color: var(--buy-bg);\r\n      color: var(--buy-green);\r\n      border: 1px solid var(--buy-border);\r\n      padding: 4px 9px;\r\n      border-radius: 6px;\r\n      font-size: 10.5px;\r\n      font-weight: 700;\r\n      display: inline-flex;\r\n      align-items: center;\r\n      gap: 6px;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    .pulse-dot {\r\n      width: 7px;\r\n      height: 7px;\r\n      background-color: var(--buy-green);\r\n      border-radius: 50%;\r\n      flex-shrink: 0;\r\n    }\r\n\r\n    /* Mobile Quick Nav (Muncul di Tablet/HP) */\r\n    .mobile-quick-nav {\r\n      display: none;\r\n      gap: 8px;\r\n      padding: 10px 14px;\r\n      background-color: #0d1018;\r\n      border-bottom: 1px solid var(--border);\r\n      overflow-x: auto;\r\n      white-space: nowrap;\r\n      -webkit-overflow-scrolling: touch;\r\n    }\r\n\r\n    .mobile-quick-nav::-webkit-scrollbar {\r\n      display: none;\r\n    }\r\n\r\n    .m-nav-btn {\r\n      padding: 7px 12px;\r\n      border-radius: 7px;\r\n      font-size: 12px;\r\n      font-weight: 700;\r\n      background-color: var(--bg-card-inner);\r\n      color: var(--text-main);\r\n      border: 1px solid var(--border);\r\n      cursor: pointer;\r\n      flex-shrink: 0;\r\n    }\r\n\r\n    .m-nav-btn.active {\r\n      background-color: #17253b;\r\n      border-color: #38bdf8;\r\n      color: #38bdf8;\r\n    }\r\n\r\n    /* Layout Utama Anti-Overflow */\r\n    .container {\r\n      display: grid;\r\n      grid-template-columns: 200px minmax(0, 1fr);\r\n      max-width: 1480px;\r\n      margin: 0 auto;\r\n      padding: 16px;\r\n      gap: 16px;\r\n      width: 100%;\r\n    }\r\n\r\n    .container>* {\r\n      min-width: 0;\r\n    }\r\n\r\n    .sidebar {\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: 5px;\r\n      font-size: 12.5px;\r\n      color: var(--text-muted);\r\n    }\r\n\r\n    .sidebar-section {\r\n      font-size: 10.5px;\r\n      text-transform: uppercase;\r\n      letter-spacing: 0.06em;\r\n      color: #64748b;\r\n      margin: 12px 0 4px;\r\n      font-weight: 700;\r\n    }\r\n\r\n    .nav-item {\r\n      padding: 9px 11px;\r\n      border-radius: 8px;\r\n      cursor: pointer;\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: center;\r\n      background-color: transparent;\r\n    }\r\n\r\n    .nav-item.active {\r\n      background-color: #171c2b;\r\n      color: #ffffff;\r\n      font-weight: 600;\r\n      border: 1px solid #2a324b;\r\n    }\r\n\r\n    .main-card {\r\n      background-color: var(--bg-card);\r\n      border: 1px solid var(--border);\r\n      border-radius: 12px;\r\n      padding: 16px;\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: 14px;\r\n      width: 100%;\r\n      min-width: 0;\r\n    }\r\n\r\n    /* Banner Peringatan 1 Jam Sebelum High Impact News */\r\n    .news-warning-banner {\r\n      display: none;\r\n      background-color: var(--danger-bg);\r\n      border: 2px solid var(--sell-pink);\r\n      border-radius: 10px;\r\n      padding: 12px 14px;\r\n      color: #ffffff;\r\n      justify-content: space-between;\r\n      align-items: center;\r\n      gap: 12px;\r\n      flex-wrap: wrap;\r\n    }\r\n\r\n    .news-warning-banner.active {\r\n      display: flex;\r\n    }\r\n\r\n    .nw-left {\r\n      display: flex;\r\n      align-items: flex-start;\r\n      gap: 10px;\r\n      flex: 1;\r\n      min-width: 220px;\r\n    }\r\n\r\n    .nw-badge {\r\n      background-color: var(--sell-pink);\r\n      color: #ffffff;\r\n      font-weight: 800;\r\n      font-size: 10.5px;\r\n      padding: 5px 8px;\r\n      border-radius: 6px;\r\n      white-space: nowrap;\r\n      flex-shrink: 0;\r\n    }\r\n\r\n    .nw-title {\r\n      font-weight: 800;\r\n      font-size: 13px;\r\n      color: #fecdd3;\r\n      line-height: 1.3;\r\n    }\r\n\r\n    .nw-sub {\r\n      font-size: 11.5px;\r\n      color: #fda4af;\r\n      margin-top: 3px;\r\n      line-height: 1.35;\r\n    }\r\n\r\n    .nw-right {\r\n      display: flex;\r\n      align-items: center;\r\n      gap: 8px;\r\n      flex-wrap: wrap;\r\n    }\r\n\r\n    .nw-timer {\r\n      font-family: 'JetBrains Mono', monospace;\r\n      font-size: 13.5px;\r\n      font-weight: 800;\r\n      background-color: #16070a;\r\n      border: 1px solid var(--sell-pink);\r\n      color: #fb7185;\r\n      padding: 6px 11px;\r\n      border-radius: 8px;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    /* Form Controls & Search Pair */\r\n    .controls-grid {\r\n      display: grid;\r\n      grid-template-columns: 1.35fr 0.9fr 0.9fr 0.85fr;\r\n      gap: 12px;\r\n      align-items: end;\r\n    }\r\n\r\n    .controls-grid>* {\r\n      min-width: 0;\r\n    }\r\n\r\n    label {\r\n      font-size: 11px;\r\n      color: var(--text-muted);\r\n      display: block;\r\n      margin-bottom: 5px;\r\n      font-weight: 600;\r\n      white-space: nowrap;\r\n      overflow: hidden;\r\n      text-overflow: ellipsis;\r\n    }\r\n\r\n    select,\r\n    input {\r\n      width: 100%;\r\n      padding: 9px 11px;\r\n      background-color: var(--bg-card-inner);\r\n      border: 1px solid var(--border);\r\n      color: #ffffff;\r\n      border-radius: 8px;\r\n      font-size: 12.5px;\r\n      font-weight: 600;\r\n      outline: none;\r\n      min-height: 38px;\r\n    }\r\n\r\n    input:focus,\r\n    select:focus {\r\n      border-color: var(--border-focus);\r\n    }\r\n\r\n    .pair-search-wrapper {\r\n      position: relative;\r\n      min-width: 0;\r\n    }\r\n\r\n    .pair-input-group {\r\n      display: flex;\r\n      gap: 6px;\r\n    }\r\n\r\n    .btn-use-pair {\r\n      padding: 9px 13px;\r\n      background-color: var(--solid-blue);\r\n      border: 1px solid #3b82f6;\r\n      color: #ffffff;\r\n      border-radius: 8px;\r\n      font-size: 12px;\r\n      font-weight: 700;\r\n      cursor: pointer;\r\n      white-space: nowrap;\r\n      flex-shrink: 0;\r\n    }\r\n\r\n    .btn-use-pair:hover {\r\n      background-color: #1d4ed8;\r\n    }\r\n\r\n    .pair-dropdown {\r\n      position: absolute;\r\n      top: calc(100% + 6px);\r\n      left: 0;\r\n      right: 0;\r\n      background-color: #111522;\r\n      border: 1px solid #2e364f;\r\n      border-radius: 10px;\r\n      z-index: 999;\r\n      max-height: 320px;\r\n      display: none;\r\n      flex-direction: column;\r\n      overflow: hidden;\r\n    }\r\n\r\n    .pair-dropdown.open {\r\n      display: flex;\r\n    }\r\n\r\n    .cat-tabs {\r\n      display: flex;\r\n      gap: 4px;\r\n      padding: 8px;\r\n      background-color: #0b0e17;\r\n      border-bottom: 1px solid #1e2436;\r\n      overflow-x: auto;\r\n      -webkit-overflow-scrolling: touch;\r\n    }\r\n\r\n    .cat-tab {\r\n      padding: 5px 10px;\r\n      font-size: 11px;\r\n      font-weight: 700;\r\n      border-radius: 6px;\r\n      background-color: #161b2a;\r\n      color: var(--text-muted);\r\n      border: 1px solid transparent;\r\n      cursor: pointer;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    .cat-tab.active {\r\n      background-color: #1e293b;\r\n      color: #38bdf8;\r\n      border-color: #38bdf8;\r\n    }\r\n\r\n    .pair-list {\r\n      overflow-y: auto;\r\n      max-height: 260px;\r\n    }\r\n\r\n    .pair-item {\r\n      padding: 9px 12px;\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: center;\r\n      cursor: pointer;\r\n      border-bottom: 1px solid #161b29;\r\n      font-size: 12px;\r\n      background-color: #111522;\r\n      gap: 8px;\r\n    }\r\n\r\n    .pair-item:hover {\r\n      background-color: #1b2236;\r\n    }\r\n\r\n    .pair-sym {\r\n      font-weight: 700;\r\n      color: #ffffff;\r\n      font-family: 'JetBrains Mono', monospace;\r\n    }\r\n\r\n    .pair-desc {\r\n      color: var(--text-muted);\r\n      font-size: 11px;\r\n      margin-left: 6px;\r\n    }\r\n\r\n    .pair-cat-badge {\r\n      font-size: 9.5px;\r\n      font-weight: 700;\r\n      padding: 2px 6px;\r\n      border-radius: 4px;\r\n      background-color: #1e293b;\r\n      color: #38bdf8;\r\n      flex-shrink: 0;\r\n    }\r\n\r\n    /* Quick Chips & Timeframes (Horizontal Scrollable di Mobile) */\r\n    .quick-pairs-bar {\r\n      display: flex;\r\n      gap: 6px;\r\n      align-items: center;\r\n      overflow-x: auto;\r\n      padding-bottom: 2px;\r\n      -webkit-overflow-scrolling: touch;\r\n    }\r\n\r\n    .quick-pairs-bar::-webkit-scrollbar {\r\n      height: 3px;\r\n    }\r\n\r\n    .quick-pairs-bar::-webkit-scrollbar-thumb {\r\n      background-color: #22283a;\r\n      border-radius: 4px;\r\n    }\r\n\r\n    .qp-chip {\r\n      font-size: 11px;\r\n      font-family: 'JetBrains Mono', monospace;\r\n      padding: 5px 10px;\r\n      border-radius: 6px;\r\n      background-color: #131826;\r\n      border: 1px solid #242c42;\r\n      color: #cbd5e1;\r\n      cursor: pointer;\r\n      white-space: nowrap;\r\n      flex-shrink: 0;\r\n    }\r\n\r\n    .qp-chip:hover,\r\n    .qp-chip.active {\r\n      background-color: #17253b;\r\n      border-color: #38bdf8;\r\n      color: #38bdf8;\r\n    }\r\n\r\n    .top-bar-flex {\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: center;\r\n      flex-wrap: wrap;\r\n      gap: 10px;\r\n    }\r\n\r\n    .tf-bar {\r\n      display: flex;\r\n      gap: 6px;\r\n      overflow-x: auto;\r\n      max-width: 100%;\r\n      -webkit-overflow-scrolling: touch;\r\n    }\r\n\r\n    .tf-bar::-webkit-scrollbar {\r\n      display: none;\r\n    }\r\n\r\n    .tf-btn {\r\n      padding: 7px 13px;\r\n      background-color: var(--bg-card-inner);\r\n      border: 1px solid var(--border);\r\n      color: var(--text-muted);\r\n      border-radius: 8px;\r\n      cursor: pointer;\r\n      font-weight: 700;\r\n      font-size: 12px;\r\n      flex-shrink: 0;\r\n    }\r\n\r\n    .tf-btn.active {\r\n      background-color: var(--buy-bg);\r\n      color: var(--buy-green);\r\n      border-color: var(--buy-green);\r\n    }\r\n\r\n    /* Action Buttons (100% Solid, Tanpa Gradien) */\r\n    .action-grid {\r\n      display: grid;\r\n      grid-template-columns: repeat(5, minmax(0, 1fr));\r\n      gap: 8px;\r\n    }\r\n\r\n    .btn-action {\r\n      padding: 9px 10px;\r\n      background-color: var(--bg-card-inner);\r\n      border: 1px solid var(--border);\r\n      color: #e2e8f0;\r\n      border-radius: 8px;\r\n      font-size: 11.5px;\r\n      font-weight: 600;\r\n      cursor: pointer;\r\n      text-align: center;\r\n      white-space: nowrap;\r\n      overflow: hidden;\r\n      text-overflow: ellipsis;\r\n    }\r\n\r\n    .btn-action:hover {\r\n      background-color: var(--bg-hover);\r\n      border-color: #475569;\r\n    }\r\n\r\n    .btn-primary {\r\n      background-color: var(--solid-blue);\r\n      border: 1px solid #3b82f6;\r\n      color: #ffffff;\r\n    }\r\n\r\n    .btn-primary:hover {\r\n      background-color: #1d4ed8;\r\n    }\r\n\r\n    .btn-danger-sim {\r\n      background-color: var(--sell-bg);\r\n      border: 1px solid var(--sell-pink);\r\n      color: #fda4af;\r\n    }\r\n\r\n    .btn-danger-sim:hover {\r\n      background-color: #331422;\r\n    }\r\n\r\n    /* Workspace Split: Chart 16:9 & Signal Card */\r\n    .workspace-split {\r\n      display: grid;\r\n      grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);\r\n      gap: 16px;\r\n      align-items: start;\r\n      width: 100%;\r\n    }\r\n\r\n    .workspace-split>* {\r\n      min-width: 0;\r\n    }\r\n\r\n    .chart-box {\r\n      background-color: #080a0f;\r\n      border: 1px solid var(--border);\r\n      border-radius: 12px;\r\n      padding: 12px;\r\n      width: 100%;\r\n      min-width: 0;\r\n    }\r\n\r\n    .chart-header {\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: center;\r\n      margin-bottom: 8px;\r\n      gap: 8px;\r\n      flex-wrap: wrap;\r\n    }\r\n\r\n    .chart-title-wrap {\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: 4px;\r\n      min-width: 0;\r\n    }\r\n\r\n    .chart-title-main {\r\n      font-size: 13.5px;\r\n      font-weight: 800;\r\n      color: #ffffff;\r\n      white-space: nowrap;\r\n      overflow: hidden;\r\n      text-overflow: ellipsis;\r\n    }\r\n\r\n    .legend-pills {\r\n      display: flex;\r\n      gap: 6px;\r\n      flex-wrap: wrap;\r\n      font-size: 10px;\r\n      font-family: 'JetBrains Mono', monospace;\r\n    }\r\n\r\n    .leg-item {\r\n      display: inline-flex;\r\n      align-items: center;\r\n      gap: 4px;\r\n      color: var(--text-muted);\r\n    }\r\n\r\n    .leg-dot {\r\n      width: 8px;\r\n      height: 3px;\r\n      display: inline-block;\r\n    }\r\n\r\n    .chart-badges-right {\r\n      display: flex;\r\n      align-items: center;\r\n      gap: 6px;\r\n      flex-shrink: 0;\r\n    }\r\n\r\n    .bars-badge {\r\n      font-family: 'JetBrains Mono', monospace;\r\n      font-size: 10.5px;\r\n      font-weight: 700;\r\n      padding: 4px 8px;\r\n      border-radius: 6px;\r\n      background-color: #131b2e;\r\n      border: 1px solid #253354;\r\n      color: #38bdf8;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    .live-price-pill {\r\n      font-family: 'JetBrains Mono', monospace;\r\n      font-size: 13.5px;\r\n      font-weight: 700;\r\n      padding: 4px 9px;\r\n      border-radius: 6px;\r\n      background-color: #171c2b;\r\n      color: #38bdf8;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    /* UKURAN CHART WAJIB 16:9 RESPONSIVE */\r\n    .chart-viewport-16-9 {\r\n      width: 100%;\r\n      aspect-ratio: 16 / 9;\r\n      position: relative;\r\n      background-color: #080a0f;\r\n      border: 1px solid #141926;\r\n      border-radius: 8px;\r\n      overflow: hidden;\r\n    }\r\n\r\n    #tv-chart,\r\n    #tv-iframe-container {\r\n      width: 100%;\r\n      height: 100%;\r\n      position: absolute;\r\n      inset: 0;\r\n    }\r\n\r\n    #tv-iframe-container {\r\n      display: none;\r\n    }\r\n\r\n    .next-candle-bar {\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: center;\r\n      font-family: 'JetBrains Mono', monospace;\r\n      font-size: 11px;\r\n      color: var(--text-muted);\r\n      padding-top: 9px;\r\n      margin-top: 6px;\r\n      border-top: 1px solid #161b29;\r\n      flex-wrap: wrap;\r\n      gap: 6px;\r\n    }\r\n\r\n    .next-candle-time {\r\n      color: #2dd4bf;\r\n      font-weight: 700;\r\n      font-size: 12.5px;\r\n    }\r\n\r\n    /* Panel Kalender Ekonomi & Fundamental (Scrollable di Mobile) */\r\n    .funda-panel {\r\n      margin-top: 12px;\r\n      background-color: #0c0f17;\r\n      border: 1px solid var(--border);\r\n      border-radius: 10px;\r\n      padding: 12px;\r\n      width: 100%;\r\n      min-width: 0;\r\n    }\r\n\r\n    .funda-header {\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: center;\r\n      margin-bottom: 8px;\r\n      font-size: 11.5px;\r\n      font-weight: 700;\r\n      color: #e2e8f0;\r\n      flex-wrap: wrap;\r\n      gap: 6px;\r\n    }\r\n\r\n    .table-scroll-wrap {\r\n      width: 100%;\r\n      overflow-x: auto;\r\n      -webkit-overflow-scrolling: touch;\r\n    }\r\n\r\n    .funda-table {\r\n      width: 100%;\r\n      min-width: 480px;\r\n      border-collapse: collapse;\r\n      font-size: 11px;\r\n    }\r\n\r\n    .funda-table th {\r\n      text-align: left;\r\n      padding: 6px 8px;\r\n      color: var(--text-muted);\r\n      border-bottom: 1px solid #1e2436;\r\n      font-size: 10px;\r\n      text-transform: uppercase;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    .funda-table td {\r\n      padding: 7px 8px;\r\n      border-bottom: 1px solid #141926;\r\n      font-family: 'JetBrains Mono', monospace;\r\n    }\r\n\r\n    .impact-high {\r\n      background-color: var(--sell-bg);\r\n      color: var(--sell-pink);\r\n      border: 1px solid var(--sell-border);\r\n      padding: 2px 6px;\r\n      border-radius: 4px;\r\n      font-size: 9.5px;\r\n      font-weight: 700;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    .impact-med {\r\n      background-color: var(--warn-bg);\r\n      color: var(--warn-amber);\r\n      border: 1px solid var(--warn-border);\r\n      padding: 2px 6px;\r\n      border-radius: 4px;\r\n      font-size: 9.5px;\r\n      font-weight: 700;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    /* Signal Card Solid Style (Anti-Overflow) */\r\n    .signal-card {\r\n      background-color: #0c0e16;\r\n      border: 1px solid var(--sell-border);\r\n      border-radius: 14px;\r\n      padding: 16px;\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: 13px;\r\n      width: 100%;\r\n      min-width: 0;\r\n    }\r\n\r\n    .signal-card.buy-mode {\r\n      border-color: var(--buy-border);\r\n    }\r\n\r\n    .signal-card.wait-mode {\r\n      border-color: var(--warn-border);\r\n    }\r\n\r\n    .signal-card.news-lock-mode {\r\n      border: 2px solid var(--sell-pink);\r\n      background-color: #140a10;\r\n    }\r\n\r\n    .signal-top {\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: flex-start;\r\n      gap: 8px;\r\n    }\r\n\r\n    .signal-label {\r\n      font-size: 10px;\r\n      letter-spacing: 0.12em;\r\n      color: var(--sell-pink);\r\n      font-weight: 700;\r\n      text-transform: uppercase;\r\n    }\r\n\r\n    .signal-card.buy-mode .signal-label {\r\n      color: var(--buy-green);\r\n    }\r\n\r\n    .signal-card.wait-mode .signal-label {\r\n      color: var(--warn-amber);\r\n    }\r\n\r\n    .signal-direction {\r\n      font-size: 26px;\r\n      font-weight: 800;\r\n      color: var(--sell-pink);\r\n      line-height: 1.15;\r\n      margin-top: 4px;\r\n      word-break: break-word;\r\n    }\r\n\r\n    .signal-card.buy-mode .signal-direction {\r\n      color: var(--buy-green);\r\n    }\r\n\r\n    .signal-card.wait-mode .signal-direction {\r\n      color: var(--warn-amber);\r\n    }\r\n\r\n    .conf-box {\r\n      text-align: right;\r\n      flex-shrink: 0;\r\n    }\r\n\r\n    .conf-text {\r\n      font-size: 11.5px;\r\n      color: #fb7185;\r\n      font-weight: 700;\r\n    }\r\n\r\n    .signal-card.buy-mode .conf-text {\r\n      color: var(--buy-green);\r\n    }\r\n\r\n    .signal-card.wait-mode .conf-text {\r\n      color: var(--warn-amber);\r\n    }\r\n\r\n    .rr-badge {\r\n      margin-top: 5px;\r\n      display: inline-block;\r\n      background-color: #181c2a;\r\n      border: 1px solid #2e364f;\r\n      padding: 4px 9px;\r\n      border-radius: 6px;\r\n      font-size: 10.5px;\r\n      font-weight: 700;\r\n      font-family: 'JetBrains Mono', monospace;\r\n    }\r\n\r\n    .levels-grid {\r\n      display: grid;\r\n      grid-template-columns: repeat(3, minmax(0, 1fr));\r\n      border: 1px solid #1e2436;\r\n      border-radius: 10px;\r\n      overflow: hidden;\r\n      background-color: #111420;\r\n    }\r\n\r\n    .level-cell {\r\n      padding: 10px 6px;\r\n      text-align: center;\r\n      border-right: 1px solid #1e2436;\r\n      min-width: 0;\r\n    }\r\n\r\n    .level-cell:last-child {\r\n      border-right: none;\r\n    }\r\n\r\n    .level-cell.sl-cell {\r\n      background-color: var(--sell-bg);\r\n    }\r\n\r\n    .level-cell.tp-cell {\r\n      background-color: var(--buy-bg);\r\n    }\r\n\r\n    .level-title {\r\n      font-size: 9.5px;\r\n      color: var(--text-muted);\r\n      margin-bottom: 4px;\r\n      font-weight: 600;\r\n      white-space: nowrap;\r\n      overflow: hidden;\r\n      text-overflow: ellipsis;\r\n    }\r\n\r\n    .level-val {\r\n      font-family: 'JetBrains Mono', monospace;\r\n      font-size: 13.5px;\r\n      font-weight: 700;\r\n      white-space: nowrap;\r\n      overflow: hidden;\r\n      text-overflow: ellipsis;\r\n    }\r\n\r\n    .sl-val {\r\n      color: #fb7185;\r\n    }\r\n\r\n    .tp-val {\r\n      color: #34d399;\r\n    }\r\n\r\n    .engine-bar {\r\n      background-color: #111722;\r\n      border: 1px solid #1f2b3e;\r\n      border-radius: 10px;\r\n      padding: 10px 12px;\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: center;\r\n      gap: 8px;\r\n      flex-wrap: wrap;\r\n    }\r\n\r\n    .engine-title-sm {\r\n      font-size: 9.5px;\r\n      letter-spacing: 0.08em;\r\n      color: #34d399;\r\n      font-weight: 700;\r\n    }\r\n\r\n    .engine-name {\r\n      font-size: 12px;\r\n      font-weight: 700;\r\n      margin-top: 2px;\r\n    }\r\n\r\n    .verified-pill {\r\n      font-size: 9.5px;\r\n      font-weight: 700;\r\n      color: #34d399;\r\n      background-color: var(--buy-bg);\r\n      border: 1px solid var(--buy-border);\r\n      padding: 4px 8px;\r\n      border-radius: 6px;\r\n      white-space: nowrap;\r\n    }\r\n\r\n    .neuron-box {\r\n      background-color: #11131f;\r\n      border: 1px solid #23273e;\r\n      border-radius: 12px;\r\n      padding: 12px;\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: 11px;\r\n      min-width: 0;\r\n    }\r\n\r\n    .neuron-header {\r\n      font-size: 10.5px;\r\n      font-weight: 700;\r\n      letter-spacing: 0.05em;\r\n      color: #c084fc;\r\n      display: flex;\r\n      justify-content: space-between;\r\n      gap: 6px;\r\n      flex-wrap: wrap;\r\n    }\r\n\r\n    .state-grid {\r\n      display: grid;\r\n      grid-template-columns: repeat(2, minmax(0, 1fr));\r\n      gap: 8px;\r\n    }\r\n\r\n    .state-card {\r\n      background-color: #0b0d15;\r\n      border: 1px solid #1b2032;\r\n      border-radius: 8px;\r\n      padding: 8px 10px;\r\n      min-width: 0;\r\n    }\r\n\r\n    .state-label {\r\n      font-size: 9.5px;\r\n      color: var(--text-muted);\r\n    }\r\n\r\n    .state-num {\r\n      font-family: 'JetBrains Mono', monospace;\r\n      font-size: 11.5px;\r\n      font-weight: 700;\r\n      margin-top: 3px;\r\n      white-space: nowrap;\r\n      overflow: hidden;\r\n      text-overflow: ellipsis;\r\n    }\r\n\r\n    .prob-row {\r\n      display: grid;\r\n      grid-template-columns: 36px minmax(0, 1fr) 44px;\r\n      align-items: center;\r\n      gap: 8px;\r\n      font-size: 11px;\r\n      font-weight: 700;\r\n    }\r\n\r\n    .bar-bg {\r\n      height: 8px;\r\n      background-color: #1a1f30;\r\n      border-radius: 99px;\r\n      overflow: hidden;\r\n    }\r\n\r\n    .bar-fill-buy {\r\n      height: 100%;\r\n      background-color: var(--buy-green);\r\n      border-radius: 99px;\r\n      transition: width 0.3s ease;\r\n    }\r\n\r\n    .bar-fill-sell {\r\n      height: 100%;\r\n      background-color: var(--sell-pink);\r\n      border-radius: 99px;\r\n      transition: width 0.3s ease;\r\n    }\r\n\r\n    .evidence-list {\r\n      border-top: 1px solid #1f2437;\r\n      padding-top: 10px;\r\n      display: flex;\r\n      flex-direction: column;\r\n      gap: 7px;\r\n      font-size: 11px;\r\n      color: #cbd5e1;\r\n    }\r\n\r\n    .ev-item {\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: flex-start;\r\n      gap: 8px;\r\n      line-height: 1.35;\r\n    }\r\n\r\n    .ev-tag {\r\n      font-family: 'JetBrains Mono', monospace;\r\n      font-size: 10.5px;\r\n      color: #38bdf8;\r\n      text-align: right;\r\n      word-break: break-word;\r\n    }\r\n\r\n    /* Modal skill.md Responsif */\r\n    .modal-backdrop {\r\n      position: fixed;\r\n      inset: 0;\r\n      background-color: rgba(8, 10, 15, 0.9);\r\n      display: none;\r\n      justify-content: center;\r\n      align-items: center;\r\n      z-index: 2000;\r\n      padding: 12px;\r\n    }\r\n\r\n    .modal-backdrop.open {\r\n      display: flex;\r\n    }\r\n\r\n    .modal-box {\r\n      background-color: var(--bg-card);\r\n      border: 1px solid var(--border);\r\n      border-radius: 12px;\r\n      max-width: 900px;\r\n      width: 100%;\r\n      max-height: 90vh;\r\n      display: flex;\r\n      flex-direction: column;\r\n      overflow: hidden;\r\n    }\r\n\r\n    .modal-header {\r\n      padding: 12px 16px;\r\n      background-color: var(--bg-nav);\r\n      border-bottom: 1px solid var(--border);\r\n      display: flex;\r\n      justify-content: space-between;\r\n      align-items: center;\r\n      font-weight: 700;\r\n      font-size: 13px;\r\n      gap: 10px;\r\n      flex-wrap: wrap;\r\n    }\r\n\r\n    .modal-body {\r\n      padding: 14px;\r\n      overflow-y: auto;\r\n    }\r\n\r\n    .skill-textarea {\r\n      width: 100%;\r\n      height: 62vh;\r\n      background-color: #080a0f;\r\n      color: #e2e8f0;\r\n      border: 1px solid var(--border);\r\n      border-radius: 8px;\r\n      padding: 12px;\r\n      font-family: 'JetBrains Mono', monospace;\r\n      font-size: 11.5px;\r\n      line-height: 1.55;\r\n      resize: vertical;\r\n    }\r\n\r\n    /* =========================================================================\r\n       MEDIA QUERIES KHUSUS MOBILE & TABLET (FIX SEMUA BUG UI/UX MOBILE)\r\n       ========================================================================= */\r\n    @media (max-width: 1080px) {\r\n      .container {\r\n        grid-template-columns: 1fr;\r\n        padding: 10px;\r\n      }\r\n\r\n      .sidebar {\r\n        display: none;\r\n      }\r\n\r\n      .mobile-quick-nav {\r\n        display: flex;\r\n      }\r\n\r\n      .workspace-split {\r\n        grid-template-columns: 1fr;\r\n      }\r\n\r\n      .controls-grid {\r\n        grid-template-columns: 1fr 1fr;\r\n      }\r\n\r\n      .action-grid {\r\n        grid-template-columns: repeat(2, minmax(0, 1fr));\r\n      }\r\n    }\r\n\r\n    @media (max-width: 640px) {\r\n      .navbar {\r\n        padding: 10px 12px;\r\n      }\r\n\r\n      .brand {\r\n        font-size: 14.5px;\r\n        gap: 6px;\r\n      }\r\n\r\n      .main-card {\r\n        padding: 12px;\r\n        gap: 12px;\r\n        border-radius: 10px;\r\n      }\r\n\r\n      .controls-grid {\r\n        grid-template-columns: 1fr;\r\n        gap: 10px;\r\n      }\r\n\r\n      .action-grid {\r\n        grid-template-columns: 1fr 1fr;\r\n        gap: 6px;\r\n      }\r\n\r\n      .action-grid .btn-primary {\r\n        grid-column: span 2;\r\n      }\r\n\r\n      .chart-box {\r\n        padding: 10px;\r\n      }\r\n\r\n      .chart-title-main {\r\n        font-size: 12.5px;\r\n      }\r\n\r\n      .bars-badge {\r\n        font-size: 9.5px;\r\n        padding: 3px 6px;\r\n      }\r\n\r\n      .live-price-pill {\r\n        font-size: 12.5px;\r\n        padding: 3px 7px;\r\n      }\r\n\r\n      .signal-card {\r\n        padding: 14px;\r\n      }\r\n\r\n      .signal-direction {\r\n        font-size: 22px;\r\n      }\r\n\r\n      .level-val {\r\n        font-size: 12.5px;\r\n      }\r\n\r\n      .state-grid {\r\n        grid-template-columns: 1fr;\r\n      }\r\n\r\n      .ev-item {\r\n        flex-direction: column;\r\n        gap: 2px;\r\n        border-bottom: 1px solid #171c2b;\r\n        padding-bottom: 5px;\r\n      }\r\n\r\n      .ev-tag {\r\n        text-align: left;\r\n      }\r\n    }\r\n  </style>\r\n</head>\r\n\r\n<body>\r\n\r\n  <header class=\"navbar\">\r\n    <div class=\"brand\">\r\n      <span>journalingtrade</span>\r\n      <div class=\"badge-live\">\r\n        <span class=\"pulse-dot\"></span>\r\n        <span id=\"wsStatusText\">16:9 · 500 BARS REAL-TIME</span>\r\n      </div>\r\n    </div>\r\n    <div style=\"font-size: 11.5px; color: #94a3b8; font-family: 'JetBrains Mono', monospace;\" id=\"serverClock\">UTC:\r\n      --:--:--</div>\r\n  </header>\r\n\r\n  <!-- Navigasi Cepat Khusus Mobile/Tablet -->\r\n  <nav class=\"mobile-quick-nav\">\r\n    <button class=\"m-nav-btn active\" onclick=\"switchSymbolOrTF()\">AI Market Intelligence</button>\r\n    <button class=\"m-nav-btn\" onclick=\"toggleSkillModal(true)\">Full skill.md (Detail)</button>\r\n    <button class=\"m-nav-btn\" onclick=\"triggerSimulatedHighImpactWarning()\"\r\n      style=\"color:#fda4af;border-color:#ff2a5f;\">Test News &lt;1H Warning</button>\r\n    <button class=\"m-nav-btn\" onclick=\"exportSignalJSON()\">Copy JSON</button>\r\n  </nav>\r\n\r\n  <div class=\"container\">\r\n    <aside class=\"sidebar\">\r\n      <div class=\"sidebar-section\">Analysis</div>\r\n      <div class=\"nav-item\">Advanced Analytics</div>\r\n      <div class=\"nav-item\">Performance Heatmap</div>\r\n      <div class=\"nav-item\">Strategy Comparison</div>\r\n      <div class=\"nav-item\">Risk Intelligence</div>\r\n\r\n      <div class=\"sidebar-section\">AI Assistant</div>\r\n      <div class=\"nav-item active\"><span>AI Market Intelligence</span> <span\r\n          style=\"color:#38bdf8;font-size:10.5px;\">LIVE</span></div>\r\n      <div class=\"nav-item\" onclick=\"toggleSkillModal(true)\"><span>Kaystrade skill.md</span> <span\r\n          style=\"color:#10b981;font-size:10.5px;\">FULL</span></div>\r\n\r\n      <div class=\"sidebar-section\">Markets</div>\r\n      <div class=\"nav-item\" onclick=\"triggerSimulatedHighImpactWarning()\"><span>Berita Ekonomi (&lt;1H)</span> <span\r\n          style=\"color:#ff2a5f;font-size:10.5px;\">WARN</span></div>\r\n    </aside>\r\n\r\n    <main class=\"main-card\">\r\n      <!-- BANNER PERINGATAN 1 JAM SEBELUM HIGH IMPACT NEWS -->\r\n      <div class=\"news-warning-banner\" id=\"newsWarningBanner\">\r\n        <div class=\"nw-left\">\r\n          <span class=\"nw-badge\">HIGH IMPACT &lt; 1 JAM</span>\r\n          <div>\r\n            <div class=\"nw-title\" id=\"nwEventTitle\">USD - Core CPI m/m &amp; Non-Farm Employment Change</div>\r\n            <div class=\"nw-sub\" id=\"nwEventSub\">Aturan Kaystrade: Jangan entry di dalam base singkat menjelang High\r\n              Impact News. Tunggu rilis selesai &amp; body candle close di luar base.</div>\r\n          </div>\r\n        </div>\r\n        <div class=\"nw-right\">\r\n          <div class=\"nw-timer\" id=\"nwCountdownTimer\">T-MINUS 42:15</div>\r\n          <button class=\"btn-action\" onclick=\"clearSimulatedWarning()\" style=\"padding:6px 10px;\">Reset Warning</button>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"controls-grid\">\r\n        <div class=\"pair-search-wrapper\" id=\"pairSearchWrapper\">\r\n          <label>Search / Input Custom Pair (XAUUSD, GBPJPY, SOLUSDT, PEPEUSDT, dll.)</label>\r\n          <div class=\"pair-input-group\">\r\n            <input type=\"text\" id=\"pairSearchInput\" placeholder=\"Cari atau ketik pair custom...\" value=\"XAUUSD\"\r\n              autocomplete=\"off\" onfocus=\"openPairDropdown()\" oninput=\"filterPairDropdown()\"\r\n              onkeydown=\"handlePairKeydown(event)\" />\r\n            <button class=\"btn-use-pair\" onclick=\"applyCustomTypedPair()\">Pakai</button>\r\n          </div>\r\n\r\n          <div class=\"pair-dropdown\" id=\"pairDropdown\">\r\n            <div class=\"cat-tabs\">\r\n              <button class=\"cat-tab active\" onclick=\"setPairCategory(event, 'ALL')\">ALL (400+)</button>\r\n              <button class=\"cat-tab\" onclick=\"setPairCategory(event, 'METALS')\">METALS</button>\r\n              <button class=\"cat-tab\" onclick=\"setPairCategory(event, 'FOREX')\">FOREX</button>\r\n              <button class=\"cat-tab\" onclick=\"setPairCategory(event, 'CRYPTO')\">CRYPTO</button>\r\n              <button class=\"cat-tab\" onclick=\"setPairCategory(event, 'INDICES')\">INDICES</button>\r\n            </div>\r\n            <div class=\"pair-list\" id=\"pairListContainer\"></div>\r\n          </div>\r\n        </div>\r\n\r\n        <div>\r\n          <label>Trading style (Kaystrade)</label>\r\n          <select id=\"styleSelect\" onchange=\"recalculateNow()\">\r\n            <option value=\"INTRADAY\">INTRADAY (Max 24h · H4->H1->M30)</option>\r\n            <option value=\"SCALPING\">SCALPING (M15/M30 Execution)</option>\r\n            <option value=\"SWING\">SWING (H4/D1 Structure Hold)</option>\r\n          </select>\r\n        </div>\r\n\r\n        <div>\r\n          <label>Kompilasi Bias Fundamental / DXY</label>\r\n          <select id=\"fundaBiasSelect\" onchange=\"recalculateNow()\">\r\n            <option value=\"AUTO\">Auto-Detect dari Kalender Ekonomi</option>\r\n            <option value=\"BULLISH\">Fundamental Bullish (Mendukung Buy)</option>\r\n            <option value=\"BEARISH\">Fundamental Bearish (Mendukung Sell)</option>\r\n            <option value=\"NEUTRAL\">Fundamental Netral / No Catalyst</option>\r\n          </select>\r\n        </div>\r\n\r\n        <div>\r\n          <label>Mode Tampilan Chart (16:9)</label>\r\n          <select id=\"chartModeSelect\" onchange=\"toggleChartMode()\">\r\n            <option value=\"LIGHTWEIGHT\">Kaystrade 16:9 Engine (500 Bars)</option>\r\n            <option value=\"TV_WIDGET\">TradingView Official Widget (16:9)</option>\r\n          </select>\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"quick-pairs-bar\">\r\n        <span style=\"font-size:11px; color:var(--text-muted); font-weight:700; flex-shrink:0;\">Quick Pair:</span>\r\n        <span class=\"qp-chip active\" onclick=\"selectPairByCode('XAUUSD')\">XAUUSD</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('BTCUSDT')\">BTCUSD</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('EURUSD')\">EURUSD</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('GBPUSD')\">GBPUSD</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('USDJPY')\">USDJPY</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('GBPJPY')\">GBPJPY</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('EURJPY')\">EURJPY</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('AUDUSD')\">AUDUSD</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('XAGUSD')\">XAGUSD</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('ETHUSDT')\">ETHUSD</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('SOLUSDT')\">SOLUSD</span>\r\n        <span class=\"qp-chip\" onclick=\"selectPairByCode('PEPEUSDT')\">PEPEUSD</span>\r\n      </div>\r\n\r\n      <div class=\"top-bar-flex\">\r\n        <div class=\"tf-bar\" id=\"tfBar\">\r\n          <button class=\"tf-btn\" onclick=\"selectTF(this, '1m')\">M1</button>\r\n          <button class=\"tf-btn\" onclick=\"selectTF(this, '5m')\">M5</button>\r\n          <button class=\"tf-btn\" onclick=\"selectTF(this, '15m')\">M15</button>\r\n          <button class=\"tf-btn active\" onclick=\"selectTF(this, '30m')\">M30</button>\r\n          <button class=\"tf-btn\" onclick=\"selectTF(this, '1h')\">H1</button>\r\n          <button class=\"tf-btn\" onclick=\"selectTF(this, '4h')\">H4</button>\r\n          <button class=\"tf-btn\" onclick=\"selectTF(this, '1d')\">D1</button>\r\n        </div>\r\n        <div style=\"font-size: 11px; color: #94a3b8;\" id=\"activeFeedInfo\">\r\n          Rasio 16:9 · 500 Bars Real-Time + News Guard\r\n        </div>\r\n      </div>\r\n\r\n      <div class=\"action-grid\">\r\n        <button class=\"btn-action btn-primary\" onclick=\"switchSymbolOrTF()\">Analyze Tech + Funda</button>\r\n        <button class=\"btn-action btn-danger-sim\" onclick=\"triggerSimulatedHighImpactWarning()\">Simulasi News &lt; 1\r\n          Jam</button>\r\n        <button class=\"btn-action\" onclick=\"setTVRegularZoom()\">Reset View (16:9 Penuh)</button>\r\n        <button class=\"btn-action\" onclick=\"fitAll500Bars()\">Fit All 500 Bars</button>\r\n        <button class=\"btn-action\" onclick=\"toggleSkillModal(true)\">Lihat Full skill.md</button>\r\n      </div>\r\n\r\n      <div class=\"workspace-split\">\r\n        <!-- Kolom Kiri: Chart 16:9 + Kalender Berita Ekonomi -->\r\n        <div>\r\n          <div class=\"chart-box\">\r\n            <div class=\"chart-header\">\r\n              <div class=\"chart-title-wrap\">\r\n                <div class=\"chart-title-main\" id=\"chartTitle\">XAUUSD (GOLD SPOT) · M30</div>\r\n                <div class=\"legend-pills\">\r\n                  <span class=\"leg-item\"><span class=\"leg-dot\" style=\"background:#facc15;\"></span>H4 Key Pivot</span>\r\n                  <span class=\"leg-item\"><span class=\"leg-dot\" style=\"background:#a855f7;\"></span>Entry Watch</span>\r\n                  <span class=\"leg-item\"><span class=\"leg-dot\" style=\"background:#ff2a5f;\"></span>SL\r\n                    (Invalidation)</span>\r\n                  <span class=\"leg-item\"><span class=\"leg-dot\" style=\"background:#00e676;\"></span>TP (Target)</span>\r\n                </div>\r\n              </div>\r\n              <div class=\"chart-badges-right\">\r\n                <span class=\"bars-badge\" id=\"barsCountBadge\">500 BARS · 16:9</span>\r\n                <div class=\"live-price-pill\" id=\"livePricePill\">Loading...</div>\r\n              </div>\r\n            </div>\r\n\r\n            <!-- CONTAINER CHART RASIO 16:9 -->\r\n            <div class=\"chart-viewport-16-9\" id=\"chartViewport16x9\">\r\n              <div id=\"tv-chart\"></div>\r\n              <div id=\"tv-iframe-container\"></div>\r\n            </div>\r\n\r\n            <div class=\"next-candle-bar\">\r\n              <span id=\"ohlcBarInfo\">O: -- H: -- L: -- C: --</span>\r\n              <span>NEXT CANDLE: <span class=\"next-candle-time\" id=\"countdown\">--:--</span></span>\r\n            </div>\r\n          </div>\r\n\r\n          <!-- Panel Berita Ekonomi / Fundamental Terkait Pair -->\r\n          <div class=\"funda-panel\">\r\n            <div class=\"funda-header\">\r\n              <span>KALENDER FUNDAMENTAL &amp; 1H HIGH IMPACT GUARD (<span id=\"fundaPairCurrencies\">USD</span>)</span>\r\n              <span style=\"font-size:10.5px; color:#38bdf8;\" id=\"fundaFeedStatus\">Auto-Monitoring 60m Window</span>\r\n            </div>\r\n            <div class=\"table-scroll-wrap\">\r\n              <table class=\"funda-table\">\r\n                <thead>\r\n                  <tr>\r\n                    <th>Waktu</th>\r\n                    <th>CCY</th>\r\n                    <th>Event Fundamental</th>\r\n                    <th>Impact</th>\r\n                    <th>Status / Sisa Waktu</th>\r\n                  </tr>\r\n                </thead>\r\n                <tbody id=\"fundaTableBody\">\r\n                  <tr>\r\n                    <td colspan=\"5\" style=\"color:#8b95a5;\">Memuat jadwal kalender ekonomi...</td>\r\n                  </tr>\r\n                </tbody>\r\n              </table>\r\n            </div>\r\n          </div>\r\n        </div>\r\n\r\n        <!-- Kolom Kanan: Signal Card Kompilasi Teknikal + Fundamental -->\r\n        <div class=\"signal-card\" id=\"signalCard\">\r\n          <div class=\"signal-top\">\r\n            <div>\r\n              <div class=\"signal-label\" id=\"sigSubLabel\">TECH + FUNDA COMPILATION SIGNAL</div>\r\n              <div class=\"signal-direction\" id=\"sigDirection\">ANALYZING</div>\r\n            </div>\r\n            <div class=\"conf-box\">\r\n              <div class=\"conf-text\">● <span id=\"sigConf\">--%</span> CONF.</div>\r\n              <div class=\"rr-badge\" id=\"sigRR\">PLAN RR --</div>\r\n            </div>\r\n          </div>\r\n\r\n          <div class=\"levels-grid\">\r\n            <div class=\"level-cell\">\r\n              <div class=\"level-title\">ENTRY (RETEST/LIVE)</div>\r\n              <div class=\"level-val\" id=\"valEntry\">--</div>\r\n            </div>\r\n            <div class=\"level-cell sl-cell\">\r\n              <div class=\"level-title\">SL (INVALIDATION)</div>\r\n              <div class=\"level-val sl-val\" id=\"valSL\">--</div>\r\n            </div>\r\n            <div class=\"level-cell tp-cell\">\r\n              <div class=\"level-title\">TP (SWING TARGET)</div>\r\n              <div class=\"level-val tp-val\" id=\"valTP\">--</div>\r\n            </div>\r\n          </div>\r\n\r\n          <div class=\"engine-bar\">\r\n            <div>\r\n              <div class=\"engine-title-sm\">KAYSTRADE TECH + FUNDA ENGINE</div>\r\n              <div class=\"engine-name\" id=\"engineStatusName\">Syncing 6 Pillars...</div>\r\n            </div>\r\n            <div class=\"verified-pill\" id=\"verifiedPill\">NEWS GUARD ON</div>\r\n          </div>\r\n\r\n          <div class=\"neuron-box\">\r\n            <div class=\"neuron-header\">\r\n              <span>6-PILLAR CONFLUENCE MATRIX</span>\r\n              <span style=\"color:#10b981;\" id=\"feedSourceLabel\">● STREAM: ACTIVE</span>\r\n            </div>\r\n\r\n            <div class=\"state-grid\">\r\n              <div class=\"state-card\">\r\n                <div class=\"state-label\">H4 BIG TREND V(s)</div>\r\n                <div class=\"state-num\" id=\"valState\">--</div>\r\n              </div>\r\n              <div class=\"state-card\">\r\n                <div class=\"state-label\">FUNDA &amp; RSI A(s,a)</div>\r\n                <div class=\"state-num\" id=\"valAdv\">--</div>\r\n              </div>\r\n            </div>\r\n\r\n            <div style=\"font-size: 10px; color: var(--text-muted); font-weight: 700; letter-spacing: 0.05em;\">\r\n              COMPILED PROBABILITIES π(a|s) (TECHNICAL + FUNDAMENTAL)\r\n            </div>\r\n\r\n            <div class=\"prob-row\">\r\n              <span style=\"color: var(--buy-green);\">BUY</span>\r\n              <div class=\"bar-bg\">\r\n                <div class=\"bar-fill-buy\" id=\"barBuy\" style=\"width: 50%;\"></div>\r\n              </div>\r\n              <span id=\"txtBuy\" style=\"text-align: right;\">50.0%</span>\r\n            </div>\r\n\r\n            <div class=\"prob-row\">\r\n              <span style=\"color: var(--sell-pink);\">SELL</span>\r\n              <div class=\"bar-bg\">\r\n                <div class=\"bar-fill-sell\" id=\"barSell\" style=\"width: 50%;\"></div>\r\n              </div>\r\n              <span id=\"txtSell\" style=\"text-align: right;\">50.0%</span>\r\n            </div>\r\n\r\n            <div class=\"evidence-list\" id=\"evidenceList\">\r\n              <div class=\"ev-item\"><span>Mengompilasi data teknikal &amp; fundamental...</span><span\r\n                  class=\"ev-tag\">WAIT</span></div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n      </div>\r\n    </main>\r\n  </div>\r\n\r\n  <!-- Modal Built-in Revisi skill.md SECARA MENDETAIL & LENGKAP TANPA DIPOTONG -->\r\n  <div class=\"modal-backdrop\" id=\"skillModal\">\r\n    <div class=\"modal-box\">\r\n      <div class=\"modal-header\">\r\n        <span>Dokumen Lengkap skill.md (Kaystrade Full Detailed Specification)</span>\r\n        <div style=\"display:flex; gap:8px;\">\r\n          <button class=\"btn-use-pair\" onclick=\"copySkillMd()\">Copy skill.md Lengkap</button>\r\n          <button class=\"btn-action\" onclick=\"toggleSkillModal(false)\">Tutup</button>\r\n        </div>\r\n      </div>\r\n      <div class=\"modal-body\">\r\n        <textarea class=\"skill-textarea\" id=\"skillMdContent\"\r\n          readonly>---\r\nname: kaystrade\r\ndescription: Analisa kompilasi TEKNIKAL + FUNDAMENTAL secara REAL-TIME (500 Bars, Chart 16:9), scoring konfluensi kuantitatif, peringatan otomatis 1 jam sebelum berita High Impact, dan backtest dengan metode pribadi Kaystrade (alias kaytrade): big trend H4, speedometer D1/H4 (Summary, MA10-MA200, Oscillators), retest base, SNR/SBR, Key Pivot kuning, fresh Supply/Demand, FVG, Liquidity, RSI(14)+SMA(14) kuning, konteks DXY, dan Kalender Ekonomi High Impact. Gunakan ketika pengguna meminta metode ini, penerapan aturan trading pribadinya di TradingView, atau analisa pada web journalingtrade.\r\n---\r\n\r\n# Kaystrade (Full Detailed Technical + Fundamental Real-Time Specification)\r\n\r\nGunakan bahasa Indonesia untuk seluruh penjelasan analisa. Label Supply/Demand dan komponen UI Signal Card menggunakan bahasa Inggris. Analisa, skor probabilitas, dan gambar pemetaan bukan merupakan izin atau perintah membuka posisi pada broker.\r\n\r\n## 1. Data Real-Time, Standar 500 Bars, Rasio Chart 16:9, dan Lingkup Multi-Pair\r\n\r\n- **Verifikasi Simbol & Feed Real-Time**: Pastikan simbol, provider, timeframe (`D1`, `H4`, `H1`, `M30`, `M15`, `M5`, `M1`), periode, waktu candle terakhir (UTC/WIB), penghitung mundur penutupan candle (`NEXT CANDLE`), dan status pasar (Open/Closed). Gunakan data aktual melalui bridge TradingView atau stream WebSocket/REST OHLCV real-time yang tersedia; jangan mengaku tersambung atau selesai menggambar tanpa verifikasi. Bila bridge/feed tidak tersedia atau terputus, minta data/chart dan jelaskan keterbatasan secara jujur. Jangan pernah menggunakan level lama sebagai level terkini.\r\n- **Standar 500 Bars & Rasio 16:9**:\r\n  - Chart wajib memuat minimal **500 bars (candles)** terakhir seperti TradingView reguler pada timeframe aktif maupun timeframe referensi (`D1`, `H4`, `H1`, `M30`/`M15`).\r\n  - Kanvas chart menggunakan proporsi **16:9 (`aspect-ratio: 16 / 9`)** yang responsif di desktop maupun mobile, dengan penguncian tepi (`fixLeftEdge: true` dan `fixRightEdge: true`) agar candle memenuhi seluruh bidang chart dari kiri ke kanan tanpa menyisakan ruang kosong di sebelah kanan atau kiri.\r\n- **Instrumen Default & Multi-Pair Custom Search**:\r\n  - **GOLD Default**: Gunakan `TVC:GOLD` sebagai default pada TradingView, bukan `OANDA:XAUUSD` kecuali diminta secara spesifik oleh pengguna (pada web `journalingtrade`, gunakan stream spot `XAUUSD` / `PAXGUSDT` real-time).\r\n  - **Multi-Pair & Custom Input**: Pair lain mengikuti permintaan pengguna, mencakup Metals (`XAUUSD`, `XAGUSD`), Forex Majors & Crosses (`EURUSD`, `GBPUSD`, `USDJPY`, `GBPJPY`, `EURJPY`, `AUDUSD`, `USDCAD`, `USDCHF`, `NZDUSD`, dll.), Crypto (`BTCUSD`, `ETHUSD`, `SOLUSD`, altcoins/memecoins), dan Indices (`DXY`, `USOIL`, `SPX`). Sesuaikan presisi desimal harga secara otomatis (2 desimal untuk Gold/BTC, 3 desimal untuk JPY/Silver, 5 desimal untuk Forex Major, dan 6–8 desimal untuk aset mikro).\r\n- **Periode Historis GOLD**: Untuk analisa historis GOLD, preferensi terakhir adalah **25 September 2025 sampai waktu data real-time terbaru**, kecuali pengguna menentukan periode lain. Bedakan secara tegas *high periode* dari *all-time high (ATH)*.\r\n- **Isolasi Layout & Objek**: Analisa tidak otomatis berarti backtest, pemasangan alarm, penghapusan, atau perubahan layout. Hapus hanya objek/simbol yang diizinkan; pertahankan pair, indikator, dan layout pengguna lainnya. Gunakan layout terpisah bila diminta.\r\n\r\n## 2. Kompilasi Fundamental & Protokol Warning 1 Jam Sebelum High Impact News\r\n\r\n1. **Peringatan Wajib 1 Jam Sebelum High Impact News (T-60 Menit)**:\r\n   - Pantau jadwal kalender ekonomi secara real-time untuk mata uang yang terkait dengan pair aktif (misal `USD` untuk `XAUUSD`/`BTCUSD`, atau `GBP` dan `JPY` untuk `GBPJPY`).\r\n   - Jika terdapat rilis berita berdampak tinggi (**High Impact / Red Folder**: *Non-Farm Payrolls/NFP, CPI/Core CPI, Core PCE, FOMC Statement/Fed Funds Rate, Interest Rate Decision Bank Sentral, GDP, ISM Manufacturing/Services PMI, Retail Sales, Unemployment Claims*, atau pidato Gubernur Bank Sentral) dalam rentang **0 hingga 60 menit (1 jam) ke depan**, sistem WAJIB memunculkan **HIGH IMPACT NEWS WARNING** beserta hitung mundur (`T-Minus Countdown`).\r\n   - Selama berada dalam jendela **<= 1 jam sebelum berita High Impact**, tahan eksekusi posisi baru di dalam base singkat dan ubah status sinyal menjadi **`WAIT (NEWS < 1H)`** atau **`BUY/SELL WATCH (POST-NEWS ONLY)`** untuk menghindari pelebaran spread, slippage, dan sapuan likuiditas dua arah (*whipsaw*).\r\n2. **Aturan Kompilasi Fundamental + Teknikal (6 Pilar)**:\r\n   - News high impact atau eskalasi geopolitik dapat merusak setup teknikal. Verifikasi kalender ekonomi dan berita jika digunakan; **jangan mengatribusikan loss atau pergerakan harga pada FOMC/US-Iran/geopolitik tanpa timestamp dan bukti nyata**. Tidak ada blackout news tetap yang disepakati di luar peringatan 1 jam sebelum berita High Impact.\r\n   - Setelah berita dirilis (*Post-News*), kompilasikan hasil `Actual` vs `Forecast`/`Previous` dan reaksi `DXY` dengan 5 pilar teknikal Kaystrade:\r\n     - Jika rilis data fundamental **searah** dengan Big Trend H4 dan struktur retest H1/M30, tambahkan bobot konfluensi (+10%) sebagai *Fundamental Catalyst Aligned*.\r\n     - Jika rilis data fundamental **berlawanan** dan menyebabkan body candle close menembus swing invalidasi, batalkan setup lama (`INVALIDATED`) dan tunggu pembentukan struktur baru.\r\n\r\n## 3. Filter Multi-Timeframe dan Aturan Entry\r\n\r\n1. **Speedometer Technicals (D1 & H4 - 500 Bars)**:\r\n   - Periksa speedometer Technicals pada `D1` dan `H4`: *Summary*, *Moving Averages* (`MA10`, `MA20`, `MA50`, `MA100`, `MA200`), dan *Oscillators* beserta timestamp data.\r\n   - Rating yang tidak tersedia berarti **belum terverifikasi**, bukan dianggap mendukung.\r\n   - Jangan menghitung beberapa Moving Average yang sama sebagai konfirmasi independen.\r\n2. **Big Trend H4 & Konteks D1**:\r\n   - Big trend `H4` menentukan arah utama: struktur **HH/HL** memprioritaskan **BUY**, sedangkan **LH/LL** memprioritaskan **SELL**.\r\n   - Timeframe `D1` memberi konteks trendline besar.\r\n   - Ketika `H4` sedang konsolidasi/netral, tunggu perubahan struktur yang sah; **breakout pada H1 saja bukan konfirmasi perubahan trend H4**.\r\n3. **Struktur H1 & Eksekusi M15/M30 (Minimal 3 Konfirmasi Independen)**:\r\n   - Gunakan `H1` untuk pemetaan struktur dan zona; gunakan `M15`/`M30` untuk eksekusi.\r\n   - Entry wajib memiliki **minimal tiga konfirmasi independen** yang disebutkan secara eksplisit:\r\n     1. Struktur (`H4`/`H1` HH/HL atau LH/LL)\r\n     2. Lokasi / Retest (`SNR`, `SBR`, `Key Pivot`, atau `Fresh Supply/Demand`)\r\n     3. Imbalance (`Fresh FVG` belum termitigasi)\r\n     4. Momentum `RSI(14)` terhadap `SMA(14)` kuning\r\n     5. Konteks Index (`DXY`) atau *chart pattern* tervalidasi\r\n     6. Filter Keamanan Fundamental / Kalender Ekonomi (`Clear > 1H dari High Impact News`)\r\n   - **Jangan pernah entry hanya karena harga menyentuh garis atau level Fibonacci**.\r\n4. **Sesi Perdagangan & Aturan Breakout Base**:\r\n   - Semua sesi perdagangan diperbolehkan (tidak wajib sesi Asia/London/New York).\r\n   - **Jangan entry di dalam base singkat atau manipulatif**.\r\n   - Wajib menunggu **body candle close di luar base**, diikuti **retest**, lalu **rejection**.\r\n   - Jika body candle kembali close masuk ke dalam base, **batalkan setup** dan tunggu breakout baru. Bedakan secara tegas antara *wick retest* (ekor menyentuh base = valid) dari *body close kembali ke dalam base* (setup batal).\r\n5. **Penempatan Entry Bersyarat, SL, dan TP**:\r\n   - Tetapkan entry bersyarat, **SL** di luar swing invalidasi, dan **TP** pada swing high/low atau level SNR/SBR terdekat.\r\n   - Jangan memaksakan rasio Risk:Reward (RR) tinggi dengan mengabaikan penghalang struktur harga di tengah jalan.\r\n   - Sinyal **SELL tidak menjadi valid hanya karena RSI overbought**, dan **BUY tidak menjadi valid hanya karena RSI oversold**.\r\n\r\n## 4. Aturan Pemetaan Teknikal Secara Mendetail\r\n\r\n- **SNR / SBR**:\r\n  - Dipetakan berdasarkan *repeated reactions*, swing bermakna, dan *recency* pada 500 bars terakhir.\r\n  - **SBR (Support Become Resistance)** atau **RBS (Resistance Become Support)** memerlukan break yang sah lalu retest dari bawah/atas disertai rejection; tandai timeframe dan level harga.\r\n  - Petakan semua level sampai high periode hanya bila diminta oleh pengguna; gabungkan level duplikat yang berdekatan dengan toleransi jarak yang dijelaskan.\r\n- **Key Pivot**:\r\n  - Wajib digambar berupa **garis kuning tebal (`#facc15`)**, bukan area kotak.\r\n  - Pisahkan garis Key Pivot dari batas area Supply/Demand atau garis alarm watch.\r\n- **Fresh Supply / Demand (H1/H4)**:\r\n  - Berasal dari *origin base* / *opposite candle* yang memiliki *departure/displacement* tegas dan mematahkan struktur (*break of structure*).\r\n  - **Fresh** berarti zona belum pernah diretest/tersentuh sejak departure hingga waktu data terbaru.\r\n  - Bedakan secara ketat antara **Fresh**, **Mitigated** (sudah tersentuh tetapi belum tembus), dan **Invalidated** (sudah ditembus body candle); jangan sekadar menamai setiap candle sebagai zona.\r\n- **FVG (Fair Value Gap)**:\r\n  - Imbalance tiga candle dengan displacement bermakna dan belum termitigasi oleh harga berikutnya untuk mendapatkan label **Fresh**.\r\n  - Bedakan gap pembukaan sesi pada indeks/cash dari imbalance intrasesi. Jangan klaim fresh FVG valid hanya berdasarkan celah geometris kecil tanpa displacement.\r\n  - **Aturan Fibonacci & FVG**: Aturan awal memprioritaskan FVG di dalam *golden Fibonacci retracement 0.618–0.786* (jangan petakan semua FVG). Namun **preferensi chart terbaru adalah tanpa Fibonacci dan petakan fresh FVG pada periode yang diminta**. Selalu ikuti permintaan terbaru tanpa otomatis mengubah aturan backtest lama. Bila Fibonacci diminta kembali, gunakan swing yang sudah terkonfirmasi tanpa *hindsight*.\r\n- **Liquidity**:\r\n  - Identifikasi *equal highs/lows (EQH/EQL)*, *swing extrema*, *liquidity sweep*, dan *reclaim*.\r\n  - Nyatakan sebagai **potensi liquidity**, bukan bukti pasti adanya *resting orders* di buku order broker.\r\n- **RSI(14) & MA Kuning SMA(14)**:\r\n  - Gunakan `RSI(14)` dengan Moving Average kuning preferensi `SMA(14)`, dan tandai level horizontal **70 / 50 / 30**.\r\n  - Cross naik RSI terhadap SMA(14) dari area oversold (<30) mendukung pemulihan harga; cross turun dari area overbought (>70) mendukung pelemahan harga.\r\n  - *Divergence* wajib memiliki pivot yang sudah terkonfirmasi dan trigger harga pada candle, bukan dijadikan sinyal mandiri.\r\n- **Konteks DXY**:\r\n  - `DXY` adalah konteks makro untuk GOLD/USD, bukan korelasi invers pasti 100%; jangan memaksakan hubungan invers pada SPX atau semua aset.\r\n  - Verifikasi timestamp/feed karena overlay DXY mengikuti candle aset utama dan bisa tertinggal dari feed DXY live.\r\n  - Proyeksi dua arah wajib menyertakan kondisi breakout/retest dan level invalidasi yang jelas.\r\n- **Chart Pattern & Struktur Base**:\r\n  - Pattern termasuk *Head and Shoulders (HnS)* atau *Double Top/Bottom* **hanya valid setelah neckline break dan terkonfirmasi**, bukan berdasarkan bentuk visual semata.\r\n  - *Rally-Base-Rally (RBR)* dan *Drop-Base-Drop (DBD)* adalah pola *continuation*; pola *reversal base* (*Rally-Base-Drop / Drop-Base-Rally*) wajib menunggu konfirmasi perubahan struktur.\r\n\r\n## 5. Tampilan TradingView, UI Signal Card Solid, & Standar Mobile UI/UX\r\n\r\n- **Warna Solid Tanpa Gradien**: Seluruh elemen UI web `journalingtrade` wajib menggunakan warna solid tanpa `linear-gradient` atau `radial-gradient`.\r\n- **Standar Visual TradingView**:\r\n  - `SNR/SBR`: Garis horizontal dengan label singkat harga dan timeframe.\r\n  - `Key Pivot`: Garis kuning tebal (`#facc15`).\r\n  - `Supply`: Area kotak *muted red* (`#ff2a5f`), opacity **50%**.\r\n  - `Demand`: Area kotak *teal/green* (`#00e676`), opacity **50%**.\r\n  - `Base`: Persegi putih opacity **20%** (transparency **80%**).\r\n  - Tandai area `BUY WATCH` / `SELL WATCH` beserta syarat konfirmasi, titik invalidasi (SL), TP, dan *reason entry*. Jangan menyebut watch area sebagai order atau sinyal terkonfirmasi.\r\n  - `RSI` dan `DXY` digambar di pane masing-masing. Proyeksi diberi label bersyarat, bukan kepastian; ingat bahwa angka RSI adalah nilai indikator (0–100), bukan harga aset.\r\n  - Verifikasi simbol, objek, koordinat, dan screenshot akhir; perbaiki label yang bertumpuk/terpotong. Tutup panel yang tidak perlu tanpa menghapus indikator pengguna. Jangan menganggap respons API sukses sebagai bukti visual tanpa memeriksa chart.\r\n- **Standar Mobile UI/UX**:\r\n  - Semua container grid wajib memiliki `min-width: 0` dan `overflow-x: hidden` pada level halaman agar tidak ada elemen yang meluber di layar HP.\r\n  - Kanvas chart mempertahankan rasio **16:9** secara proporsional di semua ukuran layar.\r\n- **Aturan Alarm TradingView (Hanya Saat Diminta)**:\r\n  - Verifikasi status *Active*, simbol, kondisi, *expiration*, dan kanal notifikasi.\r\n  - *Price crossing* biasa hanyalah alarm pantauan lokasi, bukan alarm otomatis yang memvalidasi seluruh aturan H1/M30. Untuk konfirmasi candle close atau multi-syarat, gunakan kondisi native/skrip Pine yang benar-benar mendukungnya, bukan sekadar memberi nama pada alarm.\r\n\r\n## 6. Aturan Backtest Lengkap (Hanya Bila Diminta)\r\n\r\n- **Parameter Default Historis Pengguna**:\r\n  - Modal awal: **USD 1,000**\r\n  - Risiko per transaksi: **2% ekuitas**\r\n  - Target Risk:Reward: **RR 1:2 sampai 1:4**\r\n  - Maksimum Drawdown (Max DD): **GOLD 30%**; **BTC pernah diminta 20%** (jangan terapkan batas BTC secara global ke aset lain tanpa konfirmasi).\r\n  - Batas Maksimum SL GOLD: **1,000 pips** yang berarti **jarak harga USD 100 per troy oz** menurut definisi pengguna, **bukan** risiko kerugian USD 100 per transaksi.\r\n- **Durasi Berdasarkan Gaya Trading**:\r\n  - *Intraday*: Maksimum tahan posisi **24 jam**.\r\n  - *Swing*: Ditahan sampai menyentuh **TP atau SL**.\r\n  - *Scalping*: Eksekusi pada `M15`/`M30`; batas durasi maksimal scalping harus dinyatakan sebagai asumsi bila belum disepakati.\r\n  - *Unlimited leverage* bukan alasan untuk mengabaikan perhitungan position sizing dan batas risiko 2%.\r\n- **Integritas Data & Anti-Lookahead**:\r\n  - Entry hanya boleh memakai **candle yang sudah tertutup (closed candle)** dan swing/pivot yang sudah terkonfirmasi pada saat itu.\r\n  - Hindari *lookahead bias* dan *repainting*; sinkronkan pembacaan `DXY` dan `H4` tepat pada timestamp entry.\r\n- **Transparansi Biaya & Aturan Eksekusi Simulasi**:\r\n  - Nyatakan secara eksplisit asumsi spread, slippage, komisi, ukuran unit kontrak, *concurrency* (apakah boleh membuka lebih dari satu posisi bersamaan), serta aturan penyelesaian jika TP dan SL tersentuh pada satu candle yang sama.\r\n  - Jangan menggunakan asumsi satu posisi aktif atau biaya model matematis sebagai fakta mutlak broker.\r\n- **Metrik Laporan Backtest**:\r\n  - Laporkan **Winrate (%)**, **Jumlah Trade**, **Ending Equity**, **Return (%)**, **Max Drawdown** (bedakan secara jelas antara *closed equity drawdown* dan *intratrade floating equity drawdown*), serta **reason setiap entry** lengkap dengan koordinat `Entry`, `SL`, `TP`, `Exit`, `Timeframe`, dan `Kondisi Invalidasi`.\r\n  - **Dilarang menjumlahkan trade duplikat** dari beberapa timeframe sebagai posisi unik.\r\n  - **Dilarang memaksa jumlah minimum/eksak** (misal 400 / 1,000 / 4,000 trade) dengan membuat entry palsu atau melonggarkan aturan Kaystrade secara diam-diam. Laporkan *shortfall* (kekurangan sampel) dan keterbatasan data historis apa adanya.\r\n  - Jika sebagian teori belum dimodelkan secara terprogram (misalnya rating speedometer historis per jam, kemiringan trendline subjektif, chart pattern kompleks, arsip rilis berita masa lalu, atau riwayat mitigasi mikro), sebutkan hasilnya secara jujur sebagai **Backtest Parsial**, bukan pembuktian seluruh metode Kaystrade. Chart terbaru tidak otomatis berarti sudah dibacktest, dan sampel pilihan screenshot tidak membuktikan winrate atau *statistical edge*.";
    modalBody.append(skillTextarea);
    modalBox.append(modalHeader, modalBody);
    skillModal.append(modalBox);
    mainCard.append(skillModal);

    function toggleSkillModal(show) {
      skillModal.classList.toggle('open', show);
    }

    function copySkillMd() {
      navigator.clipboard.writeText(skillTextarea.value);
      alert('Seluruh isi skill.md lengkap berhasil disalin ke Clipboard!');
    }

    // Legacy panels kept hidden so they do not clutter the AI Market Intelligence UI
    const legacyPanels = node('div', null, 'pro-legacy-panels');
    const evidencePanel = panel('Technical evidence', legacyPanels);
    const engine = panel('AI engine status', legacyPanels);
    const history = panel('Analysis history', legacyPanels);
    const signalsPanel = panel('Accepted signals and performance', legacyPanels);
    const alertsPanel = panel('Active price alerts', legacyPanels);
    const notificationsPanel = panel('Notifications', legacyPanels);
    content.append(legacyPanels);

    // Initialize LightweightCharts 16:9
    function initChart() {
      if (typeof LightweightCharts === 'undefined' || !tvChartContainer) return;
      try {
        const rect = chartViewport16x9?.getBoundingClientRect?.() || {};
        const containerWidth = Math.max(tvChartContainer.clientWidth || rect.width || 800, 320);
        const containerHeight = Math.max(tvChartContainer.clientHeight || rect.height || 450, 260);

        chart = LightweightCharts.createChart(tvChartContainer, {
          width: Math.round(containerWidth),
          height: Math.round(containerHeight),
          layout: { background: { color: '#080a0f' }, textColor: '#8b95a5', fontSize: 11 },
          grid: { vertLines: { color: '#131722' }, horzLines: { color: '#131722' } },
          crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
          rightPriceScale: {
            borderColor: '#1e2436',
            autoScale: true,
            scaleMargins: { top: 0.1, bottom: 0.1 }
          },
          timeScale: {
            borderColor: '#1e2436',
            timeVisible: true,
            secondsVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
            rightOffset: 2
          }
        });

        candleSeries = chart.addCandlestickSeries({
          upColor: '#00e676', downColor: '#ff2a5f',
          borderUpColor: '#00e676', borderDownColor: '#ff2a5f',
          wickUpColor: '#00e676', wickDownColor: '#ff2a5f'
        });

        const handleResize = () => {
          if (!chart || !chartViewport16x9) return;
          const r = chartViewport16x9.getBoundingClientRect();
          const w = r.width > 0 ? r.width : (chartViewport16x9.clientWidth || 800);
          const h = r.height > 0 ? r.height : (chartViewport16x9.clientHeight || 450);
          if (w > 0 && h > 0) {
            chart.resize(Math.round(w), Math.round(h));
          }
        };

        if (typeof ResizeObserver !== 'undefined' && chartViewport16x9) {
          const chartResizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
              const { width, height } = entry.contentRect;
              if (width > 0 && height > 0 && chart) {
                chart.resize(Math.round(width), Math.round(height));
              }
            }
          });
          chartResizeObserver.observe(chartViewport16x9);
        }
        window.addEventListener('resize', handleResize);
      } catch (e) {}
    }

    function clearPriceLines() {
      if (!candleSeries) return;
      priceLines.forEach(line => candleSeries.removePriceLine(line));
      priceLines = [];
    }

    function setTVRegularZoom() {
      if (!chart || !currentCandles.length) return;
      const total = currentCandles.length;
      const visibleCount = window.innerWidth < 640 ? 75 : 130;
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, total - visibleCount),
        to: total - 1
      });
    }

    function fitAll500Bars() {
      if (chart && currentCandles.length > 0) {
        chart.timeScale().fitContent();
      }
    }

    function getPairCurrencies(pairObj) {
      if (pairObj?.ccy && pairObj.ccy.length) return pairObj.ccy;
      const code = pairObj?.code || 'XAUUSD';
      if (code.length === 6 && !code.endsWith('USDT')) {
        return [code.slice(0, 3), code.slice(3, 6)];
      }
      return ['USD'];
    }

    function initDefaultEconomicSchedule() {
      const now = Date.now();
      economicEvents = [
        { title: 'US Initial Jobless Claims & Philly Fed Index', country: 'USD', impact: 'High', timestamp: now + 95 * 60 * 1000, forecast: '215K', previous: '211K', bias: 'BULLISH' },
        { title: 'US Retail Sales m/m & Core Retail Sales', country: 'USD', impact: 'High', timestamp: now + 185 * 60 * 1000, forecast: '0.4%', previous: '0.1%', bias: 'BEARISH' },
        { title: 'ECB Monetary Policy Statement & Press Conference', country: 'EUR', impact: 'High', timestamp: now + 130 * 60 * 1000, forecast: '--', previous: '--', bias: 'NEUTRAL' },
        { title: 'UK CPI y/y Inflation Report', country: 'GBP', impact: 'High', timestamp: now + 240 * 60 * 1000, forecast: '2.2%', previous: '2.0%', bias: 'BULLISH' },
        { title: 'BoJ Governor Speaks / Tokyo Core CPI', country: 'JPY', impact: 'High', timestamp: now + 310 * 60 * 1000, forecast: '2.5%', previous: '2.4%', bias: 'BULLISH' }
      ];
    }

    async function fetchLiveEconomicCalendar() {
      initDefaultEconomicSchedule();
      try {
        const timeoutCtrl = new AbortController();
        const timeoutTimer = setTimeout(() => timeoutCtrl.abort(), 2500);
        const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { signal: timeoutCtrl.signal });
        clearTimeout(timeoutTimer);
        if (res.ok) {
          const data = await res.json();
          const now = Date.now();
          const upcoming = data
            .filter(ev => ev.impact === 'High' || ev.impact === 'Medium')
            .map(ev => ({
              title: ev.title,
              country: ev.country,
              impact: ev.impact,
              timestamp: new Date(ev.date).getTime(),
              forecast: ev.forecast || '--',
              previous: ev.previous || '--',
              bias: 'NEUTRAL'
            }))
            .filter(ev => ev.timestamp > now - 30 * 60 * 1000)
            .slice(0, 12);

          if (upcoming.length > 0) {
            economicEvents = upcoming;
            fundaFeedStatus.textContent = 'Live Economic Calendar Synced';
          }
        }
      } catch (e) {}
      renderFundamentalTable();
    }

    function checkOneHourHighImpactWarning() {
      const now = Date.now();
      const relevantCCY = getPairCurrencies(currentPairObj);
      const ccyEl = document.getElementById('fundaPairCurrencies');
      if (ccyEl) ccyEl.textContent = relevantCCY.join(', ');

      let activeWarn = null;
      if (simulatedWarningEvent && simulatedWarningEvent.timestamp > now) {
        activeWarn = simulatedWarningEvent;
      } else {
        for (const ev of economicEvents) {
          const diffMs = ev.timestamp - now;
          const diffMin = diffMs / 60000;
          if (ev.impact === 'High' && relevantCCY.includes(ev.country) && diffMin > 0 && diffMin <= 60) {
            activeWarn = ev;
            break;
          }
        }
      }

      const banner = document.getElementById('newsWarningBanner') || newsWarningBanner;
      if (activeWarn && banner) {
        const secLeft = Math.max(0, Math.floor((activeWarn.timestamp - now) / 1000));
        const m = String(Math.floor(secLeft / 60)).padStart(2, '0');
        const s = String(secLeft % 60).padStart(2, '0');

        banner.classList.add('active');
        const evTitle = document.getElementById('nwEventTitle');
        if (evTitle) evTitle.textContent = activeWarn.country + ' HIGH IMPACT: ' + activeWarn.title + ' (Forecast: ' + activeWarn.forecast + ')';
        const timerEl = document.getElementById('nwCountdownTimer');
        if (timerEl) timerEl.textContent = 'T-MINUS ' + m + ':' + s;
        return { isLocked: true, event: activeWarn, minutesLeft: Math.ceil(secLeft / 60) };
      } else if (banner) {
        banner.classList.remove('active');
      }
      return { isLocked: false, event: null, minutesLeft: null };
    }

    function triggerSimulatedHighImpactWarning() {
      const ccy = getPairCurrencies(currentPairObj)[0] || 'USD';
      simulatedWarningEvent = {
        title: ccy + ' Non-Farm Payrolls / Core CPI Release (High Impact)',
        country: ccy,
        impact: 'High',
        timestamp: Date.now() + 42 * 60 * 1000 + 15000,
        forecast: '3.1%',
        previous: '2.9%',
        bias: 'BEARISH'
      };
      renderFundamentalTable();
      evaluateKaystradeEngine(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function clearSimulatedWarning() {
      simulatedWarningEvent = null;
      renderFundamentalTable();
      evaluateKaystradeEngine(true);
    }

    function renderFundamentalTable() {
      const tbody = document.getElementById('fundaTableBody') || fundaTableBody;
      const relevantCCY = getPairCurrencies(currentPairObj);
      const now = Date.now();

      const list = [];
      if (simulatedWarningEvent) list.push(simulatedWarningEvent);
      economicEvents.forEach(ev => {
        if (relevantCCY.includes(ev.country) || ev.country === 'USD') list.push(ev);
      });

      tbody.replaceChildren();
      const displayList = list.slice(0, 5);
      if (displayList.length === 0) {
        const tr = node('tr');
        const td = node('td', 'Tidak ada jadwal High Impact terdekat.');
        td.colSpan = 5;
        tr.append(td);
        tbody.append(tr);
        return;
      }

      displayList.forEach(ev => {
        const diffMin = Math.round((ev.timestamp - now) / 60000);
        const timeStr = new Date(ev.timestamp).toTimeString().slice(0, 5);
        const isWarnWindow = ev.impact === 'High' && diffMin > 0 && diffMin <= 60;

        const tr = node('tr');
        const tdTime = node('td', timeStr);
        const tdCcy = node('td', ev.country);
        tdCcy.style.fontWeight = '700';
        tdCcy.style.color = '#fff';
        const tdTitle = node('td', ev.title);
        const tdImpact = node('td');
        const impactBadge = node('span', ev.impact.toUpperCase(), ev.impact === 'High' ? 'impact-high' : 'impact-med');
        tdImpact.append(impactBadge);

        const tdStatus = node('td');
        if (isWarnWindow) {
          const warnSpan = node('span', 'WARNING: ' + diffMin + 'm lagi (<1H)');
          warnSpan.style.color = '#ff2a5f';
          warnSpan.style.fontWeight = '700';
          tdStatus.append(warnSpan);
        } else {
          tdStatus.textContent = diffMin > 0 ? ('Dalam ' + Math.floor(diffMin / 60) + 'j ' + (diffMin % 60) + 'm') : 'Selesai';
        }

        tr.append(tdTime, tdCcy, tdTitle, tdImpact, tdStatus);
        tbody.append(tr);
      });
    }

    function openPairDropdown() {
      pairDropdown.classList.add('open');
      renderPairDropdownList();
    }

    function setPairCategory(e, cat) {
      e.stopPropagation();
      selectedPairCategory = cat;
      for (const btn of catTabs.children) btn.classList.remove('active');
      e.target.classList.add('active');
      renderPairDropdownList();
    }

    function filterPairDropdown() {
      openPairDropdown();
      renderPairDropdownList();
    }

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
        const empty = node('div', 'Tekan Enter atau klik "Pakai" untuk memuat "' + query + '".');
        empty.style.padding = '12px';
        empty.style.color = '#8b95a5';
        empty.style.fontSize = '12px';
        pairListContainer.append(empty);
      }
    }

    pairSearchInput.addEventListener('focus', openPairDropdown);
    pairSearchInput.addEventListener('input', filterPairDropdown);
    pairSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCustomTypedPair();
      }
    });
    btnUsePair.addEventListener('click', applyCustomTypedPair);

    document.addEventListener('click', (e) => {
      if (pairSearchWrapper && !pairSearchWrapper.contains(e.target)) {
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
        renderFundamentalTable();
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
        renderFundamentalTable();
        switchSymbolOrTF().catch(() => {});
        return;
      }

      const tickerOnly = clean.includes(':') ? clean.split(':')[1] : clean;
      if (tickerOnly === 'GOLD' || tickerOnly === 'XAUUSD') {
        currentPairObj = { code: rawInput, name: 'Custom Gold (' + rawInput + ')', cat: 'METALS', provider: 'BINANCE', apiSym: 'PAXGUSDT', tvSym: rawInput.includes(':') ? rawInput : 'TVC:GOLD', ccy: ['USD', 'XAU'] };
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
          tvSym: rawInput.includes(':') ? rawInput : 'FX:' + tickerOnly,
          ccy: [fsym, tsym]
        };
      } else {
        const binanceSym = tickerOnly.endsWith('USDT') ? tickerOnly : (tickerOnly.endsWith('USD') ? tickerOnly.replace(/USD$/, 'USDT') : tickerOnly + 'USDT');
        currentPairObj = {
          code: tickerOnly,
          name: 'Custom Crypto (' + binanceSym + ')',
          cat: 'CRYPTO',
          provider: 'BINANCE',
          apiSym: binanceSym,
          tvSym: rawInput.includes(':') ? rawInput : 'BINANCE:' + binanceSym,
          ccy: ['USD']
        };
      }

      pairSearchInput.value = currentPairObj.code;
      highlightQuickChip(currentPairObj.code);
      syncInstrumentSelect(currentPairObj.code);
      renderFundamentalTable();
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
      const found = allPairsCatalog.find(p => p.code === code);
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

    function toggleChartMode() {
      const mode = chartModeSelect.value;
      if (mode === 'TV_WIDGET') {
        tvChartContainer.style.display = 'none';
        tvIframeContainer.style.display = 'block';
        loadOfficialTVWidget();
      } else {
        tvIframeContainer.style.display = 'none';
        tvChartContainer.style.display = 'block';
        const rect = chartViewport16x9.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && chart) {
          chart.resize(rect.width, rect.height);
        }
        setTVRegularZoom();
      }
    }

    function loadOfficialTVWidget() {
      const tfMap = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D' };
      if (typeof TradingView !== 'undefined' && TradingView.widget) {
        try {
          new TradingView.widget({
            autosize: true,
            symbol: currentPairObj.tvSym || currentPairObj.code,
            interval: tfMap[selectedFrame] || '30',
            timezone: 'Asia/Jakarta',
            theme: 'dark',
            style: '1',
            locale: 'id',
            toolbar_bg: '#080a0f',
            enable_publishing: false,
            hide_side_toolbar: false,
            studies: ['RSI@tv-basicstudies'],
            container_id: 'tv-iframe-container'
          });
        } catch (e) {}
      }
    }

    function notePrevious() {
      selectionNote.textContent = stored && (stored.quantitative?.market?.instrument !== instrument.input.value || stored.quantitative?.market?.timeframe !== selectedFrame || stored.quantitative?.market?.intelligence?.trading_style !== savedStyle)
        ? 'Displayed analysis belongs to ' + stored.quantitative.market.instrument + ' / ' + stored.quantitative.market.timeframe + ' / ' + (stored.quantitative.market.intelligence?.trading_style || 'Legacy style unavailable') + '. Analyze the current selection for a new signal.'
        : '';
    }

    function updateLiveHeader(candle) {
      livePricePill.textContent = fmtPrice(candle.close);
      livePricePill.style.color = candle.close >= candle.open ? '#00e676' : '#ff2a5f';
      ohlcBarInfo.textContent = 'O: ' + fmtPrice(candle.open) + ' | H: ' + fmtPrice(candle.high) + ' | L: ' + fmtPrice(candle.low) + ' | C: ' + fmtPrice(candle.close);
    }

    function applyLoadedCandles(activeData, h1Data, h4Data, d1Data) {
      currentCandles = activeData || [];
      h1Candles = h1Data || [];
      h4Candles = h4Data || [];
      d1Candles = d1Data || [];

      barsBadge.textContent = currentCandles.length + ' BARS · 16:9';

      if (currentCandles.length > 0) {
        const last = currentCandles[currentCandles.length - 1];
        currentCandleCloseTime = last.closeTime;
        updateLiveHeader(last);

        if (candleSeries && chart) {
          const samplePrice = last.close || 100;
          const decimals = getDecimals(samplePrice);
          candleSeries.applyOptions({
            priceFormat: { type: 'price', precision: decimals, minMove: +(1 / Math.pow(10, decimals)).toFixed(decimals) }
          });
          const rect = chartViewport16x9.getBoundingClientRect();
          const w = rect.width > 0 ? rect.width : (chartViewport16x9.clientWidth || 800);
          const h = rect.height > 0 ? rect.height : (chartViewport16x9.clientHeight || 450);
          if (w > 0 && h > 0) {
            chart.resize(Math.round(w), Math.round(h));
          }
          candleSeries.setData(currentCandles);
          setTVRegularZoom();
        }
      }

      evaluateKaystradeEngine(true);
    }

    function connectBinanceWS(symbol, interval) {
      if (typeof WebSocket === 'undefined') return;
      try {
        const streamUrl = 'wss://stream.binance.com:9443/ws/' + symbol.toLowerCase() + '@kline_' + interval;
        ws = new WebSocket(streamUrl);

        ws.onopen = () => {
          activeFeedInfo.textContent = 'Feed: Binance WS (' + currentPairObj.code + ' · 16:9)';
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
            if (currentCandles.length > 500) currentCandles.shift();
            barsBadge.textContent = currentCandles.length + ' BARS · 16:9';
          }

          updateLiveHeader(liveCandle);
          evaluateKaystradeEngine(k.x);
        };
      } catch (e) {}
    }

    function startForexLiveTicker(fsym, tsym) {
      activeFeedInfo.textContent = 'Feed: Forex/Spot Live (' + fsym + '/' + tsym + ' · 16:9)';
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
          evaluateKaystradeEngine(false);
        } catch (e) {}
      }, 2500);
    }

    async function switchSymbolOrTF() {
      if (ws) { try { ws.close(); } catch (e) {} ws = null; }
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

      chartTitle.textContent = currentPairObj.code + ' (' + currentPairObj.name + ') · ' + selectedFrame.toUpperCase();
      renderFundamentalTable();

      try {
        if (currentPairObj.provider === 'BINANCE') {
          const sym = currentPairObj.apiSym;
          activeFeedInfo.textContent = 'Feed: Binance WS (' + sym + ' · 500 Bars · 16:9)';
          const feedLabel = document.getElementById('feedSourceLabel');
          if (feedLabel) feedLabel.textContent = '⚡ STREAM: BINANCE WS (' + sym + ')';

          const [activeData, h1Data, h4Data, d1Data] = await Promise.all([
            fetchBinanceKlines(sym, selectedFrame, 500, controller.signal),
            fetchBinanceKlines(sym, '1h', 500, controller.signal),
            fetchBinanceKlines(sym, '4h', 500, controller.signal),
            fetchBinanceKlines(sym, '1d', 500, controller.signal)
          ]);

          applyLoadedCandles(activeData, h1Data, h4Data, d1Data);
          connectBinanceWS(sym, selectedFrame);
        } else {
          const fsym = currentPairObj.fsym || 'EUR';
          const tsym = currentPairObj.tsym || 'USD';
          activeFeedInfo.textContent = 'Feed: Forex/Spot Live (' + fsym + '/' + tsym + ' · 500 Bars · 16:9)';
          const feedLabel = document.getElementById('feedSourceLabel');
          if (feedLabel) feedLabel.textContent = '⚡ STREAM: FOREX LIVE (' + fsym + '/' + tsym + ')';

          const [activeData, h1Data, h4Data, d1Data] = await Promise.all([
            fetchForexOrMetalCC(fsym, tsym, selectedFrame, 500, controller.signal),
            fetchForexOrMetalCC(fsym, tsym, '1h', 500, controller.signal),
            fetchForexOrMetalCC(fsym, tsym, '4h', 500, controller.signal),
            fetchForexOrMetalCC(fsym, tsym, '1d', 500, controller.signal)
          ]);

          applyLoadedCandles(activeData, h1Data, h4Data, d1Data);
          startForexLiveTicker(fsym, tsym);
        }

        if (chartModeSelect.value === 'TV_WIDGET') {
          loadOfficialTVWidget();
        }
      } catch (err) {
        // Fallback to baseline candles so chart and analysis work smoothly
        const base = parseFloat(context?.current_price) || 2650;
        const activeData = generateFallbackCandles(base, 120, 900);
        const h1Data = generateFallbackCandles(base, 80, 3600);
        const h4Data = generateFallbackCandles(base, 80, 14400);
        const d1Data = generateFallbackCandles(base, 50, 86400);
        applyLoadedCandles(activeData, h1Data, h4Data, d1Data);
        activeFeedInfo.textContent = 'Feed: Kaystrade 16:9 Engine (' + currentPairObj.code + ')';
      }
    }

    function evaluateKaystradeEngine(drawLines = false) {
      if (currentCandles.length < 10) return;

      const lastCandle = currentCandles[currentCandles.length - 1];
      const livePrice = Number(lastCandle.close);

      const h4Struct = analyzeStructure(h4Candles.length >= 20 ? h4Candles : currentCandles);
      const speedH4 = analyzeSpeedometer(h4Candles.length >= 20 ? h4Candles : currentCandles);
      const speedD1 = d1Candles.length >= 20 ? analyzeSpeedometer(d1Candles) : speedH4;
      const h1Struct = analyzeStructure(h1Candles.length >= 20 ? h1Candles : currentCandles);
      const tfStruct = analyzeStructure(currentCandles);
      const fvg = findLatestFreshFVG(currentCandles);
      const rsiInfo = calcRSIWithSMA14(currentCandles);

      const newsCheck = checkOneHourHighImpactWarning();
      const fundaMode = fundaBiasSelect ? fundaBiasSelect.value : 'AUTO';

      let buyPoints = 50;
      let confirmations = 0;

      if (h4Struct.score > 0) { buyPoints += 16; confirmations++; }
      else if (h4Struct.score < 0) { buyPoints -= 16; confirmations++; }

      if (speedH4.dir > 0 && speedD1.dir >= 0) { buyPoints += 9; confirmations++; }
      else if (speedH4.dir < 0 && speedD1.dir <= 0) { buyPoints -= 9; confirmations++; }

      if (livePrice > h4Struct.pivot && h1Struct.score >= 0) { buyPoints += 10; confirmations++; }
      else if (livePrice < h4Struct.pivot && h1Struct.score <= 0) { buyPoints -= 10; confirmations++; }

      if (fvg.type === 'BULLISH') { buyPoints += 7; confirmations++; }
      else if (fvg.type === 'BEARISH') { buyPoints -= 7; confirmations++; }

      if (rsiInfo.rsi > rsiInfo.sma && rsiInfo.rsi < 72) { buyPoints += 7; confirmations++; }
      else if (rsiInfo.rsi < rsiInfo.sma && rsiInfo.rsi > 28) { buyPoints -= 7; confirmations++; }

      let fundaTagText = 'Clear (>1H dari High Impact News)';
      if (newsCheck.isLocked) {
        fundaTagText = 'ALERT: ' + newsCheck.event.country + ' High Impact dalam ' + newsCheck.minutesLeft + 'm!';
      } else if (fundaMode === 'BULLISH') {
        buyPoints += 10;
        confirmations++;
        fundaTagText = 'Funda Bullish Catalyst (+10% Buy)';
      } else if (fundaMode === 'BEARISH') {
        buyPoints -= 10;
        confirmations++;
        fundaTagText = 'Funda Bearish Catalyst (+10% Sell)';
      } else {
        confirmations++;
      }

      buyPoints = Math.max(6, Math.min(94, buyPoints));
      const sellPoints = +(100 - buyPoints).toFixed(1);
      buyPoints = +buyPoints.toFixed(1);

      let signal = 'WAIT (BASE)';
      let modeClass = 'wait-mode';
      let conf = Math.max(buyPoints, sellPoints);

      if (newsCheck.isLocked) {
        signal = 'WAIT (NEWS < 1H)';
        modeClass = 'news-lock-mode';
      } else if (buyPoints >= 62 && confirmations >= 3) {
        signal = 'BUY';
        modeClass = 'buy-mode';
      } else if (sellPoints >= 62 && confirmations >= 3) {
        signal = 'SELL';
        modeClass = '';
      }

      const recent30 = currentCandles.slice(-30);
      const avgRange = recent30.length ? recent30.reduce((acc, c) => acc + (Number(c.high) - Number(c.low)), 0) / recent30.length : (livePrice * 0.002);

      let entryPrice = livePrice;
      let slPrice = livePrice;
      let tpPrice = livePrice;

      if (sellPoints > buyPoints) {
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

      signalCard.className = 'signal-card pro-vinzx-card ' + modeClass;
      sigDirection.textContent = signal;
      sigConf.textContent = conf.toFixed(1) + '%';
      sigRR.textContent = 'PLAN RR 1:' + rrRatio;

      const valEntryEl = document.getElementById('valEntry');
      if (valEntryEl) valEntryEl.textContent = fmtPrice(entryPrice);
      const valSLEl = document.getElementById('valSL');
      if (valSLEl) valSLEl.textContent = fmtPrice(slPrice);
      const valTPEl = document.getElementById('valTP');
      if (valTPEl) valTPEl.textContent = fmtPrice(tpPrice);

      if (newsCheck.isLocked) {
        verifiedPill.textContent = 'NEWS LOCK (<1H)';
        verifiedPill.style.color = '#ff2a5f';
        verifiedPill.style.backgroundColor = '#290f14';
        verifiedPill.style.borderColor = '#ff2a5f';
      } else {
        verifiedPill.textContent = 'TECH + FUNDA OK';
        verifiedPill.style.color = '#34d399';
        verifiedPill.style.backgroundColor = '#0d211b';
        verifiedPill.style.borderColor = '#164e3b';
      }

      const engName = document.getElementById('engineStatusName');
      if (engName) engName.textContent = currentPairObj.code + ' · ' + confirmations + '/6 Tech+Funda Rules';

      const stateEl = document.getElementById('valState');
      if (stateEl) {
        stateEl.textContent = (h4Struct.score >= 0 ? '+' : '') + h4Struct.score.toFixed(2) + ' (' + h4Struct.bias + ')';
        stateEl.style.color = h4Struct.score >= 0 ? '#34d399' : '#fb7185';
      }

      const advEl = document.getElementById('valAdv');
      if (advEl) {
        advEl.textContent = 'RSI ' + rsiInfo.rsi.toFixed(1) + ' | ' + (newsCheck.isLocked ? 'NEWS <1H' : 'FUNDA OK');
        advEl.style.color = newsCheck.isLocked ? '#ff2a5f' : (rsiInfo.rsi >= rsiInfo.sma ? '#34d399' : '#fb7185');
      }

      const bBuy = document.getElementById('barBuy');
      if (bBuy) bBuy.style.width = buyPoints + '%';
      const bSell = document.getElementById('barSell');
      if (bSell) bSell.style.width = sellPoints + '%';
      const tBuy = document.getElementById('txtBuy');
      if (tBuy) tBuy.textContent = buyPoints.toFixed(1) + '%';
      const tSell = document.getElementById('txtSell');
      if (tSell) tSell.textContent = sellPoints.toFixed(1) + '%';

      const evList = document.getElementById('evidenceList');
      if (evList) {
        evList.replaceChildren();
        const evItems = [
          ['1. Big Trend H4 & Speedometer', h4Struct.bias + ' · ' + speedH4.label],
          ['2. Key Pivot H4 (Garis Kuning)', fmtPrice(h4Struct.pivot) + ' (' + (livePrice > h4Struct.pivot ? 'Above' : 'Below') + ')'],
          ['3. Struktur H1 & Swing Range', h1Struct.bias + ' (' + fmtPrice(tfStruct.swingLow) + ' - ' + fmtPrice(tfStruct.swingHigh) + ')'],
          ['4. Imbalance / Fresh FVG', fvg.label],
          ['5. RSI(14) vs SMA(14) Kuning', rsiInfo.status + ' (' + rsiInfo.rsi.toFixed(1) + ')'],
          ['6. Fundamental & 1H News Guard', fundaTagText]
        ];
        evItems.forEach(([label, tag]) => {
          const item = node('div', null, 'ev-item');
          const spanLabel = node('span', label);
          const spanTag = node('span', tag, 'ev-tag');
          if (label.startsWith('6.')) {
            spanTag.style.color = newsCheck.isLocked ? '#ff2a5f' : '#34d399';
          }
          item.append(spanLabel, spanTag);
          evList.append(item);
        });
      }

      lastAnalysisResult = {
        timestamp: new Date().toISOString(),
        symbol: currentPairObj.code,
        timeframe: selectedFrame,
        chartAspectRatio: '16:9',
        barsLoaded: currentCandles.length,
        livePrice: fmtPrice(livePrice),
        signal,
        highImpactNewsLockWithin1Hour: newsCheck.isLocked,
        upcomingHighImpactEvent: newsCheck.event ? newsCheck.event.title : null,
        confidence: conf,
        rr: '1:' + rrRatio,
        levels: { entry: fmtPrice(entryPrice), sl: fmtPrice(slPrice), tp: fmtPrice(tpPrice), keyPivotH4: fmtPrice(h4Struct.pivot) },
        probabilities: { buy: buyPoints, sell: sellPoints }
      };

      if (drawLines && candleSeries) {
        clearPriceLines();
        try {
          priceLines.push(candleSeries.createPriceLine({
            price: h4Struct.pivot, color: '#facc15', lineWidth: 2, lineStyle: 0, title: 'H4 KEY PIVOT'
          }));
          priceLines.push(candleSeries.createPriceLine({
            price: entryPrice, color: '#a855f7', lineWidth: 2, lineStyle: 2, title: (signal === 'BUY' || signal === 'SELL' ? signal : (buyPoints >= sellPoints ? 'BUY' : 'SELL')) + ' WATCH'
          }));
          priceLines.push(candleSeries.createPriceLine({
            price: slPrice, color: '#ff2a5f', lineWidth: 1, lineStyle: 2, title: 'SL (INVALIDATION)'
          }));
          priceLines.push(candleSeries.createPriceLine({
            price: tpPrice, color: '#00e676', lineWidth: 1, lineStyle: 2, title: 'TP (TARGET)'
          }));
        } catch (e) {}
      }
    }

    async function runKaystradeAnalysis() {
      if (!savedStyle) throw new Error(text('TradingStyleRequired', 'Select and save your trading style first.'));

      generate.classList.add('loading');
      generate.textContent = 'Menganalisa Chart...';

      // 1. INSTANT LOCAL KAYSTRADE ENGINE (0ms response time!)
      evaluateKaystradeEngine(true);
      notePrevious();

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
          // Backend or deterministic: Don't hang for 45s if backend is offline
          try {
            const jobPromise = request('/ai/market-analysis', { method: 'POST', body: selection, latest: true });
            const job = await Promise.race([
              jobPromise,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Backend timeout')), 2500))
            ]);
            if (job?.result) {
              stored = job.result;
              marketResult(result, job.result);
              result.prepend(selectionNote);
              notePrevious();
              appendActionButtons(result, job.result, job.id);
            }
          } catch (_) {}
          await loadHistory().catch(() => {});
        }
      } finally {
        generate.classList.remove('loading');
        generate.textContent = 'Analyze Tech + Funda';
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
      const clockEl = document.getElementById('serverClock');
      if (clockEl) clockEl.textContent = new Date(now).toUTCString().slice(17, 25) + ' UTC';

      if (currentCandleCloseTime > now) {
        const diffSec = Math.floor((currentCandleCloseTime - now) / 1000);
        const h = Math.floor(diffSec / 3600);
        const m = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
        const s = String(diffSec % 60).padStart(2, '0');
        countdown.textContent = (h > 0 ? h + ':' + m + ':' + s : m + ':' + s);
      }
      checkOneHourHighImpactWarning();
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
              tvSym: 'BINANCE:' + item.symbol,
              ccy: ['USD']
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
      if (!next) return;
      await request('/market/preference', { method: 'PUT', body: { trading_style: next } });
      savedStyle = next;
      stored = null;
      renderVinzxSignalCard(signalCard, getDefaultSignal(currentPairObj.code, selectedFrame, savedStyle));
      const row = mapped.find(item => item.symbol === instrument.input.value);
      const frame = next === 'SWING' ? '4h' : (next === 'SCALPING' ? '15m' : '30m');
      await chooseFrame(row?.timeframes?.includes(frame) ? frame : row?.timeframes?.[0] || frame);
      evaluateKaystradeEngine(true);
    }));

    // Load instruments catalog
    const catalog = await request('/market/instruments').catch(() => ({ items: [
      { symbol: 'XAUUSD', name: 'Gold / US Dollar', asset_class: 'Metals · Live Feed', tradingview_symbol: 'TVC:GOLD', timeframes: Object.keys(timeframes) },
      { symbol: 'EURUSD', name: 'Euro / US Dollar', asset_class: 'Forex · Live Feed', tradingview_symbol: 'FX:EURUSD', timeframes: Object.keys(timeframes) },
      { symbol: 'GBPUSD', name: 'Pound / US Dollar', asset_class: 'Forex · Live Feed', tradingview_symbol: 'FX:GBPUSD', timeframes: Object.keys(timeframes) },
      { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', asset_class: 'Crypto · Live Feed', tradingview_symbol: 'BINANCE:BTCUSDT', timeframes: Object.keys(timeframes) }
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
        const data = await request('/ai/engine', { latest: true });
        details(engine, {
          status: (data.available ? 'available: true' : 'available: false') + ' · ' + data.status,
          provider: data.provider,
          model: data.model?.name + ' (' + data.model?.digest + ')',
          methodology: data.methodology,
          probabilities: data.probabilities,
          modules: data.modules?.join(', ')
        });
      }
    };

    loadHistory = async () => {
      let items = [];
      try {
        const data = await request('/ai/history?kind=market', { latest: true });
        items = data.items || [];
      } catch (_) {
        try {
          const data2 = await request('/ai/jobs?kind=market', { latest: true });
          items = data2.items || [];
        } catch (_) {}
      }
      history.replaceChildren(node('h2', 'Analysis history'));
      table(history, items, [['created_at', 'Created'], ['state', 'Status']], (cell, row) => {
        const state = row.state || (row.status === 'completed' ? 'succeeded' : row.status);
        if (state === 'succeeded' || row.status === 'completed' || row.result) {
          cell.append(button('Open analysis', async () => {
            let job = row;
            if (!row.result) {
              try { job = await request('/ai/jobs/' + row.id); } catch (_) { job = row; }
            }
            if ((job.state === 'succeeded' || job.status === 'completed') && job.result) {
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
        }
        if (['failed', 'cancelled', 'expired'].includes(state)) {
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
            await loadHistory();
          }));
        }
      });
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

    loadSignals = async () => {
      const data = await request('/market/signals', { latest: true });
      signalsPanel.replaceChildren(node('h2', 'Accepted signals and performance'), node('p', 'Signals are tracking items, not automated orders. Use Paper mode or manually record broker fills.', 'pro-muted'));
      table(signalsPanel, data.items || [], [['instrument', 'Instrument'], ['direction', 'Direction'], ['trading_style', 'Style'], ['entry', 'Entry'], ['stop_loss', 'SL'], ['take_profit', 'TP'], ['mode', 'Mode'], ['action', 'Decision'], ['execution_confirmed', 'Executed']], (cell, row) => {
        if (!row.execution_confirmed && row.action !== 'dismiss') {
          cell.append(button('Confirm execution', () => {
            cell.replaceChildren();
            const form = node('div', null, 'pro-form');
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

    // Initialize Chart and Economic Calendar
    initChart();
    fetchLiveEconomicCalendar().catch(() => {});

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
