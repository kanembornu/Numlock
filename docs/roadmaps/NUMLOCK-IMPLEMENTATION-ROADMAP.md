# NUMLOCK Revised Implementation Roadmap

| Field | Value |
| --- | --- |
| Document | `docs/roadmaps/NUMLOCK-IMPLEMENTATION-ROADMAP.md` |
| Roadmap Status | **IMPLEMENTATION ROADMAP STATUS: ACTIVE — DERIVED FROM CANONICAL BUSINESS CONTRACT** |
| Classification | L2 documentation-only / R1 (planning artifact) |
| Canonical contract | `docs/contracts/NUMLOCK-BUSINESS-CONTRACT.md` |
| Canonical contract commit | `e56acfefb3dfbb3eaa08de7e9af0a42e6ba02a0b` |
| Contract status | APPROVED_CANONICAL (`BUSINESS CONTRACT STATUS: APPROVED — CANONICAL`) |
| Business Decision Gate | COMPLETE |
| Reconciliation authority | BUSINESS_DECISION_CONTRACT_RECONCILIATION_PASS |
| Finance authority | Frozen Finance Final Baseline (`docs/evidence/finance-final-baseline/README.md`) |
| Source authority | Current source architecture/dependencies (context; never overrides contract) |
| Authoring scope | Documentation only. No application source, test, evidence, contract, or worktree mutation. |
| Next action | REVIEW_AND_FREEZE_REVISED_IMPLEMENTATION_ROADMAP |

## 1. Document Purpose

This roadmap derives the target NUMLOCK implementation sequence from the canonical Business Contract. It is a planning artifact. It does NOT authorize implementation, deployment, migration, production writes, evidence mutation, or retirement of any capability.

- Where an older roadmap (`docs/ROADMAP.md`, backlog history, prior audit recommendations) conflicts with the canonical Business Contract, **the canonical Business Contract wins**. Obsolete roadmap work is superseded, not preserved for its own sake (Section 10).
- Current implementation state is context evidence only. This roadmap classifies that state against the target contract; it does not weaken the target.
- TARGET (Sections 1–32, 34 of the Business Contract) is normative and binding. CURRENT IMPLEMENTATION STATE (Business Contract Section 33; reconciliation baseline below) is non-authoritative and repairable.

## 2. Authorities and Precedence

Authority order for this roadmap:

1. `docs/contracts/NUMLOCK-BUSINESS-CONTRACT.md` — canonical, commit `e56acfefb3dfbb3eaa08de7e9af0a42e6ba02a0b`, status APPROVED_CANONICAL.
2. Completed Business Decision Contract Reconciliation (PASS) — Business Decision Gate COMPLETE.
3. Frozen Finance Final Baseline — Policy C semantics, PurchaseEvent contract, finance authority matrix, migration safety record.
4. Current source architecture/dependencies — sequencing context only.

Conflict rule: implementation gaps are repaired toward the contract. The contract MUST NOT be reinterpreted to match implementation (Business Contract §34.2). Roadmap sequencing MAY adapt to discovered implementation dependencies, but MUST NOT silently change business decisions (Section 13 governance).

## 3. Governance Rules

1. The Business Contract is authoritative over this roadmap.
2. This roadmap may change as implementation dependencies are discovered.
3. This roadmap cannot silently change the Business Contract. A business-contract change requires an explicit owner decision and a canonical contract revision.
4. Phase completion requires its **Acceptance Gate**, not merely code existence.
5. **DORMANT does not mean safe to delete.** Dormant capabilities remain for historical compatibility until separately proven safe to retire (Business Contract §31).
6. Historical evidence remains immutable. Historical transaction records MUST NOT be rewritten to conform old transactions to new operational rules (§28).
7. Production mutation requires explicit authorization at the appropriate gate. This roadmap pre-authorizes nothing (§13, Phase 13/14 gates).
8. Business rules listed in the Business Contract are decided. They MUST NOT be re-opened as TODOs (§2.8). Genuinely undecided implementation details are implementation decisions (Section 7), not business blockers.
9. Documentation/UI-only work is not equivalent risk to financial mutation work. Gate strength differs accordingly (Section 6).
10. No deployment, `clasp` push, migration, production write, or historical backfill is authorized by this roadmap or by phase classification alone.

## 4. Reconciliation Baseline — Current Implementation State

Derived from the completed Business Decision Contract Reconciliation and the canonical Business Contract §33. Classification of implementation state; target contract is NOT weakened.

### KEEP (compatible; preserve)

- Selling Price snapshot (Order-line immutable snapshot rule).
- HPP snapshot (Payment-time immutable snapshot; historical tabsal.HPP frozen authority).
- Ordinary Expense (PAID-at-recording semantics, mandatory Paid Via/cashAccountCode).
- Item/Ingredient Master.
- UOM conversion (authoritative conversion authority; Base UOM rule).
- Product Master.
- Recipe.
- Compatible existing transaction IDs and timestamps.

### CHANGE (implementation gap; repair toward contract)

- tabsal sale-line operational semantics → Order + Payment architecture (new domains; tabsal remains historical read authority).
- Receive Via authority and business labels (authoritative dropdown → Finance account mapping).
- Purchase UNPAID path → Purchase always PAID.
- Purchase Evidence and Confirm Information steps → removed.
- Free-text Supplier behavior → mandatory Supplier Master reference.
- UsableQty costing authority → removed from business authority.
- Standard Cost dual-path → single authoritative Approved Standard Cost path.
- Reporting all-sales-as-revenue → PAID-only Revenue authority.
- Form UX labels/prompts/helper/validation behavior → Global Form UX Contract.

### DORMANT (historical compatibility; not active target; not deleted)

- AP Settlement operational workflow.
- Purchase UNPAID operational path.
- InventoryReceipt.
- InventoryLedger.
- Goods Receipt / attested activation gate.
- Incompatible COGSIngredients PurchaseCost/UsableQty authority path.

### MISSING (target capabilities; to be introduced by roadmap phases)

- Order model.
- Payment entity.
- Fulfillment lifecycle.
- DINE_IN/TAKE_AWAY.
- Supplier Master.
- Recipe Versioning.
- ADMIN/OPERATOR roles.
- Recommended Standard Cost (capability boundary only; algorithm undefined).
- PAID-based reporting dimensions.

### RETIRE_CANDIDATE

- None currently authorized (Business Contract §31.3). Retirement evaluation occurs only in Phase 14, read-only first, with separate proof and authorization.

## 5. Roadmap Design Principles

1. Dependency-driven sequencing, not file-number-driven sequencing.
2. Preserve frozen Finance semantics.
3. Adapt operational domains to Finance; Finance MUST NOT be redefined for operational convenience (§30.2).
4. Keep historical read compatibility (historical UNPAID PurchaseEvent / AP 2000 truth stays readable; §30.5–30.6).
5. Prevent new operational writes from using superseded semantics.
6. **Never activate stock-on-hand architecture** (§22).
7. **Never introduce operational AP** (§10.2, §32).
8. **Never reintroduce Yield/UsableQty as business authority** (§14).
9. Keep DORMANT capabilities dormant until separate future retirement proof (§31).
10. Bounded phases with explicit entry criteria, implementation scope, acceptance gates, exit criteria.
11. Production rollout only after local/runtime acceptance.
12. Preserve fail-closed behavior at financial mutation boundaries.
13. Separate business-domain implementation (Phases 1–9) from later UX/dashboard polish (Phases 10–11), with cross-domain acceptance in Phase 12.
14. Avoid premature cleanup of legacy/dormant code.
15. Do not invent new business requirements. Implementation details not mandated by the contract remain implementation decisions (Section 7).

## 6. Critical Gates

Gate strength distinguishes financial mutation risk from documentation/UI risk.

| Gate class | Phases | Reason |
| --- | --- | --- |
| **CRITICAL** | Phase 3 — Purchase operational alignment | New operational writes against frozen Finance PurchaseEvent semantics; PAID/cash-bank authority; Supplier Master mandate; fail-closed purchase boundary. |
| **CRITICAL** | Phase 6 — Payment / Finance settlement | SALE_SETTLEMENT Finance integration; Revenue + HPP recognition exactly at successful Payment; idempotency; immutable HPP snapshot; duplicate-posting prevention. |
| **CRITICAL** | Phase 13 — Production rollout | Production activation boundary; source/runtime parity; zero unauthorized migrations; rollback boundary; first-real-event observation. |
| **HIGH** | Phase 2 — Standard Cost authority cutover | Supersedes UsableQty/PurchaseCost authority path; historical HPP preservation; explicit authorized change path; no automatic Purchase → Standard Cost mutation. |
| **HIGH** | Phase 5 — Order architecture cutover | New Order domain replaces tabsal sale-line operational semantics; historical read compatibility must hold; RecipeVersion binding prerequisites. |
| **HIGH** | Phase 9 — Reporting authority cutover | Revenue/HPP recognition authority moves to PAID-only Payment snapshots; dashboard/report consumers must not invent alternative rules. |

All other phases: LOW–MEDIUM gate strength. Phases 10–11 are polish/consistency layers and MUST NOT precede the Phase 9 reporting-authority gate. Phase 12 is a cross-domain evidence gate (MEDIUM–HIGH operational risk, no production mutation). Phase 14 is read-only by default.

## 7. Implementation Decision Gates

Undecided implementation details. These are NOT business blockers. Defining them MUST NOT reopen approved business decisions.

| # | Decision gate | Constraint |
| --- | --- | --- |
| 1 | Recommended/Proposed Standard Cost algorithm | Contract §16.1 permits a recommendation; §16.2 forbids inventing/assuming the algorithm. Algorithm MUST be decided in explicit implementation/product planning before any coding that consumes a recommendation. Recommended cost remains a proposal, never authority (§16.3). Applying a proposal as Approved Standard Cost requires the explicit authorized action of §17.3. |
| 2 | Human-readable Order Number exact format | §23.3–23.7: system-generated; NOT relational primary authority; MUST NOT be reused; MUST NOT encode unnecessary meaning (Customer/Order Type). Format is an implementation decision that must satisfy those rules. |
| 3 | Exact physical schema/table strategy for Order, Payment, RecipeVersion domains | Must satisfy business authority (stable immutable IDs, §23) and historical compatibility (§28). Storage layout is an implementation decision; business semantics are not. |
| 4 | Authentication/identity mechanism for ADMIN/OPERATOR | §25 roles are decided; the identity/authentication mechanism is an implementation decision if not already authoritative in source architecture. Actor audit identity MUST be preserved where applicable (§25.7). |

## 8. Phase Architecture — Summary

| # | Phase | Risk | Primary classification transition |
| --- | --- | --- | --- |
| 1 | Master Data Foundation / Hardening | MEDIUM | MISSING Supplier Master → KEEP; Item/UOM hardening CHANGE → KEEP |
| 2 | Costing Authority Alignment | HIGH | CHANGE UsableQty/Standard Cost dual-path → KEEP; DORMANT COGSIngredients path remains DORMANT |
| 3 | Purchase Operational Alignment | CRITICAL | CHANGE Purchase UNPAID/evidence/free-text Supplier → KEEP PAID path; DORMANT Purchase UNPAID remains DORMANT |
| 4 | Product / Recipe Temporal Hardening | MEDIUM | MISSING Recipe Versioning → KEEP; direct-resale Product → none (contract rule enforced) |
| 5 | Order Domain Foundation | HIGH | MISSING Order model/DINE_IN/TAKE_AWAY → KEEP; tabsal sale-line operational writes superseded (read compatibility preserved) |
| 6 | Payment / Finance Settlement | CRITICAL | MISSING Payment entity → KEEP; Revenue/HPP recognition authority established at Payment |
| 7 | Fulfillment | MEDIUM | MISSING Fulfillment lifecycle → KEEP |
| 8 | Role / Permission Enforcement | MEDIUM | MISSING ADMIN/OPERATOR → KEEP |
| 9 | Reporting Alignment | HIGH | CHANGE all-sales-as-revenue → KEEP PAID-only Revenue; MISSING PAID dimensions → KEEP |
| 10 | Dashboard / Analytics Alignment | LOW–MEDIUM | Reporting consumers aligned; no new business rules |
| 11 | Global Form UX Conformance | LOW | CHANGE form UX guidance/validation → KEEP |
| 12 | End-to-End Operational Acceptance | MEDIUM–HIGH | Cross-domain conformance evidence; no classification change |
| 13 | Production Rollout / Acceptance | CRITICAL | Activation boundaries; no classification change |
| 14 | Post-Stabilization Retirement Audit | LOW (read-only first) | DORMANT → RETIRE_CANDIDATE evaluation only; none pre-authorized |

## 9. Phase Contracts

Each phase below carries the full Phase Contract. Phases are ordered by dependency: master data → costing authority → purchase → product/recipe → order → payment → fulfillment → roles → reporting → dashboard → UX conformance → end-to-end → production → retirement audit.

Role-enforcement foundations MAY be pulled earlier than Phase 8 only where source architecture requires minimal authorization infrastructure for safe implementation; complete role-enforcement acceptance remains Phase 8 (see Phase 8 notes).

---

### Phase 1 — Master Data Foundation / Hardening

**Objective**

Establish authoritative Supplier, Item/Ingredient, and UOM master data that downstream Purchase, Recipe, and Costing phases can consume without inventing inline or free-text data.

**Why This Phase Occurs Here**

Every later operational phase references master identities. Supplier Master is MISSING; Item/Ingredient and UOM exist but need hardening (Active/Inactive lifecycle, historical hard-delete protection, Base UOM authority, item-filtered Purchase UOM). Master data is the dependency root.

**Entry Criteria**

- Canonical Business Contract frozen (commit `e56acfefb3dfbb3eaa08de7e9af0a42e6ba02a0b`, APPROVED_CANONICAL).
- Business Decision Gate COMPLETE; reconciliation PASS recorded.
- This roadmap status ACTIVE — DERIVED FROM CANONICAL BUSINESS CONTRACT.
- Existing Item/Ingredient, UOM, and conversion data read successfully in current source architecture.
- Phase 8 foundational authorization mechanism (if required earlier) identified or scoped as a prerequisite decision.

