# NUMLOCK UI/UX 2.0 Component Library and Theme Contract

## Package status and authority

UI/UX 2.0 Package 004 is an **implementation-ready design contract**. It defines the component, theme, layout, navigation, state, and accessibility rules for later bounded implementation packages. It does not itself change production HTML, Tailwind, browser behavior, Apps Script, analytics, APIs, spreadsheet data, persistence, permissions, schemas, deployment, or release metadata.

This package adopts the approved hybrid direction: Executive Minimal structure and restraint with Modern Financial numeric, table, and chart precision. It supersedes Package 001 only where later product decisions now approve `Settings` and `Logs` as primary destinations and approve tab-driven Dashboard and Transactions content. Earlier discovery documents remain historical records.

Current v1.0 behavior remains authoritative until an implementation package is separately approved. No component may invent data, broaden the maximum-ten-row transaction projection, expose source information, or imply persistence that does not exist.

## Product-wide rules

- Desktop Dashboard fits one supported viewport without document scrolling. Tabs expose secondary information in the KPI/content region.
- Mobile may scroll vertically. Desktop destinations other than Dashboard may use one explicit content scroller when their content requires it.
- Dashboard, Transactions, Settings, and Logs are the approved primary destinations.
- Products, Capital & Equity, Assets, Depreciation, and Financial Statements are future modules. The shell reserves a grouping pattern for them but does not render links or empty pages before usable content exists.
- Source information is never displayed. Quiet utility metadata may show only Last Sync, Current Period, and Version when applicable.
- Do not add global search, notifications, avatar/profile menus, greetings, widget customization, drag-and-drop, marketing cards, floating decoration, upgrade prompts, or unsupported statistics.
- Color is primarily semantic. Text, icons, position, and labels carry meaning independently of color.
- Use the existing Inter/sans-serif stack, pinned Font Awesome and Chart.js dependencies, and locally compiled Tailwind implementation path. This contract adds no dependency.

## 1. Application shell

### Anatomy

1. `Skip link` — first focusable control; targets the active destination heading or active tab panel.
2. `Sidebar` — product identity, primary navigation, optional future-module group when real modules exist, quiet Version metadata, and desktop collapse control.
3. `Mobile top bar` — menu button, compact NUMLOCK identity, and optional page-level primary action; absent on desktop.
4. `Top utility bar` — destination heading, concise context, page actions, and quiet metadata. It is not a global-command bar.
5. `Destination tab bar` — directly above the active KPI/content region on Dashboard and Transactions.
6. `Content region` — one active tab panel or destination surface.
7. `Status layer` — bounded inline states and toasts; no floating decorative controls.

### Expanded sidebar

- Width: `240px` at desktop reference widths.
- Shows the NUMLOCK wordmark, item icons, labels, and a trailing collapse control.
- Primary order: Dashboard, Transactions, Settings, Logs.
- Product identity is not a link unless a future approved home behavior exists.
- Version appears at the bottom in caption styling. Environment belongs in Settings > About, not persistent navigation.

### Collapsed sidebar

- Width: `72px`.
- Shows the product mark, four 20px navigation icons, and expand control.
- Every icon-only item has an accessible name and a hover/focus tooltip. The tooltip duplicates the accessible name and never carries unique information.
- Collapse preserves the active destination and does not move content focus.
- Desktop preference persistence is deferred until a browser-storage contract is approved; initial implementation may keep collapse state for the session only.

### Desktop shell

- The shell uses `height: 100dvh` with `100vh` fallback and `overflow: hidden` on the shell, not on the document globally.
- Sidebar is fixed within the shell. Main uses a two-row grid: utility/header row and bounded content row.
- Dashboard content must not create document or main-region vertical scrolling at supported desktop dimensions.
- Each destination has one `main` landmark and one page-level `h1`; tab panels begin with `h2` or an accessible label.

### Mobile drawer

- Below `1024px`, the sidebar becomes an overlay drawer with a backdrop and remains semantically the same navigation.
- The Menu button exposes `aria-expanded` and `aria-controls`. Opening moves focus to the first meaningful drawer control; closing by button, Escape, backdrop, or completed navigation restores focus to the opener unless focus intentionally moves to the destination heading.
- Closed drawer content is `hidden` or `inert` and excluded from keyboard and accessibility traversal. Body scroll locks only while the drawer is open.
- Drawer width: `min(320px, calc(100vw - 32px))`.
- Reduced motion removes translation animation while preserving immediate state changes.

### Utility bar

- Desktop height: `64px`; mobile minimum height: `56px` and may wrap naturally.
- Left: destination title and at most one line of context.
- Right: page-owned actions, then quiet metadata. Print belongs to Dashboard; CSV belongs to Transactions.
- Last Sync, Current Period, and Version use caption styling and cannot compete with the title, date filter, state, or Business Priority.
- Source names, spreadsheet identity, raw row references, and payload details are prohibited.

