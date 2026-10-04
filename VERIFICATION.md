# Verification record

Checked locally on 4 October 2026 (Asia/Kolkata). These are observed software checks, not a trading-performance or production-security certification.

| Check | Result |
|---|---|
| TypeScript validation | Passed |
| Optimized Next.js build | Passed |
| Engine/API regression tests | 18 passed, 0 failed |
| Production dependency audit | 0 known vulnerabilities reported by npm audit |
| Desktop Chrome workflow | Overview, exact pair controls, futures curve, research ledger, export, saved-run restoration, lifecycle navigation and data health passed |
| Watchlist persistence | Starred pair survived reload and was removable |
| CSV import | Requested/returned date mismatch rejected; valid CSV archived and remained selected after reload |
| Failure recovery | Aborted workspace read showed an honest unavailable state; retry recovered the sample |
| API boundary | Foreign-origin mutation rejected (403); dataset traversal rejected (404); invalid research bounds rejected (422) |
| Mobile widths | No page overflow in overview/research at 360, 390 and 768 px; wide tables scroll within their cards |
| Network throttle | Reload completed with 200 ms latency and approximately 1 Mbps downstream / 512 kbps upstream |
| Browser errors | No uncaught page errors during the passing workflow |

Screenshots are in `artifacts/`. The browser-check script removes its imported dataset and generated research run afterward. Earlier exploratory runs were removed before delivery. The supplied synthetic workspace remains intentionally available and labeled; disable it through `AURUM_DISABLE_DEMO=true` when appropriate.

## Reproduce

```sh
npm test
npm run typecheck
npm run build
npm start
```

With the application running on http://127.0.0.1:3000, run `npm run test:browser`. The browser check uses installed Chrome through Playwright; the app itself needs no browser automation dependency at runtime.

The Windows sandbox could not supply the user profile to the TypeScript test runner, so engine tests ran outside that sandbox with approval. Browser verification also required approval to launch headless Chrome. Builds and type validation ran successfully in the workspace.

## Material limits

- No actual MCX historical prices were fetched or validated against exchange documents.
- Contract specifications and calendars remain provisional/user supplied. Close is not relabeled Settlement.
- Simulation uses assumed availability, simultaneous daily-bar fills, all-in costs and a collateral proxy. It does not establish executable returns.
- No optimized walk-forward fitting, untouched holdout study, confidence interval, historical fee/margin review, intraday depth or adverse-legging study was completed.
- Local filesystem persistence and a loopback boundary are implemented. Multi-user authentication, RBAC/RLS, durable queues, remote deployment, backup/restore, penetration/load testing and an independent accessibility audit remain release gates.
- GitHub Actions configuration is provided; no remote workflow run is claimed.

See `public/IMPLEMENTATION_PLAN.md` for the reviewed plan and exact next-phase gates.
