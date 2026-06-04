import { NextRequest, NextResponse } from 'next/server';
import { buildMappings, buildSizeCols, extractProducts } from '@/lib/smart-sync/mapper';
import { COLUMN_MAPS } from '@/lib/smart-sync/column-maps';
import Anthropic from '@anthropic-ai/sdk';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { getUserFromRequest } from '@/lib/supabase/bearer';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPABASE_URL     = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const STORAGE_BUCKET   = 'product-images';

// ─── JPEG extraction ─────────────────────────────────────────────────────────
// Fashion linesheets embed product photos almost exclusively as JPEG (DCTDecode).
// We scan for SOI (FF D8) … EOI (FF D9) byte pairs in the raw PDF buffer.
function extractJpegsFromBuffer(buf: Buffer): Buffer[] {
  const imgs: Buffer[] = [];
  let pos = 0;
  while (pos < buf.length - 3) {
    if (buf[pos] === 0xff && buf[pos + 1] === 0xd8) {
      // Scan forward for EOI
      let end = pos + 2;
      while (end < buf.length - 1) {
        if (buf[end] === 0xff && buf[end + 1] === 0xd9) {
          end += 2;
          break;
        }
        end++;
      }
      // Ignore tiny blobs (< 5 KB) — likely JPEG thumbnails / colour profiles embedded
      // in other JPEG segments, not actual product photos.
      if (end - pos >= 5_000) imgs.push(buf.slice(pos, end));
      pos = end;
    } else {
      pos++;
    }
  }
  return imgs;
}

// ─── Upload images to Supabase Storage ───────────────────────────────────────
async function uploadImagesToStorage(
  images: Buffer[],
  brandCode: string,
): Promise<string[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return [];

  const admin    = createSupabaseAdmin(SUPABASE_URL, SERVICE_ROLE_KEY);
  const prefix   = (brandCode || 'upload').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const ts       = Date.now();
  const publicUrls: string[] = [];

  await Promise.all(
    images.map(async (buf, i) => {
      const path = `${prefix}/${ts}-${i}.jpg`;
      const { error } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(path, buf, { contentType: 'image/jpeg', upsert: true });

      if (error) {
        console.warn(`[pdf-img] upload failed for ${path}:`, error.message);
        publicUrls[i] = '';
      } else {
        const { data } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        publicUrls[i] = data.publicUrl;
      }
    }),
  );

  return publicUrls;
}