### Overflow ownership

| Region | Desktop overflow | Mobile overflow |
| --- | --- | --- |
| Dashboard shell/main | None at supported dimensions | Document vertical scroll allowed |
| Dashboard tab panel | No scroll in Overview; one internal panel scroller allowed in other tabs only when specified | Natural document flow |
| Transactions table | Horizontal table scroller; vertical panel scroller when needed | Horizontal table scroller plus document flow |
| Settings and Logs | One main content scroller | Natural document flow |
| Sidebar | Vertical only if navigation exceeds available height | Drawer vertical only |
| Dialog/side panel | Internal body scroll; header/footer fixed within component | Same |

Nested vertical scrollers are prohibited. A scrollbar must correspond to a named region and must remain keyboard reachable.

## 2. Navigation contract

### Primary destinations

| Destination | Availability | First content | Owned actions |
| --- | --- | --- | --- |
| Dashboard | Available | Overview tab with Executive Summary, Business Priority, comparison, and KPIs | Date filter, Print Report, evidence drill-down |
| Transactions | Available | Recent tab with bounded current-response rows | Export visible CSV, clear drill-down |
| Settings | Approved for v2 implementation | Appearance and About only | Theme selection |
| Logs | Approved for v2 implementation | Sanitized session-local client events | Clear current session only if explicitly included in its implementation package |

### Item states

- **Default:** neutral icon and label on transparent background.
- **Hover:** neutral hover surface; no position shift.
- **Focus:** 2px focus ring with 2px offset, visible against both sidebar and canvas.
- **Active:** `aria-current="page"`, selected surface, stronger label, and a 3px leading indicator. Color is supplemental.
- **Disabled:** present only when a control is relevant but temporarily inoperable; use native `disabled` where supported, muted presentation, and no tooltip-only explanation.
- **Unavailable:** future modules are omitted from navigation. Within an approved tab, a truthful unavailable item uses text such as `Unavailable until migrated data is approved` and is not focusable unless it opens an explanation.

### Future-module grouping

When at least one future module has approved, populated content, add a `Financial modules` group after Transactions and before Settings. Only implemented modules appear. Products, Capital & Equity, Assets, Depreciation, and Financial Statements must never be shown merely to balance the sidebar. Group collapse may be added only when three or more usable modules exist and must use a real disclosure button.

### Mobile navigation

- Same four destinations, labels, order, and current-page semantics as desktop.
- Selecting a destination closes the drawer and moves focus to the destination heading.
- No bottom-navigation duplicate, mobile-only shortcuts, or destination reordering.

## 3. Dashboard tabs

The approved set is `Overview`, `Performance`, `Analytics`, `Intelligence`, and `Planning`, in that order. Overview is the default. The active reporting period scopes every row-derived tab. Changing tabs does not request data, reset the filter, duplicate the executive conclusion, or mutate the response.

| Tab | Included v1.0 sections | First-visible content | Density and layout | Empty/error and scrolling |
| --- | --- | --- | --- | --- |
| Overview | Executive performance, attention status, one Business Priority, period comparison, Financial/Sales/Product/Health KPIs, compact Data Quality indicator | Executive Summary and Business Priority | Maximum 12 primary facts: 3 executive facts, 4 comparison facts, and 4 KPI groups plus Data Quality status; summary band over four-card KPI row | Dashboard loading/empty/error replaces the panel. No internal vertical scroll. |
| Performance | Revenue/expense/profit/forecast facts, Target Reference disclosure, Revenue Trend | Performance comparison and Revenue Trend | Two-column 5:7 grid; at most four fact cards and one primary chart visible | Dashboard-level states apply. One internal panel scroller allowed below the fixed tab header if minimum-height fallback is active. |
| Analytics | Product Distribution, Top Products, Expense Breakdown, Revenue Dependency, Pareto Analysis | Revenue/product evidence | Two-by-two analytical grid; maximum three plotted series per Cartesian chart, eight categories per chart, and one ranking list | Chart empty/unavailable stays local and never redefines Dashboard empty. One panel scroller allowed only on insufficient-height fallback. |
| Intelligence | Business Signals, Recommended Actions, Risk Status, Growth Opportunity | Highest-priority signal and action | Three-column signal/action/risk layout; no more than three actions initially visible before disclosure | Dashboard errors replace the panel; local empty copy says no signal/action for the active period. One panel scroller allowed. |
| Planning | Business Focus, KPI Achievement, Business Maturity, 30-day Action Roadmap | Business Focus and KPI Achievement | Two-column cards with full-width roadmap; maximum four roadmap phases visible | Dashboard errors replace the panel; truthful unavailable fields remain absent. One panel scroller allowed. |

### Tab semantics and keyboard

