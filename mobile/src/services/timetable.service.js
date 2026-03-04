/**
 * Timetable Service — v1 API
 *
 * Timetable CRUD, slots, structure, holidays.
 */

import api from './api';

// ────────────── Timetable ──────────────────────────────────

export const getTimetable = async (semester) => {
  const params = semester ? { semester } : {};
  const { data } = await api.get('/api/timetable', { params });
  return data;
};

export const saveTimetable = async (timetable) => {
  const { data } = await api.post('/api/timetable', timetable);
  return data;
};

// ────────────── Structure ──────────────────────────────────

export const saveTimetableStructure = async (structure) => {
  const { data } = await api.post('/api/timetable/structure', structure);
  return data;
};

// ────────────── Slots ──────────────────────────────────────

export const addSlot = async (slot) => {
  const { data } = await api.post('/api/timetable/slot', slot);
  return data;
};

export const updateSlot = async (slot) => {
  const { data } = await api.put('/api/timetable/slot', slot);
  return data;
};

export const deleteSlot = async (slotData) => {
  const { data } = await api.delete('/api/timetable/slot', { data: slotData });
  return data;
};

// ────────────── Holidays ───────────────────────────────────

export const getHolidays = async () => {
  const { data } = await api.get('/api/timetable/holidays');
  return data;
};

export const addHoliday = async (holiday) => {
  const { data } = await api.post('/api/timetable/holidays', holiday);
  return data;
};

export const deleteHoliday = async (holidayData) => {
  const { data } = await api.delete('/api/timetable/holidays', { data: holidayData });
  return data;
};

export default {
  getTimetable,
  saveTimetable,
  saveTimetableStructure,
  addSlot,
  updateSlot,
  deleteSlot,
  getHolidays,
  addHoliday,
  deleteHoliday,
};
