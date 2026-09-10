function buildProductContribution(cache) {

  var products =
    cache.topProducts
      .slice()
      .sort(function(a,b){

        return b.revenue - a.revenue;

      });

  var totalRevenue =
    cache.summary.revenue;

  return products.map(function(p){

    return {

      name:
        p.name,

      revenue:
        p.revenue,

      qty:
        p.qty,

      contribution:

        totalRevenue > 0

        ? Number(
            (
              p.revenue /
              totalRevenue *
              100
            ).toFixed(1)
          )

        : 0

    };

  });

}

function buildRevenueConcentration(cache) {

  var products =
    cache.productContribution;

  if (!products.length) {

    return {

      product: "-",

      contribution: 0,

      risk: "Low"

    };

  }

  var top =
    products[0];

  var risk =
    "Low";

  if (top.contribution >= 40) {

    risk = "High";

  }
  else if (
    top.contribution >= 25
  ) {

    risk = "Medium";

  }

  return {

    product:
      top.name,

    contribution:
      top.contribution,

    risk:
      risk

  };

}

function buildProductProfitability(canonicalRecords, productsMap, comparisonRecords, period, comparisonPeriod) {
  var productMap = {};
  var totalRevenue = 0;
  var totalCogs = 0;
  var totalUnits = 0;
  var totalTransactionCount = 0;
  var quality = { missingIdentity: [], missingHpp: [], ungovernedType: [] };

  (canonicalRecords || []).forEach(function(row) {
    if (row.transactionType !== "Sales") return;
    if (!row.productIsActive) return;

    var productId = String(row.productId || "").trim();
    var productName = (productsMap && productsMap[productId])
      ? String(productsMap[productId].Produk || "").trim()
      : String(row.product || "").trim();
    var category = String(row.productCategory || "").trim();
    var type = String(row.type || "").trim();
    var qty = Number(row.qty || 0);
    var revenue = Number(row.revenue || 0);
    var cogs = Number(row.cogs || 0);

    if (!productId || !productName) {
      quality.missingIdentity.push({ transactionId: String(row.id || ""), productId: productId });
      return;
    }

    if (isNaN(Number(row.hpp)) || row.hpp === null || row.hpp === undefined) {
      quality.missingHpp.push({ transactionId: String(row.id || ""), productId: productId, type: type });
    }

    if (type !== "Hot" && type !== "Cold") {
      quality.ungovernedType.push({ transactionId: String(row.id || ""), productId: productId, type: type });
    }

    var key = productId + "|" + type;

    if (!productMap[key]) {
      productMap[key] = {
        productId: productId,
        productName: productName,
        category: category,
        type: type,
        units: 0,
        revenue: 0,
        cogs: 0,
        transactionCount: 0
      };
    }

    productMap[key].units += qty;
    productMap[key].revenue += revenue;
    productMap[key].cogs += cogs;
    productMap[key].transactionCount += 1;

    totalUnits += qty;
    totalRevenue += revenue;
    totalCogs += cogs;
    totalTransactionCount += 1;
  });

  var productKeys = Object.keys(productMap);

  productKeys.forEach(function(key) {
    var p = productMap[key];
    p.grossProfit = p.revenue - p.cogs;
    p.grossMargin = p.revenue !== 0 ? Number(((p.grossProfit / p.revenue) * 100).toFixed(1)) : null;
    p.averageSellingPrice = p.units !== 0 ? Number((p.revenue / p.units).toFixed(2)) : null;
    p.averageCogsPerUnit = p.units !== 0 ? Number((p.cogs / p.units).toFixed(2)) : null;
    p.grossProfitPerUnit = p.units !== 0 ? Number((p.grossProfit / p.units).toFixed(2)) : null;
    p.revenueMix = totalRevenue !== 0 ? p.revenue / totalRevenue : null;
    p.grossProfitMix = null;
  });

  var totalGrossProfit = totalRevenue - totalCogs;

  productKeys.forEach(function(key) {
    var p = productMap[key];
    p.grossProfitMix = totalGrossProfit !== 0 ? p.grossProfit / totalGrossProfit : null;
  });

  var sortedByRevenue = productKeys.slice().sort(function(a, b) {
    return productMap[b].revenue - productMap[a].revenue ||
      productMap[a].productId.localeCompare(productMap[b].productId);
  });
  var sortedByGp = productKeys.slice().sort(function(a, b) {
    return productMap[b].grossProfit - productMap[a].grossProfit ||
      productMap[a].productId.localeCompare(productMap[b].productId);
  });
  var sortedByUnits = productKeys.slice().sort(function(a, b) {
    return productMap[b].units - productMap[a].units ||
      productMap[a].productId.localeCompare(productMap[b].productId);
  });

  sortedByRevenue.forEach(function(key, index) { productMap[key].revenueRank = index + 1; });
  sortedByGp.forEach(function(key, index) { productMap[key].grossProfitRank = index + 1; });
  sortedByUnits.forEach(function(key, index) { productMap[key].unitsRank = index + 1; });

  var topRevenue = sortedByRevenue.length ? productMap[sortedByRevenue[0]] : null;
  var topGp = sortedByGp.length ? productMap[sortedByGp[0]] : null;
  var topUnits = sortedByUnits.length ? productMap[sortedByUnits[0]] : null;

  var result = {
    productVariantCount: productKeys.length,
    distinctProductCount: (function() {
      var seen = {};
      productKeys.forEach(function(key) { seen[productMap[key].productId] = true; });
      return Object.keys(seen).length;
    })(),
    units: totalUnits,
    revenue: totalRevenue,
    cogs: totalCogs,
    grossProfit: totalGrossProfit,
    grossMargin: totalRevenue !== 0 ? Number(((totalGrossProfit / totalRevenue) * 100).toFixed(1)) : null,
    transactionCount: totalTransactionCount,
    topRevenueProduct: topRevenue ? topRevenue.productId + " (" + topRevenue.productName + ")" : null,
    topGrossProfitProduct: topGp ? topGp.productId + " (" + topGp.productName + ")" : null,
    topUnitsProduct: topUnits ? topUnits.productId + " (" + topUnits.productName + ")" : null,
    productMap: productMap,
    quality: quality
  };

  if (comparisonPeriod && comparisonRecords) {
    result.comparisonData = buildProductProfitabilityComparison(
      productMap, canonicalRecords, comparisonRecords, productsMap, period, comparisonPeriod);
  }

  return result;
}

