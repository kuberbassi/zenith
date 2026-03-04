import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, RadialLinearScale, Filler, Tooltip as ChartTooltip, Legend,
    type ChartOptions,
} from 'chart.js';
import { Bar, Radar } from 'react-chartjs-2';
import {
    Eye, EyeOff, RefreshCw,
    Zap,
    GraduationCap, TrendingUp, BarChart3, ShieldCheck, Activity
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService } from '@/services/attendance.service';
import Button from '@/components/ui/Button';
import CircularProgress from '@/components/ui/CircularProgress';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, RadialLinearScale, Filler, ChartTooltip, Legend
);

/* ── Grade utilities ──────────────────────────────────────────────────── */
const GRADE_POINTS: Record<string, number> = {
    'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'P': 4, 'F': 0, 'Ab': 0, 'I': 0,
};

// GRADE_COLORS removed as unused

function calcSGPA(subjects: any[]): number {
    const valid = subjects.filter(s => s.credits && parseFloat(s.credits) > 0);
    if (!valid.length) return 0;
    const totalCr = valid.reduce((a: number, s: any) => a + parseFloat(s.credits), 0);
    const totalPt = valid.reduce((a: number, s: any) => a + (parseFloat(s.credits) * (GRADE_POINTS[s.grade] ?? 0)), 0);
    return parseFloat((totalPt / totalCr).toFixed(2));
}

function calcCGPA(semesters: any[]): number {
    const valid = semesters.filter(s => {
        const sgpa = s.sgpa ? parseFloat(s.sgpa) : calcSGPA(s.subjects || []);
        return sgpa > 0;
    });
    if (!valid.length) return 0;
    const total = valid.reduce((a: number, s: any) => {
        const sgpa = s.sgpa ? parseFloat(s.sgpa) : calcSGPA(s.subjects || []);
        return a + sgpa;
    }, 0);
    return parseFloat((total / valid.length).toFixed(2));
}

function gradeBgClass(grade: string): string {
    const pt = GRADE_POINTS[grade];
    if (pt === undefined || pt === 0) return 'bg-red-500/10 text-red-500 border border-red-500/20';
    if (pt >= 9) return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
    if (pt >= 7) return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
    if (pt >= 5) return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
    return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
}

/* ── Types ─────────────────────────────────────────────────────────────── */
type Step = 'loading' | 'form' | 'captcha' | 'results';

interface CaptchaInfo {
    captcha_image: string;
    hidden_fields: Record<string, string>;
    field_names: Record<string, string>;
    login_action?: string;
    ocr_attempted?: string;
}

