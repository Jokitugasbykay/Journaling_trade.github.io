#!/usr/bin/env python3
"""Fix news bottom-sheet: scroll blocked, flat open, no drag handle."""
from pathlib import Path
import re

# ---------- 1) app.js: allow touch scroll inside news sheet ----------
app = Path('js/app.js')
a = app.read_text(encoding='utf-8')
old = "'.modal-card, .backtest-modal-dialog, .pro-modal-dialog, .jt-checkout-container, .pro-nav-sheet, .custom-select-options-list, .sheet, .tw'"
new = "'.modal-card, .backtest-modal-dialog, .pro-modal-dialog, .jt-checkout-container, .pro-nav-sheet, .custom-select-options-list, .app-custom-select-panel, .news-select-menu, .news-select-options, .sheet, .tw'"
if old in a:
    a = a.replace(old, new)
    print('app.js scroll allowlist updated')
elif 'news-select-options' in a:
    print('app.js already allows news-select')
else:
    raise SystemExit('blockBackgroundScroll selector not found')
app.write_text(a, encoding='utf-8')

# ---------- 2) style.css: flex scroll + slide animation ----------
css = Path('css/style.css')
c = css.read_text(encoding='utf-8')

old_mobile = '''@media(max-width:768px) {
  body.news-select-locked { overflow:hidden !important; }
  .news-select-menu {
    position:fixed !important;
    inset:auto 0 0 0 !important;
    top:auto !important;
    bottom:0 !important;
    left:0 !important;
    right:0 !important;
    width:100% !important;
    max-width:100% !important;
    max-height:85vh !important;
    border-radius:22px 22px 0 0 !important;
    border:0 !important;
    border-top:1px solid rgba(241,245,249,0.3) !important;
    background:#0d121c !important;
    box-shadow:0 -12px 48px rgba(0,0,0,0.8) !important;
    padding:8px 16px env(safe-area-inset-bottom, 16px) !important;
    margin:0 !important;
    transform:translateY(100%);
    transition:transform .25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }
  .news-select-menu:popover-open {
    display:flex !important;
    flex-direction:column !important;
    transform:translateY(0) !important;
  }
  .news-select-header {
    display:flex;
    flex-direction:column;
    padding:4px 0 10px;
    border-bottom:1px solid rgba(255,255,255,0.08);
    flex-shrink:0;
  }
  .news-select-handle {
    width:38px;
    height:4px;
    border-radius:2px;
    background:rgba(255,255,255,0.2);
    margin:0 auto 8px;
  }
  .news-select-header-content {
    display:flex;
    align-items:center;
    justify-content:space-between;
  }
  .news-select-title {
    font-size:15px;
    font-weight:600;
    color:var(--text-main);
  }
  .news-select-close {
    background:transparent;
    border:0;
    color:var(--text-muted);
    padding:6px;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    border-radius:6px;
  }
  .news-select-close:hover {
    color:var(--text-main);
    background:var(--bg-card-hover);
  }
  .news-select-close svg {
    width:18px;
    height:18px;
  }
  .news-select-search {
    margin-top:8px;
  }
  .news-select-options {
    max-height:calc(85vh - 140px);
    -webkit-overflow-scrolling:touch;
  }
  .news-select-option {
    min-height:50px;
    padding:13px 38px 13px 48px;
    font-size:15px;
  }
}'''

