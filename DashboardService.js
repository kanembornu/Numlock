function getDashboardData() {

  var ss =
    SpreadsheetApp
      .getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processedData =
    processTransactions(
      transactions,
      priceMap);

  var cache =
  buildAnalyticsCache(
    processedData
  );

    return {
      summary:
        cache.summary,

      financial:
        cache.financial,

      insights:
        cache.insights,

      revenueTrend:
        cache.revenueTrend,

      hotColdSplit:
        cache.hotColdSplit,

      topProducts:
        cache.topProducts,

      expenseBreakdown:
        cache.expenseBreakdown,

      recentTransactions:
        buildRecentTransactions(processedData),

      diagnosis:
        buildDiagnosis(processedData, cache),

      forecast:
        cache.forecast,
      
      businessScore:
        cache.businessScore,

      revenueIntelligence:
        cache.revenueIntelligence,

      expenseIntelligence:
        cache.expenseIntelligence,

      profitIntelligence:
        cache.profitIntelligence,

      profitTrend:
        cache.profitTrend,

      executiveSummary:
        cache.executiveSummary,

      priorityAction:
        cache.priorityAction,

      riskEngine:
        cache.riskEngine,

      growthScore:
        cache.growthScore,

      recommendations:
        buildRecommendationEngine(cache),

      opportunities:
        buildOpportunityEngine(cache),

      kpiStatus:
        cache.kpiStatus,

      productContribution:
        cache.productContribution,

      revenueConcentration:
        cache.revenueConcentration,

      paretoAnalysis:
        cache.paretoAnalysis,

      businessFocus:
        cache.businessFocus,

      executiveAlert:
        cache.executiveAlert,
      
      actionRoadmap:
        cache.actionRoadmap,

      businessMaturity:
        cache.businessMaturity,

      kpiAchievement:
        cache.kpiAchievement,

    };
}


function validateAggregate(data)
{
  var aggregate =
    buildAggregate(data);

  var summary =
    buildSummary(data);

  Logger.log("========== Aggregate Validation ==========");

  Logger.log(
    "Revenue : " +
    aggregate.revenue +
    " | " +
    summary.revenue
  );

  Logger.log(
    "Expense : " +
    aggregate.expense +
    " | " +
    summary.expense
  );

  Logger.log(
    "Units : " +
    aggregate.unitsSold +
    " | " +
    summary.unitsSold
  );

  Logger.log(
    "Best Seller : " +
    aggregate.bestSeller +
    " | " +
    summary.bestSeller
  );

  Logger.log(
    "Top Revenue Product : " +
    aggregate.topRevenueProduct +
    " | " +
    summary.topRevenueProduct
  );

  Logger.log(
    "Active Days : " +
    aggregate.activeDaysCount +
    " | " +
    summary.activeDays
  );

  Logger.log("==========================================");
}

function testAggregate()
{
  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  validateAggregate(processed);
}



function testSummaryMigration() {
  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateSummaryMigration(processed);
}





function testRevenueTrendMigration()
{
  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateRevenueTrendMigration(processed);
}



function buildBusinessScore(cache)
{
  var summary =
    cache.summary;

  var financial =
    cache.financial;

  var insights =
    cache.insights;

  var score = 100;

  // Profit Margin

  if(financial.profitMargin < 5)
  {
    score -= 35;
  }
  else if(financial.profitMargin < 10)
  {
    score -= 25;
  }
  else if(financial.profitMargin < 15)
  {
    score -= 10;
  }

  // Revenue

  if(financial.revenue < 1000000)
  {
    score -= 15;
  }

  // Units Sold

  if(summary.unitsSold < 100)
  {
    score -= 10;
  }

  score =
    Math.max(0,Math.round(score));

  var status;

  if(score >= 90)
  {
    status = "Excellent";
  }
  else if(score >= 75)
  {
    status = "Healthy";
  }
  else if(score >= 60)
  {
    status = "Watch";
  }
  else
  {
    status = "Critical";
  }

  return{

    score:score,

    status:status,

    breakdown:
    {
      profitMargin:
        financial.profitMargin,

      revenue:
        financial.revenue,

      unitsSold:
        summary.unitsSold
    }

  };

}

