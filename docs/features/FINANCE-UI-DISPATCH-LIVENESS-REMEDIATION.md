# Finance UI Dispatch-Liveness Remediation (FIN-UI-LIVENESS-01)

Status: `COMPLETE` / `PRODUCTION_ACCEPTED` (local + production; see §16)
Candidate commit: `c384170` on baseline `d7c9814` (canonical v710 production line).
Deployment: **performed once** under task `FIN-UI-DEPLOY-01` — one
`clasp push --force`, one immutable version `v711`, canonical `v710 → v711`.
Scope: Finance client/controller surfaces only (`201.View.Finance.Controller.html`,
local test harness, test-runner wiring). No server Finance, Sales V2, accounting,
config, schema, or data changes.

## 1. Production symptom

During U10 Sales V2 activation first-event acceptance (measured, recorded in
`docs/SALES-RECOGNITION-V2-U10-ACTIVATION-FIRST-EVENT.md`), the production
Profit & Loss destination failed to complete loading in 3 fresh-session browser
attempts (up to ~7.5 minutes each): `#finance` remained `aria-busy="true"` at
"Loading Profit & Loss…". Concurrent client alerts showed Products/COGS/
Inventory server failures (i.e., the Apps Script callback channel was partially
functional), but the Finance view never reached READY or an explicit failure.
Accounting authority was unaffected: U5 Revenue measured locally from the same
production code/data (`recognizedRevenue = 403,000`; first Sale +24,000 exactly
once; `revenueAuthorityComplete = true`; Policy C shape unchanged).

## 2. Accounting vs UI distinction

The defect is a **client-side dispatch-liveness defect in the Finance view
controller**, not an accounting defect. `36.Finance.Service.js`, U3 signed
projection consumption, Revenue source, P&L calculation, Policy C, COGS/GP,
BalanceLedger, Orders, SalesRecognitionEvents, Accounts, and Treasury semantics
are untouched by this remediation.

## 3. Exact root cause (measured)

`financeInflight[cacheType + "|" + cacheKey]` was a boolean flag set to `true`
immediately before every `google.script.run` Finance dispatch and deleted only
inside the success/failure callbacks. There was no timeout, no start
timestamp, no generation token, and no cleanup path when a callback never
fired. Consequently:

1. A dispatch whose callback never fires (response lost at the Apps Script
   container/channel) leaves `financeInflight[key] = true` **forever**.
2. Every later `ensureFinanceData()` sees the flag, joins it as "healthy
   in-flight", sets loading, and returns without dispatching.
3. `retryFinanceData()` → `requestFinanceData()` has the same join branch, so
   even an explicit user retry is blocked.
4. Only a successful transaction mutation (`invalidateFinanceCache()`) resets
   the flag — not available on a read-only Finance visit.

Root-cause classification: **dispatched-not-completed / callback-lost with an
immortal in-flight marker and zero liveness recovery**. Whether the specific
production loss was dispatched-not-completed or a join of an earlier dead
marker is `LOSS_MECHANISM_NOT_FULLY_OBSERVABLE` from the browser; the
controller defect (no liveness recovery for a dead in-flight marker) is proven
locally by reproduction against the exact baseline source.

## 4. Pre-fix state machine (actual source semantics)

Implicit states from `199/200/201`:

- `financeCache[cacheType][cacheKey] = { data, destination }` — validated cache;
  hit renders immediately (no dispatch).
- `financeInflight[cacheType|cacheKey] = true` — dedup marker; set before
  dispatch; deleted only by the dispatch's own callback.
- `financeState.activeRequestId` / `requestSequence` — stale-render guard for
  foreground callbacks (requestId + destination).
- `_warmCallbacks[key]` — one-shot wake registered when `ensureFinanceData`
  joins an in-flight marker; fired only by background-warm completion.
- View states: `loading` (aria-busy true) → `success`/`empty` (aria-busy
  false) or `error` (aria-busy false, Retry visible).
- Navigation: `showPage("finance")` → `setFinanceDestination` +
  `ensureFinanceData()`; no lifecycle reset on navigate-away.
- `window.onload` → `initializeFinancePage()` sets loading with no request.

Transitions into the ghost: dispatch → marker `true` → callback never fires →
marker immortal → all future loads for that key join forever.

## 5. Ghost-in-flight reproduction (measured, local)

Harness `tests/browser/finance-ui-liveness-controller.js` loads the **real**
`199/200/201` sources into an in-memory DOM + mocked `google.script.run` +
fake clock, then:

