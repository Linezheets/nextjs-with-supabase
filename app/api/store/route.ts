import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET  — fetch current user's storefront
// POST — create or update storefront

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabase
    .from('buyer_storefronts')
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
  const { slug, name, tagline, description, accent_color, contact_email, instagram, website, published } = body;

  if (!slug || !name) return NextResponse.json({ error: 'slug and name required' }, { status: 400 });

  // Validate slug
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug may only contain lowercase letters, numbers and hyphens' }, { status: 400 });
  }

  // Check slug uniqueness (excluding own row)
  const { data: existing } = await supabase
    .from('buyer_storefronts')
    .select('id, user_id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing && existing.user_id !== user.id) {
    return NextResponse.json({ error: 'That URL slug is already taken' }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('buyer_storefronts')
    .upsert({
      user_id: user.id,
      slug, name, tagline, description, accent_color,
      contact_email, instagram, website,
      published: published ?? false,
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ storefront: data });
}
