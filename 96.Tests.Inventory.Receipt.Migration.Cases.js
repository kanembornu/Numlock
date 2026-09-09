function testInventoryReceiptMigrationContracts() {
  var count = 0;
  function check(condition, label) { count++; if (!condition) throw new Error("RECEIPT_MIGRATION_TEST:" + label); }
  function fixture() {
    return { properties: { sheetId: 113310031, title: "InventoryReceipts", sheetType: "GRID", gridProperties: { rowCount: 1000, columnCount: 31 } },
      developerMetadata: [{ metadataKey: "NUMLOCK_INVENTORY_RECEIPTS_11V3", visibility: "DOCUMENT", location: { sheetId: 113310031 },
        metadataValue: JSON.stringify({ headers: INVENTORY_RECEIPT_MIGRATION.HEADERS, sheetId: 113310031, preservation: "a".repeat(64) }) }],
      data: [{ rowData: [{ values: INVENTORY_RECEIPT_MIGRATION.HEADERS.split(",").map(function(h) { return { userEnteredValue: { stringValue: h } }; }) }] }] };
  }
  var headers = inventoryReceiptMigrationContract_();
  check(headers.length === 31 && new Set(headers).size === 31 && headers.every(Boolean), "exact31 unique nonblank");
  check(inventoryReceiptMigrationClassify_(null).status === "READY_CREATE", "absent");
  var s = fixture(), result = inventoryReceiptMigrationClassify_(s);
  check(result.status === "ALREADY_MIGRATED" && result.writeCount === 0 && result.businessRows === 0 && result.postingAllowed === false, "exact owned");
  s.developerMetadata = []; check(inventoryReceiptMigrationClassify_(s).status === "REFUSE", "nonowned exact");
  s = fixture(); s.data = []; check(inventoryReceiptMigrationClassify_(s).status === "RECOVERABLE", "owned blank");
  s = fixture(); s.data[0].rowData[0].values.length = 8; check(inventoryReceiptMigrationClassify_(s).status === "RECOVERABLE", "owned prefix");
  s.data[0].rowData[0].values[0].userEnteredValue.stringValue = "Foreign";
  check(inventoryReceiptMigrationClassify_(s).status === "REFUSE", "semantic drift");
  s = fixture(); s.properties.gridProperties.columnCount = 32;
  check(inventoryReceiptMigrationClassify_(s).status === "REFUSE", "extra column");
  s = fixture(); s.data[0].rowData.push({ values: [{ userEnteredValue: { stringValue: "foreign" } }] });
  check(inventoryReceiptMigrationClassify_(s).status === "REFUSE", "invalid rows");
  s.data[0].rowData[0].values = []; check(inventoryReceiptMigrationClassify_(s).status === "REFUSE", "partial foreign rows");
  s = fixture(); s.data[0].rowData[0].values[0].note = "foreign";
  check(inventoryReceiptMigrationClassify_(s).status === "REFUSE", "notes");
  s = fixture(); s.data[0].rowData[0].values[0].userEnteredValue = { formulaValue: "=1" };
  check(inventoryReceiptMigrationClassify_(s).status === "REFUSE", "formula");
  s = fixture(); s.developerMetadata.push(s.developerMetadata[0]);
  check(inventoryReceiptMigrationClassify_(s).status === "REFUSE", "duplicate owner");
  s = fixture(); s.developerMetadata[0].location.sheetId = 42;
  check(inventoryReceiptMigrationClassify_(s).status === "REFUSE", "wrong owner location");
  s = fixture(); s.developerMetadata[0].metadataValue = "{}";
  check(inventoryReceiptMigrationClassify_(s).status === "REFUSE", "unbound owner");
  s = fixture(); var row = { ReceiptID: "r", LineID: "l", Revision: 1, IdempotencyKey: "test-key", Status: "DRAFT", IsActive: true,
    NormalizedPayload: "{}", CreatedBy: "SYNTHETIC", UpdatedBy: "SYNTHETIC", CreatedAt: "2026-10-01T00:00:00Z", UpdatedAt: "2026-10-01T00:00:00Z" };
  s.data[0].rowData.push({ values: headers.map(function(h) { var v = row[h] === undefined ? "" : row[h];
    return { userEnteredValue: typeof v === "number" ? { numberValue: v } : typeof v === "boolean" ? { boolValue: v } : { stringValue: v } }; }) });
  result = inventoryReceiptMigrationClassify_(s);
  check(result.status === "ALREADY_MIGRATED" && result.businessRows === 1 && result.writeCount === 0, "valid existing rows untouched");
  var ready = { status: "READY_CREATE", writeCount: 0, businessRows: 0, postingAllowed: false, preservationFingerprint: "b".repeat(64) };
  var batch = inventoryReceiptMigrationBatch_(ready);
  check(batch.requests.length === 3, "single atomic batch three subrequests");
  check(batch.requests[0].addSheet.properties.title === "InventoryReceipts" && batch.requests[0].addSheet.properties.gridProperties.columnCount === 31, "only receipt sheet");
  var update = batch.requests[1].updateCells;
  check(update.start.rowIndex === 0 && update.start.columnIndex === 0 && update.rows.length === 1 && update.rows[0].values.length === 31 && update.fields === "userEnteredValue", "only exact header no business rows");
  check(update.rows[0].values.map(function(v) { return v.userEnteredValue.stringValue; }).join(",") === INVENTORY_RECEIPT_MIGRATION.HEADERS, "batch header contract");
  check(batch.requests[2].createDeveloperMetadata.developerMetadata.location.sheetId === update.start.sheetId, "ownership bound to created sheet");
  ["ALREADY_MIGRATED", "REFUSE", "RECOVERABLE", "MIGRATION_UNCERTAIN"].forEach(function(status) {
    var blocked = Object.assign({}, ready, { status: status }), threw = false;
    try { inventoryReceiptMigrationBatch_(blocked); } catch (error) { threw = true; }
    check(threw, "no mutation batch for " + status);
  });
  [ { businessRows: 1 }, { writeCount: 1 }, { postingAllowed: true }, { preservationFingerprint: "" } ].forEach(function(patch) {
    var threw = false; try { inventoryReceiptMigrationBatch_(Object.assign({}, ready, patch)); } catch (error) { threw = true; }
    check(threw, "unsafe batch gate " + JSON.stringify(patch));
  });
  return { status: "PASS", scenarios: count, method: "FUNCTION_LOCAL_SYNTHETIC_MEMORY", productionMutation: false };
}
