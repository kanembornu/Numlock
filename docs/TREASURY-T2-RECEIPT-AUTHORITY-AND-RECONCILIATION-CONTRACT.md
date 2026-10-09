# Treasury T2 — Receipt Authority and Reconciliation Contract

**Phase:** NUMLOCK_TREASURY_ARCHITECTURE_AND_RECONCILIATION_DESIGN
**Task:** T2_TREASURY_RECEIPT_AUTHORITY_AND_RECONCILIATION_CONTRACT
**Classification:** COMPLEXITY L3 · OPERATIONAL_RISK R2 · REASONING_EFFORT high
**Scope:** DESIGN ONLY. Frozen receipts-only V1 architecture contract. Zero runtime source
changes. Zero production writes. Zero deployment actions.
**Evidence classes:** MEASURED = executed/observed this session; SOURCE = repository source
at HEAD `0cf8aba`; PRIOR-MEASURED = accepted evidence committed at HEAD (see T1 baseline);
DERIVED = logical consequence of stated evidence. T1 baseline =
`docs/TREASURY-T1-PRODUCTION-DISCOVERY-AND-AUTHORITY-BASELINE.md` (authoritative evidence
layer; this document never restates or rewrites it, and never supersedes it on conflict).

Report traceability: each section maps to a REQUIRED FINAL REPORT item number (Rn).

---

## 1. Frozen V1 scope (R5, R6)

**V1 = `TREASURY_V1_SCOPE = RECEIPTS_ONLY` (APPROVED — owner decision (6) closed).**

MUST HAVE (V1):
1. Exactly one verified receipt per operation.
2. Receipt linked to exactly one eligible active V2 exposure (`RecognitionID`).
3. Exact full clearing: `GrossAmount == OutstandingAmount && GrossAmount > 0`.
4. Explicit destination account (frozen eligibility rule, §6).
5. Durable authority: persisted intent (Operation) before business artifacts.
6. Journal `Dr <destination> · Cr 1030` in BalanceLedger only.
7. Append-only evidence (no in-place financial mutation, ever).
8. Idempotency by `RequestKey` (exact replay, conflict on payload change).
9. Audit row per committed operation (Treasury audit table, not Logs-only).
10. Correction/reversal architecture in the V1 writer (see §11 decision).
11. 1030 residual read model (per-exposure projection, §15).
12. Deterministic Asia/Jakarta date authority (§9).

DEFER (explicitly not V1, not silently dropped): aggregate/batch settlement; statement
import; auto-match; partial/over/under receipts; fees/MDR; observed-balance
`RECONCILED/MISMATCH` reconciliation; supplier/AP/expense disbursement (existing W1/W3
paths remain the disbursement authorities).

OUT OF SCOPE (no work, no design escape hatch): Sales payment-method authority; legacy
Payment/Settlement mutation; backfill/reconstruction of legacy money history; the 2010
refund/credit workflow; Inventory/HPP/COGS/Policy C changes; Revenue recognition changes.

Domain boundaries (frozen): **Sales** = recognition `Dr1030/Cr4000`; it never knows the
destination. **Treasury** = verified receipt `Dr Cash/Bank · Cr1030`; it never touches
Revenue. **Ledger (BalanceLedger)** = accounting evidence, not event authority.
**Finance** = read-only observer. Authoritative object = **`TreasuryReceipt`**;
**NEVER** reuse `Payment`, `Settlement`, `ReceiveVia`, or `PaymentMethod` (any name).

Legacy isolation: no new `Payments`/`Settlements` rows, no `tabsal`/`tabops` backfill, no
cohort reinterpretation. 2010 isolation: reversal ≠ refund (§20); no 2010 writer exists or
is added.

## 2. Owner decisions closed by this contract (R6)

| # | T1 open decision | T2 resolution |
| --- | --- | --- |
| 1 | Fresh production read route | **Operational backlog, not an architecture blocker.** Design rests on SOURCE + PRIOR-MEASURED T1 evidence. |
| 2 | 1020 "Cash in Owner Custody – BluBCA" eligibility | Eligibility derives from the frozen cash-universe rule + Accounts master validation (§6). Never name inference. Cash-vs-Bank *wording* is cosmetic and deferred. |
| 3 | Aggregate/partial policy | **DEFERRED** (no production evidence; V1 exact full clearing only). |
| 4 | Fees/MDR | **DEFERRED** (no account, no code path, no evidence). |
| 5 | Date authority | **Explicit `Asia/Jakarta`** canonical Treasury date-key helper (§9). |
| 6 | Scope sign-off | **`RECEIPTS_ONLY` APPROVED.** |
| 7 | Legacy money reconstruction | **OUT OF SCOPE. No backfill, ever, in V1.** |

Blocking statuses reserved: `BLOCKED_ACCOUNT_AUTHORITY` (deterministic account eligibility
impossible without owner/schema decision) and `BLOCKED_ACCOUNTING_CONTRACT` (1030/accounting
semantics contradict the receipt model). **Neither triggers today** — §6 establishes a
deterministic eligibility rule from an existing frozen authority, and §15/§27 reconcile the
1030 model against measured ledger state with residual 0. No contract work around a blocker
is permitted if either status is later established.

---

## 3. Authoritative object and sheets (R7)

`TreasuryReceipt` = the authoritative verified-receipt event. Three new Treasury-specific
sheets (created in T3 under separate schema authorization; design-only here):

- `TreasuryReceipts`
- `TreasuryOperations`
- `TreasuryAudits`

### `TreasuryOperations` vs reuse `TransactionOperations` — decision: INDEPENDENT (proved, not assumed)

`TransactionOperations` (95A, 10 cols) is column-shape compatible with Treasury needs, but
reuse is rejected on semantics, not shape:

