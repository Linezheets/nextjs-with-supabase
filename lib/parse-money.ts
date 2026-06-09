/**
 * Robust money / quantity parsing for imported linesheets.
 *
 * Bare parseFloat mangles real-world values: parseFloat("$1,200") → NaN → 0,
 * parseFloat("1,200") → 1. That silently stored a $1,200 item as $0 or $1.
 * These strip currency symbols and thousands separators first.
 *
 * Caveat: assumes "." is the decimal separator (USD/UK style). European
 * "1.200,50" formatting is not auto-detected — linesheet prices here are USD.
 */

export function parseMoney(input: unknown): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const s = String(input).trim().replace(/[^0-9.\-]/g, '');
  if (s === '' || s === '-' || s === '.' || s === '-.') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Non-negative integer quantity; unparseable / negative → 0. */
export function parseQty(input: unknown): number {
  const n = parseMoney(input);
  return n == null || n < 0 ? 0 : Math.floor(n);
}
