# UI/UX 2.1 Dashboard Overview Blueprint

## Authority and evidence

This blueprint starts UI/UX 2.1 Visual Reconstruction. It translates the production-capture gaps recorded in the [Gap Audit](UIUX-2.0-GAP-AUDIT.md) through the approved [High-Fidelity Specification](UIUX-2.0-HIGH-FIDELITY-SPEC.md). Reference 2 controls composition; reference 1 controls sidebar clarity. The current production screenshot is the before-state for implementation review; because no screenshot asset is stored in this repository, no visual PASS may be claimed without a real matched capture.

No formula, response field, request, date scope, navigation, persistence, target, chart value, or feature changes are authorized.

## Keep

- One utility row and five-tab Dashboard rail; Overview remains default.
- Executive Summary, attention status, one Business Priority, five KPIs, period comparison, Data Quality, and the existing Revenue Trend.
- Loading/success/empty/error/retry, drill-down, Light/Dark/System, print-light, accessibility, stale-callback, and performance behavior.
- Existing semantic tokens and real response-derived content.

## Remove or defer visually

- Repeated headings, explanatory copy, decorative icons, saturated fills, pill noise, nested cards, and borders around both parent and child.
- Target Reference, recommendations, secondary charts, roadmap, and planning/intelligence detail from Overview; retain them only in their owning tabs.
- Any duplicated Revenue Trend or fabricated summary. Move the existing chart region once; never clone its canvas or data.

## Composition

Order: executive plane → five-KPI row → `8/4` evidence row.

1. **Executive plane:** `12` columns, maximum `132px` (`116px` compact). Condition `3`, attention `3`, Business Priority `6`; comparison is a quiet divided footer, not another card.
2. **KPI row:** Revenue, Expense, Profit, Units Sold, Profit Margin; five equal columns; `112px` at `1440×900`, `96px` at `1280×768`.
3. **Evidence row:** existing Revenue Trend `8`; compact comparison/Data Quality context `4`. Plot height `288px` at `1440×900`, `240px` at `1280×768`.

Maximum visible elevated/bordered units: executive plane, five KPI units, and one chart region. Supporting evidence uses dividers/whitespace inside the context column.

## Typography

Page identity `24/30`, 600; executive finding `18/24`, 600; KPI value `26/30` (`24/28` compact), 700, tabular; chart title `16/22`, 600; labels `12/16`, 600; supporting text `13/19`, 400–500. Sentence case only; no decorative uppercase eyebrow copy.

## KPI treatment

Each KPI has one label, one primary value, at most one finite comparison/context line, and its existing bounded evidence action. Use neutral surface, ≤1 border, `10px` radius, `14–16px` padding, no default shadow. Semantic color communicates valid direction/status only; accent is reserved for focus/selection/action.

## Business Priority

Keep exactly one score-free priority. Present level as text plus restrained semantic treatment, then title, concise reason, and explicit action. It is the widest executive fact and must not repeat in KPIs or the evidence column.

## Comparison and Data Quality

Period comparison is a compact four-measure divided row/footer using existing finite/unavailable semantics. Data Quality shows status, issue count, scope summary, and the existing disclosure; color is supplemental. Neither becomes a dashboard-style card stack.

## Responsive hierarchy

| Viewport | Required hierarchy |
| --- | --- |
| `1440×900` | Expanded/collapsed rail; executive `3/3/6`; five KPIs in one row; chart/context `8/4`; no document/main/Overview scroll. |
| `1280×768` | Same order and grid with compact heights/type; no vertical scroll or clipped chart. |
| `768px` | Drawer closed/open; executive facts stack; KPIs `2` columns then final full-width KPI; chart then context full width; natural page flow. |
| `375px` | Drawer closed/open; executive, KPIs, chart, comparison, Data Quality in one column; `220px` plot; no horizontal clipping. |

Light and Dark must preserve identical geometry, prominence, status meaning, and focus visibility.

## Stable ownership to preserve

Do not rename or duplicate: `dashboard`, `dashboardContent`, `dashboardTabList`, `dashboardPanelOverview`, `executiveSummarySection`, `executiveSummary`, `executiveAlertCard`, `businessPriorityRegion`, `businessPriorityHeading`, `businessPriorityLevel`, `priorityTitle`, `priorityReason`, `priorityMessage`, `businessOverview`, `periodComparisonSection`, `periodComparisonGrid`, `dataQualityInformation`, `dataQualityHeading`, `dataQualityStatusBadge`, `dataQualityIssueCount`, `dataQualityDetailsButton`, `dataQualityScopeSummary`, `dataQualityDetails`, `mainChartWrapper`, `revenueChart`, and `revenueChartSummary`.

Generated KPI markup remains owned by `businessOverview`; do not cache or assign permanent IDs to replaced children. Move owned regions through the existing guarded tab composition path and keep one chart instance.

## Screenshot approval gate

Before editing, capture production Overview using the same data/filter at `1440×900`, `1280×768`, `768px`, and `375px`, Light/Dark, with expanded/collapsed rail or closed/open drawer. After implementation, capture the identical 16 states. Review each pair against the [Overview checklist](../.codex/checklists/dashboard-overview.md). PASS requires every checklist item for every capture plus separate functional browser acceptance; otherwise record the failed item and corrective action.
