import { S, upsert, del, me, partner, myProfile, avatar, nameOf } from '../state.js';
import { esc, todayStr, addDays, fmtDate, relDay, parseDate, toDateStr, store } from '../util.js';
import { toast, burst, centerOf } from '../ui.js';

const MOODS = ['😊', '🥰', '🥳', '😴', '🤒', '😤', '😢', '🤗', '😌', '🤯'];
const V = { editing: false, reveal: false, n: 14, fEdit: false };
export const FEEL = { 1: ['😣', 'Mies'], 2: ['😕', 'Nicht so'], 3: ['😐', 'Okay'], 4: ['🙂', 'Gut'], 5: ['😄', 'Super'] };
export const feelingOf = (author, date) => S.diary_feelings.find((f) => f.author_id === author && f.entry_date === date);

function feelingChart() {
  const T = todayStr(); const days = 30; const p = partner();
  const W = 600, H = 120, pad = 14;
  const x = (i) => pad + (i * (W - 2 * pad)) / (days - 1);
  const y = (v) => H - pad - ((v - 1) * (H - 2 * pad)) / 4;
  const series = [[me(), 'mine'], ...(p ? [[p.id, 'theirs']] : [])].map(([id, cls]) => {
    const pts = [];
    for (let i = 0; i < days; i++) { const f = feelingOf(id, addDays(T, i - days + 1)); if (f) pts.push([x(i), y(f.score), f]); }
    return { cls, id, pts };
  });
  if (!series.some((s) => s.pts.length > 1)) return '';
  const grid = [1, 2, 3, 4, 5].map((v) => `<line x1="${pad}" x2="${W - pad}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`).join('');
  const lines = series.map((s) => `<polyline class="ln ${s.cls}" points="${s.pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}"/>${s.pts.map(([a, b, f]) => `<circle class="pt ${s.cls}" cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="4"><title>${esc(fmtDate(f.entry_date, 'short'))}: ${FEEL[f.score][1]}${f.is_private ? ' (privat)' : ''}</title></circle>`).join('')}`).join('');
  return `<div class="feel-chart">
    <div class="feel-legend"><span class="lg mine">${esc(nameOf(me()))}</span>${p ? `<span class="lg theirs">${esc(p.display_name)}</span>` : ''}<span class="muted small">letzte 30 Tage</span></div>
    <div class="feel-axis"><span>😄</span><span>😐</span><span>😣</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Stimmungsverlauf der letzten 30 Tage">${grid}${lines}</svg>
  </div>`;
}

function feelingSection() {
  const T = todayStr(), p = partner();
  const mine = feelingOf(me(), T), theirs = p ? feelingOf(p.id, T) : null;
  const editing = !mine || V.fEdit;
  const defPrivate = store.get('batzi-feel-private', false);
  const priv = mine ? mine.is_private : defPrivate;
  return `<section class="card feel-card">
    <div class="feel-cols">
      <div>
        <h3>🌡️ Wie geht’s dir heute?</h3>
        ${editing ? `<form data-submit="feel-save" class="feel-form">
          <div class="feel-scale">${[1, 2, 3, 4, 5].map((v) => `<label><input type="radio" name="score" value="${v}" ${mine?.score === v ? 'checked' : ''} required><span><b>${FEEL[v][0]}</b><small>${FEEL[v][1]}</small></span></label>`).join('')}</div>
          <textarea name="note" id="feel-note" data-keep rows="2" maxlength="1000" placeholder="Was beschäftigt dich? (optional)">${esc(mine?.note || '')}</textarea>
          <div class="row-between wrap-gap">
            <label class="switch"><input type="checkbox" name="share" ${priv ? '' : 'checked'}><span>${p ? esc(p.display_name) : 'Dein Schatz'} darf das sehen</span></label>
            <div class="btn-row">${mine ? '<button type="button" class="btn ghost sm" data-action="feel-cancel">Abbrechen</button>' : ''}<button class="btn primary sm" type="submit">Speichern</button></div>
          </div>
        </form>` : `<div class="feel-show">
          <span class="feel-big">${FEEL[mine.score][0]}</span>
          <div><b>${FEEL[mine.score][1]}</b>${mine.note ? `<p>${esc(mine.note)}</p>` : ''}
          <p class="muted small">${mine.is_private ? '🔒 Nur für dich' : `👀 ${p ? esc(p.display_name) : 'Dein Schatz'} kann das sehen`}</p></div>
          <button class="icon-btn sm" data-action="feel-edit" aria-label="Bearbeiten">✎</button>
        </div>`}
      </div>
      ${p ? `<div class="feel-partner">
        <h3>${avatar(p.id, 'sm')} ${esc(p.display_name)} heute</h3>
        ${theirs ? `<div class="feel-show"><span class="feel-big">${FEEL[theirs.score][0]}</span><div><b>${FEEL[theirs.score][1]}</b>${theirs.note ? `<p>${esc(theirs.note)}</p>` : ''}</div></div>`
          : `<p class="muted">Noch nichts geteilt${'' }.</p>`}
      </div>` : ''}
    </div>
    ${feelingChart()}
  </section>`;
}

