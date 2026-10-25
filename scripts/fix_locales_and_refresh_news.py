#!/usr/bin/env python3
"""Add missing i18n keys that block update-news.yml, then pipeline can refresh."""
from pathlib import Path
import json

ROOT = Path('js/locales')
NEW = {
  'profileUploadPhoto': {
    'en': 'Upload photo',
    'id': 'Unggah foto',
  },
  'profileRemovePhoto': {
    'en': 'Remove photo',
    'id': 'Hapus foto',
  },
}

en_path = ROOT / 'en.json'
en = json.loads(en_path.read_text(encoding='utf-8'))
changed = False
for key, vals in NEW.items():
  if key not in en:
    en[key] = vals['en']
    changed = True
    print('en +', key)
if changed:
  en_path.write_text(json.dumps(en, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

for path in sorted(ROOT.glob('*.json')):
  if path.name in ('en.json', 'catalog.json', 'lookup.json'):
    continue
  data = json.loads(path.read_text(encoding='utf-8'))
  code = path.stem
  local_changed = False
  for key, vals in NEW.items():
    if key not in data:
      data[key] = vals.get(code, vals['en'])
      local_changed = True
  if local_changed:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('updated', path.name)

# lookup map if used
lookup_path = ROOT / 'lookup.json'
if lookup_path.exists():
  lookup = json.loads(lookup_path.read_text(encoding='utf-8'))
  for key, vals in NEW.items():
    for phrase in vals.values():
      norm = ' '.join(phrase.split())
      if norm not in lookup:
        lookup[norm] = key
  lookup_path.write_text(json.dumps(lookup, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
  print('lookup updated')

print('ok')
