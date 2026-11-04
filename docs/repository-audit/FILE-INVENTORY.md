# NUMLOCK Repository File Inventory

**Audit Date:** 2026-11-05
**Branch:** main
**HEAD:** 92b7e4ecf60ee32c2afb0093bb56a21d4e6c0b66
**Total Files (excl. .git, node_modules, .codegraph):** 752
**Repository Size (excl. .git, node_modules, .codegraph):** ~101 MB

---

## File Classification Summary

| Category | Count | Size | Description |
|----------|-------|------|-------------|
| **Production Runtime (JS)** | 76 | ~3.1 MB | Apps Script source files deployed via clasp |
| **Production Runtime (HTML)** | 18 | ~1.1 MB | HTML templates and partials deployed via clasp |
| **Production Config** | 3 | ~5 KB | appsscript.json, .clasp.json, .claspignore |
| **Test Files** | 83 | ~4.6 MB | Test cases, fixtures, runners, validators |
| **Test Fixtures (Browser)** | 10 | ~200 KB | JSON fixtures for local harness |
| **Build/Tooling Scripts** | 4 | ~400 KB | preflight, preflight.test, opencode-session-shell, phase3-migration |
| **Documentation (Core)** | 25 | ~500 KB | Architecture, decisions, deployment, contracts |
| **Documentation (Evidence/Archive)** | 150+ | ~80 MB | Phase evidence, screenshots, manifests, historical |
| **Agent Archive (2026-11-02)** | 15+ | ~200 KB | Legacy agent definitions and configs |
| **Configuration (VS Code, OpenCode)** | 8 | ~50 KB | IDE and agent configuration |
| **Assets** | 2 | ~100 KB | Tailwind input CSS, config |
| **License/Readme** | 3 | ~5 KB | LICENSE, README.md, push-process.md |
| **Local/Migration** | 2 | ~15 MB | XLSM migration source, maintenance scripts |

---

## Production Runtime Files (Deployed via clasp)

### JavaScript (76 files, listed in .claspignore allowlist)

