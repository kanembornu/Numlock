function createBusinessPriorityFixtures()
{
  return {
    baseCache: {
      summary: {
        revenue: 1000000,
        expense: 200000,
        profit: 800000,
        unitsSold: 100,
        bestSeller: "Latte",
        topRevenueProduct: "Latte"
      },
      financial: {
        netProfit: 800000,
        profitMargin: 20
      },
      riskEngine: {
        riskLevel: "Low",
        riskCount: 0,
        risks: []
      },
      revenueIntelligence: {
        direction: "Up",
        growthRate: 10
      },
      forecast: {
        growthRate: 5
      },
      expenseIntelligence: {
        highestExpense: "Supplies",
        highestAmount: 60000,
        expenseShare: 30
      },
      revenueConcentration: {
        product: "Latte",
        contribution: 40,
        risk: "Low"
      },
      businessScore: {
        score: 85,
        status: "Healthy"
      },
      recommendations: [
        { priority: "Low", score: 20, message: "Maintain strategy" }
      ],
      priorityAction: {
        title: "Existing priority",
        impact: "Low",
        score: 20,
        message: "Existing action"
      },
      businessFocus: {
        focus: "Existing focus",
        priority: "Low",
        reason: "Existing reason",
        expectedImpact: "Low"
      },
      executiveAlert: {
        title: "Existing alert",
        level: "Good",
        message: "Existing message"
      },
      diagnosis: [
        { level: "good", message: "Existing diagnosis" }
      ]
    },
    dataQuality: {
      status: "Good",
      issueCount: 0
    },
    periodComparison: {
      changes: {
        revenuePercent: 10,
        expensePercent: -5,
        profitPercent: 15,
        unitsSoldPercent: 8
      },
      status: {
        revenue: "Up",
        expense: "Down",
        profit: "Up",
        unitsSold: "Up"
      }
    },
    cases: [
      {
        name: "Critical Data Quality wins over business signals",
        quality: { status: "Critical", issueCount: 3 },
        overrides: {
          summary: { profit: -50000 },
          financial: { netProfit: -50000, profitMargin: -5 },
          riskEngine: { riskLevel: "High", riskCount: 4, risks: ["a", "b", "c", "d"] },
          revenueIntelligence: { direction: "Down", growthRate: -30 },
          forecast: { growthRate: -20 }
        },
        expectedLevel: "Critical",
        expectedSource: "Data Quality"
      },
      {
        name: "negative profit",
        overrides: {
          summary: { profit: -50000 },
          financial: { netProfit: -50000, profitMargin: -5 }
        },
        expectedLevel: "Critical",
        expectedSource: "Profitability"
      },
      {
        name: "critically low profit margin",
        overrides: {
          summary: { profit: 20000 },
          financial: { netProfit: 20000, profitMargin: 2 }
        },
        expectedLevel: "High",
        expectedSource: "Profitability"
      },
      {
        name: "High risk",
        overrides: {
          riskEngine: { riskLevel: "High", riskCount: 3, risks: ["a", "b", "c"] }
        },
        expectedLevel: "High",
        expectedSource: "Risk"
      },
      {
        name: "material revenue decline",
        overrides: {
          revenueIntelligence: { direction: "Down", growthRate: -20 }
        },
        expectedLevel: "High",
        expectedSource: "Revenue"
      },
      {
        name: "negative forecast",
        overrides: {
          forecast: { growthRate: -12 }
        },
        expectedLevel: "High",
        expectedSource: "Forecast"
      },
      {
        name: "expense concentration",
        overrides: {
          expenseIntelligence: { highestExpense: "Supplies", highestAmount: 140000, expenseShare: 70 }
        },
        expectedLevel: "Medium",
        expectedSource: "Expense"
      },
      {
        name: "product opportunity",
        overrides: {
          revenueConcentration: { product: "Latte", contribution: 60, risk: "High" }
        },
        expectedLevel: "Medium",
        expectedSource: "Product"
      },
      {
        name: "stable maintenance",
        overrides: {},
        expectedLevel: "Low",
        expectedSource: "Stability"
      },
      {
        name: "empty scope",
        rowCount: 0,
        overrides: {
          summary: { revenue: 0, expense: 0, profit: 0, unitsSold: 0 },
          financial: { netProfit: 0, profitMargin: 0 }
        },
        expectedLevel: "Low",
        expectedSource: "Stability",
        expectedTitle: "No Business Activity"
      }
    ],
    tieCandidates: [
      {
        level: "High",
        title: "Revenue tie",
        reason: "Revenue reason",
        action: "Revenue action",
        source: "Revenue",
        score: 80,
        evidence: { metric: "Revenue", value: 1, comparison: "Down" }
      },
      {
        level: "High",
        title: "Risk tie",
        reason: "Risk reason",
        action: "Risk action",
        source: "Risk",
        score: 80,
        evidence: { metric: "Risk", value: 1, comparison: "Current scope" }
      }
    ],
    frontendTokens: [
      'id="businessPriorityRegion"',
      'aria-labelledby="businessPriorityHeading"',
      'id="businessPriorityLevel"',
      'id="priorityTitle"',
      'id="priorityReason"',
      'id="priorityMessage"',
      'id="priorityMeta"',
      'priority.level + " Priority"',
      '"Next action: " + priority.action',
      'priority.evidence.metric',
      'priority.evidence.comparison'
    ]
  };
}

