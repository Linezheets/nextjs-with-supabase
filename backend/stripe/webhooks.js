const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../middleware/db');

// ── POST /api/webhooks/stripe ─────────────────────────────────────────────────
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  console.log(`[WEBHOOK] ${event.type}`);

  try {
    switch (event.type) {

      // ── Payment succeeded ──────────────────────────────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const orderId = pi.metadata?.order_id;
        if (!orderId) break;

        // Full order payment
        await db.query(
          `UPDATE orders SET payment_status = 'paid', status = 'confirmed', confirmed_at = NOW()
           WHERE id = $1 AND payment_method = 'card'`,
          [orderId]
        );
        await db.query(
          `UPDATE transactions SET status = 'paid', stripe_charge_id = $1
           WHERE stripe_payment_intent = $2`,
          [pi.latest_charge, pi.id]
        );

        // Update buyer stats
        await db.query(
          `UPDATE buyers SET total_spent = total_spent + $1, updated_at = NOW()
           WHERE id = (SELECT buyer_id FROM orders WHERE id = $2)`,
          [pi.amount / 100, orderId]
        );

        // Notify brand
        const { rows: [order] } = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
        if (order) {
          await db.query(
            `INSERT INTO notifications (user_id, type, title, body)
             SELECT u.id, 'payment_received', 'Payment Received', $1
             FROM brands b JOIN users u ON u.id = b.user_id WHERE b.id = $2`,
            [`$${(pi.amount/100).toFixed(2)} received for order ${order.order_number}`, order.brand_id]
          );
        }
        break;
      }

      // ── Payment failed ─────────────────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        const orderId = pi.metadata?.order_id;
        if (!orderId) break;
        await db.query(
          `UPDATE transactions SET status = 'failed' WHERE stripe_payment_intent = $1`, [pi.id]);
        // Notify buyer
        const { rows: [order] } = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
        if (order) {
          await db.query(
            `INSERT INTO notifications (user_id, type, title, body)
             SELECT u.id, 'payment_failed', 'Payment Failed', $1
             FROM buyers b JOIN users u ON u.id = b.user_id WHERE b.id = $2`,
            [`Payment failed for order ${order.order_number}. Please update your payment method.`, order.buyer_id]
          );
        }
        break;
      }

      // ── Subscription events ────────────────────────────────────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const brandId = sub.metadata?.brand_id;
        if (!brandId) break;
        await db.query(
          `UPDATE brands SET subscription_status = $1, updated_at = NOW() WHERE id = $2`,
          [sub.status, brandId]
        );
        await db.query(
          `UPDATE brand_subscriptions SET status = $1, updated_at = NOW()
           WHERE stripe_subscription_id = $2`, [sub.status, sub.id]
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const brandId = sub.metadata?.brand_id;
        if (!brandId) break;
        await db.query(
          `UPDATE brands SET subscription_status = 'canceled', updated_at = NOW() WHERE id = $1`,
          [brandId]
        );
        break;
      }

      case 'invoice.payment_succeeded': {
        const inv = event.data.object;
        const subId = inv.subscription;
        if (!subId) break;
        await db.query(
          `UPDATE brands SET subscription_status = 'active' WHERE stripe_subscription_id = $1`,
          [subId]
        );
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data.object;
        const subId = inv.subscription;
        if (!subId) break;
        await db.query(
          `UPDATE brands SET subscription_status = 'past_due' WHERE stripe_subscription_id = $1`,
          [subId]
        );
        break;
      }

      // ── Stripe Connect account updated ─────────────────────────────────────
      case 'account.updated': {
        const account = event.data.object;
        const status = account.charges_enabled ? 'active' : 'pending';
        await db.query(
          'UPDATE brands SET stripe_account_status = $1 WHERE stripe_account_id = $2',
          [status, account.id]
        );
        break;
      }

      default:
        console.log(`[WEBHOOK] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    console.error(`[WEBHOOK] Handler error for ${event.type}:`, err.message);
  }

  res.json({ received: true });
});

module.exports = router;
