import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useDashboard } from '@/hooks/useDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatePresence, motion, useSpring, useTransform, useMotionValue } from 'framer-motion';
import {
    AlertTriangle, TrendingUp, Trash2, Edit2,
    Plus, Zap, Target,
    Activity, ShieldCheck
} from 'lucide-react';

import AddSubjectModal from '@/components/modals/AddSubjectModal';
import EditSubjectModal from '@/components/modals/EditSubjectModal';
import AttendanceModal from '@/components/modals/AttendanceModal';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import Sparkles from '@/components/ui/Sparkles';

import Skeleton from '@/components/ui/Skeleton';

import DashboardRadarChart from './DashboardRadarChart';
import AttendanceTrendChart from './AttendanceTrendChart';



/* ── Animated Number ────────────────────────────────────────────── */
const AnimNum: React.FC<{ value: number; decimals?: number; className?: string }> = ({
    value, decimals = 1, className = ''
}) => {
    const mv = useMotionValue(0);
    const spring = useSpring(mv, { duration: 1200, bounce: 0 });
    const display = useTransform(spring, (v) => v.toFixed(decimals));
    const [d, setD] = useState('0');
    useEffect(() => { mv.set(value); }, [value, mv]);
    useEffect(() => { const u = display.on('change', setD); return u; }, [display]);
    return <span className={className}>{d}</span>;
};

/* ── Glowing Arc Ring ───────────────────────────────────────────── */
const GlowRing: React.FC<{ pct: number; size?: number }> = ({ pct, size = 220 }) => {
    const strokeW = 6;
    const r = (size - strokeW * 2) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    const gradId = 'ringGrad';

    return (
        <div className="relative" style={{ width: size, height: size }}>
            {/* Outer ambient glow */}
            <div className="absolute inset-0 rounded-full" style={{
                boxShadow: `0 0 60px rgba(16,185,129,${0.08 + pct * 0.002}), 0 0 120px rgba(16,185,129,0.03)`
            }} />
            <svg width={size} height={size} className="transform -rotate-90">
                <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="50%" stopColor="#60a5fa" />
                        <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                    <filter id="ringGlow">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                {/* Track */}
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeW} />
                {/* Active arc */}
                <motion.circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={`url(#${gradId})`}
                    strokeWidth={strokeW} strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
                    filter="url(#ringGlow)"
                />
            </svg>
        </div>
    );
};

/* ── Small Progress Ring ────────────────────────────────────────── */
const ProgressRing: React.FC<{ pct: number; size?: number; strokeWidth?: number; color: string }> = ({
    pct, size = 60, strokeWidth = 4, color
}) => {
    const r = (size - strokeWidth) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (pct / 100) * circ;
    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
            <motion.circle
                cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
        </svg>
    );
};

/* ── Sparkles Component ── */


