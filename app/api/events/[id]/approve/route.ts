import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AGENCY_EMAILS = ['info@linezheets.com'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !AGENCY_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { action, rejection_reason } = await req.json(); // action: 'approve' | 'reject'
    const status = action === 'approve' ? 'approved' : 'cancelled';

    const { data, error } = await (supabase as any)
      .from('showroom_events')
      .update({ status, ...(rejection_reason ? { description: rejection_reason } : {}) })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch {
    return NextResponse.json({ error: 'Failed to update event status' }, { status: 500 });
  }
}
