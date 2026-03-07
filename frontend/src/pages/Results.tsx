import React, { useState, useEffect, useMemo } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';
import {
    Chart as ChartJS,
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, RadialLinearScale, Filler, Tooltip as ChartTooltip, Legend,
    type ChartOptions,
} from 'chart.js';
import { Bar, Radar, Doughnut } from 'react-chartjs-2';
import {
    Eye, EyeOff, RefreshCw, Zap, GraduationCap, TrendingUp, BarChart3,
    ShieldCheck, Activity, BookOpen, PieChart
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import Button from '@/components/ui/Button';
import CircularProgress from '@/components/ui/CircularProgress';

ChartJS.register(
    CategoryScale, LinearScale, BarElement, PointElement, LineElement,
    ArcElement, RadialLinearScale, Filler, ChartTooltip, Legend,
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

/* ── Demo / Preview mock data ────────────────────────────────────────── */
const MOCK_RESULTS = {
    enrollment_number: '00113302725',
    student_info: {
        name: 'PARAG BASSI',
        father: '—',
        programme: 'Bachelor of Technology (Information Technology)',
        institution: 'Vivekananda Institute of Professional Studies-TC',
        batch: '2022',
        roll_no: '00113302725',
    },
    cgpa: 8.12,
    overallPercentage: 70.9,
    totalSubjects: 29,
    gradeDistribution: { O: 3, 'A+': 7, A: 13, 'B+': 4, B: 1, 'C+': 1 },
    saved: false,
    last_updated: null as string | null,
    semesters: [
        {
            semester: '1', semester_num: 1, semester_label: 'Semester 1',
            sgpa: '7.80', total_marks: '425', max_marks: '600',
            subjects: [
                { code: 'MAT-101', name: 'Mathematics I', internal: '18', external: '44', total_marks: 62, max_marks: 100, percentage: 62, grade: 'A', grade_point: 8, status: 'P', credits: '4' },
                { code: 'PHY-101', name: 'Engineering Physics', internal: '15', external: '40', total_marks: 55, max_marks: 100, percentage: 55, grade: 'B+', grade_point: 7, status: 'P', credits: '4' },
                { code: 'BEE-101', name: 'Basic Elec. & Electronics', internal: '14', external: '36', total_marks: 50, max_marks: 100, percentage: 50, grade: 'B', grade_point: 6, status: 'P', credits: '4' },
                { code: 'CSE-101', name: 'Programming in C', internal: '25', external: '65', total_marks: 90, max_marks: 100, percentage: 90, grade: 'O', grade_point: 10, status: 'P', credits: '4' },
                { code: 'ME-101', name: 'Engineering Graphics', internal: '20', external: '48', total_marks: 68, max_marks: 100, percentage: 68, grade: 'A', grade_point: 8, status: 'P', credits: '2' },
                { code: 'HU-101', name: 'Communication Skills', internal: '22', external: '50', total_marks: 72, max_marks: 100, percentage: 72, grade: 'A', grade_point: 8, status: 'P', credits: '2' },
            ],
        },
        {
            semester: '2', semester_num: 2, semester_label: 'Semester 2',
            sgpa: '7.55', total_marks: '395', max_marks: '600',
            subjects: [
                { code: 'MAT-201', name: 'Mathematics II', internal: '20', external: '48', total_marks: 68, max_marks: 100, percentage: 68, grade: 'A', grade_point: 8, status: 'P', credits: '4' },
                { code: 'CHE-201', name: 'Engineering Chemistry', internal: '16', external: '41', total_marks: 57, max_marks: 100, percentage: 57, grade: 'B+', grade_point: 7, status: 'P', credits: '4' },
                { code: 'CSE-201', name: 'Data Structures using C', internal: '24', external: '58', total_marks: 82, max_marks: 100, percentage: 82, grade: 'A+', grade_point: 9, status: 'P', credits: '4' },
                { code: 'ME-201', name: 'Engineering Mechanics', internal: '13', external: '35', total_marks: 48, max_marks: 100, percentage: 48, grade: 'C+', grade_point: 5, status: 'P', credits: '4' },
                { code: 'EC-201', name: 'Basic Electronics', internal: '19', external: '46', total_marks: 65, max_marks: 100, percentage: 65, grade: 'A', grade_point: 8, status: 'P', credits: '4' },
                { code: 'EVS-201', name: 'Environmental Science', internal: '22', external: '53', total_marks: 75, max_marks: 100, percentage: 75, grade: 'A+', grade_point: 9, status: 'P', credits: '2' },
            ],
        },
        {
            semester: '3', semester_num: 3, semester_label: 'Semester 3',
            sgpa: '8.55', total_marks: '442', max_marks: '600',
            subjects: [
                { code: 'MAT-301', name: 'Mathematics III', internal: '21', external: '49', total_marks: 70, max_marks: 100, percentage: 70, grade: 'A', grade_point: 8, status: 'P', credits: '4' },
                { code: 'DE-301', name: 'Digital Electronics', internal: '23', external: '55', total_marks: 78, max_marks: 100, percentage: 78, grade: 'A+', grade_point: 9, status: 'P', credits: '4' },
                { code: 'CO-301', name: 'Computer Organization', internal: '18', external: '45', total_marks: 63, max_marks: 100, percentage: 63, grade: 'A', grade_point: 8, status: 'P', credits: '4' },
                { code: 'OOP-301', name: 'Object Oriented Prog. (Java)', internal: '26', external: '65', total_marks: 91, max_marks: 100, percentage: 91, grade: 'O', grade_point: 10, status: 'P', credits: '4' },
                { code: 'DM-301', name: 'Discrete Mathematics', internal: '22', external: '50', total_marks: 72, max_marks: 100, percentage: 72, grade: 'A', grade_point: 8, status: 'P', credits: '4' },
                { code: 'SE-301', name: 'Software Engineering', internal: '20', external: '48', total_marks: 68, max_marks: 100, percentage: 68, grade: 'A', grade_point: 8, status: 'P', credits: '2' },
            ],
        },
        {
            semester: '4', semester_num: 4, semester_label: 'Semester 4',
            sgpa: '8.09', total_marks: '427', max_marks: '600',
            subjects: [
                { code: 'OS-401', name: 'Operating Systems', internal: '22', external: '52', total_marks: 74, max_marks: 100, percentage: 74, grade: 'A', grade_point: 8, status: 'P', credits: '4' },
                { code: 'DBMS-401', name: 'Database Management Systems', internal: '24', external: '58', total_marks: 82, max_marks: 100, percentage: 82, grade: 'A+', grade_point: 9, status: 'P', credits: '4' },
                { code: 'CN-401', name: 'Computer Networks', internal: '20', external: '48', total_marks: 68, max_marks: 100, percentage: 68, grade: 'A', grade_point: 8, status: 'P', credits: '4' },
                { code: 'DAA-401', name: 'Design & Analysis of Algorithms', internal: '19', external: '46', total_marks: 65, max_marks: 100, percentage: 65, grade: 'A', grade_point: 8, status: 'P', credits: '4' },
                { code: 'TOC-401', name: 'Theory of Computation', internal: '17', external: '43', total_marks: 60, max_marks: 100, percentage: 60, grade: 'B+', grade_point: 7, status: 'P', credits: '4' },
                { code: 'AI-401', name: 'Artificial Intelligence', internal: '23', external: '55', total_marks: 78, max_marks: 100, percentage: 78, grade: 'A+', grade_point: 9, status: 'P', credits: '2' },
            ],
        },
        {
            semester: '5', semester_num: 5, semester_label: 'Semester 5',
            sgpa: '8.60', total_marks: '367', max_marks: '500',
            subjects: [
                { code: 'WT-501', name: 'Web Technologies', internal: '24', external: '56', total_marks: 80, max_marks: 100, percentage: 80, grade: 'A+', grade_point: 9, status: 'P', credits: '4' },
                { code: 'MP-501', name: 'Microprocessors', internal: '18', external: '44', total_marks: 62, max_marks: 100, percentage: 62, grade: 'A', grade_point: 8, status: 'P', credits: '4' },
                { code: 'CG-501', name: 'Computer Graphics', internal: '16', external: '42', total_marks: 58, max_marks: 100, percentage: 58, grade: 'B+', grade_point: 7, status: 'P', credits: '4' },
                { code: 'CC-501', name: 'Cloud Computing', internal: '22', external: '53', total_marks: 75, max_marks: 100, percentage: 75, grade: 'A+', grade_point: 9, status: 'P', credits: '4' },
                { code: 'PR-501', name: 'Minor Project', internal: '27', external: '65', total_marks: 92, max_marks: 100, percentage: 92, grade: 'O', grade_point: 10, status: 'P', credits: '4' },
            ],
        },
    ],
};

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

    // CGPA Calculator (Removed per user request)

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

    function loadDemoData() {
        setResults(MOCK_RESULTS);
        setLastUpdated(null);
        setStep('results');
        showToast('success', 'Demo mode — showing sample results preview');
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
        } catch { setError('Failed to refresh CAPTCHA.'); }
        finally { setCaptchaLoading(false); }
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
            // 423 = account locked — stop immediately, never refresh captcha
            if (status === 423) {
                setStep('form');
                setPassword('');
            }
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
        const totalMarks = allSubjects.reduce((a: number, s: any) =>
            a + (parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'))), 0);
        const totalMaxMarks = allSubjects.reduce((a: number, s: any) => a + (parseFloat(s.max_marks || '100')), 0);
        const passRate = allSubjects.length
            ? Math.round((allSubjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) >= 4).length / allSubjects.length) * 100)
            : 0;
        return { cgpa, passRate, totalSubjects: allSubjects.length, totalMarks, totalMaxMarks, totalCredits };
    }, [results]);

    const semMetrics = useMemo(() => {
        if (!results?.semesters?.length || selectedSem === 'overall') return null;
        const sem = results.semesters.find((s: any) => s.semester === selectedSem);
        if (!sem) return null;
        const subjects = sem.subjects || [];
        const sgpa = sem.sgpa ? parseFloat(sem.sgpa) : calcSGPA(subjects);
        const totalCredits = subjects.reduce((a: number, s: any) => a + (parseFloat(s.credits || '0') || 0), 0);
        const totalMarks = subjects.reduce((a: number, s: any) =>
            a + (parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'))), 0);
        const totalMaxMarks = subjects.reduce((a: number, s: any) => a + (parseFloat(s.max_marks || '100')), 0);
        const passRate = subjects.length
            ? Math.round((subjects.filter((s: any) => (GRADE_POINTS[s.grade] ?? 0) >= 4).length / subjects.length) * 100)
            : 0;
        return { sgpa, passRate, totalSubjects: subjects.length, totalMarks, totalMaxMarks, totalCredits };
    }, [results, selectedSem]);

    const currentMetrics = selectedSem === 'overall' ? metrics : semMetrics;

    const currentSubjects = useMemo(() => {
        if (!results?.semesters) return [];
        if (selectedSem === 'overall') return results.semesters.flatMap((s: any) => s.subjects || []).slice(0, 20);
        return results.semesters.find((s: any) => s.semester === selectedSem)?.subjects || [];
    }, [results, selectedSem]);

    /*  Chart data  */
    const barChartData = useMemo(() => ({
        labels: currentSubjects.slice(0, 12).map((s: any) => s.code || s.name?.substring(0, 8) || '?'),
        datasets: [
            { label: 'Marks', data: currentSubjects.slice(0, 12).map((s: any) => parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'))), backgroundColor: accentColor, borderRadius: 6 },
        ],
    }), [currentSubjects]);

    const barChartOptions: ChartOptions<'bar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 } } },
            y: { grid: { color: gridColor }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 9 }, maxTicksLimit: 5 } },
        },
    };

    const radarOptions: ChartOptions<'radar'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            r: {
                grid: { color: 'rgba(255,255,255,0.05)' },
                angleLines: { color: 'rgba(255,255,255,0.05)' },
                pointLabels: { color: 'rgba(255,255,255,0.3)', font: { size: 8 } },
                ticks: { display: false, count: 5 },
            },
        },
    };

    const radarChartData = useMemo(() => ({
        labels: currentSubjects.slice(0, 8).map((s: any) => s.code || s.name?.substring(0, 8) || '?'),
        datasets: [{
            label: 'Performance',
            data: currentSubjects.slice(0, 8).map((s: any) => {
                const tot = parseFloat(s.marks || '0') || (parseFloat(s.internal || '0') + parseFloat(s.external || '0'));
                return Math.round((tot / 100) * 100);
            }),
            backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: accentColor, borderWidth: 2, pointRadius: 2,
        }],
    }), [currentSubjects]);

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
                            {/* Demo banner */}
                            <div className="mb-2 p-3 rounded-xl border border-blue-500/10 bg-blue-500/[0.04] flex items-center justify-between">
                                <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Account locked? Preview the UI</span>
                                <button type="button" onClick={loadDemoData} className="text-[10px] font-black text-blue-400/60 hover:text-blue-400 uppercase tracking-widest transition-colors">Demo →</button>
                            </div>
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
                            <button onClick={refreshCaptcha} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 active:scale-95 transition-transform">
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
                            <input value={captchaCode} onChange={e => setCaptchaCode(e.target.value)} placeholder="Type CAPTCHA..." className={`${inputCls} mb-4 text-center tracking-[0.4em] font-black uppercase`} required />
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
                                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">{results.student_info?.name || user?.name}</h1>
                                <p className="text-blue-400/60 font-medium tracking-wide mb-8">{results.student_info?.programme} &bull; Batch {results.student_info?.batch}</p>

                                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Enrollment</p>
                                        <p className="text-sm font-bold text-white/70">{results.enrollment_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Institution</p>
                                        <p className="text-sm font-bold text-white/70 truncate">{results.student_info?.institution}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1.5">Father's Name</p>
                                        <p className="text-sm font-bold text-white/70">{results.student_info?.father || '---'}</p>
                                    </div>
                                    <div className="col-span-2 md:col-span-1 border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-6">
                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
                                            Last Synced
                                        </p>
                                        <p className="text-xs font-bold text-white/40 mb-3">{formatDate(lastUpdated)}</p>
                                        <button
                                            onClick={handleSyncClick}
                                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs font-black text-blue-400 hover:bg-blue-500/20 transition-all"
                                        >
                                            <RefreshCw size={12} /> Sync Results
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="relative flex items-center justify-center">
                                <CircularProgress
                                    value={results.overallPercentage || 0} max={100}
                                    primaryColor={accentColor} secondaryColor="rgba(255,255,255,0.02)"
                                    glowColor="rgba(59, 130, 246, 0.4)" size={160} strokeWidth={10}
                                >
                                    <div className="text-center">
                                        <p className="text-5xl font-black text-white tracking-tighter leading-none">{results.cgpa ? parseFloat(results.cgpa).toFixed(2) : (metrics?.cgpa?.toFixed(2) || '---')}</p>
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-2">{results.overallPercentage ? `${results.overallPercentage.toFixed(1)}%` : 'CGPA'}</p>
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
                                { label: 'Total Marks', val: `${currentMetrics.totalMarks}/${currentMetrics.totalMaxMarks}`, icon: <BarChart3 size={15} />, color: accentColor },
                                { label: 'Pass Rate', val: `${currentMetrics.passRate}%`, icon: <TrendingUp size={15} />, color: '#3b82f6' },
                                { label: selectedSem === 'overall' ? 'CGPA' : 'SGPA', val: (selectedSem === 'overall' ? metrics?.cgpa : semMetrics?.sgpa)?.toFixed(2) ?? '---', icon: <Activity size={15} />, color: '#8b5cf6' },
                                { label: 'Total Credits', val: currentMetrics.totalCredits ? String(Math.round(currentMetrics.totalCredits)) : '---', icon: <BookOpen size={15} />, color: 'rgba(255,255,255,0.6)' },
                            ].map(k => (
                                <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-5 flex flex-col justify-between min-h-[130px] group transition-all duration-500 hover:border-blue-500/20" style={{ boxShadow: '0 0 20px rgba(59,130,246,0.01), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{k.label}</span>
                                        <div style={{ color: `${k.color}80` }} className="group-hover:scale-110 transition-transform">{k.icon}</div>
                                    </div>
                                    <p className="text-3xl font-black tracking-tighter" style={{ color: k.color }}>{k.val}</p>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {/* Charts */}
                    {currentSubjects.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <motion.div className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6 min-h-[350px] flex flex-col hover:border-blue-500/20 transition-all duration-500">
                                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-6">Subject Statistics</h3>
                                <div className="flex-1"><Bar data={barChartData} options={barChartOptions} /></div>
                            </motion.div>
                            <motion.div className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] p-6 min-h-[350px] flex flex-col hover:border-blue-500/20 transition-all duration-500">
                                <h3 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-6">Performance Radar</h3>
                                <div className="flex-1 pb-4"><Radar data={radarChartData} options={radarOptions} /></div>
                            </motion.div>
                        </div>
                    )}

                    {/* Per-Semester Subject Table */}
                    {selectedSem !== 'overall' && currentSubjects.length > 0 && (
                        <motion.section
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                            className="rounded-3xl border border-white/[0.08] bg-[#0a0a0a] overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/[0.05] flex items-center justify-between">
                                <h3 className="text-sm font-black text-white/70 uppercase tracking-widest">
                                    {results.semesters.find((s: any) => s.semester === selectedSem)?.semester_label || 'Semester'} — Subjects
                                </h3>
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
                                            const internal = parseFloat(sub.internal || sub.internal_theory || '0') || 0;
                                            const external = parseFloat(sub.external || sub.external_theory || '0') || 0;
                                            const tot = parseFloat(sub.marks || '0') || (internal + external) || parseFloat(sub.total_marks || '0');
                                            const maxMarks = parseFloat(sub.max_marks || '100');
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
                                                        <span className="text-sm text-white/40">{internal || '---'}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm text-white/40">{external || '---'}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-sm font-bold text-white/60">
                                                            {tot || '---'}<span className="text-white/20 text-xs">/{maxMarks}</span>
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
        </motion.div>
    );
};

export default Results;
