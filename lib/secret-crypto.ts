// ─────────────────────────────────────────────────────────────────────────────
// Secret-at-rest encryption (AES-256-GCM) for stored third-party credentials,
// e.g. bring-your-own AI provider keys in integration_configs.
// ─────────────────────────────────────────────────────────────────────────────
// Keyed off a DEDICATED `SECRET_ENCRYPT_KEY` so the encryption key is decoupled
// from the auth-signing secret (rotating/leaking one no longer compromises the
// other). New values are written as enc:v2: under SECRET_ENCRYPT_KEY.
//
// Backward-compatible by construction:
//   • enc:v2:  → SECRET_ENCRYPT_KEY-derived key (current)
//   • enc:v1:  → legacy JWT_SECRET-derived key (still decryptable, so secrets
//                written before the split are never lost; they upgrade to v2 the
//                next time they're saved)
//   • no prefix → legacy plaintext, returned unchanged
//
// If SECRET_ENCRYPT_KEY is not set, behaviour is identical to before the split
// (writes enc:v1: under JWT_SECRET) — so this is safe to deploy before the env
// var exists, and the security upgrade activates the moment it's added.
// ─────────────────────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const V1 = 'enc:v1:'; // AES key derived from JWT_SECRET (legacy)
const V2 = 'enc:v2:'; // AES key derived from SECRET_ENCRYPT_KEY (current)
const DEV_FALLBACK = 'linezheets-dev-fallback-secret';

type Version = 'v1' | 'v2';

const sha256Key = (material: string): Buffer => createHash('sha256').update(material).digest();

/**
 * The key + version to use when ENCRYPTING. Prefers the dedicated
 * SECRET_ENCRYPT_KEY (v2); falls back to JWT_SECRET (v1) so deploying ahead of
 * the env var changes nothing. In production it refuses the hardcoded dev
 * fallback — a known constant key is no encryption at all — and throws loudly
 * rather than silently writing "encrypted" data anyone could read.
 */
function activeKey(): { key: Buffer; version: Version } {
  const dedicated = process.env.SECRET_ENCRYPT_KEY;
  if (dedicated) return { key: sha256Key(dedicated), version: 'v2' };

  const jwt = process.env.JWT_SECRET;
  if (jwt) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[secret-crypto] SECRET_ENCRYPT_KEY not set — falling back to JWT_SECRET. Set a dedicated SECRET_ENCRYPT_KEY to decouple secret encryption from auth signing.');
    }
    return { key: sha256Key(jwt), version: 'v1' };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('[secret-crypto] No SECRET_ENCRYPT_KEY or JWT_SECRET set — refusing to encrypt secrets at rest with an insecure fallback.');
  }
  console.warn('[secret-crypto] No encryption key env set — using INSECURE dev fallback key. Never run this in production.');
  return { key: sha256Key(DEV_FALLBACK), version: 'v1' };
}

/** The key to use when DECRYPTING a value of a given version (undefined ⇒ key unavailable). */
function keyForVersion(version: Version): Buffer | undefined {
  if (version === 'v2') {
    const dedicated = process.env.SECRET_ENCRYPT_KEY;
    return dedicated ? sha256Key(dedicated) : undefined;
  }
  // v1 — legacy JWT_SECRET key (dev fallback only outside production).
  const jwt = process.env.JWT_SECRET;
  if (jwt) return sha256Key(jwt);
  return process.env.NODE_ENV === 'production' ? undefined : sha256Key(DEV_FALLBACK);
}

function encryptWith(key: Buffer, prefix: string, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return prefix + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/** Encrypt a secret for storage. Returns `enc:v2:<iv>:<tag>:<ct>` (base64), or v1 pre-split. */
export function encryptSecret(plain: string | null | undefined): string {
  if (!plain) return '';
  const { key, version } = activeKey();
  return encryptWith(key, version === 'v2' ? V2 : V1, String(plain));
}

/** Decrypt a stored secret. Legacy plaintext (no prefix) is returned as-is. */
export function decryptSecret(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const version: Version | null = value.startsWith(V2) ? 'v2' : value.startsWith(V1) ? 'v1' : null;
  if (!version) return value; // legacy plaintext — backward compatible

  const key = keyForVersion(version);
  if (!key) return undefined; // key for this version not configured — treat as missing
  try {
    const [ivB64, tagB64, ctB64] = value.slice((version === 'v2' ? V2 : V1).length).split(':');
    const iv  = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct  = Buffer.from(ctB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return undefined; // tampered / wrong key — treat as missing
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && (value.startsWith(V1) || value.startsWith(V2));
}
