// Edge Function "ical": lädt externe Kalender (z. B. Google-Kalender mit SuperShift-Schichten)
// serverseitig und gibt die Termine als JSON zurück. Nur für freigeschaltete Mitglieder.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const TZ = 'Europe/Berlin';
const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const addDay = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

function parseDT(value: string, params: Record<string, string>) {
  const v = value.trim();
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(v)) return { date: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, time: null as string | null, allDay: true };
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!m) return null;
  if (m[7]) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
    const s = fmt.format(d); // "2026-10-24 06:00"
    return { date: s.slice(0, 10), time: s.slice(11, 16), allDay: false };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}`, allDay: false };
}
const unesc = (s = '') => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

function parseICS(text: string, from: string, to: string) {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const out: any[] = [];
  let cur: Record<string, { v: string; p: Record<string, string> }> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.DTSTART) {
        const s = parseDT(cur.DTSTART.v, cur.DTSTART.p);
        const e = cur.DTEND ? parseDT(cur.DTEND.v, cur.DTEND.p) : null;
        if (s && (cur.STATUS?.v || '').toUpperCase() !== 'CANCELLED') {
          let end = e ? e.date : s.date;
          if (s.allDay && e) end = addDay(e.date, -1);
          if (end < s.date) end = s.date;
          const base = { uid: cur.UID?.v || crypto.randomUUID(), title: unesc(cur.SUMMARY?.v || 'Termin'), location: unesc(cur.LOCATION?.v || '') || null,
            all_day: s.allDay, start_time: s.time, end_time: e && !e.allDay ? e.time : null };
          const span = Math.round((Date.parse(end) - Date.parse(s.date)) / 86400000);
          const rr = cur.RRULE?.v;
          const dates: string[] = [s.date];
          if (rr) {
            const r = Object.fromEntries(rr.split(';').map((x) => x.split('=')));
            const step = r.FREQ === 'DAILY' ? 1 : r.FREQ === 'WEEKLY' ? 7 : 0;
            const interval = +(r.INTERVAL || 1);
            const count = r.COUNT ? +r.COUNT : 400;
            const until = r.UNTIL ? `${r.UNTIL.slice(0, 4)}-${r.UNTIL.slice(4, 6)}-${r.UNTIL.slice(6, 8)}` : to;
            if (step) { let d = s.date; for (let i = 1; i < count; i++) { d = addDay(d, step * interval); if (d > until || d > to) break; dates.push(d); } }
          }
          for (const d of dates) {
            const ed = addDay(d, span);
            if (ed < from || d > to) continue;
            out.push({ ...base, id: `${base.uid}-${d}`, event_date: d, end_date: span > 0 && base.all_day ? ed : null });
          }
        }
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const [name, ...ps] = line.slice(0, i).split(';');
    const p: Record<string, string> = {};
    ps.forEach((x) => { const [k, val] = x.split('='); if (k) p[k.toUpperCase()] = (val || '').replace(/"/g, ''); });
    const key = name.toUpperCase();
    if (!cur[key]) cur[key] = { v: line.slice(i + 1), p };
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') || '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: member } = await sb.rpc('is_member');
    if (!member) return json({ error: 'Kein Zugriff' }, 403);
    const { data: row } = await sb.from('app_settings').select('value').eq('id', 'ical_feeds').maybeSingle();
    const feeds: any[] = row?.value?.feeds || [];
    const today = new Date().toISOString().slice(0, 10);
    const from = addDay(today, -60), to = addDay(today, 400);
    const results = await Promise.all(feeds.map(async (f) => {
      try {
        let url = String(f.url || '').trim().replace(/^webcal:\/\//i, 'https://');
        if (!/^https:\/\//i.test(url)) throw new Error('Nur https-Links');
        const r = await fetch(url, { headers: { 'User-Agent': 'Batzis-Kalender/1.0' }, signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const text = await r.text();
        if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Kein Kalender-Link (ICS)');
        return { id: f.id, events: parseICS(text, from, to) };
      } catch (e) { return { id: f.id, error: String((e as Error).message || e), events: [] }; }
    }));
    return json({ feeds: results, fetched_at: new Date().toISOString() });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
