/**
 * 管理后台（纯静态页）
 * 安全模型：
 * - 前端必须 Firebase Auth 登录（邮箱/密码）
 * - Firestore Rules 仅允许管理员邮箱 read submissions
 */

const cfg = window.__FIREBASE_CONFIG__ || {};
const els = {
  loginView: document.getElementById('view-login'),
  dashView: document.getElementById('view-dashboard'),
  hint: document.getElementById('login-hint'),
  email: document.getElementById('login-email'),
  pass: document.getElementById('login-password'),
  btnLogin: document.getElementById('btn-login'),
  btnLogout: document.getElementById('btn-logout'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnExport: document.getElementById('btn-export'),
  btnSearch: document.getElementById('btn-search'),
  filterEmail: document.getElementById('filter-email'),
  filterLimit: document.getElementById('filter-limit'),
  rows: document.getElementById('rows'),
  status: document.getElementById('admin-status'),
  userPill: document.getElementById('admin-user-pill'),
  modal: document.getElementById('modal'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalClose: document.getElementById('modal-close'),
  modalTitle: document.getElementById('modal-title'),
  modalJson: document.getElementById('modal-json'),
};

function setHint(msg, type) {
  els.hint.textContent = msg || '';
  els.hint.className = 'admin-hint' + (type ? ' ' + type : '');
}

function setStatus(msg, type) {
  els.status.textContent = msg || '';
  els.status.className = 'admin-status' + (type ? ' ' + type : '');
}

function fmtTime(d) {
  if (!d) return '-';
  try {
    const dt = (typeof d.toDate === 'function') ? d.toDate() : (d instanceof Date ? d : new Date(d));
    if (Number.isNaN(dt.getTime())) return '-';
    return dt.toLocaleString();
  } catch (_) { return '-'; }
}

function getLevelPill(level) {
  const v = String(level || '').trim();
  if (!v) return `<span class="admin-pill">-</span>`;
  if (v === '良好') return `<span class="admin-pill good">${v}</span>`;
  if (v === '中等') return `<span class="admin-pill">${v}</span>`;
  if (v === '中高') return `<span class="admin-pill high">${v}</span>`;
  if (v === '高危') return `<span class="admin-pill crit">${v}</span>`;
  return `<span class="admin-pill">${v}</span>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function ensureFirebase() {
  if (!cfg.apiKey || !cfg.projectId) throw new Error('缺少 Firebase 配置');
  if (!window.firebase) throw new Error('Firebase SDK 未加载');
  if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
  if (!firebase.auth || !firebase.firestore) throw new Error('Firebase 模块未加载');
  return {
    auth: firebase.auth(),
    db: firebase.firestore(),
  };
}

let api = null;
let lastDocs = []; // for export

async function doLogin() {
  setHint('', '');
  const email = els.email.value.trim();
  const password = els.pass.value;
  if (!email || !password) {
    setHint('请输入邮箱和密码。', 'error');
    return;
  }
  els.btnLogin.disabled = true;
  try {
    api = ensureFirebase();
    await api.auth.signInWithEmailAndPassword(email, password);
    setHint('登录成功。', 'ok');
  } catch (e) {
    setHint('登录失败：' + (e?.message || String(e)), 'error');
  } finally {
    els.btnLogin.disabled = false;
  }
}

async function doLogout() {
  try {
    api = api || ensureFirebase();
    await api.auth.signOut();
  } catch (_) {}
}

function openModal(title, obj) {
  els.modalTitle.textContent = title || '详情';
  els.modalJson.textContent = JSON.stringify(obj, null, 2);
  els.modal.style.display = 'flex';
}

function closeModal() {
  els.modal.style.display = 'none';
}

function asCsvCell(v) {
  const s = (v === null || v === undefined) ? '' : String(v);
  const needs = /[,"\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

function exportCsv() {
  if (!lastDocs.length) {
    setStatus('没有可导出的数据。', 'error');
    return;
  }
  const headers = [
    'docId','submittedAtISO','createdAt','status',
    'name','email','phone',
    'persona','stage',
    'overallRiskLevel','overallScore'
  ];
  const rows = [headers.join(',')];
  lastDocs.forEach(d => {
    const lead = d.lead || {};
    const r = d.result || {};
    const meta = r.meta || {};
    rows.push([
      d.__docId,
      d.submittedAtISO || '',
      d.createdAt ? fmtTime(d.createdAt) : '',
      d.status || '',
      lead.name || '',
      lead.email || '',
      lead.phone || '',
      d.persona || meta.personaLabel || '',
      d.stage || meta.stageLabel || '',
      r.overallRiskLevel || '',
      r.overallScore ?? '',
    ].map(asCsvCell).join(','));
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.href = URL.createObjectURL(blob);
  a.download = `submissions_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setStatus(`已导出 ${lastDocs.length} 条。`);
}

async function loadSubmissions() {
  setStatus('加载中…');
  els.rows.innerHTML = '';
  lastDocs = [];

  try {
    api = api || ensureFirebase();
    const limit = Math.max(1, Math.min(200, parseInt(els.filterLimit.value || '50', 10)));
    const email = els.filterEmail.value.trim();

    let q = api.db.collection('submissions');
    if (email) {
      // 嵌套字段查询：lead.email
      q = q.where('lead.email', '==', email);
      // 不加 orderBy，避免触发 composite index；客户端再排序
    } else {
      // 默认按 createdAt 倒序（我们写入用的是 serverTimestamp）
      q = q.orderBy('createdAt', 'desc');
    }
    q = q.limit(limit);

    const snap = await q.get();
    const docs = [];
    snap.forEach(doc => {
      const data = doc.data() || {};
      data.__docId = doc.id;
      docs.push(data);
    });

    if (email) {
      docs.sort((a,b) => String(b.submittedAtISO||'').localeCompare(String(a.submittedAtISO||'')));
    }

    lastDocs = docs;
    renderRows(docs);
    setStatus(`已加载 ${docs.length} 条。`);
  } catch (e) {
    setStatus('加载失败：' + (e?.message || String(e)), 'error');
  }
}

function renderRows(docs) {
  els.rows.innerHTML = '';
  docs.forEach(d => {
    const lead = d.lead || {};
    const r = d.result || {};
    const meta = r.meta || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div>${escapeHtml(d.submittedAtISO || '')}</div>
        <div class="admin-mini">${escapeHtml(d.__docId)}</div>
      </td>
      <td>${escapeHtml(lead.name || '')}</td>
      <td>${escapeHtml(lead.email || '')}</td>
      <td>${escapeHtml((d.persona || meta.personaLabel || '-'))} / ${escapeHtml((d.stage || meta.stageLabel || '-'))}</td>
      <td>${getLevelPill(r.overallRiskLevel)}</td>
      <td>${escapeHtml(r.overallScore ?? '')}</td>
      <td>${escapeHtml(d.status || '')}</td>
      <td><a class="admin-link" data-id="${escapeHtml(d.__docId)}">查看</a></td>
    `;
    tr.querySelector('.admin-link')?.addEventListener('click', () => {
      openModal('提交详情', d);
    });
    els.rows.appendChild(tr);
  });
}

function showDashboard(user) {
  els.loginView.style.display = 'none';
  els.dashView.style.display = 'block';
  els.userPill.style.display = 'block';
  els.userPill.textContent = user?.email ? `已登录：${user.email}` : '已登录';
  loadSubmissions();
}

function showLogin() {
  els.dashView.style.display = 'none';
  els.loginView.style.display = 'block';
  els.userPill.style.display = 'none';
  els.rows.innerHTML = '';
  setHint('', '');
  setStatus('');
}

function wireEvents() {
  els.btnLogin.addEventListener('click', doLogin);
  els.btnLogout.addEventListener('click', doLogout);
  els.btnRefresh.addEventListener('click', loadSubmissions);
  els.btnSearch.addEventListener('click', loadSubmissions);
  els.btnExport.addEventListener('click', exportCsv);
  els.modalClose.addEventListener('click', closeModal);
  els.modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

function boot() {
  wireEvents();
  try {
    api = ensureFirebase();
    api.auth.onAuthStateChanged((user) => {
      if (user) showDashboard(user);
      else showLogin();
    });
  } catch (e) {
    setHint('初始化失败：' + (e?.message || String(e)), 'error');
  }
}

boot();

