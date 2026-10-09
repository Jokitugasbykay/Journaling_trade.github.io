import json
from pathlib import Path
import tempfile

from build_news import build


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    archive = root / 'berita.json'
    output = root / 'news'
    source = {'id': 'reuters', 'name': 'Reuters', 'url': 'https://www.reuters.com/', 'kind': 'sitemap', 'status': 'ok'}
    second = {**source, 'id': 'cnbc', 'name': 'CNBC', 'url': 'https://www.cnbc.com/'}
    rows = [{'id': f'{index % 256:02x}{index:018x}', 'source': 'reuters', 'title': f'Government releases economic update {index}', 'url': f'https://www.reuters.com/world/story-{index}', 'publishedAt': f'2026-10-{index % 28 + 1:02}T00:00:00+00:00', 'body': ['Licensed full article'], 'contentRights': 'licensed'} for index in range(505)]
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

print('News delivery quotas, deduplication, ordering, ID validation, article rights and archive preservation passed')