/* ══════════════════════════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════════════════════════ */
const Dashboard: React.FC = () => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const { data: dashboardData, isLoading: loading, refetch: loadDashboard } = useDashboard();

    usePageMeta({
        title: 'Dashboard | AcadHub',
        description: 'Your academic overview — attendance, upcoming classes, and performance at a glance.',
    });

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<any | null>(null);
    const [markingSubjectId, setMarkingSubjectId] = useState<string | null>(null);
    const targetThreshold = user?.attendance_threshold || 75;



    const handleDeleteSubject = async (subjectId: string, subjectName: string) => {
        if (!confirm(`Delete "${subjectName}"?`)) return;
        try {
            await attendanceService.deleteSubject(subjectId);
            showToast('success', `Deleted ${subjectName}`);
            loadDashboard();
        } catch { showToast('error', 'Failed'); }
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

    const sortSubs = (subs: any[]) => {
        if (!subs) return [];
        return [...subs].sort((a, b) => {
            const p = (s: any) => { const c = s.categories || []; return c.includes('Theory') ? 0 : c.includes('Lab') ? 1 : 2; };
            return p(a) - p(b);
        });
    };

    if (loading) {
        return (
            <div className="space-y-4 pb-32 max-w-[1320px] mx-auto pt-20 px-5">
                <Skeleton className="h-[400px] w-full rounded-3xl" />
                <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-80 rounded-2xl" />
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
            </div>
        );
    }

    const att = dashboardData?.overall_attendance || 0;
    const subjects = dashboardData?.subjects || [];
    const totalClasses = subjects.reduce((a, c) => a + (c.total || 0), 0) || 0;
    const safeCount = subjects.filter(s => (s.attendance_percentage || 0) >= targetThreshold).length || 0;
    const riskCount = subjects.filter(s => (s.attendance_percentage || 0) < targetThreshold).length || 0;
    const subjectCount = dashboardData?.total_subjects || subjects.length || 0;

    return (
        <motion.div
            initial="hidden" animate="visible"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
            className="pb-28 max-w-[1320px] mx-auto pt-20 px-3 md:px-5"
        >
            {/* ── Beacon Section ── */}
            <motion.section
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
                className="relative rounded-[2.5rem] border border-white/[0.06] bg-[#050508] p-8 md:p-12 overflow-hidden mb-6 group transition-all duration-700"
                style={{ boxShadow: '0 0 100px -20px rgba(16,185,129,0.06), inset 0 1px 0 rgba(255,255,255,0.04)' }}
            >
                <div className="absolute inset-0 bg-blue-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/[0.05] blur-[100px] pointer-events-none group-hover:bg-blue-500/[0.08] transition-all duration-700" />

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <p className="text-xs text-white/20 uppercase tracking-[0.2em] font-black mb-1">Station Status</p>
                            <h1 className="text-2xl font-black text-white tracking-tight uppercase">Mission Control</h1>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-white/10 uppercase tracking-widest font-black">Local Time</p>
                            <p className="text-sm font-bold text-white/40">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row items-center justify-between gap-10 md:gap-14">
                        {/* Left Cluster */}
                        <div className="w-full flex-1 grid grid-cols-2 gap-8 md:gap-10">
                            <div className="transition-transform hover:scale-105 duration-300">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 leading-none">Subject Payload</p>
                                <p className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none">{subjectCount}</p>
                                <div className="flex items-center gap-1.5 mt-3 text-blue-400/40">
                                    <Target size={12} className="opacity-50" /> <span className="text-[9px] font-black uppercase tracking-[0.15em]">Active Channels</span>
                                </div>
                            </div>
                            <div className="transition-transform hover:scale-105 duration-300">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 leading-none">Critical Sectors</p>
                                <p className={`text-5xl md:text-6xl font-black tracking-tighter leading-none ${riskCount > 0 ? 'text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-white/20'}`}>{riskCount}</p>
                                <div className="flex items-center gap-1.5 mt-3 text-red-500/40">
                                    <AlertTriangle size={12} className="opacity-50" /> <span className="text-[9px] font-black uppercase tracking-[0.15em]">Low Integrity</span>
                                </div>
                            </div>
                        </div>

                        {/* Central Hub */}
                        <div className="relative group/ring cursor-default py-4">
                            <div className="absolute inset-0 bg-blue-500/5 blur-3xl rounded-full opacity-0 group-hover/ring:opacity-100 transition-opacity duration-700" />
                            <GlowRing pct={att} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <AnimNum value={att} decimals={1} className="text-6xl md:text-7xl font-black text-white tracking-tighter leading-none" />
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mt-3 opacity-60">Stability</span>
                            </div>
                        </div>

                        {/* Right Cluster */}
                        <div className="w-full flex-1 grid grid-cols-2 gap-8 md:gap-10 lg:text-right">
                            <div className="lg:order-2 transition-transform hover:scale-105 duration-300">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 leading-none">Safe Zones</p>
                                <p className="text-5xl md:text-6xl font-black text-blue-400 tracking-tighter leading-none">{safeCount}</p>
                                <div className="flex items-center lg:justify-end gap-1.5 mt-3 text-blue-400/40">
                                    <ShieldCheck size={12} className="opacity-50" /> <span className="text-[9px] font-black uppercase tracking-[0.15em]">Optimal</span>
                                </div>
                            </div>
                            <div className="lg:order-1 transition-transform hover:scale-105 duration-300">
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-2 leading-none">Engagements</p>
                                <p className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none">{totalClasses}</p>
                                <div className="flex items-center lg:justify-end gap-1.5 mt-3 text-white/10">
                                    <Activity size={12} className="opacity-50" /> <span className="text-[9px] font-black uppercase tracking-[0.15em]">Logged</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* ── Charts Section ── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">
                <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="lg:col-span-2 rounded-[2rem] bg-[#0a0a0a] border border-white/[0.06] p-6 min-h-[340px] flex flex-col relative overflow-hidden group">
                    <div className="flex items-center justify-between mb-3 relative z-10">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-blue-500/40" />
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Aptitude Matrix</span>
                        </div>
                    </div>
                    <div className="flex-1 scale-110">
                        <DashboardRadarChart subjects={subjects.map(s => ({ ...s, attendance_percentage: s.attendance_percentage || s.attendance?.percentage || 0 }))} />
                    </div>
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="lg:col-span-3 rounded-[2rem] bg-[#0a0a0a] border border-white/[0.06] p-6 min-h-[340px] flex flex-col relative overflow-hidden group">
                    <div className="flex items-center gap-2 mb-3 relative z-10">
                        <TrendingUp size={14} className="text-blue-500/40" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Temporal Engagement</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-[80%]">
                        <AttendanceTrendChart logs={dashboardData?.recent_logs || []} />
                    </div>
                </motion.div>
            </div>

            {/* ── Subjects Section ── */}
            <section>
                <div className="flex items-center justify-between mb-6 px-2">
                    <h2 className="text-sm font-black text-white/40 uppercase tracking-[0.2em]">Module Inventory</h2>
                    <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest hover:bg-blue-500/20 transition-all">
                        <Plus size={14} /> Register Module
                    </button>
                </div>

                {subjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 rounded-[3rem] border-2 border-dashed border-white/[0.04] bg-white/[0.01]">
                        <Zap size={32} className="text-blue-500/20 mb-4" />
                        <p className="text-xs font-black text-white/20 uppercase tracking-widest">No Active Modules Found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <AnimatePresence>
                            {sortSubs(subjects).map((subject, idx) => {
                                const pct = subject.attendance_percentage || 0;
                                const isCritical = pct < targetThreshold;
                                const accent = isCritical ? '#ef4444' : '#3b82f6';
                                const needed = classesNeeded(subject.attended || 0, subject.total || 0);
                                const canSkip = classesCanSkip(subject.attended || 0, subject.total || 0);

                                return (
                                    <motion.div
                                        key={subject._id || idx}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="group relative rounded-[2rem] border border-white/[0.06] bg-[#0a0a0a] p-6 hover:border-blue-500/20 transition-all duration-500"
                                        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 40px -20px rgba(0,0,0,0.5)' }}
                                    >
                                        <div className="absolute inset-0 rounded-[2rem] bg-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                        <div className="flex items-start justify-between mb-5">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-white/5 text-white/40 uppercase tracking-widest">{subject.code || 'CODE'}</span>
                                                </div>
                                                <h3 className="text-sm font-bold text-white truncate max-w-[180px] uppercase tracking-tight">{subject.name}</h3>
                                            </div>
                                            <div className="relative w-12 h-12">
                                                <ProgressRing pct={pct} size={48} color={accent} strokeWidth={3} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-[10px] font-black text-white">{Math.round(pct)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                                            <div className="text-center border-r border-white/[0.04]">
                                                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Attended / Total</p>
                                                <p className="text-xs font-bold text-white/80">{subject.attended || 0} / {subject.total || 0}</p>
                                            </div>
                                            <div className="text-center">
                                                <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isCritical ? 'text-red-500/60' : 'text-blue-500/60'}`}>
                                                    {isCritical ? 'Need' : 'Can Skip'}
                                                </p>
                                                <p className={`text-xs font-bold ${isCritical ? 'text-red-400' : 'text-blue-400'}`}>
                                                    {isCritical ? needed : canSkip}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end">
                                            <div className="flex gap-1">
                                                <button onClick={() => setEditingSubject(subject)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/10 hover:text-white/40 transition-colors">
                                                    <Edit2 size={12} />
                                                </button>
                                                <button onClick={() => handleDeleteSubject(subject._id, subject.name)} className="p-1.5 rounded-lg hover:bg-red-500/5 text-white/10 hover:text-red-500/40 transition-colors">
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </section>

            <AddSubjectModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={loadDashboard} />
            {editingSubject && <EditSubjectModal isOpen={!!editingSubject} onClose={() => setEditingSubject(null)} subject={editingSubject} onSuccess={loadDashboard} />}
            {markingSubjectId && <AttendanceModal isOpen={!!markingSubjectId} onClose={() => setMarkingSubjectId(null)} onSuccess={loadDashboard} />}
        </motion.div>
    );
};

export default Dashboard;
