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
        <div className="rounded-[2.5rem] border border-white/[0.06] glass-panel p-8 group hover:border-white/10 transition-all duration-500 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white group-hover:scale-110 transition-transform"><Briefcase size={20} /></div>
                    <div><h3 className="text-sm font-black text-white tracking-tight uppercase">Tactical Ops</h3></div>
                </div>
                <button onClick={handleAdd} className="text-[10px] font-black text-white/20 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1"><Plus size={12} /> Add Log</button>
            </div>
            <div className="space-y-4 flex-1">
                {loading ? <div className="text-white/20 text-xs">Loading...</div> : experiences.length === 0 ? <div className="text-white/20 text-xs text-center py-4">No tactical operations logged.</div> : experiences.map(exp => (
                    <div key={exp._id} className={`p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] relative group/item ${!exp.current ? 'opacity-50 hover:opacity-100 transition-opacity' : ''}`}>
                        <div className="flex items-center justify-between mb-1 pr-6">
                            <h4 className="text-xs font-black text-white uppercase truncate">{exp.role}</h4>
                            <span className={`text-[8px] font-bold uppercase tracking-widest ${exp.current ? 'text-white' : 'text-white/20'}`}>{exp.current ? 'Active' : 'Completed'}</span>
                        </div>
                        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1 truncate">{exp.company} • {exp.start_date} - {exp.current ? 'Present' : exp.end_date || 'Unknown'}</p>
                        <button onClick={() => handleDelete(exp._id!)} className="absolute top-4 right-4 text-white/10 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all"><Trash2 size={12} /></button>
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
        <div className="rounded-[2.5rem] border border-white/[0.06] glass-panel p-8 group hover:border-white/10 transition-all duration-500 flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white group-hover:scale-110 transition-transform"><Code size={20} /></div>
                    <div><h3 className="text-sm font-black text-white tracking-tight uppercase">Skill Arsenal</h3></div>
                </div>
                <button onClick={handleAdd} className="text-[10px] font-black text-white/20 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1"><Plus size={12} /> Adjust</button>
            </div>
            <div className="flex flex-wrap gap-2 flex-1 content-start">
                {loading ? <div className="text-white/20 text-xs">Loading...</div> : skills.length === 0 ? <div className="text-white/20 text-xs text-center w-full py-4">No skills registered.</div> : skills.map(skill => (
                    <div key={skill._id} className="relative group/tag">
                        <span className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-[9px] font-black text-white/40 uppercase tracking-wider hover:text-white hover:border-white/20 transition-all cursor-default flex items-center gap-2">
                            {skill.name}
                            <button onClick={() => handleDelete(skill._id!)} className="text-white/10 hover:text-red-400 opacity-0 group-hover/tag:opacity-100 transition-opacity"><Trash2 size={10} /></button>
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
        <div className="rounded-[2.5rem] border border-white/[0.06] glass-panel p-8 group flex flex-col h-full hover:border-white/10 transition-all duration-500">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white"><Zap size={20} /></div>
                    <div><h3 className="text-sm font-black text-white tracking-tight uppercase">Mission Logs</h3></div>
                </div>
                <button onClick={handleAdd} className="text-[10px] font-black text-white/20 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1"><Plus size={12} /> Deploy</button>
            </div>
            <div className="space-y-4 flex-1">
                {loading ? <div className="text-white/20 text-xs">Loading...</div> : projects.length === 0 ? <div className="text-white/20 text-xs text-center py-4">No deployments recorded.</div> : projects.map(proj => (
                    <div key={proj._id} className="relative group/item flex items-center justify-between p-4 rounded-2xl border border-white/[0.04] bg-white/[0.01] hover:bg-white/10/[0.02] hover:border-white/10 transition-all cursor-pointer overflow-hidden">
                        <div className="min-w-0 pr-8">
                            <h4 className="text-xs font-black text-white uppercase mb-1 truncate">{proj.name}</h4>
                            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest truncate">{proj.description}</p>
                        </div>
                        <ChevronRight size={14} className="text-white/10 shrink-0 group-hover/item:opacity-0 transition-opacity" />
                        <button onClick={(e) => handleDelete(proj._id!, e)} className="absolute right-4 text-white/10 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all glass-panel pl-2"><Trash2 size={14} /></button>
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
        <div className="rounded-[2.5rem] border border-white/[0.06] glass-panel p-8 group flex flex-col h-full hover:border-white/10 transition-all duration-500">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white"><Award size={20} /></div>
                    <div><h3 className="text-sm font-black text-white tracking-tight uppercase">Strategic Honors</h3></div>
                </div>
                <button onClick={handleAdd} className="text-[10px] font-black text-white/20 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1"><Plus size={12} /> Import</button>
            </div>
            <div className="space-y-3 flex-1">
                {loading ? <div className="text-white/20 text-xs">Loading...</div> : certs.length === 0 ? <div className="text-white/20 text-xs text-center py-4">No honors acquired yet.</div> : certs.map(cert => (
                    <div key={cert._id} className="group/item flex items-center justify-between gap-3 text-[10px] font-bold text-white/40 uppercase tracking-tighter">
                        <div className="flex items-center gap-3 min-w-0">
                            <ShieldCheck size={12} className="text-white/40 shrink-0" />
                            <span className="truncate">{cert.name} • {cert.issuer}</span>
                        </div>
                        <button onClick={() => handleDelete(cert._id!)} className="text-white/10 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};
