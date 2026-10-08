var TRANSACTIONS_DEFAULT_PAGE_SIZE = 15;

function getTransactionsPage(request) {
  var startedAt = Date.now();
  var safeRequest = request || {};
  var allowedTabs = { recent: true, sales: true, expenses: true, purchases: true };
  var allowedPageSizes = { 15: true, 25: true, 50: true };
  var tab = allowedTabs[safeRequest.tab] ? safeRequest.tab : "recent";
  var pageSize = Number(safeRequest.pageSize);
  var requestedPage = Math.max(1, Math.floor(Number(safeRequest.page) || 1));
  if (!allowedPageSizes[pageSize]) pageSize = TRANSACTIONS_DEFAULT_PAGE_SIZE;

  var range = resolveDashboardDateRange(safeRequest.filter, safeRequest.customStart, safeRequest.customEnd);
  var periodResult = getTransactionsPeriodRows(range);
  var periodRows = periodResult.rows;
  var rows = filterTransactionsPeriodRows(periodRows, safeRequest, tab);

  var response = buildTransactionsPageResult(rows, requestedPage, pageSize);
  // Purchase-specific field normalization
  if (tab === "purchases") {
    response.rows = response.rows.map(function(row) {
      return Object.assign({}, row, {
        purchaseQuantity: row.purchaseQuantity != null ? Number(row.purchaseQuantity) || null : null,
        purchaseUOM: row.purchaseUOM || null
      });
    });
  }
  response.cacheHit = periodResult.cacheHit;
  // U4: structured U3 sales-recognition quality survives into the read DTO
  // (additive; no UI contract change).
  response.salesRecognition = periodResult.salesRecognition || null;
  response.cacheRevision = getDashboardCacheRevision();
  response.executionMs = Date.now() - startedAt;
  var lifecycleState = normalizeTransactionsLifecycleState(safeRequest);
  if (tab === "recent" && requestedPage === 1 && lifecycleState === "active" &&
      !String(safeRequest.search || "").trim() && !safeRequest.drilldownType) {
    response.searchIndex = buildTransactionsSearchIndex(periodRows);
    response.prefetchedPages = {};
    ["sales", "expenses", "purchases"].forEach(function(prefetchTab) {
      response.prefetchedPages[prefetchTab] = buildTransactionsPageResult(
        filterTransactionsPeriodRows(periodRows, {}, prefetchTab), 1, pageSize);
    });
  }
  var serialized = JSON.stringify(response);
  response.payloadBytes = serialized.length;
  return response;
}

function filterTransactionsPeriodRows(periodRows, request, tabName) {
  var safeRequest = request || {};
  var tab = tabName || "recent";
  var lifecycleState = normalizeTransactionsLifecycleState(safeRequest);
  var search = String(safeRequest.search || "").trim().toLowerCase().slice(0, 100);
  var rows = periodRows.filter(function(row) {
    var type = row.transactionType;
    if (lifecycleState === "active" && row.isActive === false) return false;
    if (lifecycleState === "voided" && row.isActive !== false) return false;
    if (tab === "sales" && type !== "Sales") return false;
    if (tab === "expenses" && type !== "Expense") return false;
    if (tab === "purchases" && type !== "PurchaseEvent") return false;
    if (type !== "Sales" && type !== "Expense" && type !== "InventoryReceipt" && type !== "PurchaseEvent") return false;
    if (!search) return true;
    return [row.id, row.product, row.purchaseCategory, row.item, row.date, formatTransactionsSearchDate(row.date)].some(function(value) {
      return String(value || "").toLowerCase().indexOf(search) !== -1;
    });
  });

  if (tab === "recent" && safeRequest.drilldownType) {
    rows = rows.filter(function(row) {
      var type = row.transactionType;
      if (safeRequest.drilldownType === "sales") return type === "Sales";
      if (safeRequest.drilldownType === "purchase") return type === "Expense" || type === "PurchaseEvent";
      if (safeRequest.drilldownType === "month") return String(row.dateKey || "").slice(0, 7) === safeRequest.drilldownValue;
      if (safeRequest.drilldownType === "expenseCategory") return type === "Expense" && row.purchaseCategory === safeRequest.drilldownValue;
      return safeRequest.drilldownType === "all";
    });
  }

  return rows;
}

