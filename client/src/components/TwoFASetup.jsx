import React, { useEffect, useState } from 'react';
import { setup2fa } from '../service/authApi';
import { Shield, Copy, CheckCircle } from 'lucide-react';

const TwoFASetup = ({ onSetupComplete, onSkip = null }) => {
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQRCode = async () => {
      try {
        const data = await setup2fa();
        console.log('2FA SETUP RESPONSE:', data);
        if (!data?.qrCodeDataURL || !data?.secret) {
          throw new Error('Invalid 2FA setup response');
        }

        setQrCode(data.qrCodeDataURL);
        setSecret(data.secret);
      } catch (err) {
        console.error(err);
        setError('Failed to load QR code. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchQRCode();
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setMessage('Code copied to clipboard!');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
      <div className="max-w-2xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white font-semibold text-sm">
                1
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Step 1 of 2</p>
                <p className="text-sm font-semibold text-slate-900">Scan QR Code</p>
              </div>
            </div>
            <div className="h-0.5 flex-1 mx-4 bg-linear-to-r from-teal-200 to-transparent"></div>
            <div className="flex items-center gap-3 opacity-40">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-500 font-semibold text-sm">
                2
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 2 of 2</p>
                <p className="text-sm font-semibold text-slate-600">Verify Code</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-teal-200 bg-linear-to-br from-white via-teal-50/30 to-slate-50 shadow-lg shadow-slate-900/5">
          <div className="p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-100 rounded-lg">
                  <Shield className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Set Up 2FA</h2>
                  <p className="text-sm text-slate-600 mt-0.5">Secure your account with two-factor authentication</p>
                </div>
              </div>
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  Skip
                </button>
              )}
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            ) : (
              <>
                <p className="text-slate-600 mb-6">
                  Scan the QR code below with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
                </p>

                {/* QR Code Container */}
                <div className="mb-6 p-6 bg-white border-2 border-dashed border-teal-200 rounded-xl flex justify-center items-center min-h-[280px]">
                  {loading ? (
                    <div className="text-center">
                      <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600 mb-3"></div>
                      <p className="text-slate-600">Loading QR Code...</p>
                    </div>
                  ) : (
                    <img
                      src={qrCode}
                      alt="2FA QR code"
                      className="border-2 border-slate-200 rounded-lg shadow-sm"
                      style={{ maxWidth: '200px' }}
                    />
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-slate-200"></div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Or enter manually</span>
                  <div className="flex-1 h-px bg-slate-200"></div>
                </div>

                {/* Manual Code */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Backup Code
                  </label>
                  <p className="text-xs text-slate-600 mb-3">
                    If you can't scan the QR code, enter this code manually in your authenticator app:
                  </p>

                  {message && (
                    <div className="flex items-center gap-2 mb-3 text-emerald-700 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      {message}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={secret}
                      readOnly
                      className="flex-1 border border-slate-300 px-4 py-3 rounded-lg font-mono text-sm bg-slate-50 text-slate-900 cursor-pointer hover:bg-slate-100 transition-colors focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100"
                      onClick={copyToClipboard}
                    />
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 px-4 py-3 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg font-medium text-teal-700 transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  onClick={onSetupComplete}
                  disabled={loading || !secret}
                  className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                    loading || !secret
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95'
                  }`}
                >
                  Next: Verify Code
                </button>

                {onSkip && (
                  <p className="mt-4 text-center text-xs text-slate-600">
                    You can enable 2FA later from your Profile settings.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwoFASetup;