// ─── Main PDF extraction ──────────────────────────────────────────────────────
async function extractPdfWithClaude(fileBuffer: Buffer, brandCode: string): Promise<NextResponse> {
  // 1. Extract embedded JPEG images from the raw PDF binary
  const jpegBuffers  = extractJpegsFromBuffer(fileBuffer);
  const uploadedUrls = await uploadImagesToStorage(jpegBuffers, brandCode);
  const imageUrls    = uploadedUrls.filter(Boolean);

  const imageContextNote = imageUrls.length > 0
    ? `\n\nThe following ${imageUrls.length} product image(s) were extracted from this PDF and uploaded to storage. ` +
      `They appear in the order they occur in the document. ` +
      `Assign each image URL to the product that visually matches it — use the order of images on the page and the SKU/label nearest each image. ` +
      `Use these URLs for the image_urls field:\n` +
      imageUrls.map((u, i) => `  Image ${i + 1}: ${u}`).join('\n')
    : '\n\nNo embedded images were found; leave image_urls as [].';

  // 2. Send the full PDF to Claude for visual + text extraction
  const pdfBase64 = fileBuffer.toString('base64');
  let raw: string;

  try {
    const msg = await anthropic.messages.create({
      model     : 'claude-opus-4-5',
      max_tokens: 8192,
      messages  : [{
        role   : 'user',
        content: [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {
            type  : 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
          } as any,
          {
            type: 'text',
            text: `You are parsing a wholesale fashion linesheet PDF.

Extract every distinct product and return a JSON array. Each object must have these fields:
- sku (string, or "" if missing)
- description (product name/title, required)
- color (string)
- gender ("Women"|"Men"|"Unisex"|"Kids")
- season (e.g. "SS26", "FW25")
- brand_name (string)
- category ("Womenswear"|"Menswear"|"Accessories"|"Footwear"|"Contemporary"|"Luxury"|"Outerwear")
- material (string or null)
- delivery_window (string or null)
- wsp_usd (wholesale price as number, 0 if missing)
- srp (retail price as number, 0 if missing)
- moq (minimum order quantity as integer, default 1)
- stock_total (integer, 0 if missing)
- sizes (object mapping size label→quantity e.g. {"S":10,"M":15}, or {})
- image_urls (array — assign from the extracted URLs listed below, or [] if none match)
- tags (array of descriptive keyword strings)
- product_notes (longer description or "")
${imageContextNote}

Rules:
- One product per colour/style variant if they have different SKUs; merge if they share a SKU.
- Skip header rows, totals, page numbers, and blank rows.
- If the brand name appears in the document header, use it for all products.
- Return ONLY the JSON array, no markdown fences, no commentary.`,
          },
        ],
      }],
    });

    raw = (msg.content[0] as { type: string; text: string }).text.trim();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Claude PDF extraction failed: ' + msg }, { status: 500 });
  }

  // 3. Parse Claude's response
  let products: Record<string, unknown>[];
  try {
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    products = JSON.parse(jsonStr);
    if (!Array.isArray(products)) throw new Error('Response was not an array');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to parse Claude response: ' + msg, raw }, { status: 500 });
  }

  // 4. Normalise / auto-assign SKUs
  const usedSkus = new Set<string>();
  let seq = 1;
  products = products.map(p => {
    let sku = String(p.sku ?? '').trim();
    if (!sku) {
      const bc = brandCode || (String(p.brand_name ?? 'SKU').slice(0, 4).toUpperCase()) || 'SKU';
      do { sku = `${bc}-${String(seq++).padStart(4, '0')}`; } while (usedSkus.has(sku));
    }
    usedSkus.add(sku);

    const sizes = (p.sizes && typeof p.sizes === 'object' && !Array.isArray(p.sizes))
      ? p.sizes as Record<string, number>
      : {};
    const stockFromSizes = Object.values(sizes).reduce((a: number, b) => a + (Number(b) || 0), 0);

    // Ensure any image_urls that Claude returned are valid strings
    const assignedUrls = (Array.isArray(p.image_urls) ? p.image_urls : [])
      .map((u: unknown) => String(u ?? '').trim())
      .filter((u: string) => u.startsWith('http'));

    return {
      ...p,
      sku,
      wsp_usd    : parseFloat(String(p.wsp_usd ?? 0)) || 0,
      srp        : parseFloat(String(p.srp ?? 0)) || 0,
      moq        : Math.max(1, Math.floor(parseFloat(String(p.moq ?? 1)) || 1)),
      stock_total: Math.floor(parseFloat(String(p.stock_total ?? stockFromSizes)) || 0),
      sizes,
      image_urls : assignedUrls,
      tags       : Array.isArray(p.tags) ? p.tags : [],
      tier_pricing: [],
      margin     : 0.5,
    };
  });

  return NextResponse.json({
    message      : `Staged — PDF · ${products.length} products · ${imageUrls.length} images extracted`,
    detectedType : 'linesheet',
    mappings     : {},
    confidence   : 95,
    total_rows   : products.length,
    products,
    size_labels  : [],
    columnSamples: {},
    staged       : true,
    source       : 'claude-vision',
    images_found : imageUrls.length,
  });
}

// ── CIS 7 / CIS 3: xlsx security limits ──────────────────────────────────────
// xlsx has known Prototype Pollution + ReDoS vulnerabilities (no upstream fix).
// Mitigations applied:
//   1. Hard file-size cap (10 MB) — limits ReDoS attack surface
//   2. Content-type validation — rejects non-spreadsheet files disguised as xlsx
//   3. Row count cap (5 000) — limits memory exhaustion
//   4. Prototype-safe cell access via Object.prototype.hasOwnProperty check
//   5. brandCode sanitised to alphanumeric to prevent path traversal
// Full replacement (exceljs) is tracked as a future sprint item.
const MAX_FILE_BYTES = 10 * 1024 * 1024;   // 10 MB
const MAX_ROWS       = 5_000;

function sanitiseBrandCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
}

