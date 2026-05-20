import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import IntegrationsClient from './IntegrationsClient';

export const metadata = { title: 'Integrations — MXLLA Buyer Portal' };

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <a href="/"
             style={{
               fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
               fontSize    : '15px',
               letterSpacing: '0.5em',
               fontWeight  : 400,
             }}>
            MXLLA
          </a>

          <span className="text-[8px] uppercase tracking-[0.5em]"
                style={{ color: '#bbb' }}>
            Buyer Portal
          </span>

          <div className="flex items-center gap-6">
            <a href="/dashboard"
               className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
               style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
              Dashboard
            </a>
            <a href="/"
               className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
               style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
              Showroom
            </a>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                style={{ color: '#888', fontFamily: 'system-ui, sans-serif' }}>
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="pt-[60px]">

        {/* ── Masthead ──────────────────────────────────────────────────── */}
        <div className="border-b border-zinc-100">
          <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-20">
            <p className="text-[8px] uppercase tracking-[0.6em] mb-6"
               style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
              Platform Settings
            </p>
            <h1 style={{
              fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize    : 'clamp(2.5rem, 6vw, 5rem)',
              fontWeight  : 400,
              lineHeight  : 1.0,
              color       : '#0a0a0a',
            }}>
              Integrations
            </h1>
            <p className="mt-6 text-[13px] leading-[1.9] max-w-lg"
               style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}>
              Connect your existing tools to the Linezheets platform. All credentials are
              encrypted at rest and transmitted over TLS.
            </p>
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-16">
          <IntegrationsClient />
        </div>

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 py-10
                        flex items-center justify-between gap-6">
          <div>
            <p style={{
              fontFamily  : 'var(--font-serif), Georgia, "Times New Roman", serif',
              fontSize    : '13px',
              letterSpacing: '0.5em',
              marginBottom: '5px',
              fontWeight  : 400,
            }}>
              MXLLA Agency
            </p>
            <p className="text-[7.5px] uppercase tracking-[0.28em]"
               style={{ color: '#ccc', fontFamily: 'system-ui, sans-serif' }}>
              Private Showroom · Authorised Retailers Only
            </p>
          </div>
          <p className="text-[7.5px] uppercase tracking-[0.2em] text-right"
             style={{ color: '#d8d8d8', fontFamily: 'system-ui, sans-serif' }}>
            © {new Date().getFullYear()} MXLLA ·{' '}
            <span style={{ color: '#c9a84c' }}>Linezheets</span>
          </p>
        </div>
      </footer>

    </div>
  );
}