function formatTransactionsSearchDate(value) {
  var match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return match[3] + " " + months[Number(match[2]) - 1] + " " + match[1];
}

function normalizeTransactionsLifecycleState(request) {
  var safeRequest = request || {};
  var requested = String(safeRequest.lifecycleState || "").trim().toLowerCase();
  if (requested === "active" || requested === "voided" || requested === "all") return requested;
  return safeRequest.includeVoided === true ? "all" : "active";
}

function buildTransactionsSearchIndex(periodRows) {
  return periodRows.map(function(row, index) {
    if (row.transactionType === "InventoryReceipt" || row.transactionType === "PurchaseEvent") return Object.assign({}, row, { sortIdentity: index });
    return {
      id: row.id,
      date: row.date,
      transactionType: row.transactionType,
      product: row.product,
      purchaseCategory: row.purchaseCategory,
      qty: row.qty,
      revenue: row.revenue,
      expense: row.expense,
      source: row.source,
      isActive: row.isActive !== false,
      sortIdentity: index
    };
  });
}

function getTransactionsExport(request) {
  var safeRequest = request || {};
  var allowedTabs = { recent: true, sales: true, expenses: true, purchases: true };
  var tab = allowedTabs[safeRequest.tab] ? safeRequest.tab : "recent";
  var range = resolveDashboardDateRange(safeRequest.filter, safeRequest.customStart, safeRequest.customEnd);
  var periodResult = getTransactionsPeriodRows(range);
  var rows = filterTransactionsPeriodRows(periodResult.rows, safeRequest, tab).map(function(row) {
    return {
      id: row.id, date: row.date, transactionType: row.transactionType,
      item: row.item || row.product || row.purchaseCategory || "-", qty: row.purchaseQuantity || row.qty || 0,
      amount: (row.transactionType === "InventoryReceipt" || row.transactionType === "PurchaseEvent") ? Number(row.acquisitionValue) : row.revenue || row.expense || 0
    };
  });
  return { success: true, data: { rows: rows, totalRows: rows.length, cacheHit: periodResult.cacheHit } };
}

function buildTransactionsPageResult(rows, requestedPage, pageSize) {
  var totalRows = rows.length;
  var totalPages = totalRows ? Math.ceil(totalRows / pageSize) : 0;
  var page = totalPages ? Math.min(requestedPage, totalPages) : 1;
  var offset = (page - 1) * pageSize;
  return {
    rows: rows.slice(offset, offset + pageSize),
    totalRows: totalRows,
    page: page,
    pageSize: pageSize,
    totalPages: totalPages,
    rangeStart: totalRows ? offset + 1 : 0,
    rangeEnd: totalRows ? Math.min(offset + pageSize, totalRows) : 0
  };
}

