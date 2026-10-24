'use strict';

/* ===================== Datos ===================== */

const STORAGE_KEY = 'presupuesto.v1';
const FALLBACK_CAT = 'otros';
const SOON_DAYS = 3; // días antes del vencimiento en que un pago se marca como "pronto"

const PALETTE = ['#7c5cff', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#a78bfa', '#f97316', '#2dd4bf', '#94a3b8'];

const DEFAULT_CATEGORIES = [
  { id: 'vivienda', name: 'Vivienda', emoji: '🏠', color: '#7c5cff' },
  { id: 'servicios', name: 'Servicios', emoji: '💡', color: '#fbbf24' },
  { id: 'mercado', name: 'Mercado', emoji: '🛒', color: '#34d399' },
  { id: 'transporte', name: 'Transporte', emoji: '🚌', color: '#60a5fa' },
  { id: 'salud', name: 'Salud', emoji: '🩺', color: '#2dd4bf' },
  { id: 'deudas', name: 'Deudas', emoji: '💳', color: '#fb7185' },
  { id: 'educacion', name: 'Educación', emoji: '📚', color: '#a78bfa' },
  { id: 'comida', name: 'Comida fuera', emoji: '🍔', color: '#f97316' },
  { id: 'ocio', name: 'Ocio', emoji: '🎉', color: '#f472b6' },
  { id: 'ahorro', name: 'Ahorro', emoji: '🐷', color: '#22d3ee' },
  { id: FALLBACK_CAT, name: 'Otros', emoji: '📦', color: '#94a3b8' },
];

const EMOJIS = ['🏠','💡','💧','📱','🛒','🚌','⛽','🚗','🩺','💊','💳','📚','🍔','☕','🎉','🎬','👕','💇','🐶','👶','🎁','✈️','🏋️','🐷','💼','🧾','🔧','📦'];

const CURRENCIES = [
  { code: 'MXN', name: 'Peso mexicano', locale: 'es-MX', pesos: true },
  { code: 'COP', name: 'Peso colombiano', locale: 'es-CO', pesos: true },
  { code: 'ARS', name: 'Peso argentino', locale: 'es-AR', pesos: true },
  { code: 'CLP', name: 'Peso chileno', locale: 'es-CL', pesos: true },
  { code: 'DOP', name: 'Peso dominicano', locale: 'es-DO', pesos: true },
  { code: 'UYU', name: 'Peso uruguayo', locale: 'es-UY', pesos: true },
  { code: 'USD', name: 'Dólar', locale: 'es-US' },
  { code: 'EUR', name: 'Euro', locale: 'es-ES' },
  { code: 'PEN', name: 'Sol peruano', locale: 'es-PE' },
  { code: 'GTQ', name: 'Quetzal', locale: 'es-GT' },
];

const THEMES = [
  { id: 'nexora', name: 'Nexora', bar: '#0b0b1a', preview: 'linear-gradient(135deg,#6d4aff,#4f6bff,#22d3ee)' },
  { id: 'nexora-claro', name: 'Nexora claro', bar: '#f4f4fb', preview: 'linear-gradient(135deg,#f4f4fb 40%,#6d4aff)' },
  { id: 'esmeralda', name: 'Esmeralda', bar: '#08130f', preview: 'linear-gradient(135deg,#047857,#10b981,#a3e635)' },
  { id: 'dorado', name: 'Negro y dorado', bar: '#0a0a0a', preview: 'linear-gradient(135deg,#0a0a0a 30%,#d4a94f,#f5d98b)' },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultState() {
  return {
    version: 2,
    currency: 'MXN',
    theme: 'nexora',
    profile: { name: '', onboarded: false },
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    months: {},
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch (e) {
    console.error(e);
    return defaultState();
  }
}

function normalizeState(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.categories) || typeof s.months !== 'object') {
    throw new Error('Formato inválido');
  }
  if (!s.categories.some(c => c.id === FALLBACK_CAT)) {
    s.categories.push({ id: FALLBACK_CAT, name: 'Otros', emoji: '📦' });
  }
  s.categories.forEach((c, i) => {
    if (!c.color) c.color = (DEFAULT_CATEGORIES.find(d => d.id === c.id) || {}).color || PALETTE[i % PALETTE.length];
  });
  s.currency = s.currency || 'MXN';
  s.theme = THEMES.some(t => t.id === s.theme) ? s.theme : 'nexora';
  s.profile = s.profile || { name: '', onboarded: false };
  for (const key of Object.keys(s.months)) {
    const m = s.months[key];
    m.incomes = m.incomes || [];
    m.planned = m.planned || [];
    m.expenses = m.expenses || [];
  }
  s.version = 2;
  return s;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('No se pudo guardar: ' + e.message);
  }
}

let state = loadState();
let currentMonth = monthKey(new Date());
let currentView = 'inicio';
let expenseFilter = 'all';

function monthKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function getMonth(key = currentMonth, create = false) {
  let m = state.months[key];
  if (!m) {
    m = { incomes: [], planned: [], expenses: [] };
    if (create) state.months[key] = m;
  }
  return m;
}

