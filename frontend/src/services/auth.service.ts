import api from './api';
import type { User } from '@/types';


export const authService = {
    // Initiate Google OAuth login
    initiateLogin: () => {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        window.location.href = `${baseUrl}/api/auth/login`;
    },

    loginWithGoogle: async (credential: string): Promise<User | null> => {
        try {
            // Send the Google ID token to our Node backend for verification
            const response = await api.post('/api/auth/google', { credential });

            const { token, user } = response.data;

            // Store the JWT token from our backend
            if (token) {
                localStorage.setItem('auth_token', token);
            }

            return user;
        } catch (error) {
            console.error('Google login error:', error);
            throw error;
        }
    },

    // Get current user
    getCurrentUser: async (): Promise<User | null> => {
        try {
            const response = await api.get('/api/auth/me');
            return response.data.data;
        } catch (error) {
            return null;
        }
    },

    // Logout
    logout: async (): Promise<void> => {
        try {
            await api.post('/api/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    },

    // Check if user is authenticated
    isAuthenticated: (): boolean => {
        const user = localStorage.getItem('user');
        return !!user;
    },

    // Get stored user
    getStoredUser: (): User | null => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch {
                return null;
            }
        }
        return null;
    },

    // Store user
    storeUser: (user: User): void => {
        localStorage.setItem('user', JSON.stringify(user));
    },
};