1. **Documented binding conflict.** Its `BusinessID` is written as OrderID/paymentID
   (`transactionResolveOperation_` for `ORDER_CREATE`/`PAYMENT`); readers treat it that way
   — `97D` derives cohort "from persisted V2 evidence (TransactionOperations +
   SalesRecognitionEvents bound to the exact OrderID)" and `97B` maps `op.BusinessID →
   OrderID` (`salesProjectionEvidenceContext_`, `salesProjectionBuildV2_`). Treasury
   operations are bound to `RecognitionID`/`TreasuryReceiptID`, never OrderID as primary
   target. Reuse would put rows into a shared census under a foreign binding meaning; every
   future reader would have to remember a type filter it cannot verify.
2. **Blast radius.** `97B` scans the whole sheet for stalled-intent detection and cohort
   evidence; an `IN_PROGRESS`/corrupted Treasury row in that sheet is a new failure mode for
   frozen Sales projections and their tests, with zero benefit to Treasury.
3. **Fail-closed isolation.** Treasury preflight, headers validation, and recovery must be
   provable without touching a sheet owned by two legacy writers and a frozen V2 writer.
4. **Cost.** One extra sheet; no cross-domain contract change. Sales precedent exists:
   Sales has its own `SalesRecognitionEvents`/`SalesRecognitionAudits` instead of reusing
   `Logs`.

A Treasury operation type living in `TransactionOperations` would require proving every
existing reader type-filters (readers do today: `row.OperationType === ...`) **and**
accepting permanent semantic ambiguity — the proof burden fails the "truly compatible"
bar. Reuse rejected.

## 4. Exact schemas (R8, R9, R10)

### 4.1 `TreasuryReceipts` — exact columns (order frozen, 24 columns)

| # | Column | Authority semantics |
| --- | --- | --- |
| 1 | `TreasuryReceiptID` | Server-derived identity (§10). Unique; replay-identical. |
| 2 | `ContractVersion` | Literal `TREASURY_RECEIPT_V1`. |
| 3 | `OperationID` | `TROP-…` operation that produced this row. |
| 4 | `RequestKey` | Client idempotency key of that operation (direct replay lookup). |
| 5 | `RecognitionID` | Target V2 exposure (mandatory on every row, incl. reversal/replacement). |
| 6 | `OrderID` | Order lineage copied from the recognition snapshot (never read back as authority). |
| 7 | `RevisionID` | Recognition revision lineage (same rule). |
| 8 | `ReceiptType` | `SALES_RECEIPT` \| `SALES_RECEIPT_REVERSAL`. Selects journal template (§7) and forbidden-account set. |
| 9 | `DestinationAccountCode` | Eligible cash/bank account (§6); on reversal = original destination. |
| 10 | `GrossAmount` | Integer IDR > 0; on reversal = original `GrossAmount`. |
| 11 | `ReceiptDate` | `YYYY-MM-DD` Asia/Jakarta business date (§9). |
| 12 | `EconomicDate` | V1: byte-equal to `ReceiptDate` (enforced). |
| 13 | `ReceivedAt` | Server ISO-8601 UTC instant of plan freeze (commit timestamp). |
| 14 | `EvidenceType` | Literal `MANUAL_VERIFIED` (§12). |
| 15 | `EvidenceRef` | Required human-readable evidence note (§12). |
| 16 | `JournalID` | `TRJ-…`; exactly one journal per receipt row. |
| 17 | `JournalSignature` | Canonical journal digest verified at readback (§7). |
| 18 | `PostingStatus` | Write-once literal `COMMITTED` (§19). |
| 19 | `OriginalReceiptID` | On a replacement row: the receipt it replaces (V2 `OriginalID` pattern). |
| 20 | `ReversalOfReceiptID` | On a reversal row: the receipt it reverses. |
| 21 | `ReplacementReceiptID` | On a correcting reversal row: the replacement receipt id (empty for pure reversal). |
| 22 | `Reason` | Required (≥3 chars) for reversal/correction; `""` for ordinary receipts. |
| 23 | `Actor` | Server-resolved actor (`Session.getActiveUser().getEmail() || CANONICAL_ENTRY.USER`). |
| 24 | `SnapshotJSON` | Immutable receipt snapshot (§14). |

**Rejected candidate columns and why:**
- `Status` — **dropped as a stored column.** `ReceiptStatus {ACTIVE, REVERSED}` is a
  **derived** attribute of the authoritative projection (§19). Storing it would create a
  second authority for the same fact and require an in-place write to an original row on
  reversal, contradicting "original immutable" (the V2 pattern: original artifacts
  immutable, lineage travels on appended rows, state derived by projection —
  `97C` header). Single-authority rule wins over a redundant column.
- `ReceiptDate`/`EconomicDate` merged — rejected: both must exist to make the V1 equality
  rule explicit and auditable (§9).
- Any `PaymentID`/`SettlementID`/`ReceiveVia`/`PaymentMethod` field — forbidden vocabulary
  (§1).

### 4.2 `TreasuryOperations` — exact columns (order frozen, 10 columns)

`TreasuryOperationID, OperationType, RecognitionID, RequestKey, State, PayloadHash,
OperationPlan, CreatedAt, UpdatedAt, LastError`

- `TreasuryOperationID`: `TROP-…` derived from (`OperationType`, `RequestKey`) (§10).
- `OperationType` ∈ {`TREASURY_RECEIPT_SAVE`, `TREASURY_RECEIPT_REVERSE`,
  `TREASURY_RECEIPT_CORRECT`}. Never any legacy operation type.
- `RecognitionID`: every treasury operation targets exactly one exposure (this is the
  reason the column is renamed vs `BusinessID`, §3).
- `State` ∈ {`IN_PROGRESS`, `COMMITTED`}. No other persisted state.
- `PayloadHash`: canonical-JSON payload hash (same canonicalization class as
  `transactionPayloadHash_`).
- `OperationPlan`: one-cell immutable JSON plan (rows + snapshots + digests + identities),
  frozen once before the first write; never rewritten except `State/UpdatedAt/LastError`
  on the commit/resume path.
- `LastError`: last refusal/recovery reason; cleared on commit.

### 4.3 `TreasuryAudits` — exact columns (order frozen, 11 columns)

`AuditID, ContractVersion, OperationID, RequestKey, TreasuryReceiptID, RecognitionID,
OrderID, JournalID, PayloadHash, Actor, SavedAt`

(Sales audit schema + `TreasuryReceiptID`; one audit row per committed operation, with the
primary receipt id — for `CORRECT`, the replacement receipt id, the reversal id travels in
`OperationPlan` and the reversal row itself.)

## 5. Config and activation contract (R11)

Property key `TREASURY_RECEIPT_V1_CONFIG` (Script Properties, JSON — same storage class as
`SALES_RECOGNITION_V2_CONFIG`, `97D`):

```json
{ "mode": "PREPARED|ACTIVE|PAUSED", "contractVersion": "TREASURY_RECEIPT_V1",
  "activationID": "", "activatedAt": "", "configVersion": 1 }
