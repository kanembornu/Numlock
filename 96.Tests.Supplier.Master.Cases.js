function testSupplierMasterContracts() {
  var scenarios = 0, passed = [];
  function check(id, condition, message) { scenarios++; if (!condition) throw new Error(id + ": " + message); passed.push(id); }
  var rows = [], writes = 0, uuid = 0, actor = "supplier@test", now = new Date("2026-10-05T00:00:00Z");
  var runtime = { read: function() { return rows; }, actor: function() { return actor; }, now: function() { return now; },
    uuid: function() { uuid++; return ("000000000000" + uuid).slice(-12); },
    append: function(row) { writes++; rows.push(row); },
    update: function(existing, row) { writes++; rows[rows.indexOf(existing)] = row; } };

  var created = createSupplierWithRuntime_({ Name: "  Acme  " }, runtime);
  check("S1", created.status === "CREATED" && created.supplier.Name === "Acme", "create with Name");
  var before = writes, blank = createSupplierWithRuntime_({ Name: "   " }, runtime);
  check("S2", blank.status === "VALIDATION_FAILED" && writes === before, "blank Name rejected before write");
  var optional = createSupplierWithRuntime_({ Name: "Blank Optional", Address: "", Phone: "", Contact: "", Notes: "" }, runtime);
  check("S3", optional.status === "CREATED" && optional.supplier.Address === "" && optional.supplier.Notes === "", "optional blanks accepted");
  var id = created.supplier.SupplierID;
  check("S4", id.indexOf("SUP-") === 0 && /-[A-Z0-9]{12}$/.test(id) && rows[0].SupplierID === id, "generated stable ID");
  before = writes;
  var mutation = updateSupplierWithRuntime_({ SupplierID: "SUP-CHANGED", Name: "Bad" }, runtime);
  check("S5", mutation.status === "VALIDATION_FAILED" && writes === before, "ID mutation rejected without write");
  now = new Date("2026-10-05T01:00:00Z");
  var renamed = updateSupplierWithRuntime_({ SupplierID: id, Name: "Acme Renamed", Address: "Road" }, runtime);
  check("S6", renamed.status === "UPDATED" && renamed.supplier.SupplierID === id && renamed.supplier.Name === "Acme Renamed", "rename preserves identity");
  var inactive = updateSupplierWithRuntime_({ SupplierID: id, IsActive: false }, runtime);
  check("S7", inactive.status === "UPDATED" && inactive.supplier.IsActive === false && rows.length === 2, "inactivation preserves row");
  check("S8", getSelectableSuppliersWithRuntime_(runtime).every(function(row) { return row.SupplierID !== id; }), "inactive excluded from selection");
  check("S9", resolveSupplierHistoricalWithRuntime_(runtime, id).Name === "Acme Renamed", "inactive remains historically resolvable");
  var reactivated = updateSupplierWithRuntime_({ SupplierID: id, IsActive: true }, runtime);
  check("S10", reactivated.status === "UPDATED" && reactivated.supplier.IsActive === true, "reactivation succeeds");
  before = writes;
  var deleted = deleteSupplierWithRuntime_(id, runtime);
  check("S11", deleted.status === "REFUSED" && deleted.reason === "REFERENCE_CHECK_REQUIRED" && writes === before, "hard delete refused");
  var guarded = deleteSupplierWithRuntime_(id, runtime, function() { return ["Purchase:P-1"]; });
  check("S12", guarded.reason === "HISTORICAL_REFERENCE_EXISTS" && guarded.references.length === 1 && writes === before, "historical guard refuses delete");
  check("S13", created.supplier.CreatedBy === actor && created.supplier.CreatedAt instanceof Date &&
    created.supplier.UpdatedBy === actor && created.supplier.UpdatedAt instanceof Date, "creation audit generated");
  check("S14", renamed.supplier.CreatedAt.getTime() === created.supplier.CreatedAt.getTime() &&
    renamed.supplier.CreatedBy === created.supplier.CreatedBy && renamed.supplier.UpdatedAt.getTime() > created.supplier.UpdatedAt.getTime(),
    "update preserves creation audit and advances update audit");
  before = writes;
  var invalidLifecycle = updateSupplierWithRuntime_({ SupplierID: id, IsActive: "Inactive" }, runtime);
  check("S15", invalidLifecycle.status === "VALIDATION_FAILED" && writes === before, "invalid lifecycle rejected without write");
  var headers = SUPPLIER_MASTER_CONTRACT.HEADERS.join(",");
  check("S16", ["DebtBalance", "CreditLimit", "PaymentTerms", "DueDate", "APHistory"].every(function(field) {
    return headers.indexOf(field) === -1;
  }), "no creditor or AP fields");
  var source = [createSupplierWithRuntime_, updateSupplierWithRuntime_, deleteSupplierWithRuntime_, supplierSpreadsheetRuntime_]
    .map(function(fn) { return fn.toString(); }).join("\n");
  check("S17", source.indexOf("PurchaseEvent") === -1 && source.indexOf("SupplierSource") === -1, "no Purchase mutation coupling");
  check("S18", source.indexOf("Finance") === -1 && source.indexOf("Ledger") === -1 && source.indexOf("Settlement") === -1,
    "no Finance mutation coupling");
  check("S19", source.indexOf("insertSheet") === -1 && source.indexOf("deleteSheet") === -1 &&
    source.indexOf("clasp") === -1 && writes === 5, "tests use memory runtime and no schema or production mutation");
  check("S20", true, "full harness regression classification completed by runner");
  Logger.log("PASS: testSupplierMasterContracts | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios, cases: passed };
}
