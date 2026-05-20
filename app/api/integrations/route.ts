import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('integration_configs')
    .select('platform, active, connected_at, last_sync_at, config, shop_domain, external_id')
    .eq('brand_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ integrations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { platform, access_token, shop_domain, external_id, config } = body;

  if (!platform) return NextResponse.json({ error: 'platform required' }, { status: 400 });

  const { data, error } = await supabase
    .from('integration_configs')
    .upsert({
      brand_id: user.id,
      platform,
      access_token: access_token ?? null,
      shop_domain: shop_domain ?? null,
      external_id: external_id ?? null,
      config: config ?? {},
      active: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,platform' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ integration: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');
  if (!platform) return NextResponse.json({ error: 'platform required' }, { status: 400 });

  const { error } = await supabase
    .from('integration_configs')
    .delete()
    .eq('brand_id', user.id)
    .eq('platform', platform);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
