const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/user');
const DeviceSession = require('../models/DeviceSession');
const LoginApproval = require('../models/LoginApproval');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { sendSecurityOtpEmail, sendPhoneOtp } = require('../utils/emailService');
const { registerClient, pushEvent } = require('../utils/challengeSse');
const { logActivity } = require('../utils/activityLogger');
const { createUserNotification } = require('../utils/notificationService');
const { setUnreadCountCache, broadcastToUser } = require('../utils/notificationRealtime');

const CHALLENGE_TTL_MS = 2 * 60 * 1000;

const getRequestDeviceId = (req) => req.get('x-device-id') || `legacy-${req.ip}`;
const getRequestIp = (req) => (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
const OTP_TTL_MS = 10 * 60 * 1000;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').trim().replace(/\s+/g, '');
const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');
const createSixDigitOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const toDeviceSummary = (record, currentSessionId = '') => ({
    id: record._id,
    deviceId: record.deviceId,
    userAgent: record.userAgent,
    ipAddress: record.ipAddress,
    isTrusted: record.isTrusted,
    isActive: record.isActive,
    isCurrent: record.sessionId === currentSessionId,
    createdAt: record.createdAt,
    lastActiveAt: record.lastActiveAt,
});

const createCodeOptions = () => {
    const values = new Set();
    while (values.size < 3) {
        values.add(String(Math.floor(100 + Math.random() * 900)));
    }
    const options = Array.from(values);
    const requestedCode = options[Math.floor(Math.random() * options.length)];
    return { options, requestedCode };
};

const resolveLoginApprovalNotifications = async (userId, challengeId, status) => {
    if (!userId || !challengeId) {
        return;
    }

    const resolvedAt = new Date();

    await Notification.updateMany(
        {
            userId,
            'metadata.notificationKind': 'login-approval-request',
            'metadata.challengeId': challengeId,
        },
        {
            $set: {
                isRead: true,
                readAt: resolvedAt,
                'metadata.resolutionStatus': status,
                'metadata.resolvedAt': resolvedAt,
            },
        }
    );

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });
    setUnreadCountCache(userId, unreadCount);
    broadcastToUser(userId, 'login-approval-resolved', {
        challengeId,
        status,
        resolvedAt: resolvedAt.toISOString(),
        unreadCount,
    });
};

const register = async(req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            username,
            password: hashedPassword,
            displayName: username,
            isMfaActive: false,
        });
        await logActivity({
            userId: user._id,
            action: 'ACCOUNT_REGISTER',
            category: 'auth',
            details: `New account created for ${username}`,
            req,
        });
        console.log('New Registering user:', username);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const shouldRequireLoginApproval = async (req, user) => {
    if (!user.isMfaActive) {
        return false;
    }

    const deviceId = getRequestDeviceId(req);
    const isKnownTrustedDevice = await DeviceSession.exists({ userId: user._id, deviceId, isTrusted: true });
    if (isKnownTrustedDevice) {
        return false;
    }

    const anyTrustedDevice = await DeviceSession.exists({ userId: user._id, isTrusted: true });
    return Boolean(anyTrustedDevice);
};

const createLoginApprovalChallenge = async (req, res, user) => {
    const { options, requestedCode } = createCodeOptions();
    const challengeId = crypto.randomBytes(16).toString('hex');
    const challengeToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    const requestingDeviceId = getRequestDeviceId(req);
    const requestingUserAgent = req.get('user-agent') || '';
    const requestingIp = getRequestIp(req);

    await LoginApproval.create({
        userId: user._id,
        username: user.username,
        challengeId,
        challengeToken,
        requestedCode,
        codeOptions: options,
        requestingDeviceId,
        requestingUserAgent,
        requestingIp,
        expiresAt,
        status: 'pending',
    });

    await createUserNotification({
        userId: user._id,
        eventKey: 'security',
        notificationType: 'security-new-login-request',
        title: 'New Login Request',
        message: `Approve sign-in from ${requestingUserAgent || 'a new device'} using code ${requestedCode}.`,
        type: 'warning',
        category: 'security',
        actionUrl: '/notifications',
        metadata: {
            notificationKind: 'login-approval-request',
            challengeId,
            requestedCode,
            codeOptions: options,
            requestingDeviceId,
            requestingUserAgent,
            requestingIp,
            expiresAt,
        },
    });

    await logActivity({
        userId: user._id,
        action: 'ACCOUNT_LOGIN_APPROVAL_REQUESTED',
        category: 'auth',
        details: `Login approval requested from ${requestingUserAgent || 'a new device'}`,
        metadata: {
            deviceId: requestingDeviceId,
            ipAddress: requestingIp,
            challengeId,
        },
        req,
    });

    return res.status(202).json({
        message: 'Login approval required from a trusted device.',
        requiresDeviceApproval: true,
        challengeId,
        challengeToken,
        securityCode: requestedCode,
        expiresAt,
    });
};