**In Scope**

- Supplier Master: create/maintain; minimum required field Name; optional Address/Phone/Contact/Notes; Active/Inactive lifecycle; historical Supplier MUST NOT be hard-deleted (§11.5); dropdown exposes active Suppliers only (§11.4).
- Supplier is NOT an AP/creditor authority: no debt balance, credit limit, payment terms, due date, or AP history (§11.7, §11.10).
- Item/Ingredient compatibility with canonical contract: stable identity across Purchase, Recipe, Costing (§12.4); descriptive fields editable; structural historical meaning preserved (§12.6); item with history MUST NOT be hard-deleted — use Inactive (§12.7).
- Active/Inactive lifecycle for Item/Ingredient and Supplier, with historical hard-delete protection.
- Base UOM authority: exactly one Base UOM per Item/Ingredient (§13.1); Base UOM protected once transactional history exists (§12.8, §13.9–13.11).
- Item-filtered Purchase UOM: Purchase UOM dropdown filtered by selected Item (§13.3); UOM from database/configuration; no free-text UOM (§13.4).
- UOM conversion authority: each Purchase UOM has an authoritative Base UOM conversion (§13.5); conversion contains NO yield/waste (§13.12, §14.4); conversion change is prospective configuration/versioning (§13.10); operator MUST NOT edit conversion from Purchase (§13.6).
- Structural-history protection: historical UOM and conversion records MUST NOT be hard-deleted (§13.11).
- Admin-only master mutation boundary (contract §25; full enforcement acceptance in Phase 8 — Phase 1 implements the mutation boundary for master writes touched here).
- Global form UX contract for affected master forms: visible label, meaningful placeholder/helper, dropdown prompt, specific validation (§27).
- Explicit acceptance that downstream Purchase (Phase 3) and Recipe (Phase 4) can consume this authoritative master data.

**Explicitly Out of Scope**

- Stock-on-hand, SOH, stock validation, inventory balance (§22).
- Operational AP, supplier debt fields, credit terms (§10.2, §11.10).
- Inline Item creation from Purchase (§12.2); free-text Item/Supplier/UOM on transactions.
- Purchase or Order write-path rework (Phases 3, 5–6).
- Standard Cost authority changes (Phase 2).
- Recipe Versioning (Phase 4).
- Full OPERATOR role enforcement acceptance (Phase 8).
- Retirement of dormant inventory/AP code (Phase 14).
- New business requirements beyond the contract.

**Key Dependencies**

- Business Contract §11–§13 (Supplier Master, Item/Ingredient Master, UOM and Conversion), §27 (UX), §25 (role boundary).
- Frozen Finance Final Baseline: SupplierID already exists in PurchaseEvent 29-column schema; master IDs must align with existing identity conventions.
- Current source master-data structures (Products sheet, item/UOM structures) as compatibility context.

**Finance Boundary**

- Master data writes are configuration writes, not Finance postings. No journal, no PurchaseEvent write, no expense/revenue implication from master changes.
- Supplier carries NO AP/creditor authority; Finance AP 2000 historical truth remains governed by frozen baseline (historical UNPAID PurchaseEvent / AP 2000 readable; §30.5–30.6).
- No PurchaseEvent schema change. Migration never rerun (§30.8).

**Historical Compatibility Boundary**

- Historical Suppliers/Items/Ingredients/UOM/conversions referenced by transactions MUST remain readable; deactivate rather than hard-delete.
- Conversion changes are prospective; historical conversion meaning MUST NOT be retroactively changed (§13.9).
- Existing transaction IDs and timestamps preserved (reconciliation KEEP list).

**Implementation Risk**

MEDIUM — new Supplier Master domain; lifecycle + hard-delete protection; conversion authority rules intersect existing data.

**Operational Risk**

MEDIUM — master-data mistakes propagate to every downstream Purchase/Recipe write; protected-field rules must be enforced at write boundary, not only UI.

**Required Tests**

- Supplier Master CRUD with Name required; optional fields; Active/Inactive; hard-delete rejected when historically referenced.
- Purchase-facing Supplier dropdown exposes active Suppliers only (test surface may be prepared here or verified in Phase 3; Phase 1 proves the data feed exists).
- Item/Ingredient stable identity; Inactive instead of hard-delete with history.
- Base UOM uniqueness; Base UOM write blocked once transactional history exists.
- Item-filtered UOM list; free-text UOM rejected at validation layer.
- Conversion authority: conversion without yield/waste accepted; prospective conversion change leaves historical rows interpretable; hard-delete of historical conversion rejected.
- UX contract tests for master forms: labels, prompts, specific validation messages.
- Downstream-consumability proof: Purchase and Recipe data consumers resolve Supplier/Item/UOM/conversion from master authority (read-path contract test).

**Acceptance Gate**

- Supplier Master exists and is the only Supplier source for Purchase (free-text Supplier impossible at write path by design; enforced test).
- All master hard-delete/history protections proven by tests.
- Base UOM + item-filtered Purchase UOM + authoritative conversions proven by tests.
- Admin-only master mutation boundary in force for writes introduced/touched in this phase.
- Global form UX contract conformance proven for affected master forms.
- Downstream Purchase/Recipe consumption contract passes against master authority.
- No stock-on-hand capability added or implied.

**Exit Criteria**

- Acceptance Gate PASS with recorded test evidence.
- Phase 2 entry criteria satisfiable: master identities and conversions available to costing alignment.
- No dormant inventory/AP capability activated.

**Rollback/Fail-Closed Considerations**

- Master write paths fail closed on protected-field violations (Base UOM with history, hard-delete with references).
- New Supplier Master writes are prospective configuration; rollback = deactivation paths, never deletion of referenced records.
- No Finance-boundary mutation exists in this phase; rollback risk is configuration-only.

**Expected Classification Transitions**

- MISSING Supplier Master → KEEP (after Phase 1).
- Item/Ingredient Master, UOM conversion hardening: CHANGE (hardening gaps) → KEEP.
- DORMANT capabilities untouched; DORMANT remains DORMANT.

---

### Phase 2 — Costing Authority Alignment

**Objective**

Remove Yield/UsableQty from target business authority; establish Actual Purchase Cost as history; establish Approved Standard Cost as the single authoritative costing path; preserve historical HPP; define Recommended/Proposed Standard Cost as a proposal boundary only.

**Why This Phase Occurs Here**

Purchase writes (Phase 3) and Recipe costing (Phase 4) both depend on a single costing authority. The current COGSIngredients PurchaseCost/UsableQty path is a DORMANT incompatible authority path (§31.1). Cutover must precede new purchase operational writes so no new write uses superseded semantics (principle 5).

**Entry Criteria**

- Phase 1 Acceptance Gate PASS (authoritative Item/UOM/conversion master data).
- Frozen Finance Final Baseline understood: tabsal.HPP historical HPP authority; Policy C HPP semantics frozen (§30.7); prospective HPP non-posting analytics.
- Decision Gate 1 (Recommended Standard Cost algorithm) either decided or explicitly deferred — algorithm MUST NOT be invented during this phase; if a recommendation feature is to be coded, Gate 1 MUST close first.
- Authority-cutover plan distinguishes KEEP/DORMANT treatment of existing COGSIngredients paths.

**In Scope**

- Remove Yield/UsableQty from target business authority: no Yield %, no Usable Qty Purchase input; purchased Base Qty treated as 100% usable for costing (§14.1–14.3).
- Preserve historical compatibility where needed: historical rows and HPP snapshots remain readable; UsableQty remnants in dormant code paths are NOT deleted here (§31.2, principle 14).
- Actual Purchase Cost definition: normalized actual unit cost = Purchase Total / Base Qty (§14.5); reporting/analysis history only; NOT authoritative for Recipe/Product costing (§15.1–15.4).
- Normalized Base Qty costing: Qty/UOM → Base Qty via authoritative conversion; cost math uses Base Qty, not Purchase UOM (§13.8, §14.5).
- Standard Cost authoritative path: Approved Standard Cost is authoritative for Recipe and Product costing (§17.2); recipe component cost = Recipe Qty × authoritative Ingredient Standard Cost (§17.4); Product cost = Recipe × authoritative Ingredient Standard Cost (§19.5).
- Explicit Standard Cost change authority: changes require explicit authorized action (ADMIN authority; §17.3); prospective for costing (§17.5); MUST NOT rewrite Purchase history (§17.7); MUST NOT automatically change Selling Price (§17.8, §8.8).
- Recommended/Proposed Standard Cost capability boundary: system MAY calculate a recommendation from Purchase history (§16.1); recommendation is a proposal, NOT authoritative (§16.3); applying a proposal requires the §17.3 explicit authorized action; algorithm undefined unless Decision Gate 1 closed (§16.2).
- Product/Recipe cost consumption of Standard Cost: Recipe version costing derives from Approved Standard Cost at the authoritative path.
- **No automatic Purchase → Standard Cost mutation** (§15.3): Purchase writes never write Standard Cost.
- Historical HPP preservation: historical Sales HPP immutable; Payment-time snapshot rule applies to NEW orders from Phase 6 (§21.3); existing tabsal.HPP snapshots untouched.

**Explicitly Out of Scope**

- Purchase operational form/write rework (Phase 3) beyond the cost-math authority boundary.
- Recipe Versioning implementation (Phase 4) — costing authority here defines the path; versioning binds Orders in Phase 5.
- Order/Payment/HPP snapshot capture (Phases 5–6).
- Inventing the Recommended Standard Cost algorithm (Decision Gate 1).
- Deleting COGSIngredients or UsableQty dormant remnants (Phase 14).
- Stock-on-hand, inventory valuation, waste metrics (§22, §26.10).
- Operational AP.

**Key Dependencies**

- Phase 1 master data (Base UOM, conversions, Item identity).
- Business Contract §14–§17, §19.5, §21.
- Frozen Finance Final Baseline: unit Standard Cost currently read-model authority = COGSIngredients.PurchaseCost / UsableQty per BaseUOM; RecipeStandardCost = separate write-path proposal contract — these are the paths to align without breaking Finance reads.

**Finance Boundary**

- Approved Standard Cost is a costing authority for Recipe/Product/HPP computation; it is NOT a Finance posting authority.
- Purchase writes resolve to Finance cash/bank (PAID) via frozen PurchaseEvent semantics; Standard Cost is never posted.
- Historical HPP (tabsal.HPP) and Policy C HPP semantics remain frozen (§30.7); no retroactive HPP rewrite.
- No PurchaseEvent schema change; migration never rerun (§30.8).

**Historical Compatibility Boundary**

- Historical HPP snapshots immutable (§21.3, §28.4).
- Historical Purchase cost records remain readable as Actual Purchase Cost history (§15.4).
- Standard Cost changes are prospective only (§17.5); historical recipe/sales interpretation unchanged.
- DORMANT UsableQty/PurchaseCost authority path remains readable until Phase 14 proof; new writes MUST NOT use it.

**Implementation Risk**

HIGH — authority cutover across costing consumers (Products read model, Recipe costing, reporting inputs); dual-path period must not leak superseded authority into new writes.

**Operational Risk**

HIGH — wrong authority selection misstates Product cost/HPP; must fail closed when authoritative Standard Cost is missing rather than silently falling back to Purchase history.

**Required Tests**

- Yield/UsableQty absent from all target costing inputs; purchase cost math = Purchase Total / Base Qty using authoritative conversion.
- Actual Purchase Cost produced per purchase; NOT consumed as Recipe/Product costing authority.
- Recipe component cost = Recipe Qty × Approved Ingredient Standard Cost (authoritative path).
- Standard Cost change is explicit/authorized; change is prospective; Purchase history unchanged; Selling Price unchanged by Standard Cost change.
- Recommended/Proposed Standard Cost: proposal stored separately from Approved Standard Cost; no auto-apply; auto-apply rejected without §17.3 authorized action.
- No automatic Purchase → Standard Cost write on any purchase path (assert Standard Cost row unchanged after purchase write).
- Historical HPP snapshots unchanged after Standard Cost and Recipe-cost operations (regression fixture).
- Missing Approved Standard Cost → fail closed with explicit error for Recipe/Product cost consumption (no silent UsableQty/PurchaseCost fallback in target paths).
- DORMANT path non-use: target write paths contain no UsableQty authority usage.

**Acceptance Gate**

- Single Approved Standard Cost authority proven for Recipe/Product costing; no target write path uses Yield/UsableQty.
- Recommendation boundary proven (proposal ≠ authority); Decision Gate 1 resolved or explicitly deferred without blocking authority alignment.
- No automatic Purchase → Standard Cost mutation proven by test.
- Historical HPP preserved (regression evidence).
- HIGH gate: authority cutover plan + fail-closed missing-cost behavior + compatibility evidence recorded.

**Exit Criteria**

- Acceptance Gate PASS with recorded evidence.
- Phase 3 purchase writes can compute normalized cost without superseded authority.
- Phase 4 recipe costing can consume Approved Standard Cost.
- DORMANT COGSIngredients authority path remains dormant and unread by new writes.

**Rollback/Fail-Closed Considerations**

- Fail closed on missing Approved Standard Cost in target cost paths; never substitute dormant PurchaseCost/UsableQty silently.
- Cutover is write-path authority change; historical data untouched → rollback = read-path authority switch, not data migration.
- No Finance posting rollback needed (no posting authority introduced).

**Expected Classification Transitions**

- CHANGE UsableQty costing authority → KEEP (target authority = Approved Standard Cost + Base Qty normalization).
- CHANGE Standard Cost dual-path → KEEP (single authoritative path) for new writes; DORMANT COGSIngredients path remains DORMANT.
- MISSING Recommended Standard Cost → capability boundary established (KEEP as proposal boundary; algorithm still Decision Gate 1 unless closed).
- Historical HPP remains KEEP (frozen).

---

