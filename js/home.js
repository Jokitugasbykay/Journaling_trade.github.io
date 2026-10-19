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
     1. HERO INTERACTIVE TRADING TERMINAL & CHART SIMULATOR
     ======================================================== */
  (function initHeroTerminal() {
    const canvas = document.getElementById('home-hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pairs = {
      'EUR/USD': { base: 1.08450, step: 0.0001, decimals: 5, unit: 'pips', pipVal: 10 },
      'XAU/USD': { base: 2650.00, step: 0.10, decimals: 2, unit: 'pips', pipVal: 10 },
      'BTC/USD': { base: 68200.0, step: 1.0, decimals: 1, unit: 'pts', pipVal: 1 }
    };
    let currentPair = 'EUR/USD';

    let candles = [];
    function generateCandles(base, count = 22) {
      const list = [];
      let lastClose = base - (count * 0.0004);
      for (let i = 0; i < count; i++) {
        const delta = (Math.random() - 0.46) * 0.0008;
        const open = lastClose;
        const close = open + delta;
        const high = Math.max(open, close) + Math.random() * 0.0004;
        const low = Math.min(open, close) - Math.random() * 0.0004;
        list.push({ open, high, low, close });
        lastClose = close;
      }
      return list;
    }

    candles = generateCandles(pairs[currentPair].base);

    let entryY = 160;
    let tpY = 70;
    let slY = 220;
    let activeDrag = null;

    function renderHeroChart() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let y = 30; y < h; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = 40; x < w; x += 55) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Calculate price bounds
      let minP = Infinity, maxP = -Infinity;
      candles.forEach(c => {
        if (c.low < minP) minP = c.low;
        if (c.high > maxP) maxP = c.high;
      });
      const pad = (maxP - minP) * 0.2 || 0.001;
      minP -= pad;
      maxP += pad;

      function priceToY(p) {
        return h - ((p - minP) / (maxP - minP)) * (h - 40) - 20;
      }

      // Draw Candlesticks
      const slotW = (w - 60) / candles.length;
      candles.forEach((c, i) => {
        const x = 30 + i * slotW;
        const oY = priceToY(c.open);
        const cY = priceToY(c.close);
        const hY = priceToY(c.high);
        const lY = priceToY(c.low);
        const isUp = c.close >= c.open;
        const color = isUp ? '#27c98b' : '#f05252';

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, hY);
        ctx.lineTo(x, lY);
        ctx.stroke();

        ctx.fillStyle = color;
        const rectY = Math.min(oY, cY);
        const rectH = Math.max(Math.abs(cY - oY), 2.5);
        ctx.fillRect(x - slotW * 0.32, rectY, slotW * 0.64, rectH);
      });

      // Shaded Risk / Reward Area
      ctx.fillStyle = 'rgba(39, 201, 139, 0.08)';
      ctx.fillRect(0, Math.min(tpY, entryY), w, Math.abs(entryY - tpY));

      ctx.fillStyle = 'rgba(240, 82, 82, 0.08)';
      ctx.fillRect(0, Math.min(entryY, slY), w, Math.abs(slY - entryY));

      // Draw Take Profit Line (Green dashed)
      ctx.strokeStyle = '#27c98b';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, tpY);
      ctx.lineTo(w, tpY);
      ctx.stroke();

      // Draw Stop Loss Line (Red dashed)
      ctx.strokeStyle = '#f05252';
      ctx.beginPath();
      ctx.moveTo(0, slY);
      ctx.lineTo(w, slY);
      ctx.stroke();

      // Draw Entry Line (Cyan solid)
      ctx.strokeStyle = '#60a5fa';
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, entryY);
      ctx.lineTo(w, entryY);
      ctx.stroke();

      // Drag handles
      function drawHandle(y, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(w - 20, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      drawHandle(tpY, '#27c98b');
      drawHandle(entryY, '#60a5fa');
      drawHandle(slY, '#f05252');

      updateHudCalculations();
    }

    function updateHudCalculations() {
      const rewardDist = Math.max(Math.abs(entryY - tpY), 4);
      const riskDist = Math.max(Math.abs(slY - entryY), 4);
      const rrRatio = (rewardDist / riskDist).toFixed(1);

      const slPips = Math.max(Math.round(riskDist / 3), 5);
      const tpPips = Math.round(slPips * rrRatio);

      const lot = (100 / (slPips * 10)).toFixed(2);
      const profitUsd = Math.round(lot * tpPips * 10);

      const rrEl = document.getElementById('hero-hud-rr');
      const lotEl = document.getElementById('hero-hud-lot');
      const profitEl = document.getElementById('hero-hud-profit');
      const riskEl = document.getElementById('hero-hud-risk');

      if (rrEl) rrEl.textContent = '1 : ' + rrRatio;
      if (lotEl) lotEl.textContent = lot + ' Lots';
      if (profitEl) profitEl.textContent = '+$' + profitUsd + '.00';
      if (riskEl) riskEl.textContent = '-$100.00';

      const hintTp = document.getElementById('hint-tp-val');
      const hintSl = document.getElementById('hint-sl-val');
      if (hintTp) hintTp.textContent = '+' + rrRatio + 'R / +$' + profitUsd;
      if (hintSl) hintSl.textContent = '-1.0R / -$100';
    }

    // Pointer events for dragging lines
    function getCanvasY(evt) {
      const rect = canvas.getBoundingClientRect();
      const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      return ((clientY - rect.top) / rect.height) * canvas.height;
    }

    function onPointerDown(evt) {
      const y = getCanvasY(evt);
      if (Math.abs(y - tpY) < 16) activeDrag = 'tp';
      else if (Math.abs(y - entryY) < 16) activeDrag = 'entry';
      else if (Math.abs(y - slY) < 16) activeDrag = 'sl';
      if (activeDrag) playSyntheticBeep(480, 'sine', 0.04);
    }

    function onPointerMove(evt) {
      if (!activeDrag) return;
      const y = Math.max(15, Math.min(canvas.height - 15, getCanvasY(evt)));
      if (activeDrag === 'tp') tpY = Math.min(y, entryY - 12);
      else if (activeDrag === 'sl') slY = Math.max(y, entryY + 12);
      else if (activeDrag === 'entry') {
        const delta = y - entryY;
        entryY = y;
        tpY = Math.max(15, tpY + delta);
        slY = Math.min(canvas.height - 15, slY + delta);
      }
      renderHeroChart();
    }

    function onPointerUp() {
      activeDrag = null;
    }

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // Pair selection buttons
    const pairBtns = document.querySelectorAll('.terminal-pair-btn');
    pairBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        pairBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPair = btn.dataset.pair || 'EUR/USD';
        candles = generateCandles(pairs[currentPair].base);
        const livePriceEl = document.getElementById('hero-live-price');
        if (livePriceEl) livePriceEl.textContent = pairs[currentPair].base.toFixed(pairs[currentPair].decimals);
        const hintEntry = document.getElementById('hint-entry-val');
        if (hintEntry) hintEntry.textContent = pairs[currentPair].base.toFixed(pairs[currentPair].decimals);
        renderHeroChart();
        playSyntheticBeep(720, 'sine', 0.05);
      });
    });

    // Simulate Next Bar
    const simBtn = document.getElementById('hero-btn-simulate');
    if (simBtn) {
      simBtn.addEventListener('click', () => {
        const last = candles[candles.length - 1];
        const delta = (Math.random() - 0.45) * 0.0009;
        const open = last.close;
        const close = open + delta;
        const high = Math.max(open, close) + Math.random() * 0.0004;
        const low = Math.min(open, close) - Math.random() * 0.0004;
        candles.shift();
        candles.push({ open, high, low, close });

        const livePriceEl = document.getElementById('hero-live-price');
        if (livePriceEl) {
          livePriceEl.textContent = close.toFixed(pairs[currentPair].decimals);
          livePriceEl.style.color = delta >= 0 ? '#27c98b' : '#f05252';
          setTimeout(() => { livePriceEl.style.color = '#fff'; }, 400);
        }
        renderHeroChart();
        playSyntheticBeep(delta >= 0 ? 840 : 420, 'sine', 0.06);
      });
    }

    // Log trade to demo journal
    const logBtn = document.getElementById('hero-btn-log');
    const toast = document.getElementById('hero-terminal-toast');
    if (logBtn && toast) {
      logBtn.addEventListener('click', () => {
        toast.hidden = false;
        playSyntheticBeep(880, 'triangle', 0.1, 0.08);
        setTimeout(() => { toast.hidden = true; }, 2400);
      });
    }

    // Reset setup
    const resetBtn = document.getElementById('hero-btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        entryY = 160;
        tpY = 70;
        slY = 220;
        renderHeroChart();
        playSyntheticBeep(520, 'sine', 0.04);
      });
    }

    renderHeroChart();
  })();

  /* ========================================================
     2. INTERACTIVE VIDEO SHOWCASE PLAYER & RECORDER
     ======================================================== */
  (function initVideoShowcase() {
    const canvas = document.getElementById('home-video-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const totalSeconds = 80; // 01:20 total walkthrough
    let currentTime = 0;
    let isPlaying = false;
    let playbackSpeed = 1.0;
    let lastTimestamp = 0;
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;

    const chapters = [
      { id: 0, title: 'OCR Auto-Scan', start: 0, end: 20 },
      { id: 1, title: 'Risk Engine', start: 20, end: 40 },
      { id: 2, title: 'Equity Curve', start: 40, end: 60 },
      { id: 3, title: 'Macro Catalysts', start: 60, end: 80 }
    ];

    function getActiveChapterIndex(time) {
      return chapters.findIndex(c => time >= c.start && time < c.end) || 0;
    }

    // Canvas Video Drawing Scenes
    function drawVideoFrame(time) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Deep dark sleek background with subtle gradient
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#0a0a0f');
      bgGrad.addColorStop(1, '#050508');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Top video frame brand bar
      ctx.fillStyle = '#0f0f15';
      ctx.fillRect(40, 30, w - 80, 52);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeRect(40, 30, w - 80, 52);

      ctx.fillStyle = '#fff';
      ctx.font = '600 15px Manrope, sans-serif';
      ctx.fillText('journalingtrade', 60, 62);

      const chIdx = getActiveChapterIndex(time);
      const ch = chapters[chIdx];

      ctx.fillStyle = '#27c98b';
      ctx.font = '500 12px "IBM Plex Mono", monospace';
      ctx.fillText('DEMO TOUR / ' + ch.title.toUpperCase(), 190, 61);

      // Watermark / status
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillText('INSTITUTIONAL WORKSPACE ENGINE', w - 310, 61);

      // Main Scene Renderers
      if (chIdx === 0) drawOcrScene(time - 0, w, h);
      else if (chIdx === 1) drawRiskScene(time - 20, w, h);
      else if (chIdx === 2) drawEquityScene(time - 40, w, h);
      else if (chIdx === 3) drawMacroScene(time - 60, w, h);

      // Update progress & scrubber UI
      updatePlayerUI(time);
    }

    /* Scene 1: OCR Auto-Scan */
    function drawOcrScene(sceneTime, w, h) {
      // Main mockup card
      const cx = 80, cy = 110, cw = w - 160, ch = h - 160;
      ctx.fillStyle = '#0d0d12';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(cx, cy, cw, ch);

      // Card Header
      ctx.fillStyle = '#14141c';
      ctx.fillRect(cx, cy, cw, 42);
      ctx.fillStyle = '#ccc';
      ctx.font = '500 13px "IBM Plex Mono", monospace';
      ctx.fillText('OCR Screenshot Ingestion > TradingView Analysis Mode', cx + 20, cy + 26);

      // Left Preview Screen (Chart Screenshot)
      const pw = cw * 0.52, ph = ch - 70;
      const px = cx + 20, py = cy + 54;
      ctx.fillStyle = '#060609';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeRect(px, py, pw, ph);

      // Draw simulated candles in preview
      for (let i = 0; i < 14; i++) {
        const x = px + 30 + i * 36;
        const isUp = i % 2 === 0 || i > 9;
        const color = isUp ? '#27c98b' : '#f05252';
        const yTop = py + 70 + (i % 4) * 20;
        const hBox = 30 + (i % 3) * 15;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, yTop - 15);
        ctx.lineTo(x, yTop + hBox + 15);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.fillRect(x - 9, yTop, 18, hBox);
      }

      // Animated Laser Scan Line
      const laserCycle = (sceneTime % 3.5) / 3.5;
      const laserY = py + laserCycle * ph;
      const laserGrad = ctx.createLinearGradient(px, laserY, px + pw, laserY);
      laserGrad.addColorStop(0, 'rgba(39, 201, 139, 0)');
      laserGrad.addColorStop(0.5, 'rgba(39, 201, 139, 0.85)');
      laserGrad.addColorStop(1, 'rgba(39, 201, 139, 0)');

      ctx.fillStyle = laserGrad;
      ctx.fillRect(px, laserY - 1.5, pw, 3);

      // Scan Bounding Box (Detected Trade)
      ctx.strokeStyle = '#38bdf8';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(px + 120, py + 80, 240, 140);
      ctx.setLineDash([]);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText('TARGET: 2674.00 (+3.0R)', px + 124, py + 74);
      ctx.fillText('ENTRY: 2650.00', px + 124, py + 150);
      ctx.fillText('STOP: 2642.00 (-1.0R)', px + 124, py + 234);

      // Right Extracted Results Panel
      const rx = px + pw + 24, ry = py, rw = cw - pw - 60;
      ctx.fillStyle = '#111117';
      ctx.fillRect(rx, ry, rw, ph);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeRect(rx, ry, rw, ph);

      ctx.fillStyle = '#fff';
      ctx.font = '600 15px Manrope, sans-serif';
      ctx.fillText('Extracted Position Parameters', rx + 20, ry + 36);

      const fields = [
        { label: 'Market / Asset', val: 'XAU/USD (Gold)' },
        { label: 'Direction', val: 'LONG / BUY' },
        { label: 'Entry Price', val: '2,650.00' },
        { label: 'Stop Loss', val: '2,642.00 (80 pips)' },
        { label: 'Take Profit', val: '2,674.00 (240 pips)' },
        { label: 'Risk to Reward', val: '1 : 3.00 Ratio' },
        { label: 'Confidence Score', val: '99.8% (Tesseract OCR)' }
      ];

      fields.forEach((f, idx) => {
        const fy = ry + 75 + idx * 46;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(rx + 20, fy - 18, rw - 40, 36);

        ctx.fillStyle = '#888';
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.fillText(f.label, rx + 30, fy + 4);

        ctx.fillStyle = idx === 5 ? '#27c98b' : (idx === 6 ? '#38bdf8' : '#fff');
        ctx.font = '600 12px "IBM Plex Mono", monospace';
        ctx.fillText(f.val, rx + rw - 190, fy + 4);
      });
    }

    /* Scene 2: Institutional Risk Engine */
    function drawRiskScene(sceneTime, w, h) {
      const cx = 80, cy = 110, cw = w - 160, ch = h - 160;
      ctx.fillStyle = '#0d0d12';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(cx, cy, cw, ch);

      ctx.fillStyle = '#14141c';
      ctx.fillRect(cx, cy, cw, 42);
      ctx.fillStyle = '#ccc';
      ctx.font = '500 13px "IBM Plex Mono", monospace';
      ctx.fillText('Institutional Risk Management > Dynamic Position Sizer', cx + 20, cy + 26);

      // 3 Dynamic Sliders Visual
      const sx = cx + 40, sy = cy + 70, sw = cw * 0.48;

      ctx.fillStyle = '#fff';
      ctx.font = '600 18px Manrope, sans-serif';
      ctx.fillText('Account Risk Limits & Position Sizing', sx, sy + 10);

      const sliders = [
        { label: 'Account Balance', val: '$25,000 USD', pct: 0.5 },
        { label: 'Risk Tolerance', val: '1.0% ($250)', pct: 0.35 },
        { label: 'Stop Loss Distance', val: '20.0 Pips', pct: 0.4 }
      ];

      sliders.forEach((s, i) => {
        const y = sy + 65 + i * 80;
        ctx.fillStyle = '#888';
        ctx.font = '12px "IBM Plex Mono", monospace';
        ctx.fillText(s.label, sx, y);
        ctx.fillStyle = '#fff';
        ctx.fillText(s.val, sx + sw - 120, y);

        // Track
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(sx, y + 12, sw, 6);

        // Fill
        const fillW = sw * (s.pct + Math.sin(sceneTime * 0.8 + i) * 0.05);
        ctx.fillStyle = i === 1 ? '#27c98b' : '#fff';
        ctx.fillRect(sx, y + 12, fillW, 6);

        // Knob
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sx + fillW, y + 15, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Big Result Callout Card
      const rx = sx + sw + 40, ry = cy + 70, rw = cw - sw - 80, rh = ch - 110;
      ctx.fillStyle = '#111118';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = 'rgba(39, 201, 139, 0.3)';
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.fillStyle = '#27c98b';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.fillText('DISCIPLINE CHECK PASSED', rx + 24, ry + 36);

      ctx.fillStyle = '#888';
      ctx.font = '12px "IBM Plex Mono", monospace';
      ctx.fillText('RECOMMENDED POSITION SIZE', rx + 24, ry + 75);

      ctx.fillStyle = '#fff';
      ctx.font = '700 44px "IBM Plex Mono", monospace';
      ctx.fillText('1.25 LOTS', rx + 24, ry + 130);

      ctx.fillStyle = '#888';
      ctx.font = '12px "IBM Plex Mono", monospace';
      ctx.fillText('USD VALUE AT RISK', rx + 24, ry + 180);
      ctx.fillStyle = '#f05252';
      ctx.font = '600 22px "IBM Plex Mono", monospace';
      ctx.fillText('-$250.00 (1.0%)', rx + 24, ry + 210);

      ctx.fillStyle = '#888';
      ctx.font = '12px "IBM Plex Mono", monospace';
      ctx.fillText('BANK INDONESIA CONVERSION', rx + 24, ry + 260);
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 20px "IBM Plex Mono", monospace';
      ctx.fillText('Rp 4,100,000 IDR', rx + 24, ry + 290);
    }

    /* Scene 3: Probabilistic Equity Curve */
    function drawEquityScene(sceneTime, w, h) {
      const cx = 80, cy = 110, cw = w - 160, ch = h - 160;
      ctx.fillStyle = '#0d0d12';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(cx, cy, cw, ch);

      ctx.fillStyle = '#14141c';
      ctx.fillRect(cx, cy, cw, 42);
      ctx.fillStyle = '#ccc';
      ctx.font = '500 13px "IBM Plex Mono", monospace';
      ctx.fillText('Performance Intelligence > Probabilistic Equity Curve (50 Trades)', cx + 20, cy + 26);

      // Curve Viewport
      const gx = cx + 30, gy = cy + 65, gw = cw - 60, gh = ch - 160;
      ctx.fillStyle = '#07070a';
      ctx.fillRect(gx, gy, gw, gh);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.strokeRect(gx, gy, gw, gh);

      // Draw grid
      for (let y = gy + 30; y < gy + gh; y += 40) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.lineTo(gx + gw, y);
        ctx.stroke();
      }

      // Equity Line Points
      const points = [
        0, 10, 8, 25, 22, 38, 55, 50, 70, 65, 85, 110, 105, 130, 125, 155, 180, 175, 210, 240
      ];

      const maxPts = Math.min(points.length, Math.floor(sceneTime * 2.5) + 3);
      ctx.beginPath();
      ctx.strokeStyle = '#27c98b';
      ctx.lineWidth = 3;

      for (let i = 0; i < maxPts; i++) {
        const x = gx + (i / (points.length - 1)) * gw;
        const y = gy + gh - 20 - (points[i] / 260) * (gh - 40);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Glowing dot at tip
      if (maxPts > 0) {
        const lastIdx = maxPts - 1;
        const lx = gx + (lastIdx / (points.length - 1)) * gw;
        const ly = gy + gh - 20 - (points[lastIdx] / 260) * (gh - 40);
        ctx.fillStyle = '#27c98b';
        ctx.beginPath();
        ctx.arc(lx, ly, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Bottom Metrics Cards
      const stats = [
        { label: 'WIN RATE', val: '68.4%' },
        { label: 'PROFIT FACTOR', val: '2.45' },
        { label: 'MAX DRAWDOWN', val: '4.2%' },
        { label: 'TOTAL TRADES', val: '50 Recorded' }
      ];

      const statW = (gw - 30) / 4;
      stats.forEach((s, idx) => {
        const bx = gx + idx * (statW + 10);
        const by = gy + gh + 14;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(bx, by, statW, 58);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.strokeRect(bx, by, statW, 58);

        ctx.fillStyle = '#888';
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.fillText(s.label, bx + 14, by + 22);

        ctx.fillStyle = idx === 0 || idx === 1 ? '#27c98b' : '#fff';
        ctx.font = '600 16px "IBM Plex Mono", monospace';
        ctx.fillText(s.val, bx + 14, by + 46);
      });
    }

    /* Scene 4: Macroeconomic Events & Bank Indonesia Radar */
    function drawMacroScene(sceneTime, w, h) {
      const cx = 80, cy = 110, cw = w - 160, ch = h - 160;
      ctx.fillStyle = '#0d0d12';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(cx, cy, cw, ch);

      ctx.fillStyle = '#14141c';
      ctx.fillRect(cx, cy, cw, 42);
      ctx.fillStyle = '#ccc';
      ctx.font = '500 13px "IBM Plex Mono", monospace';
      ctx.fillText('Macro Catalyst Radar > Central Bank Feeds & Economic Releases', cx + 20, cy + 26);

      // Card 1: Bank Indonesia Middle Rate
      const colW = (cw - 60) / 2;
      const b1x = cx + 20, b1y = cy + 60, b1h = ch - 80;
      ctx.fillStyle = '#101017';
      ctx.fillRect(b1x, b1y, colW, b1h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeRect(b1x, b1y, colW, b1h);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      ctx.fillText('BANK INDONESIA TRANSACTION RATE', b1x + 20, b1y + 36);

      ctx.fillStyle = '#fff';
      ctx.font = '700 36px "IBM Plex Mono", monospace';
      ctx.fillText('Rp 16,400.00', b1x + 20, b1y + 86);

      ctx.fillStyle = '#27c98b';
      ctx.font = '500 13px "IBM Plex Mono", monospace';
      ctx.fillText('USD/IDR Middle Rate · Official Source', b1x + 20, b1y + 116);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fillRect(b1x + 20, b1y + 145, colW - 40, 110);
      ctx.fillStyle = '#aaa';
      ctx.font = '12px Manrope, sans-serif';
      ctx.fillText('Bi-hourly automated audit verifies publisher integrity.', b1x + 36, b1y + 180);
      ctx.fillText('Middle rates are automatically applied to compute real P&L in IDR.', b1x + 36, b1y + 206);
      ctx.fillText('Never hallucinates when feed is offline.', b1x + 36, b1y + 232);

      // Card 2: Upcoming High-Impact Releases
      const b2x = b1x + colW + 20, b2y = cy + 60;
      ctx.fillStyle = '#101017';
      ctx.fillRect(b2x, b2y, colW, b1h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeRect(b2x, b2y, colW, b1h);

      ctx.fillStyle = '#f05252';
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      ctx.fillText('UPCOMING HIGH-IMPACT RELEASES', b2x + 20, b2y + 36);

      const events = [
        { name: 'FOMC Interest Rate Decision', time: 'In 04h 12m', impact: 'HIGH' },
        { name: 'US Core CPI m/m', time: 'Tomorrow 19:30', impact: 'HIGH' },
        { name: 'ECB Monetary Policy Statement', time: 'Thursday', impact: 'MEDIUM' }
      ];

      events.forEach((ev, i) => {
        const ey = b2y + 60 + i * 72;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(b2x + 20, ey, colW - 40, 58);

        ctx.fillStyle = '#fff';
        ctx.font = '600 13px Manrope, sans-serif';
        ctx.fillText(ev.name, b2x + 36, ey + 26);

        ctx.fillStyle = '#888';
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.fillText(ev.time, b2x + 36, ey + 46);

        ctx.fillStyle = ev.impact === 'HIGH' ? '#f05252' : '#38bdf8';
        ctx.font = '600 10px "IBM Plex Mono", monospace';
        ctx.fillText(ev.impact, b2x + colW - 90, ey + 36);
      });
    }

    // Update time readout and scrubber UI
    function updatePlayerUI(time) {
      const timeEl = document.getElementById('jt-video-time');
      if (timeEl) {
        const m = Math.floor(time / 60);
        const s = Math.floor(time % 60);
        const tm = Math.floor(totalSeconds / 60);
        const ts = Math.floor(totalSeconds % 60);
        timeEl.textContent =
          (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + ' / ' +
          (tm < 10 ? '0' : '') + tm + ':' + (ts < 10 ? '0' : '') + ts;
      }

      const progressEl = document.getElementById('jt-video-progress');
      const handleEl = document.getElementById('jt-video-handle');
      const pct = Math.min(100, Math.max(0, (time / totalSeconds) * 100));
      if (progressEl) progressEl.style.width = pct + '%';
      if (handleEl) handleEl.style.left = pct + '%';

      // Update chapter pills
      const curCh = getActiveChapterIndex(time);
      document.querySelectorAll('.v-chapter-pill').forEach(pill => {
        pill.classList.toggle('active', parseInt(pill.dataset.chapter, 10) === curCh);
      });

      // Update hotspots visibility
      const hsOcr = document.getElementById('hotspot-ocr');
      const hsRisk = document.getElementById('hotspot-risk');
      const hsCurve = document.getElementById('hotspot-curve');
      const hsMacro = document.getElementById('hotspot-macro');
      if (hsOcr) hsOcr.style.opacity = curCh === 0 ? '1' : '0';
      if (hsRisk) hsRisk.style.opacity = curCh === 1 ? '1' : '0';
      if (hsCurve) hsCurve.style.opacity = curCh === 2 ? '1' : '0';
      if (hsMacro) hsMacro.style.opacity = curCh === 3 ? '1' : '0';
    }

    // Animation Loop
    function animationLoop(timestamp) {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const deltaSec = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      if (isPlaying && !document.hidden && home.classList.contains('active')) {
        currentTime += deltaSec * playbackSpeed;
        if (currentTime >= totalSeconds) currentTime = 0;
      }

      drawVideoFrame(currentTime);
      requestAnimationFrame(animationLoop);
    }
    requestAnimationFrame(animationLoop);

    // Play / Pause toggling
    function setPlayState(playing) {
      isPlaying = playing;
      const overlay = document.getElementById('jt-video-overlay');
      const iconPlay = document.getElementById('v-icon-play');
      const iconPause = document.getElementById('v-icon-pause');
      if (overlay) overlay.style.display = isPlaying ? 'none' : 'flex';
      if (iconPlay) iconPlay.hidden = isPlaying;
      if (iconPause) iconPause.hidden = !isPlaying;
      playSyntheticBeep(isPlaying ? 600 : 360, 'sine', 0.05);
    }

    const playBtn = document.getElementById('jt-ctrl-play');
    const overlayPlay = document.getElementById('jt-overlay-play-btn');
    if (playBtn) playBtn.addEventListener('click', () => setPlayState(!isPlaying));
    if (overlayPlay) overlayPlay.addEventListener('click', () => setPlayState(true));

    const restartBtn = document.getElementById('jt-ctrl-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        currentTime = 0;
        setPlayState(true);
      });
    }

    // Chapter Navigation Buttons
    document.querySelectorAll('.v-chapter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const ch = parseInt(pill.dataset.chapter, 10);
        if (ch >= 0 && ch < chapters.length) {
          currentTime = chapters[ch].start;
          setPlayState(true);
        }
      });
    });

    // Timeline Scrubbing
    const timeline = document.getElementById('jt-video-timeline');
    if (timeline) {
      timeline.addEventListener('click', evt => {
        const rect = timeline.getBoundingClientRect();
        const clickRatio = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
        currentTime = clickRatio * totalSeconds;
        drawVideoFrame(currentTime);
      });
    }

    // Speed Selector
    const speedBtn = document.getElementById('jt-speed-btn');
    const speeds = [1.0, 1.25, 1.5, 2.0];
    let speedIdx = 0;
    if (speedBtn) {
      speedBtn.addEventListener('click', () => {
        speedIdx = (speedIdx + 1) % speeds.length;
        playbackSpeed = speeds[speedIdx];
        speedBtn.textContent = playbackSpeed + 'x';
        playSyntheticBeep(580, 'sine', 0.04);
      });
    }

    // Audio Toggle
    const audioBtn = document.getElementById('jt-ctrl-audio');
    const iconAudioOn = document.getElementById('v-icon-audio-on');
    const iconAudioOff = document.getElementById('v-icon-audio-off');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        audioEnabled = !audioEnabled;
        if (iconAudioOn) iconAudioOn.hidden = !audioEnabled;
        if (iconAudioOff) iconAudioOff.hidden = audioEnabled;
        if (audioEnabled) playSyntheticBeep(700, 'sine', 0.08);
      });
    }

    // Fullscreen Toggle
    const fsBtn = document.getElementById('jt-ctrl-fullscreen');
    const playerWrap = document.querySelector('.home-video-player-wrap');
    if (fsBtn && playerWrap) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          playerWrap.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      });
    }

    // Interactive Mode Toggle (In-video interactive control)
    const modeToggleBtn = document.getElementById('jt-video-mode-toggle');
    const interactiveStage = document.getElementById('jt-interactive-stage');
    const interactiveBody = document.getElementById('jt-interactive-body');
    let interactiveActive = false;

    if (modeToggleBtn && interactiveStage && interactiveBody) {
      modeToggleBtn.addEventListener('click', () => {
        interactiveActive = !interactiveActive;
        interactiveStage.hidden = !interactiveActive;
        modeToggleBtn.classList.toggle('highlight', interactiveActive);
        if (interactiveActive) {
          setPlayState(false);
          interactiveBody.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:16px;">
              <p style="color:#aaa; font-size:13px;">Direct Interactive Sandbox: Test how values sync between modules.</p>
              <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px;">
                <button type="button" class="btn btn-primary" onclick="alert('Simulated OCR Triggered')">Test Live Scan</button>
                <button type="button" class="btn btn-outline" onclick="alert('Simulated Lot Calculated: 0.40 Lots')">Test 1% Risk Rule</button>
                <button type="button" class="btn btn-outline" onclick="alert('Simulated Rate: USD/IDR Rp 16,400')">Test BI Rate Feed</button>
              </div>
            </div>
          `;
        }
      });
    }

    // Record / Download Video Demo (.webm) Locally
    const downloadBtn = document.getElementById('jt-video-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (isRecording) return;
        try {
          const stream = canvas.captureStream(60);
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          recordedChunks = [];
          isRecording = true;
          downloadBtn.textContent = 'Recording 10s clip...';
          downloadBtn.disabled = true;

          mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) recordedChunks.push(e.data);
          };

          mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'journalingtrade-interactive-demo.webm';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }, 1000);
            downloadBtn.textContent = 'Record / Download video (.webm)';
            downloadBtn.disabled = false;
            isRecording = false;
            playSyntheticBeep(920, 'sine', 0.12);
          };

          mediaRecorder.start();
          currentTime = 0;
          setPlayState(true);

          setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
          }, 10000);
        } catch {
          alert('Local video export is supported in Chromium and modern browsers.');
          downloadBtn.disabled = false;
          isRecording = false;
        }
      });
    }
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
        stroke: '#38bdf8',
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
      const maxTranslate = Math.max(0, totalTrackWidth - viewportWidth + (viewportWidth * 0.08));
      const currentTranslate = progress * maxTranslate;

      track.style.transform = 'translate3d(-' + currentTranslate.toFixed(1) + 'px, 0, 0)';

      if (railLine) {
        const isMobile = window.innerWidth < 600;
        const baseWidth = isMobile ? 190 : 250;
        const totalLineSpan = maxTranslate * 0.9;
        const currentWidth = baseWidth + (progress * totalLineSpan);
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

