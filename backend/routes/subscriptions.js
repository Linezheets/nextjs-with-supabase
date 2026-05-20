const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../middleware/db');
const { authenticate, requireBrand, ownBrand } = require('../middleware/auth');

const PRICE_MAP = {
  starter:  { monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY, annual: process.env.STRIPE_PRICE_STARTER_ANNUAL },
  studio:   { monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY,  annual: process.env.STRIPE_PRICE_STUDIO_ANNUAL },
};

const TIER_LIMITS = {
  starter:    { max_products: 50, ai_features: false, marketplace: false },
  studio:     { max_products: -1, ai_features: true,  marketplace: true },
  enterprise: { max_products: -1, ai_features: true,  marketplace: true },
};

// ── GET /api/subscriptions/plans — public plan info ──────────────────────────
router.get('/plans', (req, res) => {
  res.json({
    plans: [
      {
        id: 'starter', name: 'Starter', price_monthly: 49, price_annual: 39,
        limits: TIER_LIMITS.starter,
        features: ['Up to 50 products', '5 line sheets/month', 'Basic AI matching', 'Stripe & PayPal payments', 'Shippo labels']
      },
      {
        id: 'studio', name: 'Studio', price_monthly: 149, price_annual: 119,
        limits: TIER_LIMITS.studio, popular: true,
        features: ['Unlimited products', 'Unlimited line sheets', 'Full AI Studio — 6 modules', 'Marketplace listing', 'ERP sync', 'Buyer intelligence scoring', 'Priority support']
      },
      {
        id: 'enterprise', name: 'Enterprise', price_monthly: null, price_annual: null,
        limits: TIER_LIMITS.enterprise,
        features: ['Everything in Studio', 'Multi-brand portfolio', 'Custom AI training', 'Dedicated CSM', 'SLA uptime', 'SSO / SAML', 'Custom integrations']
      }
    ]
  });
});

// ── POST /api/subscriptions/subscribe ────────────────────────────────────────
router.post('/subscribe', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { tier, billing = 'monthly', paymentMethodId } = req.body;
    if (!PRICE_MAP[tier]) return res.status(400).json({ error: 'Invalid tier' });

    const { rows: [brand] } = await db.query('SELECT * FROM brands WHERE id = $1', [req.brandId]);
    const { rows: [user] } = await db.query('SELECT email, first_name, last_name FROM users WHERE id = $1', [req.userId]);

    let customerId = brand.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim(),
        metadata: { brand_id: req.brandId }
      });
      customerId = customer.id;
      await db.query('UPDATE brands SET stripe_customer_id = $1 WHERE id = $2', [customerId, req.brandId]);
    }

    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId }
      });
    }

    const priceId = PRICE_MAP[tier][billing];
    if (!priceId) return res.status(400).json({ error: `No price configured for ${tier}/${billing}` });

    // Cancel existing subscription
    if (brand.stripe_subscription_id) {
      await stripe.subscriptions.cancel(brand.stripe_subscription_id).catch(() => {});
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_end: brand.subscription_status === 'trialing' ? 'now' : undefined,
      expand: ['latest_invoice.payment_intent'],
      metadata: { brand_id: req.brandId, tier }
    });

    await db.query(
      `UPDATE brands SET subscription_tier = $1, subscription_status = $2,
       stripe_subscription_id = $3, stripe_customer_id = $4, updated_at = NOW()
       WHERE id = $5`,
      [tier, subscription.status, subscription.id, customerId, req.brandId]
    );

    await db.query(
      `INSERT INTO brand_subscriptions (brand_id, stripe_subscription_id, stripe_customer_id, tier, status, monthly_price, billing_cycle, current_period_start, current_period_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,to_timestamp($8),to_timestamp($9))
       ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = EXCLUDED.status`,
      [req.brandId, subscription.id, customerId, tier, subscription.status,
       billing === 'annual' ? (tier === 'starter' ? 39 : 119) : (tier === 'starter' ? 49 : 149),
       billing, subscription.current_period_start, subscription.current_period_end]
    );

    const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;
    res.json({
      subscription: { id: subscription.id, status: subscription.status, tier },
      clientSecret
    });
  } catch (err) { next(err); }
});

// ── POST /api/subscriptions/cancel ───────────────────────────────────────────
router.post('/cancel', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows: [brand] } = await db.query('SELECT stripe_subscription_id FROM brands WHERE id = $1', [req.brandId]);
    if (!brand?.stripe_subscription_id) return res.status(400).json({ error: 'No active subscription' });

    const sub = await stripe.subscriptions.update(brand.stripe_subscription_id, {
      cancel_at_period_end: true
    });

    await db.query(
      'UPDATE brands SET subscription_status = $1 WHERE id = $2',
      ['canceled', req.brandId]
    );

    res.json({ message: 'Subscription will cancel at end of billing period', endsAt: new Date(sub.cancel_at * 1000) });
  } catch (err) { next(err); }
});

// ── GET /api/subscriptions/status ────────────────────────────────────────────
router.get('/status', authenticate, requireBrand, ownBrand, async (req, res, next) => {
  try {
    const { rows: [brand] } = await db.query(
      `SELECT subscription_tier, subscription_status, trial_ends_at,
              stripe_subscription_id, stripe_account_status
       FROM brands WHERE id = $1`, [req.brandId]
    );
    const limits = TIER_LIMITS[brand.subscription_tier] || TIER_LIMITS.starter;
    res.json({ ...brand, limits });
  } catch (err) { next(err); }
});

module.exports = router;
