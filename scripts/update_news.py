"""Collect public publisher headlines for GitHub Pages. Python standard library only."""
import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    {"id": "investing", "name": "Investing.com", "url": "https://www.investing.com/", "feed": "https://www.investing.com/rss/news.rss", "kind": "rss", "domain": "investing.com"},
    {"id": "cnbc", "name": "CNBC", "url": "https://www.cnbc.com/markets/", "feed": "https://www.cnbc.com/id/100003114/device/rss/rss.html", "kind": "rss", "domain": "cnbc.com"},
    {"id": "kontan", "name": "Kontan", "url": "https://www.kontan.co.id/", "feed": "https://www.kontan.co.id/", "kind": "html", "domain": "kontan.co.id", "article_pattern": r"/news/"},
    {"id": "reuters", "name": "Reuters", "url": "https://www.reuters.com/", "feed": "https://www.reuters.com/arc/outboundfeeds/news-sitemap/?outputType=xml", "kind": "sitemap", "domain": "reuters.com"},
    {"id": "aljazeera", "name": "Al Jazeera", "url": "https://www.aljazeera.com/", "feed": "https://www.aljazeera.com/xml/rss/all.xml", "kind": "rss", "domain": "aljazeera.com"},
    {"id": "bloomberg", "name": "Bloomberg", "url": "https://www.bloomberg.com/asia", "feed": "https://feeds.bloomberg.com/markets/news.rss", "kind": "rss", "domain": "bloomberg.com"},
    {'id': 'fnc', 'name': 'Trade With FNC', 'url': 'https://tradewithfnc.com/', 'feed': 'https://tradewithfnc.com/berita.json', 'kind': 'json', 'domain': 'tradewithfnc.com'},
    {"id": "investing_id", "name": "Investing Indonesia", "url": "https://id.investing.com/news", "feed": "https://id.investing.com/rss/news.rss", "kind": "rss", "domain": "investing.com"},
    {"id": "pluang", "name": "Pluang", "url": "https://pluang.com/news-feed", "feed": "https://pluang.com/news-feed", "kind": "html", "domain": "pluang.com", "article_pattern": r"/news-feed/"},
    {"id": "kompas", "name": "Kompas Money", "url": "https://money.kompas.com/", "feed": "https://money.kompas.com/", "kind": "html", "domain": "kompas.com", "article_pattern": r"/read/\d{4}/\d{2}/\d{2}/"},
    {"id": "detik", "name": "detikFinance", "url": "https://finance.detik.com/", "feed": "https://finance.detik.com/rss", "kind": "rss", "domain": "detik.com"},
    {"id": "kemenkeu", "name": "Kementerian Keuangan", "url": "https://www.kemenkeu.go.id/informasi-publik/publikasi/berita-utama", "feed": "https://www.kemenkeu.go.id/informasi-publik/publikasi/berita-utama", "kind": "html", "domain": "kemenkeu.go.id", "article_pattern": r"/informasi-publik/publikasi/berita-utama/"},
    {"id": "cnn_id", "name": "CNN Indonesia Ekonomi", "url": "https://www.cnnindonesia.com/ekonomi", "feed": "https://www.cnnindonesia.com/ekonomi/rss", "kind": "rss", "domain": "cnnindonesia.com"},
    {"id": "bisnis", "name": "Bisnis Ekonomi", "url": "https://ekonomi.bisnis.com/", "feed": "https://ekonomi.bisnis.com/", "kind": "html", "domain": "bisnis.com", "article_pattern": r"/read/\d{8}/"},
    {"id": "sindo", "name": "SINDOnews Ekbis", "url": "https://ekbis.sindonews.com/", "feed": "https://ekbis.sindonews.com/rss", "kind": "rss", "domain": "sindonews.com"},
    {'id':'ap', 'name':'Associated Press', 'url':'https://apnews.com/', 'kind':'html', 'domain':'apnews.com', 'article_pattern':r'/article/[^/]+-[a-f0-9]{32}$', 'feeds':[
        {'url':'https://apnews.com/'}, {'url':'https://apnews.com/sports', 'category':'sport'},
        {'url':'https://apnews.com/business', 'category':'business'}, {'url':'https://apnews.com/politics', 'category':'politics'}]},
    {'id':'bbc', 'name':'BBC News', 'url':'https://www.bbc.com/news', 'kind':'rss', 'domain':'bbc.com', 'domains':('bbc.com','bbc.co.uk'), 'feeds':[
        {'url':'https://feeds.bbci.co.uk/news/rss.xml'}, {'url':'https://feeds.bbci.co.uk/news/business/rss.xml', 'category':'business'},
        {'url':'https://feeds.bbci.co.uk/news/politics/rss.xml', 'category':'politics'}, {'url':'https://feeds.bbci.co.uk/sport/rss.xml', 'category':'sport'}]},
    {'id':'afp', 'name':'AFP', 'url':'https://www.afp.com/en', 'kind':'external', 'domain':'afp.com'},
    {'id':'wsj', 'name':'The Wall Street Journal', 'url':'https://www.wsj.com/', 'kind':'rss', 'domain':'wsj.com', 'feeds':[
        {'url':'https://feeds.content.dowjones.io/public/rss/RSSWorldNews', 'category':'world'},
        {'url':'https://feeds.content.dowjones.io/public/rss/WSJcomUSBusiness', 'category':'business'},
        {'url':'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain', 'category':'markets'},
        {'url':'https://feeds.content.dowjones.io/public/rss/socialpoliticsfeed', 'category':'politics'},
        {'url':'https://feeds.content.dowjones.io/public/rss/rsssportsfeed', 'category':'sport'}]},
    {'id':'guardian', 'name':'The Guardian', 'url':'https://www.theguardian.com/', 'kind':'rss', 'domain':'theguardian.com', 'feeds':[
        {'url':'https://www.theguardian.com/international/rss'}, {'url':'https://www.theguardian.com/business/rss', 'category':'business'},
        {'url':'https://www.theguardian.com/politics/rss', 'category':'politics'}, {'url':'https://www.theguardian.com/sport/rss', 'category':'sport'}]},
    {'id':'ft', 'name':'Financial Times', 'url':'https://www.ft.com/', 'kind':'rss', 'domain':'ft.com', 'feeds':[
        {'url':'https://www.ft.com/rss/home'}, {'url':'https://www.ft.com/markets?format=rss', 'category':'markets'},
        {'url':'https://www.ft.com/world?format=rss', 'category':'world'}]},
    {'id':'dw', 'name':'Deutsche Welle', 'url':'https://www.dw.com/en/top-stories/s-9097', 'kind':'rss', 'domain':'dw.com', 'feeds':[
        {'url':'https://rss.dw.com/xml/rss-en-all'}, {'url':'https://rss.dw.com/xml/rss-en-world', 'category':'world'},
        {'url':'https://rss.dw.com/xml/rss-en-bus', 'category':'business'}, {'url':'https://rss.dw.com/xml/rss-en-sports', 'category':'sport'},
        {'url':'https://rss.dw.com/xml/rss_en_science', 'category':'science'}, {'url':'https://rss.dw.com/xml/rss_en_environment', 'category':'sustainability'}]},
    {"id": "fedwatch", "name": "CME FedWatch", "url": "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html", "kind": "tool", "domain": "cmegroup.com"},
    {"id": "cme", "name": "CME Markets", "url": "https://www.cmegroup.com/markets.html?redirect=/markets/", "kind": "tool", "domain": "cmegroup.com"},
]
REGIONAL_NEWS_SOURCES = json.loads((ROOT / 'regional-sources.json').read_text(encoding='utf-8'))
for country, portals in REGIONAL_NEWS_SOURCES.items():
    for portal in portals:
        if any(source['id'] == portal['id'] for source in SOURCES):
            continue
        domain = urllib.parse.urlsplit(portal['url']).hostname.removeprefix('www.')
        SOURCES.append({**portal, 'country': country, 'domain': domain, 'kind': 'rss' if portal.get('feed') else 'external'})
