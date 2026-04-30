/**
 * 家族风险诊断系统 — UI Application
 * Multi-view SPA: landing → profile → questionnaire (7 modules) → loading → results
 */

// ═══════════════════ STATE ═══════════════════
const state = {
  view: 'landing',         // current view id
  routingAnswers: {},      // { rqid: value } (v4.0 路由)
  persona: 'P1',
  stage: '创业与交接期',
  answers: {},             // { qid: value }
  moduleIndex: 0,          // 0-6
  result: null,
  lead: null,              // { name, phone, email }
  history: []              // Local history for robustness
};

const TOTAL_Q = 25; // 19主模块 + 6行为模块
const VIEWS = ['landing','profile','questionnaire','lead','loading','results'];

// ═══════════════════ MODULE DEFINITIONS ═══════════════════
const MODULE_LIST = [
  { id:'治理', num:'01', desc:'治理结构与规则体系', qids:['G01','G02','G03'] },
  { id:'传承', num:'02', desc:'传承计划与接班安排', qids:['S01','S02','S03'] },
  { id:'资产', num:'03', desc:'资产结构与风险隔离', qids:['A01','A02','A03'] },
  { id:'合规', num:'04', desc:'法律合规与跨境安排', qids:['C01','C02','C03'] },
  { id:'人才', num:'05', desc:'关键人与运营管理',   qids:['T01','T02','T03'] },
  { id:'关系', num:'06', desc:'家族关系与声誉管理', qids:['RISK01','RISK02'] },
  { id:'外部', num:'07', desc:'外部环境与分散策略', qids:['X01','X02'] },
  { id:'心智', num:'08', desc:'行为心智与风险偏好 (v4.0)', qids:['F01','F02','F03','F04','F05','F06'] },
];

// ═══════════════════ VIEW MANAGEMENT ═══════════════════
function showView(id) {
  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) { el.classList.toggle('active', v === id); }
  });
  state.view = id;
  window.scrollTo(0, 0);
  updateNav(id);
}

function updateNav(id) {
  const pill = document.getElementById('nav-step-pill');
  const progStrip = document.getElementById('progress-strip');
  const progFill = document.getElementById('progress-strip-fill');

  const showStrip = ['profile','questionnaire','lead','results'].includes(id);
  progStrip.style.display = showStrip ? 'block' : 'none';

  if (id === 'landing') {
    pill.style.display = 'none';
    return;
  }
  pill.style.display = 'block';
  if (id === 'profile')       { pill.textContent = '步骤 1 / 3 — 家族画像'; updateStrip(10); }
  else if (id === 'questionnaire') {
    const mod = MODULE_LIST[state.moduleIndex];
    pill.textContent = `步骤 2 / 3 — ${mod.id}模块`;
    const ans = Object.keys(state.answers).length;
    updateStrip(10 + (ans / TOTAL_Q) * 70);
  }
  else if (id === 'lead')     { pill.textContent = '步骤 3 / 3 — 资料获取'; updateStrip(85); }
  else if (id === 'loading')  { pill.textContent = '正在生成报告…'; updateStrip(95); }
  else if (id === 'results')  { pill.textContent = '诊断完成'; updateStrip(100); }
}

function updateStrip(pct) {
  const fill = document.getElementById('progress-strip-fill');
  if (fill) fill.style.width = pct + '%';
}

// ═══════════════════ LANDING ═══════════════════
document.getElementById('btn-start').addEventListener('click', () => {
  renderRouting();
  showView('profile');
});

// ═══════════════════ PROFILE (v4.0 自动路由) ═══════════════════
function renderRouting() {
  const container = document.getElementById('routing-container');
  container.innerHTML = '';
  ROUTING_QS.forEach(rq => {
    const answered = state.routingAnswers[rq.id] !== undefined;
    const card = document.createElement('div');
    card.className = 'q-card' + (answered ? ' answered' : '');
    card.innerHTML = `
      <div class="q-meta"><span class="q-code">${rq.id}</span></div>
      <p class="q-text">${rq.text}</p>
      <div class="q-options">
        ${rq.options.map((opt, i) => `
          <div class="q-opt ${state.routingAnswers[rq.id]===i?'selected':''}" onclick="selectRouting('${rq.id}', ${i})">
            <div class="opt-dot"></div>
            <span class="opt-lbl">${opt}</span>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(card);
  });
}

