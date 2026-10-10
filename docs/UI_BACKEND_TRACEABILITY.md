# Pro UI to backend traceability

Implementation files: `js/pro.js`, `css/pro.css`; existing shell integration is in `js/app.js` and `index.html`. Every added control inherits existing native controls, buttons and typography. The API base is a public deployment setting, not a credential. Requests carry the current Supabase session token; no browser plan or localStorage grants access.

## Common behavior and status

All feature pages require an authenticated current owner and an effective **Pro** entitlement. `open()` verifies `/api/v1/entitlements` before fetching feature data. Every backend endpoint must independently authorize the request. An expired, invalid or unavailable entitlement fails closed. `reset()` aborts outstanding work and clears data on logout/account change. A response from an earlier owner or page revision is rejected. Missing gateway configuration shows an explicit unavailable state.

`action()` disables the activated control, shows a live “Working…” state, and restores it when finished. Validation errors and non-success responses appear in an alert. User/provider text is written with `textContent`; articles, evidence and downloads require HTTPS URLs without embedded credentials. No untrusted HTML is inserted. Charts also have expandable data tables. Heatmap borders/text distinguish positive/negative/zero/no activity without relying on color.

Status for the controls below: **Implemented but Not Fully Tested**. Local unit and Chrome transport tests pass, but fixture transport tests are not evidence of deployed database, Storage, payment, authorized market feed or local model integration. Those external requirements and real API/database verification are tracked in the phase reports. No production deployment or live billing has been activated.

Test references:

- `js/pro.test.cjs`: owner/session race, token requirement, expiry, Free/Plus response, invalid entitlement, HTTP 403 clearing, URL validation, chart aggregation.
- `tests/frontend-pro.cjs`: all ten feature pages at 1440px and 375px, filters and real browser handler requests using an explicitly identified fixture server, strategy/risk mutations, report/AI workflows, chart selections, article XSS safety, runtime/overflow checks.
- Backend and database tests independently verify authorization, quota transactions, real PDF bytes and deterministic formulas; see the corresponding phase report for actual executed checks.

Additional integration controls: the existing confirmed-import action uploads the owned file with `POST /imports/files`, previews locally, then submits `POST /imports` with one stable idempotency key and polls `GET /jobs/{id}`. It requires authentication for every plan; Free successful-import allowance is enforced in the completion transaction. `js/pro-import.test.cjs`, `tests/pro/test_platform.py`, and `supabase/test_platform.sql` cover validation, ownership, duplicate processing and successful-only accounting. The existing reader/calendar use authenticated `/news` and `/economic-calendar` in configured gateway mode; `js/news-loading.test.cjs` checks that rejected protected news cannot restore public cache data. Global News selectors load the authorized catalog from `/news/filters`. Review generation now polls `/jobs/{id}` and opens saved `summary` evidence; its AI commentary requests the separate shared-quota journal analysis type `review`.

Loading behavior for every asynchronous row below: the action is disabled while running; initial page loads expose the existing status region; owner/session changes abort pending requests. Success updates the relevant data/result; failure uses the status region and does not create fabricated values. The implementation status column is the shared **Implemented but Not Fully Tested** status above until hosted integration verification is complete. API paths below are relative to `/api/v1`.

Buttons expose `data-component-id`; explicit IDs below remain stable. Generated row buttons use the feature name and label slug plus their row context. Fields have labels and native keyboard behavior. Rows sharing an action have the same implementation/test requirements.

## Shell, routes and shared filters

The rows named `PRO-NAV-*` below now refer to **internal Pro section navigation**, not top-level header links. The header has one `nav-pro` entry after Economic news. `/pro/` defaults to AI Market Intelligence; other sections use `/pro/?section=<section>`. Historical Pro routes replace their history entry with this canonical workspace route. Free/Plus retain a disabled noninteractive AI Trading hook; Founder identity alone is not entitlement proof.

