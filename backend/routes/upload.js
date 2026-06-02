/**
 * Smart-Mapper Upload Engine
 * POST /api/upload/smart-sync
 *
 * Accepts any .csv / .xlsx / .xls file.
 * Fuzzy-maps column headers to Linezheets field names.
 * Returns normalised product drafts — no rigid format required from the brand.
 */

const router  = require('express').Router();
const multer  = require('multer');
const XLSX    = require('xlsx');
const path    = require('path');
const fs      = require('fs');
const { authenticate, requireBrand } = require('../middleware/auth');

// ─── Multer — store uploads in /tmp so nothing persists on disk ──────────────
const upload = multer({
  dest: path.join(__dirname, '../../tmp/uploads'),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter(req, file, cb) {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${ext}. Please upload .csv, .xlsx, or .xls`));
  }
});

// ─── Column mapping dictionary ────────────────────────────────────────────────
// Each key is our internal field name.
// Values are arrays of aliases a brand might use — all lowercase, trimmed.
const COLUMN_MAPS = {
  description: [
    'title', 'name', 'product name', 'product', 'item', 'item name',
    'item description', 'style name', 'style', 'designation', 'description', 'desc'
  ],
  sku: [
    'sku', 'item #', 'item no', 'item number', 'style #', 'style no',
    'style number', 'code', 'product code', 'product id', 'id', 'ref', 'reference'
  ],
  category: [
    'category', 'categories', 'dept', 'department', 'type', 'product type',
    'class', 'classification', 'group', 'division', 'collection',
    'category lv1', 'category lv2', 'category level 2', 'category level2',
    'cat lv2', 'product category', 'garment type', 'item type'
  ],
  retail_srp: [
    'srp', 'srp_usd', 'retail', 'retail price', 'retail usd', 'msrp',
    'price', 'tag price', 'sell price', 'selling price', 'consumer price',
    'full price', 'rrp', 'recommended retail', 'suggested retail'
  ],
  wsp_usd: [
    'wholesale', 'wholesale price', 'vendor wsp', 'vendor wsp usd',
    'wholesale usd', 'wsp', 'wsp usd', 'wsp_usd',
    'ws price', 'ws', 'trade price', 'b2b price', 'buy price',
    'net price', 'dealer price', 'distributor price'
  ],
  stock_total: [
    'stock', 'qty', 'quantity', 'inventory', 'available', 'avail',
    'on hand', 'stock qty', 'units', 'units available', 'total qty',
    'current stock', 'stock level', 'in stock'
  ],
  moq: [
    'moq', 'minimum', 'min order', 'min qty', 'minimum order',
    'minimum quantity', 'order minimum', 'min units'
  ],
  color: [
    'color', 'colour', 'colorway', 'colourway', 'color name', 'shade'
  ],
  size: [
    'size', 'sizes', 'size range', 'size chart', 'fit'
  ],
  season: [
    'season', 'collection season', 'delivery', 'delivery date', 'drop'
  ],
  material: [
    'material', 'fabric', 'composition', 'content', 'fiber', 'fibre'
  ],
  image_url: [
    'image', 'image url', 'image link', 'photo', 'photo url', 'picture',
    'img', 'img url', 'image_url', 'product image', 'thumbnail'
  ],
  description: [
    'long description', 'product description', 'copy', 'product copy',
    'marketing copy', 'notes', 'details', 'product details'
  ]
};

// ─── Fuzzy header → field mapper ─────────────────────────────────────────────
// ─── Antidote Fuzzy Mapper ────────────────────────────────────────────────────
// Pass 1  exact alias  →  Pass 2  Jaccard token overlap (≥0.40)
// Pass 3  keyword fingerprint  →  Pass 4  abbreviation expansion + re-score
// Pass 5  substring containment fallback

const KEYWORD_FINGERPRINTS_U = {
  title         : ['style name','style desc','product name','item name','article name','item desc','product title','designation'],
  sku           : ['sku','style no','style #','item code','article no','vendor code','ref no','barcode','upc'],
  category      : ['category','dept','garment type','product type','item type','lv1','lv2','level 2'],
  color         : ['color','colour','colorway','colourway'],
  season        : ['season','collection','drop','delivery'],
  wsp_usd       : ['wsp','wholesale','vendor wsp','b2b price','trade price','buy price','net price'],
  retail_srp    : ['srp','msrp','rrp','retail','retail price','consumer price','public price'],
  stock_total   : ['stock','qty','quantity','inventory','available','units','pcs','total qty','sub total','grand total'],
  moq           : ['moq','minimum','min order','min qty'],
  cost          : ['cogs','cost of goods','landed cost','factory cost'],
  size_range    : ['size run','size range','available sizes','size chart','sizing'],
  image_url     : ['image','photo','picture','thumbnail'],
};

const ABBREV_MAP_U = {
  'qty':'quantity','pcs':'pieces','pc':'pieces','desc':'description',
  'prod':'product','cat':'category','col':'color','clr':'color',
  'sz':'size','wt':'weight','wsp':'wholesale','srp':'retail price',
  'msrp':'retail price','rrp':'retail price','avail':'available',
  'inv':'inventory','usd':'','lv1':'level 1','lv2':'level 2',
  'no':'number','ref':'reference','min':'minimum','tot':'total',
  'sub':'subtotal',
};

function tokeniseU(str) {
  return str.toLowerCase().replace(/[_\-\/\\|.]+/g,' ').replace(/\s+/g,' ').trim()
    .split(' ').filter(t => t.length > 0);
}
function expandU(tokens) {
  return tokens.flatMap(t => {
    const e = ABBREV_MAP_U[t];
    return e === undefined ? [t] : (e ? e.split(' ').filter(Boolean) : []);
  });
}
function jaccardU(a, b) {
  const sa = new Set(a), sb = new Set(b);
  const inter = [...sa].filter(t => sb.has(t)).length;
  const union  = new Set([...sa,...sb]).size;
  return union ? inter / union : 0;
}

function mapHeader(rawHeader) {
  const raw    = String(rawHeader).toLowerCase().trim();
  const norm   = raw.replace(/[_\-\/\\|.]+/g,' ').replace(/\s+/g,' ').trim();
  const tokens = tokeniseU(norm);

  // Pass 1: exact alias
  for (const [field, aliases] of Object.entries(COLUMN_MAPS)) {
    if (aliases.includes(norm) || aliases.includes(raw)) return field;
  }

  // Pass 2: Jaccard ≥ 0.40
  let bestField = null, bestScore = 0;
  for (const [field, aliases] of Object.entries(COLUMN_MAPS)) {
    for (const alias of aliases) {
      if (alias.length <= 2) continue;
      const score = jaccardU(tokens, tokeniseU(alias));
      if (score > bestScore) { bestScore = score; bestField = field; }
    }
  }
  if (bestScore >= 0.40) return bestField;

  // Pass 3: keyword fingerprint
  for (const [field, signals] of Object.entries(KEYWORD_FINGERPRINTS_U)) {
    if (signals.some(sig => norm.includes(sig) || sig.includes(norm))) {
      if (COLUMN_MAPS[field]) return field;
    }
  }

  // Pass 4: abbreviation expansion + re-score (threshold 0.35)
  const expTokens = expandU(tokens);
  const expanded  = expTokens.join(' ');
  for (const [field, aliases] of Object.entries(COLUMN_MAPS)) {
    if (aliases.includes(expanded)) return field;
  }
  let expBest = null, expScore = 0;
  for (const [field, aliases] of Object.entries(COLUMN_MAPS)) {
    for (const alias of aliases) {
      if (alias.length <= 2) continue;
      const s = jaccardU(expTokens, tokeniseU(alias));
      if (s > expScore) { expScore = s; expBest = field; }
    }
  }
  if (expScore >= 0.35) return expBest;

  // Pass 5: substring containment
  for (const [field, aliases] of Object.entries(COLUMN_MAPS)) {
    if (aliases.some(a => a.length > 3 && (norm.includes(a) || a.includes(norm)))) return field;
  }

  return null;
}

// ─── Parse a numeric cell safely ─────────────────────────────────────────────
function parseNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

// ─── POST /api/upload/smart-sync ─────────────────────────────────────────────
router.post('/smart-sync', authenticate, requireBrand, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  let workbook;
  try {
    workbook = XLSX.readFile(req.file.path, {
      cellDates: true,
      raw: false,       // return formatted strings so numbers look right
    });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    return res.status(422).json({ error: `Could not parse file: ${err.message}` });
  }

  // Clean up temp file
  fs.unlink(req.file.path, () => {});

  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet     = workbook.Sheets[sheetName];
  const rows      = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (!rows.length) {
    return res.status(422).json({ error: 'File appears to be empty.' });
  }

  // ── Map column headers ──────────────────────────────────────────────────
  const rawHeaders   = Object.keys(rows[0]);
  const headerMap    = {};   // rawHeader → our field name (or null)
  const mappings     = {};   // rawHeader → { field, matched: bool }
  const unmapped     = [];

  rawHeaders.forEach(h => {
    const field = mapHeader(h);
    headerMap[h] = field;
    mappings[h]  = { field: field || h, matched: !!field };
    if (!field) unmapped.push(h);
  });

  // ── Normalise rows → product drafts ────────────────────────────────────
  const EUR_RATE = 0.92;

  const products = rows.map((row, i) => {
    const draft = { _row: i + 2, _source: req.file.originalname };

    rawHeaders.forEach(h => {
      const field = headerMap[h];
      const val   = row[h];
      if (field) draft[field] = val;
      else       draft[h]     = val; // keep unmapped columns raw
    });

    // ── Derive WSP from retail if not provided ────────────────────────────
    const retail    = parseNum(draft.retail_srp);
    const wholesale = parseNum(draft.wsp_usd);

    draft.retail_srp = retail ?? 0;
    draft.wsp_usd    = wholesale ?? (retail ? +(retail * 0.50).toFixed(2) : 0);
    draft.wsp_eur    = +(draft.wsp_usd * EUR_RATE).toFixed(2);
    draft.srp_eur    = +(draft.retail_srp * EUR_RATE).toFixed(2);

    draft.stock_total = parseNum(draft.stock_total) ?? 0;
    draft.moq         = parseNum(draft.moq)         ?? 1;
    draft.status = 'draft';

    // ── Collect unmapped columns → product_notes ──────────────────────────
    // Everything that couldn't be mapped to a known field gets concatenated as
    // "Header: value" pairs so no data is thrown away.
    const noteParts = unmapped
      .map(h => {
        const val = String(row[h] || '').trim();
        return (val && val.length > 1 && !/^\d+(\.\d+)?$/.test(val))
          ? `${h}: ${val}` : '';
      })
      .filter(Boolean);
    if (noteParts.length) draft.product_notes = noteParts.join(' | ');

    // ── Ensure image_urls is always an array ──────────────────────────────
    const imgVal = draft.image_url || '';
    draft.image_urls = imgVal ? [String(imgVal)] : [];
    delete draft.image_url;

    return draft;
  }).filter(p => p.description); // drop blank rows with no name

  // ── Summary ──────────────────────────────────────────────────────────────
  const matchedCount   = Object.values(mappings).filter(m => m.matched).length;
  const unmappedCount  = unmapped.length;
  const confidence     = Math.round((matchedCount / rawHeaders.length) * 100);

  console.log(`[Smart-Mapper] ${req.file.originalname} → ${products.length} products, ${confidence}% confidence`);

  res.json({
    message   : 'Smart-Mapper complete',
    file      : req.file.originalname,
    sheet     : sheetName,
    confidence,                       // % of headers successfully mapped
    mappings,                         // raw header → { field, matched }
    unmapped,                         // columns we couldn't identify
    total_rows: rows.length,
    products,                         // normalised draft products
  });
});

// ─── POST /api/upload/confirm — save drafts to products table ────────────────
// (Called after brand reviews the preview and clicks "Confirm Import")
router.post('/confirm', async (req, res, next) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || !products.length) {
      return res.status(400).json({ error: 'No products to save.' });
    }

    // For now — return the products as-confirmed so the UI can render them.
    // When DB is wired, this will INSERT into the products table with status='draft'.
    const saved = products.map(p => ({
      ...p,
      id    : p.id     || crypto.randomUUID(),
      status: 'draft',
      saved_at: new Date().toISOString(),
    }));

    res.json({ saved: saved.length, products: saved });
  } catch (err) { next(err); }
});

module.exports = router;
