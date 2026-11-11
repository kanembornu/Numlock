import { test, expect } from "playwright/test";
const http = require("node:http");
const { assembleHtml } = require("../harness/assemble-html.js");

const PORT = 34572;
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
});

async function openProfitability(page) {
  await page.evaluate(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
  });
  await page.locator("[data-page='products'][data-navigation-destination='products']").click();
  await page.locator("#productsTabProfitability").click();
  await page.locator("#productsPanelProfitability").waitFor({ state: "visible", timeout: 15000 });
  await page.waitForSelector("#productsPpTableBody tr", { state: "visible", timeout: 15000 });
  await page.waitForFunction(
    () => {
      const el = document.getElementById("productsPpKpiRevenueValue");
      return el && el.innerText.trim() !== "—";
    },
    { timeout: 15000 }
  );
}

// Deterministic 60-row dataset: 30 "SeedA" + 30 "SeedB" products.
async function seedProducts(page, count) {
  await page.evaluate((total) => {
    const products = [];
    for (let i = 1; i <= total; i++) {
      const group = i <= total / 2 ? "SeedA" : "SeedB";
      products.push({
        productId: "SEED-" + String(i).padStart(3, "0"),
        productName: group + " " + String(i).padStart(2, "0"),
        category: group,
        type: i % 2 === 0 ? "Cold" : "Hot",
        units: i,
        revenue: i * 1000,
        cogs: i * 400,
        grossProfit: i * 600,
        grossMargin: 60,
        revenueMix: 1 / total,
        grossProfitRank: i,
        revenueRank: i
      });
    }
    productProfitabilityDataCache = products;
    productProfitabilityPageState.page = 1;
    renderProductProfitabilityTable("productsPpTableBody");
    renderProductProfitabilityPagination("productsPp");
  }, count);
}

// Transactions lives on its own destination; the pagination is only visible there.
async function openTransactions(page) {
  await page.evaluate(() => {
    if (typeof setSidebarOpen === "function") setSidebarOpen(true, false);
  });
  await page.locator("[data-page='transactions'][data-navigation-destination='transactions']").click();
  await page.locator("#transactions").waitFor({ state: "visible", timeout: 15000 });
  // The footer bar is unhidden by the first (server) page result.
  await page.locator("#transactionsPagination").waitFor({ state: "visible", timeout: 15000 });
}

// Deterministic Transactions client index so the reference table pages locally.
async function seedTransactions(page, count) {
  await page.evaluate((total) => {
    const rows = [];
    for (let i = 1; i <= total; i++) {
      rows.push({
        id: "TXN-SEED-" + String(i).padStart(3, "0"),
        date: "2026-01-" + String((i % 28) + 1).padStart(2, "0"),
        transactionType: "Sales",
        product: "Seed Item " + i,
        qty: 1,
        revenue: i * 100,
        isActive: true
      });
    }
    if (!transactionsDateFilter) {
      transactionsDateFilter = { filter: "currentYear", customStart: "", customEnd: "" };
    }
    transactionsSearchIndex = rows;
    transactionsResultCache = {};
    transactionsResultCacheOrder = [];
    transactionsPages = { recent: 1, sales: 1, expenses: 1, purchases: 1 };
    requestTransactionsPage();
  }, count);
  await page.waitForFunction(
    () => document.querySelectorAll("#tableBody tr").length > 1,
    { timeout: 15000 }
  );
}

const productsState = (page) =>
  page.evaluate(() => ({
    pageInfo: document.getElementById("productsPpPageInfo").innerText.trim(),
    indicator: document.getElementById("productsPpPageIndicator").innerText.trim(),
    first: document.getElementById("productsPpFirstPage").disabled,
    prev: document.getElementById("productsPpPrevPage").disabled,
    next: document.getElementById("productsPpNextPage").disabled,
    last: document.getElementById("productsPpLastPage").disabled,
    activePage: (document.querySelector("#productsPpPageNumbers [aria-current='page']") || {}).innerText || null,
    pageNumbers: Array.from(
      document.querySelectorAll("#productsPpPageNumbers button")
    ).map((b) => b.innerText.trim()),
    rows: document.querySelectorAll("#productsPpTableBody tr").length,
    firstRowIndex: (document.querySelector("#productsPpTableBody tr td") || {}).innerText || null,
    firstRowName: (document.querySelector("#productsPpTableBody tr td:nth-child(2)") || {}).innerText || null
  }));

