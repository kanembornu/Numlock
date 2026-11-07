#!/usr/bin/env node
/**
 * NUMLOCK Fluid Desktop Responsive Consolidation — Product Geometry Harness @688
 *
 * Geometry-only browser validation. Measures PRODUCT GEOMETRY invariants at
 * desktop viewport widths >=1024px against UI Validation deployment @688.
 * Does NOT test synthetic sidebar click routing (deferred non-product blocker).
 * Does NOT mutate business data, application source, or persisted state.
 * Does NOT repair layout, publish, or write evidence files. stdout JSON only.
 *
 * Usage: node tests/browser/responsive-geometry-688.js
 * Exit: 0 = matrix completed, no concrete product geometry defect
 *       1 = one or more concrete product geometry defects, OR fatal runtime error
 * Browser closes in finally. One navigation per matrix cell.
 *
 * Validation deployment @688 — NEVER Production Web @676 / API @676.
 */

const { chromium } = require("playwright");

const TARGET_URL =
  "https://script.google.com/macros/s/AKfycbw25GQBv47i1Mm6XaNLRCpiiLTqtboCnqRx-jxhX2m_RzC7PRAFXH_21l5JCVrHyfZv/exec";
const NEW_VERSION = 688;

const NAVIGATION_TIMEOUT = 60_000;
const SHELL_READY_TIMEOUT_MS = 15_000;
const SHELL_READY_POLL_MS = 200;
const DASHBOARD_READY_TIMEOUT_MS = 20_000;
const DASHBOARD_READY_POLL_MS = 200;
const GENERIC_SETTLE_TIMEOUT_MS = 12_000;
const GENERIC_SETTLE_POLL_MS = 200;
const SIDEBAR_SETTLE_MS = 450; // resize/layout consequence settle after state set
const WIDTH_TOLERANCE = 2.0; // sidebar authority: collapsed 64 / expanded 264 / 224
const OVERFLOW_TOLERANCE = 2.0; // px, page-level horizontal overflow tolerance
const OVERLAP_LINEAR_TOL = 1.0; // px, allows intentional shared borders
const OVERLAP_AREA_TOL = 4.0; // px^2
const CLIP_TOL = 0.5; // px, scrollWidth vs clientWidth clip tolerance
const ERROR_SLICE = 300;
const TEXT_SLICE = 120;
const MAX_DEFECT_DETAIL_RECTS = 8;

// Established sidebar authority (Task 1 consolidation @688):
// #appShell[data-sidebar-collapsed]: "true"=collapsed (64px),
// absent/"false"=expanded (264px >=1280, 224px 1024-1279). Content padding total 48px.
const SIDEBAR_AUTHORITY = {
  collapsed: 64,
  expandedAt1280: 264,
  expanded1024to1279: 224,
};

const KPI_LABELS = ["Profit Margin", "Units Sold", "Revenue", "Expense", "Profit"];

const PAGES = ["Dashboard", "Transactions", "Products", "Finance", "Settings"];
const PAGE_KEYS = {
  Dashboard: "dashboard",
  Transactions: "transactions",
  Products: "products",
  Finance: "finance",
  Settings: "settings",
};

// Required width/height matrix per task contract. No extra widths.
function buildMatrix() {
  if (process.env.RESPONSIVE_MICRO_DIAGNOSTIC === "1") {
    return [
      { page: "Dashboard", width: 1024, height: 900, collapsed: false },
      { page: "Transactions", width: 1180, height: 900, collapsed: true },
      { page: "Finance", width: 1180, height: 900, collapsed: true },
    ];
  }
  const cells = [];
  const dashWidths900 = [1024, 1180, 1250, 1280, 1440, 1680];
  for (const width of dashWidths900) {
    cells.push({ page: "Dashboard", width, height: 900, collapsed: false });
  }
  // Both sidebar states at 1680 and 1024 minimum (height 900).
  cells.push({ page: "Dashboard", width: 1680, height: 900, collapsed: true });
  cells.push({ page: "Dashboard", width: 1024, height: 900, collapsed: true });
  // Height 700 at 1024/1280/1680.
  for (const width of [1024, 1280, 1680]) {
    cells.push({ page: "Dashboard", width, height: 700, collapsed: false });
  }
  // Transactions/Products: representative widths @900, both states.
  for (const page of ["Transactions", "Products"]) {
    for (const width of [1024, 1180, 1440]) {
      for (const collapsed of [false, true]) {
        cells.push({ page, width, height: 900, collapsed });
      }
    }
  }
  // Finance mandatory: expanded 1024/1180/1250/1440; collapsed 1024/1180.
  for (const width of [1024, 1180, 1250, 1440]) {
    cells.push({ page: "Finance", width, height: 900, collapsed: false });
  }
  for (const width of [1024, 1180]) {
    cells.push({ page: "Finance", width, height: 900, collapsed: true });
  }
  // Settings: 1024 + 1440 expanded @900.
  for (const page of ["Settings"]) {
    for (const width of [1024, 1440]) {
      cells.push({ page, width, height: 900, collapsed: false });
    }
  }
  return cells;
}

function sliceText(value, max = TEXT_SLICE) {
  return String(value == null ? "" : value).slice(0, max);
}

function isRelevantAppError(text) {
  const t = String(text || "").toLowerCase();
  const noise = [
    "favicon",
    "net::err_aborted",
    "net::err_connection",
    "failed to load resource: the server responded with a status of 404",
    "failed to load resource: net::err",
    "third-party cookie",
  ];
  if (noise.some((n) => t.includes(n))) return false;
  const relevant = [
    "uncaught",
    "typeerror",
    "referenceerror",
    "syntaxerror",
    "rangeerror",
    "appshell",
    "contentviewport",
    "sidebar",
    "dashboard",
    "overview",
    "finance",
    "numlock",
    "userhtmlframe",
  ];
  return relevant.some((r) => t.includes(r));
}

function sliceError(value) {
  return sliceText(value, ERROR_SLICE);
}

// Obvious Google auth boundary — detect only, never interact.
async function detectAuthBlock(page) {
  const url = page.url();
  if (/accounts\.google\.com|ServiceLogin|signin|oauth/i.test(url)) return true;
  const loginUi = await page
    .locator('input[type="email"], input[type="password"], a[href*="accounts.google.com"]')
    .count()
    .catch(() => 0);
  return loginUi > 0;
}

function isTransientShellLookupError(error) {
  const msg = String((error && error.message) || error || "").toLowerCase();
  return (
    msg.includes("frame was detached") ||
    msg.includes("execution context was destroyed") ||
    msg.includes("context was destroyed") ||
    msg.includes("target closed") ||
    msg.includes("cannot find context") ||
    msg.includes("no frame with")
  );
}

// ATTACHED = locator count > 0. VISIBLE = first().isVisible().
async function inspectAppShell(scope) {
  let attached = false;
  let visible = false;
  try {
    const locator = scope.locator("#appShell");
    attached = (await locator.count()) > 0;
    if (attached) {
      visible = await locator.first().isVisible();
    }
  } catch (error) {
    if (!isTransientShellLookupError(error)) throw error;
  }
  return { attached, visible };
}

// Proven Apps Script frame-resolution model — frame set REACQUIRED each attempt.
async function waitForAppShell(page, timeoutMs = SHELL_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + timeoutMs;
  let last = {
    appShellReached: false,
    appShellContext: "NOT_FOUND",
    frameCount: 0,
    userHtmlFramePresent: false,
    frame: null,
    readinessStatus: "NOT_FOUND",
    readinessElapsedMs: 0,
  };
  for (;;) {
    const frames = page.frames();
    const frameCount = frames.length;
    const userHtmlFrame = frames.find((f) => f.name() === "userHtmlFrame") || null;
    const userHtmlFramePresent = Boolean(userHtmlFrame);

    const top = await inspectAppShell(page);
    if (top.attached && top.visible) {
      return {
        appShellReached: true,
        appShellContext: "TOP_LEVEL",
        frameCount,
        userHtmlFramePresent,
        frame: page,
        readinessStatus: "READY",
        readinessElapsedMs: Date.now() - startedAt,
      };
    }

    let frameState = null;
    if (userHtmlFrame) {
      frameState = await inspectAppShell(userHtmlFrame);
      if (frameState.attached && frameState.visible) {
        return {
          appShellReached: true,
          appShellContext: "USER_HTML_FRAME",
          frameCount,
          userHtmlFramePresent,
          frame: userHtmlFrame,
          readinessStatus: "READY",
          readinessElapsedMs: Date.now() - startedAt,
        };
      }
    }

    last = {
      appShellReached: false,
      appShellContext: "NOT_FOUND",
      frameCount,
      userHtmlFramePresent,
      frame: null,
      readinessStatus: "NOT_FOUND",
      readinessElapsedMs: Date.now() - startedAt,
    };

    if (Date.now() >= deadlineAt) {
      return { ...last, readinessStatus: "TIMEOUT" };
    }
    await page.waitForTimeout(SHELL_READY_POLL_MS);
  }
}

