import { test, expect } from "playwright/test";
const http = require("node:http");
const { assembleHtml } = require("../harness/assemble-html.js");

// P2 accessibility regression: distinct accessible names for the Finance
// Profit & Loss table and the Products Product Profitability table.
// Names are read from the browser accessibility tree (CDP AX tree), not from
// static markup, so a stale or duplicated attribute cannot pass silently.

const PORT = 34575;
const TARGET_URL = `http://localhost:${PORT}/`;
const TIMEOUT = 60000;

const FINANCE_TABLE = "#financeContent table.finance-expense-table";
const PRODUCTS_PP_TABLE = "#productsPpProductProfitabilityTable";
const FINANCE_PP_TABLE = "#financeProductProfitabilityTable";

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
});

// Computed accessible name straight from the browser accessibility tree.
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

// Every table/grid node currently exposed to assistive technology.
async function axTableNames(page) {
  const client = await page.context().newCDPSession(page);
  try {
    const { nodes } = await client.send("Accessibility.getFullAXTree");
    return nodes
      .filter((n) => n.role && (n.role.value === "table" || n.role.value === "grid") && !n.ignored)
      .map((n) => ({ role: n.role.value, name: n.name ? n.name.value : "" }));
  } finally {
    await client.detach();
  }
}

async function gotoDestination(page, destination) {
  await page.evaluate(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
  });
  await page.locator(`[data-page='${destination}'][data-navigation-destination='${destination}']`).click();
}

async function openFinanceProfitLoss(page) {
  await page.evaluate(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
  });
  await page.locator("[data-page='finance'][data-navigation-destination='profit-loss']").click();
  await page.locator(FINANCE_TABLE).waitFor({ state: "visible", timeout: 15000 });
}

async function openProductsProfitability(page) {
  await gotoDestination(page, "products");
  await page.locator("#productsTabProfitability").click();
  await page.locator("#productsPanelProfitability").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForSelector("#productsPpTableBody tr", { state: "visible", timeout: 15000 });
}

// The Finance module keeps its own product profitability destination
// (controller level). It is reachable programmatically only.
async function openFinanceProductProfitability(page) {
  await openFinanceProfitLoss(page);
  await page.evaluate(() => {
    setFinanceDestination("product-profitability");
    ensureFinanceData();
  });
  await page.locator(FINANCE_PP_TABLE).waitFor({ state: "visible", timeout: 15000 });
  await page.waitForSelector("#financeProductProfitabilityTableBody tr", { state: "visible", timeout: 15000 });
}

