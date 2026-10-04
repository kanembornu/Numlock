var PRODUCTS_DOMAIN_CONTRACT = Object.freeze({
  PRODUCT_HEADERS: Object.freeze(["ID_Prod", "Produk", "Kategori", "Kind", "RevenueAccountCode", "COGSAccountCode", "IsActive"]),
  PRICING_HEADERS: Object.freeze(["ID_Prod", "Tipe", "EffectiveFrom", "EffectiveTo", "HPP", "Harga", "IsActive"]),
  RECIPE_HEADERS: Object.freeze(["ID_Recipe", "ID_Prod", "Tipe", "ID_Ingredient", "UsageQty", "IsActive"])
});

var RECIPE_STANDARD_COST_CONTRACT = Object.freeze({
  SHEET: "RecipeStandardCost",
  HEADERS: Object.freeze(["ID", "ItemID", "StandardCost", "EffectiveFrom", "EffectiveTo", "IsActive",
    "CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy"]),
  TEMPORAL_KEY: "ItemID + effective period",
  OVERLAP_POLICY: "REJECT overlapping active periods",
  STANDARD_COST_APPLY_ACTIVATION: true
});

function runBootstrapRecipeStandardCost() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return bootstrapRecipeStandardCostSheet(ss);
}

function bootstrapRecipeStandardCostSheet(ss) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var sheet = ss.getSheetByName(RECIPE_STANDARD_COST_CONTRACT.SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(RECIPE_STANDARD_COST_CONTRACT.SHEET);
      sheet.getRange(1, 1, 1, RECIPE_STANDARD_COST_CONTRACT.HEADERS.length)
        .setValues([RECIPE_STANDARD_COST_CONTRACT.HEADERS.slice()]);
      return { status: "CREATED", sheet: RECIPE_STANDARD_COST_CONTRACT.SHEET, writeCount: 1, businessRows: 0 };
    }
    var values = sheet.getDataRange().getValues();
    var headers = values[0] || [];
    if (JSON.stringify(headers) !== JSON.stringify(RECIPE_STANDARD_COST_CONTRACT.HEADERS)) {
      return { status: "REFUSED_INCOMPATIBLE", sheet: RECIPE_STANDARD_COST_CONTRACT.SHEET,
        writeCount: 0, businessRows: Math.max(0, values.length - 1) };
    }
    return { status: "ALREADY_MIGRATED", sheet: RECIPE_STANDARD_COST_CONTRACT.SHEET,
      writeCount: 0, businessRows: Math.max(0, values.length - 1) };
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function applyRecipeStandardCost(proposals, ss) {
  var lock = LockService.getScriptLock(), acquired = false;
  try {
    lock.waitLock(30000); acquired = true;
    var errors = [], request = Array.isArray(proposals) ? proposals : [];
    if (!request.length) errors.push({ index: null, field: "proposals", code: "EMPTY_REQUEST" });
    var items = readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS);
    var itemMap = buildCanonicalMasterMap(items, "ItemID", "InventoryItems");
    var sheet = ss.getSheetByName(RECIPE_STANDARD_COST_CONTRACT.SHEET);
    if (!sheet) errors.push({ index: null, field: "RecipeStandardCost", code: "MISSING_SHEET" });
    var existing = sheet ? readCanonicalTable(ss, RECIPE_STANDARD_COST_CONTRACT.SHEET,
      RECIPE_STANDARD_COST_CONTRACT.HEADERS) : [];
    var seen = Object.create(null), normalized = [];
    request.forEach(function(proposal, index) {
      var itemID = String(proposal && proposal.ItemID || "").trim();
      var rawCost = proposal ? proposal.StandardCost : null;
      var cost = rawCost === "" || rawCost == null ? null : Number(rawCost);
      var effectiveFrom = canonicalDate(proposal && proposal.EffectiveFrom);
      if (!itemID || !itemMap[itemID]) errors.push({ index: index, field: "ItemID", code: "UNKNOWN_ITEM" });
      if (seen[itemID]) errors.push({ index: index, field: "ItemID", code: "DUPLICATE_ITEM" });
      seen[itemID] = true;
      if (cost != null && (!isFinite(cost) || cost < 0)) errors.push({ index: index, field: "StandardCost", code: "INVALID_COST" });
      if (!effectiveFrom) errors.push({ index: index, field: "EffectiveFrom", code: "INVALID_DATE" });
      normalized.push({ ItemID: itemID, StandardCost: cost, EffectiveFrom: effectiveFrom });
    });
    normalized.forEach(function(proposal, index) {
      if (!proposal.EffectiveFrom) return;
      var startKey = canonicalDateKey(proposal.EffectiveFrom);
      proposal.alreadyApplied = existing.some(function(row) {
        var rowCost = row.StandardCost === "" || row.StandardCost == null ? null : Number(row.StandardCost);
        return String(row.ItemID || "").trim() === proposal.ItemID && isCanonicalActive(row.IsActive) &&
          canonicalDateKey(canonicalDate(row.EffectiveFrom)) === startKey && rowCost === proposal.StandardCost;
      });
      var overlaps = existing.some(function(row) {
        if (String(row.ItemID || "").trim() !== proposal.ItemID || !isCanonicalActive(row.IsActive)) return false;
        var start = canonicalDate(row.EffectiveFrom);
        var end = row.EffectiveTo === "" || row.EffectiveTo == null ? null : canonicalDate(row.EffectiveTo);
        return start && canonicalDateKey(start) <= startKey && (!end || startKey <= canonicalDateKey(end));
      });
      if (overlaps && !proposal.alreadyApplied) errors.push({ index: index, field: "EffectiveFrom", code: "OVERLAPPING_ACTIVE_PERIOD" });
    });
    if (errors.length) return { status: "VALIDATION_FAILED", writeCount: 0, errors: errors.slice(0, 100) };
    var pending = normalized.filter(function(proposal) { return !proposal.alreadyApplied; });
    if (!pending.length) return { status: "ALREADY_APPLIED", writeCount: 0, errors: [] };
    var now = new Date(), actor = Session.getActiveUser().getEmail(), rows = pending.map(function(proposal) {
      return [Utilities.getUuid(), proposal.ItemID, proposal.StandardCost, proposal.EffectiveFrom, "", true,
        now, actor, now, actor];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, RECIPE_STANDARD_COST_CONTRACT.HEADERS.length).setValues(rows);
    SpreadsheetApp.flush();
    return { status: "APPLIED", writeCount: rows.length, errors: [] };
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function resolveRecipeStandardCostRecord_(itemID, effectiveDate, standardCostRows) {
  var itemKey = String(itemID || "").trim();
  var date = canonicalDate(effectiveDate);
  if (!date) throw new Error("Recipe Standard Cost requires a valid effective date");
  var matches = (standardCostRows || []).filter(function(row) {
    var start = canonicalDate(row.EffectiveFrom);
    var end = row.EffectiveTo === "" || row.EffectiveTo == null ? null : canonicalDate(row.EffectiveTo);
    return String(row.ItemID || "").trim() === itemKey && isCanonicalActive(row.IsActive) &&
      start && start <= date && (!end || date <= end);
  });
  if (matches.length > 1) throw new Error("RecipeStandardCost overlapping active periods for " + itemKey);
  return matches.length ? matches[0] : null;
}

function resolveRecipeStandardCost(itemID, effectiveDate, standardCostRows) {
  var row = resolveRecipeStandardCostRecord_(itemID, effectiveDate, standardCostRows);
  if (!row || row.StandardCost === "" || row.StandardCost == null) return null;
  return Number(row.StandardCost);
}

function buildRecipeCostSummary_(components, sellingPrice) {
  var complete = components.every(function(component) { return component.componentCost != null; });
  var computedCOGS = complete ? components.reduce(function(total, component) { return total + component.componentCost; }, 0) : null;
  var price = sellingPrice === "" || sellingPrice == null ? null : Number(sellingPrice);
  var margin = computedCOGS == null || price == null ? null : price - computedCOGS;
  return { computedCOGS: computedCOGS, margin: margin,
    marginPercent: margin == null || price === 0 ? null : margin / price * 100 };
}

function productsDomainCurrentPricing_(rows, referenceDate) {
  var current = Object.create(null);
  (rows || []).forEach(function(row) {
    var start = canonicalDate(row.EffectiveFrom);
    var end = row.EffectiveTo === "" || row.EffectiveTo == null ? null : canonicalDate(row.EffectiveTo);
    if (!isCanonicalActive(row.IsActive) || !start || start > referenceDate || end && referenceDate > end) return;
    var key = String(row.ID_Prod || "").trim();
    var type = String(row.Tipe || "").trim();
    if (!key || !type) return;
    current[key] = current[key] || Object.create(null);
    if (current[key][type]) throw new Error("ProductPricing expected one current record for " + key + "|" + type);
    current[key][type] = row;
  });
  return current;
}

function buildProductCatalogReadModel_(products, pricing, recipes, referenceDate, items) {
  var current = productsDomainCurrentPricing_(pricing, referenceDate);
  var itemMap = buildCanonicalMasterMap(items || [], "ItemID", "InventoryItems");
  var recipeCounts = Object.create(null), recipeComponents = Object.create(null);
  (recipes || []).forEach(function(recipe) {
    var productId = String(recipe.ID_Prod || "").trim();
    if (!productId || !isCanonicalActive(recipe.IsActive)) return;
    recipeCounts[productId] = (recipeCounts[productId] || 0) + 1;
    var type = String(recipe.Tipe || "").trim();
    var item = itemMap[String(recipe.ID_Ingredient || "").trim()] || null;
    recipeComponents[productId] = recipeComponents[productId] || Object.create(null);
    recipeComponents[productId][type] = recipeComponents[productId][type] || [];
    recipeComponents[productId][type].push({ ingredientName: item ? item.ItemName : "—",
      UsageQty: recipe.UsageQty, BaseUOM: item ? item.BaseUOM : "—" });
  });
  return (products || []).map(function(product) {
    var productId = String(product.ID_Prod || "").trim();
    var variants = current[productId] || Object.create(null);
    var hpp = Object.create(null), harga = Object.create(null), hasPricing = false;
    Object.keys(variants).forEach(function(type) {
      hasPricing = true;
      hpp[type] = variants[type].HPP;
      harga[type] = variants[type].Harga;
    });
    return { ID_Prod: productId, Produk: product.Produk, Kategori: product.Kategori, Kind: product.Kind,
      IsActive: isCanonicalActive(product.IsActive), hasPricing: hasPricing, currentHPP: hpp,
      currentHarga: harga, recipeCount: recipeCounts[productId] || 0,
      recipeComponents: recipeComponents[productId] || Object.create(null) };
  });
}

function getProductCatalogReadModel() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return buildProductCatalogReadModel_(
    readCanonicalTable(ss, "Products", PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS),
    readCanonicalTable(ss, "ProductPricing", PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS),
    readCanonicalTable(ss, "COGSRecipes", PRODUCTS_DOMAIN_CONTRACT.RECIPE_HEADERS), new Date(),
    readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS));
}

