# NUMLOCK UI/UX 2.0 High-Fidelity Implementation Specification

## 1. Authority and boundary

This Package 015 specification is the implementation authority for Packages 016–022. User-approved reference 2 controls visual direction; reference 1 controls clear expanded/collapsed sidebar behavior. Earlier [Information Architecture](UIUX-2.0-INFORMATION-ARCHITECTURE.md), [Wireframes](UIUX-2.0-WIREFRAMES.md), [Visual Directions](UIUX-2.0-VISUAL-DIRECTIONS.md), and [Component Library](UIUX-2.0-COMPONENT-LIBRARY.md) remain historical inputs. The [Gap Audit](UIUX-2.0-GAP-AUDIT.md) controls the reopening and nine-destination requirement.

This package changes documentation only. It does not authorize backend, response, data, formula, persistence, permission, source, Tailwind, dependency, clasp, deployment, or release changes.

## 2. Reference-to-NUMLOCK translation

| Approved trait | Measurable NUMLOCK rule |
| --- | --- |
| One desktop viewport | At `1440×900` and `1280×768`, `html`, `body`, shell, and main remain viewport-bound with no document/main vertical scroll. Only the active tab’s named internal region may scroll where this specification permits it. |
| Hidden/collapsible sidebar | Desktop rail is `232px` expanded and `64px` collapsed. Collapse never changes destination order or page state. Below `1024px`, use the modal drawer; no persistent rail. |
| Slim utility/header | One `52px` utility row owns page title/context, reporting controls/actions, and quiet metadata. Do not render a second visible page-header band. |
| Horizontal content navigation | Dashboard and Transactions tab rails sit immediately below the utility row, are `40px` high, and precede KPI/content. The tablist contains only tabs; actions remain outside it. |
| Compact KPI cards | KPI cards are `112px` high at `1440×900` and `96px` in compact desktop density, with `14–16px` padding and one primary value. |
| Chart-led composition | Overview includes the Revenue Trend hero after the KPI row. Performance and Analytics give plots/rankings at least `60%` of usable panel area. |
| Low-noise monochrome surfaces | Canvas plus at most two neutral surface elevations dominate. Semantic color appears only for truthful state; accent is limited to active navigation, focus, selected control, primary action, and selected chart point. |
| Minimal borders/cards | Use one boundary at a region edge. Do not border both a parent and every child. Maximum visible nested-surface depth is two. |
| Editorial hierarchy | Context → finding → measure/evidence → action. Use sentence case, short labels, restrained weights, and whitespace/alignment before badges or boxes. |
| Light/dark parity | Every semantic token has an exact light/dark value. Layout, prominence, borders, selected states, and status meaning remain equivalent. |
| No irrelevant SaaS decoration | Do not add search, notifications, avatar/profile, greeting, upgrade/promotion cards, drag handles, decorative statistics, command palette, workspace switcher, or ornamental gradients. |

Reference features explicitly excluded: global search, notification bell/count, user avatar/menu, personalized greeting, upgrade/plan card, drag/reorder controls, decorative trend tiles, activity feed, collaboration/presence, saved views, global create button, floating action button, and any metric or module not backed by the current response.

## 3. Global composition

### Desktop frame

| Measurement | `1440×900` | `1280×768` |
| --- | ---: | ---: |
| Expanded/collapsed sidebar | `232 / 64px` | `216 / 64px` |
| Utility row | `52px` | `48px` |
| Destination tab rail | `40px` | `40px` |
| Main horizontal padding | `24px` | `20px` |
| Main vertical padding | `16px` | `12px` |
| Standard/compact gap | `16 / 12px` | `12 / 8px` |
| KPI row | `112px` | `96px` |
| Hero chart region | `300–328px` | `240–268px` |
| Supporting panel region | remaining panel height, minimum `184px` | remaining panel height, minimum `152px` |

The shell is a two-column grid and main is a two-row grid: sidebar + main; utility + bounded content. The active destination consumes `100dvh - utility`. Dashboard/Transactions reserve the first `40px` for their tab rail. Pages without tabs start content immediately below utility.

