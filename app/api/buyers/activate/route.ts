import { NextRequest, NextResponse }        from 'next/server';
import { createClient }                    from '@/lib/supabase/server';
import { encryptBuyerPii }                 from '@/lib/crypto/pii';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    first_name, last_name, phone,
    store_address, city, country, store_url,
    instagram, tiktok, linkedin, other_socials,
    store_type, categories_sold,
    price_range_min, price_range_max,
    market_segment, annual_buy_budget,
  } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    status      : 'active',
    onboarded_at: new Date().toISOString(),
    first_name  : first_name   ?? null,
    last_name   : last_name    ?? null,
    phone       : phone        ?? null,
    store_address,
    city        : city         ?? null,
    country     : country      ?? 'US',
    store_url   : store_url    ?? null,
    instagram   : instagram    ?? null,
    tiktok      : tiktok       ?? null,
    linkedin    : linkedin     ?? null,
    other_socials,
    store_type  : store_type   ?? null,
    categories_sold : Array.isArray(categories_sold) ? categories_sold : [],
    price_range_min : price_range_min ? Number(price_range_min) : null,
    price_range_max : price_range_max ? Number(price_range_max) : null,
    market_segment  : market_segment  ?? null,
    annual_buy_budget: annual_buy_budget ? Number(annual_buy_budget) : null,
  };

  // Remove undefined values
  Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

  // Use raw upsert via rpc-style cast to bypass strict Insert types (id is PK)
  // CIS 3: encrypt PII before writing to DB
  const encryptedUpdates = encryptBuyerPii(updates as Partial<{ phone: string | null; store_address: string | null }>);
  const payload = { id: user.id, email: user.email!, store_name: user.user_metadata?.store_name ?? '', ...encryptedUpdates };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: buyer, error } = await (supabase.from('buyers') as any)
    .upsert(payload)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ buyer, message: 'Profile activated' });
}
