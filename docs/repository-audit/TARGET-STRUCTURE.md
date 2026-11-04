# NUMLOCK Target Repository Structure

**Audit Date:** 2026-11-05
**Goal:** Clear separation between production source, tests, tooling, documentation, and historical material

---

## Current Structure (Root)

```
Numlock/
├── *.js (76 production + 83 test + 4 tooling = 163 files)
├── *.html (18 production + 1 static)
├── .clasp.json, .claspignore, .gitignore, appsscript.json
├── package.json, tailwind.config.js, opencode.json
├── assets/
├── docs/ (250+ files, ~80 MB)
├── scripts/ (4 files)
├── tests/ (browser/, tmp/, 10 fixtures)
├── .vscode/, .opencode/, .ai/, .codex/, .codegraph/, .local/
└── LICENSE, README.md, push-process.md, TASK_CONTRACT.md
```

**Problems:**
- 163 files in root (too flat)
- Test files mixed with production
- Documentation evidence bloating repo (80 MB)
- No clear separation of concerns
- Historical archives mixed with current docs

---

## Proposed Target Structure

```
Numlock/
├── .clasp.json                 # Clasp config (unchanged)
├── .claspignore                # Deployment allowlist (unchanged)
├── .gitignore                  # Updated for new structure
├── appsscript.json             # Apps Script manifest (unchanged)
├── package.json                # NPM config (unchanged)
├── tailwind.config.js          # Tailwind config (unchanged)
├── opencode.json               # OpenCode config (unchanged)
├── LICENSE
├── README.md
├── push-process.md
├── TASK_CONTRACT.md
│
├── src/                        # PRODUCTION SOURCE (deployed via clasp)
│   ├── config/
│   │   ├── 00.Project.Spec.js
│   │   ├── 10.Config.js
│   │   ├── 93.Master.WritePolicy.js
│   │   └── 101.SingleCommit.Config.Control.js
│   ├── data/
│   │   ├── 20.Data.Source.js
│   │   └── 25.Data.Processor.js
│   ├── transaction/
│   │   ├── 21.Transaction.Entry.js
│   │   ├── 22.Transaction.Lifecycle.js
│   │   ├── 46.Expense.Purchase.Policy.js
│   │   ├── 47.Purchase.Events.js
│   │   ├── 48.Purchase.Events.Migration.js
│   │   ├── 95.Transaction.Operational.js
│   │   ├── 95A.Transaction.Production.js
│   │   └── 102.Transitional.Clearing.Close.js
│   ├── analytics/
│   │   ├── 30.Analytics.Aggregate.js
│   │   ├── 35.Analytics.Financial.js
│   │   ├── 40.Analytics.Summary.js
│   │   ├── 45.Analytics.Trend.js
│   │   ├── 50.Analytics.Product.js
│   │   └── 55.Analytics.Expense.js
│   ├── finance/
│   │   ├── 36.Finance.Service.js
│   │   ├── 37.Depreciation.Service.js
│   │   ├── 37.Inventory.Policy.Evidence.js
│   │   ├── 38.CapitalEquity.Service.js
│   │   ├── 39.Balance.Foundation.js
│   │   ├── 40.Cash.Foundation.js
│   │   ├── 40.Inventory.Conversion.Population.js
│   │   ├── 41.Inventory.Opening.Staging.js
│   │   ├── 42.Inventory.Receipt.Foundation.js
│   │   ├── 43.Inventory.Receipt.Migration.js
│   │   ├── 44.Inventory.Receipt.Operational.js
│   │   ├── 45.Inventory.Receipt.Orchestration.js
│   │   ├── 12A.Depreciation.Report.Service.js
│   │   └── 94.Supplier.Master.js
│   ├── intelligence/
│   │   ├── 60.Intelligence.Revenue.js
│   │   ├── 65.Intelligence.Profit.js
│   │   ├── 70.Intelligence.Score.js
│   │   ├── 75.Intelligence.Diagnosis.js
│   │   ├── 80.Intelligence.Recommendation.js
│   │   └── 85.Intelligence.Decision.js
│   ├── dashboard/
│   │   ├── 90.Dashboard.DateRange.js
│   │   ├── 90.Dashboard.Quality.js
│   │   ├── 90.Dashboard.Reporting.js
│   │   └── 90.Dashboard.Service.js
│   ├── domain/
│   │   ├── 91.Transactions.Query.js
│   │   └── 92.Products.Domain.js
│   ├── sales/
│   │   ├── 97.SalesRecognition.V2.Foundation.js
│   │   ├── 97A.SalesRecognition.V2.Save.js
│   │   ├── 97B.SalesRecognition.V2.Projection.js
│   │   ├── 97C.SalesRecognition.V2.Correction.js
│   │   ├── 97D.SalesRecognition.V2.OperatorGuard.js
│   │   └── 97E.SalesRecognition.V2.Activation.js
│   ├── treasury/
│   │   ├── 99.Treasury.Receipt.Foundation.js
│   │   ├── 99A.Treasury.Receipt.Durable.Save.js
│   │   ├── 99B.Treasury.Clearing.Projection.js
│   │   ├── 99C.Treasury.Receipt.Reversal.Correction.js
│   │   └── 99D.Treasury.Operator.Api.js
│   ├── runtime-proofs/
│   │   ├── 97.Inventory.Receipt.Runtime.Proof.js
│   │   ├── 97.Inventory.Receipt.Operational.Runtime.Proof.js
│   │   └── 98.Tests.Runner.js
│   ├── entry/
│   │   └── 100.Code.js
│   └── views/
│       ├── 189.View.Tailwind.html
│       ├── 190.View.Index.html
│       ├── 191.View.Diagnostics.html
│       ├── 192.View.Transactions.State.html
│       ├── 193.View.Transactions.Render.html
│       ├── 194.View.Transactions.Forms.html
│       ├── 195.View.Transactions.Actions.html
│       ├── 196.View.Dashboard.Render.html
│       ├── 197.View.Dashboard.Charts.html
│       ├── 198.View.Dashboard.Controller.html
│       ├── 199.View.Finance.State.html
│       ├── 200.View.Finance.Render.html
│       ├── 201.View.Finance.Controller.html
│       ├── 202.View.Treasury.State.html
│       ├── 203.View.Treasury.Render.html
│       └── 204.View.Treasury.Controller.html
│
├── tests/                      # TEST FILES (not deployed)
│   ├── backend/                # Apps Script test cases (deployed for clasp run)
│   │   ├── fixtures/
│   │   │   ├── analytics.js
│   │   │   ├── dashboard.js
│   │   │   ├── frontend.js
│   │   │   ├── intelligence.js
│   │   │   └── quality.js
│   │   ├── helpers/
│   │   │   ├── assertions.js
│   │   │   ├── validators.js
│   │   │   └── runner.js
│   │   ├── balance/
│   │   ├── dashboard/
│   │   ├── finance/
│   │   ├── intelligence/
│   │   ├── inventory/
│   │   ├── sales-recognition/
│   │   ├── single-commit/
│   │   ├── transaction/
│   │   ├── treasury/
│   │   └── ...
│   ├── browser/                # Playwright/local-harness tests (Node only)
│   │   ├── specs/
│   │   ├── acceptance/
│   │   ├── harness/
│   │   │   ├── assemble-html.js
│   │   │   ├── rpc-shim.js
│   │   │   └── run-expense-purchase.js
│   │   └── fixtures/
│   └── investigation/          # Moved from tests/tmp/
│
├── scripts/                    # BUILD & TOOLING (Node only)
│   ├── preflight/
│   │   ├── index.js
│   │   └── test.js
│   ├── opencode/
│   │   └── session-shell.mjs
│   └── migration/
│       └── phase3-historical-ledger-migration.js
│
├── assets/                     # STATIC ASSETS
│   ├── tailwind.input.css
│   └── tailwind.config.js      # (or keep at root for npm script)
│
├── docs/                       # DOCUMENTATION
│   ├── architecture/
│   │   ├── AGENT-ARCHITECTURE.md
│   │   ├── ARCHITECTURE.md
│   │   ├── LOCAL-EXECUTION-CONTRACT.md
│   │   └── NUMLOCK-BUSINESS-CONTRACT.md
│   ├── operations/
│   │   ├── CHANGELOG.md
│   │   ├── DECISIONS.md
│   │   ├── DEPLOYMENT.md
│   │   ├── DEVELOPMENT-WORKFLOW.md
│   │   ├── TESTING.md
│   │   └── push-process.md
│   ├── features/
│   │   ├── DASHBOARD-CONSUMER-INVENTORY.md
│   │   ├── TREASURY-T*.md (8 files)
│   │   ├── SALES-RECOGNITION-V2-*.md (10 files)
│   │   └── UIUX-2.0-*.md (4 files)
│   ├── evidence/               # CURRENT evidence only
│   │   ├── current/            # Latest phase evidence
│   │   ├── snapshots/          # Large binary snapshots
│   │   └── manifests/          # Manifest collections
│   ├── archive/                # SUPERSEDED evidence (by date)
│   │   ├── 2026-10-finance-11n8/
│   │   ├── 2026-10-finance-11v12-progression/
│   │   ├── 2026-10-package022/
│   │   └── 2026-08-legacy-retirement/
│   ├── agent-archive/          # HISTORICAL (2026-11-02 consolidation)
│   │   └── 2026-11-02/
│   │       ├── reference-inventory.json
│   │       ├── resolved-permission-matrix.json
│   │       └── source-manifest.json
│   └── repository-audit/       # THIS AUDIT (new)
│       ├── FILE-INVENTORY.md
│       ├── DEPENDENCY-MAP.md
│       ├── CLEANUP-CANDIDATES.md
│       ├── DUPLICATION-REPORT.md
│       ├── TARGET-STRUCTURE.md
│       ├── EXECUTION-PLAN.md
│       └── AUDIT-SUMMARY.md
│
├── .local/                     # LOCAL ONLY (gitignored)
│   └── migration/
│       └── Theme 5 - Numlock Mac Final1 - Dash.xlsm
│
├── .vscode/                    # VS Code config (unchanged)
├── .opencode/                  # OpenCode config (unchanged)
├── .ai/                        # AI config (unchanged)
├── .codex/                     # Codex config (unchanged)
└── .codegraph/                 # CodeGraph index (gitignored)
```

