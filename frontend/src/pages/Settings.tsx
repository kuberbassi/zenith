import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Settings as SettingsIcon, Download, Upload,
    Trash2,
    Activity, Clock, FileText, Camera,
    GraduationCap,
    Mail, Hash, Shield, ShieldAlert, History, RefreshCw, ShieldCheck
} from 'lucide-react';
import type { SystemLog } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSemester } from '@/contexts/SemesterContext';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import { authService } from '@/services/auth.service';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';





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
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };

    const getLogIcon = (action: string) => {
        const a = action.toLowerCase();
        if (a.includes('profile')) return <User size={14} className="text-blue-500" />;
        if (a.includes('attendance') || a.includes('subject')) return <Activity size={14} className="text-blue-500" />;
        if (a.includes('delete') || a.includes('reset') || a.includes('wipe')) return <Trash2 size={14} className="text-red-500" />;
        if (a.includes('setting') || a.includes('preference')) return <SettingsIcon size={14} className="text-blue-400" />;
        return <FileText size={14} className="text-white/40" />;
    };

    if (loading) return <div className="h-48 flex items-center justify-center"><RefreshCw className="animate-spin text-blue-500/40" /></div>;

    const dates = Object.keys(groupedLogs);

    return (
        <div className="space-y-6">
            {dates.length === 0 ? (
                <div className="rounded-3xl border border-white/[0.06] bg-[#0a0a0a] p-12 flex flex-col items-center justify-center text-center">
                    <History size={32} className="text-white/10 mb-4" />
                    <h3 className="text-sm font-bold text-white tracking-widest uppercase mb-1">Station Clean</h3>
                    <p className="text-xs text-white/30 max-w-xs">No activity has been logged in your terminal yet.</p>
                </div>
            ) : (
                dates.map(date => (
                    <div key={date} className="space-y-3">
                        <div className="flex items-center gap-3 px-2">
                            <div className="h-px flex-1 bg-white/[0.04]" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">{date}</h3>
                            <div className="h-px flex-1 bg-white/[0.04]" />
                        </div>
                        <div className="rounded-3xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden divide-y divide-white/[0.03]">
                            {groupedLogs[date].map((log, index) => (
                                <div key={index} className="flex gap-4 p-5 hover:bg-white/[0.01] transition-colors group">
                                    <div className="w-10 h-10 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center shrink-0 group-hover:border-blue-500/30 transition-all">{getLogIcon(log.action)}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h4 className="text-sm font-bold text-white/80 group-hover:text-white transition-colors uppercase tracking-tight">{log.action}</h4>
                                            <span className="text-[10px] font-black text-white/20">{typeof log.timestamp === 'string' ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        </div>
                                        <p className="text-xs text-white/40 font-medium leading-relaxed">{log.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

/* ── Main Settings Component ───────────────────────────────────────────── */
type TabKey = 'profile' | 'activity' | 'data';

const Settings: React.FC = () => {
    const { user, logout, setUser } = useAuth();
    const { setAccentColor } = useTheme();
    const { currentSemester, setCurrentSemester } = useSemester();
    const { showToast } = useToast();

    usePageMeta({
        title: 'Settings | AcadHub',
        description: 'Manage your AcadHub profile, preferences, semester settings, and account data.',
    });

    const [activeTab, setActiveTab] = useState<TabKey>('profile');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [isUploadingPfp, setIsUploadingPfp] = useState(false);
    const [dashboardStats, setDashboardStats] = useState<{ attendance: number; totalSubjects: number } | null>(null);



    const [name, setName] = useState(user?.name || '');
    const [profileForm, setProfileForm] = useState({
        course: '', branch: '', college: '', semester: 1, batch: '', picture: '', enrollment_number: '',
        attendance_threshold: 75, warning_threshold: 76,
        phone_number: '', headline: '', linkedin_url: '', github_url: '', portfolio_url: ''
    });

    useEffect(() => {
        if (user) {
            setProfileForm({
                course: user.course || '', branch: user.branch || '', college: user.college || '',
                semester: user.semester || user.current_semester || 1, batch: user.batch || '',
                picture: user.picture || '', enrollment_number: user.enrollment_number || '',
                attendance_threshold: user.attendance_threshold || 75,
                warning_threshold: user.warning_threshold || 76,
                phone_number: user.phone_number || '', headline: user.headline || '',
                linkedin_url: user.linkedin_url || '', github_url: user.github_url || '',
                portfolio_url: user.portfolio_url || ''
            });
            setName(user.name);
        }
    }, [user]);

    useEffect(() => { loadPreferences(); loadDashboardStats(); }, []);
    useUnsavedChanges(isEditingProfile);

    async function loadDashboardStats() {
        try {
            const data = await attendanceService.getDashboardData(currentSemester);
            setDashboardStats({ attendance: data.overall_attendance || 0, totalSubjects: data.total_subjects || 0 });
        } catch { /* ignore */ }
    }

    const loadPreferences = async () => {
        try {
            const prefs = await attendanceService.getPreferences();
            if (prefs && prefs.accent_color) setAccentColor(prefs.accent_color);
        } catch { /* ignore */ }
    };

    const handleProfileSave = async () => {
        try {
            const { picture, ...profileFormData } = profileForm;
            await attendanceService.updateProfile({ name, ...profileFormData });

            // Also sync thresholds to preferences endpoint for full consistency
            if (profileForm.attendance_threshold || profileForm.warning_threshold) {
                await attendanceService.updatePreferences({
                    attendance_threshold: profileForm.attendance_threshold,
                    warning_threshold: profileForm.warning_threshold,
                }).catch(() => { /* non-critical */ });
            }

            // Re-fetch authoritative profile from API instead of using stale local data
            try {
                const freshProfile = await attendanceService.getProfile();
                if (freshProfile && user) {
                    const updatedUser = { ...user, ...freshProfile };
                    authService.storeUser(updatedUser);
                    setUser(updatedUser);
                    setCurrentSemester(freshProfile.current_semester || freshProfile.semester || profileForm.semester);
                }
            } catch {
                // Fallback to local merge if re-fetch fails
                if (user) {
                    const updatedUser = { ...user, name, ...profileForm };
                    authService.storeUser(updatedUser); setUser(updatedUser); setCurrentSemester(profileForm.semester);
                }
            }

            setIsEditingProfile(false); showToast('success', 'Profile Updated');
        } catch { showToast('error', 'Save Failed'); }
    };



    const handleDeleteAllData = async () => {
        if (!confirm('⚠️ IRREVERSIBLE ACTION: Delete all records?')) return;
        const userInput = prompt('Type DELETE to purge everything:');
        if (userInput !== 'DELETE') return;
        try {
            await attendanceService.deleteAllData(user?.email || '');
            showToast('success', 'Data Purged');
            setTimeout(() => window.location.reload(), 1500);
        } catch { showToast('error', 'Purge Failed'); }
    };

    const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: 'profile', label: 'Identity', icon: <User size={14} /> },
        { key: 'activity', label: 'History', icon: <Clock size={14} /> },
        { key: 'data', label: 'Storage', icon: <Shield size={14} /> },
    ];

    const inputCls = "w-full px-5 py-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/40 focus:ring-4 focus:ring-blue-500/5 transition-all";

    return (
        <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} className="max-w-4xl mx-auto pb-32 pt-20 px-4">

            {/* ── Cinematic Hero ────────────────────────────────────────── */}
            <motion.section variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }} className="relative mb-8 rounded-3xl border border-white/[0.06] bg-[#050508] p-8 md:p-12 overflow-hidden shadow-2xl" style={{ boxShadow: '0 40px 100px -20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/[0.04] blur-[120px] pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                    <div className="relative group">
                        <div className="w-28 h-28 md:w-32 md:h-32 rounded-[2.5rem] bg-[#0a0a0a] border-4 border-[#050508] overflow-hidden shadow-2xl relative">
                            {user?.picture ? (
                                <img src={user.picture} alt="Profile" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center text-4xl font-black text-blue-400">{(user?.name || 'P').charAt(0)}</div>
                            )}
                            {isEditingProfile && (
                                <label className={`absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer transition-opacity ${isUploadingPfp ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    {isUploadingPfp ? <RefreshCw size={24} className="text-blue-400 animate-spin" /> : <Camera size={24} className="text-white" />}
                                    <input type="file" accept="image/*" className="hidden" disabled={isUploadingPfp} onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        const objectUrl = URL.createObjectURL(file);
                                        const backupPicture = user?.picture;

                                        // Instant preview
                                        const tempUser = { ...user!, picture: objectUrl };
                                        setUser(tempUser);
                                        setProfileForm({ ...profileForm, picture: objectUrl });
                                        setIsUploadingPfp(true);

                                        try {
                                            const fd = new FormData(); fd.append('file', file);
                                            const res = await attendanceService.uploadPfp(fd);

                                            // Commit actual URL
                                            setProfileForm(prev => ({ ...prev, picture: res.url }));
                                            const finalUser = { ...user!, picture: res.url };
                                            authService.storeUser(finalUser);
                                            setUser(finalUser);
                                            showToast('success', 'Profile Picture Updated');
                                        }
                                        catch {
                                            // Revert
                                            setUser({ ...user!, picture: backupPicture || '' });
                                            setProfileForm(prev => ({ ...prev, picture: backupPicture || '' }));
                                            showToast('error', 'Upload Error');
                                        }
                                        finally {
                                            setIsUploadingPfp(false);
                                            URL.revokeObjectURL(objectUrl);
                                        }
                                    }} />
                                </label>
                            )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center text-white border-4 border-[#050508] shadow-lg shadow-blue-500/40"><ShieldCheck size={14} /></div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{user?.name || 'Strategic Pilot'}</h1>
                            <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-widest">Authenticated</span>
                        </div>
                        <p className="text-white/30 font-medium mb-6 flex flex-wrap justify-center md:justify-start items-center gap-x-4">
                            <span className="flex items-center gap-2"><Mail size={14} /> {user?.email}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-white/10 hidden md:block" />
                            <span className="flex items-center gap-2 font-mono"><Hash size={14} /> {user?.enrollment_number || 'ST-UNK'}</span>
                        </p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            <div className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center gap-2">
                                <Activity size={14} className="text-blue-400" />
                                <span className="text-[11px] font-bold text-white/50 tracking-tight">{dashboardStats?.attendance.toFixed(1)}% Operational</span>
                            </div>
                            <div className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center gap-2">
                                <GraduationCap size={14} className="text-blue-400" />
                                <span className="text-[11px] font-bold text-white/50 tracking-tight">Sem {user?.semester || currentSemester}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* ── Navigation ────────────────────────────────────────────── */}
            <div className="flex gap-2 mb-8 p-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] overflow-x-auto no-scrollbar">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex-1 flex gap-2 items-center justify-center px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === t.key ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/20' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}>{t.icon} {t.label}</button>
                ))}
            </div>

            {/* ── Content ───────────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>

                    {/* IDENTITY TAB */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6">
                            {/* Core Identity */}
                            <div className="rounded-[2.5rem] border border-white/[0.06] bg-[#0a0a0a] p-8" style={{ boxShadow: '0 0 40px rgba(16,185,129,0.01), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400"><User size={20} /></div>
                                        <div><h3 className="text-base font-black text-white tracking-tight">Core Protocol</h3><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Primary Identity Details</p></div>
                                    </div>
                                    <button onClick={() => isEditingProfile ? handleProfileSave() : setIsEditingProfile(true)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isEditingProfile ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>{isEditingProfile ? 'Update Station' : 'Edit Protocol'}</button>
                                </div>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">Strategic Name</label><input value={name} onChange={e => setName(e.target.value)} disabled={!isEditingProfile} className={inputCls} /></div>
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">Enrollment Number</label><input value={profileForm.enrollment_number} onChange={e => setProfileForm({ ...profileForm, enrollment_number: e.target.value })} disabled={!isEditingProfile} className={inputCls} placeholder="00000000000" /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">Command Institution</label><input value={profileForm.college} onChange={e => setProfileForm({ ...profileForm, college: e.target.value })} disabled={!isEditingProfile} className={inputCls} /></div>
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">Comms Channel (Phone)</label><input value={profileForm.phone_number} onChange={e => setProfileForm({ ...profileForm, phone_number: e.target.value })} disabled={!isEditingProfile} className={inputCls} placeholder="+91 0000000000" /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">Degree (Course)</label><input value={profileForm.course} onChange={e => setProfileForm({ ...profileForm, course: e.target.value })} disabled={!isEditingProfile} className={inputCls} placeholder="e.g., B.Tech" /></div>
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">Branch</label><input value={profileForm.branch} onChange={e => setProfileForm({ ...profileForm, branch: e.target.value })} disabled={!isEditingProfile} className={inputCls} placeholder="e.g., CSE" /></div>
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">Deployment Batch</label><input value={profileForm.batch} onChange={e => setProfileForm({ ...profileForm, batch: e.target.value })} disabled={!isEditingProfile} className={inputCls} /></div>
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">Mission Semester</label><Select value={profileForm.semester} options={[1, 2, 3, 4, 5, 6, 7, 8].map(s => ({ value: s, label: `Cycle ${s}` }))} disabled={!isEditingProfile} onChange={e => setProfileForm({ ...profileForm, semester: parseInt(e.target.value) })} /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/[0.04]">
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">Profile Headline</label><input value={profileForm.headline} onChange={e => setProfileForm({ ...profileForm, headline: e.target.value })} disabled={!isEditingProfile} className={inputCls} placeholder="Strategic Pilot / Senior Analyst" /></div>
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">LinkedIn URL</label><input value={profileForm.linkedin_url} onChange={e => setProfileForm({ ...profileForm, linkedin_url: e.target.value })} disabled={!isEditingProfile} className={inputCls} placeholder="linkedin.com/in/..." /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">GitHub Profile</label><input value={profileForm.github_url} onChange={e => setProfileForm({ ...profileForm, github_url: e.target.value })} disabled={!isEditingProfile} className={inputCls} placeholder="github.com/..." /></div>
                                        <div><label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest mb-2.5 ml-1">Personal Portfolio</label><input value={profileForm.portfolio_url} onChange={e => setProfileForm({ ...profileForm, portfolio_url: e.target.value })} disabled={!isEditingProfile} className={inputCls} placeholder="https://..." /></div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/[0.04]">
                                        <div>
                                            <div className="flex justify-between mb-2.5 ml-1">
                                                <label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest">Global Target</label>
                                                <span className="text-[10px] font-black text-blue-400">{profileForm.attendance_threshold}%</span>
                                            </div>
                                            <input type="range" min="50" max="100" value={profileForm.attendance_threshold} onChange={e => setProfileForm({ ...profileForm, attendance_threshold: parseInt(e.target.value) })} disabled={!isEditingProfile} className="w-full accent-blue-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-2.5 ml-1">
                                                <label className="block text-[10px] font-bold text-white/20 uppercase tracking-widest">Warning Buffer</label>
                                                <span className="text-[10px] font-black text-red-400">{profileForm.warning_threshold}%</span>
                                            </div>
                                            <input type="range" min="50" max="100" value={profileForm.warning_threshold} onChange={e => setProfileForm({ ...profileForm, warning_threshold: parseInt(e.target.value) })} disabled={!isEditingProfile} className="w-full accent-red-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}



                    {/* ACTIVITY TAB */}
                    {activeTab === 'activity' && <SystemLogsSection />}

                    {/* STORAGE TAB */}
                    {activeTab === 'data' && (
                        <div className="space-y-4">
                            <div className="rounded-3xl border border-white/[0.06] bg-[#0a0a0a] p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400"><Shield size={20} /></div><div><h3 className="text-base font-black text-white tracking-tight">Encryption & Storage</h3><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Local Records Management</p></div></div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.04]">
                                        <div className="flex items-center gap-4 mb-6"><div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400"><Download size={18} /></div><div><h4 className="text-sm font-bold text-white tracking-tight">Backup Records</h4><p className="text-[10px] font-bold text-white/20 uppercase">Export to .JSON</p></div></div>
                                        <p className="text-xs text-white/30 mb-6 leading-relaxed">Save your entire profile, attendance logs, and settings to a secure offline file.</p>
                                        <Button variant="secondary" className="w-full justify-center rounded-2xl h-11" onClick={() => attendanceService.exportData().then(b => {
                                            const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `acadhub_config_${new Date().toISOString().split('T')[0]}.json`; a.click();
                                        })}>Extract Data</Button>
                                    </div>
                                    <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.04]">
                                        <div className="flex items-center gap-4 mb-6"><div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400"><Upload size={18} /></div><div><h4 className="text-sm font-bold text-white tracking-tight">Restore Session</h4><p className="text-[10px] font-bold text-white/20 uppercase">Load from .JSON</p></div></div>
                                        <p className="text-xs text-white/30 mb-6 leading-relaxed">Overwrite current terminal records with a previously saved backup file.</p>
                                        <label className="block w-full cursor-pointer transition-all border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 h-11 rounded-2xl flex items-center justify-center text-blue-400 text-[11px] font-black uppercase tracking-widest">
                                            Initialize Load
                                            <input type="file" className="hidden" accept=".json" onChange={async (e) => {
                                                const file = e.target.files?.[0]; if (!file) return;
                                                const txt = await file.text(); const data = JSON.parse(txt);
                                                await attendanceService.importData(data); showToast('success', 'Terminal Updated'); window.location.reload();
                                            }} />
                                        </label>
                                    </div>
                                </div>
                                <div className="mt-8 pt-8 border-t border-white/[0.03]">
                                    <div className="p-6 rounded-3xl bg-red-500/[0.02] border border-red-500/[0.06] flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="flex items-center gap-4 text-center md:text-left"><div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0"><ShieldAlert size={24} /></div><div><h4 className="text-sm font-bold text-red-500 tracking-tight">Zero Purge Protocol</h4><p className="text-[10px] font-bold text-red-500/40 uppercase tracking-widest">Permanent Data Erasure</p></div></div>
                                        <div className="flex gap-2">
                                            <button onClick={logout} className="px-5 py-2.5 rounded-xl border border-white/[0.06] text-[10px] font-black uppercase text-white hover:bg-white/5 transition-all">Detach Session</button>
                                            <button onClick={handleDeleteAllData} className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all">Wipe Terminal</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
};

export default Settings;
