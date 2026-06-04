import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildShopifyAuthUrl, normalizeShopDomain } from '@/lib/integrations/shopify';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = req.nextUrl.searchParams.get('shop');
  if (!raw) return NextResponse.json({ error: 'shop parameter required' }, { status: 400 });

  const shop = normalizeShopDomain(raw);
  if (!shop.endsWith('.myshopify.com')) {
    return NextResponse.json({ error: 'Shop must be a .myshopify.com domain' }, { status: 400 });
  }

  const state = Buffer.from(
    JSON.stringify({ userId: user.id, shop, ts: Date.now() })
  ).toString('base64url');

  return NextResponse.json({ authUrl: buildShopifyAuthUrl(shop, state) });
}
