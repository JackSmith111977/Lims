# Reporting Adversarial Review

| Item | Value |
| --- | --- |
| Review ID | REV-REPORTING-001 |
| Scope | DES-REPORTING-001; FR-REPORT-001～006; FR-AUDIT-005; AC-REPORT-001; T-305 |
| Date | 2026-07-15 |
| Status | Closed |

## Attack scope

- Generating a report from an unapproved task or submitting client-controlled identity, version, status, timestamp, or snapshot fields.
- Concurrent generation and publication causing duplicate versions or multiple published versions.
- Direct report/history writes, forged state transitions, and execution by publisher/read-only roles outside their permissions.
- Historical report snapshots changing after source data changes, and missing status-history/audit entries.
- Unauthenticated page/API access, JSON export leakage, and temporary integration resources surviving cleanup.

## Findings

| ID | Level | Scenario | Evidence / resolution | Status |
| --- | --- | --- | --- | --- |
| REV-REPORTING-001-01 | P0 | A report is generated for a task that has not passed result review. | `generate_report` locks the task and requires both `APPROVED` task status and the latest APPROVED review. The remote harness verified the unapproved-task rejection. | Closed |
| REV-REPORTING-001-02 | P1 | A caller forges report identity, version, generated-by, timestamps, state, or snapshot data. | The service rejects server-controlled fields; database writes are revoked for clients, and generation derives all identity/time/version/snapshot values in a security-definer function. Unit and direct-write checks passed. | Closed |
| REV-REPORTING-001-03 | P0 | Concurrent or repeated publication overwrites history or leaves multiple current versions. | The task/report rows are locked in the transaction, versions increment under the task lock, and publishing archives the previous PUBLISHED version before publishing the target. Remote version and automatic-archive checks passed. | Closed |
| REV-REPORTING-001-04 | P1 | A read-only user or publisher executes operations outside its scope, or history is mutated. | `report.manage` is required for generation/submission, `report.publish` for publication/archival, and `report.read` only reads. Report and history tables are read-only to authenticated clients with immutable triggers. Remote role-denial and direct-write checks passed. | Closed |
| REV-REPORTING-001-05 | P1 | Snapshot, history, and audit records diverge after a state change. | The report payload is stored as JSONB at generation time; each transition writes report history and audit in the same RPC transaction. Remote snapshot, history, and audit parity checks passed. | Closed |
| REV-REPORTING-001-06 | P1 | Export or page/API access bypasses authentication. | `/reports` and all report APIs, including export, use the shared proxy and `report.read` permission. A fresh production server passed the full 10-test unauthenticated E2E suite. | Closed |
| REV-REPORTING-001-07 | P2 | Cleanup fails because related immutable review records block task deletion. | The first integration run exposed the cleanup gap; the cleanup SQL now disables only the user triggers for result-review/report-history/report rows inside the owner-only cleanup transaction, then restores them. The rerun reported zero users, reports, history, tasks, samples, projects, instruments, and methods. | Closed |

## Quality evidence

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm test -- --run`: 11 files / 42 tests passed.
- `npm run build`: passed; the known Windows SWC native binding warning falls back to the WASM/webpack path.
- `npm run test:e2e -- --workers=1 --reporter=line` with a fresh server on `PLAYWRIGHT_PORT=3011`: 10/10 passed.
- `npm run test:report-integration`: passed; all report security, snapshot, version, workflow, history, audit, and cleanup checks passed.
- `scripts/sdd/check-consistency.ps1`: passed.
- `npm run check:versioning`: passed.
- `supabase migration list --linked`: every local migration matches remote through `202607150014`.

## Decision

All P0/P1 findings are closed. T-305 and T-305E can be marked complete because report generation, immutable versioned snapshots, workflow APIs/UI, export, remote integration, cleanup verification, quality gates, and this adversarial review have been verified against the linked Supabase project.
