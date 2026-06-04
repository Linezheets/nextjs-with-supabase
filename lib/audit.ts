/**
 * Platform-wide activity / audit log.
 *
 * Captures every significant event across ALL users and roles:
 *   auth events   — login, logout, failed login, MFA enroll/verify/unenroll
 *   admin events  — buyer/brand management, order overrides, revenue queries
 *   brand events  — inventory changes, product publish, linesheet upload
 *   buyer events  — order place, cart, favourites, profile update
 *   security      — priv-session timeout, rate-limit hit, 401/403
 *   system        — cron runs, webhook receives, AI generation
 *
 * Design goals:
 *   • fire-and-forget — NEVER awaited on the hot path, NEVER throws
 *   • fully enriched  — IP → geo (ip-api.com), UA → device (bowser), priv session age
 *   • queryable       — admin API at /api/audit with filters + CSV export
 *   • write-only RLS  — the table is append-only from the app; only service-role reads
 *
 * Geo provider: ip-api.com
 *   Free forever · no API key · 45 req/min · returns country, city, region,
 *   ISP, org, ASN, lat/lon, timezone, zip · HTTPS on paid only → we use HTTP
 *   internally (server-to-server call, never exposed to clients).
 *   Fallback: ipinfo.io free tier (60k/month) if ip-api is unreachable.
 *
 * NOTE: Google Maps Geolocation API is NOT suitable here — it requires
 *   WiFi/cell data to position a device and cannot resolve an IP address.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuditAction =
  // auth
  | 'login'            | 'login_failed'      | 'login_rate_limited'
  | 'logout'           | 'oauth_login'        | 'password_reset_request'
  | 'password_changed'
  | 'mfa_enroll'       | 'mfa_verify'        | 'mfa_unenroll'
  | 'mfa_bypass_attempt'
  // session
  | 'priv_session_start'  | 'priv_session_timeout' | 'priv_session_activity'
  // admin
  | 'admin_view_buyers'   | 'admin_view_brands'    | 'admin_view_orders'
  | 'admin_view_revenue'  | 'admin_view_stats'
  | 'admin_update_buyer'  | 'admin_update_brand'
  | 'admin_set_pricing_rule' | 'admin_set_visibility_rule'
  // brand
  | 'brand_create_product'   | 'brand_update_product'   | 'brand_delete_product'
  | 'brand_upload_linesheet'  | 'brand_publish_store'    | 'brand_create_promotion'
  | 'brand_send_recommendation'
  | 'brand_view_analytics'   | 'brand_view_orders'
  // buyer
  | 'buyer_place_order'      | 'buyer_view_catalog'
  | 'buyer_add_to_cart'      | 'buyer_checkout'
  | 'buyer_save_product'     | 'buyer_update_profile'
  | 'buyer_follow_brand'
  // marketplace
  | 'marketplace_search'     | 'marketplace_view_product' | 'marketplace_export_pdf'
  // system
  | 'cron_run'               | 'webhook_received'
  | 'ai_generate'            | 'linesheet_parse'
  // security
  | 'access_denied'          | 'rate_limited'             | 'invalid_token'
  | string;                  // extensible

export type AuditStatus = 'success' | 'failure' | 'blocked' | 'error';

export type AuditRole = 'admin' | 'brand' | 'buyer' | 'anonymous' | 'system';

export interface AuditEvent {
  // Who
  user_id    ?: string | null;
  email      ?: string | null;
  role        : AuditRole;
  // What
  action      : AuditAction;
  resource   ?: string | null;   // e.g. 'buyer:abc123', 'product:sku-001'
  status      : AuditStatus;
  detail     ?: string | null;   // human-readable summary
  metadata   ?: Record<string, unknown>;  // structured extra data
  // Where / how
  ip         ?: string | null;
  user_agent ?: string | null;
  // Filled in automatically by logActivity()
  country    ?: string | null;
  city       ?: string | null;
  region     ?: string | null;
  org        ?: string | null;   // ISP / ASN
  timezone   ?: string | null;   // e.g. Asia/Hong_Kong
  lat        ?: number | null;   // latitude
  lon        ?: number | null;   // longitude
  browser    ?: string | null;
  browser_ver?: string | null;
  os         ?: string | null;
  os_ver     ?: string | null;
  device_type?: string | null;   // desktop | mobile | tablet
  device_vend?: string | null;   // Apple | Samsung etc.
  // Priv session
  priv_role  ?: string | null;   // admin | brand | null
  session_age_s?: number | null; // seconds since lz-priv-ts was set
}

// ── Singletons ────────────────────────────────────────────────────────────────

// Use the service-role key so we can insert regardless of RLS policies.
// This client is module-level (reused across requests).
let _db: ReturnType<typeof createSupabaseClient> | null = null;
function getDb() {
  if (_db) return _db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _db = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _db;
}

// ── IP → Geo (ip-api.com primary · ipinfo.io fallback) ───────────────────────
//
// ip-api.com:
//   • Free forever, no API key, no signup
//   • 45 requests/minute (shared across your server IP)
//   • Returns: country, countryCode, city, region, timezone, ISP, org, ASN,
//              lat, lon, zip — more than IPinfo free tier
//   • HTTP only on free plan (fine — this is a server-to-server call)
//
// ipinfo.io fallback:
//   • 60k req/month free, no key needed (unauthenticated endpoint)
//   • Used only if ip-api.com times out or rate-limits
//
// Both are wrapped in an in-process LRU cache (512 entries, 10-min TTL)
// so repeated requests for the same IP (e.g. a buyer browsing the catalogue)
// never hit the network more than once per 10 minutes.

type GeoResult = {
  country    : string | null;
  city       : string | null;
  region     : string | null;
  org        : string | null;
  timezone   : string | null;
  lat        : number | null;
  lon        : number | null;
};

const geoCache = new Map<string, { data: GeoResult; ts: number }>();
const GEO_TTL_MS = 10 * 60 * 1000;   // 10 minutes
const GEO_MAX    = 512;

const NULL_GEO: GeoResult = { country: null, city: null, region: null, org: null, timezone: null, lat: null, lon: null };

function isPrivateIp(ip: string): boolean {
  return !ip ||
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.')      ||
    ip.startsWith('172.16.')  ||
    ip.startsWith('172.17.')  ||
    ip.startsWith('172.18.')  ||
    ip.startsWith('172.19.')  ||
    ip.startsWith('172.2')    ||
    ip.startsWith('172.3')    ||
    ip.startsWith('::ffff:127.');
}

async function geoFromIp(ip: string): Promise<GeoResult> {
  if (isPrivateIp(ip)) {
    return { ...NULL_GEO, country: 'local', city: 'localhost' };
  }

  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.ts < GEO_TTL_MS) return cached.data;

  // ── Primary: ip-api.com ───────────────────────────────────────────────────
  try {
    const fields = 'status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query';
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (res.ok) {
      const d = await res.json() as {
        status?: string;
        country?: string; countryCode?: string; regionName?: string;
        city?: string; timezone?: string; isp?: string; org?: string;
        as?: string; lat?: number; lon?: number;
      };
      if (d.status === 'success') {
        const orgStr = [d.as, d.isp].filter(Boolean).join(' · ') || d.org || null;
        const data: GeoResult = {
          country : d.country     ?? null,
          city    : d.city        ?? null,
          region  : d.regionName  ?? null,
          org     : orgStr,
          timezone: d.timezone    ?? null,
          lat     : d.lat         ?? null,
          lon     : d.lon         ?? null,
        };
        if (geoCache.size >= GEO_MAX) geoCache.delete(geoCache.keys().next().value!);
        geoCache.set(ip, { data, ts: Date.now() });
        return data;
      }
    }
  } catch { /* fall through to ipinfo.io fallback */ }

  // ── Fallback: ipinfo.io free (60k/month, no key) ─────────────────────────
  try {
    const res = await fetch(
      `https://ipinfo.io/${encodeURIComponent(ip)}/json`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (res.ok) {
      const d = await res.json() as { country?: string; city?: string; region?: string; org?: string; timezone?: string; loc?: string };
      const [lat, lon] = (d.loc ?? '').split(',').map(Number);
      const data: GeoResult = {
        country : d.country  ?? null,
        city    : d.city     ?? null,
        region  : d.region   ?? null,
        org     : d.org      ?? null,
        timezone: d.timezone ?? null,
        lat     : isFinite(lat) ? lat : null,
        lon     : isFinite(lon) ? lon : null,
      };
      if (geoCache.size >= GEO_MAX) geoCache.delete(geoCache.keys().next().value!);
      geoCache.set(ip, { data, ts: Date.now() });
      return data;
    }
  } catch { /* both providers unavailable */ }

  return NULL_GEO;
}

