import { S, add, patch, del, COLORS } from '../state.js';
import { esc, todayStr, diffDays, addDays, fmtDate, ymdText, parseDate, toDateStr, plural } from '../util.js';
import { openModal, toast, burst, centerOf } from '../ui.js';

const MILESTONES = [7, 14, 30, 50, 69, 100, 150, 200, 250, 300, 365, 400, 500, 600, 666, 700, 730, 800, 900, 1000, 1095, 1111, 1234, 1461, 1500, 1826, 2000, 2222, 2500, 2922, 3000, 3333, 3653];
export function nextMilestone(days) {
  const m = MILESTONES.find((x) => x > days);
  return m ?? Math.ceil((days + 1) / 1000) * 1000;
}
export const daysOf = (t) => diffDays(t.start_date, todayStr());

function nextAnniversary(start) {
  const T = todayStr(); const s = parseDate(start); const now = parseDate(T);
  let d = new Date(now.getFullYear(), s.getMonth(), s.getDate());
  if (toDateStr(d) < T) d = new Date(now.getFullYear() + 1, s.getMonth(), s.getDate());
  const ds = toDateStr(d);
  return { date: ds, in: diffDays(T, ds), years: d.getFullYear() - s.getFullYear() };
}

export const sortedTrackers = () => S.trackers.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || daysOf(b) - daysOf(a));

export function trackerCard(t, { mini = false } = {}) {
  const days = daysOf(t);
  const future = days < 0;
  const T = todayStr();
  if (mini) {
    return `<a class="tracker-mini c-${esc(t.color || 'peach')}" href="#/tracker">
      <span class="t-emoji">${esc(t.emoji || '⏳')}</span>
      <span><b>${future ? 'in ' + plural(-days, 'Tag', 'Tagen') : plural(days, 'Tag', 'Tage')}</b><small>${esc(t.title)}</small></span></a>`;
  }
  const next = nextMilestone(Math.max(days, 0));
  const prevM = [0, ...MILESTONES].filter((x) => x <= days).pop() || 0;
  const pct = future ? 0 : Math.min(100, ((days - prevM) / (next - prevM)) * 100);
  const isMilestone = !future && (MILESTONES.includes(days) || (days > 0 && days % 1000 === 0));
  const ann = nextAnniversary(t.start_date);
  const hist = Array.isArray(t.history) ? t.history : [];
  const record = Math.max(days, ...hist.map((h) => h.days || 0));
  return `
  <article class="card tracker c-${esc(t.color || 'peach')}-soft">
    <div class="tracker-top">
      <span class="t-emoji big">${esc(t.emoji || '⏳')}</span>
      <div class="t-title"><h3>${esc(t.title)}</h3>${t.description ? `<p>${esc(t.description)}</p>` : ''}</div>
      <button class="icon-btn sm ${t.pinned ? 'on' : ''}" data-action="tr-pin" data-id="${t.id}" title="${t.pinned ? 'Vom Dashboard lösen' : 'Aufs Dashboard'}">📌</button>
      <button class="icon-btn sm" data-action="tr-edit" data-id="${t.id}" aria-label="Bearbeiten">✎</button>
    </div>
    ${isMilestone ? `<div class="milestone">🎉 Heute: ${plural(days, 'Tag', 'Tage')}!</div>` : ''}
    <div class="t-count"><b>${Math.abs(days).toLocaleString('de-DE')}</b><span>${future ? (days === -1 ? 'Tag noch' : 'Tage noch') : days === 1 ? 'Tag' : 'Tage'}</span></div>
    <p class="t-since">${future ? 'Start am' : 'seit'} ${esc(fmtDate(t.start_date, 'long'))}${!future && days >= 30 ? `<br><small>= ${esc(ymdText(t.start_date, T))}</small>` : ''}</p>
    ${future ? '' : `
    <div class="progress"><i style="width:${pct.toFixed(1)}%"></i></div>
    <p class="t-next">Nächster Meilenstein: <b>${next.toLocaleString('de-DE')} Tage</b> · ${esc(fmtDate(addDays(t.start_date, next), 'medium'))} (noch ${next - days})</p>
    ${ann.years > 0 && ann.in <= 60 ? `<p class="t-next">🎂 ${ann.in === 0 ? `Heute ${ann.years}. Jahrestag!` : `${ann.years}. Jahrestag in ${plural(ann.in, 'Tag', 'Tagen')}`}</p>` : ''}`}
    <div class="tracker-foot">
      ${hist.length ? `<span class="muted">🏆 Rekord: ${plural(record, 'Tag', 'Tage')} · ${hist.length}× neu gestartet</span>` : '<span></span>'}
      <button class="btn ghost sm" data-action="tr-reset" data-id="${t.id}">↺ Neu starten</button>
    </div>
  </article>`;
}

