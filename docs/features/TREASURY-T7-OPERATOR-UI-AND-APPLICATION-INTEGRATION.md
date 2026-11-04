# Treasury T7 — Operator UI and Application Integration

**Phase:** NUMLOCK_TREASURY_IMPLEMENTATION
**Task:** T7_TREASURY_OPERATOR_UI_AND_APPLICATION_INTEGRATION
**Classification:** COMPLEXITY L3 · OPERATIONAL_RISK R2 · REASONING_EFFORT high
**Scope:** LOCAL ONLY. Operator-facing Receipts surface + thin server endpoints
over the T3–T6 authority. Zero production writes, zero `clasp` execution, zero
deployment, zero Git mutations from Heavy. UI conforms to authority; it never
creates a second business authority. Frozen-contract conflict never
materialized — `BLOCKED_CONTRACT_CONFLICT` not triggered.
**Evidence classes:** MEASURED = executed this session; SOURCE = repository
source at HEAD `df93982`; PRIOR-MEASURED = accepted T1–T6 evidence (not
re-proven). Final full regression **145 PASS / 0 FAIL MEASURED**
(`node _test_runner.js`; baseline 141 + 4 new T7 suites).

---

## 1. Baseline

- HEAD verified `df93982` (T1 `0b2f05d` → T2 `360c95d` → T3 `a6f0075` → T4
  `67a4818` → T5 `04c2149` → Sol fix `8bb0097` → T6 `df93982`) via
  `git rev-parse`. Tracked worktree clean, index clean, exactly 27 untracked
  `tests/tmp/u10e-*` files untouched at start and end.
- Entering regression **141 PASS / 0 FAIL MEASURED** before any T7 edit.
- Authority precedence applied exactly: T2 contract > Sol correction `8bb0097`
  > T5 canonical projection > T3 foundation > T4/T6 writers > T7 UI.
- Known prior evidence reused (not re-proven): T4 payload contract +
  UNKNOWN/replay semantics; T6 capability conditions; T5 projection +
  reconciliation APIs; existing HTML/JS frontend with `google.script.run`
  transport and nav conventions; U4 stale-cache + Finance liveness precedents.

## 2. UI architecture

- Three new view fragments follow the Finance trio convention, included by
  `190.View.Index.html` scriptlets:
  `202.View.Treasury.State.html` (state, RequestKey/recovery store,
  staleness constants), `203.View.Treasury.Render.html` (pure presentation of
  SERVER values), `204.View.Treasury.Controller.html` (liveness transport +
  workflows).
- One new server module `99D.Treasury.Operator.Api.js` — THIN endpoints only.
- Client never recomputes recognized/cleared/outstanding, ReceiptStatus, or
  quality; every rendered number/status comes from T5 via the server (source +
  behavior audited, §21 M1/M12/M26).
- No second business authority: `99D` contains zero sheet writes, zero
  transport, zero formulas — delegation only (§20 A1–A4).

## 3. Navigation

- Dedicated sidebar entry `data-page="treasury"` ("Treasury", fa-vault icon)
  after Products, following the existing `data-page` button convention; not a
  Sales sub-mode, no new top-level module beyond this one entry.
- `pageContract.treasury = { title: "Treasury", context: "Verified receipts
  over outstanding sales exposure" }`; `showPage("treasury")` →
  `ensureTreasuryReady()`.
- Section `<section id="treasury" class="page" hidden aria-busy="false">` with
  SR-only heading, status region + Retry, action-status region, reconciliation
  strip, and nine view panels (list/saveForm/saveReview/done/detail/reverse/
  reverseReview/correct/correctReview).
- Frozen unrelated sections unchanged (final `git diff` shows only T7-owned
  edits in 190: nav button, section, contract, showPage branch, 3 includes).

## 4. List / projection

- List renders `workspace.receipts` = verbatim `getTreasuryClearingProjection`
  response (T5 `TREASURY_CLEARING_PROJECTION_V1`). Row fields displayed:
  OrderID (reference), RecognitionID, SalesEconomicDate, Recognized, Cleared,
  Outstanding, ClearingStatus (labels Cleared/Uncleared/Exception).
