#!/usr/bin/env python3
from pathlib import Path
import re

app = Path('js/app.js')
t = app.read_text(encoding='utf-8')

# Publisher news client poll: any current interval -> 10 minutes
t2, n1 = re.subn(
    r'setInterval\(\(\) => \{ if \(!document\.hidden\) reloadPublisherNews\(\); \}, \d+\);',
    'setInterval(() => { if (!document.hidden) reloadPublisherNews(); }, 600000); // 10 minutes',
    t,
    count=1,
)
t = t2
print('news interval', n1)

# BI / exchange rate: was often 1 hour — set to 10 minutes
t2, n2 = re.subn(
    r'setInterval\(\(\) => \{ if \(!document\.hidden\) refreshExchangeRate\(\); \}, \d+\);',
    'setInterval(() => { if (!document.hidden) refreshExchangeRate(); }, 600000); // 10 minutes',
    t,
    count=1,
)
t = t2
print('bi interval', n2)

# visibility: also refresh BI when returning if older than 10 min
t2, n3 = re.subn(
    r"document\.addEventListener\('visibilitychange', \(\) => \{ if \(!document\.hidden && Date\.now\(\) - exchangeCheckedAt >= \d+\) refreshExchangeRate\(\); \}\);",
    "document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - exchangeCheckedAt >= 600000) refreshExchangeRate(); });",
    t,
    count=1,
)
t = t2
print('bi visibility', n3)

app.write_text(t, encoding='utf-8')
print('ok')
