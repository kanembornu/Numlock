import { test, expect } from "playwright/test";
const http = require("node:http");
const { assembleHtml } = require("../harness/assemble-html.js");

// Regression spec for the Product Profitability filter dropdown / state defect:
// rebuilding the category and type options from a refreshed payload could leave
// the visible DOM selection ("value"", selectedIndex -1) diverged from
// productProfitabilityPageState.filter, so rows and KPIs were computed from a
// filter the user could not see.
//
// Responses are released through a deferred RPC shim, never by sleeping.

const PORT = 34581;
const TARGET_URL = `http://localhost:${PORT}/`;
const TIMEOUT = 60000;

let server;

test.beforeAll(async () => {
  const html = assembleHtml();
  server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(PORT, resolve));
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.log("[PAGE ERROR]", error.message));
  await page.setViewportSize({ width: 1536, height: 960 });
  await page.goto(TARGET_URL, { waitUntil: "load", timeout: TIMEOUT });
  await page.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
  await page.waitForTimeout(400);
  await installDeferredRpc(page);
});

// ---------------------------------------------------------------- RPC control

async function installDeferredRpc(page) {
  await page.evaluate(() => {
    const originalRun = window.google.script.run;
    window.__ppPending = [];
    window.google.script.run = {
      withSuccessHandler(handler) {
        return {
          withFailureHandler(failureHandler) {
            return new Proxy(
              {},
              {
                get(target, prop) {
                  return function (...args) {
                    if (prop === "getProductProfitabilityData") {
                      window.__ppPending.push({ success: handler, failure: failureHandler, args });
                      return;
                    }
                    return originalRun.withSuccessHandler(handler).withFailureHandler(failureHandler)[prop](...args);
                  };
                }
              }
            );
          }
        };
      }
    };
  });
}

const pendingCount = (page) => page.evaluate(() => window.__ppPending.length);

const resolveAll = (page, payload) =>
  page.evaluate((body) => {
    const count = window.__ppPending.length;
    while (window.__ppPending.length) window.__ppPending.shift().success(body);
    return count;
  }, payload);

const resolveNewest = (page, payload) =>
  page.evaluate((body) => {
    const index = window.__ppPending.length - 1;
    if (index < 0) return false;
    window.__ppPending.splice(index, 1)[0].success(body);
    return true;
  }, payload);

const resolveOldest = (page, payload) =>
  page.evaluate((body) => {
    if (!window.__ppPending.length) return false;
    window.__ppPending.shift().success(body);
    return true;
  }, payload);

// ------------------------------------------------------------------- fixtures

function makeProducts(specs) {
  return specs.map((spec, index) => ({
    productId: "P-" + String(index + 1).padStart(3, "0"),
    productName: spec.name,
    category: spec.category,
    type: spec.type,
    units: spec.units,
    revenue: spec.revenue,
    cogs: Math.round(spec.revenue * 0.4),
    grossProfit: Math.round(spec.revenue * 0.6),
    grossMargin: 60,
    revenueMix: 0.1,
    grossProfitRank: index + 1,
    revenueRank: index + 1
  }));
}

function buildPayload(products) {
  return {
    status: "SUCCESS",
    products,
    summary: {},
    period: { label: "Current Year" },
    comparisonPeriod: null,
    quality: { status: "GOOD", issueCount: 0 }
  };
}

// Coffee (3 products, Rp 3.900.000) + Non-Coffee (2 products, Rp 800.000).
const datasetA = () =>
  buildPayload(
    makeProducts([
      { name: "Espresso", category: "Coffee", type: "Hot", units: 85, revenue: 2000000 },
      { name: "Cappuccino", category: "Coffee", type: "Hot", units: 72, revenue: 1000000 },
      { name: "Latte", category: "Coffee", type: "Cold", units: 60, revenue: 900000 },
      { name: "Ginger Tea", category: "Non-Coffee", type: "Hot", units: 40, revenue: 500000 },
      { name: "Cocoa", category: "Non-Coffee", type: "Cold", units: 30, revenue: 300000 }
    ])
  );

