const $ = s => document.querySelector(s);
const KEY = 'gastos';
// Not crypto.randomUUID: it requires HTTPS and the app may run over plain http on the LAN.
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const money = n => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const num = n => n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ym = d => d.toLocaleDateString('en-CA').slice(0, 7); // local YYYY-MM
const addMonths = (m, n) => ym(new Date(+m.slice(0, 4), +m.slice(5) - 1 + n, 1));
const label = m => `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}`;

// Item: { id, cat, name, method, cut, amount, from, to, log: { 'YYYY-MM': { amt?, paid? } } }
// amount is the recurring default; log[m].amt overrides it for one month (0 hides that month).
const entry = (it, m) => it.log[m] || {};
const inRange = (it, m) => it.from <= m && (!it.to || m <= it.to);
const shows = (it, m) => entry(it, m).amt > 0 || (inRange(it, m) && entry(it, m).amt === undefined);
const amountOf = (it, m) => entry(it, m).amt ?? (inRange(it, m) ? it.amount : 0);
const isPaid = (it, m) => !!entry(it, m).paid;
function isLate(it, m) {
  const now = ym(new Date());
  return !isPaid(it, m) && amountOf(it, m) > 0 && (m < now || (m === now && it.cut && it.cut < new Date().getDate()));
}

let S = load();
let month = ym(new Date());
let editing = null;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s?.items) return s;
  } catch {}
  return { income: 0, items: seed() };
}
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

// First run: example data starting this month. Real data comes in via Ajustes > Importar.
function seed() {
  const from = ym(new Date());
  const mk = (cat, name, method, cut, amount, to = null) => ({ id: uid(), cat, name, method, cut, amount, from, to, log: {} });
  return [
    mk('Vivienda', 'Renta', 'Transferencia', 1, 8000),
    mk('Servicios', 'Internet', 'Tarjeta de crédito', 10, 600),
    mk('Servicios', 'Luz', 'Efectivo', null, 0),
    mk('Suscripciones', 'Música', 'Tarjeta de crédito', 15, 129),
    mk('Préstamos', 'Préstamo auto', 'Tarjeta de débito', 5, 3500, addMonths(from, 11)),
  ];
}

const view = () => $('[name=view]:checked').value;
const yearMonths = () => MONTHS.map((_, i) => `${month.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`);

function render() {
  $('#title').textContent = view() === 'year' ? month.slice(0, 4) : label(month);
  const months = view() === 'year' ? yearMonths() : [month];
  renderSummary(months);
  view() === 'year' ? renderYear(months) : renderList(view());
}

function renderSummary(months) {
  let total = 0, paid = 0, late = 0, n = 0, done = 0;
  for (const m of months) for (const it of S.items) if (shows(it, m)) {
    const a = amountOf(it, m);
    total += a; n++;
    if (isPaid(it, m)) { paid += a; done++; } else if (isLate(it, m)) late += a;
  }
  const income = S.income * months.length;
  const stat = (k, v, c = '') => `<div class="${c}"><small>${k}</small><b>${money(v)}</b></div>`;
  $('#summary').innerHTML = `
    <small>Por pagar</small><div class="big">${money(total - paid)}</div>
    <div class="bar"><i style="width:${total ? paid / total * 100 : 0}%"></i></div>
    <small>${done} de ${n} pagados</small>
    <div class="stats">${stat('Total', total)}${stat('Pagado', paid, 'ok')}${stat('Vencido', late, late ? 'late' : '')}
    ${income ? stat('Ingreso', income) + stat('Disponible', income - total, income < total ? 'late' : 'ok') : ''}</div>`;
}

function renderList(by) {
  const groups = {};
  for (const it of S.items) if (shows(it, month)) (groups[it[by] || 'Sin asignar'] ??= []).push(it);
  const row = it => {
    const a = amountOf(it, month), cls = isPaid(it, month) ? 'paid' : isLate(it, month) ? 'late' : '';
    const meta = [by === 'cat' ? it.method : it.cat, it.cut && `día ${it.cut}`].filter(Boolean).map(esc).join(' · ');
    return `<div class="item ${cls}" data-id="${it.id}">
      <button class="chk" data-pay aria-label="Marcar pagado" aria-pressed="${cls === 'paid'}"></button>
      <div class="info"><b>${esc(it.name)}</b><small>${meta}</small></div>
      <span class="amt">${a ? money(a) : 'sin monto'}</span></div>`;
  };
  $('#list').innerHTML = Object.entries(groups).map(([g, its]) => {
    its.sort((a, b) => (a.cut || 99) - (b.cut || 99));
    const sum = its.reduce((t, it) => t + amountOf(it, month), 0);
    return `<h3 class="section-title">${esc(g)}<span>${money(sum)}</span></h3><div class="card list">${its.map(row).join('')}</div>`;
  }).join('') || '<p class="note">Sin pagos este mes.</p>';
}