const login = async(req, res) => {
    req.user.loginAttempts = 0;
    req.user.lockUntil = undefined;
    await req.user.save();

    const deviceId = getRequestDeviceId(req);
    const anyTrustedDevice = await DeviceSession.exists({ userId: req.user._id, isTrusted: true });
    const currentTrustedDevice = await DeviceSession.exists({ userId: req.user._id, isTrusted: true, deviceId });
    const shouldTrustCurrentDevice = Boolean(req.trustCurrentDevice)
        || !req.user.isMfaActive
        || !anyTrustedDevice
        || Boolean(currentTrustedDevice);

    await DeviceSession.findOneAndUpdate(
        { userId: req.user._id, sessionId: req.sessionID },
        {
            userId: req.user._id,
            sessionId: req.sessionID,
            deviceId,
            userAgent: req.get('user-agent') || '',
            ipAddress: getRequestIp(req),
            isTrusted: shouldTrustCurrentDevice,
            isActive: true,
            lastActiveAt: new Date(),
        },
        { upsert: true, setDefaultsOnInsert: true, new: true }
    );

    console.log('User logged in:', req.user);
    await logActivity({
        userId: req.user._id,
        action: 'ACCOUNT_LOGIN',
        category: 'auth',
        details: `User ${req.user.username} logged in`,
        metadata: { isMfaActive: req.user.isMfaActive, deviceId },
        req,
    });
    if (!req.skipDefaultLoginNotification) {
        await createUserNotification({
            userId: req.user._id,
            eventKey: 'login',
            notificationType: 'auth-new-account-login',
            title: 'New Account login',
            message: `A sign-in completed from ${req.get('user-agent') || 'a new device'}.`,
            type: 'info',
            category: 'auth',
            actionUrl: '/profile',
            metadata: { deviceId, ipAddress: getRequestIp(req) },
            bypassPreferences: true,
        });
    }
    res.status(200).json({
        message: 'Login successful',
        user: req.user.username,
        displayName: req.user.displayName || req.user.username,
        email: req.user.email || '',
        phone: req.user.phone || '',
        isMfaActive: req.user.isMfaActive,
        hasCompleted2faOnboarding: req.user.hasCompleted2faOnboarding,
        shouldSetup2faOnboarding: !req.user.hasCompleted2faOnboarding
    });
};

const authStatus = async(req, res) => {
    if (req.user) {
        res.status(200).json({
            message: 'Authenticated',
            user: req.user.username,
            displayName: req.user.displayName || req.user.username,
            email: req.user.email || '',
            phone: req.user.phone || '',
            isMfaActive: req.user.isMfaActive,
            hasCompleted2faOnboarding: req.user.hasCompleted2faOnboarding,
            shouldSetup2faOnboarding: !req.user.hasCompleted2faOnboarding
        });
    } else {
        res.status(401).json({ message: 'Unauthorized user' });
    }
};

const logout = async(req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized user' });
    }

    await DeviceSession.findOneAndUpdate(
        { userId: req.user._id, sessionId: req.sessionID, isActive: true },
        { isActive: false, lastActiveAt: new Date() }
    );

    await logActivity({
        userId: req.user._id,
        action: 'ACCOUNT_LOGOUT',
        category: 'auth',
        details: `User ${req.user.username} logged out`,
        metadata: { sessionId: req.sessionID },
        req,
    });

    req.logout((err) => {
        if (err) {
            return res.status(400).json({ message: 'User not logged in!' });
        }
        req.session.destroy(() => {
            res.clearCookie('connect.sid');
            res.status(200).json({ message: 'Logout successful' });
        });
    });
};