```

Validation (fail-closed, mirrors `validateSalesRecognitionV2Config`): `mode` exact enum
(trimmed, case-sensitive); `contractVersion` literal; `configVersion` integer ≥ 1;
`activationID`/`activatedAt` both empty in PREPARED, both non-empty ISO-8601 UTC in
ACTIVE/PAUSED; present-but-invalid config ⇒ **reject, never fallback**.

Mode semantics:
- **PREPARED**: contract/schemas may exist; zero receipts possible. Save/reverse/correct
  refuse before any write with `TREASURY_NOT_ACTIVATED`.
- **ACTIVE**: new receipts allowed (all other gates still apply).
- **PAUSED**: refuse `SAVE/REVERSE/CORRECT` with `TREASURY_MODE_PAUSED`; **reads, the 1030
  projection, reconciliation, and operation recovery remain available**. **No
  legacy-Settlement fallback exists in any mode** — a refusal never routes to
  `Payments`/`Settlements` (the `97D` rule: a refusal never becomes a legacy fallback).
- Absent/invalid ⇒ `TREASURY_CONFIG_INVALID`, reject.

Activation lifecycle: **independent Treasury lifecycle, bias YES — necessity proved.**
Sales V2 activation (`97E`) is one-shot, preflight-guarded, server-id-generated, and
readback-verified; Treasury needs the same mechanics but **must not share the Sales
property, Sales operation types, or Sales cohort gates**: Treasury activation gates money
movement while Sales activation gates revenue recognition; pausing Sales must not pause
receipts and vice versa (independent failure domains). Therefore: a separately authorized
Treasury activation writes `TREASURY_RECEIPT_V1_CONFIG` = ACTIVE with server-generated
`activationID` (`TRACT-…`), `activatedAt` = ISO UTC instant, `configVersion` = 1, exact
readback of all five fields before success; activating twice is refused
(`ACTIVATION_METADATA_PRESENT` class). There is **no generic config editor** and **no
pause/resume inside the activation module**; PAUSED/RESUME is a separate, explicitly
authorized config mutation with its own readback. Activation is never implied by sheet
presence, dates, or data.

## 6. Destination-account eligibility (R12)

**Rule (frozen, deterministic, no name hardcoding, no Accounts mutation):**

`destinationEligible(code, accounts)` ⇔ all of:
1. `code ∈ CASH_FOUNDATION_POLICY.ACCOUNT_CODES` (= `["1000","1010","1020"]`,
   `40.Cash.Foundation.js:2` — the existing frozen cash-universe policy constant already
   authoritative for cash flow, balance, and payment-method resolution);
2. exactly one Accounts row for `code` (absent/duplicate ⇒ refuse);
3. row `IsActive` truthy;
4. `AccountType === "Asset"` and `NormalBalance === "DEBIT"` (metadata cross-check);
5. `code !== "1030"` (clearing account can never be a destination — structural, checked
   before eligibility);
6. destination is an active member of the journal's own snapshot (destination code +
   name snapshotted, §14).

Failures ⇒ `TREASURY_INVALID_DESTINATION_ACCOUNT` (absent/duplicate/wrong metadata),
`TREASURY_DESTINATION_ACCOUNT_INACTIVE` (inactive), `TREASURY_DESTINATION_IS_CLEARING`
(`1030`).

**Why this is not `BLOCKED_ACCOUNT_AUTHORITY`:** metadata alone cannot express cash-ness
(`1100 Inventory Asset` has the identical `Asset/Current Assets/Operating/DEBIT` profile —
SOURCE), but eligibility does not need to be derived from generic metadata: it derives
from an **explicit frozen account-policy authority** (the cash-universe constant) plus
master validation. This satisfies "explicit account/master semantics or a frozen Treasury
eligibility rule".

**Minimum future schema/config requirement (documented, not blocking):** if the owner ever
wants destinations driven by master data instead of the code constant, add either an
Accounts column `CashAccountFlag` (boolean, part of exact-headers validation) or a
`TREASURY_RECEIPT_V1_DESTINATIONS` property list validated against Accounts — whichever
the owner freezes. Until then the constant rule stands; account rows are never mutated for
Treasury.

## 7. V2 exposure eligibility and clearing rule (R13, R14)

### 7.1 Exposure eligibility — `V2_ONLY`

`resolveExposure(RecognitionID)` accepts only if **all** hold:
1. recognition event row exists (`SalesRecognitionEvents`);
2. `ContractVersion === "SALES_RECOGNITION_V2"` (legacy reconstruction unresolved ⇒
   V2-only; owner decision (7));
3. `EventType === "RECOGNITION"` (a REVERSAL row is not an exposure);
4. integrity-valid: journal exists, `RecognitionJournalID` resolves, signature verifies,
   snapshot digests match (projection quality = OK; any integrity issue ⇒ fail-closed);
5. valid Order lineage: `OrderID` and `RevisionID` resolve against Orders/OrderLines;
6. recognition not voided/reversed (no committed V2 reversal against it);
7. `OutstandingAmount > 0` computed by the authoritative projection (§7.2);
8. no other active Treasury receipt already fully clearing it;
9. no unresolved treasury operation on the exposure (`IN_PROGRESS` or corrupted op ⇒
   `TREASURY_EXPOSURE_BUSY` / `TREASURY_EXPOSURE_EXCEPTION`);
10. destination valid (§6), amount exact (§7.2), date/evidence valid (§9, §12).

Failure codes: `TREASURY_RECOGNITION_MISSING`,
`TREASURY_RECOGNITION_NOT_V2`, `TREASURY_RECOGNITION_INTEGRITY_FAILURE`,
`TREASURY_ORDER_LINEAGE_MISSING`, `TREASURY_RECOGNITION_INACTIVE`,
`TREASURY_NO_ELIGIBLE_EXPOSURE`, `TREASURY_EXPOSURE_BUSY`,
`TREASURY_EXPOSURE_EXCEPTION`.

### 7.2 Outstanding / full clearing (authoritative projection, never a UI guess)

```
OutstandingAmount(exposure) =
    Σ(active V2 RECOGNITION amount)                       // 1 row today
  − Σ(active V2 REVERSAL amount against it)               // Sales voids
  − Σ(GrossAmount of its ACTIVE treasury receipts)        // ordinary receipts
  + Σ(GrossAmount of committed reversals of those receipts)
