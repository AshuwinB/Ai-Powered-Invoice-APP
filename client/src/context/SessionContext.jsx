import React, { createContext, useContext, useEffect, useState } from "react";

const SessionContext = createContext(null);

export const useSessionContext = () => {
    return useContext(SessionContext);
}
// export const useSessionContext = () => useContext(SessionContext);

export const SessionProvider = ({children}) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = JSON.parse(sessionStorage.getItem('user'));
        console.log('Stored user from sessionStorage:', storedUser);
        if (storedUser) {
            setUser(storedUser);
            setIsLoggedIn(true);
        }
        setLoading(false);
    }, []);

    const login = (userData) => {
        setIsLoggedIn(true);
        setUser(userData);
        sessionStorage.setItem('user', JSON.stringify(userData));
    }

    const logout = (data) => {
        if (data && data.message) {
            console.log(data.message);
            setIsLoggedIn(false);
            setUser(null);
            sessionStorage.removeItem('user');
        }
            
  
    }
    return (
        <SessionContext.Provider value={{isLoggedIn, user, loading, login, logout}}>
            {children}
        </SessionContext.Provider>
    );
}