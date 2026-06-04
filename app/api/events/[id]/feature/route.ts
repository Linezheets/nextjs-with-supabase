import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AGENCY_EMAILS = ['hello@linezheets.com'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !AGENCY_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { featured } = await req.json();
    const { data, error } = await (supabase as any)
      .from('showroom_events')
      .update({ featured: !!featured })
      .eq('id', id)
      .select('id, featured')
      .single();

    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch {
    return NextResponse.json({ error: 'Failed to update feature status' }, { status: 500 });
  }
}
