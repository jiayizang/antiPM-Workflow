/**
 * 收费版前端交互层。
 * 输入：免费版快照、收费版24题答案。
 * 输出：网页报告展示，并在调试态尝试写入 paidReports。
 */

const paidState = {
  auth: null,
  db: null,
  authUser: null,
  freeSnapshot: null,
  paidAnswers: {},
  paidResult: null,
};

const paidEls = {
  submissionId: document.getElementById("submission-id"),
  adminEmail: document.getElementById("admin-email"),
  adminPassword: document.getElementById("admin-password"),
  loaderState: document.getElementById("loader-state"),
  debugJson: document.getElementById("debug-json"),
  btnLoginAdmin: document.getElementById("btn-login-admin"),
  btnLoadFirestore: document.getElementById("btn-load-firestore"),
  btnLogoutAdmin: document.getElementById("btn-logout-admin"),
  btnLoadJson: document.getElementById("btn-load-json"),
  btnLoadSample: document.getElementById("btn-load-sample"),
  sumPersona: document.getElementById("sum-persona"),
  sumStage: document.getElementById("sum-stage"),
  sumRating: document.getElementById("sum-rating"),
  sumOverallScore: document.getElementById("sum-overall-score"),
  sumMaxRisk: document.getElementById("sum-max-risk"),
  snapshotState: document.getElementById("snapshot-state"),
  questionnaire: document.getElementById("paid-questionnaire"),
  modulesContainer: document.getElementById("paid-modules-container"),
  progressText: document.getElementById("paid-progress-text"),
  btnGenerate: document.getElementById("btn-generate"),
  report: document.getElementById("paid-report"),
  reportState: document.getElementById("report-state"),
  btnPrint: document.getElementById("btn-print"),
  btnSaveReport: document.getElementById("btn-save-report"),
  btnCopyJson: document.getElementById("btn-copy-json"),
  sections: {
    overview: document.getElementById("section-overview"),
    free: document.getElementById("section-free"),
    tooling: document.getElementById("section-tooling"),
    indices: document.getElementById("section-indices"),
    toolRisks: document.getElementById("section-tool-risks"),
    eventRisks: document.getElementById("section-event-risks"),
    blindspots: document.getElementById("section-blindspots"),
    cases: document.getElementById("section-cases"),
    services: document.getElementById("section-services"),
    actions: document.getElementById("section-actions"),
  },
};

function setLoaderState(text, status = "") {
  paidEls.loaderState.textContent = text;
  paidEls.loaderState.className = `paid-state${status ? ` ${status}` : ""}`;
}

function setSnapshotState(text) {
  paidEls.snapshotState.textContent = text;
}

