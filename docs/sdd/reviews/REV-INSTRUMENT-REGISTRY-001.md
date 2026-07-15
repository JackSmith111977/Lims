# Instrument Registry Adversarial Review

| Item | Value |
| --- | --- |
| Review ID | REV-INSTRUMENT-REGISTRY-001 |
| Scope | DES-INSTRUMENT-REGISTRY-001; FR-EQUIP-001～003; FR-EQUIP-006; AC-RESOURCE-001; T-401 |
| Date | 2026-07-15 |
| Status | Closed |

## Attack scope

- Duplicate or malformed instrument identity, invalid owner/status/date, and forged server-controlled fields.
- Direct table writes, reader-role RPC execution, and status restoration after SCRAPPED.
- Using a scrapped instrument for new experiment data, losing usage association, or missing audit records.
- Unauthenticated page/API access and temporary users/resources surviving cleanup.

## Findings

| ID | Level | Scenario | Evidence / resolution | Status |
| --- | --- | --- | --- | --- |
| REV-INSTRUMENT-REGISTRY-001-01 | P0 | A caller creates a duplicate, malformed, or invalid initial instrument state. | `create_instrument` validates required fields, owner state and ACTIVE/INACTIVE initial status; the unique database constraint protects the code. Remote duplicate/invalid-status checks passed. | Closed |
| REV-INSTRUMENT-REGISTRY-001-02 | P0 | A privileged client bypasses the service boundary and writes or deletes instrument rows without audit. | Authenticated clients receive only SELECT on `instrument`; insert/update/delete are guarded by RLS and the write trigger. The two RPCs derive the operator and write audit records. Remote direct-write and audit-parity checks passed. | Closed |
| REV-INSTRUMENT-REGISTRY-001-03 | P1 | A scrapped instrument is restored or used for new experiment data. | `update_instrument` makes SCRAPPED terminal, and the existing experiment-data insert guard rejects scrapped instruments. Remote restore and blocked-data checks passed. | Closed |
| REV-INSTRUMENT-REGISTRY-001-04 | P1 | A reader cannot see valid records, or usage association is lost. | `resource.read` RLS permits visibility; the service joins experiment data to expose usage count and latest collection time. Remote reader visibility and instrument-linked data checks passed. | Closed |
| REV-INSTRUMENT-REGISTRY-001-05 | P1 | Owner/status changes omit audit or accept an inactive owner. | RPC validation requires an ACTIVE owner and records before/after rows in `audit_log`; remote metadata/status and audit checks passed. | Closed |
| REV-INSTRUMENT-REGISTRY-001-06 | P1 | Unauthenticated users reach the device UI/API, or cleanup leaves test resources. | `/instruments` is included in the shared proxy protection; fresh production E2E passed 11/11. The dedicated integration harness rerun reported zero temporary users, instruments, tasks, samples, projects, and methods. | Closed |
| REV-INSTRUMENT-REGISTRY-001-07 | P2 | Owner-only cleanup is blocked by the write guard. | The first run exposed that SQL cleanup has no `auth.role()` context; cleanup now disables only the instrument user trigger around deletion and restores it. The rerun passed all checks and cleanup verification. | Closed |

## Quality evidence

- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm test -- --run`: 12 files / 45 tests passed.
- `npm run build`: passed; the known Windows SWC native binding warning falls back to the WASM/webpack path.
- `npm run test:e2e -- --workers=1 --reporter=line` with a fresh server on `PLAYWRIGHT_PORT=3012`: 11/11 passed.
- `npm run test:instrument-integration`: passed; all device security, association, terminal-state, audit, and cleanup checks passed.
- `scripts/sdd/check-consistency.ps1`: passed.
- `npm run check:versioning`: passed.
- `supabase migration list --linked`: local and remote migration state matches through `202607150015`.

## Decision

All P0/P1 findings are closed. T-401 and T-401E can be marked complete because the instrument registry RPC boundary, API/UI, status protection, experiment-data association, remote integration, cleanup verification, quality gates, and this adversarial review have been verified against the linked Supabase project.
