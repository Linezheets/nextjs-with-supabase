import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

const ALIASES: Record<string, string[]> = {
  title          : ['name', 'style name', 'product name', 'style description', 'description', 'item name', 'title'],
  sku            : ['style #', 'style#', 'style number', 'style no', 'style', 'item #', 'item no', 'ref #', 'ref', 'code', 'sku'],
  category       : ['category', 'type', 'product type', 'dept', 'department', 'gender'],
  season         : ['season', 'collection', 'delivery season'],
  wsp_usd        : ['wholesale', 'ws price', 'ws', 'wholesale price', 'buy price', 'net price', 'net', 'wsp', 'wsp_usd'],
  srp            : ['msrp', 'retail', 'srp', 'retail price', 'suggested retail', 'rrp', 'consumer price'],
  color          : ['colors', 'color', 'colour', 'colorways', 'available colors'],
  sizes          : ['sizes', 'size', 'size range', 'available sizes', 'size run'],
  stock_total    : ['qty', 'quantity', 'stock', 'inventory', 'units', 'on hand', 'available qty'],
  description    : ['details', 'product details', 'fabric', 'material', 'composition', 'notes'],
  delivery_window: ['delivery', 'delivery window', 'delivery date', 'ship date', 'available', 'in store'],
};

function normalizeHeader(h: unknown): string {
  return String(h ?? '').toLowerCase().trim().replace(/[*_\-]+/g, '').replace(/\s+/g, ' ');
}

function buildColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (!map[field] && aliases.includes(norm)) map[field] = i;
    }
  });
  return map;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: 'buffer', cellText: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    if (raw[i].filter(c => String(c).trim()).length >= 3) { headerIdx = i; break; }
  }

  const headers = (raw[headerIdx] as unknown[]).map(h => String(h).trim());
  const colMap  = buildColumnMap(headers);
  const dataRows = raw.slice(headerIdx + 1).filter(r => (r as unknown[]).some(c => String(c).trim()));

  const preview = dataRows.slice(0, 20).map(row => {
    const r = row as unknown[];
    const get = (f: string) => {
      const idx = colMap[f];
      if (idx === undefined) return null;
      const v = r[idx];
      return v !== undefined && String(v).trim() !== '' ? String(v).trim() : null;
    };
    return {
      title          : get('title'),
      sku            : get('sku'),
      category       : get('category'),
      season         : get('season'),
      wsp_usd        : get('wsp_usd'),
      srp            : get('srp'),
      color          : get('color'),
      sizes          : get('sizes'),
      stock_total    : get('stock_total'),
      description    : get('description'),
      delivery_window: get('delivery_window'),
    };
  });

  return NextResponse.json({
    headers,
    column_mapping: Object.fromEntries(
      Object.entries(colMap).map(([k, v]) => [k, headers[v]]),
    ),
    preview,
    total_rows: dataRows.length,
  });
}
