import { redirect }     from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link             from 'next/link';
import NewInquiryForm  from './NewInquiryForm';

async function getBrands(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('buyer_vip_catalog')
      .select('brand_name')
      .order('brand_name');
    if (!Array.isArray(data)) return [];
    return [...new Set(data.map((r: { brand_name: string | null }) => r.brand_name ?? '').filter(Boolean))].sort();
  } catch { return []; }
}

export default async function NewInquiryPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; title?: string; ref?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/inquiries/new');

  const params      = await searchParams;
  const prefillBrand = params.brand ?? '';
  const prefillTitle = params.title ?? '';
  const prefillRef   = params.ref   ?? '';         // style number / SKU

  const brands = await getBrands();

  // Server action — create inquiry + first message in one shot
  async function createInquiry(fd: FormData) {
    'use server';
    const supabase     = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const brandName = (fd.get('brand_name')   as string ?? '').trim();
    const subject   = (fd.get('subject')      as string ?? '').trim();
    const body      = (fd.get('body')         as string ?? '').trim();

    if (!brandName || !subject || !body) return;

    const { data: inq, error } = await supabase
      .from('inquiries')
      .insert({ buyer_id: user.id, brand_name: brandName, subject, status: 'open' })
      .select('id')
      .single();

    if (error || !inq) return;

    await supabase
      .from('inquiry_messages')
      .insert({ inquiry_id: inq.id, sender_id: user.id, body });

    redirect(`/inquiries/${inq.id}`);
  }

  const defaultSubject = prefillTitle
    ? `Inquiry: ${prefillTitle}${prefillRef ? ` (Ref. ${prefillRef})` : ''}`
    : '';

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-zinc-100">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 flex items-center justify-between h-[60px]">
          <Link href="/" style={{
            fontFamily: 'var(--font-serif), Georgia, serif',
            fontSize: '15px', letterSpacing: '0.5em', fontWeight: 400,
          }}>MXLLA</Link>
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

      <main className="pt-[60px]">
        <div className="max-w-2xl mx-auto px-6 py-16">

          {/* Header */}
          <p className="text-[7.5px] uppercase tracking-[0.6em] mb-6" style={{ color: '#c9a84c' }}>
            New Inquiry
          </p>
          <h1 style={{
            fontFamily  : 'var(--font-serif), Georgia, serif',
            fontSize    : 'clamp(1.8rem, 4vw, 3rem)',
            fontWeight  : 400,
            lineHeight  : 1.05,
            color       : '#111',
            marginBottom: '0.75rem',
          }}>
            Contact a<br />
            <em style={{ fontStyle: 'italic', color: '#bbb' }}>Designer House</em>
          </h1>
          <p className="text-[12px] leading-[1.9] mb-14" style={{ color: '#aaa' }}>
            Send a direct message to a brand about pricing, availability, exclusivity, or custom orders.
            Your inquiry goes straight to the designer house.
          </p>

          {/* Pre-filled product context */}
          {(prefillTitle || prefillRef) && (
            <div className="mb-10 p-5 border border-zinc-100 bg-zinc-50 flex items-start gap-4">
              <span style={{ color: '#c9a84c', fontSize: '16px', marginTop: '1px' }}>◈</span>
              <div>
                <p className="text-[7.5px] uppercase tracking-[0.4em] mb-1" style={{ color: '#bbb' }}>
                  Re: Product
                </p>
                <p className="text-[13px]" style={{ color: '#444' }}>
                  {prefillTitle}
                  {prefillRef && <span style={{ color: '#bbb' }}> · Ref. {prefillRef}</span>}
                </p>
              </div>
            </div>
          )}

          <NewInquiryForm
            action={createInquiry}
            brands={brands}
            defaultBrand={prefillBrand}
            defaultSubject={defaultSubject}
          />

        </div>
      </main>
    </div>
  );
}
