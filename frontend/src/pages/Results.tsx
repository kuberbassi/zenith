import React, { useState, useEffect, useMemo } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, Filler, Tooltip as ChartTooltip, Legend,
    type ChartOptions,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
    Eye, EyeOff, RefreshCw, Zap, GraduationCap, TrendingUp, BarChart3,
    ShieldCheck, Activity, BookOpen, PieChart, KeyRound, X, Download
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import Button from '@/components/ui/Button';
import CircularProgress from '@/components/ui/CircularProgress';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, Filler, ChartTooltip, Legend,
);

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

    // Change portal password modal
    const [showCPwModal, setShowCPwModal] = useState(false);
    const [cpwCurrent, setCpwCurrent] = useState('');
    const [cpwNew, setCpwNew] = useState('');
    const [cpwConfirm, setCpwConfirm] = useState('');
    const [cpwLoading, setCpwLoading] = useState(false);
    const [cpwError, setCpwError] = useState<string | null>(null);

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

    async function handleChangePw() {
        if (!cpwCurrent.trim() || !cpwNew.trim() || !cpwConfirm.trim()) {
            setCpwError('All fields are required.'); return;
        }
        if (cpwNew !== cpwConfirm) { setCpwError('Passwords do not match.'); return; }
        if (cpwNew === cpwCurrent) { setCpwError('New password must be different from the current password.'); return; }
        if (cpwNew.length < 8) { setCpwError('New password must be at least 8 characters.'); return; }
        if (!/[A-Z]/.test(cpwNew) || !/[a-z]/.test(cpwNew) || !/[0-9]/.test(cpwNew) || !/[!@#$%^&*]/.test(cpwNew)) {
            setCpwError('Use uppercase, lowercase, number, and one special character from !@#$%^&*.');
            return;
        }
        setCpwError(null); setCpwLoading(true);
        try {
            const res: any = await attendanceService.changeIPUPassword({
                current_password: cpwCurrent, new_password: cpwNew, confirm_password: cpwConfirm,
            });
            showToast('success', res?.message || 'Password changed successfully!');
            setShowCPwModal(false);
            setCpwCurrent(''); setCpwNew(''); setCpwConfirm('');
        } catch (e: any) {
            setCpwError(e?.response?.data?.error || 'Failed to change password. Sync results first, then change it within 10 minutes.');
        } finally { setCpwLoading(false); }
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
        const academicScore = allSubjects.length
            ? Math.round((allSubjects.reduce((acc: number, s: any) => acc + (GRADE_POINTS[s.grade] ?? 0), 0) / (allSubjects.length * 10)) * 100)
            : 0;
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
                <div className="space-y-6">

                    {/* Hero Header */}
                    <motion.section
                        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                        className="relative rounded-3xl border border-white/[0.06] bg-[#050508] p-8 md:p-12 overflow-hidden"
                        style={{ boxShadow: '0 0 80px rgba(59,130,246,0.04), inset 0 1px 0 rgba(255,255,255,0.04)' }}
                    >
                        <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-blue-500/[0.03] blur-[100px] pointer-events-none" />
                        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <ShieldCheck size={18} className="text-blue-400" />
                                    <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em]">Verified Academic Record</span>
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">{profileInfo?.name || user?.name}</h1>
                                <p className="text-blue-400/60 font-medium tracking-wide mb-8">{profileInfo?.programme || 'Programme unavailable'} &bull; Batch {displayBatch}</p>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Enrollment</p>
                                        <p className="text-sm font-bold text-white/70">{results.enrollment_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Batch</p>
                                        <p className="text-sm font-bold text-white/70">{displayBatch}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Admission Year</p>
                                        <p className="text-sm font-bold text-white/70">{profileInfo?.admission_year || '---'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Gender</p>
                                        <p className="text-sm font-bold text-white/70">{profileInfo?.gender || '---'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Father's Name</p>
                                        <p className="text-sm font-bold text-white/70">{profileInfo?.father || '---'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Mother's Name</p>
                                        <p className="text-sm font-bold text-white/70">{profileInfo?.mother || '---'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Phone</p>
                                        <p className="text-sm font-bold text-white/70">{profileInfo?.phone || '---'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Email</p>
                                        <p className="text-sm font-bold text-white/70 truncate">{profileInfo?.email || '---'}</p>
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Institution</p>
                                        <p className="text-sm font-bold text-white/70 truncate">{profileInfo?.institution || '---'}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-4 mt-6 pt-5 border-t border-white/5">
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                                            Last Synced
                                        </p>
                                        <p className="text-xs font-bold text-white/40">{formatDate(lastUpdated)}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={handleSyncClick}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-black text-blue-400 hover:bg-blue-500/20 transition-all"
                                        >
                                            <RefreshCw size={12} /> Sync Results
                                        </button>
                                        <button
                                            onClick={() => setShowPdfModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                        >
                                            <Download size={12} /> Download PDF
                                        </button>
                                        <button
                                            onClick={() => setShowCPwModal(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/[0.08] text-xs font-black text-white/40 hover:bg-white/10 hover:text-white/60 transition-all"
                                        >
                                            <KeyRound size={12} /> Change Password
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-center">
                                <CircularProgress
                                    value={selectedSem === 'overall' ? (results.academicStrength ?? academicStrength ?? 0) : academicStrength} max={100}
                                    primaryColor={accentColor} secondaryColor="rgba(255,255,255,0.02)"
                                    glowColor="rgba(59, 130, 246, 0.4)" size={160} strokeWidth={10}
                                >
                                    <div className="text-center">
                                        <p className="text-5xl font-black text-white tracking-tighter leading-none">{results.cgpa ? parseFloat(results.cgpa).toFixed(2) : (metrics?.cgpa?.toFixed(2) || '---')}</p>
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-2">{Math.round(selectedSem === 'overall' ? (results.academicStrength ?? academicStrength ?? 0) : academicStrength)}%</p>
                                    </div>
                                </CircularProgress>
                            </div>
                        </div>
                    </motion.section>

                    {/* Semester Tabs */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSelectedSem('overall')}
                            className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedSem === 'overall' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}
                        >
                            Overview
                        </button>
                        {results.semesters.map((s: any) => (
                            <button
                                key={s.semester}
                                onClick={() => setSelectedSem(s.semester)}
                                className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${selectedSem === s.semester ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}
                            >
                                Sem {s.semester}
                            </button>
                        ))}
                    </div>

                    {/* KPI Cards */}
                    {currentMetrics && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="grid grid-cols-2 md:grid-cols-4 gap-3"
                        >
                            {[
                                { label: 'Scored', val: `${currentMetrics.totalMarks}/${currentMetrics.totalMaxMarks}`, icon: <BarChart3 size={15} />, color: accentColor },
                                { label: 'Pass Rate', val: `${currentMetrics.passRate}%`, icon: <TrendingUp size={15} />, color: '#3b82f6' },
                                { label: selectedSem === 'overall' ? 'CGPA' : 'SGPA', val: (selectedSem === 'overall' ? metrics?.cgpa : semMetrics?.sgpa)?.toFixed(2) ?? '---', icon: <Activity size={15} />, color: '#8b5cf6' },
                                { label: 'Credits', val: currentMetrics.totalCredits ? String(Math.round(currentMetrics.totalCredits)) : '---', icon: <BookOpen size={15} />, color: 'rgba(255,255,255,0.8)' },
                            ].map(k => (
                                <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5 md:p-6 flex flex-col justify-between min-h-[148px] group transition-all duration-500 hover:border-blue-500/20" style={{ boxShadow: '0 0 20px rgba(59,130,246,0.01), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
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
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-3"
                        >
                            <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Academic Power</p>
                                <p className="text-3xl font-black tracking-tighter text-emerald-400">{Math.round(academicStrength)}%</p>
                                <p className="text-xs text-white/35 mt-2">Single score that compresses marks strength into one quick read.</p>
                            </div>
                            <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Strongest Subject</p>
                                <p className="text-2xl font-black tracking-tighter text-blue-400">{performanceSummary.strongest?.code || performanceSummary.strongest?.name || '---'}</p>
                                <p className="text-xs text-white/35 mt-2">{performanceSummary.strongest ? `${getSubjectPercentage(performanceSummary.strongest)}% with ${performanceSummary.strongest.grade || 'no grade'}` : 'No completed subjects yet.'}</p>
                            </div>
                            <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Attention Needed</p>
                                <p className="text-2xl font-black tracking-tighter text-amber-400">{performanceSummary.weakest?.code || performanceSummary.weakest?.name || '---'}</p>
                                <p className="text-xs text-white/35 mt-2">{performanceSummary.weakest ? `${getSubjectPercentage(performanceSummary.weakest)}% and grade ${performanceSummary.weakest.grade || 'pending'}` : 'No weak subject detected.'}</p>
                            </div>
                            <div className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5">
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2">Distinction Count</p>
                                <p className="text-3xl font-black tracking-tighter text-fuchsia-400">{performanceSummary.distinctionCount}</p>
                                <p className="text-xs text-white/35 mt-2">{performanceSummary.pendingCount > 0 ? `${performanceSummary.pendingCount} pending subjects excluded from this count.` : 'Subjects currently scoring 75% or above.'}</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Charts */}
                    {chartSubjects.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <motion.div className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6 min-h-[350px] flex flex-col hover:border-blue-500/20 transition-all duration-500">
                                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-2">Score Distribution</h3>
                                <p className="text-xs text-white/30 mb-6">Clear ranking of subject-wise percentages so weak areas are obvious.</p>
                                <div className="flex-1"><Bar data={barChartData} options={barChartOptions} /></div>
                            </motion.div>
                            <motion.div className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6 min-h-[350px] flex flex-col hover:border-blue-500/20 transition-all duration-500">
                                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-2">Marks Composition</h3>
                                <p className="text-xs text-white/30 mb-6">Internal and external contributions per subject, useful for spotting missing or weak components.</p>
                                <div className="flex-1 pb-4"><Bar data={marksBreakdownData} options={marksBreakdownOptions} /></div>
                            </motion.div>
                        </div>
                    )}

                    {/* Per-Semester Subject Table */}
                    {selectedSem !== 'overall' && currentSubjects.length > 0 && (
                        <motion.section
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/[0.05] flex items-center justify-between gap-4">
                                <div>
                                <h3 className="text-sm font-black text-white/70 uppercase tracking-widest">
                                    {results.semesters.find((s: any) => s.semester === selectedSem)?.semester_label || 'Semester'} — Subjects
                                </h3>
                                    {currentSemesterMeta && (
                                        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/28">
                                            {currentSemesterMeta.examSession && <span>Exam {currentSemesterMeta.examSession}</span>}
                                            {currentSemesterMeta.examSession && currentSemesterMeta.declaredDate && <span className="mx-2 text-white/15">•</span>}
                                            {currentSemesterMeta.declaredDate && <span>Declared {currentSemesterMeta.declaredDate}</span>}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase">{currentSubjects.length} Subjects</span>
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
                                                    <td className="px-6 py-4 text-sm font-bold text-white/70 max-w-[200px]">
                                                        <span className="truncate block">{sub.name}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm font-black text-white/50">{sub.credits || '---'}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm text-white/40">{sub.is_pending ? 'Pending' : displayInternal}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm text-white/40">{sub.is_pending ? 'Pending' : displayExternal}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm font-bold text-white/60">
                                                            {sub.is_pending ? 'Pending' : total}<span className="text-white/20 text-xs">/{maxMarks}</span>
                                                            {!sub.is_pending && !hasExplicitTotal && <span className="ml-2 text-[10px] text-white/20">derived</span>}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className={`px-3 py-1 rounded-lg text-xs font-black ${gradeBgClass(sub.grade)}`}>{sub.grade || '---'}</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </motion.section>
                    )}

                    {/* Overview: Semester Cards + CGPA Calculator */}
                    {selectedSem === 'overall' && (
                        <>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
                            >
                                {results.semesters.map((sem: any) => {
                                    const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : calcSGPA(sem.subjects || []);
                                    const semCredits = (sem.subjects || []).reduce((a: number, s: any) => a + (parseFloat(s.credits || '0') || 0), 0);
                                    const passRate = sem.subjects?.length
                                        ? Math.round((sem.subjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) >= 4).length / sem.subjects.length) * 100)
                                        : 0;
                                    return (
                                        <div
                                            key={sem.semester}
                                            onClick={() => setSelectedSem(sem.semester)}
                                            className="cursor-pointer group rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-6 hover:border-blue-500/30 transition-all"
                                            style={{ boxShadow: '0 0 20px rgba(59,130,246,0.01), inset 0 1px 0 rgba(255,255,255,0.04)' }}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">{sem.semester_label || `Semester ${sem.semester}`}</p>
                                                    <p className="text-sm font-bold text-white/60 group-hover:text-white transition-colors">{sem.subjects?.length || 0} Subjects</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-2xl font-black text-blue-400 tracking-tighter group-hover:scale-105 transition-transform">{sgpa.toFixed(2)}</p>
                                                    <p className="text-[10px] font-bold text-white/10 uppercase tracking-widest mt-0.5">SGPA</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] text-white/20 font-bold uppercase mb-2">
                                                <span>{Math.round(semCredits)} Credits</span>
                                                <span>{passRate}% Pass</span>
                                            </div>
                                            <div className="h-1 rounded-full bg-white/[0.03] overflow-hidden">
                                                <div className="h-full bg-blue-500/40 rounded-full" style={{ width: `${(sgpa / 10) * 100}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </motion.div>

                            {/* Grade Distribution Dashboard Map */}
                            <motion.section
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden"
                            >
                                <div className="p-6 border-b border-white/[0.05] flex items-center gap-3">
                                    <PieChart size={16} className="text-blue-400" />
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
                                        {gradeDistributionData.labels.map((lbl, idx) => (
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

                            {/* Semester SGPA Breakdown */}
                            <div className="pt-5 mt-6 border-t border-white/[0.05]">
                                <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-4">Semester GPA Breakdown</p>
                                <div className="space-y-3">
                                    {results.semesters.map((sem: any) => {
                                        const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : calcSGPA(sem.subjects || []);
                                        return (
                                            <div key={sem.semester} className="flex items-center gap-4">
                                                <span className="text-[10px] font-black text-white/20 uppercase w-24 shrink-0 truncate">{sem.semester_label || `Sem ${sem.semester}`}</span>
                                                <div className="flex-1 h-2 rounded-full bg-white/[0.03] overflow-hidden">
                                                    <div className="h-full bg-blue-500/50 rounded-full" style={{ width: `${(sgpa / 10) * 100}%` }} />
                                                </div>
                                                <span className="text-sm font-black text-blue-400 w-12 text-right tabular-nums">{sgpa.toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
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

            {/* ── Change Portal Password Modal ─────────────────────────────── */}
            {showCPwModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#080808] p-8"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                                    <KeyRound size={14} className="text-white/40" />
                                </div>
                                <h3 className="text-base font-black text-white">Change Portal Password</h3>
                            </div>
                            <button onClick={() => { setShowCPwModal(false); setCpwError(null); }} className="text-white/20 hover:text-white/60 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-[11px] text-amber-400/60 mb-6 ml-11">Sync results first if this fails — active session required (expires in 30 min)</p>

                        {cpwError && (
                            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">{cpwError}</div>
                        )}

                        <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.16em] mb-3">Portal Password Rules</p>
                            <ul className="space-y-2 text-xs leading-5 text-white/55">
                                <li>Use your current portal password in the first field.</li>
                                <li>New password must include uppercase, lowercase, number, and one special character from !@#$%^&amp;*.</li>
                                <li>The portal requires minimum 8 characters.</li>
                                <li>Do not reuse the current password.</li>
                                <li className="text-amber-300/80">After 3 unsuccessful attempts, the account can be locked and the session logged out.</li>
                            </ul>
                        </div>

                        <div className="space-y-3 mb-6">
                            <input
                                type="password" value={cpwCurrent} onChange={e => setCpwCurrent(e.target.value)}
                                placeholder="Current Portal Password" className={inputCls}
                            />
                            <input
                                type="password" value={cpwNew} onChange={e => setCpwNew(e.target.value)}
                                placeholder="New Portal Password" className={inputCls}
                            />
                            <input
                                type="password" value={cpwConfirm} onChange={e => setCpwConfirm(e.target.value)}
                                placeholder="Retype New Password" className={inputCls}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowCPwModal(false); setCpwError(null); setCpwCurrent(''); setCpwNew(''); setCpwConfirm(''); }}
                                className="flex-1 py-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] text-xs font-black text-white/40 hover:bg-white/[0.06] transition-all"
                            >Cancel</button>
                            <button
                                onClick={handleChangePw} disabled={cpwLoading}
                                className="flex-1 py-3 rounded-2xl bg-white/10 border border-white/10 text-xs font-black text-white/70 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {cpwLoading ? <><RefreshCw size={12} className="animate-spin" /> Changing…</> : 'Change Password'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default Results;
