// SALES_RECOGNITION_V2 U3 projection tests: focused local suites over the
// read-only Recognized Sales Projection. In-memory fixtures only; reuses the
// U2 save runtime fixtures for committed V2 artifacts. No production access,
// no network, no clasp, no writes outside fixture memory.

function u3BaseSheets_() {
  var base = salesV2SaveBaseSheets_();
  var t = TRANSACTION_PRODUCTION_CONTRACT;
  base.tabsal = [CANONICAL_ENTRY.SALES_HEADERS.slice()];
  base.Logs = [CANONICAL_ENTRY.LOG_HEADERS.slice()];
  base.Payments = [t.PAYMENTS.HEADERS.slice()];
  base.Settlements = [CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS.slice()];
  return base;
}

function u3AppendRow_(fixture, sheetName, headers, row) {
  var sheet = fixture.getSheetByName(sheetName);
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length)
    .setValues([headers.map(function(header) {
      return row[header] === undefined ? "" : row[header];
    })]);
}

function u3AppendOrder_(fixture, order, lines) {
  var t = TRANSACTION_PRODUCTION_CONTRACT;
  u3AppendRow_(fixture, "Orders", t.ORDERS.HEADERS, order);
  (lines || []).forEach(function(line) {
    u3AppendRow_(fixture, "OrderLines", t.ORDER_LINES.HEADERS, line);
  });
}

function u3OrderLine_(orderID, amount, index) {
  return { OrderLineID: "OL-" + orderID + "-" + (index || 1), OrderID: orderID,
    ProductID: "P1", ProductVariantID: "PV1", Tipe: "HOT", Qty: 1,
    SellingPriceSnapshot: amount, RecipeVersionID: "RV1", UnitHppSnapshot: 0,
    LineTotal: amount, LineHpp: 0 };
}

function u3AppendSale_(fixture, sale) {
  u3AppendRow_(fixture, "tabsal", CANONICAL_ENTRY.SALES_HEADERS,
    Object.assign({ Tipe: "Hot", Source: "LEGACY_GOOGLE", IsActive: true,
      CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }, sale));
}

function u3AppendLog_(fixture, entry) {
  u3AppendRow_(fixture, "Logs", CANONICAL_ENTRY.LOG_HEADERS, {
    ID_Log: "LOG-U3-" + entry.RecordID + "-" + entry.Action,
    Timestamp: "2026-10-10T00:00:00.000Z", Level: "INFO",
    Module: TRANSACTION_LIFECYCLE.MODULE, Action: entry.Action,
    RecordID: entry.RecordID, User: "u3",
    Message: "Canonical transaction lifecycle recorded.",
    Metadata: JSON.stringify(entry.Metadata || {}) });
}

function u3AppendPayment_(fixture, payment) {
  u3AppendRow_(fixture, "Payments", TRANSACTION_PRODUCTION_CONTRACT.PAYMENTS.HEADERS,
    Object.assign({ ReceiveVia: "1000", AccountCode: "1000", PaidBy: "u3" }, payment));
}

function u3AppendSettlement_(fixture, settlement) {
  u3AppendRow_(fixture, "Settlements", CASH_FOUNDATION_POLICY.SETTLEMENT_HEADERS,
    Object.assign({ Direction: "INFLOW", AccountCode: "1000", CounterAccountCode: "",
      Currency: "IDR", SourceType: "SALE_SETTLEMENT", RelatedTransactionType: "Order",
      RelatedTransactionID: "", TransferID: "", ExternalRef: "", Status: "POSTED",
      Keterangan: "", ReversalOf: "", IsActive: true, CreatedAt: "", CreatedBy: "",
      UpdatedAt: "", UpdatedBy: "" }, settlement));
}

function u3AppendLedger_(fixture, rows) {
  rows.forEach(function(row) {
    u3AppendRow_(fixture, "BalanceLedger", BALANCE_FOUNDATION_POLICY.BALANCE_LEDGER_HEADERS,
      Object.assign({ ExternalRef: "", Keterangan: "", IsActive: true, CreatedAt: "",
        CreatedBy: "u3", UpdatedAt: "", UpdatedBy: "u3" }, row));
  });
}

function u3AppendOperation_(fixture, operation) {
  u3AppendRow_(fixture, "TransactionOperations",
    TRANSACTION_PRODUCTION_CONTRACT.OPERATIONS.HEADERS, operation);
}

function u3AppendAudit_(fixture, audit) {
  u3AppendRow_(fixture, "SalesRecognitionAudits", SALES_RECOGNITION_V2_SAVE.AUDIT_HEADERS,
    audit);
}

function u3AppendEvent_(fixture, event) {
  u3AppendRow_(fixture, "SalesRecognitionEvents", SALES_RECOGNITION_V2_CONTRACT.HEADERS,
    event);
}

// Full pre-V2 evidence chain: order (+lines) + payment + settlement +
// PAID_SALE ledger credit + optional PAYMENT operation.
function u3PaidChain_(fixture, opts) {
  var lines = opts.lines || [u3OrderLine_(opts.orderID, opts.amount, 1)];
  u3AppendOrder_(fixture, { OrderID: opts.orderID, OrderNumber: opts.orderID,
    OrderType: "DINE_IN", PaymentStatus: opts.orderPaymentStatus || "PAID",
    FulfillmentStatus: opts.fulfillment || "COMPLETED", OrderTotal: opts.amount,
    HppTotalSnapshot: opts.hpp || 0, CreatedAt: "", CreatedBy: "u3",
    PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: "", UpdatedBy: "u3" },
    lines);
  if (!opts.paymentID) return;
  var payments = [{ PaymentID: opts.paymentID,
    Status: opts.paymentStatusValue || "SUCCESS",
    Amount: opts.paymentAmount === undefined ? opts.amount : opts.paymentAmount,
    PaidAt: opts.paidAt || "2026-10-20T03:00:00.000Z" }];
  if (opts.secondPaymentID) {
    payments.push({ PaymentID: opts.secondPaymentID, Status: "SUCCESS",
      Amount: opts.amount, PaidAt: opts.paidAt || "2026-10-20T03:00:00.000Z" });
  }
  payments.forEach(function(payment) {
    u3AppendPayment_(fixture, Object.assign({ OrderID: opts.orderID,
      RequestKey: "u3-" + payment.PaymentID }, payment));
  });
  if (!opts.noSettlement) {
    u3AppendSettlement_(fixture, { SettlementID: "CSH-SAL-" + opts.paymentID,
      Tanggal: String(opts.paidAt || "2026-10-20T03:00:00.000Z").slice(0, 10),
      Amount: opts.amount, SourceID: opts.paymentID,
      Status: opts.settlementStatus || "POSTED",
      RelatedTransactionID: opts.orderID });
  }
  if (!opts.noLedger) {
    var credit = opts.ledgerCredit === undefined ? opts.amount : opts.ledgerCredit;
    var day = String(opts.paidAt || "2026-10-20T03:00:00.000Z").slice(0, 10);
    var journalID = "CASH-SALE_SETTLEMENT-" + opts.paymentID;
    u3AppendLedger_(fixture, [
      { JournalID: journalID, LineID: journalID + "-1", Tanggal: day, AccountCode: "1000",
        Debit: credit, Credit: 0, MovementType: "PAID_SALE", SourceType: "SALE_SETTLEMENT",
        SourceID: opts.paymentID },
      { JournalID: journalID, LineID: journalID + "-2", Tanggal: day, AccountCode: "4000",
        Debit: 0, Credit: credit, MovementType: "PAID_SALE", SourceType: "SALE_SETTLEMENT",
        SourceID: opts.paymentID }
    ]);
    if (opts.hppLines) {
      u3AppendLedger_(fixture, [
        { JournalID: journalID, LineID: journalID + "-3", Tanggal: day, AccountCode: "5000",
          Debit: opts.hpp, Credit: 0, MovementType: "SALE_HPP", SourceType: "SALE_SETTLEMENT",
          SourceID: opts.paymentID },
        { JournalID: journalID, LineID: journalID + "-4", Tanggal: day, AccountCode: "1100",
          Debit: 0, Credit: opts.hpp, MovementType: "SALE_HPP", SourceType: "SALE_SETTLEMENT",
          SourceID: opts.paymentID }
      ]);
    }
  }
  if (opts.withPaymentOp || opts.paymentOpState) {
    u3AppendOperation_(fixture, { OperationID: "TXOP-PAY-" + opts.paymentID,
      OperationType: "PAYMENT", BusinessID: opts.paymentID,
      RequestKey: "u3-" + opts.paymentID, State: opts.paymentOpState || "COMMITTED",
      PayloadHash: "H-U3", OperationPlan: "{}", CreatedAt: "2026-10-18T00:00:00.000Z",
      UpdatedAt: "2026-10-18T00:00:00.000Z", LastError: "" });
  }
}

