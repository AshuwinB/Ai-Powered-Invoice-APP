const { Router } = require("express");
const passport = require('passport');
const { register, login, authStatus, logout, setup2FA, verify2FA, reset2FA } = require("../controllers/authController");


const router = Router();

// Define your authentication routes here
// Example:
// router.post('/login', (req, res) => { ... });    
router.post('/register', register);

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      return res.status(401).json({
        message: info?.message || 'Invalid credentials'
      });
    }

    req.logIn(user, (err) => {
      if (err) return next(err);
      return login(req, res);
    });
  })(req, res, next);
});
// router.post('/login', passport.authenticate('local'), login);
router.get('/status', authStatus);
router.post('/logout', logout);
router.post('/2fa/setup',(req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized user' });
},setup2FA);
router.post('/2fa/verify', (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized user' });
},verify2FA);
router.post('/2fa/reset', (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized user' });
},reset2FA);

module.exports = router;