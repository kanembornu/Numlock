# Off-repo retirement — inventory, parity, and retention manifest

Date: 2026-10-07  
Baseline: `e1dd3e8` (P-1 committed, worktree clean before stage 2)  
Scope: repository-side stage 2 of off-repo retirement. No deletion performed; no Git mutation; no `clasp`; no Drive writes. External inventory and measurements come from stage 1 (read-only Drive metadata probe). *(Historical stage-2 scope statement; current external state is recorded in **Closure status (2026-10-07)** below.)*

## Measured evidence (stage 1)

| Measure | Result |
|---|---|
| `MEASURED_SHA256` of `docs/evidence/finance-phase-11r/inventory-opening-evidence-intake.xlsx` | `c7335b1d155cb8ee7cce10983b0fa2986efd950d502514038d13bfe124296dd9` (28,029 bytes) == `RECORDED` (`drive-artifact-map.json.frozenSha256`) — **MATCH** |
| Finance parity (Group5 vs repo) | **COMPLETE at ID + name + byte-size**: 21/21 `CONV-ATT-ING-*` Drive files match `finance-phase-11n8/manifests/` sizes exactly and all 21 Drive IDs match `drive-evidence-map.json`; MOS manifest 2,382 B == `11u1/MANIFEST-MOS-ING-018-V01.manifest`; xlsx 28,029 B == 11R copy. Content re-download of Drive copies returned 403 (`drive.file` scope not granted) — hash re-verification of external copies is unavailable; repository bytes are authoritative |
| MOE Group1 (`numlock-monetary-opening-evidence-publication-20261003`) | **NOT_FOUND on Drive** — zero hits across exact/broad/case-folded name searches; a local source snapshot existed at `~/Documents/GitHub/numlock-monetary-opening-evidence-publication-20261003` (93 files, 2026-10-03), audited in stage A: hash inventory + classifications recorded in `legacy-retirement/manifest.json` (`LOCAL_MOE_PARITY=COMPLETE`) — **since DELETED; see Closure status** |
| Group2 `1bfrHipWW4eA0359cVlRh1WlFxiAS1KBh` | Archive folder (trashed=false at stage-1 observation) with sheet `1bmhRP04…` (237,496 B) + form `1xc-7bITf4…`; content then not in repo (**preserved in stage A — see Closure status**) |
| Group3 `1OOu5L5BTH25hkTEaxO799xxWiJhjOSZS` | Pre-schema DB backup folder (trashed=false at stage-1 observation) with sheet `1EKR8EU4…` (203,958 B) + form `1EDN9R17…`; content then not in repo (**preserved in stage A — see Closure status**) |
| Group4 | Sheet `1ubfWtRV…` = production `SPREADSHEET_ID` (`36.Finance.Service.js:13`, `37.Inventory.Policy.Evidence.js`); form `1JoBrrco…`; two "Copy of Numlock Transaction" forms (= Group2/3 forms); 2 CSV exports in `Mac  Backup`. Linked-form/respondent metadata UNKNOWN — Forms/Sheets APIs disabled for client project (BLOCKED_CAPABILITY), no submission attempted |
| Group5 `1zQItP3ggR7eli7U0RGgpXeWSsM3WBzhT` | 24 objects: MOS manifest `1Gyv4scq…` + subfolder `1Un69xog…` (xlsx + 21 CONV txt), all trashed=false *(stage-1 observation; **subsequently observed trashed=true by external actor — see Closure status**)* |

## Inventory, classification, and deletion consequence

Classification vocabulary: `DUPLICATED_IN_REPO` (bytes/identity preserved repository-side), `PROVENANCE_ONLY`, `PRESERVE_REQUIRED` (evidence not in repo), `PRODUCTION_AUTHORITY`, `CONTAINER`, `NOT_FOUND`, `SAFE_TO_DELETE`.

