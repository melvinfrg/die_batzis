import { db, isDemo } from './db.js';
import { S, loadAll, loadTable, setRerender, myProfile, partner, upsert, avatar, COLORS, TABLES } from './state.js';
import { esc, todayStr } from './util.js';
import { openModal, toast } from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as todos from './views/todos.js';
import * as shopping from './views/shopping.js';
import * as calendar from './views/calendar.js';
import * as tracker from './views/tracker.js';
import * as trips from './views/trips.js';
import * as diary from './views/diary.js';

const ROUTES = {
  dashboard: { label: 'Start', icon: '🏡', view: dashboard },
  todos: { label: 'ToDos', icon: '✅', view: todos },
  einkauf: { label: 'Einkauf', icon: '🛒', view: shopping },
  kalender: { label: 'Kalender', icon: '📅', view: calendar },
  tracker: { label: 'Tracker', icon: '⏳', view: tracker },
  reisen: { label: 'Reisen', icon: '✈️', view: trips },
  tagebuch: { label: 'Tagebuch', icon: '💌', view: diary },
};
let cur = { name: 'dashboard', param: null };
const app = document.getElementById('app');

// ---------- Start ----------
async function boot() {
  try {
    if (!isDemo && /type=recovery/.test(location.hash)) {
      // Passwort-Reset-Link: Session wird von supabase-js gesetzt
      await new Promise((r) => setTimeout(r, 400));
      const user = await db.getUser();
      if (user) return passwordReset(user);
    }
    const user = await db.getUser();
    if (!user) return renderAuth();
    await startApp(user);
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="auth"><div class="card auth-card"><h1>Ups 🙈</h1><p>${esc(e.message)}</p><button class="btn primary" onclick="location.reload()">Nochmal versuchen</button></div></div>`;
  }
}

async function startApp(user) {
  S.user = user;
  if (!isDemo && !(await db.isMember())) return renderNotMember(user.email);
  await loadAll();
  if (!myProfile()) await profileDialog(true);
  renderShell();
  setRerender(rerender);
  window.addEventListener('hashchange', route);
  route();
  let timers = {};
  db.subscribe((table) => {
    if (!TABLES.includes(table)) return;
    clearTimeout(timers[table]);
    timers[table] = setTimeout(async () => { await loadTable(table); rerender(); }, 150);
  });
  db.onSignOut(() => location.reload());
  // Neuer Tag? (App bleibt oft offen) → neu zeichnen
  let day = new Date().toDateString();
  setInterval(() => { if (new Date().toDateString() !== day) { day = new Date().toDateString(); rerender(); } }, 60000);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') { try { await loadAll(); rerender(); } catch {} }
  });
}

// ---------- Login ----------
function renderAuth(mode = 'login', msg = '') {
  app.innerHTML = `
  <div class="auth">
    <form class="card auth-card" id="auth-form" autocomplete="on">
      <img src="assets/icon.svg" alt="" width="96" height="96" class="auth-logo">
      <h1>Die Batzi's</h1>
      <p class="sub">${mode === 'login' ? 'Schön, dass du da bist! Melde dich an.' : mode === 'signup' ? 'Leg deinen Account an.' : 'Wir schicken dir einen Link zum Zurücksetzen.'}</p>
      ${msg ? `<p class="notice">${msg}</p>` : ''}
      <label class="field"><span>E-Mail</span><input type="email" name="email" required autocomplete="email" autofocus></label>
      ${mode !== 'reset' ? `<label class="field"><span>Passwort</span><input type="password" name="password" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></label>` : ''}
      <button class="btn primary block" type="submit">${mode === 'login' ? 'Anmelden' : mode === 'signup' ? 'Registrieren' : 'Link schicken'}</button>
      <div class="auth-links">
        ${mode !== 'login' ? '<button type="button" class="link" data-mode="login">Zur Anmeldung</button>' : '<button type="button" class="link" data-mode="signup">Neu hier? Registrieren</button><button type="button" class="link" data-mode="reset">Passwort vergessen?</button>'}
      </div>
    </form>
  </div>`;
  const f = document.getElementById('auth-form');
  f.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => renderAuth(b.dataset.mode)));
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      if (mode === 'login') { await db.signIn(d.email, d.password); return startApp(await db.getUser()); }
      if (mode === 'signup') {
        const r = await db.signUp(d.email, d.password);
        if (r?.session) return startApp(await db.getUser());
        return renderAuth('login', '📬 Fast geschafft! Bestätige deine E-Mail über den Link im Postfach und melde dich dann an.');
      }
      await db.resetPassword(d.email);
      renderAuth('login', '📬 Falls die E-Mail existiert, ist ein Link unterwegs.');
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  };
}

function passwordReset() {
  app.innerHTML = `<div class="auth"><form class="card auth-card" id="pw-form">
    <img src="assets/icon.svg" alt="" width="80" height="80" class="auth-logo"><h1>Neues Passwort</h1>
    <label class="field"><span>Passwort</span><input type="password" name="password" required minlength="6" autocomplete="new-password" autofocus></label>
    <button class="btn primary block">Speichern</button></form></div>`;
  document.getElementById('pw-form').onsubmit = async (e) => {
    e.preventDefault();
    try { await db.updatePassword(new FormData(e.target).get('password')); history.replaceState(null, '', location.pathname); toast('Passwort geändert ✓'); startApp(await db.getUser()); }
    catch (err) { toast(err.message, 'error'); }
  };
}

function renderNotMember(email) {
  app.innerHTML = `<div class="auth"><div class="card auth-card">
    <img src="assets/icon.svg" alt="" width="80" height="80" class="auth-logo">
    <h1>Fast drin! 🔐</h1>
    <p>Du bist als <b>${esc(email)}</b> angemeldet, aber dieser Account ist noch nicht für die Batzi's freigeschaltet.</p>
    <p class="muted">Freischalten: In Supabase → SQL Editor:<br><code>insert into members (email) values ('${esc(email)}');</code></p>
    <div class="btn-row"><button class="btn" onclick="location.reload()">Nochmal prüfen</button><button class="btn ghost" id="so">Abmelden</button></div>
  </div></div>`;
  document.getElementById('so').onclick = async () => { await db.signOut(); location.reload(); };
}

// ---------- Profil ----------
const AV_EMOJIS = ['🐻', '🐰', '🦊', '🐱', '🐼', '🐨', '🦁', '🐸', '🐧', '🦄', '🐶', '🐹', '🐯', '🐮', '🐷', '🦦'];
function profileDialog(first = false) {
  const p = myProfile() || {};
  return new Promise((resolve) => {
    openModal({
      title: first ? 'Willkommen bei den Batzi’s! 💞' : 'Dein Profil',
      noClose: first,
      body: `
        ${first ? '<p>Wie sollen wir dich nennen?</p>' : ''}
        <label class="field"><span>Name</span><input name="display_name" required autofocus maxlength="30" value="${esc(p.display_name || '')}" placeholder="z. B. Melvin"></label>
        <div class="field"><span>Dein Tier</span><div class="emoji-pick">${AV_EMOJIS.map((e, i) => `<label><input type="radio" name="emoji" value="${e}" ${(p.emoji || (partner()?.emoji === '🐻' ? '🐰' : '🐻')) === e ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div></div>
        <div class="field"><span>Deine Farbe</span><div class="swatches">${Object.entries(COLORS).map(([k, v]) => `<label class="swatch c-${k}" title="${v}"><input type="radio" name="color" value="${k}" ${(p.color || (partner()?.color === 'peach' ? 'lilac' : 'peach')) === k ? 'checked' : ''}><span></span></label>`).join('')}</div></div>
        ${!first ? `<p class="hint">Angemeldet als ${esc(S.user.email || '')}${isDemo ? ' (Demo)' : ''}</p>` : ''}`,
      submitLabel: first ? 'Los geht’s' : 'Speichern',
      extra: first ? null : { label: isDemo ? '🔄 Person wechseln' : '🚪 Abmelden', onClick: async () => { await db.signOut(); location.hash = '#/dashboard'; location.reload(); } },
      onSubmit: async (d) => {
        await upsert('profiles', { id: S.user.id, display_name: d.display_name, emoji: d.emoji || '🐻', color: d.color || 'peach' });
        renderNav(); resolve();
      },
    });
    if (!first) resolve();
  });
}

