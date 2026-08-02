function buildRevenueTrend(data)
{
  var trend = {};

  var today = new Date();

  var currentMonth =
    today.getFullYear() +
    "-" +
    ("0"+(today.getMonth()+1)).slice(-2);

  data.forEach(function(row)
  {
    if(!row.revenue) return;

    var d = new Date(row.date);

    var monthKey =
      d.getFullYear() +
      "-" +
      ("0"+(d.getMonth()+1)).slice(-2);

    // abaikan bulan berjalan
    if(monthKey == currentMonth)
    {
      return;
    }

    trend[monthKey] =
      (trend[monthKey] || 0)
      + row.revenue;

  });

  var labels =
    Object.keys(trend).sort();

  var values =
    labels.map(function(label)
    {
      return trend[label];
    });

  return{

    labels:labels,

    values:values

  };

}

function validateRevenueTrendMigration(data)
{
  var legacyTrend =
    buildRevenueTrend(data);

  var aggregateTrend =
    buildRevenueTrendFromAggregate(
      buildAggregate(data)
    );

  ["labels", "values"]
  .forEach(function(field)
  {
    if(
      JSON.stringify(legacyTrend[field])
      !==
      JSON.stringify(aggregateTrend[field])
    )
    {
      throw new Error(
        "Revenue trend migration mismatch for " +
        field +
        ": legacy=" +
        JSON.stringify(legacyTrend[field]) +
        ", aggregate=" +
        JSON.stringify(aggregateTrend[field])
      );
    }
  });

  return {
    passed:true,
    legacy:legacyTrend,
    aggregate:aggregateTrend
  };
}

function buildTrendEngine(cache)
{
  return {

    revenue:
      cache.revenueTrend,

    profit:
      cache.profitTrend,

    hotCold:
      cache.hotColdSplit,

    topProducts:
      cache.topProducts

  };
}

function buildForecast(cache)
{
  var trend =
    cache.revenueTrend;

  var values =
    trend.values;

  if(values.length<3)
  {
    return{

      nextMonthRevenue:
      values.length
      ?values[values.length-1]
      :0,

      growthRate:0

    };
  }

  // abaikan bulan berjalan

  var history =
    values.slice(0,-1);

  var recent =
    history.slice(-3);

  var avg =
    recent.reduce(function(a,b){

      return a+b;

    },0)/recent.length;

  var forecast =
    Math.round(avg);

  var last =
    history[history.length-1];

  var prev =
    history[history.length-2];

  var growth =0;

  if(prev>0)
  {
    growth=
    ((last-prev)/prev)*100;
  }

  return{

    nextMonthRevenue:
    forecast,

    growthRate:
    Number(growth.toFixed(1))

  };

}

function buildProfitTrend(data) {

  var monthly = {};

  data.forEach(function(row){

    var monthKey =
      Utilities.formatDate(
        new Date(row.date),
        Session.getScriptTimeZone(),
        "yyyy-MM"
      );

    if (!monthly[monthKey]) {

      monthly[monthKey] = {
        revenue: 0,
        expense: 0
      };
    }

    monthly[monthKey].revenue +=
      row.revenue;

    monthly[monthKey].expense +=
      row.expense;

  });

  var labels = [];
  var values = [];

  Object.keys(monthly)
    .sort()
    .forEach(function(month){

      labels.push(month);

      values.push(

        monthly[month].revenue
        -
        monthly[month].expense

      );

    });

  return {
    labels: labels,
    values: values
  };
}

function validateProfitTrendMigration(data) {

  var legacyTrend =
    buildProfitTrend(data);

  var aggregateTrend =
    buildProfitTrendFromAggregate(
      buildAggregate(data)
    );

  ["labels", "values"]
  .forEach(function(field) {

    if (
      JSON.stringify(legacyTrend[field]) !==
      JSON.stringify(aggregateTrend[field])
    ) {
      throw new Error(
        "Profit trend migration mismatch for " +
        field +
        ": legacy=" +
        JSON.stringify(legacyTrend[field]) +
        ", aggregate=" +
        JSON.stringify(aggregateTrend[field])
      );
    }

  });

  return {
    passed: true,
    legacy: legacyTrend,
    aggregate: aggregateTrend
  };

}

function buildHotColdSplit(data) {

  var hot = 0;

  var cold = 0;

  data.forEach(function (row) {

    if (
      row.transactionType !==
      "Sales"
    ) return;

    if (row.category === "Hot") {

      hot += row.qty;

    }

    if (row.category === "Cold") {

      cold += row.qty;

    }


  });

  return {

    hot: hot,

    cold: cold

  };

}

function validateHotColdMigration(data) {

  var legacySplit =
    buildHotColdSplit(data);

  var aggregateSplit =
    buildHotColdSplitFromAggregate(
      buildAggregate(data)
    );

  ["hot", "cold"]
  .forEach(function(field) {

    if (
      legacySplit[field] !==
      aggregateSplit[field]
    ) {
      throw new Error(
        "Hot/Cold migration mismatch for " +
        field +
        ": legacy=" +
        legacySplit[field] +
        ", aggregate=" +
        aggregateSplit[field]
      );
    }

  });

  return {
    passed: true,
    legacy: legacySplit,
    aggregate: aggregateSplit
  };

}