| probe | dispatches | marker | callback | aria-busy after +121 s | state after +121 s | re-ensure dispatches | outcome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| baseline `d7c9814` controller | 1 | set | never fires | `"true"` | `loading` | 0 (joined ghost) | **ghost reproduced: stuck indefinitely** |
| remediated controller | 1 | set | never fires | `"false"` | `error` ("Timed out loading Profit & Loss.", Retry visible) | 1 fresh | **recovered** |

## 6. Liveness contract (frozen before implementation)

1. ≤1 healthy active request per data generation (destination+filter key).
2. Callers may join a healthy current request (single wake/render path).
3. In-flight has bounded liveness: foreground requests carry a 120 s client
   liveness timer; all markers carry a 120 s staleness bound.
4. Once stale, a marker ceases blocking: subsequent legitimate
   `ensureFinanceData()`/`retryFinanceData()`/warm dispatch replaces it.
5. Stale callbacks never overwrite newer successful data (requestId guard) and
   never clear a newer request's marker (guarded release).
6. Loading always resolves → READY/EMPTY, or explicit recoverable failure
   (Retry visible). No silent terminal loading.
7. User retry works without page reload (Retry button / re-navigation /
   period change).
8. Retry never mutates Finance/business data (read-only server methods only).
9. Rapid callers never cause a request storm (join dedup preserved).
10. Existing valid-cache reuse semantics preserved unchanged.

## 7. Source remediation (exact changes, `201.View.Finance.Controller.html` only)

- Added central `FINANCE_REQUEST_STALE_TIMEOUT_MS = 120000`,
  `financeNow_()`, `isFinanceInflightEntryStale(entry)`, and
  `releaseFinanceInflightEntry(inflightKey, requestId)` (guarded release:
  a callback may only clear the marker it owns).
- In-flight markers are now objects: foreground `{ requestId, startedAt }`,
  background warm `{ startedAt }` (boolean writes removed).
- `requestFinanceData()`: stale markers are released before the join check;
  the join branch now registers the same one-shot `_warmCallbacks` wake as
  `ensureFinanceData` (closes a pre-existing no-wake gap); each foreground
  dispatch arms one liveness timer; success/failure clear the timer and use
  guarded release before the existing requestId/destination guards.
- Liveness timer callback: if the request is still the active one, release its
  marker and surface `setFinanceViewState("error", "Timed out loading <dest>.")`
  (Retry visible). No auto re-dispatch, no polling, no infinite retry.
