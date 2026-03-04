
import React, { createContext, useState, useEffect, useContext } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStorageData();

        // Setup Axios Interceptor for 401s
        const interceptor = api.interceptors.response.use(
            response => response,
            async error => {
                if (error.response?.status === 401) {
                    console.log("🔒 401 Unauthorized - Logging out");
                    await logout();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            api.interceptors.response.eject(interceptor);
        };
    }, []);

    // Helper for cross-platform storage (Web uses localStorage, Mobile uses SecureStore)
    const setStorageItem = async (key, value) => {
        if (Platform.OS === 'web') {
            localStorage.setItem(key, value);
        } else {
            await SecureStore.setItemAsync(key, value);
        }
    };

    const getStorageItem = async (key) => {
        if (Platform.OS === 'web') {
            return localStorage.getItem(key);
        } else {
            return await SecureStore.getItemAsync(key);
        }
    };

    const removeStorageItem = async (key) => {
        if (Platform.OS === 'web') {
            localStorage.removeItem(key);
        } else {
            await SecureStore.deleteItemAsync(key);
        }
    };

    const [lastChecked, setLastChecked] = useState(0);

    const loadStorageData = async (force = false) => {
        // Simple throttle: check once every 5 minutes unless forced
        const now = Date.now();
        if (!force && now - lastChecked < 300000 && user) {
            return;
        }

        try {
            const storedToken = await getStorageItem('auth_token');
            const storedUser = await getStorageItem('user_data');

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                // Configure axios with the stored token
                api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                setLastChecked(now);
            }
        } catch (e) {
            console.error('Failed to load storage data', e);
        } finally {
            setLoading(false);
        }
    };

    const storeUserSecurely = async (userData) => {
        try {
            // CRITICAL SECURITY FIX: Do NOT store the full Base64 picture in SecureStore
            // SecureStore has a 2048 byte limit. Base64 images are 2MB+.
            const userToStore = { ...userData };
            // CRITICAL: Only strip picture if it is a massive Base64 string.
            if (userToStore.picture && userToStore.picture.length > 2000 && !userToStore.picture.startsWith('http')) {
                delete userToStore.picture;
            }

            await setStorageItem('user_data', JSON.stringify(userToStore));
        } catch (error) {
            console.error("Error storing user", error);
        }
    };

    const login = async (userData, authToken) => {
        try {
            setUser(userData);
            setToken(authToken);

            api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

            await setStorageItem('auth_token', authToken);
            await storeUserSecurely(userData); // Use the new helper
            setLastChecked(Date.now());
        } catch (error) {
            console.error("Login persistence error:", error);
        }
    };

    const fetchUserProfile = async () => {
        try {
            const response = await api.get('/api/profile/');
            if (response.data && response.data.success) {
                const fetchedUser = response.data.data;
                console.log('📥 AuthContext: Profile synced from server', {
                    semester: fetchedUser.semester,
                    hasPicture: !!fetchedUser.picture
                });
                // Merge with existing user state to keep locally added fields if any
                setUser(prevUser => {
                    const newUser = { ...prevUser, ...fetchedUser };
                    // Persist basics (stripped) back to storage
                    storeUserSecurely(newUser);
                    return newUser;
                });
            }
        } catch (error) {
            console.error("Failed to fetch user profile for sync", error);
        }
    };

    // Sync profile on app launch when user is authenticated
    // This ensures picture, semester, and other web-modified fields are up-to-date
    useEffect(() => {
        if (token && user) {
            fetchUserProfile();
        }
    }, [token]);

    const updateUser = async (updatedData) => {
        try {
            // Merge with existing user data
            setUser(prevUser => {
                const newUser = { ...prevUser, ...updatedData };
                // Persist basics (stripped) back to storage
                storeUserSecurely(newUser);
                return newUser;
            });
        } catch (error) {
            console.error("Failed to update user context:", error);
        }
    };

    const logout = async () => {
        try {
            if (Platform.OS !== 'web') {
                const { GoogleSignin } = require('../utils/GoogleSigninSafe');
                const isSignedIn = await GoogleSignin.isSignedIn();
                if (isSignedIn) {
                    await GoogleSignin.signOut();
                }
            }
        } catch (error) {
            console.error("Google SignOut Error:", error);
        }

        setUser(null);
        setToken(null);
        delete api.defaults.headers.common['Authorization'];
        await removeStorageItem('auth_token');
        await removeStorageItem('user_data');
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
