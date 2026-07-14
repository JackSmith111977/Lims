# Method Versioning Adversarial Review

| Item | Value |
| --- | --- |
| Review ID | REV-METHOD-VERSIONING-001 |
| Scope | DES-METHOD-VERSIONING-001; FR-METHOD-001~004; FR-TASK-002; T-301 |
| Date | 2026-07-15 |
| Status | Pending remote Storage migration |

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
| REV-METHOD-VERSIONING-001-01 | P1 | Private Storage bucket and policies are absent remotely | `npm run test:method-integration` failed at the first upload with `Bucket not found`; migration `202607150010_method_storage.sql` is present locally but has not been applied remotely. | Open / blocking |
| REV-METHOD-VERSIONING-001-02 | P1 | Duplicate version or direct identity mutation | Unique constraint, immutable database trigger, service validation, and the previously applied 009 migration integration checks cover both paths. | Closed locally and by 009 verification |
| REV-METHOD-VERSIONING-001-03 | P1 | Unauthenticated method page/API access | `npm run test:e2e -- --workers=1`: 7 tests passed, including the methods page and all methods APIs. | Closed |
| REV-METHOD-VERSIONING-001-04 | P1 | Attachment upload leaves an orphan object when metadata/audit fails | `uploadMethodAttachment` removes the uploaded object in its failure path; remote Storage verification remains blocked by 001. | Pending remote verification |
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

## Decision

T-301 is not complete while finding 001 and the dependent remote verification remain open. After a user-authorized execution of `202607150010_method_storage.sql`, rerun the method integration script, confirm private Storage read/write boundaries and cleanup, then close 001 and 004 and complete T-301E.