function ensureMonth() {
  return getMonth(currentMonth, true);
}

function catById(id) {
  return state.categories.find(c => c.id === id) || state.categories.find(c => c.id === FALLBACK_CAT);
}

/* ===================== Utilidades ===================== */

const $ = sel => document.querySelector(sel);

function currencyInfo() {
  return CURRENCIES.find(c => c.code === state.currency) || { code: state.currency, locale: 'es' };
}

function money(n) {
  n = n || 0;
  const { code, locale } = currencyInfo();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2,
    }).format(n);
  } catch {
    return '$' + n.toFixed(2);
  }
}

// Versión corta para espacios pequeños: $4,5 M, $950 mil.
function moneyShort(n) {
  if (Math.abs(n) < 100000) return money(n);
  const { code, locale } = currencyInfo();
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code, notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return money(n);
  }
}

function sum(arr, f = x => x.amount) {
  return arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todayIso() {
  return isoDate(new Date());
}

// Fecha por defecto para un gasto del mes visible: hoy si es el mes actual, si no el día 1.
function defaultDateForMonth() {
  const t = todayIso();
  return t.startsWith(currentMonth) ? t : currentMonth + '-01';
}

function parseIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(iso) {
  return parseIso(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function dayHeading(iso) {
  const t = todayIso();
  if (iso === t) return 'Hoy';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === isoDate(y)) return 'Ayer';
  return parseIso(iso).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}

function parseAmount(v) {
  let s = String(v).replace(/[^\d.,]/g, '');
  // "1.500.000" o "1,500,000" → separadores de miles; el último separador con 1-2 decimales es decimal.
  const m = s.match(/^(.*)[.,](\d{1,2})$/);
  s = m ? m[1].replace(/[.,]/g, '') + '.' + m[2] : s.replace(/[.,]/g, '');
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function vibrate() {
  if (navigator.vibrate) navigator.vibrate(12);
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ===================== Cálculos ===================== */

function totals(m) {
  const income = sum(m.incomes);
  const planned = sum(m.planned);
  const spent = sum(m.expenses);
  const pending = sum(m.planned.filter(p => !p.paidExpenseId));
  const extras = sum(m.expenses.filter(e => !e.plannedId));
  // Cada categoría compromete lo proyectado, o lo gastado si ya se pasó del presupuesto.
  const committed = state.categories.reduce((acc, c) => {
    const p = sum(m.planned.filter(x => x.categoryId === c.id));
    const g = sum(m.expenses.filter(x => catById(x.categoryId).id === c.id));
    return acc + Math.max(p, g);
  }, 0);
  return { income, planned, spent, pending, extras, available: income - committed };
}

function spentByCategory(m) {
  return state.categories
    .map(c => ({ c, spent: sum(m.expenses.filter(e => catById(e.categoryId).id === c.id)) }))
    .filter(r => r.spent > 0)
    .sort((a, b) => b.spent - a.spent);
}

// Estado de un gasto proyectado según su día de pago.
function dueStatus(p, key = currentMonth) {
  if (p.paidExpenseId) return { cls: 'ok', text: 'Pagado', rank: 9 };
  const thisMonth = monthKey(new Date());
  if (key < thisMonth) return { cls: 'late', text: 'No se pagó', rank: 0 };
  if (!p.dueDay) return { cls: '', text: 'Sin fecha', rank: 5 };
  const day = Math.min(p.dueDay, daysInMonth(key));
  if (key > thisMonth) return { cls: '', text: 'Día ' + day, rank: 4 };
  const today = new Date().getDate();
  const diff = day - today;
  if (diff < 0) return { cls: 'late', text: diff === -1 ? 'Venció ayer' : `Atrasado ${-diff} días`, rank: 1, diff };
  if (diff === 0) return { cls: 'soon', text: 'Vence hoy', rank: 2, diff };
  if (diff <= SOON_DAYS) return { cls: 'soon', text: diff === 1 ? 'Vence mañana' : `Vence en ${diff} días`, rank: 3, diff };
  return { cls: '', text: 'Día ' + day, rank: 4, diff };
}

function sortPlanned(list, key) {
  return [...list].sort((a, b) => {
    const sa = dueStatus(a, key), sb = dueStatus(b, key);
    return sa.rank - sb.rank || (a.dueDay || 99) - (b.dueDay || 99);
  });
}

// Pagos atrasados o próximos a vencer del mes en curso (para la insignia).
function urgentCount() {
  const key = monthKey(new Date());
  return getMonth(key).planned.filter(p => dueStatus(p, key).rank <= 3).length;
}

/* ===================== Render ===================== */

function render() {
  applyTheme();
  const [y, mo] = currentMonth.split('-').map(Number);
  $('#monthLabel').textContent = capitalize(new Date(y, mo - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' }));
  renderHeader();
  renderInicio();
  renderPresupuesto();
  renderGastos();
  renderAnalisis();
  renderAjustes();
  const n = urgentCount();
  const badge = $('#dueBadge');
  badge.hidden = n === 0;
  badge.textContent = n;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const t = THEMES.find(x => x.id === state.theme);
  document.querySelector('meta[name="theme-color"]').content = t.bar;
}

function renderHeader() {
  const name = state.profile.name || 'Hola';
  const h = new Date().getHours();
  $('#helloTime').textContent = h < 12 ? 'Buenos días ☀️' : h < 19 ? 'Buenas tardes 🌤️' : 'Buenas noches 🌙';
  $('#helloName').textContent = name;
  const initial = (state.profile.name || '🙂').trim().charAt(0).toUpperCase();
  $('#avatar').textContent = initial;
  $('#avatarBig').textContent = initial;
}

function emptyItem(text) {
  return `<li class="empty">${esc(text)}</li>`;
}

function catIcon(c) {
  return `<span class="ico" style="--c:${esc(c.color)}">${esc(c.emoji)}</span>`;
}

function renderInicio() {
  const m = getMonth();
  const t = totals(m);

  const hero = $('#heroAvailable');
  hero.textContent = money(t.available);
  hero.classList.toggle('negative', t.available < 0);
  $('#heroIncome').textContent = money(t.income);
  $('#heroSpent').textContent = money(t.spent);
  const pct = t.income > 0 ? Math.round((t.spent / t.income) * 100) : 0;
  $('#heroBar').style.width = Math.min(pct, 100) + '%';
  $('#heroNote').textContent = t.income === 0
    ? 'Agrega tus ingresos en Presupuesto para empezar.'
    : t.available < 0
      ? `⚠️ Tu plan supera tus ingresos por ${money(-t.available)}.`
      : `Has usado el ${pct}% de tus ingresos · Por pagar: ${money(t.pending)}`;

  // Recordatorios: pagos pendientes ordenados por urgencia
  const pending = sortPlanned(m.planned.filter(p => !p.paidExpenseId), currentMonth).slice(0, 4);
  $('#remindersCard').hidden = m.planned.length === 0;
  $('#reminderList').innerHTML = pending.length ? pending.map(p => {
    const c = catById(p.categoryId);
    const st = dueStatus(p);
    return `<li>
      ${catIcon(c)}
      <div class="item-main" data-action="edit-planned" data-id="${esc(p.id)}">
        <div class="item-title">${esc(p.name)}</div>
        <div class="item-sub"><span class="status ${st.cls}">${esc(st.text)}</span>${money(p.amount)}</div>
      </div>
      <button class="pay-btn" data-action="toggle-paid" data-id="${esc(p.id)}">Pagar</button>
    </li>`;
  }).join('') : emptyItem('¡Todo pagado este mes! 🎉');

  // Dona
  const rows = spentByCategory(m);
  const total = sum(rows, r => r.spent);
  if (!rows.length) {
    $('#donut').innerHTML = '';
    $('#donut').hidden = true;
    $('#legend').innerHTML = '<li class="donut-empty">Aún no registras gastos este mes. Toca + para agregar uno.</li>';
  } else {
    $('#donut').hidden = false;
    const r = 52, circ = 2 * Math.PI * r;
    let offset = 0;
    const arcs = rows.map(({ c, spent }) => {
      const len = (spent / total) * circ;
      const gap = rows.length > 1 ? Math.min(3, len / 3) : 0;
      const arc = `<circle cx="70" cy="70" r="${r}" stroke="${esc(c.color)}" stroke-dasharray="${len - gap} ${circ - len + gap}" stroke-dashoffset="${-offset}"/>`;
      offset += len;
      return arc;
    }).join('');
    $('#donut').innerHTML = `<svg viewBox="0 0 140 140"><circle cx="70" cy="70" r="${r}" stroke="var(--surface-2)"/>${arcs}</svg>
      <div class="donut-center"><span>Gastado</span><strong>${money(total)}</strong></div>`;
    const top = rows.slice(0, 5);
    const rest = rows.slice(5);
    const legend = top.map(({ c, spent }) => ({ name: c.name, color: c.color, spent }));
    if (rest.length) legend.push({ name: 'Otras', color: '#64748b', spent: sum(rest, x => x.spent) });
    $('#legend').innerHTML = legend.map(l => `<li>
      <span class="swatch" style="background:${esc(l.color)}"></span>
      <span class="name">${esc(l.name)}</span>
      <span class="pct">${Math.round((l.spent / total) * 100)}%</span>
    </li>`).join('');
  }

  // Últimos movimientos
  const recent = [...m.expenses].sort(byDateDesc).slice(0, 4);
  $('#recentList').innerHTML = recent.length ? recent.map(expenseItem).join('') : emptyItem('Sin movimientos todavía.');
}

function byDateDesc(a, b) {
  return b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);
}

function expenseItem(e) {
  const c = catById(e.categoryId);
  return `<li>
    ${catIcon(c)}
    <div class="item-main" data-action="edit-expense" data-id="${esc(e.id)}">
      <div class="item-title">${esc(e.note || c.name)}</div>
      <div class="item-sub">${esc(c.name)} · ${esc(formatDate(e.date))}${e.plannedId ? '<span class="tag">fijo</span>' : ''}</div>
    </div>
    <span class="amount neg">−${money(e.amount)}</span>
  </li>`;
}

function plannedItem(p) {
  const c = catById(p.categoryId);
  const paid = !!p.paidExpenseId;
  const st = dueStatus(p);
  return `<li class="${paid ? 'paid' : ''}">
    <button class="check${paid ? ' on' : ''}" data-action="toggle-paid" data-id="${esc(p.id)}" aria-label="${paid ? 'Marcar como no pagado' : 'Marcar como pagado'}">${paid ? '✓' : ''}</button>
    <div class="item-main" data-action="edit-planned" data-id="${esc(p.id)}">
      <div class="item-title">${esc(c.emoji)} ${esc(p.name)}</div>
      <div class="item-sub"><span class="status ${st.cls}">${esc(st.text)}</span>${esc(c.name)}</div>
    </div>
    <span class="amount">${money(p.amount)}</span>
  </li>`;
}

function renderPresupuesto() {
  const m = getMonth();
  const income = sum(m.incomes), planned = sum(m.planned);
  $('#incomeTotal').textContent = moneyShort(income);
  $('#plannedTotal').textContent = moneyShort(planned);
  const free = $('#freeTotal');
  free.textContent = moneyShort(income - planned);
  free.className = income - planned < 0 ? 'neg' : '';

  $('#incomeList').innerHTML = m.incomes.length ? m.incomes.map(i => `<li>
      <span class="ico" style="--c:var(--income)">💰</span>
      <div class="item-main" data-action="edit-income" data-id="${esc(i.id)}"><div class="item-title">${esc(i.name)}</div></div>
      <span class="amount pos">${money(i.amount)}</span>
    </li>`).join('') : emptyItem('Agrega tu salario u otros ingresos.');

  $('#plannedList').innerHTML = m.planned.length
    ? sortPlanned(m.planned, currentMonth).map(plannedItem).join('')
    : emptyItem('Agrega lo que ya sabes que pagarás: renta, luz, internet, mercado…');
}

function renderGastos() {
  const m = getMonth();
  const used = new Set(m.expenses.map(e => catById(e.categoryId).id));
  const chips = [{ id: 'all', label: 'Todos' }, { id: 'extras', label: '✨ Adicionales' }]
    .concat(state.categories.filter(c => used.has(c.id)).map(c => ({ id: c.id, label: `${c.emoji} ${c.name}` })));
  if (!chips.some(c => c.id === expenseFilter)) expenseFilter = 'all';
  $('#filterChips').innerHTML = chips.map(c =>
    `<button class="chip${c.id === expenseFilter ? ' on' : ''}" data-filter="${esc(c.id)}">${esc(c.label)}</button>`).join('');

  let list = [...m.expenses];
  if (expenseFilter === 'extras') list = list.filter(e => !e.plannedId);
  else if (expenseFilter !== 'all') list = list.filter(e => catById(e.categoryId).id === expenseFilter);
  list.sort(byDateDesc);

  $('#expenseHead').textContent = `${list.length} movimiento${list.length === 1 ? '' : 's'}`;
  $('#expenseTotal').textContent = '−' + money(sum(list));

  if (!list.length) {
    $('#expenseGroups').innerHTML = `<ul class="list">${emptyItem('Toca el botón + para registrar un gasto.')}</ul>`;
    return;
  }
  const groups = [];
  for (const e of list) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }
  $('#expenseGroups').innerHTML = groups.map(g =>
    `<div class="date-head">${esc(capitalize(dayHeading(g.date)))}</div><ul class="list">${g.items.map(expenseItem).join('')}</ul>`).join('');
}

function renderAnalisis() {
  const m = getMonth();
  const t = totals(m);
  const thisMonth = monthKey(new Date());
  const dim = daysInMonth(currentMonth);
  const elapsed = currentMonth === thisMonth ? new Date().getDate() : currentMonth < thisMonth ? dim : 0;

  // Proyección: gastos fijos completos + gastos adicionales al ritmo actual.
  const dailyExtras = elapsed ? t.extras / elapsed : 0;
  $('#statDaily').textContent = elapsed ? money(Math.round(t.spent / elapsed)) : '—';
  $('#statProjection').textContent = elapsed ? money(Math.round(t.planned + dailyExtras * dim)) : money(t.planned);
  const top = spentByCategory(m)[0];
  $('#statTop').textContent = top ? `${top.c.emoji} ${top.c.name}` : '—';
  $('#statExtras').textContent = money(t.extras);

  // Barras de los últimos 6 meses (terminando en el mes visible)
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(currentMonth, i - 5));
  const data = months.map(k => {
    const mm = getMonth(k);
    return { k, income: sum(mm.incomes), spent: sum(mm.expenses) };
  });
  const max = Math.max(1, ...data.map(d => Math.max(d.income, d.spent)));
  $('#monthBars').innerHTML = data.map(d => {
    const [y, mo] = d.k.split('-').map(Number);
    const label = new Date(y, mo - 1, 1).toLocaleDateString('es', { month: 'short' }).replace('.', '');
    return `<div class="bar-group${d.k === currentMonth ? ' current' : ''}">
      <div class="bar-pair">
        <i class="in" style="height:${(d.income / max) * 100}%" title="${esc(money(d.income))}"></i>
        <i class="out" style="height:${(d.spent / max) * 100}%" title="${esc(money(d.spent))}"></i>
      </div>
      <span>${esc(label)}</span>
    </div>`;
  }).join('');

  // Presupuesto vs real por categoría
  const rows = state.categories.map(c => ({
    c,
    planned: sum(m.planned.filter(p => p.categoryId === c.id)),
    spent: sum(m.expenses.filter(e => catById(e.categoryId).id === c.id)),
  })).filter(r => r.planned > 0 || r.spent > 0)
    .sort((a, b) => b.spent - a.spent || b.planned - a.planned);

  $('#catSummary').innerHTML = rows.length ? rows.map(({ c, planned, spent }) => {
    const ratio = planned > 0 ? spent / planned : (spent > 0 ? 1.01 : 0);
    const cls = ratio > 1 ? ' over' : ratio > 0.85 ? ' warn' : '';
    const label = planned > 0 ? `${money(spent)} de ${money(planned)}` : `${money(spent)} · sin presupuesto`;
    return `<li>
      <div class="cat-head"><span>${esc(c.emoji)}</span><span class="name">${esc(c.name)}</span><span class="nums">${label}</span></div>
      <div class="bar"><div class="bar-fill${cls}" style="width:${Math.min(ratio * 100, 100)}%"></div></div>
    </li>`;
  }).join('') : '<li class="donut-empty">Aún no hay movimientos este mes.</li>';
}

function renderAjustes() {
  const nameInput = $('#profileName');
  if (document.activeElement !== nameInput) nameInput.value = state.profile.name || '';

  $('#themes').innerHTML = THEMES.map(t => `<button class="theme-opt${t.id === state.theme ? ' on' : ''}" data-theme-id="${t.id}">
      <i style="background:${t.preview}"></i>${esc(t.name)}
    </button>`).join('');

  $('#currency').innerHTML = CURRENCIES.map(c =>
    `<option value="${c.code}"${c.code === state.currency ? ' selected' : ''}>${esc(c.name)} (${c.code})</option>`).join('');

  $('#categoryList').innerHTML = state.categories.map(c => `<li>
      ${catIcon(c)}
      <div class="item-main" data-action="edit-category" data-id="${esc(c.id)}"><div class="item-title">${esc(c.name)}</div></div>
      <span class="muted">›</span>
    </li>`).join('');
}

/* ===================== Navegación ===================== */

function goto(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.goto === view));
  document.body.classList.toggle('in-settings', view === 'ajustes');
  $('#monthSwitch').hidden = view === 'ajustes';
  window.scrollTo({ top: 0 });
}

/* ===================== Hoja de formulario ===================== */

const sheet = $('#sheet');
let sheetSubmit = null;
let sheetDelete = null;

function openSheet({ title, body, onSubmit, onDelete, saveLabel = 'Guardar' }) {
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = body;
  $('#sheetSave').textContent = saveLabel;
  $('#sheetDelete').hidden = !onDelete;
  sheetSubmit = onSubmit;
  sheetDelete = onDelete;
  sheet.showModal();
  // El campo de monto crece con lo que se escribe para quedar centrado junto al "$".
  const amt = sheet.querySelector('.amount-field input');
  if (amt) {
    const fit = () => { amt.style.width = Math.max(2, amt.value.length + 0.5) + 'ch'; };
    amt.addEventListener('input', fit);
    fit();
  }
  const first = sheet.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 80);
}

