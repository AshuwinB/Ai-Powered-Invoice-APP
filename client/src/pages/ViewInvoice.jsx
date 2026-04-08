import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoiceApi } from '../service/invoiceApi';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import Button from '../components/Button';
import EmailModal from '../components/EmailModal';
import { ArrowLeft, Edit, Download, Mail } from 'lucide-react';

const ViewInvoice = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEmailModal, setShowEmailModal] = useState(false);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                const response = await invoiceApi.getInvoice(id);
                setInvoice(response.data);
            } catch (error) {
                console.error('Error fetching invoice:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchInvoice();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading invoice...</p>
                </div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Invoice Not Found</h2>
                    <p className="text-gray-600 mb-6">The invoice you're looking for doesn't exist or has been deleted.</p>
                    <Button onClick={() => navigate('/invoices')}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Invoices
                    </Button>
                </div>
            </div>
        );
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'PAID': return 'text-green-600 bg-green-100';
            case 'UNPAID': return 'text-red-600 bg-red-100';
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

    const handleDownloadPDF = async () => {
        try {
            const response = await invoiceApi.downloadInvoicePDF(id);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `invoice-${invoice.invoice_no}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Error downloading PDF. Please try again.');
        }
    };

    const handleSendEmail = async (emailData) => {
        try {
            await invoiceApi.sendInvoiceEmail(id, emailData);
            alert('Invoice sent successfully!');
        } catch (error) {
            console.error('Error sending email:', error);
            alert('Error sending email. Please try again.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center gap-4 mb-8">
                <Button variant="outline" onClick={() => navigate('/invoices')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <h1 className="text-3xl font-bold">Invoice #{invoice.invoice_no}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(invoice.status)}`}>
                    {invoice.status}
                </span>
                <Button onClick={() => navigate(`/invoices/${id}/edit`)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Invoice
                </Button>
                <Button onClick={handleDownloadPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                </Button>
                <Button onClick={() => setShowEmailModal(true)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Invoice Details */}
                <Card>
                    <CardHeader>
                        <CardTitle>Invoice Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Invoice Number</label>
                                <p className="mt-1 text-sm text-gray-900">{invoice.invoice_no}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Currency</label>
                                <p className="mt-1 text-sm text-gray-900">{invoice.currency}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Invoice Date</label>
                                <p className="mt-1 text-sm text-gray-900">{new Date(invoice.invoice_date).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Due Date</label>
                                <p className="mt-1 text-sm text-gray-900">{new Date(invoice.due_date).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* From (Your Details) */}
                <Card>
                    <CardHeader>
                        <CardTitle>From (Your Details)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <p className="mt-1 text-sm text-gray-900">{invoice.from.name}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <p className="mt-1 text-sm text-gray-900">{invoice.from.email}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Address</label>
                            <p className="mt-1 text-sm text-gray-900">{invoice.from.address1}</p>
                            {invoice.from.address2 && <p className="mt-1 text-sm text-gray-900">{invoice.from.address2}</p>}
                            {invoice.from.address3 && <p className="mt-1 text-sm text-gray-900">{invoice.from.address3}</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* To (Client Details) */}
                <Card>
                    <CardHeader>
                        <CardTitle>To (Client Details)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <p className="mt-1 text-sm text-gray-900">{invoice.to.name}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <p className="mt-1 text-sm text-gray-900">{invoice.to.email}</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Address</label>
                            <p className="mt-1 text-sm text-gray-900">{invoice.to.address1}</p>
                            {invoice.to.address2 && <p className="mt-1 text-sm text-gray-900">{invoice.to.address2}</p>}
                            {invoice.to.address3 && <p className="mt-1 text-sm text-gray-900">{invoice.to.address3}</p>}
                        </div>
                    </CardContent>
                </Card>

                {/* Items */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Description
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Quantity
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Rate
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Amount
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {invoice.items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {item.item_name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {item.quantity}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {currencySymbol(invoice.currency)}{item.price.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {currencySymbol(invoice.currency)}{item.total.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Totals */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Totals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm font-medium text-gray-700">Subtotal:</span>
                                <span className="text-sm text-gray-900">{currencySymbol(invoice.currency)}{invoice.sub_total.toFixed(2)}</span>
                            </div>
                            {invoice.discount > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-sm font-medium text-gray-700">Discount:</span>
                                    <span className="text-sm text-gray-900">-{currencySymbol(invoice.currency)}{invoice.discount.toFixed(2)}</span>
                                </div>
                            )}
                            {invoice.tax_percentage > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-sm font-medium text-gray-700">Tax ({invoice.tax_percentage}%):</span>
                                    <span className="text-sm text-gray-900">{currencySymbol(invoice.currency)}{((invoice.sub_total - invoice.discount) * invoice.tax_percentage / 100).toFixed(2)}</span>
                                </div>
                            )}
                            <div className="border-t pt-2">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total:</span>
                                    <span>{currencySymbol(invoice.currency)}{invoice.total.toFixed(2)} {invoice.currency}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notes */}
                {invoice.notes && (
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                        </CardContent>
                    </Card>
                )}

                {/* Payment Information */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Payment Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {invoice.payment_link ? (
                            <div className="flex items-center gap-4">
                                <a
                                    href={invoice.payment_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                    Pay Now
                                </a>
                                <span className="text-sm text-gray-600">Stripe Checkout</span>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-700">Stripe payment link is unavailable.</p>
                        )}

                        {invoice.qr_code && (
                            <div>
                                <p className="text-sm text-gray-700 mb-2">Stripe QR payment (recommended):</p>
                                <img
                                    src={invoice.qr_code}
                                    alt="Payment QR Code"
                                    className="max-w-xs h-auto border rounded"
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <EmailModal
                isOpen={showEmailModal}
                onClose={() => setShowEmailModal(false)}
                onSend={handleSendEmail}
                invoice={invoice}
            />
        </div>
    );
};

export default ViewInvoice;