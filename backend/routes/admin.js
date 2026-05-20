const router = require('express').Router();
const db = require('../middleware/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin routes require admin role
router.use(authenticate, requireAdmin);

// ── GET /api/admin/stats — platform overview ──────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const [brands, buyers, orders, gmv] = await Promise.all([
      db.query(`SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'suspended') AS suspended,
        COUNT(*) AS total FROM brands`),
      db.query(`SELECT
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'verified') AS verified,
        COUNT(*) AS total FROM buyers`),
      db.query(`SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30d FROM orders`),
      db.query(`SELECT COALESCE(SUM(total_amount),0) AS total_gmv,
        COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN total_amount END),0) AS gmv_30d
        FROM orders WHERE payment_status = 'paid'`),
    ]);
    res.json({
      brands: brands.rows[0],
      buyers: buyers.rows[0],
      orders: orders.rows[0],
      gmv:    gmv.rows[0],
    });
  } catch (err) { next(err); }
});

// ── GET /api/admin/brands — list brands (filterable by status) ────────────────
router.get('/brands', async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const params = [];
    let where = '';
    if (status) { where = 'WHERE b.status = $1'; params.push(status); }

    const { rows } = await db.query(
      `SELECT b.id, b.brand_name, b.status, b.subscription_tier, b.subscription_status,
              b.stripe_account_status, b.created_at,
              u.email, u.first_name, u.last_name,
              COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS product_count
       FROM brands b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN products p ON p.brand_id = b.id
       ${where}
       GROUP BY b.id, u.email, u.first_name, u.last_name
       ORDER BY b.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ brands: rows });
  } catch (err) { next(err); }
});

// ── PATCH /api/admin/brands/:id/status — approve / suspend brand ──────────────
router.patch('/brands/:id/status', async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    if (!['approved', 'suspended', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    await db.query(
      'UPDATE brands SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, req.params.id]
    );

    // Notify brand
    const msg = status === 'approved'
      ? 'Your brand has been approved! You can now list products on the marketplace.'
      : `Your brand account has been ${status}. ${reason || ''}`;

    await db.query(
      `INSERT INTO notifications (user_id, type, title, body)
       SELECT u.id, $1, $2, $3 FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $4`,
      [`brand_${status}`, `Brand ${status.charAt(0).toUpperCase() + status.slice(1)}`, msg, req.params.id]
    );

    res.json({ message: `Brand ${status}` });
  } catch (err) { next(err); }
});

// ── GET /api/admin/buyers — list buyers (filterable) ─────────────────────────
router.get('/buyers', async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const params = [];
    let where = '';
    if (status) { where = 'WHERE b.status = $1'; params.push(status); }

    const { rows } = await db.query(
      `SELECT b.id, b.company_name, b.business_type, b.status, b.payment_score,
              b.total_orders, b.total_spent, b.created_at,
              u.email, u.first_name, u.last_name,
              bv.status AS verification_status, bv.submitted_at
       FROM buyers b
       JOIN users u ON u.id = b.user_id
       LEFT JOIN buyer_verifications bv ON bv.buyer_id = b.id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ buyers: rows });
  } catch (err) { next(err); }
});

// ── GET /api/admin/verifications — buyer verification queue ───────────────────
router.get('/verifications', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT bv.*, b.company_name, b.business_type, b.ein, b.website,
              u.email, u.first_name, u.last_name, u.phone
       FROM buyer_verifications bv
       JOIN buyers b ON b.id = bv.buyer_id
       JOIN users u ON u.id = b.user_id
       WHERE bv.status = 'pending'
       ORDER BY bv.submitted_at ASC`
    );
    res.json({ verifications: rows, count: rows.length });
  } catch (err) { next(err); }
});

// ── POST /api/admin/verifications/:buyerId/approve ────────────────────────────
router.post('/verifications/:buyerId/approve', async (req, res, next) => {
  try {
    await db.transaction(async (client) => {
      await client.query(
        `UPDATE buyer_verifications SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
         WHERE buyer_id = $2`,
        [req.userId, req.params.buyerId]
      );
      await client.query(
        `UPDATE buyers SET status = 'verified', verified_at = NOW() WHERE id = $1`,
        [req.params.buyerId]
      );
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body)
         SELECT u.id, 'buyer_approved', 'You''re Verified!',
                'Your business has been verified. You now have full access to the Linezheets marketplace.'
         FROM buyers b JOIN users u ON u.id = b.user_id WHERE b.id = $1`,
        [req.params.buyerId]
      );
    });
    res.json({ message: 'Buyer approved' });
  } catch (err) { next(err); }
});

// ── POST /api/admin/verifications/:buyerId/reject ─────────────────────────────
router.post('/verifications/:buyerId/reject', async (req, res, next) => {
  try {
    const { reason = 'Your application did not meet our requirements.' } = req.body;

    await db.transaction(async (client) => {
      await client.query(
        `UPDATE buyer_verifications SET status = 'rejected', rejection_reason = $1,
         reviewed_by = $2, reviewed_at = NOW() WHERE buyer_id = $3`,
        [reason, req.userId, req.params.buyerId]
      );
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body)
         SELECT u.id, 'buyer_rejected', 'Verification Update', $1
         FROM buyers b JOIN users u ON u.id = b.user_id WHERE b.id = $2`,
        [reason, req.params.buyerId]
      );
    });
    res.json({ message: 'Verification rejected' });
  } catch (err) { next(err); }
});

// ── GET /api/admin/orders — all orders ───────────────────────────────────────
router.get('/orders', async (req, res, next) => {
  try {
    const { status, limit = 100, offset = 0 } = req.query;
    const params = [];
    let where = '';
    if (status) { where = 'WHERE o.status = $1'; params.push(status); }

    const { rows } = await db.query(
      `SELECT o.id, o.order_number, o.status, o.payment_status, o.total_amount,
              o.commission_amount, o.payment_method, o.created_at,
              b.brand_name, buy.company_name
       FROM orders o
       JOIN brands b ON b.id = o.brand_id
       JOIN buyers buy ON buy.id = o.buyer_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({ orders: rows });
  } catch (err) { next(err); }
});

// ── GET /api/admin/revenue — revenue breakdown ────────────────────────────────
router.get('/revenue', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT DATE_TRUNC('month', created_at) AS month,
              SUM(total_amount) AS gmv,
              SUM(commission_amount) AS platform_revenue,
              COUNT(*) AS order_count
       FROM orders WHERE payment_status = 'paid'
       GROUP BY month ORDER BY month DESC LIMIT 12`
    );
    res.json({ revenue: rows });
  } catch (err) { next(err); }
});

// ── PATCH /api/admin/buyers/:id/status ───────────────────────────────────────
router.patch('/buyers/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['verified', 'pending', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    await db.query('UPDATE buyers SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
    res.json({ message: `Buyer ${status}` });
  } catch (err) { next(err); }
});

module.exports = router;
