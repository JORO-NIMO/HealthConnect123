/**
 * HealthConnect — Passport.js Configuration
 * Configured for Google OAuth 2.0
 */

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const JWTStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const UserModel = require('../models/User.model');
const logger = require('../utils/logger.util');

// ─── Google OAuth Strategy ────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const { id, displayName, emails, photos } = profile;
      const email = emails?.[0]?.value;
      const avatarUrl = photos?.[0]?.value;
      const [firstName, lastName] = displayName.split(' ');

      // Check if user exists by Google ID
      let user = await UserModel.findByGoogleId(id);

      if (!user) {
        // Try to find by email
        user = await UserModel.findByEmail(email);
        
        if (user) {
          // Link existing account with Google
          await UserModel.setGoogleId(user.id, id);
          logger.info(`Linked Google account to existing user: ${email}`);
        } else {
          // Create new user with temporary password
          const { v4: uuidv4 } = require('uuid');
          user = await UserModel.create({
            email,
            password: uuidv4(),
            firstName,
            lastName,
            role: 'patient'
          });
          
          const PatientModel = require('../models/Patient.model');
          await PatientModel.create(user.id);
          
          await UserModel.setGoogleId(user.id, id);
          logger.info(`Created new user from Google OAuth: ${email}`);
        }
      }

      return done(null, {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        googleId: id
      });
    } catch (err) {
      logger.error('Google OAuth error:', err);
      return done(err);
    }
  }));

  logger.info('✅ Google OAuth Strategy configured');
} else {
  logger.warn('⚠️  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set — Google authentication disabled');
}

// ─── JWT Strategy ─────────────────────────────────────────────────────────
passport.use(new JWTStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production_12345678'
}, async (payload, done) => {
  try {
    const user = await UserModel.findById(payload.id);
    if (user) {
      return done(null, user);
    }
    return done(null, false);
  } catch (err) {
    return done(err, false);
  }
}));

// ─── Serialize/Deserialize ────────────────────────────────────────────────
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserModel.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
