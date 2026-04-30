/**
 * 家族风险诊断引擎 v4.0（线上版）
 * 口径：与 offline/core.py + offline/core_v4.py 对齐
 */

// ═══════════════════ v4.0 路由题（RQ1-RQ5） ═══════════════════
const ROUTING_QS = [
  { id: "RQ1", text: "家族主要财富来源行业是什么？", options: ["制造业/传统实业","科技/互联网/新经济","金融/投资/资管","医生/律师/专业服务","商贸/流通/区域商帮"] },
  { id: "RQ2", text: "家族核心资产和业务主要位于哪个地区？", options: ["中国大陆","港澳台地区","东南亚/中东","欧美/大洋洲（移民背景）"] },
  { id: "RQ3", text: "当前核心决策人（掌门人）是家族第几代？", options: ["第一代（创始人本人）","第二代（已接班或正在交接）","第三代及以上"] },
  { id: "RQ4", text: "家族可投资资产总规模大致在？", options: ["5000万以下","5000万-5亿","5亿-50亿","50亿以上"] },
  { id: "RQ5", text: "家族核心成员（配偶、子女）的身份/居住地分布？", options: ["基本在同一城市","分布在多个城市/省份","有跨境/多国身份分布"] },
];

const PERSONA_SCORE_MATRIX = {
  RQ1: { 0: { P1:3, P3:3 }, 1: { P2:5 }, 2: { P5:5 }, 3: { P6:5 }, 4: { P4:5 } },
  RQ2: { 0: { P1:2, P3:1, P4:1 }, 1: { P7:5 }, 2: { P8:5 }, 3: { P9:5 } },
  RQ4: { 0: { P6:2 }, 1: { P1:1, P4:1 }, 2: { P7:1, P3:1 }, 3: { P8:2 } },
  RQ5: { 0: { P1:1, P4:1 }, 1: { P3:1 }, 2: { P7:1, P8:2, P9:2 } },
};