```

Receipt activeness: a receipt counts while no committed `TREASURY_RECEIPT_REVERSAL` row
targets it. All sums restricted to rows whose producing operation is `COMMITTED`; any
receipt row with an unresolved operation forces exposure status `EXCEPTION` (never silently
counted, never silently ignored).

**Save gate:** `GrossAmount === OutstandingAmount && GrossAmount > 0` — evaluated against
the projection **re-read inside the lock immediately before plan freeze** (§13).
Precedence: `TREASURY_AMOUNT_NOT_POSITIVE` (≤ 0 or non-integer) →
`TREASURY_ALREADY_CLEARED` (`OutstandingAmount ≤ 0`) → `TREASURY_AMOUNT_MISMATCH`
(≠ outstanding). Partial/over/under/zero/negative ⇒ refuse. `PARTIAL` is **not** a valid
projection state (see §15).

## 8. Journal contract (R15) and ID/namespace contract (R16)

### 8.1 Ordinary receipt journal — exactly 2 lines

| Line | Account | Debit | Credit |
| --- | --- | --- | --- |
| 1 | `DestinationAccountCode` | `GrossAmount` | 0 |
| 2 | `1030` | 0 | `GrossAmount` |

- One `JournalID` per receipt; `LineID = JournalID + "-1" / "-2"`.
- `MovementType` = `TREASURY_RECEIPT`; `SourceType` = `TREASURY_RECEIPT_V1`;
  `SourceID` = `TreasuryReceiptID` (source-keyed: one source event ↔ one journal, enforced
  by `validateBalanceLedgerCandidates` — SOURCE, no MovementType allowlist exists).
- `Tanggal` = `EconomicDate` string. `ExternalRef` = `RecognitionID`.
- `IsActive` = TRUE. Rows appended via the atomic batch (§13); signature-protected;
  append-only forever.
- Linkage back: receipt row stores `JournalID` + `JournalSignature`; audit row stores
  `JournalID`.

**Reversal journal** (mirror of the original, sign-swapped):
line 1 `Dr 1030 GrossAmount`, line 2 `Cr <original destination> GrossAmount`;
`MovementType` = `TREASURY_RECEIPT_REVERSAL`; `SourceID` = reversal receipt id;
`ExternalRef` = original `TreasuryReceiptID`; `Tanggal` = reversal `EconomicDate`
(server action date, §9). Correction = reversal journal + replacement journal (two
journals, four lines) in the same atomic batch.

**Forbidden accounts:** any journal line whose account is not exactly {destination, 1030}
is structurally impossible and refused with `TREASURY_FORBIDDEN_JOURNAL_ACCOUNT`.
Explicit forbidden set for ordinary receipts: `{4000, 5000, 1100, 2000, 2010, 6210}`
(+ every other non-pair account). These may only appear under a future separately
authorized event type with its own contract version.

**Balance/signature:** journal must balance (`UNBALANCED_JOURNAL` refusal via
`validateBalanceLedgerCandidates`); signature = canonical digest of the sorted
`[AccountCode, Debit, Credit, MovementType, SourceType, SourceID, capitalEquityDateKey(Tanggal)]`
rows joined `||` — the proven generic pattern of `cashJournalSignature` /
`policyCJournalSignature_` (SOURCE: identical implementations), implemented as
`treasuryJournalSignature` under the Treasury namespace; verified at readback. Duplicate
source with different signature ⇒ `TREASURY_DUPLICATE_JOURNAL_SOURCE`; identical ⇒ replay.

### 8.2 ID / namespace contract

| ID | Prefix | Derivation (deterministic) |
| --- | --- | --- |
| `TreasuryOperationID` | `TROP-` | stable digest of (`OperationType`, `RequestKey`) |
| `TreasuryReceiptID` | `TRC-` | stable digest of (`OperationType`, `RequestKey`, side) |
| `JournalID` | `TRJ-` | stable digest of (`OperationType`, `RequestKey`, side) |
| `AuditID` | `TRA-` | stable digest of (`OperationType`, `RequestKey`, side) |
| ActivationID | `TRACT-` | server-generated uuid at activation |

- `side` ∈ {`PRIMARY`, `REVERSAL`, `REPLACEMENT`} (the operation type already separates
  SAVE/REVERSE; side separates the two rows of a `CORRECT`).
- Stable digest = the proven `transactionStableBootstrapId_` canonicalization class
  (deterministic, fixed-length uppercase alnum token); **exact byte format frozen at T3
  implementation time** against the same helper pattern — T3 must not invent a second
  digest scheme.
- **Not copied from Sales prefixes** (`SRV2J-`, `SCRV-`, `TXOP-`, `PAY-` are all excluded;
  `TXOP-` specifically excluded — treasury operations never appear in
  `TransactionOperations`).
- Uniqueness: `RequestKey` unique per `OperationType`; derivation collisions surface as
  `TREASURY_DUPLICATE_RECEIPT_ID` / identity readback mismatch ⇒ fail-closed, never
  overwrite.
- Replay semantics: same (`OperationType`, `RequestKey`) ⇒ same IDs ⇒ the persisted
  operation absorbs the call (no second row, §13). Server-generated IDs are used only for
  `activationID` (never for receipts/operations/journals/audits — deterministic IDs make
  UNKNOWN recovery replay-safe without inventing a new key).

## 9. Date/timezone contract (R17)

Three distinct fields, never collapsed:
- **`ReceivedAt`** = server commit instant, ISO-8601 UTC (`new Date().toISOString()` at
  plan freeze).
- **`ReceiptDate`** = business-observed arrival, operator-entered string `YYYY-MM-DD`
  interpreted directly as the **Asia/Jakarta calendar date** (no host conversion — a date
  string is already timezone-free).
- **`EconomicDate`** = accounting date; V1 rule: `EconomicDate === ReceiptDate` byte-equal,
  enforced at validation (`TREASURY_ECONOMIC_DATE_MISMATCH` if not). Arbitrary override is
  impossible in V1; any adjustment rule is a future contract-version change.

Canonical Treasury date-key helper (frozen): `treasuryDateKey(instant)` must normalize an
instant to `YYYY-MM-DD` in **`Asia/Jakarta`** explicitly — Apps Script implementation =
`Utilities.formatDate(instant, CANONICAL_ENTRY.TIMEZONE, "yyyy-MM-dd")`.
**`canonicalDateKey` (host-local getters, `20.Data.Source.js:80`) is FORBIDDEN in every
Treasury path** — it is the proven Δ12,000 defect class (T1 §16: same code, UTC vs
Jakarta, one boundary row flips 2026-09-30/2026-10-01 and moves Revenue by 12,000). That
legacy row is a **regression-design lesson and is never rewritten**.

Reversal/correction action dates: the reversal side's `EconomicDate` = server action day
normalized to Asia/Jakarta (no operator input, no override); a correction's *replacement
receipt* carries an operator `ReceiptDate` like any receipt. Original receipt dates are
never rewritten.

Required test battery (designed into T3, pre-proven in the T2 harness): 23:59:59
Asia/Jakarta, 00:00:00 Asia/Jakarta, UTC boundary (17:00:00Z ⇒ next Jakarta day; Jakarta =
UTC+7), month boundary, year boundary — each asserting `treasuryDateKey`,
`EconomicDate == ReceiptDate`, and ledger `Tanggal` attribution.

## 10. Evidence contract (R18)

- `EvidenceType` literal `MANUAL_VERIFIED` — the **only** V1 value. No bank/wallet/statement
  evidence type exists or may be claimed (no statement import in V1).
- `EvidenceRef` **REQUIRED** (decision: required, not optional): trimmed non-empty,
  3–200 chars, single line, no control characters. It is the durable human-readable
  pointer to how the operator verified arrival (e.g. wallet transaction note).
  Rationale: V1 has exactly one evidence class — operator verification — so the reference
  string is the only external anchor; without it "verified" is unanchored.
- Content policy: **no secrets** — no credentials, PINs, full card numbers, tokens, or
  auth data may be stored (validator rejects obvious patterns; operator policy is part of
  the flow contract).
- Evidence is immutable once written (append-only).

## 11. Status model (R19)

- `ReceiptStatus` ∈ {`ACTIVE`, `REVERSED`} — **derived** by the projection: `REVERSED`
  iff exactly one committed reversal targets the receipt; `ACTIVE` otherwise; more than
  one committed reversal ⇒ projection `EXCEPTION` (corruption). Not stored (§4.1).
- `OperationState` ∈ {`IN_PROGRESS`, `COMMITTED`} — the only persisted operation states.
- `PostingStatus` — separate column, write-once literal `COMMITTED` for V1 (a receipt row
  exists only via the atomic verified batch; recovery never rewrites it). The enum is
  reserved for future non-posting states; corruption surfaces via operation
  `LastError`/`RECOVERY_REQUIRED` and projection quality issues, never by rewriting a
  receipt.
- **No `PAID`/`UNPAID` anywhere** — those are Sales/legacy operational states and must
  never appear in treasury vocabulary or UI.

## 12. Reversal contract (R20)

- Journal: `Dr 1030 GrossAmount · Cr <original destination> GrossAmount`, original amount,
  `MovementType TREASURY_RECEIPT_REVERSAL`, own `SourceID` (reversal receipt id),
  `ExternalRef` = original receipt id.
- Original receipt row is **immutable** (every column; its digests are stored in the
  reversal plan and re-verified before commit — V2 `97C` pattern).
- **One active reversal max**: a committed reversal against the target ⇒
  `TREASURY_ALREADY_REVERSED`; an `IN_PROGRESS` reversal ⇒
  `TREASURY_REVERSAL_TARGET_CLAIMED`.
- Source linkage: `ReversalOfReceiptID` on the reversal row; audit row carries the reversal
  receipt id; operation targets the same `RecognitionID`.
- After reversal: exposure `OutstandingAmount` returns to its pre-receipt value (projection
  recomputes); if no other receipt exists ⇒ status `UNCLEARED`.
- **Zero Revenue effect** (never touches 4000; Revenue remains the U3/U5 Sales authority).
- **Architecture decision:** the reversal **writer + projection + error catalog ship in
  the V1 release** (T6) — it is a financial writer; deferring the capability would mean a
  first release that can post money but never correct a mis-keyed receipt. **Operator UI
  exposure of the reversal button may defer** (T7 ships Save-first; reversal remains
  reachable through the T6-tested server contract until the UI surface is authorized).

## 13. Correction contract (R21)

- **Financial correction = full reversal + replacement receipt, ONE operation, ONE atomic
  batch** (Sales V2 `97C` pattern; never delta-only, never split).
- Lineage fields: reversal row = `ReversalOfReceiptID = target`,
  `ReplacementReceiptID = replacement id`; replacement row = `OriginalReceiptID = target`,
  `ReceiptType = SALES_RECEIPT`. Replacement gets fresh deterministic identities
  (side = `REPLACEMENT`).
- Replacement must satisfy the ordinary full-clearing rule against the post-reversal
  outstanding (§7.2) — destination/date/evidence corrected, amount re-validated exactly.
- Original receipts/journals immutable; `Reason` required; original periods never
  rewritten (replacement `ReceiptDate` is operator-supplied, `EconomicDate = ReceiptDate`).
- **Non-financial annotation** (notes without journal effect): **DEFERRED** — no V1 use
  case exists; adding an annotation surface now would be speculative. Freeze: annotations,
  when ever needed, are a new operation type under a future contract version, never an
  in-place edit.

## 14. Concurrency contract (R22)

- Outer `ScriptLock` (`waitLock(30000)`, `releaseLock()` in `finally` — `97A` wrapper
  pattern) serializes every treasury mutation; no nested locks.
- Inside the lock, immediately before plan freeze: **re-read** the exposure projection and
  re-validate all gates. The earlier read (if any) is advisory only.
- Two simultaneous clears of one `RecognitionID` ⇒ exactly one active full clearing:
  the second execution re-reads `OutstandingAmount = 0` and is refused with
  `TREASURY_ALREADY_CLEARED` (deterministic loser code).
- No double cash posting: a second receipt cannot pass the exact-amount gate, and ledger
  source-key duplicate signatures are independently refused
  (`TREASURY_DUPLICATE_JOURNAL_SOURCE`).
- Partial-write windows cannot interleave business artifacts: business artifacts land in
  ONE atomic batch (§15).

## 15. Idempotency and recovery contract (R23)

| Situation | Behavior |
| --- | --- |
| Same `RequestKey`, same payload | Exact replay: `COMMITTED` op ⇒ return stored committed result (same IDs, `DONE`, zero new rows); `IN_PROGRESS` ⇒ resume (§16). |
| Same `RequestKey`, different payload | `TREASURY_REQUEST_KEY_CONFLICT` (`OPERATION_PAYLOAD_CONFLICT` class). State unchanged. |
| New `RequestKey`, exposure already cleared | `TREASURY_ALREADY_CLEARED` (never a second clearing). |
| Client response `UNKNOWN` (timeout/uncertain) | **Recoverable with the ORIGINAL `RequestKey`** — retry replays or resumes to the identical committed result. **Never blind-retry with a new key** (it would be refused anyway, but the contract forbids generating one). |
| Artifacts present, commit write lost | Recovery verifies artifacts against the persisted plan ⇒ sets `COMMITTED` ⇒ `DONE` (no rewrite). |
| Artifacts absent (crash after intent) | Resume executes the frozen plan once ⇒ atomic batch ⇒ verify ⇒ `COMMITTED`. |
| Artifacts present but verification fails | `RECOVERY_REQUIRED` fail-closed; exposure forced to `EXCEPTION`; no rewrite, no auto-repair. |
| Corrupted `OperationPlan` / `State` | `TREASURY_OPERATION_PLAN_MALFORMED` / `TREASURY_OPERATION_STATE_CORRUPTED` — identity retained, replay refused (V2 U8 N9 pattern). |

Payload hash covers the full normalized business payload (requestKey, recognitionID,
destination, amount, receiptDate, evidence, reason, side) — canonical JSON, sorted keys.

## 16. Durable write sequence (R24)

```
outer ScriptLock(30s)
 → normalize payload (trim, types, bounds)
 → validate config (mode ACTIVE; PREPARED/PAUSED/invalid ⇒ refuse, zero writes)
 → exact (OperationType, RequestKey) lookup
     ├─ exists: conflict check (PayloadHash/plan) → replay COMMITTED | resume IN_PROGRESS
     └─ absent: continue
 → resolve Recognition (V2, integrity, Order lineage, not voided)
 → compute outstanding (authoritative projection) + validate destination + amount + date + evidence
 → freeze immutable OperationPlan (rows, snapshots, IDs, journal digests, payload hash) once
 → persist Operation row IN_PROGRESS → EXACT 10-field readback
 → ONE atomic spreadsheets.batchUpdate (appendCells subrequests):
       receipt row(s) + 2 (or 4) BalanceLedger lines + 1 audit row     ← ATOMICITY BOUNDARY
 → exact artifact verification (row fields, balance, signature, audit, plan digests)
 → operation State = COMMITTED → exact readback
 → DONE → best-effort invalidateDashboardCache() (U10F pattern: never contradicts DONE)
 → finally: releaseLock()
