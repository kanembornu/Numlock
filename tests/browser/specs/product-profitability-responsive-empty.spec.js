import { test, expect } from "playwright/test";
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");
const { assembleHtml, ROOT } = require("../harness/assemble-html.js");

const PORT = 34570;
const TARGET_URL = `http://localhost:${PORT}/`;
const TIMEOUT = 60000;
const SHOT_DIR = path.join(ROOT, "test-results", "pp-responsive");

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, columns: 2 },
  { name: "tablet", width: 768, height: 1024, columns: 3 },
  { name: "desktop", width: 1536, height: 960, columns: 6 }
];

const KPI_IDS = [
  "productsPpKpiRevenueValue",
  "productsPpKpiCogsValue",
  "productsPpKpiGrossProfitValue",
  "productsPpKpiGrossMarginValue",
  "productsPpKpiUnitsValue",
  "productsPpKpiProductsValue"
];

const fixture = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "fixtures", "product-profitability.json"), "utf8")
);
const sum = key => fixture.products.reduce((acc, p) => acc + Number(p[key] || 0), 0);
const EXPECTED_TOTALS = {
  revenue: `Rp ${sum("revenue").toLocaleString("id-ID")}`,
  cogs: `Rp ${sum("cogs").toLocaleString("id-ID")}`,
  grossProfit: `Rp ${sum("grossProfit").toLocaleString("id-ID")}`,
  grossMargin: `${((sum("grossProfit") / sum("revenue")) * 100).toFixed(1)}%`,
  units: sum("units").toLocaleString("id-ID"),
  products: String(new Set(fixture.products.map(p => p.productId)).size)
};

let server;

test.beforeAll(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
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

async function navigateToProductProfitability(page) {
  await page.evaluate(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
  });
  const navButton = page.locator("[data-page='products'][data-navigation-destination='products']");
  await navButton.click();
  await page.locator("#productsTabProfitability").click();
  await page.locator("#productsPanelProfitability").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForSelector("#productsPpTableBody tr", { state: "visible", timeout: 15000 });
  await page.waitForFunction(() => {
    const el = document.getElementById("productsPpKpiRevenueValue");
    return el && el.innerText.trim() !== "—";
  }, { timeout: 15000 });
}

async function geometry(page) {
  return page.evaluate(() => {
    const panel = document.getElementById("productsPanelProfitability");
    const cards = Array.from(panel.querySelectorAll(".hf-kpi-card"));
    const box = el => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
    };
    const search = document.getElementById("productsPpSearchInput");
    const table = document.getElementById("productsPpProductProfitabilityTable");
    const wrap = table.parentElement;
    const panelBox = box(panel);
    return {
      viewportWidth: window.innerWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      cardCount: cards.length,
      cards: cards.map(c => box(c)),
      cardColumnXs: Array.from(new Set(cards.map(c => Math.round(box(c).left)))),
      panelBox,
      searchBox: box(search),
      tableBox: box(wrap),
      kpiGridBox: box(cards[0].parentElement),
      domOrder: (() => {
        const grid = cards[0].parentElement;
        const cmp = (a, b) => a.compareDocumentPosition(b);
        return {
          gridBeforeSearch: !!(cmp(grid, search) & Node.DOCUMENT_POSITION_FOLLOWING),
          searchBeforeTable: !!(cmp(search, table) & Node.DOCUMENT_POSITION_FOLLOWING)
        };
      })()
    };
  });
}

