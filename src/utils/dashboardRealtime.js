const _dashboardUserClients = new Map();

const toUserKey = (userId) => String(userId || '');

const sendEvent = (res, eventName, data) => {
    if (!res || res.writableEnded) return;
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data || {})}\n\n`);
};

const registerDashboardClient = ({ userId, res }) => {
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

    const existing = _dashboardUserClients.get(key) || new Set();
    existing.add(client);
    _dashboardUserClients.set(key, existing);

    sendEvent(res, 'connected', { ok: true, ts: Date.now() });

    res.on('close', () => {
        clearInterval(client.heartbeatInterval);
        const group = _dashboardUserClients.get(key);
        if (!group) return;
        group.delete(client);
        if (group.size === 0) {
            _dashboardUserClients.delete(key);
        }
        if (!res.writableEnded) {
            res.end();
        }
    });
};

const publishDashboardUpdate = (userId, payload = {}) => {
    const key = toUserKey(userId);
    const group = _dashboardUserClients.get(key);
    if (!group || group.size === 0) return;

    const data = {
        ts: Date.now(),
        ...payload,
    };

    for (const client of group) {
        sendEvent(client.res, 'dashboard-updated', data);
    }
};

module.exports = {
    registerDashboardClient,
    publishDashboardUpdate,
};
