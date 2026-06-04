import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// ── GET /api/products/:id ─────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data, error } = await admin
    .from('inventory')
    .select('*')
    .eq('id', parseInt(id))
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  return NextResponse.json({ product: data });
}

// ── PATCH /api/products/:id ───────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Verify ownership via brand_name
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const ALLOWED = ['title','sku','category','gender','season','wsp_usd','srp','cost','margin',
                   'color','sizes','stock_total','image_urls','description','delivery_window',
                   'tags','moq','status','material','product_notes'];

  const body = await req.json() as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('inventory')
    .update(patch)
    .eq('id', parseInt(id))
    .eq('brand_name', sf.brand_name)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  return NextResponse.json({ product: data });
}

// ── DELETE /api/products/:id — archive ───────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const { error } = await admin
    .from('inventory')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', parseInt(id))
    .eq('brand_name', sf.brand_name);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: 'Product archived' });
}
