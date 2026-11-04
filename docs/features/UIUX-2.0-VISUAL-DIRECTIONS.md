# NUMLOCK UI/UX 2.0 Visual Direction System

## Package status and boundary

UI/UX 2.0 Package 003 is **discovery only**. It defines four implementation-feasible visual directions for the approved Executive-first [low-fidelity wireframes](UIUX-2.0-WIREFRAMES.md) and recommends candidates for a later, separately authorized high-fidelity mockup package. It does not authorize or implement production HTML, CSS, Tailwind, JavaScript, analytics, API, data, permission, persistence, schema, clasp, deployment, or release changes.

All directions preserve the [approved information architecture](UIUX-2.0-INFORMATION-ARCHITECTURE.md): Dashboard and Transactions are the only primary destinations; Executive Summary, one Business Priority, comparison, and KPIs precede analytics and supporting intelligence; Print remains on Dashboard; visible-row CSV remains on Transactions; transaction evidence remains capped by the current maximum-ten-row projection. No direction adds a feature or changes v1.0 behavior.

## Feasibility baseline

- Tailwind `3.4.17` is compiled locally from `190.View.Index.html` into the checked-in Apps Script HTML partial. No runtime Tailwind CDN or new build path is assumed.
- Chart.js is pinned to `4.5.1`; Font Awesome is pinned to `6.0.0`. A visual direction must not depend on a new chart, icon, component, animation, or font library.
- Current typography uses Inter when available with a sans-serif fallback. Directions may change weight, size, line height, case, and numeric treatment without assuming a new font download.
- Current styling already provides slate neutrals, indigo emphasis, emerald/amber/red statuses, responsive grids, an overlay drawer, visible focus, reduced motion, print rules, chart summaries, and a horizontally contained transaction table.
- High-fidelity mockups may propose token values, but implementation must later prove contrast, focus visibility, responsive fit, compiled-class coverage, Chart.js compatibility, print behavior, and no regression to existing accessibility/state contracts.

## Shared non-negotiable visual contract

Every direction uses the same approved content and interaction map:

1. Dashboard header, reporting controls, scope/freshness, and Data Quality.
2. Executive Summary with performance, attention, one Business Priority, and period comparison.
3. Financial, sales, product, and Business Health KPIs.
4. Revenue Trend, Product Distribution, Top Products, and Expense Breakdown.
5. Business Signals, Performance/Forecast, system-defined targets, recommended actions, planning, risk/opportunity, and product concentration.
6. Transactions header, visible-row CSV, optional bounded drill-down summary/reset, and the five-column table.
7. Loading, empty, error, exact-request Retry, chart-empty/unavailable, and transaction-empty states.

Color is always supplemental to text, icons, labels, values, and structure. Chart canvases remain supplementary to accessible summaries and labeled evidence actions. Mobile preserves desktop semantic order rather than creating a separate information architecture.

## Direction A — Executive Minimal

### Design principles

- Decision-first: give the Executive Summary and Business Priority the clearest visual authority.
- Restraint: use scale, whitespace, alignment, and typography before decoration.
- Calm confidence: reserve semantic color for genuine status and action meaning.
- Progressive disclosure: secondary evidence remains available without competing with the first viewport.

### Visual hierarchy

The page title and active period establish context, followed by one broad Executive Summary plane. Performance and attention are quiet supporting columns; Business Priority gains the strongest heading/value contrast, not the loudest background. Comparison forms a clean baseline beneath the summary. KPI groups are the second tier, analytics the third, and supporting intelligence the fourth.

### Color strategy

Warm-white and cool-slate surfaces form most of the canvas. NUMLOCK indigo identifies active navigation, focus, primary actions, and selected context. Emerald, amber, and red appear only for explicit good/attention/critical semantics. Decorative gradients are absent or nearly imperceptible. Status meaning always includes text.

### Typography strategy

