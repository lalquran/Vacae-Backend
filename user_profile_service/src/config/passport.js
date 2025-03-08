const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const User = require('../models/User');

// Configure JWT strategy for Passport
const setupPassport = () => {
  const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
  };

  passport.use(
    new JwtStrategy(options, async (jwtPayload, done) => {
      try {
        // Find user by ID from JWT
        const user = await User.findById(jwtPayload.id);
        
        if (user) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      } catch (error) {
        return done(error, false);
      }
    })
  );
};

module.exports = { setupPassport };