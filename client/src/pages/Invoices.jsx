import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoiceApi } from '../service/invoiceApi';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import { Plus, Eye, Edit, Trash2, Copy, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const Invoices = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkStatus, setBulkStatus] = useState('UNPAID');
    const [updatingBulk, setUpdatingBulk] = useState(false);
    const [pendingDeleteIds, setPendingDeleteIds] = useState([]);
    const [committingDelete, setCommittingDelete] = useState(false);
    const deleteTimerRef = useRef(null);

    useEffect(() => {
        const fetchInvoices = async () => {
            try {
                const response = await invoiceApi.getInvoices();
                setInvoices(response.data);
            } catch (error) {
                console.error('Error fetching invoices:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInvoices();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this invoice?')) {
            try {
                await invoiceApi.deleteInvoice(id);
                setInvoices(invoices.filter(invoice => invoice._id !== id));
            } catch (error) {
                console.error('Error deleting invoice:', error);
            }
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PAID': return 'text-green-600 bg-green-100';
            case 'UNPAID': return 'text-yellow-600 bg-yellow-100';
            case 'CANCEL': return 'text-gray-600 bg-gray-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const currencySymbol = (code) => {
        const symbolMap = {
            inr: '₹',
            usd: '$',
            eur: '€',
            gbp: '£',
            aud: 'A$',
            cad: 'C$',
            jpy: '¥'
        };

        if (!code) return '$';
        return symbolMap[code.toLowerCase()] || '$';
    };

    const filteredInvoices = invoices.filter((invoice) => {
        const statusMatch = statusFilter === 'ALL' || invoice.status === statusFilter;
        const query = searchTerm.trim().toLowerCase();
        const searchMatch = !query
            || String(invoice.invoice_no || '').toLowerCase().includes(query)
            || String(invoice.to?.name || '').toLowerCase().includes(query)
            || String(invoice.to?.email || '').toLowerCase().includes(query);
        return statusMatch && searchMatch;
    });

    const visibleInvoices = filteredInvoices.filter((invoice) => !pendingDeleteIds.includes(invoice._id));

    const exportRows = visibleInvoices.map((invoice) => ({
        'Invoice No': invoice.invoice_no,
        Status: invoice.status,
        Currency: String(invoice.currency || '').toUpperCase(),
        Total: Number(invoice.total || 0).toFixed(2),
        'Invoice Date': new Date(invoice.invoice_date).toLocaleDateString(),
        'Due Date': new Date(invoice.due_date).toLocaleDateString(),
        'Client Name': invoice.to?.name || '',
        'Client Email': invoice.to?.email || '',
        'Created At': new Date(invoice.createdAt).toLocaleString(),
    }));

    const handleToggleSelection = (id) => {
        setSelectedIds((prev) => (
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        ));
    };

    const handleToggleSelectAllVisible = () => {
        const visibleIds = visibleInvoices.map((invoice) => invoice._id);
        const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));

        if (allVisibleSelected) {
            setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
            return;
        }

        const merged = new Set([...selectedIds, ...visibleIds]);
        setSelectedIds(Array.from(merged));
    };

    const clearDeleteTimer = () => {
        if (deleteTimerRef.current) {
            clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = null;
        }
    };

    const commitBulkDelete = async (idsToDelete) => {
        if (!idsToDelete.length) return;

        try {
            setCommittingDelete(true);
            await invoiceApi.bulkDeleteInvoices(idsToDelete);
            setInvoices((prev) => prev.filter((invoice) => !idsToDelete.includes(invoice._id)));
            setPendingDeleteIds([]);
        } catch (error) {
            console.error('Error deleting invoices in bulk:', error);
            setPendingDeleteIds([]);
            alert(error?.response?.data?.message || 'Failed to delete selected invoices.');
        } finally {
            setCommittingDelete(false);
            clearDeleteTimer();
        }
    };

    const handleScheduleBulkDelete = () => {
        if (!selectedIds.length) {
            alert('Select at least one invoice first.');
            return;
        }

        clearDeleteTimer();
        const ids = [...selectedIds];
        setPendingDeleteIds(ids);
        setSelectedIds([]);

        deleteTimerRef.current = setTimeout(() => {
            commitBulkDelete(ids);
        }, 8000);
    };

    const handleUndoBulkDelete = () => {
        clearDeleteTimer();
        setPendingDeleteIds([]);
    };

    useEffect(() => {
        return () => clearDeleteTimer();
    }, []);

    const handleBulkStatusUpdate = async () => {
        if (!selectedIds.length) {
            alert('Select at least one invoice first.');
            return;
        }

        try {
            setUpdatingBulk(true);
            await invoiceApi.bulkUpdateInvoiceStatus(selectedIds, bulkStatus);
            setInvoices((prev) => prev.map((invoice) => (
                selectedIds.includes(invoice._id)
                    ? { ...invoice, status: bulkStatus }
                    : invoice
            )));
            setSelectedIds([]);
        } catch (error) {
            console.error('Error bulk updating invoices:', error);
            alert(error?.response?.data?.message || 'Failed to update invoice statuses.');
        } finally {
            setUpdatingBulk(false);
        }
    };

    const handleExportXlsx = () => {
        if (!exportRows.length) {
            alert('No invoices available for export in current filter.');
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(exportRows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices');
        XLSX.writeFile(workbook, `invoices-${Date.now()}.xlsx`);
    };

    const handleExportCsv = () => {
        if (!exportRows.length) {
            alert('No invoices available for export in current filter.');
            return;
        }

        const headers = Object.keys(exportRows[0]);
        const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const csvLines = [
            headers.join(','),
            ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
        ];

        const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `invoices-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const summary = invoices.reduce((acc, invoice) => {
        acc.total += 1;
        if (invoice.status === 'PAID') acc.paid += 1;
        if (invoice.status === 'UNPAID') acc.unpaid += 1;
        if (invoice.status === 'CANCEL') acc.cancel += 1;
        return acc;
    }, { total: 0, paid: 0, unpaid: 0, cancel: 0 });

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Invoices</h1>
                <Link to="/invoices/create">
                    <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Invoice
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="border-b border-slate-200 pb-3">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
                </div>
                <div className="border-b border-slate-200 pb-3">
                    <p className="text-xs text-slate-500">Paid</p>
                    <p className="text-2xl font-bold text-emerald-600">{summary.paid}</p>
                </div>
                <div className="border-b border-slate-200 pb-3">
                    <p className="text-xs text-slate-500">Unpaid</p>
                    <p className="text-2xl font-bold text-rose-600">{summary.unpaid}</p>
                </div>
                <div className="border-b border-slate-200 pb-3">
                    <p className="text-xs text-slate-500">Cancelled</p>
                    <p className="text-2xl font-bold text-slate-600">{summary.cancel}</p>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by invoice no, client, or email"
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    <option value="ALL">All statuses</option>
                    <option value="PAID">PAID</option>
                    <option value="UNPAID">UNPAID</option>
                    <option value="CANCEL">CANCEL</option>
                </select>
                <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }}>
                    Reset filters
                </Button>
            </div>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
                <Button variant="outline" onClick={handleExportCsv} className="justify-center">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                </Button>
                <Button variant="outline" onClick={handleExportXlsx} className="justify-center">
                    <Download className="h-4 w-4 mr-2" />
                    Export XLSX
                </Button>
                <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    <option value="UNPAID">Set selected to UNPAID</option>
                    <option value="PAID">Set selected to PAID</option>
                    <option value="CANCEL">Set selected to CANCEL</option>
                </select>
                <Button onClick={handleBulkStatusUpdate} disabled={updatingBulk || selectedIds.length === 0}>
                    {updatingBulk ? 'Updating...' : `Apply to Selected (${selectedIds.length})`}
                </Button>
                <Button
                    variant="destructive"
                    onClick={handleScheduleBulkDelete}
                    disabled={committingDelete || selectedIds.length === 0 || pendingDeleteIds.length > 0}
                >
                    {committingDelete ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
                </Button>
            </div>

            {pendingDeleteIds.length > 0 && (
                <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-amber-900">
                        {pendingDeleteIds.length} invoice(s) scheduled for deletion. Undo within 8 seconds.
                    </p>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleUndoBulkDelete}>
                            Undo
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => commitBulkDelete(pendingDeleteIds)}
                            disabled={committingDelete}
                        >
                            Delete now
                        </Button>
                    </div>
                </div>
            )}

            {visibleInvoices.length > 0 && (
                <div className="mb-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={visibleInvoices.every((invoice) => selectedIds.includes(invoice._id))}
                            onChange={handleToggleSelectAllVisible}
                            className="h-4 w-4"
                        />
                        Select all visible invoices
                    </label>
                </div>
            )}

            <div className="grid gap-4">
                {visibleInvoices.length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-8">
                            <p className="text-slate-500">No invoices found for this filter.</p>
                        </CardContent>
                    </Card>
                ) : (
                    visibleInvoices.map((invoice) => (
                        <Card key={invoice._id} className="hover:-translate-y-0.5">
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3 flex-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(invoice._id)}
                                            onChange={() => handleToggleSelection(invoice._id)}
                                            className="mt-1 h-4 w-4"
                                        />
                                        <div className="flex-1">
                                        <div className="flex items-center gap-4 mb-2">
                                            <h3 className="text-lg font-semibold">
                                                Invoice #{invoice.invoice_no}
                                            </h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                                                {invoice.status}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 mb-2">
                                            To: {invoice.to.name} ({invoice.to.email})
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            Due: {new Date(invoice.due_date).toLocaleDateString()}
                                        </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold">
                                            {currencySymbol(invoice.currency)}{invoice.total.toFixed(2)}
                                        </p>
                                        <p className="text-sm text-slate-500">{invoice.currency}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <Link to={`/invoices/${invoice._id}`}>
                                        <Button variant="outline" size="sm">
                                            <Eye className="h-4 w-4 mr-1" />
                                            View
                                        </Button>
                                    </Link>
                                    <Link to={`/invoices/${invoice._id}/edit`}>
                                        <Button variant="outline" size="sm">
                                            <Edit className="h-4 w-4 mr-1" />
                                            Edit
                                        </Button>
                                    </Link>
                                    <Link to={`/invoices/create?clone=${invoice._id}`}>
                                        <Button variant="outline" size="sm">
                                            <Copy className="h-4 w-4 mr-1" />
                                            Duplicate
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(invoice._id)}
                                    >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default Invoices;