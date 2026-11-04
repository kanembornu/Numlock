# NUMLOCK Dependency Map

**Audit Date:** 2026-11-05
**Scope:** Complete repository dependency analysis

---

## 1. Google Apps Script Runtime Dependencies

### 1.1 Entry Points

| Entry Point | File | Trigger | Description |
|-------------|------|---------|-------------|
| `doGet(e)` | 100.Code.js:124 | Web App GET | Main web app entry; renders 190.View.Index.html |
| `include(filename)` | 100.Code.js:11 | Template | Server-side HTML partial inclusion |
| `runAllBackendTests()` | 98.Tests.Runner.js:146 | clasp run / menu | Executes all backend test suites |
| `runAllBackendTestsDiagnostic()` | 98.Tests.Runner.js:199 | clasp run / menu | Diagnostic test run with details |
| `getDashboardData()` | 90.Dashboard.Service.js:26 | google.script.run | Dashboard data API |
| `getTransactionsPage()` | 91.Transactions.Query.js | google.script.run | Transactions pagination API |
| `getCanonicalTransactionDetails()` | 22.Transaction.Lifecycle.js:188 | google.script.run | Transaction detail prefetch |
| `getTransactionsExport()` | 91.Transactions.Query.js | google.script.run | CSV export API |
| `getProductCatalogReadModel()` | 92.Products.Domain.js:186 | google.script.run | Product catalog API |
| `getInventoryItemsReadModel()` | 92.Products.Domain.js:211 | google.script.run | Inventory items API |
| `getCogsRecipeReadModel()` | 92.Products.Domain.js:302 | google.script.run | COGS recipe API |
| `diagnoseCogsRecipeRuntime()` | 92.Products.Domain.js:324 | google.script.run | COGS diagnostic API |
| `getProductProfitabilityData()` | 36.Finance.Service.js | google.script.run | Finance: product profitability |
| `getPartialBalanceData()` | 36.Finance.Service.js:661 | google.script.run | Finance: balance sheet |
| `getDepreciationData()` | 37.Depreciation.Service.js:54 | google.script.run | Finance: depreciation |
| `getAssetsReadModel()` | 37.Depreciation.Service.js:29 | google.script.run | Finance: asset register |
| `getCashFlowData()` | 36.Finance.Service.js:156 | google.script.run | Finance: cash flow |
| `getTreasuryOperatorWorkspace()` | 99D.Treasury.Operator.Api.js:142 | google.script.run | Treasury operator workspace |
| `getTreasuryOperatorReceiptDetail()` | 99D.Treasury.Operator.Api.js:171 | google.script.run | Treasury receipt detail |
| `getTransactionEntryOptions()` | 21.Transaction.Entry.js:245 | google.script.run | Transaction entry options |
| `getProductEntryPricing()` | 21.Transaction.Entry.js:274 | google.script.run | Product pricing lookup |
| `submitCanonicalTransaction()` | 21.Transaction.Entry.js:343 | google.script.run | Canonical transaction submit |
| `submitOperationalOrder()` | 95A.Transaction.Production.js:383 | google.script.run | Operational order submit |
| `submitOperationalFulfillment()` | 95A.Transaction.Production.js:401 | google.script.run | Operational fulfillment |
| `submitOperationalPayment()` | 95A.Transaction.Production.js:402 | google.script.run | Operational payment |
| `submitOperationalPurchase()` | 95A.Transaction.Production.js:418 | google.script.run | Operational purchase |
| `submitOperationalExpense()` | 95A.Transaction.Production.js:551 | google.script.run | Operational expense |
| `lookupPurchaseEventStatus()` | 47.Purchase.Events.js | google.script.run | Purchase event status |
| `getTreasuryClearingProjection()` | 99B.Treasury.Clearing.Projection.js:1332 | google.script.run | Treasury clearing projection |
| `getTreasuryClearingExposure()` | 99B.Treasury.Clearing.Projection.js:1337 | google.script.run | Treasury clearing exposure |
| `runApplyRecipeStandardCost()` | 100.Code.js:39 | Manual (disabled) | Admin: recipe standard cost |
| `diagnoseCapitalEquityRuntime_()` | 100.Code.js:51 | Manual | Capital equity diagnostic |
| `runCashFoundationSchemaMigration()` | 40.Cash.Foundation.js:990 | Manual | Cash schema migration |
| `runCashFoundationSchemaRecovery()` | 40.Cash.Foundation.js:1007 | Manual | Cash schema recovery |
| `runCashSettleAndPersist()` | 40.Cash.Foundation.js:1216 | Manual | Cash settlement |
| `runCashFoundationDisposableRuntimeProof()` | 40.Cash.Foundation.js:1532 | Manual | Cash runtime proof |
| `runCashProductionDiagnostic()` | 40.Cash.Foundation.js:1553 | Manual | Cash diagnostic |
| `runTransactionSchemaActivation()` | 95A.Transaction.Production.js:602 | Manual | Transaction schema activation |
| `runProductVariantProductionBootstrap()` | 95A.Transaction.Production.js:650 | Manual | Product variant bootstrap |
| `runRecipeVersionProductionBootstrap()` | 95A.Transaction.Production.js:689 | Manual | Recipe version bootstrap |
| `runDepreciationContinuation()` | 37.Depreciation.Service.js:521 | Manual | Depreciation continuation |
| `runDepreciationContinuationDryRun()` | 37.Depreciation.Service.js:530 | Manual | Depreciation dry run |
| `runInventoryReceiptDisposableRuntimeProof()` | 97.Inventory.Receipt.Runtime.Proof.js:65 | Manual | Inventory runtime proof |
| `runInventoryReceiptOperationalRuntimeProof()` | 97.Inventory.Receipt.Operational.Runtime.Proof.js | Manual | Operational runtime proof |
| `runInventoryConversionCandidateDisposableRuntimeProof()` | 40.Inventory.Conversion.Population.js:311 | Manual | Conversion runtime proof |

