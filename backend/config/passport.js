// backend/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const InstagramStrategy = require('passport-instagram').Strategy;

const supabase = require('./supabase'); // Assumes your supabase client is here
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

  // 1. Try to find an existing profile matching this verified email address
  const { data: existingUserByEmail } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (existingUserByEmail) {
    const currentProviderIds = existingUserByEmail.provider_ids || {};
    currentProviderIds[provider] = providerId;

    // Update tracking stats and link the new provider ID
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

  // 2. Brand new user path
  const providerIdsObj = {};
  providerIdsObj[provider] = providerId;

  const { data: newUser, error } = await supabase
    .from('profiles')
    .insert([{
      email,
      full_name: fullName,
      avatar_url: avatarUrl,
      provider_ids: providerIdsObj,
      last_login: timestamp,
      last_login_ip: ip,
      last_login_location: location
    }])
    .select()
    .single();

  if (error) throw error;
  return newUser;
}

// ── 1. GOOGLE STRATEGY ────────────────────────────────────────────────────────
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const fullName = profile.displayName;
      const avatarUrl = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
      
      const user = await handleUserUpsert(req, 'google', profile.id, email, fullName, avatarUrl);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// ── 2. FACEBOOK STRATEGY ──────────────────────────────────────────────────────
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: process.env.FACEBOOK_CALLBACK_URL,
    profileFields: ['id', 'displayName', 'emails', 'photos'],
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = (profile.emails && profile.emails[0]) ? profile.emails[0].value : `${profile.id}@facebook.com`;
      const fullName = profile.displayName;
      const avatarUrl = (profile.photos && profile.photos[0]) ? profile.photos[0].value : null;

      const user = await handleUserUpsert(req, 'facebook', profile.id, email, fullName, avatarUrl);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// ── 3. MICROSOFT STRATEGY ────────────────────────────────────────────────────
passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: process.env.MICROSOFT_CALLBACK_URL,
    scope: ['user.read'],
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value || profile.userPrincipalName;
      const fullName = profile.displayName;
      const user = await handleUserUpsert(req, 'microsoft', profile.id, email, fullName, null);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// ── 4. INSTAGRAM STRATEGY ─────────────────────────────────────────────────────
passport.use(new InstagramStrategy({
    clientID: process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
    callbackURL: process.env.INSTAGRAM_CALLBACK_URL,
    passReqToCallback: true
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = `${profile.username}@instagram.com`; // Instagram Basic Display API fallback
      const fullName = profile.displayName || profile.username;
      
      const user = await handleUserUpsert(req, 'instagram', profile.id, email, fullName, null);
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

module.exports = passport;
