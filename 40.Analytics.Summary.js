function buildSummary(data) {
  var revenue = 0;
  var uniqueDays = {};
  var expense = 0;
  var unitsSold = 0;
  var productCounter = {};
  var productRevenue = {};
  data.forEach(function (row) {

    revenue += row.revenue;
    if (row.revenue > 0) {
      var d =
        new Date(row.date);

      var dayKey =
        d.getFullYear() +
        "-" +
        ("0" + (d.getMonth()+1))
          .slice(-2) +
        "-" +
        ("0" + d.getDate())
          .slice(-2);
      uniqueDays[dayKey] = true;
    }

    expense += row.expense;

    if (row.transactionType === "Sales") {
    unitsSold += row.qty;
    }

    if (row.product) {
      productCounter[row.product] =
        (productCounter[row.product] || 0)
        + row.qty;

      productRevenue[row.product] =
        (productRevenue[row.product] || 0)
        + row.revenue
    }
  });

  var bestSeller = "";
  var bestSellerQty = 0;

  for (var product in productCounter) {
    if (productCounter[product] > bestSellerQty) {

      bestSellerQty =
        productCounter[product];

      bestSeller = product;

    }
  }

  var topRevenueProduct = "";
  var topRevenueValue = 0;

  for (var revenueProduct in productRevenue) {

    if (
      productRevenue[revenueProduct]
      > topRevenueValue
    ) {

      topRevenueValue =
        productRevenue[revenueProduct];

      topRevenueProduct =
        revenueProduct;

    }
  }

  var activeDays =
  Object.keys(uniqueDays).length || 1;
  var avgDailyRevenue =
  Math.round(revenue / activeDays);

  return {
    revenue: revenue,
    expense: expense,
    profit: revenue - expense,
    unitsSold: unitsSold,
    bestSeller: bestSeller,
    topRevenueProduct: topRevenueProduct,
    avgDailyRevenue: avgDailyRevenue,
    activeDays: activeDays
  };
}

function validateSummaryMigration(data) {
  var legacySummary =
    buildSummary(data);

  var aggregateSummary =
    buildSummaryFromAggregate(
      buildAggregate(data)
    );

  var fields = [
    "revenue",
    "expense",
    "unitsSold",
    "bestSeller",
    "topRevenueProduct",
    "activeDays",
    "avgDailyRevenue",
    "profit"
  ];

  fields.forEach(function(field) {
    if (
      legacySummary[field] !==
      aggregateSummary[field]
    ) {
      throw new Error(
        "Summary migration mismatch for " +
        field +
        ": legacy=" +
        legacySummary[field] +
        ", aggregate=" +
        aggregateSummary[field]
      );
    }
  });

  return {
    passed: true,
    fields: fields,
    legacy: legacySummary,
    aggregate: aggregateSummary
  };
}
