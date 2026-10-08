import datetime as dt
from update_macro import meetings, beans_probability, investing_probability, calendar_rows, validate_probability, target_rate, monthly_rows, merge_calendar, jackson_agenda

schedule = meetings('2026 FOMC Meetings<div class="fomc-meeting__month"><strong>October</strong></div><div class="fomc-meeting__date">27-28</div><div class="fomc-meeting__month"><strong>December</strong></div><div class="fomc-meeting__date">8-9*</div>')
assert schedule[0]['decisionAt'] == '2026-10-28T18:00:00+00:00'
assert schedule[1]['decisionAt'] == '2026-12-09T19:00:00+00:00'
assert schedule[1]['hasProjections']
assert target_rate('The target range for the federal funds rate by 1/4 percentage point to 3-3/4 to 4 percent.') == {'lower':3.75,'upper':4}
snapshot = beans_probability('meetingDate:"2026-10-28",rateRange:[{lowerBound:3.75,upperBound:4,probability:78.2},{lowerBound:4,upperBound:4.25,probability:21.8}],lastUpdated:"2026-10-07T06:00:32.495Z"')
assert snapshot['distribution'][0]['probability'] == 78.2
monitor = investing_probability('Meeting Time: Oct 28, 2026 Target Rate Current Probability% Previous Day Previous Week 3.75 - 4.00 81.6% 78.2% 64.4% 4.00 - 4.25 18.4% 21.8% 35.6% Updated: Oct 07, 2026 09:35PM EDT')
assert monitor['asOf'] == '2026-10-08T01:35:00+00:00'
for bad in [[], [{'lower':3.75,'upper':4,'probability':101}], [{'lower':4,'upper':3.75,'probability':100}]]:
    try:
        validate_probability({**snapshot, 'distribution':bad})
        raise AssertionError('Invalid distribution accepted')
    except ValueError: pass
epoch = int(dt.datetime(2026,10,8,18,tzinfo=dt.timezone.utc).timestamp())
rows = calendar_rows(f'<tr data-event-timestamp="{epoch}"><td class="flagCur">USD</td><td class="event">CPI</td><td class="act">2.1%</td><td class="fore">2.0%</td><td class="prev">2.2%</td><td>grayFullBullishIcon grayFullBullishIcon grayFullBullishIcon</td></tr>')
assert rows[0]['tgl'] == '2026-10-09' and rows[0]['jam'] == '01:00'
assert rows[0]['dmp'] == 3 and rows[0]['akt'] == '2.1%'
print('Macro checks passed')

import json
modern = {'props': {'pageProps': {'state': {'economicCalendarStore': {'calendarEventsByDate': {'2026-10-08': [
    {'occurrenceId': 1, 'time': '2026-10-08T18:00:00Z', 'currency': 'USD', 'importance': '3', 'event': 'CPI', 'actual': '2.1%', 'forecast': '2.0%', 'previous': '2.2%'},
    {'occurrenceId': 2, 'time': '2026-10-08T18:00:00', 'currency': 'USD', 'importance': '3', 'event': 'Ambiguous time'}
]}}}}}}
rows = calendar_rows('<script id="__NEXT_DATA__" type="application/json">' + json.dumps(modern) + '</script>')
assert len(rows) == 1 and rows[0]['jam'] == '01:00' and rows[0]['tgl'] == '2026-10-09'
assert rows[0]['akt'] == '2.1%' and rows[0]['prk'] == '2.0%' and rows[0]['sbl'] == '2.2%'
print('Modern calendar timestamps and release values passed')

modern_events = modern['props']['pageProps']['state']['economicCalendarStore']['calendarEventsByDate']['2026-10-08']
modern_events[0].update(actual=0, forecast=0, previous=None)
modern_events.extend([None, {**modern_events[0], 'time': None}])
zero_rows = calendar_rows('<script id="__NEXT_DATA__">' + json.dumps(modern) + '</script>')
assert len(zero_rows) == 1 and zero_rows[0]['akt'] == '0' and zero_rows[0]['prk'] == '0' and zero_rows[0]['sbl'] == ''

event = {'id': 1, 'dateline': epoch, 'name': 'CPI m/m', 'country': 'US', 'currency': 'USD', 'impactName': 'high', 'actual': '0', 'url': '/calendar'}
zero_month = monthly_rows('days: ' + json.dumps([{'events': [None, {**event, 'dateline': None}, {**event, 'actual': 0, 'forecast': 0, 'previous': None}]}]))
assert len(zero_month) == 1 and zero_month[0]['akt'] == '0' and zero_month[0]['prk'] == '0' and zero_month[0]['sbl'] == ''
print('Numeric zero values retained; malformed calendar siblings skipped')
month = monthly_rows('days: ' + json.dumps([{'events': [event, {**event, 'id': 2, 'name': 'CPI y/y'}, {**event, 'id': 3, 'name': 'Bank holiday', 'impactName': 'holiday'}]}]))
assert len(month) == 2 and month[0]['jam'] == '01:00' and month[0]['countryCode'] == 'US'
merged = merge_calendar(month, [{**month[0], 'nama': 'CPI (MoM) (Sep)', 'akt': '2.1%'}])
assert len(merged) == 2 and any(row['akt'] == '2.1%' for row in merged)
assert jackson_agenda('Thursday, August 27, 2026 – Saturday, August 29, 2026', 2026)['end'] == '2026-08-29'
print('Monthly timezone, distinct indicators, daily updates and official symposium checks passed')
