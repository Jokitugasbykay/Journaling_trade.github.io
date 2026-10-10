# Pro service: local setup and operation

Status: **Implemented but Not Fully Tested**. Deterministic calculations, API contracts, PostgreSQL transactions and real PDF bytes have local tests. Hosted Auth/Storage, actual subscription events, licensed market data, an installed LLM and production hosting are not verified. No production resource was changed.

## Run locally

Use Python 3.12 and an isolated environment. From the repository:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r tests/pro/requirements.txt
.venv/Scripts/python -m uvicorn services.pro_api.app:app --host 127.0.0.1 --port 8789 --no-access-log
```

An unconfigured service starts with `/health` but returns 503 for `/ready` and protected operations. This is deliberate, not a working provider connection. The worker requires configured Supabase credentials and an approved migration before it can claim jobs:

```powershell
.venv/Scripts/python -m services.pro_api.worker
```

Keep secrets in the host secret manager/environment. Never put a service-role key in HTML, frontend configuration, logs or Git. The only supported Supabase project is `nmddjuqkdyhcobddinkc`.

| Environment variable | Use |
|---|---|
| SUPABASE_URL | Exact journaltrading project URL; another project is rejected |
| SUPABASE_PUBLISHABLE_KEY | User-JWT requests; existing project publishable key |
| SUPABASE_SERVICE_ROLE_KEY | Worker only; never passed to the browser or API container |
| PRO_ALLOWED_ORIGINS | Comma-separated exact website origins; wildcard rejected |
| PRO_DATA_ROOT | Read-only repository data directory: berita.json, kalender.json, regional-sources.json, news/archive, services/pro_api/regions.json |
| PRO_MARKET_ROOT | Read-only licensed snapshot directory, including manifest.json |
| PRO_CALENDAR_SOURCE_TIMEZONE | Existing data timezone, default Asia/Jakarta; independent of viewing timezone |
| OLLAMA_URL | Private localhost/127.0.0.1/ollama HTTP endpoint only |
| OLLAMA_MODEL | Installed reviewed model name |
| OLLAMA_MODEL_LICENSE | Operator-reviewed commercial license reference |
| OLLAMA_MODEL_DIGEST | Exact digest returned by the private runtime |
| PRO_AI_TIMEOUT_SECONDS | 10–240 seconds; default 120 |
| PRO_MODEL_BENCHMARK | File produced by the real local benchmark, for the selected digest |

`js/pro-config.js` intentionally has an empty API URL. After staging verification, configure an HTTPS gateway. A same-origin reverse proxy avoids changing the existing CSP; a separate origin requires a reviewed exact `connect-src` addition. GitHub Pages cannot host this Python process, proxy or inference worker. New features fail closed while the gateway is unconfigured; the existing site continues using its current delivery path.

## Containers

`infra/pro.Dockerfile` runs as a non-root user. `infra/pro-compose.yml` exposes the API only on host loopback. Its worker has the service-role credential; the API does not. Ollama has no public port and uses an internal network. Set the listed interpolation variables before running compose. Ollama's image must be an operator-reviewed immutable digest. Docker/compose are not installed on the current workstation, so image build, network restrictions and startup remain unverified.

Use a TLS reverse proxy and process supervisor. Keep `/ready` private to health monitoring. Configure log rotation and disk/memory/CPU limits on the actual host. The job worker processes one leased job per process; database concurrency limits remain authoritative across processes. No GPU is assumed.

The internal inference network intentionally has no internet access. Provision the reviewed model volume before attaching it to that network; do not expect `ollama pull` inside the isolated production container to reach the model registry. Keep model download/provisioning separate from the journal worker and preserve the verified digest.

## Database deployment and recovery

Review `supabase/migrations/20261010003143_pro_platform.sql` with the hosted migration history first. The repository lacks the original core migration history, so blindly running `db push` is not appropriate. This migration relies on the existing core/auth/storage schemas and `access.sql`; the test bootstrap must never be deployed.

After explicit production approval: take a database backup, export relevant function/policy definitions, rehearse on an isolated clone, apply only this reviewed migration, then verify RLS with two staging identities and private Storage requests. Manual/founder static Pro grants are not silently converted into paid subscriptions; their transition requires reviewed entitlement records. No SQL reset is needed.

Recovery: disable the gateway frontend configuration and worker, preserve all new tables/jobs/objects, restore the reviewed prior function definitions if necessary, and reconcile verified payment events before restarting. Do not drop user data as a rollback. Back up PostgreSQL and private buckets together; test restoring an owned report and journal on an isolated environment. Expired running leases are recovered transactionally, releasing reservations rather than charging them. Queued jobs older than one hour expire. Reports expire after 30 days; downloads are signed for 60 seconds.

## Local model setup

Select an open-weight model only after reviewing its actual commercial license and available RAM/CPU/GPU. Install it on the private worker host, set its name/digest/license, then run:

```text
python -m services.pro_api.benchmark --output /operator/path/model-benchmark.json
```

Set `PRO_MODEL_BENCHMARK` to that file. The probe performs three real structured-output calls, validates evidence references, and records latency, OS, processor and model digest. It uses explicit test evidence and no subscription quota. It is a startup probe, not a forecasting-quality or production-capacity benchmark. A changed digest or missing benchmark prevents new AI jobs. No model was installed or benchmarked in this implementation session.

Local runtime probe: official standalone Ollama 0.40.2 started successfully on CPU at `127.0.0.1:11434`, with `OLLAMA_NO_CLOUD=1`, after archive SHA256 verification (`e29ad1d5063dd4b54b2492d9b00adab2cff9621bfa654b6c92aa8d6f1fdfe7fc`). The [official Windows distribution](https://docs.ollama.com/windows) supports a standalone runtime. The [Qwen3 0.6B registry entry](https://ollama.com/library/qwen3:0.6b) lists a 523 MB Q4_K_M model and Apache 2.0 license; it was selected only for a startup/structured-output smoke test, not approved for financial production use. Its download was interrupted and the incomplete layer failed size/digest verification, so it was not accepted. No inference result or benchmark success is claimed. Model provision/benchmark remains a release gate. The client uses the official [JSON-schema chat format and disabled thinking mode](https://docs.ollama.com/api/chat).

Quantitative calculations, a simple walk-forward statistical baseline, and the LLM explanation remain separate. Ollama has no tools or database credentials. Notes/news are untrusted evidence. Output is schema-validated and may cite only supplied evidence IDs. Human review is still needed to assess interpretation quality on a real selected model.

## Market snapshots

`market.py` defines the precise Pydantic `Snapshot` contract. Supply `manifest.json` containing `instruments` with verified `tradingview_symbol` mappings, plus `<INSTRUMENT>_<TIMEFRAME>.json`. Each snapshot needs provider/license references, timezone-aware `as_of`/`valid_until`, actual OHLC bars and market-open status. Optional macro/news/geopolitical items require timestamped source references; do not insert examples as actual market data. User input cannot supply provider URLs or filesystem paths. Refresh rereads the authorized operator snapshot; a provider adapter/producer still needs to be configured. TradingView chart rendering supplies no Python OHLC data.

## Financial formulas

Money uses Decimal. Recorded broker net PnL is authoritative; costs are subtracted only when explicitly marked gross. Missing PnL requires explicit contract size and quote/account FX rate. Partial executions use FIFO matching and proportionally allocated recorded commissions; closing more than the opened quantity is rejected.

| Metric | Formula / caveat |
|---|---|
| Expectancy | Sum of net PnL / closed validated trade count; null when empty |
| Profit factor | Sum of positive net PnL / absolute sum of negative PnL; null without losing trades |
| Maximum drawdown | Largest peak equity minus subsequent equity; percent divides by positive peak |
| Starting equity | Account initial balance plus recorded PnL before the selected start date |
| Win rate | Positive-PnL trades / validated trades; breakeven remains a separate state |
| Average risk/reward | Mean absolute (target-entry)/(entry-stop) for records with all three values and distinct stop; planned price ratio |
| Consistency | Population standard deviation of recorded trade PnL; descriptive, not a forecast |
| Position size | Floor((balance*risk%)/(abs(entry-stop)*contract*FX)/quantity_step)*quantity_step |
| Open exposure | Recorded risk amount, otherwise remaining quantity * stop distance * explicit contract * FX; unknown specifications produce null, not an estimate |
| Daily/weekly exposure | Known open positions grouped by opening date in the user's timezone; not an estimate of future portfolio correlation |

Mixed account currencies require selecting one account; no implicit conversion. Closed-at is used for period grouping, with an explicit warning when opening time is the only timestamp. Sessions use IANA Tokyo/London/New York zones with daylight-saving handling and documented precedence. Heatmap cells carry exact trade IDs so journal drilldowns do not repeat date conversion in the browser. Missing activity and zero PnL differ.

## Billing and news boundaries

There is no configured payment provider. `journal_record_subscription` is service-only and supports idempotent verified events, ordering, renewal, downgrade, expiry and cancellation state. It is not a public webhook endpoint. Signature verification, checkout/portal/cancellation commands, reconciliation against a provider, and billing-history UI remain **Blocked** until the provider/account is identified. A frontend success message can never grant Pro.

The new news API checks country restrictions independently of category, including International. In configured gateway mode, the existing reader/calendar call authenticated endpoints and bypass the public cache/fallback path. Public news files still exist in the current GitHub Pages deployment. Removing those production artifacts and protecting stored image/content delivery requires approval and a coordinated hosting change. Until then, the whole deployed site's Plus restrictions cannot be certified. Full publisher articles require an actual licensed feed; only supplied excerpts/original links are served.

## Verification

```text
python -m unittest discover -s tests/pro -v
node js/pro.test.cjs
node js/pro-import.test.cjs
node tests/frontend-pro.cjs
```

The browser test needs Playwright and Chrome; set `PLAYWRIGHT_MODULE` to the installed module on other hosts. For native SQL, initialize a dedicated loopback PostgreSQL instance, apply the local-only bootstrap, `access.sql`, migration, `test_platform.sql`, and `test_security.sql`. Set `JT_TEST_PSQL` and optionally `JT_TEST_PGPORT` before running the Python tests. The concurrency test uses the fixed local test role/database and cannot accept a hosted connection URL. It cleans only its freshly generated test identity. If the native test is skipped, do not count it as proof of races.

`.github/workflows/pro-tests.yml` defines these checks without deploying. It has not run remotely yet. The existing Pages workflow gains route folders only; it has not been pushed or executed. For actual pass/fail results and remaining release gates, see `docs/PRO_PHASE_REPORTS.md`.
