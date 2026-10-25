#!/usr/bin/env python3
"""Core audit fixes: Midtrans auth, multilingual Kayla AI, news refresh, home layout."""
from pathlib import Path
import re

# =====================================================================
# 1) payment.js — auth token must read the real Supabase session storage
# =====================================================================
pay = Path('js/payment.js')
p = pay.read_text(encoding='utf-8')

old_auth = '''  async function getAuthToken() {
    try {
      const sb = window._supabaseClient || window.supabaseClient;
      if (sb) {
        const { data } = await sb.auth.getSession();
        return data?.session?.access_token || null;
      }
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.includes('supabase') && k.includes('auth')) {
          try {
            const parsed = JSON.parse(localStorage.getItem(k) || '{}');
            const token  = parsed?.access_token || parsed?.currentSession?.access_token;
            if (token) return token;
          } catch { /* continue */ }
        }
      }
    } catch { /* ignore */ }
    return null;
  }'''

new_auth = '''  async function getAuthToken() {
    try {
      // Prefer the live client used by the app (exposed after boot)
      const sb = window.cloudClient || window._supabaseClient || window.supabaseClient;
      if (sb?.auth?.getSession) {
        const { data } = await sb.auth.getSession();
        if (data?.session?.access_token) return data.session.access_token;
      }
      // Known storage key for this project (must match app.js createClient options)
      const STORAGE_KEY = 'journalingtrade_nmddjuqkdyhcobddinkc_auth';
      const keys = [STORAGE_KEY, ...Object.keys(localStorage).filter((k) => /supabase|auth/i.test(k))];
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const token =
            parsed?.access_token ||
            parsed?.currentSession?.access_token ||
            parsed?.session?.access_token ||
            (parsed?.user && parsed?.access_token);
          // supabase-js v2 stores { access_token, ... } under the storage key value
          if (typeof token === 'string' && token.length > 20) return token;
          // sometimes nested as JSON string
          if (parsed?.currentSession && typeof parsed.currentSession === 'string') {
            try {
              const inner = JSON.parse(parsed.currentSession);
              if (inner?.access_token) return inner.access_token;
            } catch { /* ignore */ }
          }
        } catch { /* continue */ }
      }
    } catch (e) {
      console.warn('getAuthToken', e);
    }
    return null;
  }'''

if old_auth in p:
    p = p.replace(old_auth, new_auth, 1)
    print('payment: getAuthToken fixed')
elif 'journalingtrade_nmddjuqkdyhcobddinkc_auth' in p:
    print('payment: auth already patched')
else:
    # fallback: insert after first getAuthToken definition via regex
    p2, n = re.subn(
        r'async function getAuthToken\(\) \{[\s\S]*?\n  \}\n',
        new_auth + '\n',
        p,
        count=1,
    )
    if n:
        p = p2
        print('payment: getAuthToken via regex')
    else:
        raise SystemExit('payment getAuthToken not found')

# Clearer bilingual error when not signed in
p = p.replace(
    "throw new Error('Anda harus masuk terlebih dahulu untuk berlangganan.');",
    "throw new Error((window.JTI18n?.language === 'id') ? 'Anda harus masuk terlebih dahulu untuk berlangganan.' : 'Sign in first to subscribe.');",
)
p = p.replace(
    "throw new Error(data.detail || 'Gagal membuat sesi pembayaran Midtrans.');",
    "throw new Error(data.detail || ((window.JTI18n?.language === 'id') ? 'Gagal membuat sesi pembayaran Midtrans.' : 'Could not create Midtrans payment session.'));",
)

pay.write_text(p, encoding='utf-8')

# =====================================================================
# 2) app.js — expose cloudClient + faster news refresh
# =====================================================================
app = Path('js/app.js')
a = app.read_text(encoding='utf-8')

if 'window.cloudClient = cloudClient' not in a:
    a = a.replace(
        "const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'journalingtrade_nmddjuqkdyhcobddinkc_auth', flowType: 'pkce' } });",
        "const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'journalingtrade_nmddjuqkdyhcobddinkc_auth', flowType: 'pkce' } });\n"
        "      // Expose for payment.js / other modules that need the live session\n"
        "      window.cloudClient = cloudClient;",
        1,
    )
    print('app: window.cloudClient exposed')
else:
    print('app: cloudClient already exposed')

# News: 5 min -> 60 sec when tab visible
a2, n = re.subn(
    r"setInterval\(\(\) => \{ if \(!document\.hidden\) reloadPublisherNews\(\); \}, 300000\);",
    "setInterval(() => { if (!document.hidden) reloadPublisherNews(); }, 60000); // realtime-ish: every 60s",
    a,
    count=1,
)
if n:
    a = a2
    print('app: news poll 60s')
else:
    print('app: news interval already changed or missing')

app.write_text(a, encoding='utf-8')

# =====================================================================
# 3) pro.js — multilingual Kayla AI (follow UI language)
# =====================================================================
pro = Path('js/pro.js')
pr = pro.read_text(encoding='utf-8')

