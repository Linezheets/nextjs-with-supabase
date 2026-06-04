import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import { setAuditUser }  from '@/lib/supabase/set-audit-user';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ── Column aliases — handles real-world linesheet inconsistency ───────────────
const ALIASES: Record<string, string[]> = {
  title           : ['name', 'style name', 'product name', 'style description', 'description', 'item name', 'title'],
  sku             : ['style #', 'style#', 'style number', 'style no', 'style', 'item #', 'item no', 'ref #', 'ref', 'code', 'sku'],
  category        : ['category', 'type', 'product type', 'dept', 'department', 'gender'],
  season          : ['season', 'collection', 'delivery season'],
  wsp_usd         : ['wholesale', 'ws price', 'ws', 'wholesale price', 'buy price', 'net price', 'net', 'wsp', 'wsp_usd'],
  srp             : ['msrp', 'retail', 'srp', 'retail price', 'suggested retail', 'rrp', 'consumer price'],
  color           : ['colors', 'color', 'colour', 'colorways', 'available colors', 'color options'],
  sizes           : ['sizes', 'size', 'size range', 'available sizes', 'size run'],
  stock_total     : ['qty', 'quantity', 'stock', 'inventory', 'units', 'on hand', 'available qty'],
  description     : ['details', 'product details', 'fabric', 'material', 'composition', 'notes', 'product notes'],
  delivery_window : ['delivery', 'delivery window', 'delivery date', 'ship date', 'available', 'in store'],
  tags            : ['tags', 'keywords', 'labels'],
};

function normalizeHeader(h: unknown): string {
  return String(h ?? '').toLowerCase().trim().replace(/[*_\-]+/g, '').replace(/\s+/g, ' ');
}

function buildColumnMap(headers: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (!map[field] && aliases.includes(norm)) map[field] = i;
    }
  });
  return map;
}

function parseFile(buffer: Buffer): { headers: unknown[]; rows: unknown[][] } {
  const wb = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    if (raw[i].filter(c => String(c).trim()).length >= 3) { headerIdx = i; break; }
  }

  return {
    headers: (raw[headerIdx] as unknown[]).map(h => String(h).trim()),
    rows   : raw.slice(headerIdx + 1).filter(r => (r as unknown[]).some(c => String(c).trim())),
  };
}

function parseRow(row: unknown[], colMap: Record<string, number>, brandUserId: string, brandName: string) {
  const get = (field: string) => {
    const idx = colMap[field];
    if (idx === undefined) return null;
    const v = (row as unknown[])[idx];
    return v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : null;
  };
  const num = (field: string) => {
    const v = get(field);
    if (!v) return null;
    const n = parseFloat(v.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : n;
  };

  const sizesRaw = get('sizes');
  const sizeKeys = sizesRaw ? sizesRaw.split(/[,|/;]+/).map(s => s.trim()).filter(Boolean) : [];
  const sizes: Record<string, number> = {};
  sizeKeys.forEach(s => { sizes[s] = 0; });

  return {
    brand_id   : brandUserId,
    brand_name : brandName,
    title      : get('title') ?? `Style ${get('sku') ?? 'Unknown'}`,
    sku        : get('sku'),
    category   : (get('category') ?? 'GENERAL').toUpperCase(),
    season     : get('season'),
    wsp_usd    : num('wsp_usd') ?? 0,
    srp        : num('srp') ?? 0,
    color      : get('color'),
    sizes,
    stock_total: parseInt(get('stock_total') ?? '0') || 0,
    description: get('description'),
    delivery_window: get('delivery_window'),
    tags       : get('tags') ? get('tags')!.split(/[,|]+/).map(t => t.trim()).filter(Boolean) : [],
    status     : 'active',
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user) await setAuditUser(supabase, user);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: sf } = await admin
    .from('brand_storefronts')
    .select('brand_name')
    .eq('user_id', user.id)
    .maybeSingle();

  const brandName = sf?.brand_name ?? user.email ?? 'Brand';

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const allowed = ['.xlsx', '.xls', '.csv', '.ods'];
  const ext = '.' + file.name.split('.').pop()!.toLowerCase();
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'Only Excel (.xlsx, .xls), CSV, and ODS files are supported' }, { status: 400 });
  }

  // Create import job record
  const { data: job } = await admin
    .from('linesheet_imports')
    .insert({ brand_user_id: user.id, filename: file.name, status: 'processing' })
    .select('id')
    .single();

  if (!job) return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 });

  // Run async import — return job ID immediately
  const buffer = Buffer.from(await file.arrayBuffer());
  runImport(job.id, user.id, brandName, buffer, admin).catch(err => {
    admin.from('linesheet_imports').update({
      status      : 'failed',
      errors      : JSON.stringify([{ message: err.message }]),
      completed_at: new Date().toISOString(),
    }).eq('id', job.id);
  });

  return NextResponse.json(
    { jobId: job.id, message: 'Import started — poll /api/linesheets/jobs/' + job.id + ' for status' },
    { status: 202 },
  );
}

async function runImport(
  jobId    : string,
  userId   : string,
  brandName: string,
  buffer   : Buffer,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin    : any,
) {
  const errors: { row: number; sku?: string | null; message: string }[] = [];
  let rowsCreated = 0;
  let rowsSkipped = 0;

  const { headers, rows } = parseFile(buffer);
  const colMap = buildColumnMap(headers);

  await admin.from('linesheet_imports').update({ rows_parsed: rows.length }).eq('id', jobId);

  for (let i = 0; i < rows.length; i++) {
    const data = parseRow(rows[i] as unknown[], colMap, userId, brandName);
    const rowNum = i + 2;

    if (!data.title && !data.sku) { rowsSkipped++; continue; }
    if (!data.wsp_usd && !data.title) {
      errors.push({ row: rowNum, message: 'Missing product name and price — row skipped' });
      rowsSkipped++;
      continue;
    }

    try {
      if (data.sku) {
        // Upsert by SKU
        const { error } = await admin.from('inventory').upsert(
          { ...data, sku: data.sku },
          { onConflict: 'sku', ignoreDuplicates: false },
        );
        if (error) throw new Error(error.message);
      } else {
        const { error } = await admin.from('inventory').insert(data);
        if (error) throw new Error(error.message);
      }
      rowsCreated++;
    } catch (err) {
      errors.push({ row: rowNum, sku: data.sku, message: (err as Error).message });
      rowsSkipped++;
    }
  }

  await admin.from('linesheet_imports').update({
    status      : errors.length && rowsCreated === 0 ? 'failed' : 'done',
    rows_created: rowsCreated,
    rows_skipped: rowsSkipped,
    errors      : JSON.stringify(errors),
    completed_at: new Date().toISOString(),
  }).eq('id', jobId);
}
