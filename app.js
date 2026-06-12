/* =====================================================================
   Expense Tracker — offline-first PWA (vanilla JS, no dependencies)
   Data model (persisted in localStorage under key STORE_KEY):
   {
     currency: "$",
     theme: "light" | "dark",
     currentMonth: "2026-06",
     months: {
       "2026-06": {
         income: Number,
         expenses: [
           { id, name, category, amount, type:"fixed"|"variable", due, paid:Boolean }
         ]
       }
     }
   }
   ===================================================================== */

const STORE_KEY = 'expense-tracker-v1';

/* ----------------------------- State ------------------------------ */
let state = load();
let filterPaid = 'all';   // all | paid | unpaid
let filterType = 'all';   // all | fixed | variable
let editingId = null;

/* --------------------------- Persistence -------------------------- */
function defaultState() {
  const m = monthKey(new Date());
  return {
    currency: '$',
    theme: 'light',
    currentMonth: m,
    months: { [m]: { income: 0, expenses: [] } },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // basic shape guard
    if (!parsed.months || !parsed.currentMonth) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

/* ----------------------------- Helpers ---------------------------- */
function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function nextMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m, 1); // m is 0-based next month
  return monthKey(d);
}

function fmt(n) {
  return state.currency + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function currentMonth() {
  return state.months[state.currentMonth];
}

function totals(month) {
  const total = month.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const paid = month.expenses.filter(e => e.paid).reduce((s, e) => s + Number(e.amount || 0), 0);
  return { income: Number(month.income || 0), total, paid, balance: Number(month.income || 0) - total };
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

/* ----------------------------- Toast ------------------------------ */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ============================ RENDERING ============================ */
function render() {
  renderMonthSelect();
  renderDashboard();
  renderExpenses();
  renderHistory();
  renderSettings();
  renderCurrencySymbols();
}

function renderCurrencySymbols() {
  $$('[data-currency-symbol]').forEach(el => (el.textContent = state.currency));
}

function renderMonthSelect() {
  const sel = $('#monthSelect');
  const keys = Object.keys(state.months).sort().reverse();
  sel.innerHTML = keys.map(k => `<option value="${k}">${monthLabel(k)}</option>`).join('');
  sel.value = state.currentMonth;
}

function renderDashboard() {
  const m = currentMonth();
  const t = totals(m);

  $('#incomeInput').value = m.income || '';
  $('#statIncome').textContent = fmt(t.income);
  $('#statExpenses').textContent = fmt(t.total);
  $('#statPaid').textContent = fmt(t.paid);

  const bal = $('#statBalance');
  bal.textContent = fmt(t.balance);
  bal.classList.toggle('positive', t.balance >= 0);
  bal.classList.toggle('negative', t.balance < 0);

  drawBarChart(t);
  drawCategoryChart(m);
}

function renderExpenses() {
  const m = currentMonth();
  const body = $('#expenseBody');
  const list = m.expenses.filter(e => {
    if (filterPaid === 'paid' && !e.paid) return false;
    if (filterPaid === 'unpaid' && e.paid) return false;
    if (filterType !== 'all' && e.type !== filterType) return false;
    return true;
  });

  body.innerHTML = list.map(e => `
    <tr class="${e.paid ? 'paid-row' : ''}" data-id="${e.id}">
      <td>
        <button class="pay-toggle ${e.paid ? 'paid' : ''}" data-action="toggle" title="Toggle paid">✓</button>
      </td>
      <td class="name-cell">${escapeHtml(e.name)}</td>
      <td>${escapeHtml(e.category || '—')}</td>
      <td><span class="type-badge">${e.type}</span></td>
      <td>${e.due ? new Date(e.due).toLocaleDateString() : '—'}</td>
      <td class="num">${fmt(e.amount)}</td>
      <td>
        <div class="row-actions">
          <button data-action="edit" title="Edit">✏️</button>
          <button data-action="delete" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`).join('');

  $('#emptyState').style.display = list.length ? 'none' : 'block';

  // populate category datalist with unique categories across all months
  const cats = new Set();
  Object.values(state.months).forEach(mo => mo.expenses.forEach(x => x.category && cats.add(x.category)));
  $('#categoryList').innerHTML = Array.from(cats).map(c => `<option value="${escapeHtml(c)}">`).join('');
}

function renderHistory() {
  const body = $('#historyBody');
  const keys = Object.keys(state.months).sort().reverse();
  body.innerHTML = keys.map(k => {
    const t = totals(state.months[k]);
    const cls = t.balance >= 0 ? 'positive' : 'negative';
    return `<tr data-month="${k}">
      <td>${monthLabel(k)}</td>
      <td class="num">${fmt(t.income)}</td>
      <td class="num">${fmt(t.total)}</td>
      <td class="num"><span class="stat-value ${cls}" style="font-size:0.9rem">${fmt(t.balance)}</span></td>
      <td><div class="row-actions"><button data-action="view" title="Open">↗️</button></div></td>
    </tr>`;
  }).join('');
  $('#historyEmpty').style.display = keys.length ? 'none' : 'block';
}

function renderSettings() {
  $('#currencyInput').value = state.currency;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ============================== CHARTS ============================= */
/* Lightweight canvas charts — no external library, works fully offline. */
function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || canvas.parentElement.clientWidth;
  const h = canvas.height;
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  return { ctx, w, h };
}

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function drawBarChart(t) {
  const canvas = $('#barChart');
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);

  const data = [
    { label: 'Income', value: t.income, color: cssVar('--primary') },
    { label: 'Expenses', value: t.total, color: cssVar('--expense') },
    { label: 'Balance', value: Math.max(t.balance, 0), color: cssVar('--paid') },
  ];
  const max = Math.max(...data.map(d => d.value), 1);
  const pad = 30;
  const barW = (w - pad * 2) / data.length * 0.5;
  const gap = (w - pad * 2) / data.length;
  const baseY = h - 24;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';

  data.forEach((d, i) => {
    const x = pad + gap * i + (gap - barW) / 2;
    const barH = (d.value / max) * (baseY - 16);
    ctx.fillStyle = d.color;
    roundRect(ctx, x, baseY - barH, barW, barH, 6);
    ctx.fill();
    ctx.fillStyle = cssVar('--muted');
    ctx.fillText(d.label, x + barW / 2, baseY + 16);
    ctx.fillStyle = cssVar('--text');
    ctx.fillText(fmt(d.value), x + barW / 2, baseY - barH - 6);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  if (h <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const PALETTE = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#db2777', '#0891b2', '#ca8a04', '#dc2626', '#4f46e5', '#059669'];

function drawCategoryChart(m) {
  const canvas = $('#catChart');
  const legend = $('#catLegend');
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);

  const byCat = {};
  m.expenses.forEach(e => {
    const c = e.category || 'Uncategorised';
    byCat[c] = (byCat[c] || 0) + Number(e.amount || 0);
  });
  const entries = Object.entries(byCat).filter(([, v]) => v > 0);

  if (!entries.length) {
    ctx.fillStyle = cssVar('--muted');
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No expenses to chart', w / 2, h / 2);
    legend.innerHTML = '';
    return;
  }

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const cx = w / 2, cy = h / 2, radius = Math.min(w, h) / 2 - 10;
  let start = -Math.PI / 2;

  entries.forEach(([, v], i) => {
    const slice = (v / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.fill();
    start += slice;
  });

  // donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = cssVar('--surface');
  ctx.fill();

  legend.innerHTML = entries.map(([k, v], i) =>
    `<span class="legend-item"><span class="legend-swatch" style="background:${PALETTE[i % PALETTE.length]}"></span>${escapeHtml(k)} — ${fmt(v)} (${Math.round(v / total * 100)}%)</span>`
  ).join('');
}

/* ============================== ACTIONS =========================== */
function addOrUpdateExpense(e) {
  e.preventDefault();
  const data = {
    name: $('#nameInput').value.trim(),
    amount: parseFloat($('#amountInput').value) || 0,
    category: $('#categoryInput').value.trim(),
    type: $('#typeInput').value,
    due: $('#dueInput').value,
  };
  if (!data.name) return;

  const m = currentMonth();
  if (editingId) {
    const idx = m.expenses.findIndex(x => x.id === editingId);
    if (idx > -1) m.expenses[idx] = { ...m.expenses[idx], ...data };
    toast('Expense updated');
  } else {
    m.expenses.push({ id: uid(), paid: false, ...data });
    toast('Expense added');
  }
  resetForm();
  save();
  render();
}

function resetForm() {
  editingId = null;
  $('#expenseForm').reset();
  $('#expenseId').value = '';
  $('#submitBtn').textContent = 'Add expense';
  $('#cancelEditBtn').hidden = true;
}

function startEdit(id) {
  const e = currentMonth().expenses.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  $('#nameInput').value = e.name;
  $('#amountInput').value = e.amount;
  $('#categoryInput').value = e.category || '';
  $('#typeInput').value = e.type;
  $('#dueInput').value = e.due || '';
  $('#submitBtn').textContent = 'Save changes';
  $('#cancelEditBtn').hidden = false;
  switchTab('expenses');
  $('#nameInput').focus();
}

function deleteExpense(id) {
  const m = currentMonth();
  m.expenses = m.expenses.filter(x => x.id !== id);
  save();
  render();
  toast('Expense deleted');
}

function togglePaid(id) {
  const e = currentMonth().expenses.find(x => x.id === id);
  if (e) { e.paid = !e.paid; save(); render(); }
}

function startNewMonth() {
  const nextKey = nextMonthKey(state.currentMonth);
  if (state.months[nextKey]) {
    state.currentMonth = nextKey;
    save(); render();
    toast('Switched to ' + monthLabel(nextKey));
    return;
  }
  // carry over fixed expenses, reset to unpaid
  const fixed = currentMonth().expenses
    .filter(e => e.type === 'fixed')
    .map(e => ({ ...e, id: uid(), paid: false }));
  state.months[nextKey] = { income: currentMonth().income, expenses: fixed };
  state.currentMonth = nextKey;
  save(); render();
  toast('Started ' + monthLabel(nextKey) + ' (fixed expenses carried over)');
}

/* ---------------------------- Backup ------------------------------ */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expense-tracker-backup-${monthKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Data exported');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.months || !parsed.currentMonth) throw new Error('Invalid file');
      state = parsed;
      applyTheme();
      save(); render();
      toast('Data imported');
    } catch {
      toast('Import failed: invalid file');
    }
  };
  reader.readAsText(file);
}

/* ----------------------------- Theme ------------------------------ */
function applyTheme() {
  document.body.setAttribute('data-theme', state.theme === 'dark' ? 'dark' : 'light');
  $('#themeToggle').textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  save();
  renderDashboard(); // redraw charts with new colors
}

/* ----------------------------- Tabs ------------------------------- */
function switchTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === name));
  if (name === 'dashboard') renderDashboard(); // ensure charts sized correctly
}