---

## Key Design Decisions

### 1. `src/` for Production Source

**Rationale:**
- Clear boundary: everything in `src/` is deployed to Apps Script
- `.claspignore` can use `src/**` pattern (but see constraint below)
- Separates production from test/tooling/docs

**Constraint:** `.clasp.json` has `"rootDir": ""` and `"skipSubdirectories": false`. 
- **Option A:** Change `rootDir` to `"src"` — requires clasp reconfiguration
- **Option B:** Keep files in root, use symlinks — complex
- **Option C:** Keep flat structure, organize logically with comments — current approach

**Recommendation:** **Keep flat in root** for now. The numeric prefix convention (00, 10, 20...) provides implicit organization and ensures correct load order. Moving to subdirectories would require:
1. Changing `.clasp.json` rootDir
2. Verifying clasp upload order (currently `filePushOrder: []`)
3. Testing deployment thoroughly

**Alternative:** Use directory structure only for documentation/tooling/tests — keep Apps Script source flat.

### 2. `tests/backend/` Stays in Root (for clasp)

**Constraint:** Apps Script test files (96.Tests.*.Cases.js, 98.Tests.Runner.js) MUST be deployed to run via `clasp run`.

**Current .claspignore** lists each test file individually (79 entries).

**Options:**
- **A:** Move to `tests/backend/` and update .claspignore to `!tests/backend/**/*.js` — requires clasp to support directory patterns
- **B:** Keep in root with `96.Tests.` prefix — current working approach
- **C:** Symlink from root to `tests/backend/` — fragile

