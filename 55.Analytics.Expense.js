function buildExpenseIntelligence(cache) {

  var expenses =
    cache.expenseBreakdown;

  if (!expenses.length) {

    return {
      highestExpense: "-",
      highestAmount: 0,
      expenseShare: 0
    };

  }

  expenses.sort(function(a,b){
    return b.amount - a.amount;
  });

  var topExpense =
    expenses[0];

  var totalExpense = 0;

  expenses.forEach(function(e){
    totalExpense += e.amount;
  });

  var share = 0;

  if (totalExpense > 0) {

    share =
      (
        topExpense.amount
        /
        totalExpense
      ) * 100;

  }

  return {

    highestExpense:
      topExpense.category,

    highestAmount:
      topExpense.amount,

    expenseShare:
      Number(
        share.toFixed(1)
      )
  };
}