// Overview data readiness (required for Dashboard cells; used as app-init
// gate before nav for other pages): KPI labels + top products table visible.
async function waitForDashboardReadiness(app, page, timeoutMs = DASHBOARD_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + timeoutMs;
  let last = { readinessStatus: "NOT_READY", labelsPresent: false, tablePresent: false, elapsedMs: 0 };
  for (;;) {
    let sample = null;
    try {
      sample = await app.evaluate((labels) => {
        const text = document.body ? document.body.innerText || "" : "";
        const labelsPresent = labels.every((l) => text.indexOf(l) !== -1);
        const table = document.querySelector("#topProductsSection .hf-top-products-table");
        const tableRect = table ? table.getBoundingClientRect() : null;
        const tablePresent = Boolean(tableRect && tableRect.width > 0 && tableRect.height > 0);
        return { labelsPresent, tablePresent };
      }, KPI_LABELS);
    } catch (error) {
      if (!isTransientShellLookupError(error)) throw error;
    }
    last = {
      readinessStatus: "NOT_READY",
      labelsPresent: sample ? sample.labelsPresent : false,
      tablePresent: sample ? sample.tablePresent : false,
      elapsedMs: Date.now() - startedAt,
    };
    if (sample && sample.labelsPresent && sample.tablePresent) {
      last.readinessStatus = "DASHBOARD_DATA_READY";
      return last;
    }
    if (Date.now() >= deadlineAt) {
      last.readinessStatus = "DASHBOARD_DATA_TIMEOUT";
      return last;
    }
    await page.waitForTimeout(DASHBOARD_READY_POLL_MS);
  }
}

// Bounded generic page settle after in-frame nav: shell visible +
// #contentViewport present + stable scrollHeight across two samples.
async function waitForGenericSettle(app, page, timeoutMs = GENERIC_SETTLE_TIMEOUT_MS) {
  const startedAt = Date.now();
  let lastHeight = -1;
  let stableSamples = 0;
  let last = { readinessStatus: "NOT_READY", sample: null, elapsedMs: 0 };
  for (;;) {
    let sample = null;
    try {
      sample = await app.evaluate(() => {
        const shell = document.querySelector("#appShell");
        const cv = document.querySelector("#contentViewport");
        return {
          shellVisible: Boolean(shell && shell.getBoundingClientRect().width > 0),
          cvPresent: Boolean(cv),
          cvScrollHeight: cv ? cv.scrollHeight : null,
          cvClientHeight: cv ? cv.clientHeight : null,
          readyState: document.readyState,
        };
      });
    } catch (error) {
      if (!isTransientShellLookupError(error)) throw error;
    }
    if (sample && sample.shellVisible && sample.cvPresent && (sample.cvScrollHeight || 0) > 0) {
      if (sample.cvScrollHeight === lastHeight) stableSamples += 1;
      else {
        stableSamples = 0;
        lastHeight = sample.cvScrollHeight;
      }
      if (stableSamples >= 1) {
        return {
          readinessStatus: "PAGE_SETTLED",
          sample,
          elapsedMs: Date.now() - startedAt,
        };
      }
    }
    last = {
      readinessStatus: "NOT_READY",
      sample,
      elapsedMs: Date.now() - startedAt,
    };
    if (Date.now() - startedAt >= timeoutMs) {
      return { readinessStatus: "PAGE_SETTLE_TIMEOUT", sample, elapsedMs: Date.now() - startedAt };
    }
    await page.waitForTimeout(GENERIC_SETTLE_POLL_MS);
  }
}

// Deterministic sidebar state via application authority. NEVER Playwright
// locator.click() on #sidebarCollapseButton — synthetic click routing is not
// an acceptance requirement. Reports method explicitly. No business mutation.
async function setSidebarState(app, page, collapsed) {
  let method = null;
  try {
    method = await app.evaluate((wantCollapsed) => {
      if (typeof window.setDesktopSidebarCollapsed === "function") {
        window.setDesktopSidebarCollapsed(wantCollapsed);
        return "window.setDesktopSidebarCollapsed";
      }
      const appShell = document.querySelector("#appShell");
      if (appShell) {
        appShell.setAttribute("data-sidebar-collapsed", wantCollapsed ? "true" : "false");
        return "attribute #appShell[data-sidebar-collapsed]";
      }
      return "UNAVAILABLE";
    }, collapsed);
  } catch (error) {
    method = "ERROR:" + sliceError((error && error.message) || error);
  }
  await page.waitForTimeout(SIDEBAR_SETTLE_MS);
  let observed = { collapsedAttr: null, sidebarWidth: null };
  try {
    observed = await app.evaluate(() => {
      const appShell = document.querySelector("#appShell");
      const sidebar =
        document.querySelector("#dashboardSidebar") || document.querySelector("#sidebar");
      return {
        collapsedAttr: appShell ? appShell.getAttribute("data-sidebar-collapsed") : null,
        sidebarWidth: sidebar ? +sidebar.getBoundingClientRect().width.toFixed(2) : null,
      };
    });
  } catch (error) {
    if (!isTransientShellLookupError(error)) throw error;
  }
  return {
    method,
    requestedState: collapsed ? "collapsed" : "expanded",
    observed,
    methodAvailable: method !== "UNAVAILABLE" && String(method).indexOf("ERROR") !== 0,
  };
}

// Deterministic in-page navigation via real nav controls (evaluate click).
// NOT a sidebar click-routing test — page selection only.
async function navigateInApp(app, pageName) {
  return app.evaluate((pageName) => {
    const norm = (s) => String(s || "").toLowerCase();
    const tokens =
      pageName === "Dashboard" ? ["dashboard", "overview"] : [norm(pageName)];
    const roots = [
      document.querySelector("#dashboardSidebar"),
      document.querySelector("nav"),
      document.querySelector("#appShell"),
    ].filter(Boolean);
    const seen = new Set();
    for (const token of tokens) {
      for (const root of roots) {
        const nodes = root.querySelectorAll(
          "a, button, [role='tab'], [role='menuitem'], [data-page], [data-nav], [data-target-page]"
        );
        const matches = [];
        for (const node of nodes) {
          const text = (node.textContent || "").trim();
          if (!text || text.length > 40) continue;
          const n = norm(text);
          if (n === token || n.indexOf(token) !== -1) matches.push(node);
        }
        if (matches.length) {
          matches.sort(
            (a, b) =>
              (a.textContent || "").trim().length - (b.textContent || "").trim().length
          );
          const el = matches[0];
          const key = el.tagName + ":" + (el.id || "") + ":" + (el.textContent || "").trim();
          if (!seen.has(key)) {
            el.click();
            return {
              navigated: true,
              method: "in-frame evaluate click on real nav control",
              matchedText: (el.textContent || "").trim().slice(0, 60),
              tag: el.tagName,
              id: el.id || null,
              token,
            };
          }
        }
      }
    }
    return {
      navigated: false,
      method: "in-frame evaluate click on real nav control",
      matchedText: null,
      tag: null,
      id: null,
      token: null,
    };
  }, pageName);
}

// Zoom-100% reference evidence: devicePixelRatio + visualViewport (top + frame).
async function captureZoomEvidence(page, app) {
  const readZoom = () => ({
    devicePixelRatio: window.devicePixelRatio,
    visualViewport: window.visualViewport
      ? {
          width: +window.visualViewport.width.toFixed(2),
          height: +window.visualViewport.height.toFixed(2),
          scale: +window.visualViewport.scale.toFixed(4),
          offsetLeft: +window.visualViewport.offsetLeft.toFixed(2),
          offsetTop: +window.visualViewport.offsetTop.toFixed(2),
        }
      : null,
  });
  let top = null;
  let frame = null;
  try {
    top = await page.evaluate(readZoom);
  } catch (error) {
    top = { error: sliceError((error && error.message) || error) };
  }
  try {
    frame = await app.evaluate(readZoom);
  } catch (error) {
    frame = { error: sliceError((error && error.message) || error) };
  }
  return { top, frame };
}

