import React, { useState } from 'react';
import { useSessionContext } from '../context/SessionContext';
import { AlertTriangle } from 'lucide-react';
import { verify2fa } from '../service/authApi';

const SecurityVerificationModal = ({ isOpen, title, message, onVerified, onCancel, action }) => {
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useSessionContext();

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await verify2fa(otp);
            if (data.success) {
                setOtp('');
                onVerified();
            } else {
                setError('Invalid OTP. Please try again.');
            }
        } catch (err) {
            setError('Verification failed. Please try again.');
            console.error('Verification error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                </div>

                <p className="text-gray-600 mb-6">{message}</p>

                <form onSubmit={handleVerify} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Enter 2FA Code
                        </label>
                        <input
                            type="text"
                            placeholder="000000"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            maxLength="6"
                            className="w-full border border-gray-300 px-4 py-2 rounded-lg text-center text-xl tracking-widest focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading || otp.length !== 6}
                            className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors ${
                                loading || otp.length !== 6
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {loading ? 'Verifying...' : 'Verify'}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 py-2 rounded-lg font-medium text-gray-900 bg-gray-200 hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>

                <p className="text-xs text-gray-500 mt-4 text-center">
                    Enter the 6-digit code from your authenticator app
                </p>
            </div>
        </div>
    );
};

export default SecurityVerificationModal;