### 1.2 Cross-File Function References (Static)

| Caller | Callee | Type |
|--------|--------|------|
| 100.Code.js | 90.Dashboard.Service.getDashboardData | Direct |
| 100.Code.js | 91.Transactions.Query.getTransactionsPage | Direct |
| 100.Code.js | 91.Transactions.Query.getTransactionsExport | Direct |
| 100.Code.js | 92.Products.Domain.getCogsRecipeReadModel | Direct |
| 100.Code.js | 92.Products.Domain.diagnoseCogsRecipeRuntime | Direct |
| 100.Code.js | 36.Finance.Service.getFinanceData | Direct |
| 100.Code.js | 37.Depreciation.Service.getDepreciationData | Direct |
| 100.Code.js | 38.CapitalEquity.Service | Direct |
| 100.Code.js | 39.Balance.Foundation | Direct |
| 100.Code.js | 40.Cash.Foundation | Direct |
| 100.Code.js | 99.Treasury.Receipt.Foundation | Direct |
| 100.Code.js | 99A.Treasury.Receipt.Durable.Save | Direct |
| 100.Code.js | 99B.Treasury.Clearing.Projection | Direct |
| 100.Code.js | 99C.Treasury.Receipt.Reversal.Correction | Direct |
| 100.Code.js | 99D.Treasury.Operator.Api | Direct |
| 21.Transaction.Entry | 20.Data.Source.readCanonicalTable | Direct |
| 21.Transaction.Entry | 25.Data.Processor.processTransactions | Direct |
| 22.Transaction.Lifecycle | 20.Data.Source.getCanonicalTransactionData | Direct |
| 22.Transaction.Lifecycle | 91.Transactions.Query | Direct |
| 30.Analytics.Aggregate | 20.Data.Source | Direct |
| 35.Analytics.Financial | 20.Data.Source | Direct |
| 36.Finance.Service | 20.Data.Source.readCanonicalTable | Direct |
| 36.Finance.Service | 37.Depreciation.Service.getDepreciationDataWithRuntime | Direct |
| 36.Finance.Service | 39.Balance.Foundation | Direct |
| 36.Finance.Service | 40.Cash.Foundation | Direct |
| 37.Depreciation.Service | 20.Data.Source | Direct |
| 37.Inventory.Policy.Evidence | 20.Data.Source | Direct |
| 38.CapitalEquity.Service | 20.Data.Source | Direct |
| 39.Balance.Foundation | 20.Data.Source | Direct |
| 39.Balance.Foundation | 37.Inventory.Policy.Evidence | Direct |
| 39.Balance.Foundation | 40.Cash.Foundation | Direct |
| 40.Cash.Foundation | 20.Data.Source | Direct |
| 40.Inventory.Conversion.Population | 20.Data.Source | Direct |
| 41.Inventory.Opening.Staging | 20.Data.Source | Direct |
| 42.Inventory.Receipt.Foundation | 20.Data.Source | Direct |
| 43.Inventory.Receipt.Migration | 20.Data.Source | Direct |
| 44.Inventory.Receipt.Operational | 20.Data.Source | Direct |
| 45.Inventory.Receipt.Orchestration | 42/43/44 Inventory Receipt modules | Direct |
| 46.Expense.Purchase.Policy | 20.Data.Source | Direct |
| 47.Purchase.Events | 20.Data.Source | Direct |
| 48.Purchase.Events.Migration | 47.Purchase.Events | Direct |
| 50.Analytics.Product | 20.Data.Source | Direct |
| 90.Dashboard.Service | 20.Data.Source | Direct |
| 90.Dashboard.Service | 30.Analytics.Aggregate | Direct |
| 90.Dashboard.Service | 35.Analytics.Financial | Direct |
| 90.Dashboard.Service | 50.Analytics.Product | Direct |
| 90.Dashboard.Service | 55.Analytics.Expense | Direct |
| 90.Dashboard.Service | 60-85 Intelligence modules | Direct |
| 91.Transactions.Query | 20.Data.Source | Direct |
| 92.Products.Domain | 20.Data.Source | Direct |
| 93.Master.WritePolicy | 20.Data.Source | Direct |
| 94.Supplier.Master | 20.Data.Source | Direct |
| 95.Transaction.Operational | 20.Data.Source | Direct |
| 95A.Transaction.Production | 20.Data.Source | Direct |
| 95A.Transaction.Production | 21.Transaction.Entry | Direct |
| 95A.Transaction.Production | 22.Transaction.Lifecycle | Direct |
| 95A.Transaction.Production | 95.Transaction.Operational | Direct |
| 97.SalesRecognition.V2.Foundation | 20.Data.Source | Direct |
| 97A.SalesRecognition.V2.Save | 97.SalesRecognition.V2.Foundation | Direct |
| 97B.SalesRecognition.V2.Projection | 97.SalesRecognition.V2.Foundation | Direct |
| 97C.SalesRecognition.V2.Correction | 97.SalesRecognition.V2.Foundation | Direct |
| 97D.SalesRecognition.V2.OperatorGuard | 97.SalesRecognition.V2.Foundation | Direct |
| 97E.SalesRecognition.V2.Activation | 97.SalesRecognition.V2.Foundation | Direct |
| 99.Treasury.Receipt.Foundation | 20.Data.Source | Direct |
| 99A.Treasury.Receipt.Durable.Save | 99.Treasury.Receipt.Foundation | Direct |
| 99B.Treasury.Clearing.Projection | 99.Treasury.Receipt.Foundation | Direct |
| 99C.Treasury.Receipt.Reversal.Correction | 99.Treasury.Receipt.Foundation | Direct |
| 99D.Treasury.Operator.Api | 99.Treasury.Receipt.Foundation | Direct |

