const router = require('express').Router();
const db = require('../middleware/db');
const { authenticate, requireBrand, ownBrand } = require('../middleware/auth');
const crypto = require('crypto');

const ENCRYPT_KEY = process.env.TOKEN_ENCRYPT_KEY || crypto.randomBytes(32).toString('hex');

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPT_KEY, 'hex'), iv);
  return iv.toString('hex') + ':' + Buffer.concat([cipher.update(text), cipher.final()]).toString('hex');
}

function decrypt(enc) {
  const [ivHex, data] = enc.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPT_KEY, 'hex'), Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString();
}

// ── GET /api/integrations — list brand's connected integrations ───────────────
router.get('/', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, platform, shop_domain, external_id, active, connected_at, last_sync_at
       FROM integration_configs WHERE brand_id = $1 AND active = true`,
      [req.brandId]
    );
    res.json({ integrations: rows });
  } catch (err) { next(err); }
});

// ── DELETE /api/integrations/:platform — disconnect ───────────────────────────
router.delete('/:platform', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    await db.query(
      'UPDATE integration_configs SET active = false WHERE brand_id = $1 AND platform = $2',
      [req.brandId, req.params.platform]
    );
    res.json({ message: `${req.params.platform} disconnected` });
  } catch (err) { next(err); }
});

// ─── SHOPIFY ────────────────────────────────────────────────────────────────

// GET /api/integrations/shopify/auth — start OAuth install flow
router.get('/shopify/auth', authenticate, requireBrand, ownBrand, (req, res) => {
  if (!process.env.SHOPIFY_CLIENT_ID || !process.env.SHOPIFY_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Shopify integration not configured' });
  }
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'shop parameter required (e.g. my-brand.myshopify.com)' });

  const scopes = 'read_products,write_products,read_inventory,write_inventory,read_orders,write_orders';
  const state = Buffer.from(JSON.stringify({ brandId: req.brandId, ts: Date.now() })).toString('base64');
  const redirectUri = `${process.env.APP_URL}/api/integrations/shopify/callback`;

  const url = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  res.json({ authUrl: url });
});

// GET /api/integrations/shopify/callback — handle OAuth redirect
router.get('/shopify/callback', async (req, res, next) => {
  try {
    const { shop, code, state } = req.query;
    const { brandId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });
    const { access_token } = await tokenRes.json();
    if (!access_token) return res.status(400).json({ error: 'Shopify token exchange failed' });

    // Get shop info
    const shopRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': access_token }
    });
    const { shop: shopInfo } = await shopRes.json();

    await db.query(
      `INSERT INTO integration_configs (brand_id, platform, access_token, shop_domain, external_id, config)
       VALUES ($1,'shopify',$2,$3,$4,$5)
       ON CONFLICT (brand_id, platform) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         shop_domain = EXCLUDED.shop_domain,
         external_id = EXCLUDED.external_id,
         config = EXCLUDED.config,
         active = true, connected_at = NOW()`,
      [brandId, encrypt(access_token), shop, shopInfo.id,
       JSON.stringify({ name: shopInfo.name, email: shopInfo.email, currency: shopInfo.currency })]
    );

    res.redirect(`/pages/brand-dashboard.html?view=integrations&connected=shopify`);
  } catch (err) { next(err); }
});

// POST /api/integrations/shopify/push-products — push brand products to Shopify
router.post('/shopify/push-products', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows: [cfg] } = await db.query(
      `SELECT * FROM integration_configs WHERE brand_id = $1 AND platform = 'shopify' AND active = true`,
      [req.brandId]
    );
    if (!cfg) return res.status(400).json({ error: 'Shopify not connected' });

    const token = decrypt(cfg.access_token);
    const { productIds } = req.body; // optional subset

    let query = `SELECT p.*, json_agg(pv) AS variants FROM products p
                 LEFT JOIN product_variants pv ON pv.product_id = p.id
                 WHERE p.brand_id = $1 AND p.status = 'active'`;
    const params = [req.brandId];
    if (productIds?.length) { query += ` AND p.id = ANY($2)`; params.push(productIds); }
    query += ` GROUP BY p.id`;

    const { rows: products } = await db.query(query, params);
    const results = [];

    for (const p of products) {
      const shopifyProduct = {
        product: {
          title: p.name,
          body_html: p.description || '',
          vendor: (await db.query('SELECT brand_name FROM brands WHERE id = $1', [req.brandId])).rows[0]?.brand_name,
          product_type: p.category || '',
          tags: (p.tags || []).join(','),
          variants: (p.variants || []).filter(v => v).map(v => ({
            sku: v.sku,
            price: (p.msrp || p.wholesale_price * 2.5).toFixed(2),
            compare_at_price: p.msrp ? p.msrp.toFixed(2) : null,
            option1: v.size,
            option2: v.color,
            inventory_management: 'shopify',
            inventory_quantity: v.quantity - v.reserved_qty,
          })),
          options: [{ name: 'Size' }, { name: 'Color' }],
        }
      };

      const r = await fetch(`https://${cfg.shop_domain}/admin/api/2024-01/products.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify(shopifyProduct),
      });
      const data = await r.json();
      results.push({ productId: p.id, shopifyId: data.product?.id, ok: r.ok });
    }

    await db.query('UPDATE integration_configs SET last_sync_at = NOW() WHERE id = $1', [cfg.id]);
    res.json({ pushed: results.filter(r => r.ok).length, results });
  } catch (err) { next(err); }
});