**Recommendation:** **Keep in root** with `96.Tests.` prefix. The numeric prefix groups them together visually.

### 3. `docs/evidence/` Restructure

**Current:** 150+ files, ~80 MB in flat/date-based directories

**Proposed:** Three-tier structure
- `current/` — Only the latest evidence for active phases
- `archive/` — Superseded phases, organized by date
- `snapshots/` — Large binary files (POST-11U.snapshot.json, etc.)

**Benefit:** Reduces working tree size; keeps history accessible.

### 4. `scripts/` Reorganization

**Current:** 4 files flat

**Proposed:** Group by purpose
- `preflight/` — Permission validation
- `opencode/` — SessionShell adapter
- `migration/` — One-time historical migration

**Benefit:** Clear ownership; easier to find.

### 5. `tests/browser/` Reorganization

**Current:** 31 files flat + harness + fixtures

**Proposed:** Standard test structure
- `specs/` — Playwright specs
- `acceptance/` — Acceptance tests
- `harness/` — Local harness utilities
- `fixtures/` — Test data

**Benefit:** Standard convention; easier maintenance.

---

## Files That MUST Stay in Root (Apps Script Constraints)

| File | Reason |
|------|--------|
| 00.Project.Spec.js through 102.Transitional.Clearing.Close.js | Load order via numeric prefix |
| 189.View.Tailwind.html through 204.View.Treasury.Controller.html | Template inclusion via `include()` |
| 96.Tests.*.Cases.js (75 files) | Deployed for `clasp run` |
| 98.Tests.Runner.js | Deployed test runner |
| appsscript.json, .clasp.json, .claspignore | Clasp configuration |
| _test_runner.js | Local test runner (not deployed) |

