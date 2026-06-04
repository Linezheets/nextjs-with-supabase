import { NextRequest, NextResponse } from 'next/server';;
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createClient } from '@/lib/supabase/server';

// GET /api/admin/buyers — list buyers, optionally filtered by ?status=pending
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const supabase    = await createClient();
  const { searchParams } = req.nextUrl;
  const status      = searchParams.get('status'); // e.g. pending, active, rejected

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from('buyers')
    .select('id, email, store_name, first_name, last_name, country, store_type, market_segment, created_at, onboarded_at, status')
    .order('onboarded_at', { ascending: false });

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ buyers: data ?? [] });
}