- Use a container with `role="tablist"` and an accessible label such as `Dashboard sections`.
- Tabs use `role="tab"`, unique IDs, `aria-controls`, and roving `tabindex`. The selected tab alone has `tabindex="0"` and `aria-selected="true"`.
- `ArrowLeft`/`ArrowRight` move and activate the adjacent tab; `Home`/`End` activate first/last. Orientation is horizontal. Tab wraps from last to first and first to last.
- Panels use `role="tabpanel"`, `aria-labelledby`, and `tabindex="0"` only when the panel lacks an immediately focusable first element.
- Inactive panels are hidden and excluded from focus/accessibility traversal. Tab changes do not create routine live-region announcements; selected semantics provide the state.
- On tab activation, focus remains on the tab. Direct navigation to a tab may focus its heading only when explicitly initiated by a cross-tab action.

## 4. Transactions tabs

The approved set is `Recent`, `Sales`, `Expenses`, and `Purchases`.

| Tab | Initial implementation status | Truthful scope |
| --- | --- | --- |
| Recent | Implementable now | Existing active-period, maximum-ten-row `recentTransactions` projection, including drill-down and clear/reset behavior |
| Sales | Implementable only as a client-filtered view of loaded Recent rows | Shows Sales rows already present in the bounded projection; label the evidence bound and do not imply full history |
| Expenses | Requires future migrated/approved data | Unavailable until expense-row definition, authorization, fields, and pagination/data bounds are approved |
| Purchases | Implementable only as a client-filtered view of loaded Recent rows if the current `Purchase` type remains the approved meaning | Shows Purchase rows already present in the bounded projection; never fabricate supplier, invoice, or purchase detail |

Unavailable tabs may remain visible only when product acceptance requires communicating the approved taxonomy. They use `aria-disabled="true"`, are skipped by roving keyboard navigation, cannot be activated, and show adjacent persistent helper text explaining the migration boundary. They must not open empty panels. If that explanation is not necessary in the first implementation, omit unavailable tabs entirely.

Transactions tab semantics match Dashboard. The visible table, row count, drill-down summary, and CSV projection always derive from a copied client array; tab selection must not mutate the response. Export CSV is enabled only for visible rows and exports the active visible projection.

## 5. Core component specifications

All sizes are minimums. Compact density never reduces an interactive target below `40px` desktop or `44px` touch.

