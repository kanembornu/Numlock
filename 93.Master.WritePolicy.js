/**
 * 93.Master.WritePolicy.js — Master write-path policy foundation (Phase 1.1).
 *
 * Pure server-side mutation-policy primitives for canonical Master Data domains
 * (Supplier, Item, UOM/conversion). Reuses existing conventions:
 * - isCanonicalActive / canonicalDate from 20.Data.Source.js
 * - audit field convention from 92.Products.Domain.js (CreatedAt/CreatedBy/UpdatedAt/UpdatedBy)
 * - fail-closed validate-before-write pattern; actor injected by the domain caller
 *   (Session.getActiveUser().getEmail() at the domain boundary, not here)
 *
 * Invariants:
 * - No persistence calls. Evaluation only. Domain services write only when a
 *   composed gate returns ok === true; every refusal returns writeCount: 0.
 * - No domain-specific Supplier/Item/UOM logic.
 * - Fail closed: unknown policy classes, blank identity, missing actor, and
 *   destructive-delete requests are refused.
 */
var MASTER_WRITE_POLICY = Object.freeze({
  STRUCTURAL_CLASSES: Object.freeze([
    "MUTABLE_DESCRIPTIVE",
    "MUTABLE_PROSPECTIVE",
    "IMMUTABLE_AFTER_REFERENCE",
    "VERSION_REQUIRED_AFTER_REFERENCE",
    "INACTIVE_INSTEAD_OF_DELETE"
  ]),
  AUDIT_HEADERS: Object.freeze(["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  DELETE_POLICY: "INACTIVE_INSTEAD_OF_DELETE"
});

function masterPolicyError(code, field) {
  return { code: code, field: field || null };
}

function masterFieldMissing(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function masterValidateRequiredFields(record, requiredFields) {
  var errors = [];
  var fields = Array.isArray(requiredFields) ? requiredFields : [];
  var source = record || {};
  fields.forEach(function(field) {
    if (masterFieldMissing(source[field])) errors.push(masterPolicyError("REQUIRED_FIELD", field));
  });
  return errors;
}

function masterValidateStableIdentity(existingId, requestedId) {
  var existing = existingId == null ? "" : String(existingId).trim();
  var requested = requestedId == null ? "" : String(requestedId).trim();
  if (!existing || requested !== existing) return [masterPolicyError("STABLE_ID_IMMUTABLE", "ID")];
  return [];
}

function masterLifecycleValue(isActive) {
  if (typeof isActive !== "boolean") {
    return { ok: false, errors: [masterPolicyError("INVALID_LIFECYCLE_VALUE", "IsActive")] };
  }
  return { ok: true, active: isActive, errors: [] };
}

function masterSelectionEligible(isActive) {
  return isCanonicalActive(isActive) === true;
}

function masterResolveHistoricalRecord(rows, idField, id) {
  var key = id == null ? "" : String(id).trim();
  if (!key || !idField) return null;
  var source = Array.isArray(rows) ? rows : [];
  var matches = source.filter(function(row) {
    return !!row && String(row[idField] || "").trim() === key;
  });
  return matches.length ? matches[0] : null;
}

function masterEvaluateDeleteRefusal(record, domainReferenceCheck) {
  if (typeof domainReferenceCheck !== "function") {
    return { allowed: false, refusal: masterPolicyError("REFERENCE_CHECK_REQUIRED", null), references: [] };
  }
  var references = domainReferenceCheck(record);
  var list = Array.isArray(references) ? references : [];
  if (list.length) {
    return { allowed: false, refusal: masterPolicyError("HISTORICAL_REFERENCE_EXISTS", null), references: list };
  }
  return { allowed: false, refusal: masterPolicyError("INACTIVE_INSTEAD_OF_DELETE", null), references: [] };
}

function masterEvaluateStructuralMutation(policyMap, field, context) {
  var map = policyMap || {};
  var cls = map[field];
  if (MASTER_WRITE_POLICY.STRUCTURAL_CLASSES.indexOf(cls) === -1) {
    return { allowed: false, errors: [masterPolicyError("UNKNOWN_POLICY", field || null)] };
  }
  var ctx = context || {};
  var hasReferences = ctx.hasHistoricalReferences === true;
  if (cls === "MUTABLE_DESCRIPTIVE" || cls === "MUTABLE_PROSPECTIVE") {
    return { allowed: true, errors: [] };
  }
  if (cls === "IMMUTABLE_AFTER_REFERENCE") {
    if (hasReferences) return { allowed: false, errors: [masterPolicyError("IMMUTABLE_AFTER_REFERENCE", field)] };
    return { allowed: true, errors: [] };
  }
  if (cls === "VERSION_REQUIRED_AFTER_REFERENCE") {
    if (hasReferences && masterFieldMissing(ctx.versionToken)) {
      return { allowed: false, errors: [masterPolicyError("VERSION_REQUIRED_AFTER_REFERENCE", field)] };
    }
    return { allowed: true, errors: [] };
  }
  if (ctx.operation === "DELETE") {
    return { allowed: false, errors: [masterPolicyError("INACTIVE_INSTEAD_OF_DELETE", field)] };
  }
  return { allowed: true, errors: [] };
}

function masterBuildAuditFields(actor, now, existingRecord) {
  var actorValue = actor == null ? "" : String(actor).trim();
  var stamp = now instanceof Date ? now : canonicalDate(now);
  var errors = [];
  if (!actorValue) errors.push(masterPolicyError("ACTOR_REQUIRED", "UpdatedBy"));
  if (!stamp) errors.push(masterPolicyError("INVALID_TIMESTAMP", "UpdatedAt"));
  if (errors.length) return { ok: false, errors: errors, fields: null };
  if (existingRecord) {
    return { ok: true, errors: [], fields: {
      CreatedAt: existingRecord.CreatedAt,
      CreatedBy: existingRecord.CreatedBy,
      UpdatedAt: stamp,
      UpdatedBy: actorValue
    } };
  }
  return { ok: true, errors: [], fields: {
    CreatedAt: stamp,
    CreatedBy: actorValue,
    UpdatedAt: stamp,
    UpdatedBy: actorValue
  } };
}

function masterEvaluateMutation(request, policy) {
  var req = request || {};
  var pol = policy || {};
  var errors = [];
  errors = errors.concat(masterValidateRequiredFields(req.record, pol.requiredFields));
  if (pol.identityField && req.existingRecord) {
    errors = errors.concat(masterValidateStableIdentity(
      req.existingRecord[pol.identityField],
      req.record ? req.record[pol.identityField] : null));
  }
  if (pol.structuralPolicyMap && req.field) {
    var structural = masterEvaluateStructuralMutation(pol.structuralPolicyMap, req.field, req.context);
    if (!structural.allowed) errors = errors.concat(structural.errors);
  }
  if (req.lifecycle !== undefined) {
    var lifecycle = masterLifecycleValue(req.lifecycle);
    if (!lifecycle.ok) errors = errors.concat(lifecycle.errors);
  }
  if (pol.requireAudit !== false) {
    var audit = masterBuildAuditFields(req.actor, req.now, req.existingRecord);
    if (!audit.ok) errors = errors.concat(audit.errors);
  }
  if (errors.length) return { ok: false, errors: errors, writeCount: 0 };
  return { ok: true, errors: [], writeCount: 0 };
}
