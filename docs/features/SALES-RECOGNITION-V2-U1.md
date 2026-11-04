# SALES_RECOGNITION_V2 — U1 Foundation

Scope: U1 only. Companion contract, config semantics, sticky cohort classifier, account preflight.
No writer, no durable Save, no projection, no activation, no accounts creation, no U2+.

Source of truth: `97.SalesRecognition.V2.Foundation.js`.
Design reference: SALES_RECOGNITION_V2 architecture sections 3, 4, 8, 9, 10-U1, 11-U1.

## Companion contract

Sheet `SalesRecognitionEvents`, exact header order (20 columns):

`RecognitionID, ContractVersion, ActivationID, OrderID, RevisionID, EventType, RecognizedAt,
EconomicDate, Amount, RecognitionJournalID, JournalSignature, PostingStatus, OperationID, AuditID,
OriginalID, ReversalOfRecognitionID, ReplacementID, Reason, Actor, SnapshotJSON`

`EventType` ∈ `RECOGNITION | REVERSAL`. `ContractVersion` = `SALES_RECOGNITION_V2`.
Append-only lineage; no mutable `IsVoided`.

## Config record

Fields: `mode`, `contractVersion`, `activationID`, `activatedAt`, `configVersion`.
Modes: `PREPARED / ACTIVE / PAUSED`. Default `SALES_RECOGNITION_V2_CONTRACT.DEFAULT_CONFIG`:
`mode=PREPARED`, `contractVersion=SALES_RECOGNITION_V2`, `activationID=""`, `activatedAt=""`
(no timestamp `T` value at default), `configVersion=1`.

Strict validation (`validateSalesRecognitionV2Config`), fail-closed on:

- `mode` and `contractVersion`: must be exact strings (`MODE_INVALID`, `CONTRACT_VERSION_MISMATCH`).
- `configVersion`: integer ≥ 1 (`CONFIG_VERSION_INVALID`).
- `activationID` / `activatedAt`: must be actual strings — missing keys, numbers, objects fail
  (`ACTIVATION_METADATA_INVALID`), no coercion.
- `PREPARED`: both activation fields must be exactly `""`; any value fails
  (`ACTIVATION_METADATA_PRESENT`).
- `ACTIVE` / `PAUSED`: both fields non-blank (`ACTIVATION_METADATA_MISSING`).
- `activatedAt` must be an unambiguous ISO 8601 date-time with explicit timezone designator
  (`YYYY-MM-DDTHH:MM:SS[.mmm](Z|±HH:MM)`), real calendar day, and hour/minute/second in range;
  otherwise `ACTIVATION_TIMESTAMP_INVALID`. The old operational instant
  `2026-10-06T18:50:05.328Z` is rejected in every offset representation
  (`ACTIVATION_TIMESTAMP_FORBIDDEN`, epoch-compared).
- `salesRecognitionV2RequestGate(config)` — pure gate: invalid config → `CONFIG_INVALID`,
  `PREPARED → V2_NOT_ACTIVATED`, `PAUSED → V2_MODE_PAUSED` (refusal, never a legacy fallback),
  `ACTIVE → allowed`.
- Pause/resume does not change `contractVersion` or activation metadata.

## Sticky cohort classifier

`classifySalesRecognitionCohort(order, context)` → `{ cohort, status, code }`.
Pure: never mutates inputs, never throws on malformed context.
Precedence (deterministic, order matters):

1. Context collection typing: `context.intents|events|operations`, when present, must be arrays of
   plain objects; wrong types / null elements / non-object `context` →
   `INCONSISTENT / RECOVERY_REQUIRED / EVIDENCE_MALFORMED`.
2. Evidence scoping by `OrderID`:
   - rows bound to another `OrderID` are identified and ignored;
   - rows with missing `OrderID` (unbound) are refused
     (`EVIDENCE_UNBOUND`) — never attached to any order;
   - order-level `ContractVersion` without `OrderID` is also refused (`EVIDENCE_UNBOUND`).