### Phase 3 — Purchase Operational Alignment  (CRITICAL GATE)

**Objective**

Align the operational Purchase write path to the canonical contract: Purchase always PAID; mandatory Supplier from Supplier Master; mandatory Paid Via; item-filtered UOM; Base Qty normalization; PAID + RECEIVED business condition; no Evidence/Confirm Information; no new UNPAID operational writes; frozen Finance PurchaseEvent semantics preserved.

**Why This Phase Occurs Here**

Purchase is the first operational write domain that hits frozen Finance (PurchaseEvent, cash/bank authority). Master data (Phase 1) and costing authority (Phase 2) must be stable first. This is a CRITICAL financial mutation boundary.

**Entry Criteria**

- Phase 1 Acceptance Gate PASS (Supplier Master authoritative; item-filtered UOM; conversions).
- Phase 2 Acceptance Gate PASS (normalized Base Qty costing; no automatic Standard Cost mutation).
- Frozen Finance Final Baseline PurchaseEvent contract understood: 29-column schema; PAID requires cash account; migration complete and NEVER rerun (§30.8); idempotency via RequestKey/EventID.
- CRITICAL human gate process identified for this phase's acceptance.
- Historical UNPAID PurchaseEvent read-compatibility path verified in current source (read-compatibility normalization separate from strict write validation).

**In Scope**

- Purchase always PAID when recorded; Purchase cannot create new debt (§10.1).
- Mandatory Supplier from Supplier Master; NO free-text Supplier (§11.1–11.3); Supplier dropdown exposes active Suppliers.
- No operational AP; no supplier debt; no AP Settlement UI (§10.2–10.3).
- Mandatory Paid Via at Purchase entry (§10.4).
- Purchase Date defaults to current date, operator-editable, distinct from CreatedAt (§10.11, §24.9–24.10).
- Item from database; NO inline Item creation; NO free-text Item (§12.1–12.3).
- Item-filtered UOM dropdown (§13.3); Qty + UOM → Base Qty via authoritative conversion (§13.8).
- Purchase Price / actual normalized cost: normalized unit cost = Purchase Total / Base Qty (§14.5); recorded as Actual Purchase Cost history (§15).
- PAID + RECEIVED as the business condition of Save Purchase (§10.5); does NOT imply stock-on-hand tracking (§10.6).
- NO Purchase Evidence (§10.8); NO Confirm Information step (§10.9).
- No new UNPAID operational writes; historical UNPAID PurchaseEvent remains readable (§30.5).
- AP backend remains dormant; no InventoryReceipt/InventoryLedger activation; no Goods Receipt operator workflow (§10.7, §22, §31).
- No stock-on-hand implication.
- Appropriate form labels/prompts/helper/validation for Purchase form (§27; e.g. `Pilih supplier`, `Pilih item`, `Pilih UOM`, `Pilih metode pembayaran`, `Supplier wajib dipilih.`, `Qty harus lebih besar dari 0.`, `UOM tidak valid untuk item ini.`).
- Preserve frozen Finance PurchaseEvent semantics: PAID → cash/bank authority; strict PaymentStatus write validation; no invented PaymentStatus; no legacy-payment inference.

**Explicitly Out of Scope**

- AP Settlement operational workflow; Purchase UNPAID operational path; supplier debt posting (DORMANT; §31).
- InventoryReceipt/InventoryLedger/Goods Receipt activation; stock-on-hand; negative stock; inventory valuation (§22).
- PurchaseEvent schema migration rerun (NEVER; §30.8).
- Standard Cost auto-derivation from Purchase (Phase 2 authority; §15.3).
- Order/Payment sales domains (Phases 5–6).
- Dashboard/reporting realignment (Phases 9–10).
- Retirement of dormant Purchase UNPAID branches (Phase 14).

**Key Dependencies**

- Phase 1 (Supplier Master, Item/UOM/conversion authority, master UX).
- Phase 2 (Base Qty costing math; no Standard Cost auto-mutation).
- Business Contract §10–§15, §24, §27, §29–§31.
- Frozen Finance Final Baseline PurchaseEvent contract and idempotency controls.
- Current source: strict write validation vs read-compatibility normalization separation (existing repair pattern to preserve).

**Finance Boundary**

- CRITICAL. New Purchase writes are PAID and resolve to cash/bank authority (§30.4); consistent with Policy C PAID acquisition posting.
- Historical UNPAID PurchaseEvent / AP 2000 truth remains readable and unrewritten (§30.5–30.6).
- No new operational AP; no Purchase debt; no AP Settlement workflow (§10.2–10.3).
- PurchaseEvent schema untouched; migration never rerun (§30.8).
- Inventory capabilities not activated merely because code exists (§30.9, §22.6).
- Idempotency: exact retry → ALREADY_APPLIED; no duplicate Finance posting (baseline contract; §29).

**Historical Compatibility Boundary**

- Historical UNPAID PurchaseEvent rows remain readable via read-compatibility path only; legacy rows remain non-postable where frozen baseline defines them; no invented PaymentStatus; no row mutation.
- Existing transaction IDs/timestamps preserved (reconciliation KEEP).
- Historical Supplier/Item/UOM references remain valid; deactivated masters stay readable.
- Purchase Date vs CreatedAt distinction preserved for history.

**Implementation Risk**

HIGH — new operational writes against frozen Finance schema; Supplier/UOM validation must fail closed; read/write normalization boundary must remain separate.

**Operational Risk**

CRITICAL — financial mutation boundary; wrong Paid Via mapping misstates cash/bank; duplicate posting risk on retry; accidental UNPAID write would violate contract §10.1.

**Required Tests**

- Purchase write requires Supplier from Supplier Master; free-text Supplier rejected with specific validation (`Supplier wajib dipilih.`).
- Purchase write requires Paid Via; missing → fail closed.
- Purchase Date defaults today, editable; CreatedAt automatic; distinct fields.
- Item from database only; inline/free-text Item rejected.
- UOM dropdown filtered by selected Item; invalid UOM for item → specific validation (`UOM tidak valid untuk item ini.`); Qty ≤ 0 rejected (`Qty harus lebih besar dari 0.`).
- Qty × UOM → Base Qty normalization via authoritative conversion; conversion not editable from Purchase form.
- PAID + RECEIVED condition enforced at Save.
- No Purchase Evidence step; no Confirm Information step present in write path.
- No UNPAID operational write possible; historical UNPAID PurchaseEvent rows still readable (regression read test).
- Finance boundary: PAID Purchase resolves to cash/bank authority consistent with frozen PurchaseEvent semantics; AP 2000 not written by new PAID purchases.
- Idempotency: exact retry → ALREADY_APPLIED; no duplicate journal.
- No InventoryReceipt/InventoryLedger write from Purchase save; no stock implication in response/tests.
- Standard Cost unchanged after purchase write (regression from Phase 2).
- UX contract tests for Purchase form (labels, prompts, specific validation).
- Migration invocation counter remains 0.

**Acceptance Gate**

- CRITICAL gate: all required tests PASS with recorded evidence.
- Purchase write path strictly PAID; frozen Finance PurchaseEvent semantics demonstrated (cash/bank resolution; strict validation; read-compatibility only for legacy rows).
- Supplier/UOM/Base Qty/Date contracts proven; no free-text Supplier/Item/UOM; no Evidence/Confirm Information; no UNPAID write path.
- Idempotency and fail-closed behavior proven at the financial mutation boundary.
- Dormant inventory/AP untouched; migration counters zero.

**Exit Criteria**

- Acceptance Gate PASS with recorded evidence and explicit CRITICAL human sign-off.
- Purchase reporting inputs (Purchase Date, Supplier, Item, UOM, Paid Via, actual cost) available for Phase 9.
- No new operational write uses superseded semantics.

**Rollback/Fail-Closed Considerations**

- CRITICAL. Write path fails closed on missing Supplier/Paid Via/invalid UOM/Qty; no partial purchase persist.
- Rollback boundary: revert operational write-path change; historical data remains intact (append-only PurchaseEvent); never rerun migration to "fix" state.
- If Finance-boundary evidence fails, STOP — do not ship purchase writes; do not compensate with Finance changes (§30.2, principle 3).
- PurchaseEvent migration remains untouched in all rollback paths (§34.15).

**Expected Classification Transitions**

- CHANGE Purchase UNPAID operational path → KEEP (PAID-only target write path); DORMANT Purchase UNPAID remains DORMANT (historical read only).
- CHANGE free-text Supplier → KEEP (Supplier Master reference).
- CHANGE Purchase Evidence/Confirm Information → removed from target write path (obsolete; Section 10).
- DORMANT InventoryReceipt/InventoryLedger/Goods Receipt remains DORMANT.

---

### Phase 4 — Product / Recipe Temporal Hardening

**Objective**

Harden Product/Recipe to contract rules: all Products require Recipe; Product vs Ingredient identity boundary; Recipe uses Base UOM and authoritative Standard Cost; Recipe Versioning with effective version rules; historical recipe preservation; Order-bindable RecipeVersion identity; inactive dependency guards; sellability gating; Selling Price authority independent from Standard Cost.

**Why This Phase Occurs Here**

Order foundation (Phase 5) binds to RecipeVersion; Payment HPP snapshot (Phase 6) consumes Recipe version × Standard Cost. Recipe temporal integrity must exist before Orders bind to versions.

**Entry Criteria**

- Phase 1 PASS (Item identity, Base UOM authority).
- Phase 2 PASS (Approved Standard Cost authoritative for recipe costing).
- Business Contract §18–§20, §8 (Selling Price independence) reviewed.
- Products Contract Reconciliation known OPEN/DEFERRED state considered: any Products-domain assertion work begins with full assertion inventory, not incremental assertion chasing (project decision context; roadmap sequencing constraint).

**In Scope**

- All Products require a Recipe; NO direct-resale/no-recipe Product (§18.1).
- Product vs Ingredient distinct identities (§18.2); Recipe references only registered Ingredients (§19.2).
- Recipe uses Ingredient Base UOM exclusively; no free-text Recipe UOM (§13.7, §19.3); Recipe quantity = standard consumption per one Product (§19.4).
- Recipe consumes authoritative Standard Cost: Product cost = Recipe × Approved Ingredient Standard Cost (§19.5); Recipe does NOT use current Purchase Price as authority (§19.6); Purchase changes MUST NOT alter Recipe (§19.7).
- Recipe Versioning (§20): substantive Recipe changes create a new version; historical Recipe meaning MUST NOT be overwritten; only one active Recipe version per Product at a given effective time; old versions remain historical.
- Effective version rules; Order-bindable RecipeVersion identity (stable identity; Order binds to version applicable at Order creation — binding enforced from Phase 5; §20.5).
- Product/Ingredient inactive dependency guards: Ingredient used by active Recipe MUST NOT be made Inactive until dependency resolved (§19.8); Product with Sales history MUST NOT be hard-deleted — Inactive (§18.3).
- Valid Recipe/costing dependency before Product is sellable (§18.4); every active Product has valid Selling Price (§8.1, §8.6).
- Selling Price authority remains Product/Pricing Master (§8.2); Standard Cost change MUST NOT automatically change Selling Price (§8.8); margin display MAY exist but MUST NOT auto-change Selling Price (§8.9–8.10).

**Explicitly Out of Scope**

- Order creation and RecipeVersion binding enforcement at Order time (Phase 5).
- Payment-time HPP snapshot capture (Phase 6).
- Selling Price editing UX beyond authority separation (master forms from Phase 1 patterns).
- Recommended Standard Cost algorithm (Decision Gate 1).
- Direct-resale Product exception (contract forbids; do not invent).
- Stock consumption on Recipe use; theoretical usage labelling handled in Phase 9 reporting.
- Retirement of legacy recipe code paths (Phase 14).

**Key Dependencies**

- Phase 1 (Ingredient identity, Base UOM).
- Phase 2 (Approved Standard Cost authority).
- Business Contract §8, §12–§14, §18–§20.
- Products domain source context (Products sheet authority; COGSRecipes structure) as compatibility baseline; current Proposed Usage simulation stays simulation-only unless contract-mandated behavior requires otherwise (simulation is not selling authority).

**Finance Boundary**

- Recipe/Product/Selling Price are master configuration; no Finance postings.
- Historical Sales HPP remains immutable; new HPP snapshots come only from Payment-time capture (Phase 6; §21).
- No PurchaseEvent interaction; no Standard Cost posting; no automatic Selling Price mutation.

**Historical Compatibility Boundary**

- Historical Recipe meaning preserved via versioning (§20.2); existing recipes remain readable.
- Historical Sales HPP snapshots unchanged by recipe changes (§20.7, §21.3).
- Product/Ingredient with history: Inactive, not hard-delete (§18.3, §12.7).
- Compatible existing IDs/timestamps preserved.

**Implementation Risk**

MEDIUM–HIGH — versioning introduces new temporal model; sellability gating must not break historical reads.

**Operational Risk**

MEDIUM — incorrect version binding misstates HPP later; inactive-dependency mistakes strand recipes; sellability gate mistakes block valid sales or allow invalid ones.

**Required Tests**

- Product without Recipe rejected from sellable state; direct-resale Product impossible.
- Recipe UOM = Base UOM only; free-text UOM rejected.
- Recipe costing = Σ(Recipe Qty × Approved Ingredient Standard Cost); Purchase Price not used as authority.
- Substantive Recipe change creates new version; historical version unchanged; only one active version per effective time.
- RecipeVersion identity stable and Order-bindable (contract test for identity shape; binding tested in Phase 5).
- Ingredient with active Recipe: Inactive blocked until dependency resolved.
- Product with Sales history: hard-delete rejected; Inactive allowed.
- Selling Price change does NOT change Standard Cost; Standard Cost change does NOT change Selling Price; margin display (if present) does not auto-change price.
- Sellable gating: Product without valid Recipe+costing dependency not sellable; missing Selling Price not sellable.
- HPP regression: historical snapshots unchanged after recipe versioning operations.

**Acceptance Gate**

