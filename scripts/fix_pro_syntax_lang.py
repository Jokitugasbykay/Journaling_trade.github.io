#!/usr/bin/env python3
from pathlib import Path
import re

p = Path('js/pro.js')
t = p.read_text(encoding='utf-8')

# Fix broken multi-line string concatenations introduced by bad escapes:
#   systemInstruction: FOO + "
#   " + aiLanguageDirective()
pattern = re.compile(
    r'systemInstruction:\s*(KAYSTRADE_SYSTEM_PROMPT|getChatSystemPrompt\(\)|systemPrompt)\s*\+\s*"\s*\n\s*"\s*\+\s*aiLanguageDirective\(\)'
)
t2, n = pattern.subn(
    r'systemInstruction: \1 + String.fromCharCode(10) + aiLanguageDirective()',
    t,
)
print('fixed broken', n)

# Also single-line with literal backslash-n in quotes is fine; ensure append exists
for base in ['KAYSTRADE_SYSTEM_PROMPT', 'getChatSystemPrompt()', 'systemPrompt']:
    if f'systemInstruction: {base} + String.fromCharCode(10) + aiLanguageDirective()' in t2:
        continue
    # plain without append
    t2, n2 = re.subn(
        rf'systemInstruction:\s*{re.escape(base)}(?!\s*\+)',
        f'systemInstruction: {base} + String.fromCharCode(10) + aiLanguageDirective()',
        t2,
    )
    if n2:
        print('appended', base, n2)

# Ensure helpers exist
if 'function aiUiLanguage()' not in t2:
    helper = '''
  function aiUiLanguage() {
    try {
      const code = (global.JTI18n && global.JTI18n.language) || (typeof localStorage !== 'undefined' && localStorage.getItem('fncjt_language')) || 'en';
      return code === 'id' ? 'id' : 'en';
    } catch (_) { return 'en'; }
  }
  function aiLanguageDirective() {
    return aiUiLanguage() === 'id'
      ? 'Respond entirely in professional Indonesian (Bahasa Indonesia). Keep technical labels (FVG, Supply/Demand, SL/TP) in English when standard.'
      : 'Respond entirely in clear professional English. Keep technical labels (FVG, Supply/Demand, SL/TP) in standard English.';
  }
'''
    if 'const text = (key,fallback)' in t2:
        t2 = t2.replace('const text = (key,fallback)', helper + '\n  const text = (key,fallback)', 1)
        print('helpers added')

p.write_text(t2, encoding='utf-8')
print('ok')
