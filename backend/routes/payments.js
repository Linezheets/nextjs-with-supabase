const router = require('express').Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../middleware/db');
const { authenticate, requireBuyer, ownBrand } = require('../middleware/auth');
const { addDays, addMonths, format } = require('date-fns');

const PLATFORM_COMMISSION = parseFloat(process.env.PLATFORM_COMMISSION_RATE || 3) / 100;

// ── POST /api/payments/intent — standard full payment ────────────────────────
router.post('/intent', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const { rows: [order] } = await db.query(
      `SELECT o.*, b.stripe_account_id, b.commission_rate,
              buy.stripe_customer_id
       FROM orders o
       JOIN brands b ON b.id = o.brand_id
       JOIN buyers buy ON buy.id = o.buyer_id
       WHERE o.id = $1 AND o.buyer_id = (SELECT id FROM buyers WHERE user_id = $2)`,
      [orderId, req.userId]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.payment_status !== 'pending') return res.status(400).json({ error: 'Order already paid' });
    if (!order.stripe_account_id) return res.status(400).json({ error: 'Brand has not connected Stripe' });

    const amountCents = Math.round(order.total_amount * 100);
    const commissionRate = (order.commission_rate || 3) / 100;
    const platformFee = Math.round(amountCents * commissionRate);

    // Create or retrieve Stripe customer
    let customerId = order.stripe_customer_id;
    if (!customerId) {
      const { rows: [user] } = await db.query('SELECT email FROM users WHERE id = $1', [req.userId]);
      const customer = await stripe.customers.create({ email: user.email, metadata: { buyer_id: order.buyer_id } });
      customerId = customer.id;
      await db.query('UPDATE buyers SET stripe_customer_id = $1 WHERE id = $2', [customerId, order.buyer_id]);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: order.currency?.toLowerCase() || 'usd',
      customer: customerId,
      application_fee_amount: platformFee,
      transfer_data: { destination: order.stripe_account_id },
      metadata: {
        order_id: orderId,
        order_number: order.order_number,
        brand_id: order.brand_id,
        buyer_id: order.buyer_id,
        payment_type: 'full'
      },
      description: `Linezheets Order ${order.order_number}`,
    });

    // Store transaction record
    await db.query(
      `INSERT INTO transactions (order_id, buyer_id, brand_id, stripe_payment_intent, amount, currency, platform_fee, brand_amount, type, status, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'charge','pending',$9)`,
      [orderId, order.buyer_id, order.brand_id, paymentIntent.id,
       order.total_amount, order.currency || 'USD',
       platformFee / 100, (amountCents - platformFee) / 100,
       `Order ${order.order_number}`]
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: order.total_amount,
      currency: order.currency
    });
  } catch (err) { next(err); }
});

