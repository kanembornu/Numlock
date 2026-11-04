# Finance Phase 11N.8 evidence bundle

Canonical payloads are UTF-8, LF-terminated, and serialized in the fixed field order defined by `build-manifests.js`. Each SHA256 sidecar and `manifest-index.csv` hashes only its corresponding canonical `.manifest` bytes.

The 21 canonical manifests are stored as separate non-Google `text/plain` Drive artifacts in the folder recorded by `drive-evidence-map.json`. Each artifact was raw-downloaded after upload and matched byte-for-byte against its local canonical manifest. `manifest-index.csv` and the candidate exports contain the resulting real `GDRIVE:<FILE_ID>:V01:SHA256:<hash>` references.

Every candidate remains inactive. `SINGLE_OPERATOR_APPROVED` records that the frozen evidence and governance validator passes; it does not activate conversion authority. The readiness classifier therefore continues to return `NEEDS_EVIDENCE` until a separately authorized production-population and activation phase.
