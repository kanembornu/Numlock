import { test, expect } from "playwright/test";
const path = require("node:path");
const http = require("node:http");
const { assembleHtml } = require("../harness/assemble-html.js");

const PORT = 34571;
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
});

test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

test.beforeEach(async ({ page }) => {
  page.on("pageerror", error => console.log("[PAGE ERROR]", error.message));
  await page.setViewportSize({ width: 1536, height: 960 });
  await page.goto(TARGET_URL, { waitUntil: "load", timeout: TIMEOUT });
  await page.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
  await page.waitForTimeout(1000);
});

async function openProfitability(page) {
  await page.evaluate(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
  });
  await page.locator("[data-page='products'][data-navigation-destination='products']").click();
  await page.locator("#productsTabProfitability").click();
  await page.locator("#productsPanelProfitability").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(
    () => {
      const el = document.getElementById("productsPpKpiRevenueValue");
      return el && el.innerText.trim() !== "—";
    },
    { timeout: 15000 }
  );
  await page.waitForSelector("#productsPpTableBody tr", { state: "visible", timeout: 15000 });
}

const containment = page => page.evaluate(() => {
  const table = document.getElementById("productsPpProductProfitabilityTable");
  const panel = document.getElementById("productsPanelProfitability");
  const productsSection = document.getElementById("products");
  const rect = el => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top + window.scrollY), h: Math.round(r.height), w: Math.round(r.width) };
  };
  const visible = el => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
  };
  return {
    tableCount: document.querySelectorAll("#productsPpProductProfitabilityTable").length,
    ariaTableCount: document.querySelectorAll('table[aria-label="Product Profitability"]').length,
    insidePanel: !!(table && panel && panel.contains(table)),
    insideProductsSection: !!(table && productsSection && productsSection.contains(table)),
    panelParentId: panel ? panel.parentElement.id : null,
    panelHidden: panel ? panel.hasAttribute("hidden") : null,
    tableVisible: table ? visible(table) : false,
    tableRect: table ? rect(table) : null,
    panelRect: panel ? rect(panel) : null,
    productsSectionRect: productsSection ? rect(productsSection) : null,
    visiblePpTables: Array.from(document.querySelectorAll('table[aria-label="Product Profitability"]'))
      .filter(visible)
      .map(t => ({ id: t.id, top: Math.round(t.getBoundingClientRect().top + window.scrollY) }))
  };
});

test.describe("Product Profitability tab containment", () => {

  test("table element exists exactly once and lives inside the Product Profitability panel", async ({ page }) => {
    await openProfitability(page);
    const state = await containment(page);
    expect(state.tableCount).toBe(1);
    expect(state.insidePanel).toBe(true);
    expect(state.insideProductsSection).toBe(true);
    expect(state.panelParentId).toBe("products");
  });

  test("panel is a child of the products page section, not of the content viewport", async ({ page }) => {
    const parentId = await page.evaluate(() => {
      const panel = document.getElementById("productsPanelProfitability");
      return panel ? panel.parentElement.id : null;
    });
    expect(parentId).toBe("products");
  });

  test("table does not appear at the bottom of unrelated pages", async ({ page }) => {
    await openProfitability(page);
    await page.evaluate(() => {
      const nav = document.querySelector("[data-navigation-destination='dashboard']");
      if (nav) nav.click();
    });
    await page.waitForTimeout(800);
    const state = await containment(page);
    expect(state.visiblePpTables).toEqual([]);
    expect(state.tableVisible).toBe(false);
    const viewportBottom = await page.evaluate(() => document.scrollingElement.scrollHeight);
    expect(viewportBottom).toBeLessThan(4000);
  });

  test("other Products tabs do not display the Product Profitability table", async ({ page }) => {
    await openProfitability(page);
    for (const tab of ["productsTabCatalog", "productsTabRecipe", "productsTabInventory"]) {
      await page.evaluate(id => document.getElementById(id).click(), tab);
      await page.waitForTimeout(400);
      const state = await containment(page);
      expect(state.tableVisible).toBe(false);
      expect(state.visiblePpTables).toEqual([]);
    }
  });

  test("repeated tab navigation does not duplicate or relocate the table", async ({ page }) => {
    await openProfitability(page);
    const initial = await containment(page);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => document.getElementById("productsTabCatalog").click());
      await page.waitForTimeout(250);
      await page.evaluate(() => document.getElementById("productsTabProfitability").click());
      await page.waitForTimeout(350);
      const state = await containment(page);
      expect(state.tableCount).toBe(1);
      expect(state.insidePanel).toBe(true);
      expect(state.insideProductsSection).toBe(true);
      expect(state.tableRect.top).toBe(initial.tableRect.top);
    }
  });

  test("asynchronous loading does not change the intended DOM position", async ({ page }) => {
    await page.evaluate(() => {
      if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
    });
    await page.locator("[data-page='products'][data-navigation-destination='products']").click();
    await page.locator("#productsTabProfitability").click();
    await page.locator("#productsPanelProfitability").waitFor({ state: "visible", timeout: 15000 });
    const beforeLoad = await containment(page);
    expect(beforeLoad.insidePanel).toBe(true);
    expect(beforeLoad.insideProductsSection).toBe(true);

    await page.waitForFunction(
      () => {
        const el = document.getElementById("productsPpKpiRevenueValue");
        return el && el.innerText.trim() !== "—";
      },
      { timeout: 15000 }
    );
    await page.waitForSelector("#productsPpTableBody tr", { state: "visible", timeout: 15000 });
    const afterLoad = await containment(page);
    expect(afterLoad.insidePanel).toBe(true);
    expect(afterLoad.insideProductsSection).toBe(true);
    expect(afterLoad.tableCount).toBe(1);
    expect(afterLoad.panelParentId).toBe("products");
    // Table stays within the panel bounds after the async render completes.
    expect(afterLoad.tableRect.top).toBeGreaterThanOrEqual(afterLoad.panelRect.top);
    expect(beforeLoad.insideProductsSection).toBe(true);
  });

  test("KPI, search/filter, table and pagination keep their vertical order", async ({ page }) => {
    await openProfitability(page);
    const order = await page.evaluate(() => {
      const box = id => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      };
      return {
        kpi: box("productsPpKpiRevenueValue"),
        search: box("productsPpSearchInput"),
        table: box("productsPpProductProfitabilityTable"),
        pagination: box("productProfitabilityPagination")
      };
    });
    expect(order.kpi.bottom).toBeLessThanOrEqual(order.search.top + 1);
    expect(order.search.bottom).toBeLessThanOrEqual(order.table.top + 1);
    expect(order.table.bottom).toBeLessThanOrEqual(order.pagination.top + 1);
  });

  test("responsive layouts keep the table inside the panel at 390/768/1536", async ({ page }) => {
    for (const width of [390, 768, 1536]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(400);
      await openProfitability(page);
      const state = await containment(page);
      expect(state.tableCount).toBe(1);
      expect(state.insidePanel).toBe(true);
      expect(state.insideProductsSection).toBe(true);
      const overflow = await page.evaluate(() => ({
        scrollW: document.scrollingElement.scrollWidth,
        clientW: document.documentElement.clientWidth
      }));
      expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 1);
    }
  });
});
