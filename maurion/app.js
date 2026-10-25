'use strict';

/* ===================== Datos ===================== */

const STORAGE_KEY = 'presupuesto.v1';
const FALLBACK_CAT = 'otros';
const SOON_DAYS = 3; // días antes del vencimiento en que un pago se marca como "pronto"

const PALETTE = ['#2b7bef', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#fb7185', '#60a5fa', '#a78bfa', '#f97316', '#2dd4bf', '#94a3b8'];

const DEFAULT_CATEGORIES = [
  { id: 'vivienda', name: 'Vivienda', emoji: '🏠', color: '#2b7bef' },
  { id: 'servicios', name: 'Servicios', emoji: '💡', color: '#fbbf24' },
  { id: 'mercado', name: 'Mercado', emoji: '🛒', color: '#34d399' },
  { id: 'transporte', name: 'Transporte', emoji: '🚌', color: '#818cf8' },
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
  { code: 'COP', name: 'Peso colombiano', locale: 'es-CO', pesos: true },
  { code: 'MXN', name: 'Peso mexicano', locale: 'es-MX', pesos: true },
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
  { id: 'nexora', name: 'Nexora', bar: '#071433', preview: 'linear-gradient(120deg,#071433 25%,#2b7bef,#3fd3c6)' },
  { id: 'nexora-claro', name: 'Nexora claro', bar: '#f2f6fc', preview: 'linear-gradient(120deg,#ffffff 35%,#2b7bef,#3fd3c6)' },
  { id: 'esmeralda', name: 'Esmeralda', bar: '#08130f', preview: 'linear-gradient(135deg,#047857,#10b981,#a3e635)' },
  { id: 'dorado', name: 'Negro y dorado', bar: '#0a0a0a', preview: 'linear-gradient(135deg,#0a0a0a 30%,#d4a94f,#f5d98b)' },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultState() {
  return {
    version: 2,
    currency: 'COP',
    theme: 'nexora',
    profile: { name: '', onboarded: false },
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    months: {},
    tasks: [],
    reminders: [],
    notes: [],
    utils: { docs: [] },
    vehicles: [],
    fuel: [],
    accounts: defaultAccounts(),
    transfers: [],
    settings: { outlook: 'personal', rollover: true, badge: false },
    security: { pinHash: null, salt: null, credId: null, lockAfter: 1 },
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
  s.currency = s.currency || 'COP';
  s.theme = THEMES.some(t => t.id === s.theme) ? s.theme : 'nexora';
  s.profile = s.profile || { name: '', onboarded: false };
  for (const key of Object.keys(s.months)) {
    const m = s.months[key];
    m.incomes = m.incomes || [];
    m.planned = m.planned || [];
    m.expenses = m.expenses || [];
  }
  s.tasks = Array.isArray(s.tasks) ? s.tasks : [];
  s.reminders = Array.isArray(s.reminders) ? s.reminders : [];
  s.notes = Array.isArray(s.notes) ? s.notes : [];
  s.utils = { docs: Array.isArray(s.utils?.docs) ? s.utils.docs : [] };
  s.vehicles = Array.isArray(s.vehicles) ? s.vehicles : [];
  s.fuel = Array.isArray(s.fuel) ? s.fuel : [];
  s.settings = { outlook: 'personal', rollover: true, badge: false, ...(s.settings || {}) };
  s.security = { pinHash: null, salt: null, credId: null, lockAfter: 1, ...(s.security || {}) };
  // Migración: antes cada gasto tenía solo una forma de pago; ahora pertenece a una cuenta.
  if (!Array.isArray(s.accounts)) {
    s.accounts = defaultAccounts();
    for (const m of Object.values(s.months)) {
      (m.incomes || []).forEach(i => { if (!i.accountId) i.accountId = 'debito'; });
      (m.expenses || []).forEach(e => {
        if (!e.accountId) e.accountId = e.method || 'debito';
        if (e.cardPayment && !e.toAccountId) e.toAccountId = 'credito';
      });
    }
    (s.fuel || []).forEach(f => { if (!f.accountId) f.accountId = f.method || 'debito'; });
    s.settings.defaultAccount = s.settings.defaultMethod || 'debito';
  }
  s.transfers = Array.isArray(s.transfers) ? s.transfers : [];
  s.version = 3;
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
let currentView = 'hub';
let finSub = 'resumen';
let agendaSub = 'tareas';
let taskFilter = 'pendientes';
let noteQuery = '';
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
function toast(msg, actions = []) {
  const el = $('#toast');
  el.textContent = msg;
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = 'toast-btn';
    b.textContent = a.label;
    b.addEventListener('click', () => { el.classList.remove('show'); a.onClick(); });
    el.appendChild(b);
  }
  el.classList.toggle('has-actions', actions.length > 0);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), actions.length ? 5000 : 2200);
}

/* ===================== Cálculos ===================== */

function hasData(m) {
  return !!m && (m.incomes.length > 0 || m.expenses.length > 0 || m.planned.length > 0);
}

// Lo que sobró del mes anterior (ingresos − gastos reales), editable por mes.
function carryInfo(key) {
  if (!state.settings.rollover) return null;
  const m = state.months[key];
  const ov = m && m.carry;
  if (ov && ov.off) return null;
  const prevKey = shiftMonth(key, -1);
  const first = Object.keys(state.months).filter(k => hasData(state.months[k])).sort()[0];
  if (!first || prevKey < first) return null;
  const auto = Math.round((incomeTotal(prevKey) - sum(getMonth(prevKey).expenses.filter(isCash))) * 100) / 100;
  const manual = ov && ov.amount != null;
  const amount = manual ? ov.amount : auto;
  if (!amount && !manual) return null;
  return { amount, auto, manual, prevKey };
}

function incomeTotal(key) {
  const c = carryInfo(key);
  return sum(getMonth(key).incomes) + (c ? c.amount : 0);
}

function monthName(key) {
  const [y, mo] = key.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('es', { month: 'long' });
}

/* ----- Cuentas: efectivo, tarjetas débito y tarjetas crédito ----- */

const ACCOUNT_TYPES = {
  efectivo: { icon: '💵', label: 'Efectivo' },
  debito: { icon: '🏦', label: 'Tarjeta débito' },
  credito: { icon: '💳', label: 'Tarjeta crédito' },
};
const BANKS = [
  ['Bancolombia', '#fdda24'], ['Nequi', '#da0081'], ['Davivienda', '#ed1c27'], ['Daviplata', '#ef4444'],
  ['BBVA', '#1464a5'], ['Banco de Bogotá', '#0a4b8c'], ['Nu', '#820ad1'], ['Falabella', '#1d8a3c'],
  ['Caja Social', '#0060a8'], ['AV Villas', '#e30613'], ['Colpatria', '#ec111a'], ['Itaú', '#ec7000'],
  ['Lulo Bank', '#b5d000'], ['Banco Popular', '#00843d'], ['Occidente', '#0047ba'],
];

function defaultAccounts() {
  return [
    { id: 'efectivo', name: 'Efectivo', type: 'efectivo', initial: 0, color: '#34d399' },
    { id: 'debito', name: 'Tarjeta débito', type: 'debito', initial: 0, color: '#2b7bef' },
    { id: 'credito', name: 'Tarjeta crédito', type: 'credito', initial: 0, limit: null, color: '#fbbf24' },
  ];
}

function accountById(id) {
  return state.accounts.find(a => a.id === id);
}

function defaultAccountId() {
  const id = state.settings.defaultAccount;
  if (accountById(id)) return id;
  return (state.accounts.find(a => a.type === 'debito') || state.accounts.find(a => a.type !== 'credito') || state.accounts[0])?.id;
}

function accountOf(e) {
  return accountById(e.accountId) || accountById(e.method) || null;
}

function methodOf(e) {
  return accountOf(e)?.type || e.method || 'debito';
}

// Efectivo y débito salen de tu dinero; lo de tarjeta crédito queda como deuda de esa tarjeta.
function isCash(e) {
  return methodOf(e) !== 'credito';
}

function accountTag(e) {
  const a = accountOf(e);
  if (!a) return '';
  const short = { efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito' }[a.type];
  const label = a.type === 'efectivo' && a.name === 'Efectivo' ? short : `${short} · ${a.name}`;
  return `<span class="acc-tag" style="--c:${esc(a.color)}">${ACCOUNT_TYPES[a.type].icon} ${esc(label)}</span>`;
}

// Primero el tipo (efectivo, débito o crédito) y luego el banco de ese tipo.
function accountPicker(selected, { noCredit = false, label = '¿Cómo pagaste?' } = {}) {
  const list = state.accounts.filter(a => !noCredit || a.type !== 'credito');
  const sel = list.some(a => a.id === selected) ? selected : (list.find(a => a.id === defaultAccountId()) || list[0])?.id;
  const selType = accountById(sel)?.type || 'debito';
  const types = Object.keys(ACCOUNT_TYPES).filter(t => !noCredit || t !== 'credito');
  const short = { efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito' };
  return `<div class="field acc2"><span class="field-label">${esc(label)}</span>` +
    `<div class="seg-pick acc-types">` + types.map(t =>
      `<label><input type="radio" name="accType" value="${t}"${t === selType ? ' checked' : ''}>${ACCOUNT_TYPES[t].icon} ${short[t]}</label>`).join('') + `</div>` +
    `<span class="field-label acc-bank-label">¿De qué banco?</span>` +
    `<div class="acc-pick acc-banks">` + list.map(a =>
      `<label data-type="${a.type}" style="--c:${esc(a.color)}"${a.type === selType ? '' : ' hidden'}><input type="radio" name="accountId" value="${esc(a.id)}"${a.id === sel ? ' checked' : ''}>` +
      `<span>${ACCOUNT_TYPES[a.type].icon}</span><span>${esc(a.name)}</span></label>`).join('') + `</div>` +
    `<p class="muted small acc-hint" hidden></p></div>`;
}

function syncAccountPicker(box) {
  const type = box.querySelector('[name="accType"]:checked')?.value;
  const labels = [...box.querySelectorAll('.acc-banks label')];
  labels.forEach(l => { l.hidden = l.dataset.type !== type; });
  const visible = labels.filter(l => !l.hidden);
  const checked = box.querySelector('[name="accountId"]:checked');
  if (!checked || checked.closest('label').hidden) {
    if (checked) checked.checked = false;
    if (visible[0]) visible[0].querySelector('input').checked = true;
  }
  // Si solo hay una cuenta de efectivo no hace falta preguntar el banco
  box.querySelector('.acc-bank-label').hidden = type === 'efectivo' && visible.length <= 1;
  box.querySelector('.acc-banks').hidden = !visible.length || (type === 'efectivo' && visible.length <= 1);
  const hint = box.querySelector('.acc-hint');
  hint.hidden = visible.length > 0;
  hint.textContent = type === 'credito' ? 'No tienes tarjetas de crédito registradas. Agrégala en Finanzas → Mis cuentas → + Cuenta.'
    : 'No tienes cuentas de este tipo. Agrégala en Finanzas → Mis cuentas → + Cuenta.';
}

document.addEventListener('change', e => {
  if (e.target.name === 'accType') syncAccountPicker(e.target.closest('.acc2'));
});

// Saldo de una cuenta (en las de crédito es lo que se debe).
function accountBalance(acc, withInitial = true) {
  let b = withInitial ? acc.initial || 0 : 0;
  for (const m of Object.values(state.months)) {
    if (acc.type !== 'credito') for (const i of m.incomes) if (i.accountId === acc.id) b += i.amount;
    for (const e of m.expenses) {
      if (e.accountId === acc.id) b += acc.type === 'credito' ? e.amount : -e.amount;
      if (e.cardPayment && e.toAccountId === acc.id) b -= e.amount;
    }
  }
  for (const t of state.transfers) {
    if (t.from === acc.id) b -= t.amount;
    if (t.to === acc.id) b += t.amount;
  }
  return Math.round(b * 100) / 100;
}

function cardDebt() {
  return sum(state.accounts.filter(a => a.type === 'credito'), a => accountBalance(a));
}

function accountMovements(acc) {
  const list = [];
  for (const m of Object.values(state.months)) {
    if (acc.type !== 'credito') for (const i of m.incomes) if (i.accountId === acc.id) list.push({ date: null, label: '💰 ' + i.name, amount: i.amount });
    for (const e of m.expenses) {
      if (e.accountId === acc.id) list.push({ date: e.date, label: `${catById(e.categoryId).emoji} ${e.note || catById(e.categoryId).name}`, amount: acc.type === 'credito' ? e.amount : -e.amount });
      if (e.cardPayment && e.toAccountId === acc.id) list.push({ date: e.date, label: '✅ Pago a la tarjeta', amount: -e.amount });
    }
  }
  for (const t of state.transfers) {
    if (t.from === acc.id) list.push({ date: t.date, label: `↔ A ${accountById(t.to)?.name || 'otra cuenta'}`, amount: -t.amount });
    if (t.to === acc.id) list.push({ date: t.date, label: `↔ Desde ${accountById(t.from)?.name || 'otra cuenta'}`, amount: t.amount });
  }
  return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function renderAccounts() {
  const cash = state.accounts.filter(a => a.type !== 'credito');
  const credit = state.accounts.filter(a => a.type === 'credito');
  const row = a => {
    const bal = accountBalance(a);
    const sub = a.type === 'credito'
      ? (a.limit ? `Cupo disponible ${money(a.limit - bal)}` : 'Lo que debes')
      : ACCOUNT_TYPES[a.type].label;
    return `<li>
      <span class="ico acc-ico" style="--c:${esc(a.color)}">${ACCOUNT_TYPES[a.type].icon}</span>
      <div class="item-main" data-action="open-account" data-id="${esc(a.id)}">
        <div class="item-title">${esc(a.name)}</div>
        <div class="item-sub">${esc(sub)}</div>
      </div>
      <span class="amount ${a.type === 'credito' ? (bal > 0 ? 'neg' : '') : bal < 0 ? 'neg' : 'pos'}">${(a.type === 'credito' ? bal > 0 : bal < 0) ? '−' : ''}${money(Math.abs(bal))}</span>
    </li>`;
  };
  $('#accountsList').innerHTML = cash.map(row).join('') + (credit.length ? `<li class="acc-sep">Tarjetas de crédito</li>` + credit.map(row).join('') : '');
  $('#accountsTotal').textContent = money(sum(cash, a => accountBalance(a)));
  const debt = cardDebt();
  $('#accountsDebt').textContent = debt > 0 ? `Debes en tarjetas: ${money(debt)}` : '';
}

function accountSheet(acc) {
  const bal = accountBalance(acc);
  const moves = accountMovements(acc).slice(0, 12);
  const extra = [{ label: '✏️ Editar cuenta', onClick: () => accountForm(acc) }];
  if (acc.type === 'credito') extra.unshift({ label: '💳 Pagar esta tarjeta', onClick: () => payCardForm(acc.id) });
  else extra.unshift({ label: '↔ Mover dinero', onClick: () => transferForm(acc.id) });
  openSheet({
    title: `${ACCOUNT_TYPES[acc.type].icon} ${acc.name}`,
    body: `<div class="acc-balance"><span class="muted small">${acc.type === 'credito' ? 'Deuda actual' : 'Saldo actual'}</span>
        <strong class="${acc.type === 'credito' ? (bal > 0 ? 'neg' : '') : bal < 0 ? 'neg' : 'pos'}">${money(bal)}</strong>
        ${acc.type === 'credito' && acc.limit ? `<span class="muted small">Cupo ${money(acc.limit)} · disponible ${money(acc.limit - bal)}</span>` : ''}</div>
      <div class="group-title" style="margin:14px 4px 4px">Últimos movimientos</div>
      <ul class="list">${moves.length ? moves.map(mv => `<li>
        <div class="item-main"><div class="item-title">${esc(mv.label)}</div><div class="item-sub">${mv.date ? esc(formatDate(mv.date)) : 'Ingreso'}</div></div>
        <span class="amount ${mv.amount >= 0 === (acc.type !== 'credito') ? 'pos' : 'neg'}">${mv.amount >= 0 ? '+' : '−'}${money(Math.abs(mv.amount))}</span>
      </li>`).join('') : emptyItem('Sin movimientos todavía.')}</ul>`,
    extra,
  });
}

function accountForm(item) {
  const v = item || { name: '', type: 'debito', color: PALETTE[state.accounts.length % PALETTE.length], limit: null };
  const current = item ? accountBalance(item) : '';
  openSheet({
    title: item ? 'Editar cuenta' : 'Nueva cuenta',
    body: (item ? '' : `<div class="presets">${BANKS.map(([n], i) => `<button type="button" class="chip" data-bank="${i}">${esc(n)}</button>`).join('')}</div>`) +
      field('Nombre', `<input name="name" class="big-input" maxlength="40" placeholder="Ej. Bancolombia, Nequi, Visa Davivienda" required value="${esc(v.name)}"${item ? '' : ' autofocus'}>`) +
      `<div class="field"><span class="field-label">Tipo</span><div class="seg-pick">` +
        Object.entries(ACCOUNT_TYPES).map(([k, t]) => `<label><input type="radio" name="type" value="${k}"${v.type === k ? ' checked' : ''}>${t.icon} ${t.label}</label>`).join('') +
      `</div></div>` +
      `<div class="field-row">` +
        field('Saldo actual / deuda actual', `<input name="balance" inputmode="decimal" placeholder="$ 0" value="${current === '' ? '' : esc(current)}">`) +
        `<div class="field" id="limitField">${'<label>Cupo total (crédito)</label>'}<input name="limit" inputmode="decimal" placeholder="Opcional" value="${v.limit ? esc(v.limit) : ''}"></div>` +
      `</div>` +
      `<p class="muted small" style="margin:-6px 0 12px">En débito y efectivo es lo que tienes hoy; en tarjeta crédito es lo que debes hoy.</p>` +
      `<input type="hidden" name="color" value="${esc(v.color)}">`,
    saveLabel: item ? 'Guardar' : 'Agregar cuenta',
    onSubmit: d => {
      const name = d.name.trim();
      if (!name) return toast('Ponle un nombre a la cuenta'), false;
      const bank = BANKS.find(([n]) => normalizeText(name).includes(normalizeText(n)));
      const acc = item || { id: uid(), initial: 0 };
      Object.assign(acc, { name, type: d.type, color: bank ? bank[1] : d.color, limit: d.type === 'credito' ? parseAmount(d.limit) : null });
      const wanted = String(d.balance).trim() === '' ? null : (String(d.balance).trim().startsWith('-') ? -1 : 1) * (parseAmount(String(d.balance).replace('-', '')) || 0);
      if (!item) state.accounts.push(acc);
      if (wanted != null) acc.initial = Math.round((wanted - accountBalance(acc, false)) * 100) / 100;
      toast(item ? 'Cuenta actualizada' : `${ACCOUNT_TYPES[acc.type].icon} ${name} agregada`);
    },
    onDelete: item && state.accounts.length > 1 && (() => {
      const target = state.accounts.find(a => a.id !== item.id && a.type !== 'credito') || state.accounts.find(a => a.id !== item.id);
      if (!confirm(`¿Eliminar ${item.name}? Sus movimientos pasarán a “${target.name}”.`)) return false;
      for (const m of Object.values(state.months)) {
        for (const x of [...m.incomes, ...m.expenses]) {
          if (x.accountId === item.id) x.accountId = target.id;
          if (x.toAccountId === item.id) x.toAccountId = target.id;
        }
      }
      state.fuel.forEach(f => { if (f.accountId === item.id) f.accountId = target.id; });
      state.transfers = state.transfers.filter(t => t.from !== item.id && t.to !== item.id);
      state.accounts = state.accounts.filter(a => a.id !== item.id);
      if (state.settings.defaultAccount === item.id) state.settings.defaultAccount = target.id;
      toast('Cuenta eliminada');
    }),
  });
  const sync = () => { $('#limitField').style.visibility = $('#sheetForm').type.value === 'credito' ? 'visible' : 'hidden'; };
  sheet.querySelectorAll('[name="type"]').forEach(r => r.addEventListener('change', sync));
  sync();
  sheet.querySelector('.presets')?.addEventListener('click', e => {
    const b = e.target.closest('[data-bank]');
    if (!b) return;
    const [name, color] = BANKS[b.dataset.bank];
    const f = $('#sheetForm');
    f.name.value = name;
    f.color.value = color;
    if (/nequi|daviplata/i.test(name)) f.type.value = 'debito';
    sheet.querySelectorAll('[data-bank]').forEach(x => x.classList.toggle('on', x === b));
    f.balance.focus();
  });
}

function payCardForm(creditId) {
  const cards = state.accounts.filter(a => a.type === 'credito');
  if (!cards.length) return toast('No tienes tarjetas de crédito registradas');
  const card = accountById(creditId) || cards.find(a => accountBalance(a) > 0) || cards[0];
  const debt = accountBalance(card);
  openSheet({
    title: `💳 Pagar ${card.name}`,
    body: amountInput(debt > 0 ? debt : null) +
      `<p class="muted small" style="text-align:center;margin:-6px 0 14px">Debes ${money(debt)}. Puedes pagar todo o una parte.</p>` +
      accountPicker(defaultAccountId(), { noCredit: true, label: '¿Desde qué cuenta pagas?' }) +
      field('Fecha', `<input name="date" type="date" required value="${esc(defaultDateForMonth())}">`),
    saveLabel: 'Registrar pago',
    onSubmit: d => {
      const amount = parseAmount(d.amount);
      if (!amount) return toast('Escribe un monto válido'), false;
      getMonth(d.date.slice(0, 7), true).expenses.push({
        id: uid(), amount, categoryId: 'deudas', note: `Pago ${card.name}`, date: d.date,
        accountId: d.accountId, toAccountId: card.id, cardPayment: true, plannedId: null, createdAt: Date.now(),
      });
      toast('Pago de tarjeta registrado 💳');
    },
  });
}

function transferForm(fromId) {
  const list = state.accounts.filter(a => a.type !== 'credito');
  if (list.length < 2) return toast('Agrega al menos dos cuentas (por ejemplo Bancolombia y Efectivo)');
  const from = list.some(a => a.id === fromId) ? fromId : list[0].id;
  const to = list.find(a => a.id !== from).id;
  const pick = (name, sel, label) => `<div class="field"><span class="field-label">${label}</span><div class="acc-pick">` +
    list.map(a => `<label style="--c:${esc(a.color)}"><input type="radio" name="${name}" value="${esc(a.id)}"${a.id === sel ? ' checked' : ''}><span>${ACCOUNT_TYPES[a.type].icon}</span><span>${esc(a.name)}</span></label>`).join('') +
    `</div></div>`;
  openSheet({
    title: '↔ Mover dinero',
    body: amountInput(null) + pick('from', from, 'Sale de') + pick('to', to, 'Llega a') +
      `<p class="muted small" style="margin:-6px 0 12px">Ej.: retiro en cajero (Bancolombia → Efectivo) o pasar a Nequi. No cuenta como gasto.</p>` +
      field('Fecha', `<input name="date" type="date" required value="${esc(todayIso())}">`),
    saveLabel: 'Mover',
    onSubmit: d => {
      const amount = parseAmount(d.amount);
      if (!amount) return toast('Escribe un monto válido'), false;
      if (d.from === d.to) return toast('Elige cuentas diferentes'), false;
      state.transfers.push({ id: uid(), from: d.from, to: d.to, amount, date: d.date, createdAt: Date.now() });
      toast(`↔ ${money(amount)}: ${accountById(d.from).name} → ${accountById(d.to).name}`);
    },
  });
}

function totals(m, key = currentMonth) {
  const income = incomeTotal(key);
  const planned = sum(m.planned);
  const cash = m.expenses.filter(isCash);
  const spent = sum(cash);
  const credit = sum(m.expenses.filter(e => !isCash(e)));
  const pending = sum(m.planned.filter(p => !p.paidExpenseId));
  const extras = sum(cash.filter(e => !e.plannedId));
  // Cada categoría compromete lo proyectado, o lo pagado (efectivo/débito) si ya se pasó del presupuesto.
  const committed = state.categories.reduce((acc, c) => {
    const p = sum(m.planned.filter(x => x.categoryId === c.id));
    const g = sum(cash.filter(x => catById(x.categoryId).id === c.id));
    return acc + Math.max(p, g);
  }, 0);
  return { income, planned, spent, credit, pending, extras, available: income - committed };
}

// Consumo por categoría (incluye compras con crédito; no cuenta los pagos de la tarjeta para no duplicar).
function spentByCategory(m) {
  return state.categories
    .map(c => ({ c, spent: sum(m.expenses.filter(e => !e.cardPayment && catById(e.categoryId).id === c.id)) }))
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
  renderHub();
  renderInicio();
  renderPresupuesto();
  renderGastos();
  renderAnalisis();
  renderTasks();
  renderReminders();
  renderNotes();
  renderUtils();
  renderAjustes();
  renderSecurity();
  const n = urgentCount();
  $('#dueBadge').hidden = n === 0;
  setBadge('#finBadge', n);
  setBadge('#agendaBadge', agendaUrgentCount());
  updateAppBadge(n + agendaUrgentCount());
}

function setBadge(sel, n) {
  const b = $(sel);
  b.hidden = n === 0;
  b.textContent = n;
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

  renderAccounts();

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
      <div class="item-sub">${esc(c.name)} · ${esc(formatDate(e.date))}${e.plannedId ? '<span class="tag">fijo</span>' : ''} ${accountTag(e)}</div>
    </div>
    <span class="amount ${isCash(e) ? 'neg' : 'credit'}">−${money(e.amount)}</span>
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
  const income = incomeTotal(currentMonth), planned = sum(m.planned);
  $('#incomeTotal').textContent = moneyShort(income);
  $('#plannedTotal').textContent = moneyShort(planned);
  const free = $('#freeTotal');
  free.textContent = moneyShort(income - planned);
  free.className = income - planned < 0 ? 'neg' : '';

  const c = carryInfo(currentMonth);
  const carryRow = c ? `<li>
      <span class="ico" style="--c:var(--accent)">🐷</span>
      <div class="item-main" data-action="edit-carry">
        <div class="item-title">${c.amount < 0 ? 'Faltante de' : 'Ahorro de'} ${esc(monthName(c.prevKey))}</div>
        <div class="item-sub">${c.manual ? 'Editado por ti' : 'Automático'}</div>
      </div>
      <span class="amount ${c.amount < 0 ? 'neg' : 'pos'}">${money(c.amount)}</span>
      <span class="edit-ico">✏️</span>
    </li>` : '';
  $('#incomeList').innerHTML = (m.incomes.length || c) ? carryRow + m.incomes.map(i => `<li>
      <span class="ico" style="--c:var(--income)">💰</span>
      <div class="item-main" data-action="edit-income" data-id="${esc(i.id)}"><div class="item-title">${esc(i.name)}</div><div class="item-sub">Toca para editar</div></div>
      <span class="amount pos">${money(i.amount)}</span>
      <span class="edit-ico" data-action="edit-income" data-id="${esc(i.id)}">✏️</span>
    </li>`).join('') : emptyItem('Agrega tu salario u otros ingresos.');

  $('#plannedList').innerHTML = m.planned.length
    ? sortPlanned(m.planned, currentMonth).map(plannedItem).join('')
    : emptyItem('Agrega lo que ya sabes que pagarás: renta, luz, internet, mercado…');
}

function renderGastos() {
  const m = getMonth();
  const used = new Set(m.expenses.map(e => catById(e.categoryId).id));
  const chips = [{ id: 'all', label: 'Todos' }, { id: 'extras', label: '✨ Adicionales' }, { id: 'credito', label: '💳 Crédito' }, { id: 'efectivo', label: '💵 Efectivo' }]
    .concat(state.categories.filter(c => used.has(c.id)).map(c => ({ id: c.id, label: `${c.emoji} ${c.name}` })));
  if (!chips.some(c => c.id === expenseFilter)) expenseFilter = 'all';
  $('#filterChips').innerHTML = chips.map(c =>
    `<button class="chip${c.id === expenseFilter ? ' on' : ''}" data-filter="${esc(c.id)}">${esc(c.label)}</button>`).join('');

  let list = [...m.expenses];
  if (expenseFilter === 'extras') list = list.filter(e => !e.plannedId);
  else if (expenseFilter === 'credito' || expenseFilter === 'efectivo') list = list.filter(e => methodOf(e) === expenseFilter);
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
    return { k, income: Math.max(0, incomeTotal(k)), spent: sum(mm.expenses.filter(isCash)) };
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
  $('#outlookType').value = state.settings.outlook;
  $('#defaultAccount').innerHTML = state.accounts.map(a => `<option value="${esc(a.id)}">${ACCOUNT_TYPES[a.type].icon} ${esc(a.name)}</option>`).join('');
  $('#defaultAccount').value = defaultAccountId();
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

function goto(view, sub) {
  currentView = view;
  if (view === 'finanzas' && sub) finSub = sub;
  if (view === 'agenda' && sub) agendaSub = sub;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.goto === view));
  document.body.classList.toggle('in-settings', view === 'ajustes');
  showSub('#finSeg', 'fin-', finSub);
  showSub('#agendaSeg', 'ag-', agendaSub);
  window.scrollTo({ top: 0 });
}

function showSub(segSel, prefix, sub) {
  $(segSel).querySelectorAll('[data-sub]').forEach(b => b.classList.toggle('on', b.dataset.sub === sub));
  document.querySelectorAll(`[id^="${prefix}"]`).forEach(v => v.classList.toggle('active', v.id === prefix + sub));
}

/* ===================== Hoja de formulario ===================== */

const sheet = $('#sheet');
let sheetSubmit = null;
let sheetDelete = null;
let afterSheet = null; // acción a ejecutar después de guardar y cerrar (p. ej. abrir el calendario)

function openSheet({ title, body, onSubmit, onDelete, saveLabel = 'Guardar', extra = [] }) {
  if (sheet.open) sheet.close();
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = body;
  $('#sheetSave').textContent = saveLabel;
  $('#sheetSave').hidden = !onSubmit;
  $('#sheetDelete').hidden = !onDelete;
  const extraBox = $('#sheetExtra');
  extraBox.innerHTML = '';
  for (const x of extra) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn soft' + (x.html ? ' cal-btn' : '');
    if (x.html) b.innerHTML = x.html; else b.textContent = x.label;
    b.addEventListener('click', x.onClick);
    extraBox.appendChild(b);
  }
  sheetSubmit = onSubmit;
  sheetDelete = onDelete;
  sheet.querySelectorAll('.acc2').forEach(syncAccountPicker);
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
    const next = afterSheet;
    afterSheet = null;
    if (next) setTimeout(next, 150);
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
      field('Concepto', `<input name="name" maxlength="60" placeholder="Salario, negocio, extra…" value="${esc(item?.name || '')}">`) +
      accountPicker(item?.accountId, { noCredit: true, label: '¿A qué cuenta llega?' }),
    onSubmit: d => {
      const amount = parseAmount(d.amount);
      if (!amount) return toast('Escribe un monto válido'), false;
      if (!d.accountId) return toast('Elige a qué cuenta llega'), false;
      const name = d.name.trim() || 'Ingreso';
      const m = ensureMonth();
      if (item) Object.assign(item, { amount, name, accountId: d.accountId });
      else m.incomes.push({ id: uid(), name, amount, accountId: d.accountId });
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
    extra: item?.dueDay ? [{ label: '📅 Agregar al calendario (cada mes)', onClick: () => calendarChooser(plannedEvent(item)) }] : [],
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
    const exp = { id: uid(), date, amount: p.amount, categoryId: p.categoryId, note: p.name, accountId: defaultAccountId(), plannedId: p.id, createdAt: Date.now() };
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
      accountPicker(item?.accountId) +
      field('Descripción', `<input name="note" maxlength="80" placeholder="¿En qué gastaste?" value="${esc(item?.note || '')}">`) +
      field('Fecha', `<input name="date" type="date" required value="${esc(item?.date || defaultDateForMonth())}">`) +
      (linked ? `<p class="muted small">Este es el pago de tu gasto fijo “${esc(linked.name)}”.</p>` : ''),
    saveLabel: item ? 'Guardar' : 'Registrar gasto',
    onSubmit: d => {
      const amount = parseAmount(d.amount);
      if (!amount) return toast('Escribe un monto válido'), false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return toast('Elige una fecha'), false;
      if (!d.accountId) return toast('Elige con qué banco o tarjeta pagaste'), false;
      const targetKey = d.date.slice(0, 7);
      const data = { amount, categoryId: d.categoryId || FALLBACK_CAT, note: d.note.trim(), date: d.date, accountId: d.accountId || defaultAccountId() };

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

/* ===================== Calendario (celular, Outlook, Google) ===================== */

const pad2 = n => String(n).padStart(2, '0');
const RRULES = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };
const REPEAT_LABELS = { none: 'No se repite', daily: 'Todos los días', weekly: 'Cada semana', monthly: 'Cada mes', yearly: 'Cada año' };
const ALARMS = [[0, 'A la hora'], [5, '5 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes'], [1440, '1 día antes']];

function stampLocal(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
}
function stampDate(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}
function isoWithOffset(d) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${isoDate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00${sign}${pad2(Math.floor(Math.abs(off) / 60))}:${pad2(Math.abs(off) % 60)}`;
}

function eventEnd(ev) {
  return new Date(ev.start.getTime() + (ev.allDay ? 86400000 : (ev.minutes || 30) * 60000));
}

function icsEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
}

// ev: { title, notes, start: Date, allDay, minutes, alarm (minutos antes o null), repeat }
function buildIcs(ev) {
  const end = eventEnd(ev);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MAURION//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid()}@maurion`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    ev.allDay ? `DTSTART;VALUE=DATE:${stampDate(ev.start)}` : `DTSTART:${stampLocal(ev.start)}`,
    ev.allDay ? `DTEND;VALUE=DATE:${stampDate(end)}` : `DTEND:${stampLocal(end)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
  ];
  if (ev.notes) lines.push(`DESCRIPTION:${icsEscape(ev.notes)}`);
  if (RRULES[ev.repeat]) lines.push(`RRULE:${RRULES[ev.repeat]}`);
  for (const min of ev.alarms || []) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(ev.title)}`, `TRIGGER:-PT${min}M`, 'END:VALARM');
  }
  if (ev.alarm != null) {
    // En eventos de todo el día la alerta suena a las 9:00 de ese día.
    const trigger = ev.allDay ? 'PT9H' : `-PT${ev.alarm}M`;
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(ev.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

function outlookUrl(ev) {
  const base = state.settings.outlook === 'trabajo' ? 'https://outlook.office.com' : 'https://outlook.live.com';
  const end = eventEnd(ev);
  let body = ev.notes || '';
  if (RRULES[ev.repeat]) body += (body ? '\n' : '') + `Repetir: ${REPEAT_LABELS[ev.repeat]} (configúralo en “Repetir” antes de guardar).`;
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.title,
    body,
    startdt: ev.allDay ? isoDate(ev.start) : isoWithOffset(ev.start),
    enddt: ev.allDay ? isoDate(end) : isoWithOffset(end),
    allday: String(!!ev.allDay),
  });
  return `${base}/calendar/0/deeplink/compose?${p}`;
}

function googleUrl(ev) {
  const end = eventEnd(ev);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: ev.allDay ? `${stampDate(ev.start)}/${stampDate(end)}` : `${stampLocal(ev.start)}/${stampLocal(end)}`,
    details: ev.notes || '',
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  if (RRULES[ev.repeat]) p.set('recur', 'RRULE:' + RRULES[ev.repeat]);
  return 'https://calendar.google.com/calendar/render?' + p;
}

function describeWhen(start, allDay, repeat) {
  let s = capitalize(start.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }));
  if (!allDay) s += ' · ' + start.toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
  if (RRULES[repeat]) s += ' · 🔁 ' + REPEAT_LABELS[repeat].toLowerCase();
  return s;
}

function calendarChooser(ev, onAdded) {
  const done = msg => {
    if (onAdded) {
      onAdded();
      saveState();
      render();
    }
    closeSheet();
    if (msg) toast(msg);
  };
  openSheet({
    title: 'Agregar al calendario',
    body: `<p class="muted small" style="text-align:center;margin:0 0 10px">${esc(ev.title)}<br>${esc(describeWhen(ev.start, ev.allDay, ev.repeat))}</p>`,
    extra: [
      {
        html: '<span>📱</span><span>Calendario del celular<small>Se descarga el evento con su alerta. Ábrelo y toca “Agregar”.</small></span>',
        onClick: () => {
          download(`${ev.title.replace(/[^\wáéíóúñ ]+/gi, '').trim().slice(0, 40) || 'evento'}.ics`, buildIcs(ev), 'text/calendar');
          done('Abre el archivo y toca “Agregar” 📅');
        },
      },
      {
        html: '<span>📧</span><span>Outlook<small>Abre el calendario de Outlook con el evento listo para guardar.</small></span>',
        onClick: () => { window.open(outlookUrl(ev), '_blank'); done(); },
      },
      {
        html: '<span>🗓️</span><span>Google Calendar<small>Abre Google Calendar con el evento listo.</small></span>',
        onClick: () => { window.open(googleUrl(ev), '_blank'); done(); },
      },
    ],
  });
}

function dateTime(date, time) {
  const d = parseIso(date);
  if (time) {
    const [h, mi] = time.split(':').map(Number);
    d.setHours(h, mi, 0, 0);
  }
  return d;
}

function nextHourTime() {
  const h = (new Date().getHours() + 1) % 24;
  return pad2(h) + ':00';
}

function dayDiff(d) {
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a - b) / 86400000);
}