**Total:** ~94 files that must remain in root for Apps Script compatibility.

---

## Migration Path

### Phase 1: Non-Breaking Reorganization (Safe)
1. Restructure `docs/evidence/` → current/archive/snapshots
2. Restructure `tests/browser/` → specs/acceptance/harness/fixtures
3. Restructure `scripts/` → preflight/opencode/migration
4. Move `tests/tmp/` → `tests/investigation/` or delete
5. Delete identified duplicates (v587, v12d2, .DS_Store, agent-archive/original)

### Phase 2: Configuration Updates
1. Update `.gitignore` for new paths
2. Update `opencode.json` permissions for moved scripts
3. Update any hardcoded paths in documentation

### Phase 3: (Optional) src/ Migration — **Requires Explicit Approval**
Only if clasp subdirectory support is verified:
1. Create `src/` with subdirectories
2. Move production files (preserving numeric prefixes within subdirs)
3. Update `.clasp.json` `"rootDir": "src"`
4. Test `clasp push --force` and deployment
5. Verify v757+ production

**Risk:** HIGH — Changes deployment pipeline. Defer until needed.

---

## Directory Mapping (Current → Target)

| Current | Target | Status |
|---------|--------|--------|
| `*.js` (production) | `src/*/` or root | **KEEP ROOT** |
| `*.html` (production) | `src/views/` or root | **KEEP ROOT** |
| `96.Tests.*.Cases.js` | `tests/backend/` or root | **KEEP ROOT** |
| `98.Tests.Runner.js` | `tests/backend/helpers/` or root | **KEEP ROOT** |
| `92.Tests.*.Fixtures.js` | `tests/backend/fixtures/` | MOVE |
| `94.Tests.Assertions.js` | `tests/backend/helpers/` | MOVE |
| `95.Tests.Validators.js` | `tests/backend/helpers/` | MOVE |
| `tests/browser/*.js` | `tests/browser/specs/`/`acceptance/` | MOVE |
| `tests/browser/local-harness/` | `tests/browser/harness/` | MOVE |
| `tests/browser/local-harness/fixtures/` | `tests/browser/fixtures/` | MOVE |
| `tests/tmp/` | `tests/investigation/` | MOVE/DELETE |
| `scripts/preflight.js` | `scripts/preflight/index.js` | MOVE |
| `scripts/preflight.test.js` | `scripts/preflight/test.js` | MOVE |
| `scripts/opencode-session-shell.mjs` | `scripts/opencode/session-shell.mjs` | MOVE |
| `scripts/phase3-*.js` | `scripts/migration/phase3-*.js` | MOVE |
| `docs/evidence/*` | `docs/evidence/current|archive|snapshots|manifests/` | REORGANIZE |
| `docs/agent-archive/2026-11-02/original/` | **DELETE** (backup exists) | DELETE |
| `docs/*.md` (core) | `docs/architecture/`, `docs/operations/`, `docs/features/` | REORGANIZE |

---

## Validation Checklist

After restructuring, verify:

- [ ] `clasp status` shows correct file inventory
- [ ] `clasp push --force` deploys all 79 allowlisted files
- [ ] `clasp run runAllBackendTests` executes successfully
- [ ] `npm run build:tailwind` generates `189.View.Tailwind.html`
- [ ] `node scripts/preflight/index.js` passes
- [ ] `node scripts/preflight/test.js` passes
- [ ] Browser tests run via Playwright
- [ ] Git history preserved for all moved files (`git mv`)
- [ ] No broken references in documentation
- [ ] `.gitignore` covers new generated artifacts

---

## Estimated Outcome

| Metric | Current | Target | Change |
|--------|---------|--------|--------|
| Root files | 163 | ~94 | -69 (moved) |
| docs/ size | ~80 MB | ~10 MB | -70 MB (archived) |
| Test organization | Flat | Hierarchical | Improved |
| Script organization | Flat | Grouped | Improved |
| Deployment compatibility | Working | Working | Preserved |
| Load order | Numeric prefix | Numeric prefix | Preserved |

**Net Repository Size Reduction:** ~30-40 MB (after duplicate deletion + evidence archival)
**Production Risk:** ZERO for Phases 1-2; Phase 3 requires explicit approval