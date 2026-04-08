import React, { useState } from 'react';
import { verify2fa, reset2fa } from '../service/authApi';
import { Shield, AlertCircle, RotateCcw } from 'lucide-react';

const TwoFAVerify = ({ onVerifySuccess, onResetSuccess }) => {
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleTokenVerification = async (e) => {
    e.preventDefault();
    try {
      setVerifying(true);
      const normalizedOtp = otp.replace(/\s+/g, '');
      console.log('Verifying OTP:', normalizedOtp);

      const data = await verify2fa(normalizedOtp);

      console.log("verify2fa response:", data);

      // FIXED: check correct response structure
      if (data.jwtToken) {
        onVerifySuccess(data);
      } else {
        setError('Invalid OTP. Please try again.');
        setOtp('');
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Verification failed. Please try again.');
      setOtp('');
    } finally {
      setVerifying(false);
    }
  };

  const handleReset = async () => {
    try {
      // FIXED: reset2fa() already returns data
      const data = await reset2fa();

      console.log('2FA RESET RESPONSE:', data);

      if (data) {
        onResetSuccess(data);
      } else {
        setError("2FA reset failed.");
      }
    } catch (err) {
      console.error(err);
      setError('2FA reset failed. Please try again.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
      <div className="max-w-2xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 opacity-40">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-500 font-semibold text-sm">
                1
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 1 of 2</p>
                <p className="text-sm font-semibold text-slate-600">Scan QR Code</p>
              </div>
            </div>
            <div className="h-0.5 flex-1 mx-4 bg-linear-to-r from-teal-200 via-teal-400 to-transparent"></div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white font-semibold text-sm">
                2
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Step 2 of 2</p>
                <p className="text-sm font-semibold text-slate-900">Verify Code</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-teal-200 bg-linear-to-br from-white via-teal-50/30 to-slate-50 shadow-lg shadow-slate-900/5">
          <div className="p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-teal-100 rounded-lg">
                <Shield className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Verify Your Code</h2>
                <p className="text-sm text-slate-600 mt-0.5">Enter the 6-digit code from your authenticator app</p>
              </div>
            </div>

            <form onSubmit={handleTokenVerification} className="space-y-6">
              {/* TOTP Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-3">
                  6-Digit Authentication Code
                </label>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9\s]/g, '').slice(0, 7))}
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="000 000"
                  className="w-full border-2 border-slate-300 px-4 py-4 rounded-lg text-center text-3xl tracking-widest font-mono bg-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-colors"
                  required
                  autoComplete="off"
                />
                <p className="text-xs text-slate-600 mt-2 text-center">
                  Check your authenticator app for the code
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Verify Button */}
              <button
                type="submit"
                disabled={verifying || otp.replace(/\s/g, '').length !== 6}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                  verifying || otp.replace(/\s/g, '').length !== 6
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95'
                }`}
              >
                {verifying ? 'Verifying...' : 'Verify & Enable 2FA'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Need Help?</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              {/* Reset Button */}
              <button
                type="button"
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Start Over
              </button>

              <p className="text-xs text-slate-600 text-center">
                Having trouble? Make sure your device time is synchronized and you're using the latest code from your authenticator app.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwoFAVerify;
