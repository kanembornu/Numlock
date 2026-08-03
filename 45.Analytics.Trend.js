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
