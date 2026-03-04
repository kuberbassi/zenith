/**
 * Dashboard Service — v1 API
 *
 * Dashboard data, reports, notifications, analytics.
 */

import api from './api';

// ── Dashboard data ─────────────────────────────────────────
export const getDashboardData = async (semester) => {
  const params = semester ? { semester } : {};
  const { data } = await api.get('/api/dashboard/data', { params });
  return data;
};

// ── Reports data ───────────────────────────────────────────
export const getReportsData = async (semester) => {
  const params = semester ? { semester } : {};
  const { data } = await api.get('/api/dashboard/reports_data', { params });
  return data;
};

// ── Notifications ──────────────────────────────────────────
export const getNotifications = async () => {
  const { data } = await api.get('/api/dashboard/notifications');
  return data;
};

// ── Day-of-week analytics ──────────────────────────────────
export const getDayOfWeekAnalytics = async (semester) => {
  const params = semester ? { semester } : {};
  const { data } = await api.get('/api/dashboard/analytics/day-of-week', { params });
  return data;
};

export default {
  getDashboardData,
  getReportsData,
  getNotifications,
  getDayOfWeekAnalytics,
};