| Component ID | Page / label | Frontend handler | API endpoint | Authentication / subscription | Loading / success / error | Test / status |
|---|---|---|---|---|---|---|
| nav-pro | Header / Pro | `openProWorkspace` | GET entitlements before feature requests | Auth + effective Pro | Hidden until verified; opens default market section; failure does not grant access | security test; Implemented but Not Fully Tested |
| pro-section-<section> | Internal navigation / ten sections | `open(section)` / configured `onRoute` | Corresponding section endpoints below | Auth + effective Pro, independently verified backend | Clears prior section work, opens real section in same shell; guarded error | browser ten-section test; Implemented but Not Fully Tested |
| pro-section-selector | Mobile internal selector | `open(selectedSection)` | Same section endpoints | Auth + effective Pro | Native keyboard/touch selector; no page overflow | browser 375px; Implemented but Not Fully Tested |
| pro-section-retry | Retry section | `open(currentFeature)` | Fresh entitlements + current section endpoints | Auth + Pro | Bounded session/token/fetch/body reads; replaces loading with error or real data | pro timeout unit + browser; Implemented but Not Fully Tested |

| Component ID | Page / label | Frontend handler | API endpoint | Authentication / subscription | Success and error behavior | Test reference |
|---|---|---|---|---|---|---|
| PRO-NAV-ANALYTICS | Advanced Analytics | `JTPRO.open('analytics')` | GET entitlements, accounts, strategies, analytics/overview | Auth + effective Pro | Existing shell displays real data or guarded error | pro unit + browser analytics |
| PRO-NAV-HEATMAP | Performance Heatmap | `open('heatmap')` | GET analytics/heatmap | Auth + Pro | Calendar data or error | browser heatmap |
| PRO-NAV-STRATEGIES | Strategy Comparison | `open('strategies')` | GET strategies | Auth + Pro | Owned strategies or error | browser strategies |
| PRO-NAV-RISK | Risk Intelligence | `open('risk')` | GET analytics/risk | Auth + Pro | Risk evidence or error | browser risk |
| PRO-NAV-REVIEWS | Weekly & Monthly Review | `open('reviews')` | GET reviews | Auth + Pro | Review preview/history or error | browser reviews |
| PRO-NAV-REPORTS | PDF Reports | `open('reports')` | GET reports | Auth + Pro | Owned job history or error | browser reports |
| PRO-NAV-AI-BEHAVIOUR | AI Behaviour Analysis | `open('ai-behaviour')` | GET ai/history | Auth + Pro | Saved analyses and verified allowance | browser AI behaviour |
| PRO-NAV-AI-MARKET | AI Market Intelligence | `open('ai-market')` | GET market/context, ai/history | Auth + Pro | Chart/context or explicit data unavailable | browser AI market |
| PRO-NAV-AI-JOURNAL | AI Journal Analyst | `open('ai-journal')` | GET ai/history | Auth + Pro | Owned results and verified allowance | browser AI journal |
| PRO-NAV-GLOBAL-NEWS | Global News | `open('global-news')` | GET news | Auth + Pro global access | Authorized attributed articles or empty/error | browser global news |
| pro-account | All applicable pages / Trading account | `commonFilters`, `filterValues` | Selected feature GET query `account_id` | Auth + Pro, backend owner check | Selected account data | browser filter checks |
| pro-start, pro-end | Date range | `validateFilters`, `filterValues` | Selected GET or POST `start/end` | Auth + Pro | Invalid order rejected before request | browser + backend filter tests |
| pro-timezone | Timezone | `validateFilters` | Selected GET/POST `tz` | Auth + Pro | IANA validation; backend aggregates in requested timezone | browser + backend timezone tests |
| pro-apply-filters | Apply filters | Page load callback | Corresponding feature GET, report preview POST | Auth + Pro | Refresh data; preserve inputs on error | browser all page opens/filters |
| *-view-trades / evidence rows | View related trades | `journal`, root `onJournalFilters` | Existing journal data; no extra privilege grant | Auth + owned records | Existing journal opens with account/date/instrument/strategy/date-hour/session/trade predicates | browser drill payload + root integration tests |

## Deterministic analytics and heatmap

