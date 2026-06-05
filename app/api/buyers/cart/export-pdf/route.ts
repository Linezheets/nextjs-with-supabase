/**
 * GET /api/buyers/cart/export-pdf
 *
 * Generates a "Selection Summary" PDF from the buyer's current cart.
 * This is a PRE-ORDER document — not a purchase order — suitable for
 * internal approval before the buyer commits to placing the order.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getBlob } from '@/lib/session-store';
import { formatCurrency } from '@/lib/currency';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

// ── Palette (matches invoice style) ───────────────────────────────────────────
const GOLD   = '#c9a84c';
const BLACK  = '#0a0a0a';
const GRAY   = '#888888';
const LGRAY  = '#e8e8e8';
const WHITE  = '#ffffff';

// ── Layout (A4: 595pt wide) ────────────────────────────────────────────────────
const M     = 56;
const RIGHT = 539;
const W     = RIGHT - M;

// Column positions
const COL = {
  sku   : M,
  desc  : M + 52,
  colour: M + 218,
  size  : M + 272,
  qty   : M + 354,
  price : M + 388,
  total : M + 436,
};

// ── Types ──────────────────────────────────────────────────────────────────────
type RawCartItem = {
  variant_id     : string;
  product_id     : string;
  sku            : string | null;
  name           : string | null;
  size           : string;
  color          : string | null;
  quantity       : number;
  wholesale_price: number | null;
  msrp           : number | null;
  image          : string | null;
  brand_name     : string | null;
};

type CartLine = {
  product_id    : string;
  sku           : string | null;
  name          : string;
  color         : string | null;
  sizes         : Record<string, number>;   // size → quantity
  qty           : number;
  wholesale_price: number;
  brand_name    : string;
  currency      : string;
};

function fmtMoney(n: number, currency = 'USD') {
  return formatCurrency(n, currency);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function drawRule(doc: PDFKit.PDFDocument, y: number, color = LGRAY, weight = 0.5) {
  doc.moveTo(M, y).lineTo(RIGHT, y).strokeColor(color).lineWidth(weight).stroke();
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.rect(M, y, W, 16).fill(BLACK);
  const cols = [
    { x: COL.sku,    label: 'SKU',      align: 'left' as const  },
    { x: COL.desc,   label: 'PRODUCT',  align: 'left' as const  },
    { x: COL.colour, label: 'COLOUR',   align: 'left' as const  },
    { x: COL.size,   label: 'SIZES',    align: 'left' as const  },
    { x: COL.qty,    label: 'QTY',      align: 'right' as const },
    { x: COL.price,  label: 'WS PRICE', align: 'right' as const },
    { x: COL.total,  label: 'TOTAL',    align: 'right' as const },
  ];
  doc.fontSize(5.5).fillColor(WHITE);
  for (const col of cols) {
    const colW = col.x === COL.total ? RIGHT - col.x : (cols[cols.indexOf(col) + 1]?.x ?? RIGHT) - col.x - 4;
    doc.text(col.label, col.x + (col.align === 'right' ? 0 : 4), y + 5, {
      width: colW, align: col.align, characterSpacing: 0.8,
    });
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Load raw cart from session store
  const rawCart = (await getBlob<RawCartItem[]>(user.id, 'cart')) ?? [];
  if (!rawCart.length) {
    return NextResponse.json({ error: 'Your selection is empty' }, { status: 400 });
  }

  // Load buyer profile for store name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: buyer } = await admin
    .from('buyers')
    .select('first_name, last_name, store_name, country, vat_number')
    .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .maybeSingle() as {
      data: { first_name: string | null; last_name: string | null; store_name: string | null; country: string | null; vat_number: string | null } | null;
    };

  const buyerName  = [buyer?.first_name, buyer?.last_name].filter(Boolean).join(' ') || (user.email ?? 'Buyer');
  const storeName  = buyer?.store_name ?? '';
  const buyerLabel = storeName ? `${storeName}${buyerName ? ` — ${buyerName}` : ''}` : buyerName;

  // ── Group cart items: product_id → CartLine ────────────────────────────────
  const lineMap = new Map<string, CartLine>();
  for (const r of rawCart) {
    const pid    = r.product_id ?? r.variant_id.split('_')[0];
    const brand  = r.brand_name ?? 'Unknown Brand';
    const key    = `${brand}::${pid}`;

    if (!lineMap.has(key)) {
      lineMap.set(key, {
        product_id    : pid,
        sku           : r.sku,
        name          : r.name ?? 'Product',
        color         : r.color,
        sizes         : {},
        qty           : 0,
        wholesale_price: r.wholesale_price ?? 0,
        brand_name    : brand,
        currency      : 'USD',   // default; overridden below
      });
    }
    const line = lineMap.get(key)!;
    const q    = Number(r.quantity) || 1;
    line.sizes[r.size] = (line.sizes[r.size] ?? 0) + q;
    line.qty += q;
    if (r.wholesale_price) line.wholesale_price = r.wholesale_price;
  }

  // Enrich with brand base_currency
  const brandNames = [...new Set(rawCart.map(r => r.brand_name).filter(Boolean))];
  const { data: storefronts } = await admin
    .from('brand_storefronts')
    .select('brand_name, base_currency')
    .in('brand_name', brandNames) as {
      data: { brand_name: string; base_currency: string | null }[] | null;
    };
  const currencyByBrand = new Map<string, string>();
  for (const sf of storefronts ?? []) {
    if (sf.base_currency) currencyByBrand.set(sf.brand_name, sf.base_currency);
  }
  for (const line of lineMap.values()) {
    line.currency = currencyByBrand.get(line.brand_name) ?? 'USD';
  }

  // Group lines by brand
  const byBrand = new Map<string, CartLine[]>();
  for (const line of lineMap.values()) {
    const b = line.brand_name;
    if (!byBrand.has(b)) byBrand.set(b, []);
    byBrand.get(b)!.push(line);
  }

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const now = new Date();
  const doc = new PDFDocument({
    size  : 'A4',
    margin: 0,
    info  : {
      Title  : `Linezheets Selection Summary — ${fmtDate(now)}`,
      Author : 'Linezheets',
      Subject: 'Pre-Order Selection Summary — Pending Internal Approval',
      Creator: 'Linezheets Platform',
    },
  });

  const chunks: Buffer[] = [];
  const pdfBuffer = new Promise<Buffer>((resolve, reject) => {
    doc.on('data',  (c: Buffer) => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // ── Page: Header ──────────────────────────────────────────────────────────
  let y = M;

  // Brand name
  doc.fontSize(20).fillColor(BLACK).font('Helvetica-Bold').text('LINEZHEETS', M, y);
  doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
     .text('PRIVATE WHOLESALE SHOWROOM · AUTHORISED RETAILERS ONLY', M, y + 24, { characterSpacing: 1.2 });

  // Document type (right-aligned)
  doc.fontSize(14).fillColor(BLACK).font('Helvetica-Bold')
     .text('SELECTION SUMMARY', M, y, { width: W, align: 'right' });
  doc.fontSize(7).fillColor(GOLD).font('Helvetica')
     .text('PENDING INTERNAL APPROVAL', M, y + 20, { width: W, align: 'right', characterSpacing: 1 });

  // Gold rule
  doc.moveTo(M, y + 42).lineTo(RIGHT, y + 42).strokeColor(GOLD).lineWidth(0.75).stroke();
  y += 56;

  // ── Buyer + meta info ──────────────────────────────────────────────────────
  doc.fontSize(6.5).fillColor(GRAY).font('Helvetica').text('PREPARED FOR', M, y, { characterSpacing: 1 });
  doc.fontSize(9).fillColor(BLACK).font('Helvetica-Bold').text(buyerLabel, M, y + 11);
  if (buyer?.country) {
    doc.fontSize(8).fillColor(GRAY).font('Helvetica').text(buyer.country, M, y + 24);
  }
  if (buyer?.vat_number) {
    doc.fontSize(7.5).fillColor(GRAY).text(`VAT: ${buyer.vat_number}`, M, y + 35);
  }

  // Right: date + disclaimer
  const metaX = RIGHT - 180;
  doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
     .text('DATE PREPARED', metaX, y, { width: 180, align: 'right', characterSpacing: 1 });
  doc.fontSize(8).fillColor(BLACK).font('Helvetica-Bold')
     .text(fmtDate(now), metaX, y + 11, { width: 180, align: 'right' });

  doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
     .text('DOCUMENT TYPE', metaX, y + 28, { width: 180, align: 'right', characterSpacing: 1 });
  doc.fontSize(7.5).fillColor(BLACK)
     .text('Not a purchase order', metaX, y + 39, { width: 180, align: 'right' });

  y += 70;
  drawRule(doc, y);
  y += 14;

  // ── Grand total summary (top) ──────────────────────────────────────────────
  let grandTotal = 0;
  let grandQty   = 0;
  for (const lines of byBrand.values()) {
    for (const l of lines) {
      grandTotal += l.wholesale_price * l.qty;
      grandQty   += l.qty;
    }
  }

  // Summary bar
  doc.rect(M, y, W, 22).fill('#f9f9f9');
  doc.fontSize(7).fillColor(GRAY).font('Helvetica')
     .text(`${grandQty} units across ${byBrand.size} brand${byBrand.size !== 1 ? 's' : ''}`, M + 8, y + 7);
  doc.fontSize(11).fillColor(BLACK).font('Helvetica-Bold')
     .text(`Est. Wholesale Total`, RIGHT - 260, y + 5, { width: 180, align: 'right' });
  doc.fontSize(13).fillColor(GOLD).font('Helvetica-Bold')
     .text(fmtMoney(grandTotal), RIGHT - 80, y + 4, { width: 80, align: 'right' });
  doc.font('Helvetica');

  y += 32;

  // ── Per-brand sections ────────────────────────────────────────────────────
  for (const [brand, lines] of byBrand) {
    // Check page space — add new page if needed
    if (y > 720) {
      doc.addPage();
      y = M;
      // Repeat header on new page
      doc.fontSize(7).fillColor(GRAY).font('Helvetica')
         .text('LINEZHEETS · SELECTION SUMMARY (CONTINUED)', M, y, { characterSpacing: 1.2 });
      drawRule(doc, y + 14);
      y += 26;
    }

    // Brand header
    doc.fontSize(9).fillColor(BLACK).font('Helvetica-Bold').text(brand.toUpperCase(), M, y, { characterSpacing: 1.5 });
    y += 16;

    // Table header
    drawTableHeader(doc, y);
    y += 20;

    let brandTotal = 0;
    let brandQty   = 0;

    for (const line of lines) {
      if (y > 760) {
        doc.addPage();
        y = M + 20;
        drawTableHeader(doc, y - 20);
        y += 4;
      }

      const lineTotal = line.wholesale_price * line.qty;
      brandTotal += lineTotal;
      brandQty   += line.qty;

      // Row background (alternating)
      const rowIdx = lines.indexOf(line);
      if (rowIdx % 2 === 0) doc.rect(M, y - 2, W, 20).fill('#fafafa');

      // Sizes formatted as "XS×2 S×5 M×8" — fallback to "—" when no sizes recorded
      const sizesStr = Object.entries(line.sizes).length > 0
        ? Object.entries(line.sizes).map(([s, q]) => `${s}×${q}`).join('  ')
        : '—';

      doc.fontSize(7.5).fillColor(BLACK).font('Helvetica');
      doc.text(line.sku ?? '—',         COL.sku   + 4, y + 3, { width: 44,  ellipsis: true });
      doc.text(line.name,               COL.desc  + 4, y + 3, { width: 162, ellipsis: true });
      doc.text(line.color ?? '—',       COL.colour + 4, y + 3, { width: 50,  ellipsis: true });
      doc.text(sizesStr,                COL.size  + 4, y + 3, { width: 78,  ellipsis: true });
      doc.text(String(line.qty),        COL.qty,        y + 3, { width: 34,  align: 'right' });
      doc.text(fmtMoney(line.wholesale_price, line.currency), COL.price, y + 3, { width: 46, align: 'right' });
      doc.text(fmtMoney(lineTotal, line.currency),            COL.total, y + 3, { width: RIGHT - COL.total, align: 'right' });

      y += 20;
      drawRule(doc, y - 2, LGRAY, 0.3);
    }

    // Brand subtotal
    doc.rect(M, y, W, 18).fill('#f0f0f0');
    doc.fontSize(7.5).fillColor(BLACK).font('Helvetica-Bold')
       .text(`${brand} Subtotal`, M + 4, y + 5, { width: W - 100 });
    doc.text(`${brandQty} units`, COL.qty - 20, y + 5, { width: 60, align: 'right' });
    doc.fontSize(9).fillColor(GOLD)
       .text(fmtMoney(brandTotal), COL.total, y + 4, { width: RIGHT - COL.total, align: 'right' });
    doc.font('Helvetica');
    y += 26;
  }

  // ── Grand total footer ─────────────────────────────────────────────────────
  if (y > 740) { doc.addPage(); y = M + 20; }

  drawRule(doc, y, GOLD, 0.75);
  y += 12;

  doc.fontSize(10).fillColor(BLACK).font('Helvetica-Bold').text('ESTIMATED TOTAL', M, y);
  doc.fontSize(14).fillColor(BLACK).font('Helvetica-Bold')
     .text(fmtMoney(grandTotal), M, y, { width: W, align: 'right' });
  doc.fontSize(7.5).fillColor(GRAY).font('Helvetica')
     .text(`${grandQty} units total`, M, y + 16);

  y += 42;

  // ── Disclaimer ────────────────────────────────────────────────────────────
  drawRule(doc, y, LGRAY);
  y += 10;

  const disclaimer = [
    'This document is a pre-order selection summary for internal review purposes only.',
    'It does not constitute a purchase order, commitment to buy, or reservation of stock.',
    'Prices and availability are subject to brand confirmation at time of order submission.',
    'Wholesale prices shown are confidential and intended for authorised buyers only.',
    'To place an order, return to the Linezheets platform and submit your selection.',
  ].join('  ·  ');

  doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
     .text(disclaimer, M, y, { width: W, lineGap: 3, align: 'justify' });

  y += 40;

  // ── Footer ────────────────────────────────────────────────────────────────
  const PAGE_H = doc.page.height as number;
  const footY  = PAGE_H - 40;

  drawRule(doc, footY - 8, LGRAY);
  doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
     .text(
       `Linezheets · Private Wholesale Showroom · info@mxlla.com · Generated ${fmtDate(now)}`,
       M, footY,
       { width: W, align: 'center', characterSpacing: 0.5 }
     );

  doc.end();

  const buffer = await pdfBuffer;

  const filename = `linezheets-selection-${now.toISOString().split('T')[0]}.pdf`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status : 200,
    headers: {
      'Content-Type'        : 'application/pdf',
      'Content-Disposition' : `attachment; filename="${filename}"`,
      'Content-Length'      : String(buffer.length),
      'Cache-Control'       : 'private, no-store',
    },
  });
}
