// ─────────────────────────────────────────────────────────────────────────────
//  LINEZHEETS SERVER  v3.0  —  Supabase-backed
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const multer   = require('multer');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const Anthropic        = require('@anthropic-ai/sdk');
const crypto           = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'lz-dev-jwt-secret-2025';

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Supabase client ──────────────────────────────────────────────────────────
// Server uses the service-role key (bypasses RLS) when available.
// Falls back to anon key — make sure INSERT/UPDATE RLS policies allow it.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('⚠️  SUPABASE_URL / SUPABASE_ANON_KEY not set — running with seed data fallback');
}

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    })
  : null;

// ─── Anthropic / Claude client ────────────────────────────────────────────────
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
if (!anthropic) console.warn('⚠️  ANTHROPIC_API_KEY not set — AI enhance features will return rule-based fallbacks');

// ─── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3001',
  'https://linezheets-platform.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const session = require('express-session');
const passport = require('./config/passport'); // Automatically executes your passport strategies

// 1. Session Middleware Setup (Must be placed BEFORE passport hooks)
app.use(session({
  secret: process.env.SESSION_SECRET || 'linezheets_dev_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 1000 * 60 * 60 * 24 // 24-hour expiration duration
  }
}));

// 2. Initialize Passport Session Pipelines
app.use(passport.initialize());
app.use(passport.session());

// 3. Security Guard Middleware for Secured Client Dashboards
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized profile state' });
}

// 4. Secure B2B Dashboard Analytics Endpoint
app.get('/api/auth/session-profile', ensureAuthenticated, (req, res) => {
  const profile = req.user;
  res.json({
    message: "Session authenticated successfully via social login",
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.full_name,
      avatar: profile.avatar_url,
      lastLogin: profile.last_login,
      loginIp: profile.last_login_ip,
      telemetry: profile.last_login_location // Stores JSONB location metrics from ipinfo
    }
  });
});
app.use(express.static(path.join(__dirname, '../public')));

// Return 400 for malformed JSON instead of crashing with a 500
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});
const upload = multer({ dest: path.join(__dirname, '../uploads/') });

// ─── Exchange Rates ────────────────────────────────────────────────────────────
const EXCHANGE_RATES = { EUR: 0.92, GBP: 0.79 };

// ─── In-Memory Stores (sessions / carts / orders / offers stay in-memory) ─────
const sessions    = new Map();
const carts       = new Map();
const savedItems  = new Map();
const orders      = [];
const offers      = [];
const verifications = [];

// ─── Seed fallback (used only when Supabase is unreachable / not configured) ──
const SEED_INVENTORY = [
  {
    id: 1, title:'Silk Blazer', sku:'LZ-BLZ-001', category:'OUTERWEAR',
    gender:'WOMEN', color:'Ivory', season:'SS27', line:'SS27',
    brand_name:'Brand Name', brand_id:1,
    tags:['white','ivory','luxury','formal','women','blazer','ss27'],
    srp_usd:1200, margin:0.50, moq:5,
    sizes:{ XS:3, S:8, M:15, L:12, XL:7 }, stock:45,
    delivery_window:'Jun–Jul 2026',
    image_urls:['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80'],
    tier_pricing:[{ tier_name:'Silver', min_qty:10, discount_pct:5 },{ tier_name:'Gold', min_qty:25, discount_pct:10 }],
  },
  {
    id: 2, title:'Cashmere Trouser', sku:'LZ-TRS-002', category:'BOTTOMS',
    gender:'WOMEN', color:'Black', season:'AW27', line:'AW27',
    brand_name:'Brand Name', brand_id:1,
    tags:['black','cashmere','luxury','tailored','women','trousers','aw27'],
    srp_usd:850, margin:0.50, moq:10,
    sizes:{ XS:1, S:3, M:4, L:3, XL:1 }, stock:12,
    delivery_window:'Aug–Sep 2026',
    image_urls:['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=800&q=80'],
    tier_pricing:[{ tier_name:'Silver', min_qty:20, discount_pct:5 },{ tier_name:'Gold', min_qty:50, discount_pct:12 }],
  },
  {
    id: 3, title:'Minimalist Tote', sku:'LZ-TOT-003', category:'ACCESSORIES',
    gender:'UNISEX', color:'Tan', season:'SS27', line:'SS27',
    brand_name:'Brand Name', brand_id:1,
    tags:['tan','leather','minimalist','bag','tote','unisex','ss27'],
    srp_usd:450, margin:0.45, moq:20,
    sizes:{ OS:88 }, stock:88,
    delivery_window:'May–Jun 2026',
    image_urls:['https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80'],
    tier_pricing:[{ tier_name:'Silver', min_qty:40, discount_pct:5 },{ tier_name:'Gold', min_qty:100, discount_pct:10 }],
  },
  {
    id: 4, title:'Leather Chelsea Boot', sku:'LZ-BOT-004', category:'FOOTWEAR',
    gender:'UNISEX', color:'Black', season:'AW27', line:'AW27',
    brand_name:'Brand Name', brand_id:1,
    tags:['black','leather','chelsea','boots','unisex','aw27'],
    srp_usd:650, margin:0.48, moq:8,
    sizes:{ '36':1, '37':2, '38':1, '39':1 }, stock:5,
    delivery_window:'Sep–Oct 2026',
    image_urls:['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'],
    tier_pricing:[{ tier_name:'Silver', min_qty:16, discount_pct:5 },{ tier_name:'Gold', min_qty:40, discount_pct:10 }],
  },
  {
    id: 5, title:'Linen Midi Dress', sku:'LZ-DRS-005', category:'DRESSES',
    gender:'WOMEN', color:'Sand', season:'SS27', line:'SS27',
    brand_name:'Brand Name', brand_id:1,
    tags:['sand','linen','midi','dress','women','ss27','resort'],
    srp_usd:520, margin:0.50, moq:6,
    sizes:{ XS:5, S:12, M:18, L:10, XL:4 }, stock:49,
    delivery_window:'Apr–May 2026',
    image_urls:['https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80'],
    tier_pricing:[{ tier_name:'Silver', min_qty:12, discount_pct:5 },{ tier_name:'Gold', min_qty:30, discount_pct:10 }],
  },
  {
    id: 6, title:'Merino Knit Cardigan', sku:'LZ-KNT-006', category:'KNITWEAR',
    gender:'WOMEN', color:'Camel', season:'AW27', line:'AW27',
    brand_name:'Brand Name', brand_id:1,
    tags:['camel','merino','knit','cardigan','women','aw27'],
    srp_usd:680, margin:0.50, moq:8,
    sizes:{ XS:4, S:10, M:14, L:8, XL:3 }, stock:39,
    delivery_window:'Jul–Aug 2026',
    image_urls:['https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80'],
    tier_pricing:[{ tier_name:'Silver', min_qty:16, discount_pct:5 },{ tier_name:'Gold', min_qty:40, discount_pct:10 }],
  },
];

// ─── Supabase data helpers ────────────────────────────────────────────────────

// ─── Column adapters ──────────────────────────────────────────────────────────
// DB columns now match app names exactly: description, wsp_usd, srp,
// stock_total. These functions are kept as pass-throughs for safety — they
// handle any stale capitalised names that might appear from cached PostgREST
// responses or old rows, and can be removed after a full data validation pass.
function normalizeDbRow(row) {
  if (!row) return row;
  const out = { ...row };
  // Legacy capitalised column names (pre-migration compat)
  if ('WSP_usd'     in out) { out.wsp_usd    = out.WSP_usd;   delete out.WSP_usd;   }
  if ('Description' in out) { out.description = out.Description; delete out.Description; }
  if ('SRP_usd'     in out) { out.srp  = out.SRP_usd;  delete out.SRP_usd;   }
  if ('srp_usd'     in out && !('srp'  in out)) { out.srp  = out.srp_usd;  delete out.srp_usd;  }
  if ('stock'       in out && !('stock_total' in out)) { out.stock_total = out.stock;     delete out.stock;    }
  return out;
}
function denormalizeForDb(row) {
  // DB columns now match app names — no translation required.
  // Still strips any stale capitalised aliases before writing.
  if (!row) return row;
  const out = { ...row };
  delete out.WSP_usd; delete out.Description; delete out.SRP_usd;
  delete out.srp_usd; delete out.stock;  // old names — never write these
  return out;
}

/**
 * Fetch all rows from the inventory table with optional filters.
 * Falls back to SEED_INVENTORY if Supabase is not configured or errors.
 */
async function dbGetInventory({ category, season, search, ids, limit, offset, sort } = {}) {
  if (!supabase) return applyFilters(SEED_INVENTORY, { category, season, search, ids, limit, offset, sort });

  let q = supabase.from('inventory').select('*');

  if (category && DB_COLUMNS.has('category')) q = q.ilike('category', category);
  if (season   && DB_COLUMNS.has('season'))   q = q.eq('season', season);
  if (ids && ids.length)                      q = q.in('id', ids);

  // Full-text search — only columns confirmed present at startup
  if (search) {
    const orStr = SEARCH_COLUMNS.map(c => `${c}.ilike.%${search}%`).join(',');
    q = q.or(orStr);
  }

  // Sorting — only use srp_usd column once the migration has added it
  if      (sort === 'price_asc'  && DB_COLUMNS.has('srp'))  q = q.order('srp', { ascending: true  });
  else if (sort === 'price_desc' && DB_COLUMNS.has('srp'))  q = q.order('srp', { ascending: false });
  else if (sort === 'name_asc')                                      q = q.order('description', { ascending: true  });
  else                                                               q = q.order('id',          { ascending: false });

  let { data, error } = await q;

  // If the OR filter errored (e.g. column added by migration not yet cached),
  // retry with a title-only search before falling back to seed data.
  if (error && search) {
    console.warn(`⚠️  OR search failed (${error.message}) — retrying title-only`);
    const retry = await supabase.from('inventory').select('*').ilike('description', `%${search}%`);
    if (!retry.error) { data = retry.data; error = null; }
  }

  if (error) {
    console.error('⚠️  Supabase inventory fetch error:', error.message, '— using seed fallback');
    return applyFilters(SEED_INVENTORY, { category, season, search, ids, limit, offset, sort });
  }

  const all = (data || []).map(normalizeDbRow);

  // Price range + pagination done in JS (simpler than chaining rangeFilter)
  return all;
}

/** Fetch a single inventory row by id */
async function dbGetProduct(id) {
  if (!supabase) return SEED_INVENTORY.find(p => p.id === parseInt(id)) || null;

  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('⚠️  Supabase single product error:', error.message);
    return SEED_INVENTORY.find(p => p.id === parseInt(id)) || null;
  }
  return normalizeDbRow(data);
}

// Live column registry — populated at startup by probing the real Supabase table.
// Falls back to the minimum set (what we know exists before the migration runs).
// Exact columns confirmed in Supabase after 003_inventory_realign.sql migration
const DESIRED_COLUMNS = new Set([
  'description','sku','category','brand_name',
  'wsp_usd','srp','stock_total','sizes',
  'moq','margin','cost','product_notes',
  'image_urls','delivery_window','created_at',
  'tier_pricing','color','gender','season','material',
]);

const DESIRED_SEARCH_COLS = ['description','sku','category','brand_name'];

// Pre-seeded with every confirmed column — schema probe will refine at startup
let DB_COLUMNS = new Set([
  'description','sku','category','brand_name',
  'wsp_usd','srp','stock_total','sizes',
  'moq','margin','cost','product_notes',
  'image_urls','delivery_window',
  'tier_pricing','color','gender','season','material',
]);
let SEARCH_COLUMNS = ['description','sku','category','brand_name'];

/** Probe actual table columns once at startup and update the live sets */
async function refreshSchema() {
  if (!supabase) return;
  try {
    // Strategy 1: fetch one real row — the keys tell us exactly what exists in the table.
    // This is more reliable than probing each column individually (PostgREST rejects limit=0).
    const { data: rows, error: rowErr } = await supabase
      .from('inventory').select('*').limit(1);

    if (!rowErr && rows && rows.length > 0) {
      const realCols = new Set(Object.keys(rows[0]));
      DB_COLUMNS     = new Set([...DESIRED_COLUMNS].filter(c => realCols.has(c)));
      SEARCH_COLUMNS = DESIRED_SEARCH_COLS.filter(c => DB_COLUMNS.has(c));
      console.log(`🗃️  Schema probe: ${DB_COLUMNS.size}/${DESIRED_COLUMNS.size} desired columns confirmed (from live row)`);
      console.log(`🔍 Search columns: ${SEARCH_COLUMNS.join(', ')}`);
      return;
    }

    // Strategy 2: table is empty — probe each column with limit(1) (not 0, avoids PostgREST quirk)
    console.log('ℹ️  Table empty — probing columns individually…');
    const confirmed = [];
    for (const col of DESIRED_COLUMNS) {
      const { error } = await supabase.from('inventory').select(col).limit(1);
      if (!error) confirmed.push(col);
    }
    DB_COLUMNS     = new Set(confirmed);
    SEARCH_COLUMNS = DESIRED_SEARCH_COLS.filter(c => DB_COLUMNS.has(c));
    console.log(`🗃️  Schema probe: ${confirmed.length}/${DESIRED_COLUMNS.size} columns confirmed (individual probe)`);
    console.log(`🔍 Search columns: ${SEARCH_COLUMNS.join(', ')}`);
  } catch (e) {
    console.warn('⚠️  Schema probe failed:', e.message);
  }
}

/** Strips any key not in confirmed DB_COLUMNS so upserts never hit "column does not exist" */
function sanitiseRow(row) {
  const renamed = denormalizeForDb(row);
  const out = {};
  for (const [k, v] of Object.entries(renamed)) {
    // 'title' is a DB-generated column — never write to it directly.
    // Route any stray 'title' key into 'description' (the source column) instead.
    if (k === 'title') {
      if (!out.description && v) out.description = v;
      continue;
    }
    if (DB_COLUMNS.has(k)) out[k] = v;
  }
  return out;
}

/**
 * Upsert an array of product rows into inventory.
 * Conflict target: sku (when present), otherwise insert new.
 * Returns { inserted, updated, errors }
 */
async function dbUpsertProducts(rows) {
  if (!supabase) {
    console.warn('⚠️  Supabase not configured — upsert skipped');
    return { inserted: 0, updated: 0, errors: ['Supabase not configured'] };
  }

  // ── Pre-flight: derive WSP_usd from SRP if missing, ensure sizes is valid JSON ──
  const prepared = rows.map(row => {
    const out = { ...row };

    // 1. WSP derivation — if wsp_usd (or WSP_usd) is null/0, derive from srp × margin
    const wsp = parseFloat(out.wsp_usd ?? out.WSP_usd) || 0;
    const srp = parseFloat(out.srp ?? out.srp_usd) || 0;
    const margin = parseFloat(out.margin) || 0.50;
    if (!wsp && srp > 0) {
      out.wsp_usd = parseFloat((srp * margin).toFixed(2));
    } else if (!wsp && !srp) {
      out.wsp_usd = 0; // both unknown — store 0
    }

    // 2. sizes must always be a non-null plain object to satisfy the DB NOT NULL + DEFAULT '{}'
    if (typeof out.sizes === 'string') {
      try { out.sizes = JSON.parse(out.sizes); } catch { out.sizes = {}; }
    }
    if (!out.sizes || typeof out.sizes !== 'object' || Array.isArray(out.sizes)) {
      out.sizes = {};
    }

    // 3. tier_pricing must always be a serialisable array (JSONB column)
    if (!Array.isArray(out.tier_pricing)) {
      if (typeof out.tier_pricing === 'string') {
        try { out.tier_pricing = JSON.parse(out.tier_pricing); } catch { out.tier_pricing = []; }
      } else {
        out.tier_pricing = [];
      }
    }

    return out;
  });

  const clean      = prepared.map(sanitiseRow);
  const withSku    = clean.filter(r => r.sku && String(r.sku).trim().length > 0);
  const withoutSku = clean.filter(r => !r.sku || String(r.sku).trim().length === 0);

  let inserted = 0;
  const errors = [];

  if (withSku.length) {
    // Attempt 1: native upsert with ON CONFLICT (requires UNIQUE constraint on sku)
    const { data, error } = await supabase
      .from('inventory')
      .upsert(withSku, { onConflict: 'sku', ignoreDuplicates: false })
      .select('id');

    if (error) {
      if (error.message.includes('no unique or exclusion constraint')) {
        // UNIQUE constraint not on sku → manual upsert: delete existing SKUs then re-insert
        console.warn('⚠️  sku UNIQUE constraint missing — using manual delete-then-insert upsert.');
        const skuList = withSku.map(r => r.sku);
        await supabase.from('inventory').delete().in('sku', skuList); // remove stale rows
        const { data: d2, error: e2 } = await supabase
          .from('inventory').insert(withSku).select('id');
        if (e2) errors.push(`Manual upsert insert: ${e2.message}`);
        else inserted += (d2 || []).length;
      } else if (error.message.includes('duplicate key')) {
        // Unique constraint exists but upsert still hit a conflict — retry row by row
        console.warn('⚠️  Duplicate key on upsert — retrying row-by-row');
        for (const row of withSku) {
          const { data: d3, error: e3 } = await supabase
            .from('inventory')
            .upsert(row, { onConflict: 'sku', ignoreDuplicates: false })
            .select('id');
          if (e3) errors.push(`Row upsert (${row.sku}): ${e3.message}`);
          else inserted += (d3 || []).length;
        }
      } else if (error.message.includes('row-level security') || error.message.includes('RLS')) {
        errors.push('RLS_BLOCKED: Add SUPABASE_SERVICE_ROLE_KEY to backend/.env to allow server writes');
      } else {
        errors.push(`SKU upsert: ${error.message}`);
      }
    } else {
      inserted += (data || []).length;
    }
  }

  if (withoutSku.length) {
    const { data, error } = await supabase
      .from('inventory')
      .insert(withoutSku)
      .select('id');
    if (error) {
      if (error.message.includes('row-level security') || error.message.includes('RLS')) {
        errors.push('RLS_BLOCKED: Add SUPABASE_SERVICE_ROLE_KEY to backend/.env to allow server writes');
      } else {
        errors.push(`No-SKU insert: ${error.message}`);
      }
    } else {
      inserted += (data || []).length;
    }
  }

  return { inserted, updated: 0, errors };
}

/** Pure JS filter/sort/paginate — used as fallback and for price-range filtering */
function applyFilters(arr, { category, season, search, ids, limit, offset, sort, min_price, max_price } = {}) {
  let r = [...arr];
  if (category)  r = r.filter(p => (p.category||'').toUpperCase() === category.toUpperCase());
  if (season)    r = r.filter(p => p.season === season);
  if (search) {
    const q = search.toLowerCase();
    r = r.filter(p =>
      (p.description||'').toLowerCase().includes(q) ||
      (p.sku||'').toLowerCase().includes(q) ||
      (p.brand_name||'').toLowerCase().includes(q) ||
      (p.category||'').toLowerCase().includes(q) ||
      (p.tags||[]).some(t => t.includes(q))
    );
  }
  if (ids && ids.length) r = r.filter(p => ids.includes(String(p.id)));
  if (min_price) r = r.filter(p => parseFloat(p.srp ?? p.srp_usd) >= parseFloat(min_price));
  if (max_price) r = r.filter(p => parseFloat(p.srp ?? p.srp_usd) <= parseFloat(max_price));
  if (sort === 'price_asc')  r.sort((a,b) => (a.srp ?? a.srp_usd) - (b.srp ?? b.srp_usd));
  if (sort === 'price_desc') r.sort((a,b) => (b.srp ?? b.srp_usd) - (a.srp ?? a.srp_usd));
  if (sort === 'name_asc')   r.sort((a,b) => (a.description||'').localeCompare(b.description||''));
  if (sort === 'newest')     r.sort((a,b) => b.id - a.id);
  return r;
}