function closeSheet() {
  sheet.close();
  sheetSubmit = sheetDelete = null;
}

$('#sheetForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!sheetSubmit) return closeSheet();
  const data = Object.fromEntries(new FormData(e.target));
  if (sheetSubmit(data) !== false) {
    vibrate();
    closeSheet();
    saveState();
    render();
  }
});
$('#sheetDelete').addEventListener('click', () => {
  if (sheetDelete && sheetDelete() !== false) {
    closeSheet();
    saveState();
    render();
  }
});
// Tocar fuera de la hoja la cierra.
sheet.addEventListener('click', e => {
  if (e.target === sheet) {
    const r = sheet.getBoundingClientRect();
    if (e.clientY < r.top) closeSheet();
  }
});

function field(label, html) {
  return `<div class="field"><label>${esc(label)}</label>${html}</div>`;
}

function amountInput(value) {
  return `<div class="amount-field"><span class="amount-prefix">$</span>` +
    `<input name="amount" inputmode="decimal" autocomplete="off" placeholder="0" size="6" required value="${value != null ? esc(value) : ''}" autofocus></div>`;
}

function catPicker(selected) {
  return `<div class="field"><span class="field-label">Categoría</span><div class="cat-grid">` +
    state.categories.map(c => `<label><input type="radio" name="categoryId" value="${esc(c.id)}"${c.id === selected ? ' checked' : ''}>` +
      `<span>${esc(c.emoji)}</span><span>${esc(c.name)}</span></label>`).join('') +
    `</div></div>`;
}

