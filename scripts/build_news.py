"""Publish small news lists and archive buckets without changing the archive."""
import json
from pathlib import Path
import re

import update_news as news


ROOT = Path(__file__).resolve().parents[1]


def write_json(path, value):
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    temporary.replace(path)


def build(archive=ROOT / 'berita.json', output=ROOT / 'news'):
    data = json.loads(archive.read_text(encoding='utf-8'))
    if not isinstance(data, dict) or data.get('version') != 1 or not isinstance(data.get('items'), list) or not isinstance(data.get('sources'), list):
        raise ValueError('Invalid news archive')
    sources = {}
    for source in data['sources']:
        if not isinstance(source, dict) or not isinstance(source.get('id'), str) or not re.fullmatch(r'[a-z][a-z0-9_]{0,63}', source['id']) or source['id'] in sources:
            raise ValueError('Invalid or duplicate source ID')
        sources[source['id']] = source
    for item in data['items']:
        if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not re.fullmatch(r'[a-f0-9]{20}', item['id']) or not isinstance(item.get('source'), str) or item['source'] not in sources:
            raise ValueError('Invalid article ID or unknown source')

    output.mkdir(parents=True, exist_ok=True)
    (output / 'sources').mkdir(exist_ok=True)
    (output / 'archive').mkdir(exist_ok=True)
    metadata = {key: data.get(key) for key in ('version', 'checkedAt', 'intervalMinutes')}
    by_source = {source_id: [] for source_id in sources}
    for item in news.merge_items([], data['items']):
        by_source[item['source']].append({key: value for key, value in item.items() if key not in ('body', 'contentRights')})
    bootstrap = []
    for source_id, items in by_source.items():
        write_json(output / 'sources' / f'{source_id}.json', {**metadata, 'sources': [sources[source_id]], 'items': items[:500]})
        bootstrap.extend(items[:10])
    bootstrap.sort(key=lambda item: item.get('publishedAt') or '', reverse=True)
    write_json(output / 'index.json', {**metadata, 'sources': data['sources'], 'items': bootstrap})

    # Keep every archived ID addressable, including aliases removed from deduplicated lists.
    articles = {item['id']: item for item in data['items']}
    buckets = {f'{index:02x}': [] for index in range(256)}
    for article_id, item in articles.items():
        if item.get('contentRights') not in ('public-domain', 'licensed'):
            item = {key: value for key, value in item.items() if key not in ('body', 'contentRights')}
        buckets[article_id[:2]].append(item)
    for prefix, items in buckets.items():
        write_json(output / 'archive' / f'{prefix}.json', {'version': 1, 'checkedAt': data.get('checkedAt'), 'items': items})
    print(f"Published {len(bootstrap)} bootstrap headlines, {len(sources)} source feeds and {len(articles)} articles in 256 archive buckets; archive unchanged")


if __name__ == '__main__':
    build()
