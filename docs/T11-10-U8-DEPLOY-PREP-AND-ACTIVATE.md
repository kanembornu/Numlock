# Treasury T11.10 — U8 Deploy, PREP and Activate

STATUS: **BLOCKED_AT_H_ACTIVATION** — deployed + PREPARED; activation refused
fail-closed by the reviewed in-lock writer (zero writes); production parked at
the defined safe checkpoint (77-file runtime @714 + PREPARED, legacy routing
authoritative). No rollback, no ad-hoc repair.
TASK_ID: T11_10_U8_DEPLOY_PREP_AND_ACTIVATE
PHASE: NUMLOCK_SINGLE_COMMIT_TRANSACTION_ARCHITECTURE
BASELINE_COMMIT: `13dd460273936e2d0274d7cee851656933a68235` (T11.9/U7 evidence commit)
CLASSIFICATION: ANY · R4 · REASONING_EFFORT high · Execution BLOCKED (prerequisite)
AUTHORITY: task prompt T11.10/U8 (owner-authorized 3 mutations + read-only) +
owner gate approval of the recorded order deviation (§3) +
`docs/T11-2-SINGLE-COMMIT-TRANSACTION-CONTRACT.md` §20–§24 +
`docs/T11-7-U5` §6/§7/§16/§17 + `docs/T11-9-U7` + T9 §4 precedent.
REGRESSION: **227 PASS / 0 FAIL** (MEASURED, `node _test_runner.js`, on final
source; suite total unchanged, assertion flips only).

---

## 1. Status and baseline

| Field | Value |
| --- | --- |
| Local baseline | HEAD `13dd460`; baseline tracked-clean (0 modified, 0 staged); 45 untracked `tests/tmp/**` harness byproducts (classified, pre-existing) |
| Local regression | 227/0 MEASURED pre-registration and post-registration (final) |
| Prospective package | exactly 77 reviewed T11 files, aggregate `e7a1b36e89efeef512b99b51a3654a2e5a6fbae67603fe5e7faf36c8f397ef60` = frozen U7 prospective-77 hash (exact, zero diff) |
| Control plane SHA256 | `cd052ff2b4fb59037c82baf4b13d45fa6512c8a686270c8a61d9f34dd9e1fb2c` = frozen U5 value |
| Production @ precheck | pinned deployment `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` @713, 76 files, byte-identical to pre-T11 base `c7aca33`; T11 config ABSENT; projectUpdateTime `2026-10-10T17:37:43.269Z` |
| Production @ final | same pinned deployment @**714**, 77 files byte-identical to local package; config **PREPARED** (identity empty); projectUpdateTime `2026-10-12T21:37:10.993Z` (deploy step); HEAD content unchanged after deploy |
| Result | **BLOCKED_AT_H_ACTIVATION** — activation prerequisite `Suppliers` schema absent in production (§19); zero financial mutation throughout |

## 2. Scope and authorization

Owner-authorized (only): (1) one ABSENT→PREPARED config transition via the
reviewed U5 PREP writer; (2) one deployment of the exact reviewed 77-file
runtime; (3) one PREPARED→ACTIVE via the reviewed U5 activation writer; plus
required read-only verification. Zero business/financial transactions; U8 ends
with no T11 financial events; first real transaction remains U9.

Prohibitions enforced throughout: no Sales/Expense/Purchase/Void/Cancel/
Correct execution; no Treasury receipt; no BalanceLedger/PurchaseEvents/tabops/
Orders/SalesRecognitionEvents/Logs writes; no 24k close; no Accounts/1040
modify; no alteration of 1000/1010/1020/1030/2000/2010/4000/6210; no EvidenceRef
fabrication; no Git push; no second deployment; no activation before
deployed-runtime validation; no unrelated drift repair.

## 3. Order-deviation record (owner-gated, architecture-forced)

