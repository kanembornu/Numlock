function buildTopProducts(data) {

  var products = {};

  data.forEach(function (row) {


    if (!row.product) return;

    if (!products[row.product]) {

      products[row.product] = {

        name: row.product,

        qty: 0,

        revenue: 0

      };

    }

    products[row.product].qty += row.qty;

    products[row.product].revenue +=
      row.revenue;

  });

  return Object
    .values(products)
    .sort(function (a, b) {

      return b.qty - a.qty;

    })
    .slice(0, 10);

}

function validateProductMigration(data) {

  var legacyProducts =
    buildTopProducts(data);

  var aggregate =
    buildAggregate(data);

  var aggregateProducts =
    buildTopProductsFromAggregate(
      aggregate
    );

  if (
    JSON.stringify(legacyProducts) !==
    JSON.stringify(aggregateProducts)
  ) {
    throw new Error(
      "Product migration mismatch: legacy=" +
      JSON.stringify(legacyProducts) +
      ", aggregate=" +
      JSON.stringify(aggregateProducts)
    );
  }

  return {
    passed: true,
    legacy: legacyProducts,
    aggregate: aggregateProducts,
    bestSeller: aggregate.bestSeller,
    topRevenueProduct:
      aggregate.topRevenueProduct
  };

}

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
