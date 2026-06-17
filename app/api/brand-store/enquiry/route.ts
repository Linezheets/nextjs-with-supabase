import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { notifyStorefrontEnquiry } from '@/lib/storefront-enquiry-email';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { slug, inventory_id, name, email, message } = await req.json();

  if (!slug || !name || !email) {
    return NextResponse.json({ error: 'slug, name and email required' }, { status: 400 });
  }

  const { data: sf } = await supabase
    .from('brand_storefronts')
    .select('id, brand_name, contact_email, user_id')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle() as { data: { id: string; brand_name: string | null; contact_email: string | null; user_id: string | null } | null };

  if (!sf) return NextResponse.json({ error: 'Storefront not found' }, { status: 404 });

  const { error } = await supabase
    .from('brand_storefront_enquiries')
    .insert({ storefront_id: sf.id, inventory_id: inventory_id ?? null, name, email, message: message ?? null });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify the brand owner (non-blocking).
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    await notifyStorefrontEnquiry(admin, {
      ownerEmail : sf.contact_email,
      ownerUserId: sf.user_id,
      storeName  : sf.brand_name ?? 'your storefront',
      from       : { name, email, message },
    });
  } catch (e) { console.error('[brand-store/enquiry] notify failed', e); }

  return NextResponse.json({ success: true });
}
