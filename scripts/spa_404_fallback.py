#!/usr/bin/env python3
"""Create 404.html and per-route index.html stubs for GitHub Pages SPA routing."""
from pathlib import Path
import shutil

root = Path('.')
index = root / 'index.html'
if not index.exists():
    raise SystemExit('index.html missing')

shutil.copyfile(index, root / '404.html')
print('wrote 404.html', (root / '404.html').stat().st_size)

routes = [
    'home',
    'journal',
    'statistics',
    'calculator',
    'economic-news',
    'economic-news/calendar',
    'profile',
    'login',
    'pro',
    'analytics',
    'heatmap',
    'strategies',
    'risk',
    'reviews',
    'reports',
    'ai',
    'global-news',
]

for route in routes:
    dest = root / route / 'index.html'
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(index, dest)
    print('stub', dest)

print('ok')