3. Scoped companion evidence with missing `ContractVersion` →
   `INCONSISTENT / RECOVERY_REQUIRED / EVIDENCE_CONTRACT_INVALID` (never ignored, never a legacy
   fallthrough). Unknown `ContractVersion` → `IDENTITY_CONFLICT`.
4. Persisted V2 evidence (intents / events / operations / order-level marker) outranks legacy
   fields and dates:
   - committed (`State`/`PostingStatus` = `COMMITTED`) → `V2_COMMITTED`
   - otherwise → `V2_PENDING` — pending V2 is never legacy, regardless of mode (`PAUSED`
     included) and regardless of legacy `PaymentStatus`/`FulfillmentStatus` fields on the order.
5. Contradictory `ActivationID` across related V2 records (evidence vs evidence, order vs
   evidence) → `INCONSISTENT / RECOVERY_REQUIRED / IDENTITY_CONFLICT`.
6. TabSal detection (works without `OrderID`; no `OrderID` is invented):
   `sourceSheet|Source|sheet|SheetName` = `tabsal`, or `ID_Trx` with historical `SAL-` prefix
   (`SAL-APP-…`), or raw tabSal schema shape (`ID_Trx` + `Tanggal` + `ID_Prod`)
   → `TABSAL_LEGACY`. An `ID_Trx` that matches none of these stays `UNKNOWN`.
7. Pre-V2 Order/payment contract fields (`PaymentStatus`/`FulfillmentStatus`) → `PRE_V2_ORDER`.
8. Date signals only (no persisted evidence) → `INCONSISTENT / UNKNOWN /
   DATE_ONLY_NO_PERSISTED_EVIDENCE`. Dates alone never classify.
9. No evidence at all → `UNKNOWN / UNKNOWN / NO_PERSISTED_EVIDENCE`.

Status vocabulary: `OK`, `UNKNOWN`, `RECOVERY_REQUIRED` (architecture vocabulary).
No path returns `OK` for ambiguous input (no false-OK).

## Account preflight

`preflightSalesRecognitionAccounts(rows)` — pure, zero writes, over supplied logical Accounts rows
(9-column schema), uniqueness counted across active and inactive rows:

| Code | Required metadata | Source |
| --- | --- | --- |
| `1030` | Sales Settlement Clearing / Asset / Current Assets / DEBIT / active / unique | architecture section 8 |
| `2010` | Customer Refund and Credit Payable / Liability / Current Liabilities / CREDIT / active / unique | architecture section 8 |
| `4000` | `BALANCE_FOUNDATION_PARTIAL_ACCOUNTS_RECOVERY.ACCOUNT_CORE["4000"]` (Sales Revenue / Revenue / Operating Revenue / Operating) + NormalBalance `CREDIT`, active / unique | repository source: `39.Balance.Foundation.js`, NormalBalance from `96.Tests.Cash.Foundation.Cases.js` |

`2000` stays supplier Accounts Payable: not validated, not modified, not required.
Absent / duplicate / wrong / inactive → `FAIL` (fail closed). `4000` authority unavailable → throw
(`ACCOUNT_METADATA_MISMATCH:4000_AUTHORITY_UNAVAILABLE`), never a degraded pass.

## Public input/status contract and rejection semantics