| File | Size | Role | Category |
|------|------|------|----------|
| 00.Project.Spec.js | 1.3 KB | Project specification constants | Config |
| 10.Config.js | 3.2 KB | Global configuration | Config |
| 20.Data.Source.js | 14.5 KB | Spreadsheet data access layer | Data |
| 21.Transaction.Entry.js | 308 KB | Transaction entry & pricing logic | Transaction |
| 22.Transaction.Lifecycle.js | 25 KB | Transaction lifecycle operations | Transaction |
| 25.Data.Processor.js | 2 KB | Transaction processing | Data |
| 30.Analytics.Aggregate.js | 10.8 KB | Analytics aggregation | Analytics |
| 35.Analytics.Financial.js | 1.8 KB | Financial analytics helpers | Analytics |
| 36.Finance.Service.js | 49 KB | Finance dashboard data service | Finance |
| 37.Depreciation.Service.js | 29 KB | Depreciation calculations | Finance |
| 37.Inventory.Policy.Evidence.js | 59 KB | Inventory policy evidence | Inventory |
| 38.CapitalEquity.Service.js | 30 KB | Capital/Equity management | Finance |
| 39.Balance.Foundation.js | 177 KB | Balance sheet foundation | Finance |
| 40.Analytics.Summary.js | 210 B | Analytics summary (minimal) | Analytics |
| 40.Cash.Foundation.js | 92 KB | Cash foundation & schema | Finance |
| 40.Inventory.Conversion.Population.js | 72 KB | Inventory conversion population | Inventory |
| 41.Inventory.Opening.Staging.js | 75 KB | Inventory opening staging | Inventory |
| 42.Inventory.Receipt.Foundation.js | 21 KB | Inventory receipt foundation | Inventory |
| 43.Inventory.Receipt.Migration.js | 17 KB | Inventory receipt migration | Inventory |
| 44.Inventory.Receipt.Operational.js | 11 KB | Inventory receipt operational | Inventory |
| 45.Analytics.Trend.js | 1 KB | Analytics trend (minimal) | Analytics |
| 45.Inventory.Receipt.Orchestration.js | 14 KB | Inventory receipt orchestration | Inventory |
| 46.Expense.Purchase.Policy.js | 9 KB | Expense/purchase policy | Transaction |
| 47.Purchase.Events.js | 113 KB | Purchase events management | Transaction |
| 48.Purchase.Events.Migration.js | 11 KB | Purchase events migration | Transaction |
| 50.Analytics.Product.js | 17 KB | Product analytics | Analytics |
| 55.Analytics.Expense.js | 737 B | Expense analytics (minimal) | Analytics |
| 60.Intelligence.Revenue.js | 1.5 KB | Revenue intelligence | Intelligence |
| 65.Intelligence.Profit.js | 704 B | Profit intelligence | Intelligence |
| 70.Intelligence.Score.js | 7.4 KB | Business score intelligence | Intelligence |
| 75.Intelligence.Diagnosis.js | 5.5 KB | Business diagnosis | Intelligence |
| 80.Intelligence.Recommendation.js | 7.2 KB | Business recommendations | Intelligence |
| 85.Intelligence.Decision.js | 14 KB | Business decisions | Intelligence |
| 90.Dashboard.DateRange.js | 8.5 KB | Dashboard date range utilities | Dashboard |
| 90.Dashboard.Quality.js | 5 KB | Dashboard quality metrics | Dashboard |
| 90.Dashboard.Reporting.js | 6.7 KB | Dashboard reporting | Dashboard |
| 90.Dashboard.Service.js | 15 KB | Dashboard data service | Dashboard |
| 91.Transactions.Query.js | 33 KB | Transaction queries | Transaction |
| 92.Products.Domain.js | 20 KB | Product domain logic | Products |
| 93.Master.WritePolicy.js | 6.5 KB | Master data write policy | Config |
| 94.Supplier.Master.js | 7.5 KB | Supplier master data | Master |
| 95.Transaction.Operational.js | 46 KB | Operational transaction logic | Transaction |
| 95A.Transaction.Production.js | 62 KB | Production transaction logic | Transaction |
| 97.Inventory.Receipt.Runtime.Proof.js | 7 KB | Inventory receipt runtime proof | Inventory |
| 97.Inventory.Receipt.Operational.Runtime.Proof.js | 7 KB | Operational runtime proof | Inventory |
| 97.SalesRecognition.V2.Foundation.js | 29 KB | Sales recognition V2 foundation | Transaction |
| 97A.SalesRecognition.V2.Save.js | 89 KB | Sales recognition V2 save | Transaction |
| 97B.SalesRecognition.V2.Projection.js | 47 KB | Sales recognition V2 projection | Transaction |
| 97C.SalesRecognition.V2.Correction.js | 114 KB | Sales recognition V2 correction | Transaction |
| 97D.SalesRecognition.V2.OperatorGuard.js | 19 KB | Sales recognition V2 operator guard | Transaction |
| 97E.SalesRecognition.V2.Activation.js | 13 KB | Sales recognition V2 activation | Transaction |
| 98.Tests.Runner.js | 14 KB | Test runner | Test |
| 99.Treasury.Receipt.Foundation.js | 23 KB | Treasury receipt foundation | Treasury |
| 99A.Treasury.Receipt.Durable.Save.js | 88 KB | Treasury durable save | Treasury |
| 99B.Treasury.Clearing.Projection.js | 68 KB | Treasury clearing projection | Treasury |
| 99C.Treasury.Receipt.Reversal.Correction.js | 97 KB | Treasury reversal/correction | Treasury |
| 99D.Treasury.Operator.Api.js | 11 KB | Treasury operator API | Treasury |
| 100.Code.js | 34 KB | Web app entry point (doGet, include) | Entry |
| 101.SingleCommit.Config.Control.js | 30 KB | Single commit config control | Config |
| 102.Transitional.Clearing.Close.js | 50 KB | Transitional clearing close | Transaction |
| 12A.Depreciation.Report.Service.js | 9 KB | Depreciation report service | Finance |