### 1.3 Global Namespace Dependencies (Execution Order Matters)

Apps Script V8 loads files alphabetically. Critical initialization order:

1. **00.Project.Spec.js** — Constants, contracts (loaded first)
2. **10.Config.js** — Global config (RECIPE_STANDARD_COST_CONTRACT, CAPITAL_EQUITY_POLICY, etc.)
3. **20.Data.Source.js** — Data access primitives
4. **21-25 Transaction/Entry/Lifecycle** — Transaction layer
5. **30-55 Analytics** — Aggregation & financial analytics
6. **36-39 Finance/Depreciation/Capital/Balance** — Finance core
7. **40-45 Cash/Inventory** — Cash & inventory
8. **46-48 Expense/Purchase** — Purchase events
9. **50-85 Analytics/Intelligence** — Business intelligence
10. **90-95 Dashboard/Transactions/Products/Master** — Domain services
11. **97-99 Sales/Treasury** — Advanced domains
12. **100-102 Entry/Config/Transitional** — Web app & control

**Risk:** Files with numeric prefixes (00, 10, 20...) load before alphabetic (90, 91...). This is intentional for dependency ordering.

### 1.4 Dynamic/String-Based Invocation

| Pattern | Location | Risk |
|---------|----------|------|
| `google.script.run.withSuccessHandler(fn).functionName()` | 15 HTML files | Runtime only; not statically analyzable |
| `PropertiesService.getScriptProperties().getProperty('dispatchKey')` | Not found | Not used |
| `eval()` / `new Function()` | Not found | Not used |

