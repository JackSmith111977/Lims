# Inventory Management Adversarial Review

| Item | Value |
| --- | --- |
| Review ID | REV-INVENTORY-MANAGEMENT-001 |
| Scope | DES-INVENTORY-MANAGEMENT-001; FR-INVENTORY-001~004; AC-RESOURCE-001; T-403 |
| Date | 2026-07-16 |
| Status | Closed |

## Attack scope

- Forged item identity, quantity, operator, timestamp, task association, balance, or audit fields.
- Direct inserts/updates/deletes against the item and transaction tables, including attempts by a reader and manager.
- Duplicate item codes, invalid status/type/quantity, insufficient stock, and invalid transaction directions.
- Concurrent outbound operations against one balance, depleted/reactivated state transitions, and immutable history.
- Reader visibility versus manager-only writes, unauthenticated page/API access, and route shadowing.
- Audit parity, remote migration behavior, temporary-user cleanup, and repeatability without a Supabase CLI token.

## Findings

| ID | Level | Scenario | Evidence / resolution | Status |
| --- | --- | --- | --- | --- |
| REV-INVENTORY-MANAGEMENT-001-01 | P0 | A client forges quantity, identity, operator, occurrence time, task association, or transaction balance. | Service validation rejects generated/reserved fields; RPCs derive the authenticated operator/time and initialize new balance to zero. Remote tests rejected client-controlled quantity, direct balance writes, and forged transaction fields. | Closed |
| REV-INVENTORY-MANAGEMENT-001-02 | P0 | A direct table write bypasses the transaction boundary or changes a historical movement. | Authenticated table grants are read-only; item writes require the transaction API setting and transaction update/delete triggers reject authenticated callers. Remote reader and manager direct-write checks passed. | Closed |
| REV-INVENTORY-MANAGEMENT-001-03 | P0 | Two simultaneous movements overspend or lose an inventory balance. | `record_inventory_transaction` locks the item row before validating and applying the movement. The remote integration ran two concurrent outbound operations against one unit and observed exactly one success, one rejection, and a final zero balance. | Closed |
| REV-INVENTORY-MANAGEMENT-001-04 | P1 | Invalid movements create negative stock or an invalid lifecycle state. | Positive quantities, supported movement types, insufficient-stock rejection, depleted-at-zero, and reactivation-on-inbound are enforced by service/RPC constraints. Remote inbound/outbound/return/scrap and lifecycle checks passed. | Closed |
| REV-INVENTORY-MANAGEMENT-001-05 | P1 | A reader can mutate inventory, or a manager can bypass audit creation. | `resource.read` is select-only; `resource.manage` gates all RPCs. Item create/update/stock and transaction create audits are recorded in the same database transaction. Remote reader denial and audit-parity checks passed. | Closed |
| REV-INVENTORY-MANAGEMENT-001-06 | P1 | The new page or APIs are reachable without authentication, or a dynamic route captures the transaction endpoint. | Proxy protects `/inventory`; production build listed all three inventory API routes; isolated unauthenticated E2E passed all 6 inventory page/API cases. | Closed |
| REV-INVENTORY-MANAGEMENT-001-07 | P2 | A failed integration run leaves temporary accounts, roles, items, transactions, or audits. | The harness uses service-role cleanup in dependency order and verifies zero remaining users, roles, items, and transactions. The remote integration passed twice, including the concurrency rerun. | Closed |

## Quality evidence

- `npm.cmd exec tsc -- --noEmit`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd test`: 14 files / 51 tests passed.
- `npm.cmd run build`: passed; the known Windows SWC native binding warning fell back to the WASM/webpack path. The build listed `/inventory` and all three inventory API routes.
- `npm.cmd run test:e2e -- --workers=1 --reporter=line` with isolated port 3017: 12/12 passed.
- `npm.cmd run test:inventory-integration`: passed; item/transaction permissions, row-lock concurrency, lifecycle, audit parity, and cleanup all passed.
- `scripts/sdd/check-consistency.ps1`: passed.
- `npm.cmd run check:versioning`: passed.
- Supabase SQL Editor reported `Success. No rows returned` for migration `202607160017_inventory_management.sql`.

## Decision

All P0/P1 findings are closed. T-403 is complete because the inventory data contract, server-managed balance, transaction boundary, API/UI, permission boundary, adversarial cases, remote migration, integration cleanup, and required quality gates have been verified against the linked Supabase project.