// ─── Buyer Auth ───────────────────────────────────────────────────────────────
function signBuyerToken(buyer) {
  return jwt.sign(
    { sub: buyer.id, email: buyer.email, store_name: buyer.store_name, type: 'buyer' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function getOrCreateBuyer(token) {
  // Dev fallback: create an in-memory session for any non-JWT token
  if (!token) return null;
  if (!sessions.has(token)) {
    const id = 'buyer_dev_' + Buffer.from(token).toString('hex').slice(0, 8);
    sessions.set(token, {
      id,
      first_name : 'Demo',
      last_name  : 'Buyer',
      email      : 'buyer@demo.com',
      store_name : 'Sample Boutique',
      country    : 'US',
      status     : 'active',
      verification_status: 'verified',
      created_at : new Date().toISOString(),
    });
  }
  return sessions.get(token);
}

function getBuyerFromReq(req) {
  const auth  = req.headers.authorization || '';
  const raw   = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!raw) return { token: null, buyer: null };

  // Try real JWT first
  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    if (payload.type === 'buyer') {
      return { token: raw, buyer: { id: payload.sub, email: payload.email, store_name: payload.store_name }, realJwt: true };
    }
  } catch {}

  // Fallback to dev session
  return { token: raw, buyer: getOrCreateBuyer(raw) };
}

// ─── Buyer Registration & Auth Routes ─────────────────────────────────────────

// POST /api/buyers/register  — brand admin registers a new buyer
app.post('/api/buyers/register', async (req, res) => {
  const { store_name, email, temp_password, registered_by } = req.body;
  if (!store_name || !email || !temp_password)
    return res.status(400).json({ error: 'store_name, email, and temp_password are required' });

  try {
    const hash = await bcrypt.hash(temp_password, 10);
    const { data, error } = await supabase
      .from('buyers')
      .insert([{
        store_name,
        email         : email.toLowerCase().trim(),
        password_hash : hash,
        temp_password : true,
        status        : 'pending',
        registered_by : registered_by || 'brand_admin',
      }])
      .select('id, email, store_name, status, created_at')
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Email already registered' });
      throw error;
    }
    console.log(`👤 Buyer registered: ${email} by ${registered_by || 'brand_admin'}`);
    res.json({ buyer: data, message: 'Buyer registered successfully' });
  } catch (err) {
    console.error('Register buyer error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyers/login
app.post('/api/buyers/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    // 1. Try Supabase Auth first (new accounts registered via /api/auth/register/buyer)
    if (supabaseAuth) {
      const { data: authData } = await supabaseAuth.auth.signInWithPassword({ email, password });
      if (authData?.user) {
        const { data: buyer } = await supabase.from('buyers').select('*').eq('id', authData.user.id).maybeSingle();
        const profile = buyer || { id: authData.user.id, email: authData.user.email, store_name: authData.user.user_metadata?.store_name || '', status: 'active' };
        const token = signBuyerToken(profile);
        console.log(`🔑 Buyer login (Supabase Auth): ${email}`);
        return res.json({ token, needs_onboard: !buyer || buyer.status === 'pending', buyer: { id: profile.id, email: profile.email, store_name: profile.store_name, first_name: profile.first_name || null, status: profile.status } });
      }
    }

    // 2. Legacy bcrypt path for existing buyers registered by brand admins
    const { data: buyer, error } = await supabase
      .from('buyers').select('*').eq('email', email.toLowerCase().trim()).single();
    if (error || !buyer) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, buyer.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signBuyerToken(buyer);
    console.log(`🔑 Buyer login (legacy): ${email} | needs_onboard=${buyer.temp_password}`);
    res.json({
      token,
      needs_onboard: buyer.temp_password === true,
      buyer: { id: buyer.id, email: buyer.email, store_name: buyer.store_name, first_name: buyer.first_name, status: buyer.status },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyers/activate  — buyer sets real password + completes profile
app.post('/api/buyers/activate', async (req, res) => {
  const { buyer } = getBuyerFromReq(req);
  if (!buyer) return res.status(401).json({ error: 'Unauthorized' });

  const {
    new_password, first_name, last_name, phone,
    store_address, city, country, store_url,
    instagram, tiktok, linkedin, other_socials,
    store_type, categories_sold,
    price_range_min, price_range_max,
    market_segment, annual_buy_budget,
  } = req.body;

  if (!new_password || new_password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const hash    = await bcrypt.hash(new_password, 10);
    const updates = {
      password_hash     : hash,
      temp_password     : false,
      status            : 'active',
      onboarded_at      : new Date().toISOString(),
      first_name, last_name, phone,
      store_address, city,
      country           : country || 'US',
      store_url, instagram, tiktok, linkedin, other_socials,
      store_type,
      categories_sold   : Array.isArray(categories_sold) ? categories_sold : [],
      price_range_min   : parseFloat(price_range_min) || null,
      price_range_max   : parseFloat(price_range_max) || null,
      market_segment,
      annual_buy_budget : parseFloat(annual_buy_budget) || null,
    };
    // Strip undefined fields
    Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

    const { data: updated, error } = await supabase
      .from('buyers').update(updates).eq('id', buyer.id).select('*').single();
    if (error) throw error;

    // Run AI analysis in the background
    analyzeBuyer(updated).catch(console.error);

    const newToken = signBuyerToken(updated);
    delete updated.password_hash;
    console.log(`✅ Buyer activated: ${updated.email}`);
    res.json({ token: newToken, buyer: updated, message: 'Profile activated' });
  } catch (err) {
    console.error('Activate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/buyers/profile
app.get('/api/buyers/profile', async (req, res) => {
  const { buyer, realJwt } = getBuyerFromReq(req);
  if (!buyer) return res.status(401).json({ error: 'Unauthorized' });

  if (!realJwt) return res.json(buyer); // dev session fallback

  try {
    const { data, error } = await supabase.from('buyers').select('*').eq('id', buyer.id).single();
    if (error || !data) return res.status(404).json({ error: 'Profile not found' });
    delete data.password_hash;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/buyers/list  — for brand admin panel (internal)
app.get('/api/buyers/list', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('buyers')
      .select('id, email, store_name, status, temp_password, registered_by, registered_at, last_login_at, onboarded_at, first_name, last_name, city, country, market_segment, categories_sold')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ buyers: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/buyers/:id  — remove a buyer (admin)
app.delete('/api/buyers/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('buyers').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/buyers/personalization  — returns analysis-based content hints
app.get('/api/buyers/personalization', async (req, res) => {
  const { buyer, realJwt } = getBuyerFromReq(req);
  if (!buyer || !realJwt) return res.json({ personalized: false, tags: [], topics: [] });

  try {
    const { data } = await supabase
      .from('buyer_analysis')
      .select('*')
      .eq('buyer_id', buyer.id)
      .single();
    res.json(data ? { ...data, personalized: true } : { personalized: false, tags: [], topics: [] });
  } catch {
    res.json({ personalized: false, tags: [], topics: [] });
  }
});

// ─── Buyer Analysis Engine (internal — data never shared with members) ─────────
async function analyzeBuyer(buyer) {
  try {
    const cats       = buyer.categories_sold || [];
    const market     = (buyer.market_segment || 'contemporary').toLowerCase();
    const priceMin   = parseFloat(buyer.price_range_min) || 0;
    const priceMax   = parseFloat(buyer.price_range_max) || 500;
    const midPrice   = (priceMin + priceMax) / 2;

    // Style DNA
    const STYLE_MAPS = {
      luxury       : { minimalist: 0.7, editorial: 0.8, tailored: 0.6, artisan: 0.5, exclusive: 0.9 },
      premium      : { refined: 0.7, contemporary: 0.8, polished: 0.6, accessible_luxury: 0.5 },
      contemporary : { accessible: 0.8, trend_led: 0.7, versatile: 0.8, commercial: 0.6 },
      streetwear   : { urban: 0.9, graphic: 0.7, oversized: 0.6, hype: 0.5 },
      'fast-fashion': { trend_driven: 0.9, volume: 0.8, accessible: 0.9, disposable: 0.4 },
    };
    const style_dna = STYLE_MAPS[market] || STYLE_MAPS.contemporary;

    // Category affinity tags (for content matching to inventory)
    const CAT_TAGS = {
      TOPS: ['shirting','layering','knitwear'], BOTTOMS: ['denim','tailoring','trousers'],
      DRESSES: ['occasion','resort','event'], OUTERWEAR: ['technical','luxury','AW'],
      FOOTWEAR: ['lifestyle','luxury','seasonal'], ACCESSORIES: ['gifting','impulse','lifestyle'],
      KNITWEAR: ['craftsmanship','comfort','AW'], ACTIVEWEAR: ['wellness','performance','lifestyle'],
      DENIM: ['casual','wardrobe-staple','denim'], SWIMWEAR: ['resort','holiday','SS'],
    };
    const category_weights = {};
    const affinityTags     = [];
    cats.forEach(c => {
      category_weights[c] = 0.9;
      (CAT_TAGS[c] || []).forEach(t => affinityTags.push(t));
    });

    // Price sensitivity
    const price_sensitivity =
      midPrice > 800 ? 'luxury' :
      midPrice > 300 ? 'premium' :
      midPrice > 80  ? 'contemporary' : 'accessible';

    // Trend alignment
    const trend_alignment =
      market === 'luxury'      ? 'classic' :
      market === 'streetwear'  ? 'early-adopter' : 'trend-follower';

    // Personalization tags (deduplicated)
    const personalization_tags = [
      market, price_sensitivity, trend_alignment,
      ...cats.map(c => c.toLowerCase()),
      ...affinityTags,
      midPrice > 400 ? 'high-aov' : 'mid-aov',
      buyer.store_type || 'boutique',
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    // Newsletter topics
    const catLabel = cats.slice(0, 2).join(' & ') || 'all categories';
    const newsletter_topics = [
      `New arrivals — ${catLabel}`,
      `${market.charAt(0).toUpperCase() + market.slice(1)} brands trending now`,
      `Reorder alerts — fast-moving styles`,
      midPrice > 400 ? 'Luxury edit — exclusive drops this week' : 'Best value finds this season',
      trend_alignment === 'early-adopter' ? 'Pre-season preview — be first to buy' : 'Best sellers — proven performers',
      `${buyer.city || buyer.country || 'Your market'} — what's selling around you`,
    ];

    const analysisData = {
      buyer_id             : buyer.id,
      style_dna,
      price_sensitivity,
      category_weights,
      trend_alignment,
      personalization_tags,
      newsletter_topics,
      analyzed_at          : new Date().toISOString(),
      version              : 1,
    };

    const { error } = await supabase
      .from('buyer_analysis')
      .upsert(analysisData, { onConflict: 'buyer_id' });

    if (error) console.error('🔴 Analysis save error:', error.message);
    else console.log(`🧠 Analysis complete for ${buyer.email} | tags: [${personalization_tags.slice(0,5).join(', ')}]`);
  } catch (err) {
    console.error('analyzeBuyer error:', err.message);
  }
}

// ─── AI Content Engine ─────────────────────────────────────────────────────────
const generateAIDescription = (product) => {
  const tones = [
    `Elevate your collection with this exquisite ${product.description}. A statement piece that moves effortlessly from showroom to sell floor.`,
    `A masterclass in ${product.category || 'fashion'} design, the ${product.description} offers timeless sophistication with contemporary proportions.`,
    `Crafted for the modern aesthetic, this ${product.description} merges luxury craftsmanship with everyday versatility — a key reorder piece for any serious buyer.`,
    `The ${product.description} is engineered for sell-through. Seasonal relevance, aspirational pricing, and immediate availability make it a cornerstone buy.`,
  ];
  return tones[Math.floor(Math.random() * tones.length)];
};

// ─── Build variants from sizes object ─────────────────────────────────────────
function buildVariants(p) {
  const sizesObj = (typeof p.sizes === 'string') ? JSON.parse(p.sizes) : (p.sizes || {});
  return Object.entries(sizesObj).map(([size, available]) => ({
    id        : `${p.id}_${size}`,
    product_id: p.id,
    size,
    color     : p.color || null,
    available : parseInt(available) || 0,
    sku       : `${p.sku || p.id}-${size}`,
  }));
}

// ─── Product formatter — outputs ALL fields for every consumer ─────────────────
// Works with both Supabase rows and seed objects.
const formatProduct = (p) => {
  if (!p) return null;

  // ── Price normalisation — SRP must always be ≥ WSP ──────────────────────────
  let srp            = parseFloat(p.srp ?? p.srp_usd)  || 0;
  let wsp            = parseFloat(p.wsp_usd)  || 0;
  const storedMargin = parseFloat(p.margin)         || 0.50;

  if (srp > 0 && wsp > 0) {
    // Both prices present — swap if they are inverted
    if (wsp > srp) { const tmp = wsp; wsp = srp; srp = tmp; }
  } else if (wsp > 0 && srp === 0) {
    // Only WSP known → derive SRP using stored margin ratio (wsp = srp × margin)
    // margin < 1 means "wsp is X% of srp".  Default 0.5 → srp = wsp × 2
    const ratio = (storedMargin > 0 && storedMargin < 1) ? storedMargin : 0.50;
    srp = parseFloat((wsp / ratio).toFixed(2));
  } else if (srp > 0 && wsp === 0) {
    // Only SRP known → derive WSP
    wsp = parseFloat((srp * storedMargin).toFixed(2));
  }

  // Recalculate margin from final normalised prices
  const margin    = (srp > 0 && wsp > 0) ? parseFloat((wsp / srp).toFixed(4)) : storedMargin;
  // Retailer margin % — how much the buyer can mark up: (srp - wsp) / srp
  const marginPct = srp > 0 ? Math.round((1 - margin) * 100) : 0;

  const desc       = p.product_notes || p.description_text || generateAIDescription(p);
  const variants   = buildVariants(p);
  const imageUrls  = p.image_urls || p.images || [];
  const tags       = p.tags || [];
  const sizes      = (typeof p.sizes === 'string') ? JSON.parse(p.sizes) : (p.sizes || {});
  const tierPricing= (typeof p.tier_pricing === 'string') ? JSON.parse(p.tier_pricing) : (p.tier_pricing || []);

  return {
    // ── Core fields ──────────────────────────────────────────────────────────
    id            : p.id,
    description   : p.description,
    name          : p.description,    // alias used by buyer-shop.html
    sku           : p.sku || '',
    category      : p.category || 'GENERAL',
    gender        : p.gender  || 'UNISEX',
    color         : p.color   || '',
    season        : p.season  || '',
    line          : p.line    || p.season || '',
    brand_name    : p.brand_name || 'Brand Name',
    brand_id      : p.brand_id   || 1,
    tags,
    product_notes : desc,
    delivery_window: p.delivery_window || '',
    created_at    : p.created_at || null,
    updated_at    : p.updated_at || null,

    // ── Pricing ──────────────────────────────────────────────────────────────
    srp_usd       : srp,
    srp_eur       : parseFloat((srp * EXCHANGE_RATES.EUR).toFixed(2)),
    msrp          : srp,                                    // buyer-shop alias
    wsp_usd       : parseFloat(wsp.toFixed(2)),
    wholesale_usd : parseFloat(wsp.toFixed(2)),             // legacy alias
    wholesale_eur : parseFloat((wsp * EXCHANGE_RATES.EUR).toFixed(2)),
    wholesale_price: parseFloat(wsp.toFixed(2)),            // buyer-shop alias
    margin        : margin,
    margin_pct    : marginPct,                              // retailer margin % for display
    cost          : parseFloat(p.cost) || null,
    tier_pricing  : tierPricing,

    // ── Inventory ────────────────────────────────────────────────────────────
    moq           : parseInt(p.moq) || 1,
    min_order_qty : parseInt(p.moq) || 1,                   // buyer-shop alias
    sizes,
    stock         : parseInt(p.stock_total ?? p.stock) || 0,
    available_units: parseInt(p.stock_total ?? p.stock) || 0,                // buyer-shop alias

    // ── Media ────────────────────────────────────────────────────────────────
    image_urls    : imageUrls,
    images        : imageUrls,
    image         : imageUrls[0] || null,

    // ── Derived ──────────────────────────────────────────────────────────────
    variants,
  };
};

// ─── AI Column Mapper ──────────────────────────────────────────────────────────
const COLUMN_MAPS = {
  // ── Product identity ──────────────────────────────────────────────────────
  name: [
    // English
    'name', 'product name', 'style name', 'item name', 'product title',
    'style title', 'item title', 'style', 'title', 'article name', 'line name',
    'range name', 'product ref', 'style desc', 'designation', 'item',
    'product', 'title & pictures', 'article', 'style description',
    'product header', 'style header', 'collection piece', 'product label',
    'style label', 'garment name', 'item label',
    // French
    'désignation', 'designation', 'nom produit', 'nom du produit', 'libellé',
    'libelle', 'intitulé', 'intitule', 'nom article',
    // Italian
    'denominazione', 'nome prodotto', 'nome articolo',
    // German
    'bezeichnung', 'produktname', 'artikelname',
    // Spanish
    'nombre producto', 'nombre artículo', 'nombre articulo',
    // Platform exports (Shopify, Faire, JOOR, Brandboom, NuOrder)
    'title (product)', 'display name', 'product handle',
  ],
  description: [
    // English
    'description', 'product description', 'long description', 'full description',
    'item description', 'article description', 'item details', 'product details',
    'product copy', 'marketing copy', 'copy', 'style notes', 'additional info',
    'specifications', 'spec', 'desc', 'description text', 'product info', 'item info',
    'detail', 'details', 'item detail', 'product detail', 'style detail',
    'line detail', 'article detail', 'garment detail',
    // French
    'description produit', 'description article', 'détail', 'detail produit',
    'détails', 'détail produit',
    // Italian
    'descrizione', 'descrizione prodotto',
    // German
    'beschreibung', 'produktbeschreibung',
  ],
  sku: [
    // English
    'sku', 'style #', 'style no', 'style number', 'item code', 'item #',
    'item no', 'item number', 'item num', 'vendor code', 'vendor #',
    'vendor no', 'vendor id', 'article no', 'article number', 'article #',
    'ref', 'ref #', 'ref no', 'reference', 'barcode', 'upc', 'ean',
    'product code', 'product id', 'style code', 'style id', 'code',
    'part no', 'part number', 'part #', 'model', 'model no', 'model number',
    'model #', 'catalog no', 'catalog #', 'cat no', 'prod code',
    'internal code', 'internal ref', 'brand code', 'supplier code',
    'supplier ref', 'factory code', 'factory ref', 'merchant sku',
    'seller sku', 'parent sku', 'variant sku',
    'sku #', 'sku no', 'style ref', 'item ref', 'season code ref',
    'product number', 'prod no', 'prod #', 'product no',
    // Platform-specific
    'variant sku', 'shopify sku', 'handle', 'variant barcode',
    // French
    'référence', 'reference', 'réf', 'ref article', 'code article',
    'code produit', 'num article',
    // Italian
    'codice', 'codice articolo', 'codice prodotto', 'cod articolo',
    // German
    'artikelnummer', 'artikel nr', 'artikel-nr', 'artikel nr.',
    // Spanish
    'código', 'codigo', 'referencia',
  ],
  color: [
    // English
    'color', 'colour', 'colorway', 'colourway', 'clrwy', 'vendor color',
    'vendor colour', 'color name', 'colour name', 'col', 'colourway name',
    'colour description', 'color description', 'color/style', 'color code',
    'colour code', 'color ref', 'colour ref', 'shade', 'hue', 'tone',
    'colorname', 'colour way', 'color way', 'finish', 'dye lot',
    'color option', 'colour option', 'fabric color', 'fabric colour',
    'vendor color', 'vendor colour', 'color description', 'clr',
    'coloris', 'couleur',  // French
    'colore', 'colorazione',  // Italian
    'farbe', 'farbvariante',  // German
    'color name & code', 'color & code',
  ],
  gender: [
    // English
    'gender', 'sex', 'mens', 'womens', 'men', 'women', 'boys', 'girls',
    'male', 'female', 'unisex', 'target gender', 'gendered',
    'gender category', 'audience', 'gender group',
    'customer gender', 'market', 'gender market',
    // French
    'genre', 'sexe',
    // Italian
    'genere', 'sesso',
    // German
    'geschlecht',
    // Platform
    'demographic', 'target market', 'intended for',
  ],
  season: [
    // English — collection / drop identifiers
    'season', 'collection', 'drop', 'season/collection',
    'collection name', 'range', 'season code', 'collection code',
    'launch date', 'release date', 'program', 'theme', 'assortment',
    'line', 'product line',
    // French
    'saison', 'gamme', 'collection nom',
    // Italian
    'stagione', 'collezione',
    // German
    'saison', 'kollektion',
  ],
  brand_name: [
    'brand', 'brand name', 'supplier', 'supplier name', 'vendor', 'vendor name',
    'manufacturer', 'label', 'label name', 'maker', 'producer',
    'marque',  // French
    'marca',   // Spanish/Italian
    'marke',   // German
  ],
  material: [
    // English
    'material', 'fabric', 'composition', 'content', 'fiber', 'fibre',
    'fabric content', 'material composition', 'textile', 'blend',
    'fabric composition', 'material content', 'fiber content', 'fibre content',
    'yarn', 'yarn content', 'construction', 'fabric type', 'material type',
    'raw material', 'fabric detail', 'care label', 'washing',
    'fabric & care', 'material & care', 'care instructions', 'care info',
    'shell', 'lining', 'outer shell', 'outer material', 'inner lining',
    'fill', 'fill power', 'down content',
    // French
    'matière', 'matiere', 'composition matière', 'tissu', 'confection',
    'matières', 'matieres',
    // Italian
    'materiale', 'composizione', 'tessuto',
    // German
    'material', 'stoff', 'zusammensetzung',
    // Spanish
    'material', 'composición', 'composicion', 'tejido',
  ],
  delivery_window: [
    // English — ship/delivery date fields ONLY (not season names)
    'delivery window', 'delivery period', 'ship window', 'ship dates',
    'delivery dates', 'expected delivery', 'delivery schedule',
    'arrival window', 'ex works window', 'ex works dates', 'exw window',
    'estimated delivery', 'lead time', 'shipping window',
    'delivery', 'ship date', 'shipping date', 'dispatch date',
    'ex works date', 'exw date', 'arrival date', 'avail date',
    'available date', 'in store date', 'in-store date',
    'delivery month', 'ship month', 'ex works', 'exw',
    // French
    'livraison', 'date livraison', 'délai livraison', 'délai de livraison',
    // Italian
    'consegna', 'data consegna',
    // German
    'lieferung', 'lieferdatum', 'liefertermin',
  ],

  // ── Pricing ───────────────────────────────────────────────────────────────
  wsp_usd: [
    // English
    'wholesale', 'wsp', 'wholesale price', 'vendor wsp', 'vendor wsp usd',
    'ws price', 'wsp usd', 'wsp_usd', 'b2b price', 'b2b', 'trade price',
    'net price', 'buy price', 'wholesale usd', 'selling price to buyer',
    'buyer price', 'dealer price', 'distributor price', 'reseller price',
    'purchase price', 'net net', 'ex factory', 'ex-factory', 'exf',
    'fob price', 'landed price', 'base price', 'floor price',
    // With currency suffixes (brands include currency in column name)
    'wholesale (usd)', 'wholesale (eur)', 'wholesale (gbp)', 'wholesale (chf)',
    'wholesale (aud)', 'wholesale (cad)', 'wholesale (hkd)', 'wholesale (jpy)',
    'wsp (usd)', 'wsp (eur)', 'wsp (gbp)', 'wsp (chf)',
    'trade price (usd)', 'trade price (eur)', 'trade price (gbp)',
    'b2b price usd', 'b2b price eur', 'net usd', 'net eur',
    // French
    'prix grossiste', 'prix achat', 'prix de vente grossiste',
    'prix net', 'prix ht', 'tarif grossiste',
    // Italian
    'prezzo ingrosso', 'prezzo netto', 'prezzo b2b',
    // German
    'einkaufspreis', 'händlerpreis', 'nettopries', 'grosshandel preis',
    // Spanish
    'precio mayorista', 'precio neto',
  ],
  srp: [
    // English
    'retail', 'retail price', 'msrp', 'srp', 'tag price',
    'rrp', 'suggested retail', 'retail usd', 'consumer price',
    'public price', 'rsp', 'recommended retail', 'recommended price',
    'market price', 'end price', 'consumer retail', 'srp usd', 'retail srp',
    'full price', 'listed price',
    // With currency suffixes
    'retail price (usd)', 'retail price (eur)', 'retail price (gbp)',
    'retail price (chf)', 'retail price (aud)', 'retail price (cad)',
    'retail price (hkd)', 'retail price (jpy)',
    'rrp (gbp)', 'rrp (usd)', 'rrp (eur)', 'msrp (usd)',
    'srp (usd)', 'srp (eur)', 'srp (chf)',
    'consumer price (usd)', 'consumer price (eur)',
    // NOT plain 'price' — too ambiguous; covered by fingerprint context only
    // French
    'prix public', 'prix conseillé', 'prix conseillee', 'prix de vente conseillé',
    'prix client', 'prix ttc', 'pvp',
    // Italian
    'prezzo pubblico', 'prezzo consigliato', 'prezzo retail',
    // German
    'verkaufspreis', 'empfohlener verkaufspreis', 'uvp', 'verbraucherpreis',
    // Spanish
    'precio público', 'precio publico', 'pvp',
  ],
  price_combined: [
    'wsp/srp', 'wholesale/retail', 'cost/retail', 'price (wsp/srp)',
    'wsp / srp', 'wholesale / retail', 'wsp & srp',
  ],
  cost: [
    // English
    'cost', 'cogs', 'cost of goods', 'landed cost', 'unit cost', 'buy cost',
    'production cost', 'factory cost', 'manufacturing cost', 'cog',
    'cost of goods sold', 'fob cost', 'ex factory cost',
    'first cost', 'sample cost', 'bom cost',
    // French
    'prix revient', 'coût', 'cout', 'prix de revient',
    // Italian
    'costo', 'costo produzione',
    // German
    'kosten', 'herstellungskosten', 'einstandspreis',
  ],

  // ── Inventory ─────────────────────────────────────────────────────────────
  stock_total: [
    // English
    'inventory', 'stock', 'available', 'on hand', 'total quantity',
    'units', 'pcs', 'pieces available', 'available units', 'units available',
    'total pcs', 'total pieces', 'total units', 'sum', 'total stock',
    'qty total', 'quantity total', 'stock level', 'current stock',
    'available stock', 'in stock', 'inventory level', 'warehouse qty',
    'available qty', 'remaining qty', 'balance qty',
    // NOT 'qty' / 'quantity' alone — those are order qty on order forms
    // NOT 'confirm' / 'total confirm' — those are order confirmation fields
    // French
    'stock disponible', 'quantité disponible', 'disponible',
    // Italian
    'quantità disponibile', 'disponibile',
    // German
    'bestand', 'verfügbar', 'lagerbestand',
  ],
  moq: [
    // English
    'minimum', 'moq', 'min order', 'order minimum', 'min qty', 'minimum qty',
    'minimum order quantity', 'min order qty', 'min units', 'minimum units',
    'order min', 'minimum order', 'minimum pieces', 'min pcs', 'min pieces',
    'piece minimum', 'unit minimum', 'pack size', 'pack qty', 'set qty',
    'assortment minimum', 'min assortment',
    // French
    'minimum commande', 'qté minimum', 'quantité minimum',
    // Italian
    'quantità minima', 'minimo ordine',
    // German
    'mindestbestellmenge', 'mindest menge',
  ],
  category: [
    // English
    'dept', 'department', 'type', 'category', 'class', 'product type',
    'category lv1', 'category lv2', 'category level 2', 'category level2',
    'cat lv2', 'cat', 'product category', 'garment type', 'item type',
    'product class', 'product group', 'division', 'sub category',
    'subcategory', 'item category', 'merchandise type', 'classification',
    'apparel type', 'style type', 'group', 'product line',
    'lv1', 'lv2', 'level 1', 'level 2', 'cat level 1', 'cat level 2',
    // Platform
    'shopify type', 'product type (shopify)', 'google category',
    // French
    'catégorie', 'categorie', 'famille', 'rayon',
    // Italian
    'categoria', 'reparto',
    // German
    'kategorie', 'warengruppe', 'abteilung',
    // Spanish
    'categoría', 'categoria',
  ],
  product_notes: [
    // English
    'notes', 'product notes', 'style notes', 'item notes', 'additional info',
    'additional notes', 'remarks', 'comments', 'memo', 'info',
    'extra info', 'other info', 'internal notes', 'buyer notes',
    'import notes', 'custom field', 'misc', 'miscellaneous',
    // NOT 'detail' or 'details' — those usually mean marketing description
    // French
    'remarques', 'observations', 'commentaires',
    // Italian
    'note', 'osservazioni',
    // German
    'notizen', 'anmerkungen', 'bemerkungen',
  ],

  // ── Size — combined text range (e.g., "S-XXL", "S/M/L/XL") ──────────────
  size_range: [
    'size', 'sizes', 'size range', 'size run', 'available sizes',
    'size availability', 'size chart', 'sizing', 'size grid',
    'size options', 'size breakdown', 'size spread', 'size listing',
    'size set', 'run of sizes', 'size group',
  ],

  // ── Individual size columns — exact token headers ONLY ───────────────────
  // Protected by EXACT_ONLY_COLS; never fuzzy/substring matched
  size_xxs  : ['xxs', 'xx-small', 'xxsmall', '2xs'],
  size_xs   : ['xs', 'x-small', 'xsmall'],
  size_s    : ['s', 'small', 'size s', 'sz s', 'sm'],
  size_m    : ['m', 'medium', 'med', 'size m', 'sz m'],
  size_l    : ['l', 'large', 'size l', 'sz l', 'lg'],
  size_xl   : ['xl', 'x-large', 'xlarge', 'size xl', 'sz xl'],
  size_xxl  : ['xxl', 'xx-large', 'xxlarge', '2xl', 'size xxl', 'sz xxl'],
  size_xxxl : ['xxxl', '3xl', 'xxx-large', 'size xxxl'],
  // Extended alpha
  size_4xl  : ['4xl', 'xxxxl', '4x-large', 'xxxx-large'],
  size_5xl  : ['5xl', 'xxxxxl', '5x-large'],
  size_6xl  : ['6xl', '6x-large'],
  size_7xl  : ['7xl'],
  size_8xl  : ['8xl'],
  // American Plus
  size_1x   : ['1x'],
  size_2x   : ['2x'],
  size_3x   : ['3x'],
  size_4x   : ['4x'],
  size_5x   : ['5x'],
  // Toddler
  size_2t   : ['2t'],
  size_3t   : ['3t'],
  size_4t   : ['4t'],
  size_5t   : ['5t'],
  size_6t   : ['6t'],
  // Baby / infant
  size_nb     : ['nb', 'newborn', 'new born', 'preemie', '0m'],
  size_0_3m   : ['0-3m', '0/3m', '0/3'],
  size_3_6m   : ['3-6m', '3/6m', '3/6'],
  size_6_9m   : ['6-9m', '6/9m', '6/9'],
  size_9_12m  : ['9-12m', '9/12m', '9/12'],
  size_12_18m : ['12-18m', '12/18m', '12/18'],
  size_18_24m : ['18-24m', '18/24m', '18/24', '24m'],
  // EU / numeric (even steps)
  size_30: ['30'], size_32: ['32'], size_34: ['34'], size_35: ['35'],
  size_36: ['36'], size_37: ['37'], size_38: ['38'], size_39: ['39'],
  size_40: ['40'], size_41: ['41'], size_42: ['42'], size_43: ['43'],
  size_44: ['44'], size_46: ['46'], size_48: ['48'], size_50: ['50'],
  size_52: ['52'], size_54: ['54'],
  // Denim waist (odd)
  size_26: ['26'], size_27: ['27'], size_29: ['29'], size_31: ['31'], size_33: ['33'],
  // UK/US shoe + dress (7-13)
  size_7: ['7'], size_8: ['8'], size_9: ['9'], size_10: ['10'],
  size_11: ['11'], size_12: ['12'], size_13: ['13'],
  // UK Plus dress
  size_16: ['16'], size_18: ['18'], size_20: ['20'], size_22: ['22'], size_24: ['24'],
  // Larger EU shoe (odd)
  size_45: ['45'], size_47: ['47'], size_49: ['49'],
  // Half shoe
  size_6_5: ['6.5', '6½'], size_7_5: ['7.5', '7½'], size_8_5: ['8.5', '8½'],
  size_9_5: ['9.5', '9½'], size_10_5: ['10.5', '10½'], size_11_5: ['11.5', '11½'],
  // Children's height-based (cm)
  size_80: ['80'],   size_86: ['86'],   size_92: ['92'],   size_98: ['98'],
  size_104: ['104'], size_110: ['110'], size_116: ['116'], size_122: ['122'],
  size_128: ['128'], size_134: ['134'], size_140: ['140'], size_146: ['146'],
  size_152: ['152'], size_158: ['158'], size_164: ['164'], size_170: ['170'],
  // Sequential / Italian (1-6)
  size_1: ['1'], size_2: ['2'], size_3: ['3'],
  size_4: ['4'], size_5: ['5'], size_6: ['6'],
  // One-size
  size_os: ['os', 'one size', 'onesize', 'o/s', 'free size', 'freesize', 'one-size', 'universal'],

  // ── Tiered wholesale (MOQ-based) ─────────────────────────────────────────
  wsp_tier_high: [
    // Exact column names from common linesheets
    'wholesale tier high - below moq', 'wholesale tier high — below moq',
    'wholesale tier high below moq', 'wholesale tier high',
    'wsp tier high', 'wsp tier high - below moq', 'wsp tier high — below moq',
    // Generic aliases
    'wholesale 40%', 'wsp 40%', 'above moq', 'wsp above moq', 'wsp above',
    'wsp high', 'standard wsp', 'regular wsp', 'single unit', 'below moq wsp',
    'wsp < moq', 'non-moq wsp', 'standard wholesale', 'single wsp',
  ],
  wsp_tier_low: [
    // Exact column names from common linesheets
    'wholesale tier low - bulk/moq+', 'wholesale tier low — bulk/moq+',
    'wholesale tier low bulk moq+', 'wholesale tier low - bulk moq+',
    'wholesale tier low', 'wsp tier low', 'wsp tier low - bulk/moq+',
    // Generic aliases
    'wholesale 35%', 'wsp 35%', 'below moq', 'wsp below moq', 'wsp low',
    'bulk wsp', 'moq wsp', 'above moq wsp', 'wsp > moq', 'volume wsp',
    'wsp moq+', 'bulk wholesale', 'volume wholesale', 'moq wholesale',
  ],

  // ── Packing list fields ───────────────────────────────────────────────────
  carton_id: [
    'your carton #', 'carton #', 'carton id', 'carton number', 'box #',
    'box id', 'carton', 'box number', 'ctn #', 'ctn no', 'carton no',
    'packing unit', 'shipping unit',
  ],
  dimensions: [
    'dimensions', 'dim', 'size (cm)', 'box size', 'carton size',
    'measurement', 'l*w*h', 'lwh', 'dimension', 'carton dimensions',
    'package size', 'box dimensions',
  ],
  weight: [
    'weight', 'wt', 'gross weight', 'net weight', 'kg', 'weight (kg)',
    'carton weight', 'gw', 'nw', 'g.w.', 'n.w.', 'gross wt', 'net wt',
    'unit weight', 'item weight',
  ],
  location: [
    'location', 'warehouse', 'origin', 'ship from', 'origin country',
    'warehouse location', 'country of origin', 'coo', 'made in',
    'manufactured in', 'production country', 'source',
  ],

  // ── Showroom / Event ──────────────────────────────────────────────────────
  showroom_city: [
    'showroom', 'city', 'showroom city', 'event city', 'location', 'drop hub',
    'venue', 'hub', 'market', 'trade show', 'fair', 'event location',
    'show location', 'tradeshow', 'trade fair', 'market location',
    'event', 'show', 'fashion week', 'fw location',
  ],

  // ── Media ─────────────────────────────────────────────────────────────────
  image_url: [
    'image', 'image url', 'photo', 'photo url', 'picture', 'picture url',
    'img', 'img url', 'thumbnail', 'product image', 'product photo',
    'image 1', 'image 2', 'image 3', 'image 4', 'image 5',
    'image one', 'image two', 'image three', 'image four', 'image five',
    'image_1', 'image_2', 'image_3', 'image_4',
    'photo 1', 'photo 2', 'photo 3', 'photo one', 'photo two',
    'pic 1', 'pic 2', 'pic 3',
    'front image', 'back image', 'detail image', 'lifestyle image',
    'front photo', 'back photo', 'side image', 'alt image',
    'main image', 'hero image', 'cover image',
    'image link', 'photo link', 'image_url', 'img_url',
  ],
};

// Fashion hub coordinate lookup — keyed by lowercase city/alias
const FASHION_HUB_COORDS = {
  'paris'         : { lat: 48.8566, lng:   2.3522, tag: 'PFW FW26' },
  'pfw'           : { lat: 48.8566, lng:   2.3522, tag: 'PFW FW26' },
  'milan'         : { lat: 45.4642, lng:   9.1900, tag: 'MFW FW26' },
  'milano'        : { lat: 45.4642, lng:   9.1900, tag: 'MFW FW26' },
  'mfw'           : { lat: 45.4642, lng:   9.1900, tag: 'MFW FW26' },
  'new york'      : { lat: 40.7128, lng: -74.0060, tag: 'NYFW FW26' },
  'new york city' : { lat: 40.7128, lng: -74.0060, tag: 'NYFW FW26' },
  'nyc'           : { lat: 40.7128, lng: -74.0060, tag: 'NYFW FW26' },
  'nyfw'          : { lat: 40.7128, lng: -74.0060, tag: 'NYFW FW26' },
  'tokyo'         : { lat: 35.6762, lng: 139.6503, tag: 'TFW FW26' },
  'tfw'           : { lat: 35.6762, lng: 139.6503, tag: 'TFW FW26' },
  'london'        : { lat: 51.5074, lng:  -0.1278, tag: 'LFW FW26' },
  'lfw'           : { lat: 51.5074, lng:  -0.1278, tag: 'LFW FW26' },
  'berlin'        : { lat: 52.5200, lng:  13.4050, tag: 'Berlin FW26' },
  'copenhagen'    : { lat: 55.6761, lng:  12.5683, tag: 'CPHFW FW26' },
  'cph'           : { lat: 55.6761, lng:  12.5683, tag: 'CPHFW FW26' },
  'seoul'         : { lat: 37.5665, lng: 126.9780, tag: 'SFW FW26' },
  'dubai'         : { lat: 25.2048, lng:  55.2708, tag: 'Dubai FW26' },
  'shanghai'      : { lat: 31.2304, lng: 121.4737, tag: 'SHW FW26' },
  'los angeles'   : { lat: 34.0522, lng:-118.2437, tag: 'LA Market FW26' },
  'la'            : { lat: 34.0522, lng:-118.2437, tag: 'LA Market FW26' },
};
const FASHION_HUB_DEFAULT = { city: 'Paris Showroom', lat: 48.8566, lng: 2.3522, tag: 'PFW FW26' };

// Size order for range expansion
const SIZE_ORDER = ['XXS','XS','S','M','L','XL','XXL','XXXL','4XL','5XL','6XL','7XL','8XL'];
const PLUS_ORDER  = ['1X','2X','3X','4X','5X'];
const T_ORDER     = ['2T','3T','4T','5T','6T'];

// Module-level map: COLUMN_MAPS key → display label (used by both smart-sync and remap)
const ANTIDOTE_SIZE_FIELDS = {
  size_xxs:'XXS', size_xs:'XS', size_s:'S', size_m:'M', size_l:'L',
  size_xl:'XL', size_xxl:'XXL', size_xxxl:'XXXL',
  size_4xl:'4XL', size_5xl:'5XL', size_6xl:'6XL', size_7xl:'7XL', size_8xl:'8XL',
  size_os:'OS',
  size_1x:'1X', size_2x:'2X', size_3x:'3X', size_4x:'4X', size_5x:'5X',
  size_2t:'2T', size_3t:'3T', size_4t:'4T', size_5t:'5T', size_6t:'6T',
  size_nb:'NB', size_0_3m:'0-3M', size_3_6m:'3-6M', size_6_9m:'6-9M',
  size_9_12m:'9-12M', size_12_18m:'12-18M', size_18_24m:'18-24M',
  size_30:'30', size_32:'32', size_34:'34', size_35:'35', size_36:'36',
  size_37:'37', size_38:'38', size_39:'39', size_40:'40', size_41:'41',
  size_42:'42', size_43:'43', size_44:'44', size_46:'46', size_48:'48',
  size_50:'50', size_52:'52', size_54:'54',
  size_26:'26', size_27:'27', size_29:'29', size_31:'31', size_33:'33',
  size_7:'7', size_8:'8', size_9:'9', size_10:'10', size_11:'11',
  size_12:'12', size_13:'13',
  size_16:'16', size_18:'18', size_20:'20', size_22:'22', size_24:'24',
  size_45:'45', size_47:'47', size_49:'49',
  size_6_5:'6.5', size_7_5:'7.5', size_8_5:'8.5', size_9_5:'9.5',
  size_10_5:'10.5', size_11_5:'11.5',
  size_80:'80', size_86:'86', size_92:'92', size_98:'98',
  size_104:'104', size_110:'110', size_116:'116', size_122:'122',
  size_128:'128', size_134:'134', size_140:'140', size_146:'146',
  size_152:'152', size_158:'158', size_164:'164', size_170:'170',
  size_1:'1', size_2:'2', size_3:'3', size_4:'4', size_5:'5', size_6:'6',
};

// Exact-only columns — these must match exactly, never via partial/substring
const EXACT_ONLY_COLS = new Set([
  // Letter sizes
  'size_xxs','size_xs','size_s','size_m','size_l','size_xl','size_xxl','size_xxxl','size_os',
  // Extended alpha
  'size_4xl','size_5xl','size_6xl','size_7xl','size_8xl',
  // American Plus sizes
  'size_1x','size_2x','size_3x','size_4x','size_5x',
  // Toddler T-sizes
  'size_2t','size_3t','size_4t','size_5t','size_6t',
  // Baby / infant
  'size_nb','size_0_3m','size_3_6m','size_6_9m','size_9_12m','size_12_18m','size_18_24m',
  // EU / shoe sizes
  'size_30','size_32','size_34','size_35','size_36','size_37','size_38','size_39','size_40',
  'size_41','size_42','size_43','size_44','size_46','size_48','size_50','size_52','size_54',
  // Denim waist odd sizes
  'size_26','size_27','size_29','size_31','size_33',
  // UK/US shoe + dress sizes
  'size_7','size_8','size_9','size_10','size_11','size_12','size_13',
  // UK Plus dress sizes
  'size_16','size_18','size_20','size_22','size_24',
  // Larger EU shoe sizes (odd)
  'size_45','size_47','size_49',
  // Half shoe sizes
  'size_6_5','size_7_5','size_8_5','size_9_5','size_10_5','size_11_5',
  // Children's height-based sizing (cm)
  'size_80','size_86','size_92','size_98',
  'size_104','size_110','size_116','size_122',
  'size_128','size_134','size_140','size_146',
  'size_152','size_158','size_164','size_170',
  // Sequential sizes
  'size_1','size_2','size_3','size_4','size_5','size_6',
]);

// ─── Module-level size header recogniser ─────────────────────────────────────
// Identifies whether a column header is a sizing token (S, M, L, XL, 38, EU 40, etc.)
// and returns its display label, or null if it's not a size header.
function headerSizeLabel(h) {
  const t = String(h).trim();
  const u = t.toUpperCase();
  if (/^(OS|O\/S|ONE.?SIZE|FREE.?SIZE|ONESIZE|UNIVERSAL)$/i.test(t)) return 'OS';
  if (/^(XXS|XS|S|M|L|XL|XXL|XXXL|[4-8]XL)$/i.test(t)) return u;
  if (/^\d{1,2}X$/i.test(t) && parseInt(t) >= 1 && parseInt(t) <= 9) return u;
  if (/^\d{1,2}T$/i.test(t)) return u;
  if (/^(NB|NEWBORN|PREEMIE|0M)$/i.test(t)) return 'NB';
  if (/^\d{1,2}[-\/]\d{1,2}M$/i.test(t)) return u;
  if (/^(XXS|XS|S|M|L|XL|XXL|XXXL)\/(XS|S|M|L|XL|XXL|XXXL|[4-8]XL)$/i.test(t)) return u;
  const regionMatch = t.match(/^(UK|EU|US|JP|JP\.?|FR|IT|DE|AU|NZ|KR)\s*(\d{1,3}(?:\.\d)?)$/i);
  if (regionMatch) return `${regionMatch[1].toUpperCase()} ${regionMatch[2]}`;
  if (/^\d{1,3}$/.test(t)) {
    const n = parseInt(t);
    if (n >= 0 && n <= 200) return String(n);
  }
  if (/^\d{1,2}\.\d$/.test(t)) {
    const n = parseFloat(t);
    if (n >= 0 && n <= 50) return String(n);
  }
  return null;
}

// ─── Antidote Fuzzy Mapper ────────────────────────────────────────────────────
// Multi-pass header resolver. Each pass raises confidence; first pass to win
// returns immediately. Exact-only size columns are never fuzzy-matched.
//
// Pass 1  — exact alias match (normalised separators)
// Pass 2  — full-token overlap: score = |intersection| / |union| (Jaccard)
//           Threshold ≥ 0.40 — catches "Category LV2", "Total Qty Avail" etc.
// Pass 3  — keyword fingerprint: each canonical field has high-signal keywords;
//           if the header contains ≥ 1 keyword it maps directly.
// Pass 4  — abbreviation expansion: common trade-doc abbreviations resolved
//           before re-running Pass 1 (e.g. "Qty" → "quantity", "Wt" → "weight").
// Pass 5  — substring containment (alias inside header or vice-versa, len > 3)
//           Only for non-exact-only columns.

const KEYWORD_FINGERPRINTS = {
  name         : ['style name','style desc','product name','item name','article name','product title','style title','designation','style header',
                  'nom produit','libelle','libellé','denominazione','nome articolo','bezeichnung','artikelbezeichnung','nombre articulo','nombre producto'],
  description  : ['product description','long description','product copy','marketing copy','item details','product details','product info','style notes','full description',
                  'item detail','product detail','detail produit','descrizione','beschreibung','descripcion','descripción'],
  sku          : ['sku','style no','style #','item code','article no','vendor code','ref no','barcode','upc','product code','style code','item no','supplier code','factory code',
                  'reference','référence','codice articolo','codice prodotto','artikelnummer','referencia','codigo'],
  category     : ['category','dept','garment type','product type','item type','lv1','lv2','level 1','level 2','product class','merchandise type','apparel type',
                  'categorie','catégorie','categoria','warengruppe','kategoría'],
  color        : ['color','colour','colorway','colourway','colour desc','shade','color option','colour option',
                  'coloris','couleur','colore','farbe','farbvariante','color option','color name','variante couleur'],
  season       : ['season','collection','drop','season code','program','programme','collection name','ligne','capsule',
                  'saison','stagione','kollektion','temporada'],
  brand_name   : ['brand name','supplier name','vendor name','label name','manufacturer','marque','marca','marchio','marke'],
  material     : ['material','fabric','composition','content','fiber','fibre','fabric content','textile','yarn','blend',
                  'shell','lining','fill','insulation','care','care instructions',
                  'matiere','matière','composition tissu','tessuto','materiale','gewebe','material zusammensetzung','tejido'],
  delivery_window: ['delivery window','ship window','delivery period','delivery dates','ship dates','arrival window','lead time',
                    'delivery','ship date','ex works','ex factory date','available date','ready date','start ship','cancel date',
                    'date livraison','livraison','consegna','data consegna','lieferdatum','liefertermin','fecha entrega','entrega'],
  wsp_usd      : ['wsp','wholesale','vendor wsp','b2b price','trade price','buy price','net price','base price','floor price','ex factory',
                  'wholesale price','wholesale usd','wholesale eur','wholesale gbp','wholesale chf','wholesale cad','wholesale aud',
                  'prix grossiste','prix de gros','prix achat','prezzo ingrosso','prezzo','großhandelspreis','händlerpreis','einkaufspreis',
                  'precio mayorista','precio neto',
                  'faire price','joor wholesale','brandboom wholesale'],
  srp          : ['srp','msrp','rrp','retail','retail price','consumer price','public price','full price','listed price','recommended price',
                  'retail usd','retail eur','retail gbp','retail chf','retail cad','retail aud',
                  'recommended retail','suggested retail','pvp','prix public','prix conseille','prix conseillé','prezzo consigliato','uvp','emp',
                  'precio pvp','precio sugerido',
                  'shopify price','compare at price'],
  stock_total  : ['stock','inventory','available','units','on hand','stock level','balance qty','in stock',
                  'stock qty','available units','current stock','stock disponible','disponible','giacenza','bestand','existencias'],
  moq          : ['moq','minimum','min order','min qty','order minimum','piece minimum','unit minimum',
                  'quantite minimum','qte min','quantità minima','mindestbestellmenge','cantidad minima'],
  cost         : ['cogs','cost of goods','landed cost','factory cost','production cost','manufacturing cost',
                  'cout','coût','costo','kosten','herstellungskosten','costo fabricacion'],
  size_range   : ['size run','size range','available sizes','size chart','sizing','size grid','size options','size spread',
                  'gamme tailles','grille tailles','gamma taglie','größenreihe','rango tallas'],
  weight       : ['weight','gross weight','net weight','poids','peso','gewicht'],
  dimensions   : ['dimensions','carton size','box size','encombrement','dimensioni','abmessungen'],
  image_url    : ['image','photo','picture','thumbnail','photo url','image url','photo link'],
  product_notes: ['notes','remarks','comments','additional info','internal notes','custom field',
                  'note','remark','observation','commentaire','nota','anmerkung','observacion'],
  wsp_tier_high: ['above moq','single unit','standard wsp','single wsp'],
  wsp_tier_low : ['below moq','moq price','bulk price','volume price','bulk wsp','volume wholesale'],
};

const ABBREV_EXPANSIONS = {
  'qty'   : 'quantity', 'pcs'   : 'pieces',   'pc'    : 'pieces',  'px'    : 'price',
  'desc'  : 'description', 'prod': 'product',  'cat'   : 'category',
  'col'   : 'color',    'clr'   : 'color',     'sz'    : 'size',
  'wt'    : 'weight',   'wsp'   : 'wholesale', 'srp'   : 'retail price',
  'msrp'  : 'retail price', 'rrp': 'retail price', 'pvp': 'retail price',
  'uvp'   : 'retail price', 'emp': 'retail price',
  'avail' : 'available','inv'   : 'inventory', 'usd'   : '',
  'eur'   : '',         'gbp'   : '',          'chf'   : '',
  'cad'   : '',         'aud'   : '',          'hkd'   : '',
  'lv1'   : 'level 1',  'lv2'  : 'level 2',   'lv3'   : 'level 3',
  'no'    : 'number',   'ref'   : 'reference', 'std'   : 'standard',
  'min'   : 'minimum',  'max'   : 'maximum',   'tot'   : 'total',
  'sub'   : 'subtotal', 'gd'    : 'goods',     'mo'    : 'month',
  'moq'   : 'minimum order quantity',
  'cogs'  : 'cost of goods sold',
  'b2b'   : 'business to business wholesale',
  'ex'    : '',
  'qte'   : 'quantity', 'qté'  : 'quantity',
  'ref'   : 'reference','réf'  : 'reference',
};

function tokenise(str) {
  return str.toLowerCase()
    .replace(/[_\-\/\\|.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(t => t.length > 0);
}

function expandAbbrevs(tokens) {
  return tokens.flatMap(t => {
    const exp = ABBREV_EXPANSIONS[t];
    if (!exp) return [t];
    return exp ? exp.split(' ').filter(Boolean) : [];
  });
}

function jaccardScore(tokensA, tokensB) {
  const setA = new Set(tokensA), setB = new Set(tokensB);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── Product Row Classifier ────────────────────────────────────────────────────
// Scores a raw data row to determine whether it represents a product.
// Uses the resolved column mappings (reverseMap) and active size columns from
// the current upload context so classification is always column-aware.
//
// Positive signals:  name/desc present, SKU, price, sizes, color
// Negative signals:  header/footer tokens, section labels, numeric rows,
//                    document-level titles, all-caps brand/season banners
//
// Returns { isProduct: bool, score: number, reason: string }

const _COL_ALIAS_SET_CACHE = { v: null };
function _colAliasSet() {
  if (!_COL_ALIAS_SET_CACHE.v)
    _COL_ALIAS_SET_CACHE.v = new Set(Object.values(COLUMN_MAPS).flat().map(a => a.toLowerCase()));
  return _COL_ALIAS_SET_CACHE.v;
}

const NON_PRODUCT_TITLE_RE = /^(total|subtotal|sub[\s_]?total|grand[\s_]?total|grand[\s_]?total[\s_]?qty|total[\s_]?qty|total[\s_]?amount|total[\s_]?units|total[\s_]?pcs|page\s*\d+|notes?|ref(?:erence)?|item|style|colour|color|description|desc|remarks?|comments?|usd|chf|eur|gbp|currency|ccy|qty|quantity|sizes?|units?|price|prices|wholesale|retail|srp|wsp|sku|code|season|collection|brand|vendor|approved|confirmed|n\/a|tbc|tbd|see[\s_]?above|continued?\.?|cont\.?|[\-–—]{2,}|\.{3,})$/i;

const DOCUMENT_HEADER_TITLE_RE = /\b(linesheet|line[\s_]?sheet|catalogue|catalog|lookbook|order[\s_]?form|price[\s_]?list|collection[\s_]?overview|wholesale[\s_]?list|product[\s_]?list|style[\s_]?guide|range[\s_]?plan|purchase[\s_]?order|delivery[\s_]?note|packing[\s_]?list|invoice)\b/i;

function classifyRow(row, mappings, reverseMap, activeSizeCols) {
  const getF = field => {
    for (const h of (reverseMap[field] || [])) {
      const v = row[h];
      if (v !== undefined && v !== '' && v !== null) return String(v).trim();
    }
    return '';
  };

  const rawTitle = (getF('name') || getF('description')).trim();

  // ── Hard disqualifiers — always non-product ─────────────────────────────────
  if (!rawTitle)
    return { isProduct: false, score: 0, reason: 'empty title' };

  if (NON_PRODUCT_TITLE_RE.test(rawTitle.trim()))
    return { isProduct: false, score: -1, reason: 'header/footer token' };

  if (DOCUMENT_HEADER_TITLE_RE.test(rawTitle))
    return { isProduct: false, score: -1, reason: 'document header' };

  if (/^(XXS|XS|S|M|L|XL|XXL|XXXL|OS|O\/S)$/i.test(rawTitle.trim()))
    return { isProduct: false, score: -1, reason: 'bare size token' };

  if (/^\$?[\d,.]+\s*(USD|CHF|EUR|GBP|AUD|CAD|JPY)?\s*[\/|]\s*\$?[\d,.]+/.test(rawTitle))
    return { isProduct: false, score: -1, reason: 'price pair as title' };

  if (/^[\d\s,\.]+$/.test(rawTitle))
    return { isProduct: false, score: -1, reason: 'numeric-only row' };

  // Title is literally one of the column header aliases → repeated header row
  if (_colAliasSet().has(rawTitle.toLowerCase()))
    return { isProduct: false, score: -1, reason: 'title matches column alias' };

  // Title parses as a size range (e.g. "S-XXL", "36-44")
  if (parseSizeRange(rawTitle))
    return { isProduct: false, score: -1, reason: 'title is size range' };

  // ALL-CAPS + colon → brand/season banner (e.g. "BRAND NAME: SPRING 2025")
  if (/^[A-Z\s:&\-\.]{10,}$/.test(rawTitle) && rawTitle.includes(':'))
    return { isProduct: false, score: -1, reason: 'brand/season banner' };

  // ── Positive / negative scoring ─────────────────────────────────────────────
  let score = 2;  // starts positive: title passed all hard guards

  if (getF('sku'))  score += 2;

  const wsp = parseFloat(getF('wsp_usd') || getF('wsp_tier_high') || getF('wsp_tier_low')) || 0;
  const srp = parseFloat(getF('srp')) || 0;
  if (wsp > 0 || srp > 0) score += 2;

  const hasSizeData = activeSizeCols.some(({ header }) => {
    const v = row[header];
    return v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;
  });
  if (hasSizeData) score += 1;

  if (getF('color')) score += 1;

  // Very sparse row → likely a section label or stray cell
  const nonEmpty = Object.values(row).filter(v => v !== '' && v !== null && v !== undefined).length;
  if (nonEmpty < 3) score -= 2;

  // Short ALL-CAPS text with few cells → section divider
  if (/^[A-Z][A-Z\s\/&\-\.]{2,28}$/.test(rawTitle) && rawTitle.length < 30 && nonEmpty < 5)
    score -= 2;

  return {
    isProduct: score >= 2,
    score,
    reason: score >= 2 ? 'ok' : `score ${score} (nonEmpty=${nonEmpty})`,
  };
}

// ─── Value-Type Inference ─────────────────────────────────────────────────────
// Analyses what's actually IN a column (cell values) to determine its likely
// field type. Used to validate/override weak header matches and resolve conflicts.
// Returns { field, confidence } where field is a COLUMN_MAPS key (or 'price' for
// unresolved WSP/SRP, or null if unknown).

const PRICE_VAL_RE = /^[$€£¥]?\s*[\d,]+\.?\d{0,2}\s*(?:USD|EUR|GBP|CHF|CAD|AUD|JPY|HKD)?(?:\s*[-–]\s*(?:USD|EUR|GBP|CHF|CAD|AUD|JPY|HKD))?$|^(?:USD|EUR|GBP|CHF|CAD|AUD|JPY|HKD)\s*[\d,]+\.?\d{0,2}$/i;
const SKU_VAL_RE   = /^[A-Z0-9][A-Z0-9\-_\.\/]{2,25}$/i;
const COLOR_VAL_RE = /\b(black|white|navy|blue|red|green|grey|gray|brown|beige|cream|ivory|tan|olive|pink|purple|orange|yellow|natural|stone|sand|ecru|charcoal|khaki|cognac|camel|indigo|teal|coral|rose|nude|bone|off.white|washed|vintage|faded|acid|distressed|denim|light|dark|mid|bright|raw)\b/i;
const SIZE_VAL_RE  = /^(XXS|XS|S|M|L|XL|XXL|XXXL|OS|O\/S|ONE\s*SIZE|\d{2,3})$/i;
const INT_VAL_RE   = /^\d{1,5}$/;

function inferColumnType(columnHeader, columnValues) {
  const vals = columnValues
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .map(v => String(v).trim());
  if (vals.length === 0) return { field: null, confidence: 0 };

  const n      = vals.length;
  const avgLen = vals.reduce((s, v) => s + v.length, 0) / n;
  const unique = new Set(vals).size;

  // ── Price ──────────────────────────────────────────────────────────────────
  const priceHits = vals.filter(v => PRICE_VAL_RE.test(v));
  if (priceHits.length / n >= 0.55) {
    const priceVals = priceHits.map(v => parseFloat(v.replace(/[^0-9.]/g, '')) || 0).filter(v => v > 0);
    const avg = priceVals.length ? priceVals.reduce((a, b) => a + b, 0) / priceVals.length : 0;
    return { field: 'price', confidence: 0.85 + (priceHits.length / n) * 0.15, avgValue: avg };
  }

  // ── SKU ────────────────────────────────────────────────────────────────────
  const skuHits = vals.filter(v => SKU_VAL_RE.test(v) && !/^(XXS|XS|S|M|L|XL|XXL|XXXL|OS)$/i.test(v) && !/\s/.test(v));
  if (skuHits.length / n >= 0.65 && avgLen < 25 && unique / n >= 0.75)
    return { field: 'sku', confidence: 0.80 + (skuHits.length / n) * 0.20 };

  // ── Size ───────────────────────────────────────────────────────────────────
  const sizeHits = vals.filter(v => SIZE_VAL_RE.test(v.trim()));
  if (sizeHits.length / n >= 0.70)
    return { field: 'size_auto', confidence: 0.90 };

  // ── Integer qty (stock / moq) ──────────────────────────────────────────────
  const intHits = vals.filter(v => INT_VAL_RE.test(v.trim()));
  if (intHits.length / n >= 0.80 && avgLen <= 5) {
    const avg = intHits.map(Number).reduce((a, b) => a + b, 0) / intHits.length;
    return { field: avg <= 50 ? 'moq' : 'stock_total', confidence: 0.65 };
  }

  // ── Color ──────────────────────────────────────────────────────────────────
  const colorHits = vals.filter(v => COLOR_VAL_RE.test(v) && v.split(/\s+/).length <= 5 && v.length < 30);
  if (colorHits.length / n >= 0.50 && avgLen < 25)
    return { field: 'color', confidence: 0.70 + (colorHits.length / n) * 0.20 };

  // ── Image URL ──────────────────────────────────────────────────────────────
  const urlHits = vals.filter(v => /^https?:\/\/\S+\.(jpg|jpeg|png|webp|gif|avif)/i.test(v));
  if (urlHits.length / n >= 0.50)
    return { field: 'image_url', confidence: 0.95 };

  // ── Long text → notes ──────────────────────────────────────────────────────
  if (avgLen > 60) return { field: 'product_notes', confidence: 0.60 };

  // ── Medium text → likely product name/description ─────────────────────────
  if (avgLen > 8 && avgLen <= 60 && unique / n >= 0.60)
    return { field: 'description', confidence: 0.45 };

  return { field: null, confidence: 0 };
}

// ─── AI Column Mapping ────────────────────────────────────────────────────────
// Calls Claude Haiku with the column headers + first 5 rows of actual data.
// Returns a { header → field } map, or null on failure.
// This is the primary, authoritative mapping layer — fuzzy matching is fallback only.

async function aiColumnMapping(rawHeaders, sampleRows, filename) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const displayRows = sampleRows.slice(0, 5);
  const table = [
    rawHeaders.map(h => String(h).padEnd(22).slice(0, 22)).join(' | '),
    rawHeaders.map(() => '─'.repeat(22)).join('─┼─'),
    ...displayRows.map(row =>
      rawHeaders.map(h => String(row[h] ?? '').padEnd(22).slice(0, 22)).join(' | ')
    ),
  ].join('\n');

  const knownFields = [
    'description (product name / title)',
    'sku (style code, item code, article number, reference)',
    'color (colorway, shade)',
    'category (garment type)',
    'gender',
    'season (collection, drop)',
    'brand_name',
    'material (fabric, composition)',
    'wsp_usd (wholesale price — lower number, what the buyer pays the brand)',
    'srp (retail price — higher number, consumer-facing price, MSRP, RRP)',
    'wsp_tier_high (below-MOQ wholesale surcharge)',
    'wsp_tier_low (bulk / MOQ+ wholesale discount)',
    'cost (COGS, factory cost)',
    'stock_total (available units, inventory)',
    'moq (minimum order quantity)',
    'size_range (combined size text like "S-XL")',
    'size_auto (individual size column with qty per size — e.g. header "S" "M" "L")',
    'image_url',
    'product_notes (internal notes, remarks)',
    'delivery_window (ship date, delivery period)',
    'skip (totals, subtotals, order approval, buyer name, invoice #, empty, irrelevant metadata)',
  ].join('\n  ');

  const prompt = `You are mapping spreadsheet columns from a fashion brand linesheet or inventory document to standard product database fields.

File: "${filename}"

Column headers and first ${displayRows.length} rows of actual data:
\`\`\`
${table}
\`\`\`

Map EVERY column header to exactly ONE standard field:
  ${knownFields}

Critical rules:
- Base your mapping on the ACTUAL DATA VALUES, not just the column header name
- If a column's values look like prices (numbers with currency), map to wsp_usd or srp
  - wsp_usd = the LOWER price (wholesale cost to buyer)
  - srp = the HIGHER price (recommended retail / consumer price)
- If a column's values are alphanumeric codes like "TOP26SST08", map to sku
- If a column's values are product names/titles (words describing a garment), map to description
- If a column header is in French, Italian, German, or Spanish, translate the concept and map accordingly
- Totals, subtotals, order confirmations, buyer names, invoice numbers → skip
- When uncertain between two similar fields, prefer the one whose values fit better

Return ONLY a valid JSON object, no explanation, no markdown, no code blocks.
Keys = exact column headers as they appear above. Values = field names from the list.
Example: {"Réf. Article": "sku", "Désignation": "description", "Prix CHF": "wsp_usd", "Prix Public": "srp"}`;

  const resp = await client.messages.create({
    model     : 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages  : [{ role: 'user', content: prompt }],
  });

  const text      = (resp.content[0]?.text || '').trim();
  const jsonMatch = text.match(/\{[\s\S]+\}/);
  if (!jsonMatch) throw new Error('No JSON in AI response');
  const result = JSON.parse(jsonMatch[0]);
  console.log('[AI Mapping] result:', result);
  return result;
}

// ─── Column Auto-Skip Classifier ─────────────────────────────────────────────
// Returns true for unmatched column headers that should be silently auto-skipped
// rather than presented to the user as requiring manual assignment.
//
// Triggers:
//   1. Header matches known non-product patterns (totals, buyer, approved, memo…)
//   2. Column is entirely empty across all data rows
//   3. Column contains predominantly long free-text (avg > 60 chars) → inline notes
//   4. Header is a bare number, index, or lone non-alphanumeric character(s)

const AUTO_SKIP_HEADER_RE = /^(total|sub[\s_]?total|grand[\s_]?total|total[\s_]?qty|total[\s_]?amount|total[\s_]?units|total[\s_]?pcs|total[\s_]?value|total[\s_]?cost|approved|confirmed|ordered|shipped|received|dispatched|invoice[\s_]?(no|#|num)?|purchase[\s_]?order|po[\s_]?(no|#|num)?|order[\s_]?(no|#|num)?|buyer|buyer[\s_]?(name|account|code|ref)|sales[\s_]?(rep|agent)|agent|territory|memo|internal[\s_]?notes?|extra|misc|other|tbd|tbc|n\/a|na|blank|filler|empty|column[\s_]?\d+|field[\s_]?\d+|col[\s_]?\d+|\d+)$/i;

const AUTO_SKIP_CONTAIN_RE = /\b(order[\s_]?total|wholesale[\s_]?total|total[\s_]?wholesale|invoice[\s_]?total|buyer[\s_]?(name|account)|sales[\s_]?rep|territory|approved[\s_]?by|confirmed[\s_]?by|ship[\s_]?to|bill[\s_]?to)\b/i;

function shouldAutoSkipColumn(header, rawRows) {
  const h = String(header).toLowerCase().trim().replace(/[_\-\/\\|.]+/g, ' ');

  // 1. Matches a known non-product header token
  if (AUTO_SKIP_HEADER_RE.test(h)) return true;
  if (AUTO_SKIP_CONTAIN_RE.test(header)) return true;

  // 2. Bare number / index / lone symbols — not a real column
  if (/^[\d\s\.\-]+$/.test(h) || h.length === 0 || /^[^a-z0-9]+$/.test(h)) return true;

  // 3. Column is entirely empty across all data rows
  const nonEmpty = rawRows.filter(r => {
    const v = r[header];
    return v !== undefined && String(v).trim() !== '' && v !== null;
  });
  if (nonEmpty.length === 0) return true;

  // 4. Column is predominantly long free-text → inline annotation / note column
  if (nonEmpty.length >= 3) {
    const avgLen = nonEmpty.reduce((s, r) => s + String(r[header] || '').trim().length, 0) / nonEmpty.length;
    if (avgLen > 60) return true;
  }

  return false;
}

const findBestMatch = (header) => {
  const raw   = String(header).toLowerCase().trim();
  const norm  = raw.replace(/[_\-\/\\|.]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = tokenise(norm);

  // ── Pre-pass A: tiered wholesale by % pattern ────────────────────────────
  if (/wholesale\s*\d+\s*%/i.test(raw) || /wsp\s*\d+\s*%/i.test(raw)) {
    const pctMatch = raw.match(/(\d+)\s*%/);
    const pct = pctMatch ? parseInt(pctMatch[1]) : 0;
    return pct >= 38 ? 'wsp_tier_high' : 'wsp_tier_low';
  }

  // ── Pre-pass B: explicit tier phrase routing ───────────────────────────────
  // Catches column headers like "Wholesale Tier High - below MOQ", "WSP High",
  // "Tier Low / Bulk", "MOQ+ Price", "Bulk/MOQ+" without relying on fuzzy scoring.
  // wsp_tier_high = standard single-unit price (orders below MOQ)
  if (/\btier[\s_\-]*high\b/i.test(raw) || /\bbelow[\s_\-]*moq\b/i.test(raw) || /\bstandard[\s_\-]*wsp\b/i.test(raw)) {
    return 'wsp_tier_high';
  }
  // wsp_tier_low = bulk / MOQ+ price
  if (/\btier[\s_\-]*low\b/i.test(raw) || /\bmoq\s*\+/i.test(raw) || /\bbulk[\s_\/]*moq\b/i.test(raw) || /\bvolume[\s_\-]*wsp\b/i.test(raw)) {
    return 'wsp_tier_low';
  }

  // ── Pre-pass C: direct field shortcuts ────────────────────────────────────
  // Short unambiguous tokens that would score poorly on Jaccard but are unambiguous.
  if (/^(retail(\s*price)?|consumer\s*price|rrp|msrp)$/i.test(norm)) return 'srp';
  if (/^(colou?r(way)?|shade|colorway)$/i.test(norm)) return 'color';
  if (/^(photo|img|image(\s*url)?)$/i.test(norm)) return 'image_url';
  if (/^(cat(egory)?|type|classification|dept)$/i.test(norm)) return 'category';

  // ── Pass 0: size header recognition — always wins before fuzzy ───────────
  // If the header looks like a sizing token (S, M, L, XL, 38, EU 40, OS…),
  // map it directly to its COLUMN_MAPS size_* key (or 'size_auto' for numeric/regional).
  if (headerSizeLabel(header)) {
    for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
      if (EXACT_ONLY_COLS.has(key) && (aliases.includes(norm) || aliases.includes(raw))) return key;
    }
    return 'size_auto';  // numeric / regional sizes not in COLUMN_MAPS
  }

  // ── Pass 1: exact alias match ─────────────────────────────────────────────
  for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
    if (aliases.includes(norm) || aliases.includes(raw)) return key;
  }

  // ── Pass 2: Jaccard token overlap against every alias ─────────────────────
  let bestField = null, bestScore = 0;
  for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
    if (EXACT_ONLY_COLS.has(key)) continue;
    for (const alias of aliases) {
      if (alias.length <= 2) continue;
      const aliasTokens = tokenise(alias);
      const score = jaccardScore(tokens, aliasTokens);
      if (score > bestScore) { bestScore = score; bestField = key; }
    }
  }
  if (bestScore >= 0.40) return bestField;

  // ── Pass 3: keyword fingerprint — direct semantic signal ──────────────────
  // Guard: only use sig.includes(norm) when norm is 3+ chars to avoid false
  // substring matches on single-letter headers like S, M, L.
  for (const [field, signals] of Object.entries(KEYWORD_FINGERPRINTS)) {
    if (signals.some(sig => norm.includes(sig) || (norm.length >= 3 && sig.includes(norm)))) {
      const mapKey = Object.keys(COLUMN_MAPS).find(k =>
        k === field ||
        (field === 'wsp_usd' && k === 'wsp_usd') ||
        (field === 'srp' && k === 'srp') ||
        (field === 'stock_total' && k === 'stock_total')
      );
      if (mapKey) return mapKey;
    }
  }

  // ── Pass 4: abbreviation expansion then re-run exact + Jaccard ───────────
  const expanded     = expandAbbrevs(tokens).join(' ');
  const expTokens    = tokenise(expanded);
  for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
    if (aliases.includes(expanded)) return key;
  }
  let expBestField = null, expBestScore = 0;
  for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
    if (EXACT_ONLY_COLS.has(key)) continue;
    for (const alias of aliases) {
      if (alias.length <= 2) continue;
      const score = jaccardScore(expTokens, tokenise(alias));
      if (score > expBestScore) { expBestScore = score; expBestField = key; }
    }
  }
  if (expBestScore >= 0.35) return expBestField;

  // ── Pass 5: substring containment fallback (alias inside header / vice versa)
  // Guard: only use a.includes(norm) when norm is 3+ chars to prevent false
  // matches on short headers (e.g. 'S' matching inside 'style name').
  for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
    if (EXACT_ONLY_COLS.has(key)) continue;
    if (aliases.some(a => a.length > 3 && (norm.includes(a) || (norm.length >= 3 && a.includes(norm))))) return key;
  }

  return null;
};

// ─── Smart Parsing Helpers ────────────────────────────────────────────────────

/** Parse combined price cells: "14.00 USD/39.00 USD", "19/49", "$16/$43", "WSP 14 / SRP 39" */
function parsePriceCell(val) {
  if (!val) return null;
  const s = String(val).replace(/[$€£¥₩₹\s]/g, '').replace(/,(\d{2})$/, '.$1');
  // Match two numbers separated by / or | with optional currency codes between them
  // Handles: "14.00USD/39.00USD", "14/39", "14.00USD|39.00USD", "WSP:14.00/SRP:39.00"
  const m = s.match(/([\d]+\.?\d{0,2})\s*(?:USD|EUR|GBP)?\s*[\/|]\s*([\d]+\.?\d{0,2})/i);
  if (!m) return null;
  const a = parseFloat(m[1]), b = parseFloat(m[2]);
  if (!a || !b) return null;
  // First number = wholesale, second = SRP (as written in most linesheets)
  // Safety check: if "second" is actually smaller it's likely reversed — swap
  return a <= b
    ? { wsp_usd: a, srp: b }
    : { wsp_usd: b, srp: a };
}

/**
 * Expand a size range / list string into a sizes object (quantity = 0 = placeholder).
 *
 * Handles all three sizing systems:
 *   Letter  : "S-XXL", "XS/S/M/L", "S/M, L, XL/XXL"
 *   EU/shoe : "36-44", "32-54", "36/38/40/42"
 *   Sequential: "1-6", "1/2/3/4", children's / Italian sizing
 *   One-size: "OS", "One Size", "O/S"
 *
 * Returns null if the string doesn't look like a size expression.
 */
function parseSizeRange(val) {
  if (!val) return null;
  const s = String(val).trim().toUpperCase();

  // ── One-size variants ──────────────────────────────────────────────────────
  if (/^(ONE.?SIZE|OS|FREE.?SIZE|UNIVERSAL|ONE\s+SIZE\s+FITS\s+ALL|ONESIZE|O\/S)$/i.test(s)) {
    return { OS: 1 };
  }

  // ── T-size range: "2T-5T", "3T-6T" ─────────────────────────────────────
  const tMatch = s.match(/^(\d)T\s*[-–]\s*(\d)T$/i);
  if (tMatch) {
    const a = parseInt(tMatch[1]), b = parseInt(tMatch[2]);
    if (a >= 2 && b <= 6 && b >= a) {
      const obj = {};
      for (let n = a; n <= b; n++) obj[n + 'T'] = 0;
      return obj;
    }
  }

  // ── Plus size range: "1X-3X", "2X-4X" ───────────────────────────────────
  const plusMatch = s.match(/^(\d)X\s*[-–]\s*(\d)X$/i);
  if (plusMatch) {
    const a = parseInt(plusMatch[1]), b = parseInt(plusMatch[2]);
    if (a >= 1 && b <= 5 && b >= a) {
      const obj = {};
      for (let n = a; n <= b; n++) obj[n + 'X'] = 0;
      return obj;
    }
  }

  // ── Numeric range: "36-44", "32-54", "1-6", "80-140" ────────────────────
  const numRange = s.match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);
  if (numRange) {
    const start = parseInt(numRange[1]), end = parseInt(numRange[2]);
    if (start >= 1 && end <= 200 && end > start && (end - start) <= 120) {
      const obj = {};
      // Children's height sizes (cm): multiples of 6 in range 50-200
      if (start >= 50 && end <= 200 && (end - start) % 6 === 0) {
        for (let n = start; n <= end; n += 6) obj[String(n)] = 0;
        return obj;
      }
      // Single-digit range (1-6) → step 1
      // Even EU clothing/shoe sizes (32-54, 36-46) → step 2
      // Everything else → step 1
      const step = (start <= 9) ? 1
                 : (start >= 28 && start % 2 === 0 && end % 2 === 0) ? 2
                 : 1;
      for (let n = start; n <= end; n += step) obj[String(n)] = 0;
      return obj;
    }
  }

  // ── Letter range: "S-XXL", "XS-L", "XXL-6XL" ────────────────────────────
  const dashMatch = s.match(/^(XXS|XS|S|M|L|XL|XXL|XXXL|[4-8]XL)\s*[-–]\s*(XXS|XS|S|M|L|XL|XXL|XXXL|[4-8]XL)$/);
  if (dashMatch) {
    const a = SIZE_ORDER.indexOf(dashMatch[1]);
    const b = SIZE_ORDER.indexOf(dashMatch[2]);
    if (a !== -1 && b !== -1 && b >= a) {
      const obj = {};
      SIZE_ORDER.slice(a, b + 1).forEach(sz => { obj[sz] = 0; });
      return obj;
    }
  }

  // ── Slash / comma list: "S/M/L/XL", "S/M, L, XL/XXL", "36/38/40", "1/2/3", "2T/3T/4T" ──
  const tokens = s.split(/[\/,\s]+/).map(t => t.trim()).filter(Boolean);
  // Accept letter sizes, 1-3 digit numbers (EU/height sizes), T-sizes, plus sizes, NB, baby month ranges
  const validSizes = tokens.filter(t =>
    SIZE_ORDER.includes(t)             ||   // XXS-8XL
    /^\d{1,3}$/.test(t)               ||   // any 1-3 digit number
    /^\d[TX]$/.test(t)                ||   // 2T-6T, 1X-5X
    /^\d{2}[TX]$/.test(t)             ||   // 10X edge case
    /^NB$/i.test(t)                   ||   // newborn
    /^\d{1,2}-\d{1,2}M$/i.test(t)         // 0-3M, 3-6M etc.
  );
  if (validSizes.length >= 2) {
    const obj = {};
    validSizes.forEach(sz => { obj[sz] = 0; });
    return obj;
  }

  return null;
}

/** Scan all cell values in a row for image URLs */
function extractImageUrlsFromRow(row) {
  const urls = [];
  const imgRe = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif|avif)(?:\?[^\s"'<>]*)?/gi;
  for (const v of Object.values(row)) {
    const s = String(v || '');
    const found = s.match(imgRe);
    if (found) found.forEach(u => urls.push(u));
    // Also catch bare URLs that end with image extensions
    if (/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif)/i.test(s.trim())) {
      if (!urls.includes(s.trim())) urls.push(s.trim());
    }
  }
  return [...new Set(urls)];
}

/** Normalise raw category strings to canonical values */
/** Normalise gender value to one of: Men / Women / Boys / Girls / Unisex */
function normalizeGender(raw) {
  if (!raw) return 'Unisex';
  const v = String(raw).toUpperCase().trim();
  // Must check Women/Girls BEFORE Men/Boys (men ⊂ women would false-match)
  if (/\bWOMEN\b|\bWOMAN\b|\bFEMALE\b|\bLADIES\b|\bLADY\b|\bGIRL(?!S*\s*BOY)/.test(v)) return 'Women';
  if (/\bGIRLS?\b/.test(v)) return 'Girls';
  if (/\bMEN\b|\bMALE\b|\bMAN\b|\bGENTLEMEN\b/.test(v)) return 'Men';
  if (/\bBOYS?\b/.test(v)) return 'Boys';
  if (/UNISEX|MIXED|ALL\s*GENDER|GENDER.?NEUTRAL/.test(v)) return 'Unisex';
  // Single-letter codes some brands use
  if (v === 'M') return 'Men';
  if (v === 'W' || v === 'F') return 'Women';
  if (v === 'B') return 'Boys';
  if (v === 'G') return 'Girls';
  if (v === 'U') return 'Unisex';
  return 'Unisex';
}

function normalizeCategory(raw, titleHint = '', gender = '') {
  // Always test the COMBINED signal — titleHint rescues noisy raw values.
  const combined = ((raw || '') + ' ' + (titleHint || '')).toUpperCase().trim();

  // ── Most-specific first ────────────────────────────────────────────────────
  // Hoodies / sweatshirts (before generic TOPS/KNITWEAR)
  if (/HOODIE|HOODY|HOODED\s*SWEAT|ZIP.?UP\s*(HOODIE|SWEAT)|PULLOVER\s*HOODIE/.test(combined)) return 'HOODIES';
  // Sweatshirts / crewnecks (before KNITWEAR)
  if (/SWEATSHIRT|CREWNECK|CREW.?NECK|FLEECE\s*(TOP|CREW)|SWEATER/.test(combined)) return 'SWEATSHIRTS';
  // T-shirts / tops
  if (/T.?SHIRT|TEE\b|\bTEE\b|\bGRAPHIC\s*TEE|\bTEE\s*SHIRT|BLOUSE|\bCROP\s*TOP/.test(combined)) return 'T-SHIRTS';
  if (/\bTOP\b|\bTANK\b|\bVEST\b|\bCUTOFF|\bSLEEVELESS/.test(combined) && !/TRACKSUIT|SWEATSUIT/.test(combined)) return 'TOPS';
  // Shirts (button-up, dress shirts, work shirts)
  if (/\bSHIRT\b|\bBUTTON.?UP|\bBUTTON.?DOWN|\bOXFORD\b|\bFLANNEL\b|\bCHAMBRAY/.test(combined)) return 'SHIRTS';
  // Knitwear (knits, cardigans, jumpers)
  if (/KNITWEAR|\bKNIT\b|CARDIGAN|JUMPER|PULLOVER|\bWOOL\b|\bCASHMERE/.test(combined)) return 'KNITWEAR';
  // Outerwear
  if (/JACKET|\bCOAT\b|PARKA|BOMBER|WINDBREAKER|OUTERWEAR|\bANORAK|\bPUFFER|\bQUILTED/.test(combined)) return 'OUTERWEAR';
  // Denim specifically
  if (/\bDENIM\b|\bJEAN\b|\bJEANS\b/.test(combined)) return 'DENIM';
  // Bottoms (trousers, cargo, shorts)
  if (/\bPANT\b|\bPANTS\b|TROUSER|CARGO|\bSHORT\b|\bSHORTS\b|\bSLACK|\bCHINO|\bCORDUROY|\bRIPSTOP/.test(combined)) return 'BOTTOMS';
  // Dresses & skirts
  if (/\bDRESS\b|\bSKIRT\b|\bMIDI\b|\bMAXI\b|\bMINI\b/.test(combined)) return 'DRESSES';
  // Sets / tracksuits
  if (/TRACKSUIT|SWEATSUIT|\bSET\b|\bCO.?ORD|\bMATCHING\s*SET|\bLOUNGE\s*SET/.test(combined)) return 'SETS';
  // Footwear
  if (/\bBOOT\b|\bBOOTS\b|\bSHOE\b|\bSHOES\b|SNEAKER|TRAINER|FOOTWEAR|SANDAL|LOAFER|SLIPPER|MULE/.test(combined)) return 'FOOTWEAR';
  // Accessories
  // Swimwear
  if (/SWIMWEAR|SWIMSUIT|BIKINI|SWIMTRUNKS|SWIM\s*TRUNK|BOARDSHORT|BOARD\s*SHORT|BATHING\s*SUIT|ONE.?PIECE\s*SWIM/.test(combined)) return 'SWIMWEAR';
  // Activewear / sportswear
  if (/ACTIVEWEAR|SPORTSWEAR|LEGGING|SPORTS\s*BRA|YOGA\s*(PANT|LEGGING)|GYM\s*(SHORT|PANT)|ATHLETIC|WORKOUT|RUNNING\s*(SHORT|PANT|TIGHT)|COMPRESSION/.test(combined)) return 'ACTIVEWEAR';
  // Lingerie / underwear
  if (/LINGERIE|UNDERWEAR|BRA\b|BRALETTE|KNICKER|PANTY|PANTIES|BRIEF\b|BRIEFS\b|BOXER\b|BOXERS\b|THONG\b|BODYSUIT\b|TEDDY\b|CORSET|NIGHTWEAR|NIGHTGOWN|PYJAMA|PAJAMA|LOUNGEWEAR/.test(combined)) return 'LINGERIE';
  // Suits / tailoring
  if (/\bSUIT\b|\bSUITS\b|BLAZER|TUXEDO|SPORT\s*COAT|SPORT\s*JACKET|TAILORED|TAILORING|TROUSER\s*SUIT|PANT\s*SUIT/.test(combined)) return 'SUITS';
  // Jerseys / team sports
  if (/\bJERSEY\b|\bJERSEYS\b|FOOTBALL\s*SHIRT|HOCKEY\s*JERSEY|BASKETBALL\s*JERSEY|RUGBY\s*SHIRT|TEAM\s*KIT|TEAM\s*UNIFORM/.test(combined)) return 'JERSEYS';
  // Uniforms
  if (/\bUNIFORM\b|\bUNIFORMS\b|WORKWEAR|SCRUBS?\b|CHEF\s*(COAT|JACKET)|COVERALL|OVERALLS?\b|HIGH.?VIS|HI.?VIS/.test(combined)) return 'UNIFORMS';
  // Bags (own category)
  if (/\bBAG\b|\bBAGS\b|TOTE\b|BACKPACK|PURSE|CLUTCH|WALLET|HANDBAG|CROSSBODY|SHOULDER\s*BAG|DUFFEL|DUFFLE|SATCHEL|BRIEFCASE/.test(combined)) return 'BAGS';
  // Accessories
  if (/\bBELT\b|SCARF|BEANIE|GLOVE|MITTEN|SOCK|\bTIE\b|\bBOWTIE|\bNECKLACE|\bBRACELET|\bRING\b|SUNGLASSES|EYEWEAR|WATCH\b|JEWEL/.test(combined)) return 'ACCESSORIES';
  if (/\bHAT\b|\bCAP\b|\bCASQUETTE|\bBUCKET\s*HAT|\bDAD\s*HAT|\bFITTED/.test(combined)) return 'HEADWEAR';
  // Gender-based inference when category is ambiguous
  const g = normalizeGender(gender);
  if (raw) {
    const r = String(raw).trim();
    // Reject spec strings, fabric descriptions, multi-line, or overly long values.
    if (
      r.includes('\n')    ||
      r.length > 40       ||
      /[:+]/.test(r)      ||
      /^CAT\s*\d/i.test(r)||
      /JACQUARD|MODAL|POLYCOTON|COTTON\b|FABRIC|LINING|MATERIAL/i.test(r)
    ) return 'GENERAL';
    // Accept clean short category values as-is
    if (r.length > 0 && r.length <= 40 && /^[\w\s\-\/&]+$/.test(r)) return r.toUpperCase();
  }
  return 'GENERAL';
}

/** Generate rich AI fashion description */
function generateRichDescription(title, category, color, season) {
  const t   = title    || 'this piece';
  const cat = normalizeCategory(category, title).toLowerCase();
  const col = color  ? color.toLowerCase()  : null;
  const ssn = season ? season.toUpperCase() : null;

  const colStr = col ? ` in ${col}` : '';
  const ssnStr = ssn ? ` from the ${ssn} collection` : '';

  const pools = {
    tops: [
      `${t}${colStr} is a clean statement${ssnStr}. The kind of graphic-heavy essential that anchors any streetwear buy and consistently re-orders across accounts.`,
      `Cut for comfort and carry weight on the floor — the ${t}${ssnStr} in ${col || 'a versatile colourway'} moves fast in any open-to-buy.`,
      `A seasonal staple with permanent shelf life. The ${t}${colStr} arrives shelf-ready${ssnStr} with the sell-through track record to back it up.`,
    ],
    knitwear: [
      `The ${t}${colStr}${ssnStr} balances warmth with editorial edge — a natural crossover between premium casualwear and street-facing retail floors.`,
      `Elevated construction meets accessible price architecture. The ${t}${colStr} answers the mid-market knitwear gap that persists across most retail floors${ssnStr}.`,
      `Statement outerwear-layer potential in every unit. The ${t}${colStr} reads as luxury at the hanger${ssnStr} — MOQ-friendly with strong AUR performance.`,
    ],
    outerwear: [
      `A category anchor${ssnStr}. The ${t}${colStr} justifies a position at the front of any seasonal floor set with its crossover appeal and margin profile.`,
      `Outerwear with genuine retail gravity — the ${t}${colStr}${ssnStr} is engineered for visibility, perceived value, and sustained reorder cycles.`,
    ],
    bottoms: [
      `The ${t}${colStr}${ssnStr} is built to be the workhorse bottom in any streetwear or contemporary buy — pairing well with the full range while standing independently.`,
      `Clean silhouette, considered detailing. The ${t}${colStr}${ssnStr} occupies the sweet spot between fashion-forward and commercially viable.`,
    ],
    dresses: [
      `A focal point buy${ssnStr}. The ${t}${colStr} lends seasonal narrative to the floor while holding strong average unit retail across size runs.`,
      `The ${t}${colStr}${ssnStr} translates from lookbook to hanger without losing impact — a standout buy for boutiques with a fashion-forward clientele.`,
    ],
    footwear: [
      `The ${t}${colStr}${ssnStr} — footwear that carries the season's conversation into the full look. Pairs naturally with hero pieces across the range.`,
    ],
    accessories: [
      `The ${t}${colStr}${ssnStr} is a strategic add-to-basket piece — high perceived value at accessible wholesale with natural attach rates to larger apparel buys.`,
    ],
  };

  const catKey = Object.keys(pools).find(k => cat.includes(k)) || null;
  const options = catKey ? pools[catKey] : [
    `The ${t}${colStr}${ssnStr} — a considered buy built for sell-through. Strong visual identity, versatile styling potential, and reliable reorder appeal.`,
    `${t}${colStr}${ssnStr}: where design intent meets commercial reality. Engineered for the floor, positioned for the customer.`,
    `A defining piece from the range. The ${t}${colStr}${ssnStr} holds its own as a standalone buy and anchors stronger orders around it.`,
  ];

  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Extract a style/SKU code from any text string.
 * Recognises patterns like: VR-EVOLUTION, LZ-BLZ-001, ABC-123, SS26-TEE
 * (2–8 uppercase letters + hyphen + 2+ alphanumeric chars, repeating segments OK)
 */
function extractSkuFromText(text) {
  if (!text) return null;
  const m = String(text).match(/\b([A-Z]{2,8}-[A-Z0-9]{2,}(?:-[A-Z0-9]+)*)\b/);
  return m ? m[1] : null;
}

// ─── Colour extraction helpers ────────────────────────────────────────────────

/**
 * Master colour regex — matches any standalone colour word or phrase.
 * Covers: basics, neutrals, fashion shades, denim washes, prints, patterns,
 * multi-word combos (light blue, dark grey, off white, heather grey…).
 */
const COLOR_RE = /\b(off[\s\-]?white|light\s+\w+|dark\s+\w+|mid\s+\w+|heather\s+\w+|washed?\s+\w+|raw\s+\w+|acid\s+\w+|bleach\s+\w+|vintage\s+\w+|stone\s+wash|indigo\s+wash|black\s+wash|grey\s+wash|blue\s+wash|black|white|grey|gray|navy|red|blue|green|orange|yellow|purple|pink|brown|khaki|olive|beige|cream|ivory|teal|coral|rust|burgundy|maroon|tan|camel|sand|stone|charcoal|slate|chalk|bone|ecru|nude|blush|rose|lilac|lavender|mint|lemon|sky|forest|indigo|sage|terra\s*cotta|terracotta|cognac|cognac|mocha|cinnamon|butter|mustard|gold|silver|copper|bronze|denim|washed|bleached|distressed|faded|raw|rinse|acid|snowflake|multi|multicolour|multicolor|tie[\s\-]dye|tiedye|camo|camouflage|leopard|zebra|floral|check|checkered|plaid|stripe|striped|print|graphic|houndstooth|tartan|paisley|argyle|jacquard|tweed|melange|marl|heather|mottled|ombre|gradient|colourblock|color[\s\-]?block)\b/i;

/**
 * Extract the most prominent colour phrase from an arbitrary text string.
 * Prefers multi-word combos (e.g. "dark grey") over single words.
 * Returns the matched colour string, title-cased, or '' if nothing found.
 */
function extractColor(text) {
  if (!text) return '';
  const str = String(text).replace(/[_\/\\|]+/g, ' ');

  // Multi-word combos first (light X, dark X, heather X, off white, etc.)
  const multiMatch = str.match(
    /\b(off[\s\-]?white|light\s+(?:grey|gray|blue|green|pink|brown|navy|wash)|dark\s+(?:grey|gray|blue|green|brown|navy|olive|wash)|mid\s+(?:grey|gray|blue|wash)|heather\s+(?:grey|gray|blue|navy|charcoal)|washed?\s+(?:black|blue|grey|gray|denim|indigo)|stone\s+wash|acid\s+wash|raw\s+(?:denim|indigo)|bleach\s+wash|vintage\s+wash)\b/i
  );
  if (multiMatch) return toTitleCase(multiMatch[0].trim());

  // Single-word colour
  const single = str.match(COLOR_RE);
  if (single) return toTitleCase(single[0].trim());

  return '';
}

function toTitleCase(s) {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ─── Auto-SKU generator ───────────────────────────────────────────────────────
/**
 * Generates a structured SKU when the brand hasn't provided one.
 *
 * Format: [BRAND][GENDER][CAT][INITIALS][COLOR][SEQ]
 * Example: FMWHDBZBL01
 *   F  = brand prefix  (first letter of first word of brand name)
 *   MW = gender code   (MW / WW / BW / GW / UN)
 *   HD = category code (HD / TS / TP / SH / SW / KN / OW / DN / BT / DS / ST / FW / HW / AC / GN)
 *   BZ = product initials (first letters of meaningful words in the product name)
 *   BL = color code    (BL=Black, WH=White, GR=Grey, NV=Navy, etc.)
 *   01 = sequence      (increments per prefix to guarantee uniqueness)
 *
 * @param {object}  product     – the draft product (description, gender, category, color)
 * @param {string}  brandCode   – optional explicit brand prefix supplied by the user
 * @param {Set}     usedSkus    – skus already emitted this batch (mutated)
 * @param {object}  seqMap      – { prefix: nextSeq } counter map (mutated)
 */
function generateSku(product, brandCode = '', usedSkus = new Set(), seqMap = {}) {
  // ── Brand prefix ─────────────────────────────────────────────────────────────
  let brand = String(brandCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (!brand) {
    const bn = String(product.brand_name || '').toUpperCase().replace(/[^A-Z\s]/g, '').trim();
    if (bn) {
      const words = bn.split(/\s+/).filter(Boolean);
      brand = words.length === 1 ? words[0].slice(0, 2) : words.map(w => w[0]).join('').slice(0, 3);
    } else {
      brand = 'XX';
    }
  }

  // ── Gender code ──────────────────────────────────────────────────────────────
  const GENDER_CODES = {
    Men: 'MW', Women: 'WW', Boys: 'BW', Girls: 'GW', Unisex: 'UN',
  };
  const genderCode = GENDER_CODES[product.gender] || 'UN';

  // ── Category code ─────────────────────────────────────────────────────────────
  const CAT_CODES = {
    HOODIES: 'HD', SWEATSHIRTS: 'SW', 'T-SHIRTS': 'TS', TOPS: 'TP',
    SHIRTS: 'SH', KNITWEAR: 'KN', OUTERWEAR: 'OW', DENIM: 'DN',
    BOTTOMS: 'BT', DRESSES: 'DS', SETS: 'ST', FOOTWEAR: 'FW',
    HEADWEAR: 'HW', ACCESSORIES: 'AC', GENERAL: 'GN',
  };
  const catCode = CAT_CODES[String(product.category || '').toUpperCase()] || 'GN';

  // ── Product initials — first letters of significant words ─────────────────────
  const SKIP_WORDS = new Set([
    'HOODIE', 'HOODY', 'SWEATSHIRT', 'TEE', 'T-SHIRT', 'TSHIRT', 'SHIRT',
    'JACKET', 'COAT', 'PANTS', 'PANT', 'JEANS', 'JEAN', 'DRESS', 'SHORTS',
    'SHORT', 'TOP', 'VEST', 'TANK', 'BLOUSE', 'JUMPER', 'CARDIGAN', 'SWEATER',
    'AND', 'THE', 'WITH', 'OF', 'FOR', 'IN', 'ON', 'AT', 'A', 'AN', 'DE',
    'ZIP', 'ZIPPER', 'PULLOVER', 'CREWNECK', 'CREW', 'FLEECE',
    'GRAPHIC', 'LONG', 'SHORT', 'SLEEVE', 'NECK', 'HIGH', 'LOW',
  ]);
  const title = String(product.description || '').toUpperCase().replace(/[^A-Z\s]/g, ' ').trim();
  const titleWords = title.split(/\s+/).filter(w => w.length > 1 && !SKIP_WORDS.has(w));
  let initials = titleWords.map(w => w[0]).join('').slice(0, 3);
  if (!initials) initials = title.replace(/\s/g, '').slice(0, 2) || 'XX';
  initials = initials.slice(0, 2).padEnd(2, 'X'); // always 2 chars

  // ── Color code ────────────────────────────────────────────────────────────────
  const COLOR_MAP = {
    BLACK: 'BL', WHITE: 'WH', GREY: 'GR', GRAY: 'GR', NAVY: 'NV',
    RED: 'RD', BLUE: 'BU', GREEN: 'GN', BROWN: 'BR', BEIGE: 'BE',
    CAMEL: 'CM', CREAM: 'CR', PINK: 'PK', PURPLE: 'PU', ORANGE: 'OR',
    YELLOW: 'YL', KHAKI: 'KH', OLIVE: 'OL', BURGUNDY: 'BG', WINE: 'WN',
    MAROON: 'MR', TAN: 'TN', SAND: 'SD', STONE: 'ST', CHARCOAL: 'CH',
    IVORY: 'IV', ECRU: 'EC', OFF: 'OW', NATURAL: 'NA', RUST: 'RS',
    CORAL: 'CO', MINT: 'MT', TEAL: 'TL', LILAC: 'LL', LAVENDER: 'LV',
    GOLD: 'GD', SILVER: 'SV', MULTICOLOR: 'MC', MULTI: 'MC', PRINT: 'PT',
    STRIPE: 'SP', FLORAL: 'FL', CAMO: 'CA', DENIM: 'DM',
  };
  const rawColor = String(product.color || '').toUpperCase().replace(/[^A-Z\s]/g, ' ').trim();
  let colorCode = 'XX';
  for (const [key, code] of Object.entries(COLOR_MAP)) {
    if (rawColor.includes(key)) { colorCode = code; break; }
  }
  if (colorCode === 'XX' && rawColor.length >= 2) {
    colorCode = rawColor.replace(/\s/g, '').slice(0, 2);
  }

  // ── Sequence number — unique per prefix ───────────────────────────────────────
  const prefix = `${brand}${genderCode}${catCode}${initials}${colorCode}`;
  if (!seqMap[prefix]) seqMap[prefix] = 1;
  let seq = seqMap[prefix];
  let sku = `${prefix}${String(seq).padStart(2, '0')}`;
  while (usedSkus.has(sku)) {
    seq++;
    sku = `${prefix}${String(seq).padStart(2, '0')}`;
  }
  seqMap[prefix] = seq + 1;
  usedSkus.add(sku);
  return sku;
}

// ─── Image Pipeline v2 ───────────────────────────────────────────────────────
// sharp    → resize / convert / optimise (WebP output, max 1400px)
// AdmZip   → unpack XLSX zip, read xl/media + all drawing XMLs across all sheets
// pdfjs    → extract JPEG/PNG XObjects from PDF operator stream
// content hash → deduplication; same pixel data is never uploaded twice
// path     → product-images/{brand_id}/{sku}/{sha256_8}.webp
// ─────────────────────────────────────────────────────────────────────────────
const MAX_IMAGES_PER_IMPORT = 60;  // hard cap per upload batch

// In-process dedup cache: sha256(buffer) → already-uploaded public URL
const _imgUrlCache = new Map();

/**
 * Process any raw image buffer through sharp:
 *   - Convert RGB/RGBA/GRAY/CMYK pixel data (or compressed JPEG/PNG/etc.) to WebP
 *   - Resize so longest edge ≤ 1400 px (preserves aspect, never upscales)
 *   - Strip all EXIF/ICC metadata
 *   - Quality 82 — sharp sweet-spot for product photography
 * Returns { buffer, mimeType } or null on failure.
 */
async function optimiseImage(rawBuffer, { width, height, channels } = {}) {
  try {
    const sharp = require('sharp');
    let pipeline;

    // pdfjs gives us a raw pixel buffer with explicit dimensions + channel count
    if (width && height && channels) {
      const raw = { width, height, channels };
      pipeline = sharp(rawBuffer, { raw }).webp({ quality: 82 });
    } else {
      // Already-compressed image (JPEG / PNG / WebP / BMP / TIFF from XLSX media)
      pipeline = sharp(rawBuffer).webp({ quality: 82 });
    }

    const optimised = await pipeline
      .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
      .withMetadata(false)
      .toBuffer();

    return { buffer: optimised, mimeType: 'image/webp' };
  } catch (err) {
    console.warn('[optimiseImage] sharp failed:', err.message, '— keeping original');
    return { buffer: rawBuffer, mimeType: 'image/jpeg' };
  }
}

/**
 * Upload a processed image buffer to Supabase Storage → product-images bucket.
 *
 * Path: product-images/{brandId}/{safeSku}/{hash8}.webp
 * Deduplication: sha256 of the RAW input buffer — same source image is never
 *   re-uploaded regardless of SKU.  The cached URL is returned instantly.
 * Timeout: 15 s total (optimise + upload); never blocks the import pipeline.
 */
async function uploadProductImage(rawBuffer, { sku = '', brandId = 1, width, height, channels, mimeType: inMime } = {}) {
  if (!rawBuffer || rawBuffer.length === 0) return null;

  // Fast dedup check
  const hash   = crypto.createHash('sha256').update(rawBuffer).digest('hex');
  const hash8  = hash.slice(0, 8);
  if (_imgUrlCache.has(hash)) return _imgUrlCache.get(hash);

  // If Supabase not configured → base64 data URL for staging preview (≤ 400 KB only)
  if (!supabase) {
    if (rawBuffer.length < 400_000) {
      const dataUrl = `data:${inMime || 'image/jpeg'};base64,${rawBuffer.toString('base64')}`;
      _imgUrlCache.set(hash, dataUrl);
      return dataUrl;
    }
    return null;
  }

  const work = (async () => {
    try {
      const { buffer, mimeType } = await optimiseImage(rawBuffer, { width, height, channels });

      const safeSku  = (sku || 'product').replace(/[^a-z0-9\-_]/gi, '_').toLowerCase().slice(0, 60);
      const ext      = mimeType === 'image/webp' ? '.webp' : '.jpg';
      const stoPath  = `${brandId}/${safeSku}/${hash8}${ext}`;

      const { error: upErr } = await supabase.storage
        .from('product-images')
        .upload(stoPath, buffer, { contentType: mimeType, upsert: false });

      if (upErr && upErr.statusCode !== '409') {
        // 409 = already exists (upsert:false duplicate) — still grab the URL
        console.warn('[uploadProductImage] Upload error:', upErr.message);
        if (!upErr.message?.includes('already exists')) return null;
      }

      const { data } = supabase.storage.from('product-images').getPublicUrl(stoPath);
      const url = data?.publicUrl || null;
      if (url) _imgUrlCache.set(hash, url);
      return url;
    } catch (err) {
      console.warn('[uploadProductImage] Unexpected error:', err.message);
      return null;
    }
  })();

  const timeout = new Promise(resolve =>
    setTimeout(() => { console.warn('[uploadProductImage] Timed out'); resolve(null); }, 15_000)
  );

  return Promise.race([work, timeout]);
}

// Keep old name as alias so existing call sites don't break
async function uploadEmbeddedImage(buffer, ext, mimeType, sku, brandId = 1) {
  return uploadProductImage(buffer, { sku, brandId, mimeType });
}

/**
 * Fetch an external image URL and upload it to Supabase Storage.
 * Handles redirects, enforces a 10 s connect + 20 s body timeout.
 * Returns the Supabase public URL, or the original URL as fallback.
 */
async function fetchAndStoreImageUrl(url, { sku = '', brandId = 1 } = {}) {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  // Already a Supabase Storage URL — keep as-is
  if (supabase && url.includes('.supabase.co/storage/')) return url;

  try {
    const https  = require('https');
    const http   = require('http');
    const client = url.startsWith('https') ? https : http;

    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      const req = client.get(url, { timeout: 10_000, headers: { 'User-Agent': 'Linezheets/2.0' } }, res => {
        if (res.statusCode >= 400) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('fetch timeout')); });
      req.on('error', reject);
      setTimeout(() => { req.destroy(); reject(new Error('hard timeout')); }, 20_000);
    });

    if (!buffer || buffer.length < 1000) return url; // too small — probably an error page

    const stored = await uploadProductImage(buffer, { sku, brandId });
    return stored || url; // fallback to original URL if upload fails
  } catch (err) {
    console.warn('[fetchAndStoreImageUrl] Failed for', url.slice(0, 60), '—', err.message);
    return url; // keep original URL rather than losing it
  }
}

/**
 * Extract embedded images from an XLSX file.
 * Handles ALL sheets / ALL drawing files in the workbook.
 * Maps each image to its data row via xdr anchor XML; falls back to sequential.
 *
 * Returns: Array of { dataRowIndex, buffer, ext, mimeType }
 *   dataRowIndex = 0-based index into rawRows (header already subtracted)
 */
async function extractXlsxImages(filePath, headerRowIndex = 0) {
  try {
    const AdmZip = require('adm-zip');
    const zip    = new AdmZip(filePath);
    const entries = zip.getEntries();

    const MIME = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png',  '.webp': 'image/webp',
      '.gif': 'image/gif',  '.bmp': 'image/bmp',
      '.tiff': 'image/tiff', '.emf': null, '.wmf': null,
    };

    // ── 1. Collect all media files across the workbook ────────────────────────
    const mediaFiles = {};  // basename → { buffer, ext, mimeType }
    entries.forEach(e => {
      const m = e.entryName.match(/^xl\/media\/(.+)$/i);
      if (!m) return;
      const ext  = path.extname(m[1]).toLowerCase();
      const mime = MIME[ext];
      if (!mime) return;  // vector / unsupported
      mediaFiles[m[1]] = { buffer: e.getData(), ext, mimeType: mime };
    });

    if (!Object.keys(mediaFiles).length) return [];

    // ── 2. Parse ALL drawing rels files (one per sheet that has images) ───────
    // Key: drawing filename (e.g. "drawing1") → { rId → mediaBasename }
    const drawingRels = {};  // drawingKey → Map<rId, mediaBasename>
    entries.forEach(e => {
      const m = e.entryName.match(/xl\/drawings\/_rels\/(drawing\d+)\.xml\.rels$/i);
      if (!m) return;
      const key = m[1];
      drawingRels[key] = drawingRels[key] || new Map();
      const xml = e.getData().toString('utf8');
      for (const match of xml.matchAll(/Id="(rId\d+)"[^>]+Target="\.\.\/media\/([^"]+)"/g)) {
        drawingRels[key].set(match[1], match[2]);
      }
    });

    // ── 3. Parse ALL drawing XMLs (xdr anchors) ───────────────────────────────
    const rowImages = [];  // { dataRowIndex, mediaBasename }
    let anyAnchorFound = false;

    entries.forEach(e => {
      const m = e.entryName.match(/xl\/drawings\/(drawing\d+)\.xml$/i);
      if (!m) return;
      const key  = m[1];
      const rels = drawingRels[key] || new Map();
      const xml  = e.getData().toString('utf8');

      // Match both twoCellAnchor and oneCellAnchor
      const anchors = [...xml.matchAll(/<xdr:(?:two|one)CellAnchor[\s\S]*?<\/xdr:(?:two|one)CellAnchor>/g)];
      anchors.forEach(a => {
        const rowM = a[0].match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
        const rIdM = a[0].match(/r:embed="(rId\d+)"/);
        if (!rowM || !rIdM) return;
        const excelRow   = parseInt(rowM[1]);           // 0-based inside drawing XML
        const dataRowIdx = excelRow - headerRowIndex - 1;
        const media      = rels.get(rIdM[1]);
        if (media && dataRowIdx >= 0) {
          anyAnchorFound = true;
          rowImages.push({ dataRowIndex: dataRowIdx, mediaBasename: media });
        }
      });
    });

    // ── 4. Resolve to buffers ─────────────────────────────────────────────────
    if (anyAnchorFound && rowImages.length) {
      return rowImages
        .map(ri => {
          const media = mediaFiles[ri.mediaBasename];
          if (!media) return null;
          return { dataRowIndex: ri.dataRowIndex, ...media };
        })
        .filter(Boolean)
        .sort((a, b) => a.dataRowIndex - b.dataRowIndex);
    }

    // ── 5. Fallback: sequential assignment ────────────────────────────────────
    console.log('[extractXlsxImages] No drawing anchors — using sequential assignment');
    return Object.values(mediaFiles).map((media, i) => ({ dataRowIndex: i, ...media }));

  } catch (err) {
    console.warn('[extractXlsxImages] Failed:', err.message);
    return [];
  }
}

/**
 * Extract embedded images from a PDF using pdfjs-dist operator list.
 * Handles JPEG XObjects (already compressed) and raw image XObjects
 * (RGBA_32BPP / RGB_24BPP / GRAYSCALE_1BPP) — correct channel count
 * is detected from img.kind so sharp gets the right raw descriptor.
 *
 * Returns: Array of { pageIndex, buffer, ext, mimeType, width, height, channels, isRaw }
 */
async function extractPdfImages(filePath) {
  const OUTER_MS     = 45_000;
  const PER_IMG_MS   = 4_000;
  const MIN_SIDE     = 80;   // ignore tiny icons / bullets
  const MAX_IMAGES   = 40;

  const work = (async () => {
    try {
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc = false;

      const data   = new Uint8Array(require('fs').readFileSync(filePath));
      const pdfDoc = await pdfjsLib.getDocument({
        data, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true,
      }).promise;

      const images   = [];
      const maxPages = Math.min(pdfDoc.numPages, 30);
      const seen     = new Set();  // deduplicate by imgName within file

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        if (images.length >= MAX_IMAGES) break;
        try {
          const page = await pdfDoc.getPage(pageNum);
          const ops  = await page.getOperatorList();
          const { fnArray, argsArray } = ops;

          for (let i = 0; i < fnArray.length; i++) {
            if (images.length >= MAX_IMAGES) break;
            const op = fnArray[i];
            if (op !== pdfjsLib.OPS.paintJpegXObject && op !== pdfjsLib.OPS.paintImageXObject) continue;

            const imgName = argsArray[i][0];
            if (seen.has(`${pageNum}:${imgName}`)) continue;
            seen.add(`${pageNum}:${imgName}`);

            const imgResult = await Promise.race([
              new Promise(resolve => {
                try {
                  page.objs.get(imgName, img => {
                    if (!img || !img.data) { resolve(null); return; }
                    const w = img.width || 0, h = img.height || 0;
                    if (w < MIN_SIDE || h < MIN_SIDE) { resolve(null); return; }

                    // pdfjs ImageKind: 1 = GRAYSCALE_1BPP, 2 = RGB_24BPP, 3 = RGBA_32BPP
                    const kind     = img.kind || 3;
                    const channels = kind === 1 ? 1 : kind === 2 ? 3 : 4;
                    resolve({ buffer: Buffer.from(img.data), width: w, height: h, channels, kind });
                  });
                } catch (_) { resolve(null); }
              }),
              new Promise(resolve => setTimeout(() => resolve(null), PER_IMG_MS)),
            ]);

            if (imgResult) {
              images.push({
                pageIndex: pageNum - 1,
                buffer   : imgResult.buffer,
                width    : imgResult.width,
                height   : imgResult.height,
                channels : imgResult.channels,
                ext      : '.webp',
                mimeType : 'image/webp',
                isRaw    : true,
              });
            }
          }
        } catch (pageErr) {
          console.warn(`[extractPdfImages] page ${pageNum}:`, pageErr.message);
        }
      }

      console.log(`[extractPdfImages] ${images.length} image(s) across ${maxPages} page(s)`);
      return images;
    } catch (err) {
      console.warn('[extractPdfImages] Failed:', err.message);
      return [];
    }
  })();

  const timeout = new Promise(resolve =>
    setTimeout(() => { console.warn('[extractPdfImages] Outer timeout'); resolve([]); }, OUTER_MS)
  );

  return Promise.race([work, timeout]);
}

/**
 * Parse a structured table PDF (order sheets, linesheets) using pdfjs-dist
 * positional text extraction. Reconstructs table columns by x-coordinate
 * clustering, then groups size sub-rows back into product records.
 *
 * Returns the same product-array shape as parsePdfText().
 */
async function parsePdfTextPositional(filePath, filename) {
  // Row clustering: items within this many Y-points are treated as the same row.
  // 10pt handles small vertical misalignment within the same visual table row.
  const ROW_Y_TOLERANCE = 10;
  const seasonHint = (filename.match(/\b(SS|FW|AW|PF|RE|RS)\s*(\d{2,4})\b/i) || [])[0] || '';

  // ── Map column header text → internal field name ──────────────────────────
  // Returns null for columns to skip (images, financial totals, order-form fields).
  // Returns 'skip' for columns that are present but should default to skip in the UI.
  function headerToField(h) {
    const s = h.toLowerCase().replace(/\s*\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    // SKU / item code variants (EN + FR référence + IT codice + DE artikelnummer + ES referencia/codigo)
    if (/item\s*code|style\s*code|vendor\s*code|ref\s*(no|code|num)?|^sku$|^article$|^style\s*no$|^product\s*code$|^ref$|^code$|^r[eé]f[eé]rence$|codice\s*(articolo|prodotto)?|artikelnummer|referencia|^codigo$/.test(s)) return 'sku';
    // Product name (EN + FR désignation/libellé + IT denominazione/nome articolo + DE bezeichnung + ES nombre)
    if (/product\s*name|product\s*title|style\s*name|item\s*name|item\s*description|designation|d[eé]signation|libell[eé]|denominazione|nome\s*articolo|bezeichnung|artikelbezeichnung|nombre\s*(articulo|producto)?/.test(s)) return 'description';
    if (/^name$|^description$|^title$/.test(s)) return 'description';
    // Detail / notes (alternate label brands use — matched before color/delivery to avoid false positives)
    if (/^detail$|^details$|product\s*detail|item\s*detail|description\s*2|^notes?$|^desc$|^remarks?$|^commentaires?$|^nota$|^anmerkung$/.test(s)) return 'product_notes';
    // Composition / material (separate match so "COMPOSITION" column → material, not product_notes)
    if (/^composition$|^material$|^fabric$|^content$|^fiber$|^fibre$|^textile$|^yarn$|^blend$|mati[eè]re|tissu|tessuto|materiale|gewebe|tejido|care\s*instructions?|shell|lining|fill/.test(s)) return 'material';
    // Color (EN + FR couleur/coloris + IT colore + DE farbe + ES color)
    if (/colou?r(way)?|shade|colorway|couleur|coloris|colore|^farbe$|farbvariante/.test(s)) return 'color';
    // Size
    if (/^size$|^sz$|^sizes$|^taille$|^taglie$|^gr[öo][ß s]e$/.test(s)) return 'size_label';
    // Quantity (order qty, confirm, etc.) — only INPUT qty fields, not totals
    if (/^qty$|^quantity$|^confirm$|^order\s*qty$|^qte$|^qt[eé]$/.test(s)) return 'qty';
    // Retail / SRP (EN + FR prix public/conseillé + IT prezzo consigliato + DE UVP/EMP + ES PVP)
    if (/retail\s*price|consumer\s*price|^retail$|^srp$|^rrp$|^msrp$|^pvp$|prix\s*(public|conseil(l[eé])?)|prezzo\s*consigliato|^uvp$|^emp$|precio\s*(sugerido|pvp)/.test(s)) return 'srp';
    // Wholesale / WSP (EN + FR prix grossiste + IT prezzo ingrosso + DE händlerpreis + ES precio mayorista)
    if (/wholesale|^wsp$|trade\s*price|dealer\s*price|prix\s*(grossiste|d[''e]\s*gros|achat)|prezzo\s*ingrosso|gro[ß s]handelspreis|h[aä]ndlerpreis|einkaufspreis|precio\s*(mayorista|neto)|joor\s*price|faire\s*price/.test(s)) return 'wsp_usd';
    // Category (EN + FR catégorie + IT categoria + DE warengruppe + ES categoría)
    if (/^category$|^cat$|^dept$|^type$|^division$|^class$|cat[eé]gorie|categoria|warengruppe|categor[ií]a/.test(s)) return 'category';
    // Delivery / ship date (EN + FR livraison + IT consegna + DE liefertermin + ES entrega)
    if (/delivery|ship\s*(date|window)?|dispatch|ex\s*works|ex\s*factory|start\s*ship|cancel\s*date|livraison|date\s*livraison|consegna|data\s*consegna|lieferdatum|liefertermin|fecha\s*entrega|entrega/.test(s)) return 'delivery_window';
    // Season / collection (EN + FR saison + IT stagione + DE kollektion + ES temporada) — no delivery aliases
    if (/^season$|^collection$|^drop$|^line$|^programme?$|^capsule$|^saison$|^stagione$|^kollektion$|^temporada$|season\s*code|collection\s*name/.test(s)) return 'season';
    // Gender
    if (/^gender$|^sex$|^target$|^genre$|^genero$/.test(s)) return 'gender';
    // MOQ (EN + FR quantité minimum + IT quantità minima + DE mindestbestellmenge + ES cantidad mínima)
    if (/^moq$|minimum\s*order|min\s*qty|quantit[eé]\s*min|quantit[aà]\s*minima|mindestbestellmenge|cantidad\s*m[ií]nima/.test(s)) return 'moq';
    // Cost / COGS
    if (/^cost$|^cogs$|landed\s*cost|co[uû]t|costo|kosten|herstellungskosten/.test(s)) return 'cost';
    // Skip — image placeholders
    if (/image|photo|pic|thumbnail/.test(s)) return null;
    // Skip — order-form specific totals/deposits that don't map to product fields
    if (/deposit|total\s*wholesale|total\s*qty|total\s*amount|total\s*cost|grand\s*total/.test(s)) return null;
    return null;
  }

  try {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = false;
    const data   = new Uint8Array(fs.readFileSync(filePath));
    const pdfDoc = await pdfjsLib.getDocument({
      data, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true,
    }).promise;

    // ── Collect all text items with (x, y, text) across all pages ────────────
    const allItems = [];
    const maxPages = Math.min(pdfDoc.numPages, 30);
    let pageHeightBase = 0;

    for (let pn = 1; pn <= maxPages; pn++) {
      const page     = await pdfDoc.getPage(pn);
      const viewport = page.getViewport({ scale: 1 });
      const tc       = await page.getTextContent();
      for (const item of tc.items) {
        const text = (item.str || '').trim();
        if (!text) continue;
        const x = item.transform[4];
        const y = pageHeightBase + (viewport.height - item.transform[5]); // flip to top-down
        allItems.push({ x, y, text });
      }
      pageHeightBase += viewport.height + 20;
    }

    if (!allItems.length) return [];

    // ── Cluster items into rows by Y proximity ───────────────────────────────
    allItems.sort((a, b) => a.y - b.y || a.x - b.x);
    const rows = [];
    let rBuf = null;
    for (const item of allItems) {
      if (!rBuf || Math.abs(item.y - rBuf.y) > ROW_Y_TOLERANCE) {
        if (rBuf) rows.push(rBuf);
        rBuf = { y: item.y, cells: [] };
      }
      rBuf.cells.push({ x: item.x, text: item.text });
    }
    if (rBuf) rows.push(rBuf);
    rows.forEach(r => r.cells.sort((a, b) => a.x - b.x));

    // ── Find the header row ───────────────────────────────────────────────────
    // Require ≥3 cells whose text maps to a known field (non-null headerToField).
    // Prefer the row with the MOST matches to avoid partial header rows.
    let headerRowIdx = -1;
    let bestHitCount = 0;

    for (let ri = 0; ri < rows.length && ri < 80; ri++) {
      const row  = rows[ri];
      const hits = row.cells.filter(c => headerToField(c.text) !== null && headerToField(c.text) !== undefined);
      if (hits.length > bestHitCount && hits.length >= 3) {
        bestHitCount  = hits.length;
        headerRowIdx  = ri;
      }
      // Early exit if we find an excellent match (5+ fields) and the next rows don't improve
      if (bestHitCount >= 5 && ri > headerRowIdx + 5) break;
    }

    if (headerRowIdx === -1) {
      console.warn('[parsePdfTextPositional] No header row found');
      return [];
    }

    // ── Build column definitions from header row ───────────────────────────────
    // Each column owns an x-range (midpoint to next midpoint) so data cells that
    // don't align exactly with the header still fall into the right bucket.
    let colDefs = rows[headerRowIdx].cells
      .map(c => ({ x: c.x, field: headerToField(c.text) }))
      .filter(c => c.field);

    // Deduplicate: keep only the first (leftmost) occurrence of each field
    {
      const seen = new Set();
      colDefs = colDefs.filter(cd => seen.has(cd.field) ? false : (seen.add(cd.field), true));
    }

    colDefs.sort((a, b) => a.x - b.x);

    // Assign each colDef an [xMin, xMax] range based on midpoints
    for (let i = 0; i < colDefs.length; i++) {
      const prev = colDefs[i - 1];
      const next = colDefs[i + 1];
      colDefs[i].xMin = prev ? (prev.x + colDefs[i].x) / 2 : -Infinity;
      colDefs[i].xMax = next ? (colDefs[i].x + next.x) / 2 :  Infinity;
    }

    console.log(`[parsePdfTextPositional] Header at row ${headerRowIdx}, cols: ${colDefs.map(c=>`${c.field}@${Math.round(c.x)}`).join(', ')}`);

    // ── Snap a data-cell x-coordinate to a column ────────────────────────────
    function snapToCol(x) {
      // Primary: range containment (most reliable)
      for (const cd of colDefs) {
        if (x >= cd.xMin && x < cd.xMax) return cd;
      }
      // Fallback: nearest column within 60pt (handles rounding at edges)
      let best = null, bestD = Infinity;
      for (const cd of colDefs) {
        const d = Math.abs(x - cd.x);
        if (d < bestD) { bestD = d; best = cd; }
      }
      return bestD <= 60 ? best : null;
    }

    // ── Currency-only tokens to skip when building cell values ───────────────
    const CURRENCY_ONLY = /^(CHF|USD|EUR|GBP|AUD|CAD|HKD|JPY|\$|€|£|¥)$/i;

    // ── Walk data rows and build products ────────────────────────────────────
    const products = [];
    let cur = null;
    const SIZE_TOKEN = /^(XXS|XS|S|M|L|XL|XXL|XXXL|\d{1,2}XL|\d{1,3}|OS|ONE\s*SIZE|FREE\s*SIZE|O\/S)$/i;
    const SKU_PATTERN = /^[A-Z0-9][A-Z0-9\-_./]{2,24}$/; // alphanumeric 3-25 chars

    function parsePrice(raw) {
      if (!raw) return 0;
      const cleaned = String(raw).replace(/[^0-9.,]/g, '').replace(/,(?=\d{3})/g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    }

    function flush() {
      if (!cur) return;
      cur.stock_total = Object.values(cur.sizes || {}).reduce((s, v) => s + v, 0);
      if (cur.srp && cur.wsp_usd) cur.margin = +(1 - cur.wsp_usd / cur.srp).toFixed(2);
      if (!cur.season)       cur.season       = seasonHint;
      if (!cur.moq)          cur.moq          = 1;
      if (!cur.image_urls)   cur.image_urls   = [];
      if (!cur.tier_pricing) cur.tier_pricing = [];
      if (!cur.brand_name)   cur.brand_name   = 'Brand Name';
      if (!cur.brand_id)     cur.brand_id     = 1;
      if (!cur.gender)       cur.gender       = 'UNISEX';
      if (!cur.product_notes) cur.product_notes = generateRichDescription(cur.description || '', cur.category || '', cur.color || '', cur.season || '');
      products.push(cur);
      cur = null;
    }

    for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
      const row = rows[ri];

      // Build cell map for this row
      const cm = {};
      row.cells.forEach(c => {
        // Skip standalone currency symbols — they appear as a separate text run before the number
        if (CURRENCY_ONLY.test(c.text)) return;
        const col = snapToCol(c.x);
        if (!col) return;
        // Accumulate (space-separated) in case multiple text runs map to same column
        cm[col.field] = cm[col.field] ? cm[col.field] + ' ' + c.text : c.text;
      });

      // Skip fully blank rows
      const vals = Object.values(cm).filter(Boolean);
      if (!vals.length) continue;

      // Detect size-only sub-rows: only size_label (and maybe qty) filled, no sku/description
      const hasSizeLabel = cm.size_label && SIZE_TOKEN.test(cm.size_label.trim());
      const isSizeRow    = hasSizeLabel && !cm.sku && !cm.description && !cm.srp && !cm.wsp_usd;

      // Detect a new-product row: must have a SKU-like code or a product description
      // but NOT rows that are just numeric totals or category headings
      const hasValidSku  = cm.sku && SKU_PATTERN.test(cm.sku.trim());
      const hasDesc      = cm.description && cm.description.trim().length > 2;
      const looksLikeProduct = hasValidSku || (hasDesc && !isSizeRow);

      if (looksLikeProduct) {
        flush();
        const rawWsp = parsePrice(cm.wsp_usd);
        const rawSrp = parsePrice(cm.srp);
        cur = {
          description    : (cm.description || cm.sku || '').trim(),
          sku            : (cm.sku || '').trim(),
          category       : normalizeCategory(cm.category || '', cm.description || ''),
          color          : (cm.color || '').trim(),
          gender         : cm.gender || 'UNISEX',
          season         : cm.season || seasonHint,
          wsp_usd        : rawWsp,
          srp            : rawSrp,
          sizes          : {},
          stock_total    : 0,
          moq            : parseInt(cm.moq) || 1,
          material       : (cm.material || '').trim(),
          delivery_window: (cm.delivery_window || '').trim(),
          product_notes  : (cm.product_notes || '').trim(),
          image_urls     : [],
          brand_name     : 'Brand Name',
          brand_id       : 1,
          margin         : rawSrp > 0 && rawWsp > 0 ? +(1 - rawWsp / rawSrp).toFixed(2) : 0.5,
          tier_pricing   : [],
        };
        // If first size also appears inline on the product row
        if (hasSizeLabel) {
          cur.sizes[cm.size_label.trim().toUpperCase()] = parseInt(cm.qty || 0) || 0;
        }
      } else if (isSizeRow && cur) {
        const sizeKey = cm.size_label.trim().toUpperCase();
        cur.sizes[sizeKey] = parseInt(cm.qty || 0) || 0;
        // Prices can appear on individual size rows in some PDFs
        if (!cur.wsp_usd && cm.wsp_usd) cur.wsp_usd = parsePrice(cm.wsp_usd);
        if (!cur.srp     && cm.srp    ) cur.srp      = parsePrice(cm.srp);
      } else if (cur && !isSizeRow) {
        // Extra detail/notes row for the current product
        if (cm.product_notes && !cur.product_notes) cur.product_notes = cm.product_notes.trim();
        if (cm.material      && !cur.material)      cur.material      = cm.material.trim();
        if (cm.delivery_window && !cur.delivery_window) cur.delivery_window = cm.delivery_window.trim();
        if (cm.color && !cur.color) cur.color = cm.color.trim();
        // Prices on info rows
        if (!cur.wsp_usd && cm.wsp_usd) cur.wsp_usd = parsePrice(cm.wsp_usd);
        if (!cur.srp     && cm.srp    ) cur.srp      = parsePrice(cm.srp);
      }
    }
    flush();

    // Build detected column manifest for the UI
    const detectedColumns = colDefs.map(cd => ({
      header: rows[headerRowIdx].cells.find(c => Math.abs(c.x - cd.x) < 5)?.text || cd.field,
      field : cd.field,
    }));

    console.log(`[parsePdfTextPositional] Extracted ${products.length} products from ${maxPages} page(s)`);
    return { products, detectedColumns };
  } catch (err) {
    console.warn('[parsePdfTextPositional] Failed:', err.message);
    return { products: [], detectedColumns: [] };
  }
}

function pngChunk(type, data) {
  const len  = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typB = Buffer.from(type, 'ascii');
  const crcB = Buffer.alloc(4);
  // CRC of type + data
  let crc = 0xFFFFFFFF;
  const crcBuf = Buffer.concat([typB, data]);
  for (let i = 0; i < crcBuf.length; i++) {
    crc ^= crcBuf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  crc ^= 0xFFFFFFFF;
  crcB.writeUInt32BE(crc >>> 0);
  return Buffer.concat([len, typB, data, crcB]);
}

/** Parse PDF linesheet text (extracted by pdf-parse) into product rows */
function parsePdfText(text, filename) {
  const products = [];
  const lines    = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Season hint from filename: "SS26", "FW26", "AW27" etc.
  const seasonHint = (filename.match(/\b(SS|FW|AW|SS|PF|RE|RS|FW|SS|AW)\s*(\d{2,4})\b/i) || [])[0] || '';

  // Pattern recognition helpers
  const isPriceLine  = l => /\d+\.\d{2}\s*(USD|EUR|GBP)?[\/|]\d/.test(l);

  // isSizeLine — catches pure size expressions that should NEVER be product titles
  const isSizeLine   = l => {
    const u = l.toUpperCase().trim();
    // Explicit letter size range patterns (including 4XL-8XL)
    if (/^(XXS|XS|S|M|L|XL|XXL|XXXL|[4-8]XL)\s*[-–]\s*(XXS|XS|S|M|L|XL|XXL|XXXL|[4-8]XL)$/.test(u)) return true;
    // Single 4XL-8XL tokens
    if (/^[4-8]XL$/.test(u)) return true;
    // T-size range (2T-5T etc.)
    if (/^(\d)T\s*[-–]\s*(\d)T$/i.test(u)) return true;
    // Plus size range (1X-3X etc.)
    if (/^(\d)X\s*[-–]\s*(\d)X$/i.test(u)) return true;
    // Newborn
    if (/^NB$/i.test(u)) return true;
    // Baby month range
    if (/^\d{1,2}-\d{1,2}M$/i.test(u)) return true;
    // One-size variants
    if (/^(ONE.?SIZE|OS|FREE.?SIZE|O\/S|ONESIZE|UNIVERSAL)$/.test(u)) return true;
    // Numeric range (shoe/EU/height sizes)
    if (/^\d{1,3}\s*[-–]\s*\d{1,3}$/.test(u)) return true;
    // Comma/slash lists made entirely of size tokens (≥2 tokens, all valid sizes)
    const tokens = u.split(/[\/,\s]+/).map(t => t.trim()).filter(Boolean);
    if (tokens.length >= 2) {
      const validSize = t =>
        /^(XXS|XS|S|M|L|XL|XXL|XXXL|[4-8]XL)$/.test(t) ||
        /^\d{1,3}$/.test(t) ||
        /^\d[TX]$/i.test(t) ||
        /^NB$/i.test(t) ||
        /^\d{1,2}-\d{1,2}M$/i.test(t);
      if (tokens.every(validSize)) return true;
    }
    return false;
  };

  const isStyleCode  = l => l === l.toUpperCase() && l.length > 2 && !/^\d/.test(l) && !isPriceLine(l);

  // Brand / page markers — include common brand names and single-word all-caps that aren't products
  const KNOWN_BRAND_MARKERS = new Set(['VERYRARE','VR','LINEZHEETS','BRANDBOOM','FAIRE','JOOR']);
  const isPageMarker = l => {
    const u = l.toUpperCase().trim();
    if (KNOWN_BRAND_MARKERS.has(u)) return true;
    if (/linesheet|page\s*\d/i.test(l))  return true;
    if (/^\d+$/.test(l))                 return true;  // bare page numbers
    // Single all-caps word that looks like a brand watermark (no hyphens, no spaces, ≤12 chars)
    if (/^[A-Z]{3,12}$/.test(u))         return true;
    return false;
  };
  const isCollection = l => /^(SS|FW|AW|PF|RE|RS)\s*\d{2,4}\s+(Collection|SS|FW|AW)?$/i.test(l);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip markers, collection headers, and bare size strings
    if (isPageMarker(line) || isCollection(line)) { i++; continue; }
    // A line that IS a size expression can never be a product title — skip it
    if (isSizeLine(line)) { i++; continue; }

    // Look ahead for a price line within the next 4 lines
    const lookahead = lines.slice(i + 1, i + 5);
    const priceIdx  = lookahead.findIndex(isPriceLine);
    if (priceIdx === -1) { i++; continue; }

    // Title is current line (mixed case preferred; fallback to first ALL-CAPS line)
    let displayName = line;
    let styleName   = '';
    let priceStr    = lookahead[priceIdx];
    let sizeStr     = lookahead[priceIdx + 1] || '';

    // The line immediately before the price line may be the style code
    if (priceIdx > 0 && isStyleCode(lookahead[priceIdx - 1])) {
      styleName = lookahead[priceIdx - 1];
    } else if (isStyleCode(line)) {
      styleName = line;
      // Try the line before as the display name
      if (i > 0 && !isPageMarker(lines[i - 1]) && !isCollection(lines[i - 1]) && !isPriceLine(lines[i - 1])) {
        displayName = lines[i - 1];
      }
    }

    const titleClean = (displayName || styleName).replace(/\(crochet[''`]?d?\)?.*|[⬚⬛]/gi, '').trim();
    if (!titleClean) { i++; continue; }

    const priceData = parsePriceCell(priceStr);
    const sizes     = parseSizeRange(isSizeLine(sizeStr) ? sizeStr : '') || {};
    const catHint   = /hoodie|hoody|sweat|fleece/i.test(titleClean) ? 'KNITWEAR'
                    : /pant|short|trouser|cargo|ripstop/i.test(titleClean) ? 'BOTTOMS'
                    : /shirt|polo/i.test(titleClean) ? 'TOPS'
                    : /tee|[tT]\]|[tT]ee/.test(titleClean) ? 'TOPS'
                    : 'TOPS'; // most PDF linesheets are apparel-heavy

    const prod = {
      description  : titleClean,
      sku          : styleName || extractSkuFromText(titleClean) || extractSkuFromText(displayName) || '',
      category     : normalizeCategory('', titleClean),
      color        : '',
      gender       : 'UNISEX',
      season       : seasonHint,
      wsp_usd      : priceData ? priceData.wsp_usd : 0,
      srp   : priceData ? priceData.srp : 0,
      sizes,
      stock_total  : Object.values(sizes).reduce((a, b) => a + b, 0),
      moq          : 1,
      image_urls   : [],
      tags         : [titleClean.toLowerCase().split(/\s+/)[0]],
      brand_name   : 'Brand Name',
      brand_id     : 1,
      margin       : 0.5,
      tier_pricing : [],
      product_notes: generateRichDescription(titleClean, catHint, '', seasonHint),
    };

    // If sizes are placeholders (all 0), count as the number of distinct sizes
    if (!prod.stock_total && Object.keys(prod.sizes).length) prod.stock_total = Object.keys(prod.sizes).length;

    products.push(prod);
    i += priceIdx + 2; // skip past the price + size lines
  }

  // ── Fallback: table-based parser if price-line approach found nothing ──────
  // Handles structured order sheets where prices appear as standalone columns
  // (not merged with quantity like "250.00/3")
  if (!products.length) {
    const PRICE_RE  = /^\$?\s*(\d{1,6}(?:[.,]\d{2,3})?)\s*(?:USD|EUR|GBP|CHF|AUD|CAD|HKD)?$/i;
    const SKU_RE    = /^[A-Z0-9][A-Z0-9\-_/\.]{2,20}$/;
    // Find a header row — a line containing ≥3 known field keywords
    const FIELD_KW  = /\b(sku|ref|code|style|name|description|colour|color|wsp|wholesale|price|srp|retail|moq|gender|season|size|category|material)\b/i;
    let headerIdx   = -1;
    let headerLine  = '';
    for (let li = 0; li < lines.length; li++) {
      const matches = (lines[li].match(/\b\w+\b/g) || []).filter(w => FIELD_KW.test(w));
      if (matches.length >= 2) { headerIdx = li; headerLine = lines[li]; break; }
    }

    // Even without a header, scan lines for price-bearing product blocks:
    // A product block = a non-numeric name line followed within 6 lines by a price
    const STANDALONE_PRICE = /\$?\s*\d{1,6}[.,]\d{2}/;
    for (let li = (headerIdx >= 0 ? headerIdx + 1 : 0); li < lines.length; li++) {
      const line = lines[li];
      if (isPageMarker(line) || isSizeLine(line) || PRICE_RE.test(line.trim())) continue;
      // Skip pure-number or very short lines
      if (/^\d+$/.test(line.trim()) || line.trim().length < 3) continue;

      // Look ahead for a price within next 8 lines
      const window = lines.slice(li + 1, li + 9);
      const priceLineIdx = window.findIndex(l => STANDALONE_PRICE.test(l));
      if (priceLineIdx === -1) continue;
      const priceStr = window[priceLineIdx];

      // Extract price numbers from the price line
      const nums = (priceStr.match(/\d+[.,]\d{2}/g) || []).map(n => parseFloat(n.replace(',', '.')));
      if (!nums.length) continue;
      const wsp = nums[0];
      const srp = nums[1] || +(wsp * 2).toFixed(2);

      // Find SKU — look in window before price for something that looks like a code
      let sku = '';
      for (const wl of window.slice(0, priceLineIdx)) {
        if (SKU_RE.test(wl.trim())) { sku = wl.trim(); break; }
      }

      // Find color — look for 1-2 word non-numeric lines in window
      let color = '';
      for (const wl of window.slice(0, priceLineIdx)) {
        const wlt = wl.trim();
        if (wlt && !SKU_RE.test(wlt) && !/\d/.test(wlt) && wlt.length <= 30) {
          color = wlt; break;
        }
      }

      const titleClean = line.replace(/[⬚⬛]/g, '').trim();
      products.push({
        description  : titleClean,
        sku          : sku || extractSkuFromText(titleClean) || '',
        category     : normalizeCategory('', titleClean),
        color,
        gender       : 'UNISEX',
        season       : seasonHint,
        wsp_usd      : wsp,
        srp,
        sizes        : {},
        stock_total  : 0,
        moq          : 1,
        image_urls   : [],
        brand_name   : 'Brand Name',
        brand_id     : 1,
        margin       : +(1 - wsp / srp).toFixed(2),
        tier_pricing : [],
        product_notes: generateRichDescription(titleClean, normalizeCategory('', titleClean), color, seasonHint),
      });
      li += priceLineIdx + 1; // skip to after price line
    }
  }

  return products;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({
    status   : 'ok',
    version  : '3.0',
    supabase : !!supabase,
    timestamp: new Date().toISOString(),
  })
);

// ─── Marketplace — Products (paginated + filtered) ────────────────────────────
app.get('/api/marketplace/products', async (req, res) => {
  try {
    const {
      limit     = 24,
      offset    = 0,
      sort      = 'newest',
      category  = '',
      search    = '',
      season    = '',
      min_price = '',
      max_price = '',
    } = req.query;

    let results = await dbGetInventory({ category, season, search, sort });

    // Price range filter (post-query in JS)
    if (min_price) results = results.filter(p => parseFloat(p.srp_usd) >= parseFloat(min_price));
    if (max_price) results = results.filter(p => parseFloat(p.srp_usd) <= parseFloat(max_price));

    const total    = results.length;
    const pageData = results
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      .map(formatProduct);

    console.log(`📦 Products: ${total} total, returning ${pageData.length} (offset ${offset})`);
    res.json({ products: pageData, total, offset: parseInt(offset), limit: parseInt(limit) });
  } catch (err) {
    console.error('❌ /api/marketplace/products:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Marketplace — Trending ────────────────────────────────────────────────────
app.get('/api/marketplace/trending', async (req, res) => {
  try {
    const data = await dbGetInventory({ sort: 'newest' });
    res.json({ trending: data.map(formatProduct), total: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Marketplace — Featured ───────────────────────────────────────────────────
app.get('/api/marketplace/featured', async (req, res) => {
  try {
    const data = await dbGetInventory({ sort: 'newest' });
    res.json({ featured: data.slice(0, 3).map(formatProduct) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Marketplace — Categories ─────────────────────────────────────────────────
app.get('/api/marketplace/categories', async (req, res) => {
  try {
    const data = await dbGetInventory();
    const cats = [...new Set(data.map(p => p.category).filter(Boolean))].map(c => ({
      category     : c,
      product_count: data.filter(p => p.category === c).length,
    }));
    res.json({ categories: cats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Marketplace — Seasons ────────────────────────────────────────────────────
app.get('/api/marketplace/seasons', async (req, res) => {
  try {
    const data    = await dbGetInventory();
    const seasons = [...new Set(data.map(p => p.season).filter(Boolean))];
    res.json({ seasons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Marketplace — Single product ─────────────────────────────────────────────
app.get('/api/marketplace/product/:id', async (req, res) => {
  try {
    const p = await dbGetProduct(req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json(formatProduct(p));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Marketplace — Search ─────────────────────────────────────────────────────
app.get('/api/marketplace/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const results = await dbGetInventory({ search: q });
    console.log(`🔍 Search "${q}" → ${results.length} result(s)`);
    res.json({ results: results.map(formatProduct), total: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Marketplace — Inventory list (brand-dashboard.html) ──────────────────────
app.get('/api/inventory', async (req, res) => {
  try {
    const data = await dbGetInventory({ sort: 'newest' });
    res.json({ inventory: data.map(formatProduct), total: data.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Marketplace — Brands ─────────────────────────────────────────────────────
app.get('/api/marketplace/brands', (req, res) => {
  res.json({
    brands: [
      { id:1, brand_name:'Brand Name',   logo_url:null, category:'Womenswear',  country:'France', supportedTerms:['50/50 Deposit','Net 30','Consignment'],  minOrderValue:2500 },
      { id:2, brand_name:'House Noir',   logo_url:null, category:'Menswear',    country:'Italy',  supportedTerms:['Net 30','Net 60'],                       minOrderValue:1500 },
      { id:3, brand_name:'Voss & Co.',   logo_url:null, category:'Accessories', country:'USA',    supportedTerms:['50/50 Deposit','Net 30'],                 minOrderValue:1000 },
      { id:4, brand_name:'Atelier Luxx', logo_url:null, category:'Luxury',      country:'France', supportedTerms:['Full Prepayment','Consignment'],          minOrderValue:5000 },
    ],
  });
});

// ── Global Showroom Map ───────────────────────────────────────────────────────
app.get('/api/maps/active-showrooms', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('showroom_city, latitude, longitude, event_tag, stock_total')
      .eq('status', 'active')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) return res.status(500).json({ error: error.message });

    // Group by showroom_city — sum stock, keep first lat/lng and collect unique event tags
    const grouped = {};
    (data || []).forEach(row => {
      const city = row.showroom_city || 'Unknown';
      if (!grouped[city]) {
        grouped[city] = {
          city,
          latitude   : parseFloat(row.latitude),
          longitude  : parseFloat(row.longitude),
          stock_total: 0,
          event_tags : new Set(),
          sku_count  : 0,
        };
      }
      grouped[city].stock_total += (parseInt(row.stock_total) || 0);
      grouped[city].sku_count  += 1;
      if (row.event_tag) grouped[city].event_tags.add(row.event_tag);
    });

    const showrooms = Object.values(grouped).map(s => ({
      city       : s.city,
      latitude   : s.latitude,
      longitude  : s.longitude,
      stock_total: s.stock_total,
      sku_count  : s.sku_count,
      event_tags : [...s.event_tags],
    }));

    res.json({ showrooms });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  BUYER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// (buyer profile route now handled above by the full async version)

// ── Cart / Saved / Offers — session_store (temp table) ───────────────────────
// All three use session_store during migration. Cart and saved are one JSON
// blob per user; each offer is its own row.

async function ssGetBlob(sessionId, type) {
  if (!supabase) return null;
  const { data } = await supabase.from('session_store').select('data')
    .eq('session_id', sessionId).eq('type', type).maybeSingle();
  return data?.data ?? null;
}

async function ssSetBlob(sessionId, type, data) {
  if (!supabase) return;
  await supabase.from('session_store').delete().eq('session_id', sessionId).eq('type', type);
  await supabase.from('session_store').insert({ session_id: sessionId, type, data });
}

async function ssListOffers(sessionId) {
  if (!supabase) return [];
  const { data } = await supabase.from('session_store').select('*')
    .eq('type', 'offer').order('created_at', { ascending: false });
  return (data || []).map(r => ({ id: r.id, ...r.data, created_at: r.created_at }));
}

async function ssAppendOffer(sessionId, data) {
  if (!supabase) return 'OFF-' + Date.now();
  const { data: row } = await supabase.from('session_store')
    .insert({ session_id: sessionId, type: 'offer', data }).select('id').single();
  return row?.id ?? 'OFF-' + Date.now();
}

async function ssPatchOffer(id, patch) {
  if (!supabase) return null;
  const { data: existing } = await supabase.from('session_store').select('data').eq('id', id).single();
  if (!existing) return null;
  const merged = { ...existing.data, ...patch, updated_at: new Date().toISOString() };
  await supabase.from('session_store').update({ data: merged, updated_at: new Date().toISOString() }).eq('id', id);
  return merged;
}

app.get('/api/buyers/cart', async (req, res) => {
  const { buyer } = getBuyerFromReq(req);
  if (!buyer) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const cart = (await ssGetBlob(buyer.id, 'cart')) || [];
    res.json({ cart, total: cart.reduce((s, i) => s + i.quantity, 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/buyers/cart', async (req, res) => {
  const { buyer } = getBuyerFromReq(req);
  if (!buyer) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const { variantId, quantity = 1 } = req.body;
    if (!variantId) return res.status(400).json({ error: 'variantId required' });

    const [productIdStr, size] = String(variantId).split('_');
    const product   = await dbGetProduct(productIdStr);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const formatted = formatProduct(product);

    const cart     = (await ssGetBlob(buyer.id, 'cart')) || [];
    const existing = cart.find(i => i.variant_id === variantId);
    if (existing) {
      existing.quantity += parseInt(quantity) || 1;
    } else {
      cart.push({
        variant_id     : variantId,
        product_id     : product.id,
        sku            : product.sku || String(product.id),
        name           : product.title || product.description,
        size           : size || 'OS',
        color          : product.color,
        quantity       : parseInt(quantity) || 1,
        wholesale_price: formatted.wholesale_price,
        msrp           : parseFloat(product.srp) || null,
        image          : (product.image_urls || [])[0] || null,
        brand_name     : product.brand_name,
      });
    }
    await ssSetBlob(buyer.id, 'cart', cart);
    res.json({ cart, total: cart.reduce((s, i) => s + i.quantity, 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/buyers/cart/:variantId', async (req, res) => {
  const { buyer } = getBuyerFromReq(req);
  if (!buyer) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const cart = ((await ssGetBlob(buyer.id, 'cart')) || []).filter(i => i.variant_id !== req.params.variantId);
    await ssSetBlob(buyer.id, 'cart', cart);
    res.json({ cart });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Saved / Favorites ─────────────────────────────────────────────────────────

app.post('/api/buyers/saved/:productId', async (req, res) => {
  const { buyer } = getBuyerFromReq(req);
  if (!buyer) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const saved = (await ssGetBlob(buyer.id, 'saved')) || [];
    const id    = String(req.params.productId);
    if (!saved.find(s => s.item_id === id)) {
      saved.push({ item_type: 'product', item_id: id, saved_at: new Date().toISOString() });
      await ssSetBlob(buyer.id, 'saved', saved);
    }
    res.json({ saved: true, productId: id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/buyers/saved/:productId', async (req, res) => {
  const { buyer } = getBuyerFromReq(req);
  if (!buyer) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const id   = String(req.params.productId);
    const saved = ((await ssGetBlob(buyer.id, 'saved')) || []).filter(s => s.item_id !== id);
    await ssSetBlob(buyer.id, 'saved', saved);
    res.json({ saved: false, productId: id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/buyers/saved', async (req, res) => {
  const { buyer } = getBuyerFromReq(req);
  if (!buyer) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const saved    = (await ssGetBlob(buyer.id, 'saved')) || [];
    const ids      = saved.map(s => s.item_id);
    const products = ids.length ? (await dbGetInventory({ ids })).map(formatProduct) : [];
    res.json({ saved: products, total: products.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/buyers/verify', upload.single('business_license'), (req, res) => {
  const { token, buyer } = getBuyerFromReq(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { business_type, tax_id, annual_revenue, store_count } = req.body;
  if (!business_type) return res.status(400).json({ error: 'business_type required' });
  verifications.push({
    buyer_id: buyer.id, business_type, tax_id, annual_revenue, store_count,
    license_file: req.file?.originalname || null,
    submitted_at: new Date().toISOString(), status: 'pending',
  });
  if (sessions.has(token)) {
    sessions.get(token).verification_status = 'pending';
    sessions.get(token).status = 'pending';
  }
  res.json({ success: true, message: 'Verification submitted — review within 1–2 business days', status: 'pending' });
});

app.get('/api/buyers/orders', async (req, res) => {
  const { token, buyer } = getBuyerFromReq(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized', redirect: '/login' });
  try {
    const { data, error } = await supabase
      .from('buyer_orders')
      .select('*')
      .eq('buyer_id', buyer.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ orders: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/buyers/orders', async (req, res) => {
  try {
    const { token, buyer } = getBuyerFromReq(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { orderId, items, term, notes, currency } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'items required' });

    // Calculate total from Supabase prices
    let totalUsd = 0;
    for (const i of items) {
      const p = await dbGetProduct(i.id);
      if (!p) continue;
      const wsp = parseFloat(p.wsp_usd) || parseFloat(p.wholesale_usd) || parseFloat(p.srp_usd) * parseFloat(p.margin || 0.5);
      const qty = Object.values(i.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0);
      totalUsd += wsp * qty;
    }

    const order = {
      id         : orderId || ('LZ-' + Date.now()),
      buyer_id   : buyer.id,
      buyer_name : buyer.company || buyer.email,
      status     : 'new',
      total_usd  : parseFloat(totalUsd.toFixed(2)),
      currency   : currency || 'USD',
      terms      : term || 'full_prepayment',
      notes      : notes || '',
      items,
    };

    const { data, error } = await supabase.from('buyer_orders').insert([order]).select().single();
    if (error) throw error;
    console.log(`📋 Order ${order.id} submitted — ${items.length} items — $${order.total_usd}`);
    res.json({ success: true, order: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ORDER ROUTES (brand-dashboard.html)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('buyer_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (data && data.length) return res.json({ orders: data, total: data.length });
    // Fall back to seed data when the table is empty
    const seed = [
      { id:'#4421', buyer_name:'Voss & Co.',        country:'US', skus:3, total_usd:4800,  terms:'50/50 Deposit',   lead_time:'10 days', status:'deposit_overdue', created_at:'2026-05-08' },
      { id:'#4420', buyer_name:'Atelier Luxx',       country:'FR', skus:6, total_usd:12400, terms:'Full Prepayment', lead_time:'14 days', status:'confirmed',       created_at:'2026-05-14' },
      { id:'#4419', buyer_name:'House of Meridian',  country:'UK', skus:2, total_usd:2400,  terms:'Net 30',          lead_time:'7 days',  status:'preparing',       created_at:'2026-05-11' },
      { id:'#4418', buyer_name:'House Noir',          country:'IT', skus:4, total_usd:6200,  terms:'Net 30',          lead_time:'12 days', status:'balance_due',     created_at:'2026-04-14' },
      { id:'#4417', buyer_name:'Studio Blanche',      country:'IT', skus:2, total_usd:1100,  terms:'—',               lead_time:'—',       status:'offer',           created_at:'2026-05-15' },
      { id:'#4416', buyer_name:'Maison Verte',        country:'FR', skus:5, total_usd:3200,  terms:'—',               lead_time:'—',       status:'offer',           created_at:'2026-05-15' },
      { id:'#4415', buyer_name:'Moda Milano',         country:'IT', skus:3, total_usd:3800,  terms:'Net 60',          lead_time:'21 days', status:'shipped',         created_at:'2026-04-30' },
    ];
    res.json({ orders: seed, total: seed.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('buyer_orders')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, order: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  OFFER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Offers — session_store temp table ────────────────────────────────────────

app.get('/api/offers', async (req, res) => {
  try {
    const offers = await ssListOffers();
    res.json({ offers, total: offers.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/offers', async (req, res) => {
  const { company, contact, email, terms, message, currency, items } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'items required' });
  try {
    const total = items.reduce((s, i) => s + (parseFloat(i.wholesale_price || i.price || 0) * (i.quantity || 1)), 0);
    const { buyer } = getBuyerFromReq(req);
    const sessionId = buyer?.id || 'anon';
    const offer = { company: company || 'Anonymous', contact, email, terms, message, currency: currency || 'USD', total, items, status: 'pending' };
    const id = await ssAppendOffer(sessionId, offer);
    console.log(`💬 Offer ${id} from ${company} — ${items.length} styles`);
    res.json({ success: true, offer: { id, ...offer } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/offers/:id', async (req, res) => {
  try {
    const result = await ssPatchOffer(req.params.id, req.body);
    if (!result) return res.status(404).json({ error: 'Offer not found' });
    res.json({ success: true, offer: { id: req.params.id, ...result } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD KPIs (brand-dashboard.html)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/dashboard/kpis', async (req, res) => {
  // ── hardcoded fallback (used if supabase is unavailable) ────────────────────
  const FALLBACK = {
    revenue_mtd: 52400, revenue_prev: 47000, revenue_change_pct: 11.5,
    open_orders: 7, pending_payments: 8600, overdue_payments: 2,
    active_buyers: 24, new_buyers_week: 3, skus_live: 0,
    total_stock: 0, low_stock_count: 0, avg_order_value: 3200, aov_change_pct: 8.1,
    pipeline: {
      offers : { count: 4,  value: 4300  },
      new    : { count: 3,  value: 14400 },
      prep   : { count: 5,  value: 21000 },
      shipped: { count: 12, value: 58000 },
    },
    recent_orders: [
      { id:'#4421', buyer:'Voss & Co.',     total_usd:4800,  terms:'50/50 Deposit', status:'deposit_overdue', date:'May 08' },
      { id:'#4420', buyer:'Atelier Luxx',   total_usd:12400, terms:'Full Prepay',   status:'confirmed',       date:'May 14' },
      { id:'#4419', buyer:'House Meridian', total_usd:2400,  terms:'Net 30',        status:'preparing',       date:'May 11' },
      { id:'#4418', buyer:'House Noir',     total_usd:6200,  terms:'Net 30',        status:'balance_due',     date:'Apr 14' },
    ],
  };

  try {
    // ── inventory stats ───────────────────────────────────────────────────────
    const invData = await dbGetInventory();
    const totalStock = invData.reduce((s, p) => s + (parseInt(p.stock_total || p.stock) || 0), 0);
    const lowStock   = invData.filter(p => (parseInt(p.stock_total || p.stock) || 0) < 6).length;
    const skusLive   = invData.filter(p => (p.status || '') !== 'archived').length;

    if (!supabase) {
      return res.json({ ...FALLBACK, skus_live: skusLive, total_stock: totalStock, low_stock_count: lowStock });
    }

    // ── orders queries ────────────────────────────────────────────────────────
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const day90ago   = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: allOrders,     error: e1 },
      { data: mtdOrders,     error: e2 },
      { data: pendingOrders, error: e3 },
      { data: recentOrders,  error: e4 },
      { data: buyers90,      error: e5 },
    ] = await Promise.all([
      supabase.from('buyer_orders').select('id, buyer_id, buyer_name, total_usd, status, terms, created_at'),
      supabase.from('buyer_orders').select('total_usd').gte('created_at', monthStart),
      supabase.from('buyer_orders').select('total_usd, status').in('status', ['new','confirmed']),
      supabase.from('buyer_orders').select('id, buyer_name, total_usd, terms, status, created_at').order('created_at', { ascending: false }).limit(5),
      supabase.from('buyer_orders').select('buyer_id').gte('created_at', day90ago),
    ]);

    if (e1 || e2 || e3 || e4 || e5) {
      const err = e1 || e2 || e3 || e4 || e5;
      console.error('[kpis] supabase error:', err.message);
      return res.json({ ...FALLBACK, skus_live: skusLive, total_stock: totalStock, low_stock_count: lowStock });
    }

    const revenue_mtd      = (mtdOrders || []).reduce((s, o) => s + (parseFloat(o.total_usd) || 0), 0);
    const pending_payments = (pendingOrders || []).reduce((s, o) => s + (parseFloat(o.total_usd) || 0), 0);
    const open_orders      = (allOrders || []).filter(o => !['cancelled','shipped','delivered'].includes(o.status)).length;
    const activeBuyerIds   = new Set((buyers90 || []).map(o => o.buyer_id).filter(Boolean));
    const active_buyers    = activeBuyerIds.size;
    const allTotals        = (allOrders || []).map(o => parseFloat(o.total_usd) || 0);
    const avg_order_value  = allTotals.length ? allTotals.reduce((a, b) => a + b, 0) / allTotals.length : 0;

    // pipeline
    const pipelineGroups = { offers: [], new: [], prep: [], shipped: [] };
    (allOrders || []).forEach(o => {
      const s = o.status || '';
      const v = parseFloat(o.total_usd) || 0;
      if (s === 'offer')                                   pipelineGroups.offers.push(v);
      else if (s === 'new')                                pipelineGroups.new.push(v);
      else if (['confirmed','preparing','processing'].includes(s)) pipelineGroups.prep.push(v);
      else if (s === 'shipped')                            pipelineGroups.shipped.push(v);
    });
    const pipeline = {};
    for (const [k, arr] of Object.entries(pipelineGroups)) {
      pipeline[k] = { count: arr.length, value: arr.reduce((a, b) => a + b, 0) };
    }

    // recent orders formatted
    const recent_orders = (recentOrders || []).map(o => ({
      id      : '#' + String(o.id).slice(-4).toUpperCase(),
      buyer   : o.buyer_name || 'Unknown',
      total_usd: parseFloat(o.total_usd) || 0,
      terms   : o.terms || '—',
      status  : o.status || 'new',
      date    : new Date(o.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }),
    }));

    // prev month revenue (best-effort, don't block on failure)
    let revenue_prev = FALLBACK.revenue_prev;
    try {
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const { data: prevOrders } = await supabase
        .from('buyer_orders').select('total_usd').gte('created_at', prevMonthStart).lt('created_at', monthStart);
      if (prevOrders) revenue_prev = prevOrders.reduce((s, o) => s + (parseFloat(o.total_usd) || 0), 0);
    } catch (_) {}

    const revenue_change_pct = revenue_prev > 0 ? ((revenue_mtd - revenue_prev) / revenue_prev * 100) : 0;

    res.json({
      revenue_mtd, revenue_prev, revenue_change_pct,
      open_orders, pending_payments, overdue_payments: 0,
      active_buyers, new_buyers_week: 0,
      skus_live: skusLive, total_stock: totalStock, low_stock_count: lowStock,
      avg_order_value, aov_change_pct: 0,
      pipeline, recent_orders,
    });
  } catch (err) {
    console.error('[kpis] unexpected error:', err.message);
    const invFallback = await dbGetInventory().catch(() => []);
    res.json({ ...FALLBACK, skus_live: invFallback.filter(p => (p.status || '') !== 'archived').length });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  UPLOAD — AI Smart Sync  (brand-dashboard.html)
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/upload/smart-sync', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  // Hard timeout — if processing takes > 90s something is badly wrong; fail fast.
  const safetyTimer = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[smart-sync] Handler exceeded 90s — sending timeout error');
      res.status(504).json({ error: 'Processing timed out. Try a smaller file or contact support.' });
    }
  }, 90_000);
  res.on('finish', () => clearTimeout(safetyTimer));

  // smart-sync ALWAYS returns staged drafts — it never writes to Supabase.
  // The frontend reviews / edits, then calls POST /api/inventory/bulk-insert to commit.
  const preview = true; // forced: write path removed from this route

  const fs        = require('fs');
  const csvParser = require('csv-parser');
  const XLSX      = require('xlsx');

  const filePath = req.file.path;
  const origName = (req.file.originalname || '');
  const origLow  = origName.toLowerCase();
  const ext      = origLow.endsWith('.csv')  ? 'csv'
                 : origLow.endsWith('.xlsx') || origLow.endsWith('.xls') ? 'xlsx'
                 : origLow.endsWith('.pdf')  ? 'pdf'
                 : 'unknown';

  const cleanup = () => { try { fs.unlinkSync(filePath); } catch (_) {} };

  // ── PDF path ────────────────────────────────────────────────────────────────
  if (ext === 'pdf') {
    let pdfProducts       = [];
    let pdfDetectedCols   = [];  // [{header, field}] from positional parser
    let pdfParserStrategy = 'none';

    // ── Strategy 1: positional table parser (pdfjs-dist, handles structured PDFs) ─
    try {
      const positionalResult = await Promise.race([
        parsePdfTextPositional(filePath, origName),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('positional parser timed out after 30s')), 30_000)
        ),
      ]);
      if (positionalResult && positionalResult.products && positionalResult.products.length) {
        pdfProducts     = positionalResult.products;
        pdfDetectedCols = positionalResult.detectedColumns || [];
        pdfParserStrategy = 'positional';
        console.log(`[PDF] Positional parser found ${pdfProducts.length} products, ${pdfDetectedCols.length} columns`);
      }
    } catch (err) {
      console.warn('[PDF positional] Failed or timed out:', err.message);
    }

    // ── Strategy 2: linear text parser fallback (catalog-style PDFs) ─────────
    if (!pdfProducts.length) {
      try {
        const textResult = await Promise.race([
          (async () => {
            const pdfParse = require('pdf-parse');
            const buf  = fs.readFileSync(filePath);
            const data = await pdfParse(buf);
            return parsePdfText(data.text, origName);
          })(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('pdf-parse timed out after 20s')), 20_000)
          ),
        ]);
        pdfProducts = textResult || [];
        if (pdfProducts.length) {
          pdfParserStrategy = 'linear';
          console.log(`[PDF] Linear text parser found ${pdfProducts.length} products`);
        }
      } catch (err) {
        console.warn('[PDF text] Failed or timed out:', err.message);
      }
    }

    // ── Image extraction ───────────────────────────────────────────────────────
    let extractedPdfImages = [];
    try { extractedPdfImages = await extractPdfImages(filePath); } catch (_) {}

    console.log(`[PDF/${pdfParserStrategy}] ${pdfProducts.length} products, ${extractedPdfImages.length} images`);

    // Auto-generate notes for products missing them
    pdfProducts.forEach(p => {
      if (!p.product_notes) p.product_notes = generateRichDescription(p.description, p.category, p.color, p.season);
    });

    // Upload extracted PDF images — sharp optimises raw pixel data; dedup by hash
    let pdfImgCount = 0;
    if (extractedPdfImages.length && pdfProducts.length) {
      const toUpload = extractedPdfImages.slice(0, MAX_IMAGES_PER_IMPORT);
      const uploadJobs = toUpload.map(async (img, i) => {
        const prod = pdfProducts[i];
        if (!prod) return;
        const url = await uploadProductImage(img.buffer, {
          sku     : prod.sku || `pdf_row${i}`,
          brandId : 1,
          width   : img.width,
          height  : img.height,
          channels: img.channels,
        });
        if (url) {
          if (!prod.image_urls) prod.image_urls = [];
          if (!prod.image_urls.includes(url)) { prod.image_urls.unshift(url); pdfImgCount++; }
        }
      });
      await Promise.allSettled(uploadJobs);
    }

    // Build synthetic mappings object from detectedColumns so the frontend
    // mapping grid can show PDF columns and let the user override any field.
    const pdfMappings = {};
    pdfDetectedCols.forEach(col => {
      if (!col.field) return;
      pdfMappings[col.header] = {
        field  : col.field,
        matched: true,
        method : 'pdf-auto',
        score  : null,
      };
    });

    let dbResult = { inserted: 0, updated: 0, errors: [] };
    if (!preview && pdfProducts.length > 0) dbResult = await dbUpsertProducts(pdfProducts);

    // Collect detected size labels
    const pdfSizesObj = pdfProducts.find(p => p.sizes && Object.keys(p.sizes).length > 0)?.sizes || {};
    const pdfSizeLabels = Object.keys(pdfSizesObj);

    console.log(`📥 Smart Sync [PDF/${pdfParserStrategy}]: ${pdfProducts.length} products, ${pdfImgCount} images`);
    return res.json({
      message         : `Staged — PDF · ${pdfProducts.length} products · 90% confidence${pdfImgCount ? ` · ${pdfImgCount} images` : ''}`,
      detectedType    : 'linesheet',
      mappings        : pdfMappings,
      pdf_detected_cols: pdfDetectedCols,
      pdf_parser      : pdfParserStrategy,
      confidence      : 90,
      total_rows      : pdfProducts.length,
      products        : pdfProducts,
      embedded_images : pdfImgCount,
      size_labels     : pdfSizeLabels,
      staged          : true,
    });
  }

  // ── Parse raw rows (CSV / XLSX) ─────────────────────────────────────────────
  let rawHeaders    = [];
  let rawRows       = [];
  let embeddedImages = [];   // [{ dataRowIndex, buffer, ext, mimeType }] — from xlsx embedded images

  try {
    if (ext === 'csv') {
      // Parse all rows first without assuming row 0 is the header.
      // Then pick the best header row the same way we do for XLSX.
      const allCsvRows = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csvParser({ headers: false, skipLines: 0 }))
          .on('data', row => allCsvRows.push(Object.values(row)))
          .on('end',  resolve)
          .on('error', reject);
      });

      // Score rows 0–14: alias hit count + non-numeric word count × 0.5
      const allAliasesCsv = new Set(
        Object.values(COLUMN_MAPS).flat().map(a => a.toLowerCase().trim())
      );
      let csvBestScore = -1, csvHeaderIdx = 0;
      for (let i = 0; i < Math.min(15, allCsvRows.length); i++) {
        const cells = (allCsvRows[i] || []).map(c => String(c || '').toLowerCase().trim()).filter(Boolean);
        if (cells.length < 2) continue;
        let s = cells.filter(c => allAliasesCsv.has(c)).length;
        s += cells.filter(c => isNaN(Number(c)) && c.length > 1).length * 0.5;
        if (s > csvBestScore) { csvBestScore = s; csvHeaderIdx = i; }
      }

      rawHeaders = (allCsvRows[csvHeaderIdx] || []).map(h => String(h).trim()).filter(Boolean);
      for (let r = csvHeaderIdx + 1; r < allCsvRows.length; r++) {
        const row = allCsvRows[r];
        const nonEmpty = (row || []).filter(c => c !== '' && c !== null && c !== undefined);
        if (nonEmpty.length < 2) continue;
        const obj = {};
        rawHeaders.forEach((h, idx) => { obj[h] = row[idx] !== undefined ? String(row[idx]) : ''; });
        rawRows.push(obj);
      }
      if (csvHeaderIdx > 0)
        console.log(`[CSV] Header row detected at row ${csvHeaderIdx} (score ${csvBestScore.toFixed(1)})`);


    } else if (ext === 'xlsx') {
      const wb    = XLSX.readFile(filePath);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      // Pick header row: score by COLUMN_MAPS alias matches
      const allAliases = new Set(
        Object.values(COLUMN_MAPS).flat().map(a => a.toLowerCase().trim())
      );
      let bestScore    = -1;
      let headerRowIdx = 0;
      for (let i = 0; i < Math.min(15, data.length); i++) {
        const cells = (data[i] || []).map(c => String(c || '').toLowerCase().trim()).filter(Boolean);
        if (cells.length < 2) continue;
        let score = cells.filter(c => allAliases.has(c)).length;
        score += cells.filter(c => isNaN(Number(c)) && c.length > 1).length * 0.5;
        if (score > bestScore) { bestScore = score; headerRowIdx = i; }
      }

      rawHeaders = (data[headerRowIdx] || []).map(h => String(h).trim()).filter(Boolean);

      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row           = data[r];
        const firstNonEmpty = (row || []).map(c => String(c || '').trim().toUpperCase()).find(c => c.length > 0) || '';
        if (!firstNonEmpty || firstNonEmpty.startsWith('TOTAL') || firstNonEmpty.startsWith('SUBTOTAL')) continue;
        const nonEmptyCells = (row || []).filter(c => c !== '' && c !== null && c !== undefined);
        if (nonEmptyCells.length < 2) continue;

        const obj = {};
        rawHeaders.forEach((h, idx) => { obj[h] = row[idx] !== undefined ? row[idx] : ''; });
        rawRows.push(obj);
      }

      // ── Extract embedded images BEFORE cleanup deletes the file ──────────────
      // File must still be on disk at this point.
      embeddedImages = await extractXlsxImages(filePath, headerRowIdx);
      if (embeddedImages.length) {
        console.log(`[Images] Found ${embeddedImages.length} embedded image(s) in ${origName}`);
      }

    } else {
      cleanup();
      return res.status(400).json({ error: `Unsupported file type: ${origName}. Accepted: CSV, XLSX, XLS, PDF` });
    }
  } catch (err) {
    cleanup();
    return res.status(500).json({ error: 'File parsing failed: ' + err.message });
  }

  cleanup();   // temp file deleted here — images already extracted into memory above

  if (rawHeaders.length === 0) {
    return res.status(422).json({ error: 'Could not detect headers in file.' });
  }

  // ── Build column value samples (used for AI mapping + frontend card display) ─
  const columnSamples = {};  // header → first 3 non-empty values
  rawHeaders.forEach(h => {
    columnSamples[h] = rawRows
      .map(r => String(r[h] ?? '').trim())
      .filter(v => v !== '')
      .slice(0, 3);
  });

  // ── AI Column Mapping (primary authoritative pass) ───────────────────────────
  // Calls Claude Haiku with headers + sample rows to resolve column intent from
  // BOTH header name AND actual cell values. Falls back gracefully on error.
  let aiMapping = null;
  if (process.env.ANTHROPIC_API_KEY && rawRows.length >= 2 && rawHeaders.length >= 2) {
    try {
      aiMapping = await aiColumnMapping(rawHeaders, rawRows, origName);
    } catch (err) {
      console.warn('[AI Mapping] Failed:', err.message);
    }
  }

  // ── Antidote Fuzzy Mapping (fallback / gap-filler) ───────────────────────────
  // Runs for every header. AI results override fuzzy results for non-exact matches.
  // Each header is resolved through up to 5 passes so the UI can show the method.
  const mappings   = {};
  let matchedCount = 0;

  rawHeaders.forEach(h => {
    const raw    = String(h).toLowerCase().trim();
    const norm   = raw.replace(/[_\-\/\\|.]+/g,' ').replace(/\s+/g,' ').trim();
    const tokens = tokenise(norm);

    let matched = null, method = null, score = null;

    // Pre-pass: tiered wholesale columns identified by "Wholesale X%" / "WSP X%" pattern
    if (/wholesale\s*\d+\s*%/i.test(raw) || /wsp\s*\d+\s*%/i.test(raw)) {
      const pct = parseInt((raw.match(/(\d+)\s*%/) || [])[1] || '0');
      matched = pct >= 38 ? 'wsp_tier_high' : 'wsp_tier_low';
      method  = 'exact';
    }

    // Pass 0: size header recognition — wins before any fuzzy/AI logic
    if (!matched && headerSizeLabel(h)) {
      for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
        if (EXACT_ONLY_COLS.has(key) && (aliases.includes(norm) || aliases.includes(raw))) {
          matched = key; method = 'exact'; break;
        }
      }
      if (!matched) { matched = 'size_auto'; method = 'size-auto'; }
    }

    // Pass 1: exact alias match
    if (!matched) {
      for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
        if (aliases.includes(norm) || aliases.includes(raw)) { matched = key; method = 'exact'; break; }
      }
    }

    // Pass 2: Jaccard ≥ 0.40
    if (!matched) {
      let best = 0, bestKey = null;
      for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
        if (EXACT_ONLY_COLS.has(key)) continue;
        for (const alias of aliases) {
          if (alias.length <= 2) continue;
          const s = jaccardScore(tokens, tokenise(alias));
          if (s > best) { best = s; bestKey = key; }
        }
      }
      if (best >= 0.40) { matched = bestKey; method = 'fuzzy'; score = +(best.toFixed(2)); }
    }

    // Pass 3: keyword fingerprint
    if (!matched) {
      for (const [field, signals] of Object.entries(KEYWORD_FINGERPRINTS)) {
        if (signals.some(sig => norm.includes(sig) || (norm.length >= 3 && sig.includes(norm)))) {
          const mapKey = Object.keys(COLUMN_MAPS).find(k =>
            k === field ||
            (field === 'wsp_usd'     && k === 'wsp_usd') ||
            (field === 'srp'  && k === 'srp') ||
            (field === 'stock_total' && k === 'stock_total')
          );
          if (mapKey) { matched = mapKey; method = 'fingerprint'; break; }
        }
      }
    }

    // Pass 4: abbreviation expansion + re-score ≥ 0.35
    if (!matched) {
      const expTokens = expandAbbrevs(tokens);
      const expanded  = expTokens.join(' ');
      for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
        if (aliases.includes(expanded)) { matched = key; method = 'abbrev-exact'; break; }
      }
      if (!matched) {
        let best = 0, bestKey = null;
        for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
          if (EXACT_ONLY_COLS.has(key)) continue;
          for (const alias of aliases) {
            if (alias.length <= 2) continue;
            const s = jaccardScore(expTokens, tokenise(alias));
            if (s > best) { best = s; bestKey = key; }
          }
        }
        if (best >= 0.35) { matched = bestKey; method = 'abbrev-fuzzy'; score = +(best.toFixed(2)); }
      }
    }

    // Pass 5: substring containment
    if (!matched) {
      for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
        if (EXACT_ONLY_COLS.has(key)) continue;
        if (aliases.some(a => a.length > 3 && (norm.includes(a) || (norm.length >= 3 && a.includes(norm))))) {
          matched = key; method = 'substring'; break;
        }
      }
    }

    // Pass 6: Value-type inference — validates non-exact matches against actual values.
    // Overrides fuzzy/fingerprint/substring matches when values strongly indicate
    // a different field type (e.g. a column full of prices matched to "description").
    if (method && method !== 'exact' && method !== 'size-auto' && method !== 'abbrev-exact') {
      const colVals = rawRows.map(r => r[h]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
      const inferred = inferColumnType(h, colVals);
      if (inferred.field && inferred.field !== matched && inferred.confidence >= 0.72) {
        if (inferred.field === 'price') {
          // Values are prices but header matched a non-price field → clear match, mark unresolved
          if (!['wsp_usd','srp','cost','wsp_tier_high','wsp_tier_low','price'].includes(matched)) {
            matched = null; method = null; score = null;
          }
        } else if (['sku','color','image_url','size_auto','product_notes'].includes(inferred.field)) {
          matched = inferred.field; method = 'value-inferred'; score = +(inferred.confidence.toFixed(2));
        }
      }
    }
    // For completely unmatched columns, try value inference directly
    if (!matched) {
      const colVals = rawRows.map(r => r[h]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
      const inferred = inferColumnType(h, colVals);
      if (inferred.field && inferred.field !== 'price' && inferred.confidence >= 0.72) {
        matched = inferred.field; method = 'value-inferred'; score = +(inferred.confidence.toFixed(2));
      }
    }

    // ── AI override (highest authority, applied last) ─────────────────────────
    // AI sees both headers AND values so its results override fuzzy matches.
    // We trust AI fully except for clear size tokens (size-auto) which header detection wins.
    if (aiMapping && aiMapping[h] !== undefined && method !== 'size-auto') {
      const aiField = aiMapping[h];
      if (aiField === 'skip' || !aiField) {
        matched = null; method = null; score = null; // will become auto-skip below
      } else {
        matched = aiField; method = 'ai'; score = 0.95;
      }
    }

    if (matched) {
      mappings[h] = { field: matched, matched: true, method, ...(score ? { score } : {}), sampleValues: columnSamples[h] || [] };
      matchedCount++;
    } else {
      const autoSkip = shouldAutoSkipColumn(h, rawRows);
      mappings[h] = {
        field       : autoSkip ? 'skip' : h,
        matched     : false,
        method      : autoSkip ? 'auto-skip' : 'none',
        ...(autoSkip ? { autoSkipped: true } : {}),
        sampleValues: columnSamples[h] || [],
      };
    }
  });

  // ── Conflict resolution pass ──────────────────────────────────────────────────
  // If two or more columns map to the same high-importance field, keep the one
  // whose values best match the expected type and demote the others to unmatched.
  const HIGH_IMPORTANCE = ['description', 'sku', 'wsp_usd', 'srp', 'color'];
  HIGH_IMPORTANCE.forEach(field => {
    const competing = Object.entries(mappings).filter(([, v]) => v.matched && v.field === field);
    if (competing.length <= 1) return;

    // Score each competitor by method priority + value inference confidence
    const METHOD_PRIORITY = { exact: 5, 'abbrev-exact': 4, ai: 4, fingerprint: 3, 'abbrev-fuzzy': 2, fuzzy: 2, substring: 1, 'value-inferred': 3 };
    const scored = competing.map(([h, info]) => {
      const colVals = rawRows.map(r => r[h]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
      const inferred = inferColumnType(h, colVals);
      const methodScore = METHOD_PRIORITY[info.method] || 0;
      // Value confidence for the target field (how well values match what we expect)
      let valScore = 0;
      if (field === 'sku')         valScore = inferred.field === 'sku'         ? inferred.confidence : 0;
      if (field === 'wsp_usd')     valScore = inferred.field === 'price'        ? inferred.confidence * 0.9 : 0;
      if (field === 'srp')         valScore = inferred.field === 'price'        ? inferred.confidence * 0.9 : 0;
      if (field === 'color')       valScore = inferred.field === 'color'        ? inferred.confidence : 0;
      if (field === 'description') valScore = inferred.field === 'description'  ? inferred.confidence : (inferred.field === null ? 0.3 : 0);
      return { h, info, total: methodScore + valScore * 3 };
    });

    scored.sort((a, b) => b.total - a.total);
    // Demote all but the winner
    scored.slice(1).forEach(({ h }) => {
      const autoSkip = shouldAutoSkipColumn(h, rawRows);
      mappings[h] = { ...mappings[h], field: autoSkip ? 'skip' : h, matched: false, method: autoSkip ? 'auto-skip' : 'conflict' };
      matchedCount--;
    });
    console.log(`[Conflict] "${field}" won by "${scored[0].h}", demoted: ${scored.slice(1).map(s=>s.h).join(', ')}`);
  });

  // ── WSP vs SRP disambiguation pass ────────────────────────────────────────────
  // When two columns both infer as 'price', use their average values to assign
  // wsp_usd (lower) vs srp (higher). Also handles the case where AI mapped both
  // to the same price field.
  const priceConflicts = Object.entries(mappings)
    .filter(([, v]) => v.matched && (v.field === 'wsp_usd' || v.field === 'srp'));
  if (priceConflicts.length === 2) {
    const [[hA, infoA], [hB, infoB]] = priceConflicts;
    const avgA = columnSamples[hA].map(v => parseFloat(v.replace(/[^0-9.]/g,''))||0).filter(v=>v>0).reduce((s,v,_,a)=>s+v/a.length,0);
    const avgB = columnSamples[hB].map(v => parseFloat(v.replace(/[^0-9.]/g,''))||0).filter(v=>v>0).reduce((s,v,_,a)=>s+v/a.length,0);
    if (avgA > 0 && avgB > 0 && avgA !== avgB) {
      const [lowH, highH] = avgA < avgB ? [hA, hB] : [hB, hA];
      if (mappings[lowH].field  !== 'wsp_usd') { mappings[lowH].field  = 'wsp_usd'; console.log(`[Price] "${lowH}" → wsp_usd (avg ${Math.min(avgA,avgB).toFixed(2)})`); }
      if (mappings[highH].field !== 'srp')      { mappings[highH].field = 'srp';     console.log(`[Price] "${highH}" → srp (avg ${Math.max(avgA,avgB).toFixed(2)})`); }
    }
  }

  const confidence = Math.round((matchedCount / rawHeaders.length) * 100);

  // ── Detect Document Type ────────────────────────────────────────────────────
  const mappedFields = new Set(Object.values(mappings).map(v => v.field));
  const hasCarton    = mappedFields.has('carton_id') || rawHeaders.some(h => h.toLowerCase().includes('carton'));
  const hasPO        = rawHeaders.some(h => ['vendor code','vendor wsp','po number','purchase order'].includes(h.toLowerCase()));
  const hasLinesheet = rawHeaders.some(h =>
    h.toLowerCase().includes('b2b') || h.toLowerCase().includes('title & pictures') ||
    h.toLowerCase().includes('exw') || h.toLowerCase().includes('wsp/srp')
  );
  const detectedType = hasCarton    ? 'packing_list'
                     : hasPO        ? 'po'
                     : hasLinesheet ? 'linesheet'
                     : 'generic';

  // ── Build reverse map & getField helper ─────────────────────────────────────
  // Support multiple source headers mapping to the same canonical field
  const reverseMap = {};   // canonical field → [ origHeader, ... ]
  Object.entries(mappings).forEach(([origH, v]) => {
    if (!reverseMap[v.field]) reverseMap[v.field] = [];
    reverseMap[v.field].push(origH);
  });

  const getField = (row, fieldName) => {
    const candidates = reverseMap[fieldName] || [];
    for (const h of candidates) {
      const v = row[h];
      if (v !== undefined && v !== '' && v !== null) return v;
    }
    return undefined;
  };

  // ── Dynamic size-column detection ───────────────────────────────────────────
  // Works for ANY sizing system: S/M/L, 32-56, 6-12 shoes, UK/EU/US/JP, OS, etc.
  // Two-step: (1) header looks like a size label, (2) values in that column are
  // non-negative integers (qty per size), not prices or weights.

  // headerSizeLabel is now defined at module level above findBestMatch.

  /**
   * Returns true if the majority of non-empty values in this column across all
   * rows look like stock quantities (non-negative integers, not prices).
   */
  function columnHasSizeValues(header) {
    const nonEmpty = rawRows
      .map(r => r[header])
      .filter(v => v !== '' && v !== null && v !== undefined);
    if (nonEmpty.length === 0) return false;
    const intLike = nonEmpty.filter(v => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && Number.isInteger(n) && n <= 9999;
    });
    // ≥ 60 % of non-empty values must look like integer quantities
    return intLike.length / nonEmpty.length >= 0.6;
  }

  // Build the final list of size columns: { header, label }
  // Include both Antidote-mapped size fields AND dynamically detected ones.
  const activeSizeCols = [];   // [{ header: origColumnHeader, label: 'M' / '38' / 'EU 40' / … }]
  const sizeHeadersSeen = new Set();

  // Pass A: columns already recognised by the Antidote mapper as size_* fields
  rawHeaders.forEach(h => {
    const info = mappings[h];
    if (info && info.matched && ANTIDOTE_SIZE_FIELDS[info.field]) {
      const label = ANTIDOTE_SIZE_FIELDS[info.field];
      if (!sizeHeadersSeen.has(h)) { activeSizeCols.push({ header: h, label }); sizeHeadersSeen.add(h); }
    }
  });

  // Pass B: dynamic detection — any UNMAPPED or size_auto column whose header
  //         looks like a size and whose values are integer quantities.
  rawHeaders.forEach(h => {
    if (sizeHeadersSeen.has(h)) return;          // already added in Pass A
    const info = mappings[h];
    // Skip only if mapped to a real non-size field (not size_auto)
    if (info && info.matched && info.field !== 'size_auto') return;
    const label = headerSizeLabel(h);
    if (!label) return;
    if (!columnHasSizeValues(h)) return;
    // Register as a matched size column in the mappings report
    mappings[h] = { field: `size_auto`, matched: true, method: 'size-auto' };
    matchedCount++;
    activeSizeCols.push({ header: h, label });
    sizeHeadersSeen.add(h);
  });

  // Pass C: rescue — any column mapped to size_range whose header IS a size token
  //         and whose values look like integer quantities (e.g. S→SIZE_RANGE from an
  //         older mapping run or user's file pattern) — upgrade it to an individual
  //         size column so it renders as its own column in the staging table.
  rawHeaders.forEach(h => {
    if (sizeHeadersSeen.has(h)) return;
    const info = mappings[h];
    if (!info || info.field !== 'size_range') return;   // only rescue size_range-mapped headers
    const label = headerSizeLabel(h);
    if (!label) return;                                  // header must look like a size token
    if (!columnHasSizeValues(h)) return;                 // values must be integer quantities
    // Upgrade: was size_range → now individual size column
    mappings[h] = { field: 'size_auto', matched: true, method: 'size-auto' };
    activeSizeCols.push({ header: h, label });
    sizeHeadersSeen.add(h);
    console.log(`[Size Rescue] "${h}" upgraded size_range → size_auto (label: ${label})`);
  });

  let products    = [];
  let packingRows = [];

  // ── Per-batch SKU generation state ────────────────────────────────────────────
  const uploadUsedSkus = new Set();
  const uploadSeqMap   = {};
  const uploadBrandCode = String(req.body.brandCode || req.query.brandCode || '').trim();

  if (detectedType === 'packing_list') {
    // ── Packing List ──────────────────────────────────────────────────────────
    rawRows.forEach(row => {
      const sizes = {};
      activeSizeCols.forEach(({ header, label }) => {
        const raw = row[header] !== undefined ? row[header] : getField(row, header);
        const v   = Math.round(Number(raw) || 0);
        if (v > 0) sizes[label] = v;
      });
      const pieces = Number(getField(row, 'stock_total')) || Object.values(sizes).reduce((a,b)=>a+b,0);
      packingRows.push({
        carton_id : String(getField(row, 'carton_id') || ''),
        style     : String(getField(row, 'description') || ''),
        sizes, pieces,
        dimensions: String(getField(row, 'dimensions') || ''),
        weight    : Number(getField(row, 'weight'))    || 0,
        location  : String(getField(row, 'location')  || ''),
      });
    });

    const seen = new Set();
    packingRows.forEach(p => {
      if (p.style && !seen.has(p.style)) {
        seen.add(p.style);
        const total = packingRows.filter(r=>r.style===p.style).reduce((s,r)=>s+r.pieces,0);
        products.push({
          description: p.style, stock_total: total, category: 'IMPORTED', season: '',
          sizes: {}, brand_name: 'Brand Name', brand_id: 1, tags: [], image_urls: [],
          tier_pricing: [], margin: 0.5, moq: 1, srp: 0,
          product_notes: generateRichDescription(p.style, 'GENERAL', '', ''),
        });
      }
    });

  } else {
    // ── Linesheet / PO / Generic ──────────────────────────────────────────────
    rawRows.forEach(row => {
      // ── Step 0: product row classification ────────────────────────────────
      // classifyRow() scores each row using column-aware normalization:
      // positive signals (name, SKU, price, sizes, color) vs. negative signals
      // (header/footer tokens, section labels, numeric rows, document titles).
      const classification = classifyRow(row, mappings, reverseMap, activeSizeCols);
      if (!classification.isProduct) return;

      const rawName    = String(getField(row, 'name')        || '').trim();
      const rawDescCol = String(getField(row, 'description') || '').trim();
      const rawTitle   = rawName || rawDescCol;

      // ── Step 1: base field extraction ──────────────────────────────────────
      const rawCategory = String(getField(row, 'category') || '');
      const rawSeason   = String(getField(row, 'season')   || '');
      const rawGender   = String(getField(row, 'gender')   || '');
      const rawMaterial  = String(getField(row, 'material')        || '').trim();
      const rawDelivery  = String(getField(row, 'delivery_window') || '').trim() ||
                           String(getField(row, 'season')          || '').trim();
      const rawBrandName = String(getField(row, 'brand_name')      || '').trim();

      // ── Smart colour detection ─────────────────────────────────────────────
      // Priority: 1) explicit color column  2) extract from name + description
      //           3) short description that IS the colorway  4) unmapped cells
      //           5) any string cell (mapped or not) whose full value is a color phrase
      //           6) deep structural scan: tokenise every cell value and find color tokens
      let rawColor = String(getField(row, 'color') || '').trim();

      if (!rawColor) rawColor = extractColor(rawTitle + ' ' + rawDescCol);
      if (!rawColor && rawDescCol) {
        const descWords = rawDescCol.split(/\s+/).length;
        if (descWords <= 6 && /^[\w\s\-\/&]+$/.test(rawDescCol) && COLOR_RE.test(rawDescCol)) {
          rawColor = rawDescCol;
        }
      }
      // Pass 4: unmapped cells only
      if (!rawColor) {
        for (const [h, v] of Object.entries(row)) {
          const vs = String(v || '').trim();
          if (!vs || vs.length > 40) continue;
          if (vs.split(/\s+/).length <= 4 && COLOR_RE.test(vs) && !mappings[h]?.matched) {
            rawColor = vs; break;
          }
        }
      }
      // Pass 5: any cell whose ENTIRE value is a color phrase (e.g. a "Colour" column
      // that the mapper didn't recognise because it was labelled "Colorway", "Tone", etc.)
      if (!rawColor) {
        const NON_COLOR_FIELDS = new Set(['name','description','sku','wsp_usd','srp','cost','stock_total','moq','size_range','size_auto','image_url','product_notes','material','delivery_window','brand_name','gender','season','category','carton_id','dimensions','weight','location']);
        for (const [h, v] of Object.entries(row)) {
          const vs = String(v || '').trim();
          if (!vs || vs.length > 50) continue;
          const fieldInfo = mappings[h];
          if (fieldInfo && NON_COLOR_FIELDS.has(fieldInfo.field)) continue;
          const colorMatch = vs.match(new RegExp(`^${COLOR_RE.source}$`, 'i'));
          if (colorMatch) { rawColor = colorMatch[0].trim(); break; }
        }
      }
      // Pass 6: structural — pull the best color token out of every remaining cell string
      if (!rawColor) {
        let bestColorHit = '';
        for (const [h, v] of Object.entries(row)) {
          const fieldInfo = mappings[h];
          // Skip price, stock, size, and other numeric fields
          if (fieldInfo && ['wsp_usd','srp','cost','stock_total','moq','size_auto','size_range','carton_id'].includes(fieldInfo.field)) continue;
          const vs = String(v || '').trim();
          if (!vs || vs.length > 120) continue;
          const hit = extractColor(vs);
          if (hit && !bestColorHit) { bestColorHit = hit; }
        }
        if (bestColorHit) rawColor = bestColorHit;
      }

      // ── Step 2: detect combined price cell (e.g., "19.00 USD/49.00 USD") ──
      let wholesale = parseFloat(getField(row, 'wsp_usd')) || null;
      let srp       = parseFloat(getField(row, 'srp')) || 0;

      const priceCombinedRaw = getField(row, 'price_combined');
      if (priceCombinedRaw) {
        const pc = parsePriceCell(priceCombinedRaw);
        if (pc && pc.wsp_usd && pc.srp) { if (!wholesale) wholesale = pc.wsp_usd; if (!srp) srp = pc.srp; }
      }
      // Also try every unmapped cell that looks like a price pair
      if (!wholesale || !srp) {
        for (const [h, v] of Object.entries(row)) {
          if (!mappings[h] || !mappings[h].matched) {
            const pc = parsePriceCell(v);
            if (pc && pc.wsp_usd && pc.srp) {
              if (!wholesale) wholesale = pc.wsp_usd;
              if (!srp)       srp       = pc.srp;
              break;
            }
          }
        }
      }

      // ── Tiered wholesale detection ──────────────────────────────────────────
      // wsp_tier_high = "Wholesale Tier High — below MOQ" = standard single-unit price → wsp_usd
      // wsp_tier_low  = "Wholesale Tier Low — Bulk/MOQ+"  = bulk discount price         → tier_pricing only
      const tierHigh = parseFloat(getField(row, 'wsp_tier_high')) || null;
      const tierLow  = parseFloat(getField(row, 'wsp_tier_low'))  || null;
      let rowTierPricing = [];
      if (tierHigh !== null || tierLow !== null) {
        if (tierHigh !== null) rowTierPricing.push({ tier_name: 'Standard (Below MOQ)', wsp: tierHigh });
        if (tierLow  !== null) rowTierPricing.push({ tier_name: 'MOQ+ / Bulk',          wsp: tierLow  });
        // tierHigh is the authoritative base wsp_usd; fall back to tierLow only if high is absent
        if (!wholesale && tierHigh) wholesale = tierHigh;
        else if (!wholesale && tierLow) wholesale = tierLow;
      }

      // ── Step 3: size matrix from individual columns ─────────────────────────
      // activeSizeCols is now [{ header, label }] — supports any sizing system
      const sizes = {};
      activeSizeCols.forEach(({ header, label }) => {
        // For Antidote-mapped sizes use getField; for dynamic sizes read directly
        const raw = row[header] !== undefined ? row[header] : getField(row, header);
        const num = Number(raw);
        // Only accept non-negative integers (quantities); skip decimals (prices/weights)
        if (raw !== undefined && raw !== '' && Number.isFinite(num) && num >= 0 && Number.isInteger(num)) {
          if (num > 0) sizes[label] = num;
        }
      });

      // ── Step 4: size range from a size_range column or free-text cell ───────
      const sizeRangeRaw = getField(row, 'size_range');
      let sizeRangeParsed = {};
      if (sizeRangeRaw) {
        sizeRangeParsed = parseSizeRange(String(sizeRangeRaw)) || {};
      }
      // If no individual sizes found, use the range as a placeholder
      if (!Object.keys(sizes).length && Object.keys(sizeRangeParsed).length) {
        Object.assign(sizes, sizeRangeParsed);
      }
      // Last resort: scan every unmapped cell for a size range string
      // e.g. a cell with value "S-XXL" or "S/M, L, XL/XXL" that has no header match
      if (!Object.keys(sizes).length) {
        for (const [h, v] of Object.entries(row)) {
          if (mappings[h] && mappings[h].matched) continue; // already handled
          const sr = parseSizeRange(String(v || ''));
          if (sr && Object.keys(sr).length >= 2) { Object.assign(sizes, sr); break; }
        }
      }

      // ── Step 5: image URLs — collect from ALL mapped image columns ───────────
      // Multiple columns (Image 1, Image 2, Front Image, Back Image…) all map to
      // the image_url field in COLUMN_MAPS.  reverseMap['image_url'] lists every
      // originating header, so we scan them all and build a de-duped array.
      let imageUrls = [];
      const imgHeaders = reverseMap['image_url'] || [];
      imgHeaders.forEach(h => {
        const v = String(row[h] || '').trim();
        if (/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif|svg)/i.test(v) && !imageUrls.includes(v)) {
          imageUrls.push(v);
        }
      });
      if (!imageUrls.length) imageUrls = extractImageUrlsFromRow(row);

      // ── Step 6: category + gender normalisation ──────────────────────────────
      const gender   = normalizeGender(rawGender);
      // If no explicit category column, try structural fallback: scan unmapped cells
      // for a short, clean category-like string before falling back to title inference.
      let effectiveCategory = rawCategory;
      if (!effectiveCategory) {
        const KNOWN_CATS = /^(tops?|t-?shirts?|tees?|shirts?|hoodi|sweatshirt|knitwear|outerwear|jacket|coat|denim|jeans?|bottoms?|pants?|trousers?|shorts?|dress(?:es)?|skirts?|sets?|tracksuit|activewear|footwear|shoes?|boots?|accessories|bags?|headwear|hats?|caps?|lingerie|swimwear|suits?|jerseys?|uniforms?|general)$/i;
        for (const [h, v] of Object.entries(row)) {
          if (mappings[h]?.matched) continue;
          const vs = String(v || '').trim();
          if (vs.length > 0 && vs.length <= 30 && KNOWN_CATS.test(vs)) { effectiveCategory = vs; break; }
        }
      }
      const category = normalizeCategory(effectiveCategory, rawTitle, rawGender);

      // ── Step 7: derive stock ─────────────────────────────────────────────────
      // Rule: if individual size columns exist with actual quantities, the total
      // is ALWAYS their sum — overrides any "Total Stock" column value.
      // If only placeholder sizes (qty=0, from parseSizeRange text), fall back
      // to the mapped stock_total column, then to 0.
      const sizeQtys = Object.values(sizes).filter(v => Number(v) > 0);
      let stock_total;
      if (sizeQtys.length > 0) {
        // Real per-size quantities exist — total = sum
        stock_total = sizeQtys.reduce((a, b) => a + Number(b), 0);
      } else {
        // No individual size qtys — use mapped stock column or 0
        stock_total = parseInt(getField(row, 'stock_total')) || 0;
      }

      // ── Step 8: build product_notes from unmapped columns + any raw description ─
      // Collect every column that wasn't matched to a known field — concatenate as
      // "Header: value" pairs to preserve context (material, care, fit notes, etc.)
      const unmappedParts = [];
      for (const [h, v] of Object.entries(row)) {
        if (!mappings[h] || !mappings[h].matched) {
          const val = String(v || '').trim();
          if (val && val.length > 1 && !/^\d+(\.\d+)?$/.test(val)) { // skip pure numbers
            unmappedParts.push(`${h}: ${val}`);
          }
        }
      }
      const rawNotes   = String(getField(row, 'description') || '').trim();
      const description = [rawNotes, ...unmappedParts].filter(Boolean).join(' | ')
        || generateRichDescription(rawTitle, category, rawColor, rawSeason);

      // ── Step 9: SKU fallback — scan all cells for a style-code pattern ─────
      let rowSku = String(getField(row, 'sku') || '').trim();
      if (!rowSku) {
        for (const v of Object.values(row)) {
          const extracted = extractSkuFromText(String(v || ''));
          if (extracted) { rowSku = extracted; break; }
        }
      }
      // ── Step 9b: Auto-generate SKU if still missing ───────────────────────
      // Build a partial product object with what we know so far so generateSku
      // can compute brand / gender / category / initials / color codes.
      if (!rowSku) {
        rowSku = generateSku(
          { description: rawTitle, gender, category, color: rawColor, brand_name: uploadBrandCode || 'Brand' },
          uploadBrandCode,
          uploadUsedSkus,
          uploadSeqMap
        );
      } else {
        uploadUsedSkus.add(rowSku); // track existing skus so generated ones don't clash
      }

      // ── sizes safety: always a plain serialisable object ──────────────────────
      let safeSizes = sizes;
      if (typeof safeSizes === 'string') {
        try { safeSizes = JSON.parse(safeSizes); } catch { safeSizes = {}; }
      }
      if (!safeSizes || typeof safeSizes !== 'object' || Array.isArray(safeSizes)) safeSizes = {};

      // ── WSP derivation: if still null after all price detection, derive from SRP ─
      if (!wholesale && srp > 0) wholesale = parseFloat((srp * 0.5).toFixed(2));

      // Product notes: use rawDescCol as description copy if it's the long text version,
      // otherwise use the auto-generated rich description
      const longCopy = (rawName && rawDescCol && !rawColor.includes(rawDescCol))
        ? rawDescCol   // rawDescCol has real description copy
        : description; // unmapped cols or auto-generated

      // ── Step 10: showroom geocoding ──────────────────────────────────────────
      const rawShowroomCity = String(getField(row, 'showroom_city') || '').trim();
      let showroomCity = rawShowroomCity || FASHION_HUB_DEFAULT.city;
      let showroomLat  = FASHION_HUB_DEFAULT.lat;
      let showroomLng  = FASHION_HUB_DEFAULT.lng;
      let showroomTag  = FASHION_HUB_DEFAULT.tag;
      if (rawShowroomCity) {
        const key = rawShowroomCity.toLowerCase().trim();
        const hub = FASHION_HUB_COORDS[key]
          // partial match: check if any hub key is contained in the raw value
          || Object.entries(FASHION_HUB_COORDS).find(([k]) => key.includes(k) || k.includes(key))?.[1];
        if (hub) {
          showroomLat = hub.lat;
          showroomLng = hub.lng;
          showroomTag = hub.tag;
        }
        // keep user-supplied city name even if coords not found
      }

      const prod = {
        description  : rawTitle,   // product name / style title → DB description column
        sku          : rowSku,
        color        : rawColor,
        gender,                    // normalised: Men / Women / Boys / Girls / Unisex
        season       : rawSeason,
        category,
        wsp_usd       : wholesale ?? 0,
        srp    : srp,
        cost          : parseFloat(getField(row, 'cost')) || null,
        stock_total   : Math.floor(Math.max(0, stock_total)),  // crash-proof integer
        moq           : Math.max(1, Math.round(parseFloat(getField(row, 'moq')) || 1)),
        sizes         : safeSizes,
        image_urls    : imageUrls,
        tags          : [...new Set([
          rawTitle.toLowerCase().split(/\s+/)[0],
          rawColor ? rawColor.toLowerCase().split(/\s+/)[0] : null,
          category.toLowerCase()
        ].filter(Boolean))],
        brand_name       : rawBrandName || 'Brand Name',
        brand_id         : 1,
        margin           : 0.5,
        tier_pricing     : rowTierPricing,
        product_notes    : longCopy,
        material         : rawMaterial || null,
        delivery_window  : rawDelivery || null,
        showroom_city    : showroomCity,
        latitude         : showroomLat,
        longitude        : showroomLng,
        event_tag        : showroomTag,
      };

      if (!prod.sku) delete prod.sku;
      products.push(prod);
    });
  }

  // ── Attach embedded images to products ──────────────────────────────────────
  let embeddedCount = 0;
  if (embeddedImages.length && products.length) {
    const toUpload = embeddedImages.slice(0, MAX_IMAGES_PER_IMPORT);
    console.log(`[Images] Uploading ${toUpload.length} embedded XLSX image(s)…`);

    const uploadResults = await Promise.allSettled(
      toUpload.map(img => uploadProductImage(img.buffer, {
        sku    : products[img.dataRowIndex]?.sku || `row${img.dataRowIndex}`,
        brandId: 1,
        mimeType: img.mimeType,
      }))
    );

    uploadResults.forEach((result, i) => {
      const img = toUpload[i];
      if (result.status === 'fulfilled' && result.value) {
        const prod = products[img.dataRowIndex];
        if (prod) {
          if (!prod.image_urls) prod.image_urls = [];
          if (!prod.image_urls.includes(result.value)) {
            prod.image_urls.unshift(result.value);
            embeddedCount++;
          }
        }
      }
    });
    if (embeddedCount) console.log(`[Images] Uploaded ${embeddedCount} embedded image(s)`);
  }

  // ── Fetch & store external image URLs found in image_url columns ─────────────
  // Some linesheets have Dropbox/Drive/CDN URLs in image columns — download &
  // re-host on Supabase Storage so buyers always get a fast, permanent URL.
  let urlFetchCount = 0;
  {
    const urlFetchJobs = products.map(async prod => {
      if (!prod.image_urls?.length) return;
      const fetched = await Promise.all(
        prod.image_urls.map(u => fetchAndStoreImageUrl(u, { sku: prod.sku || '', brandId: 1 }))
      );
      const newUrls = fetched.filter(Boolean);
      if (newUrls.length) { prod.image_urls = [...new Set(newUrls)]; urlFetchCount++; }
    });
    await Promise.allSettled(urlFetchJobs);
  }
  if (urlFetchCount) console.log(`[Images] Stored ${urlFetchCount} external URL image(s)`);

  // ── Return staged drafts — NO Supabase write here.
  // Brand reviews/edits in the UI, then hits POST /api/inventory/bulk-insert to commit.
  console.log(`📥 Smart Sync [STAGE ${detectedType}]: ${rawRows.length} rows → ${products.length} products | ${matchedCount}/${rawHeaders.length} cols mapped (${confidence}%) | ${embeddedCount} images`);

  res.json({
    message      : `Staged — ${detectedType.replace('_',' ')} · ${products.length} products · ${confidence}% confidence${embeddedCount ? ` · ${embeddedCount} images extracted` : ''}`,
    detectedType,
    mappings,
    confidence,
    total_rows   : rawRows.length,
    products,
    embedded_images: embeddedCount,
    packingRows  : detectedType === 'packing_list' ? packingRows : undefined,
    staged       : true,
    size_labels  : activeSizeCols.map(c => c.label),
    raw_rows     : rawRows.slice(0, 200).map(r => {
      // Strip any binary / Buffer values that would bloat the JSON payload
      const safe = {};
      Object.entries(r).forEach(([k, v]) => {
        if (Buffer.isBuffer(v) || (v && typeof v === 'object' && v.type === 'Buffer')) return;
        safe[k] = v;
      });
      return safe;
    }),
    hasTieredPricing: products.some(p => Array.isArray(p.tier_pricing) && p.tier_pricing.length > 0),
  });
});

// ─── Smart Sync — Commit reviewed products to Supabase ────────────────────────
// Called by the dashboard Review Screen after the user edits & confirms products.
// ─── Single product image upload (manual swap in staging table) ───────────────
const imageUpload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: { fileSize: 10 * 1024 * 1024 },  // 10 MB
  fileFilter(req, file, cb) {
    if (/^image\/(jpeg|png|webp|gif|bmp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are accepted'));
  },
});

// ─── Upload Remap — re-process raw_rows with user-corrected column mappings ────
// ─── /api/upload/remap — re-run full extraction pipeline with user overrides ──
// Identical processing to smart-sync but starts from already-parsed raw_rows
// and applies user-supplied column-mapping overrides on top of auto-detection.
app.post('/api/upload/remap', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { raw_rows, overrides = {}, brandCode = '' } = req.body;
    if (!Array.isArray(raw_rows) || !raw_rows.length)
      return res.status(400).json({ error: 'raw_rows required' });

    const rawHeaders = Object.keys(raw_rows[0]);

    // ── 1. Build merged mappings: auto-detect then apply overrides ────────────
    const mappings = {};
    let matchedCount = 0;
    rawHeaders.forEach(h => {
      const ov = overrides[h];
      if (ov === 'skip') {
        mappings[h] = { field: h, matched: false, method: 'none' }; return;
      }
      if (ov) {
        mappings[h] = { field: ov, matched: true, method: 'override' };
        matchedCount++; return;
      }
      // Run full 5-pass Antidote mapper (Pass 0 handles size tokens)
      const raw  = String(h).toLowerCase().trim();
      const norm = raw.replace(/[_\-\/\\|.]+/g,' ').replace(/\s+/g,' ').trim();
      let matched = null, method = null, score = null;

      // Pre-pass: tiered wholesale
      if (/wholesale\s*\d+\s*%/i.test(raw) || /wsp\s*\d+\s*%/i.test(raw)) {
        const pct = parseInt((raw.match(/(\d+)\s*%/)||[])[1]||'0');
        matched = pct >= 38 ? 'wsp_tier_high' : 'wsp_tier_low'; method = 'exact';
      }
      // Pass 0: size token
      if (!matched && headerSizeLabel(h)) {
        for (const [key, aliases] of Object.entries(COLUMN_MAPS)) {
          if (EXACT_ONLY_COLS.has(key) && (aliases.includes(norm) || aliases.includes(raw)))
            { matched = key; method = 'exact'; break; }
        }
        if (!matched) { matched = 'size_auto'; method = 'size-auto'; }
      }
      if (!matched) matched = findBestMatch(h);

      // Pass 6: Value-type inference validation
      if (method && method !== 'exact' && method !== 'size-auto' && method !== 'abbrev-exact') {
        const colVals = raw_rows.map(r => r[h]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
        const inferred = inferColumnType(h, colVals);
        if (inferred.field && inferred.field !== matched && inferred.confidence >= 0.72) {
          if (inferred.field === 'price') {
            if (!['wsp_usd','srp','cost','wsp_tier_high','wsp_tier_low','price'].includes(matched)) {
              matched = null; method = null; score = null;
            }
          } else if (['sku','color','image_url','size_auto','product_notes'].includes(inferred.field)) {
            matched = inferred.field; method = 'value-inferred'; score = +(inferred.confidence.toFixed(2));
          }
        }
      }
      if (!matched) {
        const colVals = raw_rows.map(r => r[h]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
        const inferred = inferColumnType(h, colVals);
        if (inferred.field && inferred.field !== 'price' && inferred.confidence >= 0.72) {
          matched = inferred.field; method = 'value-inferred'; score = +(inferred.confidence.toFixed(2));
        }
      }

      if (matched) {
        mappings[h] = { field: matched, matched: true, method: method||'auto', ...(score ? { score } : {}), sampleValues: raw_rows.map(r => String(r[h]??'').trim()).filter(v=>v!=='').slice(0,3) };
        matchedCount++;
      } else {
        const autoSkip = shouldAutoSkipColumn(h, raw_rows);
        mappings[h] = {
          field       : autoSkip ? 'skip' : h,
          matched     : false,
          method      : autoSkip ? 'auto-skip' : 'none',
          ...(autoSkip ? { autoSkipped: true } : {}),
          sampleValues: raw_rows.map(r => String(r[h]??'').trim()).filter(v=>v!=='').slice(0,3),
        };
      }
    });
    const confidence = Math.round(matchedCount / rawHeaders.length * 100);

    // ── 2. reverseMap + getField ──────────────────────────────────────────────
    const reverseMap = {};
    Object.entries(mappings).forEach(([h, v]) => {
      if (!reverseMap[v.field]) reverseMap[v.field] = [];
      reverseMap[v.field].push(h);
    });
    const getField = (row, fieldName) => {
      for (const h of (reverseMap[fieldName] || [])) {
        const v = row[h];
        if (v !== undefined && v !== '' && v !== null) return v;
      }
      return undefined;
    };

    // ── 3. Build activeSizeCols ───────────────────────────────────────────────
    const activeSizeCols = [];
    const sizeHeadersSeen = new Set();
    // Pass A: Antidote-mapped size_* fields
    rawHeaders.forEach(h => {
      const info = mappings[h];
      if (info?.matched && ANTIDOTE_SIZE_FIELDS[info.field]) {
        const label = ANTIDOTE_SIZE_FIELDS[info.field];
        if (!sizeHeadersSeen.has(h)) { activeSizeCols.push({ header: h, label }); sizeHeadersSeen.add(h); }
      }
    });
    // Pass B/C: size_auto columns (manual override OR dynamic detection)
    rawHeaders.forEach(h => {
      if (sizeHeadersSeen.has(h)) return;
      const info = mappings[h];
      if (info?.field !== 'size_auto') return;
      const label = headerSizeLabel(h);
      if (label) { activeSizeCols.push({ header: h, label }); sizeHeadersSeen.add(h); }
    });

    // ── 4. Build products using the same extraction logic as smart-sync ───────
    const uploadUsedSkus = new Set();
    const uploadSeqMap   = {};
    const uploadBrandCode = String(brandCode || '').trim();

    const products = raw_rows.map((row, idx) => {
      // Name / title
      const classification = classifyRow(row, mappings, reverseMap, activeSizeCols);
      if (!classification.isProduct) return null;
      const rawName    = String(getField(row, 'name')        || '').trim();
      const rawDescCol = String(getField(row, 'description') || '').trim();
      const rawTitle   = rawName || rawDescCol;

      // Color — same multi-layer fallback as smart-sync
      let rawColor = String(getField(row, 'color') || '').trim();
      if (!rawColor) rawColor = extractColor(rawTitle + ' ' + rawDescCol);
      if (!rawColor && rawDescCol) {
        const descWords = rawDescCol.split(/\s+/).length;
        if (descWords <= 6 && /^[\w\s\-\/&]+$/.test(rawDescCol) && COLOR_RE.test(rawDescCol))
          rawColor = rawDescCol;
      }
      if (!rawColor) {
        for (const [h, v] of Object.entries(row)) {
          const vs = String(v||'').trim();
          if (!vs || vs.length > 40) continue;
          if (vs.split(/\s+/).length <= 4 && COLOR_RE.test(vs) && !mappings[h]?.matched)
            { rawColor = vs; break; }
        }
      }
      // Pass 5: full-value color phrase in any non-semantic cell
      if (!rawColor) {
        const NON_COLOR_FIELDS = new Set(['name','description','sku','wsp_usd','srp','cost','stock_total','moq','size_range','size_auto','image_url','product_notes','material','delivery_window','brand_name','gender','season','category','carton_id','dimensions','weight','location']);
        for (const [h, v] of Object.entries(row)) {
          const vs = String(v||'').trim();
          if (!vs || vs.length > 50) continue;
          if (mappings[h] && NON_COLOR_FIELDS.has(mappings[h].field)) continue;
          const colorMatch = vs.match(new RegExp(`^${COLOR_RE.source}$`, 'i'));
          if (colorMatch) { rawColor = colorMatch[0].trim(); break; }
        }
      }
      // Pass 6: structural token scan across all remaining cells
      if (!rawColor) {
        for (const [h, v] of Object.entries(row)) {
          if (mappings[h] && ['wsp_usd','srp','cost','stock_total','moq','size_auto','size_range','carton_id'].includes(mappings[h].field)) continue;
          const vs = String(v||'').trim();
          if (!vs || vs.length > 120) continue;
          const hit = extractColor(vs);
          if (hit) { rawColor = hit; break; }
        }
      }

      // Pricing — SRP, WSP, combined cell, tiered
      let wholesale = parseFloat(getField(row, 'wsp_usd')) || null;
      let srp       = parseFloat(getField(row, 'srp'))     || 0;
      const priceCombinedRaw = getField(row, 'price_combined');
      if (priceCombinedRaw) {
        const pc = parsePriceCell(priceCombinedRaw);
        if (pc) { if (!wholesale) wholesale = pc.wsp_usd; if (!srp) srp = pc.srp; }
      }
      if (!wholesale || !srp) {
        for (const [h, v] of Object.entries(row)) {
          if (!mappings[h]?.matched) {
            const pc = parsePriceCell(v);
            if (pc) { if (!wholesale) wholesale = pc.wsp_usd; if (!srp) srp = pc.srp; break; }
          }
        }
      }
      const tierHigh = parseFloat(getField(row, 'wsp_tier_high')) || null;
      const tierLow  = parseFloat(getField(row, 'wsp_tier_low'))  || null;
      let rowTierPricing = [];
      if (tierHigh !== null || tierLow !== null) {
        if (tierHigh !== null) rowTierPricing.push({ tier_name: 'Standard (Below MOQ)', wsp: tierHigh });
        if (tierLow  !== null) rowTierPricing.push({ tier_name: 'MOQ+ / Bulk',          wsp: tierLow  });
        // tierHigh is the authoritative base wsp_usd; fall back to tierLow only if high is absent
        if (!wholesale && tierHigh) wholesale = tierHigh;
        else if (!wholesale && tierLow) wholesale = tierLow;
      }
      if (!wholesale && srp > 0) wholesale = parseFloat((srp * 0.5).toFixed(2));

      // Sizes — read individual size columns
      const sizes = {};
      activeSizeCols.forEach(({ header, label }) => {
        const val = row[header] !== undefined ? row[header] : getField(row, header);
        const num = Number(val);
        if (val !== undefined && val !== '' && Number.isFinite(num) && num >= 0 && Number.isInteger(num) && num > 0)
          sizes[label] = num;
      });
      // Fallback: parse size_range column
      if (!Object.keys(sizes).length) {
        const srRaw = getField(row, 'size_range');
        if (srRaw) Object.assign(sizes, parseSizeRange(String(srRaw)) || {});
      }

      // Stock
      const sizeQtys = Object.values(sizes).filter(v => Number(v) > 0);
      const stock_total = sizeQtys.length
        ? sizeQtys.reduce((a, b) => a + Number(b), 0)
        : parseInt(getField(row, 'stock_total')) || 0;

      // Category + gender + season
      const rawCategory = String(getField(row, 'category') || '').trim();
      const rawGender   = String(getField(row, 'gender')   || '').trim();
      const rawSeason   = String(getField(row, 'season')   || '').trim();
      // Category structural fallback: check unmapped cells for a known category keyword
      let effectiveCategoryR = rawCategory;
      if (!effectiveCategoryR) {
        const KNOWN_CATS_R = /^(tops?|t-?shirts?|tees?|shirts?|hoodi|sweatshirt|knitwear|outerwear|jacket|coat|denim|jeans?|bottoms?|pants?|trousers?|shorts?|dress(?:es)?|skirts?|sets?|tracksuit|activewear|footwear|shoes?|boots?|accessories|bags?|headwear|hats?|caps?|lingerie|swimwear|suits?|jerseys?|uniforms?|general)$/i;
        for (const [h, v] of Object.entries(row)) {
          if (mappings[h]?.matched) continue;
          const vs = String(v||'').trim();
          if (vs.length > 0 && vs.length <= 30 && KNOWN_CATS_R.test(vs)) { effectiveCategoryR = vs; break; }
        }
      }
      const category    = normalizeCategory(effectiveCategoryR, rawTitle, rawGender);
      const gender      = normalizeGender(rawGender);

      // Material / delivery / brand
      const rawMaterial = String(getField(row, 'material')        || '').trim();
      const rawDelivery = String(getField(row, 'delivery_window') || rawSeason || '').trim();
      const rawBrandName= String(getField(row, 'brand_name')      || '').trim();

      // SKU
      let rowSku = String(getField(row, 'sku') || '').trim();
      if (!rowSku) {
        for (const v of Object.values(row)) {
          const ex = extractSkuFromText(String(v||''));
          if (ex) { rowSku = ex; break; }
        }
      }
      if (!rowSku) rowSku = generateSku(
        { description: rawTitle, gender, category, color: rawColor, brand_name: uploadBrandCode || 'Brand' },
        uploadBrandCode, uploadUsedSkus, uploadSeqMap
      );
      else uploadUsedSkus.add(rowSku);

      // Notes
      const notes = String(getField(row, 'product_notes') || rawDescCol || '').trim()
        || generateRichDescription(rawTitle, category, rawColor, rawSeason);

      // Image URLs — collect from all mapped image_url columns
      const imageUrls = [];
      (reverseMap['image_url'] || []).forEach(h => {
        const v = String(row[h]||'').trim();
        if (/^https?:\/\//i.test(v) && !imageUrls.includes(v)) imageUrls.push(v);
      });

      return {
        description   : rawTitle,
        sku           : rowSku,
        color         : rawColor,
        gender,
        season        : rawSeason,
        category,
        wsp_usd       : wholesale ?? 0,
        srp,
        cost          : parseFloat(getField(row, 'cost')) || null,
        stock_total   : Math.floor(Math.max(0, stock_total)),
        moq           : Math.max(1, Math.round(parseFloat(getField(row, 'moq')) || 1)),
        sizes,
        image_urls    : imageUrls,
        tags          : [...new Set([rawTitle.toLowerCase().split(/\s+/)[0], rawColor?.toLowerCase().split(/\s+/)[0], category.toLowerCase()].filter(Boolean))],
        brand_name    : rawBrandName || uploadBrandCode || 'Brand Name',
        brand_id      : 1,
        margin        : 0.5,
        tier_pricing  : rowTierPricing,
        product_notes : notes,
        material      : rawMaterial || null,
        delivery_window: rawDelivery || null,
        status        : 'draft',
        _row          : idx + 2,
      };
    }).filter(Boolean);

    // Fetch & re-host any external image URLs found in image_url columns
    await Promise.allSettled(products.map(async prod => {
      if (!prod.image_urls?.length) return;
      const fetched = await Promise.all(
        prod.image_urls.map(u => fetchAndStoreImageUrl(u, { sku: prod.sku || '', brandId: 1 }))
      );
      prod.image_urls = [...new Set(fetched.filter(Boolean))];
    }));

    res.json({
      products,
      mappings,
      confidence,
      size_labels: activeSizeCols.map(c => c.label),
      hasTieredPricing: products.some(p => p.tier_pricing?.length > 0),
    });
  } catch (err) {
    console.error('❌ /api/upload/remap:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload/product-image', imageUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided.' });
  const fs = require('fs');
  try {
    const buffer  = fs.readFileSync(req.file.path);
    const sku     = String(req.body.sku || Date.now()).replace(/[^a-z0-9_\-]/gi, '_');
    const brandId = parseInt(req.body.brand_id) || 1;
    const url     = await uploadProductImage(buffer, { sku, brandId, mimeType: req.file.mimetype });
    fs.unlink(req.file.path, () => {});
    if (!url) return res.status(500).json({ error: 'Image upload failed — check that the product-images bucket exists in Supabase Storage.' });
    res.json({ url });
  } catch (err) {
    try { require('fs').unlink(req.file.path, () => {}); } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload/smart-sync/commit', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided.' });
    }
    const dbResult = await dbUpsertProducts(products);
    console.log(`📥 Smart Sync Commit: ${products.length} submitted → ${dbResult.inserted} saved`);
    res.json({ success: true, saved: dbResult.inserted, errors: dbResult.errors });
  } catch (err) {
    console.error('❌ /api/upload/smart-sync/commit:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Inventory — Bulk Insert (final commit from staging UI) ──────────────────
// Called when brand clicks "Confirm & Import Live" after reviewing staged drafts.
// Crash-protection: drops rows with empty SKU, forces stock_total to integer.
app.post('/api/inventory/bulk-insert', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products provided.' });
    }

    // ── Sanitise & guard every row ──────────────────────────────────────────
    const skippedErrors = [];
    const clean = products
      .filter((p, idx) => {
        const sku = String(p.sku || '').trim();
        if (!sku) {
          const msg = `Row ${idx + 1} "${p.description || 'Untitled'}" — missing SKU (not imported)`;
          console.warn(`⚠️  bulk-insert: ${msg}`);
          skippedErrors.push(msg);
          return false;
        }
        return true;
      })
      .map(p => {
        // Spread every staged field so nothing is silently dropped.
        // sanitiseRow() will strip columns not confirmed in DB_COLUMNS.
        const row = {
          ...p,
          // Numeric coercions
          stock_total     : Math.floor(Math.max(0, parseFloat(p.stock_total ?? p.stock) || 0)),
          wsp_usd         : parseFloat(p.wsp_usd)  || 0,
          srp             : parseFloat(p.srp)       || 0,
          moq             : Math.max(1, Math.floor(parseFloat(p.moq) || 1)),
          cost            : p.cost != null ? (parseFloat(p.cost) || null) : null,
          margin          : parseFloat(p.margin)    || 0.5,
          // JSONB fields — ensure correct types before sanitise
          sizes           : (typeof p.sizes === 'object' && !Array.isArray(p.sizes) && p.sizes)
                              ? p.sizes : {},
          tier_pricing    : Array.isArray(p.tier_pricing) ? p.tier_pricing
                            : (typeof p.tier_pricing === 'string'
                                ? (() => { try { return JSON.parse(p.tier_pricing); } catch { return []; } })()
                                : []),
          image_urls      : Array.isArray(p.image_urls) ? p.image_urls : [],
          // String fields passed through verbatim
          description     : String(p.description     || '').trim(),
          color           : String(p.color           || '').trim(),
          gender          : String(p.gender          || 'Unisex').trim(),
          season          : String(p.season          || '').trim(),
          category        : String(p.category        || 'GENERAL').trim(),
          brand_name      : String(p.brand_name      || '').trim(),
          material        : p.material       ? String(p.material).trim()       : null,
          delivery_window : p.delivery_window? String(p.delivery_window).trim(): null,
          product_notes   : String(p.product_notes   || '').trim(),
        };
        return row;
      });

    if (!clean.length) {
      return res.status(400).json({
        error  : 'All rows were filtered out (empty SKUs). Add SKUs in the staging table and try again.',
        skipped: skippedErrors,
      });
    }

    const dbResult = await dbUpsertProducts(clean);
    const allErrors = [...skippedErrors, ...dbResult.errors];
    if (allErrors.length) console.warn('⚠️  bulk-insert issues:', allErrors);
    console.log(`✅ bulk-insert: ${products.length} submitted → ${clean.length} attempted → ${dbResult.inserted} saved to Supabase`);

    res.json({
      success  : true,
      submitted: products.length,
      attempted: clean.length,
      saved    : dbResult.inserted,
      errors   : allErrors,
    });
  } catch (err) {
    console.error('❌ /api/inventory/bulk-insert:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Staging — Verify product data quality before commit ─────────────────────
app.post('/api/upload/stage/verify', (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) return res.status(400).json({ error: 'products array required' });

    const issues = products.map((p, i) => {
      const warnings = [];
      if (!p.description || !String(p.description).trim()) warnings.push('Missing product name');
      if (!p.sku || !String(p.sku).trim())                 warnings.push('No SKU — will be auto-assigned');
      const srp = parseFloat(p.srp ?? p.srp_usd)  || 0;
      const wsp = parseFloat(p.wsp_usd)                   || 0;
      if (!srp && !wsp)          warnings.push('No pricing data');
      if (wsp > 0 && srp > 0 && wsp > srp) warnings.push(`Inverted prices: WSP $${wsp} > SRP $${srp}`);
      const stockVal = parseInt(p.stock_total ?? p.stock) || 0;
      if (stockVal === 0)        warnings.push('Zero stock');
      if (!p.category || p.category === 'GENERAL') warnings.push('Category not identified');
      if (!p.image_urls || !p.image_urls.length)   warnings.push('No image');
      return { row: p._row || i + 1, description: p.description || '—', warnings };
    });

    const skuMap = {};
    products.forEach((p, i) => {
      const sku = String(p.sku || '').trim();
      if (!sku) return;
      if (skuMap[sku] === undefined) skuMap[sku] = [];
      skuMap[sku].push(i);
    });
    const dupSkus = Object.entries(skuMap).filter(([, idxs]) => idxs.length > 1);
    dupSkus.forEach(([sku, idxs]) => {
      idxs.forEach(i => {
        if (!issues[i].warnings.includes(`Duplicate SKU: ${sku}`))
          issues[i].warnings.push(`Duplicate SKU: ${sku}`);
      });
    });

    const totalWarnings = issues.reduce((s, r) => s + r.warnings.length, 0);
    const cleanProducts = issues.filter(r => r.warnings.length === 0).length;
    const score = Math.round((cleanProducts / products.length) * 100);

    res.json({
      total: products.length,
      clean: cleanProducts,
      warnings: totalWarnings,
      score,
      issues: issues.filter(r => r.warnings.length > 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Linesheet Export ──────────────────────────────────────────────────────────
app.post('/api/linesheets/export', async (req, res) => {
  try {
    const { productIds, brandName } = req.body;
    const ids      = (productIds || []).map(String);
    const rawData  = ids.length ? await dbGetInventory({ ids }) : await dbGetInventory();
    const selected = rawData.map(formatProduct);
    res.json({
      linesheet: {
        brand          : brandName || 'Linezheets Brand',
        generated      : new Date().toISOString(),
        products       : selected,
        total_wholesale: selected.reduce((s, p) => s + parseFloat(p.wsp_usd||p.wholesale_usd||0), 0).toFixed(2),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Inventory — Update a product ─────────────────────────────────────────────
app.patch('/api/inventory/:id', async (req, res) => {
  try {
    const id      = req.params.id;
    const updates = { ...req.body };

    // Enforce SRP >= WSP before saving
    let srp = parseFloat(updates.srp_usd);
    let wsp = parseFloat(updates.wsp_usd ?? updates.wholesale_usd);
    if (!isNaN(srp) && !isNaN(wsp) && srp > 0 && wsp > 0) {
      if (wsp > srp) { const tmp = wsp; wsp = srp; srp = tmp; }
      updates.srp_usd       = srp;
      updates.wsp_usd = wsp; updates.wholesale_usd = wsp;
      updates.margin        = parseFloat((wsp / srp).toFixed(4));
    } else if (!isNaN(wsp) && wsp > 0 && (isNaN(srp) || srp === 0)) {
      const ratio = parseFloat(updates.margin) || 0.50;
      updates.srp_usd       = parseFloat((wsp / ratio).toFixed(2));
      updates.wsp_usd = wsp; updates.wholesale_usd = wsp;
      updates.margin        = ratio;
    } else if (!isNaN(srp) && srp > 0 && (isNaN(wsp) || wsp === 0)) {
      const ratio = parseFloat(updates.margin) || 0.50;
      updates.wholesale_usd = parseFloat((srp * ratio).toFixed(2));
      updates.srp_usd       = srp;
      updates.margin        = ratio;
    }

    // Seed fallback
    if (!supabase) {
      const p = SEED_INVENTORY.find(p => p.id === parseInt(id));
      if (!p) return res.status(404).json({ error: 'Product not found' });
      Object.assign(p, updates);
      return res.json({ success: true, product: formatProduct(p) });
    }

    const clean = sanitiseRow(updates);
    const { data, error } = await supabase
      .from('inventory')
      .update(clean)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, product: formatProduct(data) });
  } catch (err) {
    console.error('❌ PATCH /api/inventory/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Inventory — Delete a product ─────────────────────────────────────────────
app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // Seed fallback
    if (!supabase) {
      const idx = SEED_INVENTORY.findIndex(p => p.id === parseInt(id));
      if (idx === -1) return res.status(404).json({ error: 'Product not found' });
      SEED_INVENTORY.splice(idx, 1);
      return res.json({ success: true });
    }

    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ DELETE /api/inventory/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Analytics: Track product views ──────────────────────────────────────────
// In-memory store (replaced by Supabase table when available)
const _viewCounts = {}; // { product_id: { views: N, unique_buyers: Set } }

app.post('/api/analytics/view', (req, res) => {
  const { product_id, buyer_id } = req.body || {};
  if (!product_id) return res.status(400).json({ error: 'product_id required' });
  if (!_viewCounts[product_id]) _viewCounts[product_id] = { views: 0, unique_buyers: new Set() };
  _viewCounts[product_id].views++;
  if (buyer_id) _viewCounts[product_id].unique_buyers.add(buyer_id);
  res.json({ ok: true });
});

app.get('/api/analytics/views', (req, res) => {
  // Return summary for brand dashboard
  const summary = Object.entries(_viewCounts).map(([product_id, data]) => ({
    product_id,
    views: data.views,
    unique_buyers: data.unique_buyers.size,
  })).sort((a, b) => b.views - a.views);
  res.json({ analytics: summary });
});

app.get('/api/analytics/views/:productId', (req, res) => {
  const d = _viewCounts[req.params.productId];
  res.json({ product_id: req.params.productId, views: d?.views || 0, unique_buyers: d?.unique_buyers.size || 0 });
});

// ─── AI Enhance — per-product AI suggestions ──────────────────────────────────
/**
 * POST /api/ai/enhance-product
 * Body: { product: { description, sku, color, gender, category, wsp_usd, srp,
 *                    material, season, sizes, product_notes },
 *         brandCode: string,   // optional brand prefix for SKU
 *         fields: ['sku','pricing','description']  // which to enhance (default: all)
 *       }
 * Returns: { sku, sku_reasoning, wsp_usd, srp, price_reasoning, description, description_reasoning }
 *
 * When ANTHROPIC_API_KEY is not set, returns rule-based fallbacks so the UI
 * always gets a useful response.
 */
app.post('/api/ai/enhance-product', async (req, res) => {
  try {
    const { product = {}, brandCode = '', fields = ['sku', 'pricing', 'description'] } = req.body;
    if (!product || !product.description) {
      return res.status(400).json({ error: 'product.description is required' });
    }

    const wantSku   = fields.includes('sku');
    const wantPrice = fields.includes('pricing');
    const wantDesc  = fields.includes('description');

    // ── Rule-based fallbacks (always available) ──────────────────────────────
    const fallbackSku  = product.sku || generateSku(
      { description: product.description, gender: product.gender || 'Unisex',
        category: product.category || 'GENERAL', color: product.color || '',
        brand_name: brandCode || 'Brand' },
      brandCode, new Set(), {}
    );

    // Pricing fallback: if both missing derive from each other at 50% margin
    const fbRetail = parseFloat(product.srp) || 0;
    const fbWsp    = parseFloat(product.wsp_usd)    || (fbRetail ? +(fbRetail * 0.5).toFixed(2) : 0);
    const fbRetail2 = fbRetail || (fbWsp ? +(fbWsp * 2).toFixed(2) : 0);

    if (!anthropic) {
      // No API key — return rule-based only
      return res.json({
        sku               : wantSku   ? fallbackSku  : product.sku,
        sku_reasoning     : 'Rule-based generation (no AI key configured)',
        wsp_usd           : wantPrice ? fbWsp        : product.wsp_usd,
        srp        : wantPrice ? fbRetail2    : product.srp,
        price_reasoning   : 'Standard 50% wholesale margin applied',
        description       : wantDesc  ? (product.product_notes || product.description) : product.product_notes,
        description_reasoning: 'Original text returned (no AI key configured)',
        ai_powered        : false,
      });
    }

    // ── Build Claude prompt ──────────────────────────────────────────────────
    const fieldInstructions = [
      wantSku   && `"sku": "<generated code>",\n  "sku_reasoning": "<1 sentence>"`,
      wantPrice && `"wsp_usd": <number>,\n  "srp": <number>,\n  "price_reasoning": "<1-2 sentences explaining the price positioning>"`,
      wantDesc  && `"description": "<professional wholesale product description, 2-4 sentences, trade tone, no fluff>",\n  "description_reasoning": "<1 sentence>"`,
    ].filter(Boolean).join(',\n  ');

    const skuInstructions = wantSku ? `
SKU FORMAT: ${brandCode ? `Brand prefix = "${brandCode.toUpperCase()}"` : 'Use first 1-2 letters of brand name'}, then gender code (MW/WW/BW/GW/UN), category code (HD=Hoodies,TS=T-Shirts,TP=Tops,SH=Shirts,SW=Sweatshirts,KN=Knitwear,OW=Outerwear,DN=Denim,BT=Bottoms,DS=Dresses,ST=Sets,FW=Footwear,HW=Headwear,AC=Accessories), 2-letter product initials (significant words only), 2-letter color code (BL=Black,WH=White,GR=Grey,NV=Navy,RD=Red,BU=Blue…), then 01.
Example: FMWHDBZBL01 (F=Finellie, MW=Menswear, HD=Hoodie, BZ=Birds Zipper, BL=Black, 01=sequence)` : '';

    const prompt = `You are an expert fashion wholesale product data specialist. Analyse the product below and return ONLY valid JSON with the requested fields.

PRODUCT DATA:
- Name / Style: ${product.description || ''}
- SKU provided: ${product.sku || '(none)'}
- Color: ${product.color || ''}
- Gender: ${product.gender || ''}
- Category: ${product.category || ''}
- Material: ${product.material || ''}
- Season: ${product.season || ''}
- Current WSP: ${product.wsp_usd || '(unknown)'}
- Current SRP: ${product.srp || '(unknown)'}
- Sizes: ${JSON.stringify(product.sizes || {})}
- Notes / Details: ${product.product_notes || ''}
${skuInstructions}

PRICING GUIDANCE (when inferring prices):
- Fashion wholesale (WSP) is typically 40-55% of retail SRP
- Premium / luxury items command higher retail multiples (2.5-3x WSP)
- Streetwear / contemporary: 2x-2.4x WSP
- Basic / commodity: 2x WSP
- Consider category, material, and brand positioning

Return ONLY this JSON object (no markdown, no explanation outside JSON):
{
  ${fieldInstructions}
}`;

    const message = await anthropic.messages.create({
      model      : 'claude-opus-4-5',
      max_tokens : 600,
      messages   : [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0]?.text || '{}';
    let parsed;
    try {
      // Extract JSON even if model wraps it in markdown fences
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      parsed = {};
    }

    return res.json({
      sku               : wantSku   ? (parsed.sku        || fallbackSku)  : product.sku,
      sku_reasoning     : parsed.sku_reasoning     || '',
      wsp_usd           : wantPrice ? (parseFloat(parsed.wsp_usd)    || fbWsp)     : product.wsp_usd,
      srp        : wantPrice ? (parseFloat(parsed.srp) || fbRetail2) : product.srp,
      price_reasoning   : parsed.price_reasoning   || '',
      description       : wantDesc  ? (parsed.description || product.product_notes || '') : (product.product_notes || ''),
      description_reasoning: parsed.description_reasoning || '',
      ai_powered        : true,
    });
  } catch (err) {
    console.error('[AI enhance]', err.message);
    res.status(500).json({ error: 'AI enhancement unavailable. Please try again.' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SHOPIFY INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

// Derive a stable 32-byte key from JWT_SECRET for AES-256
const INTEGRATION_KEY = crypto.createHash('sha256').update(JWT_SECRET).digest();

function encryptIntegrationToken(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', INTEGRATION_KEY, iv);
  return iv.toString('hex') + ':' + Buffer.concat([cipher.update(text), cipher.final()]).toString('hex');
}

function decryptIntegrationToken(enc) {
  const [ivHex, data] = enc.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', INTEGRATION_KEY, Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString();
}

// GET /api/integrations/shopify/status
app.get('/api/integrations/shopify/status', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.json({ connected: false });
    const { data } = await supabase
      .from('integration_configs')
      .select('id, shop_domain, config, connected_at, last_sync_at')
      .eq('brand_id', brand_id).eq('platform', 'shopify').eq('active', true)
      .maybeSingle();
    res.json({ connected: !!data, integration: data || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/integrations/shopify/init-connect
app.post('/api/integrations/shopify/init-connect', (req, res) => {
  const { shop, brand_id } = req.body;
  if (!shop) return res.status(400).json({ error: 'shop required (e.g. yourstore.myshopify.com)' });
  if (!brand_id) return res.status(400).json({ error: 'brand_id required' });
  const shopDomain = shop.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const scopes = 'read_products,write_products,read_inventory,write_inventory';
  const state = Buffer.from(JSON.stringify({ brand_id, ts: Date.now() })).toString('base64');
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;
  const redirectUri = encodeURIComponent(`${appUrl}/api/integrations/shopify/callback`);
  const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID || 'SHOPIFY_CLIENT_ID'}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
  res.json({ authUrl, shopDomain });
});

// GET /api/integrations/shopify/callback
app.get('/api/integrations/shopify/callback', async (req, res) => {
  try {
    const { shop, code, state } = req.query;
    const { brand_id } = JSON.parse(Buffer.from(state, 'base64').toString());

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;
    if (!access_token) return res.redirect('/pages/brand-admin.html?shopify=error&msg=token_exchange_failed');

    const shopRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': access_token }
    });
    const { shop: shopInfo } = await shopRes.json();

    await supabase.from('integration_configs').upsert({
      brand_id,
      platform: 'shopify',
      access_token: encryptIntegrationToken(access_token),
      shop_domain: shop,
      external_id: String(shopInfo?.id || ''),
      config: { name: shopInfo?.name, email: shopInfo?.email, currency: shopInfo?.currency },
      active: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,platform' });

    console.log(`🛍  Shopify connected: ${shop} → brand ${brand_id}`);
    res.redirect('/pages/brand-admin.html?shopify=connected');
  } catch (err) {
    console.error('[Shopify callback]', err.message);
    res.redirect(`/pages/brand-admin.html?shopify=error&msg=${encodeURIComponent(err.message)}`);
  }
});

// POST /api/integrations/shopify/sync-inventory
app.post('/api/integrations/shopify/sync-inventory', async (req, res) => {
  try {
    const { brand_id } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id required' });

    const { data: cfg } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('brand_id', brand_id).eq('platform', 'shopify').eq('active', true)
      .maybeSingle();
    if (!cfg) return res.status(400).json({ error: 'Shopify not connected' });

    const token = decryptIntegrationToken(cfg.access_token);
    const shop = cfg.shop_domain;

    // Fetch all products+variants from Shopify
    const variants = [];
    let url = `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants`;
    while (url) {
      const r = await fetch(url, { headers: { 'X-Shopify-Access-Token': token } });
      const body = await r.json();
      for (const p of (body.products || [])) {
        for (const v of (p.variants || [])) {
          if (v.sku) variants.push({ sku: v.sku, qty: v.inventory_quantity ?? 0 });
        }
      }
      // follow pagination
      const linkHeader = r.headers.get('Link') || '';
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    }

    // Match by SKU and update inventory table
    let synced = 0, unmatched = 0;
    for (const { sku, qty } of variants) {
      const { data: item } = await supabase
        .from('inventory')
        .select('id')
        .eq('sku', sku)
        .maybeSingle();
      if (!item) { unmatched++; continue; }
      await supabase.from('inventory').update({
        stock_total: qty,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      synced++;
    }

    await supabase.from('integration_configs')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', cfg.id);

    console.log(`🔄 Shopify sync: ${synced} updated, ${unmatched} unmatched SKUs`);
    res.json({ synced, unmatched, total: variants.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/integrations/shopify
app.delete('/api/integrations/shopify', async (req, res) => {
  try {
    const { brand_id } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id required' });
    await supabase.from('integration_configs')
      .update({ active: false })
      .eq('brand_id', brand_id).eq('platform', 'shopify');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  WIX INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/integrations/wix/status
app.get('/api/integrations/wix/status', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.json({ connected: false });
    const { data } = await supabase
      .from('integration_configs')
      .select('id, shop_domain, config, connected_at, last_sync_at')
      .eq('brand_id', brand_id).eq('platform', 'wix').eq('active', true)
      .maybeSingle();
    res.json({ connected: !!data, integration: data || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/integrations/wix/init-connect
app.post('/api/integrations/wix/init-connect', (req, res) => {
  const { brand_id } = req.body;
  if (!brand_id) return res.status(400).json({ error: 'brand_id required' });
  const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;
  const state  = Buffer.from(JSON.stringify({ brand_id, ts: Date.now() })).toString('base64');
  const redirectUri = encodeURIComponent(`${appUrl}/api/integrations/wix/callback`);
  const authUrl = `https://www.wix.com/oauth/access?client_id=${process.env.WIX_CLIENT_ID || 'WIX_CLIENT_ID'}&response_type=code&scope=stores.read_products+stores.manage_products&redirect_uri=${redirectUri}&state=${state}`;
  res.json({ authUrl });
});

// GET /api/integrations/wix/callback
app.get('/api/integrations/wix/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const { brand_id } = JSON.parse(Buffer.from(state, 'base64').toString());
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;

    const tokenRes = await fetch('https://www.wix.com/oauth/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'authorization_code',
        client_id:     process.env.WIX_CLIENT_ID,
        client_secret: process.env.WIX_CLIENT_SECRET,
        code,
        redirect_uri: `${appUrl}/api/integrations/wix/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    const { access_token, refresh_token } = tokenData;
    if (!access_token) return res.redirect('/pages/brand-admin.html?wix=error&msg=token_exchange_failed');

    const siteRes = await fetch('https://www.wixapis.com/site-properties/v4/properties', {
      headers: { Authorization: access_token },
    });
    const siteData = await siteRes.json();
    const siteName = siteData.properties?.site?.name || '';

    await supabase.from('integration_configs').upsert({
      brand_id,
      platform: 'wix',
      access_token: encryptIntegrationToken(JSON.stringify({ access_token, refresh_token })),
      shop_domain: `wix:${brand_id}`,
      config: { name: siteName },
      active: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,platform' });

    console.log(`🔲 Wix connected → brand ${brand_id}`);
    res.redirect('/pages/brand-admin.html?wix=connected');
  } catch (err) {
    console.error('[Wix callback]', err.message);
    res.redirect(`/pages/brand-admin.html?wix=error&msg=${encodeURIComponent(err.message)}`);
  }
});

// POST /api/integrations/wix/sync-inventory
app.post('/api/integrations/wix/sync-inventory', async (req, res) => {
  try {
    const { brand_id } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id required' });

    const { data: cfg } = await supabase
      .from('integration_configs').select('*')
      .eq('brand_id', brand_id).eq('platform', 'wix').eq('active', true)
      .maybeSingle();
    if (!cfg) return res.status(400).json({ error: 'Wix not connected' });

    const { access_token } = JSON.parse(decryptIntegrationToken(cfg.access_token));

    // Paginate through Wix catalog variants
    const variants = [];
    let cursor = null;
    do {
      const body = { paging: { limit: 100, ...(cursor ? { cursor } : {}) } };
      const r = await fetch('https://www.wixapis.com/stores/v1/variants/query', {
        method: 'POST',
        headers: { Authorization: access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      for (const v of (data.variants || [])) {
        const sku = v.variant?.sku;
        const qty = v.stock?.quantity ?? 0;
        if (sku) variants.push({ sku, qty });
      }
      cursor = data.metadata?.cursors?.next || null;
    } while (cursor);

    let synced = 0, unmatched = 0;
    for (const { sku, qty } of variants) {
      const { data: item } = await supabase
        .from('inventory').select('id').eq('sku', sku).maybeSingle();
      if (!item) { unmatched++; continue; }
      await supabase.from('inventory').update({
        stock_total: qty,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      synced++;
    }

    await supabase.from('integration_configs')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', cfg.id);

    console.log(`🔄 Wix sync: ${synced} updated, ${unmatched} unmatched`);
    res.json({ synced, unmatched, total: variants.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/integrations/wix
app.delete('/api/integrations/wix', async (req, res) => {
  try {
    const { brand_id } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id required' });
    await supabase.from('integration_configs')
      .update({ active: false })
      .eq('brand_id', brand_id).eq('platform', 'wix');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  QUICKBOOKS INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════
// Scopes: com.intuit.quickbooks.accounting
// Token endpoint: https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
// API base (sandbox): https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}
// API base (prod):    https://quickbooks.api.intuit.com/v3/company/{realmId}

const QB_BASE = process.env.QB_SANDBOX === 'true'
  ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
  : 'https://quickbooks.api.intuit.com/v3/company';

// GET /api/integrations/quickbooks/status
app.get('/api/integrations/quickbooks/status', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.json({ connected: false });
    const { data } = await supabase
      .from('integration_configs')
      .select('id, config, connected_at, last_sync_at')
      .eq('brand_id', brand_id).eq('platform', 'quickbooks').eq('active', true)
      .maybeSingle();
    res.json({ connected: !!data, integration: data || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/integrations/quickbooks/init-connect
app.post('/api/integrations/quickbooks/init-connect', (req, res) => {
  const { brand_id } = req.body;
  if (!brand_id) return res.status(400).json({ error: 'brand_id required' });
  const appUrl      = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;
  const state       = Buffer.from(JSON.stringify({ brand_id, ts: Date.now() })).toString('base64');
  const redirectUri = encodeURIComponent(`${appUrl}/api/integrations/quickbooks/callback`);
  const scope       = encodeURIComponent('com.intuit.quickbooks.accounting');
  const authUrl     = `https://appcenter.intuit.com/connect/oauth2?client_id=${process.env.QB_CLIENT_ID || 'QB_CLIENT_ID'}&response_type=code&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
  res.json({ authUrl });
});

// GET /api/integrations/quickbooks/callback
app.get('/api/integrations/quickbooks/callback', async (req, res) => {
  try {
    const { code, state, realmId } = req.query;
    const { brand_id } = JSON.parse(Buffer.from(state, 'base64').toString());
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;

    const credentials = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/integrations/quickbooks/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    const { access_token, refresh_token } = tokenData;
    if (!access_token) return res.redirect('/pages/brand-admin.html?qb=error&msg=token_exchange_failed');

    // Fetch company name
    const companyRes = await fetch(`${QB_BASE}/${realmId}/companyinfo/${realmId}?minorversion=65`, {
      headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
    });
    const companyData = await companyRes.json();
    const companyName = companyData.CompanyInfo?.CompanyName || '';

    await supabase.from('integration_configs').upsert({
      brand_id,
      platform: 'quickbooks',
      access_token: encryptIntegrationToken(JSON.stringify({ access_token, refresh_token })),
      external_id: realmId,
      config: { company_name: companyName, realm_id: realmId },
      active: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,platform' });

    console.log(`📒 QuickBooks connected: ${companyName} (realm ${realmId}) → brand ${brand_id}`);
    res.redirect('/pages/brand-admin.html?qb=connected');
  } catch (err) {
    console.error('[QuickBooks callback]', err.message);
    res.redirect(`/pages/brand-admin.html?qb=error&msg=${encodeURIComponent(err.message)}`);
  }
});

// Refresh a QuickBooks access token using the stored refresh_token
async function refreshQBToken(cfg) {
  const { refresh_token } = JSON.parse(decryptIntegrationToken(cfg.access_token));
  const credentials = Buffer.from(`${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`).toString('base64');
  const r = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credentials}`, Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('QuickBooks token refresh failed');
  const encrypted = encryptIntegrationToken(JSON.stringify({ access_token: data.access_token, refresh_token: data.refresh_token || refresh_token }));
  await supabase.from('integration_configs').update({ access_token: encrypted }).eq('id', cfg.id);
  return data.access_token;
}

// POST /api/integrations/quickbooks/sync
// Pushes brand orders → QuickBooks Sales Receipts, and pulls Inventory Items → updates stock
app.post('/api/integrations/quickbooks/sync', async (req, res) => {
  try {
    const { brand_id, sync_type = 'inventory' } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id required' });

    const { data: cfg } = await supabase
      .from('integration_configs').select('*')
      .eq('brand_id', brand_id).eq('platform', 'quickbooks').eq('active', true)
      .maybeSingle();
    if (!cfg) return res.status(400).json({ error: 'QuickBooks not connected' });

    const realmId = cfg.config?.realm_id || cfg.external_id;
    let access_token;
    try {
      access_token = JSON.parse(decryptIntegrationToken(cfg.access_token)).access_token;
    } catch { return res.status(500).json({ error: 'Failed to decrypt token' }); }

    const qbGet = async (path) => {
      let r = await fetch(`${QB_BASE}/${realmId}${path}`, {
        headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
      });
      if (r.status === 401) {
        // Token expired — refresh and retry once
        access_token = await refreshQBToken(cfg);
        r = await fetch(`${QB_BASE}/${realmId}${path}`, {
          headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
        });
      }
      return r.json();
    };

    const qbPost = async (path, body) => {
      let r = await fetch(`${QB_BASE}/${realmId}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.status === 401) {
        access_token = await refreshQBToken(cfg);
        r = await fetch(`${QB_BASE}/${realmId}${path}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      return r.json();
    };

    const result = {};

    if (sync_type === 'inventory' || sync_type === 'both') {
      // Pull QB inventory items and update stock_total by SKU
      const qbData = await qbGet('/query?query=SELECT%20*%20FROM%20Item%20WHERE%20Type%3D\'Inventory\'%20MAXRESULTS%20500&minorversion=65');
      const items  = qbData.QueryResponse?.Item || [];
      let synced = 0, unmatched = 0;
      for (const item of items) {
        const sku = item.Sku || item.Name;
        const qty = item.QtyOnHand ?? 0;
        if (!sku) { unmatched++; continue; }
        const { data: inv } = await supabase.from('inventory').select('id').eq('sku', sku).maybeSingle();
        if (!inv) { unmatched++; continue; }
        await supabase.from('inventory').update({ stock_total: qty, updated_at: new Date().toISOString() }).eq('id', inv.id);
        synced++;
      }
      result.inventory = { synced, unmatched, total: items.length };
    }

    if (sync_type === 'orders' || sync_type === 'both') {
      // Push unsynced buyer_orders → QB Sales Receipts
      const { data: orders } = await supabase
        .from('buyer_orders')
        .select('*')
        .eq('brand_id', brand_id)
        .not('status', 'eq', 'cancelled')
        .is('qb_synced_at', null)
        .limit(50);

      let pushed = 0;
      for (const order of (orders || [])) {
        const lines = (order.items || []).map((item, i) => ({
          LineNum: i + 1,
          Amount: (item.wsp_usd || 0) * (item.qty || 1),
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: { value: '1', name: 'Services' }, // generic fallback
            Qty: item.qty || 1,
            UnitPrice: item.wsp_usd || 0,
          },
        }));
        if (!lines.length) continue;
        const receipt = {
          DocNumber: order.id,
          TxnDate: order.created_at?.split('T')[0],
          Line: lines,
          CustomerRef: { name: order.buyer_name || 'Wholesale Buyer' },
          PrivateNote: order.notes || '',
        };
        const qbRes = await qbPost('/salesreceipt?minorversion=65', receipt);
        if (qbRes.SalesReceipt?.Id) {
          await supabase.from('buyer_orders').update({ qb_synced_at: new Date().toISOString() }).eq('id', order.id);
          pushed++;
        }
      }
      result.orders = { pushed };
    }

    await supabase.from('integration_configs').update({ last_sync_at: new Date().toISOString() }).eq('id', cfg.id);
    console.log(`📒 QB sync (${sync_type}):`, result);
    res.json({ ...result, sync_type });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/integrations/quickbooks
app.delete('/api/integrations/quickbooks', async (req, res) => {
  try {
    const { brand_id } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id required' });
    await supabase.from('integration_configs')
      .update({ active: false })
      .eq('brand_id', brand_id).eq('platform', 'quickbooks');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  GOOGLE WORKSPACE INTEGRATION
//  Syncs inventory ↔ Google Sheets and pushes orders to a Sheet
// ═══════════════════════════════════════════════════════════════════════════════

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_BASE      = 'https://sheets.googleapis.com/v4/spreadsheets';

async function refreshGoogleToken(cfg) {
  const { refresh_token } = JSON.parse(decryptIntegrationToken(cfg.access_token));
  const r = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  });
  const data = await r.json();
  if (!data.access_token) throw new Error('Google token refresh failed');
  const encrypted = encryptIntegrationToken(JSON.stringify({
    access_token:  data.access_token,
    refresh_token: data.refresh_token || refresh_token,
  }));
  await supabase.from('integration_configs').update({ access_token: encrypted }).eq('id', cfg.id);
  return data.access_token;
}

async function googleFetch(url, options, cfg) {
  let { access_token } = JSON.parse(decryptIntegrationToken(cfg.access_token));
  const doFetch = (tok) => fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  let r = await doFetch(access_token);
  if (r.status === 401) {
    access_token = await refreshGoogleToken(cfg);
    r = await doFetch(access_token);
  }
  return r.json();
}

// GET /api/integrations/google/status
app.get('/api/integrations/google/status', async (req, res) => {
  try {
    const { brand_id } = req.query;
    if (!brand_id) return res.json({ connected: false });
    const { data } = await supabase
      .from('integration_configs')
      .select('id, config, connected_at, last_sync_at')
      .eq('brand_id', brand_id).eq('platform', 'google').eq('active', true)
      .maybeSingle();
    res.json({ connected: !!data, integration: data || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/integrations/google/init-connect
app.post('/api/integrations/google/init-connect', (req, res) => {
  const { brand_id } = req.body;
  if (!brand_id) return res.status(400).json({ error: 'brand_id required' });
  const appUrl      = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;
  const state       = Buffer.from(JSON.stringify({ brand_id, ts: Date.now() })).toString('base64');
  const redirectUri = encodeURIComponent(`${appUrl}/api/integrations/google/callback`);
  const scope       = encodeURIComponent([
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ].join(' '));
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID'}&response_type=code&scope=${scope}&redirect_uri=${redirectUri}&state=${state}&access_type=offline&prompt=consent`;
  res.json({ authUrl });
});

// GET /api/integrations/google/callback
app.get('/api/integrations/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const { brand_id } = JSON.parse(Buffer.from(state, 'base64').toString());
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`;

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  `${appUrl}/api/integrations/google/callback`,
      }),
    });
    const tokenData = await tokenRes.json();
    const { access_token, refresh_token } = tokenData;
    if (!access_token) return res.redirect('/pages/brand-admin.html?google=error&msg=token_exchange_failed');

    // Get user email for display
    const userRes  = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = await userRes.json();

    await supabase.from('integration_configs').upsert({
      brand_id,
      platform: 'google',
      access_token: encryptIntegrationToken(JSON.stringify({ access_token, refresh_token })),
      config: { email: userInfo.email, name: userInfo.name },
      active: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,platform' });

    console.log(`📊 Google Workspace connected: ${userInfo.email} → brand ${brand_id}`);
    res.redirect('/pages/brand-admin.html?google=connected');
  } catch (err) {
    console.error('[Google callback]', err.message);
    res.redirect(`/pages/brand-admin.html?google=error&msg=${encodeURIComponent(err.message)}`);
  }
});

// POST /api/integrations/google/sync
// sync_type: 'export_inventory' | 'export_orders' | 'import_inventory'
app.post('/api/integrations/google/sync', async (req, res) => {
  try {
    const { brand_id, sync_type = 'export_inventory', spreadsheet_id } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id required' });

    const { data: cfg } = await supabase
      .from('integration_configs').select('*')
      .eq('brand_id', brand_id).eq('platform', 'google').eq('active', true)
      .maybeSingle();
    if (!cfg) return res.status(400).json({ error: 'Google Workspace not connected' });

    const result = {};

    if (sync_type === 'export_inventory') {
      // Fetch brand inventory
      const { data: items } = await supabase
        .from('inventory').select('*').eq('brand_id', brand_id).neq('status', 'archived');

      const rows = [
        ['SKU', 'Title', 'Category', 'Color', 'Season', 'Stock', 'WSP (USD)', 'SRP', 'MOQ', 'Delivery Window', 'Status'],
        ...(items || []).map(p => [
          p.sku || '', p.title || p.description || '', p.category || '', p.color || '',
          p.season || '', p.stock_total ?? 0, p.wsp_usd ?? '', p.srp ?? '',
          p.moq ?? '', p.delivery_window || '', p.status || 'active',
        ]),
      ];

      let sheetId = spreadsheet_id;
      if (!sheetId) {
        // Create new spreadsheet
        const created = await googleFetch(`${SHEETS_BASE}`, {
          method: 'POST',
          body: JSON.stringify({ properties: { title: 'Linezheets Inventory' } }),
        }, cfg);
        sheetId = created.spreadsheetId;
        // Save the sheet ID for future syncs
        await supabase.from('integration_configs').update({
          config: { ...cfg.config, inventory_sheet_id: sheetId },
        }).eq('id', cfg.id);
      }

      // Clear and write
      await googleFetch(`${SHEETS_BASE}/${sheetId}/values/A1:Z10000:clear`, { method: 'POST', body: '{}' }, cfg);
      await googleFetch(
        `${SHEETS_BASE}/${sheetId}/values/A1?valueInputOption=RAW`,
        { method: 'PUT', body: JSON.stringify({ values: rows }) },
        cfg,
      );

      result.export_inventory = {
        rows: rows.length - 1,
        spreadsheet_id: sheetId,
        url: `https://docs.google.com/spreadsheets/d/${sheetId}`,
      };
    }

    if (sync_type === 'export_orders') {
      const { data: orders } = await supabase
        .from('buyer_orders').select('*').eq('brand_id', brand_id)
        .order('created_at', { ascending: false }).limit(500);

      const rows = [
        ['Order ID', 'Buyer', 'Status', 'Total (USD)', 'Currency', 'Terms', 'Items', 'Created At'],
        ...(orders || []).map(o => [
          o.id, o.buyer_name || '', o.status, o.total_usd ?? 0,
          o.currency || 'USD', o.terms || '',
          Array.isArray(o.items) ? o.items.length : 0,
          o.created_at ? new Date(o.created_at).toLocaleDateString() : '',
        ]),
      ];

      let sheetId = spreadsheet_id || cfg.config?.orders_sheet_id;
      if (!sheetId) {
        const created = await googleFetch(`${SHEETS_BASE}`, {
          method: 'POST',
          body: JSON.stringify({ properties: { title: 'Linezheets Orders' } }),
        }, cfg);
        sheetId = created.spreadsheetId;
        await supabase.from('integration_configs').update({
          config: { ...cfg.config, orders_sheet_id: sheetId },
        }).eq('id', cfg.id);
      }

      await googleFetch(`${SHEETS_BASE}/${sheetId}/values/A1:Z10000:clear`, { method: 'POST', body: '{}' }, cfg);
      await googleFetch(
        `${SHEETS_BASE}/${sheetId}/values/A1?valueInputOption=RAW`,
        { method: 'PUT', body: JSON.stringify({ values: rows }) },
        cfg,
      );

      result.export_orders = {
        rows: rows.length - 1,
        spreadsheet_id: sheetId,
        url: `https://docs.google.com/spreadsheets/d/${sheetId}`,
      };
    }

    if (sync_type === 'import_inventory') {
      // Read from a user-supplied spreadsheet (columns: SKU, Stock)
      const sid = spreadsheet_id || cfg.config?.inventory_sheet_id;
      if (!sid) return res.status(400).json({ error: 'spreadsheet_id required for import' });

      const sheetData = await googleFetch(`${SHEETS_BASE}/${sid}/values/A1:Z5000`, {}, cfg);
      const [header, ...dataRows] = sheetData.values || [];
      if (!header) return res.status(400).json({ error: 'Sheet appears empty' });

      const col = (name) => header.findIndex(h => h.toString().toLowerCase().includes(name));
      const skuCol   = col('sku');
      const stockCol = col('stock');
      if (skuCol === -1 || stockCol === -1) return res.status(400).json({ error: 'Sheet must have SKU and Stock columns' });

      let synced = 0, unmatched = 0;
      for (const row of dataRows) {
        const sku = (row[skuCol] || '').trim();
        const qty = parseInt(row[stockCol]) || 0;
        if (!sku) continue;
        const { data: item } = await supabase.from('inventory').select('id').eq('sku', sku).maybeSingle();
        if (!item) { unmatched++; continue; }
        await supabase.from('inventory').update({ stock_total: qty, updated_at: new Date().toISOString() }).eq('id', item.id);
        synced++;
      }
      result.import_inventory = { synced, unmatched, total: dataRows.length };
    }

    await supabase.from('integration_configs').update({ last_sync_at: new Date().toISOString() }).eq('id', cfg.id);
    console.log(`📊 Google sync (${sync_type}):`, result);
    res.json({ ...result, sync_type });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/integrations/google
app.delete('/api/integrations/google', async (req, res) => {
  try {
    const { brand_id } = req.body;
    if (!brand_id) return res.status(400).json({ error: 'brand_id required' });
    await supabase.from('integration_configs')
      .update({ active: false })
      .eq('brand_id', brand_id).eq('platform', 'google');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/buyers  — brand dashboard buyer list ────────────────────────────
app.get('/api/buyers', async (req, res) => {
  try {
    if (!supabase) return res.json({ buyers: [] });
    const { data, error } = await supabase
      .from('buyers')
      .select('id, store_name, email, first_name, last_name, city, country, status, created_at, last_login_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ buyers: data || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Brand registration ───────────────────────────────────────────────────────

app.post('/api/auth/register/brand', async (req, res) => {
  const { email, password, firstName, lastName, brandName, phone, tier } = req.body;
  if (!email || !password || !brandName)
    return res.status(400).json({ error: 'email, password, and brandName are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!supabaseAuth) return res.status(503).json({ error: 'Auth not configured' });

  try {
    const { data, error } = await supabaseAuth.auth.signUp({
      email, password,
      options: { data: { role: 'brand', brand_name: brandName, first_name: firstName, last_name: lastName, phone, tier } },
    });
    if (error) {
      if (error.message.toLowerCase().includes('already registered'))
        return res.status(409).json({ error: 'Email already registered' });
      throw error;
    }
    const authUser = data.user;
    const token = jwt.sign(
      { sub: authUser.id, email: authUser.email, role: 'brand' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    console.log(`🏷️  Brand registered: ${email}`);
    res.json({
      token,
      user : { id: authUser.id, email: authUser.email, role: 'brand' },
      brand: { brand_name: brandName, first_name: firstName, last_name: lastName, email },
    });
  } catch (err) {
    console.error('Brand register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Buyer self-registration ──────────────────────────────────────────────────

app.post('/api/auth/register/buyer', async (req, res) => {
  const { email, password, firstName, lastName, companyName, businessType, website, phone } = req.body;
  if (!email || !password || !companyName)
    return res.status(400).json({ error: 'email, password, and companyName are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (!supabaseAuth) return res.status(503).json({ error: 'Auth not configured' });

  try {
    const { data, error } = await supabaseAuth.auth.signUp({
      email, password,
      options: { data: { role: 'buyer', store_name: companyName, first_name: firstName, last_name: lastName } },
    });
    if (error) {
      if (error.message.toLowerCase().includes('already registered'))
        return res.status(409).json({ error: 'Email already registered' });
      throw error;
    }
    const authUser = data.user;

    // Persist to buyers table
    let buyerRow = null;
    if (supabase) {
      const { data: inserted } = await supabase
        .from('buyers')
        .insert([{
          id            : authUser.id,
          email         : email.toLowerCase().trim(),
          store_name    : companyName,
          first_name    : firstName || null,
          last_name     : lastName  || null,
          phone         : phone     || null,
          status        : 'pending',
          market_segment: businessType || null,
        }])
        .select('id, email, store_name, status, created_at')
        .single();
      buyerRow = inserted;
    }

    const token = jwt.sign(
      { sub: authUser.id, email: authUser.email, role: 'buyer' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    console.log(`🛍️  Buyer registered: ${email}`);
    res.json({
      token,
      user : { id: authUser.id, email: authUser.email, role: 'buyer' },
      buyer: buyerRow || { email, store_name: companyName, status: 'pending' },
    });
  } catch (err) {
    console.error('Buyer register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Brand storefront public endpoints ───────────────────────────────────────

app.get('/api/brands/by-slug/:slug', async (req, res) => {
  try {
    const { data: sf, error } = await supabase
      .from('brand_storefronts')
      .select('*')
      .eq('slug', req.params.slug)
      .eq('published', true)
      .maybeSingle();
    if (error) throw error;
    if (!sf) return res.status(404).json({ error: 'Brand not found' });

    const { count } = await supabase
      .from('buyer_favorites')
      .select('id', { count: 'exact', head: true })
      .eq('item_type', 'brand')
      .eq('item_id', sf.id);

    res.json({ ...sf, follower_count: count || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/brands/:brandId/products', async (req, res) => {
  try {
    const { category, search, limit = 48, offset = 0 } = req.query;
    const { data, error } = await supabase
      .from('brand_storefront_products')
      .select('id, inventory_id, consumer_price, featured, published, inventory:inventory_id(id, title, sku, brand_name, category, season, color, image_urls, srp, wsp_usd, sizes, stock_total, material, description)')
      .eq('storefront_id', req.params.brandId)
      .eq('published', true)
      .order('featured', { ascending: false })
      .order('sort_order',  { ascending: true })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (error) throw error;

    let products = (data || []).map(row => ({
      ...row.inventory,
      storefront_product_id: row.id,
      consumer_price       : row.consumer_price,
      featured             : row.featured,
    }));

    if (category) products = products.filter(p => p.category === category);
    if (search) {
      const s = search.toLowerCase();
      products = products.filter(p =>
        (p.title || '').toLowerCase().includes(s) ||
        (p.brand_name || '').toLowerCase().includes(s)
      );
    }
    res.json({ products, total: products.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chat/inquiry', async (req, res) => {
  try {
    const { brandId, name, email, message } = req.body;
    if (!brandId || !name || !email)
      return res.status(400).json({ error: 'brandId, name, and email are required' });

    const { data: sf } = await supabase
      .from('brand_storefronts').select('brand_name').eq('id', brandId).maybeSingle();
    const brand_name = sf?.brand_name || brandId;

    const { buyer } = getBuyerFromReq(req);
    const buyer_id  = buyer?.id || email.replace(/[@.]/g, '_');

    const { data: inq, error: inqErr } = await supabase
      .from('inquiries')
      .insert([{ buyer_id, brand_name, subject: (message || 'Brand inquiry').slice(0, 80), status: 'open' }])
      .select('id').single();
    if (inqErr) throw inqErr;

    if (message && buyer?.id) {
      await supabase.from('inquiry_messages')
        .insert([{ inquiry_id: inq.id, sender_id: buyer.id, body: message }]);
    }
    res.json({ success: true, inquiry_id: inq.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/brands/:brandId/follow-status', async (req, res) => {
  const { buyer } = getBuyerFromReq(req);
  if (!buyer) return res.json({ following: false });
  try {
    const { data } = await supabase
      .from('buyer_favorites').select('id')
      .eq('user_id', buyer.id).eq('item_type', 'brand').eq('item_id', req.params.brandId)
      .maybeSingle();
    res.json({ following: !!data });
  } catch { res.json({ following: false }); }
});

app.post('/api/brands/:brandId/follow', async (req, res) => {
  const { buyer } = getBuyerFromReq(req);
  if (!buyer) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await supabase.from('buyer_favorites').upsert(
      [{ user_id: buyer.id, item_type: 'brand', item_id: req.params.brandId }],
      { onConflict: 'user_id,item_type,item_id', ignoreDuplicates: true }
    );
    res.json({ following: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/brands/:brandId/follow', async (req, res) => {
  const { buyer } = getBuyerFromReq(req);
  if (!buyer) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await supabase.from('buyer_favorites').delete()
      .eq('user_id', buyer.id).eq('item_type', 'brand').eq('item_id', req.params.brandId);
    res.json({ following: false });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Unified auth routes (used by auth.html frontend) ────────────────────────
// Uses a separate Supabase client with anon key so signInWithPassword works.
const supabaseAuth = (() => {
  const { createClient: cc } = require('@supabase/supabase-js');
  return (SUPABASE_URL && process.env.SUPABASE_ANON_KEY)
    ? cc(SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    : null;
})();

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  if (!supabaseAuth) return res.status(503).json({ error: 'Auth not configured' });

  try {
    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid email or password' });

    const authUser = data.user;

    // Determine role: user_metadata role set at registration, fallback to buyers table check
    const metaRole = authUser.user_metadata?.role;
    let role    = metaRole || 'brand';
    let profile = null;
    let needs_onboard = false;

    if (!metaRole || metaRole === 'buyer') {
      const { data: buyer } = supabase
        ? await supabase.from('buyers').select('id,email,store_name,first_name,status').eq('id', authUser.id).maybeSingle()
        : { data: null };
      if (buyer) {
        role    = 'buyer';
        profile = buyer;
        needs_onboard = buyer.status === 'pending';
      }
    }

    const token = jwt.sign(
      { sub: authUser.id, email: authUser.email, role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { id: authUser.id, email: authUser.email, role },
      profile,
      needs_onboard,
    });
  } catch (err) {
    console.error('Auth login error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  if (!supabaseAuth) return res.status(503).json({ error: 'Auth not configured' });
  // Fire-and-forget — never reveal whether email exists
  supabaseAuth.auth.resetPasswordForEmail(email).catch(() => {});
  res.json({ ok: true });
});

// ─── 404 catch-all for /api/* ─────────────────────────────────────────────────
app.use('/api/*', (req, res) =>
  res.status(404).json({ error: 'Route not found', path: req.path })
);

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n✅ LINEZHEETS SERVER v3.0 — PORT ${PORT}`);
  console.log(`🗄️  Supabase:   ${supabase ? `connected → ${SUPABASE_URL}` : 'NOT configured (seed fallback active)'}`);
  console.log(`📦 Products:   GET  /api/marketplace/products`);
  console.log(`🔍 Search:     GET  /api/marketplace/search?q=...`);
  console.log(`🛒 Cart:       GET  /api/buyers/cart  (Bearer token)`);
  console.log(`📋 Orders:     GET  /api/orders`);
  console.log(`💬 Offers:     GET  /api/offers`);
  console.log(`📊 KPIs:       GET  /api/dashboard/kpis`);
  console.log(`⬆️  Upload:     POST /api/upload/smart-sync`);
  console.log(`🏥 Health:     GET  /api/health\n`);

  // Probe real Supabase schema so queries and upserts only use columns that exist.
  // After running the migration SQL, re-starting the server picks up the new columns.
  await refreshSchema();
});
