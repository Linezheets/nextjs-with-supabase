const router = require('express').Router();
const XLSX = require('xlsx');
const multer = require('multer');
const db = require('../middleware/db');
const { authenticate, requireBrand, ownBrand, requireActiveSubscription } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv', '.ods'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only Excel (.xlsx, .xls), CSV, and ODS files are supported'));
  }
});

// Column header aliases — handles real-world inconsistency in linesheet formats
const ALIASES = {
  name:             ['name', 'style name', 'product name', 'style description', 'description', 'item name'],
  style_number:     ['style #', 'style#', 'style number', 'style no', 'style', 'item #', 'item no', 'ref #', 'ref', 'code'],
  category:         ['category', 'type', 'product type', 'dept', 'department', 'gender'],
  season:           ['season', 'collection', 'delivery season'],
  wholesale_price:  ['wholesale', 'ws price', 'ws', 'cost', 'wholesale price', 'buy price', 'net price', 'net'],
  msrp:             ['msrp', 'retail', 'srp', 'retail price', 'suggested retail', 'rrp', 'consumer price'],
  colors:           ['colors', 'color', 'colour', 'colorways', 'available colors', 'color options'],
  sizes:            ['sizes', 'size', 'size range', 'available sizes', 'size run'],
  quantity:         ['qty', 'quantity', 'stock', 'inventory', 'units', 'on hand', 'available qty'],
  description:      ['details', 'product details', 'fabric', 'material', 'composition', 'notes', 'product notes'],
  delivery_window:  ['delivery', 'delivery window', 'delivery date', 'ship date', 'available', 'in store'],
  sku_prefix:       ['sku prefix', 'sku', 'sku base', 'base sku'],
  tags:             ['tags', 'keywords', 'labels'],
};

function normalizeHeader(h) {
  return String(h || '').toLowerCase().trim().replace(/[*_\-]+/g, '').replace(/\s+/g, ' ');
}

function buildColumnMap(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (!map[field] && aliases.includes(norm)) {
        map[field] = i;
      }
    }
  });
  return map;
}

function parseRow(row, colMap) {
  const get = (field) => {
    const idx = colMap[field];
    if (idx === undefined) return null;
    const v = row[idx];
    return v !== undefined && v !== null && v !== '' ? String(v).trim() : null;
  };

  const parseNum = (field) => {
    const v = get(field);
    if (!v) return null;
    const n = parseFloat(v.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : n;
  };

  const parseArr = (field, sep = /[,|/;]+/) => {
    const v = get(field);
    if (!v) return [];
    return v.split(sep).map(s => s.trim()).filter(Boolean);
  };

  return {
    name:            get('name'),
    style_number:    get('style_number'),
    category:        get('category'),
    season:          get('season'),
    wholesale_price: parseNum('wholesale_price'),
    msrp:            parseNum('msrp'),
    colors:          parseArr('colors'),
    sizes:           parseArr('sizes'),
    quantity:        parseInt(get('quantity') || '0') || 0,
    description:     get('description'),
    delivery_window: get('delivery_window'),
    sku_prefix:      get('sku_prefix'),
    tags:            parseArr('tags'),
  };
}

// ── POST /api/linesheets/parse — upload and parse Excel/CSV ──────────────────
router.post('/parse', authenticate, requireBrand, ownBrand, requireActiveSubscription,
  upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Create an import job record
  const { rows: [job] } = await db.query(
    `INSERT INTO linesheet_imports (brand_id, filename, status) VALUES ($1,$2,'processing') RETURNING id`,
    [req.brandId, req.file.originalname]
  );

  // Run async — return job ID immediately so client can poll
  processImport(job.id, req.brandId, req.file).catch(err => {
    db.query(
      `UPDATE linesheet_imports SET status = 'failed', errors = $1, completed_at = NOW() WHERE id = $2`,
      [JSON.stringify([{ message: err.message }]), job.id]
    );
  });

  res.status(202).json({ jobId: job.id, message: 'Import started — poll /linesheets/jobs/:jobId for status' });
});

// ── POST /api/linesheets/parse-preview — return parsed rows without saving ───
router.post('/parse-preview', authenticate, requireBrand, ownBrand,
  upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const { headers, rows } = parseFile(req.file);
    const colMap = buildColumnMap(headers);
    const parsed = rows.slice(0, 20).map(r => parseRow(r, colMap)); // preview first 20
    res.json({
      headers,
      column_mapping: Object.fromEntries(Object.entries(colMap).map(([k, v]) => [k, headers[v]])),
      preview: parsed,
      total_rows: rows.length,
    });
  } catch (err) { next(err); }
});