```

Crash/UNKNOWN at any step follows §15. The claim is bounded like V2: "only the single
batchUpdate is atomic (all subrequests or none)" — intent, batch, and commit are
multistep with deterministic recovery, no database-global atomicity claimed.

## 17. Exact successful mutation delta (R25)

`TREASURY_RECEIPT_SAVE` (fresh, non-replay):
- **+1** `TreasuryOperations` row (`IN_PROGRESS` → 1 row, `State` cell later
  transitions to `COMMITTED`; no second row)
- **+1** `TreasuryReceipts` row
- **+2** `BalanceLedger` lines
- **+1** `TreasuryAudits` row
- **nothing else** (post-DONE dashboard cache revision bump is ephemeral cache
  maintenance, mirroring U10F, not a business artifact).

`TREASURY_RECEIPT_REVERSE`: +1 operation row, +1 receipt row (reversal), +2 ledger lines,
+1 audit row.
`TREASURY_RECEIPT_CORRECT`: +1 operation row, +2 receipt rows (reversal + replacement),
+4 ledger lines (2 journals), +1 audit row.

**Never mutated:** `Payments`, `Settlements`, `Orders`, `OrderLines`,
`SalesRecognitionEvents`, `SalesRecognitionAudits`, `TransactionOperations`,
`InventoryLedger`, `PurchaseEvents`, `tabsal`, `tabops`, `Logs`, `Accounts`, `Settings`,
`FinanceOpeningBalances`, any config/account/schema/header, any existing journal line.

## 18. Immutable snapshot contract (R26)

`SnapshotJSON` (single cell, ≤ `MAX_CELL_CHARS`-class bounds) contains exactly:

```json
{ "contractVersion": "TREASURY_RECEIPT_V1", "activationID": "…", "configVersion": 1,
  "operationType": "TREASURY_RECEIPT_SAVE", "side": "PRIMARY",
  "recognitionID": "…", "orderID": "…", "revisionID": "…",
  "recognizedAmount": 24000, "outstandingBefore": 24000, "receiptAmount": 24000,
  "destination": { "code": "1010", "name": "DANA Business" },
  "receiptDate": "2026-10-11", "economicDate": "2026-10-11",
  "evidence": { "type": "MANUAL_VERIFIED", "ref": "…" },
  "journalID": "TRJ-…", "targetReceiptID": "", "reason": "" }
