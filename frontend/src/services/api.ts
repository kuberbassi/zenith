import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Create axios instance
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Important for session cookies
});

// Request interceptor
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// Response interceptor with retry logic
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const config = error.config as InternalAxiosRequestConfig & { _retry?: number };
        const errorData = error.response?.data as { code?: string; error?: string };

        if (error.response?.status === 401) {
            if (errorData?.code === 'TOKEN_EXPIRED' || errorData?.error?.includes('expired')) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                console.error('Session expired. Please login again.');
                window.location.href = '/login';
                return Promise.reject(error);
            }
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }

        if (shouldRetry(error)) {
            config._retry = (config._retry || 0) + 1;
            const maxRetries = 3;
            if (config._retry <= maxRetries) {
                // Exponential backoff: 1s, 2s, 4s...
                const delay = Math.pow(2, config._retry - 1) * 1000 + Math.random() * 500;
                console.warn(`Request failed (${error.response?.status}). Retrying in ${Math.round(delay)}ms... (Attempt ${config._retry}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return api.request(config);
            }
        }
        return Promise.reject(error);
    }
);

function shouldRetry(error: AxiosError): boolean {
    // Never retry mutation requests — they are not safe to replay on failure
    const method = error.config?.method?.toUpperCase();
    if (method && ['PUT', 'POST', 'DELETE', 'PATCH'].includes(method)) return false;
    if (!error.response) return true; // Network errors (GET/HEAD only)
    const status = error.response.status;
    return (status >= 500 && status < 600) || status === 429;
}

export default api;
