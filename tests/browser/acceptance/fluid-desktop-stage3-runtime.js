#!/usr/bin/env node
/**
 * NUMLOCK Fluid Desktop Stage3 — Runtime Acceptance Harness
 *
 * Read-only acceptance against an explicit validation target.
 * Target resolution: CLI argument, then NUMLOCK_VALIDATION_URL.
 *   node tests/browser/fluid-desktop-stage3-runtime.js <url>
 *   NUMLOCK_VALIDATION_URL=<url> node tests/browser/fluid-desktop-stage3-runtime.js
 * Exit: 0 only when overall == PASS. stdout JSON only. No evidence writes.
 */

const { chromium } = require("playwright");

const TARGET_URL = process.argv[2] || process.env.NUMLOCK_VALIDATION_URL;
if (!TARGET_URL) {
  console.error("Usage: node tests/browser/fluid-desktop-stage3-runtime.js <url>");
  console.error("  or: NUMLOCK_VALIDATION_URL=<url> node tests/browser/fluid-desktop-stage3-runtime.js");
  process.exit(2);
}
const TARGET_DEPLOYMENT_ID = (TARGET_URL.match(/\/s\/([^/]+)\/exec(?:[?#]|$)/) || [])[1] || null;

const TIMEOUT = 60_000;
const BOOTSTRAP_MS = 1_000; // non-authority post-navigation settle only; shell gate = waitForAppShell
const SHELL_READY_TIMEOUT_MS = 15_000; // bounded shell readiness deadline (10s–15s band)
const SHELL_READY_POLL_MS = 200; // modest bounded poll interval
const SETTLE_MS = 450; // bounded transition/resize settling window — no polling loop
const TOL = 1.5; // subpixel rendering tolerance only

// Family A — bounded Dashboard Overview data-readiness gate (distinct from
// KPI acceptance labels in evaluateCase — readiness authority only).
const OVERVIEW_READY_TIMEOUT_MS = 15_000; // max 15000ms bounded readiness deadline
const OVERVIEW_READY_POLL_MS = 200; // bounded poll interval (100–250ms band)
const OVERVIEW_READY_KPI_LABELS = ["Revenue", "Expense", "Profit", "Profit Margin", "Units Sold"];

// Family D — bounded authoritative sidebar-state marker wait
const SIDEBAR_STATE_TIMEOUT_MS = 5_000; // max 5000ms bounded state-marker deadline
const SIDEBAR_STATE_POLL_MS = 150; // bounded poll interval (100–250ms band)

// Family D — bounded pre-click geometry stability gate (OPTION_B).
// Separate budget from SIDEBAR_STATE_TIMEOUT_MS; do not merge or increase 5000.
const PRECLICK_TIMEOUT_MS = 1_000; // pre-click geometry deadline
const REQUIRED_STABLE_SAMPLES = 3; // consecutive rAF-separated stable samples
const PRECLICK_RECT_TOLERANCE_PX = 0.5; // subpixel rect stability tolerance
const PRECLICK_MAX_RETAINED_SAMPLES = 5; // bounded lastSamples evidence

// Family D — bounded post-STATE_READY rendered-width stability gate.
// SIDEBAR_STATE_READY = app state authority changed, NOT rendered width final.
// Width acceptance asserts only after rendered #dashboardSidebar width reaches
// the expected authority (sidebarAuthority) within the existing acceptance
// tolerance AND remains stable for REQUIRED_STABLE_SAMPLES consecutive samples.
const SIDEBAR_WIDTH_STABILITY_TIMEOUT_MS = 1_500; // bounded rendered-width settle deadline
const SIDEBAR_WIDTH_ACCEPTANCE_TOLERANCE_PX = 1; // matches existing sidebar width acceptance band

const WIDTH_CASES = [
  { id: "WIDE", width: 1680, height: 900 },
  { id: "INTERMEDIATE", width: 1440, height: 900 },
  { id: "MID", width: 1280, height: 900 },
  { id: "COMPACT_DESKTOP", width: 1250, height: 900 },
  { id: "NEAR_THRESHOLD", width: 1024, height: 900 },
];
const SIDEBAR_CASE_WIDTHS = [1680, 1280, 1250, 1024];
const HEIGHT_CASES = [
  { id: "H1680x900", width: 1680, height: 900 },
  { id: "H1680x800", width: 1680, height: 800 },
  { id: "H1680x700", width: 1680, height: 700 },
  { id: "H1280x900", width: 1280, height: 900 },
  { id: "H1280x700", width: 1280, height: 700 },
];

function sidebarAuthority(width, collapsed) {
  if (collapsed) return 64;
  return width >= 1280 ? 264 : 224;
}

// ---- assertion model: PASS / FAIL / UNVERIFIED per acceptance item --------
const assertions = [];
function record(id, category, status, detail, required) {
  assertions.push({
    id,
    category,
    status,
    detail: String(detail || "").slice(0, 300),
    required: required !== false,
  });
  return status;
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
    "dashboard",
    "overview",
    "kpi",
    "revenue",
    "evidence",
    "top products",
    "topproducts",
    "executive",
    "chart",
    "render",
    "numlock",
    "userhtmlframe",
  ];
  return relevant.some((r) => t.includes(r));
}

async function detectAuthBlock(page) {
  const url = page.url();
  if (/accounts\.google\.com|ServiceLogin|signin|oauth/i.test(url)) return true;
  const loginUi = await page
    .locator('input[type="email"], input[type="password"], a[href*="accounts.google.com"]')
    .count()
    .catch(() => 0);
  return loginUi > 0;
}

// Transient lookup misses (frame detach, context teardown) may continue during
// the bounded readiness interval. Unexpected errors rethrow — observable via
// harness fatal/diagnostic result, never converted to NOT_FOUND.
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

// ATTACHED = locator count > 0. VISIBLE = first().isVisible(). Both required.
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

// Bounded explicit shell readiness wait. Frame set REACQUIRED every attempt —
// userHtmlFrame may attach asynchronously after navigation. Inspects:
// 1. top-level #appShell, 2. reacquire page.frames(), 3. find userHtmlFrame,
// 4. inspect #appShell in that frame. Returns immediately when shell is
// attached AND visible (top-level OR userHtmlFrame). Otherwise retries only
// until bounded deadline. On deadline expiry returns structured TIMEOUT
// evidence — never fabricates success.
async function waitForAppShell(page, timeoutMs = SHELL_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + timeoutMs;
  let last = {
    appShellReached: false,
    appShellAttached: false,
    appShellVisible: false,
    appShellContext: "NOT_FOUND",
    frameCount: 0,
    userHtmlFramePresent: false,
    frame: null,
    readinessStatus: "NOT_FOUND",
    readinessElapsedMs: 0,
  };
  for (;;) {
    const frames = page.frames(); // reacquire — no stale frame capture
    const frameCount = frames.length;
    const userHtmlFrame = frames.find((f) => f.name() === "userHtmlFrame") || null;
    const userHtmlFramePresent = Boolean(userHtmlFrame);

    const top = await inspectAppShell(page);
    if (top.attached && top.visible) {
      return {
        appShellReached: true,
        appShellAttached: true,
        appShellVisible: true,
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
          appShellAttached: true,
          appShellVisible: true,
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
      appShellAttached: frameState ? frameState.attached : top.attached,
      appShellVisible: frameState ? frameState.visible : top.visible,
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

// ---- page-side measurement (executes inside Apps Script userHtmlFrame) -----
const MEASURE_OVERVIEW = () => {
  const tol = 1.5;
  const q = (sel) => document.querySelector(sel);
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const overlaps = (a, b) =>
    Boolean(a && b) &&
    a.left < b.right - tol &&
    b.left < a.right - tol &&
    a.top < b.bottom - tol &&
    b.top < a.bottom - tol;
  const contained = (child, parent) =>
    Boolean(child && parent) &&
    child.left >= parent.left - tol &&
    child.right <= parent.right + tol &&
    child.top >= parent.top - tol &&
    child.bottom <= parent.bottom + tol;

  const appShell = q("#appShell");
  const mainContent = q("#mainContent");
  const contentViewport = q("#contentViewport");
  const sidebar = q("#dashboardSidebar");
  const panel = q("#dashboardPanelOverview");
  const kpiStrip = q("#businessOverview");
  const evidenceRow = q("#overviewEvidenceRow");
  const revenuePanel = q("#revenueChartSection");
  const topProductsPanel = q("#topProductsSection");
  const chartWrapper = q("#mainChartWrapper");
  const contextRow = q("#overviewContextRow");
  const execSummary = q("#executiveSummarySection");
  const topProductsTable = q("#topProductsSection .hf-top-products-table");

  const cards = Array.from(document.querySelectorAll("#businessOverview .hf-kpi-card")).map((card) => {
    const labelEl = card.querySelector(".hf-section-label");
    const valueEl = card.querySelector(".overview-kpi-value");
    const comparisonEl = card.querySelector(".hf-kpi-comparison");
    const cr = r(card);
    const vr = r(valueEl);
    const kr = r(comparisonEl);
    const valueText = valueEl ? valueEl.textContent.trim() : "";
    const valueStyle = valueEl ? window.getComputedStyle(valueEl) : null;
    return {
      label: labelEl ? labelEl.textContent.trim() : "",
      valueText,
      valueFontSize: valueStyle ? parseFloat(valueStyle.fontSize) : null,
      valueTextWrap: valueStyle ? valueStyle.textWrap : null,
      valueEllipsis: valueStyle ? valueStyle.textOverflow === "ellipsis" : null,
      valueContained: vr && cr ? contained(vr, cr) : false,
      valueOverlapsComparison: overlaps(vr, kr),
      valueClipped: vr && cr ? vr.width > cr.width + tol || vr.height > cr.height + tol : false,
      cardConnected: Boolean(card.isConnected),
    };
  });

  const evidenceRect = r(evidenceRow);
  const revenueRect = r(revenuePanel);
  const topProductsRect = r(topProductsPanel);
  const chartRect = r(chartWrapper);
  const contextRect = r(contextRow);
  const execRect = r(execSummary);
  const kpiRect = r(kpiStrip);
  const tableRect = r(topProductsTable);

  let evidenceLayout = "UNKNOWN";
  if (revenueRect && topProductsRect) {
    evidenceLayout =
      Math.abs(revenueRect.top - topProductsRect.top) < 40 ? "SIDE_BY_SIDE" : "STACKED";
  }

  const chartStyle = chartWrapper ? window.getComputedStyle(chartWrapper) : null;
  const chartCanvases = Array.from(document.querySelectorAll("#mainChartWrapper canvas"));
  const tpTableStyle = topProductsTable ? window.getComputedStyle(topProductsTable) : null;
  const stripStyle = kpiStrip ? window.getComputedStyle(kpiStrip) : null;
  const stripColumns = stripStyle ? stripStyle.gridTemplateColumns.split(/\s+/).map(Number) : [];
  const docEl = document.documentElement;
  const body = document.body;

  return {
    sidebar: {
      width: sidebar ? sidebar.getBoundingClientRect().width : null,
      collapsedAttr: appShell ? appShell.getAttribute("data-sidebar-collapsed") : null,
      connected: Boolean(sidebar && sidebar.isConnected && appShell && appShell.isConnected),
    },
    kpi: {
      stripConnected: Boolean(kpiStrip && kpiStrip.isConnected),
      stripColumns,
      stripMinColumnOk: stripColumns.length > 0 && stripColumns.every((w) => w >= 245 - tol),
      cards,
    },
    evidence: {
      rowWidth: evidenceRect ? evidenceRect.width : null,
      rowConnected: Boolean(evidenceRow && evidenceRow.isConnected),
      layout: evidenceLayout,
      revenueRect: revenueRect
        ? { left: revenueRect.left, top: revenueRect.top, width: revenueRect.width, height: revenueRect.height, right: revenueRect.right, bottom: revenueRect.bottom }
        : null,
      topProductsRect: topProductsRect
        ? { left: topProductsRect.left, top: topProductsRect.top, width: topProductsRect.width, height: topProductsRect.height, right: topProductsRect.right, bottom: topProductsRect.bottom }
        : null,
      revenueOverlapsTopProducts: overlaps(revenueRect, topProductsRect),
      revenueEscapesEvidenceRow: revenueRect && evidenceRect ? !contained(revenueRect, evidenceRect) : null,
      topProductsEscapesEvidenceRow: topProductsRect && evidenceRect ? !contained(topProductsRect, evidenceRect) : null,
    },
    chart: {
      wrapperRect: chartRect
        ? { left: chartRect.left, top: chartRect.top, width: chartRect.width, height: chartRect.height, right: chartRect.right, bottom: chartRect.bottom }
        : null,
      wrapperHeight: chartRect ? chartRect.height : null,
      wrapperComputedHeight: chartStyle ? chartStyle.height : null,
      canvasCount: chartCanvases.length,
      canvasConnected: chartCanvases.every((c) => c.isConnected),
      canvasUsable: chartCanvases.every((c) => c.width > 0 && c.height > 0),
      containedByRevenuePanel: chartRect && revenueRect ? contained(chartRect, revenueRect) : null,
      overlapsTopProducts: overlaps(chartRect, topProductsRect),
      escapesEvidenceRow: chartRect && evidenceRect ? !contained(chartRect, evidenceRect) : null,
      positiveGeometry: Boolean(chartRect && chartRect.width > 0 && chartRect.height > 0),
    },
    topProducts: {
      sectionConnected: Boolean(topProductsPanel && topProductsPanel.isConnected),
      sectionOverflowX: topProductsPanel ? window.getComputedStyle(topProductsPanel).overflowX : null,
      tableWidth: tableRect ? tableRect.width : null,
      tableComputedWidth: tpTableStyle ? tpTableStyle.width : null,
      tableMinWidth: tpTableStyle ? tpTableStyle.minWidth : null,
      tableScrollWidth: topProductsTable ? topProductsTable.scrollWidth : null,
      sectionClientWidth: topProductsPanel ? topProductsPanel.clientWidth : null,
      containedInSection:
        tableRect && topProductsPanel ? contained(tableRect, r(topProductsPanel)) : null,
      escapesRevenue: overlaps(tableRect, revenueRect),
      tableConnected: Boolean(topProductsTable && topProductsTable.isConnected),
    },
    contextSummary: {
      kpiTop: kpiRect ? kpiRect.top : null,
      evidenceTop: evidenceRect ? evidenceRect.top : null,
      contextTop: contextRect ? contextRect.top : null,
      execTop: execRect ? execRect.top : null,
      kpiOverlapsEvidence: overlaps(kpiRect, evidenceRect),
      evidenceOverlapsContext: overlaps(evidenceRect, contextRect),
      contextOverlapsExec: overlaps(contextRect, execRect),
      contextConnected: Boolean(contextRow && contextRow.isConnected),
      execConnected: Boolean(execSummary && execSummary.isConnected),
      panelGridRows: panel ? window.getComputedStyle(panel).gridTemplateRows : null,
    },
    scroll: {
      docClientHeight: docEl.clientHeight,
      docScrollHeight: docEl.scrollHeight,
      docClientWidth: docEl.clientWidth,
      docScrollWidth: docEl.scrollWidth,
      bodyClientHeight: body.clientHeight,
      bodyScrollHeight: body.scrollHeight,
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      appShellClientHeight: appShell ? appShell.clientHeight : null,
      appShellScrollHeight: appShell ? appShell.scrollHeight : null,
      mainContentClientHeight: mainContent ? mainContent.clientHeight : null,
      mainContentScrollHeight: mainContent ? mainContent.scrollHeight : null,
      contentViewportClientHeight: contentViewport ? contentViewport.clientHeight : null,
      contentViewportScrollHeight: contentViewport ? contentViewport.scrollHeight : null,
      contentViewportClientWidth: contentViewport ? contentViewport.clientWidth : null,
      contentViewportScrollWidth: contentViewport ? contentViewport.scrollWidth : null,
      contentViewportOverflowY: contentViewport ? window.getComputedStyle(contentViewport).overflowY : null,
      contentViewportOverflowX: contentViewport ? window.getComputedStyle(contentViewport).overflowX : null,
      appShellHeight: appShell ? window.getComputedStyle(appShell).height : null,
    },
    pageLevelHorizontalOverflow:
      docEl.scrollWidth > docEl.clientWidth + tol || body.scrollWidth > body.clientWidth + tol,
  };
};

const MEASURE_CONNECTED = () => {
  const ids = [
    "appShell",
    "mainContent",
    "contentViewport",
    "dashboardSidebar",
    "dashboardPanelOverview",
    "businessOverview",
    "overviewEvidenceRow",
    "overviewContextRow",
    "executiveSummarySection",
    "revenueChartSection",
    "topProductsSection",
    "mainChartWrapper",
  ];
  return ids.map((id) => {
    const el = document.getElementById(id);
    return { id, present: Boolean(el), connected: Boolean(el && el.isConnected) };
  });
};

const MEASURE_OVERVIEW_CONSUMERS = () => {
  const has = (sel) => Boolean(document.querySelector(sel));
  return {
    periodComparison: has("#periodComparisonSection"),
    dataQuality: has("#dataQualityInformation"),
    kpiTargetDetailsButton: has("#kpiTargetDetailsButton"),
    topProductsContainer: has("#topProductsSection .hf-top-products-table"),
    chartCanvases: document.querySelectorAll("#mainChartWrapper canvas").length,
    evidenceRow: has("#overviewEvidenceRow"),
    executiveSummary: has("#executiveSummary"),
    kpiCards: document.querySelectorAll("#businessOverview .hf-kpi-card").length,
  };
};

const MEASURE_PERFORMANCE_CONSUMERS = () => {
  const panel = document.querySelector("#dashboardPanelPerformance");
  if (!panel) return { panelPresent: false, expense: 0, diagnosis: 0, forecast: 0 };
  const count = (re) => panel.querySelectorAll(re).length;
  return {
    panelPresent: true,
    expense: count('[id*="expense" i]'),
    diagnosis: count('[id*="diagnos" i]'),
    forecast: count('[id*="forecast" i]'),
  };
};

const MEASURE_CHART_AFTER_RESIZE = () => {
  const tol = 1.5;
  const section = document.querySelector("#revenueChartSection");
  const wrapper = document.querySelector("#mainChartWrapper");
  const canvas = wrapper ? wrapper.querySelector("canvas") : null;
  const sr = section ? section.getBoundingClientRect() : null;
  const wr = wrapper ? wrapper.getBoundingClientRect() : null;
  return {
    wrapperConnected: Boolean(wrapper && wrapper.isConnected),
    wrapperHeight: wr ? wr.height : null,
    contained:
      wr && sr
        ? wr.left >= sr.left - tol && wr.right <= sr.right + tol && wr.top >= sr.top - tol && wr.bottom <= sr.bottom + tol
        : null,
    canvasUsable: Boolean(canvas && canvas.isConnected && canvas.width > 0 && canvas.height > 0),
  };
};

// ---- Node-side per-case evaluation -----------------------------------------
function evaluateCase(caseId, width, height, m, extra) {
  const tol = TOL;
  const extraInfo = extra || {};

  // KPI acceptance
  const cardResults = (m.kpi.cards || []).map((card) => {
    const ellipsisChar = card.valueText.includes("…") || card.valueText.includes("...");
    const fontSizeOk =
      card.valueFontSize === null || (card.valueFontSize >= 18 - tol && card.valueFontSize <= 23 + tol);
    const balancedWrap = card.valueTextWrap === "balance";
    const ok =
      card.valueText.length > 0 &&
      !ellipsisChar &&
      card.valueEllipsis !== true &&
      card.valueContained === true &&
      card.valueOverlapsComparison === false &&
      card.valueClipped === false &&
      fontSizeOk &&
      balancedWrap === false &&
      card.cardConnected === true;
    return {
      label: card.label,
      valueText: String(card.valueText || "").slice(0, 60),
      fontSize: card.valueFontSize,
      textWrap: card.valueTextWrap,
      contained: card.valueContained,
      overlapsComparison: card.valueOverlapsComparison,
      clipped: card.valueClipped,
      status: ok ? "PASS" : "FAIL",
    };
  });
  const requiredLabels = ["Revenue", "Expense", "Profit"];
  const requiredLabelsOk = requiredLabels.every((l) =>
    cardResults.some((c) => c.label === l && c.status === "PASS")
  );
  const kpiStatus =
    cardResults.length > 0 && cardResults.every((c) => c.status === "PASS") && requiredLabelsOk
      ? "PASS"
      : "FAIL";
  const kpiDetail = JSON.stringify({
    cards: cardResults,
    stripMinColumnOk: m.kpi.stripMinColumnOk,
    stripColumns: m.kpi.stripColumns,
    requiredLabelsOk,
    reflowNote: "additional rows at narrower widths are valid",
  });

  // Evidence row — reconciled desktop Stage 3 contract (OPTION_1):
  // SIDE_BY_SIDE_ONLY_FOR_REACHABLE_DESKTOP_DOMAIN. DESKTOP_MIN_VIEWPORT=1024,
  // reachable Evidence width min=752 > 657. <=657 STACKED is non-desktop/future
  // behavior and is NOT a required Stage 3 desktop gate.
  const ev = m.evidence;
  const rowWidth = ev.rowWidth;
  const expectedLayout = "SIDE_BY_SIDE"; // desktop reachable-domain authority
  const layoutOk = typeof rowWidth === "number" && ev.layout === expectedLayout;
  const pageHorizontalOverflowOk = m.pageLevelHorizontalOverflow === false;
  const evidenceCoreOk =
    ev.rowConnected === true &&
    layoutOk &&
    pageHorizontalOverflowOk &&
    ev.revenueOverlapsTopProducts === false &&
    ev.revenueEscapesEvidenceRow !== true &&
    ev.topProductsEscapesEvidenceRow !== true;
  const evidenceStatus = evidenceCoreOk ? "PASS" : "FAIL";
  const evidenceDetail = JSON.stringify({
    rowWidth,
    layout: ev.layout,
    expectedLayout,
    contract: "OPTION_1_SIDE_BY_SIDE_ONLY_FOR_REACHABLE_DESKTOP_DOMAIN",
    revenueOverlapsTopProducts: ev.revenueOverlapsTopProducts,
    revenueEscapesEvidenceRow: ev.revenueEscapesEvidenceRow,
    topProductsEscapesEvidenceRow: ev.topProductsEscapesEvidenceRow,
    pageLevelHorizontalOverflow: m.pageLevelHorizontalOverflow,
    le657Relevant: typeof rowWidth === "number" ? rowWidth <= 657 : null,
  });

  // Top Products containment (local horizontal overflow permitted)
  const tp = m.topProducts;
  const tpMinWidthOk =
    typeof tp.tableMinWidth === "string" ? tp.tableMinWidth.indexOf("320") !== -1 : false;
  const localOverflowPermitted = tp.sectionOverflowX === "auto" || tp.sectionOverflowX === "scroll";
  const tableAccessible =
    tp.tableConnected === true &&
    tp.tableWidth !== null &&
    (tp.containedInSection === true || (tp.tableScrollWidth > tp.sectionClientWidth && localOverflowPermitted));
  const tpStatus =
    tp.sectionConnected === true &&
    tableAccessible &&
    tpMinWidthOk &&
    tp.escapesRevenue === false &&
    m.pageLevelHorizontalOverflow === false
      ? "PASS"
      : "FAIL";
  const tpDetail = JSON.stringify({
    tableWidth: tp.tableWidth,
    tableMinWidth: tp.tableMinWidth,
    tableScrollWidth: tp.tableScrollWidth,
    sectionClientWidth: tp.sectionClientWidth,
    sectionOverflowX: tp.sectionOverflowX,
    containedInSection: tp.containedInSection,
    localOverflowPermitted,
    escapesRevenue: tp.escapesRevenue,
  });

  // Revenue chart contract
  const ch = m.chart;
  const heightInClamp =
    ch.wrapperHeight === null
      ? false
      : ch.wrapperHeight >= 240 - tol && ch.wrapperHeight <= 320 + tol;
  const chartStatus =
    ch.canvasCount > 0 &&
    ch.canvasConnected === true &&
    ch.canvasUsable === true &&
    ch.containedByRevenuePanel === true &&
    ch.overlapsTopProducts === false &&
    ch.escapesEvidenceRow !== true &&
    ch.positiveGeometry === true &&
    heightInClamp === true
      ? "PASS"
      : "FAIL";
  const chartDetail = JSON.stringify({
    canvasCount: ch.canvasCount,
    canvasUsable: ch.canvasUsable,
    wrapperHeight: ch.wrapperHeight,
    wrapperComputedHeight: ch.wrapperComputedHeight,
    heightInClamp,
    containedByRevenuePanel: ch.containedByRevenuePanel,
    overlapsTopProducts: ch.overlapsTopProducts,
    escapesEvidenceRow: ch.escapesEvidenceRow,
  });

  // Context + Executive Summary ordering
  const cs = m.contextSummary;
  const tops = [cs.kpiTop, cs.evidenceTop, cs.contextTop, cs.execTop];
  const orderingOk =
    tops.every((t) => typeof t === "number") &&
    cs.kpiTop <= cs.evidenceTop + tol &&
    cs.evidenceTop <= cs.contextTop + tol &&
    cs.contextTop <= cs.execTop + tol;
  const contextStatus =
    orderingOk &&
    cs.kpiOverlapsEvidence === false &&
    cs.evidenceOverlapsContext === false &&
    cs.contextOverlapsExec === false &&
    cs.contextConnected === true &&
    cs.execConnected === true
      ? "PASS"
      : "FAIL";
  const contextDetail = JSON.stringify({
    tops,
    kpiOverlapsEvidence: cs.kpiOverlapsEvidence,
    evidenceOverlapsContext: cs.evidenceOverlapsContext,
    contextOverlapsExec: cs.contextOverlapsExec,
    panelGridRows: cs.panelGridRows,
  });

  // Scroll ownership
  const s = m.scroll;
  const contentOwnsVertical = s.contentViewportOverflowY === "auto" || s.contentViewportOverflowY === "scroll";
  const contentExceeds = s.contentViewportScrollHeight > s.contentViewportClientHeight + tol;
  const docExceeds = s.docScrollHeight > s.docClientHeight + tol;
  const docIsSoleVerticalOwner = docExceeds && !contentExceeds;
  const scrollOk =
    contentOwnsVertical === true &&
    m.pageLevelHorizontalOverflow === false &&
    docIsSoleVerticalOwner === false &&
    s.contentViewportOverflowX === "hidden";
  const scrollStatus = scrollOk ? "PASS" : "FAIL";
  const scrollDetail = JSON.stringify({
    docClientHeight: s.docClientHeight,
    docScrollHeight: s.docScrollHeight,
    docClientWidth: s.docClientWidth,
    docScrollWidth: s.docScrollWidth,
    bodyClientHeight: s.bodyClientHeight,
    bodyScrollHeight: s.bodyScrollHeight,
    bodyClientWidth: s.bodyClientWidth,
    bodyScrollWidth: s.bodyScrollWidth,
    appShellClientHeight: s.appShellClientHeight,
    appShellScrollHeight: s.appShellScrollHeight,
    appShellHeight: s.appShellHeight,
    mainContentClientHeight: s.mainContentClientHeight,
    mainContentScrollHeight: s.mainContentScrollHeight,
    contentViewportClientHeight: s.contentViewportClientHeight,
    contentViewportScrollHeight: s.contentViewportScrollHeight,
    contentViewportClientWidth: s.contentViewportClientWidth,
    contentViewportScrollWidth: s.contentViewportScrollWidth,
    contentViewportOverflowY: s.contentViewportOverflowY,
    contentViewportOverflowX: s.contentViewportOverflowX,
    contentExceeds,
    docExceeds,
    docIsSoleVerticalOwner,
    pageLevelHorizontalOverflow: m.pageLevelHorizontalOverflow,
  });

  // Height continuity: no overlap, no clipping of key regions, scroll preserved
  const heightContinuityStatus =
    kpiStatus === "PASS" &&
    evidenceStatus === "PASS" &&
    chartStatus === "PASS" &&
    contextStatus === "PASS" &&
    scrollStatus === "PASS" &&
    m.pageLevelHorizontalOverflow === false
      ? "PASS"
      : "FAIL";
  const heightContinuityDetail = JSON.stringify({
    note: "continuous/adaptive contract; fixed pixel heights not required",
    kpiStatus,
    evidenceStatus,
    chartStatus,
    contextStatus,
    scrollStatus,
  });

  return {
    caseId,
    width,
    height,
    extraInfo,
    kpi: { status: kpiStatus, detail: kpiDetail, cards: cardResults },
    evidence: {
      status: evidenceStatus,
      detail: evidenceDetail,
      rowWidth,
      layout: ev.layout,
      expectedLayout,
    },
    topProducts: { status: tpStatus, detail: tpDetail },
    chart: { status: chartStatus, detail: chartDetail },
    contextSummary: { status: contextStatus, detail: contextDetail },
    scroll: { status: scrollStatus, detail: scrollDetail },
    heightContinuity: { status: heightContinuityStatus, detail: heightContinuityDetail },
  };
}

function absorbMeasurements(entry, buckets) {
  record(`${entry.caseId}:kpi`, "KPI", entry.kpi.status, entry.kpi.detail);
  buckets.kpiCases.push({ caseId: entry.caseId, width: entry.width, height: entry.height, status: entry.kpi.status, cards: entry.kpi.cards, detail: entry.kpi.detail });
  record(`${entry.caseId}:evidence`, "EVIDENCE_THRESHOLD", entry.evidence.status, entry.evidence.detail);
  buckets.evidenceThresholdCases.push({
    caseId: entry.caseId,
    width: entry.width,
    rowWidth: entry.evidence.rowWidth,
    layout: entry.evidence.layout,
    expectedLayout: entry.evidence.expectedLayout,
    status: entry.evidence.status,
  });
  record(`${entry.caseId}:top_products`, "TOP_PRODUCTS", entry.topProducts.status, entry.topProducts.detail);
  buckets.topProductsCases.push({ caseId: entry.caseId, status: entry.topProducts.status, detail: entry.topProducts.detail });
  record(`${entry.caseId}:chart`, "CHART", entry.chart.status, entry.chart.detail);
  buckets.chartCases.push({ caseId: entry.caseId, status: entry.chart.status, detail: entry.chart.detail });
  record(`${entry.caseId}:context_summary`, "CONTEXT_SUMMARY", entry.contextSummary.status, entry.contextSummary.detail);
  buckets.contextSummaryCases.push({ caseId: entry.caseId, status: entry.contextSummary.status, detail: entry.contextSummary.detail });
  record(`${entry.caseId}:scroll_ownership`, "SCROLL_OWNERSHIP", entry.scroll.status, entry.scroll.detail);
  buckets.scrollCases.push({ caseId: entry.caseId, status: entry.scroll.status, detail: entry.scroll.detail });
}

async function ensureOverview(app, page) {
  await app
    .locator('[data-navigation-destination="dashboard"]')
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  await app
    .locator("#dashboardTabOverview")
    .click()
    .catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  await app
    .locator("#businessOverview")
    .waitFor({ state: "visible", timeout: TIMEOUT })
    .catch(() => {});
}

// Family A — bounded Dashboard Overview data-readiness gate.
// Requires BOTH: (1) KPI semantic readiness (expected label set present), (2)
// Top Products table rendered. `#businessOverview` visible is NOT sufficient.
// On timeout: structured evidence only — never fabricates populated state.
async function waitForOverviewDataReady(app, page, timeoutMs = OVERVIEW_READY_TIMEOUT_MS) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + timeoutMs;
  let last = {
    readinessStatus: "NOT_READY",
    kpiCount: null,
    kpiLabels: [],
    kpiLabelsReady: false,
    expectedKpiLabels: OVERVIEW_READY_KPI_LABELS,
    topProductsTablePresent: false,
    elapsedMs: 0,
  };
  for (;;) {
    const sample = await app
      .evaluate(() => {
        const cards = Array.from(document.querySelectorAll("#businessOverview .hf-kpi-card"));
        const kpiLabels = cards
          .map((card) => {
            const el = card.querySelector(".hf-section-label");
            return el ? el.textContent.trim() : "";
          })
          .filter(Boolean);
        return {
          kpiCount: cards.length,
          kpiLabels,
          topProductsTablePresent: Boolean(
            document.querySelector("#topProductsSection .hf-top-products-table")
          ),
        };
      })
      .catch((error) => {
        if (isTransientShellLookupError(error)) return null;
        throw error;
      });
    if (sample) {
      const kpiLabelsReady = OVERVIEW_READY_KPI_LABELS.every((l) =>
        sample.kpiLabels.includes(l)
      );
      last = {
        readinessStatus: "NOT_READY",
        kpiCount: sample.kpiCount,
        kpiLabels: sample.kpiLabels,
        kpiLabelsReady,
        expectedKpiLabels: OVERVIEW_READY_KPI_LABELS,
        topProductsTablePresent: Boolean(sample.topProductsTablePresent),
        elapsedMs: Date.now() - startedAt,
      };
      if (kpiLabelsReady && sample.topProductsTablePresent) {
        last.readinessStatus = "OVERVIEW_DATA_READY";
        return last;
      }
    }
    if (Date.now() >= deadlineAt) {
      last.readinessStatus = "OVERVIEW_DATA_READINESS_TIMEOUT";
      last.elapsedMs = Date.now() - startedAt;
      return last;
    }
    await page.waitForTimeout(OVERVIEW_READY_POLL_MS);
  }
}

// Family D — bounded pre-click geometry stability gate (OPTION_B).
// Transient hit-target/rect movement can redirect trusted Playwright clicks;
// require 3 rAF-separated stable samples before the single locator.click().
// Actual click remains normal Playwright locator.click() — no synthetic input.
async function waitForSidebarPreclickGeometryStable(app, timeoutMs = PRECLICK_TIMEOUT_MS) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + timeoutMs;
  const lastSamples = [];
  let sampleCount = 0;
  let stableSampleCount = 0;
  let prevRect = null;

  const sampleButton = async () => {
    return await app.evaluate(() => {
      const btn = document.getElementById("sidebarCollapseButton");
      if (!btn) return { valid: false, hit: "NONE" };
      const connected = Boolean(btn.isConnected);
      const rect = btn.getBoundingClientRect();
      const x = rect.x;
      const y = rect.y;
      const width = rect.width;
      const height = rect.height;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const finite =
        Number.isFinite(x) && Number.isFinite(y) &&
        Number.isFinite(width) && Number.isFinite(height) &&
        Number.isFinite(centerX) && Number.isFinite(centerY);
      const hitAt = (px, py) => {
        const el = document.elementFromPoint(px, py);
        if (!el) return "NONE";
        if (el === btn) return "SIDEBAR_COLLAPSE_BUTTON";
        if (btn.contains(el)) return "BUTTON_DESCENDANT";
        return "OTHER";
      };
      // Rect-center first. Collapsed-layout center can fall into
      // #contentViewport hit-test territory — legitimate visible-control
      // fallback: clamp a probe point inside button ∩ visible sidebar bounds.
      let hit = "NONE";
      let hitPoint = null;
      if (finite && width > 0 && height > 0) {
        hit = hitAt(centerX, centerY);
        if (hit !== "SIDEBAR_COLLAPSE_BUTTON" && hit !== "BUTTON_DESCENDANT") {
          const sidebar = document.getElementById("dashboardSidebar");
          const sr = sidebar ? sidebar.getBoundingClientRect() : null;
          const visLeft = sr ? Math.max(x, sr.left) : x;
          const visTop = sr ? Math.max(y, sr.top) : y;
          const visRight = sr ? Math.min(x + width, sr.right) : x + width;
          const visBottom = sr ? Math.min(y + height, sr.bottom) : y + height;
          if (visRight > visLeft && visBottom > visTop) {
            const fx = (visLeft + visRight) / 2;
            const fy = (visTop + visBottom) / 2;
            const fallbackHit = hitAt(fx, fy);
            if (fallbackHit === "SIDEBAR_COLLAPSE_BUTTON" || fallbackHit === "BUTTON_DESCENDANT") {
              hit = fallbackHit;
              hitPoint = { x: fx, y: fy, basis: "VISIBLE_BUTTON_INTERSECTION_CENTER" };
            }
          }
        }
      }
      const valid =
        connected && width > 0 && height > 0 && finite &&
        (hit === "SIDEBAR_COLLAPSE_BUTTON" || hit === "BUTTON_DESCENDANT");
      return { valid, connected, x, y, width, height, centerX, centerY, hit, hitPoint };
    });
  };

  // One real render frame via rAF, raced against remaining deadline so a
  // pending rAF cannot defeat the bounded timeout.
  const waitForFrame = async () => {
    await Promise.race([
      app.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(true)))),
      new Promise((r) => setTimeout(r, Math.max(0, deadlineAt - Date.now()))),
    ]);
  };

  for (;;) {
    let sample;
    try {
      sample = await sampleButton();
    } catch (e) {
      sample = { valid: false, hit: "NONE", error: String((e && e.message) || e).slice(0, 200) };
    }
    sampleCount++;
    lastSamples.push(sample);
    if (lastSamples.length > PRECLICK_MAX_RETAINED_SAMPLES) lastSamples.shift();

    if (sample.valid) {
      const stable =
        prevRect &&
        Math.abs(sample.x - prevRect.x) <= PRECLICK_RECT_TOLERANCE_PX &&
        Math.abs(sample.y - prevRect.y) <= PRECLICK_RECT_TOLERANCE_PX &&
        Math.abs(sample.width - prevRect.width) <= PRECLICK_RECT_TOLERANCE_PX &&
        Math.abs(sample.height - prevRect.height) <= PRECLICK_RECT_TOLERANCE_PX;
      stableSampleCount = stable ? stableSampleCount + 1 : 1;
      prevRect = { x: sample.x, y: sample.y, width: sample.width, height: sample.height };
      if (stableSampleCount >= REQUIRED_STABLE_SAMPLES) {
        return {
          status: "READY",
          preclickGeometryStatus: "READY",
          elapsedMs: Date.now() - startedAt,
          preclickGeometryElapsedMs: Date.now() - startedAt,
          preclickGeometrySampleCount: sampleCount,
          preclickGeometryStableSampleCount: stableSampleCount,
          requiredStableSamples: REQUIRED_STABLE_SAMPLES,
          lastSamples,
        };
      }
    } else {
      stableSampleCount = 0;
      prevRect = null;
    }

    if (Date.now() >= deadlineAt) {
      return {
        status: "SIDEBAR_PRECLICK_GEOMETRY_NOT_STABLE",
        preclickGeometryStatus: "NOT_STABLE",
        elapsedMs: Date.now() - startedAt,
        preclickGeometryElapsedMs: Date.now() - startedAt,
        preclickGeometrySampleCount: sampleCount,
        preclickGeometryStableSampleCount: stableSampleCount,
        requiredStableSamples: REQUIRED_STABLE_SAMPLES,
        lastSamples,
      };
    }
    await waitForFrame();
  }
}

// Family D — authoritative sidebar state control.
// STATE_AUTHORITY: #appShell[data-sidebar-collapsed] — "true"=collapsed,
// absent/"false"=expanded. Width remains a separate post-state geometry
// assertion (call sites measure after SIDEBAR_STATE_READY only).
// Control path matches standalone diagnostic reference explicit target:
// 1. read current authoritative state; 2. return READY without click when
// already at desired state; 3. bounded pre-click geometry stability gate
// (OPTION_B); 4. obtain fresh live #sidebarCollapseButton; 5. exactly ONE
// Playwright click; 6. click errors NOT swallowed — structured
// SIDEBAR_CLICK_ERROR, clicked=true ONLY after the click resolves;
// 7. poll authoritative state until desired or bounded deadline;
// 8. measurement only after READY.
async function setSidebarStateAndWait(app, page, desiredCollapsed, timeoutMs = SIDEBAR_STATE_TIMEOUT_MS) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + timeoutMs;
  let clicked = false;
  let collapsedAttr = null;

  // Authoritative state read from the live application scope that owns
  // #appShell. Transient frame-lookup misses return null and continue;
  // unexpected errors rethrow (observable, never converted to READY).
  const readCollapsedAttr = async () => {
    try {
      return await app.getAttribute("#appShell", "data-sidebar-collapsed");
    } catch (error) {
      if (isTransientShellLookupError(error)) return null;
      throw error;
    }
  };

  // 1–2. current authoritative state; READY without click when already equal.
  collapsedAttr = await readCollapsedAttr();
  let observedCollapsed = collapsedAttr === "true";
  if (observedCollapsed === desiredCollapsed) {
    return {
      status: "SIDEBAR_STATE_READY",
      desiredCollapsed,
      observedCollapsed,
      collapsedAttr,
      clicked,
      elapsedMs: Date.now() - startedAt,
    };
  }

  // 3. bounded pre-click geometry stability gate (OPTION_B). Fail-closed:
  // zero clicks when geometry/hit-target is not stably ready.
  const gate = await waitForSidebarPreclickGeometryStable(app);
  if (gate.status !== "READY") {
    return {
      status: "SIDEBAR_PRECLICK_GEOMETRY_NOT_STABLE",
      desiredCollapsed,
      observedCollapsed,
      collapsedAttr,
      clicked: false,
      clickAttempted: false,
      elapsedMs: Date.now() - startedAt,
      sampleCount: gate.preclickGeometrySampleCount,
      stableSampleCount: gate.preclickGeometryStableSampleCount,
      requiredStableSamples: gate.requiredStableSamples,
      lastSamples: gate.lastSamples,
    };
  }

  // 4–5. fresh live locator + exactly ONE click; no synthetic interaction.
  try {
    await app.locator("#sidebarCollapseButton").first().click();
    clicked = true;
  } catch (error) {
    return {
      status: "SIDEBAR_CLICK_ERROR",
      desiredCollapsed,
      observedCollapsed,
      collapsedAttr,
      clickErrorName: (error && error.name) || null,
      clickErrorMessage: String((error && error.message) || error).slice(0, 300),
      clicked,
      elapsedMs: Date.now() - startedAt,
      preclickGeometryStatus: gate.preclickGeometryStatus,
      preclickGeometryElapsedMs: gate.preclickGeometryElapsedMs,
      preclickGeometrySampleCount: gate.preclickGeometrySampleCount,
      preclickGeometryStableSampleCount: gate.preclickGeometryStableSampleCount,
    };
  }

  // 6–7. bounded state wait after resolved click; never assume mutation.
  for (;;) {
    if (Date.now() >= deadlineAt) break;
    await page.waitForTimeout(SIDEBAR_STATE_POLL_MS);
    collapsedAttr = await readCollapsedAttr();
    observedCollapsed = collapsedAttr === "true";
    if (observedCollapsed === desiredCollapsed) {
      return {
        status: "SIDEBAR_STATE_READY",
        desiredCollapsed,
        observedCollapsed,
        collapsedAttr,
        clicked,
        elapsedMs: Date.now() - startedAt,
        preclickGeometryStatus: gate.preclickGeometryStatus,
        preclickGeometryElapsedMs: gate.preclickGeometryElapsedMs,
        preclickGeometrySampleCount: gate.preclickGeometrySampleCount,
        preclickGeometryStableSampleCount: gate.preclickGeometryStableSampleCount,
      };
    }
  }

  // final authoritative read — click resolved but desired state never appeared
  collapsedAttr = await readCollapsedAttr();
  const finalObserved = collapsedAttr === "true";
  if (finalObserved === desiredCollapsed) {
    return {
      status: "SIDEBAR_STATE_READY",
      desiredCollapsed,
      observedCollapsed: finalObserved,
      collapsedAttr,
      clicked,
      elapsedMs: Date.now() - startedAt,
      preclickGeometryStatus: gate.preclickGeometryStatus,
      preclickGeometryElapsedMs: gate.preclickGeometryElapsedMs,
      preclickGeometrySampleCount: gate.preclickGeometrySampleCount,
      preclickGeometryStableSampleCount: gate.preclickGeometryStableSampleCount,
    };
  }
  return {
    status: "SIDEBAR_STATE_CHANGE_TIMEOUT",
    desiredCollapsed,
    observedCollapsed: finalObserved,
    collapsedAttr,
    clicked,
    elapsedMs: Date.now() - startedAt,
    preclickGeometryStatus: gate.preclickGeometryStatus,
    preclickGeometryElapsedMs: gate.preclickGeometryElapsedMs,
    preclickGeometrySampleCount: gate.preclickGeometrySampleCount,
    preclickGeometryStableSampleCount: gate.preclickGeometryStableSampleCount,
  };
}

// Family D — bounded rendered-width stability wait (post SIDEBAR_STATE_READY).
// STATE_READY = app state authority changed; rendered width may still settle
// through intermediate values. Poll #dashboardSidebar width; require it to
// reach expectedAuthority within SIDEBAR_WIDTH_ACCEPTANCE_TOLERANCE_PX AND
// remain stable for REQUIRED_STABLE_SAMPLES consecutive samples before any
// acceptance width assertion. Expected authority comes from sidebarAuthority()
// (collapsed→64; expanded ≥1280→264; expanded 1024-1279→224) — never redefined
// around observed intermediate values. Failure explicit: NOT_STABLE, never
// silent pass.
async function waitForSidebarWidthStable(app, page, expectedAuthority, timeoutMs = SIDEBAR_WIDTH_STABILITY_TIMEOUT_MS) {
  const startedAt = Date.now();
  const deadlineAt = startedAt + timeoutMs;
  const samples = [];
  let stableSampleCount = 0;
  let lastWidth = null;

  for (;;) {
    let width = null;
    try {
      width = await app.evaluate(() => {
        const sidebar = document.querySelector("#dashboardSidebar");
        return sidebar ? sidebar.getBoundingClientRect().width : null;
      });
    } catch (error) {
      if (isTransientShellLookupError(error)) width = null;
      else throw error;
    }
    samples.push(width);
    if (samples.length > PRECLICK_MAX_RETAINED_SAMPLES) samples.shift();

    const reachedAuthority =
      typeof width === "number" &&
      Math.abs(width - expectedAuthority) <= SIDEBAR_WIDTH_ACCEPTANCE_TOLERANCE_PX;
    const unchanged =
      lastWidth !== null &&
      typeof width === "number" &&
      Math.abs(width - lastWidth) <= SIDEBAR_WIDTH_ACCEPTANCE_TOLERANCE_PX;
    stableSampleCount = reachedAuthority && unchanged
      ? stableSampleCount + 1
      : reachedAuthority ? 1 : 0;
    lastWidth = width;

    if (stableSampleCount >= REQUIRED_STABLE_SAMPLES) {
      return {
        status: "SIDEBAR_WIDTH_STABLE",
        expectedAuthority,
        observedWidth: width,
        elapsedMs: Date.now() - startedAt,
        sampleCount: samples.length,
        stableSampleCount,
        requiredStableSamples: REQUIRED_STABLE_SAMPLES,
        samples,
      };
    }
    if (Date.now() >= deadlineAt) {
      return {
        status: "SIDEBAR_WIDTH_NOT_STABLE",
        expectedAuthority,
        observedWidth: width,
        elapsedMs: Date.now() - startedAt,
        sampleCount: samples.length,
        stableSampleCount,
        requiredStableSamples: REQUIRED_STABLE_SAMPLES,
        samples,
      };
    }
    await page.waitForTimeout(SIDEBAR_STATE_POLL_MS);
  }
}

async function runCompactExpandAcceptanceAtTargetViewport(browser, width, pageErrors, consoleErrors, relevantPageErrors, relevantConsoleErrors) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  page.on("pageerror", (error) => {
    const msg = error.message || String(error);
    pageErrors.push(msg);
    if (isRelevantAppError(msg)) relevantPageErrors.push(msg);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    consoleErrors.push(text);
    if (isRelevantAppError(text)) relevantConsoleErrors.push(text);
  });

  try {
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    await page.waitForTimeout(BOOTSTRAP_MS);
    const targetOk = Boolean(TARGET_DEPLOYMENT_ID && page.url().includes(TARGET_DEPLOYMENT_ID));
    const shell = await waitForAppShell(page);
    if (!targetOk || !shell.appShellReached || !shell.frame) {
      return { status: "COMPACT_TARGET_CONTEXT_NOT_READY", width, targetOk, shell };
    }
    const app = shell.frame;
    await app.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
    await ensureOverview(app, page);
    const overviewReadiness = await waitForOverviewDataReady(app, page);
    if (overviewReadiness.readinessStatus !== "OVERVIEW_DATA_READY") {
      return { status: "COMPACT_TARGET_OVERVIEW_NOT_READY", width, targetOk, shell, overviewReadiness };
    }

    const collapsed = await setSidebarStateAndWait(app, page, true);
    const collapsedWidth = collapsed.status === "SIDEBAR_STATE_READY"
      ? await waitForSidebarWidthStable(app, page, 64)
      : null;
    if (!collapsedWidth || collapsedWidth.status !== "SIDEBAR_WIDTH_STABLE") {
      return { status: "COMPACT_TARGET_COLLAPSED_PRECONDITION_FAILED", width, targetOk, shell, overviewReadiness, collapsed, collapsedWidth };
    }

    await app.evaluate(() => {
      window.__stage3CompactClickEvidence = { trustedClickCount: 0, buttonInPath: false, mutations: [] };
      const evidence = window.__stage3CompactClickEvidence;
      const shell = document.getElementById("appShell");
      document.addEventListener("click", (event) => {
        const path = event.composedPath ? event.composedPath() : [];
        if (event.isTrusted) evidence.trustedClickCount++;
        if (path.some((node) => node && node.id === "sidebarCollapseButton")) evidence.buttonInPath = true;
      }, true);
      new MutationObserver(() => evidence.mutations.push(shell.getAttribute("data-sidebar-collapsed")))
        .observe(shell, { attributes: true, attributeFilter: ["data-sidebar-collapsed"] });
    });
    const expanded = await setSidebarStateAndWait(app, page, false);
    const expandedWidth = expanded.status === "SIDEBAR_STATE_READY"
      ? await waitForSidebarWidthStable(app, page, 224)
      : null;
    const clickEvidence = await app.evaluate(() => window.__stage3CompactClickEvidence);
    const measurement = await app.locator("#dashboardPanelOverview").evaluate(MEASURE_OVERVIEW);
    const passed =
      expanded.status === "SIDEBAR_STATE_READY" &&
      expanded.clicked === true &&
      expandedWidth && expandedWidth.status === "SIDEBAR_WIDTH_STABLE" &&
      clickEvidence.trustedClickCount > 0 &&
      clickEvidence.buttonInPath === true &&
      clickEvidence.mutations.includes("false") &&
      Math.abs(measurement.sidebar.width - 224) <= 1;
    return {
      status: passed ? "COMPACT_TARGET_EXPAND_READY" : "COMPACT_TARGET_EXPAND_FAILED",
      width, targetOk, shellContext: shell.appShellContext, overviewReadiness,
      collapsed, collapsedWidth, expanded, expandedWidth, clickEvidence, measurement,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Report-only lifecycle evidence (no acceptance weight beyond assertions).
const OVERVIEW_READINESS_GATE_LOCATION = "AFTER_ENSURE_OVERVIEW_BEFORE_WIDTH_MATRIX";
const PER_CASE_RECHECK_REQUIRED = false;
const OVERVIEW_READINESS_RATIONALE =
  "viewport/sidebar/height transitions are geometry-only and do not re-trigger " +
  "renderBusinessOverview (R20: async initial render completed once; later cases " +
  "showed populated data without per-case rerender). Cache tab-return re-renders " +
  "Overview and is gated after the return click.";

(async () => {
  const pageErrors = [];
  const consoleErrors = [];
  const relevantPageErrors = [];
  const relevantConsoleErrors = [];
  const viewportCases = [];
  const sidebarCases = [];
  const kpiCases = [];
  const evidenceThresholdCases = [];
  const topProductsCases = [];
  const chartCases = [];
  const contextSummaryCases = [];
  const scrollCases = [];
  const heightCases = [];
  const cacheLifecycleCases = [];
  const buckets = {
    kpiCases,
    evidenceThresholdCases,
    topProductsCases,
    chartCases,
    contextSummaryCases,
    scrollCases,
  };

  let browser;
  let navigationSucceeded = false;
  let authBlock = false;
  let finalUrl = null;
  let title = null;
  let appShellReached = false;
  let appShellContext = "NOT_FOUND";
  let frameCount = 0;
  let userHtmlFramePresent = false;
  let appShellAttached = false;
  let appShellVisible = false;
  let appShellReadinessStatus = "NOT_FOUND";
  let readinessElapsedMs = null;
  let fatal = null;
  let zoomReference = null;
  let overviewReadiness = null;
  const sidebarStateEvidence = [];

  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    // ephemeral — no userDataDir, no persistent context, no personal profile, no credentials
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);

    page.on("pageerror", (error) => {
      const msg = error.message || String(error);
      pageErrors.push(msg);
      if (isRelevantAppError(msg)) relevantPageErrors.push(msg);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        const text = message.text();
        consoleErrors.push(text);
        if (isRelevantAppError(text)) relevantConsoleErrors.push(text);
      }
    });

    // Exactly ONE logical navigation — UI Validation explicit target only
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    navigationSucceeded = true;
    // Non-authority settle only — shell readiness governed by waitForAppShell below
    await page.waitForTimeout(BOOTSTRAP_MS);

    finalUrl = page.url();
    title = await page.title().catch(() => null);
    authBlock = await detectAuthBlock(page);

    if (!authBlock) {
      // Bounded explicit shell readiness wait (reacquires frames each attempt)
      const shell = await waitForAppShell(page);
      appShellReached = shell.appShellReached;
      appShellContext = shell.appShellContext;
      frameCount = shell.frameCount;
      userHtmlFramePresent = shell.userHtmlFramePresent;
      appShellAttached = Boolean(shell.appShellAttached);
      appShellVisible = Boolean(shell.appShellVisible);
      appShellReadinessStatus = shell.readinessStatus || "NOT_FOUND";
      readinessElapsedMs =
        typeof shell.readinessElapsedMs === "number" ? shell.readinessElapsedMs : null;

      record(
        "contract_explicit_target_only",
        "CONTRACT",
        finalUrl && TARGET_DEPLOYMENT_ID && finalUrl.indexOf(TARGET_DEPLOYMENT_ID) !== -1 ? "PASS" : "FAIL",
        `finalUrl=${finalUrl}`
      );
      record("contract_system_chrome", "CONTRACT", "PASS", "chromium.launch channel=chrome headless=true");
      record("contract_ephemeral_context", "CONTRACT", "PASS", "browser.newContext(); no userDataDir/persistent context");
      record(
        "contract_apps_script_frame_support",
        "CONTRACT",
        appShellReached && appShellAttached && appShellVisible && (appShellContext === "USER_HTML_FRAME" || userHtmlFramePresent)
          ? "PASS"
          : "FAIL",
        `appShellReached=${appShellReached} context=${appShellContext} frameCount=${frameCount} userHtmlFramePresent=${userHtmlFramePresent} appShellAttached=${appShellAttached} appShellVisible=${appShellVisible} readinessStatus=${appShellReadinessStatus} readinessElapsedMs=${readinessElapsedMs}`
      );

      if (appShellReached) {
        const app = shell.frame || page;
        await app.locator("#appShell").waitFor({ state: "visible", timeout: TIMEOUT });
        await ensureOverview(app, page);

        // FAMILY A — bounded Overview data-readiness gate. KPI semantic set AND
        // Top Products table both required before geometry consumes content.
        overviewReadiness = await waitForOverviewDataReady(app, page);
        record(
          "overview_data_readiness_gate",
          "OVERVIEW_DATA_READINESS",
          overviewReadiness.readinessStatus === "OVERVIEW_DATA_READY" ? "PASS" : "FAIL",
          JSON.stringify(overviewReadiness)
        );

        zoomReference = await page.evaluate(() => ({
          devicePixelRatio: window.devicePixelRatio,
          innerWidth: window.innerWidth,
          outerWidth: window.outerWidth,
          note: "Browser zoom reference = 100%; no zoom emulation used",
        }));
        record("contract_zoom_reference", "CONTRACT", "PASS", JSON.stringify(zoomReference));

        // CASE-STATE ISOLATION — WIDTH_MATRIX begins from explicit expanded state
        const widthStartState = await setSidebarStateAndWait(app, page, false);
        // Rendered-width settlement after STATE_READY (authority from viewport/state).
        if (widthStartState.status === "SIDEBAR_STATE_READY") {
          widthStartState.widthStability = await waitForSidebarWidthStable(
            app, page, sidebarAuthority(page.viewportSize().width, false)
          );
        }
        sidebarStateEvidence.push({ phase: "WIDTH_MATRIX_START", ...widthStartState });
        record(
          "width_matrix_start_sidebar_state",
          "CASE_STATE_ISOLATION",
          widthStartState.status === "SIDEBAR_STATE_READY" ? "PASS" : "FAIL",
          JSON.stringify(widthStartState)
        );

        // WIDTH MATRIX — desktop only, width >= 1024, height 900
        // PER_CASE_RECHECK_REQUIRED=false: viewport resize does not re-trigger
        // Overview data render; readiness established above and consumed by geometry.
        for (const wc of WIDTH_CASES) {
          await page.setViewportSize({ width: wc.width, height: wc.height });
          await page.waitForTimeout(SETTLE_MS);
          const m = await app.locator("#dashboardPanelOverview").evaluate(MEASURE_OVERVIEW);
          const entry = evaluateCase(`viewport_${wc.id}_${wc.width}x${wc.height}`, wc.width, wc.height, m, null);
          viewportCases.push({
            caseId: entry.caseId,
            width: entry.width,
            height: entry.height,
            kpi: entry.kpi.status,
            evidence: entry.evidence.status,
            evidenceRowWidth: entry.evidence.rowWidth,
            evidenceLayout: entry.evidence.layout,
            topProducts: entry.topProducts.status,
            chart: entry.chart.status,
            contextSummary: entry.contextSummary.status,
            scroll: entry.scroll.status,
          });
          absorbMeasurements(entry, buckets);
        }

        // SIDEBAR MATRIX — Family D: authoritative #appShell[data-sidebar-collapsed]
        // marker verified before any width measurement. No blind-toggle assumption.
        for (const width of SIDEBAR_CASE_WIDTHS) {
          for (const collapsed of [false, true]) {
            await page.setViewportSize({ width, height: 900 });
            await page.waitForTimeout(SETTLE_MS);
            const isolatedCompact = !collapsed && width < 1280
              ? await runCompactExpandAcceptanceAtTargetViewport(
                  browser, width, pageErrors, consoleErrors, relevantPageErrors, relevantConsoleErrors
                )
              : null;
            const state = isolatedCompact
              ? {
                  ...isolatedCompact.expanded,
                  status: isolatedCompact.status === "COMPACT_TARGET_EXPAND_READY"
                    ? "SIDEBAR_STATE_READY"
                    : isolatedCompact.status,
                  widthStability: isolatedCompact.expandedWidth,
                  directTargetIsolation: true,
                  clickEvidence: isolatedCompact.clickEvidence,
                }
              : await setSidebarStateAndWait(app, page, collapsed);
            const mode = collapsed ? "collapsed" : "expanded";
            const caseId = `sidebar_${width}_${mode}`;
            sidebarStateEvidence.push({ caseId, ...state });
            record(
              `${caseId}:sidebar_state`,
              "SIDEBAR_MATRIX",
              state.status === "SIDEBAR_STATE_READY" ? "PASS" : "FAIL",
              JSON.stringify(state)
            );
            if (state.status !== "SIDEBAR_STATE_READY") {
              // SIDEBAR_CLICK_ERROR or SIDEBAR_STATE_CHANGE_TIMEOUT —
              // do not continue as though toggle succeeded
              sidebarCases.push({
                caseId,
                width,
                collapsed,
                authority: sidebarAuthority(width, collapsed),
                actualSidebarWidth: null,
                sidebarWidthStatus: "NOT_MEASURED_STATE_TIMEOUT",
                sidebarStateStatus: state.status,
                kpi: "NOT_MEASURED",
                evidenceRowWidth: null,
                evidenceLayout: null,
                chart: "NOT_MEASURED",
                scroll: "NOT_MEASURED",
                detail: JSON.stringify(state),
              });
              continue;
            }
            // STATE_READY = app state authority changed, NOT rendered width final.
            // Bounded rendered-width stability gate before any width assertion.
            const authority = sidebarAuthority(width, collapsed);
            const widthStability = isolatedCompact
              ? isolatedCompact.expandedWidth
              : await waitForSidebarWidthStable(app, page, authority);
            state.widthStability = widthStability;
            if (widthStability.status !== "SIDEBAR_WIDTH_STABLE") {
              // Explicit failure — never silently pass on unsettled width
              record(
                `${caseId}:sidebar_width`,
                "SIDEBAR_MATRIX",
                "FAIL",
                `SIDEBAR_WIDTH_NOT_STABLE expectedAuthority=${authority} ${JSON.stringify(widthStability)}`
              );
              sidebarCases.push({
                caseId,
                width,
                collapsed,
                authority,
                actualSidebarWidth: widthStability.observedWidth,
                sidebarWidthStatus: "FAIL_WIDTH_NOT_STABLE",
                sidebarStateStatus: state.status,
                kpi: "NOT_MEASURED_WIDTH_NOT_STABLE",
                evidenceRowWidth: null,
                evidenceLayout: null,
                chart: "NOT_MEASURED",
                scroll: "NOT_MEASURED",
                detail: JSON.stringify(state),
              });
              continue;
            }
            const m = isolatedCompact
              ? isolatedCompact.measurement
              : await app.locator("#dashboardPanelOverview").evaluate(MEASURE_OVERVIEW);
            const actual = m.sidebar.width;
            const widthOk = typeof actual === "number" && Math.abs(actual - authority) <= 1;
            record(
              `${caseId}:sidebar_width`,
              "SIDEBAR_MATRIX",
              widthOk ? "PASS" : "FAIL",
              `actual=${actual} authority=${authority} collapsedAttr=${m.sidebar.collapsedAttr} stateVerified=${state.status === "SIDEBAR_STATE_READY"}`
            );
            const entry = evaluateCase(caseId, width, 900, m, { collapsed, authority, actualSidebarWidth: actual, sidebarState: state.status });
            sidebarCases.push({
              caseId,
              width,
              collapsed,
              authority,
              actualSidebarWidth: actual,
              sidebarWidthStatus: widthOk ? "PASS" : "FAIL",
              sidebarStateStatus: state.status,
              kpi: entry.kpi.status,
              evidenceRowWidth: entry.evidence.rowWidth,
              evidenceLayout: entry.evidence.layout,
              chart: entry.chart.status,
              scroll: entry.scroll.status,
            });
            absorbMeasurements(entry, buckets);
          }
        }

        // CASE-STATE ISOLATION — HEIGHT_MATRIX begins from explicit expanded state
        // (sidebar matrix ends on collapsed; do not inherit that state)
        const isolatedHeightStart = await runCompactExpandAcceptanceAtTargetViewport(
          browser, 1024, pageErrors, consoleErrors, relevantPageErrors, relevantConsoleErrors
        );
        const heightStartState = {
          ...(isolatedHeightStart.expanded || {}),
          status: isolatedHeightStart.status === "COMPACT_TARGET_EXPAND_READY"
            ? "SIDEBAR_STATE_READY"
            : isolatedHeightStart.status,
          widthStability: isolatedHeightStart.expandedWidth || null,
          directTargetIsolation: true,
          clickEvidence: isolatedHeightStart.clickEvidence || null,
        };
        sidebarStateEvidence.push({ phase: "HEIGHT_MATRIX_START", ...heightStartState });
        record(
          "height_matrix_start_sidebar_state",
          "CASE_STATE_ISOLATION",
          heightStartState.status === "SIDEBAR_STATE_READY" ? "PASS" : "FAIL",
          JSON.stringify(heightStartState)
        );
        await page.setViewportSize({ width: 1680, height: 900 });
        await page.waitForTimeout(SETTLE_MS);
        const heightSequenceState = await setSidebarStateAndWait(app, page, false);
        record(
          "height_matrix_sequence_sidebar_state",
          "CASE_STATE_ISOLATION",
          heightSequenceState.status === "SIDEBAR_STATE_READY" ? "PASS" : "FAIL",
          JSON.stringify(heightSequenceState)
        );

        // HEIGHT CONTINUITY — old desktop height buckets removed
        for (const hc of HEIGHT_CASES) {
          await page.setViewportSize({ width: hc.width, height: hc.height });
          await page.waitForTimeout(SETTLE_MS);
          const m = await app.locator("#dashboardPanelOverview").evaluate(MEASURE_OVERVIEW);
          const entry = evaluateCase(`height_${hc.id}`, hc.width, hc.height, m, null);
          heightCases.push({
            caseId: entry.caseId,
            width: entry.width,
            height: entry.height,
            heightContinuity: entry.heightContinuity.status,
            kpi: entry.kpi.status,
            evidenceRowWidth: entry.evidence.rowWidth,
            scroll: entry.scroll.status,
          });
          record(
            `${entry.caseId}:height_continuity`,
            "HEIGHT_CONTINUITY",
            entry.heightContinuity.status,
            entry.heightContinuity.detail
          );
          absorbMeasurements(entry, buckets);
        }

        // CACHE LIFECYCLE — public UI paths only, no private JS variables
        // CASE-STATE ISOLATION — explicit expanded state; do not inherit matrix state
        const cacheStartState = await setSidebarStateAndWait(app, page, false);
        sidebarStateEvidence.push({ phase: "CACHE_LIFECYCLE_START", ...cacheStartState });
        record(
          "cache_lifecycle_start_sidebar_state",
          "CASE_STATE_ISOLATION",
          cacheStartState.status === "SIDEBAR_STATE_READY" ? "PASS" : "FAIL",
          JSON.stringify(cacheStartState)
        );
        // A. initial Overview render (already measured above)
        const initialConsumers = await app
          .locator("#dashboardPanelOverview")
          .evaluate(MEASURE_OVERVIEW_CONSUMERS)
          .catch(() => null);
        const initialOk = Boolean(
          initialConsumers &&
            initialConsumers.kpiCards > 0 &&
            initialConsumers.evidenceRow &&
            initialConsumers.chartCanvases > 0 &&
            initialConsumers.topProductsContainer
        );
        cacheLifecycleCases.push({
          id: "A_initial_overview_render",
          status: initialOk ? "PASS" : "FAIL",
          detail: JSON.stringify(initialConsumers || { error: "unavailable" }),
        });
        record(
          "cache_A_initial_overview_render",
          "CACHE_RUNTIME_PATHS",
          initialOk ? "PASS" : "FAIL",
          JSON.stringify(initialConsumers || {})
        );
        record(
          "cache_C05_reporting_metadata_consumer",
          "CACHE_RUNTIME_PATHS",
          initialConsumers && (initialConsumers.periodComparison || initialConsumers.dataQuality)
            ? "PASS"
            : "UNVERIFIED",
          `periodComparison=${initialConsumers ? initialConsumers.periodComparison : null} dataQuality=${initialConsumers ? initialConsumers.dataQuality : null}; private cache identity INDIRECTLY_VALIDATED through consumer path`,
          false
        );
        record(
          "cache_C05_kpi_targets_consumer",
          "CACHE_RUNTIME_PATHS",
          initialConsumers && initialConsumers.kpiTargetDetailsButton ? "PASS" : "UNVERIFIED",
          `kpiTargetDetailsButton=${initialConsumers ? initialConsumers.kpiTargetDetailsButton : null}; private cache identity INDIRECTLY_VALIDATED through consumer path`,
          false
        );
        record(
          "cache_C05_top_products_container_consumer",
          "CACHE_RUNTIME_PATHS",
          initialConsumers && initialConsumers.topProductsContainer ? "PASS" : "UNVERIFIED",
          `topProductsContainer=${initialConsumers ? initialConsumers.topProductsContainer : null}`,
          false
        );
        record(
          "cache_C05_chart_presentation_consumer",
          "CACHE_RUNTIME_PATHS",
          initialConsumers && initialConsumers.chartCanvases > 0 ? "PASS" : "UNVERIFIED",
          `chartCanvases=${initialConsumers ? initialConsumers.chartCanvases : null}; private cache identity INDIRECTLY_VALIDATED through consumer path`,
          false
        );

        // D. tab switch away + B. repeated Overview render on return
        await page.setViewportSize({ width: 1680, height: 900 });
        await page.waitForTimeout(SETTLE_MS);
        await app.locator("#dashboardTabPerformance").click().catch(() => {});
        await page.waitForTimeout(SETTLE_MS);
        const perfVisible = await app
          .locator("#dashboardPanelPerformance")
          .isVisible()
          .catch(() => false);
        const perfConsumers = await app
          .locator("#dashboardPanelPerformance")
          .evaluate(MEASURE_PERFORMANCE_CONSUMERS)
          .catch(() => null);
        record(
          "cache_D_tab_switch_away",
          "CACHE_RUNTIME_PATHS",
          perfVisible ? "PASS" : "FAIL",
          `performancePanelVisible=${perfVisible}`
        );
        cacheLifecycleCases.push({
          id: "D_tab_switch_away",
          status: perfVisible ? "PASS" : "FAIL",
          detail: `performancePanelVisible=${perfVisible}`,
        });
        if (perfConsumers && perfConsumers.expense > 0) {
          record(
            "cache_C05_expense_container_consumer",
            "CACHE_RUNTIME_PATHS",
            "PASS",
            `expenseContainerMatches=${perfConsumers.expense}`,
            false
          );
        } else {
          record(
            "cache_C05_expense_container_consumer",
            "CACHE_RUNTIME_PATHS",
            "UNVERIFIED",
            `expenseContainerMatches=${perfConsumers ? perfConsumers.expense : null}`,
            false
          );
        }
        record(
          "cache_C05_diagnosis_container_consumer",
          "CACHE_RUNTIME_PATHS",
          perfConsumers && perfConsumers.diagnosis > 0 ? "PASS" : "UNVERIFIED",
          `diagnosisContainerMatches=${perfConsumers ? perfConsumers.diagnosis : null}; not required for bounded Overview acceptance`,
          false
        );
        record(
          "cache_C05_forecast_container_consumer",
          "CACHE_RUNTIME_PATHS",
          perfConsumers && perfConsumers.forecast > 0 ? "PASS" : "UNVERIFIED",
          `forecastContainerMatches=${perfConsumers ? perfConsumers.forecast : null}; not required for bounded Overview acceptance`,
          false
        );

        await app.locator("#dashboardTabOverview").click().catch(() => {});
        await page.waitForTimeout(SETTLE_MS);
        // Tab-return re-triggers Overview data render — bounded readiness recheck
        // (PER_CASE_RECHECK_REQUIRED=false for geometry transitions; this is the
        // one lifecycle path proven to re-render data).
        const cacheReturnReadiness = await waitForOverviewDataReady(app, page);
        record(
          "cache_return_overview_data_readiness",
          "OVERVIEW_DATA_READINESS",
          cacheReturnReadiness.readinessStatus === "OVERVIEW_DATA_READY" ? "PASS" : "FAIL",
          JSON.stringify(cacheReturnReadiness)
        );
        const afterReturn = await app
          .locator("#dashboardPanelOverview")
          .evaluate(MEASURE_OVERVIEW_CONSUMERS)
          .catch(() => null);
        const returnOk = Boolean(
          afterReturn &&
            afterReturn.kpiCards > 0 &&
            afterReturn.evidenceRow &&
            afterReturn.chartCanvases > 0 &&
            afterReturn.topProductsContainer
        );
        const connectedNodes = await app
          .locator("#dashboardPanelOverview")
          .evaluate(MEASURE_CONNECTED)
          .catch(() => []);
        const connectedOk = connectedNodes.length > 0 && connectedNodes.every((n) => n.present && n.connected);
        record(
          "cache_B_repeated_overview_render",
          "CACHE_RUNTIME_PATHS",
          returnOk ? "PASS" : "FAIL",
          JSON.stringify(afterReturn || {})
        );
        cacheLifecycleCases.push({
          id: "B_repeated_overview_render",
          status: returnOk ? "PASS" : "FAIL",
          detail: JSON.stringify(afterReturn || { error: "unavailable" }),
        });
        record(
          "cache_D_tab_switch_return",
          "CACHE_RUNTIME_PATHS",
          returnOk ? "PASS" : "FAIL",
          `overviewReRendered=${returnOk}`
        );
        record(
          "cache_F_connected_node_validity_after_rerender",
          "CACHE_RUNTIME_PATHS",
          connectedOk ? "PASS" : "FAIL",
          JSON.stringify(connectedNodes)
        );
        cacheLifecycleCases.push({
          id: "F_connected_node_validity_after_rerender",
          status: connectedOk ? "PASS" : "FAIL",
          detail: JSON.stringify(connectedNodes),
        });

        // E + C. sidebar resize path -> delayed chart resize/recreation path
        await page.setViewportSize({ width: 1680, height: 900 });
        await page.waitForTimeout(SETTLE_MS);
        const cacheCollapseState = await setSidebarStateAndWait(app, page, true);
        sidebarStateEvidence.push({ phase: "CACHE_COLLAPSE", ...cacheCollapseState });
        record(
          "cache_sidebar_state_after_collapse",
          "SIDEBAR_RESIZE",
          cacheCollapseState.status === "SIDEBAR_STATE_READY" ? "PASS" : "FAIL",
          JSON.stringify(cacheCollapseState)
        );
        const chartAfterCollapse = await app
          .locator("#revenueChartSection")
          .evaluate(MEASURE_CHART_AFTER_RESIZE)
          .catch(() => null);
        const collapseOk =
          cacheCollapseState.status === "SIDEBAR_STATE_READY" &&
          Boolean(
            chartAfterCollapse &&
              chartAfterCollapse.wrapperConnected &&
              chartAfterCollapse.canvasUsable &&
              chartAfterCollapse.contained === true
          );
        record(
          "sidebar_resize_chart_after_collapse",
          "SIDEBAR_RESIZE",
          collapseOk ? "PASS" : "FAIL",
          JSON.stringify({ state: cacheCollapseState, chart: chartAfterCollapse || null })
        );
        record(
          "cache_E_sidebar_resize_chart_path",
          "CACHE_RUNTIME_PATHS",
          collapseOk ? "PASS" : "FAIL",
          JSON.stringify({ state: cacheCollapseState, chart: chartAfterCollapse || null })
        );
        cacheLifecycleCases.push({
          id: "E_sidebar_resize_chart_path",
          status: collapseOk ? "PASS" : "FAIL",
          detail: JSON.stringify({ state: cacheCollapseState, chart: chartAfterCollapse || null }),
        });
        const cacheExpandState = await setSidebarStateAndWait(app, page, false);
        sidebarStateEvidence.push({ phase: "CACHE_EXPAND", ...cacheExpandState });
        record(
          "cache_sidebar_state_after_expand",
          "SIDEBAR_RESIZE",
          cacheExpandState.status === "SIDEBAR_STATE_READY" ? "PASS" : "FAIL",
          JSON.stringify(cacheExpandState)
        );
        const chartAfterExpand = await app
          .locator("#revenueChartSection")
          .evaluate(MEASURE_CHART_AFTER_RESIZE)
          .catch(() => null);
        const expandOk =
          cacheExpandState.status === "SIDEBAR_STATE_READY" &&
          Boolean(
            chartAfterExpand &&
              chartAfterExpand.wrapperConnected &&
              chartAfterExpand.canvasUsable &&
              chartAfterExpand.contained === true
          );
        record(
          "sidebar_resize_chart_after_expand",
          "SIDEBAR_RESIZE",
          expandOk ? "PASS" : "FAIL",
          JSON.stringify({ state: cacheExpandState, chart: chartAfterExpand || null })
        );

        // R20 error gate — relevant application/runtime JS errors
        record(
          "error_policy_relevant_application_errors",
          "ERROR_CAPTURE",
          relevantPageErrors.length === 0 && relevantConsoleErrors.length === 0 ? "PASS" : "FAIL",
          JSON.stringify({ relevantPageErrors, relevantConsoleErrors })
        );
      }
    }
  } catch (error) {
    fatal = error.message || String(error);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // Family F — reconciled desktop Evidence contract (OPTION_1):
  // SIDE_BY_SIDE_ONLY_FOR_REACHABLE_DESKTOP_DOMAIN. DESKTOP_MIN_VIEWPORT=1024,
  // reachable Evidence width min=752. <=657 STACKED is non-desktop/future and
  // is NOT a required Stage 3 desktop gate.
  const evidenceMeasured = evidenceThresholdCases.filter((c) => typeof c.rowWidth === "number");
  const belowOrEqual657Reached = evidenceMeasured.some((c) => c.rowWidth <= 657);
  const evidenceReachablePresent = evidenceMeasured.length > 0;
  const evidenceAllPass = evidenceMeasured.length > 0 && evidenceMeasured.every((c) => c.status === "PASS");
  const evidenceAllSideBySide = evidenceMeasured.length > 0 && evidenceMeasured.every((c) => c.layout === "SIDE_BY_SIDE");

  record(
    "evidence_desktop_reachable_cases_present",
    "EVIDENCE_DESKTOP_CONTRACT",
    evidenceReachablePresent ? "PASS" : "FAIL",
    `reachableDesktopEvidenceCases=${evidenceMeasured.length} caseIds=${evidenceMeasured.map((c) => c.caseId).join(",")}`
  );
  record(
    "evidence_desktop_contract",
    "EVIDENCE_DESKTOP_CONTRACT",
    evidenceAllPass ? "PASS" : "FAIL",
    JSON.stringify({
      contract: "EVIDENCE_DESKTOP_REACHABLE_CASES_PRESENT + EVIDENCE_CONTAINED + EVIDENCE_NO_OVERLAP + EVIDENCE_NO_PAGE_HORIZONTAL_OVERFLOW + EVIDENCE_LAYOUT_SIDE_BY_SIDE",
      cases: evidenceMeasured.map((c) => ({ caseId: c.caseId, rowWidth: c.rowWidth, layout: c.layout, status: c.status })),
    })
  );
  record(
    "evidence_desktop_layout_side_by_side",
    "EVIDENCE_DESKTOP_CONTRACT",
    evidenceAllSideBySide ? "PASS" : "FAIL",
    JSON.stringify(evidenceMeasured.map((c) => ({ caseId: c.caseId, layout: c.layout })))
  );

  // Informational only — <=657 STACKED unreachable in accepted desktop Stage 3.
  // NEVER FAIL / UNVERIFIED / NON_PASS_REQUIRED for Stage 3 desktop acceptance.
  record(
    "informational_le657_evidence_metric",
    "EVIDENCE_INFORMATIONAL",
    "PASS",
    `BELOW_OR_EQUAL_657_REACHED=${belowOrEqual657Reached} NON_DESKTOP_INFORMATIONAL_ONLY=true; <=657 STACKED is non-desktop/future behavior outside accepted desktop Stage 3 domain (DESKTOP_MIN_VIEWPORT=1024, reachable Evidence min=752)`,
    false
  );

  // Overall gate: FAIL > BLOCKED > PASS (required items only)
  const required = assertions.filter((a) => a.required !== false);
  const anyFail = required.some((a) => a.status === "FAIL");
  const anyUnverified = required.some((a) => a.status === "UNVERIFIED");
  let overall = "PASS";
  if (fatal || authBlock || !navigationSucceeded) overall = "BLOCKED";
  else if (anyFail) overall = "FAIL";
  else if (anyUnverified) overall = "BLOCKED";

  const assertionSummary = {
    total: assertions.length,
    pass: assertions.filter((a) => a.status === "PASS").length,
    fail: assertions.filter((a) => a.status === "FAIL").length,
    unverified: assertions.filter((a) => a.status === "UNVERIFIED").length,
    requiredTotal: required.length,
    requiredFail: required.filter((a) => a.status === "FAIL").length,
    requiredUnverified: required.filter((a) => a.status === "UNVERIFIED").length,
    nonPassRequired: required.filter((a) => a.status !== "PASS").map((a) => ({ id: a.id, status: a.status })),
  };

  const summary = {
    target: TARGET_URL,
    finalUrl,
    title,
    authBlock,
    navigationSucceeded,
    appShellReached,
    appShellContext,
    appShellAttached,
    appShellVisible,
    appShellReadinessStatus,
    readinessElapsedMs,
    frameCount,
    userHtmlFramePresent,
    zoomReference,
    overviewReadiness,
    overviewReadinessGateLocation: OVERVIEW_READINESS_GATE_LOCATION,
    perCaseRecheckRequired: PER_CASE_RECHECK_REQUIRED,
    overviewReadinessRationale: OVERVIEW_READINESS_RATIONALE,
    sidebarStateEvidence,
    familyF: {
      selectedOption: "OPTION_1_SIDE_BY_SIDE_ONLY_FOR_REACHABLE_DESKTOP_DOMAIN",
      impossibleLe657RequiredGateRemoved: true,
      desktopSideBySideRequired: true,
      evidenceContainmentRequired: true,
      evidenceNoOverlapRequired: true,
      pageHorizontalOverflowProtectionRequired: true,
      informationalLe657Metric: {
        BELOW_OR_EQUAL_657_REACHED: belowOrEqual657Reached,
        NON_DESKTOP_INFORMATIONAL_ONLY: true,
      },
    },
    viewportCases,
    sidebarCases,
    kpiCases,
    evidenceThresholdCases,
    topProductsCases,
    chartCases,
    contextSummaryCases,
    scrollCases,
    heightCases,
    cacheLifecycleCases,
    pageErrors,
    consoleErrors,
    relevantPageErrors,
    relevantConsoleErrors,
    assertionSummary,
    overall,
    fatal,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(overall === "PASS" ? 0 : 1);
})();
