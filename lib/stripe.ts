import Stripe from 'stripe';

// Lazy-initialised so the module can be imported without crashing in
// environments where STRIPE_SECRET_KEY is not set (e.g. local dev, Railway
// deployments where Stripe isn't yet configured).
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set — Stripe features are unavailable.');
  _stripe = new Stripe(key, { apiVersion: '2023-10-16' });
  return _stripe;
}

// Proxy so callers use `stripe.xxx` exactly as before,
// but the real client is only instantiated on first method call.
const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as never)[prop as keyof Stripe];
  },
});

export default stripe;
