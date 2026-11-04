# NUMLOCK Cleanup Execution Plan

**Audit Date:** 2026-11-05
**Approach:** Phased, low-risk first; production source changes deferred

---

## Wave 1 — Safe Housekeeping (IMMEDIATE — Zero Production Risk)

**Objective:** Remove verified duplicates, metadata, and generated artifacts

### 1.1 Delete Exact Duplicate Screenshot Directories

| Action | Command | Files | Size | Risk | Validation |
|--------|---------|-------|------|------|------------|
| Delete v587 screenshots | `rm -rf docs/evidence/package022/v587/browser-deployed/screenshots/` | 80 | ~15 MB | LOW | No code references; only in evidence READMEs |
| Delete v12d2 directory | `rm -rf docs/evidence/finance-phase-11v12d2/` | 10 | ~5 MB | LOW | Exact duplicate of v12d; no references |

**Rollback:** `git restore docs/evidence/package022/v587/browser-deployed/screenshots/ docs/evidence/finance-phase-11v12d2/`

### 1.2 Delete Legacy Agent Archive (Original)

| Action | Command | Files | Size | Risk | Validation |
|--------|---------|-------|------|------|------------|
| Delete agent-archive/original | `rm -rf docs/agent-archive/2026-11-02/original/` | 18 | ~200 KB | LOW | .gitignore: "preserved in permanent backup" |

**Rollback:** Restore from `/Users/azer/Documents/Numlock-Backups/2026-11-04/`

### 1.3 Remove .DS_Store Files

| Action | Command | Files | Size | Risk | Validation |
|--------|---------|-------|------|------|------------|
| Remove all .DS_Store | `find . -name ".DS_Store" -delete` | 12 | ~100 KB | LOW | Already in .gitignore |

**Rollback:** `git checkout -- *.DS_Store` (if any tracked)

### 1.4 Delete Generated Test Harness Artifact

| Action | Command | Files | Size | Risk | Validation |
|--------|---------|-------|------|------|------------|
| Delete assembled.html | `rm tests/browser/local-harness/assembled.html` | 1 | ~450 KB | LOW | Regeneratable via `node tests/browser/local-harness/assemble-html.js` |
| Add to .gitignore | `echo "tests/browser/local-harness/assembled.html" >> .gitignore` | — | — | LOW | Prevents re-commit |

**Rollback:** Re-run assemble script.

### 1.5 Archive Temporary Investigation Files

| Action | Command | Files | Size | Risk | Validation |
|--------|---------|-------|------|------|------------|
| Move tests/tmp/ | `mv tests/tmp docs/evidence/investigation-tmp-2026-11-05/` | 11 | ~200 KB | LOW | Dated Oct-Nov 2026; one-off investigations |

**Rollback:** `mv docs/evidence/investigation-tmp-2026-11-05 tests/tmp`

---

## Wave 2 — Tooling & Test Organization (LOW RISK)

**Objective:** Improve organization without changing runtime behavior

### 2.1 Reorganize Browser Tests

| Action | Command | Risk | Validation |
|--------|---------|------|------------|
| Create structure | `mkdir -p tests/browser/{specs,acceptance,harness,fixtures}` | LOW | Directory creation only |
| Move specs | `mv tests/browser/*-spec.js tests/browser/specs/ 2>/dev/null; mv tests/browser/dashboard-interactions.spec.js tests/browser/specs/` | LOW | Update any import paths |
| Move acceptance | `mv tests/browser/*-acceptance.js tests/browser/acceptance/ 2>/dev/null; mv tests/browser/package022-acceptance.js tests/browser/acceptance/; mv tests/browser/finance-final-baseline-acceptance.js tests/browser/acceptance/` | LOW | — |
| Move harness | `mv tests/browser/local-harness/* tests/browser/harness/; rmdir tests/browser/local-harness` | LOW | Update assemble-html.js paths |
| Move fixtures | `mv tests/browser/local-harness/fixtures/* tests/browser/fixtures/ 2>/dev/null` | LOW | — |
| Move others | `mv tests/browser/*.js tests/browser/acceptance/ 2>/dev/null` | LOW | Remaining files to acceptance |