SIGNALS = re.compile(r"\b(?:buy on (?:dip|pullback)|sell on (?:rally|bounce)|stocks? to buy|stock picks?|trading signals?|price targets?|target harga|sinyal trading|rekomendasi (?:beli|jual)|buy now|sell now|support (?:dan |and )?resistance|rekomendasi saham)\b", re.I)
IMAGE_DOMAINS = ('investing.com', 'cnbcfm.com', 'kontan.co.id', 'reuters.com', 'aljazeera.com', 'bloomberg.com', 'bwbx.io', 'pluang.com', 'kompas.com', 'detik.net.id', 'kemenkeu.go.id', 'cnnindonesia.com', 'bisnis.com', 'sindonews.com', 'apnews.com', 'bbc.co.uk', 'bbci.co.uk', 'wsj.net', 'guim.co.uk', 'ft.com', 'dw.com', 'nrk.no', 'dr.dk', 'yle.fi', 'yleisradio.fi', 'irozhlas.cz', 'hotnews.ro', 'telex.hu', 'rte.ie', 'orf.at')


def category_for(url, title, tag=''):
    # ponytail: URL/title rules; use publisher taxonomy if editorial tagging needs refinement.
    if re.search(r'\b(?:indonesia|indonesian|ihsg|idx|rupiah|idr|bank indonesia|bi[ -]rate|ojk|lps|apbn|kemenkeu|bumn|prabowo|purbaya|sri mulyani|jakarta|nusantara|pns|umkm|upah minimum|timnas|pertamina|antam)\b', title, re.I):
        return 'local'
    text = (urllib.parse.urlsplit(url).path + ' ' + title + ' ' + tag).lower()
    for category, pattern in [
        ('investigations', r'investigat|investigasi|special-report'),
        ('commentary', r'commentary|breakingviews|opini'),
        ('legal', r'/legal/|lawsuit|court|sues|pengadilan|gugatan'),
        ('technology', r'technolog|teknologi|artificial intelligence|\bai\b|data center|chipmaker|software'),
        ('sustainability', r'sustainab|climate|iklim|environment|lingkungan|carbon|renewable'),
        ('science', r'science|scientist|nobel|sains'),
        ('sport', r'/sport|\b(?:sports?|football|soccer|olahraga|fifa|uefa|basketball|baseball|tennis|cricket|rugby|golf|hockey|nba|nfl|mlb|nhl|olympics|formula (?:one|1))\b'),
        ('markets', r'/markets/|market|forex|currency|currencies|yield|treasury|the fed|bonds?|stocks?|shares?|oil|gold|crypto|bitcoin|inflation|interest rate|central bank|suku bunga|rupiah|emas|minyak|batu bara|saham|inflasi'),
        ('business', r'/business/|econom|bisnis|ekonomi|company|companies|earnings|corporat|bank|industr|trade|perdagangan'),
        ('world', r'/world/|politic|politik|war\b|election|pemilu|president|military|conflict|gaza|lebanon'),
    ]:
        if re.search(pattern, text):
            return category
    return 'other'


