# NUMLOCK Business Contract

**BUSINESS CONTRACT STATUS: APPROVED — CANONICAL**

| Field | Value |
| --- | --- |
| Document | `docs/contracts/NUMLOCK-BUSINESS-CONTRACT.md` |
| Classification | Canonical business contract / single source of truth |
| Complexity / Risk | L2 documentation-only / R1 |
| Business authorities | Owner-approved Business Decision Contract (Business Decision Gate); BUSINESS_DECISION_CONTRACT_RECONCILIATION_PASS; Frozen Finance Final Baseline |
| Reconciliation evidence | Current implementation is context evidence only; it is NOT authority where it conflicts with this contract |
| Implementation conformance | NOT claimed. Implementation gaps are recorded in Section 33 as non-authoritative state. |
| Next action | REVIEW_AND_FREEZE_CANONICAL_BUSINESS_CONTRACT |

## Document Purpose

This document is the canonical NUMLOCK business contract.

- Future NUMLOCK operational implementation MUST conform to this contract.
- Existing implementation conflicts with this contract are **implementation gaps**, not reasons to reinterpret or silently change approved business decisions.
- Frozen Finance semantics remain authoritative where explicitly preserved (Section 30).
- Historical transaction records MUST NOT be rewritten merely to conform old transactions to new operational rules (Section 28).
- Superseded or dormant capabilities MAY remain for historical compatibility until separately proven safe to retire (Section 31).
- This document does NOT claim that the current implementation conforms.

## Reading Convention

- Unless a paragraph is explicitly marked **CURRENT IMPLEMENTATION STATE (non-authoritative)**, every rule in this document is **TARGET BUSINESS CONTRACT** — normative, approved, and binding on future implementation.
- Section 33 (**Current Implementation Gap Summary**) describes current implementation state only. It does NOT weaken, reinterpret, or supersede any target rule in Sections 1–32 and 34.
- Normative keywords: **MUST** / **MUST NOT** (mandatory), **MAY** (optional/permitted), **SHOULD** (preferred; only where used).
- Implementation-specific mechanics (storage, UI wiring, technical libraries) are implementation decisions unless this document states a business rule. Genuinely undecided implementation details are marked as implementation decisions, NOT business blockers.

---

## 1. Document Authority and Scope

**TARGET BUSINESS CONTRACT**

1.1 This document is the authoritative NUMLOCK business contract for operational implementation.

1.2 Business authorities, in precedence order:
   1. Owner-approved Business Decision Contract from the completed Business Decision Gate.
   2. BUSINESS_DECISION_CONTRACT_RECONCILIATION_PASS (prior read-only reconciliation).
   3. Frozen Finance Final Baseline (Section 30).
   4. Current implementation — reconciliation/context evidence only; never authority over approved business decisions.

1.3 Where current implementation conflicts with this contract, the implementation MUST be treated as non-conformant and repaired toward this contract. The contract MUST NOT be bent to match implementation.

1.4 Scope: NUMLOCK operational domain — Sales/Order, Payment, Fulfillment, Selling Price, Expense, Purchase, Supplier/Item/Product/Recipe masters, UOM, Standard Cost, identity/timestamps, roles, reporting, form UX, historical integrity, idempotency safety, and the Finance integration boundary.

1.5 This document does NOT authorize any deployment, migration, production write, or evidence mutation. It does NOT claim implementation conformance.

1.6 Frozen Finance semantics, where explicitly preserved in this contract, remain authoritative and MUST NOT be redefined here.

## 2. Core Domain Principles

**TARGET BUSINESS CONTRACT**

2.1 NUMLOCK is an operational order/payment/purchase business system with costing and reporting. It does NOT maintain stock-on-hand (Section 22).

2.2 Order, Payment, and Fulfillment are independent concepts with defined relationships (Sections 3–7). PaymentStatus and FulfillmentStatus MUST NOT be conflated.

2.3 Master Data (Supplier, Ingredient/Item, Product, Recipe, UOM, Pricing, Receive Via/account mapping) is configuration authority. Transactions reference Master Data by stable identity; transactions carry immutable snapshots where this contract requires them.

2.4 Historical transaction facts are immutable. Master Data changes are prospective unless a rule explicitly preserves historical meaning via versioning (Sections 20, 28).