function relDay(d) {
  const diff = dayDiff(d);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return capitalize(d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' }));
}

function timeLabel(time) {
  if (!time) return '';
  return dateTime(todayIso(), time).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });
}

function plannedEvent(p) {
  const today = new Date();
  let start = new Date(today.getFullYear(), today.getMonth(), Math.min(p.dueDay, daysInMonth(monthKey(today))), 9, 0);
  if (dayDiff(start) < 0) start = new Date(today.getFullYear(), today.getMonth() + 1, p.dueDay, 9, 0);
  return { title: `💳 Pagar ${p.name}`, notes: `Valor: ${money(p.amount)}`, start, minutes: 30, alarm: 1440, repeat: 'monthly' };
}

/* ===================== Tareas ===================== */

const PRIORITIES = [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']];

function taskEvent(t) {
  return {
    title: '✅ ' + t.title,
    notes: t.notes,
    start: dateTime(t.date, t.time),
    allDay: !t.time,
    minutes: 30,
    alarm: t.time ? 15 : 0,
    repeat: 'none',
  };
}

function taskBucket(t) {
  if (t.done) return 'done';
  if (!t.date) return 'nodate';
  const diff = dayDiff(parseIso(t.date));
  return diff < 0 ? 'late' : diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : 'later';
}

function taskItem(t) {
  const sub = [];
  if (t.date) sub.push(`<span class="status ${taskBucket(t) === 'late' ? 'late' : taskBucket(t) === 'today' ? 'soon' : ''}">${esc(relDay(parseIso(t.date)))}${t.time ? ' ' + esc(timeLabel(t.time)) : ''}</span>`);
  sub.push(`<span class="prio ${esc(t.priority)}"></span>${esc((PRIORITIES.find(p => p[0] === t.priority) || PRIORITIES[1])[1])}`);
  if (t.inCal) sub.push('📅');
  return `<li class="${t.done ? 'done' : ''}">
    <button class="check${t.done ? ' on' : ''}" data-action="toggle-task" data-id="${esc(t.id)}" aria-label="Completar">${t.done ? '✓' : ''}</button>
    <div class="item-main" data-action="edit-task" data-id="${esc(t.id)}">
      <div class="item-title">${esc(t.title)}</div>
      <div class="item-sub">${sub.join(' ')}</div>
    </div>
  </li>`;
}

function renderTasks() {
  const pending = state.tasks.filter(t => !t.done);
  const todayCount = pending.filter(t => ['late', 'today'].includes(taskBucket(t))).length;
  const chips = [['pendientes', `Pendientes (${pending.length})`], ['hoy', `Para hoy (${todayCount})`], ['completadas', 'Completadas']];
  $('#taskChips').innerHTML = chips.map(([id, label]) =>
    `<button class="chip${id === taskFilter ? ' on' : ''}" data-task-filter="${id}">${esc(label)}</button>`).join('');

  const prioRank = { alta: 0, media: 1, baja: 2 };
  const sortTasks = list => [...list].sort((a, b) =>
    (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '99').localeCompare(b.time || '99') ||
    prioRank[a.priority] - prioRank[b.priority] || a.createdAt - b.createdAt);

  let groups;
  if (taskFilter === 'completadas') {
    const done = state.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    groups = [['Completadas', done, '']];
  } else {
    const list = taskFilter === 'hoy' ? pending.filter(t => ['late', 'today'].includes(taskBucket(t))) : pending;
    const by = k => sortTasks(list.filter(t => taskBucket(t) === k));
    groups = [['Atrasadas', by('late'), 'late'], ['Hoy', by('today'), ''], ['Mañana', by('tomorrow'), ''], ['Próximas', by('later'), ''], ['Sin fecha', by('nodate'), '']];
  }
  groups = groups.filter(g => g[1].length);
  $('#taskGroups').innerHTML = groups.length
    ? groups.map(([title, items, cls]) => `<div class="group-title ${cls}">${esc(title)}</div><div class="card"><ul class="list">${items.map(taskItem).join('')}</ul></div>`).join('')
    : `<div class="empty-block">${taskFilter === 'completadas' ? 'Aún no completas tareas.' : '¡Sin pendientes! 🎉<br>Toca + para agregar una tarea.'}</div>`;
}

function toggleTask(id) {
  const t = state.tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  vibrate();
  saveState();
  render();
  if (t.done) toast('¡Tarea completada! 💪');
}

function taskForm(item) {
  openSheet({
    title: item ? 'Editar tarea' : 'Nueva tarea',
    body: field('Tarea', `<input name="title" class="big-input" maxlength="120" placeholder="¿Qué tienes que hacer?" required autofocus value="${esc(item?.title || '')}">`) +
      `<div class="field-row">` +
        field('Fecha', `<input name="date" type="date" value="${esc(item ? item.date : todayIso())}">`) +
        field('Hora (opcional)', `<input name="time" type="time" value="${esc(item?.time || '')}">`) +
      `</div>` +
      `<div class="field"><span class="field-label">Prioridad</span><div class="seg-pick">` +
        PRIORITIES.map(([v, l]) => `<label><input type="radio" name="priority" value="${v}"${(item?.priority || 'media') === v ? ' checked' : ''}><span class="prio ${v}"></span> ${l}</label>`).join('') +
      `</div></div>` +
      field('Notas', `<textarea name="notes" rows="3" style="min-height:80px" placeholder="Detalles (opcional)">${esc(item?.notes || '')}</textarea>`) +
      (item ? '' : `<label class="switch-row">📅 Agregar a mi calendario<input type="checkbox" name="addCal"></label>`),
    saveLabel: item ? 'Guardar' : 'Agregar tarea',
    extra: item?.date ? [{ label: '📅 Agregar al calendario', onClick: () => calendarChooser(taskEvent(item), () => { item.inCal = true; }) }] : [],
    onSubmit: d => {
      const title = d.title.trim();
      if (!title) return toast('Escribe la tarea'), false;
      const data = { title, date: d.date || '', time: d.date ? d.time || '' : '', priority: d.priority || 'media', notes: d.notes.trim() };
      let t = item;
      if (t) Object.assign(t, data);
      else {
        t = { id: uid(), ...data, done: false, doneAt: null, inCal: false, createdAt: Date.now() };
        state.tasks.push(t);
      }
      toast(item ? 'Tarea actualizada' : 'Tarea agregada ✅');
      if (d.addCal) {
        if (!t.date) toast('Ponle una fecha para pasarla al calendario');
        else afterSheet = () => calendarChooser(taskEvent(t), () => { t.inCal = true; });
      }
    },
    onDelete: item && (() => {
      state.tasks = state.tasks.filter(t => t.id !== item.id);
      toast('Tarea eliminada');
    }),
  });
}

/* ===================== Recordatorios ===================== */

const PRESETS = [
  { label: '📧 Revisar correo Outlook', title: 'Revisar correos de Outlook', repeat: 'daily', time: '08:00', app: 'outlook' },
  { label: '💊 Medicina', title: 'Tomar medicina', repeat: 'daily', time: '08:00' },
  { label: '💳 Pagar tarjeta', title: 'Pagar tarjeta de crédito', repeat: 'monthly', time: '09:00' },
  { label: '🏋️ Gimnasio', title: 'Ir al gimnasio', repeat: 'daily', time: '18:00' },
  { label: '🎂 Cumpleaños', title: 'Cumpleaños de ', repeat: 'yearly', time: '08:00' },
  { label: '💧 Tomar agua', title: 'Tomar agua', repeat: 'daily', time: '10:00' },
];

// Próxima ocurrencia (desde hoy) de un recordatorio; null si ya pasó y no se repite.
function nextOccurrence(r) {
  const start = dateTime(r.date, r.time);
  if (!RRULES[r.repeat]) return start;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (start >= today) return start;
  const d = new Date(start);
  if (r.repeat === 'daily') {
    d.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
  } else if (r.repeat === 'weekly') {
    const weeks = Math.ceil((today - start) / (7 * 86400000));
    d.setDate(d.getDate() + weeks * 7);
  } else {
    const day = start.getDate();
    const stepMonths = r.repeat === 'yearly' ? 12 : 1;
    let k = 0, cand;
    do {
      k += stepMonths;
      const base = new Date(start.getFullYear(), start.getMonth() + k, 1, start.getHours(), start.getMinutes());
      const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      cand = new Date(base.getFullYear(), base.getMonth(), Math.min(day, last), start.getHours(), start.getMinutes());
    } while (cand < today);
    return cand;
  }
  return d;
}

function reminderEvent(r) {
  let notes = r.notes || '';
  if (r.app === 'outlook') notes += (notes ? '\n' : '') + 'Abre Outlook y revisa tu bandeja de entrada.';
  return { title: '🔔 ' + r.title, notes, start: dateTime(r.date, r.time), minutes: 15, alarm: Number(r.alarm) || 0, repeat: r.repeat };
}

function reminderItem(r) {
  const when = nextOccurrence(r);
  const past = !RRULES[r.repeat] && when < new Date();
  const diff = dayDiff(when);
  const cls = past ? 'late' : diff === 0 ? 'soon' : '';
  const label = `${relDay(when)} ${timeLabel(r.time)}`;
  return `<li class="${r.done ? 'done' : ''}">
    ${RRULES[r.repeat] ? `<span class="ico" style="--c:var(--accent)">${r.app === 'outlook' ? '📧' : '🔔'}</span>`
      : `<button class="check${r.done ? ' on' : ''}" data-action="toggle-reminder" data-id="${esc(r.id)}" aria-label="Marcar como hecho">${r.done ? '✓' : ''}</button>`}
    <div class="item-main" data-action="edit-reminder" data-id="${esc(r.id)}">
      <div class="item-title">${esc(r.title)}</div>
      <div class="item-sub"><span class="status ${cls}">${esc(label)}</span>${RRULES[r.repeat] ? `<span class="tag">🔁 ${esc(REPEAT_LABELS[r.repeat])}</span>` : ''}${r.inCal ? '📅' : ''}</div>
    </div>
    ${r.app === 'outlook' ? '<a class="pay-btn" href="ms-outlook://">Abrir</a>' : ''}
  </li>`;
}

function renderReminders() {
  const items = state.reminders.map(r => ({ r, when: nextOccurrence(r) })).sort((a, b) => a.when - b.when);
  const groups = [
    ['Hoy', items.filter(x => !x.r.done && dayDiff(x.when) === 0)],
    ['Próximos 7 días', items.filter(x => !x.r.done && dayDiff(x.when) > 0 && dayDiff(x.when) <= 7)],
    ['Más adelante', items.filter(x => !x.r.done && dayDiff(x.when) > 7)],
    ['Pasados', items.filter(x => !x.r.done && dayDiff(x.when) < 0)],
    ['Hechos', items.filter(x => x.r.done)],
  ].filter(g => g[1].length);
  $('#remGroups').innerHTML = groups.length
    ? groups.map(([title, list]) => `<div class="group-title ${title === 'Pasados' ? 'late' : ''}">${esc(title)}</div><div class="card"><ul class="list">${list.map(x => reminderItem(x.r)).join('')}</ul></div>`).join('')
    : '<div class="empty-block">No tienes recordatorios.<br>Toca + para crear uno y pasarlo a tu calendario.</div>';
}

function toggleReminder(id) {
  const r = state.reminders.find(x => x.id === id);
  if (!r) return;
  r.done = !r.done;
  vibrate();
  saveState();
  render();
}

function reminderForm(item, preset) {
  const v = item || { title: preset?.title || '', date: todayIso(), time: preset?.time || nextHourTime(), repeat: preset?.repeat || 'none', alarm: 0, notes: '', app: preset?.app || '' };
  openSheet({
    title: item ? 'Editar recordatorio' : 'Nuevo recordatorio',
    body: (item ? '' : `<div class="presets">${PRESETS.map((p, i) => `<button type="button" class="chip" data-preset="${i}">${esc(p.label)}</button>`).join('')}</div>`) +
      field('Recordarme', `<input name="title" class="big-input" maxlength="120" placeholder="¿Qué te recuerdo?" required autofocus value="${esc(v.title)}">`) +
      `<div class="field-row">` +
        field('Fecha', `<input name="date" type="date" required value="${esc(v.date)}">`) +
        field('Hora', `<input name="time" type="time" required value="${esc(v.time)}">`) +
      `</div>` +
      `<div class="field-row">` +
        field('Repetir', `<select name="repeat">${Object.entries(REPEAT_LABELS).map(([k, l]) => `<option value="${k}"${k === v.repeat ? ' selected' : ''}>${l}</option>`).join('')}</select>`) +
        field('Aviso', `<select name="alarm">${ALARMS.map(([m, l]) => `<option value="${m}"${m === Number(v.alarm) ? ' selected' : ''}>${l}</option>`).join('')}</select>`) +
      `</div>` +
      field('Notas', `<textarea name="notes" rows="2" style="min-height:70px" placeholder="Opcional">${esc(v.notes)}</textarea>`) +
      `<input type="hidden" name="app" value="${esc(v.app || '')}">` +
      (item ? '' : `<label class="switch-row">📅 Pasarlo a mi calendario (para que te avise)<input type="checkbox" name="addCal" checked></label>`),
    saveLabel: item ? 'Guardar' : 'Crear recordatorio',
    extra: item ? [{ label: '📅 Agregar al calendario', onClick: () => calendarChooser(reminderEvent(item), () => { item.inCal = true; }) }] : [],
    onSubmit: d => {
      const title = d.title.trim();
      if (!title) return toast('Escribe qué te recuerdo'), false;
      if (!d.date || !d.time) return toast('Elige fecha y hora'), false;
      const data = { title, date: d.date, time: d.time, repeat: d.repeat, alarm: Number(d.alarm), notes: d.notes.trim(), app: d.app || '' };
      let r = item;
      if (r) Object.assign(r, data);
      else {
        r = { id: uid(), ...data, done: false, inCal: false, createdAt: Date.now() };
        state.reminders.push(r);
      }
      toast(item ? 'Recordatorio actualizado' : 'Recordatorio creado 🔔');
      if (d.addCal) afterSheet = () => calendarChooser(reminderEvent(r), () => { r.inCal = true; });
    },
    onDelete: item && (() => {
      state.reminders = state.reminders.filter(r => r.id !== item.id);
      toast('Recordatorio eliminado');
    }),
  });
  sheet.querySelector('.presets')?.addEventListener('click', e => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    const p = PRESETS[b.dataset.preset];
    const f = $('#sheetForm');
    f.title.value = p.title;
    f.time.value = p.time;
    f.repeat.value = p.repeat;
    f.app.value = p.app || '';
    sheet.querySelectorAll('[data-preset]').forEach(x => x.classList.toggle('on', x === b));
    f.title.focus();
  });
}