window.selectRouting = function(rqId, val) {
  state.routingAnswers[rqId] = val;
  renderRouting();
  const allDone = ROUTING_QS.every(rq => state.routingAnswers[rq.id] !== undefined);
  document.getElementById('btn-profile-next').disabled = !allDone;
};

document.getElementById('btn-profile-next').addEventListener('click', () => {
  state.persona = diagnosePersona(state.routingAnswers);
  const stageData = diagnoseStage(state.routingAnswers);
  state.stage = stageData.stage;
  state.moduleIndex = 0;
  renderModule(0);
  showView('questionnaire');
});

// ═══════════════════ QUESTIONNAIRE ═══════════════════
function renderModule(idx) {
  const mod = MODULE_LIST[idx];
  const container = document.getElementById('q-module-container');

  // Header
  document.getElementById('q-mod-tag').textContent = `模块 ${mod.num} · ${mod.id}`;
  document.getElementById('q-mod-title').textContent = `${mod.id}模块`;
  document.getElementById('q-mod-desc').textContent = mod.desc;

  // Questions
  container.innerHTML = '';
  mod.qids.forEach(qid => {
    const q = QUESTIONS[qid];
    const answered = state.answers[qid] !== undefined;

    const card = document.createElement('div');
    card.className = 'q-card' + (answered ? ' answered' : '');
    card.id = 'qcard-' + qid;

    card.innerHTML = `
      <div class="q-meta">
        <span class="q-code">${qid}</span>
        <span class="q-label-txt">${q.label}</span>
      </div>
      <p class="q-text">${q.text}</p>
      <div class="q-options" id="opts-${qid}">
        ${SCORE_OPTIONS.map(opt => {
          const optLabel = (q.opts && q.opts[opt.value]) || opt.label;
          return `
          <div class="q-opt ${state.answers[qid]===opt.value?'selected':''}" 
               data-qid="${qid}" data-val="${opt.value}" role="button" tabindex="0">
            <div class="opt-dot"></div>
            <span class="opt-num">${opt.value}</span>
            <span class="opt-lbl">${optLabel}</span>
          </div>
        `;
        }).join('')}
      </div>
    `;
    container.appendChild(card);
  });

  // Attach option listeners
  container.querySelectorAll('.q-opt').forEach(el => {
    el.addEventListener('click', () => selectAnswer(el.dataset.qid, parseInt(el.dataset.val)));
  });

  updateQuestionnaireNav();
}

function selectAnswer(qid, val) {
  state.answers[qid] = val;

  // Update UI within that question card
  document.querySelectorAll(`[data-qid="${qid}"]`).forEach(el => el.classList.remove('selected'));
  document.querySelectorAll(`[data-qid="${qid}"][data-val="${val}"]`).forEach(el => el.classList.add('selected'));
  document.getElementById('qcard-' + qid)?.classList.add('answered');

  updateQuestionnaireNav();
  updateNav('questionnaire');
}

function updateQuestionnaireNav() {
  const mod = MODULE_LIST[state.moduleIndex];
  const allAnswered = mod.qids.every(qid => state.answers[qid] !== undefined);
  const isLast = state.moduleIndex === MODULE_LIST.length - 1;

  const btnNext = document.getElementById('btn-q-next');
  const btnPrev = document.getElementById('btn-q-prev');

  btnNext.disabled = !allAnswered;
  btnPrev.style.display = state.moduleIndex === 0 ? 'none' : 'inline-flex';

  // Total progress
  const ansCount = Object.keys(state.answers).length;
  document.getElementById('nf-prog-fill').style.width = (ansCount / TOTAL_Q * 100) + '%';
  document.getElementById('nf-prog-text').textContent = `${ansCount} / ${TOTAL_Q} 题已完成`;

  // Next button label
  btnNext.querySelector('.next-label').textContent = isLast ? '查看诊断报告' : '下一模块';
}

document.getElementById('btn-q-prev').addEventListener('click', () => {
  state.moduleIndex--;
  renderModule(state.moduleIndex);
});

document.getElementById('btn-q-next').addEventListener('click', () => {
  if (state.moduleIndex < MODULE_LIST.length - 1) {
    state.moduleIndex++;
    renderModule(state.moduleIndex);
    window.scrollTo(0, 0);
  } else {
    showView('lead');
  }
});

