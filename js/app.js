/* ==================================================
   মেস হিসাব ম্যানেজার — frontend application logic
   ================================================== */

const API = '/api/api';

const state = {
  page: 'home',        // 'home' | 'accounts' | 'statement'
  months: [],
  currentMonthId: null,
  statementMonthId: null,
};

// ── API helper ──────────────────────────────────
async function api(action, { method = 'GET', body = null, qs = '' } = {}) {
  const url = `${API}?action=${action}${qs}`;
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res, json;
  try {
    res = await fetch(url, opts);
    json = await res.json();
  } catch (e) {
    throw new Error('সার্ভারে সংযোগ করা যায়নি। নেটওয়ার্ক বা PHP সার্ভার চেক করুন।');
  }
  if (!json.ok) throw new Error(json.error || 'একটি ত্রুটি ঘটেছে।');
  return json.data;
}

// ── toast ────────────────────────────────────────
let toastTimer = null;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

// ── modal helpers ────────────────────────────────
function openModal(html) {
  const backdrop = document.getElementById('modal-backdrop');
  const box = document.getElementById('modal-box');
  box.innerHTML = `<button class="modal-close" onclick="closeModal()">✕</button>${html}`;
  backdrop.classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-backdrop').classList.add('hidden');
}
document.getElementById('modal-backdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modal-backdrop') closeModal();
});

// ── theme ────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('mess_theme') || 'dark';
  document.body.setAttribute('data-theme', saved);
}
function toggleTheme() {
  const cur = document.body.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('mess_theme', next);
  render();
}
function themeLabel() {
  return document.body.getAttribute('data-theme') === 'dark' ? '☀ লাইট মোড' : '🌙 ডার্ক মোড';
}

