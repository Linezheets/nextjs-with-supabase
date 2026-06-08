import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBlob, setBlob } from '@/lib/session-store';
import { sendEmail, cartChangeHtml } from '@/lib/email';

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? 'info@mxlla.com';

function cartTotal(cart: CartItem[]) {
  return cart.reduce((s, i) => s + (i.wholesale_price ?? 0) * i.quantity, 0);
}

function cartUnits(cart: CartItem[]) {
  return cart.reduce((s, i) => s + i.quantity, 0);
}

function nowHKT() {
  return new Date().toLocaleString('en-GB', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short' }) + ' HKT';
}

type CartItem = {
  variant_id     : string;
  product_id     : string;
  sku            : string | null;
  name           : string | null;
  size           : string;
  color          : string | null;
  quantity       : number;
  wholesale_price: number | null;
  msrp           : number | null;
  image          : string | null;
  brand_name     : string | null;
};

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ cart: [], total: 0 });

  const cart = (await getBlob<CartItem[]>(user.id, 'cart')) ?? [];
  return NextResponse.json({ cart, total: cart.reduce((s, i) => s + i.quantity, 0) });
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Accept both Express shape (variantId) and Next.js shape (item_id)
  const variantId = body.variantId ?? body.item_id;
  const quantity  = parseInt(body.quantity ?? body.qty ?? 1);
  if (!variantId) return NextResponse.json({ error: 'variantId required' }, { status: 400 });

  const cart = (await getBlob<CartItem[]>(user.id, 'cart')) ?? [];
  const existing = cart.find(i => i.variant_id === variantId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    const [productId, size] = String(variantId).split('_');
    cart.push({
      variant_id     : variantId,
      product_id     : productId,
      sku            : body.sku            ?? body.style_number ?? null,
      name           : body.name           ?? body.title        ?? null,
      size           : size                ?? body.size         ?? 'OS',
      color          : body.color          ?? body.colour       ?? null,
      quantity,
      wholesale_price: body.wholesale_price ?? null,
      msrp           : body.msrp           ?? body.retail_price ?? null,
      image          : body.image          ?? body.image_url    ?? null,
      brand_name     : body.brand_name     ?? null,
    });
  }

  await setBlob(user.id, 'cart', cart);

  const addedItem = existing
    ? { ...existing }
    : cart[cart.length - 1];

  if (addedItem.wholesale_price) {
    sendEmail({
      to     : NOTIFY_EMAIL,
      subject: `[Linezheets] Cart — ${user.email} added ${addedItem.name ?? addedItem.variant_id}`,
      html   : cartChangeHtml({
        action   : 'added',
        email    : user.email ?? user.id,
        time     : nowHKT(),
        item     : { name: addedItem.name, brand_name: addedItem.brand_name, size: addedItem.size, quantity: addedItem.quantity, wholesale_price: addedItem.wholesale_price },
        cartTotal: cartTotal(cart),
        cartItems: cartUnits(cart),
      }),
      text: `Cart add: ${user.email} added ${addedItem.name} (WSP ${addedItem.wholesale_price}). Cart total: ${cartTotal(cart)}`,
    }).catch((err: unknown) => console.error('[notify] cart add email failed:', err));
  }

  return NextResponse.json({ cart, total: cart.reduce((s, i) => s + i.quantity, 0) });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  // Accept both ?item_id= (Next.js) and :variantId path (Express calls DELETE /api/cart?item_id=)
  const variantId = searchParams.get('item_id') ?? searchParams.get('variantId');

  if (variantId) {
    const before = (await getBlob<CartItem[]>(user.id, 'cart')) ?? [];
    const removed = before.find(i => i.variant_id === variantId);
    const cart = before.filter(i => i.variant_id !== variantId);
    await setBlob(user.id, 'cart', cart);

    if (removed?.wholesale_price) {
      sendEmail({
        to     : NOTIFY_EMAIL,
        subject: `[Linezheets] Cart — ${user.email} removed ${removed.name ?? variantId}`,
        html   : cartChangeHtml({
          action   : 'removed',
          email    : user.email ?? user.id,
          time     : nowHKT(),
          item     : { name: removed.name, brand_name: removed.brand_name, size: removed.size, quantity: removed.quantity, wholesale_price: removed.wholesale_price },
          cartTotal: cartTotal(cart),
          cartItems: cartUnits(cart),
        }),
        text: `Cart remove: ${user.email} removed ${removed.name}. Cart total: ${cartTotal(cart)}`,
      }).catch((err: unknown) => console.error('[notify] cart remove email failed:', err));
    }

    return NextResponse.json({ cart });
  }

  // Clear entire cart
  const before = (await getBlob<CartItem[]>(user.id, 'cart')) ?? [];
  await setBlob(user.id, 'cart', []);

  if (cartTotal(before) > 0) {
    sendEmail({
      to     : NOTIFY_EMAIL,
      subject: `[Linezheets] Cart — ${user.email} cleared their cart`,
      html   : cartChangeHtml({
        action   : 'cleared',
        email    : user.email ?? user.id,
        time     : nowHKT(),
        cartTotal: 0,
        cartItems: 0,
      }),
      text: `Cart cleared: ${user.email} emptied their cart.`,
    }).catch((err: unknown) => console.error('[notify] cart clear email failed:', err));
  }

  return NextResponse.json({ cart: [] });
}
