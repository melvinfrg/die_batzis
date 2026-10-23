// Modal, Toasts, Konfetti
import { esc } from './util.js';

export function toast(msg, type = 'info') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2800);
  setTimeout(() => el.remove(), 3300);
}

/**
 * Formular-Dialog.
 * onSubmit(data, form) → false zurückgeben, um offen zu bleiben.
 */
export function openModal({ title, body, submitLabel = 'Speichern', onSubmit, onDelete, deleteLabel = 'Löschen', onOpen, hideCancel = false, wide = false, noClose = false, extra = null }) {
  const dlg = document.getElementById('modal');
  dlg.className = wide ? 'wide' : '';
  dlg.innerHTML = `
    <form class="modal-card" id="modal-form" novalidate>
      <header class="modal-head">
        <h2>${esc(title)}</h2>
        ${noClose ? '' : '<button type="button" class="icon-btn" data-close aria-label="Schließen">✕</button>'}
      </header>
      <div class="modal-body">${body}</div>
      <footer class="modal-foot">
        ${onDelete ? `<button type="button" class="btn ghost danger" data-delete>${esc(deleteLabel)}</button>` : ''}
        ${extra ? `<button type="button" class="btn ghost" data-extra>${esc(extra.label)}</button>` : ''}
        <span class="spacer"></span>
        ${hideCancel || noClose ? '' : '<button type="button" class="btn ghost" data-close>Abbrechen</button>'}
        ${onSubmit ? `<button type="submit" class="btn primary">${esc(submitLabel)}</button>` : ''}
      </footer>
    </form>`;
  const form = dlg.querySelector('form');
  dlg.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => dlg.close()));
  dlg.onclick = (e) => { if (e.target === dlg && !noClose) dlg.close(); };
  dlg.oncancel = (e) => { if (noClose) e.preventDefault(); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const invalid = [...form.elements].find((el) => el.required && !String(el.value).trim());
    if (invalid) { invalid.focus(); invalid.classList.add('shake'); setTimeout(() => invalid.classList.remove('shake'), 400); return; }
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = typeof v === 'string' ? v.trim() : v; });
    form.querySelectorAll('input[type=checkbox][name]').forEach((c) => (data[c.name] = c.checked));
    const btn = form.querySelector('[type=submit]');
    btn && (btn.disabled = true);
    try { const r = await onSubmit(data, form); if (r !== false) dlg.close(); }
    catch (err) { console.error(err); }
    finally { btn && (btn.disabled = false); }
  };
  const exBtn = form.querySelector('[data-extra]');
  if (exBtn) exBtn.onclick = () => extra.onClick();
  const delBtn = form.querySelector('[data-delete]');
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm('Wirklich löschen?')) return;
    try { await onDelete(); dlg.close(); } catch (e) { console.error(e); }
  };
  dlg.showModal();
  onOpen?.(form);
  const first = form.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 30);
  return dlg;
}

export function closeModal() { document.getElementById('modal').close(); }

export function burst(x, y, emojis = ['🎉', '✨', '💛', '⭐', '🌸']) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.className = 'burst';
    s.textContent = emojis[i % emojis.length];
    const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 70;
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--dx', Math.cos(a) * r + 'px');
    s.style.setProperty('--dy', Math.sin(a) * r - 30 + 'px');
    s.style.setProperty('--rot', (Math.random() * 120 - 60) + 'deg');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

export const centerOf = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
