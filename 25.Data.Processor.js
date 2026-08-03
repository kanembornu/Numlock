function processTransactions(transactions, priceMap) {
  var result = [];

  for (var i = 1; i < transactions.length; i++) {
    var row = transactions[i];
    var timestamp = row[0];
    var category = String(row[1] || "").trim();
    var transactionType = String(row[2] || "").trim();
    var salesProduct = String(row[3] || "").trim();
    var purchaseCategory = String(row[4] || "").trim();
    var qty = Number(row[5]) || 0;
    var price = Number(row[6]) || 0;
    var revenue = 0;
    var expense = 0;

    if (transactionType === "Sales") {
      var year = new Date(timestamp).getFullYear();
      var yearSuffix = String(year).slice(-2);
      var priceColumn =
        "P" +
        yearSuffix +
        category;

      if (
        priceMap[salesProduct] &&
        priceMap[salesProduct][priceColumn]
      ) {

        revenue =
          qty *
          priceMap[salesProduct][priceColumn];
      }
    }

    if (transactionType === "Purchase") {
      expense = price;
    }

    result.push({
      date: timestamp,
      year: new Date(timestamp).getFullYear(),
      category: category,
      transactionType: transactionType,
      product: salesProduct,
      purchaseCategory: purchaseCategory,
      qty: qty,
      revenue: revenue,
      expense: expense,
      dataQualitySource: {
        quantity: row[5],
        purchaseAmount: row[6]
      }
    });
  }
  return result;
}
