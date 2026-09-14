const $ = s => document.querySelector(s);
const KEY = 'gastos';
// Not crypto.randomUUID: it requires HTTPS and the app may run over plain http on the LAN.
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const money = n => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const num = n => n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
const pad = n => String(n).padStart(2, '0');
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
const ym = d => d.toLocaleDateString('en-CA').slice(0, 7); // local YYYY-MM
const addMonths = (m, n) => ym(new Date(+m.slice(0, 4), +m.slice(5) - 1 + n, 1));
const label = m => `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
const daysIn = m => new Date(+m.slice(0, 4), +m.slice(5), 0).getDate();
const dayOf = (m, d) => `${m}-${pad(Math.min(d, daysIn(m)))}`; // day d of month m, clamped (31 → 30 in September)
const daysUntil = date => Math.round((new Date(date + 'T00:00') - new Date(today() + 'T00:00')) / 864e5);
const shortDate = date => new Date(date + 'T00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
const same = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
const QUICK_CATS = ['Gasolina', 'Tienda', 'Comida', 'Súper', 'Transporte', 'Farmacia'];

// Item: { id, cat, name, method, cut, amount, from, to, payments?, off?, log: { 'YYYY-MM': { amt?, paid? } } }
// amount is the recurring default; log[m].amt overrides it for one month (0 hides that month).
// off: still listed, but left out of every sum until reactivated.
const entry = (it, m) => it.log[m] || {};
const inRange = (it, m) => it.from <= m && (!it.to || m <= it.to);
const shows = (it, m) => entry(it, m).amt > 0 || (inRange(it, m) && entry(it, m).amt === undefined);
const counts = (it, m) => !it.off && shows(it, m);
const amountOf = (it, m) => entry(it, m).amt ?? (inRange(it, m) ? it.amount : 0);
const isPaid = (it, m) => !!entry(it, m).paid;
function isLate(it, m) {
  const now = ym(new Date());
  return !it.off && !isPaid(it, m) && amountOf(it, m) > 0 && (m < now || (m === now && it.cut && it.cut < new Date().getDate()));
}
const status = (it, m) => it.off ? 'off' : isPaid(it, m) ? 'paid' : isLate(it, m) ? 'late' : '';

// Loans: payments = total installments. Progress counts the months that have an amount.
function loan(it) {
  if (!it.payments) return null;
  const months = [], last = it.to || addMonths(it.from, it.payments - 1);
  for (let m = it.from; m <= last; m = addMonths(m, 1)) if (shows(it, m) && amountOf(it, m) > 0) months.push(m);
  const paid = months.filter(m => isPaid(it, m)).length, left = Math.max(0, it.payments - paid);
  return { paid, left, leftAmt: left * it.amount, end: months.at(-1), number: m => months.indexOf(m) + 1 };
}

// Daily expense: { id, date: 'YYYY-MM-DD', amt, cat, method, note }
const dailyIn = months => S.daily.filter(d => months.includes(d.date.slice(0, 7)));
const sum = (list, fn) => list.reduce((t, x) => t + fn(x), 0);

// Credit card: { id, name, cut, due, paid: { 'YYYY-MM': true } }; name matches the "Pagar con" text.
// Statement m closes on the cut day of month m and covers the day after the previous cut up to it.
// Charges: recurring payments on their payment day plus daily expenses made with the card.
function statement(card, m) {
  const end = dayOf(m, card.cut), start = dayOf(addMonths(m, -1), card.cut);
  const inPeriod = d => d > start && d <= end;
  const items = S.items.filter(it => same(it.method, card.name)).flatMap(it =>
    [addMonths(m, -1), m].filter(mm => counts(it, mm) && inPeriod(dayOf(mm, it.cut || 1))).map(mm => ({ name: it.name, amt: amountOf(it, mm) })));
  const daily = S.daily.filter(d => same(d.method, card.name) && inPeriod(d.date)).map(d => ({ name: d.cat || 'Otros', amt: d.amt }));
  const due = dayOf(card.due > card.cut ? m : addMonths(m, 1), card.due);
  return { m, end, due, total: sum([...items, ...daily], c => c.amt), paid: !!card.paid?.[m] };
}
const lastClosed = card => today() > dayOf(ym(new Date()), card.cut) ? ym(new Date()) : addMonths(ym(new Date()), -1);

let S = load();
let month = ym(new Date());
let editing = null, editingDaily = null, editingCard = null, alertList = [];

function normalize(s) { return { income: 0, daily: [], cards: [], budgets: {}, ...s }; }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s?.items) return normalize(s);
  } catch {}
  return normalize({ items: seed(), cards: [{ id: uid(), name: 'Tarjeta de crédito', cut: 20, due: 10 }], budgets: { Gasolina: 2000 } });
}
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

// First run: example data starting this month. Real data comes in via Ajustes > Importar.
function seed() {
  const from = ym(new Date());
  const mk = (cat, name, method, cut, amount, extra = {}) => ({ id: uid(), cat, name, method, cut, amount, from, to: null, log: {}, ...extra });
  return [
    mk('Vivienda', 'Renta', 'Transferencia', 1, 8000),
    mk('Servicios', 'Internet', 'Tarjeta de crédito', 10, 600),
    mk('Servicios', 'Luz', 'Efectivo', null, 0),
    mk('Suscripciones', 'Música', 'Tarjeta de crédito', 15, 129),
    mk('Préstamos', 'Préstamo auto', 'Tarjeta de débito', 5, 3500, { payments: 12, to: addMonths(from, 11) }),
  ];
}

const view = () => $('[name=view]:checked').value;
const setView = v => { $(`[name=view][value=${v}]`).checked = true; };
const yearMonths = () => MONTHS.map((_, i) => `${month.slice(0, 4)}-${pad(i + 1)}`);

// Reminders: unpaid payments and card statements due within S.remindDays (overdue ones too).
const when = days => days < 0 ? `Vencido hace ${-days} ${days === -1 ? 'día' : 'días'}` : days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`;
function upcoming() {
  const cur = ym(new Date()), limit = S.remindDays ?? 2, out = [];
  for (const m of [addMonths(cur, -1), cur, addMonths(cur, 1)]) for (const it of S.items) {
    if (!it.cut || !counts(it, m) || isPaid(it, m)) continue;
    const days = daysUntil(dayOf(m, it.cut));
    if (days <= limit) out.push({ name: it.name, amt: amountOf(it, m), meta: it.method, days, open: () => { month = m; setView('cat'); render(); openEdit(it); } });
  }
  for (const c of S.cards) {
    const s = statement(c, lastClosed(c)), days = daysUntil(s.due);
    if (!s.paid && s.total > 0 && days <= limit) out.push({ name: `Tarjeta ${c.name}`, amt: s.total, meta: `corte ${shortDate(s.end)}`, days, open: () => { month = cur; setView('method'); render(); } });
  }
  return out.sort((a, b) => a.days - b.days);
}