/* ===================== Notas ===================== */

const NOTE_COLORS = ['#2b7bef', '#3fd3c6', '#fbbf24', '#f472b6', '#34d399', '#a78bfa'];

function noteCard(n) {
  const title = n.title || n.body.split('\n')[0] || 'Sin título';
  const body = n.title ? n.body : n.body.split('\n').slice(1).join('\n');
  const date = new Date(n.updatedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' });
  return `<button class="note-card" style="--c:${esc(n.color)}" data-action="edit-note" data-id="${esc(n.id)}">
    <strong>${n.pinned ? '📌 ' : ''}${esc(title)}</strong>
    ${body ? `<p>${esc(body)}</p>` : ''}
    <small>${esc(date)}</small>
  </button>`;
}

function sortedNotes() {
  return [...state.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt);
}

function renderNotes() {
  const list = sortedNotes().filter(n => !noteQuery || (n.title + ' ' + n.body).toLowerCase().includes(noteQuery));
  $('#notesGrid').innerHTML = list.length
    ? list.map(noteCard).join('')
    : `<div class="empty-block">${noteQuery ? 'No hay notas con esa búsqueda.' : 'Aún no tienes notas.<br>Toca + para escribir la primera.'}</div>`;
}

function noteForm(item) {
  const color = item?.color || NOTE_COLORS[state.notes.length % NOTE_COLORS.length];
  openSheet({
    title: item ? 'Nota' : 'Nueva nota',
    body: field('Título', `<input name="title" class="big-input" maxlength="80" placeholder="Título" value="${esc(item?.title || '')}"${item ? '' : ' autofocus'}>`) +
      `<div class="field"><textarea name="body" rows="8" placeholder="Escribe aquí…">${esc(item?.body || '')}</textarea></div>` +
      field('Color', `<div class="color-picker">${NOTE_COLORS.map(c =>
        `<button type="button" data-color="${c}" style="background:${c}" class="${c === color ? 'on' : ''}" aria-label="Color"></button>`).join('')}</div>`) +
      `<input type="hidden" name="color" value="${esc(color)}">` +
      `<label class="switch-row">📌 Fijar en Inicio<input type="checkbox" name="pinned"${item?.pinned ? ' checked' : ''}></label>`,
    saveLabel: item ? 'Guardar' : 'Guardar nota',
    onSubmit: d => {
      const title = d.title.trim(), body = d.body.trim();
      if (!title && !body) return toast('La nota está vacía'), false;
      const data = { title, body, color: d.color, pinned: !!d.pinned, updatedAt: Date.now() };
      if (item) Object.assign(item, data);
      else state.notes.push({ id: uid(), ...data });
      toast('Nota guardada 📝');
    },
    onDelete: item && (() => {
      if (!confirm('¿Eliminar esta nota?')) return false;
      state.notes = state.notes.filter(n => n.id !== item.id);
      toast('Nota eliminada');
    }),
  });
  sheet.querySelector('.color-picker').addEventListener('click', e => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    sheet.querySelectorAll('.color-picker button').forEach(x => x.classList.toggle('on', x === b));
    sheet.querySelector('[name="color"]').value = b.dataset.color;
  });
}

