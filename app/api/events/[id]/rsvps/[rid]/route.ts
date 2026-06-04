import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

const AGENCY_EMAILS = ['hello@linezheets.com'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; rid: string }> }
) {
  const { id: event_id, rid } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    // Verify ownership
    const { data: event } = await (supabase as any)
      .from('showroom_events').select('created_by').eq('id', event_id).single();
    const isAgency = AGENCY_EMAILS.includes(user.email || '');
    if (!event || (event.created_by !== user.id && !isAgency)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { status, host_notes } = await req.json();
    const allowed = ['approved','declined','waitlisted','checked_in'];
    if (!allowed.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const patch: Record<string, any> = { status };
    if (host_notes !== undefined) patch.host_notes = host_notes;

    // Generate QR token on approval
    if (status === 'approved') {
      const { data: existing } = await (supabase as any)
        .from('event_rsvps').select('qr_token').eq('id', rid).single();
      if (!existing?.qr_token) patch.qr_token = uuidv4();
    }
    if (status === 'checked_in') {
      patch.checked_in_at = new Date().toISOString();
    }

    const { data, error } = await (supabase as any)
      .from('event_rsvps').update(patch).eq('id', rid).select().single();
    if (error) throw error;

    return NextResponse.json({ rsvp: data });
  } catch {
    return NextResponse.json({ error: 'Failed to update RSVP' }, { status: 500 });
  }
}
