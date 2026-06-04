import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin  = createAdminClient() as any;
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '100'), 500);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  let query = admin
    .from('buyer_orders')
    .select('id, buyer_id, buyer_name, status, payment_status, total_usd, currency, created_at, items')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [] });
}
