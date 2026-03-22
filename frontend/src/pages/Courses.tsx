import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ExternalLink, Trash, Edit2, Award,
    TrendingUp, Book, Globe, Video, BookOpen, GraduationCap, Clock
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';

interface Course {
    _id?: string;
    title: string;
    platform: 'coursera' | 'udemy' | 'youtube' | 'edx' | 'linkedin' | 'college' | 'custom';
    url: string;
    progress: number;
    enrolledDate: string;
    targetCompletionDate?: string;
    instructor?: string;
    notes?: string;
}

const normalizeCourse = (raw: any): Course => ({
    _id: String(raw?._id || raw?.id || ''),
    title: String(raw?.title || raw?.name || '').trim(),
    platform: (raw?.platform || raw?.provider || 'custom') as Course['platform'],
    url: String(raw?.url || ''),
    progress: Number(raw?.progress ?? raw?.percentage ?? 0),
    enrolledDate: String(raw?.enrolledDate || raw?.created_at || new Date().toISOString().split('T')[0]).slice(0, 10),
    targetCompletionDate: raw?.targetCompletionDate ? String(raw.targetCompletionDate).slice(0, 10) : undefined,
    instructor: raw?.instructor ? String(raw.instructor) : undefined,
    notes: raw?.notes ? String(raw.notes) : undefined,
});

function getCourseId(course: Course): string {
    return course._id || '';
}

const PLATFORMS = [
    { value: 'coursera', label: 'Coursera', icon: Globe, color: 'bg-white/20' },
    { value: 'udemy', label: 'Udemy', icon: Video, color: 'bg-purple-600' },
    { value: 'youtube', label: 'YouTube', icon: Video, color: 'bg-red-600' },
    { value: 'custom', label: 'Custom', icon: Globe, color: 'bg-zinc-600' },
];

