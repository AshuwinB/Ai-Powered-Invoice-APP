const mongoose = require('mongoose'); 

const userSchema = new mongoose.Schema({
    username: {
        type: String,   
        required: true,
        unique: true,
    },  
    password: {
        type: String,
        required: true,
    },
    displayName: {
        type: String,
        default: '',
        trim: true,
    },
    email: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        default: '',
        trim: true,
    },
    emailVerifiedAt: {
        type: Date,
    },
    phoneVerifiedAt: {
        type: Date,
    },
    pendingEmail: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
    },
    pendingEmailOtpHash: {
        type: String,
        default: '',
    },
    pendingEmailOtpExpiresAt: {
        type: Date,
    },
    pendingPhone: {
        type: String,
        default: '',
        trim: true,
    },
    pendingPhoneOtpHash: {
        type: String,
        default: '',
    },
    pendingPhoneOtpExpiresAt: {
        type: Date,
    },
    loginAttempts: {
        type: Number,
        default: 0,
    },
    lockUntil: {
        type: Date,
    },
    isMfaActive: {
        type: Boolean,
        default: false,
    },
    twoFASecret: {
        type: String,
    },
    hasCompleted2faOnboarding: {
        type: Boolean,
        default: false,
    },
    notificationPreferences: {
        authNotifications: {
            type: Boolean,
            default: true,
        },
        securityNotifications: {
            type: Boolean,
            default: true,
        },
        invoiceNotifications: {
            type: Boolean,
            default: true,
        },
        paymentNotifications: {
            type: Boolean,
            default: true,
        },
        systemNotifications: {
            type: Boolean,
            default: true,
        },
    },
}, { timestamps: true });   

userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.index(
    { email: 1 },
    {
        unique: true,
        partialFilterExpression: { email: { $type: 'string', $ne: '' } },
    }
);

userSchema.index(
    { phone: 1 },
    {
        unique: true,
        partialFilterExpression: { phone: { $type: 'string', $ne: '' } },
    }
);

module.exports = mongoose.model("User", userSchema);
    
// const User = mongoose.model("User", userSchema);

// module.exports = User;

