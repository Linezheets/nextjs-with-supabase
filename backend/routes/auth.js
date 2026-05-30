const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../middleware/db');
const { authenticate } = require('../middleware/auth');

const generateToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// ── POST /api/auth/register/brand ────────────────────────────────────────────
router.post('/register/brand', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, brandName, phone } = req.body;
    if (!email || !password || !brandName) {
      return res.status(400).json({ error: 'Email, password and brand name are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    await db.transaction(async (client) => {
      // Check duplicate
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existing.rows.length) throw Object.assign(new Error('Email already registered'), { status: 409 });

      const passwordHash = await bcrypt.hash(password, 12);
      const verifyToken = uuidv4();

      // Create user
      const { rows: [user] } = await client.query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name, phone, verify_token)
         VALUES ($1, $2, 'brand', $3, $4, $5, $6) RETURNING id, email, role`,
        [email.toLowerCase(), passwordHash, firstName, lastName, phone, verifyToken]
      );

      // Generate brand slug
      const slugify = require('slugify');
      let slug = slugify(brandName, { lower: true, strict: true });
      const slugCheck = await client.query('SELECT id FROM brands WHERE slug = $1', [slug]);
      if (slugCheck.rows.length) slug += '-' + Date.now().toString(36);

      // Create brand
      const { rows: [brand] } = await client.query(
        `INSERT INTO brands (user_id, name, slug, subscription_tier, subscription_status, trial_ends_at)
         VALUES ($1, $2, $3, 'starter', 'trialing', NOW() + INTERVAL '14 days')
         RETURNING id, name, slug, subscription_tier, subscription_status, trial_ends_at`,
        [user.id, brandName, slug]
      );

      // Create brand store
      await client.query('INSERT INTO brand_stores (brand_id) VALUES ($1)', [brand.id]);

      const token = generateToken(user.id, 'brand');
      return res.status(201).json({
        message: 'Brand account created successfully',
        token,
        user: { id: user.id, email: user.email, role: user.role, firstName, lastName },
        brand: { id: brand.id, name: brand.name, slug: brand.slug, subscriptionTier: brand.subscription_tier, trialEndsAt: brand.trial_ends_at }
      });
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/register/buyer ────────────────────────────────────────────
router.post('/register/buyer', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, companyName, businessType, website, phone } = req.body;
    if (!email || !password || !companyName) {
      return res.status(400).json({ error: 'Email, password and company name are required' });
    }

    await db.transaction(async (client) => {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existing.rows.length) throw Object.assign(new Error('Email already registered'), { status: 409 });

      const passwordHash = await bcrypt.hash(password, 12);
      const { rows: [user] } = await client.query(
        `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
         VALUES ($1, $2, 'buyer', $3, $4, $5) RETURNING id, email, role`,
        [email.toLowerCase(), passwordHash, firstName, lastName, phone]
      );

      const { rows: [buyer] } = await client.query(
        `INSERT INTO buyers (user_id, company_name, business_type, website)
         VALUES ($1, $2, $3, $4) RETURNING id, company_name, status`,
        [user.id, companyName, businessType, website]
      );

      const token = generateToken(user.id, 'buyer');
      return res.status(201).json({
        message: 'Buyer account created successfully',
        token,
        user: { id: user.id, email: user.email, role: user.role, firstName, lastName },
        buyer: { id: buyer.id, companyName: buyer.company_name, status: buyer.status }
      });
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows } = await db.query(
      'SELECT id, email, password_hash, role, first_name, last_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user.id, user.role);

    // Fetch role-specific profile
    let profile = null;
    if (user.role === 'brand') {
      const { rows: br } = await db.query(
        `SELECT id, name, slug, subscription_tier, subscription_status, stripe_account_status, trial_ends_at
         FROM brands WHERE user_id = $1`, [user.id]
      );
      profile = br[0] || null;
    } else if (user.role === 'buyer') {
      const { rows: by } = await db.query(
        `SELECT id, company_name, status, credit_limit, allow_installments FROM buyers WHERE user_id = $1`,
        [user.id]
      );
      profile = by[0] || null;
    }

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, firstName: user.first_name, lastName: user.last_name },
      profile
    });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, email, role, first_name, last_name, phone, avatar_url, created_at FROM users WHERE id = $1',
      [req.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    let profile = null;
    if (req.user.role === 'brand') {
      const { rows: br } = await db.query(`
        SELECT b.*, bs.primary_color, bs.accent_color
        FROM brands b LEFT JOIN brand_stores bs ON bs.brand_id = b.id
        WHERE b.user_id = $1`, [req.userId]);
      profile = br[0] || null;
    } else if (req.user.role === 'buyer') {
      const { rows: by } = await db.query(
        'SELECT * FROM buyers WHERE user_id = $1', [req.userId]);
      profile = by[0] || null;
    }

    res.json({ user: rows[0], profile });
  } catch (err) { next(err); }
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password too short' });

    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.userId]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) { next(err); }
});
// ... (Your existing brand/buyer registration and login routes stay exactly as they are) ...

// ── ADD PASSPORT SOCIAL ROUTING ENDPOINTS BELOW ──────────────────────────────
const passport = require('passport');

// Centralized error boundary for authentication pipeline failures
const handleAuthFailure = (err, req, res, next) => {
  console.error("OAuth Execution Failure:", err);
  res.redirect('/login?error=AuthenticationFailed');
};

// ── 1. GOOGLE ROUTING ────────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=GoogleAuthFailed' }),
  (req, res) => res.redirect('/dashboard')
);

// ── 2. FACEBOOK ROUTING ──────────────────────────────────────────────────────
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/login?error=FacebookAuthFailed' }),
  (req, res) => res.redirect('/dashboard')
);

// ── 3. MICROSOFT ROUTING ─────────────────────────────────────────────────────
router.get('/microsoft', passport.authenticate('microsoft'));
router.get('/microsoft/callback', 
  passport.authenticate('microsoft', { failureRedirect: '/login?error=MicrosoftAuthFailed' }),
  (req, res) => res.redirect('/dashboard')
);

// ── 4. INSTAGRAM ROUTING ─────────────────────────────────────────────────────
router.get('/instagram', passport.authenticate('instagram', { scope: ['user_profile'] }));
router.get('/instagram/callback', 
  passport.authenticate('instagram', { failureRedirect: '/login?error=InstagramAuthFailed' }),
  (req, res) => res.redirect('/dashboard')
);

router.use(handleAuthFailure);

// This line should remain at the absolute bottom of your file!
// ── PASSPORT MULTI-PROVIDER SOCIAL ROUTING ───────────────────────────────────
const passport = require('passport');

// Centralized error boundary for authentication pipeline failures
const handleAuthFailure = (err, req, res, next) => {
  console.error("OAuth Execution Failure:", err);
  res.redirect('/login?error=AuthenticationFailed');
};

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=GoogleAuthFailed' }),
  (req, res) => res.redirect('/dashboard')
);

// Facebook OAuth
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', 
  passport.authenticate('facebook', { failureRedirect: '/login?error=FacebookAuthFailed' }),
  (req, res) => res.redirect('/dashboard')
);

// Microsoft OAuth
router.get('/microsoft', passport.authenticate('microsoft'));
router.get('/microsoft/callback', 
  passport.authenticate('microsoft', { failureRedirect: '/login?error=MicrosoftAuthFailed' }),
  (req, res) => res.redirect('/dashboard')
);

// Instagram OAuth
router.get('/instagram', passport.authenticate('instagram', { scope: ['user_profile'] }));
router.get('/instagram/callback', 
  passport.authenticate('instagram', { failureRedirect: '/login?error=InstagramAuthFailed' }),
  (req, res) => res.redirect('/dashboard')
);

router.use(handleAuthFailure);

module.exports = router;
