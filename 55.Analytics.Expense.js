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

function buildExpenseBreakdown(data) {

  var expenses = {};

  data.forEach(function (row) {


    if (!row.purchaseCategory)
      return;

    expenses[row.purchaseCategory] =
      (expenses[row.purchaseCategory]
        || 0)
      + row.expense;

  });

  return Object.keys(expenses)
    .map(function (key) {

      return {

        category: key,

        amount: expenses[key]

      };

    });

}

function validateExpenseBreakdownMigration(data) {

  var legacyExpenses =
    buildExpenseBreakdown(data);

  var aggregateExpenses =
    buildExpenseBreakdownFromAggregate(
      buildAggregate(data)
    );

  function sortExpenses(expenses) {

    return expenses.slice()
      .sort(function(a, b) {

        if (a.category < b.category) {
          return -1;
        }

        if (a.category > b.category) {
          return 1;
        }

        return 0;

      });

  }

  var sortedLegacy =
    sortExpenses(legacyExpenses);

  var sortedAggregate =
    sortExpenses(aggregateExpenses);

  if (
    JSON.stringify(sortedLegacy) !==
    JSON.stringify(sortedAggregate)
  ) {
    throw new Error(
      "Expense breakdown migration mismatch: legacy=" +
      JSON.stringify(sortedLegacy) +
      ", aggregate=" +
      JSON.stringify(sortedAggregate)
    );
  }

  return {
    passed: true,
    legacy: legacyExpenses,
    aggregate: aggregateExpenses
  };

}
