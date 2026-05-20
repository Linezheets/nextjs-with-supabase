import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: event_id } = await params;
  try {
    const supabase = await createClient();
    const { count } = await (supabase as any)
      .from('event_interests')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id);

    const { data: { user } } = await supabase.auth.getUser();
    let my_interest = false;
    if (user) {
      const { data } = await (supabase as any)
        .from('event_interests')
        .select('id')
        .eq('event_id', event_id)
        .eq('user_id', user.id)
        .maybeSingle();
      my_interest = !!data;
    }

    return NextResponse.json({ count: count || 0, my_interest });
  } catch {
    return NextResponse.json({ count: 0, my_interest: false });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: event_id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    // Toggle interest
    const { data: existing } = await (supabase as any)
      .from('event_interests')
      .select('id')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await (supabase as any)
        .from('event_interests').delete()
        .eq('event_id', event_id).eq('user_id', user.id);
      return NextResponse.json({ interested: false });
    } else {
      await (supabase as any)
        .from('event_interests')
        .insert({ event_id, user_id: user.id });
      return NextResponse.json({ interested: true });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to toggle interest' }, { status: 500 });
  }
}