| Component ID | Page / label | Frontend handler | API endpoint | Authentication / subscription | Validation / success / failure | Test reference |
|---|---|---|---|---|---|---|
| pro-chart-period | Analytics / Chart period | `aggregateSeries`, chart redraw | No inference or new data fetch; last recorded equity per bucket | Auth + Pro | Per trade/day/week/month; null points excluded, raw table available | pro aggregation unit + browser |
| pro-analytics-export | Export report | `open('reports', filterValues())` | GET reports; generation later POST reports | Auth + Pro | Transfers account/date/timezone; no automatic report or AI charge | browser reports navigation |
| pro-year | Heatmap / Year | `load` | GET analytics/heatmap?year | Auth + Pro | Integer 1900–2200 validation | browser heatmap |
| heatmap-previous-year / next-year | Year navigation | `load` after year change | GET analytics/heatmap | Auth + Pro | Actual selected-year aggregates | browser previous-year |
| pro-heatmap-metric | PnL / Trade count | Metric selection and load | GET analytics/heatmap | Auth + Pro | Both values originate from backend aggregates | browser metric change |
| heatmap-calendar-cell | Date details | Cell callback | Existing authenticated heatmap row; journal drill uses selected date | Auth + Pro | Detail is actual selected row; zero/no activity distinct | browser cell and trade drill |
| *-view-chart-data | Chart data disclosure | Native details/summary | None | Existing authorized dataset | Accessible exact values for the rendered chart | browser chart render |

## Strategies and risk

| Component ID | Page / label | Frontend handler | API endpoint | Authentication / subscription | Validation / success / failure | Test reference |
|---|---|---|---|---|---|---|
| strategies-selection | Strategy checkboxes | Native selection | GET strategies supplies owned IDs | Auth + Pro | Selection is used by compare | browser select |
| pro-strategy-compare | Compare strategies | `compare` | GET analytics/strategies?strategy_ids | Auth + Pro | Two to six selected strategies; deterministic metrics and sample warning | browser compare + backend formulas |
| strategies-add-strategy | Add strategy | `strategyForm` | POST strategies | Auth + Pro | Nonempty name, bounded name/description; persist and reload | browser creation |
| strategies-edit | Edit strategy | `strategyForm` | PATCH strategies/{id} | Auth + Pro + ownership | Prefilled existing record, save/reload | browser edit |
| pro-strategy-save | Save strategy | Form callback | POST or PATCH strategies | Auth + Pro | Inputs retained on failure | browser save |
| strategies-delete | Delete strategy | Confirmation callback | DELETE strategies/{id} | Auth + Pro + ownership | Confirmation, retains trades, refreshes list | browser delete |
| strategies-cancel / reset | Cancel / Reset | Editor or selection clearing | None | Existing authorized page | Clears draft/selections/output without deleting records | browser reset |
| pro-risk-instrument and numeric fields | Position size configuration | Native labeled inputs | POST risk/calculate body | Auth + Pro | Explicit balance/risk/entry/stop/contract size/quantity step/conversion; no invented defaults | browser risk inputs + backend numeric tests |
| pro-risk-calculate | Calculate | Calculator callback | POST risk/calculate | Auth + Pro | Finite complete inputs; backend rejects invalid size; assumptions shown | browser calculation |
| risk-reset | Reset | Input/result clearing | None | Existing authorized page | Clears configuration and calculation | browser handler inspection |
| risk-add-rule / edit | Add / Edit rule | `editRule` | POST or PATCH risk/rules/{id} | Auth + Pro + ownership | Nonempty name, valid kind, positive threshold | browser add/edit |
| pro-risk-rule-save | Save rule | Rule callback | POST or PATCH risk/rules | Auth + Pro | Persistence and refreshed evidence | browser save |
| risk-delete | Delete rule | Confirmation callback | DELETE risk/rules/{id} | Auth + Pro + ownership | Confirmation and reload | browser delete |
| risk-view-trade | Violation evidence | `journal` | Existing journal filter | Auth + owner | Supporting trade ID, no invented violation | browser risk evidence render |

## Reviews and reports

