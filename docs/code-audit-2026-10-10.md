# Code audit — 10 October 2026

## Decision

**Needs work before production.** The local implementation passes the checks below, but the hosted Pro platform, inference model, billing and protected data delivery are not operationally verified. No production migration, billing activation or deployment was performed during this audit.

## Repository checkpoint and scope

Repository: `Jokitugasbykay/Journaling_trade.github.io`; branch: `feature/pro-platform`.
The requested pre-audit checkpoint was pushed as `a8a0415` (Add Pro platform and fix account switching and shell spacing), after rebasing on `origin/main`.

Reviewed application-owned frontend, authentication/account switching, Pro gateway and workers, financial calculations, feed/calendar collectors, SQL authorization and quota migrations, deployment workflows and dependency declarations. Generated news content and bundled vendor code were checked through validation/integrity and dependency checks rather than a line-by-line manual review. This report does not assert the absence of every bug.

## Reproduced and fixed

| Priority | Finding | Location | Fix and evidence |
| --- | --- | --- | --- |
| P1 | UTF-16 XML bypassed byte-based DTD rejection; the parser accepted entity-bearing documents. | `scripts/update_news.py`, `scripts/audit_news.py` | Shared native XML parser rejects DTDs at the parser callback regardless of encoding. UTF-8/UTF-16 rejection checks and ordinary UTF-16 feed parsing pass in `scripts/test_news.py`. |
| P2 | Later profits erased earlier daily/weekly loss violations; final daily trade count was attributed to earlier trades. Missing risk values were included in compliance checks. | `services/pro_api/analytics.py:risk_analysis` | Evaluate cumulative loss/count at each chronological trade and skip unavailable observations. Loss -200 followed by +250 still records the threshold-100 breach. Regression test passes. |
| P2 | Calendar filtering used the source date before timezone conversion. Numeric zero previous/forecast/actual values became missing. | `services/pro_api/app.py:/api/v1/economic-calendar` | Filter by the selected timezone's local date and preserve zero. Jakarta October 2 00:30 appears on New York October 1. Regression test passes. |
| P2 | Previous-period review used the current period's opening balance, distorting comparative equity/drawdown percentages. | `services/pro_api/worker.py`, `services/pro_api/analytics.py:review` | Pass the previous dataset's own opening balance. A 100 loss against 1000 reports 10% even when the current opening balance is 1200. Regression test passes. |

Removed unused imports (`struct`, `field_validator`) and an unused risk local after checking references. No broad refactor or feature deletion was made. Risk evaluation now avoids repeatedly summing whole periods for each trade.

## Open findings and release blockers

| Priority | Finding | Evidence/location | Required action |
| --- | --- | --- | --- |
| P1 | Pro gateway is not connected to the hosted frontend; hosted additive migrations and worker runtime have not been deployed. | `js/pro-config.js:3` has empty `apiBase`; `docs/PRO_PHASE_REPORTS.md` documents deployment requirements. | Deploy and verify the correct Trading Journal gateway, migrations and worker, then configure the API base and run authenticated live acceptance tests. Current missing backend fails closed. |
| P1 | Static news/calendar artifacts bypass paid API authorization. | `.github/workflows/update-news.yml:64` copies `berita.json`, `kalender.json`; lines 67–68 publish source/category/archive datasets. | Once the gateway is ready, serve paid datasets through authorized delivery and exclude protected artifacts from the public build. Browser navigation restrictions alone cannot protect public files. Preserve intentionally public Free content explicitly. |
| P1 | Real AI inference, market provider integration and live subscription lifecycle are unverified/missing. | `docs/pro-backend.md`, `docs/PRO_PHASE_REPORTS.md`; API transport tests use fixtures. | Provide a working commercially permitted local model, benchmark hardware, authorized market data and a verified payment provider/webhook adapter. Do not mark mocked/provider-unavailable tests as production success. |
| P2 | Legacy Free imports consume usage before parsing and successful persistence. Failed parsing can therefore consume the allowance. | `js/app.js:1558`, legacy `refreshAccountAccess(true)` path when the new API is absent. | Switch to the tested server reservation/completion import flow after gateway deployment; retain abuse limits and idempotency. Do not count failed imports as successful. |
| P2 | Cloud journal hydration/sync reduces timestamps to minute precision. | `js/app.js:396` formats opening time as hour/minute; cloud sync reconstructs `opened_at` with `tradeTimestamp` (around line 247). | Preserve original UTC opening/closing timestamps across unchanged records; invalidate preserved values only when the user edits them. Add a round-trip test with seconds and exit times before changing this shared flow. |
| P2 | PDF default fonts do not preserve non-Latin text. | `services/pro_api/reports.py:14` uses default ReportLab styles. Reproduction: generated period `策略分析` is absent from extracted PDF text. | Bundle appropriately licensed Unicode fonts and implement script/RTL shaping where needed; verify rendered multilingual reports. Latin PDF creation and escaping are tested. |
| P2 | Official-language coverage is incomplete and new Pro copy can fall back to English. | Locale audit reports 87 enabled packs, 8 unavailable entries: `bzw`, `kck`, `khi`, `nd`, `ndc`, `nmq`, `rm`, `toi`. | Complete supported translations and review new Pro controls with native-language checks. Structural token tests do not prove translation quality. |
| P2 | Supabase leaked-password protection is disabled. | Read-only security advisor for Trading Journal project `nmddjuqkdyhcobddinkc`. | Enable the Auth protection through the appropriate project configuration and verify signup/password-change behavior. |

