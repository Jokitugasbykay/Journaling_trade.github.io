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
      let gatewayImportFile = null, gatewayImportPending = null, gatewayImportBusy = false;
      let ocrLibrary = null;
      let uploadTrigger = null;
      let onboarding = { name: '', started: false };
      let language = 'en';
      const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'journalingtrade_nmddjuqkdyhcobddinkc_auth', flowType: 'pkce' } });
      let cloudUser = null, cloudReady = false, cloudBusy = false, cloudTimer = null, localRevision = 0;
      const FOUNDER_EMAILS = ['kaylafisika24@gmail.com', 'gamingyoga14@gmail.com'];
      let founderUserId = '', verifiedNewsUserId = '', cloudAuthRevision = 0;
      function isNewsFounder() { return !!cloudUser && founderUserId === cloudUser.id; }
      async function verifyNewsIdentity(userId, revision = cloudAuthRevision) {
        let result;
        try { result = await cloudClient.auth.getUser(); } catch (error) { result = {error}; }
        const {data, error} = result;
        if (revision !== cloudAuthRevision || cloudUser?.id !== userId) return false;
        if (error && verifiedNewsUserId === userId && (error.name === 'AuthRetryableFetchError' || error.status >= 500)) return true;
        founderUserId = ''; verifiedNewsUserId = '';
        if (!error && data?.user?.id === userId) {
          cloudUser = data.user;
          verifiedNewsUserId = userId;
          if (data.user.email_confirmed_at && FOUNDER_EMAILS.includes(data.user.email?.trim().toLowerCase())) founderUserId = userId;
        }
        renderNewsRegionControls();
        updateAccess();
        return !error && data?.user?.id === userId;
      }
      let accountAccess = null, nicknameReady = false, hydratingUserId = '', authMode = 'signin';
      const cloudAccountIds = new Map(), cloudStrategyIds = new Map(), localAccountIds = new Map();
      let cloudSnapshot = '';
      try {
        const saved = JSON.parse(localStorage.getItem('fncjt_onboarding') || '{}');
        onboarding = { name: typeof saved.name === 'string' ? saved.name.slice(0, 80) : '', started: saved.started === true };
      } catch {}

      /* Safe Element Selector */
      const $ = id => document.getElementById(id);
      const uiText = (id, en) => window.JTI18n?.text(id, en) ?? (language === 'id' ? id : en);
      const esc = value => String(value ?? '').replace(/(?:[#*0-9]\uFE0F?\u20E3)|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D]/gu, '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const safeId = value => /^[\w-]{1,80}$/.test(String(value || '')) ? String(value) : '';

      function applyLanguage() {
        window.JTI18n?.apply();
        $('language-select').value = language;
        $('nickname-input').placeholder = uiText('Nama panggilan Anda', 'Your nickname');
        if (window.renderPublisherNews) renderPublisherNews();
        if (window.renderBiIndicators) renderBiIndicators();
        if (kalCache) {
          gambarKalUlang(); renderCalendarAgenda(); renderTodayOverviewCalendar(kalCache.items); updateNextEventCountdown(); calendarStamp();
        }
        if (window.renderFedWatch) window.renderFedWatch();
        updatePricingDisplay();
      }
      window.setLanguage = async function (value) {
        try {
          await window.JTI18n.ready;
          if (!await window.JTI18n.setLanguage(value)) return;
          language = window.JTI18n.language;
        } catch (error) {
          $('language-select').value = language;
          console.error('Unable to load selected language', error);
          return;
        }
        renderJournalTable();
        renderStatistics();
        renderProfileView();
        updateAccess();
        const proTab = document.querySelector('[data-pro-tab].active');
        if (proTab && $('view-pro-workspace').classList.contains('active')) openProAnalytics(Number(proTab.dataset.proTab));
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
        alert(uiText("8 data trade simulasi berhasil dimuat ke jurnal Anda!", "Eight example trades have been added to your journal."));
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
          'Invalid login credentials': uiText("Email atau kata sandi salah.", "Incorrect email or password."),
          'Email not confirmed': uiText("Konfirmasi email Anda sebelum masuk.", "Confirm your email before signing in."),
          'User already registered': uiText("Email ini sudah terdaftar. Silakan masuk.", "This email is already registered. Please sign in."),
          'Password should be at least 6 characters': uiText("Kata sandi terlalu pendek.", "Password is too short.")
        };
        return messages[error?.message] || error?.message || uiText("Koneksi server gagal. Data lokal tetap tersimpan.", "Server connection failed. Your local data is preserved.");
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
          if ($('cloud-status')) $('cloud-status').textContent = uiText('Jurnal tersimpan ke server.', 'Journal saved to the server.');
        } catch (error) {
          console.error('Supabase sync error:', error);
          if ($('cloud-status')) $('cloud-status').textContent = cloudMessage(error);
          return false;
        } finally { cloudBusy = false; if (localRevision !== startRevision) scheduleCloudSave(); }
        return true;
      }

      const cloudTradeIds = new Map();
      function decimalOrNull(value) { if (value === null || value === undefined || value === '') return null; const text = String(value).trim(); if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) throw new Error('A financial value is invalid.'); return text; }
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
        if ($('cloud-status')) $('cloud-status').textContent = uiText('Menyimpan jurnal ke server...', 'Saving journal to the server...');
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
        onboarding.name = userId || profile.name !== 'Trader' ? profile.name : '';
        updateAccess(); renderJournalTable(); renderProfileView(); renderStatistics(); runAllCalculators();
      }

      function handleCloudSignedOut() {
        cloudAuthRevision++; founderUserId = ''; verifiedNewsUserId = '';
        hydratingUserId = '';
        cloudUser = null; cloudReady = false; nicknameReady = false; accountAccess = null;
        globalThis.JTPRO?.reset(); journalProFilter = null; gatewayImportFile = null; gatewayImportPending = null;
        if (globalThis.JTPRO_CONFIG?.apiBase) { kalCache = null; gambarKalender([]); renderTodayOverviewCalendar([]); }
        resetNewsData();
        resetNewsRegion();
        selectJournalOwner();
        persistOnboarding();
      }

      async function loadCloudTrades(userId, authRevision) {
        const rows = [];
        for (let offset = 0; offset < 100000; offset += 1000) {
          const result = await cloudClient.from('trades').select('*').eq('user_id', userId).order('id').range(offset, offset + 999);
          if (cloudUser?.id !== userId || cloudAuthRevision !== authRevision) throw new Error('The signed-in account changed.');
          if (result.error) return result;
          rows.push(...(result.data || []));
          if ((result.data || []).length < 1000) return { data: rows };
        }
        throw new Error('This journal exceeds the supported 100,000-trade limit.');
      }

      async function hydrateCloud(user) {
        if (hydratingUserId === user.id) return;
        hydratingUserId = user.id;
        const authRevision = ++cloudAuthRevision;
        const guestJournal = !journalOwner && trades.length ? { accounts: structuredClone(accounts), trades: structuredClone(trades) } : null;
        if (cloudUser?.id !== user.id) { founderUserId = ''; verifiedNewsUserId = ''; nicknameReady = false; resetNewsData(); }
        cloudUser = user;
        cloudReady = false; accountAccess = null;
        globalThis.JTPRO?.reset(); journalProFilter = null; gatewayImportFile = null; gatewayImportPending = null;
        if (globalThis.JTPRO_CONFIG?.apiBase) { kalCache = null; gambarKalender([]); renderTodayOverviewCalendar([]); }
        try {
          if (!await verifyNewsIdentity(user.id, authRevision)) {
            if (authRevision !== cloudAuthRevision) return;
            throw new Error('Account verification failed');
          }
          if (journalOwner !== user.id) selectJournalOwner(user.id);
          try {
            const saved = JSON.parse(localStorage.getItem('fncjt_cloud_map_' + user.id) || '{}');
            cloudAccountIds.clear(); cloudTradeIds.clear(); cloudStrategyIds.clear();
            for (const [a, b] of saved.accounts || []) cloudAccountIds.set(a, b);
            for (const [a, b] of saved.trades || []) cloudTradeIds.set(a, b);
            for (const [a, b] of saved.strategies || []) cloudStrategyIds.set(a, b);
            cloudSnapshot = saved.snapshot || '';
          } catch {}
          const profileRequest = cloudClient.from('profiles').select('display_name,nickname_set').eq('id', user.id).maybeSingle();
          const journalRequest = Promise.allSettled([
            cloudClient.from('trading_accounts').select('*').eq('user_id', user.id),
            cloudClient.from('strategies').select('*').eq('user_id', user.id),
            globalThis.JTPRO_CONFIG?.apiBase ? loadCloudTrades(user.id, authRevision) : cloudClient.from('trades').select('*').eq('user_id', user.id)
          ]);
          const profileResult = await profileRequest;
          if (cloudUser?.id !== user.id || authRevision !== cloudAuthRevision) return;
          if (profileResult.error) throw profileResult.error;
          nicknameReady = profileResult.data?.nickname_set === true && !!profileResult.data.display_name?.trim();
          profile.name = nicknameReady ? profileResult.data.display_name : '';
          onboarding.name = profile.name; onboarding.started = true;
          persistOnboarding();
          await refreshAccountAccess();
          if (authRevision !== cloudAuthRevision || cloudUser?.id !== user.id) return;
          updateAccess();
          const results = await journalRequest;
          if (cloudUser?.id !== user.id || authRevision !== cloudAuthRevision) return;
          const [accountResult, strategyResult, tradeResult] = results.map(result => result.status === 'fulfilled' ? result.value : {error:result.reason});
          for (const result of [accountResult, strategyResult, tradeResult]) if (result.error) throw result.error;
          const remoteAccounts = accountResult.data || [], remoteTrades = tradeResult.data || [];
          if (!remoteAccounts.length && !remoteTrades.length && !trades.length && guestJournal && confirm(uiText('Impor jurnal lokal tamu ke akun ini?', 'Import the local guest journal into this account?'))) { accounts = guestJournal.accounts; trades = guestJournal.trades; saveLocalData(); }
          if (remoteAccounts.length || remoteTrades.length) {
            const hasLocalJournal = trades.length > 0 || accounts.some(a => a.id !== 'local_acc');
            const localChangedSinceSync = cloudSnapshot ? cloudSnapshot !== journalFingerprint() : hasLocalJournal;
            if (localChangedSinceSync && hasLocalJournal) {
              if (!confirm(uiText('Akun ini sudah memiliki data server. Ganti data lokal di perangkat ini dengan data server?', 'This account already has server data. Replace local data on this device with server data?'))) {
                cloudUser = null; cloudReady = false;
                await cloudClient.auth.signOut();
                return;
              }
            }
            cloudAccountIds.clear(); cloudStrategyIds.clear(); cloudTradeIds.clear(); localAccountIds.clear();
            accounts = remoteAccounts.map(a => { const id = 'cloud_' + a.id; cloudAccountIds.set(id, a.id); localAccountIds.set(a.id, id); return { id, name: a.name, broker: a.broker || '', type: a.account_type || 'Standard', currency: a.currency, startBalance: Number(a.initial_balance), status: a.is_active ? 'Active' : 'Inactive' }; });
            const strategies = new Map((strategyResult.data || []).map(s => { cloudStrategyIds.set(s.name, s.id); return [s.id, s.name]; }));
            trades = remoteTrades.map(t => { const id = 'cloud_' + t.id; cloudTradeIds.set(id, t.id); return { id, accountId: localAccountIds.get(t.account_id) || '', date: tradeDateJakarta(t.opened_at), jam: t.opened_at ? new Date(t.opened_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }) : '', market: t.market || t.symbol, posisi: t.side === 'short' ? 'Sell' : 'Buy', entry: Number(t.entry_price) || 0, exit: t.exit_price === null ? null : Number(t.exit_price), sl: t.stop_loss === null ? null : Number(t.stop_loss), tp: t.take_profit === null ? null : Number(t.take_profit), vol: t.quantity === null ? null : Number(t.quantity), riskPct: t.risk_percent === null ? null : Number(t.risk_percent), actualPnl: t.pnl === null ? null : Number(t.pnl), pnlCurrency: globalThis.JTPRO_CONFIG?.apiBase ? accounts.find(a => a.id === 'cloud_' + t.account_id)?.currency : undefined, result: t.notes?.match(/Result: (Win|Loss|BE)/)?.[1] || (globalThis.JTPRO_CONFIG?.apiBase ? (t.pnl === null || t.pnl === undefined ? '' : Number(t.pnl) > 0 ? 'Win' : Number(t.pnl) < 0 ? 'Loss' : 'BE') : 'Win'), strategy: strategies.get(t.strategy_id) || '', tf: t.notes?.match(/TF: ([^·]+)/)?.[1]?.trim() || '', reason: t.notes?.split(' · ')[0] || '' }; });
            profile.name = profileResult.data?.display_name || '';
            profile.currentAccount = accounts[0]?.id || '';
            onboarding.name = profile.name; onboarding.started = true;
            persistOnboarding(); persistCloudMaps();
            saveLocalData();
          }
          cloudReady = true;
          verifyProAccess();
          if (authRevision !== cloudAuthRevision || cloudUser?.id !== user.id) return;
          updateAccess(); renderJournalTable(); renderStatistics(); renderProfileView(); runAllCalculators();
          scheduleCloudSave();
          if (!nicknameReady) {
            const google = googleAccountProfile();
            if (google?.name) $('nickname-input').value = google.name.slice(0, 40);
            switchTab('login'); setAuthMode('nickname');
          }
          else if ($('view-login').classList.contains('active')) switchTab('jurnal');
        } catch (error) {
          if (cloudUser?.id !== user.id || authRevision !== cloudAuthRevision) return;
          console.error('Supabase load error:', error);
          if ($('cloud-status')) $('cloud-status').textContent = cloudMessage(error);
          if (verifiedNewsUserId !== user.id) handleCloudSignedOut();
          else { cloudReady = false; updateAccess(); }
        } finally {
          if (hydratingUserId === user.id && authRevision === cloudAuthRevision) hydratingUserId = '';
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
        if (!cloudClient) { if ($('cloud-status')) $('cloud-status').textContent = uiText("Koneksi server tidak tersedia. Data lokal tetap tersimpan.", "Server connection unavailable. Your local data is preserved."); return; }
        let eventRevision = 0;
        cloudClient.auth.onAuthStateChange((event, session) => {
          if (!['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'SIGNED_OUT'].includes(event)) return;
          const revision = ++eventRevision;
          if (session?.user && ['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'].includes(event)) {
            setTimeout(() => {
              if (revision !== eventRevision) return;
              if (!cloudReady || cloudUser?.id !== session.user.id) return hydrateCloud(session.user);
              verifyProAccess();
              const authRevision = cloudAuthRevision;
              verifyNewsIdentity(session.user.id).catch(() => {
                if (authRevision !== cloudAuthRevision || cloudUser?.id !== session.user.id) return;
                founderUserId = ''; verifiedNewsUserId = ''; updateAccess();
              });
            }, 0);
          }
          if (event === 'SIGNED_OUT') handleCloudSignedOut();
        });
        const revision = eventRevision;
        const { data, error } = await cloudClient.auth.getSession();
        if (revision !== eventRevision) return;
        if (error) { console.error('Supabase session error:', error); return; }
        if (data.session?.user) await hydrateCloud(data.session.user);
      }

      function canReadNews() { return !!cloudUser && verifiedNewsUserId === cloudUser.id && nicknameReady && (globalThis.JTPRO_CONFIG?.apiBase ? proVerifiedUser === cloudUser.id && ['plus','pro'].includes(proAccess?.plan) && Date.parse(proAccess?.effective_until) > Date.now() : isNewsFounder() || ['plus', 'pro'].includes(accountAccess?.plan)); }
      async function refreshAccountAccess(consumeUpload = false) {
        if (!cloudUser) throw new Error(uiText('Masuk untuk menggunakan jatah upload Free.', 'Sign in to use your Free upload allowance.'));
        const userId = cloudUser.id, authRevision = cloudAuthRevision;
        if (!nicknameReady && consumeUpload) throw new Error(uiText('Isi nama panggilan Anda terlebih dahulu.', 'Complete your nickname first.'));
        if (globalThis.JTPRO_CONFIG?.apiBase && nicknameReady && verifiedNewsUserId === userId) {
          const access = await globalThis.JTPRO.verifyAccess(), usage = await globalThis.JTPRO.request('/usage');
          if (cloudUser?.id !== userId || authRevision !== cloudAuthRevision) throw new Error('Account changed. Try again.');
          accountAccess = {plan:access.plan, remaining:usage.imports.remaining, used:usage.imports.used, resetAt:usage.imports.reset_at,
            allowed:access.plan !== 'free' || usage.imports.remaining > 0};
          renderAccountAccess();
          if (consumeUpload && !accountAccess.allowed) throw new Error(uploadAllowanceText());
          return accountAccess;
        }
        const { data, error } = await cloudClient.rpc('journal_access', { consume_upload: consumeUpload });
        if (cloudUser?.id !== userId || authRevision !== cloudAuthRevision) throw new Error(uiText('Akun berubah. Coba lagi.', 'Account changed. Try again.'));
        if (error) throw error;
        if (!data || !['free', 'plus', 'pro'].includes(data.plan) || typeof data.allowed !== 'boolean') throw new Error('Invalid account access response');
        accountAccess = data;
        renderAccountAccess();
        if (!accountAccess.allowed) throw new Error(uploadAllowanceText());
        return accountAccess;
      }
      function uploadAllowanceText() {
        if (!cloudUser) return uiText('Masuk untuk 10 upload Free setiap 12 jam.', 'Sign in for 10 Free uploads every 12 hours.');
        if (!accountAccess) return uiText('Memeriksa jatah upload...', 'Checking your upload allowance...');
        if (accountAccess.plan !== 'free') return (accountAccess.plan === 'pro' ? 'Pro' : 'Plus') + ' · ' + uiText('Upload tanpa batas', 'Unlimited uploads');
        const reset = accountAccess.resetAt ? new Date(accountAccess.resetAt).toLocaleString(language, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '';
        return uiText('Free · Sisa {remaining}/10 upload.', 'Free · {remaining}/10 uploads remaining.').replace('{remaining}', accountAccess.remaining) + ' ' + (reset ? uiText('Reset {time}.', 'Resets {time}.').replace('{time}', reset) : uiText('Diperbarui setiap 12 jam.', 'Resets every 12 hours.'));
      }
      const proFeatures = ['analytics', 'heatmap', 'strategies', 'risk', 'reviews', 'reports', 'ai-behaviour', 'ai-market', 'ai-journal', 'global-news'];
      const proPaths = ['analytics', 'heatmap', 'strategies', 'risk', 'reviews', 'reports', 'ai/behaviour', 'ai/market', 'ai/journal', 'global-news'];
      let proAccess = null, proVerifiedUser = '', proExpiryTimer = null, pendingProRoute = null;
      let journalProFilter = null;

      function effectiveProAccess() {
        return !!cloudUser && verifiedNewsUserId === cloudUser.id && nicknameReady && proVerifiedUser === cloudUser.id && proAccess?.plan === 'pro'
          && Number.isFinite(Date.parse(proAccess.effective_until)) && Date.parse(proAccess.effective_until) > Date.now();
      }
      function renderProNavigation() {
        const hook = $('nav-ai-trading');
        if (!hook) return;
        const pro = effectiveProAccess();
        hook.hidden = pro;
        hook.disabled = true;
        hook.setAttribute('aria-disabled', 'true');
        document.querySelectorAll('[data-pro-tab]').forEach(button => { button.hidden = !pro; button.disabled = !pro; button.setAttribute('aria-disabled', String(!pro)); });
      }
      function acceptProAccess(data) {
        clearTimeout(proExpiryTimer);
        proAccess = data;
        proVerifiedUser = data && cloudUser && verifiedNewsUserId === cloudUser.id && nicknameReady ? cloudUser.id : '';
        renderProNavigation();
        if (globalThis.JTPRO_CONFIG?.apiBase && cloudUser && verifiedNewsUserId === cloudUser.id && nicknameReady) {
          accountAccess = {...accountAccess, plan:data?.plan || 'free'};
          renderAccountAccess();
          if (!canReadNews()) { resetNewsData(); renderPublisherNews(); kalCache = null; gambarKalender([]); renderTodayOverviewCalendar([]); }
        }
        if (proVerifiedUser && ['plus','pro'].includes(data?.plan) && Date.parse(data.effective_until) > Date.now()) {
          proExpiryTimer = setTimeout(() => { globalThis.JTPRO?.reset(); renderProNavigation(); }, Math.min(2147483647, Math.max(1, Date.parse(data.effective_until) - Date.now())));
        }
      }
      function activateProRoute(feature, updateUrl = true) {
        const index = proFeatures.indexOf(feature);
        if (index < 0) return;
        pendingProRoute = feature;
        document.querySelectorAll('.nav-tab').forEach(button => button.classList.toggle('active', button.dataset.proTab === String(index)));
        document.querySelectorAll('.view-content').forEach(view => view.classList.toggle('active', view.id === 'view-pro-workspace'));
        document.body.classList.remove('auth-page');
        if (updateUrl && location.pathname !== pagePath(proPaths[index])) history.pushState(null, '', pagePath(proPaths[index]));
        window.scrollTo({top:0, behavior:'smooth'});
      }
      window.openProAnalytics = async function (index, updateUrl = true) {
        if (!Number.isInteger(index) || !proFeatures[index]) return;
        activateProRoute(proFeatures[index], updateUrl);
        await window.JTPRO?.open(proFeatures[index]);
      };
      async function verifyProAccess() {
        if (!window.JTPRO || !cloudUser || verifiedNewsUserId !== cloudUser.id || !nicknameReady) return;
        try {
          await window.JTPRO.verifyAccess();
          if (globalThis.JTPRO_CONFIG?.apiBase && canReadNews()) { reloadPublisherNews(); fetchKalenderData(false); }
          if (pendingProRoute && effectiveProAccess()) await window.JTPRO.open(pendingProRoute);
        } catch { acceptProAccess(null); }
      }
      function openProJournal(filters = {}) {
        const accountId = localAccountIds.get(filters.account_id);
        if (accountId) profile.currentAccount = accountId;
        const ids = Array.isArray(filters.trade_ids) ? filters.trade_ids : Array.isArray(filters.ids) ? filters.ids : filters.trade_id ? [filters.trade_id] : null;
        switchTab('jurnal');
        resetJournalFilters();
        journalProFilter = {ids: ids ? new Set(ids.map(id => [...cloudTradeIds].find(([, cloudId]) => cloudId === id)?.[0] || 'cloud_' + id)) : null, date: ids ? '' : filters.date || '', from:ids ? '' : filters.from || filters.start || '', to:ids ? '' : filters.to || filters.end || ''};
        if (filters.instrument || filters.symbol) $('filter-market').value = filters.instrument || filters.symbol;
        if (filters.strategy || filters.strategy_id) $('filter-strategy').value = filters.strategy || [...cloudStrategyIds].find(([, id]) => id === filters.strategy_id)?.[0] || '';
        renderJournalTable();
      }
      window.JTPRO?.configure({
        apiBase: window.JTPRO_CONFIG?.apiBase || '',
        getUserId: () => cloudUser && verifiedNewsUserId === cloudUser.id && nicknameReady ? cloudUser.id : '',
        getToken: async () => {
          const userId = cloudUser?.id;
          if (!userId || verifiedNewsUserId !== userId || !nicknameReady || !cloudClient) return '';
          const {data, error} = await cloudClient.auth.getSession();
          return !error && cloudUser?.id === userId && data?.session?.user?.id === userId ? data.session.access_token : '';
        },
        onAccessChange: acceptProAccess,
        onRoute: feature => activateProRoute(feature),
        onJournalFilters: openProJournal
      });

      function renderAccountAccess() {
        renderProNavigation();
        const hasProfile = !!cloudUser || !!onboarding.name;
        const name = googleAccountProfile()?.name || onboarding.name || profile.name || 'Trader';
        const plan = isNewsFounder() ? 'Founder' : cloudUser && !accountAccess ? uiText('Memeriksa paket…', 'Checking plan…') : accountAccess?.plan === 'pro' ? 'Pro' : accountAccess?.plan === 'plus' ? 'Plus' : 'Free';
        $('nav-dd-username').textContent = hasProfile ? name : uiText('Selamat datang', 'Welcome');
        $('nav-avatar-initials').textContent = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
        $('nav-trader-name').textContent = name;
        $('nav-account-plan').textContent = plan;
        $('nav-dd-plan').textContent = plan;
        for (const id of ['nav-avatar-initials', 'nav-account-copy', 'nav-dd-plan', 'nav-account-storage']) $(id).hidden = !hasProfile;
        for (const id of ['nav-login-label', 'nav-guest-badge', 'nav-try']) $(id).hidden = hasProfile;
        $('upload-quota-note').textContent = uploadAllowanceText();
        $('news-content').hidden = !canReadNews();
        $('news-paywall').hidden = canReadNews();
        window.syncNewsSelects?.();
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
        return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(date.getTime()) ? date.toLocaleDateString(language, {timeZone:'Asia/Jakarta', day:'numeric', month:'short', year:'numeric'}) : null;
      }
      window.renderBiIndicators = function () {
        const host = $('bi-indicators');
        if (!host) return;
        if (!biData) { host.textContent = uiText('Memuat data Bank Indonesia...', 'Loading Bank Indonesia data...'); return; }
        const fx = biData.fx, rate = biData.rate;
        const rupiah = value => 'Rp ' + value.toLocaleString('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2});
        const tile = (label, value, date, url, status) => '<a class="bi-indicator" href="' + url + '" target="_blank" rel="noopener noreferrer"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><small>' + esc(date || (uiText('Tidak tersedia', 'Unavailable'))) + (status === 'stale' ? (uiText(' · Data tersimpan', ' · Saved data')) : '') + '</small></a>';
        const validFx = fx && fx.source === biFxSource && fx.currency === 'USD' && fx.unit === 1 && Number.isFinite(fx.buy) && Number.isFinite(fx.sell) && fx.buy > 0 && fx.sell >= fx.buy && biDate(fx.date);
        const validRate = rate && rate.source === biRateSource && Number.isFinite(rate.percent) && rate.percent >= 0 && rate.percent <= 100 && biDate(rate.date);
        host.innerHTML = tile(uiText('Kurs jual USD BI', 'BI USD sell rate'), validFx ? rupiah(fx.sell) : (uiText('Tidak tersedia', 'Unavailable')), validFx ? biDate(fx.date) : null, biFxSource, fx?.status) + tile(uiText('Kurs beli USD BI', 'BI USD buy rate'), validFx ? rupiah(fx.buy) : (uiText('Tidak tersedia', 'Unavailable')), validFx ? biDate(fx.date) : null, biFxSource, fx?.status) + tile(uiText('Titik tengah BI · Jurnal', 'BI midpoint · Journal'), validFx ? rupiah((fx.sell + fx.buy) / 2) : (uiText('Tidak tersedia', 'Unavailable')), validFx ? biDate(fx.date) : null, biFxSource, fx?.status) + tile('BI-Rate', validRate ? rate.percent.toLocaleString(language, {maximumFractionDigits:2}) + '%' : (uiText('Tidak tersedia', 'Unavailable')), validRate ? biDate(rate.date) : null, biRateSource, rate?.status);
      };
      window.refreshExchangeRate = async function () {
        if (exchangeBusy) return;
        exchangeBusy = true;
        const status = $('exchange-status');
        status.textContent = uiText('Mengambil kurs Bank Indonesia...', 'Fetching Bank Indonesia rates...');
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
          status.textContent = (uiText('Titik tengah kurs transaksi BI: Rp ', 'BI transaction midpoint: Rp ')) + mid.toLocaleString('id-ID') + ' / USD. ' + biDate(fx.date) + (fx.status === 'stale' ? (uiText(' · Data BI tersimpan; sumber gagal diperbarui.', ' · Saved BI data; source refresh failed.')) : '');
        } catch (error) {
          status.textContent = (uiText('Kurs BI belum tersedia. Kurs jurnal tersimpan: Rp ', 'BI rates are unavailable. Saved journal rate: Rp ')) + Number(settings.kurs).toLocaleString('id-ID') + ' / USD.';
          if (!biData) $('bi-indicators').innerHTML = '<a href="' + biFxSource + '" target="_blank" rel="noopener noreferrer">' + (uiText('Data BI belum tersedia. Buka sumber resmi.', 'BI data unavailable. Open the official source.')) + '</a>';
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
        pendingProRoute = null;
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
        if (updateUrl && pageRoutes[tabId] && (location.pathname !== pagePath(pageRoutes[tabId]) || location.search)) {
          history.pushState(null, '', pagePath(pageRoutes[tabId]));
          if (tabId === 'berita') renderPublisherNews();
        }
        applyLanguage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      function persistOnboarding() {
        try { localStorage.setItem('fncjt_onboarding', JSON.stringify(onboarding)); }
        catch { $('home-access-hint').textContent = uiText('Sesi aktif. Penyimpanan browser tidak tersedia.', 'Your session is active. Browser storage is unavailable.'); }
      }

      function updateAccess() {
        document.querySelectorAll('.nav-tab:not(#nav-ai-trading):not([data-pro-tab]), [data-workspace-action]').forEach(button => {
          const locked = !['beranda', 'berita'].includes(button.dataset.tab) && !onboarding.started;
          button.disabled = locked;
          button.setAttribute('aria-disabled', String(locked));
          button.title = locked ? (uiText('Klik Coba di Beranda untuk membuka tab ini.', 'Click Try on Home to open this tab.')) : '';
        });
        $('home-access-hint').dataset.i18n = onboarding.started ? 'accessReady' : 'accessHint';
        $('nav-login-label').dataset.i18n = cloudUser ? 'cloudConnected' : (onboarding.name ? 'localProfile' : 'signIn');
        $('nav-dd-username').textContent = onboarding.name || (uiText('Selamat datang', 'Welcome'));
        $('nav-dd-username').removeAttribute('data-i18n');
        $('nav-dd-status').dataset.i18n = cloudUser ? (cloudReady ? 'cloudStatus' : 'cloudPending') : (onboarding.name ? 'localProfileStatus' : 'guestStatus');
        $('menu-login-label').dataset.i18n = cloudUser ? 'cloudManage' : (onboarding.name ? 'changeProfile' : 'loginMenu');
        $('menu-logout').hidden = !cloudUser && !onboarding.name;
        $('menu-logout-label').dataset.i18n = cloudUser ? 'cloudSignOut' : 'signOut';
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
        if (!cloudClient) { $('cloud-status').textContent = uiText('Koneksi akun belum tersedia.', 'Account connection is unavailable.'); return; }
        const button = $('auth-signin-submit'); button.disabled = true;
        $('cloud-status').textContent = uiText('Sedang masuk...', 'Signing in...');
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
        confirmation.setCustomValidity(password.value === confirmation.value ? '' : (uiText('Kata sandi tidak sama.', 'Passwords do not match.')));
        if (!$('cloud-login-form').reportValidity()) return;
        const button = $('auth-signup-submit'); button.disabled = true;
        $('cloud-status').textContent = uiText('Membuat akun...', 'Creating your account...');
        try {
          const { data, error } = await cloudClient.auth.signUp({ email: $('cloud-email').value.trim(), password: password.value, options: { emailRedirectTo: new URL('login/', document.baseURI).href } });
          if (error) throw error;
          password.value = ''; confirmation.value = '';
          if (!data.session) $('cloud-status').textContent = uiText('Buka email untuk konfirmasi akun, lalu masuk.', 'Check your email to confirm your account, then sign in.');
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
          if (!response.ok) throw new Error(uiText('Tidak dapat memeriksa login Google. Coba lagi.', 'Unable to check Google sign-in. Try again.'));
          const config = await response.json();
          if (!config.external?.google) throw new Error(uiText('Login Google sedang menunggu konfigurasi akun. Gunakan email untuk saat ini.', 'Google sign-in is awaiting account setup. Please use email for now.'));
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
        input.setCustomValidity(name.length >= 2 ? '' : (uiText('Isi sedikitnya 2 karakter.', 'Enter at least 2 characters.')));
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
          const userId = cloudUser.id, revision = cloudAuthRevision;
          clearTimeout(cloudTimer);
          (async () => {
            while (cloudBusy) await new Promise(resolve => setTimeout(resolve, 50));
            if (cloudUser?.id !== userId || cloudAuthRevision !== revision) return;
            if (cloudReady && nicknameReady && !await syncCloud()) return;
            if (cloudUser?.id !== userId || cloudAuthRevision !== revision) return;
            const { error } = await cloudClient.auth.signOut();
            if (cloudUser && (cloudUser.id !== userId || cloudAuthRevision !== revision)) return;
            if (error) { $('cloud-status').textContent = cloudMessage(error); return; }
            if (cloudUser) handleCloudSignedOut();
            closeNavAccountDropdown();
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
          $(plan + '-period').textContent = annual ? uiText('USD / tahun', 'USD / year') : uiText('USD / bulan', 'USD / month');
          $(plan + '-billing').textContent = annual ? uiText('Ditagih tahunan · Hemat 17%', 'Billed annually · Save 17%') : uiText('Ditagih bulanan', 'Billed monthly');
        });
      }

      window.scrollToPricing = function () {
        const el = $('pricing-section');
        if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
          alert(uiText("Mohon lengkapi Market, Entry, Stop Loss, dan Take Profit.", "Complete the market, entry, stop loss and take profit fields."));
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
          alert(uiText("Tempel baris trade Anda terlebih dahulu.", "Paste your trade rows first."));
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
          alert(uiText('Tersimpan {total} baris trade.', 'Saved {total} trade rows.').replace('{total}', count));
        } else {
          alert(uiText("Format baris tidak sesuai. Pastikan menggunakan pemisah pipa (|).", "Invalid row format. Separate the values with a pipe (|)."));
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
          alert(uiText("Mohon isi Market, Entry, Stop Loss, dan Take Profit.", "Complete the market, entry, stop loss and take profit fields."));
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
        $('btn-save-full').textContent = uiText("Perbarui Trade", "Update trade");
      };

      window.deleteTrade = function (id) {
        if (confirm(uiText("Hapus trade ini dari jurnal?", "Delete this trade from the journal?"))) {
          trades = trades.filter(t => t.id !== id);
          saveData();
          renderJournalTable();
        }
      };

      function updateFilterOptions() {
        const accountTrades = trades.filter(t => t.accountId === profile.currentAccount);
        const marketSel = $('filter-market');
        if (marketSel) {
          const curVal = marketSel.value;
          const uniqueMarkets = [...new Set(accountTrades.map(t => (t.market || '').toString().trim().toUpperCase()).filter(Boolean))].sort();
          const currentOpts = Array.from(marketSel.options).map(o => o.value).filter(Boolean);
          const isSame = uniqueMarkets.length === currentOpts.length && uniqueMarkets.every((m, i) => m === currentOpts[i]);
          if (!isSame) {
            marketSel.innerHTML = '<option value="">' + esc(window.JTI18n?.key('journalAllMarkets', 'All markets') || (language === 'en' ? 'All markets' : 'Semua Market')) + '</option>' +
              uniqueMarkets.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
            marketSel.value = curVal;
          }
          if (marketSel.options[0]) marketSel.options[0].textContent = window.JTI18n?.key('journalAllMarkets', 'All markets') || (language === 'en' ? 'All markets' : 'Semua Market');
        }

        const stratSel = $('filter-strategy');
        if (stratSel) {
          const curVal = stratSel.value;
          const uniqueStrats = [...new Set(accountTrades.map(t => (t.strategy || '').toString().trim()).filter(Boolean))].sort();
          const currentOpts = Array.from(stratSel.options).map(o => o.value).filter(Boolean);
          const isSame = uniqueStrats.length === currentOpts.length && uniqueStrats.every((s, i) => s === currentOpts[i]);
          if (!isSame) {
            stratSel.innerHTML = '<option value="">' + esc(window.JTI18n?.key('journalAllStrategies', 'All strategies') || (language === 'en' ? 'All strategies' : 'Semua Strategi')) + '</option>' +
              uniqueStrats.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
            stratSel.value = curVal;
          }
          if (stratSel.options[0]) stratSel.options[0].textContent = window.JTI18n?.key('journalAllStrategies', 'All strategies') || (language === 'en' ? 'All strategies' : 'Semua Strategi');
        }
      }

      window.resetJournalFilters = function () {
        journalProFilter = null;
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

        const accountTrades = trades.filter(t => t.accountId === profile.currentAccount);
        let jWins = 0, jLoss = 0, jBE = 0;
        let jNetUSD = 0, jWinUSD = 0, jLossUSD = 0;
        let jTotalRR = 0, jRRCount = 0;

        accountTrades.forEach(t => {
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

        const jTotal = accountTrades.length;
        const jWinRate = jTotal ? ((jWins / jTotal) * 100) : 0;
        const jPF = jLossUSD > 0 ? (jWinUSD / jLossUSD) : (jWinUSD > 0 ? Infinity : 0);
        const jAvgRR = jRRCount ? (jTotalRR / jRRCount) : null;

        if ($('j-stat-total')) $('j-stat-total').textContent = jTotal.toLocaleString(language);
        if ($('j-stat-winrate')) {
          $('j-stat-winrate').textContent = `${jWinRate.toFixed(1)}%`;
          $('j-stat-winrate').style.color = jWinRate >= 50 ? 'var(--green)' : 'var(--red)';
        }
        if ($('j-stat-wincount')) $('j-stat-wincount').textContent = (window.JTI18n?.key('journalResults', '{wins} Win · {losses} Loss · {breakeven} BE') || '{wins} Win · {losses} Loss · {breakeven} BE').replace('{wins}', jWins).replace('{losses}', jLoss).replace('{breakeven}', jBE);
        [['j-bar-win', jWins], ['j-bar-loss', jLoss], ['j-bar-be', jBE]].forEach(([id, count]) => {
          if ($(id)) { $(id).style.flexGrow = count; $(id).hidden = count === 0; }
        });
        if ($('j-stat-netpl')) {
          $('j-stat-netpl').textContent = fmtPLUSD(jNetUSD);
          $('j-stat-netpl').style.color = jNetUSD >= 0 ? 'var(--green)' : 'var(--red)';
        }
        if ($('j-stat-idr')) {
          $('j-stat-idr').textContent = fmtPLIDR(jNetUSD * (settings.kurs || 17000));
          $('j-stat-idr').style.color = 'var(--text-muted)';
        }
        if ($('j-stat-pf')) $('j-stat-pf').textContent = Number.isFinite(jPF) ? jPF.toFixed(2) : '∞';
        if ($('j-stat-rr')) $('j-stat-rr').textContent = jAvgRR===null?'-':`1 : ${jAvgRR.toFixed(2)}`;

        const fMarket = (($('filter-market') && $('filter-market').value) || '').trim().toUpperCase();
        const fResult = (($('filter-result') && $('filter-result').value) || '').trim().toLowerCase();
        const fStrategy = (($('filter-strategy') && $('filter-strategy').value) || '').trim().toLowerCase();
        const fSearch = (($('filter-search') && $('filter-search').value) || '').trim().toLowerCase();
        ['all', 'win', 'loss', 'be'].forEach(result => {
          const chip = $('chip-filter-' + result);
          const active = result === 'all' ? !fResult : result === fResult;
          if (chip) { chip.classList.toggle('active', active); chip.setAttribute('aria-pressed', String(active)); }
        });

        const filtered = accountTrades.filter(t => {
          if (journalProFilter?.ids && !journalProFilter.ids.has(t.id)) return false;
          if (journalProFilter?.date && t.date !== journalProFilter.date) return false;
          if (journalProFilter?.from && t.date < journalProFilter.from) return false;
          if (journalProFilter?.to && t.date > journalProFilter.to) return false;
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
        if ($('journal-row-count')) $('journal-row-count').textContent = (window.JTI18n?.key('journalRows', 'Showing {shown} of {total} positions') || (language === 'en' ? 'Showing {shown} of {total} positions' : 'Menampilkan {shown} dari {total} posisi')).replace('{shown}', filtered.length).replace('{total}', jTotal);

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
              <td><div class="journal-cell-stack"><span>${esc(t.date || '-')}</span><small>${esc(t.jam || '-')}</small></div></td>
              <td><button type="button" class="btn-market-link" onclick="openTradingView('${marketName}')" title="${esc((window.JTI18n?.key('journalChartTitle', 'Open {market} chart in TradingView') || 'Open {market} chart in TradingView').replace('{market}', marketName))}"><b>${marketName}</b></button></td>
              <td><span class="pos-badge ${posClass}">${esc(pos.toLowerCase() === 'buy' ? uiText('Beli', 'Buy') : pos.toLowerCase() === 'sell' ? uiText('Jual', 'Sell') : pos)}</span></td>
              <td>${esc(t.entry ?? '-')}</td>
              <td style="color:var(--red);">${esc(t.sl ?? '-')}</td>
              <td style="color:var(--green);">${esc(t.tp ?? '-')}</td>
              <td>${esc(t.vol ?? '-')}</td>
              <td><div class="journal-cell-stack"><span>${m.riskUSD===null?'-':fmtUSD(m.riskUSD)}</span><small>${t.riskPct===null?'-':esc(t.riskPct ?? 1)+'%'}</small></div></td>
              <td>${m.rr===null?'-':(m.rr || 0).toFixed(2)}</td>
              <td><span class="${resClass}">${esc(window.JTI18n?.key(resLower === 'win' ? 'journalWin' : resLower === 'loss' ? 'journalLoss' : 'journalBreakEven', resVal) || resVal)}</span></td>
              <td><div class="journal-cell-stack"><span class="${pnlClass}">${fmtPLUSD(m.pnlUSD)}</span><small>${fmtPLIDR(m.pnlIDR)}</small></div></td>
              <td class="journal-strategy">${t.reason ? `<details><summary>${esc(t.strategy || '-')}</summary><p>${esc(t.reason)}</p></details>` : esc(t.strategy || '-')}</td>
              <td><div class="journal-row-actions">
                <button class="btn btn-ghost btn-sm" type="button" onclick="editTrade('${tradeId}')">${esc(window.JTI18n?.key('journalEdit', 'Edit') || 'Edit')}</button>
                <button class="btn btn-danger btn-sm" type="button" onclick="deleteTrade('${tradeId}')">${esc(window.JTI18n?.key('journalDelete', 'Delete') || (language === 'en' ? 'Delete' : 'Hapus'))}</button>
              </div></td>
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
        $('upload-status-msg').textContent = uiText("Pilih berkas dari perangkat Anda atau seret ke area dropzone di atas.", "Choose a file from your device or drag it into the area above.");
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
        gatewayImportFile = null; gatewayImportPending = null;
        parsedTradesToImport = [];
        currentScan = null;
        $('upload-preview-area').style.display = 'none';
        $('btn-confirm-import').style.display = 'none';
        $('scan-result').hidden = true;

        // Strict 10 MB upload limit check
        const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
        if (file.size > MAX_SIZE_BYTES) {
          const actualMB = (file.size / (1024 * 1024)).toFixed(2);
          status.textContent = uiText('Ukuran file ({size} MB) melebihi batas 10 MB. Gunakan dokumen yang lebih kecil atau kompres file.', 'File size ({size} MB) exceeds the 10 MB limit. Use a smaller document or compress the file.').replace('{size}', actualMB);
          $('btn-confirm-import').style.display = 'none';
          $('upload-preview-area').style.display = 'none';
          return;
        }

        status.textContent = `${uiText('Membaca', 'Reading')} ${file.name} (${formatFileSize(file.size)})…`;
        const ext = file.name.split('.').pop().toLowerCase();
        parsedTradesToImport = [];

        try {
          if (!['pdf', 'png', 'jpg', 'jpeg', 'txt', 'csv'].includes(ext)) throw new Error(uiText('Gunakan PDF, PNG, JPG, TXT, atau CSV.', 'Use PDF, PNG, JPG, TXT, or CSV.'));
          if (window.JTPRO_CONFIG?.apiBase) {
            await refreshAccountAccess(false);
            const types = {pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',csv:'text/csv',txt:'text/plain'};
            const stored = await window.JTPRO.request('/imports/files', {method:'POST',body:file,rawBody:true,contentType:types[ext]});
            if (job !== scanJob) return;
            if (!stored?.private || !/^[a-f0-9]{64}$/.test(stored.file_sha256) || typeof stored.storage_path !== 'string') throw new Error('Invalid private upload response.');
            gatewayImportFile = {...stored, owner:cloudUser?.id};
          } else await refreshAccountAccess(true);
          if (job !== scanJob) return;
          if (ext === 'txt' || ext === 'csv') {
            const text = await file.text();
            if (job === scanJob && window.JTPRO_CONFIG?.apiBase) {
              parsedTradesToImport = window.JTPRO_IMPORT.parse(text, profile.currentAccount);
              showUploadPreview(parsedTradesToImport);
              status.textContent = 'Review the recorded values before importing. Date/time columns use Asia/Jakarta; missing prices, position sizes and profit remain unknown.';
            } else if (job === scanJob) parseTextOrCSV(text);
            return;
          }
          if (!['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
            throw new Error(uiText("Gunakan PDF, PNG, JPG, TXT, atau CSV. Untuk Excel, ekspor ke CSV terlebih dahulu.", "Use PDF, PNG, JPG, TXT or CSV. Export Excel files to CSV first."));
          }
          const pages = ext === 'pdf' ? await scanPDF(file, job) : [await recognizeImage(file, job)];
          const text = pages.map((page, index) => (ext === 'pdf' ? `[Halaman ${index + 1}]\n` : '') + page.text.trim()).join('\n\n');
          if (job !== scanJob) return;
          if (!text.trim()) throw new Error(uiText("Tidak ada teks terbaca. Coba berkas yang lebih jelas atau salin teks secara manual.", "No readable text found. Try a clearer file or paste the text manually."));
          currentScan = { name: file.name, text: text.trim(), recognition: analyzeTradeScan(pages), status: 'ready', scannedAt: new Date().toISOString() };
          showScan(currentScan);
          status.textContent = uiText("Pemindaian selesai. Periksa teks sebelum menyimpan hasil scan. Tidak ada trade yang ditambahkan.", "Scan complete. Review the text before saving. No trades have been added.");
          applyLanguage();
        } catch (error) {
          if (job === scanJob) status.textContent = (uiText('Pemindaian gagal: ', 'Scan failed: ')) + error.message;
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
            $('upload-status-msg').textContent = `${uiText('Mengenali teks', 'Recognizing text')} ${Math.round(progress.progress * 100)}%…`;
          }
        } });
        let bitmap;
        try {
          bitmap = await createImageBitmap(source);
          if (bitmap.width*bitmap.height>12000000 || Math.max(bitmap.width,bitmap.height)>10000) throw new Error(uiText("Gambar terlalu besar untuk OCR. Gunakan gambar maksimal 12 megapiksel.", "Image too large for OCR. Use an image of up to 12 megapixels."));
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
            $('upload-status-msg').textContent = `${uiText('Membaca halaman', 'Reading page')} ${n}/${pdf.numPages}…`;
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
        $('btn-import-scan').textContent=uiText('Masukkan {total} transaksi ke jurnal', 'Add {total} trades to journal').replace('{total}', candidates.length);
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
          if (window.JTPRO_CONFIG?.apiBase && currency !== account.currency) {
            $('upload-status-msg').textContent = 'Choose a trading account with the same currency as the document’s recorded profit.';
            return;
          }
          const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(account.id+'\n'+scan.text));
          const scanSource=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
          if (scan!==currentScan)return;
          if(trades.some(trade=>trade.scanSource===scanSource)) {
            $('upload-status-msg').textContent=uiText('Hasil scan ini sudah ada di jurnal.', 'This scan is already in the journal.');
            return;
          }
          const imported=rows.map(row=>({id:'t_'+crypto.randomUUID(),accountId:account.id,date:row.date,jam:row.time,
            market:row.market,posisi:row.direction,entry:row.entry,exit:row.exit,sl:null,tp:null,vol:row.volume,riskPct:null,
            result:row.profit>0?'Win':row.profit<0?'Loss':'BE',actualPnl:row.profit,pnlCurrency:currency,
            strategy:'Impor screenshot',tf:'',scanSource,
            reason:`${scan.name} · Exit ${row.exit} · Profit ${row.profit} ${currency} · SL/TP dan risiko belum diketahui.`}));
          if (window.JTPRO_CONFIG?.apiBase) {
            parsedTradesToImport = imported;
            showUploadPreview(imported);
            $('upload-status-msg').textContent = 'Review the extracted records, then confirm the private import. Only a successful saved import uses your allowance.';
            return;
          }
          const next=[...imported,...trades];
          trades=next;
          saveData();
          closeUploadModal();
          switchTab('jurnal');
          resetJournalFilters();
        } catch(error) {
          $('upload-status-msg').textContent=uiText('Impor gagal. Hasil scan tetap tersedia; periksa penyimpanan dan coba lagi.', 'Import failed. Keep your scan and try again.');
        } finally { button.disabled=false; }
      };

      function renderScanRecognition(recognition) {
        const container=$('scan-recognition');
        container.replaceChildren();
        if (!recognition?.records?.length) {
          container.textContent=uiText('Format transaksi belum dikenali. Teks yang terbaca tetap tersedia di bawah.', 'No supported trade layout detected. The readable text is available below.');
          return;
        }
        const heading=document.createElement('h4');
        heading.textContent=uiText('Informasi dikenali otomatis', 'Automatically detected information');
        container.appendChild(heading);
        const value=v=>v===null||v===undefined?'-':String(v);
        for (const kind of ['history','chart']) {
          const rows=recognition.records.filter(r=>r.kind===kind);
          if(!rows.length)continue;
          const title=document.createElement('p');
          title.textContent=(kind==='history' ? uiText('Riwayat posisi · {total} baris', 'Position history · {total} rows') : uiText('Setup chart · {total} setup', 'Chart analysis · {total} setups')).replace('{total}', rows.length);
          container.appendChild(title);
          const wrap=document.createElement('div');wrap.className='scan-table-wrap';wrap.tabIndex=0;
          wrap.setAttribute('role','region');wrap.setAttribute('aria-label',title.textContent);
          const table=document.createElement('table');table.className='trade-table';
          const columns=kind==='history'?[['market','Market'],['direction','Posisi'],['volume','Lot'],['date','Tanggal'],['time','Waktu'],['entry','Entry'],['exit','Exit'],['profit','Profit*'],['result','Hasil']]:
            [['market','Market'],['direction','Posisi'],['entry','Entry'],['sl','SL'],['tp','TP'],['stopDistance',uiText("Jarak stop", "Stop distance")],['targetDistance',uiText("Jarak target", "Target distance")],['rr','R:R'],['quantity',uiText("Qty alat", "Tool quantity")],['toolPnl',uiText("PnL alat", "Tool PnL")]];
          table.innerHTML='<thead><tr>'+columns.map(c=>`<th>${esc(uiText(c[1], ({Posisi:'Side',Tanggal:'Date',Waktu:'Time',Hasil:'Outcome'})[c[1]] || c[1]))}</th>`).join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+columns.map(c=>`<td>${esc(value(row[c[0]]))}</td>`).join('')+'</tr>').join('')+'</tbody>';
          wrap.appendChild(table);container.appendChild(wrap);
          for(const row of rows)if(row.notes?.length){const note=document.createElement('p');note.textContent=`${row.market||'Chart'}: ${row.notes.join(' ')}`;container.appendChild(note);}
        }
        const warnings=document.createElement('p');
        warnings.textContent=recognition.warnings.join(' ')+uiText(" - berarti belum terbaca. ", " - indicates an unreadable value. ")+(recognition.records.some(r=>r.kind==='history')?uiText("*Profit mengikuti screenshot, mata uang belum diketahui. ", "*Profit matches the screenshot; the currency is unknown. "):'')+uiText("Periksa hasil OCR sebelum menyimpan. Jurnal tidak diubah otomatis.", "Review OCR results before saving. The journal is not changed automatically.");
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
            $('upload-status-msg').textContent = uiText("Hasil scan tersimpan di perangkat ini.", "Scan results are saved on this device.");
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
          $('upload-status-msg').textContent = uiText("Hasil scan disimpan di perangkat ini. Jurnal Anda tidak berubah.", "Scan results saved on this device. Your journal is unchanged.");
        } catch {
          $('upload-status-msg').textContent = uiText("Penyimpanan penuh. Salin teks hasil scan sebelum menutup jendela.", "Storage full. Copy the scan text before closing this window.");
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
          $('upload-status-msg').textContent = uiText('Terbaca {total} entri trade dari berkas.', 'Read {total} trade entries from the file.').replace('{total}', parsed.length);
        } else {
          $('upload-status-msg').textContent = uiText('Tidak ada baris trade yang valid. Pastikan ada kolom Market, Entry, dan Stop Loss.', 'No valid trade rows found. Include Market, Entry and Stop Loss columns.');
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
        btn.textContent = uiText('Impor {total} trade ke jurnal', 'Import {total} trades into journal').replace('{total}', list.length);
      }

      window.confirmParsedImport = async function () {
        if (!parsedTradesToImport.length) return;
        if (window.JTPRO_CONFIG?.apiBase) return confirmGatewayImport();
        trades = [...parsedTradesToImport, ...trades];
        saveData();
        closeUploadModal();
        renderJournalTable();
        alert(uiText('{total} trade ditambahkan ke jurnal.', '{total} trades added to journal.').replace('{total}', parsedTradesToImport.length));
      };

      async function confirmGatewayImport() {
        if (gatewayImportBusy) return;
        const owner = cloudUser?.id, job = scanJob, button = $('btn-confirm-import'), status = $('upload-status-msg');
        const valid = () => owner && cloudUser?.id === owner && cloudReady && job === scanJob;
        gatewayImportBusy = true; button.disabled = true;
        try {
          if (!valid() || gatewayImportFile?.owner !== owner) throw new Error('Upload the source file to your private account before importing.');
          if (!gatewayImportPending) {
            if (!await syncCloud() || !valid()) throw new Error('Wait for your journal to finish saving, then try again.');
            const names = [...new Set(parsedTradesToImport.map(t => String(t.strategy || '').trim()).filter(Boolean))];
            if (names.length) {
              const rows = names.map(name => ({id:uuidFor(cloudStrategyIds,name),user_id:owner,name}));
              const saved = await cloudClient.from('strategies').upsert(rows,{onConflict:'id'});
              if (!valid()) return;
              if (saved.error) throw saved.error;
            }
            const rows = parsedTradesToImport.map(t => {
              const accountId = cloudAccountIds.get(t.accountId);
              if (!accountId) throw new Error('Choose a saved trading account.');
              return {id:crypto.randomUUID(),account_id:accountId,strategy_id:t.strategy ? cloudStrategyIds.get(String(t.strategy).trim()) || null : null,
                symbol:t.market,market:t.market,side:/^(sell|short)$/i.test(t.posisi)?'short':'long',opened_at:t.openedAt || tradeTimestamp(t.date,t.jam),
                entry_price:decimalOrNull(t.entry),exit_price:decimalOrNull(t.exit),stop_loss:decimalOrNull(t.sl),take_profit:decimalOrNull(t.tp),
                quantity:decimalOrNull(t.vol),pnl:decimalOrNull(t.actualPnl),risk_percent:decimalOrNull(t.riskPct),notes:[t.reason,t.tf ? `TF: ${t.tf}` : '',t.result ? `Result: ${t.result}` : ''].filter(Boolean).join(' · ') || null};
            });
            gatewayImportPending = {key:crypto.randomUUID(),body:{trades:rows,confirmed:true,file_sha256:gatewayImportFile.file_sha256,storage_path:gatewayImportFile.storage_path}};
          }
          status.textContent = 'Saving confirmed trades to your account…';
          const created = await window.JTPRO.request('/imports',{method:'POST',headers:{'Idempotency-Key':gatewayImportPending.key},body:gatewayImportPending.body});
          if (!valid()) return;
          let result = created;
          const deadline = Date.now() + 300000;
          while (['queued','running'].includes(result.status)) {
            if (Date.now() >= deadline) throw new Error('The import is still processing. Try again to check the same job; duplicate trades will not be submitted.');
            await new Promise(resolve => setTimeout(resolve,1500));
            if (!valid()) return;
            result = await window.JTPRO.request('/jobs/'+encodeURIComponent(created.id));
            if (!valid()) return;
          }
          if (result.status !== 'succeeded') throw new Error(result.error || 'Import could not be completed. No successful-import allowance was charged.');
          gatewayImportPending = null; gatewayImportFile = null;
          status.textContent = 'Import saved. Reloading your journal…';
          await hydrateCloud(cloudUser);
          if (cloudUser?.id !== owner) return;
          closeUploadModal(); renderJournalTable();
        } catch (error) { if (valid()) status.textContent = error.message; }
        finally { gatewayImportBusy = false; if (valid()) button.disabled = false; }
      }

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
        const kpiCurves = { winrate:[0], netpl:[0], profitFactor:[0], averageRR:[0] };

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
          const countedTrades = wins + losses + bes;
          kpiCurves.winrate.push(countedTrades ? wins / countedTrades * 100 : 0);
          kpiCurves.netpl.push(sumWinUSD - sumLossUSD);
          kpiCurves.profitFactor.push(sumLossUSD ? sumWinUSD / sumLossUSD : sumWinUSD ? 99 : 0);
          kpiCurves.averageRR.push(rrCount ? totalRR / rrCount : 0);
          const dd = peakBalance - currentBalance;
          if (dd > maxDrawdownUSD) {
            maxDrawdownUSD = dd;
          }
        });

        const totalTrades = chronological.length;
        const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
        const netPL = sumWinUSD - sumLossUSD;
        const profitFactor = sumLossUSD > 0 ? (sumWinUSD / sumLossUSD) : (sumWinUSD > 0 ? Infinity : 0);
        const avgRR = rrCount ? (totalRR / rrCount) : null;
        const expectancy = totalTrades ? (netPL / totalTrades) : 0;

        // Populate KPI Cards
        $('kpi-winrate').textContent = winRate.toFixed(1) + '%';
        $('kpi-win-count').textContent = window.JTI18n?.key('journalResults', '{wins} Win · {losses} Loss · {breakeven} BE', {wins,losses,breakeven:bes}) || `${wins} Win · ${losses} Loss · ${bes} BE`;
        $('kpi-winrate-delta').className = `kpi-delta ${winRate >= 50 ? 'pos' : 'neg'}`;
        $('kpi-winrate-delta').textContent = winRate >= 50 ? uiText("Win Rate Kuat", "Win rate above 50%") : uiText("Perlu Evaluasi", "Review your results");

        $('kpi-netpl').textContent = fmtPLUSD(netPL);
        $('kpi-netpl').style.color = netPL >= 0 ? 'var(--green)' : 'var(--red)';
        $('kpi-netpl-idr').textContent = fmtPLIDR(netPL * settings.kurs);
        $('kpi-netpl-delta').textContent = startBal > 0 ? ((netPL / startBal) * 100).toFixed(1) + (uiText('% Saldo', '% balance')) : (uiText('Tambahkan saldo awal', 'Add a starting balance'));
        $('kpi-netpl-delta').className = `kpi-delta ${netPL >= 0 ? 'pos' : 'neg'}`;

        $('kpi-pf').textContent = Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : '∞';
        $('kpi-total-trades').textContent = uiText('{total} transaksi', '{total} trades').replace('{total}', totalTrades);

        $('kpi-max-dd').textContent = 'DD: -' + fmtUSD(maxDrawdownUSD);
        $('kpi-avg-rr').textContent = avgRR===null?'-':avgRR.toFixed(2) + 'R';
        $('kpi-expectancy').textContent = `Exp: ${fmtPLUSD(expectancy)}`;

        // Performance Matrix
        if ($('stat-best-win')) $('stat-best-win').textContent = '+' + fmtUSD(bestWinUSD);
        if ($('stat-worst-loss')) $('stat-worst-loss').textContent = '-' + fmtUSD(worstLossUSD);
        if ($('stat-win-streak')) $('stat-win-streak').textContent = uiText('{total} beruntun', '{total} consecutive').replace('{total}', maxWinStreak);
        if ($('stat-max-dd-val')) $('stat-max-dd-val').textContent = '-' + fmtUSD(maxDrawdownUSD);
        if ($('stat-account-pill') && acc) $('stat-account-pill').textContent = `${acc.broker} (${acc.name})`;

        // Donut Breakdown percentages
        if ($('ds-win-pct')) $('ds-win-pct').textContent = totalTrades ? `${((wins / totalTrades) * 100).toFixed(0)}% (${wins})` : '0%';
        if ($('ds-loss-pct')) $('ds-loss-pct').textContent = totalTrades ? `${((losses / totalTrades) * 100).toFixed(0)}% (${losses})` : '0%';
        if ($('ds-be-pct')) $('ds-be-pct').textContent = totalTrades ? `${((bes / totalTrades) * 100).toFixed(0)}% (${bes})` : '0%';

        const report = disciplineMetrics(chronological);
        $('discipline-status').textContent = report.total ? uiText('{total} transaksi', '{total} trades').replace('{total}', report.total) : uiText("Belum ada trade", "No trades yet");
        $('discipline-sl').textContent = report.total ? report.slPct.toFixed(0) + (uiText('% tercatat', '% recorded')) : uiText("Belum ada data", "No data yet");
        $('discipline-sl-bar').style.width = report.slPct + '%';
        $('discipline-risk').textContent = report.riskCount ? report.avgRisk.toFixed(2) + '% (' + report.riskCount + '/' + report.total + ' trade)' : uiText("Belum ada data risiko", "No risk data yet");
        $('discipline-dd').textContent = report.total && startBal > 0 ? (maxDrawdownUSD / startBal * 100).toFixed(2) + (uiText('% dari saldo awal', '% of starting balance')) : uiText("Saldo awal dan transaksi diperlukan", "Starting balance and trades are required");
        $('discipline-summary').textContent = report.total ? uiText("Dihitung dari jurnal akun aktif. SL tercatat tidak memastikan pemasangan di broker; kondisi psikologi belum dicatat.", "Calculated from the active account journal. A recorded stop loss does not confirm a broker order; psychological conditions are not recorded.") : uiText("Tambahkan transaksi untuk melihat rapor akun ini.", "Add trades to see this account review.");

        // Draw SVG Charts
        drawKpiSparklines(kpiCurves);
        drawEquityCurveSVG(equityCurve);
        drawDonutChartSVG(wins, losses, bes, totalTrades);
        drawBreakdownBars();
      }

      function drawKpiSparklines(curve) {
        document.querySelectorAll('[data-equity-spark]').forEach(svg => {
          const values = curve[svg.dataset.equitySpark] || [];
          if (!values.length) { svg.replaceChildren(); return; }
          const w = 120, h = 36, pad = 2;
          let min = Math.min(...values), max = Math.max(...values);
          if (min === max) { const padValue = Math.abs(min) * 0.03 || 1; min -= padValue; max += padValue; }
          const points = values.map((value, index) => {
            const x = values.length === 1 ? w / 2 : pad + index * (w - pad * 2) / (values.length - 1);
            const y = h - pad - (value - min) / (max - min) * (h - pad * 2);
            return [x, y];
          });
          const path = values.length === 1 ? 'M0,18 L120,18' : points.map((point, index) => (index ? 'L' : 'M') + point[0].toFixed(1) + ',' + point[1].toFixed(1)).join(' ');
          const stroke = values[values.length - 1] < values[0] ? 'var(--red)' : 'var(--green)';
          const fill = values.length > 1 && max !== min ? `<path d="${path} L${points.at(-1)[0]},${h} L${points[0][0]},${h} Z" fill="${stroke}" opacity=".10"/>` : '';
          svg.innerHTML = fill + `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
        });
      }

      function drawEquityCurveSVG(curve) {
        const svg = $('equity-chart-svg');
        if (!svg) return;
        const w = 800, h = 200, pad = 20;

        if (curve.length < 2) {
          svg.innerHTML = `<line x1="0" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="var(--line)"/><text x="400" y="105" text-anchor="middle" fill="#64748b" font-size="12">${esc(uiText('Belum ada data eksekusi', 'No execution data yet.'))}</text>`;
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
          svg.innerHTML = `<text x="160" y="100" text-anchor="middle" fill="#64748b" font-size="13">${esc(uiText('Belum ada trade', 'No trades yet.'))}</text>`;
          return;
        }

        const cx = 90, cy = 100, r = 58, rIn = 36;
        const data = [
          { label: uiText('Menang', 'Win'), val: w, color: '#10b981' },
          { label: uiText('Rugi', 'Loss'), val: l, color: '#f43f5e' },
          { label: uiText('Impas', 'Break even'), val: b, color: '#64748b' }
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
            <text x="16" y="9" font-size="12" fill="#cbd5e1">${esc(d.label)}: ${d.val} (${((d.val / total) * 100).toFixed(0)}%)</text>
          </g>
        `).join('');

        svg.innerHTML = paths + `
          <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="20" font-weight="700" fill="#ffffff" font-family="monospace">${total}</text>
          <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="9" fill="#8492a6" font-family="sans-serif">${esc(uiText('Transaksi', 'Trades'))}</text>
        ` + legend;
      }

      function drawBreakdownBars() {
        const stratMap = {};
        const marketMap = {};

        trades.forEach(t => {
          const m = computeTradeMetrics(t);
          const s = t.strategy || uiText('Tanpa kategori', 'Uncategorized');
          const p = t.market || uiText('Lainnya', 'Other');
          stratMap[s] = (stratMap[s] || 0) + m.pnlUSD;
          marketMap[p] = (marketMap[p] || 0) + m.pnlUSD;
        });

        const renderBarGroup = (map, containerId) => {
          const c = $(containerId);
          if (!c) return;
          const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
          if (!entries.length) {
            c.innerHTML = `<span style="color:var(--text-muted); font-size:12px;">${esc(uiText('Belum ada data', 'No data yet.'))}</span>`;
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
      function googleAccountProfile() {
        const user = cloudUser;
        if (!user || (user.app_metadata?.provider !== 'google' && !user.identities?.some(identity => identity.provider === 'google'))) return null;
        const metadata = { ...(user.identities?.find(identity => identity.provider === 'google')?.identity_data || {}), ...(user.user_metadata || {}) };
        let avatar = metadata.avatar_url || metadata.picture || '';
        try {
          const url = new URL(avatar);
          if (url.protocol !== 'https:' || !(url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))) avatar = '';
        } catch { avatar = ''; }
        return { name: String(metadata.full_name || metadata.name || '').trim(), email: user.email || metadata.email || '', avatar };
      }

      window.renderProfileView = function () {
        $('p-trader-name').value = profile.name || 'Trader';
        $('p-kurs-input').value = settings.kurs || 17000;

        // Trader Passport Card updates
        const google = googleAccountProfile();
        const traderName = google?.name || profile.name || 'Trader';
        $('profile-google-manage').hidden = !google;
        $('p-account-email').value = cloudUser?.email || '';
        $('p-account-email').placeholder = uiText('Belum masuk', 'Not signed in');
        $('p-account-note').textContent = google ? (uiText('Dikelola oleh akun Google Anda.', 'Managed by your Google account.')) : cloudUser ? (uiText('Email yang digunakan untuk masuk.', 'Email used to sign in.')) : (uiText('Masuk untuk menyimpan jurnal ke server.', 'Sign in to save your journal to the server.'));
        $('profile-signin-method').textContent = google ? 'Google' : cloudUser ? 'Email' : (uiText('Profil lokal', 'Local profile'));
        $('profile-storage-method').textContent = cloudUser ? (uiText('Server + salinan browser', 'Server + browser copy')) : (uiText('Browser ini', 'This browser'));
        $('profile-account-summary').textContent = cloudUser?.email || (uiText('Anda menggunakan profil lokal.', 'You are using a local profile.'));
        $('profile-sync-status').textContent = cloudUser ? ($('cloud-status')?.textContent || (uiText('Perubahan jurnal otomatis disimpan ke server.', 'Journal changes are saved to the server automatically.'))) : (uiText('Data jurnal tersimpan di browser ini. Ekspor backup untuk menyimpan salinannya.', 'Journal data stays in this browser. Export a backup to keep a copy.'));
        if ($('tpc-display-name')) $('tpc-display-name').textContent = google?.name || traderName;
        if ($('tpc-google-email')) { $('tpc-google-email').hidden = !google?.email; $('tpc-google-email').textContent = google?.email || ''; }
        if ($('tpc-account-provider')) $('tpc-account-provider').textContent = google ? (uiText('Akun Google', 'Google account')) : cloudUser ? (uiText('Akun server', 'Server account')) : (uiText('Profil lokal', 'Local profile'));
        if ($('tpc-profile-alias')) { $('tpc-profile-alias').hidden = !google || !profile.name || profile.name === google.name; $('tpc-profile-alias').textContent = google && profile.name && profile.name !== google.name ? (uiText('Nama panggilan: ', 'Nickname: ')) + profile.name : ''; }
        const avatar = $('tpc-google-avatar');
        if (avatar) { avatar.hidden = !google?.avatar; avatar.onerror = () => { avatar.hidden = true; }; if (google?.avatar && avatar.src !== google.avatar) avatar.src = google.avatar; if (!google?.avatar) avatar.removeAttribute('src'); }
        if ($('tpc-avatar-initials')) {
          const initials = traderName.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() || 'TR';
          $('tpc-avatar-initials').textContent = initials;
        }

        const curAcc = currentAccount();
        if ($('tpc-sub-status') && curAcc) {
          $('tpc-sub-status').textContent = `${uiText('Jurnal aktif', 'Active journal')}: ${curAcc.broker} · ${curAcc.name}`;
        }
        if (!curAcc) $('tpc-sub-status').textContent = uiText('Tambah akun trading untuk memulai jurnal.', 'Add a trading account to start your journal.');

        const wins = trades.filter(t => t.result === 'Win').length;
        const totalTrades = trades.length;
        const wr = totalTrades ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';
        if ($('tpc-winrate')) $('tpc-winrate').textContent = wr + '%';
        if ($('tpc-total-trades')) $('tpc-total-trades').textContent = String(totalTrades);
        const metrics = trades.map(t => computeTradeMetrics(t, accounts.find(a => a.id === t.accountId)));
        const pnl = metrics.reduce((sum, metric) => sum + metric.pnlUSD, 0);
        const rr = metrics.map(metric => metric.rr).filter(Number.isFinite);
        $('tpc-net-pl').textContent = fmtPLUSD(pnl);
        $('tpc-net-pl').style.color = pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text-main)';
        $('tpc-average-rr').textContent = rr.length ? (rr.reduce((sum, value) => sum + value, 0) / rr.length).toFixed(2) : '—';

        // Storage Vault status calculation
        try {
          const totalBytes = (localStorage.getItem(K_ACCOUNTS) || '').length +
                             (localStorage.getItem(K_TRADES) || '').length +
                             (localStorage.getItem(K_SETTINGS) || '').length +
                             (localStorage.getItem(K_PROFILE) || '').length;
          const kb = (totalBytes / 1024).toFixed(1);
          if ($('vault-storage-used')) $('vault-storage-used').textContent = `${kb} KB`;
          if ($('vault-total-records')) $('vault-total-records').textContent = String(totalTrades);
          $('vault-storage-status').textContent = uiText('Tersedia di browser ini', 'Available in this browser');
        } catch (e) { $('vault-storage-status').textContent = uiText('Penyimpanan browser tidak tersedia', 'Browser storage unavailable'); }

        const wrap = $('accounts-list-wrap');
        if (!wrap) return;

        wrap.innerHTML = accounts.map(a => `
          <div class="account-item">
            <span class="profile-broker-icon" aria-hidden="true">${esc((a.broker || a.name).slice(0, 2).toUpperCase())}</span>
            <div>
              <div class="account-item-title">${esc(a.name)}</div>
              <div class="account-item-sub">${esc(a.broker)} · ${esc(a.currency)} · ${uiText('Saldo awal', 'Initial balance')}: ${a.currency === 'IDR' ? fmtIDR(a.startBalance) : fmtUSD(a.startBalance)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="account-item-bal">${a.currency === 'IDR' ? fmtIDR(a.startBalance) : fmtUSD(a.startBalance)}</span>
              ${accounts.length > 1 ? `<button class="btn btn-danger btn-sm" onclick="deleteAccount('${safeId(a.id)}')">${esc(uiText('Hapus', 'Delete'))}</button>` : ''}
            </div>
          </div>
        `).join('');

        // Update nav bar name
        const navName = $('nav-trader-name');
        if (navName) navName.textContent = google?.name || profile.name || 'Trader';
      }

      window.saveProfileSettings = function () {
        profile.name = ($('p-trader-name').value || 'Trader').trim();
        const kurs = Number($('p-kurs-input').value);
        if (!Number.isFinite(kurs) || kurs <= 0) { alert(uiText("Masukkan kurs positif yang valid.", "Enter a valid positive exchange rate.")); return; }
        settings.kurs = kurs;
        $('exchange-status').textContent = uiText('Kurs manual: Rp {rate} per USD.', 'Manual rate: Rp {rate} per USD.').replace('{rate}', kurs.toLocaleString(language));
        saveData();
        renderJournalTable();
        renderStatistics();
        runAllCalculators();
        renderProfileView();
        alert(uiText("Profil dan setelan kurs berhasil diperbarui.", "Profile and exchange rate settings updated."));
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
          alert(uiText("Mohon isi nama akun.", "Enter an account name."));
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
        alert(uiText("Akun broker baru berhasil ditambahkan!", "Trading account added."));
      };

      window.deleteAccount = function (accId) {
        if (confirm(uiText("Hapus akun ini? Trade yang terhubung akan tetap tersimpan di histori.", "Delete this account? Linked trades will stay in your history."))) {
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
            if (confirm(uiText('Pulihkan {accounts} akun dan {trades} transaksi? Data lokal akan diperbarui.', 'Restore {accounts} accounts and {trades} trades? Local data will be replaced.').replace('{accounts}',data.accounts.length).replace('{trades}',data.trades.length))) {
              accounts = data.accounts;
              trades = data.trades;
              if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) settings = { kurs: Number(data.settings.kurs) || 17000, billingAnnual: !!data.settings.billingAnnual, exchangeUpdatedAt: Number(data.settings.exchangeUpdatedAt) || null };
              if (data.profile && typeof data.profile === 'object' && !Array.isArray(data.profile)) profile = { name: String(data.profile.name || 'Trader').slice(0, 80), currentAccount: safeId(data.profile.currentAccount) };
              saveData();
              renderJournalTable();
              renderProfileView();
              alert(uiText("Data berhasil dipulihkan!", "Data restored."));
            }
          } catch (err) {
            alert(uiText("Format berkas backup tidak valid.", "Invalid backup file format."));
          }
        };
        reader.readAsText(f);
      };

      window.exportCSV = function () {
        if (!trades.length) {
          alert(uiText("Belum ada data untuk diekspor.", "No data to export."));
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
        if (confirm(uiText("PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA akun dan catatan jurnal trade?", "Delete all accounts and journal records?"))) {
          [K_ACCOUNTS, K_TRADES, K_SETTINGS, K_PROFILE, scanStorageKey, 'jt_kalender_cache_v2'].forEach(key => localStorage.removeItem(key));
          loadData();
          renderJournalTable();
          renderProfileView();
          alert(uiText("Seluruh data berhasil direset ke pengaturan awal.", "All data reset to the initial settings."));
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
          box.innerHTML = `<iframe src="https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(info.target)}&interval=${encodeURIComponent(currentTvInterval)}&theme=dark&style=1&timezone=Asia%2FJakarta&locale=${language === 'id' ? 'id' : 'en'}" allowtransparency="true" scrolling="no" frameborder="0" title="${esc((window.JTI18n?.key('journalChartTitle', 'Open {market} chart in TradingView') || 'Open {market} chart in TradingView').replace('{market}', info.label))}"></iframe>`;
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
      let kalCache = null, kalCari = '', kalDmp = [1,2,3], kalTh = '', kalBl = '', kalTg = '', kalLihatLalu = true;
      let kalCountries = ['US'], kalCategory = '';
      let kalPollingTimer = null, kalCountdownTimer = null;

      const kalText = uiText;
      function kalHariIni() {
        const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
        return ['year','month','day'].map(type => parts.find(p => p.type === type).value).join('-');
      }
      function kalTglID(t) {
        const p = String(t || '').split('-');
        if (p.length !== 3) return t || '';
        const d = new Date(t + 'T12:00:00+07:00');
        if (isNaN(d)) return t || '';
        return d.toLocaleDateString(language, { timeZone:'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
        const today = kalHariIni();
        const rank = date => date === today ? 0 : date > today ? 1 : 2;
        return (a || []).slice().sort((x, y) => rank(x.tgl) - rank(y.tgl) ||
          (x.tgl === y.tgl ? String(x.jam || '').localeCompare(String(y.jam || '')) :
            rank(x.tgl) === 2 ? String(y.tgl || '').localeCompare(String(x.tgl || '')) : String(x.tgl || '').localeCompare(String(y.tgl || ''))));
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
          isi = isi.filter(x => ((x.nama || '') + ' ' + (x.neg || '') + ' ' + (x.cat || '') + (/non.?farm/i.test(x.nama) ? ' NFP' : '')).toLowerCase().indexOf(q) >= 0);
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
        isi($('kal-bl'), bl, kalBl, kalText('Semua bulan', 'All months'), v => new Date(Date.UTC(2000, +v - 1, 1)).toLocaleString(language, {month:'long',timeZone:'UTC'}));
        isi($('kal-tg'), tg, kalTg, kalText('Semua tgl', 'All days'), v => String(parseInt(v, 10)));
      }

      function kalCountryCode(event) {
        return (event.countryCode === 'UK' ? 'GB' : event.countryCode) || ({USD:'US',GBP:'GB',JPY:'JP',EUR:'EU',AUD:'AU',NZD:'NZ',CAD:'CA',CHF:'CH',CNY:'CN',IDR:'ID',INR:'IN',KRW:'KR',BRL:'BR',ZAR:'ZA',TRY:'TR',SGD:'SG',HKD:'HK',RUB:'RU',MXN:'MX',SEK:'SE',NOK:'NO'}[event.neg] || event.neg || '');
      }
      function kalCountryFlag(code) {
        return /^[A-Z]{2}$/.test(code) ? '<img class="country-flag" src="https://flagcdn.com/' + code.toLowerCase() + '.svg" alt="" width="20" height="14" loading="lazy" onerror="this.hidden=true">' : '';
      }
      // Full calendar country catalogue from Investing.com; independent of today's releases.
      const kalCountryCodes = 'ET DZ IR ZA AO BW GH KE MW MA MU MZ NA NG CI RW TZ TN UG ZM ZW AL AT NL BE BA BG DK EE FI HU GB IE IS IT DE HR LV LT LU MT ME NO FR PL PT CZ RO RU RS CY SI SK ES SE CH TR UA GR EU US AR BM BR CL EC JM CA KY CO CR MX PY PE UY VE SA BH IQ IL KW LB EG OM QA PS AE JO AU AZ BD CN PH HK IN ID JP KZ KR KG MY MN PK NZ SG LK TW TH UZ VN'.split(' ');
      function kalAvailableCountries() {
        return [...new Set([...kalCountryCodes, ...(kalCache?.items || []).map(kalCountryCode).filter(code => /^[A-Z]{2}$/.test(code))])];
      }
      const kalCountriesKey = 'fncjt_calendar_countries';
      function readKalCountries() {
        try {
          const raw = localStorage.getItem(kalCountriesKey);
          if (raw !== null) {
            const saved = JSON.parse(raw);
            if (saved === null) return null;
            if (Array.isArray(saved) && saved.every(code => kalAvailableCountries().includes(code))) return [...new Set(saved)];
          }
        } catch {}
        return ['US'];
      }
      function setKalCountries(countries) {
        kalCountries = countries;
        try { localStorage.setItem(kalCountriesKey, JSON.stringify(countries)); } catch {}
      }
      kalCountries = readKalCountries();
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
        const names = new Intl.DisplayNames([language], {type:'region'});
        const codes = kalAvailableCountries();
        const countryName = code => code === 'EU' ? kalText('Zona Euro','Eurozone') : /^[A-Z]{2}$/.test(code) ? names.of(code) : code;
        codes.sort((a,b) => countryName(a).localeCompare(countryName(b)));
        $('kal-country-label').textContent = kalText('Negara','Countries');
        $('kal-category-label').textContent = kalText('Kategori','Category');
        $('kal-importance-label').textContent = kalText('Kepentingan','Importance');
        $('kal-country-summary').textContent = kalCountries === null ? kalText('Semua negara','All countries') + ' (' + codes.length + ')' : kalCountries.length + kalText(' dipilih',' selected');
        $('kal-country-search').placeholder = kalText('Cari negara…','Search countries…');
        const actions = {reset:kalText('Kembali ke default','Reset to default'),all:kalText('Pilih semua','Select all'),none:kalText('Hapus semua','Clear all')};
        document.querySelectorAll('[data-country-action]').forEach(button => button.textContent = actions[button.dataset.countryAction]);
        const query = $('kal-country-search').value.toLocaleLowerCase();
        $('kal-country-list').innerHTML = codes.filter(code => (countryName(code)+' '+code).toLocaleLowerCase().includes(query)).map(code => '<label><input type="checkbox" name="calendar-country" value="'+esc(code)+'" '+(kalCountries === null || kalCountries.includes(code) ? 'checked' : '')+'>'+kalCountryFlag(code)+'<span>'+esc(countryName(code))+'</span><small>'+esc(code)+'</small></label>').join('') || '<p>'+kalText('Negara tidak ditemukan','No countries found')+'</p>';
        $('kal-country-chips').innerHTML = (kalCountries === null ? codes : kalCountries).map(code => '<button type="button" data-remove-country="'+esc(code)+'" aria-label="'+esc(kalText('Hapus ','Remove ')+countryName(code))+'">'+kalCountryFlag(code)+esc(code)+' <span aria-hidden="true">×</span></button>').join('');
        $('kal-category').innerHTML = '<option value="">'+kalText('Semua kategori','All categories')+'</option>'+kalCategories.map(row => '<option value="'+row[0]+'">'+esc(kalText(row[1],row[2]))+'</option>').join('');
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
          } else { info.hidden = false; info.textContent = isi.length + kalText(' rilis dalam kalender bulanan', ' releases in the monthly calendar'); }
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
        kalCari = ''; kalDmp = [1,2,3]; setKalCountries(['US']); kalCategory = ''; $('kal-country-search').value = ''; kalTh = ''; kalBl = ''; kalTg = '';
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

      function renderCalendarAgenda() {
        const root = $('calendar-agenda');
        if (!root || !kalCache) return;
        const featured = kalUrut(kalCache.items).filter(row => row.neg === 'USD' && /non.?farm|\bcpi\b|fomc statement|fomc press conference|fomc meeting minutes/i.test(row.nama));
        const unique = [...new Map(featured.map(row => [row.tgl + (/non.?farm/i.test(row.nama) ? 'nfp' : /cpi/i.test(row.nama) ? 'cpi' : row.nama), row])).values()];
        const sourceLink = value => {
          try { const url = new URL(value); return url.protocol === 'https:' && ['www.forexfactory.com','www.investing.com','www.kansascityfed.org'].includes(url.hostname) ? esc(url.href) : ''; } catch { return ''; }
        };
        root.innerHTML = '<h3>' + kalText('Agenda utama bulan ini', 'Key events this month') + '</h3><div class="calendar-agenda-list">' + unique.map(row => {
          const name = /non.?farm/i.test(row.nama) ? 'Non-Farm Payrolls (NFP)' : /cpi/i.test(row.nama) ? 'Consumer Price Index (CPI)' : row.nama;
          const url = sourceLink(row.source);
          return '<div class="calendar-agenda-item"><b>' + (url ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + esc(name) + '</a>' : esc(name)) + '</b><span>' + kalTglID(row.tgl) + ' · ' + esc(row.jam || '--:--') + ' WIB</span></div>';
        }).join('') + '</div>' + (kalCache.agenda || []).map(row => {
          const url = sourceLink(row.source);
          return '<p>' + (url ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + esc(row.name) + '</a>' : esc(row.name)) + ': ' + kalTglID(row.start) + ' – ' + kalTglID(row.end) + ' · ' + (row.end < kalHariIni() ? kalText('Agenda tahunan yang sudah berlangsung.', 'Past annual event.') : kalText('Agenda tahunan terjadwal.', 'Scheduled annual event.')) + '</p>';
        }).join('');
      }

      async function fetchKalenderData(force) {
        const stampEl = $('kal-stamp');
        if (stampEl && force) {
          stampEl.textContent = kalText('Memperbarui otomatis...', 'Refreshing...');
        }

        const gateway = !!globalThis.JTPRO_CONFIG?.apiBase, owner = cloudUser?.id, authRevision = cloudAuthRevision;
        let items = null;
        let updatedStr = '', sourceStatus = 'stale', agenda = [], coverageStart = '', coverageEnd = '';

        // 1. Fetch from local kalender.json
        try {
          const res = gateway ? null : await fetch('kalender.json?t=' + Date.now());
          if (gateway || res.ok) {
            const data = gateway ? await globalThis.JTPRO.request('/economic-calendar?tz=Asia%2FJakarta') : await res.json();
            if (gateway && (cloudUser?.id !== owner || authRevision !== cloudAuthRevision || !canReadNews())) return;
            if (data && Array.isArray(data.items) && data.items.length) {
              items = data.items;
              updatedStr = data.updated || '';
              sourceStatus = data.status || 'stale';
              agenda = Array.isArray(data.agenda) ? data.agenda : [];
              coverageStart = data.coverageStart || ''; coverageEnd = data.coverageEnd || '';
            }
          }
        } catch (e) {
          console.warn('Local kalender.json fetch error:', e);
        }

        // 2. Fallback to remote endpoint if needed
        if (!items && !gateway) {
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
        if (!items && !gateway) {
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

        if (gateway && (cloudUser?.id !== owner || authRevision !== cloudAuthRevision || !canReadNews())) return;
        // Public delivery cache is never used for subscription-protected calendar data.
        if (!gateway) try {
          localStorage.setItem('jt_kalender_cache_v2', JSON.stringify({ items, updated: updatedStr }));
        } catch (e) {}

        kalCache = {
          items: items,
          rawUpdated: updatedStr, sourceStatus, agenda, coverageStart, coverageEnd
        };

        gambarKalender(kalCache.items);
        renderCalendarAgenda();
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
          (kalCache.rawUpdated ? new Date(kalCache.rawUpdated).toLocaleString(language, {timeZone:'Asia/Jakarta'}) + ' WIB' : kalText('Tidak diketahui', 'Unknown'));
        if (kalCache.coverageStart && kalCache.coverageEnd) $('kal-stamp').textContent += ' · ' + kalCache.coverageStart + ' – ' + kalCache.coverageEnd;
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
            const countries = kalCountries || kalAvailableCountries();
            setKalCountries(event.target.checked ? [...new Set([...countries,event.target.value])] : countries.filter(code => code !== event.target.value));
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
          if (button.dataset.countryAction) setKalCountries(button.dataset.countryAction === 'reset' ? ['US'] : button.dataset.countryAction === 'none' ? [] : null);
          else if (button.dataset.removeCountry) setKalCountries((kalCountries || kalAvailableCountries()).filter(code => code !== button.dataset.removeCountry));
          else return;
          gambarKalUlang();
        });
        document.querySelectorAll('.calendar-dropdown').forEach(panel => {
          panel.addEventListener('toggle', () => { if (panel.open) document.querySelectorAll('.calendar-dropdown').forEach(other => { if (other !== panel) other.open = false; }); });
          panel.addEventListener('keydown', event => { if (event.key === 'Escape') { panel.open = false; panel.querySelector('summary').focus(); } });
        });
        document.addEventListener('click', event => { document.querySelectorAll('.calendar-dropdown[open]').forEach(panel => { if (!event.composedPath().includes(panel)) panel.open = false; }); });

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
      let newsDataRevision = 0, newsSourceFeed = null, newsSourceAttempt = '', newsSourceLoading = '', newsSourceFailed = false;
      let newsArticleDetail = null, newsArticleAttempt = '', newsArticleLoading = '';
      let newsSourceRequest = 0, newsArticleRequest = 0;
      let newsCategoryFeed = null, newsCategoryAttempt = '', newsCategoryLoading = '', newsCategoryFailed = false, newsCategoryRequest = 0;
      function resetNewsData() {
        newsDataRevision++;
        publisherNews = null; publisherNewsBusy = false; publisherNewsFailed = false;
        newsSourceFeed = null; newsSourceAttempt = ''; newsSourceLoading = ''; newsSourceFailed = false;
        newsArticleDetail = null; newsArticleAttempt = ''; newsArticleLoading = '';
        newsCategoryFeed = null; newsCategoryAttempt = ''; newsCategoryLoading = ''; newsCategoryFailed = false;
      }
      async function loadNewsFile(path, normalize, onSaved, current = () => true) {
        if (globalThis.JTPRO_CONFIG?.apiBase && path.startsWith('news/')) {
          const params = new URLSearchParams({limit:'100'}), source = path.match(/^news\/sources\/([a-z0-9_]+)\.json$/), category = path.match(/^news\/categories\/([a-z0-9_]+)\.json$/), archive = path.match(/^news\/archive\/([a-f0-9]{2})\.json$/);
          if (source) params.set('source_id', source[1]);
          if (category && category[1] !== 'all') params.set('category', category[1]);
          if (archive) params.set('archive_prefix', archive[1]);
          let feed;
          for (let offset=0; offset<10000; offset+=100) {
            params.set('offset', String(offset));
            const data = await globalThis.JTPRO.request('/news?' + params);
            if (!current()) throw new DOMException('Account or selection changed', 'AbortError');
            if (!feed) feed = {...data, items:[]};
            feed.items.push(...data.items);
            if (data.items.length < 100 || feed.items.length >= data.total) break;
          }
          return {data:normalize(feed), saved:false};
        }
        let cache, saved;
        const url = new URL(path, document.baseURI).href;
        try {
          cache = await globalThis.caches?.open('journalingtrade-news-v1');
          const response = await cache?.match(url);
          if (response) { saved = normalize(await response.json()); onSaved?.(saved); }
        } catch {}
        try {
          const response = await fetch(url, {cache:'no-cache', signal:AbortSignal.timeout(30000)});
          if (!response.ok) throw new Error('News request failed');
          const copy = cache && response.clone();
          const data = normalize(await response.json());
          if (copy && current()) try { await cache.put(url, copy); } catch {}
          return {data, saved:false};
        } catch (error) {
          if (saved) return {data:saved, saved:true};
          throw error;
        }
      }
      function normalizeNewsFeed(data) {
        if (data?.version !== 1 || !Array.isArray(data.sources) || !Array.isArray(data.items) || !publisherTime(data.checkedAt)) throw new Error('Invalid news feed');
        const sources = data.sources.filter(source => source && publisherDomains[source.id] && typeof source.name === 'string' && publisherUrl(source.url, source.id));
        const ids = new Set(sources.map(source => source.id));
        const items = newsItemsForDisplay(data.items.filter(item => item && /^[a-f0-9]{20}$/.test(item.id) && typeof item.title === 'string' && ids.has(item.source) && publisherUrl(item.url, item.source)));
        return {...data, sources, items};
      }
      function newsCurrentItems() {
        if (!publisherNews) return [];
        if (newsCategoryFeed?.key === newsCategoryKey()) return newsCategoryFeed.items;
        const source = newsSourceFeed?.sources[0]?.id;
        return source === newsSelectedSource ? newsItemsForDisplay([...publisherNews.items.filter(item => item.source !== source), ...newsSourceFeed.items]) : publisherNews.items;
      }
      function newsCategoryKey() {
        const id = new URLSearchParams(location.search).get('article');
        const article = newsArticleDetail?.id === id ? newsArticleDetail : publisherNews?.items.find(item => item.id === id);
        if (article) return article.topics?.includes('fed') ? 'fed' : newsCategoryNames[article.category] ? article.category : 'other';
        if (newsCategory) return newsCategory;
        return (!newsSelectedSource || newsAreaCodes.includes(newsSelectedSource)) && (newsQuery.trim() || newsVisibleCount > 12) ? 'all' : '';
      }
      async function loadNewsCategory(key, force = false) {
        if (!canReadNews() || !publisherNews || key !== 'all' && !newsCategoryNames[key] || !force && newsCategoryAttempt === key) return;
        newsCategoryAttempt = key; newsCategoryLoading = key; newsCategoryFailed = false;
        const revision = newsDataRevision, userId = cloudUser.id, request = ++newsCategoryRequest;
        const current = () => request === newsCategoryRequest && revision === newsDataRevision && cloudUser?.id === userId && canReadNews() && newsCategoryKey() === key;
        const accept = data => {
          if (current() && (!newsCategoryFeed || newsCategoryFeed.key !== key || Date.parse(data.checkedAt) >= Date.parse(newsCategoryFeed.checkedAt))) { newsCategoryFeed = {...data, key}; renderPublisherNews(); }
        };
        try {
          const result = await loadNewsFile('news/categories/' + key + '.json', data => {
            const feed = normalizeNewsFeed(data);
            if (key !== 'all' && feed.items.some(item => (item.category || 'other') !== key && !item.topics?.includes(key))) throw new Error('Invalid category feed');
            return feed;
          }, accept, current);
          if (current()) { newsCategoryFailed = result.saved; accept(result.data); }
        } catch { if (current()) newsCategoryFailed = true; }
        finally { if (request === newsCategoryRequest && revision === newsDataRevision) { newsCategoryLoading = ''; if (current()) renderPublisherNews(); else newsCategoryAttempt = ''; } }
      }
      async function loadNewsSource(sourceId, force = false) {
        if (!canReadNews() || !/^[a-z][a-z0-9_]{0,63}$/.test(sourceId) || !publisherNews?.sources.some(source => source.id === sourceId) || !newsSourceInRegion(sourceId)) return;
        if (!force && newsSourceAttempt === sourceId) return;
        newsSourceAttempt = sourceId; newsSourceLoading = sourceId; newsSourceFailed = false;
        const revision = newsDataRevision, userId = cloudUser.id, request = ++newsSourceRequest;
        const current = () => request === newsSourceRequest && revision === newsDataRevision && cloudUser?.id === userId && canReadNews() && $('news-source').value === sourceId && newsSourceInRegion(sourceId);
        const accept = data => {
          if (current() && (!newsSourceFeed || newsSourceFeed.sources[0]?.id !== sourceId || Date.parse(data.checkedAt) >= Date.parse(newsSourceFeed.checkedAt))) { newsSourceFeed = data; renderPublisherNews(); }
        };
        try {
          const normalize = data => {
            const feed = normalizeNewsFeed(data);
            if (feed.sources.length !== 1 || feed.sources[0].id !== sourceId || feed.items.some(item => item.source !== sourceId)) throw new Error('Invalid source feed');
            return feed;
          };
          const result = await loadNewsFile('news/sources/' + sourceId + '.json', normalize, accept, current);
          if (current()) { newsSourceFailed = result.saved; accept(result.data); }
        } catch { if (current()) newsSourceFailed = true; }
        finally { if (request === newsSourceRequest && revision === newsDataRevision) { newsSourceLoading = ''; if (current()) renderPublisherNews(); } }
      }
      async function loadNewsArticle(id) {
        if (!canReadNews() || !publisherNews || !/^[a-f0-9]{20}$/.test(id) || newsArticleAttempt === id) return;
        newsArticleAttempt = id; newsArticleLoading = id;
        const revision = newsDataRevision, userId = cloudUser.id, request = ++newsArticleRequest;
        const current = () => request === newsArticleRequest && revision === newsDataRevision && cloudUser?.id === userId && canReadNews() && new URLSearchParams(location.search).get('article') === id;
        const normalize = data => {
          if (data?.version !== 1 || !Array.isArray(data.items) || !publisherTime(data.checkedAt)) throw new Error('Invalid article archive');
          return data.items.find(item => item?.id === id && typeof item.title === 'string' && publisherNews.sources.some(source => source.id === item.source) && publisherUrl(item.url, item.source)) || null;
        };
        const accept = item => { if (current() && item && newsSourceInRegion(item.source)) { newsArticleDetail = item; renderNewsReader(); } };
        try {
          const result = await loadNewsFile('news/archive/' + id.slice(0,2) + '.json', normalize, accept, current);
          accept(result.data);
        } catch {}
        finally { if (request === newsArticleRequest && revision === newsDataRevision) { newsArticleLoading = ''; if (current()) renderNewsReader(); else newsArticleAttempt = ''; } }
      }
      const publisherDomains = { investing: 'investing.com', cnbc: 'cnbc.com', kontan: 'kontan.co.id', reuters: 'reuters.com', aljazeera: 'aljazeera.com', bloomberg: 'bloomberg.com', fnc: 'tradewithfnc.com', investing_id: 'investing.com', pluang: 'pluang.com', kompas: 'kompas.com', detik: 'detik.com', kemenkeu: 'kemenkeu.go.id', cnn_id: 'cnnindonesia.com', bisnis: 'bisnis.com', sindo: 'sindonews.com', ap:'apnews.com', bbc:['bbc.com','bbc.co.uk'], afp:'afp.com', wsj:'wsj.com', guardian:'theguardian.com', ft:'ft.com', dw:'dw.com', fedwatch: 'cmegroup.com', cme: 'cmegroup.com' };
      const newsText = uiText;
      const NEWS_REGIONS = {};
      const GLOBAL_NEWS_SOURCES = [];
      const EUROPE_COUNTRY_CODES = ['GB','DE','FR','IT','ES','NL','CH','SE','PL','UA','NO','DK','FI','CZ','RO','HU','IE','AT'];
      const MIDDLE_EAST_COUNTRY_CODES = ['QA','JO','LB','IQ','KW','OM','BH','IL','SA','AE'];
      const STRICT_NEWS_COUNTRY_CODES = ['IN','CN','PK','BD','TW','SA','AE','TR','IR','LK','ID','MY','SG','TH','PH','VN','JP','KR','ZA','NG','KE','EG','MA','GH','ET','DZ','UG','TZ'];
      const NEWS_CONTINENTS = {
        AFRICA: {names:['Semua Afrika','All Africa'], countries:['ZA','AO','BW','GH','KE','MW','MA','MU','MZ','NA','NG','RW','SC','SN','TZ','TN','UG','ZM','ZW','EG','ET','DZ']},
        ANTARCTICA: {names:['Semua Antarktika','All Antarctica'], countries:['AQ']},
        ASIA: {names:['Semua Asia','All Asia'], countries:['ID','MY','SG','TH','PH','VN','JP','KR','IN','CN','PK','BD','TW','TR','IR','LK','HK','AZ','KZ','KG','MN','UZ',...MIDDLE_EAST_COUNTRY_CODES]},
        EUROPE: {names:['Semua Eropa','All Europe'], countries:[...EUROPE_COUNTRY_CODES,'AL','BE','BA','BG','EE','IS','HR','LV','LT','LU','MT','ME','PT','RU','RS','CY','SI','SK','GR','EU']},
        NORTH_AMERICA: {names:['Semua Amerika Utara','All North America'], countries:['US','CA','MX','CR','BM','JM','KY']},
        SOUTH_AMERICA: {names:['Semua Amerika Selatan','All South America'], countries:['AR','BR','CL','EC','CO','PY','PE','UY','VE']},
        OCEANIA: {names:['Semua Oseania','All Oceania'], countries:['AU','NZ','FJ','PG','WS','TO','VU','SB']}
      };
      const newsAreaCodes = [...Object.keys(NEWS_CONTINENTS), 'MIDDLE_EAST'];
      const newsAlphabetical = (a, b) => a.localeCompare(b, language, {sensitivity:'base'});
      const publisherCountries = {cnbc:'US', ap:'US', wsj:'US', bbc:'GB', guardian:'GB', ft:'GB', dw:'DE', kontan:'ID', fnc:'ID', investing_id:'ID', pluang:'ID', kompas:'ID', detik:'ID', kemenkeu:'ID', cnn_id:'ID', bisnis:'ID', sindo:'ID'};
      const newsTimeZoneCountries = {
        'Europe/Oslo':'NO', 'Europe/Copenhagen':'DK', 'Europe/Helsinki':'FI', 'Europe/Prague':'CZ',
        'Europe/Bucharest':'RO', 'Europe/Budapest':'HU', 'Europe/Dublin':'IE', 'Europe/Vienna':'AT',
        'Europe/Amsterdam':'NL', 'Europe/Kyiv':'UA', 'Europe/Kiev':'UA', 'Europe/Uzhgorod':'UA', 'Europe/Zaporozhye':'UA',
        'Europe/London':'GB', 'Europe/Berlin':'DE', 'Europe/Paris':'FR', 'Europe/Warsaw':'PL',
        'Europe/Stockholm':'SE', 'Europe/Zurich':'CH', 'Europe/Rome':'IT', 'Europe/Madrid':'ES',
        'Asia/Jakarta':'ID', 'Asia/Makassar':'ID', 'Asia/Jayapura':'ID', 'Asia/Tokyo':'JP',
        'Asia/Singapore':'SG', 'Asia/Kuala_Lumpur':'MY', 'Asia/Shanghai':'CN', 'Asia/Hong_Kong':'HK',
        'Asia/Qatar':'QA', 'Asia/Amman':'JO', 'Asia/Beirut':'LB', 'Asia/Baghdad':'IQ', 'Asia/Kuwait':'KW',
        'Asia/Muscat':'OM', 'Asia/Bahrain':'BH', 'Asia/Jerusalem':'IL', 'Asia/Tel_Aviv':'IL', 'Asia/Riyadh':'SA', 'Asia/Dubai':'AE',
        'Asia/Karachi':'PK', 'Asia/Dhaka':'BD', 'Asia/Taipei':'TW', 'Europe/Istanbul':'TR', 'Asia/Istanbul':'TR', 'Asia/Tehran':'IR',
        'Asia/Colombo':'LK', 'Asia/Manila':'PH', 'Asia/Ho_Chi_Minh':'VN', 'Asia/Saigon':'VN', 'Asia/Kuching':'MY',
        'Africa/Johannesburg':'ZA', 'Africa/Lagos':'NG', 'Africa/Nairobi':'KE', 'Africa/Cairo':'EG', 'Africa/Casablanca':'MA',
        'Africa/Accra':'GH', 'Africa/Addis_Ababa':'ET', 'Africa/Algiers':'DZ', 'Africa/Kampala':'UG', 'Africa/Dar_es_Salaam':'TZ',
        'Asia/Kolkata':'IN', 'Asia/Calcutta':'IN', 'Asia/Seoul':'KR', 'Asia/Bangkok':'TH',
        'America/New_York':'US', 'America/Chicago':'US', 'America/Denver':'US', 'America/Los_Angeles':'US',
        'America/Anchorage':'US', 'America/Phoenix':'US', 'Pacific/Honolulu':'US',
        'America/Toronto':'CA', 'America/Vancouver':'CA', 'America/Montreal':'CA', 'America/Halifax':'CA',
        'America/Winnipeg':'CA', 'America/Edmonton':'CA', 'America/Regina':'CA', 'America/St_Johns':'CA',
        'America/Mexico_City':'MX', 'America/Cancun':'MX', 'America/Tijuana':'MX', 'America/Monterrey':'MX',
        'America/Argentina/Buenos_Aires':'AR', 'America/Buenos_Aires':'AR', 'America/Argentina/Cordoba':'AR',
        'America/Bogota':'CO', 'America/Santiago':'CL', 'America/Punta_Arenas':'CL', 'Pacific/Easter':'CL',
        'America/Lima':'PE', 'America/Costa_Rica':'CR', 'America/Montevideo':'UY',
        'Australia/Sydney':'AU', 'Australia/Melbourne':'AU', 'Australia/Brisbane':'AU', 'Australia/Perth':'AU',
        'Australia/Adelaide':'AU', 'Australia/Darwin':'AU', 'Australia/Hobart':'AU',
        'Pacific/Auckland':'NZ', 'Pacific/Chatham':'NZ'
      };
      let newsCountry = newsTimeZoneCountries[Intl.DateTimeFormat().resolvedOptions().timeZone] || '';
      let newsLocationMethod = newsCountry ? 'timezone' : '';
      let newsLocationPending = false, newsLocationChecked = false, newsRegion = '', newsFounderMode = false;
      const newsRegionKey = 'fncjt_news_region';
      let newsRegionMode = 'auto';
      try {
        const saved = JSON.parse(localStorage.getItem(newsRegionKey) || 'null');
        if (saved && ['auto','manual'].includes(saved.mode) && (kalCountryCodes.includes(saved.region) || ['DEFAULT','global_founder','',...newsAreaCodes].includes(saved.region))) {
          newsRegion = saved.region; newsRegionMode = saved.mode;
          const detected = saved.detectedCountry || (saved.mode === 'auto' ? saved.region : '');
          if (kalCountryCodes.includes(detected) && !newsCountry) { newsCountry = detected; newsLocationMethod = 'saved'; }
        }
      } catch {}
      function saveNewsRegionPreference() {
        const manual = newsRegionMode === 'manual' && (isNewsFounder() || (hasUnlockedNewsAccess() && (newsRegion === unlockedNewsRegion() || unlockedNewsCountries().includes(newsRegion))));
        try { localStorage.setItem(newsRegionKey, JSON.stringify({region:manual ? newsRegion : newsCountry || 'DEFAULT', mode:manual ? 'manual' : 'auto', detectedCountry:newsCountry})); } catch {}
      }
      let regionalSourcesPromise = null;
      function registerRegionalSources(data) {
        for (const [country, portals] of Object.entries(data)) {
          if ((!kalCountryCodes.includes(country) && !['DEFAULT','global_founder','GLOBAL'].includes(country)) || !Array.isArray(portals)) throw new Error('Invalid region registry');
          for (const portal of portals) {
            const url = new URL(portal.url);
            const domains = [].concat(publisherDomains[portal.id] || []);
            if (!/^[a-z][a-z0-9_]{0,63}$/.test(portal.id) || typeof portal.name !== 'string' || (portal.country && !kalCountryCodes.includes(portal.country)) || url.protocol !== 'https:' || url.username || url.password || (domains.length && !domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)))) throw new Error('Invalid regional publisher');
          }
        }
        for (const [country, portals] of Object.entries(data)) {
          NEWS_REGIONS[country] = portals;
          for (const portal of portals) {
            if (!publisherDomains[portal.id]) publisherDomains[portal.id] = new URL(portal.url).hostname.replace(/^www\./, '');
            if (!publisherCountries[portal.id] && kalCountryCodes.includes(portal.country || country)) publisherCountries[portal.id] = portal.country || country;
          }
        }
        NEWS_REGIONS.UK = NEWS_REGIONS.GB;
        GLOBAL_NEWS_SOURCES.splice(0, GLOBAL_NEWS_SOURCES.length, ...(NEWS_REGIONS.GLOBAL || []));
      }
      async function loadRegionalSources() {
        if (!regionalSourcesPromise) regionalSourcesPromise = new Promise((resolve, reject) => {
          loadNewsFile('regional-sources.json', data => { registerRegionalSources(data); return data; }, resolve).then(resolve, reject);
        }).catch(error => { regionalSourcesPromise = null; throw error; });
        return regionalSourcesPromise;
      }
      function hasEuropeNewsAccess() { return isNewsFounder() || EUROPE_COUNTRY_CODES.includes(newsCountry); }
      function hasMiddleEastNewsAccess() { return isNewsFounder() || MIDDLE_EAST_COUNTRY_CODES.includes(newsCountry); }
      function unlockedNewsCountries() { return EUROPE_COUNTRY_CODES.includes(newsCountry) ? EUROPE_COUNTRY_CODES : MIDDLE_EAST_COUNTRY_CODES.includes(newsCountry) ? MIDDLE_EAST_COUNTRY_CODES : []; }
      function unlockedNewsRegion() { return EUROPE_COUNTRY_CODES.includes(newsCountry) ? 'EUROPE' : MIDDLE_EAST_COUNTRY_CODES.includes(newsCountry) ? 'MIDDLE_EAST' : ''; }
      function hasUnlockedNewsAccess() { return isNewsFounder() || !!unlockedNewsRegion(); }
      function isMiddleEastNewsSource(sourceId) { return MIDDLE_EAST_COUNTRY_CODES.includes(publisherCountries[sourceId]); }
      function isEuropeNewsSource(sourceId) { return EUROPE_COUNTRY_CODES.includes(publisherCountries[sourceId]); }
      function newsAreaCountries(area) { return area === 'MIDDLE_EAST' ? MIDDLE_EAST_COUNTRY_CODES : NEWS_CONTINENTS[area]?.countries || []; }
      function newsAreaName(area) { const names = NEWS_CONTINENTS[area]?.names; return area === 'MIDDLE_EAST' ? newsText('Semua Timur Tengah','All Middle East') : names ? newsText(names[0],names[1]) : ''; }
      function canSelectNewsArea(area) { return newsAreaCodes.includes(area) && (isNewsFounder() || (area === 'EUROPE' && hasEuropeNewsAccess()) || (area === 'MIDDLE_EAST' && hasMiddleEastNewsAccess()) || newsAreaCountries(area).includes(newsCountry)); }
      function newsSourceInRegion(sourceId) {
        if (GLOBAL_NEWS_SOURCES.some(portal => portal.id === sourceId)) return true;
        const region = activeNewsRegion();
        const country = publisherCountries[sourceId];
        if (!isNewsFounder() && STRICT_NEWS_COUNTRY_CODES.includes(country)) return country === newsCountry;
        if (isNewsFounder() && canSelectNewsArea($('news-source')?.value)) return newsAreaCountries($('news-source').value).includes(country);
        if (isNewsFounder() && !region) return true;
        if (isNewsFounder() && newsAreaCodes.includes(region)) return newsAreaCountries(region).includes(country);
        if (region === 'EUROPE' || ($('news-source')?.value === 'EUROPE' && hasEuropeNewsAccess())) return isEuropeNewsSource(sourceId);
        if (region === 'MIDDLE_EAST' || ($('news-source')?.value === 'MIDDLE_EAST' && hasMiddleEastNewsAccess())) return isMiddleEastNewsSource(sourceId);
        if ((!hasEuropeNewsAccess() && isEuropeNewsSource(sourceId)) || (!hasMiddleEastNewsAccess() && isMiddleEastNewsSource(sourceId))) return false;
        const list = NEWS_REGIONS[region] || NEWS_REGIONS.DEFAULT || [];
        return list.some(portal => portal.id === sourceId) || (kalCountryCodes.includes(region) && !!NEWS_REGIONS[region] && publisherCountries[sourceId] === region);
      }
      function activeNewsRegion() {
        if (newsRegionMode === 'manual' && (isNewsFounder() || (hasUnlockedNewsAccess() && (newsRegion === unlockedNewsRegion() || unlockedNewsCountries().includes(newsRegion))))) return newsRegion;
        return isNewsFounder() ? '' : unlockedNewsRegion() || newsCountry || 'DEFAULT';
      }
      function newsSourceMatchesSelection(sourceId, selected) {
        return !selected || (newsAreaCodes.includes(selected) ? canSelectNewsArea(selected) && newsAreaCountries(selected).includes(publisherCountries[sourceId]) : sourceId === selected);
      }
      function defaultCalendarRegion() {
        try {
          const country = newsCountry;
          if (!isNewsFounder() && kalCountryCodes.includes(country) && localStorage.getItem(kalCountriesKey) === null) {
            // Do not persist automatic defaults; a later IP result can refine the timezone estimate.
            kalCountries = [country];
            if ($('sub-berita-kalender') && !$('sub-berita-kalender').hidden) renderEconomicCalendar();
          }
        } catch {}
      }
      function resetNewsRegion() {
        newsFounderMode = false; newsSelectedSource = ''; newsVisibleCount = 12;
        if ($('news-source')) $('news-source').value = '';
        renderNewsRegionControls();
        renderNewsReader();
      }
      function renderNewsRegionControls() {
        const select = $('news-region');
        if (!select) return;
        const founder = isNewsFounder();
        if (founder !== newsFounderMode) {
          newsFounderMode = founder; newsSelectedSource = ''; newsVisibleCount = 12;
          $('news-source').value = '';
        }
        $('news-founder-badge').hidden = !founder;
        $('news-region-indicator').hidden = founder;
        $('news-region-label').textContent = newsText('Region berita','News region');
        const names = new Intl.DisplayNames([language], {type:'region'});
        const name = code => code === 'AUTO' ? newsText('Deteksi otomatis','Detect automatically') : code === 'DEFAULT' ? newsText('Global / Default','Global / Default') : code === 'global_founder' ? 'Global / Tier 1' : newsAreaCodes.includes(code) ? newsAreaName(code) : code ? names.of(code) + ' (' + code + ')' : newsText('Semua region','All regions');
        const regions = founder ? ['global_founder','',...newsAreaCodes.sort((a,b) => newsAlphabetical(newsAreaName(a), newsAreaName(b))), 'DEFAULT', ...[...kalCountryCodes].sort((a,b) => newsAlphabetical(names.of(a), names.of(b)))] : hasUnlockedNewsAccess() ? [unlockedNewsRegion(), ...[...unlockedNewsCountries()].sort((a,b) => newsAlphabetical(names.of(a), names.of(b)))] : [activeNewsRegion()];
        const regionOptions = codes => codes.map(code => '<option value="' + esc(code) + '">' + esc(name(code)) + '</option>').join('');
        const groupedRegions = [
          [newsText('Akses cepat','Quick access'), ['AUTO', ...regions.filter(code => ['global_founder','','DEFAULT'].includes(code))]],
          [newsText('Benua & kawasan','Continents & regions'), regions.filter(code => newsAreaCodes.includes(code))],
          [newsText('Negara','Countries'), regions.filter(code => /^[A-Z]{2}$/.test(code))]
        ];
        select.innerHTML = groupedRegions.filter(([,codes]) => codes.length).map(([label,codes]) => '<optgroup label="' + esc(label) + '">' + regionOptions(codes) + '</optgroup>').join('');
        const region = activeNewsRegion();
        const manual = hasUnlockedNewsAccess() && newsRegionMode === 'manual' && region === newsRegion;
        select.value = region;
        select.disabled = !hasUnlockedNewsAccess();
        $('news-region-flag').innerHTML = /^[A-Z]{2}$/.test(select.value) ? kalCountryFlag(select.value) : '';
        $('news-region-indicator').textContent = founder ? newsText('Mode: Founder','Mode: Founder') : hasEuropeNewsAccess() ? newsText('Region: Eropa (All Unlocked)','Region: Europe (All Unlocked)') : hasMiddleEastNewsAccess() ? newsText('Region: Timur Tengah (Unlocked)','Region: Middle East (Unlocked)') : 'Region: ' + (region === 'global_founder' ? 'Global / Tier 1' : region === 'DEFAULT' ? 'Global / Default' : region || newsText('Semua','All')) + ' (' + (manual ? newsText('Manual','Manual') : newsText('Otomatis','Automatic')) + ')';
        $('news-region-status').textContent = manual ? newsText('Pilihan manual tersimpan di browser ini.','Manual selection saved in this browser.') : founder ? newsText('Anda bebas memilih semua negara dan benua.','You can select all countries and continents.') : newsLocationPending ? newsText('Memeriksa negara melalui IP…','Checking country using IP…') : hasEuropeNewsAccess() ? newsText('Seluruh sumber Eropa dan Berita Global tersedia.','All European sources and Global News are available.') : hasMiddleEastNewsAccess() ? newsText('Sumber kawasan Timur Tengah dan Berita Global tersedia.','Regional Middle East sources and Global News are available.') : newsLocationMethod === 'ip' ? newsText('Sumber lokal sesuai negara IP Anda; Berita Global selalu tersedia.','Local sources follow your IP country; Global News is always available.') : newsLocationMethod === 'saved' ? newsText('Region tersimpan; lokasi saat ini belum dapat diverifikasi.','Saved region; current location could not be verified.') : newsCountry ? newsText('Perkiraan negara dari zona waktu perangkat; geolokasi IP tidak tersedia.','Country estimated from your device timezone; IP geolocation unavailable.') : newsText('Lokasi tidak terdeteksi; menampilkan sumber global.','Location unavailable; showing global sources.');
        if (region && !NEWS_REGIONS[region] && !newsAreaCodes.includes(region)) $('news-region-status').textContent += newsText(' Negara ini memakai kurasi Global / Default.',' This country uses Global / Default curation.');
        window.syncNewsSelects?.();
      }
      async function detectNewsRegion() {
        if (isNewsFounder() || newsLocationChecked || newsLocationPending || !canReadNews()) return;
        newsLocationPending = true;
        defaultCalendarRegion(); renderNewsRegionControls();
        try {
          const response = await fetch('https://ipapi.co/country/', {credentials:'omit', referrerPolicy:'no-referrer', signal:AbortSignal.timeout(4000)});
          if (!response.ok) throw new Error('Location unavailable');
          const country = (await response.text()).trim().toUpperCase();
          if (!kalCountryCodes.includes(country)) throw new Error('Unknown country');
          newsCountry = country; newsLocationMethod = 'ip';
        } catch {}
        finally {
          newsLocationChecked = true; newsLocationPending = false;
          if (!isNewsFounder()) saveNewsRegionPreference();
          defaultCalendarRegion(); renderNewsRegionControls(); renderPublisherNews();
        }
      }
      window.changeNewsRegion = function () {
        if (!hasUnlockedNewsAccess()) { renderNewsRegionControls(); return; }
        const value = $('news-region').value;
        if (value === 'AUTO') { newsRegionMode = 'auto'; newsLocationChecked = false; }
        else {
          if (isNewsFounder() ? !kalCountryCodes.includes(value) && !['DEFAULT','global_founder','',...newsAreaCodes].includes(value) : value !== unlockedNewsRegion() && !unlockedNewsCountries().includes(value)) { renderNewsRegionControls(); return; }
          newsRegion = value; newsRegionMode = 'manual';
        }
        saveNewsRegionPreference(); defaultCalendarRegion();
        newsSelectedSource = ''; newsVisibleCount = 12; $('news-source').value = '';
        renderPublisherNews();
      };
      function newsSourceOptions(sources) {
        const globalIds = new Set(GLOBAL_NEWS_SOURCES.map(portal => portal.id));
        const names = new Intl.DisplayNames([language], {type:'region'});
        const groups = new Map([[newsText('Berita Global','Global News'), []]]);
        for (const source of sources) {
          const country = publisherCountries[source.id];
          const label = isMiddleEastNewsSource(source.id) ? newsText('Timur Tengah','Middle East') : globalIds.has(source.id) ? newsText('Berita Global','Global News') : newsText('Berita Lokal','Local News') + ' — ' + (country ? names.of(country) : newsText('Sumber lainnya','Other sources'));
          if (!groups.has(label)) groups.set(label, []);
          groups.get(label).push(source);
        }
        return '<option value="">' + newsText('Semua sumber','All sources') + '</option>' + newsAreaCodes.filter(canSelectNewsArea).sort((a,b) => newsAlphabetical(newsAreaName(a), newsAreaName(b))).map(area => '<option value="' + area + '">' + esc(newsAreaName(area)) + '</option>').join('') + [...groups].filter(([,rows]) => rows.length).sort(([a],[b]) => a === newsText('Berita Global','Global News') ? -1 : b === newsText('Berita Global','Global News') ? 1 : newsAlphabetical(a,b)).map(([label, rows]) => '<optgroup label="' + esc(label) + '">' + [...rows].sort((a,b) => newsAlphabetical(a.name,b.name)).map(source => '<option value="' + esc(source.id) + '">' + esc(source.name + (source.tag ? ' · ' + source.tag : '') + (source.kind === 'external' ? newsText(' · Portal saja',' · Portal only') : '')) + '</option>').join('') + '</optgroup>').join('');
      }
      function newsItemsForDisplay(items) {
        const counts = new Map();
        return [...items].sort((a,b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)).filter(item => {
          const count = (counts.get(item.source) || 0) + 1;
          counts.set(item.source, count);
          return count <= 500;
        });
      }
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
          const domains = [].concat(publisherDomains[sourceId] || []);
          return url.protocol === 'https:' && !url.username && !url.password && domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)) ? url.href : null;
        } catch { return null; }
      }
      function publisherTime(value) {
        const date = new Date(value);
        return value && Number.isFinite(date.getTime()) ? date.toLocaleString(language, { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB' : null;
      }
      function publisherImageUrl(value) {
        try {
          if (typeof document !== 'undefined') {
            const localUrl = new URL(value, document.baseURI);
            const localPath = pagePath('news/images');
            if (localUrl.protocol === 'https:' && localUrl.origin === document.location.origin && localUrl.pathname.startsWith(localPath) && /^[a-f0-9]{64}\.(?:webp|png|jpg)$/.test(localUrl.pathname.slice(localPath.length))) return localUrl.href;
          }
          const url = new URL(value);
          const domains = ['investing.com', 'cnbcfm.com', 'kontan.co.id', 'reuters.com', 'aljazeera.com', 'bloomberg.com', 'bwbx.io', 'pluang.com', 'kompas.com', 'detik.net.id', 'kemenkeu.go.id', 'cnnindonesia.com', 'bisnis.com', 'sindonews.com', 'apnews.com', 'bbc.co.uk', 'bbci.co.uk', 'wsj.net', 'guim.co.uk', 'ft.com', 'dw.com', 'nrk.no', 'dr.dk', 'yle.fi', 'yleisradio.fi', 'irozhlas.cz', 'hotnews.ro', 'telex.hu', 'rte.ie', 'orf.at', 'independent.co.uk', 'ds.at', 'abc-cdn.net.au', 'ffx.io', ...Object.values(publisherDomains).flat()];
          return url.protocol === 'https:' && !url.username && !url.password && domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)) ? url.href : null;
        } catch { return null; }
      }
      function newsArticlePath(id) {
        return pagePath('economic-news') + '?article=' + encodeURIComponent(id);
      }
      function relatedNews(item, items, sources, allowed) {
        // ponytail: local headline/topic matching; use an editorial index if multilingual recall needs improvement.
        const stop = new Set('the and for with from that this have has its are was were will would says said say new more after before into over amid about could their they who what when where why how than not but all out off his her our your also news update latest read article sources source report reports exclusive tie tieup channel cut cuts cost costs discuss discusses talks plan plans broader company companies group groups business britain british global world europe america national pada dari yang untuk dengan dalam oleh dan atau ini itu akan telah saat usai serta berita baru kata hasil'.split(' '));
        const normalize = value => String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
        const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, {granularity:'word'}) : null;
        const words = title => {
          const value = normalize(title).replace(/\b([a-z]+)\s+(\d{1,2})\b/g, '$1$2');
          const tokens = segmenter && /\p{Script=Han}/u.test(value) ? [...segmenter.segment(value)].filter(part => part.isWordLike).map(part => part.segment) : value.match(/[\p{L}\p{N}]+/gu) || [];
          return new Set(tokens.filter(word => (word.length > 2 || word.length >= 2 && /\p{Script=Han}/u.test(word)) && !stop.has(word) && !/^\d+$/.test(word)));
        };
        const headlineKey = value => normalize(value).replace(/^exclusive[\s:-]+/, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
        const title = headlineKey(item.title);
        const target = words(item.title);
        const acronyms = new Set((item.title.match(/\b[A-Z]{3,}\b/g) || []).map(word => normalize(word)));
        const publisherNames = new Set('bbc npr cnn cbs abc cnbc reuters'.split(' '));
        const entities = new Set((item.title.match(/\b(?:[A-Z]{2,}|[A-Z][a-z]{3,})\b/g) || []).map(word => normalize(word)).filter(word => target.has(word)));
        const known = new Set(sources.filter(source => source.kind !== 'tool').map(source => source.id));
        const candidates = items.filter(row => (!item.topics?.includes('fed') || row.topics?.includes('fed')) && row.id !== item.id && row.url !== item.url && headlineKey(row.title) !== title && known.has(row.source) && allowed(row.source) && publisherUrl(row.url, row.source)).map(row => ({row, words:words(row.title)}));
        const frequency = new Map();
        for (const candidate of candidates) for (const word of target) if (candidate.words.has(word)) frequency.set(word, (frequency.get(word) || 0) + 1);
        const ranked = candidates.map(candidate => {
          const shared = [...target].filter(word => candidate.words.has(word));
          const weights = shared.map(word => Math.log((candidates.length + 1) / ((frequency.get(word) || 0) + 1)));
          const fed = item.topics?.includes('fed') && candidate.row.topics?.includes('fed');
          const relevant = item.topics?.includes('fed') ? fed : shared.length >= 2 || candidate.row.category === item.category && shared.some((word,index) => !publisherNames.has(word) && (acronyms.has(word) || entities.has(word) && weights[index] >= 3));
          return {row:candidate.row, score:relevant ? weights.reduce((sum, weight) => sum + weight, 0) + (fed ? 3 : 0) + (item.category === candidate.row.category ? .5 : 0) : 0};
        }).filter(candidate => candidate.score > 0).sort((a,b) => b.score - a.score || (Date.parse(b.row.publishedAt) || 0) - (Date.parse(a.row.publishedAt) || 0));
        const seen = new Set();
        return ranked.filter(({row}) => { const key = headlineKey(row.title); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0,5).map(candidate => candidate.row);
      }
      function renderNewsReader() {
        const reader = $('publisher-news-reader');
        const id = new URLSearchParams(location.search).get('article');
        const open = !!id && canReadNews();
        $('view-berita').classList.toggle('reading-article', open);
        reader.hidden = !open;
        $('publisher-news-browse').hidden = open;
        reader.innerHTML = '';
        if (!open) return;
        if (publisherNews) loadNewsArticle(id);
        const candidate = newsArticleDetail?.id === id ? newsArticleDetail : newsCurrentItems().find(row => row.id === id);
        const item = candidate && newsSourceInRegion(candidate.source) ? candidate : null;
        const source = item && publisherNews?.sources.find(row => row.id === item.source);
        const url = item && publisherUrl(item.url, item.source);
        const back = '<button type="button" class="news-reader-back" onclick="closeNewsArticle()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg> ' + newsText('Kembali ke berita', 'Back to news') + '</button>';
        if (!item || !source || !url) {
          const loading = !publisherNews && !publisherNewsFailed || newsArticleLoading === id;
          reader.innerHTML = back + '<h2 id="news-reader-title" tabindex="-1">' + (loading ? newsText('Memuat artikel…', 'Loading story…') : newsText('Berita belum tersedia', 'Story unavailable')) + '</h2><p>' + (loading ? newsText('Mengambil artikel dari arsip berita.', 'Retrieving the story from the news archive.') : newsText('Coba muat ulang berita atau kembali ke daftar.', 'Refresh the news or return to the list.')) + '</p>';
          return;
        }
        const full = item.source === 'federal_reserve' && /^https:\/\/www\.federalreserve\.gov\/newsevents\/speech\/[^/]+\.htm$/.test(url) && item.contentRights === 'public-domain' && Array.isArray(item.body) && item.body.length > 1;
        const paragraphs = full ? item.body.filter(text => typeof text === 'string') : item.excerpt ? [item.excerpt] : [];
        const image = publisherImageUrl(item.image);
        loadNewsCategory(newsCategoryKey());
        const related = relatedNews(item, newsCurrentItems(), publisherNews.sources, newsSourceInRegion);
        const relatedRows = related.map(row => {
          const publisher = publisherNews.sources.find(source => source.id === row.source);
          const photo = publisherImageUrl(row.image);
          return '<li><a class="news-related-link' + (photo ? '' : ' news-related-text-only') + '" href="' + esc(newsArticlePath(row.id)) + '"><span class="news-related-photo" aria-hidden="true">' + (photo ? '<img src="' + esc(photo) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</span><span><h4>' + esc(row.title) + '</h4><span class="news-related-meta">' + esc(publisher.name) + '</span><time class="news-related-meta">' + esc(publisherTime(row.publishedAt) || newsText('Waktu tidak tersedia', 'Time unavailable')) + '</time></span></a></li>';
        }).join('');
        const sidebar = '<aside class="news-related" aria-labelledby="news-related-title"><h3 id="news-related-title">' + newsText('Berita terkait', 'Related stories') + '</h3>' + (related.length ? '<ol>' + relatedRows + '</ol>' : '<p class="news-reader-meta">' + newsText('Belum ada berita terkait yang tersedia.', 'No related stories are available yet.') + '</p>') + '</aside>';
        reader.innerHTML = back + '<div class="news-reader-layout"><div class="news-reader-main"><header><p class="news-reader-publisher">' + esc(source.name) + '</p><h2 id="news-reader-title" tabindex="-1">' + esc(item.title) + '</h2><p class="news-reader-meta">' + (item.author ? '<span>' + esc(item.author) + '</span>' : '') + '<time>' + esc(publisherTime(item.publishedAt) || newsText('Waktu terbit tidak tersedia', 'Publication time unavailable')) + '</time></p></header>' + (image ? '<figure class="news-reader-media"><img class="news-reader-image" src="' + esc(image) + '" alt="" referrerpolicy="no-referrer"></figure>' : '') + (paragraphs.length ? '<p class="news-reader-format">' + (full ? newsText('Teks lengkap · Federal Reserve Board · Domain publik', 'Full text · Federal Reserve Board · Public domain') : newsText('Cuplikan dari penerbit', 'Publisher excerpt')) + '</p><div class="news-reader-body">' + paragraphs.map(text => '<p>' + esc(text) + '</p>').join('') + '</div>' : '') + '<footer><p class="news-reader-source-note">' + (full ? newsText('Teks resmi dari Federal Reserve Board.', 'Official text from the Federal Reserve Board.') : paragraphs.length ? newsText('Artikel lengkap tersedia di situs penerbit.', 'The complete article is available on the publisher website.') : newsText('Penerbit belum menyediakan cuplikan. Artikel lengkap dapat dibaca di sumber asli.', 'The publisher has not provided an excerpt. Read the complete article on the original source.')) + '</p><a class="news-reader-original" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + newsText('Baca artikel asli', 'Read original article') + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m7 17 10-10M7 7h10v10"/></svg></a></footer></div>' + sidebar + '</div>';
        reader.querySelectorAll('img').forEach(image => image.addEventListener('error', event => {
          const photo = event.target.closest('.news-related-photo');
          if (photo) { photo.hidden = true; photo.closest('a').classList.add('news-related-text-only'); }
          event.target.closest('.news-reader-media')?.remove();
          event.target.remove();
        }, {once:true}));
      }
      window.closeNewsArticle = function () {
        history.pushState(null, '', pagePath('economic-news'));
        renderPublisherNews();
        $('news-search').focus({preventScroll:true});
      };
      for (const container of ['publisher-news-list', 'publisher-news-reader']) $(container).addEventListener('click', event => {
        const link = event.target.closest('.publisher-story-link, .news-related-link');
        if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        history.pushState(null, '', link.href);
        renderNewsReader();
        $('news-reader-title')?.focus({preventScroll:true});
        $('publisher-news-reader').scrollIntoView({block:'start'});
      });
      window.renderPublisherNews = function () {
        renderNewsRegionControls();
        renderNewsReader();
        if (!canReadNews()) { $('publisher-news-list').innerHTML = ''; return; }
        detectNewsRegion();
        $('fomc-panel').hidden = newsCategory !== 'fed';
        if (window.renderFedWatch) window.renderFedWatch();
        const status = $('publisher-news-status');
        if (!status) return;
        if (!publisherNews) {
          status.textContent = publisherNewsFailed ? newsText('Berita belum dapat dimuat. Buka situs penerbit atau coba lagi.', 'News could not be loaded. Visit a publisher or try again.') : newsText('Memuat berita terbaru...', 'Loading the latest headlines...');
          return;
        }
        const checkedAt = newsCategoryFeed?.key === newsCategoryKey() ? newsCategoryFeed.checkedAt : newsSourceFeed?.sources[0]?.id === $('news-source').value ? newsSourceFeed.checkedAt : publisherNews.checkedAt;
        const checked = publisherTime(checkedAt);
        const aged = Date.now() - new Date(checkedAt).getTime() > 90 * 60000;
        status.textContent = (publisherNewsFailed ? newsText('Pembaruan gagal; menampilkan data tersimpan. ', 'Refresh failed; showing the saved feed. ') : '') + (aged ? newsText('Data belum diperbarui. ', 'The feed has not been updated recently. ') : '') + newsText('Terakhir diperiksa: ', 'Last checked: ') + (checked || newsText('Tidak tersedia', 'Unavailable'));
        const select = $('news-source');
        const curated = new Map([...(NEWS_REGIONS[activeNewsRegion()] || NEWS_REGIONS.DEFAULT || []), ...GLOBAL_NEWS_SOURCES].map(portal => [portal.id, portal]));
        const populatedSources = new Set(publisherNews.items.map(item => item.source));
        const availableSources = publisherNews.sources.filter(source => source.kind !== 'tool' && populatedSources.has(source.id) && newsSourceInRegion(source.id)).map(source => {
          const portal = curated.get(source.id);
          return portal ? {...source, name:portal.name, url:portal.url, tag:portal.tag} : source;
        });
        const selected = canSelectNewsArea(select.value) || availableSources.some(source => source.id === select.value) ? select.value : '';
        if (selected !== newsSelectedSource) { newsVisibleCount = 12; newsSelectedSource = selected; newsSourceAttempt = ''; }
        select.innerHTML = newsSourceOptions(availableSources);
        select.value = selected;
        window.syncNewsSelects?.();
        const categoryKey = newsCategoryKey();
        if (categoryKey) loadNewsCategory(categoryKey);
        else if (selected && !newsAreaCodes.includes(selected)) loadNewsSource(selected);
        if (categoryKey && newsCategoryLoading === categoryKey) status.textContent += newsText(' · Memuat arsip kategori…', ' · Loading category archive…');
        else if (categoryKey && newsCategoryFailed && newsCategoryAttempt === categoryKey) status.textContent += newsText(' · Arsip belum dapat diperbarui; hasil tersimpan mungkin terbatas.', ' · Archive refresh failed; saved results may be limited.');
        if (newsSourceLoading === selected && selected) status.textContent += newsText(' · Memuat sumber…', ' · Loading source…');
        else if (newsSourceFailed && newsSourceAttempt === selected) status.textContent += newsText(' · Pembaruan sumber gagal; menampilkan berita tersimpan.', ' · Source refresh failed; showing saved stories.');
        const sources = new Map(availableSources.map(source => [source.id, source]));
        const rows = newsCurrentItems().filter(item => sources.has(item.source) && newsSourceMatchesSelection(item.source, selected) && (!newsCategory || ((item.category || 'other') === newsCategory || item.topics?.includes(newsCategory))) && newsMatchesSearch(item, sources.get(item.source)?.name, newsQuery));
        const portal = sources.get(selected);
        const portalLink = $('news-publisher-link');
        portalLink.hidden = !portal;
        portalLink.innerHTML = portal ? '<a href="' + esc(publisherUrl(portal.url, portal.id)) + '" target="_blank" rel="noopener noreferrer">' + esc(newsText('Buka ', 'Visit ') + portal.name) + '</a>' : '';
        $('news-search-info').hidden = !newsQuery.trim();
        $('news-search-info').textContent = newsQuery.trim() ? rows.length.toLocaleString(language) + newsText(' berita cocok', ' matching stories') + (newsCategoryLoading === categoryKey && categoryKey ? newsText(' · pencarian arsip berlangsung…', ' · searching archive…') : '') : '';
        document.querySelectorAll('#news-categories [data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === newsCategory)));
        $('news-more-category').value = ['local','science','sport','other'].includes(newsCategory) ? newsCategory : '';
        document.querySelector('.publisher-grid-heading').textContent = newsCategory ? newsText(...newsCategoryNames[newsCategory]) : newsText('Berita terbaru', 'Latest stories');
        $('news-more').hidden = rows.length <= newsVisibleCount;
        $('publisher-news-list').innerHTML = rows.length ? rows.slice(0, newsVisibleCount).map(item => {
          const url = publisherUrl(item.url, item.source);
          const source = sources.get(item.source);
          if (!url || !source) return '';
          const time = publisherTime(item.publishedAt) || newsText('Waktu terbit tidak disediakan penerbit', 'Publication time not provided by the publisher');
          const image = publisherImageUrl(item.image);
          const media = '<span class="publisher-photo"><span class="publisher-photo-fallback" aria-hidden="true"><small>' + newsText('Foto tidak tersedia', 'Photo unavailable') + '</small></span>' + (image ? '<img src="' + esc(image) + '" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</span>';
          return '<article class="publisher-news-item"><a class="publisher-story-link" href="' + esc(newsArticlePath(item.id)) + '">' + media + '<h3>' + esc(item.title) + '</h3></a><p class="publisher-news-meta"><span>' + esc(source.name) + '</span><time' + (publisherTime(item.publishedAt) ? ' datetime="' + esc(item.publishedAt) + '"' : '') + '>' + esc(time) + '</time></p></article>';
        }).join('') : '<p>' + (newsSourceLoading === selected && selected ? newsText('Memuat berita dari sumber ini…','Loading stories from this source…') : selected === 'ANTARCTICA' || activeNewsRegion() === 'ANTARCTICA' ? newsText('Belum ada portal berita Antarktika yang dikonfigurasi.','No Antarctic news publishers are configured yet.') : portal?.kind === 'external' ? newsText('Portal ini belum menyediakan feed otomatis yang terverifikasi. Gunakan tautan penerbit di atas.','This portal has no verified automatic feed yet. Use the publisher link above.') : portal?.status === 'unavailable' || portal?.status === 'stale' ? newsText('Feed penerbit belum dapat diperbarui. Buka sumber atau coba lagi nanti.','The publisher feed could not be refreshed. Visit the source or try again later.') : !availableSources.length ? newsText('Belum ada portal yang dikonfigurasi untuk negara ini.', 'No publisher portals are configured for this country yet.') : newsQuery.trim() ? newsText('Tidak ada berita yang cocok. Coba kata kunci lain atau hapus filter kategori dan sumber.', 'No stories match your search. Try different keywords or clear the category and source filters.') : newsText('Belum ada berita yang sesuai filter ini. Pilih kategori atau sumber lain.', 'No stories match these filters. Choose another category or source.')) + '</p>';
        $('publisher-news-list').querySelectorAll('img').forEach(img => { img.addEventListener('error', () => img.remove(), { once: true }); });
      };
      window.selectNewsCategory = function (value) { newsCategory = newsCategoryNames[value] ? value : ''; newsVisibleCount = 12; renderPublisherNews(); };
      window.showMoreNews = function () { newsVisibleCount += 12; renderPublisherNews(); };
      window.reloadPublisherNews = async function () {
        if (!canReadNews()) return;
        if (publisherNewsBusy) return;
        publisherNewsBusy = true;
        const revision = newsDataRevision, userId = cloudUser.id;
        const current = () => revision === newsDataRevision && cloudUser?.id === userId && canReadNews();
        const accept = data => {
          if (!current() || publisherNews && Date.parse(data.checkedAt) < Date.parse(publisherNews.checkedAt)) return;
          publisherNews = data;
          for (const portals of Object.values(NEWS_REGIONS)) for (const portal of portals) {
            if (!publisherNews.sources.some(source => source.id === portal.id)) publisherNews.sources.push({...portal, kind:portal.kind || (portal.feed ? 'rss' : 'external'), status:'unavailable'});
          }
          renderPublisherNews();
        };
        $('news-refresh').disabled = true;
        $('publisher-news-list').setAttribute('aria-busy', 'true');
        try {
          await loadRegionalSources();
          if (!current()) return;
          const result = await loadNewsFile('news/index.json', normalizeNewsFeed, accept, current);
          if (!current()) return;
          publisherNewsFailed = result.saved;
          accept(result.data);
          const source = $('news-source').value;
          const category = newsCategoryKey();
          if (category && newsCategoryLoading !== category) await loadNewsCategory(category, true);
          else if (!category && source && !newsAreaCodes.includes(source) && newsSourceLoading !== source) await loadNewsSource(source, true);
          if (!newsArticleLoading) newsArticleAttempt = '';
          renderNewsReader();
        } catch { if (current()) publisherNewsFailed = true; }
        finally { if (revision === newsDataRevision) { publisherNewsBusy = false; $('news-refresh').disabled = false; $('publisher-news-list').setAttribute('aria-busy', 'false'); renderPublisherNews(); } }
      };
      async function retryNewsConnection() {
        if (canReadNews() && cloudReady) return reloadPublisherNews();
        if (!cloudClient) return;
        const revision = cloudAuthRevision;
        try {
          const {data, error} = await cloudClient.auth.getSession();
          if (error || revision !== cloudAuthRevision || !data?.session?.user) return;
          const user = data.session.user;
          if (!cloudReady || cloudUser?.id !== user.id) await hydrateCloud(user);
          else await verifyNewsIdentity(user.id, revision);
        } catch {}
      }
      setInterval(() => { if (!document.hidden) reloadPublisherNews(); }, 300000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reloadPublisherNews(); });

      /* Sub-view Switcher */
      window.switchBeritaSub = function (sub, updateUrl = true) {
        if (!canReadNews()) return;
        renderNewsRegionControls(); detectNewsRegion();
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
          script.onerror = () => { ticker.textContent = uiText('Harga tidak tersedia. Muat ulang untuk mencoba lagi.', 'Prices unavailable. Please refresh to retry.'); };
          ticker.appendChild(script);
        }

        if (sub === 'ringkasan') {
          renderPublisherNews();
        } else if (sub === 'kalender') {
          renderEconomicCalendar();
        }
        const route = 'economic-news' + (sub === 'ringkasan' ? '' : '/calendar');
        if (updateUrl && (location.pathname !== pagePath(route) || location.search)) { history.pushState(null, '', pagePath(route)); renderNewsReader(); }
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
        const proIndex = proPaths.indexOf(parts.join('/'));
        if (proIndex >= 0) { openProAnalytics(proIndex, false); return; }
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
      window.JTI18n?.ready.then(() => {
        language = window.JTI18n.language;
        $('language-select').replaceChildren(...window.JTI18n.languages.map(row => {
          const option = document.createElement('option');
          option.value = row.code; option.textContent = row.nativeName === row.name ? row.name : row.nativeName + ' · ' + row.name;
          option.disabled = row.available === false;
          if (option.disabled) option.textContent += ' · ' + window.JTI18n.key('languageUnavailableShort', 'Translation pending');
          return option;
        }));
        renderJournalTable(); renderStatistics(); renderProfileView(); updateAccess();
      }).catch(error => console.error('Language catalog unavailable', error));
      window.addEventListener('popstate', restoreRoute);
      window.addEventListener('hashchange', () => { if (location.pathname === pagePath('login')) restoreRoute(); });
      refreshExchangeRate();
      setInterval(() => { if (!document.hidden) refreshExchangeRate(); }, 3600000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - exchangeCheckedAt >= 3600000) refreshExchangeRate(); });
      window.addEventListener('online', scheduleCloudSave);
      window.addEventListener('online', () => { if (!document.hidden) retryNewsConnection(); });
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