/* ----- Ingresos ----- */

function incomeForm(item) {
  openSheet({
    title: item ? 'Editar ingreso' : 'Nuevo ingreso',
    body: amountInput(item?.amount) +
      field('Concepto', `<input name="name" maxlength="60" placeholder="Salario, negocio, extra…" value="${esc(item?.name || '')}">`),
    onSubmit: d => {
      const amount = parseAmount(d.amount);
      if (!amount) return toast('Escribe un monto válido'), false;
      const name = d.name.trim() || 'Ingreso';
      const m = ensureMonth();
      if (item) Object.assign(item, { amount, name });
      else m.incomes.push({ id: uid(), name, amount });
      toast('Ingreso guardado 💰');
    },
    onDelete: item && (() => {
      const m = ensureMonth();
      m.incomes = m.incomes.filter(i => i.id !== item.id);
      toast('Ingreso eliminado');
    }),
  });
}

/* ----- Gastos proyectados ----- */

function plannedForm(item) {
  const paid = !!item?.paidExpenseId;
  openSheet({
    title: item ? 'Editar gasto fijo' : 'Nuevo gasto fijo',
    body: amountInput(item?.amount) +
      field('Concepto', `<input name="name" maxlength="60" placeholder="Renta, luz, internet…" required value="${esc(item?.name || '')}">`) +
      catPicker(item?.categoryId || 'vivienda') +
      field('Día de pago (para recordarte)', `<input name="dueDay" type="number" min="1" max="31" inputmode="numeric" placeholder="Ej. 5" value="${item?.dueDay || ''}">`),
    saveLabel: item ? 'Guardar' : 'Agregar',
    onSubmit: d => {
      const amount = parseAmount(d.amount);
      if (!amount) return toast('Escribe un monto válido'), false;
      const name = d.name.trim();
      if (!name) return toast('Escribe un concepto'), false;
      const categoryId = d.categoryId || FALLBACK_CAT;
      const dueDay = Math.min(31, Math.max(1, parseInt(d.dueDay, 10))) || null;
      const m = ensureMonth();
      if (item) {
        Object.assign(item, { amount, name, categoryId, dueDay });
        const linked = paid && m.expenses.find(e => e.id === item.paidExpenseId);
        if (linked) Object.assign(linked, { amount, categoryId, note: name });
      } else {
        m.planned.push({ id: uid(), name, amount, categoryId, dueDay, paidExpenseId: null });
      }
      toast('Gasto fijo guardado');
    },
    onDelete: item && (() => {
      const m = ensureMonth();
      if (item.paidExpenseId && !confirm('Este gasto ya está pagado. ¿Eliminar también el pago registrado?')) return false;
      m.expenses = m.expenses.filter(e => e.id !== item.paidExpenseId);
      m.planned = m.planned.filter(p => p.id !== item.id);
      toast('Gasto fijo eliminado');
    }),
  });
}

