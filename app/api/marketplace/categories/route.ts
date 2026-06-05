import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  // Invite-only platform — require authenticated session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  void req;

  const { data, error } = await supabase
    .from('inventory')
    .select('category, season')
    .eq('status', 'active');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const categories = [...new Set((data ?? []).map(r => r.category).filter(Boolean))].sort();
  const seasons    = [...new Set((data ?? []).map(r => r.season).filter(Boolean))].sort();

  return NextResponse.json({ categories, seasons });
}
