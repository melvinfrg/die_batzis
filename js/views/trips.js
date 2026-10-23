import { S, add, patch, del, me, partner, avatar, whoOptions, nameOf, profileOf } from '../state.js';
import { esc, todayStr, diffDays, addDays, fmtDate, fmtRange, fmtTime, plural, money, uid, safeUrl, cssUrl, hostOf, parseDate } from '../util.js';
import { openModal, toast, burst, centerOf } from '../ui.js';

const L = { tab: 'upcoming' };
const D = { id: null, tab: 'overview' };

export const LINK_KINDS = {
  flight: ['✈️', 'Flug'], train: ['🚆', 'Zug/Bus'], stay: ['🏨', 'Unterkunft'], car: ['🚗', 'Mietwagen'],
  activity: ['🎟️', 'Aktivität'], food: ['🍝', 'Restaurant'], doc: ['📄', 'Dokument'], map: ['🗺️', 'Karte'], other: ['🔗', 'Sonstiges'],
};
const DEFAULT_PACKING = ['Personalausweis / Reisepass', 'Ladekabel & Powerbank', 'Kopfhörer', 'Zahnbürste & Zahnpasta', 'Duschzeug', 'Medikamente', 'Sonnenbrille', 'Sonnencreme', 'Unterwäsche & Socken', 'Schlafsachen', 'Regenjacke', 'Bequeme Schuhe', 'Adapter', 'Krankenversicherungskarte', 'Bargeld / Karten'];

export function tripStatus(t) {
  const T = todayStr();
  if (!t.start_date) return 'idea';
  const end = t.end_date || t.start_date;
  if (T < t.start_date) return 'upcoming';
  if (T > end) return 'past';
  return 'now';
}
export const tripDays = (t) => (t.start_date ? diffDays(t.start_date, t.end_date || t.start_date) + 1 : 0);
export const nextTrip = () => S.trips.filter((t) => ['upcoming', 'now'].includes(tripStatus(t))).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
const arr = (t, k) => (Array.isArray(t[k]) ? t[k] : []);
const spent = (t) => arr(t, 'expenses').reduce((s, e) => s + (Number(e.amount) || 0), 0);

export function countdownText(t) {
  const st = tripStatus(t), T = todayStr();
  if (st === 'now') { const d = diffDays(t.start_date, T) + 1; return `Tag ${d} von ${tripDays(t)} 🌴`; }
  if (st === 'upcoming') { const d = diffDays(T, t.start_date); return d === 1 ? 'Morgen geht’s los!' : `noch ${d} Tage`; }
  if (st === 'past') { const d = diffDays(t.end_date || t.start_date, T); return d < 31 ? `vor ${plural(d, 'Tag', 'Tagen')}` : fmtDate(t.start_date, 'month'); }
  return 'Wunschziel ✨';
}

const cover = (t, cls = '') => {
  const bg = t.cover_url ? cssUrl(t.cover_url) : '';
  return `<div class="trip-cover ${cls} ${bg ? 'has-img' : ''}" ${bg ? `style="background-image:${esc(bg)}"` : ''}><span class="trip-emoji">${esc(t.emoji || '🧳')}</span></div>`;
};
const stars = (n, action) => `<span class="stars">${[1, 2, 3, 4, 5].map((i) => action ? `<button class="star ${i <= (n || 0) ? 'on' : ''}" data-action="${action}" data-v="${i}" aria-label="${i} Sterne">★</button>` : `<span class="star ${i <= (n || 0) ? 'on' : ''}">★</span>`).join('')}</span>`;

export function tripCard(t) {
  const st = tripStatus(t);
  return `<a class="card trip-card" href="#/reisen/${t.id}">
    ${cover(t)}
    <div class="trip-info">
      <div class="row-between"><h3>${esc(t.title)}</h3><span class="badge st-${st}">${esc(countdownText(t))}</span></div>
      <p class="muted">${t.destination ? '📍 ' + esc(t.destination) : ''}${t.country && t.country !== t.destination ? ', ' + esc(t.country) : ''}</p>
      <p class="trip-dates">${esc(fmtRange(t.start_date, t.end_date))}${t.start_date ? ' · ' + plural(tripDays(t), 'Tag', 'Tage') : ''}</p>
      ${st === 'past' && t.rating ? stars(t.rating) : ''}
    </div>
  </a>`;
}