2.5 Purchase history, Recipe definition, and Standard Cost authority are three distinct concepts (Sections 15–17, 19). Purchase history MUST NOT silently become costing authority.

2.6 Roles are limited to ADMIN and OPERATOR (Section 25). There is no transaction approval workflow.

2.7 Revenue and HPP recognition authority is successful Payment (Sections 5, 21, 26). CLOSED is operational, derived, and is NOT revenue-recognition authority (Section 7).

2.8 Where this document leaves an implementation detail undecided, that detail is an **implementation decision**, not a business blocker. Business rules listed in this document are decided and MUST NOT be re-opened as TODOs.

## 3. Sales / Order

**TARGET BUSINESS CONTRACT**

3.1 An Order MAY exist before Payment.
3.2 Receive Via is NOT required at Order creation.
3.3 Customer MAY pay before or after preparation/completion.
3.4 PaymentStatus and FulfillmentStatus are independent.
3.5 Revenue and HPP are recognized on successful Payment (Sections 5, 21, 26).
3.6 CLOSED iff PaymentStatus = PAID AND FulfillmentStatus = COMPLETED (Section 7).
3.7 CLOSED is derived, not manually operated.
3.8 There is NO Customer entity and NO Customer Master in NUMLOCK scope.
3.9 There is NO cancel workflow, NO void workflow, and NO refund workflow.
3.10 There is NO partial Payment.
3.11 There is NO split Payment.
3.12 There is NO abandonment workflow.
3.13 An Order MAY contain multiple Product lines.
3.14 Fulfillment is Order-level, NOT Order-Line-level.

## 4. Order Type — DINE_IN / TAKE_AWAY

**TARGET BUSINESS CONTRACT**

4.1 Every Order MUST carry exactly one Order Type: `DINE_IN` or `TAKE_AWAY`.
4.2 Order Type MUST NOT change Selling Price.
4.3 Order Type MUST NOT change Recipe or HPP.
4.4 Order Type MUST NOT change Payment or Receive Via behavior.
4.5 Order Type MAY be used as a reporting dimension (Section 26).

## 5. Payment / Receive Via

**TARGET BUSINESS CONTRACT**

5.1 One Order has at most one successful Payment.
5.2 Payment settles 100% of Order Total. There is NO partial Payment.
5.3 Payment Amount derives from Order Total.
5.4 Receive Via is mandatory at Payment.
5.5 Receive Via comes from authoritative configuration/database (Section 25: OPERATOR may not change Receive Via/account mapping).
5.6 Operator-facing values MUST use business-friendly labels (e.g. Cash, BCA, QRIS).
5.7 Backend MUST map Receive Via to Finance account authority.
5.8 Successful Payment transitions PaymentStatus UNPAID → PAID.
5.9 Successful Payment triggers Revenue + HPP recognition.
5.10 PaidAt is automatic (Section 24).
5.11 A successful Payment CANNOT normally be edited into another amount or method.
5.12 There is NO refund, NO void, and NO reversal workflow in current scope.
5.13 There is NO split Payment.

## 6. Fulfillment

**TARGET BUSINESS CONTRACT**

6.1 Fulfillment lifecycle: `OPEN → PREPARING → READY → COMPLETED`.
6.2 The normal workflow MUST NOT move backward.
6.3 `PreparingAt`, `ReadyAt`, and `CompletedAt` record the FIRST transition into the respective status.
6.4 Retry MUST NOT replace a first-event timestamp (Sections 24, 29).
6.5 Fulfillment applies to the entire Order, not to individual Order lines.
6.6 `COMPLETED` does NOT post inventory stock consumption, because NUMLOCK does NOT maintain stock-on-hand (Section 22).

## 7. Order Closure

**TARGET BUSINESS CONTRACT**

7.1 CLOSED iff PaymentStatus = PAID AND FulfillmentStatus = COMPLETED.
7.2 CLOSED is derived from the two statuses; it is NOT manually operated and NOT a free-form status.
7.3 CLOSED is an operational milestone. It is NOT the Revenue/HPP recognition authority — recognition authority is successful Payment (Sections 5, 21, 26).
7.4 A PAID but not COMPLETED Order IS Revenue/HPP (Section 26). A CLOSED condition is therefore not required for revenue reporting.

## 8. Selling Price

**TARGET BUSINESS CONTRACT**

