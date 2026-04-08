import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionContext } from '../context/SessionContext';
import { getDashboardStreamUrl, invoiceApi } from '../service/invoiceApi';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { TrendingUp, FileText, CheckCircle, XCircle, Plus, Calendar, CreditCard } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
    ResponsiveContainer
} from 'recharts';

const getStatusBadgeClass = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'paid') return 'bg-emerald-100 text-emerald-700';
    if (value === 'refunded') return 'bg-rose-100 text-rose-700';
    return 'bg-amber-100 text-amber-700';
};

const Dashboard = () => {
    const { user } = useSessionContext();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalInvoices: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
        cancelledInvoices: 0,
        totalRevenue: 0
    });
    const [recentInvoices, setRecentInvoices] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [currentIstTime, setCurrentIstTime] = useState('');
    const [loading, setLoading] = useState(true);

    const [chartData, setChartData] = useState([]);

    const formatRevenueTick = (value, index) => {
        if (index % 4 !== 0) {
            return '';
        }

        const parts = String(value || '').split(' ');
        return parts[1] || value;
    };

useEffect(() => {
        let clockIntervalId;

        const fetchStats = async () => {
            try {
                const res = await invoiceApi.getInvoiceStats();
                setStats(res.data);
            } catch (e) {
                console.error('Stats error:', e);
            }
        };

        const fetchRecent = async () => {
            try {
                const res = await invoiceApi.getRecentInvoices(3);
                setRecentInvoices(res.data);
            } catch (e) {
                console.error('Recent error:', e);
            }
        };

        const fetchChart = async () => {
            try {
                const res = await invoiceApi.get24hRevenue();
                setChartData(res.data || []);
            } catch (e) {
                console.error('Chart error:', e);
                setChartData([]);
            }
        };

        const fetchTransactions = async () => {
            try {
                const res = await invoiceApi.getRecentTransactions(8);
                setTransactions(res.data || []);
            } catch (e) {
                console.error('Transactions error:', e);
                setTransactions([]);
            }
        };

        const updateIstClock = () => {
            const now = new Date();
            const formatted = now.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            });
            setCurrentIstTime(`${formatted} IST`);
        };

        const fetchAll = async () => {
            await Promise.allSettled([fetchStats(), fetchRecent(), fetchChart(), fetchTransactions()]);
            setLoading(false);
        };

        const eventSource = new EventSource(getDashboardStreamUrl(), { withCredentials: true });

        const onConnected = () => {
            fetchAll();
        };

        const onDashboardUpdated = () => {
            fetchAll();
        };

        eventSource.addEventListener('connected', onConnected);
        eventSource.addEventListener('dashboard-updated', onDashboardUpdated);

        eventSource.onerror = () => {
            // Native EventSource reconnects automatically.
        };

        updateIstClock();
        fetchAll();
        clockIntervalId = setInterval(updateIstClock, 1000);

        return () => {
            eventSource.removeEventListener('connected', onConnected);
            eventSource.removeEventListener('dashboard-updated', onDashboardUpdated);
            eventSource.close();
            clearInterval(clockIntervalId);
        };
    }, []);

    const sortedTransactions = [...transactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const recentTransactions = sortedTransactions.slice(0, 8);

    const balanceTimeline = useMemo(() => {
        const paidTransactions = [...transactions]
            .filter((tx) => String(tx.paymentStatus || '').toLowerCase() === 'paid')
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let runningTotal = 0;
        return paidTransactions.map((tx) => {
            runningTotal += Number(tx.amount || 0);
            return {
                label: new Date(tx.date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                }),
                balance: Number(runningTotal.toFixed(2)),
            };
        });
    }, [transactions]);

    const currentBalance = balanceTimeline.length > 0
        ? balanceTimeline[balanceTimeline.length - 1].balance
        : 0;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-slate-600 mt-1">Welcome back, {user?.username}</p>
                    <p className="text-xs mt-1 text-slate-500">Current time: {currentIstTime}</p>
                </div>
                <button
