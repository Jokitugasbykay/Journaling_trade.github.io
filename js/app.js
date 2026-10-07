(function () {
      "use strict";

      /* Storage Keys */
      const K_ACCOUNTS = 'fncjt_accounts';
      const K_TRADES = 'fncjt_trades';
      const K_SETTINGS = 'fncjt_settings';
      const K_PROFILE = 'fncjt_profil';

      /* Global State */
      let accounts = [];
      let trades = [];
      let settings = { kurs: 17000, billingAnnual: false };
      let profile = { name: 'Trader', currentAccount: 'demo_acc' };
      let currentEditingTradeId = null;
      let parsedTradesToImport = [];
      let scanJob = 0;
      let currentScan = null;
      let ocrLibrary = null;
      let uploadTrigger = null;
      let onboarding = { name: '', started: false };
      let language = 'id';
      const originalCopy = new Map();
      try {
        const saved = JSON.parse(localStorage.getItem('fncjt_onboarding') || '{}');
        onboarding = { name: typeof saved.name === 'string' ? saved.name.slice(0, 80) : '', started: saved.started === true };
        language = localStorage.getItem('fncjt_language') === 'en' ? 'en' : 'id';
      } catch {}

      /* Safe Element Selector */
      const $ = id => document.getElementById(id);
      const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const safeId = value => /^[\w-]{1,80}$/.test(String(value || '')) ? String(value) : '';

      const stateCopy = {
        accessReady: 'Jurnal siap digunakan. Pilih tab yang ingin Anda buka.',
        localProfile: 'Profil lokal', localProfileStatus: 'Data tersimpan di perangkat ini.',
        changeProfile: 'Ganti profil lokal'
      };
      const englishCopy = {
        home: 'Home', journal: 'Journal', statistics: 'Statistics', calculator: 'Calculator', news: 'Economic news',
        signIn: 'Sign in', welcome: 'Welcome', guestStatus: 'Get to know the journal on Home.',
        loginMenu: 'Sign in / login', profileSettings: 'Profile settings', openJournal: 'Open trading journal',
        language: 'Language', signOut: 'Leave local profile', try: 'Try',
        heroTitle: 'Discipline in Every Execution.<br>Clarity in Every Trade.',
        heroLead: 'Transform your trading journey with a disciplined journaling practice.',
        tryJournal: 'Try the free journal', interested: "I’m interested",
        accessHint: 'Journal tabs open after you click Try.', accessReady: 'Your journal is ready. Choose a tab to get started.',
        localProfile: 'Local profile', localProfileStatus: 'Data stays on this device.', changeProfile: 'Change local profile',
        exampleTitle: 'Example journal note', market: 'Market', exampleMarket: 'Write your market',
        entryReason: 'Entry reason', exampleReason: 'Why this setup?', riskLimit: 'Risk limit', exampleRisk: 'Decide before entry',
        evaluation: 'Review', exampleReview: 'Was the plan followed?', exampleHint: 'A note template, not your account data.',
        foundationsTitle: 'Understand trading<br>before chasing results.',
        foundationMarket: 'Markets & context',
        foundationMarketText: 'Trading means buying and selling instruments in a market. Supply, demand, liquidity, and news influence prices. Record the context behind each decision.',
        foundationRisk: 'Risk & position size',
        foundationRiskText: 'Every position can lose money. Position size, stop distance, spread, and transaction costs determine its impact on your account.',
        foundationPlan: 'Execution plan',
        foundationPlanText: 'The entry reason, setup invalidation level, and target belong in your plan. Your notes help compare the plan with the actual execution.',
        foundationProbability: 'Probability & review',
        foundationProbabilityText: 'One trade does not establish strategy quality. Review a series of positions, the size of gains and losses, and how consistently you followed your process.',
        purposeTitle: 'A journal turns experience into something you can review.',
        purposeBefore: '<strong>Before a trade:</strong> write the reason, market context, and risk limit.',
        purposeAfter: '<strong>After a trade:</strong> record the outcome, emotions, and whether you followed the plan.',
        purposeReview: '<strong>During review:</strong> identify recurring patterns and choose one measurable change.',
        purposeDetail: 'A journal helps identify habits to improve. Assess progress through your process and a collection of trades, without promises of trading returns.',
        interestPlans: "I’m interested, show plans", pricingTitle: 'Plans that grow with you',
        pricingLead: 'Start with Free. Paid plans are coming soon.', monthly: 'Monthly', annual: 'Annual', save17: 'Save 17%',
        freeDescription: 'Get to know your trading habits.', freeBilling: 'Free, no subscription', freeNote: 'Start with data on your own device',
        tryFree: 'Try Free', plusDescription: 'For a more regular journaling routine.', proDescription: 'For a more detailed trading review.',
        plusSoon: 'Plus coming soon', proSoon: 'Pro coming soon', paidNote: 'Subscriptions are not open yet',
        featureDetails: 'Show all features', freeFeature1: 'Manual trade journaling', freeFeature2: 'Statistics and risk calculators',
        freeFeature3: 'PDF/PNG scanning and CSV/TXT imports', freeFeature4: 'Local backup and restore',
        priceDetails: 'Show pricing details', perMonth: 'USD / month', perYear: 'USD / year',
        plusSavings: 'Save $20 compared with 12 monthly payments. The discount rounds to 17%.',
        proSavings: 'Save $40 compared with 12 monthly payments. The discount rounds to 17%.',
        paidHint: 'Plan features and payments will be announced before subscriptions open.',
        localDataHint: 'Notes are stored in this browser on this device. Export a backup to keep a copy.',
        loginTitle: 'Sign in to your journal', loginDescription: 'Use a local profile for journaling on this device.',
        googleLogin: 'Sign in with Google', googleSoon: 'Google sign-in is not available yet.', localName: 'Local profile name',
        localLoginHint: 'Local profiles share the same browser data. They are not cloud accounts. On your first visit, click Try on Home to open the other tabs.',
        localLogin: 'Use local profile', tryWithoutAccount: 'Try without an account',
        uploadLabel: 'Scan PDF/PNG · Import CSV/TXT', uploadTitle: 'Scan documents & import trades',
        uploadDescription: 'PDF/PNG/JPG scans recognize position history and chart setups. Review CSV/TXT records before importing them into the journal.',
        dropFile: 'Drop your file here', scanReviewHint: 'History and chart layouts are recognized automatically. Check the detected values; missing information stays blank. No trades are added automatically.',
        scanText: 'Detected information', saveScan: 'Save scan result', savedScans: 'Saved scan results',
        scanCurrency: 'Profit currency · match your broker account', scanImportHint: 'Review the detected rows before importing. Missing SL/TP and risk stay blank. Chart setups are saved as analysis.',
        scanEmpty: 'No scans have been saved on this device.', uploadLimit: 'Max. 10 MB · Excel: export as CSV'
      };
      document.querySelectorAll('[data-i18n]').forEach(element => {
        originalCopy.set(element.dataset.i18n, element.innerHTML);
      });
      const translatedText = new WeakMap();
      const legacyCopy = {
        'Jurnal Trading Terstruktur': 'Structured trading journal',
        'Catat, filter, dan evaluasi setiap posisi trading secara objektif dan terukur.': 'Record, filter, and review each trading position.',
        '+ Catat Trade': '+ Record trade', 'Total Jurnal': 'Total trades', 'Histori Akun': 'Account history',
        'Rata-rata R:R': 'Average R:R', 'Semua Market': 'All markets', 'Semua Hasil': 'All outcomes',
        'Semua Strategi': 'All strategies', 'Tanggal': 'Date', 'Jam': 'Time', 'Posisi': 'Side', 'Hasil': 'Outcome',
        'Strategi': 'Strategy', 'Alasan': 'Reason', 'Catatan': 'Notes', 'Aksi': 'Actions', 'Akun': 'Account',
        'Alasan & Catatan': 'Reason & notes', 'Alasan Entry & Evaluasi': 'Entry reason & review',
        'Semua': 'All', 'Tinggi': 'High', 'Sedang': 'Medium', 'Rendah': 'Low',
        'Belum Ada Catatan Trade': 'No trades recorded yet',
        'Jurnal trading Anda masih kosong atau tidak ada trade yang cocok dengan filter saat ini. Mulai catat trade baru atau muat data simulasi demo.': 'Your journal is empty or no trades match the current filters. Record a trade or load example data.',
        '+ Catat Trade Baru': '+ Record a new trade', 'Reset Filter': 'Reset filters',
        'Upload File Jurnal': 'Scan or import a file', 'Muat 8 Trade Contoh': 'Load 8 example trades',
        'Statistik & Kinerja Portofolio': 'Statistics & portfolio performance',
        'Evaluasi metrik probabilitas, rasio untung-rugi, efisiensi eksekusi, dan kurva pertumbuhan modal Anda.': 'Review probability metrics, profit and loss ratios, execution, and your equity curve.',
        'Kalkulator Trading Institusional': 'Trading calculators',
        'Hitung ukuran posisi dari risiko, estimasi nilai pip, simulasi profit/loss, dan rasio R:R sebelum menekan tombol eksekusi.': 'Calculate position size, pip value, estimated profit/loss, and risk to reward before executing.',
        'Parameter Setup & Akun': 'Setup & account parameters', 'Arah Posisi Order': 'Order direction',
        'Saldo Akun ($)': 'Account balance ($)', 'Toleransi Risiko (%)': 'Risk tolerance (%)',
        'Harga Entry': 'Entry price', 'Harga Stop Loss (SL)': 'Stop loss price (SL)',
        'Harga Take Profit (TP)': 'Take profit price (TP)', 'Jarak SL (Pips)': 'Stop distance (pips)',
        'Hasil Analisis Ukuran Posisi': 'Position size calculation',
        'Wawasan Berita & Kalender Ekonomi Makro': 'News & economic calendar',
        'Kalender Ekonomi Global (WIB)': 'Global economic calendar (WIB)',
        'Analisa Market Institusional': 'Market analysis', 'Muat Ulang': 'Reload',
        '⚡ Semua Ringkasan': 'All summaries', '📊 Analisa Market': 'Market analysis', '📅 Kalender Ekonomi': 'Economic calendar',
        'Tambah Akun': 'Add account', 'Tambah Akun Broker': 'Add broker account', 'Nama Akun': 'Account name',
        'Saldo Awal': 'Starting balance', 'Mata Uang': 'Currency', 'Simpan Akun': 'Save account', 'Batal': 'Cancel',
        'Tutup': 'Close', 'Simpan': 'Save', 'Simpan Trade': 'Save trade', 'Simpan Jurnal': 'Save trade',
        'Entri Cepat': 'Quick entry', 'Form Lengkap': 'Full form', 'Tempel Teks': 'Paste text',
        'Risiko (%)': 'Risk (%)', 'Risiko per Trade (%)': 'Risk per trade (%)', 'Alasan Entry': 'Entry reason',
        'Nama Trader': 'Trader name', 'Pengaturan Profil': 'Profile settings', 'Simpan Pengaturan': 'Save settings',
        'Profil & Pengaturan': 'Profile & settings', 'Pengaturan': 'Settings', 'Akun Broker': 'Broker accounts',
        'Kurs USD ke IDR': 'USD to IDR exchange rate', 'Ekspor Backup JSON': 'Export JSON backup',
        'Impor Backup JSON': 'Import JSON backup', 'Data & Penyimpanan': 'Data & storage',
        'Statistik & Analitik': 'Statistics & analytics', 'Statistik Trading': 'Trading statistics',
        'Kalkulator Trading': 'Trading calculators', 'Kalkulator Risiko': 'Risk calculator',
        'Saldo Akun': 'Account balance', 'Ukuran Lot': 'Lot size', 'Nilai Pip': 'Pip value', 'Hitung': 'Calculate',
        'Ringkasan': 'Summary', 'Analisa': 'Analysis', 'Kalender': 'Calendar', 'Berita Ekonomi': 'Economic news',
        'Lihat Semua': 'Show all', 'Cari': 'Search', 'Filter': 'Filter', 'Reset': 'Reset',
        'pilih dari perangkat': 'choose from your device', 'atau': 'or', 'Impor ke Jurnal': 'Import into journal',
        'Pilih berkas dari perangkat Anda atau seret ke area dropzone di atas.': 'Choose a file on your device or drop it into the area above.',
        'Hasil scan tersimpan di perangkat ini.': 'The scan is saved on this device.',
        'Pemindaian selesai. Periksa teks sebelum menyimpan hasil scan. Tidak ada trade yang ditambahkan.': 'Scan complete. Review the text before saving the scan. No trades were added.',
        'Hasil scan disimpan di perangkat ini. Jurnal Anda tidak berubah.': 'Scan saved on this device. Your journal has not changed.',
        'Penyimpanan penuh. Salin teks hasil scan sebelum menutup jendela.': 'Storage is full. Copy the scanned text before closing this window.'
      };
      function applyLanguage() {
        document.documentElement.lang = language;
        document.querySelectorAll('[data-i18n]').forEach(element => {
          const key = element.dataset.i18n;
          const copy = language === 'en' ? englishCopy[key] : (stateCopy[key] || originalCopy.get(key));
          if (copy !== undefined) element.innerHTML = copy;
        });
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.parentElement.closest('[data-i18n], script, style, textarea')) continue;
          const original = translatedText.get(node) || node.textContent;
          const replacement = legacyCopy[original.trim()];
          if (replacement) {
            translatedText.set(node, original);
            node.textContent = language === 'en' ? original.replace(original.trim(), replacement) : original;
          }
        }
        $('language-select').value = language;
        $('local-login-name').placeholder = language === 'en' ? 'Your name' : 'Nama Anda';
        updatePricingDisplay();
      }
      window.setLanguage = function (value) {
        language = value === 'en' ? 'en' : 'id';
        try { localStorage.setItem('fncjt_language', language); } catch {}
        updateAccess();
      };

      /* Initialization Demo Data if clean */
      function getInitialDemoData() {
        const acc = {
          id: 'demo_acc',
          name: 'Akun Demo',
          broker: 'EXNESS',
          type: 'Standard',
          currency: 'USD',
          startBalance: 1000,
          status: 'Active'
        };
        const demoTrades = [
          { id: 't_1', accountId: 'demo_acc', date: '2026-05-04', jam: '14:20', market: 'XAUUSD', posisi: 'Buy', entry: 3210.5, sl: 3204.2, tp: 3229.4, vol: 0.05, riskPct: 1, result: 'Win', strategy: 'Order Block', tf: 'H1', reason: 'Retest OB demand, konfirmasi bullish' },
          { id: 't_2', accountId: 'demo_acc', date: '2026-05-06', jam: '16:45', market: 'XAUUSD', posisi: 'Sell', entry: 3241.8, sl: 3248.6, tp: 3221.4, vol: 0.05, riskPct: 1, result: 'Win', strategy: 'Liquidity Sweep', tf: 'M15', reason: 'Sweep high lalu reversal rejection' },
          { id: 't_3', accountId: 'demo_acc', date: '2026-05-08', jam: '09:10', market: 'EURUSD', posisi: 'Sell', entry: 1.0912, sl: 1.0928, tp: 1.0880, vol: 0.10, riskPct: 1, result: 'Loss', strategy: 'Break of Structure', tf: 'H1', reason: 'Struktur gagal lanjut, kena SL' },
          { id: 't_4', accountId: 'demo_acc', date: '2026-05-12', jam: '19:30', market: 'XAUUSD', posisi: 'Buy', entry: 3268.3, sl: 3261.9, tp: 3287.5, vol: 0.05, riskPct: 1, result: 'Win', strategy: 'FVG Fill', tf: 'H4', reason: 'Isi imbalance FVG lalu lanjut trend bullish' },
          { id: 't_5', accountId: 'demo_acc', date: '2026-05-14', jam: '13:15', market: 'XAUUSD', posisi: 'Sell', entry: 3290.1, sl: 3296.4, tp: 3277.6, vol: 0.05, riskPct: 1, result: 'BE', strategy: 'Supply/Demand', tf: 'M15', reason: 'Tutup manual di BE, momentum melemah' },
          { id: 't_6', accountId: 'demo_acc', date: '2026-05-18', jam: '15:00', market: 'GBPUSD', posisi: 'Sell', entry: 1.2745, sl: 1.2762, tp: 1.2711, vol: 0.10, riskPct: 1, result: 'Win', strategy: 'Trend Following', tf: 'H1', reason: 'Pullback ke EMA, lanjut trend turun' },
          { id: 't_7', accountId: 'demo_acc', date: '2026-05-21', jam: '20:10', market: 'XAUUSD', posisi: 'Buy', entry: 3312.7, sl: 3305.8, tp: 3333.4, vol: 0.05, riskPct: 1, result: 'Win', strategy: 'Order Block', tf: 'H4', reason: 'OB H4 valid, target R tercapai' },
          { id: 't_8', accountId: 'demo_acc', date: '2026-05-25', jam: '11:30', market: 'XAUUSD', posisi: 'Sell', entry: 3345.2, sl: 3352.1, tp: 3331.5, vol: 0.05, riskPct: 1, result: 'Loss', strategy: 'Liquidity Sweep', tf: 'M15', reason: 'Salah baca sweep, kena SL' }
        ];
        return { acc, trades: demoTrades };
      }

      /* Storage Load & Save */
      function loadData() {
        try {
          const accRaw = localStorage.getItem(K_ACCOUNTS);
          const trRaw = localStorage.getItem(K_TRADES);
          const setRaw = localStorage.getItem(K_SETTINGS);
          const profRaw = localStorage.getItem(K_PROFILE);

          if (accRaw) { const value = JSON.parse(accRaw); if (Array.isArray(value) && value.every(a => a && typeof a === 'object')) accounts = value; }
          if (trRaw) { const value = JSON.parse(trRaw); if (Array.isArray(value) && value.every(t => t && typeof t === 'object')) trades = value; }
          if (setRaw) { const value = JSON.parse(setRaw); if (value && typeof value === 'object' && !Array.isArray(value)) settings = { kurs: Number(value.kurs) || 17000, billingAnnual: !!value.billingAnnual, exchangeUpdatedAt: Number(value.exchangeUpdatedAt) || null }; }
          if (profRaw) { const value = JSON.parse(profRaw); if (value && typeof value === 'object' && !Array.isArray(value)) profile = { name: String(value.name || 'Trader').slice(0, 80), currentAccount: safeId(value.currentAccount) }; }

          if (/^(radit|ratib)$/i.test(profile.name.trim())) {
            profile.name = 'Trader';
            saveData();
          }
          if (!accounts.length) {
            const initial = getInitialDemoData();
            accounts = [{ ...initial.acc, id: 'local_acc', name: 'Akun Lokal', broker: 'Belum diatur', startBalance: 0 }];
            profile.currentAccount = 'local_acc';
            saveData();
          }
        } catch (e) {
          console.error("Storage load error:", e);
        }
      }

      window.seedSampleTrades = function () {
        const initial = getInitialDemoData();
        trades = initial.trades;
        if (!accounts.length) accounts = [initial.acc];
        saveData();
        renderJournalTable();
        renderStatistics();
        renderProfileView();
        alert('8 data trade simulasi berhasil dimuat ke jurnal Anda!');
      };

      function saveData() {
        try {
          localStorage.setItem(K_ACCOUNTS, JSON.stringify(accounts));
          localStorage.setItem(K_TRADES, JSON.stringify(trades));
          localStorage.setItem(K_SETTINGS, JSON.stringify(settings));
          localStorage.setItem(K_PROFILE, JSON.stringify(profile));
        } catch (e) {
          console.error("Storage save error:", e);
        }
        if (window.renderStatistics) renderStatistics();
      }

      function disciplineMetrics(rows) {
        const risks = rows.map(t => t.riskPct).filter(v => Number.isFinite(v) && v > 0);
        return { total: rows.length, slPct: rows.length ? rows.filter(t => Number.isFinite(t.sl) && t.sl > 0).length / rows.length * 100 : 0,
          riskCount: risks.length, avgRisk: risks.length ? risks.reduce((sum, v) => sum + v, 0) / risks.length : null };
      }

      let exchangeBusy = false;
      let exchangeCheckedAt = 0;
      window.refreshExchangeRate = async function () {
        if (exchangeBusy) return;
        exchangeBusy = true;
        const status = $('exchange-status');
        status.textContent = 'Mengambil kurs terbaru...';
        try {
          const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const data = await response.json();
          const rate = data.rates?.IDR;
          if (data.result !== 'success' || data.base_code !== 'USD' || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(data.time_last_update_unix)) throw new Error('Kurs tidak valid');
          settings.kurs = rate;
          exchangeCheckedAt = Date.now();
          settings.exchangeUpdatedAt = data.time_last_update_unix;
          saveData();
          $('p-kurs-input').value = rate;
          renderJournalTable();
          renderStatistics();
          runAllCalculators();
          const updated = new Date(data.time_last_update_unix * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
          status.textContent = '1 USD = Rp ' + rate.toLocaleString('id-ID') + ' | 1 IDR = USD ' + (1 / rate).toFixed(8) + '. Data: ' + updated + ' WIB (pembaruan harian).';
        } catch (error) {
          status.textContent = 'Kurs otomatis belum tersedia. Menggunakan kurs tersimpan Rp ' + Number(settings.kurs).toLocaleString('id-ID') + ' per USD.';
        } finally { exchangeBusy = false; }
      };

      /* Formatting Helpers */
      function fmtPLUSD(val) {
        const num = parseFloat(val) || 0;
        const sign = num < 0 ? '-$' : (num > 0 ? '+$' : '$');
        return sign + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      function fmtPLIDR(val) {
        const num = parseFloat(val) || 0;
        const sign = num < 0 ? '-Rp' : (num > 0 ? '+Rp' : 'Rp');
        return sign + Math.abs(num).toLocaleString('id-ID', { maximumFractionDigits: 0 });
      }

      function fmtUSD(val) {
        const num = parseFloat(val) || 0;
        const sign = num < 0 ? '-$' : '$';
        return sign + Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      function fmtIDR(val) {
        const num = parseFloat(val) || 0;
        const sign = num < 0 ? '-Rp' : 'Rp';
        return sign + Math.abs(num).toLocaleString('id-ID', { maximumFractionDigits: 0 });
      }

      function currentAccount() {
        return accounts.find(a => a.id === profile.currentAccount) || accounts[0] || null;
      }

      /* Trade P/L & Metrics Calculation */
      function computeTradeMetrics(t, acc) {
        if (!t) return { riskUSD: 0, rr: 0, pnlUSD: 0, pnlIDR: 0 };
        if (Number.isFinite(t.actualPnl) && ['USD','IDR'].includes(t.pnlCurrency)) {
          const kurs = Number(settings.kurs) || 17000;
          const pnlUSD = t.pnlCurrency === 'USD' ? t.actualPnl : t.actualPnl/kurs;
          const hasLevels = [t.entry,t.sl,t.tp].every(value=>Number.isFinite(value)&&value>0) && t.entry!==t.sl;
          const account = acc || currentAccount();
          return { pnlUSD, pnlIDR:t.pnlCurrency==='IDR'?t.actualPnl:pnlUSD*kurs,
            riskUSD:Number.isFinite(t.riskPct)?t.riskPct/100*(Number(account?.startBalance)||0):null,
            rr:hasLevels?Math.abs(t.tp-t.entry)/Math.abs(t.entry-t.sl):null };
        }
        const account = acc || currentAccount();
        const startBal = account ? (parseFloat(account.startBalance) || 1000) : 1000;
        const riskPct = parseFloat(t.riskPct) || 1;
        const riskUSD = (riskPct / 100) * startBal;
        const entry = parseFloat(t.entry) || 0;
        const sl = parseFloat(t.sl) || 0;
        const tp = parseFloat(t.tp) || 0;
        const slDist = Math.abs(entry - sl);
        const tpDist = Math.abs(tp - entry);
        const rr = slDist > 0 ? (tpDist / slDist) : 0;
        let pnlUSD = 0;

        const res = (t.result || '').toString().trim().toLowerCase();
        if (res === 'win') {
          pnlUSD = riskUSD * rr;
        } else if (res === 'loss') {
          pnlUSD = -riskUSD;
        } else {
          pnlUSD = 0; // BE
        }

        const kurs = parseFloat(settings.kurs) || 17000;
        const pnlIDR = pnlUSD * kurs;
        return {
          riskUSD: isNaN(riskUSD) ? 0 : riskUSD,
          rr: isNaN(rr) ? 0 : rr,
          pnlUSD: isNaN(pnlUSD) ? 0 : pnlUSD,
          pnlIDR: isNaN(pnlIDR) ? 0 : pnlIDR
        };
      }

      /* Tab Switching */
      window.switchTab = function (tabId) {
        if (!$('view-' + tabId)) return;
        if (tabId !== 'beranda' && !onboarding.started) {
          $('home-access-hint').focus();
          return;
        }
        document.querySelectorAll('.nav-tab').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === tabId);
        });
        document.querySelectorAll('.view-content').forEach(v => {
          v.classList.toggle('active', v.id === 'view-' + tabId);
        });

        if (tabId === 'statistik') {
          renderStatistics();
        } else if (tabId === 'jurnal') {
          renderJournalTable();
        } else if (tabId === 'profil') {
          renderProfileView();
        } else if (tabId === 'kalkulator') {
          runAllCalculators();
        } else if (tabId === 'berita') {
          renderEconomicCalendar();
          renderMarketAnalysis();
        }
        applyLanguage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      function persistOnboarding() {
        try { localStorage.setItem('fncjt_onboarding', JSON.stringify(onboarding)); }
        catch { $('home-access-hint').textContent = language === 'en' ? 'Your session is active. Browser storage is unavailable.' : 'Sesi aktif. Penyimpanan browser tidak tersedia.'; }
      }

      function updateAccess() {
        document.querySelectorAll('.nav-tab, [data-workspace-action]').forEach(button => {
          const locked = button.dataset.tab !== 'beranda' && !onboarding.started;
          button.disabled = locked;
          button.setAttribute('aria-disabled', String(locked));
          button.title = locked ? (language === 'en' ? 'Click Try on Home to open this tab.' : 'Klik Coba di Beranda untuk membuka tab ini.') : '';
        });
        $('home-access-hint').dataset.i18n = onboarding.started ? 'accessReady' : 'accessHint';
        $('nav-login-label').dataset.i18n = onboarding.name ? 'localProfile' : 'signIn';
        $('nav-dd-username').textContent = onboarding.name || (language === 'en' ? 'Welcome' : 'Selamat datang');
        $('nav-dd-username').removeAttribute('data-i18n');
        $('nav-dd-status').dataset.i18n = onboarding.name ? 'localProfileStatus' : 'guestStatus';
        $('menu-login').dataset.i18n = onboarding.name ? 'changeProfile' : 'loginMenu';
        $('menu-logout').hidden = !onboarding.name;
        applyLanguage();
      }

      window.startTrial = function () {
        onboarding.started = true;
        updateAccess();
        persistOnboarding();
        closeNavAccountDropdown();
        switchTab('jurnal');
      };

      window.openLoginDialog = function () {
        closeNavAccountDropdown();
        $('local-login-name').value = onboarding.name;
        $('local-login-name').setCustomValidity('');
        $('login-feedback').textContent = '';
        $('login-dialog').showModal();
      };
      window.closeLoginDialog = function () { $('login-dialog').close(); };
      window.signInLocal = function (event) {
        event.preventDefault();
        const input = $('local-login-name');
        const name = input.value.trim();
        input.setCustomValidity(name ? '' : (language === 'en' ? 'Enter your profile name.' : 'Isi nama profil Anda.'));
        if (!input.reportValidity()) return;
        if (onboarding.name !== name) onboarding.started = false;
        onboarding.name = name;
        profile.name = name;
        persistOnboarding();
        saveData();
        renderProfileView();
        updateAccess();
        closeLoginDialog();
        switchTab('beranda');
      };
      $('local-login-name').addEventListener('input', event => event.target.setCustomValidity(''));
      window.signOutLocal = function () {
        onboarding = { name: '', started: false };
        persistOnboarding();
        updateAccess();
        closeNavAccountDropdown();
        switchTab('beranda');
      };

      /* Header Account Dropdown Menu */
      window.toggleNavAccountDropdown = function (e) {
        if (e) e.stopPropagation();
        const dd = $('nav-account-dropdown');
        const btn = $('btn-nav-masuk');
        if (!dd) return;
        const isHidden = dd.hidden;
        dd.hidden = !isHidden;
        if (btn) { btn.classList.toggle('active', isHidden); btn.setAttribute('aria-expanded', String(isHidden)); }
      };

      window.closeNavAccountDropdown = function () {
        const dd = $('nav-account-dropdown');
        const btn = $('btn-nav-masuk');
        if (dd) dd.hidden = true;
        if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-expanded', 'false'); }
      };

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown-wrap')) {
          closeNavAccountDropdown();
        }
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          if (!$('nav-account-dropdown').hidden) { closeNavAccountDropdown(); $('btn-nav-masuk').focus(); }
          if ($('upload-modal').classList.contains('open')) closeUploadModal();
        }
        const modal = $('upload-modal');
        if (event.key === 'Tab' && modal.classList.contains('open')) {
          const controls = [...modal.querySelectorAll('button:not(:disabled), input, textarea, summary, [tabindex="0"]')].filter(element => element.getClientRects().length);
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      });

      /* Billing Cycle Toggle */
      window.setBillingCycle = function (isAnnual) {
        settings.billingAnnual = isAnnual;
        saveData();
        updatePricingDisplay();
      };

      window.toggleBillingCycle = function () {
        setBillingCycle(!settings.billingAnnual);
      };

      function updatePricingDisplay() {
        const annual = settings.billingAnnual;
        document.querySelectorAll('[data-cycle]').forEach(button => {
          const active = (button.dataset.cycle === 'annual') === annual;
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', String(active));
        });
        $('plus-price').textContent = annual ? '$100' : '$10';
        $('pro-price').textContent = annual ? '$200' : '$20';
        ['plus', 'pro'].forEach(plan => {
          $(plan + '-period').textContent = language === 'en' ? (annual ? 'USD / year' : 'USD / month') : (annual ? 'USD / tahun' : 'USD / bulan');
          $(plan + '-billing').textContent = language === 'en' ? (annual ? 'Billed annually · Save 17%' : 'Billed monthly') : (annual ? 'Ditagih tahunan · Hemat 17%' : 'Ditagih bulanan');
        });
      }

      window.scrollToPricing = function () {
        const el = $('pricing-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      };

      /* ====================================================================
         JOURNAL ENGINE & TABLE
         ==================================================================== */
      window.toggleTradeForm = function () {
        const p = $('trade-form-panel');
        if (!p) return;
        p.classList.toggle('open');
        if (p.classList.contains('open')) {
          $('q-market').focus();
        }
      };

      window.openQuickTrade = function () {
        const p = $('trade-form-panel');
        if (p) p.classList.add('open');
        setEntryMode('quick');
      };

      window.closeTradeForm = function () {
        const p = $('trade-form-panel');
        if (p) p.classList.remove('open');
        currentEditingTradeId = null;
      };

      window.setEntryMode = function (mode) {
        $('btn-mode-quick').classList.toggle('active', mode === 'quick');
        $('btn-mode-paste').classList.toggle('active', mode === 'paste');
        $('btn-mode-full').classList.toggle('active', mode === 'full');

        $('subform-quick').style.display = mode === 'quick' ? 'block' : 'none';
        $('subform-paste').style.display = mode === 'paste' ? 'block' : 'none';
        $('subform-full').style.display = mode === 'full' ? 'block' : 'none';

        if (mode === 'full') {
          populateAccountSelect();
          const today = new Date().toISOString().slice(0, 10);
          const nowTime = new Date().toTimeString().slice(0, 5);
          if (!$('f-date').value) $('f-date').value = today;
          if (!$('f-time').value) $('f-time').value = nowTime;
          updateFullFormCalculations();
        }
      };

      function populateAccountSelect() {
        const sel = $('f-account');
        if (!sel) return;
        sel.innerHTML = accounts.map(a => `<option value="${esc(a.id)}">${esc(a.name)} (${esc(a.broker)})</option>`).join('');
        if (profile.currentAccount) sel.value = profile.currentAccount;
      }

      window.saveQuickTrade = function () {
        const market = ($('q-market').value || '').trim().toUpperCase();
        const entry = parseFloat($('q-entry').value);
        const sl = parseFloat($('q-sl').value);
        const tp = parseFloat($('q-tp').value);
        const risk = parseFloat($('q-risk').value) || 1.0;
        const pos = $('q-posisi').value;
        const res = $('q-result').value;

        if (!market || isNaN(entry) || isNaN(sl) || isNaN(tp)) {
          alert('Mohon lengkapi Market, Entry, Stop Loss, dan Take Profit.');
          return;
        }

        const now = new Date();
        const newTrade = {
          id: 't_' + Date.now(),
          accountId: profile.currentAccount || (accounts[0] ? accounts[0].id : 'demo_acc'),
          date: now.toISOString().slice(0, 10),
          jam: now.toTimeString().slice(0, 5),
          market: market,
          posisi: pos,
          entry: entry,
          sl: sl,
          tp: tp,
          vol: 0.05,
          riskPct: risk,
          result: res,
          strategy: 'Quick Trade',
          tf: 'M15',
          reason: 'Entri cepat via form'
        };

        trades.unshift(newTrade);
        saveData();
        closeTradeForm();
        renderJournalTable();
        // Clear quick inputs
        $('q-market').value = '';
        $('q-entry').value = '';
        $('q-sl').value = '';
        $('q-tp').value = '';
      };

      window.saveBatchPaste = function () {
        const text = ($('paste-input').value || '').trim();
        if (!text) {
          alert('Tempel baris trade Anda terlebih dahulu.');
          return;
        }

        const lines = text.split('\n');
        let count = 0;
        const now = new Date();

        lines.forEach(l => {
          const parts = l.split('|').map(s => s.trim());
          if (parts.length >= 6) {
            const market = parts[0].toUpperCase();
            const pos = parts[1].toLowerCase().includes('buy') ? 'Buy' : 'Sell';
            const entry = parseFloat(parts[2]);
            const sl = parseFloat(parts[3]);
            const tp = parseFloat(parts[4]);
            const resRaw = parts[5].toLowerCase();
            const res = resRaw.includes('win') ? 'Win' : (resRaw.includes('loss') ? 'Loss' : 'BE');

            if (market && !isNaN(entry) && !isNaN(sl) && !isNaN(tp)) {
              trades.unshift({
                id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                accountId: profile.currentAccount || (accounts[0] ? accounts[0].id : 'demo_acc'),
                date: now.toISOString().slice(0, 10),
                jam: now.toTimeString().slice(0, 5),
                market: market,
                posisi: pos,
                entry: entry,
                sl: sl,
                tp: tp,
                vol: 0.05,
                riskPct: 1.0,
                result: res,
                strategy: 'Batch Import',
                tf: 'M15',
                reason: 'Impor tempel teks'
              });
              count++;
            }
          }
        });

        if (count > 0) {
          saveData();
          closeTradeForm();
          $('paste-input').value = '';
          renderJournalTable();
          alert(`Berhasil menyimpan ${count} baris trade!`);
        } else {
          alert('Format baris tidak sesuai. Pastikan menggunakan pemisah pipa (|).');
        }
      };

      window.updateFullFormCalculations = function () {
        const entry = parseFloat($('f-entry').value) || 0;
        const sl = parseFloat($('f-sl').value) || 0;
        const tp = parseFloat($('f-tp').value) || 0;
        const risk = parseFloat($('f-risk').value) || 1.0;
        const acc = currentAccount();
        const bal = acc ? acc.startBalance : 1000;
        const riskUSD = (risk / 100) * bal;
        const slDist = Math.abs(entry - sl);
        const tpDist = Math.abs(tp - entry);
        const rr = slDist > 0 ? (tpDist / slDist) : 0;
        const estPL = riskUSD * rr;

        $('preview-risk').textContent = fmtUSD(riskUSD);
        $('preview-rr').textContent = '1 : ' + rr.toFixed(2);
        $('preview-pl').textContent = fmtPLUSD(estPL);
        $('preview-idr').textContent = fmtPLIDR(estPL * settings.kurs);
      };

      window.saveFullTrade = function () {
        const market = ($('f-market').value || '').trim().toUpperCase();
        const entry = parseFloat($('f-entry').value);
        const sl = parseFloat($('f-sl').value);
        const tp = parseFloat($('f-tp').value);
        const date = $('f-date').value;
        const time = $('f-time').value;
        const vol = parseFloat($('f-vol').value) || 0.05;
        const risk = parseFloat($('f-risk').value) || 1.0;
        const pos = $('f-posisi').value;
        const res = $('f-result').value;
        const strat = $('f-strat').value.trim() || 'General';
        const tf = $('f-tf').value;
        const reason = $('f-reason').value.trim();
        const accId = $('f-account').value || profile.currentAccount;

        if (!market || isNaN(entry) || isNaN(sl) || isNaN(tp)) {
          alert('Mohon isi Market, Entry, Stop Loss, dan Take Profit.');
          return;
        }

        if (currentEditingTradeId) {
          const idx = trades.findIndex(t => t.id === currentEditingTradeId);
          if (idx !== -1) {
            trades[idx] = {
              ...trades[idx],
              accountId: accId,
              date: date,
              jam: time,
              market: market,
              posisi: pos,
              entry: entry,
              sl: sl,
              tp: tp,
              vol: vol,
              riskPct: risk,
              result: res,
              strategy: strat,
              tf: tf,
              reason: reason
            };
          }
          currentEditingTradeId = null;
        } else {
          trades.unshift({
            id: 't_' + Date.now(),
            accountId: accId,
            date: date || new Date().toISOString().slice(0, 10),
            jam: time || new Date().toTimeString().slice(0, 5),
            market: market,
            posisi: pos,
            entry: entry,
            sl: sl,
            tp: tp,
            vol: vol,
            riskPct: risk,
            result: res,
            strategy: strat,
            tf: tf,
            reason: reason
          });
        }

        saveData();
        closeTradeForm();
        renderJournalTable();
      };

      window.editTrade = function (id) {
        const t = trades.find(x => x.id === id);
        if (!t) return;
        currentEditingTradeId = id;
        toggleTradeForm();
        setEntryMode('full');

        $('f-date').value = t.date || '';
        $('f-time').value = t.jam || '';
        $('f-market').value = t.market || '';
        $('f-posisi').value = t.posisi || 'Buy';
        $('f-entry').value = t.entry || '';
        $('f-sl').value = t.sl || '';
        $('f-tp').value = t.tp || '';
        $('f-vol').value = t.vol || '';
        $('f-risk').value = t.riskPct || 1;
        $('f-result').value = t.result || 'Win';
        $('f-strat').value = t.strategy || '';
        $('f-tf').value = t.tf || 'M15';
        $('f-reason').value = t.reason || '';
        if (t.accountId) $('f-account').value = t.accountId;

        updateFullFormCalculations();
        $('btn-save-full').textContent = 'Perbarui Trade';
      };

      window.deleteTrade = function (id) {
        if (confirm('Hapus trade ini dari jurnal?')) {
          trades = trades.filter(t => t.id !== id);
          saveData();
          renderJournalTable();
        }
      };

      function updateFilterOptions() {
        const marketSel = $('filter-market');
        if (marketSel) {
          const curVal = marketSel.value;
          const uniqueMarkets = [...new Set(trades.map(t => (t.market || '').toString().trim().toUpperCase()).filter(Boolean))].sort();
          const currentOpts = Array.from(marketSel.options).map(o => o.value).filter(Boolean);
          const isSame = uniqueMarkets.length === currentOpts.length && uniqueMarkets.every((m, i) => m === currentOpts[i]);
          if (!isSame) {
            marketSel.innerHTML = '<option value="">Semua Market</option>' +
              uniqueMarkets.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
            marketSel.value = curVal;
          }
        }

        const stratSel = $('filter-strategy');
        if (stratSel) {
          const curVal = stratSel.value;
          const uniqueStrats = [...new Set(trades.map(t => (t.strategy || '').toString().trim()).filter(Boolean))].sort();
          const currentOpts = Array.from(stratSel.options).map(o => o.value).filter(Boolean);
          const isSame = uniqueStrats.length === currentOpts.length && uniqueStrats.every((s, i) => s === currentOpts[i]);
          if (!isSame) {
            stratSel.innerHTML = '<option value="">Semua Strategi</option>' +
              uniqueStrats.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
            stratSel.value = curVal;
          }
        }
      }

      window.resetJournalFilters = function () {
        if ($('filter-market')) $('filter-market').value = '';
        if ($('filter-result')) $('filter-result').value = '';
        if ($('filter-strategy')) $('filter-strategy').value = '';
        if ($('filter-search')) $('filter-search').value = '';
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        const allChip = $('chip-filter-all');
        if (allChip) allChip.classList.add('active');
        renderJournalTable();
      };

      window.setResultFilter = function (res, btn) {
        document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const sel = $('filter-result');
        if (sel) sel.value = res;
        renderJournalTable();
      };

      window.renderJournalTable = function () {
        const tbody = $('journal-tbody');
        const emptyMsg = $('journal-empty-msg');
        if (!tbody) return;

        updateFilterOptions();

        // Calculate pulse ribbon stats for all trades
        let jWins = 0, jLoss = 0, jBE = 0;
        let jNetUSD = 0, jWinUSD = 0, jLossUSD = 0;
        let jTotalRR = 0, jRRCount = 0;

        trades.filter(t => t.accountId === profile.currentAccount).forEach(t => {
          const m = computeTradeMetrics(t);
          if (Number.isFinite(m.rr)) { jTotalRR += m.rr; jRRCount++; }
          const res = (t.result || '').toString().trim().toLowerCase();
          if (res === 'win') {
            jWins++;
            jWinUSD += m.pnlUSD;
          } else if (res === 'loss') {
            jLoss++;
            jLossUSD += Math.abs(m.pnlUSD);
          } else {
            jBE++;
          }
          jNetUSD += m.pnlUSD;
        });

        const jTotal = trades.length;
        const jWinRate = jTotal ? ((jWins / jTotal) * 100) : 0;
        const jPF = jLossUSD > 0 ? (jWinUSD / jLossUSD) : (jWinUSD > 0 ? 99 : 0);
        const jAvgRR = jRRCount ? (jTotalRR / jRRCount) : null;

        if ($('j-stat-total')) $('j-stat-total').textContent = `${jTotal} Posisi`;
        if ($('j-stat-winrate')) {
          $('j-stat-winrate').textContent = `${jWinRate.toFixed(1)}%`;
          $('j-stat-winrate').style.color = jWinRate >= 50 ? 'var(--green)' : 'var(--red)';
        }
        if ($('j-stat-wincount')) $('j-stat-wincount').textContent = `${jWins} Win · ${jLoss} Loss · ${jBE} BE`;
        if ($('j-stat-netpl')) {
          $('j-stat-netpl').textContent = fmtPLUSD(jNetUSD);
          $('j-stat-netpl').style.color = jNetUSD >= 0 ? 'var(--green)' : 'var(--red)';
        }
        if ($('j-stat-idr')) {
          $('j-stat-idr').textContent = fmtPLIDR(jNetUSD * (settings.kurs || 17000));
          $('j-stat-idr').style.color = jNetUSD >= 0 ? 'var(--green)' : 'var(--red)';
        }
        if ($('j-stat-pf')) $('j-stat-pf').textContent = jPF > 50 ? '∞' : jPF.toFixed(2);
        if ($('j-stat-rr')) $('j-stat-rr').textContent = jAvgRR===null?'-':`1 : ${jAvgRR.toFixed(2)}`;

        const fMarket = (($('filter-market') && $('filter-market').value) || '').trim().toUpperCase();
        const fResult = (($('filter-result') && $('filter-result').value) || '').trim().toLowerCase();
        const fStrategy = (($('filter-strategy') && $('filter-strategy').value) || '').trim().toLowerCase();
        const fSearch = (($('filter-search') && $('filter-search').value) || '').trim().toLowerCase();

        const filtered = trades.filter(t => {
          const tMarket = (t.market || '').toString().trim().toUpperCase();
          const tResult = (t.result || '').toString().trim().toLowerCase();
          const tStrat = (t.strategy || '').toString().trim().toLowerCase();
          const tReason = (t.reason || '').toString().trim().toLowerCase();

          if (fMarket && tMarket !== fMarket) return false;
          if (fResult && tResult !== fResult) return false;
          if (fStrategy && tStrat !== fStrategy) return false;
          if (fSearch) {
            const matchReason = tReason.includes(fSearch);
            const matchMarket = tMarket.toLowerCase().includes(fSearch);
            const matchStrat = tStrat.includes(fSearch);
            if (!matchReason && !matchMarket && !matchStrat) return false;
          }
          return true;
        });

        if (!filtered.length) {
          tbody.innerHTML = '';
          if (emptyMsg) emptyMsg.style.display = 'block';
          return;
        }

        if (emptyMsg) emptyMsg.style.display = 'none';
        tbody.innerHTML = filtered.map((t, idx) => {
          try {
            const m = computeTradeMetrics(t);
            const pos = (t.posisi || 'Buy').toString().trim();
            const posClass = pos.toLowerCase() === 'sell' ? 'pos-sell' : 'pos-buy';
            const resVal = (t.result || 'Win').toString().trim();
            const resLower = resVal.toLowerCase();
            const resClass = resLower === 'win' ? 'res-win' : (resLower === 'loss' ? 'res-loss' : 'res-be');
            const pnlClass = m.pnlUSD > 0 ? 'res-win' : (m.pnlUSD < 0 ? 'res-loss' : 'res-be');
            const marketName = (t.market || 'XAUUSD').toString().trim().toUpperCase().replace(/[^A-Z0-9:_-]/g, '').slice(0, 24) || 'XAUUSD';
            const tradeId = safeId(t.id);

            return `<tr>
              <td style="color:var(--text-muted);">${filtered.length - idx}</td>
              <td>${esc(t.date || '-')}</td>
              <td style="color:var(--text-muted);">${esc(t.jam || '-')}</td>
              <td><button type="button" class="btn-market-link" onclick="openTradingView('${marketName}')" title="Buka chart ${marketName} di TradingView"><b>${marketName}</b> <span style="font-size:10px; opacity:0.5;">↗</span></button></td>
              <td><span class="pos-badge ${posClass}">${esc(pos.toUpperCase())}</span></td>
              <td>${esc(t.entry ?? '-')}</td>
              <td style="color:var(--red);">${esc(t.sl ?? '-')}</td>
              <td style="color:var(--green);">${esc(t.tp ?? '-')}</td>
              <td>${esc(t.vol ?? '-')}</td>
              <td>${t.riskPct===null?'-':esc(t.riskPct ?? 1)+'%'}</td>
              <td>${m.riskUSD===null?'-':fmtUSD(m.riskUSD)}</td>
              <td>${m.rr===null?'-':(m.rr || 0).toFixed(2)}</td>
              <td><span class="${resClass}">${esc(resVal)}</span></td>
              <td class="${pnlClass}">${fmtPLUSD(m.pnlUSD)}</td>
              <td class="${pnlClass}">${fmtPLIDR(m.pnlIDR)}</td>
              <td style="font-family:var(--sans);">${esc(t.strategy || '-')}</td>
              <td style="font-family:var(--sans); max-width:180px; overflow:hidden; text-overflow:ellipsis;" title="${esc(t.reason || '')}">
                ${esc(t.reason || '-')}
              </td>
              <td>
                <button class="btn btn-ghost btn-sm" style="padding:3px 7px;" onclick="editTrade('${tradeId}')" title="Edit">✎</button>
                <button class="btn btn-danger btn-sm" style="padding:3px 7px;" onclick="deleteTrade('${tradeId}')" title="Hapus">✕</button>
              </td>
            </tr>`;
          } catch (err) {
            console.error('Error rendering trade row:', err, t);
            return '';
          }
        }).join('');
      };

      /* ====================================================================
         UPLOAD JURNAL TRADE ENGINE (CODEFRONTS DRAG & DROP ZONE - MAKS 10MB)
         Spec: https://codefronts.com/components/css-file-upload-button/drag-and-drop-file-upload-zone/
         ==================================================================== */
      window.openUploadModal = function () {
        if (!onboarding.started) return;
        uploadTrigger = document.activeElement;
        scanJob++;
        currentScan = null;
        $('upload-modal').classList.add('open');
        $('upload-preview-area').style.display = 'none';
        $('btn-confirm-import').style.display = 'none';
        $('scan-result').hidden = true;
        $('fu-06-file').value = '';
        renderSavedScans();
        const chips = $('fu-06-chips');
        if (chips) chips.innerHTML = '';
        $('upload-status-msg').textContent = 'Pilih berkas dari perangkat Anda atau seret ke area dropzone di atas.';
        parsedTradesToImport = [];
        applyLanguage();
        $('upload-modal').focus();
      };

      window.closeUploadModal = function () {
        scanJob++;
        $('upload-modal').classList.remove('open');
        if (uploadTrigger) uploadTrigger.focus();
      };

      function formatFileSize(bytes) {
        const u = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        let n = bytes;
        while (n >= 1024 && i < u.length - 1) {
          n /= 1024;
          i++;
        }
        return (Math.round(n * 10) / 10) + ' ' + u[i];
      }

      function updateFuChips(files) {
        const chips = $('fu-06-chips');
        if (!chips) return;
        const list = Array.from(files);
        if (!list.length) {
          chips.innerHTML = '';
          return;
        }
        chips.innerHTML = list.map(f => {
          return `<li><span>${esc(f.name)}</span><b>${formatFileSize(f.size)}</b></li>`;
        }).join('');
      }

      function initUploadDropZone() {
        const zone = $('fu-06-zone') || $('drop-zone');
        const input = $('fu-06-file') || $('file-upload-input');
        if (!zone) return;

        let depth = 0;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
          zone.addEventListener(evt, e => {
            e.preventDefault();
            e.stopPropagation();
          });
        });

        zone.addEventListener('dragenter', () => {
          depth++;
          zone.classList.add('is-over');
        });

        zone.addEventListener('dragover', e => {
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        });

        zone.addEventListener('dragleave', () => {
          if (--depth <= 0) {
            depth = 0;
            zone.classList.remove('is-over');
          }
        });

        zone.addEventListener('drop', e => {
          depth = 0;
          zone.classList.remove('is-over');
          const dt = e.dataTransfer;
          if (dt && dt.files && dt.files.length) {
            updateFuChips(dt.files);
            processUploadFile(dt.files[0]);
          }
        });

        zone.addEventListener('click', e => {
          if (e.target.closest('label') && e.target.getAttribute('for')) return;
          if (input) input.click();
        });

        zone.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (input) input.click();
          }
        });

      }

      window.handleSelectedFile = function (input) {
        if (input.files && input.files.length) {
          updateFuChips(input.files);
          processUploadFile(input.files[0]);
        }
      };

      async function processUploadFile(file) {
        const status = $('upload-status-msg');
        const job = ++scanJob;
        parsedTradesToImport = [];
        currentScan = null;
        $('upload-preview-area').style.display = 'none';
        $('btn-confirm-import').style.display = 'none';
        $('scan-result').hidden = true;

        // Strict 10 MB upload limit check
        const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
        if (file.size > MAX_SIZE_BYTES) {
          const actualMB = (file.size / (1024 * 1024)).toFixed(2);
          status.innerHTML = `<span style="color:var(--red); font-weight:700;">Gagal: Ukuran file (${actualMB} MB) melebihi batas maksimum 10 MB.</span><br><span style="color:var(--text-muted); font-size:11.5px;">Silakan unggah dokumen yang lebih ringkas atau kompres file.</span>`;
          $('btn-confirm-import').style.display = 'none';
          $('upload-preview-area').style.display = 'none';
          return;
        }

        status.textContent = `${language === 'en' ? 'Reading' : 'Membaca'} ${file.name} (${formatFileSize(file.size)})…`;
        const ext = file.name.split('.').pop().toLowerCase();
        parsedTradesToImport = [];

        try {
          if (ext === 'txt' || ext === 'csv') {
            const text = await file.text();
            if (job === scanJob) parseTextOrCSV(text);
            return;
          }
          if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
            throw new Error('Gunakan PDF, PNG, JPG, TXT, atau CSV. Untuk Excel, ekspor ke CSV terlebih dahulu.');
          }
          const pages = ext === 'pdf' ? await scanPDF(file, job) : [await recognizeImage(file, job)];
          const text = pages.map((page, index) => (ext === 'pdf' ? `[Halaman ${index + 1}]\n` : '') + page.text.trim()).join('\n\n');
          if (job !== scanJob) return;
          if (!text.trim()) throw new Error('Tidak ada teks terbaca. Coba berkas yang lebih jelas atau salin teks secara manual.');
          currentScan = { name: file.name, text: text.trim(), recognition: analyzeTradeScan(pages), status: 'ready', scannedAt: new Date().toISOString() };
          showScan(currentScan);
          status.textContent = 'Pemindaian selesai. Periksa teks sebelum menyimpan hasil scan. Tidak ada trade yang ditambahkan.';
          applyLanguage();
        } catch (error) {
          if (job === scanJob) status.textContent = (language === 'en' ? 'Scan failed: ' : 'Pemindaian gagal: ') + error.message;
        }
      }

      async function recognizeImage(source, job) {
        if (!ocrLibrary) {
          ocrLibrary = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('OCR tidak dapat dimuat. Periksa koneksi lalu coba lagi.'));
            document.head.appendChild(script);
          }).catch(error => { ocrLibrary = null; throw error; });
        }
        await ocrLibrary;
        if (job !== scanJob) return { text: '', lines: [] };
        const worker = await Tesseract.createWorker('eng', 1, { logger: progress => {
          if (job === scanJob && progress.status === 'recognizing text') {
            $('upload-status-msg').textContent = `${language === 'en' ? 'Recognizing text' : 'Mengenali teks'} ${Math.round(progress.progress * 100)}%…`;
          }
        } });
        let bitmap;
        try {
          bitmap = await createImageBitmap(source);
          if (bitmap.width*bitmap.height>12000000 || Math.max(bitmap.width,bitmap.height)>10000) throw new Error('Gambar terlalu besar untuk OCR. Gunakan gambar maksimal 12 megapiksel.');
          const original = document.createElement('canvas');
          original.width = bitmap.width;
          original.height = bitmap.height;
          const context = original.getContext('2d');
          context.drawImage(bitmap, 0, 0);
          const raw = context.getImageData(0, 0, original.width, original.height).data;
          let brightness = 0, samples = 0;
          for (let i = 0; i < raw.length; i += 4000) { brightness += (raw[i]+raw[i+1]+raw[i+2])/3; samples++; }
          const dark = brightness/samples < 110;
          const scale = Math.min(2, 3600/Math.max(bitmap.width,bitmap.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(bitmap.width*scale);
          canvas.height = Math.round(bitmap.height*scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
          const pixels = ctx.getImageData(0,0,canvas.width,canvas.height);
          for (let i = 0; i < pixels.data.length; i += 4) {
            let gray = .299*pixels.data[i]+.587*pixels.data[i+1]+.114*pixels.data[i+2];
            if (dark) gray=255-gray;
            pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;
          }
          ctx.putImageData(pixels,0,0);
          await worker.setParameters({tessedit_pageseg_mode:dark?'11':'3', preserve_interword_spaces:'1'});
          const data = (await worker.recognize(canvas,{}, {text:true,blocks:true})).data;
          const linesFrom = (data, factor, x=0, y=0) => (data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]).map(l=>({
            text:l.text.trim(),confidence:l.confidence,bbox:{x0:l.bbox.x0/factor+x,y0:l.bbox.y0/factor+y,x1:l.bbox.x1/factor+x,y1:l.bbox.y1/factor+y}
          }))));
          const result = {text:data.text, lines:linesFrom(data,scale), width:bitmap.width, height:bitmap.height};
          if (dark && /Alert[\s\S]*Replay|\bStop\s*:|\bTarget\s*:/i.test(data.text)) {
            // ponytail: read solid TradingView labels; other chart themes fall back to the full OCR text.
            const mask = new Uint8Array(bitmap.width*bitmap.height);
            for (let n=0;n<mask.length;n++) {
              const i=n*4,r=raw[i],g=raw[i+1],b=raw[i+2];
              mask[n]=(r>170&&r>g*1.6&&r>b*1.3)||(g>100&&g>r*1.5&&b>60&&g>b*.85)?1:
                (n%bitmap.width>bitmap.width*.6&&r>=100&&r<=190&&Math.abs(r-g)<8&&Math.abs(r-b)<8)?2:0;
            }
            const boxes=[];
            for (let n=0;n<mask.length;n++) if (mask[n]) {
              const color=mask[n];mask[n]=0;const queue=[n];let x0=bitmap.width,y0=bitmap.height,x1=0,y1=0;
              for(let j=0;j<queue.length;j++) {
                const k=queue[j],x=k%bitmap.width,y=Math.floor(k/bitmap.width);
                x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
                for(const m of [x>0?k-1:-1,x<bitmap.width-1?k+1:-1,k-bitmap.width,k+bitmap.width]) if(m>=0&&m<mask.length&&mask[m]===color) {mask[m]=0;queue.push(m);}
              }
              if(queue.length>150&&x1-x0>35&&x1-x0<bitmap.width*.5&&y1-y0>=10&&y1-y0<70) boxes.push({x0,y0,x1,y1});
            }
            await worker.setParameters({tessedit_pageseg_mode:'6'});
            for (const box of boxes.slice(0,30)) {
              if (job!==scanJob) break;
              const crop=document.createElement('canvas');
              crop.width=(box.x1-box.x0+1)*3;crop.height=(box.y1-box.y0+1)*3;
              crop.getContext('2d').drawImage(bitmap,box.x0,box.y0,box.x1-box.x0+1,box.y1-box.y0+1,0,0,crop.width,crop.height);
              const labels=(await worker.recognize(crop,{}, {text:true,blocks:true})).data;
              result.lines.push(...linesFrom(labels,3,box.x0,box.y0).map(line=>({...line,label:true})));
              result.text+='\n'+labels.text;
              crop.width=crop.height=0;
            }
          }
          return result;
        }
        finally { bitmap?.close(); await worker.terminate(); }
      }

      async function scanPDF(file, job) {
        const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.296/build/pdf.worker.mjs';
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
        const pages = [];
        let detectedText = false;
        try {
          // ponytail: scan pages sequentially to bound memory; use a worker queue for large documents.
          for (let n = 1; n <= pdf.numPages && job === scanJob; n++) {
            $('upload-status-msg').textContent = `${language === 'en' ? 'Reading page' : 'Membaca halaman'} ${n}/${pdf.numPages}…`;
            const page = await pdf.getPage(n);
            const content = await page.getTextContent();
            let text = content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('');
            const size=page.getViewport({scale:1});
            let result={text, width:size.width, height:size.height, lines:content.items.filter(item=>item.str?.trim()).map(item=>({text:item.str,bbox:{x0:item.transform[4],x1:item.transform[4]+item.width,y0:size.height-item.transform[5]-item.height,y1:size.height-item.transform[5]}}))};
            if (!text.trim()) {
              const viewport = page.getViewport({ scale: Math.min(2, 2200 / page.getViewport({ scale: 1 }).width) });
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
              result = await recognizeImage(canvas, job);
              text = result.text;
              canvas.width = canvas.height = 0;
            }
            if (text.trim()) detectedText = true;
            pages.push(result);
            page.cleanup();
          }
          return detectedText ? pages : [{text:'',lines:[]}];
        } finally { await pdf.destroy(); }
      }

      function showScan(scan) {
        $('scan-result').hidden = false;
        $('scan-text').value = scan.text;
        $('scan-file-name').textContent = scan.name;
        renderScanRecognition(scan.recognition);
        const candidates=scanHistoryRows(scan);
        $('scan-import-controls').hidden=!candidates.length;
        $('btn-import-scan').disabled=false;
        $('btn-import-scan').textContent=language==='en'?`Add ${candidates.length} trades to journal`:`Masukkan ${candidates.length} transaksi ke jurnal`;
        $('btn-save-scan').disabled = false;
        applyLanguage();
      }

      function scanHistoryRows(scan) {
        const records=Array.isArray(scan?.recognition?.records)?scan.recognition.records:[];
        return records.filter(row=>row?.kind==='history' &&
          /^[A-Z][A-Z0-9._#-]{2,19}$/.test(row.market) && ['Buy','Sell'].includes(row.direction) &&
          [row.volume,row.entry,row.exit].every(value=>Number.isFinite(value)&&value>0) && Number.isFinite(row.profit) &&
          /^\d{4}-\d{2}-\d{2}$/.test(row.date||'') && /^\d{2}:\d{2}(?::\d{2})?$/.test(row.time||''));
      }

      window.importScanToJournal = async function () {
        const scan=currentScan, rows=scanHistoryRows(scan), account=currentAccount();
        const currency=$('scan-profit-currency').value;
        if(!rows.length || !account || !['USD','IDR'].includes(currency))return;
        const button=$('btn-import-scan');button.disabled=true;
        try {
          const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(account.id+'\n'+scan.text));
          const scanSource=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
          if (scan!==currentScan)return;
          if(trades.some(trade=>trade.scanSource===scanSource)) {
            $('upload-status-msg').textContent=language==='en'?'This scan is already in the journal.':'Hasil scan ini sudah ada di jurnal.';
            return;
          }
          const imported=rows.map(row=>({id:'t_'+crypto.randomUUID(),accountId:account.id,date:row.date,jam:row.time,
            market:row.market,posisi:row.direction,entry:row.entry,exit:row.exit,sl:null,tp:null,vol:row.volume,riskPct:null,
            result:row.profit>0?'Win':row.profit<0?'Loss':'BE',actualPnl:row.profit,pnlCurrency:currency,
            strategy:'Impor screenshot',tf:'',scanSource,
            reason:`${scan.name} · Exit ${row.exit} · Profit ${row.profit} ${currency} · SL/TP dan risiko belum diketahui.`}));
          const next=[...imported,...trades];
          localStorage.setItem(K_TRADES,JSON.stringify(next));
          trades=next;
          closeUploadModal();
          switchTab('jurnal');
          resetJournalFilters();
        } catch(error) {
          $('upload-status-msg').textContent=language==='en'?'Import failed. Keep your scan and try again.':'Impor gagal. Hasil scan tetap tersedia; periksa penyimpanan dan coba lagi.';
        } finally { button.disabled=false; }
      };

      function renderScanRecognition(recognition) {
        const container=$('scan-recognition');
        container.replaceChildren();
        if (!recognition?.records?.length) {
          container.textContent=language==='en'?'No supported trade layout detected. The readable text is available below.':'Format transaksi belum dikenali. Teks yang terbaca tetap tersedia di bawah.';
          return;
        }
        const heading=document.createElement('h4');
        heading.textContent=language==='en'?'Automatically detected information':'Informasi dikenali otomatis';
        container.appendChild(heading);
        const value=v=>v===null||v===undefined?'-':String(v);
        for (const kind of ['history','chart']) {
          const rows=recognition.records.filter(r=>r.kind===kind);
          if(!rows.length)continue;
          const title=document.createElement('p');
          title.textContent=kind==='history'?`Riwayat posisi · ${rows.length} baris`:`Setup chart · ${rows.length} setup`;
          container.appendChild(title);
          const wrap=document.createElement('div');wrap.className='scan-table-wrap';wrap.tabIndex=0;
          wrap.setAttribute('role','region');wrap.setAttribute('aria-label',title.textContent);
          const table=document.createElement('table');table.className='trade-table';
          const columns=kind==='history'?[['market','Market'],['direction','Posisi'],['volume','Lot'],['date','Tanggal'],['time','Waktu'],['entry','Entry'],['exit','Exit'],['profit','Profit*'],['result','Hasil']]:
            [['market','Market'],['direction','Posisi'],['entry','Entry'],['sl','SL'],['tp','TP'],['stopDistance','Jarak stop'],['targetDistance','Jarak target'],['rr','R:R'],['quantity','Qty alat'],['toolPnl','PnL alat']];
          table.innerHTML='<thead><tr>'+columns.map(c=>`<th>${esc(c[1])}</th>`).join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+columns.map(c=>`<td>${esc(value(row[c[0]]))}</td>`).join('')+'</tr>').join('')+'</tbody>';
          wrap.appendChild(table);container.appendChild(wrap);
          for(const row of rows)if(row.notes?.length){const note=document.createElement('p');note.textContent=`${row.market||'Chart'}: ${row.notes.join(' ')}`;container.appendChild(note);}
        }
        const warnings=document.createElement('p');
        warnings.textContent=recognition.warnings.join(' ')+' - berarti belum terbaca. '+(recognition.records.some(r=>r.kind==='history')?'*Profit mengikuti screenshot, mata uang belum diketahui. ':'')+'Periksa hasil OCR sebelum menyimpan. Jurnal tidak diubah otomatis.';
        container.appendChild(warnings);
      }

      function savedScans() {
        try {
          const value = JSON.parse(localStorage.getItem('fncjt_scans') || '[]');
          return Array.isArray(value) ? value.filter(s => s && typeof s.name === 'string' && typeof s.text === 'string' && s.status === 'ready') : [];
        } catch { return []; }
      }

      function renderSavedScans() {
        const scans = savedScans();
        $('saved-scans').replaceChildren();
        scans.forEach((scan, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'saved-scan-item';
          button.textContent = scan.name;
          button.onclick = () => {
            scanJob++;
            parsedTradesToImport = [];
            $('upload-preview-area').style.display = 'none';
            $('btn-confirm-import').style.display = 'none';
            currentScan = scans[index];
            showScan(currentScan);
            $('btn-save-scan').disabled = true;
            $('upload-status-msg').textContent = 'Hasil scan tersimpan di perangkat ini.';
            applyLanguage();
          };
          $('saved-scans').appendChild(button);
        });
        $('saved-scans-empty').hidden = scans.length > 0;
      }

      window.saveScanResult = function () {
        if (!currentScan) return;
        try {
          localStorage.setItem('fncjt_scans', JSON.stringify([currentScan, ...savedScans()]));
          renderSavedScans();
          $('btn-save-scan').disabled = true;
          $('upload-status-msg').textContent = 'Hasil scan disimpan di perangkat ini. Jurnal Anda tidak berubah.';
        } catch {
          $('upload-status-msg').textContent = 'Penyimpanan penuh. Salin teks hasil scan sebelum menutup jendela.';
        }
        applyLanguage();
      };

      function parseTextOrCSV(content) {
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        const parsed = [];
        const today = new Date().toISOString().slice(0, 10);
        const timeNow = new Date().toTimeString().slice(0, 5);

        lines.forEach(line => {
          // Detect delimiter: pipe, comma, semicolon, tab
          let delim = ',';
          if (line.includes('|')) delim = '|';
          else if (line.includes(';')) delim = ';';
          else if (line.includes('\t')) delim = '\t';

          const cols = line.split(delim).map(c => c.trim().replace(/^["']|["']$/g, ''));
          if (cols.length >= 5) {
            // Find numeric values for entry, sl, tp
            const nums = cols.filter(c => !isNaN(parseFloat(c)) && isFinite(c)).map(Number);
            const market = cols.find(c => /^[A-Z0-9]{5,7}$/i.test(c)) || cols[0];
            const pos = cols.some(c => /buy|long/i.test(c)) ? 'Buy' : 'Sell';
            const res = cols.some(c => /loss|rugi/i.test(c)) ? 'Loss' : (cols.some(c => /be|breakeven/i.test(c)) ? 'BE' : 'Win');

            if (nums.length >= 2 && market) {
              const entry = nums[0];
              const sl = nums[1] || (pos === 'Buy' ? entry - 10 : entry + 10);
              const tp = nums[2] || (pos === 'Buy' ? entry + 20 : entry - 20);

              parsed.push({
                id: 't_imp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                accountId: profile.currentAccount || 'demo_acc',
                date: today,
                jam: timeNow,
                market: market.toUpperCase(),
                posisi: pos,
                entry: entry,
                sl: sl,
                tp: tp,
                vol: 0.05,
                riskPct: 1.0,
                result: res,
                strategy: 'Imported File',
                tf: 'H1',
                reason: 'Auto-parsed from document'
              });
            }
          }
        });

        if (parsed.length > 0) {
          parsedTradesToImport = parsed;
          showUploadPreview(parsed);
          $('upload-status-msg').innerHTML = `<span style="color:var(--green);">✓ Berhasil membaca ${parsed.length} entri trade dari berkas!</span>`;
        } else {
          $('upload-status-msg').innerHTML = `<span style="color:var(--orange);">Tidak ditemukan baris data trade yang valid. Pastikan ada kolom Market, Entry, dan Stop Loss.</span>`;
        }
      }


      function showUploadPreview(list) {
        const area = $('upload-preview-area');
        const tbody = $('upload-preview-tbody');
        const btn = $('btn-confirm-import');

        tbody.innerHTML = list.map(t => `
          <tr>
            <td><b>${esc(t.market)}</b></td>
            <td><span class="pos-badge ${t.posisi === 'Buy' ? 'pos-buy' : 'pos-sell'}">${esc(t.posisi)}</span></td>
            <td>${esc(t.entry)}</td>
            <td style="color:var(--red);">${esc(t.sl)}</td>
            <td style="color:var(--green);">${esc(t.tp)}</td>
            <td>${esc(t.result)}</td>
          </tr>
        `).join('');

        area.style.display = 'block';
        btn.style.display = 'inline-flex';
        btn.textContent = `Impor ${list.length} Trade ke Jurnal`;
      }

      window.confirmParsedImport = function () {
        if (!parsedTradesToImport.length) return;
        trades = [...parsedTradesToImport, ...trades];
        saveData();
        closeUploadModal();
        renderJournalTable();
        alert(`Sukses! ${parsedTradesToImport.length} trade telah ditambahkan ke Jurnal Anda.`);
      };

      /* ====================================================================
         STATISTICS & CHARTS (CODEFRONTS TAILWIND DARK METRIC CARDS)
         ==================================================================== */
      window.renderStatistics = function () {
        const acc = currentAccount();
        const startBal = acc ? acc.startBalance : 1000;
        let wins = 0, losses = 0, bes = 0;
        let sumWinUSD = 0, sumLossUSD = 0;
        let totalRR = 0, rrCount = 0;
        let currentBalance = startBal;
        let peakBalance = startBal;
        let maxDrawdownUSD = 0;
        const equityCurve = [startBal];

        // Sort trades chronologically for stats
        const chronological = trades.filter(t => t.accountId === profile.currentAccount).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        let bestWinUSD = 0;
        let worstLossUSD = 0;
        let maxWinStreak = 0;
        let currentStreak = 0;

        chronological.forEach(t => {
          const m = computeTradeMetrics(t, acc);
          if (Number.isFinite(m.rr)) { totalRR += m.rr; rrCount++; }

          if (t.result === 'Win') {
            wins++;
            sumWinUSD += m.pnlUSD;
            if (m.pnlUSD > bestWinUSD) bestWinUSD = m.pnlUSD;
            currentStreak++;
            if (currentStreak > maxWinStreak) maxWinStreak = currentStreak;
          } else if (t.result === 'Loss') {
            losses++;
            sumLossUSD += Math.abs(m.pnlUSD);
            if (Math.abs(m.pnlUSD) > worstLossUSD) worstLossUSD = Math.abs(m.pnlUSD);
            currentStreak = 0;
          } else {
            bes++;
            currentStreak = 0;
          }

          currentBalance += m.pnlUSD;
          equityCurve.push(currentBalance);

          if (currentBalance > peakBalance) {
            peakBalance = currentBalance;
          }
          const dd = peakBalance - currentBalance;
          if (dd > maxDrawdownUSD) {
            maxDrawdownUSD = dd;
          }
        });

        const totalTrades = chronological.length;
        const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
        const netPL = sumWinUSD - sumLossUSD;
        const profitFactor = sumLossUSD > 0 ? (sumWinUSD / sumLossUSD) : (sumWinUSD > 0 ? 99 : 0);
        const avgRR = rrCount ? (totalRR / rrCount) : null;
        const expectancy = totalTrades ? (netPL / totalTrades) : 0;

        // Populate KPI Cards
        $('kpi-winrate').textContent = winRate.toFixed(1) + '%';
        $('kpi-win-count').textContent = `${wins} Win · ${losses} Loss · ${bes} BE`;
        $('kpi-winrate-delta').className = `kpi-delta ${winRate >= 50 ? 'pos' : 'neg'}`;
        $('kpi-winrate-delta').textContent = winRate >= 50 ? 'Win Rate Kuat' : 'Perlu Evaluasi';

        $('kpi-netpl').textContent = fmtPLUSD(netPL);
        $('kpi-netpl').style.color = netPL >= 0 ? 'var(--green)' : 'var(--red)';
        $('kpi-netpl-idr').textContent = fmtPLIDR(netPL * settings.kurs);
        $('kpi-netpl-delta').textContent = ((netPL / startBal) * 100).toFixed(1) + '% Saldo';
        $('kpi-netpl-delta').className = `kpi-delta ${netPL >= 0 ? 'pos' : 'neg'}`;

        $('kpi-pf').textContent = profitFactor > 50 ? '∞' : profitFactor.toFixed(2);
        $('kpi-total-trades').textContent = `${totalTrades} Trades`;

        $('kpi-max-dd').textContent = 'DD: -' + fmtUSD(maxDrawdownUSD);
        $('kpi-avg-rr').textContent = avgRR===null?'-':avgRR.toFixed(2) + 'R';
        $('kpi-expectancy').textContent = `Exp: ${fmtPLUSD(expectancy)}`;

        // Performance Matrix
        if ($('stat-best-win')) $('stat-best-win').textContent = '+' + fmtUSD(bestWinUSD);
        if ($('stat-worst-loss')) $('stat-worst-loss').textContent = '-' + fmtUSD(worstLossUSD);
        if ($('stat-win-streak')) $('stat-win-streak').textContent = `${maxWinStreak} Beruntun`;
        if ($('stat-max-dd-val')) $('stat-max-dd-val').textContent = '-' + fmtUSD(maxDrawdownUSD);
        if ($('stat-account-pill') && acc) $('stat-account-pill').textContent = `${acc.broker} (${acc.name})`;

        // Donut Breakdown percentages
        if ($('ds-win-pct')) $('ds-win-pct').textContent = totalTrades ? `${((wins / totalTrades) * 100).toFixed(0)}% (${wins})` : '0%';
        if ($('ds-loss-pct')) $('ds-loss-pct').textContent = totalTrades ? `${((losses / totalTrades) * 100).toFixed(0)}% (${losses})` : '0%';
        if ($('ds-be-pct')) $('ds-be-pct').textContent = totalTrades ? `${((bes / totalTrades) * 100).toFixed(0)}% (${bes})` : '0%';

        const report = disciplineMetrics(chronological);
        $('discipline-status').textContent = report.total ? report.total + ' trade' : 'Belum ada trade';
        $('discipline-sl').textContent = report.total ? report.slPct.toFixed(0) + '% tercatat' : 'Belum ada data';
        $('discipline-sl-bar').style.width = report.slPct + '%';
        $('discipline-risk').textContent = report.riskCount ? report.avgRisk.toFixed(2) + '% (' + report.riskCount + '/' + report.total + ' trade)' : 'Belum ada data risiko';
        $('discipline-dd').textContent = report.total && startBal > 0 ? (maxDrawdownUSD / startBal * 100).toFixed(2) + '% dari saldo awal' : 'Saldo awal dan transaksi diperlukan';
        $('discipline-summary').textContent = report.total ? 'Dihitung dari jurnal akun aktif. SL tercatat tidak memastikan pemasangan di broker; kondisi psikologi belum dicatat.' : 'Tambahkan transaksi untuk melihat rapor akun ini.';

        // Draw SVG Charts
        drawEquityCurveSVG(equityCurve);
        drawDonutChartSVG(wins, losses, bes, totalTrades);
        drawBreakdownBars();
      }

      function drawEquityCurveSVG(curve) {
        const svg = $('equity-chart-svg');
        if (!svg) return;
        const w = 800, h = 200, pad = 20;

        if (curve.length < 2) {
          svg.innerHTML = `<line x1="0" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--line)"/><text x="400" y="105" text-anchor="middle" fill="#64748b" font-size="12">Belum ada data eksekusi</text>`;
          return;
        }

        const min = Math.min(...curve);
        const max = Math.max(...curve);
        const range = (max - min) || 1;
        const stepX = (w - pad * 2) / (curve.length - 1);

        const pts = curve.map((v, i) => {
          const x = pad + i * stepX;
          const y = h - pad - ((v - min) / range) * (h - pad * 2);
          return [x, y];
        });

        const lineD = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
        const fillD = lineD + ` L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;
        const lastVal = curve[curve.length - 1];
        const firstVal = curve[0];
        const isUp = lastVal >= firstVal;
        const strokeColor = isUp ? '#10b981' : '#f43f5e';
        const fillGrad = isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)';

        svg.innerHTML = `
          <defs>
            <linearGradient id="eq-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${fillGrad}"/>
              <stop offset="100%" stop-color="transparent"/>
            </linearGradient>
          </defs>
          <path d="${fillD}" fill="url(#eq-grad)"/>
          <path d="${lineD}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        `;
      }

      function drawDonutChartSVG(w, l, b, total) {
        const svg = $('donut-chart-svg');
        if (!svg) return;
        if (!total) {
          svg.innerHTML = `<text x="160" y="100" text-anchor="middle" fill="#64748b" font-size="13">Belum ada trade</text>`;
          return;
        }

        const cx = 90, cy = 100, r = 58, rIn = 36;
        const data = [
          { label: 'Win', val: w, color: '#10b981' },
          { label: 'Loss', val: l, color: '#f43f5e' },
          { label: 'BE', val: b, color: '#64748b' }
        ];

        let startAngle = -Math.PI / 2;
        let paths = '';

        data.forEach(d => {
          if (!d.val) return;
          const sliceAngle = (d.val / total) * Math.PI * 2;
          const endAngle = startAngle + sliceAngle;

          const x1 = cx + r * Math.cos(startAngle);
          const y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle);
          const y2 = cy + r * Math.sin(endAngle);

          const xi1 = cx + rIn * Math.cos(endAngle);
          const yi1 = cy + rIn * Math.sin(endAngle);
          const xi2 = cx + rIn * Math.cos(startAngle);
          const yi2 = cy + rIn * Math.sin(startAngle);

          const largeArc = sliceAngle > Math.PI ? 1 : 0;
          paths += `<path d="M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} L${xi1},${yi1} A${rIn},${rIn} 0 ${largeArc} 0 ${xi2},${yi2} Z" fill="${d.color}"/>`;
          startAngle = endAngle;
        });

        const legend = data.map((d, i) => `
          <g transform="translate(180, ${60 + i * 26})">
            <rect width="10" height="10" rx="3" fill="${d.color}"/>
            <text x="16" y="9" font-size="12" fill="#cbd5e1">${d.label}: ${d.val} (${((d.val / total) * 100).toFixed(0)}%)</text>
          </g>
        `).join('');

        svg.innerHTML = paths + `
          <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="20" font-weight="700" fill="#ffffff" font-family="monospace">${total}</text>
          <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="9" fill="#8492a6" font-family="sans-serif">TRADES</text>
        ` + legend;
      }

      function drawBreakdownBars() {
        const stratMap = {};
        const marketMap = {};

        trades.forEach(t => {
          const m = computeTradeMetrics(t);
          const s = t.strategy || 'Uncategorized';
          const p = t.market || 'OTHER';
          stratMap[s] = (stratMap[s] || 0) + m.pnlUSD;
          marketMap[p] = (marketMap[p] || 0) + m.pnlUSD;
        });

        const renderBarGroup = (map, containerId) => {
          const c = $(containerId);
          if (!c) return;
          const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
          if (!entries.length) {
            c.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Belum ada data</span>';
            return;
          }
          const maxVal = Math.max(...entries.map(x => Math.abs(x[1]))) || 1;
          c.innerHTML = entries.slice(0, 5).map(([k, v]) => `
            <div class="bar-row">
              <div class="bar-label" title="${esc(k)}">${esc(k)}</div>
              <div class="bar-track">
                <div class="bar-fill" style="width:${(Math.abs(v) / maxVal) * 100}%; background:${v >= 0 ? 'var(--green)' : 'var(--red)'};"></div>
              </div>
              <div class="bar-val" style="color:${v >= 0 ? 'var(--green)' : 'var(--red)'};">${fmtPLUSD(v)}</div>
            </div>
          `).join('');
        };

        renderBarGroup(stratMap, 'strategy-breakdown');
        renderBarGroup(marketMap, 'market-breakdown');
      }

      /* ====================================================================
         CALCULATOR ENGINE
         ==================================================================== */
      const INSTRUMENTS = {
        'XAUUSD': { contract: 100, pip: 0.1, price: 3340, sl: 3332, tp: 3360 },
        'EURUSD': { contract: 100000, pip: 0.0001, price: 1.0920, sl: 1.0900, tp: 1.0970 },
        'GBPUSD': { contract: 100000, pip: 0.0001, price: 1.2750, sl: 1.2720, tp: 1.2825 },
        'USDJPY': { contract: 100000, pip: 0.01, price: 154.50, sl: 154.00, tp: 155.75 },
        'BTCUSD': { contract: 1, pip: 1, price: 94000, sl: 93000, tp: 96500 },
        'US30': { contract: 1, pip: 1, price: 44000, sl: 43850, tp: 44375 },
        'NAS100': { contract: 1, pip: 1, price: 20500, sl: 20400, tp: 20750 }
      };

      window._calcDirection = 'Buy';

      window.selectCalcAsset = function (inst, btn) {
        document.querySelectorAll('.cas-pill').forEach(p => p.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const sel = $('c-instrument');
        if (sel) sel.value = inst;

        const cfg = INSTRUMENTS[inst] || { contract: 100000, pip: 0.0001, price: 1.0, sl: 0.99, tp: 1.02 };
        if ($('c-contract')) $('c-contract').value = cfg.contract;
        if ($('c-pipsize')) $('c-pipsize').value = cfg.pip;
        if ($('c-entry-price')) $('c-entry-price').value = cfg.price;
        if ($('c-sl-price')) $('c-sl-price').value = cfg.sl;
        if ($('c-rr-tp')) $('c-rr-tp').value = cfg.tp;
        if ($('c-rr-entry')) $('c-rr-entry').value = cfg.price;
        if ($('c-rr-sl')) $('c-rr-sl').value = cfg.sl;

        runAllCalculators();
      };

      window.setCalcDirection = function (dir) {
        window._calcDirection = dir;
        const btnBuy = $('calc-dir-buy');
        const btnSell = $('calc-dir-sell');
        if (btnBuy) btnBuy.classList.toggle('active', dir === 'Buy');
        if (btnSell) btnSell.classList.toggle('active', dir === 'Sell');
        runAllCalculators();
      };

      window.setCalcBalance = function (bal) {
        if ($('c-balance')) $('c-balance').value = bal;
        runAllCalculators();
      };

      window.setCalcRisk = function (risk) {
        if ($('c-riskpct')) $('c-riskpct').value = risk;
        runAllCalculators();
      };

      window.syncCalcInputs = function (type) {
        if (type === 'entry') {
          if ($('c-rr-entry')) $('c-rr-entry').value = $('c-entry-price').value;
        } else if (type === 'sl') {
          if ($('c-rr-sl')) $('c-rr-sl').value = $('c-sl-price').value;
        }
        runAllCalculators();
      };

      window.handleInstrumentChange = function () {
        const inst = $('c-instrument').value;
        const cfg = INSTRUMENTS[inst] || { contract: 100000, pip: 0.0001, price: 1.0, sl: 0.99, tp: 1.02 };
        $('c-contract').value = cfg.contract;
        $('c-pipsize').value = cfg.pip;
        runAllCalculators();
      };

      window.runAllCalculators = function () {
        const contract = parseFloat($('c-contract') ? $('c-contract').value : 100) || 100;
        const pip = parseFloat($('c-pipsize') ? $('c-pipsize').value : 0.1) || 0.1;
        const pipValPerLot = contract * pip;

        // 1. Pip Value
        if ($('c-pipval-1')) $('c-pipval-1').textContent = fmtUSD(pipValPerLot * 1.0) + ' / pip';
        if ($('c-pipval-01')) $('c-pipval-01').textContent = fmtUSD(pipValPerLot * 0.1) + ' / pip';
        if ($('c-pipval-001')) $('c-pipval-001').textContent = fmtUSD(pipValPerLot * 0.01) + ' / pip';

        // 2. Lot Size from Risk
        const bal = parseFloat($('c-balance').value) || 1000;
        const riskPct = parseFloat($('c-riskpct').value) || 1.0;
        const entry = parseFloat($('c-entry-price').value) || 3340;
        const sl = parseFloat($('c-sl-price').value) || 3332;
        const slPips = Math.abs(entry - sl) / (pip || 1);
        const riskUSD = (riskPct / 100) * bal;
        const lotSize = (slPips > 0 && pipValPerLot > 0) ? (riskUSD / (slPips * pipValPerLot)) : 0;

        if ($('c-sl-pips-input')) $('c-sl-pips-input').value = slPips.toFixed(1) + ' pips';
        if ($('c-sl-pips')) $('c-sl-pips').textContent = slPips.toFixed(1) + ' pips';
        if ($('c-risk-amount')) $('c-risk-amount').textContent = '-' + fmtUSD(riskUSD);
        if ($('c-risk-idr')) $('c-risk-idr').textContent = fmtPLIDR(-riskUSD * (settings.kurs || 17000));
        if ($('c-suggested-lot')) $('c-suggested-lot').textContent = lotSize.toFixed(2) + ' Lot';

        // 3. R:R Checker
        const rrEntry = entry;
        const rrSL = sl;
        const rrTP = parseFloat($('c-rr-tp').value) || (entry + (Math.abs(entry - sl) * 2.5));
        const rrLot = lotSize > 0 ? lotSize : 0.10;

        const rrSLDist = Math.abs(rrEntry - rrSL) / (pip || 1);
        const rrTPDist = Math.abs(rrTP - rrEntry) / (pip || 1);
        const rrRatio = rrSLDist > 0 ? (rrTPDist / rrSLDist) : 0;
        const rrPotentialWin = rrTPDist * pipValPerLot * rrLot;
        const rrPotentialLoss = rrSLDist * pipValPerLot * rrLot;

        if ($('c-rr-dist')) $('c-rr-dist').textContent = `${rrSLDist.toFixed(0)} / ${rrTPDist.toFixed(0)} pips`;
        if ($('c-rr-win')) $('c-rr-win').textContent = '+' + fmtUSD(rrPotentialWin);
        if ($('c-win-idr')) $('c-win-idr').textContent = fmtPLIDR(rrPotentialWin * (settings.kurs || 17000));
        if ($('c-rr-loss')) $('c-rr-loss').textContent = '-' + fmtUSD(rrPotentialLoss);
        if ($('c-rr-ratio')) $('c-rr-ratio').textContent = '1 : ' + rrRatio.toFixed(2);
      };

      window.applyLotToJournal = function () {
        const inst = $('c-instrument') ? $('c-instrument').value : 'XAUUSD';
        const pos = window._calcDirection || 'Buy';
        const entry = parseFloat($('c-entry-price').value) || 3340;
        const sl = parseFloat($('c-sl-price').value) || 3332;
        const tp = parseFloat($('c-rr-tp').value) || 3360;
        const risk = parseFloat($('c-riskpct').value) || 1.0;
        const lotText = $('c-suggested-lot') ? $('c-suggested-lot').textContent : '0.10 Lot';
        const lot = parseFloat(lotText) || 0.10;

        switchTab('jurnal');
        const formPanel = $('trade-form-panel');
        if (formPanel && !formPanel.classList.contains('open')) {
          toggleTradeForm();
        }
        setEntryMode('full');

        if ($('f-market')) $('f-market').value = inst;
        if ($('f-posisi')) $('f-posisi').value = pos;
        if ($('f-entry')) $('f-entry').value = entry;
        if ($('f-sl')) $('f-sl').value = sl;
        if ($('f-tp')) $('f-tp').value = tp;
        if ($('f-vol')) $('f-vol').value = lot.toFixed(2);
        if ($('f-risk')) $('f-risk').value = risk;
        if ($('f-strat')) $('f-strat').value = 'Kalkulator Setup';
        if ($('f-reason')) $('f-reason').value = `Hasil kalkulasi lot ${lot.toFixed(2)} dengan risiko ${risk}% (${pos})`;

        updateFullFormCalculations();
        if (formPanel) formPanel.scrollIntoView({ behavior: 'smooth' });
      };

      /* ====================================================================
         PROFIL & MULTI-ACCOUNT MANAGEMENT
         ==================================================================== */
      window.renderProfileView = function () {
        $('p-trader-name').value = profile.name || 'Trader';
        $('p-kurs-input').value = settings.kurs || 17000;

        // Trader Passport Card updates
        const traderName = profile.name || 'Trader';
        if ($('tpc-display-name')) $('tpc-display-name').textContent = traderName;
        if ($('tpc-avatar-initials')) {
          const initials = traderName.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() || 'TR';
          $('tpc-avatar-initials').textContent = initials;
        }

        const curAcc = currentAccount();
        if ($('tpc-sub-status') && curAcc) {
          $('tpc-sub-status').textContent = `Trader Mandiri · Akun Utama: ${curAcc.broker} ${curAcc.type || 'Standard'} (${curAcc.name})`;
        }

        const totalEquity = accounts.reduce((sum, a) => sum + (parseFloat(a.startBalance) || 0), 0);
        if ($('tpc-total-equity')) $('tpc-total-equity').textContent = fmtUSD(totalEquity);

        const wins = trades.filter(t => t.result === 'Win').length;
        const totalTrades = trades.length;
        const wr = totalTrades ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
        if ($('tpc-winrate')) $('tpc-winrate').textContent = wr + '%';
        if ($('tpc-total-trades')) $('tpc-total-trades').textContent = `${totalTrades} Trade`;

        // Storage Vault status calculation
        try {
          const totalBytes = (localStorage.getItem(K_ACCOUNTS) || '').length +
                             (localStorage.getItem(K_TRADES) || '').length +
                             (localStorage.getItem(K_SETTINGS) || '').length +
                             (localStorage.getItem(K_PROFILE) || '').length;
          const kb = (totalBytes / 1024).toFixed(1);
          if ($('vault-storage-used')) $('vault-storage-used').textContent = `${kb} KB / 5 MB`;
          if ($('vault-total-records')) $('vault-total-records').textContent = `${totalTrades} Trade Tercatat`;
        } catch (e) {}

        const wrap = $('accounts-list-wrap');
        if (!wrap) return;

        wrap.innerHTML = accounts.map(a => `
          <div class="account-item">
            <div>
              <div class="account-item-title">${esc(a.name)}</div>
              <div class="account-item-sub">${esc(a.broker)} · ${esc(a.currency)} · Saldo Awal: ${a.currency === 'IDR' ? fmtIDR(a.startBalance) : fmtUSD(a.startBalance)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="account-item-bal">${a.currency === 'IDR' ? fmtIDR(a.startBalance) : fmtUSD(a.startBalance)}</span>
              ${accounts.length > 1 ? `<button class="btn btn-danger btn-sm" onclick="deleteAccount('${safeId(a.id)}')">✕</button>` : ''}
            </div>
          </div>
        `).join('');

        // Update nav bar name
        const navName = $('nav-trader-name');
        const navBroker = $('nav-account-label');
        if (navName) navName.textContent = profile.name || 'Trader';
        if (navBroker && curAcc) navBroker.textContent = `${curAcc.broker} (${curAcc.name})`;
      }

      window.openProfileModal = function () {
        switchTab('profil');
      };

      window.saveProfileSettings = function () {
        profile.name = ($('p-trader-name').value || 'Trader').trim();
        const kurs = Number($('p-kurs-input').value);
        if (!Number.isFinite(kurs) || kurs <= 0) { alert('Masukkan kurs positif yang valid.'); return; }
        settings.kurs = kurs;
        $('exchange-status').textContent = 'Kurs manual: Rp ' + kurs.toLocaleString('id-ID') + ' per USD.';
        saveData();
        renderJournalTable();
        renderStatistics();
        runAllCalculators();
        renderProfileView();
        alert('Profil dan setelan kurs berhasil diperbarui.');
      };

      window.openNewAccountModal = function () {
        $('account-modal').classList.add('open');
        $('acc-name').value = '';
        $('acc-broker').value = 'EXNESS';
        $('acc-balance').value = '1000';
      };

      window.closeAccountModal = function () {
        $('account-modal').classList.remove('open');
      };

      window.saveAccountRecord = function () {
        const name = ($('acc-name').value || '').trim();
        const broker = ($('acc-broker').value || 'EXNESS').trim();
        const cur = $('acc-currency').value;
        const bal = parseFloat($('acc-balance').value) || 1000;

        if (!name) {
          alert('Mohon isi nama akun.');
          return;
        }

        const newAcc = {
          id: 'acc_' + Date.now(),
          name: name,
          broker: broker,
          currency: cur,
          startBalance: bal,
          status: 'Active'
        };

        accounts.push(newAcc);
        profile.currentAccount = newAcc.id;
        saveData();
        closeAccountModal();
        renderProfileView();
        alert('Akun broker baru berhasil ditambahkan!');
      };

      window.deleteAccount = function (accId) {
        if (confirm('Hapus akun ini? Trade yang terhubung akan tetap tersimpan di histori.')) {
          accounts = accounts.filter(a => a.id !== accId);
          if (profile.currentAccount === accId) {
            profile.currentAccount = accounts[0] ? accounts[0].id : '';
          }
          saveData();
          renderProfileView();
        }
      };

      /* ====================================================================
         BACKUP, RESTORE & EXPORT
         ==================================================================== */
      window.exportBackupJSON = function () {
        const payload = {
          app: 'journalingtrade',
          version: '2.0',
          exportedAt: new Date().toISOString(),
          accounts: accounts,
          trades: trades,
          settings: settings,
          profile: profile
        };
        downloadFile(`journalingtrade_backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
      };

      window.triggerRestore = function () {
        $('file-restore-input').click();
      };

      window.handleRestoreFile = function (input) {
        const f = input.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            if (f.size > 10 * 1024 * 1024) throw new Error('Backup too large');
            const data = JSON.parse(e.target.result);
            if (!data || !Array.isArray(data.accounts) || !data.accounts.every(a => a && typeof a === 'object' && !Array.isArray(a)) || !Array.isArray(data.trades) || !data.trades.every(t => t && typeof t === 'object' && !Array.isArray(t))) {
              throw new Error("Invalid structure");
            }
            if (confirm(`Pulihkan ${data.accounts.length} akun & ${data.trades.length} trade? Data lokal akan diperbarui.`)) {
              accounts = data.accounts;
              trades = data.trades;
              if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) settings = { kurs: Number(data.settings.kurs) || 17000, billingAnnual: !!data.settings.billingAnnual, exchangeUpdatedAt: Number(data.settings.exchangeUpdatedAt) || null };
              if (data.profile && typeof data.profile === 'object' && !Array.isArray(data.profile)) profile = { name: String(data.profile.name || 'Trader').slice(0, 80), currentAccount: safeId(data.profile.currentAccount) };
              saveData();
              renderJournalTable();
              renderProfileView();
              alert('Data berhasil dipulihkan!');
            }
          } catch (err) {
            alert('Format berkas backup tidak valid.');
          }
        };
        reader.readAsText(f);
      };

      window.exportCSV = function () {
        if (!trades.length) {
          alert('Belum ada data untuk diekspor.');
          return;
        }
        const headers = ['Tanggal', 'Jam', 'Market', 'Posisi', 'Entry', 'SL', 'TP', 'Volume', 'RiskPct', 'Hasil', 'NetPL_USD', 'Strategi', 'Alasan'];
        const rows = trades.map(t => {
          const m = computeTradeMetrics(t);
          return [
            t.date, t.jam, t.market, t.posisi, t.entry, t.sl, t.tp, t.vol, t.riskPct, t.result, m.pnlUSD.toFixed(2),
            t.strategy || '',
            t.reason || ''
          ].map(csvCell).join(',');
        });
        downloadFile('jurnal_trading.csv', [headers.join(','), ...rows].join('\n'), 'text/csv');
      };

      function downloadFile(name, content, type) {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      function csvCell(value) {
        const safe = String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
        return `"${/^[\s]*[=+@\-]/.test(safe) ? "'" : ''}${safe}"`;
      }

      window.resetAllData = function () {
        if (confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA akun dan catatan jurnal trade?')) {
          [K_ACCOUNTS, K_TRADES, K_SETTINGS, K_PROFILE, 'jt_kalender_cache'].forEach(key => localStorage.removeItem(key));
          loadData();
          renderJournalTable();
          renderProfileView();
          alert('Seluruh data berhasil direset ke pengaturan awal.');
        }
      };

      /* ====================================================================
         TRADINGVIEW IN-DOMAIN POP-UP CHART ROUTER
         ==================================================================== */
      let currentTvSymbol = 'XAUUSD';
      let currentTvInterval = '60';

      const TV_META = {
        'XAUUSD': { target: 'OANDA:XAUUSD', label: 'XAUUSD', desc: 'Gold Spot / US Dollar · OANDA' },
        'GOLD': { target: 'OANDA:XAUUSD', label: 'XAUUSD', desc: 'Gold Spot / US Dollar · OANDA' },
        'EURUSD': { target: 'FX:EURUSD', label: 'EURUSD', desc: 'Euro / US Dollar · FX' },
        'GBPUSD': { target: 'FX:GBPUSD', label: 'GBPUSD', desc: 'British Pound / US Dollar · FX' },
        'USDJPY': { target: 'FX:USDJPY', label: 'USDJPY', desc: 'US Dollar / Japanese Yen · FX' },
        'AUDUSD': { target: 'FX:AUDUSD', label: 'AUDUSD', desc: 'Australian Dollar / US Dollar · FX' },
        'USDCAD': { target: 'FX:USDCAD', label: 'USDCAD', desc: 'US Dollar / Canadian Dollar · FX' },
        'USDCHF': { target: 'FX:USDCHF', label: 'USDCHF', desc: 'US Dollar / Swiss Franc · FX' },
        'NZDUSD': { target: 'FX:NZDUSD', label: 'NZDUSD', desc: 'New Zealand Dollar / US Dollar · FX' },
        'BTC': { target: 'BINANCE:BTCUSDT', label: 'BTC', desc: 'Bitcoin / TetherUS · Binance' },
        'BTCUSD': { target: 'BINANCE:BTCUSDT', label: 'BTC', desc: 'Bitcoin / TetherUS · Binance' },
        'BTCUSDT': { target: 'BINANCE:BTCUSDT', label: 'BTC', desc: 'Bitcoin / TetherUS · Binance' },
        'ETH': { target: 'BINANCE:ETHUSDT', label: 'ETH', desc: 'Ethereum / TetherUS · Binance' },
        'ETHUSD': { target: 'BINANCE:ETHUSDT', label: 'ETH', desc: 'Ethereum / TetherUS · Binance' },
        'ETHUSDT': { target: 'BINANCE:ETHUSDT', label: 'ETH', desc: 'Ethereum / TetherUS · Binance' },
        'US30': { target: 'CAPITALCOM:US30', label: 'US30', desc: 'Dow Jones Industrial Average CFD' },
        'DJI': { target: 'TVC:DJI', label: 'DJI', desc: 'Dow Jones Industrial Average Index' },
        'NVDA': { target: 'NASDAQ:NVDA', label: 'NVDA', desc: 'NVIDIA Corporation · NASDAQ' },
        'DXY': { target: 'TVC:DXY', label: 'DXY', desc: 'US Dollar Currency Index · TVC' },
        'OIL': { target: 'TVC:USOIL', label: 'OIL/WTI', desc: 'WTI Crude Oil Spot · TVC' },
        'USOIL': { target: 'TVC:USOIL', label: 'OIL/WTI', desc: 'WTI Crude Oil Spot · TVC' },
        'OIL/WTI': { target: 'TVC:USOIL', label: 'OIL/WTI', desc: 'WTI Crude Oil Spot · TVC' }
      };

      window.openTradingView = function (sym, interval) {
        if (!sym) sym = 'XAUUSD';
        const clean = sym.toUpperCase().replace(/[^A-Z0-9]/g, '');
        currentTvSymbol = clean;
        if (interval) currentTvInterval = interval;

        const info = TV_META[clean] || TV_META[sym] || {
          target: sym.includes(':') ? sym : ('FX:' + clean),
          label: sym,
          desc: sym + ' Live Chart'
        };

        const modal = $('tv-modal');
        if (modal) modal.classList.add('open');

        // Update header information
        const pill = $('tv-symbol-pill');
        if (pill) pill.textContent = info.label;
        const desc = $('tv-symbol-desc');
        if (desc) desc.textContent = info.desc;

        // Update external link href if user wants to detach
        const ext = $('tv-external-link');
        if (ext) ext.href = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(info.target)}`;

        // Highlight active quick market button in popup
        document.querySelectorAll('.tv-qm-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.sym === clean || btn.dataset.sym === info.label);
        });

        // Highlight active timeframe button in popup
        document.querySelectorAll('.tv-tf-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.interval === currentTvInterval);
        });

        // Load interactive chart iframe directly inside the pop-up modal
        const box = $('tv-iframe-box');
        if (box) {
          box.innerHTML = `<iframe src="https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(info.target)}&interval=${encodeURIComponent(currentTvInterval)}&theme=dark&style=1&timezone=Asia%2FJakarta&locale=id" allowtransparency="true" scrolling="no" frameborder="0"></iframe>`;
        }
      };

      window.changeTvInterval = function (interval) {
        currentTvInterval = interval;
        openTradingView(currentTvSymbol, interval);
      };

      window.closeTradingView = function () {
        const modal = $('tv-modal');
        if (modal) modal.classList.remove('open');
        const box = $('tv-iframe-box');
        if (box) box.innerHTML = '';
      };

      window.handleTvModalBackdrop = function (e) {
        if (e.target && e.target.id === 'tv-modal') {
          closeTradingView();
        }
      };

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const tvModal = $('tv-modal');
          if (tvModal && tvModal.classList.contains('open')) {
            closeTradingView();
          }
        }
      });

      /* ====================================================================
         PRO CONTENT ACCESS TOGGLE (COT REPORT)
         ==================================================================== */
      let isCotUnlocked = true; // Unlocked by default as requested: "buka bentar untuk saya"

      window.toggleCotAccess = function () {
        isCotUnlocked = !isCotUnlocked;
        renderCotState();
      };

      function renderCotState() {
        const fullContent = $('cot-full-content');
        const lockedPreview = $('cot-locked-preview');
        const pill = $('cot-status-pill');
        const toggleIcon = $('cot-toggle-icon');
        const toggleText = $('cot-toggle-text');
        const banner = $('cot-banner');

        if (isCotUnlocked) {
          if (fullContent) fullContent.style.display = 'block';
          if (lockedPreview) lockedPreview.style.display = 'none';
          if (pill) {
            pill.textContent = 'AKSES TERBUKA';
            pill.style.background = 'rgba(34, 197, 94, 0.15)';
            pill.style.color = 'var(--green)';
            pill.style.borderColor = 'rgba(34, 197, 94, 0.3)';
          }
          if (toggleIcon) toggleIcon.textContent = '🔒';
          if (toggleText) toggleText.textContent = 'Kunci Kembali Konten';
          if (banner) {
            banner.innerHTML = `
              <div>
                <b style="color:#ffffff; font-size:12.5px;">Status: Pratinjau Terbuka (Akses Khusus Anda)</b>
                <p style="color:var(--text-muted); font-size:11.5px;">Laporan COT dan peta likuiditas sedang ditampilkan penuh. Anda dapat mengunci kembali tampilan ini sewaktu-waktu.</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" onclick="toggleCotAccess()" style="font-size:11.5px;">Kunci Kembali Konten 🔒</button>
            `;
          }
        } else {
          if (fullContent) fullContent.style.display = 'none';
          if (lockedPreview) lockedPreview.style.display = 'block';
          if (pill) {
            pill.textContent = 'KONTEN PREMIUM';
            pill.style.background = 'rgba(168, 85, 247, 0.15)';
            pill.style.color = '#c084fc';
            pill.style.borderColor = 'rgba(168, 85, 247, 0.3)';
          }
          if (toggleIcon) toggleIcon.textContent = '🔓';
          if (toggleText) toggleText.textContent = 'Buka Akses (Preview)';
          if (banner) {
            banner.innerHTML = `
              <div>
                <b>Buka Akses Analisa Smart Money & Peta Likuiditas</b>
                <p>Dapatkan wawasan posisi bandar institusi, sinyal data COT, dan kalender high-impact terkurasi.</p>
              </div>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="toggleCotAccess()" style="font-size:11px;">Buka Akses 🔓</button>
                <button type="button" class="btn btn-accent btn-sm" onclick="switchTab('beranda'); scrollToPricing();">Upgrade ke Pro</button>
              </div>
            `;
          }
        }
      }

      /* ====================================================================
         CODEFRONTS LIVE STOCK / CRYPTO PRICE TICKER ENGINE
         Spec: https://codefronts.com/motion/css-infinite-marquee/live-stock-crypto-price-ticker/
         ==================================================================== */
      const marqueeState = {
        'XAUUSD': 3342.80,
        'EURUSD': 1.0892,
        'GBPUSD': 1.2750,
        'BTC': 94450,
        'ETH': 3540,
        'US30': 43890,
        'NVDA': 138.25,
        'DXY': 104.15,
        'OIL': 78.40
      };

      function renderMarqueeQuote(sym, price, deltaPct) {
        // CRITICAL: update the quote in BOTH groups so the loop seam never shows stale numbers
        document.querySelectorAll('.mqs-05__quote[data-sym="' + sym + '"]').forEach(q => {
          const pxEl = q.querySelector('[data-px]');
          const dlEl = q.querySelector('[data-dl]');
          if (pxEl) {
            pxEl.textContent = price >= 1000
              ? Math.round(price).toLocaleString('en-US')
              : (price < 10 ? price.toFixed(4) : price.toFixed(2));
          }
          if (dlEl) {
            dlEl.textContent = (deltaPct >= 0 ? '+' : '\u2212') + Math.abs(deltaPct).toFixed(2) + '%';
          }
          q.dataset.dir = deltaPct >= 0 ? 'up' : 'down';
        });
      }

      function randomWalkMarquee() {
        for (const sym in marqueeState) {
          // Gentle drift ±0.4%
          const deltaPct = (Math.random() - 0.49) * 0.8;
          marqueeState[sym] = Math.max(0.001, marqueeState[sym] * (1 + deltaPct / 100));
          renderMarqueeQuote(sym, marqueeState[sym], deltaPct);
        }
      }

      function initMarqueeTicker() {
        document.querySelectorAll('.mqs-05__group:not([aria-hidden]) .mqs-05__quote').forEach(q => {
          const sym = q.dataset.sym;
          const pxEl = q.querySelector('[data-px]');
          if (sym && pxEl) {
            const val = parseFloat(pxEl.textContent.replace(/,/g, ''));
            if (!isNaN(val) && val > 0) marqueeState[sym] = val;
          }
        });

        // Event delegation: clicking any quote directly navigates to TradingView
        const viewport = document.querySelector('.mqs-05__viewport');
        if (viewport && !viewport._tvBound) {
          viewport._tvBound = true;
          viewport.addEventListener('click', (e) => {
            const quote = e.target.closest('.mqs-05__quote');
            if (quote) {
              const sym = quote.dataset.sym;
              if (sym) {
                e.preventDefault();
                window.openTradingView(sym);
              }
            }
          });
        }

        randomWalkMarquee();
        setInterval(randomWalkMarquee, 2000);
      }

      /* ====================================================================
         ECONOMIC CALENDAR ENGINE & DATASET (WIB GMT+7)
         Matches Reference System Schema, Filters & Impact Calculations
         ==================================================================== */
      function getFormattedDate(offsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${da}`;
      }

      function buildDefaultCalendarEvents() {
        const dMinus1 = getFormattedDate(-1);
        const dToday = getFormattedDate(0);
        const dPlus1 = getFormattedDate(1);
        const dPlus2 = getFormattedDate(2);
        const dPlus3 = getFormattedDate(3);

        return [
          // Yesterday (Jadwal Lampau)
          { tgl: dMinus1, jam: '19:30', neg: 'USD', nama: 'Building Permits', dmp: 2, akt: '1.45M', prk: '1.40M', sbl: '1.39M', cat: 'Sektor perumahan menunjukkan tanda-tanda stabilisasi, menyokong yield obligasi AS.' },
          { tgl: dMinus1, jam: '21:30', neg: 'USD', nama: 'EIA Natural Gas Storage', dmp: 1, akt: '+48B', prk: '+52B', sbl: '+65B', cat: 'Penambahan cadangan gas di bawah proyeksi, volatilitas minim.' },

          // Today (Hari Ini)
          { tgl: dToday, jam: '09:30', neg: 'AUD', nama: 'Employment Change', dmp: 3, akt: '+38.5K', prk: '+25.0K', sbl: '+18.2K', cat: 'Pasar tenaga kerja Australia solid, mengurangi peluang pemangkasan suku bunga RBA dalam waktu dekat.' },
          { tgl: dToday, jam: '14:00', neg: 'GBP', nama: 'Retail Sales (MoM)', dmp: 2, akt: '+0.5%', prk: '+0.2%', sbl: '-0.3%', cat: 'Penjualan ritel Inggris meningkat di atas estimasi, GBPUSD terangkat dari support.' },
          { tgl: dToday, jam: '16:00', neg: 'EUR', nama: 'Eurozone Flash Manufacturing PMI', dmp: 2, akt: '47.8', prk: '47.0', sbl: '45.8', cat: 'Aktivitas manufaktur zona euro mulai membaik meski masih berada di zona kontraksi (<50).' },
          { tgl: dToday, jam: '19:30', neg: 'USD', nama: 'Core CPI (MoM)', dmp: 3, akt: '0.3%', prk: '0.3%', sbl: '0.3%', cat: 'Indeks harga konsumen inti stabil. Volatilitas tinggi diperkirakan terjadi pada instrumen XAUUSD dan DXY.' },
          { tgl: dToday, jam: '19:30', neg: 'USD', nama: 'Initial Jobless Claims', dmp: 3, akt: '215K', prk: '218K', sbl: '212K', cat: 'Klaim pengangguran mingguan AS tetap rendah, menandakan resiliensi sektor tenaga kerja.' },
          { tgl: dToday, jam: '21:00', neg: 'USD', nama: 'Existing Home Sales', dmp: 2, akt: '4.10M', prk: '3.98M', sbl: '3.96M', cat: 'Penjualan rumah bekas pulih tipis namun dibatasi tingginya suku bunga hipotek.' },
          { tgl: dToday, jam: '22:30', neg: 'USD', nama: 'Crude Oil Inventories', dmp: 1, akt: '-2.4M', prk: '-1.1M', sbl: '+1.8M', cat: 'Penarikan cadangan minyak mentah komersial menopang rebound harga minyak mentah WTI.' },

          // Tomorrow
          { tgl: dPlus1, jam: '08:30', neg: 'JPY', nama: 'Tokyo Core CPI (YoY)', dmp: 2, akt: null, prk: '2.4%', sbl: '2.2%', cat: 'Indikator leading inflasi Jepang. Angka di atas 2.5% memperkuat ekspektasi kenaikan suku bunga BOJ.' },
          { tgl: dPlus1, jam: '13:00', neg: 'EUR', nama: 'German Ifo Business Climate', dmp: 2, akt: null, prk: '88.2', sbl: '87.0', cat: 'Survei iklim bisnis ekonomi terbesar Eropa, berdampak moderat terhadap mata uang EUR.' },
          { tgl: dPlus1, jam: '19:30', neg: 'USD', nama: 'Core PCE Price Index (MoM)', dmp: 3, akt: null, prk: '0.2%', sbl: '0.2%', cat: 'Ukuran inflasi favorit Federal Reserve. Deviasi 0.1% dapat menggerakkan arah kebijakan suku bunga The Fed.' },
          { tgl: dPlus1, jam: '19:30', neg: 'CAD', nama: 'GDP (MoM)', dmp: 3, akt: null, prk: '0.3%', sbl: '0.1%', cat: 'Data pertumbuhan ekonomi Kanada, katalis utama pergerakan pasangan mata uang USDCAD.' },
          { tgl: dPlus1, jam: '21:00', neg: 'USD', nama: 'Revised UoM Consumer Sentiment', dmp: 2, akt: null, prk: '69.5', sbl: '67.9', cat: 'Keyakinan konsumen AS terhadap prospek ekonomi dan ekspektasi inflasi jangka panjang.' },

          // Day +2
          { tgl: dPlus2, jam: '07:00', neg: 'CNY', nama: 'Manufacturing PMI', dmp: 3, akt: null, prk: '50.2', sbl: '49.8', cat: 'Indikator kunci aktivitas manufaktur Tiongkok, mempengaruhi permintaan komoditas dan mata uang AUD.' },
          { tgl: dPlus2, jam: '14:00', neg: 'EUR', nama: 'CPI Flash Estimate (YoY)', dmp: 3, akt: null, prk: '2.5%', sbl: '2.6%', cat: 'Estimasi awal inflasi tahunan zona euro. Menentukan langkah suku bunga ECB berikutnya.' },

          // Day +3
          { tgl: dPlus3, jam: '19:30', neg: 'USD', nama: 'Non-Farm Employment Change (NFP)', dmp: 3, akt: null, prk: '180K', sbl: '206K', cat: 'Super high impact rilis ketenagakerjaan AS awal bulan. Waspadai pelebaran spread likuiditas pasar.' },
          { tgl: dPlus3, jam: '19:30', neg: 'USD', nama: 'Unemployment Rate', dmp: 3, akt: null, prk: '4.1%', sbl: '4.1%', cat: 'Tingkat pengangguran AS di atas 4.2% akan memicu kekhawatiran resesi Sahm Rule.' },
          { tgl: dPlus3, jam: '21:00', neg: 'USD', nama: 'ISM Manufacturing PMI', dmp: 3, akt: null, prk: '49.1', sbl: '48.5', cat: 'Kesehatan sektor manufaktur AS, sub-indeks Prices Paid menjadi fokus utama pelaku pasar.' }
        ];
      }

      let kalCache = null;
      let kalCari = '';
      let kalDmp = [];
      let kalTh = '', kalBl = '', kalTg = '';
      let kalLihatLalu = false;
      let kalPollingTimer = null;
      let kalCountdownTimer = null;

      function kalPad(n) { return String(n).length < 2 ? '0' + n : String(n); }
      function kalHariIni() {
        const d = new Date();
        return d.getFullYear() + '-' + kalPad(d.getMonth() + 1) + '-' + kalPad(d.getDate());
      }
      function getActiveCalendarDate(items) {
        const sysHari = kalHariIni();
        const allDates = [...new Set((items || []).map(x => x && x.tgl).filter(Boolean))].sort();
        if (!allDates.length) return sysHari;
        if (allDates.includes(sysHari)) return sysHari;
        const future = allDates.find(t => t >= sysHari);
        if (future) return future;
        return allDates[allDates.length - 1];
      }
      function kalTglID(t) {
        const p = String(t || '').split('-');
        if (p.length !== 3) return t || '';
        const d = new Date(+p[0], +p[1] - 1, +p[2]);
        if (isNaN(d)) return t || '';
        return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
      function kalAngka(v) {
        if (v === null || v === undefined) return null;
        let t = String(v).trim().replace(/\s|%/g, '');
        if (!t) return null;
        if (t.indexOf(',') >= 0 && t.indexOf('.') < 0) t = t.replace(',', '.');
        else t = t.replace(/,/g, '');
        const m = t.match(/^(-?\d+(?:\.\d+)?)([KkMmBb])?$/);
        if (!m) return null;
        let n = parseFloat(m[1]);
        if (isNaN(n)) return null;
        const p = (m[2] || '').toLowerCase();
        if (p === 'k') n *= 1e3; else if (p === 'm') n *= 1e6; else if (p === 'b') n *= 1e9;
        return n;
      }
      function kalDmpBar(d) {
        const n = Math.max(1, Math.min(3, +d || 1));
        return '<span class="kal-dmp d' + n + '"><i></i><i></i><i></i></span>';
      }
      function kalUrut(a) {
        return (a || []).slice().sort((x, y) =>
          x.tgl === y.tgl ? String(x.jam || '').localeCompare(String(y.jam || ''))
            : String(x.tgl || '').localeCompare(String(y.tgl || '')));
      }
      function kalDmpNorm(v) { return Math.max(1, Math.min(3, +v || 1)); }

      function kalSaring(a) {
        const hari = getActiveCalendarDate(a);
        let isi = (a || []).filter(x => x && x.tgl);
        if (!kalLihatLalu && !kalTh && !kalBl && !kalTg) isi = isi.filter(x => x.tgl >= hari);
        if (kalTh) isi = isi.filter(x => String(x.tgl).slice(0, 4) === kalTh);
        if (kalBl) isi = isi.filter(x => String(x.tgl).slice(5, 7) === kalBl);
        if (kalTg) isi = isi.filter(x => String(x.tgl).slice(8, 10) === kalTg);
        if (kalDmp.length) isi = isi.filter(x => kalDmp.indexOf(kalDmpNorm(x.dmp)) >= 0);
        const q = kalCari.trim().toLowerCase();
        if (q) {
          isi = isi.filter(x => ((x.nama || '') + ' ' + (x.neg || '') + ' ' + (x.cat || '')).toLowerCase().indexOf(q) >= 0);
        }
        return kalUrut(isi);
      }

      function kalAdaSaringan() {
        return !!(kalCari.trim() || kalDmp.length || kalTh || kalBl || kalTg);
      }

      const KAL_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

      function renderKalTgl(items) {
        if (!$('kal-th')) return;
        const semua = (items || []).filter(x => x && x.tgl);
        const th = [], bl = [], tg = [];
        semua.forEach(x => {
          const t = String(x.tgl);
          const a = t.slice(0, 4), b = t.slice(5, 7), c = t.slice(8, 10);
          if (th.indexOf(a) < 0) th.push(a);
          if ((!kalTh || a === kalTh) && bl.indexOf(b) < 0) bl.push(b);
          if ((!kalTh || a === kalTh) && (!kalBl || b === kalBl) && tg.indexOf(c) < 0) tg.push(c);
        });
        th.sort(); bl.sort(); tg.sort();
        const isi = (el, daftar, nilai, semuaLbl, label) => {
          if (!el) return;
          el.innerHTML = '<option value="">' + semuaLbl + '</option>' +
            daftar.map(v => '<option value="' + v + '"' + (v === nilai ? ' selected' : '') + '>' +
              (label ? label(v) : v) + '</option>').join('');
        };
        isi($('kal-th'), th, kalTh, 'Semua tahun');
        isi($('kal-bl'), bl, kalBl, 'Semua bulan', v => KAL_BULAN[parseInt(v, 10) - 1] || v);
        isi($('kal-tg'), tg, kalTg, 'Semua tgl', v => String(parseInt(v, 10)));
      }

      function renderKalChipDmp() {
        document.querySelectorAll('#kal-dmp-chips [data-dmp]').forEach(b => {
          const v = +b.dataset.dmp;
          b.classList.toggle('on', v === 0 ? kalDmp.length === 0 : kalDmp.indexOf(v) >= 0);
        });
      }

      function kalKelompok(isi) {
        const urut = [], peta = {};
        isi.forEach(x => { if (!peta[x.tgl]) { peta[x.tgl] = []; urut.push(x.tgl); } peta[x.tgl].push(x); });
        return urut.map(t => ({ tgl: t, isi: peta[t] }));
      }

      function kalBand(tgl, hari) {
        return '<div class="kal-band">' + kalTglID(tgl) +
          (tgl === hari ? '<span class="kini">Hari Ini</span>' : '') + '</div>';
      }

      function kalBaris(x) {
        const akt = kalAngka(x.akt), prk = kalAngka(x.prk);
        let cls = '';
        if (akt !== null && prk !== null) cls = akt > prk ? ' naik' : (akt < prk ? ' turun' : '');
        const adaAngka = !!(x.akt || x.prk || x.sbl);
        return '<div class="kal-baris' + ((+x.dmp || 1) >= 3 ? ' tinggi' : '') + '">' +
          '<span class="kal-jam">' + esc(x.jam || '--:--') + '</span>' +
          '<span class="kal-neg">' + esc(x.neg || '') + '</span>' +
          kalDmpBar(x.dmp) +
          '<div><div class="kal-nama">' + esc(x.nama || '') + '</div>' +
          (adaAngka ? '<div class="kal-ang">Akt <b class="' + cls.trim() + '">' + esc(x.akt || '-') +
            '</b> &middot; Perk ' + esc(x.prk || '-') + ' &middot; Sblm ' + esc(x.sbl || '-') + '</div>' : '') +
          (x.cat ? '<div class="kal-cat">💡 ' + esc(x.cat) + '</div>' : '') +
          '</div></div>';
      }

      function kalKosong() {
        if (kalAdaSaringan()) {
          return '<div class="feed-empty">Tidak ada rilis yang cocok dengan saringan ini.<br>' +
            '<button class="btn btn-secondary btn-sm" style="margin-top:11px;" ' +
            'onclick="window.__kalReset()">Bersihkan Saringan</button></div>';
        }
        return '<div class="feed-empty">Belum ada jadwal kalender.<br>Cek lagi nanti.</div>';
      }

      function gambarKalender(items) {
        const semua = items || [];
        renderKalTgl(semua);
        renderKalChipDmp();
        const isi = kalSaring(semua);
        const info = $('cari-kal-info');
        if (info) {
          if (kalAdaSaringan()) {
            info.hidden = false;
            info.textContent = isi.length
              ? isi.length + ' rilis ditemukan dari ' + semua.length + ' jadwal'
              : 'Tidak ada yang cocok';
          } else { info.hidden = true; info.textContent = ''; }
        }
        const hari = getActiveCalendarDate(semua);
        let bilah = '';
        if (!kalLihatLalu && !kalTh && !kalBl && !kalTg) {
          const lalu = semua.filter(x => x && x.tgl && x.tgl < hari).length;
          if (lalu) {
            bilah = '<div class="kal-lalu"><span>' + lalu + ' jadwal lampau</span>' +
              '<button class="btn btn-secondary btn-sm" type="button" onclick="window.__kalLalu(true)">' +
              'Tampilkan</button></div>';
          }
        } else if (kalLihatLalu && !kalTh && !kalBl && !kalTg) {
          bilah = '<div class="kal-lalu"><span>Jadwal lampau ikut tampil</span>' +
            '<button class="btn btn-secondary btn-sm" type="button" onclick="window.__kalLalu(false)">' +
            'Sembunyikan</button></div>';
        }
        if (!isi.length) {
          if ($('kal-list')) $('kal-list').innerHTML = kalKosong() + bilah;
          return;
        }
        if ($('kal-list')) {
          $('kal-list').innerHTML = '<div class="kal-tbl">' +
            kalKelompok(isi).map(g =>
              kalBand(g.tgl, hari) + g.isi.map(kalBaris).join('')).join('') +
            '</div>' + bilah;
        }
      }

      function gambarKalUlang() {
        if (!$('kal-list')) return;
        gambarKalender((kalCache && kalCache.items) || []);
      }

      /* Quick Overview Calendar & Real-time Countdown */
      function renderTodayOverviewCalendar(items) {
        const container = $('cal-today-quick-list');
        if (!container) return;

        const semua = items || [];
        const hari = getActiveCalendarDate(semua);

        let todayItems = semua.filter(x => x && x.tgl === hari);
        if (!todayItems.length) {
          const futureDates = [...new Set(semua.map(x => x.tgl).filter(t => t >= hari))].sort();
          if (futureDates.length) {
            todayItems = semua.filter(x => x.tgl === futureDates[0]);
          } else {
            todayItems = semua.slice(-5);
          }
        }

        todayItems = kalUrut(todayItems);

        if (!todayItems.length) {
          container.innerHTML = '<div style="padding:15px; color:var(--text-muted); font-size:12.5px; text-align:center;">Tidak ada rilis data terjadwal untuk hari ini.</div>';
          return;
        }

        container.innerHTML = todayItems.map(x => {
          const dmp = Math.max(1, Math.min(3, +x.dmp || 1));
          const dmpCls = dmp === 3 ? 'high' : (dmp === 2 ? 'med' : 'low');
          const dmpLbl = dmp === 3 ? 'Tinggi' : (dmp === 2 ? 'Sedang' : 'Rendah');
          const metaParts = [];
          if (x.akt) metaParts.push('Akt: ' + x.akt);
          if (x.prk) metaParts.push('Fcst: ' + x.prk);
          if (x.sbl) metaParts.push('Prev: ' + x.sbl);
          const metaStr = metaParts.length ? metaParts.join(' | ') : 'Menunggu konsensus rilis';

          return `
            <div class="cal-row" onclick="switchBeritaSub('kalender')" style="cursor:pointer;" title="Klik untuk membuka kalender lengkap">
              <span class="cal-time">${esc(x.jam || '--:--')}</span>
              <span class="cal-cur">${esc(x.neg || '')}</span>
              <div class="cal-event-box">
                <span class="cal-event-name">${esc(x.nama || '')}</span>
                <span class="cal-meta">${esc(metaStr)}</span>
              </div>
              <span class="cal-impact ${dmpCls}">${dmpLbl}</span>
            </div>
          `;
        }).join('');
      }

      function updateNextEventCountdown() {
        const titleEl = $('cal-next-event-title');
        const timerEl = $('cal-next-event-timer');
        if (!titleEl || !timerEl) return;

        const items = (kalCache && kalCache.items) || [];
        if (!items.length) {
          titleEl.textContent = 'Memuat Jadwal Kalender...';
          timerEl.textContent = 'Sinkronisasi otomatis';
          return;
        }

        const now = new Date();
        const hari = getActiveCalendarDate(items);

        const highImpact = items
          .filter(x => x && x.tgl && x.jam && (+x.dmp >= 3))
          .map(x => {
            const pTgl = String(x.tgl).split('-').map(Number);
            const pJam = String(x.jam).split(':').map(Number);
            const evtDate = new Date(pTgl[0], pTgl[1] - 1, pTgl[2], pJam[0] || 0, pJam[1] || 0, 0);
            return { ...x, evtDate };
          })
          .sort((a, b) => a.evtDate - b.evtDate);

        let nextEvt = highImpact.find(x => x.evtDate.getTime() + 30 * 60 * 1000 > now.getTime());
        if (!nextEvt && highImpact.length) {
          nextEvt = highImpact[highImpact.length - 1];
        }

        if (!nextEvt) {
          titleEl.textContent = 'Tidak Ada Rilis Berdampak Tinggi Terjadwal';
          timerEl.textContent = 'Semua rilis periode ini telah selesai';
          return;
        }

        titleEl.textContent = `${nextEvt.neg} · ${nextEvt.nama}`;

        const diffMs = nextEvt.evtDate.getTime() - now.getTime();
        const timeFormatted = `${nextEvt.jam} WIB`;
        const isToday = nextEvt.tgl === hari;

        if (diffMs > 0) {
          const totalSec = Math.floor(diffMs / 1000);
          const hrs = Math.floor(totalSec / 3600);
          const mins = Math.floor((totalSec % 3600) / 60);
          const secs = totalSec % 60;
          const cdStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
          timerEl.textContent = `${timeFormatted} · Dimulai dalam ${cdStr}${isToday ? ' (Hari Ini)' : ' (' + kalTglID(nextEvt.tgl) + ')'}`;
        } else if (diffMs >= -30 * 60 * 1000) {
          timerEl.textContent = `${timeFormatted} · Rilis Sedang Berlangsung / Baru Rilis`;
        } else {
          timerEl.textContent = `${timeFormatted} · Telah Dirilis (Aktual: ${nextEvt.akt || 'Tersedia'})`;
        }
      }

      window.__kalReset = function () {
        kalCari = ''; kalDmp = []; kalTh = ''; kalBl = ''; kalTg = '';
        if ($('cari-kal')) { $('cari-kal').value = ''; $('cari-kal-box').classList.remove('isi'); }
        gambarKalUlang();
      };

      window.__kalLalu = function (show) {
        kalLihatLalu = !!show;
        gambarKalUlang();
      };

      window.reloadKalender = function () {
        fetchKalenderData(true);
      };

      async function fetchKalenderData(force) {
        const stampEl = $('kal-stamp');
        if (stampEl && force) {
          stampEl.textContent = 'Memperbarui otomatis...';
        }

        let items = null;
        let updatedStr = '';

        // 1. Fetch from local kalender.json
        try {
          const res = await fetch('kalender.json?t=' + Date.now());
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.items) && data.items.length) {
              items = data.items;
              updatedStr = data.updated || new Date().toISOString();
            }
          }
        } catch (e) {
          console.warn('Local kalender.json fetch error:', e);
        }

        // 2. Fallback to remote endpoint if needed
        if (!items) {
          try {
            const res = await fetch('https://tradewithfnc.com/kalender.json?t=' + Date.now(), { mode: 'cors' });
            if (res.ok) {
              const data = await res.json();
              if (data && Array.isArray(data.items) && data.items.length) {
                items = data.items;
                updatedStr = data.updated || new Date().toISOString();
              }
            }
          } catch (e) {
            console.warn('Remote kalender.json fallback error:', e);
          }
        }

        // 3. Fallback to cached localStorage
        if (!items) {
          try {
            const cached = localStorage.getItem('jt_kalender_cache');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && Array.isArray(parsed.items) && parsed.items.length) {
                items = parsed.items;
                updatedStr = parsed.updated;
              }
            }
          } catch (e) {}
        }

        // 4. Default fallback
        if (!items || !items.length) {
          items = buildDefaultCalendarEvents();
          updatedStr = new Date().toISOString();
        }

        // Save to cache
        try {
          localStorage.setItem('jt_kalender_cache', JSON.stringify({ items, updated: updatedStr }));
        } catch (e) {}

        const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

        kalCache = {
          items: items,
          updated: nowStr,
          rawUpdated: updatedStr
        };

        gambarKalender(kalCache.items);
        renderTodayOverviewCalendar(kalCache.items);
        updateNextEventCountdown();

        if ($('kal-stamp')) {
          $('kal-stamp').textContent = 'Otomatis diperbarui ' + nowStr + ' (Live)';
        }

        // Start real-time timers if not running
        if (!kalCountdownTimer) {
          kalCountdownTimer = setInterval(updateNextEventCountdown, 1000);
        }
        if (!kalPollingTimer) {
          kalPollingTimer = setInterval(() => {
            fetchKalenderData(false);
          }, 60000); // auto-poll every 60 seconds
        }
      }

      function renderEconomicCalendar(force) {
        if (!kalCache || force) {
          fetchKalenderData(force);
        } else {
          gambarKalender(kalCache.items);
          renderTodayOverviewCalendar(kalCache.items);
          updateNextEventCountdown();
        }
      }

      function initCalendarEventListeners() {
        if ($('kal-dmp-chips')) {
          $('kal-dmp-chips').onclick = e => {
            const b = e.target.closest('[data-dmp]'); if (!b) return;
            const v = +b.dataset.dmp;
            if (v === 0) { kalDmp = []; }
            else {
              const i = kalDmp.indexOf(v);
              if (i >= 0) kalDmp.splice(i, 1); else kalDmp.push(v);
            }
            gambarKalUlang();
          };
        }

        ['kal-th', 'kal-bl', 'kal-tg'].forEach(id => {
          const el = $(id);
          if (el) {
            el.onchange = () => {
              kalTh = $('kal-th').value;
              kalBl = $('kal-bl').value;
              kalTg = $('kal-tg').value;
              gambarKalUlang();
            };
          }
        });

        if ($('kal-tgl-clr')) {
          $('kal-tgl-clr').onclick = () => {
            kalTh = ''; kalBl = ''; kalTg = '';
            if ($('kal-th')) $('kal-th').value = '';
            if ($('kal-bl')) $('kal-bl').value = '';
            if ($('kal-tg')) $('kal-tg').value = '';
            gambarKalUlang();
          };
        }

        if ($('cari-kal')) {
          const kotak = $('cari-kal-box');
          let jeda = null;
          const jalan = () => {
            kalCari = ($('cari-kal').value || '').trim();
            if (kotak) kotak.classList.toggle('isi', !!kalCari);
            gambarKalUlang();
          };
          $('cari-kal').addEventListener('input', () => { clearTimeout(jeda); jeda = setTimeout(jalan, 180); });
          $('cari-kal').addEventListener('keydown', e => {
            if (e.key === 'Escape') { $('cari-kal').value = ''; jalan(); }
          });
          const hapus = kotak ? kotak.querySelector('.hapus') : null;
          if (hapus) hapus.onclick = () => { $('cari-kal').value = ''; jalan(); $('cari-kal').focus(); };
        }
      }

      /* ====================================================================
         MARKET ANALYSIS WORKSTATION (SMC, ORDER FLOW, PETA LIKUIDITAS)
         ==================================================================== */
      const DEFAULT_ANALYSIS_DATA = [
        {
          id: 'an-xauusd-1',
          title: 'XAUUSD Weekly Outlook: Mitigasi Institutional Demand $3,310 dan Target BSL $3,380',
          pair: 'XAUUSD',
          bias: 'Bullish',
          tag: 'SMC',
          date: 'Hari ini',
          thumb: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=700&auto=format&fit=crop&q=80',
          body: `*Peta Likuiditas & Analisa Struktur Pasar (SMC)*

1. *Struktur Tren*: XAUUSD mempertahankan formasi _Higher High_ dan _Higher Low_ pada timeframe H4 & Daily. Terjadi _Change of Character (CHoCH)_ bullish minor setelah area likuiditas jual ($3,315) berhasil disapu (_liquidity sweep_) pada sesi London kemarin.

2. *Zona Demand & Order Block*: Area mitigasi $3,310-$3,322 merupakan _Bullish Order Block (OB)_ institusional yang berhimpitan dengan _Fair Value Gap (FVG)_ H4 yang belum terisi penuh.

3. *Target Likuiditas*: Target utama pergerakan naik tertuju pada _Buyside Liquidity (BSL)_ di level $3,365 dan retest resistensi psikologis $3,380.

4. *Batasan Risiko (Invalidation)*: Skenario bullish batal jika candle H4 ditutup solid di bawah level swing low $3,294.`
        },
        {
          id: 'an-eurusd-2',
          title: 'EURUSD: Potensi Reversal Bearish Menjelang Pernyataan Pejabat ECB',
          pair: 'EURUSD',
          bias: 'Bearish',
          tag: 'Liquidity Sweep',
          date: 'Hari ini 14:15 WIB',
          thumb: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=700&auto=format&fit=crop&q=80',
          body: `*Tinjauan Order Flow EURUSD*

Pasangan EURUSD mengalami kegagalan menembus batas atas konsolidasi mingguan di 1.0930. Terlihat pola _Turtle Soup_ / _Stop Hunt_ di atas level high sesi Asia.

* *Titik Masuk Ideal*: Retest area FVG M15 di kisaran 1.0895-1.0905.
* *Target Take Profit*: _Sellside Liquidity (SSL)_ pada level 1.0840.
* *Batas Stop Loss*: Di atas rejection wick tertinggi di 1.0935.`
        },
        {
          id: 'an-gbpusd-3',
          title: 'GBPUSD: Akumulasi Posisi Menjelang Rilis Data Inflasi Inggris',
          pair: 'GBPUSD',
          bias: 'Bullish',
          tag: 'Order Flow',
          date: 'Hari ini 11:30 WIB',
          thumb: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=700&auto=format&fit=crop&q=80',
          body: `*Peta Pasar Cable (GBPUSD)*

GBPUSD bertahan kuat di atas zona equilibrium mingguan 1.2720. Indikator volume institusional mencatat penyerapan volume jual yang agresif pada pembukaan sesi Frankfurt.

* *Katalis*: Ekspektasi data inflasi jasa yang tetap tinggi mendorong suku bunga Bank of England bertahan lebih lama.
* *Setup*: Buy on pullback di zona 1.2730 dengan invalidation di bawah 1.2690. Target ekspansi ke 1.2820.`
        },
        {
          id: 'an-btc-4',
          title: 'Bitcoin (BTCUSD): Konsolidasi Rentang Tinggi Menuju Level Psikologis $98,000',
          pair: 'BTCUSD',
          bias: 'Bullish',
          tag: 'Makro',
          date: 'Kemarin',
          thumb: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=700&auto=format&fit=crop&q=80',
          body: `*Analisa On-Chain & Order Book Imbalance*

Arus dana masuk ETF spot terus mencatatkan net positive. Kluster likuidasi short terkonsentrasi di area $96,500-$97,200 yang menjadi magnet harga berikutnya.

* *Area Demand Kunci*: $92,800-$93,500 (Zona akumulasi CME).
* *Invalidation Level*: Penutupan harian di bawah $89,500.`
        },
        {
          id: 'an-us30-5',
          title: 'Wall Street (US30): Distribusi Premium di Dekat Level Rekor Tertinggi',
          pair: 'US30',
          bias: 'Neutral',
          tag: 'SMC',
          date: 'Kemarin',
          thumb: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=700&auto=format&fit=crop&q=80',
          body: `*Peta Volatilitas Indeks Saham Dow Jones*

Indeks US30 bergerak sideways di range 43,700-44,050. Pelaku pasar bersikap wait-and-see menjelang pembacaan angka Core PCE dan rilis laba sektor perbankan AS.

Disarankan menunggu konfirmasi break salah satu batas range sebelum mengambil posisi swing.`
        }
      ];

      let anCari = '';
      let anTag = '';
      let anOpenedId = null;

      function waFormat(s) {
        if (!s) return '';
        let t = esc(s)
          .replace(/\*([^*]+)\*/g, '<b>$1</b>')
          .replace(/_([^_]+)_/g, '<i>$1</i>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>');
        return '<p>' + t + '</p>';
      }

      const AN_CHIPS = ['Semua', 'XAUUSD', 'EURUSD', 'GBPUSD', 'BTCUSD', 'US30', 'Bullish', 'Bearish', 'SMC', 'Makro'];

      function renderSaringChips() {
        const c = $('saring-an');
        if (!c) return;
        c.innerHTML = AN_CHIPS.map(val => {
          const isAll = val === 'Semua';
          const active = isAll ? !anTag : anTag === val;
          return `<button class="chip ${active ? 'on' : ''}" type="button" onclick="filterAnalysisTag('${isAll ? '' : val}')">${val}</button>`;
        }).join('');
      }

      window.filterAnalysisTag = function (tag) {
        anTag = tag;
        renderSaringChips();
        renderMarketAnalysisView();
      };

      window.toggleUtamaAnalisa = function (id) {
        anOpenedId = anOpenedId === id ? null : id;
        renderMarketAnalysisView();
      };

      window.toggleFeedItem = function (id) {
        const itemEl = $('fi-' + id);
        if (itemEl) {
          itemEl.classList.toggle('buka');
        }
      };

      window.reloadAnalisa = function () {
        renderMarketAnalysis(true);
      };

      function renderMarketAnalysisView() {
        const q = anCari.toLowerCase().trim();
        const tag = anTag.toLowerCase();

        const filtered = DEFAULT_ANALYSIS_DATA.filter(it => {
          const matchQ = !q || (it.title + ' ' + it.pair + ' ' + it.body + ' ' + it.tag).toLowerCase().includes(q);
          const matchTag = !tag || it.pair.toLowerCase() === tag || (it.bias && it.bias.toLowerCase() === tag) || (it.tag && it.tag.toLowerCase().includes(tag));
          return matchQ && matchTag;
        });

        const info = $('cari-an-info');
        if (info) {
          if (q || tag) {
            info.hidden = false;
            info.textContent = `${filtered.length} analisa ditemukan${q ? ` untuk "${q}"` : ''}${tag ? ` [Kategori: ${anTag}]` : ''}`;
          } else {
            info.hidden = true;
            info.textContent = '';
          }
        }

        const utamaEl = $('utama-analisa');
        const listEl = $('analisa-list');

        if (!filtered.length) {
          if (utamaEl) utamaEl.innerHTML = '';
          if (listEl) listEl.innerHTML = '<div class="feed-empty">Tidak ada analisa yang cocok dengan pencarian Anda.</div>';
          return;
        }

        // Top item as featured when not searching
        const featuredItem = (!q && !tag) ? filtered[0] : null;
        const listItems = featuredItem ? filtered.slice(1) : filtered;

        if (utamaEl) {
          if (featuredItem) {
            const isOpened = anOpenedId === featuredItem.id;
            utamaEl.innerHTML = `
              <div class="utama ${isOpened ? 'buka' : ''}" onclick="toggleUtamaAnalisa('${featuredItem.id}')">
                <div class="utama-gbr">
                  <img src="${featuredItem.thumb}" alt="${featuredItem.title}" loading="lazy">
                  <span class="utama-pita">SOROTAN UTAMA · ${featuredItem.pair}</span>
                </div>
                <div class="utama-isi">
                  <h3>${featuredItem.title}</h3>
                  <p>XAUUSD terus mempertahankan struktur bullish di atas level demand institusional $3,310. Simak rincian order block, target buyside liquidity (BSL), dan skenario invalidation...</p>
                  <div class="utama-kaki">
                    <span class="utama-baca">${isOpened ? 'Tutup Analisa' : 'Baca Analisa Lengkap'}</span>
                    <span class="feed-date">${featuredItem.date} · Sesi New York</span>
                  </div>
                  <div class="utama-full">
                    <div class="feed-body">${waFormat(featuredItem.body)}</div>
                    <button type="button" class="ext-btn" onclick="event.stopPropagation(); openTradingView('${featuredItem.pair}')">
                      ⤢ Buka Chart TradingView ${featuredItem.pair}
                    </button>
                  </div>
                </div>
              </div>
            `;
          } else {
            utamaEl.innerHTML = '';
          }
        }

        if (listEl) {
          listEl.innerHTML = listItems.map((it, idx) => {
            const isBuka = anOpenedId === it.id || (idx === 0 && !featuredItem);
            const biasCls = (it.bias || '').toLowerCase().includes('bull') ? 'bull' : ((it.bias || '').toLowerCase().includes('bear') ? 'bear' : 'neu');
            return `
              <div class="feed-item ${isBuka ? 'buka' : ''}" id="fi-${it.id}">
                <div class="fi-head" onclick="toggleFeedItem('${it.id}')">
                  <div class="fi-thumb">
                    ${it.thumb ? `<img src="${it.thumb}" alt="${it.title}" loading="lazy">` : `<div class="ph">📊</div>`}
                  </div>
                  <div class="fi-info">
                    <h4>${it.title}</h4>
                    <div class="fi-meta">
                      <span class="feed-tag">${it.pair}</span>
                      ${it.bias ? `<span class="feed-tag ${biasCls}">${it.bias}</span>` : ''}
                      ${it.tag ? `<span class="feed-tag neu">${it.tag}</span>` : ''}
                      <span class="feed-date">${it.date}</span>
                    </div>
                  </div>
                  <span class="fi-chev">▼</span>
                </div>
                <div class="fi-isi">
                  <div class="feed-pad">
                    <div class="feed-body">${waFormat(it.body)}</div>
                    <button type="button" class="ext-btn" onclick="event.stopPropagation(); openTradingView('${it.pair}')">
                      ⤢ Buka Chart TradingView ${it.pair}
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      function renderMarketAnalysis(force) {
        renderSaringChips();
        renderMarketAnalysisView();
        if ($('an-stamp')) {
          const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
          $('an-stamp').textContent = 'Diperbarui hari ini ' + nowStr;
        }
      }

      function initAnalysisEventListeners() {
        if ($('cari-an')) {
          const kotak = $('cari-an-box');
          let jeda = null;
          const jalan = () => {
            anCari = ($('cari-an').value || '').trim();
            if (kotak) kotak.classList.toggle('isi', !!anCari);
            renderMarketAnalysisView();
          };
          $('cari-an').addEventListener('input', () => { clearTimeout(jeda); jeda = setTimeout(jalan, 180); });
          $('cari-an').addEventListener('keydown', e => {
            if (e.key === 'Escape') { $('cari-an').value = ''; jalan(); }
          });
          const hapus = kotak ? kotak.querySelector('.hapus') : null;
          if (hapus) hapus.onclick = () => { $('cari-an').value = ''; jalan(); $('cari-an').focus(); };
        }
      }

      /* Sub-view Switcher */
      window.switchBeritaSub = function (sub) {
        document.querySelectorAll('#berita-seg .seg-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.sub === sub);
        });
        const rEl = $('sub-berita-ringkasan');
        const aEl = $('sub-berita-analisa');
        const kEl = $('sub-berita-kalender');

        if (rEl) rEl.hidden = sub !== 'ringkasan';
        if (aEl) aEl.hidden = sub !== 'analisa';
        if (kEl) kEl.hidden = sub !== 'kalender';

        if (sub === 'analisa') {
          renderMarketAnalysis();
        } else if (sub === 'kalender') {
          renderEconomicCalendar();
        }
      };

      /* Initial Startup */
      loadData();
      updateAccess();
      renderJournalTable();
      renderProfileView();
      runAllCalculators();
      updatePricingDisplay();
      initUploadDropZone();
      initMarqueeTicker();
      initCalendarEventListeners();
      initAnalysisEventListeners();
      renderEconomicCalendar();
      renderMarketAnalysis();
      applyLanguage();
      renderStatistics();
      refreshExchangeRate();
      setInterval(() => { if (!document.hidden) refreshExchangeRate(); }, 3600000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - exchangeCheckedAt >= 3600000) refreshExchangeRate(); });
      window.addEventListener('storage', event => {
        if ([K_ACCOUNTS, K_TRADES, K_SETTINGS, K_PROFILE].includes(event.key) || event.key === null) {
          loadData(); renderJournalTable(); renderStatistics(); renderProfileView(); runAllCalculators();
        }
      });

    })();
