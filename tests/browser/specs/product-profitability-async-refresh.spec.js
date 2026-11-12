import { test, expect } from "playwright/test";
const http = require("node:http");
const { assembleHtml } = require("../harness/assemble-html.js");

// Regression spec for the Product Profitability async refresh defect:
// an in-flight refresh used to force page 1 and let late responses overwrite
// newer user state. The RPC is intercepted after load so responses are
// released deterministically (no sleeps, no timing races).

const PORT = 34573;
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
  await page.waitForTimeout(800);
  await installDeferredRpc(page);
});

// Wraps google.script.run so getProductProfitabilityData can be queued and
// released by the test instead of resolving on a timer.
async function installDeferredRpc(page) {
  await page.evaluate(() => {
    const originalRun = window.google.script.run;
    window.__ppPending = [];
    window.__ppDefer = true;
    window.google.script.run = {
      withSuccessHandler(handler) {
        return {
          withFailureHandler(failureHandler) {
            return new Proxy(
              {},
              {
                get(target, prop) {
                  return function(...args) {
                    if (prop === "getProductProfitabilityData" && window.__ppDefer) {
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

const resolveNewest = (page, payload) =>
  page.evaluate((body) => {
    const index = window.__ppPending.length - 1;
    if (index < 0) return false;
    const item = window.__ppPending.splice(index, 1)[0];
    item.success(body);
    return true;
  }, payload);

const resolveOldest = (page, payload) =>
  page.evaluate((body) => {
    if (!window.__ppPending.length) return false;
    const item = window.__ppPending.splice(0, 1)[0];
    item.success(body);
    return true;
  }, payload);

const resolveAll = (page, payload) =>
  page.evaluate((body) => {
    const count = window.__ppPending.length;
    while (window.__ppPending.length) {
      window.__ppPending.shift().success(body);
    }
    return count;
  }, payload);

function buildPayload(count, tag) {
  const products = [];
  const half = Math.ceil(count / 2);
  for (let i = 1; i <= count; i++) {
    const group = i <= half ? "SeedA" : "SeedB";
    products.push({
      productId: `${tag}-${String(i).padStart(3, "0")}`,
      productName: `${tag}-${group}-${String(i).padStart(2, "0")}`,
      category: group,
      type: i % 2 === 0 ? "Cold" : "Hot",
      units: i,
      revenue: i * 1000,
      cogs: i * 400,
      grossProfit: i * 600,
      grossMargin: 60,
      revenueMix: 1 / count,
      grossProfitRank: i,
      revenueRank: i
    });
  }
  return {
    status: "SUCCESS",
    products,
    summary: {},
    period: { label: "Current Year" },
    comparisonPeriod: null,
    quality: { status: "GOOD", issueCount: 0 }
  };
}

async function gotoDestination(page, destination) {
  await page.evaluate(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
  });
  await page.locator(`[data-page='${destination}'][data-navigation-destination='${destination}']`).click();
}

async function openProfitability(page) {
  await gotoDestination(page, "products");
  await page.locator("#productsTabProfitability").click();
  await page.locator("#productsPanelProfitability").waitFor({ state: "visible", timeout: 15000 });
}

// Activating the already active Product Profitability tab re-runs the refresh path.
async function refreshProfitability(page) {
  await page.locator("#productsTabProfitability").click();
}

async function loadInitial(page, payload) {
  await openProfitability(page);
  expect(await resolveAll(page, payload)).toBe(1);
  await page.waitForSelector("#productsPpTableBody tr", { state: "visible", timeout: 15000 });
}

const ppState = (page) =>
  page.evaluate(() => ({
    page: productProfitabilityPageState.page,
    pageSize: productProfitabilityPageState.pageSize,
    sort: {
      key: productProfitabilityPageState.sort.key,
      direction: productProfitabilityPageState.sort.direction
    },
    filter: {
      category: productProfitabilityPageState.filter.category,
      type: productProfitabilityPageState.filter.type,
      search: productProfitabilityPageState.filter.search
    },
    cacheCount: (productProfitabilityDataCache || []).length,
    cacheFirstId: ((productProfitabilityDataCache || [])[0] || {}).productId || null,
    pageInfo: document.getElementById("productsPpPageInfo").innerText.trim(),
    indicator: document.getElementById("productsPpPageIndicator").innerText.trim(),
    first: document.getElementById("productsPpFirstPage").disabled,
    prev: document.getElementById("productsPpPrevPage").disabled,
    next: document.getElementById("productsPpNextPage").disabled,
    last: document.getElementById("productsPpLastPage").disabled,
    activePage: (document.querySelector("#productsPpPageNumbers [aria-current='page']") || {}).innerText || null,
    rows: document.querySelectorAll("#productsPpTableBody tr").length,
    firstRowIndex: (document.querySelector("#productsPpTableBody tr td") || {}).innerText || null,
    firstRowName: (document.querySelector("#productsPpTableBody tr td:nth-child(2)") || {}).innerText || null,
    kpiRevenue: document.getElementById("productsPpKpiRevenueValue").innerText.trim(),
    kpiUnits: document.getElementById("productsPpKpiUnitsValue").innerText.trim(),
    kpiProducts: document.getElementById("productsPpKpiProductsValue").innerText.trim(),
    ariaBusy: document.getElementById("products").getAttribute("aria-busy")
  }));

const txnState = (page) =>
  page.evaluate(() => ({
    pageSize: transactionsPageSize,
    footer: document.getElementById("transactionsPageSizeFooter").value,
    storage: window.localStorage.getItem("numlock.transactions.pageSize"),
    range: document.getElementById("transactionsRangeSummary").innerText.trim(),
    indicator: document.getElementById("transactionsPageIndicator").innerText.trim(),
    pages: JSON.stringify(transactionsPages)
  }));

test.describe("Product Profitability async refresh regression", () => {
  test("R01 refresh keeps the current page and its rows", async ({ page }) => {
    await loadInitial(page, buildPayload(60, "P"));
    await page.evaluate(() => setProductsTabProfitabilityPage(2));

    let state = await ppState(page);
    expect(state.indicator).toBe("Page 2 of 3");
    expect(state.rows).toBe(25);
    expect(state.firstRowIndex).toBe("26");

    await refreshProfitability(page);
    expect(await pendingCount(page)).toBe(1);
    expect(await resolveAll(page, buildPayload(60, "P"))).toBe(1);

    state = await ppState(page);
    expect(state.page).toBe(2);
    expect(state.indicator).toBe("Page 2 of 3");
    expect(state.activePage).toBe("2");
    expect(state.rows).toBe(25);
    expect(state.firstRowIndex).toBe("26");
    expect(state.ariaBusy).toBe("false");
  });

  test("R02 refresh keeps the selected rows per page", async ({ page }) => {
    await loadInitial(page, buildPayload(60, "P"));
    await page.selectOption("#productsPpPageSize", "10");

    let state = await ppState(page);
    expect(state.pageSize).toBe(10);
    expect(state.indicator).toBe("Page 1 of 6");

    await page.evaluate(() => setProductsTabProfitabilityPage(3));
    await refreshProfitability(page);
    expect(await resolveAll(page, buildPayload(60, "P"))).toBe(1);

    state = await ppState(page);
    expect(state.pageSize).toBe(10);
    expect(state.page).toBe(3);
    expect(state.indicator).toBe("Page 3 of 6");
    expect(await page.locator("#productsPpPageSize").inputValue()).toBe("10");
  });

  test("R03 refresh keeps the active category filter", async ({ page }) => {
    await loadInitial(page, buildPayload(60, "P"));
    await page.selectOption("#productsPpCategoryFilter", "SeedA");

    let state = await ppState(page);
    expect(state.filter.category).toBe("SeedA");
    expect(state.indicator).toBe("Page 1 of 2");

    await page.evaluate(() => setProductsTabProfitabilityPage(2));
    await refreshProfitability(page);
    expect(await resolveAll(page, buildPayload(60, "P"))).toBe(1);

    state = await ppState(page);
    expect(state.filter.category).toBe("SeedA");
    expect(state.page).toBe(2);
    expect(state.indicator).toBe("Page 2 of 2");
    expect(state.rows).toBe(5);
    expect(state.firstRowIndex).toBe("26");
  });

  test("R04 refresh keeps the active sort", async ({ page }) => {
    await loadInitial(page, buildPayload(60, "P"));
    await page
      .locator("#productsPpProductProfitabilityTable thead button[onclick*=\"sortProductProfitabilityTable('units')\"]")
      .click();

    let state = await ppState(page);
    expect(state.sort.key).toBe("units");
    expect(state.sort.direction).toBe("asc");

    await page.evaluate(() => setProductsTabProfitabilityPage(2));
    await refreshProfitability(page);
    expect(await resolveAll(page, buildPayload(60, "P"))).toBe(1);

    state = await ppState(page);
    expect(state.sort.key).toBe("units");
    expect(state.sort.direction).toBe("asc");
    expect(state.page).toBe(2);
    expect(state.indicator).toBe("Page 2 of 3");
    expect(state.firstRowName).toBe("P-SeedA-26");
  });

  test("R05 refresh clamps to the last valid page when the dataset shrinks", async ({ page }) => {
    await loadInitial(page, buildPayload(60, "P"));
    await page.evaluate(() => setProductsTabProfitabilityPage(3));
    expect((await ppState(page)).indicator).toBe("Page 3 of 3");

    await refreshProfitability(page);
    expect(await resolveAll(page, buildPayload(30, "P"))).toBe(1);

    const state = await ppState(page);
    expect(state.page).toBe(2);
    expect(state.indicator).toBe("Page 2 of 2");
    expect(state.rows).toBe(5);
    expect(state.firstRowIndex).toBe("26");
  });

  test("R06 a late stale response never overwrites the newest payload", async ({ page }) => {
    await loadInitial(page, buildPayload(60, "P"));

    await refreshProfitability(page);
    await refreshProfitability(page);
    expect(await pendingCount(page)).toBe(2);

    expect(await resolveNewest(page, buildPayload(60, "B"))).toBe(true);
    expect(await resolveOldest(page, buildPayload(60, "A"))).toBe(true);

    const state = await ppState(page);
    expect(state.cacheFirstId).toBe("B-001");
    expect(state.cacheCount).toBe(60);
    expect(state.firstRowName).toBe("B-SeedB-60");
  });

  test("R07 a late stale response never discards the newer user page and filter", async ({ page }) => {
    await loadInitial(page, buildPayload(60, "P"));

    await refreshProfitability(page);
    await refreshProfitability(page);
    await page.selectOption("#productsPpCategoryFilter", "SeedA");
    await page.evaluate(() => setProductsTabProfitabilityPage(2));

    expect(await resolveNewest(page, buildPayload(60, "B"))).toBe(true);
    expect(await resolveOldest(page, buildPayload(60, "A"))).toBe(true);

    const state = await ppState(page);
    expect(state.filter.category).toBe("SeedA");
    expect(state.page).toBe(2);
    expect(state.indicator).toBe("Page 2 of 2");
    expect(state.cacheFirstId).toBe("B-001");
  });

  test("R08 an empty refresh renders the canonical empty state", async ({ page }) => {
    await loadInitial(page, buildPayload(60, "P"));
    await page.evaluate(() => setProductsTabProfitabilityPage(2));

    await refreshProfitability(page);
    expect(await resolveAll(page, buildPayload(0, "P"))).toBe(1);

    const state = await ppState(page);
    expect(state.rows).toBe(1);
    expect(state.page).toBe(1);
    expect(state.pageInfo).toBe("0–0 of 0");
    expect(state.indicator).toBe("Page 1 of 1");
    expect(state.first).toBe(true);
    expect(state.prev).toBe(true);
    expect(state.next).toBe(true);
    expect(state.last).toBe(true);
    expect(state.kpiRevenue).toBe("Rp 0");
    expect(state.kpiUnits).toBe("0");
    expect(state.kpiProducts).toBe("0");
    const message = await page.locator("#productsPpTableBody tr").first().innerText();
    expect(message).toContain("No products match the current filter.");
  });

  test("R09 intentional filter, sort and page-size changes still reset to page 1", async ({ page }) => {
    await loadInitial(page, buildPayload(60, "P"));

    await page.evaluate(() => setProductsTabProfitabilityPage(3));
    expect((await ppState(page)).page).toBe(3);

    await page.fill("#productsPpSearchInput", "seeda");
    let state = await ppState(page);
    expect(state.page).toBe(1);
    expect(state.filter.search).toBe("seeda");

    await page.fill("#productsPpSearchInput", "");
    await page.evaluate(() => setProductsTabProfitabilityPage(2));
    await page.selectOption("#productsPpCategoryFilter", "SeedB");
    state = await ppState(page);
    expect(state.page).toBe(1);
    expect(state.filter.category).toBe("SeedB");

    await page.selectOption("#productsPpCategoryFilter", "");
    await page.evaluate(() => setProductsTabProfitabilityPage(2));
    await page
      .locator("#productsPpProductProfitabilityTable thead button[onclick*=\"sortProductProfitabilityTable('units')\"]")
      .click();
    state = await ppState(page);
    expect(state.page).toBe(1);
    expect(state.sort.key).toBe("units");

    await page.evaluate(() => setProductsTabProfitabilityPage(2));
    await page.selectOption("#productsPpPageSize", "10");
    state = await ppState(page);
    expect(state.page).toBe(1);
    expect(state.pageSize).toBe(10);
  });

  test("R10 the Product Profitability refresh leaves Transactions pagination untouched", async ({ page }) => {
    await loadInitial(page, buildPayload(60, "P"));
    await page.selectOption("#productsPpPageSize", "50");
    expect((await ppState(page)).pageSize).toBe(50);

    await gotoDestination(page, "transactions");
    await page.locator("#transactions").waitFor({ state: "visible", timeout: 15000 });
    const before = await txnState(page);
    expect(before.pageSize).toBe(15);
    expect(before.footer).toBe("15");

    await gotoDestination(page, "products");
    await refreshProfitability(page);
    expect(await resolveAll(page, buildPayload(60, "P"))).toBe(1);

    await gotoDestination(page, "transactions");
    await page.locator("#transactions").waitFor({ state: "visible", timeout: 15000 });
    const after = await txnState(page);

    expect(after.pageSize).toBe(15);
    expect(after.footer).toBe("15");
    expect(after.storage).toBe("15");
    expect(after.range).toBe(before.range);
    expect(after.indicator).toBe(before.indicator);
    expect(after.pages).toBe(before.pages);
    expect(await page.evaluate(() => window.localStorage.getItem("numlock.productProfitability.pageSize"))).toBe("50");
  });
});