| Component ID | Page / label | Frontend handler | API endpoint | Authentication / subscription | Validation / success / failure | Test reference |
|---|---|---|---|---|---|---|
| pro-review-period | Weekly / Monthly | Period selector + load | GET reviews?period | Auth + Pro | Switch actual review period | browser monthly selector |
| reviews-previous-period / next-period | Period navigation | `shift` | GET reviews with start/period | Auth + Pro | Valid date; calendar period shift | browser previous period |
| pro-review-generate | Generate review | Generate callback | POST reviews + UUID idempotency | Auth + Pro | Deterministic persisted review; no AI charge | browser POST + backend review dedupe |
| reviews-open-review | Open review | Owned row display | GET reviews previously authorized result | Auth + Pro | Shows persisted result/evidence | browser history open |
| pro-review-ai | Generate AI commentary | `open('ai-journal', filters)` | AI job only after explicit quota confirmation | Auth + Pro | Carries selected account/date/timezone, separates deterministic and AI work | browser/root handoff |
| reviews-export-pdf | Export PDF | `open('reports', filters)` | GET reports | Auth + Pro | Report builder preserves selection | browser/root handoff |
| report-section-selection | Include analytics/heatmap/risk/reviews | Native checked controls | POST reports/preview or reports `sections` | Auth + Pro | At least one section for generation | browser preview/generate |
| pro-report-strategy | Strategies | Selected owned strategy | POST reports `strategy_id` | Auth + Pro + ownership | Optional strategy filter | browser report render + backend ownership |
| pro-report-preview | Preview | `previewReport` | POST reports/preview | Auth + Pro | Selected deterministic sections; no job or AI usage | browser preview |
| pro-report-generate | Generate PDF | Generate + `watchJob` | POST reports + UUID idempotency; GET reports/{id} | Auth + Pro | Real background job, progress and history; rate/concurrency errors visible | browser job flow + backend PDF tests |
| reports-view-status | View status | Status callback | GET reports/{id} | Auth + Pro + ownership | Current job state/errors | browser status |
| reports-download | Download | Signed URL callback | GET reports/{id}/download | Auth + Pro + ownership | Authorized HTTPS signed link, expired link request can be repeated | browser signed-link rendering + backend signing |
| reports-retry | Retry | Retry + `watchJob` | POST reports/{id}/retry + new UUID | Auth + Pro | Only eligible failed/expired jobs; history refreshed | browser retry |
| reports-delete | Delete | Confirmation callback | DELETE reports/{id} | Auth + Pro + ownership | Confirms deletion; removes owned record via backend | browser delete |

## AI, TradingView and global news