// ---------- Layout ----------
function renderShell() {
  app.innerHTML = `
  ${isDemo ? '<div class="demo-banner">🧪 Demo-Modus – Daten liegen nur in diesem Browser. <button class="link" id="demo-switch">Als andere Person ansehen</button></div>' : ''}
  <div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/dashboard"><img src="assets/icon.svg" alt="" width="44" height="44"><span>Die Batzi's</span></a>
      <nav class="nav" id="nav"></nav>
      <button class="me-btn" id="me-btn"></button>
    </aside>
    <header class="topbar">
      <a class="brand" href="#/dashboard"><img src="assets/icon.svg" alt="" width="36" height="36"><span>Die Batzi's</span></a>
      <button class="me-btn compact" id="me-btn-m"></button>
    </header>
    <main id="view" tabindex="-1"></main>
    <nav class="bottomnav" id="bottomnav"></nav>
  </div>`;
  renderNav();
  document.getElementById('me-btn').onclick = () => profileDialog();
  document.getElementById('me-btn-m').onclick = () => profileDialog();
  document.getElementById('demo-switch')?.addEventListener('click', () => { db.switchUser(); location.reload(); });
  bindDelegation(document.getElementById('view'));
}

function renderNav() {
  const links = Object.entries(ROUTES).map(([k, r]) => `<a href="#/${k}" data-route="${k}" class="${cur.name === k ? 'active' : ''}"><span class="ni">${r.icon}</span><span class="nl">${r.label}</span>${badge(k)}</a>`).join('');
  const nav = document.getElementById('nav'); if (!nav) return;
  nav.innerHTML = links;
  document.getElementById('bottomnav').innerHTML = links;
  const mp = myProfile(), p = partner();
  const meHtml = `${mp ? avatar(mp.id) : ''}<span class="me-text"><b>${esc(mp?.display_name || '')}</b>${p ? `<small>& ${esc(p.display_name)} ${esc(p.emoji || '')}</small>` : '<small>Profil</small>'}</span>`;
  document.getElementById('me-btn').innerHTML = meHtml;
  document.getElementById('me-btn-m').innerHTML = mp ? avatar(mp.id) : '👤';
}

