import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';

type Params = { params: Promise<{ id: string }> };

const VALID_TYPES = ['hide_category', 'hide_brand', 'hide_sku', 'show_only_category', 'show_only_brand'];

// GET  /api/admin/buyers/:id/visibility
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const supabase = await createClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from('buyer_visibility_rules')
    .select('*')
    .eq('buyer_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

// POST  /api/admin/buyers/:id/visibility
// Body: { rule_type, target, note? }
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const supabase = await createClient();
  const { id } = await params;
  const { rule_type, target, note } = await req.json();

  if (!rule_type || !VALID_TYPES.includes(rule_type)) {
    return NextResponse.json({ error: 'Invalid rule_type' }, { status: 400 });
  }
  if (!target) return NextResponse.json({ error: 'target required' }, { status: 400 });

  const { data, error } = await supabase
    .from('buyer_visibility_rules')
    .insert({ buyer_id: id, rule_type, target, note: note ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}

// PATCH  /api/admin/buyers/:id/visibility
// Body: { rule_id, active?, note? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const supabase = await createClient();
  const { id } = await params;
  const { rule_id, active, note } = await req.json();
  if (!rule_id) return NextResponse.json({ error: 'rule_id required' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (active  !== undefined) update.active = active;
  if (note    !== undefined) update.note   = note;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('buyer_visibility_rules')
    .update(update)
    .eq('id', rule_id)
    .eq('buyer_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

// DELETE  /api/admin/buyers/:id/visibility?rule_id=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const supabase = await createClient();
  const { id } = await params;
  const rule_id = req.nextUrl.searchParams.get('rule_id');
  if (!rule_id) return NextResponse.json({ error: 'rule_id required' }, { status: 400 });

  const { error } = await supabase
    .from('buyer_visibility_rules')
    .delete()
    .eq('id', rule_id)
    .eq('buyer_id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