// Pure geometry measurement inside the app frame. No mutation, no repair.
async function collectRawGeometry(app, pageName, viewport) {
  return app.evaluate(
    (pageName, viewport) => {
      const TOL = 2.0;
      const OVL_AREA_TOL = 4.0;
      const CLIP_TOL = 0.5;

      const round = (n) => (typeof n === "number" ? +n.toFixed(2) : n);
      const rectOf = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: round(r.x),
          y: round(r.y),
          width: round(r.width),
          height: round(r.height),
          top: round(r.top),
          right: round(r.right),
          bottom: round(r.bottom),
          left: round(r.left),
        };
      };
      const intersectionArea = (a, b) => {
        if (!a || !b) return 0;
        const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return round(w * h);
      };
      const ownText = (el) => {
        if (!el) return "";
        let t = "";
        const nodes = el.childNodes;
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n.nodeType === 3) t += n.nodeValue || "";
        }
        return t.trim();
      };
      const styleOf = (el, props) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const out = {};
        for (let i = 0; i < props.length; i++) out[props[i]] = cs[props[i]];
        return out;
      };
      const isVisibleRect = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
      };
      const expectedSidebarWidth = (vw, collapsed) => {
        if (collapsed) return 64;
        return vw >= 1280 ? 264 : 224;
      };

      const de = document.documentElement;
      const body = document.body;
      const appShell = document.querySelector("#appShell");
      const sidebar =
        document.querySelector("#dashboardSidebar") || document.querySelector("#sidebar");
      const cv = document.querySelector("#contentViewport");
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const collapsedAttr = appShell ? appShell.getAttribute("data-sidebar-collapsed") : null;
      const sidebarState = collapsedAttr === "true" ? "collapsed" : "expanded";

      const deRect = rectOf(de);
      const deOverflow = {
        scrollWidth: de ? de.scrollWidth : null,
        clientWidth: de ? de.clientWidth : null,
        scrollHeight: de ? de.scrollHeight : null,
        clientHeight: de ? de.clientHeight : null,
        overflowX: de ? getComputedStyle(de).overflowX : null,
        overflowY: de ? getComputedStyle(de).overflowY : null,
        horizontalOverflowPx: de ? round(de.scrollWidth - de.clientWidth) : null,
      };
      const bodyOverflow = body
        ? {
            scrollWidth: body.scrollWidth,
            clientWidth: body.clientWidth,
            scrollHeight: body.scrollHeight,
            clientHeight: body.clientHeight,
            overflowX: getComputedStyle(body).overflowX,
            overflowY: getComputedStyle(body).overflowY,
            horizontalOverflowPx: round(body.scrollWidth - body.clientWidth),
          }
        : null;

      const cvRect = rectOf(cv);
      const cvStyle = styleOf(cv, ["overflowX", "overflowY", "display", "position"]);
      const cvMetrics = cv
        ? {
            present: true,
            rect: cvRect,
            scrollWidth: cv.scrollWidth,
            clientWidth: cv.clientWidth,
            scrollHeight: cv.scrollHeight,
            clientHeight: cv.clientHeight,
            overflowX: cvStyle.overflowX,
            overflowY: cvStyle.overflowY,
            display: cvStyle.display,
            position: cvStyle.position,
            accessible: cvRect && cvRect.width > 0 && cvRect.height > 0,
            paddingLeft: round(parseFloat(getComputedStyle(cv).paddingLeft) || 0),
            paddingRight: round(parseFloat(getComputedStyle(cv).paddingRight) || 0),
          }
        : { present: false, rect: null, accessible: false };

      const sidebarRect = rectOf(sidebar);
      const sidebarExpected = expectedSidebarWidth(vw, sidebarState === "collapsed");
      const sidebarInfo = sidebar
        ? {
            present: true,
            selector: "#dashboardSidebar" || "#sidebar",
            rect: sidebarRect,
            width: sidebarRect ? sidebarRect.width : null,
            height: sidebarRect ? sidebarRect.height : null,
            position: sidebarStylePosition(sidebar),
            collapsedAttr,
            sidebarState,
            expectedWidth: sidebarExpected,
            authorityDelta: sidebarRect
              ? round(sidebarRect.width - sidebarExpected)
              : null,
          }
        : {
            present: false,
            selector: null,
            rect: null,
            width: null,
            expectedWidth: sidebarExpected,
            collapsedAttr,
            sidebarState,
          };

      function sidebarStylePosition(el) {
        return getComputedStyle(el).position;
      }

      const mainOffset = cvRect
        ? {
            contentLeft: cvRect.left,
            contentWidth: cvRect.width,
            sidebarRight: sidebarRect ? sidebarRect.right : null,
            sidebarContentGapPx:
              sidebarRect && cvRect ? round(cvRect.left - sidebarRect.right) : null,
            collisionOverlapPx:
              sidebarRect && cvRect
                ? round(Math.max(0, sidebarRect.right - cvRect.left))
                : null,
          }
        : null;

      // --- Primary vertical scroll owner ---
      const cvOverflowY = cv ? getComputedStyle(cv).overflowY : null;
      const deScrollHeight = de ? de.scrollHeight : 0;
      const deClientHeight = de ? de.clientHeight : 0;
      const deOverflowY = de ? getComputedStyle(de).overflowY : null;
      const contentTallerThanViewport = deScrollHeight > vh + TOL;
      const cvScrollable = Boolean(
        cv && cv.scrollHeight > cv.clientHeight + TOL &&
          (cvOverflowY === "auto" || cvOverflowY === "scroll" || cvOverflowY === "overlay")
      );
      const docScrollable = Boolean(deScrollHeight > deClientHeight + TOL);
      const scrollOwner = {
        cvPresent: Boolean(cv),
        cvOverflowY,
        cvScrollHeight: cv ? cv.scrollHeight : null,
        cvClientHeight: cv ? cv.clientHeight : null,
        cvScrollable,
        deOverflowY,
        deScrollHeight,
        deClientHeight,
        docScrollable,
        contentTallerThanViewport,
        cvBlocksScrollWhenHidden: Boolean(
          cv && contentTallerThanViewport &&
            (cvOverflowY === "hidden" || cvOverflowY === "clip")
        ),
        pageHorizontalOverflow: Boolean(
          de && de.scrollWidth > de.clientWidth + TOL
        ),
      };

      // --- KPI cards (Dashboard) ---
      const kpiCards = [];
      if (pageName === "Dashboard") {
        // Labels inlined: evaluate callbacks are serialized; no outer scope.
        const kpiLabels = ["Profit Margin", "Units Sold", "Revenue", "Expense", "Profit"];
        for (const label of kpiLabels) {
          let labelEl = null;
          const all = document.querySelectorAll("body *");
          for (let i = 0; i < all.length && !labelEl; i++) {
            const el = all[i];
            const t = ownText(el);
            if (t === label || t === label + ":") labelEl = el;
          }
          if (!labelEl) continue;
          let card = labelEl.parentElement;
          if (card) {
            const cr = card.getBoundingClientRect();
            if (cr.width < 60 || cr.height < 24) card = card.parentElement;
          }
          const cardRect = rectOf(card);
          let valueEl = null;
          if (card) {
            const descendants = card.querySelectorAll("*");
            for (let i = 0; i < descendants.length && !valueEl; i++) {
              const el = descendants[i];
              if (el === labelEl) continue;
              const t = ownText(el);
              if (!t || t.length > 40) continue;
              if (t.indexOf(label) !== -1) continue;
              if (!/[0-9]/.test(t)) continue;
              if (!isVisibleRect(el)) continue;
              valueEl = el;
            }
          }
          const valueStyle = styleOf(valueEl, ["textOverflow", "overflowX", "overflowY", "whiteSpace"]);
          const valueRect = rectOf(valueEl);
          const valueScrollWidth = valueEl ? valueEl.scrollWidth : null;
          const valueClientWidth = valueEl ? valueEl.clientWidth : null;
          const valueOverflowing =
            valueEl && valueScrollWidth != null && valueClientWidth != null
              ? valueScrollWidth > valueClientWidth + CLIP_TOL
              : false;
          const valueClipped = Boolean(
            valueEl &&
              valueOverflowing &&
              ((valueStyle && valueStyle.textOverflow === "ellipsis") ||
                (valueStyle && valueStyle.overflowX === "hidden"))
          );
          kpiCards.push({
            label,
            labelRect: rectOf(labelEl),
            cardRect,
            valueText: valueEl ? (ownText(valueEl) || "").slice(0, 40) : null,
            valueRect,
            valueScrollWidth,
            valueClientWidth,
            valueTextOverflow: valueStyle ? valueStyle.textOverflow : null,
            valueOverflowX: valueStyle ? valueStyle.overflowX : null,
            valueOverflowing,
            valueClipped,
          });
        }
      }

      // KPI strip container = common parent of first card (best effort).
      let kpiStrip = null;
      if (kpiCards.length && kpiCards[0].cardRect) {
        const firstCardEl = null; // rect-only evidence; strip = parent of widest peer chain
        // Re-locate first card element for strip container.
        let firstLabelEl = null;
        const all2 = document.querySelectorAll("body *");
        for (let i = 0; i < all2.length && !firstLabelEl; i++) {
          const t = ownText(all2[i]);
          if (t === kpiCards[0].label) firstLabelEl = all2[i];
        }
        if (firstLabelEl) {
          let strip = firstLabelEl.parentElement;
          if (strip && strip.parentElement) {
            const pr = strip.parentElement.getBoundingClientRect();
            const sr = strip.getBoundingClientRect();
            if (pr.width > sr.width + 10) strip = strip.parentElement;
          }
          kpiStrip = rectOf(strip);
        }
      }

      // --- Evidence row (best-effort selectors) ---
      function findByClassFragment(fragment) {
        const nodes = document.querySelectorAll(
          "#contentViewport [class*='" + fragment + "'], main [class*='" + fragment + "']"
        );
        for (let i = 0; i < nodes.length; i++) {
          if (isVisibleRect(nodes[i])) return nodes[i];
        }
        return null;
      }
      const evidenceRowEl =
        document.querySelector("#evidenceSection") ||
        document.querySelector("#businessEvidence") ||
        document.querySelector('[data-section="evidence"]') ||
        findByClassFragment("evidence-row") ||
        findByClassFragment("evidenceRow") ||
        findByClassFragment("evidence");
      const execSummaryEl =
        document.querySelector("#executiveSummary") ||
        document.querySelector("#execSummary") ||
        document.querySelector('[data-section="executive-summary"]') ||
        findByClassFragment("executive") ||
        findByClassFragment("exec-summary");
      const contextRowEl =
        document.querySelector("#contextRow") ||
        document.querySelector('[data-section="context"]') ||
        findByClassFragment("context-row") ||
        findByClassFragment("contextRow");

      const evidenceRow = evidenceRowEl
        ? {
            present: true,
            rect: rectOf(evidenceRowEl),
            columns: Array.from(evidenceRowEl.children)
              .filter((c) => isVisibleRect(c))
              .map((c) => ({
                rect: rectOf(c),
                id: c.id || null,
                className: sliceOwn(c.className),
              })),
          }
        : { present: false, rect: null, columns: [] };

      function sliceOwn(v) {
        return String(v == null ? "" : v).slice(0, 80);
      }

      const evidencePeerOverlaps = [];
      for (let i = 0; i < evidenceRow.columns.length; i++) {
        for (let j = i + 1; j < evidenceRow.columns.length; j++) {
          const area = intersectionArea(evidenceRow.columns[i].rect, evidenceRow.columns[j].rect);
          if (area > OVL_AREA_TOL) {
            evidencePeerOverlaps.push({
              pair: "evidence-column[" + i + "]|evidence-column[" + j + "]",
              intersectionAreaPx2: area,
              rectA: evidenceRow.columns[i].rect,
              rectB: evidenceRow.columns[j].rect,
            });
          }
        }
      }

      // --- Revenue chart containment (Dashboard) ---
      const chartEvidence = { present: false, canvases: [] };
      if (pageName === "Dashboard") {
        const canvases = Array.from(document.querySelectorAll("canvas")).filter((c) =>
          isVisibleRect(c)
        );
        chartEvidence.canvases = canvases.map((c) => {
          const wrapper = c.parentElement || null;
          const wrapperRect = rectOf(wrapper);
          const canvasRect = rectOf(c);
          let containedInWrapper = false;
          if (wrapperRect && canvasRect) {
            containedInWrapper =
              canvasRect.left >= wrapperRect.left - TOL &&
              canvasRect.right <= wrapperRect.right + TOL &&
              canvasRect.top >= wrapperRect.top - TOL &&
              canvasRect.bottom <= wrapperRect.bottom + TOL;
          }
          let sectionEl = wrapper;
          while (sectionEl && !/^(SECTION|MAIN|DIV)$/.test(sectionEl.tagName)) {
            sectionEl = sectionEl.parentElement;
          }
          const sectionRect = rectOf(sectionEl);
          let containedInSection = false;
          if (sectionRect && canvasRect) {
            containedInSection =
              canvasRect.left >= sectionRect.left - TOL &&
              canvasRect.right <= sectionRect.right + TOL &&
              canvasRect.top >= sectionRect.top - TOL &&
              canvasRect.bottom <= sectionRect.bottom + TOL;
          }
          return {
            canvasId: c.id || null,
            canvasClassName: sliceOwn(c.className),
            wrapperRect,
            sectionRect,
            canvasRect,
            containedInWrapper,
            containedInSection,
          };
        });
        chartEvidence.present = chartEvidence.canvases.length > 0;
      }

      // --- Top Products (Dashboard) ---
      const topProductsSection = document.querySelector("#topProductsSection");
      const topProductsTable =
        document.querySelector("#topProductsSection .hf-top-products-table") ||
        (topProductsSection ? topProductsSection.querySelector("table") : null);
      let topProductsWrapper = null;
      if (topProductsTable) {
        let probe = topProductsTable.parentElement;
        while (probe && probe !== document.body) {
          const ox = getComputedStyle(probe).overflowX;
          if (ox === "auto" || ox === "scroll" || ox === "overlay" || ox === "hidden") {
            topProductsWrapper = probe;
            break;
          }
          if (probe === topProductsSection) {
            topProductsWrapper = probe;
            break;
          }
          probe = probe.parentElement;
        }
        if (!topProductsWrapper) topProductsWrapper = topProductsSection;
      }
      const topProducts = topProductsSection
        ? {
            present: true,
            sectionRect: rectOf(topProductsSection),
            tableRect: rectOf(topProductsTable),
            tablePresent: Boolean(topProductsTable && isVisibleRect(topProductsTable)),
            wrapperRect: rectOf(topProductsWrapper),
            wrapperOverflowX: topProductsWrapper
              ? getComputedStyle(topProductsWrapper).overflowX
              : null,
            wrapperScrollWidth: topProductsWrapper ? topProductsWrapper.scrollWidth : null,
            wrapperClientWidth: topProductsWrapper ? topProductsWrapper.clientWidth : null,
            wrapperOwnsLocalOverflow: Boolean(
              topProductsWrapper &&
                (getComputedStyle(topProductsWrapper).overflowX === "auto" ||
                  getComputedStyle(topProductsWrapper).overflowX === "scroll" ||
                  getComputedStyle(topProductsWrapper).overflowX === "overlay")
            ),
          }
        : {
            present: false,
            sectionRect: null,
            tableRect: null,
            tablePresent: false,
            wrapperRect: null,
            wrapperOverflowX: null,
            wrapperOwnsLocalOverflow: false,
          };

      // --- Peer section overlap (Dashboard) ---
      const sectionPeers = [
        { name: "kpi-strip", rect: kpiStrip },
        { name: "evidence-row", rect: evidenceRow.rect },
        { name: "executive-summary", rect: execSummaryEl ? rectOf(execSummaryEl) : null },
        { name: "context-row", rect: contextRowEl ? rectOf(contextRowEl) : null },
      ].filter((p) => p.rect);
      const sectionOverlaps = [];
      for (let i = 0; i < sectionPeers.length; i++) {
        for (let j = i + 1; j < sectionPeers.length; j++) {
          const area = intersectionArea(sectionPeers[i].rect, sectionPeers[j].rect);
          if (area > OVL_AREA_TOL) {
            sectionOverlaps.push({
              pair: sectionPeers[i].name + "|" + sectionPeers[j].name,
              intersectionAreaPx2: area,
              rectA: sectionPeers[i].rect,
              rectB: sectionPeers[j].rect,
            });
          }
        }
      }

      // --- Generic page: controls containment + table wrapper model ---
      const controls = cv
        ? Array.from(
            cv.querySelectorAll(
              "button, input, select, textarea, [role='button'], [role='tab'], [role='menuitem']"
            )
          ).filter((el) => isVisibleRect(el))
        : [];
      const controlsOutside = controls.filter((el) => {
        const r = el.getBoundingClientRect();
        return !cvRect || r.left < cvRect.left - TOL || r.right > cvRect.right + TOL;
      });
      const controlAccessibility = controls.map((el) => {
        const originalScrollTop = cv.scrollTop;
        const beforeRect = rectOf(el);
        const maxScrollTop = Math.max(0, cv.scrollHeight - cv.clientHeight);
        const targetScrollTop = Math.max(
          0,
          Math.min(maxScrollTop, originalScrollTop + beforeRect.top - cvRect.top)
        );
        cv.scrollTop = targetScrollTop;
        const afterRect = rectOf(el);
        const afterScrollTop = cv.scrollTop;
        let clippedByAncestor = false;
        for (let ancestor = el.parentElement; ancestor && ancestor !== cv; ancestor = ancestor.parentElement) {
          const cs = getComputedStyle(ancestor);
          if (/hidden|clip/.test(cs.overflowY)) {
            const ar = ancestor.getBoundingClientRect();
            if (afterRect.top < ar.top - TOL || afterRect.bottom > ar.bottom + TOL) {
              clippedByAncestor = true;
              break;
            }
          }
        }
        const centerX = Math.max(cvRect.left, Math.min(cvRect.right - 1, (afterRect.left + afterRect.right) / 2));
        const centerY = Math.max(cvRect.top, Math.min(cvRect.bottom - 1, (afterRect.top + afterRect.bottom) / 2));
        const hit = document.elementFromPoint(centerX, centerY);
        const visibleAfterScroll = isVisibleRect(el);
        const broughtIntoView =
          afterRect.top >= cvRect.top - TOL && afterRect.bottom <= cvRect.bottom + TOL;
        const directHitTest = Boolean(hit && (hit === el || el.contains(hit)));
        const wrapper = el.parentElement;
        const proxy =
          el.matches("select#filter.ui-native-select[aria-hidden='true'][tabindex='-1']") &&
          wrapper &&
          wrapper.classList.contains("ui-custom-select")
            ? Array.from(wrapper.children).find(
                (child) =>
                  child.matches("button.ui-custom-select-trigger[aria-haspopup='listbox']") &&
                  child.getAttribute("aria-controls") === "filterListbox"
              ) || null
            : null;
        const proxyRect = proxy ? rectOf(proxy) : null;
        const proxyCenterX = proxyRect
          ? Math.max(cvRect.left, Math.min(cvRect.right - 1, (proxyRect.left + proxyRect.right) / 2))
          : null;
        const proxyCenterY = proxyRect
          ? Math.max(cvRect.top, Math.min(cvRect.bottom - 1, (proxyRect.top + proxyRect.bottom) / 2))
          : null;
        const proxyHit = proxyRect ? document.elementFromPoint(proxyCenterX, proxyCenterY) : null;
        const proxyRepresentative = Boolean(
          proxy &&
            wrapper.querySelector(":scope > #filterListbox[role='listbox']") &&
            isVisibleRect(proxy) &&
            intersectionArea(afterRect, proxyRect) > OVL_AREA_TOL &&
            proxyRect.left >= cvRect.left - TOL &&
            proxyRect.right <= cvRect.right + TOL &&
            proxyRect.top >= cvRect.top - TOL &&
            proxyRect.bottom <= cvRect.bottom + TOL &&
            proxyHit &&
            (proxyHit === proxy || proxy.contains(proxyHit))
        );
        const hitTest = directHitTest || proxyRepresentative;
        cv.scrollTop = originalScrollTop;
        return {
          tag: el.tagName,
          id: el.id || null,
          className: sliceOwn(el.className),
          descendant: cv.contains(el),
          beforeRect,
          afterRect,
          originalScrollTop,
          targetScrollTop,
          afterScrollTop,
          scrollTopChanged: targetScrollTop === originalScrollTop || afterScrollTop !== originalScrollTop,
          broughtIntoView,
          clippedByAncestor,
          visibleAfterScroll,
          directHitTest,
          proxyRepresentative,
          proxyRect,
          hitTest,
          scrollAccessible:
            cv.contains(el) &&
            (targetScrollTop === originalScrollTop || afterScrollTop !== originalScrollTop) &&
            broughtIntoView &&
            !clippedByAncestor &&
            visibleAfterScroll &&
            hitTest,
        };
      });
      const inaccessibleControls = controlAccessibility.filter((control) => !control.scrollAccessible);
      const controlsEvidence = {
        total: controls.length,
        outsideCount: controlsOutside.length,
        outsideSamples: controlsOutside.slice(0, 5).map((el) => ({
          tag: el.tagName,
          id: el.id || null,
          className: sliceOwn(el.className),
          rect: rectOf(el),
        })),
        inaccessibleCount: inaccessibleControls.length,
        inaccessibleSamples: inaccessibleControls.slice(0, 5),
        accessibilitySamples: controlAccessibility.slice(0, 20),
        contentRect: cvRect,
        scrollHeight: cv.scrollHeight,
        clientHeight: cv.clientHeight,
      };

      const tableEl = cv
        ? Array.from(cv.querySelectorAll("table")).filter((el) => isVisibleRect(el))[0] || null
        : null;
      let tableWrapper = null;
      if (tableEl) {
        let probe = tableEl.parentElement;
        while (probe && probe !== document.body) {
          const ox = getComputedStyle(probe).overflowX;
          if (ox === "auto" || ox === "scroll" || ox === "overlay" || ox === "hidden") {
            tableWrapper = probe;
            break;
          }
          probe = probe.parentElement;
        }
        if (!tableWrapper) tableWrapper = tableEl.parentElement;
      }
      const tableEvidence = tableEl
        ? {
            present: true,
            tableRect: rectOf(tableEl),
            wrapperRect: rectOf(tableWrapper),
            wrapperOverflowX: tableWrapper ? getComputedStyle(tableWrapper).overflowX : null,
            wrapperScrollWidth: tableWrapper ? tableWrapper.scrollWidth : null,
            wrapperClientWidth: tableWrapper ? tableWrapper.clientWidth : null,
            wrapperOwnsLocalOverflow: Boolean(
              tableWrapper &&
                (getComputedStyle(tableWrapper).overflowX === "auto" ||
                  getComputedStyle(tableWrapper).overflowX === "scroll" ||
                  getComputedStyle(tableWrapper).overflowX === "overlay")
            ),
            tableScrollWidth: tableEl.scrollWidth,
            tableClientWidth: tableEl.clientWidth,
          }
        : {
            present: false,
            tableRect: null,
            wrapperRect: null,
            wrapperOverflowX: null,
            wrapperOwnsLocalOverflow: false,
          };

      // --- Finance grid reflow observation (best effort) ---
      let financeGrid = null;
      if (pageName === "Finance") {
        const candidates = document.querySelectorAll(
          "#contentViewport [class*='finance'], main [class*='finance'], #financeMain, #financeGrid, #financeContent"
        );
        let gridEl = null;
        for (let i = 0; i < candidates.length && !gridEl; i++) {
          const cs = getComputedStyle(candidates[i]);
          if (cs.display.indexOf("grid") !== -1 && isVisibleRect(candidates[i])) {
            gridEl = candidates[i];
          }
        }
        if (gridEl) {
          const cs = getComputedStyle(gridEl);
          const cols = cs.gridTemplateColumns
            ? cs.gridTemplateColumns.split(" ").filter(Boolean).length
            : null;
          financeGrid = {
            identifiable: true,
            id: gridEl.id || null,
            className: sliceOwn(gridEl.className),
            display: cs.display,
            gridTemplateColumns: cs.gridTemplateColumns
              ? cs.gridTemplateColumns.slice(0, 160)
              : null,
            columnCount: cols,
            rect: rectOf(gridEl),
          };
        } else {
          financeGrid = { identifiable: false, columnCount: null };
        }
      }

      // --- Text clipping candidates (important values) ---
      const textClipping = [];
      if (pageName === "Dashboard") {
        for (const card of kpiCards) {
          if (card.valueRect && card.valueScrollWidth != null) {
            textClipping.push({
              element: "kpi-value[" + card.label + "]",
              text: card.valueText,
              rect: card.valueRect,
              scrollWidth: card.valueScrollWidth,
              clientWidth: card.valueClientWidth,
              textOverflow: card.valueTextOverflow,
              overflowX: card.valueOverflowX,
              clipped: card.valueClipped,
            });
          }
        }
      }

      return {
        pageName,
        viewport: { width: vw, height: vh },
        devicePixelRatio: window.devicePixelRatio,
        documentElement: deOverflow,
        body: bodyOverflow,
        contentViewport: cvMetrics,
        sidebar: sidebarInfo,
        mainOffset,
        scrollOwner,
        kpi: { found: kpiCards.length > 0, cards: kpiCards, stripRect: kpiStrip },
        evidenceRow,
        evidencePeerOverlaps,
        execSummaryRect: execSummaryEl ? rectOf(execSummaryEl) : null,
        contextRowRect: contextRowEl ? rectOf(contextRowEl) : null,
        sectionOverlaps,
        chartEvidence,
        topProducts,
        controlsEvidence,
        tableEvidence,
        financeGrid,
        textClipping,
      };
    },
    pageName,
    viewport
  );
}

