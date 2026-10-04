# NUMLOCK Finance Final Baseline

Status: COMPLETE. Recorded 2026-10-04.

## Canonical Production

- Final canonical version: **@693** — "Transactions initialization and Finance Final Baseline closeout"
- Deployment ID: AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q (stable across @690→@691→@692→@693)
- Active deployments: exactly @HEAD + canonical @693
- Version history this arc: @690 Stage 3 production → @691 Transactions PaymentStatus compatibility repair → @692 Finance Final Baseline UI contract repair (nav + Policy C statement + currency) → @693 Transactions initialization readiness + closeout

## Repository Baseline

- HEAD before evidence commit: a9e8b0cc0747cc59727704841ab45b9b14777970
- Six domain baseline commits: 4a25ef1 finance-policy-c-and-finance-ui-baseline; fcc886e inventory-purchaseevent-policy-and-paymentstatus-baseline; b5bcda6 stage3-fluid-desktop-production-baseline; 9b38e53 release-evidence-documentation-baseline; fb3d429 opencode-control-plane-baseline; a9e8b0c products-domain-contract-baseline
- Closeout commit (this artifact + repairs): finance-final-baseline-closeout (created downstream after this file)
- origin/main: ahead 48 pre-closeout; not pushed (push requires separate authorization)

## Finance Capability Map (20 capabilities, summary)

COMPLETE: accounting foundation, Chart of Accounts, journal/posting, finance summary, P&L legacy, split-period reporting, depreciation, inventory policy evidence, transactions read model, production validator. COMPLETE_WITH_HISTORICAL_EXCEPTION: balance foundation, cash flow, capital/equity, PurchaseEvent legacy reads. PROSPECTIVE_ONLY: P&L prospective (purchase-expense), InventoryReceipt. DEFERRED: InventoryLedger (non-authoritative for Finance v1). BLOCKED: historical inventory monetary opening (documentary evidence gate).

## Accounting Authority (summary matrix)

- Revenue: canonical Sales + Product revenue mapping; combined across split regimes allowed
- COGS: tabsal.HPP legacy authority; prospective HPP = non-posting analytics; unit Standard Cost = COGSIngredients.PurchaseCost / UsableQty per BaseUOM (Products read-model authority; RecipeStandardCost = separate write-path proposal contract)
- Gross Profit: revenue − COGS where comparable; prospective/split → null (not like-for-like)
- Operating Expense: Expense transactions + prospective 6210 material purchases
- Net Profit: derived; prospective formula revenue − purchases/opex/depreciation; split = sum of regime sections
- Cash: BalanceLedger 1000/1010/1020 + settlements; AP: account 2000 (UNPAID + settlement only, no legacy inference)
- Capital/Equity: CapitalEquity migrated authority (immutable; MUST NOT rerun)
- Depreciation: DepreciationLedger authoritative; continuation append-only
- Inventory: BalanceLedger 1100 only where evidenced; prospective inventory OMITTED_UNPROVEN (null, not zero)
- PurchaseEvent: append-only; pre-transition Dr 1100 / prospective Dr 6210; Cr cash (PAID) or 2000 (UNPAID)
- InventoryReceipt: operational only — no independent accounting posting; duplicate purchase representation suppressed
- Historical snapshots: canonical tabsal/tabops frozen; regime selected by economic date, never CreatedAt

## Policy C Contract

- Transition date: 2026-10-01 (economic date selects regime; CreatedAt cannot)
- Legacy (pre): revenue/COGS/GP/expenses/depreciation/net profit available
- Prospective (post): materials → 6210 expense; cogs=null; grossProfit=null; inventoryBookValue=null (OMITTED_UNPROVEN)
- Split-period: combined cogs/GP/materialPurchasesExpensed/operating margin = null (NOT accounting zero); net profit = legacy-section + prospective-section
- UI obligation: display unavailability, never coerce null → accounting zero (production-proven @692/@693)
- Local harness: 30/30 PASS (MEASURED, stable across sessions)

## PurchaseEvent Contract

- 29-column schema current (PaymentStatus, CashAccountCode, SupplierID, AccountingStatus among them)
- Migration complete — NEVER rerun; PRODUCTION_MIGRATION_INVOCATIONS = 0 throughout this arc
- Current writes: strict PaymentStatus (PAID requires cash account; UNPAID requires supplier; invalid rejected)
- Legacy reads: missing PaymentStatus accepted via read-compatibility normalization only (normalizePurchaseEventHistoryRequest_); legacy rows = LEGACY_UNCLASSIFIED_NON_POSTABLE (no invented status; no row mutation)
- Idempotency: RequestKey/EventID/journal source identity; exact retry → ALREADY_APPLIED
- InventoryReceipt relationship: shared durable recovery identity; no second financial total

## Inventory / Finance Boundary

PurchaseEvent ACTIVE; Resolution ACTIVE (one-shot evidence enrichment); InventoryReceipt PROSPECTIVE/operationally guarded (finance posting prohibited); InventoryLedger READ-ONLY non-authoritative; BalanceLedger ACTIVE; historical monetary opening BLOCKED BY POLICY/evidence; prospective inventory not recognized.

## Backend Suite Triage (frozen evidence)

- 126 registered / 126 executed: 97 PASS / 29 FAIL
- Classification: A stale-test 23, B historical/deprecated 2, C deferred-Products 2, D harness-limitation 2, E 0, F Finance-relevant 0, G UNKNOWN 0
- Finance-relevant backend failures: 0. Suite red status is stale/historical/deferred — NOT accounting defects. Not repaired by instruction (separate hygiene scope).

## Finance Core + Production Validation

