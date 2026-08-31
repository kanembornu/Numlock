function testBusinessPriorityContract()
{
  var fixture =
    createBusinessPriorityFixtures();

  var scenariosPassed = 0;
  var levelsSeen = {};
  var allContractsComplete = true;
  var allScoresFinite = true;
  var allInputsUnchanged = true;
  var allOutputsDeterministic = true;

  function createScenarioCache(overrides)
  {
    var cache =
      JSON.parse(
        JSON.stringify(
          fixture.baseCache
        )
      );

    Object.keys(overrides || {})
      .forEach(function(key)
      {
        cache[key] =
          Object.assign(
            {},
            cache[key] || {},
            overrides[key]
          );
      });

    return cache;
  }

  fixture.cases.forEach(function(testCase)
  {
    var cache =
      createScenarioCache(
        testCase.overrides
      );

    var quality =
      JSON.parse(
        JSON.stringify(
          testCase.quality ||
          fixture.dataQuality
        )
      );

    var comparison =
      JSON.parse(
        JSON.stringify(
          fixture.periodComparison
        )
      );

    var before =
      JSON.stringify({
        cache: cache,
        quality: quality,
        comparison: comparison
      });

    var actual =
      buildBusinessPriority(
        cache,
        quality,
        testCase.rowCount == null
          ? 5
          : testCase.rowCount,
        comparison
      );

    var repeated =
      buildBusinessPriority(
        cache,
        quality,
        testCase.rowCount == null
          ? 5
          : testCase.rowCount,
        comparison
      );

    var requiredFields = [
      "level",
      "title",
      "reason",
      "action",
      "source",
      "score",
      "evidence"
    ];

    requiredFields.forEach(function(field)
    {
      if (!Object.prototype.hasOwnProperty.call(actual, field))
      {
        allContractsComplete = false;
      }
    });

    if (
      !actual.evidence ||
      !Object.prototype.hasOwnProperty.call(actual.evidence, "metric") ||
      !Object.prototype.hasOwnProperty.call(actual.evidence, "value") ||
      !Object.prototype.hasOwnProperty.call(actual.evidence, "comparison")
    )
    {
      allContractsComplete = false;
    }

    if (
      !isFinite(actual.score) ||
      actual.score < 0 ||
      actual.score > 100
    )
    {
      allScoresFinite = false;
    }

    if (
      actual.level !== testCase.expectedLevel ||
      actual.source !== testCase.expectedSource ||
      (
        testCase.expectedTitle &&
        actual.title !== testCase.expectedTitle
      )
    )
    {
      throw new Error(
        "Business Priority winner mismatch for " +
        testCase.name +
        ": actual=" +
        actual.level +
        "/" +
        actual.source
      );
    }

    if (
      testCase.expectedTitle === "No Business Activity" &&
      (
        actual.reason !== "No transactions are available for the selected period." ||
        actual.action !== "Select another reporting period or verify source data."
      )
    )
    {
      throw new Error(
        "Business Priority empty-scope fallback mismatch"
      );
    }

    if (JSON.stringify(actual) !== JSON.stringify(repeated))
    {
      allOutputsDeterministic = false;
    }

    if (
      JSON.stringify({
        cache: cache,
        quality: quality,
        comparison: comparison
      }) !== before
    )
    {
      allInputsUnchanged = false;
    }

    levelsSeen[actual.level] = true;
    scenariosPassed++;
  });

  var tieWinner =
    selectBusinessPriorityCandidate(
      fixture.tieCandidates
    );

  if (tieWinner.source !== "Risk")
  {
    throw new Error(
      "Business Priority source tie-breaker mismatch"
    );
  }
  scenariosPassed++;

  var scoreWinner =
    selectBusinessPriorityCandidate([
      Object.assign(
        {},
        fixture.tieCandidates[0],
        { score: 81 }
      ),
      fixture.tieCandidates[1]
    ]);

  if (scoreWinner.source !== "Revenue")
  {
    throw new Error(
      "Business Priority score ordering mismatch"
    );
  }
  scenariosPassed++;

  if (!allContractsComplete)
  {
    throw new Error(
      "Business Priority contract or evidence is incomplete"
    );
  }
  scenariosPassed++;

  if (!allScoresFinite)
  {
    throw new Error(
      "Business Priority score is outside finite bounds"
    );
  }
  scenariosPassed++;

  if (!allInputsUnchanged)
  {
    throw new Error(
      "Business Priority mutated existing intelligence objects"
    );
  }
  scenariosPassed++;

  if (!allOutputsDeterministic)
  {
    throw new Error(
      "Business Priority output is not deterministic"
    );
  }
  scenariosPassed++;

  var response =
    buildDashboardResponse(
      [],
      "custom",
      "2026-08-01",
      "2026-08-01",
      new Date(2026, 7, 1, 12, 0, 0)
    );

  if (
    !response.businessPriority ||
    response.businessPriority.title !== "No Business Activity"
  )
  {
    throw new Error(
      "Dashboard response has no authoritative Business Priority"
    );
  }
  scenariosPassed++;

  var source = getAssembledFrontendSource();

  fixture.frontendTokens.forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "Business Priority frontend"
    );
  });
  scenariosPassed++;

  assertSourceContainsOnce(
    source,
    'id="businessPriorityRegion"',
    "authoritative Insights Business Priority render target"
  );

  var insightsOwnershipStart = source.indexOf(
    'insightsColumn.id = "insightsColumn"'
  );
  var insightsOwnershipEnd = source.indexOf(
    'plansColumn.id = "plansColumn"',
    insightsOwnershipStart
  );
  var insightsOwnershipSource = source.slice(
    insightsOwnershipStart,
    insightsOwnershipEnd
  );

  assertSourceContains(
    insightsOwnershipSource,
    'insightsColumn.appendChild(staging.querySelector("#businessPriorityRegion"))',
    "Insights Business Priority owner"
  );

  var priorityRendererStart =
    source.indexOf("function renderExecutiveSummary(res)");
  var priorityRendererEnd =
    source.indexOf("function renderExecutiveCenter(res)", priorityRendererStart);
  var priorityRendererSource = source.slice(
    priorityRendererStart,
    priorityRendererEnd
  );

  [
    'document.getElementById("businessPriorityLevel")',
    'document.getElementById("priorityTitle")',
    'document.getElementById("priorityReason")',
    'document.getElementById("priorityMessage")',
    'document.getElementById("priorityMeta")'
  ].forEach(function(token)
  {
    assertSourceContainsOnce(
      priorityRendererSource,
      token,
      "authoritative Business Priority renderer"
    );
  });
  scenariosPassed++;

  createAccessibilityContractFixtures()
    .concat(
      createResponsiveShellContractFixtures()
    )
    .forEach(function(contract)
    {
      contract.tokens.forEach(function(token)
      {
        assertSourceContains(
          source,
          token,
          "Business Priority preserved contract"
        );
      });
    });
  scenariosPassed++;

  ["Critical", "High", "Medium", "Low"]
    .forEach(function(level)
    {
      if (!levelsSeen[level])
      {
        throw new Error(
          "Business Priority missing level coverage: " +
          level
        );
      }
    });

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    levels: ["Critical", "High", "Medium", "Low"]
  };

  Logger.log(
    "PASS: testBusinessPriorityContract | scenarios=" +
    summary.scenarios +
    " | levels=" +
    summary.levels.join(",")
  );

  return summary;
}

