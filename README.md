# NUMLOCK

NUMLOCK is a coffee-shop business-intelligence dashboard built with Google Apps Script and Google Sheets. It reads transaction and price data, processes normalized rows, builds a shared analytics aggregate, derives dashboard intelligence, and serves an HTML dashboard through an Apps Script web app.

## Repository structure

The application uses the completed numbered, flat Apps Script layout:

- `10.Config.js`: authoritative release and version metadata.
- `20`–`25`: spreadsheet reads and transaction processing.
- `30`–`55`: aggregate, financial, summary, trend, product, and expense analytics.
- `60`–`85`: revenue, profit, score, diagnosis, recommendation, and decision intelligence.
- `90.Dashboard.Service.js`: cache orchestration and dashboard response composition.
- `95.Tests.js`: migration and backend test entry points.
- `100.Code.js`: the `doGet()` web entry point.
- `190.View.Index.html`: dashboard UI and browser runtime.

The ownership model and completed function migration map are documented in [Architecture](docs/ARCHITECTURE.md) and [Source Migration](docs/SOURCE-MIGRATION.md).

The numbered architecture is frozen as the verified production structure. It has passed local source checks, Apps Script backend validation, deployment, and browser rendering verification. Future changes must preserve file ownership and public behavior unless a separately approved architecture change updates the governing documents.

Semantic versioning begins at `1.0.0`. Source structure and production hardening are complete. Future releases must update `10.Config.js` and [the changelog](docs/CHANGELOG.md) together.

## Developer onboarding

Prerequisites are Git, VS Code, Node.js for local syntax checks and the Tailwind build, the Google `clasp` CLI, and access to the NUMLOCK Apps Script project and backing spreadsheet.

1. Clone the repository and open `Numlock.code-workspace`.
2. Read `AGENTS.md`, [Project Context](.ai/PROJECT_CONTEXT.md), and [Development Workflow](docs/DEVELOPMENT-WORKFLOW.md).
3. Confirm `git status --short` and preserve unrelated changes.
4. Confirm the active clasp account and run `clasp status` before any upload.
5. Use the testing and deployment gates below; never expose `.clasp.json` or credential files.

Install the pinned development tooling with `npm ci`. Run `npm run build:tailwind` after frontend class changes and before `clasp status`. The command generates `189.View.Tailwind.html`, a minified CSS-only, Git-tracked production partial included by `190.View.Index.html`; do not edit the generated file directly.

## Development workflow

1. Open `Numlock.code-workspace` in VS Code.
2. Give Codex a tightly scoped `NEW TASK` or `CURRENT TASK` that follows `AGENTS.md`.
3. Inspect and edit only explicitly scoped files.
4. Run syntax, migration, diff, and status validation appropriate to the change.
5. Review the exact diff and stage every approved path explicitly; never use `git add .`.
6. Commit locally and push to GitHub only when explicitly requested.
7. Run `npm ci` and `npm run build:tailwind`, then use `clasp status` to verify the upload inventory before any Apps Script upload.

## Validation and deployment flow

Keep evidence levels separate:

1. Local validation: syntax checks, Codex mocks, source contracts, `git diff --check`, and Git status.
2. Upload validation: confirm the authenticated clasp account and upload inventory, then run `clasp push` only when explicitly authorized.
3. Apps Script validation: run `getDashboardData()` and the dedicated migration test entry points in the correct script project.
4. Deployment: create or update a web-app deployment only after live backend validation passes and deployment is explicitly requested.
5. Browser verification: open the deployed dashboard, verify visible behavior, and check the browser console.

## Engineering documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Testing](docs/TESTING.md)
- [Source Migration](docs/SOURCE-MIGRATION.md)
- [Development Workflow](docs/DEVELOPMENT-WORKFLOW.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Git Workflow](docs/GIT-WORKFLOW.md)
- [Decisions](docs/DECISIONS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Changelog](docs/CHANGELOG.md)
- [Reference Parity Inventory](docs/PARITY-INVENTORY.md)