// The U2 test repository keeps operations in memory; mirror them into the
// fixture sheet so the sheet-based projection reader observes the same
// committed operation evidence production persists.
function u3MirrorOperations_(fixture, repository) {
  var t = TRANSACTION_PRODUCTION_CONTRACT;
  var sheet = fixture.getSheetByName("TransactionOperations");
  repository.rows().forEach(function(operation) {
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, t.OPERATIONS.HEADERS.length)
      .setValues([t.OPERATIONS.HEADERS.map(function(header) {
        return operation[header] === undefined ? "" : operation[header];
      })]);
  });
}

function u3Payload_(key, qty) {
  return { requestKey: key, orderType: "DINE_IN",
    lines: [{ productID: "P1", productVariantID: "PV1", qty: qty || 2 }] };
}

// Committed V2 save via the real U2 runtime (authoritative committed rows).
function u3SaveFixture_(key) {
  var fixture = salesV2SaveFixture_(u3BaseSheets_());
  var runtime = salesV2SaveRuntime_({ fixture: fixture });
  var result = salesRecognitionV2SaveWithRuntime_(u3Payload_(key), runtime);
  if (result.status !== "DONE") {
    throw new Error("U3_SAVE_FAILED:" + key + ":" + result.status + ":" + result.code);
  }
  var plan = JSON.parse(runtime.repository.rows()[0].OperationPlan);
  u3MirrorOperations_(fixture, runtime.repository);
  var events = readCanonicalTable(fixture, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS);
  return { fixture: fixture, runtime: runtime, result: result, plan: plan,
    orderID: result.orderID, eventRow: events[0] };
}

// Manually committed V2 recognition artifact set (op + audit + event +
// SRV2J- journal + snapshot). Used for replacements and integrity fixtures.
function u3CommittedAppend_(fixture, opts) {
  var contract = SALES_RECOGNITION_V2_CONTRACT, save = SALES_RECOGNITION_V2_SAVE;
  var orderID = opts.orderID;
  var recognitionID = opts.recognitionID || ("SCR-U3-" + orderID);
  var revisionID = opts.revisionID || ("REV-U3-" + orderID);
  var journalID = "SRV2J-U3-" + orderID + (opts.suffix || "");
  var auditID = "SRA-U3-" + orderID + (opts.suffix || "");
  var operationID = "TXOP-U3-" + orderID + (opts.suffix || "");
  var requestKey = opts.requestKey || ("u3-" + orderID + (opts.suffix || ""));
  var amount = opts.amount;
  var journalRows = [
    { JournalID: journalID, LineID: journalID + "-1", Tanggal: opts.date,
      AccountCode: "1030", Debit: amount, Credit: 0,
      MovementType: save.JOURNAL_MOVEMENT_TYPE, SourceType: save.JOURNAL_SOURCE_TYPE,
      SourceID: recognitionID },
    { JournalID: journalID, LineID: journalID + "-2", Tanggal: opts.date,
      AccountCode: "4000", Debit: 0, Credit: amount,
      MovementType: save.JOURNAL_MOVEMENT_TYPE, SourceType: save.JOURNAL_SOURCE_TYPE,
      SourceID: recognitionID }
  ];
  var signature = policyCJournalSignature_(journalRows);
  var snapshot = { contractVersion: contract.CONTRACT_VERSION,
    activationID: opts.activationID || "ACT-U2", revisionID: revisionID,
    journalID: journalID, journalSignature: signature, orderTotal: amount,
    hppTotalSnapshot: opts.hpp || 0,
    lines: [{ OrderLineID: "OL-REP-" + orderID + (opts.lineSuffix || "") + "-1",
      ProductVariantID: "PV1", Qty: 1, SellingPriceSnapshot: amount,
      RecipeVersionID: "RV1", UnitHppSnapshot: 0, LineTotal: amount, LineHpp: 0 }] };
  var hasOrder = fixture.getSheetByName("Orders").values.some(function(row) {
    return String(row[0]) === orderID;
  });
  if (!hasOrder) {
    u3AppendOrder_(fixture, { OrderID: orderID, OrderNumber: orderID,
      OrderType: "DINE_IN", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
      OrderTotal: amount, HppTotalSnapshot: opts.hpp || 0, CreatedAt: "",
      CreatedBy: "u3", PreparingAt: "", ReadyAt: "", CompletedAt: "",
      UpdatedAt: "", UpdatedBy: "u3" },
      [u3OrderLine_(orderID, amount, 1)]);
  }
  u3AppendOperation_(fixture, { OperationID: operationID,
    OperationType: save.OPERATION_TYPE, BusinessID: orderID, RequestKey: requestKey,
    State: "COMMITTED", PayloadHash: "H-U3-" + orderID + (opts.suffix || ""),
    OperationPlan: "{}", CreatedAt: opts.recognizedAt, UpdatedAt: opts.recognizedAt,
    LastError: "" });
  u3AppendAudit_(fixture, { AuditID: auditID, ContractVersion: contract.CONTRACT_VERSION,
    OperationID: operationID, RequestKey: requestKey, OrderID: orderID,
    RecognitionID: recognitionID, JournalID: journalID,
    PayloadHash: "H-U3-" + orderID + (opts.suffix || ""), Actor: "u3",
    SavedAt: opts.recognizedAt });
  u3AppendEvent_(fixture, { RecognitionID: recognitionID,
    ContractVersion: contract.CONTRACT_VERSION,
    ActivationID: opts.activationID || "ACT-U2", OrderID: orderID,
    RevisionID: revisionID, EventType: "RECOGNITION",
    RecognizedAt: opts.recognizedAt, EconomicDate: opts.date, Amount: amount,
    RecognitionJournalID: journalID, JournalSignature: signature,
    PostingStatus: "COMMITTED", OperationID: operationID, AuditID: auditID,
    OriginalID: opts.originalID || "", ReversalOfRecognitionID: "",
    ReplacementID: "", Reason: opts.reason || "", Actor: "u3",
    SnapshotJSON: JSON.stringify(snapshot) });
  u3AppendLedger_(fixture, journalRows.map(function(row) {
    return Object.assign({ ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: opts.recognizedAt, CreatedBy: "u3", UpdatedAt: opts.recognizedAt,
      UpdatedBy: "u3" }, row);
  }));
  return { recognitionID: recognitionID, revisionID: revisionID, journalID: journalID,
    auditID: auditID, operationID: operationID };
}