function renderAlerts() {
  alertList = upcoming();
  navigator.setAppBadge?.(alertList.length).catch(() => {});
  $('#alerts').innerHTML = alertList.length ? `<h3 class="section-title">Próximos pagos</h3><div class="card list">${alertList.map((a, i) => `
    <div class="item ${a.days < 0 ? 'late' : ''}" data-alert="${i}">
      <div class="info"><b>${esc(a.name)}</b><small>${[when(a.days), a.meta].filter(Boolean).map(esc).join(' · ')}</small></div>
      <span class="amt">${a.amt ? money(a.amt) : 'sin monto'}</span></div>`).join('')}</div>` : '';
}
$('#alerts').addEventListener('click', e => alertList[e.target.closest('[data-alert]')?.dataset.alert]?.open());

// No server, so no scheduled push: notify once a day when the app is opened.
async function notify() {
  const list = upcoming();
  if (!list.length || !('Notification' in window) || Notification.permission !== 'granted' || S.notified === today()) return;
  S.notified = today();
  save();
  const body = list.map(a => `${when(a.days)}: ${a.name}${a.amt ? ' ' + money(a.amt) : ''}`).join('\n');
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) reg.showNotification('Pagos próximos', { body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'pagos' });
  else new Notification('Pagos próximos', { body, icon: 'icon-192.png' });
}