### Hosted authorization review

Read-only checks confirmed both requested Founder identities have confirmed, unbanned accounts and legacy Pro access. `journal_access(false)` passed for both under authenticated identities in rolled-back transactions. No identity/password or production records were altered. Real interactive OAuth/password login with those accounts was not performed.

The advisor flags existing authenticated SECURITY DEFINER analytics wrappers. Their inspected definitions check `auth.uid()`, enforce legacy Pro and filter owned rows, with an empty search path; no cross-user bypass was demonstrated. The additive migration replaces the public wrappers with invoker wrappers but is not deployed. Private `account_access` has RLS with no client policy: intentional direct-access denial, not an open-table finding.

## Verification performed

| Check | Actual outcome | Limit |
| --- | --- | --- |
| All 17 `js/*.test.cjs` suites | Passed | Automated current repository tests, not a guarantee of every UI flow. |
| Syntax checks for root `js/*.js` | Passed | Syntax only. |
| Required copy/security/discipline suites after fixes | Passed | Local checks. |
| Backend unittest discovery with isolated native PostgreSQL | **14/14 passed, no skips** | Includes real concurrent database reservations with one quota unit left; HTTP upstreams in API contract tests are simulated. Local PostgreSQL was stopped afterward. |
| `supabase/test_platform.cjs` | Passed | Local PGlite migration/RLS/quota/expiry/webhook/import checks, not hosted migration activation. |
| `tests/frontend-pro.cjs` | Passed | Desktop/mobile pages and controls with fixture transport, not live AI/billing/market proof. |
| Existing shell/account-switch regression checks | Passed | Simulated guest/local/cloud and account transitions; no private account credentials used. |
| `scripts/test_news.py` | Passed after XML hardening | Parser, URLs, archive retention, publisher registry and malicious feed regression cases. |
| `scripts/test_macro.py` | Passed | Parser/static input checks. |
| `scripts/test_news_delivery.py` | Passed after hardening | Delivery/deduplication/archive checks. |
| `scripts/audit_news.py --self-test` | Passed after hardening | No claim every remote feed is continuously available. |
| `scripts/audit-locales.cjs` | Passed | 1070-key structural/token consistency across 87 packs; 8 unavailable languages remain. |
| Secret-pattern scan before checkpoint push | No candidate found | Working-tree scan; not an exhaustive historical secret audit. Public publishable keys are not privileged credentials. |
| npm dependency audit | 0 known advisories | Scratch dependency graph matching inspected Supabase/PDF.js/Tesseract vendor versions; frontend has no repository npm lock. |
| pip-audit of declared Pro requirements | 0 known advisories | Resolved Python dependency graph at audit time; no claim of zero unknown vulnerabilities. |
| Bandit | Raw scan: 0 high, 6 medium, 11 low across 2517 lines | Flags were triaged; they are not 17 proven vulnerabilities. |
| `git diff --check` | Passed | Whitespace validation. |

Bandit XML findings led to the encoding-safe DTD fix above. Other URL-opener findings involve configured publisher/official-source collector inputs, not a demonstrated public user-controlled SSRF endpoint. Test-only assertions are not authorization checks. Optional image enrichment intentionally tolerates failures while preserving feed headlines. Raw scan artifacts and dependency audit outputs are stored in the scratch workspace, not committed as product dependencies.

## Deployment and next actions

Audit fixes are small local changes with regression checks; no production deployment was authorized or performed. Before launch, prioritize protected Pro delivery and hosted authorization, verified billing lifecycle, real local AI/model/provider acceptance, then import compatibility, timestamp fidelity and multilingual PDF coverage. Use the documented environment setup and rollback procedures; apply no destructive schema reset.
