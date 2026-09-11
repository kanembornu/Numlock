function testBoundedCanonicalRead()
{
  // ---- 1. Equivalence: same 9-field output as old reader ----
  var headers9 = ["ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ", "Source", "IsActive"];
  var fullHeaders = headers9.concat(["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]);
  var dataRow1 = ["S1", new Date(2025, 0, 15), "P1", "Hot", 3, 4000, 10000, "TEST", true, "", "", "", ""];
  var dataRow2 = ["S2", new Date(2025, 0, 16), "P1", "Cold", 1, 5000, 12000, "TEST", false, "", "", "", ""];

  var sheets = {
    tabsal: {
      _values: [fullHeaders.slice(), dataRow1.slice(), dataRow2.slice()],
      getLastRow: function() { return this._values.length; },
      getRange: function(row, col, numRows, numCols) {
        var self = this;
        return {
          getValues: function() {
            var result = [];
            for (var r = row - 1; r < row - 1 + numRows; r++) {
              var slice = self._values[r] ? self._values[r].slice(0, numCols) : [];
              result.push(slice);
            }
            return result;
          }
        };
      },
      getDataRange: function() {
        var self = this;
        return {
          getValues: function() { return self._values.map(function(r) { return r.slice(); }); }
        };
      }
    }
  };
  var mockSS = { getSheetByName: function(name) { return sheets[name] || null; } };

  var bounded = readBoundedCanonicalTable(mockSS, "tabsal", headers9, 9);
  var full = readCanonicalTable(mockSS, "tabsal", headers9);

  if (bounded.length !== full.length) {
    throw new Error("Bounded read returned " + bounded.length + " rows vs full " + full.length);
  }
  for (var i = 0; i < bounded.length; i++) {
    for (var h = 0; h < headers9.length; h++) {
      var bVal = bounded[i][headers9[h]];
      var fVal = full[i][headers9[h]];
      if (String(bVal) !== String(fVal)) {
        throw new Error("Row " + i + " field " + headers9[h] + " mismatch: bounded=" + bVal + " full=" + fVal);
      }
    }
    if (bounded[i].sourceRowIndex !== full[i].sourceRowIndex) {
      throw new Error("Row " + i + " sourceRowIndex mismatch");
    }
  }

  // Trailing J:M columns not in bounded output
  var trailingCols = ["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"];
  trailingCols.forEach(function(col) {
    if (Object.prototype.hasOwnProperty.call(bounded[0], col) && bounded[0][col] !== "") {
      throw new Error("Bounded reader exposed trailing column: " + col);
    }
  });

  // ---- 2. Trailing column exclusion ----
  var onlyRequired = readBoundedCanonicalTable(mockSS, "tabsal", ["ID_Trx"], 9);
  if (onlyRequired.length !== 2) throw new Error("Trailing exclusion row count wrong");

  // ---- 3. Header failure: missing required header in A:I → fails closed ----
  var badSheets = {
    tabsal: {
      _values: [["ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ", "Source", "IsActive"]],
      getLastRow: function() { return this._values.length; },
      getRange: function(row, col, numRows, numCols) {
        var self = this;
        return {
          getValues: function() {
            var result = [];
            for (var r = row - 1; r < row - 1 + numRows; r++) {
              result.push(self._values[r] ? self._values[r].slice(0, numCols) : []);
            }
            return result;
          }
        };
      }
    }
  };
  var badSS = { getSheetByName: function(name) { return badSheets[name] || null; } };
  var caughtMissing = false;
  try {
    readBoundedCanonicalTable(badSS, "tabsal", ["ID_Trx", "HJ_MISSING"], 9);
  } catch (e) {
    caughtMissing = true;
    if (e.message.indexOf("missing required column") === -1) {
      throw new Error("Wrong error for missing header: " + e.message);
    }
  }
  if (!caughtMissing) throw new Error("Missing required header did not throw");

  // ---- 4. Row-bound: header-only, multiple rows, blank row inside data ----
  var mixedRows = [headers9.slice(),
    ["S1", new Date(2025, 0, 15), "P1", "Hot", 3, 4000, 10000, "TEST", true],
    ["", "", "", "", "", "", "", "", ""],
    ["S2", new Date(2025, 0, 16), "P1", "Cold", 1, 5000, 12000, "TEST", false]
  ];
  var mixedSheet = {
    _values: mixedRows,
    getLastRow: function() { return this._values.length; },
    getRange: function(row, col, numRows, numCols) {
      var self = this;
      return {
        getValues: function() {
          var result = [];
          for (var r = row - 1; r < row - 1 + numRows; r++) {
            result.push(self._values[r] ? self._values[r].slice(0, numCols) : []);
          }
          return result;
        }
      };
    }
  };
  var mixedSS = { getSheetByName: function(name) { return name === "tabsal" ? mixedSheet : null; } };
  var mixedResult = readBoundedCanonicalTable(mixedSS, "tabsal", headers9, 9);
  if (mixedResult.length !== 2) {
    throw new Error("Blank-row filtering: expected 2 got " + mixedResult.length);
  }
  if (mixedResult[0].sourceRowIndex !== 1 || mixedResult[1].sourceRowIndex !== 2) {
    throw new Error("Blank-row filtering: sourceRowIndex wrong");
  }

  // Header-only sheet (lastRow=1)
  var headerOnlySheet = {
    _values: [headers9.slice()],
    getLastRow: function() { return 1; },
    getRange: function(row, col, numRows, numCols) {
      var self = this;
      return {
        getValues: function() {
          var result = [];
          for (var r = row - 1; r < row - 1 + numRows; r++) {
            result.push(self._values[r] ? self._values[r].slice(0, numCols) : []);
          }
          return result;
        }
      };
    }
  };
  var headerOnlySS = { getSheetByName: function(name) { return name === "tabsal" ? headerOnlySheet : null; } };
  var headerOnlyResult = readBoundedCanonicalTable(headerOnlySS, "tabsal", headers9, 9);
  if (headerOnlyResult.length !== 0) {
    throw new Error("Header-only sheet should return 0 rows, got " + headerOnlyResult.length);
  }

  // ---- 5. Missing sheet → throws ----
  var noSheetSS = { getSheetByName: function() { return null; } };
  var caughtSheet = false;
  try {
    readBoundedCanonicalTable(noSheetSS, "tabsal", headers9, 9);
  } catch (e) {
    caughtSheet = true;
  }
  if (!caughtSheet) throw new Error("Missing sheet did not throw");

  // ---- 6. Bounded read integrates with getCanonicalTransactionData ----
  var perf = {};
  var integrationSS = {
    getSheetByName: function(name) {
      if (name === "tabsal") return sheets.tabsal;
      if (name === "tabops") {
        return {
          _values: [["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"]],
          getLastRow: function() { return this._values.length; },
          getRange: function(row, col, numRows, numCols) {
            var self = this;
            return {
              getValues: function() {
                var result = [];
                for (var r = row - 1; r < row - 1 + numRows; r++) {
                  result.push(self._values[r] ? self._values[r].slice(0, numCols) : []);
                }
                return result;
              }
            };
          },
          getDataRange: function() {
            var self = this;
            return {
              getValues: function() { return self._values.map(function(r) { return r.slice(); }); }
            };
          }
        };
      }
      if (name === "Products") {
        return {
          getDataRange: function() {
            return {
              getValues: function() {
                return [["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"],
                  ["P1", "Latte", "Coffee", "Beverage", true]];
              }
            };
          }
        };
      }
      if (name === "ExpenseItems") {
        return {
          getDataRange: function() {
            return {
              getValues: function() {
                return [["ID_Ops", "Item", "Kategori", "Kind", "Group", "IsActive"]];
              }
            };
          }
        };
      }
      return null;
    }
  };
  var result = getCanonicalTransactionData(integrationSS, perf);
  if (typeof perf.salesReadMs !== "number" || perf.salesReadMs < 0) {
    throw new Error("salesReadMs timing missing in integration");
  }
  if (result.records.length !== 1) {
    throw new Error("Integration: expected 1 active record, got " + result.records.length);
  }
  if (result.lifecycleRecords.length !== 2) {
    throw new Error("Integration: expected 2 lifecycle records, got " + result.lifecycleRecords.length);
  }
  if (result.records[0].id !== "S1" || result.records[0].revenue !== 30000) {
    throw new Error("Integration: record field mismatch");
  }
}

function testBoundedCanonicalReadTabops() {
  var headers6 = ["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"];
  var fullHeaders = headers6.concat(["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]);
  var dataRow1 = ["O1", new Date(2025, 0, 15), "E1", 50000, "MANUAL", true];
  var dataRow2 = ["O2", new Date(2025, 0, 16), "E2", 75000, "AUTO", false];
  var dataRow3 = ["O3", new Date(2025, 1, 1), "E1", 30000, "MANUAL", true];

  function makeTabopsSheet(values) {
    return {
      _values: values,
      getLastRow: function() { return this._values.length; },
      getRange: function(row, col, numRows, numCols) {
        var self = this;
        return {
          getValues: function() {
            var result = [];
            for (var r = row - 1; r < row - 1 + numRows; r++) {
              result.push(self._values[r] ? self._values[r].slice(0, numCols) : []);
            }
            return result;
          }
        };
      },
      getDataRange: function() {
        var self = this;
        return {
          getValues: function() { return self._values.map(function(r) { return r.slice(); }); }
        };
      }
    };
  }

  // ---- 1. tabops bounded read requests width 6 ----
  var capturedNumCols = null;
  var sheet1 = makeTabopsSheet([
    fullHeaders.slice(), dataRow1.concat(["", "", "", ""])
  ]);
  var origGetRange1 = sheet1.getRange;
  sheet1.getRange = function(row, col, numRows, numCols) {
    capturedNumCols = numCols;
    return origGetRange1.call(this, row, col, numRows, numCols);
  };
  var ss1 = { getSheetByName: function(n) { return n === "tabops" ? sheet1 : null; } };
  readBoundedCanonicalTable(ss1, "tabops", headers6, 6);
  if (capturedNumCols !== 6) {
    throw new Error("tabops bounded read: expected width 6, got " + capturedNumCols);
  }

  // ---- 2. excludes columns 7-10 ----
  var sheet2 = makeTabopsSheet([
    fullHeaders.slice(), dataRow1.concat(["V1", "U1", "V2", "U2"])
  ]);
  var ss2 = { getSheetByName: function(n) { return n === "tabops" ? sheet2 : null; } };
  var bounded2 = readBoundedCanonicalTable(ss2, "tabops", headers6, 6);
  var trailingCols = ["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"];
  trailingCols.forEach(function(col) {
    if (Object.prototype.hasOwnProperty.call(bounded2[0], col) && bounded2[0][col] !== "") {
      throw new Error("tabops bounded reader exposed trailing column: " + col);
    }
  });

  // ---- 3. valid row output matches full reader ----
  var sheet3 = makeTabopsSheet([
    fullHeaders.slice(), dataRow1.concat(["", "", "", ""]), dataRow2.concat(["", "", "", ""])
  ]);
  var ss3 = { getSheetByName: function(n) { return n === "tabops" ? sheet3 : null; } };
  var bounded3 = readBoundedCanonicalTable(ss3, "tabops", headers6, 6);
  var full3 = readCanonicalTable(ss3, "tabops", headers6);
  if (bounded3.length !== full3.length) {
    throw new Error("tabops bounded/full row count mismatch: " + bounded3.length + " vs " + full3.length);
  }
  for (var i = 0; i < bounded3.length; i++) {
    for (var h = 0; h < headers6.length; h++) {
      var bVal = bounded3[i][headers6[h]];
      var fVal = full3[i][headers6[h]];
      if (String(bVal) !== String(fVal)) {
        throw new Error("tabops row " + i + " field " + headers6[h] + " mismatch: bounded=" + bVal + " full=" + fVal);
      }
    }
    if (bounded3[i].sourceRowIndex !== full3[i].sourceRowIndex) {
      throw new Error("tabops row " + i + " sourceRowIndex mismatch");
    }
  }

  // ---- 4. exact required headers preserved ----
  headers6.forEach(function(h) {
    if (!Object.prototype.hasOwnProperty.call(bounded3[0], h)) {
      throw new Error("tabops bounded output missing required header: " + h);
    }
  });

  // ---- 5. header mismatch fails correctly ----
  var badTabopsSheet = {
    _values: [["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"]],
    getLastRow: function() { return 1; },
    getRange: function(row, col, numRows, numCols) {
      var self = this;
      return {
        getValues: function() {
          var result = [];
          for (var r = row - 1; r < row - 1 + numRows; r++) {
            result.push(self._values[r] ? self._values[r].slice(0, numCols) : []);
          }
          return result;
        }
      };
    }
  };
  var badSS = { getSheetByName: function(n) { return n === "tabops" ? badTabopsSheet : null; } };
  var caughtMissing = false;
  try {
    readBoundedCanonicalTable(badSS, "tabops", ["ID_Trx", "MISSING_COL"], 6);
  } catch (e) {
    caughtMissing = true;
    if (e.message.indexOf("missing required column") === -1) {
      throw new Error("tabops wrong error for missing header: " + e.message);
    }
  }
  if (!caughtMissing) throw new Error("tabops missing required header did not throw");

  // ---- 9. empty dataset preserved (header-only) ----
  var emptySheet = {
    _values: [headers6.slice()],
    getLastRow: function() { return 1; },
    getRange: function(row, col, numRows, numCols) {
      var self = this;
      return {
        getValues: function() {
          var result = [];
          for (var r = row - 1; r < row - 1 + numRows; r++) {
            result.push(self._values[r] ? self._values[r].slice(0, numCols) : []);
          }
          return result;
        }
      };
    }
  };
  var emptySS = { getSheetByName: function(n) { return n === "tabops" ? emptySheet : null; } };
  var emptyResult = readBoundedCanonicalTable(emptySS, "tabops", headers6, 6);
  if (emptyResult.length !== 0) {
    throw new Error("tabops header-only sheet should return 0 rows, got " + emptyResult.length);
  }

  // ---- 10. row order preserved ----
  var orderSheet = makeTabopsSheet([
    fullHeaders.slice(),
    dataRow3.concat(["", "", "", ""]),
    dataRow1.concat(["", "", "", ""]),
    dataRow2.concat(["", "", "", ""])
  ]);
  var orderSS = { getSheetByName: function(n) { return n === "tabops" ? orderSheet : null; } };
  var orderResult = readBoundedCanonicalTable(orderSS, "tabops", headers6, 6);
  if (orderResult[0].ID_Trx !== "O3" || orderResult[1].ID_Trx !== "O1" || orderResult[2].ID_Trx !== "O2") {
    throw new Error("tabops row order not preserved");
  }

  // ---- 6, 7, 8, 11. Integration: IsActive, inactive, historical, canonical mapping ----
  var tabopsSheet = makeTabopsSheet([
    fullHeaders.slice(),
    dataRow1.concat(["", "", "", ""]),
    dataRow2.concat(["", "", "", ""]),
    dataRow3.concat(["", "", "", ""])
  ]);

  var tabsalHeaders9 = ["ID_Trx", "Tanggal", "ID_Prod", "Tipe", "Qty", "HPP", "HJ", "Source", "IsActive"];
  var tabsalFull = tabsalHeaders9.concat(["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]);
  var tabsalSheet = makeTabopsSheet([
    tabsalFull,
    ["SL1", new Date(2025, 0, 10), "P1", "Hot", 2, 4000, 10000, "TEST", true, "", "", "", ""]
  ]);

  var productsSheet = {
    _values: [
      ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"],
      ["P1", "Latte", "Coffee", "Beverage", true]
    ],
    getDataRange: function() {
      var self = this;
      return {
        getValues: function() { return self._values.map(function(r) { return r.slice(); }); }
      };
    }
  };

  var expenseItemsSheet = {
    _values: [
      ["ID_Ops", "Item", "Kategori", "Kind", "Group", "IsActive"],
      ["E1", "Rent", "Fixed", "Ops", "General", true],
      ["E2", "Utilities", "Variable", "Ops", "General", true]
    ],
    getDataRange: function() {
      var self = this;
      return {
        getValues: function() { return self._values.map(function(r) { return r.slice(); }); }
      };
    }
  };

  var integrationSS = {
    getSheetByName: function(name) {
      if (name === "tabsal") return tabsalSheet;
      if (name === "tabops") return tabopsSheet;
      if (name === "Products") return productsSheet;
      if (name === "ExpenseItems") return expenseItemsSheet;
      return null;
    }
  };

  var perf = {};
  var result = getCanonicalTransactionData(integrationSS, perf);

  // ---- 6. IsActive behavior preserved ----
  var activeExpenses = result.records.filter(function(r) { return r.sourceSheet === "tabops"; });
  if (activeExpenses.length !== 2) {
    throw new Error("tabops IsActive: expected 2 active expense records, got " + activeExpenses.length);
  }

  // ---- 7. inactive row behavior preserved ----
  var lifecycleExpenses = result.lifecycleRecords.filter(function(r) { return r.sourceSheet === "tabops"; });
  if (lifecycleExpenses.length !== 3) {
    throw new Error("tabops inactive: expected 3 lifecycle expense records, got " + lifecycleExpenses.length);
  }
  var inactiveRec = lifecycleExpenses.find(function(r) { return r.id === "O2"; });
  if (!inactiveRec || inactiveRec.isActive !== false) {
    throw new Error("tabops inactive record: isActive should be false");
  }

  // ---- 8. historical records preserved ----
  var dates = lifecycleExpenses.map(function(r) { return r.dateKey; }).sort();
  if (dates[0] !== "2025-01-15" || dates[1] !== "2025-01-16" || dates[2] !== "2025-02-01") {
    throw new Error("tabops historical: date keys not preserved: " + JSON.stringify(dates));
  }

  // ---- 11. expense canonical mapping preserved ----
  var o1 = lifecycleExpenses.find(function(r) { return r.id === "O1"; });
  if (o1.transactionType !== "Purchase") throw new Error("tabops canonical: transactionType wrong");
  if (o1.canonicalTransactionType !== "Expense") throw new Error("tabops canonical: canonicalTransactionType wrong");
  if (o1.type !== "Expense") throw new Error("tabops canonical: type wrong");
  if (o1.amount !== 50000) throw new Error("tabops canonical: amount wrong");
  if (o1.sourceSheet !== "tabops") throw new Error("tabops canonical: sourceSheet wrong");
  if (o1.expenseId !== "E1") throw new Error("tabops canonical: expenseId wrong");
  if (o1.source !== "MANUAL") throw new Error("tabops canonical: source wrong");

  // ---- 12. opsReadMs profiling key present ----
  if (typeof perf.expenseReadMs !== "number" || perf.expenseReadMs < 0) {
    throw new Error("tabops profiling: expenseReadMs missing or invalid");
  }

  // ---- 13. Sales bounded width remains 9 ----
  if (typeof perf.salesReadMs !== "number" || perf.salesReadMs < 0) {
    throw new Error("Sales profiling: salesReadMs missing or invalid");
  }
  var activeSales = result.records.filter(function(r) { return r.sourceSheet === "tabsal"; });
  if (activeSales.length !== 1) {
    throw new Error("Sales bounded: expected 1 active sales record, got " + activeSales.length);
  }
}
