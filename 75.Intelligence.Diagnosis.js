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

  var rules =
    KPI_TARGET_CONFIG.RULES.DIAGNOSIS;

  var summary =
    cache.summary;

  var insights =
    cache.insights;

  var bestSeller =
    summary.bestSeller || "-";

  var topRevenueProduct =
    summary.topRevenueProduct || "-";

  var diagnosis = [];

  var revenueTrend =
    detectRevenueTrend(cache);

  var categoryTrend =
  detectCategoryDominance(cache);

  // Profit Margin

  if (insights.profitMargin < rules.LOW_PROFIT_MARGIN) {

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
      bestSeller +
      " merupakan produk terlaris. Pertimbangkan promo bundle atau upselling.",

    message:
      bestSeller +
      " merupakan produk terlaris. Pertimbangkan promo bundle atau upselling."

  });

  // Top Revenue Product

  diagnosis.push({

    level: "good",

    category: "revenue",

    priority: "high",

    title: "Revenue Tertinggi",

    description:
      topRevenueProduct +
      " menghasilkan revenue terbesar. Pastikan stok dan kualitas tetap terjaga.",

    message:
      topRevenueProduct +
      " menghasilkan revenue terbesar. Pastikan stok dan kualitas tetap terjaga."

  });

  // Top Expense

  if (insights.topExpense) {

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

  }
  else {

    diagnosis.push({

      level: "good",

      category: "expense",

      priority: "good",

      title: "Biaya Terbesar",

      description:
        "Belum ada data biaya yang dapat dianalisis.",

      message:
        "Belum ada data biaya yang dapat dianalisis."

    });

  }

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

function detectCategoryDominance(cache) {

  var rules =
    KPI_TARGET_CONFIG.RULES.DIAGNOSIS;

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

  if (hotPct >= rules.CATEGORY_DOMINANCE) {

    return {

      level: "good",

      message:
        "🔥 Hot drinks mendominasi penjualan (" +
        hotPct.toFixed(0) +
        "%)"

    };

  }

  if (coldPct >= rules.CATEGORY_DOMINANCE) {

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