const setup2FA = async(req, res) => {
    try {
        const user = req.user;
        const secret = speakeasy.generateSecret({ length: 20 });
        user.twoFASecret = secret.base32;
        await user.save();

        const url = speakeasy.otpauthURL({
            secret: secret.ascii,
            label: `2FA Demo (${user.username})`,
        });
        const qrCodeDataURL = await qrcode.toDataURL(url);
        res.json({ message: '2FA setup successful', qrCodeDataURL, secret: secret.base32 });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const verify2FA = async(req, res) => {
    const rawToken = String(req.body?.token || '');
    const token = rawToken.replace(/\s+/g, '');
    try {
        const user = req.user;

        if (!user?.twoFASecret) {
            return res.status(400).json({ message: '2FA setup is incomplete. Please generate a new QR code and try again.' });
        }

        if (!/^\d{6}$/.test(token)) {
            return res.status(400).json({ message: 'Enter a valid 6-digit authentication code.' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFASecret,
            encoding: 'base32',
            token,
            window: 1,
        });

        if (verified) {
            user.isMfaActive = true;
            user.hasCompleted2faOnboarding = true;
            await user.save();

            await logActivity({
                userId: user._id,
                action: 'ACCOUNT_2FA_ENABLED',
                category: 'security',
                details: 'Two-factor authentication was enabled',
                req,
            });

            await DeviceSession.findOneAndUpdate(
                { userId: user._id, sessionId: req.sessionID },
                {
                    userId: user._id,
                    sessionId: req.sessionID,
                    deviceId: getRequestDeviceId(req),
                    userAgent: req.get('user-agent') || '',
                    ipAddress: getRequestIp(req),
                    isTrusted: true,
                    isActive: true,
                    lastActiveAt: new Date(),
                },
                { upsert: true, setDefaultsOnInsert: true, new: true }
            );

            const jwtToken = jwt.sign(
                { id: user._id, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            await createUserNotification({
                userId: user._id,
                eventKey: 'security',
                notificationType: 'security-2fa-enabled',
                title: '2FA enabled',
                message: 'Two-factor authentication has been enabled for your account.',
                type: 'success',
                category: 'security',
                actionUrl: '/profile',
            });
            res.status(200).json({ message: '2FA verification successful', jwtToken });
        } else {
            res.status(400).json({ message: 'Invalid 2FA token. Check your authenticator app time and try the latest code.' });
        }
    } catch (error) {
        console.error('2FA verification error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const reset2FA = async(req, res) => {
    try {
        const user = req.user;
        user.twoFASecret = '';
        user.isMfaActive = false;
        await user.save();
        await logActivity({
            userId: user._id,
            action: 'ACCOUNT_2FA_DISABLED',
            category: 'security',
            details: 'Two-factor authentication disabled',
            req,
        });
        res.status(200).json({ message: '2FA has been reset. Please set up again.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const skip2FAOnboarding = async(req, res) => {
    try {
        const user = req.user;
        user.hasCompleted2faOnboarding = true;
        await user.save();
        res.status(200).json({ message: '2FA onboarding skipped for this account' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const getPendingLoginApprovals = async (req, res) => {
    try {
        const pending = await LoginApproval.find({
            userId: req.user._id,
            status: 'pending',
            expiresAt: { $gt: new Date() },
        }).sort({ createdAt: -1 });

        res.status(200).json(pending.map((item) => ({
            challengeId: item.challengeId,
            requestedCode: item.requestedCode,
            codeOptions: item.codeOptions,
            requestingDeviceId: item.requestingDeviceId,
            requestingUserAgent: item.requestingUserAgent,
            requestingIp: item.requestingIp,
            createdAt: item.createdAt,
            expiresAt: item.expiresAt,
        })));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const approvePendingLogin = async (req, res) => {
    try {
        const { challengeId, selectedCode } = req.body;
        const challenge = await LoginApproval.findOne({ challengeId, userId: req.user._id, status: 'pending' });

        if (!challenge) {
            return res.status(404).json({ message: 'Approval request not found' });
        }

        if (challenge.expiresAt <= new Date()) {
            challenge.status = 'expired';
            await challenge.save();
            await resolveLoginApprovalNotifications(challenge.userId, challenge.challengeId, 'expired');
            return res.status(400).json({ message: 'Approval request expired' });
        }

        if (selectedCode !== challenge.requestedCode) {
            challenge.status = 'rejected';
            await challenge.save();
            await resolveLoginApprovalNotifications(challenge.userId, challenge.challengeId, 'incorrect-code');
            pushEvent(challengeId, 'rejected', {
                status: 'rejected',
                reason: 'incorrect_code',
            });
            return res.status(400).json({
                message: 'Incorrect security code selected. This login attempt was cancelled and must be retried.',
            });
        }

        challenge.status = 'approved';
        challenge.approvedByDeviceId = getRequestDeviceId(req);
        await challenge.save();
        await resolveLoginApprovalNotifications(challenge.userId, challenge.challengeId, 'approved');

        await logActivity({
            userId: challenge.userId,
            action: 'ACCOUNT_LOGIN_APPROVAL_APPROVED',
            category: 'auth',
            details: `Login approval accepted from approving device`,
            metadata: {
                challengeId,
                approver: getRequestDeviceId(req),
                originalDevice: challenge.requestingDeviceId,
            },
            req,
        });

        pushEvent(challengeId, 'approved', { status: 'approved' });

        res.status(200).json({ message: 'Login approved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const rejectPendingLogin = async (req, res) => {
    try {
        const { challengeId } = req.body;
        const challenge = await LoginApproval.findOne({ challengeId, userId: req.user._id, status: 'pending' });

        if (!challenge) {
            return res.status(404).json({ message: 'Approval request not found' });
        }

        challenge.status = 'rejected';
        await challenge.save();
        await resolveLoginApprovalNotifications(challenge.userId, challenge.challengeId, 'rejected');

        await logActivity({
            userId: challenge.userId,
            action: 'ACCOUNT_LOGIN_APPROVAL_REJECTED',
            category: 'auth',
            details: `Login approval request was rejected`,
            metadata: {
                challengeId,
                rejectedBy: getRequestDeviceId(req),
                requestedDevice: challenge.requestingDeviceId,
            },
            req,
        });

        pushEvent(challengeId, 'rejected', { status: 'rejected' });

        res.status(200).json({ message: 'Login rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const getLoginChallengeStatus = async (req, res) => {
    try {
        const { challengeId } = req.body;
        const challenge = await LoginApproval.findOne({ challengeId });

        if (!challenge) {
            return res.status(404).json({ message: 'Challenge not found' });
        }

        if (challenge.expiresAt <= new Date() && challenge.status === 'pending') {
            challenge.status = 'expired';
            await challenge.save();
            await resolveLoginApprovalNotifications(challenge.userId, challenge.challengeId, 'expired');
        }

        res.status(200).json({ status: challenge.status, expiresAt: challenge.expiresAt });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const completeApprovedLogin = async (req, res, next) => {
    try {
        const { challengeId, challengeToken } = req.body;
        const challenge = await LoginApproval.findOne({ challengeId, challengeToken });

        if (!challenge) {
            return res.status(404).json({ message: 'Challenge not found' });
        }

        if (challenge.expiresAt <= new Date()) {
            challenge.status = 'expired';
            await challenge.save();
            await resolveLoginApprovalNotifications(challenge.userId, challenge.challengeId, 'expired');
            return res.status(400).json({ message: 'Challenge expired' });
        }

        if (challenge.status !== 'approved') {
            return res.status(400).json({ message: `Challenge is ${challenge.status}` });
        }

        const user = await User.findById(challenge.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        req.logIn(user, async (err) => {
            if (err) return next(err);

            req.user = user;
            req.trustCurrentDevice = true;
            challenge.status = 'completed';
            await challenge.save();
            await createUserNotification({
                userId: user._id,
                eventKey: 'login',
                notificationType: 'auth-new-account-login',
                title: 'New Account login',
                message: `A sign-in from ${challenge.requestingUserAgent || 'a new device'} was successfully approved and completed.`,
                type: 'success',
                category: 'auth',
                actionUrl: '/profile',
                metadata: {
                    deviceId: challenge.requestingDeviceId,
                    ipAddress: challenge.requestingIp,
                    loginApprovalChallengeId: challenge.challengeId,
                    approvedByDeviceId: challenge.approvedByDeviceId || '',
                },
                bypassPreferences: true,
            });
            req.skipDefaultLoginNotification = true;
            return login(req, res);
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const getActiveDevices = async (req, res) => {
    try {
        const records = await DeviceSession.find({ userId: req.user._id, isActive: true }).sort({ lastActiveAt: -1 });
        res.status(200).json(records.map((item) => toDeviceSummary(item, req.sessionID)));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const logoutDevice = async (req, res) => {
    try {
        const { id } = req.params;
        const currentSession = await DeviceSession.findOne({
            userId: req.user._id,
            sessionId: req.sessionID,
            isActive: true,
        });

        if (!currentSession) {
            return res.status(401).json({ message: 'Current session not found' });
        }

        const record = await DeviceSession.findOne({ _id: id, userId: req.user._id, isActive: true });

        if (!record) {
            return res.status(404).json({ message: 'Device session not found' });
        }

        if (!currentSession.isTrusted && record.isTrusted) {
            return res.status(403).json({ message: 'Untrusted devices cannot logout trusted devices' });
        }

        record.isActive = false;
        // Revoking trust ensures next login from this device requires fresh approval.
        record.isTrusted = false;
        await record.save();

        await DeviceSession.updateMany(
            {
                userId: req.user._id,
                deviceId: record.deviceId,
                _id: { $ne: record._id },
                isTrusted: true,
            },
            { isTrusted: false }
        );

        req.sessionStore.destroy(record.sessionId, () => {});

        await logActivity({
            userId: req.user._id,
            action: 'ACCOUNT_DEVICE_REMOVED',
            category: 'security',
            details: `Removed device session ${record.deviceId || record._id}`,
            metadata: {
                deviceSessionId: record._id,
                deviceId: record.deviceId,
                userAgent: record.userAgent,
                ipAddress: record.ipAddress,
                wasTrusted: record.isTrusted,
            },
            req,
        });

        res.status(200).json({ message: 'Device logged out successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const logoutOtherDevices = async (req, res) => {
    try {
        const currentSession = await DeviceSession.findOne({
            userId: req.user._id,
            isActive: true,
            sessionId: req.sessionID,
        });

        if (!currentSession) {
            return res.status(401).json({ message: 'Current session not found' });
        }

        const query = {
            userId: req.user._id,
            isActive: true,
            sessionId: { $ne: req.sessionID },
        };

        if (!currentSession.isTrusted) {
            query.isTrusted = false;
        }

        const records = await DeviceSession.find(query);

        await Promise.all(records.map(async (record) => {
            record.isActive = false;
            record.isTrusted = false;
            await record.save();

            await DeviceSession.updateMany(
                {
                    userId: req.user._id,
                    deviceId: record.deviceId,
                    _id: { $ne: record._id },
                    isTrusted: true,
                },
                { isTrusted: false }
            );

            req.sessionStore.destroy(record.sessionId, () => {});
        }));

        await logActivity({
            userId: req.user._id,
            action: 'ACCOUNT_LOGOUT_OTHER_DEVICES',
            category: 'security',
            details: `Logged out ${records.length} other device session(s)`,
            metadata: { count: records.length, currentSessionTrusted: currentSession.isTrusted },
            req,
        });

        res.status(200).json({
            message: currentSession.isTrusted
                ? 'Logged out from other devices'
                : 'Logged out from other untrusted devices',
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const updateSessionActivity = async (req, res, next) => {
    try {
        if (req.isAuthenticated() && req.user && req.sessionID) {
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            await DeviceSession.findOneAndUpdate(
                {
                    userId: req.user._id,
                    sessionId: req.sessionID,
                    isActive: true,
                    $or: [
                        { lastActiveAt: { $lte: twoMinutesAgo } },
                        { lastActiveAt: { $exists: false } },
                    ],
                },
                { lastActiveAt: new Date() }
            );
        }
    } catch (error) {
        console.warn('Failed to update device session activity:', error.message);
    }
    next();
};

const streamChallengeStatus = async (req, res) => {
    const { challengeId } = req.params;

    if (!challengeId) {
        return res.status(400).json({ message: 'challengeId is required' });
    }

    const challenge = await LoginApproval.findOne({ challengeId });

    if (!challenge) {
        return res.status(404).json({ message: 'Challenge not found' });
    }

    if (challenge.expiresAt <= new Date() || challenge.status !== 'pending') {
        return res.status(400).json({ message: `Challenge is ${challenge.status}` });
    }

    registerClient(challengeId, challenge.userId, res);
};

const getActivityLogs = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
        const logs = await ActivityLog.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(Number.isNaN(limit) ? 100 : limit)
            .lean();

        res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getAccountProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({
            username: user.username,
            displayName: user.displayName || user.username,
            email: user.email || '',
            phone: user.phone || '',
            emailVerified: Boolean(user.email && user.emailVerifiedAt),
            phoneVerified: Boolean(user.phone && user.phoneVerifiedAt),
            pendingEmail: user.pendingEmail || '',
            pendingPhone: user.pendingPhone || '',
            isMfaActive: user.isMfaActive,
        });
    } catch (error) {
        console.error('Error fetching account profile:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const updateAccountProfile = async (req, res) => {
    try {
        const displayName = String(req.body?.displayName || '').trim();
        const email = normalizeEmail(req.body?.email);
        const phone = normalizePhone(req.body?.phone);

        const existingUser = await User.findById(req.user._id);
        if (!existingUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!displayName) {
            return res.status(400).json({ message: 'Display name is required' });
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Enter a valid email address' });
        }

        if (email !== (existingUser.email || '')) {
            return res.status(400).json({ message: 'Verify your new email with OTP before saving profile.' });
        }

        if (phone && !/^\+?[1-9]\d{7,14}$/.test(phone)) {
            return res.status(400).json({ message: 'Enter a valid phone number with country code.' });
        }

        if (phone !== (existingUser.phone || '')) {
            return res.status(400).json({ message: 'Verify your new phone with OTP before saving profile.' });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { displayName, email, phone },
            { new: true }
        );

        await logActivity({
            userId: req.user._id,
            action: 'ACCOUNT_PROFILE_UPDATED',
            category: 'auth',
            details: 'Updated account profile details',
            req,
        });

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'security',
            title: 'Profile updated',
            message: 'Your account profile details were updated successfully.',
            type: 'success',
            category: 'security',
            actionUrl: '/profile',
        });

        return res.status(200).json({
            message: 'Profile updated successfully',
            username: user.username,
            displayName: user.displayName || user.username,
            email: user.email || '',
            phone: user.phone || '',
            emailVerified: Boolean(user.email && user.emailVerifiedAt),
            phoneVerified: Boolean(user.phone && user.phoneVerifiedAt),
            isMfaActive: user.isMfaActive,
        });
    } catch (error) {
        console.error('Error updating account profile:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const requestEmailOtp = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: 'Enter a valid email address' });
        }

        const taken = await User.findOne({ _id: { $ne: req.user._id }, email }).lean();
        if (taken) {
            return res.status(409).json({ message: 'This email is already in use by another account' });
        }

        const user = await User.findById(req.user._id);
        const otp = createSixDigitOtp();

        user.pendingEmail = email;
        user.pendingEmailOtpHash = hashOtp(otp);
        user.pendingEmailOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
        await user.save();

        await sendSecurityOtpEmail({
            recipientEmail: email,
            otp,
            displayName: user.displayName || user.username,
        });

        await logActivity({
            userId: req.user._id,
            action: 'ACCOUNT_EMAIL_OTP_REQUESTED',
            category: 'security',
            details: `Requested email verification OTP for ${email}`,
            req,
        });

        return res.status(200).json({ message: 'OTP sent to email' });
    } catch (error) {
        console.error('Error requesting email OTP:', error);
        return res.status(500).json({ message: 'Failed to send email OTP' });
    }
};

const verifyEmailOtp = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const otp = String(req.body?.otp || '').trim();

        if (!email || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({ message: 'Enter valid email and 6-digit OTP' });
        }

        const user = await User.findById(req.user._id);
        if (!user.pendingEmail || user.pendingEmail !== email) {
            return res.status(400).json({ message: 'No pending OTP request for this email' });
        }

        if (!user.pendingEmailOtpExpiresAt || user.pendingEmailOtpExpiresAt < new Date()) {
            return res.status(400).json({ message: 'Email OTP has expired. Request a new OTP.' });
        }

        if (hashOtp(otp) !== user.pendingEmailOtpHash) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const taken = await User.findOne({ _id: { $ne: req.user._id }, email }).lean();
        if (taken) {
            return res.status(409).json({ message: 'This email is already in use by another account' });
        }

        user.email = email;
        user.emailVerifiedAt = new Date();
        user.pendingEmail = '';
        user.pendingEmailOtpHash = '';
        user.pendingEmailOtpExpiresAt = undefined;
        await user.save();

        await logActivity({
            userId: req.user._id,
            action: 'ACCOUNT_EMAIL_VERIFIED',
            category: 'security',
            details: `Email verified for ${email}`,
            req,
        });

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'security',
            title: 'Email verified',
            message: `Your email ${email} has been verified.`,
            type: 'success',
            category: 'security',
            actionUrl: '/profile',
        });

        return res.status(200).json({ message: 'Email verified successfully', email, emailVerified: true });
    } catch (error) {
        console.error('Error verifying email OTP:', error);
        return res.status(500).json({ message: 'Failed to verify email OTP' });
    }
};

const requestPhoneOtp = async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone);

        if (!phone || !/^\+?[1-9]\d{7,14}$/.test(phone)) {
            return res.status(400).json({ message: 'Enter a valid phone number with country code' });
        }

        const taken = await User.findOne({ _id: { $ne: req.user._id }, phone }).lean();
        if (taken) {
            return res.status(409).json({ message: 'This phone number is already in use by another account' });
        }

        const user = await User.findById(req.user._id);
        const otp = createSixDigitOtp();

        user.pendingPhone = phone;
        user.pendingPhoneOtpHash = hashOtp(otp);
        user.pendingPhoneOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
        await user.save();

        const phoneSendResult = await sendPhoneOtp({ phone, otp });

        await logActivity({
            userId: req.user._id,
            action: 'ACCOUNT_PHONE_OTP_REQUESTED',
            category: 'security',
            details: `Requested phone verification OTP for ${phone}`,
            req,
        });

        return res.status(200).json({
            message: 'OTP sent to phone',
            ...(phoneSendResult.mode === 'dev-log' ? { devOtp: phoneSendResult.devOtp } : {}),
        });
    } catch (error) {
        console.error('Error requesting phone OTP:', error);
        if (error.code === 'TWILIO_SAME_TO_FROM' || String(error.message || '').includes('21266')) {
            return res.status(400).json({
                message: 'Phone OTP failed: destination number cannot be the same as TWILIO_PHONE_NUMBER. Use a different user phone number.',
            });
        }

        if (String(error.message || '').includes('21608')) {
            return res.status(400).json({
                message: 'Twilio trial restriction: verify this destination number in Twilio Console first.',
            });
        }

        return res.status(500).json({ message: 'Failed to send phone OTP' });
    }
};

const verifyPhoneOtp = async (req, res) => {
    try {
        const phone = normalizePhone(req.body?.phone);
        const otp = String(req.body?.otp || '').trim();

        if (!phone || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({ message: 'Enter valid phone and 6-digit OTP' });
        }

        const user = await User.findById(req.user._id);
        if (!user.pendingPhone || user.pendingPhone !== phone) {
            return res.status(400).json({ message: 'No pending OTP request for this phone number' });
        }

        if (!user.pendingPhoneOtpExpiresAt || user.pendingPhoneOtpExpiresAt < new Date()) {
            return res.status(400).json({ message: 'Phone OTP has expired. Request a new OTP.' });
        }

        if (hashOtp(otp) !== user.pendingPhoneOtpHash) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        const taken = await User.findOne({ _id: { $ne: req.user._id }, phone }).lean();
        if (taken) {
            return res.status(409).json({ message: 'This phone number is already in use by another account' });
        }

        user.phone = phone;
        user.phoneVerifiedAt = new Date();
        user.pendingPhone = '';
        user.pendingPhoneOtpHash = '';
        user.pendingPhoneOtpExpiresAt = undefined;
        await user.save();

        await logActivity({
            userId: req.user._id,
            action: 'ACCOUNT_PHONE_VERIFIED',
            category: 'security',
            details: `Phone verified for ${phone}`,
            req,
        });

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'security',
            title: 'Phone verified',
            message: `Your phone number ${phone} has been verified.`,
            type: 'success',
            category: 'security',
            actionUrl: '/profile',
        });

        return res.status(200).json({ message: 'Phone verified successfully', phone, phoneVerified: true });
    } catch (error) {
        console.error('Error verifying phone OTP:', error);
        return res.status(500).json({ message: 'Failed to verify phone OTP' });
    }
};
const changeAccountPassword = async (req, res) => {
    try {
        const currentPassword = String(req.body?.currentPassword || '');
        const newPassword = String(req.body?.newPassword || '');

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user._id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        await logActivity({
            userId: req.user._id,
            action: 'ACCOUNT_PASSWORD_CHANGED',
            category: 'security',
            details: 'Account password was changed',
            req,
        });

        await createUserNotification({
            userId: req.user._id,
            eventKey: 'security',
            title: 'Password changed',
            message: 'Your account password was changed successfully.',
            type: 'warning',
            category: 'security',
            actionUrl: '/profile',
        });

        return res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error changing account password:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const getNotificationPreferences = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('notificationPreferences');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({
            notificationPreferences: user.notificationPreferences || {
                authNotifications: true,
                securityNotifications: true,
                invoiceNotifications: true,
                paymentNotifications: true,
                systemNotifications: true,
            },
        });
    } catch (error) {
        console.error('Error fetching notification preferences:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const updateNotificationPreferences = async (req, res) => {
    try {
        const preferences = req.body?.notificationPreferences || {};

        const validPreferences = {
            authNotifications: Boolean(preferences.authNotifications),
            securityNotifications: Boolean(preferences.securityNotifications),
            invoiceNotifications: Boolean(preferences.invoiceNotifications),
            paymentNotifications: Boolean(preferences.paymentNotifications),
            systemNotifications: Boolean(preferences.systemNotifications),
        };

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { notificationPreferences: validPreferences },
            { new: true }
        ).select('notificationPreferences');

        await logActivity({
            userId: req.user._id,
            action: 'ACCOUNT_NOTIFICATION_PREFERENCES_UPDATED',
            category: 'system',
            details: 'Updated notification preferences',
            metadata: validPreferences,
            req,
        });

        return res.status(200).json({
            message: 'Notification preferences updated successfully',
            notificationPreferences: validPreferences,
        });
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    register,
    login,
    authStatus,
    logout,
    setup2FA,
    verify2FA,
    reset2FA,
    skip2FAOnboarding,
    shouldRequireLoginApproval,
    createLoginApprovalChallenge,
    getPendingLoginApprovals,
    approvePendingLogin,
    rejectPendingLogin,
    getLoginChallengeStatus,
    completeApprovedLogin,
    getActiveDevices,
    logoutDevice,
    logoutOtherDevices,
    updateSessionActivity,
    streamChallengeStatus,
    getActivityLogs,
    getAccountProfile,
    updateAccountProfile,
    requestEmailOtp,
    verifyEmailOtp,
    requestPhoneOtp,
    verifyPhoneOtp,
    changeAccountPassword,
    getNotificationPreferences,
    updateNotificationPreferences,
};