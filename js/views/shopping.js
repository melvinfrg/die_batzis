import { S, add, patch, del, delMany, nameOf, avatar, getSetting, setSetting } from '../state.js';
import { esc, store } from '../util.js';
import { openModal, toast } from '../ui.js';

export const CATS = [
  ['Obst & Gemüse', '🥦', ['apfel', 'äpfel', 'banane', 'tomate', 'gurke', 'salat', 'zwiebel', 'kartoffel', 'möhre', 'karotte', 'paprika', 'zitrone', 'beere', 'obst', 'gemüse', 'avocado', 'knoblauch', 'pilz', 'champignon', 'brokkoli', 'zucchini', 'orange', 'traube', 'birne', 'kräuter', 'petersilie', 'basilikum', 'spinat', 'lauch', 'ingwer', 'limette', 'mango', 'melone', 'kiwi', 'aubergine', 'kohl', 'rucola', 'mais', 'radieschen', 'ananas', 'süßkartoffel']],
  ['Brot & Backwaren', '🥐', ['brot', 'brötchen', 'toast', 'croissant', 'baguette', 'semmel', 'kuchen', 'brezel', 'wrap', 'tortilla', 'laugen']],
  ['Kühlregal', '🧀', ['milch', 'käse', 'joghurt', 'butter', 'sahne', 'quark', 'ei', 'eier', 'frischkäse', 'mozzarella', 'skyr', 'schmand', 'feta', 'parmesan', 'tofu', 'hafermilch', 'margarine', 'hummus', 'gnocchi', 'halloumi']],
  ['Fleisch & Fisch', '🥩', ['hähnchen', 'huhn', 'hack', 'fleisch', 'wurst', 'schinken', 'salami', 'lachs', 'fisch', 'thunfisch', 'steak', 'speck', 'garnele', 'pute', 'würstchen', 'bacon']],
  ['Vorrat', '🥫', ['nudel', 'pasta', 'reis', 'mehl', 'zucker', 'salz', 'pfeffer', 'öl', 'essig', 'dose', 'tomatenmark', 'passata', 'linsen', 'bohnen', 'müsli', 'haferflocken', 'honig', 'marmelade', 'senf', 'ketchup', 'mayo', 'gewürz', 'kümmel', 'paprikapulver', 'currypulver', 'oregano', 'muskat', 'zimt', 'brühe', 'kaffee', 'tee', 'spaghetti', 'kichererbsen', 'sojasoße', 'backpulver', 'hefe', 'nutella', 'erdnussbutter', 'cornflakes']],
  ['Tiefkühl', '🧊', ['tk', 'pizza', 'eis', 'tiefkühl', 'pommes', 'erbsen', 'eiswürfel']],
  ['Getränke', '🥤', ['wasser', 'saft', 'cola', 'bier', 'wein', 'sprudel', 'limo', 'sekt', 'mate', 'tonic', 'gin', 'prosecco', 'schorle', 'eistee']],
  ['Süßes & Snacks', '🍫', ['schoko', 'chips', 'keks', 'gummibär', 'süß', 'snack', 'nüsse', 'popcorn', 'riegel', 'cracker', 'bonbon', 'salzstangen', 'erdnüsse']],
  ['Drogerie', '🧴', ['shampoo', 'duschgel', 'zahnpasta', 'zahnbürste', 'deo', 'creme', 'seife', 'klopapier', 'toilettenpapier', 'taschentuch', 'watte', 'rasier', 'tampon', 'binde', 'pflaster', 'sonnencreme', 'spülung', 'zahnseide', 'abschmink', 'tablette', 'ibu']],
  ['Haushalt', '🧽', ['spülmittel', 'müllbeutel', 'müllsack', 'waschmittel', 'schwamm', 'küchenrolle', 'alufolie', 'backpapier', 'reiniger', 'batterie', 'glühbirne', 'frischhaltefolie', 'spülmaschine', 'tabs', 'weichspüler', 'kerze', 'servietten']],
  ['Sonstiges', '🛒', []],
];
export const catEmoji = (c) => (CATS.find(([n]) => n === c) || CATS[CATS.length - 1])[1];

