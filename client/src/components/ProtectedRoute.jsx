import React from 'react'
import { Navigate, Outlet } from 'react-router-dom';
import {useSessionContext}  from '../context/SessionContext';

const ProtectedRoute = () => {
    const { isLoggedIn, loading } = useSessionContext(); // Replace with actual authentication logic 
    if (loading) {
        return <div>Loading...</div>; // or a spinner
    }  
        return isLoggedIn ? <Outlet /> : <Navigate to="/login" />;
}

export default ProtectedRoute