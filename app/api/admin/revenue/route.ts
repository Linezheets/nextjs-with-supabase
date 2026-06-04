import { NextRequest, NextResponse } from 'next/server';;
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data, error } = await admin
    .from('buyer_payments')
    .select('amount_usd, status, created_at')
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payments = (data ?? []) as { amount_usd: number; created_at: string }[];

  // Group by month
  const byMonth: Record<string, { gmv: number; count: number }> = {};
  for (const p of payments) {
    const month = p.created_at.substring(0, 7); // "YYYY-MM"
    if (!byMonth[month]) byMonth[month] = { gmv: 0, count: 0 };
    byMonth[month].gmv   += Number(p.amount_usd);
    byMonth[month].count += 1;
  }

  const revenue = Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([month, { gmv, count }]) => ({
      month,
      gmv              : Math.round(gmv * 100) / 100,
      platform_revenue : Math.round(gmv * 0.03 * 100) / 100,
      order_count      : count,
    }));

  return NextResponse.json({ revenue });
}