function badge(k) {
  if (k === 'tagebuch' && !diary.myToday()) return '<i class="nav-dot" title="Heute noch nicht geschrieben"></i>';
  if (k === 'einkauf') { const n = shopping.openItems().length; return n ? `<i class="nav-count">${n}</i>` : ''; }
  if (k === 'todos') { const n = todos.openTodos().filter((t) => t.due_date && t.due_date <= todayStr()).length; return n ? `<i class="nav-count">${n}</i>` : ''; }
  return '';
}

// ---------- Routing ----------
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.includes('access_token') || h.includes('type=')) return { name: 'dashboard', param: null };
  const [name, param] = h.split('/');
  return { name: ROUTES[name] ? name : 'dashboard', param: param ? decodeURIComponent(param) : null };
}
function route() {
  const prev = cur;
  cur = parseRoute();
  renderNav();
  renderView();
  if (prev.name !== cur.name || prev.param !== cur.param) window.scrollTo(0, 0);
}
function renderView() {
  const root = document.getElementById('view'); if (!root) return;
  root.innerHTML = ROUTES[cur.name].view.render(cur.param);
  document.title = `${ROUTES[cur.name].label} · Die Batzi's`;
}

function rerender() {
  const root = document.getElementById('view'); if (!root) return;
  // Eingaben erhalten (Fokus + Text), damit Live-Updates nicht stören
  const active = document.activeElement;
  const keep = {};
  root.querySelectorAll('[data-keep][id]').forEach((el) => (keep[el.id] = el.value));
  let focus = null;
  if (active && active.id && root.contains(active)) focus = { id: active.id, value: active.value, s: active.selectionStart, e: active.selectionEnd };
  renderView();
  renderNav();
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el && el.value !== v && document.activeElement !== el) el.value = v; }
  if (focus) {
    const el = document.getElementById(focus.id);
    if (el) {
      if (focus.value != null && 'value' in el && el.type !== 'checkbox' && el.type !== 'radio') el.value = focus.value;
      el.focus({ preventScroll: true });
      try { if (focus.s != null) el.setSelectionRange(focus.s, focus.e); } catch {}
    }
  }
}

// ---------- Event-Delegation ----------
function bindDelegation(root) {
  const run = async (name, el, e) => {
    const fn = ROUTES[cur.name].view.actions?.[name];
    if (!fn) return;
    try {
      const r = fn(el, e);
      rerender();
      if (r instanceof Promise) await r;
    } catch (err) { console.error(err); }
  };
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    if (el.tagName === 'A' && el.getAttribute('href')) return;
    e.preventDefault();
    run(el.dataset.action, el, e);
  });
  root.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-submit]'); if (!f) return;
    e.preventDefault();
    run(f.dataset.submit, f, e);
  });
  root.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]'); if (!el) return;
    run(el.dataset.change, el, e);
  });
  root.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]'); if (!el) return;
    run(el.dataset.input, el, e);
  });
}

boot();