At both desktop targets, page-level scroll is prohibited. A single labelled internal scroller is permitted only for: Intelligence recommendation evidence, Planning roadmap, Transactions table body, or Logs event list. Settings must fit without scrolling at both targets. Overview must have no internal vertical scroller. Performance and Analytics may scroll only their supporting text/ranking column when content exceeds the defined height; plots remain fixed and visible.

Maximum visible bordered/elevated components per active tab: Overview `7` including five KPIs, hero chart, and one executive plane; Performance `3`; Analytics `4`; Intelligence `3`; Planning `3`; Transactions `3`; Settings `2`; Logs `4`. Small controls, table rows, list items, and badges do not count as independent cards.

### Responsive frame

- Below `1024px`, main uses natural document scrolling, `16px` page padding at `768px`, and `12px` at `375px`.
- No page-level horizontal overflow. Only tab rails and semantic data tables may scroll horizontally.
- Mobile content order equals desktop DOM order. Do not reorder with CSS when that would change reading/focus order.
- At 200% zoom or an effective width below `1024px`, responsive natural flow overrides the desktop one-viewport target.

## 4. Sidebar and navigation

### Destination order and truthfulness

| Destination | State | Behavior |
| --- | --- | --- |
| Dashboard | Active | Navigates to current Dashboard without resetting filter/tab unless current contracts require focus transfer. |
| Transactions | Active | Navigates to bounded current-response evidence; preserves drill-down rules. |
| Settings | Active | Appearance and About only. |
| Logs | Active | Sanitized current-session client events only. |
| Products | Unavailable | No route/page; migration-gated. |
| Capital & Equity | Unavailable | No route/page; migration-gated. |
| Assets | Unavailable | No route/page; migration-gated. |
| Depreciation | Unavailable | No route/page; migration-gated. |
| Financial Statements | Unavailable | No route/page; migration-gated. |

The first four items appear in `Primary`. The final five appear in a `Financial modules` disclosure after Logs. Expanded rail shows the group label and full status text. Collapsed rail shows icons but keeps unavailable items inside the disclosure only when expanded; each enabled icon has a hover/focus tooltip. Unavailable items use `aria-disabled="true"`, remain unfocusable unless a separately labelled explanation control is approved, suppress pointer/keyboard activation, and expose the accessible description `Unavailable until module migration is approved`. Color and reduced opacity are supplemental.

### Geometry and interaction

- Expanded item: `40px` high, `12px` horizontal padding, `8px` gap, `8px` radius, `20px` icon.
- Collapsed item: `40×40px`, centered `20px` icon, accessible name, tooltip after `400ms` hover or immediately on keyboard focus.
- Rail padding: `12px`; item gap: `4px`; group separation: `16px`; brand row: `52px`.
- Active state: `3px` accent inset edge plus selected-neutral background and semibold label; never a full saturated pill.
- Collapse control is at the rail footer, `40px` high, labelled `Collapse navigation`/`Expand navigation`, with synchronized shell state.
- Mobile drawer width: `min(320px, calc(100vw - 32px))`; full-height; same item order and labels; no icon-only mode. Opening moves focus to Close, traps focus, sets background inert/hidden, and locks body scroll. Close, Escape, backdrop, or successful enabled navigation closes and restores/focuses according to the existing contract.
- Financial modules disclosure is expanded by default in the mobile drawer so unavailable destinations remain discoverable; its button synchronizes `aria-expanded` and `aria-controls`.
- No unavailable item may create a URL, tabpanel, empty page, skeleton, sample chart, or fabricated module data.

## 5. Dashboard composition

The visible utility row contains `Dashboard`, concise context, active period, freshness, period control, and Print. Custom dates appear inline only when selected. Data Quality remains a compact disclosure/status in content. One Business Priority remains authoritative.

### Overview