// ── UA parsing ────────────────────────────────────────────────────────────────

type UaResult = {
  browser    : string | null;
  browser_ver: string | null;
  os         : string | null;
  os_ver     : string | null;
  device_type: string | null;
  device_vend: string | null;
};

function parseUa(ua: string | null | undefined): UaResult {
  if (!ua) return { browser: null, browser_ver: null, os: null, os_ver: null, device_type: null, device_vend: null };
  try {
    // bowser is a peer dep available in node_modules
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bowser = require('bowser');
    const p      = bowser.parse(ua);
    return {
      browser    : p.browser?.name  ?? null,
      browser_ver: p.browser?.version ?? null,
      os         : p.os?.name       ?? null,
      os_ver     : p.os?.version    ?? null,
      device_type: p.platform?.type ?? null,   // 'desktop' | 'mobile' | 'tablet'
      device_vend: p.platform?.vendor ?? null,
    };
  } catch {
    return { browser: null, browser_ver: null, os: null, os_ver: null, device_type: null, device_vend: null };
  }
}

// ── Priv-session age helper ───────────────────────────────────────────────────

function privSessionAge(req?: NextRequest): { priv_role: string | null; session_age_s: number | null } {
  if (!req) return { priv_role: null, session_age_s: null };
  const ts = req.cookies.get('lz-priv-ts')?.value;
  if (!ts) return { priv_role: null, session_age_s: null };
  const age = Math.round((Date.now() - parseInt(ts, 10)) / 1000);
  // Infer role from path
  const path = req.nextUrl?.pathname ?? '';
  const priv_role = path.startsWith('/api/admin') || path.startsWith('/dashboard/admin')
    ? 'admin'
    : 'brand';
  return { priv_role, session_age_s: isNaN(age) ? null : age };
}

