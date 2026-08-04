var PROJECT_CONFIG = Object.freeze({
  APP_NAME: "NUMLOCK",
  VERSION: "1.0.0",
  RELEASE_LABEL: "Production",
  RELEASE_DATE: "2026-08-03",
  ENVIRONMENT: "Production",
  REPOSITORY_NAME: "Numlock"
});

var KPI_TARGET_CONFIG = Object.freeze({
  PROVENANCE:
    "System-defined targets from current NUMLOCK decision rules.",
  EDITABLE: false,
  PUBLIC_TARGETS: Object.freeze([
    Object.freeze({
      key: "revenue",
      label: "Revenue",
      unit: "currency",
      target: null,
      direction: "minimum",
      source: "KPI Achievement",
      description:
        "Uses the existing whole-million revenue ceiling plus one Rp 1,000,000 step."
    }),
    Object.freeze({
      key: "profit",
      label: "Profit",
      unit: "currency",
      target: null,
      direction: "minimum",
      source: "KPI Achievement",
      description:
        "Uses the existing Rp 500,000 ceiling with a minimum target of Rp 1,000,000."
    }),
    Object.freeze({
      key: "units",
      label: "Units Sold",
      unit: "quantity",
      target: null,
      direction: "minimum",
      source: "KPI Achievement",
      description:
        "Uses the existing 100-unit ceiling for the selected period."
    }),
    Object.freeze({
      key: "margin",
      label: "Profit Margin",
      unit: "percent",
      target: 15,
      direction: "minimum",
      source: "KPI Achievement",
      description:
        "Uses the established 15% healthy profit-margin target."
    })
  ]),
  RULES: Object.freeze({
    BUSINESS_SCORE: Object.freeze({
      PROFIT_MARGIN_CRITICAL: 5,
      PROFIT_MARGIN_WATCH: 10,
      PROFIT_MARGIN_HEALTHY: 15,
      MINIMUM_REVENUE: 1000000,
      MINIMUM_UNITS: 100,
      EXCELLENT_SCORE: 90,
      HEALTHY_SCORE: 75,
      WATCH_SCORE: 60
    }),
    GROWTH_SCORE: Object.freeze({
      STRONG_FORECAST_GROWTH: 10,
      NON_NEGATIVE_FORECAST_GROWTH: 0,
      STRONG_PROFIT_MARGIN: 15,
      HEALTHY_PROFIT_MARGIN: 10,
      STRONG_REVENUE_PER_CUP: 15000,
      HEALTHY_REVENUE_PER_CUP: 12000,
      HIGH_POTENTIAL_SCORE: 80,
      MODERATE_POTENTIAL_SCORE: 60
    }),
    KPI_ACHIEVEMENT: Object.freeze({
      REVENUE_STEP: 1000000,
      REVENUE_ADDITIONAL_STEP: 1000000,
      PROFIT_MINIMUM: 1000000,
      PROFIT_STEP: 500000,
      UNIT_STEP: 100,
      MARGIN_TARGET: 15,
      MAXIMUM_ACHIEVEMENT: 100
    }),
    BUSINESS_MATURITY: Object.freeze({
      OPTIMIZED_SCORE: 90,
      GROWING_SCORE: 75,
      STABLE_SCORE: 60,
      EMERGING_SCORE: 40
    }),
    DIAGNOSIS: Object.freeze({
      LOW_PROFIT_MARGIN: 10,
      CATEGORY_DOMINANCE: 60
    }),
    RECOMMENDATION: Object.freeze({
      LOW_PROFIT_MARGIN: 10,
      BUSINESS_SCORE_FLOOR: 70,
      PRICING_OPPORTUNITY_REVENUE_PER_CUP: 12000
    }),
    RISK_ENGINE: Object.freeze({
      LOW_PROFIT_MARGIN: 10,
      HIGH_RISK_COUNT: 3,
      MEDIUM_RISK_COUNT: 1
    }),
    BUSINESS_FOCUS: Object.freeze({
      LOW_PROFIT_MARGIN: 10,
      OPTIMIZATION_SCORE: 80
    }),
    EXECUTIVE_ALERT: Object.freeze({
      EXCELLENT_SCORE: 90
    }),
    BUSINESS_PRIORITY: Object.freeze({
      CRITICALLY_LOW_PROFIT_MARGIN: 5,
      MATERIAL_REVENUE_DECLINE: -10,
      EXPENSE_CONCENTRATION: 50,
      PRODUCT_CONCENTRATION: 50
    })
  })
});
