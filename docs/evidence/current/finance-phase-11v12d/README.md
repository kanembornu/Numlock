# Phase 11V.12D — Integrated browser and runtime acceptance

Status: BLOCKED. No application source changes.

## Browser method and results

Actual local Google Chrome via Playwright, desktop 1440×1000 and narrow 390×844, rendering the current assembled HtmlService frontend. Browser RPC requests call the current shared canonical dispatcher with synthetic sheet, PurchaseEvents, receipt and movement adapters. External browser requests are intercepted; CDN fonts/icons are unavailable in these screenshots, so missing icon glyphs are a fixture limitation, not an application defect.

Browser launch required execution outside the OS sandbox. The first functional attempt exposed a synthetic UUID collision in the reusable fixture; the browser harness now supplies random UUIDs and completed successfully as a test run. Acceptance assertions still report the functional blockers below.

Passed: Sales/Expense choices; Fixed/Variable selectors; 5 Fixed and 28 Variable choices; Upgrade absent; Salary ordinary fields/routing; Kelontong and Gas ordinary fields/routing; Gula, Lemon and Susu Diamond conditional purchase controls and labels; Kopi Bubuk and Teh Bubuk business identities without component/allocation controls; Blue Citrus, Caramel and Repack as separate cost events; duplicate protection, frozen key/payload, reopen/reload recovery, mocked CONFLICT, actual synthetic WRITE_UNCERTAIN after event persistence and deterministic resume; all 34 historical labels; financial Expense exclusion; hold refused; no browser page errors.

Final synthetic counts: 3 tabops business rows, 10 PurchaseEvents, 0 InventoryReceipts, 0 InventoryLedger movements. These are local in-memory effects only. The UI does not submit explicit conversion authority; none was fabricated by the adapter. Production write count from acceptance is zero; no live preservation snapshot was taken or claimed.

## Acceptance blockers

1. Unsupported package refusal: Gula with quantity 1 and UOM `unsupported-package` is accepted as a cost-only PurchaseEvent. Receipt/movement counts remain zero. This preserves the 12A cost-capture boundary but does not satisfy 12D's explicit unsupported-package refusal criterion. Do not report receipt non-creation as submission refusal.
2. PurchaseEvent history integration: the standalone DTO preserves BusinessLabel and financialTotalsIncluded=false, but `getTransactionsPeriodRows` does not call the PurchaseEvents reader. `filterTransactionsPeriodRows` drops PurchaseEvent types. The existing renderer does not recognize PurchaseEvent or display its item label when directly given the DTO. This is incomplete read-model integration, not a CSS/layout issue.
3. Authenticated Apps Script runtime: exactly one `clasp run testExpensePurchasePolicyContracts` returned storage NOT_FOUND before startup. No retry or upload followed. Local browser/synthetic runtime fallback completed; authenticated runtime acceptance remains unverified. See runtime.log.

No behavior-changing patch was applied: the task permits only concrete usability/layout patches, and these blockers require routing/read-model decisions or authenticated runtime access. No redesign or production activation occurred.

## Screenshot review

Captured and visually inspected:
- fixed.png — Salary, Fixed Cost, ordinary amount/date fields.
- non-hpp.png — Kelontong, Variable Cost, ordinary amount/date fields.
- direct-hpp.png — Gula with purchase controls and unsupported UOM test input. Captured while the edited UOM retained focus, before its onchange/blur validation cleared the earlier paired-field message.
- cost-pool.png — Kopi Bubuk, single business identity, no component/allocation UI.
- narrow.png — narrow purchase modal, contained horizontally with fixed submit area and scrollable content.

No demonstrated layout defect required a source patch. Screenshot files are local fixture evidence, not production browser acceptance.

## Validation boundary

Command: `node docs/evidence/finance-phase-11v12d/browser.cjs` (outside sandbox for Chrome). Results are in results.json and browser.log. A completed harness process is not overall acceptance PASS: three explicit acceptance assertions are BLOCKED.

The final integrated regression gate was not run: the requested prerequisite, browser/runtime acceptance PASS, was not satisfied. `node --check docs/evidence/finance-phase-11v12d/browser.cjs`, `git diff --check` and final worktree-status inspection passed.

Activation remains disabled. No production business writes, accounting/cash mutation, clasp push, deployment, staging, commit or push. Earlier application worktree changes were preserved. Added files are confined to this evidence directory: README.md, runtime.log, browser.cjs, browser.log, results.json and five PNG screenshots.

Recommended Git commands: None.

Next: resolve the unsupported-package acceptance boundary and authorize the narrow PurchaseEvent history integration; obtain authenticated runtime evidence against reviewed current source. Rerun acceptance, then execute the relevant integrated gate once after PASS.
