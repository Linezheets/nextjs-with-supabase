import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * DELETE /api/brand-store/api-keys/{id} — revoke one of the brand's keys.
 * Scoped to the caller's storefront so a brand can only revoke its own keys.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: sf } = await supabase
    .from('brand_storefronts').select('id').eq('user_id', user.id).maybeSingle();
  if (!sf?.id) return NextResponse.json({ error: 'No storefront' }, { status: 400 });

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('account_id', sf.id)        // ownership check
    .eq('account_type', 'brand');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
