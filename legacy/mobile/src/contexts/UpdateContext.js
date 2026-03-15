import React, { createContext, useContext, useEffect } from 'react';
import useUpdateChecker from '../hooks/useUpdateChecker';
import { useAuth } from './AuthContext';

const UpdateContext = createContext();

export const UpdateProvider = ({ children }) => {
    const { user } = useAuth();
    const updateInfo = useUpdateChecker();
    const { checkUpdate } = updateInfo;

    // Automatically check for updates when the user is authenticated
    useEffect(() => {
        if (user) {
            console.log('🚀 Authenticated: Triggering automatic version check...');
            checkUpdate(true); // Silent check
        }
    }, [user, checkUpdate]);

    return (
        <UpdateContext.Provider value={updateInfo}>
            {children}
        </UpdateContext.Provider>
    );
};

export const useUpdate = () => useContext(UpdateContext);