| Component | Variants and anatomy | States and responsive behavior | Accessibility and usage rule |
| --- | --- | --- | --- |
| Sidebar item | Labelled, icon-only collapsed; icon, label, optional indicator | Default/hover/focus/active/disabled; full width in drawer | Use links or navigation buttons consistently; active has `aria-current`; icon is decorative when label exists |
| Tab bar | Destination-specific; scrollable-on-mobile rail, tabs, optional end action outside `tablist` | Selected, hover, focus, disabled/unavailable; horizontal overflow on mobile | WAI-ARIA tab pattern; no dropdown replacement that hides peer choices |
| Page header | Title, description/context, action group | Single row desktop, stacked mobile | One `h1`; page actions remain with their source destination |
| Utility metadata | Inline or compact stack: label/value | Quiet/default, stale warning | Use semantic text; never show source identifiers |
| Date filter | Label, select, conditional start/end inputs, validation | Default/focus/invalid/disabled/loading; wraps on narrow widths | Associated labels, `aria-describedby`, bounded polite validation, exact-request semantics |
| KPI card | Eyebrow, value/unit, context, optional evidence action | Neutral/success/warning/critical/unavailable/loading | `h3` or labelled group; semantic status text; never color-only |
| KPI delta | Direction icon, signed value, comparison label | Up/down/stable/no comparison | Direction words remain in accessible text; profit movement retains signed meaning |
| Metric sparkline | Tiny supporting line, start/end labels, text summary | Positive/negative/neutral/empty | Decorative canvas/SVG is hidden when a complete text summary exists; never sole evidence |
| Executive-summary card | Performance, attention, Business Priority, comparison | Loading/success/empty/error | First in Overview; one priority only; avoid repeating its message in KPIs |
| Business Priority card | Level, title, reason, action, evidence/meta | Attention/critical/positive/neutral | Single authoritative instance; heading and action language; color supplemental |
| Comparison card | Metric label, current, previous, delta/direction | Up/down/stable/no comparison | Tabular numerals and explicit period labels; no ambiguous arrows alone |
| Chart container | Header, toolbar, plot, fallback, summary | Loading/ready/zero/unavailable/error/selected | Plot canvas supplementary; visible accessible summary and labelled evidence action retained |
| Chart toolbar | Labelled action group, period context, optional reset | Default/disabled/active | No unsupported zoom/filter controls; target size minimum applies |
| Chart legend | Series marker and label, optional value | Static in first implementation | Do not rely on marker color; use line/dash/shape plus label |
| Chart summary | Plain-language trend, extrema, scope, evidence action | Ready/empty/unavailable | Visible text, not screen-reader-only; concise and data-grounded |
| Data-quality indicator | Status icon/text, issue count, disclosure control | Good/Attention/Critical/loading | Observational only; no repair action or raw row/source information |
| Recommendation/action item | Priority, title, reason, action text, optional disclosure | Default/completed only if real state exists/unavailable | Ordered list semantics; no fake completion, owner, or due date |
| Timeline item | Step marker, timeframe label, action, rationale | Current/future/complete only when response supports it | Ordered list; text conveys phase without color |
| Table | Caption, header, body, row empty state | Default/hover/focus/empty/loading | Native table, scoped headers, labelled overflow region; numeric cells align end visually |
| Table toolbar | Result/scope summary, clear, export | Default/drill-down/empty/disabled | Precedes table; export describes visible scope; no fake search/sort |
| Pagination | Previous, page summary, Next | First/middle/last/loading | Not required for current maximum-ten projection; add only with approved server/data contract |
| Disclosure | Button, concise summary, controlled content | Collapsed/expanded/disabled | Real button with synchronized `aria-expanded`/`aria-controls`; hidden content not focusable |
| Badge | Neutral/info/success/warning/critical | Static; one-line | Short text plus optional icon; not interactive unless rendered as a button |
| Button | Primary/secondary/quiet/destructive | Hover/focus/pressed/loading/disabled | Native button; visible focus; loading preserves label context and blocks duplicate action |
| Icon button | Menu/close/collapse/print-only when label cannot fit | Same button states | Accessible name required; tooltip on hover/focus; 40/44px target minimum |
| Input/select/date input | Standard/compact; label, control, help/error | Default/focus/invalid/disabled/read-only | Visible label preferred; error association and native semantics retained |
| Loading | Region skeleton, inline spinner, button loading | Active only | `aria-busy` on affected region; one bounded status announcement; reduced motion disables shimmer |
| Empty | Icon optional, heading, explanation, relevant next action | Dashboard empty or local empty | Dashboard empty only when scoped row count is zero; chart/table empty remains local |
| Error | Heading, sanitized message, Retry | Request/render/local component | Exact-request Retry, duplicate blocking, focus management only when necessary |
| Retry | Secondary or primary recovery button | Ready/loading/disabled | Reuses exact last filter/custom dates and ignores stale callbacks |
| Stale-data state | Warning badge, last sync, explanation, refresh/retry if supported | Informational/warning | Never silently substitute old data; current v1 lacks persisted cache, so implement only with real stale evidence |
| Toast/inline alert | Toast for brief action outcome; inline for persistent context | Info/success/warning/error | Toast region polite except urgent destructive failure; deduplicate; no raw payloads |
| Modal/side panel | Header/title, body, close, optional footer | Open/closing/error | Not required by current v1 interactions. Prefer inline disclosures; add only for a justified future detail/edit workflow with focus trap and restoration |

### Component usage boundaries

- Do not create a card for every label. Use shared surfaces to show related facts.
- Primary action means the next meaningful action for the current destination, not a decorative filled button.
- Loading, empty, error, retry, unavailable, and stale states keep the same footprint as the content they replace where practical.
- Never log or display raw response objects, credentials, spreadsheet IDs, personal data, or source-row identities.

## 6. One-viewport desktop layout

### Reference dimensions

| Measurement | Contract |
| --- | --- |
| Reference desktop viewport | `1440 × 900px` CSS viewport at 100% zoom |
| Supported desktop width | `1280px` and above |
| Minimum supported desktop height for no-scroll Dashboard | `768px` |
| Expanded/collapsed sidebar | `240px / 72px` |
| Utility bar | `64px` |
| Dashboard tab bar | `48px` |
| Main outer padding | `20px` at 1280–1439; `24px` at 1440+ |
| Inter-region gap | `12px` compact; `16px` standard |
| Overview executive row | `188px` target, `168px` minimum |
| Overview KPI row | `176px` target, `156px` minimum |
| Primary content area | Remaining height after utility, tabs, padding, and gaps; minimum `400px` at reference viewport |
| Performance/Analytics chart card | `280–336px`, computed from available panel height |

At `1440 × 900`, expanded-sidebar Dashboard content is approximately `1200 × 836px` before main padding. The Overview panel uses one executive band and one four-column KPI row. Cards must truncate no business meaning: reduce optional explanatory copy through approved concise variants before shrinking values or controls.

### Height behavior

- At `height >= 768px` and `width >= 1280px`, Overview must fit without page/main/panel vertical scroll.
- At `height < 768px`, keep desktop navigation but activate `compact` density, reduce gaps/padding within token limits, and allow one labelled tab-panel vertical scroller. Do not clip content or shrink text below token minimums.
- At widths below `1024px`, switch to the mobile shell and allow natural vertical document scrolling.
- At browser zoom/reflow where CSS viewport width falls below the desktop threshold, use mobile behavior. No requirement overrides WCAG reflow.

