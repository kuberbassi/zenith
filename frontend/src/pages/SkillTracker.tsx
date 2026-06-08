import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Edit2, Trash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { skillsService, type Skill } from '@/services/skills.service';
import api from '@/services/api';

const SKILL_CATEGORIES = [
    'Technical', 'Creative', 'Language', 'Professional', 'Life', 'Other'
];

const SKILL_LEVELS: Skill['level'][] = ['beginner', 'intermediate', 'advanced', 'expert'];

const NOTION_COLORS = [
    { bgLight: '#f1f1ef', textLight: '#37352f', borderLight: '#e9e9e6', bgDark: '#252525', textDark: '#9b9a97', borderDark: '#2a2a2a' }, // gray
    { bgLight: '#f8ecdf', textLight: '#c27c38', borderLight: '#f1dfcd', bgDark: '#3f2c1e', textDark: '#e79e50', borderDark: '#4d3826' }, // brown
    { bgLight: '#faebd9', textLight: '#d9730d', borderLight: '#f6d5b3', bgDark: '#432912', textDark: '#ffa344', borderDark: '#533418' }, // orange
    { bgLight: '#fbf3db', textLight: '#dfab01', borderLight: '#f7e3a6', bgDark: '#443d1a', textDark: '#ffdc4f', borderDark: '#564d23' }, // yellow
    { bgLight: '#eddffc', textLight: '#6940a5', borderLight: '#decbf7', bgDark: '#2d2238', textDark: '#b390e6', borderDark: '#3b2d49' }, // purple
    { bgLight: '#ebdff9', textLight: '#9065b0', borderLight: '#dfccf3', bgDark: '#301c3f', textDark: '#cfa6f3', borderDark: '#3d254f' }, // violet
    { bgLight: '#dff1eb', textLight: '#1d825c', borderLight: '#cbe7dc', bgDark: '#1a3229', textDark: '#52c49c', borderDark: '#234438' }, // green
    { bgLight: '#e0ecfc', textLight: '#0b6e99', borderLight: '#cbe0fa', bgDark: '#182f42', textDark: '#529cca', borderDark: '#223f59' }, // blue
    { bgLight: '#fbe4e4', textLight: '#c41d1d', borderLight: '#f6c7c7', bgDark: '#451a1a', textDark: '#ff7373', borderDark: '#572323' }, // red
    { bgLight: '#fdecf2', textLight: '#ad1a72', borderLight: '#fad0e2', bgDark: '#40182c', textDark: '#f26fb6', borderDark: '#512239' }, // pink
];

