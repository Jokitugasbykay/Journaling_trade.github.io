import json
from pathlib import Path
import tempfile

from build_news import CATEGORIES, build


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    archive = root / 'berita.json'
    output = root / 'news'
    source = {'id': 'reuters', 'name': 'Reuters', 'url': 'https://www.reuters.com/', 'kind': 'sitemap', 'status': 'ok'}
    second = {**source, 'id': 'cnbc', 'name': 'CNBC', 'url': 'https://www.cnbc.com/'}
    rows = [{'id': f'{index % 256:02x}{index:018x}', 'source': 'reuters', 'title': f'Government releases economic update {index}', 'url': f'https://www.reuters.com/world/story-{index}', 'publishedAt': f'2026-10-{index % 28 + 1:02}T00:00:00+00:00', 'body': ['Licensed full article'], 'contentRights': 'licensed'} for index in range(505)]
    for row in rows:
        row['category'] = 'business'
    rows[0]['category'] = 'technology'
    rows[1]['title'] = 'The Fed releases its official economic outlook'
    rows.extend([{**rows[0]}, {**rows[1], 'id': f'{999:020x}'}, {**rows[2], 'id': f'{1000:020x}', 'contentRights': 'unknown'}, {**rows[3], 'id': f'{1001:020x}', 'contentRights': 'public-domain'}])
    rows.extend({**rows[index], 'id': f'ff{index + 9999:018x}', 'source': 'cnbc', 'url': f'https://www.cnbc.com/story-{index}'} for index in range(11))
    data = {'version': 1, 'checkedAt': '2026-10-09T00:00:00+00:00', 'intervalMinutes': 5, 'sources': [source, second], 'items': rows}
    archive.write_text(json.dumps(data), encoding='utf-8')
    original = archive.read_bytes()
    build(archive, output)
    index = read(output / 'index.json')
    feed = read(output / 'sources/reuters.json')
    assert len(index['items']) == 20 and len(feed['items']) == 500
    assert all(sum(row['source'] == source_id for row in index['items']) == 10 for source_id in ('reuters', 'cnbc'))
    assert index['version'] == 1 and index['checkedAt'] == data['checkedAt'] and index['intervalMinutes'] == 5 and index['sources'] == [source, second]
    assert len({row['url'] for row in feed['items']}) == 500
    assert [row['publishedAt'] for row in feed['items']] == sorted([row['publishedAt'] for row in feed['items']], reverse=True)
    assert all('body' not in row and 'contentRights' not in row for row in [*index['items'], *feed['items']])
    category_feeds = {category: read(output / 'categories' / f'{category}.json') for category in CATEGORIES}
    assert len(list((output / 'categories').glob('*.json'))) == 15
    assert all(value['sources'] == data['sources'] and value['checkedAt'] == data['checkedAt'] for value in category_feeds.values())
    assert all('body' not in row and 'contentRights' not in row for value in category_feeds.values() for row in value['items'])
    assert rows[0]['id'] not in {row['id'] for row in index['items']} and rows[1]['id'] not in {row['id'] for row in index['items']}
    assert rows[0]['id'] in {row['id'] for row in category_feeds['technology']['items']}
    assert rows[1]['id'] in {row['id'] for row in category_feeds['fed']['items']}
    assert sum(row['source'] == 'reuters' for row in category_feeds['business']['items']) == 500
    assert sum(row['source'] == 'reuters' for row in category_feeds['all']['items']) == 500
    assert sum(row['source'] == 'cnbc' for row in category_feeds['all']['items']) == 11
    assert all(sum(row['source'] == source_id for row in value['items']) <= 500 for value in category_feeds.values() for source_id in ('reuters', 'cnbc'))
    assert all([row['publishedAt'] for row in value['items']] == sorted([row['publishedAt'] for row in value['items']], reverse=True) for value in category_feeds.values())
    archived = [row for file in (output / 'archive').glob('*.json') for row in read(file)['items']]
    assert len(archived) == 519 and len(list((output / 'archive').glob('*.json'))) == 256
    assert next(row for row in archived if row['id'] == rows[0]['id'])['body'] == ['Licensed full article']
    assert any(row['id'] == f'{999:020x}' for row in archived)
    assert 'body' not in next(row for row in archived if row['id'] == f'{1000:020x}')
    assert next(row for row in archived if row['id'] == f'{1001:020x}')['body'] == ['Licensed full article']
    assert all(row['id'][:2] == file.stem for file in (output / 'archive').glob('*.json') for row in read(file)['items'])
    assert not (output / 'articles').exists()
    assert archive.read_bytes() == original
    for invalid in ({**source, 'id': '../reuters'}, {**source, 'id': 'reuters/other'}):
        archive.write_text(json.dumps({**data, 'sources': [invalid]}), encoding='utf-8')
        try:
            build(archive, root / 'invalid')
            raise AssertionError('Unsafe source ID accepted')
        except ValueError:
            assert not (root / 'invalid').exists()
    for invalid in ({**rows[0], 'id': '../../outside'}, {**rows[0], 'source': 'unknown'}, {**rows[0], 'source': {}}):
        archive.write_text(json.dumps({**data, 'items': [invalid]}), encoding='utf-8')
        try:
            build(archive, root / 'invalid')
            raise AssertionError('Unsafe article accepted')
        except ValueError:
            assert not (root / 'invalid').exists()

print('News delivery quotas, full category/Fed coverage, deduplication, ordering, ID validation, article rights and archive preservation passed')
