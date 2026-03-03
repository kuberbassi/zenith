import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Palette, Settings as SettingsIcon, Download, Upload,
    Sun, Moon, AlertTriangle, LogOut, Trash2,
    Activity, Clock, FileText, Edit2, Camera,
    GraduationCap, BookOpen, Target,
    Mail, Hash, Building2, CalendarDays, Shield
} from 'lucide-react';
import type { SystemLog } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSemester } from '@/contexts/SemesterContext';
import GlassCard from '@/components/ui/GlassCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import { authService } from '@/services/auth.service';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

interface UserPreferences {
    attendance_threshold: number;
    warning_threshold: number;
    counting_mode: 'classes' | 'percentage';
    accent_color: string;
}

const ACCENT_COLORS = [
    { name: 'Indigo', value: '#6750A4' },
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Teal', value: '#14B8A6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Lime', value: '#84CC16' },
    { name: 'Yellow', value: '#EAB308' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Rose', value: '#F43F5E' },
];

/* ── System Logs Sub-Component ─────────────────────────────────────────── */

const SystemLogsSection: React.FC = () => {
    const [groupedLogs, setGroupedLogs] = useState<Record<string, SystemLog[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadLogs(); }, []);

    const loadLogs = async () => {
        try {
            const data = await attendanceService.getSystemLogs();
            const grouped = data.reduce((acc: Record<string, SystemLog[]>, log) => {
                const date = typeof log.timestamp === 'string'
                    ? new Date(log.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : new Date((log.timestamp as any).$date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                if (!acc[date]) acc[date] = [];
                acc[date].push(log);
                return acc;
            }, {});
            setGroupedLogs(grouped);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getLogIcon = (action: string) => {
        const a = action.toLowerCase();
        if (a.includes('profile')) return <User size={14} className="text-blue-500" />;
        if (a.includes('attendance') || a.includes('subject')) return <Activity size={14} className="text-green-500" />;
        if (a.includes('delete') || a.includes('reset') || a.includes('wipe')) return <Trash2 size={14} className="text-red-500" />;
        if (a.includes('setting') || a.includes('preference')) return <SettingsIcon size={14} className="text-purple-500" />;
        if (a.includes('login') || a.includes('auth')) return <Clock size={14} className="text-orange-500" />;
        return <FileText size={14} className="text-primary" />;
    };

    if (loading) return (
        <GlassCard className="h-48 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-on-surface-variant animate-pulse">Loading activity...</p>
            </div>
        </GlassCard>
    );

    const dates = Object.keys(groupedLogs);

    return (
        <div className="space-y-4">
            {dates.length === 0 ? (
                <GlassCard className="p-10 flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-full bg-surface-container-highest flex items-center justify-center mb-3 opacity-40">
                        <Activity size={28} className="text-on-surface-variant" />
                    </div>
                    <h3 className="text-base font-semibold text-on-surface">No Activity Yet</h3>
                    <p className="text-xs text-on-surface-variant max-w-xs mt-1">Your actions, updates, and changes will appear here as a timeline.</p>
                </GlassCard>
            ) : (
                dates.map(date => (
                    <div key={date} className="space-y-2">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/50 sticky top-0 py-1.5 bg-surface/80 backdrop-blur-sm z-10 px-2 rounded-lg">
                            {date}
                        </h3>
                        <GlassCard className="divide-y divide-outline-variant/10">
                            {groupedLogs[date].map((log, index) => (
                                <div key={`${log._id}-${index}`} className="flex gap-3 items-start p-3.5 hover:bg-surface-container-low/30 transition-colors group">
                                    <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant/10 group-hover:scale-105 transition-transform">
                                        {getLogIcon(log.action)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="font-semibold text-xs text-on-surface truncate">{log.action}</h4>
                                            <span className="text-[10px] tabular-nums text-on-surface-variant/40 shrink-0">
                                                {typeof log.timestamp === 'string'
                                                    ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                    : new Date((log.timestamp as any).$date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5 leading-relaxed">{log.description}</p>
                                    </div>
                                </div>
                            ))}
                        </GlassCard>
                    </div>
                ))
            )}
        </div>
    );
};

/* ── Main Settings Component ───────────────────────────────────────────── */

type TabKey = 'profile' | 'appearance' | 'activity' | 'data';

const Settings: React.FC = () => {
    const { user, logout, setUser } = useAuth();
    const { theme, toggleTheme, setAccentColor, accentColor } = useTheme();
    const { currentSemester, setCurrentSemester } = useSemester();
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState<TabKey>('profile');
    const [imgError, setImgError] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [dashboardStats, setDashboardStats] = useState<{ attendance: number; totalSubjects: number } | null>(null);

    const [preferences, setPreferences] = useState<UserPreferences>({
        attendance_threshold: 75,
        warning_threshold: 76,
        counting_mode: 'percentage',
        accent_color: accentColor || '#EC4899'
    });

    const [name, setName] = useState(user?.name || '');
    const [profileForm, setProfileForm] = useState({
        course: '', college: '', semester: 1, batch: '', picture: '', enrollment_number: ''
    });

    useEffect(() => {
        if (user) {
            setProfileForm({
                course: user.course || user.branch || '', college: user.college || '',
                semester: user.semester || user.current_semester || 1, batch: user.batch || '',
                picture: user.picture || '', enrollment_number: user.enrollment_number || ''
            });
            setName(user.name);
        }
    }, [user]);

    useEffect(() => { loadPreferences(); loadDashboardStats(); }, []);

    useUnsavedChanges(isEditingProfile);

    async function loadDashboardStats() {
        try {
            const data = await attendanceService.getDashboardData(currentSemester);
            setDashboardStats({
                attendance: data.overall_attendance || 0,
                totalSubjects: data.total_subjects || 0,
            });
        } catch { /* ignore */ }
    }

    const loadPreferences = async () => {
        try {
            const prefs = await attendanceService.getPreferences();
            if (prefs) {
                setPreferences(prev => ({
                    ...prev,
                    attendance_threshold: prefs.attendance_threshold ?? prev.attendance_threshold,
                    warning_threshold: prefs.warning_threshold ?? prefs.min_attendance ?? prev.warning_threshold,
                    counting_mode: prefs.counting_mode ?? prev.counting_mode,
                    accent_color: prefs.accent_color ?? accentColor
                }));
                if (prefs.accent_color) setAccentColor(prefs.accent_color);
            }
        } catch { /* ignore */ }
    };

    /* ── Profile save ──────────────────────────────────────────────────── */

    const handleProfileSave = async () => {
        try {
            await attendanceService.updateProfile({ name, ...profileForm, enrollment_number: profileForm.enrollment_number });
            if (user) {
                const updatedUser = {
                    ...user, name, course: profileForm.course, college: profileForm.college,
                    semester: profileForm.semester, batch: profileForm.batch,
                    picture: profileForm.picture || user.picture, enrollment_number: profileForm.enrollment_number
                };
                authService.storeUser(updatedUser);
                setUser(updatedUser);
                setCurrentSemester(profileForm.semester);
            }
            setIsEditingProfile(false);
            showToast('success', 'Profile updated');
        } catch { showToast('error', 'Failed to update profile'); }
    };

    /* ── Preferences ───────────────────────────────────────────────────── */

    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const savePreferencesToAPI = useCallback(async (prefs: UserPreferences) => {
        try { await attendanceService.updatePreferences(prefs); showToast('success', 'Preferences saved'); }
        catch { showToast('error', 'Failed to save preferences'); }
    }, [showToast]);

    const debouncedSave = useCallback((newPrefs: Partial<UserPreferences>) => {
        const updated = { ...preferences, ...newPrefs };
        setPreferences(updated);
        if (newPrefs.accent_color) setAccentColor(newPrefs.accent_color);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => savePreferencesToAPI(updated), 1000);
    }, [preferences, savePreferencesToAPI, setAccentColor]);

    const savePreferences = async (newPrefs: Partial<UserPreferences>) => {
        const updated = { ...preferences, ...newPrefs };
        setPreferences(updated);
        if (newPrefs.accent_color) setAccentColor(newPrefs.accent_color);
        try { await attendanceService.updatePreferences(updated); showToast('success', 'Preferences saved'); }
        catch { showToast('error', 'Failed to save preferences'); }
    };

    /* ── Data Management ───────────────────────────────────────────────── */

    const handleExportData = async () => {
        try {
            const blob = await attendanceService.exportData();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `acadhub-data-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('success', 'Data exported successfully');
        } catch { showToast('error', 'Failed to export data'); }
    };

    const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const confirmed = confirm("⚠️ IMPORT WARNING\n\nImporting data will REPLACE all your current subjects, attendance logs, and settings.\n\n💡 Export a backup first if needed.\n\nContinue?");
        if (!confirmed) { e.target.value = ''; return; }
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            await attendanceService.importData(data);
            showToast('success', 'Data imported successfully');
            window.location.reload();
        } catch { showToast('error', 'Failed to import data'); }
    };

    const handleDeleteAllData = async () => {
        const userEmail = user?.email?.toLowerCase() || '';
        if (!confirm(`⚠️ WARNING: This will DELETE ALL your attendance data.\n\n📥 A backup will be downloaded first.\n🔒 Deleting data for: ${userEmail}\n\nContinue?`)) return;
        if (!confirm('⚠️ FINAL WARNING: All subjects, attendance logs, timetable, semester results, and settings will be deleted. Continue?')) return;
        const userInput = prompt('To confirm deletion, type DELETE in all caps:');
        if (userInput !== 'DELETE') { showToast('error', 'Deletion cancelled'); return; }
        try {
            showToast('info', 'Downloading backup before deletion...');
            const blob = await attendanceService.exportData();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `acadhub-backup-BEFORE-DELETE-${userEmail.replace('@', '_at_')}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            showToast('success', 'Backup downloaded! Proceeding with deletion...');
            await new Promise(resolve => setTimeout(resolve, 1500));
            const res: any = await attendanceService.deleteAllData(userEmail);
            if (res && res.success !== false) {
                showToast('success', `Data deleted. Server Backup ID: ${res.backup_id || 'N/A'}`);
                setTimeout(() => window.location.reload(), 2000);
            } else { showToast('error', res?.error || 'Failed to delete data'); }
        } catch (error: any) {
            showToast('error', error.response?.data?.error || error.message || 'Failed to delete data');
        }
    };

    /* ── Derived ───────────────────────────────────────────────────────── */

    const avatarUrl = profileForm.picture || user?.picture;
    const initials = (user?.name || user?.email || 'U').charAt(0).toUpperCase();
    const attendancePct = dashboardStats?.attendance ?? 0;
    const attendanceColor = attendancePct >= (preferences.attendance_threshold || 75) ? 'text-emerald-500' : attendancePct >= (preferences.warning_threshold || 76) ? 'text-amber-500' : 'text-rose-500';

    const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: 'profile', label: 'Profile', icon: <User size={15} /> },
        { key: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
        { key: 'activity', label: 'Activity', icon: <Activity size={15} /> },
        { key: 'data', label: 'Data', icon: <Shield size={15} /> },
    ];

    /* ── Render ─────────────────────────────────────────────────────────── */

    return (
        <div className="max-w-4xl mx-auto pb-24 space-y-5">

            {/* ── Hero Profile Card ─────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <GlassCard className="p-0 overflow-hidden">
                    {/* Gradient Banner */}
                    <div className="h-28 md:h-36 bg-gradient-to-br from-primary/20 via-primary/10 to-indigo-500/10 relative">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 to-transparent" />
                    </div>

                    <div className="px-5 md:px-8 pb-6 -mt-12 md:-mt-14 relative">
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-end">
                            {/* Avatar */}
                            <div className="relative group">
                                <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border-4 border-surface shadow-xl bg-surface-container">
                                    {(imgError || !avatarUrl) ? (
                                        <div className="w-full h-full bg-gradient-to-br from-primary to-primary/70 text-on-primary text-3xl md:text-4xl flex items-center justify-center font-bold">
                                            {initials}
                                        </div>
                                    ) : (
                                        <img src={avatarUrl} alt={user?.name || 'Profile'} className="w-full h-full object-cover" onError={() => setImgError(true)} />
                                    )}
                                </div>
                                {isEditingProfile && (
                                    <label htmlFor="pfp-upload-hero" className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                                        <Camera className="w-6 h-6 text-white" />
                                        <input type="file" accept="image/*" className="hidden" id="pfp-upload-hero" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const formData = new FormData(); formData.append('file', file);
                                                try { const res = await attendanceService.uploadPfp(formData); setProfileForm({ ...profileForm, picture: res.url }); showToast('success', 'Photo uploaded'); }
                                                catch { showToast('error', 'Upload failed'); }
                                            }
                                        }} />
                                    </label>
                                )}
                            </div>

                            {/* Name & Info */}
                            <div className="flex-1 min-w-0 pt-1 md:pb-1">
                                <h1 className="text-xl md:text-2xl font-black text-on-surface tracking-tight leading-tight">{user?.name || 'Student'}</h1>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                                    <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                                        <Mail className="w-3 h-3" /> {user?.email}
                                    </span>
                                    {user?.enrollment_number && (
                                        <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                                            <Hash className="w-3 h-3" /> {user.enrollment_number}
                                        </span>
                                    )}
                                    {user?.college && (
                                        <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                                            <Building2 className="w-3 h-3" /> {user.college}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Edit Button */}
                            <div className="shrink-0 md:pb-1">
                                {isEditingProfile ? (
                                    <div className="flex gap-2">
                                        <Button variant="text" size="sm" onClick={() => setIsEditingProfile(false)}>Cancel</Button>
                                        <Button size="sm" onClick={handleProfileSave}>Save</Button>
                                    </div>
                                ) : (
                                    <Button variant="outlined" size="sm" icon={<Edit2 size={14} />} onClick={() => setIsEditingProfile(true)}>Edit</Button>
                                )}
                            </div>
                        </div>

                        {/* Quick Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                            <StatChip icon={<Target className="w-3.5 h-3.5" />} label="Attendance" value={`${attendancePct.toFixed(1)}%`} valueClass={attendanceColor} />
                            <StatChip icon={<GraduationCap className="w-3.5 h-3.5" />} label="Semester" value={`Sem ${user?.semester || currentSemester}`} />
                            <StatChip icon={<BookOpen className="w-3.5 h-3.5" />} label="Subjects" value={String(dashboardStats?.totalSubjects ?? '—')} />
                            <StatChip icon={<CalendarDays className="w-3.5 h-3.5" />} label="Batch" value={user?.batch || '—'} />
                        </div>
                    </div>
                </GlassCard>
            </motion.div>

            {/* ── Tab Navigation ────────────────────────────────────────── */}
            <div className="flex gap-1.5 p-1 bg-surface-container/50 rounded-2xl border border-outline-variant/30 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex-1 justify-center
                            ${activeTab === tab.key
                                ? 'bg-primary text-on-primary shadow-md'
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50'}`}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Tab Content ───────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>

                    {/* ── Profile Tab ──────────────────────────────────── */}
                    {activeTab === 'profile' && (
                        <div className="space-y-5">
                            {/* Personal Info Card */}
                            <GlassCard className="p-5 md:p-6">
                                <SectionHeader icon={<User className="w-4 h-4 text-primary" />} title="Personal Information" subtitle="Your academic profile details" />
                                <div className="space-y-4 mt-5">
                                    <Input label="Display Name" value={name} onChange={e => setName(e.target.value)} disabled={!isEditingProfile} />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="Course / Branch" placeholder="e.g. B.Tech CSE" value={isEditingProfile ? profileForm.course : (user?.course || '')}
                                            disabled={!isEditingProfile} onChange={e => setProfileForm({ ...profileForm, course: e.target.value })} />
                                        <Input label="College / University" placeholder="e.g. USICT, GGSIPU" value={isEditingProfile ? profileForm.college : (user?.college || '')}
                                            disabled={!isEditingProfile} onChange={e => setProfileForm({ ...profileForm, college: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <Select label="Semester" value={isEditingProfile ? profileForm.semester : (user?.semester || 1)}
                                            options={[1,2,3,4,5,6,7,8].map(s => ({ value: s, label: `Sem ${s}` }))}
                                            disabled={!isEditingProfile} onChange={e => setProfileForm({ ...profileForm, semester: parseInt(e.target.value) })} />
                                        <Input label="Batch" placeholder="e.g. 2023-27" value={isEditingProfile ? profileForm.batch : (user?.batch || '')}
                                            disabled={!isEditingProfile} onChange={e => setProfileForm({ ...profileForm, batch: e.target.value })} />
                                        <Input label="Enrollment No." placeholder="e.g. 00113302725" value={isEditingProfile ? profileForm.enrollment_number : (user?.enrollment_number || '')}
                                            disabled={!isEditingProfile} onChange={e => setProfileForm({ ...profileForm, enrollment_number: e.target.value })} />
                                    </div>
                                    <Input label="Email" value={user?.email || ''} disabled />
                                </div>
                            </GlassCard>

                            {/* Attendance Preferences */}
                            <GlassCard className="p-5 md:p-6">
                                <SectionHeader icon={<SettingsIcon className="w-4 h-4 text-primary" />} title="Attendance Preferences" subtitle="Set your attendance targets" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                                    <div className="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20">
                                        <label className="block text-xs font-semibold text-on-surface-variant mb-2.5 uppercase tracking-wider">
                                            Minimum Attendance
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input type="number" min="50" max="100" value={preferences.attendance_threshold}
                                                onChange={e => debouncedSave({ attendance_threshold: Math.min(100, Math.max(50, parseInt(e.target.value) || 75)) })}
                                                onBlur={() => savePreferencesToAPI(preferences)}
                                                className="w-20 px-3 py-2 text-center text-lg font-bold rounded-xl bg-surface-container-highest text-on-surface border-2 border-outline-variant focus:border-primary outline-none transition-colors" />
                                            <span className="text-on-surface-variant font-medium">%</span>
                                        </div>
                                        <p className="text-[10px] text-on-surface-variant/60 mt-2">Below this → "at risk"</p>
                                    </div>
                                    <div className="p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20">
                                        <label className="block text-xs font-semibold text-on-surface-variant mb-2.5 uppercase tracking-wider">
                                            Warning Threshold
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input type="number" min={preferences.attendance_threshold} max="100" value={preferences.warning_threshold}
                                                onChange={e => debouncedSave({ warning_threshold: Math.min(100, Math.max(preferences.attendance_threshold, parseInt(e.target.value) || 76)) })}
                                                onBlur={() => savePreferencesToAPI(preferences)}
                                                className="w-20 px-3 py-2 text-center text-lg font-bold rounded-xl bg-surface-container-highest text-amber-500 border-2 border-amber-500/30 focus:border-amber-500 outline-none transition-colors" />
                                            <span className="text-on-surface-variant font-medium">%</span>
                                        </div>
                                        <p className="text-[10px] text-on-surface-variant/60 mt-2">Warning when below this</p>
                                    </div>
                                </div>
                            </GlassCard>
                        </div>
                    )}

                    {/* ── Appearance Tab ───────────────────────────────── */}
                    {activeTab === 'appearance' && (
                        <div className="space-y-5">
                            {/* Theme Toggle */}
                            <GlassCard className="p-5 cursor-pointer hover:bg-surface-container-low/50 transition-colors" onClick={toggleTheme}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-secondary-container/50 text-secondary flex items-center justify-center">
                                            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm text-on-surface">Theme</h3>
                                            <p className="text-xs text-on-surface-variant mt-0.5">{theme === 'dark' ? 'Dark' : 'Light'} mode is active</p>
                                        </div>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-primary' : 'bg-outline-variant'}`}>
                                        <div className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-transform ${theme === 'dark' ? 'translate-x-6 bg-on-primary' : 'bg-white'}`} />
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Accent Color */}
                            <GlassCard className="p-5 md:p-6">
                                <div className="flex items-center justify-between mb-5">
                                    <SectionHeader icon={<Palette className="w-4 h-4 text-primary" />} title="Accent Color" subtitle="Personalize the app's look" />
                                    <div className="relative group flex items-center gap-2 bg-surface-container-high/50 pl-1 pr-3 py-1 rounded-full border border-outline-variant/20 hover:border-primary/30 transition-colors">
                                        <div className="relative w-7 h-7 shrink-0">
                                            <div className="w-7 h-7 rounded-full shadow-sm ring-2 ring-white/20 overflow-hidden"><div className="w-full h-full" style={{ backgroundColor: preferences.accent_color }} /></div>
                                            <input type="color" value={preferences.accent_color}
                                                onChange={e => { setAccentColor(e.target.value); setPreferences({ ...preferences, accent_color: e.target.value }); debouncedSave({ accent_color: e.target.value }); }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                            <div className="absolute -bottom-0.5 -right-0.5 bg-surface-container-highest rounded-full p-0.5 shadow-sm border border-outline-variant/20 pointer-events-none z-0"><Edit2 size={7} className="text-on-surface-variant" /></div>
                                        </div>
                                        <span className="text-[10px] font-medium text-on-surface-variant">Custom</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-6 gap-3">
                                    {ACCENT_COLORS.map(color => (
                                        <button key={color.value}
                                            onClick={() => { setAccentColor(color.value); savePreferences({ accent_color: color.value }); }}
                                            className={`w-10 h-10 rounded-full transition-all hover:scale-110 ${preferences.accent_color === color.value ? 'ring-4 ring-white/30 scale-110 shadow-lg' : 'hover:ring-2 hover:ring-white/20'}`}
                                            style={{ backgroundColor: color.value }} title={color.name} />
                                    ))}
                                </div>
                            </GlassCard>
                        </div>
                    )}

                    {/* ── Activity Tab ─────────────────────────────────── */}
                    {activeTab === 'activity' && (
                        <div>
                            <SystemLogsSection />
                        </div>
                    )}

                    {/* ── Data Tab ─────────────────────────────────────── */}
                    {activeTab === 'data' && (
                        <div className="space-y-4">
                            {/* Export / Import */}
                            <GlassCard className="p-5 md:p-6">
                                <SectionHeader icon={<Download className="w-4 h-4 text-primary" />} title="Export & Import" subtitle="Backup or restore your data" />
                                <div className="flex flex-col sm:flex-row gap-3 mt-5">
                                    <Button className="flex-1 justify-center" icon={<Download size={16} />} onClick={handleExportData}>Export JSON</Button>
                                    <label className="flex-1">
                                        <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                                        <span className="flex items-center justify-center font-medium transition-all duration-200 border-2 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 px-4 h-10 text-sm rounded-full gap-2 cursor-pointer w-full">
                                            <Upload size={16} /> Import JSON
                                        </span>
                                    </label>
                                </div>
                            </GlassCard>

                            {/* Danger Zone */}
                            <GlassCard className="p-5 border-rose-500/20">
                                <SectionHeader icon={<AlertTriangle className="w-4 h-4 text-rose-500" />} title="Danger Zone" subtitle="Irreversible actions" titleClass="text-rose-500" />
                                <div className="space-y-3 mt-5">
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container/50 border border-outline-variant/20">
                                        <div>
                                            <h4 className="font-semibold text-sm text-on-surface">Sign Out</h4>
                                            <p className="text-xs text-on-surface-variant mt-0.5">End your current session</p>
                                        </div>
                                        <Button variant="outlined" size="sm" icon={<LogOut size={14} />} onClick={logout}>Logout</Button>
                                    </div>
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                                        <div>
                                            <h4 className="font-semibold text-sm text-rose-500">Delete All Data</h4>
                                            <p className="text-xs text-on-surface-variant mt-0.5">Permanently remove all records</p>
                                        </div>
                                        <Button variant="outlined" size="sm" icon={<Trash2 size={14} />} onClick={handleDeleteAllData} className="!border-rose-500 !text-rose-500 hover:!bg-rose-500/10">Delete</Button>
                                    </div>
                                </div>
                            </GlassCard>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

/* ── Sub-components ───────────────────────────────────────────────────── */

const StatChip: React.FC<{ icon: React.ReactNode; label: string; value: string; valueClass?: string }> = ({ icon, label, value, valueClass }) => (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/20">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">{icon}</div>
        <div className="min-w-0">
            <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-bold mt-0.5 ${valueClass || 'text-on-surface'} truncate`}>{value}</p>
        </div>
    </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; titleClass?: string }> = ({ icon, title, subtitle, titleClass }) => (
    <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">{icon}</div>
        <div>
            <h3 className={`font-bold text-sm ${titleClass || 'text-on-surface'}`}>{title}</h3>
            {subtitle && <p className="text-[11px] text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
    </div>
);

export default Settings;