export const entryOf = (author, date) => S.diary_entries.find((e) => e.author_id === author && e.entry_date === date);
export const myToday = () => entryOf(me(), todayStr());
export const theirToday = () => (partner() ? entryOf(partner().id, todayStr()) : null);

export function streak() {
  const p = partner(); if (!p) return 0;
  let d = todayStr(); let n = 0;
  if (!(entryOf(me(), d) && entryOf(p.id, d))) d = addDays(d, -1);
  while (entryOf(me(), d) && entryOf(p.id, d)) { n++; d = addDays(d, -1); }
  return n;
}

export const bubble = (e, side = 'left') => `
  <div class="bubble ${side}">
    <div class="bubble-head">${avatar(e.author_id, 'xs')}${e.mood ? `<span class="mood">${esc(e.mood)}</span>` : ''}</div>
    <p>${esc(e.message).replace(/\n/g, '<br>')}</p>
  </div>`;

export function render() {
  const p = partner(), mp = myProfile();
  const mine = myToday(), theirs = theirToday();
  const st = streak();
  const T = todayStr();
  const lastYear = toDateStr(new Date(parseDate(T).getFullYear() - 1, parseDate(T).getMonth(), parseDate(T).getDate()));
  const ly = S.diary_entries.filter((e) => e.entry_date === lastYear);
  const dates = [...new Set(S.diary_entries.map((e) => e.entry_date))].filter((d) => d < T).sort().reverse();
  const shown = dates.slice(0, V.n);
  const editing = !mine || V.editing;

  return `
  <header class="page-head">
    <div><h1>Tagebuch</h1><p class="sub">Eine kleine Nachricht am Tag – nur für den anderen.</p></div>
    ${st ? `<div class="streak">🔥 <b>${st}</b> ${st === 1 ? 'Tag' : 'Tage'} in Folge</div>` : ''}
  </header>

  <div class="diary-today">
    <section class="card diary-card mine">
      <h3>${avatar(me(), 'sm')} Deine Nachricht ${p ? 'an ' + esc(p.display_name) : ''} <small>· ${esc(fmtDate(T, 'weekday'))}</small></h3>
      ${editing ? `
      <form data-submit="diary-save" autocomplete="off">
        <textarea id="diary-msg" name="message" data-keep rows="5" maxlength="2000" required placeholder="Was ich dir heute sagen möchte …">${esc(mine?.message || '')}</textarea>
        <div class="mood-pick">${MOODS.map((m) => `<label><input type="radio" name="mood" value="${m}" ${(mine?.mood || '') === m ? 'checked' : ''}><span>${m}</span></label>`).join('')}</div>
        <div class="btn-row end">
          ${mine ? '<button type="button" class="btn ghost" data-action="diary-cancel">Abbrechen</button>' : ''}
          <button class="btn primary" type="submit">${mine ? 'Speichern' : 'Abschicken 💌'}</button>
        </div>
      </form>` : `
      ${bubble(mine, 'right')}
      <div class="btn-row end"><button class="btn ghost sm" data-action="diary-edit">✎ Bearbeiten</button><button class="btn ghost danger sm" data-action="diary-del">Löschen</button></div>
      <p class="hint">Heute kannst du sie noch ändern. Morgen gibt’s eine neue Seite.</p>`}
    </section>

    <section class="card diary-card theirs">
      <h3>${p ? `${avatar(p.id, 'sm')} ${esc(p.display_name)} an dich` : '💌 Von deinem Schatz'}</h3>
      ${!p ? '<p class="muted">Sobald sich dein Schatz angemeldet hat, erscheinen hier die Nachrichten.</p>'
        : theirs ? (mine || V.reveal ? bubble(theirs, 'left')
          : `<div class="sealed"><div class="envelope">💌</div><p><b>${esc(p.display_name)}</b> hat dir heute geschrieben!</p><p class="muted">Schreib erst deine eigene Nachricht – dann wird’s aufgedeckt.</p><button class="btn ghost sm" data-action="diary-reveal">Ich kann nicht warten 🙈</button></div>`)
          : `<div class="sealed"><div class="envelope dim">✉️</div><p class="muted">${esc(p.display_name)} hat heute noch nichts geschrieben.</p></div>`}
    </section>
  </div>

  ${feelingSection()}

  ${ly.length ? `<section class="card throwback"><h3>📸 Heute vor einem Jahr</h3><div class="day-bubbles">${ly.map((e) => bubble(e, e.author_id === me() ? 'right' : 'left')).join('')}</div></section>` : ''}

  <section class="archive">
    <h2>Frühere Seiten</h2>
    ${shown.length ? shown.map((d) => {
      const es = S.diary_entries.filter((e) => e.entry_date === d).sort((a, b) => (a.author_id === me()) - (b.author_id === me()));
      return `<article class="card diary-day">
        <h3>${esc(fmtDate(d, 'long'))} <small>${esc(relDay(d))}</small></h3>
        <div class="day-bubbles">${es.map((e) => bubble(e, e.author_id === me() ? 'right' : 'left')).join('')}
        ${p && es.length === 1 ? `<p class="muted small">${es[0].author_id === me() ? esc(p.display_name) + ' hat an dem Tag nicht geschrieben.' : 'Du hast an dem Tag nicht geschrieben.'}</p>` : ''}</div>
      </article>`;
    }).join('') : '<p class="muted">Noch keine älteren Einträge – das Tagebuch fängt gerade erst an 🌱</p>'}
    ${dates.length > V.n ? '<div class="center"><button class="btn ghost" data-action="diary-more">Ältere laden</button></div>' : ''}
  </section>`;
}