// ── GET /api/linesheets/jobs/:jobId — poll import job status ─────────────────
router.get('/jobs/:jobId', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows: [job] } = await db.query(
      'SELECT * FROM linesheet_imports WHERE id = $1 AND brand_id = $2',
      [req.params.jobId, req.brandId]
    );
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) { next(err); }
});

// ── GET /api/linesheets/jobs — import history ─────────────────────────────────
router.get('/jobs', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, filename, status, rows_parsed, rows_created, rows_skipped, errors, created_at, completed_at
       FROM linesheet_imports WHERE brand_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.brandId]
    );
    res.json({ jobs: rows });
  } catch (err) { next(err); }
});

// ─── Internal helpers ────────────────────────────────────────────────────────

function parseFile(file) {
  const wb = XLSX.read(file.buffer, { type: 'buffer', cellText: true, cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find the header row — first row with ≥3 non-empty cells
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const filled = raw[i].filter(c => String(c).trim()).length;
    if (filled >= 3) { headerIdx = i; break; }
  }

  const headers = raw[headerIdx].map(h => String(h).trim());
  const rows = raw.slice(headerIdx + 1).filter(r => r.some(c => String(c).trim()));
  return { headers, rows };
}

async function processImport(jobId, brandId, file) {
  const errors = [];
  let rowsCreated = 0;
  let rowsSkipped = 0;

  const { headers, rows } = parseFile(file);
  const colMap = buildColumnMap(headers);

  await db.query(
    `UPDATE linesheet_imports SET rows_parsed = $1 WHERE id = $2`, [rows.length, jobId]
  );

  for (let i = 0; i < rows.length; i++) {
    const data = parseRow(rows[i], colMap);
    const rowNum = i + 2; // 1-indexed, offset by header row

    if (!data.name && !data.style_number) {
      rowsSkipped++;
      continue;
    }

    if (!data.wholesale_price && !data.name) {
      errors.push({ row: rowNum, message: 'Missing product name and price — row skipped' });
      rowsSkipped++;
      continue;
    }

    try {
      await db.transaction(async (client) => {
        // Upsert product by style_number (if provided) or name
        const { rows: [product] } = await client.query(
          `INSERT INTO products (brand_id, name, style_number, category, season, wholesale_price, msrp,
                                  description, delivery_window, tags, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')
           ON CONFLICT (brand_id, style_number) WHERE style_number IS NOT NULL
           DO UPDATE SET
             name = EXCLUDED.name,
             category = COALESCE(EXCLUDED.category, products.category),
             season = COALESCE(EXCLUDED.season, products.season),
             wholesale_price = COALESCE(EXCLUDED.wholesale_price, products.wholesale_price),
             msrp = COALESCE(EXCLUDED.msrp, products.msrp),
             description = COALESCE(EXCLUDED.description, products.description),
             delivery_window = COALESCE(EXCLUDED.delivery_window, products.delivery_window),
             tags = COALESCE(EXCLUDED.tags, products.tags),
             updated_at = NOW()
           RETURNING id, (xmax = 0) AS is_new`,
          [brandId, data.name || `Style ${data.style_number}`, data.style_number,
           data.category, data.season, data.wholesale_price, data.msrp,
           data.description, data.delivery_window,
           data.tags.length ? data.tags : null]
        );

        const productId = product.id;

        // Create variants from the color × size matrix
        const colors = data.colors.length ? data.colors : ['Default'];
        const sizes  = data.sizes.length  ? data.sizes  : ['OS'];
        const qtyPerVariant = Math.max(0, Math.round(data.quantity / (colors.length * sizes.length)));

        for (const color of colors) {
          for (const size of sizes) {
            const skuBase = data.sku_prefix || data.style_number || productId.split('-')[0].toUpperCase();
            const sku = `${skuBase}-${color.replace(/\s+/g, '').substring(0, 4).toUpperCase()}-${size}`.replace(/[^A-Z0-9-]/gi, '');

            await client.query(
              `INSERT INTO product_variants (product_id, sku, size, color, quantity)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (sku) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = NOW()`,
              [productId, sku, size, color, qtyPerVariant]
            );
          }
        }

        rowsCreated++;
      });
    } catch (err) {
      errors.push({ row: rowNum, sku: data.style_number, message: err.message });
      rowsSkipped++;
    }
  }

  await db.query(
    `UPDATE linesheet_imports
     SET status = $1, rows_created = $2, rows_skipped = $3, errors = $4, completed_at = NOW()
     WHERE id = $5`,
    [errors.length && rowsCreated === 0 ? 'failed' : 'done',
     rowsCreated, rowsSkipped, JSON.stringify(errors), jobId]
  );
}

module.exports = router;