// Signed reversal artifact set against an existing recognition target.
function u3ReversalAppend_(fixture, target, opts) {
  var contract = SALES_RECOGNITION_V2_CONTRACT, save = SALES_RECOGNITION_V2_SAVE;
  var suffix = opts.suffix || "";
  var recognitionID = opts.recognitionID || ("SCR-U3R-" + target.OrderID + suffix);
  var revisionID = opts.revisionID || ("REV-R-" + target.OrderID + suffix);
  var journalID = "SRV2J-U3R-" + target.OrderID + suffix;
  var amount = Number(target.Amount);
  var journalRows = [
    { JournalID: journalID, LineID: journalID + "-1", Tanggal: opts.date,
      AccountCode: "4000", Debit: amount, Credit: 0,
      MovementType: save.JOURNAL_MOVEMENT_TYPE, SourceType: save.JOURNAL_SOURCE_TYPE,
      SourceID: recognitionID },
    { JournalID: journalID, LineID: journalID + "-2", Tanggal: opts.date,
      AccountCode: "1030", Debit: 0, Credit: amount,
      MovementType: save.JOURNAL_MOVEMENT_TYPE, SourceType: save.JOURNAL_SOURCE_TYPE,
      SourceID: recognitionID }
  ];
  var signature = policyCJournalSignature_(journalRows);
  u3AppendEvent_(fixture, { RecognitionID: recognitionID,
    ContractVersion: contract.CONTRACT_VERSION, ActivationID: target.ActivationID,
    OrderID: target.OrderID, RevisionID: revisionID, EventType: "REVERSAL",
    RecognizedAt: opts.recognizedAt, EconomicDate: opts.date, Amount: amount,
    RecognitionJournalID: journalID, JournalSignature: signature,
    PostingStatus: "COMMITTED", OperationID: "", AuditID: "",
    OriginalID: "", ReversalOfRecognitionID: opts.targetRecognitionID === undefined ?
      target.RecognitionID : opts.targetRecognitionID,
    ReplacementID: "", Reason: opts.reason || "U3_REVERSAL", Actor: "u3",
    SnapshotJSON: JSON.stringify({ journalSignature: signature, orderTotal: amount }) });
  u3AppendLedger_(fixture, journalRows.map(function(row) {
    return Object.assign({ ExternalRef: "", Keterangan: "", IsActive: true,
      CreatedAt: opts.recognizedAt, CreatedBy: "u3", UpdatedAt: opts.recognizedAt,
      UpdatedBy: "u3" }, row);
  }));
  return { recognitionID: recognitionID, revisionID: revisionID };
}

function u3IssueCodes_(projection) {
  return projection.quality.issues.map(function(issue) { return issue.code; });
}

function u3HasIssue_(projection, code, sourceIdentity) {
  return projection.quality.issues.some(function(issue) {
    return issue.code === code &&
      (sourceIdentity === undefined || issue.sourceIdentity === sourceIdentity);
  });
}

function u3EventByNamespace_(projection, namespace) {
  var found = null;
  projection.events.forEach(function(event) {
    if (event.namespace === namespace) found = event;
  });
  return found;
}

function u3SheetSnapshot_(fixture, names) {
  return JSON.stringify(names.map(function(name) {
    var sheet = fixture.getSheetByName(name);
    return sheet ? sheet.values : null;
  }));
}

