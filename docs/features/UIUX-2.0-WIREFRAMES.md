# NUMLOCK UI/UX 2.0 Low-Fidelity Wireframes

## Package status and boundary

UI/UX 2.0 Package 002 is **discovery only**. These structured Markdown/ASCII wireframes translate the approved [Information Architecture](UIUX-2.0-INFORMATION-ARCHITECTURE.md) into implementation-neutral screen structure for later high-fidelity comparison. They do not authorize or implement frontend, Tailwind, analytics, API, spreadsheet, permission, schema, persistence, deployment, or data-access changes.

The wireframes use only the current v1.0 capability inventory `V01`–`V35`. Bracketed identifiers map each block to that inventory. `F01`–`F03` remain unavailable. Boxes show hierarchy and approximate grouping, not color, type, spacing, component styling, breakpoints, or production markup.

## Shared shell and state contract

- Primary navigation contains exactly `Dashboard` [V01] and `Transactions` [V02]. Desktop uses persistent navigation; mobile uses an accessible overlay drawer with the same labels and order.
- Dashboard owns the reporting period [V03–V04], active scope/freshness [V05], Data Quality [V06–V07], and Print Report [V34]. Transactions owns bounded recent evidence [V02, V33] and Export CSV [V35].
- Loading, empty, error, and retry are page states, not destinations [V08–V10]. Dashboard empty is defined only by zero scoped transaction rows. Transactions can also show an empty table within a successful Dashboard scope.
- The selected reporting period persists when moving between destinations. A drill-down filters only a copy of the active response's maximum-ten-row `recentTransactions`; it does not fetch or imply a complete ledger [V33].
- Semantic order is stable across widths. Responsive changes alter columns, wrapping, containment, and navigation presentation—not destination meaning or reading order.

## Dashboard layout variants

### Variant A — Executive-first

```text
HEADER + PERIOD + PRINT
SCOPE / FRESHNESS / DATA QUALITY
EXECUTIVE SUMMARY
  Performance | Attention | BUSINESS PRIORITY
  Period comparison
KEY METRICS
ANALYTICS / CHARTS
INTELLIGENCE + SUPPORTING SECTIONS
```

The first viewport answers: How are we performing? What needs attention? What should happen next? It then exposes core KPI evidence before deeper analysis. This preserves the approved hierarchy and current executive-scanning journey [V03–V18].

### Variant B — Analytical-first

```text
HEADER + PERIOD + PRINT
SCOPE / FRESHNESS / DATA QUALITY
KEY METRICS
REVENUE TREND + ANALYTICS
EXECUTIVE SUMMARY
  Performance | Attention | BUSINESS PRIORITY
  Period comparison
INTELLIGENCE + SUPPORTING SECTIONS
```

The first viewport emphasizes metric and trend inspection [V15–V22], but pushes the synthesized conclusion and authoritative next action [V11–V14] below analytical evidence.

### Comparison and recommendation

| Criterion | Variant A: Executive-first | Variant B: Analytical-first |
| --- | --- | --- |
| Existing v1.0 mapping | Directly preserves Executive Summary before KPIs and reporting evidence | Uses current content but changes its decision sequence |
| First-viewport task | Fast health, attention, priority, and comparison scan | Fast metric/trend inspection |
| Business Priority | Prominent once, beside its reason and evidence | Delayed below KPIs/charts |
| Cognitive path | Conclusion → key evidence → deeper analysis | Evidence → analysis → conclusion |
| Mobile consequence | Priority remains early; KPIs may begin below fold | Summary and priority can fall several screens below fold |
| Accessibility consequence | Heading/reading order matches the approved semantic hierarchy | Visually elevating analytics would also require a less direct semantic order |
| Discovery risk | Lowest; aligns with Package 001 and current dashboard ownership | Higher; conflicts with the approved executive-first constraint |

**Recommendation: advance Variant A, Executive-first, to high-fidelity mockups.** It best supports the daily business-health journey, preserves one authoritative first-viewport Business Priority, and maintains the approved semantic sequence. Variant B should remain a documented comparison only; it is not recommended for the next package.

## Screen 1 — Dashboard desktop