---

## 2. Frontend Dependencies (HTML/JS/CSS)

### 2.1 HTML Template Inclusion Chain (190.View.Index.html)

```
190.View.Index.html (main entry)
├── 189.View.Tailwind.html (CSS - via <?!= include() ?>)
├── 197.View.Dashboard.Charts.html (charts partial)
├── 192.View.Transactions.State.html (transactions state)
├── 199.View.Finance.State.html (finance state)
├── 202.View.Treasury.State.html (treasury state)
├── 196.View.Dashboard.Render.html (dashboard render)
├── 194.View.Transactions.Forms.html (transaction forms)
├── 195.View.Transactions.Actions.html (transaction actions)
├── 191.View.Diagnostics.html (diagnostics)
├── 193.View.Transactions.Render.html (transactions render)
├── 200.View.Finance.Render.html (finance render)
├── 203.View.Treasury.Render.html (treasury render)
├── 198.View.Dashboard.Controller.html (dashboard controller)
├── 201.View.Finance.Controller.html (finance controller)
└── 204.View.Treasury.Controller.html (treasury controller)
```

### 2.2 Client-Side Module Dependencies (190.View.Index.html inline JS)

| Module | Dependencies | Exports |
|--------|--------------|---------|
| Theme System | localStorage, matchMedia | applyStoredThemeBeforeRender |
| Phone Detection | screen, navigator | isNumlockPhoneDevice |
| Dashboard Controller | Chart.js (CDN), FontAwesome (CDN) | render, getDashboardData |
| Transactions Controller | — | getTransactionsPage, getCanonicalTransactionDetails |
| Finance Controller | — | getProductProfitabilityData, getPartialBalanceData, getDepreciationData, getAssetsReadModel, getCashFlowData |
| Treasury Controller | — | getTreasuryOperatorWorkspace, getTreasuryOperatorReceiptDetail |
| Transaction Entry | — | getTransactionEntryOptions, getProductEntryPricing, submitCanonicalTransaction |
| Transaction Actions | — | submitOperationalOrder/Fulfillment/Payment/Purchase/Expense |
| COGS Recipe | — | getCogsRecipeReadModel, diagnoseCogsRecipeRuntime |
| Diagnostics | — | DOM measurement utilities |

### 2.3 External CDN Dependencies

| Resource | URL | Version | Used By |
|----------|-----|---------|---------|
| Chart.js | cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js | 4.5.1 | 196.View.Dashboard.Render.html, 197.View.Dashboard.Charts.html |
| Font Awesome | cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css | 6.0.0 | 190.View.Index.html (global) |

---

## 3. Build & Tooling Dependencies

### 3.1 NPM Scripts (package.json)

| Script | Command | Dependencies |
|--------|---------|--------------|
| `build:tailwind` | `tailwindcss -c tailwind.config.js -i assets/tailwind.input.css -o 189.View.Tailwind.html --minify` | tailwindcss@3.4.17 |

### 3.2 NPM Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| tailwindcss | 3.4.17 | CSS framework compilation |
| playwright | 1.62.1 | Browser testing (not used in CI) |

### 3.3 Build Artifacts

| Artifact | Source | Generated By | Deployed |
|----------|--------|--------------|----------|
| 189.View.Tailwind.html | assets/tailwind.input.css + tailwind.config.js | `npm run build:tailwind` | Yes (in .claspignore) |

### 3.4 Tooling Scripts Dependencies

| Script | Node Built-ins | External | Purpose |
|--------|---------------|----------|---------|
| preflight.js | fs, path, child_process | — | Permission policy validator |
| preflight.test.js | node:test, assert, fs, os, path, child_process | preflight.js | Unit tests for preflight |
| opencode-session-shell.mjs | fs, path, url, os, module, crypto | @opencode-ai/sdk/client | OpenCode SessionShell adapter |
| phase3-historical-ledger-migration.js | crypto, fs, path, child_process | googleapis (via clasp node_modules) | XLSM → Sheets migration |

