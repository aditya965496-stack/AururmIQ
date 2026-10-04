# AurumIQ — refined implementation plan

Prepared 4 October 2026. This plan reflects the application delivered in this workspace. It is a working local research MVP, not a deployed service or verified trading strategy.

## Product decision

Build a traceable end-of-day research desk that compares exact gold contracts, explains when comparisons are incomplete, and accepts “no actionable signal” as a valid result. The supplied second plan supersedes simplified rules in the first: expiry summaries cannot replace a trading calendar, price normalization cannot remove location basis, and daily Open cannot establish an executable fill.

## Delivered vertical slice

| Area | Implemented behavior | Evidence boundary |
|---|---|---|
| Overview | Four families, fine-gold normalization, six front-contract comparisons, historical charts, research inbox | Sample observations are synthetic; imported source is unverified |
| Comparison | Exact contract selectors, spread/normalized price/z-score charts, exact-expiry futures curve, mechanics, suppression explanations | Carry, location and structural basis are not independently fitted |
| Research lab | Prior-window statistics, later-session hypothetical fills, integer lots, costs on every leg, tender buffer, trade ledger, capital marks, attribution, rejection counts, run export | Daily-bar scenario; no executable returns or statistical significance claimed |
| Lifecycle | Tender/expiry calendar, exact-contract eligibility relative to data date | Dates provisional or supplied in CSV; no verified exchange calendar |
| Data health | Source status, coverage, zero-volume counts, immutable file hash, parser identity, limitations | Validation is not independent exchange verification |
| Imports | Canonical CSV, strict dates, request/return match, OHLC/schema/numeric checks, duplicate rejection, raw archival, immutable datasets | Live MCX adapter deliberately remains gated on verified source samples |
| Personal tools | Dataset switching, local watchlists, saved research setup, search, snapshot/run downloads | Single user; local browser storage for preferences |

## Architecture adjustment

The supplied plan recommends Next.js + FastAPI + PostgreSQL + Redis. The delivered first slice uses supported Next.js/React/TypeScript with server route handlers and a separate analytics module. Node.js was available in the workspace; Python was not installed. Keeping the first slice in one runtime makes it runnable without provisioning external services. This is a deliberate MVP adjustment, not a claim that filesystem storage replaces production persistence.

API endpoints:

- `GET /api/datasets` — available snapshot metadata.
- `GET /api/workspace?dataset=<id>` — an exact frozen dataset.
- `POST /api/datasets` — validate and import a canonical CSV; no partial publication on validation failure.
- `POST /api/research` — bounded simulation and persisted result.
- `GET /api/research?dataset=<id>` / `?run=<id>` — saved run metadata and exact persisted results.

The server binds to 127.0.0.1. API handlers check local host and same-origin writes. Single-process rate controls and bounded bodies apply. No user-supplied URLs, code, SQL, ZIP files or external messages are accepted. Shared/public deployment must not reuse this trust boundary.

Raw CSV and dataset JSON are stored under `.data/datasets`; runs under `.data/runs`. SHA-256 over original bytes identifies the imported snapshot. Identical files deduplicate; revised files receive new IDs. These records are local and unencrypted at rest. Backups, crash-safe multi-record transactions, workers and retention controls remain production work.

## Calculation definitions

Fine-gold price = native quoted price / (quote grams × purity).

Spread bps = 10,000 × (second normalized price − first normalized price) / their arithmetic midpoint.

The z-score baseline excludes the current observation and uses the previous configured number of jointly active observations. Days with missing prices, zero volume or zero OI are not forward filled into signal eligibility. A sample standard deviation is used; a constant spread or insufficient history produces no z-score. There is no automated parameter fitting: this is chronological replay with fixed, predeclared parameters, not nested walk-forward optimization.