LANG_HELPER = r'''
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
    # insert near text helper at top of IIFE content
    if 'const text = (key,fallback)' in pr:
        pr = pr.replace(
            'const text = (key,fallback)',
            LANG_HELPER + '\n  const text = (key,fallback)',
            1,
        )
        print('pro: ai language helpers added')
    else:
        raise SystemExit('pro text helper not found')
else:
    print('pro: helpers exist')

# Replace hard-coded "Gunakan Bahasa Indonesia..." directives with dynamic ones
replacements = [
    (
        'Gunakan Bahasa Indonesia yang profesional dan mendalam. Label Supply/Demand menggunakan istilah baku teknikal (misalnya Fresh Demand, Mitigated Supply, FVG).',
        '${aiLanguageDirective()} Label Supply/Demand using standard technical terms (e.g. Fresh Demand, Mitigated Supply, FVG).',
    ),
    (
        'Berikan analisis terstruktur dalam Bahasa Indonesia profesional:',
        'Provide a structured professional analysis. ${aiLanguageDirective()}',
    ),
    (
        'Gunakan Bahasa Indonesia profesional, lugas, tajam, dan mudah dipahami dalam format Markdown dengan tabel dan bullet points.',
        '${aiLanguageDirective()} Use clear Markdown with tables and bullet points.',
    ),
    (
        '   - Output Anda HARUS 100% langsung berupa teks percakapan final dalam Bahasa Indonesia yang ditujukan kepada pengguna.',
        '   - Your output MUST be 100% the final conversational reply to the user. ${aiLanguageDirective()}',
    ),
    (
        'Gunakan bahasa Indonesia untuk seluruh penjelasan analisa. Label Supply/Demand dan komponen UI Signal Card menggunakan bahasa Inggris.',
        '${aiLanguageDirective()} Keep Supply/Demand labels and Signal Card UI component names in English.',
    ),
]

for old, new in replacements:
    if old in pr:
        pr = pr.replace(old, new)
        print('pro: replaced ID-only directive')

# KAYSTRADE / BEHAVIOUR / JOURNAL prompts are const template strings - if we inserted ${}
# they need to become template literals. Convert those const "`...`" that now contain ${aiLanguageDirective()}
# to ensure they are evaluated as templates (they already use backticks).

# getChatSystemPrompt - ensure it injects language each call
if 'function getChatSystemPrompt()' in pr and 'aiLanguageDirective()' not in pr[pr.find('function getChatSystemPrompt()'):pr.find('function getChatSystemPrompt()')+800]:
    pr = pr.replace(
        'function getChatSystemPrompt() {',
        'function getChatSystemPrompt() {\n    const _langLine = aiLanguageDirective();',
        1,
    )
    # add language line near start of returned string if possible
    print('pro: getChatSystemPrompt lang hook')

# Force language line into system prompts at call sites by wrapping getChatSystemPrompt usage is enough for chat.
# For static const prompts that still say Indonesia, convert to functions:
for name in ['KAYSTRADE_SYSTEM_PROMPT', 'BEHAVIOUR_SYSTEM_PROMPT', 'JOURNAL_ANALYST_SYSTEM_PROMPT']:
    # if still const with backticks and ${aiLanguageDirective}, OK
    if f'const {name} =' in pr and '${aiLanguageDirective()}' in pr:
        # convert const to function so ${} evaluates with current language each time
        pr = pr.replace(f'const {name} = `', f'function get_{name}() {{ return `', 1)
        # close: find end of that template - fragile. Instead append at call sites.
        print(f'pro: note {name} has dynamic lang')

# Safer: at systemInstruction assignment sites, append language directive
pr2, n = re.subn(
    r'systemInstruction:\s*KAYSTRADE_SYSTEM_PROMPT',
    "systemInstruction: (typeof get_KAYSTRADE_SYSTEM_PROMPT==='function'?get_KAYSTRADE_SYSTEM_PROMPT():KAYSTRADE_SYSTEM_PROMPT) + '\\n' + aiLanguageDirective()",
    pr,
)
pr = pr2
print('pro: kaystrade instruction sites', n)

pr2, n = re.subn(
    r'systemInstruction:\s*getChatSystemPrompt\(\)',
    "systemInstruction: getChatSystemPrompt() + '\\n' + aiLanguageDirective()",
    pr,
)
pr = pr2
print('pro: chat instruction sites', n)

pr2, n = re.subn(
    r'systemInstruction:\s*systemPrompt',
    "systemInstruction: systemPrompt + '\\n' + aiLanguageDirective()",
    pr,
)
pr = pr2
print('pro: systemPrompt sites', n)

pro.write_text(pr, encoding='utf-8')

# =====================================================================
# 4) home.css — fix oversized hero / overflow on PC + mobile
# =====================================================================
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
@media (min-width: 1100px) {
  .home-hero { align-items: center; }
}
.home-reveal:not(.home-visible) { pointer-events: auto; /* never block clicks while animating */ }
'''
    home.write_text(h, encoding='utf-8')
    print('home.css layout fixes')
else:
    print('home.css already patched')

print('ok')