def topics_for(title):
    return [topic for topic, pattern in [
        ('fed', r'\b(?:the fed|federal reserve|fomc|fedwatch|fed funds|powell|bank sentral (?:as|amerika))\b'),
        ('politics', r'\b(?:trump|biden|prabowo|presiden(?:t)?|politic\w*|politik|pemilu|election\w*|parliament|parlemen|kongres|congress|senat\w*|pemerintah|government|dpr|tariff\w*|tarif)\b'),
    ] if re.search(pattern, title, re.I)]


def image_url(value):
    try:
        url = urllib.parse.urlsplit(value or '')
        host = (url.hostname or '').lower()
        if url.scheme == 'https' and not url.username and not url.password and any(host == domain or host.endswith('.' + domain) for domain in IMAGE_DOMAINS):
            return urllib.parse.urlunsplit((url.scheme, url.netloc, url.path, url.query, ''))
    except ValueError:
        pass
    return None


class ArticleImage(HTMLParser):
    def __init__(self):
        super().__init__()
        self.image = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta' and attrs.get('property', attrs.get('name')) in ('og:image', 'twitter:image', 'twitter:image:src') and not self.image:
            self.image = image_url(attrs.get('content'))


def clean(value):
    text = re.sub(r"<[^>]*>", "", html.unescape(value or ""))
    text = re.sub(r"[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200D]", "", text)
    return " ".join(text.replace("—", "-").replace("–", "-").split())


