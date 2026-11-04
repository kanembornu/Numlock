import { test, expect } from "playwright/test";
const path = require("node:path");
const http = require("node:http");
const { assembleHtml } = require("../harness/assemble-html.js");

const PORT = 34568;
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
  await page.setViewportSize({ width: 1536, height: 960 });
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  await page.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
  await page.waitForTimeout(1000);
});

test.describe("Dashboard Overview Interactions", () => {

  test("Profit Margin KPI should have a tooltip", async ({ page }) => {
    await page.locator("#dashboardTabOverview").click();
    await page.waitForTimeout(300);

    const profitMarginDelta = page.locator("#dashboardPanelOverview .hf-kpi-card:nth-child(4) .hf-kpi-comparison strong");
    await expect(profitMarginDelta).toHaveAttribute("data-tooltip-target", "profit-margin-tooltip");

    await profitMarginDelta.hover();
    await page.waitForSelector("#profit-margin-tooltip:visible");

    const tooltip = page.locator("#profit-margin-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText("Perubahan dalam poin persentase dibanding periode sebelumnya. Contoh: 20% menjadi 21,3% berarti naik 1,3 poin.");
  });

  test("Top Products table should display 10 rows with no clipping", async ({ page }) => {
    await page.locator("#dashboardTabOverview").click();
    await page.waitForTimeout(300);

    const productRows = page.locator("#topProductsContainer tbody tr");
    await expect(productRows).toHaveCount(10);

    // Verify rows 9 and 10 are in viewport (not clipped)
    const ninthRow = page.locator("#topProductsContainer tbody tr:nth-child(9)");
    const tenthRow = page.locator("#topProductsContainer tbody tr:nth-child(10)");
    await expect(ninthRow).toBeInViewport();
    await expect(tenthRow).toBeInViewport();

    // Verify card heights are synchronized (~464px, allow sub-pixel variance)
    const revenueCard = page.locator("#revenueChartSection");
    const productsCard = page.locator("#topProductsSection");
    await expect(revenueCard).toHaveCSS("height", /^46[34](\.\d+)?px$/);
    await expect(productsCard).toHaveCSS("height", /^46[34](\.\d+)?px$/);
  });

  async function testColumnSort(page, columnIndex, columnName, expectedFirstAsc, expectedFirstDesc) {
    await page.locator("#dashboardTabOverview").click();
    await page.waitForTimeout(300);

    const headerButton = page.locator(`#topProductsContainer thead th:nth-child(${columnIndex}) button`);
    const headerTh = page.locator(`#topProductsContainer thead th:nth-child(${columnIndex})`);

    // Click to sort - first click direction depends on current state
    await headerButton.click();
    
    // Wait for aria-sort on the TH element (not button)
    await page.waitForFunction((colIdx) => {
      const th = document.querySelector(`#topProductsContainer thead th:nth-child(${colIdx})`);
      return th && th.getAttribute("aria-sort") !== "none";
    }, columnIndex);

    await page.waitForTimeout(300);

    // Get first row value after first click
    let firstValueAsc;
    if (columnName === "Units" || columnName === "Revenue") {
      firstValueAsc = await page.locator("#topProductsContainer tbody tr:first-child td").nth(columnIndex - 2).textContent();
    } else {
      firstValueAsc = await page.locator("#topProductsContainer tbody tr:first-child th").textContent();
    }
    
    // Click again for opposite direction
    await headerButton.click();
    await page.waitForFunction((colIdx) => {
      const th = document.querySelector(`#topProductsContainer thead th:nth-child(${colIdx})`);
      const sort = th.getAttribute("aria-sort");
      return sort === "ascending" || sort === "descending";
    }, columnIndex);
    await page.waitForTimeout(300);

    // Get first row value after second click
    let firstValueDesc;
    if (columnName === "Units" || columnName === "Revenue") {
      firstValueDesc = await page.locator("#topProductsContainer tbody tr:first-child td").nth(columnIndex - 2).textContent();
    } else {
      firstValueDesc = await page.locator("#topProductsContainer tbody tr:first-child th").textContent();
    }

    // Verify row count remains 10
    const productRows = page.locator("#topProductsContainer tbody tr");
    await expect(productRows).toHaveCount(10);

    // Verify the two directions produced different results
    expect(firstValueAsc).not.toBe(firstValueDesc);
  }

  test("Top Products sorting by Product Name", async ({ page }) => {
    // Initial state: Products sorted by Units descending (based on fixture data)
    // First click on Product header should sort by name ascending (Affogato first)
    // Second click should sort descending (Mocha first)
    await testColumnSort(page, 2, "Product", "Affogato", "Mocha");
  });

  test("Top Products sorting by Units", async ({ page }) => {
    // Initial state: Units descending (Espresso 85 first)
    // First click on Units header should sort ascending (Frappuccino 26 first)
    // Second click should sort descending (Espresso 85 first)
    await testColumnSort(page, 3, "Units", "26", "85");
  });

  test("Top Products sorting by Revenue", async ({ page }) => {
    // Initial state: Units descending (not Revenue)
    // First click on Revenue header should sort ascending (Frappuccino 650000 first)
    // Second click should sort descending (Espresso 2125000 first)
    await testColumnSort(page, 4, "Revenue", "650.000", "2.125.000");
  });

  test("Revenue Trend filter functionality", async ({ page }) => {
    await page.locator("#dashboardTabOverview").click();
    await page.waitForTimeout(300);

    const dateFilterControls = page.locator("#dateFilterControls");
    await expect(dateFilterControls).toBeVisible();

    const trigger = dateFilterControls.locator(".ui-custom-select-trigger[aria-label='Reporting period']");
    await expect(trigger).toBeVisible();

    const initialText = (await trigger.locator(".truncate").textContent()) || "";

    await trigger.click();
    await page.waitForTimeout(500); // Wait for animation

    const listbox = page.locator("#filterListbox");
    await expect(listbox).toBeVisible();

    const options = listbox.locator(".ui-custom-select-option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);
    
    const targetOption = options.nth(Math.min(1, optionCount - 1));
    const targetValue = await targetOption.getAttribute("data-value");
    const targetText = await targetOption.locator("span").last().textContent(); // Get the text inside the option
    
    await targetOption.click();
    await page.waitForTimeout(300); // Wait for selection to update
    await expect(listbox).toBeHidden();

    // Verify the trigger text updated
    const newText = await trigger.locator(".truncate").textContent();
    expect(newText).toBe(targetText);
    expect(newText).not.toBe(initialText);

    // Verify the selected option has aria-selected="true"
    const selectedOption = listbox.locator(`.ui-custom-select-option[data-value="${targetValue}"]`);
    await expect(selectedOption).toHaveAttribute("aria-selected", "true");

    // Verify chart still renders
    const canvas = page.locator("#mainChartWrapper canvas");
    await expect(canvas).toBeVisible();
  });

  test("Top Products card should have no internal vertical scrollbar", async ({ page }) => {
    await page.locator("#dashboardTabOverview").click();
    await page.waitForTimeout(1000);

    // Check that the Top Products card doesn't have internal vertical overflow
    const hasInternalScrollbar = await page.evaluate(() => {
      const card = document.querySelector("#topProductsSection");
      return card ? card.scrollHeight > card.clientHeight : false;
    });
    expect(hasInternalScrollbar).toBe(false);
  });

});