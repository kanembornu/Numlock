NEW TASK — Finance Phase 11V.12: Expense Cost-Type and Purchase Policy Implementation

Follow AGENTS.md.

Objective:
Implement the approved prospective Expense cost-type and purchase-authority
policy from Phase 11V.11.

Keep production activation DISABLED.

Approved business authority:

FIXED_COST
- OSS01 Salary
- OUS01 Air & Sampah
- OUS02 Listrik
- OUS03 Sewa
- OUS04 WiFi

VARIABLE_COST + NON_HPP_VARIABLE_COST
- OSK02 Gas
- OSK05 Kelontong
- OUR01 MTain Repair
- OEE01 Event

OTHER / CAPEX HOLD
- OUU01 MTain Upgrade

VARIABLE_COST + DIRECT_HPP_COMPONENT
- OSK01 Galon -> ING-011 Air
- OSK03 Gula -> ING-020 Gula
- OSK04 Hakaes -> ING-021 Es
- OSR02 Kopi Biji Ro -> ING-006 Bean Robusta
- OSR04 Lemon -> ING-018 Lemon
- OSR05 Powder Choco -> ING-015 Powder Choco
- OSR06 Powder Matcha -> ING-016 Powder Matcha
- OSR18 Soda -> ING-019 Soda
- OSR19 Susu Diamond -> ING-009 UHT
- OSR20 Susu Omela -> ING-010 SKM

VARIABLE_COST + HPP_COST_POOL
- OSR01 Kopi Biji Ar
  -> ING-004 Bean Ar 100%
  -> ING-005 Bean Ar Lintong

- OSR03 Kopi Bubuk
  -> ING-007 Kopi Badau
  -> ING-008 Kopi Kingkong

- OSR21 Teh Bubuk
  -> ING-012 Teh Bendera
  -> ING-013 Teh Poci
  -> ING-014 Teh Zeppelin

Sirup authority:
Preserve each operator-facing ExpenseItem label independently.

OSR07 Sirup Blue Citrus
OSR08 Sirup Caramel
OSR09 Sirup Hazelnut
OSR10 Sirup Lychee
OSR11 Sirup Mango
OSR12 Sirup Mojito
OSR13 Sirup Passion
OSR14 Sirup Peach
OSR15 Sirup Peppermint
OSR17 Sirup Vanilla

Prospective policy:
VARIABLE_COST + DIRECT_HPP_COMPONENT candidate -> ING-017 Sirup

But:
- preserve each flavor label as the purchase identity
- do not merge purchase costs across flavors
- do not infer package equivalence
- do not derive one pooled ING-017 unit cost from mixed flavor purchases
- quantity/package tracking requires truthful matching purchase evidence.

OSR16 Sirup Repack:
VARIABLE_COST + HPP_COST_POOL_OR_UNRESOLVED_PACKAGE

Preserve the Sirup Repack label.
Do not assume 750 ml.
Do not fabricate flavor/component allocation.
Cost may be recorded even when component allocation remains undefined.

CodeGraph:
Trace ExpenseItems, current routing registry, transaction-entry selectors,
Phase 11V.9 Buy & receive UI, InventoryReceipts, InventoryLedger,
conversion authority, COGSIngredients, InventoryItems, historical tabops,
and Finance P&L consumers.

Requirements:

1. Create a new immutable/versioned prospective Expense policy registry.

The registry must provide, per ExpenseID:
- CostType
- PurchaseRelationship
- operator-facing label authority
- linked InventoryItem(s), where approved
- prospective eligibility
- effective-state metadata as consistent with existing registry patterns.

Do not change historical ExpenseItems identities.

2. CostType values:
- FIXED_COST
- VARIABLE_COST
- OTHER_HOLD

PurchaseRelationship values must include:
- NONE
- NON_HPP_VARIABLE_COST
- DIRECT_HPP_COMPONENT
- HPP_COST_POOL
- DIRECT_HPP_COMPONENT_PACKAGE_UNRESOLVED
- HPP_COST_POOL_PACKAGE_UNRESOLVED

Use the smallest consistent model needed.

3. Operator-facing labels

ExpenseItems.Item remains the canonical UI label.

