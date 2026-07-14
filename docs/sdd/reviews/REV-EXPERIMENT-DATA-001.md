# Experiment Data Entry Adversarial Review

| Item | Value |
| --- | --- |
| Review ID | REV-EXPERIMENT-DATA-001 |
| Scope | DES-EXPERIMENT-DATA-001; FR-DATA-001~005; AC-DATA-001; NFR-DATA-002~003; NFR-SEC-002; T-302 |
| Date | 2026-07-15 |
| Status | Closed |

## Attack scope

- Forged primary key, task, sample, method, instrument, recorder, collected time, or created time fields.
- Overwriting raw values with processed or final values, and submitting both raw and processed values in one row.
- Recording data for a sample not linked to the task, a scrapped instrument, or an approved/archived task.
- Reader insert/update/delete attempts and unauthenticated page/API access.
- Missing audit records or audit records with a forged operator.
- Temporary integration users and data surviving a failed assertion or Auth API cleanup error.

## Findings

| ID | Level | Scenario | Evidence / resolution | Status |
| --- | --- | --- | --- | --- |
| REV-EXPERIMENT-DATA-001-01 | P1 | A caller can use one row to overwrite or blend raw and processed values. | Application validation plus `experiment_data_value_shape_check` enforce RAW/raw-only and PROCESSED/RESULT/processed-only shapes. Remote integration verified both valid shapes and rejected overlapping values. | Closed |
| REV-EXPERIMENT-DATA-001-02 | P1 | A caller can forge recorder or bypass task/sample/device boundaries. | Server-generated `task_id`, `recorded_by`, and `created_at`; insert trigger binds `recorded_by` to `auth.uid()`, requires `task_sample`, and rejects SCRAPPED instruments. Remote integration covered reader forgery, unlinked sample, and device traceability. | Closed |
| REV-EXPERIMENT-DATA-001-03 | P1 | Data can be changed after review/archive or by a read-only user. | RLS is SELECT plus INSERT-only with `data.manage`; no UPDATE/DELETE policy remains. The insert guard rejects APPROVED/ARCHIVED tasks. Remote integration verified reader update/delete denial and archived-task denial. | Closed |
| REV-EXPERIMENT-DATA-001-04 | P1 | Data creation is not auditable or operator identity can be forged. | The service calls `record_audit_event` with `data.manage`; the remote integration records and verifies CREATE audit parity under the authenticated admin identity. | Closed |
| REV-EXPERIMENT-DATA-001-05 | P1 | Unauthenticated users can reach the data page or API. | Full Playwright suite passed 8/8 with a pre-started production server; the new data test verifies page redirect and GET/POST 401 responses. | Closed |
| REV-EXPERIMENT-DATA-001-06 | P2 | Supabase Auth hard-delete endpoint returns HTTP 500 for these temporary users during cleanup. | The test does not expose secrets or leave data behind: CLI `supabase db query --linked` performs a strict `data_*` / `@example.invalid` cleanup in finally. Final read-only verification reported 0 test users and 0 data-test projects/tasks/samples/methods/instruments. | Accepted test-infrastructure follow-up |

## Quality evidence

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm test -- --run`: 8 files / 32 tests passed.
- `npm run build`: passed; Next.js used the existing WASM fallback for the known Windows SWC warning.
- `npm run test:e2e -- --workers=1`: 8 passed when reusing a pre-started production server; the Windows `webServer` child-process teardown otherwise timed out.
- `scripts/sdd/check-consistency.ps1`: passed.
- `npm run check:versioning`: passed.
- Remote `202607150011_experiment_data_controls.sql`: applied successfully.
- `npm run test:data-integration`: passed; all six checks passed and strict SQL finally cleanup completed.

## Decision

All P0/P1 findings are closed. The P2 Auth API cleanup behavior is isolated to test infrastructure and has a deterministic CLI SQL fallback; it is not a release blocker for the experiment data feature.
