function buildRecommendationEngine(cache)
{
  var rules =
    KPI_TARGET_CONFIG.RULES.RECOMMENDATION;

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

  var bestSeller =
    summary.bestSeller || "-";

  var recommendations = [];

  var hasBusinessData =
    Number(summary.revenue || 0) !== 0 ||
    Number(summary.expense || 0) !== 0 ||
    Number(summary.unitsSold || 0) !== 0;

  if (!hasBusinessData)
  {
    return [{

      priority:"Low",

      score:0,

      message:
        "Belum ada data bisnis yang cukup untuk menghasilkan rekomendasi."

    }];
  }

  // Profit Margin

  if(Number(insights.profitMargin) < rules.LOW_PROFIT_MARGIN)
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
        bestSeller +
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

  if(score.score < rules.BUSINESS_SCORE_FLOOR)
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

function buildOpportunityEngine(cache) {

  var rules =
    KPI_TARGET_CONFIG.RULES.RECOMMENDATION;

  var summary =
    cache.summary;

  var insights =
    cache.insights;

  var forecast =
    cache.forecast;

  var bestSeller =
    summary.bestSeller || "-";

  var opportunities = [];

  // Best Seller

  if (summary.bestSeller) {

    opportunities.push({

      title: "Best Seller Opportunity",

      message:
        bestSeller +
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

  if (insights.revenuePerCup > rules.PRICING_OPPORTUNITY_REVENUE_PER_CUP) {

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

function buildActionRoadmap(cache) {

  var rules =
    KPI_TARGET_CONFIG.RULES.RECOMMENDATION;

  var roadmap = [];

  var insights =
    cache.insights;

  var summary =
    cache.summary;

  var revenue =
    cache.revenueIntelligence;

  var forecast =
    cache.forecast;

  var bestSeller =
    summary.bestSeller || "-";

  // Week 1

  if (
    Number(insights.profitMargin) < rules.LOW_PROFIT_MARGIN
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
        bestSeller +
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