const transactionsState = (page) =>
  page.evaluate(() => ({
    rangeSummary: document.getElementById("transactionsRangeSummary").innerText.trim(),
    indicator: document.getElementById("transactionsPageIndicator").innerText.trim(),
    prev: document.getElementById("transactionsPreviousPage").disabled,
    next: document.getElementById("transactionsNextPage").disabled,
    rows: document.querySelectorAll("#tableBody tr").length,
    firstRowId: (document.querySelector("#tableBody tr td") || {}).innerText || null
  }));

test.describe("Pagination structure parity: Product Profitability vs Transactions", () => {
  test("both paginations expose the same canonical control set", async ({ page }) => {
    await openProfitability(page);

    const structure = await page.evaluate(() => {
      const describe = (rootId) => {
        const root = document.getElementById(rootId);
        if (!root) return null;
        const select = root.querySelector("select");
        const indicator = root.querySelector("[id$='PageIndicator']");
        const range = root.querySelector("[id$='RangeSummary'], [id$='PageInfo']");
        return {
          hasRangeElement: Boolean(range),
          hasRowsPerPageLabel: Boolean(
            root.querySelector("label[for]") && /rows per page/i.test(root.querySelector("label[for]").innerText)
          ),
          selectId: select ? select.id : null,
          selectOptions: select ? Array.from(select.options).map((o) => o.value) : [],
          indicatorText: indicator ? indicator.innerText.trim() : null,
          previousButton: Boolean(root.querySelector("[id$='PrevPage'], [id$='PreviousPage']")),
          nextButton: Boolean(root.querySelector("[id$='NextPage']")),
          previousIcon: Boolean(root.querySelector("[id$='PrevPage'] .fa-chevron-left, [id$='PreviousPage'] .fa-chevron-left")),
          nextIcon: Boolean(root.querySelector("[id$='NextPage'] .fa-chevron-right"))
        };
      };
      return {
        transactions: describe("transactionsPagination"),
        products: describe("productProfitabilityPagination")
      };
    });

    expect(structure.transactions).not.toBeNull();
    expect(structure.products).not.toBeNull();

    for (const key of [
      "hasRangeElement",
      "hasRowsPerPageLabel",
      "previousButton",
      "nextButton",
      "previousIcon",
      "nextIcon"
    ]) {
      expect(structure.products[key], key).toBe(structure.transactions[key]);
    }
    expect(structure.products.indicatorText).toMatch(/^Page \d+ of \d+$/);
    expect(structure.transactions.indicatorText).toMatch(/^Page \d+ of \d+$/);
    expect(structure.products.selectOptions.length).toBeGreaterThan(1);
  });

  test("Product Profitability bar and buttons render with Transactions geometry", async ({ page }) => {
    await openProfitability(page);

    const styles = await page.evaluate(() => {
      const bar = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          minHeight: cs.minHeight,
          paddingTop: cs.paddingTop,
          paddingLeft: cs.paddingLeft,
          borderTopWidth: cs.borderTopWidth,
          borderTopStyle: cs.borderTopStyle
        };
      };
      const button = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          minWidth: cs.minWidth,
          minHeight: cs.minHeight,
          borderRadius: cs.borderRadius,
          fontSize: cs.fontSize,
          display: cs.display,
          gap: cs.gap
        };
      };
      const select = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { height: cs.height, borderRadius: cs.borderRadius, fontSize: cs.fontSize };
      };
      const text = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { fontSize: cs.fontSize, color: cs.color };
      };
      return {
        transactionsBar: bar("transactionsPagination"),
        productsBar: bar("productProfitabilityPagination"),
        transactionsPrev: button("transactionsPreviousPage"),
        productsPrev: button("productsPpPrevPage"),
        transactionsNext: button("transactionsNextPage"),
        productsNext: button("productsPpNextPage"),
        transactionsSelect: select("transactionsPageSizeFooter"),
        productsSelect: select("productsPpPageSize"),
        transactionsIndicator: text("transactionsPageIndicator"),
        productsIndicator: text("productsPpPageIndicator"),
        transactionsRange: text("transactionsRangeSummary"),
        productsRange: text("productsPpPageInfo")
      };
    });

    expect(styles.productsBar).toEqual(styles.transactionsBar);
    expect(styles.productsPrev).toEqual(styles.transactionsPrev);
    expect(styles.productsNext).toEqual(styles.transactionsNext);
    expect(styles.productsSelect).toEqual(styles.transactionsSelect);
    expect(styles.productsIndicator).toEqual(styles.transactionsIndicator);
    expect(styles.productsRange).toEqual(styles.transactionsRange);
  });
});