def safe_url(value, domain):
    url = urllib.parse.urlsplit(value)
    host = (url.hostname or "").lower()
    domains = (domain,) if isinstance(domain, str) else domain
    if url.scheme != "https" or url.username or url.password or not any(host == allowed or host.endswith('.' + allowed) for allowed in domains):
        return None
    if re.search(r"/(?:analysis|opinion|stocksetup)/", url.path, re.I):
        return None
    return urllib.parse.urlunsplit((url.scheme, url.netloc, url.path, url.query, ""))


def date_iso(value):
    if not value:
        return None
    try:
        value = value.strip()
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00")) if re.match(r"\d{4}-", value) else email.utils.parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(dt.timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError):
        return None


class PublisherHeadlines(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.source = source
        self.current = None
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            attrs = dict(attrs)
            link = urllib.parse.urljoin(self.source["url"], attrs.get("href", ""))
            self.current = {"url": link, "title": attrs.get("title", ""), "parts": []} if re.search(self.source["article_pattern"], link) else None
        elif tag == 'img' and self.current is not None:
            attrs = dict(attrs)
            self.current['image'] = image_url(attrs.get('data-src') or attrs.get('src'))
            self.current['title'] = self.current['title'] or attrs.get('alt', '')

    def handle_data(self, data):
        if self.current is not None:
            self.current["parts"].append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.current is not None:
            row = self.current
            row["title"] = row["title"] or " ".join(row["parts"])
            if self.source['id'] == 'kompas':
                match = re.search(r'/read/(\d{4})/(\d{2})/(\d{2})/(\d{2})(\d{2})(\d{2})', row['url'])
                if match:
                    row['publishedAt'] = f'{match[1]}-{match[2]}-{match[3]}T{match[4]}:{match[5]}:{match[6]}+07:00'
            self.rows.append(row)
            self.current = None


class APHeadlines(PublisherHeadlines):
    def __init__(self, source):
        super().__init__(source)
        self.card = {}
        self.headline_tag = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if 'PagePromo' in values.get('class', '').split():
            self.card = {}
            stamp = values.get('data-posted-date-timestamp', '')
            if stamp.isdigit():
                try:
                    self.card['publishedAt'] = dt.datetime.fromtimestamp(int(stamp) / 1000, dt.timezone.utc).isoformat()
                except (ValueError, OverflowError, OSError):
                    pass
        if tag in ('h2', 'h3') and 'PagePromo-title' in values.get('class', '').split():
            self.headline_tag = tag
        if tag == 'img':
            self.card['image'] = image_url(values.get('src') or values.get('data-src'))
        if tag == 'a' and not self.headline_tag:
            self.current = None
            return
        super().handle_starttag(tag, attrs)
        if tag == 'a' and self.current is not None:
            self.current.update(self.card)

    def handle_endtag(self, tag):
        super().handle_endtag(tag)
        if tag == self.headline_tag:
            self.headline_tag = None


def parse(data, source):
    if source['kind'] == 'json':
        raw = json.loads(data)
        rows = [{'title': row.get('title'), 'url': source['url'], 'publishedAt': row.get('pub'), 'tag': row.get('tag', ''), 'id': row.get('id')} for row in raw.get('items', []) if isinstance(row, dict)]
    elif source["kind"] == "html":
        parser = APHeadlines(source) if source['id'] == 'ap' else PublisherHeadlines(source)
        parser.feed(data.decode("utf-8", errors="replace"))
        rows = parser.rows
    else:
        if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
            raise ValueError("XML declarations not supported")
        root = ET.fromstring(data)
        if source["kind"] == "rss":
            rows = []
            for row in root.findall('.//{*}item'):
                photo = next((image_url(el.get('url')) for el in row.iter() if el.tag.split('}')[-1] in ('enclosure', 'thumbnail', 'content') and image_url(el.get('url'))), None)
                rows.append({'title': row.findtext('{*}title'), 'url': row.findtext('{*}link'), 'publishedAt': row.findtext('{*}pubDate') or row.findtext('{http://purl.org/dc/elements/1.1/}date'), 'image': photo, 'tag':' '.join(''.join(category.itertext()) for category in row.findall('{*}category'))})
        else:
            ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "n": "http://www.google.com/schemas/sitemap-news/0.9", 'i': 'http://www.google.com/schemas/sitemap-image/1.1'}
            rows = [{"title": row.findtext("n:news/n:title", namespaces=ns), "url": row.findtext("s:loc", namespaces=ns), "publishedAt": row.findtext("n:news/n:publication_date", namespaces=ns), 'image': row.findtext('i:image/i:loc', namespaces=ns)} for row in root.findall("s:url", ns) if row.findtext('n:news/n:publication/n:language', default='en', namespaces=ns) == 'en']
    items, seen = [], set()
    now = dt.datetime.now(dt.timezone.utc)
    for row in rows:
        title = clean(row.get("title"))
        link = safe_url(row.get("url") or "", source.get('domains', source['domain']))
        if source['id'] == 'reuters' and link and re.match(r'^/(?!en/)[a-z]{2}/', urllib.parse.urlsplit(link).path):
            continue
        published = date_iso(row.get("publishedAt"))
        if published:
            age = now - dt.datetime.fromisoformat(published)
            if age > dt.timedelta(days=7) or age < -dt.timedelta(minutes=10):
                continue
        identity = str(row.get('id') or title) if source['kind'] == 'json' else link
        if not link or identity in seen or len(title) < 20 or len(title) > 250 or SIGNALS.search(title):
            continue
        seen.add(identity)
        category = source.get('category') or category_for(link, title, row.get('tag', ''))
        topics = topics_for(title + ' ' + row.get('tag', ''))
        if category == 'politics' and 'politics' not in topics:
            topics.append('politics')
        items.append({"id": hashlib.sha256((source['id'] + str(identity)).encode()).hexdigest()[:20], "source": source["id"], "title": title, "url": link, "publishedAt": published, 'image': image_url(row.get('image')), 'category': category, 'topics':topics})
    return merge_items([], items)[:20]


