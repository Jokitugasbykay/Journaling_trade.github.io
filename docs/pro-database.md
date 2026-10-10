# Pro database implementation

Status: **Completed and Tested** for isolated PostgreSQL migration/RLS/transaction checks; **Implemented but Not Fully Tested** for hosted Storage; **Blocked** for production application until deployment approval. No production schema or rows were modified. Read-only inspection targeted journaltrading `nmddjuqkdyhcobddinkc` only.

## Migration and compatibility

`supabase/migrations/20261010003143_pro_platform.sql` was created with Supabase CLI 2.81.3 `migration new`. Apply only after reviewing the existing hosted migration history: the repository does not contain the original core migrations. The SQL requires existing profiles/accounts/strategies/trades, `journal_private.account_access`, auth/storage schemas and Supabase roles. It is a single additive migration, not a replacement bootstrap. Do not apply `test_platform_base.sql` to a hosted project.

The existing `journal_access` remains intact. Both existing `journal_pro_analytics` overloads preserve compatible response shapes but now require a verified active subscription with an unexpired period. Old static `account_access.plan=pro` is deliberately not copied to a paid subscription. Any founder/manual grant transition needs explicit reviewed subscription records before rollout. Existing PnL remains broker net (`pnl_is_net=true`); no default contract size, currency conversion, or second deduction is invented.

## Added data

| Location | Data and access |
|---|---|
| journal_private.subscriptions | One server-controlled effective plan, provider ID, interval, status, paid period, configured country codes, latest verified event time |
| journal_private.payment_events | Provider/event unique keys and SHA256 body hash for replay/conflict protection |
| journal_private.usage_periods | Per-user monthly starts/ends, successful and reserved AI counters constrained to a total of 30 |
| journal_private.rate_buckets | Shared per-user fixed-policy rate counters; no browser table access |
| public.platform_jobs | One durable queue/history for three AI types, reports, reviews, imports; owner SELECT only, entitlement gate for Pro jobs |
| public.risk_rules | Owned Pro CRUD; explicit positive finite thresholds |
| public.performance_reviews | Owned Pro records; related account ownership; unique user/account/period/date/timezone including null-account cases |
| public.trade_executions | Owned partial executions with same-owner parent trade; positive finite quantities/prices and explicit optional FX |
| public.trades additions | Explicit currencies/specifications/fees/net-PnL flag; original rows and functionality remain intact |
| private Storage buckets | journal-reports and journal-imports, 20 MiB max objects, specific MIME types |

Indexes cover user history, queue/lease recovery, related executions, rule ownership and review dates. All new public/private tables enable RLS. Private tables have no anonymous/authenticated grants. Rules/reviews/executions require both owner USING and WITH CHECK; parent ownership is verified. Browser clients cannot update jobs, subscriptions, quota, or payment events.

## RPC contracts

User JWT calls (PostgREST `/rest/v1/rpc/<name>`):

| RPC | Arguments | Result |
|---|---|---|
| journal_platform_access / journal_entitlements | None | JSON plan, countries, effectiveUntil, periodStart, periodEnd, aiLimit, aiUsed, aiReserved, aiRemaining |
| journal_create_job | p_kind text, p_payload object, p_idempotency_key UUID, p_payload_hash lowercase SHA256 | Full owned job object, identical replay returns the same job; changed kind/hash/payload with same key is rejected |
| journal_job | p_job_id UUID | Owned job; non-import results require effective Pro; deleted reports unavailable |
| journal_cancel_job | p_job_id UUID | Owned job; queued/running cancellation releases AI reservation exactly once |
| journal_delete_job | p_job_id UUID | Boolean; terminal owned report soft deletion keeps timestamp for rate accounting; backend separately removes private object |
| journal_rate_limit | p_bucket,p_limit,p_window_seconds | Boolean. Only (`pro_api`,120,60) or (`pro_upload`,10,600) accepted; prevents users changing/resetting policy |

Service-role calls (credential must remain worker/gateway-side):