Use the existing Inter/sans-serif stack. Large, compact page and priority headings use `700`; KPI values use tabular numerals where available and `700`; body text uses `400–500`; labels use `600` without excessive uppercase tracking. Limit the number of simultaneous sizes and avoid ornamental type.

### Spacing and density

Most spacious direction. Use a consistent 4/8-based rhythm with generous section gaps and card padding. Internal groups stay close enough to show relationships. On mobile, reduce padding and gaps proportionally rather than compressing type or controls.

### Card treatment

Use few large surface groups instead of a card around every datum. White or near-white panels have fine neutral borders, medium radii, and little or no shadow. Business Priority may use a subtle semantic edge or tinted inset, never a full saturated panel.

### Navigation treatment

Desktop navigation is a quiet dark or light rail with two text-first items and a restrained active indicator. Mobile uses the existing accessible overlay drawer pattern. Icons are optional support; labels remain authoritative.

### KPI treatment

Four clearly labeled groups emphasize values, units, and short context. Evidence actions are secondary text buttons. Status uses a compact text badge plus value treatment; oversized icons do not compete with numbers.

### Chart treatment

Charts use minimal gridlines, restrained series colors, direct titles, concise summaries, and consistent plot heights. Revenue Trend remains the dominant chart. Empty/unavailable states occupy the same plot region and keep the summary visible.

### Table treatment

Transactions uses a clean white plane, quiet header fill, strong column labels, generous row height, and subtle separators. Currency and quantities align for scanning; the five existing columns remain unchanged.

### States and alerts

Loading skeletons are low contrast and motionless under reduced motion. Empty and error states use plain-language headings, concise explanation, and one clear next action. Alerts use a semantic border/icon/text trio rather than saturated fills.

### Desktop behavior

The Executive Summary spans the content width; three internal columns and the comparison baseline fit above KPI groups where viewport height permits. Wider analytics grids begin below the executive/KPI sequence. Persistent navigation remains visually quiet.

### Mobile behavior

One-column flow retains performance, attention, Business Priority, comparison, then KPI groups. The priority remains early even if KPIs begin below the physical fold. Full-width controls, bounded charts, and the existing table overflow container are retained.

### Accessibility implications

Strong reading hierarchy and low noise support comprehension. The restrained palette requires deliberate contrast checks for muted labels and subtle borders. Focus must remain a high-contrast, non-color-only ring. Whitespace must not separate labels from their values or produce excessive swipe distance without section landmarks.

### Implementation complexity

**Low.** Primarily token, utility-class, hierarchy, and grouping changes within existing layout capabilities. No new dependency or interaction model is needed.

### Regression risk

**Low.** Main risks are print spacing, first-viewport height, and muted-text contrast. Existing responsive, state, and chart structures can remain intact.

### Strengths

- Best executive scanning and calm decision focus.
- Strong mobile readability and accessibility potential.
- Lowest implementation and maintenance burden.
- Preserves NUMLOCK's current indigo/slate identity while making it more disciplined.

### Weaknesses

- Can feel conservative if typography and alignment are not executed precisely.
- Lower visual distinctiveness than more expressive directions.
- Generous spacing can lengthen secondary-content pages.

### Best-fit user context

Owners or managers who check business health periodically, need a trusted next action quickly, and then inspect evidence only when required.

## Direction B — Modern Financial

### Design principles

- Precision: align values, units, deltas, and comparisons consistently.
- Structured polish: use a deliberate surface system and crisp component boundaries.
- Evidence confidence: make financial magnitude and period comparison easy to verify.
- NUMLOCK character: retain the product name, indigo anchor, coffee-shop context, and plain-language decisions without imitating a named product.

### Visual hierarchy

Executive Summary remains first, but its subregions use a more structured grid. Business Priority and period comparison share a strong visual axis. KPI groups behave like a coordinated financial instrument panel. Revenue Trend anchors analytics, with product and expense evidence aligned to its grid.

### Color strategy

