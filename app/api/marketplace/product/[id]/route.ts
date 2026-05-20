import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/supabase/bearer';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await getUserFromRequest(req);
  const { id } = await params;

  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', Number(id))
    .single();

  if (error || !data) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  return NextResponse.json({ product: data });
}
