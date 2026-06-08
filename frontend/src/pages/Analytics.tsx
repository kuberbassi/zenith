import React from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement,
    PointElement, LineElement, Title, Tooltip, Legend,
    RadialLinearScale, ArcElement, Filler
} from 'chart.js';
import { useAnalytics } from '@/hooks/useAnalytics';
import { TrendingUp, Activity, Award, AlertTriangle, CalendarDays } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    Title, Tooltip, Legend, RadialLinearScale, ArcElement, Filler
);

const Analytics: React.FC = () => {
    const { reportsData, dayOfWeekData, loading } = useAnalytics();
    const { user } = useAuth();
    const targetThreshold = user?.attendance_threshold || 75;

    usePageMeta({
        title: 'Analytics | Zenith',
        description: 'Deep-dive into your attendance trends, subject performance, and academic analytics.',
    });

    const isDark = document.documentElement.classList.contains('dark');

    // Clean Stark Themes (Monochrome Focus)
    const accentColor = isDark ? '#ffffff' : '#000000';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    const tickColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';

    if (loading) {
        return (
            <div className="pb-24 max-w-7xl mx-auto px-4 space-y-6">
                <div className="animate-pulse h-16 bg-surface-container border border-outline rounded-lg" />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="animate-pulse h-24 bg-surface-container border border-outline rounded-lg" />
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse h-20 bg-surface-container border border-outline rounded-lg" />
                    ))}
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

    const levelCopy: Record<string, { label: string; color: string }> = {
        legend: { label: 'Legend Mode', color: isDark ? '#ffffff' : '#000000' },
        elite: { label: 'Elite Run', color: isDark ? '#ffffff' : '#000000' },
        steady: { label: 'Steady Climb', color: isDark ? '#ffffff' : '#000000' },
        recovery: { label: 'Recovery Arc', color: '#f97316' },
        danger: { label: 'Critical Zone', color: '#ef4444' },
    };
    const currentLevel = levelCopy[kpis.achievement_level || 'steady'] || levelCopy.steady;
    const momentumText = Number(kpis.attendance_momentum || 0) >= 0 ? `+${kpis.attendance_momentum || 0}%` : `${kpis.attendance_momentum || 0}%`;

    const focusSubjects = [...subjects]
        .filter((s: any) => (s.total || 0) > 0)
        .sort((a: any, b: any) => (a.percentage || 0) - (b.percentage || 0))
        .slice(0, 6);

    // Chart configs
    const focusBarData = {
        labels: focusSubjects.map((s: any) => s.name.substring(0, 14) + (s.name.length > 14 ? '..' : '')),
        datasets: [{
            label: 'Attendance %',
            data: focusSubjects.map((s: any) => s.percentage || 0),
            backgroundColor: focusSubjects.map((s: any) => (s.percentage || 0) < targetThreshold ? 'rgba(239,68,68,0.7)' : accentColor),
            borderRadius: 4,
        }]
    };

    const focusBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: isDark ? '#111' : '#fff',
                titleColor: isDark ? '#fff' : '#000',
                bodyColor: isDark ? '#ccc' : '#444',
                padding: 10,
                borderColor: gridColor,
                borderWidth: 1,
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10, weight: 'bold' as const } } },
            y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: tickColor, callback: (value: number | string) => `${value}%` } }
        }
    };

    const doughnutData = {
        labels: ['Attended', 'Missed'],
        datasets: [{
            data: [totalAttended, totalClasses - totalAttended],
            backgroundColor: [accentColor, isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'],
            borderWidth: 0,
        }]
    };

    const doughnutOptions = {
        cutout: '80%',
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
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0, 0, 0, 0.02)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: isDark ? '#000000' : '#ffffff',
                pointBorderColor: accentColor,
                pointBorderWidth: 1.5,
                pointRadius: 4,
            }
        ]
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: isDark ? '#111' : '#fff',
                titleColor: isDark ? '#fff' : '#000',
                bodyColor: isDark ? '#ccc' : '#444',
                padding: 10,
                borderColor: gridColor,
                borderWidth: 1,
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10, weight: 'bold' as const } } },
            y: { grid: { color: gridColor }, ticks: { color: tickColor, stepSize: 1, font: { size: 10 } }, beginAtZero: true }
        }
    };

    return (
        <div className="pb-24 max-w-7xl mx-auto px-4">
            {/* Page Header */}
            <div className="mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-1">
                    Reports / Analytics
                </p>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Analytics</h1>
                        <p className="text-xs text-on-surface-variant/40 mt-0.5">
                            {overallAttendance}% overall · <span className="font-bold" style={{ color: currentLevel.color }}>{currentLevel.label}</span>
                        </p>
                    </div>
                </div>
                <div className="mt-4 h-px bg-outline" />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
                {[
                    { label: 'Attendance', val: `${kpis.overall_percentage ?? overallAttendance}%`, sub: `Goal: ${kpis.target_threshold ?? targetThreshold}%`, icon: <Activity size={12} /> },
                    { label: 'Consistency', val: `${kpis.consistency_score ?? overallAttendance}`, sub: currentLevel.label, icon: <TrendingUp size={12} /> },
                    { label: 'At Risk', val: `${kpis.at_risk_count ?? 0}`, sub: `of ${kpis.total_subjects ?? subjects.length} subjects`, icon: <AlertTriangle size={12} />, danger: (kpis.at_risk_count ?? 0) > 0 },
                    { label: 'Safe Bunks', val: `${kpis.safe_bunks_remaining ?? 0}`, sub: 'before threshold', icon: <CalendarDays size={12} /> },
                    { label: 'CGPA', val: Number(kpis.academic_standing || kpis.cgpa || 0).toFixed(2), sub: 'Standing score', icon: <Award size={12} /> },
                ].map((k, i) => (
                    <div key={i} className="rounded-lg border border-outline bg-surface p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40">{k.label}</span>
                            <span className={`${k.danger ? 'text-red-500' : 'text-on-surface-variant/30'}`}>{k.icon}</span>
                        </div>
                        <div>
                            <p className={`text-2xl font-bold tracking-tight ${k.danger ? 'text-red-500' : 'text-on-surface'}`}>{k.val}</p>
                            <p className="text-[9px] text-on-surface-variant/40 mt-1 font-semibold">{k.sub}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Insight cards row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
                <div className="rounded-lg border border-outline bg-surface p-5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40 mb-2">Momentum</p>
                    <p className="text-2xl font-bold tracking-tight text-on-surface">{momentumText}</p>
                    <p className="mt-1 text-[10px] text-on-surface-variant/40 font-semibold">Shift in attendance logs performance.</p>
                </div>
                <div className="rounded-lg border border-outline bg-surface p-5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40 mb-2">Strongest Course</p>
                    <p className="text-sm font-bold text-on-surface tracking-tight truncate">{kpis.best_subject_name || 'N/A'}</p>
                    <p className="mt-1 text-[10px] text-on-surface-variant/40 font-semibold">{kpis.best_subject_percent || '0%'} attendance record.</p>
                </div>
                <div className="rounded-lg border border-outline bg-surface p-5">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40 mb-2">Recommendation</p>
                    <p className="text-xs font-bold text-on-surface leading-snug">{kpis.focus_label || 'Maintain target across all subjects.'}</p>
                </div>
            </div>

            {/* Visualization Row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 rounded-lg bg-surface border border-outline p-5 flex flex-col justify-between min-h-[260px]">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40 mb-4">Ratio Analysis</p>
                    <div className="relative w-40 h-40 mx-auto">
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-on-surface tracking-tight">{overallAttendance}%</span>
                            <span className="text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-wider">Total</span>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 rounded-lg bg-surface border border-outline p-5 flex flex-col min-h-[260px]">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40 mb-4">Weekly Trend</p>
                    <div className="flex-1 w-full relative min-h-[180px]">
                        {days.length > 0 ? (
                            <Line data={lineData} options={lineOptions} />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant/20 text-xs">No logs registered</div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 rounded-lg bg-surface border border-outline p-5 flex flex-col min-h-[280px]">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40 mb-4">Immediate Attention</p>
                    <div className="flex-1 relative min-h-[200px]">
                        {focusSubjects.length > 0 ? (
                            <Bar data={focusBarData} options={focusBarOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-on-surface-variant/20 text-xs">All records look clear</div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-3 rounded-lg bg-surface border border-outline p-5 min-h-[280px]">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/40 mb-4">Subject breakdown</p>
                    <div className="space-y-4 max-h-[200px] overflow-y-auto pr-1">
                        {subjects.map((subject: any, idx: number) => (
                            <div key={idx} className="space-y-1">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-on-surface truncate pr-4">{subject.name}</span>
                                    <span className={`font-bold shrink-0 ${subject.percentage < targetThreshold ? 'text-red-500' : 'text-on-surface'}`}>{subject.percentage || 0}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-on-surface/10 rounded overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ${subject.percentage < targetThreshold ? 'bg-red-500' : accentColor}`} style={{ width: `${subject.percentage || 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
