#!/usr/bin/env python3
"""Enhance all native <select> (incl. Pro workspace) and style date/calendar controls."""
from pathlib import Path
import re

# ---- 1) custom-select.js: stop skipping .pro-workspace ----
cs = Path('js/custom-select.js')
j = cs.read_text(encoding='utf-8')
old_skip = """  function enhanceSelect(select) {
    if (!select || select.dataset.customEnhanced === 'true') return;
    // Skip if inside Pro Workspace or already enhanced by news-select
    if (select.id === 'pro-section-selector' || select.id === 'news-region' || select.id === 'news-source') return;
    if (select.closest && select.closest('.pro-workspace')) return;
    // Skip if explicitly hidden in markup
    if (select.style.display === 'none' || select.hidden) return;"""

new_skip = """  function enhanceSelect(select) {
    if (!select || select.dataset.customEnhanced === 'true') return;
    // Skip only selects that have their own custom UI (news popover / pro mobile nav)
    if (select.id === 'pro-section-selector' || select.id === 'news-region' || select.id === 'news-source') return;
    // Skip if explicitly hidden in markup
    if (select.style.display === 'none' || select.hidden) return;"""

if old_skip in j:
    j = j.replace(old_skip, new_skip, 1)
    print('custom-select: pro-workspace skip removed')
elif "select.closest('.pro-workspace')" not in j:
    print('custom-select: already no pro skip')
else:
    j2, n = re.subn(
        r"\s*if \(select\.closest && select\.closest\('\.pro-workspace'\)\) return;\n",
        '\n',
        j,
        count=1,
    )
    if n:
        j = j2
        print('custom-select: removed pro-workspace line')
    else:
        raise SystemExit('could not patch enhanceSelect skip')

cs.write_text(j, encoding='utf-8')

# ---- 2) pro.js: init custom selects after every section render ----
pro = Path('js/pro.js')
p = pro.read_text(encoding='utf-8')
needle = "        window.dispatchEvent(new Event('resize'));\n        status.style.display='';\n        if(status.textContent===text('Loading','Loading…'))status.textContent='';"
repl = "        window.dispatchEvent(new Event('resize'));\n        window.initCustomSelects?.();\n        status.style.display='';\n        if(status.textContent===text('Loading','Loading…'))status.textContent='';"
if needle in p and "window.initCustomSelects?.();\n        status.style.display='';\n        if(status.textContent===text('Loading'" not in p:
    p = p.replace(needle, repl, 1)
    print('pro.js: initCustomSelects after success render')
elif 'initCustomSelects' in p[p.find('async function open'):p.find('async function open')+5000]:
    print('pro.js: init already near open success')
else:
    # softer insert after pro-tab-fade-in on success path only once
    p2, n = re.subn(
        r"(content\.classList\.add\('pro-tab-fade-in'\);\s*window\.dispatchEvent\(new Event\('resize'\);)",
        r"\1\n        window.initCustomSelects?.();",
        p,
        count=1,
    )
    if n:
        p = p2
        print('pro.js: init via regex')
    else:
        print('WARN pro.js init not inserted')

pro.write_text(p, encoding='utf-8')

# ---- 3) CSS: date inputs + calendar dropdowns match app chrome ----
style = Path('css/style.css')
s = style.read_text(encoding='utf-8')

DATE_BLOCK = '''
/* Unified dark date / calendar controls (avoid default Chrome white picker chrome) */
input[type="date"],
input[type="datetime-local"],
input[type="month"],
input[type="time"],
input[type="week"] {
  color-scheme: dark;
  -webkit-appearance: none;
  appearance: none;
  background-color: #0d121c;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #f1f5f9;
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
  min-height: 42px;
  padding: 9px 13px;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
}
input[type="date"]:hover,
input[type="datetime-local"]:hover,
input[type="month"]:hover,
input[type="time"]:hover {
  border-color: rgba(241, 245, 249, 0.5);
  background-color: #121824;
}
input[type="date"]:focus,
input[type="datetime-local"]:focus,
input[type="month"]:focus,
input[type="time"]:focus {
  outline: none;
  border-color: #f1f5f9;
  box-shadow: 0 0 0 3px rgba(241, 245, 249, 0.22);
}
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="datetime-local"]::-webkit-calendar-picker-indicator,
input[type="month"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.7;
  filter: invert(1) brightness(1.2);
}
input[type="date"]::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}

/* Economic calendar filter dropdowns (details) */
.calendar-dropdown {
  position: relative;
  width: 100%;
}
.calendar-dropdown > summary {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 42px;
  padding: 9px 13px;
  background: #0d121c;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #f1f5f9;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}
.calendar-dropdown > summary::-webkit-details-marker { display: none; }
.calendar-dropdown > summary::after {
  content: '';
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") center / 16px no-repeat;
  transition: transform 0.15s ease;
}
.calendar-dropdown[open] > summary {
  border-color: rgba(241, 245, 249, 0.45);
  background: #121824;
}
.calendar-dropdown[open] > summary::after {
  transform: rotate(180deg);
}
.calendar-dropdown-panel {
  margin-top: 8px;
  padding: 10px;
  background: #0d121c;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
@media (max-width: 768px) {
  input[type="date"],
  input[type="datetime-local"],
  input[type="month"],
  input[type="time"],
  .calendar-dropdown > summary {
    min-height: 48px;
    font-size: 16px;
  }
}
'''

if 'Unified dark date / calendar controls' not in s:
    # append before end if possible, else at end of file
    s = s.rstrip() + '\n' + DATE_BLOCK + '\n'
    print('style.css: date + calendar dropdown styles added')
else:
    print('style.css: date styles already present')

style.write_text(s, encoding='utf-8')

# pro.css color-scheme for .f date inputs inside workspace
pro_css = Path('css/pro.css')
if pro_css.exists():
    pc = pro_css.read_text(encoding='utf-8')
    if 'color-scheme: dark' not in pc[:2000] and 'input[type="date"]' not in pc:
        pc += '''
.pro-workspace input[type="date"],
.pro-workspace input[type="datetime-local"],
.pro-workspace input[type="month"],
.pro-workspace input[type="time"] {
  color-scheme: dark;
}
.pro-workspace select.app-custom-select-native {
  position: absolute !important;
  opacity: 0 !important;
  pointer-events: none !important;
  width: 1px !important;
  height: 1px !important;
}
'''
        pro_css.write_text(pc, encoding='utf-8')
        print('pro.css: date color-scheme + hide native enhanced selects')
    else:
        print('pro.css: skip or already has date rules')

print('ok')