// ═══════════════════ 题库（19主题 + 6行为） ═══════════════════
const QUESTIONS = {
  G01: { module:"治理", label:"家族宪章/章程", text:"家族是否已有正式家族宪章/章程？", opts:{0:"完全没有",1:"有零散规则",2:"有草案",3:"有正式文件",4:"有文件且定期修订"} },
  G02: { module:"治理", label:"冲突调解机制", text:"是否有正式冲突调解机制？", opts:{0:"完全没有",1:"临时处理",2:"有非正式机制",3:"有正式流程",4:"正式流程且有触发机制"} },
  G03: { module:"治理", label:"家企治理边界", text:"家企治理边界是否清晰？", opts:{0:"严重混同",1:"多处混同",2:"部分清晰",3:"基本清晰",4:"边界清晰且有文件"} },
  S01: { module:"传承", label:"书面传承计划", text:"是否有书面传承计划？", opts:{0:"没有",1:"口头想法",2:"初步草案",3:"正式计划",4:"正式计划+里程碑"} },
  S02: { module:"传承", label:"接班人意愿", text:"核心接班人意愿如何？", opts:{0:"明确拒绝",1:"偏低",2:"一般",3:"较高",4:"明确且持续"} },
  S03: { module:"传承", label:"B角/备份接管", text:"是否存在B角/备份接管安排？", opts:{0:"没有",1:"临时替代",2:"部分安排",3:"明确安排",4:"安排明确且演练过"} },
  A01: { module:"资产", label:"核心资产隔离", text:"核心资产是否有隔离结构？", opts:{0:"没有",1:"极弱",2:"部分隔离",3:"大部分隔离",4:"系统隔离"} },
  A02: { module:"资产", label:"流动性安全垫", text:"高流动性资产覆盖家族/系统支出月数？", opts:{0:"<3个月",1:"3-6个月",2:"6-12个月",3:"12-24个月",4:">24个月"} },
  A03: { module:"资产", label:"资产分散化", text:"资产配置的分散化程度？", opts:{0:"极度集中",1:"较集中",2:"中性",3:"较分散",4:"高度分散"} },
  C01: { module:"合规", label:"遗嘱/意愿安排", text:"是否有遗嘱/意愿安排？", opts:{0:"没有",1:"零散安排",2:"有单一文件",3:"较完整",4:"完整且统筹一致"} },
  C02: { module:"合规", label:"婚姻防火墙", text:"核心股权是否有婚姻防火墙？", opts:{0:"没有",1:"极弱",2:"部分覆盖",3:"大部分覆盖",4:"系统覆盖"} },
  C03: { module:"合规", label:"税务规划", text:"是否有税务居民与跨境申报规划？", opts:{0:"没有",1:"临时应对",2:"基础规划",3:"较完整",4:"完整并年度复核"} },
  T01: { module:"人才", label:"关键岗位替代能力", text:"核心岗位的可替代性与备份能力？", opts:{0:"无替代方案",1:"极弱",2:"部分可替代",3:"大部分可替代",4:"充分可替代且有演练"} },
  T02: { module:"人才", label:"双签/复核机制", text:"关键支付/指令是否有双签/复核机制？", opts:{0:"没有",1:"个别有",2:"部分有",3:"大部分有",4:"系统落实"} },
  T03: { module:"人才", label:"顾问体系独立性", text:"外部顾问/服务机构的分散与制衡程度？", opts:{0:"完全依赖单一方",1:"较弱",2:"中等",3:"较好",4:"充分分散且有制衡"} },
  RISK01: { module:"关系", label:"家族凝聚力", text:"家族凝聚力与协作水平？", opts:{0:"严重对立",1:"较弱",2:"一般",3:"较强",4:"高度一致"} },
  RISK02: { module:"关系", label:"声誉预案", text:"是否有危机公关与声誉预案？", opts:{0:"没有",1:"临时处理",2:"基础预案",3:"较完整",4:"完整且演练"} },
  X01: { module:"外部", label:"地缘分散度", text:"地缘与法域分散程度？", opts:{0:"极度集中",1:"较集中",2:"中性",3:"较分散",4:"高度分散"} },
  X02: { module:"外部", label:"第二曲线", text:"是否有第二曲线/转型布局？", opts:{0:"没有",1:"很弱",2:"有探索",3:"较清晰",4:"明确且执行中"} },
  F01: { module:"风险心智", label:"当前准备程度", text:"如果未来几年出现家庭、资产或税务方面的重要变化，我们目前已有基本准备。", opts:{0:"非常不符合",1:"不太符合",2:"一般/不确定",3:"比较符合",4:"非常符合"} },
  F02: { module:"风险心智", label:"冲击影响感知", text:"如果出现较大的市场波动、健康事件、婚姻变化、身份或政策变化，我们的家庭财富会受到明显影响。", opts:{0:"非常不符合",1:"不太符合",2:"一般/不确定",3:"比较符合",4:"非常符合"} },
  F03: { module:"风险心智", label:"尾部风险关注", text:"即使某些事情发生概率不高，只要后果严重，我们也会提前把它考虑进去。", opts:{0:"非常不符合",1:"不太符合",2:"一般/不确定",3:"比较符合",4:"非常符合"} },
  F04: { module:"风险心智", label:"可承受资产回撤", text:"如果家庭可投资资产在一年内出现账面下跌，您最多能接受的幅度是？", opts:{0:"5%以内",1:"5%–10%",2:"10%–20%",3:"20%–30%",4:"30%以上"} },
  F05: { module:"风险心智", label:"集中配置容忍度", text:"如果某项资产、业务或投资长期表现很好，我们可以接受家庭财富继续较集中地放在其中。", opts:{0:"非常不符合",1:"不太符合",2:"一般/不确定",3:"比较符合",4:"非常符合"} },
  F06: { module:"风险心智", label:"调整意愿", text:"如果我们判断某类风险未来可能上升，会考虑提前调整相关财富、法律、税务或传承安排。", opts:{0:"非常不符合",1:"不太符合",2:"一般/不确定",3:"比较符合",4:"非常符合"} },
};

const SCORE_OPTIONS = [
  { value:0, label:"0分" },
  { value:1, label:"1分" },
  { value:2, label:"2分" },
  { value:3, label:"3分" },
  { value:4, label:"4分" },
];