new_mobile = '''@media(max-width:768px) {
  body.news-select-locked { overflow:hidden !important; touch-action:none; }
  .news-select-menu {
    position:fixed !important;
    inset:auto 0 0 0 !important;
    top:auto !important;
    bottom:0 !important;
    left:0 !important;
    right:0 !important;
    width:100% !important;
    max-width:100% !important;
    height:min(88vh, 720px) !important;
    max-height:88vh !important;
    border-radius:22px 22px 0 0 !important;
    border:0 !important;
    border-top:1px solid rgba(241,245,249,0.3) !important;
    background:#0d121c !important;
    box-shadow:0 -12px 48px rgba(0,0,0,0.8) !important;
    padding:4px 16px env(safe-area-inset-bottom, 16px) !important;
    margin:0 !important;
    display:flex !important;
    flex-direction:column !important;
    gap:8px !important;
    overflow:hidden !important;
    /* slide starts off-screen; .is-sheet-in brings it up */
    transform:translate3d(0, 100%, 0);
    transition:transform .32s cubic-bezier(0.32, 0.72, 0, 1);
    touch-action:none;
    will-change:transform;
  }
  .news-select-menu:popover-open {
    display:flex !important;
    flex-direction:column !important;
  }
  .news-select-menu.is-sheet-in {
    transform:translate3d(0, 0, 0);
  }
  .news-select-menu.is-sheet-dragging {
    transition:none !important;
  }
  .news-select-menu::backdrop {
    background:rgba(5,8,16,0.55);
    backdrop-filter:blur(6px);
    -webkit-backdrop-filter:blur(6px);
    opacity:0;
    transition:opacity .28s ease;
  }
  .news-select-menu.is-sheet-in::backdrop {
    opacity:1;
  }
  .news-select-header {
    display:flex;
    flex-direction:column;
    padding:2px 0 10px;
    border-bottom:1px solid rgba(255,255,255,0.08);
    flex-shrink:0;
    touch-action:none;
    user-select:none;
    -webkit-user-select:none;
  }
  .news-select-handle {
    width:44px;
    height:5px;
    border-radius:999px;
    background:rgba(255,255,255,0.28);
    margin:6px auto 10px;
    cursor:grab;
    touch-action:none;
  }
  .news-select-handle:active {
    cursor:grabbing;
    background:rgba(255,255,255,0.45);
  }
  .news-select-header-content {
    display:flex;
    align-items:center;
    justify-content:space-between;
  }
  .news-select-title {
    font-size:15px;
    font-weight:600;
    color:var(--text-main);
  }
  .news-select-close {
    background:transparent;
    border:0;
    color:var(--text-muted);
    padding:6px;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    border-radius:6px;
  }
  .news-select-close:hover {
    color:var(--text-main);
    background:var(--bg-card-hover);
  }
  .news-select-close svg {
    width:18px;
    height:18px;
  }
  .news-select-search {
    margin-top:4px;
    flex-shrink:0;
  }
  /* Critical: flex child needs min-height:0 to actually scroll */
  .news-select-options {
    flex:1 1 auto;
    min-height:0 !important;
    max-height:none !important;
    overflow-y:auto !important;
    overscroll-behavior:contain;
    -webkit-overflow-scrolling:touch;
    touch-action:pan-y;
  }
  .news-select-option {
    min-height:50px;
    padding:13px 38px 13px 48px;
    font-size:15px;
  }
}
@media (max-width:768px) and (prefers-reduced-motion: reduce) {
  .news-select-menu {
    transition:none !important;
    transform:none !important;
  }
  .news-select-menu.is-sheet-in {
    transform:none !important;
  }
}'''

if old_mobile in c:
    c = c.replace(old_mobile, new_mobile, 1)
    print('style.css mobile sheet updated')
elif 'is-sheet-in' in c:
    print('style.css already has is-sheet-in')
else:
    m = re.search(r'@media\(max-width:768px\) \{\s*body\.news-select-locked.*?(?=\n@media|\Z)', c, re.S)
    if not m:
        raise SystemExit('mobile news-select CSS block not found')
    c = c[:m.start()] + new_mobile + '\n' + c[m.end():]
    print('style.css mobile sheet replaced via regex')
css.write_text(c, encoding='utf-8')

# ---------- 3) news-select.js: slide animation + drag handle ----------
ns = Path('js/news-select.js')
j = ns.read_text(encoding='utf-8')

