/**
 * Skills Service — v1 API
 */

import api from './api';

export const getSkills = async () => {
  const { data } = await api.get('/api/skills');
  return data;
};

export const addSkill = async (skill) => {
  const { data } = await api.post('/api/skills', skill);
  return data;
};

export const updateSkill = async (skillId, updates) => {
  const { data } = await api.put(`/api/skills/${skillId}`, updates);
  return data;
};

export const deleteSkill = async (skillId) => {
  const { data } = await api.delete(`/api/skills/${skillId}`);
  return data;
};

export default {
  getSkills,
  addSkill,
  updateSkill,
  deleteSkill,
};
