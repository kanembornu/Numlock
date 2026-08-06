# NUMLOCK project skills

`AGENTS.md` remains the highest-priority repository contract. Skills compress recurring rules; task-specific instructions still control scope and behavior. Use only skills materially relevant to the task: more skills are not automatically better, and unrelated skills waste context and may create conflicting ownership.

## Inventory and ownership

**Total: 19 project-local skills.**

| Skill | Primary ownership |
| --- | --- |
| `$numlock-development` | General implementation scope, repository safeguards, and behavior preservation. |
| `$numlock-testing` | Test owners, deterministic fixtures, runner semantics, and suite membership. |
| `$numlock-frontend` | Shared browser implementation, responsive UX, Tailwind, and frontend dependencies. |
| `$numlock-documentation` | `PROJECT_STATUS.md`, documentation ownership, evidence accuracy, and historical continuity. |
| `$numlock-appscript` | Apps Script V8, globals, HtmlService, services, quotas, and flat source compatibility. |
| `$numlock-validation` | Ordered local checks and exact local, live, and browser evidence classification. |
| `$numlock-performance` | Spreadsheet passes, cache reuse, DOM budgets, immutability, races, and deferred work. |
| `$numlock-release` | Semantic versions, release gates, deployment sequence, and production rollback. |
| `$numlock-dashboard` | Dashboard response, hierarchy, date scope, states, retry, and responsive shell. |
| `$numlock-analytics` | Aggregate Engine and deterministic summary, financial, trend, product, and expense outputs. |
| `$numlock-intelligence` | Revenue through Decision layers, thresholds, precedence, and intelligence compatibility. |
| `$numlock-chart` | Chart.js dependency, three renderers, lifecycle, formatting, summaries, and containment. |
| `$numlock-export` | Active-view CSV and Print Report boundaries and safety. |
| `$numlock-accessibility` | Semantics, ARIA, keyboard, focus, live regions, reduced motion, tables, and charts. |
| `$numlock-git` | Scoped review, explicit staging, commit boundaries, branches, remotes, and push safety. |
| `$numlock-clasp` | Protected script identity, clasp inventory, upload authorization, and evidence boundary. |
| `$numlock-ui` | Approved-reference fidelity, visual composition, theme parity, and screenshot acceptance. |
| `$numlock-refactor` | Evidence-based, behavior-preserving code and CSS restructuring. |
| `$numlock-regression` | Cross-feature acceptance matrices and exact evidence classification. |

## Skill-selection matrix

| Task type | Primary skill | Add when material |
| --- | --- | --- |
| General production or configuration change | `$numlock-development` | App Script, domain, testing, validation, documentation, clasp |
| Apps Script server/runtime change | `$numlock-appscript` | Development, domain, testing, validation |
| Test or suite change | `$numlock-testing` | Development, domain, validation, documentation |
| Validation or evidence audit | `$numlock-validation` | Testing, documentation, clasp, Git |
| Frontend or Tailwind change | `$numlock-frontend` | Dashboard, chart, export, accessibility, performance |
| Performance work | `$numlock-performance` | Development, frontend or analytics, testing, validation |
| Dashboard composition or state | `$numlock-dashboard` | Frontend, accessibility, testing, validation |
| Analytics calculation | `$numlock-analytics` | App Script, development, testing, validation |
| Intelligence or decision logic | `$numlock-intelligence` | Development, testing, validation, documentation |
| Chart work | `$numlock-chart` | Frontend, accessibility, testing, validation |
| CSV or print work | `$numlock-export` | Frontend, accessibility, testing, validation |
| Accessibility work | `$numlock-accessibility` | Frontend and the affected feature skill |
| Documentation-only audit | `$numlock-documentation` | Validation, Git |
| Release work | `$numlock-release` | Validation, documentation, Git, clasp |
| Git completion | `$numlock-git` | Validation, documentation or release |
| Clasp inventory or upload | `$numlock-clasp` | Validation, development or release |
| Visual reconstruction or fidelity review | `$numlock-ui` | Development, frontend, accessibility, testing, validation, regression |
| Behavior-preserving cleanup | `$numlock-refactor` | Development, domain owner, testing, validation, regression |
| Full cross-feature acceptance | `$numlock-regression` | Testing, validation, feature owners, clasp when upload is authorized |

