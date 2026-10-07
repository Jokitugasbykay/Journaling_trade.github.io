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
sitemap = f'''<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:n="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://www.reuters.com/world/news</loc><n:news><n:title>New economic data released by the government</n:title><n:publication_date>{now.isoformat()}</n:publication_date></n:news></url></urlset>'''
assert len(news.parse(sitemap.encode(), news.SOURCES[3])) == 1
assert not news.parse(sitemap.replace('/world/news', '/es/mundo/news').encode(), news.SOURCES[3])
sitemap = sitemap.replace('<n:title>', '<n:publication><n:language>es</n:language></n:publication><n:title>')
assert not news.parse(sitemap.encode(), news.SOURCES[3])
print('News parsing, deduplication, dates, signal filters and safe URLs passed')
