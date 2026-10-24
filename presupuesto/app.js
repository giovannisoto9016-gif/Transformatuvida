'use strict';

/* ===================== Datos ===================== */

const STORAGE_KEY = 'presupuesto.v1';
const FALLBACK_CAT = 'otros';

const DEFAULT_CATEGORIES = [
  { id: 'vivienda', name: 'Vivienda', emoji: '🏠' },
  { id: 'servicios', name: 'Servicios', emoji: '💡' },
  { id: 'mercado', name: 'Mercado', emoji: '🛒' },
  { id: 'transporte', name: 'Transporte', emoji: '🚌' },
  { id: 'salud', name: 'Salud', emoji: '🩺' },
  { id: 'deudas', name: 'Deudas', emoji: '💳' },
  { id: 'educacion', name: 'Educación', emoji: '📚' },
  { id: 'comida', name: 'Comida fuera', emoji: '🍔' },
  { id: 'ocio', name: 'Ocio', emoji: '🎉' },
  { id: 'ahorro', name: 'Ahorro', emoji: '🐷' },
  { id: FALLBACK_CAT, name: 'Otros', emoji: '📦' },
];

const EMOJIS = ['🏠','💡','💧','📱','🛒','🚌','⛽','🚗','🩺','💊','💳','📚','🍔','☕','🎉','🎬','👕','💇','🐶','👶','🎁','✈️','🏋️','🐷','💼','🧾','🔧','📦'];

const INCOME_EMOJI = '💰';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultState() {
  return { version: 1, currency: 'USD', categories: DEFAULT_CATEGORIES.map(c => ({ ...c })), months: {} };
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
  s.currency = s.currency || 'USD';
  for (const key of Object.keys(s.months)) {
    const m = s.months[key];
    m.incomes = m.incomes || [];
    m.planned = m.planned || [];
    m.expenses = m.expenses || [];
  }
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

function monthKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
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

function money(n) {
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency: state.currency, maximumFractionDigits: 2 }).format(n || 0);
  } catch {
    return (n || 0).toFixed(2);
  }
}

