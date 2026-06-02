// app/api/integrations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin'; // Your admin client from Step 2 of the last message

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 1. Fetch user-configured integrations (Existing Logic)
    const { data: userConfigs, error: configError } = await supabase
      .from('integration_configs')
      .select('platform, active, connected_at, last_sync_at, config, shop_domain, external_id')
      .eq('brand_id', user.id);

    if (configError) return NextResponse.json({ error: configError.message }, { status: 500 });

    // 2. Fetch global platform integrations catalog using the Admin Client (New Logic)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: globalIntegrations, error: globalError } = await (supabaseAdmin as any)
      .from('integrations')
      .select('*');

    if (globalError) return NextResponse.json({ error: globalError.message }, { status: 500 });

    // Return both so your front-end layout can map configured settings over the global options catalog
    return NextResponse.json({ 
      integrations: userConfigs ?? [],
      catalog: globalIntegrations ?? [] 
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── KEEP YOUR EXISTING POST AND DELETE ROUTINES COMPLETELY UNTOUCHED ──────────
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