function togglePaid(id) {
  const m = ensureMonth();
  const p = m.planned.find(x => x.id === id);
  if (!p) return;
  if (p.paidExpenseId) {
    m.expenses = m.expenses.filter(e => e.id !== p.paidExpenseId);
    p.paidExpenseId = null;
    toast('Marcado como pendiente');
  } else {
    let date = defaultDateForMonth();
    if (!todayIso().startsWith(currentMonth) && p.dueDay) {
      date = currentMonth + '-' + String(Math.min(p.dueDay, daysInMonth(currentMonth))).padStart(2, '0');
    }
    const exp = { id: uid(), date, amount: p.amount, categoryId: p.categoryId, note: p.name, plannedId: p.id, createdAt: Date.now() };
    m.expenses.push(exp);
    p.paidExpenseId = exp.id;
    toast('¡Pagado! ✅');
  }
  vibrate();
  saveState();
  render();
}

/* ----- Gastos ----- */

function expenseForm(item) {
  const m = getMonth();
  const linked = item?.plannedId ? m.planned.find(p => p.id === item.plannedId) : null;
  openSheet({
    title: item ? 'Editar gasto' : 'Nuevo gasto',
    body: amountInput(item?.amount) +
      catPicker(item?.categoryId || 'mercado') +
      field('Descripción', `<input name="note" maxlength="80" placeholder="¿En qué gastaste?" value="${esc(item?.note || '')}">`) +
      field('Fecha', `<input name="date" type="date" required value="${esc(item?.date || defaultDateForMonth())}">`) +
      (linked ? `<p class="muted small">Este es el pago de tu gasto fijo “${esc(linked.name)}”.</p>` : ''),
    saveLabel: item ? 'Guardar' : 'Registrar gasto',
    onSubmit: d => {
      const amount = parseAmount(d.amount);
      if (!amount) return toast('Escribe un monto válido'), false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return toast('Elige una fecha'), false;
      const targetKey = d.date.slice(0, 7);
      const data = { amount, categoryId: d.categoryId || FALLBACK_CAT, note: d.note.trim(), date: d.date };

      if (item) {
        const src = ensureMonth();
        if (targetKey !== currentMonth && item.plannedId) {
          return toast('Un pago de gasto fijo debe quedar en este mes'), false;
        }
        Object.assign(item, data);
        if (targetKey !== currentMonth) {
          src.expenses = src.expenses.filter(e => e.id !== item.id);
          getMonth(targetKey, true).expenses.push(item);
          toast('Gasto movido a otro mes');
        } else {
          toast('Gasto actualizado');
        }
      } else {
        getMonth(targetKey, true).expenses.push({ id: uid(), ...data, plannedId: null, createdAt: Date.now() });
        toast(targetKey === currentMonth ? 'Gasto registrado 🧾' : 'Gasto registrado en otro mes');
      }
    },
    onDelete: item && (() => {
      const mm = ensureMonth();
      mm.expenses = mm.expenses.filter(e => e.id !== item.id);
      const p = mm.planned.find(x => x.paidExpenseId === item.id);
      if (p) p.paidExpenseId = null;
      toast('Gasto eliminado');
    }),
  });
}