Recommended Variant A at desktop width:

```text
+----------------------+------------------------------------------------------+
| NUMLOCK              | Dashboard                                   [V01]   |
|                      | Business performance, attention, next actions         |
| > Dashboard          | [Reporting period v] [Custom dates*] [Print Report]  |
|   Transactions       |                                           [V03,V04,V34]|
|                      +------------------------------------------------------+
|                      | Period | row count | latest data | freshness [V05]    |
| Version              | Data Quality status | issues | [Details] [V06,V07]  |
+----------------------+------------------------------------------------------+
|                      | STATE SURFACE: loading / empty / error + Retry        |
|                      |                                      [V08,V09,V10]   |
|                      +------------------------------------------------------+
|                      | EXECUTIVE SUMMARY [V11,V12,V13,V14]                  |
|                      | +-------------+-------------+----------------------+  |
|                      | | Performance | Attention   | BUSINESS PRIORITY    |  |
|                      | +-------------+-------------+----------------------+  |
|                      | | Period comparison: Revenue | Expense | Profit | ...|  |
|                      | +--------------------------------------------------+  |
|                      +------------------------------------------------------+
|                      | KEY METRICS [V15,V16,V17,V18]                        |
|                      | [Financial] [Sales] [Product] [Business Health]       |
|                      +================ END OF TARGET FIRST VIEWPORT =========+
|                      | ANALYTICS [V19,V20,V21,V22]                          |
|                      | +--------------------------+-----------------------+  |
|                      | | Revenue Trend + summary  | Product Distribution  |  |
|                      | | [View transactions]      | + summary + evidence  |  |
|                      | +--------------------------+-----------------------+  |
|                      | | Top Products             | Expense Breakdown     |  |
|                      | | ranking                  | + summary + evidence  |  |
|                      | +--------------------------+-----------------------+  |
|                      +------------------------------------------------------+
|                      | INTELLIGENCE AND ACTIONS [V23,V24,V25,V26]           |
|                      | [Business Signals] [Performance + Forecast + Targets]|
|                      | [Recommended Actions]                                |
|                      +------------------------------------------------------+
|                      | PLANNING DETAIL [V27,V28,V29,V30]                    |
|                      | [Focus] [KPI Achievement] [Maturity] [30-day Roadmap]|
|                      +------------------------------------------------------+
|                      | RISK AND OPPORTUNITY [V31]                           |
|                      | [Risk Status] [Growth Opportunity]                    |
|                      +------------------------------------------------------+
|                      | PRODUCT CONCENTRATION [V32]                          |
|                      | [Revenue Dependency] [Pareto Analysis]                |
+----------------------+------------------------------------------------------+
* Custom dates appear only when Custom is selected.
```

### Content order

1. Persistent two-item navigation and Dashboard page header [V01–V04, V34].
2. Reporting context and Data Quality summary/disclosure [V05–V07].
3. Dashboard state surface [V08–V10].
4. Executive Summary: performance, attention, Business Priority, comparison [V11–V14].
5. Key Metrics: financial, sales, product, Business Health [V15–V18].
6. Analytics: Revenue Trend, Product Distribution, Top Products, Expense Breakdown [V19–V22].
7. Intelligence/actions and Performance detail, including Forecast and closed Target Reference [V23–V26].
8. Planning, risk/opportunity, and product concentration [V27–V32].

### Responsive behavior

- Navigation stays persistent only at the desktop shell width. Main content uses available width without horizontal page overflow.
- Executive cards can form three columns; Business Priority remains in the same semantic position. KPI groups can form four columns.
- Revenue Trend receives the wider analytical column; other analytics use two- or three-column composition without changing reading order.
- Header controls wrap when needed. Custom dates remain associated with the period selector and validation message.

### Interaction notes

- Period changes refresh all row-derived Dashboard output together. Invalid Custom dates show inline validation associated with both date inputs [V03–V04].
- Print Report is enabled only after successful Dashboard content is available and prints the active rendered executive report [V34].
- Data Quality and Target Reference are local disclosures; neither navigates to a new page or offers repair/edit controls [V07, V25].
- Supported KPI/chart evidence actions open Transactions, preserve the period, and apply only bounded loaded-row evidence [V33]. Canvas points may supplement, but never replace, labeled actions.

