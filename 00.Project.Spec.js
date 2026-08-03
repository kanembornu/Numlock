/**
 * NUMLOCK
 *
 * Runtime: Google Apps Script V8.
 * Architecture status: completed, live-validated, and frozen.
 *
 * Source layers:
 * - Project specification and configuration
 * - Data source and processing
 * - Aggregate, financial, and domain analytics
 * - Revenue, profit, score, diagnosis, recommendation, and decision intelligence
 * - Dashboard service and manual tests
 * - Web entry points and view
 *
 * Runtime owners:
 * - 10.Config.js: authoritative release and version metadata
 * - 100.Code.js: web entry point
 * - 190.View.Index.html: dashboard view
 *
 * Dependency direction:
 * View / Web Entry -> Dashboard Service -> Intelligence -> Analytics
 * -> Aggregate / Financial -> Data Processor -> Data Source -> Google Sheets.
 *
 * This file contains specification comments only and declares no executable globals.
 * Semantic versioning begins at 1.0.0. Future releases must update
 * 10.Config.js and docs/CHANGELOG.md together.
 */
