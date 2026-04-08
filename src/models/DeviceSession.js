const mongoose = require('mongoose');

const deviceSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    sessionId: {
        type: String,
        required: true,
        index: true,
    },
    deviceId: {
        type: String,
        required: true,
        index: true,
    },
    userAgent: {
        type: String,
        default: '',
    },
    ipAddress: {
        type: String,
        default: '',
    },
    isTrusted: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    lastActiveAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

deviceSessionSchema.index({ userId: 1, deviceId: 1, isActive: 1 });

module.exports = mongoose.model('DeviceSession', deviceSessionSchema);
