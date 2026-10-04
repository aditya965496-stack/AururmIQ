# AurumIQ

A local gold-derivatives research application, built from the supplied concept notes and implementation plan. It includes Overview, Contract Comparison, Research Lab, Lifecycle Calendar, Data Health, and local watchlists.

## Run

Requires Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. The server intentionally binds to loopback. To use a production build locally:

```sh
npm run build
npm start
```

## What works

- Responsive research dashboard with exact-contract selectors, time ranges and inspectable spread/price/z-score charts.
- Pure-gold normalization, prior-window z-scores, activity proxy and explicit abstention reasons.
- Canonical CSV validation and immutable local raw-file/hash snapshots; dataset switching.
- Chronological daily-bar research scenarios with integer lots, entry/exit costs, lifecycle buffers, exact-contract ledger and reconciled attribution.
- Persistent run records, JSON export, local saved configurations and watchlists.
- Source/provenance/limitation views and tender/expiry calendar.

## Data boundary

The sample workspace is deterministic **synthetic data**, visibly labeled everywhere relevant. No actual MCX history has been downloaded. Imported files are labeled **user supplied / source unverified**. Current specifications, tender dates, exchange calendar, fees and historical source availability are not independently verified.

No finding is actionable. Daily Open prices support an explicitly hypothetical bar-based scenario, not executable returns. Open exposure remains unresolved. Short samples do not acquire significance from a positive P&L.

To disable synthetic example access, set `AURUM_DISABLE_DEMO=true` in `.env.local`. Import your own canonical CSV. The import template is available in the app.

## CSV format

Required columns:

```csv
trade_date,requested_date,symbol,expiry,tender_start,open,high,low,close,volume,open_interest
```

Optional: `settlement`. Dates must use YYYY-MM-DD. `trade_date` must equal `requested_date`. Allowed symbols are GOLDM/GOLDTEN/GOLDGUINEA/GOLDPETAL. Use native quote prices and volume/OI in lots. The original file is retained; new bytes generate a new dataset ID. No failed validation partially publishes a dataset.

CSV is a canonical adapter, not the unverified live MCX schema. Imported tender dates are supplied by you; lot/quote/purity/location use the plan’s provisional registry.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

See [VERIFICATION.md](VERIFICATION.md) for observed checks and [the refined plan](public/IMPLEMENTATION_PLAN.md) for the implemented-versus-pending distinction and production gates.

## Implementation

Next.js 16, React 19, TypeScript, Lucide icons, custom SVG charts. Research logic is separate under `src/lib`. Server routes enforce a local single-user boundary and same-origin mutations. Local imports/runs are under `.data/` (ignored by Git). No external credentials are needed. No external alerts/payments/broker connection exists.

This MVP uses Node server handlers instead of the plan’s future FastAPI/PostgreSQL/Redis architecture, so it runs with the available environment. Before any shared deployment, replace filesystem persistence and local boundary with approved identity, permissions, durable jobs and private storage. See the refined plan for the exact sequence.
