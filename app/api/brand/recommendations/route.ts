import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET  — list campaigns for the signed-in brand user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('brand_recommendation_campaigns')
    .select('*')
    .eq('brand_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data ?? [] });
}

// POST — create a new draft campaign
// Body: { name, subject, message?, product_ids, targeting? }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve brand_name from storefront
  const { data: sf } = await supabase
    .from('brand_storefronts')
    .select('brand_name, display_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const brand_name = sf?.brand_name || sf?.display_name || 'Brand';

  const { name, subject, message, product_ids, targeting } = await req.json();
  if (!name)              return NextResponse.json({ error: 'name required' },    { status: 400 });
  if (!subject)           return NextResponse.json({ error: 'subject required' }, { status: 400 });
  if (!product_ids?.length) return NextResponse.json({ error: 'product_ids required' }, { status: 400 });

  const { data, error } = await supabase
    .from('brand_recommendation_campaigns')
    .insert({
      brand_user_id: user.id,
      brand_name,
      name,
      subject,
      message: message ?? null,
      product_ids,
      targeting: targeting ?? {},
      status: 'draft',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data }, { status: 201 });
}

// PATCH — update a draft campaign
// Body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const allowed = ['name', 'subject', 'message', 'product_ids', 'targeting'];
  const update  = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('brand_recommendation_campaigns')
    .update(update)
    .eq('id', id)
    .eq('brand_user_id', user.id)
    .eq('status', 'draft')          // cannot edit sent campaigns
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}
