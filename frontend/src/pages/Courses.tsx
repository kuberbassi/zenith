import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, ExternalLink, Trash2, Edit2, Award, Calendar,
    TrendingUp, Book, Globe, Video
} from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
// import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import api from '@/services/api';
import { attendanceService } from '@/services/attendance.service';

interface Course {
    _id?: string | { $oid: string };
    title: string;
    platform: 'coursera' | 'udemy' | 'youtube' | 'edx' | 'linkedin' | 'college' | 'custom';
    url: string;
    progress: number;
    enrolledDate: string;
    targetCompletionDate?: string;
    certificateUrl?: string;
    instructor?: string;
    notes?: string;
}

/** Extract a stable string ID from _id regardless of format (string | {$oid} | ObjectId) */
function getCourseId(course: Course): string {
    const id = course._id;
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (typeof id === 'object' && '$oid' in id) return id.$oid;
    return String(id);
}

const PLATFORMS = [
    { value: 'coursera', label: 'Coursera', icon: Globe, color: 'bg-blue-500' },
    { value: 'udemy', label: 'Udemy', icon: Video, color: 'bg-purple-500' },
    { value: 'youtube', label: 'YouTube', icon: Video, color: 'bg-red-500' },
    { value: 'custom', label: 'Custom', icon: Globe, color: 'bg-gray-500' },
];

