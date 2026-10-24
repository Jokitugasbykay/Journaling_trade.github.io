(function () {
  'use strict';

  const home = document.getElementById('view-beranda');
  if (!home) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visited = false;
  try { visited = localStorage.getItem('jt_seen_intro') === '1'; } catch {}

  function updateMotionState() {
    const active = home.classList.contains('active');
    home.classList.toggle('home-motion-paused', document.hidden || !active || reduced.matches);
    if (!active || reduced.matches) home.classList.toggle('home-play-intro', false);
    if (active && !document.hidden && !visited) {
      visited = true;
      home.classList.toggle('home-play-intro', !reduced.matches);
      try { localStorage.setItem('jt_seen_intro', '1'); } catch {}
    }
  }

  home.addEventListener('animationend', event => {
    if (event.animationName === 'home-candle-grow' && event.target.style.getPropertyValue('--i') === '17') {
      home.classList.toggle('home-play-intro', false);
    }
  });

  new MutationObserver(updateMotionState).observe(home, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', updateMotionState);
  reduced.addEventListener('change', updateMotionState);

  if ('IntersectionObserver' in window) {
    const nativeReveal = CSS.supports('animation-timeline', 'view()');
    if (!nativeReveal) home.classList.add('home-reveal-fallback');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) entry.target.classList.add('home-visible');
        entry.target.classList.toggle('home-demo-paused', !entry.isIntersecting);
      }
    }, { threshold: 0.08 });
    home.querySelectorAll('.home-reveal,.home-hero-visual').forEach(element => observer.observe(element));
  }

  /* Audio Synthesizer (Synthetic subtle sound feedback, zero external audio assets) */
  let audioCtx = null;
  let audioEnabled = false;
  function playSyntheticBeep(freq = 640, type = 'sine', duration = 0.08, gainVal = 0.05) {
    if (!audioEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {}
  }

  /* ========================================================
     1. HERO TRADING TERMINAL (ACTIVE PAIRS & LIVE STREAM)
     ======================================================== */
  (function initHeroTerminal() {
    if (typeof document.querySelectorAll !== 'function') return;
    const pairs = {
      'EUR/USD': { price: '1.08450', tp: '+3.2R / +$320', sl: '-1.0R / -$100', rr: '1 : 3.2', lot: '0.32 Lots', profit: '+$320.00', risk: '-$100.00' },
      'XAU/USD': { price: '2650.00', tp: '+3.5R / +$350', sl: '-1.0R / -$100', rr: '1 : 3.5', lot: '0.40 Lots', profit: '+$350.00', risk: '-$100.00' },
      'BTC/USD': { price: '68,200.0', tp: '+3.0R / +$300', sl: '-1.0R / -$100', rr: '1 : 3.0', lot: '0.05 BTC', profit: '+$300.00', risk: '-$100.00' }
    };

    const pairBtns = document.querySelectorAll('.terminal-pair-btn');
    pairBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        pairBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const pKey = btn.dataset.pair || 'EUR/USD';
        const d = pairs[pKey] || pairs['EUR/USD'];

        const elPrice = document.getElementById('hero-live-price');
        const elTp = document.getElementById('hint-tp-val');
        const elEntry = document.getElementById('hint-entry-val');
        const elSl = document.getElementById('hint-sl-val');
        const elRr = document.getElementById('hero-hud-rr');
        const elLot = document.getElementById('hero-hud-lot');
        const elProfit = document.getElementById('hero-hud-profit');
        const elRisk = document.getElementById('hero-hud-risk');

        if (elPrice) elPrice.textContent = d.price;
        if (elTp) elTp.textContent = d.tp;
        if (elEntry) elEntry.textContent = d.price;
        if (elSl) elSl.textContent = d.sl;
        if (elRr) elRr.textContent = d.rr;
        if (elLot) elLot.textContent = d.lot;
        if (elProfit) elProfit.textContent = d.profit;
        if (elRisk) elRisk.textContent = d.risk;

        playSyntheticBeep(720, 'sine', 0.05);
      });
    });
  })();

  /* ========================================================
     2. PRO WORKSPACE MODULES PREVIEW & MODERN LOADING TAB
     ======================================================== */
  (function initProTabsPreview() {
    if (typeof document.querySelectorAll !== 'function') return;
    const tabBtns = document.querySelectorAll('.tab-preview-btn');
    const loader = document.getElementById('tab-preview-loader');
    const content = document.getElementById('tab-preview-content');
    const loaderTitle = document.getElementById('preview-loader-title');
    const loaderSub = document.getElementById('preview-loader-sub');
    const statusLabel = document.getElementById('tab-preview-status-label');
    const retryBtn = document.getElementById('btn-preview-retry');

    if (!tabBtns.length || !content) return;

    const modules = {
      'ai-behaviour': {
        name: 'AI Behaviour Analysis',
        title: 'Memuat AI Behaviour Analysis...',
        sub: 'Mengaudit pola psikologis, FOMO, overtrading, dan kedisiplinan rule...',
        status: 'Modul aktif: AI Behaviour Analysis',
        metrics: [
          { label: 'FOMO Index', val: '4.2% (Minimal)', cls: 'highlight-green' },
          { label: 'Revenge Risk', val: '0.0% (Clean)', cls: 'highlight-green' },
          { label: 'Rule Discipline', val: '96.8% (Strict)', cls: 'highlight-cyan' },
          { label: 'Session Adherence', val: '100% (Killzones)', cls: 'highlight-cyan' }
        ],
        insight: {
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
          title: 'Gemini AI Psychology Audit',
          text: 'Disiplin eksekusi London Killzone terjaga 100%. Tidak ditemukan transaksi impulsif atau revenge trade setelah pergerakan likuiditas news.'
        }
      },
      'analytics': {
        name: 'Advanced Analytics',
        title: 'Memuat Advanced Analytics...',
        sub: 'Menghitung expectancy, profit factor, win rate, dan kurva distribusi...',
        status: 'Modul aktif: Advanced Analytics',
        metrics: [
          { label: 'Win Rate', val: '68.4%', cls: 'highlight-green' },
          { label: 'Profit Factor', val: '2.45', cls: 'highlight-green' },
          { label: 'Avg R:R Ratio', val: '1 : 2.8', cls: 'highlight-cyan' },
          { label: 'Max Drawdown', val: '3.8%', cls: 'highlight-red' }
        ],
        insight: {
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>',
          title: 'Statistical Edge Validation',
          text: 'Rasio Risk-Reward 1:2.8 menghasilkan reli equity yang konsisten dan stabil. Drawdown maksimum terkontrol ketat di bawah batas toleransi 4%.'
        }
      },
      'heatmap': {
        name: 'Performance Heatmap',
        title: 'Memuat Performance Heatmap...',
        sub: 'Menyusun matriks sesi global & densitas performa berdasarkan jam pasar...',
        status: 'Modul aktif: Performance Heatmap',
        metrics: [
          { label: 'London Session', val: '+7.40R Net', cls: 'highlight-green' },
          { label: 'NY Open Sweep', val: '+5.20R Net', cls: 'highlight-green' },
          { label: 'Asian Consolidation', val: '+1.10R Net', cls: 'highlight-cyan' },
          { label: 'NY Late Close', val: '-0.80R Net', cls: 'highlight-red' }
        ],
        insight: {
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
          title: 'Global Liquidity Heatmap',
          text: 'Win-rate tertinggi (75%) terjadi saat London Open (08:00 - 11:00 BST). Sesi akhir New York menghasilkan ekspektansi negatif dan disarankan dihindari.'
        }
      },
      'risk': {
        name: 'Institutional Risk Engine',
        title: 'Memuat Institutional Risk Engine...',
        sub: 'Memvalidasi batas risiko modal per trade, kalkulasi lot pip, dan drawdown cap...',
        status: 'Modul aktif: Institutional Risk Engine',
        metrics: [
          { label: 'Risk Per Trade', val: '1.0% ($100.00)', cls: 'highlight-cyan' },
          { label: 'Max Lot Cap', val: '0.40 Lots', cls: 'highlight-cyan' },
          { label: 'Daily Stop Limit', val: '-$300.00 (3R)', cls: 'highlight-red' },
          { label: 'Circuit Breaker', val: 'Protected', cls: 'highlight-green' }
        ],
        insight: {
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
          title: 'Capital Preservation Engine',
          text: 'Setiap posisi dikunci pada batas maksimal risiko 1% balance akun. Perhitungan otomatis konversi USD ke IDR langsung menggunakan kurs Bank Indonesia.'
        }
      },
      'reports': {
        name: 'Review Reports',
        title: 'Memuat Automated Review Reports...',
        sub: 'Menyusun ringkasan mingguan, scorecard eksekusi, dan laporan PDF terverifikasi...',
        status: 'Modul aktif: Automated Review Reports',
        metrics: [
          { label: 'Total Executions', val: '14 Trades', cls: 'highlight-cyan' },
          { label: 'Net Cumulative', val: '+12.60R', cls: 'highlight-green' },
          { label: 'Best Setup', val: 'Silver Bullet', cls: 'highlight-green' },
          { label: 'PDF Status', val: 'Ready to export', cls: 'highlight-cyan' }
        ],
        insight: {
          icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
          title: 'Institutional Trade Journal Review',
          text: 'Laporan otomatis merangkum snapshot equity mingguan, kepatuhan stop loss 100%, serta rekomendasi perbaikan untuk persiapan trading pekan depan.'
        }
      }
    };

    let currentTab = 'ai-behaviour';
    let isTransitioning = false;

    function renderModuleContent(key) {
      const mod = modules[key] || modules['ai-behaviour'];
      let metricsHtml = '<div class="tab-content-grid">';
      mod.metrics.forEach(m => {
        metricsHtml += `
          <div class="tab-metric-box">
            <div class="tab-metric-label">${m.label}</div>
            <div class="tab-metric-val ${m.cls}">${m.val}</div>
          </div>
        `;
      });
      metricsHtml += '</div>';

      const insightHtml = `
        <div class="tab-insight-card">
          <div class="tab-insight-icon">${mod.insight.icon}</div>
          <div class="tab-insight-body">
            <h4>${mod.insight.title}</h4>
            <p>${mod.insight.text}</p>
          </div>
        </div>
      `;

      content.innerHTML = metricsHtml + insightHtml;
    }

    function switchModule(key) {
      if (isTransitioning) return;
      isTransitioning = true;
      currentTab = key;

      tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === key);
      });

      const mod = modules[key] || modules['ai-behaviour'];
      if (loaderTitle) loaderTitle.textContent = mod.title;
      if (loaderSub) loaderSub.textContent = mod.sub;
      if (statusLabel) statusLabel.textContent = mod.status;

      content.style.display = 'none';
      if (loader) loader.style.display = 'flex';

      playSyntheticBeep(640, 'sine', 0.05);

      setTimeout(() => {
        renderModuleContent(key);
        if (loader) loader.style.display = 'none';
        content.style.display = 'block';
        isTransitioning = false;
        playSyntheticBeep(880, 'sine', 0.06);
      }, 500);
    }

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.tab;
        if (key) switchModule(key);
      });
    });

    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        switchModule(currentTab);
      });
    }

    renderModuleContent('ai-behaviour');
  })();
