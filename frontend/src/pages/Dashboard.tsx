import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useDashboard, useMarkAttendance } from '@/hooks/useDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Edit2, Check, X,
    Activity, Target, Flame, ChevronRight, Settings as SettingsIcon, FileText
} from 'lucide-react';
import AddSubjectModal from '@/components/modals/AddSubjectModal';
import EditSubjectModal from '@/components/modals/EditSubjectModal';
import AttendanceModal from '@/components/modals/AttendanceModal';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import useLongPress from '@/hooks/useLongPress';
import { useSemester } from '@/contexts/SemesterContext';
import { Link } from 'react-router-dom';
import { formatTeacherName } from '@/utils/formatters';
import { useNotes } from '@/hooks/useNotes';

/* ── Helpers for Timetable slot subject mapping ── */
const normalizeId = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim());

const findSubjectForSlot = (subjects: any[], slot: any) => {
    const explicitType = String(slot?.type || '').trim().toLowerCase();
    const hasSubjectRef = Boolean(normalizeId(slot?.subject_id || slot?.subjectId || slot?.subject?._id || slot?.subject?.id));
    if (explicitType && explicitType !== 'class') return undefined;
    if (!explicitType && !hasSubjectRef) return undefined;

    const slotSubjectId = normalizeId(slot?.subject_id || slot?.subjectId || slot?.subject?._id || slot?.subject?.id);
    if (slotSubjectId) {
        const matchedById = subjects.find((sub: any) => normalizeId(sub._id || sub.id) === slotSubjectId);
        if (matchedById) return matchedById;
    }

    const subjectField = slot?.subject;
    if (typeof subjectField === 'string' && subjectField.trim()) {
        const needle = subjectField.trim().toLowerCase();
        const matchedByName = subjects.find((sub: any) => String(sub?.name || '').trim().toLowerCase() === needle);
        if (matchedByName) return matchedByName;
    }

    if (subjectField && typeof subjectField === 'object') {
        const subObj = subjectField as Record<string, unknown>;
        const objId = normalizeId(subObj._id || subObj.id);
        if (objId) {
            const matchedByObjId = subjects.find((sub: any) => normalizeId(sub._id || sub.id) === objId);
            if (matchedByObjId) return matchedByObjId;
        }
        const objName = String(subObj.name || '').trim().toLowerCase();
        if (objName) {
            const matchedByObjName = subjects.find((sub: any) => String(sub?.name || '').trim().toLowerCase() === objName);
            if (matchedByObjName) return matchedByObjName;
        }
    }

    const slotLabel = String(
        slot?.label
        || slot?.subject_name
        || slot?.subjectName
        || slot?.name
        || slot?.subject?.name
        || slot?.subject?.code
        || ''
    ).trim().toLowerCase();
    if (!slotLabel) return undefined;

    return subjects.find((sub: any) => {
        const subName = String(sub?.name || '').trim().toLowerCase();
        const subCode = String(sub?.code || '').trim().toLowerCase();
        
        if (subName === slotLabel || subCode === slotLabel) return true;
        
        const acronym = subName.split(/\s+/).map(w => w[0]).join('');
        if (acronym === slotLabel) return true;
        
        if (subName.includes(slotLabel) || subCode.includes(slotLabel) || slotLabel.includes(subCode)) return true;

        return false;
    });
};