function testKpiTargetContract()
{
  var fixture =
    createKpiTargetFixtures();
  var source = getAssembledFrontendSource();
  var tokenSource =
    HtmlService.createHtmlOutputFromFile(
      "189.View.Tailwind"
    ).getContent();

  var scenariosPassed = 0;

  if (
    JSON.stringify(KPI_TARGET_CONFIG.RULES) !==
    JSON.stringify(fixture.expectedRules)
  )
  {
    throw new Error(
      "Centralized KPI thresholds changed from former literals"
    );
  }
  scenariosPassed++;

  var originalMarginTarget =
    KPI_TARGET_CONFIG.RULES.KPI_ACHIEVEMENT.MARGIN_TARGET;

  KPI_TARGET_CONFIG.RULES.KPI_ACHIEVEMENT.MARGIN_TARGET = 999;

  if (
    !Object.isFrozen(KPI_TARGET_CONFIG) ||
    !Object.isFrozen(KPI_TARGET_CONFIG.PUBLIC_TARGETS) ||
    !Object.isFrozen(KPI_TARGET_CONFIG.PUBLIC_TARGETS[0]) ||
    !Object.isFrozen(KPI_TARGET_CONFIG.RULES) ||
    !Object.isFrozen(KPI_TARGET_CONFIG.RULES.KPI_ACHIEVEMENT) ||
    KPI_TARGET_CONFIG.RULES.KPI_ACHIEVEMENT.MARGIN_TARGET !== originalMarginTarget
  )
  {
    throw new Error(
      "KPI target configuration is not deeply immutable"
    );
  }
  scenariosPassed++;

  var cache =
    buildAnalyticsCache(
      fixture.historicalData
    );

  var historicalChecks = [
    {
      name: "Business Score",
      actual: JSON.stringify(cache.businessScore),
      expected: fixture.expectedHistorical.businessScore
    },
    {
      name: "Growth Score",
      actual: JSON.stringify(cache.growthScore),
      expected: fixture.expectedHistorical.growthScore
    },
    {
      name: "KPI Status",
      actual: JSON.stringify(cache.kpiStatus),
      expected: fixture.expectedHistorical.kpiStatus
    },
    {
      name: "KPI Achievement",
      actual: JSON.stringify(cache.kpiAchievement),
      expected: fixture.expectedHistorical.kpiAchievement
    },
    {
      name: "Business Maturity",
      actual: JSON.stringify(cache.businessMaturity),
      expected: fixture.expectedHistorical.businessMaturity
    },
    {
      name: "Risk Engine",
      actual: JSON.stringify(cache.riskEngine),
      expected: fixture.expectedHistorical.riskEngine
    },
    {
      name: "Recommendation ordering",
      actual:
        buildRecommendationEngine(cache)
          .map(function(item)
          {
            return item.score;
          })
          .join(","),
      expected: fixture.expectedHistorical.recommendationScores
    },
    {
      name: "Business Priority",
      actual:
        (function()
        {
          var priority =
            buildBusinessPriority(
              cache,
              { status: "Good", issueCount: 0 },
              fixture.historicalData.length,
              {
                changes: {
                  revenuePercent: 0,
                  expensePercent: 0,
                  profitPercent: 0,
                  unitsSoldPercent: 0
                },
                status: {
                  revenue: "Stable",
                  expense: "Stable",
                  profit: "Stable",
                  unitsSold: "Stable"
                }
              }
            );

          return priority.level + "|" +
            priority.source + "|" +
            priority.score + "|" +
            priority.title;
        })(),
      expected: fixture.expectedHistorical.businessPriority
    }
  ];

  historicalChecks.forEach(function(check)
  {
    if (check.actual !== check.expected)
    {
      throw new Error(
        check.name +
        " changed after KPI target centralization: expected=" +
        check.expected +
        ", actual=" +
        check.actual
      );
    }

    scenariosPassed++;
  });

  ['id="sidebarUtilityNavigation"', 'aria-label="Settings"', 'aria-label="Logs"',
    'id="sidebarMobileCloseButton"', '>Close Menu</span>',
    'onclick="setSidebarOpen(false, true)"'].forEach(function(token)
  {
    assertSourceContains(source, token, "mobile utility navigation");
  });
  ['#dashboardSidebar>nav{flex:1 1 auto;min-height:0;overflow-y:auto}',
    '#sidebarUtilityNavigation{flex:0 0 auto;margin-top:auto;padding:8px 8px calc(8px + env(safe-area-inset-bottom))}',
    '#sidebarMobileCloseButton{display:flex;min-height:44px}',
    'html.numlock-phone #sidebarMobileCloseButton{display:flex!important;min-height:44px}'].forEach(function(token)
  {
    assertSourceContains(tokenSource, token, "mobile utility drawer containment");
  });

  [
    { margin: 14.9, expectedScore: 90 },
    { margin: 15, expectedScore: 100 },
    { margin: 15.1, expectedScore: 100 }
  ].forEach(function(boundary)
  {
    var score =
      buildBusinessScore({
        summary: { unitsSold: 100 },
        financial: {
          profitMargin: boundary.margin,
          revenue: 1000000
        },
        insights: {}
      });

    if (score.score !== boundary.expectedScore)
    {
      throw new Error(
        "KPI target boundary changed for margin " +
        boundary.margin
      );
    }

    scenariosPassed++;
  });

  var response =
    buildDashboardResponse(
      fixture.historicalData,
      "custom",
      "2024-01-01",
      "2026-12-31",
      new Date(2026, 7, 4, 12, 0, 0)
    );

  var publicTargets =
    response.kpiTargets;

  var requiredFields = [
    "key",
    "label",
    "unit",
    "target",
    "direction",
    "source",
    "description"
  ];

  var allowedUnits = {
    percent: true,
    currency: true,
    quantity: true,
    score: true,
    text: true
  };

  var allowedDirections = {
    minimum: true,
    maximum: true,
    range: true,
    informational: true
  };

  publicTargets.targets.forEach(function(target)
  {
    requiredFields.forEach(function(field)
    {
      if (!Object.prototype.hasOwnProperty.call(target, field))
      {
        throw new Error(
          "Public KPI target missing field " +
          field
        );
      }
    });

    if (
      !allowedUnits[target.unit] ||
      !allowedDirections[target.direction] ||
      !isFinite(Number(target.target))
    )
    {
      throw new Error(
        "Public KPI target contains an invalid value"
      );
    }
  });
  scenariosPassed++;

  var publicKeys =
    publicTargets.targets.map(function(target)
    {
      return target.key;
    });

  if (
    JSON.stringify(publicKeys) !==
      JSON.stringify(fixture.publicKeys) ||
    new Set(publicKeys).size !== publicKeys.length
  )
  {
    throw new Error(
      "Public KPI targets are duplicated or unexpected"
    );
  }
  scenariosPassed++;

  if (publicTargets.editable !== false)
  {
    throw new Error(
      "Public KPI targets must not be editable"
    );
  }
  scenariosPassed++;

  if (
    !publicTargets.provenance ||
    publicTargets.provenance.indexOf("System-defined targets") !== 0
  )
  {
    throw new Error(
      "Public KPI target provenance is missing"
    );
  }
  scenariosPassed++;

  var source = getAssembledFrontendSource();

  fixture.frontendTokens.forEach(function(token)
  {
    assertSourceContains(
      source,
      token,
      "KPI Target frontend"
    );
  });
  scenariosPassed++;

  fixture.frontendExcludedTokens.forEach(function(token)
  {
    assertSourceExcludes(
      source,
      token,
      "misleading editable target wording"
    );
  });
  scenariosPassed++;

  createAccessibilityContractFixtures()
    .concat(
      createResponsiveShellContractFixtures()
    )
    .forEach(function(contract)
    {
      contract.tokens.forEach(function(token)
      {
        assertSourceContains(
          source,
          token,
          "KPI Target preserved contract"
        );
      });
    });
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    centralized: true,
    editable: false
  };

  Logger.log(
    "PASS: testKpiTargetContract | scenarios=" +
    summary.scenarios +
    " | centralized=" +
    summary.centralized +
    " | editable=" +
    summary.editable
  );

  return summary;
}

