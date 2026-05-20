const router = require('express').Router();
const db = require('../middleware/db');
const { authenticate, requireBrand, requireBuyer, ownBrand } = require('../middleware/auth');

// ── POST /api/orders — place order ──────────────────────────────────────────
router.post('/', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { items, shippingAddress, billingAddress, paymentMethod = 'card', notes, brandId } = req.body;
    if (!items?.length) return res.status(400).json({ error: 'Order items required' });
    if (!brandId) return res.status(400).json({ error: 'Brand ID required' });

    const { rows: [buyer] } = await db.query(
      'SELECT * FROM buyers WHERE user_id = $1', [req.userId]);
    if (!buyer) return res.status(404).json({ error: 'Buyer account not found' });
    if (buyer.status === 'suspended') return res.status(403).json({ error: 'Your account is suspended' });

    await db.transaction(async (client) => {
      let subtotal = 0;
      const orderItems = [];

      // Validate items and compute total
      for (const item of items) {
        const { rows: [variant] } = await client.query(
          `SELECT pv.*, p.name AS product_name, p.brand_id, p.images,
                  GREATEST(0, pv.quantity - pv.reserved_qty) AS available_qty
           FROM product_variants pv
           JOIN products p ON p.id = pv.product_id
           WHERE pv.id = $1 AND p.brand_id = $2 AND pv.active = true AND p.status = 'active'`,
          [item.variantId, brandId]
        );
        if (!variant) throw Object.assign(new Error(`Variant ${item.variantId} not found`), { status: 404 });
        if (variant.available_qty < item.quantity) {
          throw Object.assign(
            new Error(`Insufficient stock for ${variant.product_name} (${variant.size}/${variant.color}). Available: ${variant.available_qty}`),
            { status: 400 }
          );
        }
        const price = parseFloat(variant.wholesale_price || 0);
        const lineTotal = price * item.quantity;
        subtotal += lineTotal;
        orderItems.push({
          productId: variant.product_id,
          variantId: variant.id,
          productName: variant.product_name,
          variantSku: variant.sku,
          size: variant.size,
          color: variant.color,
          imageUrl: variant.image_url || (variant.images || [])[0],
          unitPrice: price,
          quantity: item.quantity,
          lineTotal
        });
      }

      // Get brand commission rate
      const { rows: [brand] } = await client.query(
        'SELECT commission_rate, min_order_amount, max_order_amount FROM brands WHERE id = $1', [brandId]);
      if (subtotal < parseFloat(brand.min_order_amount || 0)) {
        throw Object.assign(
          new Error(`Order total $${subtotal.toFixed(2)} below brand minimum $${brand.min_order_amount}`),
          { status: 400 }
        );
      }

      const commissionRate = (brand.commission_rate || 3) / 100;
      const platformCommission = Math.round(subtotal * commissionRate * 100) / 100;
      const brandPayout = subtotal - platformCommission;

      // Create order
      const { rows: [order] } = await client.query(
        `INSERT INTO orders (buyer_id, brand_id, subtotal, total_amount, currency,
           platform_commission, brand_payout, status, payment_status,
           shipping_address, billing_address, payment_method, buyer_notes)
         VALUES ($1,$2,$3,$3,'USD',$4,$5,'pending','pending',$6,$7,$8,$9)
         RETURNING *`,
        [buyer.id, brandId, subtotal, platformCommission, brandPayout,
         shippingAddress || {}, billingAddress || {}, paymentMethod, notes || null]
      );

      // Create order items + reserve stock
      for (const oi of orderItems) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, variant_id, product_name, variant_sku,
             size, color, image_url, unit_price, quantity, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [order.id, oi.productId, oi.variantId, oi.productName, oi.variantSku,
           oi.size, oi.color, oi.imageUrl, oi.unitPrice, oi.quantity, oi.lineTotal]
        );

        // Reserve stock
        const reserved = await client.query('SELECT reserve_stock($1, $2)', [oi.variantId, oi.quantity]);
        if (!reserved.rows[0].reserve_stock) {
          throw Object.assign(new Error(`Stock reservation failed for ${oi.productName}`), { status: 409 });
        }
      }

      // Update buyer stats
      await client.query(
        'UPDATE buyers SET total_orders = total_orders + 1 WHERE id = $1', [buyer.id]);

      // Notify brand
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         SELECT u.id, 'new_order', 'New Order Received', $1, $2
         FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $3`,
        [`Order ${order.order_number} — $${subtotal.toFixed(2)}`, `/brand/orders/${order.id}`, brandId]
      );

      return res.status(201).json({
        order: { ...order, items: orderItems },
        nextStep: paymentMethod === 'card' ? 'payment' : 'confirmed'
      });
    });
  } catch (err) { next(err); }
});

// ── GET /api/orders — list orders ────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '';
    let params = [];

    if (req.user.role === 'brand') {
      const { rows } = await db.query('SELECT id FROM brands WHERE user_id = $1', [req.userId]);
      if (!rows.length) return res.json({ orders: [] });
      where = 'WHERE o.brand_id = $1';
      params = [rows[0].id];
    } else if (req.user.role === 'buyer') {
      const { rows } = await db.query('SELECT id FROM buyers WHERE user_id = $1', [req.userId]);
      if (!rows.length) return res.json({ orders: [] });
      where = 'WHERE o.buyer_id = $1';
      params = [rows[0].id];
    } else if (req.user.role === 'admin') {
      where = 'WHERE 1=1';
      params = [];
    }

    if (status) { where += ` AND o.status = $${params.length + 1}`; params.push(status); }
    params.push(parseInt(limit), offset);

    const { rows } = await db.query(
      `SELECT o.*, b.name AS brand_name, b.logo_url AS brand_logo,
              buy.company_name AS buyer_company,
              (SELECT JSON_AGG(JSON_BUILD_OBJECT('name', oi.product_name, 'qty', oi.quantity, 'price', oi.unit_price, 'image', oi.image_url))
               FROM order_items oi WHERE oi.order_id = o.id) AS items
       FROM orders o
       JOIN brands b ON b.id = o.brand_id
       JOIN buyers buy ON buy.id = o.buyer_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ orders: rows });
  } catch (err) { next(err); }
});