export function guessCat(name) {
  const n = name.toLowerCase();
  const words = n.split(/[^\p{L}]+/u);
  const remembered = memory()[n]?.cat || store.get('batzi-shop-memory', {})[n];
  if (remembered) return remembered;
  for (const [cat, , keys] of CATS) {
    if (keys.some((k) => (k.length <= 3 ? words.includes(k) : n.includes(k)))) return cat;
  }
  return 'Sonstiges';
}

export const STORES = ['ALDI', 'LIDL', 'PENNY', 'NETTO', 'REWE', 'EDEKA', 'Kaufland'];
export const normStore = (s) => (s ? STORES.find((x) => x.toLowerCase() === String(s).trim().toLowerCase()) || null : null);
const storeOptions = (sel, autoLabel = '🏪 Laden (auto)') => `<option value="">${autoLabel}</option>${STORES.map((x) => `<option value="${x}" ${normStore(sel) === x ? 'selected' : ''}>${x}</option>`).join('')}`;
const V = { group: store.get('batzi-shop-group', 'cat'), store: 'all' };

// Gemeinsames Gedächtnis: welche Kategorie / welcher Laden für welchen Artikel
const memory = () => getSetting('shop_memory', {}).items || {};
function remember(name, cat, shop) {
  const items = { ...memory() };
  const k = name.toLowerCase();
  const o = items[k] || { name, n: 0 };
  items[k] = { ...o, name, cat: cat || o.cat, store: shop === undefined ? o.store : shop || null, n: (o.n || 0) + 1, last: new Date().toISOString().slice(0, 10) };
  // auf 300 Einträge begrenzen
  const keep = Object.entries(items).sort((a, b) => String(b[1].last).localeCompare(String(a[1].last))).slice(0, 300);
  setSetting('shop_memory', { items: Object.fromEntries(keep) }).catch(() => {});
}
export const suggestStore = (name) => normStore(memory()[name.toLowerCase()]?.store);
export const knownStores = () => [...new Set([...S.shopping_items.map((i) => i.store), ...Object.values(memory()).map((m) => m.store), ...STORES].filter(Boolean))];

export const openItems = () => S.shopping_items.filter((i) => !i.checked);
export const offerUrl = (name) => `https://www.marktguru.de/search/${encodeURIComponent(name)}`;
export const offerUrlAlt = (name, shop) => `https://www.google.com/search?q=${encodeURIComponent(`${name} Angebot diese Woche ${shop || ''}`.trim())}`;