### Primary grids

- Overview: `12` columns; executive summary `12`; four KPI groups `3` columns each.
- Performance: chart/detail `7/5` columns.
- Analytics: Revenue/primary evidence `7`, secondary evidence `5`; lower pair `6/6`.
- Intelligence: `4/4/4` with the priority action appearing first in DOM and visual order.
- Planning: `6/6`, roadmap `12`.
- Transactions: toolbar `12`, table `12`.

## 7. Light theme tokens

Token values are implementation targets, not Tailwind class requirements. Components consume semantic tokens; they do not choose raw palette values independently.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#F4F7FB` | App background |
| `sidebar` | `#0F1B2D` | Navigation surface |
| `sidebar-hover` | `#19283D` | Navigation hover |
| `surface-1` | `#FFFFFF` | Primary cards/panels |
| `surface-2` | `#F8FAFC` | Inset groups/table header |
| `surface-3` | `#EEF2F7` | Selected-neutral/quiet state |
| `border-subtle` | `#E2E8F0` | Default boundaries |
| `border-strong` | `#CBD5E1` | Emphasized boundaries |
| `text-primary` | `#0F172A` | Headings and values |
| `text-secondary` | `#475569` | Body/supporting text |
| `text-muted` | `#64748B` | Metadata/captions |
| `text-on-dark` | `#F8FAFC` | Sidebar primary text |
| `brand` | `#4F46E5` | Active/primary action |
| `brand-hover` | `#4338CA` | Brand hover |
| `brand-soft` | `#EEF2FF` | Selected/tinted surface |
| `success` / `success-soft` | `#047857` / `#ECFDF5` | Positive/healthy status |
| `info` / `info-soft` | `#0369A1` / `#F0F9FF` | Informational status |
| `warning` / `warning-soft` | `#B45309` / `#FFFBEB` | Attention status |
| `critical` / `critical-soft` | `#B91C1C` / `#FEF2F2` | Error/critical status |
| `hover` | `#F1F5F9` | Neutral hover |
| `focus` | `#2563EB` | Focus ring |
| `selected` | `#E0E7FF` | Selected neutral/brand state |
| `disabled-bg` | `#F1F5F9` | Disabled control surface |
| `disabled-text` | `#94A3B8` | Disabled content |
| `overlay` | `rgba(15, 23, 42, 0.56)` | Drawer/dialog backdrop |
| `shadow-1` | `0 1px 2px rgba(15,23,42,.06)` | Low elevation |
| `shadow-2` | `0 8px 24px rgba(15,23,42,.10)` | Drawer/dialog or priority surface only |

Light chart series: `#4F46E5`, `#0284C7`, `#059669`, `#D97706`, `#E11D48`, `#7C3AED`, `#0891B2`, `#65A30D`. Gridline `#E2E8F0`; axis `#64748B`; tooltip background `#0F172A`; tooltip text `#F8FAFC`; selected point ring `#FFFFFF` with `#2563EB` outer stroke.

## 8. Dark theme tokens

Dark mode uses deep navy/slate, never pure black. Hierarchy mirrors light mode: canvas < primary surface < inset/selected surface by perceived elevation.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#07111F` | App background |
| `sidebar` | `#0B1627` | Navigation surface |
| `sidebar-hover` | `#15243A` | Navigation hover |
| `surface-1` | `#0F1C2E` | Primary cards/panels |
| `surface-2` | `#142338` | Inset groups/table header |
| `surface-3` | `#1A2C45` | Selected-neutral/quiet state |
| `border-subtle` | `#243750` | Default boundaries |
| `border-strong` | `#36506F` | Emphasized boundaries |
| `text-primary` | `#F1F5F9` | Headings and values |
| `text-secondary` | `#CBD5E1` | Body/supporting text |
| `text-muted` | `#94A3B8` | Metadata/captions |
| `text-on-dark` | `#F8FAFC` | Sidebar text |
| `brand` | `#818CF8` | Active/primary action |
| `brand-hover` | `#A5B4FC` | Brand hover |
| `brand-soft` | `#252B5B` | Selected/tinted surface |
| `success` / `success-soft` | `#34D399` / `#0B352C` | Positive/healthy status |
| `info` / `info-soft` | `#38BDF8` / `#0B3044` | Informational status |
| `warning` / `warning-soft` | `#FBBF24` / `#3B2A0B` | Attention status |
| `critical` / `critical-soft` | `#FB7185` / `#421822` | Error/critical status |
| `hover` | `#17283D` | Neutral hover |
| `focus` | `#60A5FA` | Focus ring |
| `selected` | `#293263` | Selected neutral/brand state |
| `disabled-bg` | `#162235` | Disabled control surface |
| `disabled-text` | `#64748B` | Disabled content |
| `overlay` | `rgba(2, 6, 23, 0.72)` | Drawer/dialog backdrop |
| `shadow-1` | `0 1px 2px rgba(0,0,0,.28)` | Low elevation |
| `shadow-2` | `0 12px 30px rgba(0,0,0,.38)` | Drawer/dialog or priority surface only |