export const actions = {
  'diary-save': async (form) => {
    const msg = form.querySelector('[name=message]').value.trim();
    if (!msg) return;
    const mood = form.querySelector('[name=mood]:checked')?.value || null;
    const first = !myToday();
    const btn = form.querySelector('[type=submit]');
    await upsert('diary_entries', { author_id: me(), entry_date: todayStr(), message: msg, mood, updated_at: new Date().toISOString() }, 'author_id,entry_date');
    V.editing = false;
    if (first) { burst(...centerOf(btn), ['💌', '💛', '✨', '🥰']); toast('Nachricht verschickt 💌'); }
  },
  'diary-edit': () => { V.editing = true; },
  'feel-save': async (form) => {
    const score = Number(form.querySelector('[name=score]:checked')?.value);
    if (!score) { toast('Wähl kurz ein Gesicht aus 🙂'); return; }
    const is_private = !form.querySelector('[name=share]').checked;
    store.set('batzi-feel-private', is_private);
    await upsert('diary_feelings', { author_id: me(), entry_date: todayStr(), score, note: form.querySelector('[name=note]').value.trim() || null, is_private, updated_at: new Date().toISOString() }, 'author_id,entry_date');
    V.fEdit = false; toast(is_private ? 'Gespeichert 🔒 nur für dich' : 'Gespeichert 💛');
  },
  'feel-edit': () => { V.fEdit = true; },
  'feel-cancel': () => { V.fEdit = false; },
  'diary-cancel': () => { V.editing = false; },
  'diary-del': async () => { const m = myToday(); if (m && confirm('Heutige Nachricht löschen?')) { await del('diary_entries', m.id); V.editing = false; } },
  'diary-reveal': () => { V.reveal = true; },
  'diary-more': () => { V.n += 14; },
};