export function render() {
  const allOpen = openItems();
  const open = allOpen.filter((i) => V.store === 'all' || (V.store === '' ? !i.store : i.store === V.store));
  const done = S.shopping_items.filter((i) => i.checked);
  const onList = new Set(allOpen.map((i) => i.name.toLowerCase()));
  const mem = Object.values(memory());
  const hist = mem.length ? mem.sort((a, b) => (b.n || 0) - (a.n || 0) || String(b.last).localeCompare(String(a.last))).map((m) => m.name) : store.get('batzi-shop-history', []);
  const suggestions = hist.filter((h) => !onList.has(h.toLowerCase())).slice(0, 12);
  const used = new Set(allOpen.map((i) => i.store).filter(Boolean));
  const stores = [...STORES.filter((x) => used.has(x)), ...[...used].filter((x) => !STORES.includes(x))];
  const noStore = allOpen.some((i) => !i.store);

  let grouped;
  if (V.group === 'store') {
    grouped = [...stores.map((st) => [st, '🏪', open.filter((i) => i.store === st)]), ['Ohne Laden', '🛒', open.filter((i) => !i.store)]].filter(([, , l]) => l.length);
  } else {
    grouped = CATS.map(([c, e]) => [c, e, open.filter((i) => (i.category || 'Sonstiges') === c)]).filter(([, , l]) => l.length);
    const known = new Set(CATS.map(([c]) => c));
    const other = open.filter((i) => i.category && !known.has(i.category));
    if (other.length) grouped.push(['Weitere', '🛒', other]);
  }
  const chip = (v, l, n) => `<button class="chip ${V.store === v ? 'on' : ''}" data-action="shop-store-filter" data-v="${esc(v)}">${l}${n != null ? ` <span class="count">${n}</span>` : ''}</button>`;

  return `
  <header class="page-head">
    <div><h1>Einkaufsliste</h1><p class="sub">${allOpen.length ? `${allOpen.length} Sachen fehlen noch` : 'Kühlschrank ist voll 🎉'}</p></div>
    <div class="seg" role="group" aria-label="Sortierung">
      <button class="${V.group === 'cat' ? 'on' : ''}" data-action="shop-group" data-v="cat">🥦 Kategorie</button>
      <button class="${V.group === 'store' ? 'on' : ''}" data-action="shop-group" data-v="store">🏪 Laden</button>
    </div>
  </header>

  <form class="quick card shop-quick" data-submit="shop-add" autocomplete="off">
    <input id="shop-name" name="name" placeholder="Was brauchen wir? (mehrere mit Komma)" list="shop-hist" aria-label="Artikel">
    <input id="shop-qty" name="quantity" placeholder="Menge" class="qty" aria-label="Menge">
    <select id="shop-store" name="store" class="store-in" aria-label="Laden">${storeOptions('')}</select>
    <select name="category" aria-label="Kategorie"><option value="">✨ Automatisch</option>${CATS.map(([c, e]) => `<option value="${esc(c)}">${e} ${esc(c)}</option>`).join('')}</select>
    <button class="btn primary" type="submit">＋</button>
    <datalist id="shop-hist">${hist.slice(0, 200).map((h) => `<option value="${esc(h)}">`).join('')}</datalist>
  </form>
  <p class="hint">„Laden (auto)“ = der Laden, in dem ihr den Artikel zuletzt gekauft habt.</p>

  ${suggestions.length ? `<div class="suggest"><span class="hint">Schnell nochmal:</span>${suggestions.map((s) => `<button class="chip" data-action="shop-suggest" data-name="${esc(s)}">＋ ${esc(s)}</button>`).join('')}</div>` : ''}

  ${stores.length ? `<div class="chips store-chips">${chip('all', 'Alle Läden', allOpen.length)}${stores.map((st) => chip(st, '🏪 ' + esc(st), allOpen.filter((i) => i.store === st).length)).join('')}${noStore ? chip('', 'Ohne Laden', allOpen.filter((i) => !i.store).length) : ''}</div>` : ''}

  <div class="shop-grid">
    ${grouped.length ? grouped.map(([c, e, items]) => `
      <section class="card shop-cat">
        <h3><span class="cat-emoji">${e}</span>${esc(c)} <span class="count">${items.length}</span></h3>
        <ul class="shop-list">${items.map(itemRow).join('')}</ul>
      </section>`).join('') : '<div class="empty card"><div class="empty-emoji">🧺</div><p>Die Liste ist leer.</p></div>'}
  </div>

  ${done.length ? `
  <section class="card shop-done">
    <div class="row-between"><h3>🛒 Im Wagen <span class="count">${done.length}</span></h3>
      <div class="btn-row"><button class="btn ghost sm" data-action="shop-uncheck-all">Alle zurück</button><button class="btn ghost danger sm" data-action="shop-clear">Entfernen</button></div></div>
    <ul class="shop-list">${done.map(itemRow).join('')}</ul>
  </section>` : ''}

  ${allOpen.length ? `<section class="card offers-card">
    <h3>🏷️ Angebote checken</h3>
    <p class="muted small">Tippe auf einen Artikel, um die aktuellen Prospekt-Angebote (marktguru) in eurer Nähe zu sehen.</p>
    <div class="shop-chips">${allOpen.slice(0, 30).map((i) => `<a class="chip" href="${esc(offerUrl(i.name))}" target="_blank" rel="noopener noreferrer">🏷️ ${esc(i.name)}</a>`).join('')}</div>
  </section>` : ''}
  `;
}

function itemRow(i) {
  return `<li class="shop-item ${i.checked ? 'checked' : ''}">
    <button class="shop-toggle" data-action="shop-toggle" data-id="${i.id}">
      <span class="box">${i.checked ? '✓' : ''}</span>
      <span class="shop-name">${esc(i.name)}</span>
      ${i.quantity ? `<span class="qty-badge">${esc(i.quantity)}</span>` : ''}
      ${i.store && V.group !== 'store' ? `<span class="store-badge">🏪 ${esc(i.store)}</span>` : ''}
      ${i.note ? `<span class="shop-note">${esc(i.note)}</span>` : ''}
    </button>
    <a class="icon-btn sm" href="${esc(offerUrl(i.name))}" target="_blank" rel="noopener noreferrer" title="Angebote suchen" aria-label="Angebote für ${esc(i.name)}">🏷️</a>
    <button class="icon-btn sm" data-action="shop-edit" data-id="${i.id}" aria-label="Bearbeiten">✎</button>
  </li>`;
}

