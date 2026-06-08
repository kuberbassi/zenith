import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
    ExternalLink, Trash, Edit2, Award,
    Book, Globe, Video
} from 'lucide-react';
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

const PLATFORMS = [
    { value: 'coursera', label: 'Coursera', icon: Globe },
    { value: 'udemy', label: 'Udemy', icon: Video },
    { value: 'youtube', label: 'YouTube', icon: Video },
    { value: 'custom', label: 'Custom', icon: Globe },
];

const Courses: React.FC = () => {
    const { showToast } = useToast();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    usePageMeta({
        title: 'Courses | Zenith',
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
            setLoading(true);
            const data = await attendanceService.getManualCourses();
            setCourses(Array.isArray(data) ? data.map(normalizeCourse).filter((c: Course) => c.title || c.url) : []);
        } catch { 
            showToast('error', 'Sync Failed'); 
        } finally {
            setLoading(false);
        }
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
        if (!confirm('Are you sure you want to delete this course?')) return;
        const previous = courses;
        const updated = courses.filter(c => getCourseId(c) !== id);
        setCourses(updated);
        try {
            await attendanceService.deleteManualCourse(id);
            showToast('success', 'Course deleted successfully');
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
                showToast('success', 'Course updated successfully');
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
                showToast('success', 'Course added successfully');
            } catch {
                setCourses(previous);
                showToast('error', 'Save Failed');
            }
        }
        setIsModalOpen(false);
    };

    const activeCourses = courses.filter(c => c.progress < 100);
    const completedCourses = courses.filter(c => c.progress === 100);

    const inputCls = "w-full px-3 py-2.5 rounded border border-outline bg-surface text-on-surface text-xs placeholder-on-surface-variant/30 focus:outline-none focus:border-on-surface transition-all";

    return (
        <div className="max-w-5xl mx-auto pb-24 px-4 select-none">
            {/* Page Header */}
            <div className="mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">Learning / Courses</p>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Courses</h1>
                        <p className="text-xs text-on-surface-variant/40 mt-0.5">{activeCourses.length} active · {completedCourses.length} completed</p>
                    </div>
                    <button onClick={handleAddCourse} className="h-8 px-3 text-xs font-bold rounded bg-on-surface text-surface hover:opacity-90 transition-all cursor-pointer">Add Course</button>
                </div>
                <div className="mt-4 h-px bg-outline" />
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse h-16 bg-surface-container border border-outline rounded-lg" />
                    ))}
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Active Courses */}
                    {activeCourses.length > 0 && (
                        <section>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/30 mb-4 px-1">In Progress</p>
                            <div className="border border-outline rounded-lg overflow-hidden bg-surface">
                                {activeCourses.map((course, idx) => {
                                    const plat = PLATFORMS.find(p => p.value === course.platform) || PLATFORMS[3];
                                    return (
                                        <div key={getCourseId(course)} className={`group flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 transition-all ${idx < activeCourses.length - 1 ? 'border-b border-outline' : ''}`}>
                                            {(() => {
                                                const tag = getNotionTagStyles(plat.label);
                                                return (
                                                    <span style={tag.style} className={`shrink-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded w-16 text-center ${tag.className}`}>
                                                        {plat.label}
                                                    </span>
                                                );
                                            })()}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-on-surface truncate">{course.title}</p>
                                                {course.instructor && <p className="text-[10px] text-on-surface-variant/40 mt-0.5 truncate font-semibold">{course.instructor}</p>}
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 w-32">
                                                <div className="flex-1 h-1 bg-on-surface/10 rounded-full overflow-hidden">
                                                    <div className="h-full bg-on-surface" style={{ width: `${course.progress}%` }} />
                                                </div>
                                                <span className="text-[10px] font-bold text-on-surface-variant/50 w-8 text-right">{course.progress}%</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                                <button onClick={() => { const previous = courses; const updated = courses.map(c => getCourseId(c) === getCourseId(course) ? { ...c, progress: Math.min(100, c.progress + 10) } : c); setCourses(updated); void attendanceService.updateManualCourse(getCourseId(course), { progress: Math.min(100, course.progress + 10) }).catch(() => { setCourses(previous); showToast('error', 'Save Failed'); }); }} className="h-7 px-2 text-[9px] font-bold rounded border border-outline bg-surface text-on-surface-variant hover:bg-surface-container transition-all cursor-pointer">+10%</button>
                                                <button onClick={() => window.open(course.url, '_blank')} className="h-7 px-2 text-[9px] font-bold rounded border border-outline bg-surface text-on-surface-variant hover:bg-surface-container transition-all cursor-pointer">Open</button>
                                                <button onClick={() => handleEditCourse(course)} className="h-7 w-7 flex items-center justify-center rounded border border-outline bg-surface text-on-surface-variant hover:bg-surface-container transition-all cursor-pointer"><Edit2 size={11} /></button>
                                                <button onClick={() => void handleDeleteCourse(getCourseId(course))} className="h-7 w-7 flex items-center justify-center rounded border border-outline bg-surface text-red-500/60 hover:text-red-500 hover:bg-red-500/5 transition-all cursor-pointer"><Trash size={11} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Completed Courses */}
                    {completedCourses.length > 0 && (
                        <section>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/30 mb-4 px-1">Completed</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {completedCourses.map(course => (
                                    <div key={getCourseId(course)} className="group p-5 rounded-lg border border-outline bg-surface hover:border-on-surface transition-all flex flex-col justify-between">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-8 h-8 rounded border border-outline bg-surface-container-high flex items-center justify-center text-on-surface"><Award size={14} /></div>
                                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditCourse(course)} className="p-1 text-on-surface-variant/40 hover:text-on-surface cursor-pointer"><Edit2 size={11} /></button>
                                                <button onClick={() => void handleDeleteCourse(getCourseId(course))} className="p-1 text-on-surface-variant/40 hover:text-red-500 cursor-pointer"><Trash size={11} /></button>
                                            </div>
                                        </div>
                                        <h4 className="text-xs font-bold text-on-surface-variant/70 line-clamp-2 mb-4">{course.title}</h4>
                                        <button onClick={() => window.open(course.url, '_blank')} className="w-full py-1.5 rounded border border-outline bg-surface text-[10px] font-bold hover:bg-surface-container flex items-center justify-center gap-1 cursor-pointer">Open Course <ExternalLink size={10} /></button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* Empty State */}
            {courses.length === 0 && !loading && (
                <div className="rounded-lg border border-dashed border-outline py-20 text-center">
                    <Book size={28} className="mx-auto mb-4 text-on-surface-variant/20" />
                    <p className="text-xs font-bold text-on-surface-variant/30 uppercase tracking-widest mb-1">No courses tracked</p>
                    <p className="text-xs text-on-surface-variant/20 mb-6 font-semibold">Add your first course to start tracking progress.</p>
                    <button onClick={handleAddCourse} className="h-8 px-4 text-xs font-bold rounded bg-on-surface text-surface hover:opacity-90 transition-all cursor-pointer">Add Course</button>
                </div>
            )}

            {/* Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCourse ? 'Edit Course' : 'Add Course'}>
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant/40 uppercase mb-1.5">Course Title</label>
                        <input type="text" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} className={inputCls} placeholder="e.g., Machine Learning" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Platform" value={formData.platform || 'coursera'} onChange={e => setFormData({ ...formData, platform: e.target.value as any })} options={PLATFORMS.map(p => ({ value: p.value, label: p.label }))} />
                        <div>
                            <label className="block text-[10px] font-bold text-on-surface-variant/40 uppercase mb-1.5">Course URL</label>
                            <input type="url" value={formData.url || ''} onChange={e => setFormData({ ...formData, url: e.target.value })} className={inputCls} placeholder="https://..." required />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex justify-between mb-1.5">
                                <label className="text-[10px] font-bold text-on-surface-variant/40 uppercase">Progress</label>
                                <span className="text-[10px] font-bold text-on-surface">{formData.progress || 0}%</span>
                            </div>
                            <input type="range" min="0" max="100" value={formData.progress || 0} onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })} className="w-full accent-primary h-1 bg-on-surface/15 rounded-full appearance-none cursor-pointer" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-on-surface-variant/40 uppercase mb-1.5">Target Date</label>
                            <input type="date" value={formData.targetCompletionDate || ''} onChange={e => setFormData({ ...formData, targetCompletionDate: e.target.value })} className={inputCls} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-on-surface-variant/40 uppercase mb-1.5">Instructor</label>
                        <input type="text" value={formData.instructor || ''} onChange={e => setFormData({ ...formData, instructor: e.target.value })} className={inputCls} placeholder="Optional" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 h-9 text-xs font-semibold rounded border border-outline bg-surface text-on-surface hover:bg-surface-container transition-all cursor-pointer">Cancel</button>
                        <button type="submit" className="flex-1 h-9 text-xs font-semibold rounded bg-on-surface text-surface hover:opacity-90 transition-all cursor-pointer">{editingCourse ? 'Save' : 'Add Course'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Courses;
