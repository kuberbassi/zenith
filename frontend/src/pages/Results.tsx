import React, { useState, useEffect, useMemo } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';
import type { ChartOptions } from 'chart.js';
import {
    Eye, EyeOff, RefreshCw, Zap, GraduationCap,
    ShieldCheck, X, Download
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import Button from '@/components/ui/Button';
import ResultsDashboard from '@/components/results/ResultsDashboard';

/*  Grade utilities  */
const GRADE_POINTS: Record<string, number> = {
    'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C+': 5, 'C': 4, 'P': 4, 'F': 0, 'Ab': 0, 'I': 0,
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

function gradeBgClass(grade: string): string {
    const pt = GRADE_POINTS[grade];
    if (pt === undefined || pt === 0) return 'bg-red-500/10 text-red-400 border border-red-500/20';
    if (pt >= 9) return 'bg-blue-500/15 text-blue-300 border border-blue-500/30';
    if (pt >= 7) return 'bg-green-500/10 text-green-400 border border-green-500/20';
    if (pt >= 5) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
}

function formatDate(iso: string | null): string {
    if (!iso) return 'Never synced';
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function parseNumeric(value: unknown): number | null {
    if (value === null || value === undefined || value === '' || value === '-') return null;
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isNaN(num) ? null : num;
}

function getSubjectMarks(subject: any) {
    const internal = parseNumeric(subject.internal ?? subject.internal_theory) ?? 0;
    const external = parseNumeric(subject.external ?? subject.external_theory) ?? 0;
    const total = parseNumeric(subject.total_marks ?? subject.marks);
    const maxMarks = parseNumeric(subject.max_marks) ?? 100;
    return {
        internal,
        external,
        total: total ?? (internal + external),
        hasExplicitTotal: total !== null,
        maxMarks,
    };
}

function getSubjectDisplayMark(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    const text = String(value).trim();
    return text || '-';
}

function formatDeclaredDate(value: unknown): string | null {
    if (!value) return null;
    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildBatchLabel(info: any): string {
    const raw = String(info?.batch || '').trim();
    if (!raw) return '---';
    if (/^\d{4}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}$/.test(raw)) {
        const start = Number(raw);
        return `${start}-${String((start + 4) % 100).padStart(2, '0')}`;
    }
    return raw;
}

function normalizeProfileInfo(info: any) {
    return {
        name: info?.name || info?.stname || '',
        roll_no: info?.roll_no || info?.nrollno || info?.enrollment_number || '',
        father: info?.father || '',
        mother: info?.mother || '',
        gender: info?.gender || '',
        email: info?.email || '',
        phone: info?.phone || info?.mobno || '',
        batch: info?.batch || info?.byoa || '',
        admission_year: info?.admission_year || info?.yoa || '',
        institution: info?.institution || info?.iname || '',
        programme: info?.programme || info?.prgname || '',
    };
}

function getSubjectPercentage(subject: any) {
    const { total, maxMarks } = getSubjectMarks(subject);
    if (!maxMarks) return 0;
    return Math.round((total / maxMarks) * 100);
}

/*  Types  */
type Step = 'loading' | 'form' | 'captcha' | 'results';

interface CaptchaInfo {
    captcha_image: string;
    hidden_fields: Record<string, string>;
    field_names: Record<string, string>;
    login_action?: string;
    ocr_attempted?: string;
}

/*  Component  */
const Results: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    usePageMeta({
        title: 'Results | AcadHub',
        description: 'View your semester-wise IPU results, CGPA, and grade breakdowns. Track academic performance over time.',
    });

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
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    // PDF download
    const [showPdfModal, setShowPdfModal] = useState(false);
    const [pdfSem, setPdfSem] = useState<string>('overall');
    const [pdfLoading, setPdfLoading] = useState(false);

    const accentColor = '#3b82f6';
    const gridColor = 'rgba(255,255,255,0.04)';

    useEffect(() => {
        if (user?.enrollment_number) setEnrollmentNo(user.enrollment_number);
    }, [user?.enrollment_number]);

    useEffect(() => { loadSavedResults(); }, []);

    async function loadSavedResults() {
        try {
            const saved = await attendanceService.getSavedIPUResults();
            if (saved?.semesters?.length) {
                setResults(saved);
                setLastUpdated(saved.last_updated || null);
                setStep('results');
            } else {
                setStep('form');
            }
        } catch {
            setStep('form');
        }
    }

    function handleSyncClick() {
        setError(null);
        setPassword('');
        setStep('form');
    }

    async function handleDownloadPdf() {
        if (!results) return;
        setPdfLoading(true);
        try {
            // Dynamic import so the PDF library only loads when needed
            const { downloadResultsPdf } = await import('@/utils/downloadResultsPdf');
            downloadResultsPdf(results, pdfSem);
        } catch (e: any) {
            showToast('error', 'PDF generation failed: ' + (e?.message || 'Unknown error'));
        } finally {
            setPdfLoading(false);
            setShowPdfModal(false);
        }
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
                await loadSavedResults();
                setLastUpdated(new Date().toISOString());
                showToast('success', 'Results synced successfully!');
            } else {
                setError('Could not retrieve results.');
            }
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Failed to reach server.');
        } finally {
            setFetching(false);
        }
    }

    async function refreshCaptcha() {
        if (captchaLoading || fetching) return;
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
        } catch { setError('Failed to refresh CAPTCHA.'); }
        finally { setCaptchaLoading(false); }
    }

    async function handleFetchResults() {
        if (fetching) return;
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
                await loadSavedResults();
                setLastUpdated(new Date().toISOString());
                showToast('success', 'Results synced successfully!');
            } else {
                setError('Invalid credentials or CAPTCHA. Click ↻ to get a new CAPTCHA.');
            }
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data?.error || 'Failed to fetch.';
            setError(msg);
            setCaptchaCode('');
            // 423 = account locked — stop immediately, never refresh captcha
            if (status === 423) {
                setStep('form');
                setPassword('');
            }
            if (status === 401 || status === 429) showToast('error', 'Use a fresh CAPTCHA before retrying.');
            // For other failures (wrong captcha/creds) just show the error.
            // User can click ↻ to manually get a new CAPTCHA.
        } finally { setFetching(false); }
    }

    const inputCls = 'w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.02] text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all';

    /*  Computed metrics  */
    const metrics = useMemo(() => {
        if (!results?.semesters?.length) return null;
        const sems = results.semesters;
        const cgpa = results.cgpa ? parseFloat(results.cgpa) : calcCGPA(sems);
        const allSubjects = sems.flatMap((s: any) => s.subjects || []);
        const totalCredits = sems.reduce((a: number, s: any) =>
            a + (s.subjects || []).reduce((b: number, sub: any) => b + (parseFloat(sub.credits || '0') || 0), 0), 0);
        const completedSubjects = allSubjects.filter((s: any) => !s.is_pending && s.grade !== '-');
        const totalMarks = completedSubjects.reduce((a: number, s: any) => a + getSubjectMarks(s).total, 0);
        const totalMaxMarks = completedSubjects.reduce((a: number, s: any) => a + getSubjectMarks(s).maxMarks, 0);
        const passRate = allSubjects.length
            ? Math.round((allSubjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) >= 4).length / allSubjects.length) * 100)
            : 0;
        const academicScore = totalMaxMarks > 0
            ? Math.round((totalMarks / totalMaxMarks) * 100)
            : (allSubjects.length
                ? Math.round((allSubjects.reduce((acc: number, s: any) => acc + (GRADE_POINTS[s.grade] ?? 0), 0) / (allSubjects.length * 10)) * 100)
                : 0);
        return { cgpa, passRate, totalSubjects: allSubjects.length, totalMarks, totalMaxMarks, totalCredits, completedSubjects: completedSubjects.length, academicScore };
    }, [results]);

    const semMetrics = useMemo(() => {
        if (!results?.semesters?.length || selectedSem === 'overall') return null;
        const sem = results.semesters.find((s: any) => String(s.semester_num ?? s.semester) === String(selectedSem));
        if (!sem) return null;
        const subjects = sem.subjects || [];
        const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : calcSGPA(subjects);
        const totalCredits = subjects.reduce((a: number, s: any) => a + (parseFloat(s.credits || '0') || 0), 0);
        const completedSubjects = subjects.filter((s: any) => !s.is_pending && s.grade !== '-');
        const totalMarks = completedSubjects.reduce((a: number, s: any) => a + getSubjectMarks(s).total, 0);
        const totalMaxMarks = completedSubjects.reduce((a: number, s: any) => a + getSubjectMarks(s).maxMarks, 0);
        const passRate = subjects.length
            ? Math.round((subjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) >= 4).length / subjects.length) * 100)
            : 0;
        const pendingSubjects = subjects.filter((s: any) => s.is_pending || s.grade === '-').length;
        return { sgpa, passRate, totalSubjects: subjects.length, totalMarks, totalMaxMarks, totalCredits, pendingSubjects };
    }, [results, selectedSem]);

    const currentMetrics = selectedSem === 'overall' ? metrics : semMetrics;
    const profileInfo = normalizeProfileInfo(results?.student_info || {});
    const displayBatch = buildBatchLabel(profileInfo);
    const academicStrength = selectedSem === 'overall'
        ? (results?.academicStrength ?? metrics?.academicScore ?? 0)
        : Math.round((currentMetrics?.totalMarks ?? 0) / Math.max(currentMetrics?.totalMaxMarks ?? 1, 1) * 100);

    const currentSubjects = useMemo(() => {
        if (!results?.semesters) return [];
        if (selectedSem === 'overall') return results.semesters.flatMap((s: any) => s.subjects || []).slice(0, 20);
        return results.semesters.find((s: any) => String(s.semester_num ?? s.semester) === String(selectedSem))?.subjects || [];
    }, [results, selectedSem]);

    const currentSemesterMeta = useMemo(() => {
        if (!results?.semesters?.length || selectedSem === 'overall') return null;
        const semester = results.semesters.find((s: any) => String(s.semester_num ?? s.semester) === String(selectedSem));
        const subjects = semester?.subjects || [];
        const declaredDate = subjects.find((subject: any) => subject?.declared_date)?.declared_date || null;
        const examSession = subjects.find((subject: any) => subject?.exam_session)?.exam_session || null;
        if (!declaredDate && !examSession) return null;
        return {
            declaredDate: formatDeclaredDate(declaredDate),
            examSession: examSession ? String(examSession) : null,
        };
    }, [results, selectedSem]);

    const chartSubjects = useMemo(() =>
        currentSubjects
            .filter((s: any) => !s.is_pending)
            .slice(0, selectedSem === 'overall' ? 10 : 12),
    [currentSubjects, selectedSem]);

    const performanceSummary = useMemo(() => {
        if (!chartSubjects.length) return null;
        const ranked = [...chartSubjects].sort((a: any, b: any) => getSubjectPercentage(b) - getSubjectPercentage(a));
        return {
            strongest: ranked[0],
            weakest: ranked[ranked.length - 1],
            distinctionCount: chartSubjects.filter((subject: any) => getSubjectPercentage(subject) >= 75).length,
            pendingCount: currentSubjects.filter((subject: any) => subject.is_pending || subject.grade === '-').length,
        };
    }, [chartSubjects, currentSubjects]);

    /*  Chart data  */
    const barChartData = useMemo(() => ({
        labels: chartSubjects.map((s: any) => s.code || s.name?.substring(0, 10) || '?'),
        datasets: [
            {
                label: 'Score %',
                data: chartSubjects.map((s: any) => getSubjectPercentage(s)),
                backgroundColor: chartSubjects.map((s: any) => {
                    const pct = getSubjectPercentage(s);
                    if (pct >= 75) return '#3b82f6';
                    if (pct >= 60) return '#22c55e';
                    if (pct >= 50) return '#f59e0b';
                    return '#ef4444';
                }),
                borderRadius: 8,
            },
        ],
    }), [chartSubjects]);

    const barChartOptions: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 } } },
            y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 }, maxTicksLimit: 5 } },
        },
    };

    const marksBreakdownData = useMemo(() => ({
        labels: chartSubjects.map((s: any) => s.code || s.name?.substring(0, 10) || '?'),
        datasets: [
            {
                label: 'Internal',
                data: chartSubjects.map((s: any) => getSubjectMarks(s).internal),
                backgroundColor: 'rgba(59, 130, 246, 0.85)',
                borderRadius: 6,
            },
            {
                label: 'External',
                data: chartSubjects.map((s: any) => getSubjectMarks(s).external),
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderRadius: 6,
            },
        ],
    }), [chartSubjects]);

    const marksBreakdownOptions: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: {
                    color: 'rgba(255,255,255,0.45)',
                    font: { size: 10 },
                },
            },
        },
        scales: {
            x: { stacked: true, grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 } } },
            y: { stacked: true, grid: { color: gridColor }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 }, maxTicksLimit: 5 } },
        },
    };

    /* Grade Distribution Chart (Doughnut) */
    const gradeDistributionData = useMemo(() => {
        const dist = results?.gradeDistribution || {};
        const labels = Object.keys(dist).filter(k => dist[k] > 0);
        const data = labels.map(k => dist[k]);
        const colors = labels.map(g => {
            if (g === 'O') return '#3b82f6'; // Blue
            if (g === 'A+') return '#8b5cf6'; // Purple
            if (g === 'A') return '#10b981'; // Green
            if (g === 'B+') return '#f59e0b'; // Amber
            if (g === 'B') return '#f97316'; // Orange
            if (g === 'C+' || g === 'C') return '#ef4444'; // Red
            return '#64748b'; // Gray for F/A/I
        });
        return { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] };
    }, [results]);

    const doughnutOptions: ChartOptions<'doughnut'> = {
        responsive: true, maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#0a0a0a', titleColor: '#fff', bodyColor: '#ffffff80',
                borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 10,
            }
        }
    };

    if (step === 'loading') {
        return <div className="flex items-center justify-center h-screen"><RefreshCw className="animate-spin text-blue-500/40" /></div>;
    }

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } }}
            className="pb-28 max-w-[1320px] mx-auto pt-20 px-3 md:px-5"
        >
            {/*  Auth / Sync Form  */}
            {step === 'form' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="max-w-md mx-auto mt-10"
                >
                    <div className="mb-4 rounded-3xl border border-amber-500/25 bg-amber-500/[0.06] p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-2xl border border-amber-500/20 bg-amber-500/10 flex items-center justify-center">
                                <ShieldCheck size={18} className="text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-white">Password Information</h3>
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300/60">Portal safety guidance</p>
                            </div>
                        </div>
                        <ul className="space-y-2 text-sm leading-6 text-white/70">
                            <li>Default password is your father&apos;s full name in capital letters.</li>
                            <li>Include spaces exactly as registered on the IPU portal.</li>
                            <li className="text-red-300">3 wrong attempts can temporarily lock your account.</li>
                        </ul>
                        <div className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-white/55">
                            Your credentials are never stored on our servers. They are only used for the live IPU session needed to fetch results.
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-8 shadow-2xl" style={{ boxShadow: '0 0 40px rgba(59,130,246,0.03), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                                <GraduationCap size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight">{results ? 'Sync Results' : 'Academic Portal'}</h2>
                                <p className="text-xs text-white/30 font-medium tracking-wider uppercase">{results ? 'Fetch latest semester data' : 'Secure Result Retrieval'}</p>
                            </div>
                        </div>

                        {results && (
                            <button
                                onClick={() => setStep('results')}
                                className="w-full mb-4 py-2.5 rounded-xl bg-white/5 border border-white/[0.05] text-xs text-white/30 font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
                            >
                                Back to Results
                            </button>
                        )}

                        {error && <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400">{error}</div>}

                        <form onSubmit={(e) => { e.preventDefault(); handleAutoFetch(); }} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2 ml-1">Enrollment Number</label>
                                <input type="text" value={enrollmentNo} onChange={e => setEnrollmentNo(e.target.value)} placeholder="00000000000" className={inputCls} required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2 ml-1">Portal Password</label>
                                <div className="relative">
                                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="********" className={inputCls} required />
                                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors">
                                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <Button
                                type="submit" isLoading={fetching}
                                className="w-full h-12 justify-center rounded-xl bg-blue-500 text-white font-black tracking-widest uppercase text-xs hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                                icon={<Zap size={14} />}
                            >
                                {results ? 'Sync Now' : 'Initialize Link'}
                            </Button>
                        </form>
                    </div>
                </motion.div>
            )}

            {/*  Captcha  */}
            {step === 'captcha' && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="max-w-md mx-auto mt-10"
                >
                    <div className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-8">
                        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-5">
                            <div>
                                <h2 className="text-xl font-black text-white tracking-tight">Security Check</h2>
                                <p className="text-xs text-white/30 font-medium">Verify human identity</p>
                            </div>
                            <button disabled={captchaLoading || fetching} onClick={refreshCaptcha} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed">
                                <RefreshCw size={16} className={captchaLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                        <div className="p-4 bg-white rounded-2xl mb-6 flex justify-center shadow-inner overflow-hidden">
                            {captchaInfo?.captcha_image
                                ? <img src={captchaInfo.captcha_image.startsWith('data:') ? captchaInfo.captcha_image : `data:image/png;base64,${captchaInfo.captcha_image}`} alt="captcha" className="h-14 contrast-125 object-contain" />
                                : <div className="h-14 flex items-center justify-center text-black/20 font-black text-[10px] uppercase">Loading Visual...</div>
                            }
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleFetchResults(); }}>
                            <input disabled={fetching} value={captchaCode} onChange={e => setCaptchaCode(e.target.value)} placeholder="Enter code exactly as shown" className={`${inputCls} mb-3 text-center tracking-[0.2em] font-black disabled:opacity-60`} autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
                            <p className="mb-4 text-[11px] text-amber-400/70">CAPTCHA is case-sensitive and single-use. Refresh before every retry.</p>
                            <div className="flex gap-2">
                                <Button type="button" onClick={() => setStep('form')} variant="secondary" className="flex-1 justify-center rounded-xl bg-white/5 border border-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest">Back</Button>
                                <Button type="submit" isLoading={fetching} className="flex-1 justify-center rounded-xl bg-blue-500 text-white font-black tracking-widest uppercase text-[10px] shadow-lg shadow-blue-500/20">Verify</Button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            )}

            {/*  Results Dashboard  */}
            {step === 'results' && results && (
                <ResultsDashboard
                    user={user}
                    results={results}
                    profileInfo={profileInfo}
                    displayBatch={displayBatch}
                    lastUpdated={lastUpdated}
                    formatDate={formatDate}
                    handleSyncClick={handleSyncClick}
                    onOpenPdf={() => setShowPdfModal(true)}
                    selectedSem={selectedSem}
                    setSelectedSem={(value) => setSelectedSem(String(value))}
                    currentMetrics={currentMetrics}
                    metrics={metrics}
                    semMetrics={semMetrics}
                    academicStrength={academicStrength}
                    performanceSummary={performanceSummary}
                    chartSubjects={chartSubjects}
                    barChartData={barChartData}
                    barChartOptions={barChartOptions}
                    marksBreakdownData={marksBreakdownData}
                    marksBreakdownOptions={marksBreakdownOptions}
                    currentSubjects={currentSubjects}
                    currentSemesterMeta={currentSemesterMeta}
                    gradeDistributionData={gradeDistributionData}
                    doughnutOptions={doughnutOptions}
                    accentColor={accentColor}
                    getSubjectMarks={getSubjectMarks}
                    getSubjectDisplayMark={getSubjectDisplayMark}
                    gradeBgClass={gradeBgClass}
                    getSubjectPercentage={getSubjectPercentage}
                />
            )}
            {/* ── PDF Download Modal ───────────────────────────────────────── */}
            {showPdfModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-[#080808] p-8"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                    <Download size={14} className="text-emerald-400" />
                                </div>
                                <h3 className="text-base font-black text-white">Download Results PDF</h3>
                            </div>
                            <button onClick={() => setShowPdfModal(false)} className="text-white/20 hover:text-white/60 transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-[11px] text-white/30 mb-4">Select which results to include in the PDF:</p>

                        <div className="flex flex-col gap-2 mb-6">
                            {[{ label: 'All Semesters (Full Transcript)', val: 'overall' },
                              ...(results?.semesters || []).map((s: any) => {
                                  const num = s.semester_num ?? s.semester;
                                  return {
                                      label: s.semester_label || (num ? `Semester ${num}` : 'Semester'),
                                      val: String(num),
                                  };
                              })
                            ].map(opt => (
                                <button
                                    key={opt.val}
                                    onClick={() => setPdfSem(opt.val)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-bold text-left transition-all ${
                                        pdfSem === opt.val
                                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                                            : 'border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.05]'
                                    }`}
                                >
                                    <span className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${pdfSem === opt.val ? 'border-emerald-400 bg-emerald-400' : 'border-white/20'}`} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowPdfModal(false)}
                                className="flex-1 py-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] text-xs font-black text-white/40 hover:bg-white/[0.06] transition-all"
                            >Cancel</button>
                            <button
                                onClick={handleDownloadPdf}
                                disabled={pdfLoading}
                                className="flex-1 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-black text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {pdfLoading
                                    ? <><RefreshCw size={12} className="animate-spin" /> Generating…</>
                                    : <><Download size={12} /> Download PDF</>
                                }
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

        </motion.div>
    );
};

export default Results;