// ── POST /api/payments/installment-plan — create installment plan ─────────────
router.post('/installment-plan', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { orderId, planType, stripePaymentMethodId } = req.body;

    const { rows: [order] } = await db.query(
      `SELECT o.*, b.stripe_account_id, b.allow_installments, b.commission_rate,
              buy.stripe_customer_id, buy.allow_installments AS buyer_allows_installments,
              buy.max_installments, buy.credit_limit, buy.credit_used
       FROM orders o
       JOIN brands b ON b.id = o.brand_id
       JOIN buyers buy ON buy.id = o.buyer_id
       WHERE o.id = $1 AND o.buyer_id = (SELECT id FROM buyers WHERE user_id = $2)`,
      [orderId, req.userId]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.allow_installments) return res.status(400).json({ error: 'This brand does not allow installments' });
    if (!order.buyer_allows_installments) return res.status(400).json({ error: 'Your account is not approved for installment payments' });

    const PLANS = {
      'deposit_balance': { count: 2, schedule: [0.3, 0.7], labels: ['30% Deposit', '70% Balance on shipment'] },
      '3month':          { count: 3, schedule: [1/3, 1/3, 1/3], labels: ['Payment 1 of 3', 'Payment 2 of 3', 'Payment 3 of 3'] },
      '6month':          { count: 6, schedule: Array(6).fill(1/6), labels: Array.from({length:6}, (_,i) => `Payment ${i+1} of 6`) },
      '12month':         { count: 12, schedule: Array(12).fill(1/12), labels: Array.from({length:12}, (_,i) => `Payment ${i+1} of 12`) },
      'net30':           { count: 1, schedule: [1], labels: ['Net 30 Full Payment'] },
    };

    const plan = PLANS[planType];
    if (!plan) return res.status(400).json({ error: `Invalid plan type. Choose: ${Object.keys(PLANS).join(', ')}` });
    if (plan.count > parseInt(order.max_installments || 12)) {
      return res.status(400).json({ error: `Your account allows maximum ${order.max_installments} installments` });
    }

    // Attach payment method to customer
    let customerId = order.stripe_customer_id;
    if (!customerId) {
      const { rows: [user] } = await db.query('SELECT email FROM users WHERE id = $1', [req.userId]);
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
      await db.query('UPDATE buyers SET stripe_customer_id = $1 WHERE id = $2', [customerId, order.buyer_id]);
    }

    if (stripePaymentMethodId) {
      await stripe.paymentMethods.attach(stripePaymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: stripePaymentMethodId }
      });
    }

    // Create setup intent to save card for future installments
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method: stripePaymentMethodId,
      confirm: !!stripePaymentMethodId,
      metadata: { order_id: orderId, plan_type: planType }
    });

    const total = parseFloat(order.total_amount);
    const commissionRate = (order.commission_rate || 3) / 100;

    await db.transaction(async (client) => {
      const { rows: [installPlan] } = await client.query(
        `INSERT INTO installment_plans (order_id, buyer_id, plan_type, total_amount, remaining_amount,
          installment_count, stripe_setup_intent, stripe_payment_method, status)
         VALUES ($1,$2,$3,$4,$4,$5,$6,$7,'active') RETURNING id`,
        [orderId, order.buyer_id, planType, total, plan.count,
         setupIntent.id, stripePaymentMethodId || null]
      );
      const planId = installPlan.id;

      // Generate payment schedule
      const schedule = [];
      for (let i = 0; i < plan.count; i++) {
        const amount = Math.round(total * plan.schedule[i] * 100) / 100;
        const dueDate = planType === 'net30'
          ? addDays(new Date(), 30)
          : planType === 'deposit_balance'
            ? i === 0 ? new Date() : addDays(new Date(), 45)
            : addMonths(new Date(), i);

        const { rows: [payment] } = await client.query(
          `INSERT INTO installment_payments (plan_id, installment_number, due_date, amount, status)
           VALUES ($1,$2,$3,$4, $5) RETURNING *`,
          [planId, i + 1, format(dueDate, 'yyyy-MM-dd'), amount,
           i === 0 ? 'scheduled' : 'scheduled']
        );
        schedule.push({ ...payment, label: plan.labels[i] });
      }

      // Link plan to order
      await client.query(
        'UPDATE orders SET installment_plan_id = $1, payment_method = $2 WHERE id = $3',
        [planId, planType === 'net30' ? 'net30' : 'installment', orderId]
      );

      // Charge first installment immediately if deposit plan
      let firstPaymentResult = null;
      if ((planType === 'deposit_balance' || planType === '3month') && stripePaymentMethodId) {
        const firstAmount = Math.round(total * plan.schedule[0] * 100);
        const platformFee = Math.round(firstAmount * commissionRate);
        try {
          const pi = await stripe.paymentIntents.create({
            amount: firstAmount,
            currency: 'usd',
            customer: customerId,
            payment_method: stripePaymentMethodId,
            confirm: true,
            application_fee_amount: platformFee,
            transfer_data: { destination: order.stripe_account_id },
            off_session: false,
            metadata: {
              order_id: orderId, plan_id: planId,
              installment_number: '1', plan_type: planType
            },
            description: `${order.order_number} — Installment 1 of ${plan.count} (${plan.labels[0]})`
          });

          await client.query(
            `UPDATE installment_payments SET status = 'paid', stripe_payment_intent = $1,
             paid_at = NOW(), paid_amount = $2 WHERE plan_id = $3 AND installment_number = 1`,
            [pi.id, firstAmount / 100, planId]
          );
          await client.query(
            `INSERT INTO transactions (order_id, buyer_id, brand_id, installment_payment_id, stripe_payment_intent,
             amount, platform_fee, brand_amount, type, status, description)
             VALUES ($1,$2,$3,(SELECT id FROM installment_payments WHERE plan_id=$4 AND installment_number=1),
             $5,$6,$7,$8,'charge','paid',$9)`,
            [orderId, order.buyer_id, order.brand_id, planId, pi.id,
             firstAmount/100, platformFee/100, (firstAmount-platformFee)/100,
             `${order.order_number} installment 1/${plan.count}`]
          );
          firstPaymentResult = { status: pi.status, amount: firstAmount / 100 };
        } catch (payErr) {
          console.error('First installment charge failed:', payErr.message);
          firstPaymentResult = { status: 'failed', error: payErr.message };
        }
      }

      return res.status(201).json({
        plan: { id: planId, type: planType, total, count: plan.count },
        schedule: schedule.map((s, i) => ({
          number: i + 1,
          label: plan.labels[i],
          amount: s.amount,
          dueDate: s.due_date,
          status: s.status
        })),
        firstPayment: firstPaymentResult,
        setupIntentClientSecret: setupIntent.client_secret
      });
    });
  } catch (err) { next(err); }
});

