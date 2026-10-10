"""Opt-in live test with two disposable users; credentials stay outside the repository.

Provision a temporary Pro user and Free user, then supply their credential JSON
through JT_PRO_SMOKE_CREDENTIALS. Remove those exact test users after the run.
Never point this check at customer accounts.
"""
import json
import os
import time
from pathlib import Path
from uuid import uuid4
import httpx

PROJECT = 'https://nmddjuqkdyhcobddinkc.supabase.co'
KEY = 'sb_publishable_8MdtL4bDt-4dn2gh5-M8hg_TjDEGATj'
ORIGIN = 'https://jokitugasbykay.github.io'


def main():
    users = json.loads(Path(os.environ['JT_PRO_SMOKE_CREDENTIALS']).read_text())
    assert len(users) == 2 and all(user['email'].startswith('pro-smoke-') and user['email'].endswith('@example.invalid') for user in users)
    with httpx.Client(timeout=30) as client:
        tokens = []
        for user in users:
            response = client.post(PROJECT + '/auth/v1/token?grant_type=password', headers={'apikey': KEY}, json={'email': user['email'], 'password': user['password']})
            assert response.status_code == 200, 'Disposable test login failed: ' + str(response.status_code)
            tokens.append(response.json()['access_token'])

        def gateway(path, method='GET', body=None, owner=0, expected=200, key=None):
            response = client.request(method, PROJECT + '/functions/v1/pro-gateway/api/v1' + path,
                                      headers={'Authorization': 'Bearer ' + tokens[owner], 'Origin': ORIGIN, 'Idempotency-Key': key or str(uuid4())}, json=body)
            assert response.status_code == expected, path + ': ' + str(response.status_code) + ' ' + response.text[:400]
            return response.json() if response.content else None

        assert gateway('/entitlements')['plan'] == 'pro'
        assert gateway('/entitlements', owner=1)['plan'] == 'free'
        gateway('/analytics/overview', owner=1, expected=403)
        account_id = str(uuid4())
        headers = {'apikey': KEY, 'Authorization': 'Bearer ' + tokens[0]}
        response = client.post(PROJECT + '/rest/v1/trading_accounts', headers=headers, json={'id': account_id, 'user_id': users[0]['id'], 'name': 'Disposable smoke account', 'initial_balance': 100})
        assert response.status_code == 201
        strategy = gateway('/strategies', 'POST', {'name': 'Disposable strategy', 'description': 'Smoke test'}, expected=201)
        for index, pnl in enumerate([20, -10]):
            response = client.post(PROJECT + '/rest/v1/trades', headers=headers, json={'user_id': users[0]['id'], 'account_id': account_id, 'strategy_id': strategy['id'], 'symbol': 'EURUSD', 'side': 'long', 'pnl': pnl, 'risk_percent': 1 if index == 0 else 3, 'entry_price': 10, 'stop_loss': 9, 'take_profit': 12, 'closed_at': f'2026-10-0{index + 1}T12:00:00Z'})
            assert response.status_code == 201
        metric = gateway('/analytics/overview')['metrics']
        assert metric['expectancy'] == 5 and metric['profit_factor'] == 2 and metric['win_rate'] == 50
        assert len(gateway('/analytics/heatmap?year=2026')['days']) == 365
        assert gateway('/risk/calculate', 'POST', {'balance': 1000, 'risk_percent': 1, 'entry': 10, 'stop': 9, 'contract_size': 1, 'quantity_step': 0.1, 'quote_to_account_rate': 1})['quantity'] == 10
        rule = gateway('/risk/rules', 'POST', {'name': 'Smoke rule', 'kind': 'max_risk_percent', 'threshold': 2}, expected=201)
        assert len(gateway('/analytics/risk')['violations']) == 1
        review = gateway('/reviews', 'POST', {'period': 'monthly', 'start': '2026-10-01'}, expected=202)
        assert review['state'] == 'succeeded' and len(gateway('/reviews')['items']) == 1
        assert gateway('/market/preference') == {}
        assert gateway('/market/preference', 'PUT', {'trading_style': 'INTRADAY'})['trading_style'] == 'INTRADAY'
        gateway('/ai/chat', 'POST', {'message': 'Disposable probe'}, expected=503)
        assert gateway('/entitlements')['ai']['remaining'] == 30
        assert gateway('/ai/chat/history')['items'] == []
        config = {'sections': ['analytics', 'heatmap', 'risk', 'reviews']}
        assert gateway('/reports/preview', 'POST', config)['analytics']['metrics']['trade_count'] == 2
        key = str(uuid4())
        report = gateway('/reports', 'POST', config, expected=202, key=key)
        assert gateway('/reports', 'POST', config, expected=202, key=key)['id'] == report['id']
        for _ in range(20):
            result = gateway('/reports/' + report['id'])
            if result['state'] not in ('queued', 'running'):
                break
            time.sleep(1)
        assert result['state'] == 'succeeded', 'Report worker failed: ' + str(result.get('error'))
        gateway('/reports/' + report['id'], owner=1, expected=403)
        signed = gateway('/reports/' + report['id'] + '/download')['url']
        download = client.get(signed)
        assert download.status_code == 200 and download.content.startswith(b'%PDF-')
        assert gateway('/news/filters')['countries']
        assert isinstance(gateway('/news?limit=2')['items'], list)
        gateway('/risk/rules/' + rule['id'], 'DELETE', expected=204)
        gateway('/strategies/' + strategy['id'], 'DELETE', expected=204)
        gateway('/reports/' + report['id'], 'DELETE', expected=204)
        print('Live login, Free/Pro authorization, metrics, heatmap, risk, review, style, quota protection, private PDF storage/download, news and CRUD checks passed.')


if __name__ == '__main__':
    main()
