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

- `validateSalesRecognitionV2Config(config)` — fail-closed validation.
- `salesRecognitionV2RequestGate(config)` — pure gate: `PREPARED → V2_NOT_ACTIVATED`,
  `PAUSED → V2_MODE_PAUSED` (refusal, never a legacy fallback), `ACTIVE → allowed`.
- Activation may not use operational T `2026-10-06T18:50:05.328Z`.
- Pause/resume does not change `contractVersion` or activation metadata.

## Sticky cohort classifier

`classifySalesRecognitionCohort(order, context)` → `{ cohort, status, code }`.
Precedence (deterministic, order matters):

1. Persisted V2 evidence (`context.intents` / `context.events` / `context.operations` /
   order-level `ContractVersion`, scoped by `OrderID`) outranks legacy fields and dates.
   - committed (`State`/`PostingStatus` = `COMMITTED`) → `V2_COMMITTED`
   - otherwise (pending intent/event) → `V2_PENDING` — pending V2 is never legacy,
     regardless of mode (`PAUSED` included) and regardless of legacy `PaymentStatus`/
   `FulfillmentStatus` fields still present on the order.
2. Conflicting or unknown persisted `ContractVersion` → `INCONSISTENT` /
   `RECOVERY_REQUIRED` / `IDENTITY_CONFLICT` (never legacy).
3. TabSal marker (`sourceSheet|Source|sheet|SheetName` = `tabsal`, or `ID_Trx` present)
   → `TABSAL_LEGACY`.
4. Pre-V2 Order/payment contract fields (`PaymentStatus`/`FulfillmentStatus`) → `PRE_V2_ORDER`.
5. Date signals only (no persisted evidence) → `INCONSISTENT` / `UNKNOWN` /
   `DATE_ONLY_NO_PERSISTED_EVIDENCE`. Dates alone never classify.
6. No evidence at all → `UNKNOWN` / `UNKNOWN` / `NO_PERSISTED_EVIDENCE`.

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

## Local refusal codes (documented per U1)

`MODE_INVALID`, `CONTRACT_VERSION_MISMATCH`, `CONFIG_VERSION_INVALID`,
`ACTIVATION_METADATA_PRESENT`, `ACTIVATION_METADATA_MISSING`, `ACTIVATION_TIMESTAMP_FORBIDDEN`,
`V2_NOT_ACTIVATED`, `V2_MODE_PAUSED`, `CONFIG_INVALID`, `IDENTITY_CONFLICT`,
`NO_PERSISTED_EVIDENCE`, `DATE_ONLY_NO_PERSISTED_EVIDENCE`, `ACCOUNT_ROW_INVALID`,
`ACCOUNT_ABSENT`, `ACCOUNT_DUPLICATE`, `ACCOUNT_METADATA_MISMATCH`, `ACCOUNT_INACTIVE`.
All exposed through `SALES_RECOGNITION_V2_CONTRACT.REFUSAL_CODES`.

## Tests (local Node runner, `_test_runner.js`)

- `testSalesRecognitionV2FoundationContracts` (30 checks) — `96.Tests.Transaction.Operational.Cases.js`
- `testSalesV2CutoverPeriods` (9 checks, classifier/config portion only) — same file
- `testSalesV2AccountPreflight` (14 checks) — `96.Tests.Transaction.Production.Readiness.Cases.js`

All legacy assertions preserved; runner executes 44 suites, `44 PASS, 0 FAIL` (MEASURED).

## Out of scope (U2+)

Durable Save, intent persistence, projection/readers, journal/audit readback, Correct/Void,
activation execution, account creation, migration, deployment.
