import sgMail from '@sendgrid/mail';

// Requires env var: SENDGRID_API_KEY
// Optional:        EMAIL_FROM (default "Linezheets <hello@linezheets.com>")
//                  hello@linezheets.com is the primary Google Workspace sender; info@mxlla.com is admin/backup

const FROM = process.env.EMAIL_FROM ?? 'Linezheets <hello@linezheets.com>';

export async function sendEmail(opts: {
  to     : string;
  subject: string;
  html   : string;
  text?  : string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set — skipping send to', opts.to);
    return { ok: false, error: 'SENDGRID_API_KEY not configured' };
  }
  sgMail.setApiKey(apiKey);
  try {
    await sgMail.send({
      from   : FROM,
      to     : opts.to,
      subject: opts.subject,
      html   : opts.html,
      text   : opts.text ?? opts.subject,
    });
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[email] SendGrid send failed:', msg);
    return { ok: false, error: msg };
  }
}

// ── Templates ──────────────────────────────────────────────────────────────────

export function orderConfirmationHtml(order: {
  id          : string;
  buyer_name  : string;
  total_usd   : number;
  items       : Array<{ name?: string; brand_name?: string; sizes?: Record<string, number>; total_qty?: number; wsp_usd?: number }>;
  fulfillment_type?: string;
  terms?      : string;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const itemRows = order.items.map(i => {
    const sizeStr = i.sizes
      ? Object.entries(i.sizes).map(([s, q]) => `${s}×${q}`).join(', ')
      : `Qty ${i.total_qty ?? 0}`;
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">${i.name ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#888;">${i.brand_name ?? ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#888;">${sizeStr}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${i.wsp_usd ? fmt(i.wsp_usd) : '—'}</td>
    </tr>`;
  }).join('');

  const badge = order.fulfillment_type === 'FUTURE_ALLOCATION'
    ? '<span style="background:#f5f0e8;color:#c9a84c;padding:2px 8px;border-radius:3px;font-size:11px;">Pre-order / Forward Allocation</span>'
    : '<span style="background:#edf7ed;color:#3a7d44;padding:2px 8px;border-radius:3px;font-size:11px;">Confirmed — Immediate</span>';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:system-ui,-apple-system,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border:1px solid #ebebeb;">
        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:2px solid #111;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.5em;text-transform:uppercase;color:#888;">Linezheets</p>
            <h1 style="margin:0;font-size:22px;font-weight:300;letter-spacing:0.05em;">Order Confirmation</h1>
          </td>
        </tr>
        <!-- Meta -->
        <tr>
          <td style="padding:24px 40px;border-bottom:1px solid #f0f0f0;">
            <table width="100%">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.3em;color:#aaa;">Order ID</p>
                  <p style="margin:0;font-size:14px;font-family:monospace;">${order.id}</p>
                </td>
                <td style="text-align:right;">
                  <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:0.3em;color:#aaa;">Status</p>
                  ${badge}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Items -->
        <tr>
          <td style="padding:24px 40px;">
            <p style="margin:0 0 12px;font-size:10px;text-transform:uppercase;letter-spacing:0.3em;color:#aaa;">Items</p>
            <table width="100%" style="border-collapse:collapse;">
              <thead>
                <tr style="background:#fafafa;">
                  <th style="padding:6px 12px;text-align:left;font-size:10px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:0.2em;">Style</th>
                  <th style="padding:6px 12px;text-align:left;font-size:10px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:0.2em;">Brand</th>
                  <th style="padding:6px 12px;text-align:left;font-size:10px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:0.2em;">Sizes</th>
                  <th style="padding:6px 12px;text-align:right;font-size:10px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:0.2em;">WSP</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
          </td>
        </tr>
        <!-- Total -->
        <tr>
          <td style="padding:16px 40px 24px;border-top:2px solid #111;">
            <table width="100%">
              <tr>
                <td style="font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#888;">Total (WSP)</td>
                <td style="text-align:right;font-size:20px;font-weight:300;">${fmt(order.total_usd)}</td>
              </tr>
              ${order.terms ? `<tr><td colspan="2" style="padding-top:8px;font-size:11px;color:#888;">Terms: ${order.terms}</td></tr>` : ''}
            </table>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;background:#fafafa;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:10px;color:#bbb;text-align:center;">
              Linezheets · Private Wholesale Platform · <a href="https://linezheets.com" style="color:#c9a84c;text-decoration:none;">linezheets.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function loginNotificationHtml(opts: { email: string; time: string; ip?: string }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:system-ui,-apple-system,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:60px 20px;">
      <table width="540" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border:1px solid #ebebeb;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:2px solid #111;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.5em;text-transform:uppercase;color:#888;">Linezheets</p>
            <h1 style="margin:0;font-size:20px;font-weight:300;letter-spacing:0.05em;">Buyer Login</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px;">
            <p style="margin:0 0 16px;font-size:13px;color:#555;line-height:1.7;">A buyer has signed in to the platform.</p>
            <table style="border-collapse:collapse;width:100%;">
              <tr>
                <td style="padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#aaa;width:120px;">Account</td>
                <td style="padding:8px 0;font-size:13px;font-family:monospace;">${opts.email}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#aaa;">Time</td>
                <td style="padding:8px 0;font-size:13px;">${opts.time}</td>
              </tr>
              ${opts.ip ? `<tr>
                <td style="padding:8px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#aaa;">IP</td>
                <td style="padding:8px 0;font-size:13px;font-family:monospace;">${opts.ip}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:10px;color:#bbb;">Linezheets · Private Wholesale · <a href="https://linezheets.com" style="color:#c9a84c;text-decoration:none;">linezheets.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function cartChangeHtml(opts: {
  action   : 'added' | 'removed' | 'cleared';
  email    : string;
  time     : string;
  item?    : { name?: string | null; brand_name?: string | null; size?: string; quantity?: number; wholesale_price?: number | null };
  cartTotal: number;
  cartItems: number;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const actionLabel: Record<string, string> = {
    added  : 'Item Added to Cart',
    removed: 'Item Removed from Cart',
    cleared: 'Cart Cleared',
  };

  const itemBlock = opts.item ? `
    <tr>
      <td style="padding:16px 40px;border-bottom:1px solid #f0f0f0;">
        <p style="margin:0 0 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.3em;color:#aaa;">Item</p>
        <table style="border-collapse:collapse;width:100%;">
          ${opts.item.name ? `<tr><td style="padding:4px 0;font-size:11px;color:#aaa;width:80px;">Style</td><td style="font-size:13px;">${opts.item.name}</td></tr>` : ''}
          ${opts.item.brand_name ? `<tr><td style="padding:4px 0;font-size:11px;color:#aaa;">Brand</td><td style="font-size:13px;">${opts.item.brand_name}</td></tr>` : ''}
          ${opts.item.size ? `<tr><td style="padding:4px 0;font-size:11px;color:#aaa;">Size</td><td style="font-size:13px;">${opts.item.size}</td></tr>` : ''}
          ${opts.item.quantity ? `<tr><td style="padding:4px 0;font-size:11px;color:#aaa;">Qty</td><td style="font-size:13px;">${opts.item.quantity}</td></tr>` : ''}
          ${opts.item.wholesale_price ? `<tr><td style="padding:4px 0;font-size:11px;color:#aaa;">WSP</td><td style="font-size:13px;font-weight:500;">${fmt(opts.item.wholesale_price)}</td></tr>` : ''}
        </table>
      </td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:system-ui,-apple-system,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:60px 20px;">
      <table width="540" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border:1px solid #ebebeb;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:2px solid #111;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.5em;text-transform:uppercase;color:#888;">Linezheets</p>
            <h1 style="margin:0;font-size:20px;font-weight:300;letter-spacing:0.05em;">${actionLabel[opts.action] ?? 'Cart Update'}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px ${opts.item ? '0' : ''};">
            <table style="border-collapse:collapse;width:100%;">
              <tr>
                <td style="padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#aaa;width:120px;">Buyer</td>
                <td style="padding:6px 0;font-size:13px;font-family:monospace;">${opts.email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#aaa;">Time</td>
                <td style="padding:6px 0;font-size:13px;">${opts.time}</td>
              </tr>
            </table>
          </td>
        </tr>
        ${itemBlock}
        <tr>
          <td style="padding:16px 40px 24px;border-top:2px solid #111;">
            <table width="100%">
              <tr>
                <td style="font-size:11px;text-transform:uppercase;letter-spacing:0.3em;color:#888;">Cart Total (WSP)</td>
                <td style="text-align:right;font-size:20px;font-weight:300;">${fmt(opts.cartTotal)}</td>
              </tr>
              <tr>
                <td style="font-size:11px;color:#aaa;padding-top:4px;">Units in cart</td>
                <td style="text-align:right;font-size:12px;color:#888;padding-top:4px;">${opts.cartItems}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:10px;color:#bbb;">Linezheets · Private Wholesale · <a href="https://linezheets.com" style="color:#c9a84c;text-decoration:none;">linezheets.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buyerInviteHtml(opts: { name: string; loginUrl: string }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:system-ui,-apple-system,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding:60px 20px;">
      <table width="540" cellpadding="0" cellspacing="0" style="margin:0 auto;background:#fff;border:1px solid #ebebeb;">
        <tr>
          <td style="padding:40px 48px 32px;border-bottom:2px solid #111;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.6em;text-transform:uppercase;color:#888;">Linezheets</p>
            <h1 style="margin:0;font-size:20px;font-weight:300;letter-spacing:0.08em;">You're invited</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 48px;text-align:center;">
            <p style="margin:0 0 8px;font-size:13px;color:#555;">Hello ${opts.name},</p>
            <p style="margin:0 0 28px;font-size:13px;color:#555;line-height:1.7;">
              Your access to the Linezheets private wholesale platform has been approved.<br>
              Complete your profile to start browsing the VIP catalog.
            </p>
            <a href="${opts.loginUrl}"
               style="display:inline-block;padding:14px 36px;background:#111;color:#fff;text-decoration:none;font-size:11px;letter-spacing:0.35em;text-transform:uppercase;">
              Access Platform
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 48px;background:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:10px;color:#bbb;">
              Linezheets · Private Wholesale · <a href="https://linezheets.com" style="color:#c9a84c;text-decoration:none;">linezheets.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