function buildProductProfitabilityComparison(currentProductMap, currentRecords, comparisonRecords, productsMap, currentPeriod, comparisonPeriod) {
  var compProductMap = {};
  var totalRevenue = 0;
  var totalCogs = 0;
  var totalUnits = 0;
  var totalTransactionCount = 0;

  (comparisonRecords || []).forEach(function(row) {
    if (row.transactionType !== "Sales") return;
    if (!row.productIsActive) return;

    var productId = String(row.productId || "").trim();
    var productName = (productsMap && productsMap[productId])
      ? String(productsMap[productId].Produk || "").trim()
      : String(row.product || "").trim();
    var type = String(row.type || "").trim();
    var qty = Number(row.qty || 0);
    var revenue = Number(row.revenue || 0);
    var cogs = Number(row.cogs || 0);

    var key = productId + "|" + type;

    if (!compProductMap[key]) {
      compProductMap[key] = { productId: productId, productName: productName, type: type, units: 0, revenue: 0, cogs: 0, transactionCount: 0 };
    }

    compProductMap[key].units += qty;
    compProductMap[key].revenue += revenue;
    compProductMap[key].cogs += cogs;
    compProductMap[key].transactionCount += 1;

    totalUnits += qty;
    totalRevenue += revenue;
    totalCogs += cogs;
    totalTransactionCount += 1;
  });

  Object.keys(compProductMap).forEach(function(key) {
    var p = compProductMap[key];
    p.grossProfit = p.revenue - p.cogs;
    p.grossMargin = p.revenue !== 0 ? Number(((p.grossProfit / p.revenue) * 100).toFixed(1)) : null;
  });

  var totalGrossProfit = totalRevenue - totalCogs;

  var compSortedByRevenue = Object.keys(compProductMap).slice().sort(function(a, b) {
    return compProductMap[b].revenue - compProductMap[a].revenue ||
      a.localeCompare(b);
  });
  var compSortedByGp = Object.keys(compProductMap).slice().sort(function(a, b) {
    return compProductMap[b].grossProfit - compProductMap[a].grossProfit ||
      a.localeCompare(b);
  });
  var compSortedByUnits = Object.keys(compProductMap).slice().sort(function(a, b) {
    return compProductMap[b].units - compProductMap[a].units ||
      a.localeCompare(b);
  });

  compSortedByRevenue.forEach(function(key, index) { compProductMap[key].revenueRank = index + 1; });
  compSortedByGp.forEach(function(key, index) { compProductMap[key].grossProfitRank = index + 1; });
  compSortedByUnits.forEach(function(key, index) { compProductMap[key].unitsRank = index + 1; });

  var compSummary = {
    productVariantCount: Object.keys(compProductMap).length,
    distinctProductCount: (function() {
      var seen = {};
      Object.keys(compProductMap).forEach(function(key) { seen[compProductMap[key].productId] = true; });
      return Object.keys(seen).length;
    })(),
    units: totalUnits,
    revenue: totalRevenue,
    cogs: totalCogs,
    grossProfit: totalGrossProfit,
    grossMargin: totalRevenue !== 0 ? Number(((totalGrossProfit / totalRevenue) * 100).toFixed(1)) : null,
    transactionCount: totalTransactionCount
  };

  var compHotCold = { hot: { units: 0, revenue: 0, cogs: 0, grossProfit: 0, grossMargin: null, transactionCount: 0 }, cold: { units: 0, revenue: 0, cogs: 0, grossProfit: 0, grossMargin: null, transactionCount: 0 } };

  Object.keys(compProductMap).forEach(function(key) {
    var p = compProductMap[key];
    var target = p.type === "Hot" ? compHotCold.hot : p.type === "Cold" ? compHotCold.cold : null;
    if (!target) return;
    target.units += p.units;
    target.revenue += p.revenue;
    target.cogs += p.cogs;
    target.grossProfit += p.grossProfit;
    target.transactionCount += p.transactionCount;
  });

  compHotCold.hot.grossMargin = compHotCold.hot.revenue !== 0 ? Number(((compHotCold.hot.grossProfit / compHotCold.hot.revenue) * 100).toFixed(1)) : null;
  compHotCold.cold.grossMargin = compHotCold.cold.revenue !== 0 ? Number(((compHotCold.cold.grossProfit / compHotCold.cold.revenue) * 100).toFixed(1)) : null;

  return { summary: compSummary, hotCold: compHotCold, productMap: compProductMap };
}