Do not replace labels with InventoryItems or COGS component names.

4. Prospective Expense selector

New Transaction should ultimately expose:
- Sales
- Expense

Remove Buy & receive as a top-level operator transaction choice.

Expense mode:
- Cost Type: Fixed Cost / Variable Cost
- Item filtered by approved cost type.

OTHER_HOLD items must not appear in normal Fixed/Variable selectors.

MTain Upgrade must be hidden from normal prospective Expense entry until a
future OTHER/CAPEX workflow is explicitly implemented.

5. FIXED_COST behavior

Fields:
- date
- item
- nominal
- normal description/reference fields already supported.

Persistence:
- tabops only.

No inventory/purchase receipt fields.

6. VARIABLE_COST + NON_HPP_VARIABLE_COST behavior

Applies to:
- Gas
- Kelontong
- MTain Repair
- Event

Fields:
- normal Expense fields only.

No InventoryItem requirement.
No conversion requirement.
No receipt requirement.

Persistence:
- tabops only.

7. VARIABLE_COST + DIRECT_HPP_COMPONENT behavior

Use the operator-facing Expense label as the purchase identity.

Conditionally expose:
- actual received quantity
- purchase UOM/package
- total acquisition cost
- supplier/source
- evidence/reference or explicit unavailable declaration
- attestation
- receipt date if different from Expense date.

Do not expose InventoryItem identity to operator.

Backend may bind the approved internal component mapping.

8. VARIABLE_COST + HPP_COST_POOL behavior

Use one operator-facing purchase event.

Examples:
- Kopi Biji Ar
- Kopi Bubuk
- Teh Bubuk

Do not require operator to select underlying HPP components.

Do not create multiple component receipt rows unless explicit allocation
authority exists.

Use:
COST_POOL_ALLOCATION_UNDEFINED

as the normal state until future evidence provides an exact allocation.

Do not fabricate:
- equal split
- recipe-ratio split
- package-size split
- historical-price split
- HPP-price split.

9. Sirup flavors

Preserve each flavor label independently.

Each flavor may link internally to generic ING-017 only as an approved HPP
relationship.

Do not aggregate purchase costs across flavors.

Do not infer that the existing generic 750 ml conversion applies to every flavor
unless matching package evidence is present.

If quantity/package authority is absent, preserve purchase cost without
fabricated quantity normalization.

10. Sirup Repack

Keep as its own purchase identity.

Support cost capture with unresolved package/component allocation.

Do not map automatically to a 750 ml bottle.
Do not infer flavor contents.

11. Purchase-event persistence

Introduce the minimum prospective transaction store needed to represent
business-label purchase events that cannot truthfully fit a component-specific
InventoryReceipt.

Prefer a dedicated append-only PurchaseEvents store rather than creating a new
operator-facing purchase-item master.

Define schema and lifecycle consistent with existing receipt architecture.

It must preserve:
- EventID
- ExpenseID
- business label snapshot
- policy revision
- cost type
- purchase relationship
- date
- quantity/UOM where truthful
- total acquisition cost
- supplier/source
- evidence
- attestation
- allocation status
- request identity
- lifecycle/recovery metadata
- audit fields.

Do not migrate production schema in this task.

12. Expense vs purchase recognition

Critical rule:

FIXED_COST
-> tabops only

VARIABLE_COST + NON_HPP_VARIABLE_COST
-> tabops only

VARIABLE_COST + production-linked purchase
-> do NOT automatically write tabops yet.

Reason:
current P&L COGS authority remains tabsal.Qty × tabsal.HPP and automatic tabops
purchase recognition could double-count operating cost.

Production-linked purchase event persistence must remain operational/non-P&L
until a later explicit accounting cutover.

13. InventoryReceipts

Keep InventoryReceipts for truthful single-component receipt facts.

Use it only when:
- relationship is DIRECT_HPP_COMPONENT
- mapping is approved
- quantity/package conversion is authoritative
- purchase evidence supports the conversion.

Do not force a receipt row when quantity/package cannot be truthfully derived.

14. InventoryLedger

Remain internal prospective operational tracking only.

No component movement for:
- cost pools without allocation
- non-HPP variable costs
- unresolved sirup package
- unresolved purchase quantity.