Dark chart series: `#818CF8`, `#38BDF8`, `#34D399`, `#FBBF24`, `#FB7185`, `#C084FC`, `#22D3EE`, `#A3E635`. Gridline `#243750`; axis `#CBD5E1`; tooltip background `#F8FAFC`; tooltip text `#0F172A`; selected point ring `#0F1C2E` with `#60A5FA` outer stroke.

## 9. Typography

Font stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. No new font request is required. All financial values use `font-variant-numeric: tabular-nums`; tables also use tabular numbers for Qty and Amount.

| Role | Size / line height | Weight | Letter spacing |
| --- | --- | --- | --- |
| Page title | `28px / 36px` desktop; `24px / 32px` mobile | 700 | `-0.02em` |
| Section heading | `20px / 28px` | 700 | `-0.01em` |
| Card heading | `16px / 24px` | 600 | `0` |
| KPI value | `28px / 32px`; compact `24px / 28px` | 700 | `-0.02em` |
| Body | `14px / 21px` | 400 | `0` |
| Emphasized body | `14px / 21px` | 600 | `0` |
| Label/tab/table header | `13px / 18px` | 600 | `0` |
| Caption/metadata | `12px / 17px` | 400–500 | `0.01em` |
| Eyebrow | `11px / 16px` | 700 | `0.08em`; uppercase only for short labels |
| Table body | `13px / 20px` | 400–500 | `0` |

Do not use uppercase for sentences, instructions, recommendation text, or status explanations. Values and units must remain visually associated and wrap without shrinking below `20px` for primary KPI values.

## 10. Geometry and density

- Spacing scale: `0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48px`.
- Grid: 12 columns, `16px` gutters standard, `12px` compact, `24px` wide-screen maximum.
- Card padding: `20px` standard; `16px` compact; `24px` spacious only for executive/empty/error surfaces.
- Radii: `6px` small, `10px` controls, `12px` cards, `16px` executive/dialog; pills only for badges.
- Borders: `1px` standard; `2px` only for selected/focus/error emphasis.
- Shadows: prefer borders; `shadow-1` for cards requiring separation, `shadow-2` only for overlays or one priority surface.
- Icons: `16px` inline, `20px` navigation/control, `24px` state illustration maximum without explicit justification.
- Button/input heights: `40px` compact desktop, `44px` standard and all touch contexts, `48px` prominent mobile action.
- Density tiers: `standard` default; `compact` for desktop below 820px height; `comfortable` for Transactions rows on mobile. Density never changes semantics, focus targets, or minimum text sizes.

## 11. Data visualization

### Palette and semantics

- Series colors follow the ordered theme palettes above and keep stable meaning within a chart across theme changes.
- Positive/negative status uses semantic success/critical colors only when the metric definition supports that judgment. Revenue down is not automatically critical; expense down is not automatically positive without business semantics.
- Comparison series uses the same hue with `45%` opacity or a dashed line, plus a text label. Do not encode comparison solely by lighter color.
- Selected points use a 3px outer ring and enlarged radius without changing the underlying value.

### Chart anatomy

- Gridlines use the theme gridline token at low emphasis. Axis labels use secondary text and never smaller than `11px`.
- Tooltip shows series label, formatted value, and period/category. It must remain inside the viewport where Chart.js permits.
- Legends appear only for two or more series or when category identity is otherwise unclear. Prefer top-aligned, wrapping legends.
- Accessible summary remains visible beneath or above the plot and includes scope, direction, extrema or leading category, and unavailable/zero explanation.
- Zero-data retains chart-container height and displays `No data for the current period.` Unavailable displays `Chart unavailable.` and preserves the text summary when data exists.

### Complexity limits

- Maximum three simultaneous line/bar series.
- Maximum eight visible categories; use approved aggregation, not silent truncation, before implementation exceeds it.
- Maximum one secondary axis, and only with explicit product approval; none is required initially.
- No 3D, gauge, decorative animation, unlabeled gradient, zoom, brush, legend filtering, or cross-filter behavior.
- Donut/pie charts show at most six segments; otherwise use a ranked bar/list.

Theme switching updates Chart.js colors, gridlines, axes, tooltips, legend, selected points, and animation preference in the same committed render. Destroy/recreate or safely update instances without duplicate canvases or listeners.

## 12. Settings boundary

Settings is a valid primary destination with two initial sections only:

### Appearance

- Theme choices: Light, Dark, System.
- Use a labelled radio group or equivalent single-selection control. The selected option has text and checked state; previews are optional and cannot be the only label.
- Initial default is `System` when no valid preference exists.
- First implementation may persist in browser-local storage only if its implementation package approves the storage key, validation, reset, privacy, and flash-prevention contract. Otherwise it is session-local and labelled accordingly.

