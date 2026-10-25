#!/usr/bin/env python3
"""Add per-user profile picture upload (Supabase Storage avatars bucket)."""
from pathlib import Path
import re

# ---------- index.html: avatar upload controls ----------
idx = Path('index.html')
h = idx.read_text(encoding='utf-8')

old_avatar = '''          <div class="tpc-avatar" id="tpc-avatar">
            <span id="tpc-avatar-initials">TR</span>
            <img id="tpc-google-avatar" alt="" hidden referrerpolicy="no-referrer">
          </div>'''

new_avatar = '''          <div class="tpc-avatar" id="tpc-avatar">
            <span id="tpc-avatar-initials">TR</span>
            <img id="tpc-google-avatar" alt="" hidden referrerpolicy="no-referrer">
            <img id="tpc-user-avatar" alt="" hidden referrerpolicy="no-referrer">
            <label class="tpc-avatar-upload" for="profile-avatar-input" title="Upload photo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <span class="shell-visually-hidden" data-i18n="profileUploadPhoto">Upload photo</span>
            </label>
            <input type="file" id="profile-avatar-input" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
          </div>'''

if old_avatar in h:
    h = h.replace(old_avatar, new_avatar, 1)
    print('index.html avatar controls added')
elif 'profile-avatar-input' in h:
    print('index.html already has avatar input')
else:
    raise SystemExit('avatar markup not found')

# Add remove photo + status near google manage link
if 'profile-avatar-actions' not in h:
    h = h.replace(
        '''            <a id="profile-google-manage" class="btn btn-ghost btn-sm" href="https://myaccount.google.com/personal-info" target="_blank" rel="noopener noreferrer" hidden data-i18n="profileGoogleManage">Manage Google photo</a>''',
        '''            <a id="profile-google-manage" class="btn btn-ghost btn-sm" href="https://myaccount.google.com/personal-info" target="_blank" rel="noopener noreferrer" hidden data-i18n="profileGoogleManage">Manage Google photo</a>
            <div class="profile-avatar-actions" id="profile-avatar-actions">
              <button type="button" class="btn btn-ghost btn-sm" id="profile-avatar-upload-btn" data-i18n="profileUploadPhoto">Upload photo</button>
              <button type="button" class="btn btn-ghost btn-sm" id="profile-avatar-remove-btn" hidden data-i18n="profileRemovePhoto">Remove photo</button>
              <span class="calc-desc" id="profile-avatar-status" aria-live="polite"></span>
            </div>''',
        1,
    )
    print('index.html avatar action buttons added')

# nav avatar img
if 'nav-avatar-img' not in h:
    h = h.replace(
        '<span class="shell-account-avatar" id="nav-avatar-initials" hidden aria-hidden="true"></span>',
        '<span class="shell-account-avatar" id="nav-avatar-initials" hidden aria-hidden="true"></span>\n'
        '            <img class="shell-account-avatar-img" id="nav-avatar-img" alt="" hidden referrerpolicy="no-referrer">',
        1,
    )
    print('index.html nav avatar img added')

idx.write_text(h, encoding='utf-8')

# Also stubs
for path in list(Path('.').rglob('index.html')) + [Path('404.html')]:
    if not path.exists() or path.as_posix() == 'index.html' or 'node_modules' in path.parts:
        continue
    t = path.read_text(encoding='utf-8')
    if 'profile-avatar-input' in t:
        continue
    if old_avatar in t:
        t = t.replace(old_avatar, new_avatar, 1)
        path.write_text(t, encoding='utf-8')
        print('stub', path)

# ---------- CSS ----------
style = Path('css/style.css')
s = style.read_text(encoding='utf-8')
CSS = '''
/* Profile avatar upload */
.tpc-avatar { position: relative; overflow: hidden; }
.tpc-avatar #tpc-user-avatar {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit;
}
.tpc-avatar #tpc-user-avatar[hidden] { display: none; }
.tpc-avatar-upload {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.45); color: #fff; opacity: 0; cursor: pointer;
  transition: opacity 0.15s ease; border-radius: inherit; z-index: 2;
}
.tpc-avatar:hover .tpc-avatar-upload,
.tpc-avatar:focus-within .tpc-avatar-upload { opacity: 1; }
.profile-avatar-actions {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px;
}
.shell-account-avatar-img {
  width: 28px; height: 28px; border-radius: 999px; object-fit: cover;
  border: 1px solid rgba(255,255,255,0.12);
}
.shell-account-avatar-img[hidden] { display: none; }
'''
if 'Profile avatar upload' not in s:
    s = s.rstrip() + '\n' + CSS + '\n'
    style.write_text(s, encoding='utf-8')
    print('style.css avatar styles added')
