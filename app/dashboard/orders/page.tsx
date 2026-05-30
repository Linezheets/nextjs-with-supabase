import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OrdersClient from './OrdersClient';

export const metadata = { title: 'Orders — Linezheets Buyer Portal' };

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: orders } = await supabase
    .from('buyer_orders')
    .select('*')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <a href="/" style={{
            fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400,
          }}>LINEZHEETS</a>
          <span className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>Buyer Portal</span>
          <div className="flex items-center gap-6">
            <a href="/dashboard"                  className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888', fontFamily: 'system-ui' }}>Dashboard</a>
            <a href="/dashboard/favorites"        className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888', fontFamily: 'system-ui' }}>Favourites</a>
            <a href="/dashboard/integrations"     className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888', fontFamily: 'system-ui' }}>Integrations</a>
            <a href="/dashboard/profile"          className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888', fontFamily: 'system-ui' }}>Profile</a>
            <a href="/"                           className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888', fontFamily: 'system-ui' }}>Showroom</a>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity" style={{ color: '#888', fontFamily: 'system-ui' }}>Sign Out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="pt-[60px]">
        {/* Masthead */}
        <div className="border-b border-zinc-100">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20">
            <p className="text-[8px] uppercase tracking-[0.6em] mb-6" style={{ color: '#c9a84c', fontFamily: 'system-ui' }}>
              Buyer Portal
            </p>
            <h1 style={{
              fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              fontWeight: 400, lineHeight: 1.0, color: '#0a0a0a',
            }}>
              Orders
            </h1>
            <p className="mt-6 text-[13px] leading-[1.9] max-w-lg" style={{ color: '#aaa', fontFamily: 'system-ui' }}>
              Your wholesale order history. Switch between line-sheet and grid views.
            </p>
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-16">
          <OrdersClient initialOrders={(orders ?? []) as unknown as Parameters<typeof OrdersClient>[0]['initialOrders']} />
        </div>
      </main>

      <footer className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-10 flex items-center justify-between gap-6">
          <div>
            <p style={{ fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif', fontSize: '13px', letterSpacing: '0.5em', marginBottom: '5px', fontWeight: 400 }}>Linezheets</p>
            <p className="text-[7.5px] uppercase tracking-[0.28em]" style={{ color: '#ccc', fontFamily: 'system-ui' }}>Private Showroom · Authorised Retailers Only</p>
          </div>
          <p className="text-[7.5px] uppercase tracking-[0.2em]" style={{ color: '#d8d8d8', fontFamily: 'system-ui' }}>
            © {new Date().getFullYear()} Linezheets · <span style={{ color: '#c9a84c' }}>Linezheets</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
