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

globalThis.Logger = { log: function() {} };
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
  '96.Tests.Transaction.Operational.Cases.js',
  '96.Tests.Transaction.Production.Readiness.Cases.js',
  '96.Tests.SalesRecognition.V2.Save.Cases.js',
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
  '96.Tests.Master.WritePolicy.Cases.js'
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
  'var _productionSource = ' + JSON.stringify(fs.readFileSync('95A.Transaction.Production.js', 'utf8')) + ';'
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

console.log('\n===== NUMLOCK POLICY C LOCAL HARNESS: ' + pass + ' PASS, ' + fail + ' FAIL =====');
process.exit(fail > 0 ? 1 : 0);
