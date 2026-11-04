# NUMLOCK UI/UX 2.0 Information Architecture

## Package status and boundary

UI/UX 2.0 Package 001 is **discovery only**. It defines an evidence-based information architecture for later mockup comparison; it does not authorize or implement frontend, Tailwind, analytics, API, persistence, permission, schema, deployment, or data-access changes.

The authority baseline is the v1.0 production view in [`190.View.Index.html`](../190.View.Index.html), the current product and architecture documents, and the response ownership recorded in [Dashboard Consumer Inventory](DASHBOARD-CONSUMER-INVENTORY.md). The existing response remains complete and backward compatible. Analytics, Intelligence, Forecast, Performance, and Data Quality remain dashboard content because they already share one reporting scope and do not have independent workflows that justify separate destinations.

## Information-architecture principles

1. A primary destination must represent an existing, independently useful workflow—not a heading, dataset, or future promise.
2. Executive Summary remains first, followed by KPIs and reporting evidence, with one authoritative Business Priority in the first viewport.
3. One selected reporting period scopes all row-derived dashboard output and the bounded recent-transaction projection.
4. Progressive disclosure keeps explanations and diagnostics available without expanding the primary menu.
5. Desktop and mobile expose the same destinations and labels. Navigation changes layout, not meaning.
6. Print and CSV remain actions at the point where their scopes are visible; neither becomes a destination.
7. Future capabilities stay absent from navigation until their data, permissions, persistence, and usable page content exist.

## v1.0 capability inventory

Each current user-facing v1.0 capability appears exactly once below. `V01`–`V35` are the complete current capability set; `F01`–`F03` record blocked expansions and are not current menu entries.

| ID | Capability | Classification | UI/UX 2.0 placement and boundary |
| --- | --- | --- | --- |
| V01 | Dashboard overview | Primary destination | `Dashboard`; default entry and owner of the selected reporting period. |
| V02 | Recent Transactions view | Primary destination | `Transactions`; bounded evidence view, not a full ledger. |
| V03 | Reporting-period selection: Today, Last 7 Days, Current Month, Previous Month, Current Year, Custom | Contextual action | Dashboard page header; selection scopes all row-derived output. |
| V04 | Custom start/end validation | Contextual action | Revealed under Custom; inline error state remains associated with both controls. |
| V05 | Reporting scope, transaction count, latest-data date, and freshness status | Dashboard section | Compact dashboard context band directly after page controls. |
| V06 | Data Quality status, issue count, and scope summary | Dashboard section | Dashboard context band; remains observational and does not repair data. |
| V07 | Data Quality issue list | Disclosure/detail | In-place disclosure from V06 with user-facing labels and counts only. |
| V08 | Loading state | Dashboard section | Replaces/marks dashboard content while a request is active. |
| V09 | Empty-period state | Dashboard section | Dashboard status surface; defined only by zero scoped rows. |
| V10 | Error state and exact-request Retry | Contextual action | Dashboard status surface; retry preserves the last filter/custom-date tuple. |
| V11 | Executive performance summary | Dashboard section | First-viewport Executive Summary. |
| V12 | Attention status | Dashboard section | First-viewport Executive Summary; distinct from Data Quality. |
| V13 | Authoritative Business Priority with evidence | Dashboard section | First-viewport Executive Summary; the single primary next action. |
| V14 | Period-over-period comparison | Dashboard section | Executive Summary supporting evidence. |
| V15 | Financial KPIs: Revenue, Expense, Profit | Dashboard section | Key Metrics; each value can open bounded transaction evidence. |
| V16 | Sales KPIs: Units Sold, Revenue per Cup, Profit Margin | Dashboard section | Key Metrics; each value can open bounded transaction evidence. |
| V17 | Product KPIs: Best Seller and Top Revenue product | Dashboard section | Key Metrics; each value can open bounded Sales evidence. |
| V18 | Business Health score and status | Dashboard section | Key Metrics; text accompanies color. |
| V19 | Revenue Trend chart and accessible summary | Dashboard section | Dashboard Analytics section; chart point or labeled action can open bounded evidence. |
| V20 | Product Distribution Hot/Cold chart and accessible summary | Dashboard section | Dashboard Analytics section; remains summary evidence because recent rows do not expose Hot/Cold classification. |
| V21 | Top Products ranking | Dashboard section | Dashboard Analytics section. |
| V22 | Expense Breakdown chart and accessible summary | Dashboard section | Dashboard Analytics section; category point or labeled action can open bounded evidence. |
| V23 | Business Signals diagnosis | Dashboard section | Secondary `Intelligence and actions` section. |
| V24 | Revenue, expense, profit, and next-month forecast facts | Dashboard section | Secondary `Performance detail` section; Forecast is not a destination. |
| V25 | System-defined KPI target reference | Disclosure/detail | Closed disclosure within Performance detail; no edit affordance. |
| V26 | Prioritized recommended actions | Dashboard section | Secondary `Intelligence and actions` section. |
| V27 | Business Focus | Dashboard section | Secondary `Planning detail` section. |
| V28 | KPI Achievement | Dashboard section | Secondary `Planning detail` section. |
| V29 | Business Maturity | Dashboard section | Secondary `Planning detail` section. |
| V30 | 30-day Action Roadmap | Dashboard section | Secondary `Planning detail` section. |
| V31 | Risk Status and Growth Opportunity | Dashboard section | Secondary `Risk and opportunity` section. |
| V32 | Revenue Dependency and Pareto Analysis | Dashboard section | Secondary `Product concentration` section. |
| V33 | KPI/chart-to-transaction drill-down and clear/reset | Disclosure/detail | Cross-destination detail flow into the existing bounded Transactions view. |
| V34 | Print active executive report | Report/export action | Dashboard header action; browser-native output of the active rendered dashboard only. |
| V35 | Export visible transaction rows to CSV | Report/export action | Transactions page action; exports visible rows/columns, including active drill-down scope. |
| F01 | Editable KPI targets / Settings controls | Future/blocked capability | No menu entry; blocked by persistence, validation, permissions, migration, governance, and target semantics. |
| F02 | Expanded transaction history/detail | Future/blocked capability | No menu entry; blocked by authorization, privacy, pagination, and approved detail fields. |
| F03 | Dashboard payload projection | Future/blocked capability | No menu entry; an API concern blocked by external-consumer, permission, measurement, compatibility, and rollback evidence. |

