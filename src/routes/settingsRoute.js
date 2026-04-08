const { Router } = require('express');
const { isAuthenticated } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');

const router = Router();

// All settings routes require authentication
router.use(isAuthenticated);

router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;