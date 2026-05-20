const router = require('express').Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../middleware/db');
const { authenticate, requireBrand, ownBrand, requireActiveSubscription } = require('../middleware/auth');

// File upload — in production, pipe to Supabase Storage or S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files allowed'));
    }
    cb(null, true);
  }
});

async function uploadToStorage(buffer, filename, mimetype) {
  // Supabase Storage upload
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const path = `products/${uuidv4()}-${filename}`;
  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET || 'linezheets-media')
    .upload(path, buffer, { contentType: mimetype, upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET || 'linezheets-media')
    .getPublicUrl(path);
  return urlData.publicUrl;
}

// ── GET /api/products — public marketplace listing ───────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const {
      category, brand_id, season, min_price, max_price,
      status = 'active', search, sort = 'created_at', order = 'DESC',
      page = 1, limit = 24
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ["p.status = $1"];
    const params = [status];
    let idx = 2;

    if (category) { conditions.push(`c.slug = $${idx++}`); params.push(category); }
    if (brand_id) { conditions.push(`p.brand_id = $${idx++}`); params.push(brand_id); }
    if (season) { conditions.push(`p.season = $${idx++}`); params.push(season); }
    if (min_price) { conditions.push(`p.wholesale_price >= $${idx++}`); params.push(parseFloat(min_price)); }
    if (max_price) { conditions.push(`p.wholesale_price <= $${idx++}`); params.push(parseFloat(max_price)); }
    if (search) {
      conditions.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx} OR b.name ILIKE $${idx})`);
      params.push(`%${search}%`); idx++;
    }
    // Only show products from approved brands
    conditions.push("b.status = 'approved'");

    const where = conditions.join(' AND ');
    const allowedSort = { created_at: 'p.created_at', price: 'p.wholesale_price', name: 'p.name', popular: 'p.total_sold' };
    const sortCol = allowedSort[sort] || 'p.created_at';
    const sortDir = order === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM products p
       JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${where}`, params
    );

    params.push(parseInt(limit), offset);
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.slug, p.wholesale_price, p.retail_price, p.images,
              p.season, p.min_order_qty, p.tags, p.total_sold, p.featured,
              b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug, b.logo_url AS brand_logo,
              c.name AS category_name, c.slug AS category_slug,
              (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.active = true AND pv.quantity > 0) AS variant_count
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${where}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );

    res.json({
      products: rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (err) { next(err); }
});

// ── GET /api/products/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug, b.logo_url AS brand_logo,
              b.min_order_amount AS brand_min_order, b.allow_installments,
              c.name AS category_name
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1 OR (p.slug = $1 AND b.status = 'approved')`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });

    const variants = await db.query(
      `SELECT id, size, color, color_hex, sku, wholesale_price, quantity, reserved_qty,
              GREATEST(0, quantity - reserved_qty) AS available_qty, image_url, sort_order
       FROM product_variants WHERE product_id = $1 AND active = true ORDER BY sort_order`,
      [rows[0].id]
    );

    // Track view
    await db.query('UPDATE products SET total_views = total_views + 1 WHERE id = $1', [rows[0].id]);

    res.json({ product: rows[0], variants: variants.rows });
  } catch (err) { next(err); }
});

// ── Brand: List own products ─────────────────────────────────────────────────
router.get('/brand/mine', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const cond = status ? `AND p.status = '${status}'` : '';

    const { rows } = await db.query(
      `SELECT p.*, c.name AS category_name,
              (SELECT SUM(pv.quantity) FROM product_variants pv WHERE pv.product_id = p.id AND pv.active = true) AS total_stock,
              (SELECT COUNT(*) FROM product_variants pv WHERE pv.product_id = p.id AND pv.active = true AND pv.quantity <= pv.reorder_point) AS low_stock_variants
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.brand_id = $1 ${cond}
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.brandId, parseInt(limit), offset]
    );
    res.json({ products: rows });
  } catch (err) { next(err); }
});

