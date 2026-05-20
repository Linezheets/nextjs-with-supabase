/**
 * Email template renderer.
 * Fetches the HTML template, substitutes {{variables}}, and returns the
 * final string ready to hand off to your send function.
 *
 * Usage (browser or Edge Function):
 *   import { renderBuyerMatch } from '/components/email-templates.js';
 *   const html = await renderBuyerMatch(data);
 */

const TEMPLATE_BASE = '/emails';

// ── Core renderer ─────────────────────────────────────────────────────────────

async function render(templateName, vars) {
  const res  = await fetch(`${TEMPLATE_BASE}/${templateName}.html`);
  let   html = await res.text();

  // Simple {{key}} substitution
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, value ?? '');
  }

  // {{#if key}} … {{/if}} block removal when value is falsy
  html = html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, block) =>
    vars[key] ? block : ''
  );

  return html;
}

// ── Inventory colour mapping ───────────────────────────────────────────────────

function invColor(status) {
  const map = {
    'Ready to Ship': '52b788',
    'Limited':       'c9a84c',
    'Low Stock':     'f97316',
    'Pre-Order':     '38bdf8',
    'Sold Out':      '888888',
  };
  return map[status] ?? '888888';
}

// ── Similar product cell HTML ─────────────────────────────────────────────────

function similarCell(product) {
  const img       = product.image_urls?.[0] ?? product.images?.[0] ?? '';
  const wholesale = parseFloat(product.wholesale_price ?? 0).toFixed(2);

  return `
  <td width="33%" style="padding:0 8px;vertical-align:top;text-align:center;">
    ${img
      ? `<img src="${img}" alt="${product.name}" width="140"
           style="width:140px;height:180px;object-fit:cover;display:block;margin:0 auto;
                  filter:grayscale(100%);-webkit-filter:grayscale(100%);" />`
      : `<div style="width:140px;height:180px;background:#eee;margin:0 auto;"></div>`}
    <p style="margin:10px 0 2px;font-family:Georgia,serif;font-size:12px;color:#000;">
      ${product.name}
    </p>
    <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#d4af37;">
      USD ${wholesale}
    </p>
  </td>`;
}

// ── renderBuyerMatch ──────────────────────────────────────────────────────────

/**
 * @param {object} data
 * @param {object} data.buyer          - { email, boutique_name, first_name }
 * @param {object} data.product        - product row from Supabase
 * @param {number} data.match_score    - 0–100
 * @param {string} data.match_factors  - e.g. "Style DNA · Price Point · Sell-Through"
 * @param {string} data.match_rationale - 1–2 sentence explanation
 * @param {object[]} [data.similar]    - up to 3 similar products
 * @param {object} data.sender         - { name, cities }
 * @param {string} data.showroom_url
 * @param {string} data.base_url       - e.g. "https://linezheets.com"
 */
export async function renderBuyerMatch(data) {
  const { buyer, product, match_score, match_factors, match_rationale, similar = [], sender, showroom_url, base_url = '' } = data;

  const retail     = parseFloat(product.retail_price ?? product.msrp ?? 0);
  const wholesale  = parseFloat(product.wholesale_price ?? product.calculated_wholesale_price ?? retail / 2.5);
  const retailEur  = (retail * 0.92).toFixed(2);
  const wsDisplay  = wholesale.toFixed(2);

  const productImg  = product.image_urls?.[0] ?? product.images?.[0] ?? '';
  const heroImg     = productImg; // could be a different brand/campaign image

  const vars = {
    // Meta
    subject         : `${match_score}% Match — ${product.name ?? product.title} selected for ${buyer.boutique_name}`,
    current_season  : product.season ?? 'SS27',
    current_year    : new Date().getFullYear(),

    // Sender
    sender_name     : sender?.name ?? 'Linezheets',
    sender_cities   : sender?.cities ?? 'Paris · Hong Kong · London',

    // Buyer
    boutique_name   : buyer.boutique_name ?? buyer.company_name ?? 'Your Boutique',

    // Match
    match_score,
    match_factors   : match_factors ?? 'Style DNA · Price Point · Sell-Through',
    match_rationale : match_rationale ?? `Based on your previous acquisitions and current inventory profile, we identified this piece as a strong addition to your ${product.season ?? 'SS27'} curation. Its price point and silhouette align closely with your clients' purchasing behaviour.`,

    // Product
    product_name     : product.name ?? product.title,
    brand_name       : product.brand_name ?? sender?.name ?? '',
    product_category : product.category ?? '',
    style_number     : product.style_number ?? product.ref ?? '—',
    product_description : product.description ?? '',
    hero_image_url   : heroImg,
    product_image_url: productImg,
    inventory_status : product.inventory_status ?? 'Ready to Ship',
    inv_color        : invColor(product.inventory_status ?? 'Ready to Ship'),

    // Pricing
    retail_price      : retail.toFixed(2),
    retail_eur        : retailEur,
    wholesale_price   : wsDisplay,
    consignment_terms : product.consignment_terms ?? '70/30 Consignment',
    min_order_qty     : product.min_order_qty ?? '1',
    delivery_window   : product.delivery_window ?? 'Upon confirmation',

    // Links
    showroom_url     : showroom_url ?? `${base_url}/brands/${product.brand_slug ?? ''}`,
    decline_url      : `${base_url}/api/match/decline?buyer=${encodeURIComponent(buyer.email)}&product=${product.id}`,
    unsubscribe_url  : `${base_url}/api/unsubscribe?email=${encodeURIComponent(buyer.email)}`,
    preferences_url  : `${base_url}/shop#preferences`,

    // Similar products block
    similar_products    : similar.length > 0,
    similar_product_cells: similar.slice(0, 3).map(similarCell).join(''),
  };

  return render('buyer-match', vars);
}