export function render(param) {
  if (param) return renderDetail(param);
  const T = todayStr();
  const byStatus = (s) => S.trips.filter((t) => tripStatus(t) === s);
  const upcoming = [...byStatus('now'), ...byStatus('upcoming').sort((a, b) => a.start_date.localeCompare(b.start_date))];
  const past = byStatus('past').sort((a, b) => b.start_date.localeCompare(a.start_date));
  const ideas = byStatus('idea');
  const lists = { upcoming, past, idea: ideas, all: [...upcoming, ...past, ...ideas] };
  const list = lists[L.tab];
  const done = S.trips.filter((t) => ['past', 'now'].includes(tripStatus(t)));
  const totalDays = done.reduce((s, t) => s + (tripStatus(t) === 'now' ? diffDays(t.start_date, T) + 1 : tripDays(t)), 0);
  const countries = new Set(done.map((t) => (t.country || '').trim().toLowerCase()).filter(Boolean));
  const nt = nextTrip();
  const tab = (k, l, n) => `<button class="chip ${L.tab === k ? 'on' : ''}" data-action="trip-tab" data-v="${k}">${l} <span class="count">${n}</span></button>`;

  return `
  <header class="page-head">
    <div><h1>Reisen</h1><p class="sub">Alles von Flug bis Fischbrötchen – vergangen, geplant und erträumt.</p></div>
    <button class="btn primary" data-action="trip-new">＋ Reise</button>
  </header>

  ${nt ? `<a class="card trip-hero" href="#/reisen/${nt.id}">
    ${cover(nt, 'hero')}
    <div><p class="eyebrow">${tripStatus(nt) === 'now' ? 'Gerade unterwegs' : 'Nächste Reise'}</p>
      <h2>${esc(nt.title)}</h2>
      <p class="muted">${esc(fmtRange(nt.start_date, nt.end_date))}</p></div>
    <div class="big-count">${tripStatus(nt) === 'now' ? '🌴' : `<b>${diffDays(T, nt.start_date)}</b><span>${diffDays(T, nt.start_date) === 1 ? 'Tag' : 'Tage'}</span>`}</div>
  </a>` : ''}

  <section class="stats">
    <div class="stat c-sky"><b>${done.length}</b><span>Reisen gemacht</span></div>
    <div class="stat c-mint"><b>${totalDays}</b><span>Tage unterwegs</span></div>
    <div class="stat c-lemon"><b>${countries.size}</b><span>${countries.size === 1 ? 'Land' : 'Länder'}</span></div>
    <div class="stat c-lilac"><b>${ideas.length}</b><span>Wunschziele</span></div>
  </section>

  <div class="chips">${tab('upcoming', 'Bevorstehend', upcoming.length)}${tab('past', 'Vergangen', past.length)}${tab('idea', 'Wunschliste', ideas.length)}${tab('all', 'Alle', lists.all.length)}</div>

  <div class="trip-grid">
    ${list.length ? list.map(tripCard).join('') : `<div class="empty card"><div class="empty-emoji">🗺️</div><p>${L.tab === 'idea' ? 'Wohin wollt ihr mal? Leg eine Reise ohne Datum an.' : 'Hier ist noch nichts.'}</p></div>`}
  </div>`;
}

