# Backtest session correction — 26 October 2026

## Root cause

The browser engine generated multi-year OHLC from hard-coded price waypoints and pseudorandom structure. Timestamps advanced continuously, including closed weekends. Period/timeframe labels therefore did not establish real historical coverage. The caller replaced supplied bars for long-period runs.

## Change

- Remove that generator from the backtest engine entirely. Use supplied closed OHLC only, validate values, sort/deduplicate timestamps, and reject demo-marked bars and known proxy-symbol mismatches.
- Do not apply the former arbitrary minimum Gold price of 3500 or invented all-time-high floor.
- Filter the regular market session before indicators/execution. Also check the signal candle close when deciding the entry timestamp.
- Calendar uses Intl exchange timezones, including DST. Reference: https://www.oanda.com/uk-en/trading/hours-of-operation/ (checked 2026-10-26).
- FX reference: New York Sunday 17:05 through Friday 16:59 with the daily 16:59–17:05 break. Metals: New York Sunday 18:05 through Friday 16:59 with the daily 16:59–18:05 break. Supported oil/index references follow the listed OANDA hours. This is an explicit regular-session reference, not a claim about every broker.
- Crypto USDT/USDC and supported USD crypto pairs, including PAXG, retain 24/7 eligibility.
- Preserve valid Saturday-early-morning WIB trades that still belong to Friday's New York session. Reject the Saturday afternoon and Sunday afternoon entries shown in the screenshot.
- Unknown calendars fail clearly instead of assuming availability. Holiday/exception calendars remain unavailable and are disclosed.
- Modal shows actual data coverage and Backtest parsial. It does not assert verified H4, TradingView speedometer, FastBull or macro evidence. Missing/synthetic/mismatched history shows an unavailable explanation, clears metrics, and disables report copy.
- Switching instrument/timeframe never reuses the original selection's bars under a new label.

## Limits

This remains a partial technical simulation, not a complete validated Kaystrade model. Provider history acquisition for long periods, full broker holiday schedules, spread/slippage assumptions, multi-timeframe/fundamental historical inputs and intrabar fill ordering require additional work. Other live-chart demo fallbacks remain outside this fix; the backtest now rejects their tagged data. Existing historical backtest screens/results from the prior generator must not be treated as verified performance.

## Verification

- node tests/backtest-calendar.cjs: screenshot closed-session regression, valid Saturday WIB overlap, summer/winter DST, daily breaks, FX/Gold differences, crypto weekends, unknown calendars, missing/synthetic/proxy/future data, and session checks on generated fixture trades.
- node tests/backtest.test.cjs: explicit fixture-history engine, valid partial modal state, missing-feed state and disabled copy, instrument-switch isolation, strategy modal and closing.
- node js/copy.test.cjs; node js/security.test.cjs; node js/discipline.test.cjs; node --check js/pro.js.

No production deployment or Git push was performed in this fix.
