# Treasury T3 — Contract, Schema, Config, and Account Eligibility Foundation

**Phase:** NUMLOCK_TREASURY_IMPLEMENTATION
**Task:** T3_TREASURY_CONTRACT_SCHEMA_CONFIG_ACCOUNT_ELIGIBILITY
**Classification:** COMPLEXITY L3 · OPERATIONAL_RISK R2 · REASONING_EFFORT high
**Scope:** Inert local foundation for `TREASURY_RECEIPT_V1` per the frozen T2 contract
(`docs/TREASURY-T2-RECEIPT-AUTHORITY-AND-RECONCILIATION-CONTRACT.md` — authoritative for all
column lists, codes, ID semantics, and signature pattern). No receipt/operation/audit writer,
no Cash/Bank posting, no 1030 clearing, no production mutation, no deployment, no Git commit.
**Evidence classes:** MEASURED = executed this session; SOURCE = repository source at HEAD
`360c95d`; PRIOR-MEASURED = accepted T1/T2 evidence at HEAD; DERIVED = logical consequence.

---

## 1. Starting baseline

- HEAD verified `360c95d` (T2 contract commit; prior `0b2f05d` T1, runtime baseline `0cf8aba`
  = v711-equivalent). Index empty (zero staged). Tracked worktree clean before work.
- Untracked inventory at start: exactly 27 `tests/tmp/u10e-*` files — never cleaned, deleted,
  staged, or modified (re-verified in §43/§44 of the final report).
- Runtime source outside this task's new files: byte-identical (no clasp-packaged file edited).
- KNOWN_PRIOR_EVIDENCE (not re-proven): regression baseline 101 PASS / 0 FAIL MEASURED at
  `360c95d`; T2 harness 25/0; writer exclusivity {39,40,41,47,97A,97C}; idempotency =
  source-key signature + readback.

## 2. Implemented modules

| File | Role |
| --- | --- |
| `99.Treasury.Receipt.Foundation.js` | Inert Treasury foundation: contract constant, schema validators, config reader/classifier, destination eligibility, 1030 preflight, date authority, identity helpers, journal signature, error catalog subset |
| `96.Tests.Treasury.Receipt.Foundation.Cases.js` | Focused T3 suites A–H + 15-point mutation sensitivity |
| `_test_runner.js` (test infra edit only) | Registered the two new files and 10 `run(...)` entries; injected `_treasuryFoundationSource` for the source-audit suite; zero behavior change to any existing test |

Naming follows the flat Apps Script/V2 convention (`97*.SalesRecognition.V2.*` → `99.*`);
T2 §28 prescribes a "98x/9x-class foundation module"; `98.Tests.Runner.js` was already taken,
so `99.` was selected. Apps Script V8-compatible, flat, pure ES5-style source.

## 3. Schemas (exact, frozen T2 §4.1–4.3)

- `TreasuryReceipts` = exactly **24** columns, frozen order, first `TreasuryReceiptID`, last
  `SnapshotJSON`, **no stored `Status`** (`ReceiptStatus` is derived later; `PostingStatus`
  column 18 is the write-once `COMMITTED` literal). `EconomicDate` and `ReceiptDate` both exist
  (§4.1 rejected merging them).
- `TreasuryOperations` = exactly **10** columns (`TreasuryOperationID … LastError`),
  independent sheet — `TransactionOperations` is never reused.
- `TreasuryAudits` = exactly **11** columns (`AuditID … SavedAt`).
- `validateTreasurySchemaHeaders(schemaKey, headers)` semantics: strict frozen extent — every
  required column present exactly once at its frozen position; missing, renamed, reordered,
  duplicated, or added columns all fail with `TREASURY_SCHEMA_NOT_READY` + a precise
  `detail` (`WIDTH_MISMATCH` / `COLUMN_MISMATCH` / `DUPLICATE_COLUMN` / `HEADERS_NOT_AN_ARRAY`
  / `UNKNOWN_SCHEMA`). Additive columns are **rejected**: unlike U9's historical read-only
  master sheets (where extras were proven safe for name/prefix-based readers), T2 freezes
  Treasury sheets as exact and a stored-`Status`-style additive column is exactly the
  duplicate-authority defect T2 §4.1 forbids; tests prove both accept (exact 24/10/11) and
  reject (all five defect classes).

