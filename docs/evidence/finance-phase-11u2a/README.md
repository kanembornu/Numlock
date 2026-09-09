# Finance Phase 11U.2A — local implementation accepted

Scope: dedicated ING-018 population, activation, and guarded recovery only. No production
execution, upload, deployment, or Git commit/push was performed. Existing worktree changes
were preserved. The original 21-authority executors and all shared validators remain unchanged.

## Accepted prerequisite

The user's Phase 11U.2A correction establishes Phase 11U.1 as COMPLETE/FROZEN: the authenticated
Apps Script editor ran `runInventoryLemonManagementDisposableRuntimeProof()` once with PASS
42 scenarios, existing21Authorities PASS, zero production writes, and cleanup PASS, followed
by `runAllBackendTests()` once with PASS 60/60. This is user-supplied runtime evidence and
supersedes the earlier CLI-blocked note in [11U.1](../finance-phase-11u1/README.md).
Neither runtime function was rerun in this task.

## Frozen evidence

The dedicated builder binds the exact [11U.1 evidence map](../finance-phase-11u1/drive-evidence-map.json):
file `1Gyv4scq6wm-VpEKcxcQg3iVxeHmmIiKV`, version `V01`,
SHA256 `7f3bf64c2678c0436beeadd317f1dbe0f638b3ee9aeedab6fe1d146f4f4b9ed0`.
It verifies bytes before parsing, then checks management identity, governance, conversion,
UOMs, dates, approval, and audit fields. It independently retrieves and hashes all 21 prior
manifests through the existing builder. Runtime candidate overrides are not consumed.

## Entry points and state contract

- `runInventoryLemonProductionPreflight()`: fresh-read, zero-write population preflight.
- `runInventoryLemonProductionPopulation()`: append only row 23, columns 1–24, initially inactive.
- `runInventoryLemonProductionActivation()`: change only row 23, column 20 (`IsActive`) to true.
- `runInventoryLemonProductionRecovery(record)`: guarded reversal of a failed owned write.
- `runInventoryLemonProductionDisposableRuntimeProof()`: isolated synthetic fixtures only.

Production entry points use the canonical production runtime and ScriptLock. They are implemented
but were not executed. Preflight requires the exact contiguous frozen 21 active rows, all 22
valid items including active Lemon/slice, the expected schemas, a header-only InventoryLedger,
valid Account 1100, one Account 3200, no Account 3210, and disabled recipe consumption.
All preservation sheets must exist. Formulas, notes, overflow data, duplicates, and ambiguous
conversion states refuse with zero writes.

Operations compare two fresh reads before writing, flush once, and compare the exact semantic
post-image after a fresh read. Full values/formulas/notes/dimensions are preserved across
InventoryItems, InventoryOpenings, InventoryLedger, BalanceLedger, Accounts,
FinanceOpeningBalances, tabsal, and COGSRecipes. Conversion date cells permit equivalent Apps
Script Date representations; malformed values never count as blank audit fields.

Exact inactive population repeat returns ALREADY_POPULATED/writeCount0; exact active activation
repeat returns ALREADY_ACTIVATED/writeCount0. Repeating population against active Lemon refuses.
The inactive row cannot authorize posting. Active Lemon requires SINGLE_OPERATOR_VERIFIED and
the 2026-10-01 boundary; the conversion gate does not populate openings or authorize accounting.
The existing InventoryOpenings eligibility contract is unchanged, including its Lemon exclusion.

## Recovery and uncertainty

No failure automatically retries or rolls back. A failed write returns FAILED_REQUIRES_REVIEW
and its before/expected snapshots. A setter exception reports writeCount=null and
writeAttemptCount=1 because the physical outcome is uncertain. Successful setter return followed
by flush/acceptance failure reports writeCount=1. Full snapshots are returned, not logged.

Recovery revalidates evidence, the operation's valid preimage, its derived owned post-image,
current state, and a second fresh read. Production recovery additionally requires failedWrite=true.
It refuses any InventoryLedger business row, any Lemon-linked InventoryOpenings row, any later
conversion row, any other post-image change, or any populated BalanceLedger. The last guard is
conservative: BalanceLedger lacks a reliable item link, so absence of dependency is unproven.
Population recovery clears only the exact 24 owned cells; activation recovery reverts only
IsActive. It never deletes rows or overwrites preserved storage. Successful operations must
not be recovered in production. Recovery snapshots are needed for a separately reviewed failure;
no recovery state is written to production metadata.

## Local validation

`node verify-local.cjs` (or the repository-relative command in TESTING.md) passed:

- Actual local frozen V01 and 21-manifest bytes/hash/identity binding, plus tampered-byte refusal.
- New synthetic flow: 104 scenarios, 22 active authorities, zero conflicts.
- Inventory foundation: 39; schema migration: 22; conversion: 54;
  operator governance: 73; existing Lemon authority: 42.
- New proof entry executed locally in Node with no Google services.

The new tests are nested under the existing conversion suite entry; total membership stays 60.
No full backend suite was run for this additive impact radius. No current production state,
Drive accessibility, or new Apps Script runtime PASS is claimed.

Next gate: separately authorize upload of the reviewed source, run the new disposable proof
in Apps Script, then require fresh production READY before any separately authorized population
and activation. This task supplies no upload or production-execution authorization.