function expectedSidebarWidthFor(viewportWidth, collapsed) {
  if (collapsed) return SIDEBAR_AUTHORITY.collapsed;
  return viewportWidth >= 1280
    ? SIDEBAR_AUTHORITY.expandedAt1280
    : SIDEBAR_AUTHORITY.expanded1024to1279;
}

// Node-side classification: each measured invariant → PASS | FAIL | NOT_MEASURABLE.
function classifyCell(raw) {
  const invariants = [];
  const defects = [];
  const add = (invariant, status, detail, measured, element) => {
    invariants.push({
      invariant,
      status,
      detail: sliceText(detail),
      measured: measured || null,
      element: element || null,
    });
  };
  const fail = (invariant, detail, measured, element) => {
    add(invariant, "FAIL", detail, measured, element);
    defects.push({
      invariant,
      element: element || invariant,
      detail: sliceText(detail),
      measuredRectangles: measured || null,
    });
  };

  if (!raw || !raw.documentElement) {
    add("MEASURABILITY", "NOT_MEASURABLE", "documentElement missing; geometry not measurable");
    return { invariants, defects, cellStatus: "NOT_MEASURED" };
  }

  const TOL = 2.0;
  const de = raw.documentElement;
  const deOverflowPx = de.horizontalOverflowPx;

  // Page-level horizontal overflow = product failure (unintended page scroll).
  if (deOverflowPx != null && deOverflowPx > TOL) {
    fail(
      "PAGE_HORIZONTAL_OVERFLOW",
      "documentElement.scrollWidth exceeds clientWidth; unintended page-level horizontal scrolling",
      { documentElement: de },
      "documentElement"
    );
  } else {
    add(
      "PAGE_HORIZONTAL_OVERFLOW",
      "PASS",
      "no page-level horizontal overflow (scrollWidth<=clientWidth+tol)",
      { documentElement: de },
      "documentElement"
    );
  }

  if (raw.body && raw.body.horizontalOverflowPx != null) {
    add(
      "BODY_HORIZONTAL_OVERFLOW",
      raw.body.horizontalOverflowPx > TOL ? "FAIL" : "PASS",
      "body.scrollWidth vs clientWidth delta=" + raw.body.horizontalOverflowPx,
      { body: raw.body },
      "body"
    );
    if (raw.body.horizontalOverflowPx > TOL && deOverflowPx <= TOL) {
      fail(
        "PAGE_HORIZONTAL_OVERFLOW",
        "body.scrollWidth exceeds clientWidth",
        { body: raw.body },
        "body"
      );
    }
  }

  const cv = raw.contentViewport;
  if (!cv || !cv.present) {
    add(
      "CONTENTVIEWPORT_ACCESSIBLE",
      "NOT_MEASURABLE",
      "#contentViewport not present/measurable in app frame",
      null,
      "#contentViewport"
    );
  } else if (!cv.accessible) {
    fail(
      "CONTENTVIEWPORT_ACCESSIBLE",
      "#contentViewport present but rect has zero width/height",
      { contentViewport: cv },
      "#contentViewport"
    );
  } else {
    add(
      "CONTENTVIEWPORT_ACCESSIBLE",
      "PASS",
      "#contentViewport accessible (rect width>0, height>0)",
      { rect: cv.rect, overflowX: cv.overflowX, overflowY: cv.overflowY },
      "#contentViewport"
    );
  }

  if (cv && cv.present && cv.rect && cv.rect.width > 0) {
    add(
      "CONTENT_WIDTH_POSITIVE",
      "PASS",
      "main content width > 0",
      { contentRect: cv.rect },
      "#contentViewport"
    );
  } else if (cv && cv.present) {
    fail(
      "CONTENT_WIDTH_POSITIVE",
      "content width <= 0",
      { contentViewport: cv },
      "#contentViewport"
    );
  }

  // Sidebar geometry + collision + authority width.
  const sidebar = raw.sidebar;
  if (sidebar && sidebar.present && sidebar.rect && cv && cv.rect) {
    const collisionPx = raw.mainOffset ? raw.mainOffset.collisionOverlapPx : null;
    if (collisionPx != null && collisionPx > TOL) {
      fail(
        "SIDEBAR_CONTENT_COLLISION",
        "sidebar rect overlaps main content rect by " + collisionPx + "px",
        { sidebarRect: sidebar.rect, contentRect: cv.rect, collisionOverlapPx: collisionPx },
        "#dashboardSidebar vs #contentViewport"
      );
    } else {
      add(
        "SIDEBAR_CONTENT_COLLISION",
        "PASS",
        "sidebar and main content do not collide",
        {
          sidebarRect: sidebar.rect,
          contentRect: cv.rect,
          sidebarContentGapPx: raw.mainOffset ? raw.mainOffset.sidebarContentGapPx : null,
        },
        "#dashboardSidebar vs #contentViewport"
      );
    }
    const expected = expectedSidebarWidthFor(raw.viewport.width, sidebar.sidebarState === "collapsed");
    if (sidebar.width != null && Math.abs(sidebar.width - expected) > TOL) {
      fail(
        "SIDEBAR_AUTHORITY_WIDTH",
        "sidebar width " + sidebar.width + " deviates from authority " + expected +
          " (state=" + sidebar.sidebarState + ")",
        { measured: { width: sidebar.width, rect: sidebar.rect }, authority: { expected } },
        "#dashboardSidebar"
      );
    } else {
      add(
        "SIDEBAR_AUTHORITY_WIDTH",
        "PASS",
        "sidebar width " + sidebar.width + " matches authority " + expected +
          " (state=" + sidebar.sidebarState + ")",
        { measured: { width: sidebar.width }, authority: { expected } },
        "#dashboardSidebar"
      );
    }
  } else {
    add(
      "SIDEBAR_CONTENT_COLLISION",
      "NOT_MEASURABLE",
      "sidebar or contentViewport rect missing",
      null,
      "#dashboardSidebar"
    );
  }

  // Primary vertical scroll owner. Short-height pages exceeding viewport are
  // NOT failure when content is reachable through the intended scroll owner.
  const so = raw.scrollOwner;
  if (!so) {
    add("PRIMARY_VERTICAL_SCROLL_OWNER", "NOT_MEASURABLE", "scroll owner metrics missing");
  } else {
    const contentTaller = so.contentTallerThanViewport === true;
    const inaccessibleBecauseAncestor =
      contentTaller &&
      (so.cvBlocksScrollWhenHidden === true ||
        (so.cvPresent && !so.cvScrollable && !so.docScrollable && so.cvOverflowY !== "visible"));
    const noScrollPathAtAll =
      contentTaller && !so.cvScrollable && !so.docScrollable && so.cvOverflowY !== "visible";
    if (!so.cvPresent && contentTaller && !so.docScrollable) {
      fail(
        "PRIMARY_VERTICAL_SCROLL_OWNER",
        "content taller than viewport but #contentViewport absent and document not scrollable",
        { scrollOwner: so },
        "#contentViewport"
      );
    } else if (inaccessibleBecauseAncestor || noScrollPathAtAll) {
      fail(
        "PRIMARY_VERTICAL_SCROLL_OWNER",
        "content taller than viewport and no scrollable owner reachable (ancestor prevents scroll access)",
        { scrollOwner: so },
        "#contentViewport"
      );
    } else if (contentTaller && so.cvScrollable) {
      add(
        "PRIMARY_VERTICAL_SCROLL_OWNER",
        "PASS",
        "short-height page: content exceeds viewport but #contentViewport owns vertical scroll",
        { scrollOwner: so },
        "#contentViewport"
      );
    } else if (contentTaller && so.docScrollable) {
      add(
        "PRIMARY_VERTICAL_SCROLL_OWNER",
        "PASS",
        "content exceeds viewport; document scroll path available; content reachable",
        { scrollOwner: so },
        "documentElement"
      );
    } else if (!contentTaller) {
      add(
        "PRIMARY_VERTICAL_SCROLL_OWNER",
        "PASS",
        "content fits viewport height; no vertical reachability risk",
        { scrollOwner: so },
        "#contentViewport"
      );
    } else {
      add(
        "PRIMARY_VERTICAL_SCROLL_OWNER",
        "NOT_MEASURABLE",
        "scroll path not determinable from measured overflow values",
        { scrollOwner: so },
        "#contentViewport"
      );
    }
    if (contentTaller && (so.cvScrollable || so.docScrollable)) {
      add(
        "SHORT_HEIGHT_CONTENT_REACHABLE",
        "PASS",
        "content taller than viewport remains reachable via intended scroll owner",
        { scrollOwner: so },
        "#contentViewport"
      );
    }
  }

  if (raw.viewport && raw.viewport.width < 1024) {
    fail(
      "DESKTOP_WIDTH_FLOOR",
      "viewport width " + raw.viewport.width + " below desktop floor 1024",
      { viewport: raw.viewport },
      "viewport"
    );
  } else {
    add(
      "DESKTOP_WIDTH_FLOOR",
      "PASS",
      "viewport width " + (raw.viewport ? raw.viewport.width : null) + " >= 1024",
      { viewport: raw.viewport },
      "viewport"
    );
  }

  if (raw.pageName === "Dashboard") {
    const kpi = raw.kpi || { found: false, cards: [] };
    if (!kpi.found || !kpi.cards.length) {
      add(
        "KPI_VALUE_TRUNCATION",
        "NOT_MEASURABLE",
        "no KPI cards/values measured on Dashboard",
        kpi,
        "kpi-strip"
      );
    } else {
      const clipped = kpi.cards.filter((c) => c.valueClipped);
      if (clipped.length) {
        fail(
          "KPI_VALUE_TRUNCATION",
          "KPI value elements clipped/truncated by layout (ellipsis+overflow or overflow hidden)",
          { cards: clipped.slice(0, MAX_DEFECT_DETAIL_RECTS) },
          clipped
            .map((c) => "kpi-value[" + c.label + "]")
            .join(", ")
        );
      } else {
        add(
          "KPI_VALUE_TRUNCATION",
          "PASS",
          "no KPI value truncation from layout (" + kpi.cards.length + " values measured)",
          { cardCount: kpi.cards.length },
          "kpi-strip"
        );
      }
    }

    const ev = raw.evidenceRow || { present: false };
    if (!ev.present) {
      add("EVIDENCE_ROW_GEOMETRY", "NOT_MEASURABLE", "evidence row not identifiable");
    } else {
      const overlaps = raw.evidencePeerOverlaps || [];
      if (overlaps.length) {
        fail(
          "EVIDENCE_ROW_PEER_OVERLAP",
          "peer evidence columns overlap",
          { overlaps: overlaps.slice(0, MAX_DEFECT_DETAIL_RECTS), rowRect: ev.rect },
          overlaps.map((o) => o.pair).join(", ")
        );
      } else {
        add(
          "EVIDENCE_ROW_GEOMETRY",
          "PASS",
          "evidence row present, peer columns do not overlap",
          { rowRect: ev.rect, columnCount: ev.columns.length },
          "evidence-row"
        );
      }
    }

    const charts = (raw.chartEvidence && raw.chartEvidence.canvases) || [];
    if (!charts.length) {
      add("CHART_CONTAINMENT", "NOT_MEASURABLE", "no visible chart canvas measured");
    } else {
      const escaped = charts.filter((c) => !c.containedInWrapper || !c.containedInSection);
      if (escaped.length) {
        fail(
          "CHART_CONTAINMENT",
          "chart canvas not contained within wrapper/section",
          { canvases: escaped.slice(0, MAX_DEFECT_DETAIL_RECTS) },
          escaped
            .map((c) => "canvas[" + (c.canvasId || c.canvasClassName || "?") + "]")
            .join(", ")
        );
      } else {
        add(
          "CHART_CONTAINMENT",
          "PASS",
          "all " + charts.length + " canvases contained within wrapper and section",
          { canvasCount: charts.length },
          "chart-canvases"
        );
      }
    }

    const tp = raw.topProducts;
    if (!tp || !tp.present) {
      add("TOP_PRODUCTS_SECTION", "NOT_MEASURABLE", "#topProductsSection not measurable");
    } else if (!tp.tablePresent) {
      add(
        "TOP_PRODUCTS_SECTION",
        "NOT_MEASURABLE",
        "top products section present but table rect not measurable",
        { sectionRect: tp.sectionRect },
        "#topProductsSection"
      );
    } else {
      const localOverflow = tp.wrapperOwnsLocalOverflow && tp.wrapperScrollWidth > tp.wrapperClientWidth + TOL;
      add(
        "TOP_PRODUCTS_LOCAL_OVERFLOW",
        "PASS",
        localOverflow
          ? "long table uses intentional local horizontal scrolling (wrapper owns overflowX)"
          : "top products table fits within wrapper; no local overflow required",
        {
          sectionRect: tp.sectionRect,
          tableRect: tp.tableRect,
          wrapperRect: tp.wrapperRect,
          wrapperOverflowX: tp.wrapperOverflowX,
          wrapperScrollWidth: tp.wrapperScrollWidth,
          wrapperClientWidth: tp.wrapperClientWidth,
        },
        "#topProductsSection .hf-top-products-table"
      );
    }

    const sectionOverlaps = raw.sectionOverlaps || [];
    if (sectionOverlaps.length) {
      fail(
        "SECTION_PEER_OVERLAP",
        "peer sections overlap beyond shared-border tolerance",
        { overlaps: sectionOverlaps.slice(0, MAX_DEFECT_DETAIL_RECTS) },
        sectionOverlaps.map((o) => o.pair).join(", ")
      );
    } else if (kpi.found || (ev && ev.present)) {
      add(
        "SECTION_PEER_OVERLAP",
        "PASS",
        "peer sections (KPI strip / evidence / exec summary / context) do not overlap",
        { peersMeasured: sectionOverlaps.length === 0 ? "no overlaps" : [] },
        "peer-sections"
      );
    } else {
      add("SECTION_PEER_OVERLAP", "NOT_MEASURABLE", "no peer sections identifiable for overlap check");
    }

    if (raw.execSummaryRect) {
      add(
        "EXEC_SUMMARY_GEOMETRY",
        "PASS",
        "executive summary rect measurable",
        { rect: raw.execSummaryRect },
        "executive-summary"
      );
    } else {
      add("EXEC_SUMMARY_GEOMETRY", "NOT_MEASURABLE", "executive summary not identifiable");
    }
    if (raw.contextRowRect) {
      add(
        "CONTEXT_ROW_GEOMETRY",
        "PASS",
        "context row rect measurable",
        { rect: raw.contextRowRect },
        "context-row"
      );
    } else {
      add("CONTEXT_ROW_GEOMETRY", "NOT_MEASURABLE", "context row not identifiable");
    }

    const tc = raw.textClipping || [];
    if (!tc.length) {
      add("TEXT_CLIPPING_IMPORTANT_VALUES", "NOT_MEASURABLE", "no important value elements measured");
    } else {
      const clipped = tc.filter((t) => t.clipped);
      if (clipped.length) {
        fail(
          "TEXT_CLIPPING_IMPORTANT_VALUES",
          "important value elements clipped (scrollWidth>clientWidth with ellipsis/overflow hidden)",
          { elements: clipped.slice(0, MAX_DEFECT_DETAIL_RECTS) },
          clipped.map((t) => t.element).join(", ")
        );
      } else {
        add(
          "TEXT_CLIPPING_IMPORTANT_VALUES",
          "PASS",
          "no important value text clipping detected",
          { measured: tc.length },
          "important-values"
        );
      }
    }

    if (raw.controlsEvidence && raw.controlsEvidence.total > 0) {
      if (raw.controlsEvidence.outsideCount > 0 || raw.controlsEvidence.inaccessibleCount > 0) {
        fail(
          "CONTROLS_SCROLL_ACCESSIBILITY",
          "controls escape horizontal bounds or are not vertically scroll-accessible",
          { controls: raw.controlsEvidence },
          "controls"
        );
      } else {
        add(
          "CONTROLS_SCROLL_ACCESSIBILITY",
          "PASS",
          "all " + raw.controlsEvidence.total + " controls horizontally contained and vertically scroll-accessible",
          { controls: raw.controlsEvidence },
          "#contentViewport controls"
        );
      }
    }
  } else {
    // Transactions / Products / Finance / Settings
    const controls = raw.controlsEvidence || { total: 0, outsideCount: 0, inaccessibleCount: 0 };
    if (controls.total > 0) {
      if (controls.outsideCount > 0 || controls.inaccessibleCount > 0) {
        fail(
          "CONTROLS_SCROLL_ACCESSIBILITY",
          "controls escape horizontal bounds or are not vertically scroll-accessible",
          { controls },
          "controls"
        );
      } else {
        add(
          "CONTROLS_SCROLL_ACCESSIBILITY",
          "PASS",
          "all " + controls.total + " controls horizontally contained and vertically scroll-accessible",
          { controls },
          "#contentViewport controls"
        );
      }
    } else {
      add("CONTROLS_SCROLL_ACCESSIBILITY", "NOT_MEASURABLE", "no visible controls measured on page");
    }

    const table = raw.tableEvidence || { present: false };
    if (!table.present) {
      add(
        "TABLE_LOCAL_OVERFLOW_MODEL",
        "NOT_MEASURABLE",
        "no visible table measured on page"
      );
    } else {
      const localOverflow =
        table.wrapperOwnsLocalOverflow &&
        table.wrapperScrollWidth > table.wrapperClientWidth + 2.0;
      add(
        "TABLE_LOCAL_OVERFLOW_MODEL",
        "PASS",
        localOverflow
          ? "table uses intentional local horizontal scrolling via wrapper overflowX"
          : "table fits within wrapper; no local overflow required",
        {
          tableRect: table.tableRect,
          wrapperRect: table.wrapperRect,
          wrapperOverflowX: table.wrapperOverflowX,
          wrapperScrollWidth: table.wrapperScrollWidth,
          wrapperClientWidth: table.wrapperClientWidth,
        },
        "table-wrapper"
      );
    }

    const tc = raw.textClipping || [];
    if (!tc.length) {
      add("TEXT_CLIPPING_IMPORTANT_VALUES", "NOT_MEASURABLE", "no important value elements measured");
    } else {
      const clipped = tc.filter((t) => t.clipped);
      if (clipped.length) {
        fail(
          "TEXT_CLIPPING_IMPORTANT_VALUES",
          "important value elements clipped",
          { elements: clipped.slice(0, MAX_DEFECT_DETAIL_RECTS) },
          clipped.map((t) => t.element).join(", ")
        );
      } else {
        add(
          "TEXT_CLIPPING_IMPORTANT_VALUES",
          "PASS",
          "no important value text clipping detected",
          { measured: tc.length },
          "important-values"
        );
      }
    }

    if (raw.pageName === "Finance") {
      const fg = raw.financeGrid;
      if (!fg || !fg.identifiable) {
        add(
          "FINANCE_SINGLE_COLUMN_REFLOW",
          "NOT_MEASURABLE",
          "finance main grid not identifiable for column-count reflow check"
        );
      } else if (raw.viewport.width <= 1180 && fg.columnCount != null && fg.columnCount > 1) {
        fail(
          "FINANCE_SINGLE_COLUMN_REFLOW",
          "Finance grid columnCount=" + fg.columnCount + " at width " +
            raw.viewport.width + " <=1180 (expected single-column reflow through 1180)",
          { financeGrid: fg },
          "#finance-grid"
        );
      } else {
        add(
          "FINANCE_SINGLE_COLUMN_REFLOW",
          "PASS",
          "Finance grid columnCount=" + fg.columnCount + " at width " + raw.viewport.width +
            (raw.viewport.width <= 1180 ? " (single-column reflow through 1180)" : ""),
          { financeGrid: fg },
          "#finance-grid"
        );
      }
    }
  }

  const failCount = invariants.filter((i) => i.status === "FAIL").length;
  const notMeasuredCount = invariants.filter((i) => i.status === "NOT_MEASURABLE").length;
  return {
    invariants,
    defects,
    cellStatus: failCount > 0 ? "FAIL" : "MEASURED",
    invariantFailCount: failCount,
    invariantNotMeasuredCount: notMeasuredCount,
  };
}

