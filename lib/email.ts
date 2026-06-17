import sgMail from '@sendgrid/mail';

const FROM = process.env.EMAIL_FROM ?? 'Linezheets <hello@linezheets.com>';

export async function sendEmail(opts: {
  to     : string;
  subject: string;
  html   : string;
  text?  : string;
  from?  : string;   // optional override (e.g. "Brand via Linezheets <…>")
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.warn('[email] SENDGRID_API_KEY not set — skipping send to', opts.to);
    return { ok: false, error: 'SENDGRID_API_KEY not configured' };
  }
  sgMail.setApiKey(apiKey);
  try {
    await sgMail.send({
      from   : opts.from ?? FROM,
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

// ── Shared design system ───────────────────────────────────────────────────────

const LOGO = `<img src="https://linezheets.com/linezheets-logo.png" alt="Linezheets" width="140" height="auto" style="display:block;max-width:140px;" />`;

const SERIF = `Georgia,'Times New Roman',Times,serif`;

function layout(previewText: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
    body{margin:0!important;padding:0!important;width:100%!important;background-color:#f4f4f0;font-family:${SERIF};color:#1a1a1a}
    @media only screen and (max-width:620px){
      .email-wrap{width:100%!important}
      .pad{padding:28px 24px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f0;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f0;">
<tr><td align="center" style="padding:48px 16px 40px;">
  <table class="email-wrap" role="presentation" width="580" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#ffffff;border:1px solid #e0deda;max-width:580px;width:100%;">
    <tr>
      <td align="center" style="padding:32px 40px 28px;border-bottom:1px solid #e8e4df;">
        ${LOGO}
      </td>
    </tr>
    ${body}
    <tr>
      <td style="padding:22px 40px;background-color:#f8f7f5;border-top:1px solid #e8e4df;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <p style="margin:0 0 5px;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">Private Wholesale Platform</p>
              <p style="margin:0;font-size:11px;color:#b8b0a8;font-family:${SERIF};">
                <a href="https://linezheets.com" style="color:#c9a84c;text-decoration:none;">linezheets.com</a>
                &nbsp;·&nbsp;
                <a href="mailto:hello@linezheets.com" style="color:#b8b0a8;text-decoration:none;">hello@linezheets.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function label(text: string) {
  return `<p style="margin:0 0 6px;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">${text}</p>`;
}

function divider() {
  return `<tr><td style="padding:0 40px;"><div style="border-top:1px solid #e8e4df;"></div></td></tr>`;
}

// ── Templates ──────────────────────────────────────────────────────────────────

export function orderConfirmationHtml(order: {
  id              : string;
  buyer_name      : string;
  total_usd       : number;
  items           : Array<{ name?: string; brand_name?: string; sizes?: Record<string, number>; total_qty?: number; wsp_usd?: number }>;
  fulfillment_type?: string;
  terms?          : string;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  const isPreorder = order.fulfillment_type === 'FUTURE_ALLOCATION';

  const statusBadge = isPreorder
    ? `<span style="display:inline-block;background:#f5f0e8;color:#c9a84c;padding:3px 10px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;font-family:${SERIF};">Forward Allocation</span>`
    : `<span style="display:inline-block;background:#eef5ee;color:#3a7d44;padding:3px 10px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;font-family:${SERIF};">Confirmed</span>`;

  const itemRows = order.items.map((i, idx) => {
    const sizeStr = i.sizes
      ? Object.entries(i.sizes).map(([s, q]) => `${s}×${q}`).join(', ')
      : `Qty ${i.total_qty ?? 0}`;
    const bg = idx % 2 === 0 ? '#ffffff' : '#faf9f7';
    return `<tr style="background:${bg};">
      <td style="padding:10px 14px;font-size:12px;font-family:${SERIF};color:#1a1a1a;border-bottom:1px solid #f0ece8;">${i.name ?? '—'}</td>
      <td style="padding:10px 14px;font-size:12px;font-family:${SERIF};color:#6b6259;border-bottom:1px solid #f0ece8;">${i.brand_name ?? ''}</td>
      <td style="padding:10px 14px;font-size:11px;font-family:${SERIF};color:#6b6259;border-bottom:1px solid #f0ece8;">${sizeStr}</td>
      <td style="padding:10px 14px;font-size:12px;font-family:${SERIF};text-align:right;border-bottom:1px solid #f0ece8;">${i.wsp_usd ? fmt(i.wsp_usd) : '—'}</td>
    </tr>`;
  }).join('');

  return layout(
    `Order confirmed — ${order.buyer_name} · ${fmt(order.total_usd)} WSP`,
    `
    <!-- Heading -->
    <tr>
      <td class="pad" style="padding:40px 48px 32px;">
        ${label('Order Confirmation')}
        <h1 style="margin:0 0 6px;font-size:28px;font-weight:400;letter-spacing:0.03em;color:#1a1a1a;font-family:${SERIF};">Your order is confirmed.</h1>
        <p style="margin:0;font-size:14px;color:#6b6259;line-height:1.8;font-family:${SERIF};">Hello ${order.buyer_name}, thank you for your order on the Linezheets private wholesale platform.</p>
      </td>
    </tr>

    <!-- Order meta -->
    <tr>
      <td style="padding:0 48px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f5;border:1px solid #e8e4df;">
          <tr>
            <td style="padding:16px 20px;border-right:1px solid #e8e4df;width:50%;">
              ${label('Order ID')}
              <p style="margin:0;font-size:13px;font-family:monospace;color:#1a1a1a;">${order.id}</p>
            </td>
            <td style="padding:16px 20px;width:50%;">
              ${label('Status')}
              ${statusBadge}
            </td>
          </tr>
          ${order.terms ? `<tr><td colspan="2" style="padding:12px 20px;border-top:1px solid #e8e4df;">${label('Payment Terms')}<p style="margin:0;font-size:13px;font-family:${SERIF};color:#1a1a1a;">${order.terms}</p></td></tr>` : ''}
        </table>
      </td>
    </tr>

    <!-- Items table -->
    <tr>
      <td style="padding:0 48px 0;">
        ${label('Order Items')}
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4df;margin-top:8px;">
          <thead>
            <tr style="background:#f4f4f0;">
              <th style="padding:8px 14px;text-align:left;font-size:9px;font-weight:normal;letter-spacing:0.35em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">Style</th>
              <th style="padding:8px 14px;text-align:left;font-size:9px;font-weight:normal;letter-spacing:0.35em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">Brand</th>
              <th style="padding:8px 14px;text-align:left;font-size:9px;font-weight:normal;letter-spacing:0.35em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">Sizes</th>
              <th style="padding:8px 14px;text-align:right;font-size:9px;font-weight:normal;letter-spacing:0.35em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">WSP</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </td>
    </tr>

    <!-- Total -->
    <tr>
      <td style="padding:20px 48px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:11px;letter-spacing:0.35em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">Total (WSP)</td>
            <td style="text-align:right;font-size:26px;font-weight:400;font-family:${SERIF};color:#1a1a1a;">${fmt(order.total_usd)}</td>
          </tr>
        </table>
      </td>
    </tr>
    `
  );
}

export function buyerInviteHtml(opts: { name: string; loginUrl: string }) {
  return layout(
    `You've been granted access to Linezheets private wholesale — ${opts.name}`,
    `
    <tr>
      <td class="pad" style="padding:52px 48px 44px;text-align:center;">
        ${label('Exclusive Access')}
        <h1 style="margin:0 0 20px;font-size:28px;font-weight:400;letter-spacing:0.04em;color:#1a1a1a;font-family:${SERIF};">You're invited.</h1>
        <p style="margin:0 auto 8px;font-size:15px;color:#1a1a1a;font-family:${SERIF};">Hello ${opts.name},</p>
        <p style="margin:0 auto 32px;font-size:14px;color:#6b6259;line-height:1.9;font-family:${SERIF};max-width:400px;">
          Your access to the Linezheets private wholesale platform has been approved.
          Complete your profile to start browsing the curated catalog of luxury independent brands.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            <td style="background-color:#1a1a1a;">
              <a href="${opts.loginUrl}"
                style="display:inline-block;padding:15px 44px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;font-size:10px;letter-spacing:0.45em;text-transform:uppercase;font-family:${SERIF};">
                Access Platform
              </a>
            </td>
          </tr>
        </table>
        <p style="margin:28px auto 0;font-size:11px;color:#b8b0a8;line-height:1.6;font-family:${SERIF};">
          Questions? Reach us at <a href="mailto:hello@linezheets.com" style="color:#c9a84c;text-decoration:none;">hello@linezheets.com</a>
        </p>
      </td>
    </tr>
    `
  );
}

export function loginNotificationHtml(opts: { email: string; time: string; ip?: string }) {
  return layout(
    `New sign-in detected on your Linezheets account`,
    `
    <tr>
      <td class="pad" style="padding:40px 48px 36px;">
        ${label('Security Notice')}
        <h1 style="margin:0 0 20px;font-size:24px;font-weight:400;letter-spacing:0.03em;color:#1a1a1a;font-family:${SERIF};">New sign-in to your account.</h1>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4df;">
          <tr>
            <td style="padding:13px 18px;border-bottom:1px solid #e8e4df;width:110px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">Account</td>
            <td style="padding:13px 18px;border-bottom:1px solid #e8e4df;font-size:13px;font-family:monospace;color:#1a1a1a;">${opts.email}</td>
          </tr>
          <tr>
            <td style="padding:13px 18px;${opts.ip ? 'border-bottom:1px solid #e8e4df;' : ''}font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">Time</td>
            <td style="padding:13px 18px;${opts.ip ? 'border-bottom:1px solid #e8e4df;' : ''}font-size:13px;color:#1a1a1a;font-family:${SERIF};">${opts.time}</td>
          </tr>
          ${opts.ip ? `<tr>
            <td style="padding:13px 18px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">IP Address</td>
            <td style="padding:13px 18px;font-size:13px;font-family:monospace;color:#1a1a1a;">${opts.ip}</td>
          </tr>` : ''}
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#b8b0a8;line-height:1.7;font-family:${SERIF};">
          If this wasn't you, contact us immediately at <a href="mailto:hello@linezheets.com" style="color:#c9a84c;text-decoration:none;">hello@linezheets.com</a>
        </p>
      </td>
    </tr>
    `
  );
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

  const actionIcon: Record<string, string> = {
    added  : '+',
    removed: '−',
    cleared: '∅',
  };

  const itemBlock = opts.item ? `
    <tr>
      <td style="padding:0 48px 24px;">
        ${label('Item')}
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e4df;margin-top:8px;">
          ${opts.item.name ? `<tr><td style="padding:11px 18px;border-bottom:1px solid #f0ece8;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#a09890;width:100px;font-family:${SERIF};">Style</td><td style="padding:11px 18px;border-bottom:1px solid #f0ece8;font-size:13px;color:#1a1a1a;font-family:${SERIF};">${opts.item.name}</td></tr>` : ''}
          ${opts.item.brand_name ? `<tr><td style="padding:11px 18px;border-bottom:1px solid #f0ece8;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">Brand</td><td style="padding:11px 18px;border-bottom:1px solid #f0ece8;font-size:13px;color:#1a1a1a;font-family:${SERIF};">${opts.item.brand_name}</td></tr>` : ''}
          ${opts.item.size ? `<tr><td style="padding:11px 18px;border-bottom:1px solid #f0ece8;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">Size</td><td style="padding:11px 18px;border-bottom:1px solid #f0ece8;font-size:13px;color:#1a1a1a;font-family:${SERIF};">${opts.item.size}</td></tr>` : ''}
          ${opts.item.quantity ? `<tr><td style="padding:11px 18px;${opts.item.wholesale_price ? 'border-bottom:1px solid #f0ece8;' : ''}font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">Qty</td><td style="padding:11px 18px;${opts.item.wholesale_price ? 'border-bottom:1px solid #f0ece8;' : ''}font-size:13px;color:#1a1a1a;font-family:${SERIF};">${opts.item.quantity}</td></tr>` : ''}
          ${opts.item.wholesale_price ? `<tr><td style="padding:11px 18px;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#a09890;font-family:${SERIF};">WSP</td><td style="padding:11px 18px;font-size:14px;color:#1a1a1a;font-family:${SERIF};">${fmt(opts.item.wholesale_price)}</td></tr>` : ''}
        </table>
      </td>
    </tr>` : '';

  return layout(
    `${actionLabel[opts.action]} — ${opts.cartItems} item${opts.cartItems !== 1 ? 's' : ''} · ${fmt(opts.cartTotal)} WSP`,
    `
    <tr>
      <td class="pad" style="padding:40px 48px 28px;">
        ${label('Cart Update')}
        <h1 style="margin:0 0 4px;font-size:26px;font-weight:400;letter-spacing:0.03em;color:#1a1a1a;font-family:${SERIF};">
          <span style="color:#c9a84c;">${actionIcon[opts.action]}</span> ${actionLabel[opts.action] ?? 'Cart Update'}
        </h1>
        <p style="margin:0;font-size:12px;color:#a09890;font-family:${SERIF};">${opts.email} · ${opts.time}</p>
      </td>
    </tr>
    ${itemBlock}
    <tr>
      <td style="padding:0 48px 36px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7f5;border:1px solid #e8e4df;">
          <tr>
            <td style="padding:16px 20px;border-right:1px solid #e8e4df;">
              ${label('Cart Total (WSP)')}
              <p style="margin:0;font-size:22px;font-weight:400;font-family:${SERIF};color:#1a1a1a;">${fmt(opts.cartTotal)}</p>
            </td>
            <td style="padding:16px 20px;">
              ${label('Items in Cart')}
              <p style="margin:0;font-size:22px;font-weight:400;font-family:${SERIF};color:#1a1a1a;">${opts.cartItems}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `
  );
}

export function orderStatusUpdateHtml(opts: {
  buyer_name     : string;
  order_id       : string;
  status         : string;
  message?       : string;
  tracking_url?  : string;
  platform_url?  : string;
}) {
  const statusColors: Record<string, { bg: string; color: string }> = {
    shipped    : { bg: '#eef5ee', color: '#3a7d44' },
    processing : { bg: '#f5f0e8', color: '#c9a84c' },
    cancelled  : { bg: '#fdf0f0', color: '#c0392b' },
    delivered  : { bg: '#eef5ee', color: '#3a7d44' },
  };
  const sc = statusColors[opts.status.toLowerCase()] ?? { bg: '#f4f4f0', color: '#6b6259' };
  const statusBadge = `<span style="display:inline-block;background:${sc.bg};color:${sc.color};padding:3px 12px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;font-family:${SERIF};">${opts.status}</span>`;

  return layout(
    `Order update — ${opts.status} · #${opts.order_id}`,
    `
    <tr>
      <td class="pad" style="padding:44px 48px 36px;text-align:center;">
        ${label('Order Update')}
        <h1 style="margin:0 0 16px;font-size:26px;font-weight:400;letter-spacing:0.04em;color:#1a1a1a;font-family:${SERIF};">Your order has been updated.</h1>
        <p style="margin:0 auto 24px;font-size:14px;color:#6b6259;font-family:${SERIF};">Hello ${opts.buyer_name},</p>
        ${statusBadge}
        ${opts.message ? `<p style="margin:20px auto 0;font-size:14px;color:#6b6259;line-height:1.9;font-family:${SERIF};max-width:400px;">${opts.message}</p>` : ''}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid #e8e4df;">
          <tr>
            <td style="padding:13px 20px;font-size:10px;letter-spacing:0.35em;text-transform:uppercase;color:#a09890;font-family:${SERIF};width:110px;">Order ID</td>
            <td style="padding:13px 20px;font-size:13px;font-family:monospace;color:#1a1a1a;">${opts.order_id}</td>
          </tr>
        </table>

        ${opts.tracking_url ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 0;">
          <tr>
            <td style="background-color:#1a1a1a;">
              <a href="${opts.tracking_url}" style="display:inline-block;padding:14px 36px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;font-size:10px;letter-spacing:0.45em;text-transform:uppercase;font-family:${SERIF};">
                Track Shipment
              </a>
            </td>
          </tr>
        </table>` : ''}

        ${opts.platform_url ? `<p style="margin:16px 0 0;font-size:12px;font-family:${SERIF};"><a href="${opts.platform_url}" style="color:#c9a84c;text-decoration:none;">View order on Linezheets →</a></p>` : ''}
      </td>
    </tr>
    `
  );
}
