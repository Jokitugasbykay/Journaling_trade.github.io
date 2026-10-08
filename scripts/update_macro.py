"""Refresh public FOMC schedules/probabilities without inventing unavailable data."""
import datetime as dt
import html
import json
from fractions import Fraction
from pathlib import Path
import re
import urllib.request
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
FED = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'
BEANS = 'https://growbeansprout.com/tools/fedwatch'
MONITOR = 'https://www.investing.com/central-banks/fed-rate-monitor'
CALENDAR = 'https://www.investing.com/economic-calendar/'
MONTHLY = 'https://www.forexfactory.com/calendar?month='
JACKSON = 'https://www.kansascityfed.org/research/jackson-hole-economic-symposium/'

def download(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'JournalingTrade/1.0 (public calendar reader)'})
    with urllib.request.urlopen(req, timeout=20) as response:
        data = response.read(6000001)
    if len(data) > 6000000:
        raise ValueError('Response too large')
    return data.decode('utf-8', errors='replace')

def plain(value):
    return ' '.join(html.unescape(re.sub('<[^>]+>', ' ', '' if value is None else str(value))).split())

def meetings(data):
    found = []
    months = {dt.date(2000,m,1).strftime('%B'):m for m in range(1,13)}
    panels = re.split(r'(\d{4}) FOMC Meetings', data)
    for year, body in zip(panels[1::2], panels[2::2]):
        for month, days in re.findall(r'fomc-meeting__month[^>]*>\s*<strong>([^<]+)</strong>.*?fomc-meeting__date[^>]*>([^<]+)',body,re.S):
            month = month.split('/')[-1]
            end = re.search(r'(\d+)\s*\*?\s*$',days)
            if month not in months or not end: continue
            # ponytail: expected 14:00 ET decision time; official calendar supplies meeting dates, not a guaranteed release time.
            date = dt.datetime(int(year), months[month], int(end[1]), 14, tzinfo=ZoneInfo('America/New_York'))
            found.append({'date':date.date().isoformat(),'decisionAt':date.astimezone(dt.timezone.utc).isoformat(),'hasProjections':'*' in days})
    if not found: raise ValueError('No official meetings parsed')
    return sorted(found,key=lambda x:x['decisionAt'])

def beans_probability(data):
    block = re.search(r'meetingDate:"(\d{4}-\d{2}-\d{2})",rateRange:\[(.*?)\]',data,re.S)
    stamp = re.search(r'lastUpdated:"([^"]+)"',data)
    if not block or not stamp: raise ValueError('Probability snapshot unavailable')
    rows = [{'lower':float(a),'upper':float(b),'probability':float(c)} for a,b,c in re.findall(r'lowerBound:([\d.]+),upperBound:([\d.]+),probability:([\d.]+)',block[2])]
    return validate_probability({'meetingDate':block[1],'asOf':stamp[1],'distribution':rows})

def validate_probability(value):
    dt.date.fromisoformat(value['meetingDate'])
    timestamp = dt.datetime.fromisoformat(value['asOf'].replace('Z','+00:00'))
    if not timestamp.tzinfo or timestamp > dt.datetime.now(dt.timezone.utc)+dt.timedelta(minutes=10):
        raise ValueError('Invalid probability timestamp')
    rows=value['distribution']
    if not rows or any(not 0<=row['probability']<=100 or not 0<=row['lower']<row['upper']<=30 for row in rows) or abs(sum(row['probability'] for row in rows)-100)>0.3:
        raise ValueError('Invalid distribution')
    return value

def target_rate(data):
    found = re.search(r'target range for the federal funds rate.{0,180}?(\d+(?:-\d+/\d+|\.\d+)?) to (\d+(?:-\d+/\d+|\.\d+)?) percent',plain(data))
    if not found: raise ValueError('Official target range unavailable')
    def number(value):
        whole, _, fraction = value.partition('-')
        return float(whole) + (float(Fraction(fraction)) if fraction else 0)
    lower, upper = number(found[1]), number(found[2])
    if not 0<=lower<upper<=30: raise ValueError('Invalid target range')
    return {'lower':lower,'upper':upper}

def investing_probability(data):
    text=plain(data)
    match=re.search(r'Meeting Time:\s*([A-Za-z]{3} \d{1,2}, \d{4}).*?Target Rate\s+Current Probability%.*?(.*?)Updated:\s*([A-Za-z]{3} \d{2}, \d{4} \d{2}:\d{2}[AP]M)\s+(EDT|EST)',text,re.S)
    if not match:raise ValueError('Rate monitor table unavailable')
    rows=[{'lower':float(a),'upper':float(b),'probability':float(c)} for a,b,c in re.findall(r'(\d+\.\d+)\s*-\s*(\d+\.\d+)\s+(\d+\.\d+)%\s+\d+\.\d+%\s+\d+\.\d+%',match[2])]
    stamp=dt.datetime.strptime(match[3],'%b %d, %Y %I:%M%p').replace(tzinfo=dt.timezone(dt.timedelta(hours=-4 if match[4]=='EDT' else -5)))
    return validate_probability({'meetingDate':dt.datetime.strptime(match[1],'%b %d, %Y').date().isoformat(),'asOf':stamp.astimezone(dt.timezone.utc).isoformat(),'distribution':rows})

