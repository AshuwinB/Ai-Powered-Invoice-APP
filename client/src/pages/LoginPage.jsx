import React from 'react'
import LoginForm from '../components/LoginForm'
import { useNavigate } from 'react-router-dom';
import { useSessionContext } from '../context/SessionContext';
import { ShieldCheck, TrendingUp, ReceiptText } from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useSessionContext();

  const handleLoginSuccess = (userData) => {
    console.log("Login successful:", userData);
    console.log("isMfaActive value:", userData.isMfaActive);
    login(userData);
    if (userData.shouldSetup2faOnboarding) {
      console.log("Navigating to /setup-2fa");
      navigate('/setup-2fa');
    } else {
      navigate('/home');
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 page-enter">
      <div className="w-full max-w-6xl grid lg:grid-cols-[1.1fr_.9fr] gap-10 items-stretch">
        <section className="hidden lg:flex flex-col justify-between border-b border-slate-200 p-4 pr-10 text-slate-900">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-teal-700">Invoice Studio</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight">Finance clarity for modern teams.</h1>
            <p className="mt-4 max-w-md text-slate-600">Manage invoices, monitor revenue trends, and secure account access with built-in 2FA.</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-200 p-3">
              <ShieldCheck className="h-5 w-5 text-teal-700" />
              <p className="text-sm">Secure authentication with multi-factor verification</p>
            </div>
            <div className="flex items-center gap-3 border-b border-slate-200 p-3">
              <ReceiptText className="h-5 w-5 text-teal-700" />
              <p className="text-sm">Generate and track invoices in one focused dashboard</p>
            </div>
            <div className="flex items-center gap-3 border-b border-slate-200 p-3">
              <TrendingUp className="h-5 w-5 text-teal-700" />
              <p className="text-sm">Real-time performance signals for daily decisions</p>
            </div>
          </div>
        </section>
        <div className="flex items-center justify-center">
          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    </div>
  )
}

export default LoginPage