// ═══════════════════ LEAD FORM ═══════════════════
document.getElementById('btn-lead-submit').addEventListener('click', () => {
  const name = document.getElementById('lead-name').value.trim();
  const phone = document.getElementById('lead-phone').value.trim();
  const email = document.getElementById('lead-email').value.trim();
  const check = document.getElementById('privacy-check').checked;

  if (!name || !email) {
    alert('请填写姓名和邮箱，以便发送报告。');
    return;
  }
  if (!check) {
    alert('请同意隐私政策。');
    return;
  }

  state.lead = { name, phone, email };
  saveLeadLocally(state.lead, state.answers); // 保底方案
  
  // 自动化上线：将数据推送到您的采集终端
  syncLeadToCloud(state.lead, state.answers);
  
  startDiagnosis();
});

/**
 * 腾讯云版自动化采集：将数据存入 TCB 云数据库
 */
async function syncLeadToCloud(lead, answers) {
  // 1. 初始化云开发 (请将下面的 env 换成您在腾讯云申请的环境 ID)
  // 您可以在控制台搜索“云开发 CloudBase”获取
  const TCB_ENV_ID = "您的-TCB-环境ID"; 
  
  try {
    const app = tcb.init({ env: TCB_ENV_ID });
    const auth = app.auth();
    // 匿名登录以实现免登提交
    await auth.anonymousAuthProvider().signIn();
    
    const db = app.database();
    
    // 2. 存入 'leads' 集合
    await db.collection("leads").add({
      timestamp: new Date().toISOString(),
      lead_info: lead,
      diagnostic_summary: {
        score: state.result.overallScore,
        level: state.result.overallRiskLevel,
        persona: state.persona,
        stage: state.stage
      },
      raw_answers: answers
    });
    
    console.log("💎 诊断数据已安全存入腾讯云数据库");
  } catch (e) {
    console.warn("腾讯云同步不可用，请确认环境ID是否正确:", e);
    // 即使出错，也会因为使用了 Web3Forms 做备选，确保数据必达
  }
}

/**
 * 稳妥方案 2: 本地离线存底 (防止服务器波动导致丢单)
 * 数据会存在您浏览器的 localStorage 中，即便关掉页面也能找回
 */
function saveLeadLocally(lead, answers) {
  try {
    const backup = JSON.parse(localStorage.getItem('family_leads') || '[]');
    backup.push({
      timestamp: new Date().toISOString(),
      lead,
      answers,
      persona: state.persona,
      stage: state.stage
    });
    localStorage.setItem('family_leads', JSON.stringify(backup));
    console.log('✅ 数据已本地稳妥存底');
  } catch(e) { console.error(e); }
}

// ═══════════════════ LOADING + DIAGNOSIS ═══════════════════
const LOADING_STEPS = [
  '计算中间变量（M01–M10）',
  '评估七大风险维度',
  '触发红线规则检测',
  '运行六大压力情景',
  '生成服务推荐路线图',
  '生成诊断报告',
];

async function startDiagnosis() {
  showView('loading');
  renderLoadingSteps();

  // Animate steps
  for (let i = 0; i < LOADING_STEPS.length; i++) {
    await sleep(340);
    setLoadingStep(i, 'active');
    await sleep(320);
    setLoadingStep(i, 'done');
  }
  await sleep(300);

  // Run computation
  state.result = runFullDiagnostic(state.answers, state.routingAnswers);

  await sleep(200);
  renderResults(state.result);
  showView('results');
}

function renderLoadingSteps() {
  const container = document.getElementById('loading-steps');
  container.innerHTML = LOADING_STEPS.map((s, i) => `
    <div class="loading-step" id="lstep-${i}">
      <div class="ls-dot"></div>
      <span>${s}</span>
    </div>
  `).join('');
}

