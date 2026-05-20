const router = require('express').Router();
const db = require('../middleware/db');
const { authenticate, requireBrand, ownBrand } = require('../middleware/auth');

// ── GET /api/inventory — brand's full inventory ───────────────────────────────
router.get('/', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { low_stock, product_id } = req.query;
    let cond = 'WHERE p.brand_id = $1 AND pv.active = true';
    const params = [req.brandId];

    if (product_id) { cond += ` AND p.id = $${params.length + 1}`; params.push(product_id); }
    if (low_stock === 'true') cond += ' AND (pv.quantity - pv.reserved_qty) <= pv.reorder_point';

    const { rows } = await db.query(
      `SELECT pv.id, pv.sku, pv.size, pv.color, pv.quantity, pv.reserved_qty,
              GREATEST(0, pv.quantity - pv.reserved_qty) AS available_qty,
              pv.reorder_point, pv.warehouse, pv.bin_location, pv.updated_at,
              p.id AS product_id, p.name AS product_name, p.season,
              p.images[1] AS product_image
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       ${cond}
       ORDER BY p.name, pv.size, pv.color`,
      params
    );

    const summary = {
      total_variants: rows.length,
      total_units: rows.reduce((s, r) => s + parseInt(r.quantity || 0), 0),
      reserved_units: rows.reduce((s, r) => s + parseInt(r.reserved_qty || 0), 0),
      available_units: rows.reduce((s, r) => s + parseInt(r.available_qty || 0), 0),
      low_stock_count: rows.filter(r => parseInt(r.available_qty) <= parseInt(r.reorder_point)).length,
      out_of_stock_count: rows.filter(r => parseInt(r.available_qty) === 0).length,
    };

    res.json({ inventory: rows, summary });
  } catch (err) { next(err); }
});

// ── POST /api/inventory/adjust — manual stock adjustment ─────────────────────
router.post('/adjust', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { variantId, adjustment, type = 'set', reason = 'manual' } = req.body;
    // type: 'add' | 'subtract' | 'set'

    const { rows: [v] } = await db.query(
      `SELECT pv.* FROM product_variants pv JOIN products p ON p.id = pv.product_id
       WHERE pv.id = $1 AND p.brand_id = $2`, [variantId, req.brandId]);
    if (!v) return res.status(404).json({ error: 'Variant not found' });

    const qty = parseInt(adjustment);
    const before = parseInt(v.quantity);
    let after;

    if (type === 'set') after = Math.max(0, qty);
    else if (type === 'add') after = before + Math.abs(qty);
    else if (type === 'subtract') after = Math.max(0, before - Math.abs(qty));
    else return res.status(400).json({ error: 'Invalid type' });

    await db.transaction(async (client) => {
      await client.query(
        'UPDATE product_variants SET quantity = $1, updated_at = NOW() WHERE id = $2',
        [after, variantId]
      );
      await client.query(
        `INSERT INTO inventory_sync_log (brand_id, variant_id, source, change_type, qty_before, qty_change, qty_after)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [req.brandId, variantId, reason, type, before, after - before, after]
      );
    });

    res.json({ variantId, before, after, change: after - before });
  } catch (err) { next(err); }
});

// ── POST /api/inventory/bulk-adjust — CSV/bulk update ────────────────────────
router.post('/bulk-adjust', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { adjustments } = req.body; // [{sku, quantity}]
    if (!Array.isArray(adjustments)) return res.status(400).json({ error: 'adjustments array required' });

    const results = [];
    for (const adj of adjustments) {
      try {
        const { rows: [v] } = await db.query(
          `SELECT pv.* FROM product_variants pv JOIN products p ON p.id = pv.product_id
           WHERE pv.sku = $1 AND p.brand_id = $2`, [adj.sku, req.brandId]);
        if (!v) { results.push({ sku: adj.sku, error: 'Not found' }); continue; }

        const before = parseInt(v.quantity);
        const after = Math.max(0, parseInt(adj.quantity));
        await db.query('UPDATE product_variants SET quantity = $1 WHERE id = $2', [after, v.id]);
        await db.query(
          `INSERT INTO inventory_sync_log (brand_id, variant_id, source, change_type, qty_before, qty_change, qty_after)
           VALUES ($1,$2,'bulk_import','set',$3,$4,$5)`,
          [req.brandId, v.id, before, after - before, after]
        );
        results.push({ sku: adj.sku, before, after, ok: true });
      } catch (e) { results.push({ sku: adj.sku, error: e.message }); }
    }
    res.json({ results, updated: results.filter(r => r.ok).length });
  } catch (err) { next(err); }
});

// ── GET /api/inventory/low-stock-alerts ─────────────────────────────────────
router.get('/low-stock-alerts', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT pv.sku, pv.size, pv.color, pv.quantity, pv.reserved_qty,
              GREATEST(0, pv.quantity - pv.reserved_qty) AS available_qty,
              pv.reorder_point, p.name AS product_name, p.id AS product_id
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE p.brand_id = $1 AND pv.active = true
       AND (pv.quantity - pv.reserved_qty) <= pv.reorder_point
       ORDER BY (pv.quantity - pv.reserved_qty) ASC`,
      [req.brandId]
    );
    res.json({ alerts: rows, count: rows.length });
  } catch (err) { next(err); }
});

// ── GET /api/inventory/log ────────────────────────────────────────────────────
router.get('/log', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT isl.*, pv.sku, p.name AS product_name
       FROM inventory_sync_log isl
       JOIN product_variants pv ON pv.id = isl.variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE isl.brand_id = $1
       ORDER BY isl.created_at DESC LIMIT 200`,
      [req.brandId]
    );
    res.json({ log: rows });
  } catch (err) { next(err); }
});

module.exports = router;
