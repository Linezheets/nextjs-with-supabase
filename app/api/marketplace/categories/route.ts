import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('inventory')
    .select('category, season')
    .eq('status', 'active');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const categories = [...new Set((data ?? []).map(r => r.category).filter(Boolean))].sort();
  const seasons    = [...new Set((data ?? []).map(r => r.season).filter(Boolean))].sort();

  return NextResponse.json({ categories, seasons });
}