15. Request identity and recovery

Reuse Phase 11V.9:
- stable request key
- double-submit protection
- frozen normalized payload
- conflict detection
- reload/session recovery
- WRITE_UNCERTAIN handling.

Extend recovery contract so one business intent can safely cover:
- PurchaseEvent persistence
- optional InventoryReceipt persistence
- optional InventoryLedger movement.

No duplicate purchase intent.

16. Historical preservation

Historical tabops remains unchanged.

All historical ExpenseItem labels must continue resolving.

Do not reclassify historical P&L.

CostType/purchase relationship is prospective management authority only.

17. UI revision

Revise the provisional Phase 11V.9 surface:

REMOVE top-level:
- Buy & receive

KEEP top-level:
- Sales
- Expense

Expense:
- Fixed Cost / Variable Cost
- operator-facing ExpenseItem label

Show purchase-specific controls conditionally only for production-linked
Variable Cost items.

Hide:
- InventoryItem selector
- component IDs
- conversion IDs
- cost-pool mechanics
- allocation status
- internal ledger identity.

18. Historical transaction projection

Purchase-linked future events may appear as Expense-context operational records
using their business label, but must not be counted in current Expense financial
totals until accounting authority changes.

Avoid presenting them as a second financial Expense if no tabops row exists.

19. COGS authority

Preserve:
tabsal.Qty × tabsal.HPP

No automatic COGS replacement.
No recipe consumption.
No BalanceLedger posting.
No Account1100 mutation.
No cash/AP inference.
No plugs.

20. No opening or stock-opname dependency.

21. Production activation remains DISABLED.

22. Local implementation only.

No production business-data mutation.
No production schema migration.
No clasp push.
No deployment.
No Git commit/push.

Required validation:

- registry covers 34/34 ExpenseItems
- exactly 5 FIXED_COST
- exactly 28 VARIABLE_COST
- exactly 1 OTHER_HOLD
- operator labels preserved
- Salary fixed
- Event variable non-HPP
- Upgrade hidden/hold
- Kelontong variable non-HPP
- Kopi Biji Ar pool with two components
- Kopi Bubuk pool with two components
- Teh Bubuk pool with three components
- Kopi Biji Ro -> Robusta
- Susu Diamond -> UHT
- Susu Omela -> SKM
- sirup flavor labels preserved
- no cross-flavor purchase-cost pooling
- Sirup Repack unresolved package/allocation
- Sales regression
- fixed Expense tabops synthetic persistence
- variable non-HPP tabops synthetic persistence
- production-linked variable does NOT write tabops
- direct component purchase event synthetic persistence
- cost-pool event synthetic persistence
- no fabricated component allocations
- conditional purchase form behavior
- no top-level Buy & receive
- no visible InventoryItem selector
- stable request identity
- recovery semantics
- historical blocked/legacy labels still render
- receipt/list financial exclusion
- COGS unchanged
- recipe consumption disabled
- activation disabled.

Run focused policy/orchestration/frontend tests and relevant regressions.

Output only:
PASS/BLOCKED — Finance Phase 11V.12 Expense Cost-Type and Purchase Policy Implementation

- policy version:
- ExpenseItems covered:
- FIXED_COST count:
- VARIABLE_COST count:
- OTHER_HOLD count:
- fixed IDs:
- variable non-HPP IDs:
- direct-HPP IDs:
- HPP cost-pool IDs:
- package-unresolved IDs:
- OTHER_HOLD IDs:
- operator label authority:
- InventoryItems role:
- PurchaseEvents foundation:
- InventoryReceipts role:
- InventoryLedger role:
- Expense persistence:
- production-linked purchase persistence:
- tabops behavior:
- UI transaction choices:
- Expense cost-type selector:
- fixed-cost UX:
- variable-cost UX:
- conditional purchase fields:
- InventoryItem visibility:
- pool allocation:
- sirup behavior:
- Upgrade behavior:
- historical resolution:
- financial totals:
- COGS:
- recipe consumption:
- opening dependency:
- activation:
- focused validation:
- regressions:
- production mutation:
- source changes:
- clasp push:
- deployment:
- Git:
- Phase 11V.12 status:
- blocker:
- Next: