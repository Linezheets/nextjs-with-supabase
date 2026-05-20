import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogItem } from './types';

// Resolve the buyers.id for the signed-in auth user (matched by email).
// Returns null if the buyer record doesn't exist yet.
export async function getBuyerRowId(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const { data } = await supabase
    .from('buyers')
    .select('id')
    .eq('email', email)
    .single();
  return data?.id ?? null;
}

// Fetch the catalog for an authenticated buyer, applying their pricing and
// visibility rules via the get_buyer_catalog RPC.
// Falls back to the raw buyer_vip_catalog view when no buyer record exists
// (e.g. pending / not-yet-onboarded users).
export async function getBuyerCatalog(
  supabase: SupabaseClient,
  email: string
): Promise<CatalogItem[]> {
  try {
    const buyerId = await getBuyerRowId(supabase, email);

    if (buyerId) {
      const { data, error } = await supabase.rpc('get_buyer_catalog', { p_buyer_id: buyerId });
      if (!error && Array.isArray(data)) {
        return data.map(normalise);
      }
    }

    // Fallback: no buyer record or RPC error — use public view
    const { data } = await supabase
      .from('buyer_vip_catalog')
      .select('*')
      .order('created_at', { ascending: false });
    return Array.isArray(data) ? (data as CatalogItem[]) : [];
  } catch {
    return [];
  }
}

// Map RPC column names to CatalogItem shape expected by components.
function normalise(row: Record<string, unknown>): CatalogItem {
  return {
    ...row,
    id             : String(row.id ?? ''),
    title          : (row.title as string) ?? null,
    retail_price   : row.retail_price  ?? null,
    wholesale_price: row.wholesale_price ?? null,
    image_url      : Array.isArray(row.image_urls)
                       ? (row.image_urls[0] as string) ?? null
                       : null,
    image_urls     : row.image_urls as string[] ?? null,
    brand_name     : (row.brand_name as string)    ?? null,
    category       : (row.category as string)      ?? null,
    season         : (row.season as string)        ?? null,
    inventory_status: (row.inventory_status as string) ?? null,
    min_order_qty  : (row.moq as number)            ?? null,
    consignment_terms: null,
    style_number   : (row.sku as string)            ?? null,
    description    : (row.description as string)   ?? null,
  } as CatalogItem;
}