/* ===================== Inicio (hub) ===================== */

function agendaUrgentCount() {
  const tasks = state.tasks.filter(t => ['late', 'today'].includes(taskBucket(t))).length;
  const rems = state.reminders.filter(r => !r.done && dayDiff(nextOccurrence(r)) === 0).length;
  return tasks + rems;
}

function renderHub() {
  $('#todayLine').textContent = capitalize(new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }));
  renderDayStrip();

  const realMonth = monthKey(new Date());
  const m = getMonth(realMonth);
  $('#tileFin').textContent = moneyShort(totals(m, realMonth).available);

  const pending = state.tasks.filter(t => !t.done);
  const todayTasks = pending.filter(t => ['late', 'today'].includes(taskBucket(t)));
  $('#tileTasks').textContent = pending.length;
  $('#tileTasksSub').textContent = todayTasks.length ? `${todayTasks.length} para hoy` : 'pendientes';

  const upcoming = state.reminders.filter(r => !r.done)
    .map(r => ({ r, when: nextOccurrence(r) }))
    .filter(x => x.when >= new Date() || dayDiff(x.when) === 0)
    .sort((a, b) => a.when - b.when);
  $('#tileRem').textContent = upcoming.length ? upcoming[0].r.title : '—';
  $('#tileRemSub').textContent = upcoming.length ? `${relDay(upcoming[0].when)} ${timeLabel(upcoming[0].r.time)}` : 'sin próximos';
  $('#tileNotes').textContent = state.notes.length;

  // Para hoy: tareas atrasadas/de hoy y recordatorios de hoy
  const todayRems = upcoming.filter(x => dayDiff(x.when) === 0).map(x => x.r);
  const rows = [...todayTasks.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')).map(taskItem), ...todayRems.map(reminderItem)];
  $('#hubToday').innerHTML = rows.length ? rows.join('') : emptyItem('Nada pendiente para hoy ✨');

  // Próximos pagos del mes en curso
  const pays = sortPlanned(m.planned.filter(p => !p.paidExpenseId), realMonth).slice(0, 3);
  $('#hubPaysCard').hidden = !pays.length;
  $('#hubPays').innerHTML = pays.map(p => {
    const c = catById(p.categoryId);
    const st = dueStatus(p, realMonth);
    return `<li>
      ${catIcon(c)}
      <div class="item-main" data-goto="finanzas" data-sub="presupuesto">
        <div class="item-title">${esc(p.name)}</div>
        <div class="item-sub"><span class="status ${st.cls}">${esc(st.text)}</span>${money(p.amount)}</div>
      </div>
      <button class="pay-btn" data-action="toggle-paid" data-id="${esc(p.id)}" data-month="${realMonth}">Pagar</button>
    </li>`;
  }).join('');

  const pinned = sortedNotes().filter(n => n.pinned).slice(0, 4);
  $('#hubNotesCard').hidden = !pinned.length;
  $('#hubNotes').innerHTML = pinned.map(noteCard).join('');
}