def add_article_image(item):
    if item.get('image'):
        return item
    try:
        request = urllib.request.Request(item['url'], headers={'User-Agent': 'JournalingTrade/1.0 (public headline reader)'})
        with urllib.request.urlopen(request, timeout=8) as response:
            if 'text/html' not in response.headers.get('Content-Type', ''):
                return item
            data = response.read(1_000_000)
        parser = ArticleImage()
        parser.feed(data.decode('utf-8', errors='replace'))
        item['image'] = parser.image
    except Exception:
        pass
    return item


def collect_feed(source):
    public = {key: source[key] for key in ("id", "name", "url", "kind")}
    if source["kind"] in ('tool', 'external'):
        return {**public, "status": "external"}, []
    try:
        request = urllib.request.Request(source["feed"], headers={"User-Agent": "JournalingTrade/1.0 (public headline reader)", "Accept": "application/rss+xml, application/xml, text/html"})
        with urllib.request.urlopen(request, timeout=20) as response:
            limit = 32_000_000 if source['kind'] == 'json' else 5_000_000
            data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError("Response too large")
        items = parse(data, source)
        if not items:
            raise ValueError("No current headlines found")
        return {**public, "status": "ok", "checkedAt": dt.datetime.now(dt.timezone.utc).isoformat()}, items
    except Exception as error:
        print(f"{source['name']}: {error}", file=sys.stderr)
        return {**public, "status": "unavailable"}, []


