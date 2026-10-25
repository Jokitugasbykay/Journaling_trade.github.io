#!/usr/bin/env python3
"""Unblock UI clicks: stuck backdrops, body locks, touch-action:none."""
from pathlib import Path
import re

# ---------- CSS ----------
style = Path('css/style.css')
s = style.read_text(encoding='utf-8')

# Backdrop must not intercept clicks when closed
old_bd = '''.app-custom-select-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100000;
  background: transparent;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.22s ease, visibility 0.22s ease;
}

.app-custom-select-backdrop.is-open {
  opacity: 1;
  visibility: visible;
}'''

new_bd = '''.app-custom-select-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100000;
  background: transparent;
  opacity: 0;
  visibility: hidden;
  pointer-events: none; /* critical: closed backdrop must never steal clicks */
  transition: opacity 0.22s ease, visibility 0.22s ease;
}

.app-custom-select-backdrop.is-open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}'''

if old_bd in s:
    s = s.replace(old_bd, new_bd, 1)
    print('backdrop pointer-events fixed')
elif 'pointer-events: none; /* critical: closed backdrop' in s:
    print('backdrop already fixed')
else:
    s2, n = re.subn(
        r'(\.app-custom-select-backdrop \{[^}]*)(visibility:\s*hidden;)',
        r'\1\2\n  pointer-events: none;',
        s,
        count=1,
    )
    s2, n2 = re.subn(
        r'(\.app-custom-select-backdrop\.is-open \{[^}]*)(visibility:\s*visible;)',
        r'\1\2\n  pointer-events: auto;',
        s2,
        count=1,
    )
    s = s2
    print('backdrop patched via regex', n, n2)

# Remove aggressive touch-action:none on body when news sheet locked
s = s.replace(
    'body.news-select-locked { overflow:hidden !important; touch-action:none; }',
    'body.news-select-locked { overflow:hidden !important; }',
)
s = s.replace('touch-action:none;\n    will-change:transform;', 'will-change:transform;')
# news menu itself should allow children to scroll; only handle uses none via separate rule
print('touch-action cleanup')

# Safety: never let fixed full-screen layers block when not open
SAFETY = '''
/* Safety: invisible layers must never trap clicks */
.app-custom-select-backdrop:not(.is-open),
.news-select-menu:not(:popover-open),
.modal-overlay:not(.open),
.jt-checkout-overlay:not(.is-open) {
  pointer-events: none !important;
}
body.modal-open .main-wrap,
body.custom-select-locked .main-wrap,
body.news-select-locked .main-wrap {
  /* do not set pointer-events on main — only scroll lock */
}
'''
if 'Safety: invisible layers must never trap clicks' not in s:
    s = s.rstrip() + '\n' + SAFETY + '\n'
    print('safety CSS added')

style.write_text(s, encoding='utf-8')

# ---------- custom-select.js: hard close all ----------
cs = Path('js/custom-select.js')
j = cs.read_text(encoding='utf-8')

if 'function closeAllCustomSelects' not in j:
    j = j.replace(
        '''  function closeActiveSelect() {
    if (activePanel) {
      activePanel.classList.remove('is-open');
      const trigger = activePanel._trigger;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      activePanel = null;
    }
    if (activeBackdrop) {
      activeBackdrop.classList.remove('is-open');
      activeBackdrop = null;
    }
    document.body.classList.remove('custom-select-locked');
  }''',
        '''  function closeActiveSelect() {
    if (activePanel) {
      activePanel.classList.remove('is-open');
      const trigger = activePanel._trigger;
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      activePanel = null;
    }
    if (activeBackdrop) {
      activeBackdrop.classList.remove('is-open');
      activeBackdrop = null;
    }
    // Sweep all instances (prevents orphan backdrops blocking the whole UI)
    document.querySelectorAll('.app-custom-select-backdrop.is-open').forEach((el) => el.classList.remove('is-open'));
    document.querySelectorAll('.app-custom-select-panel.is-open').forEach((el) => el.classList.remove('is-open'));
    document.querySelectorAll('.app-custom-select-trigger[aria-expanded="true"]').forEach((el) => el.setAttribute('aria-expanded', 'false'));
    document.body.classList.remove('custom-select-locked');
  }

  function closeAllCustomSelects() {
    closeActiveSelect();
  }
  window.closeAllCustomSelects = closeAllCustomSelects;
''',
        1,
    )
    print('custom-select hard close')
else:
    print('custom-select already has closeAll')

cs.write_text(j, encoding='utf-8')

# ---------- app.js: stronger forceUnlock + auto on load ----------
app = Path('js/app.js')
a = app.read_text(encoding='utf-8')

