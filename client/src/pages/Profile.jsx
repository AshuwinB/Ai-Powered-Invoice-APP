import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Lock, LogOut, RefreshCw, Shield, Smartphone, UserCircle2, FileClock, Briefcase, DollarSign, Clock, Palette, File, Save, Bell } from 'lucide-react';
import { useSessionContext } from '../context/SessionContext';
import Button from '../components/Button';
import {
    approveLoginRequest,
    changeAccountPassword,
    getAccountProfile,
    getActivityLogs,
    getActiveDevices,
    getPendingLoginApprovals,
    getNotificationPreferences,
    logoutDeviceById,
    logoutOtherDevices,
    rejectLoginRequest,
    reset2fa,
    requestEmailOtp,
    requestPhoneOtp,
    updateAccountProfile,
    updateNotificationPreferences,
    verifyEmailOtp,
    verifyPhoneOtp,
} from '../service/authApi';
import { settingsApi } from '../service/invoiceApi';

const sidebarGroups = [
    {
        id: 'user-settings',
        label: 'User Settings',
        items: [
            { id: 'my-profile', title: 'My Profile', subtitle: 'Identity and contact', icon: UserCircle2 },
            { id: 'security', title: 'Security', subtitle: 'Password and 2FA', icon: Lock },
            { id: 'devices', title: 'Devices', subtitle: 'Session management', icon: Smartphone },
            { id: 'notifications', title: 'Notifications', subtitle: 'Alert preferences', icon: Bell },
            { id: 'logs', title: 'Logs', subtitle: 'Activity timeline', icon: FileClock },
        ],
    },
    {
        id: 'invoice-settings',
        label: 'Invoice Settings',
        items: [
            { id: 'business-info', title: 'Business Info', subtitle: 'Brand and sender details', icon: Briefcase },
            { id: 'currency-tax', title: 'Currency & Tax', subtitle: 'Defaults for invoices', icon: DollarSign },
            { id: 'payment-invoice', title: 'Payment & Invoice', subtitle: 'Terms and numbering', icon: Clock },
            { id: 'pdf-theme', title: 'PDF & Theme', subtitle: 'Template and print layout', icon: File },
        ],
    },
];

const defaultInvoiceSettings = {
    businessInfo: {
        businessName: '',
        email: '',
        phone: '',
        address: '',
        website: '',
        logo: null,
    },
    currency: {
        currency: 'USD',
        symbol: '$',
    },
    tax: {
        defaultTaxRate: 0,
        taxName: 'Tax',
    },
    payment: {
        defaultPaymentDeadlineDays: 30,
        defaultPaymentTerms: 'Due upon receipt',
    },
    invoice: {
        numberFormat: 'INV-{YYYY}{MM}{DD}-{###}',
        notesAndTerms: 'Thank you for your business!',
    },
    theme: {
        template: 'modern',
        primaryColor: '#3B82F6',
        accentColor: '#1E40AF',
    },
    pdf: {
        paperSize: 'A4',
        orientation: 'portrait',
        marginTop: 50,
        marginBottom: 50,
        marginLeft: 50,
        marginRight: 50,
        fontFamily: 'Helvetica',
        fontSize: 12,
        showLogo: true,
        showWatermark: false,
        watermarkText: 'DRAFT',
    },
    signature: {
        name: '',
        image: null,
    },
};

