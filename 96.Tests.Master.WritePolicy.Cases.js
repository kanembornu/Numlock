function testMasterWritePolicyContracts() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }

  // T1 — required-field rejection (generic; no Supplier hard-coding)
  var missing = masterValidateRequiredFields({ Name: "", Code: "C-1" }, ["Name", "Code"]);
  check(missing.length === 1 && missing[0].code === "REQUIRED_FIELD" && missing[0].field === "Name",
    "T1: blank required field must be rejected with REQUIRED_FIELD");
  var satisfied = masterValidateRequiredFields({ Name: "  ", Code: "C-1" }, ["Code"]);
  check(satisfied.length === 0, "T1: present required fields must pass");

  // T2 — stable-ID mutation rejection on update
  var idChange = masterValidateStableIdentity("SUP-1", "SUP-2");
  check(idChange.length === 1 && idChange[0].code === "STABLE_ID_IMMUTABLE",
    "T2: identity change on existing record must be refused");
  var blankExisting = masterValidateStableIdentity("", "SUP-1");
  check(blankExisting.length === 1 && blankExisting[0].code === "STABLE_ID_IMMUTABLE",
    "T2: blank existing identity must fail closed");
  check(masterValidateStableIdentity("SUP-1", "SUP-1").length === 0,
    "T2: unchanged identity must pass");

  // T3 — Active → Inactive representable without deletion
  var deactivate = masterLifecycleValue(false);
  check(deactivate.ok === true && deactivate.active === false,
    "T3: Active→Inactive must be representable as boolean lifecycle without delete");
  var badLifecycle = masterLifecycleValue("TRUE");
  check(badLifecycle.ok === false && badLifecycle.errors[0].code === "INVALID_LIFECYCLE_VALUE",
    "T3: non-boolean lifecycle must fail closed");
  var deleteRefused = masterEvaluateDeleteRefusal({ ID: "SUP-1" }, function() { return []; });
  check(deleteRefused.allowed === false && deleteRefused.refusal.code === "INACTIVE_INSTEAD_OF_DELETE",
    "T3: destructive delete must be refused even with zero references (inactive instead)");

  // T4 — inactive record remains resolvable through historical/read path
  var rows = [
    { ItemID: "I-1", ItemName: "Active item", IsActive: true },
    { ItemID: "I-2", ItemName: "Retired item", IsActive: false }
  ];
  var inactive = masterResolveHistoricalRecord(rows, "ItemID", "I-2");
  check(!!inactive && inactive.ItemName === "Retired item",
    "T4: inactive record must remain resolvable by stable identity");
  check(masterSelectionEligible(inactive.IsActive) === false,
    "T4: inactive record must not be eligible for new operational selection");
  check(masterSelectionEligible(rows[0].IsActive) === true,
    "T4: active record must remain eligible for selection");
  check(masterResolveHistoricalRecord(rows, "ItemID", "I-9") === null,
    "T4: unknown identity must resolve to null");

  // T5 — destructive deletion refused by supplied reference guard
  var refs = masterEvaluateDeleteRefusal({ ID: "I-1" }, function() { return [{ source: "COGSRecipes", count: 2 }]; });
  check(refs.allowed === false && refs.refusal.code === "HISTORICAL_REFERENCE_EXISTS" && refs.references.length === 1,
    "T5: existing historical references must refuse destructive deletion");
  var noCheck = masterEvaluateDeleteRefusal({ ID: "I-1" }, null);
  check(noCheck.allowed === false && noCheck.refusal.code === "REFERENCE_CHECK_REQUIRED",
    "T5: missing domain reference check must fail closed");

  // T6 — immutable-after-reference structural mutation refused
  var policyMap = { Name: "MUTABLE_DESCRIPTIVE", BaseUOM: "IMMUTABLE_AFTER_REFERENCE",
    StandardCost: "VERSION_REQUIRED_AFTER_REFERENCE", Notes: "MUTABLE_PROSPECTIVE" };
  var immutable = masterEvaluateStructuralMutation(policyMap, "BaseUOM", { hasHistoricalReferences: true });
  check(immutable.allowed === false && immutable.errors[0].code === "IMMUTABLE_AFTER_REFERENCE",
    "T6: structural mutation on referenced immutable field must be refused");
  var unreferenced = masterEvaluateStructuralMutation(policyMap, "BaseUOM", { hasHistoricalReferences: false });
  check(unreferenced.allowed === true,
    "T6: unreferenced field mutation must remain allowed (prospective)");
  var versionRequired = masterEvaluateStructuralMutation(policyMap, "StandardCost",
    { hasHistoricalReferences: true });
  check(versionRequired.allowed === false && versionRequired.errors[0].code === "VERSION_REQUIRED_AFTER_REFERENCE",
    "T6: referenced version-gated field without version token must be refused");
  var versioned = masterEvaluateStructuralMutation(policyMap, "StandardCost",
    { hasHistoricalReferences: true, versionToken: "V2" });
  check(versioned.allowed === true, "T6: version token must satisfy version-required policy");
  var unknownPolicy = masterEvaluateStructuralMutation(policyMap, "Ghost", {});
  check(unknownPolicy.allowed === false && unknownPolicy.errors[0].code === "UNKNOWN_POLICY",
    "T6: unknown structural policy must fail closed");

  // T7 — mutable descriptive field can still change
  var descriptive = masterEvaluateStructuralMutation(policyMap, "Name", { hasHistoricalReferences: true });
  check(descriptive.allowed === true, "T7: MUTABLE_DESCRIPTIVE field must allow change");
  var prospective = masterEvaluateStructuralMutation(policyMap, "Notes", { hasHistoricalReferences: true });
  check(prospective.allowed === true, "T7: MUTABLE_PROSPECTIVE field must allow change");

  // T8 — invalid mutation produces zero writes
  var writes = 0;
  function syntheticDomainWrite(ok) { if (ok) writes++; }
  var invalidRequest = masterEvaluateMutation(
    { record: { Name: "" }, actor: "", now: "not-a-date", lifecycle: "TRUE" },
    { requiredFields: ["Name"] });
  syntheticDomainWrite(invalidRequest.ok);
  check(invalidRequest.ok === false && invalidRequest.writeCount === 0 && writes === 0,
    "T8: invalid mutation must be rejected with zero writes");
  var invalidStable = masterEvaluateMutation(
    { record: { ItemID: "I-2" }, existingRecord: { ItemID: "I-1" }, actor: "ops@test", now: new Date(2026, 9, 5) },
    { identityField: "ItemID" });
  syntheticDomainWrite(invalidStable.ok);
  check(invalidStable.ok === false && invalidStable.writeCount === 0 && writes === 0,
    "T8: stable-ID mutation must be rejected with zero writes");
  var validRequest = masterEvaluateMutation(
    { record: { ItemID: "I-1", Name: "Renamed" }, existingRecord: { ItemID: "I-1", Name: "Old" },
      field: "Name", context: { hasHistoricalReferences: true }, identityField: "ItemID",
      actor: "ops@test", now: new Date(2026, 9, 5), lifecycle: false },
    { requiredFields: ["Name"], identityField: "ItemID", structuralPolicyMap: policyMap });
  syntheticDomainWrite(validRequest.ok);
  check(validRequest.ok === true && validRequest.writeCount === 0 && writes === 1,
    "T8: valid mutation must be allowed; domain performs the single write");

  // T9 — audit fields preserve creation metadata, refresh modification metadata
  var created = masterBuildAuditFields("creator@test", new Date(2026, 0, 1), null);
  check(created.ok === true && created.fields.CreatedAt === created.fields.UpdatedAt &&
    created.fields.CreatedBy === "creator@test" && created.fields.UpdatedBy === "creator@test",
    "T9: creation must stamp Created* and Updated* per existing convention");
  var existingRow = { ItemID: "I-1", CreatedAt: new Date(2026, 0, 1), CreatedBy: "creator@test",
    UpdatedAt: new Date(2026, 0, 1), UpdatedBy: "creator@test" };
  var updated = masterBuildAuditFields("ops@test", new Date(2026, 9, 5), existingRow);
  check(updated.ok === true && updated.fields.CreatedAt === existingRow.CreatedAt &&
    updated.fields.CreatedBy === "creator@test" && updated.fields.UpdatedBy === "ops@test" &&
    updated.fields.UpdatedAt.getTime() === new Date(2026, 9, 5).getTime(),
    "T9: update must preserve Created* and refresh Updated*");
  var noActor = masterBuildAuditFields("  ", new Date(2026, 9, 5), null);
  check(noActor.ok === false && noActor.errors[0].code === "ACTOR_REQUIRED",
    "T9: blank actor must fail closed");
  var badStamp = masterBuildAuditFields("ops@test", "not-a-date", null);
  check(badStamp.ok === false && badStamp.errors[0].code === "INVALID_TIMESTAMP",
    "T9: invalid timestamp must fail closed");

  // T10 — no Finance/PurchaseEvent side effect; policy module performs no writes
  var policySource = [
    masterValidateRequiredFields, masterValidateStableIdentity, masterLifecycleValue,
    masterSelectionEligible, masterResolveHistoricalRecord, masterEvaluateDeleteRefusal,
    masterEvaluateStructuralMutation, masterBuildAuditFields, masterEvaluateMutation
  ].map(function(fn) { return fn.toString(); }).join("\n");
  check(policySource.indexOf("PurchaseEvent") === -1 && policySource.indexOf("Finance") === -1,
    "T10: policy module must have no PurchaseEvent/Finance references");
  check(policySource.indexOf("setValues") === -1 && policySource.indexOf("getRange") === -1 &&
    policySource.indexOf("insertSheet") === -1 && policySource.indexOf("getActiveSpreadsheet") === -1,
    "T10: policy module must perform no spreadsheet writes");
  check(typeof masterEvaluateMutation({ record: { Name: "x" }, actor: "a@b", now: new Date(2026, 9, 5) },
    { requiredFields: ["Name"] }).writeCount === "number",
    "T10: policy gate must report writeCount without executing writes");
  check(MASTER_WRITE_POLICY.STRUCTURAL_CLASSES.length === 5 &&
    MASTER_WRITE_POLICY.DELETE_POLICY === "INACTIVE_INSTEAD_OF_DELETE" &&
    Object.isFrozen(MASTER_WRITE_POLICY),
    "T10: structural taxonomy and delete policy constants must be frozen");
  check(MASTER_WRITE_POLICY.AUDIT_HEADERS.join(",") === "CreatedAt,CreatedBy,UpdatedAt,UpdatedBy",
    "T10: audit headers must preserve existing convention");

  Logger.log("Master Write Policy scenarios: " + scenarios);
}
