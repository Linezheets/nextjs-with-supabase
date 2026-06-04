import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { exchangeShopifyCode, getShopifyShopInfo, encryptToken } from '@/lib/integrations/shopify';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const base = `${appUrl}/dashboard/integrations`;

  const errorParam = searchParams.get('error');
  if (errorParam) {
    return NextResponse.redirect(`${base}?error=shopify_denied`);
  }

  const shop  = searchParams.get('shop');
  const code  = searchParams.get('code');
  const state = searchParams.get('state');

  if (!shop || !code || !state) {
    return NextResponse.redirect(`${base}?error=shopify_invalid`);
  }

  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString()) as {
      userId: string;
      shop: string;
      ts: number;
    };

    if (!parsed.userId) throw new Error('Missing userId in state');

    // State timestamp check — reject if older than 10 minutes
    if (Date.now() - parsed.ts > 10 * 60 * 1000) throw new Error('State expired');

    const token    = await exchangeShopifyCode(shop, code);
    const shopInfo = await getShopifyShopInfo(shop, token);

    const { error } = await supabaseAdmin
      .from('integration_configs')
      .upsert(
        {
          brand_id    : parsed.userId,
          platform    : 'shopify',
          access_token: encryptToken(token),
          shop_domain : shop,
          external_id : String(shopInfo.id),
          config      : { name: shopInfo.name, email: shopInfo.email, currency: shopInfo.currency },
          active      : true,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'brand_id,platform' }
      );

    if (error) throw new Error(error.message);

    return NextResponse.redirect(`${base}?connected=shopify`);
  } catch (err) {
    console.error('[shopify/callback]', err);
    return NextResponse.redirect(`${base}?error=shopify_failed`);
  }
}
