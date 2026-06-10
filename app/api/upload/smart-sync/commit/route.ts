import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseMoney } from '@/lib/parse-money';

const GENDERS = ['Women', 'Men', 'Unisex', 'Kids'];
const CATEGORIES = new Set(['TOPS','BOTTOMS','DRESSES','OUTERWEAR','KNITWEAR','ACCESSORIES','BAGS','SHOES','GENERAL']);

function normGender(v: unknown): string {
  const s = String(v ?? '').trim();
  return GENDERS.find(g => g.toLowerCase() === s.toLowerCase()) ?? 'Unisex';
}
function normCategory(v: unknown): string {
  const s = String(v ?? '').trim().toUpperCase();
  return CATEGORIES.has(s) ? s : 'GENERAL';
}

// NOTE: brand_id / brand_name are intentionally NOT taken from the payload —
// they are forced to the authenticated caller's brand server-side (tenant isolation).
const DB_COLUMNS = new Set([
  'sku','description','color','gender','season','brand_name','category','material',
  'delivery_window','product_notes','wsp_usd','srp','cost','moq','stock_total',
  'sizes','tier_pricing','image_urls','tags','margin','status',
  'hs_code','country_of_origin','net_weight_kg','gross_weight_kg',
]);

function sanitise(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'title') { if (!out.description && v) out.description = v; continue; }
    if (DB_COLUMNS.has(k)) out[k] = v;
  }
  return out;
}

function prepareRow(p: Record<string, unknown>): Record<string, unknown> {
  const wsp = Math.max(0, parseMoney(p.wsp_usd) ?? 0);
  const srp = Math.max(0, parseMoney(p.srp) ?? 0);
  const margin = parseMoney(p.margin) ?? 0.5;

  let sizes = p.sizes;
  if (typeof sizes === 'string') { try { sizes = JSON.parse(sizes); } catch { sizes = {}; } }
  if (!sizes || typeof sizes !== 'object' || Array.isArray(sizes)) sizes = {};

  let tier_pricing = p.tier_pricing;
  if (!Array.isArray(tier_pricing)) {
    if (typeof tier_pricing === 'string') { try { tier_pricing = JSON.parse(tier_pricing); } catch { tier_pricing = []; } }
    else tier_pricing = [];
  }

  return {
    ...p,
    gender      : normGender(p.gender),
    category    : normCategory(p.category),
    wsp_usd     : wsp || (srp > 0 ? +(srp * margin).toFixed(2) : 0),
    srp,
    sizes,
    tier_pricing,
    status      : 'active',
  };
}

export async function POST(req: NextRequest) {
  try {
    const { products } = await req.json();
    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products provided.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    // ── Tenant isolation: resolve the caller's brand and FORCE it on every row.
    // Inventory is scoped by brand_name; we never trust brand_name/brand_id from
    // the (AI/client-supplied) payload, or one brand could write as another.
    const { data: sf } = await sb
      .from('brand_storefronts')
      .select('brand_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!sf?.brand_name) {
      return NextResponse.json({ error: 'No brand storefront for this account — cannot import inventory.' }, { status: 403 });
    }
    const ownerBrand = sf.brand_name as string;

    const skippedErrors: string[] = [];
    const clean = (products as Record<string, unknown>[])
      .filter((p, idx) => {
        const sku = String(p.sku ?? '').trim();
        if (!sku) { skippedErrors.push(`Row ${idx + 1} "${p.description ?? 'Untitled'}" — missing SKU`); return false; }
        return true;
      })
      .map(p => {
        const row = sanitise(prepareRow({
          ...p,
          stock_total : Math.floor(Math.max(0, parseFloat(String(p.stock_total ?? p.stock ?? 0)) || 0)),
          moq         : Math.max(1, Math.floor(parseFloat(String(p.moq ?? 1)) || 1)),
          description : String(p.description ?? '').trim(),
          color       : String(p.color ?? '').trim(),
          gender      : String(p.gender ?? 'Unisex').trim(),
          season      : String(p.season ?? '').trim(),
          category    : String(p.category ?? 'GENERAL').trim(),
          image_urls  : Array.isArray(p.image_urls) ? p.image_urls : [],
          tags        : Array.isArray(p.tags) ? p.tags : [],
        }));
        row.brand_name = ownerBrand;   // forced — overrides any payload value
        delete row.brand_id;           // never set from payload (DB default applies)
        return row;
      });

    if (!clean.length) {
      return NextResponse.json({ error: 'All rows filtered out (missing SKUs).', skipped: skippedErrors }, { status: 400 });
    }

    let withSku = clean.filter(r => r.sku);

    // Reject zero/negative-price rows — never write a $0 product to the DB.
    withSku = withSku.filter(r => {
      const wsp = Number(r.wsp_usd) || 0;
      if (wsp > 0) return true;
      skippedErrors.push(`SKU ${r.sku} — missing or invalid price, skipped`);
      return false;
    });

    const errors: string[] = [...skippedErrors];

    // ── Reject SKUs that already belong to a DIFFERENT brand (sku is globally
    // unique). This prevents one brand's import from overwriting another's row.
    const skuList = withSku.map(r => r.sku as string);
    const { data: existing } = await sb
      .from('inventory')
      .select('sku, brand_name')
      .in('sku', skuList);
    const foreign = new Set(
      (existing ?? [])
        .filter((e: { sku: string; brand_name: string | null }) => e.brand_name && e.brand_name !== ownerBrand)
        .map((e: { sku: string }) => e.sku),
    );
    if (foreign.size) {
      withSku = withSku.filter(r => {
        if (foreign.has(r.sku as string)) { errors.push(`SKU ${r.sku} belongs to another brand — skipped`); return false; }
        return true;
      });
    }

    if (!withSku.length) {
      return NextResponse.json({ success: false, saved: 0, errors }, { status: 409 });
    }

    let inserted = 0;
    // Tenant-safe upsert. No destructive delete fallback — on error we surface it
    // rather than deleting rows (which previously could wipe other brands' SKUs).
    const { data, error } = await sb
      .from('inventory')
      .upsert(withSku, { onConflict: 'sku', ignoreDuplicates: false })
      .select('id');

    if (error) {
      errors.push(error.message);
    } else {
      inserted = data?.length ?? 0;
    }

    return NextResponse.json({ success: inserted > 0, saved: inserted, errors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