- EXCEPTION rows are visible with their status; they carry no ordinary action
  buttons (only View) because server capability is false (§15).
- Totals/status/quality are never derived client-side; the client only maps
  the server status string to display labels.

## 5. Save workflow

- Flow: Treasury → Receipts (list) → eligible V2 exposure → destination →
  exact amount → Receipt Date → Evidence Reference → Review → Save Receipt →
  Done.
- Review is ONE meaningful layer: recognition ref, amount, destination,
  Receipt Date, Evidence Reference + the note "Save records a verified receipt
  clearing 1030. This is not Revenue creation — Revenue follows Sales
  authority."
- Save dispatches EXCLUSIVELY `treasuryOperatorSaveReceipt` →
  `treasuryReceiptDurableSave` (T4). Never `cashSettleAndPersist`,
  `attemptCashSettlement`, Payment or Settlement writers (§20 A5/A5b).
- Save eligibility UX gate: server capability `canSave` (canonical healthy
  UNCLEARED + allowed mode) re-checked at form open, Review, and submit; T4
  remains the final server gate (U6, M14).
- Double-click / repeat submits are single-flight: one intent → one dispatch
  (U4, U8, M10).

## 6. Destination authority

- Destination options come ONLY from `workspace.destinations`, built by `99D`
  from the Accounts master filtered through `treasuryDestinationEligible`
  (T3) — currently 1000/1010/1020; never hardcoded in UI, 1030 never offered
  (E3, S5/S6).
- Account names are display-only labels; submitted authority is always
  `destinationAccountCode`; server revalidates (T4/T6).
- U14 MEASURED: destination `1030` through the endpoint → `REFUSED
  TREASURY_DESTINATION_IS_CLEARING`, zero writes (E15).

## 7. Date / evidence

- Receipt Date: explicit `<input type="date">` (YYYY-MM-DD), operator-entered,
  validated client-side by format only; Asia/Jakarta semantics and calendar
  validation are server-side (`treasuryValidateReceiptDate`). No implicit
  browser-timezone derivation anywhere.
- EconomicDate is server-derived and never editable — no EconomicDate control
  exists (S8); ReversalDate does not exist on any path (S9, A12) — T2 §9
  server action day only.
- Evidence: fixed `evidenceType: "MANUAL_VERIFIED"` (no selector — single
  type), EvidenceRef required, trimmed 3–200 chars client-side, server
  enforces control-char/card/secret rules; blank rejected (U-flow, M29).
  Hint copy: verification evidence identity, never passwords/PINs/tokens.

## 8. RequestKey lifecycle

- `treasuryNewRequestKey_(kind)` is called exactly THREE times — once per
  intent inside `submitTreasurySaveReceipt` / `submitTreasuryReverse` /
  `submitTreasuryCorrect` (A13: 3 call sites). Never regenerated on
  uncertainty, timeout, navigation, or retry (A14, M9).
- Retry resends the SAME payload object (identical requestKey + facts) —
  U5/L5 MEASURED `second.args[0] === first.args[0]` structurally.
- Regeneration happens only for a genuinely new intent after a terminal
  REFUSED/CONFLICT (failed action cleared on navigation) or after DONE.
- sessionStorage persistence (`numlock.treasury.mutationRecovery`,
  Purchase-recovery precedent; active-app-session scope only — no local
  persistent store) holds the UNKNOWN intent; cleared on DONE/REFUSED/
  CONFLICT/RECOVERY_REQUIRED.

## 9. UNKNOWN / recovery

- Mutation transport failure, stale timeout, or an unrecognized envelope →
  phase `unknown` (identity preserved), wording EXACT: "Receipt status is
  being verified. Retry verification without creating a new receipt."
- Retry = explicit user action → same RequestKey → T4/T6 replay/recovery; no
  automatic financial retry anywhere (M23, L7).
- Return-after-UNKNOWN (re-entry): `ensureTreasuryReady` restores the
  persisted intent WITHOUT auto-dispatch; operator clicks Retry (U5, L4).