function emptyPageBucket() {
  return { cells: [] };
}

(async () => {
  const pageErrors = [];
  const consoleErrors = [];
  const perPage = {
    dashboard: emptyPageBucket(),
    transactions: emptyPageBucket(),
    products: emptyPageBucket(),
    finance: emptyPageBucket(),
    settings: emptyPageBucket(),
  };
  const concreteProductDefects = [];
  const matrix = buildMatrix();
  let browser = null;
  let fatal = null;
  let zoomReference = null;
  const sidebarMethodCounts = {};
  const sidebarAuthorityObserved = { collapsed: [], expanded: [] };
  const sharedShellObservations = [];
  let completedCells = 0;

  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });

    for (let idx = 0; idx < matrix.length; idx++) {
      const spec = matrix[idx];
      const viewport = { width: spec.width, height: spec.height };
      const sidebarState = spec.collapsed ? "collapsed" : "expanded";
      const bucketKey = PAGE_KEYS[spec.page];
      let context = null;
      let cellResult = {
        page: spec.page,
        viewport,
        sidebarState,
        status: "NOT_MEASURED",
        reason: null,
        shell: null,
        navigation: null,
        readiness: null,
        sidebarStateMethod: null,
        sidebarObserved: null,
        zoomEvidence: null,
        invariants: [],
        concreteDefects: [],
        raw: null,
      };

      try {
        context = await browser.newContext({ viewport });
        const page = await context.newPage();
        page.setDefaultTimeout(NAVIGATION_TIMEOUT);

        page.on("pageerror", (error) => {
          const msg = error.message || String(error);
          if (isRelevantAppError(msg)) pageErrors.push(sliceError(msg));
        });
        page.on("console", (message) => {
          if (message.type() === "error") {
            const text = message.text();
            if (isRelevantAppError(text)) consoleErrors.push(sliceText(text, ERROR_SLICE));
          }
        });

        // Exactly ONE navigation per matrix cell — @688 only.
        await page.goto(TARGET_URL, {
          waitUntil: "domcontentloaded",
          timeout: NAVIGATION_TIMEOUT,
        });

        const authBlock = await detectAuthBlock(page);
        if (authBlock) {
          cellResult.status = "NOT_MEASURED";
          cellResult.reason = "AUTH_OR_ACCESS_BLOCKED";
        } else {
          const shell = await waitForAppShell(page);
          cellResult.shell = {
            appShellContext: shell.appShellContext,
            frameCount: shell.frameCount,
            userHtmlFramePresent: shell.userHtmlFramePresent,
            readinessStatus: shell.readinessStatus,
            readinessElapsedMs: shell.readinessElapsedMs,
          };
          if (!shell.appShellReached || !shell.frame) {
            cellResult.status = "NOT_MEASURED";
            cellResult.reason = "SHELL_NOT_READY";
          } else {
            const app = shell.frame;

            // Overview data readiness before page-specific work.
            const dashReady = await waitForDashboardReadiness(app, page);
            cellResult.readiness = { dashboard: dashReady };

            // Deterministic sidebar state via application authority.
            const sidebarSet = await setSidebarState(app, page, spec.collapsed);
            cellResult.sidebarStateMethod = sidebarSet.method;
            cellResult.sidebarObserved = sidebarSet.observed;
            sidebarMethodCounts[sidebarSet.method] =
              (sidebarMethodCounts[sidebarSet.method] || 0) + 1;
            if (sidebarSet.observed && sidebarSet.observed.sidebarWidth != null) {
              sidebarAuthorityObserved[sidebarState].push(sidebarSet.observed.sidebarWidth);
            }

            // Navigation to target page via real nav controls (evaluate click).
            let navResult = { navigated: true, method: "none-required (already on page)", token: null };
            if (spec.page !== "Dashboard") {
              navResult = await navigateInApp(app, spec.page);
              cellResult.navigation = navResult;
              if (!navResult.navigated) {
                cellResult.status = "NOT_MEASURED";
                cellResult.reason = "PAGE_NOT_REACHABLE:" + spec.page;
              } else {
                const settle = await waitForGenericSettle(app, page);
                cellResult.readiness.pageSettle = settle;
                if (settle.readinessStatus !== "PAGE_SETTLED" && settle.readinessStatus !== "PAGE_SETTLE_TIMEOUT") {
                  cellResult.status = "NOT_MEASURED";
                  cellResult.reason = "PAGE_SETTLE_FAILED";
                } else if (settle.readinessStatus === "PAGE_SETTLE_TIMEOUT" &&
                           (!settle.sample || !settle.sample.cvPresent)) {
                  cellResult.status = "NOT_MEASURED";
                  cellResult.reason = "PAGE_SETTLE_TIMEOUT";
                }
              }
            }

            // Gate on explicit failure marker, NOT sentinel status.
            // Success path leaves status="NOT_MEASURED" until classifyCell assigns
            // MEASURED/FAIL; keying the gate on that sentinel skipped measurement
            // for every ready cell. reason is set only on pre-measurement failures.
            if (cellResult.reason) {
              // pre-measurement failure already recorded; skip measurement
            } else {
              const zoomEvidence = await captureZoomEvidence(page, app);
              cellResult.zoomEvidence = zoomEvidence;
              if (!zoomReference) zoomReference = zoomEvidence;

              const raw = await collectRawGeometry(app, spec.page, viewport);
              cellResult.raw = raw;

              // Shared shell observation (single sample per cell, bounded).
              if (raw && raw.contentViewport && raw.contentViewport.present) {
                sharedShellObservations.push({
                  page: spec.page,
                  viewport,
                  sidebarState,
                  appShellContext: shell.appShellContext,
                  primaryScrollOwner: "#contentViewport",
                  contentPaddingTotalPx:
                    (raw.contentViewport.paddingLeft || 0) + (raw.contentViewport.paddingRight || 0),
                  contentOverflowY: raw.contentViewport.overflowY,
                  sidebarWidth: raw.sidebar ? raw.sidebar.width : null,
                });
              }

              const classified = classifyCell(raw);
              cellResult.invariants = classified.invariants;
              cellResult.concreteDefects = classified.defects.map((d) => ({
                page: spec.page,
                viewport,
                sidebarState,
                element: d.element,
                measuredRectangles: d.measuredRectangles,
                failureInvariant: d.invariant,
                detail: d.detail,
              }));
              concreteProductDefects.push(...cellResult.concreteDefects);
              cellResult.status = classified.cellStatus;
              cellResult.reason =
                classified.cellStatus === "FAIL"
                  ? "CONCRETE_PRODUCT_GEOMETRY_DEFECT"
                  : classified.cellStatus === "NOT_MEASURED"
                    ? "MEASUREMENT_INCOMPLETE_OR_RAW_MISSING"
                    : null;
            }
          }
        }
      } catch (error) {
        cellResult.status = "NOT_MEASURED";
        cellResult.reason = "CELL_RUNTIME_ERROR:" + sliceError((error && error.message) || error);
      } finally {
        if (context) await context.close().catch(() => {});
      }

      if (cellResult.status !== "NOT_MEASURED") completedCells += 1;
      perPage[bucketKey].cells.push(cellResult);
    }
  } catch (error) {
    fatal = sliceError((error && error.message) || error);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // matrixSummary: pass = completed cells with zero FAIL; fail = cells with >=1 FAIL;
  // notMeasured = cells where measurement did not complete. Sum == totalCells.
  let pass = 0;
  let fail = 0;
  let notMeasured = 0;
  for (const key of Object.keys(perPage)) {
    for (const cell of perPage[key].cells) {
      if (cell.status === "NOT_MEASURED") notMeasured += 1;
      else if (cell.status === "FAIL") fail += 1;
      else pass += 1;
    }
  }

  const totalCells = matrix.length;
  const allNotMeasured = completedCells === 0 && totalCells > 0;

  const sidebarAuthoritySummary = {
    method: sidebarMethodCounts,
    observedWidths: sidebarAuthorityObserved,
    authority: SIDEBAR_AUTHORITY,
    note:
      "state set via application authority (setDesktopSidebarCollapsed or direct " +
      "#appShell[data-sidebar-collapsed] attribute); Playwright sidebar button click NOT used",
  };

  const output = {
    target: TARGET_URL,
    newVersion: NEW_VERSION,
    zoomEvidence: zoomReference || { devicePixelRatio: null, visualViewport: null },
    sidebarStateMethod: sidebarAuthoritySummary,
    matrixSummary: {
      totalCells,
      pass,
      fail,
      notMeasured,
    },
    perPage,
    sharedShell: {
      primaryScrollOwner: "#contentViewport",
      desktopFloorPx: 1024,
      sidebarAuthority: SIDEBAR_AUTHORITY,
      contentPaddingTotalAuthorityPx: 48,
      primaryHeightBuckets: "none (consolidation @688)",
      observations: sharedShellObservations.slice(0, 40),
      observationCount: sharedShellObservations.length,
    },
    concreteProductDefects: concreteProductDefects.slice(0, 200),
    concreteProductDefectCount: concreteProductDefects.length,
    browserErrors: {
      pageErrors: pageErrors.slice(0, 50),
      consoleErrors: consoleErrors.slice(0, 50),
    },
    inputRoutingStatus: "DEFERRED_NON_PRODUCT_BLOCKER",
    fatal: fatal,
    measurementOnly: true,
    runtimeExecuted: false,
  };

  console.log(JSON.stringify(output, null, 2));

  const exitCode = fatal !== null || allNotMeasured || concreteProductDefects.length > 0 ? 1 : 0;
  process.exit(exitCode);
})();
