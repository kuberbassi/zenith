import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Plus, Minus, Edit2, Target, FlaskConical } from 'lucide-react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import { useSemester } from '@/contexts/SemesterContext';
import type { Subject } from '@/types';
import EditSubjectModal from '@/components/modals/EditSubjectModal';

const Practicals: React.FC = () => {
    const { showToast } = useToast();
    const { currentSemester } = useSemester();
    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

    usePageMeta({
        title: 'Assignments & Practicals | Zenith',
        description: 'Track practical records and assignment milestones across all your subjects.',
    });

    useEffect(() => { loadData(); }, [currentSemester]);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await attendanceService.getFullSubjectsData(currentSemester);
            setSubjects(data);
        } catch (error) {
            console.error(error);
            showToast('error', 'Sync Failed');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (id: string | any, updates: { total?: number; completed?: number; hardcopy?: boolean }) => {
        const subjectId = String(id);
        const previous = [...subjects];
        setSubjects((prev: Subject[]) => prev.map(sub => {
            const subId = String(sub._id || (sub as any).id);
            if (subId === subjectId) {
                const current = sub.practicals || { total: 10, completed: 0, hardcopy: false };
                return {
                    ...sub, practicals: {
                        ...current, ...updates,
                        total: updates.total ?? current.total,
                        completed: updates.completed ?? current.completed,
                        hardcopy: updates.hardcopy ?? current.hardcopy
                    }
                };
            }
            return sub;
        }));
        try {
            await attendanceService.updatePracticals(subjectId, updates);
            showToast('success', 'Records Updated');
        } catch {
            setSubjects(previous);
            showToast('error', 'Update Error');
        }
    };

    const handleAssignmentUpdate = async (id: string | any, updates: { total?: number; completed?: number; hardcopy?: boolean }) => {
        const subjectId = String(id);
        const previous = [...subjects];
        setSubjects((prev: Subject[]) => prev.map(sub => {
            const subId = String(sub._id || (sub as any).id);
            if (subId === subjectId) {
                const current = sub.assignments || { total: 4, completed: 0 };
                return {
                    ...sub, assignments: {
                        ...current, ...updates,
                        total: updates.total ?? current.total,
                        completed: updates.completed ?? current.completed,
                        hardcopy: updates.hardcopy ?? (current as any).hardcopy
                    }
                };
            }
            return sub;
        }));
        try {
            await attendanceService.updateAssignments(subjectId, updates);
            showToast('success', 'Assignments Updated');
        } catch {
            setSubjects(previous);
            showToast('error', 'Update Error');
        }
    };

    const filteredSubjects = subjects.filter(sub => {
        const cats = sub.categories || (sub.category ? [sub.category] : ['Theory']);
        const hasWork = cats.includes('Practical') || cats.includes('Assignment');
        if (!hasWork) return false;
        if (selectedCategory === 'All') return true;
        return cats.includes(selectedCategory);
    });

    const categories = ['All', 'Theory', 'Practical', 'Assignment'];

    if (loading) return <LoadingSpinner fullScreen />;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto pb-32">

            {/* ── Cinematic Hero ────────────────────────────────────────── */}
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-12 relative rounded-[2rem] border border-white/[0.06] glass-panel p-8 md:p-12 overflow-hidden shadow-2xl group transition-all duration-700">
                <div className="absolute inset-0 bg-white/10/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10/[0.03] blur-[150px] pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                    <div>
                        <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white border border-white/10 shadow-lg shadow-white/5">
                                <FlaskConical size={24} />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Mission Execution</h1>
                        </div>
                        <p className="text-white/40 font-medium max-w-md">Track your practical records and assignment milestones in ultra-stealth mode.</p>
                    </div>
                    <div className="flex gap-1.5 md:gap-4 p-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
                        {categories.map(cat => (
                            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${selectedCategory === cat ? 'bg-white/10 text-white shadow-xl shadow-white/10' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}>{cat}</button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* ── Subject Grid ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredSubjects.map((subject, index) => {
                        const cats = subject.categories || (subject.category ? [subject.category] : ['Theory']);
                        const hasPracticals = cats.includes('Practical');
                        const hasAssignments = cats.includes('Assignment');
                        const p = subject.practicals || { total: 10, completed: 0, hardcopy: false };
                        const a = subject.assignments || { total: 4, completed: 0, hardcopy: false };

                        let total = 0; let done = 0;
                        if (hasPracticals) { total += p.total; done += p.completed; }
                        if (hasAssignments) { total += a.total; done += a.completed; }
                        const progress = total > 0 ? (done / total) * 100 : 0;

                        return (
                            <motion.div key={subject._id as any} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1 }} transition={{ delay: index * 0.05 }} className="group">
                                <div className="h-full rounded-3xl border border-white/[0.06] glass-panel p-6 relative overflow-hidden transition-all hover:bg-[#0c0c0c] hover:border-white/[0.1] shadow-xl" style={{ boxShadow: '0 20px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                    <div className="absolute top-0 left-0 h-1 bg-white/[0.03] w-full"><motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.4)]" /></div>

                                    <div className="flex justify-between items-start mb-6 pt-4">
                                        <div className="min-w-0">
                                            <h3 className="text-lg font-black text-white/90 truncate pr-2 group-hover:text-white transition-colors uppercase tracking-tight">{subject.name}</h3>
                                            <div className="flex gap-2 mt-2">
                                                {cats.filter(c => c !== 'Theory' && c !== 'Project').map(c => (
                                                    <span key={c} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-black text-white uppercase tracking-widest">{c}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={() => setEditingSubject(subject)} className="w-8 h-8 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition-all"><Edit2 size={14} /></button>
                                    </div>

                                    <div className="space-y-6">
                                        {hasPracticals && (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center"><span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Practicals</span><span className="text-[10px] font-black text-white font-mono tracking-widest">{p.completed}/{p.total}</span></div>
                                                <div className="flex gap-2">
                                                    <Button variant="secondary" className="flex-1 h-9 rounded-xl border-white/[0.04]" disabled={p.completed <= 0} onClick={() => handleUpdate(subject._id, { completed: p.completed - 1 })}><Minus size={14} /></Button>
                                                    <Button variant="primary" className="flex-1 h-9 rounded-xl bg-white/10 shadow-lg shadow-white/10" disabled={p.completed >= p.total} onClick={() => handleUpdate(subject._id, { completed: p.completed + 1 })}><Plus size={14} /></Button>
                                                </div>
                                                <button onClick={() => handleUpdate(subject._id, { hardcopy: !p.hardcopy })} className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${p.hardcopy ? 'bg-white/5 text-white border border-white/10 shadow-[inset_0_1px_20px_rgba(255,255,255,0.05)]' : 'bg-white/[0.02] border border-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/5'}`}>{p.hardcopy ? <><CheckCircle size={14} /> Submitted</> : <><Target size={14} /> Mark Submitted</>}</button>
                                            </div>
                                        )}

                                        {hasPracticals && hasAssignments && <div className="h-px bg-white/[0.03]" />}

                                        {hasAssignments && (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center"><span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Assignments</span><span className="text-[10px] font-black text-white font-mono tracking-widest">{a.completed}/{a.total}</span></div>
                                                <div className="flex gap-2">
                                                    <Button variant="secondary" className="flex-1 h-9 rounded-xl border-white/[0.04]" disabled={a.completed <= 0} onClick={() => handleAssignmentUpdate(subject._id, { completed: a.completed - 1 })}><Minus size={14} /></Button>
                                                    <Button variant="primary" className="flex-1 h-9 rounded-xl bg-white/10 shadow-lg shadow-white/10" disabled={a.completed >= a.total} onClick={() => handleAssignmentUpdate(subject._id, { completed: a.completed + 1 })}><Plus size={14} /></Button>
                                                </div>
                                                <button onClick={() => handleAssignmentUpdate(subject._id, { hardcopy: !a.hardcopy })} className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${a.hardcopy ? 'bg-white/5 text-white border border-white/10 shadow-[inset_0_1px_20px_rgba(255,255,255,0.05)]' : 'bg-white/[0.02] border border-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/5'}`}>{a.hardcopy ? <><CheckCircle size={14} /> Submitted</> : <><Target size={14} /> Mark Submitted</>}</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {editingSubject && <EditSubjectModal isOpen={!!editingSubject} onClose={() => setEditingSubject(null)} subject={editingSubject} onSuccess={loadData} />}
        </motion.div>
    );
};

export default Practicals;