function buildRevenueIntelligence(cache)
{
  var trend = cache.revenueTrend;
  var values = trend.values;

  if(values.length < 2)
  {
    return{
      direction:"Stable",
      growthRate:0,
      momentum:"Neutral"
    };
  }

  // gunakan dua bulan terakhir yang sudah complete

  var current =
    values[values.length-2];

  var previous =
    values[values.length-3];

  if(previous == null)
  {
    previous = current;
  }

  var growth = 0;

  if(previous > 0)
  {
    growth =
      ((current-previous)/previous)*100;
  }

  return{

    direction:
      growth>=0
      ?"Up"
      :"Down",

    growthRate:
      Number(growth.toFixed(1)),

    momentum:

      Math.abs(growth)>=15
      ?"Strong"

      :Math.abs(growth)>=5
      ?"Moderate"

      :"Stable"

  };

}


function buildProfitIntelligence(cache)
{
  var financial =
    cache.financial;

  if(!financial)
  {
    return{
      direction:"Stable",
      changeRate:0,
      status:"Neutral"
    };
  }

  var margin =
    Number(financial.profitMargin || 0);

  return{

    direction:
      margin >= 0
      ? "Up"
      : "Down",

    changeRate:
      Math.abs(margin),

    status:

      margin >= 15
      ? "Strong"

      : margin >= 10
      ? "Healthy"

      : margin >= 5
      ? "Watch"

      : margin >= 0
      ? "Thin"

      : "Loss"

  };

}




