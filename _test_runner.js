var fs = require('fs');
var vm = require('vm');
var runSalesV2U1MutationProof = require('./tests/browser/sales-v2-u1-mutation-proof.js');
globalThis.runSalesV2U1MutationProof = runSalesV2U1MutationProof;
var runSalesV2U2MutationProof = require('./tests/browser/sales-v2-u2-mutation-proof.js');
globalThis.runSalesV2U2MutationProof = runSalesV2U2MutationProof;
var runSalesV2U3MutationProof = require('./tests/browser/sales-v2-u3-mutation-proof.js');
globalThis.runSalesV2U3MutationProof = runSalesV2U3MutationProof;
var runSalesV2U4MutationProof = require('./tests/browser/sales-v2-u4-mutation-proof.js');
globalThis.runSalesV2U4MutationProof = runSalesV2U4MutationProof;
var runSalesV2U5MutationProof = require('./tests/browser/sales-v2-u5-mutation-proof.js');
globalThis.runSalesV2U5MutationProof = runSalesV2U5MutationProof;
var runSalesV2U6MutationProof = require('./tests/browser/sales-v2-u6-mutation-proof.js');
globalThis.runSalesV2U6MutationProof = runSalesV2U6MutationProof;
var runSalesV2U7Controller = require('./tests/browser/sales-v2-u7-controller.js');
globalThis.runSalesV2U7Controller = runSalesV2U7Controller;
var runSalesV2U7MutationProof = require('./tests/browser/sales-v2-u7-mutation-proof.js');
globalThis.runSalesV2U7MutationProof = runSalesV2U7MutationProof;
var runSalesV2U8MutationProof = require('./tests/browser/sales-v2-u8-mutation-proof.js');
globalThis.runSalesV2U8MutationProof = runSalesV2U8MutationProof;
var runSalesV2U8ReleaseAudit = require('./tests/browser/sales-v2-u8-release-audit.js');
globalThis.runSalesV2U8ReleaseAudit = runSalesV2U8ReleaseAudit;
var runSalesV2U10ActivationMutationProof = require('./tests/browser/sales-v2-u10-activation-mutation-proof.js');
globalThis.runSalesV2U10ActivationMutationProof = runSalesV2U10ActivationMutationProof;
var runSalesV2U10BOperatorSurface = require('./tests/browser/sales-v2-u10b-operator-surface.js');
globalThis.runSalesV2U10BOperatorSurface = runSalesV2U10BOperatorSurface;
var runSalesV2U10COperatorSurface = require('./tests/browser/sales-v2-u10c-operator-surface.js');
globalThis.runSalesV2U10COperatorSurface = runSalesV2U10COperatorSurface;
var runFinanceUiLivenessController = require('./tests/browser/finance-ui-liveness-controller.js');
globalThis.runFinanceUiLivenessController = runFinanceUiLivenessController;
var runTreasuryT7OperatorController = require('./tests/browser/treasury-t7-operator-controller.js');
globalThis.runTreasuryT7OperatorController = runTreasuryT7OperatorController;
var runTreasuryT8ReleaseGate = require('./tests/browser/treasury-t8-release-gate.js');
globalThis.runTreasuryT8ReleaseGate = runTreasuryT8ReleaseGate;
var runTreasuryT9PreparationMutationProof = require('./tests/browser/treasury-t9-preparation-mutation-proof.js');
globalThis.runTreasuryT9PreparationMutationProof = runTreasuryT9PreparationMutationProof;
var runTreasuryT105ActivationMutationProof = require('./tests/browser/treasury-t105-activation-mutation-proof.js');
globalThis.runTreasuryT105ActivationMutationProof = runTreasuryT105ActivationMutationProof;

globalThis.Logger = { log: function() {} };
globalThis.fs = require('fs');
globalThis.nodeCrypto = require('crypto');
globalThis.Utilities = {
  getUuid: function() { return 'test-uuid-000000000000000000000000'; },
  formatDate: function(d, tz, fmt) { return d.toISOString().slice(0, 19) + '.000Z'; }
};
globalThis.LockService = {
  getScriptLock: function() {
    return { waitLock: function() {}, releaseLock: function() {}, hasLock: function() { return true; } };
  }
};
globalThis.CacheService = {
  getScriptCache: function() {
    return { get: function() { return null; }, put: function() {} };
  }
};
globalThis.SpreadsheetApp = {
  getActiveSpreadsheet: function() { throw new Error('NO_SPREADSHEET_MOCK'); }
};
globalThis.invalidateDashboardCache = function() {};
globalThis.getDashboardCacheRevision = function() { return 'LOCAL_FIXTURE'; };
globalThis.dateFormat = function() { return 'yyyy-MM-dd'; };
globalThis.Session = { getScriptTimeZone: function() { return 'Asia/Jakarta'; } };

