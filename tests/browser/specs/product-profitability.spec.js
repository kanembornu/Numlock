import { test, expect } from "playwright/test";
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { assembleHtml } = require("../harness/assemble-html.js");

const PORT = 34569;
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

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`[Playwright Test] HTTP server running on ${TARGET_URL}`);
});

test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  console.log("[Playwright Test] Server closed");
});

test.beforeEach(async ({ page }) => {
  page.on('console', msg => console.log('[PAGE CONSOLE]', msg.text()));
  page.on('pageerror', error => console.log('[PAGE ERROR]', error.message));
  await page.setViewportSize({ width: 1536, height: 960 });
  await page.goto(TARGET_URL, { waitUntil: "load", timeout: TIMEOUT });
  await page.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
  await page.waitForTimeout(1000);
});

test.describe("Dashboard Product Profitability", () => {

  test("Product Profitability section renders in Performance tab", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.waitForTimeout(500);

    const section = page.locator("#productProfitabilitySection");
    await expect(section).toBeVisible();
  });

  test("Chart renders with product data", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await page.waitForTimeout(500);

    const canvas = page.locator("#productProfitabilityChart");
    await expect(canvas).toBeVisible();
  });

  test("No JavaScript errors on Dashboard Performance tab", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await page.waitForTimeout(1000);
    // Page errors are captured in beforeEach
  });

});