const PERSONA_OPTIONS = [
  { value:"P1", label:"大陆本土实业家" }, { value:"P2", label:"科技新贵 / 创业者" }, { value:"P3", label:"传统制造 / 实业" },
  { value:"P4", label:"区域商帮家族" }, { value:"P5", label:"金融投资家" }, { value:"P6", label:"高收入专业人士" },
  { value:"P7", label:"港澳台 / 传统商业" }, { value:"P8", label:"东南亚 / 中东华人巨族" }, { value:"P9", label:"近代移民 / 新生代" },
];

const STAGE_OPTIONS = [
  { value:"创业与交接期", label:"创业与交接期（一代→二代）" },
  { value:"制度化治理期", label:"制度化治理期（二代→三代）" },
  { value:"跨代生态治理期", label:"跨代生态治理期（三代以上）" },
];

// ═══════════════════ 模型参数（对齐 core.py） ═══════════════════
const STAGE_ADJUSTMENTS = {
  "创业与交接期":   { R1:1.2, R2:1.0, R3:1.1, R4:1.0,  R5:1.1, R6:0.9,  R7:0.9  },
  "制度化治理期":   { R1:1.1, R2:1.0, R3:1.0, R4:1.05, R5:1.0, R6:1.0,  R7:0.95 },
  "跨代生态治理期": { R1:1.0, R2:1.05, R3:1.0, R4:1.1,  R5:1.0, R6:1.1,  R7:1.2  },
};

const PERSONA_SCENARIO_BIAS = {
  P1: { "创始人失能/离世":1.3, "银行抽贷/现金流骤降":1.1 },
  P2: { "婚姻变动冲击控制权":1.3, "创始人失能/离世":1.1 },
  P3: { "创始人失能/离世":1.3, "银行抽贷/现金流骤降":1.1 },
  P4: { "银行抽贷/现金流骤降":1.4, "创始人失能/离世":1.0 },
  P5: { "代理人欺诈/顾问失信":1.4, "创始人失能/离世":0.9 },
  P6: { "创始人失能/离世":1.3 },
  P7: { "婚姻变动冲击控制权":1.2, "创始人失能/离世":1.1 },
  P8: { "地缘政治/政策突变":1.3, "税务/合规突袭":1.2 },
  P9: { "创始人失能/离世":1.2, "税务/合规突袭":1.1 },
};

const REDLINE_RULES = {
  RL01: { desc:"无书面传承计划", qid:"S01", threshold:1, risk:"R1", services:["1.2.3","2.2.2"] },
  RL02: { desc:"无遗嘱/意愿安排", qid:"C01", threshold:1, risk:"R1", services:["2.3.7","3.1.1"] },
  RL03: { desc:"核心资产无隔离", qid:"A01", threshold:1, risk:"R3", services:["2.3.1","3.1.1"] },
  RL04: { desc:"关键人单点依赖", qid:"T01", threshold:1, risk:"R5", services:["1.2.8","2.2.2"] },
  RL05: { desc:"无婚姻防火墙", qid:"C02", threshold:1, risk:"R4", services:["3.1.7","2.3.1"] },
  RL06: { desc:"无税务规划", qid:"C03", threshold:1, risk:"R4", services:["3.2.1","3.2.4"] },
  RL07: { desc:"无冲突机制", qid:"G02", threshold:1, risk:"R1", services:["1.1.5","1.1.1"] },
  RL08: { desc:"流动性不足", qid:"A02", threshold:1, risk:"R3", services:["3.3.2","1.2.8"] },
  RL09: { desc:"无应急接管", qid:"S03", threshold:1, risk:"R5", services:["2.3.7","1.2.8"] },
};

const RISK_LABELS = {
  R1:"传承与治理风险", R2:"战略与执行风险", R3:"财务与资本风险",
  R4:"合规与法律风险", R5:"人才与运营风险", R6:"社会与声誉风险", R7:"外部与系统性风险",
};

