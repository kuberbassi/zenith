import React from 'react';
import { motion } from 'framer-motion';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
    ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip as ChartTooltip,
} from 'chart.js';
import {
    Activity, BarChart3, BookOpen, Download, PieChart, RefreshCw, ShieldCheck, TrendingUp
} from 'lucide-react';
import CircularProgress from '@/components/ui/CircularProgress';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, Filler, ChartTooltip, Legend,
);

type ResultsDashboardProps = {
    user: any;
    results: any;
    profileInfo: any;
    displayBatch: string;
    lastUpdated: string | null;
    formatDate: (value: string | null) => string;
    handleSyncClick: () => void;
    onOpenPdf: () => void;
    selectedSem: string;
    setSelectedSem: (value: string) => void;
    currentMetrics: any;
    metrics: any;
    semMetrics: any;
    academicStrength: number;
    performanceSummary: any;
    chartSubjects: any[];
    barChartData: any;
    barChartOptions: any;
    marksBreakdownData: any;
    marksBreakdownOptions: any;
    currentSubjects: any[];
    currentSemesterMeta: any;
    gradeDistributionData: any;
    doughnutOptions: any;
    accentColor: string;
    getSubjectMarks: (subject: any) => { total: number; maxMarks: number; hasExplicitTotal: boolean };
    getSubjectDisplayMark: (value: unknown) => string;
    gradeBgClass: (grade: string) => string;
    getSubjectPercentage: (subject: any) => number;
};

