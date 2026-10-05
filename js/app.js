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
      let profile = { name: 'Radit', currentAccount: 'demo_acc' };
      let currentEditingTradeId = null;
      let parsedTradesToImport = [];

      /* Safe Element Selector */
      const $ = id => document.getElementById(id);
      const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      const safeId = value => /^[\w-]{1,80}$/.test(String(value || '')) ? String(value) : '';

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
          if (setRaw) { const value = JSON.parse(setRaw); if (value && typeof value === 'object' && !Array.isArray(value)) settings = { kurs: Number(value.kurs) || 17000, billingAnnual: !!value.billingAnnual }; }
          if (profRaw) { const value = JSON.parse(profRaw); if (value && typeof value === 'object' && !Array.isArray(value)) profile = { name: String(value.name || 'Trader').slice(0, 80), currentAccount: safeId(value.currentAccount) }; }

          if (!accounts.length || !trades || !trades.length) {
            const initial = getInitialDemoData();
            if (!accounts.length) accounts = [initial.acc];
            if (!trades || !trades.length) trades = initial.trades;
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
      }

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
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      /* Header Account Dropdown Menu */
      window.toggleNavAccountDropdown = function (e) {
        if (e) e.stopPropagation();
        const dd = $('nav-account-dropdown');
        const btn = $('btn-nav-masuk');
        if (!dd) return;
        const isHidden = dd.hidden;
        dd.hidden = !isHidden;
        if (btn) btn.classList.toggle('active', isHidden);
      };

      window.closeNavAccountDropdown = function () {
        const dd = $('nav-account-dropdown');
        const btn = $('btn-nav-masuk');
        if (dd) dd.hidden = true;
        if (btn) btn.classList.remove('active');
      };

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown-wrap')) {
          closeNavAccountDropdown();
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
        const btnM = $('btn-monthly');
        const btnA = $('btn-annual');
        const starterPrice = $('starter-price');
        const starterPeriod = $('starter-period');
        const tiersPrice = $('tiers-price');
        const tiersPeriod = $('tiers-period');
        const annualPrice = $('annual-price');
        const annualPeriod = $('annual-period');

        // Optional legacy fallback elements
        const sw = $('billing-switch');
        const lblM = $('lbl-monthly');
        const lblA = $('lbl-annual');
        const proPrice = $('pro-price');
        const proPeriod = $('pro-period');
        const maxPrice = $('max-price');
        const maxPeriod = $('max-period');

        if (settings.billingAnnual) {
          if (btnA) btnA.classList.add('active');
          if (btnM) btnM.classList.remove('active');
          if (starterPrice) starterPrice.textContent = '$28.68';
          if (starterPeriod) starterPeriod.textContent = '/ month (annual)';
          if (tiersPrice) tiersPrice.textContent = '$599';
          if (tiersPeriod) tiersPeriod.textContent = '/ month (annual)';
          if (annualPrice) annualPrice.textContent = '$2800';
          if (annualPeriod) annualPeriod.textContent = '/ month (annual)';

          if (sw) sw.classList.add('annual');
          if (lblA) lblA.classList.add('active');
          if (lblM) lblM.classList.remove('active');
          if (proPrice) proPrice.textContent = '$15';
          if (proPeriod) proPeriod.textContent = '/ bln (ditagih tahunan)';
          if (maxPrice) maxPrice.textContent = '$39';
          if (maxPeriod) maxPeriod.textContent = '/ bln (ditagih tahunan)';
        } else {
          if (btnM) btnM.classList.add('active');
          if (btnA) btnA.classList.remove('active');
          if (starterPrice) starterPrice.textContent = '$35.85';
          if (starterPeriod) starterPeriod.textContent = '/ month';
          if (tiersPrice) tiersPrice.textContent = '$750';
          if (tiersPeriod) tiersPeriod.textContent = '/ month';
          if (annualPrice) annualPrice.textContent = '$3500';
          if (annualPeriod) annualPeriod.textContent = '/ month';

          if (sw) sw.classList.remove('annual');
          if (lblM) lblM.classList.add('active');
          if (lblA) lblA.classList.remove('active');
          if (proPrice) proPrice.textContent = '$19';
          if (proPeriod) proPeriod.textContent = '/ bulan';
          if (maxPrice) maxPrice.textContent = '$49';
          if (maxPeriod) maxPeriod.textContent = '/ bulan';
        }
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
        let jTotalRR = 0;

        trades.forEach(t => {
          const m = computeTradeMetrics(t);
          jTotalRR += m.rr;
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
        const jAvgRR = jTotal ? (jTotalRR / jTotal) : 0;

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
        if ($('j-stat-rr')) $('j-stat-rr').textContent = `1 : ${jAvgRR.toFixed(2)}`;

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
              <td>${esc(t.riskPct ?? 1)}%</td>
              <td>${fmtUSD(m.riskUSD)}</td>
              <td>${(m.rr || 0).toFixed(2)}</td>
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
        $('upload-modal').classList.add('open');
        $('upload-preview-area').style.display = 'none';
        $('btn-confirm-import').style.display = 'none';
        const chips = $('fu-06-chips');
        if (chips) chips.innerHTML = '';
        $('upload-status-msg').textContent = 'Pilih berkas dari perangkat Anda atau seret ke area dropzone di atas.';
        parsedTradesToImport = [];
      };

      window.closeUploadModal = function () {
        $('upload-modal').classList.remove('open');
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

        if (input) {
          input.addEventListener('change', () => {
            if (input.files && input.files.length) {
              updateFuChips(input.files);
              processUploadFile(input.files[0]);
            }
          });
        }
      }

      window.handleSelectedFile = function (input) {
        if (input.files && input.files.length) {
          updateFuChips(input.files);
          processUploadFile(input.files[0]);
        }
      };

      function processUploadFile(file) {
        const status = $('upload-status-msg');
        parsedTradesToImport = [];

        // Strict 10 MB upload limit check
        const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
        if (file.size > MAX_SIZE_BYTES) {
          const actualMB = (file.size / (1024 * 1024)).toFixed(2);
          status.innerHTML = `<span style="color:var(--red); font-weight:700;">Gagal: Ukuran file (${actualMB} MB) melebihi batas maksimum 10 MB.</span><br><span style="color:var(--text-muted); font-size:11.5px;">Silakan unggah dokumen yang lebih ringkas atau kompres file.</span>`;
          $('btn-confirm-import').style.display = 'none';
          $('upload-preview-area').style.display = 'none';
          return;
        }

        status.textContent = `Membaca ${file.name} (${formatFileSize(file.size)})...`;
        const ext = file.name.split('.').pop().toLowerCase();
        parsedTradesToImport = [];

        // 1. Text & CSV Files (.txt, .csv)
        if (ext === 'txt' || ext === 'csv') {
          const reader = new FileReader();
          reader.onload = function (e) {
            parseTextOrCSV(e.target.result);
          };
          reader.readAsText(file);
        }
        // 2. Excel Files (.xlsx, .xls)
        else if (ext === 'xlsx' || ext === 'xls') {
          const reader = new FileReader();
          reader.onload = function (e) {
            parseTextOrCSV(e.target.result); // parses binary text representation or structured text
          };
          reader.readAsText(file);
        }
        // 3. Image Files (.png, .jpg, .jpeg)
        else if (['png', 'jpg', 'jpeg'].includes(ext)) {
          status.innerHTML = `<span style="color:var(--green);">✓ Screenshot chart berhasil dimuat: ${esc(file.name)}</span><br>Foto setup trade siap diarsipkan ke jurnal trade.`;
          // Create dummy entry matching screenshot
          parsedTradesToImport = [{
            id: 't_' + Date.now(),
            accountId: profile.currentAccount || 'demo_acc',
            date: new Date().toISOString().slice(0, 10),
            jam: new Date().toTimeString().slice(0, 5),
            market: 'XAUUSD',
            posisi: 'Buy',
            entry: 3340.0,
            sl: 3330.0,
            tp: 3360.0,
            vol: 0.10,
            riskPct: 1.0,
            result: 'Win',
            strategy: 'Chart Screenshot Analysis',
            tf: 'H1',
            reason: `Setup dari berkas: ${file.name}`
          }];
          showUploadPreview(parsedTradesToImport);
        }
        // 4. PDF Statement Files (.pdf)
        else if (ext === 'pdf') {
          const reader = new FileReader();
          reader.onload = function (e) {
            // Extract text tokens from PDF buffer
            parsePDFText(e.target.result);
          };
          reader.readAsText(file);
        } else {
          status.innerHTML = `<span style="color:var(--red);">Format file .${esc(ext)} belum didukung. Gunakan PDF, TXT, CSV, atau PNG.</span>`;
        }
      }

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

      function parsePDFText(rawContent) {
        // Simple regex scan for pairs and prices in statement text
        const matches = rawContent.match(/(XAUUSD|EURUSD|GBPUSD|BTCUSD|USDJPY)[^\d]*([\d\.]+)[^\d]*([\d\.]+)/gi);
        const parsed = [];
        const today = new Date().toISOString().slice(0, 10);

        if (matches && matches.length) {
          matches.slice(0, 10).forEach(m => {
            const parts = m.split(/\s+/);
            const market = parts[0].toUpperCase();
            const nums = parts.filter(p => !isNaN(parseFloat(p))).map(Number);
            if (nums.length >= 2) {
              parsed.push({
                id: 't_pdf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                accountId: profile.currentAccount || 'demo_acc',
                date: today,
                jam: '12:00',
                market: market,
                posisi: 'Buy',
                entry: nums[0],
                sl: nums[1] < nums[0] ? nums[1] : nums[0] - 10,
                tp: nums[0] + Math.abs(nums[0] - nums[1]) * 2,
                vol: 0.05,
                riskPct: 1.0,
                result: 'Win',
                strategy: 'PDF Statement Parse',
                tf: 'H1',
                reason: 'Ekstrak laporan PDF'
              });
            }
          });
        }

        if (parsed.length) {
          parsedTradesToImport = parsed;
          showUploadPreview(parsed);
          $('upload-status-msg').innerHTML = `<span style="color:var(--green);">✓ Berhasil mengekstrak ${parsed.length} posisi trade dari laporan PDF!</span>`;
        } else {
          $('upload-status-msg').innerHTML = `<span style="color:var(--orange);">PDF terenkripsi atau berformat gambar. Silakan gunakan format CSV/Excel atau tempel teks langsung.</span>`;
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
        let totalRR = 0;
        let currentBalance = startBal;
        let peakBalance = startBal;
        let maxDrawdownUSD = 0;
        const equityCurve = [startBal];

        // Sort trades chronologically for stats
        const chronological = [...trades].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

        let bestWinUSD = 0;
        let worstLossUSD = 0;
        let maxWinStreak = 0;
        let currentStreak = 0;

        chronological.forEach(t => {
          const m = computeTradeMetrics(t, acc);
          totalRR += m.rr;

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

        const totalTrades = trades.length;
        const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
        const netPL = sumWinUSD - sumLossUSD;
        const profitFactor = sumLossUSD > 0 ? (sumWinUSD / sumLossUSD) : (sumWinUSD > 0 ? 99 : 0);
        const avgRR = totalTrades ? (totalRR / totalTrades) : 0;
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
        $('kpi-avg-rr').textContent = avgRR.toFixed(2) + 'R';
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
        $('p-trader-name').value = profile.name || 'Radit';
        $('p-kurs-input').value = settings.kurs || 17000;

        // Trader Passport Card updates
        const traderName = profile.name || 'Radit';
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
        const kurs = parseFloat($('p-kurs-input').value) || 17000;
        settings.kurs = kurs;
        saveData();
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
              if (data.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) settings = { kurs: Number(data.settings.kurs) || 17000, billingAnnual: !!data.settings.billingAnnual };
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
          (adaAngka ? '<div class="kal-ang">Akt <b class="' + cls.trim() + '">' + esc(x.akt || '—') +
            '</b> &middot; Perk ' + esc(x.prk || '—') + ' &middot; Sblm ' + esc(x.sbl || '—') + '</div>' : '') +
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

2. *Zona Demand & Order Block*: Area mitigasi $3,310–$3,322 merupakan _Bullish Order Block (OB)_ institusional yang berhimpitan dengan _Fair Value Gap (FVG)_ H4 yang belum terisi penuh.

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

* *Titik Masuk Ideal*: Retest area FVG M15 di kisaran 1.0895–1.0905.
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

Arus dana masuk ETF spot terus mencatatkan net positive. Kluster likuidasi short terkonsentrasi di area $96,500–$97,200 yang menjadi magnet harga berikutnya.

* *Area Demand Kunci*: $92,800–$93,500 (Zona akumulasi CME).
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

Indeks US30 bergerak sideways di range 43,700–44,050. Pelaku pasar bersikap wait-and-see menjelang pembacaan angka Core PCE dan rilis laba sektor perbankan AS.

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

    })();