function getProductProfitabilityDataWithRuntime(runtime, filter, customStart, customEnd) {
  var ss = runtime.spreadsheet;
  var canonicalData = getCanonicalTransactionData(ss);
  var products = readCanonicalTable(ss, "Products", ["ID_Prod", "Produk", "Kategori", "Kind", "IsActive"]);
  var productsMap = {};
  products.forEach(function(p) {
    productsMap[String(p.ID_Prod || "").trim()] = p;
  });

  var period = resolveDashboardDateRange(filter, customStart, customEnd);
  var scopedRecords = filterTransactionsByDateRange(canonicalData.records || [], period);

  var comparisonPeriod = null;
  var compScopedRecords = null;
  try {
    comparisonPeriod = resolvePreviousComparisonDateRange(period);
    compScopedRecords = filterTransactionsByDateRange(canonicalData.records || [], comparisonPeriod);
  } catch (e) {
    comparisonPeriod = null;
    compScopedRecords = null;
  }

  var profitability = buildProductProfitability(
    scopedRecords, productsMap, compScopedRecords, period, comparisonPeriod);

  var summary = {
    productVariantCount: profitability.productVariantCount,
    distinctProductCount: profitability.distinctProductCount,
    units: profitability.units,
    revenue: profitability.revenue,
    cogs: profitability.cogs,
    grossProfit: profitability.grossProfit,
    grossMargin: profitability.grossMargin,
    transactionCount: profitability.transactionCount,
    topRevenueProduct: profitability.topRevenueProduct,
    topGrossProfitProduct: profitability.topGrossProfitProduct,
    topUnitsProduct: profitability.topUnitsProduct
  };

  var productKeys = Object.keys(profitability.productMap);
  var hotCold = { hot: { units: 0, revenue: 0, cogs: 0, grossProfit: 0, grossMargin: null, transactionCount: 0 }, cold: { units: 0, revenue: 0, cogs: 0, grossProfit: 0, grossMargin: null, transactionCount: 0 } };

  productKeys.forEach(function(key) {
    var p = profitability.productMap[key];
    var target = p.type === "Hot" ? hotCold.hot : p.type === "Cold" ? hotCold.cold : null;
    if (!target) return;
    target.units += p.units;
    target.revenue += p.revenue;
    target.cogs += p.cogs;
    target.grossProfit += p.grossProfit;
    target.transactionCount += p.transactionCount;
  });

  hotCold.hot.grossMargin = hotCold.hot.revenue !== 0 ? Number(((hotCold.hot.grossProfit / hotCold.hot.revenue) * 100).toFixed(1)) : null;
  hotCold.cold.grossMargin = hotCold.cold.revenue !== 0 ? Number(((hotCold.cold.grossProfit / hotCold.cold.revenue) * 100).toFixed(1)) : null;

  var compMap = (profitability.comparisonData && profitability.comparisonData.productMap) || {};
  var products = productKeys.slice().sort(function(a, b) {
    return profitability.productMap[b].revenue - profitability.productMap[a].revenue ||
      a.localeCompare(b);
  }).map(function(key) {
    var p = profitability.productMap[key];
    var entry = {
      productId: p.productId,
      productName: p.productName,
      category: p.category,
      type: p.type,
      units: p.units,
      revenue: p.revenue,
      cogs: p.cogs,
      grossProfit: p.grossProfit,
      grossMargin: p.grossMargin,
      averageSellingPrice: p.averageSellingPrice,
      averageCogsPerUnit: p.averageCogsPerUnit,
      grossProfitPerUnit: p.grossProfitPerUnit,
      revenueMix: p.revenueMix,
      grossProfitMix: p.grossProfitMix,
      transactionCount: p.transactionCount,
      revenueRank: p.revenueRank,
      grossProfitRank: p.grossProfitRank,
      unitsRank: p.unitsRank,
      comparisonRevenue: null,
      comparisonGrossProfit: null,
      revenueChange: null,
      grossProfitChange: null
    };

    var comp = compMap[key];
    if (comp) {
      entry.comparisonRevenue = comp.revenue;
      entry.comparisonGrossProfit = comp.grossProfit;
      entry.revenueChange = comp.revenue !== 0 ? (p.revenue - comp.revenue) / comp.revenue : null;
      entry.grossProfitChange = comp.grossProfit !== 0 ? (p.grossProfit - comp.grossProfit) / comp.grossProfit : null;
    }

    return entry;
  });

  var productsRevenueSum = products.reduce(function(sum, p) { return sum + p.revenue; }, 0);
  var productsCogsSum = products.reduce(function(sum, p) { return sum + p.cogs; }, 0);
  var productsGpSum = products.reduce(function(sum, p) { return sum + p.grossProfit; }, 0);
  var reconciliation = {
    revenueMatch: Math.abs(productsRevenueSum - summary.revenue) < 0.000001,
    cogsMatch: Math.abs(productsCogsSum - summary.cogs) < 0.000001,
    grossProfitMatch: Math.abs(productsGpSum - summary.grossProfit) < 0.000001
  };

  var qualityIssues = profitability.quality.missingIdentity.length +
    profitability.quality.missingHpp.length + profitability.quality.ungovernedType.length;

  var quality = {
    missingIdentity: profitability.quality.missingIdentity,
    missingHpp: profitability.quality.missingHpp,
    ungovernedType: profitability.quality.ungovernedType,
    issueCount: qualityIssues,
    status: qualityIssues === 0 ? "GOOD" : "ATTENTION"
  };

  return {
    status: "SUCCESS",
    error: null,
    period: {
      startDate: period.startDate,
      endDate: period.endDate,
      label: period.label,
      filter: period.filter
    },
    comparisonPeriod: comparisonPeriod ? {
      startDate: comparisonPeriod.startDate,
      endDate: comparisonPeriod.endDate,
      label: comparisonPeriod.label
    } : null,
    summary: summary,
    hotCold: hotCold,
    products: products,
    reconciliation: reconciliation,
    quality: quality
  };
}