// ── GET /api/orders/:id ──────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [order] } = await db.query(
      `SELECT o.*, b.name AS brand_name, b.logo_url AS brand_logo,
              buy.company_name AS buyer_company, buy.stripe_customer_id
       FROM orders o JOIN brands b ON b.id = o.brand_id JOIN buyers buy ON buy.id = o.buyer_id
       WHERE o.id = $1`, [req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { rows: items } = await db.query(
      'SELECT * FROM order_items WHERE order_id = $1', [order.id]);

    let installmentPlan = null;
    if (order.installment_plan_id) {
      const { rows: [plan] } = await db.query(
        'SELECT * FROM installment_plans WHERE id = $1', [order.installment_plan_id]);
      if (plan) {
        const { rows: payments } = await db.query(
          'SELECT * FROM installment_payments WHERE plan_id = $1 ORDER BY installment_number',
          [plan.id]);
        installmentPlan = { ...plan, payments };
      }
    }

    res.json({ order, items, installmentPlan });
  } catch (err) { next(err); }
});

// ── PATCH /api/orders/:id/status — update order status ──────────────────────
router.patch('/:id/status', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { status, trackingNumber, notes } = req.body;
    const allowed = ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const { rows: [order] } = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND brand_id = $2', [req.params.id, req.brandId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const updates = { status };
    if (trackingNumber) updates.tracking_number = trackingNumber;
    if (status === 'shipped') updates.shipped_at = new Date();
    if (status === 'delivered') updates.delivered_at = new Date();
    if (status === 'cancelled') {
      updates.cancelled_at = new Date();
      updates.cancel_reason = notes;
      // Release reserved stock
      const { rows: items } = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
      for (const item of items) {
        await db.query('SELECT release_stock($1, $2)', [item.variant_id, item.quantity]);
      }
    } else if (status === 'shipped') {
      // Commit stock on shipment
      const { rows: items } = await db.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
      for (const item of items) {
        await db.query('SELECT commit_stock($1, $2)', [item.variant_id, item.quantity]);
      }
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const params = [...Object.values(updates), req.params.id];
    const { rows: [updated] } = await db.query(
      `UPDATE orders SET ${setClauses}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`, params);

    // Notify buyer
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       SELECT u.id, 'order_update', $1, $2, $3
       FROM buyers b JOIN users u ON u.id = b.user_id WHERE b.id = $4`,
      [`Order ${order.order_number}: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
       trackingNumber ? `Tracking: ${trackingNumber}` : `Your order status has been updated to ${status}`,
       `/orders/${order.id}`, order.buyer_id]
    );

    res.json({ order: updated });
  } catch (err) { next(err); }
});

