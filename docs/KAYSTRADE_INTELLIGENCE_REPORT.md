# Kaystrade intelligence revision — 2026-10-10

## Status

Implemented but Not Fully Tested end to end with real providers. Local automated checks cover authenticated API contracts, PostgreSQL authorization/quota transactions, synthetic market calculations and browser interactions. They do not prove licensed live data, local model inference or production monitoring.

No production deployment, hosted database migration, billing activation or unrelated project modification was performed. Existing shell, palette, header/footer and one Pro navigation entry are preserved.

## Implementation

- Canonical methodology: `docs/kaystrade/SKILL.md`, unchanged. Technical implementation version `kaystrade-closed-bars-v2`; synthesis version `kaystrade-fundamental-synthesis-v1` is stored alongside local model identity.
- Existing H4/H1 structure, D1 context, closed-candle breakout/retest, fresh zones, FVG, sweeps, RSI14/SMA14, ratings and Gold/DXY gates are reused. Swing additionally requires D1 alignment and H1 refinement. Intraday retains the methodology's 24-hour ceiling. Missing technical methods/data remain unavailable; RSI alone never authorizes an entry.
- Owner-specific required SCALPING/INTRADAY/SWING preferences; style changes reset displayed analysis and update timeframe defaults without charging quota. Database job insertion independently rejects absent/mismatched saved style.
- Fundamental records validate source URL, aware publication/event/expiry timestamps, verification status, affected instruments, source-stated mechanism, evidence, severity and bias. Latest revisions deduplicate by event ID. Rumors/expectations remain context, not confirmed facts.
- Independent technical/fundamental conclusions and synthesis. Conflicting or missing evidence withholds actionable levels. Both conditional scenarios remain visible; probabilities are null and explicitly Not calibrated. Structural watch levels are distinguished from confirmed recommendations. No fabricated TP2 or forecast horizon.
- Explicit take/watch/dismiss, separate actual/paper choice and manual execution confirmation. Acceptance is never a broker fill. Old analysis remains identified by its original style/instrument/version.
- Service-only snapshot monitor can run without a browser. Durable cursor, missing-bar ambiguity, expiry, closed structural invalidation and changed fundamental events; transactional alert/notification deduplication. SL/TP same-bar order is AMBIGUOUS. Actual exits cannot be assigned by OHLC monitoring.
- In-app notifications, owner read state/preferences and permission-requested browser notifications while workspace is open. Web Push and email delivery are not operational.
- Paper outcomes and actual confirmations remain separate. Watch-only/open/ambiguous/unverified outcomes are excluded from winrate; breakeven excluded from its denominator. Actual PnL, actual winrate and drawdown remain unavailable pending verified execution reconciliation.

## Files and database

Backend: `services/pro_api/intelligence.py`, `signals.py`, `kaystrade.py`, `market.py`, `models.py`, `app.py`, `worker.py`, `ai.py`, `store.py`.
Frontend: `js/pro.js`. Runtime: `infra/pro-compose.yml`. CI: `.github/workflows/pro-tests.yml`.
Additive migration: `supabase/migrations/20261010115426_kaystrade_intelligence.sql`.
New owner-read tables: market_preferences, market_signals, signal_alerts, signal_notifications. Fundamental events are service-only. Protected mutation RPCs verify authenticated owner and active Pro; monitor RPC is service-only. Existing tables/data are not reset.
Tests: `tests/pro/test_intelligence.py`, `test_kaystrade.py`, `test_market_pipeline.py`, `test_platform.py`, `tests/frontend-pro.cjs`, `supabase/test_intelligence.sql`, `supabase/test_platform.cjs`.

## API additions

All client endpoints require authenticated active Pro and owned records:

- GET/PUT `/api/v1/market/preference`
- PUT `/api/v1/market/notification-preference`
- GET/POST `/api/v1/market/signals`
- POST `/api/v1/market/signals/{id}/execution`
- GET `/api/v1/market/alerts`; PATCH `/api/v1/market/alerts/{id}`
- GET `/api/v1/market/notifications`; POST `/api/v1/market/notifications/{id}/read`
- GET `/api/v1/market/performance`

Existing market context, analysis submission, retries and history retain their routes and shared successful-analysis quota.

## Checks and their limits

49 Python checks passed with native PostgreSQL quota concurrency enabled. PostgreSQL schema/RLS/intelligence rollback checks and PGlite fresh migration checks passed. Desktop/mobile browser integration passed with synthetic upstream data and permission fixtures. These are automated contracts and calculations, not real-provider or real-inference acceptance.

## Remaining blockers / incomplete acceptance

- Authorized OHLCV, DXY, TradingView Technicals, verified economic/Fed/news producer, rights, credentials and update limits. Snapshot ingestion is not real-time monitoring; current UI says fundamental monitoring unavailable/snapshot-only.
- Self-hosted Python gateway/worker/monitor host and HTTPS setup, configured frontend API base, installed commercially permitted local model, digest/license and benchmark. No real authenticated end-to-end inference has completed.
- Approved application of hosted journaltrading migrations and deployment. GitHub Pages cannot run these services.
- Calibrated probability model: Not Started; no validated percentages, reinforcement-learning or forecast claims.
- Web Push service worker/subscriptions/backend delivery and compatibility: Not Started. Optional email provider unconfigured. Native notifications are limited to an open workspace.
- Actual execution reconciliation, verified closes and currency/contract/cost-aware realized performance: Blocked pending authoritative execution source. No forged outcomes are accepted.
- TP2 only when the methodology and real structure support it. Tick granularity required for precise fill ordering; OHLC ambiguity is retained.
- Historical backtesting was not requested or run. Existing static public news artifacts cannot enforce a server paywall until delivery is migrated.

## Next actions

Configure authorized data and private runtime, validate real output end to end, obtain deployment approval, then run hosted multi-user RLS/storage and provider delivery checks. Do not mark continuous monitoring, push, calibrated probability or AI operational before that evidence exists.

Final regression: all 17 JavaScript test suites passed; desktop/mobile browser fixtures passed again; fresh PGlite migrations/RLS/quota checks passed again. No failing automated checks remain. Native local PostgreSQL security/intelligence rollback checks passed. Security: owner-only writes through protected RPCs, service-only monitor/outcomes, actual outcome forgery blocked; hosted-project verification remains outstanding. Performance: no real host/model/load benchmark was completed; monitor polling is bounded/configurable and closed-bar precision limitations are explicit. A dependency deprecation warning appeared in the test client; it did not fail checks.

## Founder entitlement follow-up — 2026-10-10

Both verified Founder identities in the existing allowlist now receive a server-derived, non-expiring Pro entitlement. The check reads verified `auth.users.email` in a private SECURITY DEFINER helper; editable user metadata is not trusted. The legacy upload access RPC also returns Pro and no Free quota for these identities. `journal_founder_entitlements()` is owner-scoped via `auth.uid()` and granted only to authenticated users. The migration was applied to the existing journaltrading project; read-only catalog check and rollback-scoped authenticated RPC checks confirmed both Founder accounts return `plan=pro`. Unverified matches and ordinary users are covered by rollback tests.

The browser now reads that authenticated Supabase entitlement when no Python gateway URL is configured, so Founder Pro navigation is unlocked. The Python Pro gateway is still not configured on GitHub Pages; feature requests that require it continue to report unavailable, and this change does not claim the Pro AI/data services are running.