function getTransactionsPeriodRows(range) {
  var cache = CacheService.getScriptCache();
  var prefix = ["transactions-period-v3", getDashboardCacheRevision(), range.startDate, range.endDate].join("|");
  var metaKey = prefix + "|meta";
  var cachedMeta = cache.get(metaKey);
  if (cachedMeta) {
    try {
      var meta = JSON.parse(cachedMeta);
      var keys = [];
      for (var index = 0; index < meta.chunks; index++) keys.push(prefix + "|" + index);
      var cachedChunks = cache.getAll(keys);
      if (keys.every(function(key) { return Boolean(cachedChunks[key]); })) {
        var cachedRows = [];
        keys.forEach(function(key) { cachedRows = cachedRows.concat(JSON.parse(cachedChunks[key])); });
        return { rows: cachedRows, cacheHit: true,
          salesRecognition: meta.salesRecognition || null };
      }
    } catch (cacheReadError) {
      Logger.log("Transactions period cache read skipped: " + String(cacheReadError && cacheReadError.message || cacheReadError));
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var canonicalData = getCanonicalTransactionData(ss);
  var lifecycleRecords = filterTransactionsByDateRange(canonicalData.lifecycleRecords || [], range);
  var lifecycleSales = [];
  var lifecycleNonSales = lifecycleRecords.filter(function(record) {
    if (record.transactionType === "Sales") { lifecycleSales.push(record); return false; }
    return true;
  });
  var periodRows = buildLifecycleTransactionRows(lifecycleNonSales.slice().reverse());
  // U4: Sales rows come from the ONE shared U3 Recognized Sales Projection.
  // Expense/Purchase/Inventory sources are unchanged.
  var salesResult = buildTransactionSalesReadRows_(ss, range, lifecycleSales);
  var salesRecognition = salesRecognitionReadSummary_(salesResult.projection);
  var purchases = readPurchaseEventTransactionRows_(ss);
  periodRows = periodRows.concat(salesResult.rows,
    purchases.concat(readInventoryReceiptTransactionRows_(ss, purchases)).filter(function(row) {
      return row.date >= range.startDate && row.date <= range.endDate;
    })
  ).sort(function(a, b) {
    // Deterministic: date desc, then stable identity tie-breaker.
    return String(b.date).localeCompare(String(a.date)) ||
      String(b.id).localeCompare(String(a.id));
  });
  var chunkSize = 100;
  var chunkCount = Math.ceil(periodRows.length / chunkSize);
  var cacheEntries = {};
  for (var chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    cacheEntries[prefix + "|" + chunkIndex] = JSON.stringify(periodRows.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize));
  }
  try {
    if (chunkCount) cache.putAll(cacheEntries, DASHBOARD_CACHE.TTL_SECONDS);
    cache.put(metaKey, JSON.stringify({ chunks: chunkCount, salesRecognition: salesRecognition }),
      DASHBOARD_CACHE.TTL_SECONDS);
  } catch (cacheWriteError) {
    Logger.log("Transactions period cache write skipped: " + String(cacheWriteError && cacheWriteError.message || cacheWriteError));
  }
  return { rows: periodRows, cacheHit: false, salesRecognition: salesRecognition };
}

// ---------------------------------------------------------------------------
// SALES_RECOGNITION_V2 U4 read authority.
// Transaction Sales rows and Sales detail resolve from the ONE shared U3
// Recognized Sales Projection (`buildRecognizedSalesProjection_`). Sales are
// NEVER reconstructed from TabSal / Orders / Payments / BalanceLedger /
// OrderLines inside a reader: those remain U3 inputs only. Additive DTO
// fields only; no writer, no P&L, no schema change.
// ---------------------------------------------------------------------------
var SALES_RECOGNITION_SOURCE_LABELS = Object.freeze({
  TABSAL_LEGACY: "LEGACY_SALE",
  PRE_V2_ORDER: "PRE_V2_ORDER",
  V2_COMMITTED: "SALES_RECOGNITION_V2",
  V2_PENDING: "SALES_RECOGNITION_V2",
  INCONSISTENT: "SALES_RECOGNITION_V2",
  UNKNOWN: "SALES_RECOGNITION_V2"
});

function salesRecognitionSourceLabel_(cohort) {
  return SALES_RECOGNITION_SOURCE_LABELS[String(cohort || "")] || "SALES_RECOGNITION_V2";
}

function isSalesRecognitionOrderIdentity_(value) {
  return String(value || "").indexOf("ORDER:") === 0;
}

function salesRecognitionNumber_(value) {
  var number = Number(value);
  return isFinite(number) ? number : 0;
}

function salesRecognitionActiveEventIndex_(projection) {
  var index = {};
  ((projection && projection.activeView && projection.activeView.events) || []).forEach(function(event) {
    index[event.chainKey] = event;
  });
  return index;
}

function salesRecognitionQualityIndex_(projection) {
  var index = {};
  function bucket(identity) {
    var key = String(identity || "");
    if (!key) return null;
    if (!index[key]) index[key] = { issues: [], excluded: [] };
    return index[key];
  }
  (projection.quality.issues || []).forEach(function(issue) {
    var target = bucket(issue.sourceIdentity);
    if (target) target.issues.push(issue);
  });
  (projection.quality.excluded || []).forEach(function(entry) {
    var target = bucket(entry.sourceIdentity);
    if (target) target.excluded.push(entry);
  });
  return index;
}

function salesRecognitionReadSummary_(projection) {
  return {
    contract: projection.contract,
    reader: projection.reader,
    authority: "SALES_RECOGNITION_V2_PROJECTION",
    activeChains: projection.activeView.events.length,
    issues: projection.quality.issues,
    recoveryIssues: projection.quality.recoveryIssues,
    excluded: projection.quality.excluded
  };
}

// Analytical detail lines only — the header amount is authoritative. Committed
// V2 lines come from the persisted SnapshotJSON (immutable); pre-V2/legacy
// lines come from the projection's already-read OrderLines/legacy rows.
function salesRecognitionDetailLines_(projection, header, activeEvent) {
  var orderId = String(header.headerId || "");
  var snapshotLines = activeEvent && activeEvent.snapshot &&
    Array.isArray(activeEvent.snapshot.lines) ? activeEvent.snapshot.lines : [];
  if (snapshotLines.length) {
    return snapshotLines.map(function(line, index) {
      return {
        lineId: String(line.OrderLineID || (activeEvent.namespace || orderId) + ":" + (index + 1)),
        productId: String(line.ProductID || ""),
        productVariantId: String(line.ProductVariantID || ""),
        tipe: String(line.Tipe || ""),
        qty: salesRecognitionNumber_(line.Qty),
        unitPrice: salesRecognitionNumber_(line.SellingPriceSnapshot),
        lineAmount: salesRecognitionNumber_(line.LineTotal),
        unitHpp: salesRecognitionNumber_(line.UnitHppSnapshot),
        lineHpp: salesRecognitionNumber_(line.LineHpp),
        recipeVersionId: String(line.RecipeVersionID || ""),
        fromSnapshot: true
      };
    });
  }
  var chain = "ORDER:" + orderId;
  return (projection.lines || []).filter(function(line) {
    return line.sourceIdentity === chain || line.sourceIdentity.indexOf(chain + ":") === 0;
  }).map(function(line) {
    return {
      lineId: String(line.lineId || ""),
      productId: String(line.productId || ""),
      productVariantId: String(line.productVariantId || ""),
      tipe: String(line.tipe || ""),
      qty: salesRecognitionNumber_(line.qty),
      unitPrice: salesRecognitionNumber_(line.sellingPrice),
      lineAmount: salesRecognitionNumber_(line.amount),
      unitHpp: salesRecognitionNumber_(line.unitHpp),
      lineHpp: null,
      recipeVersionId: String(line.recipeVersionId || ""),
      fromSnapshot: false
    };
  });
}

function salesRecognitionCollectProductIdentities_(projection, orderId) {
  var chain = "ORDER:" + orderId, productIds = [], variantIds = [];
  function collect(productId, variantId) {
    var pid = String(productId || ""), vid = String(variantId || "");
    if (pid && productIds.indexOf(pid) === -1) productIds.push(pid);
    if (vid && variantIds.indexOf(vid) === -1) variantIds.push(vid);
  }
  (projection.lines || []).forEach(function(line) {
    if (line.sourceIdentity !== chain && line.sourceIdentity.indexOf(chain + ":") !== 0) return;
    collect(line.productId, line.productVariantId);
  });
  var identities = productIds.slice();
  variantIds.forEach(function(variantId) {
    if (identities.indexOf(variantId) === -1) identities.push(variantId);
  });
  return { productIds: productIds, variantIds: variantIds, display: identities.join(", ") };
}

function buildTransactionSalesOrderRow_(header, activeEvent, projection, qualityIndex) {
  var orderId = String(header.headerId || "");
  var identity = String(header.sourceIdentity || "");
  var lines = salesRecognitionDetailLines_(projection, header, activeEvent);
  var identities = salesRecognitionCollectProductIdentities_(projection, orderId);
  var qty = 0;
  lines.forEach(function(line) { qty += line.qty; });
  var label = salesRecognitionSourceLabel_(header.cohort);
  return {
    id: identity,
    date: activeEvent.dateKey,
    transactionType: "Sales",
    canonicalTransactionType: "Sales",
    product: identities.display,
    productId: identities.productIds.join(", "),
    productVariantId: identities.variantIds.join(", "),
    purchaseCategory: "",
    qty: qty,
    revenue: activeEvent.signedAmount,
    expense: 0,
    source: label,
    isActive: true,
    salesIdentity: identity,
    salesSourceLabel: label,
    salesCohort: header.cohort,
    recognitionId: activeEvent.recognitionId || header.recognitionId || null,
    revisionId: activeEvent.revisionId || header.revisionId || null,
    recognitionStatus: header.status,
    orderType: String(header.orderType || ""),
    salesQuality: qualityIndex[identity] || { issues: [], excluded: [] }
  };
}

// One header row per recognized Sales source record. Unpaid / pending /
// UNKNOWN / integrity-conflicted V2 never become rows and never fall back to
// legacy treatment; voided/corrected legacy rows keep their lifecycle in the
// voided/all views only.
function buildTransactionSalesReadRows_(ss, range, lifecycleSalesRows) {
  var projection = buildRecognizedSalesProjectionFromSpreadsheet_(ss);
  var activeEvents = salesRecognitionActiveEventIndex_(projection);
  var qualityIndex = salesRecognitionQualityIndex_(projection);
  var lifecycleById = {};
  (lifecycleSalesRows || []).forEach(function(record) {
    lifecycleById[String(record.id)] = record;
  });
  var rows = [], claimed = {};
  function withinRange(dateKey) {
    return Boolean(dateKey) && dateKey >= range.startDate && dateKey <= range.endDate;
  }
  projection.transactions.forEach(function(header) {
    if (header.kind === "LEGACY_SALE") {
      var legacyId = String(header.headerId || "");
      var legacyKey = "LEGACY:" + legacyId;
      var record = lifecycleById[legacyId];
      if (!legacyId || claimed[legacyKey] || !record) return;
      var legacyEvent = activeEvents[header.sourceIdentity];
      if (!legacyEvent) return;
      claimed[legacyKey] = true;
      if (!withinRange(legacyEvent.dateKey)) return;
      rows.push({
        id: legacyId,
        date: legacyEvent.dateKey,
        transactionType: "Sales",
        canonicalTransactionType: "Sales",
        product: record.product,
        productId: String(record.productId || ""),
        productVariantId: "",
        purchaseCategory: "",
        qty: record.qty,
        revenue: legacyEvent.signedAmount,
        expense: 0,
        source: record.source,
        isActive: true,
        salesIdentity: header.sourceIdentity,
        salesSourceLabel: salesRecognitionSourceLabel_(header.cohort),
        salesCohort: header.cohort,
        recognitionId: header.recognitionId || null,
        revisionId: header.revisionId || null,
        recognitionStatus: header.status,
        salesQuality: qualityIndex[header.sourceIdentity] || { issues: [], excluded: [] }
      });
      return;
    }
    if (header.kind !== "ORDER") return;
    var orderId = String(header.headerId || "");
    var orderKey = "ORDER:" + orderId;
    if (!orderId || claimed[orderKey]) return;
    // Recognition gate: only an order with a RECOGNIZED active-view event is a
    // Sale. Unpaid / pending / UNKNOWN / integrity-conflicted orders have no
    // active event, never become rows, and never fall back to legacy
    // TabSal/Order/Payment economics.
    var activeEvent = activeEvents[orderKey];
    if (!activeEvent) return;
    claimed[orderKey] = true;
    if (!withinRange(activeEvent.dateKey)) return;
    rows.push(buildTransactionSalesOrderRow_(header, activeEvent, projection, qualityIndex));
  });
  Object.keys(lifecycleById).forEach(function(id) {
    var record = lifecycleById[id];
    var legacyKey = "LEGACY:" + id;
    if (claimed[legacyKey] || !record || record.isActive !== false) return;
    claimed[legacyKey] = true;
    if (!withinRange(record.dateKey)) return;
    rows.push({
      id: id,
      date: record.dateKey,
      transactionType: "Sales",
      canonicalTransactionType: "Sales",
      product: record.product,
      productId: String(record.productId || ""),
      productVariantId: "",
      purchaseCategory: "",
      qty: record.qty,
      revenue: record.revenue,
      expense: 0,
      source: record.source,
      isActive: false,
      salesIdentity: legacyKey,
      salesSourceLabel: salesRecognitionSourceLabel_("TABSAL_LEGACY"),
      salesCohort: "TABSAL_LEGACY",
      recognitionId: null,
      revisionId: null,
      recognitionStatus: "NOT_RECOGNIZED",
      salesQuality: qualityIndex[legacyKey] || { issues: [], excluded: [] }
    });
  });
  return { rows: rows, projection: projection };
}

// Canonical Sales detail identity for an order-backed Sale (`ORDER:<OrderID>`).
// Fail closed: an order that U3 does not recognize is not a readable Sale.
function buildSalesRecognitionOrderDetail_(identity, projection) {
  var header = null;
  (projection.transactions || []).forEach(function(entry) {
    if (entry.kind === "ORDER" && String(entry.sourceIdentity) === identity) header = entry;
  });
  if (!header || header.status !== "RECOGNIZED") {
    throw canonicalEntryError("TRANSACTION_NOT_FOUND", "Transaction was not found.", "transactionId");
  }
  var orderId = String(header.headerId || "");
  var activeEvent = salesRecognitionActiveEventIndex_(projection)["ORDER:" + orderId];
  if (!activeEvent) {
    throw canonicalEntryError("TRANSACTION_NOT_FOUND", "Transaction was not found.", "transactionId");
  }
  var lines = salesRecognitionDetailLines_(projection, header, activeEvent);
  var identities = salesRecognitionCollectProductIdentities_(projection, orderId);
  var qualityIndex = salesRecognitionQualityIndex_(projection);
  var quality = qualityIndex[identity] || { issues: [], excluded: [] };
  var qty = 0, lineHpp = 0, hasLineHpp = false;
  lines.forEach(function(line) {
    qty += line.qty;
    if (line.lineHpp !== null && line.lineHpp !== undefined) { lineHpp += line.lineHpp; hasLineHpp = true; }
  });
  var chain = "ORDER:" + orderId;
  var lineage = (projection.events || []).filter(function(event) {
    return event.chainKey === chain;
  }).map(function(event) {
    return {
      recognitionId: event.recognitionId || null,
      revisionId: event.revisionId || null,
      eventType: event.eventType || null,
      dateKey: event.dateKey || null,
      signedAmount: event.signedAmount,
      status: event.status,
      recognizedAt: event.recognizedAt || null,
      originalId: event.originalId || null,
      reversalOfRecognitionId: event.reversalOfRecognitionId || null,
      replacementId: event.replacementId || null,
      active: event === activeEvent
    };
  });
  var label = salesRecognitionSourceLabel_(header.cohort);
  var detail = {
    id: identity,
    transactionType: "Sales",
    date: activeEvent.dateKey,
    source: label,
    isActive: true,
    status: "ACTIVE",
    // U6 owns V2/Pre-V2 Correct+Void. Fail closed until then.
    canCorrect: false, canVoid: false,
    immutableReason: "SALES_RECOGNITION_ACTION_UNSUPPORTED",
    salesIdentity: identity,
    salesSourceLabel: label,
    salesCohort: header.cohort,
    orderId: orderId,
    salesId: null,
    revisionId: activeEvent.revisionId || header.revisionId || null,
    recognitionId: activeEvent.recognitionId || header.recognitionId || null,
    recognitionStatus: header.status,
    contractVersion: projection.contract,
    orderType: String(header.orderType || ""),
    productId: identities.productIds.join(", "),
    productVariantId: identities.variantIds.join(", "),
    product: identities.display,
    type: (lines[0] && lines[0].tipe) || String(header.orderType || ""),
    qty: qty,
    revenue: activeEvent.signedAmount,
    amount: activeEvent.signedAmount,
    expense: 0,
    // Analytical HPP only: never a journal line, never a COGS posting.
    hppAnalytical: activeEvent.snapshot && activeEvent.snapshot.hppTotalSnapshot !== undefined ?
      salesRecognitionNumber_(activeEvent.snapshot.hppTotalSnapshot) : header.hppTotalSnapshot,
    hppAnalyticalLines: hasLineHpp ? lineHpp : null,
    paymentStatus: header.paymentStatus || null,
    fulfillmentStatus: header.fulfillmentStatus || null,
    originalId: activeEvent.originalId || null,
    replacementId: activeEvent.replacementId || null,
    lineage: lineage,
    lines: lines,
    quality: { issues: quality.issues, excluded: quality.excluded,
      recoveryIssues: quality.issues.filter(function(issue) { return issue.recovery === true; }) },
    createdAt: activeEvent.recognizedAt || null,
    createdBy: "",
    updatedAt: null,
    updatedBy: ""
  };
  return detail;
}

// Additive recognition metadata for a legacy canonical Sales detail. Identity,
// date, amount, lifecycle and mutability stay on the canonical lifecycle path
// (U3's own legacy source); only recognition state/quality is attached.
function attachSalesRecognitionLegacyMetadata_(detail, projection) {
  var header = null;
  (projection.transactions || []).forEach(function(entry) {
    if (entry.kind === "LEGACY_SALE" && String(entry.headerId) === String(detail.id)) header = entry;
  });
  var identity = header ? String(header.sourceIdentity) : "LEGACY:" + String(detail.id || "");
  var quality = salesRecognitionQualityIndex_(projection)[identity] || { issues: [], excluded: [] };
  detail.salesIdentity = identity;
  detail.salesSourceLabel = salesRecognitionSourceLabel_("TABSAL_LEGACY");
  detail.salesCohort = "TABSAL_LEGACY";
  detail.orderId = null;
  detail.recognitionId = header ? header.recognitionId || null : null;
  detail.revisionId = header ? header.revisionId || null : null;
  detail.recognitionStatus = header ? header.status : "NOT_RECOGNIZED";
  detail.contractVersion = projection.contract;
  detail.productVariantId = "";
  detail.lines = [{
    lineId: identity + ":1",
    productId: String(detail.productId || ""),
    productVariantId: "",
    tipe: String(detail.type || ""),
    qty: salesRecognitionNumber_(detail.qty),
    unitPrice: salesRecognitionNumber_(detail.unitPrice),
    lineAmount: salesRecognitionNumber_(detail.revenue),
    unitHpp: salesRecognitionNumber_(detail.unitHPP),
    lineHpp: salesRecognitionNumber_(detail.cogs),
    recipeVersionId: "",
    fromSnapshot: false
  }];
  detail.quality = { issues: quality.issues, excluded: quality.excluded,
    recoveryIssues: quality.issues.filter(function(issue) { return issue.recovery === true; }) };
  return detail;
}

// Read-only UI adapter over the frozen receipt authority.
function buildInventoryReceiptEntryChoices_(items, conversions, date) {
  return buildInventoryPurchaseOptions_(items, date).map(function(item) {
    var authority = classifyInventoryConversionReadiness(item.itemId, date, items, conversions).conversion;
    var choices = [];
    if (authority) {
      var units = item.itemId === "ING-018" ? ["gr", "kg"] :
        item.baseUOM === "gr" ? ["gr", "kg"] : ["ml", "pcs"].indexOf(item.baseUOM) !== -1 ? [item.baseUOM] : [];
      units.forEach(function(unit) { choices.push({ uom: unit, label: unit }); });
      var from = String(authority.FromUOM).toLowerCase();
      if (item.itemId !== "ING-018" && from !== "purchase lot" && units.indexOf(from) === -1) {
        choices.push({ uom: from, label: from + " — " + authority.PackageIdentity,
          packageIdentity: authority.PackageIdentity, supplierRef: authority.SupplierRef });
      }
    }
    return { itemId: item.itemId, item: item.item, baseUOM: item.baseUOM, choices: choices };
  });
}

function getInventoryReceiptEntryOptions(receiptDate) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var items = readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS);
    var conversions = readCanonicalTable(ss, "InventoryUOMConversions", BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS);
    return { success: true, data: { date: receiptDate,
      items: buildInventoryReceiptEntryChoices_(items, conversions, receiptDate) } };
  } catch (error) { return canonicalEntryFailure(error); }
}

