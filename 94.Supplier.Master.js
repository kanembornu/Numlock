var SUPPLIER_MASTER_CONTRACT = Object.freeze({
  SHEET: "Suppliers",
  HEADERS: Object.freeze(["SupplierID", "Name", "Address", "Phone", "Contact", "Notes", "IsActive",
    "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  REQUIRED_FIELDS: Object.freeze(["Name"]),
  OPTIONAL_FIELDS: Object.freeze(["Address", "Phone", "Contact", "Notes"]),
  MUTABLE_FIELDS: Object.freeze(["Name", "Address", "Phone", "Contact", "Notes", "IsActive"]),
  ID_PREFIX: "SUP-"
});

function supplierMasterFailure_(errors) {
  return { status: "VALIDATION_FAILED", writeCount: 0, errors: errors };
}

function supplierMasterText_(value) {
  return value == null ? "" : String(value).trim();
}

function supplierMasterValidateFields_(record, operation) {
  var source = record || {}, allowed = operation === "CREATE" ?
    SUPPLIER_MASTER_CONTRACT.MUTABLE_FIELDS : SUPPLIER_MASTER_CONTRACT.MUTABLE_FIELDS.concat(["SupplierID"]);
  var errors = [];
  Object.keys(source).forEach(function(field) {
    if (allowed.indexOf(field) === -1) errors.push(masterPolicyError("UNKNOWN_FIELD", field));
  });
  return errors;
}

function buildSupplierReadModel_(rows, selectableOnly) {
  return (rows || []).filter(function(row) {
    return !selectableOnly || masterSelectionEligible(row.IsActive);
  }).map(function(row) {
    return { SupplierID: supplierMasterText_(row.SupplierID), Name: supplierMasterText_(row.Name),
      Address: supplierMasterText_(row.Address), Phone: supplierMasterText_(row.Phone),
      Contact: supplierMasterText_(row.Contact), Notes: supplierMasterText_(row.Notes),
      IsActive: isCanonicalActive(row.IsActive), CreatedAt: row.CreatedAt, CreatedBy: row.CreatedBy,
      UpdatedAt: row.UpdatedAt, UpdatedBy: row.UpdatedBy };
  });
}

function getSelectableSuppliersWithRuntime_(runtime) {
  return buildSupplierReadModel_(runtime.read(), true);
}

function resolveSupplierHistoricalWithRuntime_(runtime, supplierId) {
  return masterResolveHistoricalRecord(buildSupplierReadModel_(runtime.read(), false), "SupplierID", supplierId);
}

function createSupplierWithRuntime_(request, runtime) {
  var input = request || {}, errors = supplierMasterValidateFields_(input, "CREATE");
  errors = errors.concat(masterValidateRequiredFields(input, SUPPLIER_MASTER_CONTRACT.REQUIRED_FIELDS));
  var lifecycle = input.IsActive === undefined ? true : input.IsActive;
  var gate = masterEvaluateMutation({ record: input, lifecycle: lifecycle, actor: runtime.actor(), now: runtime.now() },
    { requiredFields: SUPPLIER_MASTER_CONTRACT.REQUIRED_FIELDS });
  errors = errors.concat(gate.errors);
  if (errors.length) return supplierMasterFailure_(errors);
  var rows = runtime.read();
  var supplierId;
  try {
    supplierId = generateCanonicalEntryId(SUPPLIER_MASTER_CONTRACT.ID_PREFIX, runtime.now(), runtime.uuid,
      function(id) { return !!masterResolveHistoricalRecord(rows, "SupplierID", id); });
  } catch (error) { return supplierMasterFailure_([masterPolicyError(error.entryCode || "ID_GENERATION_FAILED", "SupplierID")]); }
  var audit = masterBuildAuditFields(runtime.actor(), runtime.now(), null).fields;
  var row = { SupplierID: supplierId, Name: supplierMasterText_(input.Name), Address: supplierMasterText_(input.Address),
    Phone: supplierMasterText_(input.Phone), Contact: supplierMasterText_(input.Contact), Notes: supplierMasterText_(input.Notes),
    IsActive: lifecycle, CreatedAt: audit.CreatedAt, CreatedBy: audit.CreatedBy,
    UpdatedAt: audit.UpdatedAt, UpdatedBy: audit.UpdatedBy };
  runtime.append(row);
  return { status: "CREATED", writeCount: 1, supplier: row };
}

function updateSupplierWithRuntime_(request, runtime) {
  var input = request || {}, supplierId = supplierMasterText_(input.SupplierID);
  var existing = masterResolveHistoricalRecord(runtime.read(), "SupplierID", supplierId);
  if (!existing) return supplierMasterFailure_([masterPolicyError("SUPPLIER_NOT_FOUND", "SupplierID")]);
  var errors = supplierMasterValidateFields_(input, "UPDATE");
  errors = errors.concat(masterValidateStableIdentity(existing.SupplierID, input.SupplierID));
  var merged = {}, fields = SUPPLIER_MASTER_CONTRACT.HEADERS;
  fields.forEach(function(field) { merged[field] = existing[field]; });
  SUPPLIER_MASTER_CONTRACT.MUTABLE_FIELDS.forEach(function(field) {
    if (Object.prototype.hasOwnProperty.call(input, field)) merged[field] = input[field];
  });
  errors = errors.concat(masterValidateRequiredFields(merged, SUPPLIER_MASTER_CONTRACT.REQUIRED_FIELDS));
  var lifecycle = Object.prototype.hasOwnProperty.call(input, "IsActive") ? input.IsActive : isCanonicalActive(existing.IsActive);
  var gate = masterEvaluateMutation({ record: merged, existingRecord: existing, lifecycle: lifecycle,
    actor: runtime.actor(), now: runtime.now() }, { requiredFields: SUPPLIER_MASTER_CONTRACT.REQUIRED_FIELDS, identityField: "SupplierID" });
  errors = errors.concat(gate.errors);
  if (errors.length) return supplierMasterFailure_(errors);
  var audit = masterBuildAuditFields(runtime.actor(), runtime.now(), existing).fields;
  merged.Name = supplierMasterText_(merged.Name);
  ["Address", "Phone", "Contact", "Notes"].forEach(function(field) { merged[field] = supplierMasterText_(merged[field]); });
  merged.IsActive = lifecycle; merged.CreatedAt = audit.CreatedAt; merged.CreatedBy = audit.CreatedBy;
  merged.UpdatedAt = audit.UpdatedAt; merged.UpdatedBy = audit.UpdatedBy;
  runtime.update(existing, merged);
  return { status: "UPDATED", writeCount: 1, supplier: merged };
}

function deleteSupplierWithRuntime_(supplierId, runtime, referenceCheck) {
  var existing = masterResolveHistoricalRecord(runtime.read(), "SupplierID", supplierId);
  if (!existing) return supplierMasterFailure_([masterPolicyError("SUPPLIER_NOT_FOUND", "SupplierID")]);
  var refusal = masterEvaluateDeleteRefusal(existing, referenceCheck);
  return { status: "REFUSED", reason: refusal.refusal.code, references: refusal.references, writeCount: 0 };
}

function supplierSpreadsheetRuntime_(ss) {
  var sheet = ss.getSheetByName(SUPPLIER_MASTER_CONTRACT.SHEET);
  requireCanonicalHeaders(sheet, SUPPLIER_MASTER_CONTRACT.HEADERS);
  return { read: function() { return readCanonicalTable(ss, SUPPLIER_MASTER_CONTRACT.SHEET, SUPPLIER_MASTER_CONTRACT.HEADERS); },
    actor: function() { return Session.getActiveUser().getEmail(); }, now: function() { return new Date(); },
    uuid: function() { return Utilities.getUuid(); },
    append: function(row) { sheet.getRange(sheet.getLastRow() + 1, 1, 1, SUPPLIER_MASTER_CONTRACT.HEADERS.length)
      .setValues([SUPPLIER_MASTER_CONTRACT.HEADERS.map(function(field) { return row[field]; })]); },
    update: function(existing, row) { sheet.getRange(existing.sourceRowIndex + 1, 1, 1, SUPPLIER_MASTER_CONTRACT.HEADERS.length)
      .setValues([SUPPLIER_MASTER_CONTRACT.HEADERS.map(function(field) { return row[field]; })]); } };
}

function getSelectableSuppliers() {
  return getSelectableSuppliersWithRuntime_(supplierSpreadsheetRuntime_(SpreadsheetApp.getActiveSpreadsheet()));
}

function resolveSupplierHistorical(supplierId) {
  return resolveSupplierHistoricalWithRuntime_(supplierSpreadsheetRuntime_(SpreadsheetApp.getActiveSpreadsheet()), supplierId);
}

function createSupplier(request) {
  throw new Error("Administrative execution is disabled");
}

function updateSupplier(request) {
  throw new Error("Administrative execution is disabled");
}

function deleteSupplier(supplierId) {
  throw new Error("Administrative execution is disabled");
}