8.1 Every active Product MUST have a valid Selling Price.
8.2 Selling Price authority is the Product/Pricing Master.
8.3 There MUST NOT be a manual Order price override.
8.4 Order Line stores an immutable price snapshot taken at Order creation.
8.5 Price changes are prospective only; historical Orders keep their snapshots.
8.6 A Product CANNOT be sold without a valid Selling Price.
8.7 Selling Price and Standard Cost are separate authorities.
8.8 A Standard Cost change MUST NOT automatically change Selling Price.
8.9 Margin MAY be calculated and displayed.
8.10 Margin MUST NOT automatically change Selling Price.
8.11 There is NO promo, NO discount, NO coupon, and NO voucher.

## 9. Expense

**TARGET BUSINESS CONTRACT**

9.1 Ordinary Expense is ALWAYS PAID when recorded.
9.2 There is NO UNPAID Expense.
9.3 Expense has NO PaymentStatus requirement.
9.4 There is NO Expense AP/payable.
9.5 There is NO Expense settlement workflow.
9.6 Paid Via / cashAccountCode is mandatory.
9.7 Cash/bank source is determined at Expense entry.

## 10. Purchase

**TARGET BUSINESS CONTRACT**

10.1 Purchase is ALWAYS PAID when recorded. Purchase cannot create new debt.
10.2 There is NO operational AP and NO supplier debt in current scope.
10.3 There is NO partial supplier payment and NO AP Settlement UI.
10.4 Paid Via is mandatory.
10.5 Purchase is entered only after goods have been received. Save Purchase therefore means PAID + RECEIVED as a business condition.
10.6 PAID + RECEIVED at Purchase entry does NOT imply stock-on-hand tracking (Section 22).
10.7 There is NO separate Goods Receipt UI required in current scope.
10.8 There is NO Purchase Evidence.
10.9 There is NO Confirm Information step.

10.10 Purchase fields: Purchase Date, Supplier, Item/Ingredient, Qty, UOM, Purchase Price, Paid Via.

10.11 Purchase Date defaults to the current date; it is editable by the operator; it is distinct from CreatedAt (Section 24).
10.12 Purchase reporting uses Purchase Date (Section 26).

## 11. Supplier Master

**TARGET BUSINESS CONTRACT**

11.1 Supplier is mandatory for every Purchase.
11.2 Supplier is selected from Supplier Master. There is NO free-text Supplier on Purchase.
11.3 Suppliers are created and maintained only in Supplier Master.
11.4 Purchase dropdown exposes active Suppliers.
11.5 A historical Supplier MUST NOT be hard-deleted; it MAY be Inactive.
11.6 Historical supplier relationships are preserved.
11.7 Supplier is NOT an AP/creditor authority.
11.8 Minimum required Supplier field: Name.
11.9 Address, phone, contact, and notes are optional.
11.10 Supplier carries NO debt balance, NO credit limit, NO payment terms, NO due date, and NO AP history requirement.

## 12. Item / Ingredient Master

**TARGET BUSINESS CONTRACT**

12.1 Every purchasable Ingredient MUST already exist in Item/Ingredient Master before it can appear on Purchase.
12.2 There is NO inline Item creation from Purchase.
12.3 There is NO free-text Item on Purchase.
12.4 Ingredient/Item uses a stable identity across Purchase, Recipe, and Costing.
12.5 Descriptive fields MAY be edited.
12.6 Structural historical meaning MUST be preserved.
12.7 An Item with history MUST NOT be hard-deleted; use Inactive.
12.8 Base UOM is protected once transactional history exists (Section 13).

## 13. UOM and Conversion

**TARGET BUSINESS CONTRACT**

13.1 Exactly one Base UOM per Item/Ingredient.
13.2 Multiple valid Purchase UOMs are allowed per Item.
13.3 Purchase UOM dropdown is filtered by the selected Item.
13.4 UOM comes from database/configuration. There is NO free-text UOM.
13.5 Each Purchase UOM has an authoritative Base UOM conversion.
13.6 Operator MUST NOT edit conversion from Purchase.
13.7 Recipe uses Base UOM exclusively. There is NO free-text Recipe UOM.
13.8 Purchase Qty + Purchase UOM → Base Qty via authoritative conversion.
13.9 Historical conversion meaning MUST NOT be retroactively changed.
13.10 A conversion change requires prospective configuration/versioning.
13.11 Historical UOM and conversion records MUST NOT be hard-deleted.
13.12 UOM conversion MUST NOT contain yield or waste (Section 14).