// Same products, "Coffee" no longer offered.
const datasetWithoutCoffee = () =>
  buildPayload(
    makeProducts([
      { name: "Espresso", category: "Tea", type: "Hot", units: 85, revenue: 2000000 },
      { name: "Cappuccino", category: "Tea", type: "Hot", units: 72, revenue: 1000000 },
      { name: "Latte", category: "Tea", type: "Cold", units: 60, revenue: 900000 },
      { name: "Ginger Tea", category: "Non-Coffee", type: "Hot", units: 40, revenue: 500000 },
      { name: "Cocoa", category: "Non-Coffee", type: "Cold", units: 30, revenue: 300000 }
    ])
  );

// Same products, "Hot" no longer offered.
const datasetWithoutHot = () =>
  buildPayload(
    makeProducts([
      { name: "Espresso", category: "Coffee", type: "Cold", units: 85, revenue: 2000000 },
      { name: "Cappuccino", category: "Coffee", type: "Cold", units: 72, revenue: 1000000 },
      { name: "Latte", category: "Coffee", type: "Cold", units: 60, revenue: 900000 },
      { name: "Ginger Tea", category: "Non-Coffee", type: "Cold", units: 40, revenue: 500000 },
      { name: "Cocoa", category: "Non-Coffee", type: "Cold", units: 30, revenue: 300000 }
    ])
  );

// Neither "Coffee" nor "Hot" offered any more.
const datasetWithoutCoffeeOrHot = () =>
  buildPayload(
    makeProducts([
      { name: "Espresso", category: "Tea", type: "Cold", units: 85, revenue: 2000000 },
      { name: "Cappuccino", category: "Tea", type: "Cold", units: 72, revenue: 1000000 },
      { name: "Latte", category: "Tea", type: "Cold", units: 60, revenue: 900000 },
      { name: "Ginger Tea", category: "Tea", type: "Cold", units: 40, revenue: 500000 },
      { name: "Cocoa", category: "Tea", type: "Cold", units: 30, revenue: 300000 }
    ])
  );

function largeDataset(count, revenueFactor) {
  const specs = [];
  for (let i = 1; i <= count; i++) {
    specs.push({
      name: "Item " + i,
      category: "Coffee",
      type: i % 2 === 0 ? "Cold" : "Hot",
      units: i,
      revenue: i * (revenueFactor || 1000)
    });
  }
  return buildPayload(makeProducts(specs));
}

// -------------------------------------------------------------------- helpers

async function openProfitability(page) {
  await page.evaluate(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
  });
  await page.locator("[data-page='products'][data-navigation-destination='products']").click();
  await page.locator("#productsTabProfitability").click();
  await page.locator("#productsPanelProfitability").waitFor({ state: "visible", timeout: 15000 });
}

async function loadInitial(page, payload) {
  await openProfitability(page);
  await page.waitForFunction(() => window.__ppPending.length > 0, null, { timeout: 15000 });
  expect(await resolveAll(page, payload)).toBe(1);
  await page.waitForSelector("#productsPpTableBody tr", { state: "visible", timeout: 15000 });
}

// Activating the active Product Profitability tab re-runs the async refresh path.
async function refresh(page, payload) {
  await page.locator("#productsTabProfitability").click();
  await page.waitForFunction(() => window.__ppPending.length > 0, null, { timeout: 15000 });
  expect(await resolveAll(page, payload)).toBe(1);
}

const ppState = (page) =>
  page.evaluate(() => {
    const categorySelect = document.getElementById("productsPpCategoryFilter");
    const typeSelect = document.getElementById("productsPpTypeFilter");
    const searchInput = document.getElementById("productsPpSearchInput");
    const filter = productProfitabilityPageState.filter || {};
    return {
      domCategory: categorySelect.value,
      domCategoryIndex: categorySelect.selectedIndex,
      domCategoryOptions: Array.from(categorySelect.options).map((o) => o.value),
      domType: typeSelect.value,
      domTypeIndex: typeSelect.selectedIndex,
      domTypeOptions: Array.from(typeSelect.options).map((o) => o.value),
      domSearch: searchInput.value,
      internalCategory: filter.category === undefined ? "" : filter.category,
      internalType: filter.type === undefined ? "" : filter.type,
      internalSearch: filter.search === undefined ? "" : filter.search,
      page: productProfitabilityPageState.page,
      rows: document.querySelectorAll("#productsPpTableBody tr").length,
      rowNames: Array.from(document.querySelectorAll("#productsPpTableBody tr td:nth-child(2)")).map((td) =>
        td.innerText.trim()
      ),
      emptyMessage: (document.querySelector("#productsPpTableBody tr td[colspan]") || {}).innerText || null,
      kpiRevenue: document.getElementById("productsPpKpiRevenueValue").innerText.trim(),
      kpiUnits: document.getElementById("productsPpKpiUnitsValue").innerText.trim(),
      kpiProducts: document.getElementById("productsPpKpiProductsValue").innerText.trim(),
      pageInfo: document.getElementById("productsPpPageInfo").innerText.trim(),
      indicator: document.getElementById("productsPpPageIndicator").innerText.trim(),
      firstDisabled: document.getElementById("productsPpFirstPage").disabled,
      prevDisabled: document.getElementById("productsPpPrevPage").disabled,
      nextDisabled: document.getElementById("productsPpNextPage").disabled,
      lastDisabled: document.getElementById("productsPpLastPage").disabled
    };
  });

