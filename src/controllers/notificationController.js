const Notification = require('../models/Notification');
const {
    registerNotificationClient,
    broadcastToUser,
    setUnreadCountCache,
    getCachedUnreadCount,
} = require('../utils/notificationRealtime');

const refreshUnreadCount = async (userId) => {
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    return setUnreadCountCache(userId, unreadCount);
};

const parseLimit = (value, fallback = 20, max = 100) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(parsed, max);
};

const listNotifications = async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit, 20, 100);
        const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
        const category = String(req.query.category || '').trim();
        const status = String(req.query.status || 'all').trim().toLowerCase();

        const query = { userId: req.user._id };
        if (category && category !== 'all') {
            query.category = category;
        }

        if (status === 'read') {
            query.isRead = true;
        } else if (status === 'unread') {
            query.isRead = false;
        }

        const [items, total, unreadCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Notification.countDocuments(query),
            getCachedUnreadCount(req.user._id, () => Notification.countDocuments({ userId: req.user._id, isRead: false })),
        ]);

        return res.status(200).json({
            notifications: items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1),
            },
            unreadCount,
        });
    } catch (error) {
        console.error('Error listing notifications:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const streamNotifications = async (req, res) => {
    try {
        const unreadCount = await getCachedUnreadCount(
            req.user._id,
            () => Notification.countDocuments({ userId: req.user._id, isRead: false })
        );
        registerNotificationClient({ userId: req.user._id, res, initialUnreadCount: unreadCount });
    } catch (error) {
        console.error('Error opening notification stream:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const getUnreadNotificationCount = async (req, res) => {
    try {
        const unreadCount = await getCachedUnreadCount(
            req.user._id,
            () => Notification.countDocuments({ userId: req.user._id, isRead: false })
        );
        return res.status(200).json({ unreadCount });
    } catch (error) {
        console.error('Error fetching notification unread count:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const markNotificationAsRead = async (req, res) => {
    try {
        const existing = await Notification.findOne({ _id: req.params.id, userId: req.user._id }).lean();

        if (!existing) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        const notification = existing.isRead
            ? existing
            : await Notification.findOneAndUpdate(
                { _id: req.params.id, userId: req.user._id, isRead: false },
                { isRead: true, readAt: new Date() },
                { new: true }
            ).lean();

        if (!existing.isRead && notification) {
            await refreshUnreadCount(req.user._id);
            broadcastToUser(req.user._id, 'notification-read', { id: notification._id });
        }

        return res.status(200).json({ message: 'Notification marked as read', notification });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const markAllNotificationsAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user._id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        await refreshUnreadCount(req.user._id);
        broadcastToUser(req.user._id, 'all-notifications-read', {});

        return res.status(200).json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id }).lean();

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        if (!notification.isRead) {
            await refreshUnreadCount(req.user._id);
        }
        broadcastToUser(req.user._id, 'notification-deleted', { id: notification._id });

        return res.status(200).json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const clearReadNotifications = async (req, res) => {
    try {
        const result = await Notification.deleteMany({ userId: req.user._id, isRead: true });
        broadcastToUser(req.user._id, 'read-notifications-cleared', { deletedCount: result.deletedCount || 0 });
        return res.status(200).json({
            message: 'Read notifications cleared',
            deletedCount: result.deletedCount || 0,
        });
    } catch (error) {
        console.error('Error clearing read notifications:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const markNotificationsAsSeen = async (req, res) => {
    try {
        const result = await Notification.updateMany(
            {
                userId: req.user._id,
                isRead: false,
                'metadata.notificationKind': { $nin: ['login-approval-request', 'refund-request'] },
            },
            { isRead: true, readAt: new Date() }
        );

        const unreadCount = await refreshUnreadCount(req.user._id);
        broadcastToUser(req.user._id, 'notifications-seen', {
            seenCount: result.modifiedCount || 0,
            unreadCount,
        });

        return res.status(200).json({
            message: 'Notifications marked as seen',
            seenCount: result.modifiedCount || 0,
            unreadCount,
        });
    } catch (error) {
        console.error('Error marking notifications as seen:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    listNotifications,
    streamNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearReadNotifications,
    markNotificationsAsSeen,
};