Frozen task order C→E required PREP **before** any upload ("deployment still
@713" verified after PREP). Measured impossibility:

1. `prepareSingleCommitTransactionV1Production` exists only in
   `101.SingleCommit.Config.Control.js`, which was not allowlisted and not in
   the deployed 76-file runtime (U7 token scan + fresh U8 Phase-B scan: **0
   hits** for every control-plane token across all deployed files).
2. `PropertiesService` has no REST surface; no deployed function writes the
   `SINGLE_COMMIT_TRANSACTION_V1` property (U7 §12 writer inventory + U8
   re-verification).
3. Therefore PREP cannot execute until the writer code reaches production.

Repo authority: T9 doc §4 froze the identical architecture-forced sequence
(source replacement is inert — no writer runs on load — then invoke prep).
Inertness proof for this task: with config ABSENT, the U5 routing matrix keeps
Sales legacy-no-composed-leg and Expense/Purchase LEGACY; the pinned versioned
deployment stayed @713 until step 3; every step had a defined safe checkpoint.

Owner approval (verbatim rationale recorded): "order deviation
(upload-before-PREP) follows T9 §4 frozen precedent; mechanically forced by
undeployed writer; all safety invariants preserved (step 1 leaves config ABSENT
→ legacy routing authoritative, pinned deployment stays @713 until step 3;
each step has defined safe checkpoint). No new business semantics authorized."
Approved 6-step gate: manifest gate → ONE push → PREP ×1 → verify → ONE deploy
→ 22-check hard gate → ONE activation → acceptance. Executed exactly that.

## 4. Local release precheck (task A) — PASS

| Check | Measured |
| --- | --- |
| HEAD | `13dd460273936e2d0274d7cee851656933a68235` (exact expected commit, no descendants) |
| Worktree at baseline | 0 modified, 0 staged; 45 untracked, all `tests/tmp/**` |
| Regression | 227/0 MEASURED (`node _test_runner.js`) before and after registration edits |
| `git diff --check` | green at every file-changing checkpoint |
| Push since baseline | none (main ahead of origin/main; no push performed) |
| node/static | suite exit 0; registration assertion flips keep total 227 PASS |

## 5. Package measurement and registration (task A) — PASS

Baseline measurement (pre-registration): allowlist 76 entries; live aggregate
`b6c4644e8074f686850eb9756d094da4c521aee65a45e7062f8d7b48cce2dc83` ==
stored manifest == U7 record (zero drift); prospective-77 computed aggregate
`e7a1b36e…` == frozen U7 prospective hash; control-plane sha `cd052ff2…` ==
frozen U5 value. No unreviewed runtime delta.

Registration (the authorized upload unit's deferral resolution, U5 §17 / U7 §4,
T9 §6 precedent — the only source-tree edits of this task):
`.claspignore` +`!101.SingleCommit.Config.Control.js` (76→77);
`96.Tests.SingleCommit.Config.Cases.js` P1/P2/P3 flipped to the registered
state; `96.Tests.SingleCommit.Corrections.Cases.js` GR108 76→77;
`96.Tests.Treasury.Receipt.Preparation.Cases.js` T9Q1/T9Q6 76→77;
`tests/browser/treasury-t8-release-gate.js` PKG_CURRENT_COUNT /
PKG_PROSPECTIVE_COUNT 76→77; `tests/tmp/t8-package-manifest.json` regenerated
(current=77, aggregate `e7a1b36e…`). No runtime JS behavior change; no
application file touched.

## 6. Fresh production precheck — deployment/runtime (task B) — PASS

`tests/tmp/t1110-precheck.js` (GET-only) — **19/19 PASS**:

- Deployments: exactly 2 (HEAD + pinned @713, updateTime `2026-10-10T17:39:10.259Z`);
  projectUpdateTime `2026-10-10T17:37:43.269Z`.
- Content == version 713, 76 files, byte-identical to pre-T11 base `c7aca33`
  (0 name drift, 0 content drift); deployed set == 76-era allowlist exactly.
- Local-vs-deployed delta inventory: **+1** added (`101.SingleCommit.Config.
  Control.js`), **14** changed (U1–U6 runtime: 21, 22, 36, 39, 40.Cash, 47,
  95A, 97, 97A, 97C, 99B, 190, 194, 195), **62** identical. The upload unit
  under authorization, nothing else.

## 7. Fresh production precheck — T11 config absence chain (task B) — PASS

Three-link chain, all measured read-only: (1) zero control-plane/T11-writer
tokens in any of the 76 deployed files; (2) `101…` not present in deployed
content; (3) no T11 artifact sheets/rows anywhere (§10). Conclusion: T11
config **ABSENT** at U8 entry — consistent with the frozen checkpoint.

## 8. Fresh production precheck — Accounts and 1040 (task B) — PASS

Accounts: 23 data rows, 9-column header exact. `1040` exactly **1** row, all
fields exact (`Operational Funds` / `Asset` / `Current Assets` / `Operating` /
IsActive TRUE / `DEBIT`, timestamps serial `46307.865382337965`). Protected
authorities 1000/1010/1020/1030/2000/2010/4000/6210: each exactly once.
BalanceLedger: 8 rows; 1040 lines **0** (balance 0); 1030 net **24,000** (1 line).

## 9. Fresh production precheck — Sales V2 / Treasury / transitional (task B) — PASS

- `salesRecognitionV2OperatorConfig`: ACTIVE, `b4791011-120e-4985-92da-a61c6311060c`, configVersion 1.
- `getTreasuryOperatorWorkspace`: mode ACTIVE, allowed.
- `getTreasury1030Reconciliation`: OK — ledgerNet1030 24,000, outstanding 24,000,
  unexplainedResidual **0**, malformed lines 0, activeClearings 0.
- Transitional `SCR-CE122B27-ORD677BE5CES` present once, COMMITTED/UNCLEARED,
  24,000 exposure; TreasuryReceipts/Operations/Audits rows **0** each
  (headers 24/10/11 exact).

## 10. Pre-U8 fingerprint baseline (task B) — CAPTURED

`/tmp/opencode/u8-pre-fingerprints.json`: row-count + sha16 fingerprints for
BalanceLedger, Accounts, SalesRecognitionEvents/Audits, TransactionOperations,
Orders, OrderLines, Payments, Settlements, InventoryLedger, tabsal, tabops,
Logs, Settings, Products, ProductPricing, TreasuryReceipts/Operations/Audits.
This is the zero-mutation baseline re-verified after every step (§11/§14/§21).

## 11. Step 1 — manifest gate + ONE `clasp push --force`

- `clasp status` gate: **77 tracked files == 77 allowlist entries exactly**
  (0 missing, 0 extra; no tests/docs/tmp/`.clasp.json`); full output archived
  `/tmp/opencode/u8-clasp-status.txt`.
- **`clasp push --force` ×1** (Rule 7 respected — never repeated):
  "Pushed 77 files", exit 0; archive `/tmp/opencode/u8-clasp-push.txt`.

## 12. Step-1 checkpoint — PASS 8/8

`tests/tmp/t1110-postpush-check.js` (read-only): HEAD content **77 files
byte-identical** to the local reviewed package (per-file sha256 equality, 0
mismatch, 0 missing); pinned versioned deployment **still @713** (76 files,
no control plane — version transition not yet performed); HEAD carries the
control plane; **all protected fingerprints unchanged** vs §10; 1040 exact;
ledger 1030 net 24,000 / 1040 lines 0. Config ABSENT (no writer invoked).

## 13. Step 2 — PREP ×1 (EXACTLY ONE write)

`tests/tmp/t1110-prep-once.js`: **one** zero-parameter Execution-API
invocation of `prepareSingleCommitTransactionV1Production()`:

| Field | Value |
| --- | --- |
| Invocation count | **1** (HTTP 200) |
| Status | `PREPARED` |
| Writes | config **1**, sheets 0 |
| Config readback (five fields) | mode `PREPARED`, contractVersion `SINGLE_COMMIT_TRANSACTION_V1`, activationID `""`, activatedAt `""`, configVersion 1 |
| Financial delta | **0** |

Verification invocations of the same writer later (§16, §20) were the reviewed
idempotent `NOOP_ALREADY_PREPARED` path with writes 0/0 — readback only, never
a second transition.

## 14. Step-2 checkpoint — PASS 8/8

Post-PREP read-only re-run of the §12 harness: content 77 unchanged; pinned
deployment **still @713**; fingerprints delta {}; 1040 exact; transitional
24,000 / 1040-lines 0. PREPARED held; legacy routing authoritative.

## 15. Step 3 — ONE `clasp deploy` (version transition)

`clasp deploy -i AKfycbxyll_…KxkX6q -d "Treasury T11.10 U8: single-commit
architecture activation runtime"` ×**1** → **"Deployed … @714"**, exit 0.
Deployment identity/URL semantics preserved (same pinned deployment id;
deployments remain exactly 2). Exactly one upload + one version transition in
the whole task. Git push: 0.

## 16. Step 4 — post-deploy / pre-activation hard gate — PASS 22/22

`tests/tmp/t1110-postdeploy-gate.js` (read-only), final run 22/22:

| Gate | Result |
| --- | --- |
| F1 deployment identity | 2 deployments, pinned id unchanged, pinned updateTime `2026-10-12T21:37:10.993Z` |
| F2 version 714 | HTTP 200, **77 files, byte-identical** to local package (0 mismatch/missing) |
| F3 config still PREPARED | reviewed idempotent NOOP readback: `NOOP_ALREADY_PREPARED`, writes 0/0 |
| F4/F5 config reader + routing | five-field PREPARED readback exact; config gate present in deployed entry dispatchers; expense/purchase correction + sales-correction (`salesV2SingleCommitGate_`) admission gates present in deployed sources |
| F6 control plane deployed | prep/activation entries + idempotency path present |
| F7/F9 aggregate 1040 | deployed `AGGREGATE_MONEY_ACCOUNT_CODES = ["1000","1010","1020","1040"]` (byte-verified) + in-lock gate 10 will re-prove at runtime |
| F8 1040 validator | exact once, all fields exact |
| F10 1040 balance | 0 (0 ledger lines); 1030 net 24,000 |
| F11 authorities | 1000/1010/1020/1030/2000/2010/4000/6210 exact-once active |
| F12 readers | `getFinanceData` + `getCashFlowData` HTTP 200 with results; `runFinanceFinalReadinessEvidenceDiagnostic` READ_ONLY, WRITE_COUNT 0, finance cases PASS |
| F13 Sales V2 | ACTIVE, `b4791011-…`, v1 |
| F14 Treasury | mode ACTIVE allowed |
| F15/F16 T5 | projection contains `SCR-CE122B27-ORD677BE5CES`/24000; reconciliation OK, residual 0 |
| F17/F18 transitional | SCR row once; Treasury sheets rows 0/0/0 |
| F19 fingerprints | delta **{}** (all 19 surfaces unchanged vs §10) |
| F20 artifacts | 0 T11 business artifacts |
| F21 cash diagnostic | HTTP 200, readOnly true, writeCount 0 |
| F22 no drift | HEAD content == version 714 |

Note: Balance Position partial probe returns HTTP 200 with degraded
`finalValues: null` (balanceSheetAvailable false) — the pre-existing Policy-C
finalization/opening-balance data state, independent of T11 and unchanged by
this deployment; recorded informationally, not a gate failure.

## 17. PREPARED safety window evidence (task D) — PASS

Between PREP and activation (and still now): config PREPARED-never-activated →
per the frozen U5 routing matrix, Sales allowed legacy-no-composed-leg,
Expense/Purchase LEGACY; only ACTIVE flips dispatch. Proven by: (a) PREPARED
five-field readback (§13/§16); (b) byte-verified deployed dispatchers gating on
the config (§16 F5); (c) zero financial fingerprints delta across the entire
window (§14/§16/§21). PREPARED alone admits no T11 writers.

## 18. Step 5 — ONE activation invocation (refused fail-closed)

`tests/tmp/t1110-activate-once.js`: **one** zero-parameter invocation of
`activateSingleCommitTransactionV1Production()`:

| Field | Value |
| --- | --- |
| Invocation count | **1** (HTTP 200) |
| Status | `STOP_PREREQUISITE_NOT_READY` |
| Detail | `SCHEMA:PURCHASE:Suppliers` |
| Writes | config **0**, sheets **0** |
| Identity | none produced (`config: null`) |
| Financial delta | **0** |

The reviewed writer's in-lock gate 3 (`purchaseSingleCommitSchemaGate_`,
U5 §7) requires `Suppliers` readable with the exact 11 canonical
`SUPPLIER_MASTER_CONTRACT.HEADERS`; the sheet is absent in the production
workbook, `readCanonicalTable` throws, the gate fails, and the writer refuses
BEFORE any write. Do-not-weaken rule respected: the reviewed writer was not
modified; no second identity; no re-invocation.

