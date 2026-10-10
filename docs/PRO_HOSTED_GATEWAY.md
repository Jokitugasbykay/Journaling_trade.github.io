# Hosted Pro backend — 2026-10-10

Approved installation uses only journaltrading (`nmddjuqkdyhcobddinkc`). Existing journal records and website styles are preserved. Public API configuration is in `js/pro-config.js`; no privileged credentials are shipped to browsers.

## Deployed components

- Migrations: `20261010003143_pro_platform.sql`, `20261010115426_kaystrade_intelligence.sql`, `20261010155806_pro_hosted_gateway.sql`. Existing Founder authorization is retained and checked against confirmed identity on the server.
- Edge Function: `supabase/functions/pro-gateway/index.ts`, with `report.ts` for real PDF generation. Gateway URL: `https://nmddjuqkdyhcobddinkc.supabase.co/functions/v1/pro-gateway`.
- Authentication: each request validates its Bearer token with Supabase Auth before checking server entitlements. Owner reads/writes retain the user's JWT and RLS. Service-role operations are limited to report leases, recovery, storage, and completion. The platform JWT switch is disabled because current Auth JWTs are validated inside the function, not trusted without validation.
- Every endpoint has bounded requests, exact site CORS, an authenticated 120-per-minute limit, and safe errors. Existing database report limits/idempotency remain authoritative. Failed/missing inference never creates a quota reservation.
- Core journal/import/calendar delivery retains its existing integration. `apiBase` enables the new Pro service; the separate `journalApiBase` compatibility flag remains empty so unsupported core endpoints are not redirected to this Edge Function.

## Endpoint coverage

Paths below are relative to `/api/v1`.

| Endpoints | Live implementation |
|---|---|
| GET entitlements | Free, paid subscription and verified Founder; actual shared quota |
| GET accounts, strategies; POST/PATCH/DELETE strategies | Owned persisted records |
| GET analytics/overview, analytics/heatmap, analytics/strategies | SQL numeric calculations on eligible saved closed trades |
| GET analytics/risk; POST risk/calculate; GET/POST/PATCH/DELETE risk/rules | Actual observations, explicit contract inputs, owned risk rules |
| GET/POST reviews | Persisted deterministic weekly/monthly reviews and period comparisons |
| POST reports/preview; GET/POST reports; GET/DELETE reports/{id}; GET reports/{id}/download; POST reports/{id}/retry | Real PDF, durable job record, private bucket, signed 60-second URL, exact owned file deletion |
| GET news, news/filters | Existing publisher feed, attribution, country/region filters and deduplication; original source links |
| GET/PUT market/preference; PUT market/notification-preference | Authenticated private preferences |
| GET ai/history, ai/chat/history, ai/jobs/{id}, market/signals, market/alerts, market/notifications | Owned persisted history; absence is an empty result |
| GET market/instruments, ai/engine | Truthful unavailable-feed/runtime states |
| POST AI submissions and unsupported live market operations | Explicit 503; no credit consumed |

`news-regions.json` is copied from the existing Python regional catalog by the Pages build. No duplicated catalog is maintained.

## Metrics and ceilings

Net PnL respects recorded net/gross flags and explicit fees; unknown PnL is excluded and reported. Expectancy = net PnL / eligible closed trade count. Profit factor = positive PnL / absolute negative PnL, null when there are no losses. Win rate = wins / all eligible closed trades × 100, including breakeven trades in this journal metric. Drawdown is the largest peak-to-subsequent-equity decline. Structural RR requires valid recorded entry, stop and target. Mixed currencies require explicit compatible data and are rejected instead of guessed conversion. Calendar aggregation uses user timezone; session classification uses DST-aware exchange timezones.

Account currency/starting balance and date filters remain explicit. Trade execution reconstruction and missing contract metadata are not guessed. Results describe the eligible recorded dataset, not broker-verified execution performance. User-owned history lists currently return at most 1,000 records; SQL analytics aggregate all eligible owned trades.

PDFs have basic monochrome tables and pagination. Built-in PDF fonts replace unsupported glyphs with `?`; embed a licensed Unicode font before requiring full multilingual exports. Download retention is enforced at 30 days; automatic physical retention cleanup is not yet scheduled. Explicit report deletion removes the object. Existing job recovery runs when report operations occur; this is not a continuously running worker.

## Executed checks

- Native local PostgreSQL transaction tests: platform, intelligence, Founder access, RLS and gateway checks.
- Python: 52 tests passed, including the actual two-connection race for one remaining quota unit. Provider/model unit fixtures do not prove production inference.
- Deno gateway contract tests passed; actual PDF bytes parsed. Inputs, ownership filters, Free denial, unavailable-AI quota safety, report deletion and news filtering covered.
- Mandatory copy, security and discipline checks passed; Pro, imports, journal, news loading/auth and locale audit checked.
- Browser transport tests: all eleven internal sections at desktop/mobile widths; provider responses were explicit fixtures.
- Real hosted tests used two disposable password-login identities: Free denial, persisted trades/strategies/rules, exact metrics, heatmap, review, style, quota safety, private PDF signed download, news and deletion all passed (`scripts/smoke_pro_gateway.py`).
- `scripts/smoke_pro_browser.cjs` passed against the deployed website with real login and backend requests: Pro navigation, deterministic internal sections, saved AI history, Free direct-route denial and mobile overflow. First-profile setup exposed a missing entitlement refresh, repaired in `saveNickname()` and covered by the security regression check. Only disposable test records/objects are removed.
- Both actual confirmed Founder identities were checked server-side. An empty account returns empty analytics; unknown PnL is not fabricated.

## AI and remaining release gates

Ollama is running privately on this workstation. Qwen3:0.6b was downloaded and verified against digest `7df6b6e09427a769808717c0a93cadc4ae99ed4eb8bf5ca557c90846becea435`; three real structured explanation probes passed, maximum 5.317 seconds. A real local educational chat reply also passed its output/digest check. These prove local startup/schema output only, not public AI integration, financial forecasting quality or production capacity. The [official model license](https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/LICENSE) is Apache 2.0.

**Blocked:** public persistent Python worker/runtime, authorized backend OHLCV and fundamental feeds, live AI chat/analysis end-to-end, continuous signal monitoring, push/email delivery, calibrated probabilities and live billing. GitHub Pages and Supabase Edge Functions cannot run the persistent Python/Ollama process. Local runtime does not make the public website AI operational. Existing Python implementation/tests remain available for that host; no commercial inference service is substituted.

Security advisor: protected private tables and fundamental ingestion intentionally have RLS with no direct client policy. Existing Auth leaked-password protection remains disabled; see [Supabase password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No authorization exposure was introduced to resolve the advisor message.

Recovery: clear `apiBase` to disconnect Pro endpoints while retaining the existing journal. Preserve the tables/objects and roll forward reviewed functions; do not reset databases. Re-deploy the exact committed Edge Function source after reviewing migrations; never deploy the isolated test bootstrap.