## 4. Config semantics (T2 §5)

Property key `TREASURY_RECEIPT_V1_CONFIG` (Script Properties, JSON), fields
`mode / contractVersion / activationID / activatedAt / configVersion`.

- `validateTreasuryReceiptConfig` mirrors `validateSalesRecognitionV2Config` with frozen
  Treasury codes: mode exact enum after trim, case-sensitive (`"active"` invalid;
  `" ACTIVE "` accepted per T2's "(trimmed, case-sensitive)" wording); `contractVersion`
  literal `TREASURY_RECEIPT_V1`; `configVersion` integer ≥ 1; activation identity both
  blank-string in PREPARED (`TREASURY_ACTIVATION_METADATA_PRESENT` if present), both non-blank
  strict ISO-8601 **UTC** (`…Z`, calendar-validated) in ACTIVE/PAUSED
  (`TREASURY_ACTIVATION_METADATA_MISSING` if absent, `…_INVALID` if malformed); non-string
  fields → `TREASURY_ACTIVATION_METADATA_INVALID`; unknown mode/blank → `TREASURY_CONFIG_INVALID`;
  wrong version → `TREASURY_CONTRACT_VERSION_MISMATCH`; bad configVersion →
  `TREASURY_CONFIG_VERSION_INVALID`. Invalid config is never repaired and never ACTIVE.
- `treasuryReceiptConfigFromRaw(raw)`: missing property / blank / invalid JSON →
  deterministic `TREASURY_CONFIG_INVALID` (no default mode — unlike Sales U7, absence is not
  PREPARED). `treasuryReceiptConfigState()`: read-only `PropertiesService` reader (only
  `getProperty` on the frozen key; zero writes reachable — MEASURED with a write-tracking mock,
  suite C20–C22). No activation writer, no config editor exists in this module.

## 5. Config modes (classifier)

`treasuryReceiptModeGate(config)` / `treasuryReceiptResolvedGate()`:

- **PREPARED** → `{allowed:false, code:TREASURY_NOT_ACTIVATED}` — no receipts possible (T3 has
  no writer at all; this is the future T4 gate).
- **ACTIVE** → `{allowed:true}` — future writer gate only; every other T2 gate stays with T4+.
- **PAUSED** → `{allowed:false, code:TREASURY_MODE_PAUSED}`; T2 keeps reads/recovery available
  (read paths are T5+, not present here).
- Malformed/missing/wrong-contract/incomplete-ACTIVE → specific frozen code; never ACTIVE; no
  legacy fallback branch exists on any refusal path (suite H/M15).

## 6. Destination eligibility (T2 §6)

`treasuryDestinationEligible(code, accounts)` — deterministic on the frozen cash-universe
authority `CASH_FOUNDATION_POLICY.ACCOUNT_CODES` (`{1000,1010,1020}`, `40.Cash.Foundation.js`),
never on names:

1. `code === "1030"` → `TREASURY_DESTINATION_IS_CLEARING` (structural, checked first).
2. `code ∉ {1000,1010,1020}` (covers the centralized forbidden set `FORBIDDEN_JOURNAL_ACCOUNTS =
   {4000,5000,1100,2000,2010,6210}` and any unknown code) →
   `TREASURY_INVALID_DESTINATION_ACCOUNT` (`NOT_IN_CASH_UNIVERSE`) — matches the frozen T2
   harness precedence, where §6 governs destination proposals and
   `TREASURY_FORBIDDEN_JOURNAL_ACCOUNT` remains the §8 journal-line rule for the T4 writer
   (`treasuryForbiddenJournalAccount(code)` predicate centralized in T3).
3. Master malformed (not an array / non-object rows) → `TREASURY_INVALID_DESTINATION_ACCOUNT`
   (`MALFORMED_MASTER`).
4. Absent / duplicate row → `TREASURY_INVALID_DESTINATION_ACCOUNT`.
5. `IsActive` falsy (incl. `"FALSE"`; via proven `isCanonicalActive`) →
   `TREASURY_DESTINATION_ACCOUNT_INACTIVE`.
6. `AccountType !== "Asset"` or `NormalBalance !== "DEBIT"` →
   `TREASURY_INVALID_DESTINATION_ACCOUNT` (`METADATA_MISMATCH`).

`AccountName` is never read — name inference is structurally impossible (suite D16/D17, M9).
The production 4000 blank-`NormalBalance` convention appears only as an inert fixture row;
eligibility/preflight never validate 4000, so global validation is unaffected (D18).
The Accounts master is never mutated. §6.6 (journal-snapshot membership) is a T4 writer-time
gate and is out of T3 scope.

## 7. 1030 readiness preflight (T2 §21, §28)

`treasuryClearingPreflight(accounts)` — pure, read-only: 1030 must exist exactly once, be
active, `Asset`/`DEBIT`, and `CashFlowGroup === "Operating"` (blank ⇒
`CASH_FLOW_GROUP_UNCLASSIFIED` fail-closed). The frozen T2 catalog contains no
clearing-specific runtime code, so every preflight failure surfaces the exact code
`TREASURY_SCHEMA_NOT_READY` with a precise `reason`
(`ABSENT|DUPLICATE|INACTIVE|METADATA_MISMATCH|CASH_FLOW_GROUP_UNCLASSIFIED|MALFORMED_MASTER`) —
no invented aliases. 1030 can never be a destination (§6 rule 1). Full 1030 projection and
clearing computation remain T5-owned.

## 8. Date authority (T2 §9)

- `treasuryDateKey(instant)` — exact T2 name — calls
  `Utilities.formatDate(instant, CANONICAL_ENTRY.TIMEZONE, "yyyy-MM-dd")` with
  `CANONICAL_ENTRY.TIMEZONE === "Asia/Jakarta"` (MEASURED via argument capture). Host-local
  `canonicalDateKey` is forbidden and unused (source audit H3). Invalid instants throw
  `TREASURY_DATE_INVALID` (fail-closed; no silent parse).
- `treasuryValidateReceiptDate(value)`: strict `YYYY-MM-DD` real-calendar string → else
  `TREASURY_DATE_INVALID`.
- `treasuryValidateEconomicDate(receiptDate, economicDate)`: both must be valid date keys,
  then **byte-equal** (V1 rule) → else `TREASURY_ECONOMIC_DATE_MISMATCH`. Arbitrary override
  is structurally impossible in V1. No historical date rewrites (no writer exists).
- Battery MEASURED (Jakarta-true UTC+7 stand-in, restored in finally; assertions host-agnostic
  via simulated UTC-host key): Jakarta daytime 08:00Z → same day; 16:59:59Z → same day;
  17:00:00Z → next day; UTC day diverges (20:00Z → next Jakarta day); month boundary
  2026-09-30T17:00:00Z → 2026-10-01 while UTC-host key stays 2026-09-30 (the Δ12,000 lesson
  replicated as a regression test); year boundary 2026-12-31T17:00:00Z → 2027-01-01; leap
  2028-02-28T17:00:00Z → 2028-02-29; malformed instants throw `TREASURY_DATE_INVALID`;
  ambiguous/malformed date strings (`2026-02-30`, `2026-13-01`, `10-10-2026`, empty, non-string)
  all rejected.

## 9. ID namespaces (T2 §8.2)

| Helper | Prefix | Digest parts |
| --- | --- | --- |
| `treasuryOperationId(type, key)` | `TROP-` | `(OperationType, RequestKey)` |
| `treasuryReceiptId(type, key, side)` | `TRC-` | `(OperationType, RequestKey, side)` |
| `treasuryJournalId(type, key, side)` | `TRJ-` | `(OperationType, RequestKey, side)` |
| `treasuryAuditId(type, key, side)` | `TRA-` | `(OperationType, RequestKey, side)` |

- `side ∈ {PRIMARY, REVERSAL, REPLACEMENT}`; unknown type/side/blank key →
  `TREASURY_PAYLOAD_INVALID` (fail-closed throw).
- Digest = `treasuryStableId_`, byte-for-byte the proven
  `transactionStableBootstrapId_` canonicalization class (95A) under the Treasury namespace —
  MEASURED cross-check equality with `transactionStableBootstrapId_` for identical inputs
  (F6): same scheme, not a second one. Stable across runs; sensitive to type/key/side;
  namespace-isolated by prefix (TRC/TRJ never collide — M14). Pure: no ID is persisted, no
  server-uuid path exists for these four ID classes. `TRACT-` activation IDs remain
  server-generated by the future activation module (not T3).

## 10. Signature helper (T2 §8.1)

`treasuryJournalSignature(rows)` — sorted-row canonical digest of
`[AccountCode, Debit, Credit, MovementType, SourceType, SourceID, capitalEquityDateKey(Tanggal)]`
joined `"|"` per row and `"||"` across rows: the proven `cashJournalSignature` /
`policyCJournalSignature_` pattern. MEASURED cross-check: identical output to
`cashJournalSignature` on the same fixture rows (G3). Sensitivity MEASURED on amount,
destination, 1030 leg, `SourceID`, `MovementType`, `SourceType`, `Tanggal`; row-order
independent (G2). `MovementType TREASURY_RECEIPT`, `SourceType TREASURY_RECEIPT_V1`
(constants; reversal movement type also frozen). Pure in-memory only — no BalanceLedger
writer is invoked or referenced anywhere in the module.

## 11. Error catalog (T2 §24 subset, centralized in `TREASURY_RECEIPT_V1_CONTRACT.ERROR_CODES`)

`TREASURY_CONFIG_INVALID`, `TREASURY_NOT_ACTIVATED`, `TREASURY_MODE_PAUSED`,
`TREASURY_CONTRACT_VERSION_MISMATCH`, `TREASURY_CONFIG_VERSION_INVALID`,
`TREASURY_ACTIVATION_METADATA_PRESENT`, `TREASURY_ACTIVATION_METADATA_MISSING`,
`TREASURY_ACTIVATION_METADATA_INVALID`, `TREASURY_SCHEMA_NOT_READY`,
`TREASURY_INVALID_DESTINATION_ACCOUNT`, `TREASURY_DESTINATION_ACCOUNT_INACTIVE`,
`TREASURY_DESTINATION_IS_CLEARING`, `TREASURY_FORBIDDEN_JOURNAL_ACCOUNT`,
`TREASURY_DATE_INVALID`, `TREASURY_TIMEZONE_INVALID`, `TREASURY_ECONOMIC_DATE_MISMATCH`,
`TREASURY_PAYLOAD_INVALID`. Exact frozen strings only; no invented aliases; unused-in-T3
catalog entries (e.g. `TIMEZONE_INVALID`, `FORBIDDEN_JOURNAL_ACCOUNT`) exist as constants for
T4+ consumers.

## 12. Tests (focused T3 suites, MEASURED via `node _test_runner.js`)

| Suite | Function | Coverage |
| --- | --- | --- |
| A | `testTreasuryT3ContractConstants` | version/property/modes, 24/10/11 counts, prefixes, cash universe, forbidden set, tz, catalog |
| B | `testTreasuryT3SchemaValidation` | accept exact; reject missing/renamed/reordered/duplicate/added/width/null/unknown key |
| C | `testTreasuryT3ConfigClassifier` | PREPARED/ACTIVE/PAUSED gates; missing/blank/JSON/wrong-version/unknown-mode/incomplete-ACTIVE/PREPARED-with-identity/configVersion/malformed-timestamp/null; trim semantics; reader absent/read-only/invalid |
| D | `testTreasuryT3DestinationEligibility` | 1000/1010/1020 eligible; 1030 clearing; each forbidden rejected + predicate; unknown/blank; duplicate; absent; inactive (bool + `"FALSE"`); wrong type; wrong balance; rename no-effect; name-bait rejected; malformed master; 4000 blank-NormalBalance inert; 1030 preflight PASS/INACTIVE/ABSENT/blank-CashFlowGroup |
| E | `testTreasuryT3DateAuthority` | Jakarta battery (daytime, 23:59, 00:00, UTC-divergence, month/year boundary, leap); arg capture `"Asia/Jakarta"`/`"yyyy-MM-dd"`; malformed instants throw; receipt/economic date rules incl. byte-equality and precedence |
| F | `testTreasuryT3IdentityNamespaces` + `testTreasuryT3IdentityFailClosed` | four namespaces, regex/format, determinism, 95A class equality, side/type/key sensitivity, isolation, fail-closed args |
| G | `testTreasuryT3JournalSignature` | pattern, order independence, cashJournalSignature equality, 7-field sensitivity |
| H | `testTreasuryT3LegacyIsolation` | source-string audit: no legacy money tokens, no write primitives, no host-local date, no uuid path; read-only properties access; gate shape has no fallback/legacy route |
| M | `testTreasuryT3MutationSensitivity` | 15/15 (below) |

MEASURED: full `node _test_runner.js` after final source modification = **111 PASS, 0 FAIL**
(baseline 101 + 10 new T3 functions). One repair cycle applied during development (runner
call-name typo, E15 precedence expectation, comment-token leak) — all failures gone in the
final measured run.

## 13. Mutation sensitivity (15/15 MEASURED, in-memory only; nothing left in source)

| # | Mutation | Caught by |
| --- | --- | --- |
| M1 | remove header column | schema validator FAIL |
| M2 | swap header columns | schema validator FAIL |
| M3 | add stored `Status` column | schema validator FAIL (width/position) |
| M4 | changed `contractVersion` | `TREASURY_CONTRACT_VERSION_MISMATCH` |
| M5 | missing-config → ACTIVE attempt | `TREASURY_CONFIG_INVALID`; resolved gate never allows |
| M6 | ACTIVE without identity | `TREASURY_ACTIVATION_METADATA_MISSING`; gate refuses |
| M7 | 1030 destination | `TREASURY_DESTINATION_IS_CLEARING` |
| M8 | non-foundation account destination | `TREASURY_INVALID_DESTINATION_ACCOUNT` |
| M9 | name inference (bait + rename) | eligibility unchanged by names; bait rejected |
| M10 | ignore inactive master row | `TREASURY_DESTINATION_ACCOUNT_INACTIVE` |
| M11 | ignore wrong normal balance | `TREASURY_INVALID_DESTINATION_ACCOUNT` |
| M12 | host-local (UTC) date on boundary | Jakarta key 2026-10-01 ≠ UTC-host 2026-09-30 |
| M13 | broken Jakarta boundary handling | 16:59:59Z vs 17:00:00Z keys must differ |
| M14 | merge TRC/TRJ namespaces | distinct prefixes/IDs enforced |
| M15 | legacy money fallback surface | no fallback route in gate; no legacy tokens in source |

## 14. Source / call-graph audit

New Treasury call graph (complete): module → `CASH_FOUNDATION_POLICY`, `CANONICAL_ENTRY`,
`isCanonicalActive`, `capitalEquityDateKey`, `Utilities.formatDate`, `PropertiesService
.getScriptProperties().getProperty` (read-only), `JSON.parse`, `Error`. Zero outbound calls to
any writer (`39/40/41/47/95A/95/97*/97A/97C/97D/97E` mutation paths untouched); zero inbound
callers (no existing runtime file references any Treasury symbol; registration exists only in
the local test runner). Grep-proven absent from the module: `setValues`, `appendRow(s)`,
`batchUpdate`, `setValue`, `setProperty`, `insertRow*`, `getSheetByName`, `createSheet`,
`insertSheet`, `SpreadsheetApp`, `canonicalDateKey`, `getUuid`, legacy money tokens
(`Payment`, `Settlement`, `ReceiveVia`, `PaymentMethod`, `tabsal`, `tabops`). Existing-domain
write primitives classified: `97A` Sales save batch, `97C` correction batch, `97E` activation
property write, `39/40/41/47` ledger/inventory/purchase writers — all pre-existing, unchanged,
and unreachable from Treasury code. Runtime source outside the three listed test-side files is
byte-identical to `360c95d`.

## 15. Package impact (`.claspignore` allowlist)

- Allowlist currently contains 68 entries (`**` ignore + explicit `!` includes); `tests/`,
  `docs/`, `tests/tmp/`, and `_test_runner.js` are excluded by default and stay excluded.
- `99.Treasury.Receipt.Foundation.js` is **not yet listed** in `.claspignore`, so the uploaded
  package is unchanged today (inert module needs no deployment). `.claspignore` was not
  modified (outside T3 authorized files).
- Expected future package count: **69** once `!99.Treasury.Receipt.Foundation.js` is added
  under the separate T4/push authorization gate (upload-manifest gate per AGENTS.md applies).
- No secrets, credentials, or production identifiers in any new file.

## 16. Production safety

- Production writes = 0; deployment actions = 0; `clasp push`/version/deploy = 0; Git
  push/stage/commit = 0; config property writes = 0; production schema creation = 0;
  migration/backfill = 0; BalanceLedger/Cash/Bank/Sale/Payment/Settlement/refund/AP mutations
  = 0; 1030 clearing = 0. Production read: not attempted (optional; no production fact is
  required by this inert foundation).
- No TreasuryReceipt/Operation/Audit row exists or can be created by any code in this change.
- Blocking statuses `BLOCKED_ACCOUNT_AUTHORITY` / `BLOCKED_ACCOUNTING_CONTRACT`: not triggered
  (T2 §6/§15/§27 remain reconciled; eligibility resolves deterministically from the frozen
  cash-universe constant + master validation).

## 17. Deferred T4+ responsibilities

- **T4:** durable Save — lock, exposure resolution, outstanding projection gate, OperationPlan
  freeze, `IN_PROGRESS` intent + readback, single atomic batch (receipt row + 2 ledger lines +
  1 audit row), artifact verification, COMMITTED transition, cache bump, recovery/replay
  (`PayloadHash` via `transactionPayloadHash_` class), writer-time §6.6 snapshot gate.
- **T5:** 1030 per-exposure projection + global reconciliation report (read-only).
- **T6:** reversal + correction writers (atomic, lineage, immutability).
- **T7:** operator UI + client invalidation; PAUSED read-only surface.
- **T8:** Finance integration proofs (zero-edit readers).
- **T9:** release gate (mutation sensitivity over real writers, historical preservation).
- **T10:** separately authorized production activation (`TRACT-` uuid writer) + genuine first
  receipt acceptance. Sheets `TreasuryReceipts/TreasuryOperations/TreasuryAudits` are created
  only under separate schema authorization (T4+), using §3 exact headers.

---

*Telemetry: agent numlock-explore-free (Free execution authority for this Heavy L3/R2 task);
backend `9router/numlock-explore-free`; reasoning high; fallback used none (no escalation —
no `AUTHORITY_CONFLICT` or other named reason materialized; T2 proved implementable as
written); toolcalls MEASURED ≈ 40; elapsed ≈ 45 min; files read 12 (T2/T1 docs, `_test_runner.js`,
`.claspignore`, `97/97D`, `40.Cash`, `39.Balance`, `95A`, `20.Data`, `38`, `96.Tests.Sales…Activation`,
T2 harness); files modified 4 (`99.Treasury.Receipt.Foundation.js` new,
`96.Tests.Treasury.Receipt.Foundation.Cases.js` new, `_test_runner.js` registration,
`docs/TREASURY-T3-CONTRACT-SCHEMA-CONFIG-ACCOUNT-ELIGIBILITY.md` new); test runs: 1 focused
failed cycle (3 FAIL) + 1 final MEASURED run (111 PASS / 0 FAIL).*