### Accessibility notes

- One `main`, one Dashboard `h1`, ordered section headings, and a labeled primary navigation. Active navigation uses `aria-current="page"` plus visible text, not color alone.
- Period controls have persistent labels; Custom validation is programmatically associated, concise, and politely announced.
- Loading uses synchronized busy state. Empty/error announcements are bounded; Retry is keyboard reachable and duplicates are blocked.
- Chart canvases are supplementary. Each chart retains a text summary, explicit empty/unavailable text, labeled evidence action, and reduced-motion behavior.
- Disclosure buttons synchronize expanded state; closed content is hidden from focus and assistive-technology traversal.

### Intentionally omitted

- Reports and Settings destinations; editable targets; Data Quality repair; separate Analytics, Intelligence, Forecast, or Performance navigation.
- Full transaction ledger, search, sort, pagination, edit/create/delete, hidden transaction fields, or new server requests.
- Visual styling, tokens, exact dimensions, icons, chart treatments, and production component decisions.

## Screen 2 — Dashboard mobile

Recommended Variant A at narrow width:

```text
+----------------------------------+
| [Menu]                           |
| Dashboard                  [V01] |
| Business performance...          |
| [Reporting period            v]  |
| [Start date]* [End date]*        |
| [Print Report]             [V34] |
+----------------------------------+
| Period / rows / latest / status  |
| Data Quality | issues | [Details]|
|                         [V05-V07]|
+----------------------------------+
| STATE: loading / empty / error   |
| [Retry]                 [V08-V10]|
+----------------------------------+
| EXECUTIVE SUMMARY                |
| [Performance]              [V11] |
| [Attention]                [V12] |
| [BUSINESS PRIORITY]        [V13] |
| [Period comparison: stacked]     |
|                            [V14] |
+==================================+  target first-viewport sequence;
| KEY METRICS                      |  cards may begin below physical fold
| [Financial]               [V15]  |
| [Sales]                   [V16]  |
| [Product]                 [V17]  |
| [Business Health]         [V18]  |
+----------------------------------+
| ANALYTICS                        |
| [Revenue Trend + text summary]   |
| [View transactions]       [V19]  |
| [Product Distribution + summary]|
| [View transactions]       [V20]  |
| [Top Products]            [V21]  |
| [Expense Breakdown + summary]    |
| [View transactions]       [V22]  |
+----------------------------------+
| [Business Signals]        [V23]  |
| [Performance + Forecast]  [V24]  |
| [View targets disclosure] [V25]  |
| [Recommended Actions]     [V26]  |
| [Planning Detail]      [V27-V30] |
| [Risk and Opportunity]    [V31]  |
| [Product Concentration]   [V32]  |
+----------------------------------+

Menu open:
+--------------------------+--------+
| NUMLOCK          [Close] | dimmed |
| > Dashboard              | page   |
|   Transactions           |        |
| Version                  |        |
+--------------------------+--------+
```

### Content order

The mobile reading order is exactly the desktop content order. Executive Summary remains before Key Metrics; the physical viewport may end before all KPI cards, but the Business Priority is never displaced below analytics.

### Responsive behavior

- The persistent desktop navigation becomes an overlay drawer. It contains only Dashboard and Transactions in the same order.
- Header controls, context metadata, Executive Summary cards, comparisons, KPIs, analytics, and secondary sections form one column. Controls remain full-width or wrap without reordering.
- Chart containers use bounded responsive height. Text summaries precede or directly accompany charts.
- No dashboard block causes horizontal page scrolling.

### Interaction notes

- Menu opens from a real button; Close, Escape, backdrop, or destination selection closes it. Selecting Transactions moves focus to its page heading.
- Period and Custom date behavior is identical to desktop. Print remains on Dashboard; there is no mobile-only export menu.
- Evidence actions navigate to Transactions and announce the bounded match result. Returning preserves the selected reporting period.

### Accessibility notes