- REFUSED/CONFLICT/RECOVERY_REQUIRED are terminal server answers: shown with
  code, recovery store cleared, no retry button — adjust and start a new
  intent.

## 10. Done semantics

- Done panel appears only after a server `status === "DONE"` from T4 (U3:
  before the response the view is still Review; M11 caught).
- Clearing Status on the Done panel comes ONLY from the immediate T5-derived
  reread (`getTreasuryOperatorReceiptDetail`); before the reread it shows
  "Being verified…", never "Cleared" (M12).
- Verification read failure → "Verification failed — retry verification"
  (read-only retry, same requestKey untouched).
- Done click → list + fresh projection dispatch (post-mutation refresh, M30).

## 11. Receipt detail

- Detail endpoint returns: exposure row (T5), sanitized receipt rows
  (receipt ID, type, lineageRole ORIGINAL/REVERSAL/REPLACEMENT, derived
  ReceiptStatus ACTIVE/REVERSED, amount, destination, ReceiptDate, EvidenceRef,
  journal ref, operation state, reason, actor, receivedAt), and capability.
- SnapshotJSON and JournalSignature are structurally excluded (E10); no
  snapshot JSON in normal UI.
- Correction lineage is displayed as appended rows; original history is never
  rewritten (server byte-identity MEASURED F7; client renders the original
  alongside reversal + replacement — M18).

## 12. Reversal workflow

- Flow: detail → Reverse Receipt → required Reason (3–200) → Review →
  Reverse Receipt → `treasuryOperatorReverseReceipt` (T6) → immediate T5
  reread.
- Capability is server-supplied (`canReverse` + `actionReason`), never
  CLEARED-only browser inference (M15).
- NO editable ReversalDate field exists (S9); the server action-day date is
  displayed from the reread after completion.
- Payload: `{ requestKey, treasuryReceiptID, reason }` — operator facts only
  (A12, U7); double-click → one reversal (U8).
- Post-reverse T5 reread: CLEARED → UNCLEARED, outstanding restored, residual
  0 (F1–F3 MEASURED server-side; U7 client-side).

## 13. Correction workflow

- Flow: detail → Correct Receipt → corrected Destination/Receipt Date/
  Evidence Reference + required Reason → Review → Correct Receipt →
  `treasuryOperatorCorrectReceipt` (T6) → T5 reread.
- Amount is NEVER a client fact (payload has no `grossAmount`, U9); the
  review displays the full exposure read-only (A11).
- Post-correct T5 reread: CLEARED with replacement active, destination 1010,
  three-receipt lineage, original bytes unchanged (F5–F7 MEASURED; U9/U10
  client-side).
- Correct UNKNOWN: same key replay, exactly one lineage — one reversal of the
  original, one replacement (F11–F12 MEASURED; U10 client-side).

## 14. Action capabilities

- `getTreasuryOperatorWorkspace` returns `capabilities[recognitionID] =
  { canSave, canReverse, canCorrect, actionReason }` and
  `mode { mode, allowed, code }`; detail returns per-receipt
  `{ canReverse, canCorrect, actionReason }` — server-derived advisory UX
  metadata (app naming: capability + reason, mirroring `canVoid`/`immutableReason`
  precedents).
- Derivation reads ONLY server facts (T5 row + T3/T4 mode gate + receipt
  lineage): healthy UNCLEARED → canSave; healthy CLEARED with active ordinary
  receipt → canReverse/canCorrect; gate refused → reason = frozen config code
  (E14 fail-closed); EXCEPTION → `EXPOSURE_EXCEPTION`; CLEARED w/o active
  receipt → `NO_ACTIVE_RECEIPT`; un-merged exposure states → `NOT_CLEARED` /
  `NOT_AN_ACTIVE_RECEIPT` / `ALREADY_REVERSED` / `EXPOSURE_VOIDED` /
  `EXPOSURE_NOT_FOUND` (E5–E6, E11–E14).
- Client treats capabilities as UX only; T4/T6 revalidate every mutation
  inside their locks (authority unchanged).

