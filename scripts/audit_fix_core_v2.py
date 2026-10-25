#!/usr/bin/env python3
"""Safe core audit: payment auth, AI language append, news 60s, home layout."""
from pathlib import Path
import re

# ---------- payment.js ----------
pay = Path('js/payment.js')
p = pay.read_text(encoding='utf-8')
if 'journalingtrade_nmddjuqkdyhcobddinkc_auth' not in p:
    p2, n = re.subn(
        r'async function getAuthToken\(\) \{[\s\S]*?\n  \}\n',
        '''async function getAuthToken() {
    try {
      const sb = window.cloudClient || window._supabaseClient || window.supabaseClient;
      if (sb?.auth?.getSession) {
        const { data } = await sb.auth.getSession();
        if (data?.session?.access_token) return data.session.access_token;
      }
      const STORAGE_KEY = 'journalingtrade_nmddjuqkdyhcobddinkc_auth';
      const keys = [STORAGE_KEY, ...Object.keys(localStorage).filter((k) => /supabase|auth/i.test(k))];
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token;
          if (typeof token === 'string' && token.length > 20) return token;
        } catch { /* continue */ }
      }
    } catch (e) { console.warn('getAuthToken', e); }
    return null;
  }
''',
        p,
        count=1,
    )
    if not n:
        raise SystemExit('payment auth not patched')
    p = p2
    print('payment auth patched')
else:
    print('payment auth ok')
pay.write_text(p, encoding='utf-8')

# ---------- app.js ----------
app = Path('js/app.js')
a = app.read_text(encoding='utf-8')
if 'window.cloudClient = cloudClient' not in a:
    a = a.replace(
        "const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'journalingtrade_nmddjuqkdyhcobddinkc_auth', flowType: 'pkce' } });",
        "const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'journalingtrade_nmddjuqkdyhcobddinkc_auth', flowType: 'pkce' } });\n      window.cloudClient = cloudClient;",
        1,
    )
    print('cloudClient exposed')
a2, n = re.subn(
    r'setInterval\(\(\) => \{ if \(!document\.hidden\) reloadPublisherNews\(\); \}, 300000\);',
    'setInterval(() => { if (!document.hidden) reloadPublisherNews(); }, 60000);',
    a,
    count=1,
)
if n:
    a = a2
    print('news 60s')
app.write_text(a, encoding='utf-8')

# ---------- pro.js language (safe: helpers + append at call sites only) ----------
pro = Path('js/pro.js')
pr = pro.read_text(encoding='utf-8')

# Remove broken previous patches: systemInstruction: systemPrompt + '  with broken newline
pr = re.sub(
    r"systemInstruction:\s*systemPrompt\s*\+\s*'\s*\n\s*'\s*\+\s*aiLanguageDirective\(\)",
    'systemInstruction: systemPrompt + "\\n" + aiLanguageDirective()',
    pr,
)
pr = re.sub(
    r"systemInstruction:\s*getChatSystemPrompt\(\)\s*\+\s*'\s*\n\s*'\s*\+\s*aiLanguageDirective\(\)",
    'systemInstruction: getChatSystemPrompt() + "\\n" + aiLanguageDirective()',
    pr,
)
pr = re.sub(
    r"systemInstruction:\s*\(typeof get_KAYSTRADE_SYSTEM_PROMPT==='function'\?get_KAYSTRADE_SYSTEM_PROMPT\(\):KAYSTRADE_SYSTEM_PROMPT\)\s*\+\s*'\s*\n\s*'\s*\+\s*aiLanguageDirective\(\)",
    'systemInstruction: KAYSTRADE_SYSTEM_PROMPT + "\\n" + aiLanguageDirective()',
    pr,
)
# Also fix if the string was written with actual newline inside quotes badly
pr = re.sub(
    r"systemInstruction:\s*systemPrompt\s*\+\s*'[^']*'\s*\+\s*aiLanguageDirective\(\)",
    'systemInstruction: systemPrompt + "\\n" + aiLanguageDirective()',
    pr,
)

