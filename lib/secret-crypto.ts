// ─────────────────────────────────────────────────────────────────────────────
// Secret-at-rest encryption (AES-256-GCM) for stored third-party credentials,
// e.g. bring-your-own AI provider keys in integration_configs.
// ─────────────────────────────────────────────────────────────────────────────
// Keyed off JWT_SECRET (a stable server secret already present in every env), so
// there's no new env var to coordinate across Vercel/Railway. Backward-compatible:
// values not carrying the enc:v1: prefix are treated as legacy plaintext and pass
// through unchanged, and get re-encrypted the next time they're saved.
// ─────────────────────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const PREFIX = 'enc:v1:';
// 32-byte AES key derived from the app's JWT secret (stable; does NOT rotate like
// the Supabase API keys, so encrypted values stay decryptable).
const KEY = createHash('sha256')
  .update(process.env.JWT_SECRET || 'linezheets-dev-fallback-secret')
  .digest();

/** Encrypt a secret for storage. Returns `enc:v1:<iv>:<tag>:<ciphertext>` (base64). */
export function encryptSecret(plain: string | null | undefined): string {
  if (!plain) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/** Decrypt a stored secret. Legacy plaintext (no prefix) is returned as-is. */
export function decryptSecret(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith(PREFIX)) return value; // legacy plaintext — backward compatible
  try {
    const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(':');
    const iv  = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct  = Buffer.from(ctB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return undefined; // tampered / wrong key — treat as missing
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}
