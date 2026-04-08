const { Router } = require("express");
const passport = require('passport');
const {
  register,
  login,
  authStatus,
  logout,
  setup2FA,
  verify2FA,
  reset2FA,
  skip2FAOnboarding,
  shouldRequireLoginApproval,
  createLoginApprovalChallenge,
  getPendingLoginApprovals,
  approvePendingLogin,
  rejectPendingLogin,
  getLoginChallengeStatus,
  completeApprovedLogin,
  getActiveDevices,
  logoutDevice,
  logoutOtherDevices,
  streamChallengeStatus,
  getActivityLogs,
  getAccountProfile,
  updateAccountProfile,
  requestEmailOtp,
  verifyEmailOtp,
  requestPhoneOtp,
  verifyPhoneOtp,
  changeAccountPassword,
  getNotificationPreferences,
  updateNotificationPreferences,
} = require("../controllers/authController");


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

    (async () => {
      const needsApproval = await shouldRequireLoginApproval(req, user);
      if (needsApproval) {
        return createLoginApprovalChallenge(req, res, user);
      }

      req.logIn(user, (logInError) => {
        if (logInError) return next(logInError);
        return login(req, res);
      });
    })().catch(next);
  })(req, res, next);
});
router.post('/login/challenge-status', getLoginChallengeStatus);
router.post('/login/complete-challenge', completeApprovedLogin);
router.get('/login/challenge-stream/:challengeId', streamChallengeStatus);
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
router.post('/2fa/skip-onboarding', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, skip2FAOnboarding);

router.get('/security/pending-logins', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, getPendingLoginApprovals);

router.post('/security/approve-login', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, approvePendingLogin);

router.post('/security/reject-login', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, rejectPendingLogin);

router.get('/security/devices', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, getActiveDevices);

router.delete('/security/devices/:id', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, logoutDevice);

router.post('/security/logout-others', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, logoutOtherDevices);

router.get('/security/logs', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, getActivityLogs);

router.get('/account/profile', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, getAccountProfile);

router.put('/account/profile', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, updateAccountProfile);

router.post('/account/email/request-otp', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, requestEmailOtp);

router.post('/account/email/verify-otp', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, verifyEmailOtp);

router.post('/account/phone/request-otp', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, requestPhoneOtp);

router.post('/account/phone/verify-otp', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, verifyPhoneOtp);

router.put('/account/password', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, changeAccountPassword);

router.get('/account/notification-preferences', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, getNotificationPreferences);

router.put('/account/notification-preferences', (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized user' });
}, updateNotificationPreferences);

module.exports = router;