"""Audit configured publisher URLs and public feeds; never synthesizes headlines."""
import argparse
import concurrent.futures
from collections import Counter
import datetime as dt
from html.parser import HTMLParser
import ipaddress
import json
from pathlib import Path
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

import update_news as news

LIMIT = 5_000_000
TIMEOUT = 10


def public_url(value):
    try:
        url = urllib.parse.urlsplit(value)
        if url.scheme != 'https' or not url.hostname or url.username or url.password or url.port not in (None, 443):
            return False
        if url.hostname == 'localhost' or url.hostname.endswith(('.local', '.localhost')):
            return False
        try:
            return ipaddress.ip_address(url.hostname).is_global
        except ValueError:
            return '.' in url.hostname
    except ValueError:
        return False


class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, url):
        if not public_url(url):
            raise ValueError('Non-public redirect rejected')
        return super().redirect_request(request, response, code, message, headers, url)


def fetch(url):
    result = {'url': url, 'status': 'unavailable'}
    if not public_url(url):
        return {**result, 'error': 'Non-public URL rejected'}, b''
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'JournalingTrade/1.0 (public headline reader)', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/html'})
        with urllib.request.build_opener(PublicRedirect()).open(request, timeout=TIMEOUT) as response:
            result.update(httpStatus=response.status, finalUrl=response.url, contentType=response.headers.get('Content-Type', ''))
            data = response.read(LIMIT + 1)
        if len(data) > LIMIT:
            return {**result, 'error': 'Response exceeds 5 MB'}, b''
        block = re.search(br'<title[^>]*>[^<]*(?:just a moment|verify you are human|access denied|robot check|attention required|captcha)', data[:15000], re.I)
        result.update(status='blocked' if block and 'html' in result['contentType'] else 'reachable', bytes=len(data))
        return result, data
    except urllib.error.HTTPError as error:
        result.update(httpStatus=error.code, status='blocked' if error.code in (401, 403, 429) else 'unavailable', error=str(error))
    except Exception as error:
        result['error'] = str(error)[:180]
    return result, b''