## 19. Root-cause diagnosis (read-only)

- Sheets metadata (live): workbook has 41 sheets. Every activation gate sheet
  exists — PurchaseEvents, Logs, BalanceLedger, TransactionOperations,
  Accounts, ExpenseItems, SalesRecognitionEvents/Audits, tabops, Orders,
  OrderLines, Payments, Settlements — **except `Suppliers`, which is ABSENT**
  (`values/Suppliers` → HTTP 400 "Unable to parse range").
- Config readback (reviewed idempotent path, writes 0): mode **PREPARED**,
  activationID **`""`** — activation was NOT consumed; no identity exists;
  sticky-intent invariants intact.
- Consequence: T11 Purchase (and therefore the single-commit activation) has a
  production schema prerequisite that U1–U7 never established and U8 was not
  authorized to create (U5 froze zero schema changes for the control plane;
  sheet creation is outside the 3-mutation authorization, same class as the
  U7 1040 unit which required its own explicit authorization).

## 20. State after the refusal — safe checkpoint (task K)

Production: **@714 77-file runtime + config PREPARED (identity empty)** — the
task's defined intentional safe state after a failed activation; pinned
deployment @714 (deploy step already completed and verified before the
activation attempt; Rule 7 — no second push; no rollback, no old-runtime
redeploy, no ad-hoc repair, all correctly requiring separate authorization).
Routing: legacy authoritative for Expense/Purchase; Sales legacy-no-composed;
committed T11-era historical data (none exists yet) unaffected; readers
truthful. §12-harness final re-run: 8/8 (content 77, fingerprints delta {},
1040 exact, 24k intact, @713 archive intact).