// ── formatting helpers ───────────────────────────
const money = (n) => `৳${Number(n).toFixed(2)}`;
const signedMoney = (n) => `${n < 0 ? '−' : ''}৳${Math.abs(n).toFixed(2)}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── ROUTER / RENDER ──────────────────────────────
function render() {
  const app = document.getElementById('app');
  if (state.page === 'home') return renderHome(app);
  if (state.page === 'accounts') return renderAccounts(app);
  if (state.page === 'statement') return renderStatementPage(app);
}

function goHome() { state.page = 'home'; render(); }
function goAccounts() { state.page = 'accounts'; render(); }
function goStatement() { state.page = 'statement'; render(); }

// ── HOME PAGE ────────────────────────────────────
function renderHome(app) {
  app.innerHTML = `
    <div class="top-bar"></div>
    <div class="home-wrap">
      <div class="corner-tr">
        <button class="btn-ghost" onclick="toggleTheme()">${themeLabel()}</button>
      </div>
      <div class="home-icon">🏠</div>
      <h1 class="home-title">মেস হিসাব ম্যানেজার</h1>
      <div class="home-subtitle">Mess Accounts Manager</div>
      <div class="nav-cards">
        <div class="nav-card" onclick="goAccounts()">
          <span class="emoji">📋</span>
          <div class="title" style="color:var(--accent)">মাসিক হিসাব</div>
          <div class="sub">Monthly accounts &amp; calculations</div>
        </div>
        <div class="nav-card" onclick="goStatement()">
          <span class="emoji">📊</span>
          <div class="title" style="color:var(--green)">Statement</div>
          <div class="sub">Payment status per member</div>
        </div>
      </div>
    </div>
  `;
}

// ── ACCOUNTS PAGE ────────────────────────────────
async function renderAccounts(app) {
  app.innerHTML = `
    <div class="layout">
      <div class="sidebar">
        <h2>মেস হিসাব</h2>
        <div class="section-label">মাস নির্বাচন</div>
        <div class="month-list" id="month-list"><div class="mini-list-empty">লোড হচ্ছে…</div></div>
        <button class="sidebar-btn" style="background:var(--accent)" onclick="openAddMonthModal()">＋ নতুন মাস</button>
        <button class="sidebar-btn" style="background:var(--accent2)" onclick="openMembersModal()">সদস্য ব্যবস্থাপনা</button>
        <button class="sidebar-btn secondary btn-ghost" onclick="toggleTheme()">${themeLabel()}</button>
        <button class="sidebar-btn secondary btn-ghost" style="margin-top:16px" onclick="goHome()">🏠 হোমপেজ</button>
      </div>
      <div class="main" id="main-area">
        <div class="main-empty">একটি মাস নির্বাচন করুন বা নতুন মাস তৈরি করুন</div>
      </div>
    </div>
  `;
  await refreshMonthList();
  if (state.currentMonthId) {
    await loadMonthView(state.currentMonthId);
  }
}

async function refreshMonthList() {
  const listEl = document.getElementById('month-list');
  if (!listEl) return;
  try {
    state.months = await api('months');
  } catch (e) {
    listEl.innerHTML = `<div class="mini-list-empty">${esc(e.message)}</div>`;
    return;
  }
  if (!state.months.length) {
    listEl.innerHTML = `<div class="mini-list-empty">কোনো মাস নেই। নতুন মাস তৈরি করুন।</div>`;
    return;
  }
  listEl.innerHTML = state.months.map(m => `
    <div class="month-list-item ${m.id === state.currentMonthId ? 'active' : ''}"
         onclick="loadMonthView(${m.id})">${esc(m.label)}</div>
  `).join('');
}

async function loadMonthView(monthId) {
  state.currentMonthId = monthId;
  document.querySelectorAll('.month-list-item').forEach(el => el.classList.remove('active'));
  await refreshMonthList();

  const main = document.getElementById('main-area');
  main.innerHTML = `<div class="main-empty">লোড হচ্ছে…</div>`;
  let data;
  try {
    data = await api('month_data', { qs: `&month_id=${monthId}` });
  } catch (e) {
    main.innerHTML = `<div class="main-empty">${esc(e.message)}</div>`;
    return;
  }
  const { month, rows, totals, extras } = data;

  main.innerHTML = `
    <div class="month-top">
      <h1>📋 ${esc(month.label)}</h1>
      <div class="month-actions">
        <button style="background:var(--green)" onclick="openAddRecordModal(${monthId})">সদস্য যোগ/খরচ</button>
        <button style="background:var(--yellow)" onclick="openExtraCostModal(${monthId})">অন্যান্য খরচ</button>
        <button style="background:var(--fg-dim)" onclick="openChangeRentModal(${monthId}, '${esc(month.label).replace(/'/g, "\\'")}', ${month.rent})">ভাড়া পরিবর্তন</button>
        <button style="background:var(--accent)" onclick="exportCsv(${monthId}, '${esc(month.label).replace(/'/g, "\\'")}')">⬇ Export CSV</button>
        <button class="btn-danger" onclick="deleteMonth(${monthId})">মাস মুছুন</button>
      </div>
    </div>
    <hr class="divider">
    <div class="cards-row">
      ${statCard('মিল রেট', money(totals.meal_rate))}
      ${statCard('মোট মিল', totals.meals)}
      ${statCard('মোট বাজার', money(totals.bazar))}
      ${statCard('অন্যান্য খরচ', money(totals.total_extra))}
      ${statCard('বাসা ভাড়া', money(totals.rent))}
      ${statCard('জনপ্রতি শেয়ার্ড', money(totals.per_person_shared))}
    </div>
    <div class="table-wrap">
      <table class="mess-table">
        <thead><tr>
          <th>নাম</th><th>মিল সংখ্যা</th><th>বাজার (৳)</th><th>খাইসে (৳)</th>
          <th>দিবে (৳)</th><th>পাবে (৳)</th><th>মোট (৳)</th><th>স্ট্যাটাস</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr onclick="openEditRecordModal(${monthId}, ${r.id})">
              <td>${esc(r.name)}</td>
              <td>${r.meals}</td>
              <td>${money(r.bazar)}</td>
              <td>${money(r.khaise)}</td>
              <td>${money(r.dibe)}</td>
              <td>${money(r.pabe)}</td>
              <td class="${r.status === 'পাবে' ? 'status-pabe' : 'status-dibe'}">${signedMoney(r.moto)}</td>
              <td><span class="status-pill ${r.status === 'পাবে' ? 'status-pabe' : 'status-dibe'}">${r.status}</span></td>
            </tr>
          `).join('') || `<tr><td colspan="8" style="text-align:center;color:var(--fg-dim)">কোনো সদস্য নেই</td></tr>`}
        </tbody>
        <tfoot>
          <tr>
            <td>মোটঃ</td><td>${totals.meals}</td><td>${money(totals.bazar)}</td>
            <td>${money(totals.khaise)}</td><td>${money(totals.dibe)}</td><td>${money(totals.pabe)}</td>
            <td>${money(Math.abs(totals.moto))}</td><td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="extras-panel">
      <h3>অন্যান্য খরচ</h3>
      <div class="extras-list">
        ${extras.length ? extras.map(e => `<div class="extra-chip">${esc(e.label)}: <b>${money(e.amount)}</b></div>`).join('')
                         : `<span style="color:var(--fg-dim);font-size:13px">কোনো অতিরিক্ত খরচ যোগ করা হয়নি</span>`}
      </div>
    </div>
  `;
}