function buildProductsReadModel_(items, recipes) {
  var recipeCountByItem = Object.create(null);
  (recipes || []).forEach(function(recipe) {
    var itemId = String(recipe.ID_Ingredient || "").trim();
    if (itemId && recipe.IsActive === true) recipeCountByItem[itemId] = (recipeCountByItem[itemId] || 0) + 1;
  });
  return (items || []).slice(0, 200).map(function(item) {
    var itemId = String(item.ItemID || "");
    return {
      itemId: itemId,
      name: String(item.ItemName || ""),
      category: String(item.Classification || ""),
      uom: String(item.BaseUOM || ""),
      isActive: item.IsActive === true,
      activeRecipeCount: recipeCountByItem[itemId] || 0
    };
  });
}

function getProductsReadModel() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var items = readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS);
    var recipeSheet = ss.getSheetByName("COGSRecipes");
    var recipes = recipeSheet ? readCanonicalTable(ss, "COGSRecipes",
      ["ID_Recipe", "ID_Prod", "Tipe", "ID_Ingredient", "UsageQty", "IsActive"]) : [];
    return { success: true, data: { source: "InventoryItems", recipeSource: recipeSheet ? "COGSRecipes" : null,
      products: buildProductsReadModel_(items, recipes) } };
  } catch (error) {
    return { success: false, error: { code: "PRODUCTS_READ_FAILED", message: "Products could not be loaded." } };
  }
}