## 21. Zero financial effect proof (task I partial)

Entire U8 financial delta **ZERO**: BalanceLedger, SalesRecognitionEvents,
SalesRecognitionAudits, TransactionOperations, Orders, OrderLines, Payments,
Settlements, InventoryLedger, tabsal, tabops, Logs, Settings, Products,
ProductPricing, TreasuryReceipts/Operations/Audits fingerprints identical
pre-U8 → post-deploy → post-refusal (three measured comparisons, delta {}).
Accounts unchanged (23 rows, 1040 exact, balance 0). Transitional
24,000/24,000/residual 0 throughout; nothing synthesized; no receipts; no
business transactions; no U9-boundary violation.

## 22. Mutation accounting (task J)

| Surface | Count |
| --- | --- |
| PropertiesService config | **1** (PREP ABSENT→PREPARED; activation writes 0) |
| clasp upload (`push --force`) | **1** |
| clasp deploy / version transition | **1** (@714) |
| Accounts | 0 |
| Financial sheets (all §21 surfaces) | 0 |
| Treasury | 0 |
| Transitional | 0 |
| Git push | 0 |
| Execution API: prepare | 3 total = 1 PREP write + 2 idempotent NOOP verification (writes 0) |
| Execution API: activate | 1 (refused, writes 0) |
| Execution API: readers/probes | read-only (GET-equivalent) |