- The drawer synchronizes expanded/hidden state, traps or appropriately contains focus while open, locks body scroll only while open, and restores focus to Menu unless destination navigation intentionally focuses the new `h1`.
- Closed navigation and inactive pages are excluded from keyboard and accessibility traversal.
- All targets remain comfortably operable at narrow width; visible focus is never clipped by cards or the viewport.
- Reading, focus, and announcement order follows the single-column visual order. Reduced motion suppresses authored drawer/chart animation without hiding state changes.

### Intentionally omitted

- Bottom navigation, mobile-only destinations/actions, horizontally swipeable KPI carousels, gesture-only chart controls, condensed unlabeled icons, and duplicated executive conclusions.
- All deferred capabilities and visual-design decisions listed for Dashboard desktop.

## Screen 3 — Transactions desktop

```text
+----------------------+------------------------------------------------------+
| NUMLOCK              | Recent Transactions                         [V02]   |
|                      | Bounded recent evidence for: [active period]          |
|   Dashboard          |                                      [Export CSV]    |
| > Transactions       |                                           [V05,V35]  |
|                      +------------------------------------------------------+
|                      | DRILL-DOWN SUMMARY (when active)              [V33]  |
| Version              | Evidence: Revenue transactions | N matches           |
+----------------------+ Maximum 10 recent rows | [Show all recent]           |
|                      +------------------------------------------------------+
|                      | TABLE STATUS / EMPTY MESSAGE                          |
|                      +------------------------------------------------------+
|                      | +--------------------------------------------------+ |
|                      | | Date | Type | Item | Qty | Amount                 | |
|                      | | row                                            | |
|                      | | ... maximum loaded recent evidence ...         | |
|                      | +--------------------------------------------------+ |
|                      | Five visible columns; horizontal containment if needed|
+----------------------+------------------------------------------------------+
```

### Content order

1. Persistent navigation and Transactions page header [V01–V02].
2. Active reporting-period context and Export CSV [V05, V35].
3. Conditional drill-down label, match count, explicit maximum-ten-row boundary, and Show all recent [V33].
4. Five-column recent-transactions table or its local empty message [V02, V33].

### Responsive behavior

- Desktop retains persistent navigation. The table uses the main content width and remains inside a labeled horizontal-scroll container if columns cannot fit.
- Page title/context and Export CSV share the header when space permits; the action wraps without detaching from Transactions.
- Drill-down summary text and Show all recent can wrap while preserving text-before-action reading order.

### Interaction notes

- Direct navigation shows all already-loaded recent rows for the active period. Drill-down navigation shows only matching rows from that same maximum-ten-row collection [V33].
- Export CSV is enabled only when visible rows exist and exports exactly the five visible columns and current visible order, including an active drill-down [V35].
- Show all recent clears only the client-side drill-down, announces the update, and returns focus to the Transactions heading. It does not change the Dashboard period.
- Transactions does not own an independent reporting-period selector; scope returns to the Dashboard owner.

### Accessibility notes

- Transactions has one focusable page `h1`; destination navigation and drill-down transfer focus to it.
- Drill-down status is a bounded polite announcement containing the evidence label and match count. Show all recent is a native keyboard-operable button.
- The table has a descriptive caption, scoped column headers, and meaningful cell text. Status is not conveyed by color alone.
- The scroll container is labeled and keyboard reachable only when overflow interaction requires it; focus indication remains visible.

### Intentionally omitted

- Independent date filter, global search, type filter, sorting, pagination, row selection, details, edit/create/delete, expanded history, or hidden fields.
- Print Report, because printing belongs to the Dashboard's active executive report.
- Reports or Settings navigation and all visual-design decisions.

## Screen 4 — Transactions mobile

```text
+----------------------------------+
| [Menu]                           |
| Recent Transactions        [V02] |
| Active period / bounded evidence |
| [Export CSV]               [V35] |
+----------------------------------+
| DRILL-DOWN (when active)   [V33] |
| Revenue transactions             |
| N matches of max 10 recent rows  |
| [Show all recent]                |
+----------------------------------+
| TABLE STATUS / EMPTY MESSAGE     |
+----------------------------------+
| Scrollable region:               |
| +----------------------------------------------+
| | Date | Type | Item | Qty | Amount            |
| | ... swipe/scroll horizontally within table ...|
| +----------------------------------------------+
| Page itself does not scroll horizontally.       |
+----------------------------------+
```