// ─── SQUARE ─────────────────────────────────────────────────────────────────

// GET /api/integrations/square/auth — start Square OAuth
router.get('/square/auth', authenticate, requireBrand, ownBrand, (req, res) => {
  const state = Buffer.from(JSON.stringify({ brandId: req.brandId, ts: Date.now() })).toString('base64');
  const scopes = 'ITEMS_READ ITEMS_WRITE INVENTORY_READ INVENTORY_WRITE ORDERS_READ';
  const url = `https://connect.squareup.com/oauth2/authorize?client_id=${process.env.SQUARE_APPLICATION_ID}&scope=${scopes}&state=${state}&redirect_uri=${encodeURIComponent(process.env.APP_URL + '/api/integrations/square/callback')}`;
  res.json({ authUrl: url });
});

// GET /api/integrations/square/callback
router.get('/square/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const { brandId } = JSON.parse(Buffer.from(state, 'base64').toString());

    const tokenRes = await fetch('https://connect.squareup.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Square-Version': '2024-01-18' },
      body: JSON.stringify({
        client_id: process.env.SQUARE_APPLICATION_ID,
        client_secret: process.env.SQUARE_APPLICATION_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.APP_URL}/api/integrations/square/callback`,
      }),
    });
    const { access_token, merchant_id } = await tokenRes.json();
    if (!access_token) return res.status(400).json({ error: 'Square token exchange failed' });

    await db.query(
      `INSERT INTO integration_configs (brand_id, platform, access_token, external_id)
       VALUES ($1,'square',$2,$3)
       ON CONFLICT (brand_id, platform) DO UPDATE SET
         access_token = EXCLUDED.access_token, external_id = EXCLUDED.external_id,
         active = true, connected_at = NOW()`,
      [brandId, encrypt(access_token), merchant_id]
    );

    res.redirect(`/pages/brand-dashboard.html?view=integrations&connected=square`);
  } catch (err) { next(err); }
});

// POST /api/integrations/square/sync-inventory — pull Square inventory into Linezheets
router.post('/square/sync-inventory', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows: [cfg] } = await db.query(
      `SELECT * FROM integration_configs WHERE brand_id = $1 AND platform = 'square' AND active = true`,
      [req.brandId]
    );
    if (!cfg) return res.status(400).json({ error: 'Square not connected' });

    const token = decrypt(cfg.access_token);

    // Fetch catalog items
    const catRes = await fetch('https://connect.squareup.com/v2/catalog/list?types=ITEM_VARIATION', {
      headers: { 'Square-Version': '2024-01-18', Authorization: `Bearer ${token}` }
    });
    const { objects = [] } = await catRes.json();

    const synced = [];
    for (const obj of objects) {
      const sku = obj.item_variation_data?.sku;
      if (!sku) continue;
      const qty = obj.item_variation_data?.inventory_alert_threshold || 0;

      // Match by SKU
      const { rows: [variant] } = await db.query(
        `SELECT pv.id FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.sku = $1 AND p.brand_id = $2`, [sku, req.brandId]
      );

      if (variant) {
        await db.query('UPDATE product_variants SET quantity = $1, updated_at = NOW() WHERE id = $2', [qty, variant.id]);
        await db.query(
          `INSERT INTO inventory_sync_log (brand_id, variant_id, source, change_type, qty_before, qty_change, qty_after)
           SELECT $1, $2, 'square_sync', 'set', quantity, $3 - quantity, $3 FROM product_variants WHERE id = $2`,
          [req.brandId, variant.id, qty]
        );
        synced.push(sku);
      }
    }

    await db.query('UPDATE integration_configs SET last_sync_at = NOW() WHERE id = $1', [cfg.id]);
    res.json({ synced: synced.length, skus: synced });
  } catch (err) { next(err); }
});

// ─── CLOVER ─────────────────────────────────────────────────────────────────

// GET /api/integrations/clover/auth
router.get('/clover/auth', authenticate, requireBrand, ownBrand, (req, res) => {
  const state = Buffer.from(JSON.stringify({ brandId: req.brandId })).toString('base64');
  const url = `https://sandbox.dev.clover.com/oauth/v2/authorize?client_id=${process.env.CLOVER_APP_ID}&state=${state}&redirect_uri=${encodeURIComponent(process.env.APP_URL + '/api/integrations/clover/callback')}`;
  res.json({ authUrl: url });
});