| Component ID | Page / label | Frontend handler | API endpoint | Authentication / subscription | Validation / success / failure | Test reference |
|---|---|---|---|---|---|---|
| pro-analysis-type | Journal / Analysis type | Native performance/strategy/risk selector | POST ai/journal-analysis `analysis_type` | Auth + Pro | Backend controls evidence focus; no unused selector | browser render + backend model schema |
| pro-ai-generate | Analyze behaviour / Analyze market / Generate analysis | AI submit callback | GET entitlements; POST ai/{kind}-analysis + UUID; GET ai/jobs/{id} | Auth + effective Pro + remaining shared quota | Explicit native confirmation, loading/poll, validated result; failed/cancelled jobs don't charge | browser each AI kind + backend quota tests |
| pro-ai-cancel | Cancel analysis | Cancel callback | POST ai/jobs/{id}/cancel | Auth + Pro + job owner | Backend releases reservation; current poll sees terminal state | handler inspection + backend cancellation |
| ai-*-open-analysis | Open saved result | Saved job callback | GET ai/jobs/{id} | Auth + Pro + job owner | Displays existing result without new quota reservation | browser history |
| ai-*-retry | Retry | Confirmation, fresh entitlement, retry + poll | POST ai/jobs/{id}/retry + new UUID | Auth + Pro + quota | Explicit separate new analysis; history and shared allowance refreshed | browser retries + backend failure release |
| ai-evidence-trade | View supporting trade | `evidence` + `journal` | Existing owner-scoped journal | Auth + Pro + owner | Evidence IDs supplied by validated analysis | browser evidence rendering |
| ai-source-reference | View source | Safe HTTPS anchor | Authorized source URL, no inference | Existing authorized result | Timestamped attribution when evidence is available; rejects unsafe URLs | pro URL unit |
| pro-market-instrument | Instrument | Chart update + context request | GET market/context?instrument | Auth + Pro | Explicit allowlist mapped to TradingView symbol; no scraped chart data | browser EURUSD selection |
| pro-timeframe-1m, 5m, 15m, 30m, 1h, 4h, 1d | M1/M5/M15/M30/H1/H4/D1 | `choose` / `draw` / `contextLoad` | GET market/context?timeframe | Auth + Pro | Provider manifest determines availability; changing frame updates chart/context and marks previous analysis; late completions cannot reenable an unsupported frame | browser selection/race regressions |
| market-tradingview-chart | Embedded chart | `draw` | TradingView widget iframe | Pro page; independent machine-readable feed required | 15-second loading confirmation limit; iframe load is transport confirmation only, never proof of backend data | browser iframe transport |
| pro-market-refresh | Refresh market data | Context refresh callback | POST market/refresh | Auth + Pro | No AI quota; freshness/evidence rendered or unavailable | browser refresh + backend data gates |
| pro-market-evidence | View evidence | Open disclosure + scroll | Existing authorized context; no new inference | Auth + Pro | Closed-bar calculations/source timestamps or missing-evidence state | browser rendering + methodology tests |
| pro-market-history | View analysis history | `loadHistory` + scroll | GET ai/history?kind=market | Auth + Pro + owner | Existing saved jobs; opening/re-reading consumes no credit | browser history + worker contract tests |
| pro-market-instrument / initial catalog | Provider instruments | `marketIntelligence` | GET market/instruments | Auth + Pro | No invented symbols; missing manifest gives explicit unavailable state; only catalog symbols/timeframes appear | API catalog authorization + browser |
| ai-engine-status | Engine/model status | `loadEngine` | GET ai/engine | Auth + Pro | Actual installed name/digest + valid benchmark, otherwise unavailable detail | API engine + pipeline tests; real inference Blocked |
| pro-news-q, country, region, category, start, end | News filters | Native filters | GET news with query | Auth + Pro global access; backend country policy remains authoritative | Filters applied server-side, publication date validation | browser query |
| pro-news-search | Search | Search callback | GET news?q… | Auth + Pro | First page of actual authorized results; empty/error state | browser search |
| global-news-reset | Reset | Clear filters + load | GET news | Auth + Pro | Returns authorized unfiltered first page | browser reset |
| global-news-previous-page / next-page | Pagination | Offset + load | GET news?offset&limit=24 | Auth + Pro | Bounded page, previous disabled at start, next disabled on short result | browser handler inspection |
| global-news-read-original-source | Open article | Safe original-source anchor | Provider-supplied authorized HTTPS URL | Existing authorized feed | Attribution/timestamp/country/category; no fabricated full article | browser literal XSS test + backend news policy |

## Integration requirements still requiring real verification

### Existing import controls extended in gateway mode

| Component ID | Page / Label | Frontend handler | API operation | Authentication / subscription | Loading / success / error | Test / status |
|---|---|---|---|---|---|---|
| btn-import-scan | Journal / Add extracted trades | `importScanToJournal` → existing preview | No write until private confirmation | Verified owner; all plans; profit/account currencies must match | Disabled while preparing; extracted source values remain unknown where missing; mismatch explained | `js/pro-import.test.cjs`; Implemented but Not Fully Tested |
| btn-confirm-import | Journal / Confirm import | `confirmGatewayImport` | POST imports/files; POST imports; GET jobs/{id}; reload owned journal | Verified owner; server enforces successful Free quota and concurrent limits | Stable retry key; progress; successful persistence; failed import does not consume allowance | `js/pro-import.test.cjs`, `tests/pro/test_platform.py`, `supabase/test_platform.sql`; Implemented but Not Fully Tested |

Configure the gateway and apply approved additive database migrations in the journaltrading project before claiming deployed Pro functionality. PDF signing requires private Storage; AI requires the permitted local model and self-hosted worker; market analyses require authorized timestamped machine-readable feeds. The current static news delivery cannot enforce a server paywall until the approved deployment changes that delivery path. These are explicit blockers, not fallback fake data.