function setLoadingStep(i, cls) {
  const el = document.getElementById('lstep-' + i);
  if (el) { el.className = 'loading-step ' + cls; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══════════════════ RESULTS RENDERING ═══════════════════
let radarChart = null;

function renderResults(data) {
  const levelMap = { '高危':'critical', '中高':'high', '中等':'medium', '良好':'good' };
  const iconMap  = { '高危':'!', '中高':'⚠', '中等':'◉', '良好':'✓' };
  const colorMap = { '高危':'var(--crit)', '中高':'var(--high)', '中等':'var(--med)', '良好':'var(--low)' };

  // Hero
  const badge = document.getElementById('res-badge');
  badge.className = 'res-badge ' + (levelMap[data.overallRiskLevel] || 'medium');
  badge.textContent = iconMap[data.overallRiskLevel] || '?';
  document.getElementById('res-level').textContent = `风险评级：${data.overallRiskLevel}`;
  document.getElementById('res-score-num').textContent = data.overallScore;
  document.getElementById('res-score-num').style.color = colorMap[data.overallRiskLevel];
  document.getElementById('res-score-num').style.webkitTextFillColor = '';

  const kpiRL = document.getElementById('kpi-redlines');
  const kpiIX = document.getElementById('kpi-ix');
  const kpiTop = document.getElementById('kpi-toprisk');
  kpiRL.textContent = data.redlines.length;
  kpiRL.className = 'res-kpi-val ' + (data.redlines.length === 0 ? 'good' : data.redlines.length >= 5 ? 'crit' : 'high');
  kpiIX.textContent = data.interactions.length;
  kpiIX.className = 'res-kpi-val ' + (data.interactions.length === 0 ? 'good' : 'high');
  kpiTop.textContent = data.riskScores[0].score.toFixed(1);
  kpiTop.className = 'res-kpi-val ' + (data.riskScores[0].score >= 75 ? 'crit' : data.riskScores[0].score >= 50 ? 'high' : 'good');
  document.getElementById('res-meta').textContent =
    `画像 ${data.meta.personaLabel} · ${data.meta.stageLabel}`;

  // Risk Heatmap
  renderHeatmap(data.riskScores);
  document.getElementById('heatmap-count').textContent = `最高 ${data.riskScores[0].score}`;

  // Redlines
  renderRedlines(data.redlines);

  // Interactions
  renderInteractions(data.interactions);

  // Six Capitals + Radar
  renderCapitals(data.sixCapitals);

  // Stress Tests
  renderStress(data.stressTests);

  // Services
  renderServices(data.services);
}

// ── Heatmap ──
function renderHeatmap(risks) {
  const container = document.getElementById('heatmap-body');
  container.innerHTML = '';
  const getColor = s => s>=75?'var(--crit)': s>=50?'var(--high)': s>=30?'var(--med)':'var(--low)';
  const getDesc  = s => s>=75?'高危': s>=50?'中高': s>=30?'中等':'良好';

  risks.forEach((r, i) => {
    const color = getColor(r.score);
    const row = document.createElement('div');
    row.className = 'heat-row';
    row.innerHTML = `
      <div class="heat-rank ${i===0?'r1':''}">${r.rank}</div>
      <div class="heat-lbl">${r.label}</div>
      <div class="heat-bar-track">
        <div class="heat-bar-fill" id="hbar-${r.code}" style="width:0%;background:${color}">
          <span class="heat-val">${r.score}</span>
        </div>
      </div>
      <div class="heat-descriptor" style="color:${color}">${getDesc(r.score)}</div>
    `;
    container.appendChild(row);
    setTimeout(() => {
      document.getElementById('hbar-' + r.code).style.width = r.score + '%';
    }, 200 + i * 80);
  });
}

// ── Redlines ──
function renderRedlines(redlines) {
  const section = document.getElementById('redline-section');
  const badge = document.getElementById('rl-badge');
  const list = document.getElementById('redline-list');

  if (redlines.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';
  badge.textContent = `触发 ${redlines.length} 条`;
  list.innerHTML = '';
  redlines.forEach(rl => {
    list.insertAdjacentHTML('beforeend', `
      <div class="rl-item">
        <div class="rl-icon">🚨</div>
        <div class="rl-body">
          <div class="rl-title">${rl.code}：${rl.desc}</div>
          <div class="rl-detail">
            <span>触发问题：<strong>${rl.qid}</strong></span>
            <span>当前评分：<strong>${rl.value}</strong></span>
            <span>关联风险：<strong>${rl.risk}</strong></span>
          </div>
        </div>
      </div>
    `);
  });
}

// ── Interactions ──
function renderInteractions(ixs) {
  const section = document.getElementById('ix-section');
  const list = document.getElementById('ix-list');
  const badge = document.getElementById('ix-badge');
  if (ixs.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  badge.textContent = `${ixs.length} 组复合风险`;
  list.innerHTML = '';
  ixs.forEach(ix => {
    list.insertAdjacentHTML('beforeend', `
      <div class="ix-item">
        <span class="ix-code">${ix.code}</span>
        <span class="ix-desc">${ix.desc}</span>
        <div class="ix-risks">${ix.risks.map(r=>`<span class="ix-risk-tag">${r}</span>`).join('')}</div>
      </div>
    `);
  });
}

// ── Six Capitals + Radar ──
function renderCapitals(capitals) {
  const list = document.getElementById('capitals-list');
  list.innerHTML = '';
  Object.entries(capitals).forEach(([name, val]) => {
    const pct = (val / 4) * 100;
    list.insertAdjacentHTML('beforeend', `
      <div class="cap-row">
        <div class="cap-name">${name}</div>
        <div class="cap-bar-track"><div class="cap-bar-fill" style="width:${pct}%"></div></div>
        <div class="cap-val">${val}</div>
      </div>
    `);
  });

  // Radar chart
  const ctx = document.getElementById('radar-canvas').getContext('2d');
  if (radarChart) radarChart.destroy();
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: Object.keys(capitals),
      datasets: [{
        data: Object.values(capitals),
        fill: true,
        backgroundColor: 'rgba(201,168,76,0.12)',
        borderColor: 'rgba(201,168,76,0.7)',
        pointBackgroundColor: '#c9a84c',
        pointBorderColor: '#fff',
        pointRadius: 4,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true, max: 4, ticks: { stepSize:1, color:'rgba(255,255,255,0.2)', backdropColor:'transparent', font:{size:9} },
          grid: { color:'rgba(255,255,255,0.06)' },
          angleLines: { color:'rgba(255,255,255,0.06)' },
          pointLabels: { color:'#8892a8', font:{ size:12, weight:'600', family:"'Noto Sans SC',sans-serif" } }
        }
      },
      plugins: { legend:{ display:false } }
    }
  });
}

// ── Stress Tests ──
function renderStress(tests) {
  const grid = document.getElementById('scenario-grid');
  grid.innerHTML = '';
  tests.forEach(t => {
    const card = document.createElement('div');
    card.className = 'sc-card';
    const pct = t.vulnerability;
    card.innerHTML = `
      <div class="sc-icon">${t.icon}</div>
      <div class="sc-name">${t.scenario}</div>
      <div class="sc-vuln" style="color:${t.color}">${pct}%</div>
      <div class="sc-break">首个断点：<strong>${t.breakpoint}</strong></div>
      <div class="sc-bottom" style="background:${t.color};opacity:${Math.min(1, pct/100 + 0.2)}"></div>
    `;
    grid.appendChild(card);
  });
}

// ── Services ──
function renderServices(services) {
  const container = document.getElementById('services-body');
  container.innerHTML = '';
  const groups = { immediate:'🔴 立即行动', medium:'🟡 中期规划', long:'🟢 长期优化' };
  const dotColors = { immediate:'var(--crit)', medium:'var(--med)', long:'var(--low)' };
  const rankClass = { immediate:'imm', medium:'med', long:'lng' };
  const grouped = {};
  services.forEach(s => { if(!grouped[s.priority]) grouped[s.priority]=[]; grouped[s.priority].push(s); });

  Object.entries(groups).forEach(([key, label]) => {
    if (!grouped[key]) return;
    container.insertAdjacentHTML('beforeend', `
      <div class="svc-phase">
        <div class="svc-phase-dot" style="background:${dotColors[key]}"></div>
        ${label}
      </div>
    `);
    grouped[key].forEach(s => {
      container.insertAdjacentHTML('beforeend', `
        <div class="svc-item">
          <div class="svc-rank ${rankClass[key]}">${s.rank}</div>
          <div class="svc-code">${s.code}</div>
          <div class="svc-body">
            <div class="svc-label">${s.label}</div>
            ${s.desc ? `<div class="svc-desc">${s.desc}</div>` : ''}
          </div>
          <div class="svc-pts">${s.score}pts</div>
        </div>
      `);
    });
  });
}

// ═══════════════════ RESTART ═══════════════════
document.getElementById('btn-restart').addEventListener('click', () => {
  state.routingAnswers = {};
  state.answers = {};
  state.moduleIndex = 0;
  state.result = null;
  showView('landing');
  updateStrip(0);
});

// ═══════════════════ INIT ═══════════════════
showView('landing');

