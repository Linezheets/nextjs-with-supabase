import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';

const VALID = ['active', 'suspended', 'trialing', 'canceled'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const { status } = await req.json() as { status: string };

  if (!VALID.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Choose: ${VALID.join(', ')}` }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const now   = new Date().toISOString();

  const { error } = await admin
    .from('brand_storefronts')
    .update({ subscription_status: status, updated_at: now })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: `Brand status set to ${status}` });
}