function renderNotifyBtn() {
  const p = 'Notification' in window ? Notification.permission : 'unsupported';
  const btn = $('#btnNotify');
  btn.textContent = { granted: 'Notificaciones activadas', denied: 'Notificaciones bloqueadas (actívalas en el navegador)', default: 'Activar notificaciones', unsupported: 'Notificaciones no disponibles aquí' }[p];
  btn.disabled = p !== 'default';
}
$('#btnNotify').addEventListener('click', async () => {
  await Notification.requestPermission();
  renderNotifyBtn();
  S.notified = null;
  notify();
});
$('#remindDays').addEventListener('change', e => { S.remindDays = Math.max(0, +e.target.value || 0); S.notified = null; save(); render(); });

// Calendar file: monthly recurring events (payments and card due dates) with an alarm at 9:00.
function calendarFile() {
  const text = s => String(s).replace(/[\\;,]/g, c => '\\' + c);
  const d = S.remindDays ?? 2;
  const trigger = d ? `-PT${d * 24 - 9}H` : 'PT9H'; // relative to midnight of the payment day
  const cur = ym(new Date()), stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  // ponytail: days 29-31 use the 28th so the event exists every month (reminds a bit early); BYSETPOS rules if exact dates matter.
  const event = (id, start, day, title, until) => ['BEGIN:VEVENT', `UID:${id}@gastos`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start.replace('-', '')}${pad(Math.min(day, 28))}`,
    `RRULE:FREQ=MONTHLY${until ? `;UNTIL=${until.replace('-', '')}${pad(daysIn(until))}` : ''}`,
    `SUMMARY:${text(title)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(title)}`, `TRIGGER:${trigger}`, 'END:VALARM', 'END:VEVENT'].join('\r\n');
  const events = [
    ...S.items.filter(it => it.cut && !it.off && (!it.to || it.to >= cur))
      .map(it => event(it.id, it.from > cur ? it.from : cur, it.cut, `Pago: ${it.name}${it.amount ? ' ' + money(it.amount) : ''}`, it.to)),
    ...S.cards.map(c => event(c.id, cur, c.due, `Pagar tarjeta ${c.name}`)),
  ];
  return events.length && ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gastos//ES', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
}
$('#btnCalendar').addEventListener('click', () => {
  const ics = calendarFile();
  if (!ics) return alert('No hay pagos activos con día de pago.');
  download(`pagos-${today()}.ics`, ics, 'text/calendar');
});

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function render() {
  renderAlerts();
  $('#title').textContent = view() === 'year' ? month.slice(0, 4) : label(month);
  const months = view() === 'year' ? yearMonths() : [month];
  if (view() === 'daily') return renderDaily();
  renderSummary(months);
  view() === 'year' ? renderYear(months) : renderList(view());
}

const stat = (k, v, c = '') => `<div class="${c}"><small>${k}</small><b>${money(v)}</b></div>`;

function renderSummary(months) {
  let total = 0, paid = 0, late = 0, n = 0, done = 0;
  for (const m of months) for (const it of S.items) if (counts(it, m)) {
    const a = amountOf(it, m);
    total += a; n++;
    if (isPaid(it, m)) { paid += a; done++; } else if (isLate(it, m)) late += a;
  }
  const daily = sum(dailyIn(months), d => d.amt);
  const debt = sum(S.items.filter(it => !it.off), it => loan(it)?.leftAmt || 0);
  const income = S.income * months.length;
  $('#summary').innerHTML = `
    <small>Por pagar</small><div class="big">${money(total - paid)}</div>
    <div class="bar"><i style="width:${total ? paid / total * 100 : 0}%"></i></div>
    <small>${done} de ${n} pagados</small>
    <div class="stats">${stat('Pagos', total)}${stat('Pagado', paid, 'ok')}${stat('Vencido', late, late ? 'late' : '')}${stat('Diarios', daily)}
    ${debt ? stat('Deuda restante', debt) : ''}
    ${income ? stat('Ingreso', income) + stat('Disponible', income - total - daily, income < total + daily ? 'late' : 'ok') : ''}</div>`;
}

function renderCards() {
  if (!S.cards.length) return '';
  return `<h3 class="section-title">Tarjetas de crédito</h3>` + S.cards.map(c => {
    const s = statement(c, lastClosed(c)), open = statement(c, addMonths(s.m, 1)), days = daysUntil(s.due);
    const state = s.paid ? 'Pagada' : s.total ? `Límite ${shortDate(s.due)} · ${when(days)}` : 'Sin cargos';
    return `<div class="card cc ${!s.paid && s.total && days < 0 ? 'late' : ''}" data-card="${c.id}">
      <div class="cc-head"><b>${esc(c.name)}</b><small>Corte día ${c.cut} · límite día ${c.due}</small></div>
      <div class="cc-row">
        <div><small>Por pagar · corte ${shortDate(s.end)}</small><div class="cc-amt ${s.paid ? 'done' : ''}">${money(s.total)}</div><small class="cc-state">${state}</small></div>
        ${s.total ? `<button type="button" class="small ${s.paid ? '' : 'primary'}" data-cardpay="${s.m}">${s.paid ? 'Desmarcar' : 'Marcar pagada'}</button>` : ''}
      </div>
      <div class="cc-open"><small>Periodo actual · cierra ${shortDate(open.end)}</small><span>${money(open.total)}</span></div>
    </div>`;
  }).join('');
}

function renderList(by) {
  const groups = {};
  for (const it of S.items) if (shows(it, month)) (groups[it[by] || 'Sin asignar'] ??= []).push(it);
  const row = it => {
    const a = amountOf(it, month), cls = status(it, month), L = loan(it), k = L?.number(month);
    const meta = [it.off && 'Deshabilitado', by === 'cat' ? it.method : it.cat, it.cut && `día ${it.cut}`,
      k && `pago ${k} de ${it.payments}`, L?.leftAmt && `faltan ${money(L.leftAmt)}`].filter(Boolean).map(esc).join(' · ');
    return `<div class="item ${cls}" data-id="${it.id}">
      <button class="chk" data-pay aria-label="Marcar pagado" aria-pressed="${isPaid(it, month)}"></button>
      <div class="info"><b>${esc(it.name)}</b><small>${meta}</small></div>
      <span class="amt">${a ? money(a) : 'sin monto'}</span></div>`;
  };
  $('#list').innerHTML = (by === 'method' ? renderCards() : '') + (Object.entries(groups).map(([g, its]) => {
    its.sort((a, b) => (a.cut || 99) - (b.cut || 99));
    const total = sum(its.filter(it => !it.off), it => amountOf(it, month));
    return `<h3 class="section-title">${esc(g)}<span>${money(total)}</span></h3><div class="card list">${its.map(row).join('')}</div>`;
  }).join('') || '<p class="note">Sin pagos este mes.</p>');
}

function renderYear(months) {
  const its = S.items.filter(it => months.some(m => shows(it, m)));
  const cats = [...new Set(its.map(it => it.cat || 'Sin asignar'))];
  const cell = (it, m) => shows(it, m)
    ? `<td data-m="${m}" class="${status(it, m)}">${amountOf(it, m) ? num(amountOf(it, m)) : '—'}</td>`
    : `<td data-m="${m}"></td>`;
  const totals = months.map(m => sum(S.items, it => counts(it, m) ? amountOf(it, m) : 0));
  $('#list').innerHTML = `<div class="scroll"><table>
    <thead><tr><th>Pago</th>${MONTHS.map(x => `<th>${x.slice(0, 3)}</th>`).join('')}</tr></thead>
    <tbody>${cats.map(c => `<tr class="grp"><th colspan="13">${esc(c)}</th></tr>` +
      its.filter(it => (it.cat || 'Sin asignar') === c).map(it => `<tr class="${it.off ? 'off' : ''}"><th data-id="${it.id}">${esc(it.name)}</th>${months.map(m => cell(it, m)).join('')}</tr>`).join('')).join('')}</tbody>
    <tfoot><tr><th>Pagos</th>${totals.map((t, i) => `<td data-m="${months[i]}">${num(t)}</td>`).join('')}</tr>
    <tr><th>Diarios</th>${months.map(m => `<td data-m="${m}">${num(sum(dailyIn([m]), d => d.amt))}</td>`).join('')}</tr></tfoot>
  </table></div><p class="note">Toca un mes para abrirlo. Verde = pagado, rojo = vencido, gris = deshabilitado.</p>`;
}

function renderDaily() {
  const list = dailyIn([month]).sort((a, b) => b.date.localeCompare(a.date));
  const byCat = {};
  for (const d of list) byCat[d.cat || 'Otros'] = (byCat[d.cat || 'Otros'] || 0) + d.amt;
  const elapsed = month === ym(new Date()) ? new Date().getDate() : daysIn(month);
  const total = sum(list, d => d.amt), budget = sum(Object.values(S.budgets), v => v);
  const rows = Object.keys({ ...S.budgets, ...byCat }).map(c => ({ c, spent: byCat[c] || 0, b: S.budgets[c] || 0 })).sort((a, b) => b.spent - a.spent);
  $('#summary').innerHTML = `<small>Gastos diarios</small><div class="big">${money(total)}</div>
    <small>${list.length} ${list.length === 1 ? 'registro' : 'registros'} · ${money(total / elapsed)} por día${budget ? ` · presupuesto ${money(budget)}` : ''}</small>
    ${rows.length ? `<div class="budgets">${rows.map(({ c, spent, b }) => {
      const p = b ? spent / b : 0, cls = !b ? '' : p >= 1 ? 'over' : p >= .8 ? 'warn' : '';
      return `<div class="budget ${cls}"><div class="bl"><span>${esc(c)}</span><span>${money(spent)}${b ? `<small> de ${money(b)}</small>` : ''}</span></div>
        ${b ? `<div class="bar"><i style="width:${Math.min(p, 1) * 100}%"></i></div><small>${p >= 1 ? `Rebasado por ${money(spent - b)}` : `Quedan ${money(b - spent)}`}</small>` : ''}</div>`;
    }).join('')}</div>` : ''}`;
  const groups = {};
  for (const d of list) (groups[d.date] ??= []).push(d);
  $('#list').innerHTML = Object.entries(groups).map(([date, ds]) => {
    const title = new Date(date + 'T00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
    return `<h3 class="section-title">${esc(title)}<span>${money(sum(ds, d => d.amt))}</span></h3><div class="card list">${ds.map(d => `
      <div class="item" data-daily="${d.id}">
        <div class="info"><b>${esc(d.cat || 'Otros')}</b><small>${[d.note, d.method].filter(Boolean).map(esc).join(' · ')}</small></div>
        <span class="amt">${money(d.amt)}</span></div>`).join('')}</div>`;
  }).join('') || '<p class="note">Sin gastos diarios este mes.</p>';
}

$('#list').addEventListener('click', e => {
  const cell = e.target.closest('td[data-m]');
  if (cell) { month = cell.dataset.m; setView('cat'); return render(); }
  const cardEl = e.target.closest('[data-card]');
  if (cardEl) {
    const c = S.cards.find(x => x.id === cardEl.dataset.card), pay = e.target.closest('[data-cardpay]')?.dataset.cardpay;
    if (!pay) return openCard(c);
    c.paid ??= {};
    if (c.paid[pay]) delete c.paid[pay]; else c.paid[pay] = true;
    save(); return render();
  }
  const d = e.target.closest('[data-daily]');
  if (d) return openDaily(S.daily.find(x => x.id === d.dataset.daily));
  const el = e.target.closest('[data-id]');
  if (!el) return;
  const it = S.items.find(x => x.id === el.dataset.id);
  if (e.target.closest('[data-pay]') && amountOf(it, month) > 0) {
    const en = it.log[month] ??= {};
    en.paid = !en.paid;
    save(); render();
  } else openEdit(it);
});

const options = (el, values) => { el.innerHTML = [...new Set(values.filter(Boolean))].map(v => `<option value="${esc(v)}">`).join(''); };
const methodOptions = () => options($('#methods'), [...S.items, ...S.daily].map(x => x.method).concat(S.cards.map(c => c.name)));

const form = $('#form'), f = form.elements;
function openEdit(it) {
  editing = it;
  form.reset();
  const en = it ? entry(it, month) : {}, L = it && loan(it);
  $('#editTitle').textContent = it ? 'Editar pago' : 'Nuevo pago';
  f.nombre.value = it?.name ?? '';
  f.cat.value = it?.cat ?? '';
  f.method.value = it?.method ?? '';
  f.cut.value = it?.cut ?? '';
  f.amount.value = it?.amount || '';
  f.from.value = it?.from ?? month;
  f.to.value = it?.to ?? '';
  f.payments.value = it?.payments ?? '';
  $('#loanInfo').textContent = L
    ? `Pagados ${L.paid} de ${it.payments} · faltan ${money(L.leftAmt)}${L.end ? ` · último pago ${label(L.end)}` : ''}`
    : 'Para préstamos: con el número de pagos se calcula cuánto falta y cuándo termina.';
  f.off.checked = !!it?.off;
  $('#monthLabel').textContent = label(month);
  f.monthAmt.value = en.amt ?? '';
  f.monthAmt.placeholder = it?.amount ? `${it.amount} (fijo)` : '';
  f.paid.checked = !!en.paid;
  $('#del').hidden = !it;
  options($('#cats'), S.items.map(x => x.cat));
  methodOptions();
  $('#edit').showModal();
}

form.addEventListener('submit', e => {
  if (e.submitter?.value !== 'save') return;
  const it = editing ?? { id: uid(), log: {} };
  const payments = Math.max(0, Math.round(+f.payments.value)) || null;
  Object.assign(it, {
    name: f.nombre.value.trim(), cat: f.cat.value.trim(), method: f.method.value.trim(),
    cut: +f.cut.value || null, amount: +f.amount.value || 0, from: f.from.value,
    // With a number of payments and no end month, the end is derived from it.
    to: f.to.value || (payments ? addMonths(f.from.value, payments - 1) : null), payments,
  });
  if (!payments) delete it.payments;
  if (f.off.checked) it.off = true; else delete it.off;
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

const qform = $('#quickForm'), q = qform.elements;
function openDaily(d, preset = {}) {
  editingDaily = d;
  qform.reset();
  $('#quickTitle').textContent = d ? 'Editar gasto' : 'Nuevo gasto';
  q.amt.value = d?.amt ?? preset.amt ?? '';
  q.cat.value = d?.cat ?? preset.cat ?? '';
  q.method.value = d?.method ?? preset.method ?? '';
  q.note.value = d?.note ?? preset.note ?? '';
  q.date.value = d?.date ?? today();
  $('#delQuick').hidden = !d;
  options($('#quickCats'), [...QUICK_CATS, ...Object.keys(S.budgets), ...S.daily.map(x => x.cat)]);
  methodOptions();
  $('#quick').showModal();
  if (!q.amt.value) q.amt.focus();
}

// Returns a warning when this expense pushes its category past 80% or 100% of the monthly budget.
function budgetWarning(d) {
  const b = S.budgets[d.cat];
  if (!b) return '';
  const spent = sum(S.daily.filter(x => x.cat === d.cat && x.date.slice(0, 7) === d.date.slice(0, 7)), x => x.amt), before = spent - d.amt;
  if (spent >= b && before < b) return `${d.cat}: presupuesto rebasado (${money(spent)} de ${money(b)})`;
  if (spent >= b * .8 && before < b * .8) return `${d.cat}: llevas ${Math.round(spent / b * 100)}% del presupuesto`;
  return '';
}

function addDaily(d) {
  S.daily.push({ id: uid(), ...d });
  save();
  month = d.date.slice(0, 7);
  setView('daily');
  render();
  return budgetWarning(d);
}

qform.addEventListener('submit', e => {
  if (e.submitter?.value !== 'save') return;
  const d = { amt: +q.amt.value, cat: q.cat.value.trim(), method: q.method.value.trim(), note: q.note.value.trim(), date: q.date.value };
  if (editingDaily) { Object.assign(editingDaily, d); save(); render(); return; }
  const warn = addDaily(d);
  if (warn) toast(warn, 5000);
});

$('#delQuick').addEventListener('click', () => {
  if (!confirm('¿Eliminar este gasto?')) return;
  S.daily = S.daily.filter(x => x !== editingDaily);
  $('#quick').close();
  save(); render();
});

const cform = $('#cardForm'), cf = cform.elements;
function openCard(c) {
  editingCard = c;
  cform.reset();
  $('#cardTitle').textContent = c ? 'Editar tarjeta' : 'Nueva tarjeta';
  cf.cname.value = c?.name ?? '';
  cf.ccut.value = c?.cut ?? '';
  cf.cdue.value = c?.due ?? '';
  $('#delCard').hidden = !c;
  methodOptions();
  $('#cardDialog').showModal();
}
cform.addEventListener('submit', e => {
  if (e.submitter?.value !== 'save') return;
  const c = editingCard ?? { id: uid(), paid: {} };
  Object.assign(c, { name: cf.cname.value.trim(), cut: +cf.ccut.value, due: +cf.cdue.value });
  if (!editingCard) S.cards.push(c);
  save(); render(); renderCardList();
});
$('#delCard').addEventListener('click', () => {
  if (!confirm(`¿Eliminar la tarjeta "${editingCard.name}"? Los pagos y gastos no se borran.`)) return;
  S.cards = S.cards.filter(x => x !== editingCard);
  $('#cardDialog').close();
  save(); render(); renderCardList();
});
function renderCardList() {
  $('#cardList').innerHTML = S.cards.map(c => `<div class="item" data-editcard="${c.id}">
    <div class="info"><b>${esc(c.name)}</b><small>Corte día ${c.cut} · límite día ${c.due}</small></div><span class="amt">›</span></div>`).join('')
    || '<p class="note">Sin tarjetas.</p>';
}
$('#cardList').addEventListener('click', e => {
  const id = e.target.closest('[data-editcard]')?.dataset.editcard;
  if (id) openCard(S.cards.find(c => c.id === id));
});
$('#addCard').addEventListener('click', () => openCard(null));

function renderBudgets() {
  const cats = [...new Set([...QUICK_CATS, ...Object.keys(S.budgets), ...S.daily.map(d => d.cat)].filter(Boolean))];
  $('#budgetList').innerHTML = cats.map(c => `<div class="item budget-row"><div class="info"><b>${esc(c)}</b></div>
    <input type="number" min="0" step="1" inputmode="decimal" placeholder="Sin límite" aria-label="Presupuesto ${esc(c)}" data-budget="${esc(c)}" value="${S.budgets[c] || ''}"></div>`).join('');
}
$('#budgetList').addEventListener('change', e => {
  const c = e.target.dataset.budget;
  if (c === undefined) return;
  if (+e.target.value > 0) S.budgets[c] = +e.target.value; else delete S.budgets[c];
  save(); render();
});

$('#add').addEventListener('click', () => view() === 'daily' ? openDaily(null) : openEdit(null));
$('#addDaily').addEventListener('click', () => openDaily(null));
$('#prev').addEventListener('click', () => { month = addMonths(month, view() === 'year' ? -12 : -1); render(); });
$('#next').addEventListener('click', () => { month = addMonths(month, view() === 'year' ? 12 : 1); render(); });
document.querySelectorAll('[name=view]').forEach(r => r.addEventListener('change', render));

function toast(msg, ms = 3000) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.hidden = true, ms);
}

// Shortcut links: ?gasto=150&cat=Gasolina&metodo=Efectivo&nota=Pemex
// With an amount it is saved right away; without one the form opens prefilled.
function runLink() {
  const p = new URLSearchParams(location.search);
  if (!p.has('gasto')) return;
  history.replaceState(null, '', location.pathname + location.hash); // a reload must not repeat it
  const preset = { amt: parseFloat(String(p.get('gasto')).replace(/[^\d.]/g, '')), cat: p.get('cat') || '', method: p.get('metodo') || '', note: p.get('nota') || '' };
  if (preset.amt > 0) {
    const warn = addDaily({ ...preset, date: today() });
    toast([`Registrado: ${money(preset.amt)}${preset.cat ? ' en ' + preset.cat : ''}`, warn].filter(Boolean).join(' · '), warn ? 5000 : 3000);
  } else openDaily(null, { ...preset, amt: '' });
}

const shortcutLink = cat => `${location.origin}${location.pathname}?gasto=&cat=${encodeURIComponent(cat)}`;
function renderShortcuts() {
  const cats = [...new Set([...QUICK_CATS, ...S.daily.map(d => d.cat).filter(Boolean)])];
  $('#shortcutList').innerHTML = cats.map(c => `<div class="item"><div class="info"><b>${esc(c)}</b></div><button type="button" class="link" data-link="${esc(c)}">Copiar enlace</button></div>`).join('');
}
$('#shortcutList').addEventListener('click', async e => {
  const cat = e.target.closest('[data-link]')?.dataset.link;
  if (cat === undefined) return;
  try {
    await navigator.clipboard.writeText(shortcutLink(cat));
    toast('Enlace copiado');
  } catch { prompt('Copia este enlace:', shortcutLink(cat)); } // clipboard needs HTTPS
});

function applyTheme() {
  const t = S.theme ?? 'light';
  document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]').content = dark ? '#111113' : '#f6f5f2';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
document.querySelectorAll('[name=theme]').forEach(r => r.addEventListener('change', () => { S.theme = r.value; save(); applyTheme(); }));
applyTheme();

$('#btnSettings').addEventListener('click', () => {
  $('#income').value = S.income || '';
  $(`[name=theme][value=${S.theme ?? 'light'}]`).checked = true;
  $('#remindDays').value = S.remindDays ?? 2;
  renderNotifyBtn();
  renderCardList();
  renderBudgets();
  renderShortcuts();
  $('#settings').showModal();
});
$('#income').addEventListener('change', e => { S.income = +e.target.value || 0; save(); render(); });
$('#export').addEventListener('click', () => download(`gastos-${today()}.json`, JSON.stringify(S, null, 1), 'application/json'));
$('#import').addEventListener('change', async e => {
  try {
    const data = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(data?.items)) throw 0;
    if (!confirm('Esto reemplaza los datos actuales. ¿Continuar?')) return;
    S = normalize(data); save(); render(); $('#settings').close();
  } catch { alert('Archivo no válido'); }
  e.target.value = '';
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); notify(); } });
render();
runLink();
notify();

navigator.storage?.persist?.();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js');
