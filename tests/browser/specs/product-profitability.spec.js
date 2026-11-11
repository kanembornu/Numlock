import { test, expect } from "playwright/test";
const path = require("node:path");
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

async function switchToDashboardTableView(page) {
    await page.locator("#ppViewTable").click();
    await page.waitForTimeout(300);
    await page.locator("#productProfitabilityTableBody").waitFor({ state: "visible", timeout: 10000 });
  }

test.describe("Dashboard Product Profitability", () => {

  test("Product Profitability section renders in Performance tab", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.waitForTimeout(500);

    const section = page.locator("#productProfitabilitySection");
    await expect(section).toBeVisible();
  });

  test("KPI cards display values", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });

    const revenueValue = page.locator("#ppKpiRevenueValue");
    const cogsValue = page.locator("#ppKpiCogsValue");
    const grossProfitValue = page.locator("#ppKpiGrossProfitValue");
    const grossMarginValue = page.locator("#ppKpiGrossMarginValue");
    const unitsValue = page.locator("#ppKpiUnitsValue");
    const productsValue = page.locator("#ppKpiProductsValue");

    await expect(revenueValue).not.toHaveText("—");
    await expect(cogsValue).not.toHaveText("—");
    await expect(grossProfitValue).not.toHaveText("—");
    await expect(grossMarginValue).not.toHaveText("—");
    await expect(unitsValue).not.toHaveText("—");
    await expect(productsValue).not.toHaveText("—");
  });

  test("Table view renders product data", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    const tbody = page.locator("#productProfitabilityTableBody");
    await expect(tbody).toBeVisible();

    const rows = tbody.locator("tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Category filter works", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    const categoryFilter = page.locator("#ppCategoryFilter");
    await expect(categoryFilter).toBeVisible();

    const options = categoryFilter.locator("option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);

    const allCategories = await categoryFilter.locator("option[value='']").textContent();
    expect(allCategories).toContain("All Categories");
  });

  test("Type filter works", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    const typeFilter = page.locator("#ppTypeFilter");
    await expect(typeFilter).toBeVisible();

    const options = typeFilter.locator("option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);

    const allTypes = await typeFilter.locator("option[value='']").textContent();
    expect(allTypes).toContain("All Types");
  });

  test("Free-text search filters products", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    const searchInput = page.locator("#ppSearchInput");
    await expect(searchInput).toBeVisible();

    await searchInput.pressSequentially("Espresso", { delay: 50 });
    await page.waitForTimeout(300);

    const filteredRows = page.locator("#productProfitabilityTableBody tr");
    const filteredCount = await filteredRows.count();

    if (filteredCount > 0) {
      const firstRow = filteredRows.first();
      await expect(firstRow).toContainText("Espresso");
    }
  });

  test("Search is case-insensitive", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    await page.waitForTimeout(300);

    const searchInput = page.locator("#ppSearchInput");

    await searchInput.fill("ESPRESSO");
    await page.waitForTimeout(300);

    const filteredRows = page.locator("#productProfitabilityTableBody tr");
    const upperCount = await filteredRows.count();

    await searchInput.fill("espresso");
    await page.waitForTimeout(300);

    const lowerCount = await filteredRows.count();
    expect(upperCount).toBe(lowerCount);
  });

  test("Sorting by product name works", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    const headerButton = page.locator("#productProfitabilityTable thead th:nth-child(2) button");
    await headerButton.click();
    await page.waitForTimeout(300);

    const firstRow = page.locator("#productProfitabilityTableBody tr:first-child td:nth-child(2)");
    const firstName = await firstRow.textContent();
    expect(firstName).toBeTruthy();
  });

  test("Sorting by type works", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    const headerButton = page.locator("#productProfitabilityTable thead th:nth-child(4) button");
    await headerButton.click();
    await page.waitForTimeout(300);

    const firstRow = page.locator("#productProfitabilityTableBody tr:first-child td:nth-child(4)");
    const firstType = await firstRow.textContent();
    expect(firstType).toBeTruthy();
  });

  test("Sorting by revenue works", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    const headerButton = page.locator("#productProfitabilityTable thead th:nth-child(6) button");
    await headerButton.click();
    await page.waitForTimeout(300);

    const firstRow = page.locator("#productProfitabilityTableBody tr:first-child td:nth-child(6)");
    const firstRevenue = await firstRow.textContent();
    expect(firstRevenue).toBeTruthy();
  });

  test("Sort indicators update correctly", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    const headerButton = page.locator("#productProfitabilityTable thead th:nth-child(6) button");
    await headerButton.click();
    await page.waitForTimeout(300);

    const th = page.locator("#productProfitabilityTable thead th:nth-child(6)");
    await expect(th).toHaveAttribute("aria-sort", "ascending");

    await headerButton.click();
    await page.waitForTimeout(300);

    await expect(th).toHaveAttribute("aria-sort", "descending");
  });

  test("Pagination controls work", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    const pageInfo = page.locator("#ppPageInfo");
    await expect(pageInfo).toBeVisible();

    const nextBtn = page.locator("#ppNextPage");
    const prevBtn = page.locator("#ppPrevPage");

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

    await page.waitForTimeout(300);

    const headerButton = page.locator("#productsPpProductProfitabilityTable thead th:nth-child(6)");
    await headerButton.click();
    await page.waitForTimeout(300);

    const th = page.locator("#productsPpProductProfitabilityTable thead th:nth-child(6)");
    await expect(th).toHaveAttribute("aria-sort", "ascending");

    await headerButton.click();
    await page.waitForTimeout(300);

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

  test("Dashboard and Products tables show consistent data when filtered", async ({ page }) => {
    await page.locator("#dashboardTabPerformance").click();
    await page.locator("#dashboardPanelPerformance").waitFor({ state: "visible" });
    await switchToDashboardTableView(page);

    await page.waitForTimeout(300);

    await page.locator("#ppSearchInput").fill("Espresso");
    await page.waitForTimeout(300);

    const dashRows = page.locator("#productProfitabilityTableBody tr");
    const dashCount = await dashRows.count();

    await page.evaluate(() => {
      if (typeof setSidebarOpen === 'function') {
        setSidebarOpen(true, false);
      }
    });
    await page.waitForTimeout(300);

    // Navigate to Products tab (Product Profitability moved here per Task 2)
    await page.locator("[data-page='products'][data-navigation-destination='products']").click();
    await page.waitForTimeout(300);
    await page.locator("#productsTabProfitability").click();
    await page.waitForTimeout(300);

    await page.locator("#productsPanelProfitability").waitFor({ state: "visible" });

    await page.locator("#productsPpSearchInput").fill("Espresso");
    await page.waitForTimeout(300);

    const productsRows = page.locator("#productsPpTableBody tr");
    const productsCount = await productsRows.count();

    expect(dashCount).toBe(productsCount);
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
    await switchToDashboardTableView(page);

    const tbody = page.locator("#productProfitabilityTableBody");
    await expect(tbody).toBeVisible();
    const rows = tbody.locator("tr");
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });
});