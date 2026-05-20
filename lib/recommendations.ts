// ── Buyer matching ────────────────────────────────────────────────────────────

export type MatchedBuyer = {
  id         : string;
  email      : string;
  store_name : string;
  city       : string | null;
  country    : string;
  match_score: number;
  match_reasons: string[];
};

type BuyerRow = {
  id             : string;
  email          : string;
  store_name     : string;
  city           : string | null;
  country        : string;
  categories_sold: string[];
  market_segment : string | null;
  price_range_max: number | null;
  status         : string;
};

type AnalysisRow = {
  buyer_id        : string;
  category_weights: Record<string, number>;
  price_sensitivity: string | null;
  brand_affinities : string[];
};

type Targeting = {
  categories?      : string[];
  market_segments? : string[];
  price_max?       : number;
  all_buyers?      : boolean;
};

export function scoreBuyer(
  buyer   : BuyerRow,
  analysis: AnalysisRow | undefined,
  targeting: Targeting,
  productCategories: string[],
  brandName: string,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (targeting.all_buyers) return { score: 50, reasons: ['All active buyers'] };

  // Category overlap with buyer's assortment (up to 35 pts)
  if (productCategories.length && buyer.categories_sold?.length) {
    const overlap = productCategories.filter(c =>
      buyer.categories_sold.some(bc => bc.toLowerCase() === c.toLowerCase())
    );
    if (overlap.length) {
      const pts = Math.round((overlap.length / productCategories.length) * 35);
      score += pts;
      reasons.push(`Carries ${overlap.join(', ')}`);
    }
  }

  // Category weights from AI analysis (up to 30 pts)
  if (analysis?.category_weights && productCategories.length) {
    const weightSum = productCategories.reduce((s, c) => {
      const w = analysis.category_weights[c.toUpperCase()] ?? analysis.category_weights[c] ?? 0;
      return s + w;
    }, 0);
    const avg = weightSum / productCategories.length;
    if (avg > 0.5) {
      const pts = Math.round(avg * 30);
      score += pts;
      reasons.push('High affinity for product categories');
    }
  }

  // Market segment match (15 pts)
  if (targeting.market_segments?.length && buyer.market_segment) {
    if (targeting.market_segments.includes(buyer.market_segment)) {
      score += 15;
      reasons.push(`${buyer.market_segment} buyer`);
    }
  } else if (!targeting.market_segments?.length) {
    // no filter = everyone qualifies
    score += 5;
  }

  // Price ceiling filter (10 pts if within range, 0 if over)
  if (targeting.price_max && buyer.price_range_max) {
    if (buyer.price_range_max >= targeting.price_max * 0.5) {
      score += 10;
      reasons.push('Budget matches price range');
    }
  } else if (!targeting.price_max) {
    score += 5;
  }

  // Brand affinity bonus (10 pts)
  if (analysis?.brand_affinities?.some(b => b.toLowerCase().includes(brandName.toLowerCase()))) {
    score += 10;
    reasons.push('Has brand affinity');
  }

  return { score: Math.min(score, 100), reasons };
}

// ── Email HTML builder ────────────────────────────────────────────────────────

export type RecommendationEmailProps = {
  brandName   : string;
  storeName   : string;
  subject     : string;
  message     : string;
  products    : { title: string; brand_name: string; srp: number; category: string; image_url: string | null }[];
  marketplaceUrl: string;
};