function sum(arr, f = x => x.amount) {
  return arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function todayIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Fecha por defecto para un gasto del mes visible: hoy si es el mes actual, si no el día 1.
function defaultDateForMonth() {
  const t = todayIso();
  return t.startsWith(currentMonth) ? t : currentMonth + '-01';
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function parseAmount(v) {
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function catOptions(selected) {
  return state.categories
    .map(c => `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`)
    .join('');
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

/* ===================== Render ===================== */

function render() {
  const [y, mo] = currentMonth.split('-').map(Number);
  const label = new Date(y, mo - 1, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  $('#monthLabel').textContent = label.charAt(0).toUpperCase() + label.slice(1);
  $('#currency').value = state.currency;
  renderResumen();
  renderPresupuesto();
  renderGastos();
  renderAjustes();
}

function emptyItem(text) {
  return `<li class="empty">${esc(text)}</li>`;
}

function renderResumen() {
  const m = getMonth();
  const t = totals(m);

  $('#sumIncome').textContent = money(t.income);
  $('#sumSpent').textContent = money(t.spent);
  $('#sumPlanned').textContent = money(t.planned);
  const avail = $('#sumAvailable');
  avail.textContent = money(t.available);
  avail.classList.toggle('negative', t.available < 0);

  const pct = t.income > 0 ? Math.round((t.spent / t.income) * 100) : 0;
  $('#usePct').textContent = t.income > 0 ? pct + '% gastado' : '';
  const bar = $('#useBar');
  bar.style.width = Math.min(pct, 100) + '%';
  bar.className = 'bar-fill' + (pct > 100 ? ' over' : pct > 85 ? ' warn' : '');

  let note;
  if (t.income === 0 && t.planned === 0 && t.spent === 0) {
    note = 'Empieza en la pestaña Presupuesto: agrega tus ingresos y tus gastos fijos del mes.';
  } else {
    note = `Disponible es lo que te queda libre después de cubrir lo proyectado en cada categoría ` +
      `(o lo gastado, si te pasaste). Gastos adicionales (no proyectados): ${money(t.extras)}.`;
    if (t.available < 0) note += ' ⚠️ Vas a gastar más de lo que ingresa este mes.';
  }
  $('#projectionNote').textContent = note;

  // Por categoría
  const rows = state.categories.map(c => {
    const planned = sum(m.planned.filter(p => p.categoryId === c.id));
    const spent = sum(m.expenses.filter(e => catById(e.categoryId).id === c.id));
    return { c, planned, spent };
  }).filter(r => r.planned > 0 || r.spent > 0)
    .sort((a, b) => b.spent - a.spent || b.planned - a.planned);

  $('#catSummary').innerHTML = rows.length ? rows.map(({ c, planned, spent }) => {
    const ratio = planned > 0 ? spent / planned : (spent > 0 ? 1.01 : 0);
    const cls = ratio > 1 ? ' over' : ratio > 0.85 ? ' warn' : '';
    const label = planned > 0 ? `${money(spent)} / ${money(planned)}` : `${money(spent)} · sin proyectar`;
    return `<li>
      <div class="cat-head"><span>${esc(c.emoji)}</span><span class="name">${esc(c.name)}</span><span class="nums">${label}</span></div>
      <div class="bar"><div class="bar-fill${cls}" style="width:${Math.min(ratio * 100, 100)}%"></div></div>
    </li>`;
  }).join('') : emptyItem('Aún no hay movimientos este mes.');

  // Pendientes
  const pending = m.planned.filter(p => !p.paidExpenseId).sort((a, b) => (a.dueDay || 99) - (b.dueDay || 99));
  $('#pendingTotal').textContent = pending.length ? money(t.pending) : '';
  $('#pendingList').innerHTML = pending.length
    ? pending.map(p => plannedItem(p)).join('')
    : emptyItem(m.planned.length ? '¡Todo pagado! 🎉' : 'No tienes gastos proyectados.');
}

function plannedItem(p) {
  const c = catById(p.categoryId);
  const paid = !!p.paidExpenseId;
  const sub = [c.name, p.dueDay ? 'día ' + p.dueDay : ''].filter(Boolean).join(' · ');
  return `<li class="${paid ? 'paid' : ''}">
    <button class="check${paid ? ' on' : ''}" data-action="toggle-paid" data-id="${esc(p.id)}" aria-label="${paid ? 'Marcar como no pagado' : 'Marcar como pagado'}">${paid ? '✓' : ''}</button>
    <div class="item-main" data-action="edit-planned" data-id="${esc(p.id)}">
      <div class="item-title">${esc(p.name)}</div>
      <div class="item-sub">${esc(sub)}</div>
    </div>
    <span class="amount">${money(p.amount)}</span>
  </li>`;
}

function renderPresupuesto() {
  const m = getMonth();
  $('#incomeList').innerHTML = m.incomes.length ? m.incomes.map(i => `<li>
      <span class="emoji">${INCOME_EMOJI}</span>
      <div class="item-main" data-action="edit-income" data-id="${esc(i.id)}"><div class="item-title">${esc(i.name)}</div></div>
      <span class="amount pos">${money(i.amount)}</span>
    </li>`).join('') : emptyItem('Agrega tu salario u otros ingresos.');
  $('#incomeTotal').textContent = money(sum(m.incomes));

  const planned = [...m.planned].sort((a, b) => (a.dueDay || 99) - (b.dueDay || 99));
  $('#plannedList').innerHTML = planned.length ? planned.map(plannedItem).join('') : emptyItem('Agrega los gastos que ya sabes que tendrás.');
  $('#plannedTotal').textContent = money(sum(m.planned));
}

function renderGastos() {
  const m = getMonth();
  const filter = $('#filterCat');
  const prev = filter.value || 'all';
  filter.innerHTML = '<option value="all">Todas</option><option value="extras">Solo adicionales</option>' + catOptions(prev);
  filter.value = [...filter.options].some(o => o.value === prev) ? prev : 'all';

  let list = [...m.expenses];
  if (filter.value === 'extras') list = list.filter(e => !e.plannedId);
  else if (filter.value !== 'all') list = list.filter(e => catById(e.categoryId).id === filter.value);
  list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));

  $('#expenseList').innerHTML = list.length ? list.map(e => {
    const c = catById(e.categoryId);
    return `<li>
      <span class="emoji">${esc(c.emoji)}</span>
      <div class="item-main" data-action="edit-expense" data-id="${esc(e.id)}">
        <div class="item-title">${esc(e.note || c.name)}${e.plannedId ? '<span class="tag">proyectado</span>' : ''}</div>
        <div class="item-sub">${esc(formatDate(e.date))} · ${esc(c.name)}</div>
      </div>
      <span class="amount neg">−${money(e.amount)}</span>
    </li>`;
  }).join('') : emptyItem('Toca el botón + para registrar un gasto.');
  $('#expenseTotal').textContent = money(sum(list));
}

function renderAjustes() {
  $('#categoryList').innerHTML = state.categories.map(c => `<li>
      <span class="emoji">${esc(c.emoji)}</span>
      <div class="item-main" data-action="edit-category" data-id="${esc(c.id)}"><div class="item-title">${esc(c.name)}</div></div>
    </li>`).join('');
}

/* ===================== Modal ===================== */

const modal = $('#modal');
let modalSubmit = null;
let modalDelete = null;

function openModal({ title, body, onSubmit, onDelete, saveLabel = 'Guardar' }) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  $('#modalSave').textContent = saveLabel;
  $('#modalDelete').hidden = !onDelete;
  modalSubmit = onSubmit;
  modalDelete = onDelete;
  modal.showModal();
  const first = modal.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 50);
}

function closeModal() {
  modal.close();
  modalSubmit = modalDelete = null;
}

$('#modalForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!modalSubmit) return closeModal();
  const data = Object.fromEntries(new FormData(e.target));
  if (modalSubmit(data) !== false) {
    closeModal();
    saveState();
    render();
  }
});
$('#modalCancel').addEventListener('click', closeModal);
$('#modalDelete').addEventListener('click', () => {
  if (modalDelete && modalDelete() !== false) {
    closeModal();
    saveState();
    render();
  }
});