def collect(source):
    if not source.get('feeds'):
        return collect_feed(source)
    items, checked = [], None
    for feed in source['feeds']:
        state, found = collect_feed({**source, **{key:value for key,value in feed.items() if key != 'url'}, 'feed':feed['url']})
        items.extend(found)
        if state['status'] == 'ok':
            checked = state['checkedAt']
    public = {key:source[key] for key in ('id','name','url','kind')}
    return {**public, 'status':'ok' if items else 'unavailable', 'checkedAt':checked}, merge_items([], items)


def article_identity(item):
    source = item['source']
    if source == 'fnc':
        return source, item.get('id') or item['title']
    url = urllib.parse.urlsplit(item['url'])
    if source == 'ap':
        article = re.search(r'/article/[^/]+-([a-f0-9]{32})$', url.path)
        if article:
            return source, article[1]
    if source == 'kompas':
        article = re.match(r'/read/(\d{4}/\d{2}/\d{2}/\d+)(?:/|$)', url.path)
        if article:
            return source, article[1]
    query = [(key, value) for key, value in urllib.parse.parse_qsl(url.query, keep_blank_values=True)
             if not key.lower().startswith(('utm_', 'at_', 'syn-')) and key.lower() not in ('source', 'fbclid', 'gclid', 'mod', 'maca')]
    return source, urllib.parse.urlunsplit((url.scheme, url.netloc.lower(), url.path.rstrip('/'), urllib.parse.urlencode(sorted(query)), ''))


def merge_items(previous, incoming):
    domains = {source['id']: source.get('domains', source['domain']) for source in SOURCES}
    merged, headlines = {}, {}
    # ponytail: keep the complete headline archive in one feed; split by month if download size becomes a problem.
    for item in [*previous, *incoming]:
        if not isinstance(item, dict) or item.get('source') not in domains or not isinstance(item.get('title'), str):
            continue
        if not safe_url(item.get('url', ''), domains[item['source']]) or SIGNALS.search(item['title']):
            continue
        key = article_identity(item)
        headline = (item['source'], clean(item['title']).casefold(), (item.get('publishedAt') or '')[:10])
        if item['source'] != 'fnc':
            key = headlines.get(headline, key)
            headlines[headline] = key
        old = merged.get(key, {})
        row = {**old, **item}
        for field in ('image', 'publishedAt'):
            if not row.get(field) and old.get(field):
                row[field] = old[field]
        merged[key] = row
    return sorted(merged.values(), key=lambda item: item.get('publishedAt') or '', reverse=True)


def main():
    path = ROOT / "berita.json"
    previous = {}
    if path.exists():
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(value, dict) and value.get("version") == 1:
                previous = value
        except (ValueError, OSError):
            pass
    sources, items = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for source, found in pool.map(collect, SOURCES):
            if source["status"] == "unavailable":
                old_source = next((row for row in previous.get("sources", []) if row.get("id") == source["id"]), {})
                source["checkedAt"] = old_source.get("checkedAt")
                found = [row for row in previous.get("items", []) if row.get("source") == source["id"]]
                if found:
                    source["status"] = "stale"
            sources.append(source)
            items.extend(found)
    previous_items = {row.get('url'): row for row in previous.get('items', [])}
    missing = []
    for item in items:
        item.setdefault('category', category_for(item['url'], item['title']))
        item.setdefault('topics', topics_for(item['title']))
        if item['source'] == 'fnc':
            continue
        old = previous_items.get(item['url'], {})
        if not item.get('image') and 'image' in old:
            item['image'] = image_url(old['image'])
        elif not item.get('image'):
            missing.append(item)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(add_article_image, missing))
    items = merge_items(previous.get('items', []), items)
    output = {"version": 1, "checkedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "intervalMinutes": 5, "sources": sources, "items": items}
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    print(f"Saved {len(items)} headlines; {sum(row['status'] == 'ok' for row in sources)} active feeds")


if __name__ == "__main__":
    main()
