import React, { useState } from 'react';
import Button from './Button';
import Input from './Input';

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

const EmailModal = ({ isOpen, onClose, onSend, invoice }) => {
    const [emailData, setEmailData] = useState({
        recipientEmail: invoice?.to?.email || '',
        subject: `Invoice ${invoice?.invoice_no || ''}`,
        message: `Dear ${invoice?.to?.name || 'Customer'},

    Please find attached invoice ${invoice?.invoice_no || ''} for ${currencySymbol(invoice?.currency)}${invoice?.total?.toFixed(2) || '0.00'} ${invoice?.currency || 'USD'}.

The payment is due by ${invoice?.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'the due date'}.

Thank you for your business!

Best regards,
${invoice?.from?.name || 'Your Company'}`
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await onSend(emailData);
            onClose();
        } catch (error) {
            console.error('Error sending email:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold">Send Invoice via Email</h3>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Recipient Email *
                        </label>
                        <Input
                            type="email"
                            value={emailData.recipientEmail}
                            onChange={(e) => setEmailData({ ...emailData, recipientEmail: e.target.value })}
                            placeholder="client@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Subject
                        </label>
                        <Input
                            value={emailData.subject}
                            onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                            placeholder="Invoice subject"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Message
                        </label>
                        <textarea
                            value={emailData.message}
                            onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                            rows={6}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter your message..."
                        />
                    </div>

                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        <strong>Note:</strong> The invoice PDF will be automatically attached to this email.
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !emailData.recipientEmail}
                        >
                            {loading ? 'Sending...' : 'Send Email'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EmailModal;