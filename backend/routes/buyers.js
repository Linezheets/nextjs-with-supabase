const router = require('express').Router();
const db = require('../middleware/db');
const { authenticate, requireBuyer } = require('../middleware/auth');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── GET /api/buyers/profile ───────────────────────────────────────────────────
router.get('/profile', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { rows: [buyer] } = await db.query(
      `SELECT b.*, u.email, u.first_name, u.last_name, u.phone,
              bv.status AS verification_status, bv.submitted_at AS verification_submitted
       FROM buyers b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN buyer_verifications bv ON bv.buyer_id = b.id
       WHERE b.id = $1`, [req.buyerId]
    );
    res.json(buyer);
  } catch (err) { next(err); }
});

// ── PATCH /api/buyers/profile — update buyer profile ─────────────────────────
router.patch('/profile', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const {
      company_name, business_type, website, instagram,
      billing_address, shipping_address, style_preferences,
      price_range_min, price_range_max
    } = req.body;

    await db.query(
      `UPDATE buyers SET
         company_name = COALESCE($1, company_name),
         business_type = COALESCE($2, business_type),
         website = COALESCE($3, website),
         instagram = COALESCE($4, instagram),
         billing_address = COALESCE($5, billing_address),
         shipping_address = COALESCE($6, shipping_address),
         style_preferences = COALESCE($7, style_preferences),
         price_range_min = COALESCE($8, price_range_min),
         price_range_max = COALESCE($9, price_range_max),
         updated_at = NOW()
       WHERE id = $10`,
      [company_name, business_type, website, instagram,
       billing_address ? JSON.stringify(billing_address) : null,
       shipping_address ? JSON.stringify(shipping_address) : null,
       style_preferences, price_range_min, price_range_max,
       req.buyerId]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) { next(err); }
});

// ── POST /api/buyers/verify — submit verification docs ───────────────────────
router.post('/verify', authenticate, requireBuyer,
  upload.single('business_license'), async (req, res, next) => {
  try {
    const { tax_id, business_type, annual_revenue, years_in_business, store_count, buying_categories } = req.body;

    let licenseUrl = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const key = `verifications/${req.buyerId}/${uuidv4()}${ext}`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));
      licenseUrl = `${process.env.AWS_S3_ENDPOINT}/${process.env.AWS_BUCKET_NAME}/${key}`;
    }

    await db.query(
      `INSERT INTO buyer_verifications
         (buyer_id, tax_id, business_license_url, business_type, annual_revenue,
          years_in_business, store_count, buying_categories, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
       ON CONFLICT (buyer_id) DO UPDATE SET
         tax_id = EXCLUDED.tax_id,
         business_license_url = COALESCE(EXCLUDED.business_license_url, buyer_verifications.business_license_url),
         business_type = EXCLUDED.business_type,
         annual_revenue = EXCLUDED.annual_revenue,
         years_in_business = EXCLUDED.years_in_business,
         store_count = EXCLUDED.store_count,
         buying_categories = EXCLUDED.buying_categories,
         status = 'pending',
         submitted_at = NOW()`,
      [req.buyerId, tax_id, licenseUrl, business_type, annual_revenue,
       years_in_business, store_count,
       buying_categories ? JSON.parse(buying_categories) : []]
    );

    // Notify admins
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body)
       SELECT id, 'buyer_verification', 'New Buyer Verification', $1 FROM users WHERE role = 'admin'`,
      [`New buyer verification submitted — review required.`]
    );

    res.json({ message: 'Verification submitted. Our team will review within 1–2 business days.' });
  } catch (err) { next(err); }
});

// ── GET /api/buyers/verification-status ──────────────────────────────────────
router.get('/verification-status', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { rows: [v] } = await db.query(
      'SELECT status, submitted_at, reviewed_at, rejection_reason FROM buyer_verifications WHERE buyer_id = $1',
      [req.buyerId]
    );
    res.json(v || { status: 'not_submitted' });
  } catch (err) { next(err); }
});

// ── GET /api/buyers/saved — saved/wishlist items ──────────────────────────────
router.get('/saved', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT si.id, si.created_at,
              p.id AS product_id, p.name, p.season, p.wholesale_price, p.msrp,
              p.images[1] AS image,
              b.brand_name, b.id AS brand_id
       FROM saved_items si
       JOIN products p ON p.id = si.product_id
       JOIN brands b ON b.id = p.brand_id
       WHERE si.buyer_id = $1 AND p.status = 'active'
       ORDER BY si.created_at DESC`, [req.buyerId]
    );
    res.json({ saved: rows });
  } catch (err) { next(err); }
});