- Order: executive plane → KPI row → Revenue Trend hero with compact reporting/Data Quality footer.
- Grid: executive `12`; KPIs five equal columns; hero chart `8` + evidence/context `4`.
- Executive plane: maximum three facts—condition, attention, Business Priority—plus one compact comparison row; maximum height `132px` (`116px` compact).
- KPI row: exactly five current KPIs; no extra decorative statistic. One value, label, optional delta/context, and bounded evidence action per card.
- Revenue Trend owns at least `60%` width and `240px` plot height at `1280×768`, `288px` at `1440×900`.
- Maximum visible components: one executive plane, five KPI cards, one hero chart region.
- No vertical scrolling. Hide/defer long explanations, Target Reference, secondary charts, recommendations, and planning content to their owning tabs.

### Performance

- Order: Revenue/Expense/Profit/Margin/Units instrument list → Revenue Trend → forecast/Target Reference context.
- Grid: instrument column `4`, hero chart `8`; Target Reference is a closed disclosure beneath instruments, not another card.
- Chart gets `65–70%` of visual area; facts use one borderless divided list.
- Maximum three visible region surfaces. Only instrument/supporting context may internally scroll; chart stays visible.
- Do not repeat Overview Business Priority, KPI cards, or period comparison.

### Analytics

- Order: Hot/Cold → Expense Breakdown → Top Products → contribution/dependency/concentration/Pareto evidence.
- Grid: upper `5/7`; lower `5/7`, with Expense or the most information-dense Cartesian plot in the wider column.
- Two chart regions and two ranking/evidence regions maximum. Charts each receive at least `180px` plot height at compact desktop and `220px` at `1440×900`.
- Lists may internally scroll within their region; charts do not. No new chart, legend filter, search, or cross-filter.

### Intelligence

- Order: diagnosis/alert → prioritized recommendations → risk/opportunity with Revenue/Profit evidence.
- Grid: `4/5/3`; recommendations receive the widest column.
- Maximum three region surfaces. Diagnosis and recommendations may independently scroll only if their fixed content region overflows; preserve visible headings.
- Use editorial list items with dividers, not cards inside cards. Hide/defer Business Focus, roadmap, maturity, target reference, and duplicate Business Priority.

### Planning

- Order: Business Focus and score-free Priority Action → roadmap → KPI Achievement/Business Maturity → Target Reference disclosure.
- Grid: focus `4`, roadmap `8`; supporting measures form a single compact row beneath.
- Maximum three region surfaces. Roadmap owns the only permitted scroller.
- Show four-week sequence as one continuous timeline; do not invent completion, owners, dates, drag/reorder, or editable targets.

### Dashboard typography

Page identity is `24/30px` semibold. Executive finding is `18/24px` semibold; KPI values `26/30px` bold with tabular numerals; chart title `16/22px` semibold; section labels `12/16px` semibold sentence case. Avoid uppercase eyebrow copy except short data/status codes.

## 6. Transactions

- Utility row owns page identity and bounded-scope context. The `40px` tab rail sits below it. Export CSV is in a right-aligned toolbar outside the tablist and immediately above the table.
- Content order: tab rail → scope/drill-down strip + CSV → table/empty state.
- Desktop table region height: remaining viewport after utility, tabs, toolbar, and `12px` gaps; minimum `420px` at `1440×900`, `304px` at `1280×768`.
- Header is sticky, `36px` high, `12px` semibold sentence case, neutral elevated surface, one bottom border. Do not use wide uppercase tracking.
- Rows are `40px` high desktop and `44px` mobile/touch; body text `13/18px`; Qty/Amount use tabular numerals and right alignment. Use row dividers, not boxed rows or zebra stripes.
- Active drill-down is one `40–56px` selected-neutral strip containing evidence label, count, explicit `maximum 10 loaded rows` boundary, and `Show all recent`. It never appears as a saturated alert.
- CSV remains a compact secondary button in the toolbar and is disabled when no visible rows exist.
- At `768px` and `375px`, toolbar stacks only when necessary. Preserve the five-column semantic table at `min-width: 680px` inside its labelled horizontal scroller; do not transform rows into cards or hide columns.
- No independent date control, search, sort, pagination, selection, detail drawer, edit/create/delete, or expanded history.

