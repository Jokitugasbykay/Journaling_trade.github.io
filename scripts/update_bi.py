"""Read published transaction rates and BI-Rate from Bank Indonesia."""
import datetime as dt
from decimal import Decimal
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
FX_URL = 'https://www.bi.go.id/id/statistik/informasi-kurs/transaksi-bi/default.aspx'
RATE_URL = 'https://www.bi.go.id/id/statistik/indikator/bi-rate.aspx'
MONTHS = 'januari februari maret april mei juni juli agustus september oktober november desember'.split()


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.text = [], []
        self.row = self.cell = None
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        if tag == 'tr':
            self.row = []
        if tag in ('td', 'th'):
            self.cell = []

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)
        if tag in ('td', 'th') and self.cell is not None:
            if self.row is not None:
                self.row.append(' '.join(self.cell).strip())
            self.cell = None
        if tag == 'tr' and self.row:
            self.rows.append(self.row)
            self.row = None

    def handle_data(self, text):
        if not self.skip and text.strip():
            self.text.append(text.strip())
        if self.cell is not None:
            self.cell.append(text.strip())


def published_date(text):
    match = re.search(r'(\d{1,2})\s+(' + '|'.join(MONTHS) + r')\s+(\d{4})', text, re.I)
    if not match:
        raise ValueError('Publication date missing')
    date = dt.date(int(match[3]), MONTHS.index(match[2].lower()) + 1, int(match[1]))
    if date > dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).date():
        raise ValueError('Future publication date')
    return date.isoformat()


def parse(data, kind):
    table = Tables()
    table.feed(data.decode('utf-8', errors='replace'))
    if kind == 'fx':
        row = next(row for row in table.rows if len(row) >= 4 and row[0].strip() == 'USD')
        unit, sell, buy = [Decimal(value.replace('.', '').replace(',', '.').replace(' ', '')) for value in row[1:4]]
        if not (unit == 1 and Decimal(0) < buy <= sell < Decimal(10000000)):
            raise ValueError('Invalid USD transaction rates')
        date_text = ' '.join(table.text).split('Update Terakhir', 1)[1]
        return {'date': published_date(date_text), 'currency': 'USD', 'unit': 1, 'sell': float(sell), 'buy': float(buy), 'mid': float((sell + buy) / 2)}
    values = []
    for row in table.rows:
        if len(row) >= 3 and '%' in row[2]:
            date = published_date(row[1])
            percent = float(row[2].replace('%', '').replace(',', '.').strip())
            if not 0 <= percent <= 100:
                raise ValueError('Invalid BI-Rate')
            values.append({'date': date, 'percent': percent})
    if not values:
        raise ValueError('BI-Rate table missing')
    return max(values, key=lambda value: value['date'])


def main():
    path = ROOT / 'bi.json'
    try:
        previous = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        previous = {}
    result = {'version': 1, 'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat()}
    for kind, url in [('fx', FX_URL), ('rate', RATE_URL)]:
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'JournalingTrade/1.0 (public data reader)'})
            with urllib.request.urlopen(request, timeout=25) as response:
                data = response.read(3_000_001)
            if len(data) > 3_000_000:
                raise ValueError('Response too large')
            result[kind] = {**parse(data, kind), 'source': url, 'status': 'ok', 'checkedAt': result['checkedAt']}
        except Exception as error:
            print(f'BI {kind}: {error}')
            saved = previous.get(kind, {})
            result[kind] = {**saved, 'source': url, 'status': 'stale' if saved.get('date') else 'unavailable'}
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)
    print('BI data:', result['fx']['status'], result['rate']['status'])


if __name__ == '__main__':
    main()