export function buildRecommendationEmail(p: RecommendationEmailProps): string {
  const gold = '#c9a84c';

  const productCards = p.products.slice(0, 6).map(prod => {
    const img = prod.image_url
      ? `<img src="${prod.image_url}" alt="${esc(prod.title)}" width="140" height="186" style="display:block;width:140px;height:186px;object-fit:cover;border:0;" />`
      : `<div style="width:140px;height:186px;background:#f4f4f4;display:flex;align-items:center;justify-content:center;"></div>`;

    return `
    <td width="160" valign="top" style="padding:0 8px 24px;">
      <table width="140" cellpadding="0" cellspacing="0" border="0">
        <tr><td>${img}</td></tr>
        <tr><td style="padding-top:10px;">
          <p style="margin:0 0 2px;font-size:12px;font-family:Georgia,'Times New Roman',serif;color:#111;line-height:1.3;">${esc(prod.title)}</p>
          <p style="margin:0 0 4px;font-size:8px;text-transform:uppercase;letter-spacing:0.3em;color:#bbb;font-family:system-ui,sans-serif;">${esc(prod.brand_name)}</p>
          <p style="margin:0;font-size:11px;font-family:monospace;color:${gold};">$${prod.srp.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</p>
        </td></tr>
      </table>
    </td>`;
  }).join('');

  // Group into rows of 3
  const productRows: string[] = [];
  const cards = p.products.slice(0, 6);
  for (let i = 0; i < cards.length; i += 3) {
    const row = cards.slice(i, i + 3).map(prod => {
      const img = prod.image_url
        ? `<img src="${prod.image_url}" alt="${esc(prod.title)}" width="140" style="display:block;width:140px;height:186px;object-fit:cover;" />`
        : `<div style="width:140px;height:186px;background:#f0f0f0;"></div>`;
      return `
        <td width="160" valign="top" style="padding:0 8px 28px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr><td>${img}</td></tr>
            <tr><td style="padding-top:10px;width:140px;">
              <p style="margin:0 0 2px;font-size:12px;font-family:Georgia,serif;color:#111;line-height:1.3;">${esc(prod.title)}</p>
              <p style="margin:0 0 4px;font-size:8px;text-transform:uppercase;letter-spacing:0.3em;color:#bbb;font-family:system-ui,sans-serif;">${esc(prod.brand_name)}</p>
              <p style="margin:0;font-size:11px;font-family:'Courier New',monospace;color:${gold};">$${prod.srp.toLocaleString()}</p>
            </td></tr>
          </table>
        </td>`;
    }).join('');
    productRows.push(`<tr>${row}</tr>`);
  }

  void productCards; // used productRows instead

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(p.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f2ee;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2ee;padding:40px 16px;">
<tr><td align="center">

  <!-- Outer card -->
  <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;max-width:560px;width:100%;">

    <!-- Gold top bar -->
    <tr><td style="height:3px;background:${gold};font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Header -->
    <tr><td style="padding:36px 48px 28px;border-bottom:1px solid #f0f0f0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-size:8px;text-transform:uppercase;letter-spacing:0.55em;color:${gold};font-family:system-ui,sans-serif;">
              ${esc(p.brandName)}
            </p>
            <h1 style="margin:0;font-size:24px;font-weight:400;color:#0a0a0a;line-height:1.15;font-family:Georgia,'Times New Roman',serif;">
              Curated for ${esc(p.storeName)}
            </h1>
          </td>
          <td width="80" valign="top" style="text-align:right;">
            <p style="margin:0;font-size:8px;text-transform:uppercase;letter-spacing:0.4em;color:#bbb;font-family:system-ui,sans-serif;">
              Private<br>Showroom
            </p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Brand message -->
    ${p.message ? `
    <tr><td style="padding:28px 48px 0;">
      <p style="margin:0;font-size:13px;line-height:1.85;color:#444;font-family:Georgia,'Times New Roman',serif;font-style:italic;">
        "${esc(p.message)}"
      </p>
    </td></tr>` : ''}

    <!-- Section label -->
    <tr><td style="padding:32px 48px 20px;">
      <p style="margin:0;font-size:7.5px;text-transform:uppercase;letter-spacing:0.55em;color:#bbb;font-family:system-ui,sans-serif;">
        Recommended Pieces · ${p.products.length} selected
      </p>
    </td></tr>

    <!-- Product grid -->
    <tr><td style="padding:0 40px 8px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${productRows.join('')}
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:24px 48px 36px;border-top:1px solid #f0f0f0;text-align:center;">
      <a href="${p.marketplaceUrl}"
         style="display:inline-block;padding:13px 40px;background:#111;color:#fff;font-size:8.5px;text-transform:uppercase;letter-spacing:0.5em;text-decoration:none;font-family:system-ui,sans-serif;">
        Browse Full Collection →
      </a>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:20px 48px;background:#faf8f5;border-top:1px solid #eee;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <p style="margin:0;font-size:8px;font-family:Georgia,serif;letter-spacing:0.4em;color:#bbb;">
              MXLLA PRIVATE SHOWROOM
            </p>
          </td>
          <td align="right">
            <p style="margin:0;font-size:8px;color:#ccc;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:0.2em;">
              <a href="${p.marketplaceUrl}" style="color:${gold};text-decoration:none;">Log in to order</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>

  </table>
  <!-- /Outer card -->

</td></tr>
</table>
</body>
</html>`;
}

function esc(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Promotion email builder ───────────────────────────────────────────────────

export type PromotionEmailProps = {
  brandName     : string;
  storeName     : string;
  tier          : string;          // 'Platinum' | 'Gold' | 'Silver' | 'Rising'
  headline      : string;          // e.g. "Order 10+ pieces, get 15% off"
  description   : string;
  promoType     : string;          // e.g. 'volume_discount'
  discountPct   : number;
  expiresAt     : string | null;   // ISO string or null
  products      : { title: string; brand_name: string; srp: number; image_url: string | null }[];
  marketplaceUrl: string;
};

export function buildPromotionEmail(p: PromotionEmailProps): string {
  const gold   = '#c9a84c';
  const tierColors: Record<string, string> = {
    platinum: '#c9a84c',
    gold    : '#e8a838',
    silver  : '#a0a0a0',
    rising  : '#7cb9e8',
  };
  const tierColor = tierColors[p.tier.toLowerCase()] ?? gold;
  const promoLabels: Record<string, string> = {
    volume_discount : `Order discount · ${p.discountPct}% off`,
    spend_threshold : `Spend & save · ${p.discountPct}% off`,
    category_deal   : `Category offer · ${p.discountPct}% off`,
    loyalty_reward  : `Loyalty reward · ${p.discountPct}% off`,
  };
  const promoLabel = promoLabels[p.promoType] ?? `${p.discountPct}% off`;

  const productCards = p.products.slice(0, 6);
  const rows: string[] = [];
  for (let i = 0; i < productCards.length; i += 3) {
    const cells = productCards.slice(i, i + 3).map(prod => {
      const img = prod.image_url
        ? `<img src="${prod.image_url}" alt="${esc(prod.title)}" width="140" style="display:block;width:140px;height:186px;object-fit:cover;" />`
        : `<div style="width:140px;height:186px;background:#f0f0f0;"></div>`;
      return `
        <td width="160" valign="top" style="padding:0 8px 28px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr><td>${img}</td></tr>
            <tr><td style="padding-top:10px;width:140px;">
              <p style="margin:0 0 2px;font-size:12px;font-family:Georgia,serif;color:#111;line-height:1.3;">${esc(prod.title)}</p>
              <p style="margin:0 0 4px;font-size:8px;text-transform:uppercase;letter-spacing:0.3em;color:#bbb;font-family:system-ui,sans-serif;">${esc(prod.brand_name)}</p>
              <p style="margin:0;font-size:11px;font-family:'Courier New',monospace;color:${gold};">$${prod.srp.toLocaleString()}</p>
            </td></tr>
          </table>
        </td>`;
    }).join('');
    rows.push(`<tr>${cells}</tr>`);
  }

  const expiryLine = p.expiresAt
    ? `<p style="margin:0 0 0 0;font-size:9px;color:#bbb;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:0.3em;">
         Offer expires ${new Date(p.expiresAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}
       </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(p.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;padding:40px 16px;">
<tr><td align="center">

  <table width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;max-width:560px;width:100%;">

    <!-- Tier accent bar -->
    <tr><td style="height:3px;background:${tierColor};font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- Dark header -->
    <tr><td style="padding:36px 48px 32px;background:#0d0d0d;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <p style="margin:0 0 6px;font-size:8px;text-transform:uppercase;letter-spacing:0.55em;color:${tierColor};font-family:system-ui,sans-serif;">
              ${esc(p.brandName)} · ${esc(p.tier)} Account
            </p>
            <h1 style="margin:0;font-size:28px;font-weight:400;color:#f8f8f8;line-height:1.1;font-family:Georgia,'Times New Roman',serif;">
              ${esc(p.headline)}
            </h1>
          </td>
          <td width="60" valign="top" style="text-align:right;padding-top:4px;">
            <div style="display:inline-block;padding:8px 12px;border:1px solid ${tierColor};">
              <p style="margin:0;font-size:18px;font-weight:700;color:${tierColor};font-family:'Courier New',monospace;line-height:1;">
                ${p.discountPct}%
              </p>
              <p style="margin:2px 0 0;font-size:7px;text-transform:uppercase;letter-spacing:0.3em;color:#666;font-family:system-ui,sans-serif;">off</p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- Offer detail band -->
    <tr><td style="padding:18px 48px;background:#111111;border-bottom:1px solid #1e1e1e;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <p style="margin:0;font-size:8px;text-transform:uppercase;letter-spacing:0.4em;color:#666;font-family:system-ui,sans-serif;">${esc(promoLabel)}</p>
          </td>
          <td align="right">
            ${expiryLine}
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- White body -->
    <tr><td style="padding:32px 48px ${productCards.length ? '8px' : '36px'};">
      <p style="margin:0;font-size:13px;line-height:1.9;color:#444;font-family:system-ui,sans-serif;">
        ${esc(p.description || `As one of our valued ${p.tier} accounts, we're extending this exclusive offer to you.`)}
      </p>
      <p style="margin:20px 0 0;font-size:11px;color:#888;font-family:system-ui,sans-serif;line-height:1.7;">
        Log in to the MXLLA Private Showroom to apply your discount. It will be activated automatically when you browse the marketplace.
      </p>
    </td></tr>

    ${productCards.length ? `
    <!-- Featured products -->
    <tr><td style="padding:24px 40px 8px;">
      <p style="margin:0 0 20px;font-size:7.5px;text-transform:uppercase;letter-spacing:0.55em;color:#bbb;font-family:system-ui,sans-serif;">
        Featured this season
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.join('')}
      </table>
    </td></tr>` : ''}

    <!-- CTA -->
    <tr><td style="padding:28px 48px 36px;border-top:1px solid #f0f0f0;text-align:center;">
      <a href="${p.marketplaceUrl}"
         style="display:inline-block;padding:14px 48px;background:#0d0d0d;color:#ffffff;font-size:8.5px;text-transform:uppercase;letter-spacing:0.55em;text-decoration:none;font-family:system-ui,sans-serif;">
        Shop the Marketplace →
      </a>
      <p style="margin:16px 0 0;font-size:9px;color:#bbb;font-family:system-ui,sans-serif;">
        Your ${p.discountPct}% discount is applied automatically at checkout.
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:20px 48px;background:#faf8f5;border-top:1px solid #eee;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td>
            <p style="margin:0;font-size:8px;font-family:Georgia,serif;letter-spacing:0.4em;color:#bbb;">MXLLA PRIVATE SHOWROOM</p>
          </td>
          <td align="right">
            <p style="margin:0;font-size:8px;color:#ccc;font-family:system-ui,sans-serif;text-transform:uppercase;letter-spacing:0.2em;">
              <a href="${p.marketplaceUrl}" style="color:${gold};text-decoration:none;">View offers</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>

  </table>

</td></tr>
</table>
</body>
</html>`;
}