Activity score is a heuristic: `min(100, 65 × log10(volume+1)/4 + 35 × log10(OI+1)/5)`. It is not bid/ask depth, a calibrated confidence probability, or proof of tradability. Overview WATCH uses |z| ≥ 2; all thresholds are starting proposals. Every finding remains non-tradable because historical mechanics and executable quotes are unverified.

Simulation assumes each bar becomes available one full observed session later. A decision then occurs at that later session's close and fills at a still later observed session's Open. The assumed lag does not independently verify historical publication or revised vintages. Simultaneous leg fills and realized daily-volume checks are explicitly disclosed scenarios; realized volume is not used for earlier sizing. Orders use fixed integer lots matched on provisional fine-gold exposure. Different maturities/locations suppress research entries. The current sample includes synthetic calendar assumptions, so it does not substantiate any historical MCX behavior.

Native-contract gross P&L = Σ signed lots × lot grams / quote grams × change in native quoted price. Per-leg round-trip cost bps are split between entry and exit and applied to gross leg notional. A simple full-reversion hurdle is twice the per-leg cost bps. Prices are not adversely adjusted as well, avoiding cost duplication. Dated statutory fees, financing and historical margin rules are not implemented. A disclosed 20% gross-notional collateral proxy restricts entry against predeclared capital.

Entries require maximum holding sessions plus a conservative calendar-day tender buffer; weekends/holidays are not a verified scheduling model. Exits triggered by convergence, holding duration or lifecycle buffer occur at a later assumed Open. An unavailable exit is not manufactured. Exposure at data end or a lifecycle breach produces an inconclusive verdict. Missing held-contract valuations are flagged unresolved rather than silently erased.

Gold attribution uses the first contract as an explicit futures reference. The accounting identity is gold-proxy contribution + remaining basis − costs = net P&L. Remaining basis includes carry/curve/other effects and is not labeled pure alpha. A fully funded first-contract price series supplies directional context; it is not a matched-margin trading benchmark. No Sharpe, statistical confidence, causal alpha or proven market edge is reported.

## Revised priorities

1. **Source verification:** obtain representative real MCX files, source dictionary, date formats, instrument types, volume/OI units, Close versus Settlement identity, source-use permissions and download behavior. Keep canonical CSV as a separate adapter.
2. **Historical registry:** review versioned circulars, listing dates, tick sizes, lot/quote/purity/location changes and calendar overrides. Store publication/effective/known-at timestamps and source hashes. Verify actual tender dates.
3. **Persistence & identity:** PostgreSQL migrations, private raw-object storage, server-managed identity sessions, viewer/analyst/admin permissions, owner/workspace isolation and RLS through the real runtime role. Authorize status/cancel/export/download operations independently.
4. **Durable jobs:** asynchronous backtests, idempotency, bounded queues, leases, cancellation, durable job state and worker-restart recovery. Redis caching is separate from job durability.
5. **Research validation:** point-in-time availability and corrected data vintages, frozen train/validation/holdout manifests, untouched holdout, serial-dependence-aware confidence intervals, parameter search history, explicit short-sample verdicts and multiple-testing controls.
6. **Economics & execution:** dated fees/taxes, financing, margin stress, failed/partial legs, tick rounding, delayed entry, strict no-fill and adverse legging tests. Add licensed intraday bid/ask evidence before making executable claims.
7. **Fair-value models:** verified same-expiry GOLDTEN/GOLDGUINEA first, only after overlap/activity gates; separately model maturity, location, structural basis and curve roll-down. Do not use fitted components as causal explanations without diagnostics.
8. **Operational release:** controlled rollout, secrets scanning, tenant tests, monitoring, point-in-time backup/restore drill, source outage runbook, calendar-aware staleness alarm, accessibility/network/load tests and reviewed distribution permissions.

Payments, external notification subscriptions, brokerage connectivity and Kubernetes remain out of the first release. Add infrastructure when measured workload justifies it.

## The 15 release checks, with honest status