function fabAction() {
  if (currentView === 'finanzas') return expenseForm(null);
  if (currentView === 'agenda') return agendaSub === 'tareas' ? taskForm(null) : reminderForm(null);
  if (currentView === 'notas') return noteForm(null);
  if (currentView === 'utilidades') return fuelForm(null);
  const opts = [['gasto', '🧾', 'Gasto'], ['tarea', '✅', 'Tarea'], ['recordatorio', '🔔', 'Recordatorio'], ['nota', '📝', 'Nota']];
  openSheet({
    title: '¿Qué quieres agregar?',
    body: `<div class="quick-grid">${opts.map(([k, ic, l]) => `<button type="button" data-action="quick" data-kind="${k}"><span>${ic}</span>${l}</button>`).join('')}</div>`,
  });
}

function quickAdd(kind) {
  if (kind === 'gasto') return expenseForm(null);
  if (kind === 'tarea') return taskForm(null);
  if (kind === 'recordatorio') return reminderForm(null);
  return noteForm(null);
}

/* ===================== Sobrante del mes anterior ===================== */

function carryForm() {
  const c = carryInfo(currentMonth);
  if (!c) return;
  const prev = monthName(c.prevKey);
  openSheet({
    title: `Ahorro de ${prev}`,
    body: amountInput(c.amount) +
      `<p class="muted small" style="text-align:center;margin:-6px 0 14px">Cálculo automático: <strong>${money(c.auto)}</strong><br>(ingresos − gastos de ${esc(prev)}). Si es negativo, es lo que te faltó.</p>`,
    extra: [
      ...(c.manual ? [{ label: '↺ Volver al cálculo automático', onClick: () => { getMonth(currentMonth, true).carry = null; finish('Ahorro automático'); } }] : []),
      { label: '🚫 No pasar ahorro a este mes', onClick: () => { getMonth(currentMonth, true).carry = { off: true }; finish('Ahorro quitado de este mes'); } },
    ],
    onSubmit: d => {
      const raw = String(d.amount).trim();
      const neg = raw.startsWith('-');
      const amount = parseAmount(raw.replace(/^-/, ''));
      if (amount == null && !/^-?0+$/.test(raw)) return toast('Escribe un monto válido'), false;
      getMonth(currentMonth, true).carry = { amount: (amount || 0) * (neg ? -1 : 1) };
      toast('Ahorro actualizado');
    },
  });
  function finish(msg) {
    closeSheet();
    saveState();
    render();
    toast(msg);
  }
}

/* ===================== Registro rápido por frase o voz ===================== */

const WORD_NUMBERS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400,
  quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900, medio: 0.5,
};

const CATEGORY_WORDS = {
  mercado: 'mercado supermercado exito d1 ara olimpica carulla jumbo tienda verduras fruta frutas mecato',
  comida: 'almuerzo desayuno cena comida restaurante pizza hamburguesa rappi domicilio cafe tinto empanada empanadas pollo helado onces corrientazo perro arepa',
  transporte: 'uber didi taxi bus buseta transmilenio mio metro gasolina tanqueo tanqueada parqueadero peaje indriver cabify pasaje pasajes',
  servicios: 'luz agua gas internet celular plan claro movistar tigo wom netflix spotify youtube disney energia epm emcali recibo',
  vivienda: 'arriendo renta administracion hipoteca',
  salud: 'medico drogueria farmacia medicina medicamentos eps cita odontologo gym gimnasio examenes',
  deudas: 'tarjeta credito cuota prestamo deuda banco abono',
  educacion: 'curso libro libros universidad colegio matricula udemy platzi semestre',
  ocio: 'cine fiesta cerveza cervezas trago tragos bar concierto juego salida rumba viaje regalo paseo',
  ahorro: 'ahorro cdt inversion ahorre',
};

const INCOME_RE = /\b(ingreso|ingresos|me pagaron|salario|sueldo|nomina|quincena|prima|recibi|me consignaron|me transfirieron|me giraron|vendi|honorarios|me entro|me llego)\b/;

