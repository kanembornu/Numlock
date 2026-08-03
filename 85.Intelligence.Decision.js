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

function buildRiskEngine(cache)
{
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

  if(financial.profitMargin < 10)
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

  if(risks.length >= 3)
  {
    level = "High";
  }
  else if(risks.length >= 1)
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

  if (Number(insights.profitMargin) < 10) {

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

  if (score.score < 80) {

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

  else if (score.score >= 90) {

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