## 15. Exception UX

- EXCEPTION rows visible with status label; detail shows the technical
  QualityCodes (server array) plus the concise operator reason
  ("Actions unavailable: <actionReason>"); reverse/correct/new-receipt
  buttons hidden (U11).
- No auto-repair, no ordinary mutation actions on exception states; server
  refuses regardless (M14). `logged via logClientEvent` when a refused form
  is attempted.

## 16. Reconciliation surface

- Read-only compact summary from `workspace.reconciliation`
  (`TREASURY_1030_RECONCILIATION_V1`): Ledger 1030, Outstanding Exposure,
  Explicit Exceptions, Unexplained Residual + status line "Target Rp 0".
- Residual 0 + status OK → no warning (U12). Residual ≠ 0 or
  `MALFORMED_1030_LINE` → visible red warning "… review required." (U13).
- NO fix button anywhere on the surface (A18, U13).

## 17. Liveness

- Finance incident precedent applied to every request: ownership token
  (`requestId`/`dispatchId`), `startedAt`, stale timeouts
  (`TREASURY_READ_STALE_TIMEOUT_MS` 60 s reads,
  `TREASURY_MUTATION_STALE_TIMEOUT_MS` 120 s mutations), stale-callback
  guards in every success/failure handler, terminal READY/DONE or recoverable
  failure with explicit Retry, no immortal spinner (`aria-busy` released on
  every terminal path), no request storm (concurrent entry joins one
  dispatch), NO automatic financial retries.
- L1–L7 battery MEASURED: never-return callback, late success, late failure,
  nav away/back mid-mutation, Retry same-key, stale completion ownership
  (both orders), rapid clicks — all caught when mutated, all clean on real
  sources.

## 18. Finance interaction

- Journals flow into BalanceLedger via T4/T6 writers only — existing
  ledger-based cash/balance/cash-flow reads pick them up naturally; no Finance
  source file changed (final diff) and no Finance redesign.
- Revenue remains Sales authority: review note states Save is not Revenue
  creation; P25 (T5) prior evidence still holds; no Treasury file computes
  Revenue (S11/S13, M26/M27).

## 19. Legacy isolation

- No Receive Via / Payment Method / Confirm Payment / Paid-Unpaid / Settlement
  vocabulary in the Treasury surface (S3, U16, A6/A16); no legacy writer
  reachable from the client call graph (S1/S2, A5/A5b, M7/M8).
- V2 server guard remains authoritative; the Sales dialog audit (U10C AUD-18)
  was scoped to the Sales entry dialog + Sales sources — its isolation intent
  (no Treasury coupling inside the Sales surface) is preserved while the 190
  shell legitimately hosts the Treasury module.
- RBAC absent: single owner; client never claims an `actor` — server derives
  audit identity (A11, S12, M28).

## 20. Integration scenarios (U1–U18, MEASURED)

| U | Scenario | Evidence |
| --- | --- | --- |
| U1 | load terminal-ready | harness U1 (1 dispatch → ready, aria-busy released) |
| U2 | 24k UNCLEARED shown | harness U2 + server E1 |
| U3 | Save 1000 → DONE → T5 CLEARED | harness U3 (exact payload, reread status) + server E7–E9 |
| U4 | double-click one receipt | harness U4 (1 dispatch) |
| U5 | UNKNOWN same-key recovery one receipt | harness U5 (identical payload) + server F9–F10 |
| U6 | CLEARED not Save-actionable | harness U6 |
| U7 | Reverse → UNCLEARED | harness U7 + server F1–F3 |
| U8 | reverse double-click one reversal | harness U7/U8 (1 dispatch) |
| U9 | Correct → 1010 CLEARED | harness U9 + server F5–F7 |
| U10 | Correct UNKNOWN no duplicate lineage | harness U10 + server F11–F12 |
| U11 | EXCEPTION visible/fail-closed | harness U11 + server E13 |
| U12 | reconciliation residual 0 | harness U12 + server F13 |
| U13 | residual≠0 warning, no auto-fix | harness U13 |
| U14 | 1030 tamper rejected server-side | server E15 |
| U15 | partial-amount tamper rejected | server E16 |
| U16 | legacy Payment controls absent | harness U16 + static S3 |
| U17 | nav/re-entry no immortal in-flight | harness U17 |
| U18 | stale callback cannot overwrite newer state | harness U18 (success + failure variants) |