| External object | ID | Parent | Type | Classification | Repo authority | Deletion consequence (if executed later, off-repo, separately authorized) |
|---|---|---|---|---|---|---|
| NUMLOCK Finance Phase 11N.9 Immutable Attestation Evidence (folder) | `1Un69xogJ5s64xO6iRM7PBXLTJ-GMlynu` | `1zQItP3g…` | folder | DUPLICATED_IN_REPO | `docs/evidence/finance-phase-11n8/` (manifests + `drive-evidence-map.json`) | none for repo runtime — all refs are provenance-only after retirement |
| inventory-opening-evidence-intake.xlsx (Drive copy) | `1898Qe_MaTR6JMVOLnQN9z9Us1cwxOgX2` | `1Un69xog…` | xlsx | DUPLICATED_IN_REPO (SHA `c7335b…` measured == recorded) | `docs/evidence/finance-phase-11r/inventory-opening-evidence-intake.xlsx` | none; repo copy is authoritative |
| 21 × CONV-ATT-ING manifest .txt | see `40.Inventory.Conversion.Population.js:10-30` pins | `1Un69xog…` | text/plain | DUPLICATED_IN_REPO (21/21 ID+size parity) | `docs/evidence/finance-phase-11n8/manifests/` | none; `GDRIVE:` refs remain provenance strings |
| MANIFEST-MOS-ING-018-V01.manifest (Drive copy) | `1Gyv4scq6wm-VpEKcxcQg3iVxeHmmIiKV` | `1zQItP3g…` | text/plain | DUPLICATED_IN_REPO (size 2,382 == repo) | `docs/evidence/finance-phase-11u1/MANIFEST-MOS-ING-018-V01.manifest` | none |
| NUMLOCK Finance Evidence (folder) | `1zQItP3ggR7eli7U0RGgpXeWSsM3WBzhT` | My Drive `0AB2LJ6X…` | folder | CONTAINER (retire with children) | n/a | none once children removed |
| Pre Legacy Decommission Archive folder/sheet/form | `1bfrHipWW4eA0359cVlRh1WlFxiAS1KBh`, `1bmhRP04oxoRQPM7yXOpm6L7e2ULLAZn6kOrgc0lNtt4`, `1xc-7bITf4UnVVsBDMRjUnXP8qxexCs25HDK4aTVQ56s` | `1yNsL8bVK…` | folder/sheet/form | Sheet **PRESERVED** as `legacy-retirement/` workbook (970b6380…, 20 sheets); form definition captured (`form-capture-1xc…json`), responses UNKNOWN → **BLOCKED_FORM_PRESERVATION** | `docs/evidence/legacy-retirement/` | folder/form deletion loses only uncaptured form responses (count UNKNOWN) |
| Numlock DB Backup Pre Schema V1 folder/sheet/form | `1OOu5L5BTH25hkTEaxO799xxWiJhjOSZS`, `1EKR8EU4nw_kpqb-bvp9jV0AAEasWsssMwuJ7e3fBCWg`, `1EDN9R177P4hQlg4NaFQADwV1P66ZASVNQbBiCb_kfC8` | `1yNsL8bVK…` | folder/sheet/form | Sheet **PRESERVED** as `legacy-retirement/` workbook (23daa262…, 8 sheets); form definition captured (`form-capture-1EDN…json`), responses UNKNOWN → **BLOCKED_FORM_PRESERVATION** | `docs/evidence/legacy-retirement/` | folder/form deletion loses only uncaptured form responses (count UNKNOWN) |
| Numlock Transaction (production sheet) | `1ubfWtRVdrToBYZIxewgT9H-scIeszZHDUHDrLd64e9M` | `1yNsL8bVK…` | sheet | **PRODUCTION_AUTHORITY — KEEP** | `36.Finance.Service.js`, `37.Inventory.Policy.Evidence.js` | destroys live production data — not a deletion candidate |
| Numlock Transaction (production form) | `1JoBrrcocWbNOxKTbtpBmsRH10L7vOKDZqz6WSdHFdIc` | `1yNsL8bVK…` | form | **PRODUCTION_AUTHORITY — KEEP** (linkage UNKNOWN) | production sheet above (presumed destination) | live respondent capture loss |
| NUMLOCK Database (folder) | `1yNsL8bVK_scNkJZL6tXeSASnAXUjEEfF` | My Drive | folder | CONTAINER — KEEP | n/a | holds production assets |
| `Mac  Backup` folder + `Theme 5 - Numlock Mac Final1 - Dash.xlsm` + 2 CSV exports | `1yq3VxBgHgFsYJ4RhBEUh46fODxOsSur5`, `1bJVvxEv6…`, `17KcX1ft…`, `1CBAYiup…` | My Drive | folder/xlsx/csv | PROVENANCE_ONLY (xlsm named by `scripts/phase3-historical-ledger-migration.js:23`) | migration script (local `.local/migration/` path) | source-system backup loss; not runtime-bound |
| Numlock Datasets Training.xlsx | `1nuhYfFA97i63rT5ANptTsT1kp0x1FGbb` | `1yNsL8bVK…` | xlsx, **trashed=true** | SAFE_TO_DELETE (trash purge) | none | none |
| MOE publication object | n/a | n/a | n/a | NOT_FOUND | `docs/evidence/finance-phase-13moe.md` | n/a |