## 14. Yield / Usable Qty Policy

**TARGET BUSINESS CONTRACT**

14.1 NUMLOCK does NOT use Yield. There is NO Yield %.
14.2 NUMLOCK does NOT use Usable Qty. There is NO Usable Qty Purchase input.
14.3 Purchased Base Qty is treated as 100% usable for costing.
14.4 UOM conversion MUST NOT contain yield/waste.
14.5 Actual normalized unit cost = Purchase Total / Base Qty.
14.6 Any Yield/Usable Qty requirement appearing in current implementation is an implementation gap, not a business requirement (Section 33).

## 15. Actual Purchase Cost

**TARGET BUSINESS CONTRACT**

15.1 Purchase Price is a historical actual transaction cost.
15.2 A Purchase generates a normalized actual unit cost (Section 14.5).
15.3 Purchase MUST NEVER automatically change Standard Cost.
15.4 Actual Purchase Cost is reporting/analysis history. It is NOT authoritative for Recipe/Product costing (Section 17).

## 16. Recommended / Proposed Standard Cost

**TARGET BUSINESS CONTRACT**

16.1 The system MAY calculate a Recommended/Proposed Standard Cost from Purchase history.
16.2 The recommendation algorithm is NOT defined in this contract. It MUST NOT be invented or assumed; defining it is an implementation/product decision outside this document's authority.
16.3 Recommended/Proposed Standard Cost is a proposal. It is NOT authoritative Standard Cost.
16.4 Applying a Proposed Standard Cost as Approved Standard Cost requires the explicit authorized action defined in Section 17.

## 17. Standard Cost Authority

**TARGET BUSINESS CONTRACT**

17.1 Three distinct concepts MUST be kept separate: Actual Purchase Cost (Section 15), Recommended/Proposed Standard Cost (Section 16), and Approved Standard Cost.
17.2 Approved Standard Cost is authoritative for Recipe and Product costing.
17.3 Standard Cost changes require explicit authorized action (ADMIN authority; Section 25).
17.4 Recipe component cost derives from Recipe Qty × authoritative Ingredient Standard Cost.
17.5 Standard Cost changes are prospective for costing.
17.6 Historical Sales HPP remains immutable (Sections 21, 28).
17.7 Standard Cost changes MUST NOT rewrite Purchase history (Section 26).
17.8 Standard Cost changes MUST NOT automatically change Selling Price (Section 8).

## 18. Product Master

**TARGET BUSINESS CONTRACT**

18.1 All NUMLOCK Products have a Recipe. There is NO direct-resale/no-recipe Product.
18.2 Product and Ingredient are distinct identities.
18.3 A Product with Sales history MUST NOT be hard-deleted; use Inactive.
18.4 A Product MUST have valid Recipe and costing dependencies before it can be sold.
18.5 Product Master holds Selling Price authority (Section 8).

## 19. Recipe

**TARGET BUSINESS CONTRACT**

19.1 Recipe is the authoritative Product composition.
19.2 Recipe references only registered Ingredients (Section 12).
19.3 Recipe quantities use Ingredient Base UOM (Section 13.7).
19.4 Recipe quantity is standard consumption per one Product.
19.5 Product cost = Recipe × authoritative Ingredient Standard Cost.
19.6 Recipe does NOT directly use current Purchase Price as authority.
19.7 Purchase changes MUST NOT alter Recipe.
19.8 An Ingredient used by an active Recipe MUST NOT be made Inactive until the dependency is resolved.

## 20. Recipe Versioning

**TARGET BUSINESS CONTRACT**

20.1 Substantive Recipe changes MUST create a new version.
20.2 Historical Recipe meaning MUST NOT be overwritten.
20.3 Only one Recipe version is active for a Product at a given effective time.
20.4 Old versions remain historical.
20.5 An Order binds to the Recipe version applicable when the Order is created.
20.6 Later Recipe changes MUST NOT reinterpret existing Orders.
20.7 Historical HPP remains immutable (Section 21).

## 21. HPP Snapshot Authority

**TARGET BUSINESS CONTRACT**

