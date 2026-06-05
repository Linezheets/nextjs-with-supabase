const router = require('express').Router();
const db = require('../middleware/db');
const { authenticate, requireBuyer } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

// Supabase client — uses the publishable key (safe for server-side reads from public views)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log('[Supabase] URL loaded:', SUPABASE_URL ? SUPABASE_URL : '❌ MISSING — check .env.local');
console.log('[Supabase] KEY loaded:', SUPABASE_KEY ? '✓ present' : '❌ MISSING — check .env.local');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Shared field normaliser: buyer_vip_catalog → frontend shape ───────────────
// Maps:  title → name  |  retail_price → price  |  image_url/image_urls → image
function normaliseCatalogItem(p) {
  // Resolve image: prefer image_url, fall back to first entry of image_urls
  let image = p.image_url || null;
  if (!image && p.image_urls) {
    try {
      const parsed = typeof p.image_urls === 'string' ? JSON.parse(p.image_urls) : p.image_urls;
      image = Array.isArray(parsed) ? parsed[0] : String(parsed);
    } catch {
      const m = String(p.image_urls).match(/https?:\/\/[^"',}\s]+/);
      image = m ? m[0] : null;
    }
  }

  const price = parseFloat(p.retail_price) || 0;

  return {
    id              : p.id,
    name            : p.title        || 'Untitled',   // title → name
    price,                                             // retail_price → price
    brand_name      : p.brand_name   || '',
    category        : p.category     || '',
    season          : p.season       || '',
    inventory_status: p.inventory_status || null,
    wholesale_price : parseFloat(p.wholesale_price) || price / 2.5,
    image,
  };
}

// ── GET /api/marketplace/products — public product browsing ──────────────────
// Full price/stock visible to verified buyers; teasers only for public/pending
router.get('/products', async (req, res, next) => {
  try {
    const {
      category, season, brand_id, color, size,
      min_price, max_price, search,
      sort = 'newest', limit = 48, offset = 0
    } = req.query;

    const params = ['active'];
    let where = `WHERE p.status = $1 AND b.status = 'approved'`;

    if (category) { where += ` AND p.category = $${params.length + 1}`; params.push(category); }
    if (season)   { where += ` AND p.season ILIKE $${params.length + 1}`; params.push(season); }
    if (brand_id) { where += ` AND p.brand_id = $${params.length + 1}`; params.push(brand_id); }
    if (min_price) { where += ` AND p.wholesale_price >= $${params.length + 1}`; params.push(min_price); }
    if (max_price) { where += ` AND p.wholesale_price <= $${params.length + 1}`; params.push(max_price); }
    if (search)   { where += ` AND (p.name ILIKE $${params.length + 1} OR p.tags && ARRAY[$${params.length + 1}])`; params.push(`%${search}%`); }
    if (color)    { where += ` AND EXISTS (SELECT 1 FROM product_variants pv2 WHERE pv2.product_id = p.id AND LOWER(pv2.color) = LOWER($${params.length + 1}))`; params.push(color); }
    if (size)     { where += ` AND EXISTS (SELECT 1 FROM product_variants pv2 WHERE pv2.product_id = p.id AND LOWER(pv2.size) = LOWER($${params.length + 1}))`; params.push(size); }

    const orderMap = {
      newest:    'p.created_at DESC',
      price_asc: 'p.wholesale_price ASC',
      price_desc:'p.wholesale_price DESC',
      popular:   'order_count DESC'
    };
    const orderBy = orderMap[sort] || orderMap.newest;

    const { rows } = await db.query(
      `SELECT p.id, p.name, p.category, p.season, p.wholesale_price, p.msrp,
              p.images[1] AS image, p.tags, p.min_order_qty, p.delivery_window,
              b.id AS brand_id, b.brand_name, b.logo_url, b.country,
              COUNT(DISTINCT pv.id) AS variant_count,
              COALESCE(SUM(GREATEST(0, pv.quantity - pv.reserved_qty)), 0) AS available_units,
              COUNT(DISTINCT oi.order_id) AS order_count
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.active = true
       LEFT JOIN order_items oi ON oi.product_id = p.id
       ${where}
       GROUP BY p.id, b.id
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    // Count for pagination
    const { rows: [cnt] } = await db.query(
      `SELECT COUNT(DISTINCT p.id) AS total
       FROM products p JOIN brands b ON b.id = p.brand_id ${where}`, params
    );

    res.json({ products: rows, total: parseInt(cnt.total), limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) { next(err); }
});

// ── GET /api/marketplace/brands — browse approved brands ─────────────────────
router.get('/brands', async (req, res, next) => {
  try {
    const { category, country, search, limit = 24, offset = 0 } = req.query;
    const params = ['approved'];
    let where = 'WHERE b.status = $1';

    if (category) { where += ` AND b.category = $${params.length + 1}`; params.push(category); }
    if (country)  { where += ` AND b.country = $${params.length + 1}`; params.push(country); }
    if (search)   { where += ` AND b.brand_name ILIKE $${params.length + 1}`; params.push(`%${search}%`); }

    const { rows } = await db.query(
      `SELECT b.id, b.brand_name, b.logo_url, b.category, b.country, b.description,
              bs.slug, bs.min_order_amount, bs.primary_color,
              COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS product_count,
              COUNT(DISTINCT bf.buyer_id) AS follower_count
       FROM brands b
       LEFT JOIN brand_stores bs ON bs.brand_id = b.id
       LEFT JOIN products p ON p.brand_id = b.id
       LEFT JOIN brand_follows bf ON bf.brand_id = b.id
       ${where}
       GROUP BY b.id, bs.slug, bs.min_order_amount, bs.primary_color
       ORDER BY follower_count DESC, b.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ brands: rows });
  } catch (err) { next(err); }
});

// ── GET /api/marketplace/ai-matches — personalized brand matches for buyer ────
router.get('/ai-matches', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { rows: [buyer] } = await db.query(
      'SELECT style_preferences, price_range_min, price_range_max, total_spent FROM buyers WHERE id = $1',
      [req.buyerId]
    );

    // AI match: brands sharing buyer's style preferences + price range
    // Score = style overlap + price fit + order history signal
    const { rows } = await db.query(
      `SELECT b.id, b.brand_name, b.logo_url, b.category, b.country, b.description,
              bs.min_order_amount, bs.primary_color,
              COALESCE(ams.score, 50) AS match_score,
              ams.match_reason,
              COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS product_count
       FROM brands b
       LEFT JOIN brand_stores bs ON bs.brand_id = b.id
       LEFT JOIN products p ON p.brand_id = b.id
       LEFT JOIN ai_match_scores ams ON ams.brand_id = b.id AND ams.buyer_id = $1
       WHERE b.status = 'approved'
         AND ($2::text[] IS NULL OR b.category = ANY($2))
         AND ($3::numeric IS NULL OR bs.min_order_amount >= $3 * 0.5)
         AND ($4::numeric IS NULL OR bs.min_order_amount <= $4 * 2)
       GROUP BY b.id, bs.min_order_amount, bs.primary_color, ams.score, ams.match_reason
       ORDER BY match_score DESC, product_count DESC
       LIMIT 12`,
      [req.buyerId,
       buyer?.style_preferences?.length ? buyer.style_preferences : null,
       buyer?.price_range_min,
       buyer?.price_range_max]
    );
    res.json({ matches: rows });
  } catch (err) { next(err); }
});