Use deep navy/slate for navigation and primary text, clean white/blue-gray surfaces, and a more precise indigo/cobalt accent. Emerald, amber, and red remain semantic. Very light tinted surfaces distinguish selected context, comparison, and priority without making neutral data look positive or negative.

### Typography strategy

Use the existing Inter/sans-serif stack with tighter heading tracking and strong numeric hierarchy. KPI and comparison values use tabular numerals where supported. Labels are concise and medium weight; currency prefixes, units, and secondary dates use a smaller but contrast-compliant tier.

### Spacing and density

Moderate density. A consistent 4/8 scale supports precise alignment, with slightly smaller card padding than Direction A. Section gaps remain generous enough to preserve Executive-first scanning.

### Card treatment

Structured cards use fine cool borders, small-to-medium radii, clear header/content zones, and one restrained shadow level for elevated summary/analytics panels. Nested cards are avoided; inset comparison rows use surface contrast instead.

### Navigation treatment

A deep navy rail with a crisp indigo active marker and high-contrast text. Version remains quiet metadata. The mobile drawer matches the rail; it does not become bottom navigation or add shortcuts.

### KPI treatment

Values dominate, supported by explicit labels, units, and bounded evidence actions. Financial KPIs receive consistent right/decimal alignment where practical. Business Health uses score plus status text; color remains supplemental. Product labels are allowed more width than numeric measures.

### Chart treatment

Use precise axes, restrained gridlines, clear comparison/context labels, and stable series semantics. Revenue Trend receives the largest plot; Expense and Product Distribution use distinct but harmonized palettes. Accessible summaries and explicit View transactions actions remain visible.

### Table treatment

Use a compact financial-table rhythm with a high-contrast header, tabular Qty/Amount alignment, subtle row hover/focus support, and clear separators. No zebra striping unless contrast testing shows it improves scanning. All five current columns remain visible through contained overflow.

### States and alerts

States appear as structured status panels aligned to the page grid. Error and critical conditions use red icon/text/border; attention uses amber; success/current uses emerald; neutral loading/no-data uses slate. Retry remains the only recovery action in the Dashboard error surface.

### Desktop behavior

Tighter grid alignment produces a polished financial-product feel without changing content order. Summary, comparison, KPI, and chart edges align across sections. Persistent navigation and header actions use the same precise control heights.

### Mobile behavior

Cards stack in semantic order; paired comparison values may use two columns only when they remain legible. Currency values wrap safely rather than shrink. Navigation remains an overlay drawer, and the transaction table stays a semantic table inside its labeled overflow region.

### Accessibility implications

Precise alignment improves scanability, but smaller secondary text and denser tables require contrast and zoom testing. Numeric color cues need explicit direction/status text. Fine borders cannot be the only group boundary. Focus indicators must remain distinct against navy, white, and tinted surfaces.

### Implementation complexity

**Medium-low.** Achievable with current Tailwind, Chart.js, and authored CSS; tabular numerals, refined chart options, and systematic alignment require careful implementation and browser QA but no new dependency.

### Regression risk

**Low-medium.** Risks concentrate in long Indonesian-formatted currency values, narrow-width comparison layouts, chart-label fit, print parity, and contrast of secondary metadata.

### Strengths

- Strong financial credibility and precise data emphasis.
- Clear visual system across KPIs, charts, and Transactions.
- Distinctive enough for high-fidelity comparison while remaining feasible.
- Good balance between executive clarity and daily evidence inspection.

### Weaknesses

- Can become generic or overly corporate without NUMLOCK-specific voice.
- Precision may drift into excessive card boundaries.
- Requires more alignment and responsive testing than Direction A.

### Best-fit user context

Managers who routinely compare financial performance, validate changes through charts and recent rows, and expect a polished decision-support interface.

## Direction C — Analytical Workspace

### Design principles