// ── IP extractor ──────────────────────────────────────────────────────────────

export function extractIp(req: NextRequest | Request): string | null {
  const h = 'headers' in req ? req.headers : null;
  if (!h) return null;
  const xff = (h as Headers).get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return (h as Headers).get('x-real-ip') ?? null;
}

// ── Main logger ───────────────────────────────────────────────────────────────

/**
 * Log an activity event. Always fire-and-forget — never throws, never awaited.
 *
 * @param event   The audit event payload
 * @param req     Optional NextRequest — auto-enriches IP, UA, priv-session
 */
export function logActivity(event: AuditEvent, req?: NextRequest): void {
  // Deliberately not awaited
  void _writeEvent(event, req).catch(() => { /* never surface errors */ });
}

async function _writeEvent(event: AuditEvent, req?: NextRequest): Promise<void> {
  const db = getDb();
  if (!db) return;   // DB not configured — skip silently

  try {
    // 1. Extract IP from request if not provided
    const ip = event.ip ?? (req ? extractIp(req) : null);

    // 2. Parse UA
    const ua     = event.user_agent ?? (req ? req.headers.get('user-agent') : null);
    const parsed = parseUa(ua);

    // 3. Geo lookup (non-blocking within this async fn)
    const geo = ip ? await geoFromIp(ip) : NULL_GEO;

    // 4. Priv session metadata
    const privMeta = event.priv_role !== undefined
      ? { priv_role: event.priv_role, session_age_s: event.session_age_s }
      : privSessionAge(req);

    // 5. Write to DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('platform_audit_log').insert({
      user_id     : event.user_id     ?? null,
      email       : event.email       ?? null,
      role        : event.role,
      action      : event.action,
      resource    : event.resource    ?? null,
      status      : event.status,
      detail      : event.detail      ?? null,
      metadata    : event.metadata    ?? null,
      ip          : ip,
      user_agent  : ua,
      country     : event.country     ?? geo.country,
      city        : event.city        ?? geo.city,
      region      : event.region      ?? geo.region,
      org         : event.org         ?? geo.org,
      timezone    : event.timezone    ?? geo.timezone,
      lat         : event.lat         ?? geo.lat,
      lon         : event.lon         ?? geo.lon,
      browser     : event.browser     ?? parsed.browser,
      browser_ver : event.browser_ver ?? parsed.browser_ver,
      os          : event.os          ?? parsed.os,
      os_ver      : event.os_ver      ?? parsed.os_ver,
      device_type : event.device_type ?? parsed.device_type,
      device_vend : event.device_vend ?? parsed.device_vend,
      priv_role   : privMeta.priv_role,
      session_age_s: privMeta.session_age_s,
    });
  } catch {
    // Swallow all errors — audit log must never break the application
  }
}

// ── Convenience helpers ───────────────────────────────────────────────────────

/**
 * Build an AuditEvent from a NextRequest + known user context.
 * Useful inside API routes: const evt = auditFrom(req, user); logActivity(evt);
 */
export function auditFrom(
  req   : NextRequest,
  opts  : Omit<AuditEvent, 'ip' | 'user_agent'>,
): AuditEvent {
  return {
    ...opts,
    ip        : extractIp(req),
    user_agent: req.headers.get('user-agent'),
  };
}