## Retention decisions (stage 2)

1. **Finance evidence set (11N.9 folder, 21 CONV txt, xlsx copy, MOS copy, `1zQItP3g…` container):** repository is self-sufficient (manifests + xlsx + SHA pins + verifiers). External copies are DUPLICATED_IN_REPO; deletion is permissible **only** under a separate, explicitly authorized off-repo task. Prior README no-delete sentence superseded by repository-authoritative policy (`docs/evidence/README.md`).
2. **Group2/Group3 archive & backup sets:** originally PRESERVE_REQUIRED (not present in repository); **stage A preserved both workbooks byte-for-byte into `docs/evidence/legacy-retirement/` — decision superseded by Closure status.**
3. **Group4 production sheet/form:** KEEP — live production authority, never a deletion candidate.
4. **Trashed training workbook:** SAFE_TO_DELETE (already in trash; purge is an owner decision).
5. **Container folders:** follow their contents.

## Repository retirement implementation (stage 2, this change)

- `41.Inventory.Opening.Staging.js`: `verifyFrozenArtifactDriveBytes()`, `runInventoryOpeningTemplateParserDiagnostic()`, `authorizeFrozenOpeningArtifactPublication()`, `publishFrozenOpeningArtifact()` replaced with deterministic fail-closed refusals (`status: REFUSED`, `reason: OFF_REPO_EVIDENCE_RETIRED`, `detail: REPOSITORY_AUTHORITATIVE_EVIDENCE_REQUIRED`, `writeCount: 0`); retained IDs/SHA are labeled provenance pins; review disposable proof updated to expect the retirement refusal; disposable trash helpers still touch only self-created spreadsheets.
- `40.Inventory.Conversion.Population.js`: all three Drive `readManifestBytes` closures replaced with `throw new Error("OFF_REPO_EVIDENCE_RETIRED")`; population/activation wrappers now return `REFUSED`/`OFF_REPO_EVIDENCE_RETIRED` via existing catch paths; disposable proofs convert the retirement error into the same deterministic status; `MANIFESTS`/Lemon `FILE_ID` labeled provenance-only; recovery wrappers unchanged (record-gated, no evidence reads); future activation requires a separately authorized design.
- `docs/evidence/finance-phase-11n8/finalize-drive-evidence.js`: operational use neutralized — exits `REFUSED`/`OFF_REPO_EVIDENCE_RETIRED`, performs zero writes, retains ID map as provenance.
- `96.Tests.Inventory.Opening.Staging.Cases.js`: Drive expectations replaced with zero-DriveApp-call spies and refusal assertions; frozen SHA pin proven against repository bytes; new `testOffRepoEvidenceRetirementContracts()` proves fail-closed wrappers, provenance pins, and repository-authoritative conversion integrity (21 manifests + Lemon manifest hash-checked from repo bytes).
- `docs/TESTING.md`, `docs/evidence/README.md`: retention/behavior statements updated to repository-authoritative, provenance-only semantics.

**RUNTIME_REFERENCE = 0 and OPERATIONAL_REFERENCE = 0 for every deletion candidate**: no executable code path fetches, publishes to, or validates against any listed external object; surviving hits are PROVENANCE_REFERENCE/HISTORICAL_REFERENCE only (sweep table in the stage-2 task report).

## Measured validation (stage 2)

| Check | Result |
|---|---|
| `node --check` on changed `.js` | PASS (41, 40, 96 staging tests, finalize script) |
| `node _test_runner.js` | PASS — 41 PASS, 0 FAIL (runner does not load the staging suite; count structurally cannot change without editing forbidden `_test_runner.js`) |
| Staging suite via local vm harness (repo sources + service mocks) | PASS — **61 scenarios**, `productionMutation=false`, `REPO_BYTES_BLOCK_ACTIVE=true` (historical Apps Script baseline: 56 scenarios) |
| `testInventoryConversionAuthorityContracts` via local vm harness | PASS — 54 scenarios |
| `git diff --check` | clean |
| `git status --short` | authorized files only + this document |

