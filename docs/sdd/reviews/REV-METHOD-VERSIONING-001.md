# Method Versioning Adversarial Review

| Item | Value |
| --- | --- |
| Review ID | REV-METHOD-VERSIONING-001 |
| Scope | DES-METHOD-VERSIONING-001; FR-METHOD-001~004; FR-TASK-002; T-301 |
| Date | 2026-07-15 |
| Status | Closed |

## Attack scope

- Duplicate `(method_code, version)` creation and method identity mutation.
- Unauthorized method, history, attachment, and Storage writes.
- Forged operator, primary-key, audit, status, and timestamp fields.
- Unauthenticated page/API access and service-role exposure.
- Private Storage read/write boundaries and upload compensation after metadata failure.
- Method attachment metadata and task-to-method-version references.

## Findings

| ID | Level | Scenario | Evidence / resolution | Status |
| --- | --- | --- | --- | --- |
| REV-METHOD-VERSIONING-001-01 | P1 | Private Storage bucket and policies are absent remotely | Migration history was repaired for the already-applied 009 migration, then `supabase db push --linked --yes` applied `202607150010_method_storage.sql`. The method integration test now verifies upload/download and policy boundaries. | Closed |
| REV-METHOD-VERSIONING-001-02 | P1 | Duplicate version or direct identity mutation | Unique constraint, immutable database trigger, service validation, and the previously applied 009 migration integration checks cover both paths. | Closed locally and by 009 verification |
| REV-METHOD-VERSIONING-001-03 | P1 | Unauthenticated method page/API access | `npm run test:e2e -- --workers=1`: 7 tests passed, including the methods page and all methods APIs. | Closed |
| REV-METHOD-VERSIONING-001-04 | P1 | Attachment upload leaves an orphan object when metadata/audit fails | `uploadMethodAttachment` removes the uploaded object in its failure path; remote integration completed with `cleanedByFinally: true`. | Closed |
| REV-METHOD-VERSIONING-001-05 | P2 | Compatibility JSON metadata endpoint accepts a caller-supplied Storage path | It remains restricted to `resource.manage`; the multipart endpoint generates a UUID-scoped path. Keep the compatibility endpoint for controlled migration tooling and remove it when no longer needed. | Accepted follow-up |

## Quality evidence

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm test -- --run`: 7 files / 28 tests passed.
- `npm run build`: passed; Next.js used the existing WASM fallback for the known Windows SWC warning.
- `npm run test:e2e -- --workers=1`: 7 passed.
- `scripts/sdd/check-consistency.ps1`: passed.
- `npm run check:versioning`: passed.
- `git diff --check`: passed.
- Remote `202607150009` migration history repair: passed; schema already existed and was not re-executed.
- Remote `202607150010_method_storage.sql`: applied successfully.
- `npm run test:method-integration`: passed; all eight checks passed and temporary data was cleaned.

## Decision

All P0/P1 findings are closed. T-301 is ready to be marked complete; the P2 compatibility endpoint remains an accepted follow-up and is not a release blocker.