function readInventoryReceiptTransactionRows_(ss, purchases) {
  if (!ss.getSheetByName("InventoryReceipts")) return [];
  var receipts = readCanonicalTable(ss, "InventoryReceipts", INVENTORY_RECEIPT_POLICY.HEADERS);
  if (!receipts.length) return [];
  var items = readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS);
  var index = inventoryItemIndex(items).items;
  // One business purchase appears once; its internal receipt is a downstream fact.
  var purchaseKeys = Object.create(null);
  (purchases || []).forEach(function(row) { purchaseKeys["pe-receipt-" + row.id.slice(3)] = true; });
  return receipts.filter(function(row) { return row.IsActive === true && !purchaseKeys[row.IdempotencyKey]; }).map(function(row) {
    // Capture alone never proves operational posting.
    var dto = projectInventoryReceiptTransaction_(row, "RECEIPT_CAPTURED");
    dto.date = capitalEquityDateKey(row.ReceiptDate);
    dto.dateKey = dto.date;
    dto.item = index[row.ItemID] ? index[row.ItemID].ItemName : row.ItemID;
    dto.purchaseQuantity = row.PurchaseQty;
    dto.purchaseUOM = row.PurchaseUOM;
    dto.supplier = row.SupplierSource;
    dto.reference = row.ExternalRef || "Document unavailable";
    return dto;
  });
}
