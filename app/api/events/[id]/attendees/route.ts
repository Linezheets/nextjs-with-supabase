import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AGENCY_EMAILS = ['info@mxlla.com'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: event_id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { data: event } = await (supabase as any)
      .from('showroom_events').select('created_by').eq('id', event_id).single();

    const isAgency = AGENCY_EMAILS.includes(user.email || '');
    if (!event || (event.created_by !== user.id && !isAgency)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    let q = (supabase as any)
      .from('event_rsvps')
      .select('*')
      .eq('event_id', event_id)
      .order('created_at', { ascending: true });

    if (statusFilter) q = q.eq('status', statusFilter);

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ attendees: data || [] });
  } catch {
    return NextResponse.json({ error: 'Failed to load attendees' }, { status: 500 });
  }
}
