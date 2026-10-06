#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const probePath = path.join(__dirname, "transaction-entry-v697-probe.js");
const source = fs.readFileSync(probePath, "utf8");
let passed = 0;
function check(name, condition) {
  assert.ok(condition, name);
  passed += 1;
}

check("probe completion does not gate application observation", source.includes("const applicationTerminalPromise = observeApplicationAuthority") && !source.includes('if (probeRpc.rpcOutcome === "SUCCESS_TRUE")'));
check("application READY can resolve before probe join", source.includes('terminalState: "READY"') && source.includes("Promise.all([\n      probeRpcPromise,\n      applicationTerminalPromise"));
check("explicit unavailable is terminal and not READY", source.includes('authorityStatus === "UNAVAILABLE"') && source.includes('terminalState: "UNAVAILABLE"') && source.includes("authorityPresent: false"));
check("application observation has bounded timeout", source.includes('terminalState: "TIMEOUT"') && source.includes("const deadline = Date.now() + timeoutMs"));
check("probe success never implies application applied", !/rpcOutcome === "SUCCESS_TRUE"[\s\S]{0,300}authorityPresent/.test(source));
check("probe null or failure never implies application failure", !/PROBE_RPC_FAILURE|PROBE_RPC_TIMEOUT/.test(source));
check("A-L evaluation follows joined application terminal", source.indexOf("const dom = await snapshotDom(app)") > source.indexOf("applicationTerminalPromise"));
check("RPC instrumentation remains intact", source.includes("withSuccessHandler((response) => finish") && source.includes('withFailureHandler((error) => finish("FAILURE_HANDLER"'));
check("application contract remains read-only", !source.includes("submitOperationalOrder") && !source.includes("confirmOperationalPayment") && source.includes("no mutation endpoint invocation"));
check("no production mutation capability introduced", !/\.clasp|clasp push|createDeployment|updateDeployment|deleteDeployment/.test(source));
check("application result stores independent terminal fields", ["terminalState", "authorityPresent", "authorityReason", "readyMs", "terminalMs"].every((field) => source.includes(field)));
check("application READY requires status and applied authority", source.includes('last.authorityStatus === "READY" && last.authorityPresent'));

console.log(JSON.stringify({ passed, failed: 0 }));