**Rollback:** `git restore tests/browser/`

### 2.2 Reorganize Scripts

| Action | Command | Risk | Validation |
|--------|---------|------|------------|
| Create structure | `mkdir -p scripts/{preflight,opencode,migration}` | LOW | — |
| Move preflight | `mv scripts/preflight.js scripts/preflight/index.js; mv scripts/preflight.test.js scripts/preflight/test.js` | LOW | Update opencode.json shell permissions |
| Move opencode | `mv scripts/opencode-session-shell.mjs scripts/opencode/session-shell.mjs` | LOW | Update opencode.json if needed |
| Move migration | `mv scripts/phase3-historical-ledger-migration.js scripts/migration/` | LOW | — |

**opencode.json Updates Required:**
```json
// Change these shell permissions:
"shell": "node scripts/preflight.js" → "shell": "node scripts/preflight/index.js"
"shell": "node scripts/preflight.js *" → "shell": "node scripts/preflight/index.js *"
```

**Rollback:** `git restore scripts/ opencode.json`

### 2.3 Consolidate Finance Phase Evidence

| Action | Command | Risk | Validation |
|--------|---------|------|------------|
| Create archive | `mkdir -p docs/evidence/archive/2026-10-finance-11v12-progression` | LOW | — |
| Move v12/v12b/v12c | `mv docs/evidence/finance-phase-11v12* docs/evidence/archive/2026-10-finance-11v12-progression/ 2>/dev/null` | LOW | Keep v12d in current |
| Create current | `mkdir -p docs/evidence/current` | LOW | — |
| Move active | `mv docs/evidence/finance-phase-11v12d docs/evidence/current/` | LOW | — |

**Rollback:** `git restore docs/evidence/finance-phase-11v12*`

---

## Wave 3 — Documentation Restructure (LOW RISK)

**Objective:** Organize docs into clear categories

### 3.1 Create Documentation Structure

| Action | Command | Risk | Validation |
|--------|---------|------|------------|
| Create dirs | `mkdir -p docs/{architecture,operations,features,evidence/{current,archive,snapshots,manifests},repository-audit}` | LOW | — |
| Move architecture | `mv docs/AGENT-ARCHITECTURE.md docs/ARCHITECTURE.md docs/LOCAL-EXECUTION-CONTRACT.md docs/NUMLOCK-BUSINESS-CONTRACT.md docs/architecture/` | LOW | Update any cross-references |
| Move operations | `mv docs/CHANGELOG.md docs/DECISIONS.md docs/DEPLOYMENT.md docs/DEVELOPMENT-WORKFLOW.md docs/TESTING.md docs/push-process.md docs/operations/` | LOW | — |
| Move features | `mv docs/TREASURY-T*.md docs/SALES-RECOGNITION-V2-*.md docs/UIUX-2.0-*.md docs/DASHBOARD-CONSUMER-INVENTORY.md docs/features/` | LOW | — |

**Rollback:** `git restore docs/*.md`

### 3.2 Move Evidence to Structured Layout

| Action | Command | Risk | Validation |
|--------|---------|------|------------|
| Move manifests | `mv docs/evidence/finance-phase-11n8/manifests docs/evidence/manifests/finance-phase-11n8` | LOW | — |
| Move snapshots | `mv docs/evidence/finance-phase-11u2e/POST-11U.snapshot.json docs/evidence/snapshots/` | LOW | — |
| Archive legacy | `mv docs/evidence/legacy-retirement docs/evidence/archive/2026-08-legacy-retirement` | LOW | — |
| Archive package022 | `mv docs/evidence/package022 docs/evidence/archive/2026-10-package022` | LOW | After Wave 1 deletes |

**Rollback:** `git restore docs/evidence/`

---

## Wave 4 — Apps Script Structural (DEFERRED — Requires Explicit Approval)

**Objective:** Evaluate production source organization

**Status:** NOT EXECUTING — Requires separate task authorization