function statCard(label, value) {
  return `<div class="stat-card"><div class="label">${esc(label)}</div><div class="value mono">${value}</div></div>`;
}

// ── month actions ────────────────────────────────
function openAddMonthModal() {
  openModal(`
    <h2>নতুন মাস তৈরি করুন</h2>
    <div class="modal-field"><label>মাসের নাম</label><input id="m-label" placeholder="যেমন: July 2026"></div>
    <div class="modal-field"><label>বাসা ভাড়া (৳)</label><input id="m-rent" type="number" value="2000" min="0"></div>
    <div class="modal-actions">
      <button class="ghost" onclick="closeModal()">বাতিল</button>
      <button style="background:var(--accent)" onclick="submitAddMonth()">তৈরি করুন</button>
    </div>
  `);
}
async function submitAddMonth() {
  const label = document.getElementById('m-label').value.trim();
  const rent = parseFloat(document.getElementById('m-rent').value);
  if (!label) return toast('মাসের নাম দিন।', 'error');
  try {
    const m = await api('add_month', { method: 'POST', body: { label, rent } });
    closeModal();
    toast(`'${label}' মাস তৈরি হয়েছে!`, 'success');
    await refreshMonthList();
    await loadMonthView(m.id);
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteMonth(monthId) {
  if (!confirm('এই মাসের সব ডেটা মুছে যাবে। চালিয়ে যাবেন?')) return;
  try {
    await api('delete_month', { method: 'POST', body: { month_id: monthId } });
    state.currentMonthId = null;
    toast('মাস মুছে ফেলা হয়েছে।', 'success');
    document.getElementById('main-area').innerHTML = `<div class="main-empty">একটি মাস নির্বাচন করুন বা নতুন মাস তৈরি করুন</div>`;
    await refreshMonthList();
  } catch (e) { toast(e.message, 'error'); }
}

function openChangeRentModal(monthId, label, currentRent) {
  openModal(`
    <h2>ভাড়া পরিবর্তন</h2>
    <p style="color:var(--fg-dim);font-size:13px;margin-top:-8px">'${esc(label)}' মাসের বাসা ভাড়া</p>
    <div class="modal-field"><input id="rent-val" type="number" min="0" value="${currentRent}"></div>
    <div class="modal-actions">
      <button class="ghost" onclick="closeModal()">বাতিল</button>
      <button style="background:var(--accent)" onclick="submitChangeRent(${monthId})">সংরক্ষণ</button>
    </div>
  `);
}
async function submitChangeRent(monthId) {
  const rent = parseFloat(document.getElementById('rent-val').value);
  if (isNaN(rent) || rent < 0) return toast('সঠিক ভাড়া দিন।', 'error');
  try {
    await api('change_rent', { method: 'POST', body: { month_id: monthId, rent } });
    closeModal();
    await loadMonthView(monthId);
  } catch (e) { toast(e.message, 'error'); }
}

// ── member management ────────────────────────────
async function openMembersModal() {
  openModal(`
    <h2>সদস্য ব্যবস্থাপনা</h2>
    <div class="mini-list" id="member-list"><div class="mini-list-empty">লোড হচ্ছে…</div></div>
    <div class="add-row">
      <input id="new-member-name" placeholder="নতুন সদস্যের নাম">
      <button onclick="submitAddMember()">যোগ করুন</button>
    </div>
  `);
  await refreshMemberList();
}
async function refreshMemberList() {
  const el = document.getElementById('member-list');
  if (!el) return;
  let members;
  try { members = await api('members'); } catch (e) { el.innerHTML = `<div class="mini-list-empty">${esc(e.message)}</div>`; return; }
  el.innerHTML = members.length
    ? members.map(m => `
        <div class="mini-list-item">
          <span>${esc(m.name)}</span>
          <button onclick="deleteMember(${m.id}, '${esc(m.name).replace(/'/g, "\\'")}')">মুছুন</button>
        </div>`).join('')
    : `<div class="mini-list-empty">কোনো সদস্য নেই</div>`;
}
async function submitAddMember() {
  const input = document.getElementById('new-member-name');
  const name = input.value.trim();
  if (!name) return;
  try {
    await api('add_member', { method: 'POST', body: { name } });
    input.value = '';
    await refreshMemberList();
    if (state.page === 'accounts') await refreshMonthList();
  } catch (e) { toast(e.message, 'error'); }
}
async function deleteMember(id, name) {
  if (!confirm(`'${name}' সদস্যকে মুছবেন?\nসব হিসাব মুছে যাবে।`)) return;
  try {
    await api('delete_member', { method: 'POST', body: { member_id: id } });
    await refreshMemberList();
    if (state.page === 'accounts' && state.currentMonthId) await loadMonthView(state.currentMonthId);
  } catch (e) { toast(e.message, 'error'); }
}

// ── add / edit record ────────────────────────────
async function openAddRecordModal(monthId) {
  let members;
  try { members = await api('members'); } catch (e) { return toast(e.message, 'error'); }
  if (!members.length) return toast('আগে সদস্য যোগ করুন।', 'error');
  openModal(`
    <h2>মিল/বাজার যোগ করুন</h2>
    <div class="modal-field"><label>সদস্য</label>
      <select id="rec-member">${members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
    </div>
    <div class="modal-field"><label>মিল সংখ্যা</label><input id="rec-meals" type="number" min="0" value="0"></div>
    <div class="modal-field"><label>বাজার (৳)</label><input id="rec-bazar" type="number" min="0" step="0.01" value="0"></div>
    <p style="color:var(--fg-dim);font-size:12px;margin-top:-6px">এই মান বিদ্যমান হিসাবের সাথে যোগ হবে।</p>
    <div class="modal-actions">
      <button class="ghost" onclick="closeModal()">বাতিল</button>
      <button style="background:var(--accent)" onclick="submitAddRecord(${monthId})">সংরক্ষণ করুন</button>
    </div>
  `);
}
async function submitAddRecord(monthId) {
  const member_id = parseInt(document.getElementById('rec-member').value, 10);
  const meals = parseInt(document.getElementById('rec-meals').value, 10);
  const bazar = parseFloat(document.getElementById('rec-bazar').value);
  if (isNaN(meals) || isNaN(bazar) || meals < 0 || bazar < 0) return toast('সঠিক সংখ্যা দিন।', 'error');
  try {
    await api('add_record', { method: 'POST', body: { month_id: monthId, member_id, meals, bazar } });
    closeModal();
    await loadMonthView(monthId);
  } catch (e) { toast(e.message, 'error'); }
}

async function openEditRecordModal(monthId, memberId) {
  let data;
  try { data = await api('month_data', { qs: `&month_id=${monthId}` }); } catch (e) { return toast(e.message, 'error'); }
  const row = data.rows.find(r => r.id === memberId);
  if (!row) return;
  openModal(`
    <h2>হিসাব সম্পাদনা</h2>
    <p style="text-align:center;color:var(--accent);font-weight:700;margin-top:-8px">${esc(row.name)}</p>
    <div class="modal-field"><label>মিল সংখ্যা</label><input id="edit-meals" type="number" min="0" value="${row.meals}"></div>
    <div class="modal-field"><label>বাজার (৳)</label><input id="edit-bazar" type="number" min="0" step="0.01" value="${row.bazar}"></div>
    <div class="modal-actions">
      <button class="ghost" onclick="closeModal()">বাতিল</button>
      <button class="danger" onclick="submitDeleteRecord(${monthId}, ${memberId})">মুছুন</button>
      <button style="background:var(--accent)" onclick="submitEditRecord(${monthId}, ${memberId})">আপডেট</button>
    </div>
  `);
}
async function submitEditRecord(monthId, memberId) {
  const meals = parseInt(document.getElementById('edit-meals').value, 10);
  const bazar = parseFloat(document.getElementById('edit-bazar').value);
  if (isNaN(meals) || isNaN(bazar) || meals < 0 || bazar < 0) return toast('সঠিক সংখ্যা দিন।', 'error');
  try {
    await api('edit_record', { method: 'POST', body: { month_id: monthId, member_id: memberId, meals, bazar } });
    closeModal();
    await loadMonthView(monthId);
  } catch (e) { toast(e.message, 'error'); }
}
async function submitDeleteRecord(monthId, memberId) {
  if (!confirm('এই রেকর্ড মুছবেন?')) return;
  try {
    await api('delete_record', { method: 'POST', body: { month_id: monthId, member_id: memberId } });
    closeModal();
    await loadMonthView(monthId);
  } catch (e) { toast(e.message, 'error'); }
}

// ── extra costs ──────────────────────────────────
async function openExtraCostModal(monthId) {
  openModal(`
    <h2>অন্যান্য খরচ</h2>
    <div class="mini-list" id="extra-list"><div class="mini-list-empty">লোড হচ্ছে…</div></div>
    <div class="add-row">
      <input id="extra-label" placeholder="লেবেল" style="flex:1.4">
      <input id="extra-amount" type="number" min="0" step="0.01" placeholder="৳" style="width:90px">
      <button onclick="submitAddExtra(${monthId})">যোগ</button>
    </div>
    <div class="modal-actions"><button style="background:var(--accent)" onclick="closeAndRefresh(${monthId})">সম্পন্ন</button></div>
  `);
  await refreshExtraList(monthId);
}
async function refreshExtraList(monthId) {
  const el = document.getElementById('extra-list');
  if (!el) return;
  let data;
  try { data = await api('month_data', { qs: `&month_id=${monthId}` }); } catch (e) { el.innerHTML = `<div class="mini-list-empty">${esc(e.message)}</div>`; return; }
  el.innerHTML = data.extras.length
    ? data.extras.map(x => `
        <div class="mini-list-item">
          <span>${esc(x.label)}: ${money(x.amount)}</span>
          <button onclick="deleteExtra(${x.id}, ${monthId})">মুছুন</button>
        </div>`).join('')
    : `<div class="mini-list-empty">কোনো খরচ নেই</div>`;
}
async function submitAddExtra(monthId) {
  const label = document.getElementById('extra-label').value.trim();
  const amount = parseFloat(document.getElementById('extra-amount').value);
  if (!label) return toast('লেবেল দিন।', 'error');
  if (isNaN(amount) || amount < 0) return toast('পরিমাণ সঠিক দিন।', 'error');
  try {
    await api('add_extra', { method: 'POST', body: { month_id: monthId, label, amount } });
    document.getElementById('extra-label').value = '';
    document.getElementById('extra-amount').value = '';
    await refreshExtraList(monthId);
  } catch (e) { toast(e.message, 'error'); }
}
async function deleteExtra(extraId, monthId) {
  try {
    await api('delete_extra', { method: 'POST', body: { extra_id: extraId } });
    await refreshExtraList(monthId);
  } catch (e) { toast(e.message, 'error'); }
}
async function closeAndRefresh(monthId) {
  closeModal();
  await loadMonthView(monthId);
}

// ── CSV export (client-side, replaces the desktop Excel export) ──
async function exportCsv(monthId, label) {
  let data;
  try { data = await api('month_data', { qs: `&month_id=${monthId}` }); } catch (e) { return toast(e.message, 'error'); }
  const { rows, totals } = data;
  const header = ['নাম', 'মিল সংখ্যা', 'বাজার', 'খাইসে', 'দিবে', 'পাবে', 'মোট', 'স্ট্যাটাস'];
  const lines = [header.join(',')];
  rows.forEach(r => {
    lines.push([r.name, r.meals, r.bazar.toFixed(2), r.khaise.toFixed(2), r.dibe.toFixed(2), r.pabe.toFixed(2), r.moto.toFixed(2), r.status].join(','));
  });
  lines.push(['মোটঃ', totals.meals, totals.bazar.toFixed(2), totals.khaise.toFixed(2), totals.dibe.toFixed(2), totals.pabe.toFixed(2), Math.abs(totals.moto).toFixed(2), ''].join(','));

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mess_${label.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── STATEMENT PAGE ───────────────────────────────
async function renderStatementPage(app) {
  app.innerHTML = `
    <div class="page-header">
      <h1>📊 Statement</h1>
      <button style="background:var(--accent2);color:var(--bg);padding:8px 16px;border-radius:8px" onclick="goHome()">🏠 হোমপেজ</button>
    </div>
    <div class="layout">
      <div class="sidebar" style="width:210px">
        <div class="section-label">মাস নির্বাচন করুন</div>
        <div class="month-list" id="st-month-list" style="flex:1"><div class="mini-list-empty">লোড হচ্ছে…</div></div>
      </div>
      <div class="main" id="st-detail"><div class="main-empty">লোড হচ্ছে…</div></div>
    </div>
  `;
  let months;
  try { months = await api('months'); } catch (e) { document.getElementById('st-month-list').innerHTML = `<div class="mini-list-empty">${esc(e.message)}</div>`; return; }
  state.months = months;
  const listEl = document.getElementById('st-month-list');
  if (!months.length) {
    listEl.innerHTML = `<div class="mini-list-empty">কোনো মাস পাওয়া যায়নি।</div>`;
    document.getElementById('st-detail').innerHTML = `<div class="main-empty">কোনো মাস পাওয়া যায়নি। আগে মাসিক হিসাব থেকে মাস তৈরি করুন।</div>`;
    return;
  }
  listEl.innerHTML = months.map(m => `<div class="month-list-item" data-mid="${m.id}" onclick="loadStatementDetail(${m.id}, '${esc(m.label).replace(/'/g, "\\'")}')">${esc(m.label)}</div>`).join('');
  const first = months[0];
  await loadStatementDetail(first.id, first.label);
}

async function loadStatementDetail(monthId, label) {
  state.statementMonthId = monthId;
  document.querySelectorAll('#st-month-list .month-list-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.mid, 10) === monthId);
  });
  const el = document.getElementById('st-detail');
  el.innerHTML = `<div class="main-empty">লোড হচ্ছে…</div>`;
  let data;
  try { data = await api('statement', { qs: `&month_id=${monthId}` }); } catch (e) { el.innerHTML = `<div class="main-empty">${esc(e.message)}</div>`; return; }

  el.innerHTML = `
    <div style="padding:16px 20px 4px"><h2 style="margin:0;font-size:18px">📅 ${esc(label)}</h2></div>
    <div class="statement-head"><span>নাম</span><span>মোট (৳)</span><span>স্ট্যাটাস</span><span>ভাড়া পরিশোধ</span></div>
    <div>
      ${data.rows.map(r => `
        <div class="statement-row">
          <span class="name">${esc(r.name)}</span>
          <span class="amount ${r.status === 'পাবে' ? 'status-pabe' : 'status-dibe'}">${signedMoney(r.moto)}</span>
          <span class="status ${r.status === 'পাবে' ? 'status-pabe' : 'status-dibe'}">${r.status}</span>
          <span class="paid-toggle">
            <input type="checkbox" ${r.paid ? 'checked' : ''} onchange="togglePayment(${monthId}, ${r.id}, this.checked)">
            <label style="font-size:12px;color:var(--fg-dim)">পরিশোধ ✓</label>
          </span>
        </div>
      `).join('') || `<div class="mini-list-empty">কোনো সদস্য নেই</div>`}
    </div>
  `;
}
async function togglePayment(monthId, memberId, paid) {
  try {
    await api('toggle_payment', { method: 'POST', body: { month_id: monthId, member_id: memberId, paid } });
  } catch (e) { toast(e.message, 'error'); }
}

// ── init ──────────────────────────────────────────
initTheme();
render();
