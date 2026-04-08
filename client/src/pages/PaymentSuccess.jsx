import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getCheckoutInvoicePdfUrl, invoiceApi } from '../service/invoiceApi';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

const PaymentSuccess = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [sessionData, setSessionData] = useState(null);
    const [sendingConfirmation, setSendingConfirmation] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState('');
    const [confirmationError, setConfirmationError] = useState('');
    const [requestingRefund, setRequestingRefund] = useState(false);
    const [refundMessage, setRefundMessage] = useState('');
    const [refundError, setRefundError] = useState('');

    useEffect(() => {
        const loadSessionStatus = async () => {
            if (!sessionId) {
                setError('Missing checkout session id.');
                setLoading(false);
                return;
            }

            try {
                const response = await invoiceApi.getCheckoutSessionStatus(sessionId);
                setSessionData(response.data);
            } catch (fetchError) {
                setError(fetchError?.response?.data?.message || 'Unable to verify your payment.');
            } finally {
                setLoading(false);
            }
        };

        loadSessionStatus();
    }, [sessionId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="text-center bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md w-full">
                    <Loader2 className="h-10 w-10 animate-spin text-teal-600 mx-auto" />
                    <p className="mt-4 text-slate-700">Confirming your payment...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="text-center bg-white p-8 rounded-2xl shadow-lg border border-red-200 max-w-md w-full">
                    <XCircle className="h-10 w-10 text-red-500 mx-auto" />
                    <h1 className="mt-4 text-2xl font-bold text-slate-900">Payment Verification Failed</h1>
                    <p className="mt-2 text-slate-600">{error}</p>
                    <div className="mt-6 flex justify-center gap-3">
                        <Link to="/invoices" className="px-4 py-2 rounded-md bg-slate-900 text-white hover:bg-slate-800">
                            Back to Invoices
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const isPaid = sessionData?.paymentStatus === 'paid';
    const checkoutPdfUrl = sessionId ? getCheckoutInvoicePdfUrl(sessionId) : '';
    const alreadySent = Boolean(sessionData?.paymentConfirmationEmailSent);
    const refundStatus = String(sessionData?.refundStatus || 'NONE').toUpperCase();
    const canRequestRefund = isPaid && refundStatus === 'NONE';

    const handleSendConfirmationEmail = async () => {
        if (!sessionId || sendingConfirmation || alreadySent) return;

        setSendingConfirmation(true);
        setConfirmationError('');
        setConfirmationMessage('');

        try {
            const response = await invoiceApi.sendCheckoutPaymentConfirmationEmail(sessionId);
            const message = response?.data?.message || 'Payment confirmation email sent successfully.';
            setConfirmationMessage(message);
            setSessionData((prev) => ({ ...prev, paymentConfirmationEmailSent: true }));
        } catch (sendError) {
            setConfirmationError(sendError?.response?.data?.message || 'Unable to send payment confirmation email.');
        } finally {
            setSendingConfirmation(false);
        }
    };

    const handleRequestRefund = async () => {
        if (!sessionId || requestingRefund || !canRequestRefund) return;

        setRequestingRefund(true);
        setRefundError('');
        setRefundMessage('');

        try {
            const response = await invoiceApi.requestCheckoutRefund(sessionId);
            setRefundMessage(response?.data?.message || 'Refund request submitted successfully.');
            setSessionData((prev) => ({
                ...prev,
                refundStatus: 'REQUESTED',
                refundRequestedAt: response?.data?.refundRequestedAt || new Date().toISOString(),
            }));
        } catch (requestError) {
            setRefundError(requestError?.response?.data?.message || 'Unable to request refund right now.');
        } finally {
            setRequestingRefund(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
            <div className="text-center bg-white p-8 rounded-2xl shadow-lg border border-teal-200 max-w-md w-full">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <h1 className="mt-4 text-2xl font-bold text-slate-900">
                    {isPaid ? 'Payment Successful' : 'Checkout Completed'}
                </h1>
                <p className="mt-2 text-slate-600">
                    {isPaid
                        ? 'Thank you. Your payment has been received.'
                        : 'Checkout is complete. Payment is currently pending.'}
                </p>

                {sessionData?.invoiceNo && (
                    <p className="mt-4 text-sm text-slate-700">
                        Invoice: <span className="font-semibold">{sessionData.invoiceNo}</span>
                    </p>
                )}

                {sessionData?.amount != null && (
                    <p className="mt-1 text-sm text-slate-700">
                        Amount: <span className="font-semibold">{sessionData.amount.toFixed(2)} {sessionData.currency}</span>
                    </p>
                )}

                <div className="mt-6 space-y-3">
                    <div className="flex flex-wrap justify-center gap-3">
                        {isPaid && checkoutPdfUrl && (
                            <a
                                href={checkoutPdfUrl}
                                className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700"
                            >
                                Download Invoice PDF
                            </a>
                        )}
                        {isPaid && (
                            <button
                                type="button"
                                onClick={handleSendConfirmationEmail}
                                disabled={sendingConfirmation || alreadySent}
                                className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {alreadySent ? 'Confirmation Email Sent' : (sendingConfirmation ? 'Sending...' : 'Send Payment Confirmation Email')}
                            </button>
                        )}
                    </div>

                    {isPaid && (
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={handleRequestRefund}
                                disabled={requestingRefund || !canRequestRefund}
                                className="px-4 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {refundStatus === 'REQUESTED'
                                    ? 'Refund Requested'
                                    : refundStatus === 'APPROVED'
                                        ? 'Refund Approved'
                                        : (requestingRefund ? 'Requesting...' : 'Refund Payment')}
                            </button>
                        </div>
                    )}
                </div>

                {isPaid && sessionData?.customerEmail && (
                    <p className="mt-3 text-xs text-slate-500">Recipient: {sessionData.customerEmail}</p>
                )}

                {confirmationMessage && <p className="mt-2 text-sm text-emerald-600">{confirmationMessage}</p>}
                {confirmationError && <p className="mt-2 text-sm text-rose-600">{confirmationError}</p>}
                {refundMessage && <p className="mt-2 text-sm text-emerald-600">{refundMessage}</p>}
                {refundError && <p className="mt-2 text-sm text-rose-600">{refundError}</p>}
            </div>
        </div>
    );
};

export default PaymentSuccess;