// ── POST /api/buyers/saved/:productId ────────────────────────────────────────
router.post('/saved/:productId', authenticate, requireBuyer, async (req, res, next) => {
  try {
    await db.query(
      `INSERT INTO saved_items (buyer_id, product_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.buyerId, req.params.productId]
    );
    res.json({ saved: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/buyers/saved/:productId ──────────────────────────────────────
router.delete('/saved/:productId', authenticate, requireBuyer, async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM saved_items WHERE buyer_id = $1 AND product_id = $2',
      [req.buyerId, req.params.productId]
    );
    res.json({ saved: false });
  } catch (err) { next(err); }
});

// ── GET /api/buyers/cart ──────────────────────────────────────────────────────
router.get('/cart', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ci.id, ci.quantity, ci.added_at,
              pv.id AS variant_id, pv.sku, pv.size, pv.color,
              GREATEST(0, pv.quantity - pv.reserved_qty) AS available,
              p.id AS product_id, p.name, p.wholesale_price, p.msrp, p.images[1] AS image,
              b.brand_name, b.id AS brand_id
       FROM cart_items ci
       JOIN product_variants pv ON pv.id = ci.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN brands b ON b.id = p.brand_id
       WHERE ci.buyer_id = $1 AND p.status = 'active'
       ORDER BY ci.added_at DESC`, [req.buyerId]
    );

    const total = rows.reduce((s, r) => s + (parseFloat(r.wholesale_price) * r.quantity), 0);
    res.json({ cart: rows, total: total.toFixed(2), item_count: rows.length });
  } catch (err) { next(err); }
});

// ── POST /api/buyers/cart — add to cart ──────────────────────────────────────
router.post('/cart', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { variantId, quantity = 1 } = req.body;
    if (!variantId || quantity < 1) return res.status(400).json({ error: 'variantId and quantity required' });

    // Check stock
    const { rows: [v] } = await db.query(
      `SELECT pv.*, GREATEST(0, pv.quantity - pv.reserved_qty) AS available
       FROM product_variants pv JOIN products p ON p.id = pv.product_id
       WHERE pv.id = $1 AND p.status = 'active'`, [variantId]
    );
    if (!v) return res.status(404).json({ error: 'Variant not found' });
    if (parseInt(v.available) < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    await db.query(
      `INSERT INTO cart_items (buyer_id, variant_id, quantity)
       VALUES ($1,$2,$3)
       ON CONFLICT (buyer_id, variant_id) DO UPDATE SET quantity = EXCLUDED.quantity, added_at = NOW()`,
      [req.buyerId, variantId, quantity]
    );
    res.json({ added: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/buyers/cart/:variantId ───────────────────────────────────────
router.delete('/cart/:variantId', authenticate, requireBuyer, async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM cart_items WHERE buyer_id = $1 AND variant_id = $2',
      [req.buyerId, req.params.variantId]
    );
    res.json({ removed: true });
  } catch (err) { next(err); }
});

// ── GET /api/buyers/orders — buyer's order history ───────────────────────────
router.get('/orders', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT o.id, o.order_number, o.status, o.payment_status, o.total_amount,
              o.created_at, o.tracking_number, o.shipped_at, o.delivered_at,
              b.brand_name, b.id AS brand_id,
              COUNT(oi.id) AS item_count
       FROM orders o
       JOIN brands b ON b.id = o.brand_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.buyer_id = $1
       GROUP BY o.id, b.brand_name, b.id
       ORDER BY o.created_at DESC`, [req.buyerId]
    );
    res.json({ orders: rows });
  } catch (err) { next(err); }
});

// ── GET /api/buyers/followed-brands ──────────────────────────────────────────
router.get('/followed-brands', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT b.id, b.brand_name, b.logo_url, b.category, b.subscription_tier,
              bf.followed_at
       FROM brand_follows bf
       JOIN brands b ON b.id = bf.brand_id
       WHERE bf.buyer_id = $1 AND b.status = 'approved'
       ORDER BY bf.followed_at DESC`, [req.buyerId]
    );
    res.json({ brands: rows });
  } catch (err) { next(err); }
});

module.exports = router;
