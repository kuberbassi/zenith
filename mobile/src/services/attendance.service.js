/**
 * Attendance Service — v1 API
 *
 * Mark, edit, delete, logs, calendar, batch.
 */

import api from './api';

// ── Mark attendance ────────────────────────────────────────
export const markAttendance = async (payload) => {
  // payload: { subject_id, status, date?, semester?, substituted_by?, notes? }
  const { data } = await api.post('/api/attendance/mark', payload);
  return data;
};

// ── Mark all (batch) ───────────────────────────────────────
export const markAllAttendance = async (entries) => {
  // entries: [{ subject, status, date?, semester? }, ...]
  const { data } = await api.post('/api/mark_all_attendance', { entries });
  return data;
};

// ── Get attendance logs ────────────────────────────────────
export const getAttendanceLogs = async (params = {}) => {
  // params: { semester?, page?, limit?, sort_by?, sort_order?, subject?, status?, start_date?, end_date? }
  const { data } = await api.get('/api/attendance/logs', { params });
  return data;
};

// ── Edit attendance log ────────────────────────────────────
export const editAttendance = async (logId, updates) => {
  const { data } = await api.put(`/api/attendance/logs/${logId}`, updates);
  return data;
};

// ── Delete attendance log ──────────────────────────────────
export const deleteAttendance = async (logId) => {
  const { data } = await api.delete(`/api/attendance/logs/${logId}`);
  return data;
};

// ── Calendar data ──────────────────────────────────────────
export const getCalendarData = async (params = {}) => {
  // params: { semester?, month?, year? }
  const { data } = await api.get('/api/attendance/calendar_data', { params });
  return data;
};

// ── Classes for a date ─────────────────────────────────────
export const getClassesForDate = async (date, semester) => {
  const params = { date };
  if (semester) params.semester = semester;
  const { data } = await api.get('/api/attendance/classes-for-date', { params });
  return data;
};

// ── Logs for a specific date ───────────────────────────────
export const getLogsForDate = async (date) => {
  const { data } = await api.get('/api/attendance/logs', { params: { date } });
  return data;
};

// ── IPU Results ────────────────────────────────────────────
export const getSavedIPUResults = async () => {
  const { data } = await api.get('/api/ipu/saved-results');
  return data;
};

export const autoFetchIPUResults = async (credentials) => {
  const { data } = await api.post('/api/ipu/auto-fetch', credentials);
  return data;
};

export const fetchIPUResults = async (payload) => {
  const { data } = await api.post('/api/ipu/fetch-results', payload);
  return data;
};

export const getIPUCaptcha = async () => {
  const { data } = await api.get('/api/ipu/captcha');
  return data;
};

export const changeIPUPassword = async (payload) => {
  const { data } = await api.post('/api/ipu/change-password', payload);
  return data;
};

export default {
  markAttendance,
  markAllAttendance,
  getAttendanceLogs,
  editAttendance,
  deleteAttendance,
  getCalendarData,
  getClassesForDate,
  getLogsForDate,
  getSavedIPUResults,
  autoFetchIPUResults,
  fetchIPUResults,
  getIPUCaptcha,
  changeIPUPassword,
};
