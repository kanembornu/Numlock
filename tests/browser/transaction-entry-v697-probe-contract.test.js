#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const probePath = path.join(__dirname, "transaction-entry-v697-probe.js");
const source = fs.readFileSync(probePath, "utf8");
const root = path.join(__dirname, "..", "..");
const actions = fs.readFileSync(path.join(root, "195.View.Transactions.Actions.html"), "utf8");
const index = fs.readFileSync(path.join(root, "190.View.Index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "95.Transaction.Operational.js"), "utf8");
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

check("present operational target remains populated", actions.includes("select.innerHTML") && actions.includes("select.appendChild(option)"));
check("retired operational product targets are optional", actions.includes('["operationalProduct", "operationalProductVariant"].indexOf(id) !== -1') && actions.includes("if (!select"));
check("required operational targets fail visibly", actions.includes('throw new Error("Required operational select missing: #" + id)'));
check("authority payload remains validated", actions.includes("validOperationalAuthorityResponse(response)") && actions.includes("operationalTransactionState.authority = response.data"));
check("ProductVariant behavior remains selected by authority", actions.includes("authority.productVariants") && actions.includes("row.ProductVariantID === variantID"));
check("payment methods remain authority-populated", actions.includes('response.data.paymentMethods, "code", "label"'));
check("purchase and supplier population remains", actions.includes('populateOperationalSelect("operationalSupplier"') && actions.includes('populateOperationalSelect("operationalPurchaseItem"'));
check("no broad exception swallowing around population", !/populateOperationalSelect[\s\S]{0,500}\btry\s*\{/.test(actions));
check("page error instrumentation remains", source.includes('page.on("pageerror"'));
check("current Sales DOM authority success tolerates retired targets", !index.includes('id="operationalProduct"') && !index.includes('id="operationalProductVariant"') && actions.includes('populateOperationalSelect("operationalProduct"'));

check("F names SELLING_PRICE_AUTHORITY", source.includes('F: "SELLING_PRICE_AUTHORITY"'));
check("F requires active visible price representation", source.includes('document.getElementById("salesPreviewPrice")') && source.includes('fViolations.push("#salesPreviewPrice missing")'));
check("F rejects arbitrary editable price", source.includes('input[name="unitPrice"]') && source.includes("price operator-editable="));
check("F requires variant-derived authority", source.includes('fViolations.push("selected variant/type did not establish authoritative price")'));
check("F checks variant price differences", source.includes('fViolations.push("variant price difference not reflected")'));
check("F rejects client payload price authority", source.includes('fViolations.push("client submission payload contains price authority")'));
check("F requires server-final authority", source.includes('fViolations.push("pricing source is not server authority")'));
check("F does not require retired control", source.includes('retiredControlAbsent: !document.getElementById("operationalSellingPrice")'));
check("current display is non-editable dd", /<dd id="salesPreviewPrice">/.test(index));
check("canonical submission excludes arbitrary price", /transactionType: "SALES", productId: state\.selectedProduct\.productId, type: state\.selectedType, qty: state\.qty/.test(actions));
check("server resolves effective ProductPricing", server.includes("function resolveOperationalProduct_") && server.includes("SELLING_PRICE_NOT_AVAILABLE") && server.includes("sellingPriceSnapshot: price"));

console.log(JSON.stringify({ passed, failed: 0 }));
