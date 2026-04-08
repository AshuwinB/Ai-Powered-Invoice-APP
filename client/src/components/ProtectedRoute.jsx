import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {useSessionContext}  from '../context/SessionContext';
import Navigation from './Navigation';

const ProtectedRoute = () => {
    const { isLoggedIn, loading, user, isMfaVerified } = useSessionContext();
    const location = useLocation();
    console.log('ProtectedRoute - isLoggedIn:', isLoggedIn, 'loading:', loading, 'user:', user, 'isMfaVerified:', isMfaVerified, 'location:', location.pathname);
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center px-6">
                <div className="glass-panel rounded-2xl px-6 py-5 border border-white/80 shadow-lg flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-teal-600 border-t-transparent"></div>
                    <p className="text-slate-700 font-medium">Loading your workspace...</p>
                </div>
            </div>
        );
    }
    if (!isLoggedIn) {
        console.log('Not logged in, redirecting to /login');
        return <Navigate to="/login" />;
    }
    console.log('isMfaVerified:', isMfaVerified, 'location:', location.pathname);
    return (
        <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main className="flex-1">
                <Outlet />
            </main>
        </div>
    );
}

export default ProtectedRoute