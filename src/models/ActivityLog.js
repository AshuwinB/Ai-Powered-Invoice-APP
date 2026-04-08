const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    category: {
        type: String,
        enum: ['auth', 'invoice', 'payment', 'email', 'security', 'system'],
        default: 'system',
        index: true,
    },
    details: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