- All Products rule enforced (no no-recipe Product); Recipe Base UOM + Standard Cost consumption proven.
- Recipe Versioning proven: new version on substantive change; historical preserved; single active version per effective time.
- Inactive dependency guards + hard-delete protections proven.
- Selling Price / Standard Cost independence proven.
- Order-bindable RecipeVersion identity ready for Phase 5.

**Exit Criteria**

- Acceptance Gate PASS with recorded evidence.
- Phase 5 can bind Orders to RecipeVersion; Phase 6 can compute HPP from version × Standard Cost.
- Versioning historical compatibility holds.

**Rollback/Fail-Closed Considerations**

- Version creation is append-only; rollback = active-version pointer restore, never historical overwrite.
- Sellability gate fails closed (no sellable Product without valid Recipe/Selling Price/costing dependency).
- No Finance-boundary mutation in this phase.

**Expected Classification Transitions**

- MISSING Recipe Versioning → KEEP.
- Product/Recipe hardening gaps → KEEP per contract rules.
- Direct-resale/no-recipe Product: contract-forbidden; none authorized (not a RETIRE_CANDIDATE — never existed as target).
- DORMANT remains DORMANT.

---

### Phase 5 — Order Domain Foundation  (HIGH GATE)

**Objective**

Introduce the target Order domain separately from current tabsal sale-line operational semantics: immutable OrderID, human-readable Order Number, Order Lines with Selling Price snapshot, HPP/cost snapshot preparation, RecipeVersion binding, DINE_IN/TAKE_AWAY, PaymentStatus = UNPAID, FulfillmentStatus = OPEN, CreatedAt, actor identity. Explicit non-destructive migration/compatibility strategy for existing tabsal/history.

**Why This Phase Occurs Here**

Payment (Phase 6) settles Orders; Fulfillment (Phase 7) transitions them; Reporting (Phase 9) reads PAID Orders. Order is the structural prerequisite. HIGH gate: cutover from sale-line semantics while preserving historical read compatibility.

**Entry Criteria**

- Phase 2 PASS (Standard Cost authority; snapshot preparation inputs defined).
- Phase 4 PASS (RecipeVersion identity Order-bindable; sellability gating).
- Business Contract §3–§4, §8, §20–§24, §29 reviewed.
- Migration/compatibility strategy for tabsal/history drafted as explicit non-destructive plan (no data rewrite).
- Decision Gate 2 (Order Number format) and Decision Gate 3 (physical schema strategy) identified; format/schema decisions recorded or explicitly in-flight — must satisfy §23 rules regardless.
- Minimal authorization infrastructure (if required earlier for safe Order writes) identified per Phase 8 note; complete role enforcement remains Phase 8.

**In Scope**

- Order model separate from tabsal sale-line semantics.
- Immutable OrderID, system-generated (§23.2).
- Human-readable Order Number: system-generated; NOT relational primary authority; MUST NOT be reused; MUST NOT encode unnecessary meaning (§23.3–23.7) — exact format per Decision Gate 2.
- Order Lines: multiple Product lines per Order (§3.13); Selling Price snapshot immutable at Order creation (§8.4); no manual price override (§8.3).
- HPP/cost snapshot preparation needed for Payment-time recognition: Order references RecipeVersion; HPP is computed/recognized at Payment time (Phase 6) — Phase 5 establishes the reference data, not Revenue.
- RecipeVersion binding: Order binds to Recipe version applicable at creation (§20.5); later Recipe changes MUST NOT reinterpret existing Orders (§20.6).
- Order Type: exactly one of DINE_IN / TAKE_AWAY per Order (§4.1); Order Type MUST NOT change Selling Price, Recipe, HPP, Payment, or Receive Via behavior (§4.2–4.4); MAY be a reporting dimension (§4.5).
- PaymentStatus = UNPAID initially (§3.1, §5.8).
- FulfillmentStatus = OPEN initially (§6.1).
- CreatedAt automatic, not editable (§24.1).
- Actor identity recorded where applicable (§25.7; enforcement in Phase 8).
- NO Customer entity; NO Customer Master (§3.8).
- NO Receive Via requirement at Order creation (§3.2).
- NO Revenue posting merely from Order creation (§3.5, §26.12 — UNPAID is not Revenue).
- NO stock movement on Order creation (§22).
- Explicit migration/compatibility strategy for existing tabsal/history: non-destructive; historical rows remain read-compatible; new Orders use Order domain; tabsal sale-line operational write path superseded for new writes without rewriting history.

**Explicitly Out of Scope**

- Payment execution, Receive Via, Revenue/HPP posting (Phase 6).
- Fulfillment transitions (Phase 7).
- Customer/promo/discount/cancel/void/refund workflows (contract out of scope; §3.8–3.12, §32).
- Partial/split Payment (contract out of scope).
- Dashboard/reporting cutover (Phases 9–10).
- Historical tabsal data rewrite or migration rerun of any Finance migration.
- Stock-on-hand; operational AP.
- Full OPERATOR/ADMIN enforcement acceptance (Phase 8; foundations may precede if required).

**Key Dependencies**

- Phase 2 (cost snapshot preparation inputs; Standard Cost authority).
- Phase 4 (RecipeVersion identity; sellability; Selling Price authority).
- Business Contract §3–§8, §20–§24, §29, §32.
- Frozen Finance Final Baseline: tabsal.HPP historical authority; historical Sales reads must keep working.
- Current source tabsal sale-line semantics as the superseded operational path.

**Finance Boundary**

- Order creation posts NOTHING. No Revenue; no HPP recognition; no Finance journal on Order creation (§3.5, §26.12).
- Selling Price snapshot is business data, not Finance authority.
- No PurchaseEvent interaction; no AP; no stock postings.
- Revenue/HPP recognition authority remains successful Payment (Phase 6; §5.9, §21.1).

**Historical Compatibility Boundary**

- tabsal historical rows remain readable; historical HPP/HJ snapshots immutable.
- Migration/compatibility strategy explicit and non-destructive: no rewrite of historical transaction facts (§28); existing transaction IDs/timestamps preserved.
- Historical Sales reporting continues to work from frozen authorities until Phase 9 cutover (with target reporting authority defined in Phase 9).
- DORMANT sale-line operational write paths superseded for new writes; dormant code NOT deleted (principle 14; Phase 14 for retirement evaluation).

**Implementation Risk**

HIGH — new domain model; cutover boundary between Order domain and tabsal history must not break historical reads or Finance snapshot authority.

**Operational Risk**

HIGH — Order architecture cutover (HIGH gate); incorrect RecipeVersion binding misstates future HPP; accidental Revenue posting on Order creation would violate §26.12; duplicate/ambiguous Order Number violates §23.5.

**Required Tests**

- Order creation: PaymentStatus = UNPAID; FulfillmentStatus = OPEN; CreatedAt automatic; actor identity captured.
- OrderID immutable; Order Number unique/non-reused; Number not used as relational authority; no Customer/Order Type encoding.
- Selling Price snapshot immutable at creation; no price override path.
- Multiple Product lines; Product must be sellable (Phase 4 gating).
- RecipeVersion bound at Order creation; later Recipe change does not reinterpret existing Order (regression).
- DINE_IN/TAKE_AWAY exactly one; Order Type does not alter price/recipe/HPP/payment behavior.
- Order creation: no Revenue posting; no HPP posting; no stock movement; no Receive Via required (assert Finance journals/stock artifacts absent).
- No Customer dependency in Order model (contract test).
- Historical tabsal read compatibility: legacy rows readable; historical HPP unchanged after Order-domain operations.
- Migration invocation counters remain 0; no historical row mutation.
- Compatibility: new write path cannot emit superseded sale-line operational semantics for new Orders (superseded path closed for new writes).

**Acceptance Gate**

- HIGH gate: Order domain tests PASS with recorded evidence.
- Non-destructive compatibility strategy proven: historical tabsal reads intact; no historical rewrite; no migration rerun.
- UNPAID/OPEN initial states; snapshot/reference model ready for Payment-time HPP (Phase 6).
- No Revenue on Order creation proven; no stock/AP/Customer artifacts.

**Exit Criteria**

- Acceptance Gate PASS with recorded evidence.
- Phase 6 can settle one full-amount Payment per Order; Phase 7 can transition FulfillmentStatus; Phase 9 can define PAID-only reporting on the Order domain.
- Historical read compatibility holds.

**Rollback/Fail-Closed Considerations**

- HIGH gate. Order write path fails closed on missing Selling Price, invalid RecipeVersion, non-sellable Product, invalid Order Type.
- Rollback boundary: new Order writes revert to prior operational path only under explicit decision; historical data never rewritten; Finance migrations never rerun.
- No Finance posting to roll back (none made).
- If compatibility evidence fails, STOP Phase 5 cutover for new writes; keep historical reads on frozen authorities.

**Expected Classification Transitions**

- MISSING Order model → KEEP.
- MISSING DINE_IN/TAKE_AWAY → KEEP.
- CHANGE tabsal sale-line operational semantics → superseded for new writes (historical read KEEP); operational write path target = Order domain.
- Revenue-on-sale (all-sales-as-revenue) remains CHANGE until Phase 9; Order creation must not post Revenue.

---

### Phase 6 — Payment / Finance Settlement  (CRITICAL GATE)

**Objective**

Establish Payment as the sole Revenue/HPP recognition authority: one successful Payment per Order, full Order Total only, authoritative Receive Via dropdown with business-friendly labels mapped to Finance account authority, immutable PaymentID/PaidAt/PaidBy, idempotent atomic settlement, UNPAID → PAID, Revenue + HPP recognition exactly at successful Payment, SALE_SETTLEMENT Finance integration, immutable HPP snapshot. No refund/void/reversal in scope; no duplicate Finance posting on retry.

**Why This Phase Occurs Here**

Order (Phase 5) provides settleable Orders. Settlement is the critical financial mutation boundary; it depends on Order, RecipeVersion, Approved Standard Cost, Receive Via authority, and frozen Finance SALE_SETTLEMENT semantics.

**Entry Criteria**

- Phase 5 Acceptance Gate PASS (Order domain; UNPAID initial state; RecipeVersion binding; snapshot prep).
- Phase 1 PASS (Supplier-adjacent master patterns; Receive Via/account authority identified in Finance configuration).
- Phase 2 PASS (Approved Standard Cost; HPP computation inputs).
- Business Contract §5, §7, §21, §24, §26, §29, §30 reviewed.
- Frozen Finance Final Baseline SALE_SETTLEMENT semantics confirmed for integration target.
- CRITICAL human gate process identified; stronger acceptance gates defined below.
- Idempotency mechanism plan recorded (RequestKey-equivalent for Payment; §29 implementation decision).

**In Scope**

- One successful Payment per Order (§5.1, §29.1); retries MUST NOT duplicate Payment (§29.2).
- Payment settles 100% of Order Total only; NO partial Payment; NO split Payment (§5.2, §5.13, §3.10–3.11).
- Payment Amount derives from Order Total (§5.3).
- Receive Via mandatory at Payment (§5.4); comes from authoritative configuration/database (§5.5; OPERATOR may not change Receive Via/account mapping per §25.4).
- Operator-facing Receive Via values use business-friendly labels (e.g. Cash, BCA, QRIS; §5.6); backend MUST map Receive Via to Finance account authority (§5.7).
- Immutable PaymentID; PaidAt automatic (§24.5); PaidBy actor identity (§25.7).
- Idempotent Payment; atomic/fail-closed settlement (§29.6).
- UNPAID → PAID transition on successful Payment (§5.8).
- Revenue + HPP recognition exactly at successful Payment (§5.9, §21.1): Revenue = PAID Orders; HPP = immutable Payment-time snapshot using the Order's bound RecipeVersion (§21.2).
- SALE_SETTLEMENT Finance integration per frozen Policy C semantics.
- Immutable HPP snapshot: historical HPP MUST NOT be recalculated/rewritten by later Selling Price, Standard Cost, Recipe, UOM conversion, or Purchase history changes (§21.3).
- No refund/void/reversal workflow in current scope (§5.12, §3.9).
- No duplicate Finance posting on retry (§29.3).
- Successful Payment normally cannot be edited into another amount/method (§5.11).
- CLOSED derived as PAID AND COMPLETED (§7) — derivation established here or in Phase 7 consumption; recognition authority stays Payment.

**Explicitly Out of Scope**

- Partial/split Payment; refunds; voids; reversal; cancellation; abandonment (contract out of scope).
- Fulfillment transitions (Phase 7); CLOSED operational milestone remains Phase 7 concern (recognition stays Payment).
- Dashboard/reporting presentation (Phases 9–10).
- Refund accounting design (out of scope; do not invent).
- Purchase-side Paid Via changes (Phase 3 domain).
- Retirement of legacy settlement code (Phase 14).
- Historical Finance baseline modification; migration rerun.

**Key Dependencies**

- Phase 5 (Orders; RecipeVersion binding; UNPAID state).
- Phase 2/4 (Approved Standard Cost; Recipe version costing; snapshot inputs).
- Phase 1 (Receive Via/account mapping authority pattern; operator-visibility rules).
- Business Contract §5, §7, §21, §24–§26, §29–§30.
- Frozen Finance Final Baseline: SALE_SETTLEMENT at successful Payment; Policy C HPP semantics; cash/bank authority.

**Finance Boundary**

- CRITICAL. Successful Payment is THE Revenue/HPP recognition authority (§2.7, §5.9, §21.1, §26.1). CLOSED is operational/derived and is NOT recognition authority (§7.3).
- SALE_SETTLEMENT occurs at successful Payment (§30.3); operational implementation adapts to Finance; Finance is not redefined (§30.2).
- Receive Via maps to Finance account authority; operator labels are presentation only (§5.6–5.7).
- HPP snapshot immutable; Policy C HPP semantics frozen (§30.7).
- No PurchaseEvent changes; no AP writes; no migration rerun (§30.8).
- PAID but not COMPLETED Order IS Revenue/HPP (§7.4, §26.13); recognition does not wait for Fulfillment.