export function render() {
  const list = sortedTrackers();
  return `
  <header class="page-head">
    <div><h1>Tage-Tracker</h1><p class="sub">Wie lange läuft's schon? Zusammen, rauchfrei, neue Wohnung …</p></div>
    <button class="btn primary" data-action="tr-new">＋ Tracker</button>
  </header>
  <div class="tracker-grid">
    ${list.length ? list.map((t) => trackerCard(t)).join('') : '<div class="empty card"><div class="empty-emoji">⏳</div><p>Noch kein Tracker – leg den ersten an!</p></div>'}
  </div>`;
}

const EMOJIS = ['💞', '🏡', '💍', '🚭', '🍷', '🏃', '🧘', '🐶', '🐱', '🌱', '💪', '📚', '🚗', '💼', '🎓', '⏳', '🍫', '☕', '📵', '🦷'];
function form(t = {}) {
  return `
    <label class="field"><span>Name</span><input name="title" required autofocus value="${esc(t.title || '')}" placeholder="z. B. Zusammen, Rauchfrei" maxlength="80"></label>
    <div class="field"><span>Symbol</span><div class="emoji-pick">${EMOJIS.map((e) => `<label><input type="radio" name="emoji" value="${e}" ${(t.emoji || '⏳') === e ? 'checked' : ''}><span>${e}</span></label>`).join('')}
      <label class="custom"><input type="radio" name="emoji" value="__custom" ${t.emoji && !EMOJIS.includes(t.emoji) ? 'checked' : ''}><input name="emoji_custom" maxlength="4" placeholder="🙂" value="${t.emoji && !EMOJIS.includes(t.emoji) ? esc(t.emoji) : ''}"></label></div></div>
    <label class="field"><span>Seit (Startdatum)</span><input type="date" name="start_date" required value="${esc(t.start_date || todayStr())}"></label>
    <label class="field"><span>Beschreibung</span><input name="description" value="${esc(t.description || '')}" placeholder="Optional" maxlength="200"></label>
    <div class="field"><span>Farbe</span><div class="swatches">${Object.entries(COLORS).map(([k, v]) => `<label class="swatch c-${k}" title="${v}"><input type="radio" name="color" value="${k}" ${(t.color || 'peach') === k ? 'checked' : ''}><span></span></label>`).join('')}</div></div>
    <label class="switch"><input type="checkbox" name="pinned" ${t.pinned ?? true ? 'checked' : ''}><span>Auf dem Dashboard zeigen</span></label>`;
}
const fromForm = (d) => ({
  title: d.title, emoji: d.emoji === '__custom' ? d.emoji_custom || '⏳' : d.emoji || '⏳', start_date: d.start_date,
  description: d.description || null, color: d.color || 'peach', pinned: !!d.pinned,
});

export const actions = {
  'tr-new': () => openModal({ title: 'Neuer Tracker', body: form(), submitLabel: 'Starten',
    onSubmit: async (d) => { await add('trackers', { ...fromForm(d), history: [] }); toast('Tracker läuft ⏳'); } }),
  'tr-edit': (el) => {
    const t = S.trackers.find((x) => x.id === el.dataset.id); if (!t) return;
    openModal({ title: 'Tracker bearbeiten', body: form(t), onSubmit: (d) => patch('trackers', t.id, fromForm(d)), onDelete: () => del('trackers', t.id) });
  },
  'tr-pin': (el) => { const t = S.trackers.find((x) => x.id === el.dataset.id); if (t) patch('trackers', t.id, { pinned: !t.pinned }); },
  'tr-reset': async (el) => {
    const t = S.trackers.find((x) => x.id === el.dataset.id); if (!t) return;
    const days = daysOf(t);
    if (!confirm(`„${t.title}“ neu starten? Die ${days} Tage werden in der Historie gespeichert.`)) return;
    burst(...centerOf(el), ['↺', '💪', '✨']);
    await patch('trackers', t.id, { start_date: todayStr(), history: [...(t.history || []), { start: t.start_date, end: todayStr(), days }] });
  },
};