21.1 HPP is recognized at successful Payment.
21.2 The HPP recorded for an Order is an immutable snapshot captured at Payment time, using the Recipe version applicable to that Order (Section 20.5).
21.3 Historical HPP MUST NOT be recalculated or rewritten by later changes to Selling Price, Standard Cost, Recipe, UOM conversion, or Purchase history.
21.4 Reporting HPP (Section 26) uses these immutable Payment-time HPP snapshots.

## 22. Inventory / Stock Boundary

**TARGET BUSINESS CONTRACT — CRITICAL**

22.1 NUMLOCK does NOT maintain stock-on-hand.
22.2 Therefore, current scope has NO: Current Stock/SOH; negative stock policy; stock availability validation; Inventory Adjustment; Stock Opname; waste movement; expired/damaged movement; manual Inventory IN/OUT; operational stock balance; Inventory OUT posting at Fulfillment COMPLETED.
22.3 Purchase Qty/UOM/Base Qty exist for: purchase history; normalized actual Purchase cost; cost analysis and Recommended Standard Cost inputs.
22.4 Recipe Qty exists for: Product costing; HPP; theoretical Recipe usage analysis.
22.5 Theoretical Recipe usage MUST NEVER be labelled as actual stock consumption.
22.6 Inventory capabilities MUST NOT be activated merely because dormant code exists (Sections 30, 31).
22.7 No stock-on-hand/value/waste/variance reporting exists in scope (Section 26).

## 23. Transaction Identity

**TARGET BUSINESS CONTRACT**

23.1 NUMLOCK uses stable immutable internal IDs for entities.
23.2 OrderID is system-generated and immutable.
23.3 Human-readable Order Number is system-generated.
23.4 Order Number is NOT relational primary authority.
23.5 Order Number MUST NOT be reused.
23.6 Order Number MUST NOT encode unnecessary meaning such as Customer or Order Type.
23.7 Exact Order Number formatting is NOT mandated by this contract (implementation decision; MUST still satisfy 23.3–23.6).
23.8 The same stable-ID principle applies to: Purchase, Payment, Supplier, Ingredient, Product, Recipe Version, and other relevant relational entities.

## 24. Timestamps

**TARGET BUSINESS CONTRACT**

**Order**
24.1 CreatedAt: automatic, not editable.
24.2 PreparingAt: first transition to PREPARING.
24.3 ReadyAt: first transition to READY.
24.4 CompletedAt: first transition to COMPLETED.
24.5 PaidAt: successful Payment.
24.6 Event timestamps are immutable through the normal workflow.
24.7 Retry MUST NOT replace a first-event timestamp.
24.8 UpdatedAt remains audit metadata.

**Purchase**
24.9 Purchase Date defaults to today and is operator-editable; it is distinct from CreatedAt.
24.10 Purchase CreatedAt is automatic.
24.11 Purchase UpdatedAt is audit metadata.

## 25. Roles and Permissions

**TARGET BUSINESS CONTRACT**

25.1 Only required roles: ADMIN, OPERATOR.

25.2 ADMIN: full authority, including master/configuration and operations.

25.3 OPERATOR MAY: create Order; choose DINE_IN/TAKE_AWAY; add Product + Qty; move valid Fulfillment lifecycle; execute Payment; choose Receive Via; create Purchase.

25.4 OPERATOR MUST NOT change: Master Data; Recipe; Selling Price; Standard Cost; UOM/Conversion; Receive Via/account mapping.

25.5 There is NO transaction approval workflow.
25.6 A valid transaction applies when saved.
25.7 Actor audit identity MUST be preserved where applicable.

## 26. Reporting Authority

**TARGET BUSINESS CONTRACT**

26.1 Revenue = PAID Orders.
26.2 Qty Sold = Product Qty on PAID Orders.
26.3 HPP = immutable Payment-time HPP snapshot.
26.4 Gross Profit = Revenue − HPP.
26.5 Reporting dimensions allowed: DINE_IN/TAKE_AWAY; Receive Via; Product.
26.6 Purchase reporting uses Purchase Date.
26.7 Purchase reporting MAY break down Supplier/Ingredient/UOM/Paid Via.
26.8 Standard Cost changes MUST NOT rewrite Purchase history.
26.9 Expense reporting uses PAID Expense.
26.10 There is NO stock-on-hand, stock-value, waste, or variance reporting.
26.11 Recipe usage MAY be theoretical only, and MUST NOT be labelled actual consumption.
26.12 An UNPAID Order is NOT Revenue.
26.13 A PAID but not COMPLETED Order IS Revenue/HPP.
26.14 CLOSED is operational and is NOT Revenue-recognition authority.
26.15 Reports use historical transaction snapshots.
26.16 Reporting/dashboard is read-only to source transactions.

