const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const logger = require('../utils/logger.util');

function getGoogleOAuthConfigErrors() {
  const errors = [];
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const callbackUrl = (process.env.GOOGLE_CALLBACK_URL || '').trim();

  if (!clientId || clientId === 'placeholder' || clientId === 'your_google_client_id') {
    errors.push('GOOGLE_CLIENT_ID is missing.');
  } else if (!clientId.endsWith('.apps.googleusercontent.com')) {
    errors.push('GOOGLE_CLIENT_ID must be a full OAuth client ID ending with .apps.googleusercontent.com.');
  }

  if (!clientSecret || clientSecret === 'placeholder' || clientSecret === 'your_google_client_secret') {
    errors.push('GOOGLE_CLIENT_SECRET is missing.');
  }

  if (!callbackUrl || callbackUrl === 'placeholder') {
    errors.push('GOOGLE_CALLBACK_URL is missing.');
  }

  return errors;
}

function isGoogleOAuthConfigured() {
  return getGoogleOAuthConfigErrors().length === 0;
}

if (isGoogleOAuthConfigured()) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: false,
        proxy: true,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('Google profile did not include an email.'), null);
          }

          return done(null, {
            googleId: profile.id,
            email,
            firstName: profile.name?.givenName || '',
            lastName: profile.name?.familyName || '',
            avatarUrl: profile.photos?.[0]?.value || null,
          });
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
  logger.info('Google OAuth strategy enabled.');
} else {
  logger.warn(`Google OAuth strategy disabled: ${getGoogleOAuthConfigErrors().join(' ')}`);
}

module.exports = {
  passport,
  isGoogleOAuthConfigured,
  getGoogleOAuthConfigErrors,
};
