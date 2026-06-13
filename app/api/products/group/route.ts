import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

// A "product" in the Wix-parity editor is a GROUP of inventory rows — one per
// colourway — tied by style_id. Each row keeps its own sku + sizes JSONB, so the
// existing per-sku/per-size stock engine is untouched. This endpoint creates or
// reconciles the whole group in one call.

type Colorway = {
  id?        : string;
  color?     : string;
  color_hex? : string;
  sku?       : string;
  image_urls?: string[];
  video_urls?: string[];
  sizes?     : Record<string, number>;
};

function sizeSum(sizes?: Record<string, number>): number {
  if (!sizes || typeof sizes !== 'object') return 0;
  return Object.values(sizes).reduce((s, q) => s + (Number(q) || 0), 0);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const body = await req.json() as {
    style_id?: string;
    shared?: Record<string, unknown>;
    colorways?: Colorway[];
  };

  const shared    = body.shared ?? {};
  const colorways = Array.isArray(body.colorways) ? body.colorways : [];
  if (!shared.title)        return NextResponse.json({ error: 'title is required' }, { status: 400 });
  if (colorways.length === 0) return NextResponse.json({ error: 'at least one colourway is required' }, { status: 400 });

  const isEdit   = !!body.style_id;
  const style_id = body.style_id || randomUUID();

  // Fields shared across every colourway row in the group.
  const sharedCols = {
    title          : String(shared.title),
    category       : String(shared.category ?? 'GENERAL').toUpperCase(),
    gender         : String(shared.gender ?? 'UNISEX').toUpperCase(),
    season         : shared.season ? String(shared.season) : null,
    brand_name     : sf.brand_name,            // server-derived, never the client
    brand_id       : 1,
    wsp_usd        : shared.wsp_usd ? Number(shared.wsp_usd) : 0,
    srp            : shared.srp     ? Number(shared.srp)     : 0,
    description    : shared.description ? String(shared.description) : null,
    delivery_window: shared.delivery_window ? String(shared.delivery_window) : null,
    tags           : Array.isArray(shared.tags) ? shared.tags : [],
    moq            : shared.moq ? Number(shared.moq) : 1,
    status         : shared.status ? String(shared.status) : 'active',
    material       : shared.material ? String(shared.material) : null,
  };

  const submittedIds: string[] = [];
  const resultRows: unknown[] = [];

  for (const cw of colorways) {
    const sizes = (cw.sizes && typeof cw.sizes === 'object') ? cw.sizes : {};
    const row = {
      ...sharedCols,
      style_id,
      color      : cw.color ? String(cw.color) : null,
      color_hex  : cw.color_hex ? String(cw.color_hex) : null,
      sku        : cw.sku ? String(cw.sku) : null,
      image_urls : Array.isArray(cw.image_urls) ? cw.image_urls : [],
      video_urls : Array.isArray(cw.video_urls) ? cw.video_urls : [],
      sizes,
      stock_total: sizeSum(sizes),
    };

    if (cw.id) {
      const { data, error } = await admin
        .from('inventory')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', cw.id)
        .eq('brand_name', sf.brand_name)   // ownership guard
        .select()
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (data) { submittedIds.push(data.id); resultRows.push(data); }
    } else {
      const { data, error } = await admin.from('inventory').insert(row).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      submittedIds.push(data.id); resultRows.push(data);
    }
  }

  // On edit, archive any colourway rows that were removed from the group.
  if (isEdit) {
    const { data: existing } = await admin
      .from('inventory')
      .select('id')
      .eq('style_id', style_id)
      .eq('brand_name', sf.brand_name);
    const toArchive = (existing ?? [])
      .map((r: { id: string }) => r.id)
      .filter((id: string) => !submittedIds.includes(id));
    if (toArchive.length) {
      await admin.from('inventory')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .in('id', toArchive);
    }
  }

  return NextResponse.json({ style_id, products: resultRows }, { status: isEdit ? 200 : 201 });
}