## Recommended combinations

### Backend analytics

`$numlock-development`, `$numlock-appscript`, `$numlock-analytics`, `$numlock-testing`, `$numlock-validation`, `$numlock-documentation`, `$numlock-clasp`

### Intelligence

`$numlock-development`, `$numlock-intelligence`, `$numlock-testing`, `$numlock-validation`, `$numlock-documentation`, `$numlock-clasp`

### Frontend UX

`$numlock-development`, `$numlock-frontend`, `$numlock-dashboard`, `$numlock-accessibility`, `$numlock-testing`, `$numlock-validation`, `$numlock-documentation`, `$numlock-clasp`

### Charts

`$numlock-development`, `$numlock-frontend`, `$numlock-chart`, `$numlock-accessibility`, `$numlock-testing`, `$numlock-validation`, `$numlock-clasp`

### Export

`$numlock-development`, `$numlock-frontend`, `$numlock-export`, `$numlock-accessibility`, `$numlock-testing`, `$numlock-validation`, `$numlock-documentation`, `$numlock-clasp`

### Performance

`$numlock-development`, `$numlock-performance`, `$numlock-testing`, `$numlock-validation`, `$numlock-documentation`, `$numlock-clasp`

### Visual reconstruction

`$numlock-development`, `$numlock-frontend`, `$numlock-ui`, `$numlock-accessibility`, `$numlock-testing`, `$numlock-validation`, `$numlock-regression`, `$numlock-documentation`, `$numlock-clasp`

### Refactor

`$numlock-development`, `$numlock-refactor`, `$numlock-testing`, `$numlock-validation`, `$numlock-regression`, `$numlock-documentation`, `$numlock-clasp`

### Regression-only

`$numlock-regression`, `$numlock-testing`, `$numlock-validation`, `$numlock-clasp`

### Documentation-only

`$numlock-documentation`, `$numlock-validation`, `$numlock-git`

### Release

`$numlock-release`, `$numlock-validation`, `$numlock-documentation`, `$numlock-git`, `$numlock-clasp`

## Routing repeated instructions

| Repeated area | Primary owner |
| --- | --- |
| Clasp inventory and upload | `$numlock-clasp` |
| Git review, staging, commit, and push | `$numlock-git` |
| Test files, runner, and suite membership | `$numlock-testing` |
| Tailwind and shared frontend dependencies | `$numlock-frontend` |
| Accessibility | `$numlock-accessibility` |
| Aggregate analytics | `$numlock-analytics` |
| Release and rollback sequence | `$numlock-release` |
| CSV and print | `$numlock-export` |
| Chart rendering | `$numlock-chart` |
| Performance budgets and races | `$numlock-performance` |
| Current executive project status | `$numlock-documentation` via `docs/PROJECT_STATUS.md` |
| Visual reconstruction and reference fidelity | `$numlock-ui` |
| Behavior-preserving structural cleanup | `$numlock-refactor` |
| Full cross-feature acceptance | `$numlock-regression` |

Reference the owning skill instead of repeating its generic rules in another skill.

## Compact prompt templates

### Implementation

```text
Use:
- $<relevant-skills>

CURRENT TASK — <title>

Objective:
<unique objective>

Special requirements:
- <unique behavior only>

Acceptance:
- <unique checks only>
```

### Documentation audit

```text
Use:
- $numlock-documentation
- $numlock-validation
- $numlock-git

CURRENT TASK — <title>

Objective:
<documentation-specific objective>
```

## Discovery and safe updates

A new Codex session may be required before newly added project-local skills are discovered automatically. Keep every skill concise, lowercase and hyphenated, with only `name` and `description` in YAML frontmatter. Do not copy large context from `.ai/` or `docs/`, weaken `AGENTS.md`, or load unrelated skills.