// ── POST /api/payments/charge-installment — charge a scheduled installment ───
router.post('/charge-installment/:paymentId', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { rows: [ip] } = await db.query(
      `SELECT ip.*, ipl.stripe_payment_method, ipl.buyer_id,
              o.brand_id, b.stripe_account_id, b.commission_rate, buy.stripe_customer_id
       FROM installment_payments ip
       JOIN installment_plans ipl ON ipl.id = ip.plan_id
       JOIN orders o ON o.id = ipl.order_id
       JOIN brands b ON b.id = o.brand_id
       JOIN buyers buy ON buy.id = ipl.buyer_id
       WHERE ip.id = $1 AND ipl.buyer_id = (SELECT id FROM buyers WHERE user_id = $2)`,
      [req.params.paymentId, req.userId]
    );
    if (!ip) return res.status(404).json({ error: 'Installment not found' });
    if (ip.status === 'paid') return res.status(400).json({ error: 'Already paid' });

    const paymentMethodId = req.body.paymentMethodId || ip.stripe_payment_method;
    if (!paymentMethodId) return res.status(400).json({ error: 'No payment method on file' });

    const amountCents = Math.round(parseFloat(ip.amount) * 100);
    const commissionRate = (ip.commission_rate || 3) / 100;
    const platformFee = Math.round(amountCents * commissionRate);

    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: ip.stripe_customer_id,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      application_fee_amount: platformFee,
      transfer_data: { destination: ip.stripe_account_id },
      metadata: { installment_payment_id: ip.id, plan_id: ip.plan_id }
    });

    await db.query(
      `UPDATE installment_payments SET status = 'paid', stripe_payment_intent = $1,
       paid_at = NOW(), paid_amount = $2 WHERE id = $3`,
      [pi.id, amountCents / 100, ip.id]
    );

    await db.query(
      `UPDATE installment_plans SET paid_amount = paid_amount + $1, installments_paid = installments_paid + 1,
       remaining_amount = GREATEST(0, remaining_amount - $1),
       status = CASE WHEN installments_paid + 1 >= installment_count THEN 'completed' ELSE status END
       WHERE id = $2`,
      [amountCents / 100, ip.plan_id]
    );

    res.json({ success: true, paymentIntentStatus: pi.status, amount: amountCents / 100 });
  } catch (err) {
    // Update retry count
    await db.query(
      `UPDATE installment_payments SET retry_count = retry_count + 1, last_attempt_at = NOW(), failure_reason = $1
       WHERE id = $2`, [err.message, req.params.paymentId]
    ).catch(() => {});
    next(err);
  }
});

// ── GET /api/payments/installment-plans — buyer's plans ──────────────────────
router.get('/installment-plans', authenticate, requireBuyer, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ipl.*, o.order_number, b.name AS brand_name
       FROM installment_plans ipl
       JOIN orders o ON o.id = ipl.order_id
       JOIN brands b ON b.id = o.brand_id
       WHERE ipl.buyer_id = (SELECT id FROM buyers WHERE user_id = $1)
       ORDER BY ipl.created_at DESC`,
      [req.userId]
    );

    for (const plan of rows) {
      const { rows: payments } = await db.query(
        'SELECT * FROM installment_payments WHERE plan_id = $1 ORDER BY installment_number',
        [plan.id]
      );
      plan.payments = payments;
    }

    res.json({ plans: rows });
  } catch (err) { next(err); }
});

// ── POST /api/payments/stripe-connect — brand connects Stripe ────────────────
router.post('/stripe-connect', authenticate, async (req, res, next) => {
  try {
    const { rows: [brand] } = await db.query(
      'SELECT * FROM brands WHERE user_id = $1', [req.userId]);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    if (brand.stripe_account_id) return res.status(400).json({ error: 'Stripe already connected' });

    const { rows: [user] } = await db.query(
      'SELECT email FROM users WHERE id = $1', [req.userId]);

    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { brand_id: brand.id }
    });

    await db.query('UPDATE brands SET stripe_account_id = $1 WHERE id = $2', [account.id, brand.id]);

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/brand/dashboard?stripe=refresh`,
      return_url: `${process.env.FRONTEND_URL}/brand/dashboard?stripe=success`,
      type: 'account_onboarding'
    });

    res.json({ url: accountLink.url, accountId: account.id });
  } catch (err) { next(err); }
});

// ── GET /api/payments/transactions — brand's transaction history ──────────────
router.get('/transactions', authenticate, async (req, res, next) => {
  try {
    let brandId = null;
    let buyerId = null;

    if (req.user.role === 'brand') {
      const { rows } = await db.query('SELECT id FROM brands WHERE user_id = $1', [req.userId]);
      if (rows.length) brandId = rows[0].id;
    } else if (req.user.role === 'buyer') {
      const { rows } = await db.query('SELECT id FROM buyers WHERE user_id = $1', [req.userId]);
      if (rows.length) buyerId = rows[0].id;
    }

    const cond = brandId ? 'AND t.brand_id = $2' : (buyerId ? 'AND t.buyer_id = $2' : '');
    const param = brandId || buyerId;

    const { rows } = await db.query(
      `SELECT t.*, o.order_number FROM transactions t
       LEFT JOIN orders o ON o.id = t.order_id
       WHERE t.status != 'pending' ${cond}
       ORDER BY t.created_at DESC LIMIT 100`,
      param ? [req.userId, param] : [req.userId]
    );
    res.json({ transactions: rows });
  } catch (err) { next(err); }
});

module.exports = router;
