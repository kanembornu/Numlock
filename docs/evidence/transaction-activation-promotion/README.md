# Transaction Activation Promotion Attempt

Status: ACCEPTANCE_FAILED. Recorded 2026-10-06.

## Scope and identity

- Task: `NUMLOCK-G14-PROMOTION-20261006-C`
- Source HEAD: `b0e3d38b97f8905c71c9c7bd50ea4d0bcf97968e`
- Candidate version: 700
- Previous canonical version: 693
- Canonical deployment: `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q`
- Promotion result: `Redeployed AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q @700`
- Canonical URL returned HTTP 200 after promotion.
- Owner-text ID omitted the `_` after `Asy`. Two independent fresh inventories identified exactly one canonical @693 deployment with the `_`. Corrected owner authorization resolved the transcription variance in favor of that live-inventory ID.

## Evidence classification

### MEASURED in this task

- Baseline and pre-mutation inventory: seven deployments; corrected canonical ID @693; candidate ID @700; @HEAD present.
- Worktree: clean at baseline.
- Pre-promotion diagnostic: `readOnly=true`; `writeCount=0`; ProductVariants=53; RecipeVersions=53; RecipeVersionLines=410; Orders=0; OrderLines=0; Payments=0; TransactionOperations=0; Suppliers absent with `READY_CREATE`; Finance preimage, operation persistence, purchase and expense readiness true.
- Manifest gate: `clasp status`; 62 tracked production files, including `appsscript.json`; no diagnostic runner/endpoint, temporary evidence, or secret in upload set. No push performed.
- Promotion: one canonical deployment update, 693 to 700. No deployment creation.
- Pin verification: same canonical deployment ID @700. Canonical URL HTTP 200.
- Canonical Gate 13 probe: committed `tests/browser/transaction-entry-v697-probe.js`, unmodified.
  - Probe RPC: `SUCCESS_TRUE`
  - Authority counts: products=34, productVariants=53, suppliers=0, purchaseItems=20, expenseItems=9, items=22, conversions=22, paymentMethods=3
  - Application authority applied: false
  - Browser classification: `PROBE_RPC_SUCCESS_APPLICATION_NOT_APPLIED`
  - Assertions: A PASS; B PASS; C NOT_MEASURABLE; D NOT_MEASURABLE; E NOT_MEASURABLE; F FAIL; G FAIL; H FAIL; I FAIL; J FAIL; K PASS; L PASS
  - Totals: 12 total, 4 PASS, 5 FAIL, 3 NOT_MEASURABLE
  - Page errors: []
  - Console errors: []
- Production business writes: 0.
- Supplier writes: 0.
- Inventory writes: 0.
- Canonical deployment mutations: 1.
- Clasp pushes, new versions, new deployments: 0.

### FROZEN prior evidence

- Candidate Gate 13: 12/0/0, `SUCCESS_TRUE`, Transaction 8/8, Finance 9/9.
- Version 700 creation and prior 62-file push from source HEAD were supplied frozen evidence; not repeated.

### STATIC / CONSOLIDATED

- Gate numbering: repository has no numbered `GATE_1..14` ladder. `docs/roadmaps/NUMLOCK-IMPLEMENTATION-ROADMAP.md` defines 14 phases plus Acceptance Gates. Task Gate 13 approximates roadmap Phase 12 E2E plus Phase 13 preflight inputs. Task Gate 14 approximates roadmap Phase 13 Production Rollout.
- Role/Permission: `SUPERSEDED_NOT_REQUIRED`; no RBAC.

## Stop and preservation

Canonical acceptance failed. Per hard stop: Transaction runtime, Finance runtime, smoke, client repair marker checks, post-promotion preflight, and all deployment cleanup were not run. Canonical remains @700. Candidate and @696-@699 remain. No retry, source repair, second canonical update, deletion, push, version, or deployment occurred.

## Verdict