Inventory rule for later packages: mockups must map every `V` identifier once and must not present any `F` identifier as available functionality.

## Navigation models compared

| Model | User benefit | Cognitive load | Mobile behavior | Implementation impact | Future extensibility | Empty/unnecessary-menu risk |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Dashboard + Transactions | Matches the two existing workflows; fastest route from health summary to bounded evidence | Lowest: two stable choices and no distinction between a report page and its source | Two-item drawer or compact navigation; predictable focus order and large targets | Lowest; preserves existing page ownership and drill-down target | Add a destination later only after it has real page content and an independent workflow | Low; both destinations are populated today |
| 2. Dashboard + Transactions + Reports | Makes reporting appear prominent | Medium: users must decide between the live Dashboard, Transactions, and a Reports page even though output starts from the first two | Three-item drawer remains workable, but `Reports` would lead to a thin choice screen or duplicate actions | Medium: requires a new page shell, routing, action relocation/duplication, and scope explanation | Could host future saved/scheduled reports, but none exist | High now; print and CSV have different source scopes and no standalone report library |
| 3. Dashboard + Transactions + Reports + Settings | Suggests a conventional application structure and a future governance area | Highest: four choices imply capabilities and administration that do not exist | Four-item drawer is still physically viable but adds dead-end choices and longer keyboard traversal | Highest; requires two new page shells and risks implying editable configuration | Highest theoretical capacity | Critical now; Reports has no independent content and Settings has no approved editable control or persistence contract |

## Authoritative menu structure

Use Model 1 immediately:

1. **Dashboard** — default destination for business health, analytics, intelligence, Data Quality, actions, and print.
2. **Transactions** — existing recent-transaction evidence destination for direct inspection, drill-down results, reset, and visible-row CSV.

Do not add Analytics, Intelligence, Forecast, Performance, Data Quality, Reports, or Settings to the primary menu. In-page section navigation may be evaluated in later mockups as a non-authoritative convenience, but it must not make sections look like separate products or create duplicate page state.

## Page and section hierarchy

### Dashboard

**Page header**

- Page identity and concise purpose.
- Reporting-period control and Custom dates when selected.
- Primary page action: Print Report.
- Scope/freshness context followed by Data Quality status and disclosure.

**First viewport**

1. Executive Summary: performance, attention status, one Business Priority, and period comparison.
2. Key Metrics: Financial, Sales Performance, Product Performance, and Business Health.

The first viewport must not repeat the same executive conclusion. At narrow widths, it is acceptable for Key Metrics to begin below the fold; semantic order stays unchanged.

**Secondary content**

1. Analytics: Revenue Trend, Product Distribution, Top Products, Expense Breakdown.
2. Intelligence and actions: Business Signals, Performance Detail including Forecast, system-defined Target Reference disclosure, Recommended Actions.
3. Planning detail: Business Focus, KPI Achievement, Business Maturity, 30-day Action Roadmap.
4. Risk and opportunity: Risk Status, Growth Opportunity.
5. Product concentration: Revenue Dependency, Pareto Analysis.

### Transactions

1. Page header: `Recent Transactions`, active reporting-scope context, and Export CSV action.
2. Active drill-down summary, match count, explicit maximum-ten-row evidence boundary, and `Show all recent` action when applicable.
3. Horizontally contained five-column table: Date, Type, Item, Qty, Amount.
4. Empty-table message when the current visible scope has no rows.