## 7. Settings

- Order: page title/context → Appearance → About.
- Desktop grid: Appearance `7`, About `5`, maximum width `960px`; at `1280×768`, both panels fit beneath utility with `16px` gap and no scroll.
- Appearance uses one labelled radio group. Options are compact `44px` rows or three equal `88px` choices at `1440×900`; selection uses checked control, `2px` accent boundary, and selected-neutral fill.
- About uses a compact definition list with `36px` rows and dividers: Application, Version, Release, Environment. Metadata remains config-derived.
- Headings: page `24/30px`, section `16/22px`, label/value `13/18px`.
- Do not use admin-template navigation, profile/account panels, permissions, integrations, notifications, API keys, billing, editable targets, decorative previews, or save/apply buttons. Theme changes remain immediate under the existing contract.

## 8. Logs

- Order: page title/context → scope notice → severity summary → filters/Clear → event list/empty state.
- Scope notice is borderless or one-edge informational text and must state session-only lifetime and `100`-entry cap.
- Severity summary is one inline divided strip, not three cards. Each severity shows label + count; color is supplemental.
- Filters are native radio/chip controls in one `40px` toolbar; Clear is a secondary action at the end.
- Desktop event list fills remaining viewport and owns the only vertical scroll. Rows use `8px` vertical padding, `12px` gap, timestamp `12px`, context/message `13/19px`, and a `2px` semantic severity edge plus text label.
- Long messages wrap to three lines, then use a native disclosure labelled `Show full message`; no tooltip-only truncation. Keep sanitization and no raw payloads.
- Empty state is plain text within the list region. No search, export, pagination, durable history, server query, fabricated events, or dashboard-style analytical chart.
- At mobile widths, severity strip may wrap into two columns; filters wrap; list uses natural page flow rather than a nested vertical scroller.

## 9. Component specifications

All dimensions are CSS pixels. Mobile adaptations apply below `1024px` unless noted.

| Component | Desktop specification | States and theme | Mobile adaptation |
| --- | --- | --- | --- |
| Sidebar | `232/64px` (`216/64px` compact), `12px` padding, `40px` items, `8px` radius, `20px` icons | Active edge + selected fill; hover neutral; unavailable muted + text; `3px` focus ring | Modal drawer, max `320px`, full labels, `44px` items |
| Utility bar | `52px` (`48px` compact), `20–24px` horizontal padding, bottom border only | Surface primary; no shadow; controls use shared states | `52px`; Menu + page title + primary action; metadata may move below title |
| Page title | `24/30px`, `600`, `-0.015em` | Primary text | `21/28px` |
| Horizontal tabs | `40px`, `12px` gap, `12px` side padding, `13/18px` semibold | Selected text + `2px` underline; hover text/background; disabled skipped | Horizontal scroller, `44px` touch height, no dropdown |
| KPI card | `112px`/`96px`, `14–16px` padding, `10px` radius, max one border, no default shadow | Hover only if actionable; focus ring on action; no saturated status fill | Two columns at `768px`, one at `375px`; auto height |
| KPI delta | `12/16px`, `600`, direction word/icon + finite value | Semantic color only when meaning is valid | Wrap below value; never absolute-positioned |
| Hero chart | `8/12` grid, `16px` padding, `12px` radius, plot `240–288px` | Primary surface, optional border, no default shadow; visible summary | Full width, plot `240px` at `768`, `220px` at `375` |
| Secondary chart | `5–7/12`, `14px` padding, plot `180–220px` | Same anatomy/palette; no nested card | Full width, plot `220px` |
| Data table | Sticky `36px` header, `40px` rows, `13/18px`, row dividers | Neutral hover; focus on overflow region; selected drill-down outside table | `44px` rows, `680px` min table width in scroller |
| Badge | Height `22px`, `6px` x-padding, `999px` radius, `12/16px` semibold | Text + optional icon; soft semantic fill only for status | Same size; wrap outside sentence text |
| Button | Compact `36px`, standard `40px`, `12px` x-padding, `8px` radius, `14/20px` semibold, `16px` icon | Primary accent fill; secondary neutral border; hover, focus, disabled distinct | Minimum `44px` touch height |
| Disclosure | `40px` row, label + chevron, no enclosing card unless region needs boundary | Synchronized expanded state; focus ring; hidden content unfocusable | `44px`, full-width target |
| Recommendation | `12px` vertical padding, divider, priority `12px`, title `14/20px`, reason/action `13/19px` | No fake completion; hover only if actionable | Natural height, full-width |
| Timeline | `32px` marker column, `12px` item gap, continuous `1px` line, `13/19px` text | Current/future text labels; no drag affordance | Same vertical structure |
| Status/empty/error | Maximum `480px` text width, `20px` padding, `12px` radius, icon max `24px` | Text + semantic edge/icon; Retry one clear action; loading neutral | Full width; `16px` padding |

