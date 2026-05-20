import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: event_id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

    const body = await req.json();
    const { user_name, user_type, company_name, notes } = body;

    // Check event exists and accepts RSVPs
    const { data: event } = await (supabase as any)
      .from('showroom_events')
      .select('id, status, capacity, is_public, title')
      .eq('id', event_id)
      .single();

    if (!event || !['approved','live'].includes(event.status)) {
      return NextResponse.json({ error: 'Event not available for RSVP' }, { status: 400 });
    }

    // Check capacity if set
    if (event.capacity) {
      const { count } = await (supabase as any)
        .from('event_rsvps')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event_id)
        .in('status', ['approved','checked_in']);

      if ((count || 0) >= event.capacity) {
        // Auto-waitlist
        const { data, error } = await (supabase as any)
          .from('event_rsvps')
          .upsert({
            event_id, user_id: user.id, user_email: user.email,
            user_name: user_name || user.user_metadata?.full_name || '',
            user_type: user_type || 'buyer',
            company_name, notes, status: 'waitlisted',
          }, { onConflict: 'event_id,user_email' })
          .select().single();
        if (error) throw error;
        return NextResponse.json({ rsvp: data, status: 'waitlisted' });
      }
    }

    // Public events: auto-approve and generate QR token
    const autoApprove = event.is_public;
    const qr_token    = autoApprove ? uuidv4() : null;

    const { data, error } = await (supabase as any)
      .from('event_rsvps')
      .upsert({
        event_id, user_id: user.id, user_email: user.email,
        user_name: user_name || user.user_metadata?.full_name || '',
        user_type: user_type || 'buyer',
        company_name, notes,
        status: autoApprove ? 'approved' : 'pending',
        qr_token,
      }, { onConflict: 'event_id,user_email' })
      .select().single();

    if (error) throw error;
    return NextResponse.json({ rsvp: data, status: data.status }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to submit RSVP' }, { status: 500 });
  }
}