function testProfitTrendMigration() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateProfitTrendMigration(
    processed
  );

}

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
  else
  {
    summary.push(
      "Revenue mengalami penurunan dan memerlukan perhatian."
    );
  }

  // Profit

  if(profit.direction === "Up")
  {
    summary.push(
      "Profit berada dalam kondisi yang sehat."
    );
  }
  else
  {
    summary.push(
      "Profit memerlukan perhatian karena margin masih rendah."
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

function buildRecommendationEngine(cache)
{
  var insights =
    cache.insights;

  var score =
    cache.businessScore;

  var revenue =
    cache.revenueIntelligence;

  var summary =
    cache.summary;

  var forecast =
    cache.forecast;

  var recommendations = [];

  // Profit Margin

  if(Number(insights.profitMargin) < 10)
  {
    recommendations.push({

      priority:"High",

      score:100,

      message:
        "Profit margin hanya " +
        insights.profitMargin +
        "%. Evaluasi struktur biaya dan harga jual."

    });
  }

  // Revenue Trend

  if(revenue.direction === "Down")
  {
    recommendations.push({

      priority:"High",

      score:90,

      message:
        "Revenue turun " +
        Math.abs(revenue.growthRate) +
        "%. Fokus pada peningkatan penjualan produk unggulan."

    });
  }

  // Forecast

  if(forecast.growthRate < 0)
  {
    recommendations.push({

      priority:"High",

      score:95,

      message:
        "Forecast menunjukkan penurunan revenue bulan depan sebesar " +
        Math.abs(forecast.growthRate) +
        "%. Disarankan segera meningkatkan penjualan atau menjalankan promosi."

    });
  }
  else
  {
    recommendations.push({

      priority:"Low",

      score:20,

      message:
        "Forecast menunjukkan pertumbuhan revenue sebesar " +
        forecast.growthRate +
        "%. Pertahankan strategi yang berjalan saat ini."

    });
  }

  // Best Seller

  if(summary.bestSeller)
  {
    recommendations.push({

      priority:"Medium",

      score:40,

      message:
        summary.bestSeller +
        " merupakan produk terlaris. Pertimbangkan bundling atau upselling."

    });
  }

  // Top Revenue Product

  if(summary.topRevenueProduct)
  {
    recommendations.push({

      priority:"Medium",

      score:35,

      message:
        summary.topRevenueProduct +
        " menghasilkan revenue terbesar. Pastikan stok selalu tersedia."

    });
  }

  // Top Expense

  if(insights.topExpense && insights.topExpense.amount > 0)
  {
    recommendations.push({

      priority:"Medium",

      score:70,

      message:
        insights.topExpense.category +
        " adalah biaya terbesar. Cari peluang efisiensi tanpa mengganggu operasional."

    });
  }

  // Business Score

  if(score.score < 70)
  {
    recommendations.push({

      priority:"High",

      score:85,

      message:
        "Business Score masih di bawah target ideal. Fokus pada profitabilitas dan pertumbuhan revenue."

    });
  }

  recommendations.sort(function(a,b)
  {
    return b.score - a.score;
  });

  return recommendations;
}

function buildPriorityAction(cache) {

  var recommendations =
    buildRecommendationEngine(cache);

  if (
    !recommendations ||
    !recommendations.length
  ) {

    return {

      title:
        "No Action Needed",

      impact:
        "Low",

      score: 0,

      message:
        "Tidak ada tindakan prioritas saat ini."

    };

  }

  var top =
    recommendations[0];

  var title =
    "Business Improvement";

  if (
    top.message.indexOf(
      "Profit margin"
    ) >= 0
  ) {

    title =
      "Improve Profit Margin";

  }

  else if (
    top.message.indexOf(
      "Revenue turun"
    ) >= 0
  ) {

    title =
      "Increase Revenue";

  }

  else if (
    top.message.indexOf(
      "Forecast"
    ) >= 0
  ) {

    title =
      "Prevent Revenue Decline";

  }

  return {

    title: title,

    impact:
      top.priority,

    score:
      top.score,

    message:
      top.message

  };

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

function buildGrowthScore(cache)
{
  var score = 0;

  var revenue =
    cache.revenueIntelligence;

  var forecast =
    cache.forecast;

  var financial =
    cache.financial;

  var insights =
    cache.insights;

  // Revenue Trend (30)

  if(revenue.direction === "Up")
  {
    score += 30;
  }
  else
  {
    score += 10;
  }

  // Forecast (30)

  if(forecast.growthRate >= 10)
  {
    score += 30;
  }
  else if(forecast.growthRate >= 0)
  {
    score += 20;
  }
  else
  {
    score += 5;
  }

  // Profit Margin (20)

  if(financial.profitMargin >= 15)
  {
    score += 20;
  }
  else if(financial.profitMargin >= 10)
  {
    score += 10;
  }
  else
  {
    score += 5;
  }

  // Revenue Per Cup (20)

  if(insights.revenuePerCup >= 15000)
  {
    score += 20;
  }
  else if(insights.revenuePerCup >= 12000)
  {
    score += 15;
  }
  else
  {
    score += 5;
  }

  var status = "Low Potential";

  if(score >= 80)
  {
    status = "High Potential";
  }
  else if(score >= 60)
  {
    status = "Moderate Potential";
  }

  return{

    growthScore:score,

    status:status,

    breakdown:
    {
      revenue:revenue.direction,
      forecast:forecast.growthRate,
      profitMargin:financial.profitMargin,
      revenuePerCup:insights.revenuePerCup
    }

  };

}

function buildOpportunityEngine(cache) {

  var summary =
    cache.summary;

  var insights =
    cache.insights;

  var forecast =
    cache.forecast;

  var opportunities = [];

  // Best Seller

  if (summary.bestSeller) {

    opportunities.push({

      title: "Best Seller Opportunity",

      message:
        summary.bestSeller +
        " memiliki volume penjualan tertinggi. Pertimbangkan bundling atau promo khusus."

    });

  }

  // Top Revenue

  if (summary.topRevenueProduct) {

    opportunities.push({

      title: "Revenue Opportunity",

      message:
        summary.topRevenueProduct +
        " menghasilkan revenue terbesar. Fokus pada ketersediaan stok."

    });

  }

  // Revenue per Cup

  if (insights.revenuePerCup > 12000) {

    opportunities.push({

      title: "Pricing Opportunity",

      message:
        "Revenue per cup sudah cukup baik. Fokus meningkatkan volume penjualan."

    });

  }

  // Forecast

  if (forecast.growthRate > 0) {

    opportunities.push({

      title: "Growth Opportunity",

      message:
        "Forecast menunjukkan pertumbuhan revenue. Persiapkan kapasitas operasional."

    });

  }

  return opportunities;

}




function testHotColdMigration() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateHotColdMigration(
    processed
  );

}




function testProductMigration() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateProductMigration(
    processed
  );

}




function testExpenseBreakdownMigration() {

  var ss =
    SpreadsheetApp.getActiveSpreadsheet();

  var transactions =
    getTransactionData(ss);

  var priceMap =
    getPriceMap(ss);

  var processed =
    processTransactions(
      transactions,
      priceMap
    );

  return validateExpenseBreakdownMigration(
    processed
  );

}

function buildRecentTransactions(data) {

  var recent =
    data.slice(-10);

  recent.reverse();

  return recent.map(function(row){

    return {

      date:
          Utilities.formatDate(
            new Date(row.date),
            Session.getScriptTimeZone(),
            "yyyy-MM-dd"
          ),

      transactionType:
        row.transactionType,

      product:
        row.product,

      purchaseCategory:
        row.purchaseCategory,

      qty:
        row.qty,

      revenue:
        row.revenue,

      expense:
        row.expense

    };

  });

}

function buildInsights(cache)
{
  var expenses =
    cache.expenseBreakdown.slice();

  var financial =
    cache.financial;

  var summary =
    cache.summary;

  expenses.sort(function(a,b)
  {
    return b.amount - a.amount;
  });

  return {

    profitMargin:
      financial.profitMargin,

    revenuePerCup:

      summary.unitsSold > 0

      ? Math.round(
          financial.revenue /
          summary.unitsSold
        )

      : 0,

    topExpense:

      expenses.length

      ? expenses[0]

      : null,

    financial:
      financial

  };

}

function buildDiagnosis(data, cache) {

  var summary =
    cache.summary;

  var insights =
    cache.insights;

  var diagnosis = [];

  var revenueTrend =
    detectRevenueTrend(cache);

  var categoryTrend =
  detectCategoryDominance(cache);

  // Profit Margin

  if (insights.profitMargin < 10) {

      diagnosis.push({

      level: "warning",

      category: "summary",

      priority: "critical",

      title: "Profit Margin Rendah",

      description:
        "Target ideal berada di atas 15%. Evaluasi harga jual dan biaya operasional.",

      message:
        "Profit margin rendah (" +
        insights.profitMargin +
        "%). " +
        "Target ideal berada di atas 15%. " +
        "Evaluasi harga jual dan biaya operasional."

    });

  } else {

    diagnosis.push({

      level: "good",

      message:
        "Profit margin sehat (" +
        insights.profitMargin +
        "%)"

    });

  }

  // Best Seller

  diagnosis.push({

    level: "good",

    category: "sales",

    priority: "opportunity",

    title: "Produk Terlaris",

    description:
      summary.bestSeller +
      " merupakan produk terlaris. Pertimbangkan promo bundle atau upselling.",

    message:
      summary.bestSeller +
      " merupakan produk terlaris. Pertimbangkan promo bundle atau upselling."

  });

  // Top Revenue Product

  diagnosis.push({

    level: "good",

    category: "revenue",

    priority: "high",

    title: "Revenue Tertinggi",

    description:
      summary.topRevenueProduct +
      " menghasilkan revenue terbesar. Pastikan stok dan kualitas tetap terjaga.",

    message:
      summary.topRevenueProduct +
      " menghasilkan revenue terbesar. Pastikan stok dan kualitas tetap terjaga."

  });

  // Top Expense

  diagnosis.push({

    level: "warning",

    category: "expense",

    priority: "critical",

    title: "Biaya Terbesar",

    description:
      insights.topExpense.category +
      " menyumbang biaya terbesar sebesar Rp " +
      insights.topExpense.amount.toLocaleString("id-ID") +
      ". Pertimbangkan evaluasi efisiensi.",

    message:
      insights.topExpense.category +
      " adalah komponen biaya terbesar (Rp " +
      insights.topExpense.amount.toLocaleString("id-ID") +
      "). Pertimbangkan evaluasi efisiensi biaya."

  });

  // Revenue per Cup

  diagnosis.push({

    level: "attention",

    category: "revenue",

    priority: "good",

    title: "Revenue per Cup",

    description:
      "Rata-rata setiap cup menghasilkan Rp " +
      insights.revenuePerCup.toLocaleString("id-ID") +
      " revenue.",

    message:
      "Setiap cup menghasilkan rata-rata Rp " +
      insights.revenuePerCup.toLocaleString("id-ID") +
      " revenue."

  });

  // Revenue Trend

  diagnosis.push({

    level:
      revenueTrend.status === "down"
        ? "attention"
        : "good",

    category: "businessCard",

    priority:
      revenueTrend.status === "down"
        ? "attention"
        : "good",

    title: "Tren Penjualan",

    description: revenueTrend.message,

    message: revenueTrend.message

  });

  // ===============================
  // Executive Summary Priority
  // ===============================

  const priority =
  {
    warning: 1,
    attention: 2,
    good: 3
  };

  diagnosis =
  diagnosis
  .sort(function(a,b)
  {
    return priority[a.level] - priority[b.level];
  })
  .filter(function(item)
  {
    return item.category !== "businessCard";
  })
  .slice(0,3);

  return diagnosis;

}

function detectRevenueTrend(cache) {

  var trend =
    cache.revenueTrend;

  var values =
    trend.values;

  if (values.length < 2) {

    return {
      status: "stable",
      message:
        "Belum cukup data untuk membaca trend revenue"
    };

  }

  var last =
    values[values.length - 1];

  var prev =
    values[values.length - 2];

  if (last > prev * 1.10) {

    return {
      status: "up",
      message:
        "Revenue meningkat dibanding periode sebelumnya"
    };

  }

  if (last < prev * 0.90) {

    return {
      status: "down",
      message:
        "Revenue menurun dibanding periode sebelumnya"
    };

  }

  return {

    status: "stable",

    message:
      "Revenue relatif stabil"

  };

}

function detectCategoryDominance(cache) {

  var split =
    cache.hotColdSplit;

  var total =
    split.hot + split.cold;

  if (total === 0) {

    return {

      level: "good",

      message:
        "Belum ada data penjualan"

    };

  }

  var hotPct =
    (split.hot / total) * 100;

  var coldPct =
    (split.cold / total) * 100;

  if (hotPct >= 60) {

    return {

      level: "good",

      message:
        "🔥 Hot drinks mendominasi penjualan (" +
        hotPct.toFixed(0) +
        "%)"

    };

  }

  if (coldPct >= 60) {

    return {

      level: "good",

      message:
        "❄ Cold drinks mendominasi penjualan (" +
        coldPct.toFixed(0) +
        "%)"

    };

  }

  return {

    level: "good",

    message:
      "⚖ Penjualan Hot dan Cold relatif seimbang"

  };

}

function buildAnalyticsCache(data) {

  var cache = {

    aggregate:
      buildAggregate(data),

    financial:
      buildFinancial(data)

  };

  cache.summary =
    buildSummaryFromAggregate(
      cache.aggregate
    );

  cache.expenseBreakdown =
    buildExpenseBreakdownFromAggregate(
      cache.aggregate
    );

  cache.insights =
    buildInsights(cache);

  cache.revenueTrend =
    buildRevenueTrendFromAggregate(
      cache.aggregate
    );

  cache.topProducts =
    buildTopProductsFromAggregate(
      cache.aggregate
    );

  cache.profitTrend =
    buildProfitTrendFromAggregate(
      cache.aggregate
    );

  cache.hotColdSplit =
    buildHotColdSplitFromAggregate(
      cache.aggregate
    );

  cache.trend =
    buildTrendEngine(cache);

  cache.forecast =
    buildForecast(cache);

  cache.productContribution =
    buildProductContribution(cache);

  cache.revenueConcentration =
    buildRevenueConcentration(cache);

  cache.paretoAnalysis =
    buildParetoAnalysis(cache);

  cache.revenueIntelligence =
    buildRevenueIntelligence(cache);

  cache.expenseIntelligence =
    buildExpenseIntelligence(cache);

  cache.profitIntelligence =
    buildProfitIntelligence(cache);

  cache.businessScore =
    buildBusinessScore(cache);  
  
  cache.executiveSummary =
    buildExecutiveSummary(cache);

  cache.priorityAction =
    buildPriorityAction(cache);

  cache.riskEngine =
    buildRiskEngine(cache);

  cache.growthScore =
    buildGrowthScore(cache);

  cache.businessFocus =
    buildBusinessFocus(cache);

  cache.executiveAlert =
    buildExecutiveAlert(cache);

  cache.kpiAchievement =
    buildKpiAchievement(cache);

  cache.kpiStatus =
    buildKPIStatus(cache);

  cache.actionRoadmap =
    buildActionRoadmap(cache);

  cache.businessMaturity =
    buildBusinessMaturity(cache);

  return cache;

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

function buildKpiAchievement(cache) {

  var summary =
    cache.summary;

  var insights =
    cache.insights;

  var revenueTarget =
    Math.ceil(
      summary.revenue / 1000000
    ) * 1000000;

  revenueTarget +=
    1000000;

  var profitTarget =
    Math.max(
      1000000,
      Math.ceil(
        summary.profit / 500000
      ) * 500000
    );

  var unitTarget =
    Math.ceil(
      summary.unitsSold / 100
    ) * 100;

  var marginTarget = 15;

  function calc(actual,target){

    if(target <= 0){

      return 0;

    }

    return Math.min(

      100,

      Number(

        (
          actual /
          target *
          100

        ).toFixed(1)

      )

    );

  }

  return {

    revenue:{

      actual:
        summary.revenue,

      target:
        revenueTarget,

      achievement:
        calc(
          summary.revenue,
          revenueTarget
        )

    },

    profit:{

      actual:
        summary.profit,

      target:
        profitTarget,

      achievement:
        calc(
          summary.profit,
          profitTarget
        )

    },

    units:{

      actual:
        summary.unitsSold,

      target:
        unitTarget,

      achievement:
        calc(
          summary.unitsSold,
          unitTarget
        )

    },

    margin:{

      actual:
        Number(
          insights.profitMargin
        ),

      target:
        marginTarget,

      achievement:
        calc(
          Number(
            insights.profitMargin
          ),
          marginTarget
        )

    }

  };

}

function buildActionRoadmap(cache) {

  var roadmap = [];

  var insights =
    cache.insights;

  var summary =
    cache.summary;

  var revenue =
    cache.revenueIntelligence;

  var forecast =
    cache.forecast;

  // Week 1

  if (
    Number(insights.profitMargin) < 10
  ) {

    roadmap.push({

      week: 1,

      title:
        "Improve Profit Margin",

      action:
        "Evaluasi HPP, biaya operasional, dan harga jual produk."

    });

  }
  else {

    roadmap.push({

      week: 1,

      title:
        "Maintain Profitability",

      action:
        "Pertahankan profit margin yang sudah baik."

    });

  }

  // Week 2

  if (
    revenue.direction === "Down"
  ) {

    roadmap.push({

      week: 2,

      title:
        "Increase Revenue",

      action:
        "Fokuskan promosi pada " + cache.revenueConcentration.product + " sebagai kontributor revenue terbesar."

    });

  }
  else {

    roadmap.push({

      week: 2,

      title:
        "Scale Best Seller",

      action:
        summary.bestSeller +
        " layak dijadikan fokus upselling."

    });

  }

  // Week 3

  if (
    forecast.growthRate < 0
  ) {

    roadmap.push({

      week: 3,

      title:
        "Prevent Revenue Decline",

      action:
        "Siapkan campaign promosi sebelum penjualan menurun."

    });

  }
  else {

    roadmap.push({

      week: 3,

      title:
        "Business Expansion",

      action:
        "Siapkan kapasitas operasional untuk pertumbuhan berikutnya."

    });

  }

  // Week 4

  roadmap.push({

    week: 4,

    title:
      "Performance Review",

    action:
      "Bandingkan KPI bulan ini dengan target dan evaluasi hasil."

  });

  return roadmap;

}

function buildBusinessMaturity(cache) {

  var score =
    cache.businessScore.score;

  var growth =
    cache.growthScore.growthScore;

  var risk =
    cache.riskEngine.riskLevel;

  var maturity = 0;

  maturity += score * 0.5;

  maturity += growth * 0.5;

  if (risk === "High") {

    maturity -= 15;

  }
  else if (risk === "Medium") {

    maturity -= 7;

  }

  maturity =

    Math.max(

      0,

      Math.min(

        100,

        Math.round(maturity)

      )

    );

  var level =
    "Startup";

  var description =
    "";

  if (maturity >= 90) {

    level =
      "Optimized";

    description =
      "Bisnis berjalan sangat efisien dan siap melakukan ekspansi.";

  }

  else if (maturity >= 75) {

    level =
      "Growing";

    description =
      "Bisnis berkembang dengan baik namun masih memiliki ruang untuk peningkatan.";

  }

  else if (maturity >= 60) {

    level =
      "Stable";

    description =
      "Operasional stabil namun pertumbuhan perlu ditingkatkan.";

  }

  else if (maturity >= 40) {

    level =
      "Emerging";

    description =
      "Bisnis mulai berkembang tetapi masih menghadapi beberapa tantangan.";

  }

  else {

    description =
      "Fokus pada stabilitas operasional dan profitabilitas sebelum melakukan ekspansi.";

  }

  return {

    score:
      maturity,

    level:
      level,

    description:
      description

  };

}

function buildKPIStatus(cache) {

  var revenue =
    cache.revenueIntelligence;

  var profit =
    cache.profitIntelligence;

  var score =
    cache.businessScore;

  return {

    revenue: {

      trend:
        revenue.direction,

      growth:
        revenue.growthRate,

      label:
        revenue.momentum

    },

    profit: {

      trend:
        profit.direction,

      growth:
        profit.changeRate,

      label:
        profit.status

    },

    business: {

      score:
        score.score,

      status:
        score.status

    }

  };

}
