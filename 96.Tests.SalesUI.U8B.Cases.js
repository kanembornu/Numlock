// SALES-UI-U8B frozen desktop Sales entry UI contract (local, source-token).
// Asserts: three-column layout (Sales Details | Order Preview | Price
// Preview), name-only product options, Order Preview line format without a
// counter, Price Preview HPP/Margin with totals (no Revenue, no percentage),
// Add Line reset semantics with Order Type retention, full-width Add Line and
// preview-only overflow. UI-only: no backend, no server pricing change.
function testSalesUIU8BContract()
{
  var pass = 0;
  function check(id, value, detail) {
    if (!value) throw new Error("SALES_UI_U8B:" + id + (detail === undefined ? "" : "|" + detail));
    pass++;
  }
  var index = String(typeof _htmlIndex === "string" ? _htmlIndex : "");
  var actions = String(typeof _htmlActions === "string" ? _htmlActions : "");
  var forms = String(typeof _htmlForms === "string" ? _htmlForms : "");
  var css = fs.readFileSync("189.View.Tailwind.html", "utf8");
  var dialog = index.slice(index.indexOf('id="transactionEntryOverlay"'),
    index.indexOf('id="transactionLifecycleOverlay"'));

  // 1. Three horizontal columns: Sales Details | Order Preview | Price Preview.
  check("T1a", dialog.indexOf('class="transaction-sales-layout"') !== -1, "layout wrapper");
  check("T1b", css.indexOf('#salesEntryFields>.transaction-sales-layout{grid-column:1/-1;grid-row:auto;display:grid') !== -1 &&
    css.indexOf("@media (min-width:640px){#salesEntryFields>.transaction-sales-layout{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)}") !== -1,
    "desktop three-column grid");
  var layoutStart = dialog.indexOf('class="transaction-sales-layout"');
  var orderPreviewAt = dialog.indexOf('id="salesOrderPreview"', layoutStart);
  var pricePreviewAt = dialog.indexOf('id="salesPricingPreview"', layoutStart);
  check("T1c", layoutStart !== -1 && dialog.indexOf('transaction-sales-detail-card', layoutStart) < orderPreviewAt &&
    orderPreviewAt < pricePreviewAt, "column order details | order preview | price preview");

  // 1c. The scoped override must exist so the legacy desktop
  //     `#salesPricingPreview{grid-column:2;grid-row:2}` rule (asserted by
  //     96.Tests.Transactions.Cases.js) cannot force Price Preview out of the
  //     horizontal layout at >=768px (specificity 1,1,0 > 1,0,0).
  check("T1d", css.indexOf(".transaction-sales-layout #salesOrderPreview,.transaction-sales-layout #salesPricingPreview{grid-column:auto;grid-row:auto;align-self:stretch}") !== -1,
    "layout-scoped preview override beats legacy desktop grid placement");

  // 2. Input rows: [Product | Order Type] then [Serving Type | Quantity].
  var cardStart = dialog.indexOf('transaction-sales-detail-card', layoutStart);
  var productAt = dialog.indexOf('id="productEntrySearch"', cardStart);
  var orderTypeAt = dialog.indexOf('id="operationalOrderType"', cardStart);
  var servingAt = dialog.indexOf('transaction-sales-serving', cardStart);
  var qtyAt = dialog.indexOf('id="salesEntryQty"', cardStart);
  check("T2a", productAt !== -1 && orderTypeAt !== -1 && productAt < orderTypeAt &&
    orderTypeAt < servingAt && servingAt < qtyAt, "row order Product|OrderType, Serving|Qty");
  check("T2b", dialog.indexOf('id="operationalOrderType"') !== -1 &&
    dialog.slice(dialog.indexOf('id="operationalOrderType"')).indexOf('<option value="DINE_IN">') !== -1 &&
    dialog.slice(dialog.indexOf('id="operationalOrderType"')).indexOf('<option value="TAKE_AWAY">') !== -1,
    "reused DINE_IN/TAKE_AWAY Order Type select");
  // Product shares row 1 with Order Type: the layout-scoped override beats the
  // legacy full-width .transaction-sales-product rule.
  check("T2c", css.indexOf(".transaction-sales-layout .transaction-sales-product{grid-column:auto}") !== -1,
    "Product cell scoped override (row 1 = Product | Order Type)");

  // 3. Product selector shows NAME only — no Category/Kind in option rows,
  //    listbox meta or the product meta line.
  check("T3a", forms.indexOf('button.innerText = type === "product" ? option.product : option.item;') !== -1,
    "name-only option text");
  check("T3b", forms.indexOf('if (type !== "product") {') !== -1 &&
    forms.indexOf('[option.category, option.kind].filter(Boolean).join(" · ")') === -1,
    "product meta suppressed");
  check("T3c", forms.indexOf('entry.productMeta.innerText = "";') !== -1,
    "product meta line stays empty");

  // 4. Order Preview: exact line format `Cold × 5 @ Rp24.000` + aligned line
  //    total, Indonesian thousand separators via existing money formatter.
  var orderRender = actions.slice(actions.indexOf("function renderOperationalOrderLines()"),
    actions.indexOf("function renderSalesPricingPreview_()"));
  check("T4a", orderRender.indexOf('label.textContent = line.servingType + " × " + line.qty + " @ " + formatEntryCurrency(line.price);') !== -1,
    "serving x qty @ unit token");
  check("T4b", orderRender.indexOf('amount.textContent = formatEntryCurrency(line.qty * line.price);') !== -1 &&
    orderRender.indexOf('"Total: " + formatEntryCurrency(total)') !== -1,
    "line total + Total row");
  check("T4c", orderRender.indexOf("line.name") === -1 && orderRender.indexOf("(index + 1)") === -1 &&
    orderRender.indexOf("No.") === -1 && orderRender.indexOf("#") === -1,
    "no product-name row, no line/item counter", orderRender);

  // 5. Price Preview: per line `HPP × qty @ unit = total` and
  //    `Margin × qty @ unit = total`; multi-line => Total HPP + Total Margin.
  var priceRender = actions.slice(actions.indexOf("function renderSalesPricingPreview_()"),
    actions.indexOf("function operationalServerCall("));
  check("T5a", priceRender.indexOf('"HPP × " + qty + " @ " + formatEntryCurrency(hpp) + " = " + formatEntryCurrency(hpp * qty);') !== -1,
    "HPP line format");
  check("T5b", priceRender.indexOf('"Margin × " + qty + " @ " + formatEntryCurrency(margin) + " = " + formatEntryCurrency(margin * qty);') !== -1,
    "Margin line format");
  check("T5c", priceRender.indexOf("if (lines.length > 1)") !== -1 &&
    priceRender.indexOf('"Total HPP: " + formatEntryCurrency(totalHpp)') !== -1 &&
    priceRender.indexOf('"Total Margin: " + formatEntryCurrency(totalMargin)') !== -1,
    "multi-line totals");
  check("T5d", priceRender.indexOf("%") === -1 && priceRender.indexOf("percent") === -1,
    "no percentage margin", priceRender);
  check("T5e", dialog.indexOf("salesPreviewRevenue") === -1 &&
    dialog.indexOf("<dt>Revenue</dt>") === -1 &&
    dialog.indexOf('id="salesPreviewPrice"') === -1,
    "Revenue row and legacy preview rows removed");

  // 6. Add Line reset: Product clears, Serving Type none, Quantity=1, and the
  //    Order Type select is NEVER touched by the reset.
  var addRegion = actions.slice(actions.indexOf("function addSelectedSalesOrderLine"),
    actions.indexOf("function removeOperationalOrderLine"));
  check("T6a", addRegion.indexOf("state.selectedProduct = null;") !== -1 &&
    addRegion.indexOf("state.selectedType = null;") !== -1 &&
    addRegion.indexOf("state.qty = 1;") !== -1, "state reset tokens");
  check("T6b", addRegion.indexOf('if (productSearch) productSearch.value = "";') !== -1 &&
    addRegion.indexOf('if (qtyInput) qtyInput.value = "1";') !== -1,
    "DOM reset tokens");
  check("T6c", addRegion.indexOf("operationalOrderType") === -1,
    "Order Type retained (never referenced in the reset)", addRegion);
  check("T6d", addRegion.indexOf('["salesTypeHot", "salesTypeCold"].forEach') !== -1 &&
    addRegion.indexOf('setAttribute("aria-checked", "false")') !== -1,
    "Serving Type resets to none selected");

  // 7. Add Line is a full-width button; Save stays gated on >= 1 line.
  check("T7a", dialog.indexOf('id="operationalAddLine" class="transaction-sales-add-line" type="button"') !== -1,
    "Add Line markup");
  check("T7b", css.indexOf("#operationalAddLine{width:100%;min-height:44px}") !== -1, "full-width CSS");
  check("T7d", css.indexOf(".transaction-sales-add-line{grid-column:1/-1}") !== -1,
    "Add Line spans the full card width (compiled CSS rule present)");
  check("T7c", actions.indexOf("if (!lines.length) return false;") !== -1, "Save gated on >= 1 line");

  // 8. Overflow lives only on the preview containers, never on the
  //    page/modal: previews get overflow-y, the dialog keeps its own scroll.
  check("T8a", css.indexOf(".transaction-order-preview-lines,.transaction-price-preview-lines{max-height:min(42vh,420px);overflow-y:auto;overscroll-behavior:contain;min-height:0}") !== -1,
    "preview-only overflow-y");
  check("T8b", css.indexOf('id="salesOrderPreview"' ) === -1 &&
    index.indexOf('id="salesOrderPreview"') !== -1, "preview containers are dialog content");
  check("T8c", dialog.indexOf('id="transactionEntryScroll" class="transaction-entry-scroll"') !== -1 &&
    css.indexOf(".transaction-order-preview-lines,.transaction-price-preview-lines{max-height:min(42vh,420px);overflow-y:auto") !== -1,
    "bounded dialog scroll + preview-scoped overflow only");

  // 9. U8B-VISUAL remedy: the Sales-entry dialog is widened beyond the legacy
  //    860px cap so the three frozen columns stay readable at real operator
  //    viewports (measured pre-fix: 860px -> 3x266px columns, product input
  //    112px, qty "+" overflowed its container; post-fix @1180px: 3x373px,
  //    product 165px, "+" fully visible, order/price rows fit un-wrapped).
  check("T9a", css.indexOf("#transactionEntryDialog[data-entry-type=sales]{width:min(100%,1180px)}") !== -1,
    "sales-entry dialog widened token");
  check("T9b", css.indexOf(".transaction-entry-dialog{display:flex;width:min(100%,860px)") !== -1 &&
    css.indexOf("#transactionEntryDialog[data-entry-type=sales]{width:min(100%,1180px)}") !== -1,
    "scoped override coexists with the legacy 860px base rule");

  return { total: pass, pass: pass, fail: 0 };
}
