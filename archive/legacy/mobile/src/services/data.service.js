/**
 * Data Service — v1 API
 *
 * Export, import, delete-all, backups, restore.
 */

import api from './api';

// ── Export ──────────────────────────────────────────────────
export const exportData = async () => {
  const { data } = await api.get('/api/data/export_data');
  return data;
};

// ── Import ─────────────────────────────────────────────────
export const importData = async (payload) => {
  const { data } = await api.post('/api/data/import_data', payload);
  return data;
};

// ── Delete all ─────────────────────────────────────────────
export const deleteAllData = async () => {
  const { data } = await api.delete('/api/data/delete_all_data');
  return data;
};

// ── Backups ────────────────────────────────────────────────
export const getBackups = async () => {
  const { data } = await api.get('/api/data/backups');
  return data;
};

export const restoreBackup = async (backupId) => {
  const { data } = await api.post(`/api/data/restore_backup/${backupId}`);
  return data;
};

export default {
  exportData,
  importData,
  deleteAllData,
  getBackups,
  restoreBackup,
};
