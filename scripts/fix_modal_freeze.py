#!/usr/bin/env python3
"""Fix popup freeze: bad isAnyModalActive + document-wide MutationObservers."""
from pathlib import Path
import re
import sys

# ---------- app.js ----------
app = Path('js/app.js')
t = app.read_text(encoding='utf-8')

old_is_any = '''      function isAnyModalActive() {
        const uploadModal = document.getElementById('upload-modal');
        const tvModal = document.getElementById('tv-modal');
        const accountModal = document.getElementById('account-modal');
        const checkoutModal = document.getElementById('checkout-modal');
        const backtestModal = document.getElementById('backtestModalBackdrop');
        const geminiModal = document.getElementById('pro-gemini-modal');
        const proBackdrop = document.querySelector('.pro-modal-backdrop');
        const navModal = document.querySelector('.pro-nav-modal.is-open');

        return Boolean(
          (uploadModal && uploadModal.classList.contains('open')) ||
          (tvModal && tvModal.classList.contains('open')) ||
          (accountModal && accountModal.classList.contains('open')) ||
          (checkoutModal && checkoutModal.style.display && checkoutModal.style.display !== 'none') ||
          backtestModal ||
          geminiModal ||
          proBackdrop ||
          navModal ||
          document.body.classList.contains('pro-sheet-open') ||
          document.body.classList.contains('pro-modal-open') ||
          document.body.classList.contains('custom-select-locked')
        );
      }'''

new_is_any = '''      function isAnyModalActive() {
        const isOpenOverlay = (el) => {
          if (!el) return false;
          if (el.classList.contains('open') || el.classList.contains('is-open')) return true;
          const disp = el.style && el.style.display;
          if (disp && disp !== 'none') return true;
          return false;
        };
        const uploadModal = document.getElementById('upload-modal');
        const tvModal = document.getElementById('tv-modal');
        const accountModal = document.getElementById('account-modal');
        const checkoutModal = document.getElementById('checkout-modal');
        const backtestModal = document.getElementById('backtestModalBackdrop');
        const geminiModal = document.getElementById('pro-gemini-modal');
        const proBackdrop = document.querySelector('.pro-modal-backdrop.is-open, .pro-modal-backdrop.app');
        const navModal = document.querySelector('.pro-nav-modal.is-open');
        // Only treat dynamic backdrops as active when they are actually in the open tree
        // (they are removed on close). Static overlays need .open / display check.

        return Boolean(
          (uploadModal && uploadModal.classList.contains('open')) ||
          (tvModal && tvModal.classList.contains('open')) ||
          (accountModal && accountModal.classList.contains('open')) ||
          (checkoutModal && isOpenOverlay(checkoutModal)) ||
          !!backtestModal ||
          !!geminiModal ||
          !!proBackdrop ||
          !!navModal ||
          document.body.classList.contains('pro-sheet-open') ||
          document.body.classList.contains('pro-modal-open') ||
          document.body.classList.contains('custom-select-locked')
        );
      }'''

if old_is_any not in t:
    if 'const isOpenOverlay' in t:
        print('app.js isAnyModalActive already patched')
    else:
        raise SystemExit('isAnyModalActive block not found')
else:
    t = t.replace(old_is_any, new_is_any, 1)
    print('patched isAnyModalActive')

old_sync = '''      function syncModalScrollLock() {
        const active = isAnyModalActive();
        if (active) {
          document.documentElement.classList.add('modal-open');
          document.body.classList.add('modal-open');
        } else {
          document.documentElement.classList.remove('modal-open');
          document.body.classList.remove('modal-open');
        }
      }

      window.syncModalScrollLock = syncModalScrollLock;
      window.isAnyModalActive = isAnyModalActive;

      if (typeof MutationObserver !== 'undefined') {
        const modalObserver = new MutationObserver(() => {
          syncModalScrollLock();
        });
        modalObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['class', 'style', 'hidden', 'open']
        });
      }'''

new_sync = '''      function syncModalScrollLock() {
        const active = isAnyModalActive();
        const root = document.documentElement;
        const body = document.body;
        // Avoid redundant classList writes (they re-trigger observers / layout).
        if (active) {
          if (!root.classList.contains('modal-open')) root.classList.add('modal-open');
          if (!body.classList.contains('modal-open')) body.classList.add('modal-open');
        } else {
          if (root.classList.contains('modal-open')) root.classList.remove('modal-open');
          if (body.classList.contains('modal-open')) body.classList.remove('modal-open');
        }
      }

      window.syncModalScrollLock = syncModalScrollLock;
      window.isAnyModalActive = isAnyModalActive;

      // Do NOT observe the whole document for class/style changes — that freezes the UI
      // when modals open (chart/ticker/class toggles flood the observer).
      // Call syncModalScrollLock() explicitly from open/close handlers instead.'''

if old_sync not in t:
    if 'Do NOT observe the whole document' in t:
        print('app.js observer already removed')
    else:
        raise SystemExit('syncModalScrollLock/observer block not found')
else:
    t = t.replace(old_sync, new_sync, 1)
    print('patched syncModalScrollLock + removed observer')

app.write_text(t, encoding='utf-8')

# ---------- custom-select.js ----------
cs = Path('js/custom-select.js')
c = cs.read_text(encoding='utf-8')

old_obs = '''  // Watch for dynamically added select elements (modals, tabs, etc.)
  if (typeof MutationObserver !== 'undefined') {
    let timer = null;
    const debouncedInit = () => {
      if (timer) cancelAnimationFrame(timer);
      timer = requestAnimationFrame(() => {
        initAllSelects();
      });
    };
    const bodyObserver = new MutationObserver(debouncedInit);
    bodyObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden']
    });
  }'''

new_obs = '''  // Watch for dynamically added select elements (modals, tabs, etc.)
  // Only childList — attribute watching caused freezes when modals toggled class/style.
  if (typeof MutationObserver !== 'undefined') {
    let timer = null;
    const debouncedInit = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        initAllSelects();
      }, 120);
    };
    const bodyObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
          debouncedInit();
          break;
        }
      }
    });
    bodyObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }'''

if old_obs not in c:
    if 'Only childList' in c:
        print('custom-select already patched')
    else:
        raise SystemExit('custom-select observer block not found')
else:
    c = c.replace(old_obs, new_obs, 1)
    print('patched custom-select observer')

cs.write_text(c, encoding='utf-8')
print('ok')
