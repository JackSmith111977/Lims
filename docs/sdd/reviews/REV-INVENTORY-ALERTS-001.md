# Inventory Alerts and Task Association Adversarial Review

| Item | Value |
| --- | --- |
| Review ID | REV-INVENTORY-ALERTS-001 |
| Scope | DES-INVENTORY-ALERTS-001; FR-INVENTORY-005~006; AC-RESOURCE-001; T-404 |
| Date | 2026-07-16 |
| Status | Closed |

## Attack scope

- Forged low-stock threshold, quantity, task ID, operator, timestamp, balance, or audit fields.
- Low-stock/expiry boundary dates, disabled and inactive items, expired items, duplicate alerts, and invalid windows.
- Linking inbound/return/scrap movements, archived or invisible tasks, and manager-only task permission boundaries.
- Concurrent movements and regression of T-403's row-lock, immutable-history, direct-write, and audit guarantees.
- Unauthenticated alert/API/page access, route shadowing, migration repeatability, and temporary task/resource cleanup.

## Findings

| ID | Level | Scenario | Evidence / resolution | Status |
| --- | --- | --- | --- | --- |
| REV-INVENTORY-ALERTS-001-01 | P0 | A client changes balance or threshold through a direct table write or forged transaction fields. | Threshold changes use the existing manager RPC; quantity remains transaction-managed; task, operator, time, and balance fields are server-derived. Remote reader direct-write and forged-field checks passed. | Closed |
| REV-INVENTORY-ALERTS-001-02 | P1 | Alerts leak inactive records, miss expired records, or accept an unbounded client window. | The database RPC uses the database date, excludes `INACTIVE`, includes `EXPIRED`, supports independent low-stock and expiry rows, and validates `days` from 0 to 365. Remote boundary checks passed. | Closed |
| REV-INVENTORY-ALERTS-001-03 | P0 | A resource manager attaches a task to an inbound/return/scrap movement or an archived task. | The RPC permits `task_id` only for `OUTBOUND`, requires `task.read`, rejects archived/missing tasks, and performs validation before the locked balance transaction. Remote active/archived/type/permission checks passed. | Closed |
| REV-INVENTORY-ALERTS-001-04 | P1 | Task association is stored but absent from history or audit, or the T-403 concurrency behavior regresses. | `task_id` is stored in the immutable transaction and audit JSON in the same transaction. Both T-404 integration and the post-migration T-403 regression passed, including concurrent outbound serialization. | Closed |
| REV-INVENTORY-ALERTS-001-05 | P1 | An unauthenticated user can call alerts or the inventory page, or a route is captured by a dynamic segment. | Proxy protection remains on `/inventory`; production build listed `/api/v1/inventory/alerts` before item routes; isolated E2E passed all 12 unauthenticated cases, including the alert endpoint. | Closed |
| REV-INVENTORY-ALERTS-001-06 | P2 | Integration retries leave temporary users, roles, tasks, projects, methods, items, transactions, or audits. | The harness cleans dependencies in reverse order and verifies zero remaining resources. The remote run passed after two harness-input corrections, and the final run reported zero users, roles, tasks, projects, methods, items, and transactions. | Closed |

## Quality evidence

- `npm.cmd exec tsc -- --noEmit`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd test`: 15 files / 53 tests passed.
- `npm.cmd run build`: passed; the known Windows SWC native binding warning fell back to the WASM/webpack path. The build listed the alert route and inventory page.
- `npm.cmd run test:e2e -- --workers=1 --reporter=line` with isolated port 3018: 12/12 passed.
- `npm.cmd run test:inventory-alerts-integration`: passed; alerts, permissions, task association, audit parity, and cleanup all passed.
- `npm.cmd run test:inventory-integration`: passed after migration 018; T-403 balance/concurrency/direct-write regression remained green.
- `scripts/sdd/check-consistency.ps1`: passed.
- `npm.cmd run check:versioning`: passed.
- Supabase SQL Editor reported `Success. No rows returned` for migration `202607160018_inventory_alerts_and_task_links.sql` after correcting the PL/pgSQL dynamic DDL statement.

## Decision

All P0/P1 findings are closed. T-404 is complete because alert calculation, threshold maintenance, task-linked usage, permission boundaries, audit integrity, UI/API behavior, migration, remote integration, regression coverage, and cleanup have been verified against the linked Supabase project.
