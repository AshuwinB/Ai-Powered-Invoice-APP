const ActivityLog = require('../models/ActivityLog');

const normalizeIp = (req) => (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').toString().split(',')[0].trim();

const logActivity = async ({ userId, action, category = 'system', details = '', metadata = {}, req = null }) => {
    try {
        if (!userId || !action) return;

        await ActivityLog.create({
            userId,
            action,
            category,
            details,
            metadata,
            ipAddress: req ? normalizeIp(req) : '',
            userAgent: req?.get?.('user-agent') || req?.headers?.['user-agent'] || '',
        });
    } catch (error) {
        // Logging should never break business flow.
        console.warn('Failed to write activity log:', error.message);
    }
};

module.exports = { logActivity };
