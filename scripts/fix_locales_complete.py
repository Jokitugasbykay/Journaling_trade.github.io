#!/usr/bin/env python3
"""Add all missing avatar-related i18n keys required by audit-locales.cjs."""
from pathlib import Path
import json

ROOT = Path('js/locales')

# key -> {en, id}
ENTRIES = {
  'profileUploadPhoto': {
    'en': 'Upload photo',
    'id': 'Unggah foto',
  },
  'profileRemovePhoto': {
    'en': 'Remove photo',
    'id': 'Hapus foto',
  },
  'profileUploadSignIn': {
    'en': 'Sign in to upload a profile photo.',
    'id': 'Masuk dulu untuk mengunggah foto profil.',
  },
  'profileUploadFileType': {
    'en': 'Use a JPG, PNG, WebP, or GIF file.',
    'id': 'Gunakan file JPG, PNG, WebP, atau GIF.',
  },
  'profileUploadMaxSize': {
    'en': 'Maximum size is 2 MB.',
    'id': 'Ukuran maksimal 2 MB.',
  },
  'profileUploading': {
    'en': 'Uploading…',
    'id': 'Mengunggah…',
  },
  'profileUploadSaved': {
    'en': 'Profile photo saved.',
    'id': 'Foto profil disimpan.',
  },
  'profileUploadFailed': {
    'en': 'Upload failed: ',
    'id': 'Gagal mengunggah: ',
  },
  'profileRemoving': {
    'en': 'Removing…',
    'id': 'Menghapus…',
  },
  'profilePhotoRemoved': {
    'en': 'Photo removed.',
    'id': 'Foto dihapus.',
  },
  'profilePhotoRemoveFailed': {
    'en': 'Could not remove photo.',
    'id': 'Gagal menghapus.',
  },
}

en_path = ROOT / 'en.json'
en = json.loads(en_path.read_text(encoding='utf-8'))
for key, vals in ENTRIES.items():
  en[key] = vals['en']
en_path.write_text(json.dumps(en, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('en.json keys', len(ENTRIES))

for path in sorted(ROOT.glob('*.json')):
  if path.name in ('en.json', 'catalog.json', 'lookup.json'):
    continue
  data = json.loads(path.read_text(encoding='utf-8'))
  code = path.stem
  for key, vals in ENTRIES.items():
    data[key] = vals.get(code, vals['en'])
  path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('locales updated')

lookup_path = ROOT / 'lookup.json'
lookup = json.loads(lookup_path.read_text(encoding='utf-8'))
for key, vals in ENTRIES.items():
  for phrase in {vals['en'], vals['id']}:
    norm = ' '.join(phrase.split())
    lookup[norm] = key
lookup_path.write_text(json.dumps(lookup, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('lookup ok')

# Also map exact uiText strings used in app.js (English side is lookup key source)
for key, vals in ENTRIES.items():
  lookup[' '.join(vals['en'].split())] = key
  lookup[' '.join(vals['id'].split())] = key
lookup_path.write_text(json.dumps(lookup, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('done')