### HTML Templates (18 files, listed in .claspignore allowlist)

| File | Size | Role | Category |
|------|------|------|----------|
| 189.View.Tailwind.html | 97 KB | Compiled Tailwind CSS | UI |
| 190.View.Index.html | 445 KB | Main HTML entry point | UI |
| 191.View.Diagnostics.html | 22 KB | Diagnostics panel | UI |
| 192.View.Transactions.State.html | 21 KB | Transactions state management | UI |
| 193.View.Transactions.Render.html | 8 KB | Transactions rendering | UI |
| 194.View.Transactions.Forms.html | 45 KB | Transaction entry forms | UI |
| 195.View.Transactions.Actions.html | 149 KB | Transaction actions | UI |
| 196.View.Dashboard.Render.html | 93 KB | Dashboard rendering | UI |
| 197.View.Dashboard.Charts.html | 5.7 KB | Dashboard charts | UI |
| 198.View.Dashboard.Controller.html | 31 KB | Dashboard controller | UI |
| 199.View.Finance.State.html | 652 B | Finance state (minimal) | UI |
| 200.View.Finance.Render.html | 27 KB | Finance rendering | UI |
| 201.View.Finance.Controller.html | 24 KB | Finance controller | UI |
| 202.View.Treasury.State.html | 3.3 KB | Treasury state | UI |
| 203.View.Treasury.Render.html | 22 KB | Treasury rendering | UI |
| 204.View.Treasury.Controller.html | 27 KB | Treasury controller | UI |
| index.html | 2.4 KB | Static landing page | UI |
| _test_runner.js | 42 KB | Test runner (not deployed) | Test |

---

## Test Files (83 files)

### Test Fixtures (5 files, ~55 KB)
- 92.Tests.Analytics.Fixtures.js (13.8 KB)
- 92.Tests.Dashboard.Fixtures.js (10.5 KB)
- 92.Tests.Frontend.Fixtures.js (11.4 KB)
- 92.Tests.Intelligence.Fixtures.js (9.7 KB)
- 92.Tests.Quality.Fixtures.js (9.2 KB)

### Test Helpers (3 files, ~9 KB)
- 94.Tests.Assertions.js (6.5 KB)
- 95.Tests.Validators.js (2 KB)
- 98.Tests.Runner.js (14 KB) — also deployed

### Test Cases (75 files, ~4.5 MB)
Grouped by domain:
- **Balance/Cash/Capital**: 5 files (416 KB)
- **Dashboard**: 2 files (215 KB)
- **Data/Quality**: 2 files (29 KB)
- **Depreciation**: 1 file (41 KB)
- **Expense/Purchase**: 2 files (233 KB)
- **Finance**: 4 files (248 KB)
- **Frontend**: 1 file (158 KB)
- **Intelligence**: 1 file (30 KB)
- **Inventory**: 7 files (136 KB)
- **Master/Products**: 4 files (87 KB)
- **Purchase Events Migration**: 1 file (14 KB)
- **Sales Recognition V2**: 8 files (527 KB)
- **Single Commit**: 7 files (399 KB)
- **Supplier**: 1 file (5 KB)
- **Transaction**: 3 files (190 KB)
- **Treasury**: 6 files (396 KB)
- **Transactions**: 1 file (114 KB)
- **SalesUI**: 1 file (15 KB)
- **ColdStart/Bounded Read**: 2 files (59 KB)