### 4.1 Analysis Only (This Audit)

- [x] Document current load order dependencies
- [x] Identify modules that could be consolidated
- [x] Map global namespace usage
- [x] Assess clasp subdirectory support

### 4.2 Potential Consolidation Candidates (For Future Review)

| Candidate | Current Files | Proposed | Benefit | Risk |
|-----------|---------------|----------|---------|------|
| Analytics modules | 30, 35, 40, 45, 50, 55 (6 files) | analytics/*.js | Group related | Load order |
| Intelligence modules | 60, 65, 70, 75, 80, 85 (6 files) | intelligence/*.js | Group related | Load order |
| Inventory Receipt | 42, 43, 44, 45 (4 files) | inventory/receipt/*.js | Group related | Load order |
| Sales Recognition V2 | 97, 97A-97E (6 files) | sales/v2/*.js | Already modular | Low |
| Treasury | 99, 99A-99D (5 files) | treasury/*.js | Already modular | Low |

**Constraint:** Apps Script V8 loads files alphabetically. Subdirectories require:
1. `.clasp.json` `"rootDir": "src"` 
2. `"skipSubdirectories": false` (already set)
3. Verified upload order

**Recommendation:** Defer until clasp subdirectory deployment is proven in a test project.

---

## Validation Checklist Per Wave

### Wave 1 Validation
- [ ] `git status` shows only expected deletions
- [ ] `git diff --check` passes
- [ ] No broken references in remaining markdown files
- [ ] Repository size reduced by ~20 MB
- [ ] `clasp status` unchanged (no deployed files affected)

### Wave 2 Validation
- [ ] `git status` shows moves (not deletions)
- [ ] `node scripts/preflight/index.js` passes
- [ ] `node scripts/preflight/test.js` passes
- [ ] `node scripts/opencode/session-shell.mjs --help` works (if applicable)
- [ ] Browser tests run: `npx playwright test tests/browser/specs/`
- [ ] Local harness: `node tests/browser/harness/assemble-html.js` works
- [ ] `clasp status` unchanged

### Wave 3 Validation
- [ ] `git status` shows moves
- [ ] All markdown links resolved (run link checker if available)
- [ ] Documentation index (README.md) updated if needed
- [ ] `clasp status` unchanged

---

## Rollback Procedures

### Full Rollback (Any Wave)
```bash
git restore .
git clean -fd  # Remove any new untracked directories
```

### Partial Rollback (Specific Wave)
```bash
# Wave 1
git restore docs/evidence/package022/v587/browser-deployed/screenshots/
git restore docs/evidence/finance-phase-11v12d2/
git restore docs/agent-archive/2026-11-02/original/
git restore tests/browser/local-harness/assembled.html
# Remove .gitignore entry for assembled.html

# Wave 2
git restore tests/browser/ scripts/ opencode.json

# Wave 3
git restore docs/
```

---

## Risk Assessment Summary

| Wave | Risk Level | Production Impact | Deployed Files Affected | Approval Required |
|------|------------|-------------------|------------------------|-------------------|
| 1 | LOW | NONE | NO | This audit approval |
| 2 | LOW | NONE | NO | This audit approval |
| 3 | LOW | NONE | NO | This audit approval |
| 4 | HIGH | POTENTIAL | YES | Separate task + owner auth |

---

## Estimated Effort

| Wave | Commands | Time | Validation |
|------|----------|------|------------|
| 1 | 5 rm/mv + 1 gitignore | 5 min | 5 min |
| 2 | 15 mv/mkdir + 2 config edits | 15 min | 10 min |
| 3 | 20 mv/mkdir | 10 min | 5 min |
| **Total** | **~40 operations** | **~30 min** | **~20 min** |

---

## Success Criteria

- [ ] Repository size reduced by ≥30 MB
- [ ] Zero deployed files modified
- [ ] All validation checks pass
- [ ] Git history clean (only moves/deletes of non-production files)
- [ ] No broken references in documentation
- [ ] `clasp status` identical to pre-cleanup
- [ ] `clasp push --force` would deploy identical payload