- Evidence density: expose comparisons and analytical relationships efficiently.
- Stable grid: let repeated alignment support scanning across measures.
- Chart hierarchy: make trend and composition evidence visually dominant after the required Executive-first sequence.
- Expert control without new controls: density comes from presentation, not unsupported filtering or analysis features.

### Visual hierarchy

Executive Summary remains first by contract, but is compact. Comparison receives prominent structured rows. KPI groups and Revenue Trend form a dense analytical band immediately afterward. Secondary charts and supporting intelligence use a modular grid with more simultaneous information.

### Color strategy

Use cool neutral surfaces and a broader but controlled chart palette derived from indigo, cyan, emerald, amber, and rose. Semantic status colors remain reserved for status; analytical series colors must not accidentally imply good/bad. Borders and background levels carry more grouping responsibility.

### Typography strategy

Use the existing stack with smaller section headings, compact labels, tabular values, and stronger weight contrast. Avoid all-caps paragraphs. Dense metadata remains at a readable minimum size and must survive browser zoom.

### Spacing and density

Highest analytical density after Direction D's monitoring strip. Use a tighter 4-point rhythm, smaller gaps, and compact internal padding. Section separation relies on headings and surface changes rather than large whitespace.

### Card treatment

Modular panels use smaller radii, thin borders, minimal shadow, and visible grid alignment. Cards may share a parent surface to reduce visual fragmentation. Nested boxes are minimized despite the denser composition.

### Navigation treatment

Compact persistent rail with two destinations and an unambiguous active state. Navigation does not gain section shortcuts, filters, or workspaces. Mobile retains the same overlay drawer.

### KPI treatment

KPI groups use compact rows or mini-grids, with values, units, and evidence actions aligned. Period comparison is visually linked to KPI evidence without duplicating values or messages. Product text receives truncation-safe wrapping rather than tooltip-only disclosure.

### Chart treatment

Revenue Trend is the primary analytical surface, with stronger axis/plot hierarchy. Product Distribution, Top Products, and Expense Breakdown form a coordinated secondary grid. Summaries remain visible and chart actions labeled. No new zoom, brush, legend filtering, or cross-filter feature is implied.

### Table treatment

Compact row heights and strong column alignment maximize visible evidence. Sticky headers may be explored only as presentation of the current table, not as a new data behavior. The current five columns and maximum-ten-row boundary remain explicit.

### States and alerts

States occupy the affected analytical region while retaining page context. Chart-specific empty/unavailable messages stay local and never redefine Dashboard emptiness. Error/Retry remains a distinct Dashboard state surface.

### Desktop behavior

Uses the widest analytical grid and most simultaneous content after the Executive-first block. The layout should target common laptop widths as well as wide screens; it must not assume an ultrawide display.

### Mobile behavior

The workspace collapses to the same one-column semantic order. Dense desktop mini-grids become stacked blocks or safe two-column comparisons. Chart labels and summaries cannot be removed to save space. Long scrolling is expected but must be segmented by clear headings.

### Accessibility implications

Stable alignment can aid expert scanning, but density raises risks for cognitive load, touch-target size, text size, focus visibility, and chart color differentiation. High-fidelity work would require early 200% zoom, reflow, keyboard, contrast, and screen-reader order testing.

### Implementation complexity

**Medium-high.** The current stack can support it, but coordinated grids, compact responsive fallbacks, chart-label tuning, and density-safe accessibility need more CSS/Tailwind and browser QA.

### Regression risk

**Medium-high.** Narrow-width wrapping, zoom/reflow, chart containment, label truncation, DOM-query stability if markup changes, print layout, and accessible reading order are material risks.

### Strengths

- Strong comparison and chart hierarchy for frequent analysis.
- Efficient use of desktop space.
- Clear differentiation from the current spacious card dashboard.

### Weaknesses

- Weaker executive calm and mobile simplicity.
- Higher cognitive and implementation load.
- Greater temptation to imply analytical controls that v1.0 does not provide.