**Historical Compatibility Boundary**

- Historical Sales HPP/HJ snapshots remain immutable (§21.3, §28).
- Historical Finance authorities unchanged; new settlement writes append to Finance consistent with frozen semantics.
- No historical Revenue rewrite; reporting authority change happens in Phase 9 on top of correct recognition, not by rewriting history.
- Compatible existing IDs/timestamps preserved.

**Implementation Risk**

HIGH — settlement touches Finance posting path; HPP computation must use bound RecipeVersion × Approved Standard Cost; Receive Via mapping errors misstate cash/bank.

**Operational Risk**

CRITICAL — financial mutation boundary; duplicate posting, wrong amount, wrong account mapping, or HPP rewrite would corrupt Finance truth; retry storms must stay idempotent.

**Required Tests (CRITICAL — stronger gates)**

- One successful Payment per Order; second Payment attempt rejected/blocked; retry of same Payment idempotent (ALREADY_APPLIED-equivalent); no duplicate Finance posting.
- Payment Amount = Order Total exactly; partial/split amounts rejected.
- Receive Via mandatory; authoritative dropdown only; business-friendly labels displayed; backend maps to correct Finance account authority; invalid/unknown Receive Via rejected (fail closed).
- UNPAID → PAID transition recorded; PaidAt automatic; PaidBy captured; PaymentID immutable.
- Revenue recognized exactly at successful Payment; UNPAID Order contributes zero Revenue (regression); PAID-not-COMPLETED Order IS Revenue/HPP (contract test).
- HPP snapshot immutable: recorded HPP unchanged after later Selling Price, Standard Cost, Recipe, UOM conversion, and Purchase history changes (multi-change regression).
- HPP snapshot uses Order-bound RecipeVersion and Approved Standard Cost at recognition time.
- SALE_SETTLEMENT Finance integration consistent with frozen Policy C semantics (journal/account resolution tests against baseline contract).
- Atomic/fail-closed settlement: failure mid-settlement leaves no partial Payment/Revenue/HPP/journal state (or explicit recovery identity per Finance idempotency contract).
- No refund/void/reversal path present in current scope.
- No Customer, promo, discount dependencies in settlement.
- Migration counters remain 0; PurchaseEvent untouched; no AP write from Payment settlement.
- Retry/idempotency suite: duplicate request keys, concurrent retries, first-event timestamp preservation (§29.4).

**Acceptance Gate**

- CRITICAL gate with stronger acceptance: full required-test suite PASS; measured evidence recorded (not estimated).
- Payment is proven sole Revenue/HPP recognition authority; CLOSED not used as recognition gate.
- Idempotency, fail-closed atomicity, immutable snapshots, and Finance SALE_SETTLEMENT alignment all proven.
- Explicit human sign-off required before any production exposure of this write path (execution itself happens in authorized implementation tasks, not this roadmap).
- Zero unauthorized migrations; dormant AP/inventory untouched.

**Exit Criteria**

- Acceptance Gate PASS with recorded MEASURED evidence.
- Phase 7 can transition Fulfillment independently of Payment timing.
- Phase 9 can define reporting from PAID Orders + Payment-time HPP snapshots.
- CLOSED derivation (PAID + COMPLETED) established without moving recognition authority.

**Rollback/Fail-Closed Considerations**

- CRITICAL. Settlement fails closed: invalid Receive Via, non-UNPAID state, duplicate Payment, amount mismatch → no write, no journal.
- Rollback boundary: never roll back by mutating historical Finance journals; recovery via Finance idempotency/reversal identity rules already in frozen baseline where supported; unsupported operations stay explicitly unsupported (no invented reversal workflow — out of scope).
- If settlement evidence fails, STOP: do not expose Payment writes; do not compensate by changing Finance (§30.2).
- PurchaseEvent migration remains untouched in all rollback paths (§34.15).

**Expected Classification Transitions**

- MISSING Payment entity → KEEP.
- Revenue/HPP recognition authority: CHANGE (sale-line/all-sales as revenue) → KEEP (Payment-time authority) — completed at Phase 9 consumption; recognition mechanics established here.
- DORMANT remains DORMANT; no new operational AP introduced.

---

### Phase 7 — Fulfillment

**Objective**

Establish Order-level Fulfillment lifecycle OPEN → PREPARING → READY → COMPLETED with forward-only normal transitions, first-transition timestamp preservation, idempotent retry, no inventory stock posting/validation, derived CLOSED = PAID AND COMPLETED. Fulfillment remains independent from Payment timing.

**Why This Phase Occurs Here**

Order (Phase 5) provides the lifecycle host; Payment (Phase 6) provides PAID state for CLOSED derivation. Fulfillment must not couple to Payment timing (§3.3, §6, §7).

**Entry Criteria**

- Phase 5 PASS (Order domain; FulfillmentStatus = OPEN initial).
- Phase 6 PASS or equivalent recognition boundary established (CLOSED derivation consumes PAID; recognition stays Payment).
- Business Contract §3, §6, §7, §24, §29, §22 reviewed.

**In Scope**

- Lifecycle: OPEN → PREPARING → READY → COMPLETED (§6.1).
- Order-level lifecycle, not Order-Line-level (§6.5, §3.14).
- Forward-only normal transitions (§6.2).
- PreparingAt, ReadyAt, CompletedAt record FIRST transition into respective status (§6.3); retry MUST NOT replace a first-event timestamp (§6.4, §24.7).
- Idempotent retry (§29.4).
- NO inventory stock posting on COMPLETED (§6.6); no stock validation; no negative-stock guard (§22).
- Derived CLOSED: PAID AND COMPLETED (§7.1); derived, not manually operated (§7.2); operational milestone only — NOT Revenue/HPP recognition authority (§7.3).
- Fulfillment independent from Payment timing: Payment may occur before, during, or after preparation/completion (§3.3); PAID-not-COMPLETED is still Revenue/HPP (§7.4).
- Actor identity for transitions where applicable (§25.7; enforcement Phase 8).

**Explicitly Out of Scope**

- Payment execution (Phase 6).
- Stock-on-hand, stock availability, negative-stock policy, inventory OUT posting (contract forbids; §22.2).
- Line-level fulfillment; cancel/void/refund/abandonment workflows (out of scope).
- Dashboard/UX polish beyond transition validation feedback (Phase 11).
- Retirement of any legacy fulfillment-adjacent code (Phase 14).
- New business requirements (no expedite/priority rules unless contract says so — it does not).

**Key Dependencies**

- Phase 5 (Order; FulfillmentStatus field; timestamps).
- Phase 6 (PAID state for CLOSED derivation).
- Business Contract §3, §6–§7, §22, §24, §29.

**Finance Boundary**

- Fulfillment posts NOTHING to Finance. COMPLETED does not post stock consumption (§6.6) and does not post Revenue/HPP (recognition = Payment; §7.3).
- No PurchaseEvent interaction; no AP; no Expense implication.
- CLOSED is operational only (§7.3, §26.14).

**Historical Compatibility Boundary**

- Historical Orders (once domain exists) keep their timestamp facts immutable through normal workflow (§24.6).
- Historical tabsal/sales rows unaffected; no rewrite.
- First-event timestamps preserved under retry (§29.4).

**Implementation Risk**

MEDIUM — lifecycle state machine; timestamp/idempotency edge cases; CLOSED derivation correctness.

**Operational Risk**

MEDIUM — backward transition bugs or timestamp overwrite corrupt operational truth; accidental stock posting would violate §22 (must be structurally impossible, not just untested).

**Required Tests**

- Lifecycle transitions OPEN → PREPARING → READY → COMPLETED succeed in order.
- Invalid/backward transitions rejected in normal workflow (§6.2).
- First-transition timestamps: PreparingAt/ReadyAt/CompletedAt set once; retry does not replace them (§6.4, §29.4).
- Idempotent retry of transition produces no duplicate effect/timestamp overwrite.
- Order-level only: line-level transition API absent/impossible.
- COMPLETED posts no inventory stock; no stock validation; no negative-stock guard present (structural absence tests).
- CLOSED derived iff PAID AND COMPLETED; not manually settable; PAID-not-COMPLETED not CLOSED; COMPLETED-not-PAID not CLOSED.
- Recognition independence: PAID-not-COMPLETED contributes Revenue/HPP (regression with Phase 6 suite); fulfillment completion changes no Finance journals.
- Payment timing independence: early-payment and late-payment order paths both complete lifecycle correctly (preparatory cases for Phase 12).

**Acceptance Gate**

- Lifecycle + timestamp + idempotency tests PASS with recorded evidence.
- CLOSED derivation proven as derived/operational-only; recognition authority remains Payment.
- Structural absence of stock posting/validation proven.
- No Finance writes from Fulfillment proven.

**Exit Criteria**

- Acceptance Gate PASS with recorded evidence.
- Phase 9 reporting can use CLOSED as operational dimension only; Phase 12 can run both payment/fulfillment orderings.

**Rollback/Fail-Closed Considerations**

- State machine fails closed on invalid transitions; timestamps immutable.
- Rollback = lifecycle rule revert; no historical timestamp rewrite; no Finance rollback needed (no postings).
- Stock posting must be structurally impossible (no dormant inventory activation — §22.6, §30.9).

**Expected Classification Transitions**

- MISSING Fulfillment lifecycle → KEEP.
- CLOSED derivation: MISSING/operational gap → KEEP (derived PAID+COMPLETED).
- DORMANT remains DORMANT; no InventoryReceipt/InventoryLedger activation.

---

### Phase 8 — Role / Permission Enforcement

**Objective**

Establish ADMIN and OPERATOR roles with contract-mandated authority boundaries. ADMIN: master/config + operations. OPERATOR: Order, DINE_IN/TAKE_AWAY, Product/Qty, Fulfillment, Payment/Receive Via, Purchase. OPERATOR MUST NOT mutate Master Data, Recipe, Selling Price, Standard Cost, UOM/Conversion, Receive Via/account mapping. No transaction approval workflow.

**Why This Phase Occurs Here**

Operational write domains (Phases 3, 5–7) create authority-bearing mutations. Role enforcement completes the safety boundary around those mutations. If source architecture requires minimal authorization infrastructure earlier for safe implementation, foundational authorization MAY be introduced earlier — but complete role-enforcement acceptance remains here.

**Entry Criteria**

- Phases 3, 5, 6 write surfaces exist or are in-flight with known mutation points (mutating endpoints enumerated).
- Business Contract §25 reviewed.
- Decision Gate 4 (authentication/identity mechanism) decided or explicitly in-flight; mechanism must preserve actor audit identity (§25.7).
- Foundational authorization infrastructure (if pulled earlier) documented and distinguishable from full enforcement acceptance.

**In Scope**

- ADMIN role: full authority including master/configuration and operations (§25.2).
- OPERATOR role MAY: create Order; choose DINE_IN/TAKE_AWAY; add Product + Qty; move valid Fulfillment lifecycle; execute Payment; choose Receive Via; create Purchase (§25.3).
- OPERATOR MUST NOT change: Master Data; Recipe; Selling Price; Standard Cost; UOM/Conversion; Receive Via/account mapping (§25.4).
- Enforce at mutation boundary (backend authority checks), not only UI hiding.
- Actor audit identity preserved where applicable (§25.7).
- NO transaction approval workflow (§25.5); valid transaction applies when saved (§25.6).
- Roles limited to ADMIN and OPERATOR (§25.1) — no invented extra roles.
- UX feedback for permission-denied states conforms to form UX contract patterns (specific messages; Phase 11 verifies consistency).

**Explicitly Out of Scope**

- Invented approval workflows, multi-level authorization, customer-facing roles (out of scope; §25.5, §32).
- Master-data content changes (Phase 1); Standard Cost/Recipe/Pricing content rules (Phases 2, 4).
- Dashboard/role-based dashboard features beyond mutation authority (Phases 9–10).
- Migration of historical actor fields (no historical rewrite).
- Retirement of legacy permission-adjacent code (Phase 14).
- New business requirements.

**Key Dependencies**

- Phases 1, 3, 5–7 mutation surfaces (enumerated endpoints).
- Business Contract §25, §27 (UX), §29 (audit identity).
- Decision Gate 4 identity mechanism.

**Finance Boundary**

- Role checks gate Finance-touching mutations (Payment settlement, Purchase PAID writes) but do not change Finance semantics; Finance authority remains frozen.
- OPERATOR may execute Payment/Purchase (operations) — authority ≠ new Finance rules.
- No Finance journal implications from role checks themselves.

**Historical Compatibility Boundary**

- Historical actor/audit fields preserved; no backfill invention.
- Historical transactions remain valid regardless of current role assignments.

**Implementation Risk**

MEDIUM — permission checks must cover every mutating endpoint; missed endpoint = authority bypass.

**Operational Risk**

MEDIUM — bypass risk on unlisted write paths; false-deny risk blocking valid OPERATOR flows; approval-workflow creep would violate §25.5.

**Required Tests**

- ADMIN: master/config mutations allowed (Supplier/Item/UOM/Recipe/Selling Price/Standard Cost/Receive Via mapping where applicable).
- OPERATOR: allowed operations succeed (Order create, DINE_IN/TAKE_AWAY, Product+Qty, Fulfillment transitions, Payment with Receive Via, Purchase create).
- OPERATOR denied on: Master Data mutation; Recipe mutation; Selling Price mutation; Standard Cost mutation; UOM/Conversion mutation; Receive Via/account mapping mutation — each denied at backend boundary with explicit error.
- No transaction approval workflow artifacts present; valid transaction applies on save for authorized roles.
- Actor audit identity captured on mutating operations.
- Role limit: no third role creatable through operational paths.
- Permission-denied UX states conform to specific-validation contract (Phase 11 will re-verify globally).
- Regression: previously passing Financial/business tests unchanged when run under each role.

**Acceptance Gate**

- All denial/allowance tests PASS with recorded evidence at backend mutation boundary.
- OPERATOR forbidden-mutation matrix fully covered (every §25.4 item).
- No approval workflow introduced.
- Actor identity proven; audit trail usable.

