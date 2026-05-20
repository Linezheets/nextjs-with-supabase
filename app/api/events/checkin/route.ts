import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AGENCY_EMAILS = ['info@mxlla.com'];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const { event_id, qr_token } = await req.json();
    if (!event_id || !qr_token) {
      return NextResponse.json({ error: 'event_id and qr_token required' }, { status: 400 });
    }

    // Verify caller owns the event or is agency
    const { data: event } = await (supabase as any)
      .from('showroom_events').select('created_by, title').eq('id', event_id).single();
    const isAgency = AGENCY_EMAILS.includes(user.email || '');
    if (!event || (event.created_by !== user.id && !isAgency)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Lookup RSVP by token
    const { data: rsvp } = await (supabase as any)
      .from('event_rsvps')
      .select('*')
      .eq('event_id', event_id)
      .eq('qr_token', qr_token)
      .single();

    if (!rsvp) return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 });
    if (rsvp.status === 'checked_in') {
      return NextResponse.json({
        ok: false,
        already_checked_in: true,
        attendee: {
          name: rsvp.user_name,
          company: rsvp.company_name,
          type: rsvp.user_type,
          checked_in_at: rsvp.checked_in_at,
        },
      });
    }
    if (!['approved'].includes(rsvp.status)) {
      return NextResponse.json({ error: `RSVP status is ${rsvp.status}` }, { status: 400 });
    }

    const { data: updated, error } = await (supabase as any)
      .from('event_rsvps')
      .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
      .eq('id', rsvp.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      attendee: {
        name: updated.user_name,
        email: updated.user_email,
        company: updated.company_name,
        type: updated.user_type,
        checked_in_at: updated.checked_in_at,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Check-in failed' }, { status: 500 });
  }
}