```

No Order totals beyond recognized amount, no product/HPP/recipe lines, no Payment/
Settlement fields, no unrelated Sales data. Snapshot is frozen with the plan and verified
at readback; never rewritten.

## 19. 1030 projection (R27)

Per exposure record (authoritative, computed on read — **uncached in V1**, see §26):

```
{ RecognitionID, OrderID, RevisionID, RecognizedAmount, ActiveCleared,
  OutstandingAmount, Status ∈ {UNCLEARED, CLEARED, EXCEPTION},
  ActiveTreasuryReceiptID, QualityIssues[] }
```

- `UNCLEARED`: `Outstanding > 0`, no quality issues.
- `CLEARED`: `Outstanding == 0` via active receipts, no issues.
- `EXCEPTION`: any quality issue — includes `Outstanding` not in `{0, full}` (a "partial"
  number is corruption, **not** a normal state), unresolved operations, signature
  mismatch, duplicate active receipts, destination/ledger mismatch, unknown
  `ReceiptType`, date inconsistency, unattributed 1030 movement.
- Quality issue codes (frozen start): `OP_IN_PROGRESS`, `RECEIPT_UNVERIFIED`,
  `DUPLICATE_ACTIVE_RECEIPTS`, `DESTINATION_LEDGER_MISMATCH`,
  `SIGNATURE_MISMATCH`, `AMOUNT_RESIDUAL`, `UNKNOWN_RECEIPT_TYPE`,
  `DATE_INCONSISTENT`, `ORPHAN_1030_MOVEMENT`.

An `EXCEPTION` exposure refuses new receipts (`TREASURY_EXPOSURE_EXCEPTION`) and is
surfaced, never auto-repaired.

## 20. Global 1030 reconciliation invariant (R28)

**Invariant:** at every reporting point,

```
ledgerNet1030 (= Σ active Dr − Σ active Cr on account 1030)
  == Σ(per-exposure OutstandingAmount)
   + Σ(explicitly classified non-Sales exceptions)
```

Reconciliation report fields (frozen): `ledgerDr1030`, `ledgerCr1030`, `ledgerNet1030`,
`recognizedExposure`, `salesVoidAdjustment`, `activeClearings`, `outstandingTotal`,
`explicitExceptionAmount`, `unexplainedResidual` where
`unexplainedResidual = ledgerNet1030 − outstandingTotal − explicitExceptionAmount`.
**Target: `unexplainedResidual == 0`.** Non-zero ⇒ surfaced as reconciliation failure
(`TREASURY_UNEXPLAINED_RESIDUAL`), classified by source key, never auto-repaired.

Measured conformance at HEAD (PRIOR-MEASURED, T1 §4): `ledgerNet1030 = 24,000` Dr;
one active recognition 24,000; zero receipts; `outstandingTotal = 24,000`;
`explicitExceptionAmount = 0`; **residual 0** ✓. Post-V1-Save conformance: receipt 24,000
⇒ `ledgerNet1030 = 0`, `outstandingTotal = 0`, residual 0 (harness case 1).

## 21. Finance integration (R29) — zero-edit proof, verified against source this session

| Reader | Source fact (SOURCE) | Treasury receipt effect | Edit needed |
| --- | --- | --- | --- |
| P&L / Revenue (`buildFinanceProfitAndLoss*`, `36`) | Revenue only from recognized-Sales projection by EconomicDate; comment: "Never activeView, never BalanceLedger 4000 credits…" (`36:644`) | `DrCash/Cr1030` credits no 4000 ⇒ **zero Revenue effect** | **None** |
| Cash Flow (`buildCashFlowStatement`, `36:72`) | cash codes hard-coded `["1000","1010","1020"]`; classification = counterpart account `CashFlowGroup` | receipt journal counted once as Operating inflow iff `1030.CashFlowGroup == "Operating"` (production row: PRIOR-MEASURED Operating, T1 §9) | **None** — but Treasury preflight **requires** `1030` `CashFlowGroup == "Operating"` (blank ⇒ `UNCLASSIFIED_COUNTERPART` ambiguity ⇒ refuse) |
| Balance Position (`buildPolicyCStatementReconciliation`, `39:444`) | `cashChange = Σ(1000,1010,1020)`; also 1100/2000/5000/6210; refuses unbalanced | cash `+` observed automatically; balanced ⇒ accepted | **None** for cash |
| Cash balance model (`buildCashBalanceReadModel`, `40:603`) | opening + ledger cash rows after cutover | receipt included once, ledger-only | **None** |
| **1030 line in Balance Position** | **does not exist** — 1030 is not read by any Finance reader (T1 §9: "1030/2010 surfaces: none dedicated") | 1030 outstanding must be visible | **Identified, no existing-reader edit:** the **new Treasury projection (§19/§20) is the 1030 surface.** Adding a 1030 line to Finance Balance Position is an optional future presentation change, out of V1 scope, explicitly not implemented here. |

Conclusion: existing readers satisfy V1 with **zero edits**; the only 1030 gap is closed by
the new Treasury-owned read model, not by touching Finance.

## 22. Cache invalidation (R30)

Read models stale after a committed receipt/reversal/correction (identified from source):

1. **Dashboard server cache** (`dashboard-v1`, `90.Dashboard.Service.js`) — cash totals.
2. **Transactions period server cache** (`transactions-period-v3`, `91.Transactions.Query.js:147`
   — revision-keyed) — the U4 stale-defect class: no financial event may succeed while the
   authoritative read model is stale for minutes.
3. **Finance UI client cache** (`financeCache` + warm callbacks + `activeRequestId`,
   Finance controller) — Balance Position/Cash Flow/P&L display.
4. **Transactions client caches** (`invalidateTransactionsClientCaches`).
5. **Treasury's own reads** — eligible-exposure list, 1030 projection, reconciliation.

**One bounded strategy (mirrors the proven U10F pattern, `97A:1318-1331`):**
- Server, inside Save/Reverse/Correct, **only after `DONE`**: best-effort
  `invalidateDashboardCache()` (single revision bump covering #1 and #2; never retried,
  never allowed to contradict `DONE`).
- Client, in the Treasury UI `DONE` handler: call the two existing client invalidators
  (`invalidateFinanceCache()`, `invalidateTransactionsClientCaches()`).
- Treasury read models (#5): **no cache in V1** — computed on read at V1 scale, so Treasury
  staleness is structurally impossible. (`ponytail:` if receipt volume later demands
  caching, key it by `getDashboardCacheRevision()` and re-run the staleness battery.)

## 23. Legacy isolation (R31), 2010/refund isolation (R32), AP/disbursement isolation (R33)

- **Legacy:** no new `Payments`/`Settlements` rows, ever; no `ReceiveVia`/`PaymentMethod`
  field anywhere in treasury schemas; no `tabsal`/`tabops` writes; no legacy cohort
  reinterpretation; no backfill (owner decision 7). `salesV2OperatorPaymentGuard_` and
  `SALES_V2_NO_CASH_POST` remain untouched and still authoritative for Sales.
- **2010 / refund:** reversal is `Dr1030/Cr destination` — it returns exposure and never
  touches 2010. No 2010 writer exists or is added; `reversal ≠ refund` is a frozen
  semantic: refund (`Dr2010/CrCash`) and credit (`Dr2010/Cr1030`) remain a future frozen
  authority outside V1. Void (`Dr4000/Cr1030`) remains Sales' authority, untouched.
- **AP/disbursement:** `2000`/`6210`/`1100` never appear in treasury journals; existing
  disbursement writers (W1 `cashSettleAndPersist`, W3 `postPolicyCPurchaseEvent_`) are
  untouched; V1 receipts-only opens no disbursement surface.

## 24. Fail-closed error catalog (R34)

Frozen codes (every failure returns exactly one; no silent fallback):

**Config/activation:** `TREASURY_CONFIG_INVALID`, `TREASURY_NOT_ACTIVATED`,
`TREASURY_MODE_PAUSED`, `TREASURY_CONTRACT_VERSION_MISMATCH`,
`TREASURY_CONFIG_VERSION_INVALID`, `TREASURY_ACTIVATION_METADATA_PRESENT`,
`TREASURY_ACTIVATION_METADATA_MISSING`, `TREASURY_ACTIVATION_METADATA_INVALID`.
**Exposure/eligibility:** `TREASURY_NO_ELIGIBLE_EXPOSURE`, `TREASURY_RECOGNITION_MISSING`,
`TREASURY_RECOGNITION_NOT_V2`, `TREASURY_RECOGNITION_INACTIVE`,
`TREASURY_RECOGNITION_INTEGRITY_FAILURE`, `TREASURY_ORDER_LINEAGE_MISSING`,
`TREASURY_EXPOSURE_BUSY`, `TREASURY_EXPOSURE_EXCEPTION`.
**Destination:** `TREASURY_INVALID_DESTINATION_ACCOUNT`,
`TREASURY_DESTINATION_ACCOUNT_INACTIVE`, `TREASURY_DESTINATION_IS_CLEARING`,
`TREASURY_FORBIDDEN_JOURNAL_ACCOUNT`.
**Amount/clearing:** `TREASURY_AMOUNT_MISMATCH`, `TREASURY_AMOUNT_NOT_POSITIVE`,
`TREASURY_ALREADY_CLEARED`.
**Idempotency/identity:** `TREASURY_REQUEST_KEY_CONFLICT`, `TREASURY_DUPLICATE_RECEIPT_ID`,
`TREASURY_DUPLICATE_JOURNAL_SOURCE`, `TREASURY_JOURNAL_SIGNATURE_INVALID`,
`TREASURY_OPERATION_PLAN_MALFORMED`, `TREASURY_OPERATION_STATE_CORRUPTED`.
**Date/timezone:** `TREASURY_DATE_INVALID`, `TREASURY_TIMEZONE_INVALID`,
`TREASURY_ECONOMIC_DATE_MISMATCH`.
**Evidence:** `TREASURY_EVIDENCE_TYPE_INVALID`, `TREASURY_EVIDENCE_REF_INVALID`.
**Reversal/correction:** `TREASURY_TARGET_NOT_FOUND`, `TREASURY_TARGET_NOT_RECEIPT`,
`TREASURY_ALREADY_REVERSED`, `TREASURY_REVERSAL_TARGET_CLAIMED`,
`TREASURY_REPLACEMENT_TARGET_CLAIMED`, `TREASURY_REASON_REQUIRED`,
`TREASURY_ORIGINAL_IMMUTABLE`.
**Execution/recovery:** `TREASURY_SCHEMA_NOT_READY`, `TREASURY_PAYLOAD_INVALID`,
`TREASURY_PAYLOAD_TOO_LARGE`, `TREASURY_LOCK_TIMEOUT`,
`TREASURY_INTENT_READBACK_FAILED`, `TREASURY_ARTIFACTS_INCOMPLETE`,
`TREASURY_BATCH_OUTCOME_UNKNOWN`, `TREASURY_READBACK_INCOMPLETE`,
`TREASURY_SAVE_EXECUTION_UNKNOWN`, `TREASURY_RECOVERY_REQUIRED`.
**Reconciliation:** `TREASURY_UNEXPLAINED_RESIDUAL`, `TREASURY_PROJECTION_EXCEPTION`.
**Blocking statuses:** `BLOCKED_ACCOUNT_AUTHORITY`, `BLOCKED_ACCOUNTING_CONTRACT`
(design-time; not triggered, §2).

Status vocabulary for responses: `DONE`, `REFUSED`, `CONFLICT`, `UNKNOWN`,
`RECOVERY_REQUIRED` (same class as `SALES_RECOGNITION_V2_SAVE.STATUS`).

## 25. Operator UI workflow (R35)

```
Treasury → Receipts
 → list eligible uncleared V2 exposures (projection: recognized / cleared / outstanding)
 → select ONE exposure
 → destination account select (only §6-eligible active accounts, labels from Accounts master)
 → confirm exact amount (locked to OutstandingAmount, displayed as such)
 → ReceiptDate (Asia/Jakarta business date)
 → optional-but-required EvidenceRef note (§12)
 → Review (shows exposure, outstanding, destination, amount, date, evidence)
 → Save
 → Done (with TreasuryReceiptID / JournalID; client cache invalidation runs here)