## 27. Global Form UX Contract

**TARGET BUSINESS CONTRACT — MANDATORY**

Every NUMLOCK form MUST provide:

1. A clear visible field label.
2. Appropriate input guidance.
3. Specific validation feedback.

Rules:

27.1 For text/number/date fields: use a meaningful placeholder and/or helper text where appropriate.
27.2 For dropdown/select: provide equivalent prompt/empty-selection guidance, e.g.:
   - `Pilih supplier`
   - `Pilih item`
   - `Pilih UOM`
   - `Pilih metode pembayaran`
27.3 Placeholder/prompt MUST NOT replace a visible label.
27.4 Validation messages MUST identify the actual problem where known.
27.5 Examples of required specificity:
   - `Supplier wajib dipilih.`
   - `Qty harus lebih besar dari 0.`
   - `UOM tidak valid untuk item ini.`
27.6 Avoid generic `Invalid input` when a precise validation reason is available.
27.7 Implementation-specific placeholder wording MAY be refined for clarity, but every form MUST conform to this guidance contract.

## 28. Historical Integrity

**TARGET BUSINESS CONTRACT**

28.1 Transaction snapshots are immutable historical facts.
28.2 Current Master Data MUST NOT rewrite historical transaction interpretation.
28.3 Price changes are prospective.
28.4 Standard Cost changes are prospective.
28.5 Recipe changes are prospective; Recipe versions preserve historical meaning.
28.6 UOM conversion changes MUST NOT reinterpret historical transactions.
28.7 Hard-delete of historically referenced master records is prohibited where it would break history; use Inactive where applicable.

## 29. Idempotency / Mutation Safety

**TARGET BUSINESS CONTRACT — business-level safety requirements**

29.1 One successful Payment per Order.
29.2 Retries MUST NOT duplicate Payment.
29.3 Retries MUST NOT duplicate Revenue/HPP posting.
29.4 Event timestamps record the first successful transition; retries MUST NOT replace them.
29.5 Transaction IDs are immutable.
29.6 Operations that become implementation mutations MUST preserve atomic/fail-closed behavior where required.

Note: this section states business-level safety requirements only. Technical implementation mechanisms are implementation decisions and are NOT prescribed here.

## 30. Finance Integration Boundary

**TARGET BUSINESS CONTRACT — preserves reconciliation conclusion**

30.1 The approved target does NOT require changing frozen Finance semantics.
30.2 Operational implementation MUST adapt to Finance; Finance MUST NOT be redefined to accommodate operational convenience.
30.3 SALE_SETTLEMENT occurs at successful Payment.
30.4 New Purchase operational writes are PAID and resolve to cash/bank authority.
30.5 Historical UNPAID PurchaseEvent / AP 2000 truth remains readable.
30.6 Historical AP records MUST NOT be rewritten.
30.7 Policy C HPP semantics remain frozen.
30.8 PurchaseEvent schema migration remains a historical one-time migration and MUST NEVER be rerun.
30.9 Inventory capabilities are NOT activated merely because code exists.

## 31. Dormant / Historical Compatibility Capabilities

**TARGET BUSINESS CONTRACT**

31.1 Current target treatment — **DORMANT**:
   - AP Settlement backend operational workflow
   - Purchase UNPAID operational path
   - InventoryReceipt
   - InventoryLedger
   - Goods Receipt / attested activation gate
   - COGSIngredients PurchaseCost/UsableQty authority path where incompatible with target Standard Cost authority

31.2 **DORMANT does NOT mean deleted.** Historical read compatibility MUST remain until separately proven safe to retire.
31.3 No current capability is classified as safe **RETIRE** in this document. RETIRE_CANDIDATE: none currently authorized (Section 33).
31.4 Retiring any dormant capability requires separate proof and separate authorization outside this document.

## 32. Explicit Out of Scope