function buildInventoryItemsReadModel_(items, recipes, cogsIngredients) {
  var counts = Object.create(null);
  (recipes || []).forEach(function(recipe) {
    var itemId = String(recipe.ID_Ingredient || "").trim();
    if (itemId && isCanonicalActive(recipe.IsActive)) counts[itemId] = (counts[itemId] || 0) + 1;
  });
  var effectiveDate = new Date();
  return (items || []).map(function(item) {
    var itemId = String(item.ItemID || "").trim();
    var standardCost = resolveCOGSIngredientStandardCost(itemId, effectiveDate, cogsIngredients);
    return { ItemID: itemId, ItemName: item.ItemName, Classification: item.Classification,
      BaseUOM: item.BaseUOM, IsActive: isCanonicalActive(item.IsActive),
      recipeUsageCount: counts[itemId] || 0, standardCost: standardCost };
  });
}

function getInventoryItemsReadModel() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ingredientHeaders = ["ID_Ingredient", "Ingredient", "Category", "PurchaseUnit", "UsableQty",
    "BaseUnit", "PurchaseCost", "EffectiveFrom", "EffectiveTo", "IsActive", "CreatedAt", "UpdatedAt"];
  return buildInventoryItemsReadModel_(
    readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS),
    readCanonicalTable(ss, "COGSRecipes", PRODUCTS_DOMAIN_CONTRACT.RECIPE_HEADERS),
    readCanonicalTable(ss, "COGSIngredients", ingredientHeaders));
}

