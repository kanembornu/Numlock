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
          getDataRange: function() {
            return {
              getValues: function() {
                return [["ID_Trx", "Tanggal", "ID_Ops", "Nilai", "Source", "IsActive"]];
              }
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