function createKpiTargetFixtures()
{
  return {
    expectedRules: {
      BUSINESS_SCORE: {
        PROFIT_MARGIN_CRITICAL: 5,
        PROFIT_MARGIN_WATCH: 10,
        PROFIT_MARGIN_HEALTHY: 15,
        MINIMUM_REVENUE: 1000000,
        MINIMUM_UNITS: 100,
        EXCELLENT_SCORE: 90,
        HEALTHY_SCORE: 75,
        WATCH_SCORE: 60
      },
      GROWTH_SCORE: {
        STRONG_FORECAST_GROWTH: 10,
        NON_NEGATIVE_FORECAST_GROWTH: 0,
        STRONG_PROFIT_MARGIN: 15,
        HEALTHY_PROFIT_MARGIN: 10,
        STRONG_REVENUE_PER_CUP: 15000,
        HEALTHY_REVENUE_PER_CUP: 12000,
        HIGH_POTENTIAL_SCORE: 80,
        MODERATE_POTENTIAL_SCORE: 60
      },
      KPI_ACHIEVEMENT: {
        REVENUE_STEP: 1000000,
        REVENUE_ADDITIONAL_STEP: 1000000,
        PROFIT_MINIMUM: 1000000,
        PROFIT_STEP: 500000,
        UNIT_STEP: 100,
        MARGIN_TARGET: 15,
        MAXIMUM_ACHIEVEMENT: 100
      },
      BUSINESS_MATURITY: {
        OPTIMIZED_SCORE: 90,
        GROWING_SCORE: 75,
        STABLE_SCORE: 60,
        EMERGING_SCORE: 40
      },
      DIAGNOSIS: {
        LOW_PROFIT_MARGIN: 10,
        CATEGORY_DOMINANCE: 60
      },
      RECOMMENDATION: {
        LOW_PROFIT_MARGIN: 10,
        BUSINESS_SCORE_FLOOR: 70,
        PRICING_OPPORTUNITY_REVENUE_PER_CUP: 12000
      },
      RISK_ENGINE: {
        LOW_PROFIT_MARGIN: 10,
        HIGH_RISK_COUNT: 3,
        MEDIUM_RISK_COUNT: 1
      },
      BUSINESS_FOCUS: {
        LOW_PROFIT_MARGIN: 10,
        OPTIMIZATION_SCORE: 80
      },
      EXECUTIVE_ALERT: {
        EXCELLENT_SCORE: 90
      },
      BUSINESS_PRIORITY: {
        CRITICALLY_LOW_PROFIT_MARGIN: 5,
        MATERIAL_REVENUE_DECLINE: -10,
        EXPENSE_CONCENTRATION: 50,
        PRODUCT_CONCENTRATION: 50
      }
    },
    historicalData: [
      { date: new Date(2025, 0, 10), category: "Hot", transactionType: "Sales", product: "Latte", purchaseCategory: "", qty: 2, revenue: 60000, expense: 0 },
      { date: new Date(2025, 1, 10), category: "Hot", transactionType: "Sales", product: "Espresso", purchaseCategory: "", qty: 4, revenue: 200000, expense: 0 },
      { date: new Date(2025, 2, 11), category: "Cold", transactionType: "Sales", product: "Latte", purchaseCategory: "", qty: 3, revenue: 90000, expense: 0 },
      { date: new Date(2025, 2, 12), category: "", transactionType: "Purchase", product: "", purchaseCategory: "Supplies", qty: 0, revenue: 0, expense: 50000 }
    ],
    expectedHistorical: {
      businessScore:
        '{"score":75,"status":"Healthy","breakdown":{"profitMargin":85.7,"revenue":350000,"unitsSold":9}}',
      growthScore:
        '{"growthScore":100,"status":"High Potential","breakdown":{"revenue":"Up","forecast":233.3,"profitMargin":85.7,"revenuePerCup":38889}}',
      kpiStatus:
        '{"revenue":{"trend":"Up","growth":233.3,"label":"Strong"},"profit":{"trend":"Up","growth":85.7,"label":"Strong"},"business":{"score":75,"status":"Healthy"}}',
      kpiAchievement:
        '{"revenue":{"actual":350000,"target":2000000,"achievement":17.5},"profit":{"actual":300000,"target":1000000,"achievement":30},"units":{"actual":9,"target":100,"achievement":9},"margin":{"actual":85.7,"target":15,"achievement":100}}',
      businessMaturity:
        '{"score":88,"level":"Growing","description":"Bisnis berkembang dengan baik namun masih memiliki ruang untuk peningkatan."}',
      riskEngine:
        '{"riskLevel":"Low","riskCount":0,"risks":[]}',
      recommendationScores: "70,40,35,20",
      businessPriority: "Medium|Expense|70|Review Expense Concentration"
    },
    publicKeys: ["revenue", "profit", "units", "margin"],
    frontendTokens: [
      'id="kpiTargetReference"',
      '<ul id="kpiTargetDetails"></ul>',
      'plansColumn.appendChild(staging.querySelector("#kpiTargetReference"))',
      "System-defined targets from current decision rules.",
      "function renderKpiTargets(kpiTargets)",
      'document.getElementById("kpiTargetDetails").innerHTML =',
      "approvedTargetPresentation.map(function(target)",
      "renderKpiTargets(res.kpiTargets);"
    ],
    frontendExcludedTokens: [
      "User-defined targets",
      "Edit targets",
      ">Editable<"
    ]
  };
}
