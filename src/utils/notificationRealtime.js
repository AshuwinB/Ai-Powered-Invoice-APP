const _userClients = new Map();
const _unreadCountCache = new Map();

const toUserKey = (userId) => String(userId || '');

const sendEvent = (res, eventName, data) => {
    if (!res || res.writableEnded) return;
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data || {})}\n\n`);
};

const registerNotificationClient = ({ userId, res, initialUnreadCount = 0 }) => {
    const key = toUserKey(userId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const client = {
        res,
        heartbeatInterval: setInterval(() => {
            if (!res.writableEnded) {
                res.write(': heartbeat\\n\\n');
            }
        }, 25000),
    };

    const existing = _userClients.get(key) || new Set();
    existing.add(client);
    _userClients.set(key, existing);

    sendEvent(res, 'connected', { unreadCount: initialUnreadCount });

    res.on('close', () => {
        clearInterval(client.heartbeatInterval);
        const group = _userClients.get(key);
        if (!group) return;
        group.delete(client);
        if (group.size === 0) {
            _userClients.delete(key);
        }
        if (!res.writableEnded) {
            res.end();
        }
    });
};

const broadcastToUser = (userId, eventName, data) => {
    const key = toUserKey(userId);
    const group = _userClients.get(key);
    if (!group || group.size === 0) return;

    for (const client of group) {
        sendEvent(client.res, eventName, data);
    }
};

const setUnreadCountCache = (userId, count) => {
    const key = toUserKey(userId);
    const safeCount = Math.max(0, Number(count || 0));
    _unreadCountCache.set(key, safeCount);
    broadcastToUser(userId, 'unread-count', { unreadCount: safeCount });
    return safeCount;
};

const incrementUnreadCountCache = (userId, delta = 1) => {
    const key = toUserKey(userId);
    const current = Number(_unreadCountCache.get(key) || 0);
    return setUnreadCountCache(userId, current + Number(delta || 0));
};

const getCachedUnreadCount = async (userId, fallbackLoader) => {
    const key = toUserKey(userId);
    if (_unreadCountCache.has(key)) {
        return Number(_unreadCountCache.get(key) || 0);
    }

    const loaded = await fallbackLoader();
    return setUnreadCountCache(userId, loaded);
};

module.exports = {
    registerNotificationClient,
    broadcastToUser,
    setUnreadCountCache,
    incrementUnreadCountCache,
    getCachedUnreadCount,
};