| RPC | Arguments | Result |
|---|---|---|
| journal_user_access | p_user_id UUID | Fresh effective entitlement; worker rechecks before work |
| journal_claim_jobs | p_worker_id UUID, p_limit 1..3 | JSON array. FOR UPDATE SKIP LOCKED claims durable queued jobs and issues a ten-minute worker lease |
| journal_finish_job | p_job_id,p_worker_id,p_result object or null,p_error text or null | Terminal job. Null error with validated result succeeds; expired entitlement converts completion to failure. Failed results release reservation; success consumes one |
| journal_confirm_import | p_job_id,p_worker_id,p_trades array (1..500) | Imports whitelist fields and marks success in the same transaction; related account/strategy ownership, timestamps and duplicate detection enforced. No new trades after deduplication is a failed/noncharged import |
| journal_recover_jobs | None | Count recovered. Expired running leases and queued jobs older than one hour expire and release reservations |
| journal_record_subscription | p_provider,p_event_id,p_payload_hash,p_user_id,p_subscription_id,p_plan,p_status,p_interval,p_period_start,p_period_end,p_event_at,p_countries | Effective entitlement. Verified provider adapter must call only after signature verification. Same event/hash is idempotent; conflicts reject; older event cannot overwrite newer state |

AI kinds: `behaviour`, `journal`, `market`. Other job kinds: `report`, `review`, `import`. Status: queued/running/succeeded/failed/cancelled/expired. API normalizes camelCase entitlement fields for frontend consumption. Job results store validated model version/evidence supplied by the trusted worker; the database does not perform inference.

## Quotas, expiry and failures

All quota-sensitive operations serialize with the same user advisory transaction lock. AI reservations update a constrained monthly usage row atomically; retries with the same job key cannot reserve twice. Annual allowance periods are anchored to original subscription start plus calendar months, avoiding drift at short months. Successful completion increments used and decrements reserved together. Failure/cancel/timeout decrements reserved once. Expired leases cannot complete. Expired/cancelled/past-due subscriptions resolve to Free; cancelling subscriptions retain access only through paid period end. No unused quota rollover.

Free imports count succeeded `finished_at > now()-12 hours`, not attempts. Plus/Pro counts are unlimited but uploads/API use fixed rate controls and pending imports cap at three. Import payload must reference an existing owned private object at `{uid}/{sha256}.pdf|png|jpg|jpeg|csv|txt`; confirmation checks existence again. The gateway validates magic/MIME, exact input schemas and source hash before creating a job. Financial trade fields are decimal strings; server never accepts a different user ID.

Reports allow ten requests per ten minutes and three queued/running requests. Soft deletion cannot reset this counter. PDF export does not reserve AI quota. Report retention/object cleanup is executed by the backend worker; ownership gates prevent expired Pro downloading a new signed URL. Supabase's already-issued signed URLs remain usable until their short expiry.

## Private Storage

Reports: worker-only INSERT; authenticated owner-prefix SELECT requires active Pro; owner DELETE. Imports: authenticated owner-prefix SELECT/DELETE and filename-constrained INSERT. No authenticated UPDATE/upsert policy is added. Both buckets are private. JPEG is retained for compatibility with existing uploads. Policies prevent foreign prefix access; backend additionally verifies owning job before signing reports.

## Verification

Run `node supabase/test_platform.cjs` with PGlite 0.3.10 installed outside the frontend dependency tree; `JT_PGLITE_MODULE` can be an absolute file URL to its `dist/index.js`. The runner creates an isolated real PostgreSQL engine, loads catalog-reconstructed core columns/precision/FKs/checks and equivalent owner policies, loads legacy access.sql, then the additive migration and rollback-only test_platform.sql. Auth/storage fixtures model their database catalogs, not live HTTP providers.

Passed checks: migration execution, all new RLS/privileges, foreign related records denied, private object prefixes, server-only report upload, Free/Plus/Pro access/expiry, legacy RPC expiry, annual monthly anchoring, shared 30 reservations, idempotency conflict, cancellation, successful usage, failure release, expired lease recovery, report concurrency/rate and delete-bypass prevention, fixed-rate override rejection, ten actual atomic Free imports, rolling reset, and failed cross-account import without writes. No mocked financial calculation is presented as database proof. PGlite serializes connections. The current migration and rollback checks were also executed on native PostgreSQL 17.11. Two independent psql sessions competed for the final AI unit: exactly one committed and the other received allowance exhaustion; usage remained 29 used / 1 reserved. Hosted Auth/Storage remains a separate release gate.

Supabase changelog and current database/RLS/function documentation were reviewed. Explicit grants address the current new-table exposure change. All privileged functions pin an empty search path and qualify relations. Public authenticated RPCs are invoker wrappers around identity-checked private implementations; worker/provider functions revoke PUBLIC/anon/authenticated execution and grant only service_role. Production advisors and hosted RLS/Storage checks must be run after approved deployment; no claim is made that local fixtures verify Supabase Auth, HTTP Storage or live payment signatures.
