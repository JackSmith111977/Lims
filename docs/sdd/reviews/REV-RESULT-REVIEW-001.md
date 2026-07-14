# Result Review Adversarial Review

| Item | Value |
| --- | --- |
| Review ID | REV-RESULT-REVIEW-001 |
| Scope | DES-RESULT-REVIEW-001; FR-REVIEW-001～006; AC-REVIEW-001; NFR-SEC-002; T-304 |
| Date | 2026-07-15 |
| Status | Closed |

## Attack scope

- Forged reviewer identity, unsupported review outcomes, missing comments, and review attempts against non-pending tasks.
- Direct table insert/update/delete, direct RPC execution by a read-only user, and cross-role visibility.
- Task status, task history, review history, and audit records diverging after a review or a failed transaction.
- Repeated review cycles, latest-review ordering, and cleanup of temporary users and domain resources.
- Unauthenticated page/API access and stale production processes masking route-protection regressions.

## Findings

| ID | Level | Scenario | Evidence / resolution | Status |
| --- | --- | --- | --- | --- |
| REV-RESULT-REVIEW-001-01 | P0 | A caller changes a task to an approved state without a valid review or submits a review for a non-pending task. | `review_task_result` locks the task, requires an active reviewer with `review.manage`, permits only APPROVED/RETURNED, and accepts only PENDING_REVIEW tasks. Remote integration verified approved, returned, need-more, and non-pending rejection paths. | Closed |
| REV-RESULT-REVIEW-001-02 | P1 | A RETURNED or NEED_MORE review omits an explanation, or a caller forges reviewer/time fields. | The migration enforces non-empty comments for non-approved outcomes and derives reviewer/time from `auth.uid()` and the database clock. Unit and remote integration checks passed. | Closed |
| REV-RESULT-REVIEW-001-03 | P0 | A client mutates or deletes review history, or a read-only role executes the review RPC. | Authenticated table writes are revoked, the review table is protected by an immutable trigger and read-only RLS, and RPC execution requires `review.manage`. Remote direct-write and reader-denial checks passed. | Closed |
| REV-RESULT-REVIEW-001-04 | P1 | Review history, task state history, or audit records are incomplete or inconsistent after a review. | The security-definer transaction inserts the review, transitions the task, records task history, and records audit in one transaction. Remote checks verified append-only history, latest ordering, task history, and audit parity. | Closed |
| REV-RESULT-REVIEW-001-05 | P1 | A repeated returned cycle hides prior decisions or exposes another task's review context. | Review context is scoped to the task, history is append-only and newest-first, and the integration harness verified repeated outcomes and ordering. | Closed |
| REV-RESULT-REVIEW-001-06 | P2 | Temporary integration users/resources remain after an assertion or cleanup error. | The dedicated harness uses strict `review_*` prefixes and owner-only cleanup SQL. Remote cleanup verification reported zero users, tasks, samples, projects, instruments, and methods. | Closed |
| REV-RESULT-REVIEW-001-07 | P1 | An unauthenticated user opens the review page or its APIs, or a stale server causes a false E2E result. | `/reviews` was added to the shared proxy protection matcher. A fresh production server on isolated port 3010 returned the redirect with `redirectedFrom`, and the full unauthenticated suite passed 9/9; review APIs returned 401. | Closed |

## Quality evidence

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm test -- --run`: 10 files / 39 tests passed.
- `npm run build`: passed; the known Windows SWC native binding warning falls back to the WASM/webpack path.
- `npm run test:e2e -- --workers=1 --reporter=line` with a fresh server on `PLAYWRIGHT_PORT=3010`: 9/9 passed.
- `npm run test:review-integration`: passed; all review security, transaction, ordering, history, audit, and cleanup checks passed.
- `scripts/sdd/check-consistency.ps1`: passed.
- `npm run check:versioning`: passed.
- `supabase migration list --linked`: every local migration matches remote through `202607150013`.

## Decision

All P0/P1 findings are closed. T-304 and T-304E can be marked complete because the result-review migration, API/UI flow, remote integration harness, temporary-resource cleanup, quality gates, and this adversarial review have been verified against the linked Supabase project.