Liveness failure tests L1–L7 (never-return, late success, late failure,
nav away/back, Retry, stale completion, rapid clicks) — all MEASURED in
`tests/browser/treasury-t7-operator-controller.js`.

## 21. Mutation sensitivity (30/30, MEASURED)

All 30 required defect classes are caught by the harness battery (in-memory
source tampering only; reverted by fixture scope; nothing written back):
browser recomputes outstanding; hardcoded destinations; 1030 in selector;
editable partial amount; editable EconomicDate; editable ReversalDate;
Save→legacy Payment; Save→Settlement; new RequestKey on UNKNOWN; double-click
independent intents; DONE before server DONE; CLEARED without T5 reread;
EXCEPTION hidden; EXCEPTION Save enabled; Reverse browser-only eligibility;
Correct browser-only; reversal auto-refund; correction rewrites history
presentation; ReceiveVia introduced; PAID introduced; infinite loading; stale
callback overwrite; automatic mutation retry; stale action capability cache;
residual hidden; UI Revenue calc; Finance Revenue changed; RBAC; blank
EvidenceRef accepted; post-mutation projection not refreshed.

Every mutation anchor was verified FOUND (anchorMisses = 0 required for
pass) and every probe surfaced its defect. Source/call-graph audit (A1–A21 +
S1–S15) proves: client reaches only the five thin endpoints; `99D` delegates
to T3–T6 with no writers/formulas/transport; no legacy writer path; no
unrelated UI section modified (final diff).

## 22. Regression (MEASURED)

- Focused: all T3 (10), T4 (11), T5 (10), T6 (9) suites re-ran PASS; T7
  suites `testTreasuryT7Endpoints` (E1–E17), `testTreasuryT7IntegrationFlows`
  (F1–F13), `testTreasuryT7SourceAudit` (A1–A21), and
  `testTreasuryT7OperatorController` PASS.
- Full `node _test_runner.js` (final, after last source modification):
  **145 PASS / 0 FAIL** (baseline 141 + 4 new T7 suites; zero regressions —
  includes Transaction UI+server, Finance UI liveness, Sales V2 operator,
  Policy C/Cash, Purchase suites).
- Syntax/static: `node --check` clean on `99D.Treasury.Operator.Api.js`,
  `96.Tests.Treasury.Operator.Cases.js`,
  `tests/browser/treasury-t7-operator-controller.js`, `_test_runner.js`;
  202/203/204 HTML fragments parse via the VM harness load (Finance
  precedent; `.html` extension is not `node --check`-able).
- `git diff --check` clean; `git status --short` audited (only T7 paths
  changed/added; 27 `u10e-*` untouched).

## 23. Package impact (`.claspignore` allowlist)

- `.claspignore` NOT modified (outside authorized files). Current allowlist:
  **68** `!` includes + `**` ignore.
- Future push-gate count (base 72 from T6 = 68 + `!99` + `!99A` + `!99B` +
  `!99C`) + actual T7 runtime files:
  `!99D.Treasury.Operator.Api.js`, `!202.View.Treasury.State.html`,
  `!203.View.Treasury.Render.html`, `!204.View.Treasury.Controller.html`
  (190 already allowlisted) → **76** at the separately authorized gate.
  `tests/`, `docs/`, `_test_runner.js` remain excluded. Upload-manifest gate
  per AGENTS.md applies at that gate; no deployment implied or attempted.

## 24. Production safety

- Production writes = 0; deployment actions = 0; `clasp` execution = 0
  (no push/pull/deploy/run); Git push/stage/commit from Heavy = 0; production
  reads = 0 (all evidence is local in-memory fixtures; public endpoints
  exercised only under fixture resolver/config/transport stubs, restored in
  `finally`).