class FeedLinks(HTMLParser):
    def __init__(self, base):
        super().__init__()
        self.base, self.feeds, self.indexes = base, [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        try:
            link = urllib.parse.urljoin(self.base, attrs.get('href') or '')
        except ValueError:
            return
        if not public_url(link) or '/comments/' in link or (attrs.get('title') or '').lower().startswith('comments'):
            return
        if tag == 'link' and (attrs.get('type') or '').lower() in ('application/rss+xml', 'application/atom+xml'):
            self.feeds.append(link)
        elif tag == 'a' and re.search(r'(?:/rss(?:/|$)|/feeds?(?:/|$)|\.rss$|\.xml$)', urllib.parse.urlsplit(link).path, re.I):
            (self.indexes if urllib.parse.urlsplit(link).path.rstrip('/') in ('/rss', '/feeds') else self.feeds).append(link)


def feed_result(url, source, kind=None):
    result, data = fetch(url)
    if result['status'] != 'reachable':
        return result
    effective = {**source, 'kind': kind or source['kind'], 'feed': url}
    try:
        if effective['kind'] in ('rss', 'sitemap'):
            if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():
                raise ValueError('XML declarations not supported')
            root = ET.fromstring(data)
            if (root.findtext('.//{*}channel/{*}title') or '').lower().startswith('comments'):
                raise ValueError('Comment feed is not a news headline feed')
            result['format'] = root.tag.split('}')[-1]
            result['rawEntries'] = len(root.findall('.//{*}item')) + len(root.findall('.//{*}entry')) + sum(1 for row in root.findall('{*}url') if row.find('.//{*}news') is not None)
        items = news.parse(data, effective)
        result.update(parsedHeadlines=len(items), status='working' if items else 'no_parsed_headlines')
        if items:
            result['sampleArticleUrl'] = items[0]['url']
            result['samplePublishedAt'] = items[0].get('publishedAt')
    except Exception as error:
        result.update(status='no_parsed_headlines', error=str(error)[:180])
    return result


def official_link(url, source):
    if not public_url(url):
        return False
    host = (urllib.parse.urlsplit(url).hostname or '').removeprefix('www.')
    domains = source.get('domains', (source['domain'],))
    return any(host == domain or host.endswith('.' + domain) for domain in domains)


def discover(source, portal, data):
    candidates, evidence = [], []
    if data and portal['status'] == 'reachable':
        links = FeedLinks(portal.get('finalUrl', source['url']))
        links.feed(data.decode('utf-8', errors='replace'))
        candidates.extend((url, source['url'], 'rss') for url in links.feeds)
        for index in list(dict.fromkeys(links.indexes))[:1]:
            if not official_link(index, source):
                continue
            state, content = fetch(index)
            evidence.append(state)
            if state['status'] == 'reachable':
                indexed = FeedLinks(index)
                indexed.feed(content.decode('utf-8', errors='replace'))
                candidates.extend((url, index, 'rss') for url in indexed.feeds)
    robots = urllib.parse.urljoin(source['url'], '/robots.txt')
    state, content = fetch(robots)
    evidence.append(state)
    if state['status'] == 'reachable':
        candidates.extend((url, robots, 'sitemap') for url in re.findall(r'^Sitemap:\s*(\S+)', content.decode('utf-8', errors='replace'), re.I | re.M) if re.search(r'news|google', url, re.I))
    found, seen = [], set()
    for url, origin, kind in candidates:
        if url in seen or not official_link(url, source):
            continue
        seen.add(url)
        result = feed_result(url, source, kind)
        found.append({**result, 'advertisedBy': origin, 'kind': kind})
        if result['status'] == 'working' or len(found) >= 3:
            break
    return found, evidence


def audit(source, discovery):
    portal, data = fetch(source['url'])
    feeds = source.get('feeds') or ([{'url': source['feed']}] if source.get('feed') else [])
    endpoints = [feed_result(row['url'], {**source, **{key: value for key, value in row.items() if key != 'url'}}) for row in feeds]
    candidates, evidence = ([], [])
    if discovery and source['kind'] != 'tool' and not any(row['status'] == 'working' for row in endpoints):
        candidates, evidence = discover(source, portal, data)
    status = 'working' if any(row['status'] == 'working' for row in endpoints) else 'external' if not feeds else 'blocked' if all(row['status'] == 'blocked' for row in endpoints) else 'no_parsed_headlines' if any(row['status'] == 'no_parsed_headlines' for row in endpoints) else 'unavailable'
    return {'id': source['id'], 'name': source['name'], 'kind': source['kind'], 'country': source.get('country'), 'status': status, 'portal': portal, 'endpoints': endpoints, 'discoveredFeeds': candidates, 'discoveryPages': evidence}


def write_report(rows, started, output):
    counts = dict(Counter(row['status'] for row in rows))
    portals = dict(Counter(row['portal']['status'] for row in rows))
    dns_failures = sum('getaddrinfo failed' in row['portal'].get('error', '') for row in rows)
    candidates = [{'id': row['id'], 'name': row['name'], **feed} for row in rows for feed in row['discoveredFeeds'] if feed['status'] == 'working']
    working_ids = {row['id'] for row in rows if row['status'] == 'working'}
    coverage = {code: {'configured': len(portals), 'working': sum(portal['id'] in working_ids for portal in portals)} for code, portals in news.REGIONAL_NEWS_SOURCES.items()}
    report = {'startedAt': started, 'finishedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'sourceCount': len(rows), 'statusCounts': counts, 'portalStatusCounts': portals, 'candidateFeedUpdates': candidates, 'method': 'Every unique configured source ID: GET publisher URL and every configured endpoint, maximum 24 concurrent source workers, 10-second socket timeout, 5 MB per response. Optional discovery follows advertised official RSS/Atom links, one linked RSS index, and news sitemap links in robots.txt; maximum three candidates per source. No paywall or bot protection bypass. Parsed headline counts use production validation/freshness rules and are not total publisher output.', 'sources': rows}
    report['regionalCoverage'] = coverage
    report['regionsBelowMinimum'] = [code for code, state in coverage.items() if state['working'] < 4]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    lines = ['# News source audit', '', f'Audit finished: {report["finishedAt"]}. Checked **{len(rows)}** unique source IDs.', '', '## Results', '', '| Collector state | Sources |', '| --- | ---: |', *[f'| {state} | {count} |' for state, count in sorted(counts.items())], '', f'Portal reachability: {portals}.', '', f'**Audit network limitation:** {dns_failures} portal requests failed DNS resolution in this environment. These results do not establish that those publishers are globally offline.', '', 'An external source is a directory/portal link without a configured automatic collector. A reachable portal does not imply its feed is collectable. Blocked/unavailable results describe this audit location and time. XML entries with no parsed headlines may be old, unsupported Atom, off-domain, or rejected by headline validation; production currently keeps headlines dated within seven days.', '', '## Validated official feed candidates', '', '| Source | Endpoint | Publisher evidence | Current parsed headlines |', '| --- | --- | --- | ---: |']
    lines.extend(f'| {row["name"]} | [Feed]({row["url"]}) | [Publisher page]({row["advertisedBy"]}) | {row["parsedHeadlines"]} |' for row in candidates)
    lines.extend(['', '## Regional coverage', '', 'Target: at least four distinct working publisher IDs in each configured dataset. A working endpoint produced validated headlines during this audit; availability can change.', '', '| Region | Configured portals | Working portals |', '| --- | ---: | ---: |'])
    lines.extend(f'| {code} | {state["configured"]} | {state["working"]} |' for code, state in sorted(coverage.items()))
    lines.extend(['', '## Endpoint details', '', '| Source | State | Portal | Configured feeds |', '| --- | --- | --- | --- |'])
    lines.extend(f'| {row["name"]} | {row["status"]} | [Publisher]({row["portal"]["url"]}) ({row["portal"]["status"]}) | '+('; '.join(f'[{feed["status"]}]({feed["url"]})' for feed in row['endpoints']) or 'No collector configured')+' |' for row in rows)
    output.with_suffix('.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    parser.add_argument('--discover', action='store_true')
    parser.add_argument('--workers', type=int, default=24)
    parser.add_argument('--source', action='append', default=[])
    parser.add_argument('--output', type=Path, default=news.ROOT / 'docs/news-source-audit.json')
    args = parser.parse_args()
    if args.self_test:
        assert public_url('https://example.com/rss')
        for value in ('https://127.0.0.1/rss', 'https://localhost/rss', 'https://example.com:8443/rss', 'https://user:secret@example.com/rss'):
            assert not public_url(value)
        links = FeedLinks('https://example.com')
        links.feed('<link rel="alternate" type="application/atom+xml" href="/atom.xml"><a href="/rss">RSS</a><link type="application/rss+xml" href="/comments/feed/">')
        assert links.feeds == ['https://example.com/atom.xml'] and links.indexes == ['https://example.com/rss']
        links.feed('<a title href="/other">News</a><link type><link type="application/rss+xml" href="https://[broken/feed"><link type="application/rss+xml" href="http://localhost/feed">')
        assert links.feeds == ['https://example.com/atom.xml'] and links.indexes == ['https://example.com/rss']
        assert official_link('https://rss.example.com/feed', {'domain': 'example.com'})
        assert not official_link('https://evil-example.com/feed', {'domain': 'example.com'})
        assert not official_link('https://[broken/feed', {'domain': 'example.com'})
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            sample = {'id':'ap','name':'AP News','kind':'rss','status':'working','portal':{'status':'reachable','url':'https://apnews.com'},'endpoints':[],'discoveredFeeds':[]}
            report = write_report([sample], 'self-test', Path(directory) / 'audit.json')
            assert report['regionalCoverage']['GLOBAL']['working'] == 1 and 'GLOBAL' in report['regionsBelowMinimum']
        print('Audit URL validation/discovery checks passed')
        return
    sources = [source for source in news.SOURCES if not args.source or source['id'] in args.source]
    started = dt.datetime.now(dt.timezone.utc).isoformat()
    rows = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 24))) as pool:
        futures = [pool.submit(audit, source, args.discover) for source in sources]
        for future in concurrent.futures.as_completed(futures):
            rows.append(future.result())
            if len(rows) % 25 == 0:
                print(f'Audited {len(rows)}/{len(sources)} sources', flush=True)
    report = write_report(sorted(rows, key=lambda row: row['name'].casefold()), started, args.output)
    print(json.dumps({key: report[key] for key in ('sourceCount', 'statusCounts', 'portalStatusCounts')}, ensure_ascii=False))
    print(f'Validated candidate feeds: {len(report["candidateFeedUpdates"])}')


if __name__ == '__main__':
    main()