test.describe("Accessible table naming", () => {
  test("A01 Finance Profit & Loss table is named 'Profit and Loss'", async ({ page }) => {
    await openFinanceProfitLoss(page);

    expect(await axName(page, FINANCE_TABLE)).toBe("Profit and Loss");
    expect(await page.getByRole("table", { name: "Profit and Loss" }).count()).toBe(1);
    expect(await page.getByRole("table", { name: "Product Profitability" }).count()).toBe(0);
  });

  test("A02 Products Product Profitability table is named 'Product Profitability'", async ({ page }) => {
    await openProductsProfitability(page);

    expect(await axName(page, PRODUCTS_PP_TABLE)).toBe("Product Profitability");
    expect(await page.getByRole("grid", { name: "Product Profitability" }).count()).toBe(1);
  });

  test("A03 the Finance and Products tables are separate elements with distinct names", async ({ page }) => {
    await openFinanceProfitLoss(page);
    const financeId = await page.locator(FINANCE_TABLE).evaluate((el) => el.closest("[id]").id);
    const financeName = await axName(page, FINANCE_TABLE);

    await openProductsProfitability(page);
    const productsId = await page.locator(PRODUCTS_PP_TABLE).evaluate((el) => el.id);
    const productsName = await axName(page, PRODUCTS_PP_TABLE);

    expect(financeId).toBe("financeContent");
    expect(productsId).toBe("productsPpProductProfitabilityTable");
    expect(financeId).not.toBe(productsId);
    expect(financeName).not.toBe(productsName);
    expect(financeName).toBe("Profit and Loss");
    expect(productsName).toBe("Product Profitability");

    // Independent selection by accessible name (each page exposes one table).
    await openFinanceProfitLoss(page);
    expect(await page.getByRole("table", { name: "Profit and Loss" }).count()).toBe(1);
    expect(await page.getByRole("grid", { name: "Product Profitability" }).count()).toBe(0);

    await openProductsProfitability(page);
    expect(await page.getByRole("grid", { name: "Product Profitability" }).count()).toBe(1);
    expect(await page.getByRole("table", { name: "Profit and Loss" }).count()).toBe(0);

    // No duplicate table name left in the document.
    expect(await page.locator('table[aria-label="Product Profitability"]').count()).toBe(1);
    expect(await page.locator('table[aria-label="Profit and Loss"]').count()).toBe(1);
    const allNames = await page.evaluate(() =>
      Array.from(document.querySelectorAll("table")).map((t) => t.getAttribute("aria-label")).filter(Boolean)
    );
    expect(new Set(allNames).size).toBe(allNames.length);
  });

  test("A04 both tables keep table semantics and column headers", async ({ page }) => {
    await openFinanceProfitLoss(page);
    const finance = await page.locator(FINANCE_TABLE).evaluate((t) => ({
      tag: t.tagName,
      role: t.getAttribute("role"),
      caption: (t.querySelector("caption") || {}).textContent || null,
      headers: Array.from(t.querySelectorAll("thead th")).map((th) => ({
        text: th.textContent.trim(),
        scope: th.getAttribute("scope")
      }))
    }));
    expect(finance.tag).toBe("TABLE");
    expect(finance.role).toBeNull();
    expect(finance.caption).toBe("Operating expenses by account");
    expect(finance.headers.length).toBe(4);
    expect(finance.headers.every((h) => h.scope === "col")).toBe(true);

    await openProductsProfitability(page);
    const products = await page.locator(PRODUCTS_PP_TABLE).evaluate((t) => ({
      tag: t.tagName,
      role: t.getAttribute("role"),
      caption: (t.querySelector("caption") || {}).textContent || null,
      headers: Array.from(t.querySelectorAll("thead th")).map((th) => ({
        text: th.textContent.trim(),
        scope: th.getAttribute("scope")
      }))
    }));
    expect(products.tag).toBe("TABLE");
    expect(products.role).toBe("grid");
    expect(products.caption).toBe("Product profitability by product variant");
    expect(products.headers.length).toBe(12);
    expect(products.headers.every((h) => h.scope === "col")).toBe(true);
  });

  test("A05 accessible names survive asynchronous rendering", async ({ page }) => {
    await openFinanceProfitLoss(page);
    await page.waitForTimeout(1200);
    expect(await axName(page, FINANCE_TABLE)).toBe("Profit and Loss");

    await openProductsProfitability(page);
    await page.waitForTimeout(1200);
    expect(await axName(page, PRODUCTS_PP_TABLE)).toBe("Product Profitability");
    expect(await page.locator("#productsPpTableBody tr").count()).toBe(10);

    await openFinanceProductProfitability(page);
    await page.waitForTimeout(1200);
    expect(await axName(page, FINANCE_PP_TABLE)).toBe("Profit and Loss by Product");
    expect(await page.locator("#financeProductProfitabilityTableBody tr").count()).toBe(10);
  });

  test("A06 names stay correct across repeated navigation without duplicate tables", async ({ page }) => {
    for (let round = 0; round < 3; round++) {
      await openFinanceProfitLoss(page);
      expect(await axName(page, FINANCE_TABLE)).toBe("Profit and Loss");

      await openProductsProfitability(page);
      expect(await axName(page, PRODUCTS_PP_TABLE)).toBe("Product Profitability");
      expect(await page.locator('table[aria-label="Product Profitability"]').count()).toBe(1);
      expect(await page.locator('table[aria-label="Profit and Loss"]').count()).toBe(1);

      await gotoDestination(page, "dashboard");
      await page.waitForTimeout(500);
      const exposed = await axTableNames(page);
      expect(exposed.filter((n) => n.name === "Product Profitability")).toHaveLength(0);
      expect(exposed.filter((n) => n.name === "Profit and Loss")).toHaveLength(0);
    }
  });

  test("A07 responsive widths keep names, semantics and document overflow", async ({ page }) => {
    for (const width of [390, 768, 1536]) {
      await page.setViewportSize({ width, height: 900 });

      await openFinanceProfitLoss(page);
      expect(await axName(page, FINANCE_TABLE)).toBe("Profit and Loss");
      const financeHeaders = await page.locator(`${FINANCE_TABLE} thead th`).count();
      expect(financeHeaders).toBe(4);
      const financeOverflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      }));
      expect(financeOverflow.scrollWidth).toBeLessThanOrEqual(financeOverflow.innerWidth + 1);

      await openProductsProfitability(page);
      expect(await axName(page, PRODUCTS_PP_TABLE)).toBe("Product Profitability");
      const productsHeaders = await page.locator(`${PRODUCTS_PP_TABLE} thead th`).count();
      expect(productsHeaders).toBe(12);
      const productsOverflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      }));
      expect(productsOverflow.scrollWidth).toBeLessThanOrEqual(productsOverflow.innerWidth + 1);
    }
  });

  test("A08 naming correction changes no data, filter, sort, pagination or KPI behavior", async ({ page }) => {
    await openProductsProfitability(page);

    const initial = await page.evaluate(() => ({
      rows: document.querySelectorAll("#productsPpTableBody tr").length,
      firstName: (document.querySelector("#productsPpTableBody tr td:nth-child(2)") || {}).innerText || null,
      kpiRevenue: document.getElementById("productsPpKpiRevenueValue").innerText.trim(),
      kpiUnits: document.getElementById("productsPpKpiUnitsValue").innerText.trim(),
      kpiProducts: document.getElementById("productsPpKpiProductsValue").innerText.trim(),
      indicator: document.getElementById("productsPpPageIndicator").innerText.trim(),
      pageInfo: document.getElementById("productsPpPageInfo").innerText.trim()
    }));
    expect(initial.rows).toBe(10);
    expect(initial.firstName).toBe("Espresso");
    expect(initial.kpiRevenue).toBe("Rp 12.785.000");
    expect(initial.kpiUnits).toBe("497");
    expect(initial.kpiProducts).toBe("10");
    expect(initial.indicator).toBe("Page 1 of 1");
    expect(initial.pageInfo).toBe("1–10 of 10");

    await page.selectOption("#productsPpCategoryFilter", "Coffee");
    expect(await page.locator("#productsPpTableBody tr").count()).toBe(7);

    await page.selectOption("#productsPpCategoryFilter", "");
    await page
      .locator("#productsPpProductProfitabilityTable thead button[onclick*=\"sortProductProfitabilityTable('units')\"]")
      .click();
    const sortedFirst = await page.evaluate(
      () => (document.querySelector("#productsPpTableBody tr td:nth-child(2)") || {}).innerText || null
    );
    expect(sortedFirst).toBe("Frappuccino");

    await openFinanceProfitLoss(page);
    const finance = await page.evaluate(() => ({
      headers: Array.from(document.querySelectorAll("#financeContent table.finance-expense-table thead th")).map(
        (th) => th.textContent.trim()
      ),
      caption: (
        document.querySelector("#financeContent table.finance-expense-table caption") || {}
      ).textContent.trim()
    }));
    expect(finance.headers).toEqual([
      "Account / Account Name",
      "Statement Group",
      "Amount",
      "Proportion"
    ]);
    expect(finance.caption).toBe("Operating expenses by account");
  });

  test("A09 no duplicate or broken ARIA references are introduced", async ({ page }) => {
    await openFinanceProfitLoss(page);
    await openProductsProfitability(page);

    // No new aria-labelledby association was introduced for the corrected tables.
    expect(await page.locator(`${FINANCE_TABLE}[aria-labelledby]`).count()).toBe(0);
    expect(await page.locator(`${PRODUCTS_PP_TABLE}[aria-labelledby]`).count()).toBe(0);
    expect(await page.locator(`${FINANCE_PP_TABLE}[aria-labelledby]`).count()).toBe(0);

    // Every existing aria-labelledby reference resolves to exactly one element.
    const references = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("[aria-labelledby]").forEach((el) => {
        el.getAttribute("aria-labelledby")
          .split(/\s+/)
          .filter(Boolean)
          .forEach((id) => {
            out.push({ id, matches: document.querySelectorAll('[id="' + CSS.escape(id) + '"]').length });
          });
      });
      return out;
    });
    expect(references.length).toBeGreaterThan(0);
    expect(references.every((r) => r.matches === 1)).toBe(true);

    // No duplicate element ids beyond the pre-existing baseline.
    const duplicateIds = await page.evaluate(() => {
      const counts = {};
      document.querySelectorAll("[id]").forEach((el) => {
        counts[el.id] = (counts[el.id] || 0) + 1;
      });
      return Object.keys(counts).filter((id) => counts[id] > 1);
    });
    // "productProfitabilitySummary" is duplicated in the shipped markup (pre-existing).
    expect(duplicateIds.filter((id) => id !== "productProfitabilitySummary")).toEqual([]);
  });

  test("A10 P1.1 async refresh behaviour and the table name stay intact", async ({ page }) => {
    await openProductsProfitability(page);

    const before = await page.evaluate(() => ({
      page: productProfitabilityPageState.page,
      rows: document.querySelectorAll("#productsPpTableBody tr").length
    }));

    // Re-activating the tab re-runs the async refresh path.
    await page.locator("#productsTabProfitability").click();
    await page.waitForTimeout(1200);

    const after = await page.evaluate(() => ({
      page: productProfitabilityPageState.page,
      rows: document.querySelectorAll("#productsPpTableBody tr").length
    }));

    expect(after.page).toBe(before.page);
    expect(after.rows).toBe(before.rows);
    expect(await axName(page, PRODUCTS_PP_TABLE)).toBe("Product Profitability");
  });
});