function normalizeText(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function parseQuick(text) {
  let t = ' ' + normalizeText(text) + ' ';
  // Números escritos en palabras: "veinte mil" → "20 mil"
  t = t.replace(/\b([a-z]+)\b/g, w => (w in WORD_NUMBERS ? String(WORD_NUMBERS[w]) : w));
  t = t.replace(/(\d+) (\d+) (mil|millon|millones)/g, (_, a, b, u) => `${Number(a) + Number(b)} ${u}`);

  const re = /\$?\s*(\d+(?:[.,]\d+)*)\s*(k|mil|millones|millon|m|palos?|lucas?|barras?)?(?=[\s.,;!?]|$)/;
  const match = t.match(re);
  if (!match) return null;
  const [whole, num, unit] = match;
  let amount;
  if (unit) {
    const n = parseFloat(num.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    const mult = /^(k|mil|lucas?|barras?)$/.test(unit) ? 1e3 : 1e6;
    amount = n * mult;
  } else {
    amount = parseAmount(num);
  }
  if (!amount) return null;

  let rest = t.replace(whole, ' ');
  let date = todayIso();
  if (/\banteayer\b/.test(rest)) {
    const d = new Date(); d.setDate(d.getDate() - 2); date = isoDate(d);
  } else if (/\bayer\b/.test(rest)) {
    const d = new Date(); d.setDate(d.getDate() - 1); date = isoDate(d);
  }
  const isIncome = INCOME_RE.test(rest);
  // Cuenta: por nombre ("nequi", "bancolombia") o por tipo ("crédito", "efectivo", "débito")
  let accountId = null;
  const GENERIC = ['tarjeta', 'credito', 'debito', 'banco', 'cuenta', 'efectivo', 'de', 'del'];
  const restWords = rest.split(/\s+/);
  for (const a of state.accounts) {
    const tokens = normalizeText(a.name).split(/\s+/).filter(w => w.length > 1 && !GENERIC.includes(w));
    const hit = tokens.find(w => restWords.includes(w));
    if (hit) { accountId = a.id; rest = rest.replace(new RegExp(`\\b${hit}\\b`, 'g'), ' '); break; }
  }
  const byType = type => state.accounts.find(a => a.type === type)?.id;
  if (!accountId) {
    if (/\b(tarjeta de credito|con credito|a credito|credito|tc)\b/.test(rest)) accountId = byType('credito');
    else if (/\b(efectivo|cash)\b/.test(rest)) accountId = byType('efectivo');
    else if (/\b(debito|tarjeta debito)\b/.test(rest)) accountId = byType('debito');
  }
  if (isIncome && accountById(accountId)?.type === 'credito') accountId = null;
  accountId = accountId || defaultAccountId();
  rest = rest.replace(/\b(con )?(la )?(tarjeta( de)? )?(credito|debito)\b|\b(en |con )?efectivo\b|\btc\b/g, ' ');

  rest = rest.replace(/\b(anteayer|ayer|hoy|pesos|en|de|del|por|un|una|el|la|los|las|gaste|pague|compre|me gaste|gasto|fue|para)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();

  // Categoría: palabras clave + nombres de tus propias categorías
  let categoryId = FALLBACK_CAT;
  const words = rest.split(' ');
  outer:
  for (const c of state.categories) {
    const keys = (CATEGORY_WORDS[c.id] || '').split(' ').concat(normalizeText(c.name).split(' ')).filter(Boolean);
    for (const w of words) if (keys.includes(w)) { categoryId = c.id; break outer; }
  }

  // Descripción con el texto original (sin el valor), para conservar mayúsculas y tildes
  let note = text.replace(/\$?\s*\d+(?:[.,]\d+)*\s*(k|mil|millones|millón|millon|m|palos?|lucas?|barras?)?\b/i, ' ')
    .replace(new RegExp(`\\b(?:(?:${Object.keys(WORD_NUMBERS).join('|')})\\s+)+(?:mil|millones|millón|millon|palos?|lucas?)\\b`, 'gi'), ' ')
    .replace(/\b(anteayer|ayer|hoy|pesos)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  note = note ? capitalize(note) : '';
  note = note.replace(/\b(con |en |a )?(la )?(tarjeta( de)? )?(crédito|credito|débito|debito)\b|\b(en |con )?efectivo\b/gi, ' ').replace(/\s+/g, ' ').trim();
  if (accountId) {
    const acc = accountById(accountId);
    for (const w of normalizeText(acc.name).split(/\s+/).filter(x => x.length > 1 && !GENERIC.includes(x))) {
      note = note.split(/\s+/).filter(x => normalizeText(x) !== w).join(' ');
    }
    note = note.replace(/\s*\b(con|en|a|de|por)(\s+(la|el|mi|mis))?\s*$/i, '').trim();
  }
  note = note.replace(/\s+/g, ' ').trim();
  note = note ? capitalize(note) : '';
  return { amount: Math.round(amount * 100) / 100, categoryId, note, date, isIncome, accountId };
}

function quickEntry(text) {
  const r = parseQuick(text);
  if (!r) {
    toast('No encontré el valor. Ejemplo: “almuerzo 25 mil”');
    return false;
  }
  const key = r.date.slice(0, 7);
  if (r.isIncome) {
    const item = { id: uid(), name: r.note || 'Ingreso', amount: r.amount, accountId: r.accountId };
    getMonth(key, true).incomes.push(item);
    saveState();
    render();
    toast(`💰 Ingreso: ${money(r.amount)} → ${accountById(r.accountId).name}${r.note ? ' · ' + r.note : ''}`, [
      { label: 'Deshacer', onClick: () => { const m = getMonth(key); m.incomes = m.incomes.filter(i => i !== item); saveState(); render(); } },
    ]);
  } else {
    const item = { id: uid(), amount: r.amount, categoryId: r.categoryId, note: r.note, date: r.date, accountId: r.accountId, plannedId: null, createdAt: Date.now() };
    getMonth(key, true).expenses.push(item);
    saveState();
    render();
    const c = catById(r.categoryId);
    const acc = accountById(r.accountId);
    toast(`${c.emoji} ${c.name}: ${money(r.amount)} · ${ACCOUNT_TYPES[acc.type].icon} ${acc.name}${r.note ? ' · ' + r.note : ''}`, [
      { label: 'Editar', onClick: () => { currentMonth = key; render(); expenseForm(item); } },
      { label: 'Deshacer', onClick: () => { const m = getMonth(key); m.expenses = m.expenses.filter(e => e !== item); saveState(); render(); } },
    ]);
  }
  vibrate();
  return true;
}

document.addEventListener('submit', e => {
  const form = e.target.closest('.quick-entry');
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector('input');
  if (!input.value.trim()) return input.focus();
  if (quickEntry(input.value)) {
    input.value = '';
    input.blur();
  }
});

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRec) document.documentElement.classList.add('no-speech');

function startDictation(btn) {
  if (!SpeechRec) return toast('Usa el 🎙️ del teclado para dictar');
  const input = btn.closest('.quick-entry').querySelector('input');
  const rec = new SpeechRec();
  rec.lang = 'es-CO';
  rec.interimResults = false;
  btn.classList.add('listening');
  rec.onresult = ev => {
    input.value = ev.results[0][0].transcript;
    btn.closest('.quick-entry').requestSubmit();
  };
  rec.onerror = () => toast('No te escuché bien, intenta de nuevo');
  rec.onend = () => btn.classList.remove('listening');
  rec.start();
}

/* ===================== Bloqueo con PIN y Face ID ===================== */

const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));

async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(salt + ':' + pin);
  return b64(await crypto.subtle.digest('SHA-256', data));
}

let pinBuffer = '';
let hiddenAt = null;

function lockEnabled() {
  return !!state.security.pinHash;
}

let faceBusy = false;

function setLockMode(mode, title) {
  const lock = $('#lock');
  lock.classList.toggle('pin-mode', mode === 'pin');
  $('#lockPinTitle').textContent = title || 'Ingresa tu contraseña';
  $('#lockFaceKey').hidden = !state.security.credId;
}

function showLock() {
  if (!lockEnabled()) return;
  pinBuffer = '';
  renderPinDots();
  $('#lock').hidden = false;
  if (sheet.open) closeSheet();
  if (state.security.credId) {
    setLockMode('face');
    faceUnlock(true);
  } else {
    setLockMode('pin');
  }
}

function renderPinDots(error) {
  const dots = $('#pinDots');
  dots.innerHTML = Array.from({ length: state.security.pinLen || 4 }, (_, i) => `<i class="${i < pinBuffer.length ? 'on' : ''}"></i>`).join('');
  dots.classList.toggle('shake', !!error);
}

function unlock() {
  $('#lock').hidden = true;
  pinBuffer = '';
  render();
}

async function tryPin() {
  if ((await hashPin(pinBuffer, state.security.salt)) === state.security.pinHash) return unlock();
  pinBuffer = '';
  renderPinDots(true);
  vibrate();
}

$('#lock').addEventListener('click', async e => {
  const k = e.target.closest('[data-key]');
  if (k) {
    const key = k.dataset.key;
    if (key === 'del') pinBuffer = pinBuffer.slice(0, -1);
    else if (pinBuffer.length < (state.security.pinLen || 4)) pinBuffer += key;
    renderPinDots();
    if (pinBuffer.length === (state.security.pinLen || 4)) await tryPin();
    return;
  }
  if (e.target.closest('#lockFace, #lockFaceKey')) return faceUnlock();
  if (e.target.closest('#lockUsePin')) return setLockMode('pin');
  if (e.target.closest('#lockForgot')) {
    if (confirm('Si olvidaste tu contraseña, la única forma de entrar es borrar los datos de la app (luego puedes restaurar una copia de seguridad). ¿Borrar todo?')) {
      state = defaultState();
      saveState();
      location.reload();
    }
  }
});

// Al abrir se lanza Face ID solo. Si falla o lo cancelas, pide la contraseña.
// Si iOS no deja lanzarlo sin un toque (falla al instante), queda el botón de Face ID.
async function faceUnlock(auto = false) {
  if (faceBusy || !state.security.credId) return;
  faceBusy = true;
  const started = Date.now();
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(state.security.credId), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    unlock();
  } catch {
    const quick = Date.now() - started < 700;
    if (!(auto && quick)) setLockMode('pin', 'No te reconocí 🙈 Ingresa tu contraseña');
  } finally {
    faceBusy = false;
  }
}

function faceIdOffer() {
  if (!window.PublicKeyCredential) return;
  openSheet({
    title: '¿Activar Face ID?',
    body: `<p class="muted small" style="text-align:center;margin:0 0 6px">Así MAURION se abre con tu cara. Si no te reconoce, te pedirá la contraseña que acabas de crear.</p>`,
    extra: [
      { label: '🙂 Sí, activar Face ID', onClick: () => { closeSheet(); enableFaceId(); } },
      { label: 'Ahora no', onClick: closeSheet },
    ],
  });
}

function pinSetupForm() {
  openSheet({
    title: lockEnabled() ? 'Cambiar contraseña' : 'Crear contraseña',
    body: `<p class="muted small" style="text-align:center;margin:0 0 12px">Elige una contraseña de 4 a 6 números. Se usa cuando Face ID no te reconoce.</p>` +
      field('Contraseña nueva', `<input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" required autofocus class="big-input pin-input">`) +
      field('Repite la contraseña', `<input name="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" required class="big-input pin-input">`),
    saveLabel: 'Guardar contraseña',
    onSubmit: d => {
      if (!/^\d{4,6}$/.test(d.pin)) return toast('Debe tener de 4 a 6 números'), false;
      if (d.pin !== d.pin2) return toast('Las contraseñas no coinciden'), false;
      if (!state.security.credId) afterSheet = faceIdOffer;
      const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
      hashPin(d.pin, salt).then(h => {
        state.security.salt = salt;
        state.security.pinHash = h;
        state.security.pinLen = d.pin.length;
        saveState();
        render();
        toast('🔒 Bloqueo activado');
      });
    },
  });
}

function removeLock() {
  if (!confirm('¿Quitar el bloqueo de MAURION?')) return;
  state.security = { ...state.security, pinHash: null, salt: null, credId: null };
  saveState();
  render();
  toast('Bloqueo desactivado');
}

async function enableFaceId() {
  if (!lockEnabled()) return toast('Primero crea una contraseña');
  try {
    const ok = window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!ok) return toast('Este celular no permite Face ID para la app');
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'MAURION' },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'maurion', displayName: state.profile.name || 'MAURION' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        attestation: 'none',
        timeout: 60000,
      },
    });
    state.security.credId = b64(cred.rawId);
    saveState();
    render();
    toast('Face ID activado 😎');
  } catch {
    toast('No se activó Face ID');
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') hiddenAt = Date.now();
  else if (lockEnabled() && hiddenAt && Date.now() - hiddenAt >= state.security.lockAfter * 60000) showLock();
});

/* ===================== Número en el ícono ===================== */

