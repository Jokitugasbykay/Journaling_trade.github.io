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
