const Notification = require('../models/Notification');
const { setUnreadCountCache, broadcastToUser } = require('./notificationRealtime');

const allowedNotificationTypes = new Set([
    'auth-new-account-login',
    'security-new-login-request',
    'security-2fa-enabled',
    'invoice-new-created',
    'payment-received',
    'payment-refund-requested',
    'payment-refund-approved',
]);

const createUserNotification = async ({
    userId,
    notificationType = '',
    title,
    message,
    type = 'info',
    category = 'system',
    actionUrl = '',
    metadata = {},
}) => {
    if (!userId || !title || !message) {
        return null;
    }

    if (!allowedNotificationTypes.has(notificationType)) {
        return null;
    }

    const created = await Notification.create({
        userId,
        title,
        message,
        type,
        category,
        actionUrl,
        metadata,
    });

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    setUnreadCountCache(userId, unreadCount);
    broadcastToUser(userId, 'notification-created', {
        notification: created,
        unreadCount,
    });

    return created;
};

module.exports = {
    createUserNotification,
};
