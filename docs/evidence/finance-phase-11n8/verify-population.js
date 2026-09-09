const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const context = { console, Logger: { log() {} }, NUMLOCK_PRODUCTION_STORAGE_POLICY: { SPREADSHEET_ID: "PRODUCTION" } };
vm.createContext(context);
["20.Data.Source.js", "36.Finance.Service.js", "38.CapitalEquity.Service.js", "39.Balance.Foundation.js",
  "40.Inventory.Conversion.Population.js"].forEach(file => vm.runInContext(
  fs.readFileSync(path.resolve(ROOT, "../../..", file), "utf8"), context, { filename: file }));

const expected = JSON.parse(fs.readFileSync(path.join(ROOT, "candidate-rows.json"), "utf8"));
const evidence = JSON.parse(fs.readFileSync(path.join(ROOT, "drive-evidence-map.json"), "utf8"));
const byId = Object.fromEntries(evidence.Artifacts.map(entry => [entry.DriveFileID,
  fs.readFileSync(path.join(ROOT, "manifests", entry.ManifestID + ".manifest"))]));
const manifestRuntime = {
  readManifestBytes(id) { return Array.from(byId[id]); },
  sha256(bytes) { return Array.from(crypto.createHash("sha256").update(Buffer.from(bytes)).digest()); },
  bytesToString(bytes) { return Buffer.from(bytes).toString("utf8"); }
};
const candidates = context.buildInventoryConversionPopulationCandidates(manifestRuntime);
assert.deepStrictEqual(JSON.parse(JSON.stringify(candidates)), expected, "Drive manifest candidates must match frozen export");

function values(headers, rows) { return [headers.slice(), ...rows.map(row => headers.map(header => row[header] ?? ""))]; }
function sheet(name, initial) {
  return { name, values: initial.map(row => row.slice()), maxRows: 1000, maxColumns: 26,
    getName() { return this.name; }, getMaxRows() { return this.maxRows; }, getMaxColumns() { return this.maxColumns; },
    getLastRow() { let last=0; this.values.forEach((row,index)=>{if(row.some(value=>value!==""&&value!=null))last=index+1;}); return last; },
    getLastColumn() { let last=0; this.values.forEach(row=>row.forEach((value,index)=>{if(value!==""&&value!=null)last=Math.max(last,index+1);})); return last; },
    getDataRange() { const self=this; return { getValues() { return self.values.map(row => row.slice()); }, clearContent() { self.values=[]; } }; },
    getRange(row, column, rowCount, columnCount) { const self=this; return {
      getValues() { return Array.from({length:rowCount},(_,r)=>Array.from({length:columnCount},(_,c)=>
        (self.values[row-1+r]||[])[column-1+c] ?? "")); },
      getFormulas() { return Array.from({length:rowCount},()=>Array(columnCount).fill("")); },
      getNotes() { return Array.from({length:rowCount},()=>Array(columnCount).fill("")); },
      setValues(input) { input.forEach((source,r)=>{ while(self.values.length<row+r) self.values.push([]);
        source.forEach((value,c)=>{ self.values[row-1+r][column-1+c]=value; }); }); return this; },
      clearContent() { for(let r=0;r<rowCount;r++) for(let c=0;c<columnCount;c++)
        if(self.values[row-1+r]) self.values[row-1+r][column-1+c]=""; return this; }
    }; }
  };
}
const itemRows = candidates.map(row => ({ ItemID: row.ItemID, ItemName: row.PackageIdentity.split("|")[2],
  Classification: ["ING-031","ING-032","ING-033","ING-034"].includes(row.ItemID) ? "PACKAGING" : "RAW_MATERIAL",
  BaseUOM: row.ToUOM, EffectiveFrom: "2026-01-01", EffectiveTo: "", IsActive: true,
  SourceIngredientID: row.ItemID, CreatedAt: "", CreatedBy: "", UpdatedAt: "", UpdatedBy: "" }));
itemRows.splice(14, 0, { ItemID:"ING-018", ItemName:"Lemon", Classification:"RAW_MATERIAL", BaseUOM:"slice",
  EffectiveFrom:"2026-01-01", EffectiveTo:"", IsActive:true, SourceIngredientID:"ING-018",
  CreatedAt:"", CreatedBy:"", UpdatedAt:"", UpdatedBy:"" });
