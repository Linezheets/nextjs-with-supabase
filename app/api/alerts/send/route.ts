import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';

// POST — trigger an alert for all users who favorited item_id
// Sends in-app alert row + email if pref enabled
// Called internally (e.g. from admin or webhook)

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Require service-role or internal call — check secret header
  const secret = req.headers.get('x-internal-secret');
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { item_type, item_id, item_label, alert_type, title, body } = await req.json();
  if (!item_type || !item_id || !alert_type || !title) {
    return NextResponse.json({ error: 'item_type, item_id, alert_type, title required' }, { status: 400 });
  }

  // Find all buyers who favorited this item
  const { data: favorites, error: favErr } = await supabase
    .from('buyer_favorites')
    .select('user_id')
    .eq('item_type', item_type)
    .eq('item_id', item_id);

  if (favErr) return NextResponse.json({ error: favErr.message }, { status: 500 });
  if (!favorites?.length) return NextResponse.json({ sent: 0 });

  const userIds = favorites.map((f: { user_id: string }) => f.user_id);

  // Fetch prefs + emails for these users
  const { data: prefs } = await supabase
    .from('buyer_alert_prefs')
    .select('user_id, email_alerts, in_app_alerts, alert_on')
    .in('user_id', userIds);

  type PrefRow = { user_id: string; email_alerts: boolean; in_app_alerts: boolean; alert_on: string[] };
  const prefsMap = Object.fromEntries((prefs ?? []).map((p: PrefRow) => [p.user_id, p]));

  // Insert in-app alerts
  const inAppRows = userIds
    .filter((uid: string) => {
      const pref = prefsMap[uid];
      if (!pref) return true; // default on
      return pref.in_app_alerts && pref.alert_on?.includes(alert_type);
    })
    .map((uid: string) => ({ user_id: uid, item_type, item_id, item_label, alert_type, title, body }));

  if (inAppRows.length) {
    await supabase.from('buyer_alerts').insert(inAppRows);
  }

  // Send emails
  const emailUserIds = userIds.filter((uid: string) => {
    const pref = prefsMap[uid];
    if (!pref) return true;
    return pref.email_alerts && pref.alert_on?.includes(alert_type);
  });

  let emailsSent = 0;
  if (emailUserIds.length) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const emailMap = Object.fromEntries(
      (users?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email])
    );

    const results = await Promise.allSettled(
      emailUserIds.map(async (uid: string) => {
        const email = emailMap[uid];
        if (!email) return false;
        const res = await sendEmail({
          to     : email,
          subject: title,
          html   : buildEmailHtml({ title, body: body ?? '', item_label: item_label ?? item_id, alert_type }),
        });
        return res.ok;
      })
    );
    emailsSent = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  }

  return NextResponse.json({ sent: inAppRows.length, emails: emailsSent });
}

function buildEmailHtml({ title, body, item_label, alert_type }: {
  title: string; body: string; item_label: string; alert_type: string;
}) {
  const badgeColor: Record<string, string> = {
    new_stock      : '#52b788',
    price_change   : '#c9a84c',
    promotion      : '#c9a84c',
    new_collection : '#7cb9e8',
  };
  const color = badgeColor[alert_type] ?? '#aaa';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f9;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-top:2px solid ${color};">
        <tr><td style="padding:40px 48px 32px;">
          <p style="margin:0 0 6px;font-size:9px;text-transform:uppercase;letter-spacing:0.5em;color:#c9a84c;">
            Linezheets Private Showroom
          </p>
          <h1 style="margin:0 0 24px;font-size:26px;font-weight:400;color:#0a0a0a;line-height:1.15;
                     font-family:Georgia,'Times New Roman',serif;">
            ${title}
          </h1>
          <p style="margin:0 0 8px;font-size:9px;text-transform:uppercase;letter-spacing:0.35em;color:#bbb;">
            Re: ${item_label}
          </p>
          ${body ? `<p style="margin:0 0 32px;font-size:13px;line-height:1.8;color:#555;">${body}</p>` : ''}
          <a href="https://linezheets.com/dashboard/favorites"
             style="display:inline-block;padding:12px 32px;background:#111;color:#fff;
                    font-size:9px;text-transform:uppercase;letter-spacing:0.45em;text-decoration:none;">
            View Favourites →
          </a>
        </td></tr>
        <tr><td style="padding:24px 48px;border-top:1px solid #f0f0f0;">
          <p style="margin:0;font-size:9px;color:#ccc;text-transform:uppercase;letter-spacing:0.3em;">
            © Linezheets · <span style="color:#c9a84c;">Linezheets</span> ·
            <a href="https://linezheets.com/dashboard/favorites" style="color:#bbb;text-decoration:none;">
              Manage alerts
            </a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