else:
    print('style.css already has avatar styles')

# ---------- app.js ----------
app = Path('js/app.js')
a = app.read_text(encoding='utf-8')

# Expand profile select to include avatar_url
a = a.replace(
    "cloudClient.from('profiles').select('display_name,nickname_set').eq('id', user.id).maybeSingle()",
    "cloudClient.from('profiles').select('display_name,nickname_set,avatar_url').eq('id', user.id).maybeSingle()",
)
a = a.replace(
    "cloudClient.from('profiles').select('display_name,nickname_set').eq('id', userId).maybeSingle()",
    "cloudClient.from('profiles').select('display_name,nickname_set,avatar_url').eq('id', userId).maybeSingle()",
)
print('app.js profile select includes avatar_url')

# After profile load, store avatar
if "profile.avatarUrl" not in a:
    # common pattern after profile data
    a = a.replace(
        "nicknameReady = !!(data?.nickname_set && data.display_name?.trim());",
        "nicknameReady = !!(data?.nickname_set && data.display_name?.trim());\n"
        "            if (data?.avatar_url) profile.avatarUrl = data.avatar_url;\n"
        "            else if (profile.avatarUrl && !data?.avatar_url) { /* keep local until sync */ }\n"
        "            else profile.avatarUrl = data?.avatar_url || profile.avatarUrl || '';",
    )
    # softer: inject helper functions before googleAccountProfile
    pass

HELPER = r'''
      function profileAvatarUrl() {
        return (profile && profile.avatarUrl) || '';
      }

      function setProfileAvatarDisplay(url) {
        const userImg = $('tpc-user-avatar');
        const googleImg = $('tpc-google-avatar');
        const navImg = $('nav-avatar-img');
        const navInit = $('nav-avatar-initials');
        const removeBtn = $('profile-avatar-remove-btn');
        const has = !!(url && String(url).trim());
        if (userImg) {
          userImg.hidden = !has;
          if (has) {
            userImg.onerror = () => { userImg.hidden = true; };
            if (userImg.src !== url) userImg.src = url;
          } else {
            userImg.removeAttribute('src');
          }
        }
        // Prefer custom avatar over Google photo
        if (googleImg && has) googleImg.hidden = true;
        if (navImg) {
          navImg.hidden = !has;
          if (has) {
            navImg.onerror = () => { navImg.hidden = true; if (navInit) navInit.hidden = false; };
            if (navImg.src !== url) navImg.src = url;
            if (navInit) navInit.hidden = true;
          } else {
            navImg.removeAttribute('src');
          }
        }
        if (removeBtn) removeBtn.hidden = !has || !cloudUser;
      }

      async function uploadProfileAvatarFile(file) {
        const status = $('profile-avatar-status');
        const setStatus = (msg) => { if (status) status.textContent = msg || ''; };
        if (!cloudUser || !cloudClient || !cloudReady) {
          setStatus(uiText('Masuk dulu untuk mengunggah foto profil.', 'Sign in to upload a profile photo.'));
          return;
        }
        if (!file || !file.type || !/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
          setStatus(uiText('Gunakan file JPG, PNG, WebP, atau GIF.', 'Use a JPG, PNG, WebP, or GIF file.'));
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          setStatus(uiText('Ukuran maksimal 2 MB.', 'Maximum size is 2 MB.'));
          return;
        }
        setStatus(uiText('Mengunggah…', 'Uploading…'));
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/gif' ? 'gif' : 'jpg';
        const path = cloudUser.id + '/avatar.' + ext;
        try {
          const { error: upErr } = await cloudClient.storage.from('avatars').upload(path, file, {
            upsert: true,
            contentType: file.type,
            cacheControl: '3600'
          });
          if (upErr) throw upErr;
          const { data: pub } = cloudClient.storage.from('avatars').getPublicUrl(path);
          const url = (pub && pub.publicUrl ? pub.publicUrl : '') + '?v=' + Date.now();
          const { error: dbErr } = await cloudClient.from('profiles').upsert(
            { id: cloudUser.id, avatar_url: url, updated_at: new Date().toISOString() },
            { onConflict: 'id' }
          );
          if (dbErr) throw dbErr;
          profile.avatarUrl = url;
          try { localStorage.setItem('fncjt_avatar_' + cloudUser.id, url); } catch (_) {}
          setProfileAvatarDisplay(url);
          setStatus(uiText('Foto profil disimpan.', 'Profile photo saved.'));
          if (typeof updateAccess === 'function') updateAccess();
        } catch (err) {
          console.error(err);
          setStatus(uiText('Gagal mengunggah: ', 'Upload failed: ') + (err.message || err.error_description || String(err)));
        }
      }

      window.removeProfileAvatar = async function () {
        const status = $('profile-avatar-status');
        if (!cloudUser || !cloudClient) return;
        if (status) status.textContent = uiText('Menghapus…', 'Removing…');
        try {
          await cloudClient.storage.from('avatars').remove([
            cloudUser.id + '/avatar.jpg',
            cloudUser.id + '/avatar.png',
            cloudUser.id + '/avatar.webp',
            cloudUser.id + '/avatar.gif'
          ]);
          await cloudClient.from('profiles').upsert(
            { id: cloudUser.id, avatar_url: null, updated_at: new Date().toISOString() },
            { onConflict: 'id' }
          );
          profile.avatarUrl = '';
          try { localStorage.removeItem('fncjt_avatar_' + cloudUser.id); } catch (_) {}
          setProfileAvatarDisplay('');
          if (status) status.textContent = uiText('Foto dihapus.', 'Photo removed.');
          if (typeof updateAccess === 'function') updateAccess();
          if (typeof renderProfileView === 'function') renderProfileView();
        } catch (err) {
          if (status) status.textContent = uiText('Gagal menghapus.', 'Could not remove photo.');
        }
      };

      window.initProfileAvatarControls = function () {
        const input = $('profile-avatar-input');
        const btn = $('profile-avatar-upload-btn');
        const removeBtn = $('profile-avatar-remove-btn');
        if (input && !input.dataset.bound) {
          input.dataset.bound = '1';
          input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            input.value = '';
            if (file) uploadProfileAvatarFile(file);
          });
        }
        if (btn && !btn.dataset.bound) {
          btn.dataset.bound = '1';
          btn.addEventListener('click', () => input && input.click());
        }
        if (removeBtn && !removeBtn.dataset.bound) {
          removeBtn.dataset.bound = '1';
          removeBtn.addEventListener('click', () => window.removeProfileAvatar());
        }
      };

'''

