import React, { createContext, useContext, useEffect, useState } from "react";
import { authStatus } from '../service/authApi';

const SessionContext = createContext(null);

export const useSessionContext = () => {
    return useContext(SessionContext);
}
// export const useSessionContext = () => useContext(SessionContext);

export const SessionProvider = ({children}) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMfaVerified, setIsMfaVerified] = useState(false);
    const [requiresReVerification, setRequiresReVerification] = useState(false);

    useEffect(() => {
        const checkAuthStatus = async () => {
            const storedUser = JSON.parse(sessionStorage.getItem('user'));
            console.log('Stored user from sessionStorage:', storedUser);

            if (storedUser) {
                try {
                    // Verify the session is still valid with the server
                    const authResponse = await authStatus();
                    console.log('Auth status check successful:', authResponse);

                    setUser({
                        ...storedUser,
                        ...authResponse,
                        username: authResponse.user || storedUser.username || storedUser.user,
                        user: authResponse.user || storedUser.user || storedUser.username
                    });
                    setIsLoggedIn(true);
                    setIsMfaVerified(true);

                    // Check if device is trusted even on page refresh
                    const trustedDevices = JSON.parse(localStorage.getItem('trustedDevices') || '{}');
                    const username = storedUser.user || storedUser.username;
                    const isDeviceTrusted = trustedDevices[username] === true;
                    console.log('Device trusted on restore:', username, '?', isDeviceTrusted);
                } catch (error) {
                    console.log('Auth status check failed, clearing session:', error);
                    // Session is invalid, clear stored user
                    sessionStorage.removeItem('user');
                    setUser(null);
                    setIsLoggedIn(false);
                    setIsMfaVerified(false);
                }
            }
            setLoading(false);
        };

        checkAuthStatus();
    }, []);

    const login = (userData) => {
        const normalizedUser = {
            ...userData,
            username: userData.username || userData.user,
            user: userData.user || userData.username
        };
        setIsLoggedIn(true);
        setUser(normalizedUser);
        setIsMfaVerified(true);
        sessionStorage.setItem('user', JSON.stringify(normalizedUser));
    }

    const trustDevice = (username) => {
        console.log('Trusting device for user:', username);
        const trustedDevices = JSON.parse(localStorage.getItem('trustedDevices') || '{}');
        trustedDevices[username] = true;
        localStorage.setItem('trustedDevices', JSON.stringify(trustedDevices));
        setIsMfaVerified(true);
    }

    const untrustDevice = (username) => {
        console.log('Untrusting device for user:', username);
        const trustedDevices = JSON.parse(localStorage.getItem('trustedDevices') || '{}');
        delete trustedDevices[username];
        localStorage.setItem('trustedDevices', JSON.stringify(trustedDevices));
    }

    const logoutAllDevices = (username) => {
        console.log('Logging out from all devices for user:', username);
        const trustedDevices = JSON.parse(localStorage.getItem('trustedDevices') || '{}');
        delete trustedDevices[username];
        localStorage.setItem('trustedDevices', JSON.stringify(trustedDevices));
        setIsMfaVerified(false);
        setRequiresReVerification(true);
    }

    const getTrustedDevices = (username) => {
        const trustedDevices = JSON.parse(localStorage.getItem('trustedDevices') || '{}');
        return trustedDevices[username] === true;
    }

    const requireMfaVerification = () => {
        console.log('Requiring MFA re-verification for sensitive action');
        setRequiresReVerification(true);
        setIsMfaVerified(false);
    }

    const logout = (data) => {
        if (data && data.message) {
            console.log(data.message);
        }
        setIsLoggedIn(false);
        setUser(null);
        setIsMfaVerified(false);
        sessionStorage.removeItem('user');
        // Note: trusted device info in localStorage is NOT cleared on logout
    }
    return (
        <SessionContext.Provider value={{isLoggedIn, user, loading, login, logout, isMfaVerified, setIsMfaVerified, trustDevice, untrustDevice, logoutAllDevices, getTrustedDevices, requireMfaVerification, requiresReVerification, setRequiresReVerification}}>
            {children}
        </SessionContext.Provider>
    );
}