// Client-side recovery stubs (used by test PurchaseResolveEvidenceContracts)
var _purchaseRecoveryStore = {};
globalThis.sessionStorage = {
  getItem: function(k) { return _purchaseRecoveryStore[k] || null; },
  setItem: function(k, v) { _purchaseRecoveryStore[k] = v; },
  removeItem: function(k) { delete _purchaseRecoveryStore[k]; }
};
globalThis.PURCHASE_RECOVERY_STORAGE_KEY = "numlock.purchase.mutationRecovery";
globalThis.savePurchaseRecoveryState = function(state) {
  try { globalThis.sessionStorage.setItem(globalThis.PURCHASE_RECOVERY_STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
};
globalThis.loadPurchaseRecoveryState = function() {
  try {
    var raw = globalThis.sessionStorage.getItem(globalThis.PURCHASE_RECOVERY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
};
globalThis.clearPurchaseRecoveryState = function() {
  try { globalThis.sessionStorage.removeItem(globalThis.PURCHASE_RECOVERY_STORAGE_KEY); } catch (e) {}
};

var files = [
  '20.Data.Source.js',
  '22.Transaction.Lifecycle.js',
  '38.CapitalEquity.Service.js',
  '39.Balance.Foundation.js',
  '40.Cash.Foundation.js',
  '41.Inventory.Opening.Staging.js',
  '42.Inventory.Receipt.Foundation.js',
  '43.Inventory.Receipt.Migration.js',
  '44.Inventory.Receipt.Operational.js',
  '45.Inventory.Receipt.Orchestration.js',
  '46.Expense.Purchase.Policy.js',
  '47.Purchase.Events.js',
  '48.Purchase.Events.Migration.js',
  '21.Transaction.Entry.js',
  '90.Dashboard.DateRange.js',
  '90.Dashboard.Service.js',
  '36.Finance.Service.js',
  '37.Depreciation.Service.js',
  '12A.Depreciation.Report.Service.js',
  '37.Inventory.Policy.Evidence.js',
  '91.Transactions.Query.js',
  '92.Products.Domain.js',
  '93.Master.WritePolicy.js',
  '94.Supplier.Master.js',
  '95.Transaction.Operational.js',
  '95A.Transaction.Production.js',
  '97.SalesRecognition.V2.Foundation.js',
  '97A.SalesRecognition.V2.Save.js',
  '97B.SalesRecognition.V2.Projection.js',
  '97C.SalesRecognition.V2.Correction.js',
  '97D.SalesRecognition.V2.OperatorGuard.js',
  '97E.SalesRecognition.V2.Activation.js',
  '99.Treasury.Receipt.Foundation.js',
  '99A.Treasury.Receipt.Durable.Save.js',
  '99B.Treasury.Clearing.Projection.js',
  '99C.Treasury.Receipt.Reversal.Correction.js',
  '99D.Treasury.Operator.Api.js',
  '100.Code.js',
  '101.SingleCommit.Config.Control.js',
  '96.Tests.Transaction.Operational.Cases.js',
  '96.Tests.Transaction.Production.Readiness.Cases.js',
  '96.Tests.SalesRecognition.V2.Save.Cases.js',
  '96.Tests.SingleCommit.SalesMoney.Cases.js',
  '96.Tests.SingleCommit.Expense.Cases.js',
  '96.Tests.SingleCommit.Purchase.Cases.js',
  '96.Tests.SalesRecognition.V2.Projection.Cases.js',
  '96.Tests.SalesRecognition.V2.U4.Cases.js',
  '96.Tests.SalesRecognition.V2.U5.Cases.js',
  '96.Tests.SalesRecognition.V2.U6.Cases.js',
  '96.Tests.SalesRecognition.V2.U7.Cases.js',
  '96.Tests.SalesRecognition.V2.U8.Cases.js',
  '96.Tests.SalesRecognition.V2.Activation.Cases.js',
  '96.Tests.Supplier.Master.Cases.js',
  '96.Tests.Inventory.Receipt.Cases.js',
  '96.Tests.Expense.Purchase.Cases.js',
  '96.Tests.Purchase.Events.Migration.Cases.js',
  '96.Tests.Cash.Foundation.Cases.js',
  '96.Tests.Depreciation.Cases.js',
  '96.Tests.CapitalEquity.Cases.js',
  '96.Tests.Balance.Foundation.Cases.js',
  '96.Tests.Finance.Cases.js',
  '96.Tests.Inventory.Policy.Evidence.Cases.js',
  '96.Tests.Master.WritePolicy.Cases.js',
  '96.Tests.Treasury.Receipt.Foundation.Cases.js',
  '96.Tests.Treasury.Receipt.Durable.Save.Cases.js',
  '96.Tests.Treasury.Clearing.Projection.Cases.js',
  '96.Tests.Treasury.Receipt.Lifecycle.Cases.js',
  '96.Tests.Treasury.Operator.Cases.js',
  '96.Tests.Treasury.Receipt.Preparation.Cases.js',
  '96.Tests.Treasury.Activation.Cases.js',
  '96.Tests.SingleCommit.Readers.Cases.js',
  '96.Tests.SingleCommit.Config.Cases.js',
  '96.Tests.SingleCommit.Corrections.Cases.js',
  '96.Tests.SalesUI.U8B.Cases.js'
];

var ctx = vm.createContext(globalThis);
files.forEach(function(f) {
  try {
    var code = fs.readFileSync(f, 'utf8');
    vm.runInContext(code, ctx, { filename: f });
  } catch(e) {
    console.error('FAIL load ' + f + ': ' + e.message);
    process.exit(1);
  }
});

// 90.Dashboard.Service.js declares these two names; the local harness stubs
// stay authoritative (no PropertiesService in the local runner).
globalThis.invalidateDashboardCache = function() {};
globalThis.getDashboardCacheRevision = function() { return 'LOCAL_FIXTURE'; };

// Authority fixtures: ING-018 (lemon) item + management-operational-standard conversion
// needed for DIRECT_HPP_COMPONENT receipt posting in orchestration/dispatcher/wiring tests.
// BaseUOM is 'slice' — the lemon's recipe base unit; conversion goes gr→slice.
vm.runInContext([
  'var _lemonNote = "BASIS=MANAGEMENT_OPERATIONAL_STANDARD; METHOD=1_KG_8_FRUITS_1_FRUIT_3_SLICES_SIGNED_FIRST_PERSON_STATEMENT_DETERMINISTIC_ARITHMETIC; PLAUSIBILITY=CONFIRMED; LIMITATIONS=NO_INDEPENDENT_REVIEW_NOT_PHYSICAL_OBSERVATION_OPERATIONAL_VARIANCE; REVIEW=SELF_APPROVAL_DISCLOSED_CONTROLS_CONFIRMED";',
  'var _authority = {',
  '  items: [',
  '    { ItemID: "ING-018", ItemName: "Lemon", Classification: "RAW_MATERIAL", BaseUOM: "slice",',
  '      EffectiveFrom: "2026-10-01", EffectiveTo: "", IsActive: true, SourceIngredientID: "ING-018",',
  '      CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }',
  '  ],',
  '  conversions: [',
  '    { ConversionID: "CONV-018", ItemID: "ING-018", FromUOM: "gr",',
  '      PackageIdentity: "ING-018|INTERNAL-NUMLOCK|Lemon|OPERATIONAL-STANDARD|1000gr-24slice|V01",',
  '      SupplierRef: "INTERNAL-NUMLOCK", ToUOM: "slice", Numerator: "24", Denominator: "1000",',
  '      EffectiveFrom: "2026-10-01", EffectiveTo: "",',
  '      EvidenceType: "MANAGEMENT_OPERATIONAL_STANDARD",',
  '      EvidenceRef: "GDRIVE:LOCALTEST:V01:SHA256:' + 'a'.repeat(64) + '",',
  '      EvidenceDate: "2026-10-01", PreparedBy: "TEST",',
  '      PreparedAt: "2026-10-01T00:00:00Z", ReviewedBy: "", ReviewedAt: "",',
  '      ApprovalStatus: "SINGLE_OPERATOR_APPROVED", ApprovalNote: _lemonNote,',
  '      IsActive: true, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }',
  '  ]',
  '};'
].join('\n'), ctx);

// Expense items from frozen policy — every row gets a synthetic ExpenseItem record.
vm.runInContext(
  'var _testItems = EXPENSE_PURCHASE_POLICY.rows.map(function(r) { return { ID_Ops: r.expenseItemId, Item: "Test-" + r.expenseItemId, Kategori: "Test", Kind: "Test", Group: "Test", AccountCode: "1100", IsActive: true }; });',
  ctx
);

// HTML source files for UI contract tests
vm.runInContext([
  'var _htmlIndex = ' + JSON.stringify(fs.readFileSync('190.View.Index.html', 'utf8')) + ';',
  'var _htmlRender = ' + JSON.stringify(fs.readFileSync('193.View.Transactions.Render.html', 'utf8')) + ';',
  'var _htmlActions = ' + JSON.stringify(fs.readFileSync('195.View.Transactions.Actions.html', 'utf8')) + ';',
  'var _htmlForms = ' + JSON.stringify(fs.readFileSync('194.View.Transactions.Forms.html', 'utf8')) + ';',
  'var _productionSource = ' + JSON.stringify(fs.readFileSync('95A.Transaction.Production.js', 'utf8')) + ';',
  'var _treasuryFoundationSource = ' + JSON.stringify(fs.readFileSync('99.Treasury.Receipt.Foundation.js', 'utf8')) + ';',
  'var _treasuryDurableSource = ' + JSON.stringify(fs.readFileSync('99A.Treasury.Receipt.Durable.Save.js', 'utf8')) + ';',
  'var _treasuryClearingSource = ' + JSON.stringify(fs.readFileSync('99B.Treasury.Clearing.Projection.js', 'utf8')) + ';',
  'var _treasuryLifecycleSource = ' + JSON.stringify(fs.readFileSync('99C.Treasury.Receipt.Reversal.Correction.js', 'utf8')) + ';',
  'var __t7apiSource = ' + JSON.stringify(fs.readFileSync('99D.Treasury.Operator.Api.js', 'utf8')) + ';',
  'var __t7stateSource = ' + JSON.stringify(fs.readFileSync('202.View.Treasury.State.html', 'utf8')) + ';',
  'var __t7renderSource = ' + JSON.stringify(fs.readFileSync('203.View.Treasury.Render.html', 'utf8')) + ';',
  'var __t7controllerSource = ' + JSON.stringify(fs.readFileSync('204.View.Treasury.Controller.html', 'utf8')) + ';',
  'var __t7indexSource = _htmlIndex;'
].join('\n'), ctx);

var pass = 0, fail = 0, expectedFail = 0;

function run(name, code) {
  try {
    vm.runInContext(code, ctx);
    pass++;
    console.log('PASS ' + name);
  } catch(e) {
    fail++;
    console.log('FAIL ' + name + ': ' + e.message);
  }
}

// 1. Policy contracts — no authority needed
run('testExpensePurchasePolicyContracts', 'testExpensePurchasePolicyContracts()');

// 2. Orchestration — needs authority with ING-018 item + conversion for receipt posting
run('testPurchaseEventOrchestrationContracts', 'testPurchaseEventOrchestrationContracts(_authority, _testItems)');

// 3. Canonical dispatcher — same authority, exercises submitCanonicalTransactionWithRuntime_
run('testCanonicalPurchaseDispatcherContracts', 'testCanonicalPurchaseDispatcherContracts(_authority, _testItems)');

// 4. Runtime wiring — production-runtime adapter over memory sheets
run('testPurchaseEventRuntimeWiringContracts', 'testPurchaseEventRuntimeWiringContracts(_authority, _testItems)');

// 5. Read-only purchase-event status lookup.
run('testPurchaseEventLookupContracts', 'testPurchaseEventLookupContracts()');

// 6. Schema migration — pre-activation operation; guard proves post-activation safety.
run('testPurchaseEventSchemaMigrationContracts', 'testPurchaseEventSchemaMigrationContracts()');

run('testPurchaseEventDiagnosticContracts', 'testPurchaseEventDiagnosticContracts()');
run('testPurchaseEventIsActiveTypeContract', 'testPurchaseEventIsActiveTypeContract()');
run('testPurchaseEventResolutionContracts', 'testPurchaseEventResolutionContracts()');
run('testPurchaseResolutionSchemaMigrationContracts', 'testPurchaseResolutionSchemaMigrationContracts()');
run('testPurchaseEventLifecycleReadModel_', 'testPurchaseEventLifecycleReadModel_()');
run('testPurchaseEventVoidContracts', 'testPurchaseEventVoidContracts()');
run('testPurchaseEventCorrectionContracts', 'testPurchaseEventCorrectionContracts()');

run('testPurchaseViewContracts', 'testPurchaseViewContracts()');

run('testPurchaseRecoveryContracts', 'testPurchaseRecoveryContracts()');

run('testPurchaseResolveEvidenceContracts', 'testPurchaseResolveEvidenceContracts()');

run('testPurchaseUIContracts', 'testPurchaseUIContracts()');

// Policy C local acceptance matrix. Production functions and existing fixtures only.
run('testCashFoundationContracts', 'testCashFoundationContracts()');
run('testDepreciationEngineContract', 'testDepreciationEngineContract()');
run('testDepreciationReportContract', 'testDepreciationReportContract()');
run('testDepreciationContinuationContract', 'testDepreciationContinuationContract()');
run('testFinanceCoreBackendContract', 'testFinanceCoreBackendContract()');
run('testFinancePAndLIsolation', 'testFinancePAndLIsolation()');
run('testFinanceCapitalEquityGracefulDegradation', 'testFinanceCapitalEquityGracefulDegradation()');
run('testFinanceCapitalEquitySuccess', 'testFinanceCapitalEquitySuccess()');
run('testFinanceResponseBackwardCompatibility', 'testFinanceResponseBackwardCompatibility()');
run('testPolicyCBalanceServiceFinalization', 'testPolicyCBalanceServiceFinalization()');
run('testCashFlowOpeningClosing', 'testCashFlowOpeningClosing()');
run('testPolicyCIntegratedAccountingContract', 'testPolicyCIntegratedAccountingContract()');
run('testInventoryPolicyEvidenceDiagnosticContracts', 'testInventoryPolicyEvidenceDiagnosticContracts()');

run('testMasterWritePolicyContracts', 'testMasterWritePolicyContracts()');
run('testSupplierMasterContracts', 'testSupplierMasterContracts()');
run('testTransactionOperationalFoundationContracts', 'testTransactionOperationalFoundationContracts(_htmlIndex, _htmlActions)');
run('testSalesOperatorWorkflowContracts', 'testSalesOperatorWorkflowContracts(_htmlIndex, _htmlActions, _productionSource, _htmlForms)');
run('testSalesUIU8BContract', 'testSalesUIU8BContract()');
run('testTransactionAuthorityTransportContract', 'testTransactionAuthorityTransportContract()');
run('testOperationalOrderLookupTransportContract', 'testOperationalOrderLookupTransportContract()');
run('testOpenOperationalOrdersTransportContract', 'testOpenOperationalOrdersTransportContract()');
run('testTransactionProductionReadinessMatrices', 'testTransactionProductionReadinessMatrices()');
run('testTransactionCrashRecoveryExecution', 'testTransactionCrashRecoveryExecution()');
run('testTransactionExecutorFixtures', 'testTransactionExecutorFixtures()');
run('testTransactionPurchaseExpenseBehavioralFixtures', 'testTransactionPurchaseExpenseBehavioralFixtures()');

// SALES_RECOGNITION_V2 U1 foundation (pure contract/config/classifier/preflight).
run('testSalesRecognitionV2FoundationContracts', 'testSalesRecognitionV2FoundationContracts()');
run('testSalesV2CutoverPeriods', 'testSalesV2CutoverPeriods()');
run('testSalesV2AccountPreflight', 'testSalesV2AccountPreflight()');
run('testSalesV2U1MutationProof', 'JSON.stringify(runSalesV2U1MutationProof())');

// SALES_RECOGNITION_V2 U2 durable save core (fixture-local suites + proof).
run('testSalesRecognitionV2SaveCore', 'testSalesRecognitionV2SaveCore()');
run('testSalesRecognitionV2SaveRecovery', 'testSalesRecognitionV2SaveRecovery()');
run('testSalesRecognitionV2SaveGates', 'testSalesRecognitionV2SaveGates()');
run('testSalesV2U2MutationProof', 'JSON.stringify(runSalesV2U2MutationProof())');

// T11.3 U1 Sales composed money leg (SINGLE_COMMIT_TRANSACTION_V1 gated,
// inert until authorized activation): config gate + inert parity, 1040
// precondition matrix, one-plan/one-batch composition, durability (replay /
// conflict / UNKNOWN / crash / tamper), isolation audits.
run('testSalesComposedMoneyGateInert', 'testSalesComposedMoneyGateInert()');
run('testSalesComposedMoneyPreflight1040', 'testSalesComposedMoneyPreflight1040()');
run('testSalesComposedMoneyPlanBatch', 'testSalesComposedMoneyPlanBatch()');
run('testSalesComposedMoneyDurability', 'testSalesComposedMoneyDurability()');
  run('testSalesComposedMoneyIsolation', 'testSalesComposedMoneyIsolation()');

  // T11.4 U2 Expense durable single-commit core (SINGLE_COMMIT_TRANSACTION_V1
  // gated, inert until authorized activation): gate routing + inert legacy
  // parity, 1040 preflight matrix, one-plan/one-batch composition, durability
  // (replay/conflict/UNKNOWN pre+post batch/artifact loss/tamper), isolation
  // (Treasury, payment fields, historical rows, correction lineage).
  run('testExpenseSingleCommitGateRouting', 'testExpenseSingleCommitGateRouting()');
  run('testExpenseSingleCommitPreflight1040', 'testExpenseSingleCommitPreflight1040()');
  run('testExpenseSingleCommitPlanBatch', 'testExpenseSingleCommitPlanBatch()');
  run('testExpenseSingleCommitDurability', 'testExpenseSingleCommitDurability()');
  run('testExpenseSingleCommitIsolation', 'testExpenseSingleCommitIsolation()');

  // T11.5 U3 Purchase durable single-commit core (SINGLE_COMMIT_TRANSACTION_V1
  // gated, inert until authorized activation): gate routing + byte-identical
  // legacy parity, 1040/6210 preflight matrix, one-plan/ONE-batch composition
  // (final event append + Policy C Dr6210/Cr1040 + Logs), durability
  // (replay/conflict/UNKNOWN pre+post batch/artifact loss/tamper), isolation
  // (Treasury/AP/Inventory, payment fields, historical rows, correction
  // lineage).
  run('testPurchaseSingleCommitGateRouting', 'testPurchaseSingleCommitGateRouting()');
  run('testPurchaseSingleCommitPreflightAccounts', 'testPurchaseSingleCommitPreflightAccounts()');
  run('testPurchaseSingleCommitPlanBatch', 'testPurchaseSingleCommitPlanBatch()');
  run('testPurchaseSingleCommitDurability', 'testPurchaseSingleCommitDurability()');
  run('testPurchaseSingleCommitIsolation', 'testPurchaseSingleCommitIsolation()');

// SALES_RECOGNITION_V2 U3 shared read-only projection (cohorts, signed
// events, lineage, cross-cohort parity + sensitivity proof).
run('testSalesRecognitionV2ProjectionCore', 'testSalesRecognitionV2ProjectionCore()');
run('testSalesRecognitionV2ProjectionLineage', 'testSalesRecognitionV2ProjectionLineage()');
run('testSalesRecognitionV2ProjectionParity', 'testSalesRecognitionV2ProjectionParity()');
run('testSalesV2U3MutationProof', 'JSON.stringify(runSalesV2U3MutationProof())');

// SALES_RECOGNITION_V2 U4 Transaction reader integration: Sales list/detail/
// query resolve from the shared U3 projection (cohorts, list/query parity,
// detail model) + sensitivity proof.
run('testSalesRecognitionV2U4ReaderCohorts', 'testSalesRecognitionV2U4ReaderCohorts()');
run('testSalesRecognitionV2U4ReaderList', 'testSalesRecognitionV2U4ReaderList()');
run('testSalesRecognitionV2U4ReaderDetail', 'testSalesRecognitionV2U4ReaderDetail()');
run('testSalesV2U4MutationProof', 'JSON.stringify(runSalesV2U4MutationProof())');

// U10F: U4 cache-freshness remediation — warm-cache regression (real cache
// boundary), invalidation negative paths, Correct/Void immediate freshness.
run('testSalesRecognitionV2U4WarmCacheFreshness', 'testSalesRecognitionV2U4WarmCacheFreshness()');
run('testSalesRecognitionV2U4CacheNegativePaths', 'testSalesRecognitionV2U4CacheNegativePaths()');
run('testSalesRecognitionV2U4MutationCacheFreshness', 'testSalesRecognitionV2U4MutationCacheFreshness()');

// SALES_RECOGNITION_V2 U5 Finance P&L Revenue integration: Revenue/P&L reads
// the signed U3 projection events by EconomicDate (Policy C COGS semantics,
// fail-closed quality metadata, U3/U4/U5 parity) + sensitivity proof.
run('testSalesRecognitionV2U5RevenueAuthority', 'testSalesRecognitionV2U5RevenueAuthority()');
run('testSalesRecognitionV2U5LifecyclePeriods', 'testSalesRecognitionV2U5LifecyclePeriods()');
run('testSalesRecognitionV2U5PolicyCQuality', 'testSalesRecognitionV2U5PolicyCQuality()');
run('testSalesRecognitionV2U5Parity', 'testSalesRecognitionV2U5Parity()');
run('testSalesV2U5MutationProof', 'JSON.stringify(runSalesV2U5MutationProof())');

// SALES_RECOGNITION_V2 U6 durable Correct/Void mutations: durability,
// idempotency, recovery, integrity, lifecycle/concurrency, cross-layer
// (U3/U4/U5), Policy C, legacy cross-rejection, transport, 29-item source
// audit + sensitivity proof.
run('testSalesRecognitionV2U6VoidCore', 'testSalesRecognitionV2U6VoidCore()');
run('testSalesRecognitionV2U6VoidRecovery', 'testSalesRecognitionV2U6VoidRecovery()');
run('testSalesRecognitionV2U6VoidIntegrity', 'testSalesRecognitionV2U6VoidIntegrity()');
run('testSalesRecognitionV2U6CorrectCore', 'testSalesRecognitionV2U6CorrectCore()');
run('testSalesRecognitionV2U6CorrectRecovery', 'testSalesRecognitionV2U6CorrectRecovery()');
run('testSalesRecognitionV2U6Lifecycle', 'testSalesRecognitionV2U6Lifecycle()');
run('testSalesRecognitionV2U6CrossLayer', 'testSalesRecognitionV2U6CrossLayer()');
run('testSalesRecognitionV2U6PolicyC', 'testSalesRecognitionV2U6PolicyC()');
run('testSalesRecognitionV2U6Legacy', 'testSalesRecognitionV2U6Legacy()');
run('testSalesRecognitionV2U6Transport', 'testSalesRecognitionV2U6Transport()');
run('testSalesRecognitionV2U6SourceAudit', 'testSalesRecognitionV2U6SourceAudit()');
  run('testSalesV2U6MutationProof', 'JSON.stringify(runSalesV2U6MutationProof())');

  // SALES_RECOGNITION_V2 U7 operator flow + legacy-routing guards: mode
  // routing, V2 retirements, request identity, Correct/Void routing, UI
  // contracts, 28-item source audit, controller fixture + sensitivity proof.
  run('testSalesRecognitionV2U7OperatorFlow', 'testSalesRecognitionV2U7OperatorFlow()');
  run('testSalesRecognitionV2U7RetirementGuards', 'testSalesRecognitionV2U7RetirementGuards()');
  run('testSalesRecognitionV2U7RequestIdentity', 'testSalesRecognitionV2U7RequestIdentity()');
  run('testSalesRecognitionV2U7CorrectVoidRouting', 'testSalesRecognitionV2U7CorrectVoidRouting()');
  run('testSalesRecognitionV2U7UiContracts', 'testSalesRecognitionV2U7UiContracts()');
  run('testSalesRecognitionV2U7SourceAudit', 'testSalesRecognitionV2U7SourceAudit()');
  run('testSalesV2U7Controller', 'JSON.stringify(runSalesV2U7Controller())');
  run('testSalesV2U7MutationProof', 'JSON.stringify(runSalesV2U7MutationProof())');

  // SALES_RECOGNITION_V2 U8 integration/release evidence: cross-module
  // composition (A-R), transport contract, identity/write-surface matrices,
  // preflights, controller composition + 26-item source audit.
  run('testSalesRecognitionV2U8EndToEnd', 'testSalesRecognitionV2U8EndToEnd()');
  run('testSalesRecognitionV2U8Lifecycle', 'testSalesRecognitionV2U8Lifecycle()');
  run('testSalesRecognitionV2U8Cohorts', 'testSalesRecognitionV2U8Cohorts()');
  run('testSalesRecognitionV2U8PolicyModes', 'testSalesRecognitionV2U8PolicyModes()');
  run('testSalesRecognitionV2U8GuardsIntegrity', 'testSalesRecognitionV2U8GuardsIntegrity()');
  run('testSalesRecognitionV2U8Preflight', 'testSalesRecognitionV2U8Preflight()');
  run('testSalesRecognitionV2U8ReleaseEvidence', 'testSalesRecognitionV2U8ReleaseEvidence()');
  run('testSalesV2U8MutationProof', 'JSON.stringify(runSalesV2U8MutationProof())');
  run('testSalesV2U8ReleaseAudit', 'JSON.stringify(runSalesV2U8ReleaseAudit())');

  // SALES_RECOGNITION_V2 U10 activation capability (PREPARED -> ACTIVE writer):
  // happy path, fail-closed matrix, source audit + sensitivity proof.
  run('testSalesRecognitionV2ActivationCore', 'testSalesRecognitionV2ActivationCore()');
  run('testSalesRecognitionV2ActivationFailClosed', 'testSalesRecognitionV2ActivationFailClosed()');
  run('testSalesRecognitionV2ActivationSourceAudit', 'testSalesRecognitionV2ActivationSourceAudit()');
  run('testSalesV2U10ActivationMutationProof', 'JSON.stringify(runSalesV2U10ActivationMutationProof())');

  // SALES_RECOGNITION_V2 U10B operator-surface reproduction: owner-observed
  // legacy controls + disabled Save Transaction reproduced from HEAD source,
  // mode-blind client proof, operable Save Order -> server mode dispatcher.
  run('testSalesV2U10BOperatorSurface', 'JSON.stringify(runSalesV2U10BOperatorSurface())');

  // SALES_RECOGNITION_V2 U10C ACTIVE operator surface (real 190 dialog markup +
  // 194/195 controller composition): UI-A1..A14 + 18-item source audit.
  run('testSalesV2U10COperatorSurface', 'JSON.stringify(runSalesV2U10COperatorSurface())');

  // FIN-UI-LIVENESS-01: Finance UI dispatch-liveness controller regressions
  // (F1..F12 + static guards + M1..M10 mutation sensitivity) over the real
  // 199/200/201 Finance view sources with mocked google.script.run.
  run('testFinanceUiDispatchLiveness', 'JSON.stringify(runFinanceUiLivenessController())');

  // TREASURY_T3: inert TREASURY_RECEIPT_V1 foundation — contract constants,
  // exact schemas, fail-closed config reader/classifier, destination
  // eligibility + 1030 preflight, Asia/Jakarta date authority, identity
  // namespaces, canonical journal signature, legacy isolation + 15-point
  // mutation sensitivity.
  run('testTreasuryT3ContractConstants', 'testTreasuryT3ContractConstants()');
  run('testTreasuryT3SchemaValidation', 'testTreasuryT3SchemaValidation()');
  run('testTreasuryT3ConfigClassifier', 'testTreasuryT3ConfigClassifier()');
  run('testTreasuryT3DestinationEligibility', 'testTreasuryT3DestinationEligibility()');
  run('testTreasuryT3DateAuthority', 'testTreasuryT3DateAuthority()');
  run('testTreasuryT3IdentityNamespaces', 'testTreasuryT3IdentityNamespaces()');
  run('testTreasuryT3IdentityFailClosed', 'testTreasuryT3IdentityFailClosed()');
  run('testTreasuryT3JournalSignature', 'testTreasuryT3JournalSignature()');
  run('testTreasuryT3LegacyIsolation', 'testTreasuryT3LegacyIsolation()');
  run('testTreasuryT3MutationSensitivity', 'testTreasuryT3MutationSensitivity()');

  // TREASURY_T4: durable receipt Save core — normal save, refusals,
  // idempotency, recovery + 20-boundary failure injection, concurrency,
  // integrity, isolation/financial non-impact, cache, 1030 CashFlowGroup
  // gate, and 25-point mutation sensitivity.
  run('testTreasuryT4SaveCore', 'testTreasuryT4SaveCore()');
  run('testTreasuryT4Refusals', 'testTreasuryT4Refusals()');
  run('testTreasuryT4Idempotency', 'testTreasuryT4Idempotency()');
  run('testTreasuryT4Recovery', 'testTreasuryT4Recovery()');
  run('testTreasuryT4Concurrency', 'testTreasuryT4Concurrency()');
  run('testTreasuryT4Integrity', 'testTreasuryT4Integrity()');
  run('testTreasuryT4Isolation', 'testTreasuryT4Isolation()');
  run('testTreasuryT4Cache', 'testTreasuryT4Cache()');
  run('testTreasuryT4CashFlowGroupGate', 'testTreasuryT4CashFlowGroupGate()');
  run('testTreasuryT4MutationSensitivity', 'testTreasuryT4MutationSensitivity()');
  run('testTreasuryT4PostReversalFoundation', 'testTreasuryT4PostReversalFoundation()');

  // TREASURY_T5: canonical clearing projection + global 1030 reconciliation —
  // statuses/row contract, integrity gates, orphans + Sales reversal
  // lifecycle, as-of/Asia-Jakarta semantics, deterministic exception
  // attribution with unexplained residual, T4 parity, Finance isolation,
  // read-only source audit, and 25-point mutation sensitivity.
  run('testTreasuryT5ProjectionStatus', 'testTreasuryT5ProjectionStatus()');
  run('testTreasuryT5Integrity', 'testTreasuryT5Integrity()');
  run('testTreasuryT5OrphansReversal', 'testTreasuryT5OrphansReversal()');
  run('testTreasuryT5AsOf', 'testTreasuryT5AsOf()');
  run('testTreasuryT5Reconciliation', 'testTreasuryT5Reconciliation()');
  run('testTreasuryT5ParityFinance', 'testTreasuryT5ParityFinance()');
  run('testTreasuryT5FinanceIsolation', 'testTreasuryT5FinanceIsolation()');
  run('testTreasuryT5ReadOnlyAudit', 'testTreasuryT5ReadOnlyAudit()');
  run('testTreasuryT5MutationSensitivity', 'testTreasuryT5MutationSensitivity()');
  run('testTreasuryT5PostReversalFoundation', 'testTreasuryT5PostReversalFoundation()');

  // TREASURY_T6: durable append-only receipt reversal + correction — reversal
  // core, correction core (ONE atomic batch), integrity, recovery +
  // 20-boundary failure injection, concurrency, T5 canonical integration,
  // isolation/source audit, failure paths, and 30-point mutation sensitivity.
  run('testTreasuryT6ReversalCore', 'testTreasuryT6ReversalCore()');
  run('testTreasuryT6CorrectionCore', 'testTreasuryT6CorrectionCore()');
  run('testTreasuryT6Integrity', 'testTreasuryT6Integrity()');
  run('testTreasuryT6Recovery', 'testTreasuryT6Recovery()');
  run('testTreasuryT6Concurrency', 'testTreasuryT6Concurrency()');
  run('testTreasuryT6T5Integration', 'testTreasuryT6T5Integration()');
  run('testTreasuryT6Isolation', 'testTreasuryT6Isolation()');
  run('testTreasuryT6FailurePaths', 'testTreasuryT6FailurePaths()');
  run('testTreasuryT6MutationSensitivity', 'testTreasuryT6MutationSensitivity()');

  // TREASURY_T7: operator API + application integration — thin endpoint
  // contracts over T3-T6, U-scenario server flows with public-endpoint
  // execution, source/call-graph audit, and the U1-U18 + liveness +
  // 30-point mutation-sensitivity controller battery.
  run('testTreasuryT7Endpoints', 'testTreasuryT7Endpoints()');
  run('testTreasuryT7IntegrationFlows', 'testTreasuryT7IntegrationFlows()');
  run('testTreasuryT7SourceAudit', 'testTreasuryT7SourceAudit()');
  run('testTreasuryT7OperatorController', '(function() {' +
    'var r = runTreasuryT7OperatorController();' +
    'if (!r.passed) throw new Error("T7_CONTROLLER:" + JSON.stringify({' +
    'static: r.staticFailures, u: r.uFailures, l: r.lFailures,' +
    'm: r.mutationFailures, anchors: r.mutationAnchorMisses}));' +
    'var summary = "T7_CONTROLLER EVIDENCE: U" + r.uChecks + " checks, L" + r.lChecks + ' +
    '" checks, mutation " + r.mutationCaught + "/" + r.mutationTotal + ", static 0 failures";' +
    'console.log(summary); return summary;' +
    '})()');

  // TREASURY_T8: integration and release evidence gate — R1-R20 release
  // scenarios over real T3-T7 authority paths, independent accounting oracle,
  // global 1030 invariant, Finance/Cash-Flow/Balance parity, package
  // manifest+hash, call-graph/duplication/forbidden-token/schema/config/
  // account/date/RequestKey/error/cache audits, crash/recovery + concurrency
  // matrices, and the 20/20 release mutation-sensitivity battery.
  run('testTreasuryT8ReleaseGate', '(function() {' +
    'var r = runTreasuryT8ReleaseGate();' +
    'if (!r.passed) throw new Error("T8_GATE_FAILED");' +
    'var summary = "T8_RELEASE_GATE EVIDENCE: scenarios=" + r.scenarios.checks +' +
    ' " crashCells=" + r.crashMatrixCells + " concurrency=" + r.concurrencyCells +' +
    ' " audits=" + r.audits + " finance=" + r.financeParityChecks +' +
    ' " mutation=" + r.mutations.caught + "/" + r.mutations.total;' +
    'console.log(summary); return summary;' +
    '})()');

  // TREASURY_T9: production preparation gate — create-if-absent Treasury
  // sheets with the exact T3 headers, PREPARED-only config establishment,
  // fail-closed schema/account/config refusals, idempotent second run, exact
  // package registration + 20-point sensitivity proof. In-memory fixtures
  // only: no production access, no clasp, no writes outside fixture memory.
  run('testTreasuryT9PreparationCore', 'testTreasuryT9PreparationCore()');
  run('testTreasuryT9PreparationPartial', 'testTreasuryT9PreparationPartial()');
  run('testTreasuryT9PreparationConfigOnly', 'testTreasuryT9PreparationConfigOnly()');
  run('testTreasuryT9PreparationSchemaConflict', 'testTreasuryT9PreparationSchemaConflict()');
  run('testTreasuryT9PreparationIdempotent', 'testTreasuryT9PreparationIdempotent()');
  run('testTreasuryT9PreparationMalformedConfig', 'testTreasuryT9PreparationMalformedConfig()');
  run('testTreasuryT9PreparationUnexpectedMode', 'testTreasuryT9PreparationUnexpectedMode()');
  run('testTreasuryT9PreparationAccountReadiness', 'testTreasuryT9PreparationAccountReadiness()');
  run('testTreasuryT9PreparationCashFlowGroupGate', 'testTreasuryT9PreparationCashFlowGroupGate()');
  run('testTreasuryT9PreparationCreateFailure', 'testTreasuryT9PreparationCreateFailure()');
  run('testTreasuryT9PreparationZeroBusinessRows', 'testTreasuryT9PreparationZeroBusinessRows()');
  run('testTreasuryT9PreparationConfigClassification', 'testTreasuryT9PreparationConfigClassification()');
  run('testTreasuryT9PreparationPreparedRefusal', 'testTreasuryT9PreparationPreparedRefusal()');
  run('testTreasuryT9PackageRegistration', 'testTreasuryT9PackageRegistration()');
  run('testTreasuryT9PreparationSourceAudit', 'testTreasuryT9PreparationSourceAudit()');
  run('testTreasuryT9DeploymentOrder', 'testTreasuryT9DeploymentOrder()');
  run('testTreasuryT9MutationSensitivity', 'JSON.stringify(runTreasuryT9PreparationMutationProof())');

  // TREASURY_T10.5: production activation writer — PREPARED -> ACTIVE core
  // (identity/lock/schema/account/1030/reconciliation gates, config-only
  // write, exact readback, idempotent ACTIVE, ambiguous-response recovery),
  // call-graph/writer source audit, and 20-point mutation sensitivity.
  run('testTreasuryT105ActivationPreparedToActive', 'testTreasuryT105ActivationPreparedToActive()');
  run('testTreasuryT105ActivationIdempotent', 'testTreasuryT105ActivationIdempotent()');
  run('testTreasuryT105ActivationAbsentConfig', 'testTreasuryT105ActivationAbsentConfig()');
  run('testTreasuryT105ActivationMalformedConfig', 'testTreasuryT105ActivationMalformedConfig()');
  run('testTreasuryT105ActivationPausedRefused', 'testTreasuryT105ActivationPausedRefused()');
  run('testTreasuryT105ActivationSurfaceGates', 'testTreasuryT105ActivationSurfaceGates()');
  run('testTreasuryT105ActivationAccountGate', 'testTreasuryT105ActivationAccountGate()');
  run('testTreasuryT105ActivationClearingGate', 'testTreasuryT105ActivationClearingGate()');
  run('testTreasuryT105ActivationResidualGate', 'testTreasuryT105ActivationResidualGate()');
  run('testTreasuryT105ActivationOutstandingAllowed', 'testTreasuryT105ActivationOutstandingAllowed()');
  run('testTreasuryT105ActivationConfigOnlyWrite', 'testTreasuryT105ActivationConfigOnlyWrite()');
  run('testTreasuryT105ActivationBusinessRowsUnchanged', 'testTreasuryT105ActivationBusinessRowsUnchanged()');
  run('testTreasuryT105ActivationLedgerUnchanged', 'testTreasuryT105ActivationLedgerUnchanged()');
  run('testTreasuryT105ActivationSalesUnchanged', 'testTreasuryT105ActivationSalesUnchanged()');
  run('testTreasuryT105ActivationIdentityReadback', 'testTreasuryT105ActivationIdentityReadback()');
  run('testTreasuryT105ActivationAmbiguousRecovery', 'testTreasuryT105ActivationAmbiguousRecovery()');
  run('testTreasuryT105ActivationSourceAudit', 'testTreasuryT105ActivationSourceAudit()');
  run('testTreasuryT105ActivationMutationSensitivity', 'JSON.stringify(runTreasuryT105ActivationMutationProof())');

  // T11.6/U4 — canonical readers + aggregate funds (T11.2 §12-§15): the
  // aggregate-funds projection, Balance Position, Cash Flow
  // anti-double-count, Revenue/P&L isolation, Transaction one-business-row,
  // Dashboard semantics, T5 composed SALES_MONEY_V2 clearing, global 1030
  // (transitional 24k + combined), date authority, read-mode/cache
  // coherence, and regression pins. Local read-only fixtures only.
  run('testSingleCommitAggregateFunds', 'testSingleCommitAggregateFunds()');
  run('testSingleCommitBalancePosition', 'testSingleCommitBalancePosition()');
  run('testSingleCommitCashFlow', 'testSingleCommitCashFlow()');
  run('testSingleCommitRevenuePAndL', 'testSingleCommitRevenuePAndL()');
  run('testSingleCommitTransactionOneRow', 'testSingleCommitTransactionOneRow()');
  run('testSingleCommitDashboardSemantics', 'testSingleCommitDashboardSemantics()');
  run('testSingleCommitT5ComposedClearing', 'testSingleCommitT5ComposedClearing()');
  run('testSingleCommitGlobal1030', 'testSingleCommitGlobal1030()');
  run('testSingleCommitDateAuthority', 'testSingleCommitDateAuthority()');
  run('testSingleCommitReadModeCache', 'testSingleCommitReadModeCache()');
  run('testSingleCommitRegressionPins', 'testSingleCommitRegressionPins()');

  // T11.7/U5 — control plane: config schema/reader, reconciled routing,
  // prep/activation/pause writers, idempotency/crash model, isolation proof,
  // package measurement. In-memory fixtures only; production mutations 0.
  run('testSingleCommitConfigReader', 'testSingleCommitConfigReader()');
  run('testSingleCommitRoutingMatrix', 'testSingleCommitRoutingMatrix()');
  run('testSingleCommitPreparationWriter', 'testSingleCommitPreparationWriter()');
  run('testSingleCommitActivationWriter', 'testSingleCommitActivationWriter()');
  run('testSingleCommitControlFailures', 'testSingleCommitControlFailures()');
  run('testSingleCommitPauseWriter', 'testSingleCommitPauseWriter()');
  run('testSingleCommitControlIsolation', 'testSingleCommitControlIsolation()');
  run('testSingleCommitCompatibility', 'testSingleCommitCompatibility()');
  run('testSingleCommitPackageMeasurement', 'testSingleCommitPackageMeasurement()');

  // T11.8/U6 — corrections/void/cancel task matrix (109 checks): Sales
  // Void/Correct with composed-money legs, Expense Cancel/Correct, Purchase
  // Cancel/Correct, durability (replay/conflict/already-*/UNKNOWN/missing/
  // tamper/duplicate/PAUSED-recovery), per-domain preflight, reporting
  // (Cash Flow once, Revenue, T5, aggregate funds), historical (24k
  // invariant, forbidden writers, legacy compatibility), and regression
  // isolation. In-memory fixtures only; production mutations 0.
  run('testSingleCommitCorrectionsSalesVoid', 'testSingleCommitCorrectionsSalesVoid()');
  run('testSingleCommitCorrectionsSalesCorrect', 'testSingleCommitCorrectionsSalesCorrect()');
  run('testSingleCommitCorrectionsExpenseCancel', 'testSingleCommitCorrectionsExpenseCancel()');
  run('testSingleCommitCorrectionsExpenseCorrect', 'testSingleCommitCorrectionsExpenseCorrect()');
  run('testSingleCommitCorrectionsPurchaseCancel', 'testSingleCommitCorrectionsPurchaseCancel()');
  run('testSingleCommitCorrectionsPurchaseCorrect', 'testSingleCommitCorrectionsPurchaseCorrect()');
  run('testSingleCommitCorrectionsDurability', 'testSingleCommitCorrectionsDurability()');
  run('testSingleCommitCorrectionsPreflight', 'testSingleCommitCorrectionsPreflight()');
  run('testSingleCommitCorrectionsReporting', 'testSingleCommitCorrectionsReporting()');
  run('testSingleCommitCorrectionsHistorical', 'testSingleCommitCorrectionsHistorical()');
  run('testSingleCommitCorrectionsRegression', 'testSingleCommitCorrectionsRegression()');

  console.log('\n===== NUMLOCK POLICY C LOCAL HARNESS: ' + pass + ' PASS, ' + fail + ' FAIL =====');
process.exit(fail > 0 ? 1 : 0);
