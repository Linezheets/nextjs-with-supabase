import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

// GET  /api/admin/buyers/:id/rules  — list pricing rules for a buyer
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase
    .from('buyer_pricing_rules')
    .select('*')
    .eq('buyer_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

// POST  /api/admin/buyers/:id/rules  — create a pricing rule
// Body: { rule_type, target?, discount_pct?, fixed_price?, note? }
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { rule_type, target, discount_pct, fixed_price, note } = body;

  if (!rule_type) return NextResponse.json({ error: 'rule_type required' }, { status: 400 });
  if (!['global', 'category', 'brand', 'sku'].includes(rule_type)) {
    return NextResponse.json({ error: 'Invalid rule_type' }, { status: 400 });
  }
  if (discount_pct == null && fixed_price == null) {
    return NextResponse.json({ error: 'discount_pct or fixed_price required' }, { status: 400 });
  }
  if (rule_type !== 'global' && !target) {
    return NextResponse.json({ error: 'target required for non-global rules' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('buyer_pricing_rules')
    .insert({ buyer_id: id, rule_type, target: target ?? null, discount_pct: discount_pct ?? null, fixed_price: fixed_price ?? null, note: note ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}

// PATCH  /api/admin/buyers/:id/rules  — update a rule
// Body: { rule_id, ...fields }
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { rule_id, ...fields } = await req.json();
  if (!rule_id) return NextResponse.json({ error: 'rule_id required' }, { status: 400 });

  const allowed = ['rule_type', 'target', 'discount_pct', 'fixed_price', 'active', 'note'];
  const update = Object.fromEntries(
    Object.entries(fields).filter(([k]) => allowed.includes(k))
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('buyer_pricing_rules')
    .update(update)
    .eq('id', rule_id)
    .eq('buyer_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

// DELETE  /api/admin/buyers/:id/rules?rule_id=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rule_id = req.nextUrl.searchParams.get('rule_id');
  if (!rule_id) return NextResponse.json({ error: 'rule_id required' }, { status: 400 });

  const { error } = await supabase
    .from('buyer_pricing_rules')
    .delete()
    .eq('id', rule_id)
    .eq('buyer_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
