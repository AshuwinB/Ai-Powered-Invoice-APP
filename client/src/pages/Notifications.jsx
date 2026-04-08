import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Trash2, RefreshCw, Shield, FileText, CreditCard, Info } from 'lucide-react';
import Button from '../components/Button';
import { invoiceApi } from '../service/invoiceApi';
import {
    rejectLoginRequest,
    approveLoginRequest,
} from '../service/authApi';
import {
    getNotifications,
    getNotificationStreamUrl,
    markNotificationsAsSeen,
    deleteNotification,
} from '../service/notificationApi';

const categoryOptions = [
    { value: 'all', label: 'All categories' },
    { value: 'auth', label: 'Auth' },
    { value: 'security', label: 'Security' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'payment', label: 'Payment' },
    { value: 'system', label: 'System' },
];

const categoryMeta = {
    auth: { icon: Shield, iconClass: 'text-indigo-600 bg-indigo-50' },
    security: { icon: Shield, iconClass: 'text-amber-600 bg-amber-50' },
    invoice: { icon: FileText, iconClass: 'text-teal-600 bg-teal-50' },
    payment: { icon: CreditCard, iconClass: 'text-green-600 bg-green-50' },
    system: { icon: Info, iconClass: 'text-slate-600 bg-slate-100' },
};

