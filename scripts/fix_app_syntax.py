#!/usr/bin/env python3
"""Fix SyntaxError that broke the entire app.js (no startTrial / dead buttons)."""
from pathlib import Path
import re

app = Path('js/app.js')
t = app.read_text(encoding='utf-8')

# Broken from avatar patch: missing comma before avatarUrl
broken = "let profile = { name: 'Trader', currentAccount: 'demo_acc'  avatarUrl: '',};"
fixed = "let profile = { name: 'Trader', currentAccount: 'demo_acc', avatarUrl: '' };"

if broken in t:
    t = t.replace(broken, fixed, 1)
    print('fixed exact broken profile line')
else:
    t2, n = re.subn(
        r"let profile = \{\s*name:\s*'Trader',\s*currentAccount:\s*'demo_acc'\s+avatarUrl:",
        "let profile = { name: 'Trader', currentAccount: 'demo_acc', avatarUrl:",
        t,
        count=1,
    )
    if n:
        t = t2
        print('fixed via regex')
    elif "currentAccount: 'demo_acc', avatarUrl" in t or 'avatarUrl: \'\'\s*\}' in t:
        # already ok-ish
        print('already has comma or different form')
    else:
        # broader: any missing comma before avatarUrl in profile object
        t2, n = re.subn(
            r"(let profile = \{[^}]*?)(['\"])\s+(avatarUrl:)",
            r"\1\2, \3",
            t,
            count=1,
        )
        if n:
            t = t2
            print('fixed broader missing comma')
        else:
            raise SystemExit('could not find broken profile line')

# Validate no other obvious missing-comma avatarUrl patterns
if re.search(r"demo_acc'\s+avatarUrl", t):
    raise SystemExit('still broken')

app.write_text(t, encoding='utf-8')
print('ok')
