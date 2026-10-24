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

  // Price Catalog
  const PRICES = {
    plus: {
      monthly: { base: 10,  tax: 1.10, total: 11.10, label: 'Plus bulanan', desc: 'Ditagih bulanan' },
      annual:  { base: 100, tax: 11.0, total: 111.0, label: 'Plus tahunan', desc: 'Ditagih tahunan' }
    },
    pro: {
      monthly: { base: 20,  tax: 2.20, total: 22.20, label: 'Pro bulanan', desc: 'Ditagih bulanan' },
      annual:  { base: 200, tax: 22.0, total: 222.0, label: 'Pro tahunan', desc: 'Ditagih tahunan' }
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
      const sb = window._supabaseClient || window.supabaseClient;
      if (sb) {
        const { data } = await sb.auth.getSession();
        return data?.session?.access_token || null;
      }
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.includes('supabase') && k.includes('auth')) {
          try {
            const parsed = JSON.parse(localStorage.getItem(k) || '{}');
            const token  = parsed?.access_token || parsed?.currentSession?.access_token;
            if (token) return token;
          } catch { /* continue */ }
        }
      }
    } catch { /* ignore */ }
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
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    window.syncModalScrollLock?.();
  };

  // ---- Close Checkout Modal ----
  window.closeCheckoutModal = function () {
    const modal = document.getElementById('checkout-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    window.syncModalScrollLock?.();
    const alert = document.getElementById('jt-checkout-alert');
    if (alert) alert.style.display = 'none';
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
    if (cardM && cardA) {
      cardM.classList.toggle('active', currentInterval === 'monthly');
      cardA.classList.toggle('active', currentInterval === 'annual');
    }

    const optNameM = document.getElementById('jt-opt-name-monthly');
    const optPriceM = document.getElementById('jt-opt-price-monthly');
    const optNameA = document.getElementById('jt-opt-name-annual');
    const optPriceA = document.getElementById('jt-opt-price-annual');

    if (optNameM) optNameM.textContent = isPro ? 'Pro bulanan' : 'Plus bulanan';
    if (optPriceM) optPriceM.textContent = `USD ${planCfg.monthly.base}.00`;
    if (optNameA) optNameA.textContent = isPro ? 'Pro tahunan' : 'Plus tahunan';
    if (optPriceA) optPriceA.textContent = `USD ${planCfg.annual.base}.00`;

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
    if (sumTax) sumTax.textContent = fmtUsd(item.tax);
    if (sumTotal) sumTotal.textContent = fmtUsd(item.total);

    if (renDate) renDate.textContent = getRenewalDate(currentInterval);
    if (recText) {
      const periodWord = currentInterval === 'annual' ? 'tahun' : 'bulan';
      recText.textContent = `${fmtUsd(item.base)}/${periodWord} + pajak`;
    }
  }

  // ---- Execute Checkout Payment (Click "Berlangganan") ----
  window.executeCheckoutPayment = async function () {
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
            <p id="jt-psm-body">Paket <strong id="jt-psm-plan"></strong> Anda sekarang telah aktif. Muat ulang halaman untuk membuka seluruh fitur.</p>
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
    loadSnap().catch(() => {});
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
