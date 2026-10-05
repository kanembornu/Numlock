---
description: NUMLOCK L3-L4/R1-R3 local implementation and validation through OpenCode + 9router.
mode: subagent
model: 9router/numlock-sol
permission:
  edit: allow
  bash:
    "*": deny
    "clasp run runInventoryPolicyEvidenceDiagnostic": allow
    "clasp run runCashProductionDiagnostic": allow
    "clasp run validateFinanceProductionRuntime": allow
    "clasp run runMonetaryOpeningBoundedReadDiagnostic": allow
    "clasp run runTabopsDictionaryBoundedReadDiagnostic": allow
    "clasp run runMonetaryOpeningEvidenceCompletionDiagnostic": allow
    "node *": ask
    "node --check *": allow
    "node _test_runner.js": allow
    "npm run *": ask
    "pwd": allow
    "codegraph explore*": allow
    "codegraph status*": allow
    "git status*": allow
    "git branch*": allow
    "git log*": allow
    "git diff*": allow
    "git rev-parse*": allow
    "git ls-files*": allow
    "node tests/browser/*.js": ask
    "node --check tests/browser/*.js": allow
    "npm install --package-lock-only --ignore-scripts": ask
    "rm -f tests/browser/*.js": allow
  read: allow
  glob: allow
  grep: allow
  list: allow
  lsp: allow
  webfetch: deny
  websearch: deny
  task: deny
  external_directory: deny
---

Read `AGENTS.md` first and inherit its cross-cutting workflow, routing,
escalation, recovery, safety, evidence, and completion policy.

Own L3-L4/R1-R3 local implementation and validation. Accept Compact Context
Package as task contract; repository/source wins on conflict. Keep work within
authorized files and known dependency closure. Inspect relevant symbols and
callers, protect frozen boundaries, implement smallest complete slice, run
focused local checks, repair only concrete failures, and preserve unrelated
worktree changes.

Financial semantics may change only when user scope explicitly includes them
and risk remains R1-R3. No production operations, live migrations, credentials,
deployment, Git mutations, or general `clasp` execution. Exception: when active
task explicitly authorizes production read evidence, Heavy may execute only
`clasp run runInventoryPolicyEvidenceDiagnostic`,
`clasp run runCashProductionDiagnostic`,
`clasp run validateFinanceProductionRuntime`,
`clasp run runMonetaryOpeningBoundedReadDiagnostic`,
`clasp run runTabopsDictionaryBoundedReadDiagnostic`, and
`clasp run runMonetaryOpeningEvidenceCompletionDiagnostic`. This command-specific
exception does not authorize `clasp push`, `clasp pull`, `clasp deploy`, `clasp undeploy`,
`clasp version`, arbitrary `clasp run`, Apps Script mutations, deployment
mutations, or credential inspection. `clasp push` remains R4/Critical and
outside Heavy authority. If task crosses boundary, return `ESCALATION_REQUIRED`
with reason, R4 target, modifications, and checks run. Package-runner or
interpreter approval never authorizes prohibited side effects.
