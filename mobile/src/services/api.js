/**
 * API Client — v3 (Node Backend)
 *
 * Single axios instance for all service modules.
 *   • X-Platform header injection
 *   • JWT Bearer auth via SecureStore
 *   • 401 auto-clear + 429 exponential backoff
 *   • __DEV__ request timing logs
 */

import { Alert, Platform } from 'react-native';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ── URLs ───────────────────────────────────────────────────
const PROD_URL = 'https://acadhub.kuberbassi.com';

const DEV_URLS = Platform.select({
  web: 'http://localhost:5001',
  android: 'http://192.168.0.159:5001',
  ios: 'http://192.168.0.159:5001',
  default: 'http://127.0.0.1:5001',
});

export const API_URL = __DEV__ ? DEV_URLS : PROD_URL;

// ── Axios instance ─────────────────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Platform': Platform.OS === 'ios' ? 'ios' : 'android',
  },
});

// ── Request interceptor ────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (_) { /* SecureStore may fail on web */ }
    if (__DEV__) config._startTime = Date.now();
    return config;
  },
  (err) => Promise.reject(err),
);

// ── Response interceptor ───────────────────────────────────
api.interceptors.response.use(
  (res) => {
    if (__DEV__ && res.config._startTime) {
      const ms = Date.now() - res.config._startTime;
      console.log(`⚡ ${res.config.method?.toUpperCase()} ${res.config.url} → ${ms}ms`);
    }
    // Unwrap the backend's { success: true, data: ... } envelope
    if (res.data && res.data.success !== undefined && res.data.data !== undefined) {
      res.data = res.data.data;
    }
    return res;
  },
  async (err) => {
    const config = err.config;
    const status = err.response?.status;

    // 401 → wipe auth tokens
    if (status === 401) {
      try {
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('user_data');
      } catch (_) { }
    }

    // 429 → alert user, do not retry
    if (status === 429) {
      const msg = err.response?.data?.error
        || 'You are making requests too quickly. Please wait a minute.';
      Alert.alert('Rate Limited', msg);
      return Promise.reject(err);
    }

    return Promise.reject(err);
  },
);

export default api;