- Warm functions: stale-marker release before guard; guarded release in
  callbacks (late warm completion can no longer clear a foreground
  replacement's marker).
- `ensureFinanceData()`: stale markers are released and the function falls
  through to `requestFinanceData()` (replacement request).
- `invalidateFinanceCache()`, cache validation, renderers, `retryFinanceData`
  (read-only), and `setFinanceViewState` semantics unchanged.

## 8. Timeout semantics

- Single central definition: 120,000 ms, client-side only.
- Justification: normal Finance reads complete in seconds to tens of seconds;
  120 s bounds recovery far below the observed pathological ~420 s hang while
  adding headroom for slow full-period scans. The 420 s hang is explicitly NOT
  the timeout.
- Client-stale ≠ server-cancelled: Apps Script has no real cancellation
  capability; the server request may still complete. A timed-out request that
  returns later is handled safely: if it is still the active request it simply
  renders (recovering the view); if a replacement superseded it, its late
  success/failure is ignored by the requestId guard and cannot clear the
  newer marker (guarded release).

## 9. Stale callback protection (measured F5/F6/F4)

A starts → A goes stale (timer or stale window) → B starts → B succeeds with
data B. Late A success: does not overwrite `financeState.data`/cache (still B),
does not clear B's marker. Late A failure: does not set error, B stays READY.
Late warm-A success after foreground B replacement: cannot clear B's marker;
final data remains B's.

## 10. Controller regressions F1..F12 (all measured, `tests/browser/finance-ui-liveness-controller.js`)

| id | scenario | measured result |
| --- | --- | --- |
| F1 | normal first load | 1 dispatch → READY, aria-busy false, cache filled, no render error, no second dispatch |
| F2 | healthy concurrent join (ensure ×3 + period change) | 1 dispatch, single resolution, consistent data |
| F3 | ghost in-flight (callback never fires) | timer → explicit timeout error, Retry visible, marker released, later ensure dispatches fresh, recovery READY |
| F4 | replacement (stale warm ghost) | foreground B dispatched, late warm release keeps B's marker, B data wins |
| F5 | late A success | B data/cache preserved |
| F6 | late A failure | B READY not corrupted |
| F7 | explicit server failure | error surfaced, aria-busy false, marker released, retry dispatches |
| F8 | retry after timeout | fresh dispatch → success, no reload/mutation |
| F9 | navigation away/back under READY / healthy REQUESTING / stale REQUESTING / prior failure | cache reuse, join, fresh dispatch, fresh dispatch — no immortal state |
| F10 | valid cache reuse | 0 additional dispatches |
| F11 | rapid callers | no storm (1 dispatch; still 1 after success) |
| F12 | aria-busy terminals | success/failure/timeout all reach `aria-busy="false"` |

58/58 F-checks + 28/28 static liveness guards PASS.

## 11. Mutation sensitivity (measured, caught 10/10, all reverted)

| mutation | probe | caught |
| --- | --- | --- |
| M1 remove stale timeout | ghost stays loading with no recovery path | yes |
| M2 keep stale in-flight forever (stale checks neutered) | stale ghost blocks ensure | yes |
| M3 stale success overwrites newer | late A success clobbers B | yes |
| M4 stale failure overwrites READY | late A failure sets error | yes |
| M5 never clear in-flight on failure | retry blocked after failure | yes |
| M6 dispatch per concurrent caller | period-change join broken → storm | yes |
| M7 aria-busy stuck after success | success leaves aria-busy true | yes |
| M8 aria-busy stuck after failure | failure leaves aria-busy true | yes |
| M9 suppress retry after stale | requestFinanceData join immortal | yes |
| M10 break valid cache reuse | cache hit re-dispatches | yes |

All mutations were applied in-memory to the harness only; source was never
mutated (caught 10/10, reverted/none-persisted by construction).

## 12. Accounting and Sales V2 non-impact

- `36.Finance.Service.js` and all server Finance/U3/U4/U5/Sales V2 sources:
  byte-identical to baseline (diff limited to `201` + test wiring).
- Full local regression after final runtime edit: `node _test_runner.js` →
  **101 PASS, 0 FAIL** (baseline 100 + `testFinanceUiDispatchLiveness`).
  Includes all U1–U10 Sales V2 suites, Policy C, Finance backend, WarmCache
  guard suites unchanged.
- First Sale `ORD-677BE5CE-SALESRECOGNI` untouched; no new Sale; 1030
  uncleared by design; no Correct/Void/Payment/Fulfillment/Treasury activity.

## 13. Validation performed

- `node tests/browser/finance-ui-liveness-controller.js` (direct): ghost
  reproduction pre/post + full battery PASS (28 static, 58 F-checks, 10/10
  mutations).
- `node _test_runner.js`: **101 PASS, 0 FAIL** (MEASURED, after final edit).
- `node --check _test_runner.js` and `node --check
  tests/browser/finance-ui-liveness-controller.js`: PASS.
- View JS parse: the real `199/200/201` sources load and execute in the VM
  harness (measured parse+run).
- `git diff --check`: clean.
- Package audit (static, no push): `.claspignore` unchanged (68 allowlisted
  entries); modified deployable `201.View.Finance.Controller.html` already in
  manifest; `_test_runner.js`, `tests/browser/*`, `docs/*` excluded by the `**`
  deny-first allowlist; no secrets, production fixtures, or debug bypasses
  added. Expected runtime package count: unchanged (68).

## 14. Production read-only probe

- Attempt 1: `clasp run validateFinanceProductionRuntime` — timed out at 180 s,
  no output.
- Attempt 2 (final; no further attempts): permission/execution-API error
  ("Unable to run script function…").
- Classification: `BLOCKED_PERMISSION` (bounded read-only production diagnosis;
  consistent with the prior U10E Execution API 403). Production remains v710,
  unmodified. Prior measured U5/Policy C evidence
  (`docs/SALES-RECOGNITION-V2-U10-ACTIVATION-FIRST-EVENT.md`) stands as the
  factual pre-fix baseline. Local fix does not affect production until a
  separately authorized deployment.

## 15. Limitations

- The exact production loss vector (never-dispatched join vs
  dispatched-not-completed at the container) is
  `LOSS_MECHANISM_NOT_FULLY_OBSERVABLE` from browser network traces alone; the
  controller's missing liveness recovery is proven and remediated regardless.
- Local harness uses mocked `google.script.run` and a fake clock; real-browser
  acceptance requires the separately authorized deployment task.
- Warm background requests have no timer by design (no UI impact); their
  staleness is bounded by the 120 s marker bound on the next legitimate
  foreground/warm dispatch for the same key.
- Server-side Apps Script registry UI suites (`96.Tests.Finance.UI.Cases.js`,
  `96.Tests.Finance.WarmCache.Cases.js`) carry pre-existing accepted token
  drift (documented in `docs/evidence/finance-phase-13moe.md`); this task did
  not widen that drift and preserved all extractable tokens.

## 16. Production deployment and acceptance (TASK `FIN-UI-DEPLOY-01`)

Owner-authorized scope consumed: pre-deploy verification, exactly ONE
`clasp push --force`, exactly ONE new immutable version, canonical
`v710 → v711`, fresh-session production Finance UI acceptance, read-only
accounting/Sales non-regression, evidence docs, local evidence commit.
No second push, no additional runtime edit, no Finance/Sales change, no
Save/Correct/Void/Payment/Fulfillment/Treasury activity, no
config/account/schema/history mutation, no Git push.

### 16.1 Baseline and pre-deploy gates (MEASURED)

- Starting HEAD `c384170`; tracked worktree/index clean (0 tracked entries);
  27 untracked `tests/tmp/u10e-*` inventoried and left untouched.
- Frozen runtime delta vs canonical **v710**: `projects.getContent` (read-only)
  returned 68 remote files; local package 68; **67/68 byte-identical**, sole
  difference `201.View.Finance.Controller.html` (+88/−16 lines). `97A`/`97C`
  U10F DONE-gated `invalidateDashboardCache()` mods, `97E` activation writer,
  `195`/`194` operator surface, `10.Config.js`, `36.Finance.Service.js` all
  byte-identical to v710.
- Finance authority gate (server-side, read-only local VM over live rows):
  U3 projection valid (target chain 1 event / 1 transaction / 2 lines),
  U5 scope Oct-2026 `recognizedRevenue` 403,000 on the measurement host basis,
  `revenueAuthorityComplete=true`, first Sale `SCR-CE122B27-ORD677BE5CES`
  exactly once at +24,000, journal `Dr1030 24,000 / Cr4000 24,000` once.
- Liveness suites: static guards **28/28**, F-checks **58/58** (F1–F12 PASS),
  mutation sensitivity **10/10** (M1–M10), battery PASS.
- Full regression: `node _test_runner.js` → **101 PASS / 0 FAIL** (MEASURED,
  immediately pre-push).
- Syntax/parse: `node --check` on 100 root `*.js`, `_test_runner.js` and the
  controller harness PASS; real `199/200/201` sources parse and execute in the
  VM harness; `git diff --check` clean.
- Package/manifest: `.claspignore` = 68 explicit `!` includes; `clasp status`
  = 68 tracked, tracked set ≡ allowlist (empty diff); `201`, `97A`, `97C`,
  `97E`, `195` included; `tests/`, `docs/`, `_test_runner.js`,
  `tests/tmp/u10e-*` excluded; no secret/fixture in the package.
- Pre-push production snapshot (read-only Sheets REST): 16 sheets row counts
  + data/header sha16; canonical deployment readback **@710**, 2 deployments.

### 16.2 Push, version, canonical update (MEASURED)

- **Push count: exactly 1** — `clasp push --force` → `Pushed 68 files`
  (single success path; no second push attempted).
- Uploaded-source verification (read-only `projects.getContent`): **68/68
  sha256 identical to the local candidate**; `FINANCE_REQUEST_STALE_TIMEOUT_MS`
  present, `{requestId, startedAt}` markers and `releaseFinanceInflightEntry`
  present, old immortal `financeInflight[…] = true` absent; U10F cache
  invalidation, `97E` activation writer and operator-surface markers intact.
- **Version: exactly 1 new immutable version** — one
  `clasp update-deployment <canonical> -d "Finance UI dispatch liveness fix
  c384170: stale in-flight timeout, guarded callbacks"` → `Redeployed … @711`.
  Canonical **710 → 711**; deployment count unchanged (2); `@HEAD`
  untouched; no version-list/creation command was run, so no orphan version
  was introduced.
- Post-deploy `/exec` readback: **HTTP 200 / 1,063,877 bytes**;
  `FINANCE_REQUEST_STALE_TIMEOUT_MS \x3d 120000`, ownership/request markers,
  U10C/U10D operator markers, U10F cache markers present; no pre-candidate
  controller content.

### 16.3 Production Finance UI acceptance (fresh sessions, read-only)

- **A Normal load PASS:** loading observed (`aria-busy=true`) at 10.66 s,
  terminal render at 22.995 s from page start (**12.34 s from loading start**);
  `aria-busy` true → false; content rendered (`Current Year`, `Rp 19.498.000`);
  **0 page errors, 0 console errors**.
- **B Data validity — DELTA, fully reconciled:** rendered `Current Month`
  **Rp 391.000**; the raw production payload for period `2026-10-01..2026-10-09`
  carries `summary.revenue=391000`, `recognizedRevenue=391000`,
  `revenueAuthorityComplete=true`. Expected task figure 403,000 →
  **Δ −12,000**, reconciled as a measurement-basis difference, NOT activity:
  - workbook snapshots (pre-deploy / post-deploy / post-acceptance) are
    sha-identical across all 16 sheets → dataset unchanged;
  - the deployed server source is byte-identical to v710 → not caused by this
    deployment;
  - the same deployed code over the same live rows yields **391,000 / 1,369,000
    (Sep) / 1,741,000 (Aug) / 19,498,000 (YTD)** when date derivation runs on a
    UTC host basis (production) and 403,000 / 1,468,000 / 1,630,000 / 19,498,000
    on the Asia/Jakarta host basis that produced the 403,000 expectation.
    Difference is one boundary row `LEGACY:SAL-APP-20260930-8615DD463535`
    (12,000): 2026-10-01 under Asia/Jakarta, 2026-09-30 under UTC; YTD is
    identical on both bases and production custom-period payloads
    (Sep 1,369,000; Oct 391,000) match the UTC run exactly.
  - first Sale **+24,000 included exactly once** in October
    (`ORDER:ORD-677BE5CE-SALESRECOGNI`, RECOGNIZED, `V2_COMMITTED`, 2026-10-09).
- **C Repeated navigation PASS:** 3 away/back cycles; each return navigation
  rendered from valid cache with **0 script requests**, revenue stable
  `Rp 391.000`, no immortal in-flight, Finance usable, no business mutation.
- **D Retry/timeout:** `PRODUCTION_TIMEOUT_PATH = NOT_TRIGGERED` — no real
  request stalled; no outage was manufactured (timeout path remains covered by
  local F1–F12 + 10/10 mutation battery).
- **E aria-busy PASS:** every measured attempt (normal load, period switch,
  3 return navigations) terminated with `aria-busy=false`.
- **F Storm PASS:** 6 requests on first load, 0 on each return navigation;
  no request storm.

### 16.4 Non-regression (read-only, MEASURED)

- **Business delta 0:** pre vs post vs final snapshots → 16/16 sheets
  identical (row counts + sha16): TransactionOperations 3, Orders 2,
  OrderLines 3, SalesRecognitionEvents 1, SalesRecognitionAudits 1,
  BalanceLedger 8, Payments 1, Settlements 2, InventoryLedger 0, Accounts 22,
  Settings 7, tabsal 10808, tabops 1976, Logs 225, Products 34,
  ProductPricing 154. Only source/version/deployment state changed.
- **Accounting:** journal unchanged — `Dr1030 24,000 / Cr4000 24,000` for the
  first Sale (uncleared by design), no Cash/Bank, 2010, 5000/1100 or
  sale-triggered 6210 movement; Policy C untouched; no Treasury.
- **Sales V2:** exactly 1 committed V2 operation, 1 RecognitionEvent,
  1 audit, 2 lines; no second Sale, no Save retry, no Correct/Void.
- **Config stability:** `10.Config.js` byte-identical, `Settings` row count +
  sha unchanged, zero config writes. Direct ActivationID/property read remains
  `BLOCKED_PERMISSION` (known-denied Execution API 403; not retried, never
  written to verify).
- **Historical/1030:** no rewrite, backfill or migration; TabSal/Orders/
  Payments/Settlements/journals untouched.

### 16.5 Limitations

- Production loss vector remains `LOSS_MECHANISM_NOT_FULLY_OBSERVABLE` from
  browser traces alone; the proven controller defect (no liveness bound on an
  immortal in-flight marker) is remediated and served.
- The 120 s timeout path was not exercised in production (no genuine stall);
  it is covered by local regression only.
- Navigation click listeners are attached inside `initializeResponsiveShell()`
  from `window.onload`; clicks issued before `window.onload` completes are
  silently dropped (`#finance` stays hidden, `requestSequence=0`, no dispatch,
  no client error). Observed in three earlier fresh sessions with an
  over-early harness click; wiring is byte-identical to v710 (unchanged by
  this deployment) and a later navigation works normally. Acceptance was
  re-run with a click-accepted gate and passed.
- Harness away-steps waited on a Finance-specific terminal condition and
  consumed their full window; return-navigation measurements are the valid
  C/F evidence.
- `clasp list-versions` was deliberately not run (a prior incident showed
  clasp 3.3.0 can parse ambiguous `version` commands as create-version);
  version readback comes from the single `update-deployment` output (@711) and
  the deployments readback (count 2, canonical @711).