/* ----- Categorías ----- */

function categoryForm(item) {
  const chosen = { emoji: item?.emoji || EMOJIS[0], color: item?.color || PALETTE[state.categories.length % PALETTE.length] };
  openSheet({
    title: item ? 'Editar categoría' : 'Nueva categoría',
    body: field('Nombre', `<input name="name" maxlength="30" required autofocus value="${esc(item?.name || '')}">`) +
      field('Ícono', `<div class="emoji-picker">${EMOJIS.map(em =>
        `<button type="button" data-emoji="${em}" class="${em === chosen.emoji ? 'on' : ''}">${em}</button>`).join('')}</div>`) +
      field('Color', `<div class="color-picker">${PALETTE.map(c =>
        `<button type="button" data-color="${c}" style="background:${c}" class="${c === chosen.color ? 'on' : ''}" aria-label="Color ${c}"></button>`).join('')}</div>`) +
      `<input type="hidden" name="emoji" value="${esc(chosen.emoji)}"><input type="hidden" name="color" value="${esc(chosen.color)}">`,
    onSubmit: d => {
      const name = d.name.trim();
      if (!name) return toast('Escribe un nombre'), false;
      if (item) Object.assign(item, { name, emoji: d.emoji, color: d.color });
      else state.categories.splice(state.categories.length - 1, 0, { id: uid(), name, emoji: d.emoji, color: d.color });
      toast('Categoría guardada');
    },
    onDelete: item && item.id !== FALLBACK_CAT && (() => {
      if (!confirm(`¿Eliminar “${item.name}”? Sus gastos pasarán a “Otros”.`)) return false;
      for (const m of Object.values(state.months)) {
        for (const x of [...m.planned, ...m.expenses]) if (x.categoryId === item.id) x.categoryId = FALLBACK_CAT;
      }
      state.categories = state.categories.filter(c => c.id !== item.id);
      toast('Categoría eliminada');
    }),
  });
  sheet.querySelectorAll('.emoji-picker, .color-picker').forEach(picker => picker.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    picker.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    if (b.dataset.emoji) sheet.querySelector('[name="emoji"]').value = b.dataset.emoji;
    if (b.dataset.color) sheet.querySelector('[name="color"]').value = b.dataset.color;
  }));
}

