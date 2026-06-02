import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// ── City → lat/lng for major fashion cities ───────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  'Paris':         [48.8566,   2.3522],
  'Milan':         [45.4654,   9.1859],
  'London':        [51.5074,  -0.1278],
  'New York':      [40.7128,  -74.0060],
  'Tokyo':         [35.6762,  139.6503],
  'Berlin':        [52.5200,   13.4050],
  'Copenhagen':    [55.6761,   12.5683],
  'Stockholm':     [59.3293,   18.0686],
  'Seoul':         [37.5665,  126.9780],
  'Shanghai':      [31.2304,  121.4737],
  'Sydney':        [-33.8688, 151.2093],
  'Los Angeles':   [34.0522,  -118.2437],
  'Madrid':        [40.4168,  -3.7038],
  'Amsterdam':     [52.3676,   4.9041],
  'Vienna':        [48.2082,   16.3738],
  'Dubai':         [25.2048,   55.2708],
  'São Paulo':     [-23.5505, -46.6333],
  'Florence':      [43.7696,   11.2558],
  'Antwerp':       [51.2194,    4.4025],
  'Lagos':         [6.5244,     3.3792],
  'Toronto':       [43.6532,  -79.3832],
  'Tbilisi':       [41.6938,   44.8015],
  'Barcelona':     [41.3851,    2.1734],
};

function getCoords(city: string): [number | null, number | null] {
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (city?.toLowerCase().includes(key.toLowerCase())) return coords;
  }
  return [null, null];
}

export const SOURCES = [
  { name: 'British Fashion Council',         url: 'https://www.britishfashioncouncil.co.uk/events' },
  { name: 'CFDA / New York Fashion Week',    url: 'https://cfda.com/programs/fashion-calendar' },
  { name: 'Fédération Haute Couture Paris',  url: 'https://fhcm.paris/en/fashion-weeks/' },
  { name: 'Vogue Fashion Shows',             url: 'https://www.vogue.com/fashion-shows' },
  { name: 'Dscene Magazine',                 url: 'https://dscene.org/category/fashion/' },
  { name: 'Modemoline',                      url: 'https://www.modemoline.com/en/fashion/fashion-weeks' },
  { name: 'Copenhagen Fashion Week',         url: 'https://copenhagenfashionweek.com/programme/' },
  { name: 'Camera Nazionale della Moda',     url: 'https://www.cameranazionaledellamoda.it/en/fashion-shows/schedule/' },
];

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Linezheets/1.0; +https://linezheets.com)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

const EXTRACT_SYSTEM = (today: string) => `You are a fashion industry data extractor. Given raw text scraped from a fashion website, extract all fashion events. Return ONLY valid JSON — an array, no prose.

Each object:
{
  "title": string,
  "type": "fashion_week"|"runway"|"tradeshow"|"showroom"|"popup"|"networking"|"market_week",
  "city": string,
  "country": string|null,
  "venue_name": string|null,
  "date_start": "YYYY-MM-DD"|null,
  "date_end": "YYYY-MM-DD"|null,
  "time_start": "HH:MM"|null,
  "description": string|null,
  "website_url": string|null,
  "host_name": string|null,
  "season": "SS25"|"FW25"|"SS26"|"FW26"|null
}

Rules: only include events with title AND city. Today is ${today}. Normalise city names. One event per week (not per show). Deduplicate. Return [] if none found.`;

async function extractEvents(sourceName: string, pageText: string, sourceUrl: string, anthropic: any) {
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    system: EXTRACT_SYSTEM(new Date().toISOString().slice(0, 10)),
    messages: [{ role: 'user', content: `Source: ${sourceName}\nURL: ${sourceUrl}\n\n${pageText}` }],
  });

  const raw = (msg.content[0] as any)?.text?.trim() || '[]';
  const json = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  try   { return JSON.parse(json) as any[]; }
  catch { return []; }
}

function externalId(title: string, dateStart: string | null, city: string): string {
  const s = `${title?.toLowerCase().trim()}|${dateStart || ''}|${city?.toLowerCase().trim()}`;
  return createHash('sha256').update(s).digest('hex').slice(0, 16);
}

async function upsertEvent(event: any, sourceName: string, sourceUrl: string, supabase: any) {
  if (!event.date_start) return 'skipped';

  const [lat, lng] = getCoords(event.city || '');
  const extId = externalId(event.title, event.date_start, event.city);

  const { data: existing } = await (supabase as any)
    .from('showroom_events')
    .select('id')
    .eq('external_id', extId)
    .single();

  if (existing) {
    await (supabase as any).from('showroom_events').update({
      date_start: event.date_start,
      date_end:   event.date_end || null,
      last_synced_at: new Date().toISOString(),
      ...(lat ? { lat, lng } : {}),
    }).eq('id', existing.id);
    return 'updated';
  }

  const { error } = await (supabase as any).from('showroom_events').insert({
    title:          event.title,
    type:           event.type || 'fashion_week',
    description:    event.description || null,
    city:           event.city,
    country:        event.country || null,
    venue_name:     event.venue_name || null,
    lat, lng,
    date_start:     event.date_start,
    date_end:       event.date_end || null,
    time_start:     event.time_start || null,
    website_url:    event.website_url || null,
    host_name:      event.host_name || sourceName,
    season:         event.season || null,
    is_public:      true,
    status:         'approved',
    source_name:    sourceName,
    source_url:     event.website_url || sourceUrl,
    external_id:    extId,
    ai_synced:      true,
    last_synced_at: new Date().toISOString(),
  });

  if (error?.code === '23505') return 'duplicate';
  if (error) throw error;
  return 'added';
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function runSync(sources = SOURCES) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const supabase  = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const results: { source: string; found: number; added: number; updated: number; error?: string }[] = [];

  for (const source of sources) {
    const t0 = Date.now();
    try {
      const pageText = await fetchPageText(source.url);
      const events   = await extractEvents(source.name, pageText, source.url, anthropic);
      const stats    = { source: source.name, found: events.length, added: 0, updated: 0 };

      for (const ev of events) {
        try {
          const r = await upsertEvent(ev, source.name, source.url, supabase);
          if (r === 'added')   stats.added++;
          if (r === 'updated') stats.updated++;
        } catch {}
      }

      await (supabase as any).from('event_sync_log').insert({
        source_name: source.name, source_url: source.url,
        events_found: stats.found, events_added: stats.added, events_updated: stats.updated,
        duration_ms: Date.now() - t0,
      }).catch(() => {});

      results.push(stats);
    } catch (err: any) {
      results.push({ source: source.name, found: 0, added: 0, updated: 0, error: err.message });
    }

    await new Promise(r => setTimeout(r, 1000)); // rate-limit between sources
  }

  return results;
}
