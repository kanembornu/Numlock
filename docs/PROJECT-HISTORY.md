# NUMLOCK Project History

This is the authoritative evidence index for documented sprints and packages. It complements [Project Status](PROJECT_STATUS.md), [Roadmap](ROADMAP.md), and [Changelog](CHANGELOG.md). Missing evidence is stated rather than inferred.

## Evidence rules

- Git evidence is a commit or tag reachable in the complete inspected history through `5c2726d` on 2026-08-06.
- Local/static, Apps Script live, upload, deployment, functional browser, and visual-fidelity evidence are separate.
- “Technically complete, visually incomplete” means bounded behavior was completed, but no approved-reference screenshot comparison proves visual parity.
- Historical closure wording remains historical; the 2026-08-06 gap audit corrects the current conclusion.

## Sprint and package inventory

| Identifier | Objective and principal deliverable | Status | Test gate when evidenced | Commit/tag evidence |
| --- | --- | --- | --- | --- |
| Sprint 1 | Not documented; early repository/application foundations are visible but unmapped | Evidence gap | Not evidenced | `43ce690`–`1ed0805`; sprint attribution unverified |
| Sprint 2 | No named objective or package recoverable | Evidence gap | Not evidenced | None attributable |
| Sprint 3 | No named objective or package recoverable | Evidence gap | Not evidenced | None attributable |
| Sprint 4 | No named objective or package recoverable | Evidence gap | Not evidenced | None attributable |
| Sprint 5.1 | No named objective or package recoverable | Evidence gap | Not evidenced | None attributable |
| Sprint 5.2 | No named objective or package recoverable | Evidence gap | Not evidenced | None attributable |
| Sprint 5.3 | No named objective or package recoverable | Evidence gap | Not evidenced | None attributable |
| Sprint 5.4 | No named objective or package recoverable | Evidence gap | Not evidenced | None attributable |
| Sprint 5.5 | Dashboard Intelligence: financial, trend, product, scoring, diagnosis, recommendation, risk, and decision outputs | Complete | Historical acceptance; no sprint-specific numeric gate retained | Foundation docs `8251e54`, `3162e3e`; exact implementation boundary incomplete |
| Sprint 5.6 | Aggregate Engine migration and numbered source/test decomposition | Complete | Final acceptance documented; exact sprint-only gate not retained | `369d5cc`–`9101f2a`, `c3bf360`–`273f89e`, `2f4fa77` |
| 5.7 Package 001 | Compiled Tailwind 3.4.17 and clasp-safe styling | Complete | Unified tests introduced; historical total not retained | `ca85a6b`, `4f83874` |
| 5.7 Package 002 | Production frontend console policy | Complete | Static policy evidence | `1017b09` |
| 5.7 Package 003 | Centralized `1.0.0` release metadata | Complete | Static/config | `a64f8b8` |
| 5.7 Package 004 | Release workflow and oracle audit | Complete | Documentation/static | `0ee6e3b` |
| 5.7 Package 005 | Deterministic fixtures; retire six legacy analytics oracles | Complete | Six domain contracts; exact runner total not retained | `d71783f`–`50906d1` |
| 5.8 Package 001 | Evidence-based product backlog | Complete | Documentation/static | `b450ea8` |
| 5.8 Package 002 | Empty/sparse-data resilience | Complete and deployed | Exact package total not retained | `50f1831` |
| 5.8 Package 003 | Project-timezone dashboard date filtering | Complete and deployed | Focused date-filter contract | `70ecfcc` |
| 5.8 Package 004 | Loading/success/empty/error/retry and stale-response protection | Complete | Local contract; package live/browser then pending | `4a2affa` |
| 5.9 Package 001 | Responsive shell, drawer, table containment | Complete | Unified 12/12 | `245d58b` |
| 5.9 Package 002 | Reporting scope and freshness | Complete | Reporting metadata contract | `ed6632d` |
| 5.9 Package 003 | Scoped data-quality diagnostics | Complete | Scoped data-quality contract | `f01b8ba` |
| 5.9 Package 004 | Source-level invalid-date visibility | Complete | Source invalid-date contract | `bb3fc90` |
| 5.9 Package 005 | Chart comprehension, empty states, lifecycle | Complete | Chart-presentation contract | `6244fa7` |
| 5.9 Package 006 | Pinned dependencies and Chart.js fallback | Complete | Frontend-dependency contract | `4bd1df5` |
| 5.10 Package 001 | Accessibility contract | Complete | 18/18 | `e689705` |
| 5.10 Package 002 | Executive-first presentation | Complete | 19/19 | `f25fea4` |
| 5.10 Package 003 | Period comparison | Complete | 20/20 | `0371124` |
| 5.10 Package 004 | Unified Business Priority | Complete | 21/21 | `6964871` |
| 5.10 Package 005 | Explainable KPI targets | Complete | 22/22 | `bdeb64b`; closure `ace7c83` |
| 5.11 Package 001 | Bounded client render, immutability, cancellation | Complete and uploaded | Local 23/23 | `46e42b1`; closure `ec44852` |
| 5.12 Package 001 | Active-filter A4 browser print | Complete | Local 24/24 | `0e6dcdc`; closure `e195e88` |
| 5.13 Package 001 | Visible-row/five-column CSV | Complete after Package 002 | Runner 25; initial closure gap recorded | `563a7e4`, `f4877bc` |
| 5.13 Package 002 | CSV injection safety and acceptance | Complete | Focused live contracts; live 25/25 | `c932dcb`, `6be1219`; tag `v1.0.0-sprint5.13` at `eef031d` |
| 5.14 Package 001 | Bounded KPI/chart drill-down over maximum-ten recent rows | Complete within bounded scope | Local 25/25; live/browser then unverified | `fe6c424`, `18f0c54` |
| 5.15 Package 001 | Inventory 37 dashboard-response fields/consumers | Complete as discovery | Documentation/static | `e373b9a`, `0620eed` |
| 5.16 Package 001 | Exact 37-field and five-member `dateFilter` contract | Complete | Local 25/25; later v1 live evidence | `0114ca4`, `4b8e53c` |
| v1.0 closeout | Production 185, rollback 184, stable URL/version | Complete | Apps Script live 25/25; deployed-browser and health PASS | Candidate `658f4ab`; tag `v1.0.0` at `8696946` |
| UI/UX 001 | Capability map and immediate navigation discovery | Complete historically; partly superseded | Markdown/static | `6ef1e64` |
| UI/UX 002 | Desktop/mobile low-fidelity wireframes | Complete historically | Markdown/static | `a52894f` |
| UI/UX 003 | Four visual directions; Executive Minimal primary | Complete discovery; high-fidelity artifacts deferred | Markdown/static | `e9a5a8c` |
| UI/UX 004 | Hybrid component/theme contract and implementation slices | Complete specification; future-navigation rule superseded | Markdown/static | `95f4963` |
| UI/UX 005 | Shell, 240/72px sidebar, utility bar, four routes, themes | Technically complete, visually incomplete | Local 26/26; uploaded | `f466e7f` |
| UI/UX 006 | Five Dashboard tabs | Technically complete, visually incomplete | Local 27/27; uploaded | `3bcd117` |
| UI/UX 007 | Dashboard Overview | Technically complete, visually incomplete | Local 28/28; uploaded | `9498748` |
| UI/UX 008 | Performance and Analytics | Technically complete, visually incomplete | Local 29/29; uploaded | `bfc8642` |
| UI/UX 009 | Intelligence and Planning | Technically complete, visually incomplete | Local 30/30; uploaded | `bfad4fc` |
| UI/UX 010 | Four bounded Transactions tabs | Technically complete, visually incomplete | Runner 31; uploaded | `96e78ba` |
| UI/UX 011 | Appearance/About Settings | Technically complete, visually incomplete | Local 32/32; uploaded | `3c85f79` |
| UI/UX 012 | Sanitized session-local Logs | Technically complete, visually incomplete | Local 33/33; uploaded | `3fea7ba` |
| UI/UX 013 | Cross-cutting stabilization | Technically complete, visually incomplete; “final” superseded | Local/live 34/34 and functional browser PASS; no reference-parity evidence | `7fbd2a3`; premature closure `5c2726d` |

## Evidence gaps and correction

Sprints 1–4 and 5.1–5.4 are not named or mapped in the inspected docs or commit subjects, so their objectives, packages, gates, and completion cannot be reconstructed responsibly. Several early packages record acceptance without an exact package-specific numeric gate. The `5c2726d` closure accurately preserves functional evidence but overstates the visual conclusion: no repository artifact proves side-by-side fidelity against the approved primary visual reference at every required viewport.