async function axName(page, selector) {
  const client = await page.context().newCDPSession(page);
  try {
    const { root } = await client.send("DOM.getDocument", { depth: 1 });
    const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) return null;
    const { node } = await client.send("DOM.describeNode", { nodeId });
    const { nodes } = await client.send("Accessibility.getPartialAXTree", {
      backendNodeId: node.backendNodeId,
      fetchRelatives: false
    });
    const target = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId) || nodes[0];
    return target && target.name ? target.name.value : "";
  } finally {
    await client.detach();
  }
}

// ----------------------------------------------------------------- test suite

test.describe("Product Profitability filter dropdown / state synchronization", () => {
  test("F01 a still available category survives the refresh", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await expect.poll(async () => (await ppState(page)).rows).toBe(3);

    await refresh(page, datasetA());

    const state = await ppState(page);
    expect(state.domCategory).toBe("Coffee");
    expect(state.domCategoryIndex).toBe(1);
    expect(state.internalCategory).toBe("Coffee");
    expect(state.rows).toBe(3);
    expect(state.rowNames).toEqual(["Espresso", "Cappuccino", "Latte"]);
    expect(state.kpiRevenue).toBe("Rp 3.900.000");
    expect(state.kpiProducts).toBe("3");
    expect(state.pageInfo).toBe("1–3 of 3");
  });

  test("F02 a still available type survives the refresh", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpTypeFilter", "Hot");
    await expect.poll(async () => (await ppState(page)).rows).toBe(3);

    await refresh(page, datasetA());

    const state = await ppState(page);
    expect(state.domType).toBe("Hot");
    expect(state.domTypeIndex).toBeGreaterThan(0);
    expect(state.domTypeOptions[state.domTypeIndex]).toBe("Hot");
    expect(state.internalType).toBe("Hot");
    expect(state.rows).toBe(3);
    expect(state.kpiRevenue).toBe("Rp 3.500.000");
  });

  test("F03 a removed category resets DOM and internal state together", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await expect.poll(async () => (await ppState(page)).rows).toBe(3);

    await refresh(page, datasetWithoutCoffee());

    const state = await ppState(page);
    expect(state.domCategory).toBe("");
    expect(state.domCategoryIndex).toBe(0);
    expect(state.internalCategory).toBe("");
    expect(state.domCategoryOptions).toEqual(["", "Non-Coffee", "Tea"]);
    expect(state.rows).toBe(5);
    expect(state.kpiRevenue).toBe("Rp 4.700.000");
    expect(state.kpiProducts).toBe("5");
    expect(state.pageInfo).toBe("1–5 of 5");
  });

  test("F04 a removed type resets DOM and internal state and keeps the category", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpTypeFilter", "Hot");
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await expect.poll(async () => (await ppState(page)).rows).toBe(2);

    await refresh(page, datasetWithoutHot());

    const state = await ppState(page);
    expect(state.domType).toBe("");
    expect(state.domTypeIndex).toBe(0);
    expect(state.internalType).toBe("");
    expect(state.domCategory).toBe("Coffee");
    expect(state.internalCategory).toBe("Coffee");
    expect(state.rows).toBe(3);
    expect(state.kpiRevenue).toBe("Rp 3.900.000");
  });

  test("F05 both removed selections reset while the search is preserved", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await page.selectOption("#productsPpTypeFilter", "Hot");
    await page.fill("#productsPpSearchInput", "espresso");
    await expect.poll(async () => (await ppState(page)).rows).toBe(1);

    await refresh(page, datasetWithoutCoffeeOrHot());

    const state = await ppState(page);
    expect(state.domCategory).toBe("");
    expect(state.internalCategory).toBe("");
    expect(state.domType).toBe("");
    expect(state.internalType).toBe("");
    expect(state.domSearch).toBe("espresso");
    expect(state.internalSearch).toBe("espresso");
    expect(state.rows).toBe(1);
    expect(state.rowNames).toEqual(["Espresso"]);
    expect(state.kpiRevenue).toBe("Rp 2.000.000");
  });

  test("F06 the search survives a dropdown rebuild", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.fill("#productsPpSearchInput", "latte");
    await expect.poll(async () => (await ppState(page)).rows).toBe(1);

    await refresh(page, datasetA());

    const state = await ppState(page);
    expect(state.domSearch).toBe("latte");
    expect(state.internalSearch).toBe("latte");
    expect(state.rows).toBe(1);
    expect(state.rowNames).toEqual(["Latte"]);
    expect(state.kpiRevenue).toBe("Rp 900.000");
  });

  test("F07 the active page survives a refresh with valid filters", async ({ page }) => {
    await loadInitial(page, largeDataset(60));
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await page.evaluate(() => setProductsTabProfitabilityPage(2));
    await expect.poll(async () => (await ppState(page)).indicator).toBe("Page 2 of 3");

    await refresh(page, largeDataset(60));

    const state = await ppState(page);
    expect(state.page).toBe(2);
    expect(state.indicator).toBe("Page 2 of 3");
    expect(state.rows).toBe(25);
    expect(state.domCategory).toBe("Coffee");
    expect(state.internalCategory).toBe("Coffee");
  });

  test("F08 the page clamps to the last valid page when the result set shrinks", async ({ page }) => {
    await loadInitial(page, largeDataset(60));
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await page.evaluate(() => setProductsTabProfitabilityPage(3));
    await expect.poll(async () => (await ppState(page)).indicator).toBe("Page 3 of 3");

    await refresh(page, largeDataset(30));

    const state = await ppState(page);
    expect(state.page).toBe(2);
    expect(state.indicator).toBe("Page 2 of 2");
    expect(state.rows).toBe(5);
    expect(state.pageInfo).toBe("26–30 of 30");
  });

  test("F09 a stale response cannot overwrite the newer state", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await expect.poll(async () => (await ppState(page)).rows).toBe(3);

    // Two overlapping refreshes; the newer response is released first.
    await page.locator("#productsTabProfitability").click();
    await page.waitForFunction(() => window.__ppPending.length > 0, null, { timeout: 15000 });
    await page.locator("#productsTabProfitability").click();
    await page.waitForFunction(() => window.__ppPending.length > 1, null, { timeout: 15000 });
    expect(await pendingCount(page)).toBe(2);

    expect(await resolveNewest(page, datasetWithoutCoffee())).toBe(true);
    const newest = await ppState(page);
    expect(newest.domCategory).toBe("");
    expect(newest.internalCategory).toBe("");
    expect(newest.rows).toBe(5);
    expect(newest.kpiRevenue).toBe("Rp 4.700.000");

    // The older response must be ignored entirely.
    expect(await resolveOldest(page, datasetA())).toBe(true);
    const after = await ppState(page);
    expect(after.domCategory).toBe("");
    expect(after.domCategoryOptions).toEqual(["", "Non-Coffee", "Tea"]);
    expect(after.internalCategory).toBe("");
    expect(after.rows).toBe(5);
    expect(after.kpiRevenue).toBe("Rp 4.700.000");
    expect(after.pageInfo).toBe("1–5 of 5");
  });

  test("F10 a user interaction during an in-flight request wins", async ({ page }) => {
    await loadInitial(page, datasetA());

    await page.locator("#productsTabProfitability").click();
    await page.waitForFunction(() => window.__ppPending.length > 0, null, { timeout: 15000 });

    // The user picks a category while the request is in flight.
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await expect.poll(async () => (await ppState(page)).rows).toBe(3);

    expect(await resolveAll(page, datasetA())).toBe(1);

    const state = await ppState(page);
    expect(state.domCategory).toBe("Coffee");
    expect(state.internalCategory).toBe("Coffee");
    expect(state.rows).toBe(3);
    expect(state.kpiRevenue).toBe("Rp 3.900.000");
  });

  test("F11 an empty dataset renders the empty state with zero KPIs", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await expect.poll(async () => (await ppState(page)).rows).toBe(3);

    await refresh(page, buildPayload([]));

    const state = await ppState(page);
    expect(state.domCategory).toBe("");
    expect(state.domCategoryIndex).toBe(0);
    expect(state.internalCategory).toBe("");
    expect(state.rows).toBe(1);
    expect(state.emptyMessage).toBe("No products match the current filter.");
    expect(state.pageInfo).toBe("0–0 of 0");
    expect(state.indicator).toBe("Page 1 of 1");
    expect(state.firstDisabled).toBe(true);
    expect(state.prevDisabled).toBe(true);
    expect(state.nextDisabled).toBe(true);
    expect(state.lastDisabled).toBe(true);
    expect(state.kpiRevenue).toBe("Rp 0");
    expect(state.kpiUnits).toBe("0");
    expect(state.kpiProducts).toBe("0");
  });

  test("F12 a later unrelated interaction does not jump the rows or the KPIs", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await expect.poll(async () => (await ppState(page)).rows).toBe(3);

    await refresh(page, datasetWithoutCoffee());

    const normalized = await ppState(page);
    expect(normalized.domCategory).toBe("");
    expect(normalized.internalCategory).toBe("");
    expect(normalized.rows).toBe(5);
    expect(normalized.kpiRevenue).toBe("Rp 4.700.000");

    // Unrelated interaction: only the type filter changes.
    await page.selectOption("#productsPpTypeFilter", "Cold");

    const state = await ppState(page);
    expect(state.domCategory).toBe("");
    expect(state.internalCategory).toBe("");
    expect(state.domType).toBe("Cold");
    expect(state.internalType).toBe("Cold");
    expect(state.rows).toBe(2);
    expect(state.rowNames).toEqual(["Latte", "Cocoa"]);
    expect(state.kpiRevenue).toBe("Rp 1.200.000");
    expect(state.pageInfo).toBe("1–2 of 2");
  });

  test("F13 repeated refresh cycles keep the dropdown and the filter in sync", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await expect.poll(async () => (await ppState(page)).rows).toBe(3);

    await refresh(page, datasetA());
    await refresh(page, datasetWithoutCoffee());
    await refresh(page, datasetA());

    const state = await ppState(page);
    expect(state.domCategory).toBe("");
    expect(state.domCategoryIndex).toBe(0);
    expect(state.internalCategory).toBe("");
    expect(state.domCategoryOptions).toEqual(["", "Coffee", "Non-Coffee"]);
    expect(state.domTypeOptions).toEqual(["", "Cold", "Hot"]);
    expect(state.rows).toBe(5);
    expect(state.kpiRevenue).toBe("Rp 4.700.000");
    expect(state.domSearch).toBe("");
    expect(state.internalSearch).toBe("");
  });

  test("F14 the runtime bound implementation performs the synchronization", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await expect.poll(async () => (await ppState(page)).rows).toBe(3);

    // Spy on the global binding to prove which implementation the refresh path runs.
    await page.evaluate(() => {
      window.__spy = { calls: 0, stacks: [], originalSource: String(window.populateProductsTabProfitabilityCategoryFilter) };
      const original = window.populateProductsTabProfitabilityCategoryFilter;
      window.populateProductsTabProfitabilityCategoryFilter = function (products) {
        window.__spy.calls++;
        window.__spy.stacks.push(String(new Error("spy").stack || "").split("\n").slice(0, 4).join(" <- "));
        return original.apply(this, arguments);
      };
    });

    await refresh(page, datasetWithoutCoffee());

    const spy = await page.evaluate(() => ({
      calls: window.__spy.calls,
      stacks: window.__spy.stacks,
      runtimeSource: window.__spy.originalSource
    }));
    expect(spy.calls).toBe(1);
    expect(spy.stacks[0]).toContain("renderProductsTabProfitability");
    expect(spy.runtimeSource).toContain("indexOf(currentValue) === -1");
    expect(spy.runtimeSource).toContain("productProfitabilityPageState.filter.category");

    const state = await ppState(page);
    expect(state.domCategory).toBe("");
    expect(state.internalCategory).toBe("");
    expect(state.rows).toBe(5);
  });

  test("F15 the P1.1 pagination contract still holds with an active filter", async ({ page }) => {
    await loadInitial(page, largeDataset(60));
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await page.evaluate(() => setProductsTabProfitabilityPage(2));
    await expect.poll(async () => (await ppState(page)).indicator).toBe("Page 2 of 3");

    await refresh(page, largeDataset(60));

    const state = await ppState(page);
    expect(state.page).toBe(2);
    expect(state.indicator).toBe("Page 2 of 3");
    expect(state.rows).toBe(25);
    expect(state.internalCategory).toBe("Coffee");
    expect(state.domCategory).toBe("Coffee");
  });

  test("F16 the P2 accessible table names are preserved", async ({ page }) => {
    await page.evaluate(() => {
      if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
    });
    await page.locator("[data-page='finance'][data-navigation-destination='profit-loss']").click();
    await page.locator("#financeContent table.finance-expense-table").waitFor({ state: "visible", timeout: 15000 });
    expect(await axName(page, "#financeContent table.finance-expense-table")).toBe("Profit and Loss");

    await page.evaluate(() => {
      setFinanceDestination("product-profitability");
      ensureFinanceData();
    });
    await page.locator("#financeProductProfitabilityTable").waitFor({ state: "visible", timeout: 15000 });
    expect(await axName(page, "#financeProductProfitabilityTable")).toBe("Profit and Loss by Product");

    await openProfitability(page);
    expect(await axName(page, "#productsPpProductProfitabilityTable")).toBe("Product Profitability");
  });

  test("F17 responsive widths keep the dropdown and the filter in sync", async ({ page }) => {
    for (const width of [390, 768, 1536]) {
      await page.setViewportSize({ width, height: 900 });
      await loadInitial(page, datasetA());
      await page.selectOption("#productsPpCategoryFilter", "Coffee");
      await expect.poll(async () => (await ppState(page)).rows).toBe(3);

      await refresh(page, datasetWithoutCoffee());

      const state = await ppState(page);
      expect(state.domCategory).toBe("");
      expect(state.internalCategory).toBe("");
      expect(state.rows).toBe(5);

      const layout = await page.evaluate(() => ({
        controls: document.querySelectorAll("#productsPpCategoryFilter").length,
        contained: !!document.querySelector("#productsPanelProfitability #productsPpProductProfitabilityTable"),
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      }));
      expect(layout.controls).toBe(1);
      expect(layout.contained).toBe(true);
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth + 1);
    }
  });

  test("F18 the Transactions pagination and page size stay untouched", async ({ page }) => {
    await loadInitial(page, datasetA());
    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    await expect.poll(async () => (await ppState(page)).rows).toBe(3);

    const before = await page.evaluate(() => ({
      pageSize: typeof transactionsPageSize === "undefined" ? null : transactionsPageSize,
      pages: typeof transactionsPages === "undefined" ? null : JSON.stringify(transactionsPages),
      stored: window.localStorage.getItem("numlock.transactions.pageSize"),
      ppStored: window.localStorage.getItem("numlock.productProfitability.pageSize")
    }));

    await refresh(page, datasetWithoutCoffee());

    const after = await page.evaluate(() => ({
      pageSize: typeof transactionsPageSize === "undefined" ? null : transactionsPageSize,
      pages: typeof transactionsPages === "undefined" ? null : JSON.stringify(transactionsPages),
      stored: window.localStorage.getItem("numlock.transactions.pageSize"),
      ppStored: window.localStorage.getItem("numlock.productProfitability.pageSize")
    }));

    expect(after.pageSize).toBe(before.pageSize);
    expect(after.pages).toBe(before.pages);
    expect(after.stored).toBe(before.stored);
    expect(after.ppStored).toBe(before.ppStored);

    const state = await ppState(page);
    expect(state.internalCategory).toBe("");
    expect(state.rows).toBe(5);
  });
});