const Courses: React.FC = () => {
    const { showToast } = useToast();
    const [courses, setCourses] = useState<Course[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    usePageMeta({
        title: 'Courses | AcadHub',
        description: 'Track your enrolled courses, progress, and learning milestones all in one place.',
    });
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [formData, setFormData] = useState<Partial<Course>>({
        title: '', platform: 'coursera', url: '', progress: 0,
        enrolledDate: new Date().toISOString().split('T')[0],
        instructor: '', notes: ''
    });

    useEffect(() => { loadCourses(); }, []);

    const loadCourses = async () => {
        try {
            const data = await attendanceService.getManualCourses();
            setCourses(Array.isArray(data) ? data.map(normalizeCourse).filter((c: Course) => c.title || c.url) : []);
        } catch { showToast('error', 'Sync Failed'); }
    };

    const handleAddCourse = () => {
        setEditingCourse(null);
        setFormData({ title: '', platform: 'coursera', url: '', progress: 0, enrolledDate: new Date().toISOString().split('T')[0], instructor: '', notes: '' });
        setIsModalOpen(true);
    };

    const handleEditCourse = (course: Course) => {
        setEditingCourse(course);
        setFormData(course);
        setIsModalOpen(true);
    };

    const handleDeleteCourse = async (id: string) => {
        if (!confirm('Permanent Erasure: Delete this course?')) return;
        const previous = courses;
        const updated = courses.filter(c => getCourseId(c) !== id);
        setCourses(updated);
        try {
            await attendanceService.deleteManualCourse(id);
            showToast('success', 'Course Purged');
        } catch {
            setCourses(previous);
            showToast('error', 'Save Failed');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCourse) {
            const previous = courses;
            const updated = courses.map(c => getCourseId(c) === getCourseId(editingCourse) ? { ...c, ...formData } : c);
            setCourses(updated);
            try {
                await attendanceService.updateManualCourse(getCourseId(editingCourse), formData);
                showToast('success', 'Profile Updated');
            } catch {
                setCourses(previous);
                showToast('error', 'Save Failed');
            }
        } else {
            const previous = courses;
            const newCourse = { ...formData, _id: Date.now().toString() } as Course;
            const next = [...courses, newCourse];
            setCourses(next);
            try {
                await attendanceService.addManualCourse(formData);
                await loadCourses();
                showToast('success', 'Course Initialized');
            } catch {
                setCourses(previous);
                showToast('error', 'Save Failed');
            }
        }
        setIsModalOpen(false);
    };

    const activeCourses = courses.filter(c => c.progress < 100);
    const completedCourses = courses.filter(c => c.progress === 100);

    const inputCls = "w-full px-5 py-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 focus:ring-4 focus:ring-white/10 transition-all";

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto pb-32">

            {/* ── Cinematic Hero ────────────────────────────────────────── */}
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-12 relative rounded-[2rem] border border-white/[0.06] glass-panel p-8 md:p-12 overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10/[0.03] blur-[150px] pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                    <div className="flex-1">
                        <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white border border-white/10 shadow-lg shadow-white/5"><BookOpen size={24} /></div>
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Intelligence Archive</h1>
                        </div>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-6">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                <TrendingUp size={14} className="text-white" />
                                <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">{activeCourses.length} Active Tracks</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                <Award size={14} className="text-white" />
                                <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">{completedCourses.length} Completed Tracks</span>
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleAddCourse} className="h-14 px-8 rounded-2xl bg-white/10 text-white font-black uppercase tracking-widest shadow-2xl shadow-white/10 hover:scale-105 active:scale-95 transition-all">Initialize Track</Button>
                </div>
            </motion.div>

            {/* ── Active Tracks ─────────────────────────────────────────── */}
            {activeCourses.length > 0 && (
                <section className="mb-16">
                    <div className="flex items-center gap-3 mb-8 px-2">
                        <div className="h-px flex-1 bg-white/[0.04]" />
                        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20">Operational Tracks</h2>
                        <div className="h-px flex-1 bg-white/[0.04]" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        <AnimatePresence>
                            {activeCourses.map((course, idx) => {
                                const plat = PLATFORMS.find(p => p.value === course.platform) || PLATFORMS[3];
                                const P_Icon = plat.icon;
                                return (
                                    <motion.div key={getCourseId(course)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="group">
                                        <div className="h-full rounded-3xl border border-white/[0.06] glass-panel p-6 relative overflow-hidden transition-all hover:bg-[#0c0c0c] hover:border-white/[0.1] shadow-xl flex flex-col" style={{ boxShadow: '0 20px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                            <div className="flex items-center justify-between mb-6">
                                                <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${plat.color} text-white text-[9px] font-black uppercase tracking-widest`}><P_Icon size={12} /> {plat.label}</div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditCourse(course)} className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/20 hover:text-white hover:bg-white/5"><Edit2 size={12} /></button>
                                                    <button onClick={() => void handleDeleteCourse(getCourseId(course))} className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/20 hover:text-red-500 hover:bg-red-500/5"><Trash size={12} /></button>
                                                </div>
                                            </div>
                                            <h3 className="text-xl font-black text-white/90 mb-2 truncate group-hover:text-white transition-colors uppercase tracking-tight">{course.title}</h3>
                                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-6 flex items-center gap-2"><GraduationCap size={12} />{course.instructor || 'Lead Architect'}</p>
                                            <div className="mb-8">
                                                <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Synchronization</span><span className="text-[10px] font-black text-white font-mono tracking-widest">{course.progress}%</span></div>
                                                <div className="h-1.5 w-full bg-white/[0.02] rounded-full overflow-hidden border border-white/[0.04]"><motion.div initial={{ width: 0 }} animate={{ width: `${course.progress}%` }} className="h-full bg-white/10 shadow-[0_0_10px_rgba(255,255,255,0.3)]" /></div>
                                            </div>
                                            {course.targetCompletionDate && <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-widest mb-6"><Clock size={12} /> Est. Completion: {new Date(course.targetCompletionDate).toLocaleDateString()}</div>}
                                            <div className="mt-auto flex gap-3">
                                                <Button variant="secondary" onClick={() => window.open(course.url, '_blank')} className="flex-1 h-11 rounded-xl border-white/[0.04] text-[10px] font-black uppercase tracking-widest">Open</Button>
                                                <Button variant="primary" onClick={() => {
                                                    const previous = courses;
                                                    const updated = courses.map(c => getCourseId(c) === getCourseId(course) ? { ...c, progress: Math.min(100, c.progress + 10) } : c);
                                                    setCourses(updated);
                                                    void attendanceService.updateManualCourse(getCourseId(course), { progress: Math.min(100, course.progress + 10) }).catch(() => {
                                                        setCourses(previous);
                                                        showToast('error', 'Save Failed');
                                                    });
                                                }} className="flex-1 h-11 rounded-xl shadow-lg shadow-white/10 text-[10px] font-black uppercase tracking-widest">+10% Sync</Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </section>
            )}

            {/* ── Completed Tracks ──────────────────────────────────────── */}
            {completedCourses.length > 0 && (
                <section>
                    <div className="flex items-center gap-3 mb-8 px-2">
                        <div className="h-px flex-1 bg-white/[0.04]" />
                        <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Completed Tracks</h2>
                        <div className="h-px flex-1 bg-white/[0.04]" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {completedCourses.map(course => (
                            <div key={getCourseId(course)} className="group p-5 rounded-3xl border border-white/[0.04] glass-panel transition-all hover:glass-panel opacity-60 hover:opacity-100">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10"><Award size={16} /></div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                                        <button onClick={() => handleEditCourse(course)} className="p-1.5 text-white/20 hover:text-white transition-colors"><Edit2 size={12} /></button>
                                        <button onClick={() => void handleDeleteCourse(getCourseId(course))} className="p-1.5 text-white/20 hover:text-red-500 transition-colors"><Trash size={12} /></button>
                                    </div>
                                </div>
                                <h4 className="text-xs font-black text-white/80 line-clamp-2 uppercase tracking-tight mb-4">{course.title}</h4>
                                <button onClick={() => window.open(course.url, '_blank')} className="w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-white hover:text-white transition-all text-left flex items-center gap-2">Open Course <ExternalLink size={10} /></button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Empty State ───────────────────────────────────────────── */}
            {courses.length === 0 && (
                <div className="rounded-[3rem] border-2 border-dashed border-white/[0.04] bg-white/[0.01] p-24 text-center">
                    <div className="w-20 h-20 rounded-[2rem] bg-white/[0.02] border border-white/[0.04] flex items-center justify-center text-white/10 mx-auto mb-8"><Book size={40} /></div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Archive Vacant</h3>
                    <p className="text-white/20 font-medium mb-12 max-w-sm mx-auto">No intelligence tracks have been initialized. Commencing primary tracking protocols recommended.</p>
                    <Button onClick={handleAddCourse} className="h-14 px-10 rounded-2xl bg-white/10 text-white font-black uppercase tracking-widest shadow-2xl shadow-white/10">Begin Archive</Button>
                </div>
            )}

            {/* ── Modal ─────────────────────────────────────────────────── */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCourse ? 'Calibrate Track' : 'Initialize New Track'}>
                <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                    <div><label className="block text-[10px] font-black text-white/20 uppercase tracking-widest mb-3 ml-1">Track Title</label><input type="text" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} className={inputCls} placeholder="e.g., Cryptography Protocols" required /></div>
                    <div className="grid grid-cols-2 gap-6">
                        <Select label="Platform" value={formData.platform || 'coursera'} onChange={e => setFormData({ ...formData, platform: e.target.value as any })} options={PLATFORMS.map(p => ({ value: p.value, label: p.label }))} />
                        <div><label className="block text-[10px] font-black text-white/20 uppercase tracking-widest mb-3 ml-1">Archive URL</label><input type="url" value={formData.url || ''} onChange={e => setFormData({ ...formData, url: e.target.value })} className={inputCls} placeholder="https://..." required /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div><label className="block text-[10px] font-black text-white/20 uppercase tracking-widest mb-3 ml-1">Sync Progress (%)</label><input type="range" min="0" max="100" value={formData.progress || 0} onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })} className="w-full accent-blue-500 h-2 bg-white/5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white/10 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-white/15" /><div className="text-right text-xs font-bold text-white mt-1">{formData.progress || 0}%</div></div>
                        <div><label className="block text-[10px] font-black text-white/20 uppercase tracking-widest mb-3 ml-1">Target Milestone</label><input type="date" value={formData.targetCompletionDate || ''} onChange={e => setFormData({ ...formData, targetCompletionDate: e.target.value })} className={`${inputCls} dark-date-input`} /></div>
                    </div>
                    <div><label className="block text-[10px] font-black text-white/20 uppercase tracking-widest mb-3 ml-1">Lead Instructor</label><input type="text" value={formData.instructor || ''} onChange={e => setFormData({ ...formData, instructor: e.target.value })} className={inputCls} placeholder="e.g., Prof. H. Stark" /></div>
                    <div className="flex gap-4 pt-4">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1 rounded-xl h-12 border-white/[0.04]">Abort</Button>
                        <Button type="submit" className="flex-1 rounded-xl h-12 bg-white/10 shadow-xl shadow-white/10">{editingCourse ? 'Save Changes' : 'Initialize Track'}</Button>
                    </div>
                </form>
            </Modal>
        </motion.div>
    );
};

export default Courses;
