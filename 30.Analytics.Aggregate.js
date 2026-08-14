function buildAggregate(data)
{
  var aggregate =
  {
    revenue:0,
    expense:0,
    unitsSold:0,
    hotQty:0,
    coldQty:0,

    activeDays:{},

    productQty:{},

    productRevenue:{},

    bestSeller:null,

    topRevenueProduct:null,

    monthlyRevenue:{},

    dailyRevenue:{},

    monthlyExpense:{},

    monthlyProfit:{},

    expenseCategory:{},

    topExpense:null

  };

  data.forEach(function(row)
  {
    var revenue =
      Number(row.revenue || 0);

    var expense =
      Number(row.expense || 0);

    var qty =
      Number(row.qty || 0);

    aggregate.revenue += revenue;

    aggregate.expense += expense;

    if(row.transactionType === "Sales")
    {
      aggregate.unitsSold += qty;

      if(row.category === "Hot")
      {
        aggregate.hotQty += qty;
      }

      if(row.category === "Cold")
      {
        aggregate.coldQty += qty;
      }
    }

    if(revenue > 0)
    {
      var dayKey = row.dateKey || canonicalDateKey(new Date(row.date));

      aggregate.activeDays[dayKey] = true;

        aggregate.dailyRevenue[dayKey] =
          (aggregate.dailyRevenue[dayKey] || 0)
          + revenue;
        var monthKey = row.monthKey || dayKey.slice(0, 7);

        aggregate.monthlyRevenue[monthKey] =
          (aggregate.monthlyRevenue[monthKey] || 0)
          + revenue;

        aggregate.monthlyExpense[monthKey] =
          (aggregate.monthlyExpense[monthKey] || 0)
          + expense;
    }

    if(row.product)
    {
      aggregate.productQty[row.product] =
        (aggregate.productQty[row.product] || 0)
        + qty;

      aggregate.productRevenue[row.product] =
        (aggregate.productRevenue[row.product] || 0)
        + revenue;
    }

    if(row.purchaseCategory)
    {
      var expenseKey =
        row.purchaseCategory;

      aggregate.expenseCategory[expenseKey] =
        (aggregate.expenseCategory[expenseKey] || 0)
        + expense;
    }

    var profitMonthKey = row.monthKey || canonicalDateKey(new Date(row.date)).slice(0, 7);

    aggregate.monthlyProfit[profitMonthKey] =
      (aggregate.monthlyProfit[profitMonthKey] || 0)
      + revenue
      - expense;
  
  aggregate.activeDaysCount =
  Object.keys(
    aggregate.activeDays
  ).length;

  });

  var maxQty = 0;
  var maxRevenue = 0;

  Object.keys(aggregate.productQty)
  .forEach(function(product)
  {
    if(aggregate.productQty[product] > maxQty)
    {
      maxQty =
        aggregate.productQty[product];

      aggregate.bestSeller =
        product;
    }
  });

  Object.keys(aggregate.productRevenue)
  .forEach(function(product)
  {
    if(aggregate.productRevenue[product] > maxRevenue)
    {
      maxRevenue =
        aggregate.productRevenue[product];

      aggregate.topRevenueProduct =
        product;
    }
  });

  var highestExpense = 0;

  Object.keys(
    aggregate.expenseCategory
  )
  .forEach(function(category)
  {
    if(
      aggregate.expenseCategory[category]
      >
      highestExpense
    )
    {
      highestExpense =
        aggregate.expenseCategory[category];

      aggregate.topExpense =
      {
        category:category,
        amount:highestExpense
      };
    }
  });

  return aggregate;

}

function buildSummaryFromAggregate(aggregate) {
  var activeDays =
    aggregate.activeDaysCount || 1;
  var representedMonths =
    Object.keys(aggregate.monthlyProfit || {}).length;
  var averageMonthlyRevenue =
    representedMonths > 0
      ? aggregate.revenue / representedMonths
      : 0;

  return {
    revenue: aggregate.revenue,
    expense: aggregate.expense,
    profit:
      aggregate.revenue - aggregate.expense,
    unitsSold: aggregate.unitsSold,
    bestSeller:
      aggregate.bestSeller || "",
    topRevenueProduct:
      aggregate.topRevenueProduct || "",
    avgDailyRevenue:
      Math.round(
        aggregate.revenue / activeDays
      ),
    activeDays: activeDays,
    representedMonths: representedMonths,
    averageMonthlyRevenue: averageMonthlyRevenue
  };
}

function buildRevenueTrendFromAggregate(aggregate)
{
  var labels =
    Object.keys(
      aggregate.monthlyRevenue
    )
    .sort();

  var values =
    labels.map(function(label)
    {
      return aggregate.monthlyRevenue[label];
    });

  return {
    labels:labels,
    values:values
  };
}

function advanceRevenueDateKey(dateKey)
{
  var parts = dateKey.split("-");
  var date = new Date(Date.UTC(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]) + 1
  ));

  return date.getUTCFullYear() +
    "-" + ("0" + (date.getUTCMonth() + 1)).slice(-2) +
    "-" + ("0" + date.getUTCDate()).slice(-2);
}

function buildDailyRevenueTrendFromAggregate(aggregate, dateRange)
{
  var labels = [];
  var cursor = dateRange.startDate;

  while (cursor <= dateRange.endDate)
  {
    labels.push(cursor);
    cursor = advanceRevenueDateKey(cursor);
  }

  return {
    labels: labels,
    values: labels.map(function(label)
    {
      return aggregate.dailyRevenue[label] || 0;
    }),
    granularity: "day"
  };
}

function buildProfitTrendFromAggregate(aggregate) {

  var labels =
    Object.keys(
      aggregate.monthlyProfit
    )
    .sort();

  var values =
    labels.map(function(label) {

      return aggregate.monthlyProfit[label];

    });

  return {
    labels: labels,
    values: values
  };

}

function buildHotColdSplitFromAggregate(aggregate) {

  return {
    hot: aggregate.hotQty,
    cold: aggregate.coldQty
  };

}

function buildTopProductsFromAggregate(aggregate) {

  return Object.keys(
    aggregate.productQty
  )
  .map(function(product) {

    return {
      name: product,
      qty: aggregate.productQty[product],
      revenue:
        aggregate.productRevenue[product]
    };

  })
  .sort(function(a, b) {

    return b.qty - a.qty;

  })
  .slice(0, 10);

}

function buildExpenseBreakdownFromAggregate(aggregate) {

  return Object.keys(
    aggregate.expenseCategory
  )
  .map(function(category) {

    return {
      category: category,
      amount:
        aggregate.expenseCategory[category]
    };

  });

}
