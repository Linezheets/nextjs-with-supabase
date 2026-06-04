/**
 * CIS Control 3 — Data Protection
 * Application-layer encryption for PII fields stored in the buyers table.
 *
 * Fields encrypted: phone, store_address
 * Algorithm: AES-256-GCM (authenticated encryption — detects tampering)
 * Key source: TOKEN_ENCRYPT_KEY env var (same 32-byte hex key as Shopify tokens)
 *
 * Encrypted format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * Prefix sentinel: "enc:" — used to distinguish encrypted values from plaintext
 * (allows safe migration: unencrypted legacy values are returned as-is)
 *
 * Usage:
 *   import { encryptPii, decryptPii, encryptBuyerPii, decryptBuyerPii } from '@/lib/crypto/pii';
 *
 *   // Single field
 *   const stored = encryptPii(rawPhone);   // → "enc:iv:tag:ct"
 *   const plain  = decryptPii(stored);     // → "+852 9123 4567"
 *
 *   // Full buyer record helpers
 *   const toStore  = encryptBuyerPii({ phone, store_address });
 *   const readable = decryptBuyerPii(dbRow);
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO    = 'aes-256-gcm';
const PREFIX  = 'enc:';

// ── Key resolution ────────────────────────────────────────────────────────────

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPT_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('TOKEN_ENCRYPT_KEY must be a 32-byte hex string (64 hex chars)');
  }
  return Buffer.from(hex, 'hex');
}

// ── Core encrypt / decrypt ────────────────────────────────────────────────────

/**
 * Encrypt a plaintext PII value.
 * Returns null if value is null/empty (preserves nullable semantics).
 */
export function encryptPii(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  // Already encrypted — idempotent
  if (value.startsWith(PREFIX)) return value;

  const key = getKey();
  const iv  = randomBytes(12);   // 96-bit IV for GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const ct  = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

/**
 * Decrypt a PII value.
 * Returns the original plaintext if not encrypted (safe legacy migration).
 * Returns null if value is null/empty.
 */
export function decryptPii(value: string | null | undefined): string | null {
  if (value == null || value === '') return null;
  // Not encrypted (legacy plaintext) — return as-is
  if (!value.startsWith(PREFIX)) return value;

  try {
    const parts = value.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return value;   // malformed — return raw
    const [ivHex, tagHex, ctHex] = parts;
    const key     = getKey();
    const iv      = Buffer.from(ivHex, 'hex');
    const tag     = Buffer.from(tagHex, 'hex');
    const ct      = Buffer.from(ctHex, 'hex');
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ct).toString('utf8') + decipher.final('utf8');
  } catch {
    // Decryption failed (wrong key, tampered data) — return null, not plaintext
    return null;
  }
}

// ── Buyer record helpers ──────────────────────────────────────────────────────

/** PII fields in the buyers table that are encrypted at rest. */
const BUYER_PII_FIELDS = ['phone', 'store_address'] as const;
type BuyerPiiField = typeof BUYER_PII_FIELDS[number];

/**
 * Encrypt PII fields on a buyer record before writing to DB.
 * Pass a partial record — only the listed PII fields are touched.
 */
export function encryptBuyerPii<T extends Partial<Record<BuyerPiiField, string | null>>>(
  record: T
): T {
  const out = { ...record } as Record<string, unknown>;
  for (const field of BUYER_PII_FIELDS) {
    if (field in out) {
      out[field] = encryptPii(out[field] as string | null);
    }
  }
  return out as T;
}

/**
 * Decrypt PII fields on a buyer record after reading from DB.
 * Safe to call on records with already-plaintext values (pre-migration rows).
 */
export function decryptBuyerPii<T extends Partial<Record<BuyerPiiField, string | null>>>(
  record: T
): T {
  const out = { ...record } as Record<string, unknown>;
  for (const field of BUYER_PII_FIELDS) {
    if (field in out) {
      out[field] = decryptPii(out[field] as string | null);
    }
  }
  return out as T;
}
