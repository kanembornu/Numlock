function validateAggregate(data)
{
  var aggregate =
    buildAggregate(data);

  var activeDaysCount =
    Object.keys(aggregate.activeDays).length;

  var totalProfit =
    Object.keys(aggregate.monthlyProfit)
      .reduce(function(total, month)
      {
        return total + aggregate.monthlyProfit[month];
      }, 0);

  var expectedBestSeller = null;
  var highestQty = 0;

  Object.keys(aggregate.productQty)
    .forEach(function(product)
    {
      if(aggregate.productQty[product] > highestQty)
      {
        highestQty = aggregate.productQty[product];
        expectedBestSeller = product;
      }
    });

  var expectedTopRevenueProduct = null;
  var highestRevenue = 0;

  Object.keys(aggregate.productRevenue)
    .forEach(function(product)
    {
      if(aggregate.productRevenue[product] > highestRevenue)
      {
        highestRevenue = aggregate.productRevenue[product];
        expectedTopRevenueProduct = product;
      }
    });

  if((aggregate.activeDaysCount || 0) !== activeDaysCount)
  {
    throw new Error("Aggregate active-day count invariant failed");
  }

  if(totalProfit !== aggregate.revenue - aggregate.expense)
  {
    throw new Error("Aggregate profit total invariant failed");
  }

  if(aggregate.bestSeller !== expectedBestSeller)
  {
    throw new Error("Aggregate best-seller invariant failed");
  }

  if(aggregate.topRevenueProduct !== expectedTopRevenueProduct)
  {
    throw new Error("Aggregate top-revenue-product invariant failed");
  }

  Logger.log("========== Aggregate Validation ==========");

  Logger.log(
    "Revenue : " + aggregate.revenue
  );

  Logger.log(
    "Expense : " + aggregate.expense
  );

  Logger.log(
    "Units : " + aggregate.unitsSold
  );

  Logger.log(
    "Best Seller : " + aggregate.bestSeller
  );

  Logger.log(
    "Top Revenue Product : " + aggregate.topRevenueProduct
  );

  Logger.log(
    "Active Days : " + aggregate.activeDaysCount
  );

  Logger.log("==========================================");
}
