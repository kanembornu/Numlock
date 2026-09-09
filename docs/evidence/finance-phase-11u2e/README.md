# Finance Phase 11U — COMPLETE/FROZEN with preservation-evidence limitation

Phase 11U.2E closes Phase 11U conservatively on 2026-09-06 (Asia/Jakarta).
This closure records existing evidence and a new POST-11U baseline. It does not
create or imply PRE-11U evidence.

## Accepted authority and execution evidence

The user accepted one production population write, one activation write, and final
acceptance PASS. Phase 11U.2D fresh reads and local read-model evaluation established
22 accepted active authorities, zero conflicts, and exactly one active ING-018
with SINGLE_OPERATOR_APPROVED / SINGLE_OPERATOR_VERIFIED. Lemon is exactly
1000 gr to 24 slice, BaseUOM=slice, EffectiveFrom=2026-10-01. Before that date the
authority gate refuses; on/after it otherwise-valid authority is accepted.
The V01 Drive identity and downloaded bytes SHA256 matched the frozen binding;
the original 21 conversion authorities semantically matched frozen candidates.
Those are prior verified evidence, not runtime executions performed in this closure.

The new read-only capture again confirms 22 active conversion rows and the exact
Lemon ratio/approval, header-only InventoryOpenings, InventoryLedger and BalanceLedger,
and absent Account 3210. Current Account 1100 is active Inventory Asset, Asset,
Current Assets, Operating, DEBIT. Current Account 3200 is active Retained Earnings,
Equity, Retained Earnings, NonCash, CREDIT. All 10,712 tabsal.HPP data cells were
captured with their header. Recipe auto-consumption is disabled in inspected source;
this is not a new runtime configuration attestation. No evidence of unrelated
corruption was found in the inspected surfaces; no global absence-of-corruption claim
is made.

## Explicit historical limitation

No saved PRE-11U snapshot exists for the following comparisons:

- InventoryItems historical preservation.
- BalanceLedger historical preservation.
- Account 1100 historical preservation.
- Account 3200 historical preservation.
- tabsal.HPP historical preservation.
- Global proof that no unrelated production mutation occurred.

These historical claims remain UNPROVEN and cannot be reconstructed from a current
snapshot. Accepted population/activation write counts do not independently establish
global no-unrelated-mutation proof. The user explicitly permits COMPLETE/FROZEN with
this documented limitation. No downstream InventoryOpenings or InventoryLedger
business rows exist. Conversion authority alone does not establish inventory openings
or accounting posting authority.

## POST-11U baseline for subsequent phases

- [POST-11U.snapshot.json](POST-11U.snapshot.json): fresh read-only connector payloads,
  exact bounded ranges, sheet dimensions/metadata, entered/effective values, formulas
  and notes for all nine preservation sheets used by the Lemon flow.
- [POST-11U.fingerprints.json](POST-11U.fingerprints.json): SHA256 of the exact snapshot
  bytes, canonical per-sheet fingerprints, and a dedicated tabsal.HPP fingerprint.

Capture window: 2026-09-05 20:35:10–20:35:29 UTC (2026-09-06 03:35:10–03:35:29
Asia/Jakarta). Reads across ranges are not an atomic cross-sheet transaction.
This baseline covers cell data and recorded metadata, not all possible spreadsheet
features, deployed source, Drive history, or an audit of external actors.

For future comparisons, read the same fields/ranges with fresh metadata. Merge blocks
by sheet title and absolute 1-based row/column; preserve nonempty returned CellData
objects and their API omission semantics. Hash each sheet's properties and sparse
cell map using the canonicalization documented in the fingerprint file. Compare
dimension changes explicitly. Date serials and API representation changes may require
semantic review; raw fingerprint differences alone do not establish corruption.
The HPP fingerprint includes column F's header and cells. Do not compare capture
timestamps as production data or label this baseline PRE-11U.

## Validation and task boundaries

All 14 bounded range reads succeeded. Snapshot JSON parsed, fingerprints were generated,
and current row-count, active-count, Lemon ratio/approval, empty downstream ledgers,
and absent-3210 assertions passed. Documentation links and git diff --check passed.
No backend suite, Apps Script mutation function, recovery, production write, clasp
push, deployment, Git staging, commit or push was performed. Existing worktree changes
were preserved. Subsequent phases must use this POST-11U baseline prospectively.
