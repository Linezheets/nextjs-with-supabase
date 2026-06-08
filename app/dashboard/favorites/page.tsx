import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardNav from '@/components/DashboardNav';
import FavoritesClient from './FavoritesClient';

export const metadata = { title: 'Favourites — Linezheets Buyer Portal' };

export default async function FavoritesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch favorites + catalog items + alerts data server-side
  const [favRes, alertRes] = await Promise.all([
    supabase.from('buyer_favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('buyer_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
  ]);

  const prefsRes = await supabase.from('buyer_alert_prefs').select('*').eq('user_id', user.id).maybeSingle();

  // Fetch catalog items for favorited products
  const productIds = (favRes.data ?? []).filter((f: { item_type: string }) => f.item_type === 'product').map((f: { item_id: string }) => f.item_id);
  let catalogItems: unknown[] = [];
  if (productIds.length) {
    const { data } = await supabase.from('buyer_vip_catalog').select('*').in('id', productIds);
    catalogItems = data ?? [];
  }

  const defaultPrefs = { email_alerts: true, in_app_alerts: true, alert_on: ['new_stock','price_change','promotion','new_collection'] };

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <DashboardNav />

      <main className="pt-[60px]">
        {/* Masthead */}
        <div className="border-b border-zinc-100">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20">
            <p className="text-[8px] uppercase tracking-[0.6em] mb-6" style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
              Buyer Portal
            </p>
            <h1 style={{
              fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              fontWeight: 400, lineHeight: 1.0, color: '#0a0a0a',
            }}>
              Favourites
            </h1>
            <p className="mt-6 text-[13px] leading-[1.9] max-w-lg" style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
              Save products and brands you love. We will alert you when prices change,
              new stock arrives, or exclusive promotions become available.
            </p>
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-16">
          <FavoritesClient
            initialFavorites={favRes.data ?? []}
            initialAlerts={alertRes.data ?? []}
            initialPrefs={prefsRes.data ?? defaultPrefs}
            catalogItems={catalogItems}
          />
        </div>
      </main>

      <footer className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-10 flex items-center justify-between gap-6">
          <div>
            <p style={{ fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif', fontSize: '13px', letterSpacing: '0.5em', marginBottom: '5px', fontWeight: 400 }}>Linezheets</p>
            <p className="text-[7.5px] uppercase tracking-[0.28em]" style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>Private Showroom · Authorised Retailers Only</p>
          </div>
          <p className="text-[7.5px] uppercase tracking-[0.2em] text-right" style={{ color: '#d8d8d8', fontFamily: 'system-ui, sans-serif' }}>
            © {new Date().getFullYear()} Linezheets · All rights reserved
          </p>
        </div>
      </footer>
    </div>
  );
}
