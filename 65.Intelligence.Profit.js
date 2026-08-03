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

  if (
    Number(financial.revenue || 0) === 0
  )
  {
    return{
      direction:"Stable",
      changeRate:0,
      status:"Neutral"
    };
  }

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