/* =========================== EVENT WIRING ========================= */
function bindEvents() {
  // Tabs
  $$('.tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

  // Month select
  $('#monthSelect').addEventListener('change', e => {
    state.currentMonth = e.target.value;
    save(); render();
  });

  // Theme
  $('#themeToggle').addEventListener('click', toggleTheme);

  // Income
  $('#incomeInput').addEventListener('input', e => {
    currentMonth().income = parseFloat(e.target.value) || 0;
    save();
    const t = totals(currentMonth());
    $('#statIncome').textContent = fmt(t.income);
    const bal = $('#statBalance');
    bal.textContent = fmt(t.balance);
    bal.classList.toggle('positive', t.balance >= 0);
    bal.classList.toggle('negative', t.balance < 0);
    drawBarChart(t);
  });

  // Expense form
  $('#expenseForm').addEventListener('submit', addOrUpdateExpense);
  $('#cancelEditBtn').addEventListener('click', resetForm);

  // Expense table actions (event delegation)
  $('#expenseBody').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.closest('tr').dataset.id;
    const action = btn.dataset.action;
    if (action === 'toggle') togglePaid(id);
    else if (action === 'edit') startEdit(id);
    else if (action === 'delete') deleteExpense(id);
  });

  // Filters
  $$('[data-filter]').forEach(chip => chip.addEventListener('click', () => {
    filterPaid = chip.dataset.filter;
    $$('[data-filter]').forEach(c => c.classList.toggle('active', c === chip));
    renderExpenses();
  }));
  $$('[data-typefilter]').forEach(chip => chip.addEventListener('click', () => {
    filterType = chip.dataset.typefilter;
    $$('[data-typefilter]').forEach(c => c.classList.toggle('active', c === chip));
    renderExpenses();
  }));

  // History open
  $('#historyBody').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action="view"]');
    if (!btn) return;
    state.currentMonth = btn.closest('tr').dataset.month;
    save(); render();
    switchTab('dashboard');
  });

  // Settings
  $('#newMonthBtn').addEventListener('click', startNewMonth);
  $('#currencyInput').addEventListener('input', e => {
    state.currency = e.target.value || '$';
    save(); render();
  });
  $('#exportBtn').addEventListener('click', exportData);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  $('#clearMonthBtn').addEventListener('click', () => {
    if (confirm('Clear all expenses for ' + monthLabel(state.currentMonth) + '?')) {
      currentMonth().expenses = [];
      save(); render();
      toast('Month cleared');
    }
  });
  $('#resetAllBtn').addEventListener('click', () => {
    if (confirm('Delete ALL data? This cannot be undone.')) {
      localStorage.removeItem(STORE_KEY);
      state = defaultState();
      applyTheme();
      save(); render();
      toast('All data deleted');
    }
  });

  // Redraw charts on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderDashboard, 150);
  });
}

/* ============================== INIT ============================== */
function init() {
  applyTheme();
  bindEvents();
  render();

  // Register service worker for offline / PWA support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
