import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listOffers, appendOffer } from '@/lib/session-store';
import { parseMoney } from '@/lib/parse-money';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const offers = await listOffers(user.id);
  return NextResponse.json({ offers, total: offers.length });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { company, contact, email, terms, message, currency, items } = body;
  if (!items?.length) return NextResponse.json({ error: 'items required' }, { status: 400 });

  const totalRaw = (items as { wholesale_price?: unknown; price?: unknown; quantity?: unknown }[])
    .reduce((s, i) => {
      const unit = Math.max(0, parseMoney(i.wholesale_price ?? i.price) ?? 0);
      const qty  = Math.max(0, Math.floor(Number(i.quantity) || 1));
      return s + unit * qty;
    }, 0);
  const total = Number.isFinite(totalRaw) ? Math.round(totalRaw * 100) / 100 : 0;

  const offer = {
    company : company  ?? 'Anonymous',
    contact : contact  ?? null,
    email   : email    ?? null,
    terms   : terms    ?? null,
    message : message  ?? null,
    currency: currency ?? 'USD',
    total,
    items,
    status  : 'pending',
  };

  const id = await appendOffer(user.id, offer);
  return NextResponse.json({ success: true, offer: { id, ...offer } });
}
