import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/supabase/requireAdmin';

type Params = { params: Promise<{ id: string }> };

const VALID = ['active', 'pending', 'rejected', 'suspended'];

// PATCH /api/admin/buyers/[id]/status  { status: 'active' | 'pending' | 'rejected' | 'suspended' }
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const { status, note } = await req.json() as { status: string; note?: string };

  if (!VALID.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Choose: ${VALID.join(', ')}` }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  // Fetch buyer email for notification
  const { data: buyer } = await admin
    .from('buyers')
    .select('email, first_name, store_name')
    .eq('id', id)
    .maybeSingle();

  const { error } = await admin
    .from('buyers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── Send approval/rejection email to buyer ──────────────────────────────
  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://linezheets.com';
  const buyerEmail = buyer?.email;
  const name       = buyer?.first_name ?? buyer?.store_name ?? 'there';

  if (buyerEmail && (status === 'active' || status === 'rejected')) {
    try {
      const supabase = await createClient();
      await (supabase as any).functions.invoke('send-email', {
        body: {
          to     : buyerEmail,
          subject: status === 'active'
            ? 'Your Linezheets application has been approved'
            : 'Update on your Linezheets application',
          html: status === 'active'
            ? `
              <p>Dear ${name},</p>
              <p>Congratulations — your Linezheets buyer account has been approved.</p>
              <p>You can now sign in and access the full wholesale platform.</p>
              <p><a href="${siteUrl}/login">Sign In to Linezheets →</a></p>
            `
            : `
              <p>Dear ${name},</p>
              <p>Thank you for your interest in Linezheets.</p>
              <p>Unfortunately, we are unable to approve your application at this time.</p>
              ${note ? `<p>Reason: ${note}</p>` : ''}
              <p>If you have any questions, please contact us at <a href="mailto:info@mxlla.com">info@mxlla.com</a>.</p>
            `,
        },
      }).catch(() => {
        // fallback: try alerts/send endpoint
        return fetch(`${siteUrl}/api/alerts/send`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({
            to     : buyerEmail,
            subject: status === 'active'
              ? 'Your Linezheets application has been approved'
              : 'Update on your Linezheets application',
            html: status === 'active'
              ? `<p>Dear ${name},</p><p>Your buyer account has been approved. <a href="${siteUrl}/login">Sign in →</a></p>`
              : `<p>Dear ${name},</p><p>We could not approve your application at this time.${note ? ` Reason: ${note}` : ''}</p>`,
          }),
        });
      });
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json({ message: `Buyer status set to ${status}` });
}
