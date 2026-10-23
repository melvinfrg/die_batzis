import { S, add, patch, del, me, partner, avatar, whoOptions, nameOf, profileOf } from '../state.js';
import { esc, todayStr, diffDays, fmtDate, money, safeUrl, hostOf, relDay } from '../util.js';
import { openModal, toast } from '../ui.js';

export const ORGA_CATS = [
  ['Versicherungen', '🛡️'], ['Strom & Energie', '⚡'], ['Verträge', '📄'], ['Abos & Streaming', '📺'],
  ['Wohnen', '🏠'], ['Mobilität', '🚗'], ['Finanzen', '🏦'], ['Gesundheit', '🩺'], ['Sonstiges', '📦'],
];
const catEmoji = (c) => (ORGA_CATS.find(([n]) => n === c) || ['', '📦'])[1];
export const INTERVALS = { monthly: ['monatlich', 1], quarterly: ['vierteljährlich', 3], halfyearly: ['halbjährlich', 6], yearly: ['jährlich', 12], once: ['einmalig', 0] };
const V = { tab: 'Kosten', showInactive: false };

export const perMonth = (o) => { const k = INTERVALS[o.interval]?.[1] ?? 1; return k ? (Number(o.amount) || 0) / k : 0; };
const active = () => S.orga_items.filter((o) => o.active !== false);
export function deadlines(days = 60) {
  const T = todayStr();
  return active().filter((o) => o.cancel_by && o.cancel_by >= T && diffDays(T, o.cancel_by) <= days).sort((a, b) => a.cancel_by.localeCompare(b.cancel_by));
}

