import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AGENCY_EMAILS = ['info@linezheets.com'];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await (supabase as any)
      .from('showroom_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner  = user && data.created_by === user.id;
    const isAgency = user && AGENCY_EMAILS.includes(user.email || '');
    const visible  = ['approved','live','past'].includes(data.status);

    if (!visible && !isOwner && !isAgency) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const [{ count: interestCount }, { count: rsvpCount }] = await Promise.all([
      (supabase as any)
        .from('event_interests')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id),
      (supabase as any)
        .from('event_rsvps')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id)
        .in('status', ['approved', 'checked_in']),
    ]);

    return NextResponse.json({
      event: { ...data, interest_count: interestCount || 0, rsvp_count: rsvpCount || 0 },
      can_manage: isOwner || isAgency,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to load event' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { data: event } = await (supabase as any)
      .from('showroom_events').select('created_by').eq('id', id).single();
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAgency = AGENCY_EMAILS.includes(user.email || '');
    if (event.created_by !== user.id && !isAgency) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    // strip fields only agency can set
    if (!isAgency) { delete body.status; delete body.featured; }

    const { data, error } = await (supabase as any)
      .from('showroom_events').update(body).eq('id', id).select().single();
    if (error) throw error;

    return NextResponse.json({ event: data });
  } catch {
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { data: event } = await (supabase as any)
      .from('showroom_events').select('created_by').eq('id', id).single();
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isAgency = AGENCY_EMAILS.includes(user.email || '');
    if (event.created_by !== user.id && !isAgency) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await (supabase as any)
      .from('showroom_events').update({ status: 'cancelled' }).eq('id', id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to cancel event' }, { status: 500 });
  }
}
