const jwt = require('jsonwebtoken');
const db = require('./db');

// Verify JWT and attach user to request
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await db.query(
      'SELECT id, email, role, first_name, last_name FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });

    req.user = rows[0];
    req.userId = rows[0].id;
    req.role = rows[0].role;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based access guards
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Access restricted to: ${roles.join(', ')}` });
  }
  next();
};

const requireBrand = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!['brand', 'admin'].includes(req.role)) return res.status(403).json({ error: 'Brand access required' });
  next();
};

const requireBuyer = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (!['buyer', 'admin'].includes(req.role)) return res.status(403).json({ error: 'Buyer access required' });
  if (req.role === 'buyer') {
    try {
      const { rows } = await db.query('SELECT id FROM buyers WHERE user_id = $1', [req.userId]);
      if (!rows.length) return res.status(403).json({ error: 'No buyer account found' });
      req.buyerId = rows[0].id;
    } catch (err) { return next(err); }
  }
  next();
};

const requireAdmin = requireRole('admin');

// Verify brand owns the resource
const ownBrand = async (req, res, next) => {
  if (req.user.role === 'admin') return next();
  try {
    const { rows } = await db.query(
      'SELECT id FROM brands WHERE user_id = $1',
      [req.userId]
    );
    if (!rows.length) return res.status(403).json({ error: 'No brand account found' });
    req.brandId = rows[0].id;
    next();
  } catch (err) { next(err); }
};

// Check brand subscription is active
const requireActiveSubscription = async (req, res, next) => {
  if (req.user.role === 'admin') return next();
  try {
    const { rows } = await db.query(
      `SELECT subscription_status, trial_ends_at, subscription_tier FROM brands WHERE user_id = $1`,
      [req.userId]
    );
    if (!rows.length) return res.status(403).json({ error: 'Brand account not found' });
    const { subscription_status, trial_ends_at } = rows[0];
    const validStatuses = ['active', 'trialing'];
    if (!validStatuses.includes(subscription_status)) {
      return res.status(402).json({
        error: 'Subscription required',
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Please upgrade your plan to access this feature.'
      });
    }
    if (subscription_status === 'trialing' && new Date(trial_ends_at) < new Date()) {
      return res.status(402).json({
        error: 'Trial expired',
        code: 'TRIAL_EXPIRED',
        message: 'Your trial has ended. Please choose a subscription plan.'
      });
    }
    next();
  } catch (err) { next(err); }
};

module.exports = { authenticate, requireRole, requireBrand, requireBuyer, requireAdmin, ownBrand, requireActiveSubscription };
