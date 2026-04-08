import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ArrowLeft, CreditCard, Download, RefreshCw } from 'lucide-react';
import { invoiceApi } from '../service/invoiceApi';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';

const getCurrencySymbol = (code) => {
    const symbols = {
        inr: '₹',
        usd: '$',
        eur: '€',
        gbp: '£',
        aud: 'A$',
        cad: 'C$',
        jpy: '¥'
    };

    if (!code) return '$';
    return symbols[code.toLowerCase()] || '$';
};

const getStatusBadgeClass = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'paid') return 'bg-emerald-100 text-emerald-700';
    if (value === 'refunded') return 'bg-rose-100 text-rose-700';
    return 'bg-amber-100 text-amber-700';
};

const Payments = () => {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [transactionLoading, setTransactionLoading] = useState(false);
    const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
    const [transactionMethodFilter, setTransactionMethodFilter] = useState('all');
    const [transactionSearch, setTransactionSearch] = useState('');

    const fetchTransactions = async () => {
        try {
            setLoading(true);
            const res = await invoiceApi.getRecentTransactions(200);
            setTransactions(res.data || []);
        } catch (error) {
            console.error('Transactions error:', error);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactionDetails = async (transactionId) => {
        try {
            setTransactionLoading(true);
            const res = await invoiceApi.getTransactionDetails(transactionId);
            setSelectedTransaction(res.data);
        } catch (error) {
            console.error('Failed to load transaction details:', error);
        } finally {
            setTransactionLoading(false);
        }
    };

    const paymentMethods = useMemo(() => Array.from(
        new Set(transactions.map((tx) => (tx.paymentMethod || '').toLowerCase()).filter(Boolean))
    ), [transactions]);

    const filteredTransactions = useMemo(() => {
        return [...transactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .filter((tx) => {
                const matchesStatus = transactionStatusFilter === 'all' || (tx.paymentStatus || '').toLowerCase() === transactionStatusFilter;
                const matchesMethod = transactionMethodFilter === 'all' || (tx.paymentMethod || '').toLowerCase() === transactionMethodFilter;
                const keyword = transactionSearch.trim().toLowerCase();
                const matchesSearch = keyword.length === 0
                    || (tx.description || '').toLowerCase().includes(keyword)
                    || (tx.customer || '').toLowerCase().includes(keyword)
                    || (tx.id || '').toLowerCase().includes(keyword)
                    || (tx.invoiceNo || '').toString().toLowerCase().includes(keyword);

                return matchesStatus && matchesMethod && matchesSearch;
            });
    }, [transactions, transactionMethodFilter, transactionSearch, transactionStatusFilter]);

    const exportTransactions = () => {
        if (filteredTransactions.length === 0) return;

        const exportRows = filteredTransactions.map((tx) => ({
            'Transaction ID': tx.id,
            'Invoice No': tx.invoiceNo,
            Amount: Number(tx.amount || 0).toFixed(2),
            Currency: tx.currency,
            'Payment Status': tx.paymentStatus,
            'Payment Method': tx.paymentMethod,
            Description: tx.description,
            Customer: tx.customer,
            'Customer Email': tx.customerEmail,
            Date: new Date(tx.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments');
        XLSX.writeFile(workbook, `payments-${Date.now()}.xlsx`);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => navigate('/home')}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
                            <p className="text-slate-600 mt-1">View all transactions and inspect payment details.</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchTransactions}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Button variant="outline" onClick={exportTransactions} disabled={filteredTransactions.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Excel
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-teal-600" />
                            All Transactions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-slate-500 text-center py-6">Loading transactions...</p>
                        ) : transactions.length === 0 ? (
                            <p className="text-slate-500 text-center py-6">No transactions available yet.</p>
                        ) : (
                            <>
                                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <select
                                        value={transactionStatusFilter}
                                        onChange={(e) => setTransactionStatusFilter(e.target.value)}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="paid">Paid</option>
                                        <option value="refunded">Refunded</option>
                                        <option value="unpaid">Unpaid</option>
                                        <option value="open">Open</option>
                                    </select>
                                    <select
                                        value={transactionMethodFilter}
                                        onChange={(e) => setTransactionMethodFilter(e.target.value)}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    >
                                        <option value="all">All Methods</option>
                                        {paymentMethods.map((method) => (
                                            <option key={method} value={method}>{method.toUpperCase()}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={transactionSearch}
                                        onChange={(e) => setTransactionSearch(e.target.value)}
                                        placeholder="Search customer, invoice, description, tx id"
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    />
                                </div>
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
                                            {filteredTransactions.map((tx) => (
                                                <tr
                                                    key={tx.id}
                                                    className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                                                    onClick={() => fetchTransactionDetails(tx.id)}
                                                >
                                                    <td className="py-2 pr-3 font-semibold">{getCurrencySymbol(tx.currency)}{Number(tx.amount || 0).toFixed(2)} {tx.currency}</td>
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
                                {filteredTransactions.length === 0 && (
                                    <p className="text-slate-500 text-center py-4">No transactions found for current filters.</p>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Transaction Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {transactionLoading ? (
                            <p className="text-slate-500">Loading transaction...</p>
                        ) : !selectedTransaction ? (
                            <p className="text-slate-500">Select a transaction to view details.</p>
                        ) : (
                            <div className="space-y-4 text-sm wrap-break-word">
                                <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                    <p className="text-xs text-slate-500">Amount</p>
                                    <p className="text-lg font-semibold">{getCurrencySymbol(selectedTransaction.currency)}{Number(selectedTransaction.amount || 0).toFixed(2)} {selectedTransaction.currency}</p>
                                    <p className="text-xs mt-1">Status: <span className="font-semibold uppercase break-all">{selectedTransaction.paymentStatus}</span></p>
                                </div>

                                <div>
                                    <p className="font-semibold mb-1">Recent Activity</p>
                                    {(selectedTransaction.recentActivity || []).map((activity, idx) => (
                                        <p key={idx} className="text-slate-600 wrap-break-word">• {activity.title} ({new Date(activity.time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})</p>
                                    ))}
                                </div>

                                <div>
                                    <p className="font-semibold mb-1">Checkout Summary</p>
                                    {(selectedTransaction.checkoutSummary || []).length === 0 ? (
                                        <p className="text-slate-500">No checkout line items available.</p>
                                    ) : (
                                        selectedTransaction.checkoutSummary.map((item, idx) => (
                                            <p key={idx} className="text-slate-600 wrap-break-word">• {item.description} x{item.quantity} - {getCurrencySymbol(item.currency)}{Number(item.amount || 0).toFixed(2)} {item.currency}</p>
                                        ))
                                    )}
                                </div>

                                <div>
                                    <p className="font-semibold mb-1">Other Details</p>
                                    <p className="text-slate-600 break-all">Transaction ID: {selectedTransaction.id}</p>
                                    <p className="text-slate-600 break-all">Invoice: {selectedTransaction.otherDetails?.invoiceNo}</p>
                                    <p className="text-slate-600 break-all">Payment Method: {selectedTransaction.paymentMethod}</p>
                                    <p className="text-slate-600 wrap-break-word">Customer: {selectedTransaction.customer}</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Payments;
