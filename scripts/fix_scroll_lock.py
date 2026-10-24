#!/usr/bin/env python3
"""Fix permanent main-tab scroll lock after popup close.

Root cause: CSS :has(#checkout-modal:not([style*=display:none])) matches the
checkout modal even when it has no inline style (always present in DOM).
Also height:100%!important on html/body traps scroll after unlock.
"""
from pathlib import Path
import re
import sys

# ---------- style.css ----------
css = Path('css/style.css')
t = css.read_text(encoding='utf-8')

old_block = '''    /* Lock background screen ("tab utama") scroll when any popup or modal is active */
    html.modal-open,
    body.modal-open,
    body.pro-modal-open,
    body.pro-sheet-open,
    body.custom-select-locked,
    html:has(.modal-overlay.open),
    body:has(.modal-overlay.open),
    html:has(.pro-modal-backdrop),
    body:has(.pro-modal-backdrop),
    html:has(#backtestModalBackdrop),
    body:has(#backtestModalBackdrop),
    html:has(.jt-checkout-overlay:not([style*="display: none"]):not([style*="display:none"])),
    body:has(.jt-checkout-overlay:not([style*="display: none"]):not([style*="display:none"])),
    html:has(#checkout-modal:not([style*="display: none"]):not([style*="display:none"])),
    body:has(#checkout-modal:not([style*="display: none"]):not([style*="display:none"])),
    html:has(.pro-nav-modal.is-open),
    body:has(.pro-nav-modal.is-open),
    html:has(.app-custom-select-backdrop.is-open),
    body:has(.app-custom-select-backdrop.is-open) {
      overflow: hidden !important;
      height: 100% !important;
      overscroll-behavior: none !important;
    }'''

new_block = '''    /* Lock background ("tab utama") ONLY while a popup is actually open.
       Do NOT use bare :has(#checkout-modal) / :has(.pro-modal-backdrop) — those
       elements stay in the DOM when closed and permanently freeze page scroll. */
    html.modal-open,
    body.modal-open,
    body.pro-modal-open,
    body.pro-sheet-open,
    body.custom-select-locked,
    body.news-select-locked,
    html:has(.modal-overlay.open),
    body:has(.modal-overlay.open),
    html:has(.pro-modal-backdrop:not([hidden])),
    body:has(.pro-modal-backdrop:not([hidden])),
    html:has(#backtestModalBackdrop),
    body:has(#backtestModalBackdrop),
    html:has(#checkout-modal.is-open),
    body:has(#checkout-modal.is-open),
    html:has(.jt-checkout-overlay.is-open),
    body:has(.jt-checkout-overlay.is-open),
    html:has(.pro-nav-modal.is-open),
    body:has(.pro-nav-modal.is-open),
    html:has(.app-custom-select-backdrop.is-open),
    body:has(.app-custom-select-backdrop.is-open) {
      overflow: hidden !important;
      overscroll-behavior: none !important;
      /* do NOT set height:100% — it traps body scroll after unlock on mobile */
    }'''

if old_block not in t:
    if 'Do NOT use bare :has(#checkout-modal)' in t:
        print('style.css already fixed')
    else:
        # try looser match
        m = re.search(
            r'/\* Lock background screen.*?\*/\s*html\.modal-open,.*?\{[^{}]*overflow:\s*hidden\s*!important;[^{}]*\}',
            t,
            re.S,
        )
        if not m:
            raise SystemExit('CSS lock block not found')
        t = t[:m.start()] + new_block + t[m.end():]
        print('style.css patched via regex')
else:
    t = t.replace(old_block, new_block, 1)
    print('style.css patched')

css.write_text(t, encoding='utf-8')

# ---------- index.html: ensure checkout starts hidden ----------
idx = Path('index.html')
html = idx.read_text(encoding='utf-8')
if 'id="checkout-modal"' in html and 'id="checkout-modal" style=' not in html:
    html = html.replace(
        '<div class="jt-checkout-overlay" id="checkout-modal">',
        '<div class="jt-checkout-overlay" id="checkout-modal" style="display:none" hidden>',
        1,
    )
    print('index.html checkout hidden')
elif 'id="checkout-modal"' in html:
    html = re.sub(
        r'(<div class="jt-checkout-overlay" id="checkout-modal")([^>]*)>',
        r'\1 style="display:none" hidden>',
        html,
        count=1,
    )
    print('index.html checkout forced hidden')
idx.write_text(html, encoding='utf-8')

# Also 404 and route stubs if present
for path in list(Path('.').rglob('index.html')) + [Path('404.html')]:
    if not path.exists():
        continue
    if path.as_posix() == 'index.html':
        continue
    if 'node_modules' in path.parts:
        continue
    h = path.read_text(encoding='utf-8')
    if 'id="checkout-modal"' not in h:
        continue
    h2 = re.sub(
        r'(<div class="jt-checkout-overlay" id="checkout-modal")([^>]*)>',
        r'\1 style="display:none" hidden>',
        h,
        count=1,
    )
    if h2 != h:
        path.write_text(h2, encoding='utf-8')
        print('stub', path)