const currencyOptions = [
    { code: 'USD', label: 'US Dollar', symbol: '$' },
    { code: 'EUR', label: 'Euro', symbol: 'EUR' },
    { code: 'GBP', label: 'British Pound', symbol: 'GBP' },
    { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
];

const Profile = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, logoutAllDevices, getTrustedDevices } = useSessionContext();

    const [message, setMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const [profileForm, setProfileForm] = useState({
        displayName: '',
        email: '',
        phone: '',
    });
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [devices, setDevices] = useState([]);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
    const [activeSection, setActiveSection] = useState(() => searchParams.get('section') || 'my-profile');
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [emailDraft, setEmailDraft] = useState('');
    const [phoneDraft, setPhoneDraft] = useState('');
    const [emailOtp, setEmailOtp] = useState('');
    const [phoneOtp, setPhoneOtp] = useState('');
    const [emailVerified, setEmailVerified] = useState(false);
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [phoneOtpSent, setPhoneOtpSent] = useState(false);
    const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
    const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
    const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
    const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);
    const [isMfaActive, setIsMfaActive] = useState(false);
    const [pendingLoginApprovals, setPendingLoginApprovals] = useState([]);
    const [loadingPendingApprovals, setLoadingPendingApprovals] = useState(false);
    const [approvalSelections, setApprovalSelections] = useState({});
    const [processingApprovalId, setProcessingApprovalId] = useState('');
    const [invoiceSettings, setInvoiceSettings] = useState(defaultInvoiceSettings);
    const [loadingInvoiceSettings, setLoadingInvoiceSettings] = useState(false);
    const [savingInvoiceSettings, setSavingInvoiceSettings] = useState(false);
    const [notificationPreferences, setNotificationPreferences] = useState({
        authNotifications: true,
        securityNotifications: true,
        invoiceNotifications: true,
        paymentNotifications: true,
        systemNotifications: true,
    });
    const [loadingNotificationPreferences, setLoadingNotificationPreferences] = useState(false);
    const [savingNotificationPreferences, setSavingNotificationPreferences] = useState(false);

    const currentDevice = useMemo(() => devices.find((device) => device.isCurrent), [devices]);
    const isTrusted = getTrustedDevices(user?.user || user?.username);
    const isCurrentSessionTrusted = currentDevice?.isTrusted ?? isTrusted;

    const setBanner = (nextMessage, nextError = '') => {
        setMessage(nextMessage || '');
        setErrorMessage(nextError || '');
    };

    const loadProfile = async () => {
        try {
            setLoadingProfile(true);
            const profile = await getAccountProfile();
            setProfileForm({
                displayName: profile.displayName || profile.username || '',
                email: profile.email || '',
                phone: profile.phone || '',
            });
            setEmailDraft(profile.email || '');
            setPhoneDraft(profile.phone || '');
            setEmailVerified(Boolean(profile.emailVerified));
            setPhoneVerified(Boolean(profile.phoneVerified));
            setIsMfaActive(Boolean(profile.isMfaActive));
            setEmailOtpSent(false);
            setPhoneOtpSent(false);
            setEmailOtp('');
            setPhoneOtp('');
        } catch (error) {
            console.error('Failed loading account profile:', error);
            setBanner('', 'Failed to load your profile details.');
        } finally {
            setLoadingProfile(false);
        }
    };

    const loadDevices = async () => {
        try {
            setLoadingDevices(true);
            const active = await getActiveDevices();
            setDevices(active || []);
        } catch (error) {
            console.error('Failed loading devices:', error);
            setBanner('', 'Failed to load active devices.');
        } finally {
            setLoadingDevices(false);
        }
    };

    const loadPendingApprovals = async () => {
        try {
            setLoadingPendingApprovals(true);
            const pending = await getPendingLoginApprovals();
            setPendingLoginApprovals(Array.isArray(pending) ? pending : []);
        } catch (error) {
            console.error('Failed loading pending login approvals:', error);
            setPendingLoginApprovals([]);
        } finally {
            setLoadingPendingApprovals(false);
        }
    };

    const loadInvoiceSettings = async () => {
        try {
            setLoadingInvoiceSettings(true);
            const response = await settingsApi.getSettings();
            setInvoiceSettings((prev) => ({
                ...prev,
                ...(response?.data || {}),
            }));
        } catch (error) {
            console.error('Failed loading invoice settings:', error);
            setBanner('', 'Failed to load invoice settings.');
        } finally {
            setLoadingInvoiceSettings(false);
        }
    };

    const loadLogs = async () => {
        try {
            setLoadingLogs(true);
            const data = await getActivityLogs(300);
            setLogs(data || []);
        } catch (error) {
            console.error('Failed loading logs:', error);
            setLogs([]);
            setBanner('', 'Failed to load activity logs.');
        } finally {
            setLoadingLogs(false);
        }
    };

    const loadNotificationPreferences = async () => {
        try {
            setLoadingNotificationPreferences(true);
            const data = await getNotificationPreferences();
            setNotificationPreferences(data.notificationPreferences || {
                authNotifications: true,
                securityNotifications: true,
                invoiceNotifications: true,
                paymentNotifications: true,
                systemNotifications: true,
            });
        } catch (error) {
            console.error('Failed loading notification preferences:', error);
            setBanner('', 'Failed to load notification preferences.');
        } finally {
            setLoadingNotificationPreferences(false);
        }
    };

    const handleSaveNotificationPreferences = async () => {
        try {
            setSavingNotificationPreferences(true);
            await updateNotificationPreferences(notificationPreferences);
            setBanner('Notification preferences updated successfully.');
        } catch (error) {
            console.error('Failed saving notification preferences:', error);
            setBanner('', 'Failed to save notification preferences.');
        } finally {
            setSavingNotificationPreferences(false);
        }
    };

    useEffect(() => {
        loadProfile();
        loadDevices();
        loadPendingApprovals();
        loadInvoiceSettings();
        loadNotificationPreferences();
    }, []);

    useEffect(() => {
        if (activeSection === 'logs' && logs.length === 0 && !loadingLogs) {
            loadLogs();
        }
        if (activeSection === 'devices') {
            loadPendingApprovals();
        }
    }, [activeSection]);

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setBanner('');

        if (emailDraft.trim().toLowerCase() !== (profileForm.email || '').toLowerCase()) {
            setBanner('', 'Verify your new email with OTP before saving profile.');
            return;
        }

        if (phoneDraft.trim() !== (profileForm.phone || '')) {
            setBanner('', 'Verify your new phone with OTP before saving profile.');
            return;
        }

        try {
            setSavingProfile(true);
            await updateAccountProfile({
                displayName: profileForm.displayName,
                email: profileForm.email,
                phone: profileForm.phone,
            });
            setBanner('Profile updated successfully.');
            await loadProfile();
        } catch (error) {
            setBanner('', error?.response?.data?.message || 'Unable to update profile.');
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordSave = async (e) => {
        e.preventDefault();
        setBanner('');

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setBanner('', 'New password and confirm password do not match.');
            return;
        }

        try {
            setSavingPassword(true);
            await changeAccountPassword(passwordForm.currentPassword, passwordForm.newPassword);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setBanner('Password updated successfully.');
        } catch (error) {
            setBanner('', error?.response?.data?.message || 'Unable to update password.');
        } finally {
            setSavingPassword(false);
        }
    };

    const handleRequestEmailOtp = async () => {
        const nextEmail = emailDraft.trim().toLowerCase();
        if (!nextEmail) {
            setBanner('', 'Please enter an email first.');
            return;
        }

        try {
            setSendingEmailOtp(true);
            await requestEmailOtp(nextEmail);
            setEmailOtpSent(true);
            setBanner('Email OTP sent. Please verify to continue.');
        } catch (error) {
            setBanner('', error?.response?.data?.message || 'Failed to send email OTP.');
        } finally {
            setSendingEmailOtp(false);
        }
    };

    const handleVerifyEmailOtp = async () => {
        const nextEmail = emailDraft.trim().toLowerCase();
        if (!/^\d{6}$/.test(emailOtp)) {
            setBanner('', 'Enter a valid 6-digit email OTP.');
            return;
        }

        try {
            setVerifyingEmailOtp(true);
            await verifyEmailOtp(nextEmail, emailOtp);
            setProfileForm((prev) => ({ ...prev, email: nextEmail }));
            setEmailVerified(true);
            setEmailOtpSent(false);
            setEmailOtp('');
            setBanner('Email verified successfully.');
        } catch (error) {
            setBanner('', error?.response?.data?.message || 'Failed to verify email OTP.');
        } finally {
            setVerifyingEmailOtp(false);
        }
    };

    const handleRequestPhoneOtp = async () => {
        const nextPhone = phoneDraft.trim();
        if (!nextPhone) {
            setBanner('', 'Please enter a phone number first.');
            return;
        }

        try {
            setSendingPhoneOtp(true);
            const response = await requestPhoneOtp(nextPhone);
            setPhoneOtpSent(true);
            const devNote = response?.devOtp ? ` Dev OTP: ${response.devOtp}` : '';
            setBanner(`Phone OTP sent.${devNote}`);
        } catch (error) {
            setBanner('', error?.response?.data?.message || 'Failed to send phone OTP.');
        } finally {
            setSendingPhoneOtp(false);
        }
    };

    const handleVerifyPhoneOtp = async () => {
        const nextPhone = phoneDraft.trim();
        if (!/^\d{6}$/.test(phoneOtp)) {
            setBanner('', 'Enter a valid 6-digit phone OTP.');
            return;
        }

        try {
            setVerifyingPhoneOtp(true);
            await verifyPhoneOtp(nextPhone, phoneOtp);
            setProfileForm((prev) => ({ ...prev, phone: nextPhone }));
            setPhoneVerified(true);
            setPhoneOtpSent(false);
            setPhoneOtp('');
            setBanner('Phone verified successfully.');
        } catch (error) {
            setBanner('', error?.response?.data?.message || 'Failed to verify phone OTP.');
        } finally {
            setVerifyingPhoneOtp(false);
        }
    };

    const handleLogoutSingleDevice = async (id) => {
        try {
            await logoutDeviceById(id);
            setBanner('Device logged out successfully.');
            await loadDevices();
        } catch (error) {
            setBanner('', 'Failed to logout selected device.');
        }
    };

    const handleLogoutAllDevices = async () => {
        try {
            await logoutOtherDevices();
            logoutAllDevices(user?.user || user?.username);
            setBanner('Logged out from other devices.');
            setConfirmLogoutAll(false);
            await loadDevices();
        } catch (error) {
            setBanner('', 'Failed to logout other devices.');
        }
    };

    const handleDisable2fa = async () => {
        const confirmed = window.confirm('Disable 2FA for this account? This reduces account security.');
        if (!confirmed) {
            return;
        }

        try {
            await reset2fa();
            setIsMfaActive(false);
            setBanner('2FA disabled successfully.');
            await loadProfile();
        } catch (error) {
            setBanner('', error?.response?.data?.message || 'Unable to disable 2FA right now.');
        }
    };

    const handleApprovePendingLogin = async (approval) => {
        const selectedCode = approvalSelections[approval.challengeId];
        if (!selectedCode) {
            setBanner('', 'Select a security code before approving this login request.');
            return;
        }

        try {
            setProcessingApprovalId(approval.challengeId);
            await approveLoginRequest(approval.challengeId, selectedCode);
            setBanner('Login request approved successfully.');
            setPendingLoginApprovals((prev) => prev.filter((item) => item.challengeId !== approval.challengeId));
            setApprovalSelections((prev) => {
                const next = { ...prev };
                delete next[approval.challengeId];
                return next;
            });
        } catch (error) {
            setBanner('', error?.response?.data?.message || 'Unable to approve login request.');
        } finally {
            setProcessingApprovalId('');
        }
    };

    const handleRejectPendingLogin = async (approval) => {
        try {
            setProcessingApprovalId(approval.challengeId);
            await rejectLoginRequest(approval.challengeId);
            setBanner('Login request rejected.');
            setPendingLoginApprovals((prev) => prev.filter((item) => item.challengeId !== approval.challengeId));
            setApprovalSelections((prev) => {
                const next = { ...prev };
                delete next[approval.challengeId];
                return next;
            });
        } catch (error) {
            setBanner('', error?.response?.data?.message || 'Unable to reject login request.');
        } finally {
            setProcessingApprovalId('');
        }
    };

    const handleInvoiceSettingChange = (section, field, value) => {
        setInvoiceSettings((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            },
        }));
    };

    const handleInvoiceImageUpload = (section, field, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            handleInvoiceSettingChange(section, field, reader.result);
        };
        reader.readAsDataURL(file);
    };

    const getBusinessAddressLines = () => {
        const address = String(invoiceSettings.businessInfo.address || '');
        const lines = address.split('\n');
        return [lines[0] || '', lines[1] || '', lines[2] || ''];
    };

    const handleBusinessAddressLineChange = (lineIndex, value) => {
        const nextLines = getBusinessAddressLines();
        nextLines[lineIndex] = value;
        while (nextLines.length > 0 && nextLines[nextLines.length - 1] === '') {
            nextLines.pop();
        }
        handleInvoiceSettingChange('businessInfo', 'address', nextLines.join('\n'));
    };

    const handleSaveInvoiceSettings = async () => {
        try {
            setSavingInvoiceSettings(true);
            await settingsApi.updateSettings(invoiceSettings);
            setBanner('Invoice settings saved successfully.');
        } catch (error) {
            console.error('Failed saving invoice settings:', error);
            setBanner('', 'Failed to save invoice settings.');
        } finally {
            setSavingInvoiceSettings(false);
        }
    };

    const jumpToSection = (id) => {
        setActiveSection(id);
    };

    const importantLogs = useMemo(() => {
        const importantActions = new Set([
            'ACCOUNT_LOGIN',
            'ACCOUNT_LOGOUT',
            'ACCOUNT_PASSWORD_CHANGED',
            'ACCOUNT_2FA_ENABLED',
            'ACCOUNT_DEVICE_REMOVED',
            'ACCOUNT_LOGOUT_OTHER_DEVICES',
            'INVOICE_CREATED',
            'INVOICE_DELETED',
            'INVOICE_DOWNLOADED',
            'INVOICE_UPDATED',
            'INVOICE_EMAIL_SENT',
            'INVOICE_DUPLICATED',
            'PAYMENT_COMPLETED',
            'INVOICE_REFUND_APPROVED',
        ]);

        return logs.filter((log) => {
            const action = String(log.action || '');
            return importantActions.has(action);
        });
    }, [logs]);

    const passwordStrength = useMemo(() => {
        const len = passwordForm.newPassword.length;
        if (!len) return { label: 'Not set', tone: 'bg-gray-200 text-gray-700' };
        if (len < 6) return { label: 'Weak', tone: 'bg-red-100 text-red-700' };
        if (len < 10) return { label: 'Medium', tone: 'bg-amber-100 text-amber-700' };
        return { label: 'Strong', tone: 'bg-emerald-100 text-emerald-700' };
    }, [passwordForm.newPassword]);

    const formatLogAction = (action) => {
        const value = String(action || '').trim();
        if (value === 'INVOICE_REFUND_APPROVED') {
            return 'Refund approved';
        }
        return value;
    };

    return (
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-10 py-8 page-enter">
            <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">User Settings</p>
                <h1 className="text-3xl font-bold text-slate-900">Profile Overview</h1>
                <p className="text-slate-600">A central place to manage account identity, security, devices, logs, and invoice settings.</p>
            </div>

            {message && (
                <div className="mb-4 p-3 border rounded-lg bg-emerald-50 border-emerald-200 text-emerald-800">
                    {message}
                </div>
            )}
            {errorMessage && (
                <div className="mb-4 p-3 border rounded-lg bg-red-50 border-red-200 text-red-800">
                    {errorMessage}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-7">
                <aside className="lg:sticky lg:top-24 self-start">
                    <div className="border-l-2 border-slate-200 pl-4">
                        <h3 className="text-base font-semibold text-slate-900">Profile Sidebar</h3>
                        <p className="text-xs text-slate-500 mb-3">Settings navigation</p>
                        <div className="space-y-4">
                            {sidebarGroups.map((group) => (
                                <div key={group.id}>
                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
                                    <div className="space-y-2">
                                        {group.items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = activeSection === item.id;

                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => jumpToSection(item.id)}
                                                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition ${isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-100'}`}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <Icon className={`h-4 w-4 ${isActive ? 'text-teal-700' : 'text-slate-500'}`} />
                                                        <span>
                                                            <span className="block text-sm font-semibold">{item.title}</span>
                                                            <span className="block text-[11px] opacity-80">{item.subtitle}</span>
                                                        </span>
                                                    </span>
                                                    <ChevronRight className={`h-4 w-4 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                <div id="profile-content" className="space-y-6 min-h-[700px]">
            <section id="my-profile" className={`${activeSection === 'my-profile' ? 'block animate-[pageEnter_.25s_ease-out]' : 'hidden'} border-b border-slate-200 pb-8`}>
                <div className="flex items-center gap-2">
                    <UserCircle2 className="h-5 w-5 text-slate-700" />
                    <h2 className="text-xl font-semibold text-slate-900">My Profile</h2>
                </div>
                <p className="text-sm text-slate-600 mt-1 mb-6">Manage display name and verify your email and phone before saving.</p>
                <div className="space-y-6">
                    <form onSubmit={handleProfileSave} className="space-y-6">
                        <div className="bg-teal-50 px-6 py-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-teal-700">Account Identity</p>
                                    <p className="text-2xl font-semibold text-slate-900">{profileForm.displayName || user?.username || user?.user || 'User'}</p>
                                    <p className="text-sm text-slate-600">{user?.username || user?.user || 'username'}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${emailVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {emailVerified ? 'Email Verified' : 'Email Not Verified'}
                                    </span>
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${phoneVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {phoneVerified ? 'Phone Verified' : 'Phone Not Verified'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="p-6 bg-slate-50 min-h-[230px]">
                                <p className="text-sm font-semibold text-slate-900">Email Verification</p>
                                <p className="text-xs text-slate-500 mt-1">Verify email to secure notifications and account recovery.</p>
                                <label className="text-sm font-medium text-gray-700 mt-3 block">Email</label>
                                <div className="mt-1 flex gap-2">
                                    <input
                                        type="email"
                                        value={emailDraft}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setEmailDraft(next);
                                            setEmailVerified(next.trim().toLowerCase() === (profileForm.email || '').toLowerCase() && Boolean(profileForm.email));
                                        }}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                                        disabled={loadingProfile}
                                    />
                                    <Button type="button" variant="outline" onClick={handleRequestEmailOtp} disabled={sendingEmailOtp || loadingProfile}>
                                        {sendingEmailOtp ? 'Sending...' : 'Send OTP'}
                                    </Button>
                                </div>
                                {emailOtpSent && (
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            type="text"
                                            maxLength={6}
                                            placeholder="Enter 6-digit OTP"
                                            value={emailOtp}
                                            onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="w-full rounded-md border border-gray-300 px-3 py-2"
                                        />
                                        <Button type="button" onClick={handleVerifyEmailOtp} disabled={verifyingEmailOtp}>
                                            {verifyingEmailOtp ? 'Verifying...' : 'Verify'}
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-slate-50 min-h-[230px]">
                                <p className="text-sm font-semibold text-slate-900">Phone Number Verification</p>
                                <p className="text-xs text-slate-500 mt-1">Verify phone number for secure login events and alerts.</p>
                                <label className="text-sm font-medium text-gray-700 mt-3 block">Phone Number</label>
                                <div className="mt-1 flex gap-2">
                                    <input
                                        type="tel"
                                        value={phoneDraft}
                                        onChange={(e) => {
                                            const next = e.target.value;
                                            setPhoneDraft(next);
                                            setPhoneVerified(next.trim() === (profileForm.phone || '') && Boolean(profileForm.phone));
                                        }}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                                        disabled={loadingProfile}
                                        placeholder="+91XXXXXXXXXX"
                                    />
                                    <Button type="button" variant="outline" onClick={handleRequestPhoneOtp} disabled={sendingPhoneOtp || loadingProfile}>
                                        {sendingPhoneOtp ? 'Sending...' : 'Send OTP'}
                                    </Button>
                                </div>
                                {phoneOtpSent && (
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            type="text"
                                            maxLength={6}
                                            placeholder="Enter 6-digit OTP"
                                            value={phoneOtp}
                                            onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="w-full rounded-md border border-gray-300 px-3 py-2"
                                        />
                                        <Button type="button" onClick={handleVerifyPhoneOtp} disabled={verifyingPhoneOtp}>
                                            {verifyingPhoneOtp ? 'Verifying...' : 'Verify'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                            <div>
                                <label className="text-sm font-medium text-gray-700">Display Name</label>
                                <input
                                    type="text"
                                    value={profileForm.displayName}
                                    onChange={(e) => setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))}
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3"
                                    disabled={loadingProfile}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700">Username</label>
                                <input
                                    type="text"
                                    value={user?.username || user?.user || ''}
                                    className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-500"
                                    disabled
                                />
                            </div>
                        </div>

                        <Button type="submit" disabled={savingProfile || loadingProfile}>
                            {savingProfile ? 'Saving...' : 'Save Profile'}
                        </Button>
                    </form>
                </div>
            </section>

            <section id="security" className={`${activeSection === 'security' ? 'block animate-[pageEnter_.25s_ease-out]' : 'hidden'} border-b border-slate-200 pb-8`}>
                <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-slate-700" />
                    <h2 className="text-xl font-semibold text-slate-900">Security</h2>
                </div>
                <p className="text-sm text-slate-600 mt-1 mb-6">Strengthen account access with password updates and 2FA controls.</p>
                <div>
                    <form onSubmit={handlePasswordSave} className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-6">
                        <div className="p-6 bg-slate-50 space-y-5">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600">Password Strength:</span>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${passwordStrength.tone}`}>
                                    {passwordStrength.label}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <input
                                    type="password"
                                    placeholder="Current Password"
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                                />
                                <input
                                    type="password"
                                    placeholder="New Password"
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm New Password"
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-3"
                                />
                            </div>

                            <Button type="submit" disabled={savingPassword}>
                                {savingPassword ? 'Updating...' : 'Update Password'}
                            </Button>
                        </div>

                        <div className="bg-teal-50 p-6 space-y-4">
                            <h4 className="text-sm font-semibold text-slate-900">Two-Factor Authentication</h4>
                            <p className="text-sm text-slate-600">Use app-based 2FA to protect account access from unknown devices.</p>
                            <Button type="button" variant="outline" onClick={handleDisable2fa} disabled={!isMfaActive}>
                                <Shield className="h-4 w-4 mr-2" />
                                Disable 2FA
                            </Button>
                            <Button type="button" variant="outline" onClick={() => navigate('/setup-2fa?from=profile')}>
                                <Shield className="h-4 w-4 mr-2" />
                                {isMfaActive ? 'Reconfigure 2FA' : 'Enable 2FA'}
                            </Button>
                            <div className="text-xs text-slate-500">Current status: {isMfaActive ? 'Enabled' : 'Disabled'}</div>
                        </div>
                    </form>
                </div>
            </section>

            <section id="devices" className={`${activeSection === 'devices' ? 'block animate-[pageEnter_.25s_ease-out]' : 'hidden'} border-b border-slate-200 pb-8`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5 text-slate-700" />
                        <h2 className="text-xl font-semibold text-slate-900">Devices</h2>
                    </div>
                    <Button variant="outline" onClick={loadDevices}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
                <div className="space-y-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold text-amber-900">New Login Requests</p>
                                <p className="text-xs text-amber-800">Approve sign-in attempts from trusted devices here.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={loadPendingApprovals} disabled={loadingPendingApprovals || Boolean(processingApprovalId)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh requests
                            </Button>
                        </div>

                        {loadingPendingApprovals ? (
                            <p className="mt-3 text-sm text-amber-900">Loading login requests...</p>
                        ) : pendingLoginApprovals.length === 0 ? (
                            <p className="mt-3 text-sm text-amber-900">No pending login requests.</p>
                        ) : (
                            <div className="mt-3 space-y-3">
                                {pendingLoginApprovals.map((approval) => (
                                    <div key={approval.challengeId} className="rounded-lg border border-amber-200 bg-white p-3">
                                        <p className="text-sm font-semibold text-slate-900">{approval.requestingUserAgent || 'Unknown device'}</p>
                                        <p className="text-xs text-slate-600 mt-1">IP: {approval.requestingIp || 'Unknown'}</p>
                                        <p className="text-xs text-slate-600">Requested at: {new Date(approval.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                                        <div className="mt-2 flex flex-wrap items-end gap-2">
                                            <div>
                                                <label className="mb-1 block text-xs font-medium text-slate-700">Select security code</label>
                                                <select
                                                    value={approvalSelections[approval.challengeId] || ''}
                                                    onChange={(event) => setApprovalSelections((prev) => ({
                                                        ...prev,
                                                        [approval.challengeId]: event.target.value,
                                                    }))}
                                                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
                                                    disabled={Boolean(processingApprovalId)}
                                                >
                                                    <option value="">Choose code</option>
                                                    {(approval.codeOptions || []).map((code) => (
                                                        <option key={code} value={code}>{code}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => handleApprovePendingLogin(approval)}
                                                disabled={processingApprovalId === approval.challengeId || !approvalSelections[approval.challengeId]}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleRejectPendingLogin(approval)}
                                                disabled={processingApprovalId === approval.challengeId}
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {loadingDevices ? (
                        <p className="text-sm text-gray-500">Loading devices...</p>
                    ) : devices.length === 0 ? (
                        <p className="text-sm text-gray-500">No active devices found.</p>
                    ) : (
                        devices.map((device) => (
                            <div key={device.id} className="p-4 flex items-start justify-between gap-3 bg-slate-50/70">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{device.isCurrent ? 'Current Device' : 'Other Device'}</p>
                                    <p className="text-xs text-gray-600 mt-1 break-all">{device.userAgent || device.deviceId}</p>
                                    <p className="text-xs text-gray-600">IP: {device.ipAddress || 'Unknown'}</p>
                                    <p className="text-xs text-gray-600">Last active: {new Date(device.lastActiveAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                                    <p className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${device.isTrusted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {device.isTrusted ? 'Trusted Device' : 'Untrusted Device'}
                                    </p>
                                </div>
                                {!device.isCurrent && (isCurrentSessionTrusted || !device.isTrusted) && (
                                    <Button variant="outline" onClick={() => handleLogoutSingleDevice(device.id)}>
                                        Logout
                                    </Button>
                                )}
                            </div>
                        ))
                    )}

                    <Button variant="destructive" onClick={() => setConfirmLogoutAll(true)} className="w-full">
                        <LogOut className="h-4 w-4 mr-2" />
                        {isCurrentSessionTrusted ? 'Logout From All Devices' : 'Logout Untrusted Devices'}
                    </Button>

                    {confirmLogoutAll && (
                        <div className="p-4 bg-red-50 border border-red-200 space-y-3">
                            <p className="text-sm text-red-800">
                                {isCurrentSessionTrusted
                                    ? 'This will log out all other devices.'
                                    : 'This will log out other untrusted devices only.'}
                            </p>
                            <div className="flex gap-2">
                                <Button variant="destructive" onClick={handleLogoutAllDevices}>Confirm</Button>
                                <Button variant="outline" onClick={() => setConfirmLogoutAll(false)}>Cancel</Button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <section id="business-info" className={`${activeSection === 'business-info' ? 'block animate-[pageEnter_.25s_ease-out]' : 'hidden'} border-b border-slate-200 pb-8`}>
                <div className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-slate-700" />
                    <h2 className="text-xl font-semibold text-slate-900">Business Info</h2>
                </div>
                <p className="text-sm text-slate-600 mt-1 mb-6">Business identity used for invoice sender details.</p>

                {loadingInvoiceSettings ? (
                    <p className="text-sm text-slate-500">Loading invoice settings...</p>
                ) : (
                    <div className="space-y-4 bg-slate-50 p-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                            <input
                                value={invoiceSettings.businessInfo.businessName}
                                onChange={(e) => handleInvoiceSettingChange('businessInfo', 'businessName', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    value={invoiceSettings.businessInfo.email}
                                    onChange={(e) => handleInvoiceSettingChange('businessInfo', 'email', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input
                                    value={invoiceSettings.businessInfo.phone}
                                    onChange={(e) => handleInvoiceSettingChange('businessInfo', 'phone', e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                            <div className="space-y-2">
                                <input
                                    placeholder="Address Line 1"
                                    value={getBusinessAddressLines()[0]}
                                    onChange={(e) => handleBusinessAddressLineChange(0, e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                                <input
                                    placeholder="Address Line 2"
                                    value={getBusinessAddressLines()[1]}
                                    onChange={(e) => handleBusinessAddressLineChange(1, e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                                <input
                                    placeholder="Address Line 3"
                                    value={getBusinessAddressLines()[2]}
                                    onChange={(e) => handleBusinessAddressLineChange(2, e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                            <input
                                value={invoiceSettings.businessInfo.website}
                                onChange={(e) => handleInvoiceSettingChange('businessInfo', 'website', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                        </div>
                        <div className="md:ml-6 md:pl-4 border-l border-slate-200">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Business Logo</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleInvoiceImageUpload('businessInfo', 'logo', e.target.files?.[0])}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                            {invoiceSettings.businessInfo.logo && (
                                <img
                                    src={invoiceSettings.businessInfo.logo}
                                    alt="Business logo preview"
                                    className="mt-2 h-14 w-auto rounded border border-slate-200 bg-white"
                                />
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Signature Image</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleInvoiceImageUpload('signature', 'image', e.target.files?.[0])}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                            {invoiceSettings.signature.image && (
                                <img
                                    src={invoiceSettings.signature.image}
                                    alt="Signature preview"
                                    className="mt-2 h-14 w-auto rounded border border-slate-200 bg-white"
                                />
                            )}
                        </div>

                        <div className="flex justify-end border-t border-slate-200 pt-4">
                            <Button onClick={handleSaveInvoiceSettings} disabled={savingInvoiceSettings}>
                                <Save className="h-4 w-4 mr-2" />
                                {savingInvoiceSettings ? 'Saving...' : 'Save Settings'}
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            <section id="currency-tax" className={`${activeSection === 'currency-tax' ? 'block animate-[pageEnter_.25s_ease-out]' : 'hidden'} border-b border-slate-200 pb-8`}>
                <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-slate-700" />
                    <h2 className="text-xl font-semibold text-slate-900">Currency & Tax</h2>
                </div>
                <p className="text-sm text-slate-600 mt-1 mb-6">Set monetary defaults and tax behavior.</p>

                <div className="space-y-4 bg-slate-50 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                            <select
                                value={invoiceSettings.currency.currency}
                                onChange={(e) => {
                                    const selectedCode = e.target.value;
                                    const selectedCurrency = currencyOptions.find((item) => item.code === selectedCode);
                                    handleInvoiceSettingChange('currency', 'currency', selectedCode);
                                    if (selectedCurrency) {
                                        handleInvoiceSettingChange('currency', 'symbol', selectedCurrency.symbol);
                                    }
                                }}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            >
                                {currencyOptions.map((currency) => (
                                    <option key={currency.code} value={currency.code}>
                                        {currency.code} - {currency.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
                            <input
                                value={invoiceSettings.currency.symbol}
                                onChange={(e) => handleInvoiceSettingChange('currency', 'symbol', e.target.value)}
                                maxLength={6}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                            <p className="mt-1 text-xs text-slate-500">Auto-updates when you change currency. You can still override manually.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Default Tax Rate (%)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={invoiceSettings.tax.defaultTaxRate}
                                onChange={(e) => {
                                    const next = Math.min(100, Math.max(0, parseFloat(e.target.value || 0)));
                                    handleInvoiceSettingChange('tax', 'defaultTaxRate', Number.isNaN(next) ? 0 : next);
                                }}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                            <p className="mt-1 text-xs text-slate-500">Use 0 to disable default tax on new invoices.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tax Name</label>
                            <input
                                value={invoiceSettings.tax.taxName}
                                onChange={(e) => handleInvoiceSettingChange('tax', 'taxName', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                                {['Tax', 'GST', 'VAT', 'Sales Tax'].map((taxLabel) => (
                                    <button
                                        key={taxLabel}
                                        type="button"
                                        onClick={() => handleInvoiceSettingChange('tax', 'taxName', taxLabel)}
                                        className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                        {taxLabel}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end border-t border-slate-200 pt-4">
                        <Button onClick={handleSaveInvoiceSettings} disabled={savingInvoiceSettings}>
                            <Save className="h-4 w-4 mr-2" />
                            {savingInvoiceSettings ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
                </div>
            </section>

            <section id="payment-invoice" className={`${activeSection === 'payment-invoice' ? 'block animate-[pageEnter_.25s_ease-out]' : 'hidden'} border-b border-slate-200 pb-8`}>
                <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-slate-700" />
                    <h2 className="text-xl font-semibold text-slate-900">Payment & Invoice</h2>
                </div>
                <p className="text-sm text-slate-600 mt-1 mb-6">Configure deadlines, terms, and invoice defaults.</p>

                <div className="space-y-4 bg-slate-50 p-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Deadline (Days)</label>
                        <input
                            type="number"
                            min="1"
                            value={invoiceSettings.payment.defaultPaymentDeadlineDays}
                            onChange={(e) => handleInvoiceSettingChange('payment', 'defaultPaymentDeadlineDays', parseInt(e.target.value || '30', 10))}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms</label>
                        <textarea
                            value={invoiceSettings.payment.defaultPaymentTerms}
                            onChange={(e) => handleInvoiceSettingChange('payment', 'defaultPaymentTerms', e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number Format</label>
                        <input
                            value={invoiceSettings.invoice.numberFormat}
                            onChange={(e) => handleInvoiceSettingChange('invoice', 'numberFormat', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                        <p className="mt-1 text-xs text-slate-500">{'{YYYY}'} year, {'{MM}'} month, {'{DD}'} day, {'{###}'} sequence.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Default Notes & Terms</label>
                        <textarea
                            value={invoiceSettings.invoice.notesAndTerms}
                            onChange={(e) => handleInvoiceSettingChange('invoice', 'notesAndTerms', e.target.value)}
                            rows={4}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                    </div>

                    <div className="flex justify-end border-t border-slate-200 pt-4">
                        <Button onClick={handleSaveInvoiceSettings} disabled={savingInvoiceSettings}>
                            <Save className="h-4 w-4 mr-2" />
                            {savingInvoiceSettings ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
                </div>
            </section>

            <section id="pdf-theme" className={`${activeSection === 'pdf-theme' ? 'block animate-[pageEnter_.25s_ease-out]' : 'hidden'} border-b border-slate-200 pb-8`}>
                <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-slate-700" />
                    <h2 className="text-xl font-semibold text-slate-900">PDF & Theme</h2>
                </div>
                <p className="text-sm text-slate-600 mt-1 mb-6">Customize template, colors, paper setup, and PDF output.</p>

                <div className="space-y-4 bg-slate-50 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                            <select
                                value={invoiceSettings.theme.template}
                                onChange={(e) => handleInvoiceSettingChange('theme', 'template', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            >
                                <option value="modern">Modern</option>
                                <option value="classic">Classic</option>
                                <option value="minimal">Minimal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Paper Size</label>
                            <select
                                value={invoiceSettings.pdf.paperSize}
                                onChange={(e) => handleInvoiceSettingChange('pdf', 'paperSize', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            >
                                <option value="A4">A4</option>
                                <option value="Letter">Letter</option>
                                <option value="Legal">Legal</option>
                                <option value="A3">A3</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                            <input
                                type="color"
                                value={invoiceSettings.theme.primaryColor}
                                onChange={(e) => handleInvoiceSettingChange('theme', 'primaryColor', e.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-300"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
                            <input
                                type="color"
                                value={invoiceSettings.theme.accentColor}
                                onChange={(e) => handleInvoiceSettingChange('theme', 'accentColor', e.target.value)}
                                className="h-10 w-full rounded-lg border border-gray-300"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Top Margin</label>
                            <input type="number" value={invoiceSettings.pdf.marginTop} onChange={(e) => handleInvoiceSettingChange('pdf', 'marginTop', parseInt(e.target.value || '50', 10))} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Bottom Margin</label>
                            <input type="number" value={invoiceSettings.pdf.marginBottom} onChange={(e) => handleInvoiceSettingChange('pdf', 'marginBottom', parseInt(e.target.value || '50', 10))} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Left Margin</label>
                            <input type="number" value={invoiceSettings.pdf.marginLeft} onChange={(e) => handleInvoiceSettingChange('pdf', 'marginLeft', parseInt(e.target.value || '50', 10))} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Right Margin</label>
                            <input type="number" value={invoiceSettings.pdf.marginRight} onChange={(e) => handleInvoiceSettingChange('pdf', 'marginRight', parseInt(e.target.value || '50', 10))} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                checked={Boolean(invoiceSettings.pdf.showLogo)}
                                onChange={(e) => handleInvoiceSettingChange('pdf', 'showLogo', e.target.checked)}
                            />
                            Show logo in PDF
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                            <input
                                type="checkbox"
                                checked={Boolean(invoiceSettings.pdf.showWatermark)}
                                onChange={(e) => handleInvoiceSettingChange('pdf', 'showWatermark', e.target.checked)}
                            />
                            Show watermark
                        </label>
                    </div>
                    {invoiceSettings.pdf.showWatermark && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Watermark Text</label>
                            <input
                                value={invoiceSettings.pdf.watermarkText}
                                onChange={(e) => handleInvoiceSettingChange('pdf', 'watermarkText', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                        </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                        <Button onClick={handleSaveInvoiceSettings} disabled={savingInvoiceSettings}>
                            <Save className="h-4 w-4 mr-2" />
                            {savingInvoiceSettings ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
                </div>
            </section>

            <section id="notifications" className={`${activeSection === 'notifications' ? 'block animate-[pageEnter_.25s_ease-out]' : 'hidden'} border-b border-slate-200 pb-8`}>
                <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-slate-700" />
                    <h2 className="text-xl font-semibold text-slate-900">Notifications</h2>
                </div>
                <p className="text-sm text-slate-600 mt-1 mb-6">Manage which types of notifications you'd like to receive.</p>
                
                {loadingNotificationPreferences ? (
                    <p className="text-slate-500 py-6 text-center">Loading preferences...</p>
                ) : (
                    <div className="space-y-4 max-w-2xl">
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notificationPreferences.authNotifications}
                                    onChange={(e) => setNotificationPreferences(prev => ({ ...prev, authNotifications: e.target.checked }))}
                                    disabled={savingNotificationPreferences}
                                    className="w-5 h-5"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-900">Authentication Notifications</p>
                                    <p className="text-xs text-slate-600">Account login and registration events</p>
                                </div>
                            </label>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notificationPreferences.securityNotifications}
                                    onChange={(e) => setNotificationPreferences(prev => ({ ...prev, securityNotifications: e.target.checked }))}
                                    disabled={savingNotificationPreferences}
                                    className="w-5 h-5"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-900">Security Notifications</p>
                                    <p className="text-xs text-slate-600">2FA changes, login approvals, password changes</p>
                                </div>
                            </label>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notificationPreferences.invoiceNotifications}
                                    onChange={(e) => setNotificationPreferences(prev => ({ ...prev, invoiceNotifications: e.target.checked }))}
                                    disabled={savingNotificationPreferences}
                                    className="w-5 h-5"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-900">Invoice Notifications</p>
                                    <p className="text-xs text-slate-600">Invoice created, updated, deleted, or sent</p>
                                </div>
                            </label>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notificationPreferences.paymentNotifications}
                                    onChange={(e) => setNotificationPreferences(prev => ({ ...prev, paymentNotifications: e.target.checked }))}
                                    disabled={savingNotificationPreferences}
                                    className="w-5 h-5"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-900">Payment Notifications</p>
                                    <p className="text-xs text-slate-600">Invoice payments received and status changes</p>
                                </div>
                            </label>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={notificationPreferences.systemNotifications}
                                    onChange={(e) => setNotificationPreferences(prev => ({ ...prev, systemNotifications: e.target.checked }))}
                                    disabled={savingNotificationPreferences}
                                    className="w-5 h-5"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-900">System Notifications</p>
                                    <p className="text-xs text-slate-600">Profile updates and other account changes</p>
                                </div>
                            </label>
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                            <Button onClick={handleSaveNotificationPreferences} disabled={savingNotificationPreferences}>
                                {savingNotificationPreferences ? 'Saving...' : 'Save Preferences'}
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            <section id="logs" className={`${activeSection === 'logs' ? 'block animate-[pageEnter_.25s_ease-out]' : 'hidden'} pb-8`}>
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <FileClock className="h-5 w-5 text-slate-700" />
                        <h2 className="text-xl font-semibold text-slate-900">Logs</h2>
                    </div>
                    <Button variant="outline" onClick={loadLogs}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
                <p className="text-sm text-slate-600 mt-1 mb-6">Security, auth, invoice, and payment activity timeline with timestamps and metadata.</p>

                {loadingLogs ? (
                    <p className="text-slate-500 py-6 text-center">Loading logs...</p>
                ) : importantLogs.length === 0 ? (
                    <p className="text-slate-500 py-6 text-center">No matching activity logs found yet.</p>
                ) : (
                    <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
                        {importantLogs.map((log) => (
                            <div key={log._id} className="rounded-lg border border-slate-200 bg-white p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-semibold text-slate-900">{formatLogAction(log.action)}</p>
                                    <span className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                                </div>
                                <p className="text-sm text-slate-700 mt-1">{log.details || 'No additional details.'}</p>
                                <p className="text-xs text-slate-500 mt-2">IP: {log.ipAddress || 'N/A'}</p>
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                    <details className="mt-2">
                                        <summary className="text-xs cursor-pointer text-teal-700">View metadata</summary>
                                        <pre className="mt-1 text-[11px] whitespace-pre-wrap break-all rounded border border-slate-200 bg-slate-50 p-2">{JSON.stringify(log.metadata, null, 2)}</pre>
                                    </details>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>
                </div>
            </div>
        </div>
    );
};

export default Profile;
