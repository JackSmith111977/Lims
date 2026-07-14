# Experiment Processing Adversarial Review

| Item | Value |
| --- | --- |
| Review ID | REV-EXPERIMENT-PROCESSING-001 |
| Scope | DES-EXPERIMENT-PROCESSING-001; FR-DATA-007~008; AC-DATA-001; NFR-SEC-002; T-303 |
| Date | 2026-07-15 |
| Status | Open - remote verification pending |

## Attack scope

- Direct PostgREST RPC calls that submit a fabricated processed value, output type, decision, or terminal status.
- Reader execution, cross-task source IDs, approved/archived task processing, and forged operator identity.
- Updates/deletes to rules, terminal runs, lineage, and raw input data.
- Partial output or lineage after a database error, missing audit records, and non-numeric sources.
- Temporary integration users and immutable processing runs surviving a failed assertion or Auth API cleanup error.

## Findings

| ID | Level | Scenario | Evidence / resolution | Status |
| --- | --- | --- | --- | --- |
| REV-EXPERIMENT-PROCESSING-001-01 | P1 | A caller bypasses the service-layer pure function and submits a forged result directly to the persistence RPC. | Static review found that the first RPC draft checked shape but trusted caller-supplied result values. The migration now recomputes the expected round/threshold result inside the transaction and rejects mismatches. The integration harness includes a direct forgery attempt. | Pending remote verification |
| REV-EXPERIMENT-PROCESSING-001-02 | P1 | Processing output and lineage are only partially persisted after an error. | Output, lineage, terminal state, and audit are written in one security-definer transaction; calculation failures use a separate FAILED-run function with no output. The remote atomicity case remains unverified. | Open |
| REV-EXPERIMENT-PROCESSING-001-03 | P1 | A read-only user executes processing or mutates immutable records. | `data.manage` is checked in the validation function; table writes are revoked for authenticated clients; immutable triggers protect rules, runs, lineage, and raw data. The harness covers reader execution and mutation attempts. | Pending remote verification |
| REV-EXPERIMENT-PROCESSING-001-04 | P1 | Processing is performed against an approved/archived task or a source from another task. | Input validation rejects locked tasks and cross-task source IDs before creating a run. The task-lock and cross-boundary cases are in the harness. | Pending remote verification |
| REV-EXPERIMENT-PROCESSING-001-05 | P1 | Remote migration state is mistaken for local build success. | Supabase CLI telemetry was disabled successfully, but migration listing then returned `Access token not provided`. No remote migration or integration result is claimed until the user restores CLI authentication. | Open - external authentication blocker |
| REV-EXPERIMENT-PROCESSING-001-06 | P2 | Immutable processing runs cannot be removed by ordinary cleanup clients. | Cleanup is isolated to `cleanup-experiment-processing.sql`, matches only `processing_*` test resources, and temporarily disables user triggers only in the database-owner test SQL session. It is never granted to application users. | Pending remote verification |

## Local quality evidence

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm test -- --run`: 9 files / 36 tests passed.
- `npm run build`: passed; the known Windows SWC native binding warning falls back to the WASM/webpack path.
- `scripts/sdd/check-consistency.ps1`: passed.
- `npm run check:versioning`: passed.
- `npm run test:e2e -- --workers=1 --reporter=line`: previously passed 8/8 with a manually pre-started production server; the current rerun was not completed because the local Playwright web-server bootstrap hung, so this remains a test-environment limitation rather than new evidence.

## Decision

The local implementation and gates are green, but T-303E remains open. Do not mark T-303 complete until `202607150012_experiment_processing.sql`, the processing integration harness, cleanup verification, and this review are confirmed against the linked Supabase project.
