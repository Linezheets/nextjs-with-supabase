import { redirect }     from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link             from 'next/link';

export const revalidate = 0;

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  return fallback;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  open    : { label: 'Open',    color: '#52b788' },
  replied : { label: 'Replied', color: '#c9a84c' },
  closed  : { label: 'Closed',  color: '#aaa' },
};

export default async function InquiriesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch inquiries with latest message preview
  const { data: inquiries } = await supabase
    .from('inquiries')
    .select(`
      id, brand_name, subject, status, created_at,
      inquiry_messages ( body, created_at )
    `)
    .eq('buyer_id', user.id)
    .order('updated_at', { ascending: false });

  const rows = Array.isArray(inquiries) ? inquiries : [];

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <Link href="/" style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400,
          }}>LINEZHEETS</Link>
          <div className="flex items-center gap-8">
            <Link href="/marketplace"
                  className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                  style={{ color: '#888' }}>Marketplace</Link>
            <Link href="/inquiries"
                  className="text-[8px] uppercase tracking-[0.4em]"
                  style={{ color: '#111', borderBottom: '1px solid #111' }}>Inquiries</Link>
            <Link href="/dashboard"
                  className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                  style={{ color: '#888' }}>Dashboard</Link>
          </div>
          <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: '#c9a84c' }}>
            {user.email?.split('@')[0]}
          </span>
        </div>
      </header>

      <main className="pt-[60px] max-w-screen-xl mx-auto px-8 md:px-16 py-16">

        {/* Header */}
        <div className="flex items-end justify-between mb-14 pb-7 border-b border-zinc-100">
          <div>
            <p className="text-[7.5px] uppercase tracking-[0.55em] mb-3" style={{ color: '#ccc' }}>
              Brand Communications
            </p>
            <h1 style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
              fontWeight: 400, color: '#111',
            }}>
              Inquiries
            </h1>
          </div>
          <Link href="/inquiries/new"
                className="inline-block px-8 py-3 text-[8px] uppercase tracking-[0.45em]
                           bg-black text-white hover:bg-zinc-900 transition-colors"
                style={{ fontFamily: 'system-ui, sans-serif' }}>
            + New Inquiry
          </Link>
        </div>

        {rows.length === 0 ? (
          /* Empty state */
          <div className="py-32 flex flex-col items-center text-center">
            <div className="w-12 h-px mb-12 bg-zinc-200" />
            <h2 style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontSize: '2rem', fontWeight: 400, color: '#111', marginBottom: '1rem',
            }}>
              No inquiries yet
            </h2>
            <p className="text-[13px] leading-[1.9] max-w-xs mb-10" style={{ color: '#aaa' }}>
              Start a conversation with a designer house about any piece in the collection.
            </p>
            <Link href="/marketplace"
                  className="text-[8.5px] uppercase tracking-[0.45em] border-b pb-px hover:opacity-50 transition-opacity"
                  style={{ color: '#c9a84c', borderColor: '#c9a84c' }}>
              Browse the Marketplace →
            </Link>
          </div>
        ) : (
          /* Inquiry list */
          <div className="divide-y divide-zinc-100">
            {rows.map((inq: {
              id: number;
              brand_name: string;
              subject: string;
              status: string;
              created_at: string;
              inquiry_messages?: { body: string; created_at: string }[];
            }) => {
              const st      = STATUS_STYLE[inq.status] ?? STATUS_STYLE.open;
              const msgs    = Array.isArray(inq.inquiry_messages) ? inq.inquiry_messages : [];
              const latest  = msgs[msgs.length - 1];
              const preview = latest ? safeStr(latest.body).slice(0, 90) + (latest.body.length > 90 ? '…' : '') : 'No messages yet';
              const when    = latest ? timeAgo(latest.created_at) : timeAgo(inq.created_at);

              return (
                <Link key={inq.id} href={`/inquiries/${inq.id}`}
                      className="flex items-start justify-between gap-6 py-7
                                 hover:bg-zinc-50 -mx-4 px-4 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-[8px] uppercase tracking-[0.3em]"
                            style={{ color: '#c9a84c', fontFamily: 'system-ui, sans-serif' }}>
                        {inq.brand_name}
                      </span>
                      <span className="text-[7px] uppercase tracking-[0.2em] px-2 py-0.5"
                            style={{ color: st.color, border: `1px solid ${st.color}` }}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-[14px] mb-2 group-hover:opacity-70 transition-opacity truncate"
                       style={{ fontFamily: 'var(--font-serif), Georgia, serif', color: '#111' }}>
                      {inq.subject}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: '#bbb' }}>
                      {preview}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[8px] uppercase tracking-[0.2em]" style={{ color: '#ccc' }}>{when}</p>
                    <p className="text-[8px] uppercase tracking-[0.2em] mt-2" style={{ color: '#ddd' }}>
                      {msgs.length} msg{msgs.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