Borders are `1px`; selected/error emphasis may use `2px`. Default components use no shadow. `shadow-1` is allowed for a floating priority surface only when separation cannot be achieved with surface contrast; `shadow-2` is restricted to drawer/overlay. Icon-only controls require accessible names and hover/focus tooltips.

## 10. Typography

Font stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. No new font request.

| Role | Desktop | Mobile | Weight | Letter spacing |
| --- | --- | --- | ---: | ---: |
| Display metric | `32/36px` | `28/32px` | `700` | `-0.025em` |
| KPI value | `26/30px` compact `24/28px` | `24/28px` | `700` | `-0.02em` |
| Page title | `24/30px` | `21/28px` | `600` | `-0.015em` |
| Section heading | `18/24px` | `17/23px` | `600` | `-0.01em` |
| Component heading | `16/22px` | `15/21px` | `600` | `0` |
| Body | `14/21px` | `14/21px` | `400` | `0` |
| Label/tab | `13/18px` | `13/18px` | `600` | `0` |
| Table body | `13/18px` | `13/19px` | `400–500` | `0` |
| Metadata/caption | `12/16px` | `12/17px` | `400–500` | `0.01em` |

All financial values and Qty/Amount columns use tabular numerals. Use uppercase only for short established status codes, never headings, instructions, recommendation copy, table headers, or eyebrow decoration.

## 11. Color tokens

Components consume semantic tokens; raw palette utilities must not define independent meaning.

| Token | Light | Dark |
| --- | --- | --- |
| `canvas` | `#F6F7F9` | `#0A0D12` |
| `sidebar` | `#17191D` | `#090B0F` |
| `surface-primary` | `#FFFFFF` | `#11151B` |
| `surface-elevated` | `#F0F2F5` | `#181D25` |
| `border` | `#D9DDE3` | `#303742` |
| `text-primary` | `#171A1F` | `#F3F4F6` |
| `text-secondary` | `#4B5563` | `#C3CAD4` |
| `text-muted` | `#6B7280` | `#929CAA` |
| `accent` | `#4F46E5` | `#8B87FF` |
| `selected` | `#ECEBFF` | `#29264D` |
| `hover` | `#ECEFF3` | `#202630` |
| `focus` | `#2563EB` | `#70A5FF` |
| `success` | `#16724A` | `#4FD19A` |
| `success-soft` | `#ECF8F2` | `#123126` |
| `info` | `#176B8F` | `#56BCE8` |
| `info-soft` | `#ECF6FA` | `#102C39` |
| `warning` | `#9A5B13` | `#F3BD62` |
| `warning-soft` | `#FFF6E8` | `#392A15` |
| `critical` | `#B33A45` | `#FF8791` |
| `critical-soft` | `#FDEFF0` | `#3B1C21` |
| `gridline` | `#E3E6EA` | `#2B323C` |
| `tooltip-bg` | `#171A1F` | `#F3F4F6` |
| `tooltip-text` | `#FFFFFF` | `#171A1F` |