function testSalesRecognitionV2ProjectionCore() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U3_CORE:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var contract = SALES_RECOGNITION_V2_CONTRACT, save = SALES_RECOGNITION_V2_SAVE,
    iss = SALES_RECOGNITION_PROJECTION.ISSUES,
    t = TRANSACTION_PRODUCTION_CONTRACT,
    readNames = ["tabsal", "Logs", "Orders", "OrderLines", "Payments", "Settlements",
      "TransactionOperations", "BalanceLedger", "SalesRecognitionEvents",
      "SalesRecognitionAudits"];
  // ---- A. Legacy cohort: lifecycle authority, identity, eligibility ----
  var fA = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendSale_(fA, { ID_Trx: "SAL-L1", Tanggal: "2026-10-05T12:00:00Z",
    ID_Prod: "P1", Qty: 3, HPP: 5000, HJ: 10000 });
  u3AppendSale_(fA, { ID_Trx: "SAL-L2", Tanggal: "2026-10-06T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 8000, HJ: 20000, IsActive: false });
  u3AppendSale_(fA, { ID_Trx: "SAL-L4", Tanggal: "2026-10-07T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 4000, HJ: 10000, IsActive: false });
  u3AppendSale_(fA, { ID_Trx: "SAL-L5", Tanggal: "2026-10-07T12:00:00Z",
    ID_Prod: "P1", Qty: 2, HPP: 4000, HJ: 12000 });
  u3AppendSale_(fA, { ID_Trx: "SAL-L6", Tanggal: "2026-10-08T12:00:00Z",
    ID_Prod: "P-MISSING", Qty: 1, HPP: 1000, HJ: 2000 });
  u3AppendLog_(fA, { RecordID: "SAL-L4", Action: "CORRECT_VOID_SALES",
    Metadata: { replacementId: "SAL-L5", reason: "u3" } });
  u3AppendLog_(fA, { RecordID: "SAL-L5", Action: "CORRECT_CREATE_SALES",
    Metadata: { originalId: "SAL-L4", reason: "u3" } });
  var beforeA = u3SheetSnapshot_(fA, readNames);
  var pA = buildRecognizedSalesProjectionFromSpreadsheet_(fA);
  var afterA = u3SheetSnapshot_(fA, readNames);
  var evA1 = u3EventByNamespace_(pA, "LEGACY:SAL-L1:R0");
  var evA5 = u3EventByNamespace_(pA, "LEGACY:SAL-L5:R0");
  check("A1", !!evA1 && evA1.sourceIdentity === "LEGACY:SAL-L1" &&
    evA1.recognitionId === "LEGACY:SAL-L1:R0" && evA1.status === "RECOGNIZED" &&
    evA1.signedAmount === 30000 && evA1.dateKey === "2026-10-05" &&
    evA1.cohort === "TABSAL_LEGACY" &&
    pA.events.filter(function(e) { return e.sourceIdentity === "LEGACY:SAL-L1"; }).length === 1);
  check("A2", !u3EventByNamespace_(pA, "LEGACY:SAL-L2:R0") &&
    !u3EventByNamespace_(pA, "LEGACY:SAL-L4:R0") && !!evA5 && evA5.signedAmount === 24000 &&
    u3HasIssue_(pA, iss.LEGACY_INACTIVE_EXCLUDED, "LEGACY:SAL-L2") &&
    u3HasIssue_(pA, iss.LEGACY_INACTIVE_EXCLUDED, "LEGACY:SAL-L4"));
  check("A3", pA.transactions.filter(function(entry) {
    return entry.kind === "LEGACY_SALE"; }).length === 2 &&
    pA.transactions.some(function(entry) { return entry.headerId === "SAL-L1"; }) &&
    pA.transactions.some(function(entry) { return entry.headerId === "SAL-L5"; }));
  check("A4", beforeA === afterA);
  check("A5", u3HasIssue_(pA, iss.LEGACY_ROW_INELIGIBLE, "tabsal") &&
    !u3EventByNamespace_(pA, "LEGACY:SAL-L6:R0"));
  // ---- B. Pre-V2 evidence chain ----
  var fB = salesV2SaveFixture_(u3BaseSheets_());
  u3PaidChain_(fB, { orderID: "ORD-UNPAID-1", amount: 25000,
    orderPaymentStatus: "UNPAID", fulfillment: "OPEN", paymentID: "PAY-U1",
    paymentStatusValue: "PENDING", paidAt: "2026-10-25T04:00:00.000Z" });
  u3PaidChain_(fB, { orderID: "ORD-PAID-1", amount: 40000, paymentID: "PAY-P1",
    paidAt: "2026-10-20T03:00:00.000Z", fulfillment: "OPEN", withPaymentOp: true,
    lines: [u3OrderLine_("ORD-PAID-1", 20000, 1), u3OrderLine_("ORD-PAID-1", 20000, 2)] });
  u3PaidChain_(fB, { orderID: "ORD-MATCHA-1", amount: 36000, hpp: 15130.58,
    paymentID: "PAY-M1", paidAt: "2026-10-21T05:00:00.000Z", hppLines: true });
  u3PaidChain_(fB, { orderID: "ORD-DUP-1", amount: 30000, paymentID: "PAY-D1",
    secondPaymentID: "PAY-D2" });
  u3PaidChain_(fB, { orderID: "ORD-AMT-1", amount: 20000, paymentID: "PAY-A1",
    paymentAmount: 10000, noSettlement: true, noLedger: true });
  u3PaidChain_(fB, { orderID: "ORD-NOSET-1", amount: 12000, paymentID: "PAY-N1",
    noSettlement: true, noLedger: true });
  u3PaidChain_(fB, { orderID: "ORD-BADSET-1", amount: 13000, paymentID: "PAY-B1",
    settlementStatus: "PENDING", noLedger: true });
  u3PaidChain_(fB, { orderID: "ORD-OPPEND-1", amount: 14000, paymentID: "PAY-O1",
    paymentOpState: "IN_PROGRESS" });
  u3PaidChain_(fB, { orderID: "ORD-NOLEDG-1", amount: 15000, paymentID: "PAY-L1",
    noLedger: true });
  u3PaidChain_(fB, { orderID: "ORD-BADLEDG-1", amount: 30000, paymentID: "PAY-K1",
    ledgerCredit: 1000 });
  var pB = buildRecognizedSalesProjectionFromSpreadsheet_(fB);
  check("B1", !u3EventByNamespace_(pB, "ORDER:ORD-UNPAID-1:R0") &&
    u3HasIssue_(pB, iss.OLD_ORDER_UNPAID_EXCLUDED, "ORDER:ORD-UNPAID-1:R0") &&
    pB.quality.excluded.some(function(entry) {
      return entry.sourceIdentity === "ORDER:ORD-UNPAID-1:R0"; }),
    JSON.stringify({ ev: pB.events.map(function(e) { return e.namespace; }),
      iss: pB.quality.issues, exc: pB.quality.excluded }));
  var evPaid = u3EventByNamespace_(pB, "ORDER:ORD-PAID-1:R0");
  var adapterPaid = null;
  pB.transactions.forEach(function(entry) {
    if (entry.headerId === "ORD-PAID-1") adapterPaid = entry;
  });
  check("B2", !!evPaid && evPaid.status === "RECOGNIZED" && evPaid.signedAmount === 40000 &&
    evPaid.dateKey === "2026-10-20" && !!adapterPaid &&
    adapterPaid.fulfillmentStatus === "OPEN" && adapterPaid.status === "RECOGNIZED");
  var evMatcha = pB.events.filter(function(e) {
    return e.sourceIdentity === "ORDER:ORD-MATCHA-1:R0"; });
  check("B3", evMatcha.length === 1 && evMatcha[0].signedAmount === 36000);
  check("B4", u3HasIssue_(pB, iss.OLD_PAYMENT_DUPLICATE_SUCCESS, "ORDER:ORD-DUP-1:R0") &&
    !u3EventByNamespace_(pB, "ORDER:ORD-DUP-1:R0"));
  check("B5", u3HasIssue_(pB, iss.OLD_PAYMENT_AMOUNT_CONFLICT, "ORDER:ORD-AMT-1:R0") &&
    !u3EventByNamespace_(pB, "ORDER:ORD-AMT-1:R0"));
  check("B6", u3HasIssue_(pB, iss.OLD_PAYMENT_SETTLEMENT_MISSING, "ORDER:ORD-NOSET-1:R0") &&
    !u3EventByNamespace_(pB, "ORDER:ORD-NOSET-1:R0"));
  check("B7", u3HasIssue_(pB, iss.OLD_PAYMENT_SETTLEMENT_INVALID, "ORDER:ORD-BADSET-1:R0") &&
    !u3EventByNamespace_(pB, "ORDER:ORD-BADSET-1:R0"));
  check("B8", u3HasIssue_(pB, iss.OLD_PAYMENT_OPERATION_PENDING, "ORDER:ORD-OPPEND-1:R0") &&
    !u3EventByNamespace_(pB, "ORDER:ORD-OPPEND-1:R0"));
  check("B9", u3HasIssue_(pB, iss.OLD_PAYMENT_LEDGER_MISSING, "ORDER:ORD-NOLEDG-1:R0") &&
    !u3EventByNamespace_(pB, "ORDER:ORD-NOLEDG-1:R0"));
  check("B10", u3HasIssue_(pB, iss.OLD_PAYMENT_LEDGER_MISMATCH, "ORDER:ORD-BADLEDG-1:R0") &&
    !u3EventByNamespace_(pB, "ORDER:ORD-BADLEDG-1:R0"));
  check("B11", pB.events.length === 2 &&
    pB.lines.filter(function(line) {
      return line.sourceIdentity === "ORDER:ORD-PAID-1:R0"; }).length === 2);
  check("B12", pB.quality.excluded.length === 8 &&
    pB.quality.issues.every(function(issue) {
      return pB.quality.excluded.some(function(entry) {
        return entry.reason === issue.code || entry.sourceIdentity === issue.sourceIdentity;
      }) || issue.code === iss.LEGACY_ROW_INELIGIBLE; }));
  // ---- C. V2 cohort via sticky classification + committed verification ----
  var c1 = u3SaveFixture_("u3-core-committed");
  var pC1 = buildRecognizedSalesProjectionFromSpreadsheet_(c1.fixture);
  var evC1 = u3EventByNamespace_(pC1, "ORDER:" + c1.orderID + ":" + c1.plan.revisionID);
  var adapterC1 = null;
  pC1.transactions.forEach(function(entry) {
    if (entry.headerId === c1.orderID) adapterC1 = entry;
  });
  check("C1", pC1.events.length === 1 && !!evC1 && evC1.status === "RECOGNIZED" &&
    evC1.recognitionId === c1.plan.recognitionID && evC1.signedAmount === 40000 &&
    !!adapterC1 && adapterC1.kind === "ORDER" && adapterC1.status === "RECOGNIZED" &&
    pC1.activeView.events.length === 1 && pC1.quality.issues.length === 0,
    JSON.stringify({ n: pC1.events.length, ev: evC1, ad: adapterC1,
      av: pC1.activeView.events.length, iss: pC1.quality.issues }));
  var fC2 = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendOrder_(fC2, { OrderID: "ORD-PEND-1", OrderNumber: "ORD-PEND-1",
    OrderType: "DINE_IN", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
    OrderTotal: 55000, HppTotalSnapshot: 0, CreatedAt: "", CreatedBy: "u3",
    PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: "", UpdatedBy: "u3" },
    [u3OrderLine_("ORD-PEND-1", 55000, 1)]);
  u3AppendEvent_(fC2, { RecognitionID: "SCR-PEND-1",
    ContractVersion: contract.CONTRACT_VERSION, ActivationID: "ACT-U2",
    OrderID: "ORD-PEND-1", RevisionID: "REV-PEND-1", EventType: "RECOGNITION",
    RecognizedAt: "2026-10-21T01:00:00.000Z", EconomicDate: "2026-10-21",
    Amount: 55000, RecognitionJournalID: "SRV2J-PEND-1", JournalSignature: "pend",
    PostingStatus: "PENDING", OperationID: "", AuditID: "", OriginalID: "",
    ReversalOfRecognitionID: "", ReplacementID: "", Reason: "", Actor: "u3",
    SnapshotJSON: "{}" });
  var pC2 = buildRecognizedSalesProjectionFromSpreadsheet_(fC2);
  check("C2", u3HasIssue_(pC2, iss.INCOMPLETE_V2_RECOGNITION, "ORDER:ORD-PEND-1:") &&
    pC2.quality.excluded.some(function(entry) {
      return entry.sourceIdentity === "ORDER:ORD-PEND-1:" &&
        entry.cohort === "V2_PENDING"; }) &&
    (function() {
      var pending = u3EventByNamespace_(pC2, "ORDER:ORD-PEND-1:REV-PEND-1");
      return !!pending && pending.status === "PENDING" && pending.signedAmount === 0;
    })() && !u3EventByNamespace_(pC2, "ORDER:ORD-PEND-1:R0") &&
    !u3HasIssue_(pC2, iss.OLD_ORDER_UNPAID_EXCLUDED, "ORDER:ORD-PEND-1:R0"));
  var rtC3 = salesV2SaveRuntime_({ fixture: salesV2SaveFixture_(u3BaseSheets_()),
    crash: "V2_AFTER_INTENT" });
  try { salesRecognitionV2SaveWithRuntime_(u3Payload_("u3-core-recovery"), rtC3); }
  catch (crashC3) {}
  u3MirrorOperations_(rtC3.spreadsheet, rtC3.repository);
  var orderC3 = transactionStableBusinessID_("ORD-", save.OPERATION_TYPE, "u3-core-recovery");
  var pC3 = buildRecognizedSalesProjectionFromSpreadsheet_(rtC3.spreadsheet);
  check("C3", pC3.quality.recoveryIssues.some(function(issue) {
      return issue.code === iss.RECOVERY_REQUIRED_V2 &&
        issue.sourceIdentity === "ORDER:" + orderC3 + ":"; }) &&
    pC3.quality.excluded.some(function(entry) {
      return entry.sourceIdentity === "ORDER:" + orderC3 + ":" &&
        entry.status === "RECOVERY_REQUIRED"; }) &&
    pC3.events.length === 0);
  var c4 = u3SaveFixture_("u3-core-partial");
  c4.fixture.getSheetByName("SalesRecognitionAudits").values.pop();
  var pC4 = buildRecognizedSalesProjectionFromSpreadsheet_(c4.fixture);
  check("C4", pC4.events.length === 0 &&
    u3HasIssue_(pC4, iss.INCOMPLETE_V2_RECOGNITION,
      "ORDER:" + c4.orderID + ":" + c4.plan.revisionID) &&
    pC4.quality.excluded.some(function(entry) {
      return entry.status === "EXCLUDED_INCOMPLETE"; }));
  var c5 = u3SaveFixture_("u3-core-tamper");
  c5.fixture.getSheetByName("BalanceLedger").values[2][5] = 1;
  var pC5 = buildRecognizedSalesProjectionFromSpreadsheet_(c5.fixture);
  check("C5", pC5.events.length === 0 &&
    u3HasIssue_(pC5, iss.RECOGNITION_JOURNAL_MISMATCH,
      "ORDER:" + c5.orderID + ":" + c5.plan.revisionID) &&
    pC5.quality.excluded.some(function(entry) {
      return entry.status === "INTEGRITY_CONFLICT"; }));
  var c6 = u3SaveFixture_("u3-core-freeze");
  var frozenLine = JSON.parse(c6.eventRow.SnapshotJSON).lines[0];
  c6.fixture.getSheetByName("OrderLines").values[1][6] = 99999;
  c6.fixture.getSheetByName("ProductPricing").values[1][5] = 88888;
  c6.fixture.getSheetByName("Orders").values[1][5] = 1;
  var pC6 = buildRecognizedSalesProjectionFromSpreadsheet_(c6.fixture);
  var evC6 = u3EventByNamespace_(pC6, "ORDER:" + c6.orderID + ":" + c6.plan.revisionID);
  check("C6", !!evC6 && evC6.status === "RECOGNIZED" && evC6.signedAmount === 40000 &&
    evC6.snapshot.lines[0].SellingPriceSnapshot === frozenLine.SellingPriceSnapshot &&
    evC6.snapshot.lines[0].LineTotal === frozenLine.LineTotal);
  var fC7 = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendOrder_(fC7, { OrderID: "ORD-NOEVT-1", OrderNumber: "ORD-NOEVT-1",
    OrderType: "DINE_IN", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
    OrderTotal: 9000, HppTotalSnapshot: 0, CreatedAt: "", CreatedBy: "u3",
    PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: "", UpdatedBy: "u3" },
    [u3OrderLine_("ORD-NOEVT-1", 9000, 1)]);
  u3AppendOperation_(fC7, { OperationID: "TXOP-NOEVT-1",
    OperationType: save.OPERATION_TYPE, BusinessID: "ORD-NOEVT-1",
    RequestKey: "u3-noevt", State: "COMMITTED", PayloadHash: "H-U3",
    OperationPlan: "{}", CreatedAt: "2026-10-15T00:00:00.000Z",
    UpdatedAt: "2026-10-15T00:00:00.000Z", LastError: "" });
  var pC7 = buildRecognizedSalesProjectionFromSpreadsheet_(fC7);
  check("C7", pC7.quality.recoveryIssues.some(function(issue) {
      return issue.code === iss.COMMITTED_OPERATION_RECOGNITION_MISSING &&
        issue.sourceIdentity === "ORD-NOEVT-1"; }) &&
    pC7.events.length === 0);
  // ---- D. Multiline: one header transaction, one amount, N lines ----
  var fD = salesV2SaveFixture_(u3BaseSheets_());
  u3PaidChain_(fD, { orderID: "ORD-MULTI-1", amount: 60000, paymentID: "PAY-ML1",
    paidAt: "2026-10-19T02:00:00.000Z",
    lines: [u3OrderLine_("ORD-MULTI-1", 30000, 1), u3OrderLine_("ORD-MULTI-1", 30000, 2)] });
  var pD = buildRecognizedSalesProjectionFromSpreadsheet_(fD);
  check("D1", pD.totals.recognizedRevenue === 60000 && pD.events.length === 1 &&
    pD.events[0].signedAmount === 60000);
  check("D2", pD.totals.byPeriod["2026-10"] === 60000 && pD.lines.filter(function(line) {
    return line.sourceIdentity === "ORDER:ORD-MULTI-1:R0"; }).length === 2);
  // ---- E. Dedup: identical date/amount economics are NEVER merged ----
  var fE = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendSale_(fE, { ID_Trx: "SAL-E1", Tanggal: "2026-10-09T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 5000, HJ: 15000 });
  u3AppendSale_(fE, { ID_Trx: "SAL-E2", Tanggal: "2026-10-09T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 5000, HJ: 15000 });
  u3PaidChain_(fE, { orderID: "ORD-EA-1", amount: 20000, paymentID: "PAY-EA1",
    paidAt: "2026-10-22T03:00:00.000Z" });
  u3PaidChain_(fE, { orderID: "ORD-EB-1", amount: 20000, paymentID: "PAY-EB1",
    paidAt: "2026-10-22T03:00:00.000Z" });
  var pE = buildRecognizedSalesProjectionFromSpreadsheet_(fE);
  check("E1", pE.events.length === 4 &&
    pE.events.filter(function(e) { return e.status === "RECOGNIZED"; }).length === 4 &&
    !u3IssueCodes_(pE).some(function(code) {
      return code === iss.DUPLICATE_RECOGNITION_ID || code === iss.DUPLICATE_SOURCE_IDENTITY; }));
  check("E2", pE.totals.recognizedRevenue === 70000 &&
    pE.totals.recognizedEventCount === 4);
  // ---- F. Period attribution: own EconomicDate, no backdating ----
  var fF = u3SaveFixture_("u3-core-period");
  u3ReversalAppend_(fF.fixture, fF.eventRow, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z" });
  u3CommittedAppend_(fF.fixture, { orderID: fF.orderID,
    recognitionID: "SCR-UREP-" + fF.orderID, revisionID: "REV-REP-" + fF.orderID,
    suffix: "-rep", amount: 81000, date: "2026-11-15",
    recognizedAt: "2026-12-01T00:00:00.000Z", originalID: fF.eventRow.RecognitionID });
  var pF = buildRecognizedSalesProjectionFromSpreadsheet_(fF.fixture);
  check("F1", JSON.stringify(pF.totals.periods) ===
      JSON.stringify(["2026-10", "2026-11"]) &&
    pF.totals.byPeriod["2026-10"] === 40000 && pF.totals.byPeriod["2026-11"] === 41000 &&
    pF.totals.recognizedRevenue === 81000,
    JSON.stringify({ tp: pF.totals, ev: pF.events.map(function(e) {
      return e.namespace + ":" + e.status + ":" + e.dateKey + ":" + e.signedAmount; }),
      iss: pF.quality.issues }));
  var pF2 = buildRecognizedSalesProjectionFromSpreadsheet_(fF.fixture);
  check("F2", pF2.totals.byPeriod["2026-10"] === 40000 &&
    pF.events.length === 3 && pF2.events.length === 3);
  check("F3", pF.activeView.events.length === 1 &&
    pF.activeView.events[0].namespace ===
      "ORDER:" + fF.orderID + ":REV-REP-" + fF.orderID &&
    pF.activeView.totals.recognizedRevenue === 81000);
  // ---- G. Totals from events ONLY; ledger non-additive; read-only ----
  var eventSum = 0;
  pB.events.forEach(function(event) {
    if (event.status === "RECOGNIZED") eventSum += event.signedAmount;
  });
  check("G1", pB.totals.recognizedRevenue === 76000 &&
    pB.totals.recognizedRevenue === eventSum);
  check("G2", pB.totals.ledgerRevenueCredits === 146000 &&
    pB.totals.ledgerRevenueCredits !== pB.totals.recognizedRevenue);
  var lineSum = 0;
  pB.lines.forEach(function(line) { lineSum += line.amount; });
  check("G3", lineSum !== pB.totals.recognizedRevenue && lineSum > pB.totals.recognizedRevenue);
  check("G4", beforeA === afterA && u3SheetSnapshot_(fB, readNames) ===
    u3SheetSnapshot_(fB, readNames));
  return { total: pass, pass: pass, fail: 0 };
}

function testSalesRecognitionV2ProjectionLineage() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U3_LINEAGE:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var contract = SALES_RECOGNITION_V2_CONTRACT, iss = SALES_RECOGNITION_PROJECTION.ISSUES;
  function lineageBase_(name) { return u3SaveFixture_("u3-lin-" + name); }
  // L1 original committed recognition
  var fL1 = lineageBase_("original");
  var pL1 = buildRecognizedSalesProjectionFromSpreadsheet_(fL1.fixture);
  var nsL1 = "ORDER:" + fL1.orderID + ":" + fL1.plan.revisionID;
  check("L1", pL1.events.length === 1 &&
    pL1.events[0].namespace === nsL1 && pL1.events[0].signedAmount === 40000 &&
    pL1.totals.byPeriod["2026-10"] === 40000,
    JSON.stringify({ n: pL1.events.length, ev: pL1.events,
      iss: pL1.quality.issues, tp: pL1.totals }));
  // L2 signed reversal in the next period
  var fL2 = lineageBase_("reversal");
  u3ReversalAppend_(fL2.fixture, fL2.eventRow, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z" });
  var pL2 = buildRecognizedSalesProjectionFromSpreadsheet_(fL2.fixture);
  var revL2 = pL2.events.filter(function(e) { return e.eventType === "REVERSAL"; });
  check("L2", pL2.events.length === 2 && revL2.length === 1 &&
    revL2[0].signedAmount === -40000 && revL2[0].status === "RECOGNIZED" &&
    pL2.totals.byPeriod["2026-11"] === -40000 &&
    pL2.totals.byPeriod["2026-10"] === 40000);
  // L3 replacement with own identity/revision
  var fL3 = lineageBase_("replacement");
  u3ReversalAppend_(fL3.fixture, fL3.eventRow, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z" });
  u3CommittedAppend_(fL3.fixture, { orderID: fL3.orderID,
    recognitionID: "SCR-UREP-" + fL3.orderID, revisionID: "REV-REP-" + fL3.orderID,
    suffix: "-rep", amount: 81000, date: "2026-11-15",
    recognizedAt: "2026-12-01T00:00:00.000Z", originalID: fL3.eventRow.RecognitionID });
  var pL3 = buildRecognizedSalesProjectionFromSpreadsheet_(fL3.fixture);
  var repL3 = u3EventByNamespace_(pL3, "ORDER:" + fL3.orderID + ":REV-REP-" + fL3.orderID);
  check("L3", pL3.events.length === 3 && !!repL3 &&
    repL3.signedAmount === 81000 && repL3.recognitionId === "SCR-UREP-" + fL3.orderID &&
    pL3.totals.recognizedRevenue === 81000);
  // L4 active view vs immutable economic history
  check("L4", pL3.activeView.events.length === 1 &&
    pL3.activeView.events[0].namespace === repL3.namespace &&
    pL3.activeView.totals.recognizedRevenue === 81000 &&
    pL3.events.length === 3 && pL3.totals.recognizedEventCount === 3,
    JSON.stringify({ av: pL3.activeView, n: pL3.events.length,
      rc: pL3.totals.recognizedEventCount, rep: repL3 && repL3.namespace }));
  // L5 duplicate terminal reversals fail closed
  var fL5 = lineageBase_("dup-reversal");
  u3ReversalAppend_(fL5.fixture, fL5.eventRow, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z" });
  u3ReversalAppend_(fL5.fixture, fL5.eventRow, { date: "2026-11-11",
    recognizedAt: "2026-11-21T00:00:00.000Z", suffix: "-2" });
  var pL5 = buildRecognizedSalesProjectionFromSpreadsheet_(fL5.fixture);
  check("L5", u3HasIssue_(pL5, iss.MULTIPLE_TERMINAL_REVERSALS) &&
    pL5.events.filter(function(e) { return e.eventType === "REVERSAL"; }).length === 0 &&
    pL5.totals.recognizedRevenue === 40000);
  // L6 unknown reversal target
  var fL6 = lineageBase_("unknown-target");
  u3ReversalAppend_(fL6.fixture, fL6.eventRow, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z", targetRecognitionID: "SCR-NOPE" });
  var pL6 = buildRecognizedSalesProjectionFromSpreadsheet_(fL6.fixture);
  check("L6", u3HasIssue_(pL6, iss.UNKNOWN_REVERSAL_TARGET) &&
    pL6.events.filter(function(e) { return e.eventType === "REVERSAL"; }).length === 0 &&
    pL6.totals.recognizedRevenue === 40000);
  // L7 impossible lineage (empty ReversalOfRecognitionID)
  var fL7 = lineageBase_("invalid-lineage");
  u3ReversalAppend_(fL7.fixture, fL7.eventRow, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z", targetRecognitionID: "" });
  var pL7 = buildRecognizedSalesProjectionFromSpreadsheet_(fL7.fixture);
  check("L7", u3HasIssue_(pL7, iss.INVALID_REVERSAL_LINEAGE) &&
    pL7.events.filter(function(e) { return e.eventType === "REVERSAL"; }).length === 0);
  // L8 replacement lineage collision surfaced
  var fL8 = lineageBase_("replacement-collision");
  u3CommittedAppend_(fL8.fixture, { orderID: fL8.orderID,
    recognitionID: "SCR-UREP-" + fL8.orderID, revisionID: "REV-REP-" + fL8.orderID,
    suffix: "-rep", amount: 81000, date: "2026-11-15",
    recognizedAt: "2026-12-01T00:00:00.000Z", originalID: fL8.eventRow.RecognitionID });
  u3CommittedAppend_(fL8.fixture, { orderID: fL8.orderID,
    recognitionID: "SCR-UREP2-" + fL8.orderID, revisionID: "REV-REP2-" + fL8.orderID,
    suffix: "-rep2", amount: 90000, date: "2026-11-16",
    recognizedAt: "2026-12-02T00:00:00.000Z", originalID: fL8.eventRow.RecognitionID });
  var pL8 = buildRecognizedSalesProjectionFromSpreadsheet_(fL8.fixture);
  check("L8", u3HasIssue_(pL8, iss.REPLACEMENT_LINEAGE_COLLISION) &&
    pL8.events.length === 3);
  // L9 duplicate RecognitionID excluded, counted once
  var fL9 = lineageBase_("duplicate-id");
  u3ReversalAppend_(fL9.fixture, fL9.eventRow, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z" });
  var reversalRow = readCanonicalTable(fL9.fixture, "SalesRecognitionEvents",
    contract.HEADERS).filter(function(row) { return row.EventType === "REVERSAL"; })[0];
  u3AppendEvent_(fL9.fixture, Object.assign({}, reversalRow));
  var pL9 = buildRecognizedSalesProjectionFromSpreadsheet_(fL9.fixture);
  // Both reversal rows fail the terminal-count rule (two rows claim the same
  // target); the duplicate RecognitionID is additionally surfaced and the
  // original recognition stays the only economic event.
  check("L9", u3HasIssue_(pL9, iss.DUPLICATE_RECOGNITION_ID,
      reversalRow.RecognitionID) &&
    pL9.events.length === 1 && pL9.totals.recognizedRevenue === 40000);
  // L10 recognition owner missing
  var fL10 = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendEvent_(fL10, { RecognitionID: "SCR-GHOST-1",
    ContractVersion: contract.CONTRACT_VERSION, ActivationID: "ACT-U2",
    OrderID: "ORD-GHOST-1", RevisionID: "REV-GHOST-1", EventType: "RECOGNITION",
    RecognizedAt: "2026-10-10T00:00:00.000Z", EconomicDate: "2026-10-10", Amount: 1000,
    RecognitionJournalID: "", JournalSignature: "", PostingStatus: "COMMITTED",
    OperationID: "", AuditID: "", OriginalID: "", ReversalOfRecognitionID: "",
    ReplacementID: "", Reason: "", Actor: "u3", SnapshotJSON: "{}" });
  var pL10 = buildRecognizedSalesProjectionFromSpreadsheet_(fL10);
  check("L10", u3HasIssue_(pL10, iss.RECOGNITION_OWNER_MISSING) &&
    pL10.events.length === 0 && pL10.quality.issues.length === 1);
  // L11 amount mismatch vs persisted snapshot
  var fL11 = lineageBase_("amount-mismatch");
  fL11.fixture.getSheetByName("SalesRecognitionEvents").values[1][8] = 99999;
  var pL11 = buildRecognizedSalesProjectionFromSpreadsheet_(fL11.fixture);
  check("L11", u3HasIssue_(pL11, iss.RECOGNITION_AMOUNT_MISMATCH) &&
    pL11.events.length === 0);
  // L12 journal mismatch
  var fL12 = lineageBase_("journal-mismatch");
  fL12.fixture.getSheetByName("BalanceLedger").values[2][5] = 7;
  var pL12 = buildRecognizedSalesProjectionFromSpreadsheet_(fL12.fixture);
  check("L12", u3HasIssue_(pL12, iss.RECOGNITION_JOURNAL_MISMATCH) &&
    pL12.events.length === 0);
  // L13 incompatible owner provenance across cohorts
  var fL13 = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendSale_(fL13, { ID_Trx: "SAL-L1", Tanggal: "2026-10-05T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 5000, HJ: 10000 });
  u3AppendOrder_(fL13, { OrderID: "SAL-L1", OrderNumber: "SAL-L1",
    OrderType: "DINE_IN", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
    OrderTotal: 50000, HppTotalSnapshot: 0, CreatedAt: "", CreatedBy: "u3",
    PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: "", UpdatedBy: "u3" },
    [u3OrderLine_("SAL-L1", 50000, 1)]);
  u3CommittedAppend_(fL13, { orderID: "SAL-L1", amount: 50000, date: "2026-10-12",
    recognizedAt: "2026-10-12T00:00:00.000Z" });
  var pL13 = buildRecognizedSalesProjectionFromSpreadsheet_(fL13);
  check("L13", u3HasIssue_(pL13, iss.INCOMPATIBLE_OWNER_PROVENANCE) &&
    u3HasIssue_(pL13, iss.COHORT_OWNERSHIP_CONFLICT) &&
    pL13.events.length === 2);
  // L14 duplicate legacy source identity
  var fL14 = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendSale_(fL14, { ID_Trx: "SAL-DUP", Tanggal: "2026-10-09T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 5000, HJ: 15000 });
  u3AppendSale_(fL14, { ID_Trx: "SAL-DUP", Tanggal: "2026-10-09T12:00:00Z",
    ID_Prod: "P1", Qty: 2, HPP: 5000, HJ: 15000 });
  var pL14 = buildRecognizedSalesProjectionFromSpreadsheet_(fL14);
  check("L14", u3HasIssue_(pL14, iss.DUPLICATE_SOURCE_IDENTITY, "LEGACY:SAL-DUP") &&
    pL14.events.length === 0);
  // L15 source read failure -> issue, no throw, rest of projection survives
  var fL15 = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendSale_(fL15, { ID_Trx: "SAL-R1", Tanggal: "2026-10-05T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 5000, HJ: 10000 });
  fL15.getSheetByName("Payments").getDataRange = function() {
    throw new Error("SIMULATED_READ_IO");
  };
  var pL15 = buildRecognizedSalesProjectionFromSpreadsheet_(fL15);
  check("L15", u3HasIssue_(pL15, iss.SOURCE_READ_FAILED, "Payments") &&
    pL15.quality.recoveryIssues.length === 1 &&
    pL15.sources.Payments.readFailed === true &&
    pL15.events.length === 1);
  // L16 order-shaped legacy provenance
  var fL16 = salesV2SaveFixture_(u3BaseSheets_());
  u3AppendSale_(fL16, { ID_Trx: "ORD-WEIRD-1", Tanggal: "2026-10-05T12:00:00Z",
    ID_Prod: "P1", Qty: 1, HPP: 5000, HJ: 10000 });
  var pL16 = buildRecognizedSalesProjectionFromSpreadsheet_(fL16);
  check("L16", u3HasIssue_(pL16, iss.LEGACY_ORDER_PROVENANCE_AMBIGUOUS,
      "LEGACY:ORD-WEIRD-1") && pL16.events.length === 1);
  // L17 conflicting cohort evidence: no legacy fallback
  var fL17 = salesV2SaveFixture_(u3BaseSheets_());
  u3PaidChain_(fL17, { orderID: "ORD-CONF-1", amount: 20000, paymentID: "PAY-CF1",
    paidAt: "2026-10-24T03:00:00.000Z" });
  u3AppendEvent_(fL17, { RecognitionID: "SCR-CONF-1",
    ContractVersion: "SALES_RECOGNITION_V1", ActivationID: "ACT-X",
    OrderID: "ORD-CONF-1", RevisionID: "REV-CONF-1", EventType: "RECOGNITION",
    RecognizedAt: "2026-10-24T00:00:00.000Z", EconomicDate: "2026-10-24", Amount: 20000,
    RecognitionJournalID: "", JournalSignature: "", PostingStatus: "COMMITTED",
    OperationID: "", AuditID: "", OriginalID: "", ReversalOfRecognitionID: "",
    ReplacementID: "", Reason: "", Actor: "u3", SnapshotJSON: "{}" });
  var pL17 = buildRecognizedSalesProjectionFromSpreadsheet_(fL17);
  check("L17", u3HasIssue_(pL17, iss.COHORT_OWNERSHIP_CONFLICT, "ORDER:ORD-CONF-1:") &&
    pL17.events.filter(function(e) {
      return e.namespace.indexOf("ORDER:ORD-CONF-1") === 0; }).length === 0 &&
    !u3HasIssue_(pL17, iss.OLD_ORDER_UNPAID_EXCLUDED, "ORDER:ORD-CONF-1:R0") &&
    pL17.quality.excluded.some(function(entry) {
      return entry.sourceIdentity === "ORDER:ORD-CONF-1:"; }));
  return { total: pass, pass: pass, fail: 0 };
}

// Central acceptance: one fixture containing all three cohorts with signed
// events, exact period totals, and explicit exclusions.
function u3ParityFixture_() {
  var fixture = salesV2SaveFixture_(u3BaseSheets_());
  var runtime = salesV2SaveRuntime_({ fixture: fixture });
  var saveResult = salesRecognitionV2SaveWithRuntime_(u3Payload_("u3-parity-v2"), runtime);
  if (saveResult.status !== "DONE") {
    throw new Error("U3_PARITY_SAVE_FAILED:" + saveResult.status + ":" + saveResult.code);
  }
  var plan = JSON.parse(runtime.repository.rows()[0].OperationPlan);
  u3MirrorOperations_(fixture, runtime.repository);
  var saved = readCanonicalTable(fixture, "SalesRecognitionEvents",
    SALES_RECOGNITION_V2_CONTRACT.HEADERS)[0];
  // Unpaid pre-V2: order with no payment evidence at all.
  u3AppendOrder_(fixture, { OrderID: "ORD-UNPAID-P", OrderNumber: "ORD-UNPAID-P",
    OrderType: "DINE_IN", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
    OrderTotal: 25000, HppTotalSnapshot: 0, CreatedAt: "", CreatedBy: "u3",
    PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: "", UpdatedBy: "u3" },
    [u3OrderLine_("ORD-UNPAID-P", 25000, 1)]);
  // Paid pre-V2: full evidence chain, 40,000 in October.
  u3PaidChain_(fixture, { orderID: "ORD-PAID-P", amount: 40000, paymentID: "PAY-PP1",
    paidAt: "2026-10-18T04:00:00.000Z", fulfillment: "OPEN" });
  // Pending V2: order + PENDING event row, no committed artifacts.
  u3AppendOrder_(fixture, { OrderID: "ORD-PENDING-P", OrderNumber: "ORD-PENDING-P",
    OrderType: "DINE_IN", PaymentStatus: "UNPAID", FulfillmentStatus: "OPEN",
    OrderTotal: 55000, HppTotalSnapshot: 0, CreatedAt: "", CreatedBy: "u3",
    PreparingAt: "", ReadyAt: "", CompletedAt: "", UpdatedAt: "", UpdatedBy: "u3" },
    [u3OrderLine_("ORD-PENDING-P", 55000, 1)]);
  u3AppendEvent_(fixture, { RecognitionID: "SCR-PEND-P",
    ContractVersion: SALES_RECOGNITION_V2_CONTRACT.CONTRACT_VERSION,
    ActivationID: "ACT-U2", OrderID: "ORD-PENDING-P", RevisionID: "REV-PEND-P",
    EventType: "RECOGNITION", RecognizedAt: "2026-10-22T01:00:00.000Z",
    EconomicDate: "2026-10-22", Amount: 55000, RecognitionJournalID: "SRV2J-PEND-P",
    JournalSignature: "pend", PostingStatus: "PENDING", OperationID: "", AuditID: "",
    OriginalID: "", ReversalOfRecognitionID: "", ReplacementID: "", Reason: "",
    Actor: "u3", SnapshotJSON: "{}" });
  // Legacy sale: 30,000 in October.
  u3AppendSale_(fixture, { ID_Trx: "SAL-P1", Tanggal: "2026-10-05T12:00:00Z",
    ID_Prod: "P1", Qty: 3, HPP: 5000, HJ: 10000 });
  // Committed V2 reversal (Nov) + replacement (Nov, recognized in Dec).
  u3ReversalAppend_(fixture, saved, { date: "2026-11-10",
    recognizedAt: "2026-11-20T00:00:00.000Z" });
  u3CommittedAppend_(fixture, { orderID: saveResult.orderID,
    recognitionID: "SCR-UREP-" + saveResult.orderID,
    revisionID: "REV-REP-" + saveResult.orderID, suffix: "-rep", amount: 81000,
    date: "2026-11-15", recognizedAt: "2026-12-01T00:00:00.000Z",
    originalID: saved.RecognitionID });
  return { fixture: fixture, plan: plan, saved: saved, orderID: saveResult.orderID };
}

function testSalesRecognitionV2ProjectionParity() {
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_V2_U3_PARITY:" + id +
      (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var iss = SALES_RECOGNITION_PROJECTION.ISSUES;
  var parity = u3ParityFixture_();
  var p = buildRecognizedSalesProjectionFromSpreadsheet_(parity.fixture);
  check("P1", p.events.length === 6 && p.totals.eventCount === 6 &&
    p.totals.recognizedEventCount === 5 &&
    p.events.filter(function(e) { return e.status === "PENDING"; }).length === 1,
    JSON.stringify({ n: p.events.length, ev: p.events.map(function(e) {
      return e.namespace + ":" + e.status; }), iss: p.quality.issues }));
  check("P2", p.totals.recognizedRevenue === 151000 &&
    p.totals.byPeriod["2026-10"] === 110000 &&
    p.totals.byPeriod["2026-11"] === 41000 &&
    JSON.stringify(p.totals.periods) === JSON.stringify(["2026-10", "2026-11"]));
  var adapterIds = p.transactions.filter(function(entry) {
    return entry.kind === "ORDER"; }).map(function(entry) {
      return entry.sourceIdentity; }).sort();
  var expectedAdapters = ["ORDER:" + parity.orderID, "ORDER:ORD-PENDING-P",
    "ORDER:ORD-PAID-P", "ORDER:ORD-UNPAID-P"].sort();
  check("P3", p.transactions.length === 5 &&
    JSON.stringify(adapterIds) === JSON.stringify(expectedAdapters) &&
    p.transactions.some(function(entry) {
      return entry.kind === "LEGACY_SALE" && entry.sourceIdentity === "LEGACY:SAL-P1"; }),
    JSON.stringify({ n: p.transactions.length, ids: adapterIds, exp: expectedAdapters }));
  check("P4", p.lines.length === 6 && p.lines.filter(function(line) {
    return line.cohort === "TABSAL_LEGACY"; }).length === 1);
  check("P5", p.quality.issues.length === 2 &&
    u3HasIssue_(p, iss.OLD_ORDER_UNPAID_EXCLUDED, "ORDER:ORD-UNPAID-P:R0") &&
    u3HasIssue_(p, iss.INCOMPLETE_V2_RECOGNITION, "ORDER:ORD-PENDING-P:") &&
    p.quality.recoveryIssues.length === 0 &&
    p.quality.excluded.length === 2);
  var namespaces = p.events.map(function(e) { return e.namespace; }).sort();
  check("P6", JSON.stringify(namespaces) === JSON.stringify([
    "LEGACY:SAL-P1:R0",
    "ORDER:" + parity.orderID + ":" + parity.plan.revisionID,
    "ORDER:" + parity.orderID + ":REV-REP-" + parity.orderID,
    "ORDER:" + parity.orderID + ":REV-R-" + parity.orderID,
    "ORDER:ORD-PAID-P:R0",
    "ORDER:ORD-PENDING-P:REV-PEND-P"].sort()));
  check("P7", p.totals.ledgerRevenueCredits === 161000 &&
    p.totals.ledgerRevenueCredits !== p.totals.recognizedRevenue);
  check("P8", p.activeView.events.length === 3 &&
    p.activeView.totals.recognizedRevenue === 151000 &&
    p.activeView.events.some(function(e) {
      return e.namespace === "ORDER:" + parity.orderID + ":REV-REP-" + parity.orderID; }) &&
    !p.activeView.events.some(function(e) {
      return e.cohort === "V2_PENDING" || e.namespace === "ORDER:ORD-UNPAID-P:R0"; }));
  var committedRecognitions = p.events.filter(function(e) {
    return e.chainKey === "ORDER:" + parity.orderID && e.eventType === "RECOGNITION" &&
      e.recognitionId === parity.saved.RecognitionID; });
  check("P9", committedRecognitions.length === 1 &&
    committedRecognitions[0].signedAmount === 40000);
  return { total: pass, pass: pass, fail: 0 };
}