function testIntelligencePlanningVisualContract()
{
  var source = getAssembledFrontendSource();
  var scenariosPassed = 0;

  [
    'insightsColumn.id = "insightsColumn"',
    'plansColumn.id = "plansColumn"',
    "grid-template-columns: minmax(0, 482fr) minmax(0, 619fr)",
    "sectionOwnership.insights.push(insightsColumn, plansColumn)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "approved two-column architecture");
  });
  scenariosPassed++;

  [
    'insightsColumn.appendChild(staging.querySelector("#businessPriorityRegion"))',
    'insightsColumn.appendChild(staging.querySelector("#diagnosisSection"))',
    'insightsColumn.appendChild(staging.querySelector("#riskOpportunitySection"))',
    'insightsColumn.appendChild(staging.querySelector("#businessMaturityCard"))'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Insights ownership and order");
  });
  scenariosPassed++;

  [
    'plansColumn.appendChild(staging.querySelector("#recommendationsSection"))',
    'plansColumn.appendChild(staging.querySelector("#actionRoadmapCard"))',
    'plansColumn.appendChild(staging.querySelector("#kpiTargetReference"))'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Plans ownership and order");
  });
  scenariosPassed++;

  [
    "Key Business Signals",
    "Revenue Intelligence",
    "Profit Intelligence",
    "Risk Status",
    "Growth Opportunity",
    "Business Maturity",
    "Business maturity scale",
    "diagnosis.slice(0, 2).map(renderDiagnosisCard)"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Insights baseline content");
  });
  scenariosPassed++;

  [
    "Recommended Actions",
    ".slice(0,4)",
    "30-Day Action Roadmap",
    "Execution timeline",
    "Target Reference",
    "grid-template-columns: repeat(4, minmax(0, 1fr))",
    "Profit Margin Ideal",
    "Growth Score Target",
    "Revenue Growth Target"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Plans baseline content");
  });
  scenariosPassed++;

  [
    'id="businessFocusCard"',
    'id="priorityActionCard"',
    'id="kpiAchievementCard"',
    'id="executiveCenter"',
    'id="planningFocusRow"',
    'id="planningSupportRow"',
    "View details",
    "Action center",
    '<div class="text-[10px] text-slate-400">4 Weeks</div>'
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "obsolete duplicate presentation");
  });
  scenariosPassed++;

  [
    "#dashboardPanelInsights:not([hidden])",
    "overflow: hidden;",
    "#dashboardPanelInsights #insightsColumn { grid-template-rows: 75fr 145fr 279fr 237fr 222fr; }",
    "#dashboardPanelInsights #plansColumn { grid-template-rows: 75fr 405fr 270fr 230fr; }",
    '<div class="insights-status-badge bg-amber-100 text-amber-700">',
    "#dashboardPanelInsights #riskOpportunitySection { min-height: 0 !important; overflow: hidden !important; }"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "one-page geometry contract");
  });
  scenariosPassed++;

  [
    "background: color-mix(in srgb, var(--brand) 14%, var(--surface-1))",
    "background: color-mix(in srgb, var(--success) 14%, var(--surface-1))",
    "#dashboardPanelInsights #businessMaturityCard { margin: 0; padding: 12px 16px; border: 1px solid color-mix(in srgb, var(--brand) 18%, var(--border-subtle)); border-radius: var(--radius-card); background: var(--surface-1);",
    "#dashboardPanelInsights #actionRoadmapCard { margin: 0; padding: 12px 16px; border: 1px solid color-mix(in srgb, var(--success) 18%, var(--border-subtle)); border-radius: var(--radius-card); background: var(--surface-1);",
    ".insights-status-badge { display: inline-flex; min-height: 20px;",
    'High: "bg-red-100 text-red-700"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Insights and Plans visual normalization");
  });
  [
    "#insightsColumn > :not(.insights-plans-header)",
    "#plansColumn > :not(.insights-plans-header)",
    ".hf-priority-action #businessPriorityLevel",
    "#businessPriorityLevel.insights-status-badge"
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "category-wide card body tint");
  });
  scenariosPassed++;

  [
    "grid-template-columns: repeat(3, minmax(0, 1fr))",
    "System-defined targets from current decision rules.",
    "target-reference-card-heading",
    ".insights-status-badge"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "compact Target Reference");
  });
  [
    'id="kpiTargetDetailsButton"',
    "View targets"
  ].forEach(function(token)
  {
    assertSourceExcludes(source, token, "removed Target Reference control");
  });
  scenariosPassed++;

  var tabFunctionSource = getSourceRegion(
    source,
    "function resizeVisibleDashboardCharts(tabName)",
    "function scheduleResponsiveChartResize",
    "visible Dashboard chart resize"
  ) + getSourceRegion(
    source,
    "function setActiveDashboardTab(tabName, moveFocus)",
    "function initializeDashboardTabs",
    "Dashboard tab activation"
  );
  ["google.script.run", "getDashboardData(", "requestDashboardData("].forEach(function(token)
  {
    assertSourceExcludes(tabFunctionSource, token, "Insights tab backend request");
  });
  var dashboardRequestSource = getSourceRegion(
    source,
    "function requestDashboardData(request)",
    "function scheduleDeferredDashboardRender",
    "centralized Dashboard request owner"
  );
  [
    "google.script.run",
    ".withSuccessHandler(function(res)",
    ".withFailureHandler(function(err)",
    ".getDashboardData("
  ].forEach(function(token)
  {
    assertSourceContainsOnce(
      dashboardRequestSource,
      token,
      "centralized Dashboard request owner"
    );
  });
  var insightsRenderSource = getSourceRegion(
    source,
    "function renderBusinessIntelligence(res)",
    "function createInitialTransactionEntryState",
    "Insights render ownership"
  );
  [
    ".sort(",
    ".reverse(",
    ".splice(",
    "google.script.run",
    "getDashboardData(",
    "requestDashboardData("
  ].forEach(function(token)
  {
    assertSourceExcludes(insightsRenderSource, token, "Insights response mutation");
  });
  scenariosPassed++;

  var idQueryCount = (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount = (source.match(/document\.querySelector(?:All)?\(/g) || []).length;
  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error("Insights query budget exceeded: ids=" + idQueryCount + ", selectors=" + selectorQueryCount);
  }
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    recommendationOrderPreserved: true,
    editableTargets: false,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };
  Logger.log("PASS: testIntelligencePlanningVisualContract | scenarios=" + summary.scenarios + " | recommendationOrderPreserved=true | editableTargets=false | backendRequests=0 | idQueries=" + summary.idQueries + " | selectorQueries=" + summary.selectorQueries);
  return summary;

  /* Historical pre-final Insights composition retained for release archaeology. */
  var source = getAssembledFrontendSource();
  var scenariosPassed = 0;

  var ownership = {
    insights: [
      "businessPriorityRegion",
      "diagnosisSection",
      "recommendationsSection",
      "riskOpportunitySection",
      "executiveCenter",
      "kpiTargetReference"
    ]
  };

  Object.keys(ownership).forEach(function(panelName)
  {
    ownership[panelName].forEach(function(sectionId)
    {
      assertSourceContainsOnce(
        source,
        'staging.querySelector("#' + sectionId + '")',
        panelName + " ownership / " + sectionId
      );
    });
  });

  var planningOwnershipStart = source.indexOf("insights: [");
  var planningOwnershipEnd = source.indexOf("]", planningOwnershipStart);
  var planningOwnershipSource = source.slice(
    planningOwnershipStart,
    planningOwnershipEnd
  );

  if (
    planningOwnershipSource.indexOf('staging.querySelector("#executiveCenter")') >
    planningOwnershipSource.indexOf('staging.querySelector("#kpiTargetReference")')
  )
  {
    throw new Error("Planning Target Reference must remain last");
  }
  scenariosPassed++;

  [
    'id="diagnosisSection"',
    'aria-labelledby="diagnosisHeading"',
    "Current diagnosis and executive alert",
    "Executive Alert",
    "alert.level",
    "alert.title",
    "alert.message",
    "diagnosis.map(renderDiagnosisCard)",
    "item.description || item.message"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "diagnosis and alert hierarchy");
  });
  scenariosPassed++;

  [
    'id="recommendationsSection"',
    'role="list"',
    'role="listitem"',
    "recommendations",
    ".slice(0,6)",
    ".map(renderTimelineItem)",
    "Recommendation ${index+1}",
    "item.message",
    "item.priority"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "ordered recommendations");
  });
  scenariosPassed++;

  [
    'id="riskOpportunitySection"',
    "Risk Status",
    'id="riskLevel"',
    'id="riskCount"',
    'id="riskList"',
    "Growth Opportunity",
    'id="growthScore"',
    'id="growthStatus"',
    'id="growthMessage"',
    "active risks detected"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "risk and opportunity semantics");
  });
  scenariosPassed++;

  [
    'id="intelligenceMetricContext"',
    'id="intelligenceDirectionContext"',
    "Revenue Intelligence",
    "Profit Intelligence",
    "res.revenueIntelligence.direction",
    "res.revenueIntelligence.growthRate",
    "res.revenueIntelligence.momentum",
    "res.profitIntelligence.direction",
    "res.profitIntelligence.changeRate",
    "res.profitIntelligence.status",
    'res.summary.profit.toLocaleString("id-ID")'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Revenue and Profit Intelligence");
  });
  scenariosPassed++;

  [
    'id="businessFocusCard"',
    'id="priorityActionCard"',
    "Business Focus",
    "Priority Action",
    "res.businessFocus.focus",
    "res.businessFocus.priority",
    "res.businessFocus.reason",
    "res.businessFocus.expectedImpact",
    "res.priorityAction.title",
    "res.priorityAction.impact",
    "res.priorityAction.message"
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "Planning decision hierarchy");
  });

  var planningMarkupStart = source.indexOf('id="executiveCenter"');
  var planningMarkupEnd = source.indexOf('id="riskOpportunitySection"', planningMarkupStart);
  var planningMarkupSource = source.slice(planningMarkupStart, planningMarkupEnd);
  [
    "priority.evidence",
    "priorityAction.score",
    "contenteditable",
    'type="checkbox"'
  ].forEach(function(token)
  {
    assertSourceExcludes(
      planningMarkupSource,
      token,
      "Planning non-editable and non-duplicated priority"
    );
  });
  scenariosPassed++;

  [
    'id="actionRoadmapCard"',
    "res.actionRoadmap.map(function(item,index)",
    "index < res.actionRoadmap.length-1",
    "Week ${item.week}",
    "${item.title}",
    "${item.action}",
    'id="kpiAchievementCard"',
    'role="progressbar"',
    'id="businessMaturityCard"',
    "res.businessMaturity.score",
    "res.businessMaturity.level",
    "res.businessMaturity.description",
    'id="kpiTargetReference"',
    "System-defined targets",
    'aria-expanded="false"',
    'aria-controls="kpiTargetDetails"'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "roadmap and supporting planning status");
  });
  scenariosPassed++;

  [
    "#dashboardPanelInsights:not([hidden])",
    "grid-template-columns: minmax(0, 4fr) minmax(0, 5fr) minmax(0, 3fr)",
    "#dashboardPanelInsights #businessPriorityRegion { grid-column: 1 / -1;",
    "#dashboardPanelInsights #executiveCenter",
    ".dashboard-tab-panel:not(#dashboardPanelOverview) { height: 100%; overflow-y: auto; }",
    "overflow: hidden;",
    "@media (max-width: 1023px)",
    "#dashboardPanelInsights { height: auto; overflow: visible; }",
    "analytics-surface",
    "ui-theme-inset",
    ':root[data-theme="dark"] .bg-white'
  ].forEach(function(token)
  {
    assertSourceContains(source, token, "theme and viewport containment");
  });
  scenariosPassed++;

  var tabFunctionStart =
    source.indexOf("function resizeVisibleDashboardCharts(tabName)");
  var tabFunctionEnd =
    source.indexOf("function setDesktopSidebarCollapsed", tabFunctionStart);
  var tabFunctionSource = source.slice(tabFunctionStart, tabFunctionEnd);

  [
    "google.script.run",
    "getDashboardData(",
    "requestDashboardData("
  ].forEach(function(token)
  {
    assertSourceExcludes(
      tabFunctionSource,
      token,
      "Insights tab backend request"
    );
  });

  assertNoDirectDashboardResponseSort(source, "Insights");
  [".reverse(", ".splice("].forEach(function(token)
  {
    assertSourceExcludes(source, token, "Insights response mutation");
  });

  var idQueryCount =
    (source.match(/document\.getElementById\(/g) || []).length;
  var selectorQueryCount =
    (source.match(/document\.querySelector(?:All)?\(/g) || []).length;

  if (idQueryCount > 72 || selectorQueryCount > 2)
  {
    throw new Error(
      "Insights query budget exceeded: ids=" +
      idQueryCount +
      ", selectors=" +
      selectorQueryCount
    );
  }
  scenariosPassed++;

  var summary = {
    passed: true,
    scenarios: scenariosPassed,
    recommendationOrderPreserved: true,
    editableTargets: false,
    backendRequests: 0,
    idQueries: idQueryCount,
    selectorQueries: selectorQueryCount
  };

  Logger.log(
    "PASS: testIntelligencePlanningVisualContract | scenarios=" +
    summary.scenarios +
    " | recommendationOrderPreserved=" +
    summary.recommendationOrderPreserved +
    " | editableTargets=" +
    summary.editableTargets +
    " | backendRequests=" +
    summary.backendRequests +
    " | idQueries=" +
    summary.idQueries +
    " | selectorQueries=" +
    summary.selectorQueries
  );

  return summary;
}
