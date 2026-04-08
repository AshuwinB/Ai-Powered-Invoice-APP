/**
 * In-process SSE broadcaster for login challenge events.
 * Maps challengeId → { res, userId, timer }
 * Keeps zero DB connections open for its operation.
 */

const _clients = new Map();

/**
 * Register an SSE subscriber for a specific challenge.
 * Called from the GET /login/challenge-stream/:challengeId endpoint.
 */
const registerClient = (challengeId, userId, res) => {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx passthrough
    res.flushHeaders();

    // Heartbeat every 25s so proxies don't close idle connections
    const heartbeatInterval = setInterval(() => {
        if (!res.writableEnded) {
            res.write(': heartbeat\n\n');
        }
    }, 25000);

    // Auto-expire after 3 minutes (challenge TTL)
    const expireTimer = setTimeout(() => {
        pushEvent(challengeId, 'expired', { status: 'expired' });
    }, 3 * 60 * 1000);

    _clients.set(challengeId, { res, userId: String(userId), heartbeatInterval, expireTimer });

    res.on('close', () => {
        removeClient(challengeId);
    });
};

/**
 * Push a named event to the waiting client for the given challenge.
 */
const pushEvent = (challengeId, eventName, data) => {
    const client = _clients.get(challengeId);
    if (!client || client.res.writableEnded) {
        return;
    }

    client.res.write(`event: ${eventName}\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    removeClient(challengeId);
};

const removeClient = (challengeId) => {
    const client = _clients.get(challengeId);
    if (!client) return;

    clearInterval(client.heartbeatInterval);
    clearTimeout(client.expireTimer);

    if (!client.res.writableEnded) {
        client.res.end();
    }

    _clients.delete(challengeId);
};

module.exports = { registerClient, pushEvent, removeClient };