function resolveCOGSIngredientStandardCost(itemId, effectiveDate, ingredients) {
  var key = String(itemId || "").trim();
  var date = canonicalDate(effectiveDate);
  if (!key || !date) return null;
  var match = (ingredients || []).find(function(row) {
    if (String(row.ID_Ingredient || "").trim() !== key) return false;
    if (!isCanonicalActive(row.IsActive)) return false;
    var start = canonicalDate(row.EffectiveFrom);
    var end = row.EffectiveTo === "" || row.EffectiveTo == null ? null : canonicalDate(row.EffectiveTo);
    return start && start <= date && (!end || date <= end);
  });
  if (!match) return null;
  var cost = Number(match.PurchaseCost);
  var usable = Number(match.UsableQty);
  if (!isFinite(cost) || cost < 0 || !isFinite(usable) || usable <= 0) return null;
  return cost / usable;
}

function buildCogsRecipeReadModel_(products, recipes, items, pricing, referenceDate, cogsIngredients) {
  var itemMap = buildCanonicalMasterMap(items || [], "ItemID", "InventoryItems");
  var effectiveDate = canonicalDate(referenceDate || new Date());
  if (!effectiveDate) throw new Error("COGS Recipe requires a valid reference date");
  var currentPricing = productsDomainCurrentPricing_(pricing || [], effectiveDate);
  var activeRecipes = Object.create(null);
  (recipes || []).forEach(function(recipe) {
    if (!isCanonicalActive(recipe.IsActive)) return;
    var productId = String(recipe.ID_Prod || "").trim();
    var type = String(recipe.Tipe || "").trim();
    if (!productId || (type !== "Hot" && type !== "Cold")) return;
    activeRecipes[productId] = activeRecipes[productId] || Object.create(null);
    activeRecipes[productId][type] = activeRecipes[productId][type] || [];
    var itemId = String(recipe.ID_Ingredient || "").trim();
    var item = itemMap[itemId] || null;
    var standardCost = resolveCOGSIngredientStandardCost(itemId, effectiveDate, cogsIngredients);
    activeRecipes[productId][type].push({
      itemID: itemId,
      ingredientName: item ? item.ItemName : "Unknown ingredient",
      Classification: item ? item.Classification : "—",
      UsageQty: recipe.UsageQty,
      BaseUOM: item ? item.BaseUOM : "—",
      standardCost: standardCost,
      componentCost: standardCost == null ? null : Number(recipe.UsageQty) * standardCost
    });
  });
  return {
    effectivePeriod: { asOf: canonicalDateKey(effectiveDate),
      standardCostStatus: cogsIngredients && cogsIngredients.length ? "CONFIGURED" : "NOT_CONFIGURED" },
    products: (products || []).filter(function(product) { return isCanonicalActive(product.IsActive); }).map(function(product) {
      var productId = String(product.ID_Prod || "").trim();
      var recipeVariants = activeRecipes[productId] || Object.create(null);
      var priceVariants = currentPricing[productId] || Object.create(null);
      return {
        ID_Prod: productId,
        Produk: product.Produk,
        Kind: String(product.Kind || "").trim(),
        variants: ["Cold", "Hot"].filter(function(type) { return recipeVariants[type] || priceVariants[type]; }).map(function(type) {
          var price = priceVariants[type] || null;
          var components = recipeVariants[type] || [];
          var summary = buildRecipeCostSummary_(components, price ? price.Harga : null);
          var configured = Object.create(null);
          var standardCostConfiguration = components.map(function(component) {
            var resolved = !!(component.itemID);
            var duplicate = resolved && configured[component.itemID];
            if (resolved) configured[component.itemID] = true;
            if (duplicate) return null;
            return { ItemID: component.itemID || null, ItemName: component.ingredientName,
              Classification: component.Classification, BaseUOM: component.BaseUOM,
              UsageQty: component.UsageQty,
              currentStandardCost: component.standardCost,
              resolved: resolved };
          }).filter(function(item) { return item !== null; });
          return { type: type, components: components, standardCostConfiguration: standardCostConfiguration,
            computedCOGS: summary.computedCOGS, sellingPrice: price ? price.Harga : null,
            margin: summary.margin, marginPercent: summary.marginPercent,
            effectiveFrom: price ? price.EffectiveFrom : null, effectiveTo: price ? price.EffectiveTo || null : null };
        })
      };
    }).filter(function(product) { return product.variants.length > 0; })
  };
}

