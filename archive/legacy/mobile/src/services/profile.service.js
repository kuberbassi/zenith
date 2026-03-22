/**
 * Profile Service — v1 API
 *
 * Profile CRUD, preferences, PFP upload, system logs.
 */

import api from './api';

// ── Get profile ────────────────────────────────────────────
export const getProfile = async () => {
  const { data } = await api.get('/api/profile');
  return data;
};

// ── Update profile ─────────────────────────────────────────
export const updateProfile = async (updates) => {
  const { data } = await api.put('/api/profile', updates);
  return data;
};

// ── Upload profile picture ─────────────────────────────────
export const uploadProfilePicture = async (formData) => {
  const { data } = await api.post('/api/profile/upload_pfp', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  });
  return data;
};

// ── Preferences ────────────────────────────────────────────
export const getPreferences = async () => {
  const { data } = await api.get('/api/profile/preferences');
  return data;
};

export const savePreferences = async (prefs) => {
  const { data } = await api.post('/api/profile/preferences', prefs);
  return data;
};

// ── System / activity logs ─────────────────────────────────
export const getSystemLogs = async (params = {}) => {
  const { data } = await api.get('/api/profile/logs', { params });
  return data;
};

export default {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  getPreferences,
  savePreferences,
  getSystemLogs,
};
