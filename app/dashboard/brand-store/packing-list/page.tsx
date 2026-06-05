import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const SERIF = 'var(--font-serif), Georgia, serif';
const SANS  = 'system-ui, -apple-system, sans-serif';
const GOLD  = '#c9a84c';

export default async function PackingListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '36px 64px 28px' }}>
        <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: '0.5em', color: '#bbb', textTransform: 'uppercase', marginBottom: 8 }}>Brand Store / Packing List</p>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 400, color: '#111', marginBottom: 4 }}>Packing Lists</h1>
        <p style={{ fontFamily: SANS, fontSize: 12, color: '#888' }}>Print itemised packing lists for outgoing wholesale shipments.</p>
      </div>

      <div style={{ padding: '40px 64px', maxWidth: 720 }}>
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, color: GOLD, marginBottom: 16 }}>◻</div>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, color: '#111', marginBottom: 12 }}>Packing Lists from Orders</h2>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#888', lineHeight: 1.8, marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
            Open any confirmed or processing order from your Orders page and click <strong>Print Packing List</strong> to generate an itemised PDF for your fulfilment team.
          </p>
          <Link href="/dashboard/brand-store/orders"
            style={{ background: '#111', color: '#fff', padding: '11px 28px', fontFamily: SANS, fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' }}>
            View Orders →
          </Link>
        </div>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { icon: '◆', title: 'Itemised by SKU', desc: 'Each item listed by SKU, colour, size, and quantity for warehouse accuracy.' },
            { icon: '●', title: 'Buyer Details', desc: "Buyer's delivery address and contact printed on every packing slip." },
            { icon: '◐', title: 'Print Ready', desc: 'Clean A4 PDF format — print directly or share with your logistics team.' },
            { icon: '◑', title: 'Multi-Order', desc: 'Batch-print packing lists for multiple orders at once from the Orders page.' },
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