function getCogsRecipeReadModel() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var referenceDate = new Date();
  var ingredientHeaders = ["ID_Ingredient", "Ingredient", "Category", "PurchaseUnit", "UsableQty",
    "BaseUnit", "PurchaseCost", "EffectiveFrom", "EffectiveTo", "IsActive", "CreatedAt", "UpdatedAt"];
  var model = buildCogsRecipeReadModel_(
    readCanonicalTable(ss, "Products", PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS),
    readCanonicalTable(ss, "COGSRecipes", PRODUCTS_DOMAIN_CONTRACT.RECIPE_HEADERS),
    readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS),
    readCanonicalTable(ss, "ProductPricing", PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS),
    referenceDate,
    readCanonicalTable(ss, "COGSIngredients", ingredientHeaders));
  return JSON.parse(JSON.stringify({
    effectivePeriod: {
      asOf: String(model.effectivePeriod.asOf),
      standardCostStatus: String(model.effectivePeriod.standardCostStatus)
    },
    standardCostApplyActivation: RECIPE_STANDARD_COST_CONTRACT.STANDARD_COST_APPLY_ACTIVATION,
    products: Array.isArray(model.products) ? model.products : []
  }));
}

function diagnoseCogsRecipeRuntime() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rows = Object.create(null);
  var results = [];

  function run(step, operation, rowCount) {
    try {
      var value = operation();
      results.push({ step: step, status: "PASS", rowCount: rowCount ? rowCount(value) : null, error: null });
      return value;
    } catch (error) {
      results.push({ step: step, status: "FAIL", rowCount: null,
        error: error && error.message ? error.message : String(error) });
      return null;
    }
  }

  rows.Products = run("readCanonicalTable Products", function() {
    return readCanonicalTable(ss, "Products", PRODUCTS_DOMAIN_CONTRACT.PRODUCT_HEADERS);
  }, function(value) { return value.length; });
  if (!rows.Products) return results;

  rows.ProductPricing = run("readCanonicalTable ProductPricing", function() {
    return readCanonicalTable(ss, "ProductPricing", PRODUCTS_DOMAIN_CONTRACT.PRICING_HEADERS);
  }, function(value) { return value.length; });
  if (!rows.ProductPricing) return results;

  rows.COGSRecipes = run("readCanonicalTable COGSRecipes", function() {
    return readCanonicalTable(ss, "COGSRecipes", PRODUCTS_DOMAIN_CONTRACT.RECIPE_HEADERS);
  }, function(value) { return value.length; });
  if (!rows.COGSRecipes) return results;

  rows.InventoryItems = run("readCanonicalTable InventoryItems", function() {
    return readCanonicalTable(ss, "InventoryItems", BALANCE_FOUNDATION_POLICY.INVENTORY_ITEM_HEADERS);
  }, function(value) { return value.length; });
  if (!rows.InventoryItems) return results;

  if (!run("buildCanonicalMasterMap InventoryItems ItemID", function() {
    return buildCanonicalMasterMap(rows.InventoryItems, "ItemID", "InventoryItems");
  }, function() { return rows.InventoryItems.length; })) return results;

  if (!run("productsDomainCurrentPricing_", function() {
    return productsDomainCurrentPricing_(rows.ProductPricing, new Date());
  }, function(value) { return Object.keys(value).length; })) return results;

  run("buildCogsRecipeReadModel_", function() {
    return buildCogsRecipeReadModel_(rows.Products, rows.COGSRecipes, rows.InventoryItems, rows.ProductPricing, new Date());
  }, function(value) { return value.products.length; });
  return results;
}
