import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, RadialLinearScale, Filler, Tooltip as ChartTooltip, Legend,
    type ChartOptions,
} from 'chart.js';
import { Bar, Doughnut, Radar } from 'react-chartjs-2';
import {
    Eye, EyeOff, RefreshCw, Award, BookOpen,
    AlertCircle, ChevronDown, Zap,
    Download, GraduationCap, TrendingUp, BarChart3, Target
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService } from '@/services/attendance.service';
import GlassCard from '@/components/ui/GlassCard';
import Button from '@/components/ui/Button';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, RadialLinearScale, Filler, ChartTooltip, Legend
);

/* ── Grade utilities ──────────────────────────────────────────────────── */

const GRADE_POINTS: Record<string, number> = {
    'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'P': 4, 'F': 0, 'Ab': 0, 'I': 0,
};

const GRADE_COLORS: Record<string, string> = {
    'O': '#10b981', 'A+': '#22c55e', 'A': '#3b82f6', 'B+': '#6366f1',
    'B': '#8b5cf6', 'C': '#f59e0b', 'P': '#f97316', 'F': '#ef4444', 'Ab': '#ef4444',
};

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

function gradeColor(grade: string): string {
    return GRADE_COLORS[grade] || '#6b7280';
}

function gradeBgClass(grade: string): string {
    const pt = GRADE_POINTS[grade];
    if (pt === undefined || pt === 0) return 'bg-rose-500';
    if (pt >= 9) return 'bg-emerald-500';
    if (pt >= 7) return 'bg-indigo-500';
    if (pt >= 5) return 'bg-amber-500';
    return 'bg-orange-500';
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
    const resultsRef = useRef<HTMLDivElement>(null);

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
    const [exportOpen, setExportOpen] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    useEffect(() => {
        if (user?.enrollment_number) setEnrollmentNo(user.enrollment_number);
    }, [user?.enrollment_number]);

    // On mount, try loading saved results from DB
    useEffect(() => {
        loadSavedResults();
    }, []);

    async function loadSavedResults() {
        try {
            const data = await attendanceService.getSavedIPUResults();
            if (data && data.semesters && data.semesters.length > 0) {
                setResults(data);
                setLastUpdated(data.last_updated || null);
                setStep('results');
            } else {
                setStep('form');
            }
        } catch {
            setStep('form');
        }
    }

    async function handleAutoFetch() {
        if (!enrollmentNo.trim()) { setError('Please enter your enrollment number.'); return; }
        if (!password.trim()) { setError('Please enter your IPU portal password.'); return; }
        setError(null);
        setFetching(true);
        try {
            const data: any = await attendanceService.autoFetchIPUResults({
                enrollment_number: enrollmentNo,
                password,
            });
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
                setResults(data);
                setLastUpdated(new Date().toISOString());
                setStep('results');
            } else {
                setError('Could not retrieve results. Try refreshing or check your credentials.');
            }
        } catch (e: any) {
            const msg = e?.response?.data?.error || e?.response?.data?.message || 'Failed to reach the server.';
            setError(msg);
        } finally {
            setFetching(false);
        }
    }

    async function refreshCaptcha() {
        if (captchaLoading) return;
        setCaptchaLoading(true);
        setCaptchaCode('');
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
        } catch {
            setError('Failed to refresh CAPTCHA.');
        } finally {
            setCaptchaLoading(false);
        }
    }

    async function handleFetchResults() {
        if (!captchaCode.trim()) { setError('Please enter the CAPTCHA code.'); return; }
        setError(null);
        setFetching(true);
        try {
            const payload = {
                enrollment_number: enrollmentNo,
                password,
                captcha: captchaCode,
                hidden_fields: captchaInfo?.hidden_fields || {},
                field_names: captchaInfo!.field_names,
                login_action: captchaInfo?.login_action || '',
            };
            const data: any = await attendanceService.fetchIPUResults(payload);
            if (data?.semesters !== undefined) {
                setResults(data);
                setLastUpdated(new Date().toISOString());
                setStep('results');
            } else {
                setError('Invalid credentials or CAPTCHA. Please try again.');
                await refreshCaptcha();
            }
        } catch (e: any) {
            const msg = e?.response?.data?.error || e?.response?.data?.message || 'Failed to fetch results.';
            const code = e?.response?.data?.code;
            if (code === 'ACCOUNT_LOCKED') {
                setError('Your IPU account has been locked due to too many failed attempts. Please contact the examination department or wait 24 hours.');
                setStep('form');
            } else if (code === 'CAPTCHA_FAILED') {
                setError('CAPTCHA was incorrect. Please try again with the new CAPTCHA below.');
                await refreshCaptcha();
            } else {
                setError(msg);
                await refreshCaptcha();
            }
        } finally {
            setFetching(false);
        }
    }

    function showFetchForm() {
        setStep('form');
        setCaptchaInfo(null);
        setCaptchaCode('');
        setError(null);
    }

    const inputCls = "w-full px-4 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container text-on-surface text-sm placeholder-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all";

    /* ── Computed metrics ──────────────────────────────────────────────── */

    const metrics = useMemo(() => {
        if (!results?.semesters?.length) return null;
        const sems = results.semesters;
        const cgpa = results.cgpa ? parseFloat(results.cgpa) : calcCGPA(sems);
        const allSubjects = sems.flatMap((s: any) => s.subjects || []);
        const totalMarks = allSubjects.reduce((a: number, s: any) => {
            const t = parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'));
            return a + t;
        }, 0);
        const totalMaxMarks = allSubjects.reduce((a: number, s: any) => a + (parseFloat(s.max_marks || '100')), 0);
        const passRate = allSubjects.length
            ? Math.round((allSubjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) >= 4).length / allSubjects.length) * 100)
            : 0;
        const gradeDist: Record<string, number> = {};
        allSubjects.forEach((s: any) => { const g = s.grade || 'N/A'; gradeDist[g] = (gradeDist[g] || 0) + 1; });
        const marks = allSubjects.map((s: any) => parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'))).filter((m: number) => m > 0);
        const avgMarks = marks.length ? parseFloat((marks.reduce((a: number, b: number) => a + b, 0) / marks.length).toFixed(1)) : 0;
        const highestMarks = marks.length ? Math.max(...marks) : 0;
        const lowestMarks = marks.length ? Math.min(...marks) : 0;
        const failedSubjects = allSubjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) < 4).length;
        let mostCommonGrade = 'N/A', maxCount = 0;
        for (const [g, c] of Object.entries(gradeDist)) { if (c > maxCount) { maxCount = c; mostCommonGrade = g; } }
        return { cgpa, passRate, totalSubjects: allSubjects.length, avgMarks, highestMarks, lowestMarks, failedSubjects, mostCommonGrade, mostCommonGradeCount: maxCount, gradeDist, totalMarks, totalMaxMarks };
    }, [results]);

    const semMetrics = useMemo(() => {
        if (!results?.semesters?.length || selectedSem === 'overall') return null;
        const sem = results.semesters.find((s: any) => s.semester === selectedSem);
        if (!sem) return null;
        const subjects = sem.subjects || [];
        const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : calcSGPA(subjects);
        const totalMarks = subjects.reduce((a: number, s: any) => a + (parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'))), 0);
        const totalMaxMarks = subjects.reduce((a: number, s: any) => a + (parseFloat(s.max_marks || '100')), 0);
        const marks = subjects.map((s: any) => parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'))).filter((m: number) => m > 0);
        const passRate = subjects.length ? Math.round((subjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) >= 4).length / subjects.length) * 100) : 0;
        const gradeDist: Record<string, number> = {};
        subjects.forEach((s: any) => { const g = s.grade || 'N/A'; gradeDist[g] = (gradeDist[g] || 0) + 1; });
        const avgMarks = marks.length ? parseFloat((marks.reduce((a: number, b: number) => a + b, 0) / marks.length).toFixed(1)) : 0;
        const highestMarks = marks.length ? Math.max(...marks) : 0;
        const lowestMarks = marks.length ? Math.min(...marks) : 0;
        const failedSubjects = subjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) < 4).length;
        let mostCommonGrade = 'N/A', maxCount = 0;
        for (const [g, c] of Object.entries(gradeDist)) { if (c > maxCount) { maxCount = c; mostCommonGrade = g; } }
        return { sgpa, passRate, totalSubjects: subjects.length, avgMarks, highestMarks, lowestMarks, failedSubjects, mostCommonGrade, mostCommonGradeCount: maxCount, gradeDist, totalMarks, totalMaxMarks, semLabel: sem.semester_label };
    }, [results, selectedSem]);

    const currentMetrics = selectedSem === 'overall' ? metrics : semMetrics;
    const currentSubjects = useMemo(() => {
        if (!results?.semesters) return [];
        if (selectedSem === 'overall') return results.semesters.flatMap((s: any) => s.subjects || []);
        return results.semesters.find((s: any) => s.semester === selectedSem)?.subjects || [];
    }, [results, selectedSem]);

    /* ── Chart data ───────────────────────────────────────────────────── */

    const barChartData = useMemo(() => {
        const subjects = currentSubjects.slice(0, 15);
        return {
            labels: subjects.map((s: any) => s.code || s.name?.substring(0, 8) || '?'),
            datasets: [
                { label: 'Internal', data: subjects.map((s: any) => parseFloat(s.internal || '0') || 0), backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 4 },
                { label: 'External', data: subjects.map((s: any) => parseFloat(s.external || '0') || 0), backgroundColor: 'rgba(59, 130, 246, 0.6)', borderRadius: 4 },
            ],
        };
    }, [currentSubjects]);

    const barChartOptions: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { color: '#94a3b8', font: { size: 11 } } }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1' } },
        scales: { x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } }, y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(148,163,184,0.1)' } } },
    };

    const radarChartData = useMemo(() => {
        const subjects = currentSubjects.slice(0, 10);
        const maxMarks = subjects.map((s: any) => parseFloat(s.max_marks || '100'));
        return {
            labels: subjects.map((s: any) => s.code || s.name?.substring(0, 8) || '?'),
            datasets: [{
                label: 'Performance',
                data: subjects.map((s: any, i: number) => {
                    const total = parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'));
                    return Math.round((total / (maxMarks[i] || 100)) * 100);
                }),
                backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.8)',
                pointBackgroundColor: 'rgba(99, 102, 241, 1)', pointBorderColor: '#fff', pointRadius: 4, borderWidth: 2,
            }],
        };
    }, [currentSubjects]);

    const radarOptions: ChartOptions<'radar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { r: { angleLines: { color: 'rgba(148,163,184,0.15)' }, grid: { color: 'rgba(148,163,184,0.15)' }, pointLabels: { color: '#94a3b8', font: { size: 9 } }, ticks: { display: false }, suggestedMin: 0, suggestedMax: 100 } },
    };

    const donutChartData = useMemo(() => {
        if (!currentMetrics?.gradeDist) return null;
        const entries = Object.entries(currentMetrics.gradeDist).sort(([, a], [, b]) => (b as number) - (a as number));
        return {
            labels: entries.map(([g]) => g),
            datasets: [{ data: entries.map(([, c]) => c), backgroundColor: entries.map(([g]) => gradeColor(g)), borderWidth: 0, spacing: 2 }],
        };
    }, [currentMetrics]);

    const donutOptions: ChartOptions<'doughnut'> = {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#cbd5e1' } },
    };

    /* ── PDF Export ────────────────────────────────────────────────────── */

    const handleExport = useCallback(async (scope: 'all' | 'semester') => {
        setExportOpen(false);
        if (!resultsRef.current) return;
        try {
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');
            const canvas = await html2canvas(resultsRef.current, { scale: 2, backgroundColor: '#0f172a', useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageW = pdf.internal.pageSize.getWidth();
            const ratio = canvas.height / canvas.width;
            const imgH = pageW * ratio;
            let yPos = 0;
            const pageH = pdf.internal.pageSize.getHeight();
            while (yPos < imgH) {
                if (yPos > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, -yPos, pageW, imgH);
                yPos += pageH;
            }
            pdf.save(`Results_${results?.enrollment_number || 'export'}_${scope === 'all' ? 'All' : `Sem${selectedSem}`}.pdf`);
        } catch (err) {
            console.error('PDF export failed:', err);
        }
    }, [results, selectedSem]);

    /* ── Render ────────────────────────────────────────────────────────── */

    if (step === 'loading') {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-primary/60" />
            </div>
        );
    }

    return (
        <div className="pb-24 space-y-6">
            {/* Error Toast */}
            <AnimatePresence>
                {error && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-start gap-3 p-4 rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-900/10">
                        <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-rose-700 dark:text-rose-300 flex-1">{error}</p>
                        <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600 transition-colors text-lg leading-none">&times;</button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Login Form ──────────────────────────────────────────────── */}
            {step === 'form' && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <GlassCard className="p-6 max-w-md mx-auto">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                                <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-on-surface">IPU Portal Login</h2>
                                <p className="text-xs text-on-surface-variant flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-amber-500" /> Results are saved for instant access
                                </p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Enrollment Number</label>
                                <input value={enrollmentNo} onChange={e => setEnrollmentNo(e.target.value)} placeholder="e.g. 00113302725" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">IPU Portal Password</label>
                                <div className="relative">
                                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAutoFetch()} placeholder="Your exam portal password" className={`${inputCls} pr-10`} />
                                    <button onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors p-1">
                                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <p className="text-[11px] text-on-surface-variant/60 leading-relaxed">
                                Credentials are used only to fetch results from IPU portal. Results are saved to your account for instant access — you won't need to login again unless you want to fetch new results.
                            </p>
                            <Button onClick={handleAutoFetch} disabled={fetching} variant="primary" size="md" className="w-full justify-center">
                                {fetching
                                    ? <span className="flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching results...</span>
                                    : <span className="flex items-center gap-2"><Zap className="w-3.5 h-3.5" /> Fetch Results</span>}
                            </Button>
                        </div>
                    </GlassCard>
                </motion.div>
            )}

            {/* ── CAPTCHA Fallback ────────────────────────────────────────── */}
            {step === 'captcha' && captchaInfo && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                    <GlassCard className="p-6 max-w-md mx-auto">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-on-surface">Verify CAPTCHA</h2>
                                <p className="text-xs text-on-surface-variant">Please type the characters shown below</p>
                            </div>
                            <button onClick={refreshCaptcha} disabled={captchaLoading}
                                className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors px-3 py-1.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container">
                                <RefreshCw className={`w-3.5 h-3.5 ${captchaLoading ? 'animate-spin' : ''}`} /> Refresh
                            </button>
                        </div>
                        <div className="rounded-xl overflow-hidden border border-outline-variant/60 bg-white flex justify-center p-4 mb-4">
                            <img src={captchaInfo.captcha_image} alt="CAPTCHA" className="max-h-16 object-contain" />
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5">Type the text shown above</label>
                                <input value={captchaCode} onChange={e => setCaptchaCode(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleFetchResults()} placeholder="Enter CAPTCHA" autoFocus
                                    className={`${inputCls} tracking-widest font-mono`} />
                            </div>
                            <div className="flex gap-3">
                                <Button onClick={showFetchForm} variant="secondary" size="md" className="flex-1 justify-center">&#8592; Back</Button>
                                <Button onClick={handleFetchResults} disabled={fetching} variant="primary" size="md" className="flex-1 justify-center">
                                    {fetching ? 'Fetching...' : 'Submit'}
                                </Button>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>
            )}

            {/* ── Results Dashboard ───────────────────────────────────────── */}
            {step === 'results' && results && results.semesters?.length > 0 && (
                <div ref={resultsRef} className="space-y-5">
                    {/* Student Info Card */}
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                        <GlassCard className="p-0 overflow-hidden">
                            <div className="p-5 md:p-6 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">
                                        {results.student_info?.name || user?.name || 'Student'}
                                    </h1>
                                    <div className="grid grid-cols-2 gap-3 mt-3">
                                        <InfoBox label="Enrollment No." value={results.enrollment_number || '—'} />
                                        <InfoBox label="Year of Admission" value={results.student_info?.batch || '—'} />
                                        <InfoBox label="Institute" value={results.student_info?.institution || '—'} />
                                        <InfoBox label="Program" value={results.student_info?.programme || '—'} />
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <Button onClick={showFetchForm} variant="secondary" size="sm">
                                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refetch
                                        </Button>
                                        <div className="relative">
                                            <Button onClick={() => setExportOpen(!exportOpen)} variant="secondary" size="sm">
                                                <Download className="w-3.5 h-3.5 mr-1.5" /> Export PDF <ChevronDown className="w-3 h-3 ml-1" />
                                            </Button>
                                            {exportOpen && (
                                                <div className="absolute top-full right-0 mt-1 w-44 bg-surface-container border border-outline-variant/60 rounded-xl shadow-xl z-50 py-1">
                                                    <p className="px-3 py-1.5 text-[10px] font-semibold text-on-surface-variant uppercase">Select Export Option</p>
                                                    <button onClick={() => handleExport('all')} className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-primary/10 transition-colors">All Semesters</button>
                                                    {selectedSem !== 'overall' && (
                                                        <button onClick={() => handleExport('semester')} className="w-full text-left px-3 py-2 text-sm text-on-surface hover:bg-primary/10 transition-colors">
                                                            {results.semesters.find((s: any) => s.semester === selectedSem)?.semester_label || `Semester ${selectedSem}`}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="px-6 py-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-center min-w-[140px]">
                                        <p className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Cumulative GPA</p>
                                        <p className="text-3xl md:text-4xl font-black text-indigo-500 mt-1">{metrics?.cgpa?.toFixed(2) || '—'}</p>
                                        <p className="text-[10px] text-on-surface-variant mt-0.5">Out of 10.0</p>
                                    </div>
                                </div>
                            </div>
                            {lastUpdated && (
                                <div className="px-5 py-2 bg-surface-container-high/30 border-t border-outline-variant/20 text-[10px] text-on-surface-variant">
                                    Last updated: {new Date(lastUpdated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            )}
                        </GlassCard>
                    </motion.div>

                    {/* Semester Tabs */}
                    <div className="flex flex-wrap gap-2">
                        <SemTab active={selectedSem === 'overall'} onClick={() => setSelectedSem('overall')}>Overall</SemTab>
                        {results.semesters?.map((sem: any) => (
                            <SemTab key={sem.semester} active={selectedSem === sem.semester} onClick={() => setSelectedSem(sem.semester)}>
                                Sem {sem.semester_num || sem.semester}
                            </SemTab>
                        ))}
                    </div>

                    {/* KPI Cards */}
                    {currentMetrics && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <KPICard icon={<BarChart3 className="w-4 h-4 text-indigo-500" />} color="indigo" label="Marks"
                                value={<>{currentMetrics.totalMarks}<span className="text-base font-normal text-on-surface-variant">/ {currentMetrics.totalMaxMarks}</span></>} />
                            <KPICard icon={<TrendingUp className="w-4 h-4 text-emerald-500" />} color="emerald"
                                label={selectedSem === 'overall' ? 'CGPA' : 'SGPA'}
                                value={selectedSem === 'overall' ? metrics?.cgpa?.toFixed(2) : semMetrics?.sgpa?.toFixed(2) || '—'} />
                            <KPICard icon={<Target className="w-4 h-4 text-amber-500" />} color="amber" label="Percentage"
                                value={currentMetrics.totalMaxMarks ? `${((currentMetrics.totalMarks / currentMetrics.totalMaxMarks) * 100).toFixed(1)}%` : '—'} />
                            <KPICard icon={<BookOpen className="w-4 h-4 text-violet-500" />} color="violet" label="Subjects" value={currentMetrics.totalSubjects} />
                        </motion.div>
                    )}

                    {/* Charts Row */}
                    {currentSubjects.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <GlassCard className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                                    <h3 className="font-bold text-on-surface text-sm">{selectedSem === 'overall' ? 'Subject-wise' : 'Semester'} Statistics</h3>
                                </div>
                                <div className="h-[250px]"><Bar data={barChartData} options={barChartOptions} /></div>
                            </GlassCard>
                            <GlassCard className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Target className="w-4 h-4 text-emerald-500" />
                                    <h3 className="font-bold text-on-surface text-sm">Performance Radar</h3>
                                </div>
                                <div className="h-[250px]"><Radar data={radarChartData} options={radarOptions} /></div>
                            </GlassCard>
                        </div>
                    )}

                    {/* Grade Distribution */}
                    {currentMetrics && donutChartData && (
                        <GlassCard className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <Award className="w-4 h-4 text-emerald-500" />
                                <h3 className="font-bold text-on-surface text-sm">Grade Distribution</h3>
                                <span className="text-xs text-on-surface-variant ml-1">Breakdown of grades for {selectedSem === 'overall' ? 'all semesters' : 'this semester'}</span>
                            </div>
                            <div className="flex flex-col md:flex-row items-center gap-8">
                                <div className="w-48 h-48 shrink-0"><Doughnut data={donutChartData} options={donutOptions} /></div>
                                <div className="flex-1 space-y-3 w-full">
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                        <StatRow label="Total Subjects" value={currentMetrics.totalSubjects} />
                                        <StatRow label="Pass Rate" value={`${currentMetrics.passRate}%`} highlight={currentMetrics.passRate === 100 ? 'green' : undefined} />
                                        <StatRow label="Average Marks" value={currentMetrics.avgMarks} />
                                        <StatRow label="Highest Marks" value={currentMetrics.highestMarks} highlight="green" />
                                        <StatRow label="Lowest Marks" value={currentMetrics.lowestMarks} />
                                        <StatRow label="Failed Subjects" value={currentMetrics.failedSubjects} highlight={currentMetrics.failedSubjects === 0 ? 'green' : 'red'} />
                                        <StatRow label="Most Common Grade" value={`${currentMetrics.mostCommonGrade} (${currentMetrics.mostCommonGradeCount})`} />
                                    </div>
                                    <div className="flex flex-wrap gap-3 pt-2 border-t border-outline-variant/20">
                                        <p className="text-[10px] font-semibold text-on-surface-variant uppercase w-full">Grade Breakdown</p>
                                        {Object.entries(currentMetrics.gradeDist).sort(([, a], [, b]) => (b as number) - (a as number)).map(([g, cnt]) => (
                                            <div key={g} className="flex items-center gap-1.5 text-xs">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: gradeColor(g) }} />
                                                <span className="font-semibold text-on-surface">{g}</span>
                                                <span className="text-on-surface-variant">{cnt} ({Math.round(((cnt as number) / currentMetrics.totalSubjects) * 100)}%)</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    )}

                    {/* Subject Table (per semester) */}
                    {selectedSem !== 'overall' && currentSubjects.length > 0 && (
                        <GlassCard className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <GraduationCap className="w-4 h-4 text-indigo-500" />
                                <h3 className="font-bold text-on-surface text-sm">
                                    {results.semesters.find((s: any) => s.semester === selectedSem)?.semester_label || 'Semester'} Results
                                </h3>
                                <span className="text-xs text-on-surface-variant ml-1">({currentSubjects.length} subjects)</span>
                            </div>
                            <div className="overflow-x-auto -mx-5 px-5">
                                <table className="w-full text-sm min-w-[580px]">
                                    <thead>
                                        <tr className="border-b border-outline-variant/40">
                                            <th className="py-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/60">Paper Code</th>
                                            <th className="py-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/60">Subject Name</th>
                                            <th className="py-2.5 pr-3 text-center text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/60">INT. | EXT.</th>
                                            <th className="py-2.5 pr-3 text-center text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/60">Total</th>
                                            <th className="py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/60">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentSubjects.map((sub: any, idx: number) => {
                                            const total = parseFloat(sub.marks || '0') || (parseFloat(sub.internal || '0') + parseFloat(sub.external || '0'));
                                            return (
                                                <tr key={idx} className="border-b border-outline-variant/15 hover:bg-surface-container/40 transition-colors">
                                                    <td className="py-3 pr-3 text-on-surface-variant text-xs font-mono">{sub.code || '—'}</td>
                                                    <td className="py-3 pr-3 text-on-surface font-medium max-w-[220px]"><p className="truncate">{sub.name || '—'}</p></td>
                                                    <td className="py-3 pr-3 text-on-surface-variant text-center">{sub.internal || '—'} | {sub.external || '—'}</td>
                                                    <td className="py-3 pr-3 font-bold text-on-surface text-center">{total || '—'}</td>
                                                    <td className="py-3 text-center">
                                                        <span className={`inline-flex items-center justify-center w-10 h-7 rounded-lg text-white text-xs font-bold ${gradeBgClass(sub.grade)}`}>
                                                            {sub.grade || '—'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>
                    )}

                    {/* Overall Semester Summary Table */}
                    {selectedSem === 'overall' && results.semesters?.length > 0 && (
                        <GlassCard className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <GraduationCap className="w-4 h-4 text-indigo-500" />
                                <h3 className="font-bold text-on-surface text-sm">Semester Summary</h3>
                            </div>
                            <div className="overflow-x-auto -mx-5 px-5">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-outline-variant/40">
                                            <th className="py-2.5 pr-3 text-left text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/60">Semester</th>
                                            <th className="py-2.5 pr-3 text-center text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/60">Subjects</th>
                                            <th className="py-2.5 pr-3 text-center text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/60">Marks</th>
                                            <th className="py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/60">SGPA</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.semesters.map((sem: any) => {
                                            const subjects = sem.subjects || [];
                                            const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : calcSGPA(subjects);
                                            const totalM = subjects.reduce((a: number, s: any) => a + (parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'))), 0);
                                            const maxM = subjects.reduce((a: number, s: any) => a + (parseFloat(s.max_marks || '100')), 0);
                                            return (
                                                <tr key={sem.semester} onClick={() => setSelectedSem(sem.semester)}
                                                    className="border-b border-outline-variant/15 hover:bg-surface-container/40 transition-colors cursor-pointer">
                                                    <td className="py-3 pr-3 font-medium text-on-surface">{sem.semester_label || `Semester ${sem.semester}`}</td>
                                                    <td className="py-3 pr-3 text-on-surface-variant text-center">{subjects.length}</td>
                                                    <td className="py-3 pr-3 text-on-surface text-center">{totalM} / {maxM}</td>
                                                    <td className="py-3 text-center">
                                                        <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-bold ${sgpa >= 8 ? 'bg-emerald-500/15 text-emerald-500' : sgpa >= 6 ? 'bg-indigo-500/15 text-indigo-500' : 'bg-rose-500/15 text-rose-500'}`}>
                                                            {sgpa.toFixed(2)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>
                    )}

                    {/* Bottom Actions */}
                    <div className="flex justify-center gap-4 pt-2">
                        <Button onClick={showFetchForm} variant="secondary" size="md">Check Another Result</Button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {step === 'results' && (!results || !results.semesters?.length) && (
                <GlassCard className="p-10 text-center">
                    <Award className="w-10 h-10 mx-auto mb-3 text-on-surface-variant/30" />
                    <p className="text-on-surface-variant">No semester data found.</p>
                    <Button onClick={showFetchForm} variant="primary" size="sm" className="mt-4 mx-auto">Fetch Results</Button>
                </GlassCard>
            )}
        </div>
    );
};

/* ── Sub-components ───────────────────────────────────────────────────── */

const InfoBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="px-4 py-2.5 rounded-xl bg-surface-container-high/50 border border-outline-variant/30">
        <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">{label}</p>
        <p className="font-bold text-on-surface text-sm mt-0.5 leading-snug">{value}</p>
    </div>
);

const SemTab: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button onClick={onClick}
        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${active
            ? 'bg-primary text-on-primary shadow-md'
            : 'bg-surface-container border border-outline-variant/60 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}>
        {children}
    </button>
);

const KPICard: React.FC<{ icon: React.ReactNode; color: string; label: string; value: React.ReactNode }> = ({ icon, color, label, value }) => (
    <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>{icon}</div>
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase">{label}</span>
        </div>
        <p className="text-2xl font-black text-on-surface">{value}</p>
    </GlassCard>
);

const StatRow: React.FC<{ label: string; value: React.ReactNode; highlight?: 'green' | 'red' }> = ({ label, value, highlight }) => (
    <div className="flex justify-between items-center">
        <span className="text-xs text-on-surface-variant">{label}</span>
        <span className={`text-sm font-bold ${highlight === 'green' ? 'text-emerald-500' : highlight === 'red' ? 'text-rose-500' : 'text-on-surface'}`}>{value}</span>
    </div>
);

export default Results;
