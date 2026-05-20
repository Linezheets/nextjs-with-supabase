import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DB_COLUMNS = new Set([
  'sku','description','color','gender','season','brand_name','category','material',
  'delivery_window','product_notes','wsp_usd','srp','cost','moq','stock_total',
  'sizes','tier_pricing','image_urls','tags','margin','status','brand_id',
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
  const wsp = parseFloat(String(p.wsp_usd ?? 0)) || 0;
  const srp = parseFloat(String(p.srp ?? 0)) || 0;
  const margin = parseFloat(String(p.margin ?? 0.5)) || 0.5;

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

    const skippedErrors: string[] = [];
    const clean = (products as Record<string, unknown>[])
      .filter((p, idx) => {
        const sku = String(p.sku ?? '').trim();
        if (!sku) { skippedErrors.push(`Row ${idx + 1} "${p.description ?? 'Untitled'}" — missing SKU`); return false; }
        return true;
      })
      .map(p => sanitise(prepareRow({
        ...p,
        stock_total : Math.floor(Math.max(0, parseFloat(String(p.stock_total ?? p.stock ?? 0)) || 0)),
        moq         : Math.max(1, Math.floor(parseFloat(String(p.moq ?? 1)) || 1)),
        description : String(p.description ?? '').trim(),
        color       : String(p.color ?? '').trim(),
        gender      : String(p.gender ?? 'Unisex').trim(),
        season      : String(p.season ?? '').trim(),
        category    : String(p.category ?? 'GENERAL').trim(),
        brand_name  : String(p.brand_name ?? '').trim(),
        image_urls  : Array.isArray(p.image_urls) ? p.image_urls : [],
        tags        : Array.isArray(p.tags) ? p.tags : [],
      })));

    if (!clean.length) {
      return NextResponse.json({ error: 'All rows filtered out (missing SKUs).', skipped: skippedErrors }, { status: 400 });
    }

    const withSku = clean.filter(r => r.sku);
    let inserted = 0;
    const errors: string[] = [...skippedErrors];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data, error } = await sb
      .from('inventory')
      .upsert(withSku, { onConflict: 'sku', ignoreDuplicates: false })
      .select('id');

    if (error) {
      // Fallback: manual delete + insert
      const skuList = withSku.map(r => r.sku as string);
      await sb.from('inventory').delete().in('sku', skuList);
      const { data: ins, error: insErr } = await sb.from('inventory').insert(withSku).select('id');
      if (insErr) errors.push(insErr.message);
      else inserted = ins?.length ?? 0;
    } else {
      inserted = data?.length ?? 0;
    }

    return NextResponse.json({ success: true, saved: inserted, errors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
