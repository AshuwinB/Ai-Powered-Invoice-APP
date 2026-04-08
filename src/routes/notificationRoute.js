const { Router } = require('express');
const { isAuthenticated } = require('../middleware/auth');
const {
    listNotifications,
    streamNotifications,
    getUnreadNotificationCount,
    deleteNotification,
    markNotificationsAsSeen,
} = require('../controllers/notificationController');

const router = Router();

router.use(isAuthenticated);

router.get('/', listNotifications);
router.get('/stream', streamNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/seen', markNotificationsAsSeen);
router.delete('/:id', deleteNotification);

module.exports = router;