## 23. Failure checkpoint record (task K)

| Checkpoint | State |
| --- | --- |
| Before PREP | @713 + ABSENT + 1040 (§6–§10) |
| After PREP | @713-pinned + PREPARED, legacy authoritative (§14) |
| After deploy | 77-file @714 + PREPARED, legacy authoritative (§16) |
| Activation result | definitive refusal (not ambiguity) — writes 0, no identity; config re-read PREPARED, activationID empty → NOT consumed, no second identity produced, no blind re-invoke |
| Final | **BLOCKED_AT_H_ACTIVATION** (prerequisite `Suppliers` ABSENT) |

## 24. U9 boundary and transitional invariant (tasks L/M) — RESPECTED

No T11 financial event created; no synthetic Rp1/test transaction; transitional
`SCR-CE122B27-ORD677BE5CES` never reused or closed (24,000 outstanding /
Dr 24,000 / residual 0 / UNCLEARED at every checkpoint). First real transaction
remains `T11_11_U9_FIRST_REAL_TRANSACTION_ACCEPTANCE` — **only after** the
activation prerequisite is established under fresh authorization and T11 goes
ACTIVE.

## 25. Tests and probes (MEASURED)

- Local regression: `node _test_runner.js` → **227 PASS / 0 FAIL**, exit 0,
  run twice (pre- and post-registration), final run on final source.
