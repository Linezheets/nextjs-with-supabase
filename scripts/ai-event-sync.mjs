#!/usr/bin/env node
/**
 * AI Fashion Event Sync
 * Scrapes events from major fashion sources, parses with Claude, upserts to Supabase.
 * Run: node scripts/ai-event-sync.mjs
 * Or via POST /api/events/sync (cron-protected)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
// Parse env.local manually — dotenv can mis-parse lines after unicode comment chars
const envPath = join(__dir, '../env.local');
try {
  const envText = await import('fs').then(fs => fs.promises.readFile(envPath, 'utf8'));
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && val && !process.env[key]) process.env[key] = val;
  }
} catch {}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,          // service role — bypasses RLS
);

// ── City → lat/lng lookup for major fashion hubs ──────────────────────────────
const CITY_COORDS = {
  'Paris':          [48.8566,  2.3522],
  'Milan':          [45.4654,  9.1859],
  'London':         [51.5074, -0.1278],
  'New York':       [40.7128, -74.0060],
  'Tokyo':          [35.6762, 139.6503],
  'Berlin':         [52.5200,  13.4050],
  'Copenhagen':     [55.6761,  12.5683],
  'Stockholm':      [59.3293,  18.0686],
  'Seoul':          [37.5665, 126.9780],
  'Shanghai':       [31.2304, 121.4737],
  'Sydney':         [-33.8688, 151.2093],
  'Los Angeles':    [34.0522, -118.2437],
  'Madrid':         [40.4168,  -3.7038],
  'Amsterdam':      [52.3676,   4.9041],
  'Vienna':         [48.2082,  16.3738],
  'Dubai':          [25.2048,  55.2708],
  'São Paulo':      [-23.5505, -46.6333],
  'Mexico City':    [19.4326,  -99.1332],
  'Florence':       [43.7696,  11.2558],
  'Rome':           [41.9028,  12.4964],
  'Barcelona':      [41.3851,   2.1734],
  'Antwerp':        [51.2194,   4.4025],
  'Lagos':          [6.5244,    3.3792],
  'Toronto':        [43.6532,  -79.3832],
  'Tbilisi':        [41.6938,  44.8015],
};

function getCoords(city, country) {
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (city && city.toLowerCase().includes(key.toLowerCase())) return coords;
  }
  return [null, null];
}

// ── Sources to scrape ─────────────────────────────────────────────────────────
const SOURCES = [
  {
    name: 'British Fashion Council',
    url: 'https://www.britishfashioncouncil.co.uk/events',
    fallback_urls: ['https://londonfashionweek.co.uk/designers'],
  },
  {
    name: 'CFDA / New York Fashion Week',
    url: 'https://cfda.com/programs/fashion-calendar',
    fallback_urls: [],
  },
  {
    name: 'Fédération Haute Couture Paris',
    url: 'https://fhcm.paris/en/fashion-weeks/',
    fallback_urls: [],
  },
  {
    name: 'Vogue Fashion Shows',
    url: 'https://www.vogue.com/fashion-shows',
    fallback_urls: [],
  },
  {
    name: 'Dscene Magazine',
    url: 'https://dscene.org/category/fashion/',
    fallback_urls: [],
  },
  {
    name: 'Modemoline',
    url: 'https://www.modemoline.com/en/fashion/fashion-weeks',
    fallback_urls: ['https://www.modemoline.com/en/fashion'],
  },
  {
    name: 'Copenhagen Fashion Week',
    url: 'https://copenhagenfashionweek.com/programme/',
    fallback_urls: [],
  },
  {
    name: 'Milan Fashion Week (Camera Nazionale)',
    url: 'https://www.cameranazionaledellamoda.it/en/fashion-shows/schedule/',
    fallback_urls: [],
  },
];

// ── Fetch page text ────────────────────────────────────────────────────────────
async function fetchPageText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Linezheets/1.0; fashion calendar aggregator; +https://linezheets.com)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // Strip tags, collapse whitespace, limit size
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12000);            // Claude context limit guard
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ── Ask Claude to extract events ──────────────────────────────────────────────
const EXTRACT_SYSTEM = `You are a fashion industry data extractor. Given raw text scraped from a fashion website, extract all fashion events mentioned. Return ONLY valid JSON — an array of event objects, no prose.

Each event object must have:
{
  "title": "Event name",
  "type": one of ["fashion_week","runway","tradeshow","showroom","popup","networking","market_week"],
  "city": "City name",
  "country": "Country name",
  "venue_name": "Venue or null",
  "date_start": "YYYY-MM-DD or null",
  "date_end": "YYYY-MM-DD or null",
  "time_start": "HH:MM or null",
  "description": "1-2 sentence description or null",
  "website_url": "URL or null",
  "host_name": "Brand/organiser name or null",
  "season": "SS25 / FW25 / SS26 / FW26 / etc or null"
}

Rules:
- Only include events with at least a title AND city.
- Use current or future dates where ambiguous (today is ${new Date().toISOString().slice(0,10)}).
- If dates are not found, still include the event with date_start: null.
- Normalise city names (e.g. "NYC" → "New York", "Londres" → "London").
- If a page covers a full fashion week, create ONE event for the week, not per-show.
- De-duplicate — if the same event appears twice, include it once.
- Return [] if no events found.`;

async function extractEvents(sourceName, pageText, sourceUrl) {
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-8',          // best extraction quality
    max_tokens: 4096,
    system: EXTRACT_SYSTEM,
    messages: [{
      role: 'user',
      content: `Source: ${sourceName}\nURL: ${sourceUrl}\n\nPage text:\n${pageText}`,
    }],
  });

  const raw = msg.content[0]?.text?.trim() || '[]';
  // Claude sometimes wraps in ```json
  const json = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(json);
  } catch {
    console.warn(`[${sourceName}] JSON parse failed:`, json.slice(0, 200));
    return [];
  }
}

// ── Deduplicate key ───────────────────────────────────────────────────────────
function externalId(title, dateStart, city) {
  const str = `${title?.toLowerCase().trim()}|${dateStart || ''}|${city?.toLowerCase().trim()}`;
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

// ── Upsert one event ──────────────────────────────────────────────────────────
async function upsertEvent(event, sourceName, sourceUrl) {
  const [lat, lng] = getCoords(event.city, event.country);
  const extId = externalId(event.title, event.date_start, event.city);

  const row = {
    title:           event.title,
    type:            event.type || 'fashion_week',
    description:     event.description || null,
    city:            event.city,
    country:         event.country || null,
    venue_name:      event.venue_name || null,
    lat:             lat,
    lng:             lng,
    date_start:      event.date_start || null,
    date_end:        event.date_end || null,
    time_start:      event.time_start || null,
    website_url:     event.website_url || null,
    host_name:       event.host_name || sourceName,
    season:          event.season || null,
    is_public:       true,
    status:          'approved',
    source_name:     sourceName,
    source_url:      event.website_url || sourceUrl,
    external_id:     extId,
    ai_synced:       true,
    last_synced_at:  new Date().toISOString(),
  };

  // Skip if no date — prevents empty ghost events
  if (!row.date_start) return 'skipped';

  const { data: existing } = await supabase
    .from('showroom_events')
    .select('id, status')
    .eq('external_id', extId)
    .single();

  if (existing) {
    // Update only sync meta + date, don't overwrite manual edits
    const { error } = await supabase
      .from('showroom_events')
      .update({
        date_start: row.date_start,
        date_end:   row.date_end,
        last_synced_at: row.last_synced_at,
        lat: row.lat ?? existing.lat,
        lng: row.lng ?? existing.lng,
      })
      .eq('id', existing.id);
    if (error) throw error;
    return 'updated';
  } else {
    const { error } = await supabase
      .from('showroom_events')
      .insert(row);
    if (error && error.code === '23505') return 'duplicate';  // race condition
    if (error) throw error;
    return 'added';
  }
}

// ── Log sync run ──────────────────────────────────────────────────────────────
async function logRun(sourceName, sourceUrl, stats, errorMsg, durationMs) {
  await supabase.from('event_sync_log').insert({
    source_name:    sourceName,
    source_url:     sourceUrl,
    events_found:   stats.found,
    events_added:   stats.added,
    events_updated: stats.updated,
    error_msg:      errorMsg || null,
    duration_ms:    durationMs,
  }).then(() => {}, () => {}); // non-critical
}

// ── Sync one source ────────────────────────────────────────────────────────────
async function syncSource(source) {
  const t0 = Date.now();
  let pageText = null;
  let usedUrl = source.url;

  try {
    pageText = await fetchPageText(source.url);
  } catch (err) {
    for (const fb of (source.fallback_urls || [])) {
      try {
        pageText = await fetchPageText(fb);
        usedUrl = fb;
        break;
      } catch {}
    }
  }

  if (!pageText) {
    console.warn(`[${source.name}] ✗ Could not fetch page`);
    await logRun(source.name, usedUrl, {found:0,added:0,updated:0}, 'Fetch failed', Date.now()-t0);
    return;
  }

  let events = [];
  try {
    events = await extractEvents(source.name, pageText, usedUrl);
  } catch (err) {
    console.warn(`[${source.name}] ✗ Claude extraction failed:`, err.message);
    await logRun(source.name, usedUrl, {found:0,added:0,updated:0}, err.message, Date.now()-t0);
    return;
  }

  console.log(`[${source.name}] Found ${events.length} events`);

  const stats = { found: events.length, added: 0, updated: 0 };
  for (const ev of events) {
    try {
      const result = await upsertEvent(ev, source.name, usedUrl);
      if (result === 'added')   stats.added++;
      if (result === 'updated') stats.updated++;
    } catch (err) {
      console.warn(`  ✗ ${ev.title}: ${err.message}`);
    }
  }

  console.log(`[${source.name}] ✓ +${stats.added} added, ${stats.updated} updated (${Date.now()-t0}ms)`);
  await logRun(source.name, usedUrl, stats, null, Date.now()-t0);
}

// ── Main ───────────────────────────────────────────────────────────────────────
export async function runSync({ sources = SOURCES } = {}) {
  console.log(`\n🔄 Fashion Events AI Sync — ${new Date().toISOString()}`);
  const results = [];

  for (const source of sources) {
    try {
      await syncSource(source);
      results.push({ source: source.name, ok: true });
    } catch (err) {
      console.error(`[${source.name}] Fatal:`, err.message);
      results.push({ source: source.name, ok: false, error: err.message });
    }
    // Rate limit: 1s between sources
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✅ Sync complete\n');
  return results;
}

// ── CLI entry ─────────────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSync().catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
}
