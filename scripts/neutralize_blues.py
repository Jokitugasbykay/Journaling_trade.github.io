#!/usr/bin/env python3
"""Replace remaining blue/sky/cyan accent tokens with neutral slate palette."""
from pathlib import Path
import re

# Ordered longest-first for hex / rgba replacements
HEX = [
    # sky
    ('#38bdf8', '#f1f5f9'), ('#38BDF8', '#f1f5f9'),
    ('#7dd3fc', '#e2e8f0'), ('#7DD3FC', '#e2e8f0'),
    ('#bae6fd', '#e2e8f0'), ('#BAE6FD', '#e2e8f0'),
    ('#e0f2fe', '#f1f5f9'), ('#E0F2FE', '#f1f5f9'),
    ('#0ea5e9', '#94a3b8'), ('#0EA5E9', '#94a3b8'),
    ('#0284c7', '#94a3b8'), ('#0284C7', '#94a3b8'),
    ('#0369a1', '#64748b'), ('#0369A1', '#64748b'),
    ('#7cb9ff', '#cbd5e1'), ('#7CB9FF', '#cbd5e1'),
    # blue
    ('#3b82f6', '#f1f5f9'), ('#3B82F6', '#f1f5f9'),
    ('#2563eb', '#e2e8f0'), ('#2563EB', '#e2e8f0'),
    ('#1d4ed8', '#cbd5e1'), ('#1D4ED8', '#cbd5e1'),
    ('#1e40af', '#94a3b8'), ('#1E40AF', '#94a3b8'),
    ('#1e3a8a', '#64748b'), ('#1E3A8A', '#64748b'),
    ('#60a5fa', '#e2e8f0'), ('#60A5FA', '#e2e8f0'),
    ('#93c5fd', '#cbd5e1'), ('#93C5FD', '#cbd5e1'),
    ('#bfdbfe', '#e2e8f0'), ('#BFDBFE', '#e2e8f0'),
    ('#dbeafe', '#f1f5f9'), ('#DBEAFE', '#f1f5f9'),
    # cyan (accent-like)
    ('#06b6d4', '#94a3b8'), ('#06B6D4', '#94a3b8'),
    ('#22d3ee', '#cbd5e1'), ('#22D3EE', '#cbd5e1'),
    ('#67e8f9', '#e2e8f0'), ('#67E8F9', '#e2e8f0'),
    ('#0891b2', '#64748b'), ('#0891B2', '#64748b'),
    ('#0e7490', '#64748b'), ('#0E7490', '#64748b'),
    # material blues occasionally used
    ('#2196f3', '#f1f5f9'), ('#2196F3', '#f1f5f9'),
    ('#1976d2', '#e2e8f0'), ('#1976D2', '#e2e8f0'),
    ('#42a5f5', '#e2e8f0'), ('#42A5F5', '#e2e8f0'),
    ('#29b6f6', '#e2e8f0'), ('#29B6F6', '#e2e8f0'),
    ('#4fc3f7', '#e2e8f0'), ('#4FC3F7', '#e2e8f0'),
    ('#03a9f4', '#94a3b8'), ('#03A9F4', '#94a3b8'),
    ('#00bcd4', '#94a3b8'), ('#00BCD4', '#94a3b8'),
]

RGBA = [
    # (r,g,b) -> replacement rgb tuple components as string template uses same alpha
    ((56, 189, 248), (241, 245, 249)),   # sky-400
    ((14, 165, 233), (148, 163, 184)),   # sky-500
    ((2, 132, 199), (148, 163, 184)),    # sky-600
    ((59, 130, 246), (241, 245, 249)),   # blue-500
    ((37, 99, 235), (226, 232, 240)),    # blue-600
    ((29, 78, 216), (203, 213, 225)),    # blue-700
    ((96, 165, 250), (226, 232, 240)),   # blue-400
    ((147, 197, 253), (203, 213, 225)),  # blue-300
    ((6, 182, 212), (148, 163, 184)),    # cyan-500
    ((34, 211, 238), (203, 213, 225)),   # cyan-400
    ((33, 150, 243), (241, 245, 249)),   # material blue
    ((99, 102, 241), (226, 232, 240)),   # indigo-ish used with blue glow
]

URL_ENC = [
    ('%2338bdf8', '%23f1f5f9'),
    ('%233B82F6', '%23f1f5f9'),
    ('%233b82f6', '%23f1f5f9'),
    ('%2360a5fa', '%23e2e8f0'),
    ('%2360A5FA', '%23e2e8f0'),
]

TARGETS = [
    'css/style.css', 'css/pro.css', 'css/home.css', 'css/shell.css', 'css/journal.css',
    'css/brand/journalingtrade.svg',
    'index.html',
    'js/app.js', 'js/pro.js', 'js/home.js', 'js/news-select.js', 'js/custom-select.js',
    'js/payment.js', 'js/fed.js', 'js/scan.js',
    'components/ui/index.css',
]

rgba_re = re.compile(
    r'rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([^)]+))?\)',
    re.I,
)

def map_rgba(m):
    r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
    alpha = m.group(4)
    for (or_, og, ob), (nr, ng, nb) in RGBA:
        if (r, g, b) == (or_, og, ob):
            if alpha is not None:
                return f'rgba({nr}, {ng}, {nb}, {alpha.strip()})'
            return f'rgb({nr}, {ng}, {nb})'
    return m.group(0)

changed_files = []
for rel in TARGETS:
    path = Path(rel)
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    orig = text
    for a, b in HEX:
        text = text.replace(a, b)
    for a, b in URL_ENC:
        text = text.replace(a, b)
    text = rgba_re.sub(map_rgba, text)
    # CSS variables named blue
    text = text.replace('--solid-blue:', '--solid-accent:')
    text = text.replace('var(--solid-blue)', 'var(--solid-accent)')
    if text != orig:
        path.write_text(text, encoding='utf-8')
        changed_files.append(rel)

print('changed', len(changed_files))
for f in changed_files:
    print(' ', f)

# Audit leftovers
pat = re.compile(
    r'#(?:0ea5e9|0284c7|0369a1|38bdf8|7dd3fc|3b82f6|2563eb|1d4ed8|60a5fa|93c5fd|bfdbfe|06b6d4|22d3ee|2196f3|7cb9ff|0294c7)|'
    r'rgba?\(\s*(?:56\s*,\s*189\s*,\s*248|59\s*,\s*130\s*,\s*246|37\s*,\s*99\s*,\s*235|96\s*,\s*165\s*,\s*250|6\s*,\s*182\s*,\s*212)\b',
    re.I,
)
left = 0
for rel in TARGETS:
    path = Path(rel)
    if not path.exists():
        continue
    for i, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if pat.search(line):
            left += 1
            print(f'LEFTOVER {rel}:{i}: {line.strip()[:120]}')
print('leftover_count', left)