old_fu = '''      window.forceUnlockPageScroll = function () {
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

new_fu = '''      window.forceUnlockPageScroll = function () {
        const root = document.documentElement;
        const body = document.body;
        root.classList.remove('modal-open');
        body.classList.remove('modal-open', 'pro-modal-open', 'pro-sheet-open', 'custom-select-locked', 'news-select-locked');
        body.style.overflow = '';
        body.style.touchAction = '';
        root.style.overflow = '';
        root.style.touchAction = '';
        // Close every known overlay that can sit on top of the app
        document.querySelectorAll('.app-custom-select-backdrop.is-open, .app-custom-select-panel.is-open').forEach((el) => {
          el.classList.remove('is-open');
        });
        document.querySelectorAll('.modal-overlay.open').forEach((el) => el.classList.remove('open'));
        const checkout = document.getElementById('checkout-modal');
        if (checkout) {
          checkout.style.display = 'none';
          checkout.classList.remove('is-open');
          checkout.setAttribute('hidden', '');
        }
        document.querySelectorAll('.news-select-menu').forEach((panel) => {
          try {
            if (panel.matches && panel.matches(':popover-open')) panel.hidePopover();
          } catch (_) {}
          panel.classList.remove('is-sheet-in', 'is-sheet-dragging');
          panel.style.transform = '';
        });
        document.querySelectorAll('.pro-modal-backdrop, #backtestModalBackdrop, #pro-gemini-modal').forEach((el) => {
          try { el.remove(); } catch (_) {}
        });
        document.querySelectorAll('.pro-nav-modal.is-open').forEach((el) => el.classList.remove('is-open'));
        window.closeActiveSelect?.();
        window.closeAllCustomSelects?.();
        window.syncModalScrollLock?.();
      };

      // Auto-heal: if lock class is on but nothing is actually open, unlock
      function healStuckUiLocks() {
        const body = document.body;
        const hasOpenSelect = document.querySelector('.app-custom-select-panel.is-open, .app-custom-select-backdrop.is-open');
        const hasOpenNews = Array.from(document.querySelectorAll('.news-select-menu')).some((p) => {
          try { return p.matches(':popover-open'); } catch (_) { return false; }
        });
        const hasOpenModal = document.querySelector('.modal-overlay.open, #checkout-modal.is-open, .pro-modal-backdrop, #backtestModalBackdrop');
        if (!hasOpenSelect && body.classList.contains('custom-select-locked')) {
          body.classList.remove('custom-select-locked');
        }
        if (!hasOpenNews && body.classList.contains('news-select-locked')) {
          body.classList.remove('news-select-locked');
        }
        if (!hasOpenSelect && !hasOpenNews && !hasOpenModal && !body.classList.contains('pro-sheet-open') && !body.classList.contains('pro-modal-open')) {
          if (body.classList.contains('modal-open') || document.documentElement.classList.contains('modal-open')) {
            window.forceUnlockPageScroll();
          }
        }
      }
      window.healStuckUiLocks = healStuckUiLocks;
'''

if old_fu in a:
    a = a.replace(old_fu, new_fu, 1)
    print('forceUnlock expanded')
elif 'healStuckUiLocks' in a:
    print('heal already present')
else:
    # insert before isAnyModalActive export if force unlock exists partially
    if 'window.forceUnlockPageScroll' in a:
        a = re.sub(
            r'window\.forceUnlockPageScroll = function \(\) \{.*?\n      \};',
            new_fu.strip(),
            a,
            count=1,
            flags=re.S,
        )
        print('forceUnlock replaced via regex')
    else:
        raise SystemExit('forceUnlock not found')

# Boot heal on startup
if 'healStuckUiLocks' in a and "window.addEventListener('pageshow'" not in a[a.find('healStuckUiLocks'):a.find('healStuckUiLocks')+800]:
    boot = '''
      // Clear any leftover overlay lock from previous session / bfcache
      try { window.forceUnlockPageScroll(); } catch (_) {}
      window.addEventListener('pageshow', () => { try { window.forceUnlockPageScroll(); } catch (_) {} });
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') try { healStuckUiLocks(); } catch (_) {}
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') try { window.forceUnlockPageScroll(); } catch (_) {}
      });
      // Periodic safety net (cheap): orphan locks
      setInterval(() => { try { healStuckUiLocks(); } catch (_) {} }, 2500);
'''
    # append near end of IIFE before closing
    if 'setInterval(() => { try { healStuckUiLocks()' not in a:
        a = a.replace(
            "window.addEventListener('touchmove', blockBackgroundScroll, { passive: false });",
            "window.addEventListener('touchmove', blockBackgroundScroll, { passive: false });\n" + boot,
            1,
        )
        print('boot heal hooks added')

app.write_text(a, encoding='utf-8')
print('ok')