const account = Object.assign({ IsActive:true, CreatedAt:"", UpdatedAt:"" }, context.BALANCE_FOUNDATION_POLICY.INVENTORY_ASSET_ACCOUNT);
const sheets = {
  InventoryUOMConversions: sheet("InventoryUOMConversions", [context.BALANCE_FOUNDATION_POLICY.INVENTORY_UOM_CONVERSION_HEADERS]),
  InventoryItems: sheet("InventoryItems", values(context.BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS, itemRows)),
  InventoryLedger: sheet("InventoryLedger", [context.BALANCE_FOUNDATION_POLICY.INVENTORY_LEDGER_HEADERS]),
  Accounts: sheet("Accounts", values(context.INVENTORY_SCHEMA_MIGRATION.ACCOUNTS_HEADERS, [account]))
};
const spreadsheet = { getId(){return "LOCAL";}, getName(){return "Local";}, getSheetByName(name){return sheets[name]||null;} };
const runtime = Object.assign({ mode: context.INVENTORY_SCHEMA_RUNTIME.TEST_MODE, spreadsheet, freshSpreadsheet(){return spreadsheet;}, flush(){} }, manifestRuntime);
assert.strictEqual(context.buildInventoryConversionPopulationPlan(context.readInventoryConversionPopulationState(spreadsheet), candidates).status, "READY");
const first = context.executeInventoryConversionCandidatePopulationWithRuntime(runtime);
assert.strictEqual(first.status, "POPULATED"); assert.strictEqual(first.writeCount, 1); assert.strictEqual(first.acceptance.status, "PASS");
const writtenValues = sheets.InventoryUOMConversions.values.map(row => row.slice());
for (let index=1; index<sheets.InventoryUOMConversions.values.length; index++) {
  sheets.InventoryUOMConversions.values[index][8] = vm.runInContext("new Date(2026, 9, 1)", context);
  sheets.InventoryUOMConversions.values[index][12] = vm.runInContext("new Date(2026, 8, 4)", context);
  sheets.InventoryUOMConversions.values[index][14] = vm.runInContext("new Date('2026-09-04T16:00:00+07:00')", context);
}
const second = context.executeInventoryConversionCandidatePopulationWithRuntime(runtime);
assert.strictEqual(second.status, "ALREADY_POPULATED", JSON.stringify(second)); assert.strictEqual(second.writeCount, 0);
sheets.InventoryUOMConversions.values = writtenValues;
assert.strictEqual(context.executeInventoryConversionCandidateRecoveryWithRuntime(runtime, first.migrationRecord).status, "RECOVERED");
assert.strictEqual(context.inventoryMigrationRows(context.readInventoryConversionPopulationState(spreadsheet).conversions).length, 0);
assert.strictEqual(context.executeInventoryConversionCandidatePopulationWithRuntime(Object.assign({}, runtime,
  { candidateRows: candidates.concat([candidates[0]]) })).status, "REFUSED");
assert.strictEqual(context.executeInventoryConversionCandidatePopulationWithRuntime(Object.assign({}, runtime,
  { candidateRows: candidates.map((row,index)=>index?row:Object.assign({},row,{IsActive:true})) })).status, "REFUSED");
assert.strictEqual(context.executeInventoryConversionCandidatePopulationWithRuntime(Object.assign({}, runtime,
  { candidateRows: candidates.map((row,index)=>index?row:Object.assign({},row,
    {EvidenceRef:row.EvidenceRef.replace(/[a-f0-9]$/, "0")})) })).status, "REFUSED");
assert.strictEqual(context.executeInventoryConversionCandidatePopulationWithRuntime(Object.assign({}, runtime,
  { candidateRows: candidates.map((row,index)=>index?row:Object.assign({},row,
    {EvidenceRef:candidates[1].EvidenceRef})) })).status, "REFUSED");
console.log(JSON.stringify({status:"PASS", candidates:21, writeCount:1, idempotency:"ALREADY_POPULATED",
  recovery:"PASS", inactive:21, validator:"PASS", postingGate:"REFUSED_INACTIVE"}));
