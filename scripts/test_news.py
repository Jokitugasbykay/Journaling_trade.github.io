import datetime as dt
import update_news as news


now = dt.datetime.now(dt.timezone.utc)
source = news.SOURCES[0]
xml = f'''<rss><channel>
<item><title>Central bank releases its latest inflation figures</title><link>https://www.investing.com/news/economy/123</link><pubDate>{now.strftime('%a, %d %b %Y %H:%M:%S +0000')}</pubDate><enclosure url="https://content-media.investing.com/news/photo.jpg" type="image/jpeg"/></item>
<item><title>Central bank releases its latest inflation figures</title><link>https://www.investing.com/news/economy/123</link></item>
<item><title>Three stocks to buy now before the next market rally</title><link>https://www.investing.com/news/456</link></item>
<item><title>Foreign exchange outlook and recommended entries</title><link>https://www.investing.com/analysis/123</link></item>
<item><title>Unexpected inflation data prompts central bank statement</title><link>https://www.investing.com.evil.test/123</link></item>
</channel></rss>'''
items = news.parse(xml.encode(), source)
assert len(items) == 1
assert items[0]['publishedAt'] is not None
assert items[0]['image'] == 'https://content-media.investing.com/news/photo.jpg'
assert news.image_url('https://reuters.com.evil.test/photo.jpg') is None
assert news.image_url('https://reuters.com@evil.test/photo.jpg') is None
assert news.image_url('javascript:alert(1)') is None
metadata = news.ArticleImage()
metadata.feed('<meta property="og:image" content="https://www.aljazeera.com/news/photo.jpg">')
assert metadata.image == 'https://www.aljazeera.com/news/photo.jpg'
assert news.safe_url('javascript:alert(1)', 'reuters.com') is None
assert news.safe_url('https://reuters.com@evil.test/news', 'reuters.com') is None
assert news.date_iso('not a date') is None
assert news.clean('<b>News</b> &amp; data') == 'News & data'
assert news.clean('News \U0001f600') == 'News'
html = b'<a href="https://investasi.kontan.co.id/news/market-update"><img src="https://foto.kontan.co.id/photo.jpg" alt="Economic news from the Indonesian market"></a>'
assert news.parse(html, news.SOURCES[2])[0]['image'] == 'https://foto.kontan.co.id/photo.jpg'
kompas = next(source for source in news.SOURCES if source['id'] == 'kompas')
local_date = (now + dt.timedelta(hours=7, days=-1)).strftime('%Y/%m/%d')
local = news.parse(f'<a href="https://money.kompas.com/read/{local_date}/120000123/market-news"><img src="https://asset.kompas.com/photo.jpg" alt="Indonesia announces new economic policy today"></a>'.encode(), kompas)
assert len(local) == 1 and local[0]['category'] == 'local' and local[0]['image'] == 'https://asset.kompas.com/photo.jpg'
sitemap = f'''<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:n="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://www.reuters.com/world/news</loc><n:news><n:title>New economic data released by the government</n:title><n:publication_date>{now.isoformat()}</n:publication_date></n:news></url></urlset>'''
assert len(news.parse(sitemap.encode(), news.SOURCES[3])) == 1
assert not news.parse(sitemap.replace('/world/news', '/es/mundo/news').encode(), news.SOURCES[3])
sitemap = sitemap.replace('<n:title>', '<n:publication><n:language>es</n:language></n:publication><n:title>')
assert not news.parse(sitemap.encode(), news.SOURCES[3])
print('News parsing, deduplication, dates, signal filters and safe URLs passed')

assert news.category_for('https://www.reuters.com/legal/news', 'Court blocks new rules') == 'legal'
assert news.category_for('https://www.cnbc.com/news', 'Bitcoin and gold rise as bond yields fall') == 'markets'
assert news.category_for('https://www.reuters.com/technology/news', 'Chipmakers launch new products') == 'technology'
assert news.category_for('https://www.reuters.com/investigations/news', 'Special report on corporate data') == 'investigations'
fnc = next(source for source in news.SOURCES if source['id'] == 'fnc')
import json
items = news.parse(json.dumps({'items':[{'id':'1','title':'Government publishes new inflation data','pub':now.isoformat()}, {'id':'2','title':'Central bank publishes its interest rate decision','pub':now.isoformat()}]}).encode(), fnc)
assert len(items) == 2 and items[0]['id'] != items[1]['id']

