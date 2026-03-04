import React from 'react';
import { Doughnut, Radar, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    PointElement, LineElement, Title, Tooltip, Legend,
    RadialLinearScale, ArcElement, Filler
} from 'chart.js';
import { motion } from 'framer-motion';
import { useAnalytics } from '@/hooks/useAnalytics';
import Skeleton from '@/components/ui/Skeleton';
import { TrendingUp, Activity, Award, AlertTriangle, CalendarDays } from 'lucide-react';
import Sparkles from '@/components/ui/Sparkles';
import { useAuth } from '@/contexts/AuthContext';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    Title, Tooltip, Legend, RadialLinearScale, ArcElement, Filler
);

const Analytics: React.FC = () => {
    const { reportsData, dayOfWeekData, loading } = useAnalytics();
    const { user } = useAuth();
    const targetThreshold = user?.attendance_threshold || 75;

    if (loading) {
        return (
            <div className="p-8 space-y-8 max-w-7xl mx-auto">
                <Skeleton className="h-40 w-full rounded-[3rem]" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Skeleton className="h-32 rounded-3xl" />
                    <Skeleton className="h-32 rounded-3xl" />
                    <Skeleton className="h-32 rounded-3xl" />
                    <Skeleton className="h-32 rounded-3xl" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <Skeleton className="h-80 rounded-[2.5rem]" />
                    <Skeleton className="h-80 rounded-[2.5rem]" />
                    <Skeleton className="h-80 rounded-[2.5rem]" />
                </div>
            </div>
        );
    }

    const kpis: any = reportsData?.kpis || {};
    const subjects = reportsData?.subject_breakdown || [];
    const days = dayOfWeekData?.days || [];

    const totalAttended = subjects.reduce((acc: number, s: any) => acc + (s.attended || 0), 0);
    const totalClasses = subjects.reduce((acc: number, s: any) => acc + (s.total || 0), 0);
    const overallAttendance = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;

    // Theme Colors (Mission Blue)
    const accentColor = '#3b82f6';
    const gridColor = 'rgba(255, 255, 255, 0.05)';
    const tickColor = 'rgba(255, 255, 255, 0.3)';

    // --- Chart Data ---

    const radarData = {
        labels: subjects.map((s: any) => s.name.substring(0, 10) + (s.name.length > 10 ? '..' : '')),
        datasets: [{
            label: 'Attendance %',
            data: subjects.map((s: any) => s.percentage || 0),
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderColor: accentColor,
            borderWidth: 2,
            pointBackgroundColor: accentColor,
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: accentColor,
            fill: true,
        }]
    };

    const radarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0a0a0a',
                titleFont: { size: 10, weight: 'bold' as const },
                bodyFont: { size: 12 },
                padding: 12,
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
            }
        },
        scales: {
            r: {
                min: 0,
                max: 100,
                ticks: { display: false, stepSize: 20 },
                grid: { color: gridColor },
                angleLines: { color: gridColor },
                pointLabels: {
                    color: tickColor,
                    font: { size: 10, weight: 'bold' as const }
                }
            }
        }
    };

    const doughnutData = {
        labels: ['Attended', 'Missed'],
        datasets: [{
            data: [totalAttended, totalClasses - totalAttended],
            backgroundColor: [accentColor, 'rgba(255,255,255,0.03)'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    const doughnutOptions = {
        cutout: '85%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        responsive: true,
        maintainAspectRatio: false,
    };

    const lineData = {
        labels: days.map((d: any) => d.day),
        datasets: [
            {
                label: 'Present',
                data: days.map((d: any) => d.present),
                borderColor: accentColor,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#0a0a0a',
                pointBorderColor: accentColor,
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            }
        ]
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0a0a0a',
                titleFont: { size: 10, weight: 'bold' as const },
                bodyFont: { size: 12 },
                padding: 12,
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10, weight: 'bold' as const } } },
            y: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1, font: { size: 10 } }, beginAtZero: true }
        }
    };

    return (
        <div className="pb-32 max-w-7xl mx-auto px-4 lg:px-8">
            {/* ── Cinematic Analytics Header ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 mb-8 relative rounded-[3rem] border border-white/[0.06] bg-[#050508] p-10 md:p-14 overflow-hidden shadow-2xl group transition-all duration-700">
                <div className="absolute inset-0 bg-blue-500/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/[0.05] blur-[100px] pointer-events-none group-hover:bg-blue-500/[0.08] transition-all duration-700" />

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                                <Activity size={24} />
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">Deep Analytics</h1>
                        </div>
                        <p className="text-white/30 font-bold text-xs md:text-sm tracking-[0.2em] uppercase max-w-lg leading-relaxed">
                            Comprehensive tracking of academic metrics, periodic footprint, and cognitive engagement.
                        </p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Overall Integrity</div>
                            <div className="text-5xl font-black text-white tracking-tighter">{overallAttendance}%</div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* ── Last.fm Style KPI Cards ── */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {[
                    { label: 'Overall Rate', val: `${kpis.overall_percentage ?? overallAttendance}%`, sub: `Target: ${kpis.target_threshold ?? targetThreshold}%`, icon: <Activity size={18} />, color: '#3b82f6' },
                    { label: 'Attendance Streak', val: `${kpis.attendance_streak ?? 0}`, sub: 'Consecutive Days', icon: <TrendingUp size={18} />, color: '#10b981' },
                    { label: 'Subjects at Risk', val: `${kpis.at_risk_count ?? 0}`, sub: `of ${kpis.total_subjects ?? subjects.length} Tracks`, icon: <AlertTriangle size={18} />, color: '#ef4444' },
                    { label: 'Engagements', val: `${totalAttended}`, sub: `${totalClasses} Total Sessions`, icon: <CalendarDays size={18} />, color: '#8b5cf6' },
                    { label: 'Performance Peak', val: kpis.best_subject_name || 'N/A', sub: kpis.best_subject_percent || '0%', icon: <Award size={18} />, color: '#f59e0b' },
                    { label: 'Absence Count', val: String(kpis.total_absences || 0), sub: 'Sessions Missed', icon: <TrendingUp size={18} className="rotate-180" />, color: '#f43f5e' },
                ].map((k, i) => (
                    <div key={i} className="rounded-[2rem] border border-white/[0.04] bg-[#0a0a0a] p-8 flex flex-col justify-between group hover:bg-white/[0.01] transition-all duration-500 hover:border-blue-500/20 shadow-xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-transparent to-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex justify-between items-start mb-6 relative z-10">
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">{k.label}</span>
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center opacity-40 group-hover:opacity-100 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500" style={{ backgroundColor: `${k.color}10`, color: k.color, border: `1px solid ${k.color}20` }}>
                                {k.icon}
                            </div>
                        </div>
                        <div className="relative z-10">
                            <p className="text-3xl font-black text-white tracking-tighter truncate leading-none mb-2">{k.val}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: k.color }}>
                                <span className="w-1 h-1 rounded-full" style={{ backgroundColor: k.color }} />
                                {k.sub}
                            </p>
                        </div>
                    </div>
                ))}
            </motion.div>

            {/* ── Visualizations Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                {/* Global Presence Doughnut */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="rounded-[2.5rem] bg-[#0a0a0a] border border-white/[0.04] p-8 flex flex-col items-center justify-center relative shadow-xl hover:border-blue-500/20 group transition-all">
                    <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-6 absolute top-8 left-8">Attendance Ratio</h3>
                    <div className="relative w-56 h-56 mt-4">
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-5xl font-black text-white tracking-tighter">{overallAttendance}%</span>
                            <span className="text-[10px] mt-1 font-black text-blue-500 uppercase tracking-widest">Global</span>
                        </div>
                    </div>
                </motion.div>

                {/* Day of Week Spline */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="lg:col-span-2 rounded-[2.5rem] bg-[#0a0a0a] border border-white/[0.04] p-8 flex flex-col shadow-xl hover:border-blue-500/20 transition-all">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black text-white/50 uppercase tracking-widest">Weekly Consistency Pattern</h3>
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase">
                            <Sparkles size={12} /> Trajectory
                        </div>
                    </div>
                    <div className="flex-1 w-full relative min-h-[220px]">
                        {days.length > 0 ? (
                            <Line data={lineData} options={lineOptions} />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs font-bold uppercase tracking-widest">No data available</div>
                        )}
                    </div>
                </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
                {/* Subject Matrix Radar */}
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }} className="lg:col-span-1 rounded-[2.5rem] bg-[#0a0a0a] border border-white/[0.04] p-8 relative shadow-xl hover:border-blue-500/20 transition-all flex flex-col items-center">
                    <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-6 w-full text-left">Subject Matrix</h3>
                    <div className="h-[260px] w-full mt-2">
                        {subjects.length > 0 ? (
                            <Radar data={radarData} options={radarOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-white/20 text-xs font-bold uppercase tracking-widest">Not enough subjects</div>
                        )}
                    </div>
                </motion.div>

                {/* Detailed Breakdown Grid */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="lg:col-span-2 rounded-[2.5rem] bg-[#0a0a0a] border border-white/[0.04] p-8 shadow-xl">
                    <h3 className="text-xs font-black text-white/50 uppercase tracking-widest mb-6">Deep Component Tracking</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {subjects.map((subject: any, idx: number) => (
                            <div key={idx} className="rounded-2xl border border-white/[0.03] bg-white/[0.01] p-5 hover:bg-white/[0.02] hover:border-blue-500/10 transition-colors group">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-sm text-white/90 truncate mr-3 group-hover:text-blue-400 transition-colors uppercase">{subject.name}</h4>
                                    <span className="text-lg font-black text-white tracking-tighter leading-none">{subject.percentage || 0}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/[0.02] mb-3">
                                    <div
                                        className={`h-full transition-all duration-700 ${subject.percentage < targetThreshold ? 'bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]'}`}
                                        style={{ width: `${subject.percentage || 0}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-[9px] font-black tracking-widest uppercase text-white/30">
                                    <span>{subject.attended} / {subject.total} Sessions</span>
                                    <span>Target: {subject.target && subject.target !== 75 ? subject.target : targetThreshold}%</span>
                                </div>
                            </div>
                        ))}
                        {subjects.length === 0 && (
                            <div className="col-span-1 md:col-span-2 text-center py-10 text-white/20 text-xs font-bold tracking-widest uppercase">
                                No subject data available.
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.5); }
            `}</style>
        </div>
    );
};

export default Analytics;