Chart palette light: `#4F46E5`, `#2878B8`, `#27835D`, `#A66A1E`, `#A94B62`, `#6758A8`. Dark: `#8B87FF`, `#66AFE6`, `#62C79A`, `#F0B65F`, `#ED849C`, `#A99BE4`. Use at most three plotted series per chart and six categorical segments. Semantic status colors do not automatically classify analytical series.

Focus is a `3px` ring with `2px` offset and at least `3:1` adjacent contrast. Normal text requires `4.5:1`; large text and meaningful boundaries require `3:1`.

## 12. Density and geometry

- Spacing scale: `0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40px`.
- Standard desktop uses `16px` gutters; compact desktop `12px`; mobile `12px` with `16px` section separation.
- Radius scale: `4px` micro, `8px` controls, `10px` compact cards, `12px` major surfaces, `16px` overlays only. Pills are badges only.
- Shadow scale: `none`; `shadow-1: 0 1px 2px rgb(15 23 42 / 0.06)`; `shadow-2: 0 12px 32px rgb(0 0 0 / 0.24)` for overlays only.
- Maximum nested-surface depth: two (`canvas → surface → inset`). A bordered inset inside a bordered card is prohibited.
- Borders are prohibited between items already separated by whitespace/alignment or dividers, around plain headings/metadata, and around every KPI child in a bordered parent.
- Shadows are prohibited on KPI grids, ordinary cards, tables, tab rails, utility bars, badges, buttons, and nested surfaces.
- Desktop uses compact density at viewport height `≤800px`. Mobile retains `44px` targets and readable type rather than compressing interaction.

## 13. State specification

| State | Visual and interaction rule |
| --- | --- |
| Loading | Keep utility/context identifiable; mark owned content busy; neutral low-contrast skeletons preserve layout; disable duplicate requests; reduced motion removes shimmer. |
| Success | Remove busy state and skeletons; render active tab hierarchy without an extra success banner. |
| Empty | Only zero scoped transaction rows; plain neutral surface, active period, concise explanation, controls remain available; no empty charts pretending to be Dashboard empty. |
| Limited | Explicit `Maximum 10 loaded rows` text beside bounded Transactions/drill-down evidence; informational, not warning. |
| Error | Critical edge/icon/text, sanitized explanation, one Retry; preserve filter values and clear skeletons. |
| Retry | Native button repeats exact saved filter/start/end, disables while active, and rejects stale callbacks. |
| Unavailable module | Visible in navigation with unavailable text/description; no activation, page, skeleton, or fabricated content. |
| Stale data | Warning text plus date; never color-only and never implies request failure. |
| Selected drill-down | Selected-neutral strip, evidence label/count/boundary, Clear action, focus transfer and bounded announcement. |
| Reduced motion | No shell/drawer/tab/skeleton/chart/toast animation; state changes remain immediate and visible. |

## 14. Visual acceptance matrix

Functional browser acceptance and visual-fidelity acceptance are separate results. Visual PASS requires side-by-side screenshots against this specification/reference direction using the same truthful rendered state.

### Required captures

| Viewport | Sidebar states | Required pages/states in Light and Dark |
| --- | --- | --- |
| `1440×900` | Expanded and collapsed | Dashboard Overview, Dashboard Performance, Transactions, Settings, Logs |
| `1280×768` | Expanded and collapsed | Dashboard Overview, Dashboard Performance, Transactions, Settings, Logs |
| `768px` | Drawer closed and open | Dashboard Overview, Dashboard Performance, Transactions, Settings, Logs |
| `375px` | Drawer closed and open | Dashboard Overview, Dashboard Performance, Transactions, Settings, Logs |

This yields `40` base page/theme captures plus the drawer/sidebar variants needed to show both navigation states. Add focused captures for unavailable Financial modules, loading, empty, error/Retry, limited rows, and selected drill-down at the smallest relevant viewport.

### Scoring

Score each category `0–2`: `0` fail, `1` partial/material correction required, `2` pass.

