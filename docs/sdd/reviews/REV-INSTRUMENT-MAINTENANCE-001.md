# Instrument Maintenance and Calibration Adversarial Review

| Item | Value |
| --- | --- |
| Review ID | REV-INSTRUMENT-MAINTENANCE-001 |
| Scope | DES-INSTRUMENT-MAINTENANCE-001; FR-EQUIP-003～006; AC-RESOURCE-001; T-402 |
| Date | 2026-07-16 |
| Status | Closed |

## Attack scope

- Forged operator, identity, attachment, or audit fields and direct table writes.
- Invalid maintenance types, dates before commissioning, inconsistent calibration cycles, and due dates before occurrence.
- Updating or deleting an existing event, bypassing the calibration schedule update, or adding an event to a SCRAPPED instrument.
- Reader access to history/reminders versus manager-only event creation, including the static reminder route and dynamic instrument route.
- Unauthenticated API/page access, temporary resource cleanup, and repeatability when the Supabase CLI token is unavailable.

## Findings

| ID | Level | Scenario | Evidence / resolution | Status |
| --- | --- | --- | --- | --- |
| REV-INSTRUMENT-MAINTENANCE-001-01 | P0 | A client forges `operator_id`, identity, or attachment fields, or inserts a record directly. | The service rejects server-controlled fields; the RPC derives the authenticated operator; authenticated table grants are read-only; remote reader direct-insert/update/delete checks passed. | Closed |
| REV-INSTRUMENT-MAINTENANCE-001-02 | P0 | A calibration record stores a mismatched cycle/date or fails to update the instrument schedule atomically. | Service and RPC validation require a positive cycle, require the next due date, and enforce exact date arithmetic. The remote test verified `2026-07-10 + 30 = 2026-08-09` and the instrument schedule was updated in the same operation. | Closed |
| REV-INSTRUMENT-MAINTENANCE-001-03 | P1 | An event is edited/deleted, or a SCRAPPED instrument receives a new event. | The immutable trigger rejects authenticated update/delete; the RPC locks the instrument and rejects SCRAPPED state. Remote append-only and terminal-state checks passed. | Closed |
| REV-INSTRUMENT-MAINTENANCE-001-04 | P1 | A reader cannot query history/reminders, or a reader can create records. | `resource.read` permits select and reminder queries; `resource.manage` is required by the RPC and POST API. Remote reader visibility, reminder, and creation-denial checks passed. | Closed |
| REV-INSTRUMENT-MAINTENANCE-001-05 | P1 | The static reminders route is captured by `/instruments/[id]`, or unauthenticated access bypasses protection. | Production build lists both `/api/v1/instruments/[id]/maintenance` and `/api/v1/instruments/maintenance/reminders`; fresh isolated E2E passed all 11 unauthenticated access cases, including the three maintenance endpoints. | Closed |
| REV-INSTRUMENT-MAINTENANCE-001-06 | P1 | Audit records or temporary resources are lost after the integration run. | The RPC records maintenance creation and calibration schedule audit events. The remote integration passed audit parity and cleanup verification reported zero temporary users, instruments, tasks, samples, projects, and methods. | Closed |
| REV-INSTRUMENT-MAINTENANCE-001-07 | P2 | Integration cleanup depends on a missing CLI token or is blocked by immutable triggers. | SQL cleanup disables only the maintenance user trigger around owner-level deletion and restores it. The harness also has a service-role API cleanup fallback when `SUPABASE_ACCESS_TOKEN` is absent; the remote rerun passed. | Closed |

## Quality evidence

- `npm.cmd exec tsc -- --noEmit`: passed after the production build generated `.next/types`.
- `npm.cmd run lint`: passed.
- `npm.cmd test -- --run`: 13 files / 48 tests passed.
- `npm.cmd run build`: passed; the known Windows SWC native binding warning fell back to the WASM/webpack path. The build listed both maintenance API routes.
- `PLAYWRIGHT_PORT=3015 npm.cmd run test:e2e -- --workers=1 --reporter=line` with a pre-started isolated server: 11/11 passed.
- `npm.cmd run test:instrument-integration`: passed; maintenance/calibration, permissions, immutability, schedule synchronization, audit, and cleanup checks all passed.
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/sdd/check-consistency.ps1`: passed.
- `npm.cmd run check:versioning`: passed.
- Supabase SQL Editor reported `Success. No rows returned` for migration `202607150016_instrument_maintenance.sql`; the remote integration subsequently exercised the new RPC and column constraints.

## Decision

All P0/P1 findings are closed. T-402 is complete because the maintenance/calibration data contract, transaction boundary, API, UI history/form, permission boundary, adversarial cases, remote integration, cleanup, and required quality gates have been verified against the linked Supabase project.