test.describe("Product Profitability responsive layout", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} ${vp.width}x${vp.height}: six KPI cards, grid, no overflow, control order`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(TARGET_URL, { waitUntil: "load", timeout: TIMEOUT });
      await page.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
      await navigateToProductProfitability(page);

      const g = await geometry(page);
      await page.screenshot({
        path: path.join(SHOT_DIR, `pp-${vp.width}x${vp.height}.png`),
        fullPage: true
      });

      expect(g.cardCount, "KPI cards inside Products > Product Profitability").toBe(6);
      expect.soft(g.cardColumnXs.length, "responsive KPI grid columns").toBe(vp.columns);

      for (const [i, card] of g.cards.entries()) {
        expect(card.width, `card ${i} has width`).toBeGreaterThan(0);
        expect(card.top, `card ${i} inside panel top`).toBeGreaterThanOrEqual(g.panelBox.top - 1);
        expect(card.bottom, `card ${i} inside panel bottom`).toBeLessThanOrEqual(g.panelBox.bottom + 1);
        expect(card.left, `card ${i} not clipped left`).toBeGreaterThanOrEqual(-1);
        expect(card.right, `card ${i} not clipped right`).toBeLessThanOrEqual(vp.width + 1);
      }

      expect(g.kpiGridBox.bottom, "control row after KPI grid").toBeLessThanOrEqual(g.searchBox.top + 1);
      expect(g.searchBox.top, "search/filter before table").toBeLessThanOrEqual(g.tableBox.top + 1);
      expect(g.domOrder.gridBeforeSearch, "KPI grid precedes search in DOM").toBe(true);
      expect(g.domOrder.searchBeforeTable, "search precedes table in DOM").toBe(true);

      expect(
        g.pageScrollWidth,
        `page horizontal overflow at ${vp.width} (scrollWidth ${g.pageScrollWidth})`
      ).toBeLessThanOrEqual(vp.width + 1);
      expect(g.bodyScrollWidth).toBeLessThanOrEqual(vp.width + 1);

      console.log(
        `[MEASURED] ${vp.name} ${vp.width}x${vp.height}: cards=${g.cardCount} columns=${g.cardColumnXs.length} ` +
          `expectedColumns=${vp.columns} scrollWidth=${g.pageScrollWidth}/${g.bodyScrollWidth} ` +
          `kpiBottom=${Math.round(g.kpiGridBox.bottom)} searchTop=${Math.round(g.searchBox.top)} ` +
          `tableTop=${Math.round(g.tableBox.top)}`
      );
    });
  }

  test("KPI placement stable after navigation away and repeated initialization", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(TARGET_URL, { waitUntil: "load", timeout: TIMEOUT });
    await page.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });

    await navigateToProductProfitability(page);
    const first = await geometry(page);

    await page.evaluate(() => {
      if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
    });
    await page.locator("[data-page='dashboard'][data-navigation-destination='dashboard']").click();
    await page.locator("#dashboardPanelOverview").waitFor({ state: "visible", timeout: 15000 });
    await navigateToProductProfitability(page);

    const second = await geometry(page);

    expect(second.cardCount).toBe(6);
    expect(second.cardColumnXs.length).toBe(2);
    expect(second.cardColumnXs).toEqual(first.cardColumnXs);
    expect(second.kpiGridBox.top).toBeCloseTo(first.kpiGridBox.top, 0);
    expect(second.searchBox.top).toBeGreaterThanOrEqual(second.kpiGridBox.bottom - 1);    expect(second.pageScrollWidth).toBeLessThanOrEqual(391);
    expect(second.kpiGridBox.bottom).toBeLessThanOrEqual(second.searchBox.top + 1);

    await page.screenshot({
      path: path.join(SHOT_DIR, "pp-390x844-after-renavigation.png"),
      fullPage: true
    });
  });
});

test.describe("Product Profitability table geometry", () => {
  async function tableGeometry(page) {
    return page.evaluate(() => {
      const table = document.getElementById("productsPpProductProfitabilityTable");
      const wrap = table.parentElement;
      const ths = Array.from(table.querySelectorAll("thead th"));
      const headers = ths.map(th => {
        const r = th.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
      });
      const rows = Array.from(table.querySelectorAll("tbody tr")).map(tr => Math.round(tr.getBoundingClientRect().height));
      return {
        columnCount: ths.length,
        tableWidth: Math.round(table.getBoundingClientRect().width),
        containerClientWidth: wrap.clientWidth,
        containerScrollWidth: wrap.scrollWidth,
        containerOverflowX: getComputedStyle(wrap).overflowX,
        headers,
        rowHeights: rows,
        cardColumns: (() => {
          const panel = document.getElementById("productsPanelProfitability");
          const cards = Array.from(panel.querySelectorAll(".hf-kpi-card"));
          return new Set(cards.map(c => Math.round(c.getBoundingClientRect().left))).size;
        })(),
        pageScrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      };
    });
  }

  for (const vp of VIEWPORTS) {
    test(`${vp.name} ${vp.width}x${vp.height}: table fits, scrolls, 12 columns, KPI grid ${vp.columns}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(TARGET_URL, { waitUntil: "load", timeout: TIMEOUT });
      await page.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
      await navigateToProductProfitability(page);

      const g = await tableGeometry(page);
      await page.screenshot({
        path: path.join(SHOT_DIR, `table-${vp.width}x${vp.height}.png`),
        fullPage: true
      });

      console.log(
        `[MEASURED] table ${vp.width}x${vp.height}: cols=${g.columnCount} tableW=${g.tableWidth} ` +
          `containerClientW=${g.containerClientWidth} containerScrollW=${g.containerScrollWidth} ` +
          `overflowX=${g.containerOverflowX} firstColW=${g.headers[0].width} ` +
          `cardColumns=${g.cardColumns} pageScrollW=${g.pageScrollWidth}/${g.innerWidth}`
      );

      expect(g.columnCount, "12 table columns").toBe(12);
      expect(g.cardColumns, "KPI grid columns").toBe(vp.columns);
      expect(g.pageScrollWidth, "no page-level horizontal overflow").toBeLessThanOrEqual(vp.width + 1);

      expect(g.headers[0].width, "first column not excessive").toBeLessThan(g.tableWidth * 0.25);

      for (let i = 1; i < g.headers.length; i++) {
        expect(g.headers[i].left, `column ${i} starts after column ${i - 1}`).toBeGreaterThanOrEqual(
          g.headers[i - 1].right - 1
        );
        expect(g.headers[i].width, `column ${i} has width`).toBeGreaterThan(0);
      }
      expect(g.headers[g.headers.length - 1].right - g.headers[0].left).toBeLessThanOrEqual(g.tableWidth + 1);

      expect(g.rowHeights.length).toBeGreaterThan(0);
      g.rowHeights.forEach(h => expect(h).toBeGreaterThan(0));

      expect(g.containerOverflowX).toBe("auto");
      if (vp.width >= 1536) {
        expect(g.tableWidth, "desktop table fits container").toBeLessThanOrEqual(g.containerClientWidth + 1);
        expect(g.containerScrollWidth, "desktop container not scrollable").toBeLessThanOrEqual(
          g.containerClientWidth + 1
        );
      } else {
        expect(g.tableWidth, "table wider than container").toBeGreaterThan(g.containerClientWidth);
        expect(g.containerScrollWidth, "table scrolls inside wrapper").toBeGreaterThan(g.containerClientWidth);
      }
    });
  }
});

