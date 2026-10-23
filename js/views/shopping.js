import { S, add, patch, del, delMany, nameOf, avatar } from '../state.js';
import { esc, store } from '../util.js';
import { openModal, toast } from '../ui.js';

export const CATS = [
  ['Obst & Gemüse', '🥦', ['apfel', 'äpfel', 'banane', 'tomate', 'gurke', 'salat', 'zwiebel', 'kartoffel', 'möhre', 'karotte', 'paprika', 'zitrone', 'beere', 'obst', 'gemüse', 'avocado', 'knoblauch', 'pilz', 'champignon', 'brokkoli', 'zucchini', 'orange', 'traube', 'birne', 'kräuter', 'petersilie', 'basilikum', 'spinat', 'lauch', 'ingwer', 'limette', 'mango', 'melone', 'kiwi', 'aubergine', 'kohl', 'rucola', 'mais', 'radieschen', 'ananas', 'süßkartoffel']],
  ['Brot & Backwaren', '🥐', ['brot', 'brötchen', 'toast', 'croissant', 'baguette', 'semmel', 'kuchen', 'brezel', 'wrap', 'tortilla', 'laugen']],
  ['Kühlregal', '🧀', ['milch', 'käse', 'joghurt', 'butter', 'sahne', 'quark', 'ei', 'eier', 'frischkäse', 'mozzarella', 'skyr', 'schmand', 'feta', 'parmesan', 'tofu', 'hafermilch', 'margarine', 'hummus', 'gnocchi', 'halloumi']],
  ['Fleisch & Fisch', '🥩', ['hähnchen', 'huhn', 'hack', 'fleisch', 'wurst', 'schinken', 'salami', 'lachs', 'fisch', 'thunfisch', 'steak', 'speck', 'garnele', 'pute', 'würstchen', 'bacon']],
  ['Vorrat', '🥫', ['nudel', 'pasta', 'reis', 'mehl', 'zucker', 'salz', 'pfeffer', 'öl', 'essig', 'dose', 'tomatenmark', 'passata', 'linsen', 'bohnen', 'müsli', 'haferflocken', 'honig', 'marmelade', 'senf', 'ketchup', 'mayo', 'gewürz', 'brühe', 'kaffee', 'tee', 'spaghetti', 'kichererbsen', 'sojasoße', 'backpulver', 'hefe', 'nutella', 'erdnussbutter', 'cornflakes']],
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
  const remembered = store.get('batzi-shop-memory', {})[n];
  if (remembered) return remembered;
  for (const [cat, , keys] of CATS) {
    if (keys.some((k) => (k.length <= 3 ? words.includes(k) : n.includes(k)))) return cat;
  }
  return 'Sonstiges';
}
const remember = (name, cat) => {
  const m = store.get('batzi-shop-memory', {}); m[name.toLowerCase()] = cat; store.set('batzi-shop-memory', m);
  const h = store.get('batzi-shop-history', []); const i = h.findIndex((x) => x.toLowerCase() === name.toLowerCase());
  if (i >= 0) h.splice(i, 1); h.unshift(name); store.set('batzi-shop-history', h.slice(0, 120));
};

export const openItems = () => S.shopping_items.filter((i) => !i.checked);

export function render() {
  const open = openItems();
  const done = S.shopping_items.filter((i) => i.checked);
  const hist = store.get('batzi-shop-history', []);
  const onList = new Set(open.map((i) => i.name.toLowerCase()));
  const suggestions = hist.filter((h) => !onList.has(h.toLowerCase())).slice(0, 10);
  const grouped = CATS.map(([c, e]) => [c, e, open.filter((i) => (i.category || 'Sonstiges') === c)]).filter(([, , l]) => l.length);
  const known = new Set(CATS.map(([c]) => c));
  const other = open.filter((i) => i.category && !known.has(i.category));
  if (other.length) grouped.push(['Weitere', '🛒', other]);

  return `
  <header class="page-head">
    <div><h1>Einkaufsliste</h1><p class="sub">${open.length ? `${open.length} Sachen fehlen noch` : 'Kühlschrank ist voll 🎉'}</p></div>
  </header>

  <form class="quick card shop-quick" data-submit="shop-add" autocomplete="off">
    <input id="shop-name" name="name" placeholder="Was brauchen wir? (mehrere mit Komma)" list="shop-hist" aria-label="Artikel">
    <input id="shop-qty" name="quantity" placeholder="Menge" class="qty" aria-label="Menge">
    <select name="category" aria-label="Kategorie"><option value="">✨ Automatisch</option>${CATS.map(([c, e]) => `<option value="${esc(c)}">${e} ${esc(c)}</option>`).join('')}</select>
    <button class="btn primary" type="submit">＋</button>
    <datalist id="shop-hist">${hist.map((h) => `<option value="${esc(h)}">`).join('')}</datalist>
  </form>

  ${suggestions.length ? `<div class="suggest"><span class="hint">Schnell nochmal:</span>${suggestions.map((s) => `<button class="chip" data-action="shop-suggest" data-name="${esc(s)}">＋ ${esc(s)}</button>`).join('')}</div>` : ''}

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
  `;
}

function itemRow(i) {
  return `<li class="shop-item ${i.checked ? 'checked' : ''}">
    <button class="shop-toggle" data-action="shop-toggle" data-id="${i.id}">
      <span class="box">${i.checked ? '✓' : ''}</span>
      <span class="shop-name">${esc(i.name)}</span>
      ${i.quantity ? `<span class="qty-badge">${esc(i.quantity)}</span>` : ''}
      ${i.note ? `<span class="shop-note">${esc(i.note)}</span>` : ''}
    </button>
    <button class="icon-btn sm" data-action="shop-edit" data-id="${i.id}" aria-label="Bearbeiten">✎</button>
  </li>`;
}

export async function addShopping(names, quantity = '', category = '') {
  const list = String(names).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  for (const name of list) {
    const existing = openItems().find((i) => i.name.toLowerCase() === name.toLowerCase());
    if (existing) { toast(`„${name}“ steht schon drauf`); continue; }
    const cat = category || guessCat(name);
    remember(name, cat);
    await add('shopping_items', { name, quantity: list.length === 1 ? quantity || null : null, category: cat, checked: false });
  }
}

export const actions = {
  'shop-add': async (form) => {
    const n = form.querySelector('[name=name]'), q = form.querySelector('[name=quantity]'), c = form.querySelector('[name=category]');
    const v = n.value; if (!v.trim()) return n.focus();
    const qty = q.value, cat = c.value;
    n.value = ''; q.value = '';
    await addShopping(v, qty, cat);
    document.getElementById('shop-name')?.focus();
  },
  'shop-suggest': (el) => addShopping(el.dataset.name),
  'shop-toggle': (el) => { const i = S.shopping_items.find((x) => x.id === el.dataset.id); if (i) patch('shopping_items', i.id, { checked: !i.checked }); },
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
          <label class="field"><span>Kategorie</span><select name="category">${CATS.map(([c, e]) => `<option value="${esc(c)}" ${i.category === c ? 'selected' : ''}>${e} ${esc(c)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Notiz</span><input name="note" value="${esc(i.note || '')}" placeholder="z. B. die Bio-Variante"></label>
        ${i.created_by ? `<p class="hint">Hinzugefügt von ${avatar(i.created_by, 'xs')} ${esc(nameOf(i.created_by))}</p>` : ''}`,
      onSubmit: async (d) => { remember(d.name, d.category); await patch('shopping_items', i.id, { name: d.name, quantity: d.quantity || null, category: d.category, note: d.note || null }); },
      onDelete: () => del('shopping_items', i.id),
    });
  },
};
