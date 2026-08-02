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
