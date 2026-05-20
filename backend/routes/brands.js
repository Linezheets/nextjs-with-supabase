const router = require('express').Router();
const db = require('../middleware/db');
const { authenticate, requireBrand, requireBuyer, ownBrand } = require('../middleware/auth');

const BRAND_SELECT = `
  SELECT b.id, b.name AS brand_name, b.logo_url, b.category, b.description,
         b.website, b.instagram, b.founded_year, b.country,
         bs.store_name, bs.slug, bs.banner_url, bs.brand_story,
         bs.primary_color, bs.min_order_amount, bs.payment_terms, bs.allow_installments,
         b.subscription_tier,
         COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS product_count,
         COUNT(DISTINCT bf.buyer_id) AS follower_count
  FROM brands b
  LEFT JOIN brand_stores bs ON bs.brand_id = b.id
  LEFT JOIN products p ON p.brand_id = b.id
  LEFT JOIN brand_follows bf ON bf.brand_id = b.id`;

const BRAND_GROUP = `GROUP BY b.id, bs.store_name, bs.slug, bs.banner_url, bs.brand_story,
                              bs.primary_color, bs.min_order_amount, bs.payment_terms, bs.allow_installments`;

// ── GET /api/brands/by-slug/:slug — public brand profile by store slug ────────
router.get('/by-slug/:slug', async (req, res, next) => {
  try {
    const { rows: [brand] } = await db.query(
      `${BRAND_SELECT} WHERE bs.slug = $1 AND b.status = 'approved' ${BRAND_GROUP}`,
      [req.params.slug.toLowerCase()]
    );
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    res.json(brand);
  } catch (err) { next(err); }
});

// ── GET /api/brands/:id — public brand profile by UUID ───────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [brand] } = await db.query(
      `${BRAND_SELECT} WHERE b.id = $1 AND b.status = 'approved' ${BRAND_GROUP}`,
      [req.params.id]
    );
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    res.json(brand);
  } catch (err) { next(err); }
});

// ── GET /api/brands/:id/products — brand's public product catalog ─────────────
router.get('/:id/products', async (req, res, next) => {
  try {
    const { category, season, limit = 48, offset = 0 } = req.query;
    const params = [req.params.id];
    let cond = 'WHERE p.brand_id = $1 AND p.status = $2';
    params.push('active');

    if (category) { cond += ` AND p.category = $${params.length + 1}`; params.push(category); }
    if (season)   { cond += ` AND p.season = $${params.length + 1}`; params.push(season); }

    const { rows } = await db.query(
      `SELECT p.id, p.name, p.category, p.season, p.wholesale_price, p.msrp,
              p.images, p.tags, p.min_order_qty, p.delivery_window,
              COUNT(pv.id) AS variant_count,
              SUM(GREATEST(0, pv.quantity - pv.reserved_qty)) AS available_units
       FROM products p
       LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.active = true
       ${cond}
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ products: rows });
  } catch (err) { next(err); }
});

// ── GET /api/brands/me/settings — brand's own full settings ──────────────────
router.get('/me/settings', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows: [brand] } = await db.query(
      `SELECT b.*, bs.*, u.email, u.first_name, u.last_name, u.phone
       FROM brands b
       LEFT JOIN brand_stores bs ON bs.brand_id = b.id
       JOIN users u ON u.id = b.user_id
       WHERE b.id = $1`, [req.brandId]
    );
    res.json(brand);
  } catch (err) { next(err); }
});

// ── PATCH /api/brands/me — update brand profile ───────────────────────────────
router.patch('/me', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { brand_name, description, website, instagram, founded_year, country, category } = req.body;
    await db.query(
      `UPDATE brands SET
         brand_name = COALESCE($1, brand_name),
         description = COALESCE($2, description),
         website = COALESCE($3, website),
         instagram = COALESCE($4, instagram),
         founded_year = COALESCE($5, founded_year),
         country = COALESCE($6, country),
         category = COALESCE($7, category),
         updated_at = NOW()
       WHERE id = $8`,
      [brand_name, description, website, instagram, founded_year, country, category, req.brandId]
    );
    res.json({ message: 'Brand updated' });
  } catch (err) { next(err); }
});

// ── PATCH /api/brands/me/store — update storefront settings ──────────────────
router.patch('/me/store', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const {
      store_name, slug, brand_story, primary_color,
      min_order_amount, payment_terms, allow_installments, instagram
    } = req.body;

    await db.query(
      `INSERT INTO brand_stores (brand_id, store_name, slug, brand_story, primary_color, min_order_amount, payment_terms, allow_installments)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (brand_id) DO UPDATE SET
         store_name = COALESCE(EXCLUDED.store_name, brand_stores.store_name),
         slug = COALESCE(EXCLUDED.slug, brand_stores.slug),
         brand_story = COALESCE(EXCLUDED.brand_story, brand_stores.brand_story),
         primary_color = COALESCE(EXCLUDED.primary_color, brand_stores.primary_color),
         min_order_amount = COALESCE(EXCLUDED.min_order_amount, brand_stores.min_order_amount),
         payment_terms = COALESCE(EXCLUDED.payment_terms, brand_stores.payment_terms),
         allow_installments = COALESCE(EXCLUDED.allow_installments, brand_stores.allow_installments)`,
      [req.brandId, store_name, slug, brand_story, primary_color, min_order_amount, payment_terms, allow_installments]
    );
    res.json({ message: 'Store updated' });
  } catch (err) { next(err); }
});

// ── GET /api/brands/:id/tier-pricing — tiered MOQ pricing ────────────────────
router.get('/:id/tier-pricing', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ptp.*, p.name AS product_name
       FROM product_tier_pricing ptp
       JOIN products p ON p.id = ptp.product_id
       WHERE p.brand_id = $1
       ORDER BY ptp.min_qty ASC`, [req.params.id]
    );
    res.json({ tiers: rows });
  } catch (err) { next(err); }
});

