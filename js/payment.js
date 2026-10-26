// Midtrans Snap Checkout - JournalingTrade
// Handles plan selection, checkout modal ("Atur paket Anda"), token fetching, and Snap popup lifecycle.
// Depends on: window.JTPRO_CONFIG, Supabase session, Midtrans Snap.js

(function () {
  'use strict';

  const GATEWAY_BASE   = window.JTPRO_CONFIG?.apiBase?.replace('/pro-gateway', '') || 'https://nmddjuqkdyhcobddinkc.supabase.co/functions/v1';
  const TOKEN_ENDPOINT = GATEWAY_BASE + '/midtrans-create-token';

  // Midtrans Client Key (safe to expose - public key only)
  const MIDTRANS_CLIENT_KEY = 'Mid-client-eIKqYJoLSaZC9Sip';
  const SNAP_SCRIPT_URL     = 'https://app.sandbox.midtrans.com/snap/snap.js'; // switch to production later

  let snapLoaded = false;
  let currentPlan = 'pro';
  let currentInterval = 'monthly';
  let checkoutOpener = null;

  // Price Catalog
  const PRICES = {
    plus: {
      monthly: { base: 10,  tax: 0, total: 10, label: 'Plus bulanan', desc: 'Ditagih bulanan' },
      annual:  { base: 100, tax: 0, total: 100, label: 'Plus tahunan', desc: 'Ditagih tahunan' }
    },
    pro: {
      monthly: { base: 20,  tax: 0, total: 20, label: 'Pro bulanan', desc: 'Ditagih bulanan' },
      annual:  { base: 200, tax: 0, total: 200, label: 'Pro tahunan', desc: 'Ditagih tahunan' }
    }
  };

  // ---- Load Snap.js dynamically ----
  function loadSnap() {
    return new Promise((resolve, reject) => {
      if (snapLoaded || window.snap) { resolve(); return; }
      const s = document.createElement('script');
      s.src = SNAP_SCRIPT_URL;
      s.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY);
      s.onload = () => { snapLoaded = true; resolve(); };
      s.onerror = () => reject(new Error('Failed to load payment script'));
      document.head.appendChild(s);
    });
  }

  // ---- Get current Supabase auth token ----
  async function getAuthToken() {
    try {
      const sb = window.cloudClient || window._supabaseClient || window.supabaseClient;
      if (sb && sb.auth && sb.auth.getSession) {
        const { data } = await sb.auth.getSession();
        if (data && data.session && data.session.access_token) return data.session.access_token;
      }
    } catch (e) { console.warn('getAuthToken', e); }
    return null;
  }

  // ---- Format Currency USD with comma ----
  function fmtUsd(num) {
    return 'US$' + num.toFixed(2).replace('.', ',');
  }

  // ---- Format Date DD/MM/YYYY ----
  function getRenewalDate(interval) {
    const d = new Date();
    if (interval === 'annual') {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // ---- Open Checkout Modal ("Atur paket Anda") ----
  window.openCheckoutModal = function (plan, interval) {
    currentPlan = plan || 'pro';
    currentInterval = interval || 'monthly';

    const modal = document.getElementById('checkout-modal');
    if (!modal) return;
    if(!modal.contains(document.activeElement))checkoutOpener=document.activeElement;

    window.JTCustomCheckout?.close();
    modal.querySelector('.jt-checkout-layout').hidden = false;
    const agreement=document.getElementById('jt-terms-agree');if(agreement)agreement.checked=false;

    // Pre-fill user profile if logged in
    try {
      const nameInput = document.getElementById('jt-bill-name');
      if (nameInput && !nameInput.value) {
        const traderName = document.getElementById('nav-trader-name')?.textContent;
        if (traderName && traderName !== 'Trader') {
          nameInput.value = traderName;
        }
      }
    } catch {}

    updateCheckoutUI();
    modal.style.display = 'flex';
    modal.classList.add('is-open');
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    window.syncModalScrollLock?.();
  };

  // ---- Close Checkout Modal ----
  window.closeCheckoutModal = function () {
    window.JTCustomCheckout?.close();
    const modal = document.getElementById('checkout-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('is-open');
      modal.setAttribute('hidden', '');
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    document.body.classList.remove('pro-modal-open', 'pro-sheet-open', 'custom-select-locked', 'news-select-locked');
    window.syncModalScrollLock?.();
    const alert = document.getElementById('jt-checkout-alert');
    if (alert) alert.style.display = 'none';
    checkoutOpener?.focus?.();
  };

  // ---- Select Interval in Checkout Modal ----
  window.selectCheckoutInterval = function (interval) {
    currentInterval = interval;
    updateCheckoutUI();
  };

  // ---- Update Modal UI based on currentPlan & currentInterval ----
  function updateCheckoutUI() {
    const planCfg = PRICES[currentPlan] || PRICES.pro;
    const item = planCfg[currentInterval];
    const isPro = currentPlan === 'pro';

    // Left option cards
    const cardM = document.getElementById('jt-card-monthly');
    const cardA = document.getElementById('jt-card-annual');
    const radioM = document.getElementById('jt-radio-monthly');
    const radioA = document.getElementById('jt-radio-annual');
    if (radioM) radioM.checked = (currentInterval === 'monthly');
    if (radioA) radioA.checked = (currentInterval === 'annual');

    if (cardM && cardA) {
      cardM.classList.toggle('active', currentInterval === 'monthly');
      cardA.classList.toggle('active', currentInterval === 'annual');
    }

    const optNameM = document.getElementById('jt-opt-name-monthly');
    const optPriceM = document.getElementById('jt-opt-price-monthly');
    const optNameA = document.getElementById('jt-opt-name-annual');
    const optPriceA = document.getElementById('jt-opt-price-annual');

    if (optNameM) optNameM.textContent = isPro ? 'Pro bulanan' : 'Plus bulanan';
    if (optPriceM) optPriceM.textContent = fmtUsd(planCfg.monthly.base);
    if (optNameA) optNameA.textContent = isPro ? 'Pro tahunan' : 'Plus tahunan';
    if (optPriceA) optPriceA.textContent = fmtUsd(planCfg.annual.base);

    // Right summary card
    const sumTitle = document.getElementById('jt-summary-title');
    const sumItemLabel = document.getElementById('jt-summary-item-label');
    const sumItemPrice = document.getElementById('jt-summary-item-price');
    const sumSubtotal = document.getElementById('jt-summary-subtotal');
    const sumTax = document.getElementById('jt-summary-tax');
    const sumTotal = document.getElementById('jt-summary-total');
    const renDate = document.getElementById('jt-renewal-date');
    const recText = document.getElementById('jt-recurring-text');

    if (sumTitle) sumTitle.textContent = isPro ? 'Paket Pro' : 'Paket Plus';
    if (sumItemLabel) sumItemLabel.textContent = item.label;
    if (sumItemPrice) sumItemPrice.textContent = fmtUsd(item.base);
    if (sumSubtotal) sumSubtotal.textContent = fmtUsd(item.base);
    if (sumTax) sumTax.textContent = fmtUsd(0);
    if (sumTotal) sumTotal.textContent = fmtUsd(item.total);

    const renewalStr = getRenewalDate(currentInterval);
    if (renDate) renDate.textContent = renewalStr;
    const periodWord = currentInterval === 'annual' ? 'tahun' : 'bulan';
    if (recText) {
      recText.textContent = `${fmtUsd(item.base)}/${periodWord}.`;
    }
    const noticeEl = document.getElementById('jt-summary-notice-text');
    if (noticeEl) {
      noticeEl.innerHTML = `Akses paket berlaku hingga <span id="jt-renewal-date">${renewalStr}</span>. Perpanjangan dilakukan secara manual. Harga paket: <span id="jt-recurring-text">${fmtUsd(item.base)}/${periodWord}.</span>`;
    }
  }

  // ---- Execute Checkout Payment (Click "Berlangganan") ----
  
  // ---- Midtrans Method List Modal (MidtransList.dc Logic) ----
  let snapCountdownInterval = null;
  let activeSnapToken = null;

  window.openMidtransListModal = function (plan, interval, orderId, token) {
    activeSnapToken = token || null;
    const p = plan || currentPlan || 'pro';
    const inv = interval || currentInterval || 'monthly';
    const planCfg = PRICES[p] || PRICES.pro;
    const item = planCfg[inv];
    const totalIdr = Math.round(item.base * 16000);
    const formattedIdr = 'Rp' + totalIdr.toLocaleString('id-ID');

    const modal = document.getElementById('midtrans-list-modal');
    if (!modal) return;

    const amtEl = document.getElementById('jt-snap-amount');
    const orderEl = document.getElementById('jt-snap-order-id');
    const planEl = document.getElementById('jt-snap-detail-plan');
    const usdEl = document.getElementById('jt-snap-detail-usd');
    const idrEl = document.getElementById('jt-snap-detail-idr');

    if (amtEl) amtEl.textContent = formattedIdr;
    if (orderEl) orderEl.textContent = orderId ? (orderId.startsWith('#') ? orderId : '#' + orderId) : '#jt-' + p + '-' + inv;
    if (planEl) planEl.textContent = (p === 'pro' ? 'Pro ' : 'Plus ') + (inv === 'annual' ? 'tahunan' : 'bulanan');
    if (usdEl) usdEl.textContent = fmtUsd(item.base);
    if (idrEl) idrEl.textContent = formattedIdr;

    // Start 24h countdown
    startSnapCountdown();

    modal.style.display = 'flex';
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    window.syncModalScrollLock?.();
  };

  window.closeMidtransListModal = function () {
    const modal = document.getElementById('midtrans-list-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('hidden', '');
    }
    if (snapCountdownInterval) {
      clearInterval(snapCountdownInterval);
      snapCountdownInterval = null;
    }
    window.syncModalScrollLock?.();
  };

  function startSnapCountdown() {
    if (snapCountdownInterval) clearInterval(snapCountdownInterval);
    let secondsLeft = 24 * 3600 - 1;
    const timerEl = document.getElementById('jt-snap-timer');

    const updateTimer = () => {
      if (!timerEl) return;
      const h = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
      const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
      const s = String(secondsLeft % 60).padStart(2, '0');
      timerEl.textContent = `${h}:${m}:${s}`;
      if (secondsLeft > 0) secondsLeft--;
    };

    updateTimer();
    snapCountdownInterval = setInterval(updateTimer, 1000);
  }

  window.copySnapAmount = function () {
    const amtEl = document.getElementById('jt-snap-amount');
    if (amtEl) {
      const text = amtEl.textContent.replace(/[^0-9]/g, '');
      navigator.clipboard?.writeText(text);
      const btn = amtEl.parentElement?.querySelector('.jt-ml-ic');
      if (btn) {
        const origSvg = btn.innerHTML;
        btn.innerHTML = '<span style="font-size:12px;color:#34D399;font-weight:700">OK</span>';
        setTimeout(() => { btn.innerHTML = origSvg; }, 1500);
      }
    }
  };

  window.copySnapOrderId = function () {
    const orderEl = document.getElementById('jt-snap-order-id');
    if (orderEl) {
      const text = orderEl.textContent.trim().replace(/^#/, '');
      navigator.clipboard?.writeText(text);
      const btn = orderEl.parentElement?.querySelector('.jt-ml-ic');
      if (btn) {
        const origSvg = btn.innerHTML;
        btn.innerHTML = '<span style="font-size:12px;color:#34D399;font-weight:700">OK</span>';
        setTimeout(() => { btn.innerHTML = origSvg; }, 1500);
      }
    }
  };

  window.selectMidtransListItem = function (method) {
    closeMidtransListModal();
    if (method === 'va') {
      // Switch back to custom checkout VA step
      const checkoutModal = document.getElementById('checkout-modal');
      if (checkoutModal) {
        checkoutModal.style.display = 'flex';
        checkoutModal.removeAttribute('hidden');
        const payStep = document.getElementById('jt-payment-step');
        if (payStep) {
          payStep.removeAttribute('hidden');
          const vaRadio = document.querySelector('input[name="jt-payment-method"][value="bca"]');
          if (vaRadio) vaRadio.checked = true;
          document.getElementById('jt-payment-create')?.removeAttribute('disabled');
        }
      }
    } else if (method === 'qris') {
      const checkoutModal = document.getElementById('checkout-modal');
      if (checkoutModal) {
        checkoutModal.style.display = 'flex';
        checkoutModal.removeAttribute('hidden');
        const payStep = document.getElementById('jt-payment-step');
        if (payStep) {
          payStep.removeAttribute('hidden');
          const qrisRadio = document.querySelector('input[name="jt-payment-method"][value="qris"]');
          if (qrisRadio) qrisRadio.checked = true;
          document.getElementById('jt-payment-create')?.removeAttribute('disabled');
        }
      }
    } else {
      // Direct Midtrans channel
      if (activeSnapToken && window.snap?.pay) {
        window.snap.pay(activeSnapToken);
      }
    }
  };

  window.executeCheckoutPayment = async function (useSnap = false) {
    const payBtn = document.getElementById('jt-checkout-pay-btn');
    const alertEl = document.getElementById('jt-checkout-alert');
    const agreeEl = document.getElementById('jt-terms-agree');

    const showAlert = (msg) => {
      if (!alertEl) return;
      alertEl.textContent = msg;
      alertEl.style.display = 'block';
    };

    if (alertEl) alertEl.style.display = 'none';

    if (agreeEl && !agreeEl.checked) {
      showAlert('Silakan centang persetujuan ketentuan berlangganan.');
      return;
    }

    const token = await getAuthToken();
    if (!token) {
      // Save pending plan and redirect to login
      try {
        sessionStorage.setItem('jt_pending_plan', currentPlan);
        sessionStorage.setItem('jt_pending_interval', currentInterval);
      } catch {}
      const base = document.getElementById('site-base')?.href || '/';
      window.location.href = base + 'login/?redirect=home%23pricing';
      return;
    }

    // Collect billing info
    const nameVal    = document.getElementById('jt-bill-name')?.value?.trim() || '';
    const countryVal = document.getElementById('jt-bill-country')?.value || 'ID';
    const addrVal    = document.getElementById('jt-bill-address')?.value?.trim() || '';
    const compVal    = document.getElementById('jt-bill-company')?.value?.trim() || '';
    const taxTypeVal = document.getElementById('jt-bill-tax-type')?.value || '';
    const taxIdVal   = document.getElementById('jt-bill-tax-id')?.value?.trim() || '';
    const altNameVal = document.getElementById('jt-bill-alt-name')?.value?.trim() || '';

    const billingData = {
      name: altNameVal || nameVal,
      country: countryVal,
      address: addrVal,
      company: compVal,
      tax_type: taxTypeVal,
      tax_id: taxIdVal,
    };

    const origText = payBtn ? payBtn.textContent : 'Berlangganan';
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = 'Menyiapkan pembayaran Midtrans...';
    }

    try {
      if (!useSnap && window.JTCustomCheckout) {
        await window.JTCustomCheckout.open({plan: currentPlan, interval: currentInterval, billing: billingData});
        if (payBtn) { payBtn.disabled = false; payBtn.textContent = origText; }
        return;
      }
      // 1. Load Snap.js & fetch token in parallel
      const [_, tokenRes] = await Promise.all([
        loadSnap(),
        fetch(TOKEN_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({
            plan: currentPlan,
            interval: currentInterval,
            billing: billingData,
          }),
        }),
      ]);

      const data = await tokenRes.json();
      if (!tokenRes.ok || !data.token) {
        throw new Error(data.detail || 'Gagal membuat sesi pembayaran Midtrans.');
      }

      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = origText;
      }

      // 2. Open Midtrans Snap Popup
      window.snap.pay(data.token, {
        onSuccess: function (result) {
          console.log('Payment success:', result);
          closeCheckoutModal();
          showSuccessModal(currentPlan);
        },
        onPending: function (result) {
          console.log('Payment pending:', result);
          closeCheckoutModal();
          alert('Pembayaran Anda sedang diproses. Kami akan segera mengaktifkan paket Anda.');
        },
        onError: function (result) {
          console.error('Payment error:', result);
          showAlert('Pembayaran tidak dapat diselesaikan. Silakan coba lagi.');
        },
        onClose: function () {
          console.log('User closed Snap popup');
        },
      });

    } catch (err) {
      console.error('Checkout error:', err);
      showAlert(err.message || 'Terjadi kesalahan sistem pembayaran. Silakan coba lagi.');
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = origText;
      }
    }
  };

  // ---- Success Modal ----
  function showSuccessModal(plan) {
    let modal = document.getElementById('jt-payment-success-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'jt-payment-success-modal';
      modal.innerHTML = `
        <div class="jt-psm-backdrop">
          <div class="jt-psm-card" role="dialog" aria-modal="true" aria-labelledby="jt-psm-title">
            <div class="jt-psm-icon">&#10003;</div>
            <h2 id="jt-psm-title">Pembayaran Berhasil</h2>
            <p id="jt-psm-body">Pembayaran untuk paket <strong id="jt-psm-plan"></strong> diterima. Akses diperbarui setelah status diverifikasi oleh server.</p>
            <button class="btn btn-primary" id="jt-psm-close" style="width:100%; height:44px; font-weight:600;">Muat Ulang &amp; Lanjutkan</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('jt-psm-close').addEventListener('click', () => location.reload());
    }
    document.getElementById('jt-psm-plan').textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    modal.style.display = 'flex';
  }

  // ---- Wire up pricing buttons in Homepage ----
  function initPricingButtons() {
    const plusBtn = document.getElementById('jt-plus-subscribe-btn');
    const proBtn  = document.getElementById('jt-pro-subscribe-btn');

    if (plusBtn) {
      plusBtn.addEventListener('click', function () {
        const isAnnual = document.querySelector('[data-cycle="annual"][aria-pressed="true"]');
        openCheckoutModal('plus', isAnnual ? 'annual' : 'monthly');
      });
    }

    if (proBtn) {
      proBtn.addEventListener('click', function () {
        const isAnnual = document.querySelector('[data-cycle="annual"][aria-pressed="true"]');
        openCheckoutModal('pro', isAnnual ? 'annual' : 'monthly');
      });
    }

    // Check if there was a pending checkout before login redirect
    try {
      const pendingPlan = sessionStorage.getItem('jt_pending_plan');
      const pendingInt  = sessionStorage.getItem('jt_pending_interval');
      if (pendingPlan) {
        sessionStorage.removeItem('jt_pending_plan');
        sessionStorage.removeItem('jt_pending_interval');
        setTimeout(() => openCheckoutModal(pendingPlan, pendingInt || 'monthly'), 600);
      }
    } catch {}
  }

  // ---- Bootstrap ----
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPricingButtons);
    } else {
      initPricingButtons();
    }
  }

  init();

  window.jtPayment = {
    openCheckoutModal,
    closeCheckoutModal,
    selectCheckoutInterval,
    executeCheckoutPayment
  };

})();