function setReportState(text, status = "") {
  paidEls.reportState.textContent = text;
  paidEls.reportState.className = `paid-state${status ? ` ${status}` : ""}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function q(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function parseMaybeBase64Json(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_directError) {
    const decoded = atob(raw);
    return JSON.parse(decoded);
  }
}

function buildRiskScoreMap(result) {
  const map = {};
  (result.riskScores || []).forEach((row) => {
    map[row.code] = row.score;
  });
  return map;
}

function normalizeFreeSnapshot(rawDoc, docId = "") {
  const result = rawDoc.result || rawDoc;
  const riskScores = buildRiskScoreMap(result);
  const overallScore = typeof result.overallScore === "number" ? result.overallScore : 0;
  const scoreArray = Object.values(riskScores);
  return {
    submissionId: rawDoc.submissionId || docId || rawDoc.id || "",
    email: rawDoc.email || rawDoc.lead?.email || "",
    persona: result.meta?.persona || rawDoc.persona || "",
    personaLabel: result.meta?.personaLabel || result.meta?.persona || rawDoc.persona || "",
    lifecycleStage: result.meta?.stage || rawDoc.stage || "",
    stageLabel: result.meta?.stageLabel || result.meta?.stage || rawDoc.stage || "",
    overallRating: result.overallRiskLevel || rawDoc.overallRiskLevel || "",
    overallScore,
    maxRiskScore: scoreArray.length ? Math.max(...scoreArray) : 0,
    riskScores,
    capitalScores: result.sixCapitals || {},
    redFlags: result.redlines || [],
    stressTests: result.stressTests || [],
    recommendedServices: result.services || [],
    freeAnswers: result.answers || rawDoc.answers || {},
    rawSubmission: rawDoc,
  };
}

function firebaseBoot() {
  if (!window.firebase?.apps?.length) {
    window.firebase.initializeApp(window.__FIREBASE_CONFIG__);
  }
  paidState.auth = window.firebase.auth();
  paidState.db = window.firebase.firestore();
  paidState.auth.onAuthStateChanged((user) => {
    paidState.authUser = user || null;
    if (user && user.isAnonymous) {
      setLoaderState("当前处于匿名会话；管理员读取 Firestore 前需要先用邮箱密码登录。", "ok");
      return;
    }
    if (user?.email) {
      setLoaderState(`当前管理员：${user.email}`, "ok");
    }
  });
}

async function adminLogin() {
  const email = paidEls.adminEmail.value.trim();
  const password = paidEls.adminPassword.value;
  if (!email || !password) {
    setLoaderState("请输入管理员邮箱和密码。", "error");
    return;
  }
  await paidState.auth.signOut();
  await paidState.auth.signInWithEmailAndPassword(email, password);
  setLoaderState(`管理员已登录：${email}`, "ok");
}

async function adminLogout() {
  await paidState.auth.signOut();
  setLoaderState("已退出管理员登录。");
}

async function loadFromFirestore() {
  const submissionId = paidEls.submissionId.value.trim();
  if (!submissionId) {
    setLoaderState("请先输入 Submission ID。", "error");
    return;
  }
  if (!paidState.authUser || paidState.authUser.isAnonymous) {
    setLoaderState("读取 Firestore 前，请先使用管理员邮箱密码登录。", "error");
    return;
  }

  const snap = await paidState.db.collection("submissions").doc(submissionId).get();
  if (!snap.exists) {
    setLoaderState(`未找到 submissionId=${submissionId} 的免费版记录。`, "error");
    return;
  }
  const normalized = normalizeFreeSnapshot(snap.data(), snap.id);
  applyFreeSnapshot(normalized, "已从 Firestore 读取免费版结果。");
}

function loadFromJson() {
  const raw = paidEls.debugJson.value.trim();
  if (!raw) {
    setLoaderState("请先粘贴 JSON。", "error");
    return;
  }
  const parsed = JSON.parse(raw);
  const normalized = normalizeFreeSnapshot(parsed, parsed.submissionId || parsed.id || "");
  applyFreeSnapshot(normalized, "已从粘贴 JSON 载入免费版结果。");
}

function loadSample() {
  const sample = {
    submissionId: "sample-paid-demo",
    email: "sample@example.com",
    result: {
      meta: {
        persona: "复杂跨境家族",
        personaLabel: "复杂跨境家族",
        stage: "制度化治理期",
        stageLabel: "制度化治理期",
      },
      overallRiskLevel: "高危",
      overallScore: 31.4,
      riskScores: [
        { code: "R1", score: 78 },
        { code: "R2", score: 42 },
        { code: "R3", score: 66 },
        { code: "R4", score: 71 },
        { code: "R5", score: 74 },
        { code: "R6", score: 48 },
        { code: "R7", score: 69 },
      ],
      redlines: ["核心决策人失能时没有明确接管授权", "跨境资产未完成税务居民与申报核查"],
      stressTests: ["离世后的理赔与股权接续是否断裂", "税务审查下海外账户与法域链路是否可执行"],
      services: [{ code: "2.3.7", label: "意愿安排与文件统筹" }],
      answers: {},
    },
  };
  applyFreeSnapshot(normalizeFreeSnapshot(sample, sample.submissionId), "已载入演示样例。");
}

function applyFreeSnapshot(snapshot, message) {
  paidState.freeSnapshot = snapshot;
  paidState.paidAnswers = {};
  paidState.paidResult = null;
  sessionStorage.setItem("paid:lastFreeSnapshot", JSON.stringify(snapshot));
  renderFreeSnapshot();
  renderQuestionnaire();
  paidEls.report.classList.remove("active");
  setLoaderState(message, "ok");
}

function renderFreeSnapshot() {
  const snap = paidState.freeSnapshot;
  paidEls.sumPersona.textContent = snap.personaLabel || snap.persona || "未命名";
  paidEls.sumStage.textContent = snap.stageLabel || snap.lifecycleStage || "未命名";
  paidEls.sumRating.textContent = snap.overallRating || "未命名";
  paidEls.sumOverallScore.textContent = typeof snap.overallScore === "number" ? snap.overallScore.toFixed(1) : "-";
  paidEls.sumMaxRisk.textContent = typeof snap.maxRiskScore === "number" ? snap.maxRiskScore.toFixed(1) : "-";
  setSnapshotState(`已载入 ${snap.submissionId || "未命名提交"} 的免费版快照`);
}

function renderQuestionCard(question) {
  const selected = paidState.paidAnswers[question.id];
  const directionText = question.direction === "complexity" ? "复杂度题" : "成熟度题";
  const optionsHtml = question.options
    .map((option, index) => {
      const activeClass = selected === index ? " selected" : "";
      return `
        <button class="paid-opt${activeClass}" type="button" data-qid="${question.id}" data-score="${index}">
          <span class="paid-opt-score">${index}</span>
          <span class="paid-opt-text">${escapeHtml(option)}</span>
        </button>
      `;
    })
    .join("");

  return `
    <article class="paid-q-card">
      <div class="paid-q-meta">
        <span class="paid-q-code">${escapeHtml(question.label)}</span>
        <span class="paid-q-direction">${escapeHtml(directionText)}</span>
      </div>
      <h4 class="paid-q-title">${escapeHtml(question.module)}</h4>
      <p class="paid-q-text">${escapeHtml(question.question)}</p>
      <div class="paid-options">${optionsHtml}</div>
    </article>
  `;
}

function renderQuestionnaire() {
  paidEls.questionnaire.classList.remove("paid-hidden");
  paidEls.modulesContainer.innerHTML = PAID_MODULES.map((module) => {
    const questions = PAID_QUESTIONS.filter((item) => item.module === module.label);
    return `
      <section class="paid-module">
        <div class="paid-module-head">
          <h3 class="paid-module-title">${escapeHtml(module.label)}</h3>
          <p class="paid-module-desc">${escapeHtml(module.desc)}</p>
        </div>
        <div class="paid-question-list">
          ${questions.map(renderQuestionCard).join("")}
        </div>
      </section>
    `;
  }).join("");

  wireQuestionEvents();
  updateProgress();
}

function wireQuestionEvents() {
  paidEls.modulesContainer.querySelectorAll(".paid-opt").forEach((button) => {
    button.addEventListener("click", () => {
      const qid = button.dataset.qid;
      const score = Number(button.dataset.score);
      paidState.paidAnswers[qid] = score;
      renderQuestionnaire();
    });
  });
}

function updateProgress() {
  const done = Object.keys(paidState.paidAnswers).length;
  paidEls.progressText.textContent = `已完成 ${done} / ${PAID_QUESTIONS.length} 题`;
}

function allAnswered() {
  return PAID_QUESTIONS.every((question) => typeof paidState.paidAnswers[question.id] === "number");
}

function riskColor(score) {
  if (score >= 75) return "#ff7878";
  if (score >= 55) return "#ffa94d";
  if (score >= 35) return "#ffd666";
  return "#93d9ae";
}

function renderBarRows(items) {
  return `
    <div class="paid-bars">
      ${items.map((item) => `
        <div class="paid-bar-row">
          <div class="paid-bar-label">${escapeHtml(item.label)}</div>
          <div class="paid-bar-track">
            <div class="paid-bar-fill" style="width:${item.value}%; background:${item.color || "linear-gradient(135deg,#e0ba54,#c79d31)"}"></div>
          </div>
          <div class="paid-bar-value">${item.value.toFixed(1)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderReport() {
  const result = paidState.paidResult;
  const snap = paidState.freeSnapshot;
  paidEls.report.classList.add("active");

  paidEls.sections.overview.innerHTML = `
    <h2 class="paid-section-title">1. 财富安排可执行性总览</h2>
    <div class="paid-score-hero">
      <div class="paid-score-box">
        <div class="paid-score-num">${result.overallExecutabilityScore.toFixed(1)}</div>
        <div class="paid-score-level ${escapeHtml(result.overallRating.color)}">${escapeHtml(result.overallRating.level)}</div>
      </div>
      <div class="paid-score-copy">
        <p>当前收费版判断重点不再是“风险高不高”，而是：已有或缺失的保险、遗嘱、股权、海外资产、税务安排、顾问体系与应急流程，是否能在关键事件下真正执行。</p>
        <p>综合来看，你当前的“财富安排可执行性”评级为 <strong>${escapeHtml(result.overallRating.level)}</strong>，复杂度指数为 <strong>${result.complexityIndex.toFixed(1)}</strong>。复杂度越高，越需要更系统的工具与文件协同。</p>
      </div>
    </div>
  `;

  paidEls.sections.free.innerHTML = `
    <h2 class="paid-section-title">2. 免费版风险结果摘要</h2>
    <div class="paid-pill-list">
      <div class="paid-pill">家族画像：${escapeHtml(snap.personaLabel || snap.persona || "-")}</div>
      <div class="paid-pill">发展阶段：${escapeHtml(snap.stageLabel || snap.lifecycleStage || "-")}</div>
      <div class="paid-pill">免费版评级：${escapeHtml(snap.overallRating || "-")} / 综合分 ${snap.overallScore.toFixed(1)}</div>
      <div class="paid-pill">最高单项风险：${snap.maxRiskScore.toFixed(1)}</div>
    </div>
  `;

  paidEls.sections.tooling.innerHTML = `
    <h2 class="paid-section-title">3. 工具与安排盘点</h2>
    <div class="paid-two-col">
      <div class="paid-mini-list">
        <div class="paid-mini-item">工具是否完整：保险、遗嘱、信托、股权、海外资产、顾问和应急文件是否存在缺口。</div>
        <div class="paid-mini-item">安排是否适配：已有工具是否匹配家庭结构、资产类型、税务身份、控制权和传承目标。</div>
      </div>
      <div class="paid-mini-list">
        <div class="paid-mini-item">关键事件是否能执行：离世、失能、婚姻变化、税务审查、股权交接时，哪些安排可能先出现断点。</div>
        <div class="paid-mini-item">以下五个指数和两组风险图，是收费版第一版的核心解释框架。</div>
      </div>
    </div>
  `;

  paidEls.sections.indices.innerHTML = `
    <h2 class="paid-section-title">4. 五大可执行性指数</h2>
    ${renderBarRows([
      { label: "工具覆盖度", value: result.indices.toolCoverage },
      { label: "工具适配度", value: result.indices.toolFit },
      { label: "执行清晰度", value: result.indices.executionClarity },
      { label: "成本有效性", value: result.indices.costEffectiveness },
      { label: "失效敏感度（反向）", value: 100 - result.indices.failureSensitivity },
    ])}
  `;

  paidEls.sections.toolRisks.innerHTML = `
    <h2 class="paid-section-title">5. 工具失效风险雷达替代图</h2>
    ${renderBarRows([
      { label: "保险失效风险", value: result.toolFailureRisks.insurance, color: riskColor(result.toolFailureRisks.insurance) },
      { label: "法律文件失效风险", value: result.toolFailureRisks.legalDocs, color: riskColor(result.toolFailureRisks.legalDocs) },
      { label: "控制权失效风险", value: result.toolFailureRisks.control, color: riskColor(result.toolFailureRisks.control) },
      { label: "跨境税务失效风险", value: result.toolFailureRisks.crossBorder, color: riskColor(result.toolFailureRisks.crossBorder) },
      { label: "顾问体系失效风险", value: result.toolFailureRisks.advisor, color: riskColor(result.toolFailureRisks.advisor) },
    ])}
  `;

  paidEls.sections.eventRisks.innerHTML = `
    <h2 class="paid-section-title">6. 六大关键事件推演</h2>
    ${renderBarRows([
      { label: "核心成员离世", value: result.eventRisks.death, color: riskColor(result.eventRisks.death) },
      { label: "核心成员失能", value: result.eventRisks.incapacity, color: riskColor(result.eventRisks.incapacity) },
      { label: "婚姻变化", value: result.eventRisks.marriage, color: riskColor(result.eventRisks.marriage) },
      { label: "税务审查 / 跨境申报", value: result.eventRisks.taxReview, color: riskColor(result.eventRisks.taxReview) },
      { label: "股权交接 / 控制权变化", value: result.eventRisks.controlTransfer, color: riskColor(result.eventRisks.controlTransfer) },
      { label: "市场下跌 / 现金流骤降", value: result.eventRisks.liquidityShock, color: riskColor(result.eventRisks.liquidityShock) },
    ])}
  `;

  paidEls.sections.blindspots.innerHTML = `
    <h2 class="paid-section-title">7. 专业盲区提醒</h2>
    <div class="paid-block-list">
      ${result.reportBlocks.map((block) => `
        <article class="paid-block">
          <h3 class="paid-block-title">${escapeHtml(block.title)}</h3>
          <p class="paid-block-summary">${escapeHtml(block.summary)}</p>
          <p class="paid-block-body">${escapeHtml(block.body)}</p>
          <div class="paid-mini-list">
            ${block.actions.map((action) => `<div class="paid-mini-item">${escapeHtml(action)}</div>`).join("")}
          </div>
        </article>
      `).join("")}
    </div>
  `;

  paidEls.sections.cases.innerHTML = `
    <h2 class="paid-section-title">8. 相似失效路径案例</h2>
    <div class="paid-case-list">
      ${result.caseSignals.map((line) => `<div class="paid-case">${escapeHtml(line)}</div>`).join("")}
    </div>
  `;

  paidEls.sections.services.innerHTML = `
    <h2 class="paid-section-title">9. 建议进入一对一核查的专业方向</h2>
    <div class="paid-service-list">
      ${result.serviceRecommendations.map((service) => `
        <article class="paid-service">
          <h3 class="paid-service-title">${escapeHtml(service.serviceCode)} · ${escapeHtml(service.label)}</h3>
          <p class="paid-service-desc">${escapeHtml(service.desc)}</p>
          <div class="paid-pill">建议优先级分：${service.score}</div>
        </article>
      `).join("")}
    </div>
  `;

  paidEls.sections.actions.innerHTML = `
    <h2 class="paid-section-title">10. 90 天资料准备与行动清单</h2>
    <div class="paid-action-list">
      ${result.ninetyDayActions.map((action) => `<div class="paid-action">${escapeHtml(action)}</div>`).join("")}
    </div>
  `;
}

async function persistPaidReport() {
  if (!paidState.paidResult) {
    setReportState("请先生成收费版报告。", "error");
    return;
  }
  try {
    if (!paidState.authUser) {
      await paidState.auth.signInAnonymously();
    }
    await paidState.db.collection("paidReports").add({
      submissionId: paidState.freeSnapshot.submissionId,
      freeSnapshot: paidState.freeSnapshot,
      paidAnswers: paidState.paidAnswers,
      paidScores: {
        complexityIndex: paidState.paidResult.complexityIndex,
        indices: paidState.paidResult.indices,
        overallExecutabilityScore: paidState.paidResult.overallExecutabilityScore,
        overallRating: paidState.paidResult.overallRating,
        eventRisks: paidState.paidResult.eventRisks,
        toolFailureRisks: paidState.paidResult.toolFailureRisks,
      },
      reportBlocks: paidState.paidResult.reportBlocks,
      serviceRecommendations: paidState.paidResult.serviceRecommendations,
      generatedAt: paidState.paidResult.generatedAt,
      status: "debug-generated",
      createdAtISO: new Date().toISOString(),
    });
    setReportState("已写入 paidReports（当前为调试态写入）。", "ok");
  } catch (error) {
    setReportState(`写入 paidReports 失败：${error.message}。通常是 rules 尚未放开。`, "error");
  }
}

function copyReportJson() {
  if (!paidState.paidResult) {
    setReportState("请先生成报告。", "error");
    return;
  }
  navigator.clipboard.writeText(JSON.stringify(paidState.paidResult, null, 2));
  setReportState("已复制收费版结果 JSON。", "ok");
}

function generateReport() {
  if (!paidState.freeSnapshot) {
    setReportState("请先载入免费版结果。", "error");
    return;
  }
  if (!allAnswered()) {
    setReportState("24 道收费版问题还没有全部完成。", "error");
    return;
  }
  paidState.paidResult = generatePaidDiagnosis(paidState.freeSnapshot, paidState.paidAnswers);
  renderReport();
  sessionStorage.setItem("paid:lastPaidResult", JSON.stringify(paidState.paidResult));
  setReportState("收费版报告已生成。", "ok");
}

function bootFromQueryOrCache() {
  const submissionId = q("submissionId");
  if (submissionId) {
    paidEls.submissionId.value = submissionId;
  }

  const snapshotRaw = q("snapshot");
  if (snapshotRaw) {
    const snapshot = parseMaybeBase64Json(snapshotRaw);
    applyFreeSnapshot(normalizeFreeSnapshot(snapshot, snapshot.submissionId || ""), "已从链接参数载入免费版快照。");
    return;
  }

  const cached = sessionStorage.getItem("paid:lastFreeSnapshot");
  if (cached) {
    const snapshot = JSON.parse(cached);
    applyFreeSnapshot(snapshot, "已恢复上次免费版快照。");
  }
}

function wirePaidEvents() {
  paidEls.btnLoginAdmin.addEventListener("click", () => adminLogin().catch((error) => {
    setLoaderState(`管理员登录失败：${error.message}`, "error");
  }));
  paidEls.btnLoadFirestore.addEventListener("click", () => loadFromFirestore().catch((error) => {
    setLoaderState(`读取 Firestore 失败：${error.message}`, "error");
  }));
  paidEls.btnLogoutAdmin.addEventListener("click", () => adminLogout().catch((error) => {
    setLoaderState(`退出登录失败：${error.message}`, "error");
  }));
  paidEls.btnLoadJson.addEventListener("click", () => {
    try {
      loadFromJson();
    } catch (error) {
      setLoaderState(`JSON 解析失败：${error.message}`, "error");
    }
  });
  paidEls.btnLoadSample.addEventListener("click", loadSample);
  paidEls.btnGenerate.addEventListener("click", generateReport);
  paidEls.btnPrint.addEventListener("click", () => window.print());
  paidEls.btnSaveReport.addEventListener("click", () => persistPaidReport());
  paidEls.btnCopyJson.addEventListener("click", copyReportJson);
}

function bootPaid() {
  firebaseBoot();
  wirePaidEvents();
  bootFromQueryOrCache();
}

bootPaid();