if 'uploadProfileAvatarFile' not in a:
    marker = '      function googleAccountProfile() {'
    if marker not in a:
        raise SystemExit('googleAccountProfile marker missing')
    a = a.replace(marker, HELPER + marker, 1)
    print('app.js avatar helpers injected')
else:
    print('app.js helpers already present')

# Wire renderProfileView to show avatar
old_render_avatar = '''        const avatar = $('tpc-google-avatar');
        if (avatar) { avatar.hidden = !google?.avatar; avatar.onerror = () => { avatar.hidden = true; }; if (google?.avatar && avatar.src !== google.avatar) avatar.src = google.avatar; if (!google?.avatar) avatar.removeAttribute('src'); }
        if ($('tpc-avatar-initials')) {
'''

# Find actual snippet more carefully via regex
if 'setProfileAvatarDisplay' in a and 'renderProfileView' in a:
    # inject call near end of google avatar block
    if 'setProfileAvatarDisplay(profileAvatarUrl())' not in a:
        a2, n = re.subn(
            r"(if \(\$\('tpc-avatar-initials'\)\) \{)",
            r"        initProfileAvatarControls();\n"
            r"        // Custom uploaded avatar wins over Google photo\n"
            r"        let customAvatar = profileAvatarUrl();\n"
            r"        if (!customAvatar && cloudUser) {\n"
            r"          try { customAvatar = localStorage.getItem('fncjt_avatar_' + cloudUser.id) || ''; profile.avatarUrl = customAvatar || profile.avatarUrl || ''; } catch (_) {}\n"
            r"        }\n"
            r"        setProfileAvatarDisplay(customAvatar);\n"
            r"        \1",
            a,
            count=1,
        )
        if n:
            a = a2
            print('app.js renderProfileView wired')
        else:
            print('WARN renderProfileView wire failed')

# When profile data loads, set avatarUrl
if "data?.avatar_url" not in a:
    a2, n = re.subn(
        r"(profile\.name = data\.display_name)",
        r"if (data.avatar_url) profile.avatarUrl = data.avatar_url;\n            \1",
        a,
        count=2,
    )
    if n:
        a = a2
        print('app.js set avatar from profile load', n)

# Ensure profile object can hold avatarUrl - look for profile = {
if re.search(r"let profile = \{[^}]*\}", a):
    a = re.sub(
        r"let profile = \{([^}]*)\}",
        lambda m: ('let profile = {' + m.group(1) + (' avatarUrl: \'\',' if 'avatarUrl' not in m.group(1) else '') + '}').replace(',,', ','),
        a,
        count=1,
    )
    print('app.js profile.avatarUrl field ensured')

app.write_text(a, encoding='utf-8')
print('ok')