- Result: `ACCEPTANCE_FAILED`
- Gate 14: FAIL
- Transaction activation: INCOMPLETE
- Ready for normal operation: FALSE
- Scope remains Transaction Activation/Production Rollout only. Supplier activation remains separately governed. InventoryReceipt/Ledger remain dormant. No RBAC.

## Corrected-measurement closeout

Status: ACCEPTED. Recorded 2026-10-06. The original acceptance record above remains chronological evidence; its verdict is `SUPERSEDED_BY_CORRECTED_MEASUREMENT`, not erased or rewritten.

### MEASURED closeout evidence

- Lineage: baseline/evidence HEAD `ef9fc6e828c1bb49a7d2d21121807efe797848bc`; probe-repair commit `0852b8a9a3bf1eada5e7bd37b57a4a3945fa8ac4`.
- Probe sequencing repair validation: 12/12 focused contract checks; syntax and diff checks passed. Application observation now terminates independently at READY with applied authority, explicit UNAVAILABLE with reason, or the established 90-second timeout.
- Pre-reacceptance production diagnostic: `readOnly=true`; `writeCount=0`; Orders=0; OrderLines=0; Payments=0; TransactionOperations=0; schema plan `ALREADY_READY`; ProductVariants=53; RecipeVersions=53; RecipeVersionLines=410; Suppliers absent with `READY_CREATE`.
- Corrected canonical Gate 13 acceptance against canonical @700:
  - Probe RPC: `SUCCESS_TRUE`; independent probe latency 4423 ms.
  - Application terminal: `READY`; authority applied true; independent application-ready latency 6158 ms; reason null.
  - Authority counts: products=34, productVariants=53, suppliers=0, purchaseItems=20, expenseItems=9, items=22, conversions=22, paymentMethods=3.
  - Assertions A-L: 12 PASS, 0 FAIL, 0 NOT_MEASURABLE. C/D/E measured through the active Sales path.
  - Page errors: []; console errors: [].
- Canonical runtime: Transaction 8/8 PASS; Finance 9/9 PASS; smoke PASS. Served repair markers remained present through corrected Gate 13 client execution.
- Post-acceptance production diagnostic: `readOnly=true`; `writeCount=0`; Orders=0; OrderLines=0; Payments=0; TransactionOperations=0; no business, Supplier, or Inventory writes.
- Deployment cleanup: deployment objects @696, @697, @698, @699, then candidate @700 deleted once each. Versions were not deleted.
- Final deployment inventory: exactly canonical deployment `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` @700 and @HEAD deployment `AKfycbyK_7u3OT3tBNVeqEnRwI6sz7GIPlht6hFht8wYp7A`.

### FROZEN and diagnostic evidence

- FROZEN: original candidate v700 acceptance remains 12/0/0 with `SUCCESS_TRUE`, Transaction 8/8, and Finance 9/9.
- FROZEN: original canonical acceptance failure remains recorded above as 4 PASS, 5 FAIL, 3 NOT_MEASURABLE with probe success but application-not-applied observation.
- DIAGNOSTIC: `MEASUREMENT_WINDOW_RACE_CONFIRMED` at high confidence. Served-client parity matched with FNV `a7c19f25`; candidate and canonical each reached READY 3/3 under one alternating harness; application RPC dispatched and succeeded 3/3 for each; no stable deployment-context divergence existed.
- `SOURCE_REPAIR_REQUIRED=NO`.
- `DEPLOYMENT_REPAIR_REQUIRED=NO`.
- `PROBE_REPAIR_REQUIRED=YES_COMPLETED`.
- Measurement was repaired, not the application.
- Gate-numbering offset remains as documented above. Role/Permission remains `SUPERSEDED_NOT_REQUIRED`.

### Final closeout verdict

- Gate 13 canonical: PASS.
- Gate 14: PASS.
- Transaction activation: COMPLETE.
- Ready for normal operation: TRUE.
