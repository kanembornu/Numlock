function buildExecutiveSummary(cache)
{
  var score =
    cache.businessScore;

  var revenue =
    cache.revenueIntelligence;

  var profit =
    cache.profitIntelligence;

  var summary = [];

  // Revenue

  if(revenue.direction === "Up")
  {
    summary.push(
      "Revenue menunjukkan tren positif."
    );
  }
  else if(revenue.direction === "Down")
  {
    summary.push(
      "Revenue mengalami penurunan dan memerlukan perhatian."
    );
  }
  else
  {
    summary.push(
      "Belum cukup data untuk menilai tren revenue."
    );
  }

  // Profit

  if(profit.direction === "Up")
  {
    summary.push(
      "Profit berada dalam kondisi yang sehat."
    );
  }
  else if(profit.direction === "Down")
  {
    summary.push(
      "Profit memerlukan perhatian karena margin masih rendah."
    );
  }
  else
  {
    summary.push(
      "Belum cukup data untuk menilai tren profit."
    );
  }

  // Business Score

  switch(score.status)
  {
    case "Excellent":

      summary.push(
        "Kondisi bisnis sangat sehat dan layak dipertahankan."
      );

      break;

    case "Healthy":

      summary.push(
        "Kondisi bisnis sehat dengan beberapa peluang peningkatan."
      );

      break;

    case "Watch":

      summary.push(
        "Performa bisnis perlu dipantau agar tidak mengalami penurunan."
      );

      break;

    default:

      summary.push(
        "Bisnis membutuhkan tindakan perbaikan secepatnya."
      );

      break;
  }

  return summary.join(" ");
}

function clampBusinessPriorityScore(value)
{
  var score =
    Number(value);

  if (!isFinite(score))
  {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, score)
  );
}

function selectBusinessPriorityCandidate(candidates)
{
  var levelOrder = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1
  };

  var sourceOrder = {
    "Data Quality": 1,
    Profitability: 2,
    Risk: 3,
    Revenue: 4,
    Forecast: 5,
    Expense: 6,
    Product: 7,
    Stability: 8
  };

  return (candidates || [])
    .slice()
    .sort(function(a, b)
    {
      var levelDifference =
        (levelOrder[b.level] || 0) -
        (levelOrder[a.level] || 0);

      if (levelDifference !== 0)
      {
        return levelDifference;
      }

      var scoreDifference =
        clampBusinessPriorityScore(b.score) -
        clampBusinessPriorityScore(a.score);

      if (scoreDifference !== 0)
      {
        return scoreDifference;
      }

      return (sourceOrder[a.source] || 99) -
        (sourceOrder[b.source] || 99);
    })[0];
}

function formatBusinessPriorityComparison(periodComparison, metric)
{
  var comparison =
    periodComparison || {};

  var status =
    comparison.status
      ? comparison.status[metric]
      : null;

  var changeKey =
    metric + "Percent";

  var percentage =
    comparison.changes
      ? comparison.changes[changeKey]
      : null;

  if (!status || status === "No Comparison")
  {
    return "No Comparison";
  }

  if (status === "Stable")
  {
    return "Stable 0.0%";
  }

  return status + " " +
    Math.abs(Number(percentage || 0)).toFixed(1) +
    "%";
}

