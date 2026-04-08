import React from 'react'
import {Link} from 'react-router-dom'
import { useSessionContext } from '../context/SessionContext';
import Button from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { FileText, BarChart3, Shield, ArrowRight, Sparkles, CreditCard, FileClock } from 'lucide-react';

const HomePage = () => {
  const {user} = useSessionContext();

  console.log("User data in HomePage:", user);
  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter'>
      <div className='max-w-5xl mx-auto'>
        <section className='mb-8 rounded-3xl border border-white/80 bg-linear-to-br from-white via-teal-50/60 to-orange-50/80 p-6 sm:p-8 shadow-xl shadow-slate-900/5'>
          <p className='inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-teal-700'>
            <Sparkles className='h-3.5 w-3.5' />
            Workspace Overview
          </p>
          <h1 className='text-3xl sm:text-4xl font-bold mt-4 mb-2'>Welcome, {user?.user || user?.username}</h1>
          <p className='text-slate-600 max-w-2xl'>Your invoicing command center is ready. Jump into analytics, manage active invoices, or tune your account settings.</p>
          <div className='mt-5'>
            <Link to="/invoices/create">
              <Button className="gap-2">
                Create New Invoice
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        <div className='mb-5'>
          <h2 className='text-lg font-semibold text-slate-800'>Quick actions</h2>
          <p className='text-sm text-slate-500'>Everything important in one tap.</p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'>
          <Link to="/dashboard" className="h-full">
            <Card className="h-full min-h-[170px] cursor-pointer hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-teal-600" />
                  Dashboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">View real-time performance, revenue flow, and invoice health.</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/setup-2fa?from=home" className="h-full">
            <Card className="h-full min-h-[170px] cursor-pointer opacity-90 hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-teal-600" />
                  Enable 2FA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">Secure your account by setting up two-factor authentication.</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/payments" className="h-full">
            <Card className="h-full min-h-[170px] cursor-pointer hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-teal-600" />
                  Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">Review all payment transactions and inspect detailed checkout activity.</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/invoices" className="h-full">
            <Card className="h-full min-h-[170px] cursor-pointer hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-teal-600" />
                  Invoices
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">Create, send, and manage every invoice lifecycle in one place.</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/invoices/create?mode=ai" className="h-full">
            <Card className="h-full min-h-[170px] cursor-pointer hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-teal-600" />
                  Create with AI
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">Jump straight into AI-assisted invoice generation for faster billing.</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/profile?section=logs" className="h-full">
            <Card className="h-full min-h-[170px] cursor-pointer hover:-translate-y-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileClock className="h-5 w-5 text-teal-600" />
                  Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">Open invoice activity logs in Profile sidebar with timestamps and action details.</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default HomePage