### Browser Test Fixtures (10 files, ~200 KB)
- tests/browser/local-harness/fixtures/*.json (10 files)

### Browser Tests (31 files, ~1.5 MB)
- tests/browser/*.js (31 files including spec, acceptance, runtime proofs)

---

## Build/Tooling Scripts (4 files)

| File | Size | Purpose |
|------|------|---------|
| scripts/preflight.js | 6.5 KB | OpenCode permission policy validator |
| scripts/preflight.test.js | 8.5 KB | Preflight tests |
| scripts/opencode-session-shell.mjs | 10 KB | OpenCode SessionShell adapter |
| scripts/phase3-historical-ledger-migration.js | 30 KB | Historical XLSM migration (one-time) |

---

## Documentation

### Core Documentation (25 files, ~500 KB)
| File | Size | Purpose |
|------|------|---------|
| AGENTS.md | 15.7 KB | Operating contract (this project) |
| AGENT-ARCHITECTURE.md | ~10 KB | Agent routing contract |
| AGENT-CONSOLIDATION-AUDIT.md | ~15 KB | Historical audit |
| AGENT-CONSOLIDATION-COMPLETION.md | ~10 KB | Consolidation completion |
| ARCHITECTURE.md | ~15 KB | System architecture |
| CHANGELOG.md | ~30 KB | Version history |
| CLASP-STARTUP-RECOVERY.md | ~10 KB | Clasp recovery procedures |
| DASHBOARD-CONSUMER-INVENTORY.md | ~10 KB | Dashboard consumer map |
| DECISIONS.md | ~25 KB | Architectural decisions |
| DEPLOYMENT.md | ~10 KB | Deployment procedures |
| DEVELOPMENT-WORKFLOW.md | ~15 KB | Development workflow |
| LOCAL-EXECUTION-CONTRACT.md | ~15 KB | Local execution isolation |
| NUMLOCK-BUSINESS-CONTRACT.md | ~10 KB | Business rules contract |
| PUSH-PROCESS.md | 1.3 KB | Push process notes |
| README.md | 4.6 KB | Project overview |
| SOURCE-MIGRATION.md | ~10 KB | Source migration notes |
| TESTING.md | ~15 KB | Testing strategy |
| TASK_CONTRACT.md | 5.4 KB | Task contract template |
| TREASURY-T*.md | 8 files | Treasury phase documentation |
| SALES-RECOGNITION-V2-*.md | 10 files | Sales recognition V2 docs |
| UIUX-2.0-*.md | 4 files | UI/UX specifications |

### Evidence Archives (docs/evidence/ - ~80 MB)
- **finance-phase-11n8/**: 42 manifests + SHA256 pairs (~15 MB)
- **finance-phase-11v12d/**: Screenshots + verification (~5 MB)
- **finance-phase-11v12d2/**: Duplicate of v12d (~5 MB)
- **package022/**: Browser screenshots (v587 + browser + browser-deployed) ~30 MB
- **finance-phase-11u2e/**: POST-11U.snapshot.json (11 MB)
- **Other phase evidence**: 15+ directories with logs, manifests, verification scripts

### Agent Archive (docs/agent-archive/2026-11-02/)
- 3 JSON files (reference inventory, permission matrix, source manifest)
- Original AGENTS.md, opencode.json
- 10 legacy agent definitions
- 3 original docs
- 4 original scripts

---

## Configuration Files

| File | Purpose |
|------|---------|
| .clasp.json | Clasp deployment config (scriptId, extensions) |
| .claspignore | Deployment allowlist (79 entries) |
| .gitignore | Git ignore rules (21 lines) |
| appsscript.json | Apps Script manifest (V8, scopes, webapp) |
| package.json | NPM config (tailwindcss, playwright) |
| tailwind.config.js | Tailwind CSS config |
| opencode.json | OpenCode agent configuration |
| Numlock.code-workspace | VS Code workspace |
| .vscode/extensions.json | VS Code extensions |
| .vscode/settings.json | VS Code settings |
| .vscode/tasks.json | VS Code tasks |

---

## Local/Migration Files

| File | Size | Purpose |
|------|------|---------|
| .local/migration/Theme 5 - Numlock Mac Final1 - Dash.xlsm | ~15 MB | Historical XLSM source for Phase 3 migration |
| .local/maintenance/2026-09-10/_preflight_commands.sh | ~1 KB | Historical maintenance |
| .local/maintenance/t11-10b-harness-removal/ | ~2 KB | Historical harness removal scripts |

---

## Generated/Build Artifacts

| File | Origin |
|------|--------|
| 189.View.Tailwind.html | `npm run build:tailwind` output |
| tests/browser/local-harness/assembled.html | Local test harness assembly |
| .DS_Store files (11) | macOS filesystem metadata |

---

## File Tracking Status

| Category | Tracked | Untracked | Ignored (.gitignore) |
|----------|---------|-----------|---------------------|
| Production JS | 76 | 0 | 0 |
| Production HTML | 18 | 0 | 0 |
| Config | 6 | 0 | 0 |
| Test JS | 83 | 0 | 0 |
| Test Fixtures | 10 | 0 | 0 |
| Browser Tests | 31 | 0 | 0 |
| Build Scripts | 4 | 0 | 0 |
| Core Docs | 25 | 0 | 0 |
| Evidence Docs | 150+ | 0 | 2 (snapshots) |
| Agent Archive | 18 | 0 | 3 (archived JSON) |
| VS Code/OpenCode | 8 | 0 | 0 |
| Assets | 2 | 0 | 0 |
| Local/Migration | 0 | 2 | 2 (entire .local/) |
| **Total** | **~431** | **2** | **7** |

---

## Cleanup Classification (Preliminary)

| File/Path | Classification | Confidence | Rationale |
|-----------|----------------|------------|-----------|
| docs/evidence/package022/v587/browser-deployed/screenshots/ | **SAFE DELETE** | HIGH | Exact duplicate of browser-deployed/screenshots/ (80 files) |
| docs/evidence/finance-phase-11v12d2/ | **SAFE DELETE** | HIGH | Exact duplicate of finance-phase-11v12d/ (10 files) |
| docs/agent-archive/2026-11-02/original/ | **SAFE DELETE** | HIGH | Archived in permanent backup; not needed in repo |
| .local/migration/Theme 5 - Numlock Mac Final1 - Dash.xlsm | **KEEP** | HIGH | Source of truth for Phase 3 migration; verified by SHA256 |
| scripts/phase3-historical-ledger-migration.js | **KEEP** | HIGH | One-time migration utility; may be needed for rollback/re-run |
| tests/browser/local-harness/assembled.html | **SAFE DELETE** | MEDIUM | Generated artifact; can be rebuilt |
| 189.View.Tailwind.html | **KEEP (GENERATED)** | HIGH | Build artifact; source is assets/tailwind.input.css |
| .DS_Store files (11) | **SAFE DELETE** | HIGH | macOS metadata; already in .gitignore |
| docs/evidence/finance-phase-11u2e/POST-11U.snapshot.json | **INVESTIGATE** | MEDIUM | 11 MB snapshot; verify if referenced by tests |
| docs/LOCAL-EXECUTION-CONTRACT.md (duplicate in agent-archive) | **CONSOLIDATE** | HIGH | Exact duplicate; keep root version |

---

## Apps Script Deployment Coverage

**Files in .claspignore allowlist:** 79 entries
- 61 JavaScript files
- 18 HTML files
- Total: 79/79 tracked files deployed

**Production source files NOT in allowlist (but present in repo):**
- None — all production .js/.html files are in allowlist

**Files in allowlist but missing from repo:**
- None — all 79 entries exist

---

## Recommendations Priority

1. **HIGH** — Delete exact duplicate screenshot directories (~35 MB savings)
2. **HIGH** — Remove agent-archive/original/ (~200 KB, archived in backup)
3. **MEDIUM** — Consolidate LOCAL-EXECUTION-CONTRACT.md duplicate
4. **MEDIUM** — Remove .DS_Store files (already ignored but present)
5. **LOW** — Evaluate POST-11U.snapshot.json (11 MB) retention need
6. **LOW** — Consider organizing evidence/ into dated archive structure