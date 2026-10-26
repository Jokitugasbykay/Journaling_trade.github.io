# Code cleanup — 2026-10-26

## Implemented locally

- Keep root `index.html` as the only HTML source. Remove 18 identical tracked route documents (2,468,340 bytes).
- Build assets and all routes with `python scripts/build_site.py`, using the existing route generator internally. Local development and Pages use the same builder; source directories cannot be overwritten.
- Remove the duplicate route-generation workflow that committed generated files to the source branch. Pages still publishes all previous routes.
- Ignore generated output and route HTML; extend CI coverage to every CSS file and route-builder changes.
- Preserve the upstream payment-method list and zero-PPN checkout changes; mark the list is-open on opening and clear it on closing so the backdrop safety rule does not block real clicks.
- Add an additive migration restricting Groq usage RPCs to the authenticated owner, with an explicit service-role exception. Enforce a database counter ceiling of five.
- Add isolated SQL checks for ownership, anonymous denial, service access and quota ceiling. Include checkout SQL tests in CI.

## Verification

- Route/site build: 6 tests passed, including all 22 routes, repeated builds, source overwrite protection and missing-input handling.
- All 22 generated deep URLs returned HTTP 200; guest JavaScript and shell loaded at 1440px and 375px with external providers blocked.
- Groq quota SQL and checkout SQL: passed using isolated PGlite databases.
- Python backend: 54 tests, 53 passed, 1 skipped (requires local PostgreSQL concurrency setup).
- Copy, security, discipline, import and news authentication checks passed.
- Existing Pro frontend suite fails its blanket `innerHTML` prohibition at js/pro.test.cjs:44. Do not weaken the assertion to hide the failure.
- Browser Pro and checkout contract suites passed using explicit provider fixtures. This does not prove live AI/provider operation.
- Regular-session backtest checks and explicit missing/synthetic history rejection passed; see BACKTEST_SESSIONS.md.

## Remaining audit findings

- Groq inference still checks allowance before the provider call and consumes afterward. Counter capping does not prevent concurrent provider calls; transactional reservations and failure release remain necessary. Accounting exceptions in the gateway must not be swallowed.
- Browser live market analysis still contains synthetic OHLC fallbacks, invented missing signal levels/probabilities and incorrect FastBull attribution. The backtest now rejects tagged demo/proxy bars; the remaining live analysis paths require an evidence-only correction.
- Legacy patch workflows beyond the duplicate route workflow remain to be retired after checking their callers.
- Pro JavaScript/CSS remain large. Extract modules only after behavior coverage; no cosmetic framework migration is needed.

## Deployment

Source publication does not apply database migrations or activate AI runtimes. Apply 20261026020000_groq_usage_ownership.sql through the existing migration process after review. Existing database records are preserved. The shifted news schedule remains best-effort and does not guarantee a precise ten-minute interval.
