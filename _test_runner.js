var fs = require('fs');
var vm = require('vm');

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
  '36.Finance.Service.js',
  '37.Depreciation.Service.js',
  '12A.Depreciation.Report.Service.js',
  '37.Inventory.Policy.Evidence.js',
  '91.Transactions.Query.js',
  '93.Master.WritePolicy.js',
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
  'var _htmlActions = ' + JSON.stringify(fs.readFileSync('195.View.Transactions.Actions.html', 'utf8')) + ';'
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

console.log('\n===== NUMLOCK POLICY C LOCAL HARNESS: ' + pass + ' PASS, ' + fail + ' FAIL =====');
process.exit(fail > 0 ? 1 : 0);
