/**
 * Privileged session timebox — admin & brand roles.
 *
 * Problem: Supabase auto-refreshes all sessions identically regardless of role.
 * A buyer staying logged in forever is acceptable.
 * An admin or brand account staying alive on an unattended device is NOT.
 *
 * Solution: an independent two-cookie layer on top of Supabase:
 *
 *   lz-priv-ts   — absolute session start timestamp (set at login, never updated)
 *   lz-priv-act  — last-activity timestamp (updated on every privileged request)
 *
 * Both are HttpOnly, Secure, SameSite=Strict. They cannot be read or set
 * from JavaScript. Expiry is enforced server-side on every request.
 *
 * Limits:
 *   admin  — 30 min absolute  /  15 min inactivity
 *   brand  — 2h absolute      /  30 min inactivity
 */

import type { NextRequest, NextResponse } from 'next/server';
import type { ResponseCookies } from 'next/dist/compiled/@edge-runtime/cookies';

// ── Constants ─────────────────────────────────────────────────────────────────

const COOKIE_START    = 'lz-priv-ts';   // session start (ms)
const COOKIE_ACTIVITY = 'lz-priv-act';  // last activity (ms)

export const LIMITS = {
  admin: {
    maxAgeMs       : 30 * 60 * 1000,   // 30 min absolute cap
    inactivityMs   : 15 * 60 * 1000,   // 15 min inactivity
  },
  brand: {
    maxAgeMs       : 2 * 60 * 60 * 1000,  // 2 h absolute cap
    inactivityMs   : 30 * 60 * 1000,      // 30 min inactivity
  },
} as const;

export type PrivRole = keyof typeof LIMITS;

// ── Shared cookie options ─────────────────────────────────────────────────────

function cookieOpts(maxAgeSeconds: number) {
  return {
    httpOnly : true,
    secure   : process.env.NODE_ENV === 'production',
    sameSite : 'strict' as const,   // stricter than Lax for privileged cookies
    path     : '/',
    maxAge   : maxAgeSeconds,
  };
}

// ── Check ─────────────────────────────────────────────────────────────────────

export type CheckResult =
  | { valid: true }
  | { valid: false; reason: 'no_session' | 'absolute_timeout' | 'inactivity_timeout' };

/**
 * Validate the privileged session cookies on an incoming request.
 * Returns { valid: true } or { valid: false, reason }.
 */
export function checkPrivSession(
  request : NextRequest,
  role    : PrivRole,
): CheckResult {
  const raw_ts  = request.cookies.get(COOKIE_START)?.value;
  const raw_act = request.cookies.get(COOKIE_ACTIVITY)?.value;

  if (!raw_ts || !raw_act) return { valid: false, reason: 'no_session' };

  const ts  = parseInt(raw_ts,  10);
  const act = parseInt(raw_act, 10);

  if (isNaN(ts) || isNaN(act)) return { valid: false, reason: 'no_session' };

  const now     = Date.now();
  const limits  = LIMITS[role];

  // Absolute cap — session cannot live longer than maxAgeMs regardless of activity
  if (now - ts > limits.maxAgeMs) {
    return { valid: false, reason: 'absolute_timeout' };
  }

  // Inactivity cap — must have been active within inactivityMs
  if (now - act > limits.inactivityMs) {
    return { valid: false, reason: 'inactivity_timeout' };
  }

  return { valid: true };
}

// ── Stamp (set / refresh activity) ───────────────────────────────────────────

/**
 * Stamp a fresh privileged session on an outgoing response.
 * Call this ONCE at login. Sets both ts and act to now.
 */
export function stampPrivSession(
  cookies : ResponseCookies,
  role    : PrivRole,
): void {
  const now     = Date.now().toString();
  const limits  = LIMITS[role];
  const maxSec  = Math.ceil(limits.maxAgeMs / 1000);

  cookies.set(COOKIE_START,    now, cookieOpts(maxSec));
  cookies.set(COOKIE_ACTIVITY, now, cookieOpts(maxSec));
}

/**
 * Refresh only the activity cookie on an outgoing response.
 * Call this on every subsequent privileged request (not at login).
 */
export function refreshPrivActivity(
  request : NextRequest,
  cookies : ResponseCookies,
  role    : PrivRole,
): void {
  // Preserve the original start timestamp
  const raw_ts = request.cookies.get(COOKIE_START)?.value;
  if (!raw_ts) return;   // no session to refresh

  const ts      = parseInt(raw_ts, 10);
  const limits  = LIMITS[role];
  const now     = Date.now();

  // Remaining absolute time for the session
  const remainingSec = Math.max(0, Math.ceil((ts + limits.maxAgeMs - now) / 1000));
  if (remainingSec <= 0) return;   // already expired — don't extend

  // Activity window is the smaller of: inactivity timeout or remaining absolute time
  const actSec = Math.min(
    Math.ceil(limits.inactivityMs / 1000),
    remainingSec,
  );

  cookies.set(COOKIE_ACTIVITY, now.toString(), cookieOpts(actSec));
  // Rewrite start cookie so its browser expiry stays aligned
  cookies.set(COOKIE_START, raw_ts, cookieOpts(remainingSec));
}

// ── Clear ─────────────────────────────────────────────────────────────────────

/**
 * Delete both privileged session cookies (on sign-out or timeout).
 */
export function clearPrivSession(cookies: ResponseCookies): void {
  const expired = { ...cookieOpts(0), maxAge: 0 };
  cookies.set(COOKIE_START,    '', expired);
  cookies.set(COOKIE_ACTIVITY, '', expired);
}

// ── Role detection ────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['info@linezheets.com', 'info@mxlla.com'];

export function resolvePrivRole(
  email: string | undefined | null,
  role : string | undefined | null,
): PrivRole | null {
  if (!email && !role) return null;
  if (role === 'admin' || ADMIN_EMAILS.includes(email ?? '')) return 'admin';
  if (role === 'brand') return 'brand';
  return null;
}

// ── Human-readable timeout messages ──────────────────────────────────────────

type TimeoutReason = Exclude<CheckResult, { valid: true }>['reason'];

export function timeoutMessage(reason: TimeoutReason | string): string {
  switch (reason) {
    case 'no_session':
      return 'Your session has expired. Please sign in again.';
    case 'absolute_timeout':
      return 'Your session has reached its time limit. Please sign in again to continue.';
    case 'inactivity_timeout':
      return 'You were signed out due to inactivity. Please sign in again.';
    default:
      return 'Session expired. Please sign in again.';
  }
}