- No Receipt/Operation/Audit/BalanceLedger/Cash-Bank/1030 write, no
  Sale/Correct-Void, no Payment/Settlement, no refund/2010, no AP/Purchase,
  no config/account/schema mutation, no migration/backfill was executed or
  added outside the existing T4/T6 authorities (which ran only against
  fixtures).
- New wrappers (`treasuryOperatorSaveReceipt/Reverse/Correct`) are one-line
  delegations to already-built production wrappers; they were never invoked
  against production. `clasp push` remains R4/Critical and untouched.
- Blocking statuses (`BLOCKED_*`, `ESCALATION_REQUIRED`): not triggered — no
  frozen-contract contradiction materialized; no escalation, no fallback used.

## 25. Deferred scope

Explicitly OUT of T7 (unchanged, per task): aggregate settlement, partial
payment, fees/MDR, statement import, auto-match, refund/2010, AP/disbursement,
PaymentMethod/ReceiveVia, Sales PAID, Finance redesign, localStorage
persistence (sessionStorage used per existing recovery architecture), RBAC/
roles (single owner; Actor is audit identity only), client-side data caching
(fresh server reads by design — `ponytail:` add a cache keyed by dashboard
revision only if read cost ever demands it, then re-run the staleness
battery), Receipts CSV export, period filter controls for the Treasury list
(workspace read is unbounded `{}` → full canonical history), and production
activation/`clasp push` (separate authorized tasks).

---

## Acceptance summary (34 criteria → COMPLETE_LOCAL)

Baseline verified; scope kept to 9 code paths changed/added + 1 evidence
document + 1 audit-scope test adjustment; frozen T2 semantics honored (server action-day reversal, immutable
originals, one-atomic correction, no refund, no ReversalDate, exact T4/T6
payloads, single RequestKey per intent); T5 sole read authority; thin
endpoints only; U1–U18 + L1–L7 + 30/30 mutation sensitivity MEASURED; full
regression 145/0 MEASURED; package impact 76-at-gate stated; production
safety intact. No accounting semantics weakened.

*Local evidence this session: `node _test_runner.js` → 145 PASS / 0 FAIL
(final MEASURED); `node --check` clean on all changed JS; `git diff --check`
clean.*

*Telemetry: agent numlock-explore-free (Free execution authority for this
Heavy L3/R2 task); backend `9router/numlock-explore-free`; reasoning high;
fallback used none (no named `ESCALATION_REASON` materialized); toolcalls
UNKNOWN (not instrumented); elapsed UNKNOWN (not instrumented); files read
~30 (T4/T5/T6 docs, 99/99A/99B/99C, _test_runner, 190/193/195/199/201,
finance liveness harness, T4/T5/T6 test cases, .claspignore, U8/U10C audit
modules); files modified 11 (`99D.Treasury.Operator.Api.js` new,
`202/203/204.View.Treasury.*.html` new, `190.View.Index.html`,
`96.Tests.Treasury.Operator.Cases.js` new, `tests/browser/
treasury-t7-operator-controller.js` new, `_test_runner.js` registration,
`tests/browser/sales-v2-u10c-operator-surface.js` AUD-18 scope, this doc
new); test runs: 5 full `node _test_runner.js` (baseline 141/0 → 4 repair
cycles → final MEASURED 145 PASS / 0 FAIL).*

## Commit handoff (primary delegates numlock-commit)

- Title: `Treasury T7: operator UI and application integration`
- Paths (explicit):
  - `99D.Treasury.Operator.Api.js`
  - `202.View.Treasury.State.html`
  - `203.View.Treasury.Render.html`
  - `204.View.Treasury.Controller.html`
  - `190.View.Index.html`
  - `96.Tests.Treasury.Operator.Cases.js`
  - `tests/browser/treasury-t7-operator-controller.js`
  - `_test_runner.js`
  - `tests/browser/sales-v2-u10c-operator-surface.js`
  - `docs/TREASURY-T7-OPERATOR-UI-AND-APPLICATION-INTEGRATION.md`
