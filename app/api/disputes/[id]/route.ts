import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { releaseEscrow } from '@/lib/escrow';
import stripe from '@/lib/stripe';

const VALID_RESOLUTIONS = [
  'under_review',
  'resolved_refund',
  'resolved_credit',
  'resolved_no_action',
  'closed',
] as const;
type Resolution = typeof VALID_RESOLUTIONS[number];

// ── GET /api/disputes/[id] ─────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  void req;
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: dispute, error } = await admin
    .from('dispute_requests')
    .select('*, order:order_id(id, buyer_name, total_usd, currency, status, payment_status, escrow_status, items)')
    .eq('id', id)
    .single();

  if (error || !dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });

  // Access control: admin, the raiser, or the brand on the order
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim());
  const isAdmin = adminEmails.includes(user.email ?? '');
  const isRaiser = dispute.raised_by === user.id;

  if (!isAdmin && !isRaiser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ dispute });
}

// ── PATCH /api/disputes/[id] ───────────────────────────────────────────────────
// Admin only: update status, add resolution notes, optionally trigger refund.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim());
  if (!adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  let body: { status?: string; resolution_notes?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { status, resolution_notes } = body;

  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 });
  if (!VALID_RESOLUTIONS.includes(status as Resolution)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_RESOLUTIONS.join(', ')}` },
      { status: 400 },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: dispute } = await admin
    .from('dispute_requests')
    .select('id, order_id, raised_by, type, status')
    .eq('id', id)
    .single() as {
      data: {
        id       : string;
        order_id : string;
        raised_by: string;
        type     : string;
        status   : string;
      } | null;
    };

  if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });

  const now   = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    resolved_by  : user.id,
    resolved_at  : now,
    updated_at   : now,
  };
  if (resolution_notes) patch.resolution_notes = resolution_notes;

  const { data: updated, error } = await admin
    .from('dispute_requests')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If resolved_refund: release escrow back (admin will handle actual Stripe refund separately)
  // We update order status to indicate admin action needed — no automatic Stripe refund.
  // (Wholesale refunds are case-by-case — admin handles via Stripe dashboard.)
  let escrowNote = '';
  if (status === 'resolved_refund') {
    // If escrow already paid the brand, claw it back so the buyer can be refunded
    // from the platform balance. If still escrowed, funds are already with the platform.
    const { data: ord } = await admin
      .from('buyer_orders')
      .select('escrow_status, stripe_transfer_id')
      .eq('id', dispute.order_id)
      .maybeSingle() as { data: { escrow_status: string | null; stripe_transfer_id: string | null } | null };

    if (ord?.escrow_status === 'released' && ord.stripe_transfer_id) {
      try {
        await stripe.transfers.createReversal(
          ord.stripe_transfer_id, {}, { idempotencyKey: `dispute-reversal-${dispute.id}` },
        );
        escrowNote = ' Brand payout reversed (clawed back). Issue the buyer refund from the platform balance.';
      } catch (e) {
        escrowNote = ` Auto-reversal of brand payout FAILED: ${(e as Error).message}. Resolve the clawback manually before refunding.`;
        console.error('[dispute] transfer reversal failed', dispute.order_id, e);
      }
    } else {
      escrowNote = ' Funds still in escrow — process the buyer refund from the platform balance.';
    }

    await admin
      .from('buyer_orders')
      .update({ status: 'refund_approved', updated_at: now })
      .eq('id', dispute.order_id);
  }

  // Notify the user who raised the dispute
  const { data: raiser } = await admin
    .from('buyers')
    .select('email')
    .eq('id', dispute.raised_by)
    .maybeSingle();

  const notifyEmail = raiser?.email ?? null;

  const statusLabels: Record<Resolution, string> = {
    under_review        : 'Under Review',
    resolved_refund     : 'Approved — Refund Issued',
    resolved_credit     : 'Approved — Credit Note Issued',
    resolved_no_action  : 'Reviewed — No Action Required',
    closed              : 'Closed',
  };

  if (notifyEmail) {
    const escHtml = (s: string) =>
      s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    await sendEmail({
      to     : notifyEmail,
      subject: `[Linezheets] Your dispute has been updated — Order ${dispute.order_id}`,
      html   : `
        <p>Your ${escHtml(dispute.type.replace(/_/g, ' '))} for order <strong>${escHtml(dispute.order_id)}</strong> has been updated.</p>
        <p>Status: <strong>${escHtml(statusLabels[status as Resolution])}</strong></p>
        ${resolution_notes
          ? `<p>Note from our team:</p>
             <blockquote style="border-left:3px solid #c9a84c;margin:0;padding:4px 12px;color:#555">
               ${escHtml(resolution_notes)}
             </blockquote>`
          : ''}
        <p>If you have questions, reply to this email or contact info@mxlla.com.</p>
      `,
    }).catch(console.error);
  }

  return NextResponse.json({ dispute: updated, note: escrowNote });
}
