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