/* ── Component ─────────────────────────────────────────────────────────── */
const Results: React.FC = () => {
    const { user } = useAuth();
    // resultsRef removed as unused

    const [step, setStep] = useState<Step>('loading');
    const [enrollmentNo, setEnrollmentNo] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [captchaInfo, setCaptchaInfo] = useState<CaptchaInfo | null>(null);
    const [captchaCode, setCaptchaCode] = useState('');
    const [captchaLoading, setCaptchaLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any | null>(null);
    const [selectedSem, setSelectedSem] = useState<string>('overall');
    // exportOpen, lastUpdated removed as unused

    // Accents
    const accentColor = '#3b82f6';
    const gridColor = 'rgba(255,255,255,0.04)';

    useEffect(() => {
        if (user?.enrollment_number) setEnrollmentNo(user.enrollment_number);
    }, [user?.enrollment_number]);

    useEffect(() => { loadSavedResults(); }, []);

    async function loadSavedResults() {
        try {
            const data = await attendanceService.getSavedIPUResults();
            if (data && data.semesters && data.semesters.length > 0) {
                setResults(data);
                setStep('results');
            } else { setStep('form'); }
        } catch { setStep('form'); }
    }

    async function handleAutoFetch() {
        if (!enrollmentNo.trim()) { setError('Please enter your enrollment number.'); return; }
        if (!password.trim()) { setError('Please enter your IPU portal password.'); return; }
        setError(null); setFetching(true);
        try {
            const data: any = await attendanceService.autoFetchIPUResults({ enrollment_number: enrollmentNo, password });
            if (data?.captcha_required) {
                setCaptchaInfo({
                    captcha_image: data.captcha_image,
                    hidden_fields: data.hidden_fields || {},
                    field_names: data.field_names || {},
                    login_action: data.login_action,
                    ocr_attempted: data.ocr_attempted,
                });
                setCaptchaCode(data.ocr_attempted || '');
                setStep('captcha');
            } else if (data?.semesters !== undefined) {
                setResults(data); setStep('results');
            } else { setError('Could not retrieve results.'); }
        } catch (e: any) { setError(e?.response?.data?.error || 'Failed to reach server.'); } finally { setFetching(false); }
    }

    async function refreshCaptcha() {
        if (captchaLoading) return;
        setCaptchaLoading(true); setCaptchaCode('');
        try {
            const data: any = await attendanceService.getIPUCaptcha();
            if (data?.captcha_image) {
                setCaptchaInfo({
                    captcha_image: data.captcha_image,
                    hidden_fields: data.hidden_fields || {},
                    field_names: data.field_names || {},
                    login_action: data.login_action,
                });
            }
        } catch { setError('Failed to refresh CAPTCHA.'); } finally { setCaptchaLoading(false); }
    }

    async function handleFetchResults() {
        if (!captchaCode.trim()) { setError('Please enter CAPTCHA.'); return; }
        setError(null); setFetching(true);
        try {
            const payload = {
                enrollment_number: enrollmentNo, password, captcha: captchaCode,
                hidden_fields: captchaInfo?.hidden_fields || {},
                field_names: captchaInfo!.field_names,
                login_action: captchaInfo?.login_action || '',
            };
            const data: any = await attendanceService.fetchIPUResults(payload);
            if (data?.semesters !== undefined) {
                setResults(data); setStep('results');
            } else { setError('Invalid credentials or CAPTCHA.'); await refreshCaptcha(); }
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to fetch.');
            await refreshCaptcha();
        } finally { setFetching(false); }
    }

    const inputCls = "w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.02] text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all";

    /* ── Computed metrics ──────────────────────────────────────────────── */
    const metrics = useMemo(() => {
        if (!results?.semesters?.length) return null;
        const sems = results.semesters;
        const cgpa = results.cgpa ? parseFloat(results.cgpa) : calcCGPA(sems);
        const allSubjects = sems.flatMap((s: any) => s.subjects || []);
        const totalMarks = allSubjects.reduce((a: number, s: any) => a + (parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'))), 0);
        const totalMaxMarks = allSubjects.reduce((a: number, s: any) => a + (parseFloat(s.max_marks || '100')), 0);
        const passRate = allSubjects.length ? Math.round((allSubjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) >= 4).length / allSubjects.length) * 100) : 0;
        const gradeDist: Record<string, number> = {};
        allSubjects.forEach((s: any) => { const g = s.grade || 'N/A'; gradeDist[g] = (gradeDist[g] || 0) + 1; });
        return { cgpa, passRate, totalSubjects: allSubjects.length, gradeDist, totalMarks, totalMaxMarks };
    }, [results]);

    const semMetrics = useMemo(() => {
        if (!results?.semesters?.length || selectedSem === 'overall') return null;
        const sem = results.semesters.find((s: any) => s.semester === selectedSem);
        if (!sem) return null;
        const subjects = sem.subjects || [];
        const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : calcSGPA(subjects);
        const totalMarks = subjects.reduce((a: number, s: any) => a + (parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'))), 0);
        const totalMaxMarks = subjects.reduce((a: number, s: any) => a + (parseFloat(s.max_marks || '100')), 0);
        const passRate = subjects.length ? Math.round((subjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) >= 4).length / subjects.length) * 100) : 0;
        return { sgpa, passRate, totalSubjects: subjects.length, totalMarks, totalMaxMarks, semLabel: sem.semester_label };
    }, [results, selectedSem]);

    const currentMetrics = selectedSem === 'overall' ? metrics : semMetrics;
    const currentSubjects = useMemo(() => {
        if (!results?.semesters) return [];
        if (selectedSem === 'overall') return results.semesters.flatMap((s: any) => s.subjects || []).slice(0, 20);
        return results.semesters.find((s: any) => s.semester === selectedSem)?.subjects || [];
    }, [results, selectedSem]);

    /* ── Chart data ───────────────────────────────────────────────────── */
    const barChartData = useMemo(() => ({
        labels: currentSubjects.slice(0, 12).map((s: any) => s.code || s.name?.substring(0, 8) || '?'),
        datasets: [
            { label: 'Marks', data: currentSubjects.slice(0, 12).map((s: any) => parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'))), backgroundColor: accentColor, borderRadius: 6 },
        ]
    }), [currentSubjects]);

    const barChartOptions: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 } } }, y: { grid: { color: gridColor }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 }, maxTicksLimit: 5 } } },
    };

    const radarOptions: ChartOptions<'radar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            r: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                angleLines: { color: 'rgba(255,255,255,0.05)' },
                pointLabels: { color: 'rgba(255,255,255,0.3)', font: { size: 8 } },
                ticks: { display: false, count: 5 }
            }
        },
    };

    const radarChartData = useMemo(() => ({
        labels: currentSubjects.slice(0, 8).map((s: any) => s.code || s.name?.substring(0, 8) || '?'),
        datasets: [{ label: 'Performance', data: currentSubjects.slice(0, 8).map((s: any) => { const tot = parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0')); return Math.round((tot / 100) * 100); }), backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: accentColor, borderWidth: 2, pointRadius: 2 }]
    }), [currentSubjects]);

    if (step === 'loading') return <div className="flex items-center justify-center h-screen"><RefreshCw className="animate-spin text-blue-500/40" /></div>;

    return (
        <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }} className="pb-28 max-w-[1320px] mx-auto pt-20 px-3 md:px-5">
            {/* ── Auth Form ──────────────────────────────────────────────── */}
            {step === 'form' && (
                <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="max-w-md mx-auto mt-10">
                    <div className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-8 shadow-2xl" style={{ boxShadow: '0 0 40px rgba(16,185,129,0.03), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20"><GraduationCap size={24} /></div>
                            <div><h2 className="text-xl font-black text-white tracking-tight">Academic Portal</h2><p className="text-xs text-white/30 font-medium tracking-wider uppercase">Secure Result Retrieval</p></div>
                        </div>
                        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400">{error}</div>}
                        <form onSubmit={(e) => { e.preventDefault(); handleAutoFetch(); }} className="space-y-4">
                            <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2 ml-1">Enrollment Number</label><input type="text" value={enrollmentNo} onChange={e => setEnrollmentNo(e.target.value)} placeholder="00000000000" className={inputCls} required /></div>
                            <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2 ml-1">Portal Password</label><div className="relative"><input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="********" className={inputCls} required /><button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div>
                            <Button type="submit" isLoading={fetching} className="w-full h-12 justify-center rounded-xl bg-blue-500 text-white font-black tracking-widest uppercase text-xs hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20" icon={<Zap size={14} />}>Initialize Link</Button>
                        </form>
                    </div>
                </motion.div>
            )}

            {/* ── Captcha ────────────────────────────────────────────────── */}
            {step === 'captcha' && (
                <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }} className="max-w-md mx-auto mt-10">
                    <div className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-8">
                        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-5">
                            <div><h2 className="text-xl font-black text-white tracking-tight">Security Check</h2><p className="text-xs text-white/30 font-medium">Verify human identity</p></div>
                            <button onClick={refreshCaptcha} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 active:scale-95 transition-transform"><RefreshCw size={16} className={captchaLoading ? 'animate-spin' : ''} /></button>
                        </div>
                        <div className="p-4 bg-white rounded-2xl mb-6 flex justify-center shadow-inner overflow-hidden">
                            {captchaInfo?.captcha_image ? (
                                <img
                                    src={captchaInfo.captcha_image.startsWith('data:') ? captchaInfo.captcha_image : `data:image/png;base64,${captchaInfo.captcha_image}`}
                                    alt="captcha"
                                    className="h-14 contrast-125 object-contain"
                                />
                            ) : (
                                <div className="h-14 flex items-center justify-center text-black/20 font-black text-[10px] uppercase">Loading Visual...</div>
                            )}
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleFetchResults(); }}>
                            <input value={captchaCode} onChange={e => setCaptchaCode(e.target.value)} placeholder="Type CAPTCHA..." className={`${inputCls} mb-4 text-center tracking-[0.4em] font-black uppercase`} required />
                            <div className="flex gap-2">
                                <Button type="button" onClick={() => setStep('form')} variant="secondary" className="flex-1 justify-center rounded-xl bg-white/5 border border-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest">Back</Button>
                                <Button type="submit" isLoading={fetching} className="flex-1 justify-center rounded-xl bg-blue-500 text-white font-black tracking-widest uppercase text-[10px] shadow-lg shadow-blue-500/20">Verify</Button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            )}

            {/* ── Results ────────────────────────────────────────────────── */}
            {step === 'results' && results && (
                <div className="space-y-6">
                    {/* Cinematic Header — Beacon Style */}
                    <motion.section initial="hidden" animate="visible" variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }} className="relative rounded-3xl border border-white/[0.06] bg-[#050508] p-8 md:p-12 overflow-hidden" style={{ boxShadow: '0 0 80px rgba(16,185,129,0.04), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                        <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-blue-500/[0.03] blur-[100px] pointer-events-none" />
                        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <ShieldCheck size={18} className="text-blue-400" />
                                    <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em]">Verified Academic Record</span>
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">{results.student_info?.name || user?.name}</h1>
                                <p className="text-blue-400/60 font-medium tracking-wide mb-8">{results.student_info?.programme} &bull; Batch {results.student_info?.batch}</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    <div className="text-left"><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Enrollment</p><p className="text-sm font-bold text-white/70">{results.enrollment_number}</p></div>
                                    <div className="text-left"><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Institution</p><p className="text-sm font-bold text-white/70 truncate">{results.student_info?.institution}</p></div>
                                    <div className="text-left col-span-2 md:col-span-1 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2 font-mono flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Final Verification</p>
                                        <button onClick={() => setStep('form')} className="text-xs font-black text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2"><RefreshCw size={12} /> Sync Database</button>
                                    </div>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-center">
                                <CircularProgress
                                    value={(metrics?.cgpa || 0) * 10} max={100} primaryColor={accentColor} secondaryColor="rgba(255,255,255,0.02)" glowColor="rgba(16, 185, 129, 0.4)" size={160} strokeWidth={10}
                                >
                                    <div className="text-center">
                                        <p className="text-5xl font-black text-white tracking-tighter leading-none">{metrics?.cgpa?.toFixed(2) || '—'}</p>
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-2">CGPA</p>
                                    </div>
                                </CircularProgress>
                            </div>
                        </div>
                    </motion.section>

                    {/* Navigation Tabs */}
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedSem('overall')} className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedSem === 'overall' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>Overall</button>
                        {results.semesters.map((s: any) => (
                            <button key={s.semester} onClick={() => setSelectedSem(s.semester)} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedSem === s.semester ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>Sem {s.semester}</button>
                        ))}
                    </div>

                    {/* KPI Cards */}
                    {currentMetrics && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Total Marks', val: `${currentMetrics.totalMarks}/${currentMetrics.totalMaxMarks}`, icon: <BarChart3 size={15} />, color: accentColor },
                                { label: 'Performance', val: `${((currentMetrics.totalMarks / currentMetrics.totalMaxMarks) * 100).toFixed(1)}%`, icon: <TrendingUp size={15} />, color: '#3b82f6' },
                                { label: 'Efficiency', val: selectedSem === 'overall' ? metrics?.cgpa : semMetrics?.sgpa, icon: <Activity size={15} />, color: '#8b5cf6' },
                                { label: 'Verification', val: 'Verified', icon: <ShieldCheck size={15} />, color: 'rgba(255,255,255,0.6)' },
                            ].map(k => (
                                <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5 flex flex-col justify-between min-h-[130px] group transition-all duration-500 hover:border-blue-500/20" style={{ boxShadow: '0 0 20px rgba(16,185,129,0.01), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                    <div className="flex items-center justify-between"><span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{k.label}</span><div style={{ color: `${k.color}80` }} className="group-hover:scale-110 transition-transform">{k.icon}</div></div>
                                    <p className="text-3xl font-black text-white tracking-tighter transition-all group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ color: k.color }}>{k.val}</p>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {/* Charts Row */}
                    {currentSubjects.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
                            <motion.div className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6 min-h-[350px] flex flex-col group hover:border-blue-500/20 transition-all duration-500" style={{ boxShadow: '0 0 30px rgba(16,185,129,0.02), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-6">Subject Statistics</h3>
                                <div className="flex-1"><Bar data={barChartData} options={barChartOptions} /></div>
                            </motion.div>
                            <motion.div className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6 min-h-[350px] flex flex-col group hover:border-blue-500/20 transition-all duration-500" style={{ boxShadow: '0 0 30px rgba(16,185,129,0.02), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-6">Performance Radar</h3>
                                <div className="flex-1 pb-4"><Radar data={radarChartData} options={radarOptions} /></div>
                            </motion.div>
                        </div>
                    )}

                    {/* Subject Table */}
                    {selectedSem !== 'overall' && currentSubjects.length > 0 && (
                        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden">
                            <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
                                <h3 className="text-sm font-black text-white/70 uppercase tracking-widest">
                                    {results.semesters.find((s: any) => s.semester === selectedSem)?.semester_label || 'Semester'} Inventory
                                </h3>
                                <div className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase">{currentSubjects.length} Items</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-white/[0.01]">
                                            <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase">Code</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase">Module Name</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase text-center">Efficiency</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-white/20 uppercase text-right">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {currentSubjects.map((sub: any, i: number) => {
                                            const tot = parseFloat(sub.marks || '0') || (parseFloat(sub.internal || '0') + parseFloat(sub.external || '0'));
                                            return (
                                                <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="px-6 py-4 text-xs font-mono text-white/30">{sub.code || '—'}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-white/70">{sub.name}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div className="w-32 h-1 rounded-full bg-white/[0.03] overflow-hidden border border-white/[0.03]">
                                                                <div className="h-full bg-blue-500/40 transition-all" style={{ width: `${tot}%` }} />
                                                            </div>
                                                            <span className="text-[10px] font-black text-white/20">{tot}/100</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`px-3 py-1 rounded-lg text-xs font-black  ${gradeBgClass(sub.grade)}`}>{sub.grade || '—'}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </motion.section>
                    )}

                    {/* Overall Summary */}
                    {selectedSem === 'overall' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {results.semesters.map((sem: any) => {
                                const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : calcSGPA(sem.subjects || []);
                                return (
                                    <div key={sem.semester} onClick={() => setSelectedSem(sem.semester)} className="cursor-pointer group rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-6 hover:border-blue-500/30 transition-all flex justify-between items-center" style={{ boxShadow: '0 0 20px rgba(16,185,129,0.01), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                        <div><p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">{sem.semester_label || `Semester ${sem.semester}`}</p><p className="text-sm font-bold text-white/60 group-hover:text-white transition-colors">{sem.subjects?.length || 0} Modules</p></div>
                                        <div className="text-right"><p className="text-2xl font-black text-blue-400 tracking-tighter group-hover:scale-105 transition-transform">{sgpa.toFixed(2)}</p><p className="text-[10px] font-bold text-white/10 uppercase tracking-widest mt-0.5">SGPA</p></div>
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

export default Results;