### Best-fit user context

Frequent analysts or operators who already understand the metrics and spend longer sessions comparing evidence across KPIs and charts.

## Direction D — Operational Cockpit

### Design principles

- Rapid monitoring: surface health, warning, and action signals at a glance.
- Exception-first emphasis within the approved Executive-first structure.
- Compact repeatability: use consistent status modules for daily checking.
- Action traceability: keep every warning linked to truthful evidence or an existing action.

### Visual hierarchy

The Executive Summary becomes a compact command band: performance, attention, and Business Priority remain in semantic order, with status text and evidence highly visible. Comparison and KPIs form a monitoring strip below it. Analytics and supporting sections follow as investigation layers.

### Color strategy

Use dark slate/navy chrome with light working surfaces. Semantic emerald, amber, and red are more visible than in other directions but remain bounded to actual statuses and warnings. Indigo identifies navigation, focus, and neutral actions. No decorative red/amber or permanently alarming background wash.

### Typography strategy

Use the existing stack with bold compact values, short labels, and strong status language. Headings are smaller than Direction A; priority/action text receives weight and spacing rather than oversized type. Numeric alignment remains consistent.

### Spacing and density

Compact. A 4-point rhythm and reduced vertical gaps support daily monitoring. Touch targets and readable line heights remain non-negotiable, especially on mobile. Density cannot hide explanations or evidence bounds.

### Card treatment

Compact modules use small radii, clear borders, and semantic edge indicators. Shadows are minimal. Business Priority is the primary action module; warning modules cannot visually outrank it unless they are the evidence that selected that priority.

### Navigation treatment

A compact dark rail with two clear destinations and strong active labeling. No status counters, alert center, or notification destination is added. Mobile uses the same two-item drawer.

### KPI treatment

KPIs appear as a compact health strip or grid with value, label, and text status. Evidence actions remain explicit. The design must avoid implying real-time telemetry; freshness and active reporting period remain visible nearby.

### Chart treatment

Charts are investigation surfaces after the monitoring strip. Revenue Trend remains widest; concise summaries highlight what the current data says without adding alerts or thresholds. Existing chart-empty/unavailable behavior stays local.

### Table treatment

Transactions is compact and operational, with strong type/category scanning and aligned quantities/amounts. The drill-down label and ten-row limit remain conspicuous so the table is not mistaken for a live ledger.

### States and alerts

This direction gives states the most prominent treatment: concise status title, affected scope, text severity, and available action. Loading never resembles a warning. Error uses Retry; empty retains period controls; Data Quality remains observational and does not imply repair.

### Desktop behavior

Summary, comparison, and KPI modules fit more tightly in the first viewport. Wider screens show more monitoring signals simultaneously, but secondary analytics remain below the approved executive sequence.

### Mobile behavior

The command band becomes a vertical status stack: performance, attention, Business Priority, comparison, KPIs. Semantic color areas shrink to edges/badges to avoid a wall of alerts. Controls and actions stay full-sized; the table remains contained.

### Accessibility implications

Textual severity and action labels support non-color understanding, but the heavier status palette raises contrast, sensory overload, and color-confusion risks. Compact modules must preserve touch targets, zoom/reflow, focus rings, and adequate separation. Live regions must not turn monitoring visuals into repeated announcements.

### Implementation complexity

**Medium-high.** Achievable with the current stack, but the compact first viewport, semantic styling, responsive reflow, and prevention of false urgency require extensive visual and accessibility QA.

### Regression risk

**Medium-high.** Risks include overemphasis of normal states, status-color misuse, cramped mobile layouts, priority duplication, print noise, and accidental implication of real-time monitoring.

### Strengths

- Fastest daily exception and action scanning.
- Strong visual distinctiveness.
- Makes freshness, health, and warnings difficult to miss.

### Weaknesses

- Can feel stressful or falsely real-time for period-scoped data.
- Higher risk of visual noise and status competition.
- Less suitable for reflective executive review and print.