// ---------- Detailansicht ----------
function renderDetail(id) {
  const t = S.trips.find((x) => x.id === id);
  if (!t) return `<div class="empty card"><div class="empty-emoji">🧭</div><p>Reise nicht gefunden.</p><a class="btn" href="#/reisen">Zurück</a></div>`;
  if (D.id !== id) { D.id = id; D.tab = 'overview'; }
  const st = tripStatus(t);
  const tabs = { overview: '✨ Übersicht', plan: '🗓️ Plan', links: '🔗 Links', packing: '🎒 Packliste', costs: '💶 Kosten' };
  const counts = { plan: arr(t, 'plan').length, links: arr(t, 'links').length, packing: arr(t, 'packing').length ? `${arr(t, 'packing').filter((p) => p.done).length}/${arr(t, 'packing').length}` : 0, costs: arr(t, 'expenses').length };
  const body = { overview, plan, links, packing, costs }[D.tab](t);
  return `
  <a class="back" href="#/reisen">‹ Alle Reisen</a>
  <section class="card trip-detail-head">
    ${cover(t, 'detail')}
    <div class="tdh-text">
      <span class="badge st-${st}">${esc(countdownText(t))}</span>
      <h1>${esc(t.title)}</h1>
      <p class="muted">${t.destination ? '📍 ' + esc(t.destination) : ''}${t.country && t.country !== t.destination ? ', ' + esc(t.country) : ''}</p>
      <p>${esc(fmtRange(t.start_date, t.end_date))}${t.start_date ? ' · ' + plural(tripDays(t), 'Tag', 'Tage') : ''}</p>
    </div>
    <button class="btn" data-action="trip-edit" data-id="${t.id}">✎ Bearbeiten</button>
  </section>
  <nav class="tabs">${Object.entries(tabs).map(([k, l]) => `<button class="tab ${D.tab === k ? 'on' : ''}" data-action="trip-dtab" data-v="${k}">${l}${counts[k] ? ` <span class="count">${counts[k]}</span>` : ''}</button>`).join('')}</nav>
  <div class="trip-body">${body}</div>`;
}

function overview(t) {
  const st = tripStatus(t), sp = spent(t), pk = arr(t, 'packing');
  return `
  <div class="ov-grid">
    <section class="card">
      <h3>Notizen & Erinnerungen</h3>
      <textarea id="trip-notes" class="notes" rows="8" data-keep data-change="trip-notes" data-id="${t.id}" placeholder="Ideen, Must-Sees, schönste Momente …">${esc(t.notes || '')}</textarea>
      <p class="hint">Wird automatisch gespeichert, sobald du rausklickst.</p>
    </section>
    <section class="card facts">
      <h3>Auf einen Blick</h3>
      <dl>
        <dt>Zeitraum</dt><dd>${esc(fmtRange(t.start_date, t.end_date))}</dd>
        ${t.start_date ? `<dt>Dauer</dt><dd>${plural(tripDays(t), 'Tag', 'Tage')}</dd>` : ''}
        ${t.country ? `<dt>Land</dt><dd>${esc(t.country)}</dd>` : ''}
        <dt>Kosten</dt><dd>${money(sp)}${t.budget ? ` von ${money(t.budget)}` : ''}</dd>
        ${pk.length ? `<dt>Packliste</dt><dd>${pk.filter((p) => p.done).length} von ${pk.length} eingepackt</dd>` : ''}
        <dt>Links</dt><dd>${arr(t, 'links').length}</dd>
      </dl>
      ${t.budget ? `<div class="progress ${sp > t.budget ? 'over' : ''}"><i style="width:${Math.min(100, (sp / t.budget) * 100).toFixed(1)}%"></i></div>` : ''}
      ${st !== 'upcoming' && st !== 'idea' ? `<h3 class="mt">Bewertung</h3>${stars(t.rating, 'trip-rate')}` : ''}
      ${arr(t, 'links').length ? `<h3 class="mt">Wichtige Links</h3>${arr(t, 'links').slice(0, 4).map(linkRow).join('')}` : ''}
    </section>
  </div>`;
}

function plan(t) {
  const items = arr(t, 'plan').slice().sort((a, b) => `${a.date || '9999'}${a.time || ''}`.localeCompare(`${b.date || '9999'}${b.time || ''}`));
  const dates = [...new Set(items.map((i) => i.date || ''))];
  return `
  <form class="card inline-form" data-submit="plan-add" data-id="${t.id}">
    <input type="date" name="date" value="${esc(t.start_date || '')}" ${t.start_date ? `min="${t.start_date}" max="${t.end_date || t.start_date}"` : ''} aria-label="Datum">
    <input type="time" name="time" aria-label="Uhrzeit">
    <input name="text" placeholder="Was steht an? z. B. Check-in, Museum, Abendessen …" required aria-label="Programmpunkt" class="grow">
    <button class="btn primary" type="submit">＋</button>
  </form>
  ${items.length ? dates.map((d) => `
    <section class="card plan-day">
      <h3>${d ? `${t.start_date ? `Tag ${diffDays(t.start_date, d) + 1} · ` : ''}${esc(fmtDate(d, 'weekday'))}` : 'Ohne Datum'}</h3>
      <ul class="plan-list">${items.filter((i) => (i.date || '') === d).map((i) => `
        <li><span class="plan-time">${esc(fmtTime(i.time)) || '·'}</span><span class="grow">${esc(i.text)}</span>
        <button class="icon-btn sm" data-action="sub-del" data-k="plan" data-id="${t.id}" data-sid="${esc(i.id)}" aria-label="Entfernen">✕</button></li>`).join('')}</ul>
    </section>`).join('') : '<div class="empty card"><div class="empty-emoji">🗓️</div><p>Noch kein Programm. Trag oben den ersten Punkt ein.</p></div>'}`;
}

