# Evidence retention and use

This directory preserves phase-specific specifications, signed/attested conversion manifests, SHA256 sidecars and Drive mappings, local verifiers, snapshots, screenshots, and validation results. Evidence is retained because later audits and tests depend on it. It is not disposable build output and is not Apps Script upload source.

Historical README statuses describe their phase and observation time. They are not a live production status: later activation may supersede a phase's disabled-state statement without rewriting its frozen record. Local mocks, browser fixtures, authenticated runtime, uploads and production results are separate evidence classes.

## Storage policy

All existing 125 evidence files were inventoried and backed up before the 2026-09-10 maintenance. Existing bytes remain unchanged. Never regenerate a manifest or rewrite a historical log just to make the tree clean.

The following private source snapshots stay at their current local paths for verifiers and are explicitly excluded from Git:

- `finance-phase-11u2e/POST-11U.snapshot.json`
- `finance-phase-11v8/expense-items.snapshot.json`

Their absence on a new checkout is MISSING_LOCAL_EVIDENCE, not an empty dataset. Obtain authorized copies and verify against the retained evidence metadata before running dependent scripts; do not fetch or reconstruct production data automatically. Other phase artifacts are reviewed separately before staging. The private audit backup and file-by-file hash inventory are outside this repository in the maintenance task workspace.

## Drive evidence

The Lemon `MANIFEST-MOS-ING-018-V01.manifest` pins the prospective management standard 1000 gr = 24 slice from 2026-10-01. It is not measured physical yield, historical reconstruction, stock on hand or a production activation flag.

The Drive folder `NUMLOCK Finance Phase 11N.9 Immutable Attestation Evidence` holds 21 separate text manifests for package conversions. `finance-phase-11n8/drive-evidence-map.json` binds each local manifest to its Drive file ID, version and SHA256. Population/validation code consumes those identities. Do not delete or edit the Drive artifacts as repository cleanup.

Immutable here means frozen, version/hash-bound content checked by validators. Drive is not proven WORM storage, and an electronic single-operator attestation is not an independent review or cryptographic personal signature. Keep historical Codex authorship statements intact.
