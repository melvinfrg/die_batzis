// Kleine Helfer: Datum, Escaping, Formatierung

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const pad = (n) => String(n).padStart(2, '0');
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());
export const parseDate = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); };
export const addMonths = (s, n) => {
  const d = parseDate(s); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toDateStr(d);
};
/** b - a in ganzen Tagen */
export const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

const fmt = (s, o) => parseDate(s).toLocaleDateString('de-DE', o);
export const fmtDate = (s, style = 'medium') => {
  if (!s) return '';
  switch (style) {
    case 'long': return fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    case 'weekday': return fmt(s, { weekday: 'long', day: 'numeric', month: 'long' });
    case 'short': return fmt(s, { weekday: 'short', day: 'numeric', month: 'short' });
    case 'dm': return fmt(s, { day: '2-digit', month: '2-digit' });
    case 'month': return fmt(s, { month: 'long', year: 'numeric' });
    default: return fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
  }
};
export const fmtRange = (a, b) => {
  if (!a) return 'Noch kein Datum';
  if (!b || a === b) return fmtDate(a);
  const A = parseDate(a), B = parseDate(b);
  if (A.getFullYear() === B.getFullYear()) {
    if (A.getMonth() === B.getMonth()) return `${A.getDate()}.–${fmtDate(b)}`;
    return `${fmt(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b)}`;
  }
  return `${fmtDate(a)} – ${fmtDate(b)}`;
};
export const relDay = (s) => {
  const d = diffDays(todayStr(), s);
  if (d === 0) return 'Heute';
  if (d === 1) return 'Morgen';
  if (d === -1) return 'Gestern';
  if (d > 1 && d < 7) return fmt(s, { weekday: 'long' });
  if (d > 0) return `in ${d} Tagen`;
  return `vor ${-d} Tagen`;
};
export const fmtTime = (t) => (t ? String(t).slice(0, 5) : '');

export const plural = (n, one, many) => `${n.toLocaleString('de-DE')} ${n === 1 ? one : many}`;
export const money = (n) => (Number(n) || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

export function safeUrl(u) {
  if (!u) return null;
  let s = String(u).trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  try { const url = new URL(s); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export const cssUrl = (u) => { const s = safeUrl(u); return s ? `url("${s.replace(/["\\\n\r]/g, encodeURIComponent)}")` : ''; };
export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** Jahre/Monate/Tage zwischen zwei Daten */
export function ymd(from, to) {
  let a = parseDate(from), b = parseDate(to);
  if (b < a) [a, b] = [b, a];
  let y = b.getFullYear() - a.getFullYear();
  let m = b.getMonth() - a.getMonth();
  let d = b.getDate() - a.getDate();
  if (d < 0) { m -= 1; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
  if (m < 0) { y -= 1; m += 12; }
  return { y, m, d };
}
export function ymdText(from, to) {
  const { y, m, d } = ymd(from, to);
  const parts = [];
  if (y) parts.push(plural(y, 'Jahr', 'Jahre'));
  if (m) parts.push(plural(m, 'Monat', 'Monate'));
  if (d || !parts.length) parts.push(plural(d, 'Tag', 'Tage'));
  return parts.join(', ');
}

export const store = {
  get(k, fallback = null) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* egal */ } },
};

export const byKey = (fn, dir = 1) => (a, b) => { const x = fn(a), y = fn(b); return x < y ? -dir : x > y ? dir : 0; };
