const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/user');
const bcrypt = require('bcryptjs');

const MAX_ATTEMPTS = 3;
const LOCK_TIME = 30 * 60 * 1000; // 30 minutes

passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await User.findOne({ username });

      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }

      // 🔒 Check if account is locked
      if (user.lockUntil && user.lockUntil > Date.now()) {
        const minutesLeft = Math.ceil(
          (user.lockUntil - Date.now()) / 60000
        );
        return done(null, false, {
          message: `Account locked. Try again in ${minutesLeft} minutes.`
        });
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        // ❌ Wrong password → increment attempts
        user.loginAttempts = (user.loginAttempts || 0) + 1;

        // 🚫 Lock account if max attempts reached
        if (user.loginAttempts >= MAX_ATTEMPTS) {
          user.lockUntil = Date.now() + LOCK_TIME;
        }

        await user.save();

        return done(null, false, { message: 'Incorrect password.' });
      }

      // ✅ Password correct → allow login
      return done(null, user);

    } catch (err) {
      return done(err);
    }
  }
));

// passport.use(new LocalStrategy(
//   async (username, password, done) => {
//     try {
//         const user = await User.findOne({ username: username });
//         if (!user) {
//             return done(null, false, { message: 'Incorrect username.' });
//         }
//         const match = await bcrypt.compare(password, user.password);
//         if (!match) {
//             return done(null, false, { message: 'Incorrect password.' });
//         }
//         return done(null, user);
//     } catch (err) {
//         return done(err);
//     }   
//   }
// ));

passport.serializeUser((user, done) => {
  console.log('Serializing user:', user);
  done(null, user._id);
});

passport.deserializeUser(async (_id, done) => {
  try {
      const user = await User.findById(_id);
      console.log('Deserializing user:', user);
      done(null, user);
  } catch (err) {
      done(err);
  }
});