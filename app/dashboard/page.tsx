import { redirect }        from 'next/navigation';
import { createClient }    from '@/lib/supabase/server';
import { getBuyerCatalog } from '@/lib/buyer-catalog';
import DashboardClient     from './DashboardClient';
import MFAEnrollmentGate  from './MFAEnrollmentGate';

export const revalidate = 60;

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return fallback;
}

export default async function BuyerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const rawRole = String(user.user_metadata?.role ?? user.app_metadata?.role ?? '');
  if (rawRole === 'brand') redirect('/dashboard/brand-store');

  // ── Mandatory MFA gate ───────────────────────────────────────────────────
  // VIP wholesale platform — every account must have a TOTP factor enrolled.
  // If the user has no verified factor, show the enrollment gate instead of
  // the full dashboard. Once enrolled they come back and see the dashboard.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = (factors?.totp ?? []).some(f => f.status === 'verified');
  if (!hasVerifiedFactor) {
    return <MFAEnrollmentGate email={user.email ?? ''} />;
  }

  // Fetch catalog + recent orders in parallel
  const [items, ordersResult] = await Promise.all([
    getBuyerCatalog(supabase, user.email ?? ''),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('buyer_orders')
      .select('id, status, payment_status, total_usd, created_at, items')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const rawOrders = (ordersResult.data ?? []) as Array<{
    id            : string;
    status        : string;
    payment_status: string | null;
    total_usd     : number;
    created_at    : string;
    items         : unknown[];
  }>;

  const recentOrders = rawOrders.map(o => ({
    id            : o.id,
    status        : o.status,
    payment_status: o.payment_status,
    total_usd     : Number(o.total_usd),
    created_at    : o.created_at,
    item_count    : Array.isArray(o.items) ? o.items.length : 0,
  }));

  const season = safeStr(items.find(i => i.season)?.season, 'SS 27');

  const ADMIN_EMAILS = ['hello@linezheets.com', 'info@mxlla.com'];
  const resolvedRole: 'buyer' | 'brand' | 'admin' =
    rawRole === 'admin' || ADMIN_EMAILS.includes(user.email ?? '') ? 'admin'
    : 'buyer';

  return (
    <DashboardClient
      user={{ email: user.email ?? null, createdAt: user.created_at ?? new Date().toISOString() }}
      items={items}
      recentOrders={recentOrders}
      season={season}
      role={resolvedRole}
    />
  );
}