const RISK_SERVICE_MAP = {
  R1: ["1.2.8","2.3.7","1.1.1","2.2.2","1.2.3","1.1.5"],
  R2: ["1.2.4","2.2.3","1.2.7","2.2.4","2.1.1"],
  R3: ["2.3.1","3.3.2","3.1.1","3.3.3","3.3.1","1.1.4"],
  R4: ["3.2.1","3.2.4","3.1.7","2.3.7","3.1.3"],
  R5: ["1.2.8","2.2.2","2.3.2","3.3.5","2.4.1"],
  R6: ["1.1.5","2.7.5"],
  R7: ["2.7.7","1.2.4","2.1.1"],
};

const STRESS_SERVICE_MAP = {
  "创始人失能/离世": ["1.2.8","2.3.7","2.2.2","2.3.4","2.3.5"],
  "婚姻变动冲击控制权": ["3.1.7","2.3.1","1.1.4","3.1.1"],
  "银行抽贷/现金流骤降": ["3.3.2","1.2.8","3.3.3"],
  "代理人欺诈/顾问失信": ["2.3.2","1.2.8","3.3.5","3.3.1"],
  "税务/合规突袭": ["3.2.1","3.2.4","3.1.3"],
  "地缘政治/政策突变": ["2.7.7","1.2.4","1.2.7"],
};

const SERVICE_LABELS = {
  "1.1.1":"家族宪章设计","1.1.4":"股权架构优化","1.1.5":"冲突调解机制","1.2.3":"传承路线图",
  "1.2.4":"战略转型咨询","1.2.7":"资产配置规划","1.2.8":"A/B角建设","2.1.1":"投资组合管理",
  "2.2.2":"接班人培养","2.2.3":"企业战略转型","2.2.4":"第二曲线孵化","2.3.1":"资产隔离架构",
  "2.3.2":"顾问风控","2.3.4":"健康管理","2.3.5":"失能预案","2.3.7":"应急接管手册",
  "2.4.1":"二代领导力","2.7.5":"声誉危机管理","2.7.7":"地缘对冲","3.1.1":"信托设计",
  "3.1.3":"多法域协调","3.1.7":"婚姻财产","3.2.1":"税务规划","3.2.4":"CRS/FATCA",
  "3.3.1":"财务审计","3.3.2":"现金流管理","3.3.3":"应急资金池","3.3.5":"内控建设",
};

const SERVICE_DESCRIPTIONS = {
  "1.2.8":"建立双核心负责人机制，降低单点失能风险",
  "2.3.7":"制定完整的权力移交与应急接管操作手册",
  "3.1.1":"通过信托结构实现核心资产法律上的结构性保护",
  "1.1.1":"起草家族宪章，明确家族治理原则与顶层决策流程",
};

const STRESS_SCENARIOS = {
  "创始人失能/离世":   { qids:["S01","S03","T01","C01"], icon:"💀", color:"#e53935" },
  "婚姻变动冲击控制权": { qids:["C02","A01","G03"], icon:"💔", color:"#e67e22" },
  "银行抽贷/现金流骤降": { qids:["A02","A03"], icon:"🏦", color:"#f9a825" },
  "代理人欺诈/顾问失信": { qids:["T02","T03"], icon:"🕵️", color:"#9b59b6" },
  "税务/合规突袭": { qids:["C03","C01","X01"], icon:"⚖️", color:"#3498db" },
  "地缘政治/政策突变": { qids:["X01","X02","A03"], icon:"🌍", color:"#1abc9c" },
};

const QID_LABELS = {
  G01:"宪章", G02:"冲突", G03:"边界", S01:"传承", S02:"接班", S03:"B角",
  A01:"隔离", A02:"流动性", A03:"集中度", C01:"遗嘱", C02:"婚姻", C03:"税务",
  T01:"关键人", T02:"双签", T03:"顾问", RISK01:"凝聚力", RISK02:"声誉", X01:"地缘", X02:"二曲线",
};

const M_LABELS = {
  M01:"传承准备度", M02:"治理成熟度", M03:"家企边界清晰度", M04:"资产隔离度", M05:"流动性韧性",
  M06:"合规清晰度", M07:"关键人冗余度", M08:"家族凝聚力", M09:"专业化运营度", M10:"外部分散度",
};

