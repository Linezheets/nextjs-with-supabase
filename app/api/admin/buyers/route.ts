import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';
import { createClient } from '@/lib/supabase/server';

// GET /api/admin/buyers — list all buyers (id, email, store_name, status)
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('buyers')
    .select('id, email, store_name, status')
    .order('store_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ buyers: data ?? [] });
}