HELPER = '''
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

if 'function aiUiLanguage()' not in pr:
    if 'const text = (key,fallback)' in pr:
        pr = pr.replace('const text = (key,fallback)', HELPER + '\n  const text = (key,fallback)', 1)
        print('helpers added')
    else:
        raise SystemExit('text helper missing')
else:
    print('helpers present')

# Strip ${aiLanguageDirective()} inside static template strings (would be literal if const)
pr = pr.replace('${aiLanguageDirective()}', '')

# Revert Indonesian-only lines to neutral + rely on append at runtime
for old, new in [
    ('Gunakan Bahasa Indonesia yang profesional dan mendalam. Label Supply/Demand menggunakan istilah baku teknikal (misalnya Fresh Demand, Mitigated Supply, FVG).',
     'Follow the user interface language. Label Supply/Demand using standard technical terms (e.g. Fresh Demand, Mitigated Supply, FVG).'),
    ('Berikan analisis terstruktur dalam Bahasa Indonesia profesional:',
     'Provide a structured professional analysis:'),
    ('Gunakan Bahasa Indonesia profesional, lugas, tajam, dan mudah dipahami dalam format Markdown dengan tabel dan bullet points.',
     'Use clear Markdown with tables and bullet points.'),
    ('   - Output Anda HARUS 100% langsung berupa teks percakapan final dalam Bahasa Indonesia yang ditujukan kepada pengguna.',
     '   - Your output MUST be 100% the final conversational reply to the user (match the UI language).'),
    ('Gunakan bahasa Indonesia untuk seluruh penjelasan analisa. Label Supply/Demand dan komponen UI Signal Card menggunakan bahasa Inggris.',
     'Explain the analysis in the UI language. Keep Supply/Demand labels and Signal Card component names in English.'),
]:
    if old in pr:
        pr = pr.replace(old, new)
        print('neutralized ID prompt')

# Ensure call sites append language (idempotent)
def ensure_append(pattern, repl):
    global pr
    if re.search(re.escape(repl[:40]), pr):
        return
    pr2, n = re.subn(pattern, repl, pr)
    if n:
        pr = pr2
        print('appended', n)

ensure_append(
    r'systemInstruction:\s*KAYSTRADE_SYSTEM_PROMPT(?!\s*\+)',
    'systemInstruction: KAYSTRADE_SYSTEM_PROMPT + "\\n" + aiLanguageDirective()',
)
ensure_append(
    r'systemInstruction:\s*getChatSystemPrompt\(\)(?!\s*\+)',
    'systemInstruction: getChatSystemPrompt() + "\\n" + aiLanguageDirective()',
)
ensure_append(
    r'systemInstruction:\s*systemPrompt(?!\s*\+)',
    'systemInstruction: systemPrompt + "\\n" + aiLanguageDirective()',
)

pro.write_text(pr, encoding='utf-8')

# ---------- home.css ----------
home = Path('css/home.css')
h = home.read_text(encoding='utf-8')
if 'audit-home-layout-20261025' not in h:
    h += '''

/* audit-home-layout-20261025 */
html, body { overflow-x: clip; }
.home-shell, .home-hero, .home-hero-visual, .main-wrap { max-width: 100%; }
.home-hero h1 {
  font-size: clamp(2.4rem, 5.5vw, 4.75rem) !important;
  line-height: 1.05 !important;
  max-width: 18ch;
  overflow-wrap: anywhere;
}
@media (max-width: 900px) {
  .home-hero {
    grid-template-columns: 1fr !important;
    min-height: auto !important;
    padding: 48px 0 32px !important;
    gap: 24px !important;
  }
  .home-hero h1 { font-size: clamp(2rem, 9vw, 2.75rem) !important; max-width: 100%; }
  .home-actions { flex-wrap: wrap; gap: 10px; }
  .home-actions .btn { width: 100%; max-width: 320px; }
}
.home-reveal:not(.home-visible) { pointer-events: auto; }
'''
    home.write_text(h, encoding='utf-8')
    print('home css')
else:
    print('home css ok')

print('ok')
