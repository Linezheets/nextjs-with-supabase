import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBlob, setBlob } from '@/lib/session-store';

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  return NextResponse.json({ cart, total: cart.reduce((s, i) => s + i.quantity, 0) });
}

export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  // Accept both ?item_id= (Next.js) and :variantId path (Express calls DELETE /api/cart?item_id=)
  const variantId = searchParams.get('item_id') ?? searchParams.get('variantId');

  if (variantId) {
    const cart = ((await getBlob<CartItem[]>(user.id, 'cart')) ?? [])
      .filter(i => i.variant_id !== variantId);
    await setBlob(user.id, 'cart', cart);
    return NextResponse.json({ cart });
  }

  // Clear entire cart
  await setBlob(user.id, 'cart', []);
  return NextResponse.json({ cart: [] });
}