const Courses: React.FC = () => {
    const { showToast } = useToast();
    // const [loading, setLoading] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [formData, setFormData] = useState<Partial<Course>>({
        title: '',
        platform: 'coursera',
        url: '',
        progress: 0,
        enrolledDate: new Date().toISOString().split('T')[0],
        instructor: '',
        notes: ''
    });

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = async () => {
        try {
            // setLoading(true);
            const data = await attendanceService.getManualCourses();
            if (data) {
                setCourses(data);
            }
        } catch (error) {
            console.error('Failed to load courses', error);
            showToast('error', 'Failed to load courses');
            // Fallback to local? No, source of truth is backend now.
        }
    };

    const saveCourses = async (newCourses: Course[]) => {
        // Optimistic update
        setCourses(newCourses);
        try {
            await api.post('/api/academic/courses/manual', newCourses);
        } catch (error) {
            console.error('Failed to save courses', error);
            showToast('error', 'Failed to save changes');
        }
    };

    const handleAddCourse = () => {
        setEditingCourse(null);
        setFormData({
            title: '',
            platform: 'coursera',
            url: '',
            progress: 0,
            enrolledDate: new Date().toISOString().split('T')[0],
            instructor: '',
            notes: ''
        });
        setIsModalOpen(true);
    };

    const handleEditCourse = (course: Course) => {
        setEditingCourse(course);
        setFormData(course);
        setIsModalOpen(true);
    };

    const handleDeleteCourse = (id: string) => {
        if (!confirm('Delete this course?')) return;
        const updated = courses.filter(c => getCourseId(c) !== id);
        saveCourses(updated);
        showToast('success', 'Course deleted');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingCourse) {
            const updated = courses.map(c =>
                getCourseId(c) === getCourseId(editingCourse)
                    ? { ...c, ...formData }
                    : c
            );
            saveCourses(updated);
            showToast('success', 'Course updated');
        } else {
            const newCourse = {
                ...formData,
                _id: Date.now().toString()
            } as Course;
            saveCourses([...courses, newCourse]);
            showToast('success', 'Course added');
        }

        setIsModalOpen(false);
    };

    const getPlatformConfig = (platform: string) => {
        return PLATFORMS.find(p => p.value === platform) || PLATFORMS[6];
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 80) return 'bg-green-500';
        if (progress >= 50) return 'bg-yellow-500';
        return 'bg-orange-500';
    };

    const activeCourses = courses.filter(c => c.progress < 100);
    const completedCourses = courses.filter(c => c.progress === 100);

    return (
        <div className="pb-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-on-surface mb-1 md:mb-2">
                        Course Manager
                    </h1>
                    <p className="text-sm md:text-base text-on-surface-variant">
                        Track all your learning across platforms
                    </p>
                </div>
                <div className="flex flex-col-reverse md:flex-row items-stretch md:items-center gap-4">
                    <div className="flex gap-4 text-xs md:text-sm justify-between md:justify-start bg-surface-container/50 md:bg-transparent p-2 md:p-0 rounded-lg">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                            <span className="text-on-surface-variant font-medium">
                                {activeCourses.length} Active
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Award className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600" />
                            <span className="text-on-surface-variant font-medium">
                                {completedCourses.length} Completed
                            </span>
                        </div>
                    </div>
                    <Button icon={<Plus size={16} />} size="md" onClick={handleAddCourse} className="w-full md:w-auto">
                        Add Course
                    </Button>
                </div>
            </motion.div>

            {/* Active Courses */}
            {activeCourses.length > 0 && (
                <section className="mb-6 md:mb-8">
                    <h2 className="text-lg md:text-xl font-bold text-on-surface mb-3 md:mb-4">Active Courses</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        <AnimatePresence>
                            {activeCourses.map((course, index) => {
                                const platform = getPlatformConfig(course.platform);
                                const Icon = platform.icon;

                                return (
                                    <motion.div
                                        key={getCourseId(course) || `active-${index}`}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <GlassCard hover className="group h-full flex flex-col p-4 md:p-5">
                                            {/* Platform Badge */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className={`flex items-center gap-1.5 md:gap-2 px-2.5 py-0.5 md:py-1 rounded-full ${platform.color} text-white text-[10px] md:text-xs font-bold`}>
                                                    <Icon className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                                    {platform.label}
                                                </div>
                                                <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEditCourse(course)}
                                                        className="p-1.5 rounded-md hover:bg-surface-container transition-colors"
                                                    >
                                                        <Edit2 className="w-3 h-3 md:w-3.5 md:h-3.5 text-on-surface-variant" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCourse(getCourseId(course))}
                                                        className="p-1.5 rounded-md hover:bg-surface-container transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5 text-error" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Course Info */}
                                            <h3 className="text-base md:text-lg font-bold text-on-surface mb-1 md:mb-2 line-clamp-2 leading-tight">
                                                {course.title}
                                            </h3>

                                            {course.instructor && (
                                                <p className="text-xs md:text-sm text-on-surface-variant mb-2 md:mb-3">
                                                    by {course.instructor}
                                                </p>
                                            )}

                                            {/* Progress Bar */}
                                            <div className="mb-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] md:text-xs text-on-surface-variant">Progress</span>
                                                    <span className="text-xs md:text-sm font-bold text-on-surface">{course.progress}%</span>
                                                </div>
                                                <div className="w-full h-1.5 md:h-2 bg-surface-container rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${getProgressColor(course.progress)} transition-all duration-300`}
                                                        style={{ width: `${course.progress}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Target Date */}
                                            {course.targetCompletionDate && (
                                                <div className="flex items-center gap-2 text-[10px] md:text-xs text-on-surface-variant mb-3">
                                                    <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                                    Target: {new Date(course.targetCompletionDate).toLocaleDateString()}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="mt-auto pt-3 border-t border-outline-variant/20 flex gap-2">
                                                <Button
                                                    variant="outlined"
                                                    size="sm"
                                                    icon={<ExternalLink size={12} className="md:w-3.5 md:h-3.5" />}
                                                    onClick={() => window.open(course.url, '_blank')}
                                                    className="flex-1 h-8 md:h-9 text-xs md:text-sm"
                                                >
                                                    Open
                                                </Button>
                                                <Button
                                                    variant="tonal"
                                                    size="sm"
                                                    className="h-8 md:h-9 text-xs md:text-sm"
                                                    onClick={() => {
                                                        const updated = courses.map(c =>
                                                            getCourseId(c) === getCourseId(course)
                                                                ? { ...c, progress: Math.min(100, c.progress + 10) }
                                                                : c
                                                        );
                                                        saveCourses(updated);
                                                    }}
                                                >
                                                    +10%
                                                </Button>
                                            </div>
                                        </GlassCard>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </section>
            )}

            {/* Completed Courses */}
            {completedCourses.length > 0 && (
                <section>
                    <h2 className="text-xl font-bold text-on-surface mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5 text-green-600" />
                        Completed Courses
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {completedCourses.map((course, cIdx) => {
                            const platform = getPlatformConfig(course.platform);
                            const Icon = platform.icon;

                            return (
                                <GlassCard key={getCourseId(course) || `completed-${cIdx}`} className="group p-4 opacity-80 hover:opacity-100 transition-opacity">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${platform.color} text-white text-xs font-bold w-fit`}>
                                            <Icon className="w-3 h-3" />
                                            {platform.label}
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEditCourse(course)}
                                                className="p-1 rounded-md hover:bg-surface-container transition-colors"
                                            >
                                                <Edit2 className="w-3 h-3 text-on-surface-variant" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCourse(getCourseId(course))}
                                                className="p-1 rounded-md hover:bg-surface-container transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3 text-error" />
                                            </button>
                                        </div>
                                    </div>

                                    <h4 className="font-bold text-on-surface text-sm line-clamp-2 mb-2">
                                        {course.title}
                                    </h4>

                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-outline-variant/10">
                                        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium">
                                            <Award className="w-3.5 h-3.5" />
                                            Completed
                                        </div>
                                        <button
                                            onClick={() => window.open(course.url, '_blank')}
                                            className="text-xs font-medium text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                                        >
                                            Open <ExternalLink size={10} />
                                        </button>
                                    </div>
                                </GlassCard>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Empty State */}
            {courses.length === 0 && (
                <GlassCard className="p-12 text-center border-dashed border-2 border-outline/30">
                    <Book className="w-12 h-12 text-primary/50 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-on-surface mb-2">No Courses Yet</h3>
                    <p className="text-on-surface-variant mb-6">
                        Start tracking your learning journey across platforms
                    </p>
                    <Button icon={<Plus size={18} />} onClick={handleAddCourse}>
                        Add Your First Course
                    </Button>
                </GlassCard>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingCourse ? 'Edit Course' : 'Add New Course'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-on-surface mb-2">
                            Course Title *
                        </label>
                        <input
                            type="text"
                            value={formData.title || ''}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-outline bg-surface text-on-surface"
                            placeholder="e.g., Machine Learning Specialization"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-on-surface mb-2">
                            Platform *
                        </label>
                        <select
                            value={formData.platform || 'coursera'}
                            onChange={(e) => setFormData({ ...formData, platform: e.target.value as any })}
                            className="w-full px-4 py-2 rounded-lg border border-outline bg-surface text-on-surface"
                            required
                        >
                            {PLATFORMS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-on-surface mb-2">
                            Course URL *
                        </label>
                        <input
                            type="url"
                            value={formData.url || ''}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-outline bg-surface text-on-surface"
                            placeholder="https://..."
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-2">
                                Progress (%)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={formData.progress || 0}
                                onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
                                className="w-full px-4 py-2 rounded-lg border border-outline bg-surface text-on-surface"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-2">
                                Target Date
                            </label>
                            <input
                                type="date"
                                value={formData.targetCompletionDate || ''}
                                onChange={(e) => setFormData({ ...formData, targetCompletionDate: e.target.value })}
                                className="w-full px-4 py-2 rounded-lg border border-outline bg-surface text-on-surface"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-on-surface mb-2">
                            Instructor
                        </label>
                        <input
                            type="text"
                            value={formData.instructor || ''}
                            onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-outline bg-surface text-on-surface"
                            placeholder="e.g., Andrew Ng"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <Button type="button" variant="outlined" onClick={() => setIsModalOpen(false)} className="flex-1">
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1">
                            {editingCourse ? 'Update' : 'Add'} Course
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Courses;