// ── POST /api/products — create product ──────────────────────────────────────
router.post('/', authenticate, requireBrand, ownBrand, requireActiveSubscription, upload.array('images', 10), async (req, res, next) => {
  try {
    const {
      name, description, categoryId, wholesalePrice, retailPrice, msrp,
      season, deliveryWindow, minOrderQty, tags, styleDna,
      skuPrefix, styleNumber, storyText, careInstructions
    } = req.body;

    if (!name || !wholesalePrice) return res.status(400).json({ error: 'Name and wholesale price required' });

    // Upload images
    let imageUrls = [];
    if (req.files?.length) {
      for (const file of req.files) {
        try {
          const url = await uploadToStorage(file.buffer, file.originalname, file.mimetype);
          imageUrls.push(url);
        } catch (e) {
          console.error('Image upload error:', e.message);
        }
      }
    }
    // Also accept pre-uploaded URLs
    if (req.body.imageUrls) {
      const extra = Array.isArray(req.body.imageUrls) ? req.body.imageUrls : [req.body.imageUrls];
      imageUrls = [...imageUrls, ...extra];
    }

    const slugify = require('slugify');
    let slug = slugify(name, { lower: true, strict: true });
    const existing = await db.query('SELECT id FROM products WHERE brand_id = $1 AND slug = $2', [req.brandId, slug]);
    if (existing.rows.length) slug += '-' + Date.now().toString(36);

    const tagsArr = tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [];
    const dna = typeof styleDna === 'string' ? JSON.parse(styleDna || '{}') : (styleDna || {});

    const { rows: [product] } = await db.query(
      `INSERT INTO products (
        brand_id, category_id, name, slug, description, story, care_instructions,
        wholesale_price, retail_price, msrp, sku_prefix, style_number,
        season, delivery_window, min_order_qty, images, tags, style_dna, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'draft')
      RETURNING *`,
      [
        req.brandId, categoryId || null, name, slug, description, storyText, careInstructions,
        parseFloat(wholesalePrice), parseFloat(retailPrice || 0) || null, parseFloat(msrp || 0) || null,
        skuPrefix, styleNumber, season, deliveryWindow,
        parseInt(minOrderQty || 1),
        imageUrls,
        tagsArr, dna
      ]
    );

    await db.query('UPDATE brands SET total_products = total_products + 1 WHERE id = $1', [req.brandId]);
    res.status(201).json({ product });
  } catch (err) { next(err); }
});

// ── PATCH /api/products/:id — update product ─────────────────────────────────
router.patch('/:id', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows: [existing] } = await db.query(
      'SELECT id FROM products WHERE id = $1 AND brand_id = $2', [req.params.id, req.brandId]);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const allowed = ['name','description','story','care_instructions','wholesale_price','retail_price',
      'msrp','season','delivery_window','min_order_qty','tags','images','status','featured','category_id','style_dna'];
    const updates = [];
    const params = [];
    let idx = 1;
    for (const [key, val] of Object.entries(req.body)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowed.includes(col)) { updates.push(`${col} = $${idx++}`); params.push(val); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows: [product] } = await db.query(
      `UPDATE products SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`, params);
    res.json({ product });
  } catch (err) { next(err); }
});

// ── POST /api/products/:id/variants — add variant ────────────────────────────
router.post('/:id/variants', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows: [p] } = await db.query(
      'SELECT id FROM products WHERE id = $1 AND brand_id = $2', [req.params.id, req.brandId]);
    if (!p) return res.status(404).json({ error: 'Product not found' });

    const variants = Array.isArray(req.body) ? req.body : [req.body];
    const created = [];
    for (const v of variants) {
      const { size, color, colorHex, sku, quantity = 0, wholesalePrice, reorderPoint = 5, binLocation, imageUrl } = v;
      if (!sku) continue;
      const { rows: [variant] } = await db.query(
        `INSERT INTO product_variants (product_id, size, color, color_hex, sku, quantity, wholesale_price, reorder_point, bin_location, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (sku) DO UPDATE
         SET quantity = EXCLUDED.quantity, updated_at = NOW() RETURNING *`,
        [p.id, size, color, colorHex, sku, parseInt(quantity), wholesalePrice || null, parseInt(reorderPoint), binLocation, imageUrl]
      );
      created.push(variant);
    }
    res.status(201).json({ variants: created });
  } catch (err) { next(err); }
});

// ── DELETE /api/products/:id ─────────────────────────────────────────────────
router.delete('/:id', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `UPDATE products SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND brand_id = $2 RETURNING id`, [req.params.id, req.brandId]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product archived' });
  } catch (err) { next(err); }
});

module.exports = router;
