// Zentraler Zustand + Speichern mit sofortiger Anzeige
import { db } from './db.js';
import { esc } from './util.js';
import { toast } from './ui.js';

export const TABLES = ['profiles', 'todos', 'shopping_items', 'events', 'trackers', 'trips', 'diary_entries', 'diary_feelings', 'recipes', 'orga_items', 'photos', 'app_settings'];
export const S = { user: null };
TABLES.forEach((t) => (S[t] = []));

let rerenderFn = () => {};
export const setRerender = (fn) => (rerenderFn = fn);
export const rerender = () => rerenderFn();

export const me = () => S.user?.id;
export const myProfile = () => S.profiles.find((p) => p.id === me());
export const partner = () => S.profiles.find((p) => p.id !== me());

export const COLORS = {
  peach: 'Pfirsich', mint: 'Minze', sky: 'Himmel', lemon: 'Zitrone', lilac: 'Flieder', rose: 'Rosa',
};

export function profileOf(id) { return S.profiles.find((p) => p.id === id); }
export function nameOf(id) {
  if (id === 'both') return 'Beide';
  const p = profileOf(id);
  return p ? p.display_name : '';
}

export function avatar(id, size = '') {
  if (id === 'both') {
    const ps = S.profiles.slice(0, 2);
    return `<span class="avatars ${size}" title="Beide">${ps.map((p) => `<span class="avatar ${size} c-${esc(p.color || 'peach')}">${esc(p.emoji || '🐻')}</span>`).join('')}</span>`;
  }
  const p = profileOf(id);
  if (!p) return '';
  return `<span class="avatar ${size} c-${esc(p.color || 'peach')}" title="${esc(p.display_name)}">${esc(p.emoji || '🐻')}</span>`;
}

/** <option>s für "Wer?" */
export function whoOptions(selected, { allowNone = true } = {}) {
  const opts = [];
  if (allowNone) opts.push(['', '— niemand bestimmtes —']);
  const mine = myProfile(), p = partner();
  if (mine) opts.push([mine.id, `${mine.emoji} ${mine.display_name} (ich)`]);
  if (p) opts.push([p.id, `${p.emoji} ${p.display_name}`]);
  if (p) opts.push(['both', '💞 Beide']);
  return opts.map(([v, l]) => `<option value="${esc(v)}" ${v === (selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
}

export async function loadTable(t) { S[t] = (await db.list(t)) || []; }
export async function loadAll() { await Promise.all(TABLES.map(loadTable)); }

const fail = async (t, err) => { toast(err.message || 'Speichern fehlgeschlagen', 'error'); try { await loadTable(t); } catch {} rerender(); };

export async function add(t, row) {
  try { const r = await db.insert(t, row); S[t] = S[t].filter((x) => x.id !== r.id).concat(r); rerender(); return r; }
  catch (e) { await fail(t, e); throw e; }
}
export async function patch(t, id, p) {
  const i = S[t].findIndex((x) => x.id === id);
  if (i >= 0) S[t][i] = { ...S[t][i], ...p };
  rerender();
  try { const r = await db.update(t, id, p); const j = S[t].findIndex((x) => x.id === id); if (j >= 0) S[t][j] = r; return r; }
  catch (e) { await fail(t, e); throw e; }
}
export async function upsert(t, row, onConflict) {
  try {
    const r = await db.upsert(t, row, onConflict);
    S[t] = S[t].filter((x) => x.id !== r.id).concat(r); rerender(); return r;
  } catch (e) { await fail(t, e); throw e; }
}
export async function del(t, id) {
  S[t] = S[t].filter((x) => x.id !== id); rerender();
  try { await db.remove(t, id); } catch (e) { await fail(t, e); throw e; }
}
export async function delMany(t, ids) {
  S[t] = S[t].filter((x) => !ids.includes(x.id)); rerender();
  try { await db.removeMany(t, ids); } catch (e) { await fail(t, e); throw e; }
}

// ---------- Gemeinsame Einstellungen ----------
export const getSetting = (id, fallback = {}) => S.app_settings.find((x) => x.id === id)?.value ?? fallback;
export const setSetting = (id, value) => upsert('app_settings', { id, value, updated_at: new Date().toISOString() }, 'id');

// ---------- Foto-Links (signiert, zwischengespeichert) ----------
const urlCache = {}; const pending = new Set();
export function photoUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const c = urlCache[path];
  if (c && c.exp > Date.now()) return c.url;
  if (!pending.has(path)) {
    pending.add(path);
    queueMicrotask(async () => {
      const batch = [...pending]; pending.clear();
      if (!batch.length) return;
      let urls = {};
      try { urls = await db.photoUrls(batch); } catch (e) { console.error(e); }
      // auch Fehlschläge merken (10 Min.), damit nicht endlos neu geladen wird
      batch.forEach((p) => (urlCache[p] = urls[p] ? { url: urls[p], exp: Date.now() + 5 * 3600 * 1000 } : { url: null, exp: Date.now() + 600000 }));
      rerender();
    });
  }
  return null;
}
