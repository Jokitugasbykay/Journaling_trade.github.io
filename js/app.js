(function () {
      "use strict";

      /* Storage Keys */
      let K_ACCOUNTS = 'fncjt_accounts';
      let K_TRADES = 'fncjt_trades';
      let K_SETTINGS = 'fncjt_settings';
      let K_PROFILE = 'fncjt_profil';
      const SUPABASE_URL = 'https://nmddjuqkdyhcobddinkc.supabase.co';
      const SUPABASE_KEY = 'sb_publishable_8MdtL4bDt-4dn2gh5-M8hg_TjDEGATj';

      let journalOwner = '', scanStorageKey = 'fncjt_scans';

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
      const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'journalingtrade_nmddjuqkdyhcobddinkc_auth', flowType: 'pkce' } });
      let cloudUser = null, cloudReady = false, cloudBusy = false, cloudTimer = null, localRevision = 0;
      let accountAccess = null, nicknameReady = false, hydratingUserId = '', authMode = 'signin';
      const cloudAccountIds = new Map(), cloudStrategyIds = new Map(), localAccountIds = new Map();
      let cloudSnapshot = '';
      const originalCopy = new Map();
      try {
        const saved = JSON.parse(localStorage.getItem('fncjt_onboarding') || '{}');
        onboarding = { name: typeof saved.name === 'string' ? saved.name.slice(0, 80) : '', started: saved.started === true };
        language = localStorage.getItem('fncjt_language') === 'en' ? 'en' : 'id';
      } catch {}

      /* Safe Element Selector */
      const $ = id => document.getElementById(id);
      const esc = value => String(value ?? '').replace(/(?:[#*0-9]\uFE0F?\u20E3)|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D]/gu, '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const safeId = value => /^[\w-]{1,80}$/.test(String(value || '')) ? String(value) : '';

      const stateCopy = {
        accessReady: 'Jurnal siap digunakan. Pilih tab yang ingin Anda buka.',
        localProfile: 'Profil lokal', localProfileStatus: 'Data tersimpan di perangkat ini.',
        changeProfile: 'Ganti profil lokal', cloudConnected: 'Akun server', cloudStatus: 'Jurnal otomatis disimpan ke server.',
        cloudManage: 'Kelola akun cloud', cloudSignOut: 'Keluar dari akun cloud'
      };
      const englishCopy = {
        home: 'Home', journal: 'Journal', statistics: 'Statistics', calculator: 'Calculator', news: 'Economic news',
        signIn: 'Sign in', welcome: 'Welcome', guestStatus: 'Explore the journal on the Home tab.',
        loginMenu: 'Sign in', profileSettings: 'Profile settings', openJournal: 'Open trading journal',
        language: 'Language', signOut: 'Sign out of this profile', try: 'Try', cloudManage: 'Manage cloud account', cloudSignOut: 'Sign out of cloud account',
        heroTitle: 'Discipline in Every Execution.<br>Clarity in Every Trade.',
        heroLead: 'Transform your trading journey with a disciplined journaling practice.',
        tryJournal: 'Start your free journal', interested: "I’m interested",
        accessHint: 'Click Try to unlock your journal.', accessReady: 'Your journal is ready. Choose a tab to get started.',
        localProfile: 'Local profile', localProfileStatus: 'Data stays on this device.', changeProfile: 'Change local profile',
        exampleTitle: 'Example journal note', market: 'Market', exampleMarket: 'Enter the instrument',
        entryReason: 'Entry reason', exampleReason: 'Why are you taking this trade?', riskLimit: 'Risk limit', exampleRisk: 'Set your risk before entering',
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
        tryFree: 'Try Free', plusDescription: 'Build a consistent journaling routine.', proDescription: 'Review your performance in greater detail.',
        plusSoon: 'Plus coming soon', proSoon: 'Pro coming soon', paidNote: 'Subscriptions are coming soon',
        featureDetails: 'Show all features', freeFeature1: 'Manual trade journaling', freeFeature2: 'Statistics and risk calculators',
        freeFeature3: 'PDF/PNG scans and CSV/TXT imports: 10 uploads every 12 hours', freeFeature4: 'Local backup and restore',
        priceDetails: 'Show pricing details', perMonth: 'USD / month', perYear: 'USD / year',
        plusSavings: 'Save $20 compared with 12 monthly payments. The discount rounds to 17%.',
        proSavings: 'Save $40 compared with 12 monthly payments. The discount rounds to 17%.',
        paidHint: 'Payments will be available once checkout launches.',
        localDataHint: 'When signed in, your journal saves automatically to the server. Without signing in, it stays in this browser on this device. Export a backup to keep a copy.',
        loginTitle: 'Sign in to your journal', loginDescription: 'Sign in with email to save your journal in the cloud and access it on other devices.',
        googleLogin: 'Sign in with Google', googleSoon: 'Google sign-in is not available yet.', localName: 'Local profile name',
        localLoginHint: 'Local profiles share the same browser data. They are not cloud accounts. On your first visit, click Try on Home to open the other tabs.',
        localLogin: 'Use local profile', tryWithoutAccount: 'Try without an account', cloudEmail: 'Email', cloudPassword: 'Password', cloudHint: 'New accounts may require email verification. Your journal saves automatically to the server after sign-in. Importing a guest journal requires your confirmation.', cloudSignIn: 'Sign in and sync', cloudSignUp: 'Create account', cloudConnected: 'Server account', cloudStatus: 'Your journal saves automatically to the server.',
        uploadLabel: 'Scan PDF/PNG · Import CSV/TXT', uploadTitle: 'Scan documents & import trades',
        uploadDescription: 'PDF/PNG/JPG scans recognize position history and chart setups. Review CSV/TXT records before importing them into the journal.',
        dropFile: 'Drop your file here', scanReviewHint: 'Trade history and chart setups are detected automatically. Check the detected values; missing information stays blank. No trades are added automatically.',
        scanText: 'Detected information', saveScan: 'Save scan result', savedScans: 'Saved scan results',
        scanCurrency: 'P/L currency · use your account currency', scanImportHint: 'Review the detected rows before importing. Missing SL/TP and risk stay blank. Chart setups are saved as analysis.',
        scanEmpty: 'No scans have been saved on this device.', uploadLimit: 'Max. 10 MB · Excel: export as CSV'
      };
      Object.assign(englishCopy, {
  "guideTitle": "Build better trading habits",
  "guideLead": "Understand the market, set your risk, and use your journal to see what needs improving.",
  "guideMarketTitle": "Know the market you trade",
  "guideMarketText": "Forex involves currency pairs such as EUR/USD. Check the spread, position size, and economic calendar before opening a trade.",
  "guideRiskTitle": "Set your risk before entering",
  "guideRiskText": "Record your entry, stop loss, and target. Use the Calculator to size your position around your risk limit.",
  "guideJournalTitle": "Record or import your trades",
  "guideJournalText": "Click Try, then open Journal. Enter trades manually or upload PDFs, images, and CSV files. Review scan results before importing; unreadable values stay blank.",
  "guideReviewTitle": "Find patterns in your results",
  "guideReviewText": "Open Statistics to review profit and loss, win rate, and drawdown. Compare your setups and entry reasons, then choose one habit to improve in your next session."
});
      Object.assign(englishCopy, {"newsPageTitle":"News & economic calendar","newsPageLead":"Headlines from your selected publishers, publication times, and the economic calendar.","newsHeadlines":"Latest news","newsCalendar":"Economic calendar","newsSourceLabel":"News source","newsAllSources":"All sources","newsRefresh":"Refresh news","newsOriginalLanguage":"Headlines remain in the publisher’s original language. Read the full story on the source website.","newsCmeHint":"View current interest-rate probabilities and market data directly on CME Group."});
      Object.assign(englishCopy, {"newsLatestStories": "Latest stories", "newsShowMore": "Show more stories", "newsFeedDetails": "Sources & update schedule", "newsSchedule": "News collection is scheduled every 5 minutes. This page checks for updates every 5 minutes; source timestamps show freshness."});
      Object.assign(englishCopy, {"categoryAll": "All", "categoryWorld": "World", "categoryPolitics": "Politics", "categoryBusiness": "Business", "categoryMarkets": "Markets", "categorySustainability": "Sustainability", "categoryLegal": "Legal", "categoryCommentary": "Commentary", "categoryTechnology": "Technology", "categoryInvestigations": "Investigations", "categoryMore": "More", "categoryLocal": "Local news", "categoryScience": "Science", "categorySport": "Sport", "categoryOther": "Other news", "biSource": "Bank Indonesia transaction rates", "biBasis": "Journal conversion uses the midpoint of BI USD sell and buy rates. BI publishes rates once per business day."});
      Object.assign(englishCopy, {
        signupTitle: 'Create your journalingtrade account', signupLead: 'Start with Free and track your trading journey.',
        authEmailDivider: 'or use email', confirmPassword: 'Confirm password',
        authShowSignup: 'New here? Create an account', authShowSignin: 'Already have an account? Sign in',
        nicknameTitle: 'What should we call you?', nicknameLead: 'Choose a nickname for your journal profile.',
        authSwitchAccount: 'Use another account', nicknameLabel: 'Nickname', nicknameSave: 'Save and open journal', authBack: 'Back to Home',
        plusFeature1: 'All Free features', plusFeature2: 'Unlimited uploads', plusFeature3: 'Economic news and calendar access',
        newsLockedTitle: 'Economic news for Plus members', newsLockedLead: 'Unlock local and global news and the economic calendar with Plus.',
        newsViewPlans: 'View plans', newsSignIn: 'Already subscribed? Sign in'
      });
      document.querySelectorAll('[data-i18n]').forEach(element => {
        originalCopy.set(element.dataset.i18n, element.innerHTML);
      });
      Object.assign(englishCopy, {
        calendarLead: 'Macroeconomic, employment, inflation and interest-rate releases. Table times are in WIB.',
        calendarImpact: 'Impact'
      });
      Object.assign(englishCopy, {newsSearchLabel:'Search news', newsSearchClear:'Clear'});
      const translatedText = new WeakMap();
      const legacyCopy = {
        'Cari judul atau sumber berita...': 'Search headlines or publishers...',
        'Hapus pencarian berita': 'Clear news search',
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
        'Semua Ringkasan': 'All summaries', 'Analisa Market': 'Market analysis', 'Kalender Ekonomi': 'Economic calendar',
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
      Object.assign(legacyCopy, {
  "Rapor Disiplin & Psikologi": "Discipline & psychology report",
  "Kelengkapan Stop Loss (SL)": "Recorded stop losses (SL)",
  "Rata-rata Risiko Tercatat": "Average recorded risk",
  "Drawdown Maksimum": "Maximum drawdown",
  "Belum ada trade": "No trades yet",
  "Belum ada data": "No data yet",
  "Belum ada data risiko": "No risk data yet",
  "Saldo awal dan transaksi diperlukan": "Add a starting balance and trades",
  "Tambahkan transaksi untuk melihat rapor akun ini.": "Add trades to view this account’s report.",
  "Dihitung dari jurnal akun aktif. SL tercatat tidak memastikan pemasangan di broker; kondisi psikologi belum dicatat.": "Based on the active account’s journal. A recorded stop loss does not confirm a broker order. Psychological data has not been recorded.",
  "Nama Panggilan / Alias Trader": "Trader name",
  "Kurs Dolar ke Rupiah (USD to IDR)": "Exchange rate (USD to IDR)",
  "Simpan Profil & Kurs": "Save profile & exchange rate",
  "Perbarui kurs otomatis": "Refresh exchange rate",
  "Kurs referensi diperbarui harian.": "Reference rates are updated daily.",
  "Mengambil kurs terbaru...": "Fetching the latest exchange rate...",
  "Kunci Kembali Konten": "Lock content",
  "Buka Akses": "Unlock access",
  "Normal (Offline Ready)": "Available offline",
  "Tab Baru": "Open in new tab",
  "Edit": "Edit",
  "Hapus": "Delete",
  "Catatan Trade": "Trade notes",
  "Pilih Akun": "Select account",
  "Kinerja per Setup & Strategi": "Performance by setup & strategy",
  "Belum ada data eksekusi": "No execution data yet",
  "Profit Terbaik": "Best profit",
  "Kerugian Terburuk": "Largest loss",
  "KLIK MARKET UNTUK BUKA POP-UP CHART": "SELECT AN INSTRUMENT TO OPEN ITS CHART",
  "Semua Ringkasan": "All summaries",
  "Analisa Market": "Market analysis",
  "Kalender Ekonomi": "Economic calendar",
  "Dasar forex dan jurnal trading yang membantu Anda berkembang": "Forex fundamentals and journaling for better trading habits",
  "Cari pair (XAUUSD, EURUSD...), judul analisa, atau kata kunci...": "Search instruments, analysis titles, or keywords...",
  "Cari rilis data atau mata uang (Core CPI, NFP, USD, EUR, AUD...)": "Search releases or currencies (CPI, NFP, USD, EUR...)",
  "Nama Anda": "Your name",
  "Terapkan Setup Ini ke Form Jurnal": "Use this setup in the journal"
});
      const translatedAttributes = new WeakMap();
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
          let original = translatedText.get(node) || node.textContent;
          const previousEnglish = legacyCopy[original.trim()];
          if (node.textContent !== original && (!previousEnglish || node.textContent !== original.replace(original.trim(), previousEnglish))) original = node.textContent;
          const replacement = legacyCopy[original.trim()];
          if (replacement) {
            translatedText.set(node, original);
            node.textContent = language === 'en' ? original.replace(original.trim(), replacement) : original;
          }
        }
        document.querySelectorAll('[placeholder], [title], [aria-label]').forEach(element => {
          const originals = translatedAttributes.get(element) || {};
          for (const attr of ['placeholder', 'title', 'aria-label']) {
            if (!element.hasAttribute(attr)) continue;
            const original = originals[attr] ?? element.getAttribute(attr);
            if (legacyCopy[original]) { originals[attr] = original; element.setAttribute(attr, language === 'en' ? legacyCopy[original] : original); }
          }
          translatedAttributes.set(element, originals);
        });
        $('language-select').value = language;
        $('nickname-input').placeholder = language === 'en' ? 'Your nickname' : 'Nama panggilan Anda';
        if (window.renderPublisherNews) renderPublisherNews();
        if (window.renderBiIndicators) renderBiIndicators();
        if (kalCache) {
          gambarKalUlang(); renderTodayOverviewCalendar(kalCache.items); updateNextEventCountdown(); calendarStamp();
        }
        if (window.renderFedWatch) window.renderFedWatch();
        updatePricingDisplay();
      }
      window.setLanguage = function (value) {
        language = value === 'en' ? 'en' : 'id';
        try { localStorage.setItem('fncjt_language', language); } catch {}
        renderJournalTable();
        renderStatistics();
        renderProfileView();
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
        accounts = []; trades = []; settings = { kurs: 17000, billingAnnual: false }; profile = { name: 'Trader', currentAccount: 'local_acc' };
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
        localRevision++;
        try {
          localStorage.setItem(K_ACCOUNTS, JSON.stringify(accounts));
          localStorage.setItem(K_TRADES, JSON.stringify(trades));
          localStorage.setItem(K_SETTINGS, JSON.stringify(settings));
          localStorage.setItem(K_PROFILE, JSON.stringify(profile));
        } catch (e) {
          console.error("Storage save error:", e);
        }
        scheduleCloudSave();
        if (window.renderStatistics) renderStatistics();
      }

      function cloudMessage(error) {
        const messages = {
          'Invalid login credentials': 'Email atau kata sandi salah.',
          'Email not confirmed': 'Konfirmasi email Anda sebelum masuk.',
          'User already registered': 'Email ini sudah terdaftar. Silakan masuk.',
          'Password should be at least 6 characters': 'Kata sandi terlalu pendek.'
        };
        return messages[error?.message] || error?.message || 'Koneksi server gagal. Data lokal tetap tersimpan.';
      }

      function uuidFor(map, value) {
        if (!map.has(value)) map.set(value, crypto.randomUUID());
        persistCloudMaps();
        return map.get(value);
      }

      function persistCloudMaps() {
        if (!cloudUser) return;
        try { localStorage.setItem('fncjt_cloud_map_' + cloudUser.id, JSON.stringify({ accounts: [...cloudAccountIds], trades: [...cloudTradeIds], strategies: [...cloudStrategyIds], snapshot: cloudSnapshot })); } catch {}
      }

      function journalFingerprint() {
        const value = JSON.stringify({ accounts, trades, name: profile.name });
        let hash = 2166136261;
        for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
        return (hash >>> 0).toString(16);
      }

      async function syncCloud() {
        if (!cloudUser || !cloudReady || !nicknameReady || cloudBusy || !cloudClient) return;
        cloudBusy = true;
        const startRevision = localRevision;
        try {
          const userId = cloudUser.id;
          const snapshot = journalFingerprint();
          const accountsForCloud = accounts.map(a => {
            const id = uuidFor(cloudAccountIds, a.id);
            localAccountIds.set(id, a.id);
            return { id, user_id: userId, name: a.name || 'Trading account', broker: a.broker || null, account_type: a.type || null, initial_balance: Number(a.startBalance) || 0, currency: a.currency || 'USD', is_active: a.status !== 'Inactive' };
          });
          const strategies = [...new Set(trades.map(t => String(t.strategy || '').trim()).filter(Boolean))];
          const strategyRows = strategies.map(name => ({ id: uuidFor(cloudStrategyIds, name), user_id: userId, name }));
          const tradeRows = trades.map(t => ({
            id: uuidFor(cloudTradeIds, t.id), user_id: userId, account_id: cloudAccountIds.get(t.accountId),
            strategy_id: t.strategy ? cloudStrategyIds.get(String(t.strategy).trim()) : null,
            symbol: t.market || 'UNKNOWN', market: t.market || null,
            side: /^(sell|short)$/i.test(t.posisi || '') ? 'short' : 'long', status: 'closed',
            opened_at: tradeTimestamp(t.date, t.jam), entry_price: finiteOrNull(t.entry), exit_price: finiteOrNull(t.exit),
            stop_loss: finiteOrNull(t.sl), take_profit: finiteOrNull(t.tp), quantity: finiteOrNull(t.vol),
            pnl: finiteOrNull(t.actualPnl), risk_percent: finiteOrNull(t.riskPct), notes: [t.reason, t.tf ? `TF: ${t.tf}` : '', t.result ? `Result: ${t.result}` : ''].filter(Boolean).join(' · ') || null
          }));
          const liveAccounts = new Set(accounts.map(a => a.id));
          const removedTrades = [...cloudTradeIds].filter(([id]) => !trades.some(t => t.id === id)).map(([, id]) => id);
          const removedAccounts = [...cloudAccountIds].filter(([id]) => !liveAccounts.has(id)).map(([, id]) => id);
          const profileRow = { id: userId, display_name: profile.name || cloudUser.email, timezone: 'Asia/Jakarta' };
          let result = await cloudClient.from('trading_accounts').upsert(accountsForCloud, { onConflict: 'id' });
          if (result.error) throw result.error;
          if (cloudUser?.id !== userId || !cloudReady) return false;
          if (strategyRows.length) {
            result = await cloudClient.from('strategies').upsert(strategyRows, { onConflict: 'id' });
            if (result.error) throw result.error;
            if (cloudUser?.id !== userId || !cloudReady) return false;
          }
          if (tradeRows.length) {
            result = await cloudClient.from('trades').upsert(tradeRows, { onConflict: 'id' });
            if (result.error) throw result.error;
            if (cloudUser?.id !== userId || !cloudReady) return false;
          }
          if (removedTrades.length) {
            result = await cloudClient.from('trades').delete().eq('user_id', userId).in('id', removedTrades);
            if (result.error) throw result.error;
            if (cloudUser?.id !== userId || !cloudReady) return false;
          }
          if (removedAccounts.length) {
            result = await cloudClient.from('trading_accounts').update({ is_active: false }).eq('user_id', userId).in('id', removedAccounts);
            if (result.error) throw result.error;
            if (cloudUser?.id !== userId || !cloudReady) return false;
          }
          const profileResult = await cloudClient.from('profiles').upsert(profileRow, { onConflict: 'id' });
          if (profileResult.error) throw profileResult.error;
          if (cloudUser?.id !== userId || !cloudReady) return false;
          cloudSnapshot = snapshot;
          persistCloudMaps();
          if ($('cloud-status')) $('cloud-status').textContent = language === 'en' ? 'Journal saved to the server.' : 'Jurnal tersimpan ke server.';
        } catch (error) {
          console.error('Supabase sync error:', error);
          if ($('cloud-status')) $('cloud-status').textContent = cloudMessage(error);
          return false;
        } finally { cloudBusy = false; if (localRevision !== startRevision) scheduleCloudSave(); }
        return true;
      }

      const cloudTradeIds = new Map();
      function finiteOrNull(value) { if (value === null || value === undefined || value === '') return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
      function tradeTimestamp(date, time) {
        return /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? `${date}T${/^\d{2}:\d{2}$/.test(time || '') ? time : '00:00'}:00+07:00` : null;
      }
      function tradeDateJakarta(value) {
        if (!value) return '';
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
        return `${parts.year}-${parts.month}-${parts.day}`;
      }
      function scheduleCloudSave() {
        if (!cloudUser || !cloudReady || !nicknameReady) return;
        clearTimeout(cloudTimer);
        if ($('cloud-status')) $('cloud-status').textContent = language === 'en' ? 'Saving journal to the server...' : 'Menyimpan jurnal ke server...';
        cloudTimer = setTimeout(syncCloud, 700);
      }

      function migrateLegacyJournal() {
        // Old cloud journals shared guest keys; archive them before enabling account isolation.
        try {
          if (localStorage.getItem('fncjt_storage_v2') === '1') return;
          if (Object.keys(localStorage).some(key => key.startsWith('fncjt_cloud_map_'))) {
            const keys = [K_ACCOUNTS, K_TRADES, K_SETTINGS, K_PROFILE, scanStorageKey];
            const archive = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
            localStorage.setItem('fncjt_legacy_backup', JSON.stringify(archive));
            keys.forEach(key => localStorage.removeItem(key));
          }
          localStorage.setItem('fncjt_storage_v2', '1');
        } catch { throw new Error('Unable to isolate the previous journal. Export your browser data before continuing.'); }
      }

      function selectJournalOwner(userId = '') {
        // Separate cloud caches from the guest journal; never upload another user's cached rows.
        journalOwner = userId;
        const suffix = userId ? '_' + userId : '';
        K_ACCOUNTS = 'fncjt_accounts' + suffix; K_TRADES = 'fncjt_trades' + suffix;
        K_SETTINGS = 'fncjt_settings' + suffix; K_PROFILE = 'fncjt_profil' + suffix;
        scanStorageKey = 'fncjt_scans' + suffix;
        clearTimeout(cloudTimer); scanJob++; currentScan = null; parsedTradesToImport = []; currentEditingTradeId = null;
        cloudAccountIds.clear(); cloudStrategyIds.clear(); cloudTradeIds.clear(); localAccountIds.clear(); cloudSnapshot = '';
        closeUploadModal(); closeTradeForm();
        $('upload-preview-tbody').replaceChildren();
        $('scan-result').hidden = true;
        $('scan-text').value = ''; $('scan-recognition').replaceChildren(); $('saved-scans').replaceChildren();
        loadData();
        onboarding.name = profile.name;
        updateAccess(); renderJournalTable(); renderProfileView(); renderStatistics(); runAllCalculators();
      }

      function handleCloudSignedOut() {
        cloudUser = null; cloudReady = false; nicknameReady = false; accountAccess = null;
        selectJournalOwner();
      }

      async function hydrateCloud(user) {
        if (hydratingUserId === user.id) return;
        hydratingUserId = user.id;
        const guestJournal = !journalOwner && trades.length ? { accounts: structuredClone(accounts), trades: structuredClone(trades) } : null;
        cloudUser = user;
        cloudReady = false; nicknameReady = false; accountAccess = null;
        try {
          if (journalOwner !== user.id) selectJournalOwner(user.id);
          try {
            const saved = JSON.parse(localStorage.getItem('fncjt_cloud_map_' + user.id) || '{}');
            cloudAccountIds.clear(); cloudTradeIds.clear(); cloudStrategyIds.clear();
            for (const [a, b] of saved.accounts || []) cloudAccountIds.set(a, b);
            for (const [a, b] of saved.trades || []) cloudTradeIds.set(a, b);
            for (const [a, b] of saved.strategies || []) cloudStrategyIds.set(a, b);
            cloudSnapshot = saved.snapshot || '';
          } catch {}
          const [profileResult, accountResult, strategyResult, tradeResult] = await Promise.all([
            cloudClient.from('profiles').select('display_name,nickname_set').eq('id', user.id).maybeSingle(),
            cloudClient.from('trading_accounts').select('*').eq('user_id', user.id),
            cloudClient.from('strategies').select('*').eq('user_id', user.id),
            cloudClient.from('trades').select('*').eq('user_id', user.id)
          ]);
          if (cloudUser?.id !== user.id) return;
          for (const result of [profileResult, accountResult, strategyResult, tradeResult]) if (result.error) throw result.error;
          const remoteAccounts = accountResult.data || [], remoteTrades = tradeResult.data || [];
          if (!remoteAccounts.length && !remoteTrades.length && !trades.length && guestJournal && confirm(language === 'en' ? 'Import the local guest journal into this account?' : 'Impor jurnal lokal tamu ke akun ini?')) { accounts = guestJournal.accounts; trades = guestJournal.trades; saveLocalData(); }
          if (remoteAccounts.length || remoteTrades.length) {
            const hasLocalJournal = trades.length > 0 || accounts.some(a => a.id !== 'local_acc');
            const localChangedSinceSync = cloudSnapshot ? cloudSnapshot !== journalFingerprint() : hasLocalJournal;
            if (localChangedSinceSync && hasLocalJournal) {
              if (!confirm(language === 'en' ? 'This account already has server data. Replace local data on this device with server data?' : 'Akun ini sudah memiliki data server. Ganti data lokal di perangkat ini dengan data server?')) {
                cloudUser = null; cloudReady = false;
                await cloudClient.auth.signOut();
                return;
              }
            }
            cloudAccountIds.clear(); cloudStrategyIds.clear(); cloudTradeIds.clear(); localAccountIds.clear();
            accounts = remoteAccounts.map(a => { const id = 'cloud_' + a.id; cloudAccountIds.set(id, a.id); localAccountIds.set(a.id, id); return { id, name: a.name, broker: a.broker || '', type: a.account_type || 'Standard', currency: a.currency, startBalance: Number(a.initial_balance), status: a.is_active ? 'Active' : 'Inactive' }; });
            const strategies = new Map((strategyResult.data || []).map(s => { cloudStrategyIds.set(s.name, s.id); return [s.id, s.name]; }));
            trades = remoteTrades.map(t => { const id = 'cloud_' + t.id; cloudTradeIds.set(id, t.id); return { id, accountId: localAccountIds.get(t.account_id) || '', date: tradeDateJakarta(t.opened_at), jam: t.opened_at ? new Date(t.opened_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }) : '', market: t.market || t.symbol, posisi: t.side === 'short' ? 'Sell' : 'Buy', entry: Number(t.entry_price) || 0, exit: t.exit_price === null ? null : Number(t.exit_price), sl: t.stop_loss === null ? null : Number(t.stop_loss), tp: t.take_profit === null ? null : Number(t.take_profit), vol: t.quantity === null ? null : Number(t.quantity), riskPct: t.risk_percent === null ? null : Number(t.risk_percent), actualPnl: t.pnl === null ? null : Number(t.pnl), result: t.notes?.match(/Result: (Win|Loss|BE)/)?.[1] || 'Win', strategy: strategies.get(t.strategy_id) || '', tf: t.notes?.match(/TF: ([^·]+)/)?.[1]?.trim() || '', reason: t.notes?.split(' · ')[0] || '' }; });
            profile.name = profileResult.data?.display_name || '';
            profile.currentAccount = accounts[0]?.id || '';
            onboarding.name = profile.name; onboarding.started = true;
            persistOnboarding(); persistCloudMaps();
            saveLocalData();
          }
          nicknameReady = profileResult.data?.nickname_set === true && !!profileResult.data.display_name?.trim();
          profile.name = nicknameReady ? profileResult.data.display_name : '';
          onboarding.name = profile.name;
          onboarding.started = true;
          persistOnboarding();
          cloudReady = true;
          await refreshAccountAccess();
          updateAccess(); renderJournalTable(); renderStatistics(); renderProfileView(); runAllCalculators();
          scheduleCloudSave();
          if (!nicknameReady) { switchTab('login'); setAuthMode('nickname'); }
          else if ($('view-login').classList.contains('active')) switchTab('jurnal');
        } catch (error) {
          if (cloudUser?.id !== user.id) return;
          console.error('Supabase load error:', error);
          if ($('cloud-status')) $('cloud-status').textContent = cloudMessage(error);
          handleCloudSignedOut();
        } finally {
          if (hydratingUserId === user.id) hydratingUserId = '';
        }
      }

      function saveLocalData() {
        try {
          localStorage.setItem(K_ACCOUNTS, JSON.stringify(accounts));
          localStorage.setItem(K_TRADES, JSON.stringify(trades));
          localStorage.setItem(K_SETTINGS, JSON.stringify(settings));
          localStorage.setItem(K_PROFILE, JSON.stringify(profile));
        } catch (error) { console.error('Local save error:', error); }
      }

      async function initCloudAuth() {
        if (!cloudClient) { if ($('cloud-status')) $('cloud-status').textContent = 'Koneksi server tidak tersedia. Data lokal tetap tersimpan.'; return; }
        cloudClient.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session?.user && (!cloudReady || cloudUser?.id !== session.user.id)) setTimeout(() => hydrateCloud(session.user), 0);
          if (event === 'SIGNED_OUT') handleCloudSignedOut();
        });
        const { data, error } = await cloudClient.auth.getSession();
        if (error) { console.error('Supabase session error:', error); return; }
        if (data.session?.user) await hydrateCloud(data.session.user);
      }

      function canReadNews() { return !!cloudUser && cloudReady && nicknameReady && ['plus', 'pro'].includes(accountAccess?.plan); }
      async function refreshAccountAccess(consumeUpload = false) {
        if (!cloudUser) throw new Error(language === 'en' ? 'Sign in to use your Free upload allowance.' : 'Masuk untuk menggunakan jatah upload Free.');
        const userId = cloudUser.id;
        if (!nicknameReady && consumeUpload) throw new Error(language === 'en' ? 'Complete your nickname first.' : 'Isi nama panggilan Anda terlebih dahulu.');
        const { data, error } = await cloudClient.rpc('journal_access', { consume_upload: consumeUpload });
        if (cloudUser?.id !== userId) throw new Error(language === 'en' ? 'Account changed. Try again.' : 'Akun berubah. Coba lagi.');
        if (error) throw error;
        if (!data || !['free', 'plus', 'pro'].includes(data.plan) || typeof data.allowed !== 'boolean') throw new Error('Invalid account access response');
        accountAccess = data;
        renderAccountAccess();
        if (!data.allowed) throw new Error(uploadAllowanceText());
        return data;
      }
      function uploadAllowanceText() {
        if (!cloudUser) return language === 'en' ? 'Sign in for 10 Free uploads every 12 hours.' : 'Masuk untuk 10 upload Free setiap 12 jam.';
        if (!accountAccess) return language === 'en' ? 'Checking your upload allowance...' : 'Memeriksa jatah upload...';
        if (accountAccess.plan !== 'free') return (accountAccess.plan === 'pro' ? 'Pro' : 'Plus') + (language === 'en' ? ' · Unlimited uploads' : ' · Upload tanpa batas');
        const reset = accountAccess.resetAt ? new Date(accountAccess.resetAt).toLocaleString(language === 'en' ? 'en-GB' : 'id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '';
        return language === 'en' ? `Free · ${accountAccess.remaining}/10 uploads remaining${reset ? '. Resets ' + reset : ' every 12 hours'}.` : `Free · Sisa ${accountAccess.remaining}/10 upload${reset ? '. Reset ' + reset : ' setiap 12 jam'}.`;
      }
      function renderAccountAccess() {
        $('upload-quota-note').textContent = uploadAllowanceText();
        $('news-content').hidden = !canReadNews();
        $('news-paywall').hidden = canReadNews();
        if (canReadNews() && $('view-berita').classList.contains('active')) switchBeritaSub(location.pathname === pagePath('economic-news/calendar') ? 'kalender' : document.querySelector('#berita-seg .active').dataset.sub, false);
      }

      function disciplineMetrics(rows) {
        const risks = rows.map(t => t.riskPct).filter(v => Number.isFinite(v) && v > 0);
        return { total: rows.length, slPct: rows.length ? rows.filter(t => Number.isFinite(t.sl) && t.sl > 0).length / rows.length * 100 : 0,
          riskCount: risks.length, avgRisk: risks.length ? risks.reduce((sum, v) => sum + v, 0) / risks.length : null };
      }

      let exchangeBusy = false;
      let exchangeCheckedAt = 0;
      let biData = null;
      const biFxSource = 'https://www.bi.go.id/id/statistik/informasi-kurs/transaksi-bi/default.aspx';
      const biRateSource = 'https://www.bi.go.id/id/statistik/indikator/bi-rate.aspx';
      function biDate(value) {
        const date = new Date(value + 'T12:00:00+07:00');
        return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(date.getTime()) ? date.toLocaleDateString(language === 'en' ? 'en-GB' : 'id-ID', {timeZone:'Asia/Jakarta', day:'numeric', month:'short', year:'numeric'}) : null;
      }
      window.renderBiIndicators = function () {
        const host = $('bi-indicators');
        if (!host) return;
        if (!biData) { host.textContent = language === 'en' ? 'Loading Bank Indonesia data...' : 'Memuat data Bank Indonesia...'; return; }
        const fx = biData.fx, rate = biData.rate;
        const rupiah = value => 'Rp ' + value.toLocaleString('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2});
        const tile = (label, value, date, url, status) => '<a class="bi-indicator" href="' + url + '" target="_blank" rel="noopener noreferrer"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(date || (language === 'en' ? 'Unavailable' : 'Tidak tersedia')) + (status === 'stale' ? (language === 'en' ? ' · Saved data' : ' · Data tersimpan') : '') + '</small></a>';
        const validFx = fx && fx.source === biFxSource && fx.currency === 'USD' && fx.unit === 1 && Number.isFinite(fx.buy) && Number.isFinite(fx.sell) && fx.buy > 0 && fx.sell >= fx.buy && biDate(fx.date);
        const validRate = rate && rate.source === biRateSource && Number.isFinite(rate.percent) && rate.percent >= 0 && rate.percent <= 100 && biDate(rate.date);
        host.innerHTML = tile(language === 'en' ? 'BI USD sell rate' : 'Kurs jual USD BI', validFx ? rupiah(fx.sell) : (language === 'en' ? 'Unavailable' : 'Tidak tersedia'), validFx ? biDate(fx.date) : null, biFxSource, fx?.status) + tile(language === 'en' ? 'BI USD buy rate' : 'Kurs beli USD BI', validFx ? rupiah(fx.buy) : (language === 'en' ? 'Unavailable' : 'Tidak tersedia'), validFx ? biDate(fx.date) : null, biFxSource, fx?.status) + tile(language === 'en' ? 'BI midpoint · Journal' : 'Titik tengah BI · Jurnal', validFx ? rupiah((fx.sell + fx.buy) / 2) : (language === 'en' ? 'Unavailable' : 'Tidak tersedia'), validFx ? biDate(fx.date) : null, biFxSource, fx?.status) + tile('BI-Rate', validRate ? rate.percent.toLocaleString(language === 'en' ? 'en-GB' : 'id-ID', {maximumFractionDigits:2}) + '%' : (language === 'en' ? 'Unavailable' : 'Tidak tersedia'), validRate ? biDate(rate.date) : null, biRateSource, rate?.status);
      };
      window.refreshExchangeRate = async function () {
        if (exchangeBusy) return;
        exchangeBusy = true;
        const status = $('exchange-status');
        status.textContent = language === 'en' ? 'Fetching Bank Indonesia rates...' : 'Mengambil kurs Bank Indonesia...';
        try {
          const response = await fetch('bi.json?t=' + Date.now(), {cache:'no-store', signal:AbortSignal.timeout(15000)});
          if (!response.ok) throw new Error('BI request failed');
          const data = await response.json();
          if (data.version !== 1) throw new Error('Invalid BI snapshot');
          biData = data;
          renderBiIndicators();
          const fx = data.fx;
          if (!fx || fx.source !== biFxSource || fx.currency !== 'USD' || fx.unit !== 1 || !Number.isFinite(fx.buy) || !Number.isFinite(fx.sell) || fx.buy <= 0 || fx.sell < fx.buy || fx.sell > 10000000 || !biDate(fx.date)) throw new Error('Invalid BI USD rate');
          const mid = Math.round((fx.sell + fx.buy) * 50) / 100;
          settings.kurs = mid;
          settings.exchangeUpdatedAt = new Date(fx.date + 'T00:00:00+07:00').getTime() / 1000;
          exchangeCheckedAt = Date.now();
          saveData();
          $('p-kurs-input').value = mid;
          renderJournalTable(); renderStatistics(); runAllCalculators();
          status.textContent = (language === 'en' ? 'BI transaction midpoint: Rp ' : 'Titik tengah kurs transaksi BI: Rp ') + mid.toLocaleString('id-ID') + ' / USD. ' + biDate(fx.date) + (fx.status === 'stale' ? (language === 'en' ? ' · Saved BI data; source refresh failed.' : ' · Data BI tersimpan; sumber gagal diperbarui.') : '');
        } catch (error) {
          status.textContent = (language === 'en' ? 'BI rates are unavailable. Saved journal rate: Rp ' : 'Kurs BI belum tersedia. Kurs jurnal tersimpan: Rp ') + Number(settings.kurs).toLocaleString('id-ID') + ' / USD.';
          if (!biData) $('bi-indicators').innerHTML = '<a href="' + biFxSource + '" target="_blank" rel="noopener noreferrer">' + (language === 'en' ? 'BI data unavailable. Open the official source.' : 'Data BI belum tersedia. Buka sumber resmi.') + '</a>';
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
      const pageRoutes = { beranda: 'home', jurnal: 'journal', statistik: 'statistics', kalkulator: 'calculator', berita: 'economic-news', profil: 'profile', login: 'login' };
      const pagePath = route => new URL(route + '/', document.baseURI).pathname;
      window.switchTab = function (tabId, updateUrl = true) {
        if (!$('view-' + tabId)) return;
        if (tabId !== 'login' && cloudUser && cloudReady && !nicknameReady) { tabId = 'login'; showAuthMode('nickname'); }
        if (!['beranda', 'login', 'berita'].includes(tabId) && !onboarding.started) {
          $('home-access-hint').focus();
          return;
        }
        document.querySelectorAll('.nav-tab').forEach(b => {
          b.classList.toggle('active', b.dataset.tab === tabId);
        });
        document.querySelectorAll('.view-content').forEach(v => {
          v.classList.toggle('active', v.id === 'view-' + tabId);
        });
        document.body.classList.toggle('auth-page', tabId === 'login');

        if (tabId === 'statistik') {
          renderStatistics();
        } else if (tabId === 'jurnal') {
          renderJournalTable();
        } else if (tabId === 'profil') {
          renderProfileView();
        } else if (tabId === 'kalkulator') {
          runAllCalculators();
        } else if (tabId === 'berita') {
          switchBeritaSub('ringkasan', false);
          renderEconomicCalendar();
          reloadPublisherNews();
        }
        if (updateUrl && pageRoutes[tabId] && location.pathname !== pagePath(pageRoutes[tabId])) history.pushState(null, '', pagePath(pageRoutes[tabId]));
        applyLanguage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      function persistOnboarding() {
        try { localStorage.setItem('fncjt_onboarding', JSON.stringify(onboarding)); }
        catch { $('home-access-hint').textContent = language === 'en' ? 'Your session is active. Browser storage is unavailable.' : 'Sesi aktif. Penyimpanan browser tidak tersedia.'; }
      }

      function updateAccess() {
        document.querySelectorAll('.nav-tab, [data-workspace-action]').forEach(button => {
          const locked = !['beranda', 'berita'].includes(button.dataset.tab) && !onboarding.started;
          button.disabled = locked;
          button.setAttribute('aria-disabled', String(locked));
          button.title = locked ? (language === 'en' ? 'Click Try on Home to open this tab.' : 'Klik Coba di Beranda untuk membuka tab ini.') : '';
        });
        $('home-access-hint').dataset.i18n = onboarding.started ? 'accessReady' : 'accessHint';
        $('nav-login-label').dataset.i18n = cloudUser ? 'cloudConnected' : (onboarding.name ? 'localProfile' : 'signIn');
        $('nav-dd-username').textContent = onboarding.name || (language === 'en' ? 'Welcome' : 'Selamat datang');
        $('nav-dd-username').removeAttribute('data-i18n');
        $('nav-dd-status').dataset.i18n = cloudUser ? 'cloudStatus' : (onboarding.name ? 'localProfileStatus' : 'guestStatus');
        $('menu-login').dataset.i18n = cloudUser ? 'cloudManage' : (onboarding.name ? 'changeProfile' : 'loginMenu');
        $('menu-logout').hidden = !cloudUser && !onboarding.name;
        $('menu-logout').dataset.i18n = cloudUser ? 'cloudSignOut' : 'signOut';
        applyLanguage();
        renderAccountAccess();
        if (canReadNews()) reloadPublisherNews();
      }

      window.startTrial = function () {
        onboarding.started = true;
        updateAccess();
        persistOnboarding();
        closeNavAccountDropdown();
        switchTab('jurnal');
      };

      function showAuthMode(mode) {
        authMode = mode;
        const nickname = mode === 'nickname', signup = mode === 'signup';
        $('auth-signin-heading').hidden = signup || nickname;
        $('auth-signup-heading').hidden = !signup || nickname;
        $('auth-credentials').hidden = nickname;
        $('nickname-form').hidden = !nickname;
        for (const id of ['auth-confirm-field', 'auth-signup-submit', 'auth-show-signin']) $(id).hidden = !signup;
        for (const id of ['auth-signin-submit', 'auth-show-signup']) $(id).hidden = signup;
        $('cloud-password-confirm').disabled = !signup;
        $('cloud-password-confirm').required = signup;
        $('cloud-password').autocomplete = signup ? 'new-password' : 'current-password';
        $('cloud-status').textContent = '';
      }
      window.setAuthMode = function (mode) {
        if (!['signin', 'signup', 'nickname'].includes(mode)) return;
        if (mode === 'nickname' && !cloudUser) return;
        showAuthMode(mode);
        history.replaceState(null, '', pagePath('login') + (mode === 'signin' ? '' : '#' + mode));
      };
      window.submitCloudAuth = function (event) {
        event.preventDefault();
        return authMode === 'signup' ? signUpCloud() : signInCloud();
      };
      window.signInCloud = async function () {
        if (!cloudClient) { $('cloud-status').textContent = language === 'en' ? 'Account connection is unavailable.' : 'Koneksi akun belum tersedia.'; return; }
        const button = $('auth-signin-submit'); button.disabled = true;
        $('cloud-status').textContent = language === 'en' ? 'Signing in...' : 'Sedang masuk...';
        try {
          const { error } = await cloudClient.auth.signInWithPassword({ email: $('cloud-email').value.trim(), password: $('cloud-password').value });
          if (error) throw error;
          $('cloud-password').value = '';
        } catch (error) { $('cloud-status').textContent = cloudMessage(error); }
        finally { button.disabled = false; }
      };
      window.signUpCloud = async function () {
        if (!cloudClient) return;
        const password = $('cloud-password'), confirmation = $('cloud-password-confirm');
        confirmation.setCustomValidity(password.value === confirmation.value ? '' : (language === 'en' ? 'Passwords do not match.' : 'Kata sandi tidak sama.'));
        if (!$('cloud-login-form').reportValidity()) return;
        const button = $('auth-signup-submit'); button.disabled = true;
        $('cloud-status').textContent = language === 'en' ? 'Creating your account...' : 'Membuat akun...';
        try {
          const { data, error } = await cloudClient.auth.signUp({ email: $('cloud-email').value.trim(), password: password.value, options: { emailRedirectTo: new URL('login/', document.baseURI).href } });
          if (error) throw error;
          password.value = ''; confirmation.value = '';
          if (!data.session) $('cloud-status').textContent = language === 'en' ? 'Check your email to confirm your account, then sign in.' : 'Buka email untuk konfirmasi akun, lalu masuk.';
        } catch (error) { $('cloud-status').textContent = cloudMessage(error); }
        finally { button.disabled = false; }
      };
      $('cloud-password-confirm').addEventListener('input', event => event.target.setCustomValidity(''));
      window.signInGoogle = async function () {
        const status = $('google-login-status'), button = $('google-login-btn');
        if (!cloudClient) return;
        button.disabled = true;
        try {
          const response = await fetch(SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: SUPABASE_KEY }, signal: AbortSignal.timeout(10000) });
          if (!response.ok) throw new Error(language === 'en' ? 'Unable to check Google sign-in. Try again.' : 'Tidak dapat memeriksa login Google. Coba lagi.');
          const config = await response.json();
          if (!config.external?.google) throw new Error(language === 'en' ? 'Google sign-in is awaiting account setup. Please use email for now.' : 'Login Google sedang menunggu konfigurasi akun. Gunakan email untuk saat ini.');
          const { error } = await cloudClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL('login/', document.baseURI).href, queryParams: { prompt: 'select_account' } } });
          if (error) throw error;
        } catch (error) { status.textContent = error.message; }
        finally { button.disabled = false; }
      };
      window.saveNickname = async function (event) {
        event.preventDefault();
        if (!cloudUser) return;
        const userId = cloudUser.id;
        const input = $('nickname-input'), name = input.value.trim();
        input.setCustomValidity(name.length >= 2 ? '' : (language === 'en' ? 'Enter at least 2 characters.' : 'Isi sedikitnya 2 karakter.'));
        if (!input.reportValidity()) return;
        const button = $('nickname-form').querySelector('button'); button.disabled = true;
        try {
          const { error } = await cloudClient.from('profiles').upsert({ id: userId, display_name: name, nickname_set: true }, { onConflict: 'id' });
          if (error) throw error;
          if (cloudUser?.id !== userId || journalOwner !== userId) return;
          profile.name = name; onboarding.name = name; nicknameReady = true;
          persistOnboarding(); saveData(); updateAccess(); renderProfileView();
          switchTab('jurnal');
        } catch (error) { $('cloud-status').textContent = cloudMessage(error); }
        finally { button.disabled = false; }
      };
      $('nickname-input').addEventListener('input', event => event.target.setCustomValidity(''));
      window.signOutLocal = function () {
        if (cloudClient && cloudUser) {
          clearTimeout(cloudTimer);
          (async () => {
            while (cloudBusy) await new Promise(resolve => setTimeout(resolve, 50));
            if (nicknameReady && !await syncCloud()) return;
            const { error } = await cloudClient.auth.signOut();
            if (error) { $('cloud-status').textContent = cloudMessage(error); return; }
            handleCloudSignedOut();
            switchTab('beranda');
          })();
          return;
        }
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
        const modal = document.querySelector('.modal-overlay.open');
        if (event.key === 'Tab' && modal && modal.id === 'tv-modal') {
          const controls = [...modal.querySelectorAll('button, a[href], iframe')].filter(element => element.getClientRects().length);
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
        if (event.key === 'Tab' && modal && modal.id === 'upload-modal' && modal.classList.contains('open')) {
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

      /* Journal engine & table */
      window.toggleTradeForm = function () {
        const p = $('trade-form-panel');
        if (!p) return;
        p.classList.toggle('open');
        if (p.classList.contains('open')) {
          $('q-market').focus();
        }
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
              <td><button type="button" class="btn-market-link" onclick="openTradingView('${marketName}')" title="Buka chart ${marketName} di TradingView"><b>${marketName}</b> <span style="font-size:10px; opacity:0.5;"></span></button></td>
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
                <button class="btn btn-ghost btn-sm" style="padding:3px 7px;" onclick="editTrade('${tradeId}')" title="Edit">${language === 'en' ? 'Edit' : 'Edit'}</button>
                <button class="btn btn-danger btn-sm" style="padding:3px 7px;" onclick="deleteTrade('${tradeId}')" title="Hapus">${language === 'en' ? 'Delete' : 'Hapus'}</button>
              </td>
            </tr>`;
          } catch (err) {
            console.error('Error rendering trade row:', err, t);
            return '';
          }
        }).join('');
      };

      /* Upload jurnal trade engine (codefronts drag & drop zone - maks 10mb)
         spec: https://codefronts.com/components/css-file-upload-button/drag-and-drop-file-upload-zone/ */
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
          if (!['pdf', 'png', 'jpg', 'jpeg', 'txt', 'csv'].includes(ext)) throw new Error(language === 'en' ? 'Use PDF, PNG, JPG, TXT, or CSV.' : 'Gunakan PDF, PNG, JPG, TXT, atau CSV.');
          await refreshAccountAccess(true);
          if (job !== scanJob) return;
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
          trades=next;
          saveData();
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
          const value = JSON.parse(localStorage.getItem(scanStorageKey) || '[]');
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
          localStorage.setItem(scanStorageKey, JSON.stringify([currentScan, ...savedScans()]));
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
          $('upload-status-msg').innerHTML = `<span style="color:var(--green);"> Berhasil membaca ${parsed.length} entri trade dari berkas!</span>`;
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

      /* Statistics & charts (codefronts tailwind dark metric cards) */
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
        $('discipline-status').textContent = report.total ? report.total + (language === 'en' && report.total !== 1 ? ' trades' : ' trade') : 'Belum ada trade';
        $('discipline-sl').textContent = report.total ? report.slPct.toFixed(0) + (language === 'en' ? '% recorded' : '% tercatat') : 'Belum ada data';
        $('discipline-sl-bar').style.width = report.slPct + '%';
        $('discipline-risk').textContent = report.riskCount ? report.avgRisk.toFixed(2) + '% (' + report.riskCount + '/' + report.total + ' trade)' : 'Belum ada data risiko';
        $('discipline-dd').textContent = report.total && startBal > 0 ? (maxDrawdownUSD / startBal * 100).toFixed(2) + (language === 'en' ? '% of starting balance' : '% dari saldo awal') : 'Saldo awal dan transaksi diperlukan';
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

      /* Calculator engine */
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

      /* Profil & multi-account management */
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
              ${accounts.length > 1 ? `<button class="btn btn-danger btn-sm" onclick="deleteAccount('${safeId(a.id)}')">Hapus</button>` : ''}
            </div>
          </div>
        `).join('');

        // Update nav bar name
        const navName = $('nav-trader-name');
        const navBroker = $('nav-account-label');
        if (navName) navName.textContent = profile.name || 'Trader';
        if (navBroker && curAcc) navBroker.textContent = `${curAcc.broker} (${curAcc.name})`;
      }

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

      /* Backup, restore & export */
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
        const owner = journalOwner;
        const reader = new FileReader();
        reader.onload = function (e) {
          if (journalOwner !== owner) return;
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
          [K_ACCOUNTS, K_TRADES, K_SETTINGS, K_PROFILE, scanStorageKey, 'jt_kalender_cache_v2'].forEach(key => localStorage.removeItem(key));
          loadData();
          renderJournalTable();
          renderProfileView();
          alert('Seluruh data berhasil direset ke pengaturan awal.');
        }
      };

      /* Tradingview in-domain pop-up chart router */
      let currentTvSymbol = 'XAUUSD';
      let tvOpener = null;
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
        currentTvSymbol = sym;
        if (interval) currentTvInterval = interval;

        const info = TV_META[clean] || TV_META[sym] || {
          target: sym.includes(':') ? sym : ('FX:' + clean),
          label: sym,
          desc: sym + ' Live Chart'
        };

        const modal = $('tv-modal');
        if (modal && !modal.classList.contains('open')) {
          tvOpener = document.activeElement;
          modal.classList.add('open');
          modal.querySelector('.modal-close').focus();
        }

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
          box.innerHTML = `<iframe src="https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(info.target)}&interval=${encodeURIComponent(currentTvInterval)}&theme=dark&style=1&timezone=Asia%2FJakarta&locale=id" allowtransparency="true" scrolling="no" frameborder="0" title="${esc(info.label)} price chart"></iframe>`;
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
        if (tvOpener?.isConnected) tvOpener.focus();
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

      /* Economic calendar engine & dataset (wib gmt+7)
         matches reference system schema, filters & impact calculations */
      let kalCache = null, kalCari = '', kalDmp = [1,2,3], kalTh = '', kalBl = '', kalTg = '', kalLihatLalu = false;
      let kalCountries = null, kalCategory = '';
      let kalPollingTimer = null, kalCountdownTimer = null;

      const kalText = (id, en) => language === 'en' ? en : id;
      function kalHariIni() {
        const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
        return ['year','month','day'].map(type => parts.find(p => p.type === type).value).join('-');
      }
      function kalTglID(t) {
        const p = String(t || '').split('-');
        if (p.length !== 3) return t || '';
        const d = new Date(t + 'T12:00:00+07:00');
        if (isNaN(d)) return t || '';
        return d.toLocaleDateString(language === 'en' ? 'en-GB' : 'id-ID', { timeZone:'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
        const hari = kalHariIni();
        let isi = (a || []).filter(x => x && x.tgl);
        if (!kalLihatLalu && !kalTh && !kalBl && !kalTg) isi = isi.filter(x => x.tgl >= hari);
        if (kalTh) isi = isi.filter(x => String(x.tgl).slice(0, 4) === kalTh);
        if (kalBl) isi = isi.filter(x => String(x.tgl).slice(5, 7) === kalBl);
        if (kalTg) isi = isi.filter(x => String(x.tgl).slice(8, 10) === kalTg);
        isi = isi.filter(x => kalDmp.includes(kalDmpNorm(x.dmp)));
        if (kalCountries !== null) isi = isi.filter(x => kalCountries.includes(kalCountryCode(x)));
        if (kalCategory) isi = isi.filter(x => kalEventCategory(x) === kalCategory);
        const q = kalCari.trim().toLowerCase();
        if (q) {
          isi = isi.filter(x => ((x.nama || '') + ' ' + (x.neg || '') + ' ' + (x.cat || '')).toLowerCase().indexOf(q) >= 0);
        }
        return kalUrut(isi);
      }

      function kalAdaSaringan() {
        return !!(kalCari.trim() || kalDmp.length !== 3 || kalCountries !== null || kalCategory || kalTh || kalBl || kalTg);
      }


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
        isi($('kal-th'), th, kalTh, kalText('Semua tahun', 'All years'));
        isi($('kal-bl'), bl, kalBl, kalText('Semua bulan', 'All months'), v => new Date(Date.UTC(2000, +v - 1, 1)).toLocaleString(language === 'en' ? 'en-GB' : 'id-ID', {month:'long',timeZone:'UTC'}));
        isi($('kal-tg'), tg, kalTg, kalText('Semua tgl', 'All days'), v => String(parseInt(v, 10)));
      }

      function kalCountryCode(event) {
        return event.countryCode || ({USD:'US',GBP:'GB',JPY:'JP',EUR:'EU',AUD:'AU',NZD:'NZ',CAD:'CA',CHF:'CH',CNY:'CN',IDR:'ID',INR:'IN',KRW:'KR',BRL:'BR',ZAR:'ZA',TRY:'TR',SGD:'SG',HKD:'HK',RUB:'RU',MXN:'MX',SEK:'SE',NOK:'NO'}[event.neg] || event.neg || '');
      }
      const kalCategories = [
        ['inflation','Inflasi','Inflation',/inflation|\bcpi\b|\bppi\b|price index|deflator/i],
        ['employment','Ketenagakerjaan','Employment',/employment|unemployment|jobless|payroll|job openings|labor|labour|earnings/i],
        ['rates','Bank sentral','Central banks',/interest rate|rate decision|fomc|\bfed\b|\becb\b|\bboe\b|\bboj\b|central bank|monetary/i],
        ['growth','Aktivitas ekonomi','Economic activity',/\bgdp\b|\bpmi\b|production|retail|consumer|manufacturing|confidence|orders|sentiment/i],
        ['housing','Perumahan','Housing',/housing|home sales|building|mortgage/i],
        ['trade','Perdagangan & fiskal','Trade & fiscal',/trade|export|import|budget|auction|balance|treasury/i],
        ['energy','Energi','Energy',/oil|gas|petroleum|energy|crude|eia|baker hughes/i],
        ['other','Lainnya','Other',null]
      ];
      function kalEventCategory(event) {
        return kalCategories.find(row => row[3]?.test(event.nama || ''))?.[0] || 'other';
      }
      function renderKalFilters() {
        const names = new Intl.DisplayNames([language === 'en' ? 'en' : 'id'], {type:'region'});
        const codes = [...new Set((kalCache?.items || []).map(kalCountryCode).filter(Boolean))];
        const countryName = code => /^[A-Z]{2}$/.test(code) ? names.of(code) : code;
        codes.sort((a,b) => countryName(a).localeCompare(countryName(b)));
        $('kal-country-label').textContent = kalText('Negara','Countries');
        $('kal-category-label').textContent = kalText('Kategori','Category');
        $('kal-importance-label').textContent = kalText('Kepentingan','Importance');
        $('kal-country-summary').textContent = kalCountries === null ? kalText('Semua negara','All countries') + ' (' + codes.length + ')' : kalCountries.length + kalText(' dipilih',' selected');
        $('kal-country-search').placeholder = kalText('Cari negara…','Search countries…');
        const actions = {reset:kalText('Kembali ke default','Reset to default'),all:kalText('Pilih semua','Select all'),none:kalText('Hapus semua','Clear all')};
        document.querySelectorAll('[data-country-action]').forEach(button => button.textContent = actions[button.dataset.countryAction]);
        const query = $('kal-country-search').value.toLocaleLowerCase();
        $('kal-country-list').innerHTML = codes.filter(code => (countryName(code)+' '+code).toLocaleLowerCase().includes(query)).map(code => '<label><input type="checkbox" name="calendar-country" value="'+esc(code)+'" '+(kalCountries === null || kalCountries.includes(code) ? 'checked' : '')+'><span>'+esc(countryName(code))+'</span><small>'+esc(code)+'</small></label>').join('') || '<p>'+kalText('Negara tidak ditemukan','No countries found')+'</p>';
        $('kal-country-chips').innerHTML = (kalCountries === null ? codes : kalCountries).map(code => '<button type="button" data-remove-country="'+esc(code)+'" aria-label="'+esc(kalText('Hapus ','Remove ')+countryName(code))+'">'+esc(code)+' <span aria-hidden="true">×</span></button>').join('');
        $('kal-category').innerHTML = '<option value="">'+kalText('Semua kategori','All categories')+'</option>'+kalCategories.map(row => '<option value="'+row[0]+'">'+row[language === 'en' ? 2 : 1]+'</option>').join('');
        $('kal-category').value = kalCategory;
        const impacts = [[1,kalText('Rendah','Low')],[2,kalText('Sedang','Medium')],[3,kalText('Tinggi','High')]];
        $('kal-importance-summary').textContent = kalDmp.length === 3 ? kalText('Apa saja','Any importance') : kalDmp.length ? impacts.filter(row => kalDmp.includes(row[0])).map(row => row[1]).join(', ') : kalText('Tidak ada','None');
        $('kal-importance-list').innerHTML = impacts.map(row => '<label><input type="checkbox" name="calendar-importance" value="'+row[0]+'" '+(kalDmp.includes(row[0]) ? 'checked' : '')+'>'+kalDmpBar(row[0])+'<span>'+row[1]+'</span></label>').join('');
      }

      function kalKelompok(isi) {
        const urut = [], peta = {};
        isi.forEach(x => { if (!peta[x.tgl]) { peta[x.tgl] = []; urut.push(x.tgl); } peta[x.tgl].push(x); });
        return urut.map(t => ({ tgl: t, isi: peta[t] }));
      }

      function kalBand(tgl, hari) {
        return '<div class="kal-band">' + kalTglID(tgl) +
          (tgl === hari ? '<span class="kini">' + kalText('Hari Ini','Today') + '</span>' : '') + '</div>';
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
          (adaAngka ? '<div class="kal-ang">' + kalText('Akt','Actual') + ' <b class="' + cls.trim() + '">' + esc(x.akt || '-') +
            '</b> &middot; ' + kalText('Perk','Forecast') + ' ' + esc(x.prk || '-') + ' &middot; ' + kalText('Sblm','Previous') + ' ' + esc(x.sbl || '-') + '</div>' : '') +
          (x.cat ? '<div class="kal-cat"> ' + esc(x.cat) + '</div>' : '') +
          '</div></div>';
      }

      function kalKosong() {
        if (kalAdaSaringan()) {
          return '<div class="feed-empty">' + kalText('Tidak ada rilis yang cocok dengan saringan ini.', 'No releases match these filters.') + '<br>' +
            '<button class="btn btn-secondary btn-sm" style="margin-top:11px;" ' +
            'onclick="window.__kalReset()">' + kalText('Bersihkan Saringan','Clear filters') + '</button></div>';
        }
        return '<div class="feed-empty">' + kalText('Belum ada jadwal kalender. Cek lagi nanti.','Calendar unavailable. Check again later.') + '</div>';
      }

      function gambarKalender(items) {
        const semua = items || [];
        renderKalTgl(semua);
        renderKalFilters();
        const isi = kalSaring(semua);
        const info = $('cari-kal-info');
        if (info) {
          if (kalAdaSaringan()) {
            info.hidden = false;
            info.textContent = isi.length
              ? isi.length + kalText(' rilis ditemukan dari ', ' releases found out of ') + semua.length
              : kalText('Tidak ada yang cocok', 'No matches');
          } else { info.hidden = true; info.textContent = ''; }
        }
        const hari = kalHariIni();
        let bilah = '';
        if (!kalLihatLalu && !kalTh && !kalBl && !kalTg) {
          const lalu = semua.filter(x => x && x.tgl && x.tgl < hari).length;
          if (lalu) {
            bilah = '<div class="kal-lalu"><span>' + lalu + kalText(' jadwal lampau', ' past releases') + '</span>' +
              '<button class="btn btn-secondary btn-sm" type="button" onclick="window.__kalLalu(true)">' +
              kalText('Tampilkan', 'Show') + '</button></div>';
          }
        } else if (kalLihatLalu && !kalTh && !kalBl && !kalTg) {
          bilah = '<div class="kal-lalu"><span>' + kalText('Jadwal lampau ikut tampil','Past releases included') + '</span>' +
            '<button class="btn btn-secondary btn-sm" type="button" onclick="window.__kalLalu(false)">' +
            kalText('Sembunyikan', 'Hide') + '</button></div>';
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
        const hari = kalHariIni();

        let todayItems = semua.filter(x => x && x.tgl === hari);
        todayItems = kalUrut(todayItems);

        if (!todayItems.length) {
          container.innerHTML = '<div style="padding:15px; color:var(--text-muted); font-size:12.5px; text-align:center;">' + kalText('Tidak ada rilis data terjadwal untuk hari ini.', 'No releases scheduled today.') + '</div>';
          return;
        }

        container.innerHTML = todayItems.map(x => {
          const dmp = Math.max(1, Math.min(3, +x.dmp || 1));
          const dmpCls = dmp === 3 ? 'high' : (dmp === 2 ? 'med' : 'low');
          const dmpLbl = dmp === 3 ? kalText('Tinggi','High') : (dmp === 2 ? kalText('Sedang','Medium') : kalText('Rendah','Low'));
          const metaParts = [];
          if (x.akt) metaParts.push(kalText('Akt: ', 'Actual: ') + x.akt);
          if (x.prk) metaParts.push('Fcst: ' + x.prk);
          if (x.sbl) metaParts.push('Prev: ' + x.sbl);
          const metaStr = metaParts.length ? metaParts.join(' | ') : kalText('Menunggu konsensus rilis', 'Awaiting release consensus');

          return `
            <div class="cal-row" onclick="switchBeritaSub('kalender')" style="cursor:pointer;" title="${kalText('Klik untuk membuka kalender lengkap', 'Open the full calendar')}">
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
          titleEl.textContent = kalText('Memuat Jadwal Kalender...', 'Loading calendar...');
          timerEl.textContent = kalText('Sinkronisasi otomatis', 'Automatic refresh');
          return;
        }

        const now = new Date();
        const hari = kalHariIni();

        const highImpact = items
          .filter(x => x && x.tgl && x.jam && (+x.dmp >= 3))
          .map(x => {
            const evtDate = new Date(x.tgl + 'T' + x.jam + ':00+07:00');
            return { ...x, evtDate };
          })
          .sort((a, b) => a.evtDate - b.evtDate);

        const nextEvt = highImpact.find(x => x.evtDate.getTime() + 30 * 60 * 1000 > now.getTime());

        if (!nextEvt) {
          titleEl.textContent = kalText('Tidak Ada Rilis Berdampak Tinggi Terjadwal', 'No upcoming high-impact releases');
          timerEl.textContent = kalText('Semua rilis periode ini telah selesai', 'No upcoming release in this snapshot');
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
          timerEl.textContent = `${timeFormatted} · ${kalText('Dimulai dalam', 'Starts in')} ${cdStr}${isToday ? kalText(' (Hari Ini)', ' (Today)') : ' (' + kalTglID(nextEvt.tgl) + ')'}`;
        } else {
          timerEl.textContent = `${timeFormatted} · ${kalText('Rilis Sedang Berlangsung / Baru Rilis', 'Release due / just released')}`;
        }
      }

      window.__kalReset = function () {
        kalCari = ''; kalDmp = [1,2,3]; kalCountries = null; kalCategory = ''; $('kal-country-search').value = ''; kalTh = ''; kalBl = ''; kalTg = '';
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
          stampEl.textContent = kalText('Memperbarui otomatis...', 'Refreshing...');
        }

        let items = null;
        let updatedStr = '', sourceStatus = 'stale';

        // 1. Fetch from local kalender.json
        try {
          const res = await fetch('kalender.json?t=' + Date.now());
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.items) && data.items.length) {
              items = data.items;
              updatedStr = data.updated || '';
              sourceStatus = data.status || 'stale';
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
                updatedStr = data.updated || '';
              }
            }
          } catch (e) {
            console.warn('Remote kalender.json fallback error:', e);
          }
        }

        // 3. Fallback to cached localStorage
        if (!items) {
          try {
            const cached = localStorage.getItem('jt_kalender_cache_v2');
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
          items = [];
          updatedStr = '';
        }

        // Save to cache
        try {
          localStorage.setItem('jt_kalender_cache_v2', JSON.stringify({ items, updated: updatedStr }));
        } catch (e) {}

        kalCache = {
          items: items,
          rawUpdated: updatedStr, sourceStatus
        };

        gambarKalender(kalCache.items);
        renderTodayOverviewCalendar(kalCache.items);
        updateNextEventCountdown();

        calendarStamp();

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

      function calendarStamp() {
        if (!$('kal-stamp') || !kalCache) return;
        const stale = kalCache.sourceStatus !== 'ok' || !kalCache.rawUpdated || Date.now()-Date.parse(kalCache.rawUpdated)>3600000;
        $('kal-stamp').textContent = !kalCache.items.length ? kalText('Kalender tidak tersedia', 'Calendar unavailable') :
          (stale ? kalText('Kalender tersimpan; pembaruan live belum tersedia. Data per: ', 'Saved calendar; live refresh unavailable. Data as of: ') : kalText('Sumber diperbarui: ', 'Source updated: ')) +
          (kalCache.rawUpdated ? new Date(kalCache.rawUpdated).toLocaleString(language === 'en' ? 'en-GB' : 'id-ID', {timeZone:'Asia/Jakarta'}) + ' WIB' : kalText('Tidak diketahui', 'Unknown'));
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
        $('kal-country-search').addEventListener('input', renderKalFilters);
        $('kal-category').addEventListener('change', () => { kalCategory = $('kal-category').value; gambarKalUlang(); });
        $('calendar-filters').addEventListener('change', event => {
          if (event.target.name === 'calendar-country') {
            if (kalCountries === null) kalCountries = [...new Set((kalCache?.items || []).map(kalCountryCode))];
            kalCountries = event.target.checked ? [...new Set([...kalCountries,event.target.value])] : kalCountries.filter(code => code !== event.target.value);
          } else if (event.target.name === 'calendar-importance') {
            const value = +event.target.value;
            kalDmp = event.target.checked ? [...new Set([...kalDmp,value])] : kalDmp.filter(impact => impact !== value);
          } else return;
          const name = event.target.name, value = event.target.value;
          gambarKalUlang();
          document.querySelector('#calendar-filters input[name="'+name+'"][value="'+CSS.escape(value)+'"]')?.focus({preventScroll:true});
        });
        $('calendar-filters').addEventListener('click', event => {
          const button = event.target.closest('button');
          if (!button) return;
          if (button.dataset.countryAction) kalCountries = button.dataset.countryAction === 'none' ? [] : null;
          else if (button.dataset.removeCountry) kalCountries = (kalCountries || [...new Set((kalCache?.items || []).map(kalCountryCode))]).filter(code => code !== button.dataset.removeCountry);
          else return;
          gambarKalUlang();
        });
        document.querySelectorAll('.calendar-dropdown').forEach(panel => {
          panel.addEventListener('toggle', () => { if (panel.open) document.querySelectorAll('.calendar-dropdown').forEach(other => { if (other !== panel) other.open = false; }); });
          panel.addEventListener('keydown', event => { if (event.key === 'Escape') { panel.open = false; panel.querySelector('summary').focus(); } });
        });
        document.addEventListener('click', event => { document.querySelectorAll('.calendar-dropdown[open]').forEach(panel => { if (!panel.contains(event.target)) panel.open = false; }); });

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

      let publisherNews = null;
      let newsVisibleCount = 12;
      let newsSelectedSource = '';
      let newsQuery = '';
      let newsCategory = '';
      const newsCategoryNames = {politics:['Politik','Politics'], fed:['The Fed','The Fed'], world:['Dunia','World'], business:['Bisnis','Business'], markets:['Pasar','Markets'], sustainability:['Keberlanjutan','Sustainability'], legal:['Hukum','Legal'], commentary:['Komentar','Commentary'], technology:['Teknologi','Technology'], investigations:['Investigasi','Investigations'], local:['Berita lokal','Local news'], science:['Sains','Science'], sport:['Olahraga','Sport'], other:['Berita lainnya','Other news']};
      let publisherNewsBusy = false;
      let publisherNewsFailed = false;
      const publisherDomains = { investing: 'investing.com', cnbc: 'cnbc.com', kontan: 'kontan.co.id', reuters: 'reuters.com', aljazeera: 'aljazeera.com', bloomberg: 'bloomberg.com', fnc: 'tradewithfnc.com', investing_id: 'investing.com', pluang: 'pluang.com', kompas: 'kompas.com', detik: 'detik.com', kemenkeu: 'kemenkeu.go.id', cnn_id: 'cnnindonesia.com', bisnis: 'bisnis.com', sindo: 'sindonews.com', fedwatch: 'cmegroup.com', cme: 'cmegroup.com' };
      const newsText = (id, en) => language === 'en' ? en : id;
      function newsMatchesSearch(item, sourceName, query) {
        const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
        const haystack = normalize(item.title + ' ' + (sourceName || ''));
        return normalize(query).trim().split(/\s+/).every(term => haystack.includes(term));
      }
      function updateNewsSearch() {
        newsQuery = $('news-search').value;
        newsVisibleCount = 12;
        $('news-search-box').classList.toggle('isi', !!newsQuery);
        renderPublisherNews();
      }
      $('news-search').addEventListener('input', updateNewsSearch);
      $('news-search-clear').addEventListener('click', () => {
        $('news-search').value = ''; updateNewsSearch(); $('news-search').focus();
      });
      $('news-search').addEventListener('keydown', event => {
        if (event.key === 'Escape' && $('news-search').value) { event.preventDefault(); $('news-search-clear').click(); }
      });
      function publisherUrl(value, sourceId) {
        try {
          const url = new URL(value);
          const domain = publisherDomains[sourceId];
          return domain && url.protocol === 'https:' && !url.username && !url.password && (url.hostname === domain || url.hostname.endsWith('.' + domain)) ? url.href : null;
        } catch { return null; }
      }
      function publisherTime(value) {
        const date = new Date(value);
        return value && Number.isFinite(date.getTime()) ? date.toLocaleString(language === 'en' ? 'en-GB' : 'id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB' : null;
      }
      function publisherImageUrl(value) {
        try {
          const url = new URL(value);
          const domains = ['investing.com', 'cnbcfm.com', 'kontan.co.id', 'reuters.com', 'aljazeera.com', 'bloomberg.com', 'bwbx.io', 'pluang.com', 'kompas.com', 'detik.net.id', 'kemenkeu.go.id', 'cnnindonesia.com', 'bisnis.com', 'sindonews.com'];
          return url.protocol === 'https:' && !url.username && !url.password && domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)) ? url.href : null;
        } catch { return null; }
      }
      window.renderPublisherNews = function () {
        if (!canReadNews()) { $('publisher-news-list').innerHTML = ''; return; }
        $('fomc-panel').hidden = newsCategory !== 'fed';
        if (window.renderFedWatch) window.renderFedWatch();
        const status = $('publisher-news-status');
        if (!status) return;
        if (!publisherNews) {
          status.textContent = publisherNewsFailed ? newsText('Berita belum dapat dimuat. Buka situs penerbit atau coba lagi.', 'News could not be loaded. Visit a publisher or try again.') : newsText('Memuat berita terbaru...', 'Loading the latest headlines...');
          return;
        }
        const checked = publisherTime(publisherNews.checkedAt);
        const aged = Date.now() - new Date(publisherNews.checkedAt).getTime() > 90 * 60000;
        status.textContent = (publisherNewsFailed ? newsText('Pembaruan gagal; menampilkan data tersimpan. ', 'Refresh failed; showing the saved feed. ') : '') + (aged ? newsText('Data belum diperbarui. ', 'The feed has not been updated recently. ') : '') + newsText('Terakhir diperiksa: ', 'Last checked: ') + (checked || newsText('Tidak tersedia', 'Unavailable'));
        const select = $('news-source');
        const selected = select.value;
        if (selected !== newsSelectedSource) { newsVisibleCount = 12; newsSelectedSource = selected; }
        select.innerHTML = '<option value="">' + newsText('Semua sumber', 'All sources') + '</option>' + publisherNews.sources.filter(source => source.kind !== 'tool').map(source => '<option value="' + esc(source.id) + '">' + esc(source.name) + '</option>').join('');
        select.value = selected;
        $('publisher-source-status').innerHTML = publisherNews.sources.filter(source => source.kind !== 'tool').map(source => {
          const url = publisherUrl(source.url, source.id);
          if (!url) return '';
          const state = source.status === 'ok' ? newsText('Tersedia', 'Available') : source.status === 'stale' ? newsText('Data tersimpan; sumber gagal diperbarui', 'Saved headlines; source refresh failed') : newsText('Feed tidak tersedia; buka sumber', 'Feed unavailable; visit source');
          return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.name) + '<small>' + esc(state) + '</small></a>';
        }).join('');
        const sources = new Map(publisherNews.sources.map(source => [source.id, source]));
        const rows = publisherNews.items.filter(item => (!selected || item.source === selected) && (!newsCategory || ((item.category || 'other') === newsCategory || item.topics?.includes(newsCategory))) && newsMatchesSearch(item, sources.get(item.source)?.name, newsQuery));
        $('news-search-info').hidden = !newsQuery.trim();
        $('news-search-info').textContent = newsQuery.trim() ? rows.length.toLocaleString(language === 'en' ? 'en-GB' : 'id-ID') + newsText(' berita cocok', ' matching stories') : '';
        document.querySelectorAll('#news-categories [data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === newsCategory)));
        $('news-more-category').value = ['local','science','sport','other'].includes(newsCategory) ? newsCategory : '';
        document.querySelector('.publisher-grid-heading').textContent = newsCategory ? newsCategoryNames[newsCategory][language === 'en' ? 1 : 0] : newsText('Berita terbaru', 'Latest stories');
        $('news-more').hidden = rows.length <= newsVisibleCount;
        $('publisher-news-list').innerHTML = rows.length ? rows.slice(0, newsVisibleCount).map(item => {
          const url = publisherUrl(item.url, item.source);
          const source = sources.get(item.source);
          if (!url || !source) return '';
          const time = publisherTime(item.publishedAt) || newsText('Waktu terbit tidak disediakan penerbit', 'Publication time not provided by the publisher');
          const image = publisherImageUrl(item.image);
          const media = '<span class="publisher-photo"><span class="publisher-photo-fallback" aria-hidden="true"><small>' + newsText('Foto tidak tersedia', 'Photo unavailable') + '</small></span>' + (image ? '<img src="' + esc(image) + '" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</span>';
          return '<article class="publisher-news-item"><a class="publisher-story-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + media + '<h3>' + esc(item.title) + '</h3></a><p class="publisher-news-meta"><span>' + esc(source.name) + '</span><time' + (publisherTime(item.publishedAt) ? ' datetime="' + esc(item.publishedAt) + '"' : '') + '>' + esc(time) + '</time></p></article>';
        }).join('') : '<p>' + (newsQuery.trim() ? newsText('Tidak ada berita yang cocok. Coba kata kunci lain atau hapus filter kategori dan sumber.', 'No stories match your search. Try different keywords or clear the category and source filters.') : newsText('Belum ada berita yang sesuai filter ini. Pilih kategori atau sumber lain.', 'No stories match these filters. Choose another category or source.')) + '</p>';
        $('publisher-news-list').querySelectorAll('img').forEach(img => { img.addEventListener('error', () => img.remove(), { once: true }); });
      };
      window.selectNewsCategory = function (value) { newsCategory = newsCategoryNames[value] ? value : ''; newsVisibleCount = 12; renderPublisherNews(); };
      window.showMoreNews = function () { newsVisibleCount += 12; renderPublisherNews(); };
      window.reloadPublisherNews = async function () {
        if (!canReadNews()) { publisherNews = null; return; }
        if (publisherNewsBusy) return;
        publisherNewsBusy = true;
        $('news-refresh').disabled = true;
        $('publisher-news-list').setAttribute('aria-busy', 'true');
        try {
          const response = await fetch('berita.json?t=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error('News request failed');
          const data = await response.json();
          if (data.version !== 1 || !Array.isArray(data.sources) || !Array.isArray(data.items) || !publisherTime(data.checkedAt)) throw new Error('Invalid news feed');
          data.sources = data.sources.filter(source => source && publisherDomains[source.id] && typeof source.name === 'string' && publisherUrl(source.url, source.id));
          data.items = data.items.filter(item => item && typeof item.title === 'string' && publisherUrl(item.url, item.source));
          publisherNews = data;
          publisherNewsFailed = false;
        } catch (error) { publisherNewsFailed = true; }
        finally { publisherNewsBusy = false; $('news-refresh').disabled = false; $('publisher-news-list').setAttribute('aria-busy', 'false'); renderPublisherNews(); }
      };
      setInterval(() => { if (!document.hidden) reloadPublisherNews(); }, 300000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reloadPublisherNews(); });

      /* Sub-view Switcher */
      window.switchBeritaSub = function (sub, updateUrl = true) {
        if (!canReadNews()) return;
        if (!['ringkasan', 'kalender'].includes(sub)) return;
        document.querySelectorAll('#berita-seg .seg-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.sub === sub);
        });
        const rEl = $('sub-berita-ringkasan');
        const kEl = $('sub-berita-kalender');

        if (rEl) rEl.hidden = sub !== 'ringkasan';
        if (kEl) kEl.hidden = sub !== 'kalender';
        const ticker = $('market-ticker');
        if (!ticker.querySelector('script')) {
          const widget = document.createElement('tv-ticker-tape');
          widget.setAttribute('symbols', 'FOREXCOM:SPXUSD,FOREXCOM:NSXUSD,FX:EURUSD,FX:GBPUSD,CMCMARKETS:GOLD,BITSTAMP:BTCUSD,BITSTAMP:ETHUSD');
          widget.setAttribute('theme', 'dark');
          widget.setAttribute('hide-chart', '');
          widget.setAttribute('hide-logo', '');
          widget.setAttribute('item-size', 'compact');
          widget.addEventListener('tv-link-open', event => {
            event.preventDefault();
            const symbol = event.detail?.context?.symbol;
            if (typeof symbol === 'string' && /^[A-Z0-9_]+:[A-Z0-9_.]+$/i.test(symbol)) openTradingView(symbol);
          });
          ticker.replaceChildren(widget);
          const script = document.createElement('script');
          script.type = 'module';
          script.src = 'https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js';
          script.onerror = () => { ticker.textContent = 'Prices unavailable. Please refresh to retry.'; };
          ticker.appendChild(script);
        }

        if (sub === 'ringkasan') {
          renderPublisherNews();
        } else if (sub === 'kalender') {
          renderEconomicCalendar();
        }
        const route = 'economic-news' + (sub === 'ringkasan' ? '' : '/calendar');
        if (updateUrl && location.pathname !== pagePath(route)) history.pushState(null, '', pagePath(route));
      };

      function restoreRoute() {
        const base = new URL(document.baseURI).pathname;
        const parts = location.pathname.startsWith(base) ? location.pathname.slice(base.length).split('/').filter(Boolean) : [];
        if (parts[0] === 'login') {
          showAuthMode(cloudUser && cloudReady && !nicknameReady ? 'nickname' : location.hash === '#signup' ? 'signup' : 'signin');
          switchTab('login', false);
          const error = new URLSearchParams(location.hash.slice(1)).get('error_description');
          if (error) $('cloud-status').textContent = error;
          return;
        }
        const tabId = Object.keys(pageRoutes).find(key => pageRoutes[key] === parts[0]) || 'beranda';
        if (tabId !== 'beranda' && !onboarding.started) {
          onboarding.started = true;
          persistOnboarding();
          updateAccess();
        }
        switchTab(tabId, false);
        if (tabId === 'berita') switchBeritaSub(parts[1] === 'calendar' ? 'kalender' : 'ringkasan', false);
        if (tabId === 'berita' && parts[1] === 'social') history.replaceState(null, '', pagePath('economic-news'));
        if (!parts.length || !pageRoutes[tabId] || parts[0] !== pageRoutes[tabId]) history.replaceState(null, '', pagePath(pageRoutes[tabId]));
      }

      /* Initial Startup */
      migrateLegacyJournal();
      loadData();
      initCloudAuth();
      updateAccess();
      renderJournalTable();
      renderProfileView();
      runAllCalculators();
      updatePricingDisplay();
      initUploadDropZone();
      initCalendarEventListeners();
      renderEconomicCalendar();
      reloadPublisherNews();
      applyLanguage();
      renderStatistics();
      restoreRoute();
      window.addEventListener('popstate', restoreRoute);
      window.addEventListener('hashchange', () => { if (location.pathname === pagePath('login')) restoreRoute(); });
      refreshExchangeRate();
      setInterval(() => { if (!document.hidden) refreshExchangeRate(); }, 3600000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - exchangeCheckedAt >= 3600000) refreshExchangeRate(); });
      window.addEventListener('online', scheduleCloudSave);
      window.addEventListener('storage', event => {
        if ([K_ACCOUNTS, K_TRADES, K_SETTINGS, K_PROFILE].includes(event.key) || event.key === null) {
          loadData(); renderJournalTable(); renderStatistics(); renderProfileView(); runAllCalculators();
        }
        if (event.key === K_PROFILE && cloudUser && !nicknameReady) {
          const userId = cloudUser.id;
          cloudClient.from('profiles').select('display_name,nickname_set').eq('id', userId).maybeSingle().then(({ data, error }) => {
            if (error || cloudUser?.id !== userId || !data?.nickname_set || !data.display_name?.trim()) return;
            nicknameReady = true; profile.name = data.display_name; onboarding.name = data.display_name;
            persistOnboarding(); updateAccess();
            if ($('view-login').classList.contains('active')) switchTab('jurnal');
          });
        }
      });

    })();
