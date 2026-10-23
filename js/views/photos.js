// Fotos fürs Dashboard: Collage, Verwalten, Großansicht
import { db } from '../db.js';
import { S, add, patch, del, me, photoUrl, rerender } from '../state.js';
import { esc } from '../util.js';
import { openModal, toast, closeModal } from '../ui.js';

const sorted = () => S.photos.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
export const dashboardPhotos = () => sorted().filter((p) => p.on_dashboard);

const img = (p, cls = '') => {
  const u = photoUrl(p.path);
  return u ? `<img class="${cls}" src="${esc(u)}" alt="${esc(p.caption || 'Foto')}" loading="lazy">` : `<span class="ph-loading ${cls}">📷</span>`;
};

export function photoCard() {
  const list = dashboardPhotos().slice(0, 5);
  if (!list.length) {
    return `<section class="card dash-photos empty-photos">
      <div class="card-head"><h2>📸 Unsere Momente</h2></div>
      <button class="photo-drop" data-action="photo-manage"><span>＋</span>Lieblingsfotos hinzufügen</button>
    </section>`;
  }
  return `<section class="card dash-photos">
    <div class="card-head"><h2>📸 Unsere Momente</h2><button class="more link-btn" data-action="photo-manage">Fotos bearbeiten ›</button></div>
    <div class="collage n${list.length}">
      ${list.map((p, i) => `<button class="tile t${i}" data-action="photo-view" data-id="${p.id}">${img(p)}${p.caption ? `<span class="cap">${esc(p.caption)}</span>` : ''}</button>`).join('')}
    </div>
  </section>`;
}

async function resize(file, max = 1600) {
  const bmp = await (window.createImageBitmap ? createImageBitmap(file).catch(() => null) : null);
  let src = bmp;
  if (!src) {
    src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const w = src.width, h = src.height, k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
}

function managerBody() {
  const all = sorted();
  return `
    <label class="photo-drop big"><input type="file" accept="image/*" multiple id="photo-input" hidden><span>＋</span>Fotos auswählen<small>Vom Handy oder Computer · werden automatisch verkleinert</small></label>
    <p class="hint">⭐ = auf dem Dashboard zeigen (die neuesten 5 erscheinen). Tippe auf die Bildunterschrift, um sie zu ändern.</p>
    <div class="photo-manage">${all.map((p) => `
      <figure class="pm-item ${p.on_dashboard ? 'on' : ''}">
        <div class="pm-img">${img(p)}</div>
        <figcaption>
          <input value="${esc(p.caption || '')}" placeholder="Bildunterschrift" data-pcap="${p.id}" maxlength="80">
          <div class="pm-actions">
            <button type="button" class="icon-btn sm ${p.on_dashboard ? 'on' : ''}" data-ppin="${p.id}" title="Aufs Dashboard">⭐</button>
            <button type="button" class="icon-btn sm" data-pdel="${p.id}" title="Löschen">🗑️</button>
          </div>
        </figcaption>
      </figure>`).join('') || '<p class="muted">Noch keine Fotos.</p>'}</div>`;
}

export function manage() {
  const dlg = openModal({ title: '📸 Unsere Fotos', body: managerBody(), wide: true, hideCancel: true, onOpen: bind });
  function refresh() { const b = dlg.querySelector('.modal-body'); if (b) { b.innerHTML = managerBody(); bind(dlg.querySelector('form')); } }
  function bind(form) {
    form.querySelector('#photo-input').onchange = async (e) => {
      const files = [...e.target.files]; if (!files.length) return;
      const drop = form.querySelector('.photo-drop'); drop.classList.add('busy'); drop.lastElementChild.textContent = `Lade ${files.length} Foto(s) hoch …`;
      for (const f of files) {
        try {
          const blob = await resize(f);
          const path = await db.uploadPhoto(blob, me());
          await add('photos', { path, caption: null, on_dashboard: true });
        } catch (err) { console.error(err); toast('Ein Foto konnte nicht hochgeladen werden', 'error'); }
      }
      toast('Fotos hochgeladen 📸'); refresh();
    };
    form.querySelectorAll('[data-pcap]').forEach((i) => (i.onchange = () => patch('photos', i.dataset.pcap, { caption: i.value.trim() || null })));
    form.querySelectorAll('[data-ppin]').forEach((b) => (b.onclick = async () => { const p = S.photos.find((x) => x.id === b.dataset.ppin); await patch('photos', p.id, { on_dashboard: !p.on_dashboard }); refresh(); }));
    form.querySelectorAll('[data-pdel]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Foto löschen?')) return;
      const p = S.photos.find((x) => x.id === b.dataset.pdel);
      await del('photos', p.id); if (!p.path.startsWith('http')) db.deletePhoto(p.path).catch(console.error);
      refresh();
    }));
    form.querySelectorAll('.pm-img img').forEach((im) => im.addEventListener('error', () => {}));
  }
  // Wenn Links nachgeladen werden, Vorschau aktualisieren
  const iv = setInterval(() => { if (!dlg.open) return clearInterval(iv); if (dlg.querySelector('.ph-loading')) refresh(); }, 800);
}

export function view(id) {
  const list = dashboardPhotos();
  let i = Math.max(0, list.findIndex((p) => p.id === id));
  const show = () => {
    const p = list[i]; const u = photoUrl(p.path);
    return `<div class="lightbox"><img src="${esc(u || '')}" alt="${esc(p.caption || '')}">${p.caption ? `<p>${esc(p.caption)}</p>` : ''}
      ${list.length > 1 ? `<div class="lb-nav"><button type="button" class="btn ghost sm" data-lb="-1">‹</button><span class="muted">${i + 1} / ${list.length}</span><button type="button" class="btn ghost sm" data-lb="1">›</button></div>` : ''}</div>`;
  };
  const dlg = openModal({ title: list[i].caption || 'Foto', body: show(), wide: true, hideCancel: true,
    onOpen: function bind(form) {
      form.querySelectorAll('[data-lb]').forEach((b) => (b.onclick = () => {
        i = (i + Number(b.dataset.lb) + list.length) % list.length;
        form.querySelector('.modal-body').innerHTML = show(); form.querySelector('h2').textContent = list[i].caption || 'Foto'; bind(form);
      }));
    } });
  return dlg;
}

export const actions = {
  'photo-manage': () => manage(),
  'photo-view': (el) => view(el.dataset.id),
};
