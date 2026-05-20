import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import QRCode from 'qrcode';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: event_id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ rsvp: null });

    const { data: rsvp } = await (supabase as any)
      .from('event_rsvps')
      .select('*')
      .eq('event_id', event_id)
      .eq('user_id', user.id)
      .single();

    if (!rsvp) return NextResponse.json({ rsvp: null });

    // Generate QR data URL if approved
    let qr_data_url: string | null = null;
    if (rsvp.qr_token && ['approved','checked_in'].includes(rsvp.status)) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
      const scanUrl = `${baseUrl}/fashionevents/scan/${event_id}?token=${rsvp.qr_token}`;
      qr_data_url = await QRCode.toDataURL(scanUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#07070E', light: '#F5F0E8' },
      });
    }

    return NextResponse.json({ rsvp: { ...rsvp, qr_data_url } });
  } catch {
    return NextResponse.json({ error: 'Failed to load RSVP' }, { status: 500 });
  }
}
