# Reference Parity Inventory

This inventory records the disposition of every file found under the reference repository's `docs/`, `.ai/`, and `.vscode/` directories. “Adaptable” means its useful purpose is represented by NUMLOCK-specific content rather than copied business details.

## Documentation

| Reference file | Classification | NUMLOCK equivalent or exclusion reason |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | Applicable | `docs/ARCHITECTURE.md` documents the current monolith, target numbered architecture, and dependency direction. |
| `docs/DEPLOYMENT.md` | Adaptable | `docs/DEPLOYMENT.md` documents NUMLOCK upload, live-test, version, deployment, and browser gates. |
| `docs/DEVELOPMENT.md` | Adaptable | `docs/DEVELOPMENT-WORKFLOW.md` documents the actual VS Code, Codex, Git, and clasp loop. |
| `docs/FILE_NUMBERING.md` | Adaptable | Numbering policy is scoped to the approved target in `docs/ARCHITECTURE.md` and `docs/SOURCE-MIGRATION.md`; a second policy file would duplicate ownership. |
| `docs/FUTURE_ROADMAP.md` | Not applicable | It describes unrelated post-release business modules. NUMLOCK-approved future work is limited to `docs/ROADMAP.md`. |
| `docs/MAINTENANCE.md` | Not applicable | NUMLOCK has no seed, repair, reset, schema-migration, or maintenance entry points. Creating procedures for nonexistent tools would be misleading. |
| `docs/PROJECT_HISTORY.md` | Adaptable | Verified milestones are recorded in `docs/CHANGELOG.md`, `docs/ROADMAP.md`, and `docs/DECISIONS.md`; unrelated product history is excluded. |
| `docs/RELEASE.md` | Not applicable | NUMLOCK has no canonical `VERSION`, release metadata, tag policy, or established release automation. Git and deployment procedures are documented without inventing a release system. |
| `docs/ROADMAP.md` | Applicable | `docs/ROADMAP.md` records Sprint 5.5, Sprint 5.6 migrations, live tests, and decomposition next steps. |
| `docs/TESTING_AND_ACCEPTANCE.md` | Adaptable | `docs/TESTING.md` documents NUMLOCK's seven safe live functions and evidence levels. |

## AI context

| Reference file | Classification | NUMLOCK equivalent or exclusion reason |
| --- | --- | --- |
| `.ai/PROJECT_RULES.md` | Applicable | `.ai/PROJECT_RULES.md` routes Codex to the operating contract and project documents. |
| `.ai/TASK_TEMPLATE.md` | Applicable | `.ai/TASK_TEMPLATE.md` provides scoped NUMLOCK task framing. |
| `.ai/REVIEW_TEMPLATE.md` | Applicable | `.ai/REVIEW_TEMPLATE.md` separates static, runtime, deployment, and browser evidence. |
| `.ai/MODULE_TEMPLATE.md` | Adaptable | `.ai/MODULE_TEMPLATE.md` is adapted for numbered NUMLOCK source ownership rather than unrelated business modules. |
| — | NUMLOCK addition | `.ai/PROJECT_CONTEXT.md` provides concise continuity without duplicating `AGENTS.md`. |

## VS Code

| Reference file | Classification | NUMLOCK equivalent or exclusion reason |
| --- | --- | --- |
| `.vscode/settings.json` | Applicable | Existing NUMLOCK settings preserve formatting, ESLint, spell checking, and Apps Script-friendly whitespace. |
| `.vscode/extensions.json` | Applicable | Existing recommendations are generic and useful. |
| `.vscode/tasks.json` | Adaptable | Existing clasp push/pull tasks are preserved; `clasp status` is added as the required pre-upload inventory gate. |
| `.vscode/launch.json` | Not applicable | The reference contains no configurations; an empty file adds no NUMLOCK capability. |
| `.vscode/.vscode` | Not applicable | An anomalous nested duplicate, not valid configuration ownership. |

## Workspace

`Numlock.code-workspace` owns the root folder reference and editor font size. Folder-level `.vscode` files own shared repository settings and tasks. This separation contains no duplicate setting ownership requiring removal.