const Notifications = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('all');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 20 });
    const [unreadCount, setUnreadCount] = useState(0);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [approvalSelections, setApprovalSelections] = useState({});

    const loadNotifications = async (pageOverride) => {
        try {
            setLoading(true);
            const activePage = pageOverride || page;
            const data = await getNotifications({ status: 'all', category, limit: 20, page: activePage });
            setItems(data.notifications || []);
            setUnreadCount(Number(data.unreadCount || 0));
            setPagination(data.pagination || { page: 1, totalPages: 1, total: 0, limit: 20 });
        } catch (error) {
            console.error('Failed to load notifications:', error);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, [category, page]);

    useEffect(() => {
        const markSeenOnVisit = async () => {
            try {
                const result = await markNotificationsAsSeen();
                setUnreadCount(Number(result.unreadCount || 0));
                setItems((prev) => prev.map((item) => (
                    item?.metadata?.notificationKind === 'login-approval-request'
                        ? item
                        : { ...item, isRead: true, readAt: item.readAt || new Date().toISOString() }
                )));
            } catch (error) {
                // keep current state if marking seen fails
            }
        };

        markSeenOnVisit();
    }, []);

    useEffect(() => {
        const eventSource = new EventSource(getNotificationStreamUrl(), { withCredentials: true });

        const onUnreadCount = (event) => {
            try {
                const payload = JSON.parse(event.data || '{}');
                setUnreadCount(Number(payload.unreadCount || 0));
            } catch (error) {
                // ignore malformed payloads
            }
        };

        const onNotificationCreated = (event) => {
            try {
                const payload = JSON.parse(event.data || '{}');
                const created = payload.notification;
                if (!created) return;

                setUnreadCount(Number(payload.unreadCount || 0));

                // Only prepend on first page and broad filter, otherwise rely on manual refresh.
                if (page !== 1) return;
                if (category !== 'all' && created.category !== category) return;

                setItems((prev) => {
                    if (prev.some((item) => item._id === created._id)) {
                        return prev;
                    }
                    return [created, ...prev.slice(0, 49)];
                });
            } catch (error) {
                // ignore malformed payloads
            }
        };

        const onNotificationRead = (event) => {
            try {
                const payload = JSON.parse(event.data || '{}');
                if (!payload.id) return;
                setItems((prev) => prev.map((item) => (
                    item._id === payload.id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item
                )));
            } catch (error) {
                // ignore malformed payloads
            }
        };

        const onNotificationDeleted = (event) => {
            try {
                const payload = JSON.parse(event.data || '{}');
                if (!payload.id) return;
                setItems((prev) => prev.filter((item) => item._id !== payload.id));
            } catch (error) {
                // ignore malformed payloads
            }
        };

        const onAllRead = () => {
            setItems((prev) => prev.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })));
        };

        const onLoginApprovalResolved = (event) => {
            try {
                const payload = JSON.parse(event.data || '{}');
                if (!payload.challengeId) return;

                setItems((prev) => prev.map((item) => {
                    if (item?.metadata?.challengeId !== payload.challengeId) {
                        return item;
                    }

                    return {
                        ...item,
                        isRead: true,
                        readAt: item.readAt || payload.resolvedAt || new Date().toISOString(),
                        metadata: {
                            ...(item.metadata || {}),
                            resolvedAt: payload.resolvedAt || new Date().toISOString(),
                            resolutionStatus: payload.status || 'resolved',
                        },
                    };
                }));
            } catch (error) {
                // ignore malformed payloads
            }
        };

        eventSource.addEventListener('unread-count', onUnreadCount);
        eventSource.addEventListener('notification-created', onNotificationCreated);
        eventSource.addEventListener('notification-read', onNotificationRead);
        eventSource.addEventListener('notification-deleted', onNotificationDeleted);
        eventSource.addEventListener('all-notifications-read', onAllRead);
        eventSource.addEventListener('login-approval-resolved', onLoginApprovalResolved);

        return () => {
            eventSource.removeEventListener('unread-count', onUnreadCount);
            eventSource.removeEventListener('notification-created', onNotificationCreated);
            eventSource.removeEventListener('notification-read', onNotificationRead);
            eventSource.removeEventListener('notification-deleted', onNotificationDeleted);
            eventSource.removeEventListener('all-notifications-read', onAllRead);
            eventSource.removeEventListener('login-approval-resolved', onLoginApprovalResolved);
            eventSource.close();
        };
    }, [category, page]);

    const mergedItems = useMemo(
        () => [...items].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
        [items]
    );

    const stats = useMemo(() => {
        const read = mergedItems.filter((item) => item.isRead).length;
        const unread = mergedItems.length - read;
        return { total: mergedItems.length, read, unread };
    }, [mergedItems]);

    const isLoginApprovalNotification = (item) => (
        item?.metadata?.notificationKind === 'login-approval-request'
        && item?.metadata?.challengeId
    );

    const isRefundRequestNotification = (item) => (
        item?.metadata?.notificationKind === 'refund-request'
        && item?.metadata?.invoiceId
    );

    const markLocalNotificationHandled = (notificationId) => {
        setItems((prev) => prev.map((item) => (
            item._id === notificationId
                ? {
                    ...item,
                    isRead: true,
                    readAt: item.readAt || new Date().toISOString(),
                    metadata: {
                        ...(item.metadata || {}),
                        resolvedAt: new Date().toISOString(),
                    },
                }
                : item
        )));
    };

    const resolveLocalLoginApproval = (item, statusLabel) => {
        setApprovalSelections((prev) => {
            const next = { ...prev };
            delete next[item.metadata.challengeId];
            return next;
        });
        if (!item.metadata?.isSynthetic) {
            markLocalNotificationHandled(item._id);
            setItems((prev) => prev.map((entry) => (
                entry._id === item._id
                    ? {
                        ...entry,
                        metadata: {
                            ...(entry.metadata || {}),
                            resolutionStatus: statusLabel,
                            resolvedAt: new Date().toISOString(),
                        },
                    }
                    : entry
            )));
        }
    };

    const handleDelete = async (id) => {
        try {
            setBusy(true);
            const item = items.find((entry) => entry._id === id);
            await deleteNotification(id);
            setItems((prev) => prev.filter((entry) => entry._id !== id));
            if (item && !item.isRead) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Failed to delete notification:', error);
        } finally {
            setBusy(false);
        }
    };

    const handleApproveLoginRequest = async (item) => {
        const selectedCode = approvalSelections[item.metadata.challengeId];
        if (!selectedCode) {
            setMessage('Select a security code before approving the login request.');
            return;
        }

        try {
            setBusy(true);
            await approveLoginRequest(item.metadata.challengeId, selectedCode);
            resolveLocalLoginApproval(item, 'approved');
            setMessage('Login request approved.');
        } catch (error) {
            console.error('Failed to approve login request:', error);
            setMessage(error?.response?.data?.message || 'Unable to approve login request.');
        } finally {
            setBusy(false);
        }
    };

    const handleRejectLoginRequest = async (item) => {
        try {
            setBusy(true);
            await rejectLoginRequest(item.metadata.challengeId);
            resolveLocalLoginApproval(item, 'rejected');
            setMessage('Login request rejected.');
        } catch (error) {
            console.error('Failed to reject login request:', error);
            setMessage(error?.response?.data?.message || 'Unable to reject login request.');
        } finally {
            setBusy(false);
        }
    };

    const handleApproveRefundRequest = async (item) => {
        try {
            setBusy(true);
            await invoiceApi.approveInvoiceRefund(item.metadata.invoiceId);

            setItems((prev) => prev.map((entry) => (
                entry._id === item._id
                    ? {
                        ...entry,
                        isRead: true,
                        readAt: entry.readAt || new Date().toISOString(),
                        metadata: {
                            ...(entry.metadata || {}),
                            resolvedAt: new Date().toISOString(),
                            resolutionStatus: 'approved',
                        },
                    }
                    : entry
            )));

            setMessage('Refund approved and initiated successfully.');
        } catch (error) {
            console.error('Failed to approve refund request:', error);
            setMessage(error?.response?.data?.message || 'Unable to approve refund request.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Notifications</h1>
                    <p className="text-slate-600 mt-1">Stay updated with security, invoice, and payment events.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadNotifications} disabled={busy || loading}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 mb-6">
                <div className="border-b border-slate-200 pb-3">
                    <p className="text-sm text-slate-600">Total</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                </div>
                <div className="border-b border-slate-200 pb-3">
                    <p className="text-sm text-slate-600">Unread</p>
                    <p className="text-2xl font-bold text-teal-700">{stats.unread}</p>
                </div>
                <div className="border-b border-slate-200 pb-3">
                    <p className="text-sm text-slate-600">Read</p>
                    <p className="text-2xl font-bold text-slate-700">{stats.read}</p>
                </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Bell className="h-4 w-4" />
                    Unread count: <span className="font-semibold text-slate-900">{unreadCount}</span>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className="h-10 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        {categoryOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {message && (
                <p className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">{message}</p>
            )}

            {loading ? (
                <p className="py-8 text-center text-slate-500">Loading notifications...</p>
            ) : mergedItems.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-300 rounded-lg bg-white">
                    <p className="text-slate-600">No notifications found for this filter.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {mergedItems.map((item) => {
                        const meta = categoryMeta[item.category] || categoryMeta.system;
                        const Icon = meta.icon;
                        const isActionableLoginRequest = isLoginApprovalNotification(item) && !item.metadata?.resolvedAt;
                        const isActionableRefundRequest = isRefundRequestNotification(item) && !item.metadata?.resolvedAt;
                        return (
                            <div
                                key={item._id}
                                className="border rounded-lg px-4 py-3 transition-colors border-slate-200 bg-white"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex gap-3">
                                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${meta.iconClass}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-semibold text-slate-900">{item.title}</p>
                                                </div>
                                                <p className="text-sm text-slate-700 mt-0.5">{item.message}</p>
                                                <p className="text-xs text-slate-500 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                                            </div>
                                            {isActionableLoginRequest && (
                                                <div className="mt-2 text-xs text-slate-600 space-y-2">
                                                    <div>
                                                        <label className="mb-1 block font-medium text-slate-700">Select security code</label>
                                                        <select
                                                            value={approvalSelections[item.metadata.challengeId] || ''}
                                                            onChange={(event) => setApprovalSelections((prev) => ({
                                                                ...prev,
                                                                [item.metadata.challengeId]: event.target.value,
                                                            }))}
                                                            className="h-9 min-w-36 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                            disabled={busy}
                                                        >
                                                            <option value="">Choose code</option>
                                                            {(item.metadata.codeOptions || []).map((code) => (
                                                                <option key={code} value={code}>{code}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {item.metadata.requestingIp && <p>IP: {item.metadata.requestingIp}</p>}
                                                </div>
                                            )}
                                            {item.actionUrl && (
                                                <Link
                                                    to={item.actionUrl}
                                                    className="inline-block text-xs text-teal-700 font-semibold mt-2 hover:text-teal-800"
                                                >
                                                    View details
                                                </Link>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {isActionableLoginRequest && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApproveLoginRequest(item)}
                                                    disabled={busy || !approvalSelections[item.metadata.challengeId]}
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleRejectLoginRequest(item)}
                                                    disabled={busy}
                                                >
                                                    Reject
                                                </Button>
                                            </>
                                        )}
                                        {isActionableRefundRequest && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleApproveRefundRequest(item)}
                                                disabled={busy}
                                                className="bg-rose-600 text-white hover:bg-rose-700"
                                            >
                                                Approve Refund
                                            </Button>
                                        )}
                                        {!item.metadata?.isSynthetic && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleDelete(item._id)}
                                                disabled={busy}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
                        <p className="text-sm text-slate-600">
                            Page {pagination.page} of {pagination.totalPages} - Total {pagination.total}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                disabled={busy || loading || pagination.page <= 1}
                            >
                                Previous
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPage((prev) => Math.min(pagination.totalPages || 1, prev + 1))}
                                disabled={busy || loading || pagination.page >= (pagination.totalPages || 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;
