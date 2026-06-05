import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL ?? 'info@mxlla.com';

const VALID_TYPES = ['dispute', 'refund_request', 'credit_note_request', 'return_request'] as const;
type DisputeType = typeof VALID_TYPES[number];

// ── GET /api/disputes ─────────────────────────────────────────────────────────
// Admin: all disputes (filtered by status/type). Buyer/Brand: their own.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const type   = searchParams.get('type');
  const limit  = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim());
  const isAdmin = adminEmails.includes(user.email ?? '');

  let query = admin
    .from('dispute_requests')
    .select('*, order:order_id(id, buyer_name, total_usd, currency, status, items)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!isAdmin) {
    // Buyers/brands only see disputes they raised or disputes on their orders
    query = query.eq('raised_by', user.id);
  }

  if (status) query = query.eq('status', status);
  if (type)   query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ disputes: data ?? [] });
}

// ── POST /api/disputes ────────────────────────────────────────────────────────
// Raise a new dispute or refund request. Buyer or brand can raise.
export async function POST(req: NextRequest) {
  // Rate limit: max 5 disputes per IP per hour (spam prevention)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`disputes:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status : 429,
      headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) },
    });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { order_id?: string; type?: string; description?: string; evidence_urls?: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { order_id, type, description, evidence_urls } = body;

  if (!order_id)    return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
  if (!description) return NextResponse.json({ error: 'description is required' }, { status: 400 });
  if (description.trim().length < 20) {
    return NextResponse.json({ error: 'description must be at least 20 characters' }, { status: 400 });
  }
  if (description.trim().length > 4000) {
    return NextResponse.json({ error: 'description must be under 4000 characters' }, { status: 400 });
  }
  if (type && !VALID_TYPES.includes(type as DisputeType)) {
    return NextResponse.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
  }
  // Validate evidence_urls — only allow http/https to prevent javascript: injection
  const safeEvidenceUrls = (evidence_urls ?? []).filter(u => {
    try { return ['http:', 'https:'].includes(new URL(u).protocol); }
    catch { return false; }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Verify the order belongs to this user (buyer or brand)
  const { data: order } = await admin
    .from('buyer_orders')
    .select('id, buyer_id, buyer_name, total_usd, currency, items')
    .eq('id', order_id)
    .maybeSingle() as {
      data: {
        id        : string;
        buyer_id  : string;
        buyer_name: string;
        total_usd : number;
        currency  : string | null;
        items     : { brand_name?: string | null }[];
      } | null;
    };

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Determine role
  let raisedByRole: 'buyer' | 'brand' | null = null;

  if (order.buyer_id === user.id) {
    raisedByRole = 'buyer';
  } else {
    // Check if user is the brand on this order
    const { data: sf } = await admin
      .from('brand_storefronts')
      .select('brand_name')
      .eq('user_id', user.id)
      .maybeSingle() as { data: { brand_name: string } | null };

    const orderBrand = Array.isArray(order.items) ? (order.items[0]?.brand_name ?? '') : '';
    if (sf && sf.brand_name === orderBrand) {
      raisedByRole = 'brand';
    }
  }

  if (!raisedByRole) {
    return NextResponse.json({ error: 'You are not a party to this order' }, { status: 403 });
  }

  // Check for duplicate open dispute on the same order by same user
  const { data: existing } = await admin
    .from('dispute_requests')
    .select('id')
    .eq('order_id', order_id)
    .eq('raised_by', user.id)
    .in('status', ['open', 'under_review'])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: 'You already have an open dispute on this order', existing_id: existing.id },
      { status: 409 },
    );
  }

  const { data: dispute, error } = await admin
    .from('dispute_requests')
    .insert({
      order_id,
      raised_by      : user.id,
      raised_by_role : raisedByRole,
      type           : (type as DisputeType) ?? 'dispute',
      description    : description.trim(),
      evidence_urls  : safeEvidenceUrls,
      status         : 'open',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify platform admin
  const typeLabel: Record<DisputeType, string> = {
    dispute             : 'Dispute',
    refund_request      : 'Refund Request',
    credit_note_request : 'Credit Note Request',
    return_request      : 'Return Request',
  };

  // HTML-escape user-controlled content before embedding in email body
  const escHtml = (s: string) =>
    s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.linezheets.com';

  await sendEmail({
    to     : NOTIFY_EMAIL,
    subject: `[Linezheets] New ${typeLabel[dispute.type as DisputeType]} — Order ${order_id}`,
    html   : `
      <p><strong>${escHtml(typeLabel[dispute.type as DisputeType])}</strong> raised by ${escHtml(raisedByRole)} (${escHtml(user.email ?? '')})</p>
      <p>Order: <strong>${escHtml(order_id)}</strong> · ${escHtml(order.buyer_name ?? '')} · ${escHtml(String(order.total_usd))} ${escHtml(order.currency ?? 'USD')}</p>
      <p>Description:</p>
      <blockquote style="border-left:3px solid #c9a84c;margin:0;padding:4px 12px;color:#555">
        ${escHtml(description.trim())}
      </blockquote>
      <p><a href="${escHtml(siteUrl)}/dashboard/admin/disputes/${escHtml(dispute.id)}">Review in admin panel →</a></p>
    `,
  }).catch(console.error);

  return NextResponse.json({ dispute }, { status: 201 });
}