function buildBusinessPriority(cache, dataQuality, scopedRowCount, periodComparison)
{
  var rules =
    KPI_TARGET_CONFIG.RULES.BUSINESS_PRIORITY;

  var summary =
    cache.summary;

  var financial =
    cache.financial;

  var risk =
    cache.riskEngine;

  var revenue =
    cache.revenueIntelligence;

  var forecast =
    cache.forecast;

  var expense =
    cache.expenseIntelligence;

  var concentration =
    cache.revenueConcentration;

  var quality =
    dataQuality || {
      status: "Good",
      issueCount: 0
    };

  var candidates = [];

  function addCandidate(candidate)
  {
    candidates.push({
      level: candidate.level,
      title: candidate.title,
      reason: candidate.reason,
      action: candidate.action,
      source: candidate.source,
      score:
        clampBusinessPriorityScore(
          candidate.score
        ),
      evidence: {
        metric: candidate.evidence.metric,
        value: candidate.evidence.value,
        comparison: candidate.evidence.comparison
      }
    });
  }

  if (quality.status === "Critical")
  {
    addCandidate({
      level: "Critical",
      title: "Resolve Data Quality Issues",
      reason:
        quality.issueCount +
        " data issue(s) may reduce confidence in this dashboard.",
      action:
        "Review the Data Quality details and correct high-severity source records.",
      source: "Data Quality",
      score: 100,
      evidence: {
        metric: "Data quality issues",
        value: quality.issueCount,
        comparison: "Current scope"
      }
    });
  }

  if (Number(scopedRowCount || 0) === 0)
  {
    addCandidate({
      level: "Low",
      title: "No Business Activity",
      reason:
        "No transactions are available for the selected period.",
      action:
        "Select another reporting period or verify source data.",
      source: "Stability",
      score: 10,
      evidence: {
        metric: "Transaction rows",
        value: 0,
        comparison: "Current scope"
      }
    });

    return selectBusinessPriorityCandidate(
      candidates
    );
  }

  if (Number(summary.profit) < 0)
  {
    addCandidate({
      level: "Critical",
      title: "Restore Profitability",
      reason:
        "The selected period has a net loss of Rp " +
        Math.abs(Number(summary.profit)).toLocaleString("id-ID") +
        ".",
      action:
        "Review the largest expenses and pricing, then assign one immediate margin-recovery action.",
      source: "Profitability",
      score: 98,
      evidence: {
        metric: "Net profit",
        value: summary.profit,
        comparison:
          formatBusinessPriorityComparison(
            periodComparison,
            "profit"
          )
      }
    });
  }
  else if (Number(financial.profitMargin) < rules.CRITICALLY_LOW_PROFIT_MARGIN)
  {
    addCandidate({
      level: "High",
      title: "Improve Profit Margin",
      reason:
        "Profit margin is critically low at " +
        Number(financial.profitMargin) +
        "%.",
      action:
        "Compare the largest controllable cost with current pricing and choose one margin improvement.",
      source: "Profitability",
      score: 95,
      evidence: {
        metric: "Profit margin",
        value: financial.profitMargin,
        comparison:
          formatBusinessPriorityComparison(
            periodComparison,
            "profit"
          )
      }
    });
  }

  if (risk.riskLevel === "High")
  {
    addCandidate({
      level: "High",
      title: "Address Active Business Risks",
      reason:
        risk.riskCount +
        " active risks are classified as High.",
      action:
        "Review the risk list and assign an owner to the highest-impact item today.",
      source: "Risk",
      score: 90,
      evidence: {
        metric: "Active risks",
        value: risk.riskCount,
        comparison: "Current scope"
      }
    });
  }

  if (
    revenue.direction === "Down" &&
    Number(revenue.growthRate) <= rules.MATERIAL_REVENUE_DECLINE
  )
  {
    addCandidate({
      level: "High",
      title: "Recover Revenue",
      reason:
        "Revenue declined materially by " +
        Math.abs(Number(revenue.growthRate)) +
        "%.",
      action:
        "Select the strongest product and run one focused sales action for the next reporting period.",
      source: "Revenue",
      score: 85,
      evidence: {
        metric: "Revenue change",
        value: revenue.growthRate,
        comparison:
          formatBusinessPriorityComparison(
            periodComparison,
            "revenue"
          )
      }
    });
  }

  if (Number(forecast.growthRate) < 0)
  {
    addCandidate({
      level: "High",
      title: "Prevent Forecast Decline",
      reason:
        "The revenue forecast is down " +
        Math.abs(Number(forecast.growthRate)) +
        "%.",
      action:
        "Prepare one promotion or retention action before the next forecast period begins.",
      source: "Forecast",
      score: 80,
      evidence: {
        metric: "Forecast growth",
        value: forecast.growthRate,
        comparison: "Forecast rate"
      }
    });
  }

  if (
    expense.highestExpense &&
    Number(expense.expenseShare) >= rules.EXPENSE_CONCENTRATION
  )
  {
    addCandidate({
      level: "Medium",
      title: "Review Expense Concentration",
      reason:
        expense.highestExpense +
        " represents " +
        Number(expense.expenseShare) +
        "% of expenses.",
      action:
        "Review this expense category and identify one saving that preserves operations.",
      source: "Expense",
      score: 70,
      evidence: {
        metric: "Top expense share",
        value: expense.expenseShare,
        comparison:
          formatBusinessPriorityComparison(
            periodComparison,
            "expense"
          )
      }
    });
  }

  if (
    concentration.product &&
    (
      concentration.risk === "High" ||
      Number(concentration.contribution) >= rules.PRODUCT_CONCENTRATION
    )
  )
  {
    addCandidate({
      level: "Medium",
      title: "Strengthen Product Resilience",
      reason:
        concentration.product +
        " contributes " +
        Number(concentration.contribution) +
        "% of revenue.",
      action:
        "Protect availability of this product and identify one secondary revenue contributor.",
      source: "Product",
      score: 60,
      evidence: {
        metric: "Top product contribution",
        value: concentration.contribution,
        comparison:
          formatBusinessPriorityComparison(
            periodComparison,
            "revenue"
          )
      }
    });
  }

  addCandidate({
    level: "Low",
    title: "Maintain Current Performance",
    reason:
      "No higher-priority condition is active for the selected period.",
    action:
      "Continue the current plan and review the next period comparison.",
    source: "Stability",
    score: 20,
    evidence: {
      metric: "Business score",
      value: cache.businessScore.score,
      comparison: "Current scope"
    }
  });

  return selectBusinessPriorityCandidate(
    candidates
  );
}

