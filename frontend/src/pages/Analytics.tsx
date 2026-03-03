import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, RadialLinearScale, Filler, Tooltip as ChartTooltip, Legend,
    type ChartOptions,
} from 'chart.js';
import { Bar, Doughnut, Radar } from 'react-chartjs-2';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSemester } from '@/contexts/SemesterContext';
import { useTheme } from '@/contexts/ThemeContext';
import GlassCard from '@/components/ui/GlassCard';
import Skeleton from '@/components/ui/Skeleton';
import { TrendingUp, TrendingDown, BookOpen, AlertCircle, CheckCircle, Award } from 'lucide-react';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, RadialLinearScale, Filler, ChartTooltip, Legend
);

const Analytics: React.FC = () => {
    const { theme } = useTheme();
    const { currentSemester } = useSemester();
    const { dayOfWeekData, reportsData, loading } = useAnalytics();
    const isDark = theme === 'dark';

    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const tickColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)';
    const tooltipBg = isDark ? '#1e1e2e' : '#fff';
    const tooltipText = isDark ? '#e2e8f0' : '#1e293b';

    const weeklyData = useMemo(() => {
        const raw = dayOfWeekData?.days || [];
        return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
            const d: any = raw.find((x: any) => x.day === day) || { present: 0, total: 0, percentage: 0 };
            return { day, present: d.present, absent: Math.max(0, d.total - d.present), percentage: d.percentage, total: d.total };
        });
    }, [dayOfWeekData]);

    const subjects = useMemo(() =>
        (reportsData?.subject_breakdown || [])
            .map((s: any) => ({
                ...s,
                percentage: s.percentage ?? (s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0),
            }))
            .sort((a: any, b: any) => b.percentage - a.percentage),
        [reportsData]
    );

    const totalPresent = weeklyData.reduce((a, d) => a + d.present, 0);
    const totalAbsent = weeklyData.reduce((a, d) => a + d.absent, 0);

    const overallPct = useMemo(() => {
        const att = subjects.reduce((a: number, s: any) => a + (s.attended || 0), 0);
        const tot = subjects.reduce((a: number, s: any) => a + (s.total || 0), 0);
        return tot > 0 ? Math.round((att / tot) * 100) : 0;
    }, [subjects]);

    const safeSubs = subjects.filter((s: any) => s.percentage >= 75).length;
    const atRiskSubs = subjects.filter((s: any) => s.percentage < 75).length;
    const isOnTrack = overallPct >= 75;

    const weekBarData = {
        labels: weeklyData.map(d => d.day),
        datasets: [
            { label: 'Present', data: weeklyData.map(d => d.present), backgroundColor: '#10b981', borderRadius: 6, borderSkipped: false },
            { label: 'Absent', data: weeklyData.map(d => d.absent), backgroundColor: isDark ? 'rgba(244,63,94,0.5)' : 'rgba(244,63,94,0.4)', borderRadius: 0, borderSkipped: false },
        ],
    };
    const weekBarOpts: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: tooltipBg, titleColor: tooltipText, bodyColor: tickColor, borderColor: gridColor, borderWidth: 1 },
        },
        scales: {
            x: { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: tickColor, font: { size: 11 } } },
            y: { stacked: true, grid: { color: gridColor }, border: { display: false }, ticks: { color: tickColor, font: { size: 10 }, maxTicksLimit: 5 } },
        },
    };

    const doughnutData = {
        labels: ['Present', 'Absent'],
        datasets: [{ data: [totalPresent, totalAbsent], backgroundColor: ['#10b981', isDark ? 'rgba(244,63,94,0.55)' : 'rgba(244,63,94,0.4)'], borderWidth: 0, hoverOffset: 6 }],
    };
    const doughnutOpts: ChartOptions<'doughnut'> = {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: { legend: { display: false }, tooltip: { backgroundColor: tooltipBg, titleColor: tooltipText, bodyColor: tickColor } },
    };

    const radarSubjs = subjects.slice(0, 7);
    const radarData = {
        labels: radarSubjs.map((s: any) => s.name?.length > 12 ? s.name.slice(0, 12) + '\u2026' : s.name),
        datasets: [{
            label: 'Attendance %',
            data: radarSubjs.map((s: any) => s.percentage),
            backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
            borderColor: '#6366f1', borderWidth: 2,
            pointBackgroundColor: '#6366f1', pointRadius: 3,
        }],
    };
    const radarOpts: ChartOptions<'radar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: tooltipBg, titleColor: tooltipText, bodyColor: tickColor } },
        scales: {
            r: {
                min: 0, max: 100,
                ticks: { stepSize: 25, color: tickColor, font: { size: 9 }, backdropColor: 'transparent' },
                grid: { color: gridColor },
                pointLabels: { color: tickColor, font: { size: 10 } },
                angleLines: { color: gridColor },
            },
        },
    };

    if (loading) return (
        <div className="space-y-6 pb-24">
            <Skeleton className="h-28 rounded-2xl" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Skeleton className="lg:col-span-2 h-72 rounded-2xl" />
                <Skeleton className="h-72 rounded-2xl" />
            </div>
        </div>
    );

    return (
        <div className="pb-24 space-y-6">

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-2xl font-bold text-on-surface">Analytics</h1>
                <p className="text-sm text-on-surface-variant mt-0.5">Semester {currentSemester} — attendance breakdown</p>
            </motion.div>

            {/* Overview stat cards */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Overall', value: `${overallPct}%`,
                        icon: isOnTrack ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />,
                        color: isOnTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                        bg: isOnTrack ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20',
                        badge: isOnTrack ? 'On Track' : 'At Risk',
                        badgeColor: isOnTrack ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
                    },
                    {
                        label: 'Subjects', value: subjects.length,
                        icon: <BookOpen className="w-5 h-5" />,
                        color: 'text-indigo-600 dark:text-indigo-400',
                        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
                    },
                    {
                        label: 'Safe', value: safeSubs,
                        icon: <CheckCircle className="w-5 h-5" />,
                        color: 'text-emerald-600 dark:text-emerald-400',
                        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
                    },
                    {
                        label: 'At Risk', value: atRiskSubs,
                        icon: <AlertCircle className="w-5 h-5" />,
                        color: 'text-rose-600 dark:text-rose-400',
                        bg: 'bg-rose-50 dark:bg-rose-900/20',
                    },
                ].map((stat, i) => (
                    <GlassCard key={stat.label} className="p-4">
                        <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-3 ${stat.bg} ${stat.color}`}>
                            {stat.icon}
                        </div>
                        <p className="text-xs text-on-surface-variant font-medium">{stat.label}</p>
                        <p className={`text-2xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
                        {stat.badge && (
                            <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${stat.badgeColor}`}>
                                {stat.badge}
                            </span>
                        )}
                    </GlassCard>
                ))}
            </motion.div>

            {/* Weekly bar + Doughnut */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <motion.div className="lg:col-span-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <GlassCard className="p-5 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Weekly Breakdown</p>
                                <h3 className="text-base font-bold text-on-surface mt-0.5">Day-by-Day Attendance</h3>
                            </div>
                            <div className="flex gap-4 text-xs text-on-surface-variant">
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />Present</span>
                                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400 inline-block" />Absent</span>
                            </div>
                        </div>
                        <div className="flex-1" style={{ minHeight: 240 }}>
                            <Bar data={weekBarData} options={weekBarOpts} />
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
                    <GlassCard className="p-5 h-full flex flex-col">
                        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Split</p>
                        <h3 className="text-base font-bold text-on-surface mb-4">Present vs Absent</h3>
                        <div className="flex-1 relative flex items-center justify-center" style={{ minHeight: 180 }}>
                            <Doughnut data={doughnutData} options={doughnutOpts} />
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className={`text-2xl font-bold ${isOnTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>{overallPct}%</span>
                                <span className="text-[10px] text-on-surface-variant">overall</span>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2 text-sm">
                            {[
                                { label: 'Present', val: totalPresent, color: 'bg-emerald-500' },
                                { label: 'Absent', val: totalAbsent, color: 'bg-rose-400' },
                            ].map(item => (
                                <div key={item.label} className="flex justify-between items-center">
                                    <span className="flex items-center gap-2 text-on-surface-variant">
                                        <span className={`w-2 h-2 rounded-full ${item.color}`} />
                                        {item.label}
                                    </span>
                                    <span className="font-semibold text-on-surface">{item.val}</span>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                </motion.div>
            </div>

            {/* Rankings + Radar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Subject Rankings */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <GlassCard className="p-5 h-full flex flex-col">
                        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Rankings</p>
                        <h3 className="text-base font-bold text-on-surface mb-4">Subjects by Attendance</h3>
                        <div className="space-y-2 flex-1">
                            {subjects.length === 0 && (
                                <p className="text-on-surface-variant/60 text-sm py-6 text-center">No subjects for this semester</p>
                            )}
                            {subjects.slice(0, 7).map((s: any, i: number) => {
                                const pct = s.percentage;
                                const safe = pct >= 75;
                                return (
                                    <div key={s._id || i} className="flex items-center gap-3 group">
                                        <span className={`text-sm font-bold w-5 text-center shrink-0 ${i === 0 ? 'text-amber-500' : 'text-on-surface-variant/30'}`}>
                                            {i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-sm font-medium text-on-surface truncate">{s.name}</p>
                                                <span className={`text-xs font-bold ml-2 shrink-0 ${safe ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {pct}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-outline-variant/40 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${safe ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                        {i === 0 && (
                                            <span className="shrink-0 text-[9px] font-bold text-amber-600 dark:text-amber-400 border border-amber-400/40 px-1.5 py-0.5 rounded">TOP</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Radar */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                    <GlassCard className="p-5 h-full flex flex-col">
                        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">Fingerprint</p>
                        <h3 className="text-base font-bold text-on-surface mb-4">Subject Radar</h3>
                        {radarSubjs.length > 2 ? (
                            <div className="flex-1" style={{ minHeight: 260 }}>
                                <Radar data={radarData} options={radarOpts} />
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-on-surface-variant/40 text-sm py-8">
                                Need \u2265 3 subjects to show radar
                            </div>
                        )}
                    </GlassCard>
                </motion.div>
            </div>

            {/* At Risk */}
            {atRiskSubs > 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
                    <GlassCard className="p-5 border-rose-200 dark:border-rose-800/50">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                            <h3 className="text-base font-bold text-on-surface">At Risk Subjects</h3>
                            <span className="ml-auto text-xs text-on-surface-variant">Need 75% to be safe</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {subjects.filter((s: any) => s.percentage < 75).map((s: any, i: number) => {
                                const needed = Math.max(0, Math.ceil((0.75 * s.total - s.attended) / 0.25));
                                return (
                                    <div key={s._id || i} className="p-4 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-900/10">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="font-semibold text-sm text-on-surface">{s.name}</p>
                                            <span className="text-sm font-bold text-rose-600 dark:text-rose-400">{s.percentage}%</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-rose-100 dark:bg-rose-900/40 overflow-hidden mb-2">
                                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${s.percentage}%` }} />
                                        </div>
                                        <p className="text-xs text-on-surface-variant">
                                            Attend <span className="font-bold text-rose-600 dark:text-rose-400">{needed}</span> more consecutive classes to reach 75%
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </GlassCard>
                </motion.div>
            )}

        </div>
    );
};

export default Analytics;