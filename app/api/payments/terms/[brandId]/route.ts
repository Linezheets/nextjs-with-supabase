import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ brandId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { brandId } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data } = await admin
    .from('brand_payment_terms')
    .select('*')
    .eq('brand_name', brandId)
    .maybeSingle();

  return NextResponse.json(data ?? {
    brand_name       : brandId,
    payment_methods  : ['card'],
    flow             : 'immediate',
    deadline_days    : null,
    installment_count: 2,
    installment_days : 30,
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle() as { data: { brand_name: string } | null };

  if (!sf || sf.brand_name !== brandId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { payment_methods, flow, deadline_days, installment_count, installment_days } = body;

  const { data, error } = await admin
    .from('brand_payment_terms')
    .upsert(
      {
        brand_name       : brandId,
        payment_methods  : payment_methods ?? ['card'],
        flow             : flow ?? 'immediate',
        deadline_days    : deadline_days ?? null,
        installment_count: installment_count ?? 2,
        installment_days : installment_days ?? 30,
        updated_at       : new Date().toISOString(),
      },
      { onConflict: 'brand_name' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