| Function | Input shape | Output | Rejection semantics |
| --- | --- | --- | --- |
| `salesRecognitionV2DefaultConfig()` | none | frozen default config record | n/a |
| `validateSalesRecognitionV2Config(config)` | plain config object | `{ status: "PASS"\|"FAIL", errors: [{field, code}] }` | fail closed: any violation ⇒ `FAIL` with one error per violated rule; non-object input ⇒ `CONFIG_INVALID` |
| `salesRecognitionV2RequestGate(config)` | plain config object | `{ allowed: boolean, code }` | refusal codes only; a refusal never converts into a legacy/`OK` path |
| `classifySalesRecognitionCohort(order, context)` | `order`: logical row object (or null); `context`: optional object with `intents`/`events`/`operations` arrays of row objects plus optional `config`/`mode`/`activatedAt` | `{ cohort, status, code }` | pure, deterministic, no side effects, no throw on malformed input; ambiguity/conflict ⇒ `status=RECOVERY_REQUIRED`, insufficient evidence ⇒ `status=UNKNOWN`, never a false `OK` |
| `preflightSalesRecognitionAccounts(rows)` | array of logical Accounts row objects (non-array tolerated as empty ⇒ absent errors) | `{ status: "PASS"\|"FAIL", errors: [{accountCode, code}] }` | zero writes; absent/duplicate/wrong/inactive ⇒ `FAIL`; malformed rows ⇒ `ACCOUNT_ROW_INVALID` |

Status meanings: `OK` — determinate cohort, safe to act on. `UNKNOWN` — evidence insufficient to
classify; no assertion may be derived. `RECOVERY_REQUIRED` — conflicting or malformed persisted
evidence; fail closed, human/deterministic recovery required before any downstream use.

## Local refusal codes (documented per U1)

Config: `MODE_INVALID`, `CONTRACT_VERSION_MISMATCH`, `CONFIG_VERSION_INVALID`,
`ACTIVATION_METADATA_PRESENT`, `ACTIVATION_METADATA_MISSING`, `ACTIVATION_METADATA_INVALID`,
`ACTIVATION_TIMESTAMP_INVALID`, `ACTIVATION_TIMESTAMP_FORBIDDEN`, `V2_NOT_ACTIVATED`,
`V2_MODE_PAUSED`, `CONFIG_INVALID`.
Classifier: `IDENTITY_CONFLICT`, `EVIDENCE_CONTRACT_INVALID`, `EVIDENCE_UNBOUND`,
`EVIDENCE_MALFORMED`, `NO_PERSISTED_EVIDENCE`, `DATE_ONLY_NO_PERSISTED_EVIDENCE`.
Preflight: `ACCOUNT_ROW_INVALID`, `ACCOUNT_ABSENT`, `ACCOUNT_DUPLICATE`,
`ACCOUNT_METADATA_MISMATCH`, `ACCOUNT_INACTIVE`.
All exposed through `SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES`.

## Tests (local Node runner, `node _test_runner.js`)

- `testSalesRecognitionV2FoundationContracts` (80 assertions, execution-verified count guard) —
  `96.Tests.Transaction.Operational.Cases.js`; includes exact-mode enum regression cases
  (whitespace `" ACTIVE "` / `" PREPARED "` / `" PAUSED "`, wrong case, non-string mode →
  validation fail-closed AND request-gate deny)
- `testSalesV2CutoverPeriods` (9 assertions, classifier/config portion only) — same file
- `testSalesV2AccountPreflight` (32 assertions, per-account matrix: pass / absent / every required
  field wrong / inactive / duplicate / duplicate-inactive for 1030, 2010, 4000, plus edge rows) —
  `96.Tests.Transaction.Production.Readiness.Cases.js`
- `testSalesV2U1MutationProof` — in-memory VM sensitivity proof (registered in `_test_runner.js`,
  source read via `tests/browser/sales-v2-u1-mutation-proof.js`, tracked files never mutated):
  clean Foundation run passes all 80; string-replacing strict `indexOf(mode)` back to
  `indexOf(mode.trim())` in the VM copy must make the Foundation suite FAIL at marker
  `SALES_V2_FOUNDATION:F71`. Proof failure fails the suite exit status.

`node _test_runner.js` executes all of the above; all legacy assertions preserved.
MEASURED: `45 PASS, 0 FAIL` (41 legacy suites + 3 U1 case suites + 1 mutation-proof entry).

## Out of scope (U2+)

Durable Save, intent persistence, projection/readers, journal/audit readback, Correct/Void,
activation execution, account creation, migration, deployment.
