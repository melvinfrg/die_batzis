// Datenschicht: Supabase (echt) oder Demo (localStorage)
import { CONFIG } from './config.js';
import { uid, store, todayStr, addDays } from './util.js';

export const isDemo = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;

let db;

if (!isDemo) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  const ok = ({ data, error }) => { if (error) throw new Error(translate(error.message)); return data; };
  db = {
    async getUser() { const { data } = await sb.auth.getSession(); return data.session?.user ?? null; },
    onSignOut(cb) { sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') cb(); }); },
    async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
    async signUp(email, password) {
      return ok(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }));
    },
    async resetPassword(email) { ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); },
    async updatePassword(password) { ok(await sb.auth.updateUser({ password })); },
    async signOut() { await sb.auth.signOut(); },
    async isMember() { return !!ok(await sb.rpc('is_member')); },
    async list(t) { return ok(await sb.from(t).select('*')); },
    async insert(t, row) { return ok(await sb.from(t).insert(row).select().single()); },
    async update(t, id, patch) { return ok(await sb.from(t).update(patch).eq('id', id).select().single()); },
    async upsert(t, row, onConflict = 'id') { return ok(await sb.from(t).upsert(row, { onConflict }).select().single()); },
    async remove(t, id) { ok(await sb.from(t).delete().eq('id', id)); },
    async removeMany(t, ids) { if (ids.length) ok(await sb.from(t).delete().in('id', ids)); },
    async uploadPhoto(blob, userId) {
      const path = `${userId}/${uid()}.jpg`;
      ok(await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
      return path;
    },
    async photoUrls(paths) {
      if (!paths.length) return {};
      const data = ok(await sb.storage.from('photos').createSignedUrls(paths, 60 * 60 * 6));
      const out = {}; (data || []).forEach((d) => { if (d.signedUrl) out[d.path] = d.signedUrl; });
      return out;
    },
    async deletePhoto(path) { ok(await sb.storage.from('photos').remove([path])); },
    subscribe(cb) {
      sb.channel('batzi-live')
        .on('postgres_changes', { event: '*', schema: 'public' }, (p) => cb(p.table))
        .subscribe();
    },
  };
} else {
  // ---------- Demo-Modus ----------
  const USERS = [
    { id: 'demo-a', email: 'du@demo.batzi' },
    { id: 'demo-b', email: 'schatz@demo.batzi' },
  ];
  const K = (t) => 'batzi-demo-' + t;
  const read = (t) => store.get(K(t), []);
  const write = (t, rows) => store.set(K(t), rows);
  const current = () => USERS.find((u) => u.id === store.get('batzi-demo-user', 'demo-a')) || USERS[0];
  const now = () => new Date().toISOString();

  if (!store.get('batzi-demo-seeded')) seed();

  db = {
    demoUsers: USERS,
    async getUser() { return current(); },
    onSignOut() {},
    async signIn() {}, async signUp() {}, async resetPassword() {}, async updatePassword() {},
    async signOut() { store.set('batzi-demo-user', current().id === 'demo-a' ? 'demo-b' : 'demo-a'); },
    switchUser() { store.set('batzi-demo-user', current().id === 'demo-a' ? 'demo-b' : 'demo-a'); },
    async isMember() { return true; },
    async list(t) {
      const rows = read(t);
      return t === 'diary_feelings' ? rows.filter((r) => r.author_id === current().id || !r.is_private) : rows;
    },
    async insert(t, row) {
      const rows = read(t);
      const r = { id: uid(), created_at: now(), ...(t === 'diary_entries' ? { author_id: current().id } : { created_by: current().id }), ...row };
      rows.push(r); write(t, rows); return r;
    },
    async update(t, id, patch) {
      const rows = read(t); const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw new Error('Nicht gefunden');
      rows[i] = { ...rows[i], ...patch }; write(t, rows); return rows[i];
    },
    async upsert(t, row, onConflict = 'id') {
      const keys = onConflict.split(',');
      const rows = read(t);
      const full = t === 'diary_entries' ? { author_id: current().id, ...row } : row;
      const i = rows.findIndex((r) => keys.every((k) => r[k] === full[k]));
      if (i >= 0) { rows[i] = { ...rows[i], ...full, updated_at: now() }; write(t, rows); return rows[i]; }
      const r = { id: uid(), created_at: now(), ...full }; rows.push(r); write(t, rows); return r;
    },
    async remove(t, id) { write(t, read(t).filter((r) => r.id !== id)); },
    async uploadPhoto(blob) {
      const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      const path = 'demo/' + uid(); store.set('batzi-demo-photo-' + path, url); return path;
    },
    async photoUrls(paths) { const o = {}; paths.forEach((p) => (o[p] = p.startsWith('http') ? p : store.get('batzi-demo-photo-' + p))); return o; },
    async deletePhoto(path) { try { localStorage.removeItem('batzi-demo-photo-' + path); } catch {} },
    async removeMany(t, ids) { write(t, read(t).filter((r) => !ids.includes(r.id))); },
    subscribe(cb) {
      window.addEventListener('storage', (e) => { if (e.key?.startsWith('batzi-demo-')) cb(e.key.replace('batzi-demo-', '')); });
    },
  };

  function seed() {
    const T = todayStr();
    const A = 'demo-a', B = 'demo-b';
    write('profiles', [
      { id: A, display_name: 'Du', emoji: '🐻', color: 'peach' },
      { id: B, display_name: 'Schatz', emoji: '🐰', color: 'lilac' },
    ]);
    write('todos', [
      { id: uid(), title: 'Wohnung saugen', due_date: T, priority: 2, assignee: A, category: 'Haushalt', done: false, subtasks: [{ id: uid(), text: 'Wohnzimmer', done: true }, { id: uid(), text: 'Schlafzimmer', done: false }], recurrence: 'weekly', created_at: new Date().toISOString() },
      { id: uid(), title: 'Geschenk für Mamas Geburtstag', due_date: addDays(T, 5), priority: 3, assignee: 'both', category: 'Familie', done: false, subtasks: [], recurrence: 'none', created_at: new Date().toISOString() },
      { id: uid(), title: 'Steuererklärung', due_date: addDays(T, -2), priority: 3, assignee: B, category: 'Papierkram', done: false, subtasks: [], recurrence: 'none', created_at: new Date().toISOString() },
      { id: uid(), title: 'Pflanzen gießen', due_date: addDays(T, 1), priority: 1, assignee: 'both', category: 'Haushalt', done: false, subtasks: [], recurrence: 'none', created_at: new Date().toISOString() },
      { id: uid(), title: 'Fahrradschloss kaufen', priority: 1, assignee: A, done: true, done_at: new Date().toISOString(), subtasks: [], recurrence: 'none', created_at: new Date().toISOString() },
    ]);
    write('shopping_items', [
      { id: uid(), name: 'Bananen', quantity: '6', category: 'Obst & Gemüse', checked: false },
      { id: uid(), name: 'Hafermilch', quantity: '2', category: 'Kühlregal', checked: false },
      { id: uid(), name: 'Brötchen', quantity: '4', category: 'Brot & Backwaren', checked: false },
      { id: uid(), name: 'Spülmittel', category: 'Haushalt', checked: false },
      { id: uid(), name: 'Schokolade', category: 'Süßes & Snacks', checked: true },
    ]);
    write('events', [
      { id: uid(), title: 'Kino-Abend', event_date: addDays(T, 2), start_time: '20:00', all_day: false, location: 'Cinemaxx', who: 'both', color: 'lilac', recurrence: 'none' },
      { id: uid(), title: 'Zahnarzt', event_date: addDays(T, 4), start_time: '09:30', all_day: false, who: A, color: 'sky', recurrence: 'none' },
      { id: uid(), title: 'Mamas Geburtstag', event_date: addDays(T, 6), all_day: true, who: 'both', color: 'rose', recurrence: 'yearly' },
      { id: uid(), title: 'Yoga', event_date: addDays(T, 1), start_time: '18:30', all_day: false, who: B, color: 'mint', recurrence: 'weekly' },
    ]);
    write('trackers', [
      { id: uid(), title: 'Zusammen', emoji: '💞', start_date: addDays(T, -812), description: 'Seit unserem ersten Date', pinned: true, history: [] },
      { id: uid(), title: 'Rauchfrei', emoji: '🚭', start_date: addDays(T, -47), description: '', pinned: true, history: [{ start: addDays(T, -120), end: addDays(T, -47), days: 73 }] },
      { id: uid(), title: 'Neue Wohnung', emoji: '🏡', start_date: addDays(T, -230), description: 'Einzug', pinned: false, history: [] },
    ]);
    write('trips', [
      { id: uid(), title: 'Lissabon', destination: 'Lissabon', country: 'Portugal', emoji: '🇵🇹', start_date: addDays(T, 23), end_date: addDays(T, 29), budget: 1400, notes: 'Pastéis de Nata in Belém probieren!', links: [{ id: uid(), kind: 'flight', label: 'Flug TAP', url: 'https://www.flytap.com' }, { id: uid(), kind: 'stay', label: 'Apartment Alfama', url: 'https://www.airbnb.de' }], packing: [{ id: uid(), text: 'Reisepass', done: false, who: 'both' }, { id: uid(), text: 'Sonnencreme', done: true, who: A }], expenses: [{ id: uid(), label: 'Flüge', amount: 380, paid_by: A }, { id: uid(), label: 'Apartment', amount: 540, paid_by: B }], plan: [{ id: uid(), date: addDays(T, 24), time: '10:00', text: 'Tram 28 fahren' }] },
      { id: uid(), title: 'Ostsee-Wochenende', destination: 'Warnemünde', country: 'Deutschland', emoji: '🌊', start_date: addDays(T, -95), end_date: addDays(T, -92), rating: 5, notes: 'Bester Fischbrötchenstand am Alten Strom.', links: [], packing: [], expenses: [{ id: uid(), label: 'Hotel', amount: 260, paid_by: B }], plan: [] },
      { id: uid(), title: 'Japan', destination: 'Tokio & Kyoto', country: 'Japan', emoji: '🗾', links: [], packing: [], expenses: [], plan: [], notes: 'Irgendwann zur Kirschblüte 🌸' },
    ]);
    write('diary_entries', [
      { id: uid(), author_id: B, entry_date: T, message: 'Guten Morgen mein Lieblingsmensch! Ich freu mich heute Abend auf dich ☀️', mood: '🥰' },
      { id: uid(), author_id: A, entry_date: addDays(T, -1), message: 'Danke fürs Kochen gestern, war mega lecker!', mood: '😊' },
      { id: uid(), author_id: B, entry_date: addDays(T, -1), message: 'Heute war anstrengend, aber du hast mich zum Lachen gebracht 💛', mood: '😴' },
    ]);
    write('photos', [
      { id: uid(), path: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200', caption: 'Roadtrip 2025', on_dashboard: true },
      { id: uid(), path: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200', caption: 'Ostsee', on_dashboard: true },
      { id: uid(), path: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200', caption: 'Berge', on_dashboard: true },
    ]);
    write('orga_items', [
      { id: uid(), category: 'Versicherungen', title: 'Haftpflicht', provider: 'HUK', amount: 6.5, interval: 'monthly', payer: 'both', active: true },
      { id: uid(), category: 'Strom & Energie', title: 'Strom', provider: 'Stadtwerke', amount: 89, interval: 'monthly', payer: 'both', cancel_by: addDays(T, 20), active: true },
      { id: uid(), category: 'Abos & Streaming', title: 'Netflix', provider: 'Netflix', amount: 13.99, interval: 'monthly', payer: A, active: true },
      { id: uid(), category: 'Wohnen', title: 'Miete', provider: 'Vermieter', amount: 980, interval: 'monthly', payer: 'both', active: true },
      { id: uid(), category: 'Mobilität', title: 'Kfz-Versicherung', provider: 'Allianz', amount: 420, interval: 'yearly', payer: B, active: true },
    ]);
    write('diary_feelings', [
      { id: uid(), author_id: B, entry_date: T, score: 4, note: 'Gut geschlafen!', is_private: false },
      { id: uid(), author_id: A, entry_date: addDays(T, -1), score: 3, note: '', is_private: true },
      { id: uid(), author_id: B, entry_date: addDays(T, -1), score: 2, note: 'Stressiger Tag', is_private: false },
      { id: uid(), author_id: A, entry_date: addDays(T, -2), score: 5, note: '', is_private: false },
    ]);
    write('app_settings', [{ id: 'pantry', value: { items: ['Nudeln', 'Eier', 'Zwiebeln', 'Tomaten (Dose)', 'Reis', 'Knoblauch'] } }]);
    store.set('batzi-demo-seeded', true);
  }
}

function translate(msg) {
  const m = String(msg);
  if (/Invalid login credentials/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
  if (/Email not confirmed/i.test(m)) return 'Bitte bestätige zuerst deine E-Mail (Link im Postfach).';
  if (/User already registered/i.test(m)) return 'Diese E-Mail ist schon registriert – melde dich einfach an.';
  if (/Password should be at least/i.test(m)) return 'Das Passwort muss mindestens 6 Zeichen lang sein.';
  if (/row-level security/i.test(m)) return 'Keine Berechtigung – ist dein Account freigeschaltet?';
  if (/Failed to fetch/i.test(m)) return 'Keine Verbindung zum Server.';
  return m;
}

export { db };
