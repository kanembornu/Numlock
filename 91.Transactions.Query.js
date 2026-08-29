var TRANSACTIONS_DEFAULT_PAGE_SIZE = 15;

function getTransactionsPage(request) {
  var startedAt = Date.now();
  var safeRequest = request || {};
  var allowedTabs = { recent: true, sales: true, expenses: true };
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
  response.cacheHit = periodResult.cacheHit;
  response.cacheRevision = getDashboardCacheRevision();
  response.executionMs = Date.now() - startedAt;
  var lifecycleState = normalizeTransactionsLifecycleState(safeRequest);
  if (tab === "recent" && requestedPage === 1 && lifecycleState === "active" &&
      !String(safeRequest.search || "").trim() && !safeRequest.drilldownType) {
    response.searchIndex = buildTransactionsSearchIndex(periodRows);
    response.prefetchedPages = {};
    ["sales", "expenses"].forEach(function(prefetchTab) {
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
    if (type !== "Sales" && type !== "Expense") return false;
    if (!search) return true;
    return [row.id, row.product, row.purchaseCategory, type].some(function(value) {
      return String(value || "").toLowerCase().indexOf(search) !== -1;
    });
  });

  if (tab === "recent" && safeRequest.drilldownType) {
    rows = rows.filter(function(row) {
      var type = row.transactionType;
      if (safeRequest.drilldownType === "sales") return type === "Sales";
      if (safeRequest.drilldownType === "purchase") return type === "Expense";
      if (safeRequest.drilldownType === "month") return String(row.dateKey || "").slice(0, 7) === safeRequest.drilldownValue;
      if (safeRequest.drilldownType === "expenseCategory") return type === "Expense" && row.purchaseCategory === safeRequest.drilldownValue;
      return safeRequest.drilldownType === "all";
    });
  }

  return rows;
}

function normalizeTransactionsLifecycleState(request) {
  var safeRequest = request || {};
  var requested = String(safeRequest.lifecycleState || "").trim().toLowerCase();
  if (requested === "active" || requested === "voided" || requested === "all") return requested;
  return safeRequest.includeVoided === true ? "all" : "active";
}

function buildTransactionsSearchIndex(periodRows) {
  return periodRows.map(function(row, index) {
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
  var allowedTabs = { recent: true, sales: true, expenses: true };
  var tab = allowedTabs[safeRequest.tab] ? safeRequest.tab : "recent";
  var range = resolveDashboardDateRange(safeRequest.filter, safeRequest.customStart, safeRequest.customEnd);
  var periodResult = getTransactionsPeriodRows(range);
  var rows = filterTransactionsPeriodRows(periodResult.rows, safeRequest, tab).map(function(row) {
    return {
      id: row.id, date: row.date, transactionType: row.transactionType,
      item: row.product || row.purchaseCategory || "-", qty: row.qty || 0,
      amount: row.revenue || row.expense || 0
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
  var prefix = ["transactions-period-v1", getDashboardCacheRevision(), range.startDate, range.endDate].join("|");
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
        return { rows: cachedRows, cacheHit: true };
      }
    } catch (cacheReadError) {
      Logger.log("Transactions period cache read skipped: " + String(cacheReadError && cacheReadError.message || cacheReadError));
    }
  }

  var canonicalData = getCanonicalTransactionData(SpreadsheetApp.getActiveSpreadsheet());
  var periodRows = buildLifecycleTransactionRows(
    filterTransactionsByDateRange(canonicalData.lifecycleRecords || [], range).slice().reverse()
  );
  var chunkSize = 100;
  var chunkCount = Math.ceil(periodRows.length / chunkSize);
  var cacheEntries = {};
  for (var chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    cacheEntries[prefix + "|" + chunkIndex] = JSON.stringify(periodRows.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize));
  }
  try {
    if (chunkCount) cache.putAll(cacheEntries, DASHBOARD_CACHE.TTL_SECONDS);
    cache.put(metaKey, JSON.stringify({ chunks: chunkCount }), DASHBOARD_CACHE.TTL_SECONDS);
  } catch (cacheWriteError) {
    Logger.log("Transactions period cache write skipped: " + String(cacheWriteError && cacheWriteError.message || cacheWriteError));
  }
  return { rows: periodRows, cacheHit: false };
}