// GET /api/integrations/clover/callback
router.get('/clover/callback', async (req, res, next) => {
  try {
    const { merchant_id, code, state } = req.query;
    const { brandId } = JSON.parse(Buffer.from(state, 'base64').toString());

    const tokenRes = await fetch(`https://sandbox.dev.clover.com/oauth/v2/token?client_id=${process.env.CLOVER_APP_ID}&client_secret=${process.env.CLOVER_APP_SECRET}&code=${code}`);
    const { access_token } = await tokenRes.json();

    await db.query(
      `INSERT INTO integration_configs (brand_id, platform, access_token, external_id)
       VALUES ($1,'clover',$2,$3)
       ON CONFLICT (brand_id, platform) DO UPDATE SET
         access_token = EXCLUDED.access_token, external_id = EXCLUDED.external_id,
         active = true, connected_at = NOW()`,
      [brandId, encrypt(access_token), merchant_id]
    );

    res.redirect(`/pages/brand-dashboard.html?view=integrations&connected=clover`);
  } catch (err) { next(err); }
});

// POST /api/integrations/clover/sync-inventory
router.post('/clover/sync-inventory', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows: [cfg] } = await db.query(
      `SELECT * FROM integration_configs WHERE brand_id = $1 AND platform = 'clover' AND active = true`,
      [req.brandId]
    );
    if (!cfg) return res.status(400).json({ error: 'Clover not connected' });

    const token = decrypt(cfg.access_token);
    const merchantId = cfg.external_id;

    const itemsRes = await fetch(
      `https://sandbox.dev.clover.com/v3/merchants/${merchantId}/items?expand=itemStock`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { elements = [] } = await itemsRes.json();

    const synced = [];
    for (const item of elements) {
      const sku = item.sku;
      const qty = item.itemStock?.quantity || 0;
      if (!sku) continue;

      const { rows: [variant] } = await db.query(
        `SELECT pv.id FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.sku = $1 AND p.brand_id = $2`, [sku, req.brandId]
      );

      if (variant) {
        await db.query('UPDATE product_variants SET quantity = $1, updated_at = NOW() WHERE id = $2', [qty, variant.id]);
        synced.push(sku);
      }
    }

    await db.query('UPDATE integration_configs SET last_sync_at = NOW() WHERE id = $1', [cfg.id]);
    res.json({ synced: synced.length, skus: synced });
  } catch (err) { next(err); }
});

module.exports = router;