**Exit Criteria**

- Acceptance Gate PASS with recorded evidence.
- Phase 12 role-matrix end-to-end acceptance executable.
- Phase 13 rollout includes role enforcement in preflight.

**Rollback/Fail-Closed Considerations**

- Authorization fails closed at mutation boundary: unknown role/denied → no write.
- Rollback = permission-rule revert; no historical data impact.
- Fail-closed preference over fail-open when identity mechanism unavailable for an operation (aligns with financial mutation safety).

**Expected Classification Transitions**

- MISSING ADMIN/OPERATOR roles → KEEP.
- Foundational authorization (if earlier) → distinct from complete enforcement; enforcement KEEP only after this phase.

---

### Phase 9 — Reporting Alignment  (HIGH GATE)

**Objective**

Align reporting authorities to the canonical contract: Revenue = PAID Orders; Qty Sold = PAID Order Lines; HPP = immutable Payment-time snapshots; Gross Profit = Revenue − HPP; dimensions DINE_IN/TAKE_AWAY, Receive Via, Product; Purchase reporting by Purchase Date with Supplier/Ingredient/UOM/Paid Via dimensions; PAID Expense reporting; PAID-not-COMPLETED is Revenue/HPP; UNPAID is not Revenue; CLOSED operational only; historical snapshot authority; read-only reporting; no stock-on-hand/value/waste/variance metrics; theoretical Recipe usage labelled theoretical.

**Why This Phase Occurs Here**

Order/Payment/Fulfillment (Phases 5–7) produce the authoritative transaction facts; Role enforcement (Phase 8) bounds write authority. Reporting must consume the new authorities before Dashboard (Phase 10) or UX polish (Phase 11). HIGH gate: reporting authority cutover.

**Entry Criteria**

- Phase 6 PASS (Payment = recognition authority; Payment-time HPP snapshots exist).
- Phase 7 PASS (CLOSED derivation; fulfillment dimensions/timestamps).
- Phase 5 PASS (Order Type; Order Lines; RecipeVersion).
- Phase 3 PASS (Purchase Date authority; Supplier/Item/UOM/Paid Via dimensions; actual normalized cost).
- Phase 2 PASS (Standard Cost / actual cost distinction for analysis labels).
- Business Contract §26, §7, §22, §28 reviewed.
- Historical snapshot authorities from Frozen Finance Final Baseline confirmed (tabsal/tabops frozen; regime by economic date).

**In Scope**

- Revenue = PAID Orders (§26.1); UNPAID is NOT Revenue (§26.12); PAID but not COMPLETED IS Revenue/HPP (§26.13).
- Qty Sold = Product Qty on PAID Orders (§26.2).
- HPP = immutable Payment-time HPP snapshot (§26.3, §21.4).
- Gross Profit = Revenue − HPP (§26.4).
- Reporting dimensions allowed: DINE_IN/TAKE_AWAY; Receive Via; Product (§26.5).
- Purchase reporting uses Purchase Date (§26.6, §10.12); MAY break down Supplier/Ingredient/UOM/Paid Via (§26.7).
- Standard Cost changes MUST NOT rewrite Purchase history (§26.8, §17.7).
- Expense reporting uses PAID Expense (§26.9; ordinary Expense always PAID — §9).
- CLOSED is operational only; NOT Revenue-recognition authority (§26.14, §7.3).
- Reports use historical transaction snapshots (§26.15).
- Reporting/dashboard read-only to source transactions (§26.16).
- NO stock-on-hand, stock-value, waste, variance reporting (§26.10, §22.7).
- Recipe usage MAY be theoretical only; MUST NOT be labelled actual consumption (§26.11, §22.5).
- Historical snapshot authority: historical Finance authorities remain readable; cutover defines target reporting computation without rewriting history.
- Historical read compatibility: legacy rows/non-postable history handled explicitly per frozen baseline classification; no invented numbers (null/unavailable semantics preserved where Finance baseline defines them).

**Explicitly Out of Scope**

- Dashboard visual redesign/analytic invention (Phase 10 consumes this model).
- Cross-application UX conformance sweep (Phase 11).
- New business metrics beyond contract dimensions (no customer analytics, no promo, no stock).
- Historical backfill/rewrite of reporting outputs.
- Finance statement authority changes (P&L/Balance/Cash Flow remain governed by frozen Finance baseline; this phase aligns operational reporting authorities).
- Retirement of legacy report code (Phase 14).
- Invented KPI targets/requirements.

**Key Dependencies**

- Phases 3, 5, 6, 7 (authoritative facts).
- Business Contract §7, §21, §22, §26.
- Frozen Finance Final Baseline: Policy C statement semantics (null not zero); historical snapshot regime selection; P&L/finance authority matrix.

**Finance Boundary**

- Reporting consumes Finance-compatible facts; does not redefine Finance (§30.2).
- HPP snapshots immutable; Gross Profit = Revenue − HPP from Payment-time snapshots.
- Policy C statement semantics preserved: unavailable values displayed as unavailable, never coerced to accounting zero (frozen baseline UI obligation).
- No stock-on-hand/value/waste/variance reporting (§26.10).
- Reporting is read-only (§26.16).

**Historical Compatibility Boundary**

- Historical snapshots remain authoritative for historical rows (§26.15).
- Historical UNPAID/non-postable legacy rows classified per frozen baseline; not reinterpreted into Revenue.
- No historical transaction rewrite to make reports "cleaner".
- tabsal.HPP historical authority preserved where frozen baseline keeps it.

**Implementation Risk**

HIGH — cutover changes the numbers users see; dimension derivation must not invent rules; legacy-vs-target period boundaries must be explicit.

**Operational Risk**

HIGH — misleading Revenue/HPP if cutover incomplete; false stock metrics reintroduction risk; CLOSED misused as recognition gate.

**Required Tests**

- Revenue counts only PAID Orders; UNPAID excluded; PAID-not-COMPLETED included (contract matrix test).
- Qty Sold = PAID Order Line quantities only.
- HPP source = Payment-time snapshots; Gross Profit = Revenue − HPP math test.
- Dimensions: DINE_IN/TAKE_AWAY, Receive Via, Product breakdowns correct on PAID data.
- Purchase reports keyed by Purchase Date; Supplier/Ingredient/UOM/Paid Via breakdowns available; actual normalized cost reported as history, not costing authority.
- Expense reports = PAID Expense only.
- CLOSED used only as operational dimension; reports do not gate Revenue on CLOSED.
- No stock-on-hand/value/waste/variance outputs; structural absence assertions.
- Theoretical Recipe usage labelled theoretical; never "actual consumption".
- Read-only enforcement: reporting path performs no source writes.
- Historical snapshot regression: legacy period outputs consistent with frozen baseline authorities; Policy C null semantics preserved (unavailable ≠ zero).
- Standard Cost change does not rewrite Purchase history/report outputs (regression).

**Acceptance Gate**

- HIGH gate: full reporting authority matrix PASS with recorded MEASURED evidence.
- PAID-only Revenue authority proven end-to-end from Order/Payment facts.
- Dimension coverage proven; forbidden metrics absent.
- Historical snapshot compatibility proven; Finance boundary preserved.
- Reporting read-only proven.

**Exit Criteria**

- Acceptance Gate PASS with recorded evidence.
- Phase 10 dashboard consumes this reporting model without inventing alternative rules.
- Phase 11 UX verification can assert reporting labels match authorities.

**Rollback/Fail-Closed Considerations**

- HIGH gate. Reporting computations fail closed/return unavailable where source facts missing or non-postable — never fabricate zeros for financial metrics (Policy C obligation).
- Rollback = report-computation switch back to prior read path; historical data untouched; no Finance mutation.
- If cutover evidence fails, keep target reporting behind explicit gate; do not present mixed authorities silently.

**Expected Classification Transitions**

- CHANGE all-sales-as-revenue → KEEP (PAID-only Revenue authority).
- MISSING PAID-based reporting dimensions → KEEP.
- DORMANT stock/inventory reporting concepts remain absent/DORMANT; not reintroduced.
- Historical snapshot authority remains KEEP.

---

### Phase 10 — Dashboard / Analytics Alignment

**Objective**

Align dashboard and analytics consumption to the authoritative reporting model from Phase 9. Remove or avoid misleading metrics based on superseded sales or inventory semantics. Dashboard consumes authoritative reporting model; it MUST NOT invent alternative business rules.

**Why This Phase Occurs Here**

Dashboard currently consumes legacy sales/inventory-adjacent analytics shapes. Only after reporting authorities are correct (Phase 9 gate) can dashboard cutover be safe and non-misleading.

**Entry Criteria**

- Phase 9 Acceptance Gate PASS (authoritative reporting model available).
- Current dashboard response contracts inventoried (existing consumer inventory docs are context).
- Business Contract §26, §27 reviewed; frozen Finance UI null-semantics obligation understood.

**In Scope**

- Dashboard/analytics consume Phase 9 authoritative reporting outputs.
- Remove/avoid misleading metrics based on superseded sales semantics (all-sales-as-revenue) or inventory semantics (stock-on-hand/value/waste/variance).
- Preserve truthful unavailability presentation (Policy C null semantics; unavailable ≠ zero).
- Theoretical usage labelled theoretical wherever shown.
- Dimensions shown only from contract-allowed set (DINE_IN/TAKE_AWAY, Receive Via, Product) plus Purchase/Expense dimensions already defined (Purchase Date, Supplier, Ingredient, UOM, Paid Via; PAID Expense).
- Dashboard remains read-only to source transactions (§26.16).
- No invented KPI business rules; existing dashboard presentation contracts (accessibility, states, charts) preserved unless they conflict with contract authorities — conflicts resolved in favor of the contract.

**Explicitly Out of Scope**

- New dashboard features beyond alignment (targets, projection, drill-down expansion remain requirement-gated backlog items).
- Backend reporting computation changes (Phase 9 owns authorities).
- Form UX global sweep (Phase 11).
- Historical dashboard output rewrite/claims.
- Stock/inventory dashboards (out of scope entirely).
- Retirement of dashboard legacy code (Phase 14).

**Key Dependencies**

- Phase 9 reporting model.
- Business Contract §26, §27, §30 (Finance null semantics).
- Existing dashboard/frontend architecture as compatibility context.

**Finance Boundary**

- Dashboard presents Finance-compatible reporting facts only; no new postings; no Finance rule invention.
- Policy C unavailable-value semantics preserved in UI.

**Historical Compatibility Boundary**

- Historical periods still display from historical snapshot authorities; no backfill fabrication.
- Prior dashboard evidence remains historical; new acceptance does not rewrite old evidence records.

**Implementation Risk**

LOW–MEDIUM — presentation-layer alignment; risk is stale metric paths remaining visible.

**Operational Risk**

MEDIUM — misleading dashboard metrics are an operational hazard; alignment must remove superseded semantics, not merely relabel them.

**Required Tests**

- Dashboard revenue/HPP/gross-profit figures match Phase 9 reporting model for identical periods (parity test).
- No dashboard outputs for stock-on-hand/value/waste/variance; no all-sales-as-revenue leakage.
- UNPAID-not-Revenue and PAID-not-COMPLETED-is-Revenue/HPP visible semantics correct.
- Purchase dashboard dimensions keyed correctly (Purchase Date etc.).
- Unavailable/null values shown as unavailable, not zero (Policy C UI obligation regression).
- Theoretical usage labelled theoretical.
- Read-only: dashboard requests perform no source writes.
- Existing presentation contracts (states, accessibility budgets) preserved or consciously updated with recorded deltas.

**Acceptance Gate**

- Dashboard parity with Phase 9 authorities proven by tests.
- Misleading superseded metrics absent.
- Null-semantics obligation preserved.
- No invented business rules.

**Exit Criteria**

- Acceptance Gate PASS with recorded evidence.
- Phase 11 UX sweep can verify dashboard labels against authorities.

**Rollback/Fail-Closed Considerations**

- Dashboard fails closed to explicit unavailable/empty states rather than mixed stale metrics when authoritative source missing.
- Rollback = consume prior response shape behind explicit gate; no data mutation.

**Expected Classification Transitions**

- Dashboard consumers: CHANGE (misleading/legacy metrics) → KEEP (authoritative alignment).
- No new classification of DORMANT/MISSING business domains; presentation only.

---

### Phase 11 — Global Form UX Conformance

**Objective**

Cross-domain acceptance for the canonical Global Form UX Contract. Every applicable form: visible label; meaningful placeholder/helper guidance; dropdown prompt; specific validation feedback. Earlier phases already implement UX correctly for touched forms; this phase verifies consistency across the application.

**Why This Phase Occurs Here**

Phases 1–8 implement UX correctly per touched form; Phase 9–10 settle reporting labels. Phase 11 is the consistency verification layer — not the first place UX is implemented.

**Entry Criteria**

- Phases 1–8 touched forms implemented per §27 patterns.
- Phase 9 reporting labels available for reporting surfaces.
- Business Contract §27 reviewed as the acceptance contract.
- Inventory of applicable forms/surfaces enumerated (Purchase, Order, Payment, Fulfillment, Supplier/Item/UOM masters, Recipe, Selling Price, Standard Cost, Receive Via config, Expense, reporting surfaces).

**In Scope**

- Cross-domain conformance verification of §27 on every applicable form:
  1. Clear visible field label.
  2. Appropriate input guidance (placeholder and/or helper where appropriate).
  3. Specific validation feedback.
- Dropdown prompt examples conformance: `Pilih supplier`, `Pilih item`, `Pilih UOM`, `Pilih metode pembayaran` (equivalent prompts accepted where wording refined for clarity — §27.7).
- Placeholder/prompt MUST NOT replace visible label (§27.3).
- Validation specificity conformance: e.g. `Supplier wajib dipilih.`, `Qty harus lebih besar dari 0.`, `UOM tidak valid untuk item ini.`; avoid generic `Invalid input` when precise reason known (§27.4–27.6).
- UX consistency fixes for surfaces found non-conformant (bounded; no business-rule changes).
- Permission-denied and fail-closed error messages specific where known.

