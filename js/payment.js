// Midtrans Snap Checkout – JournalingTrade
// Handles plan selection, token fetching, and Snap popup lifecycle.
// Depends on: window.JTPRO_CONFIG, Supabase session, Midtrans Snap.js

(function () {
  'use strict';

  const GATEWAY_BASE   = window.JTPRO_CONFIG?.apiBase?.replace('/pro-gateway', '') || 'https://nmddjuqkdyhcobddinkc.supabase.co/functions/v1';
  const TOKEN_ENDPOINT = GATEWAY_BASE + '/midtrans-create-token';

  // Midtrans Client Key (safe to expose – public key only)
  const MIDTRANS_CLIENT_KEY = 'Mid-client-eIKqYJoLSaZC9Sip';
  const SNAP_SCRIPT_URL     = 'https://app.sandbox.midtrans.com/snap/snap.js'; // switch to production later

  let snapLoaded = false;

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
      // Fallback: read from localStorage
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

  // ---- UI helpers ----
  function setBtnState(btn, state, originalText) {
    if (!btn) return;
    if (state === 'loading') {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Preparing checkout...';
      btn.classList.add('jt-btn-loading');
    } else if (state === 'idle') {
      btn.disabled = false;
      btn.textContent = originalText || btn.dataset.originalText || btn.textContent;
      btn.classList.remove('jt-btn-loading');
    } else if (state === 'error') {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || 'Subscribe';
      btn.classList.remove('jt-btn-loading');
    }
  }

  function showPricingError(msg) {
    // Try to find or create a toast / alert near the pricing section
    let alert = document.getElementById('jt-pricing-alert');
    if (!alert) {
      alert = document.createElement('p');
      alert.id = 'jt-pricing-alert';
      alert.role = 'alert';
      alert.style.cssText = 'color:#ff6b6b;font-size:.85rem;text-align:center;margin:.75rem 0;grid-column:1/-1;';
      const grid = document.querySelector('.paid-plan-grid');
      if (grid) grid.insertAdjacentElement('afterend', alert);
    }
    alert.textContent = msg;
    setTimeout(() => { if (alert.textContent === msg) alert.textContent = ''; }, 6000);
  }

  // ---- Main checkout flow ----
  async function startCheckout(plan, interval, btn) {
    const token = await getAuthToken();
    if (!token) {
      // Redirect to login with redirect back to pricing
      const base = document.getElementById('site-base')?.href || '/';
      window.location.href = base + 'login/?redirect=home%23pricing';
      return;
    }

    const origText = btn?.textContent || 'Subscribe';
    setBtnState(btn, 'loading');

    try {
      // 1. Load Snap.js in parallel with token fetch
      const [_, tokenRes] = await Promise.all([
        loadSnap(),
        fetch(TOKEN_ENDPOINT, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ plan, interval }),
        }),
      ]);

      const data = await tokenRes.json();
      if (!tokenRes.ok || !data.token) {
        throw new Error(data.detail || 'Could not create payment session');
      }

      setBtnState(btn, 'idle', origText);

      // 2. Open Snap popup
      window.snap.pay(data.token, {
        onSuccess: function (result) {
          console.log('Payment success:', result);
          showSuccessModal(plan);
        },
        onPending: function (result) {
          console.log('Payment pending:', result);
          showPricingError('Your payment is being processed. We will email you once confirmed.');
        },
        onError: function (result) {
          console.error('Payment error:', result);
          showPricingError('Payment could not be completed. Please try again.');
        },
        onClose: function () {
          // User closed popup without paying – no action needed
          setBtnState(btn, 'idle', origText);
        },
      });

    } catch (err) {
      console.error('Checkout error:', err);
      showPricingError(err.message || 'Payment service error. Please try again.');
      setBtnState(btn, 'error', origText);
    }
  }

  // ---- Success modal ----
  function showSuccessModal(plan) {
    let modal = document.getElementById('jt-payment-success-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'jt-payment-success-modal';
      modal.innerHTML = `
        <div class="jt-psm-backdrop">
          <div class="jt-psm-card" role="dialog" aria-modal="true" aria-labelledby="jt-psm-title">
            <div class="jt-psm-icon">&#10003;</div>
            <h2 id="jt-psm-title">Payment Successful</h2>
            <p id="jt-psm-body">Your <strong id="jt-psm-plan"></strong> plan is now active. Refresh the page to unlock all features.</p>
            <button class="btn btn-primary" id="jt-psm-close">Refresh &amp; continue</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      document.getElementById('jt-psm-close').addEventListener('click', () => location.reload());
    }
    document.getElementById('jt-psm-plan').textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    modal.style.display = 'flex';
  }

  // ---- Wire up pricing buttons ----
  function initPricingButtons() {
    const plusBtn = document.getElementById('jt-plus-subscribe-btn');
    const proBtn  = document.getElementById('jt-pro-subscribe-btn');

    if (plusBtn) {
      plusBtn.addEventListener('click', function () {
        const cycle = document.querySelector('[data-cycle="annual"][aria-pressed="true"]') ? 'annual' : 'monthly';
        startCheckout('plus', cycle, plusBtn);
      });
    }

    if (proBtn) {
      proBtn.addEventListener('click', function () {
        const cycle = document.querySelector('[data-cycle="annual"][aria-pressed="true"]') ? 'annual' : 'monthly';
        startCheckout('pro', cycle, proBtn);
      });
    }
  }

  // ---- Inject success modal styles ----
  function injectStyles() {
    if (document.getElementById('jt-payment-styles')) return;
    const style = document.createElement('style');
    style.id = 'jt-payment-styles';
    style.textContent = `
      .jt-btn-loading { opacity: .7; cursor: not-allowed; position: relative; }
      .jt-btn-loading::after {
        content: '';
        position: absolute;
        right: .75rem;
        top: 50%;
        transform: translateY(-50%);
        width: 14px; height: 14px;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: jt-spin .6s linear infinite;
      }
      @keyframes jt-spin { to { transform: translateY(-50%) rotate(360deg); } }

      #jt-payment-success-modal {
        display: none;
        position: fixed; inset: 0; z-index: 9999;
        align-items: center; justify-content: center;
      }
      .jt-psm-backdrop {
        position: absolute; inset: 0;
        background: rgba(0,0,0,.75); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
      }
      .jt-psm-card {
        background: #1a1a2e; border: 1px solid #2d2d44;
        border-radius: 16px; padding: 2.5rem 2rem;
        max-width: 400px; width: 90%; text-align: center;
        box-shadow: 0 24px 48px rgba(0,0,0,.5);
      }
      .jt-psm-icon {
        width: 56px; height: 56px; border-radius: 50%;
        background: #22c55e; color: #fff;
        font-size: 1.75rem; line-height: 56px;
        margin: 0 auto 1.25rem;
      }
      .jt-psm-card h2 { margin: 0 0 .75rem; font-size: 1.4rem; }
      .jt-psm-card p  { margin: 0 0 1.5rem; color: #9ca3af; line-height: 1.6; }
    `;
    document.head.appendChild(style);
  }

  // ---- Bootstrap ----
  function init() {
    injectStyles();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPricingButtons);
    } else {
      initPricingButtons();
    }
  }

  init();

  // Expose for use by other scripts
  window.jtPayment = { startCheckout };

})();
