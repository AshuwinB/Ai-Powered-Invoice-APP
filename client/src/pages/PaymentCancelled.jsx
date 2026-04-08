import React from 'react';
import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

const PaymentCancelled = () => {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
            <div className="text-center bg-white p-8 rounded-2xl shadow-lg border border-slate-200 max-w-md w-full">
                <XCircle className="h-12 w-12 text-amber-500 mx-auto" />
                <h1 className="mt-4 text-2xl font-bold text-slate-900">Payment Cancelled</h1>
                <p className="mt-2 text-slate-600">
                    Your checkout was cancelled. You can retry payment from your invoice.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                    <Link to="/invoices" className="px-4 py-2 rounded-md bg-teal-600 text-white hover:bg-teal-700">
                        Back to Invoices
                    </Link>
                    <Link to="/payments" className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100">
                        View Payments
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PaymentCancelled;