---

## 4. Test Dependencies

### 4.1 Backend Test Runner (98.Tests.Runner.js)

| Function | Tests | Dependencies |
|----------|-------|--------------|
| `getBackendTestRegistry()` | Returns test registry | All 96.Tests.*.Cases.js files |
| `runAllBackendTests()` | Executes all suites | Test registry |
| `runAllBackendTestsDiagnostic()` | Diagnostic run | Test registry |

### 4.2 Test Case Files (75 files) — Auto-registered via naming convention

Pattern: `96.Tests.<Domain>.Cases.js` exports test functions named `test<Name>()`

Domains covered:
- Balance.Foundation, Bounded.Read, CapitalEquity, Cash.Foundation, ColdStart.Profiling
- Dashboard, Data, Depreciation, Expense.Purchase, Finance, Finance.UI, Finance.WarmCache
- Frontend, Intelligence, Inventory.*, Master.WritePolicy, ProductProfitability, Products.Domain
- Purchase.Events.Migration, Quality, SalesRecognition.V2.*, SalesUI.U8B
- SingleCommit.*, Supplier.Master, Transaction.*, Treasury.*

### 4.3 Test Fixtures (92.Tests.*.Fixtures.js)

| Fixture File | Used By |
|--------------|---------|
| 92.Tests.Analytics.Fixtures.js | Analytics test cases |
| 92.Tests.Dashboard.Fixtures.js | Dashboard test cases |
| 92.Tests.Frontend.Fixtures.js | Frontend contract tests |
| 92.Tests.Intelligence.Fixtures.js | Intelligence test cases |
| 92.Tests.Quality.Fixtures.js | Quality test cases |

### 4.4 Test Helpers

| File | Purpose |
|------|---------|
| 94.Tests.Assertions.js | Custom assertions (assertEqual, assertThrows, etc.) |
| 95.Tests.Validators.js | Data validators for tests |
| 98.Tests.Runner.js | Test execution orchestrator |

### 4.5 Browser Tests (tests/browser/)