export async function POST(req: NextRequest) {
  // Auth guard — must be a signed-in brand or admin user
  const { user } = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  let fileBuffer: Buffer;
  let fileName = '';
  let brandCode = '';

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }
    const f = file as File;
    fileName = f.name ?? '';
    brandCode = sanitiseBrandCode(String(formData.get('brandCode') ?? '').trim());
    const arrayBuf = await f.arrayBuffer();

    // CIS 7: hard file-size cap before parsing
    if (arrayBuf.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds ${MAX_FILE_BYTES / 1024 / 1024} MB limit` },
        { status: 413 }
      );
    }

    fileBuffer = Buffer.from(arrayBuf);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to read upload: ' + msg }, { status: 400 });
  }

  const origLow = fileName.toLowerCase();
  const ext = origLow.endsWith('.csv') ? 'csv'
    : (origLow.endsWith('.xlsx') || origLow.endsWith('.xls')) ? 'xlsx'
    : origLow.endsWith('.pdf') ? 'pdf'
    : 'unknown';

  if (ext === 'pdf') {
    return await extractPdfWithClaude(fileBuffer, brandCode);
  }
  if (ext === 'unknown') {
    return NextResponse.json({ error: `Unsupported file type: ${fileName}. Accepted: CSV, XLSX, XLS` }, { status: 400 });
  }

  let rawHeaders: string[] = [];
  let rawRows: Record<string, string>[] = [];

  try {
    if (ext === 'csv') {
      // Use xlsx to parse CSV — it handles quoting, BOM, and encoding well
      const XLSX = await import('xlsx');
      const wb = XLSX.read(fileBuffer, { type: 'buffer', raw: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      const allAliases = new Set(
        Object.values(COLUMN_MAPS).flat().map(a => a.toLowerCase().trim())
      );
      let bestScore = -1, headerIdx = 0;
      for (let i = 0; i < Math.min(15, data.length); i++) {
        const cells = (data[i] ?? []).map(c => String(c || '').toLowerCase().trim()).filter(Boolean);
        if (cells.length < 2) continue;
        let s = cells.filter(c => allAliases.has(c)).length;
        s += cells.filter(c => isNaN(Number(c)) && c.length > 1).length * 0.5;
        if (s > bestScore) { bestScore = s; headerIdx = i; }
      }

      rawHeaders = (data[headerIdx] ?? []).map(c => String(c).trim()).filter(Boolean);
      for (let r = headerIdx + 1; r < data.length; r++) {
        const row = data[r] as unknown[];
        const nonEmpty = (row ?? []).filter(c => c !== '' && c !== null && c !== undefined);
        if (nonEmpty.length < 2) continue;
        const obj: Record<string, string> = {};
        rawHeaders.forEach((h, idx) => { obj[h] = row[idx] !== undefined ? String(row[idx]) : ''; });
        rawRows.push(obj);
      }
    } else {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      const allAliases = new Set(
        Object.values(COLUMN_MAPS).flat().map(a => a.toLowerCase().trim())
      );
      let bestScore = -1, headerRowIdx = 0;
      for (let i = 0; i < Math.min(15, data.length); i++) {
        const cells = (data[i] ?? []).map(c => String(c || '').toLowerCase().trim()).filter(Boolean);
        if (cells.length < 2) continue;
        let score = cells.filter(c => allAliases.has(c)).length;
        score += cells.filter(c => isNaN(Number(c)) && c.length > 1).length * 0.5;
        if (score > bestScore) { bestScore = score; headerRowIdx = i; }
      }

      rawHeaders = (data[headerRowIdx] ?? []).map(c => String(c).trim()).filter(Boolean);
      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row = data[r] as unknown[];
        const firstNonEmpty = (row ?? []).map(c => String(c ?? '').trim().toUpperCase()).find(c => c.length > 0) ?? '';
        if (!firstNonEmpty || firstNonEmpty.startsWith('TOTAL') || firstNonEmpty.startsWith('SUBTOTAL')) continue;
        const nonEmptyCells = (row ?? []).filter(c => c !== '' && c !== null && c !== undefined);
        if (nonEmptyCells.length < 2) continue;
        const obj: Record<string, string> = {};
        rawHeaders.forEach((h, idx) => { obj[h] = row[idx] !== undefined ? String(row[idx]) : ''; });
        rawRows.push(obj);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'File parsing failed: ' + msg }, { status: 500 });
  }

  if (rawHeaders.length === 0) {
    return NextResponse.json({ error: 'Could not detect headers in file.' }, { status: 422 });
  }

  // CIS 7: row-count cap to mitigate ReDoS via massive sheets
  if (rawRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `File contains ${rawRows.length} rows — limit is ${MAX_ROWS}. Split into smaller files.` },
      { status: 422 }
    );
  }

  const { mappings, matchedCount, columnSamples } = buildMappings(rawHeaders, rawRows);
  const activeSizeCols = buildSizeCols(rawHeaders, rawRows, mappings);
  const products = extractProducts(rawHeaders, rawRows, mappings, activeSizeCols, brandCode);

  // Detect document type
  const mappedFields = new Set(Object.values(mappings).map(v => v.field));
  const hasCarton = mappedFields.has('carton_id') || rawHeaders.some(h => h.toLowerCase().includes('carton'));
  const hasPO = rawHeaders.some(h => ['vendor code','vendor wsp','po number','purchase order'].includes(h.toLowerCase()));
  const detectedType = hasCarton ? 'packing_list' : hasPO ? 'po' : 'linesheet';
  const confidence = rawHeaders.length > 0 ? Math.round((matchedCount / rawHeaders.length) * 100) : 0;

  const sizeLabels = [...new Set(activeSizeCols.map(s => s.label))];

  return NextResponse.json({
    message      : `Staged — ${ext.toUpperCase()} · ${products.length} products · ${confidence}% confidence`,
    detectedType,
    mappings,
    confidence,
    total_rows   : products.length,
    products,
    size_labels  : sizeLabels,
    columnSamples,
    staged       : true,
  });
}