/* ===================== Bienvenida ===================== */

function startOnboarding() {
  const ob = $('#onboarding');
  ob.hidden = false;
  let step = 0;
  let currency = CURRENCIES.find(c => c.code === state.currency) ? state.currency : 'MXN';
  const show = n => {
    step = n;
    ob.querySelectorAll('.ob-step').forEach(s => s.classList.toggle('active', Number(s.dataset.step) === n));
    const input = ob.querySelector(`.ob-step[data-step="${n}"] input`);
    if (input) setTimeout(() => input.focus(), 100);
  };
  const renderCurrencies = () => {
    $('#obCurrency').innerHTML = CURRENCIES.filter(c => c.pesos || c.code === state.currency).map(c =>
      `<button type="button" data-code="${c.code}" class="${c.code === currency ? 'on' : ''}">${esc(c.name)} <small>${c.code}</small></button>`).join('');
  };
  renderCurrencies();
  const inc = $('#obIncome');
  inc.addEventListener('input', () => { inc.style.width = Math.max(2, inc.value.length + 0.5) + 'ch'; });
  $('#obCurrency').addEventListener('click', e => {
    const b = e.target.closest('[data-code]');
    if (!b) return;
    currency = b.dataset.code;
    renderCurrencies();
  });
  ob.querySelectorAll('[data-ob-next]').forEach(b => b.addEventListener('click', () => {
    if (step === 1 && !$('#obName').value.trim()) return toast('Escribe tu nombre');
    show(step + 1);
  }));
  ob.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      if (step === 3) $('#obFinish').click();
      else ob.querySelector(`.ob-step[data-step="${step}"] [data-ob-next]`).click();
    }
  });
  $('#obFinish').addEventListener('click', () => {
    state.profile = { name: $('#obName').value.trim() || 'Mauricio', onboarded: true };
    state.currency = currency;
    const income = parseAmount($('#obIncome').value);
    const m = getMonth(monthKey(new Date()), true);
    if (income && !m.incomes.length) m.incomes.push({ id: uid(), name: 'Salario', amount: income });
    saveState();
    render();
    ob.hidden = true;
    toast(`¡Bienvenido, ${state.profile.name}! 🎉`);
  });
}

