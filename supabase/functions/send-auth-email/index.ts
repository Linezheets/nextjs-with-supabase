import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!
const HOOK_SECRET = Deno.env.get('SEND_EMAIL_HOOK_SECRET')!
const FROM_EMAIL = 'hello@linezheets.com'
const FROM_NAME = 'Linezheets'

interface AuthEmailPayload {
  user: { email: string }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
    token_new?: string
    token_hash_new?: string
  }
}

async function verifySignature(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get('x-supabase-signature')
  if (!signature || !HOOK_SECRET) return false
  const secret = HOOK_SECRET.replace('v1,whsec_', '')
  const keyData = Uint8Array.from(atob(secret), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const sigBytes = Uint8Array.from(atob(signature.replace('v1,', '')), c => c.charCodeAt(0))
  const bodyBytes = new TextEncoder().encode(body)
  return crypto.subtle.verify('HMAC', key, sigBytes, bodyBytes)
}

// ── Shared layout ─────────────────────────────────────────────────────────────

function layout(previewText: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Linezheets</title>
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
    body{margin:0!important;padding:0!important;width:100%!important;background-color:#f4f4f0;font-family:Georgia,'Times New Roman',Times,serif;color:#1a1a1a}
    @media only screen and (max-width:620px){
      .email-container{width:100%!important}
      .content-pad{padding:32px 24px!important}
      .btn-cta{padding:14px 28px!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f0;">

<!-- Preview text -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
  ${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f0;">
<tr><td align="center" style="padding:48px 16px 40px;">

  <table class="email-container" role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
    style="background-color:#ffffff;border:1px solid #e0deda;max-width:560px;width:100%;">

    <!-- Header / Logo -->
    <tr>
      <td align="center" style="padding:36px 40px 28px;border-bottom:1px solid #e8e4df;">
        <img src="https://linezheets.com/linezheets-logo.png" alt="Linezheets" width="140" height="auto"
          style="display:block;max-width:140px;" />
      </td>
    </tr>

    ${body}

    <!-- Footer -->
    <tr>
      <td style="padding:24px 40px;background-color:#f8f7f5;border-top:1px solid #e8e4df;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center">
              <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;color:#a09890;font-family:Georgia,'Times New Roman',serif;">
                Private Wholesale Platform
              </p>
              <p style="margin:0;font-size:11px;color:#b8b0a8;font-family:Georgia,'Times New Roman',serif;">
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
</html>`
}

function ctaButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;">
    <tr>
      <td align="center" style="background-color:#1a1a1a;">
        <a href="${url}" class="btn-cta"
          style="display:inline-block;padding:15px 40px;background-color:#1a1a1a;color:#ffffff;text-decoration:none;font-size:10px;font-weight:normal;letter-spacing:0.45em;text-transform:uppercase;font-family:Georgia,'Times New Roman',serif;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`
}

function safetyNote(text: string): string {
  return `<p style="margin:24px 0 0;font-size:11px;color:#b0a89f;text-align:center;line-height:1.6;font-family:Georgia,'Times New Roman',serif;">
    ${text}
  </p>`
}

// ── Email templates ───────────────────────────────────────────────────────────

function magicLinkEmail(confirmUrl: string): { subject: string; html: string } {
  return {
    subject: 'Your login link — Linezheets',
    html: layout(
      'Your secure login link is ready — click to access the platform.',
      `<tr>
        <td class="content-pad" style="padding:44px 48px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.45em;text-transform:uppercase;color:#c9a84c;font-family:Georgia,'Times New Roman',serif;">
            Secure Access
          </p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:400;letter-spacing:0.04em;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;">
            Welcome back.
          </h1>
          <p style="margin:0;font-size:14px;color:#6b6259;line-height:1.8;font-family:Georgia,'Times New Roman',serif;max-width:380px;margin:0 auto;">
            Use the button below to sign in to your Linezheets account. This link is valid for <strong style="color:#1a1a1a;">one hour</strong> and can only be used once.
          </p>
          ${ctaButton(confirmUrl, 'Log In to Linezheets')}
          ${safetyNote("If you didn't request this link, you can safely ignore this email.<br>Your account remains secure.")}
        </td>
      </tr>`
    ),
  }
}

function signupEmail(confirmUrl: string): { subject: string; html: string } {
  return {
    subject: 'Confirm your Linezheets account',
    html: layout(
      'One step away — confirm your email to access the private wholesale platform.',
      `<tr>
        <td class="content-pad" style="padding:44px 48px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.45em;text-transform:uppercase;color:#c9a84c;font-family:Georgia,'Times New Roman',serif;">
            Account Confirmation
          </p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:400;letter-spacing:0.04em;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;">
            Confirm your email.
          </h1>
          <p style="margin:0 auto;font-size:14px;color:#6b6259;line-height:1.8;font-family:Georgia,'Times New Roman',serif;max-width:380px;">
            Thank you for joining Linezheets. Confirm your email address to complete your account setup and gain access to the private wholesale catalog.
          </p>
          ${ctaButton(confirmUrl, 'Confirm Email Address')}
          ${safetyNote("If you didn't create a Linezheets account, you can safely ignore this email.")}
        </td>
      </tr>`
    ),
  }
}

function recoveryEmail(confirmUrl: string): { subject: string; html: string } {
  return {
    subject: 'Reset your Linezheets password',
    html: layout(
      'A password reset was requested for your account.',
      `<tr>
        <td class="content-pad" style="padding:44px 48px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.45em;text-transform:uppercase;color:#c9a84c;font-family:Georgia,'Times New Roman',serif;">
            Password Reset
          </p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:400;letter-spacing:0.04em;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;">
            Reset your password.
          </h1>
          <p style="margin:0 auto;font-size:14px;color:#6b6259;line-height:1.8;font-family:Georgia,'Times New Roman',serif;max-width:380px;">
            We received a request to reset the password on your Linezheets account. Click below to choose a new password. This link expires in <strong style="color:#1a1a1a;">one hour</strong>.
          </p>
          ${ctaButton(confirmUrl, 'Reset Password')}
          ${safetyNote("If you didn't request a password reset, please ignore this email.<br>Your account has not been changed.")}
        </td>
      </tr>`
    ),
  }
}

function emailChangeEmail(confirmUrl: string): { subject: string; html: string } {
  return {
    subject: 'Confirm your new email — Linezheets',
    html: layout(
      'Confirm your new email address to update your Linezheets account.',
      `<tr>
        <td class="content-pad" style="padding:44px 48px 40px;text-align:center;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.45em;text-transform:uppercase;color:#c9a84c;font-family:Georgia,'Times New Roman',serif;">
            Email Change
          </p>
          <h1 style="margin:0 0 16px;font-size:26px;font-weight:400;letter-spacing:0.04em;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;">
            Confirm your new email.
          </h1>
          <p style="margin:0 auto;font-size:14px;color:#6b6259;line-height:1.8;font-family:Georgia,'Times New Roman',serif;max-width:380px;">
            Click below to confirm this as the new email address for your Linezheets account.
          </p>
          ${ctaButton(confirmUrl, 'Confirm New Email')}
          ${safetyNote("If you didn't request this change, please contact us immediately at<br><a href='mailto:hello@linezheets.com' style='color:#c9a84c;text-decoration:none;'>hello@linezheets.com</a>")}
        </td>
      </tr>`
    ),
  }
}

function getEmailContent(type: string, data: AuthEmailPayload['email_data']): { subject: string; html: string } {
  const { token_hash, redirect_to, site_url } = data
  const baseUrl = site_url || 'https://linezheets.com'
  const confirmUrl = `${baseUrl}/auth/confirm?token_hash=${token_hash}&type=${type}&next=${encodeURIComponent(redirect_to || '/')}`

  switch (type) {
    case 'magiclink':
    case 'email':
      return magicLinkEmail(confirmUrl)
    case 'signup':
      return signupEmail(confirmUrl)
    case 'recovery':
      return recoveryEmail(confirmUrl)
    case 'email_change':
      return emailChangeEmail(confirmUrl)
    default:
      return magicLinkEmail(confirmUrl)
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    const body = await req.text()
    const valid = await verifySignature(req, body)
    if (!valid) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

    const payload: AuthEmailPayload = JSON.parse(body)
    const { user, email_data } = payload
    const { subject, html } = getEmailContent(email_data.email_action_type, email_data)

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: user.email }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('SendGrid error:', err)
      return new Response(JSON.stringify({ error: err }), { status: 500 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (e) {
    console.error('Hook error:', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
