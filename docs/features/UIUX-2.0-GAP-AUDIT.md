# NUMLOCK UI/UX 2.0 Gap Audit

## Audit conclusion

The feature/backend baseline is stable and the bounded UI implementation passed its recorded functional gates. UI/UX 2.0 is not complete. Package 013 was final only for its former stabilization contract; it did not prove visual fidelity to the approved reference direction or implement the now-approved nine-destination navigation architecture.

No production source, Tailwind, skill, clasp, deployment, commit, or push change is authorized by this audit.

## Evidence boundary

This conclusion compares the current frontend and styling inputs, UI/UX discovery documents, current skills, project documentation, and complete Git/tag history. Contract tests establish semantics and bounded behavior, not visual parity. The user-supplied reference 2 is the primary visual authority; reference 1 supports sidebar/navigation.

## Milestone reconciliation

| Milestone | Reconciled status | Reason |
| --- | --- | --- |
| Feature/backend v1.0 | Completed | Live 25/25, deployment 185, browser/health acceptance, rollback 184 and `v1.0.0` are recorded |
| UI/UX Packages 001–004 | Completed/superseded in part | Valid discovery/specification history; later product decisions superseded early navigation limits |
| UI/UX Packages 005–013 | Technically complete but visually incomplete | Functional/local/live/browser gates exist; approved-reference screenshot comparison does not |
| UI/UX 2.0 closure | Superseded | `5c2726d` remains historical; current state is reopened active development |
| Editable KPI targets | Blocked | Persistence, validation, permissions, migration and governance remain unapproved |
| Dashboard payload projection | Blocked | External consumers, permissions, measurement and compatibility remain unresolved |
| Expanded transaction history/drill-down | Blocked | Authorization, privacy, pagination and field requirements remain unresolved |
| Products and financial modules | Planned/migration-gated | Navigation presence is approved; usable pages require migration |

## Missing Codex skills

The current inventory has 16 NUMLOCK skills and lacks the three previously planned skills. Do not create them in this task.

| Skill | Intended ownership | Overlap boundary | Order |
| --- | --- | --- | ---: |
| `$numlock-ui` | Reference translation, visual system, shell/component composition, density, typography, tokens, screenshot acceptance | Frontend owns runtime/Tailwind; Dashboard owns response/state; Accessibility owns semantics | 1 |
| `$numlock-refactor` | Behavior-preserving decomposition, dead-code evidence, ownership moves, load-order and rollback gates | Development owns general workflow; domain skills own behavior; Git owns staging | 2 |
| `$numlock-regression` | Cross-surface matrix, screenshot baselines, viewport/theme coverage and change-impact routing | Testing owns runner; Validation owns sequence; UI owns design decisions | 3 |

Visual ownership must be explicit before refactor boundaries are adjusted; regression then codifies accepted design and behavior baselines.

## Sidebar and navigation gap

The approved order is Dashboard, Transactions, Settings, Logs, Products, Capital & Equity, Assets, Depreciation, and Financial Statements. The runtime renders only the first four. Its desktop sidebar already expands/collapses and its mobile sidebar is an accessible drawer, but five approved destinations and their future-module group/status treatment are absent.

The truthful future implementation must:

- render all nine destinations in order;
- keep the first four enabled;
- show the five future modules as unavailable until migration, with text such as `Unavailable until module migration is approved`;
- use disabled or `aria-disabled="true"` semantics, suppress activation, and never rely on color alone;
- create no routes, empty panels, sample values, or placeholder pages;
- group the five items under a labelled, accessible `Financial modules` disclosure with synchronized expanded/hidden/focus state;
- preserve equivalent order/status in expanded, collapsed and mobile-drawer states, without hover-only explanations.

This approval supersedes Package 004’s “omit until usable” rule for navigation visibility only. Its no-empty-page/no-fabricated-capability boundary remains.

## Visual-fidelity gap

