import { redirect }      from 'next/navigation';
import { createClient }  from '@/lib/supabase/server';
import Link              from 'next/link';
import SendMessageForm   from './SendMessageForm';
import MessageScroller   from './MessageScroller';

export const revalidate = 0;

function safeStr(raw: unknown, fallback = ''): string {
  if (raw == null) return fallback;
  if (typeof raw === 'string') return raw;
  return fallback;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const STATUS: Record<string, { label: string; color: string }> = {
  open   : { label: 'Open',    color: '#52b788' },
  replied: { label: 'Replied', color: '#c9a84c' },
  closed : { label: 'Closed',  color: '#aaa' },
};

export default async function InquiryThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const numericId = parseInt(id, 10);

  type InquiryWithMessages = {
    id         : number;
    buyer_id   : string;
    brand_name : string;
    subject    : string;
    status     : 'open' | 'replied' | 'closed';
    created_at : string;
    updated_at : string;
    inquiry_messages: { id: number; body: string; sender_id: string; created_at: string }[];
  };

  const { data: inq } = await supabase
    .from('inquiries')
    .select('*, inquiry_messages ( id, body, sender_id, created_at )')
    .eq('id', numericId)
    .eq('buyer_id', user.id)
    .single() as { data: InquiryWithMessages | null; error: unknown };

  if (!inq) redirect('/inquiries');

  const messages = [...(inq.inquiry_messages ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const st = STATUS[inq.status] ?? STATUS.open;

  // Server action — close inquiry
  async function closeInquiry() {
    'use server';
    const supabase = await createClient();
    await supabase
      .from('inquiries')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', numericId);
    redirect(`/inquiries/${id}`);
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <Link href="/" style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400,
          }}>LINEZHEETS</Link>
          <Link href="/inquiries"
                className="text-[8px] uppercase tracking-[0.4em] hover:opacity-50 transition-opacity"
                style={{ color: '#888' }}>
            ← All Inquiries
          </Link>
          <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: '#c9a84c' }}>
            {user.email?.split('@')[0]}
          </span>
        </div>
      </header>

      <div className="pt-[60px] flex-1 flex flex-col max-w-3xl mx-auto w-full px-6">

        {/* Thread header */}
        <div className="py-10 border-b border-zinc-100">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-[0.5em] mb-3" style={{ color: '#c9a84c' }}>
                {safeStr(inq.brand_name)}
              </p>
              <h1 style={{
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
                fontWeight: 400, color: '#111', marginBottom: '0.75rem',
                lineHeight: 1.15,
              }}>
                {safeStr(inq.subject)}
              </h1>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-[7.5px] uppercase tracking-[0.3em]" style={{ color: '#ccc' }}>
                  {fmtDate(inq.created_at)}
                </span>
                <span
                  className="text-[7px] uppercase tracking-[0.2em] px-2 py-0.5"
                  style={{ color: st.color, border: `1px solid ${st.color}` }}
                >
                  {st.label}
                </span>
                <span className="text-[7.5px] uppercase tracking-[0.25em]" style={{ color: '#ddd' }}>
                  {messages.length} message{messages.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Close action */}
            {inq.status !== 'closed' && (
              <form action={closeInquiry}>
                <button
                  type="submit"
                  className="shrink-0 text-[7.5px] uppercase tracking-[0.35em] px-4 py-2
                             border border-zinc-200 hover:border-zinc-500 transition-colors"
                  style={{ color: '#aaa', fontFamily: 'system-ui, sans-serif' }}
                >
                  Close
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Messages — auto-scrolls to bottom */}
        <MessageScroller>
          {messages.length === 0 && (
            <p className="text-[12px] py-8" style={{ color: '#ccc' }}>
              No messages yet — send the first one below.
            </p>
          )}
          {messages.map(msg => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div
                  className="max-w-[75%] px-6 py-5"
                  style={{
                    background: isMe ? '#0a0a0a' : '#f6f6f6',
                    color     : isMe ? '#fff' : '#333',
                  }}
                >
                  <p className="text-[13px] leading-[1.85] whitespace-pre-wrap">
                    {safeStr(msg.body)}
                  </p>
                </div>
                <p className="mt-2 text-[7.5px] uppercase tracking-[0.25em]" style={{ color: '#ccc' }}>
                  {isMe ? 'You' : safeStr(inq.brand_name)} · {fmtDate(msg.created_at)}
                </p>
              </div>
            );
          })}
        </MessageScroller>

        {/* Reply / closed notice */}
        <div className="border-t border-zinc-100 py-8 mb-8">
          {inq.status === 'closed' ? (
            <div className="text-center py-4">
              <p className="text-[8px] uppercase tracking-[0.4em] mb-4" style={{ color: '#ccc' }}>
                This inquiry is closed
              </p>
              <Link
                href="/inquiries/new"
                className="text-[8px] uppercase tracking-[0.4em] border-b pb-px hover:opacity-50 transition-opacity"
                style={{ color: '#888', borderColor: '#ddd' }}
              >
                Start a new inquiry →
              </Link>
            </div>
          ) : (
            <SendMessageForm inquiryId={inq.id} userId={user.id} />
          )}
        </div>

      </div>
    </div>
  );
}
