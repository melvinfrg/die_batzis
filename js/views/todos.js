import { S, add, patch, del, delMany, me, partner, avatar, whoOptions } from '../state.js';
import { esc, todayStr, addDays, addMonths, diffDays, fmtDate, relDay, uid, parseDate, toDateStr, pad } from '../util.js';
import { openModal, burst, centerOf, toast } from '../ui.js';

export const PRIO = { 1: 'Niedrig', 2: 'Normal', 3: 'Wichtig' };
export const REC = { none: 'Keine', daily: 'Täglich', weekly: 'Wöchentlich', biweekly: 'Alle 2 Wochen', monthly: 'Monatlich', yearly: 'Jährlich' };

const F = { status: 'open', who: 'all', cat: 'all', q: '' };

export function nextDue(due, rec) {
  const base = due || todayStr();
  switch (rec) {
    case 'daily': return addDays(base, 1);
    case 'weekly': return addDays(base, 7);
    case 'biweekly': return addDays(base, 14);
    case 'monthly': return addMonths(base, 1);
    case 'yearly': return addMonths(base, 12);
    default: return null;
  }
}

export const categories = () => [...new Set(S.todos.map((t) => t.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

const mine = (t) => t.assignee === me() || t.assignee === 'both';

export function openTodos() { return S.todos.filter((t) => !t.done); }
export function sortTodos(list) {
  return list.slice().sort((a, b) =>
    (a.due_date || '9999') < (b.due_date || '9999') ? -1 : (a.due_date || '9999') > (b.due_date || '9999') ? 1 :
      (b.priority || 2) - (a.priority || 2) || String(a.created_at).localeCompare(String(b.created_at)));
}

function filtered() {
  const T = todayStr();
  const q = F.q.toLowerCase();
  return S.todos.filter((t) => {
    if (F.status === 'open' && t.done) return false;
    if (F.status === 'done' && !t.done) return false;
    if (F.status === 'today' && (t.done || !t.due_date || t.due_date > T)) return false;
    if (F.who === 'me' && !mine(t)) return false;
    if (F.who === 'partner' && !(t.assignee === partner()?.id || t.assignee === 'both')) return false;
    if (F.who === 'none' && t.assignee) return false;
    if (F.cat !== 'all' && t.category !== F.cat) return false;
    if (q && !(`${t.title} ${t.notes || ''} ${t.category || ''}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

export function todoItem(t, { compact = false } = {}) {
  const T = todayStr();
  const overdue = !t.done && t.due_date && t.due_date < T;
  const subs = Array.isArray(t.subtasks) ? t.subtasks : [];
  const subDone = subs.filter((s) => s.done).length;
  return `
  <li class="todo ${t.done ? 'done' : ''} prio-${t.priority || 2}">
    <button class="check" data-action="todo-toggle" data-id="${t.id}" aria-label="${t.done ? 'Als offen markieren' : 'Erledigt'}"><span>✓</span></button>
    <div class="todo-body">
      <button class="todo-main" data-action="todo-edit" data-id="${t.id}">
        <span class="todo-title">${esc(t.title)}</span>
        <span class="todo-meta">
          ${(t.priority || 2) === 3 ? '<span class="tag hot">❗ Wichtig</span>' : ''}
          ${t.due_date ? `<span class="tag ${overdue ? 'bad' : t.due_date === T ? 'warn' : ''}">📅 ${esc(relDay(t.due_date))}${Math.abs(diffDays(T, t.due_date)) > 6 ? ' · ' + esc(fmtDate(t.due_date, 'dm')) : ''}</span>` : ''}
          ${t.category && !compact ? `<span class="tag">#${esc(t.category)}</span>` : ''}
          ${t.recurrence && t.recurrence !== 'none' ? `<span class="tag" title="${esc(REC[t.recurrence])}">🔁 ${esc(REC[t.recurrence])}</span>` : ''}
          ${subs.length ? `<span class="tag">☑︎ ${subDone}/${subs.length}</span>` : ''}
          ${t.notes && !compact ? '<span class="tag" title="Hat Notizen">📝</span>' : ''}
        </span>
      </button>
      ${subs.length && !t.done && !compact ? `<ul class="subtasks">${subs.map((s) => `
        <li><label class="mini-check"><input type="checkbox" data-change="todo-sub" data-id="${t.id}" data-sid="${esc(s.id)}" ${s.done ? 'checked' : ''}><span>${esc(s.text)}</span></label></li>`).join('')}</ul>` : ''}
    </div>
    ${t.assignee ? `<span class="todo-who">${avatar(t.assignee, 'sm')}</span>` : ''}
  </li>`;
}

function groups(list) {
  const T = todayStr(), W = addDays(T, 7);
  if (F.status === 'done') {
    return [['Erledigt', list.sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || ''))).slice(0, 100)]];
  }
  const g = { 'Überfällig': [], 'Heute': [], 'Morgen': [], 'Nächste 7 Tage': [], 'Später': [], 'Ohne Datum': [], 'Erledigt': [] };
  for (const t of sortTodos(list)) {
    if (t.done) g['Erledigt'].push(t);
    else if (!t.due_date) g['Ohne Datum'].push(t);
    else if (t.due_date < T) g['Überfällig'].push(t);
    else if (t.due_date === T) g['Heute'].push(t);
    else if (t.due_date === addDays(T, 1)) g['Morgen'].push(t);
    else if (t.due_date <= W) g['Nächste 7 Tage'].push(t);
    else g['Später'].push(t);
  }
  return Object.entries(g).filter(([, v]) => v.length);
}

export function render() {
  const T = todayStr();
  const open = openTodos();
  const overdue = open.filter((t) => t.due_date && t.due_date < T).length;
  const today = open.filter((t) => t.due_date === T).length;
  const weekAgo = addDays(T, -7);
  const doneWeek = S.todos.filter((t) => t.done && t.done_at && t.done_at.slice(0, 10) >= weekAgo).length;
  const list = filtered();
  const cats = categories();
  const p = partner();
  const chip = (k, v, label) => `<button class="chip ${F[k] === v ? 'on' : ''}" data-action="todo-filter" data-k="${k}" data-v="${esc(v)}">${label}</button>`;

  return `
  <header class="page-head">
    <div><h1>ToDos</h1><p class="sub">Was ansteht – und wer sich drum kümmert.</p></div>
    <button class="btn primary" data-action="todo-new">＋ Aufgabe</button>
  </header>

  <section class="stats">
    <div class="stat c-peach"><b>${open.length}</b><span>offen</span></div>
    <div class="stat c-lemon"><b>${today}</b><span>heute fällig</span></div>
    <div class="stat ${overdue ? 'c-rose' : 'c-sky'}"><b>${overdue}</b><span>überfällig</span></div>
    <div class="stat c-mint"><b>${doneWeek}</b><span>erledigt (7 Tage)</span></div>
  </section>

  <form class="quick card" data-submit="todo-quick" autocomplete="off">
    <input id="todo-quick" name="title" placeholder="Neue Aufgabe … z. B. „Müll rausbringen @morgen #Haushalt !“" aria-label="Neue Aufgabe">
    <button class="btn primary" type="submit">Hinzufügen</button>
  </form>
  <p class="hint">Tipp: <code>@heute</code>, <code>@morgen</code>, <code>@24.12.</code> setzen das Datum · <code>#Kategorie</code> · <code>!</code> = wichtig</p>

  <div class="toolbar">
    <div class="chips">
      ${chip('status', 'open', 'Offen')}${chip('status', 'today', 'Bis heute')}${chip('status', 'done', 'Erledigt')}${chip('status', 'all', 'Alle')}
    </div>
    <div class="chips">
      ${chip('who', 'all', 'Alle')}${chip('who', 'me', 'Meine')}${p ? chip('who', 'partner', esc(p.display_name) + 's') : ''}${chip('who', 'none', 'Offen für alle')}
    </div>
    <div class="toolbar-right">
      ${cats.length ? `<select data-change="todo-cat" aria-label="Kategorie"><option value="all">Alle Kategorien</option>${cats.map((c) => `<option ${F.cat === c ? 'selected' : ''} value="${esc(c)}">#${esc(c)}</option>`).join('')}</select>` : ''}
      <input type="search" id="todo-search" placeholder="Suchen …" value="${esc(F.q)}" data-input="todo-search">
    </div>
  </div>

  ${list.length ? groups(list).map(([name, items]) => `
    <section class="group">
      <h3 class="group-title ${name === 'Überfällig' ? 'bad' : ''}">${esc(name)} <span>${items.length}</span></h3>
      <ul class="todo-list card">${items.map((t) => todoItem(t)).join('')}</ul>
    </section>`).join('') : `
    <div class="empty card"><div class="empty-emoji">🌿</div><p>${F.status === 'done' ? 'Noch nichts erledigt.' : 'Alles erledigt – Zeit fürs Sofa!'}</p></div>`}

  ${F.status === 'done' && list.length ? '<div class="center"><button class="btn ghost danger" data-action="todo-clear-done">Erledigte löschen</button></div>' : ''}
  `;
}

function parseQuick(raw) {
  let title = raw; const row = {};
  const T = todayStr();
  title = title.replace(/(^|\s)#([\p{L}\p{N}_-]+)/u, (_, s, c) => { row.category = c; return s; });
  title = title.replace(/(^|\s)@(heute|morgen|übermorgen|(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?)/i, (m, s, w, d, mo, y) => {
    const lw = w.toLowerCase();
    if (lw === 'heute') row.due_date = T;
    else if (lw === 'morgen') row.due_date = addDays(T, 1);
    else if (lw === 'übermorgen') row.due_date = addDays(T, 2);
    else {
      const now = new Date();
      let yr = y ? Number(y.length === 2 ? '20' + y : y) : now.getFullYear();
      let ds = `${yr}-${pad(mo)}-${pad(d)}`;
      if (!y && ds < T) ds = `${yr + 1}-${pad(mo)}-${pad(d)}`;
      if (!isNaN(parseDate(ds))) row.due_date = toDateStr(parseDate(ds));
    }
    return s;
  });
  if (/(^|\s)!+(\s|$)/.test(title)) { row.priority = 3; title = title.replace(/(^|\s)!+(\s|$)/, ' '); }
  row.title = title.replace(/\s+/g, ' ').trim();
  return row;
}

function todoForm(t = {}) {
  const subs = (t.subtasks || []).map((s) => s.text).join('\n');
  return `
    <label class="field"><span>Titel</span><input name="title" required autofocus value="${esc(t.title || '')}" maxlength="200"></label>
    <div class="row2">
      <label class="field"><span>Fällig am</span><input type="date" name="due_date" value="${esc(t.due_date || '')}"></label>
      <label class="field"><span>Wiederholen</span><select name="recurrence">${Object.entries(REC).map(([k, v]) => `<option value="${k}" ${(t.recurrence || 'none') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <div class="row2">
      <label class="field"><span>Wer?</span><select name="assignee">${whoOptions(t.assignee ?? '')}</select></label>
      <label class="field"><span>Priorität</span><select name="priority">${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${String(t.priority || 2) === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <label class="field"><span>Kategorie</span><input name="category" list="todo-cats" value="${esc(t.category || '')}" placeholder="z. B. Haushalt, Papierkram …" maxlength="40">
      <datalist id="todo-cats">${categories().map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <label class="field"><span>Unteraufgaben <small>(eine pro Zeile)</small></span><textarea name="subtasks" rows="3" placeholder="Fenster putzen&#10;Böden wischen">${esc(subs)}</textarea></label>
    <label class="field"><span>Notizen</span><textarea name="notes" rows="3" maxlength="4000">${esc(t.notes || '')}</textarea></label>
    ${t.created_by ? `<p class="hint">Erstellt ${t.created_at ? 'am ' + esc(fmtDate(t.created_at.slice(0, 10))) : ''}${t.done_at ? ' · erledigt am ' + esc(fmtDate(t.done_at.slice(0, 10))) : ''}</p>` : ''}`;
}

function fromForm(d, old = {}) {
  const prev = old.subtasks || [];
  const subtasks = String(d.subtasks || '').split('\n').map((s) => s.trim()).filter(Boolean)
    .map((text) => { const o = prev.find((p) => p.text === text); return o ? o : { id: uid(), text, done: false }; });
  return {
    title: d.title, notes: d.notes || null, due_date: d.due_date || null,
    priority: Number(d.priority) || 2, assignee: d.assignee || null, category: d.category || null,
    recurrence: d.recurrence || 'none', subtasks,
  };
}

export function newTodo(preset = {}) {
  openModal({
    title: 'Neue Aufgabe', body: todoForm(preset), submitLabel: 'Anlegen',
    onSubmit: async (d) => { await add('todos', { ...fromForm(d), done: false }); toast('Aufgabe angelegt ✨'); },
  });
}

export function editTodo(id) {
  const t = S.todos.find((x) => x.id === id); if (!t) return;
  openModal({
    title: 'Aufgabe bearbeiten', body: todoForm(t),
    onSubmit: async (d) => { await patch('todos', id, fromForm(d, t)); },
    onDelete: async () => { await del('todos', id); toast('Gelöscht'); },
  });
}

export async function toggleTodo(id, el) {
  const t = S.todos.find((x) => x.id === id); if (!t) return;
  if (!t.done) {
    if (el) burst(...centerOf(el));
    await patch('todos', id, { done: true, done_at: new Date().toISOString() });
    if (t.recurrence && t.recurrence !== 'none') {
      const nd = nextDue(t.due_date, t.recurrence);
      await add('todos', {
        title: t.title, notes: t.notes, priority: t.priority, assignee: t.assignee, category: t.category,
        recurrence: t.recurrence, due_date: nd, done: false,
        subtasks: (t.subtasks || []).map((s) => ({ ...s, done: false })),
      });
      toast(`🔁 Nächstes Mal: ${fmtDate(nd)}`);
    }
  } else {
    await patch('todos', id, { done: false, done_at: null });
  }
}

export async function toggleSub(id, sid, checked) {
  const t = S.todos.find((x) => x.id === id); if (!t) return;
  await patch('todos', id, { subtasks: (t.subtasks || []).map((s) => (s.id === sid ? { ...s, done: checked } : s)) });
}

export const actions = {
  'todo-new': () => newTodo(),
  'todo-edit': (el) => editTodo(el.dataset.id),
  'todo-toggle': (el) => toggleTodo(el.dataset.id, el),
  'todo-filter': (el) => { F[el.dataset.k] = el.dataset.v; },
  'todo-cat': (el) => { F.cat = el.value; },
  'todo-search': (el) => { F.q = el.value; },
  'todo-sub': (el) => toggleSub(el.dataset.id, el.dataset.sid, el.checked),
  'todo-clear-done': async () => {
    const ids = S.todos.filter((t) => t.done).map((t) => t.id);
    if (ids.length && confirm(`${ids.length} erledigte Aufgaben endgültig löschen?`)) await delMany('todos', ids);
  },
  'todo-quick': async (form) => {
    const input = form.querySelector('[name=title]');
    const row = parseQuick(input.value);
    if (!row.title) return;
    input.value = '';
    await add('todos', { priority: 2, recurrence: 'none', subtasks: [], done: false, ...row });
  },
};
