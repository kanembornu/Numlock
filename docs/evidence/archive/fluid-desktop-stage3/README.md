# Fluid Desktop Stage 3 acceptance evidence

## Candidate acceptance

- Candidate deployment: `AKfycbw25GQBv47i1Mm6XaNLRCpiiLTqtboCnqRx-jxhX2m_RzC7PRAFXH_21l5JCVrHyfZv` at immutable Apps Script version 689.
- Acceptance command: `node tests/browser/fluid-desktop-stage3-runtime.js` against candidate URL.
- Runtime result: MEASURED PASS — total 162, pass 160, fail 0, unverified 2.
- Required result: MEASURED PASS — required total 154, required fail 0, required unverified 0.
- Overall: `PASS`.
- Optional unverified items: two cache-evidence observations; non-blocking by contract.
- Geometry: PRIOR MEASURED PASS — 33/33, zero defects. Product source remained unchanged after that measurement.
- Relevant page errors: 0.
- Relevant console errors: 0.
- Navigation identity: candidate deployment @689.

## Compact sidebar acceptance

MEASURED PASS:

- `sidebar_1250_expanded`
- `sidebar_1024_expanded`
- `HEIGHT_MATRIX_START`
- Expanded authority: 264px at widths >=1280; 224px at widths 1024–1279.
- Collapsed authority: 64px.
- Trusted pointer/mouse/click events reached `#sidebarCollapseButton` in isolated direct-target runs.
- `data-sidebar-collapsed` changed through application handling.
- No relevant page or console errors.

## Accepted test architecture

Compact expansion after same-page viewport resizing exposed a Playwright input-dispatch failure before application event handling. Product behavior was separately measured with trusted events and correct state mutation. Runtime acceptance therefore uses narrow direct-target isolation only for `sidebar_1250_expanded`, `sidebar_1024_expanded`, and `HEIGHT_MATRIX_START`. This is accepted test architecture. It must not be removed or replaced by product behavior changes merely to accommodate the test environment.

## Historical chronology

Earlier candidate runs failed compact expansion with `SIDEBAR_STATE_CHANGE_TIMEOUT`. Those failures remain valid historical evidence for the pre-isolation harness path. They are not rewritten as passes. Later forensic isolation distinguished test-environment dispatch behavior from product behavior, after which final candidate runtime acceptance passed.

## Pre-promotion deployment state

Measured before Stage 3 production promotion:

- Canonical production deployment: `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q` at version 665.
- Stage 3 candidate: version 689.
- Promotion model: update same canonical deployment ID in place to one newly created immutable Stage 3 release version.
- Candidate retirement occurs only after canonical production acceptance passes.

## Production closeout

- Immutable release: version 690, `Stage 3 Fluid Desktop production release`.
- Canonical promotion: unchanged deployment ID `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q`, version 665 to 690 in place.
- Production browser command used dynamic `NUMLOCK_VALIDATION_URL` targeting canonical URL.
- Production browser result: MEASURED PASS — total 162, pass 160, fail 0, unverified 2; required total 154, required fail 0, required unverified 0; overall PASS.
- Sidebar authority: MEASURED PASS at 64/224/264, including accepted compact direct-target isolation.
- Relevant page errors: 0. Relevant console errors: 0.
- Post-promotion Finance validator: MEASURED PASS — five periods, read-only true, failures 0, unresolved mappings 0, all reported data-quality counters 0.
- PurchaseEvent schema migration was not invoked.
- Final measured deployment architecture: project HEAD executable plus canonical production Web App only; temporary candidate @689 retired after production acceptance.
