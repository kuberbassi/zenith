import api from './api';
import type { Experience, Certification, Project, Skill } from '@/types';

export const resumeService = {
    // --- Experiences ---
    getExperiences: async (): Promise<Experience[]> => {
        const res = await api.get('/api/resume/experiences');
        return res.data;
    },
    createExperience: async (data: Partial<Experience>): Promise<Experience> => {
        const res = await api.post('/api/resume/experiences', data);
        return res.data;
    },
    updateExperience: async (id: string, data: Partial<Experience>): Promise<Experience> => {
        const res = await api.put(`/api/resume/experiences/${id}`, data);
        return res.data;
    },
    deleteExperience: async (id: string): Promise<void> => {
        await api.delete(`/api/resume/experiences/${id}`);
    },

    // --- Certifications ---
    getCertifications: async (): Promise<Certification[]> => {
        const res = await api.get('/api/resume/certifications');
        return res.data;
    },
    createCertification: async (data: Partial<Certification>): Promise<Certification> => {
        const res = await api.post('/api/resume/certifications', data);
        return res.data;
    },
    updateCertification: async (id: string, data: Partial<Certification>): Promise<Certification> => {
        const res = await api.put(`/api/resume/certifications/${id}`, data);
        return res.data;
    },
    deleteCertification: async (id: string): Promise<void> => {
        await api.delete(`/api/resume/certifications/${id}`);
    },

    // --- Projects ---
    getProjects: async (): Promise<Project[]> => {
        const res = await api.get('/api/resume/projects');
        return res.data;
    },
    createProject: async (data: Partial<Project>): Promise<Project> => {
        const res = await api.post('/api/resume/projects', data);
        return res.data;
    },
    updateProject: async (id: string, data: Partial<Project>): Promise<Project> => {
        const res = await api.put(`/api/resume/projects/${id}`, data);
        return res.data;
    },
    deleteProject: async (id: string): Promise<void> => {
        await api.delete(`/api/resume/projects/${id}`);
    },

    // --- Skills ---
    getSkills: async (): Promise<Skill[]> => {
        const res = await api.get('/api/resume/skills');
        return res.data;
    },
    createSkill: async (data: Partial<Skill>): Promise<Skill> => {
        const res = await api.post('/api/resume/skills', data);
        return res.data;
    },
    updateSkill: async (id: string, data: Partial<Skill>): Promise<Skill> => {
        const res = await api.put(`/api/resume/skills/${id}`, data);
        return res.data;
    },
    deleteSkill: async (id: string): Promise<void> => {
        await api.delete(`/api/resume/skills/${id}`);
    },
};
