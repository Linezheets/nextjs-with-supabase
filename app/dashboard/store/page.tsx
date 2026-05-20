import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StoreClient from './StoreClient';

export const metadata = { title: 'My Store — MXLLA Buyer Portal' };

export default async function StorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [sfRes, catalogRes] = await Promise.all([
    supabase.from('buyer_storefronts').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('buyer_vip_catalog').select('*'),
  ]);

  const storefront = sfRes.data ?? null;

  let publishedProducts: unknown[] = [];
  if (storefront) {
    const { data } = await supabase
      .from('storefront_products')
      .select('*')
      .eq('storefront_id', storefront.id);
    publishedProducts = data ?? [];
  }

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <a href="/" style={{
            fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
            fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400,
          }}>MXLLA</a>
          <span className="text-[8px] uppercase tracking-[0.5em]" style={{ color: '#bbb' }}>Buyer Portal</span>
          <div className="flex items-center gap-6">
            {[
              ['/dashboard',              'Dashboard'],
              ['/dashboard/orders',       'Orders'],
              ['/dashboard/favorites',    'Favourites'],
              ['/dashboard/store',        'My Store'],
              ['/dashboard/integrations', 'Integrations'],
              ['/',                       'Showroom'],
            ].map(([href, label]) => (
              <a key={href} href={href}
                 className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                 style={{ color: href === '/dashboard/store' ? '#c9a84c' : '#888', fontFamily: 'system-ui' }}>
                {label}
              </a>
            ))}
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
              Storefront Builder
            </p>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h1 style={{
                  fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif',
                  fontSize: 'clamp(2.5rem, 6vw, 5rem)',
                  fontWeight: 400, lineHeight: 1.0, color: '#0a0a0a',
                }}>
                  My Store
                </h1>
                <p className="mt-6 text-[13px] leading-[1.9] max-w-lg" style={{ color: '#aaa', fontFamily: 'system-ui' }}>
                  Launch your own consumer-facing boutique from the brands you stock.
                  All product info, descriptions and photography come ready from the brands.
                </p>
              </div>
              {storefront && (
                <div className="flex items-center gap-4 pb-1">
                  {storefront.published && (
                    <a href={`/store/${storefront.slug}`} target="_blank"
                       className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                       style={{ color: '#888', fontFamily: 'system-ui' }}>
                      View Live ↗
                    </a>
                  )}
                  <a href="/dashboard/store/editor"
                     className="px-8 py-3 text-[8.5px] uppercase tracking-[0.5em] text-white transition-opacity hover:opacity-80"
                     style={{ background: '#111', fontFamily: 'system-ui' }}>
                    Edit Store →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-16">
          <StoreClient
            initialStorefront={storefront}
            catalog={(catalogRes.data ?? []) as Parameters<typeof StoreClient>[0]['catalog']}
            initialPublished={publishedProducts as Parameters<typeof StoreClient>[0]['initialPublished']}
          />
        </div>
      </main>

      <footer className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-10 flex items-center justify-between gap-6">
          <div>
            <p style={{ fontFamily: 'var(--font-serif), Georgia, "Times New Roman", serif', fontSize: '13px', letterSpacing: '0.5em', marginBottom: '5px', fontWeight: 400 }}>MXLLA Agency</p>
            <p className="text-[7.5px] uppercase tracking-[0.28em]" style={{ color: '#ccc', fontFamily: 'system-ui' }}>Private Showroom · Authorised Retailers Only</p>
          </div>
          <p className="text-[7.5px] uppercase tracking-[0.2em]" style={{ color: '#d8d8d8', fontFamily: 'system-ui' }}>
            © {new Date().getFullYear()} MXLLA · <span style={{ color: '#c9a84c' }}>Linezheets</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
