// Edge Function "offers": KI (Claude mit Websuche) sucht aktuelle Prospekt-Angebote
// für die Einkaufsliste bei ALDI, LIDL, PENNY, NETTO, REWE, EDEKA und Kaufland.
// Benötigt das Secret ANTHROPIC_API_KEY (Supabase → Edge Functions → Secrets).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const STORES = ['ALDI', 'LIDL', 'PENNY', 'NETTO', 'REWE', 'EDEKA', 'Kaufland'];

function extractJson(text: string) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(raw);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'Es ist noch kein KI-Schlüssel hinterlegt (Secret ANTHROPIC_API_KEY in Supabase).' }, 400);
    const auth = req.headers.get('Authorization') || '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: member } = await sb.rpc('is_member');
    if (!member) return json({ error: 'Kein Zugriff' }, 403);

    const body = await req.json().catch(() => ({}));
    const items: string[] = (Array.isArray(body.items) ? body.items : []).map((s: unknown) => String(s).slice(0, 60).trim()).filter(Boolean).slice(0, 15);
    const plz = String(body.plz || '').replace(/\D/g, '').slice(0, 5);
    if (!items.length) return json({ error: 'Keine Artikel übergeben' }, 400);

    // Schutz vor Doppelklicks: höchstens ein Lauf pro 60 Sekunden
    const { data: last } = await sb.from('app_settings').select('value').eq('id', 'offers_last').maybeSingle();
    if (last?.value?.started_at && Date.now() - Date.parse(last.value.started_at) < 60000 && !last.value.at) return json({ error: 'Läuft gerade schon – bitte kurz warten.' }, 429);
    await sb.from('app_settings').upsert({ id: 'offers_last', value: { ...(last?.value || {}), started_at: new Date().toISOString(), at: null } });

    const today = new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const prompt = `Heute ist ${today}. Wir wohnen${plz ? ` im PLZ-Gebiet ${plz}` : ' in Deutschland'}.
Finde für diese Einkaufsliste die aktuell gültigen Angebote (Prospekte dieser Woche) bei diesen Supermärkten: ${STORES.join(', ')}.
Einkaufsliste:
${items.map((i) => '- ' + i).join('\n')}

Vorgehen: Suche gezielt nach aktuellen Prospekt-Angeboten (z. B. auf marktguru.de, kaufda.de, meinprospekt.de oder den Händlerseiten). Nutze nur Angebote, die heute oder in den nächsten Tagen gültig sind. Erfinde keine Preise – wenn du für einen Artikel kein aktuelles Angebot findest, setze "best" auf null.

Antworte am Ende NUR mit einem JSON-Objekt in genau diesem Format (keine weiteren Erklärungen):
\`\`\`json
{
  "items": [
    { "name": "<Artikel wie oben>", "best": { "store": "<einer von ${STORES.join('/')}>", "product": "<Produkt/Marke>", "price": "<z. B. 1,29 €>", "unit": "<z. B. 1 l / 500 g>", "valid": "<z. B. bis Sa. 31.10.>", "url": "<Quelle>" } | null,
      "others": [ { "store": "...", "price": "...", "product": "..." } ] }
  ],
  "recommendation": { "store": "<Laden, in dem ihr am meisten spart>", "reason": "<1 Satz>" },
  "note": "<optional: kurzer Hinweis>"
}
\`\`\``;

    const model = Deno.env.get('OFFERS_MODEL') || 'claude-sonnet-5-5';
    let messages: any[] = [{ role: 'user', content: prompt }];
    let resp: any = null;
    for (let turn = 0; turn < 4; turn++) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 4000, messages,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: Math.min(10, 3 + items.length),
            user_location: { type: 'approximate', country: 'DE', timezone: 'Europe/Berlin' } }],
        }),
      });
      resp = await r.json();
      if (!r.ok) throw new Error(resp?.error?.message || 'KI-Anfrage fehlgeschlagen (' + r.status + ')');
      if (resp.stop_reason !== 'pause_turn') break;
      messages = [...messages, { role: 'assistant', content: resp.content }];
    }

    const text = (resp.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    const sources = new Map<string, string>();
    for (const b of resp.content || []) {
      if (b.type === 'text') for (const c of b.citations || []) if (c.url) sources.set(c.url, c.title || c.url);
    }
    let result: any;
    try { result = extractJson(text); } catch { throw new Error('Die KI-Antwort konnte nicht gelesen werden – bitte nochmal versuchen.'); }
    result.items = (result.items || []).map((it: any) => ({ ...it, best: it.best && STORES.some((s) => s.toLowerCase() === String(it.best.store || '').toLowerCase()) ? { ...it.best, store: STORES.find((s) => s.toLowerCase() === String(it.best.store).toLowerCase()) } : null }));
    const value = { at: new Date().toISOString(), plz, items: result.items, recommendation: result.recommendation || null, note: result.note || null,
      sources: [...sources].slice(0, 12).map(([url, title]) => ({ url, title })), usage: resp.usage?.server_tool_use || null };
    await sb.from('app_settings').upsert({ id: 'offers_last', value });
    return json(value);
  } catch (e) {
    try {
      const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
      const { data: last } = await sb.from('app_settings').select('value').eq('id', 'offers_last').maybeSingle();
      await sb.from('app_settings').upsert({ id: 'offers_last', value: { ...(last?.value || {}), started_at: null } });
    } catch { /* egal */ }
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
