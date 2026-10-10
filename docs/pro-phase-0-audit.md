# Pro platform: Phase 0 audit

Audit date: 2026-10-10. Baseline: main `9456dfd043bf08a5095efdaa10b62b30c0a590f9`, clean working tree. Implementation branch: `feature/pro-platform`. Production was inspected read-only. No private journal rows were queried. No deployment or live billing is authorized by this task.

## Existing working features and reusable components

Static HTML, vanilla JavaScript and CSS; no frontend framework or build dependency. `index.html` is copied to route directories by the Pages workflow. Existing routes: home, journal, statistics, calculator, economic-news (calendar/social), profile, login. Reuse the application shell, native inputs, buttons, data tables, account selector patterns, local import parsers, scoped Supabase client, existing loading messages and owner-change guards.

Guest journals, backups and manual entries work locally. Authenticated journals synchronize profiles, trading_accounts, strategies and trades. Auth supports email/password, Google PKCE, reset, refresh and logout. Provider redirects cannot be verified from repository files alone. English defaults; the language audit documents 87 loaded translations and eight pending languages.

Basic statistics and calculators, document previews, PDF/image OCR, CSV/TXT parsing, news reader and regional source filters, retained headlines/images, economic calendar and BI exchange rate data exist. Baseline copy/security/discipline checks passed locally on this date. This is not proof that every external feed or OAuth configuration works.

## Design baseline

Preserve `css/style.css`, `css/home.css`, `css/journal.css`, `css/shell.css`, the header/footer markup, existing routes and handlers. Shell background #0a0c0f; panels #11141a; text #e8eaee; muted #a3abb8; borders #1d222b/#2a303b. Existing IBM Plex Sans / Bricolage / Mono typography and native horizontal navigation remain authoritative. UI/UX Pro Max was read from the installed `.agents/skills` directory and is scoped to additions only.

## Verified Supabase project and schema

Project `nmddjuqkdyhcobddinkc`, name **journaltrading**, ACTIVE_HEALTHY, PostgreSQL 17.11, ap-southeast-1. No JOKI.IN resources were accessed.

Existing public tables: profiles (timezone/base currency/nickname), trading_accounts (NUMERIC initial balance/currency), strategies, trades (NUMERIC prices, quantity, fees, PnL, risk and R ratios, UTC timestamps, notes/tags). Private table: journal_private.account_access with plan and upload counter. All five tables have RLS. Public owner policies cover SELECT/INSERT/UPDATE/DELETE; trade INSERT/UPDATE additionally check ownership of related accounts/strategies. The private plan table has no browser grants or policies, intentionally denying direct access.

Five live migrations exist (core, auth trigger hardening, plan quota/nickname, two Pro RPC variants); repository migration history is incomplete. Two overloads of journal_pro_analytics enforce auth.uid(), plan=pro and owner filtering. They do not check subscription expiration. There are no Storage buckets. One Edge Function exists: founder-account-setup. It is not a payment or AI service.

## Missing features and required changes

| Area | Current gap | Addition required |
|---|---|---|
| Subscriptions | Private static plan; no billing period/status/expiry | Server-authoritative subscription lifecycle, explicit migration of existing grants, verified provider adapter and reconciliation |
| Navigation | Five simple Pro report buttons, no feature URLs; hook hidden for guests | Exact ten Pro routes, disabled Free/Plus hook, fail-closed effective entitlement |
| Imports | Counter charged before parsing, fixed 12h window; browser persists import | Atomic successful-import confirmation, rolling 12h history and idempotency, private upload jobs |
| Analytics | Small grouped tables; legacy manual trades often have null cloud PnL | Deterministic metrics, account/date/timezone filters, explicit unknown-value handling; no invented contract sizes |
| Pro data | No executions, risk rules, review history or report jobs | Add owned records and private worker-controlled job state, reuse trades/strategies/accounts |
| AI | No Python runtime, models, jobs or quotas | FastAPI gateway, durable Postgres jobs, local inference worker, shared transactional monthly reservations |
| PDF | No private report persistence or generator | Real PDF generation, private storage, signed authorized download, fair-use concurrency/retention |
| News/calendar | Static public JSON with browser gates | Authorized gateway and country policy; deployment must stop publishing protected artifacts to enforce paywall |
| Market | TradingView embeds only | Independently licensed OHLC/macro/news inputs with freshness and symbol validation |

## Security findings

1. Public static news files can bypass the existing browser paywall. Removing/restricting those production artifacts changes current delivery behavior and requires the requested production approval. New gateway access must enforce countries independently.
2. Static Pro grants never expire. Existing grants must not silently become paid subscriptions. New effective entitlement fails closed until a verified active subscription exists.
3. Import allowance currently charges failed parses and resets from first upload, rather than a rolling successful-import window.
4. Supabase advisors warn about the two intentional authenticated SECURITY DEFINER Pro RPCs and disabled leaked-password protection. RPCs have identity/plan/owner checks but require an expiration check. Private account_access RLS/no-policy is an intentional deny-all design, not an ownership leak.
5. Existing public tables carry broad anon grants although RLS denies rows. Prefer least privilege in new tables; avoid changing existing grants without regression evidence.
6. Model/news/document output is untrusted. It must never supply SQL, HTML, shell operations or privileged authorization. Provider URLs must be server allowlisted.

Advisor references: [definer RPC review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [private deny-all policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## External dependencies and honest blockers

GitHub Pages cannot run persistent Python inference or workers. No Docker, psql, FastAPI, uvicorn, httpx or psycopg executable/package was found in the initial local runtime probe; bundled Python includes pandas, NumPy, Pydantic and ReportLab. Isolated local dependencies can be installed without changing frontend dependencies. There is no configured payment provider, local LLM/model/license decision, inference hardware benchmark, licensed machine-readable market provider, private report bucket or production Python host. These are deployment/integration blockers, not reasons to fabricate success.

## Phase report

Status: **Completed and Tested** for read-only repository/schema audit and three baseline checks; OAuth/feed/runtime integration verification remains **Blocked** pending infrastructure. Files changed: this report and implementation plan only. Database migrations/RLS changes: none applied. API/frontend/AI changes: none in this phase. Tests executed/passed: copy, security, discipline (3/3); failed: 0. Performance: no load benchmark yet. Deployment: unchanged. Next: additive local schema/API/entitlement slice, then feature pages and durable worker tests.
