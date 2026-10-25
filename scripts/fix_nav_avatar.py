#!/usr/bin/env python3
"""Show custom/Google avatar in the top-right account button."""
from pathlib import Path
import re

app = Path('js/app.js')
t = app.read_text(encoding='utf-8')

# Improve setProfileAvatarDisplay: prefer custom > google > initials for nav
old_fn_start = "      function setProfileAvatarDisplay(url) {"
if 'nav photo preference' not in t:
    # Replace the whole function body more carefully
    new_fn = r'''      function setProfileAvatarDisplay(url) {
        // nav photo preference: custom upload > google > initials
        const userImg = $('tpc-user-avatar');
        const googleImg = $('tpc-google-avatar');
        const navImg = $('nav-avatar-img');
        const navInit = $('nav-avatar-initials');
        const removeBtn = $('profile-avatar-remove-btn');
        const google = (typeof googleAccountProfile === 'function') ? googleAccountProfile() : null;
        const custom = !!(url && String(url).trim());
        const googleUrl = (!custom && google && google.avatar) ? google.avatar : '';
        const shown = custom ? String(url).trim() : googleUrl;

        if (userImg) {
          userImg.hidden = !custom;
          if (custom) {
            userImg.onerror = () => { userImg.hidden = true; };
            if (userImg.src !== url) userImg.src = url;
          } else {
            userImg.removeAttribute('src');
          }
        }
        if (googleImg) {
          // Profile card: custom hides google photo
          if (custom) {
            googleImg.hidden = true;
          } else if (googleUrl) {
            googleImg.hidden = false;
            googleImg.onerror = () => { googleImg.hidden = true; };
            if (googleImg.src !== googleUrl) googleImg.src = googleUrl;
          } else {
            googleImg.hidden = true;
            googleImg.removeAttribute('src');
          }
        }
        if (navImg) {
          if (shown) {
            navImg.hidden = false;
            navImg.onerror = () => {
              navImg.hidden = true;
              if (navInit) navInit.hidden = false;
            };
            if (navImg.src !== shown) navImg.src = shown;
            if (navInit) navInit.hidden = true;
          } else {
            navImg.hidden = true;
            navImg.removeAttribute('src');
          }
        }
        if (removeBtn) removeBtn.hidden = !custom || !cloudUser;
      }
'''
    # Find and replace from function setProfileAvatarDisplay to next function
    m = re.search(r'      function setProfileAvatarDisplay\(url\) \{.*?(?=\n      (?:async )?function |\n      window\.)', t, re.S)
    if not m:
        raise SystemExit('setProfileAvatarDisplay not found')
    t = t[:m.start()] + new_fn + t[m.end():]
    print('setProfileAvatarDisplay replaced')
else:
    print('setProfileAvatarDisplay already updated')

# Wire renderAccountAccess to show nav photo
old_block = """        $('nav-dd-username').textContent = hasProfile ? name : uiText('Selamat datang', 'Welcome');
        $('nav-avatar-initials').textContent = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
        $('nav-trader-name').textContent = name;
        $('nav-account-plan').textContent = plan;
        $('nav-dd-plan').textContent = plan;
        for (const id of ['nav-avatar-initials', 'nav-account-copy', 'nav-dd-plan', 'nav-account-storage']) $(id).hidden = !hasProfile;"""

new_block = """        $('nav-dd-username').textContent = hasProfile ? name : uiText('Selamat datang', 'Welcome');
        $('nav-avatar-initials').textContent = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
        $('nav-trader-name').textContent = name;
        $('nav-account-plan').textContent = plan;
        $('nav-dd-plan').textContent = plan;
        for (const id of ['nav-avatar-initials', 'nav-account-copy', 'nav-dd-plan', 'nav-account-storage']) $(id).hidden = !hasProfile;
        // Top-right photo: custom upload > Google photo > initials
        try {
          let navPhoto = profileAvatarUrl();
          if (!navPhoto && cloudUser) {
            try { navPhoto = localStorage.getItem('fncjt_avatar_' + cloudUser.id) || ''; if (navPhoto) profile.avatarUrl = navPhoto; } catch (_) {}
          }
          setProfileAvatarDisplay(navPhoto || '');
          // If no photo URL, ensure initials are visible when profile is shown
          if (!navPhoto && !googleAccountProfile()?.avatar && hasProfile) {
            const navInit = $('nav-avatar-initials');
            const navImg = $('nav-avatar-img');
            if (navInit) navInit.hidden = false;
            if (navImg) navImg.hidden = true;
          }
        } catch (_) {}"""

if old_block in t and 'Top-right photo: custom upload' not in t:
    t = t.replace(old_block, new_block, 1)
    print('renderAccountAccess wired')
elif 'Top-right photo: custom upload' in t:
    print('renderAccountAccess already wired')
else:
    raise SystemExit('renderAccountAccess block not found')

# When profile avatar_url loads from cloud, refresh nav
if "if (data.avatar_url) profile.avatarUrl = data.avatar_url;" in t and 'renderAccountAccess()' not in t[t.find('if (data.avatar_url) profile.avatarUrl'):t.find('if (data.avatar_url) profile.avatarUrl')+200]:
    t = t.replace(
        "if (data.avatar_url) profile.avatarUrl = data.avatar_url;",
        "if (data.avatar_url) profile.avatarUrl = data.avatar_url; try { renderAccountAccess(); } catch (_) {}",
        1,
    )
    print('refresh nav on avatar_url load')

app.write_text(t, encoding='utf-8')

# CSS: style nav img like the yellow initials circle
shell = Path('css/shell.css')
if shell.exists():
    sc = shell.read_text(encoding='utf-8')
    if 'shell-account-avatar-img' not in sc:
        sc += '''
/* Top-right account photo */
.shell-header .shell-account-avatar-img {
  display: block;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.14);
  background: #1a1f2a;
}
.shell-header .shell-account-avatar-img[hidden] { display: none !important; }
.shell-header .nav-btn-masuk:has(#nav-avatar-img:not([hidden])) {
  padding: 4px 12px 4px 5px;
  background: #11141a;
}
'''
        shell.write_text(sc, encoding='utf-8')
        print('shell.css nav img styles')
    else:
        print('shell.css already has nav img')

style = Path('css/style.css')
st = style.read_text(encoding='utf-8')
if 'shell-account-avatar-img' in st and 'width: 34px' not in st[st.find('shell-account-avatar-img'):st.find('shell-account-avatar-img')+200]:
    st = st.replace(
        '''.shell-account-avatar-img {
  width: 28px; height: 28px; border-radius: 999px; object-fit: cover;
  border: 1px solid rgba(255,255,255,0.12);
}
.shell-account-avatar-img[hidden] { display: none; }''',
        '''.shell-account-avatar-img {
  width: 34px; height: 34px; border-radius: 999px; object-fit: cover;
  border: 1px solid rgba(255,255,255,0.14);
  background: #1a1f2a;
  flex-shrink: 0;
}
.shell-account-avatar-img[hidden] { display: none !important; }''',
        1,
    )
    style.write_text(st, encoding='utf-8')
    print('style.css nav img size updated')

print('ok')