Transactions does not gain independent server filtering, search, sort, pagination, edit, create, delete, or expanded history in this architecture package.

## Contextual actions and detail flow

- **Print Report** belongs in the Dashboard page header because it prints the active rendered executive report. It is enabled only after Dashboard success.
- **Export CSV** belongs in the Transactions page header because its authoritative source is the visible transaction table. It is enabled only when visible rows exist.
- **View transactions** belongs beside or within supported KPI/chart summaries. Canvas point interaction may remain an additional pointer path, never the only path.
- **Details / View targets** remain local disclosures with synchronized expanded state; closing or navigating away must exclude hidden content from focus.
- **Retry** remains in the error surface and repeats the exact last request.

Transaction-detail flow:

1. The user activates a labeled KPI/chart evidence action from Dashboard.
2. The UI filters a copy of the already-loaded, active-period maximum-ten-row `recentTransactions` collection.
3. The Transactions destination opens, its heading receives focus, and a polite status identifies the evidence label and match count.
4. The same five-column table shows only matching rows; Export CSV now exports that visible result.
5. `Show all recent` clears the drill-down, restores all loaded recent rows, updates the status, and returns focus to the Transactions heading.
6. Returning to Dashboard preserves the active reporting period. No expanded history or hidden fields are implied.

## Desktop and mobile navigation behavior

### Desktop

- Persistent primary navigation contains Dashboard and Transactions only.
- Active destination uses text plus `aria-current="page"`; color is supplemental.
- Main content has one `main` landmark and one page-level heading for the active destination.
- Page actions stay with their source page instead of in global navigation.

### Mobile and narrow widths

- Use the same two-item navigation in an overlay drawer or equivalently compact accessible pattern; no mobile-only destinations.
- A real Menu button exposes expanded state and controls the navigation container.
- Escape, close control, backdrop activation, and destination selection close the drawer; focus returns to the opener except when destination navigation intentionally moves focus to the new page heading.
- Closed navigation and inactive pages remain hidden from keyboard and assistive-technology traversal; body scroll is locked only while the overlay is open.
- Controls stack or wrap without changing reading order. The transaction table scrolls within its labeled container rather than widening the page.
- Reduced-motion preference disables authored navigation and chart motion without suppressing state changes.

## User journeys

| Journey | Traceable path through current capabilities | Successful outcome |
| --- | --- | --- |
| Daily business health check | Dashboard (V01) → reporting context (V05) → Executive Summary (V11–V14) → Key Metrics (V15–V18) | User identifies performance, attention, priority, comparison, and core health without scanning secondary detail. |
| Investigate revenue/expense change | Period selector (V03–V04) → comparison (V14) → Revenue Trend or Expense Breakdown (V19/V22) → bounded drill-down (V33) → Transactions (V02) | User moves from change signal to available supporting recent rows while retaining the period and seeing the evidence bound. |
| Inspect transactions | Transactions (V02) → recent table → optional clear/reset in V33 | User reviews the active period's available recent rows and can distinguish direct navigation from a filtered drill-down. |
| Print executive report | Dashboard period (V03) → successful executive content → Print Report (V34) | User opens browser print for the active rendered report with period/generated/version context and no inactive navigation or disclosure content. |
| Export visible transactions | Transactions (V02) → optional drill-down (V33) → Export CSV (V35) | User downloads exactly the visible five-column rows in displayed order, with the existing CSV safety behavior. |
| Review data-quality issues | Dashboard reporting context (V05) → Data Quality summary (V06) → issue disclosure (V07) → related Business Priority when selected (V13) | User sees status, counts, scope, and issue types without raw values, row identities, repair controls, or a misleading separate Data Quality application. |

## Deferred menu decisions

### Reports: deferred

Reports does not exist as an immediate destination. The current outputs are two contextual actions with different sources: Dashboard print uses the rendered executive view, while CSV uses visible Transaction rows. A Reports destination becomes eligible only when at least one independent report workflow exists, such as a report library, saved report definition, scheduled delivery, or a cross-report history with approved permissions and persistence. Until then, a menu would be placeholder-only or duplicate existing actions.

### Settings: deferred

Settings does not exist as an immediate destination. The only visible target metadata is system-defined and explicitly non-editable. A Settings destination becomes eligible only after an approved settings capability has persistence ownership, validation, permission/role boundaries, migration/default semantics, audit expectations, and enough usable content to justify a page. Version information may remain navigation chrome; it is not a setting.

## Mockup comparison contract

Later mockup packages must compare alternatives against this baseline:

- exactly two immediate primary destinations;
- capability IDs `V01`–`V35` each represented once and `F01`–`F03` unavailable;
- Executive Summary before KPIs and secondary content;
- shared reporting-period scope and bounded transaction-detail flow;
- print on Dashboard and CSV on Transactions;
- equivalent desktop/mobile destination semantics;
- keyboard, focus, live-region, table, chart-summary, non-color, and reduced-motion requirements; and
- no new menu justified solely by visual balance.

