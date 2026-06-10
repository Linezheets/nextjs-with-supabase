import { createHash, randomBytes } from 'crypto';

/**
 * API-key generation + hashing for the public /v1 API.
 *
 * Format: `lz_{live|test}_<32 url-safe random bytes>`  (Stripe-style).
 * Only the SHA-256 hash is ever persisted; the raw key is returned once at
 * creation and cannot be recovered.
 */

export type ApiEnvironment = 'live' | 'test';

const PREFIX: Record<ApiEnvironment, string> = {
  live: 'lz_live_',
  test: 'lz_test_',
};

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

export interface GeneratedKey {
  raw       : string; // full key — show to the user once, never store
  keyPrefix : string; // first 16 chars, safe to display/store
  keyHash   : string; // SHA-256 hex — what we store
}

export function generateApiKey(env: ApiEnvironment): GeneratedKey {
  const raw       = PREFIX[env] + randomBytes(24).toString('base64url');
  return {
    raw,
    keyPrefix: raw.slice(0, 16),
    keyHash  : hashApiKey(raw),
  };
}

/** Detect the environment a raw key belongs to (null if it isn't one of ours). */
export function keyEnvironment(rawKey: string): ApiEnvironment | null {
  if (rawKey.startsWith(PREFIX.live)) return 'live';
  if (rawKey.startsWith(PREFIX.test)) return 'test';
  return null;
}