export async function addShopping(names, quantity = '', category = '', shop = '', note = null) {
  const list = String(names).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  let added = 0;
  for (const name of list) {
    const existing = openItems().find((i) => i.name.toLowerCase() === name.toLowerCase());
    if (existing) { if (list.length < 4) toast(`„${name}“ steht schon drauf`); continue; }
    const cat = category || guessCat(name);
    const st = normStore(shop) || suggestStore(name);
    remember(name, cat, shop || undefined);
    await add('shopping_items', { name, quantity: list.length === 1 ? quantity || null : null, category: cat, store: st || null, note, checked: false });
    added++;
  }
  return added;
}

export const actions = {
  'shop-add': async (form) => {
    const n = form.querySelector('[name=name]'), q = form.querySelector('[name=quantity]'), c = form.querySelector('[name=category]'), st = form.querySelector('[name=store]');
    const v = n.value; if (!v.trim()) return n.focus();
    const qty = q.value, cat = c.value, shop = st ? st.value : '';
    n.value = ''; q.value = '';
    await addShopping(v, qty, cat, shop);
    document.getElementById('shop-name')?.focus();
  },
  'shop-group': (el) => { V.group = el.dataset.v; store.set('batzi-shop-group', V.group); },
  'shop-store-filter': (el) => { V.store = el.dataset.v; },
  'shop-suggest': (el) => addShopping(el.dataset.name),
  'shop-toggle': (el) => {
    const i = S.shopping_items.find((x) => x.id === el.dataset.id); if (!i) return;
    if (!i.checked && i.store) remember(i.name, i.category, i.store);
    patch('shopping_items', i.id, { checked: !i.checked });
  },
  'shop-clear': () => delMany('shopping_items', S.shopping_items.filter((i) => i.checked).map((i) => i.id)),
  'shop-uncheck-all': () => S.shopping_items.filter((i) => i.checked).forEach((i) => patch('shopping_items', i.id, { checked: false })),
  'shop-edit': (el) => {
    const i = S.shopping_items.find((x) => x.id === el.dataset.id); if (!i) return;
    openModal({
      title: 'Artikel bearbeiten',
      body: `
        <label class="field"><span>Artikel</span><input name="name" required value="${esc(i.name)}" autofocus></label>
        <div class="row2">
          <label class="field"><span>Menge</span><input name="quantity" value="${esc(i.quantity || '')}" placeholder="z. B. 2, 500 g"></label>
          <label class="field"><span>Laden</span><select name="store">${storeOptions(i.store, '— kein bestimmter —')}</select></label>
        </div>
        <label class="field"><span>Kategorie</span><select name="category">${CATS.map(([c, e]) => `<option value="${esc(c)}" ${i.category === c ? 'selected' : ''}>${e} ${esc(c)}</option>`).join('')}</select></label>
        <label class="field"><span>Notiz</span><input name="note" value="${esc(i.note || '')}" placeholder="z. B. die Bio-Variante"></label>
        <div class="btn-row"><a class="btn ghost sm" href="${esc(offerUrl(i.name))}" target="_blank" rel="noopener noreferrer">🏷️ Angebote bei marktguru</a><a class="btn ghost sm" href="${esc(offerUrlAlt(i.name, i.store))}" target="_blank" rel="noopener noreferrer">🔎 Im Web suchen</a></div>
        ${i.created_by ? `<p class="hint">Hinzugefügt von ${avatar(i.created_by, 'xs')} ${esc(nameOf(i.created_by))}</p>` : ''}`,
      onSubmit: async (d) => { remember(d.name, d.category, d.store); await patch('shopping_items', i.id, { name: d.name, quantity: d.quantity || null, category: d.category, store: d.store || null, note: d.note || null }); },
      onDelete: () => del('shopping_items', i.id),
    });
  },
};
