import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
    Rocket, ShieldCheck, Sparkles, Edit2, Trash, Plus
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { skillsService, type Skill } from '@/services/skills.service';
import api from '@/services/api';

const SKILL_CATEGORIES = [
    'Technical', 'Creative', 'Language', 'Professional', 'Life', 'Other'
];

const SKILL_LEVELS: Skill['level'][] = ['beginner', 'intermediate', 'advanced', 'expert'];

const LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
    beginner: { color: '#ffffff', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
    intermediate: { color: '#10b981', bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.1)' },
    advanced: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
    expert: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
};

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
        if (!formData.name) { showToast('error', 'Identity Required'); return; }
        
        const tempId = editingSkill?._id || `temp-${Date.now()}`;
        const updatedSkill: Skill = { ...formData, _id: tempId };
        
        // Optimistic Update
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
                showToast('success', 'Sequence Updated');
            } else {
                await skillsService.addSkill(formData);
                showToast('success', 'Sequence Initiated');
            }
            // Silent sync for truth (debounced for cache propagation)
            setTimeout(() => loadSkills(), 500);
        } catch {
            showToast('error', 'Operation Failed');
            setSkills(previousSkills); // Rollback
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Terminate this capability sequence?')) return;
        
        const previousSkills = [...skills];
        // Optimistic Update
        setSkills(prev => prev.filter(s => s._id !== id));

        try {
            await skillsService.deleteSkill(id);
            showToast('success', 'Sequence Terminated');
            // Silent sync for truth
            setTimeout(() => loadSkills(), 500);
        } catch { 
            showToast('error', 'Termination Failed');
            setSkills(previousSkills); // Rollback
        }
    };

    const filteredSkills = filter === 'all' ? skills : skills.filter(s => s.category === filter);

    return (
        <div className="pb-32 max-w-7xl mx-auto px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 relative rounded-[2.5rem] border border-white/[0.06] glass-panel p-8 md:p-12 overflow-hidden shadow-2xl" style={{ boxShadow: '0 0 80px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-white/10/[0.02] blur-[150px] pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                    <div className="text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-5 mb-5">
                            <div className="w-14 h-14 rounded-3xl bg-white/5 flex items-center justify-center text-white border border-white/10 shadow-lg shadow-white/5">
                                <Rocket size={28} />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none mb-1">Capability Matrix</h1>
                                <div className="flex items-center justify-center md:justify-start gap-2 text-white/60 font-mono text-[10px] uppercase tracking-[0.2em] font-black">
                                    <ShieldCheck size={12} className="animate-pulse" />
                                    Active Evolution: Node {skills.length}
                                </div>
                            </div>
                        </div>
                        <p className="text-white/30 font-bold text-xs md:text-sm tracking-[0.15em] uppercase max-w-lg leading-relaxed">Mapping professional aptitude and cognitive skill sets for mission-critical objectives.</p>
                    </div>

                    <Button icon={<Plus size={16} />} onClick={() => { setEditingSkill(null); setFormData({ name: '', category: 'Technical', level: 'beginner', progress: 0, notes: '' }); setIsModalOpen(true); }} className="h-14 px-8 rounded-2xl bg-white/10 text-white font-black tracking-widest uppercase text-xs hover:bg-white/20 shadow-xl shadow-white/10">New Capability</Button>
                </div>
            </motion.div>

            <div className="mb-10 flex gap-2 overflow-x-auto no-scrollbar pb-2">
                {['all', ...SKILL_CATEGORIES].map(cat => (
                    <button key={cat} onClick={() => { setFilter(cat); localStorage.setItem('zenith_skills_filter', cat); api.post('/api/profile/preferences', { skills_filter: cat }).catch(() => {}); }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${filter === cat ? 'bg-white/10 border-white/20 text-white shadow-lg shadow-white/10' : 'bg-white/5 border-white/[0.04] text-white/30 hover:bg-white/10 hover:text-white/60'}`}>
                        {cat}
                    </button>
                ))}
            </div>

            {loading ? <div className="flex justify-center py-20"><LoadingSpinner /></div> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {filteredSkills.map(skill => {
                            const cfg = LEVEL_CONFIG[skill.level] || LEVEL_CONFIG.beginner;
                            return (
                                <motion.div key={skill._id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                                    <div className="group relative rounded-[2.5rem] border border-white/[0.06] glass-panel p-8 h-full flex flex-col transition-all hover:bg-white/[0.01] hover:border-white/[0.12] shadow-xl overflow-hidden" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}>
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest" style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>{skill.level}</span>
                                                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{skill.category}</span>
                                                </div>
                                                <h3 className="text-xl font-black text-white tracking-tight uppercase group-hover:text-white transition-colors uppercase">{skill.name}</h3>
                                            </div>
                                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                                                <button onClick={() => { setEditingSkill(skill); setFormData({ ...skill }); setIsModalOpen(true); }} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transition-all border border-white/5"><Edit2 size={14} /></button>
                                                <button onClick={() => handleDelete(skill._id!)} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all border border-white/5"><Trash size={14} /></button>
                                            </div>
                                        </div>

                                        <p className="text-xs font-medium text-white/30 leading-relaxed mb-8 flex-1 italic">"{skill.notes || 'No intelligence data recorded'}"</p>

                                        <div className="mt-auto pt-6 border-t border-white/[0.04]">
                                            <div className="flex justify-between items-end mb-3">
                                                <div>
                                                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-0.5">Integration</p>
                                                    <p className="text-xs font-black text-white tracking-widest">{skill.progress}%</p>
                                                </div>
                                                <Sparkles size={14} className="text-white/20 group-hover:text-white transition-colors" />
                                            </div>
                                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden border border-white/[0.08]">
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${skill.progress}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-white via-white to-white/60 shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSkill ? 'Recalibrate' : 'Initiate'}>
                <div className="space-y-6">
                    <Input label="Capability Identifier" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Neural Networks" />
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Sector" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} options={SKILL_CATEGORIES.map(c => ({ value: c, label: c }))} />
                        <Select label="Phase" value={formData.level} onChange={e => setFormData({ ...formData, level: e.target.value as Skill['level'] })} options={SKILL_LEVELS.map(l => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) }))} />
                    </div>
                    <Input label="Description" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Enter capability details..." />
                    <div>
                        <div className="flex justify-between mb-3"><span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Efficiency</span><span className="text-xs font-black text-white">{formData.progress}%</span></div>
                        <input type="range" min="0" max="100" step="5" value={formData.progress} onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) })} className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-white" />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <Button variant="outlined" onClick={() => setIsModalOpen(false)} className="flex-1 uppercase tracking-widest text-[10px] font-black h-12">Abort</Button>
                        <Button onClick={handleSave} isLoading={isSaving} className="flex-1 uppercase tracking-widest text-[10px] font-black h-12 bg-white/10 text-white shadow-xl shadow-white/10">{editingSkill ? 'Commit' : 'Start'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default SkillTracker;