# ---------- payment.js: use is-open class + always clear overflow ----------
pay = Path('js/payment.js')
p = pay.read_text(encoding='utf-8')

p = p.replace(
    '''    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    window.syncModalScrollLock?.();''',
    '''    modal.style.display = 'flex';
    modal.classList.add('is-open');
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    window.syncModalScrollLock?.();''',
)
p = p.replace(
    '''    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    window.syncModalScrollLock?.();''',
    '''    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('is-open');
      modal.setAttribute('hidden', '');
    }
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    document.body.classList.remove('pro-modal-open', 'pro-sheet-open', 'custom-select-locked', 'news-select-locked');
    window.syncModalScrollLock?.();''',
)
pay.write_text(p, encoding='utf-8')
print('payment.js patched')

# ---------- app.js: safer isAnyModalActive + forceUnlock on close ----------
app = Path('js/app.js')
a = app.read_text(encoding='utf-8')

old_is = '''      function isAnyModalActive() {
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

new_is = '''      function isAnyModalActive() {
        const isVisiblyOpen = (el) => {
          if (!el) return false;
          if (el.hasAttribute('hidden')) return false;
          const disp = (el.style && el.style.display) || '';
          if (disp === 'none') return false;
          if (el.classList.contains('open') || el.classList.contains('is-open')) return true;
          // Dynamic backdrops are only in the DOM while open
          if (el.id === 'backtestModalBackdrop' || el.id === 'pro-gemini-modal') return true;
          if (disp && disp !== 'none') return true;
          return false;
        };
        const uploadModal = document.getElementById('upload-modal');
        const tvModal = document.getElementById('tv-modal');
        const accountModal = document.getElementById('account-modal');
        const checkoutModal = document.getElementById('checkout-modal');
        const backtestModal = document.getElementById('backtestModalBackdrop');
        const geminiModal = document.getElementById('pro-gemini-modal');
        const navModal = document.querySelector('.pro-nav-modal.is-open');

        return Boolean(
          (uploadModal && uploadModal.classList.contains('open')) ||
          (tvModal && tvModal.classList.contains('open')) ||
          (accountModal && accountModal.classList.contains('open')) ||
          isVisiblyOpen(checkoutModal) ||
          !!backtestModal ||
          !!geminiModal ||
          !!navModal ||
          document.body.classList.contains('pro-sheet-open') ||
          document.body.classList.contains('pro-modal-open') ||
          document.body.classList.contains('custom-select-locked') ||
          document.body.classList.contains('news-select-locked')
        );
      }'''

if old_is in a:
    a = a.replace(old_is, new_is, 1)
    print('app.js isAnyModalActive fixed')
elif 'isVisiblyOpen' in a:
    print('app.js already has isVisiblyOpen')
else:
    print('WARN isAnyModalActive not matched')

old_sync = '''      function syncModalScrollLock() {
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
      }'''

new_sync = '''      function syncModalScrollLock() {
        const active = isAnyModalActive();
        const root = document.documentElement;
        const body = document.body;
        if (active) {
          if (!root.classList.contains('modal-open')) root.classList.add('modal-open');
          if (!body.classList.contains('modal-open')) body.classList.add('modal-open');
        } else {
          // Fully release scroll lock (class + inline styles left by payment/pro).
          root.classList.remove('modal-open');
          body.classList.remove('modal-open', 'pro-modal-open', 'pro-sheet-open');
          if (body.style.overflow === 'hidden') body.style.overflow = '';
          if (root.style.overflow === 'hidden') root.style.overflow = '';
        }
      }

      /** Emergency unlock — call if tab utama stays frozen after popup close */
      window.forceUnlockPageScroll = function () {
        const root = document.documentElement;
        const body = document.body;
        root.classList.remove('modal-open');
        body.classList.remove('modal-open', 'pro-modal-open', 'pro-sheet-open', 'custom-select-locked', 'news-select-locked');
        body.style.overflow = '';
        root.style.overflow = '';
        document.querySelectorAll('.app-custom-select-backdrop.is-open, .app-custom-select-panel.is-open').forEach((el) => {
          el.classList.remove('is-open');
        });
        window.closeActiveSelect?.();
      };'''

if old_sync in a:
    a = a.replace(old_sync, new_sync, 1)
    print('app.js syncModalScrollLock fixed')
elif 'forceUnlockPageScroll' in a:
    print('app.js already has forceUnlock')
else:
    print('WARN syncModalScrollLock not matched')

app.write_text(a, encoding='utf-8')
print('ok')
