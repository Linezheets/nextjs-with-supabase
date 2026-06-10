import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Brand pricing defaults persisted in brand_storefronts.pricing_settings.
// (The Margin Settings screen previously PATCHed this nonexistent route, so
//  nothing was ever saved.)

const ALLOWED_CURRENCIES = ['USD', 'EUR', 'GBP', 'HKD', 'JPY', 'CNY'];
// Standard Incoterms 2020 — used as the default on customs invoices.
const ALLOWED_INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];

type Settings = {
  default_margin_pct?: number;
  min_margin_pct?    : number;
  target_markup?     : number;
  currency?          : string;
  payment_terms_days?: number;
  incoterms?         : string;
  discount_tiers?    : { min_order: number; discount_pct: number }[];
};

const clampPct = (n: unknown) => Math.min(100, Math.max(0, Number(n) || 0));

function sanitise(input: Record<string, unknown>): Settings {
  const out: Settings = {};
  if (input.default_margin_pct !== undefined) out.default_margin_pct = clampPct(input.default_margin_pct);
  if (input.min_margin_pct     !== undefined) out.min_margin_pct     = clampPct(input.min_margin_pct);
  if (input.target_markup      !== undefined) out.target_markup      = Math.max(0, Number(input.target_markup) || 0);
  if (input.payment_terms_days !== undefined) out.payment_terms_days = Math.max(0, Math.floor(Number(input.payment_terms_days) || 0));
  if (typeof input.currency === 'string' && ALLOWED_CURRENCIES.includes(input.currency)) out.currency = input.currency;
  if (typeof input.incoterms === 'string' && ALLOWED_INCOTERMS.includes(input.incoterms.toUpperCase())) out.incoterms = input.incoterms.toUpperCase();
  if (Array.isArray(input.discount_tiers)) {
    out.discount_tiers = (input.discount_tiers as Record<string, unknown>[])
      .map(t => ({ min_order: Math.max(0, Number(t.min_order) || 0), discount_pct: clampPct(t.discount_pct) }))
      .filter(t => t.min_order > 0);
  }
  return out;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('pricing_settings')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });
  return NextResponse.json({ settings: sf.pricing_settings ?? {} });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const settings = sanitise(body);
  if (settings.min_margin_pct !== undefined && settings.default_margin_pct !== undefined
      && settings.min_margin_pct > settings.default_margin_pct) {
    return NextResponse.json({ error: 'Minimum margin cannot exceed default margin' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Merge into any existing settings so a partial PATCH doesn't wipe other keys.
  const { data: existing } = await admin
    .from('brand_storefronts')
    .select('pricing_settings')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Brand storefront not found' }, { status: 404 });

  const merged = { ...(existing.pricing_settings ?? {}), ...settings };

  const { error } = await admin
    .from('brand_storefronts')
    .update({ pricing_settings: merged, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, settings: merged });
}
