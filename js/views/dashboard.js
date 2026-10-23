import { S, myProfile, partner, avatar } from '../state.js';
import { esc, todayStr, fmtDate, diffDays, plural, fmtRange } from '../util.js';
import { openTodos, sortTodos, todoItem, actions as todoActions } from './todos.js';
import { openItems, catEmoji, actions as shopActions } from './shopping.js';
import { upcoming, eventRow, actions as calActions } from './calendar.js';
import { sortedTrackers, trackerCard } from './tracker.js';
import { nextTrip, tripStatus, countdownText } from './trips.js';
import { myToday, theirToday, streak, bubble } from './diary.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

export function render() {
  const T = todayStr();
  const mp = myProfile(), p = partner();
  const open = openTodos();
  const overdue = open.filter((t) => t.due_date && t.due_date < T);
  const dueSoon = sortTodos(open).slice(0, 5);
  const shop = openItems();
  const evs = upcoming(4, 60);
  const trackers = sortedTrackers().filter((t) => t.pinned).slice(0, 4);
  const nt = nextTrip();
  const mine = myToday(), theirs = theirToday();
  const st = streak();
  const together = S.trackers.find((t) => /zusammen/i.test(t.title));

  return `
  <section class="hero">
    <div>
      <p class="eyebrow">${esc(fmtDate(T, 'long'))}</p>
      <h1>${greeting()}, ${esc(mp?.display_name || 'Batzi')} ${esc(mp?.emoji || '')}</h1>
      <p class="sub">${together && diffDays(together.start_date, T) >= 0 ? `Ihr seid seit <b>${diffDays(together.start_date, T).toLocaleString('de-DE')} Tagen</b> die Batzi's 💞` : `Schön, dass ihr da seid${p ? ', ' + esc(mp?.display_name || '') + ' & ' + esc(p.display_name) : ''}!`}</p>
    </div>
    <div class="hero-avatars">${mp ? avatar(mp.id, 'lg') : ''}${p ? avatar(p.id, 'lg') : ''}</div>
  </section>

  <div class="dash-grid">
    <a class="card dash-diary ${!mine ? 'nudge' : ''}" href="#/tagebuch">
      <div class="card-head"><h2>💌 Tagebuch</h2>${st ? `<span class="badge">🔥 ${st}</span>` : ''}</div>
      ${theirs ? (mine ? bubble(theirs, 'left') : `<p><b>${esc(p.display_name)}</b> hat dir heute geschrieben! Schreib zurück, um es zu lesen ✨</p>`)
        : p ? `<p class="muted">${esc(p.display_name)} hat heute noch nicht geschrieben.</p>` : ''}
      <p class="dash-diary-status ${mine ? 'ok' : ''}">${mine ? '✓ Deine heutige Nachricht ist verschickt' : `✍️ Schreib ${p ? esc(p.display_name) : 'deinem Schatz'} heute noch was Liebes`}</p>
    </a>

    <section class="card dash-todos">
      <div class="card-head"><h2>✅ ToDos</h2><a class="more" href="#/todos">${open.length} offen${overdue.length ? ` · <span class="bad">${overdue.length} überfällig</span>` : ''} ›</a></div>
      <form class="quick mini" data-submit="todo-quick" autocomplete="off"><input id="dash-todo" name="title" placeholder="Schnell eine Aufgabe …" aria-label="Neue Aufgabe"><button class="btn primary sm" type="submit">＋</button></form>
      ${dueSoon.length ? `<ul class="todo-list">${dueSoon.map((t) => todoItem(t, { compact: true })).join('')}</ul>` : '<p class="muted">Nichts offen 🌿</p>'}
    </section>

    <section class="card dash-shop">
      <div class="card-head"><h2>🛒 Einkauf</h2><a class="more" href="#/einkauf">${shop.length} Sachen ›</a></div>
      <form class="quick mini" data-submit="shop-add" autocomplete="off"><input id="dash-shop" name="name" placeholder="Was fehlt?" aria-label="Artikel"><input type="hidden" name="quantity"><input type="hidden" name="category"><button class="btn primary sm" type="submit">＋</button></form>
      ${shop.length ? `<div class="shop-chips">${shop.slice(0, 14).map((i) => `<button class="chip" data-action="shop-toggle" data-id="${i.id}" title="Abhaken">${catEmoji(i.category)} ${esc(i.name)}${i.quantity ? ` <small>${esc(i.quantity)}</small>` : ''}</button>`).join('')}${shop.length > 14 ? `<a class="chip ghost" href="#/einkauf">+${shop.length - 14}</a>` : ''}</div>` : '<p class="muted">Alles da!</p>'}
    </section>

    <section class="card dash-events">
      <div class="card-head"><h2>📅 Termine</h2><a class="more" href="#/kalender">Kalender ›</a></div>
      ${evs.length ? evs.map(({ date, ev }) => eventRow(ev, date, { showDate: true })).join('') : '<p class="muted">Keine Termine in den nächsten Wochen.</p>'}
      <button class="btn ghost sm" data-action="ev-new">＋ Termin</button>
    </section>

    <div class="dash-col">
    ${nt ? `<a class="card dash-trip" href="#/reisen/${nt.id}">
      <div class="card-head"><h2>✈️ ${tripStatus(nt) === 'now' ? 'Gerade unterwegs' : 'Nächste Reise'}</h2></div>
      <div class="dash-trip-body"><span class="trip-emoji">${esc(nt.emoji || '🧳')}</span>
        <div><h3>${esc(nt.title)}</h3><p class="muted">${esc(fmtRange(nt.start_date, nt.end_date))}</p></div>
        <div class="big-count">${tripStatus(nt) === 'now' ? '🌴' : `<b>${diffDays(T, nt.start_date)}</b><span>${diffDays(T, nt.start_date) === 1 ? 'Tag' : 'Tage'}</span>`}</div>
      </div>
    </a>` : `<a class="card dash-trip empty-trip" href="#/reisen"><div class="card-head"><h2>✈️ Reisen</h2></div><p class="muted">Noch keine Reise geplant – wohin soll’s gehen?</p></a>`}

    <section class="card dash-trackers">
      <div class="card-head"><h2>⏳ Tracker</h2><a class="more" href="#/tracker">Alle ›</a></div>
      ${trackers.length ? `<div class="tracker-minis">${trackers.map((t) => trackerCard(t, { mini: true })).join('')}</div>` : '<p class="muted">Pinne Tracker, um sie hier zu sehen.</p>'}
    </section>
    </div>
  </div>`;
}

export const actions = {
  'todo-toggle': todoActions['todo-toggle'],
  'todo-edit': todoActions['todo-edit'],
  'todo-quick': todoActions['todo-quick'],
  'shop-add': shopActions['shop-add'],
  'shop-toggle': shopActions['shop-toggle'],
  'ev-new': calActions['ev-new'],
  'ev-edit': calActions['ev-edit'],
};