```

Explicitly absent: PaymentMethod/ReceiveVia widgets, any Sales mutation or PAID/
fulfillment control, partial-amount entry, batch selection. `PAUSED` ⇒ the flow renders
read-only with `TREASURY_MODE_PAUSED` (fail-closed, no legacy fallback).

## 26. First-event acceptance contract (R36)

- First genuine treasury event is identified **by durable identity** — the earliest
  `TreasuryReceiptID` with its `OperationID` chain — **never "the latest row"** and never
  by date heuristics.
- Acceptance chain (each link read back): `RequestKey` → `TreasuryOperation` (`COMMITTED`)
  → `TreasuryReceipt` (fields + `SnapshotJSON`) → `RecognitionID` → `JournalID`
  (2 lines, signature verified) → `TreasuryAudit` → 1030 projection (that exposure
  `CLEARED`) → Finance readers (cash `+`, P&L unchanged, Cash Flow one-time Operating
  inflow) → reconciliation `unexplainedResidual == 0`.
- Candidate economics: `Dr destination 24,000 / Cr1030 24,000` ⇒ 1030 = 0 **only if that
  24,000 recognition is still the sole outstanding exposure at execution time** — never
  assume it is the first exposure (T1 measured it as the only one at HEAD; production may
  have moved).
- **No fake receipt.** If no genuine operator receipt exists, acceptance status =
  `PRODUCTION_READY_WAITING_FOR_FIRST_REAL_RECEIPT`. Synthetic production receipts are
  forbidden (FORBIDDEN list).

## 27. Design challenge harness and test architecture (R37, R38)

**T2 local harness:** `tests/tmp/t2-design-challenge-harness.js`, labeled "Treasury T2
design harness", read-only (no file writes, no network, no Apps Script services),
excluded from clasp uploads because `.claspignore` is an allowlist (`**` ignore, explicit
`!` includes only; `tests/` never included — SOURCE verified). It encodes the frozen
contract as a pure-JS simulation (config gates, eligibility, projection, durable sequence
with crash hooks, reversal/correction, reconciliation, `Asia/Jakarta` date helper) and
executes 20 challenge cases + a 5-point date battery. **MEASURED (this session):** `node
tests/tmp/t2-design-challenge-harness.js` → **25 PASS / 0 FAIL** (battery D1–D5 + cases
C01–C20); `node --check` clean. Harness output artifact:
`tests/tmp/t2-harness-out.txt`.

**20 challenge cases (expected outcomes frozen):**

| # | Challenge | Expected |
| --- | --- | --- |
| 1 | exact receipt | `DONE`; delta +1 op/+1 receipt/+2 lines/+1 audit; `Dr dest/Cr1030`; exposure `CLEARED`; residual 0 |
| 2 | duplicate RequestKey, same payload | `DONE` replay; zero new rows; identical IDs |
| 3 | duplicate RequestKey, conflicting payload | `CONFLICT` `TREASURY_REQUEST_KEY_CONFLICT`; state unchanged |
| 4 | new RequestKey on cleared exposure | `REFUSED` `TREASURY_ALREADY_CLEARED` |
| 5 | simultaneous clears of one exposure | exactly one `DONE`; loser `TREASURY_ALREADY_CLEARED`; only winner's ledger lines exist |
| 6 | invalid destination account | `TREASURY_INVALID_DESTINATION_ACCOUNT`; zero writes |
| 7 | destination = 1030 | `TREASURY_DESTINATION_IS_CLEARING`; zero writes |
| 8 | wrong amount | `TREASURY_AMOUNT_MISMATCH`; zero writes |
| 9 | zero amount | `TREASURY_AMOUNT_NOT_POSITIVE`; zero writes |
| 10 | negative amount | `TREASURY_AMOUNT_NOT_POSITIVE`; zero writes |
| 11 | missing / non-V2 / voided recognition | respective `TREASURY_RECOGNITION_*`; zero writes |
| 12 | UNKNOWN / late callback recovery | original RequestKey replay/resume ⇒ single committed receipt, no duplicate rows/lines |
| 13 | reversal | `DONE`; original immutable; `Dr1030/Cr dest`; outstanding restored; original derived status `REVERSED` |
| 14 | double reversal | `TREASURY_ALREADY_REVERSED`; one reversal only |
| 15 | correction → new destination | `DONE`; +1 op/+2 receipts/+4 lines/+1 audit; replacement `Dr1020/Cr1030`; original untouched |
| 16 | correction → new date | replacement `EconomicDate == ReceiptDate`; original dates untouched; residual 0 |
| 17 | stale read model | post-commit projection reflects commit with no cache step; revision bump observed |
| 18 | UTC/Jakarta month/year boundary | date battery: Jakarta day attribution correct; `EconomicDate == ReceiptDate`; ledger `Tanggal` = Jakarta day |
| 19 | corrupted signature | projection ⇒ `EXCEPTION` (`SIGNATURE_MISMATCH`); further receipt refused; no auto-repair |
| 20 | unexplained residual | injected unattributed 1030 row ⇒ `unexplainedResidual != 0` surfaced; clean state ⇒ 0 |

**Test architecture (design units, unchanged — refinement only with justification):**
- **T3** contract/schema/config: exact headers (§4), activation & modes (§5), account
  eligibility (§6), date normalization battery (§9).
- **T4** durable Save: success, replay, conflict, UNKNOWN recovery, partial-write
  recovery, atomicity boundary (§15–§16).
- **T5** 1030 projection: uncleared, cleared, reversal, corruption, unexplained residual
  (§19–§20).
- **T6** reversal/correction: reversal, replacement, concurrency, immutable originals
  (§12–§13).
- **T7** UI/operator flow: eligible exposure, exact amount, destination, ReceiptDate,
  Done, PAUSED fail-closed (§25).
- **T8** Finance integration: cash `+`, 1030 `−`, P&L unchanged, Cash Flow correct, no
  double counting (§21).
- **T9** release integration: mutation sensitivity, source audit, historical preservation
  (delta proofs against §17/§23).
- **T10** production activation/first event: activation, genuine first receipt, end-to-end
  parity (§26).

## 28. Implementation worklist (R39) — ordered

1. **T3** — `98x`/`9x`-class foundation module: `TREASURY_RECEIPT_V1` contract object,
   exact headers, config validation/resolver, destination eligibility, date helper,
   preflight (1030 metadata incl. `CashFlowGroup == "Operating"`), schema scaffolding
   (sheets under separate authorization).
2. **T4** — durable Save (operation intent, atomic batch, readback, recovery, cache bump).
3. **T5** — 1030 projection + reconciliation report (read-only).
4. **T6** — reversal writer, then correction (one batch), with concurrency tests.
5. **T7** — operator UI flow (Save-first; reversal server-ready, UI exposure deferred
   per §12) + client invalidation hooks.
6. **T8** — Finance integration proofs (read-only assertions over real readers).
7. **T9** — release gate: mutation sensitivity, source audit, historical preservation
   (16-sheet sha non-regression pattern).
8. **T10** — separately authorized production activation + first genuine receipt
   acceptance (§26).

Each step lands only with its own regression gate (baseline 101 + new suites); no step
may modify frozen legacy behavior.

## 29. Acceptance gates — 25 completion criteria

1. Baseline HEAD verified `0cf8aba` before any action.
2. T1 preservation commit attempted first, exact 2 paths only.
3. No file outside the authorized set ever staged (27 `u10e-*` untouched).
4. This document exists with all required contract sections (R5–R39 coverage).
5. Harness exists at `tests/tmp/t2-design-challenge-harness.js`.
6. Harness labeled "Treasury T2 design harness" and read-only.
7. Harness excluded from clasp via allowlist `.claspignore` (`tests/` never included).
8. 20/20 design-challenge cases pass — MEASURED.
9. 5-point Asia/Jakarta date battery passes — MEASURED.
10. Full regression `node _test_runner.js` = 101 PASS / 0 FAIL — MEASURED after T2 work.
11. `git diff --check` clean.
12. Final `git status --short` audited: tracked delta 0 after commits.
13. All 27 untracked `tests/tmp/u10e-*` untouched.
14. Runtime source byte-identical to `0cf8aba` (source-delta proof empty).
15. Runtime source changes = 0.
16. Production writes = 0.
17. Deployment actions = 0.
18. `clasp push`/deploy/version = 0.
19. Git push = 0.
20. T2 commit contains only explicit T2 paths.
21. T1 measured evidence not rewritten.
22. No Sale / Payment / Settlement / Cash-Bank mutation.
23. No 2010 / 2000 / AP / Purchase mutation.
24. No config / account / schema mutation.
25. Final 51-item report produced with MEASURED/UNKNOWN evidence classes honored.

## 30. FORBIDDEN (unchanged, binding)

Treasury receipt creation in production; 1030 clearing in production; Sale/Correct/Void
invocation; Cash/Bank mutation; refund; AP/Purchase mutation; account/schema/config
mutation; migration/backfill; `clasp push`; deploy/version; runtime source modification;
Git push; fake production test receipts; second push (Rule 7); manual deferral of an
authorized clasp command (Rule 8).

---

*Design evidence for this document: SOURCE verification at HEAD `0cf8aba` of
`40.Cash.Foundation.js` (cash universe, headers, signature), `36.Finance.Service.js`
(P&L projection comment, `buildCashFlowStatement`), `39.Balance.Foundation.js`
(`buildPolicyCStatementReconciliation`, `validateBalanceLedgerCandidates`,
`policyCJournalSignature_`), `20.Data.Source.js` (`canonicalDateKey`, `CANONICAL_ENTRY`),
`95A.Transaction.Production.js` (operation/conflict/hash semantics),
`97/97A/97C/97D/97E.SalesRecognition.V2.*` (contract, save sequence, correction lineage,
config resolver, activation), `90/91` (cache revisions), `_test_runner.js`,
`.claspignore`, plus PRIOR-MEASURED T1 baseline.*