### About

- Version from the existing authoritative template/config metadata.
- Environment only when an authoritative environment label is already available. Never infer it from the URL or expose script/deployment/spreadsheet identifiers.

Editable KPI targets, business rules, data sources, account/profile settings, permissions, notifications, and other business configuration remain deferred until persistence, validation, governance, migration/defaults, roles, audit, and rollback contracts exist.

## 13. Logs boundary

Logs is a valid primary destination for sanitized **client application events generated during the current browser session**:

- client application errors;
- warnings;
- load and retry outcomes;
- timestamp;
- severity;
- bounded component/action context; and
- sanitized, user-safe message.

Initial v2 support may be session-local only. The page must state: `Logs include this browser session only and are cleared when the session ends or the page is reloaded.` It is not an audit log, server log, business-event history, deployment log, or durable troubleshooting record.

Explicitly prohibited: raw business payloads, response objects, credentials, spreadsheet IDs, script/deployment IDs, personal data, source rows, stack traces containing sensitive arguments, and fabricated historical entries. Empty state says `No client events in this session.` Do not seed examples into production. Persistent/exported logs require a later privacy, retention, access, redaction, storage, and support workflow contract.

## 14. Accessibility contract

- **Contrast:** text and controls meet WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text and meaningful graphics/control boundaries. Focus indicators maintain at least 3:1 against adjacent colors.
- **Focus:** visible on every interactive element; logical DOM order matches visual order. Destination changes focus the new `h1`; tab changes retain tab focus. Drawer/dialog close restores focus.
- **Keyboard:** all actions work without pointer input. No positive `tabindex`. Escape closes transient overlays, not persistent content.
- **Tabs:** use the specified roving pattern, hidden inactive panels, and disabled-tab skipping.
- **Drawer:** synchronized expanded/hidden/inert states, trapped focus while modal on mobile, Escape/backdrop/close support, and body-scroll restoration.
- **Tables:** native caption/table/header relationships; labelled horizontal scroll container; no div-only grid for current data.
- **Disclosures:** native button, synchronized expanded state, controlled content hidden from navigation when collapsed.
- **Live regions:** one bounded dashboard status, one transaction/drill-down status, and one toast region maximum. Do not announce routine tab focus or duplicate visible messages.
- **Theme switch:** labelled single-selection control; selected state is programmatic; result is announced once only if focus/context would not otherwise make it clear.
- **Reduced motion:** disable smooth shell, drawer, skeleton, chart, and toast motion under `prefers-reduced-motion: reduce`; never delay state visibility for animation.
- **Icon-only controls:** accessible name and hover/focus tooltip; icon is not read redundantly.
- **Color independence:** status word, direction word/icon, series label/style, selected marker, and active indicator accompany color.
- **Zoom/reflow:** at 200% and narrow CSS widths, mobile/natural-scroll behavior takes precedence over the desktop one-viewport target.

## 15. Theme behavior

- Modes: Light, Dark, System. Default: System.
- System follows `prefers-color-scheme` changes only while System is selected.
- A persisted explicit choice is allowed only after the Settings implementation package defines a namespaced key, accepted values, invalid-value fallback, and clear/reset behavior. No server/spreadsheet persistence is implied.
- To prevent flash of the wrong theme, a minimal inline bootstrap may read the validated preference before visible paint and set one root theme attribute. It must contain no business data, network request, or dependency. Without approved persistence, render System immediately and do not simulate persistence.
- Theme updates are atomic across root tokens, native `color-scheme`, Chart.js instances, and control selected state.
- Print always uses print-light tokens, white canvas, dark text, restrained series colors/patterns, visible report metadata, and no sidebar, tabs, inactive panels, drawer, toast, or unavailable controls.

## 16. Component decision table

Acceptance owners: `Product` verifies truthful scope/hierarchy; `Frontend` verifies implementation/state; `Accessibility` verifies semantics/keyboard/focus; `Analytics` verifies data meaning; `Reporting` verifies print/CSV.