// ═══════════════════ v4.0 辅助函数 ═══════════════════
function diagnosePersona(routingAns) {
  const scores = {P1:0,P2:0,P3:0,P4:0,P5:0,P6:0,P7:0,P8:0,P9:0};
  for (const [rqId, matrix] of Object.entries(PERSONA_SCORE_MATRIX)) {
    const idx = routingAns[rqId] ?? 0;
    const hit = matrix[idx] || {};
    for (const [p, pts] of Object.entries(hit)) scores[p] += pts;
  }
  return Object.keys(scores).reduce((a,b) => scores[a] >= scores[b] ? a : b);
}

function diagnoseStage(routingAns) {
  const idx = routingAns.RQ3 ?? 0;
  const stages = ["创业与交接期","制度化治理期","跨代生态治理期"];
  const descs = [
    "第一代创始人仍为核心决策者，传承计划和治理结构尚在建设中",
    "第二代已接班或正在交接，需要制度化治理框架",
    "家族已跨越三代以上，需要生态化治理和多元化发展",
  ];
  return { stage: stages[idx], desc: descs[idx] };
}

function calcBehavioralScores(answers) {
  const getV = (qid) => parseInt(answers[qid] ?? 0, 10);
  const awareness = ((4 - getV("F01") + getV("F02") + getV("F03")) / 12) * 100;
  const tolerance = ((getV("F04") + getV("F05")) / 8) * 100;
  const intention = (getV("F06") / 4) * 100;
  const lvl = (s) => s < 40 ? "低" : (s < 67 ? "中" : "高");
  let mindset = "平衡观察客户";
  if (awareness >= 67 && tolerance >= 67) mindset = "发展型重点客户";
  else if (awareness >= 67 && tolerance < 40) mindset = "防御型焦虑客户";
  else if (awareness < 40 && tolerance >= 67) mindset = "进取但低防护客户";
  else if (awareness < 40 && tolerance < 40) mindset = "保守观望客户";
  const leadPriority = (awareness >= 67 && intention >= 67) ? "A" : ((awareness >= 40 && intention >= 40) ? "B" : "C");
  return {
    risk_awareness_score: r1(awareness),
    risk_awareness_level: lvl(awareness),
    risk_tolerance_score: r1(tolerance),
    risk_tolerance_level: lvl(tolerance),
    adjustment_intention_score: r1(intention),
    adjustment_intention_level: lvl(intention),
    lead_priority: leadPriority,
    client_risk_mindset: mindset,
  };
}

// ═══════════════════ Computation Functions ═══════════════════
function calcIntermediateVars(ans) {
  return {
    M01: r3(0.35*ans.S01 + 0.25*ans.S02 + 0.25*ans.S03 + 0.15*ans.C01),
    M02: r3(0.35*ans.G01 + 0.35*ans.G02 + 0.30*ans.G03),
    M03: r3(0.50*ans.G03 + 0.50*ans.A01),
    M04: r3(0.40*ans.A01 + 0.35*ans.C02 + 0.25*ans.C01),
    M05: r3(0.65*ans.A02 + 0.35*ans.A03),
    M06: r3(0.30*ans.C01 + 0.30*ans.C02 + 0.40*ans.C03),
    M07: r3(0.45*ans.T01 + 0.30*ans.T02 + 0.25*ans.S03),
    M08: r3(0.60*ans.RISK01 + 0.40*ans.G02),
    M09: r3(0.40*ans.T02 + 0.35*ans.T03 + 0.25*ans.RISK02),
    M10: r3(0.35*ans.X01 + 0.35*ans.X02 + 0.30*ans.A03),
  };
}

