#!/usr/bin/env python3
"""Closed news-select popover must stay display:none — never always flex."""
from pathlib import Path
import re

css = Path('css/style.css')
t = css.read_text(encoding='utf-8')

# Fix mobile block: remove permanent display:flex on .news-select-menu
old = '''  .news-select-menu {
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
  }'''

new = '''  .news-select-menu {
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
    /* CRITICAL: closed popover must stay hidden (no always-on flex = stuck footer sheet) */
    display:none !important;
    flex-direction:column !important;
    gap:8px !important;
    overflow:hidden !important;
    transform:translate3d(0, 100%, 0);
    transition:transform .32s cubic-bezier(0.32, 0.72, 0, 1);
    touch-action:none;
    will-change:transform;
  }
  .news-select-menu:popover-open {
    display:flex !important;
    flex-direction:column !important;
  }'''

if old in t:
    t = t.replace(old, new, 1)
    print('replaced exact block')
elif 'CRITICAL: closed popover must stay hidden' in t:
    print('already fixed')
else:
    # fallback: strip bare display:flex on mobile menu
    t2, n = re.subn(
        r'(@media\(max-width:768px\)[^{]*\{[^}]*?\.news-select-menu \{[^}]*?)display:flex !important;',
        r'\1display:none !important;',
        t,
        count=1,
        flags=re.S,
    )
    if n:
        t = t2
        print('regex display:none applied', n)
    else:
        raise SystemExit('could not patch')

css.write_text(t, encoding='utf-8')

# Also ensure close cleans is-sheet-in in JS (already mostly there)
ns = Path('js/news-select.js')
j = ns.read_text(encoding='utf-8')
if "panel.hidePopover()" in j and 'forceHideSheet' not in j:
    # ensure any leftover sheet class cleared on page show
    if 'pageshow' not in j:
        j = j.replace(
            "  window.addEventListener('scroll', close, { passive: true });\n})();",
            "  window.addEventListener('scroll', close, { passive: true });\n"
            "  window.addEventListener('pageshow', () => {\n"
            "    controls.forEach(({panel}) => {\n"
            "      panel.classList.remove('is-sheet-in', 'is-sheet-dragging');\n"
            "      panel.style.transform = '';\n"
            "      try { if (panel.matches(':popover-open')) panel.hidePopover(); } catch (_) {}\n"
            "    });\n"
            "    document.body.classList.remove('news-select-locked');\n"
            "  });\n})();",
        )
        print('pageshow cleanup added')
    ns.write_text(j, encoding='utf-8')

print('ok')
