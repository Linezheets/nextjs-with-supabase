import { sendEmail } from '@/lib/email';
import { resolveBuyerEmail } from '@/lib/orders/buyer-email';

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Notify a storefront owner that a buyer submitted an enquiry. Prefers the
 * storefront's contact_email; falls back to the owner's auth email. Previously
 * enquiries were only DB-inserted and nobody was notified.
 */
export async function notifyStorefrontEnquiry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  opts: {
    ownerEmail : string | null;
    ownerUserId: string | null;
    storeName  : string;
    from       : { name: string; email: string; message?: string | null };
  },
): Promise<void> {
  const to = opts.ownerEmail ?? await resolveBuyerEmail(admin, null, opts.ownerUserId);
  if (!to) return;

  await sendEmail({
    to,
    subject: `New enquiry on ${opts.storeName}`,
    html: `
      <p>You've received a new enquiry on your storefront <strong>${esc(opts.storeName)}</strong>.</p>
      <p><strong>From:</strong> ${esc(opts.from.name)} &lt;${esc(opts.from.email)}&gt;</p>
      ${opts.from.message
        ? `<p><strong>Message:</strong></p>
           <blockquote style="border-left:3px solid #c9a84c;margin:0;padding:4px 12px;color:#555">${esc(opts.from.message)}</blockquote>`
        : ''}
      <p>Reply directly to <a href="mailto:${esc(opts.from.email)}">${esc(opts.from.email)}</a>.</p>
    `,
  }).catch(console.error);
}