## Closure status (2026-10-07)

Post-deletion verification state recorded at HEAD `46c01b7` (worktree clean before this edit).

- **FINAL_PRESERVATION_COMMIT:** `46c01b7` — legacy workbooks preserved byte-for-byte under `docs/evidence/legacy-retirement/`:
  - `NUMLOCK — Pre Legacy Decommission Archive — 2026-08-31.xlsx` — 1,374,327 B, SHA256 `970b6380c7abb69e1230f6214ad1a081f47ed8fcc0d7652dcfd7ada5f47d28e8`
  - `Numlock DB Backup - Pre Schema V1 - 2026-08-13 0954.xlsx` — 986,479 B, SHA256 `23daa2623c0e86d68d9b29f656e202dfc31054efc4043fe0a2583e0493915a36`
  - Manifest revalidation post-deletion: PASS (bytes + SHA256 + worksheetCount, both files).
- **Local MOE publication directory:** `/Users/azer/Documents/GitHub/numlock-monetary-opening-evidence-publication-20261003` — hash parity was **COMPLETE** pre-delete (93/93 files, `LOCAL_MOE_PARITY=COMPLETE`, 0 REQUIRED_TO_PRESERVE); directory now **DELETED** (verified absent at closure verification).
- **Finance Evidence folder `1zQItP3ggR7eli7U0RGgpXeWSsM3WBzhT` + children (11N.9 folder `1Un69xog…`, xlsx copy `1898Qe_Ma…`, MOS manifest copy `1Gyv4scq…`, 21 CONV manifest copies): TRASHED** — observed externally via metadata GET (`trashed=true`); repository bytes authoritative since `1be6467`. **Agent mutation count: 0.**
- **Legacy spreadsheets `1bmhRP04oxoRQPM7yXOpm6L7e2ULLAZn6kOrgc0lNtt4` and `1EKR8EU4nw_kpqb-bvp9jV0AAEasWsssMwuJ7e3fBCWg`: SAFE_TO_DELETE_MANUALLY** — `trashed=false` observed; pending owner trash (OAuth token still lacks Drive write scope; no agent write path).
- **Copy forms `1xc-7bITf4UnVVsBDMRjUnXP8qxexCs25HDK4aTVQ56s` and `1EDN9R177P4hQlg4NaFQADwV1P66ZASVNQbBiCb_kfC8`: BLOCKED_FORM_PRESERVATION** — definition JSON preserved (`legacy-retirement/form-capture-*.json`); responses unknown; Forms API disabled (`SERVICE_DISABLED`); deletion blocked until owner verifies/exports responses.
- **Folders `1bfrHipWW4eA0359cVlRh1WlFxiAS1KBh` and `1OOu5L5BTH25hkTEaxO799xxWiJhjOSZS`: KEPT** pending form resolution (blocked child). **NUMLOCK Database `1yNsL8bVK_scNkJZL6tXeSASnAXUjEEfF`: KEEP.**
- **Anomaly:** production form `1JoBrrcocWbNOxKTbtpBmsRH10L7vOKDZqz6WSdHFdIc` observed `trashed=true` — **not agent-caused; owner confirmation / untrash decision required. Agent mutation count: 0.**
- **Closure verification (MEASURED):** `node _test_runner.js` 41 PASS / 0 FAIL; staging vm harness 61 scenarios PASS; conversion vm harness 54 scenarios PASS; `git diff --check` clean; reference sweep spot-check RUNTIME_REFERENCE=0, OPERATIONAL_REFERENCE=0 for all candidate IDs including legacy IDs; `INVENTORY_RECEIPT_ACTIVATION.enabled=false` unchanged (no source diff since `46c01b7`); no untracked non-ignored files (all stray paths are pre-existing gitignored artifacts: `.DS_Store`, `.codegraph/`, `.opencode/`, `.local/`, documented excluded snapshots).
- **State result: `NUMLOCK_OFF_REPO_RETIREMENT_PARTIAL`** — external trash of Finance evidence observed, legacy sheets and blocked forms plus the production-form anomaly remain open owner actions.
