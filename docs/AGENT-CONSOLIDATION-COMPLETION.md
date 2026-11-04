# NUMLOCK local completion — 2026-11-02

Production baseline: v749, supplied by owner. No live production query, clasp command, version creation, deployment, commit, staging or push was performed.

## Changes

Ten project agents consolidated into one `numlock` executor after source/reference audit. All ten original definitions and original configuration/contract/consumer files are preserved under `docs/agent-archive/2026-11-02/original/`. Nine retired definitions are removed only from active discovery. Provider/model routing is unchanged. Local editing is enabled; secret/association editing and sensitive reads remain denied, external directories and subagents remain denied, unknown commands remain ask. Production-impacting/run/pull clasp capabilities and Git mutation require permission asks plus exact task authorization. Heavy diagnostics and isolated historical forensic capabilities are retained behind these gates.

Top Products desktop card now has 360 px minimum allocation, allowing its 320 px table plus padding/borders to fit. The card no longer owns scrolling. Mobile keeps its existing horizontal table wrapper. No fixed-height clipping or hidden overflow was added. Profit Margin retains comma decimal formatting (`1,3 poin`) and now has a real tooltip inside its card, with percentage-point explanation/example, accessible description, pointer/focus/touch access and Escape dismissal. Five direct KPI children remain. Existing user changes in both UI files were retained.

## Exact changed/new paths

- `AGENTS.md`
- `opencode.json`
- `.opencode/agents/numlock.md`
- Retired to archive: `.opencode/agents/numlock-browser.md`, `numlock-commit.md`, `numlock-critical.md`, `numlock-explore.md`, `numlock-heavy.md`, `numlock-light.md`, `numlock-medium.md`, `numlock-ops.md`, `numlock-sol.md` (all relative to `.opencode/agents/`).
- `scripts/preflight.js`
- `scripts/preflight.test.js`
- `scripts/numlock-opencode.py` (pre-existing untracked file updated; original archived)
- `scripts/numlock-opencode.test.py` (new)
- `scripts/opencode-session-shell.mjs`
- `docs/AGENT-ARCHITECTURE.md`
- `docs/CLASP-STARTUP-RECOVERY.md` (pre-existing untracked file updated; original archived)
- `docs/AGENT-CONSOLIDATION-AUDIT.md`
- `docs/AGENT-CONSOLIDATION-COMPLETION.md`
- `docs/agent-archive/2026-11-02/` (original package and audit inventory/matrix/manifest)
- `190.View.Index.html` (pre-existing work retained)
- `196.View.Dashboard.Render.html` (pre-existing work retained)
- `tests/browser/dashboard-overview-regression.test.js` (new)
- `tests/browser/evidence/overview-v749-local/` (new local-only screenshots, geometry and logs)

`docs/LOCAL-EXECUTION-CONTRACT.md` and `package.json` were copied unchanged into the isolated candidate and have no task content change. Shared dashboard fixture and test-generated tracked manifest were restored to their original bytes after tests. No unrelated source fix was made.

## Measured evidence

| Gate | Result |
|---|---|
| Initial configuration tests | 24 pass / 10 fail of 34; static preflight failed |
| Final static preflight | PASS |
| Final Node configuration tests | 28/28 PASS |
| Launcher contract unit tests | 6/6 PASS |
| Active OpenCode v2.2.5 catalogue | Exactly one NUMLOCK project agent |
| Active runtime permission probes | 16/16 expected decisions, no command execution or approval grants |
| OpenCode model execution and native shell in isolated candidate | Actual model execution; preflight and 28/28 tests PASS |
| Final browser regression through OpenCode native shell | 7/7 PASS using system Chrome and ephemeral fixture contexts |
| Desktop 1536×960 and 1366×768 | 10 rows; card and chart 463.5 px aligned; no card/wrapper/container horizontal or vertical overflow; document overflow 0 |
| Phone 390×844 | 10 rows; no internal vertical overflow; horizontal access retained |
| Tooltip | Hover, focus, touch, aria-describedby, Escape; up/down/zero/no-comparison semantics PASS |
| Sorting/filter/tab smoke | Both sort directions on all three columns, actual fixture RPC after date change, Performance/Insights/Overview PASS |
| Inline JavaScript | Five assembled inline scripts syntax PASS |
| Other script syntax | Node/Python syntax PASS |
| Final complete application fixture suite | 232 PASS / 2 FAIL, same failing test names as baseline |
| git diff --check | PASS |

The initial five-row shared fixture could not prove ten-row geometry. The regression adds five deterministic products only to its generated HTML; shared fixture data stays unchanged. RED evidence was captured before the source fix; final results were measured after the last source change. Browser assertions inspect scrollHeight/clientHeight, full row containment, exact KPI grid-child count, real pointer/keyboard/touch actions and sorted rendered values. The initial OpenCode test draft was replaced after review found stale-node and synthetic-event assertions. A draft edit to the shared fixture was reverted before final testing.

## Remaining limits

Full application regression is not clean. The two pre-existing failures are:

- `FAIL testSalesV2U10COperatorSurface: Cannot set properties of undefined (setting 'value')`
- `FAIL testSingleCommitPackageMeasurement: T11_7_U5:P3|4944d8d84ccad114d74593b1b81cd5711f2f922984d1e68bec1750de3389d6e9`

The package-measurement test compares against historical package bytes; its observed digest changes with source edits. It already failed before the UI fix. The Sales V2 fixture failure was also present before the fix. These tests were neither skipped nor weakened, and their unrelated source was not changed.

Production v749 was not independently reverified. Local fixture/browser evidence is not Apps Script/production acceptance. OS isolation, future model compliance, saved-approval coverage beyond probes, and the operational SessionShell adapter's legacy SDK compatibility remain unproven; no real operational command is authorized for integration testing. Configuration readiness is measured separately from these limits.

Git recommendation: **None**. No Git mutation or deployment is authorized.
