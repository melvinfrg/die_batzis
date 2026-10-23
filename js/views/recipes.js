import { S, add, patch, del, getSetting, setSetting, nameOf } from '../state.js';
import { esc, todayStr, safeUrl, cssUrl, hostOf } from '../util.js';
import { openModal, toast, burst, centerOf } from '../ui.js';
import { BUILTIN_RECIPES, BASICS } from '../recipes-data.js';
import { addShopping } from './shopping.js';

const TAGS = { vegetarisch: '🥦 Vegetarisch', vegan: '🌱 Vegan', schnell: '⚡ Schnell', fleisch: '🍗 Fleisch', fisch: '🐟 Fisch', pasta: '🍝 Pasta', suppe: '🍲 Suppe', salat: '🥗 Salat', ofen: '🔥 Ofen', frühstück: '🥐 Frühstück', süß: '🍰 Süß', resteessen: '♻️ Reste' };
const V = { tab: 'today', q: '', tag: 'all', shuffle: 0 };

export const prefs = () => ({ veg: false, max: 0, count: 3, favorites: [], hidden: [], ...getSetting('recipe_prefs', {}) });
const savePrefs = (p) => setSetting('recipe_prefs', { ...prefs(), ...p });
export const pantry = () => getSetting('pantry', {}).items || [];
export const mealToday = () => { const m = getSetting('meal_today', {}); return m.date === todayStr() ? allRecipes().find((r) => r.id === m.recipe_id) : null; };

export const allRecipes = () => [...S.recipes.map((r) => ({ ...r, own: true })), ...BUILTIN_RECIPES];
const byId = (id) => allRecipes().find((r) => r.id === id);

const core = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^\p{L}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
const stem = (w) => w.replace(/(en|er|n|e|s)$/u, '');
export const isBasic = (name) => BASICS.includes(core(name));
export function have(name, list = pantry()) {
  const c = core(name); if (!c) return false;
  const cw = c.split(' ').map(stem).filter((w) => w.length >= 3);
  return list.some((p) => {
    const pc = core(p); if (!pc) return false;
    if (pc === c || c.includes(pc) || pc.includes(c)) return true;
    const pw = pc.split(' ').map(stem).filter((w) => w.length >= 3);
    return pw.some((w) => cw.includes(w));
  });
}
export function matchInfo(r, list = pantry()) {
  const ing = (r.ingredients || []).filter((i) => !isBasic(i.name));
  const got = ing.filter((i) => have(i.name, list));
  return { total: ing.length, got: got.length, missing: ing.filter((i) => !have(i.name, list)), pct: ing.length ? got.length / ing.length : 0 };
}

function seeded(seed) { let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; }
function pool() {
  const p = prefs();
  return allRecipes().filter((r) => !p.hidden.includes(r.id)
    && (!p.veg || (r.tags || []).some((t) => t === 'vegetarisch' || t === 'vegan'))
    && (!p.max || !r.minutes || r.minutes <= p.max));
}
export function dailySuggestions(n = prefs().count, extra = 0) {
  const rnd = seeded(todayStr() + ':' + extra);
  const list = pool().map((r) => ({ r, k: rnd() - (prefs().favorites.includes(r.id) ? 0.15 : 0) - matchInfo(r).pct * 0.25 }));
  return list.sort((a, b) => a.k - b.k).slice(0, n).map((x) => x.r);
}

const tagChips = (r) => (r.tags || []).slice(0, 3).map((t) => `<span class="tag">${esc(TAGS[t] || t)}</span>`).join('');

export function recipeCard(r, { showMatch = pantry().length > 0, size = '' } = {}) {
  const m = matchInfo(r);
  const fav = prefs().favorites.includes(r.id);
  const bg = r.image_url ? cssUrl(r.image_url) : '';
  return `<button class="card recipe-card ${size}" data-action="rc-open" data-id="${esc(r.id)}">
    <span class="rc-emoji ${bg ? 'img' : ''}" ${bg ? `style="background-image:${esc(bg)}"` : ''}>${bg ? '' : esc(r.emoji || '🍽️')}</span>
    <span class="rc-body">
      <span class="rc-title">${esc(r.title)}${fav ? ' <span title="Favorit">⭐</span>' : ''}</span>
      <span class="rc-meta">${r.minutes ? `<span class="tag">⏱️ ${r.minutes} Min.</span>` : ''}${tagChips(r)}${r.own ? '<span class="tag">📒 Unser Rezept</span>' : ''}</span>
      ${showMatch && m.total ? `<span class="rc-match"><span class="progress sm"><i style="width:${(m.pct * 100).toFixed(0)}%"></i></span><small>${m.got} von ${m.total} Zutaten da</small></span>` : ''}
    </span>
  </button>`;
}