function updateAppBadge(n) {
  if (!('setAppBadge' in navigator) || !state.settings.badge) return;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

async function enableBadge() {
  if (state.settings.badge) {
    state.settings.badge = false;
    if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
    saveState();
    render();
    return toast('Número del ícono desactivado');
  }
  if (!('setAppBadge' in navigator)) {
    return toast('Primero agrega MAURION a tu pantalla de inicio y ábrela desde ahí');
  }
  if ('Notification' in window && Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return toast('Debes permitir notificaciones para ver el número');
  }
  state.settings.badge = true;
  saveState();
  render();
  toast('Listo: verás tus pendientes en el ícono');
}

function renderSecurity() {
  const on = lockEnabled();
  $('#securityState').textContent = on ? (state.security.credId ? '🔒 Activo con Face ID y contraseña' : '🔒 Activo con contraseña (Face ID apagado)') : 'Desactivado';
  $('#securityBtns').innerHTML = on
    ? `<button class="btn soft" data-action="set-pin">Cambiar contraseña</button>` +
      (state.security.credId ? '' : `<button class="btn soft" data-action="enable-faceid">Activar Face ID</button>`) +
      `<button class="btn danger-soft" data-action="remove-lock">Quitar bloqueo</button>`
    : `<button class="btn primary" data-action="set-pin">Activar Face ID y contraseña</button>`;
  $('#lockAfter').value = String(state.security.lockAfter);
  $('#lockAfterRow').hidden = !on;
  $('#badgeBtn').textContent = state.settings.badge ? 'Desactivar número en el ícono' : 'Activar número en el ícono';
  $('#rollover').checked = !!state.settings.rollover;
}

$('#lockAfter').addEventListener('change', e => {
  state.security.lockAfter = Number(e.target.value);
  saveState();
});
$('#rollover').addEventListener('change', e => {
  state.settings.rollover = e.target.checked;
  saveState();
  render();
});

/* ===================== Utilidades: vehículos y vencimientos ===================== */

/* ----- Documentos del vehículo (SOAT, tecnomecánica, impuesto…) ----- */

const DOC_TYPES = [
  { type: 'soat', emoji: '🛡️', name: 'SOAT', main: true },
  { type: 'tecno', emoji: '🔧', name: 'Tecnomecánica', main: true },
  { type: 'impuesto', emoji: '🧾', name: 'Impuesto vehicular', main: true },
  { type: 'poliza', emoji: '📑', name: 'Póliza todo riesgo' },
  { type: 'otro', emoji: '📄', name: 'Otro documento' },
];

function docType(t) {
  return DOC_TYPES.find(d => d.type === t) || DOC_TYPES[DOC_TYPES.length - 1];
}

function docsOf(vehicleId) {
  return state.utils.docs.filter(d => d.vehicleId === vehicleId);
}

function docStatus(doc) {
  const diff = dayDiff(parseIso(doc.date));
  if (diff < 0) return { cls: 'late', text: `Vencido hace ${-diff} día${diff === -1 ? '' : 's'}`, diff };
  if (diff === 0) return { cls: 'late', text: 'Vence hoy', diff };
  if (diff <= 30) return { cls: 'soon', text: `Vence en ${diff} día${diff === 1 ? '' : 's'}`, diff };
  return { cls: 'ok', text: `Vigente hasta ${formatDate(doc.date)} ${doc.date.slice(0, 4)}`, diff };
}

function docLabel(doc) {
  const v = vehicleById(doc.vehicleId);
  return `${doc.name}${v ? ' ' + v.name : ''}`;
}

function docEvent(doc) {
  return {
    title: `${doc.emoji} Vence ${docLabel(doc)}`,
    notes: doc.notes || '',
    start: dateTime(doc.date, '09:00'),
    minutes: 30,
    alarms: [30 * 1440, 7 * 1440],
    alarm: 0,
    repeat: 'none',
  };
}

function plusYear(iso) {
  const d = parseIso(iso);
  d.setFullYear(d.getFullYear() + 1);
  return isoDate(d);
}

function docForm(item, preset) {
  const base = item || { vehicleId: preset?.vehicleId || currentVehicle, type: preset?.type || 'soat', date: '', notes: '' };
  const v = vehicleById(base.vehicleId);
  const t = docType(base.type);
  openSheet({
    title: `${t.emoji} ${item ? item.name : t.type === 'otro' ? 'Documento' : t.name}${v ? ' · ' + v.name : ''}`,
    body: (t.type === 'otro' ? field('Nombre', `<input name="name" maxlength="60" placeholder="Ej. Revisión de gases" required value="${esc(item?.name || '')}">`) : '') +
      field('¿Hasta cuándo está vigente?', `<input name="date" type="date" required value="${esc(base.date)}" autofocus>`) +
      field('Notas', `<input name="notes" maxlength="120" placeholder="Aseguradora, número de póliza, valor pagado…" value="${esc(base.notes)}">`) +
      `<label class="switch-row">📅 Pasarlo a mi calendario (aviso 30 y 7 días antes)<input type="checkbox" name="addCal"${item ? '' : ' checked'}></label>`,
    saveLabel: 'Guardar',
    extra: item ? [{
      label: '✅ Ya lo renové (+1 año)',
      onClick: () => {
        item.date = plusYear(item.date);
        saveState();
        render();
        toast(`Renovado hasta ${formatDate(item.date)} ${item.date.slice(0, 4)}`);
        calendarChooser(docEvent(item));
      },
    }] : [],
    onSubmit: d => {
      if (!d.date) return toast('Elige la fecha de vencimiento'), false;
      const name = t.type === 'otro' ? (d.name || '').trim() || 'Documento' : t.name;
      const data = { date: d.date, notes: d.notes.trim(), name, emoji: t.emoji, type: t.type, vehicleId: base.vehicleId };
      let doc = item;
      if (doc) Object.assign(doc, data);
      else {
        doc = { id: uid(), ...data };
        state.utils.docs.push(doc);
      }
      toast(`${t.emoji} ${name} guardado`);
      if (d.addCal) afterSheet = () => calendarChooser(docEvent(doc));
    },
    onDelete: item && (() => {
      state.utils.docs = state.utils.docs.filter(x => x.id !== item.id);
      toast('Documento eliminado');
    }),
  });
}

function vehicleDocsHtml(v) {
  const docs = docsOf(v.id);
  const rows = DOC_TYPES.filter(t => t.main).map(t => {
    const doc = docs.find(d => d.type === t.type);
    if (!doc) {
      return `<li>
        <span class="ico" style="--c:var(--muted)">${t.emoji}</span>
        <div class="item-main" data-action="add-doc" data-vehicle-doc="${esc(v.id)}" data-type="${t.type}">
          <div class="item-title">${esc(t.name)}</div>
          <div class="item-sub"><span class="status">Sin fecha · toca para agregar</span></div>
        </div>
      </li>`;
    }
    return docRow(doc);
  });
  const extras = docs.filter(d => !docType(d.type).main).sort((a, b) => a.date.localeCompare(b.date)).map(docRow);
  return `<ul class="list">${rows.join('')}${extras.join('')}</ul>
    <button class="chip-btn mt" data-action="add-doc" data-vehicle-doc="${esc(v.id)}" data-type="poliza">+ Póliza</button>
    <button class="chip-btn mt" data-action="add-doc" data-vehicle-doc="${esc(v.id)}" data-type="otro">+ Otro documento</button>`;
}

function docRow(doc) {
  const st = docStatus(doc);
  return `<li>
    <span class="ico" style="--c:var(--accent)">${esc(doc.emoji)}</span>
    <div class="item-main" data-action="edit-doc" data-id="${esc(doc.id)}">
      <div class="item-title">${esc(doc.name)}</div>
      <div class="item-sub"><span class="status ${st.cls}">${esc(st.text)}</span>${doc.notes ? esc(doc.notes) : ''}</div>
    </div>
  </li>`;
}

/* ----- Vehículos y tanqueos ----- */

const VEHICLE_TYPES = { moto: '🏍️', carro: '🚗' };
let currentVehicle = null;

function vehicleById(id) {
  return state.vehicles.find(v => v.id === id);
}

function fuelOf(vehicleId) {
  return state.fuel.filter(f => f.vehicleId === vehicleId).sort((a, b) => a.km - b.km || a.date.localeCompare(b.date));
}

// Consumo por el método de tanque lleno a tanque lleno: km recorridos ÷ galones cargados entre ambos.
function fuelStats(vehicleId) {
  const logs = fuelOf(vehicleId);
  const perLog = {};
  let lastFull = null, galSince = 0, totalKm = 0, totalGal = 0;
  for (const f of logs) {
    if (lastFull) galSince += f.gallons;
    if (f.full) {
      if (lastFull && galSince > 0) {
        const km = f.km - lastFull.km;
        perLog[f.id] = { km, kmGal: km / galSince };
        totalKm += km;
        totalGal += galSince;
      }
      lastFull = f;
      galSince = 0;
    }
  }
  const first = logs[0], last = logs[logs.length - 1];
  const spent = sum(logs, f => f.total);
  const distance = first && last ? last.km - first.km : 0;
  // Costo por km: lo pagado sin contar el primer tanqueo (ese combustible se gastó antes del registro)
  const costKm = distance > 0 ? (spent - (first?.total || 0)) / distance : null;
  const thisMonth = monthKey(new Date());
  return {
    logs, perLog,
    avg: totalGal ? totalKm / totalGal : null,
    lastKmGal: last && perLog[last.id] ? perLog[last.id].kmGal : null,
    lastKm: last ? last.km : null,
    pricePerGal: last && last.gallons ? last.total / last.gallons : null,
    costKm,
    monthSpent: sum(logs.filter(f => f.date.startsWith(thisMonth)), f => f.total),
    monthKm: (() => {
      const m = logs.filter(f => f.date.startsWith(thisMonth));
      const before = logs.filter(f => f.date < thisMonth + '-01').pop();
      const start = before || m[0];
      return m.length && start ? m[m.length - 1].km - start.km : 0;
    })(),
  };
}

function vehicleForm(item) {
  const v = item || { type: 'moto', name: '', plate: '' };
  openSheet({
    title: item ? 'Editar vehículo' : 'Nuevo vehículo',
    body: `<div class="field"><span class="field-label">Tipo</span><div class="seg-pick">` +
        Object.entries(VEHICLE_TYPES).map(([k, e]) => `<label><input type="radio" name="type" value="${k}"${v.type === k ? ' checked' : ''}>${e} ${k === 'moto' ? 'Moto' : 'Carro'}</label>`).join('') +
      `</div></div>` +
      field('Nombre', `<input name="name" class="big-input" maxlength="40" placeholder="Ej. Pulsar 200, Mazda 3" required value="${esc(v.name)}">`) +
      field('Placa (opcional)', `<input name="plate" maxlength="7" placeholder="ABC12D" style="text-transform:uppercase" value="${esc(v.plate)}">`),
    onSubmit: d => {
      const name = d.name.trim();
      if (!name) return toast('Ponle un nombre'), false;
      const data = { type: d.type, name, plate: d.plate.trim().toUpperCase() };
      if (item) Object.assign(item, data);
      else {
        const nv = { id: uid(), ...data };
        state.vehicles.push(nv);
        currentVehicle = nv.id;
      }
      toast('Vehículo guardado');
    },
    onDelete: item && (() => {
      if (!confirm(`¿Eliminar ${item.name} con sus tanqueos y documentos? (Los gastos ya registrados en Finanzas se conservan.)`)) return false;
      state.vehicles = state.vehicles.filter(x => x.id !== item.id);
      state.fuel = state.fuel.filter(f => f.vehicleId !== item.id);
      state.utils.docs = state.utils.docs.filter(d => d.vehicleId !== item.id);
      currentVehicle = null;
      toast('Vehículo eliminado');
    }),
  });
}

function fuelForm(item) {
  if (!state.vehicles.length) return vehicleForm(null);
  const vid = item?.vehicleId || currentVehicle || state.vehicles[0].id;
  const prev = fuelOf(vid).filter(f => !item || f.id !== item.id).pop();
  const v = item || { date: todayIso(), km: '', gallons: '', total: '', full: true, accountId: defaultAccountId() };
  openSheet({
    title: item ? 'Editar tanqueo' : '⛽ Nuevo tanqueo',
    body: (state.vehicles.length > 1 ? `<div class="field"><span class="field-label">Vehículo</span><div class="seg-pick">` +
        state.vehicles.map(x => `<label><input type="radio" name="vehicleId" value="${esc(x.id)}"${x.id === vid ? ' checked' : ''}>${VEHICLE_TYPES[x.type]} ${esc(x.name)}</label>`).join('') +
      `</div></div>` : `<input type="hidden" name="vehicleId" value="${esc(vid)}">`) +
      `<div class="field-row">` +
        field('Kilometraje (odómetro)', `<input name="km" inputmode="numeric" required placeholder="${prev ? 'Último: ' + prev.km.toLocaleString('es-CO') : 'Ej. 15230'}" value="${esc(v.km)}" autofocus>`) +
        field('Fecha', `<input name="date" type="date" required value="${esc(v.date)}">`) +
      `</div>` +
      `<div class="field-row">` +
        field('Galones', `<input name="gallons" inputmode="decimal" required placeholder="Ej. 2,8" value="${esc(v.gallons)}">`) +
        field('Valor pagado', `<input name="total" inputmode="decimal" required placeholder="$ 0" value="${esc(v.total)}">`) +
      `</div>` +
      `<label class="switch-row">⛽ Tanque lleno<input type="checkbox" name="full"${v.full ? ' checked' : ''}></label>` +
      `<p class="muted small" style="margin:-6px 0 12px">Para calcular bien el consumo, llena el tanque siempre que puedas y marca esta casilla.</p>` +
      accountPicker(v.accountId) +
      (item ? '' : `<label class="switch-row">💰 Registrar en Finanzas como gasto<input type="checkbox" name="toExpense" checked></label>`),
    saveLabel: item ? 'Guardar' : 'Registrar tanqueo',
    onSubmit: d => {
      const km = parseInt(String(d.km).replace(/\D/g, ''), 10);
      const gallons = parseFloat(String(d.gallons).replace(',', '.'));
      const total = parseAmount(d.total);
      if (!km || !(gallons > 0) || !total) return toast('Completa kilometraje, galones y valor'), false;
      if (!d.accountId) return toast('Elige con qué banco o tarjeta pagaste'), false;
      const others = fuelOf(d.vehicleId).filter(f => !item || f.id !== item.id);
      const before = others.filter(f => f.date <= d.date).pop();
      if (before && km <= before.km) return toast(`El kilometraje debe ser mayor a ${before.km.toLocaleString('es-CO')}`), false;
      const data = { vehicleId: d.vehicleId, date: d.date, km, gallons, total, full: !!d.full, accountId: d.accountId || defaultAccountId() };
      const veh = vehicleById(d.vehicleId);
      let f = item;
      if (f) {
        Object.assign(f, data);
        const exp = findExpense(f.expenseId);
        if (exp) Object.assign(exp.e, { amount: total, date: d.date, accountId: data.accountId, note: `Tanqueo ${veh.name}` });
      } else {
        f = { id: uid(), ...data, expenseId: null };
        if (d.toExpense) {
          const e = { id: uid(), amount: total, categoryId: 'transporte', note: `Tanqueo ${veh.name}`, date: d.date, accountId: data.accountId, plannedId: null, createdAt: Date.now() };
          getMonth(d.date.slice(0, 7), true).expenses.push(e);
          f.expenseId = e.id;
        }
        state.fuel.push(f);
      }
      currentVehicle = d.vehicleId;
      const st = fuelStats(d.vehicleId).perLog[f.id];
      toast(st ? `⛽ Guardado · ${st.kmGal.toFixed(1)} km/galón en este tanque` : '⛽ Tanqueo guardado');
    },
    onDelete: item && (() => {
      const exp = findExpense(item.expenseId);
      if (exp && confirm('¿Eliminar también el gasto registrado en Finanzas?')) {
        exp.m.expenses = exp.m.expenses.filter(e => e.id !== item.expenseId);
      }
      state.fuel = state.fuel.filter(f => f.id !== item.id);
      toast('Tanqueo eliminado');
    }),
  });
}

function findExpense(id) {
  if (!id) return null;
  for (const m of Object.values(state.months)) {
    const e = m.expenses.find(x => x.id === id);
    if (e) return { m, e };
  }
  return null;
}

function renderVehicles() {
  const box = $('#vehBox');
  if (!state.vehicles.length) {
    box.innerHTML = `<div class="empty-block">Agrega tu moto o tu carro para llevar el registro de tanqueos y consumo.<br><br>
      <button class="btn primary" data-action="add-vehicle">+ Agregar vehículo</button></div>`;
    return;
  }
  if (!vehicleById(currentVehicle)) currentVehicle = state.vehicles[0].id;
  const v = vehicleById(currentVehicle);
  const st = fuelStats(v.id);
  const n = x => x == null ? '—' : x.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  box.innerHTML = `
    <div class="chips-scroll">${state.vehicles.map(x =>
      `<button class="chip${x.id === v.id ? ' on' : ''}" data-vehicle="${esc(x.id)}">${VEHICLE_TYPES[x.type]} ${esc(x.name)}</button>`).join('')}
      <button class="chip" data-action="add-vehicle">+ Vehículo</button></div>
    <div class="card veh-card">
      <div class="card-head">
        <div><h2>${VEHICLE_TYPES[v.type]} ${esc(v.name)}</h2><span class="muted small">${v.plate ? esc(v.plate) + ' · ' : ''}${st.lastKm != null ? n(st.lastKm) + ' km' : 'Sin registros'}</span></div>
        <button class="chip-btn" data-action="edit-vehicle" data-id="${esc(v.id)}">Editar</button>
      </div>
      <div class="veh-big"><strong>${st.avg ? n(st.avg) : '—'}</strong><span>km por galón<br><small>promedio</small></span></div>
      <div class="stats-grid">
        <div class="mini-card"><span>Último tanque</span><strong>${st.lastKmGal ? n(st.lastKmGal) + ' km/gal' : '—'}</strong></div>
        <div class="mini-card"><span>Costo por km</span><strong>${st.costKm ? money(Math.round(st.costKm)) : '—'}</strong></div>
        <div class="mini-card"><span>Gasolina este mes</span><strong>${money(st.monthSpent)}</strong></div>
        <div class="mini-card"><span>Km este mes</span><strong>${n(st.monthKm)} km</strong></div>
      </div>
      ${st.pricePerGal ? `<p class="muted small" style="margin:10px 0 0">Último precio: ${money(Math.round(st.pricePerGal))} por galón</p>` : ''}
      <button class="btn primary full mt" data-action="add-fuel">⛽ Registrar tanqueo</button>
    </div>
    <div class="card">
      <div class="card-head"><h2>📄 Documentos</h2></div>
      <p class="muted small">Te avisamos en Inicio cuando falte menos de un mes para que se venzan.</p>
      ${vehicleDocsHtml(v)}
    </div>
    ${st.logs.length ? `<div class="group-title">Historial de tanqueos</div><div class="card"><ul class="list">${[...st.logs].reverse().map(f => {
      const p = st.perLog[f.id];
      return `<li>
        <span class="ico" style="--c:var(--accent)">⛽</span>
        <div class="item-main" data-action="edit-fuel" data-id="${esc(f.id)}">
          <div class="item-title">${esc(capitalize(formatDate(f.date)))} · ${n(f.km)} km</div>
          <div class="item-sub">${n(f.gallons)} gal${f.full ? ' · lleno' : ' · parcial'}${p ? ` · <span class="status ok">${n(p.km)} km · ${n(p.kmGal)} km/gal</span>` : ''} ${accountTag(f)}</div>
        </div>
        <span class="amount">${money(f.total)}</span>
      </li>`;
    }).join('')}</ul></div>` : ''}`;
}

function renderUtils() {
  renderVehicles();
  // Documentos que quedaron sin vehículo (de versiones anteriores)
  const loose = state.utils.docs.filter(d => !vehicleById(d.vehicleId));
  $('#looseDocsCard').hidden = !loose.length;
  $('#looseDocs').innerHTML = loose.map(docRow).join('');
}

function renderDayStrip() {
  const due = state.utils.docs.map(d => ({ d, st: docStatus(d) })).filter(x => x.st.diff <= 30).sort((a, b) => a.st.diff - b.st.diff);
  $('#dayStrip').innerHTML = due.map(x =>
    `<button class="strip-chip warn" data-goto="utilidades">${esc(x.d.emoji)} ${esc(docLabel(x.d))}: ${esc(x.st.text.toLowerCase())}</button>`).join('');
  $('#dayStrip').hidden = !due.length;
}

// El módulo de fútbol se retiró: se borran la clave y los datos que hubiera guardado.
try { localStorage.removeItem('maurion.apikey'); localStorage.removeItem('maurion.fx'); } catch { /* nada */ }

/* ===================== Bienvenida ===================== */

function startOnboarding() {
  const ob = $('#onboarding');
  ob.hidden = false;
  let step = 0;
  let currency = CURRENCIES.find(c => c.code === state.currency) ? state.currency : 'COP';
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
  const vchip = e.target.closest('[data-vehicle]');
  if (vchip) {
    currentVehicle = vchip.dataset.vehicle;
    return renderVehicles();
  }

  const nav = e.target.closest('[data-goto]');
  if (nav) return goto(nav.dataset.goto, nav.dataset.sub);

  const seg = e.target.closest('.seg [data-sub]');
  if (seg) return goto(currentView, seg.dataset.sub);

  const tchip = e.target.closest('[data-task-filter]');
  if (tchip) {
    taskFilter = tchip.dataset.taskFilter;
    return renderTasks();
  }

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
    case 'fab': return fabAction();
    case 'add-task': return taskForm(null);
    case 'edit-task': return taskForm(state.tasks.find(x => x.id === id));
    case 'toggle-task': return toggleTask(id);
    case 'add-reminder': return reminderForm(null);
    case 'edit-reminder': return reminderForm(state.reminders.find(x => x.id === id));
    case 'preset-outlook': return reminderForm(null, PRESETS[0]);
    case 'add-note': return noteForm(null);
    case 'add-vehicle': return vehicleForm(null);
    case 'edit-vehicle': return vehicleForm(vehicleById(id));
    case 'add-fuel': return fuelForm(null);
    case 'edit-fuel': return fuelForm(state.fuel.find(x => x.id === id));
    case 'pay-card': return payCardForm();
    case 'add-account': return accountForm(null);
    case 'open-account': return accountSheet(accountById(id));
    case 'transfer': return transferForm();
    case 'add-doc': return docForm(null, { vehicleId: el.dataset.vehicleDoc || currentVehicle, type: el.dataset.type || 'soat' });
    case 'edit-doc': return docForm(state.utils.docs.find(x => x.id === id));

    case 'edit-note': return noteForm(state.notes.find(x => x.id === id));
    case 'add-expense': return expenseForm(null);
    case 'edit-expense': return expenseForm(m.expenses.find(x => x.id === id));
    case 'add-income': return incomeForm(null);
    case 'edit-income': return incomeForm(m.incomes.find(x => x.id === id));
    case 'add-planned': return plannedForm(null);
    case 'edit-planned': return plannedForm(m.planned.find(x => x.id === id));
    case 'toggle-paid':
      if (el.dataset.month) currentMonth = el.dataset.month;
      return togglePaid(id);
    case 'toggle-reminder': return toggleReminder(id);
    case 'quick': return quickAdd(el.dataset.kind);
    case 'edit-carry': return carryForm();
    case 'set-pin': return pinSetupForm();
    case 'remove-lock': return removeLock();
    case 'enable-faceid': return enableFaceId();
    case 'enable-badge': return enableBadge();
    case 'mic': return startDictation(el);
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
  if (!touchStart || currentView !== 'finanzas') return;
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

$('#defaultAccount').addEventListener('change', e => {
  state.settings.defaultAccount = e.target.value;
  saveState();
});

$('#outlookType').addEventListener('change', e => {
  state.settings.outlook = e.target.value;
  saveState();
});

$('#noteSearch').addEventListener('input', e => {
  noteQuery = e.target.value.trim().toLowerCase();
  renderNotes();
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
  download(`maurion-${todayIso()}.json`, JSON.stringify(state, null, 2), 'application/json');
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
  const rows = [['Fecha', 'Categoría', 'Descripción', 'Monto', 'Tipo', 'Cuenta']]
    .concat([...m.expenses].sort((a, b) => a.date.localeCompare(b.date)).map(e =>
      [e.date, catById(e.categoryId).name, e.note, e.amount.toFixed(2), e.plannedId ? 'Fijo' : 'Adicional', accountOf(e)?.name || '']));
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
  if (document.visibilityState === 'visible') {
    render();
  }
});

render();
goto('hub');
if (!state.profile.onboarded) startOnboarding();
else showLock();

const APP_VERSION = '17';
$('#appVersion').textContent = 'Versión ' + APP_VERSION;

// Borra la caché y recarga para traer la última versión publicada.
$('#forceUpdate').addEventListener('click', async () => {
  toast('Buscando actualización…');
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    await Promise.all(regs.map(r => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  } catch { /* sin service worker */ }
  location.reload();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
}