/* ========================================================
     3. INTERACTIVE RISK PLAYGROUND (SECTION 02)
     ======================================================== */
  (function initRiskPlayground() {
    const sBal = document.getElementById('risk-slide-balance');
    const sPct = document.getElementById('risk-slide-pct');
    const sSl = document.getElementById('risk-slide-sl');
    if (!sBal || !sPct || !sSl) return;

    function recalcRisk() {
      const balance = parseFloat(sBal.value);
      const pct = parseFloat(sPct.value);
      const slPips = parseFloat(sSl.value);

      const valBal = document.getElementById('risk-val-balance');
      const valPct = document.getElementById('risk-val-pct');
      const valSl = document.getElementById('risk-val-sl');

      if (valBal) valBal.textContent = '$' + balance.toLocaleString();
      if (valPct) valPct.textContent = pct.toFixed(1) + '%';
      if (valSl) valSl.textContent = slPips + ' pips';

      const riskUsd = balance * (pct / 100);
      const lots = Math.max(0.01, (riskUsd / (slPips * 10))).toFixed(2);
      const riskIdr = Math.round(riskUsd * 16400);

      const resLot = document.getElementById('risk-res-lot');
      const resUsd = document.getElementById('risk-res-usd');
      const resIdr = document.getElementById('risk-res-idr');

      if (resLot) resLot.textContent = lots + ' Lots';
      if (resUsd) resUsd.textContent = '-$' + riskUsd.toFixed(2);
      if (resIdr) resIdr.textContent = 'Rp ' + riskIdr.toLocaleString();

      const badge = document.getElementById('risk-live-badge');
      if (badge) {
        if (pct <= 2.0) {
          badge.className = 'risk-live-status-pill passed';
          badge.textContent = 'Institutional discipline: 1% risk limit respected';
        } else {
          badge.className = 'risk-live-status-pill warning';
          badge.textContent = 'High risk warning: exceeds 2% capital threshold';
        }
      }
    }

    [sBal, sPct, sSl].forEach(el => el.addEventListener('input', recalcRisk));
    recalcRisk();
  })();

  /* ========================================================
     4. INTERACTIVE OCR SCANNER DEMO (SECTION 03)
     ======================================================== */
  (function initOcrScanner() {
    if (typeof document.querySelectorAll !== 'function') return;
    const tabs = document.querySelectorAll('.scan-tab-btn');
    if (!tabs.length) return;

    const samples = {
      tv: {
        market: 'XAU/USD - LONG',
        entry: 'Entry: 2650.00',
        sl: 'SL: 2642.00 (80p)',
        tp: 'TP: 2674.00 (240p)',
        pnl: 'Net: +$1,200.00 (3.0R)'
      },
      mt5: {
        market: 'EUR/USD - SHORT',
        entry: 'Entry: 1.08800',
        sl: 'SL: 1.09050 (25p)',
        tp: 'TP: 1.08050 (75p)',
        pnl: 'Net: +$750.00 (3.0R)'
      },
      crypto: {
        market: 'BTC/USD - LONG',
        entry: 'Entry: 67200.00',
        sl: 'SL: 66400.00',
        tp: 'TP: 69600.00',
        pnl: 'Net: +$2,400.00 (3.0R)'
      }
    };

    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const key = btn.dataset.sample || 'tv';
        const data = samples[key];
        if (!data) return;

        const elMarket = document.getElementById('scan-out-market');
        const elEntry = document.getElementById('scan-out-entry');
        const elSl = document.getElementById('scan-out-sl');
        const elTp = document.getElementById('scan-out-tp');
        const elPnl = document.getElementById('scan-out-pnl');

        if (elMarket) elMarket.textContent = data.market;
        if (elEntry) elEntry.textContent = data.entry;
        if (elSl) elSl.textContent = data.sl;
        if (elTp) elTp.textContent = data.tp;
        if (elPnl) elPnl.textContent = data.pnl;

        // Restart laser line animation
        const laser = document.getElementById('scan-laser');
        if (laser) {
          laser.style.animation = 'none';
          void laser.offsetWidth;
          laser.style.animation = 'home-laser 2.8s ease-in-out infinite alternate';
        }
        playSyntheticBeep(640, 'sine', 0.05);
      });
    });
  })();

  /* ========================================================
     5. INTERACTIVE STRATEGY EQUITY CURVE (SECTION 04)
     ======================================================== */
  (function initStrategyCurve() {
    if (typeof document.querySelectorAll !== 'function') return;
    const stratBtns = document.querySelectorAll('.rev-strat-btn');
    const path = document.getElementById('equity-curve-path');
    if (!stratBtns.length || !path) return;

    const strategies = {
      disciplined: {
        path: 'M3 115 38 94 72 102 110 63 150 74 190 37 230 49 296 12',
        stroke: '#27c98b',
        wr: '68.2%',
        pf: '2.41',
        dd: '4.1%'
      },
      trend: {
        path: 'M3 115 45 105 85 92 120 98 160 60 200 45 250 18 296 6',
        stroke: '#f1f5f9',
        wr: '54.0%',
        pf: '3.10',
        dd: '7.8%'
      },
      overtrading: {
        path: 'M3 115 40 80 80 110 120 70 160 115 200 65 240 110 296 118',
        stroke: '#f05252',
        wr: '32.5%',
        pf: '0.62',
        dd: '48.6%'
      }
    };

    stratBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        stratBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const strat = strategies[btn.dataset.strat] || strategies.disciplined;

        path.setAttribute('d', strat.path);
        path.setAttribute('stroke', strat.stroke);

        const elWr = document.getElementById('rev-stat-wr');
        const elPf = document.getElementById('rev-stat-pf');
        const elDd = document.getElementById('rev-stat-dd');

        if (elWr) elWr.textContent = strat.wr;
        if (elPf) elPf.textContent = strat.pf;
        if (elDd) elDd.textContent = strat.dd;

        playSyntheticBeep(strat.stroke === '#f05252' ? 360 : 740, 'sine', 0.05);
      });
    });
  })();

  /* ========================================================
     6. INTERACTIVE GLOBAL MARKET SESSIONS RADAR (SECTION 05)
     ======================================================== */
  (function initSessionRadar() {
    if (typeof document.querySelector !== 'function') return;
    function updateSessions() {
      const now = new Date();
      const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;

      // Session UTC intervals
      // Sydney: 21:00 - 06:00 UTC
      // Tokyo: 00:00 - 09:00 UTC
      // London: 07:00 - 16:00 UTC
      // New York: 12:00 - 21:00 UTC

      const isSydney = utcHours >= 21 || utcHours < 6;
      const isTokyo = utcHours >= 0 && utcHours < 9;
      const isLondon = utcHours >= 7 && utcHours < 16;
      const isNewYork = utcHours >= 12 && utcHours < 21;

      function updateCard(city, isOpen, tzOffset, tzName) {
        const card = document.querySelector(`.session-card[data-city="${city}"]`);
        const status = document.getElementById(`status-${city}`);
        const timeEl = document.getElementById(`time-${city}`);
        if (!card || !status || !timeEl) return;

        card.classList.toggle('active', isOpen);
        status.textContent = isOpen ? 'Open' : 'Closed';

        const cityDate = new Date(now.getTime() + tzOffset * 3600000);
        const h = cityDate.getUTCHours();
        const m = cityDate.getUTCMinutes();
        timeEl.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ' ' + tzName;
      }

      updateCard('sydney', isSydney, 11, 'AEDT');
      updateCard('tokyo', isTokyo, 9, 'JST');
      updateCard('london', isLondon, 1, 'BST');
      updateCard('newyork', isNewYork, -4, 'EDT');

      const overlap = document.getElementById('radar-overlap-badge');
      if (overlap) {
        overlap.hidden = !(isLondon && isNewYork);
      }
    }

    updateSessions();
    setInterval(updateSessions, 10000);
  })();

  /* ========================================================
     6. INTERACTIVE 6-YEAR PRODUCT STORYLINE TIMELINE ROADMAP
     ======================================================== */
  (function initTimelineRoadmap() {
    const section = document.getElementById('home-product-timeline');
    const viewport = document.getElementById('timeline-sticky-viewport');
    const track = document.getElementById('timeline-slider-track');
    const railLine = document.getElementById('timeline-rail-line');
    if (!section || !viewport || !track) return;

    function updateScrub() {
      const rect = section.getBoundingClientRect();
      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;

      const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
      const totalTrackWidth = track.scrollWidth;
      const viewportWidth = window.innerWidth;
      const maxTranslate = Math.max(0, totalTrackWidth - viewportWidth);
      const currentTranslate = progress * maxTranslate;

      track.style.transform = 'translate3d(-' + currentTranslate.toFixed(1) + 'px, 0, 0)';

      if (railLine) {
        const isMobile = window.innerWidth < 600;
        const baseWidth = isMobile ? 190 : 250;
        const node7 = section.querySelector('.timeline-node[data-num="07"]') || section.querySelector('.timeline-node:last-child');
        const stageWrap = section.querySelector('.timeline-stage-wrap');
        let targetWidth = 1980;
        if (node7 && stageWrap) {
          let left = 0;
          let curr = node7;
          while (curr && curr !== stageWrap && curr !== track) {
            left += curr.offsetLeft || 0;
            curr = curr.offsetParent;
          }
          targetWidth = Math.max(baseWidth, left + (node7.offsetWidth || 280) + 30);
        }
        const lineProgress = Math.min(1, progress / 0.88);
        const currentWidth = baseWidth + (lineProgress * (targetWidth - baseWidth));
        railLine.style.width = currentWidth.toFixed(0) + 'px';
      }
    }

    window.addEventListener('scroll', updateScrub, { passive: true });
    window.addEventListener('resize', updateScrub);

    // Smooth wheel scroll support when hovering over viewport
    viewport.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > 3) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 2 && rect.bottom >= window.innerHeight - 2) {
          window.scrollBy({ top: e.deltaY * 1.25, behavior: 'auto' });
          e.preventDefault();
        }
      }
    }, { passive: false });

    // Touch swipe support for horizontal scrub on mobile devices
    let touchStartX = 0;
    let touchStartY = 0;

    viewport.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length === 1) {
        const dx = touchStartX - e.touches[0].clientX;
        const dy = touchStartY - e.touches[0].clientY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
          window.scrollBy({ top: dx * 1.35, behavior: 'auto' });
        }
      }
    }, { passive: true });

    // Initial position on load
    updateScrub();
  })();

  updateMotionState();
})();

