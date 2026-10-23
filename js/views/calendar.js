import { S, add, patch, del, avatar, whoOptions, COLORS } from '../state.js';
import { esc, todayStr, toDateStr, parseDate, addDays, addMonths, diffDays, fmtDate, fmtTime, relDay } from '../util.js';
import { openModal, toast } from '../ui.js';
import { editTodo } from './todos.js';

export const EV_REC = { none: 'Einmalig', weekly: 'Jede Woche', biweekly: 'Alle 2 Wochen', monthly: 'Jeden Monat', yearly: 'Jedes Jahr' };
const C = { month: todayStr().slice(0, 7) + '-01', sel: todayStr() };

export function occursOn(ev, ds) {
  if (!ev.event_date || ds < ev.event_date) return false;
  const rec = ev.recurrence || 'none';
  if (rec === 'none') return ds <= (ev.end_date && ev.end_date > ev.event_date ? ev.end_date : ev.event_date);
  const a = parseDate(ev.event_date), b = parseDate(ds), d = diffDays(ev.event_date, ds);
  if (rec === 'weekly') return d % 7 === 0;
  if (rec === 'biweekly') return d % 14 === 0;
  if (rec === 'monthly') return a.getDate() === b.getDate();
  if (rec === 'yearly') return a.getDate() === b.getDate() && a.getMonth() === b.getMonth();
  return false;
}
const evSort = (a, b) => (a.all_day === b.all_day ? String(a.start_time || '').localeCompare(String(b.start_time || '')) : a.all_day ? -1 : 1);
export const eventsOn = (ds) => S.events.filter((e) => occursOn(e, ds)).sort(evSort);
export const tripsOn = (ds) => S.trips.filter((t) => t.start_date && ds >= t.start_date && ds <= (t.end_date || t.start_date));
export const todosOn = (ds) => S.todos.filter((t) => !t.done && t.due_date === ds);

export function upcoming(n = 6, days = 120) {
  const out = []; let d = todayStr();
  for (let i = 0; i < days && out.length < n; i++, d = addDays(d, 1)) {
    for (const e of eventsOn(d)) {
      // Mehrtägige Termine nur am ersten (sichtbaren) Tag zeigen
      if (e.recurrence === 'none' && e.event_date < d && i > 0) continue;
      out.push({ date: d, ev: e });
      if (out.length >= n) break;
    }
  }
  return out;
}

const ageNote = (e, ds) => (e.recurrence === 'yearly' && ds > e.event_date ? ` · ${parseDate(ds).getFullYear() - parseDate(e.event_date).getFullYear()}.` : '');

export function eventRow(e, ds, { showDate = false } = {}) {
  const multi = e.recurrence === 'none' && e.end_date && e.end_date > e.event_date;
  return `<button class="ev-row c-${esc(e.color || 'peach')}" data-action="ev-edit" data-id="${e.id}">
    <span class="ev-time">${showDate ? `<b>${esc(relDay(ds))}</b>` : ''}${e.all_day ? 'Ganztägig' : esc(fmtTime(e.start_time)) + (e.end_time ? '–' + esc(fmtTime(e.end_time)) : '')}</span>
    <span class="ev-text"><span class="ev-title">${esc(e.title)}${esc(ageNote(e, ds))}</span>
      <span class="ev-sub">${multi ? `bis ${esc(fmtDate(e.end_date, 'short'))} · ` : ''}${e.location ? '📍 ' + esc(e.location) : ''}${e.recurrence && e.recurrence !== 'none' ? ' 🔁' : ''}</span></span>
    ${e.who ? avatar(e.who, 'sm') : ''}
  </button>`;
}