| Category | PASS (`2`) requirement |
| --- | --- |
| Visual hierarchy | Context, primary finding/value, evidence, and action read in the specified order; no duplicated executive message. |
| Density | Component counts/heights and information density meet the tab specification without decorative filler. |
| Viewport fit | No desktop page/main scroll or clipping; only permitted labelled scrollers; no horizontal page overflow. |
| Chart prominence | Hero plot receives specified width/height and clearly outranks supporting cards. |
| Typography | Specified scale, sentence case, weights, numeric alignment, line heights, and wrapping are visible. |
| Spacing | Shell padding, gaps, region alignment, and relationships match the defined scale within `±2px`. |
| Sidebar fidelity | Widths, grouping, collapse/drawer, labels/tooltips, active and unavailable states are correct. |
| Light/dark parity | Equal hierarchy, boundaries, focus, status meaning, chart differentiation, and legibility. |
| Forbidden-decoration absence | No excluded SaaS feature or decorative statistic appears. |

Each capture must score `18/18`; no category may be waived or averaged away. Record screenshot filename, viewport, theme, page/tab, sidebar state, score, deviations, reviewer, and date. Functional PASS, contract tests, upload, runtime, or deployed navigation cannot substitute for this matrix.

## 15. Implementation constraints

- Preserve backend behavior, all 37 response fields, formulas, data scope, date filtering, request/retry/stale protection, response immutability, print, CSV, charts, drill-down, Settings, Logs, accessibility, and performance contracts.
- Add no backend call, response field, fabricated business value, empty future page, feature, search, pagination, persistence, permission, dependency, or data surface.
- Visual reconstruction may replace existing frontend markup and classes when required by this specification, but public DOM/runtime contracts and test expectations must be deliberately migrated and verified rather than silently dropped.
- Keep Tailwind locally compiled and dependencies exactly pinned.
- Use semantic HTML first; preserve tab, drawer, disclosure, table, focus, live-region, reduced-motion, contrast, and reflow contracts.
- Functional parity is necessary but insufficient. A UI package is not visually complete without its required screenshot comparison.

## 16. Implementation packages

| Package | Scope | Required exit |
| --- | --- | --- |
| 016 — Sidebar/navigation architecture | Implement nine ordered destinations, four active and five migration-gated unavailable, Financial modules disclosure, `232/64px` rail, tooltips, mobile drawer | Focused navigation/accessibility/static contracts, unchanged routes/pages, desktop/mobile functional browser checks, scoped visual captures |
| 017 — Full-shell reconstruction | Implement `52/48px` utility row, unified header ownership, bounded content frame, canvas/surface hierarchy, typography and geometry primitives | Deterministic Tailwind, syntax/static/focused/unified gates, both desktop fit measurements, shell screenshot comparison |
| 018 — Dashboard reconstruction | Implement Overview, Performance, Analytics, Intelligence, Planning composition, compact KPIs, chart-led hierarchy and permitted scrollers | Dashboard/state/chart/performance/accessibility regressions, no response/request change, five-tab screenshot matrix |
| 019 — Transactions/Settings/Logs alignment | Apply table/toolbars, bounded drill-down, Appearance/About and session Logs composition | Export/drill-down/Settings/Logs/accessibility regressions and page screenshot matrix |
| 020 — Theme parity | Apply exact semantic tokens to all states, charts, controls, disabled/unavailable, focus and print-light | Contrast checks, deterministic build, Chart.js theme checks, full Light/Dark comparison |
| 021 — Bounded refactor | Remove only proven obsolete classes/helpers/duplicate paths created or exposed by reconstruction | Before/after searches, ownership evidence, focused/unified regression, rollbackable diff; no visual redesign |
| 022 — Visual regression closure | Run full functional and screenshot acceptance matrix across required pages, themes, viewports and navigation states | Local/static, authorized live/deployed functional evidence, `18/18` per visual capture, documented sign-off; only then may UI/UX 2.0 close |

Each package is separately authorized, independently reviewable, and stops at its evidence boundary.