import update_bi as bi
data = '<p>Update Terakhir 7 Oktober 2026</p><table><tr><td>USD</td><td>1</td><td>17.999,55</td><td>17.820,45</td></tr></table>'
fx = bi.parse(data.encode(), 'fx')
assert fx['sell'] == 17999.55 and fx['buy'] == 17820.45 and fx['mid'] == 17910
data = '<table><tr><td>1</td><td>23 September 2026</td><td>5.75 %</td></tr><tr><td>2</td><td>19 Agustus 2026</td><td>5.50 %</td></tr></table>'
assert bi.parse(data.encode(), 'rate') == {'date':'2026-09-23', 'percent':5.75}
try:
    bi.parse(b'<table><tr><td>USD</td><td>1</td><td>10,00</td><td>20,00</td></tr></table>', 'fx')
    raise AssertionError('Inverted buy/sell rates accepted')
except ValueError:
    pass
print('News categories, FNC and BI number/date parsing passed')

# Global stories stay global even when an Indonesian publisher reports them.
for title, category in [
    ('Trump Beri Penghargaan Para Bos Perusahaan Teknologi, Ada Elon Musk hingga Jensen Huang', 'technology'),
    ('Inflasi Masih Tinggi, The Fed Beri Sinyal Naikkan Suku Bunga Lagi', 'markets'),
    ('Wall Street Tertekan, Yield US Treasury 10 Tahun Tembus Level Tertinggi sejak 2002', 'markets'),
    ('Rupiah Defensif, Tekanan The Fed dan Harga Minyak Jadi Beban', 'local'),
    ('Hitungan Buruh Minta Upah Minimum 2027 Naik 9,5%', 'local'),
]:
    assert news.category_for('https://money.kompas.com/read/2026/10/08/news', title) == category, title
assert news.SIGNALS.search('IHSG Masih Diuji, Analis Ungkap Level Support dan Resistance Hari Ini')
assert not news.SIGNALS.search('The Fed signals a possible interest rate hike')
print('Local topic classification and technical trade recommendation exclusions passed')

assert news.topics_for('Trump announces new tariffs') == ['politics']
assert news.topics_for('Rupiah tertekan keputusan The Fed') == ['fed']
assert news.topics_for('Federal Reserve FOMC interest rate decision') == ['fed']
assert news.topics_for('Government responds to Powell and The Fed') == ['fed', 'politics']
assert news.topics_for('Gold prices rise today') == []
print('Politics and Fed topic filters passed')

old = [{'id':str(n), 'source':'reuters', 'url':f'https://www.reuters.com/world/archive-{n}/',
        'title':f'Archived Reuters headline number {n}', 'publishedAt':'2026-09-01T00:00:00+00:00',
        'image':'https://www.reuters.com/photo.jpg'} for n in range(450)]
latest = {'id':'new', 'source':'reuters', 'url':'https://www.reuters.com/world/latest/',
          'title':'Reuters publishes the latest economic figures', 'publishedAt':now.isoformat()}
updated = {**old[0], 'title':'Reuters updates the archived headline', 'image':None, 'publishedAt':None}
archive = news.merge_items(old, [latest, updated])
assert len(archive) == 451 and archive[0]['id'] == 'new'
restored = next(item for item in archive if item['id'] == '0')
assert restored['title'] == updated['title'] and restored['image'] == old[0]['image']
assert restored['publishedAt'] == old[0]['publishedAt']
assert len(news.merge_items(archive, [])) == 451
assert len(news.merge_items(archive, [latest])) == 451
fnc_rows = [{**latest, 'source':'fnc', 'id':str(n), 'url':'https://tradewithfnc.com/'} for n in (1,2)]
assert len(news.merge_items([], fnc_rows)) == 2
print('News archive survives successful/failed refreshes, duplicates and the former 400-story limit')

story = {**latest, 'source':'kompas', 'url':f'https://money.kompas.com/read/{local_date}/063340926/original-title', 'image':old[0]['image']}
revision = {**story, 'id':'revision', 'title':'Updated technology headline from the same publisher',
            'url':story['url'].replace('original-title', 'updated-title'), 'image':None}
