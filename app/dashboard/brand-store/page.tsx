import { redirect }        from 'next/navigation';
import { createClient }   from '@/lib/supabase/server';
import BrandStoreClient   from './BrandStoreClient';
import MFAEnrollmentGate  from '@/app/dashboard/MFAEnrollmentGate';

export const metadata = { title: 'Brand Store — Linezheets' };

export default async function BrandStorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Only brand or admin users may access this section
  const role = user.user_metadata?.role ?? user.app_metadata?.role;
  if (role !== 'brand' && role !== 'admin') redirect('/dashboard');

  // ── Mandatory MFA gate ───────────────────────────────────────────────────
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasVerifiedFactor = (factors?.totp ?? []).some(f => f.status === 'verified');
  if (!hasVerifiedFactor) {
    return <MFAEnrollmentGate email={user.email ?? ''} />;
  }

  const sfRes = await supabase.from('brand_storefronts').select('*').eq('user_id', user.id).maybeSingle();

  // Filter inventory to this brand's own products only (matched by brand_name)
  let inventoryQuery = supabase
    .from('inventory')
    .select('id,title,brand_name,srp,image_urls,category,color,season')
    .eq('status', 'active');
  if (sfRes.data?.brand_name) {
    inventoryQuery = inventoryQuery.eq('brand_name', sfRes.data.brand_name);
  }
  const inventoryRes = await inventoryQuery;

  let initialPublished: { id: string; inventory_id: number; consumer_price: number | null; featured: boolean; published: boolean }[] = [];
  if (sfRes.data) {
    const { data } = await supabase
      .from('brand_storefront_products')
      .select('id,inventory_id,consumer_price,featured,published')
      .eq('storefront_id', sfRes.data.id);
    initialPublished = data ?? [];
  }

  return (
    <div className="px-8 py-12 max-w-6xl mx-auto">
      <div className="mb-12">
        <p className="text-[7px] uppercase tracking-[0.5em] mb-3" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
          Brand Storefront
        </p>
        <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '28px', color: '#111', fontWeight: 400 }}>
          Your Consumer Store
        </h1>
        <p className="mt-2 text-[12px]" style={{ color: '#888', fontFamily: 'system-ui' }}>
          Launch a retail-facing storefront showing only your SRP prices — no wholesale data exposed.
        </p>
      </div>

      <BrandStoreClient
        initialStorefront={sfRes.data ?? null}
        inventory={(inventoryRes.data ?? []) as Parameters<typeof BrandStoreClient>[0]['inventory']}
        initialPublished={initialPublished}
      />
    </div>
  );
}