function itemCard(o) {
  const url = safeUrl(o.url);
  const T = todayStr();
  const dl = o.cancel_by && o.cancel_by >= T ? diffDays(T, o.cancel_by) : null;
  return `<article class="card orga-item ${o.active === false ? 'inactive' : ''}">
    <div class="orga-top">
      <span class="orga-ic">${catEmoji(o.category)}</span>
      <div class="grow"><h3>${esc(o.title)}</h3>${o.provider ? `<p class="muted">${esc(o.provider)}</p>` : ''}</div>
      <div class="orga-amount">${o.amount != null ? `<b>${money(o.amount)}</b><small>${esc(INTERVALS[o.interval]?.[0] || '')}</small>` : ''}</div>
      <button class="icon-btn sm" data-action="og-edit" data-id="${o.id}" aria-label="Bearbeiten">✎</button>
    </div>
    <div class="orga-meta">
      ${o.payer ? `<span class="tag">${avatar(o.payer, 'xs')} zahlt ${esc(nameOf(o.payer))}</span>` : ''}
      ${o.interval !== 'monthly' && o.interval !== 'once' && o.amount ? `<span class="tag">≈ ${money(perMonth(o))}/Monat</span>` : ''}
      ${o.contract_no ? `<span class="tag" title="Vertrags-/Kundennummer">#️⃣ ${esc(o.contract_no)}</span>` : ''}
      ${o.end_date ? `<span class="tag">📆 Laufzeit bis ${esc(fmtDate(o.end_date))}</span>` : ''}
      ${dl != null ? `<span class="tag ${dl <= 30 ? 'bad' : 'warn'}">✂️ Kündigen bis ${esc(fmtDate(o.cancel_by))} (${esc(relDay(o.cancel_by))})</span>` : ''}
      ${o.notice ? `<span class="tag">⏳ ${esc(o.notice)}</span>` : ''}
      ${o.active === false ? '<span class="tag">⏸️ inaktiv</span>' : ''}
    </div>
    ${o.contact || url || o.notes ? `<div class="orga-extra">
      ${o.contact ? `<p>☎️ ${esc(o.contact)}</p>` : ''}
      ${url ? `<p>🔗 <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(url))}</a></p>` : ''}
      ${o.notes ? `<p class="muted">${esc(o.notes)}</p>` : ''}
    </div>` : ''}
  </article>`;
}

function renderCosts() {
  const list = active();
  const monthly = list.reduce((s, o) => s + perMonth(o), 0);
  const once = list.filter((o) => o.interval === 'once').reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const byCat = ORGA_CATS.map(([c, e]) => [c, e, list.filter((o) => o.category === c).reduce((s, o) => s + perMonth(o), 0)]).filter(([, , v]) => v > 0).sort((a, b) => b[2] - a[2]);
  const max = Math.max(1, ...byCat.map(([, , v]) => v));
  const m = me(), p = partner();
  const payerSum = (id) => list.filter((o) => o.payer === id).reduce((s, o) => s + perMonth(o), 0);
  const both = payerSum('both'), mine = payerSum(m), theirs = p ? payerSum(p.id) : 0;
  const none = list.filter((o) => !o.payer).reduce((s, o) => s + perMonth(o), 0);
  const shareMe = mine + (both + none) / 2, shareP = theirs + (both + none) / 2;
  const top = list.filter((o) => o.interval !== 'once').sort((a, b) => perMonth(b) - perMonth(a)).slice(0, 8);
  const dls = deadlines(120);
  return `
  <section class="stats">
    <div class="stat c-peach"><b>${money(monthly)}</b><span>pro Monat</span></div>
    <div class="stat c-lemon"><b>${money(monthly * 12)}</b><span>pro Jahr</span></div>
    <div class="stat c-mint"><b>${list.filter((o) => o.interval !== 'once').length}</b><span>laufende Posten</span></div>
    ${once ? `<div class="stat c-sky"><b>${money(once)}</b><span>einmalige Kosten</span></div>` : `<div class="stat c-sky"><b>${dls.length}</b><span>Kündigungsfristen bald</span></div>`}
  </section>
  <div class="ov-grid">
    <section class="card">
      <h3>Kosten nach Bereich <small class="muted">· pro Monat</small></h3>
      ${byCat.length ? `<div class="bars">${byCat.map(([c, e, v]) => `
        <button class="bar-row" data-action="og-tab" data-v="${esc(c)}">
          <span class="bar-label">${e} ${esc(c)}</span>
          <span class="bar-track"><i style="width:${((v / max) * 100).toFixed(1)}%"></i></span>
          <span class="bar-val">${money(v)}</span>
        </button>`).join('')}</div>` : '<p class="muted">Noch keine Kosten eingetragen.</p>'}
      ${top.length ? `<h3 class="mt">Größte Posten</h3><ul class="cost-list">${top.map((o) => `<li><span>${catEmoji(o.category)}</span><span class="grow">${esc(o.title)}${o.provider ? ` <small class="muted">· ${esc(o.provider)}</small>` : ''}</span>${o.payer ? avatar(o.payer, 'xs') : ''}<b>${money(perMonth(o))}</b></li>`).join('')}</ul>` : ''}
    </section>
    <div class="stack">
      <section class="card">
        <h3>Wer zahlt was? <small class="muted">· pro Monat</small></h3>
        <ul class="cost-list">
          ${S.profiles.map((pr) => `<li>${avatar(pr.id, 'sm')}<span class="grow">${esc(pr.display_name)} allein</span><b>${money(payerSum(pr.id))}</b></li>`).join('')}
          ${both ? `<li>${avatar('both', 'sm')}<span class="grow">Gemeinsam</span><b>${money(both)}</b></li>` : ''}
          ${none ? `<li><span class="avatar sm">❔</span><span class="grow">Ohne Zuordnung</span><b>${money(none)}</b></li>` : ''}
        </ul>
        ${p ? `<p class="balance">⚖️ Bei 50/50 der gemeinsamen Kosten trägt ${esc(nameOf(m))} <b>${money(shareMe)}</b> und ${esc(p.display_name)} <b>${money(shareP)}</b> im Monat.</p>` : ''}
      </section>
      <section class="card">
        <h3>✂️ Kündigungsfristen</h3>
        ${dls.length ? dls.map((o) => `<button class="ev-row ${diffDays(todayStr(), o.cancel_by) <= 30 ? 'c-rose' : 'c-lemon'}" data-action="og-edit" data-id="${o.id}"><span class="ev-time"><b>${esc(relDay(o.cancel_by))}</b>${esc(fmtDate(o.cancel_by, 'dm'))}</span><span class="ev-text"><span class="ev-title">${esc(o.title)}</span><span class="ev-sub">${esc(o.provider || o.category)}</span></span></button>`).join('')
          : '<p class="muted">Keine Fristen in den nächsten 4 Monaten. Tragt bei Verträgen „Kündigen bis“ ein, dann erinnert euch das Dashboard rechtzeitig.</p>'}
      </section>
    </div>
  </div>`;
}

export function render() {
  const counts = Object.fromEntries(ORGA_CATS.map(([c]) => [c, S.orga_items.filter((o) => o.category === c).length]));
  const tab = (k, l, n) => `<button class="tab ${V.tab === k ? 'on' : ''}" data-action="og-tab" data-v="${esc(k)}">${l}${n ? ` <span class="count">${n}</span>` : ''}</button>`;
  let body;
  if (V.tab === 'Kosten') body = renderCosts();
  else {
    const list = S.orga_items.filter((o) => (V.tab === 'Alle' || o.category === V.tab) && (V.showInactive || o.active !== false))
      .sort((a, b) => perMonth(b) - perMonth(a) || a.title.localeCompare(b.title, 'de'));
    const sum = list.filter((o) => o.active !== false).reduce((s, o) => s + perMonth(o), 0);
    const inactive = S.orga_items.filter((o) => (V.tab === 'Alle' || o.category === V.tab) && o.active === false).length;
    body = `
      <div class="row-between sugg-head">
        <p class="muted">${list.length ? `${list.length} Einträge · ${money(sum)} pro Monat` : ''}</p>
        <div class="btn-row">${inactive ? `<button class="btn ghost sm" data-action="og-inactive">${V.showInactive ? 'Inaktive ausblenden' : `${inactive} inaktive zeigen`}</button>` : ''}<button class="btn sm" data-action="og-new">＋ ${V.tab === 'Alle' ? 'Eintrag' : esc(V.tab)}</button></div>
      </div>
      <div class="orga-grid">${list.map(itemCard).join('') || `<div class="empty card"><div class="empty-emoji">${V.tab === 'Alle' ? '🗂️' : catEmoji(V.tab)}</div><p>Hier ist noch nichts eingetragen.</p><button class="btn primary" data-action="og-new">＋ Ersten Eintrag anlegen</button></div>`}</div>`;
  }
  return `
  <header class="page-head">
    <div><h1>Orga</h1><p class="sub">Versicherungen, Strom, Verträge & Abos – mit allen Kosten auf einen Blick.</p></div>
    <button class="btn primary" data-action="og-new">＋ Eintrag</button>
  </header>
  <nav class="tabs">${tab('Kosten', '💶 Kosten')}${tab('Alle', '🗂️ Alle', S.orga_items.length)}${ORGA_CATS.map(([c, e]) => tab(c, `${e} ${c}`, counts[c])).join('')}</nav>
  ${body}`;
}

function form(o = {}) {
  const cat = o.category || (V.tab !== 'Kosten' && V.tab !== 'Alle' ? V.tab : 'Verträge');
  return `
    <div class="row2">
      <label class="field"><span>Bereich</span><select name="category">${ORGA_CATS.map(([c, e]) => `<option value="${esc(c)}" ${cat === c ? 'selected' : ''}>${e} ${esc(c)}</option>`).join('')}</select></label>
      <label class="field"><span>Bezeichnung</span><input name="title" required autofocus value="${esc(o.title || '')}" placeholder="z. B. Haftpflicht, Strom, Handy" maxlength="120"></label>
    </div>
    <label class="field"><span>Anbieter</span><input name="provider" value="${esc(o.provider || '')}" placeholder="z. B. HUK, Stadtwerke, Telekom"></label>
    <div class="row2">
      <label class="field"><span>Betrag (€)</span><input type="number" name="amount" step="0.01" min="0" inputmode="decimal" value="${esc(o.amount ?? '')}"></label>
      <label class="field"><span>Zahlweise</span><select name="interval">${Object.entries(INTERVALS).map(([k, [l]]) => `<option value="${k}" ${(o.interval || 'monthly') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="row2">
      <label class="field"><span>Wer zahlt?</span><select name="payer">${whoOptions(o.payer ?? 'both')}</select></label>
      <label class="field"><span>Vertrags-/Kundennr.</span><input name="contract_no" value="${esc(o.contract_no || '')}"></label>
    </div>
    <div class="row2">
      <label class="field"><span>Beginn</span><input type="date" name="start_date" value="${esc(o.start_date || '')}"></label>
      <label class="field"><span>Laufzeit bis</span><input type="date" name="end_date" value="${esc(o.end_date || '')}"></label>
    </div>
    <div class="row2">
      <label class="field"><span>Kündigen bis</span><input type="date" name="cancel_by" value="${esc(o.cancel_by || '')}"></label>
      <label class="field"><span>Kündigungsfrist</span><input name="notice" value="${esc(o.notice || '')}" placeholder="z. B. 3 Monate zum Laufzeitende"></label>
    </div>
    <label class="field"><span>Kontakt</span><input name="contact" value="${esc(o.contact || '')}" placeholder="Telefon, E-Mail, Ansprechpartner"></label>
    <label class="field"><span>Link (Kundenportal)</span><input name="url" value="${esc(o.url || '')}" placeholder="https://…"></label>
    <label class="field"><span>Notizen</span><textarea name="notes" rows="2">${esc(o.notes || '')}</textarea></label>
    <label class="switch"><input type="checkbox" name="active" ${o.active === false ? '' : 'checked'}><span>Aktiv (zählt zu den Kosten)</span></label>
    <p class="hint">🔒 Nur ihr beide könnt diese Daten sehen. Passwörter bitte trotzdem nicht hier speichern.</p>`;
}
const fromForm = (d) => ({
  category: d.category, title: d.title, provider: d.provider || null,
  amount: d.amount === '' || d.amount == null ? null : Number(String(d.amount).replace(',', '.')), interval: d.interval || 'monthly',
  payer: d.payer || null, contract_no: d.contract_no || null, start_date: d.start_date || null, end_date: d.end_date || null,
  cancel_by: d.cancel_by || null, notice: d.notice || null, contact: d.contact || null, url: d.url ? safeUrl(d.url) : null,
  notes: d.notes || null, active: !!d.active,
});

export const actions = {
  'og-tab': (el) => { V.tab = el.dataset.v; },
  'og-inactive': () => { V.showInactive = !V.showInactive; },
  'og-new': () => openModal({ title: 'Neuer Eintrag', body: form(), wide: true, submitLabel: 'Speichern',
    onSubmit: async (d) => { await add('orga_items', fromForm(d)); toast('Eingetragen 🗂️'); } }),
  'og-edit': (el) => {
    const o = S.orga_items.find((x) => x.id === el.dataset.id); if (!o) return;
    openModal({ title: 'Eintrag bearbeiten', body: form(o), wide: true, onSubmit: (d) => patch('orga_items', o.id, fromForm(d)), onDelete: () => del('orga_items', o.id) });
  },
};