test.describe("Product Profitability empty filter state", () => {
  test("zero-match search zeroes all six KPIs, shows table empty state, restores on clear", async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 960 });
    await page.goto(TARGET_URL, { waitUntil: "load", timeout: TIMEOUT });
    await page.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
    await navigateToProductProfitability(page);

    const values = () => page.evaluate(ids => {
      const out = {};
      ids.forEach(id => { out[id] = document.getElementById(id).innerText.trim(); });
      return out;
    }, KPI_IDS);

    const initial = await values();
    expect(initial.productsPpKpiRevenueValue).toBe(EXPECTED_TOTALS.revenue);
    expect(initial.productsPpKpiCogsValue).toBe(EXPECTED_TOTALS.cogs);
    expect(initial.productsPpKpiGrossProfitValue).toBe(EXPECTED_TOTALS.grossProfit);
    expect(initial.productsPpKpiGrossMarginValue).toBe(EXPECTED_TOTALS.grossMargin);
    expect(initial.productsPpKpiUnitsValue).toBe(EXPECTED_TOTALS.units);
    expect(initial.productsPpKpiProductsValue).toBe(EXPECTED_TOTALS.products);

    const searchInput = page.locator("#productsPpSearchInput");
    await searchInput.fill("zzzz-no-such-product");
    await page.waitForTimeout(300);

    const empty = await values();
    expect(empty.productsPpKpiRevenueValue).toBe("Rp 0");
    expect(empty.productsPpKpiCogsValue).toBe("Rp 0");
    expect(empty.productsPpKpiGrossProfitValue).toBe("Rp 0");
    expect(empty.productsPpKpiGrossMarginValue).toBe("0.0%");
    expect(empty.productsPpKpiUnitsValue).toBe("0");
    expect(empty.productsPpKpiProductsValue).toBe("0");

    const bodyRows = page.locator("#productsPpTableBody tr");
    await expect(bodyRows).toHaveCount(1);
    await expect(bodyRows.first()).toContainText("No products match the current filter.");
    await expect(page.locator("#productsPpTableBody td[colspan='12']")).toBeVisible();
    await expect(page.locator("#productsPpPageInfo")).toHaveText("0–0 of 0");

    await page.screenshot({ path: path.join(SHOT_DIR, "pp-empty-filter.png"), fullPage: true });

    await searchInput.fill("");
    await page.waitForTimeout(300);

    const restored = await values();
    expect(restored).toEqual(initial);
    await expect(page.locator("#productsPpTableBody tr").first()).not.toContainText(
      "No products match the current filter."
    );

    await page.screenshot({ path: path.join(SHOT_DIR, "pp-empty-filter-cleared.png"), fullPage: true });
  });
});