export function render() {
  const tab = (k, l) => `<button class="tab ${V.tab === k ? 'on' : ''}" data-action="rc-tab" data-v="${k}">${l}</button>`;
  const body = { today: renderToday, pantry: renderPantry, all: renderAll }[V.tab]();
  return `
  <header class="page-head">
    <div><h1>Rezepte</h1><p class="sub">Keine Idee, was es gibt? Hier kommen jeden Tag frische Vorschläge.</p></div>
    <button class="btn primary" data-action="rc-new">＋ Eigenes Rezept</button>
  </header>
  <nav class="tabs">${tab('today', '✨ Heute')}${tab('pantry', '🧺 Was haben wir da?')}${tab('all', `📖 Alle Rezepte <span class="count">${allRecipes().length}</span>`)}</nav>
  ${body}`;
}

function renderToday() {
  const meal = mealToday();
  const sugg = dailySuggestions(prefs().count, V.shuffle);
  const p = prefs();
  return `
  ${meal ? `<section class="card meal-today"><p class="eyebrow">Heute gibt’s</p><div class="row-between"><h2>${esc(meal.emoji || '🍽️')} ${esc(meal.title)}</h2><div class="btn-row"><button class="btn sm" data-action="rc-open" data-id="${esc(meal.id)}">Rezept ansehen</button><button class="btn ghost sm" data-action="rc-unplan">✕</button></div></div></section>` : ''}
  <div class="row-between sugg-head"><h2>Vorschläge für heute</h2><button class="btn ghost sm" data-action="rc-shuffle">🔀 Andere Ideen</button></div>
  <div class="recipe-grid">${sugg.map((r) => recipeCard(r, { size: 'big' })).join('') || '<div class="empty card"><p>Keine Rezepte passen zu euren Einstellungen.</p></div>'}</div>
  <section class="card prefs">
    <h3>⚙️ Vorschläge einstellen</h3>
    <div class="prefs-row">
      <label class="switch"><input type="checkbox" data-change="rc-pref-veg" ${p.veg ? 'checked' : ''}><span>Nur vegetarisch/vegan</span></label>
      <label class="field inline"><span>Max. Zeit</span><select data-change="rc-pref-max">${[[0, 'egal'], [15, '15 Min.'], [20, '20 Min.'], [30, '30 Min.'], [45, '45 Min.']].map(([v, l]) => `<option value="${v}" ${p.max === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field inline"><span>Vorschläge pro Tag</span><select data-change="rc-pref-count">${[1, 2, 3, 4, 6].map((v) => `<option ${p.count === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <p class="hint">Die Vorschläge wechseln jeden Tag automatisch und erscheinen auch auf dem Dashboard. Rezepte mit Zutaten, die ihr schon da habt, und Favoriten kommen öfter dran.</p>
  </section>`;
}

function renderPantry() {
  const items = pantry();
  const ranked = items.length ? allRecipes().map((r) => ({ r, m: matchInfo(r, items) })).filter((x) => x.m.got > 0).sort((a, b) => b.m.pct - a.m.pct || a.m.missing.length - b.m.missing.length).slice(0, 12) : [];
  const QUICK = ['Nudeln', 'Reis', 'Kartoffeln', 'Eier', 'Zwiebeln', 'Knoblauch', 'Tomaten (Dose)', 'Passierte Tomaten', 'Käse', 'Milch', 'Sahne', 'Paprika', 'Hackfleisch', 'Hähnchen', 'Brokkoli', 'Kokosmilch', 'Linsen', 'Feta', 'Tortilla-Wraps', 'Brot'];
  return `
  <section class="card">
    <h3>🧺 Das haben wir zu Hause</h3>
    <form class="quick mini" data-submit="rc-pantry-add" autocomplete="off"><input id="pantry-in" name="item" placeholder="Zutat hinzufügen … (mehrere mit Komma)" aria-label="Zutat"><button class="btn primary sm" type="submit">＋</button></form>
    <div class="shop-chips">${items.map((i) => `<button class="chip on" data-action="rc-pantry-del" data-v="${esc(i)}" title="Entfernen">${esc(i)} ✕</button>`).join('') || '<p class="muted">Noch leer – tippe unten auf Zutaten oder trag sie oben ein.</p>'}</div>
    <div class="shop-chips quick-add">${QUICK.filter((q) => !items.some((i) => i.toLowerCase() === q.toLowerCase())).map((q) => `<button class="chip" data-action="rc-pantry-quick" data-v="${esc(q)}">＋ ${esc(q)}</button>`).join('')}</div>
    ${items.length ? '<div class="btn-row end"><button class="btn ghost sm danger" data-action="rc-pantry-clear">Alles leeren</button></div>' : ''}
  </section>
  ${items.length ? `<div class="row-between sugg-head"><h2>Damit könnt ihr kochen</h2></div>
  <div class="recipe-grid">${ranked.map(({ r }) => recipeCard(r, { showMatch: true })).join('') || '<div class="empty card"><p>Keine passenden Rezepte – fügt ein paar mehr Zutaten hinzu.</p></div>'}</div>` : ''}`;
}

function renderAll() {
  const q = V.q.toLowerCase();
  const favs = prefs().favorites;
  const list = allRecipes().filter((r) => (V.tag === 'all' || (V.tag === 'fav' ? favs.includes(r.id) : V.tag === 'own' ? r.own : (r.tags || []).includes(V.tag)))
    && (!q || `${r.title} ${(r.ingredients || []).map((i) => i.name).join(' ')}`.toLowerCase().includes(q)));
  const chip = (v, l) => `<button class="chip ${V.tag === v ? 'on' : ''}" data-action="rc-tag" data-v="${esc(v)}">${l}</button>`;
  return `
  <div class="toolbar">
    <div class="chips">${chip('all', 'Alle')}${chip('fav', '⭐ Favoriten')}${chip('own', '📒 Unsere')}${Object.entries(TAGS).map(([k, l]) => chip(k, l)).join('')}</div>
    <div class="toolbar-right"><input type="search" id="rc-search" placeholder="Rezept oder Zutat suchen …" value="${esc(V.q)}" data-input="rc-search"></div>
  </div>
  <div class="recipe-grid">${list.map((r) => recipeCard(r)).join('') || '<div class="empty card"><div class="empty-emoji">🍳</div><p>Nichts gefunden.</p></div>'}</div>`;
}

// ---------- Detail ----------
export function openRecipe(id) {
  const r = byId(id); if (!r) return;
  const p = prefs(); const fav = p.favorites.includes(r.id);
  const m = matchInfo(r);
  const url = safeUrl(r.url);
  const dlg = openModal({
    title: `${r.emoji || '🍽️'} ${r.title}`, wide: true, hideCancel: true,
    body: `
      <div class="rc-detail-meta">${r.minutes ? `<span class="tag">⏱️ ${r.minutes} Min.</span>` : ''}<span class="tag">👥 ${r.servings || 2} Portionen</span>${tagChips(r)}${r.own && r.created_by ? `<span class="tag">von ${esc(nameOf(r.created_by))}</span>` : ''}</div>
      <div class="rc-detail">
        <div>
          <h3>Zutaten</h3>
          <ul class="ing-list">${(r.ingredients || []).map((i) => { const ok = isBasic(i.name) || have(i.name); return `<li class="${ok ? 'ok' : ''}"><span class="ing-ic">${ok ? '✓' : '·'}</span><span class="grow">${esc(i.name)}</span><span class="muted">${esc(i.amount || '')}</span></li>`; }).join('')}</ul>
          ${pantry().length ? `<p class="hint">✓ = laut eurem Vorrat zu Hause</p>` : ''}
        </div>
        <div>
          <h3>So geht’s</h3>
          <ol class="steps">${String(r.steps || '').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => `<li>${esc(s)}</li>`).join('') || '<li class="muted">Keine Anleitung hinterlegt.</li>'}</ol>
          ${url ? `<a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">🔗 Originalrezept (${esc(hostOf(url))})</a>` : ''}
        </div>
      </div>
      <div class="btn-row rc-actions">
        <button type="button" class="btn primary" data-rc="shop">🛒 ${m.missing.length ? `${m.missing.length} fehlende Zutaten` : 'Zutaten'} auf die Einkaufsliste</button>
        <button type="button" class="btn" data-rc="plan">🍽️ Heute kochen</button>
        <button type="button" class="btn ghost" data-rc="fav">${fav ? '⭐ Favorit' : '☆ Favorit'}</button>
        ${r.own ? '<button type="button" class="btn ghost" data-rc="edit">✎ Bearbeiten</button>' : '<button type="button" class="btn ghost" data-rc="hide" title="Nicht mehr vorschlagen">🙅 Nicht vorschlagen</button>'}
      </div>`,
    onOpen: (form) => {
      form.querySelector('[data-rc=shop]').onclick = () => shopDialog(r);
      form.querySelector('[data-rc=plan]').onclick = async (e) => { burst(...centerOf(e.target), ['🍽️', '😋', '✨']); await setSetting('meal_today', { date: todayStr(), recipe_id: r.id }); toast(`Heute gibt’s ${r.title} 😋`); dlg.close(); };
      form.querySelector('[data-rc=fav]').onclick = async (e) => {
        const f = prefs().favorites; const now = !f.includes(r.id);
        await savePrefs({ favorites: now ? [...f, r.id] : f.filter((x) => x !== r.id) });
        e.target.textContent = now ? '⭐ Favorit' : '☆ Favorit';
      };
      const ed = form.querySelector('[data-rc=edit]'); if (ed) ed.onclick = () => editRecipe(r.id);
      const hd = form.querySelector('[data-rc=hide]'); if (hd) hd.onclick = async () => { await savePrefs({ hidden: [...prefs().hidden, r.id] }); toast('Wird nicht mehr vorgeschlagen'); dlg.close(); };
    },
  });
}

function shopDialog(r) {
  const m = matchInfo(r);
  const missing = new Set(m.missing.map((i) => i.name));
  const ings = (r.ingredients || []).filter((i) => !isBasic(i.name));
  openModal({
    title: '🛒 Auf die Einkaufsliste', submitLabel: 'Hinzufügen',
    body: `<p>Was soll für <b>${esc(r.title)}</b> auf die Liste?</p>
      <div class="ing-pick">${ings.map((i, k) => `<label class="mini-check"><input type="checkbox" name="i${k}" ${missing.has(i.name) || !pantry().length ? 'checked' : ''}><span>${esc(i.name)} <small class="muted">${esc(i.amount || '')}</small></span></label>`).join('')}</div>`,
    onSubmit: async (d) => {
      const pick = ings.filter((_, k) => d['i' + k]);
      let n = 0;
      for (const i of pick) n += await addShopping(i.name, i.amount || '', '', '', `für ${r.title}`);
      toast(n ? `${n} Zutaten auf der Einkaufsliste 🛒` : 'Stand schon alles drauf');
    },
  });
}

// ---------- Eigene Rezepte ----------
const UNITS = 'g|kg|ml|l|EL|TL|Stück|Stk\\.?|Zehen?|Dosen?|Bund|Prisen?|Packungen?|Pck\\.?|Becher|Gläser|Glas|Scheiben?|Handvoll|Tassen?|Becher';
const AMOUNT_RE = new RegExp(`^((?:[\\d.,/½¼¾⅓]+\\s*(?:${UNITS})?\\.?)|(?:${UNITS}))\\s+(.+)$`, 'i');
function parseIngredients(text) {
  return String(text || '').split('\n').map((l) => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean).map((l) => {
    const m = l.match(AMOUNT_RE);
    return m ? { name: m[2].trim(), amount: m[1].trim() } : { name: l, amount: '' };
  });
}
function recipeForm(r = {}) {
  return `
    <label class="field"><span>Name</span><input name="title" required autofocus value="${esc(r.title || '')}" placeholder="z. B. Omas Gulasch" maxlength="120"></label>
    <div class="row2">
      <label class="field"><span>Emoji</span><input name="emoji" value="${esc(r.emoji || '🍽️')}" maxlength="4"></label>
      <label class="field"><span>Dauer (Minuten)</span><input type="number" name="minutes" min="1" max="600" value="${esc(r.minutes ?? '')}"></label>
    </div>
    <div class="field"><span>Eigenschaften</span><div class="chips">${Object.entries(TAGS).map(([k, l]) => `<label class="chip-check"><input type="checkbox" name="tag_${k}" ${(r.tags || []).includes(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <label class="field"><span>Zutaten <small>(eine pro Zeile, z. B. „200 g Nudeln“)</small></span><textarea name="ingredients" rows="6" placeholder="200 g Nudeln&#10;1 Zwiebel&#10;2 EL Olivenöl">${esc((r.ingredients || []).map((i) => `${i.amount ? i.amount + ' ' : ''}${i.name}`).join('\n'))}</textarea></label>
    <label class="field"><span>Zubereitung <small>(ein Schritt pro Zeile)</small></span><textarea name="steps" rows="5">${esc(r.steps || '')}</textarea></label>
    <div class="row2">
      <label class="field"><span>Link zum Originalrezept</span><input name="url" value="${esc(r.url || '')}" placeholder="https://…"></label>
      <label class="field"><span>Bild (Link)</span><input name="image_url" value="${esc(r.image_url || '')}" placeholder="https://…jpg"></label>
    </div>`;
}
const fromForm = (d) => ({
  title: d.title, emoji: d.emoji || '🍽️', minutes: d.minutes ? Number(d.minutes) : null, servings: 2,
  tags: Object.keys(TAGS).filter((k) => d['tag_' + k]), ingredients: parseIngredients(d.ingredients), steps: d.steps || null,
  url: d.url ? safeUrl(d.url) : null, image_url: d.image_url ? safeUrl(d.image_url) : null,
});
function editRecipe(id) {
  const r = S.recipes.find((x) => x.id === id); if (!r) return;
  openModal({ title: 'Rezept bearbeiten', body: recipeForm(r), wide: true, onSubmit: (d) => patch('recipes', id, fromForm(d)), onDelete: () => del('recipes', id) });
}

const updPantry = (fn) => setSetting('pantry', { items: fn(pantry()) });

export const actions = {
  'rc-tab': (el) => { V.tab = el.dataset.v; },
  'rc-tag': (el) => { V.tag = el.dataset.v; },
  'rc-search': (el) => { V.q = el.value; },
  'rc-shuffle': () => { V.shuffle++; },
  'rc-open': (el) => openRecipe(el.dataset.id),
  'rc-unplan': () => setSetting('meal_today', {}),
  'rc-new': () => openModal({ title: 'Eigenes Rezept', body: recipeForm(), wide: true, submitLabel: 'Speichern',
    onSubmit: async (d) => { await add('recipes', fromForm(d)); toast('Rezept gespeichert 📒'); } }),
  'rc-pref-veg': (el) => savePrefs({ veg: el.checked }),
  'rc-pref-max': (el) => savePrefs({ max: Number(el.value) }),
  'rc-pref-count': (el) => savePrefs({ count: Number(el.value) }),
  'rc-pantry-add': (f) => {
    const i = f.querySelector('[name=item]'); const vals = i.value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean); i.value = '';
    if (vals.length) return updPantry((l) => [...l, ...vals.filter((v) => !l.some((x) => x.toLowerCase() === v.toLowerCase()))]);
  },
  'rc-pantry-quick': (el) => updPantry((l) => [...l, el.dataset.v]),
  'rc-pantry-del': (el) => updPantry((l) => l.filter((x) => x !== el.dataset.v)),
  'rc-pantry-clear': () => { if (confirm('Vorrat komplett leeren?')) return updPantry(() => []); },
};