// ── POST /api/brands/me/tier-pricing — set MOQ tiers for a product ───────────
router.post('/me/tier-pricing', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { productId, tiers } = req.body; // tiers: [{tier_name, min_qty, discount_pct, notes}]
    if (!productId || !Array.isArray(tiers)) return res.status(400).json({ error: 'productId and tiers[] required' });

    // Verify product belongs to brand
    const { rows: [p] } = await db.query('SELECT id FROM products WHERE id = $1 AND brand_id = $2', [productId, req.brandId]);
    if (!p) return res.status(404).json({ error: 'Product not found' });

    await db.transaction(async (client) => {
      await client.query('DELETE FROM product_tier_pricing WHERE product_id = $1', [productId]);
      for (const t of tiers) {
        await client.query(
          `INSERT INTO product_tier_pricing (product_id, tier_name, min_qty, discount_pct, notes)
           VALUES ($1,$2,$3,$4,$5)`,
          [productId, t.tier_name, t.min_qty, t.discount_pct || 0, t.notes]
        );
      }
    });
    res.json({ message: 'Tier pricing updated', count: tiers.length });
  } catch (err) { next(err); }
});

// ── POST /api/brands/:id/follow — buyer follows a brand ──────────────────────
router.post('/:id/follow', authenticate, requireBuyer, async (req, res, next) => {
  try {
    await db.query(
      `INSERT INTO brand_follows (brand_id, buyer_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.buyerId]
    );
    res.json({ following: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/brands/:id/follow — unfollow ─────────────────────────────────
router.delete('/:id/follow', authenticate, requireBuyer, async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM brand_follows WHERE brand_id = $1 AND buyer_id = $2',
      [req.params.id, req.buyerId]
    );
    res.json({ following: false });
  } catch (err) { next(err); }
});

// ── GET /api/brands/me/notifications ─────────────────────────────────────────
router.get('/me/notifications', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT n.*, u.id AS user_id FROM notifications n
       JOIN users u ON u.id = n.user_id
       JOIN brands b ON b.user_id = u.id
       WHERE b.id = $1
       ORDER BY n.created_at DESC LIMIT 50`, [req.brandId]
    );
    res.json({ notifications: rows });
  } catch (err) { next(err); }
});

module.exports = router;
