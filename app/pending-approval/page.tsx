import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // If buyer is already approved, send them to dashboard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: buyer } = await db
    .from('buyers')
    .select('status, first_name, store_name')
    .eq('id', user.id)
    .maybeSingle();

  if (buyer?.status === 'active') redirect('/dashboard');

  const name = buyer?.first_name ?? buyer?.store_name ?? user.email ?? 'there';

  return (
    <div className="min-h-screen bg-white text-black flex flex-col"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 flex items-center h-[60px]">
          <Link href="/" style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400,
          }}>
            LINEZHEETS
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-8 py-20">
        <div className="w-full max-w-lg text-center">

          {/* Icon */}
          <div className="w-14 h-14 mx-auto mb-10 flex items-center justify-center border border-zinc-200">
            <span style={{ color: '#c9a84c', fontSize: '22px' }}>✦</span>
          </div>

          <p className="text-[8px] uppercase tracking-[0.7em] mb-6" style={{ color: '#c9a84c' }}>
            Application Under Review
          </p>

          <h1 style={{
            fontFamily  : 'var(--font-serif), Georgia, serif',
            fontSize    : 'clamp(2rem, 5vw, 3rem)',
            fontWeight  : 400,
            lineHeight  : 1.05,
            color       : '#0a0a0a',
            marginBottom: '2rem',
          }}>
            Thank you,<br />
            <em style={{ color: '#bbb', fontStyle: 'italic' }}>{name}</em>
          </h1>

          <p className="text-[13px] leading-[1.9] mb-3" style={{ color: '#666', maxWidth: '420px', margin: '0 auto 1rem' }}>
            Your application has been received and is being reviewed by our team.
            We typically respond within <strong>1–2 business days</strong>.
          </p>

          <p className="text-[12px] leading-[1.8] mb-10" style={{ color: '#aaa', maxWidth: '400px', margin: '0 auto 2.5rem' }}>
            You'll receive an email at <strong>{user.email}</strong> once your account
            has been approved and you can begin accessing the platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="text-[8px] uppercase tracking-[0.5em] px-8 py-3 border border-zinc-200 hover:border-zinc-400 transition-colors"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              Back to Home
            </Link>
            <Link
              href="/marketplace"
              className="text-[8px] uppercase tracking-[0.5em] px-8 py-3 bg-black text-white hover:bg-zinc-900 transition-colors"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              Browse Marketplace
            </Link>
          </div>

          <p className="mt-14 text-[10px]" style={{ color: '#ccc' }}>
            Questions? Email us at{' '}
            <a href="mailto:info@mxlla.com" className="hover:opacity-60 transition-opacity" style={{ color: '#999' }}>
              info@mxlla.com
            </a>
          </p>

        </div>
      </div>
    </div>
  );
}
