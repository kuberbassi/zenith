/**
 * Auth Service — v1 API
 *
 * Google OAuth, session management, token storage.
 */

import api from './api';
import * as SecureStore from 'expo-secure-store';

// ── Google login ───────────────────────────────────────────
export const googleLogin = async (idToken) => {
  const { data } = await api.post('/api/auth/google', { token: idToken });
  if (data.success && data.data?.token) {
    await SecureStore.setItemAsync('auth_token', data.data.token);
    if (data.data.user) {
      await SecureStore.setItemAsync('user_data', JSON.stringify(data.data.user));
    }
  }
  return data;
};

// ── Get current user ───────────────────────────────────────
export const getCurrentUser = async () => {
  const { data } = await api.get('/api/auth/me');
  return data;
};

// ── Logout ─────────────────────────────────────────────────
export const logout = async () => {
  try {
    await api.post('/api/auth/logout');
  } catch (_) { /* best-effort */ }
  await SecureStore.deleteItemAsync('auth_token');
  await SecureStore.deleteItemAsync('user_data');
};

// ── Token helpers ──────────────────────────────────────────
export const getStoredToken = () => SecureStore.getItemAsync('auth_token');
export const getStoredUser = async () => {
  const raw = await SecureStore.getItemAsync('user_data');
  return raw ? JSON.parse(raw) : null;
};
export const isAuthenticated = async () => !!(await getStoredToken());

export default {
  googleLogin,
  getCurrentUser,
  logout,
  getStoredToken,
  getStoredUser,
  isAuthenticated,
};