def calendar_rows(data):
    # Only accept absolute event epochs. Site display times alone are ambiguous.
    rows=[]
    structured = re.search(r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>', data, re.S)
    if structured:
        state = json.loads(structured[1]).get('props', {}).get('pageProps', {}).get('state', {})
        events = state.get('economicCalendarStore', {}).get('calendarEventsByDate', {})
        for day in events.values():
            for event in day if isinstance(day, list) else []:
                try:
                    moment = dt.datetime.fromisoformat(event.get('time', '').replace('Z', '+00:00'))
                    impact = int(event.get('importance', 0))
                    currency = event.get('currency', '')
                    name = event.get('event', '')
                    if not moment.tzinfo or impact not in (1, 2, 3) or not re.fullmatch('[A-Z]{3}', currency) or not name:
                        continue
                    moment = moment.astimezone(ZoneInfo('Asia/Jakarta'))
                    rows.append({'id': str(event['occurrenceId']), 'tgl': moment.date().isoformat(), 'jam': moment.strftime('%H:%M'), 'neg': currency, 'countryCode': event.get('currencyFlag', ''), 'nama': name + (' ' + event['period'] if event.get('period') else ''), 'dmp': impact, 'akt': plain(event.get('actual')), 'prk': plain(event.get('forecast')), 'sbl': plain(event.get('previous')), 'cat': ''})
                except (ValueError, TypeError, KeyError, AttributeError):
                    continue
        if rows:
            return rows
    for attrs,body in re.findall(r'<tr\b([^>]*data-event-timestamp[^>]*)>(.*?)</tr>',data,re.S):
        stamp=re.search(r'data-event-timestamp=["\'](\d+)',attrs)
        if not stamp:continue
        moment=dt.datetime.fromtimestamp(int(stamp[1]),dt.timezone.utc).astimezone(ZoneInfo('Asia/Jakarta'))
        def cell(name):
            found=re.search(r'<td[^>]*(?:class|id)=["\'][^"\']*'+name+r'[^"\']*["\'][^>]*>(.*?)</td>',body,re.S)
            return plain(found[1]) if found else ''
        impact=body.count('grayFullBullishIcon')
        if impact not in (1,2,3):continue
        name=cell('event')
        currency=cell('flagCur').split()[-1:]
        if not name or not currency or not re.fullmatch('[A-Z]{3}',currency[0]):continue
        rows.append({'id':str(stamp[1])+currency[0]+name,'tgl':moment.date().isoformat(),'jam':moment.strftime('%H:%M'),'neg':currency[0],'nama':name,'dmp':impact,'akt':cell('act'),'prk':cell('fore'),'sbl':cell('prev'),'cat':''})
    if not rows:raise ValueError('No events with verified timestamps')
    return rows

def monthly_rows(data):
    match = re.search(r'\bdays:\s*(\[)', data)
    if not match:
        raise ValueError('Monthly calendar data unavailable')
    days = json.JSONDecoder().raw_decode(data[match.start(1):])[0]
    rows = []
    for day in days:
        for event in (day.get('events') or []) if isinstance(day, dict) else []:
            try:
                impact = {'low': 1, 'medium': 2, 'high': 3}.get(event.get('impactName'))
                if not impact or not re.fullmatch('[A-Z]{3}', event.get('currency', '')) or not plain(event.get('name')):
                    continue
                moment = dt.datetime.fromtimestamp(int(event['dateline']), dt.timezone.utc).astimezone(ZoneInfo('Asia/Jakarta'))
                country = {'UK': 'GB', 'CH': 'CN', 'EZ': 'EU', 'JN': 'JP', 'SZ': 'CH'}.get(event.get('country'), event.get('country', ''))
                rows.append({'id': 'ff-' + str(event['id']), 'tgl': moment.date().isoformat(), 'jam': '' if event.get('timeMasked') else moment.strftime('%H:%M'),
                             'neg': event['currency'], 'countryCode': country, 'nama': plain(event['name']), 'dmp': impact,
                             'akt': plain(event.get('actual')), 'prk': plain(event.get('forecast')), 'sbl': plain(event.get('previous')),
                             'cat': '', 'source': 'https://www.forexfactory.com' + (event.get('url') or '/calendar')})
            except (ValueError, TypeError, KeyError, AttributeError, OverflowError, OSError):
                continue
    if not rows:
        raise ValueError('No monthly events parsed')
    return rows

def merge_calendar(monthly, daily):
    # Match exact release names/times; do not merge distinct YoY/MoM indicators.
    def key(row):
        name = row['nama'].lower()
        name = re.sub(r'\((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q[1-4]|\d{4})\)', '', name)
        name = name.replace(' m/m', ' mom').replace(' y/y', ' yoy').replace(' q/q', ' qoq')
        return row['tgl'], row['jam'], row['neg'], re.sub(r'[^a-z0-9]', '', name)
    merged = {key(row): row for row in monthly}
    for row in daily:
        row = {**row, 'source': CALENDAR}
        merged[key(row)] = row
    return sorted(merged.values(), key=lambda row: (row['tgl'], row['jam'], row['nama']))

def jackson_agenda(data, year):
    text = plain(data)
    dates = re.findall(r'August (\d{1,2}), ' + str(year), text)
    if len(dates) < 2:
        raise ValueError('Official Jackson Hole dates unavailable')
    start, end = int(dates[0]), int(dates[1])
    if not 1 <= start <= end <= 31:
        raise ValueError('Invalid symposium dates')
    return {'name': 'Jackson Hole Economic Symposium', 'start': f'{year}-08-{start:02}', 'end': f'{year}-08-{end:02}', 'source': JACKSON + str(year) + '/'}

def main():
    path=ROOT/'fomc.json'
    data=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'meetings':[],'probabilities':[]}
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    try:
        official=download(FED)
        data['meetings']=meetings(official);data['scheduleStatus']='ok';data['scheduleCheckedAt']=now
        releases=sorted(set(re.findall(r'/newsevents/pressreleases/monetary(\d{8})a.htm',official)))
        release=next((date for date in reversed(releases) if date<=now[:10].replace('-','')),None)
        if release:
            url='https://www.federalreserve.gov/newsevents/pressreleases/monetary'+release+'a.htm'
            try:
                data['currentTarget']={**target_rate(download(url)), 'asOf':dt.datetime.strptime(release,'%Y%m%d').date().isoformat(),'url':url}
            except Exception as error:print('Fed target range:',error)
    except Exception as error:
        data['scheduleStatus']='stale' if data.get('meetings') else 'unavailable';print('FOMC schedule:',error)
    for name,url,parser in [('CME FedWatch via Beansprout',BEANS,beans_probability),('Investing.com Fed Rate Monitor',MONITOR,investing_probability)]:
        old=next((row for row in data['probabilities'] if row['url']==url),{})
        try:row={**parser(download(url)),'status':'ok'}
        except Exception as error:
            row={**old,'status':'stale' if old.get('distribution') else 'unavailable'};print(name,error)
        row.update(name=name,url=url,checkedAt=now)
        data['probabilities']=[value for value in data['probabilities'] if value['url']!=url]+[row]
    data.update(version=1,checkedAt=now,scheduleSource=FED)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    path=ROOT/'kalender.json'
    cached=json.loads(path.read_text(encoding='utf-8')) if path.exists() else {'items':[]}
    today = dt.datetime.now(ZoneInfo('Asia/Jakarta')).date()
    start = today.replace(day=1)
    end = (start.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)
    monthly_url = MONTHLY + start.strftime('%b.%Y').lower()
    monthly = [row for row in cached.get('items', []) if start.isoformat() <= row['tgl'] <= end.isoformat()]
    monthly_ok = False
    try:
        monthly = monthly_rows(download(monthly_url))
        monthly = [row for row in monthly if start.isoformat() <= row['tgl'] <= end.isoformat()]
        monthly_ok = True
    except Exception as error:
        print('Monthly calendar:', error)
    daily = []
    try:
        daily = [row for row in calendar_rows(download(CALENDAR)) if start.isoformat() <= row['tgl'] <= end.isoformat()]
    except Exception as error:
        print('Investing calendar:', error)
    items = merge_calendar(monthly, daily)
    cached.update(items=items, status='ok' if monthly_ok else 'stale' if items else 'unavailable', source=monthly_url,
                  coverageStart=start.isoformat(), coverageEnd=end.isoformat())
    if monthly_ok:
        cached['updated'] = now
    for year in [today.year, today.year + 1]:
        try:
            agenda = jackson_agenda(download(JACKSON + str(year) + '/'), year)
            cached['agenda'] = [row for row in cached.get('agenda', []) if row['start'][:4] != str(year)] + [agenda]
        except Exception as error:
            print('Jackson Hole', year, error)
    cached['checkedAt']=now
    path.write_text(json.dumps(cached,ensure_ascii=False,indent=1)+'\n',encoding='utf-8',newline='\n')

if __name__=='__main__':main()