// ── GET /api/orders/brand/stats ──────────────────────────────────────────────
router.get('/brand/stats', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows: [stats] } = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled','refunded')) AS total_orders,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_orders,
        COUNT(*) FILTER (WHERE status = 'processing') AS processing_orders,
        COUNT(*) FILTER (WHERE status = 'shipped') AS shipped_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'paid'), 0) AS revenue_collected,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'pending' AND status != 'cancelled'), 0) AS revenue_pending,
        COALESCE(AVG(total_amount) FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS avg_order_value,
        COUNT(DISTINCT buyer_id) AS unique_buyers
       FROM orders WHERE brand_id = $1`, [req.brandId]
    );

    const { rows: recentOrders } = await db.query(
      `SELECT o.order_number, o.total_amount, o.status, o.payment_status, o.created_at,
              buy.company_name AS buyer_company
       FROM orders o JOIN buyers buy ON buy.id = o.buyer_id
       WHERE o.brand_id = $1 ORDER BY o.created_at DESC LIMIT 5`,
      [req.brandId]
    );

    const { rows: topProducts } = await db.query(
      `SELECT p.name, SUM(oi.quantity) AS units_sold, SUM(oi.line_total) AS revenue
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       JOIN orders o ON o.id = oi.order_id
       WHERE p.brand_id = $1 AND o.status NOT IN ('cancelled','refunded')
       GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 5`,
      [req.brandId]
    );

    res.json({ stats, recentOrders, topProducts });
  } catch (err) { next(err); }
});

// ── GET /api/orders/brand/payouts — payout dashboard ────────────────────────
router.get('/brand/payouts', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { status } = req.query;
    let cond = 'WHERE o.brand_id = $1 AND o.status NOT IN (\'cancelled\',\'refunded\')';
    const params = [req.brandId];
    if (status) { cond += ` AND o.payout_status = $${params.length + 1}`; params.push(status); }

    const { rows } = await db.query(
      `SELECT o.id, o.order_number, o.total_amount, o.brand_payout,
              o.platform_commission, o.status, o.payout_status, o.payment_status,
              o.tracking_number, o.shipped_at, o.delivered_at, o.created_at,
              buy.company_name AS buyer_company, buy.id AS buyer_id,
              JSON_AGG(JSON_BUILD_OBJECT(
                'name', oi.product_name,
                'qty',  oi.quantity,
                'price', oi.unit_price,
                'image', oi.image_url
              ) ORDER BY oi.id) AS items
       FROM orders o
       JOIN buyers buy ON buy.id = o.buyer_id
       JOIN order_items oi ON oi.order_id = o.id
       ${cond}
       GROUP BY o.id, buy.company_name, buy.id
       ORDER BY o.created_at DESC`,
      params
    );

    // Summary totals
    const { rows: [totals] } = await db.query(
      `SELECT
        COALESCE(SUM(brand_payout) FILTER (WHERE payout_status = 'released'), 0) AS released,
        COALESCE(SUM(brand_payout) FILTER (WHERE payout_status IN ('pending','awaiting_review')), 0) AS pending,
        COALESCE(SUM(brand_payout) FILTER (WHERE payout_status = 'awaiting_review'), 0) AS in_review
       FROM orders WHERE brand_id = $1 AND status NOT IN ('cancelled','refunded')`,
      [req.brandId]
    );

    res.json({ payouts: rows, totals });
  } catch (err) { next(err); }
});

// ── PATCH /api/orders/:id/tracking — submit tracking, trigger payout review ──
router.patch('/:id/tracking', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { trackingNumber, carrier } = req.body;
    if (!trackingNumber?.trim()) return res.status(400).json({ error: 'Tracking number required' });

    const { rows: [order] } = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND brand_id = $2', [req.params.id, req.brandId]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Update tracking + escalate payout status to awaiting_review
    const { rows: [updated] } = await db.query(
      `UPDATE orders
       SET tracking_number = $1,
           carrier = $2,
           status = CASE WHEN status = 'confirmed' OR status = 'processing' THEN 'shipped' ELSE status END,
           shipped_at = CASE WHEN shipped_at IS NULL THEN NOW() ELSE shipped_at END,
           payout_status = 'awaiting_review',
           updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [trackingNumber.trim(), carrier || null, req.params.id]
    );

    // Notify buyer
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       SELECT u.id, 'order_shipped', 'Your order has shipped', $1, $2
       FROM buyers b JOIN users u ON u.id = b.user_id WHERE b.id = $3`,
      [`Tracking: ${trackingNumber}${carrier ? ` via ${carrier}` : ''}`, `/orders/${order.id}`, order.buyer_id]
    );

    // Notify admin for payout review
    await db.query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       SELECT id, 'payout_review', 'Payout Review Required', $1, $2
       FROM users WHERE role = 'admin' LIMIT 1`,
      [`Order ${order.order_number} tracking submitted — ${trackingNumber}. Review for fund release.`,
       `/admin?tab=payouts&order=${order.id}`]
    );

    res.json({ order: updated, message: 'Tracking submitted. The team will review for fund release.' });
  } catch (err) { next(err); }
});

module.exports = router;