function buildRiskEngine(cache)
{
  var rules =
    KPI_TARGET_CONFIG.RULES.RISK_ENGINE;

  var risks = [];

  var revenue =
    cache.revenueIntelligence;

  var profit =
    cache.profitIntelligence;

  var forecast =
    cache.forecast;

  var financial =
    cache.financial;

  // Revenue Risk

  if(revenue.direction === "Down")
  {
    risks.push(
      "Revenue turun signifikan"
    );
  }

  // Profit Margin Risk

  if(financial.profitMargin < rules.LOW_PROFIT_MARGIN)
  {
    risks.push(
      "Profit margin rendah"
    );
  }

  // Forecast Risk

  if(forecast.growthRate < 0)
  {
    risks.push(
      "Forecast menunjukkan penurunan"
    );
  }

  // Profit Risk

  if(financial.netProfit < 0)
  {
    risks.push(
      "Bisnis mengalami kerugian"
    );
  }

  var level = "Low";

  if(risks.length >= rules.HIGH_RISK_COUNT)
  {
    level = "High";
  }
  else if(risks.length >= rules.MEDIUM_RISK_COUNT)
  {
    level = "Medium";
  }

  return{

    riskLevel:
      level,

    riskCount:
      risks.length,

    risks:
      risks

  };

}

function buildBusinessFocus(cache) {

  var rules =
    KPI_TARGET_CONFIG.RULES.BUSINESS_FOCUS;

  var score =
    cache.businessScore;

  var revenue =
    cache.revenueIntelligence;

  var profit =
    cache.profitIntelligence;

  var forecast =
    cache.forecast;

  var insights =
    cache.insights;

  // 1. Profit Margin

  if (Number(insights.profitMargin) < rules.LOW_PROFIT_MARGIN) {

    return {

      focus:
        "Improve Profit Margin",

      priority:
        "Critical",

      reason:
        "Profit margin hanya " +
        insights.profitMargin +
        "%.",

      expectedImpact:
        "High"

    };

  }

  // 2. Revenue

  if (revenue.direction === "Down") {

    return {

      focus:
        "Increase Revenue",

      priority:
        "High",

      reason:
        "Revenue menunjukkan tren menurun.",

      expectedImpact:
        "High"

    };

  }

  // 3. Forecast

  if (forecast.growthRate < 0) {

    return {

      focus:
        "Prevent Revenue Decline",

      priority:
        "High",

      reason:
        "Forecast menunjukkan penurunan revenue.",

      expectedImpact:
        "Medium"

    };

  }

  // 4. Profit

  if (profit.direction === "Down") {

    return {

      focus:
        "Recover Profit",

      priority:
        "Medium",

      reason:
        "Profit mengalami penurunan.",

      expectedImpact:
        "Medium"

    };

  }

  // 5. Business Score

  if (score.score < rules.OPTIMIZATION_SCORE) {

    return {

      focus:
        "Business Optimization",

      priority:
        "Medium",

      reason:
        "Business Health masih dapat ditingkatkan.",

      expectedImpact:
        "Medium"

    };

  }

  return {

    focus:
      "Maintain Current Strategy",

    priority:
      "Low",

    reason:
      "Seluruh indikator bisnis berada dalam kondisi baik.",

    expectedImpact:
      "Low"

  };

}

function buildExecutiveAlert(cache) {

  var rules =
    KPI_TARGET_CONFIG.RULES.EXECUTIVE_ALERT;

  var risk =
    cache.riskEngine;

  var score =
    cache.businessScore;

  var focus =
    cache.businessFocus;

  var title =
    "Business Stable";

  var level =
    "Good";

  var color =
    "Green";

  var message =
    "Tidak ada kondisi kritis yang memerlukan tindakan segera.";

  if (risk.riskLevel === "High") {

    title =
      "Immediate Action Required";

    level =
      "Critical";

    color =
      "Red";

    message =
      focus.reason;

  }

  else if (risk.riskLevel === "Medium") {

    title =
      "Monitor Business";

    level =
      "Warning";

    color =
      "Amber";

    message =
      focus.reason;

  }

  else if (score.score >= rules.EXCELLENT_SCORE) {

    title =
      "Business Performing Well";

    level =
      "Excellent";

    color =
      "Green";

    message =
      "Pertahankan strategi bisnis saat ini.";

  }

  return {

    title: title,

    level: level,

    color: color,

    message: message

  };

}
