import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReportsClient from './ReportsClient';

export const metadata = { title: 'Brand Reports — Linezheets' };

export default async function BrandReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  const role = user.user_metadata?.role ?? user.app_metadata?.role;
  if (role !== 'brand' && role !== 'admin') redirect('/dashboard');

  const { data: sf } = await supabase
    .from('brand_storefronts')
    .select('brand_name, display_name')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sf) redirect('/dashboard/brand-store');

  return (
    <div className="px-8 py-12 max-w-6xl mx-auto">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <p className="text-[7px] uppercase tracking-[0.5em] mb-3" style={{ color: '#bbb', fontFamily: 'system-ui' }}>
            Brand Reporting
          </p>
          <h1 style={{ fontFamily: 'var(--font-serif), Georgia, serif', fontSize: '28px', color: '#111', fontWeight: 400 }}>
            {sf.display_name}
          </h1>
        </div>
        <a href="/dashboard/brand-store"
           className="text-[7.5px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
           style={{ color: '#888', fontFamily: 'system-ui' }}>
          ← Brand Store
        </a>
      </div>
      <ReportsClient />
    </div>
  );
}