function linkRow(l, tid) {
  const [ic, kind] = LINK_KINDS[l.kind] || LINK_KINDS.other;
  const href = safeUrl(l.url);
  return `<div class="link-row">
    <span class="link-ic">${ic}</span>
    <span class="grow">${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(l.label || hostOf(href))}</a>` : esc(l.label)}
      <small>${esc(kind)}${href ? ' · ' + esc(hostOf(href)) : ''}${l.note ? ' · ' + esc(l.note) : ''}</small></span>
    ${tid ? `<button class="icon-btn sm" data-action="sub-del" data-k="links" data-id="${tid}" data-sid="${esc(l.id)}" aria-label="Entfernen">✕</button>` : ''}
  </div>`;
}

function links(t) {
  const ls = arr(t, 'links');
  const groups = Object.keys(LINK_KINDS).map((k) => [k, ls.filter((l) => (l.kind || 'other') === k)]).filter(([, v]) => v.length);
  return `
  <form class="card inline-form wrap" data-submit="link-add" data-id="${t.id}">
    <select name="kind" aria-label="Art">${Object.entries(LINK_KINDS).map(([k, [i, l]]) => `<option value="${k}">${i} ${l}</option>`).join('')}</select>
    <input name="label" placeholder="Bezeichnung, z. B. Hotel Sol" required class="grow" aria-label="Bezeichnung">
    <input name="url" placeholder="https://… (Buchung, Ticket, Maps)" class="grow" aria-label="Link">
    <input name="note" placeholder="Notiz (z. B. Buchungsnr.)" aria-label="Notiz">
    <button class="btn primary" type="submit">＋</button>
  </form>
  ${groups.length ? `<section class="card">${groups.map(([k, items]) => `<h3 class="link-group">${LINK_KINDS[k][0]} ${LINK_KINDS[k][1]}</h3>${items.map((l) => linkRow(l, t.id)).join('')}`).join('')}</section>`
    : '<div class="empty card"><div class="empty-emoji">🔗</div><p>Flüge, Unterkunft, Tickets, Google-Maps-Liste … alles hier verlinken.</p></div>'}`;
}

function packing(t) {
  const ps = arr(t, 'packing');
  const done = ps.filter((p) => p.done).length;
  return `
  <form class="card inline-form" data-submit="pack-add" data-id="${t.id}">
    <input name="text" placeholder="Was muss mit?" required class="grow" aria-label="Gegenstand">
    <select name="who" aria-label="Wer packt?">${whoOptions('both')}</select>
    <button class="btn primary" type="submit">＋</button>
  </form>
  ${ps.length ? `
    <section class="card">
      <div class="row-between"><h3>${done} von ${ps.length} eingepackt</h3>${done ? `<button class="btn ghost sm" data-action="pack-reset" data-id="${t.id}">Alle auspacken</button>` : ''}</div>
      <div class="progress"><i style="width:${((done / ps.length) * 100).toFixed(1)}%"></i></div>
      <ul class="pack-list">${ps.map((p) => `
        <li class="${p.done ? 'checked' : ''}">
          <label class="mini-check"><input type="checkbox" data-change="pack-toggle" data-id="${t.id}" data-sid="${esc(p.id)}" ${p.done ? 'checked' : ''}><span>${esc(p.text)}</span></label>
          ${p.who ? avatar(p.who, 'xs') : ''}
          <button class="icon-btn sm" data-action="sub-del" data-k="packing" data-id="${t.id}" data-sid="${esc(p.id)}" aria-label="Entfernen">✕</button>
        </li>`).join('')}</ul>
    </section>` : ''}
  <div class="center"><button class="btn ghost" data-action="pack-default" data-id="${t.id}">🎒 Standard-Packliste hinzufügen</button></div>`;
}

function costs(t) {
  const ex = arr(t, 'expenses');
  const total = spent(t);
  const m = me(), p = partner();
  const paid = (id) => ex.filter((e) => e.paid_by === id).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const shared = ex.filter((e) => e.paid_by !== 'both');
  let balance = '';
  if (p && shared.length) {
    const a = paid(m), b = paid(p.id); const diff = (a - b) / 2;
    balance = Math.abs(diff) < 0.01 ? '<p class="balance ok">⚖️ Ihr seid quitt!</p>'
      : `<p class="balance">⚖️ ${esc(diff > 0 ? p.display_name : nameOf(m))} schuldet ${esc(diff > 0 ? nameOf(m) : p.display_name)} <b>${money(Math.abs(diff))}</b></p>`;
  }
  return `
  <form class="card inline-form wrap" data-submit="cost-add" data-id="${t.id}">
    <input name="label" placeholder="Wofür? z. B. Abendessen" required class="grow" aria-label="Wofür">
    <input name="amount" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Betrag €" required aria-label="Betrag" class="amount">
    <select name="paid_by" aria-label="Bezahlt von">${whoOptions(m, { allowNone: false })}</select>
    <button class="btn primary" type="submit">＋</button>
  </form>
  <section class="stats">
    <div class="stat c-peach"><b>${money(total)}</b><span>gesamt${t.budget ? ` · Budget ${money(t.budget)}` : ''}</span></div>
    ${S.profiles.map((pr) => `<div class="stat c-${esc(pr.color || 'sky')}"><b>${money(paid(pr.id))}</b><span>${esc(pr.emoji)} ${esc(pr.display_name)} bezahlt</span></div>`).join('')}
  </section>
  ${balance}
  ${ex.length ? `<section class="card"><ul class="cost-list">${ex.map((e) => `
    <li><span class="grow">${esc(e.label)}</span>${avatar(e.paid_by, 'xs')}<b>${money(e.amount)}</b>
    <button class="icon-btn sm" data-action="sub-del" data-k="expenses" data-id="${t.id}" data-sid="${esc(e.id)}" aria-label="Entfernen">✕</button></li>`).join('')}</ul></section>` : ''}`;
}

// ---------- Formular Reise ----------
const TRIP_EMOJIS = ['🧳', '✈️', '🏖️', '🏔️', '🌊', '🏙️', '🏕️', '🚗', '🚆', '🛳️', '🌴', '❄️', '🍝', '🗼', '🌸', '🎡'];
function tripForm(t = {}) {
  return `
    <label class="field"><span>Name der Reise</span><input name="title" required autofocus value="${esc(t.title || '')}" placeholder="z. B. Sommer in Italien" maxlength="120"></label>
    <div class="row2">
      <label class="field"><span>Ziel / Ort</span><input name="destination" value="${esc(t.destination || '')}" placeholder="z. B. Rom"></label>
      <label class="field"><span>Land</span><input name="country" value="${esc(t.country || '')}" placeholder="z. B. Italien"></label>
    </div>
    <div class="row2">
      <label class="field"><span>Von</span><input type="date" name="start_date" value="${esc(t.start_date || '')}"></label>
      <label class="field"><span>Bis</span><input type="date" name="end_date" value="${esc(t.end_date || '')}"></label>
    </div>
    <p class="hint">Ohne Datum landet die Reise auf der Wunschliste.</p>
    <div class="field"><span>Symbol</span><div class="emoji-pick">${TRIP_EMOJIS.map((e) => `<label><input type="radio" name="emoji" value="${e}" ${(t.emoji || '🧳') === e ? 'checked' : ''}><span>${e}</span></label>`).join('')}
      <label class="custom"><input type="radio" name="emoji" value="__custom" ${t.emoji && !TRIP_EMOJIS.includes(t.emoji) ? 'checked' : ''}><input name="emoji_custom" maxlength="8" placeholder="🇮🇹" value="${t.emoji && !TRIP_EMOJIS.includes(t.emoji) ? esc(t.emoji) : ''}"></label></div></div>
    <div class="row2">
      <label class="field"><span>Budget (€)</span><input type="number" min="0" step="1" name="budget" value="${esc(t.budget ?? '')}"></label>
      <label class="field"><span>Titelbild (Link)</span><input name="cover_url" value="${esc(t.cover_url || '')}" placeholder="https://…jpg"></label>
    </div>`;
}
const tripFromForm = (d) => ({
  title: d.title, destination: d.destination || null, country: d.country || null,
  start_date: d.start_date || null, end_date: d.start_date ? (d.end_date && d.end_date >= d.start_date ? d.end_date : d.start_date) : null,
  emoji: d.emoji === '__custom' ? d.emoji_custom || '🧳' : d.emoji || '🧳', budget: d.budget ? Number(d.budget) : null, cover_url: d.cover_url || null,
});

const pushSub = async (id, key, item) => { const t = S.trips.find((x) => x.id === id); if (t) await patch('trips', id, { [key]: [...arr(t, key), { id: uid(), ...item }] }); };
const mapSub = async (id, key, fn) => { const t = S.trips.find((x) => x.id === id); if (t) await patch('trips', id, { [key]: fn(arr(t, key)) }); };

export const actions = {
  'trip-tab': (el) => { L.tab = el.dataset.v; },
  'trip-dtab': (el) => { D.tab = el.dataset.v; },
  'trip-new': () => openModal({ title: 'Neue Reise', body: tripForm(), submitLabel: 'Anlegen',
    onSubmit: async (d) => { const r = await add('trips', { ...tripFromForm(d), links: [], packing: [], expenses: [], plan: [] }); toast('Gute Reise! ✈️'); location.hash = '#/reisen/' + r.id; } }),
  'trip-edit': (el) => {
    const t = S.trips.find((x) => x.id === el.dataset.id); if (!t) return;
    openModal({ title: 'Reise bearbeiten', body: tripForm(t), onSubmit: (d) => patch('trips', t.id, tripFromForm(d)),
      onDelete: async () => { await del('trips', t.id); location.hash = '#/reisen'; } });
  },
  'trip-notes': (el) => { const t = S.trips.find((x) => x.id === el.dataset.id); if (t && (t.notes || '') !== el.value) patch('trips', t.id, { notes: el.value }).then(() => toast('Notizen gespeichert')); },
  'trip-rate': (el) => { patch('trips', D.id, { rating: Number(el.dataset.v) }); },
  'sub-del': (el) => mapSub(el.dataset.id, el.dataset.k, (a) => a.filter((x) => x.id !== el.dataset.sid)),
  'plan-add': (f) => { const d = Object.fromEntries(new FormData(f)); if (!d.text.trim()) return; f.reset(); return pushSub(f.dataset.id, 'plan', { date: d.date || null, time: d.time || null, text: d.text.trim() }); },
  'link-add': (f) => {
    const d = Object.fromEntries(new FormData(f)); if (!d.label.trim()) return;
    if (d.url && !safeUrl(d.url)) { toast('Der Link sieht ungültig aus', 'error'); return; }
    f.reset(); return pushSub(f.dataset.id, 'links', { kind: d.kind, label: d.label.trim(), url: d.url ? safeUrl(d.url) : null, note: d.note?.trim() || null });
  },
  'pack-add': (f) => { const d = Object.fromEntries(new FormData(f)); if (!d.text.trim()) return; f.querySelector('[name=text]').value = ''; return pushSub(f.dataset.id, 'packing', { text: d.text.trim(), who: d.who || null, done: false }); },
  'pack-toggle': (el) => mapSub(el.dataset.id, 'packing', (a) => a.map((x) => (x.id === el.dataset.sid ? { ...x, done: el.checked } : x))),
  'pack-reset': (el) => mapSub(el.dataset.id, 'packing', (a) => a.map((x) => ({ ...x, done: false }))),
  'pack-default': (el) => mapSub(el.dataset.id, 'packing', (a) => {
    const have = new Set(a.map((x) => x.text.toLowerCase()));
    return [...a, ...DEFAULT_PACKING.filter((x) => !have.has(x.toLowerCase())).map((text) => ({ id: uid(), text, done: false, who: 'both' }))];
  }),
  'cost-add': (f) => { const d = Object.fromEntries(new FormData(f)); const amount = Number(String(d.amount).replace(',', '.')); if (!d.label.trim() || !(amount >= 0)) return; f.querySelector('[name=label]').value = ''; f.querySelector('[name=amount]').value = ''; return pushSub(f.dataset.id, 'expenses', { label: d.label.trim(), amount, paid_by: d.paid_by }); },
};