const SubjectRow: React.FC<{
    subject: any;
    targetThreshold: number;
    classesNeeded: (attended: number, total: number) => number;
    classesCanSkip: (attended: number, total: number) => number;
    triggerBubbleMenu: (subjectId: string, e: any) => void;
    handleQuickMark: (subjectId: string, status: 'present' | 'absent') => void;
    setEditingSubject: (subject: any) => void;
    handleDeleteSubject: (subjectId: string, subjectName: string) => void;
}> = ({
    subject,
    targetThreshold,
    classesNeeded,
    classesCanSkip,
    triggerBubbleMenu,
    handleQuickMark,
    setEditingSubject,
    handleDeleteSubject,
}) => {
    const pct = subject.attendance_percentage || 0;
    const isCritical = pct < targetThreshold;
    const needed = classesNeeded(subject.attended || 0, subject.total || 0);
    const canSkip = classesCanSkip(subject.attended || 0, subject.total || 0);
    const longPressHandlers = useLongPress((e) => triggerBubbleMenu(subject._id, e), {
        threshold: 600,
        onCancel: () => {}
    });

    return (
        <tr
            {...longPressHandlers}
            className="hover:bg-surface-container/30 transition-colors group cursor-default"
        >
            <td className="px-6 py-4 font-mono font-bold text-on-surface-variant/50">{subject.code || 'COURSE'}</td>
            <td className="px-6 py-4 font-bold text-on-surface">
                <div>
                    <p className="truncate max-w-[200px] leading-tight">{subject.name}</p>
                    <span className="text-[9px] font-bold text-on-surface-variant/30 uppercase mt-1 inline-block">{subject.type || 'Theory'}</span>
                </div>
            </td>
            <td className="px-6 py-4 text-on-surface-variant/60 font-medium">
                <p className="truncate max-w-[150px] leading-tight">{formatTeacherName(subject.professor)}</p>
            </td>
            <td className="px-6 py-4 text-center font-bold text-on-surface">{subject.attended || 0} / {subject.total || 0}</td>
            <td className="px-6 py-4 text-center">
                <div className="flex flex-col items-center gap-1.5">
                    <span className={`font-bold text-xs ${isCritical ? 'text-red-500' : 'text-on-surface'}`}>{Math.round(pct)}%</span>
                    <div className="w-16 h-1 bg-on-surface/10 border border-outline/50 rounded-full overflow-hidden shrink-0">
                        <div className={`h-full ${isCritical ? 'bg-red-500' : 'bg-on-surface'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-center">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    isCritical 
                        ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                        : 'bg-primary/5 border-outline text-on-surface'
                }`}>
                    {isCritical ? `Need ${needed} cls` : `${canSkip} Bunks`}
                </span>
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex justify-center gap-1">
                    <button
                        onClick={() => handleQuickMark(subject._id, 'present')}
                        className="px-2 py-1 rounded border border-outline bg-surface text-[10px] font-bold text-on-surface-variant hover:text-on-surface hover:border-on-surface transition-colors cursor-pointer"
                    >
                        P
                    </button>
                    <button
                        onClick={() => handleQuickMark(subject._id, 'absent')}
                        className="px-2 py-1 rounded border border-outline bg-surface text-[10px] font-bold text-on-surface-variant hover:text-red-500 hover:border-outline transition-colors cursor-pointer"
                    >
                        A
                    </button>
                </div>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => setEditingSubject(subject)}
                        className="p-1 rounded hover:bg-surface-container text-on-surface-variant/40 hover:text-on-surface transition-colors cursor-pointer"
                        title="Edit"
                    >
                        <Edit2 size={12} />
                    </button>
                    <button
                        onClick={() => handleDeleteSubject(subject._id, subject.name)}
                        className="p-1 rounded hover:bg-red-500/5 text-on-surface-variant/40 hover:text-red-500 transition-colors cursor-pointer"
                        title="Delete"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </td>
        </tr>
    );
};

