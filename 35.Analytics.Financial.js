function buildFinancial(data)
{
  data = data || [];

  if(!Array.isArray(data))
  {
    return {
      revenue:0,
      expense:0,
      operatingExpense:0,
      inventoryExpense:0,
      assetExpense:0,
      grossProfit:0,
      operatingProfit:0,
      netProfit:0,
      profitMargin:0
    };
  }

  var financial = {
      
    revenue:0,
    expense:0,

    operatingExpense:0,
    inventoryExpense:0,
    assetExpense:0,

    grossProfit:0,
    operatingProfit:0,
    netProfit:0,

    profitMargin:0
  };

  data.forEach(function(row)
  {
    var revenue =
      Number(row.revenue || 0);

    var expense =
      Number(row.expense || 0);

    financial.revenue += revenue;
    financial.expense += expense;

    var category =
      String(
        row.category ||
        row.account ||
        row.transactionCategory ||
        ""
      ).toLowerCase();

    if(
      category.indexOf("aset")>-1 ||
      category.indexOf("asset")>-1 ||
      category.indexOf("equipment")>-1 ||
      category.indexOf("peralatan")>-1
    )
    {
      financial.assetExpense += expense;
      return;
    }

    if(
      category.indexOf("inventory")>-1 ||
      category.indexOf("persediaan")>-1 ||
      category.indexOf("stock")>-1
    )
    {
      financial.inventoryExpense += expense;
      return;
    }

    financial.operatingExpense += expense;

  });

  financial.grossProfit =
    financial.revenue;

  financial.operatingProfit =
    financial.revenue -
    financial.operatingExpense;

  financial.netProfit =
    financial.operatingProfit;

  if(financial.revenue>0)
  {
    financial.profitMargin =
      Number(
        (
          financial.netProfit /
          financial.revenue *
          100
        ).toFixed(1)
      );
  }

  return financial;

}
