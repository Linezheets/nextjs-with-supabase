import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardNav from '@/components/DashboardNav';
import OrdersClient from './OrdersClient';

export const metadata = { title: 'Orders — Linezheets Buyer Portal' };

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminSupabase = supabase as any;
  const { data: orders } = await adminSupabase
    .from('buyer_orders')
    .select('id, status, payment_status, total_usd, terms, notes, items, created_at')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false });

  const orderIds: string[] = (orders ?? []).map((o: { id: string }) => o.id);
  const { data: allInstallments } = orderIds.length
    ? await adminSupabase
        .from('buyer_payments')
        .select('id, order_id, installment_seq, amount_usd, status, due_date, method, created_at')
        .in('order_id', orderIds)
        .order('installment_seq', { ascending: true })
    : { data: [] };

  type RawInstallment = { order_id: string; [k: string]: unknown };
  const installmentsByOrder: Record<string, RawInstallment[]> = {};
  for (const row of (allInstallments ?? []) as RawInstallment[]) {
    (installmentsByOrder[row.order_id] ??= []).push(row);
  }

  return (
    <div className="min-h-screen bg-white text-black"
         style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <DashboardNav />

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
          <OrdersClient
            initialOrders={(orders ?? []) as unknown as Parameters<typeof OrdersClient>[0]['initialOrders']}
            installmentsByOrder={installmentsByOrder as unknown as Parameters<typeof OrdersClient>[0]['installmentsByOrder']}
          />
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
