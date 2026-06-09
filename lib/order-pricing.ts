import type { SupabaseClient } from '@supabase/supabase-js';
import { getBuyerRowId } from '@/lib/buyer-catalog';

/**
 * Server-side authoritative order pricing.
 *
 * The order total MUST NEVER be trusted from the client. This helper recomputes
 * the total from the same source the buyer was shown: get_buyer_catalog, which
 * returns each SKU's buyer-adjusted wholesale_price (after pricing + visibility
 * rules) and is SECURITY DEFINER. A SKU the buyer cannot see / has no price for
 * is rejected, so a tampered cart cannot smuggle in arbitrary prices or items.
 *
 * All amounts are USD — wsp_usd / total_usd are the platform's money basis.
 */

export type PricedLine = {
  sku       : string;
  qty       : number;
  unitWsp   : number;   // authoritative per-unit wholesale price (USD)
  lineTotal : number;   // unitWsp * qty, rounded to cents
  brandName : string | null;
};

export type PricingResult =
  | { ok: true;  totalUsd: number; lines: PricedLine[]; brands: string[] }
  | { ok: false; error: string; missingSkus?: string[] };

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Recompute an order's authoritative total from the buyer's catalog prices.
 *
 * @param admin       service-role Supabase client (buyer_pricing_rules is service-only RLS)
 * @param buyerEmail  the authenticated buyer's email (used to resolve buyers.id)
 * @param items       normalised line items — only `sku` and `total_qty` are trusted
 */
export async function priceOrderForBuyer(
  admin     : SupabaseClient,
  buyerEmail: string | null | undefined,
  items     : Array<{ sku: string; total_qty: number }>,
): Promise<PricingResult> {
  if (!buyerEmail) return { ok: false, error: 'Cannot price order: buyer email unknown' };

  const buyerId = await getBuyerRowId(admin, buyerEmail);
  if (!buyerId) return { ok: false, error: 'Cannot price order: buyer record not found' };

  const { data, error } = await admin.rpc('get_buyer_catalog', { p_buyer_id: buyerId });
  if (error) return { ok: false, error: `Pricing lookup failed: ${error.message}` };

  const bySku = new Map<string, { price: number; brand: string | null }>();
  for (const row of (data as Array<Record<string, unknown>>) ?? []) {
    const sku = String(row.sku ?? '').trim();
    if (!sku) continue;
    bySku.set(sku, {
      price: Number(row.wholesale_price ?? 0),
      brand: (row.brand_name as string) ?? null,
    });
  }

  const lines  : PricedLine[] = [];
  const missing: string[]     = [];

  for (const it of items) {
    const sku   = String(it.sku ?? '').trim();
    const found = bySku.get(sku);
    const qty   = Math.max(0, Math.floor(Number(it.total_qty) || 0));
    if (qty <= 0) continue;
    // Reject SKUs the buyer can't see or that have no positive price — never
    // fall back to a client-supplied figure.
    if (!found || !(found.price > 0)) { missing.push(sku); continue; }
    lines.push({
      sku,
      qty,
      unitWsp  : found.price,
      lineTotal: round2(found.price * qty),
      brandName: found.brand,
    });
  }

  if (missing.length) {
    return {
      ok        : false,
      error     : `Unknown or unavailable SKU(s): ${[...new Set(missing)].join(', ')}`,
      missingSkus: [...new Set(missing)],
    };
  }
  if (lines.length === 0) {
    return { ok: false, error: 'No priceable line items' };
  }

  const totalUsd = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const brands   = [...new Set(lines.map(l => l.brandName).filter(Boolean) as string[])];
  return { ok: true, totalUsd, lines, brands };
}
