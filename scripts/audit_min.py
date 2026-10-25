#!/usr/bin/env python3
from pathlib import Path
import re

# payment
pay = Path('js/payment.js')
p = pay.read_text(encoding='utf-8')
if 'journalingtrade_nmddjuqkdyhcobddinkc_auth' not in p:
    new_fn = (
        "async function getAuthToken() {\n"
        "    try {\n"
        "      const sb = window.cloudClient || window._supabaseClient || window.supabaseClient;\n"
        "      if (sb && sb.auth && sb.auth.getSession) {\n"
        "        const { data } = await sb.auth.getSession();\n"
        "        if (data && data.session && data.session.access_token) return data.session.access_token;\n"
        "      }\n"
        "      const STORAGE_KEY = 'journalingtrade_nmddjuqkdyhcobddinkc_auth';\n"
        "      const keys = [STORAGE_KEY].concat(Object.keys(localStorage).filter(function (k) { return /supabase|auth/i.test(k); }));\n"
        "      for (var i = 0; i < keys.length; i++) {\n"
        "        try {\n"
        "          var raw = localStorage.getItem(keys[i]);\n"
        "          if (!raw) continue;\n"
        "          var parsed = JSON.parse(raw);\n"
        "          var token = parsed && (parsed.access_token || (parsed.currentSession && parsed.currentSession.access_token) || (parsed.session && parsed.session.access_token));\n"
        "          if (typeof token === 'string' && token.length > 20) return token;\n"
        "        } catch (e) {}\n"
        "      }\n"
        "    } catch (e) { console.warn('getAuthToken', e); }\n"
        "    return null;\n"
        "  }\n"
    )
    p2, n = re.subn(r'async function getAuthToken\(\) \{[\s\S]*?\n  \}\n', new_fn, p, count=1)
    if not n:
        raise SystemExit('payment getAuthToken missing')
    p = p2
    print('payment ok')
pay.write_text(p, encoding='utf-8')

# app
app = Path('js/app.js')
a = app.read_text(encoding='utf-8')
if 'window.cloudClient = cloudClient' not in a:
    a = a.replace(
        "const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'journalingtrade_nmddjuqkdyhcobddinkc_auth', flowType: 'pkce' } });",
        "const cloudClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'journalingtrade_nmddjuqkdyhcobddinkc_auth', flowType: 'pkce' } });\n      window.cloudClient = cloudClient;",
        1,
    )
    print('cloudClient')
a2, n = re.subn(
    r'setInterval\(\(\) => \{ if \(!document\.hidden\) reloadPublisherNews\(\); \}, 300000\);',
    'setInterval(() => { if (!document.hidden) reloadPublisherNews(); }, 60000);',
    a,
    count=1,
)
if n:
    a = a2
    print('news60')
app.write_text(a, encoding='utf-8')

# pro helpers + language
pro = Path('js/pro.js')
t = pro.read_text(encoding='utf-8')
if 'function aiUiLanguage()' not in t:
    helper = (
        "\n  function aiUiLanguage() {\n"
        "    try {\n"
        "      const code = (global.JTI18n && global.JTI18n.language) || (typeof localStorage !== 'undefined' && localStorage.getItem('fncjt_language')) || 'en';\n"
        "      return code === 'id' ? 'id' : 'en';\n"
        "    } catch (_) { return 'en'; }\n"
        "  }\n"
        "  function aiLanguageDirective() {\n"
        "    return aiUiLanguage() === 'id'\n"
        "      ? 'Respond entirely in professional Indonesian (Bahasa Indonesia). Keep technical labels (FVG, Supply/Demand, SL/TP) in English when standard.'\n"
        "      : 'Respond entirely in clear professional English. Keep technical labels (FVG, Supply/Demand, SL/TP) in standard English.';\n"
        "  }\n"
    )
    t = t.replace('const text = (key,fallback)', helper + '  const text = (key,fallback)', 1)
    print('helpers')
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
    if old in t:
        t = t.replace(old, new)
        print('neutral')
for base in ['KAYSTRADE_SYSTEM_PROMPT', 'getChatSystemPrompt()', 'systemPrompt']:
    target = 'systemInstruction: ' + base + ' + String.fromCharCode(10) + aiLanguageDirective()'
    if target in t:
        continue
    t2, n = re.subn(r'systemInstruction:\s*' + re.escape(base) + r'(?!\s*\+)', target, t)
    if n:
        t = t2
        print('append', base)
pro.write_text(t, encoding='utf-8')

# home
home = Path('css/home.css')
h = home.read_text(encoding='utf-8')
if 'audit-home-layout-20261025' not in h:
    h += '\n/* audit-home-layout-20261025 */\nhtml, body { overflow-x: clip; }\n.home-shell, .home-hero, .home-hero-visual, .main-wrap { max-width: 100%; }\n.home-hero h1 { font-size: clamp(2.4rem, 5.5vw, 4.75rem) !important; line-height: 1.05 !important; max-width: 18ch; overflow-wrap: anywhere; }\n@media (max-width: 900px) { .home-hero { grid-template-columns: 1fr !important; min-height: auto !important; padding: 48px 0 32px !important; } .home-hero h1 { font-size: clamp(2rem, 9vw, 2.75rem) !important; max-width: 100%; } .home-actions { flex-wrap: wrap; gap: 10px; } .home-actions .btn { width: 100%; max-width: 320px; } }\n.home-reveal:not(.home-visible) { pointer-events: auto; }\n'
    home.write_text(h, encoding='utf-8')
    print('home')
print('done')
