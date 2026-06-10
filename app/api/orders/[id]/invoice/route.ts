import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

// ── Palette ───────────────────────────────────────────────────────────────────

const GOLD   = '#c9a84c';
const BLACK  = '#0a0a0a';
const GRAY   = '#888888';
const LGRAY  = '#dddddd';
const WHITE  = '#ffffff';
const GREEN  = '#52b788';
const RED    = '#df1b41';
const BLUE   = '#7cb9e8';

// ── Column layout (A4: 595pt wide, 56pt margins → 483pt usable) ───────────────
const M     = 56;           // left margin
const RIGHT = 539;          // right edge (M + 483)

const COL = {
  sku   : M,
  desc  : M + 56,           // 56pt for SKU
  colour: M + 220,          // 164pt for description
  sizes : M + 278,          // 58pt for colour
  qty   : M + 360,          // 82pt for sizes (inline compact)
  price : M + 390,          // 30pt for qty (centred)
  total : M + 440,          // 50pt for wholesale price
  //                           49pt for total (right-aligned to RIGHT)
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function statusColor(s: string): string {
  return s === 'delivered' ? GREEN
       : s === 'cancelled' ? GRAY
       : s === 'shipped'   ? BLUE
       : GOLD;
}

function paymentColor(ps: string): string {
  return ps === 'paid'               ? GREEN
       : ps === 'payment_failed'     ? RED
       : ps === 'unpaid'             ? RED
       : ps === 'payment_processing' ? BLUE
       : GOLD; // pending_wire, etc.
}

function paymentLabel(ps: string): string {
  const map: Record<string, string> = {
    unpaid             : 'UNPAID',
    pending_wire       : 'WIRE PENDING',
    payment_processing : 'PROCESSING',
    paid               : 'PAID',
    payment_failed     : 'PAYMENT FAILED',
  };
  return map[ps] ?? ps.toUpperCase().replace(/_/g, ' ');
}

// ── Draw table column headers (called on each page start inside table) ────────
function drawTableHeader(doc: InstanceType<typeof PDFDocument>, y: number): void {
  const W = RIGHT - M;
  doc.rect(M, y, W, 18).fill('#f5f5f5');
  doc.fontSize(6).fillColor(GRAY).font('Helvetica');
  const hy = y + 5.5;
  doc.text('SKU',         COL.sku,   hy, { characterSpacing: 1, width: COL.desc - COL.sku - 2 });
  doc.text('DESCRIPTION', COL.desc,  hy, { characterSpacing: 1, width: COL.colour - COL.desc - 4 });
  doc.text('COLOUR',      COL.colour,hy, { characterSpacing: 1, width: COL.sizes - COL.colour - 4 });
  doc.text('SIZES',       COL.sizes, hy, { characterSpacing: 1, width: COL.qty - COL.sizes - 4 });
  doc.text('QTY',         COL.qty,   hy, { characterSpacing: 1, width: COL.price - COL.qty - 2, align: 'center' });
  doc.text('WHOLESALE',   COL.price, hy, { characterSpacing: 1, width: COL.total - COL.price - 4 });
  doc.text('TOTAL',       COL.total, hy, { characterSpacing: 1, width: RIGHT - COL.total, align: 'right' });
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id }  = await params;
  const format  = req.nextUrl.searchParams.get('format') === 'proforma' ? 'proforma' : 'invoice';
  const isProforma = format === 'proforma';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: order, error } = await sb
    .from('buyer_orders')
    .select('*')
    .eq('id', id)
    .eq('buyer_id', user.id)
    .single();

  if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Fetch installments
  const { data: rawInstallments } = await sb
    .from('buyer_payments')
    .select('installment_seq, amount_usd, status, due_date, method, created_at')
    .eq('order_id', id)
    .order('installment_seq', { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const installments: any[] = rawInstallments ?? [];

  // ── Build PDF ───────────────────────────────────────────────────────────────
  const doc = new PDFDocument({
    margin : M,
    size   : 'A4',
    info   : {
      Title  : `${isProforma ? 'Proforma Invoice' : 'Invoice'} ${order.id}`,
      Author : 'Linezheets',
      Subject: `Wholesale order ${order.id}`,
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const W = RIGHT - M;
  const PAGE_H = doc.page.height as number;
  const FOOTER_Y = PAGE_H - M;
  const SAFE_BOTTOM = PAGE_H - 90; // don't start new content below here

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.fontSize(20).fillColor(BLACK).font('Helvetica-Bold').text('LINEZHEETS', M, M);
  doc.fontSize(6.5).fillColor(GRAY).font('Helvetica')
     .text('PRIVATE WHOLESALE SHOWROOM · AUTHORISED RETAILERS ONLY', M, M + 24, { characterSpacing: 1.2 });

  // Title (right)
  const titleText = isProforma ? 'PROFORMA INVOICE' : 'INVOICE';
  doc.fontSize(16).fillColor(BLACK).font('Helvetica-Bold')
     .text(titleText, M, M, { width: W, align: 'right' });
  doc.font('Helvetica');

  // Gold rule
  doc.moveTo(M, M + 44).lineTo(RIGHT, M + 44).strokeColor(GOLD).lineWidth(0.75).stroke();

  // ── Meta grid ───────────────────────────────────────────────────────────────
  // Left: Bill To | Right: Invoice No / Date / Payment Terms
  let y = M + 56;

  // Bill To
  doc.fontSize(6.5).fillColor(GRAY).text('BILL TO', M, y, { characterSpacing: 1 });
  doc.fontSize(9).fillColor(BLACK).text(order.buyer_name ?? user.email ?? '—', M, y + 11);

  // Buyer VAT / country (if captured)
  let buyerTaxY = y + 24;
  if (order.buyer_country) {
    doc.fontSize(7.5).fillColor(GRAY).text(order.buyer_country, M, buyerTaxY);
    buyerTaxY += 12;
  }
  if (order.buyer_vat_number) {
    doc.fontSize(7.5).fillColor(GRAY).text(`VAT: ${order.buyer_vat_number}`, M, buyerTaxY);
  }

  // Right column meta
  const metaW = 170;
  const metaX = RIGHT - metaW;

  doc.fontSize(6.5).fillColor(GRAY).text('INVOICE NO', metaX, y, { width: metaW, align: 'right', characterSpacing: 1 });
  doc.fontSize(8).fillColor(BLACK).text(order.id, metaX, y + 11, { width: metaW, align: 'right' });

  doc.fontSize(6.5).fillColor(GRAY).text('DATE ISSUED', metaX, y + 26, { width: metaW, align: 'right', characterSpacing: 1 });
  doc.fontSize(8).fillColor(BLACK).text(fmtDate(order.created_at), metaX, y + 37, { width: metaW, align: 'right' });

  if (order.terms) {
    doc.fontSize(6.5).fillColor(GRAY).text('PAYMENT TERMS', metaX, y + 52, { width: metaW, align: 'right', characterSpacing: 1 });
    doc.fontSize(8).fillColor(BLACK).text(order.terms, metaX, y + 63, { width: metaW, align: 'right' });
  }

  // Seller VAT (if captured)
  if (order.seller_vat_number || order.seller_tax_country) {
    const sellerTaxLine = [
      order.seller_tax_country,
      order.seller_vat_number ? `VAT: ${order.seller_vat_number}` : null,
    ].filter(Boolean).join(' · ');
    doc.fontSize(6.5).fillColor(GRAY).text('SELLER VAT', metaX, y + 78, { width: metaW, align: 'right', characterSpacing: 1 });
    doc.fontSize(7.5).fillColor(GRAY).text(sellerTaxLine, metaX, y + 89, { width: metaW, align: 'right' });
  }

  y += 96;

  // ── Status badges ─────────────────────────────────────────────────────────
  const orderStatusLabel = (order.status ?? 'new').toUpperCase().replace(/_/g, ' ');
  const orderBadgeW = Math.max(50, orderStatusLabel.length * 5 + 16);
  doc.rect(M, y, orderBadgeW, 15).fill(statusColor(order.status ?? ''));
  doc.fontSize(6.5).fillColor(WHITE).text(orderStatusLabel, M + 8, y + 4, { characterSpacing: 1 });

  if (order.payment_status) {
    const psLabel = paymentLabel(order.payment_status);
    const psBadgeW = Math.max(50, psLabel.length * 4.8 + 16);
    doc.rect(M + orderBadgeW + 8, y, psBadgeW, 15).fill(paymentColor(order.payment_status));
    doc.fontSize(6.5).fillColor(WHITE).text(psLabel, M + orderBadgeW + 16, y + 4, { characterSpacing: 1 });
  }

  doc.fillColor(BLACK);
  y += 30;

  // ── Line-items table ─────────────────────────────────────────────────────────
  drawTableHeader(doc, y);
  y += 18;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = Array.isArray(order.items) ? order.items : [];

  // Group by brand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byBrand: Record<string, any[]> = {};
  for (const item of items) {
    const key = item.brand_name || 'Unknown Brand';
    (byBrand[key] ??= []).push(item);
  }

  let rowIndex = 0;

  for (const [brand, brandItems] of Object.entries(byBrand)) {
    // Brand sub-header — page break if needed
    if (y > SAFE_BOTTOM) {
      doc.addPage();
      y = M;
      drawTableHeader(doc, y);
      y += 18;
    }

    doc.rect(M, y, W, 16).fill('#f8f7f4');
    doc.fontSize(7.5).fillColor(BLACK).font('Helvetica-Bold')
       .text(brand.toUpperCase(), M + 6, y + 4.5, { characterSpacing: 0.7 });
    doc.font('Helvetica');
    y += 16;

    for (const item of brandItems) {
      if (y > SAFE_BOTTOM) {
        doc.addPage();
        y = M;
        // Light "continued" label
        doc.fontSize(6).fillColor(GRAY).text('continued', M, y, { width: W, align: 'right' });
        y += 10;
        drawTableHeader(doc, y);
        y += 18;
        // Re-draw brand sub-header on continuation
        doc.rect(M, y, W, 16).fill('#f8f7f4');
        doc.fontSize(7.5).fillColor(BLACK).font('Helvetica-Bold')
           .text(brand.toUpperCase(), M + 6, y + 4.5, { characterSpacing: 0.7 });
        doc.font('Helvetica');
        y += 16;
      }

      const rowH = 20;
      if (rowIndex % 2 === 0) doc.rect(M, y, W, rowH).fill('#fdfcfa');

      const sizeSummary = Object.entries(item.sizes ?? {})
        .filter(([, v]) => Number(v) > 0)
        .map(([s, v]) => `${s}:${v}`)
        .join(' ');

      const lineTotal = (item.wholesale_price ?? 0) * (item.qty ?? 0);
      const ry = y + 6;

      doc.fontSize(7.5).fillColor('#777777').font('Helvetica');
      doc.text(item.style_number ?? '—', COL.sku,    ry, { width: COL.desc - COL.sku - 2 });
      doc.fillColor(BLACK);
      doc.text(item.title,               COL.desc,   ry, { width: COL.colour - COL.desc - 6, ellipsis: true });
      doc.fillColor('#555555');
      doc.text(item.colour ?? '—',       COL.colour, ry, { width: COL.sizes - COL.colour - 4 });
      doc.fontSize(6.5).fillColor('#888888');
      doc.text(sizeSummary || '—',       COL.sizes,  ry + 1, { width: COL.qty - COL.sizes - 4 });
      doc.fontSize(7.5).fillColor(BLACK).font('Helvetica-Bold');
      doc.text(String(item.qty ?? 0),    COL.qty,    ry, { width: COL.price - COL.qty - 2, align: 'center' });
      doc.font('Helvetica').fillColor(GOLD);
      doc.text(fmtUSD(item.wholesale_price ?? 0), COL.price, ry, { width: COL.total - COL.price - 4 });
      doc.fillColor(BLACK);
      doc.text(fmtUSD(lineTotal),        COL.total,  ry, { width: RIGHT - COL.total, align: 'right' });

      doc.moveTo(M, y + rowH).lineTo(RIGHT, y + rowH).strokeColor(LGRAY).lineWidth(0.25).stroke();
      y += rowH;
      rowIndex++;
    }

    // Per-brand subtotal
    const brandTotal = brandItems.reduce((s: number, i: { wholesale_price?: number; qty?: number }) => s + (i.wholesale_price ?? 0) * (i.qty ?? 0), 0);
    doc.fontSize(7).fillColor(GRAY).font('Helvetica')
       .text(`${brand} subtotal`, COL.price, y + 4, { width: COL.total - COL.price - 4 });
    doc.fillColor('#555555')
       .text(fmtUSD(brandTotal), COL.total, y + 4, { width: RIGHT - COL.total, align: 'right' });
    y += 18;
  }

  // ── Grand Total ────────────────────────────────────────────────────────────
  y += 8;
  if (y > SAFE_BOTTOM) { doc.addPage(); y = M; }

  doc.moveTo(COL.price, y).lineTo(RIGHT, y).strokeColor(GOLD).lineWidth(0.75).stroke();
  y += 10;

  const totalLabel = isProforma ? 'ESTIMATED TOTAL' : 'TOTAL DUE';
  doc.rect(COL.price - 2, y, RIGHT - COL.price + 2, 22).fill(BLACK);
  doc.fontSize(8).fillColor(WHITE).font('Helvetica-Bold');
  doc.text(totalLabel, COL.price + 4, y + 7, { width: COL.total - COL.price - 8 });
  doc.text(fmtUSD(Number(order.total_usd)), COL.total, y + 7, { width: RIGHT - COL.total, align: 'right' });
  doc.font('Helvetica').fillColor(BLACK);

  y += 34;

  // ── Customs Declaration ────────────────────────────────────────────────────
  // Customs fields live on inventory (not the order snapshot) — look them up by SKU.
  const customsSkus = [...new Set(items.map((it: { style_number?: string; sku?: string }) => it.style_number ?? it.sku).filter(Boolean))] as string[];
  if (customsSkus.length) {
    // Incoterms come from the brand's settings (defaults to DDP).
    let incoterms = 'DDP';
    try {
      const { data: bsf } = await sb.from('brand_storefronts').select('pricing_settings').eq('brand_name', order.brand_name).maybeSingle();
      const ps = bsf?.pricing_settings;
      if (ps && typeof ps.incoterms === 'string' && ps.incoterms.trim()) incoterms = ps.incoterms.trim();
    } catch { /* default stands */ }

    const { data: customsRows } = await sb
      .from('inventory')
      .select('sku, hs_code, country_of_origin, net_weight_kg, gross_weight_kg')
      .in('sku', customsSkus);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmap = new Map((customsRows ?? []).map((r: any) => [r.sku, r]));

    if (y > SAFE_BOTTOM - 90) { doc.addPage(); y = M; }
    doc.fontSize(7).fillColor(GRAY).font('Helvetica').text('CUSTOMS DECLARATION', M, y, { characterSpacing: 1 });
    y += 14;
    doc.rect(M, y, W, 16).fill('#f5f5f5');
    doc.fontSize(6).fillColor(GRAY);
    const ch = y + 5;
    doc.text('SKU',        M + 4,   ch, { width: 92 });
    doc.text('HS CODE',    M + 100, ch, { width: 80 });
    doc.text('ORIGIN',     M + 185, ch, { width: 90 });
    doc.text('NET KG',     M + 280, ch, { width: 60 });
    doc.text('GROSS KG',   M + 345, ch, { width: 70 });
    doc.text('VALUE',      RIGHT - 70, ch, { width: 70, align: 'right' });
    y += 16;

    let totalGross = 0;
    for (const it of items) {
      if (y > SAFE_BOTTOM) { doc.addPage(); y = M; }
      const sku = it.style_number ?? it.sku;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c: any = cmap.get(sku) ?? {};
      const qty = it.qty ?? 0;
      totalGross += (Number(c.gross_weight_kg) || 0) * qty;
      doc.fontSize(7).fillColor(BLACK).font('Helvetica');
      doc.text(sku ?? '—',                                        M + 4,   y, { width: 92, ellipsis: true });
      doc.text(c.hs_code ?? '—',                                  M + 100, y, { width: 80 });
      doc.text(c.country_of_origin ?? '—',                        M + 185, y, { width: 90, ellipsis: true });
      doc.text(c.net_weight_kg != null ? String(c.net_weight_kg) : '—',     M + 280, y, { width: 60 });
      doc.text(c.gross_weight_kg != null ? String(c.gross_weight_kg) : '—', M + 345, y, { width: 70 });
      doc.text(fmtUSD((it.wholesale_price ?? 0) * qty),           RIGHT - 70, y, { width: 70, align: 'right' });
      y += 13;
    }

    y += 4;
    doc.fontSize(7).fillColor(GRAY).font('Helvetica').text(
      `Incoterms: ${incoterms}   ·   Total declared value: ${fmtUSD(Number(order.total_usd))} USD   ·   Total gross weight: ${totalGross.toFixed(3)} kg`,
      M, y, { width: W },
    );
    y += 16;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const missing = customsSkus.filter(s => { const c: any = cmap.get(s); return !c || !c.hs_code || !c.country_of_origin; });
    if (missing.length) {
      doc.fontSize(6).fillColor('#c0392b').text(
        `Note: HS code / country of origin missing for ${missing.length} item(s) — required for customs clearance. Add them in product details before shipping internationally.`,
        M, y, { width: W },
      );
      y += 14;
    }
    doc.fillColor(BLACK).font('Helvetica');
  }

  // ── Installment Schedule ──────────────────────────────────────────────────
  if (installments.length >= 2) {
    if (y > SAFE_BOTTOM - 60) { doc.addPage(); y = M; }

    doc.fontSize(7).fillColor(GRAY).text('PAYMENT SCHEDULE', M, y, { characterSpacing: 1 });
    y += 14;

    // Schedule header
    doc.rect(M, y, W, 16).fill('#f5f5f5');
    doc.fontSize(6).fillColor(GRAY);
    const sh = y + 5;
    doc.text('#',       M + 4,   sh, { width: 16 });
    doc.text('DUE DATE',M + 24,  sh, { characterSpacing: 1, width: 90 });
    doc.text('METHOD',  M + 120, sh, { characterSpacing: 1, width: 80 });
    doc.text('AMOUNT',  M + 210, sh, { characterSpacing: 1, width: 90 });
    doc.text('STATUS',  M + 310, sh, { characterSpacing: 1, width: 80 });
    y += 16;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inst of installments as any[]) {
      if (y > SAFE_BOTTOM) { doc.addPage(); y = M; }

      const instRowH = 18;
      const isPaid = inst.status === 'paid';
      const isOverdue = inst.status === 'overdue';

      const dueStr = inst.due_date
        ? new Date(inst.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        : inst.installment_seq === 1
          ? new Date(inst.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—';

      const statusStr = isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'DUE';
      const statusCol = isPaid ? GREEN : isOverdue ? RED : GOLD;
      const instRy = y + 5;

      doc.fontSize(7.5).fillColor('#aaaaaa');
      doc.text(String(inst.installment_seq), M + 4, instRy, { width: 16 });
      doc.fillColor(isPaid ? '#aaaaaa' : BLACK);
      doc.text(dueStr, M + 24, instRy, { width: 90 });
      doc.fillColor('#777777');
      doc.text((inst.method ?? '—').replace(/_/g, ' '), M + 120, instRy, { width: 80 });
      doc.fillColor(isPaid ? '#aaaaaa' : GOLD);
      doc.text(fmtUSD(Number(inst.amount_usd)), M + 210, instRy, { width: 90 });

      // Status badge
      const sbW = 38;
      doc.rect(M + 310, y + 3, sbW, 12).fill(statusCol);
      doc.fontSize(5.5).fillColor(WHITE).text(statusStr, M + 310 + 5, y + 5.5, { characterSpacing: 0.8, width: sbW - 10 });

      doc.moveTo(M, y + instRowH).lineTo(RIGHT, y + instRowH).strokeColor(LGRAY).lineWidth(0.2).stroke();
      y += instRowH;
    }

    y += 8;
  }

  // ── Wire Transfer Instructions (optional, driven by env vars) ─────────────
  const wireBank    = process.env.INVOICE_WIRE_BANK;
  const wireAccount = process.env.INVOICE_WIRE_ACCOUNT;
  const wireSwift   = process.env.INVOICE_WIRE_SWIFT;
  const wireIban    = process.env.INVOICE_WIRE_IBAN;
  const showWire    = (wireBank || wireAccount || wireSwift || wireIban) &&
                      (order.payment_status === 'unpaid' ||
                       order.payment_status === 'pending_wire' ||
                       order.payment_status == null);

  if (showWire) {
    if (y > SAFE_BOTTOM - 60) { doc.addPage(); y = M; }

    doc.fontSize(7).fillColor(GRAY).text('WIRE TRANSFER DETAILS', M, y, { characterSpacing: 1 });
    y += 14;

    const wireFields: [string, string | undefined][] = [
      ['Bank',           wireBank],
      ['Account No.',    wireAccount],
      ['SWIFT / BIC',    wireSwift],
      ['IBAN',           wireIban],
      ['Reference',      order.id],
    ];

    for (const [label, value] of wireFields) {
      if (!value) continue;
      if (y > SAFE_BOTTOM) { doc.addPage(); y = M; }
      doc.fontSize(6.5).fillColor(GRAY).text(label, M, y, { width: 80, characterSpacing: 0.5 });
      doc.fontSize(7.5).fillColor(BLACK).text(value, M + 86, y, { width: W - 86 });
      y += 14;
    }

    y += 6;
  }

  // ── Notes ──────────────────────────────────────────────────────────────────
  if (order.notes) {
    if (y > SAFE_BOTTOM - 40) { doc.addPage(); y = M; }
    doc.fontSize(7).fillColor(GRAY).text('NOTES', M, y, { characterSpacing: 1 });
    doc.fontSize(8).fillColor('#555555');
    doc.text(order.notes, M, y + 12, { width: W * 0.65 });
    y += 12 + doc.heightOfString(order.notes, { width: W * 0.65 }) + 10;
  }

  // ── Proforma disclaimer ────────────────────────────────────────────────────
  if (isProforma) {
    if (y > SAFE_BOTTOM - 30) { doc.addPage(); y = M; }
    doc.fontSize(7).fillColor(GRAY)
       .text('This is a proforma invoice only and does not constitute a tax invoice or a demand for payment.', M, y, { width: W * 0.7, lineGap: 2 });
    y += 20;
  }

  // ── Footer (on every page) ─────────────────────────────────────────────────
  const totalPages = (doc.bufferedPageRange?.() ?? { count: 1 }).count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.moveTo(M, FOOTER_Y - 12).lineTo(RIGHT, FOOTER_Y - 12).strokeColor(LGRAY).lineWidth(0.25).stroke();
    doc.fontSize(6.5).fillColor(GRAY)
       .text('Linezheets · Private Wholesale Showroom · info@mxlla.com', M, FOOTER_Y - 4, {
         width: W, align: 'center', characterSpacing: 0.7,
       });
    if (totalPages > 1) {
      doc.text(`Page ${i + 1} of ${totalPages}`, M, FOOTER_Y - 4, { width: W, align: 'right' });
    }
  }

  // ── Finalise ───────────────────────────────────────────────────────────────
  await new Promise<void>(resolve => {
    doc.on('end', resolve);
    doc.end();
  });

  const pdf = Buffer.concat(chunks);
  const filename = `${format}-${order.id}.pdf`;

  return new NextResponse(pdf, {
    headers: {
      'Content-Type'        : 'application/pdf',
      'Content-Disposition' : `attachment; filename="${filename}"`,
      'Content-Length'      : String(pdf.length),
      'Cache-Control'       : 'private, no-store',
    },
  });
}