| Class | Approved trait | Current divergence | Required correction |
| --- | --- | --- | --- |
| Structural | Single desktop viewport | Bounded viewport exists, but rigid/internal-scroll layouts lack visual proof | Reconstruct and measure at both desktop targets |
| Navigation | Hidden/collapsible sidebar; nine destinations | Collapse/drawer exists; only four destinations | Add truthful nine-item architecture and verify all states |
| Structural | Slim utility/header | 64px utility bar is followed by a second large Dashboard header/control region | Consolidate page context and controls |
| Component | Horizontal content navigation above KPI cards | Tabs exist but use a conventional underlined rail | Recompose to the reference-led treatment without changing semantics |
| Density | Compact KPI cards | Five rounded cards and executive regions consume height and compete | Reduce padding, copy and chrome while preserving facts/targets |
| Structural | Chart-led composition | Overview is card-led; charts are isolated in secondary tabs | Increase chart prominence without duplicating data |
| Visual | Low-noise monochrome surfaces; restrained accent | Multiple accent/status colors and tints are visually active | Reserve accent for selection/action/necessary status |
| Visual | Minimal borders/cards | Nested rounded, bordered surfaces, badges and pills dominate | Group primarily through whitespace, alignment and type |
| Typography | Editorial hierarchy | Bold headings, uppercase eyebrows and badge copy read as SaaS components | Define quieter scale, weight, line length and numeric hierarchy |
| Component | Remove unused SaaS decoration | Subtitle, repeated metadata, icons, badges and containers add chrome | Remove/consolidate nonessential decoration |
| Interaction | Clear collapse/disclosure | Sidebar collapse works; future-module disclosure/status does not | Add keyboard/focus-safe grouping and unavailable behavior |
| Responsive | Equivalent hierarchy at 768px/375px | Functional reflow exists; no side-by-side fidelity record | Reconstruct and capture visual evidence |

Packages 005–013 optimized against text/static contracts and incremental preservation of the existing DOM. Package 003 explicitly deferred high-fidelity artifacts, and later packages never introduced a reference-comparison gate. Contract and broad browser PASS therefore proved behavior, not likeness.

## Remaining completion plan

Old package history is unchanged. Package 013’s “final” label is superseded by these new identifiers.

| Package | Objective | Exit evidence |
| --- | --- | --- |
| 014 | Create `$numlock-ui`, `$numlock-refactor`, `$numlock-regression` in order | Ownership/inventory review; no production change |
| 015 | High-fidelity specification from reference 2 with reference 1 navigation support | Approved annotated layouts/tokens/type/density at all four sizes |
| 016 | Future-module sidebar architecture | Nine destinations; five truthful unavailable items; no empty routes; desktop/mobile acceptance |
| 017 | Full-shell reconstruction | Slim utility, low-noise canvas, reference geometry and restrained decoration |
| 018 | Dashboard composition reconstruction | Horizontal content navigation, compact KPIs, chart-led hierarchy, preserved state/Business Priority |
| 019 | Transactions/Settings/Logs alignment | Shared editorial hierarchy, density, controls, tables and truthful scope |
| 020 | Light/dark parity | Equivalent hierarchy, contrast, focus, charts, states and accent restraint |
| 021 | Proven-necessary bounded refactor | Behavior-preserving cleanup only; no API/data/formula change |
| 022 | Regression and visual acceptance | Functional suite plus approved screenshot comparison and sign-off |

Each implementation package needs separate authorization and must remain independently releasable. Functional regression stays green throughout; visual acceptance is required before UI/UX 2.0 closes again.

## Visual acceptance contract

Visual acceptance is distinct from functional browser acceptance. It requires current-versus-reference/specification screenshots reviewed side by side.

| Viewport | Required states |
| --- | --- |
| `1440 × 900` | Expanded/collapsed sidebar, Dashboard primary composition, enabled/unavailable navigation, Light/Dark |
| `1280 × 768` | Expanded/collapsed sidebar, compact density and viewport fit, Light/Dark |
| `768px` wide | Closed/open drawer, Dashboard/Transactions, unavailable status, Light/Dark |
| `375px` wide | Closed/open drawer, content-nav reflow, KPI/chart/table containment, Light/Dark |

Every result must record hierarchy, density, viewport fit, sidebar states, typography, spacing, chart prominence, and light/dark parity. Desktop viewport fit permits no document scroll in the approved reference states unless the specification explicitly allows a labelled panel scroller. A PASS requires screenshots, reviewer comparison, and a checklist result for every viewport/theme/state combination. DOM tests, `clasp push`, Apps Script runtime, and ordinary browser interaction PASS cannot substitute.