function field(label, html) {
  return `<div class="field"><label>${esc(label)}</label>${html}</div>`;
}

function amountInput(value) {
  return `<input name="amount" inputmode="decimal" autocomplete="off" placeholder="0" required value="${value != null ? esc(value) : ''}" autofocus>`;
}

/* ----- Ingresos ----- */

function incomeForm(item) {
  openModal({
    title: item ? 'Editar ingreso' : 'Nuevo ingreso',
    body: field('Monto', amountInput(item?.amount)) +
      field('Concepto', `<input name="name" maxlength="60" placeholder="Salario, freelance…" value="${esc(item?.name || '')}">`),
    onSubmit: d => {
      const amount = parseAmount(d.amount);
      if (!amount) return toast('Escribe un monto válido'), false;
      const name = d.name.trim() || 'Ingreso';
      const m = ensureMonth();
      if (item) Object.assign(item, { amount, name });
      else m.incomes.push({ id: uid(), name, amount });
      toast('Ingreso guardado');
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
  openModal({
    title: item ? 'Editar gasto proyectado' : 'Nuevo gasto proyectado',
    body: field('Monto', amountInput(item?.amount)) +
      field('Concepto', `<input name="name" maxlength="60" placeholder="Arriendo, internet…" required value="${esc(item?.name || '')}">`) +
      `<div class="field-row">` +
        field('Categoría', `<select name="categoryId">${catOptions(item?.categoryId || 'vivienda')}</select>`) +
        field('Día de pago', `<input name="dueDay" type="number" min="1" max="31" inputmode="numeric" placeholder="Opcional" value="${item?.dueDay || ''}">`) +
      `</div>`,
    onSubmit: d => {
      const amount = parseAmount(d.amount);
      if (!amount) return toast('Escribe un monto válido'), false;
      const name = d.name.trim();
      if (!name) return toast('Escribe un concepto'), false;
      const dueDay = Math.min(31, Math.max(1, parseInt(d.dueDay, 10))) || null;
      const m = ensureMonth();
      if (item) {
        Object.assign(item, { amount, name, categoryId: d.categoryId, dueDay });
        const linked = m.expenses.find(e => e.id === item.paidExpenseId);
        if (linked) Object.assign(linked, { amount, categoryId: d.categoryId, note: name });
      } else {
        m.planned.push({ id: uid(), name, amount, categoryId: d.categoryId, dueDay, paidExpenseId: null });
      }
      toast('Gasto proyectado guardado');
    },
    onDelete: item && (() => {
      const m = ensureMonth();
      if (item.paidExpenseId && !confirm('Este gasto ya está pagado. ¿Eliminar también el pago registrado?')) return false;
      m.expenses = m.expenses.filter(e => e.id !== item.paidExpenseId);
      m.planned = m.planned.filter(p => p.id !== item.id);
      toast('Gasto proyectado eliminado');
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
      const [y, mo] = currentMonth.split('-').map(Number);
      const last = new Date(y, mo, 0).getDate();
      date = currentMonth + '-' + String(Math.min(p.dueDay, last)).padStart(2, '0');
    }
    const exp = { id: uid(), date, amount: p.amount, categoryId: p.categoryId, note: p.name, plannedId: p.id, createdAt: Date.now() };
    m.expenses.push(exp);
    p.paidExpenseId = exp.id;
    toast('¡Pagado! Se registró en tus gastos');
  }
  saveState();
  render();
}

/* ----- Gastos ----- */

function expenseForm(item) {
  const m = getMonth();
  const linked = item?.plannedId ? m.planned.find(p => p.id === item.plannedId) : null;
  openModal({
    title: item ? 'Editar gasto' : 'Registrar gasto',
    body: field('Monto', amountInput(item?.amount)) +
      field('Categoría', `<select name="categoryId">${catOptions(item?.categoryId || 'mercado')}</select>`) +
      field('Descripción', `<input name="note" maxlength="80" placeholder="¿En qué gastaste?" value="${esc(item?.note || '')}">`) +
      field('Fecha', `<input name="date" type="date" required value="${esc(item?.date || defaultDateForMonth())}">`) +
      (linked ? `<p class="muted small">Este gasto corresponde al pago de “${esc(linked.name)}”.</p>` : ''),
    onSubmit: d => {
      const amount = parseAmount(d.amount);
      if (!amount) return toast('Escribe un monto válido'), false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return toast('Elige una fecha'), false;
      const targetKey = d.date.slice(0, 7);
      const data = { amount, categoryId: d.categoryId, note: d.note.trim(), date: d.date };

      if (item) {
        const src = ensureMonth();
        if (targetKey !== currentMonth && item.plannedId) {
          return toast('Un pago proyectado debe quedar en este mes'), false;
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
        toast(targetKey === currentMonth ? 'Gasto registrado' : 'Gasto registrado en otro mes');
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
  let chosen = item?.emoji || EMOJIS[0];
  openModal({
    title: item ? 'Editar categoría' : 'Nueva categoría',
    body: field('Nombre', `<input name="name" maxlength="30" required autofocus value="${esc(item?.name || '')}">`) +
      field('Ícono', `<div class="emoji-picker">${EMOJIS.map(em =>
        `<button type="button" data-emoji="${em}" class="${em === chosen ? 'on' : ''}">${em}</button>`).join('')}</div>`) +
      `<input type="hidden" name="emoji" value="${esc(chosen)}">`,
    onSubmit: d => {
      const name = d.name.trim();
      if (!name) return toast('Escribe un nombre'), false;
      if (item) Object.assign(item, { name, emoji: d.emoji });
      else state.categories.splice(state.categories.length - 1, 0, { id: uid(), name, emoji: d.emoji });
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
  modal.querySelector('.emoji-picker').addEventListener('click', e => {
    const b = e.target.closest('[data-emoji]');
    if (!b) return;
    modal.querySelectorAll('.emoji-picker button').forEach(x => x.classList.toggle('on', x === b));
    modal.querySelector('[name="emoji"]').value = b.dataset.emoji;
  });
}

/* ===================== Eventos ===================== */

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const id = el.dataset.id;
  const m = getMonth();
  switch (el.dataset.action) {
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

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab.dataset.view));
  window.scrollTo(0, 0);
}));

$('#prevMonth').addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, -1); render(); });
$('#nextMonth').addEventListener('click', () => { currentMonth = shiftMonth(currentMonth, 1); render(); });

$('#filterCat').addEventListener('change', renderGastos);

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
      !confirm('Este mes ya tiene datos. ¿Agregar los ingresos y gastos proyectados del mes anterior?')) return;
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
      [e.date, catById(e.categoryId).name, e.note, e.amount.toFixed(2), e.plannedId ? 'Proyectado' : 'Adicional']));
  download(`gastos-${currentMonth}.csv`, '﻿' + rows.map(r => r.map(q).join(',')).join('\n'), 'text/csv');
});

$('#resetAll').addEventListener('click', () => {
  if (!confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
  state = defaultState();
  saveState();
  render();
  toast('Datos borrados');
});

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW', err));
}
