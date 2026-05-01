/**
 * 收费版规则引擎。
 * 输入：freeSnapshot（免费版快照）、paidAnswers（收费版24题答案）。
 * 输出：收费版诊断结果对象。
 */

function avg(values) {
  const valid = values.filter((value) => typeof value === "number" && !Number.isNaN(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function maturityToScore(value) {
  return clamp(value * 25);
}

function riskFromMaturity(value) {
  return clamp(100 - value * 25);
}

function avgMaturityToScore(values) {
  return maturityToScore(avg(values));
}

function avgMaturityToRisk(values) {
  return riskFromMaturity(avg(values));
}

function reverseComplexityToMaturity(value) {
  return 4 - value;
}

function calcComplexityIndex(a) {
  return clamp(
    avg([
      a.P01_family_complexity,
      a.P02_member_crossborder_complexity,
      a.P13_equity_holding_complexity,
      a.P14_control_structure_complexity,
      a.P17_overseas_asset_complexity,
      a.P18_overseas_identity_complexity,
    ]) * 25
  );
}

function calcToolCoverageScore(a) {
  return avgMaturityToScore([
    a.P05_insurance_coverage,
    a.P09_legal_docs_coverage,
    a.P10_will_asset_coverage,
    a.P15_articles_shareholder_rules,
    a.P19_tax_residency_review,
    a.P21_advisor_coverage,
    a.P23_control_audit_mechanism,
  ]);
}

function calcToolFitScore(a) {
  return avgMaturityToScore([
    a.P07_policy_consistency,
    a.P11_document_consistency,
    a.P12_marital_shareholder_exit,
    a.P15_articles_shareholder_rules,
    a.P19_tax_residency_review,
    a.P20_overseas_inheritance_tax_review,
    a.P22_advisor_coordination,
  ]);
}

function calcExecutionClarityScore(a) {
  return avgMaturityToScore([
    a.P03_file_visibility,
    a.P04_emergency_successor,
    a.P08_claim_readiness,
    a.P16_business_continuity,
    a.P22_advisor_coordination,
    a.P23_control_audit_mechanism,
  ]);
}

function calcCostEffectivenessScore(a) {
  return avgMaturityToScore([
    a.P21_advisor_coverage,
    a.P22_advisor_coordination,
    a.P23_control_audit_mechanism,
    a.P24_cost_function_review,
  ]);
}

function calcFailureSensitivityRisk(a, free) {
  const complexityIndex = calcComplexityIndex(a);
  const maturityScore = avg([
    calcToolCoverageScore(a),
    calcToolFitScore(a),
    calcExecutionClarityScore(a),
    calcCostEffectivenessScore(a),
  ]);

  const freeRiskAdj = avg([
    free.riskScores.R1 || 0,
    free.riskScores.R3 || 0,
    free.riskScores.R4 || 0,
    free.riskScores.R5 || 0,
    free.riskScores.R7 || 0,
  ]) * 0.2;

  return clamp(100 - maturityScore + freeRiskAdj + complexityIndex * 0.15);
}

function calcOverallExecutabilityScore(a, free) {
  const toolCoverage = calcToolCoverageScore(a);
  const toolFit = calcToolFitScore(a);
  const executionClarity = calcExecutionClarityScore(a);
  const costEffectiveness = calcCostEffectivenessScore(a);
  const failureRisk = calcFailureSensitivityRisk(a, free);

  return clamp(
    toolCoverage * 0.25 +
      toolFit * 0.25 +
      executionClarity * 0.25 +
      costEffectiveness * 0.15 +
      (100 - failureRisk) * 0.1
  );
}

function ratingFromScore(score) {
  if (score >= 75) return { level: "较稳健", color: "green" };
  if (score >= 55) return { level: "需关注", color: "yellow" };
  if (score >= 35) return { level: "明显不足", color: "orange" };
  return { level: "高度不确定", color: "red" };
}

function eventDeathRisk(a, free) {
  const maturity = avgMaturityToScore([
    a.P03_file_visibility,
    a.P06_policy_role_clarity,
    a.P07_policy_consistency,
    a.P08_claim_readiness,
    a.P09_legal_docs_coverage,
    a.P10_will_asset_coverage,
    a.P11_document_consistency,
    a.P15_articles_shareholder_rules,
    a.P16_business_continuity,
  ]);
  return clamp(100 - maturity + (free.riskScores.R1 || 0) * 0.15 + (free.riskScores.R5 || 0) * 0.1 + calcComplexityIndex(a) * 0.1);
}

function eventIncapacityRisk(a, free) {
  const maturity = avgMaturityToScore([
    a.P03_file_visibility,
    a.P04_emergency_successor,
    a.P09_legal_docs_coverage,
    a.P16_business_continuity,
    a.P22_advisor_coordination,
    a.P23_control_audit_mechanism,
  ]);
  return clamp(100 - maturity + (free.riskScores.R5 || 0) * 0.2 + (free.riskScores.R1 || 0) * 0.1 + calcComplexityIndex(a) * 0.08);
}

function eventMarriageRisk(a, free) {
  const maturity = avgMaturityToScore([
    a.P07_policy_consistency,
    a.P11_document_consistency,
    a.P12_marital_shareholder_exit,
    reverseComplexityToMaturity(a.P13_equity_holding_complexity),
    a.P15_articles_shareholder_rules,
  ]);
  return clamp(100 - maturity + (free.riskScores.R4 || 0) * 0.2 + (free.riskScores.R3 || 0) * 0.1 + a.P01_family_complexity * 5);
}

function eventTaxReviewRisk(a, free) {
  const maturity = avgMaturityToScore([
    a.P19_tax_residency_review,
    a.P20_overseas_inheritance_tax_review,
    a.P22_advisor_coordination,
    a.P24_cost_function_review,
  ]);
  const crossBorderComplexity = avg([
    a.P02_member_crossborder_complexity,
    a.P17_overseas_asset_complexity,
    a.P18_overseas_identity_complexity,
  ]) * 25;
  return clamp(100 - maturity + crossBorderComplexity * 0.2 + (free.riskScores.R4 || 0) * 0.2 + (free.riskScores.R7 || 0) * 0.15);
}

function eventControlTransferRisk(a, free) {
  const maturity = avgMaturityToScore([
    a.P11_document_consistency,
    a.P12_marital_shareholder_exit,
    a.P15_articles_shareholder_rules,
    a.P16_business_continuity,
    a.P22_advisor_coordination,
  ]);
  const controlComplexity = avg([
    a.P13_equity_holding_complexity,
    a.P14_control_structure_complexity,
  ]) * 25;
  return clamp(100 - maturity + controlComplexity * 0.2 + (free.riskScores.R1 || 0) * 0.15 + (free.riskScores.R3 || 0) * 0.15);
}

function eventLiquidityShockRisk(a, free) {
  const maturity = avgMaturityToScore([
    a.P05_insurance_coverage,
    a.P21_advisor_coverage,
    a.P22_advisor_coordination,
    a.P23_control_audit_mechanism,
    a.P24_cost_function_review,
  ]);
  return clamp(100 - maturity + (free.riskScores.R3 || 0) * 0.3 + (free.riskScores.R2 || 0) * 0.1 + (free.riskScores.R7 || 0) * 0.1);
}

function calcEventRisks(a, free) {
  return {
    death: round1(eventDeathRisk(a, free)),
    incapacity: round1(eventIncapacityRisk(a, free)),
    marriage: round1(eventMarriageRisk(a, free)),
    taxReview: round1(eventTaxReviewRisk(a, free)),
    controlTransfer: round1(eventControlTransferRisk(a, free)),
    liquidityShock: round1(eventLiquidityShockRisk(a, free)),
  };
}

function insuranceFailureRisk(a, free) {
  const maturity = avgMaturityToScore([
    a.P05_insurance_coverage,
    a.P06_policy_role_clarity,
    a.P07_policy_consistency,
    a.P08_claim_readiness,
  ]);
  return clamp(100 - maturity + (free.riskScores.R5 || 0) * 0.1 + (free.riskScores.R4 || 0) * 0.1);
}

function legalDocsFailureRisk(a, free) {
  const maturity = avgMaturityToScore([
    a.P09_legal_docs_coverage,
    a.P10_will_asset_coverage,
    a.P11_document_consistency,
    a.P12_marital_shareholder_exit,
  ]);
  return clamp(100 - maturity + (free.riskScores.R1 || 0) * 0.15 + (free.riskScores.R4 || 0) * 0.15);
}

function controlFailureRisk(a, free) {
  const maturity = avgMaturityToScore([
    reverseComplexityToMaturity(a.P13_equity_holding_complexity),
    reverseComplexityToMaturity(a.P14_control_structure_complexity),
    a.P15_articles_shareholder_rules,
    a.P16_business_continuity,
  ]);
  return clamp(100 - maturity + (free.riskScores.R1 || 0) * 0.15 + (free.riskScores.R3 || 0) * 0.15);
}

function crossBorderFailureRisk(a, free) {
  const maturity = avgMaturityToScore([
    a.P19_tax_residency_review,
    a.P20_overseas_inheritance_tax_review,
    a.P22_advisor_coordination,
  ]);
  const complexity = avg([
    a.P17_overseas_asset_complexity,
    a.P18_overseas_identity_complexity,
    a.P02_member_crossborder_complexity,
  ]) * 25;
  return clamp(100 - maturity + complexity * 0.2 + (free.riskScores.R4 || 0) * 0.15 + (free.riskScores.R7 || 0) * 0.15);
}

function advisorFailureRisk(a, free) {
  const maturity = avgMaturityToScore([
    a.P21_advisor_coverage,
    a.P22_advisor_coordination,
    a.P23_control_audit_mechanism,
    a.P24_cost_function_review,
  ]);
  return clamp(100 - maturity + (free.riskScores.R5 || 0) * 0.2 + (free.riskScores.R6 || 0) * 0.1);
}

function calcToolFailureRisks(a, free) {
  return {
    insurance: round1(insuranceFailureRisk(a, free)),
    legalDocs: round1(legalDocsFailureRisk(a, free)),
    control: round1(controlFailureRisk(a, free)),
    crossBorder: round1(crossBorderFailureRisk(a, free)),
    advisor: round1(advisorFailureRisk(a, free)),
  };
}

function recommendServices(toolFailureRisks, eventRisks) {
  const scores = {};

  function add(code, points) {
    scores[code] = (scores[code] || 0) + points;
  }

  Object.entries(toolFailureRisks).forEach(([key, risk]) => {
    const codes = PAID_SERVICE_MAP[key] || [];
    if (risk >= 75) codes.forEach((code) => add(code, 20));
    else if (risk >= 60) codes.forEach((code) => add(code, 12));
    else if (risk >= 45) codes.forEach((code) => add(code, 6));
  });

  Object.entries(eventRisks).forEach(([key, risk]) => {
    if (risk < 75) return;
    if (key === "death") ["2.3.7", "2.3.4", "1.2.8"].forEach((code) => add(code, 15));
    if (key === "incapacity") ["1.2.8", "2.7.7", "2.7.4"].forEach((code) => add(code, 15));
    if (key === "marriage") ["3.1.7", "2.3.1", "1.1.4"].forEach((code) => add(code, 15));
    if (key === "taxReview") ["2.3.3", "3.2.1", "3.2.4"].forEach((code) => add(code, 15));
    if (key === "controlTransfer") ["1.1.4", "2.2.2", "3.1.1"].forEach((code) => add(code, 15));
    if (key === "liquidityShock") ["3.3.2", "1.2.7", "2.1.5"].forEach((code) => add(code, 15));
  });

  return Object.entries(scores)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([serviceCode, score]) => ({
      serviceCode,
      score,
      label: PAID_SERVICE_LABELS[serviceCode] || serviceCode,
      desc: PAID_SERVICE_DESCRIPTIONS[serviceCode] || "",
    }));
}

function selectReportBlocks(payload) {
  const selected = [];
  const toolRisks = payload.toolFailureRisks;
  const complexityIndex = payload.complexityIndex;
  const indices = payload.indices;

  if (toolRisks.insurance >= 65) selected.push(getPaidReportBlock("INSURANCE_FAILURE_HIGH"));
  if (toolRisks.legalDocs >= 65) selected.push(getPaidReportBlock("LEGAL_DOCS_FAILURE_HIGH"));
  if (toolRisks.control >= 65) selected.push(getPaidReportBlock("CONTROL_FAILURE_HIGH"));
  if (toolRisks.crossBorder >= 65) selected.push(getPaidReportBlock("CROSS_BORDER_FAILURE_HIGH"));
  if (toolRisks.advisor >= 65) selected.push(getPaidReportBlock("ADVISOR_FAILURE_HIGH"));
  if (indices.costEffectiveness <= 45) selected.push(getPaidReportBlock("COST_MISMATCH_HIGH"));
  if (indices.executionClarity <= 45) selected.push(getPaidReportBlock("EMERGENCY_EXECUTION_WEAK"));
  if (indices.toolFit <= 50) selected.push(getPaidReportBlock("DOCUMENT_CONSISTENCY_WEAK"));
  if (complexityIndex >= 70) selected.push(getPaidReportBlock("OVERSEAS_COMPLEXITY_HIGH"));
  if (complexityIndex >= 60) selected.push(getPaidReportBlock("FAMILY_COMPLEXITY_HIGH"));

  return selected.filter(Boolean).slice(0, 5);
}

function buildCaseSignals(diagnosis) {
  const items = [];
  if (diagnosis.eventRisks.death >= 65) {
    items.push("离世事件下，文件、理赔与股权接管路径是首要演练对象。");
  }
  if (diagnosis.eventRisks.incapacity >= 65) {
    items.push("失能事件下，授权、账户、印鉴和经营决策的接续最容易先断。");
  }
  if (diagnosis.eventRisks.taxReview >= 65) {
    items.push("跨境身份、海外资产与申报义务会放大税务审查时的执行难度。");
  }
  if (diagnosis.toolFailureRisks.advisor >= 65) {
    items.push("顾问并不少，但缺统筹时，系统风险会在关键节点集中暴露。");
  }
  if (!items.length) {
    items.push("当前更多是工具适配与执行细节上的优化空间，而非单点高危缺口。");
  }
  return items;
}

function buildNinetyDayActions(reportBlocks, serviceRecommendations) {
  const actions = [];
  reportBlocks.forEach((block) => {
    block.actions.forEach((action) => actions.push(action));
  });
  serviceRecommendations.slice(0, 3).forEach((service) => {
    actions.push(`围绕「${service.label}」安排一次资料梳理与顾问核查会议。`);
  });
  return Array.from(new Set(actions)).slice(0, 8);
}

function generatePaidDiagnosis(freeSnapshot, paidAnswers) {
  const complexityIndex = round1(calcComplexityIndex(paidAnswers));
  const indices = {
    toolCoverage: round1(calcToolCoverageScore(paidAnswers)),
    toolFit: round1(calcToolFitScore(paidAnswers)),
    executionClarity: round1(calcExecutionClarityScore(paidAnswers)),
    costEffectiveness: round1(calcCostEffectivenessScore(paidAnswers)),
    failureSensitivity: round1(calcFailureSensitivityRisk(paidAnswers, freeSnapshot)),
  };

  const overallExecutabilityScore = round1(
    calcOverallExecutabilityScore(paidAnswers, freeSnapshot)
  );
  const overallRating = ratingFromScore(overallExecutabilityScore);
  const eventRisks = calcEventRisks(paidAnswers, freeSnapshot);
  const toolFailureRisks = calcToolFailureRisks(paidAnswers, freeSnapshot);
  const reportBlocks = selectReportBlocks({
    complexityIndex,
    indices,
    eventRisks,
    toolFailureRisks,
  });
  const serviceRecommendations = recommendServices(toolFailureRisks, eventRisks);

  const diagnosis = {
    version: "paid-v1.0",
    freeSnapshot,
    paidAnswers,
    complexityIndex,
    indices,
    overallExecutabilityScore,
    overallRating,
    eventRisks,
    toolFailureRisks,
    reportBlocks,
    caseSignals: [],
    ninetyDayActions: [],
    serviceRecommendations,
    generatedAt: new Date().toISOString(),
  };

  diagnosis.caseSignals = buildCaseSignals(diagnosis);
  diagnosis.ninetyDayActions = buildNinetyDayActions(reportBlocks, serviceRecommendations);
  return diagnosis;
}