### Content order

The mobile order matches Transactions desktop: Menu, heading/scope, Export CSV, conditional drill-down summary/reset, then the table or local empty message.

### Responsive behavior

- The shared overlay drawer replaces persistent navigation and retains the same close/focus behavior as Dashboard mobile.
- Header text and Export CSV stack. The action stays near the visible-row scope it exports.
- The five-column table is not converted into cards and no columns are removed. It scrolls horizontally inside a labeled container while the page width remains stable.
- Drill-down content stacks with a full-width or naturally sized Show all recent control.

### Interaction notes

- Export, drill-down, reset, period persistence, and maximum-ten-row behavior are identical to desktop.
- Horizontal table scrolling is an enhancement to access all five columns, never the only way to discover the table's purpose or state.
- An empty visible result disables Export CSV and retains the drill-down explanation plus a clear route back to all recent rows.

### Accessibility notes

- Menu/drawer semantics, focus restoration, hidden-state exclusion, and reduced-motion behavior match Dashboard mobile.
- The table caption and column headers remain available to assistive technology; responsive containment does not replace semantic table structure.
- The overflow region has an accessible name and visible keyboard focus. Touch scrolling does not require a precision gesture.
- Empty/result updates use one concise polite announcement; they do not repeatedly announce every row.

### Intentionally omitted

- Collapsed transaction cards, column hiding, gesture-only navigation, mobile-only filters/actions, and every desktop omission.

## State wireframes

These states apply without creating additional screens or destinations:

```text
LOADING [V08]
[Page header and controls remain identifiable]
[Status: Loading dashboard data...]
[Content marked busy; duplicate requests blocked; stale callbacks ignored]

EMPTY PERIOD [V09]
[No transactions found for <active period>]
[Period controls remain available]
[Dashboard analytics content does not redefine emptiness]

ERROR [V10]
[Dashboard data could not be loaded]
[Retry]
[Retry repeats exact last filter/custom start/custom end request]

TRANSACTIONS EMPTY WITH DASHBOARD SUCCESS [V02,V33,V35]
[No recent transactions match this visible scope]
[Export CSV disabled]
[Show all recent remains available when a drill-down is active]

CHART EMPTY / UNAVAILABLE [V19,V20,V22]
[Chart title]
[Truthful text summary or explicit empty/unavailable message]
[No false dashboard-empty claim]
```

State messages use text in addition to any icon/color. Retry, disclosure, reset, navigation, and evidence controls retain visible focus and native keyboard activation. Loading and result announcements are atomic and bounded; hidden or replaced state content is removed from focus order.

## Capability traceability

| Wireframe block | Current capability IDs |
| --- | --- |
| Destinations and navigation | V01–V02 |
| Reporting/date controls and validation | V03–V04 |
| Reporting context and Data Quality | V05–V07 |
| Loading, empty, error, exact-request Retry | V08–V10 |
| Executive Summary, attention, Business Priority, comparison | V11–V14 |
| Financial, sales, product, and Business Health KPIs | V15–V18 |
| Revenue, Hot/Cold, Top Products, and Expense analytics | V19–V22 |
| Signals, Performance/Forecast, Target Reference, actions | V23–V26 |
| Planning detail | V27–V30 |
| Risk/opportunity and product concentration | V31–V32 |
| Bounded transaction drill-down/reset | V33 |
| Dashboard Print Report | V34 |
| Transactions visible-row CSV | V35 |

Every current capability is represented; no block requires a future/blocked capability.

## Deferred beyond Package 002

- High-fidelity visual direction, design tokens, component specifications, chart styling, motion values, exact breakpoints, production markup, and usability-test artifacts.
- Reports and Settings pages; editable KPI targets; saved/scheduled reports; expanded transactions; payload projection; new filters, data, APIs, permissions, persistence, schemas, or spreadsheet behavior.
- Implementation planning, source/Tailwind changes, browser acceptance, upload, deployment, and release promotion.