function renderYear(months) {
  const its = S.items.filter(it => months.some(m => shows(it, m)));
  const cats = [...new Set(its.map(it => it.cat || 'Sin asignar'))];
  const cell = (it, m) => shows(it, m)
    ? `<td data-m="${m}" class="${isPaid(it, m) ? 'paid' : isLate(it, m) ? 'late' : ''}">${amountOf(it, m) ? num(amountOf(it, m)) : '—'}</td>`
    : `<td data-m="${m}"></td>`;
  const totals = months.map(m => S.items.reduce((t, it) => t + (shows(it, m) ? amountOf(it, m) : 0), 0));
  $('#list').innerHTML = `<div class="scroll"><table>
    <thead><tr><th>Pago</th>${MONTHS.map(x => `<th>${x.slice(0, 3)}</th>`).join('')}</tr></thead>
    <tbody>${cats.map(c => `<tr class="grp"><th colspan="13">${esc(c)}</th></tr>` +
      its.filter(it => (it.cat || 'Sin asignar') === c).map(it => `<tr><th data-id="${it.id}">${esc(it.name)}</th>${months.map(m => cell(it, m)).join('')}</tr>`).join('')).join('')}</tbody>
    <tfoot><tr><th>Total</th>${totals.map((t, i) => `<td data-m="${months[i]}">${num(t)}</td>`).join('')}</tr></tfoot>
  </table></div><p class="note">Toca un mes para abrirlo. Verde = pagado, rojo = vencido.</p>`;
}

$('#list').addEventListener('click', e => {
  const cell = e.target.closest('td[data-m]');
  if (cell) { month = cell.dataset.m; $('[name=view][value=cat]').checked = true; return render(); }
  const el = e.target.closest('[data-id]');
  if (!el) return;
  const it = S.items.find(x => x.id === el.dataset.id);
  if (e.target.closest('[data-pay]') && amountOf(it, month) > 0) {
    const en = it.log[month] ??= {};
    en.paid = !en.paid;
    save(); render();
  } else openEdit(it);
});

const form = $('#form'), f = form.elements;
function openEdit(it) {
  editing = it;
  form.reset();
  const en = it ? entry(it, month) : {};
  $('#editTitle').textContent = it ? 'Editar pago' : 'Nuevo pago';
  f.nombre.value = it?.name ?? '';
  f.cat.value = it?.cat ?? '';
  f.method.value = it?.method ?? '';
  f.cut.value = it?.cut ?? '';
  f.amount.value = it?.amount || '';
  f.from.value = it?.from ?? month;
  f.to.value = it?.to ?? '';
  $('#monthLabel').textContent = label(month);
  f.monthAmt.value = en.amt ?? '';
  f.monthAmt.placeholder = it?.amount ? `${it.amount} (fijo)` : '';
  f.paid.checked = !!en.paid;
  $('#del').hidden = !it;
  const opts = k => [...new Set(S.items.map(x => x[k]).filter(Boolean))].map(v => `<option value="${esc(v)}">`).join('');
  $('#cats').innerHTML = opts('cat');
  $('#methods').innerHTML = opts('method');
  $('#edit').showModal();
}

form.addEventListener('submit', e => {
  if (e.submitter?.value !== 'save') return;
  const it = editing ?? { id: uid(), log: {} };
  Object.assign(it, {
    name: f.nombre.value.trim(), cat: f.cat.value.trim(), method: f.method.value.trim(),
    cut: +f.cut.value || null, amount: +f.amount.value || 0, from: f.from.value, to: f.to.value || null,
  });
  const en = it.log[month] ??= {};
  if (f.monthAmt.value === '') delete en.amt; else en.amt = +f.monthAmt.value;
  if (f.paid.checked) en.paid = true; else delete en.paid;
  if (!Object.keys(en).length) delete it.log[month];
  if (!editing) S.items.push(it);
  save(); render();
});

$('#del').addEventListener('click', () => {
  if (!confirm(`¿Eliminar "${editing.name}" y todo su historial?`)) return;
  S.items = S.items.filter(x => x !== editing);
  $('#edit').close();
  save(); render();
});

$('#add').addEventListener('click', () => openEdit(null));
$('#prev').addEventListener('click', () => { month = addMonths(month, view() === 'year' ? -12 : -1); render(); });
$('#next').addEventListener('click', () => { month = addMonths(month, view() === 'year' ? 12 : 1); render(); });
document.querySelectorAll('[name=view]').forEach(r => r.addEventListener('change', render));

function applyTheme() {
  const t = S.theme ?? 'light';
  document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]').content = dark ? '#000000' : '#f5f5f7';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
document.querySelectorAll('[name=theme]').forEach(r => r.addEventListener('change', () => { S.theme = r.value; save(); applyTheme(); }));
applyTheme();

$('#btnSettings').addEventListener('click', () => {
  $('#income').value = S.income || '';
  $(`[name=theme][value=${S.theme ?? 'light'}]`).checked = true;
  $('#settings').showModal();
});
$('#income').addEventListener('change', e => { S.income = +e.target.value || 0; save(); render(); });
$('#export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' }));
  a.download = `gastos-${new Date().toLocaleDateString('en-CA')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#import').addEventListener('change', async e => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(data?.items)) throw 0;
    if (!confirm('Esto reemplaza los datos actuales. ¿Continuar?')) return;
    S = data; save(); render(); $('#settings').close();
  } catch { alert('Archivo no válido'); }
  e.target.value = '';
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
render();

navigator.storage?.persist?.();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