onClick={() => navigate('/invoices/create')} 
                    className="bg-linear-to-r from-teal-600 via-teal-500 to-cyan-500 text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-md shadow-teal-900/20 hover:-translate-y-0.5 transition-all"
                >
                    <Plus className="h-4 w-4" />
                    New Invoice
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-600">Total Invoices</p>
                        <FileText className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-3 text-3xl font-bold text-slate-900">{stats.totalInvoices}</div>
                </div>

                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-600">Paid Invoices</p>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="mt-3 text-3xl font-bold text-green-600">{stats.paidInvoices}</div>
                </div>

                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-600">Unpaid Invoices</p>
                        <XCircle className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="mt-3 text-3xl font-bold text-red-600">{stats.unpaidInvoices}</div>
                </div>

                <div className="border-b border-slate-200 pb-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-600">Total Revenue</p>
                        <TrendingUp className="h-4 w-4 text-teal-600" />
                    </div>
                    <div className="mt-3 text-3xl font-bold text-slate-900">${stats.totalRevenue.toFixed(2)}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <Card className="pt-2">
                    <CardHeader>
<CardTitle>Revenue Last 24 Hours</CardTitle>
                        <p className="text-xs text-slate-500">Timezone: Asia/Kolkata (IST)</p>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
<LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="label" interval={0} minTickGap={28} tickFormatter={formatRevenueTick} />
                                <YAxis tickFormatter={(value) => `${value}`} />
                                <Tooltip formatter={(value) => [`$${Number(value || 0).toFixed(2)}`, 'Revenue']} 
                                    labelFormatter={(label) => `${label} IST`} />
                                <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="pt-2">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle>Recent Invoices</CardTitle>
                            <button
                                type="button"
                                onClick={() => navigate('/invoices')}
                                className="text-sm font-semibold text-teal-700 hover:underline"
                            >
                                View all invoices
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentInvoices.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No invoices yet</p>
                            ) : (
                                recentInvoices.map((invoice) => (
                                    <div key={invoice._id} className="flex items-center justify-between p-4 border-b border-slate-100 hover:bg-gray-50">
                                        <div className="space-y-1">
                                            <h4 className="font-medium">INV-{invoice.invoice_no}</h4>
                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                                    invoice.status === 'UNPAID' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    {invoice.status}
                                                </span>
                                                <Calendar className="h-3 w-3" />
                                                {new Date(invoice.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold">${invoice.total.toFixed(2)}</div>
                                            {invoice.payment_link && (
                                                <a href={invoice.payment_link} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-700 hover:underline mt-1 block">
                                                    Pay Now
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 pt-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-teal-600" />
                                Recent Transactions
                            </CardTitle>
                            <p className="text-sm text-slate-500">Showing latest 3 transactions.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/payments')}
                            className="text-sm font-semibold text-teal-700 hover:underline"
                        >
                            View all payments
                        </button>
                    </CardHeader>
                    <CardContent>
                        {transactions.length === 0 ? (
                            <p className="text-slate-500 text-center py-6">No transactions available yet.</p>
                        ) : (
                            <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead>
                                        <tr className="text-left border-b border-slate-200">
                                            <th className="py-2 pr-3">Amount</th>
                                            <th className="py-2 pr-3">Status</th>
                                            <th className="py-2 pr-3">Method</th>
                                            <th className="py-2 pr-3">Description</th>
                                            <th className="py-2 pr-3">Customer</th>
                                            <th className="py-2 pr-3">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentTransactions.map((tx) => (
                                            <tr
                                                key={tx.id}
                                                className="border-b border-slate-100"
                                            >
                                                <td className="py-2 pr-3 font-semibold">{Number(tx.amount || 0).toFixed(2)} {tx.currency}</td>
                                                <td className="py-2 pr-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(tx.paymentStatus)}`}>
                                                        {tx.paymentStatus}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-3 uppercase">{tx.paymentMethod}</td>
                                                <td className="py-2 pr-3 max-w-[260px] truncate" title={tx.description}>{tx.description}</td>
                                                <td className="py-2 pr-3 max-w-[220px] truncate" title={tx.customer}>{tx.customer}</td>
                                                <td className="py-2 pr-3">{new Date(tx.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {recentTransactions.length === 0 && (
                                <p className="text-slate-500 text-center py-4">No recent transactions available.</p>
                            )}
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="pt-2">
                    <CardHeader>
                        <CardTitle>Account Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total Received</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1 mb-4">${currentBalance.toFixed(2)}</p>

                        {balanceTimeline.length === 0 ? (
                            <p className="text-slate-500">No paid transactions yet. Balance will increase after payments are received.</p>
                        ) : (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={balanceTimeline}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" />
                                        <YAxis tickFormatter={(value) => `$${Number(value || 0).toFixed(0)}`} />
                                        <Tooltip formatter={(value) => [`$${Number(value || 0).toFixed(2)}`, 'Balance']} />
                                        <Line type="monotone" dataKey="balance" stroke="#0f766e" strokeWidth={3} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
