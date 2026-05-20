/**
 * Supabase Edge Function: send-buyer-match
 *
 * Triggered manually or via Supabase cron / database webhook.
 *
 * POST body:
 * {
 *   buyer_id      : string   // buyers.id
 *   product_id    : string   // products.id
 *   match_score   : number   // 0–100
 *   match_factors : string   // "Style DNA · Price Point"
 *   match_rationale: string  // 1–2 sentence AI explanation
 *   similar_ids   : string[] // optional – up to 3 product IDs
 * }
 *
 * Env vars required (set in Supabase dashboard):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY
 *   SITE_URL                 // e.g. https://linezheets.com
 *   FROM_EMAIL               // e.g. intelligence@linezheets.com
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend }        from 'https://esm.sh/resend@3';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const resend   = new Resend(Deno.env.get('RESEND_API_KEY')!);
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://linezheets.com';
const FROM     = Deno.env.get('FROM_EMAIL') ?? 'intelligence@linezheets.com';

// ── Template renderer (inline — Edge Functions can't fetch local files) ───────

function inv_color(status: string) {
  const map: Record<string, string> = {
    'Ready to Ship': '52b788',
    'Limited':       'c9a84c',
    'Low Stock':     'f97316',
    'Pre-Order':     '38bdf8',
    'Sold Out':      '888888',
  };
  return map[status] ?? '888888';
}

function render(template: string, vars: Record<string, any>): string {
  let html = template;
  for (const [k, v] of Object.entries(vars)) {
    html = html.replaceAll(`{{${k}}}`, String(v ?? ''));
  }
  // {{#if key}} … {{/if}}
  html = html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, block) => vars[key] ? block : ''
  );
  return html;
}

function similarCell(p: any) {
  const img = p.image_urls?.[0] ?? p.images?.[0] ?? '';
  const ws  = parseFloat(p.wholesale_price ?? 0).toFixed(2);
  return `
  <td width="33%" style="padding:0 8px;vertical-align:top;text-align:center;">
    ${img ? `<img src="${img}" alt="${p.name}" width="140"
      style="width:140px;height:180px;object-fit:cover;display:block;margin:0 auto;
             filter:grayscale(100%);-webkit-filter:grayscale(100%);" />` : ''}
    <p style="margin:10px 0 2px;font-family:Georgia,serif;font-size:12px;color:#000;">${p.name}</p>
    <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#d4af37;">USD ${ws}</p>
  </td>`;
}

// ── Template HTML (stored inline for Edge Function portability) ───────────────
// In a real deploy you'd store this in Supabase Storage and fetch it,
// or keep it as a string constant here.
const TEMPLATE_URL = `${SITE_URL}/emails/buyer-match.html`;

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const {
      buyer_id,
      product_id,
      match_score   = 90,
      match_factors = 'Style DNA · Price Point · Sell-Through',
      match_rationale,
      similar_ids   = [],
    } = await req.json();

    if (!buyer_id || !product_id) {
      return Response.json({ error: 'buyer_id and product_id are required' }, { status: 400 });
    }

    // ── Fetch buyer ───────────────────────────────────────────────────────────
    const { data: buyer, error: buyerErr } = await supabase
      .from('buyers')
      .select('id, company_name, user_id, users(email, first_name)')
      .eq('id', buyer_id)
      .single();

    if (buyerErr || !buyer) return Response.json({ error: 'Buyer not found' }, { status: 404 });

    const email      = (buyer as any).users?.email;
    const firstName  = (buyer as any).users?.first_name ?? '';
    const boutique   = buyer.company_name ?? 'Your Boutique';

    // ── Fetch product ─────────────────────────────────────────────────────────
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select(`
        id, name, category, season, wholesale_price, msrp,
        images, style_number, description, min_order_qty,
        delivery_window, inventory_status,
        brands ( name, logo_url, slug:brand_stores(slug) )
      `)
      .eq('id', product_id)
      .single();

    if (prodErr || !product) return Response.json({ error: 'Product not found' }, { status: 404 });

    const brand      = (product as any).brands;
    const brandSlug  = brand?.slug?.[0]?.slug ?? '';
    const retail     = parseFloat(product.msrp ?? 0);
    const wholesale  = parseFloat(product.wholesale_price ?? 0);

    // ── Fetch similar products ────────────────────────────────────────────────
    let similar: any[] = [];
    if (similar_ids.length) {
      const { data: sims } = await supabase
        .from('products')
        .select('id, name, images, wholesale_price')
        .in('id', similar_ids.slice(0, 3));
      similar = sims ?? [];
    }

    // ── Fetch template HTML ───────────────────────────────────────────────────
    const tmplRes = await fetch(TEMPLATE_URL);
    if (!tmplRes.ok) throw new Error('Could not load email template');
    const templateHtml = await tmplRes.text();

    // ── Render ────────────────────────────────────────────────────────────────
    const heroImg    = product.images?.[0] ?? '';
    const rationale  = match_rationale
      ?? `Based on ${boutique}'s previous acquisitions and current inventory profile, we identified this piece as a strong addition to your ${product.season ?? 'SS27'} curation. Its price point and silhouette align closely with your clients' purchasing behaviour.`;

    const vars = {
      subject          : `${match_score}% Match — ${product.name} selected for ${boutique}`,
      current_season   : product.season ?? 'SS27',
      current_year     : new Date().getFullYear(),
      sender_name      : 'Linezheets',
      sender_cities    : 'Paris · Hong Kong · London',
      boutique_name    : boutique,
      match_score,
      match_factors,
      match_rationale  : rationale,
      product_name     : product.name,
      brand_name       : brand?.name ?? '',
      product_category : product.category ?? '',
      style_number     : product.style_number ?? '—',
      product_description: product.description ?? '',
      hero_image_url   : heroImg,
      product_image_url: heroImg,
      inventory_status : product.inventory_status ?? 'Ready to Ship',
      inv_color        : inv_color(product.inventory_status ?? 'Ready to Ship'),
      retail_price     : retail.toFixed(2),
      retail_eur       : (retail * 0.92).toFixed(2),
      wholesale_price  : wholesale.toFixed(2),
      consignment_terms: '70/30 Consignment',
      min_order_qty    : product.min_order_qty ?? '1',
      delivery_window  : product.delivery_window ?? 'Upon confirmation',
      showroom_url     : `${SITE_URL}/brands/${brandSlug}`,
      decline_url      : `${SITE_URL}/api/match/decline?buyer=${encodeURIComponent(email)}&product=${product.id}`,
      unsubscribe_url  : `${SITE_URL}/api/unsubscribe?email=${encodeURIComponent(email)}`,
      preferences_url  : `${SITE_URL}/shop#preferences`,
      similar_products     : similar.length > 0,
      similar_product_cells: similar.map(similarCell).join(''),
    };

    const html = render(templateHtml, vars);

    // ── Send via Resend ───────────────────────────────────────────────────────
    const { data: sent, error: sendErr } = await resend.emails.send({
      from   : `Linezheets Intelligence <${FROM}>`,
      to     : [email],
      subject: vars.subject,
      html,
    });

    if (sendErr) throw sendErr;

    // ── Log in Supabase ───────────────────────────────────────────────────────
    await supabase.from('email_logs').insert({
      buyer_id,
      product_id,
      template     : 'buyer-match',
      match_score,
      resend_id    : sent?.id,
      sent_at      : new Date().toISOString(),
    });

    return Response.json({ ok: true, email_id: sent?.id });

  } catch (err: any) {
    console.error('[send-buyer-match]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