### Best-fit user context

Hands-on operators who check the dashboard frequently for current-period exceptions and move quickly from a signal to bounded transaction evidence.

## Weighted decision matrix

Scores use a `1`–`5` scale: `1` is poor, `3` is adequate with material tradeoffs, and `5` is excellent. Weighted result is `sum(weight × score) / 100`, producing a score out of `5.00`. Weights prioritize the approved executive-first purpose and daily/mobile accessibility while still rewarding feasible, maintainable distinction.

| Criterion | Weight | A. Executive Minimal | B. Modern Financial | C. Analytical Workspace | D. Operational Cockpit |
| --- | ---: | ---: | ---: | ---: | ---: |
| Executive clarity | 25% | 5 | 4 | 3 | 4 |
| Daily usability | 20% | 4 | 5 | 4 | 5 |
| Mobile usability | 15% | 5 | 4 | 3 | 4 |
| Accessibility | 15% | 5 | 4 | 4 | 4 |
| Implementation feasibility | 10% | 5 | 4 | 3 | 3 |
| Maintainability | 10% | 5 | 4 | 3 | 3 |
| Visual distinctiveness | 5% | 3 | 5 | 4 | 5 |
| **Weighted result / 5.00** | **100%** | **4.70** | **4.25** | **3.40** | **4.05** |
| **Rank** |  | **1** | **2** | **4** | **3** |

The matrix selects **A. Executive Minimal** as primary and **B. Modern Financial** as alternate. Direction D scores strongly for daily monitoring but carries greater truthfulness and sensory-load risk. Direction C is feasible but least aligned with the approved executive-first and mobile priorities.

## Recommendation

### Primary direction — A. Executive Minimal

Advance Executive Minimal because it gives the approved Executive-first wireframe the clearest hierarchy, strongest mobile/accessibility outlook, and lowest implementation and maintenance risk. It preserves NUMLOCK's trusted decision-support character without relying on visual novelty or unsupported interaction.

### Alternate direction — B. Modern Financial

Advance Modern Financial as the alternate because it tests a meaningfully more polished and data-precise expression while preserving the same capabilities, hierarchy, and stack. It provides the best high-fidelity comparison against Executive Minimal without inheriting the density and alert risks of Directions C and D.

### Controlled hybrid

A controlled hybrid is justified **only as a bounded refinement of the primary direction**: use Executive Minimal's whitespace, low-noise surface hierarchy, restrained status color, and decision-first composition with Modern Financial's tabular numeric treatment, alignment discipline, crisp table, and chart-axis precision. Do not import Analytical Workspace density or Operational Cockpit alert saturation. The hybrid must remain a third mockup candidate, not a fifth visual direction or a license to combine every preferred detail.

## Preliminary token system — shortlisted Direction A

These are mockup inputs, not production tokens.

| Token family | Preliminary system |
| --- | --- |
| Surface hierarchy | Canvas `#F8FAFC`; primary `#FFFFFF`; secondary `#F1F5F9`; selected/info tint `#EEF2FF`; priority tint `#FFFBEB`; dark navigation `#0F172A` |
| Text hierarchy | Primary `#0F172A`; secondary `#334155`; muted `#64748B`; inverse `#F8FAFC`; links/actions `#4338CA` |
| Semantic statuses | Good: emerald text `#047857` + tint `#ECFDF5`; Attention: amber text `#B45309` + tint `#FFFBEB`; Critical/error: red text `#B91C1C` + tint `#FEF2F2`; Neutral/no data: slate text `#475569` + tint `#F1F5F9`; always pair with text/icon |
| Border radius | Control `10px`; compact surface `12px`; standard card `16px`; primary summary `20px`; pills only for short status labels |
| Spacing scale | `4, 8, 12, 16, 24, 32, 48, 64px`; mobile card padding `16–20px`; desktop card padding `24–32px` |
| Shadow use | Default none; subtle elevation `0 1px 2px rgb(15 23 42 / 0.06)` only for primary floating surfaces/drawer; borders carry most grouping |
| Typography scale | Caption `12/16`; body small `14/20`; body `16/24`; section `20/28`; subsection/priority `24/32`; page `36/40` desktop and `30/36` mobile; KPI `28–40/1.1`; weights `400, 500, 600, 700` |

