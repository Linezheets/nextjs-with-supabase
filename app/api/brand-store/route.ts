import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('brand_storefronts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ storefront: data ?? null });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { slug, display_name, brand_name, tagline, description, contact_email,
          instagram, website, custom_domain, published, theme } = body;

  if (!slug || !display_name || !brand_name) {
    return NextResponse.json({ error: 'slug, display_name and brand_name required' }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug may only contain lowercase letters, numbers and hyphens' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('brand_storefronts')
    .select('id, user_id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'That URL slug is already taken' }, { status: 409 });
  }

  const basePayload = {
    user_id: user.id, slug, display_name, brand_name,
    tagline, description, contact_email, instagram, website,
    custom_domain: custom_domain || null,
    published: published ?? false,
  };
  const payload = theme !== undefined ? { ...basePayload, theme } : basePayload;

  const { data, error } = await supabase
    .from('brand_storefronts')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ storefront: data });
}
