import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/integrations/shopify';

type SyncAction = 'push-products' | 'sync-inventory';

type InventoryRow = {
  id: number;
  title: string | null;
  description: string | null;
  sku: string | null;
  category: string | null;
  brand_name: string;
  wsp_usd: number | null;
  srp: number | null;
  sizes: Record<string, number> | null;
  stock_total: number | null;
  tags: string[];
  status: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { action?: SyncAction; itemIds?: number[] };
  const { action, itemIds } = body;

  if (action !== 'push-products' && action !== 'sync-inventory') {
    return NextResponse.json({ error: 'action must be push-products or sync-inventory' }, { status: 400 });
  }

  const { data: cfg, error: cfgError } = await supabase
    .from('integration_configs')
    .select('id, access_token, shop_domain')
    .eq('brand_id', user.id)
    .eq('platform', 'shopify')
    .eq('active', true)
    .single();

  if (cfgError || !cfg) {
    return NextResponse.json({ error: 'Shopify not connected' }, { status: 400 });
  }

  const token      = decryptToken(cfg.access_token!);
  const shopDomain = cfg.shop_domain!;

  // ── Push products ──────────────────────────────────────────────────────────
  if (action === 'push-products') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('inventory')
      .select('id, title, description, sku, category, brand_name, wsp_usd, srp, sizes, tags, status')
      .eq('status', 'active');

    if (itemIds?.length) {
      query = query.in('id', itemIds);
    }

    const { data: items, error: itemsError } = await query;
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

    const results: { itemId: number; shopifyId: number | null; ok: boolean }[] = [];

    for (const item of (items as InventoryRow[]) ?? []) {
      // Public Shopify storefront must sell at RETAIL (srp), never the wholesale
      // cost. If srp is missing, fall back to a 2x markup of wholesale so we can
      // never dump product at cost. compare_at_price left null (no fake strike-through).
      const retailPrice = String(
        ((item.srp && item.srp > 0) ? item.srp : (item.wsp_usd ?? 0) * 2).toFixed(2),
      );
      const sizes = item.sizes ?? {};
      const variants = Object.entries(sizes).map(([size, qty]) => ({
        sku                 : item.sku ? `${item.sku}-${size}` : undefined,
        price               : retailPrice,
        compare_at_price    : null as string | null,
        option1             : size,
        inventory_management: 'shopify',
        inventory_quantity  : Math.max(0, qty),
      }));

      // Fall back to a single variant if no sizes recorded
      if (variants.length === 0) {
        variants.push({
          sku                 : item.sku ?? undefined,
          price               : retailPrice,
          compare_at_price    : null as string | null,
          option1             : 'One Size',
          inventory_management: 'shopify',
          inventory_quantity  : Math.max(0, item.stock_total ?? 0),
        });
      }

      const payload = {
        product: {
          title       : item.title ?? '',
          body_html   : item.description ?? '',
          vendor      : item.brand_name,
          product_type: item.category ?? '',
          tags        : (item.tags ?? []).join(','),
          variants,
          options     : [{ name: 'Size' }],
        },
      };

      const r = await fetch(`https://${shopDomain}/admin/api/2024-01/products.json`, {
        method : 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body   : JSON.stringify(payload),
      });
      const data = await r.json() as { product?: { id: number } };
      results.push({ itemId: item.id, shopifyId: data.product?.id ?? null, ok: r.ok });
    }

    await supabase
      .from('integration_configs')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', cfg.id);

    return NextResponse.json({ pushed: results.filter(r => r.ok).length, results });
  }

  // ── Sync inventory (pull Shopify → update stock_total by SKU) ──────────────
  const synced: string[] = [];

  // Fetch Shopify products with variants
  let nextPageUrl: string | null = `https://${shopDomain}/admin/api/2024-01/products.json?limit=250&fields=id,variants`;

  while (nextPageUrl) {
    const shopifyRes: Response = await fetch(nextPageUrl, {
      headers: { 'X-Shopify-Access-Token': token },
    });
    if (!shopifyRes.ok) break;

    const data = await shopifyRes.json() as {
      products: { variants: { sku: string; inventory_quantity: number }[] }[]
    };

    for (const product of data.products ?? []) {
      // Group variant quantities by base SKU (strip the size suffix we added on push)
      const qtyBySku: Record<string, number> = {};
      for (const variant of product.variants ?? []) {
        if (!variant.sku) continue;
        // Base SKU is everything before the last '-SIZE' segment
        const baseSku = variant.sku.replace(/-[^-]+$/, '') || variant.sku;
        qtyBySku[baseSku] = (qtyBySku[baseSku] ?? 0) + variant.inventory_quantity;
      }

      for (const [baseSku, qty] of Object.entries(qtyBySku)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inv } = await (supabase as any)
          .from('inventory')
          .select('id, sku')
          .eq('sku', baseSku)
          .single();

        if (inv) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('inventory')
            .update({ stock_total: qty, updated_at: new Date().toISOString() })
            .eq('id', inv.id);
          synced.push(baseSku);
        }
      }
    }

    // Follow Shopify pagination
    const linkHeader: string = shopifyRes.headers.get('link') ?? '';
    nextPageUrl = linkHeader.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }

  await supabase
    .from('integration_configs')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', cfg.id);

  return NextResponse.json({ synced: synced.length, skus: synced });
}