export function getNotionTagStyles(text: string) {
    if (!text) return { className: '', style: {} };
    let hash = 0;
    const cleanText = text.trim();
    for (let i = 0; i < cleanText.length; i++) {
        hash = cleanText.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % NOTION_COLORS.length;
    const color = NOTION_COLORS[idx];
    return {
        style: {
            '--tag-bg-light': color.bgLight,
            '--tag-text-light': color.textLight,
            '--tag-border-light': color.borderLight,
            '--tag-bg-dark': color.bgDark,
            '--tag-text-dark': color.textDark,
            '--tag-border-dark': color.borderDark,
        } as React.CSSProperties,
        className: 'bg-[var(--tag-bg-light)] dark:bg-[var(--tag-bg-dark)] text-[var(--tag-text-light)] dark:text-[var(--tag-text-dark)] border border-[var(--tag-border-light)] dark:border-[var(--tag-border-dark)]'
    };
}

export function getLevelTagStyles(level: string) {
    const lvl = (level || 'beginner').toLowerCase();
    switch (lvl) {
        case 'beginner':
            return {
                className: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50'
            };
        case 'intermediate':
            return {
                className: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/40 dark:border-blue-900/30'
            };
        case 'advanced':
            return {
                className: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/40 dark:border-amber-900/30'
            };
        case 'expert':
            return {
                className: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/40 dark:border-emerald-900/30'
            };
        default:
            return {
                className: 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50'
            };
    }
}

const SkillTracker: React.FC = () => {
    const { showToast } = useToast();
    const [skills, setSkills] = useState<Skill[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [filter, setFilter] = useState(() => localStorage.getItem('zenith_skills_filter') || 'all');

    usePageMeta({
        title: 'Skill Tracker | Zenith',
        description: 'Log and track your technical and soft skills. Monitor progress and set learning milestones.',
    });

    const [formData, setFormData] = useState<Omit<Skill, '_id'>>({
        name: '', category: 'Technical', level: 'beginner', progress: 0, notes: ''
    });

    useEffect(() => { loadSkills(); }, []);

    const loadSkills = async () => {
        try {
            setLoading(true);
            const data = await skillsService.getSkills();
            const skillsList = Array.isArray(data) ? data : (data as any).skills || [];
            setSkills(skillsList.map((s: any) => ({ ...s, _id: s._id || s.id })));
        } catch (error) {
            showToast('error', 'Sync Failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.name) { showToast('error', 'Skill name is required'); return; }
        
        const tempId = editingSkill?._id || `temp-${Date.now()}`;
        const updatedSkill: Skill = { ...formData, _id: tempId };
        
        const previousSkills = [...skills];
        if (editingSkill) {
            setSkills(prev => prev.map(s => s._id === editingSkill._id ? updatedSkill : s));
        } else {
            setSkills(prev => [updatedSkill, ...prev]);
        }
        
        setIsModalOpen(false);

        try {
            setIsSaving(true);
            if (editingSkill?._id) {
                await skillsService.updateSkill(editingSkill._id, formData);
                showToast('success', 'Skill updated successfully');
            } else {
                await skillsService.addSkill(formData);
                showToast('success', 'Skill added successfully');
            }
            setTimeout(() => loadSkills(), 500);
        } catch {
            showToast('error', 'Operation Failed');
            setSkills(previousSkills);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this skill?')) return;
        
        const previousSkills = [...skills];
        setSkills(prev => prev.filter(s => s._id !== id));

        try {
            await skillsService.deleteSkill(id);
            showToast('success', 'Skill deleted successfully');
            setTimeout(() => loadSkills(), 500);
        } catch { 
            showToast('error', 'Deletion Failed');
            setSkills(previousSkills);
        }
    };

    const filteredSkills = filter === 'all' ? skills : skills.filter(s => s.category === filter);

    return (
        <div className="w-full max-w-5xl mx-auto pb-24 select-none">
            {/* Page Header */}
            <div className="mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">
                    Development / Skills
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Skills</h1>
                        <p className="text-xs text-on-surface-variant/40 mt-0.5">{skills.length} skills tracked</p>
                    </div>
                    <button
                        onClick={() => { setEditingSkill(null); setFormData({ name: '', category: 'Technical', level: 'beginner', progress: 0, notes: '' }); setIsModalOpen(true); }}
                        className="h-9 w-full sm:w-auto px-3 text-xs font-bold rounded bg-on-surface text-surface hover:opacity-90 transition-all cursor-pointer"
                    >
                        Add Skill
                    </button>
                </div>
                {/* Category tab bar */}
                <div className="flex gap-0 border-b border-outline mt-4 overflow-x-auto no-scrollbar">
                    {['all', ...SKILL_CATEGORIES].map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setFilter(cat); localStorage.setItem('zenith_skills_filter', cat); api.post('/api/profile/preferences', { skills_filter: cat }).catch(() => {}); }}
                            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap capitalize cursor-pointer ${
                                filter === cat
                                    ? 'border-on-surface text-on-surface'
                                    : 'border-transparent text-on-surface-variant/40 hover:text-on-surface-variant hover:border-outline'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                /* Non-blocking loader list */
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse h-16 bg-surface-container border border-outline rounded-lg" />
                    ))}
                </div>
            ) : (
                    <div className="border border-outline rounded-lg overflow-hidden bg-surface">
                    <AnimatePresence>
                        {filteredSkills.length === 0 ? (
                            <div className="py-20 text-center">
                                <p className="text-xs font-bold text-on-surface-variant/30 uppercase tracking-wider">No skills in this category</p>
                            </div>
                        ) : filteredSkills.map((skill, idx) => {
                            const levelTag = getLevelTagStyles(skill.level);
                            const catTag = getNotionTagStyles(skill.category);
                            return (
                                <motion.div
                                    key={skill._id}
                                    layout
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className={`group flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 sm:p-5 hover:bg-surface-container transition-all ${idx < filteredSkills.length - 1 ? 'border-b border-outline' : ''}`}
                                >
                                    {/* Mobile View Layout */}
                                    <div className="flex flex-col gap-2.5 w-full md:hidden">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-bold text-on-surface break-words">{skill.name}</p>
                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full text-center leading-tight ${levelTag.className}`}>
                                                        {skill.level}
                                                    </span>
                                                    <span style={catTag.style} className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider leading-tight ${catTag.className}`}>
                                                        {skill.category}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button aria-label={`Edit ${skill.name}`} onClick={() => { setEditingSkill(skill); setFormData({ ...skill }); setIsModalOpen(true); }} className="no-fluid h-8 w-8 flex items-center justify-center rounded border border-outline bg-surface text-on-surface-variant hover:bg-surface-container transition-all cursor-pointer">
                                                    <Edit2 size={11} />
                                                </button>
                                                <button aria-label={`Delete ${skill.name}`} onClick={() => handleDelete(skill._id!)} className="no-fluid h-8 w-8 flex items-center justify-center rounded border border-outline bg-surface text-red-500/60 hover:text-red-500 hover:bg-red-500/5 transition-all cursor-pointer">
                                                    <Trash size={11} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 w-full mt-1">
                                            <div className="flex-1 h-1 bg-on-surface/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-on-surface" style={{ width: `${skill.progress}%` }} />
                                            </div>
                                            <span className="text-[10px] font-bold text-on-surface-variant/50 w-8 text-right shrink-0">{skill.progress}%</span>
                                        </div>
                                    </div>

                                    {/* Desktop View Layout */}
                                    <div className="hidden md:flex flex-1 items-center justify-between w-full">
                                        <div className="flex flex-1 items-center gap-3 min-w-0">
                                            {/* Name + tags */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-on-surface truncate">{skill.name}</p>
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full text-center shrink-0 ${levelTag.className}`}>
                                                        {skill.level}
                                                    </span>
                                                    <span style={catTag.style} className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${catTag.className}`}>
                                                        {skill.category}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress */}
                                        <div className="flex items-center gap-3 w-36 shrink-0">
                                            <div className="flex-1 h-1 bg-on-surface/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-on-surface" style={{ width: `${skill.progress}%` }} />
                                            </div>
                                            <span className="text-[10px] font-bold text-on-surface-variant/50 w-8 text-right shrink-0">{skill.progress}%</span>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5 shrink-0 ml-4">
                                            <button aria-label={`Edit ${skill.name}`} onClick={() => { setEditingSkill(skill); setFormData({ ...skill }); setIsModalOpen(true); }} className="no-fluid h-7 w-7 flex items-center justify-center rounded border border-outline bg-surface text-on-surface-variant hover:bg-surface-container transition-all cursor-pointer">
                                                <Edit2 size={11} />
                                            </button>
                                            <button aria-label={`Delete ${skill.name}`} onClick={() => handleDelete(skill._id!)} className="no-fluid h-7 w-7 flex items-center justify-center rounded border border-outline bg-surface text-red-500/60 hover:text-red-500 hover:bg-red-500/5 transition-all cursor-pointer">
                                                <Trash size={11} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSkill ? 'Edit Skill' : 'Add Skill'}>
                <div className="space-y-6 pt-4 text-on-surface select-none">
                    <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant/40 uppercase mb-3 ml-1">Skill Name</label>
                        <Input type="text" placeholder="e.g., UI/UX Design" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Select label="Category" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} options={SKILL_CATEGORIES.map(c => ({ value: c, label: c }))} />
                        <Select label="Current Level" value={formData.level} onChange={e => setFormData({ ...formData, level: e.target.value as any })} options={SKILL_LEVELS.map(l => ({ value: l, label: l.toUpperCase() }))} />
                    </div>
                    <div>
                        <div className="flex justify-between mb-3"><span className="text-[10px] font-bold text-on-surface-variant/40 uppercase">Progress</span><span className="text-xs font-bold text-on-surface">{formData.progress}%</span></div>
                        <input type="range" min="0" max="100" value={formData.progress} onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })} className="w-full accent-primary h-1 bg-on-surface/15 rounded-full appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant/40 uppercase mb-3 ml-1">Additional Notes</label>
                        <textarea placeholder="Write brief notes or milestones..." value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full min-h-[100px] p-4 text-sm bg-surface border border-outline rounded-lg focus:outline-none focus:border-on-surface transition-all text-on-surface placeholder-on-surface-variant/30" />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                        <Button variant="outlined" onClick={() => setIsModalOpen(false)} className="flex-1 uppercase tracking-wider text-xs font-bold h-12">Cancel</Button>
                        <Button onClick={handleSave} isLoading={isSaving} className="flex-1 uppercase tracking-wider text-xs font-bold h-12 bg-on-surface text-surface hover:opacity-90">{editingSkill ? 'Save' : 'Add'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SkillTracker;