test.describe("Product Profitability pagination behaviour", () => {
  test("First / Previous / Next / Last move the rendered dataset", async ({ page }) => {
    await openProfitability(page);
    await seedProducts(page, 60);

    let state = await productsState(page);
    expect(state.pageInfo).toBe("1–25 of 60");
    expect(state.indicator).toBe("Page 1 of 3");
    expect(state.first).toBe(true);
    expect(state.prev).toBe(true);
    expect(state.next).toBe(false);
    expect(state.last).toBe(false);
    expect(state.rows).toBe(25);
    expect(state.activePage).toBe("1");

    await page.locator("#productsPpNextPage").click();
    state = await productsState(page);
    expect(state.pageInfo).toBe("26–50 of 60");
    expect(state.indicator).toBe("Page 2 of 3");
    expect(state.prev).toBe(false);
    expect(state.next).toBe(false);
    expect(state.last).toBe(false);
    expect(state.firstRowIndex).toBe("26");
    expect(state.activePage).toBe("2");

    await page.locator("#productsPpLastPage").click();
    state = await productsState(page);
    expect(state.pageInfo).toBe("51–60 of 60");
    expect(state.indicator).toBe("Page 3 of 3");
    expect(state.next).toBe(true);
    expect(state.last).toBe(true);
    expect(state.firstRowIndex).toBe("51");

    await page.locator("#productsPpPrevPage").click();
    state = await productsState(page);
    expect(state.indicator).toBe("Page 2 of 3");
    expect(state.firstRowIndex).toBe("26");

    await page.locator("#productsPpFirstPage").click();
    state = await productsState(page);
    expect(state.pageInfo).toBe("1–25 of 60");
    expect(state.indicator).toBe("Page 1 of 3");
    expect(state.first).toBe(true);
    expect(state.prev).toBe(true);
    expect(state.firstRowIndex).toBe("1");
  });

  test("numbered page buttons navigate and expose the active page", async ({ page }) => {
    await openProfitability(page);
    await seedProducts(page, 60);

    let state = await productsState(page);
    expect(state.pageNumbers).toEqual(["1", "2", "3"]);
    expect(state.activePage).toBe("1");

    await page.locator("#productsPpPageNumbers button", { hasText: "3" }).click();
    state = await productsState(page);
    expect(state.indicator).toBe("Page 3 of 3");
    expect(state.activePage).toBe("3");
    expect(state.firstRowIndex).toBe("51");

    await page.locator("#productsPpPageNumbers button", { hasText: "1" }).click();
    state = await productsState(page);
    expect(state.indicator).toBe("Page 1 of 3");
    expect(state.activePage).toBe("1");
    expect(state.firstRowIndex).toBe("1");
  });

  test("pagination operates on the filtered dataset and resets on filter change", async ({ page }) => {
    await openProfitability(page);
    await seedProducts(page, 60);

    await page.locator("#productsPpNextPage").click();
    expect((await productsState(page)).indicator).toBe("Page 2 of 3");

    await page.locator("#productsPpSearchInput").fill("SeedA");
    await page.waitForTimeout(300);

    const state = await productsState(page);
    expect(state.pageInfo).toBe("1–25 of 30");
    expect(state.indicator).toBe("Page 1 of 2");
    expect(state.first).toBe(true);
    expect(state.prev).toBe(true);
    expect(state.next).toBe(false);
    expect(state.rows).toBe(25);

    await page.locator("#productsPpNextPage").click();
    const second = await productsState(page);
    expect(second.pageInfo).toBe("26–30 of 30");
    expect(second.indicator).toBe("Page 2 of 2");
    expect(second.next).toBe(true);
    expect(second.last).toBe(true);
  });

  test("sorting resets the active page and keeps sorted order", async ({ page }) => {
    await openProfitability(page);
    await seedProducts(page, 60);

    await page.locator("#productsPpNextPage").click();
    expect((await productsState(page)).indicator).toBe("Page 2 of 3");

    await page.locator("#productsPpProductProfitabilityTable thead th:nth-child(2) button").click();
    await page.waitForTimeout(200);

    const state = await productsState(page);
    expect(state.indicator).toBe("Page 1 of 3");
    expect(state.pageInfo).toBe("1–25 of 60");
    expect(state.firstRowName).toBe("SeedA 01");
  });

  test("empty filtered dataset keeps one disabled page", async ({ page }) => {
    await openProfitability(page);
    await seedProducts(page, 60);

    await page.locator("#productsPpSearchInput").fill("zzzz-no-such-product");
    await page.waitForTimeout(300);

    const state = await productsState(page);
    expect(state.pageInfo).toBe("0–0 of 0");
    expect(state.indicator).toBe("Page 1 of 1");
    expect(state.first).toBe(true);
    expect(state.prev).toBe(true);
    expect(state.next).toBe(true);
    expect(state.last).toBe(true);
    expect(state.rows).toBe(1);
    await expect(page.locator("#productsPpTableBody")).toContainText("No products match the current filter.");
  });

  test("changing the page size re-paginates and resets to the first page", async ({ page }) => {
    await openProfitability(page);
    await seedProducts(page, 60);

    await page.locator("#productsPpNextPage").click();
    expect((await productsState(page)).indicator).toBe("Page 2 of 3");

    await page.selectOption("#productsPpPageSize", "50");
    await page.waitForTimeout(200);

    const state = await productsState(page);
    expect(state.indicator).toBe("Page 1 of 2");
    expect(state.pageInfo).toBe("1–50 of 60");
    expect(state.rows).toBe(50);

    await page.selectOption("#productsPpPageSize", "100");
    await page.waitForTimeout(200);

    const single = await productsState(page);
    expect(single.indicator).toBe("Page 1 of 1");
    expect(single.pageInfo).toBe("1–60 of 60");
    expect(single.next).toBe(true);
    expect(single.last).toBe(true);
    expect(single.rows).toBe(60);
  });

  test("repeated tab navigation does not duplicate pagination handlers", async ({ page }) => {
    await openProfitability(page);
    await seedProducts(page, 60);

    for (let i = 0; i < 3; i++) {
      await page.locator("#productsTabCatalog").click();
      await page.waitForTimeout(200);
      await page.locator("#productsTabProfitability").click();
      await page.waitForTimeout(400);
    }

    await seedProducts(page, 60);
    await page.locator("#productsPpNextPage").click();

    const state = await productsState(page);
    expect(state.indicator).toBe("Page 2 of 3");
    expect(state.pageInfo).toBe("26–50 of 60");
    expect(state.firstRowIndex).toBe("26");
  });

  test("pagination stays inside the viewport at 390 / 768 / 1536", async ({ page }) => {
    for (const width of [390, 768, 1536]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(300);
      await openProfitability(page);
      await seedProducts(page, 60);

      const geometry = await page.evaluate(() => {
        const nav = document.getElementById("productProfitabilityPagination");
        const next = document.getElementById("productsPpNextPage");
        const navRect = nav.getBoundingClientRect();
        const nextRect = next.getBoundingClientRect();
        return {
          navVisible: navRect.width > 0 && navRect.height > 0,
          nextVisible: nextRect.width > 0 && nextRect.height > 0,
          nextWidth: Math.round(nextRect.width),
          pageScrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth
        };
      });

      expect(geometry.navVisible, `pagination visible at ${width}`).toBe(true);
      expect(geometry.nextVisible, `next control visible at ${width}`).toBe(true);
      expect(geometry.nextWidth, `next control sized at ${width}`).toBeGreaterThan(0);
      expect(
        geometry.pageScrollWidth,
        `no horizontal overflow at ${width}`
      ).toBeLessThanOrEqual(geometry.clientWidth + 1);
    }
  });
});

test.describe("Transactions reference pagination behaviour", () => {
  test("reference table reports range, page indicator and boundary states", async ({ page }) => {
    await openTransactions(page);
    await seedTransactions(page, 30);

    let state = await transactionsState(page);
    expect(state.rangeSummary).toBe("Showing 1–15 of 30 transactions");
    expect(state.indicator).toBe("Page 1 of 2");
    expect(state.prev).toBe(true);
    expect(state.next).toBe(false);
    expect(state.rows).toBe(15);

    await page.locator("#transactionsNextPage").click();
    state = await transactionsState(page);
    expect(state.rangeSummary).toBe("Showing 16–30 of 30 transactions");
    expect(state.indicator).toBe("Page 2 of 2");
    expect(state.prev).toBe(false);
    expect(state.next).toBe(true);
    expect(state.rows).toBe(15);

    await page.locator("#transactionsPreviousPage").click();
    state = await transactionsState(page);
    expect(state.indicator).toBe("Page 1 of 2");
    expect(state.prev).toBe(true);
  });
});