merged = news.merge_items([story], [revision])
assert len(merged) == 1 and merged[0]['title'] == revision['title'] and merged[0]['image'] == story['image']
tracked = {**latest, 'url':latest['url'] + '?utm_source=homepage&source=home_headline'}
assert len(news.merge_items([latest], [tracked])) == 1
republished = {**latest, 'id':'alternate', 'url':'https://www.reuters.com/business/alternate/', 'title':'  ' + latest['title'].upper() + '  '}
assert len(news.merge_items([latest], [republished])) == 1
assert len(news.merge_items([latest], [{**republished, 'publishedAt':'2026-09-01T00:00:00+00:00'}])) == 2
assert len(news.merge_items([latest], [{**latest, 'source':'cnbc', 'url':'https://www.cnbc.com/news/article.html'}])) == 2
assert len(news.merge_items([], [{**latest, 'url':latest['url']+'?id=1'}, {**latest, 'url':latest['url']+'?id=2', 'title':'Another distinct economic story from Reuters'}])) == 2
html = f'<a href="{story["url"]}">{story["title"]}</a><a href="{revision["url"]}">{revision["title"]}</a>'
assert len(news.parse(html.encode(), kompas)) == 1
print('Article IDs, tracking URLs and same-publisher headlines deduplicate without merging different days or publishers')

publishers = {source['id']:source for source in news.SOURCES}
assert {'ap','bbc','afp','wsj','guardian','ft','dw'} <= publishers.keys()
bbc = publishers['bbc']
assert news.safe_url('https://www.bbc.co.uk/news/articles/example', bbc['domains'])
assert not news.safe_url('https://bbc.co.uk.evil.test/news', bbc['domains'])
assert not news.safe_url('https://bbc.com@evil.test/news', bbc['domains'])
rss = f'''<rss><channel><item><title>A champion announces retirement from professional tennis</title>
<link>https://www.bbc.co.uk/sport/tennis/articles/example?at_campaign=rss</link>
<pubDate>{now.isoformat()}</pubDate><category>Sports</category>
<enclosure url="https://ichef.bbci.co.uk/photo.jpg"/></item></channel></rss>'''.encode()
row = news.parse(rss, bbc)[0]
assert row['category'] == 'sport' and row['image'] == 'https://ichef.bbci.co.uk/photo.jpg'
politics = news.parse(rss, {**bbc, 'category':'politics'})[0]
assert politics['category'] == 'politics' and 'politics' in politics['topics']
from unittest.mock import patch
with patch.object(news, 'collect_feed', side_effect=[({'status':'unavailable'}, []), ({'status':'ok', 'checkedAt':now.isoformat()}, [row])]):
    state, rows = news.collect({**bbc, 'feeds':bbc['feeds'][:2]})
    assert state['id'] == 'bbc' and state['status'] == 'ok' and len(rows) == 1
assert news.collect(publishers['afp'])[0]['status'] == 'external'

ap = publishers['ap']
link = 'https://apnews.com/article/tennis-champion-' + 'a' * 32
stamp = int(now.timestamp() * 1000)
ap_html = f'''<a href="{link}">Misleading navigation teaser for this article</a>
<div class="PagePromo" data-posted-date-timestamp="{stamp}">
<a href="{link}"><img src="https://dims.apnews.com/photo.jpg" alt="Photo caption must not become the headline"></a>
<h3 class="PagePromo-title"><a href="{link}">Tennis champion wins the tournament final</a></h3></div>
<div class="PagePromo"><h3 class="PagePromo-title"><a href="{link.replace('a'*32,'b'*32)}">Another champion reaches a tournament final</a></h3></div>'''
ap_rows = news.parse(ap_html.encode(), {**ap,'category':'sport'})
assert len(ap_rows) == 2
assert ap_rows[0]['title'] == 'Tennis champion wins the tournament final'
assert ap_rows[0]['image'] == 'https://dims.apnews.com/photo.jpg' and ap_rows[0]['publishedAt']
assert ap_rows[1]['image'] is None and ap_rows[1]['publishedAt'] is None
assert all(row['category'] == 'sport' for row in ap_rows)
assert len(news.merge_items([ap_rows[0]], [{**ap_rows[0], 'title':'Updated headline for the same AP article', 'url':link.replace('tennis-champion-', 'updated-title-')}])) == 1
print('New publishers: official domains, RSS taxonomy, AP headline/date/photo isolation and partial feed failures passed')