function calcRiskScores(M, stage) {
  const R = {
    R1: (1 - (0.40*M.M01 + 0.35*M.M02 + 0.25*M.M08) / 4) * 100,
    R2: (1 - (0.40*M.M02 + 0.35*M.M10 + 0.25*M.M01) / 4) * 100,
    R3: (1 - (0.30*M.M03 + 0.35*M.M04 + 0.35*M.M05) / 4) * 100,
    R4: (1 - (0.45*M.M06 + 0.30*M.M04 + 0.25*M.M03) / 4) * 100,
    R5: (1 - (0.40*M.M07 + 0.35*M.M09 + 0.25*M.M01) / 4) * 100,
    R6: (1 - (0.35*M.M08 + 0.30*M.M09 + 0.35*M.M02) / 4) * 100,
    R7: (1 - (0.45*M.M10 + 0.30*M.M05 + 0.25*M.M06) / 4) * 100,
  };
  const adj = STAGE_ADJUSTMENTS[stage] || {};
  for (const rk of Object.keys(R)) {
    if (adj[rk]) R[rk] = Math.min(100, R[rk] * adj[rk]);
  }
  return R;
}

function checkRedlines(ans) {
  return Object.entries(REDLINE_RULES)
    .filter(([, rule]) => (ans[rule.qid] ?? 4) <= rule.threshold)
    .map(([code, rule]) => ({ code, desc:rule.desc, qid:rule.qid, value:ans[rule.qid], risk:rule.risk, services:rule.services }));
}

function checkInteractions(ans) {
  const t = [];
  if (ans.T01<=1 && ans.S03<=1) t.push({ code:"IX01", desc:"关键人×无B角", risks:["R1","R5"] });
  if (ans.G02<=1 && ans.RISK01<=1) t.push({ code:"IX02", desc:"分散×裂痕", risks:["R1","R6"] });
  if (ans.C03<=1 && ans.C01<=1) t.push({ code:"IX03", desc:"跨境×税务不清", risks:["R4"] });
  if (ans.A02<=1 && ans.A03<=1) t.push({ code:"IX04", desc:"低流动×集中", risks:["R3"] });
  if (ans.S02<=1 && ans.T01<=1) t.push({ code:"IX05", desc:"无意愿×依赖", risks:["R1","R5"] });
  if (ans.T03<=1 && ans.T02<=1) t.push({ code:"IX06", desc:"顾问×无双签", risks:["R5"] });
  return t;
}

function applyAdjustments(R, redlines, interactions) {
  const rlAdj = {};
  for (const rl of redlines) {
    const cur = rlAdj[rl.risk] || 0;
    if (cur < 20) {
      const add = Math.min(cur===0 ? 10 : cur<15 ? 5 : 2, 20 - cur);
      R[rl.risk] = Math.min(100, R[rl.risk] + add);
      rlAdj[rl.risk] = cur + add;
    }
  }
  const ixAdj = {};
  for (const ix of interactions) {
    for (const rk of ix.risks) {
      const cur = ixAdj[rk] || 0;
      if (cur < 15) {
        const add = Math.min(10, 15 - cur);
        R[rk] = Math.min(100, R[rk] + add);
        ixAdj[rk] = cur + add;
      }
    }
  }
  return R;
}

function runStressTests(ans, persona) {
  const bias = PERSONA_SCENARIO_BIAS[persona] || {};
  return Object.entries(STRESS_SCENARIOS).map(([scenario, cfg]) => {
    const vals = cfg.qids.map(qid => ans[qid] ?? 4);
    const minVal = Math.min(...vals);
    const meanVal = vals.reduce((a,b)=>a+b,0) / vals.length;
    const minQid = cfg.qids.find(qid => (ans[qid] ?? 4) === minVal);
    const vuln = Math.min(100, (1 - meanVal/4) * 100 * (bias[scenario] || 1.0));
    return { scenario, vulnerability: r1(vuln), breakpoint: QID_LABELS[minQid] || minQid, minValue: minVal, icon: cfg.icon, color: cfg.color };
  }).sort((a,b) => b.vulnerability - a.vulnerability);
}

function calcSixCapitals(ans) {
  return {
    金融资本: r2((ans.A01 + ans.A02 + ans.A03) / 3),
    人才资本: r2((ans.T01 + ans.S02 + ans.S03) / 3),
    智识资本: r2((ans.T02 + ans.T03 + ans.X02) / 3),
    社会资本: r2((ans.RISK01 + ans.RISK02 + ans.X01) / 3),
    文化资本: r2((ans.RISK01 + ans.G01 + ans.S01) / 3),
    治理资本: r2((ans.G01 + ans.G02 + ans.G03) / 3),
  };
}

