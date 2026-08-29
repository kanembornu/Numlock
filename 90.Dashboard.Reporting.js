function buildPeriodComparisonMetrics(data, range) {

  var metrics = {
    startDate: range.startDate,
    endDate: range.endDate,
    rowCount: 0,
    revenue: 0,
    expense: 0,
    profit: 0,
    unitsSold: 0
  };

  (data || []).forEach(function(row)
  {
    var revenue =
      Number(row && row.revenue || 0);

    var expense =
      Number(row && row.expense || 0);

    var quantity =
      Number(row && row.qty || 0);

    metrics.rowCount++;
    metrics.revenue +=
      isFinite(revenue)
        ? revenue
        : 0;
    metrics.expense +=
      isFinite(expense)
        ? expense
        : 0;

    if (row && row.transactionType === "Sales")
    {
      metrics.unitsSold +=
        isFinite(quantity)
          ? quantity
          : 0;
    }
  });

  metrics.profit =
    metrics.revenue -
    metrics.expense;

  metrics.profitMargin =
    metrics.revenue > 0
      ? Number(((metrics.profit / metrics.revenue) * 100).toFixed(1))
      : 0;

  return metrics;
}

function calculateFiniteComparison(currentValue, previousValue, isProfit) {

  var current =
    Number(currentValue);

  var previous =
    Number(previousValue);

  if (!isFinite(current) || !isFinite(previous))
  {
    return {
      percentage: null,
      status: "No Comparison"
    };
  }

  if (previous === 0)
  {
    return current === 0
      ? {
          percentage: 0,
          status: "Stable"
        }
      : {
          percentage: null,
          status: "No Comparison"
        };
  }

  if (!isProfit && previous < 0)
  {
    return {
      percentage: null,
      status: "No Comparison"
    };
  }

  var denominator =
    isProfit
      ? Math.abs(previous)
      : previous;

  var percentage =
    ((current - previous) /
      denominator) * 100;

  if (!isFinite(percentage))
  {
    return {
      percentage: null,
      status: "No Comparison"
    };
  }

  return {
    percentage:
      Number(
        percentage.toFixed(1)
      ),
    status:
      current > previous
        ? "Up"
        : current < previous
          ? "Down"
          : "Stable"
  };
}

function buildPeriodComparison(currentRows, previousRows, currentRange, previousRange) {

  var current =
    buildPeriodComparisonMetrics(
      currentRows,
      currentRange
    );

  var previous =
    buildPeriodComparisonMetrics(
      previousRows,
      previousRange
    );

  var revenue =
    calculateFiniteComparison(
      current.revenue,
      previous.revenue,
      false
    );

  var expense =
    calculateFiniteComparison(
      current.expense,
      previous.expense,
      false
    );

  var profit =
    calculateFiniteComparison(
      current.profit,
      previous.profit,
      true
    );

  var unitsSold =
    calculateFiniteComparison(
      current.unitsSold,
      previous.unitsSold,
      false
    );

  if (current.rowCount === 0)
  {
    revenue = { percentage: null, status: "No Comparison" };
    expense = { percentage: null, status: "No Comparison" };
    profit = { percentage: null, status: "No Comparison" };
    unitsSold = { percentage: null, status: "No Comparison" };
  }

  var profitMarginPoints =
    current.rowCount > 0 && previous.rowCount > 0
      ? Number((current.profitMargin - previous.profitMargin).toFixed(1))
      : null;

  return {
    current: current,
    previous: previous,
    changes: {
      revenuePercent: revenue.percentage,
      expensePercent: expense.percentage,
      profitPercent: profit.percentage,
      profitMarginPoints: profitMarginPoints,
      unitsSoldPercent: unitsSold.percentage
    },
    status: {
      revenue: revenue.status,
      expense: expense.status,
      profit: profit.status,
      profitMargin:
        profitMarginPoints === null
          ? "No Comparison"
          : profitMarginPoints > 0
            ? "Up"
            : profitMarginPoints < 0
              ? "Down"
              : "Stable",
      unitsSold: unitsSold.status
    },
    label: previousRange.label
  };
}

function buildReportingMetadata(scopedData, dateRange, referenceDate) {

  var timezone =
    Session.getScriptTimeZone();

  if (!timezone)
  {
    throw new Error(
      "Reporting metadata requires a project timezone"
    );
  }

  var generatedDate =
    new Date(referenceDate || new Date());

  var today =
    Utilities.formatDate(
      generatedDate,
      timezone,
      "yyyy-MM-dd"
    );

  var rows =
    scopedData || [];

  var salesCount = 0;
  var purchaseCount = 0;
  var firstTransactionDate = null;
  var lastTransactionDate = null;
  var latestTimestamp = null;

  rows.forEach(function(row)
  {
    if (row && row.transactionType === "Sales")
    {
      salesCount++;
    }

    if (row && row.transactionType === "Purchase")
    {
      purchaseCount++;
    }

    var transactionDate =
      new Date(row && row.date);

    if (isNaN(transactionDate.getTime()))
    {
      return;
    }

    var dateKey;

    try
    {
      dateKey =
        Utilities.formatDate(
          transactionDate,
          timezone,
          "yyyy-MM-dd"
        );
    }
    catch (error)
    {
      return;
    }

    if (
      firstTransactionDate === null ||
      dateKey < firstTransactionDate
    )
    {
      firstTransactionDate = dateKey;
    }

    if (
      lastTransactionDate === null ||
      dateKey > lastTransactionDate
    )
    {
      lastTransactionDate = dateKey;
    }

    if (
      latestTimestamp === null ||
      transactionDate.getTime() > latestTimestamp.getTime()
    )
    {
      latestTimestamp = transactionDate;
    }
  });

  var filter =
    dateRange.filter;

  var todayParts =
    today.split("-");

  var year =
    Number(todayParts[0]);

  var month =
    Number(todayParts[1]);

  var monthEnd =
    shiftDashboardDateKey(
      createDashboardDateKey(
        year,
        month + 1,
        1
      ),
      -1
    );

  var isPartialPeriod = false;

  if (filter === "currentMonth")
  {
    isPartialPeriod =
      today !== monthEnd;
  }
  else if (filter === "currentYear")
  {
    isPartialPeriod =
      today !== createDashboardDateKey(year, 12, 31);
  }

  var status = "Stale";

  if (rows.length === 0)
  {
    status = "No Data";
  }
  else if (lastTransactionDate === today)
  {
    status = "Current";
  }

  return {
    reportingScope: {
      rowCount: rows.length,
      transactionCount: rows.length,
      salesCount: salesCount,
      purchaseCount: purchaseCount,
      firstTransactionDate: firstTransactionDate,
      lastTransactionDate: lastTransactionDate,
      isPartialPeriod: isPartialPeriod
    },
    dataFreshness: {
      lastTransactionAt:
        latestTimestamp
          ? latestTimestamp.toISOString()
          : null,
      generatedAt:
        generatedDate.toISOString(),
      timezone: timezone,
      status: status
    }
  };
}
