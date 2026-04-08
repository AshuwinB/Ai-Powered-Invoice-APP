const mongoose = require('mongoose');

const loginApprovalSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    username: {
        type: String,
        required: true,
        index: true,
    },
    challengeId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    challengeToken: {
        type: String,
        required: true,
    },
    requestedCode: {
        type: String,
        required: true,
    },
    codeOptions: [{
        type: String,
        required: true,
    }],
    requestingDeviceId: {
        type: String,
        required: true,
    },
    requestingUserAgent: {
        type: String,
        default: '',
    },
    requestingIp: {
        type: String,
        default: '',
    },
    approvedByDeviceId: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'expired', 'completed'],
        default: 'pending',
        index: true,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true,
    },
}, { timestamps: true });

loginApprovalSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('LoginApproval', loginApprovalSchema);
