import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const SERIF = 'var(--font-serif), Georgia, serif';
const SANS  = 'system-ui, -apple-system, sans-serif';
const GOLD  = '#c9a84c';

export default async function InvoicingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '36px 64px 28px' }}>
        <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.5em', color: '#bbb', textTransform: 'uppercase', marginBottom: 8 }}>Brand Store / Invoicing</p>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: '#111', marginBottom: 4 }}>Invoicing</h1>
        <p style={{ fontFamily: SANS, fontSize: 12, color: '#888' }}>Generate, send, and track wholesale invoices for every order.</p>
      </div>

      <div style={{ padding: '40px 64px', maxWidth: 720 }}>
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, color: GOLD, marginBottom: 16 }}>◆</div>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: '#111', marginBottom: 12 }}>Invoices are linked to Orders</h2>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#888', lineHeight: 1.8, marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
            Go to your Orders page, open any confirmed order, and click <strong>Download Invoice</strong> to generate a branded PDF invoice automatically.
          </p>
          <Link href="/dashboard/brand-store/orders"
            style={{ background: '#111', color: '#fff', padding: '11px 28px', fontFamily: SANS, fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' }}>
            Go to Orders →
          </Link>
        </div>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { icon: '◈', title: 'Auto-Generated', desc: 'PDF invoices created instantly from every confirmed order with your brand details.' },
            { icon: '◉', title: 'Payment Terms', desc: 'NET 30/60/90 terms applied automatically based on your Sales Terms settings.' },
            { icon: '◎', title: 'Branded PDFs', desc: 'Your logo, brand name, and contact details on every invoice.' },
            { icon: '◇', title: 'Track Payments', desc: 'Mark invoices as paid and view outstanding balances in your analytics.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ background: '#fff', border: '1px solid #f0f0f0', padding: '20px 24px' }}>
              <p style={{ fontSize: 20, color: GOLD, marginBottom: 10 }}>{icon}</p>
              <p style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 6 }}>{title}</p>
              <p style={{ fontFamily: SANS, fontSize: 12, color: '#888', lineHeight: 1.7 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
