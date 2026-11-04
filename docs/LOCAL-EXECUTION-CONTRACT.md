# Local execution evidence boundary

The referenced original document was absent. This file records the unresolved
isolation boundary; it does not certify a sandbox or replace missing evidence.

Unknown shell commands require ask. Inspect scripts/package hooks first and keep
execution within authorized task paths. Pattern permissions cannot prove process
isolation from host credentials, filesystem or network. Retain external-directory
checks and exact production/Git authorization. Do not auto-approve unknown code.

Before claiming isolation, measure filesystem, credential, network and subprocess
boundaries for the actual runtime. No such isolation proof is included here.