| Component/system | Owner | First implementation | Future reuse | Complexity | Regression risk | Acceptance owner |
| --- | --- | --- | --- | --- | --- | --- |
| Shell/sidebar/drawer | Frontend | Required | All modules | High | High | Frontend + Accessibility |
| Theme tokens/behavior | Frontend | Required | All components | High | High | Frontend + Accessibility + Reporting |
| Primary navigation | Product/Frontend | Required | Future modules | Medium | High | Product + Accessibility |
| Dashboard tab bar | Dashboard/Frontend | Required | Other tabbed destinations | Medium | High | Product + Accessibility |
| Transactions tab bar | Transactions/Frontend | Required; only truthful tabs | Future migrated views | Medium | High | Product + Accessibility |
| Page header/utility metadata | Frontend | Required | All destinations | Low | Medium | Product + Accessibility |
| Date filter | Dashboard | Required | Reporting scopes | Medium | High | Frontend + Accessibility |
| Executive Summary/Business Priority | Dashboard/Intelligence | Required | None outside Dashboard | Medium | High | Product + Analytics |
| KPI/comparison/sparkline | Dashboard/Analytics | KPI/comparison required; sparkline optional | Future financial modules | Medium | Medium | Analytics + Accessibility |
| Chart container/tooling/legend/summary | Chart/Analytics | Required where charts exist | Future analytics | High | High | Analytics + Accessibility |
| Data Quality indicator/disclosure | Dashboard | Required | Future diagnostics | Medium | High | Product + Accessibility |
| Recommendation/timeline | Intelligence | Required | Planning modules | Medium | Medium | Product + Analytics |
| Table/table toolbar | Transactions | Required | Logs/future modules | Medium | High | Product + Accessibility |
| Pagination | Data owner | Not required | Future expanded data | High | High | Product + Accessibility |
| Buttons/inputs/badges/disclosures | Frontend | Required | All destinations | Medium | Medium | Frontend + Accessibility |
| Loading/empty/error/retry | Dashboard/Frontend | Required | All async destinations | High | High | Frontend + Accessibility |
| Stale-data state | Data owner | Not required without real cache | Future cached views | Medium | High | Product + Analytics |
| Toast/inline alert | Frontend | Inline required; toast only for bounded outcomes | Settings/Logs/actions | Medium | Medium | Accessibility |
| Modal/side panel | Feature owner | Not required | Future justified workflows | High | High | Product + Accessibility |
| Settings Appearance/About | Product/Frontend | Required in Settings slice | Future governed settings | Medium | Medium | Product + Accessibility |
| Session-local Logs | Frontend | Required in Logs slice | Future governed diagnostics | Medium | High | Product + Accessibility |

## 17. Implementation slicing

Each package is independently reviewable and must preserve existing response, state, print, CSV, chart, performance, and accessibility contracts. Production implementation begins only through separate authorization.

1. **Shell and theme foundation** — semantic tokens, root theme behavior, viewport shell, expanded/collapsed sidebar, mobile drawer, four approved destinations, utility bar, print-light foundation. Do not add empty destination content; Settings/Logs routes may land only when their own minimal truthful surfaces are included or remain unavailable until their slices.
2. **Dashboard tab framework** — five tabs, roving keyboard behavior, stable DOM/query ownership, state replacement, request-token preservation, and responsive/mobile fallback. Move no content outside its approved ownership.
3. **Overview** — Executive Summary, one Business Priority, comparison, KPI row, compact Data Quality, and measurable 1440×900/1280×768 fit.
4. **Performance and Analytics** — performance facts, target disclosure, current charts/ranking, local chart states, accessible summaries, theme synchronization, and safe internal overflow.
5. **Intelligence and Planning** — signals, actions, risk/growth, focus, achievement, maturity, and roadmap without duplicated executive messaging.
6. **Transactions** — Recent plus truthful bounded Sales/Purchases projections, unavailable Expenses handling, table toolbar, CSV-visible scope, and drill-down focus/status preservation.
7. **Settings** — Appearance and About only; decide and test session-local versus approved browser-local persistence before implementation.
8. **Logs** — sanitized session-local event model, empty state, bounded table/list, privacy prohibitions, and truthful lifetime label; no fake history.
9. **Responsive/accessibility stabilization** — keyboard, focus, tab/drawer semantics, contrast in both themes, reduced motion, zoom/reflow, table containment, one-viewport measurements, print-light, and deployed-browser acceptance after separately authorized upload/deployment.

Package gates must distinguish local/static checks, Apps Script runtime, upload, deployment, and browser acceptance. Visual/interaction packages are not complete on static checks alone.

## Acceptance checklist

- [ ] Every implemented component consumes semantic tokens and needs no new visual invention.
- [ ] Light and dark hierarchies, statuses, focus, charts, disabled states, and print-light are complete.
- [ ] Overview fits `1440 × 900` and `1280 × 768` without document/main/panel vertical scrolling.
- [ ] Below-minimum-height and zoom behavior uses one safe scroller or mobile reflow without clipping.
- [ ] Dashboard/Transactions tab ownership matches this document and preserves active-period semantics.
- [ ] Settings contains only Appearance and About; persistence scope is truthful.
- [ ] Logs are sanitized and session-local unless a later governance contract is approved.
- [ ] Future modules are structurally accommodated but absent until populated and approved.
- [ ] Keyboard, focus, semantics, announcements, reduced motion, non-color meaning, and contrast pass browser acceptance.
- [ ] No removed SaaS decoration, source information, fabricated data, or unsupported behavior appears.

