function buildBusinessScore(cache)
{
  var summary =
    cache.summary;

  var financial =
    cache.financial;

  var insights =
    cache.insights;

  var rules =
    KPI_TARGET_CONFIG.RULES.BUSINESS_SCORE;

  var score = 100;

  // Profit Margin

  if(financial.profitMargin < rules.PROFIT_MARGIN_CRITICAL)
  {
    score -= 35;
  }
  else if(financial.profitMargin < rules.PROFIT_MARGIN_WATCH)
  {
    score -= 25;
  }
  else if(financial.profitMargin < rules.PROFIT_MARGIN_HEALTHY)
  {
    score -= 10;
  }

  // Revenue

  if(financial.revenue < rules.MINIMUM_REVENUE)
  {
    score -= 15;
  }

  // Units Sold

  if(summary.unitsSold < rules.MINIMUM_UNITS)
  {
    score -= 10;
  }

  score =
    Math.max(0,Math.round(score));

  var status;

  if(score >= rules.EXCELLENT_SCORE)
  {
    status = "Excellent";
  }
  else if(score >= rules.HEALTHY_SCORE)
  {
    status = "Healthy";
  }
  else if(score >= rules.WATCH_SCORE)
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

  var rules =
    KPI_TARGET_CONFIG.RULES.GROWTH_SCORE;

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

  if(forecast.growthRate >= rules.STRONG_FORECAST_GROWTH)
  {
    score += 30;
  }
  else if(forecast.growthRate >= rules.NON_NEGATIVE_FORECAST_GROWTH)
  {
    score += 20;
  }
  else
  {
    score += 5;
  }

  // Profit Margin (20)

  if(financial.profitMargin >= rules.STRONG_PROFIT_MARGIN)
  {
    score += 20;
  }
  else if(financial.profitMargin >= rules.HEALTHY_PROFIT_MARGIN)
  {
    score += 10;
  }
  else
  {
    score += 5;
  }

  // Revenue Per Cup (20)

  if(insights.revenuePerCup >= rules.STRONG_REVENUE_PER_CUP)
  {
    score += 20;
  }
  else if(insights.revenuePerCup >= rules.HEALTHY_REVENUE_PER_CUP)
  {
    score += 15;
  }
  else
  {
    score += 5;
  }

  var status = "Low Potential";

  if(score >= rules.HIGH_POTENTIAL_SCORE)
  {
    status = "High Potential";
  }
  else if(score >= rules.MODERATE_POTENTIAL_SCORE)
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

  var rules =
    KPI_TARGET_CONFIG.RULES.KPI_ACHIEVEMENT;

  var revenueTarget =
    Math.ceil(
      summary.revenue / rules.REVENUE_STEP
    ) * rules.REVENUE_STEP;

  revenueTarget +=
    rules.REVENUE_ADDITIONAL_STEP;

  var profitTarget =
    Math.max(
      rules.PROFIT_MINIMUM,
      Math.ceil(
        summary.profit / rules.PROFIT_STEP
      ) * rules.PROFIT_STEP
    );

  var unitTarget =
    Math.ceil(
      summary.unitsSold / rules.UNIT_STEP
    ) * rules.UNIT_STEP;

  var marginTarget =
    rules.MARGIN_TARGET;

  function calc(actual,target){

    if(target <= 0){

      return 0;

    }

    return Math.min(

      rules.MAXIMUM_ACHIEVEMENT,

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

function buildKpiTargets(cache)
{
  var achievement =
    cache.kpiAchievement;

  var targets =
    KPI_TARGET_CONFIG.PUBLIC_TARGETS
      .map(function(definition)
      {
        var currentTarget =
          achievement[definition.key]
            ? achievement[definition.key].target
            : definition.target;

        return {
          key: definition.key,
          label: definition.label,
          unit: definition.unit,
          target: currentTarget,
          direction: definition.direction,
          source: definition.source,
          description: definition.description
        };
      });

  return {
    targets: targets,
    provenance:
      KPI_TARGET_CONFIG.PROVENANCE,
    editable:
      KPI_TARGET_CONFIG.EDITABLE
  };
}

function buildBusinessMaturity(cache) {

  var score =
    cache.businessScore.score;

  var growth =
    cache.growthScore.growthScore;

  var risk =
    cache.riskEngine.riskLevel;

  var rules =
    KPI_TARGET_CONFIG.RULES.BUSINESS_MATURITY;

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

  if (maturity >= rules.OPTIMIZED_SCORE) {

    level =
      "Optimized";

    description =
      "Bisnis berjalan sangat efisien dan siap melakukan ekspansi.";

  }

  else if (maturity >= rules.GROWING_SCORE) {

    level =
      "Growing";

    description =
      "Bisnis berkembang dengan baik namun masih memiliki ruang untuk peningkatan.";

  }

  else if (maturity >= rules.STABLE_SCORE) {

    level =
      "Stable";

    description =
      "Operasional stabil namun pertumbuhan perlu ditingkatkan.";

  }

  else if (maturity >= rules.EMERGING_SCORE) {

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