regional = [row for row in news.SOURCES if row.get('country') in ('NO','DK','FI','CZ','RO','HU','IE','AT')]
assert len(regional) == 64 and len({row['id'] for row in regional}) == 64
assert all(sum(row['country'] == code for row in regional) == 8 for code in ('NO','DK','FI','CZ','RO','HU','IE','AT'))
orf = next(row for row in regional if row['id'] == 'at_orf')
rdf = f'''<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<item><title>Austrian central bank publishes economic growth figures</title><link>https://orf.at/stories/12345/</link><dc:date>{now.isoformat()}</dc:date></item></rdf:RDF>'''.encode()
assert len(news.parse(rdf, orf)) == 1 and news.parse(rdf, orf)[0]['publishedAt'] == now.isoformat()
print('Regional registry and ORF namespaced RSS checks passed')
assert len({row['id'] for row in news.SOURCES}) == len(news.SOURCES), 'Shared publishers duplicated in feeds'
for code in ('ID','US','GB','MY','SG','DEFAULT','global_founder'):
    assert len(news.REGIONAL_NEWS_SOURCES[code]) == (9 if code in ('ID','SG') else 8)

for code in ("CA","MX","AR","CO","CL","PE","AU","NZ","CR","UY"):
    assert len(news.REGIONAL_NEWS_SOURCES[code]) == (9 if code in ('ID','SG') else 8)
    assert all(row["id"].startswith(code.lower()+"_") for row in news.REGIONAL_NEWS_SOURCES[code])
print("Americas and Oceania: all 80 official portal mappings passed")

assert len(news.REGIONAL_NEWS_SOURCES["GLOBAL"]) == 16
assert len({row["id"] for row in news.REGIONAL_NEWS_SOURCES["GLOBAL"]}) == 16
assert {row["region"] for row in news.REGIONAL_NEWS_SOURCES["GLOBAL"]} == {"Global/US","Global/UK"}
assert "us_pbs" in {row["id"] for row in news.SOURCES}
print("Global publisher list and shared-source deduplication passed")

for code in ("DE","FR","IT","ES","NL","CH","SE","PL","UA"):
    assert len(news.REGIONAL_NEWS_SOURCES[code]) == (9 if code in ('ID','SG') else 8)
print("Nine new European regions: 72 portal entries and unique collector IDs passed")

for code in ("QA","JO","LB","IQ","KW","OM","BH","IL","IN","CN","PK","BD","TW","SA","AE","TR","IR","LK","ZA","NG","KE","EG","MA","GH","ET","DZ","UG","TZ","TH","PH","VN","JP","KR"):
    assert len(news.REGIONAL_NEWS_SOURCES[code]) == (10 if code == "CN" else 12 if code == "TW" else 8)
assert len(news.REGIONAL_NEWS_SOURCES["DIRECTORIES"]) == 5
assert news.REGIONAL_NEWS_SOURCES["TZ"][1]["url"] == "https://dailynews.co.tz"
assert news.REGIONAL_NEWS_SOURCES["TH"][5]["url"] == "https://www.dailynews.co.th"
print("Middle East, Asia, Africa, ASEAN, directories and corrected publisher domains passed")

atom = f'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>News from the official publisher</title><link href="https://www.investing.com/news/atom-story"/><published>{now.isoformat()}</published></entry></feed>'
assert len(news.parse(atom.encode(), source)) == 1
assert news.parse(atom.encode(), source)[0]['publishedAt'] == now.isoformat()
regional_sitemap = sitemap.replace('https://www.reuters.com', 'https://orf.at')
assert len(news.parse(regional_sitemap.encode(), {**orf, 'kind':'sitemap'})) == 1
assert news.date_iso('2026-10-08 16:24:00') is None
assert news.date_iso('2026-10-08 16:24:00', 'Asia/Colombo') == '2026-10-08T10:54:00+00:00'
many = '<rss><channel>' + ''.join(f'<item><title>Official inflation report number {i}</title><link>https://www.investing.com/news/report-{i}</link></item>' for i in range(550)) + '</channel></rss>'
assert len(news.parse(many.encode(), source)) == 500
assert len(news.merge_items([], [{**latest, 'id':str(i), 'title':f'Archived economic report number {i}', 'url':f'https://www.reuters.com/world/story-{i}/'} for i in range(550)])) == 550
print('Atom, regional-language sitemaps, explicit publisher timezone and 500-headline fetch limit passed; archives retained')

import gzip
assert len(news.parse(gzip.compress(atom.encode()), source)) == 1
try:
    news.parse(gzip.compress(b'x' * 5_000_001), source)
    raise AssertionError('Oversized decompressed feed accepted')
except ValueError:
    pass
assert len(news.parse('<rss><channel><item><title>新しい経済データを公表</title><link>https://www.investing.com/news/short-title</link></item></channel></rss>'.encode(), source)) == 1
print('Compressed-feed size limit and short multilingual publisher headlines passed')

assert news.clean("Retail\u2122 headline") == "Retail headline"
