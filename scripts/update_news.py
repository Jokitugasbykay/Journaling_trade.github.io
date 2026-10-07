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
    {"id": "kontan", "name": "Kontan", "url": "https://www.kontan.co.id/", "feed": "https://www.kontan.co.id/", "kind": "html", "domain": "kontan.co.id"},
    {"id": "reuters", "name": "Reuters", "url": "https://www.reuters.com/", "feed": "https://www.reuters.com/arc/outboundfeeds/news-sitemap/?outputType=xml", "kind": "sitemap", "domain": "reuters.com"},
    {"id": "aljazeera", "name": "Al Jazeera", "url": "https://www.aljazeera.com/", "feed": "https://www.aljazeera.com/xml/rss/all.xml", "kind": "rss", "domain": "aljazeera.com"},
    {"id": "bloomberg", "name": "Bloomberg", "url": "https://www.bloomberg.com/asia", "feed": "https://feeds.bloomberg.com/markets/news.rss", "kind": "rss", "domain": "bloomberg.com"},
    {'id': 'fnc', 'name': 'Trade With FNC', 'url': 'https://tradewithfnc.com/', 'feed': 'https://tradewithfnc.com/berita.json', 'kind': 'json', 'domain': 'tradewithfnc.com'},
    {"id": "fedwatch", "name": "CME FedWatch", "url": "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html", "kind": "tool", "domain": "cmegroup.com"},
    {"id": "cme", "name": "CME Markets", "url": "https://www.cmegroup.com/markets.html?redirect=/markets/", "kind": "tool", "domain": "cmegroup.com"},
]
SIGNALS = re.compile(r"\b(?:buy on (?:dip|pullback)|sell on (?:rally|bounce)|stocks? to buy|stock picks?|trading signals?|price targets?|target harga|sinyal trading|rekomendasi (?:beli|jual)|buy now|sell now)\b", re.I)
IMAGE_DOMAINS = ('investing.com', 'cnbcfm.com', 'kontan.co.id', 'reuters.com', 'aljazeera.com', 'bloomberg.com', 'bwbx.io')


def category_for(url, title, tag=''):
    # ponytail: URL/title rules; use publisher taxonomy if editorial tagging needs refinement.
    text = (urllib.parse.urlsplit(url).path + ' ' + title + ' ' + tag).lower()
    for category, pattern in [
        ('investigations', r'investigat|investigasi|special-report'),
        ('commentary', r'commentary|breakingviews|opini'),
        ('legal', r'/legal/|lawsuit|court|sues|pengadilan|gugatan'),
        ('technology', r'technolog|teknologi|artificial intelligence|\bai\b|data center|chipmaker|software'),
        ('sustainability', r'sustainab|climate|iklim|environment|lingkungan|carbon|renewable'),
        ('science', r'science|scientist|nobel|sains'),
        ('sport', r'/sport|football|soccer|olahraga|fifa|uefa'),
        ('markets', r'/markets/|market|forex|currency|currencies|yield|bonds?|stocks?|shares?|oil|gold|crypto|bitcoin|inflation|interest rate|central bank|suku bunga|rupiah|emas|minyak|batu bara|saham|inflasi'),
        ('business', r'/business/|econom|bisnis|ekonomi|company|companies|earnings|corporat|bank|industr|trade|perdagangan'),
        ('world', r'/world/|politic|politik|war\b|election|pemilu|president|military|conflict|gaza|lebanon'),
    ]:
        if re.search(pattern, text):
            return category
    return 'other'


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
    if url.scheme != "https" or url.username or url.password or not (host == domain or host.endswith("." + domain)):
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


class KontanHeadlines(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            attrs = dict(attrs)
            link = urllib.parse.urljoin("https://www.kontan.co.id/", attrs.get("href", ""))
            self.current = {"url": link, "title": attrs.get("title", ""), "parts": []} if "/news/" in link else None
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
            self.rows.append(row)
            self.current = None


def parse(data, source):
    if source['kind'] == 'json':
        raw = json.loads(data)
        rows = [{'title': row.get('title'), 'url': source['url'], 'publishedAt': row.get('pub'), 'tag': row.get('tag', ''), 'id': row.get('id')} for row in raw.get('items', []) if isinstance(row, dict)]
    elif source["kind"] == "html":
        parser = KontanHeadlines()
        parser.feed(data.decode("utf-8", errors="replace"))
        rows = parser.rows
    else:
        if b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper():
            raise ValueError("XML declarations not supported")
        root = ET.fromstring(data)
        if source["kind"] == "rss":
            rows = []
            for row in root.findall('.//item'):
                photo = next((image_url(el.get('url')) for el in row.iter() if el.tag.split('}')[-1] in ('enclosure', 'thumbnail', 'content') and image_url(el.get('url'))), None)
                rows.append({'title': row.findtext('title'), 'url': row.findtext('link'), 'publishedAt': row.findtext('pubDate'), 'image': photo})
        else:
            ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "n": "http://www.google.com/schemas/sitemap-news/0.9", 'i': 'http://www.google.com/schemas/sitemap-image/1.1'}
            rows = [{"title": row.findtext("n:news/n:title", namespaces=ns), "url": row.findtext("s:loc", namespaces=ns), "publishedAt": row.findtext("n:news/n:publication_date", namespaces=ns), 'image': row.findtext('i:image/i:loc', namespaces=ns)} for row in root.findall("s:url", ns) if row.findtext('n:news/n:publication/n:language', default='en', namespaces=ns) == 'en']
    items, seen = [], set()
    now = dt.datetime.now(dt.timezone.utc)
    for row in rows:
        title = clean(row.get("title"))
        link = safe_url(row.get("url") or "", source["domain"])
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
        items.append({"id": hashlib.sha256((source['id'] + str(identity)).encode()).hexdigest()[:20], "source": source["id"], "title": title, "url": link, "publishedAt": published, 'image': image_url(row.get('image')), 'category': category_for(link, title, row.get('tag', ''))})
    items.sort(key=lambda item: item["publishedAt"] or "", reverse=True)
    return items[:20]


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


def collect(source):
    public = {key: source[key] for key in ("id", "name", "url", "kind")}
    if source["kind"] == "tool":
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
        item['category'] = item.get('category') or category_for(item['url'], item['title'])
        if item['source'] == 'fnc':
            continue
        old = previous_items.get(item['url'], {})
        if not item.get('image') and 'image' in old:
            item['image'] = image_url(old['image'])
        elif not item.get('image'):
            missing.append(item)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(add_article_image, missing))
    items.sort(key=lambda item: item.get("publishedAt") or "", reverse=True)
    output = {"version": 1, "checkedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "intervalMinutes": 30, "sources": sources, "items": items[:140]}
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)
    print(f"Saved {len(items)} headlines; {sum(row['status'] == 'ok' for row in sources)} active feeds")


if __name__ == "__main__":
    main()
