function testProductsDomainContract() {
  var scenarios = 0;
  function check(condition, message) { scenarios++; if (!condition) throw new Error(message); }
  var products = [{ ID_Prod: "P-1", Produk: "Coffee", Kategori: "Drink", Kind: "Sellable", IsActive: true }];
  var items = [{ ItemID: "I-1", ItemName: "Beans", Classification: "RAW_MATERIAL", BaseUOM: "gr", IsActive: true }];
  var recipes = [{ ID_Recipe: "R-1", ID_Prod: "P-1", Tipe: "Hot", ID_Ingredient: "I-1", UsageQty: 18, IsActive: true }];
  var pricing = [{ ID_Prod: "P-1", Tipe: "Hot", EffectiveFrom: "2026-01-01", EffectiveTo: "", HPP: 5000, Harga: 15000, IsActive: true }];
  var catalog = buildProductCatalogReadModel_(products, pricing, recipes, new Date(2026, 0, 2));
  var inventory = buildInventoryItemsReadModel_(items, recipes);
  var cogsRecipe = buildCogsRecipeReadModel_(products, recipes, items, pricing, new Date(2026, 0, 2));
  var composition = cogsRecipe.products[0].variants[0];
  var standardCosts = [
    { ID: "SC-1", ItemID: "I-1", StandardCost: 100, EffectiveFrom: "2026-01-01", EffectiveTo: "2026-01-31", IsActive: true },
    { ID: "SC-2", ItemID: "I-1", StandardCost: 120, EffectiveFrom: "2026-02-01", EffectiveTo: "", IsActive: true }
  ];
  var cogsIngredients = [
    { ID_Ingredient: "I-1", PurchaseCost: 100, UsableQty: 1, EffectiveFrom: "2026-01-01", EffectiveTo: "2026-01-31", IsActive: true },
    { ID_Ingredient: "I-1", PurchaseCost: 120, UsableQty: 1, EffectiveFrom: "2026-02-01", EffectiveTo: "", IsActive: true }
  ];
  var costed = buildCogsRecipeReadModel_(products, recipes, items, pricing, new Date(2026, 0, 2), cogsIngredients)
    .products[0].variants[0];
  var cogsSource = getCogsRecipeReadModel.toString();
  var source = [getProductCatalogReadModel, getInventoryItemsReadModel, getCogsRecipeReadModel].map(function(fn) { return fn.toString(); }).join("\n");
  function spreadsheetFixture(initialValues) {
    var sheets = {}, writes = 0;
    function makeSheet(name, values) {
      return { getDataRange: function() { return { getValues: function() { return values; } }; },
        getRange: function() { return { setValues: function(next) { values = next; writes++; } }; } };
    }
    if (initialValues) sheets[RECIPE_STANDARD_COST_CONTRACT.SHEET] = makeSheet(RECIPE_STANDARD_COST_CONTRACT.SHEET, initialValues);
    return { ss: { getSheetByName: function(name) { return sheets[name] || null; }, insertSheet: function(name) {
      sheets[name] = makeSheet(name, []); return sheets[name]; } },
      values: function() { var sheet = sheets[RECIPE_STANDARD_COST_CONTRACT.SHEET]; return sheet ? sheet.getDataRange().getValues() : null; },
      writes: function() { return writes; } };
  }
  var absent = spreadsheetFixture();
  var created = bootstrapRecipeStandardCostSheet(absent.ss);
  var compatible = spreadsheetFixture([RECIPE_STANDARD_COST_CONTRACT.HEADERS.slice()]);
  var already = bootstrapRecipeStandardCostSheet(compatible.ss);
  var incompatible = spreadsheetFixture([["Wrong", "Schema"], ["BUSINESS", 999]]);
  var refused = bootstrapRecipeStandardCostSheet(incompatible.ss);

  check(created.status === "CREATED" && created.writeCount === 1 && created.businessRows === 0,
    "Bootstrap must create absent Standard Cost storage without business rows");
  check(JSON.stringify(absent.values()) === JSON.stringify([RECIPE_STANDARD_COST_CONTRACT.HEADERS]),
    "Bootstrap must write exact canonical headers only");
  check(already.status === "ALREADY_MIGRATED" && compatible.writes() === 0,
    "Bootstrap must be idempotent for exact schema");
  check(refused.status === "REFUSED_INCOMPATIBLE" && refused.writeCount === 0 && incompatible.writes() === 0,
    "Bootstrap must refuse incompatible schema without mutation");
  check(JSON.stringify(incompatible.values()) === JSON.stringify([["Wrong", "Schema"], ["BUSINESS", 999]]),
    "Bootstrap refusal must preserve existing business values");
  check(catalog[0].ID_Prod === "P-1" && catalog[0].Produk === "Coffee", "Product Catalog must resolve from Products");
  check(inventory[0].ItemID === "I-1" && inventory[0].ItemName === "Beans", "Inventory Items must resolve from InventoryItems");
  check(inventory[0].recipeUsageCount === 1, "Inventory Items must count active recipe usage");
  check(inventory[0].standardCost === null, "Standard Cost must remain pending migration");
  check(catalog[0].ID_Prod !== inventory[0].ItemID, "Product and inventory domains must remain distinct");
  check(composition.components[0].UsageQty === 18 && composition.components[0].BaseUOM === "gr", "UsageQty must remain ingredient quantity");
  check(composition.components[0].ingredientName === "Beans", "Recipe ingredient must resolve to InventoryItems");
  var trimmedKindModel = buildCogsRecipeReadModel_([
    { ID_Prod: "P-1", Produk: "Coffee", Kategori: "Drink", Kind: "  Sellable  ", IsActive: true }
  ], recipes, items, pricing, new Date(2026, 0, 2));
  check(trimmedKindModel.products[0].Kind === "Sellable", "COGS product DTO must expose trimmed active-product Kind");
  check(composition.type === "Hot" && composition.sellingPrice === 15000, "Selling Price must come from ProductPricing.Harga");
  check(composition.components[0].standardCost === null && composition.components[0].componentCost === null,
    "Standard and component costs must remain unavailable pending migration");
  check(composition.computedCOGS === null && composition.margin === null && composition.marginPercent === null,
    "COGS and margin must remain unavailable without Standard Cost");
  check(Object.isFrozen(RECIPE_STANDARD_COST_CONTRACT) && Object.isFrozen(RECIPE_STANDARD_COST_CONTRACT.HEADERS),
    "Recipe Standard Cost schema contract and headers must be frozen");
  check(RECIPE_STANDARD_COST_CONTRACT.STANDARD_COST_APPLY_ACTIVATION === true,
    "Standard Cost Apply activation must be enabled");
  var applySource = applyRecipeStandardCost.toString();
  check(applySource.indexOf("EMPTY_REQUEST") !== -1 && applySource.indexOf("UNKNOWN_ITEM") !== -1 &&
    applySource.indexOf("DUPLICATE_ITEM") !== -1 && applySource.indexOf("INVALID_COST") !== -1 &&
    applySource.indexOf("INVALID_DATE") !== -1 && applySource.indexOf("OVERLAPPING_ACTIVE_PERIOD") !== -1,
    "Apply service must retain every bounded validation rule");
  check(applySource.indexOf('rawCost === "" || rawCost == null ? null') !== -1,
    "Blank Standard Cost must remain null, never zero");
  check(applySource.indexOf("if (errors.length)") < applySource.indexOf("setValues(rows)"),
    "Apply service must validate complete request before one batched write");
  check(applySource.indexOf("getScriptLock") !== -1 && applySource.indexOf("waitLock(30000)") !== -1 &&
    applySource.indexOf("releaseLock") !== -1, "Apply service must hold script lock across validation and write");
  check(applySource.indexOf("ALREADY_APPLIED") !== -1 && applySource.indexOf("writeCount: 0") !== -1,
    "Apply service must make exact retries idempotent");
  check(applySource.indexOf('"", true') !== -1 && applySource.indexOf("SpreadsheetApp.flush()") !== -1,
    "Apply service must append active open-ended temporal rows and flush for read-after-write");
  var wrapperSource = runApplyRecipeStandardCost.toString();
  check(runApplyRecipeStandardCost.length === 0 && wrapperSource.indexOf("STANDARD_COST_APPLY_ACTIVATION") !== -1 &&
    wrapperSource.indexOf('status: "DISABLED"') !== -1,
    "Zero-argument Apply wrapper must retain activation guard");
  var productionCostContract = RECIPE_STANDARD_COST_CONTRACT;
  var productionApplyService = applyRecipeStandardCost;
  var productionSpreadsheetApp = SpreadsheetApp;
  var applyServiceCalls = 0;
  try {
    RECIPE_STANDARD_COST_CONTRACT = Object.freeze({ STANDARD_COST_APPLY_ACTIVATION: false });
    applyRecipeStandardCost = function() { applyServiceCalls++; throw new Error("DISABLED_SERVICE_REACHED"); };
    SpreadsheetApp = { getActiveSpreadsheet: function() { throw new Error("DISABLED_SPREADSHEET_REACHED"); } };
    var disabledApply = runApplyRecipeStandardCost();
    check(disabledApply.status === "DISABLED" && disabledApply.writeCount === 0 && applyServiceCalls === 0,
      "Disabled Apply wrapper must stop before spreadsheet and service boundaries");
    RECIPE_STANDARD_COST_CONTRACT = Object.freeze({ STANDARD_COST_APPLY_ACTIVATION: true });
    applyRecipeStandardCost = function(proposals, ss) {
      applyServiceCalls++;
      return { status: "VALIDATION_FAILED", writeCount: 0, errors: [{ code: "EMPTY_REQUEST" }],
        proposals: proposals, spreadsheet: ss };
    };
    var syntheticSpreadsheet = { fixture: "PRODUCTS_ENABLED_BRANCH" };
    SpreadsheetApp = { getActiveSpreadsheet: function() { return syntheticSpreadsheet; } };
    var enabledApply = runApplyRecipeStandardCost();
    check(applyServiceCalls === 1 && enabledApply.status === "VALIDATION_FAILED" && enabledApply.writeCount === 0 &&
      enabledApply.errors[0].code === "EMPTY_REQUEST" && enabledApply.proposals === undefined &&
      enabledApply.spreadsheet === syntheticSpreadsheet,
      "Enabled Apply wrapper must enter service and preserve zero-argument validation guard");
  } finally {
    RECIPE_STANDARD_COST_CONTRACT = productionCostContract;
    applyRecipeStandardCost = productionApplyService;
    SpreadsheetApp = productionSpreadsheetApp;
  }
  check(resolveRecipeStandardCost("I-1", "2026-01-15", standardCosts) === 100,
    "Temporal resolver must find matching active Standard Cost");
  check(resolveRecipeStandardCost("I-404", "2026-01-15", standardCosts) === null,
    "Missing Standard Cost must return null");
  var overlapRejected = false;
  try {
    resolveRecipeStandardCost("I-1", "2026-01-15", standardCosts.concat([
      { ID: "SC-3", ItemID: "I-1", StandardCost: 90, EffectiveFrom: "2026-01-10", EffectiveTo: "", IsActive: true }
    ]));
  } catch (error) { overlapRejected = error.message.indexOf("overlapping active periods") !== -1; }
  check(overlapRejected, "Temporal resolver must reject overlapping active periods");
  check(costed.components[0].standardCost === 100 && costed.components[0].componentCost === 1800,
    "Component Cost must equal UsageQty times Standard Cost");
  check(costed.computedCOGS === 1800 && costed.margin === 13200 && costed.marginPercent === 88,
    "Computed COGS and margin must derive from complete Standard Cost");
  var mixedRecipes = recipes.concat([{ ID_Recipe: "R-2", ID_Prod: "P-1", Tipe: "Hot", ID_Ingredient: "I-2", UsageQty: 1, IsActive: true }]);
  var mixedItems = items.concat([{ ItemID: "I-2", ItemName: "Milk", BaseUOM: "ml", IsActive: true }]);
  var mixed = buildCogsRecipeReadModel_(products, mixedRecipes, mixedItems, pricing, new Date(2026, 0, 2), cogsIngredients)
    .products[0].variants[0];
  check(mixed.components[1].standardCost === null && mixed.components[1].componentCost === null,
    "Missing Standard Cost must keep component cost null, never zero");
  check(mixed.computedCOGS === null && mixed.margin === null && mixed.marginPercent === null,
    "Any missing component cost must keep COGS and margin null");
  check(cogsRecipe.effectivePeriod.asOf === "2026-01-02" && cogsRecipe.effectivePeriod.standardCostStatus === "NOT_CONFIGURED",
    "Effective-period and Standard Cost configuration context must be explicit");
  var scopedSurface = cogsRecipe.products[0].variants[0].standardCostConfiguration;
  check(Array.isArray(scopedSurface) && scopedSurface.length === 1 && scopedSurface[0].ItemName === "Beans" &&
    scopedSurface[0].Classification === "RAW_MATERIAL" && scopedSurface[0].BaseUOM === "gr" &&
    scopedSurface[0].currentStandardCost === null && scopedSurface[0].resolved === true &&
    !Object.prototype.hasOwnProperty.call(scopedSurface[0], "proposedCost"),
    "Configuration surface must expose selected resolved items with empty current cost and browser-owned proposal state");
  check(scopedSurface[0].resolved === true, "Resolved ingredient must have resolved=true in config");
  var configuredSurface = buildCogsRecipeReadModel_(products, recipes, items, pricing, new Date(2026, 0, 2), cogsIngredients)
    .products[0].variants[0].standardCostConfiguration[0];
  check(configuredSurface.currentStandardCost === 100,
    "Configuration surface must expose current effective unit cost");
  var scopedRecipes = recipes.concat([
    { ID_Recipe: "R-2", ID_Prod: "P-1", Tipe: "Hot", ID_Ingredient: "I-1", UsageQty: 2, IsActive: true },
    { ID_Recipe: "R-3", ID_Prod: "P-1", Tipe: "Cold", ID_Ingredient: "I-2", UsageQty: 5, IsActive: true }
  ]);
  var scopedModel = buildCogsRecipeReadModel_(products, scopedRecipes, mixedItems, pricing.concat([
    { ID_Prod: "P-1", Tipe: "Cold", EffectiveFrom: "2026-01-01", EffectiveTo: "", HPP: 6000, Harga: 16000, IsActive: true }
  ]), new Date(2026, 0, 2), cogsIngredients);
  var hotScope = scopedModel.products[0].variants.filter(function(variant) { return variant.type === "Hot"; })[0];
  var coldScope = scopedModel.products[0].variants.filter(function(variant) { return variant.type === "Cold"; })[0];
  check(hotScope.standardCostConfiguration.length === 1 && hotScope.standardCostConfiguration[0].ItemID === "I-1",
    "Selected variant configuration must deduplicate and exclude other variant ingredients");
  check(coldScope.standardCostConfiguration.length === 1 && coldScope.standardCostConfiguration[0].ItemID === "I-2",
    "Switching variant must rebuild recipe scope");
  var emptyModel = buildCogsRecipeReadModel_(products, [], items, pricing, new Date(2026, 0, 2), standardCosts);
  check(emptyModel.products[0].variants[0].standardCostConfiguration.length === 0,
    "Pricing-only variant must expose empty recipe configuration");
  var unresolvedRecipes = [{ ID_Recipe: "R-U1", ID_Prod: "P-1", Tipe: "Hot", ID_Ingredient: "", UsageQty: 10, IsActive: true }];
  var unresolvedModel = buildCogsRecipeReadModel_(products, unresolvedRecipes, items, pricing, new Date(2026, 0, 2));
  var unresolvedConfig = unresolvedModel.products[0].variants[0].standardCostConfiguration;
  check(unresolvedConfig.length === 1 && unresolvedConfig[0].resolved === false && unresolvedConfig[0].ItemID === null,
    "Unresolved ingredient must appear in config with resolved=false");
  check(unresolvedModel.products[0].variants[0].components.length === 1,
    "Unresolved ingredient must still appear in recipe components");
  check(cogsSource.indexOf("JSON.parse(JSON.stringify({") !== -1 &&
    cogsSource.indexOf("products: Array.isArray(model.products) ? model.products : []") !== -1 &&
    cogsSource.indexOf("try {") === -1 && cogsSource.indexOf("catch (") === -1,
    "Public COGS boundary must return explicit transport-safe DTO without fallback wrapper");
  check(catalog[0].currentHPP.Hot === 5000 && catalog[0].currentHarga.Hot === 15000,
    "Current HPP and Harga must come from ProductPricing");
  check(source.indexOf("InventoryLedger") === -1 && source.indexOf("MWA") === -1,
    "MWA must not become recipe cost authority");
  check(buildCanonicalTransactionData.toString().indexOf("hpp: hpp, price: price") !== -1,
    "tabsal HPP and HJ snapshots must remain transaction inputs");
  ["appendRow(", "setValue(", "setValues(", "insertSheet(", "deleteSheet("].forEach(function(token) {
    check(source.indexOf(token) === -1, "Products domain read models must not mutate: " + token);
  });
  check(source.indexOf('readCanonicalTable(ss, "Products"') !== -1 &&
    source.indexOf('readCanonicalTable(ss, "InventoryItems"') !== -1, "Authoritative sheets must remain explicit");
  var frontendSource = getAssembledFrontendSource();
  [
    'id="cogsRecipeKind" aria-label="Kind"',
    'elements.cogsRecipeKind.addEventListener("change", renderCogsRecipeProducts);',
    'elements.cogsRecipeProduct.addEventListener("change", renderCogsRecipeVariants);',
    'elements.cogsRecipeVariant.addEventListener("change", renderCogsRecipeSelection);',
    'var kinds = Object.create(null);',
    'if (product.Kind) kinds[product.Kind] = true;',
    'return product.Kind === elements.cogsRecipeKind.value;',
    'candidate.ID_Prod === elements.cogsRecipeProduct.value',
    'elements.cogsRecipeProduct.innerHTML = "";',
    'elements.cogsRecipeVariant.innerHTML = "";',
    'elements.standardCostConfigurationBody.innerHTML = "";',
    'if (!cogsRecipeReadModel || !cogsRecipeReadModel.standardCostApplyActivation) { btn.disabled = true; return; }',
    '!elements.cogsRecipeVariant.options.length',
    'No recipe/pricing variant configured.'
  ].forEach(function(token) { check(frontendSource.indexOf(token) !== -1, "COGS Kind cascade contract missing: " + token); });

  Logger.log("PASS: testProductsDomainContract | scenarios=" + scenarios);
  return { passed: true, scenarios: scenarios };
}
