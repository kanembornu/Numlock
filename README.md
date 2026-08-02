# NUMLOCK

NUMLOCK is a coffee-shop business-intelligence dashboard built with Google Apps Script and Google Sheets. It reads transaction and price data, processes normalized rows, builds a shared analytics aggregate, derives dashboard intelligence, and serves an HTML dashboard through an Apps Script web app.

## Repository structure

The application currently uses three source files:

- `DashboardService.js` contains spreadsheet access, processing, analytics, intelligence, response composition, and migration tests.
- `Code.js` contains the `doGet()` web entry point.
- `Index.html` contains the dashboard UI and browser runtime.

The approved target is a numbered, flat Apps Script source layout. The ownership model and exact function migration map are documented in [Architecture](docs/ARCHITECTURE.md) and [Source Migration](docs/SOURCE-MIGRATION.md). Application files have not yet been split or renamed.

## Developer onboarding

Prerequisites are Git, VS Code, Node.js for local syntax checks, the Google `clasp` CLI, and access to the NUMLOCK Apps Script project and backing spreadsheet.

1. Clone the repository and open `Numlock.code-workspace`.
2. Read `AGENTS.md`, [Project Context](.ai/PROJECT_CONTEXT.md), and [Development Workflow](docs/DEVELOPMENT-WORKFLOW.md).
3. Confirm `git status --short` and preserve unrelated changes.
4. Confirm the active clasp account and run `clasp status` before any upload.
5. Use the testing and deployment gates below; never expose `.clasp.json` or credential files.

## Development workflow

1. Open `Numlock.code-workspace` in VS Code.
2. Give Codex a tightly scoped `NEW TASK` or `CURRENT TASK` that follows `AGENTS.md`.
3. Inspect and edit only explicitly scoped files.
4. Run syntax, migration, diff, and status validation appropriate to the change.
5. Review the exact diff and stage every approved path explicitly; never use `git add .`.
6. Commit locally and push to GitHub only when explicitly requested.
7. Use `clasp status` to verify the upload inventory before any Apps Script upload.

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