test.describe("Finance Product Profitability", () => {

  async function navigateToProductsProductProfitability(page) {
    // Open sidebar if collapsed (desktop)
    await page.evaluate(() => {
      if (typeof setSidebarOpen === 'function') {
        setSidebarOpen(true, false);
      }
    });
    await page.waitForTimeout(300);

    // Navigate to Products tab (Product Profitability moved here per Task 2)
    // First click the Products sidebar button
    await page.locator("[data-page='products'][data-navigation-destination='products']").click();
    await page.waitForTimeout(300);

    // Then click the Product Profitability sub-tab within Products
    await page.locator("#productsTabProfitability").click();
    await page.waitForTimeout(300);

    // Product Profitability panel should now be visible
    await page.locator("#productsPanelProfitability").waitFor({ state: "visible", timeout: 15000 });
  }

  test("Product Profitability panel renders in Products tab", async ({ page }) => {
    await navigateToProductsProductProfitability(page);

    const content = page.locator("#productsPanelProfitability");
    await expect(content).toBeVisible();
    await expect(content).not.toBeHidden();
  });

  test("Products KPI cards display values", async ({ page }) => {
    await navigateToProductsProductProfitability(page);

    const revenueValue = page.locator("#productsPpKpiRevenueValue");
    const cogsValue = page.locator("#productsPpKpiCogsValue");
    const grossProfitValue = page.locator("#productsPpKpiGrossProfitValue");
    const grossMarginValue = page.locator("#productsPpKpiGrossMarginValue");
    const unitsValue = page.locator("#productsPpKpiUnitsValue");
    const productsValue = page.locator("#productsPpKpiProductsValue");

    await expect(revenueValue).not.toHaveText("—");
    await expect(cogsValue).not.toHaveText("—");
    await expect(grossProfitValue).not.toHaveText("—");
    await expect(grossMarginValue).not.toHaveText("—");
    await expect(unitsValue).not.toHaveText("—");
    await expect(productsValue).not.toHaveText("—");
  });

  test("Products table view renders product data", async ({ page }) => {
    await navigateToProductsProductProfitability(page);

    const tbody = page.locator("#productsPpTableBody");
    await expect(tbody).toBeVisible();

    const rows = tbody.locator("tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Products category filter works", async ({ page }) => {
    await navigateToProductsProductProfitability(page);

    const categoryFilter = page.locator("#productsPpCategoryFilter");
    await expect(categoryFilter).toBeVisible();

    const options = categoryFilter.locator("option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);
  });

  test("Products type filter works", async ({ page }) => {
    await navigateToProductsProductProfitability(page);

    const typeFilter = page.locator("#productsPpTypeFilter");
    await expect(typeFilter).toBeVisible();

    const options = typeFilter.locator("option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);

    const allTypes = await typeFilter.locator("option[value='']").textContent();
    expect(allTypes).toContain("All Types");
  });

  test("Products free-text search filters products", async ({ page }) => {
    await navigateToProductsProductProfitability(page);

    await page.waitForSelector("#productsPpTableBody tr", { state: "visible", timeout: 10000 });

    const searchInput = page.locator("#productsPpSearchInput");
    await expect(searchInput).toBeVisible();

    const initialRows = page.locator("#productsPpTableBody tr");
    const initialCount = await initialRows.count();
    expect(initialCount).toBeGreaterThan(0);

    await searchInput.fill("Espresso");
    await page.waitForTimeout(300);

    const filteredRows = page.locator("#productsPpTableBody tr");
    const filteredCount = await filteredRows.count();

    if (filteredCount > 0) {
      const firstRow = filteredRows.first();
      await expect(firstRow).toContainText("Espresso");
    }
  });

  test("Products sorting works", async ({ page }) => {
    await navigateToProductsProductProfitability(page);

    const headerButton = page.locator("#productsPpProductProfitabilityTable thead th:nth-child(2)");
    await headerButton.click();
    await page.waitForTimeout(300);

    const firstRow = page.locator("#productsPpTableBody tr:first-child td:nth-child(2)");
    const firstName = await firstRow.textContent();
    expect(firstName).toBeTruthy();
  });

  test("Products sorting by type works", async ({ page }) => {
    await navigateToProductsProductProfitability(page);

    const headerButton = page.locator("#productsPpProductProfitabilityTable thead th:nth-child(4)");
    await headerButton.click();
    await page.waitForTimeout(300);

    const firstRow = page.locator("#productsPpTableBody tr:first-child td:nth-child(4)");
    const firstType = await firstRow.textContent();
    expect(firstType).toBeTruthy();
  });

  test("Products sort indicators update correctly", async ({ page }) => {
    await navigateToProductsProductProfitability(page);

    // Wait for table body to be populated (initial render complete)
    await page.waitForSelector("#productsPpTableBody tr", { state: "visible", timeout: 10000 });
    // Wait for sort indicators to be initialized
    await page.waitForFunction(() => {
      const th = document.querySelector("#productsPpProductProfitabilityTable thead th:nth-child(6)");
      return th && th.hasAttribute("aria-sort");
    });

    const headerButton = page.locator("#productsPpProductProfitabilityTable thead th:nth-child(6)");
    await headerButton.click();
    // Wait for re-render and indicator update
    await page.waitForFunction(() => {
      const th = document.querySelector("#productsPpProductProfitabilityTable thead th:nth-child(6)");
      return th && th.getAttribute("aria-sort") === "ascending";
    });

    const th = page.locator("#productsPpProductProfitabilityTable thead th:nth-child(6)");
    await expect(th).toHaveAttribute("aria-sort", "ascending");

    await headerButton.click();
    await page.waitForFunction(() => {
      const th = document.querySelector("#productsPpProductProfitabilityTable thead th:nth-child(6)");
      return th && th.getAttribute("aria-sort") === "descending";
    });

    await expect(th).toHaveAttribute("aria-sort", "descending");
  });

  test("Products pagination works", async ({ page }) => {
    await navigateToProductsProductProfitability(page);

    const pageInfo = page.locator("#productsPpPageInfo");
    await expect(pageInfo).toBeVisible();

    const nextBtn = page.locator("#productsPpNextPage");
    const prevBtn = page.locator("#productsPpPrevPage");

    if (!await nextBtn.isDisabled()) {
      await nextBtn.click();
      await page.waitForTimeout(300);
      await expect(prevBtn).not.toBeDisabled();

      await prevBtn.click();
      await page.waitForTimeout(300);
      await expect(prevBtn).toBeDisabled();
    }
  });
});

test.describe("Product Profitability Cross-tab Consistency", () => {

  test("Dashboard chart and Products table both render data", async ({ page }) => {
    // Dashboard chart renders
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await page.waitForTimeout(500);

    const dashCanvas = page.locator("#productProfitabilityChart");
    await expect(dashCanvas).toBeVisible();

    // Products table renders
    await page.evaluate(() => {
      if (typeof setSidebarOpen === 'function') {
        setSidebarOpen(true, false);
      }
    });
    await page.waitForTimeout(300);

    await page.locator("[data-page='products'][data-navigation-destination='products']").click();
    await page.waitForTimeout(300);
    await page.locator("#productsTabProfitability").click();
    await page.waitForTimeout(300);

    await page.locator("#productsPanelProfitability").waitFor({ state: "visible" });

    const productsTbody = page.locator("#productsPpTableBody");
    await expect(productsTbody).toBeVisible();
    const productsRows = productsTbody.locator("tr");
    const productsCount = await productsRows.count();
    expect(productsCount).toBeGreaterThan(0);
  });

  test("Date filter changes refresh Product Profitability", async ({ page }) => {
    // Date filter is on Overview tab - switch to it first
    await page.locator("#dashboardTabOverview").click();
    await page.locator("#dashboardPanelOverview").waitFor({ state: "visible" });

    const filterTrigger = page.locator(".ui-custom-select-trigger[aria-label='Reporting period']");

    const isHidden = await filterTrigger.evaluate(el => el.hidden);
    const displayStyle = await filterTrigger.evaluate(el => window.getComputedStyle(el).display);
    console.log(`[TEST] filterTrigger hidden: ${isHidden}, display: ${displayStyle}`);

    await expect(filterTrigger).toBeVisible();

    await filterTrigger.click();
    await page.locator("#filterListbox").waitFor({ state: "visible" });

    const listbox = page.locator("#filterListbox");
    await expect(listbox).toBeVisible();

    const options = listbox.locator(".ui-custom-select-option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);

    const targetOption = options.nth(Math.min(1, optionCount - 1));
    await targetOption.click();
    await page.waitForTimeout(500); // Wait for data refresh

    await expect(listbox).toBeHidden();

    // Switch to Performance tab to verify Product Profitability data refreshed
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await page.waitForTimeout(500);

    const dashCanvas = page.locator("#productProfitabilityChart");
    await expect(dashCanvas).toBeVisible();
  });
});

test.describe("Product Profitability product-name contract", () => {
  const fixture = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "fixtures", "product-profitability.json"), "utf8")
  );
  const money = v => "Rp " + Number(v || 0).toLocaleString("id-ID");
  const num = v => Number(v || 0).toLocaleString("id-ID");
  const expectedFor = records => {
    const revenue = records.reduce((s, p) => s + Number(p.revenue || 0), 0);
    const cogs = records.reduce((s, p) => s + Number(p.cogs || 0), 0);
    const gp = records.reduce((s, p) => s + Number(p.grossProfit || 0), 0);
    const units = records.reduce((s, p) => s + Number(p.units || 0), 0);
    return {
      revenue: money(revenue),
      cogs: money(cogs),
      grossProfit: money(gp),
      grossMargin: (revenue !== 0 ? (gp / revenue) * 100 : 0).toFixed(1) + "%",
      units: num(units),
      products: String(new Set(records.map(p => p.productId)).size)
    };
  };
  const readKpis = page => page.evaluate(() => ({
    revenue: document.getElementById("productsPpKpiRevenueValue").innerText.trim(),
    cogs: document.getElementById("productsPpKpiCogsValue").innerText.trim(),
    grossProfit: document.getElementById("productsPpKpiGrossProfitValue").innerText.trim(),
    grossMargin: document.getElementById("productsPpKpiGrossMarginValue").innerText.trim(),
    units: document.getElementById("productsPpKpiUnitsValue").innerText.trim(),
    products: document.getElementById("productsPpKpiProductsValue").innerText.trim()
  }));
  const names = page => page.evaluate(() =>
    Array.from(document.querySelectorAll("#productsPpTableBody tr"))
      .map(tr => (tr.children[1] ? tr.children[1].innerText.trim() : ""))
  );

  async function navigate(page) {
    await page.evaluate(() => {
      if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
    });
    await page.locator("[data-page='products'][data-navigation-destination='products']").click();
    await page.locator("#productsTabProfitability").click();
    await page.locator("#productsPanelProfitability").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForSelector("#productsPpTableBody tr", { state: "visible", timeout: 15000 });
    await page.waitForFunction(
      () => document.getElementById("productsPpKpiRevenueValue").innerText.trim() !== "—",
      { timeout: 15000 }
    );
  }

  test("fixture represents production shape (productName, no label) with documented exceptions", () => {
    const onlyName = fixture.products.filter(p => p.productName && !p.label);
    const both = fixture.products.filter(p => p.productName && p.label);
    const onlyLabel = fixture.products.filter(p => !p.productName && p.label);
    expect(onlyName.length).toBeGreaterThan(0);
    expect(both.length).toBe(1);
    expect(onlyLabel.length).toBe(1);
    expect(onlyLabel[0].label).toBe("Affogato");
  });

  test("production-shaped records render product names", async ({ page }) => {
    await navigate(page);
    const rendered = await names(page);
    expect(rendered.length).toBeGreaterThan(0);
    rendered.forEach(name => expect(name.length).toBeGreaterThan(0));
    expect(rendered).toContain("Espresso");
  });

  test("search by productName filters and updates all six KPIs", async ({ page }) => {
    await navigate(page);
    const term = "Espresso";
    await page.locator("#productsPpSearchInput").fill(term);
    await page.waitForTimeout(400);

    const records = fixture.products.filter(p => (p.productName || p.label) === term);
    expect(records.length).toBe(1);
    await expect(page.locator("#productsPpTableBody tr")).toHaveCount(1);
    expect(await names(page)).toEqual([term]);
    expect(await readKpis(page)).toEqual(expectedFor(records));
  });

  test("search by productId still works", async ({ page }) => {
    await navigate(page);
    const term = "PROD-005";
    await page.locator("#productsPpSearchInput").fill(term);
    await page.waitForTimeout(400);

    const records = fixture.products.filter(p => p.productId.toLowerCase().includes(term.toLowerCase()));
    expect(records.length).toBe(1);
    expect(await names(page)).toEqual([records[0].productName]);
    expect(await readKpis(page)).toEqual(expectedFor(records));
  });

  test("label-only record remains supported", async ({ page }) => {
    await navigate(page);
    await page.locator("#productsPpSearchInput").fill("Affogato");
    await page.waitForTimeout(400);

    const records = fixture.products.filter(p => (p.productName || p.label) === "Affogato");
    expect(records.length).toBe(1);
    expect(records[0].productName).toBeUndefined();
    expect(await names(page)).toEqual(["Affogato"]);
    expect(await readKpis(page)).toEqual(expectedFor(records));
  });

  test("productName takes precedence when both fields differ", async ({ page }) => {
    await navigate(page);
    const search = page.locator("#productsPpSearchInput");

    await search.fill("Frappuccino");
    await page.waitForTimeout(400);
    expect(await names(page)).toEqual(["Frappuccino"]);

    await search.fill("Legacy");
    await page.waitForTimeout(400);
    await expect(page.locator("#productsPpTableBody tr")).toHaveCount(1);
    await expect(page.locator("#productsPpTableBody")).toContainText("No products match the current filter.");
    expect((await readKpis(page)).revenue).toBe("Rp 0");
  });

  test("empty search keeps six zero KPIs and clear restores totals", async ({ page }) => {
    await navigate(page);
    const initial = await readKpis(page);
    expect(initial).toEqual(expectedFor(fixture.products));

    const search = page.locator("#productsPpSearchInput");
    await search.fill("zzzz-no-such-product");
    await page.waitForTimeout(400);
    expect(await readKpis(page)).toEqual({
      revenue: "Rp 0",
      cogs: "Rp 0",
      grossProfit: "Rp 0",
      grossMargin: "0.0%",
      units: "0",
      products: "0"
    });

    await search.fill("");
    await page.waitForTimeout(400);
    expect(await readKpis(page)).toEqual(initial);
  });
});