// ── GET /api/marketplace/featured — sourced from buyer_vip_catalog view ───────
router.get('/featured', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('buyer_vip_catalog')
      .select('id, title, retail_price, image_url, brand_name, category, season, description')
      .limit(6);

    if (error) throw error;

    const featured = (data || []).map(item => ({
      ...item,
      name    : item.title,
      price   : item.retail_price,
      logo_url: item.image_url,
    }));

    res.json({ featured });
  } catch (err) { next(err); }
});

// ── GET /api/marketplace/categories — category list with product counts ────────
router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.category, COUNT(DISTINCT p.id) AS product_count, COUNT(DISTINCT p.brand_id) AS brand_count
       FROM products p JOIN brands b ON b.id = p.brand_id
       WHERE p.status = 'active' AND b.status = 'approved' AND p.category IS NOT NULL
       GROUP BY p.category
       ORDER BY product_count DESC`
    );
    res.json({ categories: rows });
  } catch (err) { next(err); }
});

// ── GET /api/marketplace/trending — SELECT * FROM products (no filters) ────────
router.get('/trending', async (req, res, next) => {
  try {
    console.log('--- /trending hit ---');
    console.log('Supabase URL:', SUPABASE_URL || '❌ MISSING');
    console.log('Supabase KEY:', SUPABASE_KEY ? '✓ loaded' : '❌ MISSING');

    // Attempt 1: products table — SELECT *, no filters, no .eq(), no .limit()
    let { data, error } = await supabase
      .from('products')
      .select('*');

    console.log('Database Error:', error);
    console.log('Database Result:', data);

    // Attempt 2: if products is empty or errored, try buyer_vip_catalog
    if ((!data || data.length === 0) && !error) {
      console.log('products returned empty — trying buyer_vip_catalog...');
      const fallback = await supabase
        .from('buyer_vip_catalog')
        .select('*');
      console.log('buyer_vip_catalog Error:', fallback.error);
      console.log('buyer_vip_catalog Result:', fallback.data);
      data  = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('Query failed:', error.message, error.hint || '');
      return res.status(500).json({ error: error.message, hint: error.hint });
    }

    const EUR_RATE = 0.92;

    const trending = (data || []).map(item => {
      // ── Column rename compat (WSP_usd → wholesale_usd, Description → title) ─
      if ('WSP_usd' in item && !('wholesale_usd' in item)) { item = { ...item, wholesale_usd: item.WSP_usd }; }
      if ('Description' in item && !('title' in item))     { item = { ...item, title: item.Description };     }

      // ── Normalise image_urls to a proper array ────────────────────────────
      let image_urls = [];
      if (Array.isArray(item.image_urls)) {
        image_urls = item.image_urls;
      } else if (typeof item.image_urls === 'string') {
        try { image_urls = JSON.parse(item.image_urls); } catch { /* ignore */ }
      }
      if (!image_urls.length && item.image_url) image_urls = [item.image_url];
      if (!image_urls.length && item.image)     image_urls = [item.image];

      // ── Prices ─────────────────────────────────────────────────────────────
      const retail    = parseFloat(item.retail_price    || item.price || 0);
      const wholesale = parseFloat(item.wholesale_price || retail * 0.45 || 0);

      // ── Stock & MOQ ────────────────────────────────────────────────────────
      const stock = item.stock_quantity ?? item.available_units ?? item.quantity ?? '—';
      const moq   = item.min_order_qty  ?? item.moq ?? 1;

      return {
        ...item,
        // Frontend-ready field names used by the card template
        title         : item.title    || item.name || 'Untitled',
        category      : item.category || '',
        image_urls,                          // always a safe array
        wholesale_usd : wholesale.toFixed(0),
        wholesale_eur : (wholesale * EUR_RATE).toFixed(0),
        srp_usd       : retail,              // template calls Number(retail).toFixed(2)
        srp_eur       : (retail * EUR_RATE).toFixed(0),
        moq,
        stock,
      };
    });

    console.log('Sending', trending.length, 'products to frontend');
    res.json({ trending });
  } catch (err) {
    console.error('Unexpected error in /trending:', err.message);
    next(err);
  }
});

// ── GET /api/marketplace/product/:id — single product detail ─────────────────
router.get('/product/:id', async (req, res, next) => {
  try {
    const { rows: [product] } = await db.query(
      `SELECT p.*,
              b.id AS brand_id, b.brand_name, b.logo_url, b.country,
              bs.slug, bs.min_order_amount, bs.payment_terms, bs.allow_installments, bs.primary_color,
              json_agg(DISTINCT jsonb_build_object(
                'id', pv.id, 'sku', pv.sku, 'size', pv.size, 'color', pv.color,
                'available', GREATEST(0, pv.quantity - pv.reserved_qty)
              )) FILTER (WHERE pv.id IS NOT NULL AND pv.active) AS variants,
              json_agg(DISTINCT jsonb_build_object(
                'tier_name', ptp.tier_name, 'min_qty', ptp.min_qty, 'discount_pct', ptp.discount_pct
              )) FILTER (WHERE ptp.id IS NOT NULL) AS tier_pricing
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       LEFT JOIN brand_stores bs ON bs.brand_id = b.id
       LEFT JOIN product_variants pv ON pv.product_id = p.id
       LEFT JOIN product_tier_pricing ptp ON ptp.product_id = p.id
       WHERE p.id = $1 AND p.status = 'active' AND b.status = 'approved'
       GROUP BY p.id, b.id, bs.slug, bs.min_order_amount, bs.payment_terms, bs.allow_installments, bs.primary_color`,
      [req.params.id]
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) { next(err); }
});

module.exports = router;
