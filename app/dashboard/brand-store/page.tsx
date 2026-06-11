import { redirect }      from 'next/navigation';
import { createClient }  from '@/lib/supabase/server';

export const metadata = { title: 'Overview — Brand Studio' };
export const revalidate = 30;

const GOLD  = '#c9a84c';
const SERIF = 'var(--font-serif), Georgia, serif';
const SANS  = 'system-ui, -apple-system, sans-serif';

function money(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

type OrderRow = { id: string; buyer_name: string | null; status: string; items: unknown; created_at: string };
type Sf = { brand_name?: string; display_name?: string; slug?: string; published?: boolean } | null;

export default async function BrandOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const role = user.user_metadata?.role ?? user.app_metadata?.role;
  if (role !== 'brand' && role !== 'admin') redirect('/dashboard');

  const { data } = await supabase
    .from('brand_storefronts')
    .select('brand_name, display_name, slug, published')
    .eq('user_id', user.id)
    .maybeSingle();
  const sf = data as Sf;

  const brandName   = sf?.brand_name ?? '';
  const displayName = sf?.display_name || brandName || 'your brand';
  const published   = !!sf?.published;
  const slug        = sf?.slug ?? '';

  // ── First run: brand identity not set yet ───────────────────────────────────
  if (!brandName) {
    return (
      <div className="px-8 py-20 max-w-2xl mx-auto" style={{ fontFamily: SANS }}>
        <p className="text-[7px] uppercase tracking-[0.5em] mb-3" style={{ color: GOLD }}>Brand Dashboard</p>
        <h1 style={{ fontFamily: SERIF, fontSize: 32, color: '#111', fontWeight: 400, lineHeight: 1.1 }}>
          Welcome to Brand Studio
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed" style={{ color: '#777', maxWidth: 460 }}>
          First, set your brand name (it must match your inventory exactly) so we can connect your
          products, orders and storefront. It only takes a minute.
        </p>
        <a href="/dashboard/brand-store/storefront"
           className="inline-block mt-8 px-9 py-3 text-[8.5px] uppercase tracking-[0.5em] text-white"
           style={{ background: '#111' }}>
          Complete Brand Setup →
        </a>
      </div>
    );
  }

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const [{ count: productCount }, ordersRes] = await Promise.all([
    supabase.from('inventory').select('id', { count: 'exact', head: true })
      .eq('brand_name', brandName).eq('status', 'active'),
    supabase.from('buyer_orders')
      .select('id, buyer_name, status, items, created_at')
      .filter('items', 'cs', JSON.stringify([{ brand_name: brandName }]))
      .order('created_at', { ascending: false }),
  ]);

  const orders = (ordersRes.data ?? []) as OrderRow[];
  const orderValue = orders.reduce((sum, o) => {
    const items = Array.isArray(o.items) ? o.items as Record<string, unknown>[] : [];
    return sum + items
      .filter(i => i.brand_name === brandName)
      .reduce((s, i) => s + Number(i.wholesale_price ?? i.wsp_usd ?? 0) * Number(i.qty ?? i.total_qty ?? 1), 0);
  }, 0);

  const kpis = [
    { label: 'Products',    value: String(productCount ?? 0),    href: '/dashboard/brand-store/products' },
    { label: 'Orders',      value: String(orders.length),        href: '/dashboard/brand-store/orders'   },
    { label: 'Order Value', value: money(orderValue),            href: '/dashboard/brand-store/reports'  },
    { label: 'B2C Store',   value: published ? 'Live' : 'Draft', href: '/dashboard/brand-store/storefront' },
  ];

  const actions = [
    { label: 'Add a Product',  href: '/dashboard/brand-store/products' },
    { label: 'AI Mass Upload', href: '/dashboard/brand-store/ai-tools' },
    { label: 'Manage Orders',  href: '/dashboard/brand-store/orders'   },
    { label: 'Edit B2C Store', href: '/dashboard/brand-store/storefront' },
  ];

  const recent = orders.slice(0, 6);

  return (
    <div className="px-8 py-12 max-w-6xl mx-auto" style={{ fontFamily: SANS }}>

      {/* Header */}
      <div className="mb-10">
        <p className="text-[7px] uppercase tracking-[0.5em] mb-3" style={{ color: GOLD }}>Brand Dashboard</p>
        <h1 style={{ fontFamily: SERIF, fontSize: 30, color: '#111', fontWeight: 400, lineHeight: 1.1 }}>
          Welcome back, {displayName}
        </h1>
        <p className="mt-2 text-[12px]" style={{ color: '#999' }}>Here&apos;s how {brandName} is doing on Linezheets.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 border-t border-l" style={{ borderColor: '#eee' }}>
        {kpis.map(k => (
          <a key={k.label} href={k.href}
             className="group border-r border-b px-6 py-7 hover:bg-white transition-colors"
             style={{ borderColor: '#eee' }}>
            <p className="text-[7.5px] uppercase tracking-[0.4em] mb-3" style={{ color: '#aaa' }}>{k.label}</p>
            <p style={{ fontFamily: SERIF, fontSize: 30, color: '#111', fontWeight: 400 }}>{k.value}</p>
            <p className="text-[7.5px] uppercase tracking-[0.3em] mt-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: GOLD }}>View →</p>
          </a>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-10">
        <p className="text-[7.5px] uppercase tracking-[0.4em] mb-4" style={{ color: '#bbb' }}>Quick Actions</p>
        <div className="flex flex-wrap gap-3">
          {actions.map(a => (
            <a key={a.label} href={a.href}
               className="px-6 py-3 border text-[8px] uppercase tracking-[0.35em] hover:border-zinc-800 hover:bg-white transition-colors"
               style={{ borderColor: '#ddd', color: '#444' }}>
              {a.label}
            </a>
          ))}
        </div>
      </div>

      {/* Recent orders + B2C store */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-12">

        {/* Recent orders */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[7.5px] uppercase tracking-[0.4em]" style={{ color: '#bbb' }}>Recent Orders</p>
            <a href="/dashboard/brand-store/orders" className="text-[7.5px] uppercase tracking-[0.3em] hover:opacity-60" style={{ color: GOLD }}>All orders →</a>
          </div>
          {recent.length === 0 ? (
            <div className="border border-dashed px-6 py-14 text-center" style={{ borderColor: '#e5e5e5' }}>
              <p className="text-[12px]" style={{ color: '#bbb' }}>No orders yet — they&apos;ll appear here as buyers purchase from {brandName}.</p>
            </div>
          ) : (
            <div className="border-t" style={{ borderColor: '#eee' }}>
              {recent.map(o => (
                <a key={o.id} href="/dashboard/brand-store/orders"
                   className="flex items-center justify-between px-1 py-4 border-b hover:bg-white transition-colors"
                   style={{ borderColor: '#f0f0f0' }}>
                  <div>
                    <p className="text-[12px]" style={{ color: '#222' }}>{o.buyer_name || 'Buyer'}</p>
                    <p className="text-[8px] uppercase tracking-[0.25em] mt-1" style={{ color: '#bbb' }}>
                      {new Date(o.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <span className="text-[7.5px] uppercase tracking-[0.3em] px-3 py-1" style={{ color: '#888', background: '#f4f4f2' }}>{o.status}</span>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* B2C store card */}
        <section>
          <p className="text-[7.5px] uppercase tracking-[0.4em] mb-5" style={{ color: '#bbb' }}>B2C Store</p>
          <div className="border p-6" style={{ borderColor: '#eee', background: '#fff' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: published ? '#52b788' : '#ccc' }} />
              <p className="text-[8px] uppercase tracking-[0.35em]" style={{ color: published ? '#52b788' : '#aaa' }}>{published ? 'Live' : 'Draft'}</p>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: '#777' }}>
              {published
                ? 'Your retail storefront is public — buyers can shop your SRP catalogue.'
                : 'Open a public, retail-facing storefront from your catalogue. Optional, with custom-domain support.'}
            </p>
            {published && slug && (
              <a href={`/brand/${slug}`} target="_blank" rel="noreferrer" className="block mt-3 text-[11px] hover:opacity-60" style={{ color: GOLD }}>
                linezheets.com/brand/{slug} ↗
              </a>
            )}
            <a href="/dashboard/brand-store/storefront"
               className="inline-block mt-5 px-6 py-2.5 text-[8px] uppercase tracking-[0.4em] text-white"
               style={{ background: '#111' }}>
              {published ? 'Manage Store' : 'Set Up Store'}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