**Explicitly Out of Scope**

- Business-rule changes of any kind (labels only; contract semantics unchanged).
- New forms/features not in applicable-form inventory.
- Visual redesign beyond conformance (existing design system remains).
- Dashboard metric authority changes (Phase 9–10 own those).
- Historical data display rewrites.
- Retirement of old UX code (Phase 14).

**Key Dependencies**

- Phases 1–8 (forms exist with correct behavior).
- Phase 9–10 (reporting labels).
- Business Contract §27, §34.12.

**Finance Boundary**

- UX layer only; no Finance semantics change; error copy must not misstate financial authority (e.g. payment success must not imply recognition before Payment — label accuracy).

**Historical Compatibility Boundary**

- Historical data display unchanged in meaning; label changes are prospective presentation.

**Implementation Risk**

LOW — presentation conformance; bounded UX fixes.

**Operational Risk**

LOW — generic validation messages create operator error; conformance reduces input mistakes at financial boundaries (supports, does not replace, fail-closed backend validation).

**Required Tests**

- Form inventory: every applicable form has visible label + guidance + specific validation coverage (contract test per form).
- Dropdown prompt tests for Supplier/Item/UOM/Payment method surfaces.
- Specific validation message tests (positive + negative cases per domain).
- No generic `Invalid input` where precise reason available.
- Placeholder-as-label violations absent.
- Cross-domain consistency: same field types use consistent prompt/validation patterns.
- Backend fail-closed validation still authoritative (UX messages do not replace validation tests from Phases 1–8).

**Acceptance Gate**

- Every applicable form conforms to §27 with recorded test evidence.
- Cross-domain consistency proven.
- No business-rule change smuggled in via UX tasks (diff review).

**Exit Criteria**

- Acceptance Gate PASS with recorded evidence.
- Phase 12 E2E workflows include UX conformance assertions.

**Rollback/Fail-Closed Considerations**

- UX-only changes; rollback = presentation revert.
- Backend validation remains fail-closed regardless of UX state (Phase 1–8 tests re-confirmed).

**Expected Classification Transitions**

- CHANGE form UX guidance/validation → KEEP (application-wide conformance).

---

### Phase 12 — End-to-End Operational Acceptance

**Objective**

Prove representative workflows end-to-end against the canonical contract: PURCHASE workflow; SALES workflow with both payment/fulfillment orderings; and explicit negative proofs (no Customer dependency; no promo/discount; no operational AP; no stock-on-hand; no Yield; historical read compatibility; retry/idempotency; roles; reporting consistency).

**Why This Phase Occurs Here**

Per-domain gates (Phases 1–11) prove local conformance; Phase 12 proves cross-domain integration and contract-wide negative proofs before any production consideration (Phase 13).

**Entry Criteria**

- Phases 1–11 Acceptance Gates PASS (or explicitly waived items recorded — none expected).
- Business Contract §1–§32 acceptance criteria compiled into workflow assertions.
- Test environments/harnesses available for local MEASURED evidence.
- No production mutation planned for this phase (local/runtime acceptance only; production exposure is Phase 13 with its own authorization).

**In Scope**

- PURCHASE workflow proof: Master Supplier/Item/UOM → Purchase → PAID → Finance-compatible cash/bank treatment → actual normalized Purchase cost → no stock ledger activation.
- SALES workflow proofs:
  1. Order → Payment → Preparing → Ready → Completed (early payment).
  2. Order → Preparing → Ready → Payment → Completed (late payment).
  - Revenue/HPP recognized exactly at Payment in both orderings; CLOSED only when PAID + COMPLETED.
- Negative proofs: no Customer dependency; no promo/discount; no operational AP; no stock-on-hand; no Yield/UsableQty authority in operational paths; historical read compatibility; retry/idempotency; roles matrix; reporting consistency (dashboard ≡ reporting model).
- Cross-phase integration evidence: master → purchase cost → recipe costing → order → payment HPP snapshot → fulfillment → reporting/dashboard chain.
- Measured evidence recording per AGENTS evidence classes (local/runtime; no deployment claims).

**Explicitly Out of Scope**

- Production deployment/promotion (Phase 13).
- New business features discovered during testing (route via contract change process if genuine requirement — do not invent).
- Historical data mutation to make tests pass.
- Migration reruns (NEVER).
- Retirement of dormant code (Phase 14).
- Browser/visual acceptance beyond what workflows require (separate evidence class if needed).

**Key Dependencies**

- All prior phase gates.
- Frozen Finance Final Baseline runtime validators as read-only Finance evidence tools.
- Test harness conventions in repository.

**Finance Boundary**

- E2E runs prove Finance-compatible treatment; Finance semantics unchanged by tests.
- Cash/bank treatment for PAID Purchase and SALE_SETTLEMENT for Payment proven consistent with frozen baseline.
- No Finance postings from test harnesses beyond controlled test fixtures; production writes zero.

**Historical Compatibility Boundary**

- Historical read compatibility proven in E2E (legacy rows readable; historical HPP/Sales/Purchase history intact after workflows run against test data).
- Production history untouched by acceptance runs.

**Implementation Risk**

MEDIUM–HIGH — integration bugs across domains; evidence discipline required.

**Operational Risk**

MEDIUM–HIGH — undetected cross-domain contract violations would reach production if Phase 13 proceeds without this gate; retry/idempotency failures are financially material.

**Required Tests (workflow-level, MEASURED)**

- PURCHASE workflow scenario PASS: masters → PAID Purchase → Finance-compatible cash/bank → normalized actual cost recorded → no InventoryReceipt/InventoryLedger write → no stock implication.
- SALES ordering A PASS: Order → Payment → Preparing → Ready → Completed; Revenue/HPP at Payment; timestamps correct; CLOSED at end.
- SALES ordering B PASS: Order → Preparing → Ready → Payment → Completed; Revenue/HPP at Payment (not at completion); CLOSED at end.
- Negative proofs: no Customer fields/flows; no promo/discount artifacts; no operational AP write paths reachable; no stock-on-hand outputs; no Yield inputs; Purchase UNPAID operational write absent.
- Historical read compatibility suite PASS on legacy fixtures.
- Retry/idempotency suite PASS (Payment duplicate retry; fulfillment timestamp preservation; Purchase retry ALREADY_APPLIED-equivalent).
- Roles matrix PASS (Phase 8 suite re-run E2E).
- Reporting/dashboard consistency PASS (Phase 9/10 parity re-run).
- Migration invocation counters = 0 throughout.

**Acceptance Gate**

- All workflow scenarios and negative proofs PASS with MEASURED evidence (actual execution after final source modification; not estimated).
- Finance-boundary evidence class recorded separately from local test evidence.
- Zero unauthorized migrations; zero production writes.
- Explicit checklist mapped to Business Contract §1–§32 acceptance items.

**Exit Criteria**

- Acceptance Gate PASS with MEASURED evidence.
- Phase 13 preflight inputs available (known runtime behavior, rollback boundary, activation list).
- Residual risks documented for Phase 13 human gate.

**Rollback/Fail-Closed Considerations**

- E2E failures block Phase 13; no partial rollout compensation.
- Test-only environments; no production rollback needed (no production mutation performed).
- Fail-closed behaviors observed in E2E must match contract expectations exactly.

**Expected Classification Transitions**

