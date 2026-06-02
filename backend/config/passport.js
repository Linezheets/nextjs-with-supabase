// backend/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const InstagramStrategy = require('passport-instagram').Strategy;

const supabase = require('./supabase');
const { getClientIp, getLocationFromIP } = require('../utils/geo');

// Serialize user into the session store
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user out of the session store
passport.deserializeUser(async (id, done) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return done(error, null);
    done(null, data);
  } catch (err) {
    done(err, null);
  }
});

/**
 * Core processor that handles user linking, profile creation, and IP location auditing
 */
async function handleUserUpsert(req, provider, providerId, email, fullName, avatarUrl) {
  const ip = getClientIp(req);
  const location = await getLocationFromIP(ip);
  const timestamp = new Date().toISOString();

  const { data: existingUserByEmail } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (existingUserByEmail) {
    const currentProviderIds = existingUserByEmail.provider_ids || {};
    currentProviderIds[provider] = providerId;

    const { data: updatedUser, error } = await supabase
      .from('profiles')
      .update({
        provider_ids: currentProviderIds,
        last_login: timestamp,
        last_login_ip: ip,
        last_login_location: location,
        full_name: existingUserByEmail.full_name || fullName,
        avatar_url: existingUserByEmail.avatar_url || avatarUrl
      })
      .eq('id', existingUserByEmail.id)
      .select()
      .single();

    if (error) throw error;
    return updatedUser;
  }

  // Brand new user
  const { data: newUser, error } = await supabase
    .from('profiles')
    .insert([{
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      provider_ids: { [provider]: providerId },
      last_login: timestamp,
      last_login_ip: ip,
      last_login_location: location
    }])
    .select()
    .single();

  if (error) throw error;
  return newUser;
}

// ── OAuth Strategy Registration ───────────────────────────────────────────────
// Each strategy is only registered when its credentials are present.
// Disabled providers are collected and logged once at startup.

const disabled = [];

// 1. Google
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const avatarUrl = profile.photos?.[0]?.value ?? null;
        const user = await handleUserUpsert(req, 'google', profile.id, email, profile.displayName, avatarUrl);
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));
} else {
  disabled.push('Google');
}

// 2. Facebook
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'displayName', 'emails', 'photos'],
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value ?? `${profile.id}@facebook.com`;
        const avatarUrl = profile.photos?.[0]?.value ?? null;
        const user = await handleUserUpsert(req, 'facebook', profile.id, email, profile.displayName, avatarUrl);
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));
} else {
  disabled.push('Facebook');
}

// 3. Microsoft
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: process.env.MICROSOFT_CALLBACK_URL,
      scope: ['user.read'],
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value ?? profile.userPrincipalName ?? `${profile.id}@microsoft.com`;
        const user = await handleUserUpsert(req, 'microsoft', profile.id, email, profile.displayName, null);
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));
} else {
  disabled.push('Microsoft');
}

// 4. Instagram
if (process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET) {
  passport.use(new InstagramStrategy(
    {
      clientID: process.env.INSTAGRAM_CLIENT_ID,
      clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
      callbackURL: process.env.INSTAGRAM_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = `${profile.username}@instagram.com`;
        const fullName = profile.displayName || profile.username;
        const user = await handleUserUpsert(req, 'instagram', profile.id, email, fullName, null);
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));
} else {
  disabled.push('Instagram');
}

if (disabled.length) {
  console.warn(`⚠️  OAuth not configured (add credentials to enable): ${disabled.join(', ')}`);
}

module.exports = passport;