**TARGET BUSINESS CONTRACT**

Out of scope (MUST NOT be implemented as in-scope business requirements):

- Customer Master / Customer on Order
- promo
- discount
- coupon/voucher
- manual Selling Price override
- partial Payment
- split Payment
- refund/void
- cancellation workflow
- abandonment workflow
- Purchase debt
- operational AP
- AP Settlement UI
- Expense payable/accrual
- Purchase Evidence
- Purchase Confirm Information
- Yield
- Usable Qty
- stock-on-hand
- negative stock guard
- Inventory Adjustment
- Stock Opname
- waste/expired stock movement
- direct-resale/no-recipe Product

## 33. Current Implementation Gap Summary

**CURRENT IMPLEMENTATION STATE (non-authoritative)**

This section describes implementation state based on BUSINESS_DECISION_CONTRACT_RECONCILIATION_PASS. It does NOT weaken the target contract in Sections 1–32 and 34. It does NOT list transient working-tree state.

| Category | Items |
| --- | --- |
| **KEEP** | Selling Price snapshot; HPP snapshot; Ordinary Expense; Item/Ingredient Master; UOM conversion; Product Master; Recipe; existing transaction IDs/timestamps where compatible |
| **CHANGE** | tabsal sale-line semantics → Order + Payment model; Receive Via authority/labels; Purchase UNPAID/evidence/free-text Supplier behavior; UsableQty costing authority; Standard Cost dual-path; Reporting → PAID-only Revenue authority; Form UX guidance/validation |
| **DORMANT** | AP Settlement operational workflow; Purchase UNPAID operational path; InventoryReceipt; InventoryLedger; Goods Receipt/attested activation; incompatible COGSIngredients PurchaseCost/UsableQty authority path |
| **MISSING** | Order model; Payment entity; Fulfillment lifecycle; DINE_IN/TAKE_AWAY; Supplier Master; Recipe Versioning; ADMIN/OPERATOR roles; Recommended Standard Cost; PAID-based reporting dimensions |
| **RETIRE_CANDIDATE** | none currently authorized |

Explicit statement: this table describes implementation state. It does NOT weaken the target contract. Implementation conformance is NOT claimed.

## 34. Implementation Conformance Rules

**TARGET BUSINESS CONTRACT**

34.1 Future operational implementation MUST conform to Sections 1–32 of this contract.
34.2 Where implementation conflicts with this contract, the conflict is an implementation gap. Implementation MUST be repaired toward this contract; this contract MUST NOT be reinterpreted to match implementation.
34.3 Owner-approved business decisions MUST NOT be silently changed because current source differs.
34.4 Implementation MUST preserve Target-vs-Current distinction: this contract states the target; Section 33 states current state.
34.5 Frozen Finance semantics (Section 30) MUST be preserved; operational implementation adapts to Finance.
34.6 Historical records MUST NOT be rewritten to conform old transactions to new operational rules (Section 28).
34.7 Dormant capabilities (Section 31) remain for historical compatibility until separately proven safe to retire. DORMANT is not deleted and is not RETIRE.
34.8 Inventory/stock-on-hand capabilities MUST NOT be activated (Sections 22, 31).
34.9 Operational AP, Purchase debt, and AP Settlement operational workflow MUST NOT be reintroduced (Sections 10, 22, 32).
34.10 Yield/Usable Qty business requirements MUST NOT be reintroduced (Section 14).
34.11 Successful Payment remains the Revenue/HPP recognition authority; CLOSED remains derived PAID+COMPLETED and operational-only (Sections 5, 7, 21, 26).
34.12 Every form MUST conform to the Global Form UX Contract (Section 27).
34.13 Exact Order Number formatting and other genuinely undecided implementation details are implementation decisions, not business blockers; they MUST still satisfy the identity rules in Section 23.
34.14 Conformance MUST NOT be claimed by this document. Conformance is established only by implementation work that is separately validated against this contract.
34.15 This contract MUST NOT be modified to accommodate a deployment, migration, or production action. PurchaseEvent schema migration remains a historical one-time migration and MUST NEVER be rerun (Section 30.8).

---

*End of canonical NUMLOCK business contract.*
*Status: BUSINESS CONTRACT STATUS: APPROVED — CANONICAL. Implementation conformance: NOT claimed.*