function getProductProfitabilityData(filter, customStart, customEnd) {
  return getProductProfitabilityDataWithRuntime({
    spreadsheet: requireNumlockProductionSpreadsheet()
  }, filter, customStart, customEnd);
}

function buildParetoAnalysis(cache) {
    if (
    !cache ||
    !cache.productContribution
  ) {

    return {

      totalProducts: 0,
      criticalProducts: 0,
      ratio: 0,
      concentration: "Unknown"

    };

  }

  var products =
    cache.productContribution
      .slice()
      .sort(function(a,b){

        return b.revenue - a.revenue;

      });

  if (!products.length) {

    return {

      totalProducts: 0,
      criticalProducts: 0,
      ratio: 0,
      concentration: "Low"

    };

  }

  var totalRevenue =
    cache.summary.revenue;

  var running = 0;

  var count = 0;

  for (
    var i = 0;
    i < products.length;
    i++
  ) {

    running +=
      products[i].revenue;

    count++;

    if (
      running
      >=
      totalRevenue * 0.8
    ) {

      break;

    }

  }

    return {

      totalProducts:
        products.length,

      criticalProducts:
        count,

      ratio:
        Number(
          (
            count /
            products.length *
            100
          ).toFixed(1)
        ),

      concentration:

        count <= products.length * 0.3
        ? "High"

        : count <= products.length * 0.6
        ? "Medium"

        : "Low"

    };

}
