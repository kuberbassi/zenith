import React, { useState, useEffect } from 'react';
import { Briefcase, Code, Zap, Award, Plus, Trash2, ChevronRight, ShieldCheck } from 'lucide-react';
import { resumeService } from '@/services/resume.service';
import type { Experience, Skill, Project, Certification } from '@/types';
import { useToast } from '@/components/ui/Toast';

export const TacticalOps: React.FC = () => {
    const { showToast } = useToast();
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);
    const load = async () => {
        try { setExperiences(await resumeService.getExperiences()); }
        catch { showToast('error', 'Failed to load experiences'); }
        finally { setLoading(false); }
    };

    const handleAdd = async () => {
        const company = prompt('Company Name:');
        if (!company) return;
        const role = prompt('Role / Title:');
        if (!role) return;
        const start_date = prompt('Start Date (e.g. 2024-01):');
        if (!start_date) return;
        try {
            await resumeService.createExperience({ company, role, start_date, current: true });
            load();
            showToast('success', 'Experience added');
        } catch { showToast('error', 'Failed to add'); }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this record?')) return;
        try {
            await resumeService.deleteExperience(id);
            load();
            showToast('success', 'Deleted');
        } catch { showToast('error', 'Failed to delete'); }
    }

    return (
        <div className="rounded-[2.5rem] border border-outline glass-panel p-8 group transition-all duration-500 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface group-hover:scale-105 transition-transform"><Briefcase size={20} /></div>
                    <div><h3 className="text-sm font-bold text-on-surface">Work Experience</h3></div>
                </div>
                <button onClick={handleAdd} className="text-[10px] font-bold text-on-surface-variant/40 hover:text-on-surface uppercase tracking-wider transition-colors flex items-center gap-1"><Plus size={12} /> Add Experience</button>
            </div>
            <div className="space-y-4 flex-1">
                {loading ? <div className="text-on-surface-variant/30 text-xs">Loading...</div> : experiences.length === 0 ? <div className="text-on-surface-variant/40 text-xs text-center py-4">No work experience logged.</div> : experiences.map(exp => (
                    <div key={exp._id} className={`p-4 rounded-2xl bg-surface-container border border-outline-variant relative group/item ${!exp.current ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}`}>
                        <div className="flex items-center justify-between mb-1 pr-6">
                            <h4 className="text-xs font-bold text-on-surface truncate">{exp.role}</h4>
                            <span className={`text-[8px] font-bold uppercase tracking-widest ${exp.current ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>{exp.current ? 'Active' : 'Completed'}</span>
                        </div>
                        <p className="text-[9px] font-medium text-on-surface-variant/60 uppercase tracking-wider mb-1 truncate">{exp.company} • {exp.start_date} - {exp.current ? 'Present' : exp.end_date || 'Unknown'}</p>
                        <button onClick={() => handleDelete(exp._id!)} className="absolute top-4 right-4 text-on-surface-variant/20 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"><Trash2 size={12} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const SkillArsenal: React.FC = () => {
    const { showToast } = useToast();
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);
    const load = async () => {
        try { setSkills(await resumeService.getSkills()); }
        catch { showToast('error', 'Failed to load skills'); }
        finally { setLoading(false); }
    };

    const handleAdd = async () => {
        const name = prompt('Skill Name:');
        if (!name) return;
        try {
            await resumeService.createSkill({ name, level: 'intermediate', progress: 50, category: 'Technical' });
            load();
            showToast('success', 'Skill added');
        } catch { showToast('error', 'Failed to add'); }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this skill?')) return;
        try {
            await resumeService.deleteSkill(id);
            load();
            showToast('success', 'Deleted');
        } catch { showToast('error', 'Failed to delete'); }
    }

    return (
        <div className="rounded-[2.5rem] border border-outline glass-panel p-8 group transition-all duration-500 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface group-hover:scale-105 transition-transform"><Code size={20} /></div>
                    <div><h3 className="text-sm font-bold text-on-surface">Additional Skills</h3></div>
                </div>
                <button onClick={handleAdd} className="text-[10px] font-bold text-on-surface-variant/40 hover:text-on-surface uppercase tracking-wider transition-colors flex items-center gap-1"><Plus size={12} /> Add Skill</button>
            </div>
            <div className="flex flex-wrap gap-2 flex-1 content-start">
                {loading ? <div className="text-on-surface-variant/30 text-xs">Loading...</div> : skills.length === 0 ? <div className="text-on-surface-variant/40 text-xs text-center w-full py-4">No skills registered.</div> : skills.map(skill => (
                    <div key={skill._id} className="relative group/tag">
                        <span className="px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant text-[9px] font-semibold text-on-surface-variant uppercase tracking-wider hover:text-on-surface hover:border-outline transition-all cursor-default flex items-center gap-2">
                            {skill.name}
                            <button onClick={() => handleDelete(skill._id!)} className="text-on-surface-variant/20 hover:text-red-500 opacity-0 group-hover/tag:opacity-100 transition-opacity"><Trash2 size={10} /></button>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const MissionLogs: React.FC = () => {
    const { showToast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);
    const load = async () => {
        try { setProjects(await resumeService.getProjects()); }
        catch { showToast('error', 'Failed to load projects'); }
        finally { setLoading(false); }
    };

    const handleAdd = async () => {
        const name = prompt('Project Name:');
        if (!name) return;
        const description = prompt('Short Description:');
        if (!description) return;
        try {
            await resumeService.createProject({ name, description, current: true, technologies: [] });
            load();
            showToast('success', 'Project added');
        } catch { showToast('error', 'Failed to add'); }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this project?')) return;
        try {
            await resumeService.deleteProject(id);
            load();
            showToast('success', 'Deleted');
        } catch { showToast('error', 'Failed to delete'); }
    }

    return (
        <div className="rounded-[2.5rem] border border-outline glass-panel p-8 group flex flex-col h-full transition-all duration-500">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface"><Zap size={20} /></div>
                    <div><h3 className="text-sm font-bold text-on-surface">Projects</h3></div>
                </div>
                <button onClick={handleAdd} className="text-[10px] font-bold text-on-surface-variant/40 hover:text-on-surface uppercase tracking-wider transition-colors flex items-center gap-1"><Plus size={12} /> Add Project</button>
            </div>
            <div className="space-y-4 flex-1">
                {loading ? <div className="text-on-surface-variant/30 text-xs">Loading...</div> : projects.length === 0 ? <div className="text-on-surface-variant/40 text-xs text-center py-4">No projects recorded.</div> : projects.map(proj => (
                    <div key={proj._id} className="relative group/item flex items-center justify-between p-4 rounded-2xl border border-outline-variant bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer overflow-hidden">
                        <div className="min-w-0 pr-8">
                            <h4 className="text-xs font-bold text-on-surface mb-1 truncate">{proj.name}</h4>
                            <p className="text-[9px] font-medium text-on-surface-variant/60 uppercase tracking-wider truncate">{proj.description}</p>
                        </div>
                        <ChevronRight size={14} className="text-on-surface-variant/30 shrink-0 group-hover/item:opacity-0 transition-opacity" />
                        <button onClick={(e) => handleDelete(proj._id!, e)} className="absolute right-4 text-on-surface-variant/20 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all pl-2"><Trash2 size={14} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const StrategicHonors: React.FC = () => {
    const { showToast } = useToast();
    const [certs, setCerts] = useState<Certification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);
    const load = async () => {
        try { setCerts(await resumeService.getCertifications()); }
        catch { showToast('error', 'Failed to load certifications'); }
        finally { setLoading(false); }
    };

    const handleAdd = async () => {
        const name = prompt('Certification Name:');
        if (!name) return;
        const issuer = prompt('Issuing Organization:');
        if (!issuer) return;
        try {
            await resumeService.createCertification({ name, issuer });
            load();
            showToast('success', 'Certification added');
        } catch { showToast('error', 'Failed to add'); }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this certification?')) return;
        try {
            await resumeService.deleteCertification(id);
            load();
            showToast('success', 'Deleted');
        } catch { showToast('error', 'Failed to delete'); }
    }

    return (
        <div className="rounded-[2.5rem] border border-outline glass-panel p-8 group flex flex-col h-full transition-all duration-500">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface"><Award size={20} /></div>
                    <div><h3 className="text-sm font-bold text-on-surface">Certifications</h3></div>
                </div>
                <button onClick={handleAdd} className="text-[10px] font-bold text-on-surface-variant/40 hover:text-on-surface uppercase tracking-wider transition-colors flex items-center gap-1"><Plus size={12} /> Add Certification</button>
            </div>
            <div className="space-y-3 flex-1">
                {loading ? <div className="text-on-surface-variant/30 text-xs">Loading...</div> : certs.length === 0 ? <div className="text-on-surface-variant/40 text-xs text-center py-4">No certifications added yet.</div> : certs.map(cert => (
                    <div key={cert._id} className="group/item flex items-center justify-between gap-3 text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">
                        <div className="flex items-center gap-3 min-w-0">
                            <ShieldCheck size={12} className="text-on-surface-variant shrink-0" />
                            <span className="truncate">{cert.name} • {cert.issuer}</span>
                        </div>
                        <button onClick={() => handleDelete(cert._id!)} className="text-on-surface-variant/20 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};
