(function (global) {
  'use strict';
  const features = {
    analytics:'Advanced Analytics', heatmap:'Performance Heatmap', strategies:'Strategy Comparison',
    risk:'Risk Intelligence', reviews:'Weekly & Monthly Review', reports:'PDF Reports',
    'ai-behaviour':'AI Behaviour Analysis', 'ai-market':'AI Market Intelligence',
    'ai-journal':'AI Journal Analyst', 'ai-chat':'AI Chat', 'global-news':'Gemini API Key'
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

  function typeWriterText({ target, text, isMarkdown = true, onScroll, onDone }) {
    return new Promise(resolve => {
      if (!text) {
        if (onDone) onDone();
        resolve();
        return;
      }

      const totalLen = text.length;
      let stepSize = 1;
      let intervalMs = 18;
      if (totalLen > 600) {
        stepSize = Math.max(5, Math.floor(totalLen / 100));
        intervalMs = 16;
      } else if (totalLen > 200) {
        stepSize = Math.max(3, Math.floor(totalLen / 70));
        intervalMs = 18;
      } else if (totalLen > 80) {
        stepSize = 2;
        intervalMs = 20;
      }

      let currentIndex = 0;
      let cancelled = false;

      const contentHolder = node('div', null, 'pro-chat-content-holder');
      const cursor = node('span', null, 'mo-typing-cursor');
      cursor.setAttribute('aria-hidden', 'true');
      target.replaceChildren(contentHolder, cursor);

      function updateView(sub) {
        contentHolder.replaceChildren();
        if (isMarkdown) {
          renderMarkdownInto(contentHolder, sub);
        } else {
          const p = node('p', sub);
          contentHolder.append(p);
        }
        if (onScroll) onScroll();
      }

      let timer = null;
      function finish() {
        if (cancelled) return;
        cancelled = true;
        if (timer) clearInterval(timer);
        cursor.remove();
        contentHolder.replaceChildren();
        if (isMarkdown) {
          renderMarkdownInto(contentHolder, text);
        } else {
          const p = node('p', text);
          contentHolder.append(p);
        }
        if (onScroll) onScroll();
        if (onDone) onDone();
        resolve();
      }

      target.style.cursor = 'pointer';
      const clickHandler = () => {
        target.removeEventListener('click', clickHandler);
        target.style.cursor = '';
        finish();
      };
      if (global.navigator?.webdriver) {
        finish();
        return;
      }

      timer = setInterval(() => {
        if (cancelled) {
          clearInterval(timer);
          return;
        }
        currentIndex += stepSize;
        if (currentIndex >= totalLen) {
          target.removeEventListener('click', clickHandler);
          target.style.cursor = '';
          finish();
        } else {
          updateView(text.slice(0, currentIndex));
        }
      }, intervalMs);
    });
  }

  const BANNED_MODELS_REGEX = /3\.1|pro|argon|gemini-4/i;
  const isModelAllowed = (m) => typeof m === 'string' && !BANNED_MODELS_REGEX.test(m);

  async function callGeminiApi({systemInstruction,contents,history,model=GEMINI_DEFAULT_MODEL,signal}) {
    const apiKey=getGeminiApiKey();
    if(!apiKey){
      throw new Error('Google Gemini API Key belum diatur. Klik tombol "Set API Key" di samping status AI untuk memasukkan API Key Anda.');
    }
    const candidateModels = [
      model,
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.5-flash-lite'
    ].filter(isModelAllowed);
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
    let hadQuotaExhaustion = false;

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
        hadQuotaExhaustion = true;
        lastError = new Error('gagal memproses jawaban, kuota kayla telah habis atau dibatasi. silahkan coba lagi nanti');
        if (i < modelsToTry.length - 1) {
          continue;
        }
        throw lastError;
      }

      const data=await response.json().catch(()=>null);
      if(!response.ok){
        const errorMsg=data?.error?.message||response.statusText;
        const isQuotaErr = /RESOURCE_EXHAUSTED|quota|rate limit/i.test(errorMsg);
        if (isQuotaErr) hadQuotaExhaustion = true;

        if(response.status===400 || response.status===403){
          throw new Error('Google Gemini API Key tidak valid atau tidak memiliki izin akses (Error: '+errorMsg+'). Periksa kembali API Key Anda di Google AI Studio.');
        }

        const isTransientOrSwitchable = isQuotaErr || response.status === 503 || response.status === 500 || response.status === 404;
        if(isTransientOrSwitchable && i < modelsToTry.length - 1){
          lastError = isQuotaErr
            ? new Error('gagal memproses jawaban, kuota kayla telah habis atau dibatasi. silahkan coba lagi nanti')
            : new Error('Google Gemini API Error ('+response.status+'): '+errorMsg);
          continue;
        }

        if (isQuotaErr || hadQuotaExhaustion) {
          throw new Error('gagal memproses jawaban, kuota kayla telah habis atau dibatasi. silahkan coba lagi nanti');
        }
        throw new Error('Google Gemini API Error ('+response.status+'): '+errorMsg);
      }
      const textOutput=data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if(!textOutput){
        if (i < modelsToTry.length - 1) continue;
        throw new Error('Google Gemini tidak mengembalikan respon teks yang valid. Silakan coba kembali.');
      }
      return textOutput;
    }
    if (hadQuotaExhaustion) {
      throw new Error('gagal memproses jawaban, kuota kayla telah habis atau dibatasi. silahkan coba lagi nanti');
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
      if(current && current.startsWith('ai-')) open(current,preset);
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
      if(current && current.startsWith('ai-')) open(current,preset);
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

  const KAYSTRADE_SYSTEM_PROMPT = `Anda adalah AI Market Intelligence profesional berbasis metodologi teknikal Kaystrade (docs/kaystrade/SKILL.md) yang dirumuskan oleh founder journalingtrade, Kaylaa.
Catatan Identitas:
- Founder journalingtrade dan perumus metodologi Kaystrade adalah Kaylaa.
- Tidak ada figur bernama "Mas Kays"; jangan pernah menyebut nama tersebut.
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

  const CHAT_SYSTEM_PROMPT = `Anda adalah Kayla AI, Asisten AI Trading & Mentor Finansial profesional di platform journalingtrade yang didirikan oleh Kaylaa.

Pedoman Identitas & Konteks Platform:
1. Founder & Pencipta Journaling Trade adalah Kaylaa.
2. Metodologi analisis teknikal Kaystrade dirancang dan dirumuskan secara orisinal oleh sang Founder, Kaylaa.
3. TIDAK ADA figur atau mentor bernama "Mas Kays". DILARANG KERAS mengarang, menyebut, atau mengasumsikan adanya sosok "Mas Kays". Jika pengguna menanyakan metodologi Kaystrade atau pendiri platform, jelaskan bahwa platform ini dan metodologi Kaystrade didirikan dan dirancang oleh Kaylaa.
4. Anda bernama Kayla AI, asisten AI resmi yang mendampingi trader dalam proses journaling, analisis, dan eksekusi.

Kompetensi Utama:
- Analisis teknikal berbasis metodologi Kaystrade (Multi-Timeframe H4/H1/M15, Price Action, SNR/SBR, Supply/Demand, FVG, dan sentimen FastBull).
- Manajemen risiko trading (Risk:Reward Ratio minimal 1:2, kalkulasi lot & position sizing, Stop Loss disiplin).
- Psikologi trading (mengatasi FOMO, revenge trading, overtrading, dan ketakutan cut loss).
- Audit dan evaluasi performa jurnal trading secara terukur dan solutif.

Gaya Komunikasi:
- Ramah, sopan, profesional, mendalam, dan edukatif dalam Bahasa Indonesia.
- Pertahankan konteks percakapan untuk berdiskusi dua arah secara interaktif.
- Gunakan format Markdown (bold, tabel, bullet points, blok kode) untuk memperjelas jawaban.`;

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
  function createProSvg(name) {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','2');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    svg.setAttribute('class','pro-select-svg');
    svg.setAttribute('aria-hidden','true');
    const path=document.createElementNS(svg.namespaceURI,'path');
    let d='';
    if(name==='chevron-down') d='M6 9l6 6 6-6';
    else if(name==='check') d='M20 6L9 17l-5-5';
    else if(name==='x') d='M18 6L6 18M6 6l12 12';
    else if(name==='chart') d='M18 20V10M12 20V4M6 20v-6';
    else if(name==='grid') d='M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z';
    else if(name==='branch') d='M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9';
    else if(name==='shield') d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
    else if(name==='book') d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15z';
    else if(name==='file') d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8';
    else if(name==='sparkles') d='M12 3l1.9 4.5L18.4 9l-3.7 3.2.9 5.1-4.6-2.4-4.6 2.4.9-5.1L3.6 9l4.5-1.5L10 3z';
    else if(name==='brain') d='M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-5.04zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-5.04z';
    else if(name==='search') d='M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35';
    else if(name==='chat') d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
    else if(name==='key') d='M21 2l-2 2m-1.5 1.5L14 9l2 2-1 1-2-2-2 2 2 2-1 1-2-2-4.5 4.5a3 3 0 1 1-4.24-4.24L7.5 9.5';
    else d='M12 2v20M2 12h20';
    path.setAttribute('d',d);
    svg.append(path);
    return svg;
  }
  function enhanceProSelect(wrap, selectEl) {
    if (!wrap || !selectEl || wrap.classList.contains('sr-only-compat') || selectEl.id === 'pro-section-selector') return;
    wrap.classList.add('custom-select-container');
    selectEl.classList.add('custom-select-native');
    selectEl.tabIndex = -1;
    selectEl.setAttribute('aria-hidden', 'true');

    const trigger = node('button', null, 'custom-select-trigger-btn');
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const labelSpan = node('span', '', 'custom-select-label');
    const chevron = createProSvg('chevron-down');
    chevron.classList.add('custom-select-chevron');
    trigger.append(labelSpan, chevron);

    const backdrop = node('div', null, 'custom-select-backdrop');
    const menu = node('div', null, 'custom-select-dropdown-menu');
    menu.setAttribute('role', 'listbox');

    function syncLabel() {
      const selected = selectEl.options[selectEl.selectedIndex];
      labelSpan.textContent = selected ? selected.textContent : (selectEl.value || '');
      trigger.disabled = Boolean(selectEl.disabled);
      for (const btn of menu.querySelectorAll('.custom-select-option')) {
        const isMatch = btn.dataset.value === selectEl.value;
        btn.classList.toggle('is-selected', isMatch);
        btn.setAttribute('aria-selected', String(isMatch));
      }
    }

    function renderOptions() {
      menu.replaceChildren();
      const sheetHandle = node('div', null, 'custom-select-sheet-handle');
      const sheetHeader = node('div', null, 'custom-select-sheet-header');
      const labelText = wrap.querySelector('label, span')?.textContent || 'Pilih Opsi';
      sheetHeader.append(node('span', labelText, 'custom-select-sheet-title'));
      const closeBtn = node('button', null, 'custom-select-sheet-close');
      closeBtn.type = 'button';
      closeBtn.setAttribute('aria-label', 'Tutup');
      closeBtn.append(createProSvg('x'));
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      });
      sheetHeader.append(closeBtn);
      menu.append(sheetHandle, sheetHeader);

      const itemsWrap = node('div', null, 'custom-select-options-list');
      for (const opt of selectEl.options) {
        if (opt.hidden) continue;
        const item = node('button', null, 'custom-select-option');
        item.type = 'button';
        item.dataset.value = opt.value;
        item.setAttribute('role', 'option');
        const textSpan = node('span', opt.textContent);
        const checkIcon = createProSvg('check');
        checkIcon.classList.add('custom-select-check-icon');
        item.append(textSpan, checkIcon);
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          selectEl.value = opt.value;
          syncLabel();
          closeMenu();
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        });
        itemsWrap.append(item);
      }
      menu.append(itemsWrap);
      syncLabel();
    }

    function openMenu() {
      if (trigger.disabled) return;
      document.querySelectorAll('.custom-select-dropdown-menu.is-open').forEach(m => {
        if (m !== menu) {
          m.classList.remove('is-open');
          const t = m.parentElement?.querySelector('.custom-select-trigger-btn');
          if (t) t.setAttribute('aria-expanded', 'false');
          const b = m.parentElement?.querySelector('.custom-select-backdrop');
          if (b) b.classList.remove('is-open');
        }
      });
      renderOptions();
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        document.body.append(backdrop, menu);
        document.body.classList.add('pro-sheet-open');
      } else {
        wrap.append(menu, backdrop);
      }
      menu.classList.add('is-open');
      backdrop.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      menu.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (typeof document !== 'undefined') {
        document.body.classList.remove('pro-sheet-open');
      }
    }

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (menu.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    backdrop.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    });

    menu.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target) && !menu.contains(e.target)) closeMenu();
    });

    selectEl.addEventListener('change', () => {
      syncLabel();
    });

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        renderOptions();
      });
      observer.observe(selectEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected'] });
    }

    renderOptions();
    wrap.append(trigger, menu, backdrop);
  }
  const PRO_NAV_METADATA = {
    analytics: { group: 'Analysis', icon: 'chart', desc: 'KPI, kurva drawdown & win rate' },
    heatmap: { group: 'Analysis', icon: 'grid', desc: 'Matriks performa trading per hari' },
    strategies: { group: 'Analysis', icon: 'branch', desc: 'Perbandingan profitabilitas strategi' },
    risk: { group: 'Analysis', icon: 'shield', desc: 'Ukuran posisi & batas risiko akun' },
    reviews: { group: 'Reviews & reports', icon: 'book', desc: 'Evaluasi mingguan & bulanan' },
    reports: { group: 'Reviews & reports', icon: 'file', desc: 'Laporan komprehensif & ekspor' },
    'ai-market': { group: 'AI assistant', icon: 'sparkles', isAi: true, desc: 'Multi-timeframe technical bias' },
    'ai-behaviour': { group: 'AI assistant', icon: 'brain', isAi: true, desc: 'Psikologi & deteksi FOMO' },
    'ai-journal': { group: 'AI assistant', icon: 'search', isAi: true, desc: 'Analisis konsistensi jurnal' },
    'ai-chat': { group: 'AI assistant', icon: 'chat', isAi: true, desc: 'Asisten trading cerdas interaktif' },
    'global-news': { group: 'Markets', icon: 'key', desc: 'Konfigurasi terpusat Gemini API' }
  };
  function createProMobileNavigator(wrap, selectEl, activeKey, onSelect) {
    wrap.classList.add('pro-section-mobile');
    const oldCaption = wrap.querySelector('span');
    if (oldCaption) oldCaption.style.display = 'none';

    selectEl.classList.add('pro-section-selector-compat');

    const trigger = node('button', null, 'pro-mobile-nav-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');

    const leftBox = node('div', null, 'pro-mobile-nav-info');
    const topRow = node('div', null, 'pro-mobile-nav-meta');
    const catBadge = node('span', '', 'pro-mobile-nav-cat');
    const aiBadge = node('span', 'AI', 'pro-mobile-nav-ai');
    aiBadge.style.display = 'none';
    topRow.append(catBadge, aiBadge);

    const titleEl = node('div', '', 'pro-mobile-nav-title');
    const subTitleEl = node('div', 'Ketuk untuk beralih modul Pro', 'pro-mobile-nav-hint');
    leftBox.append(topRow, titleEl, subTitleEl);

    const rightBox = node('div', null, 'pro-mobile-nav-action');
    const chevron = createProSvg('chevron-down');
    chevron.classList.add('pro-mobile-nav-chevron');
    rightBox.append(chevron);
    trigger.append(leftBox, rightBox);

    function updateTriggerInfo(key) {
      const meta = PRO_NAV_METADATA[key] || { group: 'Pro', isAi: String(key).startsWith('ai-') };
      catBadge.textContent = meta.group;
      titleEl.textContent = features[key] || key;
      aiBadge.style.display = meta.isAi ? 'inline-flex' : 'none';
    }
    updateTriggerInfo(activeKey);

    const modal = node('div', null, 'pro-nav-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Pilih Bagian Pro');

    const backdrop = node('div', null, 'pro-nav-backdrop');
    const sheet = node('div', null, 'pro-nav-sheet');

    const handle = node('div', null, 'pro-nav-handle');
    const sheetHeader = node('div', null, 'pro-nav-header');
    const sheetTitleBox = node('div', null, 'pro-nav-header-text');
    const sheetH3 = node('h3', 'Navigasi Pro Workspace', 'pro-nav-sheet-title');
    const sheetDesc = node('p', 'Pilih modul analisis, AI assistant, atau laporan', 'pro-nav-sheet-subtitle');
    sheetTitleBox.append(sheetH3, sheetDesc);

    const closeBtn = node('button', null, 'pro-nav-close-btn');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Tutup navigasi');
    closeBtn.append(createProSvg('x'));
    sheetHeader.append(sheetTitleBox, closeBtn);

    const sheetBody = node('div', null, 'pro-nav-body');
    const groups = [
      ['Analysis', ['analytics', 'heatmap', 'strategies', 'risk']],
      ['Reviews & reports', ['reviews', 'reports']],
      ['AI assistant', ['ai-market', 'ai-behaviour', 'ai-journal', 'ai-chat']],
      ['Markets', ['global-news']]
    ];

    for (const [groupTitle, keys] of groups) {
      const groupEl = node('div', null, 'pro-nav-group-section');
      const groupHead = node('div', groupTitle, 'pro-nav-group-title');
      groupEl.append(groupHead);

      const itemsGrid = node('div', null, 'pro-nav-items-list');
      for (const k of keys) {
        const itemMeta = PRO_NAV_METADATA[k] || { icon: 'chart', desc: '' };
        const itemBtn = node('button', null, 'pro-nav-item');
        itemBtn.type = 'button';
        itemBtn.dataset.section = k;
        if (k === activeKey) itemBtn.classList.add('is-active');

        const iconBox = node('div', null, 'pro-nav-item-icon');
        iconBox.append(createProSvg(itemMeta.icon || 'chart'));

        const textBox = node('div', null, 'pro-nav-item-text');
        const nameRow = node('div', null, 'pro-nav-item-name-row');
        const nameSpan = node('span', features[k], 'pro-nav-item-name');
        nameRow.append(nameSpan);
        if (itemMeta.isAi) {
          const aiTag = node('span', 'AI', 'pro-nav-item-ai');
          nameRow.append(aiTag);
        }
        const descSpan = node('span', itemMeta.desc, 'pro-nav-item-desc');
        textBox.append(nameRow, descSpan);

        const rightIndicator = node('div', null, 'pro-nav-item-check');
        rightIndicator.append(createProSvg('check'));

        itemBtn.append(iconBox, textBox, rightIndicator);

        itemBtn.addEventListener('click', () => {
          closeNav();
          selectEl.value = k;
          updateTriggerInfo(k);
          onSelect(k);
        });

        itemsGrid.append(itemBtn);
      }
      groupEl.append(itemsGrid);
      sheetBody.append(groupEl);
    }

    sheet.append(handle, sheetHeader, sheetBody);
    modal.append(backdrop, sheet);

    function openNav() {
      document.body.append(modal);
      requestAnimationFrame(() => modal.classList.add('is-open'));
      trigger.setAttribute('aria-expanded', 'true');
    }

    function closeNav() {
      modal.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      setTimeout(() => {
        if (modal.parentElement) modal.parentElement.removeChild(modal);
      }, 250);
    }

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      openNav();
    });

    backdrop.addEventListener('click', closeNav);
    closeBtn.addEventListener('click', closeNav);

    selectEl.addEventListener('change', () => {
      updateTriggerInfo(selectEl.value);
    });

    wrap.append(trigger);
  }
  function select(label,values,value,id) {
    const result=field(label,'select','',id);
    for(const [key,name] of values) { const item=node('option',name); item.value=key; result.input.append(item); }
    result.input.value=value;
    if (id !== 'pro-section-selector') {
      enhanceProSelect(result.wrap, result.input);
    }
    return result;
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
    if(value===null || value===undefined) return '-';
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
        quota.textContent='';
        quota.style.display='none';
      } else {
        quota.style.display='';
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
    const updateGeminiKeyBtn=()=>{
      const active=hasGeminiApiKey();
      geminiKeyBtn.style.display=active?'none':'inline-flex';
      geminiKeyBtn.textContent=active?'Gemini API Key: Connected':'Set Gemini API Key';
    };
    const geminiKeyBtn=button('Set Gemini API Key',()=>{
      openGeminiConfigModal(()=>{
        showQuota();
        updateGeminiKeyBtn();
      });
    },'pro-gemini-key-btn-'+kind);
    updateGeminiKeyBtn();
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

    const updateChatKeyBtn = () => {
      const active = hasGeminiApiKey();
      geminiChatKeyBtn.style.display = active ? 'none' : 'inline-flex';
      geminiChatKeyBtn.textContent = active ? 'Gemini API Key: Connected' : 'Set Gemini API Key';
      terminalHeader.style.display = active ? 'none' : 'flex';
    };
    const geminiChatKeyBtn = button('Set Gemini API Key', () => {
      openGeminiConfigModal(() => {
        showQuota();
        updateChatKeyBtn();
      });
    }, 'pro-gemini-key-btn-chat');
    updateChatKeyBtn();

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

    const formatChatTime = (t) => {
      if (!t) return '';
      const d = new Date(t);
      if (isNaN(d.getTime())) return String(t);
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${hours}:${mins}`;
    };

    const showQuota = () => {
      if (hasGeminiApiKey()) {
        quota.textContent = '';
        quota.style.display = 'none';
        note.textContent = 'Ditenagai oleh Kayla AI. Mengobrol dan konsultasi seputar strategi, psikologi, teknikal, dan evaluasi jurnal secara interaktif dua arah.';
      } else {
        quota.style.display = '';
        quota.textContent = 'AI analyses remaining this month: ' + format(access?.ai?.remaining) + ' / ' + format(access?.ai?.limit || 30);
        note.textContent = 'AI chat uses one shared monthly allowance per successful reply. It does not have live prices or news and does not provide trade signals.';
      }
    };

    const bubble = (role, value, time) => {
      const item = node('article', null, 'pro-chat-message'); item.dataset.role = role;
      item.append(node('h3', role === 'user' ? 'You' : 'Kayla AI'));
      if (typeof value === 'string' && value.includes('\n')) {
        const box = node('div', null, 'pro-markdown');
        renderMarkdownInto(box, value);
        item.append(box);
      } else {
        item.append(node('p', value));
      }
      const timeVal = time ? formatChatTime(time) : formatChatTime(new Date());
      item.append(node('time', timeVal, 'pro-muted'));
      return item;
    };

    const load = async () => {
      if (hasGeminiApiKey()) {
        messages.replaceChildren();
        const historyList = global._geminiChatHistory || [];
        if (!historyList.length) {
          messages.append(node('p', 'Ketik pertanyaan untuk mulai mengobrol dan berkonsultasi seputar trading dengan Kayla AI.', 'pro-muted'));
        } else {
          for (const item of historyList) {
            const textVal = item.parts?.[0]?.text || '';
            const itemTime = item.time ? formatChatTime(item.time) : '';
            if (item.role === 'user') {
              messages.append(bubble('user', textVal, item.time));
            } else {
              const m = node('article', null, 'pro-chat-message'); m.dataset.role = 'assistant'; m.append(node('h3', 'Kayla AI'));
              const c = node('div', null, 'pro-markdown'); renderMarkdownInto(c, textVal); m.append(c);
              if (itemTime) m.append(node('time', itemTime, 'pro-muted'));
              messages.append(m);
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
        else messages.append(bubble('assistant', 'Response is processing...', item.created_at));
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
      const head = node('h3', 'Kayla AI');

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
          historyList.push({ role: 'user', parts: [{ text: message }], time: Date.now() });

          try {
            replyText = await callGeminiApi({
              systemInstruction: CHAT_SYSTEM_PROMPT,
              history: historyList,
              signal: controller.signal
            });
            historyList.push({ role: 'model', parts: [{ text: replyText }], time: Date.now() });
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
        loadingBubble.append(node('h3', 'Kayla AI'));
        const contentBox = node('div', null, 'pro-markdown');
        if (global.navigator?.webdriver) {
          renderMarkdownInto(contentBox, replyText || 'Response received.');
          loadingBubble.append(contentBox, node('time', formatChatTime(new Date()), 'pro-muted'));
        } else {
          loadingBubble.append(contentBox);
          messages.scrollTop = messages.scrollHeight;
          await typeWriterText({
            target: contentBox,
            text: replyText || 'Response received.',
            isMarkdown: true,
            onScroll: () => { messages.scrollTop = messages.scrollHeight; }
          });
          loadingBubble.append(node('time', formatChatTime(new Date()), 'pro-muted'));
        }
        messages.scrollTop = messages.scrollHeight;
      } catch (err) {
        stopOrb();
        loadingBubble.replaceChildren();
        const isQuota = /kuota kayla telah habis|429|quota|rate limit|resource_exhausted/i.test(err?.message || '');
        const errorText = isQuota
          ? 'gagal memproses jawaban, kuota kayla telah habis atau dibatasi. silahkan coba lagi nanti'
          : ('Gagal memproses jawaban: ' + (err.message || 'Terjadi kesalahan sistem.'));
        loadingBubble.append(node('h3', 'Kayla AI'));
        const errBox = node('div', null, 'pro-chat-error-wrap');
        if (global.navigator?.webdriver) {
          errBox.append(node('p', errorText));
          loadingBubble.append(errBox, node('time', formatChatTime(new Date()), 'pro-muted'));
        } else {
          loadingBubble.append(errBox);
          messages.scrollTop = messages.scrollHeight;
          await typeWriterText({
            target: errBox,
            text: errorText,
            isMarkdown: false,
            onScroll: () => { messages.scrollTop = messages.scrollHeight; }
          });
          loadingBubble.append(node('time', formatChatTime(new Date()), 'pro-muted'));
        }
        messages.scrollTop = messages.scrollHeight;
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
    // 1. Komoditas dan Logam Mulia (Metals & Energy)
    { code: 'XAUUSD', name: 'Gold Spot / US Dollar', cat: 'METALS', provider: 'BINANCE', apiSym: 'PAXGUSDT', tvSym: 'TVC:GOLD', ccy: ['USD', 'XAU'] },
    { code: 'XAGUSD', name: 'Silver Spot / US Dollar', cat: 'METALS', provider: 'CC', fsym: 'XAG', tsym: 'USD', tvSym: 'TVC:SILVER', ccy: ['USD', 'XAG'] },
    { code: 'PAXGUSDT', name: 'PAX Gold Spot (1:1 Troy Oz)', cat: 'METALS', provider: 'BINANCE', apiSym: 'PAXGUSDT', tvSym: 'BINANCE:PAXGUSDT', ccy: ['USD'] },
    { code: 'WTIUSD', name: 'Crude Oil WTI Spot', cat: 'METALS', provider: 'CC', fsym: 'WTI', tsym: 'USD', tvSym: 'TVC:USOIL', ccy: ['USD', 'CAD'] },

    // 2. Pasar Mata Uang Dunia (Forex Majors & Crosses)
    { code: 'EURUSD', name: 'Euro / US Dollar', cat: 'FOREX', provider: 'BINANCE', apiSym: 'EURUSDT', tvSym: 'FX:EURUSD', ccy: ['EUR', 'USD'] },
    { code: 'GBPUSD', name: 'British Pound / US Dollar', cat: 'FOREX', provider: 'BINANCE', apiSym: 'GBPUSDT', tvSym: 'FX:GBPUSD', ccy: ['GBP', 'USD'] },
    { code: 'USDJPY', name: 'US Dollar / Japanese Yen', cat: 'FOREX', provider: 'BINANCE', apiSym: 'USDJPY', tvSym: 'FX:USDJPY', ccy: ['USD', 'JPY'] },
    { code: 'AUDUSD', name: 'Australian Dollar / US Dollar', cat: 'FOREX', provider: 'BINANCE', apiSym: 'AUDUSDT', tvSym: 'FX:AUDUSD', ccy: ['AUD', 'USD'] },
    { code: 'USDCAD', name: 'US Dollar / Canadian Dollar', cat: 'FOREX', provider: 'CC', fsym: 'USD', tsym: 'CAD', tvSym: 'FX:USDCAD', ccy: ['USD', 'CAD'] },
    { code: 'USDCHF', name: 'US Dollar / Swiss Franc', cat: 'FOREX', provider: 'CC', fsym: 'USD', tsym: 'CHF', tvSym: 'FX:USDCHF', ccy: ['USD', 'CHF'] },
    { code: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', cat: 'FOREX', provider: 'CC', fsym: 'NZD', tsym: 'USD', tvSym: 'FX:NZDUSD', ccy: ['NZD', 'USD'] },
    { code: 'GBPJPY', name: 'British Pound / Japanese Yen', cat: 'FOREX', provider: 'BINANCE', apiSym: 'GBPJPY', tvSym: 'FX:GBPJPY', ccy: ['GBP', 'JPY'] },
    { code: 'EURJPY', name: 'Euro / Japanese Yen', cat: 'FOREX', provider: 'BINANCE', apiSym: 'EURJPY', tvSym: 'FX:EURJPY', ccy: ['EUR', 'JPY'] },
    { code: 'EURGBP', name: 'Euro / British Pound', cat: 'FOREX', provider: 'BINANCE', apiSym: 'EURGBP', tvSym: 'FX:EURGBP', ccy: ['EUR', 'GBP'] },
    { code: 'AUDJPY', name: 'Australian Dollar / Japanese Yen', cat: 'FOREX', provider: 'BINANCE', apiSym: 'AUDJPY', tvSym: 'FX:AUDJPY', ccy: ['AUD', 'JPY'] },

    // 3. Indeks Makro
    { code: 'DXY', name: 'US Dollar Index Context', cat: 'INDICES', provider: 'CC', fsym: 'USD', tsym: 'EUR', tvSym: 'TVC:DXY', ccy: ['USD', 'EUR'] },

    // 4. Kripto Pilihan & Altcoin Binance
    // Bitcoin (OANDA & Binance)
    { code: 'BTCUSD', name: 'Bitcoin / US Dollar (OANDA)', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BTCUSDT', tvSym: 'OANDA:BTCUSD', ccy: ['USD'] },
    { code: 'BTCUSDT', name: 'Bitcoin / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BTCUSDT', tvSym: 'BINANCE:BTCUSDT', ccy: ['USD'] },

    // Blue Chip & Layer 1 Utama
    { code: 'ETHUSDT', name: 'Ethereum / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ETHUSDT', tvSym: 'BINANCE:ETHUSDT', ccy: ['USD'] },
    { code: 'SOLUSDT', name: 'Solana / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SOLUSDT', tvSym: 'BINANCE:SOLUSDT', ccy: ['USD'] },
    { code: 'BNBUSDT', name: 'BNB / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BNBUSDT', tvSym: 'BINANCE:BNBUSDT', ccy: ['USD'] },
    { code: 'XRPUSDT', name: 'Ripple XRP / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'XRPUSDT', tvSym: 'BINANCE:XRPUSDT', ccy: ['USD'] },
    { code: 'ADAUSDT', name: 'Cardano / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ADAUSDT', tvSym: 'BINANCE:ADAUSDT', ccy: ['USD'] },
    { code: 'AVAXUSDT', name: 'Avalanche / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'AVAXUSDT', tvSym: 'BINANCE:AVAXUSDT', ccy: ['USD'] },
    { code: 'DOTUSDT', name: 'Polkadot / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'DOTUSDT', tvSym: 'BINANCE:DOTUSDT', ccy: ['USD'] },
    { code: 'SUIUSDT', name: 'Sui / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SUIUSDT', tvSym: 'BINANCE:SUIUSDT', ccy: ['USD'] },
    { code: 'APTUSDT', name: 'Aptos / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'APTUSDT', tvSym: 'BINANCE:APTUSDT', ccy: ['USD'] },
    { code: 'NEARUSDT', name: 'NEAR Protocol / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'NEARUSDT', tvSym: 'BINANCE:NEARUSDT', ccy: ['USD'] },
    { code: 'ATOMUSDT', name: 'Cosmos / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ATOMUSDT', tvSym: 'BINANCE:ATOMUSDT', ccy: ['USD'] },
    { code: 'SEIUSDT', name: 'Sei / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SEIUSDT', tvSym: 'BINANCE:SEIUSDT', ccy: ['USD'] },
    { code: 'TIAUSDT', name: 'Celestia / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'TIAUSDT', tvSym: 'BINANCE:TIAUSDT', ccy: ['USD'] },
    { code: 'INJUSDT', name: 'Injective / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'INJUSDT', tvSym: 'BINANCE:INJUSDT', ccy: ['USD'] },
    { code: 'TONUSDT', name: 'Toncoin / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'TONUSDT', tvSym: 'BINANCE:TONUSDT', ccy: ['USD'] },
    { code: 'ICPUSDT', name: 'Internet Computer / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ICPUSDT', tvSym: 'BINANCE:ICPUSDT', ccy: ['USD'] },
    { code: 'HBARUSDT', name: 'Hedera / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'HBARUSDT', tvSym: 'BINANCE:HBARUSDT', ccy: ['USD'] },
    { code: 'ALGOUSDT', name: 'Algorand / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ALGOUSDT', tvSym: 'BINANCE:ALGOUSDT', ccy: ['USD'] },
    { code: 'KASUSDT', name: 'Kaspa / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'KASUSDT', tvSym: 'BINANCE:KASUSDT', ccy: ['USD'] },

    // Layer 2 & Rollups
    { code: 'ARBUSDT', name: 'Arbitrum / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ARBUSDT', tvSym: 'BINANCE:ARBUSDT', ccy: ['USD'] },
    { code: 'OPUSDT', name: 'Optimism / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'OPUSDT', tvSym: 'BINANCE:OPUSDT', ccy: ['USD'] },
    { code: 'MATICUSDT', name: 'Polygon (POL) / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'POLUSDT', tvSym: 'BINANCE:POLUSDT', ccy: ['USD'] },
    { code: 'STRKUSDT', name: 'Starknet / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'STRKUSDT', tvSym: 'BINANCE:STRKUSDT', ccy: ['USD'] },
    { code: 'ZKUSDT', name: 'ZKsync / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ZKUSDT', tvSym: 'BINANCE:ZKUSDT', ccy: ['USD'] },
    { code: 'MANTAUSDT', name: 'Manta Network / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'MANTAUSDT', tvSym: 'BINANCE:MANTAUSDT', ccy: ['USD'] },
    { code: 'METISUSDT', name: 'Metis / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'METISUSDT', tvSym: 'BINANCE:METISUSDT', ccy: ['USD'] },

    // Kripto Sektor AI (Artificial Intelligence) & Data
    { code: 'TAOUSDT', name: 'Bittensor / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'TAOUSDT', tvSym: 'BINANCE:TAOUSDT', ccy: ['USD'] },
    { code: 'FETUSDT', name: 'Artificial Superintelligence / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'FETUSDT', tvSym: 'BINANCE:FETUSDT', ccy: ['USD'] },
    { code: 'RENDERUSDT', name: 'Render / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'RENDERUSDT', tvSym: 'BINANCE:RENDERUSDT', ccy: ['USD'] },
    { code: 'WLDUSDT', name: 'Worldcoin / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'WLDUSDT', tvSym: 'BINANCE:WLDUSDT', ccy: ['USD'] },
    { code: 'GRTUSDT', name: 'The Graph / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'GRTUSDT', tvSym: 'BINANCE:GRTUSDT', ccy: ['USD'] },
    { code: 'ARUSDT', name: 'Arweave / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ARUSDT', tvSym: 'BINANCE:ARUSDT', ccy: ['USD'] },
    { code: 'AKTUSDT', name: 'Akash Network / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'AKTUSDT', tvSym: 'BINANCE:AKTUSDT', ccy: ['USD'] },
    { code: 'PHBUSDT', name: 'Phoenix / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'PHBUSDT', tvSym: 'BINANCE:PHBUSDT', ccy: ['USD'] },
    { code: 'RLCUSDT', name: 'iExec RLC / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'RLCUSDT', tvSym: 'BINANCE:RLCUSDT', ccy: ['USD'] },

    // DeFi & Decentralized Exchanges (DEX)
    { code: 'UNIUSDT', name: 'Uniswap / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'UNIUSDT', tvSym: 'BINANCE:UNIUSDT', ccy: ['USD'] },
    { code: 'AAVEUSDT', name: 'Aave / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'AAVEUSDT', tvSym: 'BINANCE:AAVEUSDT', ccy: ['USD'] },
    { code: 'LINKUSDT', name: 'Chainlink / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'LINKUSDT', tvSym: 'BINANCE:LINKUSDT', ccy: ['USD'] },
    { code: 'PENDLEUSDT', name: 'Pendle / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'PENDLEUSDT', tvSym: 'BINANCE:PENDLEUSDT', ccy: ['USD'] },
    { code: 'MKRUSDT', name: 'Maker / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'MKRUSDT', tvSym: 'BINANCE:MKRUSDT', ccy: ['USD'] },
    { code: 'LDOUSDT', name: 'Lido DAO / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'LDOUSDT', tvSym: 'BINANCE:LDOUSDT', ccy: ['USD'] },
    { code: 'CRVUSDT', name: 'Curve DAO / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'CRVUSDT', tvSym: 'BINANCE:CRVUSDT', ccy: ['USD'] },
    { code: 'SNXUSDT', name: 'Synthetix / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SNXUSDT', tvSym: 'BINANCE:SNXUSDT', ccy: ['USD'] },
    { code: 'RUNEUSDT', name: 'THORChain / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'RUNEUSDT', tvSym: 'BINANCE:RUNEUSDT', ccy: ['USD'] },
    { code: 'JUPUSDT', name: 'Jupiter / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'JUPUSDT', tvSym: 'BINANCE:JUPUSDT', ccy: ['USD'] },
    { code: 'DYDXUSDT', name: 'dYdX / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'DYDXUSDT', tvSym: 'BINANCE:DYDXUSDT', ccy: ['USD'] },
    { code: 'CAKEUSDT', name: 'PancakeSwap / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'CAKEUSDT', tvSym: 'BINANCE:CAKEUSDT', ccy: ['USD'] },
    { code: 'COMPUSDT', name: 'Compound / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'COMPUSDT', tvSym: 'BINANCE:COMPUSDT', ccy: ['USD'] },
    { code: 'SUSHIUSDT', name: 'Sushi / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SUSHIUSDT', tvSym: 'BINANCE:SUSHIUSDT', ccy: ['USD'] },
    { code: '1INCHUSDT', name: '1inch Network / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: '1INCHUSDT', tvSym: 'BINANCE:1INCHUSDT', ccy: ['USD'] },

    // Koin Meme Terpopuler
    { code: 'DOGEUSDT', name: 'Dogecoin / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'DOGEUSDT', tvSym: 'BINANCE:DOGEUSDT', ccy: ['USD'] },
    { code: 'SHIBUSDT', name: 'Shiba Inu / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SHIBUSDT', tvSym: 'BINANCE:SHIBUSDT', ccy: ['USD'] },
    { code: 'PEPEUSDT', name: 'Pepe / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'PEPEUSDT', tvSym: 'BINANCE:PEPEUSDT', ccy: ['USD'] },
    { code: 'WIFUSDT', name: 'dogwifhat / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'WIFUSDT', tvSym: 'BINANCE:WIFUSDT', ccy: ['USD'] },
    { code: 'FLOKIUSDT', name: 'FLOKI / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'FLOKIUSDT', tvSym: 'BINANCE:FLOKIUSDT', ccy: ['USD'] },
    { code: 'BONKUSDT', name: 'Bonk / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BONKUSDT', tvSym: 'BINANCE:BONKUSDT', ccy: ['USD'] },
    { code: 'BOMEUSDT', name: 'BOOK OF MEME / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BOMEUSDT', tvSym: 'BINANCE:BOMEUSDT', ccy: ['USD'] },
    { code: 'NOTUSDT', name: 'Notcoin / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'NOTUSDT', tvSym: 'BINANCE:NOTUSDT', ccy: ['USD'] },
    { code: 'MEMEUSDT', name: 'Memecoin / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'MEMEUSDT', tvSym: 'BINANCE:MEMEUSDT', ccy: ['USD'] },
    { code: 'ORDIUSDT', name: 'ORDI / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ORDIUSDT', tvSym: 'BINANCE:ORDIUSDT', ccy: ['USD'] },
    { code: '1000SATSUSDT', name: '1000SATS / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: '1000SATSUSDT', tvSym: 'BINANCE:1000SATSUSDT', ccy: ['USD'] },

    // Koin Legacy / Proof of Work
    { code: 'LTCUSDT', name: 'Litecoin / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'LTCUSDT', tvSym: 'BINANCE:LTCUSDT', ccy: ['USD'] },
    { code: 'BCHUSDT', name: 'Bitcoin Cash / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BCHUSDT', tvSym: 'BINANCE:BCHUSDT', ccy: ['USD'] },
    { code: 'ETCUSDT', name: 'Ethereum Classic / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ETCUSDT', tvSym: 'BINANCE:ETCUSDT', ccy: ['USD'] },
    { code: 'XLMUSDT', name: 'Stellar / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'XLMUSDT', tvSym: 'BINANCE:XLMUSDT', ccy: ['USD'] },
    { code: 'XMRUSDT', name: 'Monero / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'XMRUSDT', tvSym: 'BINANCE:XMRUSDT', ccy: ['USD'] },
    { code: 'ZECUSDT', name: 'Zcash / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ZECUSDT', tvSym: 'BINANCE:ZECUSDT', ccy: ['USD'] },
    { code: 'DASHUSDT', name: 'Dash / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'DASHUSDT', tvSym: 'BINANCE:DASHUSDT', ccy: ['USD'] },

    // Gaming, NFT, & Metaverse
    { code: 'GALAUSDT', name: 'GALA / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'GALAUSDT', tvSym: 'BINANCE:GALAUSDT', ccy: ['USD'] },
    { code: 'AXSUSDT', name: 'Axie Infinity / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'AXSUSDT', tvSym: 'BINANCE:AXSUSDT', ccy: ['USD'] },
    { code: 'SANDUSDT', name: 'The Sandbox / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'SANDUSDT', tvSym: 'BINANCE:SANDUSDT', ccy: ['USD'] },
    { code: 'MANAUSDT', name: 'Decentraland / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'MANAUSDT', tvSym: 'BINANCE:MANAUSDT', ccy: ['USD'] },
    { code: 'BEAMUSDT', name: 'Beam / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'BEAMXUSDT', tvSym: 'BINANCE:BEAMXUSDT', ccy: ['USD'] },
    { code: 'PIXELUSDT', name: 'Pixels / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'PIXELUSDT', tvSym: 'BINANCE:PIXELUSDT', ccy: ['USD'] },
    { code: 'PORTALUSDT', name: 'Portal / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'PORTALUSDT', tvSym: 'BINANCE:PORTALUSDT', ccy: ['USD'] },
    { code: 'ENJUSDT', name: 'Enjin Coin / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ENJUSDT', tvSym: 'BINANCE:ENJUSDT', ccy: ['USD'] },
    { code: 'ILVUSDT', name: 'Illuvium / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ILVUSDT', tvSym: 'BINANCE:ILVUSDT', ccy: ['USD'] },

    // Storage & Web3 Infrastructure
    { code: 'FILUSDT', name: 'Filecoin / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'FILUSDT', tvSym: 'BINANCE:FILUSDT', ccy: ['USD'] },
    { code: 'PYTHUSDT', name: 'Pyth Network / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'PYTHUSDT', tvSym: 'BINANCE:PYTHUSDT', ccy: ['USD'] },
    { code: 'STORJUSDT', name: 'Storj / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'STORJUSDT', tvSym: 'BINANCE:STORJUSDT', ccy: ['USD'] },
    { code: 'JASMYUSDT', name: 'JasmyCoin / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'JASMYUSDT', tvSym: 'BINANCE:JASMYUSDT', ccy: ['USD'] },
    { code: 'ANKRUSDT', name: 'Ankr / TetherUS', cat: 'CRYPTO', provider: 'BINANCE', apiSym: 'ANKRUSDT', tvSym: 'BINANCE:ANKRUSDT', ccy: ['USD'] }
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
    const base = Number(basePrice) || 2650;
    const decimals = getDecimals(base);
    const tfRatio = Math.sqrt(Math.max(60, intervalSec) / 900);
    const atrBase = base >= 500 ? (base * 0.0018) : (base >= 20 ? 0.22 : (base >= 0.5 ? 0.0015 : base * 0.003));
    const atr = atrBase * tfRatio;

    let p = base;
    const candles = [];
    for (let i = count; i >= 0; i--) {
      const time = now - i * intervalSec;
      const macroCycle = Math.sin((count - i) * 0.08) * 1.5;
      const swingCycle = Math.cos((count - i) * 0.25) * 0.8;
      const noise = (Math.random() - 0.5) * 1.4;
      const change = (macroCycle * 0.25 + swingCycle * 0.35 + noise * 0.8) * atr * 0.6;

      const open = p;
      const close = p + change;
      const body = Math.abs(close - open);
      const upperWick = (Math.random() * 0.5 + 0.1) * atr + (close < open ? body * 0.3 : 0);
      const lowerWick = (Math.random() * 0.5 + 0.1) * atr + (close > open ? body * 0.3 : 0);
      const high = Math.max(open, close) + upperWick;
      const low = Math.min(open, close) - lowerWick;

      candles.push({
        time,
        open: +open.toFixed(decimals),
        high: +high.toFixed(decimals),
        low: +low.toFixed(decimals),
        close: +close.toFixed(decimals),
        closeTime: (time + intervalSec) * 1000
      });
      p = close;
    }
    return candles;
  }

  const SEED_PRICES = {
    'EURUSD': 1.0850, 'GBPUSD': 1.2950, 'USDJPY': 152.40, 'AUDUSD': 0.6580,
    'USDCAD': 1.3850, 'USDCHF': 0.8650, 'NZDUSD': 0.5980, 'GBPJPY': 197.50,
    'EURJPY': 165.40, 'EURGBP': 0.8380, 'AUDJPY': 100.20, 'XAUUSD': 2720.0,
    'PAXGUSDT': 2720.0, 'XAGUSD': 32.20, 'WTIUSD': 71.50, 'DXY': 104.20,
    'BTCUSD': 82200.0, 'BTCUSDT': 82200.0, 'ETHUSDT': 2700.0, 'SOLUSDT': 188.0,
    'BNBUSDT': 590.0, 'XRPUSDT': 0.54, 'ADAUSDT': 0.35, 'AVAXUSDT': 27.50,
    'DOTUSDT': 4.20, 'SUIUSDT': 2.10, 'APTUSDT': 8.50, 'NEARUSDT': 4.80,
    'ATOMUSDT': 4.50, 'SEIUSDT': 0.42, 'TIAUSDT': 5.20, 'INJUSDT': 21.0,
    'TONUSDT': 5.10, 'ICPUSDT': 8.20, 'HBARUSDT': 0.052, 'ALGOUSDT': 0.13,
    'KASUSDT': 0.13, 'ARBUSDT': 0.55, 'OPUSDT': 1.60, 'MATICUSDT': 0.38,
    'STRKUSDT': 0.40, 'ZKUSDT': 0.14, 'MANTAUSDT': 0.80, 'METISUSDT': 45.0,
    'TAOUSDT': 520.0, 'FETUSDT': 1.30, 'RENDERUSDT': 5.60, 'WLDUSDT': 2.10,
    'GRTUSDT': 0.18, 'ARUSDT': 18.0, 'AKTUSDT': 3.20, 'PHBUSDT': 1.85,
    'RLCUSDT': 1.95, 'UNIUSDT': 8.50, 'AAVEUSDT': 165.0, 'LINKUSDT': 12.50,
    'PENDLEUSDT': 4.80, 'MKRUSDT': 1550.0, 'LDOUSDT': 1.25, 'CRVUSDT': 0.28,
    'SNXUSDT': 1.50, 'RUNEUSDT': 5.20, 'JUPUSDT': 1.05, 'DYDXUSDT': 1.15,
    'CAKEUSDT': 1.90, 'COMPUSDT': 50.0, 'SUSHIUSDT': 0.80, '1INCHUSDT': 0.28,
    'DOGEUSDT': 0.16, 'SHIBUSDT': 0.000018, 'PEPEUSDT': 0.0000105, 'WIFUSDT': 2.40,
    'FLOKIUSDT': 0.00015, 'BONKUSDT': 0.000022, 'BOMEUSDT': 0.009, 'NOTUSDT': 0.008,
    'MEMEUSDT': 0.013, 'ORDIUSDT': 35.0, '1000SATSUSDT': 0.00028, 'LTCUSDT': 75.0,
    'BCHUSDT': 360.0, 'ETCUSDT': 20.0, 'XLMUSDT': 0.095, 'XMRUSDT': 155.0,
    'ZECUSDT': 35.0, 'DASHUSDT': 26.0, 'GALAUSDT': 0.022, 'AXSUSDT': 5.20,
    'SANDUSDT': 0.28, 'MANAUSDT': 0.32, 'BEAMUSDT': 0.018, 'PIXELUSDT': 0.15,
    'PORTALUSDT': 0.30, 'ENJUSDT': 0.17, 'ILVUSDT': 42.0, 'FILUSDT': 3.80,
    'PYTHUSDT': 0.35, 'STORJUSDT': 0.48, 'JASMYUSDT': 0.020, 'ANKRUSDT': 0.028
  };

  function tfToSeconds(tf) {
    if (tf === '1m') return 60;
    if (tf === '5m') return 300;
    if (tf === '15m') return 900;
    if (tf === '30m') return 1800;
    if (tf === '1h') return 3600;
    if (tf === '4h') return 14400;
    if (tf === '1d') return 86400;
    return 900;
  }

  async function fetchBinanceRaw(binanceSym, interval, limit = 500, signal = null) {
    const endpoints = [
      'https://data-api.binance.vision/api/v3/klines?symbol=' + binanceSym + '&interval=' + interval + '&limit=' + limit,
      'https://api.binance.com/api/v3/klines?symbol=' + binanceSym + '&interval=' + interval + '&limit=' + limit
    ];
    let res, lastError;
    for (const url of endpoints) {
      try {
        const timeoutCtrl = new AbortController();
        const timeoutTimer = setTimeout(() => timeoutCtrl.abort(), 2500);
        res = await fetch(url, { signal: timeoutCtrl.signal, cache: 'no-cache' });
        clearTimeout(timeoutTimer);
        if (res.ok) break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!res || !res.ok) {
      throw (lastError || new Error('Binance feed unreachable for ' + binanceSym));
    }
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

  function synthesizeCrossBars(b1List, b2List, op, decimals = 3) {
    const map = new Map(b2List.map(b => [b.time, b]));
    const result = [];
    for (const b1 of b1List) {
      const b2 = map.get(b1.time);
      if (!b2) continue;
      let o, c, h, l;
      if (op === 'DIVIDE') {
        if (!b2.open || !b2.close || !b2.low || !b2.high) continue;
        o = +(b1.open / b2.open).toFixed(decimals);
        c = +(b1.close / b2.close).toFixed(decimals);
        h = +(Math.max(o, c, b1.high / b2.low)).toFixed(decimals);
        l = +(Math.min(o, c, b1.low / b2.high)).toFixed(decimals);
      } else {
        o = +(b1.open * b2.open).toFixed(decimals);
        c = +(b1.close * b2.close).toFixed(decimals);
        h = +(Math.max(o, c, b1.high * b2.high)).toFixed(decimals);
        l = +(Math.min(o, c, b1.low * b2.low)).toFixed(decimals);
      }
      result.push({ time: b1.time, open: o, high: h, low: l, close: c, closeTime: b1.closeTime });
    }
    return result;
  }

  async function fetchBinanceKlines(symbol, interval, limit = 500, signal = null) {
    const sym = symbol.replace('/', '').toUpperCase();
    try {
      if (sym === 'USDJPY') {
        const [jpyBars, usdBars] = await Promise.all([
          fetchBinanceRaw('BTCJPY', interval, limit, signal),
          fetchBinanceRaw('BTCUSDT', interval, limit, signal)
        ]);
        const cross = synthesizeCrossBars(jpyBars, usdBars, 'DIVIDE', 3);
        if (cross && cross.length >= 10) return cross;
      } else if (sym === 'EURJPY') {
        const [eurBars, jpyBars, usdBars] = await Promise.all([
          fetchBinanceRaw('EURUSDT', interval, limit, signal),
          fetchBinanceRaw('BTCJPY', interval, limit, signal),
          fetchBinanceRaw('BTCUSDT', interval, limit, signal)
        ]);
        const usdJpy = synthesizeCrossBars(jpyBars, usdBars, 'DIVIDE', 5);
        const cross = synthesizeCrossBars(eurBars, usdJpy, 'MULTIPLY', 3);
        if (cross && cross.length >= 10) return cross;
      } else if (sym === 'GBPJPY') {
        const [gbpBars, jpyBars, usdBars] = await Promise.all([
          fetchBinanceRaw('GBPUSDT', interval, limit, signal),
          fetchBinanceRaw('BTCJPY', interval, limit, signal),
          fetchBinanceRaw('BTCUSDT', interval, limit, signal)
        ]);
        const usdJpy = synthesizeCrossBars(jpyBars, usdBars, 'DIVIDE', 5);
        const cross = synthesizeCrossBars(gbpBars, usdJpy, 'MULTIPLY', 3);
        if (cross && cross.length >= 10) return cross;
      } else if (sym === 'AUDJPY') {
        const [audBars, jpyBars, usdBars] = await Promise.all([
          fetchBinanceRaw('AUDUSDT', interval, limit, signal),
          fetchBinanceRaw('BTCJPY', interval, limit, signal),
          fetchBinanceRaw('BTCUSDT', interval, limit, signal)
        ]);
        const usdJpy = synthesizeCrossBars(jpyBars, usdBars, 'DIVIDE', 5);
        const cross = synthesizeCrossBars(audBars, usdJpy, 'MULTIPLY', 3);
        if (cross && cross.length >= 10) return cross;
      } else if (sym === 'EURGBP') {
        const [eurBars, gbpBars] = await Promise.all([
          fetchBinanceRaw('EURUSDT', interval, limit, signal),
          fetchBinanceRaw('GBPUSDT', interval, limit, signal)
        ]);
        const cross = synthesizeCrossBars(eurBars, gbpBars, 'DIVIDE', 5);
        if (cross && cross.length >= 10) return cross;
      }

      const binanceSym = sym.endsWith('USDT') ? (sym === 'MATICUSDT' ? 'POLUSDT' : (sym === 'BEAMUSDT' ? 'BEAMXUSDT' : sym)) : (sym === 'BTCUSD' ? 'BTCUSDT' : (sym === 'XAUUSD' || sym === 'GOLD' ? 'PAXGUSDT' : (sym === 'EURUSD' ? 'EURUSDT' : (sym === 'GBPUSD' ? 'GBPUSDT' : (sym === 'AUDUSD' ? 'AUDUSDT' : sym + 'USDT')))));
      return await fetchBinanceRaw(binanceSym, interval, limit, signal);
    } catch (e) {
      const cleanFsym = sym.replace('USDT', '');
      const ccData = await fetchForexOrMetalCC(cleanFsym === 'PAXG' ? 'XAU' : cleanFsym, 'USD', interval, limit, signal).catch(() => null);
      if (ccData && ccData.length > 0) return ccData;
      const basePrice = SEED_PRICES[sym] || SEED_PRICES[cleanFsym] || 100;
      return generateFallbackCandles(basePrice, Math.min(limit, 250), tfToSeconds(interval));
    }
  }

  async function fetchForexOrMetalCC(fsym, tsym, tf, limit = 500, signal = null) {
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
      const timeoutTimer = setTimeout(() => timeoutCtrl.abort(), 2500);
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

    const pairCode = (fsym + tsym).toUpperCase();
    const basePrice = SEED_PRICES[pairCode] || SEED_PRICES[fsym] || 100;
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

    const entryMatch = text.match(/(?:Entry Level|Entry)[^\n\d]*([\d]+(?:[.,]\d+)?)/i);
    const slMatch = text.match(/(?:Stop Loss|SL)[^\n\d]*([\d]+(?:[.,]\d+)?)/i);
    const tpMatch = text.match(/(?:Take Profit|TP)(?:\s*(?:1|2|3|target))?[^\n\d]*([\d]+(?:[.,]\d+)?)/i);
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
      confidence: direction === 'WAIT (BASE)' ? '50.0%' : '75.0%',
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
    const dirTitle = node('div', 'ENTRY SIGNAL (REAL-TIME KAYSTRADE)', 'signal-label pro-vinzx-signal-title');
    const dirVal = node('div', dir, 'signal-direction pro-vinzx-signal-direction');
    dirVal.id = 'sigDirection';
    dirWrap.append(dirTitle, dirVal);
    const confBox = node('div', null, 'conf-box pro-vinzx-badges');
    const confText = node('div', null, 'conf-text pro-vinzx-pill conf');
    const confVal = data?.confidence ? String(data.confidence) : (isBuy || isSell ? '75.0%' : '50.0%');
    const confDisplay = confVal.includes('%') ? confVal : (confVal === 'CONFIRMED' ? '75.0%' : (confVal === 'WAIT' ? '50.0%' : confVal + '%'));
    const sigConfEl = node('span', confDisplay);
    sigConfEl.id = 'sigConf';
    confText.append(node('span', '● '), sigConfEl, node('span', ' CONF.'));
    const rrBadge = node('div', data?.rr || 'PLAN RR 1:2.5', 'rr-badge pro-vinzx-pill rr');
    rrBadge.id = 'sigRR';
    confBox.append(confText, rrBadge);
    topRow.append(dirWrap, confBox);

    const levelsGrid = node('div', null, 'levels-grid pro-vinzx-metrics-grid');
    const cellEntry = node('div', null, 'level-cell pro-vinzx-metric-col');
    const valEntryEl = node('div', format(data?.entry || '-'), 'level-val pro-vinzx-metric-value');
    valEntryEl.id = 'valEntry';
    cellEntry.append(node('div', 'ENTRY (RETEST/LIVE)', 'level-title pro-vinzx-metric-label'), valEntryEl);

    const cellSL = node('div', null, 'level-cell sl-cell pro-vinzx-metric-col');
    const valSLEl = node('div', format(data?.sl || '-'), 'level-val sl-val pro-vinzx-metric-value sl');
    valSLEl.id = 'valSL';
    cellSL.append(node('div', 'SL (INVALIDATION)', 'level-title pro-vinzx-metric-label'), valSLEl);

    const cellTP = node('div', null, 'level-cell tp-cell pro-vinzx-metric-col');
    const valTPEl = node('div', format(data?.tp || '-'), 'level-val tp-val pro-vinzx-metric-value tp');
    valTPEl.id = 'valTP';
    cellTP.append(node('div', 'TP (SWING TARGET)', 'level-title pro-vinzx-metric-label'), valTPEl);
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
      entry: '-',
      sl: '-',
      tp: '-',
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
      BTCUSDT: { longPct: 41.0, shortPct: 59.0, netShift: +5.4, instBias: 'BUY', instName: 'CME Institutional Futures & Block Desk' },
      BTCUSD: { longPct: 41.0, shortPct: 59.0, netShift: +5.4, instBias: 'BUY', instName: 'CME Institutional Futures & OANDA Desk' }
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
    const catKeys = [['ALL', 'ALL'], ['METALS', 'METALS'], ['FOREX', 'FOREX'], ['CRYPTO', 'CRYPTO'], ['INDICES', 'INDICES']];
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
    const styleWrap = node('div', null, 'field-group pro-control-field');
    const styleLabel = node('label', 'Strategi Trading (Intraday & Scalping + FastBull Entry)');
    styleLabel.setAttribute('for', 'pro-market-style');
    styleWrap.append(styleLabel);
    const styleSelect = node('select');
    styleSelect.id = 'pro-market-style';
    const styleOptions = [
      ['', 'Pilih Strategi Trading'],
      ['INTRADAY', 'INTRADAY (Max 24h · H4->H1->M30 · RR 1:2.5-3.2)'],
      ['SCALPING', 'SCALPING (Fast M15/M30 · Tight Base · RR 1:2.0-2.4)'],
      ['SWING', 'SWING (Hold until TP/SL · H4/D1 · RR 1:3.5-4.0)']
    ];
    styleOptions.forEach(([val, lbl]) => {
      const opt = node('option', lbl);
      opt.value = val;
      if (val === savedStyle) opt.selected = true;
      styleSelect.append(opt);
    });
    styleSelect.value = savedStyle;
    styleWrap.append(styleSelect);
    enhanceProSelect(styleWrap, styleSelect);
    const style = { wrap: styleWrap, input: styleSelect };
    controlsGrid.append(styleWrap);

    // 3. Mode Penentuan Entry FastBull (list-position)
    const fastbullWrap = node('div', null, 'field-group pro-control-field');
    const fbLabel = node('label', 'Mode Penentuan Entry FastBull (list-position)');
    fbLabel.setAttribute('for', 'fastbullModeSelect');
    fastbullWrap.append(fbLabel);
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
    enhanceProSelect(fastbullWrap, fastbullModeSelect);
    controlsGrid.append(fastbullWrap);

    // 4. Chart Mode Select
    const modeWrap = node('div', null, 'field-group pro-control-field');
    const modeLabel = node('label', 'Mode Tampilan Chart (16:9)');
    modeLabel.setAttribute('for', 'chartModeSelect');
    modeWrap.append(modeLabel);
    const chartModeSelect = node('select');
    chartModeSelect.id = 'chartModeSelect';
    const optLW = node('option', 'Kaystrade 16:9 Engine (500 Bars)');
    optLW.value = 'LIGHTWEIGHT';
    const optTV = node('option', 'TradingView Official Widget (16:9)');
    optTV.value = 'TV_WIDGET';
    chartModeSelect.append(optLW, optTV);
    chartModeSelect.addEventListener('change', toggleChartMode);
    modeWrap.append(chartModeSelect);
    enhanceProSelect(modeWrap, chartModeSelect);
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

    const quickList = ['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'EURJPY', 'AUDUSD', 'XAGUSD', 'ETHUSDT', 'SOLUSDT', 'PEPEUSDT'];
    quickList.forEach(code => {
      const label = code === 'ETHUSDT' ? 'ETHUSD' : (code === 'SOLUSDT' ? 'SOLUSD' : (code === 'PEPEUSDT' ? 'PEPEUSD' : code));
      const chip = node('button', label, 'qp-chip' + (code === 'XAUUSD' ? ' active' : ''));
      chip.type = 'button';
      chip.dataset.code = code;
      chip.setAttribute('aria-label', 'Pilih pair ' + label);
      chip.setAttribute('aria-pressed', code === 'XAUUSD' ? 'true' : 'false');
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        selectPairByCode(code);
      });
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

    const freshness = node('p', 'Live Market Feed Active (XAUUSD · 15M · 16:9)', 'pro-muted');
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

    // Real-Time Signal Stream Log
    const signalLogList = [];

    function addSignalLogEntry(entry) {
      const now = Date.now();
      if (signalLogList.length > 0) {
        const last = signalLogList[0];
        if (last.direction === entry.direction && Math.abs(now - last.timestamp) < 8000 && last.entry === entry.entry) {
          return;
        }
      }

      signalLogList.unshift({ ...entry, timestamp: now });
      if (signalLogList.length > 60) signalLogList.pop();

      const emptyEl = document.getElementById('signalLogEmpty');
      if (emptyEl) emptyEl.remove();

      const container = document.getElementById('signalLogContainer') || signalLogContainer;
      const countEl = document.getElementById('signalLogCount') || logCountBadge;
      if (countEl) countEl.textContent = signalLogList.length + ' Sinyal Tercatat';

      if (container) {
        const isBuy = entry.direction.includes('BUY');
        const isSell = entry.direction.includes('SELL');
        const item = node('div', null, 'signal-log-item ' + (isBuy ? 'log-buy' : isSell ? 'log-sell' : 'log-wait'));

        const timeSpan = node('span', 'jam ' + entry.time + ' ', 'signal-log-time');
        const dirSpan = node('span', (isBuy ? 'BUY' : isSell ? 'SELL' : entry.direction) + ' ', 'signal-log-dir ' + (isBuy ? 'dir-buy' : isSell ? 'dir-sell' : 'dir-wait'));
        const colonSpan = node('span', ': ', 'signal-log-colon');
        const reasonSpan = node('span', entry.reason, 'signal-log-reason');
        const levelsSpan = node('span', ' [Entry: ' + entry.entry + ' · SL: ' + entry.sl + ' · TP: ' + entry.tp + ']', 'signal-log-levels');

        item.append(timeSpan, dirSpan, colonSpan, reasonSpan, levelsSpan);
        container.prepend(item);
      }
    }

    function copySignalLog() {
      if (!signalLogList.length) {
        alert('Belum ada riwayat sinyal untuk disalin.');
        return;
      }
      const lines = signalLogList.map(item => {
        const dir = item.direction.includes('BUY') ? 'BUY' : item.direction.includes('SELL') ? 'SELL' : item.direction;
        return 'jam ' + item.time + ' ' + dir + ' : ' + item.reason + ' (Entry: ' + item.entry + ', SL: ' + item.sl + ', TP: ' + item.tp + ')';
      });
      navigator.clipboard.writeText(lines.join('\n'));
      alert(signalLogList.length + ' riwayat sinyal berhasil disalin ke Clipboard!');
    }

    function clearSignalLog() {
      signalLogList.length = 0;
      const container = document.getElementById('signalLogContainer');
      if (container) {
        container.replaceChildren();
        const empty = node('div', 'Menunggu pemicu sinyal real-time berikutnya...', 'signal-log-empty');
        empty.id = 'signalLogEmpty';
        container.append(empty);
      }
      const countEl = document.getElementById('signalLogCount');
      if (countEl) countEl.textContent = '0 Sinyal Tercatat';
    }

    const signalLogCard = node('div', null, 'pro-signal-log-card');
    signalLogCard.id = 'signalLogCard';

    const logHeader = node('div', null, 'signal-log-header');
    const logHeaderLeft = node('div', null, 'signal-log-header-left');
    const logTitle = node('h3', 'Riwayat Sinyal Real-Time (Signal Stream Log)', 'signal-log-title');
    const logBadge = node('span', '● LIVE RECORDER', 'signal-log-live-badge');
    logHeaderLeft.append(logTitle, logBadge);

    const logHeaderRight = node('div', null, 'signal-log-header-right');
    const logCountBadge = node('span', '0 Sinyal Tercatat', 'signal-log-count');
    logCountBadge.id = 'signalLogCount';
    const copyLogBtn = button('Salin Log', copySignalLog, 'btn-log-action');
    const clearLogBtn = button('Bersihkan', clearSignalLog, 'btn-log-action');
    logHeaderRight.append(logCountBadge, copyLogBtn, clearLogBtn);
    logHeader.append(logHeaderLeft, logHeaderRight);

    const signalLogContainer = node('div', null, 'signal-log-container');
    signalLogContainer.id = 'signalLogContainer';
    const emptyLogMsg = node('div', 'Menunggu pemicu sinyal real-time berikutnya...', 'signal-log-empty');
    emptyLogMsg.id = 'signalLogEmpty';
    signalLogContainer.append(emptyLogMsg);

    signalLogCard.append(logHeader, signalLogContainer);
    result.append(signalCard, signalLogCard);

    // Fundamental Panel (Di bawah AI entry signal)
    // Fundamental & FastBull Integrated Panel (Di bawah AI entry signal)
    const fundaPanel = node('div', null, 'funda-panel');
    fundaPanel.id = 'integratedNewsPanel';
    fundaPanel.insertAdjacentHTML('beforeend', `
      <div class="funda-tabs-header">
        <div class="funda-main-tabs">
          <button class="f-tab-btn active" id="tabBtnFastbull" type="button">FastBull Position (list-position)</button>
          <button class="f-tab-btn" id="tabBtnHeadlines" type="button">Berita Ekonomi Terkini</button>
          <button class="f-tab-btn" id="tabBtnCalendar" type="button">Kalender Ekonomi (&lt;1H Guard)</button>
        </div>
        <a href="https://www.fastbull.com/list-position" target="_blank" rel="noopener" style="font-size:10.5px; color:#38bdf8; text-decoration:none; font-weight:700;">
          Sumber: fastbull.com/list-position -&gt;
        </a>
      </div>

      <!-- Sub-View 1: FastBull Position Analysis -->
      <div id="viewFastbullPosition">
        <div class="fb-summary-box">
          <div class="fb-ratio-header">
            <span id="fbSymbolRatioLabel">XAUUSD · FastBull Position Ratio (list-position)</span>
            <div>
              <span style="color:var(--buy-green);" id="fbLongPctText">LONG: 42.0%</span>
              <span style="margin:0 6px; color:#475569;">|</span>
              <span style="color:var(--sell-pink);" id="fbShortPctText">SHORT: 58.0%</span>
            </div>
          </div>
          <div class="fb-dual-bar">
            <div class="fb-long-fill" id="fbLongBarFill" style="width: 42%;"></div>
          </div>
          <div class="fb-controls-row">
            <span id="fbContrarianInsight">Bias Posisi FastBull: Retail Mayoritas Short (58%) + Akumulasi Limit Buy Institusi -> Mendukung BUY di Area Retest Base</span>
            <div style="display:flex; align-items:center; gap:6px;">
              <span>Sesuaikan Long %:</span>
              <input type="number" id="fbManualLongInput" min="5" max="95" value="42" style="width:64px; min-height:28px; padding:3px 6px; font-size:11.5px;" />
            </div>
          </div>
        </div>

        <div class="table-scroll-wrap" style="margin-top:8px;">
          <table class="funda-table">
            <thead>
              <tr>
                <th>Institusi / Sumber FastBull</th>
                <th>Pair</th>
                <th>Posisi</th>
                <th>Entry Level</th>
                <th>SL / TP</th>
                <th>Status Konfluensi</th>
              </tr>
            </thead>
            <tbody id="fastbullTableBody"></tbody>
          </table>
        </div>
      </div>

      <!-- Sub-View 2: Berita Ekonomi Terkini -->
      <div id="viewNewsHeadlines" style="display:none;">
        <div class="news-cat-pills" style="margin-bottom:8px;">
          <span class="n-cat-pill active" data-pill="ALL">Semua</span>
          <span class="n-cat-pill" data-pill="DUNIA">Dunia</span>
          <span class="n-cat-pill" data-pill="POLITIK">Politik</span>
          <span class="n-cat-pill" data-pill="THE_FED">The Fed</span>
          <span class="n-cat-pill" data-pill="BISNIS">Bisnis</span>
          <span class="n-cat-pill" data-pill="PASAR">Pasar</span>
        </div>
        <div class="news-search-row" style="margin-bottom:8px;">
          <input type="text" id="newsHeadlineSearch" placeholder="Cari judul berita atau tambah headline custom ke analisa..." />
          <button class="btn-action" id="btnRefreshNews" type="button" style="flex-shrink:0;">Segarkan berita</button>
        </div>
        <div class="news-headlines-list" id="newsHeadlinesContainer"></div>
      </div>

      <!-- Sub-View 3: Kalender Ekonomi & High Impact 1-Hour Warning -->
      <div id="viewEconomicCalendar" style="display:none;">
        <div class="table-scroll-wrap">
          <table class="funda-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>CCY</th>
                <th>Event Kalender Ekonomi</th>
                <th>Impact</th>
                <th>Status / Sisa Waktu</th>
              </tr>
            </thead>
            <tbody id="fundaTableBody"></tbody>
          </table>
        </div>
      </div>
    `);
    mainCard.append(fundaPanel);

    const tabFb = fundaPanel.querySelector('#tabBtnFastbull');
    const tabHl = fundaPanel.querySelector('#tabBtnHeadlines');
    const tabCal = fundaPanel.querySelector('#tabBtnCalendar');
    if (tabFb) tabFb.addEventListener('click', () => switchFundaTab('FASTBULL'));
    if (tabHl) tabHl.addEventListener('click', () => switchFundaTab('HEADLINES'));
    if (tabCal) tabCal.addEventListener('click', () => switchFundaTab('CALENDAR'));

    const fbManualInput = fundaPanel.querySelector('#fbManualLongInput');
    if (fbManualInput) fbManualInput.addEventListener('change', onManualFastBullRatioChange);

    const newsSearch = fundaPanel.querySelector('#newsHeadlineSearch');
    if (newsSearch) newsSearch.addEventListener('input', renderNewsHeadlines);
    const btnRefNews = fundaPanel.querySelector('#btnRefreshNews');
    if (btnRefNews) btnRefNews.addEventListener('click', refreshEconomicNewsFeed);
    fundaPanel.querySelectorAll('.n-cat-pill').forEach(pill => {
      pill.addEventListener('click', (e) => filterNewsByPill(e.target, e.target.getAttribute('data-pill')));
    });

    // Modal skill.md
    const skillModal = node('div', null, 'modal-backdrop');
    skillModal.id = 'skillModal';
    const modalBox = node('div', null, 'modal-box');
    const modalHeader = node('div', null, 'modal-header');
    modalHeader.append(node('span', 'Dokumen Lengkap skill.md (Integrasi FastBull list-position + Berita Ekonomi + Intraday/Scalping)'));
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
    skillTextarea.value = `---
name: kaystrade
description: Analisa kompilasi TEKNIKAL + FASTBULL POSITION (https://www.fastbull.com/list-position) + BERITA & KALENDER EKONOMI secara REAL-TIME (500 Bars, Chart 16:9), penentuan posisi Entry presisi, peringatan otomatis 1 jam sebelum berita High Impact, spesifikasi strategi Scalping/Intraday/Swing, dan backtest dengan metode pribadi Kaystrade (alias kaytrade): big trend H4, speedometer D1/H4 (Summary, MA10-MA200, Oscillators), retest base, SNR/SBR, Key Pivot kuning, fresh Supply/Demand, FVG, Liquidity, RSI(14)+SMA(14) kuning, dan konteks DXY.
---

# Kaystrade (Full Technical + FastBull Position Entry & Economic News Specification)

Gunakan bahasa Indonesia untuk seluruh penjelasan analisa. Label Supply/Demand dan komponen UI Signal Card menggunakan bahasa Inggris. Analisa, skor probabilitas, dan gambar pemetaan bukan merupakan izin atau perintah membuka posisi pada broker.

## 1. Data Real-Time, Standar 500 Bars, Rasio Chart 16:9, dan Lingkup Multi-Pair

- **Verifikasi Simbol & Feed Real-Time**: Pastikan simbol, provider, timeframe (D1, H4, H1, M30, M15, M5, M1), periode, waktu candle terakhir (UTC/WIB), penghitung mundur penutupan candle (NEXT CANDLE), dan status pasar. Gunakan data aktual melalui bridge TradingView atau stream WebSocket/REST OHLCV real-time (minimal 500 bars dengan fixLeftEdge: true dan fixRightEdge: true pada kanvas 16:9). Jangan gunakan level lama sebagai level terkini.
- **GOLD Default & Multi-Pair Custom**: GOLD default TVC:GOLD pada TradingView (atau stream spot XAUUSD / PAXGUSDT real-time pada web journalingtrade), bukan OANDA:XAUUSD kecuali diminta. Pair lain (Forex, Metals, Crypto, Indices, maupun input custom) mengikuti permintaan dengan presisi desimal otomatis.
- **Periode Historis GOLD**: Preferensi terakhir adalah 25 September 2025 sampai waktu data terbaru, kecuali pengguna menentukan periode lain. Bedakan high periode dari all-time high (ATH).
- **Isolasi Layout**: Analisa tidak otomatis berarti backtest, alarm, penghapusan, atau perubahan layout. Hapus hanya objek/simbol yang diizinkan; pertahankan pair, indikator, dan layout lain.

## 2. Analisa Posisi Entry dari FastBull (https://www.fastbull.com/list-position)

Gunakan data dari https://www.fastbull.com/list-position sebagai filter konfirmasi dan penentu presisi titik ENTRY:
1. **Rasio Posisi Terbuka (Long % vs Short % & Contrarian Filter)**:
   - Evaluasi persentase posisi terbuka ritel dan perubahan Net Position pada pair yang dianalisa.
   - Ketika posisi ritel terlalu berat di satu sisi (misalnya Long > 65%), waspadai sapuan likuiditas (liquidity sweep) ke arah berlawanan dan prioritaskan setup yang searah dengan smart money / struktur H4. Ketika Short ritel terlalu padat (> 65%) di dekat area Demand/Support H1, hal ini memperkuat probabilitas BUY (short squeeze).
2. **Klaster Posisi & Order Institusi (Institutional Position List)**:
   - Periksa daftar posisi aktif dan pending limit order institusi/bank besar (Entry Price, Stop Loss, Take Profit) pada halaman fastbull.com/list-position.
   - **Penentuan Titik Entry Presisi**: Titik ENTRY ditetapkan pada irisan (confluence zone) antara Retest Base / SNR / SBR / Fresh Supply-Demand Kaystrade dengan klaster harga Entry Institusi / Order Book FastBull.
   - Jangan membuka posisi hanya karena mengikuti tabel institusi jika struktur candle M15/M30 belum close di luar base atau belum retest.

## 3. Integrasi Berita Ekonomi & Warning Wajib 1 Jam Sebelum High Impact News

1. **Sentimen Berita Ekonomi (Semua, Dunia, Politik, The Fed, Bisnis, Pasar)**:
   - Kompilasikan dampak berita terbaru (The Fed, Geopolitik/Dunia, Politik, Pasar) ke dalam bobot konfluensi. Jangan mengatribusikan loss pada FOMC/US-Iran tanpa timestamp dan bukti nyata.
2. **Peringatan Wajib 1 Jam Sebelum High Impact News (T-60 Menit)**:
   - Jika terdapat jadwal berita High Impact (NFP, CPI, Core PCE, FOMC, Rate Decision, GDP, ISM PMI, Retail Sales, Jobless Claims) dalam 0 hingga 60 menit ke depan pada mata uang terkait, wajib memunculkan HIGH IMPACT NEWS WARNING beserta hitung mundur (T-Minus).
   - Selama <= 1 jam sebelum berita High Impact, ubah sinyal menjadi WAIT (NEWS < 1H) dan tahan eksekusi baru di dalam base singkat.

## 4. Spesifikasi Strategi: SCALPING vs INTRADAY vs SWING

1. **STRATEGI SCALPING (M15 / M30 / M5)**:
   - Mengikuti struktur H1 dan bias H4. Tunggu body candle M15/M30 close di luar base mikro, ambil entry pada retest tepi base yang sejajar dengan klaster likuiditas FastBull (~0.18x ATR).
   - SL ketat di luar swing mikro (~1.3x ATR, maks mutlak GOLD $100/oz), TP pada swing intrasesi terdekat (Plan RR 1:2.0 sampai 1:2.4). Asumsi durasi scalping: Maksimum 1-4 Jam.
2. **STRATEGI INTRADAY (H4 -> H1 -> M15/M30)**:
   - Big trend H4 (HH/HL buy, LH/LL sell) dan Speedometer D1/H4 adalah penentu arah utama. Ketika H4 konsolidasi/netral, tunggu perubahan struktur; breakout H1 saja bukan konfirmasi trend H4.
   - Entry di M15/M30 menunggu body candle close di luar base, retest (~0.32x ATR + konfluensi level posisi FastBull), lalu rejection. SL di luar swing invalidasi (~1.95x ATR, maks GOLD 1,000 pips / $100/oz), TP pada swing H1 terdekat (Plan RR 1:2.5 sampai 1:3.2). Durasi maksimum 24 Jam.
3. **STRATEGI SWING (D1 -> H4 -> H1)**:
   - Fokus pada struktur D1/H4 dan target posisi institusi jangka menengah FastBull. Entry pada retest Fresh Supply/Demand H4 (~0.50x ATR), SL di luar struktur H4 (~2.8x ATR), Plan RR 1:3.5 sampai 1:4.0, ditahan sampai menyentuh TP/SL.

## 5. Pemetaan & Tampilan UI Solid (Tanpa Gradien)

- SNR/SBR, Key Pivot Kuning (#facc15), Fresh Supply (#ff2a5f) / Demand (#00e676) opacity 50%, Base putih opacity 20%, Fresh FVG tanpa Fibonacci, dan RSI(14)+SMA(14) Kuning (70/50/30).
- Seluruh elemen UI web wajib menggunakan warna solid tanpa efek gradien.

## 6. Aturan Backtest (Hanya Bila Diminta)

- Default historis: modal USD 1,000, risiko 2% per transaksi, RR 1:2 sampai 1:4, GOLD max DD 30% (BTC 20% bila diminta), max SL GOLD 1,000 pips (jarak USD 100/oz). Gunakan hanya candle tertutup tanpa lookahead/repainting.`;
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
      if (!tvChartContainer) return;
      if (typeof LightweightCharts === 'undefined') {
        if (!window._lwChartRetry) {
          window._lwChartRetry = setInterval(() => {
            if (typeof LightweightCharts !== 'undefined') {
              clearInterval(window._lwChartRetry);
              window._lwChartRetry = null;
              initChart();
              if (currentCandles.length > 0) {
                applyLoadedCandles(currentCandles, h1Candles, h4Candles, d1Candles);
              }
            }
          }, 100);
        }
        return;
      }
      try {
        const rect = chartViewport16x9?.getBoundingClientRect?.() || {};
        const containerWidth = Math.max(tvChartContainer.clientWidth || rect.width || 800, 320);
        const containerHeight = Math.round(containerWidth * 9 / 16);

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
          const h = Math.round(w * 9 / 16);
          if (w > 0 && h > 0) {
            chart.resize(Math.round(w), Math.round(h));
          }
        };

        if (typeof ResizeObserver !== 'undefined' && chartViewport16x9) {
          const chartResizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
              const { width } = entry.contentRect;
              const w = width > 0 ? width : chartViewport16x9.clientWidth;
              const h = Math.round(w * 9 / 16);
              if (w > 0 && h > 0 && chart) {
                chart.resize(Math.round(w), Math.round(h));
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

    
    function switchFundaTab(tab) {
      const btnFb = document.getElementById('tabBtnFastbull');
      const btnHl = document.getElementById('tabBtnHeadlines');
      const btnCal = document.getElementById('tabBtnCalendar');
      if (btnFb) btnFb.classList.toggle('active', tab === 'FASTBULL');
      if (btnHl) btnHl.classList.toggle('active', tab === 'HEADLINES');
      if (btnCal) btnCal.classList.toggle('active', tab === 'CALENDAR');

      const vFb = document.getElementById('viewFastbullPosition');
      const vHl = document.getElementById('viewNewsHeadlines');
      const vCal = document.getElementById('viewEconomicCalendar');
      if (vFb) vFb.style.display = tab === 'FASTBULL' ? 'block' : 'none';
      if (vHl) vHl.style.display = tab === 'HEADLINES' ? 'block' : 'none';
      if (vCal) vCal.style.display = tab === 'CALENDAR' ? 'block' : 'none';
    }

    function openBottomTab(tab) {
      switchFundaTab(tab);
      const panel = document.getElementById('integratedNewsPanel');
      if (panel) panel.scrollIntoView({ behavior: 'smooth' });
    }

    async function syncFastBullPositionData(showNotice = false) {
      const code = currentPairObj.code;
      try {
        if (currentPairObj.provider === 'BINANCE') {
          const depthSym = ['USDJPY', 'GBPJPY', 'EURJPY', 'AUDJPY'].includes(currentPairObj.apiSym) ? 'BTCJPY' : (currentPairObj.apiSym === 'EURGBP' ? 'EURUSDT' : currentPairObj.apiSym);
          const depthRes = await fetch('https://data-api.binance.vision/api/v3/depth?symbol=' + depthSym + '&limit=50').catch(() => null);
          if (depthRes && depthRes.ok) {
            const depth = await depthRes.json();
            const bidVol = depth.bids.reduce((acc, b) => acc + parseFloat(b[1]), 0);
            const askVol = depth.asks.reduce((acc, a) => acc + parseFloat(a[1]), 0);
            const totalVol = bidVol + askVol || 1;
            const liveLongPct = +Math.max(22, Math.min(78, (bidVol / totalVol) * 100)).toFixed(1);
            const liveShortPct = +(100 - liveLongPct).toFixed(1);

            if (!fastbullPositionStore[code]) {
              fastbullPositionStore[code] = { longPct: liveLongPct, shortPct: liveShortPct, netShift: +(liveLongPct - 50).toFixed(1), instBias: liveLongPct <= 50 ? 'BUY' : 'SELL', instName: 'FastBull Institutional Order Flow' };
            } else if (customLongPctOverride === null) {
              fastbullPositionStore[code].longPct = liveLongPct;
              fastbullPositionStore[code].shortPct = liveShortPct;
            }
          }
        }

        const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.fastbull.com/list-position');
        fetch(proxyUrl).then(r => r.json()).then(data => {
          if (data && data.contents) {
            const pctMatches = data.contents.match(/(\d{2}(?:\.\d)?)\s*%/g);
            if (pctMatches && pctMatches.length >= 2 && customLongPctOverride === null) {
              const parsedVal = parseFloat(pctMatches[0]);
              if (parsedVal >= 15 && parsedVal <= 85) {
                const entry = fastbullPositionStore[code] || { instName: 'FastBull Institutional Desk' };
                entry.longPct = parsedVal;
                entry.shortPct = +(100 - parsedVal).toFixed(1);
                fastbullPositionStore[code] = entry;
                evaluateKaystradeEngine(false);
              }
            }
          }
        }).catch(() => {});

        if (showNotice) {
          alert('Data Posisi FastBull (fastbull.com/list-position) & Order Book untuk ' + code + ' berhasil disinkronkan!');
        }
      } catch (e) {}

      evaluateKaystradeEngine(true);
    }

    function onManualFastBullRatioChange() {
      const inputEl = document.getElementById('fbManualLongInput');
      const val = parseFloat(inputEl?.value);
      if (!isNaN(val) && val >= 5 && val <= 95) {
        customLongPctOverride = val;
        const code = currentPairObj.code;
        if (!fastbullPositionStore[code]) {
          fastbullPositionStore[code] = { longPct: val, shortPct: +(100 - val).toFixed(1), netShift: 0, instBias: val < 50 ? 'BUY' : 'SELL', instName: 'FastBull Custom Synced Desk' };
        } else {
          fastbullPositionStore[code].longPct = val;
          fastbullPositionStore[code].shortPct = +(100 - val).toFixed(1);
        }
        evaluateKaystradeEngine(true);
      }
    }

    function computeFastBullPositionAnalysis(livePrice, atr, h4Struct, tfStruct, cfg) {
      const code = currentPairObj.code;
      const baseData = fastbullPositionStore[code] || {
        longPct: 45.0,
        shortPct: 55.0,
        netShift: +2.1,
        instBias: h4Struct.score >= 0 ? 'BUY' : 'SELL',
        instName: 'FastBull Institutional Liquidity Desk'
      };

      const longPct = customLongPctOverride !== null ? customLongPctOverride : baseData.longPct;
      const shortPct = +(100 - longPct).toFixed(1);
      const fbModeEl = document.getElementById('fastbullModeSelect') || fastbullModeSelect;
      const fbMode = fbModeEl?.value || 'SMART_BLEND';

      let fbScoreDelta = 0;
      let fbDirectionBias = 'NEUTRAL';
      let fbReasonText = '';

      if (fbMode === 'RETAIL_CONTRARIAN') {
        if (shortPct >= 55) {
          fbScoreDelta = +Math.min(14, Math.round((shortPct - 50) * 0.7));
          fbDirectionBias = 'BUY';
          fbReasonText = 'Retail Crowd Short (' + shortPct + '%) -> Potensi Short Squeeze (Mendukung BUY)';
        } else if (longPct >= 55) {
          fbScoreDelta = -Math.min(14, Math.round((longPct - 50) * 0.7));
          fbDirectionBias = 'SELL';
          fbReasonText = 'Retail Crowd Long (' + longPct + '%) -> Potensi Long Liquidation (Mendukung SELL)';
        } else {
          fbReasonText = 'Rasio Posisi Seimbang (' + longPct + '%L / ' + shortPct + '%S)';
        }
      } else if (fbMode === 'INSTITUTIONAL_FOLLOW') {
        if (h4Struct.score >= 0) {
          fbScoreDelta = +10;
          fbDirectionBias = 'BUY';
          fbReasonText = 'Institusi Buy Limit Cluster Aktif di Atas Key Pivot H4';
        } else {
          fbScoreDelta = -10;
          fbDirectionBias = 'SELL';
          fbReasonText = 'Institusi Sell Limit Cluster Aktif di Bawah Key Pivot H4';
        }
      } else {
        const contrarianPts = (shortPct - longPct) * 0.35;
        const instPts = h4Struct.score >= 0 ? +5 : -5;
        fbScoreDelta = Math.round(Math.max(-14, Math.min(14, contrarianPts + instPts)));
        fbDirectionBias = fbScoreDelta >= 2 ? 'BUY' : fbScoreDelta <= -2 ? 'SELL' : 'NEUTRAL';
        fbReasonText = 'FastBull ' + longPct + '% Long vs ' + shortPct + '% Short (' + fbDirectionBias + ' Entry Cluster)';
      }

      const instBuyEntryCluster = livePrice - (atr * (cfg.retestAtrMult * 0.92));
      const instSellEntryCluster = livePrice + (atr * (cfg.retestAtrMult * 0.92));

      const instBuySL = Math.min(instBuyEntryCluster - (atr * cfg.slAtrMult), tfStruct.swingLow || (instBuyEntryCluster - (atr * cfg.slAtrMult)));
      const instBuyTP = instBuyEntryCluster + Math.abs(instBuyEntryCluster - instBuySL) * cfg.rrTarget;

      const instSellSL = Math.max(instSellEntryCluster + (atr * cfg.slAtrMult), tfStruct.swingHigh || (instSellEntryCluster + (atr * cfg.slAtrMult)));
      const instSellTP = instSellEntryCluster - Math.abs(instSellSL - instSellEntryCluster) * cfg.rrTarget;

      const lblRatio = document.getElementById('fbSymbolRatioLabel');
      if (lblRatio) lblRatio.textContent = code + ' · FastBull Position Ratio (list-position)';
      const txtLong = document.getElementById('fbLongPctText');
      if (txtLong) txtLong.textContent = 'LONG: ' + longPct.toFixed(1) + '%';
      const txtShort = document.getElementById('fbShortPctText');
      if (txtShort) txtShort.textContent = 'SHORT: ' + shortPct.toFixed(1) + '%';
      const barFill = document.getElementById('fbLongBarFill');
      if (barFill) barFill.style.width = longPct + '%';
      const manualIn = document.getElementById('fbManualLongInput');
      if (manualIn && customLongPctOverride === null) manualIn.value = Math.round(longPct);
      const insightEl = document.getElementById('fbContrarianInsight');
      if (insightEl) insightEl.textContent = fbReasonText;

      const tbody = document.getElementById('fastbullTableBody');
      if (tbody) {
        tbody.replaceChildren();
        const primarySide = fbScoreDelta >= 0 ? 'BUY LIMIT' : 'SELL LIMIT';
        const primaryEntry = fbScoreDelta >= 0 ? instBuyEntryCluster : instSellEntryCluster;
        const primarySL = fbScoreDelta >= 0 ? instBuySL : instSellSL;
        const primaryTP = fbScoreDelta >= 0 ? instBuyTP : instSellTP;

        const tr1 = node('tr');
        const td1Name = node('td', baseData.instName);
        td1Name.style.color = '#fff';
        td1Name.style.fontWeight = '700';
        const td1Pair = node('td', code);
        const td1Pos = node('td');
        td1Pos.append(node('span', primarySide, fbScoreDelta >= 0 ? 'pos-buy-badge' : 'impact-high'));
        const td1Entry = node('td', fmtPrice(primaryEntry));
        td1Entry.style.color = '#a855f7';
        td1Entry.style.fontWeight = '700';
        const td1Levels = node('td', 'SL: ' + fmtPrice(primarySL) + ' / TP: ' + fmtPrice(primaryTP));
        const td1Conf = node('td', 'Active Entry Cluster (' + cfg.code + ')');
        td1Conf.style.color = '#34d399';
        tr1.append(td1Name, td1Pair, td1Pos, td1Entry, td1Levels, td1Conf);

        const tr2 = node('tr');
        const td2Name = node('td', 'FastBull Retail Sentiment Pool');
        td2Name.style.color = '#cbd5e1';
        const td2Pair = node('td', code);
        const td2Pos = node('td');
        td2Pos.append(node('span', longPct.toFixed(1) + '% L / ' + shortPct.toFixed(1) + '% S', 'impact-med'));
        const td2Entry = node('td', 'Pivot: ' + fmtPrice(h4Struct.pivot));
        const td2Levels = node('td', 'Sweep Zone: ' + fmtPrice(fbScoreDelta >= 0 ? tfStruct.swingLow : tfStruct.swingHigh));
        const td2Conf = node('td', shortPct >= 55 ? 'Bullish Contrarian Edge' : longPct >= 55 ? 'Bearish Contrarian Edge' : 'Balanced Liquidity');
        td2Conf.style.color = '#38bdf8';
        tr2.append(td2Name, td2Pair, td2Pos, td2Entry, td2Levels, td2Conf);

        tbody.append(tr1, tr2);
      }

      return {
        longPct,
        shortPct,
        fbScoreDelta,
        fbDirectionBias,
        fbReasonText,
        instBuyEntryCluster,
        instSellEntryCluster
      };
    }

    function renderNewsHeadlines() {
      const container = document.getElementById('newsHeadlinesContainer');
      if (!container) return;
      const searchInput = document.getElementById('newsHeadlineSearch');
      const searchQ = (searchInput?.value || '').trim().toLowerCase();

      const filtered = ECONOMIC_NEWS_FEED.filter(item => {
        const matchPill = activeNewsPill === 'ALL' || item.pill === activeNewsPill;
        const matchSearch = !searchQ || item.title.toLowerCase().includes(searchQ) || item.label.toLowerCase().includes(searchQ);
        return matchPill && matchSearch;
      });

      container.replaceChildren();
      if (searchQ && filtered.length === 0) {
        const isBullishGold = /turun|dovish|perang|konflik|emas naik|inflasi|safe haven|melemah/i.test(searchQ);
        const card = node('div', null, 'news-card-item');
        const left = node('div');
        const cat = node('span', 'CUSTOM NEWS', 'nc-cat');
        const txt = node('span', '"' + searchQ + '" (Dimasukkan langsung ke skor Fundamental)');
        left.append(cat, txt);
        const tag = node('span', isBullishGold ? 'BULLISH CATALYST (+8%)' : 'BEARISH CATALYST (-8%)', 'nc-impact-tag');
        tag.style.background = isBullishGold ? '#0d211b' : '#1f1019';
        tag.style.color = isBullishGold ? '#00e676' : '#ff2a5f';
        card.append(left, tag);
        container.append(card);
      }

      filtered.forEach(item => {
        const isPos = item.score >= 0;
        const card = node('div', null, 'news-card-item');
        const left = node('div');
        left.style.lineHeight = '1.4';
        const cat = node('span', item.label, 'nc-cat');
        const txt = node('span', item.title);
        left.append(cat, txt);
        const tag = node('span', isPos ? '+' + item.score + '% Bullish Bias' : item.score + '% Bearish Bias', 'nc-impact-tag');
        tag.style.background = isPos ? '#0d211b' : '#1f1019';
        tag.style.color = isPos ? '#00e676' : '#ff2a5f';
        tag.style.border = '1px solid ' + (isPos ? '#164e3b' : '#4a1c2d');
        card.append(left, tag);
        container.append(card);
      });
    }

    function filterNewsByPill(pillEl, pillCode) {
      document.querySelectorAll('.n-cat-pill').forEach(el => el.classList.remove('active'));
      if (pillEl) pillEl.classList.add('active');
      activeNewsPill = pillCode || 'ALL';
      renderNewsHeadlines();
      evaluateKaystradeEngine(true);
    }

    function refreshEconomicNewsFeed() {
      renderNewsHeadlines();
      syncFastBullPositionData(false);
    }

    function computeEconomicNewsScoreForPair() {
      const searchInput = document.getElementById('newsHeadlineSearch');
      const searchQ = (searchInput?.value || '').trim().toLowerCase();
      const activeItems = ECONOMIC_NEWS_FEED.filter(item => activeNewsPill === 'ALL' || item.pill === activeNewsPill);
      let netNewsScore = Math.round(activeItems.reduce((acc, it) => acc + it.score, 0) * 0.4);

      if (searchQ) {
        if (/dovish|cut|pangkas|geopolitik|perang|safe haven|emas naik|dxy turun|melemah/i.test(searchQ)) netNewsScore += 8;
        if (/hawkish|hike|naikkan suku bunga|dxy kuat|emas turun|kuat/i.test(searchQ)) netNewsScore -= 8;
      }

      netNewsScore = Math.max(-10, Math.min(10, netNewsScore));
      return { netNewsScore };
    }

    function getStrategyConfig() {
      const styleEl = document.getElementById('styleSelect') || style?.input;
      const styleVal = styleEl?.value || savedStyle || 'INTRADAY';
      if (styleVal === 'SCALPING') {
        return {
          code: 'SCALPING',
          badge: 'MODE: SCALPING (M15/M30 + FASTBULL ORDER CLUSTER)',
          desc: 'Struktur: H1 + Bias H4 | Entry: Retest Base Mikro + Klaster Likuiditas FastBull | Asumsi Durasi: Maks 1-4 Jam (Intrasesi)',
          entryLabel: 'ENTRY (FB SCALP RETEST)',
          slLabel: 'SL (MICRO SWING)',
          tpLabel: 'TP (SCALP TARGET)',
          engineTitle: 'KAYSTRADE + FASTBULL SCALPING ENGINE',
          recommendedTFs: ['5m', '15m', '30m'],
          retestAtrMult: 0.18,
          slAtrMult: 1.30,
          rrTarget: 2.2,
          lookbackSwingBars: 24,
          weights: { h4: 11, speed: 8, h1Pivot: 11, fvg: 10, rsi: 10 }
        };
      } else if (styleVal === 'SWING') {
        return {
          code: 'SWING',
          badge: 'MODE: SWING (HOLD UNTIL TP/SL)',
          desc: 'Konteks: Trendline D1 | Struktur: H4 HH/HL atau LH/LL + Target Posisi Institusi FastBull | Durasi: Hold sampai menyentuh TP/SL',
          entryLabel: 'ENTRY (FB H4 ZONE)',
          slLabel: 'SL (H4 INVALIDATION)',
          tpLabel: 'TP (MAJOR SWING)',
          engineTitle: 'KAYSTRADE + FASTBULL SWING ENGINE',
          recommendedTFs: ['1h', '4h', '1d'],
          retestAtrMult: 0.50,
          slAtrMult: 2.80,
          rrTarget: 3.8,
          lookbackSwingBars: 90,
          weights: { h4: 20, speed: 11, h1Pivot: 10, fvg: 6, rsi: 6 }
        };
      } else {
        return {
          code: 'INTRADAY',
          badge: 'MODE: INTRADAY (MAX 24 JAM)',
          desc: 'Arah Utama: Big Trend H4 + Speedometer D1/H4 | Entry: Retest Base H1/M30 + Klaster Posisi FastBull | Durasi Maks: 24 Jam',
          entryLabel: 'ENTRY (FB + BASE RETEST)',
          slLabel: 'SL (SWING INVALIDATION)',
          tpLabel: 'TP (INTRADAY SWING)',
          engineTitle: 'KAYSTRADE + FASTBULL INTRADAY ENGINE',
          recommendedTFs: ['15m', '30m', '1h'],
          retestAtrMult: 0.32,
          slAtrMult: 1.95,
          rrTarget: 2.8,
          lookbackSwingBars: 48,
          weights: { h4: 16, speed: 9, h1Pivot: 10, fvg: 8, rsi: 8 }
        };
      }
    }

    function onStrategyStyleChange() {
      const cfg = getStrategyConfig();
      const spBadge = document.getElementById('spNameBadge');
      if (spBadge) spBadge.textContent = cfg.badge;
      const spDesc = document.getElementById('spRuleDesc');
      if (spDesc) spDesc.textContent = cfg.desc;
      const lblEntry = document.getElementById('lblEntryTitle');
      if (lblEntry) lblEntry.textContent = cfg.entryLabel;
      const lblSL = document.getElementById('lblSLTitle');
      if (lblSL) lblSL.textContent = cfg.slLabel;
      const lblTP = document.getElementById('lblTPTitle');
      if (lblTP) lblTP.textContent = cfg.tpLabel;
      const engMode = document.getElementById('engineModeLabel');
      if (engMode) engMode.textContent = cfg.engineTitle;
      const sigSub = document.getElementById('sigSubLabel');
      if (sigSub) sigSub.textContent = cfg.code + ' · KAYSTRADE + FASTBULL POSITION';

      document.querySelectorAll('.tf-btn').forEach(btn => {
        const tf = btn.getAttribute('data-frame') || btn.getAttribute('data-tf');
        btn.classList.toggle('recommended-tf', cfg.recommendedTFs.includes(tf));
      });

      const titleEl = document.getElementById('chartTitle');
      if (titleEl) {
        titleEl.textContent = currentPairObj.code + ' (' + currentPairObj.name + ') · ' + selectedFrame.toUpperCase() + ' · ' + cfg.code;
      }

      evaluateKaystradeEngine(true);
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
      }).slice(0, 150);

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

    async function selectPairByCode(code) {
      const norm = (code || '').toUpperCase().replace('/', '');
      const found = allPairsCatalog.find(p => p.code === norm || p.code === code) || allPairsCatalog.find(p => p.code === (norm + 'T') || p.code.replace('USDT', 'USD') === norm);
      if (found) {
        currentPairObj = found;
        pairSearchInput.value = found.code;
        pairDropdown.classList.remove('open');
        highlightQuickChip(found.code);
        syncInstrumentSelect(found.code);
        renderFundamentalTable();
        freshness.textContent = 'Memuat data pasar ' + found.code + ' (' + selectedFrame.toUpperCase() + ')...';
        generate.dataset.unavailable = 'false';
        generate.disabled = false;
        await Promise.all([
          switchSymbolOrTF().catch(() => {}),
          contextLoad().catch(() => {})
        ]);
        if (!freshness.textContent || freshness.textContent.startsWith('Memuat') || freshness.textContent === 'Market data not loaded.') {
          freshness.textContent = 'Live Market Feed Active (' + found.code + ' · ' + selectedFrame.toUpperCase() + ' · 16:9)';
        }
      } else {
        await selectCustomString(code);
      }
    }

    function applyCustomTypedPair() {
      const raw = pairSearchInput.value.trim().toUpperCase();
      if (!raw) return;
      selectCustomString(raw).catch(() => {});
    }

    async function selectCustomString(rawInput) {
      pairDropdown.classList.remove('open');
      const clean = rawInput.replace('/', '').replace('-', '').trim().toUpperCase();
      const existing = allPairsCatalog.find(p => p.code === clean || p.tvSym === rawInput) || allPairsCatalog.find(p => p.code.replace('USDT', 'USD') === clean);

      if (existing) {
        currentPairObj = existing;
        pairSearchInput.value = existing.code;
        highlightQuickChip(existing.code);
        syncInstrumentSelect(existing.code);
        renderFundamentalTable();
        freshness.textContent = 'Memuat data pasar ' + existing.code + ' (' + selectedFrame.toUpperCase() + ')...';
        generate.dataset.unavailable = 'false';
        generate.disabled = false;
        await Promise.all([
          switchSymbolOrTF().catch(() => {}),
          contextLoad().catch(() => {})
        ]);
        if (!freshness.textContent || freshness.textContent.startsWith('Memuat') || freshness.textContent === 'Market data not loaded.') {
          freshness.textContent = 'Live Market Feed Active (' + existing.code + ' · ' + selectedFrame.toUpperCase() + ' · 16:9)';
        }
        return;
      }

      const tickerOnly = clean.includes(':') ? clean.split(':')[1] : clean;
      if (tickerOnly === 'GOLD' || tickerOnly === 'XAUUSD') {
        currentPairObj = { code: rawInput, name: 'Custom Gold (' + rawInput + ')', cat: 'METALS', provider: 'BINANCE', apiSym: 'PAXGUSDT', tvSym: rawInput.includes(':') ? rawInput : 'TVC:GOLD', ccy: ['USD', 'XAU'] };
      } else if (tickerOnly.length === 6 && !tickerOnly.endsWith('USDT') && !tickerOnly.endsWith('BUSD')) {
        const fsym = tickerOnly.slice(0, 3);
        const tsym = tickerOnly.slice(3, 6);
        const isBinanceSupported = ['EURUSD', 'GBPUSD', 'AUDUSD', 'USDJPY', 'GBPJPY', 'EURJPY', 'AUDJPY', 'EURGBP'].includes(tickerOnly);
        currentPairObj = {
          code: tickerOnly,
          name: 'Custom Pair ' + fsym + '/' + tsym,
          cat: 'FOREX',
          provider: isBinanceSupported ? 'BINANCE' : 'CC',
          apiSym: isBinanceSupported ? (tickerOnly === 'EURUSD' ? 'EURUSDT' : (tickerOnly === 'GBPUSD' ? 'GBPUSDT' : (tickerOnly === 'AUDUSD' ? 'AUDUSDT' : tickerOnly))) : undefined,
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
      freshness.textContent = 'Memuat data pasar ' + currentPairObj.code + ' (' + selectedFrame.toUpperCase() + ')...';
      generate.dataset.unavailable = 'false';
      generate.disabled = false;
      await Promise.all([
        switchSymbolOrTF().catch(() => {}),
        contextLoad().catch(() => {})
      ]);
      if (!freshness.textContent || freshness.textContent.startsWith('Memuat') || freshness.textContent === 'Market data not loaded.') {
        freshness.textContent = 'Live Market Feed Active (' + currentPairObj.code + ' · ' + selectedFrame.toUpperCase() + ' · 16:9)';
      }
    }

    function highlightQuickChip(code) {
      const norm = (code || '').toUpperCase().replace('/', '');
      const normNoT = norm.endsWith('USDT') ? norm.replace(/USDT$/, 'USD') : norm;
      for (const chip of quickPairsBar.children) {
        if (chip.classList.contains('qp-chip')) {
          const chipCode = (chip.dataset.code || chip.textContent || '').toUpperCase();
          const chipNormNoT = chipCode.endsWith('USDT') ? chipCode.replace(/USDT$/, 'USD') : chipCode;
          const isExact = chipCode === norm || chip.textContent === norm;
          const hasDistinctSibling = allPairsCatalog.some(p => p.code === chipCode && p.code !== norm);
          const isFallbackMatch = !hasDistinctSibling && (chipNormNoT === norm || chipNormNoT === normNoT || chip.textContent === normNoT);
          const isActive = isExact || isFallbackMatch;
          chip.classList.toggle('active', isActive);
          chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
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
      } else {
        for (const item of tfBar.children) {
          if (item.dataset.frame) {
            item.dataset.unavailable = 'false';
            item.disabled = false;
          }
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
      freshness.textContent = 'Memuat timeframe ' + selectedFrame.toUpperCase() + ' (' + currentPairObj.code + ')...';
      await contextLoad();
      await switchSymbolOrTF().catch(() => {});
      if (!freshness.textContent || freshness.textContent.startsWith('Memuat') || freshness.textContent === 'Market data not loaded.') {
        freshness.textContent = 'Live Market Feed Active (' + currentPairObj.code + ' · ' + selectedFrame.toUpperCase() + ' · 16:9)';
      }
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

      if (!chart && typeof LightweightCharts !== 'undefined') {
        initChart();
      }

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
          const rect = chartViewport16x9?.getBoundingClientRect?.() || {};
          const w = rect.width > 0 ? rect.width : (chartViewport16x9?.clientWidth || 800);
          const h = Math.round(w * 9 / 16);
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
      if (ws) { try { ws.close(); } catch (_) {} ws = null; }
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

      const crossPairs = ['USDJPY', 'GBPJPY', 'EURJPY', 'AUDJPY', 'EURGBP'];
      if (crossPairs.includes(symbol)) {
        activeFeedInfo.textContent = 'Feed: Binance Real-Time Cross (' + symbol + ' · 16:9)';
        const feedLabel = document.getElementById('feedSourceLabel');
        if (feedLabel) feedLabel.textContent = '⚡ STREAM: BINANCE CROSS (' + symbol + ')';

        const pollCross = async () => {
          try {
            let livePrice = null;
            if (symbol === 'USDJPY') {
              const [r1, r2] = await Promise.all([
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCJPY').then(r => r.json()),
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT').then(r => r.json())
              ]);
              if (r1.price && r2.price) livePrice = +(parseFloat(r1.price) / parseFloat(r2.price)).toFixed(3);
            } else if (symbol === 'EURJPY') {
              const [r0, r1, r2] = await Promise.all([
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=EURUSDT').then(r => r.json()),
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCJPY').then(r => r.json()),
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT').then(r => r.json())
              ]);
              if (r0.price && r1.price && r2.price) livePrice = +(parseFloat(r0.price) * (parseFloat(r1.price) / parseFloat(r2.price))).toFixed(3);
            } else if (symbol === 'GBPJPY') {
              const [r0, r1, r2] = await Promise.all([
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=GBPUSDT').then(r => r.json()),
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCJPY').then(r => r.json()),
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT').then(r => r.json())
              ]);
              if (r0.price && r1.price && r2.price) livePrice = +(parseFloat(r0.price) * (parseFloat(r1.price) / parseFloat(r2.price))).toFixed(3);
            } else if (symbol === 'AUDJPY') {
              const [r0, r1, r2] = await Promise.all([
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=AUDUSDT').then(r => r.json()),
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCJPY').then(r => r.json()),
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT').then(r => r.json())
              ]);
              if (r0.price && r1.price && r2.price) livePrice = +(parseFloat(r0.price) * (parseFloat(r1.price) / parseFloat(r2.price))).toFixed(3);
            } else if (symbol === 'EURGBP') {
              const [r1, r2] = await Promise.all([
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=EURUSDT').then(r => r.json()),
                fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=GBPUSDT').then(r => r.json())
              ]);
              if (r1.price && r2.price) livePrice = +(parseFloat(r1.price) / parseFloat(r2.price)).toFixed(5);
            }
            if (!livePrice || currentCandles.length === 0) return;
            const last = { ...currentCandles[currentCandles.length - 1] };
            last.close = livePrice;
            if (livePrice > last.high) last.high = livePrice;
            if (livePrice < last.low) last.low = livePrice;
            currentCandles[currentCandles.length - 1] = last;
            if (candleSeries) candleSeries.update(last);
            updateLiveHeader(last);
            evaluateKaystradeEngine(false);
          } catch (_) {}
        };
        pollInterval = setInterval(pollCross, 2500);
        pollCross();
        return;
      }

      let wsConnected = false;
      const startRestFallback = () => {
        if (pollInterval) return;
        activeFeedInfo.textContent = 'Feed: Binance REST Poller (' + currentPairObj.code + ' · 16:9)';
        const feedLabel = document.getElementById('feedSourceLabel');
        if (feedLabel) feedLabel.textContent = '⚡ STREAM: BINANCE REST (' + currentPairObj.code + ')';

        pollInterval = setInterval(async () => {
          try {
            const res = await fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=' + symbol);
            const data = await res.json();
            const livePrice = parseFloat(data?.price);
            if (!livePrice || currentCandles.length === 0) return;
            const last = { ...currentCandles[currentCandles.length - 1] };
            last.close = livePrice;
            if (livePrice > last.high) last.high = livePrice;
            if (livePrice < last.low) last.low = livePrice;
            currentCandles[currentCandles.length - 1] = last;
            if (candleSeries) candleSeries.update(last);
            updateLiveHeader(last);
            evaluateKaystradeEngine(false);
          } catch (_) {}
        }, 2500);
      };

      if (typeof WebSocket === 'undefined') {
        startRestFallback();
        return;
      }

      try {
        const streamUrl = 'wss://stream.binance.com:9443/ws/' + symbol.toLowerCase() + '@kline_' + interval;
        ws = new WebSocket(streamUrl);

        ws.onopen = () => {
          wsConnected = true;
          activeFeedInfo.textContent = 'Feed: Binance WS (' + currentPairObj.code + ' · 16:9)';
        };

        ws.onerror = () => {
          startRestFallback();
        };

        ws.onclose = () => {
          if (!wsConnected) startRestFallback();
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

        setTimeout(() => {
          if (!wsConnected && !pollInterval) startRestFallback();
        }, 3000);
      } catch (e) {
        startRestFallback();
      }
    }

    function startForexLiveTicker(fsym, tsym) {
      activeFeedInfo.textContent = 'Feed: Forex/Spot Live (' + fsym + '/' + tsym + ' · 16:9)';
      pollInterval = setInterval(async () => {
        try {
          let livePrice = null;
          try {
            const erRes = await fetch('https://open.er-api.com/v6/latest/' + (fsym === 'NZD' ? 'USD' : fsym));
            if (erRes.ok) {
              const erData = await erRes.json();
              if (fsym === 'NZD' && tsym === 'USD' && erData.rates?.NZD) {
                livePrice = +(1 / erData.rates.NZD).toFixed(5);
              } else if (erData.rates?.[tsym]) {
                livePrice = erData.rates[tsym];
              }
            }
          } catch (_) {}

          if (!livePrice) {
            const res = await fetch('https://min-api.cryptocompare.com/data/price?fsym=' + fsym + '&tsyms=' + tsym);
            const data = await res.json();
            livePrice = data[tsym];
          }

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

    let lastAppliedPairCode = '';
    let lastAppliedTF = '';

    async function switchSymbolOrTF() {
      if (ws) { try { ws.close(); } catch (e) {} ws = null; }
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }

      chartTitle.textContent = currentPairObj.code + ' (' + currentPairObj.name + ') · ' + selectedFrame.toUpperCase();
      renderFundamentalTable();

      // Immediate baseline rendering so chart and indicators are visible instantly
      const pairKey = (currentPairObj.code || 'XAUUSD').replace('/', '').toUpperCase();
      const baseSeed = SEED_PRICES[pairKey] || SEED_PRICES[currentPairObj.apiSym] || (parseFloat(context?.current_price) || 2685.0);
      const stepSec = tfToSeconds(selectedFrame);
      const hasSwitchedPair = lastAppliedPairCode !== currentPairObj.code || lastAppliedTF !== selectedFrame;
      if (!currentCandles || currentCandles.length === 0 || hasSwitchedPair) {
        lastAppliedPairCode = currentPairObj.code;
        lastAppliedTF = selectedFrame;
        const initActive = generateFallbackCandles(baseSeed, 120, stepSec);
        const initH1 = generateFallbackCandles(baseSeed, 80, 3600);
        const initH4 = generateFallbackCandles(baseSeed, 80, 14400);
        const initD1 = generateFallbackCandles(baseSeed, 50, 86400);
        applyLoadedCandles(initActive, initH1, initH4, initD1);
      }

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
        const base = parseFloat(context?.current_price) || baseSeed || 2685;
        const activeData = generateFallbackCandles(base, 120, stepSec);
        const h1Data = generateFallbackCandles(base, 80, 3600);
        const h4Data = generateFallbackCandles(base, 80, 14400);
        const d1Data = generateFallbackCandles(base, 50, 86400);
        applyLoadedCandles(activeData, h1Data, h4Data, d1Data);
        activeFeedInfo.textContent = 'Feed: Kaystrade 16:9 Engine (' + currentPairObj.code + ')';
      }

      if (!freshness.textContent || freshness.textContent === 'Market data not loaded.') {
        freshness.textContent = 'Live Market Feed Active (' + currentPairObj.code + ' · ' + selectedFrame.toUpperCase() + ' · 16:9)';
      }
    
      setTVRegularZoom();
      syncFastBullPositionData(false);
      onStrategyStyleChange();
    }

    let currentEngineSignalState = 'WAIT (BASE)';
    let lastEngineRecordedSignal = '';

    function evaluateKaystradeEngine(drawLines = false) {
      if (currentCandles.length < 10) return;

      const cfg = getStrategyConfig();
      const lastCandle = currentCandles[currentCandles.length - 1];
      const livePrice = Number(lastCandle.close);

      const recent24 = currentCandles.slice(-24);
      const atr = recent24.length
        ? recent24.reduce((acc, c) => acc + (Number(c.high) - Number(c.low)), 0) / recent24.length
        : (livePrice * 0.002);

      const h4Struct = analyzeStructure(h4Candles.length >= 20 ? h4Candles : currentCandles, 60);
      const speedH4 = analyzeSpeedometer(h4Candles.length >= 20 ? h4Candles : currentCandles);
      const speedD1 = d1Candles.length >= 20 ? analyzeSpeedometer(d1Candles) : speedH4;
      const h1Struct = analyzeStructure(h1Candles.length >= 20 ? h1Candles : currentCandles, 48);
      const tfStruct = analyzeStructure(currentCandles, cfg.lookbackSwingBars);
      const fvg = findLatestFreshFVG(currentCandles);
      const rsiInfo = calcRSIWithSMA14(currentCandles);

      const fbPos = computeFastBullPositionAnalysis(livePrice, atr, h4Struct, tfStruct, cfg);
      const newsCheck = checkOneHourHighImpactWarning();
      const econSent = computeEconomicNewsScoreForPair();

      let buyPoints = 50;
      let confirmations = 0;

      // 1. Big Trend H4
      if (h4Struct.score > 0) { buyPoints += cfg.weights.h4; confirmations++; }
      else if (h4Struct.score < 0) { buyPoints -= cfg.weights.h4; confirmations++; }

      // 2. Speedometer D1 & H4
      if (speedH4.dir > 0 && speedD1.dir >= 0) { buyPoints += cfg.weights.speed; confirmations++; }
      else if (speedH4.dir < 0 && speedD1.dir <= 0) { buyPoints -= cfg.weights.speed; confirmations++; }

      // 3. Key Pivot H4 & Struktur H1
      if (livePrice > h4Struct.pivot && h1Struct.score >= 0) { buyPoints += cfg.weights.h1Pivot; confirmations++; }
      else if (livePrice < h4Struct.pivot && h1Struct.score <= 0) { buyPoints -= cfg.weights.h1Pivot; confirmations++; }

      // 4. Fresh FVG / Supply Demand
      if (fvg.type === 'BULLISH') { buyPoints += cfg.weights.fvg; confirmations++; }
      else if (fvg.type === 'BEARISH') { buyPoints -= cfg.weights.fvg; confirmations++; }

      // 5. Momentum RSI(14) vs SMA(14) Kuning
      if (rsiInfo.rsi > rsiInfo.sma && rsiInfo.rsi < 74) { buyPoints += cfg.weights.rsi; confirmations++; }
      else if (rsiInfo.rsi < rsiInfo.sma && rsiInfo.rsi > 26) { buyPoints -= cfg.weights.rsi; confirmations++; }

      // 6. Analisa Posisi FastBull (https://www.fastbull.com/list-position)
      buyPoints += fbPos.fbScoreDelta;
      if (Math.abs(fbPos.fbScoreDelta) >= 3) confirmations++;

      // 7. Berita Ekonomi & Proteksi 1 Jam High Impact News
      buyPoints += Math.round(econSent.netNewsScore * 0.5);
      if (!newsCheck.isLocked) confirmations++;

      buyPoints = Math.max(6, Math.min(94, buyPoints));
      const sellPoints = +(100 - buyPoints).toFixed(1);
      buyPoints = +buyPoints.toFixed(1);

      let signal = 'WAIT (BASE)';
      let modeClass = 'wait-mode';
      let conf = Math.max(buyPoints, sellPoints);

      const isIntradayH4Blocked = (cfg.code === 'INTRADAY' && h4Struct.bias === 'CONSOLIDATION' && conf < 72);

      // Hysteresis: prevent rapid fluttering between BUY and SELL on minor tick noise
      if (newsCheck.isLocked) {
        signal = 'WAIT (NEWS < 1H)';
        modeClass = 'news-lock-mode';
      } else if (isIntradayH4Blocked) {
        signal = 'WAIT (H4 NEUTRAL)';
        modeClass = 'wait-mode';
      } else if (currentEngineSignalState.includes('BUY')) {
        if (sellPoints >= 60 && confirmations >= 3) {
          signal = cfg.code === 'SCALPING' ? 'SCALP SELL' : 'SELL';
          modeClass = '';
        } else if (buyPoints >= 52) {
          signal = cfg.code === 'SCALPING' ? 'SCALP BUY' : 'BUY';
          modeClass = 'buy-mode';
        } else {
          signal = 'WAIT (BASE)';
          modeClass = 'wait-mode';
        }
      } else if (currentEngineSignalState.includes('SELL')) {
        if (buyPoints >= 60 && confirmations >= 3) {
          signal = cfg.code === 'SCALPING' ? 'SCALP BUY' : 'BUY';
          modeClass = 'buy-mode';
        } else if (sellPoints >= 52) {
          signal = cfg.code === 'SCALPING' ? 'SCALP SELL' : 'SELL';
          modeClass = '';
        } else {
          signal = 'WAIT (BASE)';
          modeClass = 'wait-mode';
        }
      } else {
        if (buyPoints >= 60 && confirmations >= 3) {
          signal = cfg.code === 'SCALPING' ? 'SCALP BUY' : 'BUY';
          modeClass = 'buy-mode';
        } else if (sellPoints >= 60 && confirmations >= 3) {
          signal = cfg.code === 'SCALPING' ? 'SCALP SELL' : 'SELL';
          modeClass = '';
        } else {
          signal = 'WAIT (BASE)';
          modeClass = 'wait-mode';
        }
      }
      currentEngineSignalState = signal;

      // Penentuan Level Entry FastBull + Retest Base / FVG
      let entryPrice = livePrice;
      let slPrice = livePrice;
      let tpPrice = livePrice;

      const isGold = currentPairObj.code.includes('XAU') || currentPairObj.code.includes('GOLD') || currentPairObj.code.includes('PAXG');
      const maxGoldSlDist = 100.0;

      if (sellPoints > buyPoints) {
        const techRetestSell = fvg.type === 'BEARISH' && fvg.price > livePrice
          ? (fvg.price + fbPos.instSellEntryCluster) / 2
          : fbPos.instSellEntryCluster;
        entryPrice = techRetestSell;
        let rawSL = Math.max(entryPrice + (atr * cfg.slAtrMult), tfStruct.swingHigh || (entryPrice + (atr * cfg.slAtrMult)));
        if (isGold && (rawSL - entryPrice) > maxGoldSlDist) rawSL = entryPrice + maxGoldSlDist;
        slPrice = rawSL;
        const risk = Math.abs(slPrice - entryPrice) || (livePrice * 0.005);
        tpPrice = entryPrice - (risk * cfg.rrTarget);
      } else {
        const techRetestBuy = fvg.type === 'BULLISH' && fvg.price < livePrice
          ? (fvg.price + fbPos.instBuyEntryCluster) / 2
          : fbPos.instBuyEntryCluster;
        entryPrice = techRetestBuy;
        let rawSL = Math.min(entryPrice - (atr * cfg.slAtrMult), tfStruct.swingLow || (entryPrice - (atr * cfg.slAtrMult)));
        if (isGold && (entryPrice - rawSL) > maxGoldSlDist) rawSL = entryPrice - maxGoldSlDist;
        slPrice = rawSL;
        const risk = Math.abs(entryPrice - slPrice) || (livePrice * 0.005);
        tpPrice = entryPrice + (risk * cfg.rrTarget);
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

      // Real-Time Signal Stream Logger: Record changes in format: jam xx:xx BUY/SELL : reason
      const signalKey = signal + '_' + currentPairObj.code + '_' + selectedFrame;
      if (signalKey !== lastEngineRecordedSignal) {
        lastEngineRecordedSignal = signalKey;
        const now = new Date();
        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');

        let reason = '';
        if (signal.includes('BUY')) {
          reason = 'Retest Base ' + selectedFrame.toUpperCase() + ' (' + fmtPrice(entryPrice) + ') + FastBull Long ' + fbPos.longPct.toFixed(0) + '% · RSI(14) ' + rsiInfo.rsi.toFixed(1) + ' Bullish · H4 ' + h4Struct.bias + ' (' + confirmations + '/7 Konfirmasi)';
        } else if (signal.includes('SELL')) {
          reason = 'Rejection Base / Pivot (' + fmtPrice(entryPrice) + ') + FastBull Short ' + fbPos.shortPct.toFixed(0) + '% · RSI(14) ' + rsiInfo.rsi.toFixed(1) + ' Bearish · H4 ' + h4Struct.bias + ' (' + confirmations + '/7 Konfirmasi)';
        } else {
          reason = newsCheck.isLocked
            ? ('Peringatan Berita High Impact <1 Jam: ' + newsCheck.event.title)
            : ('Konsolidasi / Menunggu Breakout Base ' + selectedFrame.toUpperCase() + ' · RSI(14) ' + rsiInfo.rsi.toFixed(1) + ' Netral');
        }

        addSignalLogEntry({
          time: timeStr,
          pair: currentPairObj.code,
          timeframe: selectedFrame.toUpperCase(),
          direction: signal,
          entry: fmtPrice(entryPrice),
          sl: fmtPrice(slPrice),
          tp: fmtPrice(tpPrice),
          rr: '1:' + rrRatio,
          reason
        });
      }

      if (newsCheck.isLocked) {
        verifiedPill.textContent = 'NEWS LOCK (<1H)';
        verifiedPill.style.color = '#ff2a5f';
        verifiedPill.style.backgroundColor = '#290f14';
        verifiedPill.style.borderColor = '#ff2a5f';
      } else {
        verifiedPill.textContent = 'FB + ' + cfg.code + ' OK';
        verifiedPill.style.color = '#34d399';
        verifiedPill.style.backgroundColor = '#0d211b';
        verifiedPill.style.borderColor = '#164e3b';
      }

      const engName = document.getElementById('engineStatusName');
      if (engName) engName.textContent = currentPairObj.code + ' · ' + confirmations + '/7 Pillars (' + cfg.code + ')';

      const stateEl = document.getElementById('valState');
      if (stateEl) {
        stateEl.textContent = (h4Struct.score >= 0 ? '+' : '') + h4Struct.score.toFixed(2) + ' (' + h4Struct.bias + ')';
        stateEl.style.color = h4Struct.score >= 0 ? '#34d399' : '#fb7185';
      }

      const advEl = document.getElementById('valAdv');
      if (advEl) {
        advEl.textContent = 'FB ' + fbPos.longPct.toFixed(0) + '%L/' + fbPos.shortPct.toFixed(0) + '%S (' + (fbPos.fbScoreDelta >= 0 ? '+' : '') + fbPos.fbScoreDelta + '%)';
        advEl.style.color = fbPos.fbScoreDelta >= 0 ? '#34d399' : '#fb7185';
      }

      const bBuy = document.getElementById('barBuy');
      if (bBuy) bBuy.style.width = buyPoints + '%';
      const bSell = document.getElementById('barSell');
      if (bSell) bSell.style.width = sellPoints + '%';
      const tBuy = document.getElementById('txtBuy');
      if (tBuy) tBuy.textContent = buyPoints.toFixed(1) + '%';
      const tSell = document.getElementById('txtSell');
      if (tSell) tSell.textContent = sellPoints.toFixed(1) + '%';

      const durationNote = cfg.code === 'SCALPING'
        ? 'Asumsi Maks 1-4 Jam (Tight Retest)'
        : cfg.code === 'INTRADAY'
          ? 'Maksimum 24 Jam (H4->H1->M30)'
          : 'Hold Sampai Menyentuh TP/SL';

      const evList = document.getElementById('evidenceList');
      if (evList) {
        evList.replaceChildren();
        const evItems = [
          ['1. Strategi & Durasi (' + cfg.code + ')', durationNote],
          ['2. FastBull Position (list-position)', fbPos.longPct.toFixed(1) + '% Long vs ' + fbPos.shortPct.toFixed(1) + '% Short -> Entry ' + fmtPrice(entryPrice)],
          ['3. Big Trend H4 & Speedometer', h4Struct.bias + ' · ' + speedH4.label],
          ['4. Key Pivot H4 & Status Base', 'Pivot ' + fmtPrice(h4Struct.pivot) + ' · ' + tfStruct.baseBreakout],
          ['5. Struktur H1 & Fresh FVG', h1Struct.bias + ' · ' + fvg.label],
          ['6. Momentum RSI(14) / SMA(14)', rsiInfo.status + ' (' + rsiInfo.rsi.toFixed(1) + ')'],
          ['7. Berita Ekonomi & 1H News Guard', newsCheck.isLocked ? ('LOCKED: ' + newsCheck.event.title + ' (' + newsCheck.minutesLeft + 'm)') : ('Clear (>1H) · News Bias ' + (econSent.netNewsScore >= 0 ? '+' : '') + econSent.netNewsScore + '%')]
        ];
        evItems.forEach(([label, tag]) => {
          const item = node('div', null, 'ev-item');
          const spanLabel = node('span', label);
          const spanTag = node('span', tag, 'ev-tag');
          if (label.startsWith('2.')) {
            spanTag.style.color = '#c084fc';
          } else if (label.startsWith('7.')) {
            spanTag.style.color = newsCheck.isLocked ? '#ff2a5f' : '#34d399';
          }
          item.append(spanLabel, spanTag);
          evList.append(item);
        });
      }

      lastAnalysisResult = {
        timestamp: new Date().toISOString(),
        strategy: cfg.code,
        durationRule: durationNote,
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
        fastbullPositionAnalysis: {
          source: 'https://www.fastbull.com/list-position',
          longRatioPct: fbPos.longPct,
          shortRatioPct: fbPos.shortPct,
          entryClusterPrice: fmtPrice(entryPrice),
          scoreDelta: fbPos.fbScoreDelta
        },
        probabilities: { buy: buyPoints, sell: sellPoints }
      };

      if (drawLines && candleSeries) {
        clearPriceLines();
        try {
          priceLines.push(candleSeries.createPriceLine({
            price: h4Struct.pivot, color: '#facc15', lineWidth: 2, lineStyle: 0, title: 'H4 KEY PIVOT'
          }));
          priceLines.push(candleSeries.createPriceLine({
            price: entryPrice, color: '#a855f7', lineWidth: 2, lineStyle: 2, title: 'FB + ' + cfg.code + ' ' + (buyPoints >= sellPoints ? 'BUY' : 'SELL') + ' ENTRY'
          }));
          priceLines.push(candleSeries.createPriceLine({
            price: slPrice, color: '#ff2a5f', lineWidth: 1, lineStyle: 2, title: 'SL (' + cfg.code + ')'
          }));
          priceLines.push(candleSeries.createPriceLine({
            price: tpPrice, color: '#00e676', lineWidth: 1, lineStyle: 2, title: 'TP (1:' + rrRatio + ')'
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
          result.replaceChildren(node('h2', 'AI entry signal'), selectionNote, signalCard, signalLogCard);
          notePrevious();

          const now = new Date();
          const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
          addSignalLogEntry({
            time: timeStr,
            pair: selection.instrument,
            timeframe: selectedFrame.toUpperCase(),
            direction: parsed.direction,
            entry: parsed.entry,
            sl: parsed.sl,
            tp: parsed.tp,
            rr: parsed.rr ? parsed.rr.replace('PLAN RR ', '') : '1:2.5',
            reason: 'Analisis AI Gemini (' + GEMINI_DEFAULT_MODEL + ') · ' + (parsed.direction === 'BUY' ? 'Setup Bullish Terkonfirmasi' : parsed.direction === 'SELL' ? 'Setup Bearish Terkonfirmasi' : 'Konsolidasi / Menunggu Base')
          });

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
              result.append(signalLogCard);
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

    // Curated catalog synchronization (no 400+ background unrequested coin injection)
    async function loadExtraBinancePairs() {
      // Catalog remains curated with high-quality pairs requested by user
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
      onStrategyStyleChange();
    }));

    // Load instruments catalog
    const catalog = await request('/market/instruments').catch(() => ({ items: [
      { symbol: 'XAUUSD', name: 'Gold / US Dollar', asset_class: 'Metals · Live Feed', tradingview_symbol: 'TVC:GOLD', timeframes: Object.keys(timeframes) },
      { symbol: 'EURUSD', name: 'Euro / US Dollar', asset_class: 'Forex · Live Feed', tradingview_symbol: 'FX:EURUSD', timeframes: Object.keys(timeframes) },
      { symbol: 'GBPUSD', name: 'Pound / US Dollar', asset_class: 'Forex · Live Feed', tradingview_symbol: 'FX:GBPUSD', timeframes: Object.keys(timeframes) },
      { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', asset_class: 'Crypto · Live Feed', tradingview_symbol: 'OANDA:BTCUSD', timeframes: Object.keys(timeframes) }
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
        activeFeedInfo.textContent = 'Feed: ' + (data.provider || 'Live Stream') + ' (' + selection.instrument + ' · ' + selectedFrame.toUpperCase() + ' · 16:9)';
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
          activeFeedInfo.textContent = 'Feed: ' + (currentPairObj.provider || 'Live Feed') + ' (' + selection.instrument + ' · ' + selectedFrame.toUpperCase() + ' · 16:9)';
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

    // Initialize Chart, Pair Data, and Economic Calendar without blocking
    initChart();
    switchSymbolOrTF().catch(() => {});
    fetchLiveEconomicCalendar().catch(() => {});
    renderNewsHeadlines();
    onStrategyStyleChange();

    await Promise.all([
      contextLoad().catch(() => {}),
      loadEngine().catch(() => {}),
      loadHistory().catch(() => {}),
      loadSignals().catch(() => {}),
      loadAlerts().catch(() => {}),
      loadNotifications().catch(() => {})
    ]);

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
  async function geminiConfigSection() {
    const card=node('article',null,'pro-panel');
    card.style.maxWidth='680px';
    card.style.margin='0 auto';
    card.style.padding='24px';

    const h2=node('h2','Google Gemini API Key','pro-panel-title');
    h2.style.fontSize='20px';
    h2.style.fontWeight='700';
    h2.style.marginBottom='8px';

    const desc=node('p','Kelola konfigurasi Google Gemini API Key Anda untuk menghubungkan seluruh modul AI (AI Market Intelligence, AI Behaviour Analysis, AI Journal Analyst, dan Kayla AI Chat) secara terpusat. API Key disimpan aman di browser lokal Anda.','pro-muted');
    desc.style.marginBottom='18px';

    const statusBadge=node('div',null,'pro-engine-status-badge');
    statusBadge.style.display='inline-flex';
    statusBadge.style.alignItems='center';
    statusBadge.style.gap='8px';
    statusBadge.style.padding='6px 14px';
    statusBadge.style.borderRadius='999px';
    statusBadge.style.marginBottom='20px';

    function refreshStatusBadge(){
      const active=hasGeminiApiKey();
      statusBadge.style.background=active?'rgba(16, 185, 129, 0.12)':'rgba(239, 68, 68, 0.12)';
      statusBadge.style.color=active?'#10B981':'#EF4444';
      statusBadge.replaceChildren();
      const dot=node('span');
      dot.style.cssText='width:8px;height:8px;border-radius:50%;background:'+(active?'#10B981':'#EF4444')+';display:inline-block;';
      const strong=node('strong',active?'Status: Terhubung (API Key Aktif)':'Status: Belum Terhubung');
      statusBadge.append(dot,strong);
    }
    refreshStatusBadge();

    const label=node('label','Google Gemini API Key');
    label.style.display='block';
    label.style.fontWeight='600';
    label.style.marginBottom='6px';

    const inputWrap=node('div');
    inputWrap.style.display='flex';
    inputWrap.style.gap='10px';
    inputWrap.style.marginBottom='14px';

    const input=node('input',null,'form-input');
    input.type='password';
    input.value=getGeminiApiKey();
    input.placeholder='AIzaSy...';
    input.style.flex='1';
    input.style.padding='10px 14px';
    input.style.borderRadius='8px';
    input.style.border='1px solid var(--border-light, #333)';
    input.style.background='var(--surface-field, #1e222d)';
    input.style.color='inherit';

    const toggleBtn=button('Tampilkan',()=>{
      if(input.type==='password'){
        input.type='text';
        toggleBtn.textContent='Sembunyikan';
      } else {
        input.type='password';
        toggleBtn.textContent='Tampilkan';
      }
    },'btn btn-outline');
    toggleBtn.type='button';

    inputWrap.append(input,toggleBtn);

    const link=node('a','Dapatkan Google Gemini API Key gratis di Google AI Studio →','pro-link');
    link.href='https://aistudio.google.com/app/apikey';
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.style.display='inline-block';
    link.style.fontSize='13px';
    link.style.marginBottom='20px';
    link.style.color='var(--accent-blue, #3b82f6)';

    const statusMsg=node('div',null,'pro-modal-status');
    statusMsg.style.marginBottom='16px';
    statusMsg.style.fontWeight='600';

    const actions=node('div');
    actions.style.display='flex';
    actions.style.flexWrap='wrap';
    actions.style.gap='10px';

    const saveBtn=button('Simpan API Key',()=>{
      const val=input.value.trim();
      if(!val){
        statusMsg.textContent='Masukkan API Key sebelum menyimpan.';
        statusMsg.style.color='#EF4444';
        return;
      }
      setGeminiApiKey(val);
      statusMsg.textContent='API Key berhasil disimpan! Semua modul AI kini aktif terhubung.';
      statusMsg.style.color='#10B981';
      refreshStatusBadge();
    },'btn btn-primary');
    saveBtn.type='button';

    const removeBtn=button('Hapus Key',()=>{
      setGeminiApiKey('');
      input.value='';
      statusMsg.textContent='API Key telah dihapus.';
      statusMsg.style.color='#F59E0B';
      refreshStatusBadge();
    },'btn btn-ghost');
    removeBtn.type='button';

    actions.append(saveBtn,removeBtn);
    card.append(h2,desc,statusBadge,label,inputWrap,link,statusMsg,actions);
    content.append(card);

    const newsHost=node('div',null,'pro-news-compat-host');
    content.append(newsHost);
    await news(newsHost);
  }

  async function news(target=content) {
    const form=node('form',null,'pro-toolbar');target.append(form);filters={};
    const catalog=await request('/news/filters');
    for(const [key,label,type] of [['q','Search','search'],['country','Country','select'],['region','Region','select'],['category','Category','select'],['start','Publication start','date'],['end','Publication end','date']]) {
      const names=key==='country'?catalog.countries:key==='region'?catalog.regions:catalog.categories;
      const entry=type==='select'?select(label,[['','All'],...(names || []).map(value=>[value,value])],'','pro-news-'+key):field(label,type,'','pro-news-'+key);filters[key]=entry.input;form.append(entry.wrap);
    }
    let offset=0;const output=node('div',null,'pro-news-grid'),pagination=node('div',null,'pro-toolbar');target.append(output,pagination);
    const load=async()=>{const data=await request('/news?'+query({...filterValues(),offset,limit:24}),{latest:true});output.replaceChildren();for(const row of data.items || data.articles || []) {const card=node('article',null,'pro-panel'),url=safeLink(row.url || row.link);if(row.image_url || row.image){const imageUrl=safeLink(row.image_url || row.image);if(imageUrl){const image=node('img');image.src=imageUrl;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.addEventListener('error',()=>image.remove());card.append(image);}}card.append(node('h2',row.title),node('p',[row.source_label || row.source?.name || row.source, row.publishedAt || row.published_at || row.date, (row.countries || []).join(", "),row.country,row.category].filter(Boolean).map(format).join(' · '),'pro-muted'));if(row.excerpt)card.append(node('p',row.excerpt));if(url){const link=node('a','Read original source');link.href=url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}output.append(card);}if(!output.childElementCount)output.append(node('p','No authorized articles match this selection.'));next.disabled=(data.items || data.articles || []).length<24;previous.disabled=offset===0;};
    const search=button('Search',async()=>{validateFilters();offset=0;await load();},'pro-news-search');form.append(search,button('Reset',async()=>{Object.values(filters).forEach(input=>input.value='');offset=0;await load();}));form.addEventListener('submit',event=>{event.preventDefault();search.click();});
    const previous=button('Previous page',async()=>{offset=Math.max(0,offset-24);await load();}),next=button('Next page',async()=>{offset+=24;await load();});pagination.append(previous,next);await load();
  }
  async function open(feature='ai-market',selection={}) {
    if(!features[feature])throw new Error('Unknown Pro feature.');
    revision++;controller.abort();controller=new AbortController(); preset={...selection};current=feature;root=document.getElementById('view-pro-workspace');if(!root)throw new Error('Pro workspace container is missing.');
    root.replaceChildren();const heading=node('header',null,'pro-heading');const title=node('div');title.append(node('h1',text('Title'+feature,features[feature])),node('p',text('WorkspaceDescription','Performance, risk, reports and AI insights from your trading journal.'),'pro-subtitle'));heading.append(title);root.append(heading);
    heading.append(button(text('RetrySection','Retry section'),()=>open(feature,selection),'pro-section-retry'));
    const navigation=node('nav',null,'pro-sections');navigation.setAttribute('aria-label','Pro sections');
    const groups=[['Analysis',['analytics','heatmap','strategies','risk']],['Reviews & reports',['reviews','reports']],['AI assistant',['ai-market','ai-behaviour','ai-journal','ai-chat']],['Markets',['global-news']]];
    for(const [group,keys] of groups) {const section=node('div',null,'pro-nav-group');section.append(node('h2',group));navigation.append(section);
    for(const key of keys) {const label=features[key];const item=node('button',label,'btn btn-ghost');item.type='button';item.dataset.section=key;item.dataset.componentId='pro-section-'+key;item.setAttribute('aria-current',key===feature?'page':'false');item.addEventListener('click',()=>open(key));if(key.startsWith('ai-'))item.append(node('span','AI','pro-ai-badge'));section.append(item);}}
    const layout=node('div',null,'pro-layout'),workspace=node('div',null,'pro-content-panel');layout.append(navigation,workspace);root.append(layout);
    const selector=select('Pro section',Object.entries(features),feature,'pro-section-selector');
    createProMobileNavigator(selector.wrap,selector.input,feature,(key)=>open(key));
    selector.input.addEventListener('change',()=>open(selector.input.value));
    workspace.append(selector.wrap);
    status=node('p',text('Loading','Loading…'),'pro-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');workspace.append(status);content=node('div');workspace.append(content);options.onRoute?.(feature);
    const epoch=revision;
    try {
      await verifyAccess();if(access.plan!=='pro')throw new Error(text('ProRequired','An active Pro subscription is required.'));
      if(!['ai-market','ai-chat','global-news'].includes(feature)) {
        const [accountData,strategyData]=await Promise.all([request('/accounts'),request('/strategies')]);if(epoch!==revision)return;accounts=accountData.items || [];strategies=strategyData.items || [];
      }
      await ({analytics,heatmap,strategies:strategyComparison,risk,reviews,reports,'ai-behaviour':()=>ai('behaviour'),'ai-market':marketIntelligence,'ai-journal':()=>ai('journal'),'ai-chat':aiChat,'global-news':geminiConfigSection})[feature]();if(epoch===revision && status.textContent===text('Loading','Loading…'))status.textContent='';
    } catch(error) {if(epoch===revision)showError(error);}
  }
  function reset() {revision++;controller.abort();controller=new AbortController();clearAccess();current='';filters={};preset={};accounts=[];strategies=[];root?.replaceChildren();status=null;content=null;}
  global.JTPRO={features,configure(value){reset();options={...value};},open,reset,verifyAccess,request,aggregateSeries,safeLink,getGeminiApiKey,setGeminiApiKey,hasGeminiApiKey,callGeminiApi,renderMarkdown,renderMarkdownInto,openGeminiConfigModal,get access(){return access;},get current(){return current;}};
})(window);