Accessibility gates for these tokens: normal/large text contrast, non-text boundary/focus contrast, 200% zoom, 320 CSS-pixel reflow, non-color status, and visible focus across canvas, primary, tinted, and dark navigation surfaces.

## Preliminary token system — shortlisted Direction B

These are mockup inputs, not production tokens.

| Token family | Preliminary system |
| --- | --- |
| Surface hierarchy | Canvas `#F1F5F9`; primary `#FFFFFF`; secondary `#F8FAFC`; structured tint `#EFF6FF`; selected tint `#EEF2FF`; dark navigation `#111827` |
| Text hierarchy | Primary `#111827`; secondary `#374151`; muted `#64748B`; inverse `#FFFFFF`; links/actions `#3730A3` |
| Semantic statuses | Good: emerald text `#047857` + tint `#ECFDF5`; Attention: amber text `#92400E` + tint `#FFFBEB`; Critical/error: red text `#B91C1C` + tint `#FEF2F2`; Neutral/no data: slate text `#475569` + tint `#F1F5F9`; analytical series colors remain distinct from status meaning |
| Border radius | Control `8px`; compact surface `10px`; standard card `12px`; primary summary `16px`; status pill `999px` only where text remains visible |
| Spacing scale | `4, 8, 12, 16, 20, 24, 32, 48px`; mobile padding `16px`; desktop card padding `20–24px` |
| Shadow use | Fine border by default; one low elevation `0 2px 8px rgb(15 23 42 / 0.07)` for summary/chart surfaces; no stacked shadow tiers |
| Typography scale | Caption `12/16`; metadata `13/18`; body small `14/20`; body `16/24`; section `20/28`; priority `24/30`; page `34/40` desktop and `30/36` mobile; KPI `30–42/1.05`; weights `400, 500, 600, 700`; tabular numerals for values/tables |

Accessibility gates additionally emphasize long `id-ID` currency fit, dense metadata at zoom, table scanning, chart-series differentiation, and focus contrast on dark navigation and light structured surfaces.

## High-fidelity mockup candidates

Produce exactly three candidates in a separately authorized package, each covering the already approved four screens and required states:

1. **Candidate 1 — Executive Minimal:** Dashboard desktop/mobile and Transactions desktop/mobile, plus loading, empty, error/Retry, chart unavailable, and active drill-down examples.
2. **Candidate 2 — Modern Financial:** the same screens, content, sample-state coverage, and viewport assumptions so visual direction—not feature scope—can be compared.
3. **Candidate 3 — Controlled hybrid:** Executive Minimal structure/tone with only Modern Financial numeric alignment, table precision, and chart-axis discipline.

Do not produce high-fidelity candidates for Analytical Workspace or Operational Cockpit in the next package. Keep content labels, data scope, state meaning, navigation, actions, accessibility annotations, and representative viewport sizes identical across the three candidates. Use clearly synthetic layout-safe values or anonymized structural placeholders in mockups; do not fabricate or imply production business results.

## Deferred beyond Package 003

- High-fidelity artifacts, component specifications, finalized tokens, responsive measurements, visual assets, usability testing, production implementation, and browser acceptance.
- Dark mode, theme switching, new fonts, new dependencies, new charts, new destinations, saved views, notifications, search, sorting, pagination, settings, editable targets, broader transactions, or real-time monitoring.
- Any change to the current response, calculations, statuses, recommendation precedence, Print/CSV scope, Apps Script services, spreadsheet ownership, deployment, or release metadata.