function recommendServices(redlines, interactions, R, stress) {
  const scores = {};
  const rlCnt = {};
  redlines.forEach(rl => rl.services.forEach(svc => {
    rlCnt[svc] = (rlCnt[svc]||0)+1;
    if (rlCnt[svc] <= 3) scores[svc] = (scores[svc]||0) + 8;
  }));
  Object.entries(R).sort((a,b)=>b[1]-a[1]).slice(0,3).forEach(([rk],rank) => {
    const pts = [12,10,8][rank];
    (RISK_SERVICE_MAP[rk]||[]).forEach(svc => { scores[svc] = (scores[svc]||0) + pts; });
  });
  stress.slice(0,2).forEach((st,rank) => {
    const pts = rank===0 ? 25 : 12;
    (STRESS_SERVICE_MAP[st.scenario]||[]).forEach(svc => { scores[svc] = (scores[svc]||0) + pts; });
  });
  return Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([svc,score],i) => ({
    rank:i+1, code:svc, label:SERVICE_LABELS[svc]||svc, desc:SERVICE_DESCRIPTIONS[svc] || "",
    score, priority: i<3?"immediate": i<6?"medium":"long",
  }));
}

// ═══════════════════ Main Pipeline ═══════════════════
function runFullDiagnostic(answers, routingAnswers) {
  const persona = diagnosePersona(routingAnswers || {});
  const stageData = diagnoseStage(routingAnswers || {});
  const stage = stageData.stage;

  const M = calcIntermediateVars(answers);
  let R = calcRiskScores(M, stage);
  const redlines = checkRedlines(answers);
  const interactions = checkInteractions(answers);
  R = applyAdjustments(R, redlines, interactions);
  const stress = runStressTests(answers, persona);
  const capitals = calcSixCapitals(answers);
  const services = recommendServices(redlines, interactions, R, stress);

  const hasBehavior = ["F01","F02","F03","F04","F05","F06"].every(k => answers[k] !== undefined);
  const behavioral = hasBehavior ? calcBehavioralScores(answers) : null;

  const sortedRisks = Object.entries(R).sort((a,b) => b[1]-a[1]);
  const topRisk = sortedRisks[0][1];
  const riskLevel = topRisk >= 75 ? "高危" : topRisk >= 50 ? "中高" : topRisk >= 30 ? "中等" : "良好";

  return {
    meta: {
      persona,
      stage,
      personaLabel: PERSONA_OPTIONS.find(p=>p.value===persona)?.label || persona,
      stageLabel: stage,
    },
    overallRiskLevel: riskLevel,
    overallScore: r1(100 - topRisk),
    intermediateVars: Object.entries(M).map(([k,v]) => ({ code:k, label:M_LABELS[k]||k, value:v, max:4.0 })),
    riskScores: sortedRisks.map(([rk,sc],i) => ({ rank:i+1, code:rk, label:RISK_LABELS[rk], score:r1(sc) })),
    redlines,
    interactions,
    stressTests: stress,
    sixCapitals: capitals,
    services,
    behavioral,
    answers,
  };
}

// helpers: 对齐 Python round()（四舍六入五成双）
function pyRound(value, digits=0) {
  const factor = 10 ** digits;
  const scaled = value * factor;
  const sign = scaled < 0 ? -1 : 1;
  const absScaled = Math.abs(scaled);
  const lower = Math.floor(absScaled);
  const diff = absScaled - lower;
  const eps = 1e-12;
  let roundedInt;
  if (diff > 0.5 + eps) {
    roundedInt = lower + 1;
  } else if (diff < 0.5 - eps) {
    roundedInt = lower;
  } else {
    roundedInt = (lower % 2 === 0) ? lower : (lower + 1);
  }
  return sign * (roundedInt / factor);
}

const r3 = v => pyRound(v, 3);
const r2 = v => pyRound(v, 2);
const r1 = v => pyRound(v, 1);
