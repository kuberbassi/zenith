/**
 * Academic Service — v1 API
 *
 * Subjects CRUD, results, manual courses, full data.
 */

import api from './api';

// ────────────── Subjects ───────────────────────────────────

export const getSubjects = async (semester) => {
  const params = semester ? { semester } : {};
  const { data } = await api.get('/api/academic/subjects', { params });
  return data;
};

export const addSubject = async (subject) => {
  const { data } = await api.post('/api/academic/subjects', subject);
  return data;
};

export const getSubjectDetails = async (subjectId) => {
  const { data } = await api.get(`/api/academic/subjects/${subjectId}`);
  return data;
};

export const updateSubject = async (subjectId, updates) => {
  const { data } = await api.put(`/api/academic/subjects/${subjectId}`, updates);
  return data;
};

export const deleteSubject = async (subjectId) => {
  const { data } = await api.delete(`/api/academic/subjects/${subjectId}`);
  return data;
};

export const updateAttendanceCount = async (subjectId, attended, total) => {
  const payload = typeof attended === 'object' ? attended : { attended, total };
  const { data } = await api.post(`/api/academic/subjects/${subjectId}/attendance-count`, payload);
  return data;
};

export const updateSubjectFullDetails = async (subjectId, details) => {
  const { data } = await api.put(`/api/academic/subjects/${subjectId}`, details);
  return data;
};

export const updatePracticals = async (subjectId, updates) => {
  const { data } = await api.put(`/api/academic/subjects/${subjectId}`, { practicals: updates });
  return data;
};

export const updateAssignments = async (subjectId, updates) => {
  const { data } = await api.put(`/api/academic/subjects/${subjectId}`, { assignments: updates });
  return data;
};

export const getFullSubjectsData = async (semester) => {
  const params = semester ? { semester } : {};
  const { data } = await api.get('/api/academic/full_subjects_data', { params });
  return data;
};

// ────────────── Results ────────────────────────────────────

export const getResults = async (semester) => {
  const params = semester ? { semester } : {};
  const { data } = await api.get('/api/academic/results', { params });
  return data;
};

export const saveResults = async (results) => {
  const { data } = await api.post('/api/academic/results', results);
  return data;
};

export const deleteResults = async (semester) => {
  const { data } = await api.delete(`/api/academic/results/${semester}`);
  return data;
};

// ────────────── Manual Courses ─────────────────────────────

export const getManualCourses = async () => {
  const { data } = await api.get('/api/academic/courses/manual');
  return data;
};

export const addManualCourse = async (course) => {
  const { data } = await api.post('/api/academic/courses/manual', course);
  return data;
};

export const updateManualCourse = async (courseId, updates) => {
  const { data } = await api.put(`/api/academic/courses/manual/${courseId}`, updates);
  return data;
};

export const deleteManualCourse = async (courseId) => {
  const { data } = await api.delete(`/api/academic/courses/manual/${courseId}`);
  return data;
};

// ────────────── All semesters overview ─────────────────────

export const getAllSemestersOverview = async () => {
  const { data } = await api.get('/api/all_semesters_overview');
  return data;
};

export default {
  getSubjects,
  addSubject,
  getSubjectDetails,
  updateSubject,
  deleteSubject,
  updateAttendanceCount,
  updateSubjectFullDetails,
  updatePracticals,
  updateAssignments,
  getFullSubjectsData,
  getResults,
  saveResults,
  deleteResults,
  getManualCourses,
  addManualCourse,
  updateManualCourse,
  deleteManualCourse,
  getAllSemestersOverview,
};
