# NUMLOCK Project Status

This is the living executive answer to “where is NUMLOCK now?” It summarizes current repository evidence without replacing the detailed owners linked in [Documentation status](#documentation-status).

## 1. Project identity

NUMLOCK is a Google Apps Script V8 and Google Sheets business-intelligence dashboard for coffee-shop transactions. The Apps Script web entry point serves the numbered HTML frontend, and the dashboard is backed by the Aggregate Engine and spreadsheet services.

## 2. Current status

**Fluid Desktop Stage 3 — COMPLETE in production (2026-10-04).** Canonical production retains its stable deployment ID; Stage 3 acceptance evidence was measured on immutable Apps Script version 690 (historical Stage 3 release evidence, preserved). Current canonical production serves version 691 (recorded below). Production browser acceptance passed 160/160 measured assertions with 2 optional unverified cache observations; all 154 required assertions passed. Sidebar authority 64/224/264, compact isolation paths, viewport/height geometry, readiness, and zero relevant errors passed. Post-promotion Finance validation passed read-only across five periods. Temporary candidate @689 was retired after this acceptance; final live architecture is project HEAD plus canonical production @691.

**Transactions PaymentStatus compatibility repair — PRODUCTION COMPLETE / PASS (2026-10-04).** Transactions PaymentStatus compatibility repair delivered at canonical Apps Script version **691** (description: "Transactions PaymentStatus compatibility repair"). Canonical deployment ID unchanged: `AKfycbxyll_HUHO9_YmUL6QuJ93ZeIgO8Asy_LcsqTaK2C2dK8nesZXAzPkkSEhbwZKxkX6q`. Active deployments: exactly 2 — project `@HEAD` plus canonical `@691`. Production acceptance evidence (MEASURED post-promotion via `clasp run` diagnostics): PurchaseEvents production read PASS (9 rows readable); legacy missing-PaymentStatus compatibility PASS (no `INVALID_PAYMENT_STATUS`); PaymentStatus-related runtime error CLOSED; `validateFinanceProductionRuntime` PASS (five periods, no failures); Inventory Policy Evidence diagnostic PASS (read-only, unresolved count 0); business-data writes caused by validation: 0; `PRODUCTION_MIGRATION_INVOCATIONS`: 0. Root cause: `LEGACY_PURCHASEEVENT_COMPATIBILITY_GAP` (decision recorded in DECISIONS.md). Local pre-delivery evidence (MEASURED): Policy C local harness 30 PASS / 0 FAIL; PaymentStatus CASE 1–8 PASS (legacy read, valid current, explicit invalid rejected, strict write preserved, service-level getTransactionsPage chain PASS, zero writes). Broad canonical backend suite: 97 PASS / 29 FAIL (`runAllBackendTestsDiagnostic`) — failures classified as unrelated or deferred, including intentionally isolated Products expectations; recorded as a known gap, NOT a clean pass. UNKNOWN gaps (not failures): browser-level Transactions page acceptance (browser capability not configured for delivery run); direct remote getTransactionsPage / getTransactionsPeriodRows probes; direct production valid/invalid PaymentStatus write probes (skipped to preserve zero production business writes; local MEASURED evidence retained). Products Contract Reconciliation: **OPEN/DEFERRED** pending whole-contract reconciliation (see PRODUCT-BACKLOG.md). Non-Products working tree reconciliation: in progress — five baseline commits pending downstream.

**Finance Policy C local acceptance — COMPLETE, production not closed (2026-10-03).** Frozen local architecture uses PurchaseEvent 29-column schema, legacy payment non-inference, PAID Dr1100/CrCash, UNPAID Dr1100/Cr2000 plus AP identity, controlled AP settlement, `tabsal.HPP` authority, non-negative 1100, insufficient-basis refusal/recovery, history-preserving correction/reversal, physical-opening retirement, preserved monetary-opening production gate, InventoryReceipt/Ledger non-authority, shared P&L/Balance/Cash Flow finalization, and depreciation logical validation. Authoritative statements either reconcile as `FINAL` or expose no final values under `ACCOUNTING_DATA_PENDING_RESOLUTION`. Local harness: 30/30 PASS measured. Apps Script canonical validation awaits publication. `ACTUAL_M_READY=false`; production Finance remains open.

**Finance Phase 11U — COMPLETE/FROZEN with a documented preservation-evidence limitation (2026-09-06).** ING-018 Lemon authority is active at 1000 gr to 24 slice from 2026-10-01; 22 accepted active authorities and zero conflicts are verified. InventoryOpenings and InventoryLedger remain header-only. Historical comparisons for unrelated authorities and global no-unrelated-mutation proof remain unproven because no PRE-11U snapshot exists. The [conservative closure and POST-11U baseline](evidence/finance-phase-11u2e/README.md) govern future preservation checks. This finance closure does not update deployment or release evidence below.

**Feature Complete v1.0**

The documented bounded v1.0 feature baseline is implemented, stabilized, and accepted in production. Candidate `658f4ab1011633e86634f14ce838a514c5205df0` passed the repository preflight, Apps Script live 25/25 suite, immutable deployment, deployed-browser acceptance, and production-health verification.

## 3. Current version

**1.0.0 — Production**

`10.Config.js` owns executable version metadata. [CHANGELOG.md](CHANGELOG.md) owns release history, and [RELEASE.md](RELEASE.md) owns the release process.

## 4. Current phase

**Design System Foundation — CLOSED**

The bounded v1.0 feature/backend baseline remains stable. Package 025 established the reusable global visual foundation without changing backend, response, formula, route, layout, or runtime ownership. Its final light-theme sidebar contrast correction preserves the bright soft palette and clarifies brand, divider, active, normal, and unavailable hierarchy.

## 4A. Phase 3 roadmap

Phase 3 is accepted. **Phase 3A (Products) is CLOSED at production v657.** **Phase 3B (Capital & Equity) is CLOSED at production v658 — READ-ONLY COMPLETE.** **Phase 3C (Assets) is CLOSED at production v662 — READ-ONLY COMPLETE.** **Phase 3D (Depreciation) is CLOSED at production v664 — September 2026 continuation PASS.** **Phase 3E (Financial Statements) is CLOSED; v676 is historical acceptance evidence, not the current canonical binding.** P&L and Cash Flow UI are ACTIVE. Balance Position is PENDING_FINANCE_OPENING. Combined focused runtime evidence: 106/106 PASS. Full suite NOT RUN. Pre-Stage-3-promotion inventory measured the stable canonical deployment at v665 and the accepted temporary Stage 3 candidate at v689; promotion retains the canonical deployment ID.

## 4B. Phase 3A closure — CLOSED

**Phase 3A (Products Read Surface & Navigation Activation) is CLOSED at production v657.**

| Domain | Status | Authority |
| --- | --- | --- |
| Product Catalog | COMPLETE | Products sheet (ID_Prod, Produk, Kategori, Kind) |
| COGS & Recipe | COMPLETE | COGSRecipes (ID_Prod + Tipe + ID_Ingredient + UsageQty) |
| Standard Cost | COMPLETE | COGSIngredients.PurchaseCost / COGSIngredients.UsableQty per BaseUOM |
| Inventory Items | COMPLETE | InventoryItems (separate ingredient/packaging master) |
| Simulation | COMPLETE | Proposed Usage + Proposed Selling Price (simulation-only, no persistence) |

Production capabilities: Product Catalog, COGS & Recipe, Inventory Items — three-tab Products surface active.

Non-blockers confirmed: responsive/mobile deferred, recipe-write activation not required, simulation persistence not required, ProductPricing write not required, Finance opening WAITING_EXTERNAL.

Phase 3B dependency gate: OPEN.

## 4C. Phase 3B closure — CLOSED

**Phase 3B (Capital & Equity) is CLOSED at production v658 — READ-ONLY COMPLETE.**

| Domain | Status | Authority |
| --- | --- | --- |
| CapitalEquity | READ-ONLY COMPLETE | Historical/read-reporting projection (LEGACY_XLSM_MIGRATION) |
| Migration | ALREADY_COMPLETE | 10 valid rows; re-execution forbidden |
| Retained Earnings | COMPLETE | FinanceOpeningBalances V2: Credit 7,407,000 - Debit 0 |
| Owner Draws | BOUNDARY | Uses Transactions workflow; no CapitalEquity write surface |

Production state: 10 valid CapitalEquity rows (Dekker 5, Erway 5; OWNER_CONTRIBUTION 2, RETURN_OF_CAPITAL 8). FinanceOpeningBalances V2 schema confirmed. Account 3200 opening = 7,407,000. Current retained earnings = 6,597,400 (opening + post-cutoff P&L).

Non-blockers: diagnostic V2 schema bug (LATER priority), Finance opening WAITING_EXTERNAL.

Phase 3C dependency gate: OPEN.

## 4D. Phase 3C closure — CLOSED

**Phase 3C (Assets Foundation & Management) is CLOSED at production v662 — READ-ONLY COMPLETE.**

| Domain | Status | Authority |
| --- | --- | --- |
| Asset Register | COMPLETE | Assets sheet (69 migrated assets, read-only master) |
| Depreciation | RELOCATED | DepreciationLedger (existing capability moved to Assets tab) |
| Unified Workspace | COMPLETE | Asset Register + Depreciation tabs |
| Navigation | CONSOLIDATED | Separate Depreciation sidebar removed |

Production values: Total Assets 69, Active Assets 69, Acquisition Cost Rp 32.880.000. Depreciation Expense Rp 1.715.054, Accumulated Depreciation Rp 25.060.700, Net Book Value Rp 7.819.300, Fully Depreciated 49.

Non-blockers: responsive/mobile deferred, focused Apps Script tests unproven, Finance opening WAITING_EXTERNAL.

Phase 3D dependency gate: OPEN.

## 4E. Phase 3D closure — CLOSED

**Phase 3D (Depreciation Surface + Production Activation) is CLOSED at production v664.**

| Domain | Status | Authority |
| --- | --- | --- |
| Depreciation | COMPLETE | DepreciationLedger (StraightLine, append-only continuation) |
| Continuation Runtime | COMPLETE | Explicit target period, ID_Asset+Period idempotency |
| September 2026 | APPEND PASS | 20 rows appended, 2679→2699 total |
| Idempotency | VERIFIED | Post-run dry-run: 0 candidates, 0 writes |

Production ledger: 2699 rows through 2026-09-01. Historical 2679 rows immutable. Runtime model: ON_DEMAND_READ_GUARD. No scheduled trigger required.

Non-blockers: responsive/mobile deferred, Finance opening WAITING_EXTERNAL, focused/static tests UNPROVEN.

Phase 3E dependency gate: OPEN.

## 4F. Phase 3E closure — CLOSED

**Phase 3E (Financial Statements UI) is CLOSED; v676 is preserved as historical focused-runtime evidence.**

| Domain | Status | Authority |
| --- | --- | --- |
| P&L | ACTIVE | 48/48 focused runtime PASS |
| Cash Flow | ACTIVE | 11/11 focused runtime PASS |
| Balance Position | PENDING_FINANCE_OPENING | 47/47 focused runtime PASS (gated, no fabricated values) |

Production state before Stage 3 promotion: canonical Production Web measured at v665; the API executable serves project HEAD. P&L and Cash Flow are production-ready. Balance Position is intentionally gated pending Finance Opening. Warming/inflight contracts validated. No business data mutated.

Non-blockers: Finance Opening waits for 2026-09-30 EOD physical count/final evidence. Cash first-live proof waits for >= 2026-10-01 and real eligible traffic. Period Close remains not required for current scope. Full suite NOT RUN.

## 5. Latest completed sprint/package

**UI/UX 2.0 Package 021 — COMPLETE locally on 2026-08-06.** Source-search evidence removed only two zero-reference authored selectors, one behavior-free Transactions wrapper, two obsolete comments, and one brittle raw-template assertion. Existing ownership, geometry, behavior, data boundaries, accessibility, performance, response contracts, and Packages 017–020 composition remain unchanged.

**UI/UX 2.0 Package 022 — CLOSED on 2026-09-22.** Production v587 is active. Backend passed 114/114, functional acceptance passed 24/24, exhaustive visual acceptance passed 80/80 with 1,440/1,440 criterion decisions, and production health passed 17/17. VD-001 is remediated. Immutable v585 is the rollback target; rollback drill was not required.

**Package 025 — DESIGN SYSTEM FOUNDATION is CLOSED.** Production v611 is active. Local 41/41 gate passed. Deployed runtime health passed. Browser acceptance passed at 1440×900, 1280×768, 768px, and 375px browser/device viewport. Light/Dark/System parity verified. No Package 025 regressions observed. The unified backend suite did not complete during the acceptance session (pre-existing baseline interruption unrelated to Package 025); Package 025 closure is based on its established focused/local acceptance, production health, and browser acceptance.

**Phase 3E.16 Financial Statements UI — CLOSED at production v676.** Focused runtime evidence: 106/106 PASS (P&L 48/48, Cash Flow 11/11, Balance Position 47/47). Production Web and API Executable both serve v676. Balance Position intentionally gated as PENDING_FINANCE_OPENING.

## 6. Current test gate and evidence level

`runAllBackendTests()` contains exactly **41 ordered entries** and remains fail-fast.

| Evidence class | Current recorded evidence |
| --- | --- |
| Local/static | Release candidate `658f4ab1011633e86634f14ce838a514c5205df0`: dependency install, production/frontend syntax, manifest parse, Markdown links, eight focused release contracts, unified 25/25, runner count, and Git checks passed on 2026-08-05. |
| Current UI/UX 2.0 local/static | Package 005: all numbered JavaScript and extracted frontend JavaScript parsed; five focused frontend contracts passed; deterministic Tailwind builds matched; ordered suite passed 26/26 with 71 ID queries, two document selectors, one deferred phase, and no response mutation. |
| Current UI/UX 2.0 tabs local/static | Package 006: all numbered JavaScript and extracted frontend JavaScript parsed; six focused frontend contracts passed; deterministic Tailwind builds matched; ordered suite passed 27/27 with five tabs, 14 uniquely owned sections, zero tab-switch backend requests, 71 ID queries, two document selectors, one deferred phase, and no response mutation. |
| Current UI/UX 2.0 tabs upload | Package 006: exact 26-file clasp inventory verified and `clasp push --force` uploaded 26 files. This proves source synchronization only. |
| Current UI/UX 2.0 Overview local/static | Package 007: numbered and extracted frontend JavaScript parsed; seven focused contracts passed; ordered suite passed 28/28 with five KPI cards, zero added backend requests, 71 ID queries, two document selectors, one deferred phase, and no response mutation. |
| Current UI/UX 2.0 Overview upload | Package 007: exact 26-file clasp inventory verified and `clasp push --force` uploaded 26 files. This proves source synchronization only. |
| Current UI/UX 2.0 Performance/Analytics local/static | Package 008: numbered and extracted frontend JavaScript parsed; seven focused contracts passed; ordered suite passed 29/29 with five performance metrics, three preserved charts, zero added backend requests, 71 ID queries, two document selectors, one deferred phase, and no response mutation. |
| Current UI/UX 2.0 Performance/Analytics upload | Package 008: exact 26-file clasp inventory verified and `clasp push --force` uploaded 26 files. This proves source synchronization only. |
| Current UI/UX 2.0 Intelligence/Planning local/static | Package 009: numbered and extracted frontend JavaScript parsed; six focused contracts passed; ordered suite passed 30/30 with preserved recommendation/roadmap order, non-editable targets, zero added backend requests, 71 ID queries, two document selectors, one deferred phase, and no response mutation. |
| Current UI/UX 2.0 Intelligence/Planning upload | Package 009: exact 26-file clasp inventory verified and `clasp push --force` uploaded 26 files. This proves source synchronization only. |
| Current UI/UX 2.0 Package 009 fix local/static | Business Priority semantic ownership and bounded Revenue Trend resize contracts pass locally; runner remains 30/30, query budget remains 71/two, and no resize observer/listener or recursive scheduling was added. |
| Current UI/UX 2.0 Package 009 fix upload | Exact 26-file clasp inventory verified and corrective `clasp push --force` uploaded 26 files. This proves source synchronization only. |
| Current UI/UX 2.0 Transactions local/static | Package 010: numbered and extracted frontend JavaScript parsed; six focused contracts passed; deterministic Tailwind builds matched; Transactions uses four tabs over at most ten copied rows with 71 ID queries, two document selectors, one deferred phase, no response mutation, and no tab-switch request. |
| Current UI/UX 2.0 Transactions upload | Package 010: exact 26-file clasp inventory verified and `clasp push --force` uploaded 26 files. `clasp run` reported the new functions unavailable through the configured API executable, so upload does not establish live 31/31. |
| Current UI/UX 2.0 Settings local/static | Package 011: five focused contracts passed; deterministic Tailwind builds matched; Settings contains Appearance/About only, uses four config-derived About fields, makes zero backend requests, and preserves 71 ID queries, two document selectors, one deferred phase, and response immutability. |
| Current UI/UX 2.0 Settings upload | Package 011: exact 26-file clasp inventory verified and `clasp push --force` uploaded 26 files. This proves source synchronization only. |
| Current UI/UX 2.0 Logs local/static | Package 012: seven focused contracts and the ordered 33/33 suite passed; deterministic Tailwind builds matched; Logs uses memory-only sanitized entries with a 100-entry cap, fixed contexts/severities, filtering, counts, clear, accessible announcements, 71 ID queries, two document selectors, one deferred phase, zero Logs backend requests, and no response mutation. |
| Current UI/UX 2.0 Logs upload | Package 012: exact 26-file clasp inventory verified and `clasp push --force` uploaded 26 files. This proves source synchronization only. |
| Current UI/UX 2.0 stabilization local/static | Package 013: all 12 focused contracts and the ordered 34/34 suite passed; numbered and extracted frontend JavaScript parsed, Markdown links and Git diff checks passed, and deterministic Tailwind builds matched. The final contract reports four destinations, two tablists, zero duplicate static IDs, 71 ID queries, two document selectors, one deferred phase, and no response mutation. |
| Current UI/UX 2.0 stabilization upload | Package 013: exact 26-file clasp inventory verified and `clasp push --force` uploaded 26 files. This proves source synchronization only. |
| Current UI/UX 2.0 navigation local/static | Package 016: six focused contracts and the ordered local 35/35 suite passed; numbered and extracted frontend JavaScript parsed; deterministic Tailwind builds matched; the contract reports nine destinations, four active, five unavailable, zero navigation backend requests, 71 ID queries, and two document selectors. |
| Current UI/UX 2.0 navigation upload | Package 016: exact 26-file clasp inventory verified and `clasp push --force` uploaded 26 files. This proves source synchronization only. |
| Current UI/UX 2.0 shell local/static | Package 017: eight focused contracts and the ordered local 36/36 suite passed. The full-shell contract reports one authoritative utility row, nine destinations, four active, five unavailable, zero shell-navigation backend requests, 71 ID queries, and two document selectors. Screenshot-based visual fidelity remains unverified. |
| Current UI/UX 2.0 Dashboard local/static | Package 018: ten focused contracts and the ordered local 37/37 suite passed. The composition contract reports five tabs, five compact Overview KPIs, three preserved charts, zero tab-switch backend requests, 71 ID queries, and two document selectors. Screenshot-based visual fidelity remains unverified. |
| Current UI/UX 2.0 secondary destinations local/static | Package 019: ten focused contracts and the ordered local 38/38 suite passed. The composition contract reports three destinations, four transaction tabs, five visible columns, maximum ten rows, zero navigation backend requests, 71 ID queries, and two document selectors. Screenshot-based visual fidelity remains unverified. |
| Current UI/UX 2.0 theme parity local/static | Package 020: 12 focused contracts and the ordered local 39/39 suite passed. The parity contract reports 45 paired Light/Dark tokens, zero chart recreation, zero theme backend requests, 71 ID queries, and two document selectors. Browser contrast and screenshot fidelity remain unverified. |
| Current UI/UX 2.0 bounded refactor local/static | Package 021: 13 focused contracts and the ordered local 40/40 suite passed. The refactor contract reports five removed symbols, zero tab/navigation requests, 71 ID queries, two selectors, one deferred phase, and no response mutation. Browser regression and screenshot fidelity remain unverified. |
| Current UI/UX 2.0 closure | Package 022 CLOSED on production v587: backend 114/114 PASS, functional 24/24 PASS, visual 80/80 PASS with 1,440/1,440 criterion decisions, production health 17/17 PASS, VD-001 remediated, and v585 retained for rollback. Rollback drill was not required. |
| Current UI/UX 2.0 Apps Script runtime | Final `runAllBackendTests()` PASS 34/34. |
| Current UI/UX 2.0 browser | PASS at 320px, 375px, 768px, 1280×768, and 1440×900 across responsive containment, accessibility, Light/Dark/System, navigation, charts, tables, print, CSV, drill-down, Settings, and Logs. |
| Current UI/UX 2.0 Git completion | Final stabilization committed as `7fbd2a3` and pushed; `main`, `origin/main`, and `HEAD` align. |
| Current UI/UX 2.0 upload | Package 005: exact 26-file clasp inventory verified and `clasp push --force` uploaded 26 files. This proves source synchronization only. |
| Upload | Authorized clasp identity and the exact 26-file inventory were confirmed; `clasp push --force` completed with `Script is already up to date.` for candidate `658f4ab1011633e86634f14ce838a514c5205df0`. |
| Apps Script runtime | Candidate `658f4ab1011633e86634f14ce838a514c5205df0`: live `runAllBackendTests()` PASS 25/25. |
| Deployment | Existing stable production deployment updated to immutable version 185; stable URL unchanged. Immutable version 184 retained for rollback. |
| Deployed browser | PASS for the version 185 production deployment. |
| Production health | PASS for version `1.0.0 — Production` on immutable deployment version 185. |

An upload is not runtime, deployment, or browser evidence.

## 7. Overall completion summary

The bounded dashboard capability set is implemented: Aggregate Engine analytics, resilient date-scoped states, responsive and accessible presentation, reporting metadata, data-quality visibility, charts, period comparison, Business Priority, explainable targets, bounded client performance, print, visible-row CSV, and bounded recent-transaction drill-down. Three expansion scopes remain blocked by missing requirements or external evidence. No remaining feature scope is implementation-ready.

## 8. Completed milestone matrix

| Milestone | Evidence-backed outcome |
| --- | --- |
| Sprint 5.5 | Dashboard Intelligence complete. |
| Sprint 5.6 | Aggregate Engine migration and numbered source decomposition complete. |
| Sprint 5.7 | Production styling, unified test workflow, release metadata/workflow, and migration-oracle retirement complete. |
| Sprint 5.8 | Product audit, sparse-data resilience, authoritative date filtering, and recoverable dashboard states complete. |
| Sprint 5.9 | Responsive shell, reporting scope/freshness, data-quality visibility, chart comprehension, and pinned dependencies complete. |
| Sprint 5.10 | Accessibility, executive hierarchy, period comparison, Business Priority, and explainable KPI targets complete locally. |
| Sprint 5.11 | Bounded client-render performance complete and uploaded. |
| Sprint 5.12 | Print-ready filtered executive report complete. |
| Sprint 5.13 | Visible-row CSV and formula-injection hardening complete with live unified 25/25 evidence. |
| Sprint 5.14 | Bounded recent-transaction drill-down complete, committed, pushed, and uploaded. |
| Sprint 5.15 | Dashboard-response consumer inventory complete as documentation/discovery work. |
| Sprint 5.16 and v1.0 closeout | Sparse 37-field response contract complete; candidate live 25/25, deployment version 185, browser acceptance, and production health passed with rollback version 184 retained. |

## 9. Implementation-ready backlog

**Count: 0 remaining UI/UX completion packages.** Packages 014–022 are complete, and Package 022 is closed on production v587. The three data/API expansion scopes remain blocked.

## 10. Blocked backlog

**Count: 3.** [PRODUCT-BACKLOG.md](PRODUCT-BACKLOG.md) owns the detailed entries and dependencies.

1. Editable KPI targets — blocked by unapproved persistence, validation, permissions, migration, governance, and business-target semantics.
2. Dashboard API projection or payload reduction — blocked by unknown external consumers, deployment-access evidence, permission review, payload measurement, and an additive compatibility design.
3. Drill-down expansion beyond the existing maximum-ten-row projection — blocked by authorization, pagination, privacy, and approved detail-field requirements.

Five additional concepts are future major capabilities rather than defects or ready backlog: a migrated Products module, Capital & Equity, Assets, Depreciation, and Financial Statements. Each requires a separately approved data model, migration, governance, permissions, calculations, acceptance criteria, and release plan.

## 11. Technical debt

- The Apps Script iframe sandbox warning remains accepted platform output, not an application defect.
- Historical milestone sections retain their original runner totals; the active development gate now requires exactly 40/40.
- Editable targets, payload projection, and expanded drill-down must not be implemented until their blocked prerequisites are resolved.

## 12. Documentation status

Documentation ownership is explicit and non-overlapping:

- `PROJECT_STATUS.md` answers where the project is now.
- [ROADMAP.md](ROADMAP.md) owns direction, sequencing, and milestone placement.
- [PRODUCT-BACKLOG.md](PRODUCT-BACKLOG.md) owns remaining work, readiness, blockers, and dependencies.
- [CHANGELOG.md](CHANGELOG.md) owns completed changes and release history.
- [DECISIONS.md](DECISIONS.md) owns durable engineering and product decisions.
- [TESTING.md](TESTING.md) owns validation contracts, runner semantics, and evidence levels.
- [RELEASE.md](RELEASE.md) owns release sequencing, deployment, browser acceptance, and rollback.
- `.ai/PROJECT_CONTEXT.md` provides concise session continuity and points here for executive status.

Historical evidence remains in its owning document; this file summarizes current conclusions only.

## 13. Release-readiness checklist

The v1.0 readiness audit on 2026-08-05 produced this criterion matrix. `PASS` means the criterion is supported at the stated evidence level; it does not imply a later evidence level.

| Release criterion | Status | Highest current evidence | Closeout requirement |
| --- | --- | --- | --- |
| Production architecture | PASS | Repository/static and production acceptance | Preserve the numbered Apps Script architecture and one Aggregate Engine build. |
| Analytics and intelligence | PASS | Apps Script live 25/25 and production acceptance | Maintain through the ordered unified gate. |
| Dashboard functionality | PASS | Deployed-browser and production acceptance | Maintain the accepted response and interaction contracts. |
| Responsive behavior | PASS | Deployed-browser acceptance | Recheck for any frontend maintenance release. |
| Accessibility | PASS | Deployed-browser acceptance | Preserve keyboard, focus, semantic, live-region, and reduced-motion contracts. |
| Performance | PASS | Local contract and deployed-browser acceptance | Preserve bounded DOM queries, deferred work, and response immutability. |
| Print and CSV export | PASS | Apps Script live contract and deployed-browser acceptance | Preserve visible-scope and CSV-safety contracts. |
| Drill-down | PASS | Local contract and deployed-browser acceptance | Preserve the existing maximum-ten-row boundary. |
| Response-contract coverage | PASS | Local and Apps Script live 25/25 | Preserve exactly 37 top-level fields and the five-member `dateFilter` contract. |
| Documentation | PASS | Repository/static | Record release completion and retain historical evidence. |
| Rollback readiness | PASS | Immutable version 184 retained | Repoint the same stable deployment to version 184 if rollback is required. |
| Dependency pinning | PASS | Repository/static and deployed-browser acceptance | Keep exact dependency versions and local Tailwind ownership. |
| Known technical debt | PASS | Repository/documentation | Keep the three gated expansions deferred; accept only the documented Apps Script iframe warning. |

**Mandatory v1.0 blockers: none.** Editable targets, payload projection, and expanded drill-down remain optional future work and are not v1.0 blockers.

- [x] Feature Complete v1.0 status is supported by explicit acceptance evidence.
- [x] Active runner membership is 40; the production v1.0 runtime evidence remains historical 25/25.
- [x] Package 022 closure evidence is complete: backend 114/114, functional 24/24, visual 80/80 with 1,440/1,440 decisions, and production health 17/17 passed on production v587.
- [x] Three data/API expansion scopes remain blocked; no UI/UX completion package remains active.
- [x] Reconcile stale `10/10` and legacy runner references in `RELEASE.md` before executing a release.
- [x] Start release operations from a clean, reviewed Git worktree.
- [x] Run the then-current 25-entry unified gate locally against the exact v1.0 release candidate.
- [x] Review clasp inventory and upload only with explicit authorization.
- [x] Run `runAllBackendTests()` successfully in the intended Apps Script project: 25/25 PASS.
- [x] Update the existing production deployment to immutable version 185 while retaining the stable URL.
- [x] Pass desktop and narrow-width browser acceptance, including Console and Network review.
- [x] Confirm `1.0.0 — Production`, deployment version 185, production health, and rollback version 184 agree.

## 14. Active-development boundary

Package 022 is closed. Any later UI/UX work requires separately approved bounded scope while all of these conditions remain true:

- the feature/backend baseline remains stable and unchanged unless separately authorized;
- version `1.0.0` continues to satisfy the documented bounded product need;
- the mandatory 40-entry gate remains green at the latest accepted boundary;
- documentation, Git, production baseline, and rollback records remain consistent; and
- blocked data/API concepts remain outside the UI/UX package scope.

## 15. Blocked-feature resume criteria

Resume a blocked feature only when it has an approved owner, user need, bounded requirements, data and permission model, privacy/governance decisions, compatibility strategy, acceptance tests, migration plan when applicable, and rollback boundary.

Resume a blocked feature only when every dependency listed for that scope in [PRODUCT-BACKLOG.md](PRODUCT-BACKLOG.md) has an evidence-backed decision, acceptance contract, privacy/permission boundary, rollback approach, and independently releasable validation plan.

## 16. Maintenance policy

- Review operational health and dependency/security advisories monthly; perform a broader backlog and product-need review quarterly.
- Accept PATCH work for reproducible defects, security fixes, dependency maintenance, accessibility regressions, documentation corrections, monitoring/operational fixes, and behavior-preserving performance improvements.
- Accept MINOR work only for an explicitly approved backward-compatible capability with complete requirements, no incompatible default response change, an independently releasable test plan, and rollback evidence.
- Require a MAJOR version for incompatible response/schema/workflow/permission/deployment/data-ownership changes or an approved migrated Products, Capital & Equity, Assets, Depreciation, or Financial Statements architecture.
- Preserve the 36-entry fail-fast gate, response contracts, spreadsheet ownership, accessibility, query budget, stable production URL, and immutable rollback history for every maintenance release.
- Treat support requests and monitoring signals as intake, not automatic authorization for feature development.

## 17. Future vision

After v1.0 stabilization, NUMLOCK may evolve from a bounded dashboard into a governed decision-support workspace with configurable goals, faster purpose-specific payloads, and authorized transaction exploration. Each capability remains optional and must preserve spreadsheet ownership, Apps Script compatibility, privacy, accessibility, and backward-compatible defaults.

## 18. UI/UX 2.0 closure

**CLOSED on 2026-09-22.** Production v587 is active. Backend passed 114/114, functional acceptance passed 24/24, exhaustive visual acceptance passed 80/80 with 1,440/1,440 criterion decisions, and production health passed 17/17. VD-001 is remediated. Immutable v585 is retained for rollback; rollback drill was not required.

UI/UX 2.0 must not imply editable targets, broader transaction access, API projection, or new persistence until the corresponding backlog blockers are resolved.

## 19. Next milestone

**Package 022 is closed.** Next work is maintenance-only or separately approved demand-driven scope; blocked data/API concepts remain gated.

## 20. Status-history log

| Date | Status | Evidence summary |
| --- | --- | --- |
| 2026-08-03 | Production 1.0.0 | Release history records production 1.0.0 and earlier deployment/browser acceptance. |
| 2026-08-04 | Stabilization expansion | Sprints 5.10–5.12 completed locally with evidence levels recorded separately. |
| 2026-08-05 | Release Candidate | Repository preflight and upload prerequisites passed for candidate `658f4ab1011633e86634f14ce838a514c5205df0`. |
| 2026-08-05 | Feature Complete v1.0 | Live suite passed 25/25; immutable deployment version 185, unchanged stable URL, deployed-browser acceptance, and production health passed; version 184 retained for rollback. |
| 2026-08-05 | UI/UX 2.0 discovery | Package 001 mapped all current capabilities, selected a two-destination Dashboard/Transactions architecture, and deferred Reports and Settings; documentation only, with no mockup or production change. |
| 2026-08-05 | UI/UX 2.0 discovery | Package 002 defined four low-fidelity desktop/mobile wireframes, compared two Dashboard variants, and recommended Executive-first for later high-fidelity work; documentation only, with no production or Tailwind change. |
| 2026-08-05 | UI/UX 2.0 discovery | Package 003 compared four visual directions, selected Executive Minimal and Modern Financial for later high-fidelity comparison, and defined preliminary shortlisted tokens; documentation only, with no production or Tailwind change. |
| 2026-08-05 | UI/UX 2.0 design contract | Package 004 defined the one-viewport tabbed shell, four approved destinations, full light/dark tokens, component/accessibility rules, truthful Settings and session-local Logs boundaries, and implementation slices; documentation only, with no production or Tailwind change. |
| 2026-08-05 | UI/UX 2.0 implementation | Package 005 implemented and uploaded the 26-file shell/theme foundation with four destinations and raised the ordered local gate to 26/26; runtime, deployment, and browser acceptance remain unverified. |
| 2026-08-05 | UI/UX 2.0 implementation | Package 006 migrated 14 existing Dashboard sections exactly once into five accessible panels, raised the ordered local gate to 27/27, and uploaded the exact 26-file inventory; runtime, deployment, and browser acceptance remain unverified. |
| 2026-08-05 | UI/UX 2.0 implementation | Package 007 redesigned only Overview, raised the ordered local gate to 28/28, retained the 71-ID/two-selector query budget, and uploaded the exact 26-file inventory; runtime, deployment, and browser acceptance remain pending. |
| 2026-08-05 | UI/UX 2.0 implementation | Package 008 redesigned only Performance and Analytics, raised the ordered local gate to 29/29, retained chart source/order plus the 71-ID/two-selector query budget, and uploaded the exact 26-file inventory; runtime, deployment, and browser acceptance remain pending. |
| 2026-08-05 | UI/UX 2.0 implementation | Package 009 redesigned only Intelligence and Planning, raised the ordered local gate to 30/30, retained intelligence output/order plus the 71-ID/two-selector query budget, and uploaded the exact 26-file inventory; runtime, deployment, and browser acceptance remain pending. |
| 2026-08-06 | UI/UX 2.0 completion | Packages 010–013 completed Transactions, Settings, Logs, and final stabilization; the runner reached 34 entries. |
| 2026-08-06 | UI/UX 2.0 complete / Project hold | Packages 004–013 complete; final local/live suite passed 34/34, browser acceptance passed, final stabilization commit `7fbd2a3` was pushed, and the project entered hold with maintenance-only intake. |
| 2026-08-06 | UI/UX 2.0 closure correction | The prior closure remains historical but is superseded as current status: functional evidence remains valid, visual parity and nine-destination navigation remain incomplete, and active UI/UX development resumes. |
| 2026-08-06 | UI/UX 2.0 Package 014 | Added the three project-local UI, refactor, and regression skills without changing production behavior. |
| 2026-08-06 | UI/UX 2.0 Package 015 | Locked the high-fidelity implementation specification and separate screenshot-scoring contract; documentation only. |
| 2026-08-06 | UI/UX 2.0 Package 018 | Reconstructed all five Dashboard tabs, added the high-fidelity composition contract, and raised the ordered local gate to 37/37 without changing backend or feature behavior. |
| 2026-08-06 | UI/UX 2.0 Package 019 | Aligned Transactions, Settings, and Logs with the high-fidelity system, added the secondary-destination composition contract, and raised the ordered local gate to 38/38 without broadening product scope. |
| 2026-08-06 | UI/UX 2.0 Package 020 | Centralized Light/Dark/System, chart, skeleton, state, and print-light color ownership, added listener lifecycle coverage, and raised the ordered local gate to 39/39 without changing geometry or product behavior. |
| 2026-08-06 | UI/UX 2.0 Package 021 | Removed five proven reconstruction-debt symbols, replaced one brittle metadata assertion, and raised the ordered local gate to 40/40 without changing geometry or product behavior. |
| 2026-09-22 | UI/UX 2.0 Package 022 closed | Production v587 active; backend 114/114, functional 24/24, visual 80/80 (1,440/1,440 decisions), and production health 17/17 passed. VD-001 remediated; v585 retained for rollback; rollback drill not required. |
| 2026-09-22 | Purchase Recovery Incident — Hakaes CLOSED | Canonical boolean persistence fixed; Hakaes row remediated; automatic pending recovery added; incident-only public RPCs removed. Production v595. |
| 2026-09-29 | Phase 3E.16 Financial Statements UI CLOSED | Production v676 active; focused runtime 106/106 PASS (P&L 48/48, Cash Flow 11/11, Balance Position 47/47). Balance Position PENDING_FINANCE_OPENING. Finance Opening WAITING_EXTERNAL (2026-09-30 EOD). |
| 2026-10-04 | Transactions PaymentStatus compatibility repair PRODUCTION COMPLETE | Canonical @691 "Transactions PaymentStatus compatibility repair"; deployment ID unchanged; active deployments @HEAD + @691. Post-promotion diagnostics PASS (PurchaseEvents read 9 rows; legacy missing-PaymentStatus compatibility PASS; PaymentStatus runtime error CLOSED; validateFinanceProductionRuntime PASS five periods; Inventory Policy Evidence PASS unresolved 0; 0 business-data writes; PRODUCTION_MIGRATION_INVOCATIONS 0). Local MEASURED: Policy C harness 30/0; PaymentStatus CASE 1–8 PASS. Broad suite 97/29 recorded as known gap (unrelated/deferred, incl. isolated Products expectations). UNKNOWN: browser Transactions acceptance; remote getTransactionsPage/getTransactionsPeriodRows probes; direct production valid/invalid PaymentStatus write probes. Products Contract Reconciliation OPEN/DEFERRED. Stage 3 @690 acceptance evidence remains historical. |

## 21. Purchase Recovery Incident — Hakaes (CLOSED)

**Status:** CLOSED
**Production version at closure:** v595
**Date:** 2026-09-22

### Root Cause
`appendEvent` in `purchaseEventProductionRuntime_` applied `setNumberFormat('@')` (text format) to the entire PurchaseEvents row before `setValues`. Boolean `IsActive: true` was coerced to string `"true"` in text-formatted cells. The corrupted row blocked `purchaseEventHistory_` global validation, which blocked the Transactions page read path.

### Impact
- Hakaes PurchaseEvent (requestKey: `receipt-155ac0faba8815dcd59fdd3a20130669`) could not be found by status lookup
- `purchaseEventHistory_` threw `PURCHASE_HISTORY_CONFLICT` for the corrupted row
- Transactions page displayed "Transactions unavailable"

### Resolution
1. Added `writeCanonicalBoolean_` helper: changes cell format from `@` to `General`, writes boolean `true`, verifies readback
2. `appendEvent` now uses the canonical primitive with fail-closed readback verification
3. Bounded remediation fixed the existing Hakaes row (IsActive: string `"true"` → boolean `true`)
4. Added automatic pending Purchase recovery: `restoreReceiptEntryPending` now calls `lookupPurchaseEventStatus` instead of forcing uncertain state
5. Removed temporary incident-only public RPCs (diagnose, scan, remediate) — private helpers retained

### Commits
- `998b999` — fix: decouple purchase capture from activation cutoff
- `89e606c` — fix: add read-only Purchase status lookup and WRITE_UNCERTAIN diagnostics
- `10a426d` — fix: enforce canonical requestKey and targeted lookup isolation
- `89e606c` — fix: add read-only Purchase status lookup
- `735eef9` — diagnostic: add read-only PurchaseEvent integrity inspector
- `ca9e1e0` — fix: preserve boolean IsActive in PurchaseEvent writer
- `639f58a` — feat: add zero-write IsActive eligibility scanner and dry-run remediation
- `fa38832` — fix: canonical boolean persistence for PurchaseEvent IsActive
- `7fd7aa2` — fix: auto-check pending Purchase status on dialog reopen

### Verification
- 114/114 backend regression PASS
- Finance runtime validation PASS/read-only
- Hakaes: matchingRowCount=1, IsActive=boolean true, overallPass=true, normalizedPayloadMatchesRow=true
- FOUND_MATCHING_EVENT with original pending payload
- Automatic pending recovery PASS
- Transactions page loads normally
- No duplicate PurchaseEvent created