| Requested check | Current local MVP | Shared-production exit gate |
|---|---|---|
| Remove test data | Synthetic workspace visibly labeled; `AURUM_DISABLE_DEMO=true` disables it; tests separate | Production has no demo or synthetic market snapshots |
| Hide API keys | No external credentials; environment example contains no secrets | Managed secrets, bundle/history/image scans, rotation |
| Protect admin routes | No public admin roles/routes; loopback-only imports | Server-side roles, MFA, audited changes |
| Authentication & permissions | Single-user local boundary, no pretend login | Signature/issuer/audience/session validation and resource ownership |
| Database rules | Immutable local files; no browser file access | Least privilege, transaction-scoped identity, tested RLS |
| Validate inputs | Canonical schema, strict dates, finite bounds, pair limits | Source-version adapters and wider adversarial/property suite |
| Rate limits | Per-process endpoint quotas; payload/row/field bounds | Distributed user/IP/job quotas and fair worker budgets |
| File uploads | CSV only; no archive/execution; generated hash names | Isolated parsing, quarantine, storage authorization and scan policy |
| API errors | Safe error codes, row context and request IDs | Circuit breaker, recovery, durable status, retries |
| Debug logs | No credentials logged; sanitized operational failure event | Retention/redaction policy and production logging review |
| Sensitive errors | No user-facing stack or internal paths | Staging fault-injection evidence |
| Mobile | Responsive navigation/cards/tables/dialogs | Browser checks at 360/390/768/1440 and accessible key journeys |
| Slow internet | Loading/error states, canceled obsolete reads; retry controls | Offline/throttled browser recovery and persistent jobs |
| Payments/webhooks | Not implemented or needed | Signed raw bodies, deduplication and state reconciliation if added |
| Break the app | Engine regressions and browser checks | Tenant/admin isolation, security scans, restore/load/fault drills |

The local CSP allows inline scripts/styles needed by Next.js. It is not a completed production nonce policy. A hosted deployment requires a separate security review; loopback checks are not authentication.

## Acceptance evidence

Automated engine tests cover normalization; prior-window statistics; unchanged earlier decisions when future rows change; next-session execution chronology; native quote P&L; integer lots; both-leg costs; reconciliation; zero-volume suppression; expiry/location suppression; unresolved end exposure; non-tradable signals; deterministic import hashes; distinct Close/Settlement; mismatches; duplicates; malformed/future dates; numerical/content abuse; strict research bounds.

Run `npm test`, `npm run typecheck`, and `npm run build`. Browser verification covers the six areas, comparison controls, simulation, watch persistence, CSV rejection/import, export, local-origin checks, and mobile dimensions. Record observed results in `VERIFICATION.md`; planned checks must not be represented as passing evidence.

## Delivery sequence after this MVP

| Phase | Concrete exit condition |
|---|---|
| Real-data vertical slice | One real source file traced from raw bytes to display; exact dates and field semantics confirmed |
| Registry & economics | Applicable historical mechanics/fees/calendar reviewed for every held contract |
| Research validation | Frozen chronological splits, non-leakage evidence, reconciled ledger and uncertainty report |
| Multi-user pilot | Authentication/ownership/RLS/job recovery and private exports pass adversarial tests |
| Production decision | Recovery, monitoring, mobile/network/load, source-use permissions and financial review pass |

Do not assign “production-ready” from a calendar estimate. Publish a negative or inconclusive result when that is what the evidence supports.

## References

- Supplied AurumIQ implementation plan and earlier concept notes are the design references; market specifications remain provisional in this app.
- [MCX gold product index](https://www.mcxindia.com/en/products/bullion/gold)
- [MCX bhavcopy](https://www.mcxindia.com/market-data/bhavcopy)
- [Next.js installation documentation](https://nextjs.org/docs/app/getting-started/installation) — framework setup verified during implementation.

The MCX Gold Petal page could not be fetched during this implementation. No real history was downloaded and no result in the included sample is an exchange backtest.