export function render() {
  const T = todayStr();
  const m0 = C.month;
  const first = parseDate(m0);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(m0, -offset);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const monthKey = m0.slice(0, 7);

  let grid = '';
  for (let i = 0; i < cells; i++) {
    const ds = addDays(start, i);
    const evs = eventsOn(ds), trips = tripsOn(ds), todos = todosOn(ds);
    const pills = [
      ...trips.map((t) => `<span class="pill trip">${esc(t.emoji || '🧳')} ${esc(t.title)}</span>`),
      ...evs.map((e) => `<span class="pill c-${esc(e.color || 'peach')}">${e.all_day ? '' : `<i>${esc(fmtTime(e.start_time))}</i> `}${esc(e.title)}</span>`),
    ];
    grid += `<button class="cal-cell ${ds.slice(0, 7) !== monthKey ? 'other' : ''} ${ds === T ? 'today' : ''} ${ds === C.sel ? 'sel' : ''}" data-action="cal-pick" data-date="${ds}">
      <span class="cal-num">${parseDate(ds).getDate()}</span>
      <span class="cal-pills">${pills.slice(0, 3).join('')}${pills.length > 3 ? `<span class="more">+${pills.length - 3}</span>` : ''}</span>
      <span class="cal-dots">${evs.slice(0, 4).map((e) => `<i class="dot c-${esc(e.color || 'peach')}"></i>`).join('')}${trips.length ? '<i class="dot is-trip"></i>' : ''}${todos.length ? '<i class="dot is-todo"></i>' : ''}</span>
    </button>`;
  }

  const sel = C.sel;
  const sEvs = eventsOn(sel), sTrips = tripsOn(sel), sTodos = todosOn(sel);
  const up = upcoming(8);

  return `
  <header class="page-head">
    <div><h1>Kalender</h1><p class="sub">Termine, Reisen & fällige ToDos an einem Ort.</p></div>
    <button class="btn primary" data-action="ev-new">＋ Termin</button>
  </header>

  <div class="cal-layout">
    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" data-action="cal-prev" aria-label="Vorheriger Monat">‹</button>
        <h2>${esc(fmtDate(m0, 'month'))}</h2>
        <button class="icon-btn" data-action="cal-next" aria-label="Nächster Monat">›</button>
        <button class="btn ghost sm" data-action="cal-today">Heute</button>
      </div>
      <div class="cal-week">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${grid}</div>
    </section>

    <aside class="cal-side">
      <section class="card day-panel">
        <div class="row-between">
          <h3>${esc(fmtDate(sel, 'weekday'))}</h3>
          <button class="btn sm" data-action="ev-new" data-date="${sel}">＋</button>
        </div>
        <p class="sub">${esc(relDay(sel))}</p>
        ${sTrips.map((t) => `<a class="ev-row trip" href="#/reisen/${t.id}"><span class="ev-time">${esc(t.emoji || '🧳')}</span><span class="ev-text"><span class="ev-title">${esc(t.title)}</span><span class="ev-sub">Reise · ${esc(fmtDate(t.start_date, 'dm'))}–${esc(fmtDate(t.end_date || t.start_date, 'dm'))}</span></span></a>`).join('')}
        ${sEvs.map((e) => eventRow(e, sel)).join('')}
        ${sTodos.map((t) => `<button class="ev-row is-todo" data-action="cal-todo" data-id="${t.id}"><span class="ev-time">✅</span><span class="ev-text"><span class="ev-title">${esc(t.title)}</span><span class="ev-sub">ToDo fällig</span></span>${t.assignee ? avatar(t.assignee, 'sm') : ''}</button>`).join('')}
        ${!sEvs.length && !sTrips.length && !sTodos.length ? '<p class="muted">Nichts geplant – perfekt für Spontanes ☕</p>' : ''}
      </section>
      <section class="card">
        <h3>Demnächst</h3>
        ${up.length ? up.map(({ date, ev }) => eventRow(ev, date, { showDate: true })).join('') : '<p class="muted">Keine Termine in Sicht.</p>'}
      </section>
    </aside>
  </div>`;
}

