import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

// ── GET /api/products — brand's own products ──────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  let query = admin
    .from('inventory')
    .select('*')
    .eq('brand_name', sf.brand_name)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ products: data ?? [] });
}

// ── POST /api/products — create product ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name, user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const contentType = req.headers.get('content-type') ?? '';
  let body: Record<string, unknown> = {};
  let imageUrls: string[] = [];

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    for (const [key, val] of formData.entries()) {
      if (val instanceof File) {
        // Upload image to Supabase Storage
        const buffer = Buffer.from(await val.arrayBuffer());
        const path   = `products/${uuidv4()}-${val.name}`;
        const { error: upErr } = await admin.storage
          .from('product-images')
          .upload(path, buffer, { contentType: val.type, upsert: false });
        if (!upErr) {
          const { data: urlData } = admin.storage.from('product-images').getPublicUrl(path);
          imageUrls.push(urlData.publicUrl);
        }
      } else {
        try { body[key] = JSON.parse(val as string); } catch { body[key] = val; }
      }
    }
  } else {
    body = await req.json();
    if (Array.isArray(body.image_urls)) imageUrls = body.image_urls as string[];
  }

  const { title, sku, category = 'GENERAL', gender = 'UNISEX', season, wsp_usd, srp,
          color, color_hex, video_urls, sizes, stock_total = 0, description, delivery_window, tags, moq = 1 } = body as Record<string, unknown>;

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const { data, error } = await admin.from('inventory').insert({
    title         : String(title),
    sku           : sku ? String(sku) : null,
    category      : String(category).toUpperCase(),
    gender        : String(gender).toUpperCase(),
    season        : season ? String(season) : null,
    brand_name    : sf.brand_name,
    brand_id      : 1,
    wsp_usd       : wsp_usd ? Number(wsp_usd) : 0,
    srp           : srp     ? Number(srp)     : 0,
    color         : color   ? String(color)   : null,
    color_hex     : color_hex ? String(color_hex) : null,
    sizes         : (sizes && typeof sizes === 'object') ? sizes : {},
    stock_total   : Number(stock_total),
    image_urls    : imageUrls,
    video_urls    : Array.isArray(video_urls) ? video_urls : [],
    description   : description ? String(description) : null,
    delivery_window: delivery_window ? String(delivery_window) : null,
    tags          : Array.isArray(tags) ? tags : [],
    moq           : Number(moq),
    status        : 'active',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ product: data }, { status: 201 });
}