- Local Policy C harness: 30/30 PASS (MEASURED — finance core, P&L, cash flow, capital/equity, depreciation, Policy C, PurchaseEvent accounting, PaymentStatus compatibility, inventory-finance boundary)
- validateFinanceProductionRuntime: PASS @691, @692, @693 (5/5 cases: fullAvailablePeriod/populatedMonth/populatedYear/emptyPeriod/inclusiveCustomRange; unresolved mappings 0; quality counters 0; readOnly true)
- Data quality: CLEAN under current diagnostics (unresolved products/expense-items/inactive mappings/depreciation integrity all 0). KNOWN_HISTORICAL_NONPOSTABLE: capture cutover UNPROVEN; common reliable period not established.

## PaymentStatus Compatibility — CLOSED

- Root cause: LEGACY_PURCHASEEVENT_COMPATIBILITY_GAP (history read reused write normalizer; missing → "" → INVALID_PAYMENT_STATUS)
- Repair: read-compatibility boundary in 47.Purchase.Events.js; strict write path preserved
- Closure evidence: local CASE 1–8 PASS + service-level getTransactionsPage chain PASS; production @691 diagnostics (PurchaseEvents readable 9/6 active, unresolved 0); browser T6 PASS @692 and @693 (no INVALID_PAYMENT_STATUS)

## Transactions Defect History

- @691: navigation inaccessible (class G listener-ownership) — section hidden despite populated deferred data (1257 rows in hidden DOM); data path worked
- @692: nav CLOSED (direct onclick repair) — EXPOSED pre-existing initialization-ordering defect: static placeholder "Visible recent transactions" + "Showing 0–0 of 0" could present as terminal when user opened Transactions before dashboard-deferred renderTransactions initialized transactionsDateFilter
- @693: navigation + initialization CLOSED — idempotent ensureTransactionsReady (192) owned by first-show (190) and deferred path (198 via shared readiness); filter authority lastDashboardRequest→currentYear; token/stale guards preserved; loading semantics reused
- Production acceptance @693 (2/2 stable runs, MEASURED): TERMINAL_REACHED both; LOADING → LOADED_NONEMPTY; heading "Recent transactions"; "Showing 1–15 of 1257 transactions"; purchase rows 6 (= service-level 6 active); single request (requestSequence 1); pendingKey cleared; no INVALID_PAYMENT_STATUS; zero page/console errors

## Finance UI Defect History

- @691: Policy C statement false-zero (statement rows rendered Rp 0 for null COGS/GP while summary KPIs correctly showed unavailable) + currency format anomaly (-Rp ASCII minus)
- @692: CLOSED — statement renderer null-check before formatting (reuses summary unavailable marker); numeric 0 still renders Rp 0; formatFinanceCurrency negative → −Rp U+2212
- Production acceptance @692 and @693 (2 runs each, MEASURED): F1–F9 ALL PASS; F4 exact: summary + statement COGS/GP = "Not available under purchase-expense accounting"; falseZeroGross=[]; F5: −Rp 9.341.454, no malformed negatives

## Finance v1 Boundaries

GUARANTEED NOW: Policy C transition/economic-date regime; strict PaymentStatus writes; PAID→cash / UNPAID→AP 2000; prospective materials→6210; legacy→1100; prospective HPP non-posting; idempotent journals; backend null semantics; Transactions nav+readiness terminal-state; Finance UI Policy C statement semantics; migrations untouched (0)

PROSPECTIVE ONLY: purchase-expense regime; AP create/settlement from current events; split-period reporting; InventoryReceipt ops (gated)

HISTORICAL EXCEPTIONS: legacy non-postable PurchaseEvents; unproven monetary opening; migrated C&E authority; cash opening may be null; Phase 3E 106/106 = v676 historical (current source identity not proven — @693 browser acceptance supersedes for current UI); suite 97/29 triaged

DEFERRED TO OPERATIONS: monetary-opening documentary evidence; tabops dictionary/overlap evidence; InventoryReceipt production activation; stale-suite hygiene (23 A-class); browser probe tooling retention

NOT IN FINANCE V1: invented balances/plugs; fabricated prospective COGS/GP; automatic recipe consumption; unproven inventory recognition; legacy payment inference; migration reruns; production mutation from diagnostics; period-close workflow; historical backfill without authorization

## Safety Record

- PRODUCTION_MIGRATION_INVOCATIONS = 0 (PurchaseEvent, InventoryOpening, CapitalEquity, schema — none rerun)
- Production business-data writes caused by validation: 0
- Deployment ID stable; no new permanent Web App; no staging deployments
- Delivery counts consumed this arc: @691 push/version/update 1/1/1; @692 push/version/update 1/1/1; @693 push/version/update 1/1/1
- Historical references to @689/@690/v585/v587/v676 in prior evidence remain historically correct — not rewritten

## Evidence Provenance

- Local: Policy C harness 30/30 (MEASURED, repeated); VM race/idempotency CASE 1–10 PASS; extracted-JS parse PASS
- Production runtime: validateFinanceProductionRuntime + runInventoryPolicyEvidenceDiagnostic (MEASURED @691/@692/@693, read-only, counters 0)
- Browser: finance-final-baseline-acceptance.js MEASURED runs — @691 (pre-repair FAIL baseline), @692 (Finance PASS + Transactions init defect), @693 (2/2 stable full PASS). Tool: tests/browser/finance-final-baseline-acceptance.js (durable). Diagnostic: tests/browser/transactions-period-probe.js (durable acceptance diagnostic).
- Upload surface: byte-audited 90-file manifests before each delivery; effective deltas = exactly authorized files; Products test-file delta isolated (byte-preserving backup/substitute/restore, SHA-verified) each delivery.