const Dashboard: React.FC = () => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const { currentSemester } = useSemester();
    const { data: dashboardData, isLoading, refetch: loadDashboard } = useDashboard();
    const markAttendanceMutation = useMarkAttendance();

    usePageMeta({
        title: 'Dashboard | Zenith',
        description: 'Your academic overview — attendance, upcoming classes, and performance at a glance.',
    });

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<any | null>(null);
    const [markingSubjectId, setMarkingSubjectId] = useState<string | null>(null);
    const [bubbleMenu, setBubbleMenu] = useState<{
        subjectId: string;
        x: number;
        y: number;
    } | null>(null);

    const [todayClasses, setTodayClasses] = useState<any[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<'Theory' | 'Practical' | 'All'>('Theory');
    const { data: notesList } = useNotes();
    const notesPreview = notesList || [];

    const targetThreshold = user?.attendance_threshold || 75;

    useEffect(() => {
        const fetchTimetable = async () => {
            try {
                const data = await attendanceService.getTimetable(currentSemester);
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const currentDay = dayNames[new Date().getDay()];
                const daySlots = data?.schedule?.[currentDay] || [];
                
                const parseTimeForSort = (time12h: string) => {
                    if (!time12h) return 0;
                    try {
                        const parts = time12h.split(' ');
                        const time = parts[0];
                        const modifier = parts[1] || '';
                        let [hours, minutes] = time.split(':');
                        let h = parseInt(hours, 10);
                        if (modifier) {
                            if (h === 12) h = 0;
                            if (modifier.toLowerCase() === 'pm') h += 12;
                        }
                        return h * 60 + parseInt(minutes, 10);
                    } catch { return 0; }
                };

                const sortedSlots = [...daySlots].sort((a: any, b: any) => {
                    const getSlotStartTime = (slot: any) => String(slot?.start_time || slot?.startTime || '').trim();
                    return parseTimeForSort(getSlotStartTime(a)) - parseTimeForSort(getSlotStartTime(b));
                });
                setTodayClasses(sortedSlots);
            } catch (err) {
                console.error("Failed to load timetable for dashboard", err);
            }
        };

        if (user) {
            void fetchTimetable();
        }
    }, [currentSemester, user]);

    const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
        if (!confirm(`Delete "${subjectName}"?`)) return;
        try {
            await attendanceService.deleteSubject(subjectId);
            showToast('success', `Deleted ${subjectName}`);
            loadDashboard();
        } catch {
            showToast('error', 'Failed to delete');
        }
    };

    const handleQuickMark = async (subjectId: string, status: 'present' | 'absent') => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(15);
        }
        try {
            await markAttendanceMutation.mutateAsync({ subjectId, status });
            showToast('success', `Marked ${status}`);
        } catch {
            showToast('error', 'Failed to mark attendance');
        }
    };

    const classesNeeded = (attended: number, total: number) => {
        if (total === 0) return 0;
        if ((attended / total) * 100 >= targetThreshold) return 0;
        return Math.ceil((targetThreshold * total - attended * 100) / (100 - targetThreshold));
    };

    const classesCanSkip = (attended: number, total: number) => {
        if (total === 0) return 0;
        return Math.max(0, Math.floor((attended * 100 - targetThreshold * total) / targetThreshold));
    };

    const att = dashboardData?.overall_attendance || 0;
    const subjects = dashboardData?.subjects || [];
    const totalClasses = subjects.reduce((a, c) => a + (c.total || 0), 0) || 0;
    const safeCount = subjects.filter(s => (s.attendance_percentage || 0) >= targetThreshold).length || 0;
    const riskCount = subjects.filter(s => (s.attendance_percentage || 0) < targetThreshold).length || 0;
    const subjectCount = dashboardData?.total_subjects || subjects.length || 0;
    const totalAttended = subjects.reduce((sum, subject) => sum + (subject.attended || 0), 0);
    const safeBunks = dashboardData?.summary?.safe_bunks_remaining ?? 0;

    const sortSubs = (subs: any[]) => {
        if (!subs) return [];
        return [...subs].sort((a, b) => {
            const p = (s: any) => { const c = s.categories || []; return c.includes('Theory') ? 0 : c.includes('Lab') ? 1 : 2; };
            return p(a) - p(b);
        });
    };

    // Bubble menu trigger
    const triggerBubbleMenu = (subjectId: string, e: any) => {
        e.preventDefault();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        
        const menuWidth = 160;
        const menuHeight = 145;
        const boundedX = Math.max(12, Math.min(clientX, window.innerWidth - menuWidth - 12));
        const boundedY = Math.max(12, Math.min(clientY, window.innerHeight - menuHeight - 12));

        setBubbleMenu({
            subjectId,
            x: boundedX,
            y: boundedY
        });
    };

    return (
        <div className="pb-24 w-full select-none">
            {/* Header Section */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">
                        System / Overview
                    </p>
                    <h1 className="text-2xl font-bold text-on-surface tracking-tight">Dashboard</h1>
                    <p className="text-xs text-on-surface-variant/40 mt-0.5">
                        Manage and track subject attendance.
                    </p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-on-surface text-surface text-xs font-bold transition-all hover:bg-on-surface/90 cursor-pointer self-start sm:self-auto"
                >
                    <Plus size={14} /> Add Subject
                </button>
            </div>

            {isLoading && !dashboardData ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="animate-pulse h-48 bg-surface-container border border-outline rounded-lg md:col-span-2" />
                        <div className="animate-pulse h-48 bg-surface-container border border-outline rounded-lg" />
                    </div>
                    <div className="animate-pulse h-64 bg-surface-container border border-outline rounded-lg" />
                </div>
            ) : (
                <div className="space-y-6">
                    
                    {/* Bento Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Bento Card 1: Academic Health */}
                        <div className="rounded-lg border border-outline bg-surface p-6 flex flex-col justify-between hover:border-on-surface transition-all lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-wider">Overall Academic Health</span>
                                <Activity size={13} className="text-on-surface-variant/40" />
                            </div>
                            
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 my-2">
                                <div>
                                    <p className="text-6xl md:text-7xl font-extrabold tracking-tighter text-on-surface leading-none">{att.toFixed(1)}%</p>
                                    <p className="text-xs font-semibold text-on-surface-variant/40 mt-2">Overall Conducted Classes</p>
                                </div>
                                
                                <div className="flex-1 w-full md:max-w-xs space-y-4">
                                    <div>
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50 mb-1">
                                            <span>Conduct Progress</span>
                                            <span>{totalAttended} / {totalClasses} classes</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-on-surface/10 border border-outline rounded-full overflow-hidden">
                                            <div className="h-full bg-on-surface" style={{ width: `${Math.min(100, totalClasses > 0 ? (totalAttended / totalClasses) * 100 : 0)}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 border-t border-outline pt-4 mt-6">
                                <div className="text-left">
                                    <span className="block text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-wider">Deficit Risk</span>
                                    <span className={`text-base font-bold ${riskCount > 0 ? 'text-red-500' : 'text-on-surface'}`}>{riskCount} Subjects</span>
                                </div>
                                <div className="text-left">
                                    <span className="block text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-wider">Safe Bunks</span>
                                    <span className="text-base font-bold text-on-surface">{safeBunks} Remaining</span>
                                </div>
                                <div className="text-left">
                                    <span className="block text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-wider">Total Tracked</span>
                                    <span className="text-base font-bold text-on-surface">{safeCount}/{subjectCount} Courses</span>
                                </div>
                            </div>
                        </div>

                        {/* Bento Card 2: Student Target */}
                        <div className="rounded-lg border border-outline bg-surface p-6 flex flex-col justify-between hover:border-on-surface transition-all">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-wider">Academic Target</span>
                                    <Target size={13} className="text-on-surface-variant/40" />
                                </div>
                                
                                <div className="space-y-4 my-2">
                                    <div>
                                        <p className="text-xs font-semibold text-on-surface-variant/40">Student Name</p>
                                        <p className="text-sm font-bold text-on-surface">{user?.name || 'Student'}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-semibold text-on-surface-variant/40 font-mono">Enrollment</p>
                                            <p className="text-xs font-bold text-on-surface truncate font-mono">{user?.enrollment_number || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-on-surface-variant/40">Batch</p>
                                            <p className="text-xs font-bold text-on-surface truncate">{user?.batch || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-semibold text-on-surface-variant/40">Target Goal</p>
                                            <p className="text-xs font-bold text-on-surface">{targetThreshold}% Minimum</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-on-surface-variant/40">Current Semester</p>
                                            <p className="text-xs font-bold text-on-surface">Semester {currentSemester}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-outline pt-4 mt-6">
                                <Link
                                    to="/settings"
                                    className="w-full h-8 flex items-center justify-center gap-2 border border-outline hover:border-on-surface hover:bg-surface-container rounded text-xs font-bold text-on-surface transition-all cursor-pointer"
                                >
                                    <SettingsIcon size={12} />
                                    Configure Settings
                                </Link>
                            </div>
                        </div>
                                          {/* Bento Card 3: Today's Schedule */}
                        <div className="rounded-lg border border-outline bg-surface p-6 flex flex-col justify-between hover:border-on-surface transition-all min-h-[260px]">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-wider">Today's Schedule</span>
                                    <Flame size={13} className="text-on-surface-variant/40" />
                                </div>
                                
                                <div className="space-y-3.5 my-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                                    {todayClasses.length > 0 ? (
                                        todayClasses.map((cls, idx) => {
                                            const sub = findSubjectForSlot(subjects, cls);
                                            return (
                                                <div key={idx} className="flex items-center gap-3 py-1 border-b border-outline last:border-b-0">
                                                    <div className="text-center bg-surface-container border border-outline rounded px-2 py-1 shrink-0 min-w-[55px]">
                                                        <span className="block text-[8px] font-bold text-on-surface-variant/50 leading-none">{cls.start_time || cls.startTime || '—'}</span>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold text-on-surface truncate leading-tight">{sub?.name || cls.subject_name || cls.subjectName || cls.label || cls.name || 'Break'}</p>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-8 text-center">
                                            <p className="text-xs font-semibold text-on-surface-variant/30 italic">No classes today. Enjoy your day!</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-outline pt-4 mt-6 shrink-0">
                                <Link
                                    to="/timetable"
                                    className="w-full h-8 flex items-center justify-center gap-1 border border-outline hover:border-on-surface hover:bg-surface-container rounded text-xs font-bold text-on-surface transition-all cursor-pointer"
                                >
                                    View Full Timetable
                                    <ChevronRight size={12} />
                                </Link>
                            </div>
                        </div>

                        {/* Bento Card 4: Recent Notes */}
                        <div className="rounded-lg border border-outline bg-surface p-6 flex flex-col justify-between hover:border-on-surface transition-all min-h-[260px] lg:col-span-2">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-wider">Recent Notes & Checklists</span>
                                    <FileText size={13} className="text-on-surface-variant/40" />
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2">
                                    {notesPreview.length > 0 ? (
                                        notesPreview.slice(0, 2).map((note, idx) => (
                                            <div key={note.id || idx} className="border border-outline bg-surface-container/20 rounded p-4 flex flex-col justify-between min-h-[120px]">
                                                <div>
                                                    <h4 className="text-xs font-bold text-on-surface truncate">{note.title || 'Untitled'}</h4>
                                                    {!note.is_todo ? (
                                                        <p className="text-[11px] text-on-surface-variant/65 mt-1.5 line-clamp-3 leading-relaxed whitespace-pre-wrap">{note.content ? note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : 'Empty note'}</p>
                                                    ) : (
                                                        <div className="space-y-1 mt-2">
                                                            {note.todos && note.todos.slice(0, 2).map((todo: any) => (
                                                                <div key={todo.id} className="flex items-center gap-1.5 text-[11px]">
                                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${todo.completed ? 'bg-primary/30' : 'bg-primary'}`} />
                                                                    <span className={`truncate ${todo.completed ? 'line-through opacity-40' : 'opacity-80'}`}>{todo.text}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant/30 mt-2 block">{note.is_todo ? 'Checklist' : 'Note'}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-8 text-center border border-dashed border-outline rounded col-span-2">
                                            <p className="text-xs font-semibold text-on-surface-variant/30 italic">No notes created yet.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-outline pt-4 mt-6">
                                <Link
                                    to="/notes"
                                    className="w-full h-8 flex items-center justify-center gap-1 border border-outline hover:border-on-surface hover:bg-surface-container rounded text-xs font-bold text-on-surface transition-all cursor-pointer"
                                >
                                    Open Notes &amp; Todos
                                    <ChevronRight size={12} />
                                </Link>
                            </div>
                        </div>

                        {/* Bento Card 5: Courses Breakdown */}
                        <div className="rounded-lg border border-outline bg-surface overflow-hidden lg:col-span-3 hover:border-on-surface transition-all">
                            <div className="px-6 py-4 border-b border-outline bg-surface-container/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-wider">Courses Breakdown</span>
                                {/* Category filter tabs */}
                                <div className="flex items-center gap-1 p-0.5 bg-surface border border-outline rounded-lg self-start sm:self-auto">
                                    {(['Theory', 'Practical', 'All'] as const).map(cat => {
                                        const count = cat === 'All'
                                            ? subjects.length
                                            : subjects.filter((s: any) => {
                                                const isPractical = s.categories?.includes('Practical') || 
                                                                    s.type?.toLowerCase() === 'practical' || 
                                                                    s.type?.toLowerCase() === 'lab' || 
                                                                    s.name?.toLowerCase().includes('lab');
                                                return cat === 'Theory' ? !isPractical : isPractical;
                                            }).length;
                                        return (
                                            <button
                                                key={cat}
                                                onClick={() => setCategoryFilter(cat)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                                    categoryFilter === cat
                                                        ? 'bg-on-surface text-surface'
                                                        : 'text-on-surface-variant/50 hover:text-on-surface'
                                                }`}
                                            >
                                                {cat}
                                                <span className={`text-[9px] ${categoryFilter === cat ? 'opacity-60' : 'opacity-40'}`}>{count}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {(() => {
                                const filteredSubjects = categoryFilter === 'All'
                                    ? subjects
                                    : subjects.filter((s: any) => {
                                        const isPractical = s.categories?.includes('Practical') || 
                                                            s.type?.toLowerCase() === 'practical' || 
                                                            s.type?.toLowerCase() === 'lab' || 
                                                            s.name?.toLowerCase().includes('lab');
                                        return categoryFilter === 'Theory' ? !isPractical : isPractical;
                                    });
                                return filteredSubjects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 bg-surface">
                                    <Target size={24} className="text-on-surface-variant/20 mb-4" />
                                    <p className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest">No subjects tracked yet</p>
                                </div>
                                ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs select-none min-w-[850px]">
                                        <thead>
                                            <tr className="border-b border-outline bg-surface-container/50 text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-wider">
                                                <th className="px-6 py-3">Code</th>
                                                <th className="px-6 py-3">Subject Name</th>
                                                <th className="px-6 py-3">Professor</th>
                                                <th className="px-6 py-3 text-center">Attended</th>
                                                <th className="px-6 py-3 text-center">Percentage</th>
                                                <th className="px-6 py-3 text-center">Can Bunk / Needed</th>
                                                <th className="px-6 py-3 text-center">Quick Mark</th>
                                                <th className="px-6 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-outline">
                                            {sortSubs(filteredSubjects).map((subject) => (
                                                <SubjectRow
                                                    key={subject._id}
                                                    subject={subject}
                                                    targetThreshold={targetThreshold}
                                                    classesNeeded={classesNeeded}
                                                    classesCanSkip={classesCanSkip}
                                                    triggerBubbleMenu={triggerBubbleMenu}
                                                    handleQuickMark={handleQuickMark}
                                                    setEditingSubject={setEditingSubject}
                                                    handleDeleteSubject={handleDeleteSubject}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}


            {/* Float Hold Bubble Menu */}
            <AnimatePresence>
                {bubbleMenu && (
                    <>
                        <div
                            className="fixed inset-0 z-50"
                            onClick={() => setBubbleMenu(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            style={{ top: bubbleMenu.y, left: bubbleMenu.x }}
                            className="fixed z-50 bg-surface border border-outline rounded-lg p-1.5 shadow-xl min-w-[150px] text-on-surface flex flex-col"
                        >
                            <button
                                onClick={() => { handleQuickMark(bubbleMenu.subjectId, 'present'); setBubbleMenu(null); }}
                                className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-container rounded-md transition-colors cursor-pointer"
                            >
                                <Check size={12} className="text-primary" />
                                Mark Present
                            </button>
                            <button
                                onClick={() => { handleQuickMark(bubbleMenu.subjectId, 'absent'); setBubbleMenu(null); }}
                                className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-container rounded-md transition-colors cursor-pointer"
                            >
                                <X size={12} className="text-red-500" />
                                Mark Absent
                            </button>
                            <div className="h-px bg-outline my-1" />
                            {(() => {
                                const targetSub = subjects.find(s => s._id === bubbleMenu.subjectId);
                                if (!targetSub) return null;
                                return (
                                    <>
                                        <button
                                            onClick={() => { setEditingSubject(targetSub); setBubbleMenu(null); }}
                                            className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-container rounded-md transition-colors cursor-pointer"
                                        >
                                            <Edit2 size={12} />
                                            Edit Details
                                        </button>
                                        <button
                                            onClick={() => { handleDeleteSubject(targetSub._id, targetSub.name); setBubbleMenu(null); }}
                                            className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/5 rounded-md transition-colors cursor-pointer"
                                        >
                                            <Trash2 size={12} />
                                            Delete Course
                                        </button>
                                    </>
                                );
                            })()}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AddSubjectModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={loadDashboard} />
            {editingSubject && <EditSubjectModal isOpen={!!editingSubject} onClose={() => setEditingSubject(null)} subject={editingSubject} onSuccess={loadDashboard} />}
            {markingSubjectId && <AttendanceModal isOpen={!!markingSubjectId} onClose={() => setMarkingSubjectId(null)} onSuccess={loadDashboard} />}
        </div>
    );
};

export default Dashboard;