| File | Type | Dependencies |
|------|------|--------------|
| dashboard-interactions.spec.js | Playwright spec | @playwright/test |
| finance-final-baseline-acceptance.js | Acceptance | Local harness |
| finance-ui-liveness-controller.js | Liveness | Local harness |
| fluid-desktop-stage3-runtime.js | Runtime proof | Local harness |
| package022-acceptance.js | Acceptance | Local harness |
| package022-deployed.js | Deployed test | Local harness |
| responsive-geometry-688.js | Geometry test | Local harness |
| sales-v2-u*-mutation-proof.js | Mutation proofs | Local harness |
| treasury-t*-*.js | Treasury tests | Local harness |
| smoke.js | Smoke test | Local harness |
| local-harness/assemble-html.js | Harness builder | fs, path |
| local-harness/rpc-shim.js | RPC shim | — |
| local-harness/run-expense-purchase.js | Expense test runner | — |
| local-harness/fixtures/*.json | Test data | — |

### 4.6 Temp Test Files (tests/tmp/) — **CANDIDATE FOR CLEANUP**

| File | Status |
|------|--------|
| t1-source-authority-scan.js | Temporary investigation |
| t2-design-challenge-harness.js | Temporary investigation |
| t2-harness-out.txt | Output artifact |
| t8-package-manifest.json | Temporary manifest |
| u10e-*.js (6 files) | U10E investigation scripts |

---

## 5. Configuration Dependencies

### 5.1 Apps Script Manifest (appsscript.json)

| Property | Value | Impact |
|----------|-------|--------|
| runtimeVersion | V8 | Modern JS syntax support |
| oauthScopes | 5 scopes | Sheets, Drive, Email, External Request, Container UI |
| webapp.executeAs | USER_DEPLOYING | Runs as deploying user |
| webapp.access | ANYONE_ANONYMOUS | Public web app |
| executionApi.access | ANYONE | API executable by anyone |

### 5.2 Clasp Configuration (.clasp.json)

| Property | Value |
|----------|-------|
| scriptId | 1zQfkkcA7JPrzYqJAdtRaZGixmc1lQ7b7KyyOS3cpmmhanRvovQkyWsZc |
| rootDir | "" (repo root) |
| scriptExtensions | [".js", ".gs"] |
| htmlExtensions | [".html"] |
| jsonExtensions | [".json"] |
| skipSubdirectories | false |

### 5.3 Clasp Ignore (.claspignore)

**Allowlist strategy:** `**` (ignore all) + explicit `!` patterns for 79 files

---

## 6. Data Dependencies (Spreadsheet)

### 6.1 Canonical Sheets (referenced in 20.Data.Source.js & constants)

| Sheet | Purpose | Referenced By |
|-------|---------|---------------|
| Transaction | Canonical transaction ledger | 20.Data.Source, 21, 22, 91, 95, 95A, 97, 99 |
| Products | Product master | 20, 21, 92, 95A |
| ProductPricing | Pricing rules | 21, 92 |
| ExpenseItems | Expense master | 20, 46, 47, 95A |
| COGSIngredients | COGS ingredients | 92 |
| COGSRecipes | COGS recipes | 92 |
| Accounts | Chart of accounts | 36, 39, 40 |
| Calendar | Date dimension | 30, 90 |
| Settings | Global settings | 10, 36, 40 |
| CapitalEquity | Capital/Equity register | 38, 39, 100 |
| DepreciationLedger | Depreciation records | 37, 36 |
| CashPlanConfig | Cash planning config | 40 |
| CashPlanScenario | Cash scenarios | 40 |
| InventoryOpening | Inventory opening balances | 41, 42, 45 |
| InventoryReceipt | Inventory receipts | 42, 43, 44, 45, 97 |
| PurchaseEvents | Purchase events | 47, 48 |
| Supplier | Supplier master | 94 |
| FinanceOpeningBalances | Finance opening | 39, 100 |
| RecipeStandardCost | Standard cost config | 100 |

### 6.2 Spreadsheet Identity

| Property | Value |
|----------|-------|
| Production Workbook ID | 1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M |
| Access Method | `SpreadsheetApp.openById()` via `requireNumlockProductionSpreadsheet()` |
| Timezone | Asia/Jakarta |

---

## 7. External Service Dependencies

| Service | Purpose | Auth |
|---------|---------|------|
| Google Sheets API | Data storage | OAuth2 (script scopes) |
| Google Drive API | File access (migration) | OAuth2 |
| Google Apps Script Runtime | Execution platform | Built-in |
| CDN (jsdelivr, cdnjs) | Chart.js, Font Awesome | None (public) |

---

## 8. Dependency Risk Assessment

### 8.1 High Risk (Circular / Tight Coupling)

| Cycle | Files | Mitigation |
|-------|-------|------------|
| Transaction ↔ Inventory | 21, 22, 42-45, 95, 95A, 97 | Layered architecture; Inventory depends on Transaction primitives |
| Finance ↔ Cash ↔ Balance | 36, 39, 40 | Shared 20.Data.Source; no direct circular calls |
| Sales Recognition ↔ Transaction | 97, 95A, 21, 22 | SalesRecognition uses Transaction; Transaction doesn't call SalesRecognition |

### 8.2 Medium Risk (Load Order Sensitive)

| Dependency | Risk | Current Mitigation |
|------------|------|-------------------|
| 10.Config.js constants used by 20-99 | Load order | Numeric prefix ensures 10 loads first |
| 00.Project.Spec.js used by 10+ | Load order | 00 prefix ensures first load |
| 100.Code.js (doGet) uses 90-99 services | Load order | 100 loads last; services already initialized |

### 8.3 Low Risk (Well-Isolated)

| Module | Isolation |
|--------|-----------|
| 12A.Depreciation.Report.Service | Standalone service |
| 37.Inventory.Policy.Evidence | Evidence-only; no runtime deps |
| 93.Master.WritePolicy | Policy constants only |
| 94.Supplier.Master | Master data only |
| Intelligence modules (60-85) | Pure functions; no external deps |

---

## 9. Recommended Dependency Improvements

1. **Explicit Module Declaration** — Consider JSDoc `@module` tags for clarity
2. **Load Order Documentation** — Document the numeric prefix convention in AGENTS.md
3. **Test Dependency Isolation** — Move tests/tmp/ to separate investigation directory
4. **Browser Test Harness** — Formalize local-harness as a proper test utility
5. **CDN Version Pinning** — Document Chart.js/FontAwesome versions in package.json for auditability