- No domain reclassification (prior phases' KEEP targets proven integrated).
- Residual implementation gaps found → recorded as gaps; repaired via bounded follow-up phases before Phase 13; contract unchanged.

---

### Phase 13 — Production Rollout / Acceptance  (CRITICAL GATE)

**Objective**

Define and execute (under separate explicit authorization) production-safe rollout after prior gates pass: deployment preflight; source/runtime parity; production-safe activation boundaries; first-real-event observation; rollback boundary; zero unauthorized migrations; PurchaseEvent migration untouched; no dormant inventory/AP activation; post-deployment acceptance.

**Why This Phase Occurs Here**

Only after local/runtime acceptance (Phase 12) can production exposure be considered. This roadmap AUTHORING task does not perform rollout. Rollout execution requires separate explicit human authorization at this CRITICAL gate.

**Entry Criteria**

- Phase 12 Acceptance Gate PASS with MEASURED evidence.
- All prior phase gates PASS; critical/high gates signed off (Phases 2, 3, 5, 6, 9, 13).
- Deployment preflight plan authored: upload manifest verification, required runtime/test inventory, exclusions (per repository upload manifest gate rules).
- Source/runtime parity plan: local verified source ↔ Apps Script runtime identity.
- Production-safe activation boundaries enumerated: which writes become active; which dormant capabilities remain dormant (AP, InventoryReceipt/InventoryLedger, Goods Receipt, UsableQty path, Purchase UNPAID operational path).
- Rollback boundary defined: previous immutable deployment version identified; rollback drill plan (or explicit decision record if drill not required).
- Zero unauthorized migrations confirmed: PurchaseEvent migration untouched (§30.8); no historical backfill.
- First-real-event observation plan: watch first Order/Payment/Purchase writes in production; verify Finance-compatible treatment; idempotent retry checks.
- Post-deployment acceptance plan: runtime validators (read-only Finance diagnostics), business-write observation, reporting parity spot checks.
- Explicit human authorization obtained for the concrete rollout action(s) — classification alone never authorizes production mutation.

**In Scope**

- Deployment preflight (manifest, inventory, parity checks).
- Production-safe activation boundaries (what new operational writes go live; what stays dormant).
- Controlled promotion/versioning per repository release process.
- First-real-event observation (read-heavy; any production write only through the already-validated operational paths as normal business use under observation).
- Post-deployment acceptance evidence (runtime validators; reporting parity; idempotency observation).
- Rollback boundary readiness (previous immutable version retained; rollback criteria defined).
- Evidence recording across evidence classes: clasp upload ≠ runtime proof ≠ browser proof ≠ business acceptance.

**Explicitly Out of Scope**

- Migrations of any kind (PurchaseEvent schema migration NEVER rerun; no historical backfill without separate authorization).
- Activation of dormant inventory/AP capabilities.
- Historical data rewrite.
- Second pushes/retries to "fix uncertainty" without new authorization (repository clasp rules; Rule 7 second-push prohibition).
- Contract changes to accommodate deployment (§34.15).
- Retirement of dormant code (Phase 14).
- Feature work discovered post-rollout (new bounded tasks).

**Key Dependencies**

- Phase 12 MEASURED acceptance evidence.
- Repository release/deployment process docs (context).
- Frozen Finance Final Baseline validators as read-only production evidence tools.
- Prior immutable deployment version as rollback target.

**Finance Boundary**

- CRITICAL. Production writes go live only through validated Finance-compatible paths (PAID Purchase → cash/bank; Payment → SALE_SETTLEMENT + HPP snapshot).
- Dormant Finance-adjacent capabilities (AP operational, inventory) remain dormant in production.
- No Finance semantics change at rollout; Finance authority remains frozen baseline.
- Post-deployment Finance diagnostics remain read-only; zero production business writes caused by validation.

**Historical Compatibility Boundary**

- Production historical data readable through read-compatibility paths; legacy UNPAID PurchaseEvent rows remain non-postable/legacy-classified per frozen baseline.
- No historical backfill; historical HPP/Sales/Purchase snapshots untouched.

**Implementation Risk**

MEDIUM — source/runtime parity risk; activation-boundary risk.

**Operational Risk**

CRITICAL — production exposure; any Finance-boundary defect affects real business data; rollback discipline required; migration misuse catastrophic (NEVER rerun rule).

**Required Tests (preflight + post-deployment, MEASURED where executed)**

- Preflight: local gate evidence current (Phase 12 MEASURED); upload manifest verified against actual `clasp status` from the clean deployment workspace (presence/diff alone insufficient per repository gate); required runtime/test inventory verified; exclusions verified.
- Source/runtime parity checks: deployed source identity matches authorized manifest; version/deployment records correct.
- Activation boundary checks: new operational write paths active per plan; dormant paths (AP, inventory, Purchase UNPAID write, UsableQty authority) confirmed inactive in production surface.
- Migration counters: PRODUCTION_MIGRATION_INVOCATIONS = 0; PurchaseEvent migration untouched.
- Post-deployment read-only validators: Finance runtime validation PASS (five-period pattern or equivalent per baseline); PurchaseEvents production read compatible; no INVALID_PAYMENT_STATUS; Inventory Policy Evidence read-only unresolved per baseline expectations.
- First-real-event observation: first PAID Purchase Finance-compatible; first Payment Revenue/HPP at settlement; retry idempotency observed if exercised; reporting parity spot check.
- Rollback readiness: previous immutable version retained; rollback criteria documented; rollback drill executed only if plan requires (drill result recorded either way).
- Evidence discipline: each evidence class reported separately; no merged claims.

**Acceptance Gate**

- CRITICAL gate: explicit human authorization for rollout; preflight PASS; post-deployment acceptance PASS with MEASURED evidence.
- Zero unauthorized migrations; zero dormant-capability activation; Finance diagnostics read-only.
- Rollback boundary confirmed active/retained.
- RESULT recorded in release/production evidence per repository conventions (separate task).

**Exit Criteria**

- Acceptance Gate PASS with MEASURED post-deployment evidence.
- Phase 14 eligibility: new architecture proven stable in production under observation window.
- Stabilization watch period completes without contract-boundary defects (or defects recorded as separate bounded tasks).

**Rollback/Fail-Closed Considerations**

- CRITICAL. Rollback criteria: Finance-boundary defect, duplicate posting, failed idempotency, wrong Receive Via mapping, dormant capability activation, migration counter > 0 → immediate rollback consideration per plan.
- Rollback uses previous immutable deployment version; never data migration "down".
- Fail-closed: if preflight fails, do not push; if post-deployment validator fails, do not proceed to further activation; escalate.
- Second `clasp push` to reconcile uncertainty requires NEW explicit task authorization (repository Rule 7).

**Expected Classification Transitions**

- No business reclassification (contract unchanged); production state moves from "local-verified" to "production-observed".
- Phase 14 entry condition established: architecture stable enough for retirement audit eligibility (still read-only first).

---

### Phase 14 — Post-Stabilization Retirement Audit  (read-only first)

**Objective**

After the new architecture is proven stable, conduct a read-only-first retirement audit. Re-evaluate whether any DORMANT capability can become RETIRE_CANDIDATE. Evaluate listed subjects; historical Finance/read compatibility must prevent unsafe deletion. No retirement is pre-authorized by this roadmap.

**Why This Phase Occurs Here**

Retirement decisions require stable production evidence of the new architecture (Phase 13). Early cleanup of dormant code risks historical compatibility (principle 14; §31.2).

**Entry Criteria**

- Phase 13 production acceptance PASS; stabilization observation window satisfied.
- Phase 12 historical read-compatibility evidence current.
- Business Contract §31 (DORMANT ≠ deleted; RETIRE_CANDIDATE requires separate proof + authorization) governing.
- Audit is read-only until separate authorization for any concrete deletion/retirement action.
- Evidence inventory of dormant-code usage: who reads what (Finance reads, legacy compatibility, tests/oracles).

**In Scope**

- Read-only inventory and analysis of DORMANT capabilities:
  - AP operational remnants (settlement workflow code).
  - Purchase UNPAID operational branches (write paths — confirm dead for new writes; read-compatibility paths MUST remain).
  - InventoryReceipt (operational-only; finance posting prohibited per baseline).
  - InventoryLedger (read-only non-authoritative).
  - Goods Receipt attestation gates.
  - UsableQty authority remnants (COGSIngredients PurchaseCost/UsableQty path).
  - Superseded tabsal operational write paths (new writes superseded; historical reads remain).
- Classification exercise: DORMANT → RETIRE_CANDIDATE candidates vs DORMANT (must remain) vs KEEP (historical read authority).
- Historical Finance/read compatibility impact analysis per candidate (would deletion break history reads, Finance validators, test oracles?).
- Retirement proof requirements drafted per candidate (fixture-based regression replacements first — prior audit finding: legacy builders still provide active equivalence coverage; retirement requires independent regression replacements).
- Explicit statement: no deletion in this phase; RETIRE_CANDIDATE requires separate proof + separate owner authorization outside this roadmap (§31.4).

**Explicitly Out of Scope**

- Any deletion, staging, or code removal (requires separate authorization task).
- Production mutation of any kind.
- Contract changes (§34.15).
- Pre-authorized retirement (none; §31.3).
- Backfill/migration work.
- Historical evidence edits.
- Premature cleanup beyond documented analysis.

**Key Dependencies**

- Phase 13 stability evidence.
- Frozen Finance Final Baseline: which legacy paths Finance still reads (PurchaseEvent legacy reads; tabsal.HPP; historical snapshots).
- Test/oracle inventory (legacy builders, migration-oracle audit findings).
- Business Contract §31, §28, §30.

**Finance Boundary**

- Read-only audit must map each dormant subject to Finance read dependencies: AP 2000 historical reads; legacy PurchaseEvent reads; tabsal.HPP; BalanceLedger interactions.
- Any future retirement that would touch Finance reads requires Finance-authority proof first; Finance semantics remain frozen regardless.

**Historical Compatibility Boundary**

- Historical read compatibility is the primary constraint: DORMANT write paths may be candidates; DORMANT read-compatibility paths generally are NOT.
- Historical evidence immutable; audit does not rewrite evidence records.
- §28.7: hard-delete of historically referenced records prohibited where it would break history.

**Implementation Risk**

LOW (analysis) — analysis errors create future unsafe-retirement proposals; mitigated by proof requirements.

**Operational Risk**

LOW in this phase (read-only) — becomes HIGH only if future deletion tasks ignore historical compatibility proof; that risk lives outside this roadmap's authorization.

**Required Tests (audit-phase, read-only)**

- DORMANT inventory complete: each §31.1 subject analyzed with current usage evidence (callers/callees, test references, Finance read paths).
- Finance read-dependency map per subject (PurchaseEvent legacy reads; tabsal.HPP; AP 2000 historical; validators).
- Per-candidate retirement proof requirements drafted (fixture replacements, equivalence oracles, read-compatibility preservation).
- Explicit non-authorization record: RETIRE_CANDIDATE list produced by audit; NONE executed; contract §31.3/§31.4 restated.
- Test-suite impact analysis: which existing tests/oracles depend on dormant code.
- Audit report recorded as evidence; source unchanged by audit (read-only check).

**Acceptance Gate**

- Read-only audit complete; DORMANT subjects analyzed; Finance read dependencies mapped; proof requirements drafted per candidate.
- RETIRE_CANDIDATE list produced (may be empty; none pre-authorized).
- Zero source/evidence mutation by the audit itself.
- Historical compatibility constraints documented per candidate.

**Exit Criteria**

- Audit evidence recorded.
- Any future retirement proceeds only as separately authorized bounded tasks with their own proof + acceptance gates (outside this roadmap).
- Roadmap status remains ACTIVE until owner decides otherwise; retirement is never implied by roadmap presence.

**Rollback/Fail-Closed Considerations**

- Read-only phase: rollback = nothing (no mutation).
- Fail-closed posture: any candidate lacking historical-compatibility proof stays DORMANT, not RETIRE_CANDIDATE.
- Audit cannot authorize deletion; human gate required at any concrete retirement action.

**Expected Classification Transitions**

- DORMANT → RETIRE_CANDIDATE evaluation only; actual transitions require separate proof + authorization (none currently authorized per §31.3).
- DORMANT remains DORMANT by default.

---

## 10. Obsolete / Superseded Roadmap Items

Older roadmap/audit recommendations superseded by the canonical Business Contract. Each item is explicitly superseded — not preserved merely because it was previously planned. Historical evidence records of these items remain historically correct; they are not rewritten.

| # | Superseded item | Why superseded by canonical Business Contract |
| --- | --- | --- |
| 1 | Operational AP Settlement workflow as target feature | §10.2–10.3: NO operational AP, NO supplier debt, NO AP Settlement UI in current scope; §31.1: AP Settlement backend operational workflow = DORMANT. Historical AP 2000 truth remains readable (§30.5–30.6); target feature removed. |
| 2 | Purchase UNPAID workflow | §10.1: Purchase is ALWAYS PAID when recorded; Purchase cannot create new debt; §32: Purchase debt out of scope. Historical UNPAID PurchaseEvent rows remain readable (§30.5); new UNPAID operational writes prohibited. |
| 3 | stock-on-hand Inventory Operations Activation | §22.1–22.2: NUMLOCK does NOT maintain stock-on-hand; SOH, stock validation, negative-stock policy, inventory operations out of scope; §22.6/§30.9: dormant code must not activate inventory capabilities. |
| 4 | InventoryReceipt/InventoryLedger activation as business target | §31.1: both DORMANT; §30.9: inventory capabilities NOT activated merely because code exists; Finance Final Baseline: InventoryReceipt operational/gated with finance posting prohibited; InventoryLedger non-authoritative read-only. |
| 5 | Goods Receipt operator workflow for normal Purchase | §10.7: NO separate Goods Receipt UI required in current scope; §10.5: Save Purchase itself = PAID + RECEIVED business condition; §31.1: Goods Receipt/attested activation gate = DORMANT. |
| 6 | Yield/UsableQty business costing authority | §14.1–14.4: NO Yield, NO Usable Qty; purchased Base Qty 100% usable; conversion MUST NOT contain yield/waste; §34.10: Yield/UsableQty requirements MUST NOT be reintroduced; §31.1: incompatible COGSIngredients PurchaseCost/UsableQty authority path = DORMANT. |
| 7 | Customer Master requirement | §3.8: NO Customer entity and NO Customer Master in NUMLOCK scope; §32: Customer Master out of scope. |
| 8 | Promo/discount capability | §8.11: NO promo, NO discount, NO coupon, NO voucher; §32: promo/discount/coupon/voucher out of scope. |
| 9 | Inventory Adjustment / Stock Opname | §22.2: NO Inventory Adjustment, NO Stock Opname, NO waste/expired/damaged movement, NO manual inventory IN/OUT; §32: out of scope; §26.10: no stock-adjustment reporting. |

Additional superseded roadmap assumptions (implicit, now explicit):

- Reporting that treats all sales as Revenue: superseded by §26.1 (Revenue = PAID Orders), §26.12–26.14 (UNPAID not Revenue; PAID-not-COMPLETED is Revenue/HPP; CLOSED operational only).
- Purchase Evidence and Confirm Information steps: superseded by §10.8–10.9 (NO Purchase Evidence; NO Confirm Information step).
- Free-text Supplier/Item/UOM on transactions: superseded by §11.2, §12.2–12.3, §13.4.
- Direct-resale/no-recipe Products: superseded by §18.1.
- Manual Order price override, partial/split Payment, refund/void/cancellation/abandonment workflows: superseded by §3.9–3.12, §5.11–5.13, §32.
- Automatic Purchase → Standard Cost mutation: superseded by §15.3, §17.7.
- Automatic Standard Cost → Selling Price change: superseded by §8.8.
- Using CLOSED as revenue-recognition gate: superseded by §7.3–7.4, §26.14.

## 11. TARGET vs CURRENT Implementation State

This roadmap keeps TARGET and CURRENT distinct at all times.

| Aspect | TARGET (canonical contract; roadmap phases deliver toward it) | CURRENT IMPLEMENTATION STATE (context only; §33 / reconciliation baseline) |
| --- | --- | --- |
| Sales domain | Order + Payment + Fulfillment (§3–§7) | tabsal sale-line operational semantics; Order model MISSING |
| Revenue authority | PAID Orders at successful Payment (§5, §26) | All-sales-as-revenue reporting (CHANGE) |
| HPP authority | Immutable Payment-time snapshot (§21) | tabsal.HPP historical authority (KEEP/frozen); Payment-time snapshots MISSING |
| Purchase | Always PAID; Supplier Master; Paid Via; PAID+RECEIVED (§10) | UNPAID path, free-text Supplier, Evidence/Confirm Information behaviors (CHANGE) |
| Supplier | Supplier Master mandatory (§11) | MISSING |
| Item/UOM | Base UOM authority; item-filtered UOM; conversion authority (§13) | Exists; needs hardening (CHANGE→KEEP) |
| Costing | Approved Standard Cost authority; Base Qty normalization; no Yield/UsableQty (§14–§17) | UsableQty/PurchaseCost path (CHANGE; DORMANT target treatment); Standard Cost dual-path |
| Recipe | Recipe Versioning; Base UOM; Standard Cost consumption (§18–§20) | Recipe exists; Versioning MISSING |
| Roles | ADMIN/OPERATOR only (§25) | MISSING |
| Reporting | PAID-only Revenue; Payment-time HPP; contract dimensions (§26) | Legacy reporting semantics (CHANGE) |
| Stock | No stock-on-hand; no stock reporting (§22, §26.10) | Dormant inventory code present (DORMANT; must not activate) |
| AP | No operational AP (§10, §32) | AP backend historical/dormant (DORMANT; historical reads preserved) |
| Forms | Global Form UX Contract (§27) | Partial; CHANGE toward conformance |
| RETIRE_CANDIDATE | None currently authorized (§31.3) | None currently authorized |

Rule: implementation gaps listed in CURRENT state are repaired toward TARGET. The contract is never bent to match CURRENT state (§34.2).

## 12. Authoring Validation Notes

This roadmap was authored as a documentation-only task (L2/R1). Authoring-time verification:

| Check | Result |
| --- | --- |
| Target file created: `docs/roadmaps/NUMLOCK-IMPLEMENTATION-ROADMAP.md` | YES (sole file created/modified by task) |
| Canonical Business Contract modified | NO (read-only; no edit issued) |
| Forensic scripts (`tests/browser/fluid-desktop-stage3-*`) modified | NO (read-only glob; no edit issued) |
| Source/test/evidence files modified | NO |
| Git staging/commit/push/clasp/production mutation | NONE performed |
| `git diff --check` / `git status --short` | NOT EXECUTED — shell tool unavailable in authoring session; reported as unverified in task completion report |
| Roadmap contract completeness (14 phases × full Phase Contract fields) | Verified by document structure |
| Stock-on-hand / operational AP / Yield reintroduced anywhere in roadmap phases | NO — phases explicitly forbid them |
| Payment remains Revenue/HPP recognition authority | YES — Phases 6, 9, 12 enforce; CLOSED explicitly operational-only |
| Finance frozen boundary explicit | YES — Finance Boundary field in every phase; §30 references throughout |
| Obsolete roadmap section present | YES — Section 10 |
| Implementation decision gates present | YES — Section 7 (4 gates) |
| Governance rules present | YES — Section 3 |

Git-bound worktree validations (tracked/staged counts, untracked forensic inventory, `git diff --check`) remain UNKNOWN/UNVERIFIED in this session and must be executed in a shell-capable environment before freeze.

## 13. Roadmap Status

**IMPLEMENTATION ROADMAP STATUS: ACTIVE — DERIVED FROM CANONICAL BUSINESS CONTRACT**

- Canonical Business Contract: `docs/contracts/NUMLOCK-BUSINESS-CONTRACT.md`, commit `e56acfefb3dfbb3eaa08de7e9af0a42e6ba02a0b`, status APPROVED_CANONICAL.
- Business Decision Gate: COMPLETE.
- This roadmap delivers toward TARGET; it does not authorize execution.
- Next action: REVIEW_AND_FREEZE_REVISED_IMPLEMENTATION_ROADMAP.
- Phase execution, production rollout, and retirement each require their own explicit authorization at their respective gates. Nothing in this document grants such authorization.

---

*End of revised NUMLOCK implementation roadmap.*
*Status: ACTIVE — DERIVED FROM CANONICAL BUSINESS CONTRACT. Implementation conformance: NOT claimed.*