/* ===================== Eventos ===================== */

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-goto]');
  if (nav) return goto(nav.dataset.goto);

  const chip = e.target.closest('[data-filter]');
  if (chip) {
    expenseFilter = chip.dataset.filter;
    return renderGastos();
  }

  const theme = e.target.closest('[data-theme-id]');
  if (theme) {
    state.theme = theme.dataset.themeId;
    saveState();
    return render();
  }

  const el = e.target.closest('[data-action]');
  if (!el) return;
  const id = el.dataset.id;
  const m = getMonth();
  switch (el.dataset.action) {
    case 'open-settings': return goto('ajustes');
    case 'add-expense': return expenseForm(null);
    case 'edit-expense': return expenseForm(m.expenses.find(x => x.id === id));
    case 'add-income': return incomeForm(null);
    case 'edit-income': return incomeForm(m.incomes.find(x => x.id === id));
    case 'add-planned': return plannedForm(null);
    case 'edit-planned': return plannedForm(m.planned.find(x => x.id === id));
    case 'toggle-paid': return togglePaid(id);
    case 'add-category': return categoryForm(null);
    case 'edit-category': return categoryForm(state.categories.find(x => x.id === id));
  }
});

$('#prevMonth').addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); render(); });
$('#nextMonth').addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, 1); render(); });

// Deslizar a los lados sobre el contenido cambia de mes.
let touchStart = null;
document.querySelector('main').addEventListener('touchstart', e => {
  const t = e.touches[0];
  touchStart = e.target.closest('.chips-scroll') ? null : { x: t.clientX, y: t.clientY };
}, { passive: true });
document.querySelector('main').addEventListener('touchend', e => {
  if (!touchStart || currentView === 'ajustes') return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
    currentMonth = shiftMonth(currentMonth, dx < 0 ? 1 : -1);
    render();
  }
}, { passive: true });

$('#profileName').addEventListener('input', e => {
  state.profile.name = e.target.value.trim();
  saveState();
  renderHeader();
});

$('#currency').addEventListener('change', e => {
  state.currency = e.target.value;
  saveState();
  render();
});

$('#copyPrev').addEventListener('click', () => {
  const prevKey = shiftMonth(currentMonth, -1);
  const prev = state.months[prevKey];
  if (!prev || (!prev.incomes.length && !prev.planned.length)) return toast('El mes anterior no tiene presupuesto');
  const m = ensureMonth();
  if ((m.incomes.length || m.planned.length) &&
      !confirm('Este mes ya tiene datos. ¿Agregar los ingresos y gastos fijos del mes anterior?')) return;
  m.incomes.push(...prev.incomes.map(i => ({ ...i, id: uid() })));
  m.planned.push(...prev.planned.map(p => ({ ...p, id: uid(), paidExpenseId: null })));
  saveState();
  render();
  toast('Presupuesto copiado');
});

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#exportJson').addEventListener('click', () => {
  download(`presupuesto-${todayIso()}.json`, JSON.stringify(state, null, 2), 'application/json');
});

$('#importJson').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = normalizeState(JSON.parse(await file.text()));
    if (!confirm('Esto reemplazará los datos actuales por los de la copia. ¿Continuar?')) return;
    state = data;
    state.profile.onboarded = true;
    saveState();
    render();
    toast('Copia restaurada');
  } catch {
    toast('El archivo no es una copia válida');
  }
});

$('#exportCsv').addEventListener('click', () => {
  const m = getMonth();
  if (!m.expenses.length) return toast('No hay gastos este mes');
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Fecha', 'Categoría', 'Descripción', 'Monto', 'Tipo']]
    .concat([...m.expenses].sort((a, b) => a.date.localeCompare(b.date)).map(e =>
      [e.date, catById(e.categoryId).name, e.note, e.amount.toFixed(2), e.plannedId ? 'Fijo' : 'Adicional']));
  download(`gastos-${currentMonth}.csv`, '﻿' + rows.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
});

$('#resetAll').addEventListener('click', () => {
  if (!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
  state = defaultState();
  saveState();
  location.reload();
});

// Al volver a la app (por ejemplo, al día siguiente) se actualizan saludo y recordatorios.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

render();
if (!state.profile.onboarded) startOnboarding();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
}