const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
    user,
    results,
    profileInfo,
    displayBatch,
    lastUpdated,
    formatDate,
    handleSyncClick,
    onOpenPdf,
    selectedSem,
    setSelectedSem,
    currentMetrics,
    metrics,
    semMetrics,
    academicStrength,
    performanceSummary,
    chartSubjects,
    barChartData,
    barChartOptions,
    marksBreakdownData,
    marksBreakdownOptions,
    currentSubjects,
    currentSemesterMeta,
    gradeDistributionData,
    doughnutOptions,
    accentColor,
    getSubjectMarks,
    getSubjectDisplayMark,
    gradeBgClass,
    getSubjectPercentage,
}) => {
    return (
        <div className="space-y-6">
            <motion.section
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                className="relative rounded-3xl border border-white/[0.06] glass-panel p-8 md:p-12 overflow-hidden"
                style={{ boxShadow: '0 0 80px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.04)' }}
            >
                <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-white/10/[0.03] blur-[100px] pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck size={18} className="text-white" />
                            <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em]">Verified Academic Record</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">{profileInfo?.name || user?.name}</h1>
                        <p className="text-white/60 font-medium tracking-wide mb-8">{profileInfo?.programme || 'Programme unavailable'} • Batch {displayBatch}</p>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
                            <div><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Enrollment</p><p className="text-sm font-bold text-white/70">{results.enrollment_number}</p></div>
                            <div><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Batch</p><p className="text-sm font-bold text-white/70">{displayBatch}</p></div>
                            <div><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Admission Year</p><p className="text-sm font-bold text-white/70">{profileInfo?.admission_year || '---'}</p></div>
                            <div><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Gender</p><p className="text-sm font-bold text-white/70">{profileInfo?.gender || '---'}</p></div>
                            <div><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Father's Name</p><p className="text-sm font-bold text-white/70">{profileInfo?.father || '---'}</p></div>
                            <div><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Mother's Name</p><p className="text-sm font-bold text-white/70">{profileInfo?.mother || '---'}</p></div>
                            <div><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Phone</p><p className="text-sm font-bold text-white/70">{profileInfo?.phone || '---'}</p></div>
                            <div><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Email</p><p className="text-sm font-bold text-white/70 truncate">{profileInfo?.email || '---'}</p></div>
                            <div className="col-span-2 md:col-span-1"><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Institution</p><p className="text-sm font-bold text-white/70 truncate">{profileInfo?.institution || '---'}</p></div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-white/5">
                            <div>
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white/10 animate-pulse inline-block" />
                                    Last Synced
                                </p>
                                <p className="text-xs font-bold text-white/40">{formatDate(lastUpdated)}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button onClick={handleSyncClick} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-white hover:bg-white/10 transition-all"><RefreshCw size={12} /> Sync Results</button>
                                <button onClick={onOpenPdf} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-white hover:bg-emerald-500/20 transition-all"><Download size={12} /> Download PDF</button>
                            </div>
                        </div>
                    </div>

                    <div className="relative flex items-center justify-center">
                        <CircularProgress
                            value={selectedSem === 'overall' ? (results.academicStrength ?? academicStrength ?? 0) : academicStrength}
                            max={100}
                            primaryColor={accentColor}
                            secondaryColor="rgba(255,255,255,0.02)"
                            glowColor="rgba(59, 130, 246, 0.4)"
                            size={160}
                            strokeWidth={10}
                        >
                            <div className="text-center">
                                <p className="text-5xl font-black text-white tracking-tighter leading-none">{results.cgpa ? parseFloat(results.cgpa).toFixed(2) : (metrics?.cgpa?.toFixed(2) || '---')}</p>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-2">{Math.round(selectedSem === 'overall' ? (results.academicStrength ?? academicStrength ?? 0) : academicStrength)}%</p>
                            </div>
                        </CircularProgress>
                    </div>
                </div>
            </motion.section>

            <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedSem('overall')} className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedSem === 'overall' ? 'bg-white/10 text-white shadow-lg shadow-white/10' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>Overview</button>
                {results.semesters.map((s: any) => (
                    <button key={s.semester} onClick={() => setSelectedSem(s.semester)} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedSem === s.semester ? 'bg-white/10 text-white' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>
                        Sem {s.semester}
                    </button>
                ))}
            </div>

            {currentMetrics && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Scored', val: `${currentMetrics.totalMarks}/${currentMetrics.totalMaxMarks}`, icon: <BarChart3 size={15} />, color: accentColor },
                        { label: 'Pass Rate', val: `${currentMetrics.passRate}%`, icon: <TrendingUp size={15} />, color: '#ffffff' },
                        { label: selectedSem === 'overall' ? 'CGPA' : 'SGPA', val: (selectedSem === 'overall' ? metrics?.cgpa : semMetrics?.sgpa)?.toFixed(2) ?? '---', icon: <Activity size={15} />, color: '#8b5cf6' },
                        { label: 'Credits', val: currentMetrics.totalCredits ? String(Math.round(currentMetrics.totalCredits)) : '---', icon: <BookOpen size={15} />, color: 'rgba(255,255,255,0.8)' },
                    ].map(k => (
                        <div key={k.label} className="rounded-2xl border border-white/[0.08] glass-panel p-5 md:p-6 flex flex-col justify-between min-h-[148px] group transition-all duration-500 hover:border-white/10" style={{ boxShadow: '0 0 20px rgba(255,255,255,0.01), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-white/25 uppercase tracking-[0.18em]">{k.label}</span>
                                <div style={{ color: `${k.color}80` }} className="group-hover:scale-110 transition-transform">{k.icon}</div>
                            </div>
                            <p className="text-[2rem] md:text-[2.35rem] leading-none font-black tracking-[-0.05em]" style={{ color: k.color }}>{k.val}</p>
                        </div>
                    ))}
                </motion.div>
            )}

            {currentMetrics && performanceSummary && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-white/[0.08] glass-panel p-5"><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Academic Power</p><p className="text-3xl font-black tracking-tighter text-white">{Math.round(academicStrength)}%</p><p className="text-xs text-white/35 mt-2">Single score that compresses marks strength into one quick read.</p></div>
                    <div className="rounded-2xl border border-white/[0.08] glass-panel p-5"><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Strongest Subject</p><p className="text-2xl font-black tracking-tighter text-white">{performanceSummary.strongest?.code || performanceSummary.strongest?.name || '---'}</p><p className="text-xs text-white/35 mt-2">{performanceSummary.strongest ? `${getSubjectPercentage(performanceSummary.strongest)}% with ${performanceSummary.strongest.grade || 'no grade'}` : 'No completed subjects yet.'}</p></div>
                    <div className="rounded-2xl border border-white/[0.08] glass-panel p-5"><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Attention Needed</p><p className="text-2xl font-black tracking-tighter text-amber-400">{performanceSummary.weakest?.code || performanceSummary.weakest?.name || '---'}</p><p className="text-xs text-white/35 mt-2">{performanceSummary.weakest ? `${getSubjectPercentage(performanceSummary.weakest)}% and grade ${performanceSummary.weakest.grade || 'pending'}` : 'No weak subject detected.'}</p></div>
                    <div className="rounded-2xl border border-white/[0.08] glass-panel p-5"><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Distinction Count</p><p className="text-3xl font-black tracking-tighter text-fuchsia-400">{performanceSummary.distinctionCount}</p><p className="text-xs text-white/35 mt-2">{performanceSummary.pendingCount > 0 ? `${performanceSummary.pendingCount} pending subjects excluded from this count.` : 'Subjects currently scoring 75% or above.'}</p></div>
                </motion.div>
            )}

            {chartSubjects.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <motion.div className="rounded-3xl border border-white/[0.08] glass-panel p-6 min-h-[350px] flex flex-col hover:border-white/10 transition-all duration-500">
                        <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-2">Score Distribution</h3>
                        <p className="text-xs text-white/30 mb-6">Clear ranking of subject-wise percentages so weak areas are obvious.</p>
                        <div className="flex-1"><Bar data={barChartData} options={barChartOptions} /></div>
                    </motion.div>
                    <motion.div className="rounded-3xl border border-white/[0.08] glass-panel p-6 min-h-[350px] flex flex-col hover:border-white/10 transition-all duration-500">
                        <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-2">Marks Composition</h3>
                        <p className="text-xs text-white/30 mb-6">Internal and external contributions per subject, useful for spotting missing or weak components.</p>
                        <div className="flex-1 pb-4"><Bar data={marksBreakdownData} options={marksBreakdownOptions} /></div>
                    </motion.div>
                </div>
            )}

            {selectedSem !== 'overall' && currentSubjects.length > 0 && (
                <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/[0.08] glass-panel overflow-hidden">
                    <div className="p-6 border-b border-white/[0.05] flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-sm font-black text-white/70 uppercase tracking-widest">{results.semesters.find((s: any) => s.semester === selectedSem)?.semester_label || 'Semester'} — Subjects</h3>
                            {currentSemesterMeta && (
                                <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/28">
                                    {currentSemesterMeta.examSession && <span>Exam {currentSemesterMeta.examSession}</span>}
                                    {currentSemesterMeta.examSession && currentSemesterMeta.declaredDate && <span className="mx-2 text-white/15">•</span>}
                                    {currentSemesterMeta.declaredDate && <span>Declared {currentSemesterMeta.declaredDate}</span>}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-white/5 text-white text-[10px] font-bold uppercase">{currentSubjects.length} Subjects</span>
                            {semMetrics && <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-bold uppercase">SGPA {semMetrics.sgpa.toFixed(2)}</span>}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white/[0.01]">
                                    <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase">Code</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase">Subject</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase text-center">Credits</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase text-center">Internal</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase text-center">External</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase text-center">Total</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase text-right">Grade</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {currentSubjects.map((sub: any, i: number) => {
                                    const { total, maxMarks, hasExplicitTotal } = getSubjectMarks(sub);
                                    const displayInternal = getSubjectDisplayMark(sub.internal ?? sub.internal_theory);
                                    const displayExternal = getSubjectDisplayMark(sub.external ?? sub.external_theory);
                                    return (
                                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4 text-xs font-mono text-white/30">{sub.code || '---'}</td>
                                            <td className="px-6 py-4 text-sm font-bold text-white/70 max-w-[200px]"><span className="truncate block">{sub.name}</span></td>
                                            <td className="px-6 py-4 text-center"><span className="text-sm font-black text-white/50">{sub.credits || '---'}</span></td>
                                            <td className="px-6 py-4 text-center"><span className="text-sm text-white/40">{sub.is_pending ? 'Pending' : displayInternal}</span></td>
                                            <td className="px-6 py-4 text-center"><span className="text-sm text-white/40">{sub.is_pending ? 'Pending' : displayExternal}</span></td>
                                            <td className="px-6 py-4 text-center"><span className="text-sm font-bold text-white/60">{sub.is_pending ? 'Pending' : total}<span className="text-white/20 text-xs">/{maxMarks}</span>{!sub.is_pending && !hasExplicitTotal && <span className="ml-2 text-[10px] text-white/20">derived</span>}</span></td>
                                            <td className="px-6 py-4 text-right"><span className={`px-3 py-1 rounded-lg text-xs font-black ${gradeBgClass(sub.grade)}`}>{sub.grade || '---'}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.section>
            )}

            {selectedSem === 'overall' && (
                <>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {results.semesters.map((sem: any) => {
                            const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : 0;
                            const semCredits = (sem.subjects || []).reduce((a: number, s: any) => a + (parseFloat(s.credits || '0') || 0), 0);
                            const passRate = sem.subjects?.length ? Math.round((sem.subjects.filter((s: any) => (s.grade ? true : false) && ((s.grade && ['O', 'A+', 'A', 'B+', 'B', 'C+', 'C', 'P'].includes(s.grade))).length / sem.subjects.length) * 100)) : 0;
                            return (
                                <div key={sem.semester} onClick={() => setSelectedSem(sem.semester)} className="cursor-pointer group rounded-2xl border border-white/[0.08] glass-panel p-6 hover:border-white/15 transition-all" style={{ boxShadow: '0 0 20px rgba(255,255,255,0.01), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">{sem.semester_label || `Semester ${sem.semester}`}</p>
                                            <p className="text-sm font-bold text-white/60 group-hover:text-white transition-colors">{sem.subjects?.length || 0} Subjects</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-white tracking-tighter group-hover:scale-105 transition-transform">{sgpa.toFixed(2)}</p>
                                            <p className="text-[10px] font-bold text-white/10 uppercase tracking-widest mt-0.5">SGPA</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-white/20 font-bold uppercase mb-2">
                                        <span>{Math.round(semCredits)} Credits</span>
                                        <span>{passRate}% Pass</span>
                                    </div>
                                    <div className="h-1 rounded-full bg-white/[0.03] overflow-hidden">
                                        <div className="h-full bg-white/20 rounded-full" style={{ width: `${(sgpa / 10) * 100}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </motion.div>

                    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-3xl border border-white/[0.08] glass-panel overflow-hidden">
                        <div className="p-6 border-b border-white/[0.05] flex items-center gap-3">
                            <PieChart size={16} className="text-white" />
                            <h3 className="text-sm font-black text-white/70 uppercase tracking-widest">Grade Distribution</h3>
                            <span className="ml-auto text-[10px] font-bold text-white/20 uppercase tracking-widest">Analytics</span>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className="h-64 relative">
                                <Doughnut data={gradeDistributionData} options={doughnutOptions} />
                                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                    <span className="text-3xl font-black text-white">{results.totalSubjects || metrics?.totalSubjects || 0}</span>
                                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Subjects</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                                    <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Grade</span>
                                    <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Count</span>
                                </div>
                                {gradeDistributionData.labels.map((lbl: any, idx: number) => (
                                    <div key={lbl} className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: gradeDistributionData.datasets[0].backgroundColor[idx] }} />
                                            <span className="text-sm font-black text-white/70">{lbl}</span>
                                        </div>
                                        <span className="text-sm font-bold text-white/60 tabular-nums bg-white/5 px-3 py-1 rounded-lg">{(results.gradeDistribution || {})[lbl]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.section>

                    <div className="pt-5 mt-6 border-t border-white/[0.05]">
                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-4">Semester GPA Breakdown</p>
                        <div className="space-y-3">
                            {results.semesters.map((sem: any) => {
                                const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : 0;
                                return (
                                    <div key={sem.semester} className="flex items-center gap-4">
                                        <span className="text-[10px] font-black text-white/20 uppercase w-24 shrink-0 truncate">{sem.semester_label || `Sem ${sem.semester}`}</span>
                                        <div className="flex-1 h-2 rounded-full bg-white/[0.03] overflow-hidden">
                                            <div className="h-full bg-white/25 rounded-full" style={{ width: `${(sgpa / 10) * 100}%` }} />
                                        </div>
                                        <span className="text-sm font-black text-white w-12 text-right tabular-nums">{sgpa.toFixed(2)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ResultsDashboard;