function evForm(e = {}) {
  return `
    <label class="field"><span>Titel</span><input name="title" required autofocus value="${esc(e.title || '')}" maxlength="200"></label>
    <div class="row2">
      <label class="field"><span>Datum</span><input type="date" name="event_date" required value="${esc(e.event_date || C.sel)}"></label>
      <label class="field"><span>Bis (mehrtägig)</span><input type="date" name="end_date" value="${esc(e.end_date || '')}"></label>
    </div>
    <label class="switch"><input type="checkbox" name="all_day" ${e.all_day ? 'checked' : ''} data-toggle-times><span>Ganztägig</span></label>
    <div class="row2 times" ${e.all_day ? 'hidden' : ''}>
      <label class="field"><span>Von</span><input type="time" name="start_time" value="${esc(fmtTime(e.start_time))}"></label>
      <label class="field"><span>Bis</span><input type="time" name="end_time" value="${esc(fmtTime(e.end_time))}"></label>
    </div>
    <div class="row2">
      <label class="field"><span>Wer?</span><select name="who">${whoOptions(e.who ?? 'both')}</select></label>
      <label class="field"><span>Wiederholen</span><select name="recurrence">${Object.entries(EV_REC).map(([k, v]) => `<option value="${k}" ${(e.recurrence || 'none') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <label class="field"><span>Ort</span><input name="location" value="${esc(e.location || '')}" placeholder="Optional"></label>
    <div class="field"><span>Farbe</span><div class="swatches">${Object.entries(COLORS).map(([k, v]) => `<label class="swatch c-${k}" title="${v}"><input type="radio" name="color" value="${k}" ${(e.color || 'peach') === k ? 'checked' : ''}><span></span></label>`).join('')}</div></div>
    <label class="field"><span>Notizen</span><textarea name="notes" rows="2">${esc(e.notes || '')}</textarea></label>
    ${e.recurrence && e.recurrence !== 'none' ? '<p class="hint">🔁 Änderungen gelten für alle Wiederholungen.</p>' : ''}`;
}
const bindTimes = (form) => {
  const cb = form.querySelector('[data-toggle-times]'); const times = form.querySelector('.times');
  cb.onchange = () => (times.hidden = cb.checked);
};
const fromForm = (d) => ({
  title: d.title, event_date: d.event_date, end_date: d.end_date && d.end_date > d.event_date ? d.end_date : null,
  all_day: !!d.all_day, start_time: d.all_day ? null : d.start_time || null, end_time: d.all_day ? null : d.end_time || null,
  who: d.who || null, recurrence: d.recurrence || 'none', location: d.location || null, color: d.color || 'peach', notes: d.notes || null,
});

export function newEvent(date) {
  if (date) C.sel = date;
  openModal({ title: 'Neuer Termin', body: evForm({ event_date: date || C.sel }), submitLabel: 'Eintragen', onOpen: bindTimes,
    onSubmit: async (d) => { await add('events', fromForm(d)); toast('Termin eingetragen 📅'); } });
}
export function editEvent(id) {
  const e = S.events.find((x) => x.id === id); if (!e) return;
  openModal({ title: 'Termin bearbeiten', body: evForm(e), onOpen: bindTimes,
    onSubmit: (d) => patch('events', id, fromForm(d)), onDelete: () => del('events', id) });
}

export const actions = {
  'cal-prev': () => { C.month = addMonths(C.month, -1); },
  'cal-next': () => { C.month = addMonths(C.month, 1); },
  'cal-today': () => { C.month = todayStr().slice(0, 7) + '-01'; C.sel = todayStr(); },
  'cal-pick': (el) => {
    const ds = el.dataset.date;
    if (C.sel === ds && matchMedia('(min-width: 861px)').matches) return newEvent(ds);
    C.sel = ds;
    if (ds.slice(0, 7) !== C.month.slice(0, 7)) C.month = ds.slice(0, 7) + '-01';
    if (matchMedia('(max-width: 860px)').matches) setTimeout(() => document.querySelector('.day-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  },
  'cal-todo': (el) => editTodo(el.dataset.id),
  'ev-new': (el) => newEvent(el.dataset.date),
  'ev-edit': (el) => editEvent(el.dataset.id),
};
