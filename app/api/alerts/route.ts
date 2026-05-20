import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET  — fetch unread alerts + prefs
// PATCH — mark alert(s) read
// PUT  — update alert prefs

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [alertsRes, prefsRes] = await Promise.all([
    supabase
      .from('buyer_alerts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('buyer_alert_prefs')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    alerts : alertsRes.data ?? [],
    prefs  : prefsRes.data ?? { email_alerts: true, in_app_alerts: true, alert_on: ['new_stock','price_change','promotion','new_collection'] },
    unread : (alertsRes.data ?? []).filter((a: { read: boolean }) => !a.read).length,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { alert_ids } = await req.json(); // array of ids, or 'all'

  let query = supabase.from('buyer_alerts').update({ read: true }).eq('user_id', user.id);
  if (Array.isArray(alert_ids)) query = query.in('id', alert_ids);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  const { error } = await supabase
    .from('buyer_alert_prefs')
    .upsert({ user_id: user.id, ...body, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