# Inject helpers once near top after IIFE start
if 'function animateSheetOpen' not in j:
    inject_at = j.find("  function enhance")
    if inject_at < 0:
        inject_at = j.find('  const controls')
    helper = r'''
  function isMobileSheet() {
    return window.innerWidth <= 768;
  }

  function animateSheetOpen(panel) {
    if (!isMobileSheet()) {
      panel.classList.add('is-sheet-in');
      return;
    }
    panel.classList.remove('is-sheet-in', 'is-sheet-dragging');
    panel.style.transform = '';
    // force reflow then slide up
    void panel.offsetHeight;
    requestAnimationFrame(() => {
      panel.classList.add('is-sheet-in');
    });
  }

  function animateSheetClose(panel) {
    return new Promise((resolve) => {
      if (!isMobileSheet() || !panel.matches(':popover-open')) {
        panel.classList.remove('is-sheet-in', 'is-sheet-dragging');
        panel.style.transform = '';
        resolve();
        return;
      }
      const finish = () => {
        panel.removeEventListener('transitionend', onEnd);
        panel.classList.remove('is-sheet-in', 'is-sheet-dragging');
        panel.style.transform = '';
        resolve();
      };
      const onEnd = (e) => {
        if (e.target !== panel || (e.propertyName && e.propertyName !== 'transform')) return;
        finish();
      };
      panel.addEventListener('transitionend', onEnd);
      panel.classList.remove('is-sheet-in');
      // safety timeout
      setTimeout(finish, 380);
    });
  }

  function bindSheetDrag(panel, handleEl) {
    if (!handleEl || handleEl.dataset.dragBound === '1') return;
    handleEl.dataset.dragBound = '1';
    let startY = 0;
    let currentY = 0;
    let dragging = false;

    const onStart = (clientY) => {
      if (!isMobileSheet() || !panel.matches(':popover-open')) return;
      dragging = true;
      startY = clientY;
      currentY = 0;
      panel.classList.add('is-sheet-dragging');
    };
    const onMove = (clientY) => {
      if (!dragging) return;
      currentY = Math.max(0, clientY - startY);
      panel.style.transform = 'translate3d(0, ' + currentY + 'px, 0)';
    };
    const onEnd = async () => {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('is-sheet-dragging');
      const threshold = Math.min(140, panel.offsetHeight * 0.22);
      if (currentY > threshold) {
        // dismiss
        panel.style.transform = 'translate3d(0, 100%, 0)';
        panel.classList.remove('is-sheet-in');
        setTimeout(() => {
          try { panel.hidePopover(); } catch (_) {}
          panel.style.transform = '';
        }, 280);
      } else {
        // snap back up
        panel.style.transform = '';
        panel.classList.add('is-sheet-in');
      }
      currentY = 0;
    };

    handleEl.addEventListener('touchstart', (e) => {
      if (e.touches[0]) onStart(e.touches[0].clientY);
    }, { passive: true });
    handleEl.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();
      if (e.touches[0]) onMove(e.touches[0].clientY);
    }, { passive: false });
    handleEl.addEventListener('touchend', onEnd);
    handleEl.addEventListener('touchcancel', onEnd);

    handleEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      handleEl.setPointerCapture?.(e.pointerId);
      onStart(e.clientY);
    });
    handleEl.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      onMove(e.clientY);
    });
    handleEl.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch') return;
      onEnd();
    });
  }

'''
    # Find a good insert point - after first const declarations
    marker = "  const closeIcon ="
    if marker in j:
        # insert before closeIcon is fine, at start of IIFE body after 'use strict'
        pass
    # insert after the opening of the IIFE's first function block - look for controls
    m = re.search(r"\n  const controls = \[\];", j)
    if m:
        j = j[:m.start()] + '\n' + helper + j[m.start():]
        print('injected sheet animation helpers')
    else:
        raise SystemExit('controls marker not found')

# Bind drag on handle after panel HTML created
if "bindSheetDrag(panel" not in j:
    j = j.replace(
        "if (closeBtn) closeBtn.addEventListener('click', () => panel.hidePopover());",
        "if (closeBtn) closeBtn.addEventListener('click', async () => {\n"
        "      await animateSheetClose(panel);\n"
        "      try { panel.hidePopover(); } catch (_) {}\n"
        "    });\n"
        "    const handleEl = panel.querySelector('.news-select-handle');\n"
        "    bindSheetDrag(panel, handleEl);\n"
        "    // also allow dragging from the whole header bar\n"
        "    const headerEl = panel.querySelector('.news-select-header');\n"
        "    if (headerEl) bindSheetDrag(panel, headerEl);",
        1,
    )
    print('bound drag handle + animated close')

# on beforetoggle open: animate in; on close: unlock
old_bt = '''    panel.addEventListener('beforetoggle', event => {
      if (event.newState !== 'open') {
        document.body.classList.remove('news-select-locked');
        lockSearchInput();
        return;
      }
      if (window.innerWidth <= 768) {
        document.body.classList.add('news-select-locked');
      }
      input.value = ''; active = -1; rows = [];
      lockSearchInput();
      sync(); render(); list.scrollTop = 0; position();
    });'''

new_bt = '''    panel.addEventListener('beforetoggle', event => {
      if (event.newState !== 'open') {
        document.body.classList.remove('news-select-locked');
        panel.classList.remove('is-sheet-in', 'is-sheet-dragging');
        panel.style.transform = '';
        lockSearchInput();
        return;
      }
      if (window.innerWidth <= 768) {
        document.body.classList.add('news-select-locked');
      }
      input.value = ''; active = -1; rows = [];
      lockSearchInput();
      sync(); render(); list.scrollTop = 0; position();
      // slide-up after popover paints
      panel.classList.remove('is-sheet-in');
      requestAnimationFrame(() => animateSheetOpen(panel));
    });'''

if old_bt in j:
    j = j.replace(old_bt, new_bt, 1)
    print('beforetoggle animated')
elif 'animateSheetOpen(panel)' in j:
    print('beforetoggle already animated')
else:
    print('WARN beforetoggle not matched')

ns.write_text(j, encoding='utf-8')
print('ok')