- Production probes: Phase-B precheck **19/19**; step-1 checkpoint **8/8**
  (×3 runs: post-push, post-PREP, post-refusal); hard gate **18/22 → 21/22 →
  22/22** (F5–F7 were harness key bugs — content API strips file extensions;
  F9 redefined honestly as byte-verified constant + runtime probe); activation
  1 invocation (clean refusal). All production probes read-only except the
  three authorized mutations counted in §22.
- Harnesses (untracked `tests/tmp/` byproducts): `t1110-precheck.js`,
  `t1110-postpush-check.js`, `t1110-prep-once.js`, `t1110-postdeploy-gate.js`,
  `t1110-activate-once.js`.

## 26. Deviations, cosmetic notes, deliberate simplifications

- **Order deviation**: upload-before-PREP, owner-gated, T9 §4 precedent (§3).
- **F9 semantics**: Balance Position runtime probe does not surface `1040` in
  its degraded partial mode; recognition evidence is the byte-verified deployed
  `AGGREGATE_MONEY_ACCOUNT_CODES` constant plus the activation writer's
  in-lock gate 10 (runtime re-proof at the moment of any future activation).
- **Suppliers**: absence is a production-data fact discovered by the reviewed
  writer's in-lock revalidation — not a code defect, not drift, not repaired.
- Cosmetic-only note carried from U7: 1040 CreatedAt/UpdatedAt render as raw
  serials (no validator consumes them; untouched).
- Package-test assertion flips (P1/P2/P3, GR108, T9Q1/T9Q6, PKG_* counts) are
  the documented gate-flip class used by the T9 registration precedent; no
  test logic, fixture, or production contract changed.

## 27. Open issues, recovery plan, next unit, telemetry

- **OPEN_ISSUES: 1** — production `Suppliers` sheet absent blocks T11
  activation (`STOP_PREREQUISITE_NOT_READY / SCHEMA:PURCHASE:Suppliers`).
  Recovery (requires NEW explicit owner authorization, not granted here):
  (a) one schema-prerequisite unit creating `Suppliers` with the exact 11
  canonical headers and zero business rows (U7-style one-shot, with fresh
  precheck/mutation/readback evidence); then (b) one fresh activation
  authorization invoking `activateSingleCommitTransactionV1Production()`
  once (current authorization's activation slot was consumed by the refusal;
  never a second identity — config is PREPARED, so a future successful
  invocation is the first and only identity). No rollback needed: PREPARED is
  a safe, sticky, legacy-authoritative state.
- Evidence: this file; harness byproducts in `tests/tmp/` (untracked, existing
  convention); checkpoint archives in `/tmp/opencode/u8-*.json`.
- Commit: `Treasury T11.10: U8 deploy prep and activate` (evidence doc +
  upload-manifest registration set; **no Git push**).
- **NEXT (after Suppliers prerequisite + activation):**
  `T11_11_U9_FIRST_REAL_TRANSACTION_ACCEPTANCE`.
- Telemetry: agent `numlock-critical` (primary, Free), backend
  `9router/numlock-explore-free`, reasoning deterministic (no Sol escalation),
  fallback none, mutation budget 3/3 authorized (1 config write, 1 upload,
  1 deploy; activation slot consumed as a zero-write refusal), files read ~30
  (source/docs/harness), files modified 6 tracked (registration set) + 1
  evidence doc + 5 untracked harnesses, test runs: 4 regression (227/0 ×4) +
  production probe runs as counted in §25, elapsed Phase-B start
  `2026-10-12T21:2x` → activation refusal + final snapshot ≈ 20 min wall
  (precheck → refusal window `21:33` push, `21:37` deploy, refusal minutes
  later; exact timestamps in archived JSON reports).
