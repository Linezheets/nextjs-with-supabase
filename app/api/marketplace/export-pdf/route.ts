import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import PDFDocument from 'pdfkit';

// ── Helpers ───────────────────────────────────────────────────────────────────

function firstImageUrl(raw: unknown): string | null {
  if (!raw) return null;
  if (Array.isArray(raw) && raw.length) return String(raw[0]);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return String(parsed[0]);
    } catch { /* not JSON */ }
    return raw;
  }
  return null;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function fmt(val: unknown, prefix = '') {
  const n = Number(val);
  if (!val || isNaN(n)) return '—';
  return `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.product_ids) ? body.product_ids
             : Array.isArray(body.variant_ids)  ? body.variant_ids.map((v: string) => String(v).split('_')[0])
             : [];

  if (!ids.length) {
    return NextResponse.json({ error: 'product_ids or variant_ids required' }, { status: 400 });
  }

  // Fetch products — try buyer_vip_catalog first, fall back to inventory
  const uniqueIds = [...new Set(ids)];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let products: Record<string, any>[] = [];

  const catRes = await supabase.from('buyer_vip_catalog').select('*').in('id', uniqueIds);
  if (!catRes.error && catRes.data?.length) {
    products = catRes.data as Record<string, unknown>[];
  } else {
    const invRes = await supabase.from('inventory').select('*').in('id', uniqueIds as unknown as number[]).eq('status', 'active');
    products = (invRes.data ?? []) as Record<string, unknown>[];
  }

  if (!products.length) {
    return NextResponse.json({ error: 'No products found for the supplied IDs' }, { status: 404 });
  }

  // ── Build PDF ───────────────────────────────────────────────────────────────

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    info: {
      Title    : 'Linezheets Linesheet',
      Author   : 'Linezheets',
      Subject  : 'Wholesale Product Selection',
      Creator  : 'Linezheets Platform',
    },
  });

  // Collect to buffer
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const pdfDone = new Promise<Buffer>((resolve, reject) => {
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // ── Design constants ────────────────────────────────────────────────────────
  const W = 595.28;       // A4 width  (pt)
  const H = 841.89;       // A4 height (pt)
  const MARGIN = 40;
  const GOLD = '#c9a84c';
  const BLACK = '#0a0a0a';
  const GREY = '#888888';
  const LIGHT = '#e8e8e8';

  // Fonts
  const SERIF = 'Times-Roman';
  const MONO  = 'Courier';

  // ── Cover page ──────────────────────────────────────────────────────────────

  // Top hairline
  doc.rect(MARGIN, 60, W - MARGIN * 2, 0.5).fill(GOLD);

  // Brand wordmark
  doc.font(SERIF).fontSize(20).fillColor(BLACK)
     .text('Linezheets', MARGIN, 80, { characterSpacing: 12 });

  doc.font(MONO).fontSize(6).fillColor(GREY)
     .text('PRIVATE WHOLESALE SHOWROOM', MARGIN, 108, { characterSpacing: 3 });

  // Large serif headline
  doc.font(SERIF).fontSize(52).fillColor(BLACK)
     .text('Linesheet', MARGIN, 180, { lineGap: 4 });

  doc.font(MONO).fontSize(7).fillColor(GOLD)
     .text('CURATED SELECTION', MARGIN, 248, { characterSpacing: 4 });

  // Meta block
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
  doc.font(MONO).fontSize(7).fillColor(GREY)
     .text(`${products.length} ITEM${products.length === 1 ? '' : 'S'}  ·  ${dateStr}`, MARGIN, 268, { characterSpacing: 2 });

  // Bottom rule + URL
  doc.rect(MARGIN, H - 70, W - MARGIN * 2, 0.5).fill(LIGHT);
  doc.font(MONO).fontSize(6).fillColor(GREY)
     .text('LINEZHEETS.COM  ·  AUTHORISED RETAILERS ONLY', MARGIN, H - 55, { characterSpacing: 2, align: 'center', width: W - MARGIN * 2 });

  // ── Product pages ───────────────────────────────────────────────────────────

  // Layout: 2-column grid, 2 rows per page → 4 per page
  const COLS = 2;
  const ROWS = 2;
  const PER_PAGE = COLS * ROWS;

  const cellW = (W - MARGIN * 2 - 20) / COLS;  // 20 = gutter
  const cellH = (H - 160) / ROWS;              // 160 = top/bottom padding
  const IMG_H = cellH * 0.62;
  const INFO_H = cellH - IMG_H;

  for (let pageIdx = 0; pageIdx < Math.ceil(products.length / PER_PAGE); pageIdx++) {
    doc.addPage();

    // Page header
    doc.rect(MARGIN, 30, W - MARGIN * 2, 0.5).fill(GOLD);
    doc.font(SERIF).fontSize(9).fillColor(BLACK).text('Linezheets', MARGIN, 40, { characterSpacing: 6 });
    doc.font(MONO).fontSize(6).fillColor(GREY).text('WHOLESALE SELECTION', 0, 40, { align: 'right', width: W - MARGIN, characterSpacing: 2 });

    const pageProducts = products.slice(pageIdx * PER_PAGE, (pageIdx + 1) * PER_PAGE);

    for (let i = 0; i < pageProducts.length; i++) {
      const p = pageProducts[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);

      const x = MARGIN + col * (cellW + 20);
      const y = 70 + row * cellH;

      // ── Thumbnail ────────────────────────────────────────────────────────────
      const imgUrl = firstImageUrl(p.image_urls) ?? firstImageUrl(p.image_url);
      if (imgUrl) {
        const imgBuf = await fetchImageBuffer(imgUrl);
        if (imgBuf) {
          try {
            doc.save();
            doc.rect(x, y, cellW, IMG_H).clip();
            doc.image(imgBuf, x, y, { width: cellW, height: IMG_H, cover: [cellW, IMG_H] });
            doc.restore();
          } catch {
            // Unsupported image format — draw placeholder
            doc.rect(x, y, cellW, IMG_H).fill('#f4f4f4');
          }
        } else {
          doc.rect(x, y, cellW, IMG_H).fill('#f4f4f4');
        }
      } else {
        doc.rect(x, y, cellW, IMG_H).fill('#f4f4f4');
      }

      // Bottom border under image
      doc.rect(x, y + IMG_H, cellW, 0.5).fill(LIGHT);

      // ── Info block ───────────────────────────────────────────────────────────
      const infoY = y + IMG_H + 12;
      const textW = cellW - 8;

      // Brand name
      const brand = String(p.brand_name ?? p.brand ?? '').toUpperCase();
      doc.font(MONO).fontSize(6).fillColor(GOLD)
         .text(brand || 'BRAND', x, infoY, { width: textW, characterSpacing: 2, lineBreak: false });

      // Title
      const title = String(p.title ?? p.name ?? 'Untitled');
      doc.font(SERIF).fontSize(11).fillColor(BLACK)
         .text(title, x, infoY + 11, { width: textW, lineBreak: false, ellipsis: true });

      // SKU
      const sku = p.sku ?? p.style_number ?? p.style ?? null;
      if (sku) {
        doc.font(MONO).fontSize(6.5).fillColor(GREY)
           .text(`SKU  ${sku}`, x, infoY + 26, { width: textW, characterSpacing: 1, lineBreak: false });
      }

      // Description (1 line)
      const desc = p.description ?? '';
      if (desc) {
        doc.font(MONO).fontSize(6.5).fillColor(GREY)
           .text(String(desc).slice(0, 90), x, infoY + 38, { width: textW, lineBreak: false, ellipsis: true });
      }

      // Showroom city
      const city = p.showroom_city ?? p.city ?? null;
      if (city) {
        doc.font(MONO).fontSize(6).fillColor(GREY)
           .text(`✦  ${String(city).toUpperCase()}`, x, infoY + 52, { width: textW, characterSpacing: 1, lineBreak: false });
      }

      // Price row (WSP + SRP)
      const wsp = p.wsp_usd ?? p.wholesale_price ?? p.wholesale_price_usd ?? null;
      const srp = p.retail_srp ?? p.srp ?? p.retail_price ?? p.price_usd ?? null;

      const priceY = infoY + 65;
      if (wsp) {
        doc.font(SERIF).fontSize(10).fillColor(BLACK)
           .text(`WSP  ${fmt(wsp, '$')}`, x, priceY, { continued: false });
      }
      if (srp) {
        doc.font(MONO).fontSize(7).fillColor(GREY)
           .text(`SRP  ${fmt(srp, '$')}`, x, priceY + 13, { characterSpacing: 1 });
      }

      // Cell border (right + bottom)
      if (col === 0) {
        doc.rect(x + cellW + 10, y, 0.5, cellH - 10).fill(LIGHT);
      }
    }

    // Page footer
    doc.rect(MARGIN, H - 50, W - MARGIN * 2, 0.5).fill(LIGHT);
    doc.font(MONO).fontSize(6).fillColor(GREY)
       .text(`PAGE ${pageIdx + 2}  ·  CONFIDENTIAL  ·  AUTHORISED RETAILERS ONLY`, MARGIN, H - 38,
             { width: W - MARGIN * 2, align: 'center', characterSpacing: 2 });
  }

  doc.end();
  const pdfBuffer = await pdfDone;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type'       : 'application/pdf',
      'Content-Disposition': 'attachment; filename="linezheets-selection.pdf"',
      'Content-Length'     : String(pdfBuffer.length),
      'Cache-Control'      : 'no-store',
    },
  });
}
