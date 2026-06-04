import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User,
    Activity, Camera, Clock,
    GraduationCap,
    Mail, Hash, Shield, ShieldCheck
} from 'lucide-react';
import Loader from '@/components/ui/Loader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSemester } from '@/contexts/SemesterContext';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import { authService } from '@/services/auth.service';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import SystemLogsSection from '@/components/settings/SystemLogsSection';
import SettingsDataSection from '@/components/settings/SettingsDataSection';
import SessionsSection from '@/components/settings/SessionsSection';





/* ── System Logs Sub-Component ─────────────────────────────────────────── */
/* ── Main Settings Component ───────────────────────────────────────────── */
type TabKey = 'profile' | 'activity' | 'data' | 'sessions';

const Settings: React.FC = () => {
    const { user, logout, setUser } = useAuth();
    const { setAccentColor } = useTheme();
    const { currentSemester, setCurrentSemester } = useSemester();
    const { showToast } = useToast();

    usePageMeta({
        title: 'Settings | Zenith',
        description: 'Manage your Zenith profile, preferences, semester settings, and account data.',
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { picture: _picture, ...profileFormData } = profileForm;
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
            showToast('info', 'Creating safety backup...');
            const backupRes = await attendanceService.createBackup();
            if (!backupRes?.backup_id) {
                showToast('error', 'Backup failed. Aborting wipe for safety.');
                return;
            }

            await attendanceService.deleteAllData(user?.email || '', backupRes.backup_id);
            showToast('success', 'Data Purged');
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) { 
            console.error(err);
            showToast('error', err.response?.data?.message || 'Purge Failed'); 
        }
    };

    const handleDeleteAccount = async () => {
        if (!user?.email) {
            showToast('error', 'Account email unavailable');
            return;
        }
        if (!confirm('Delete your account permanently? This removes access and all linked data.')) return;
        const confirmation = prompt(`Type ${user.email} to confirm permanent account deletion:`);
        if (confirmation !== user.email) return;

        try {
            await authService.deleteAccount(user.email);
            showToast('success', 'Account deleted');
            setTimeout(() => {
                window.location.href = '/login';
            }, 800);
        } catch (err: any) {
            console.error(err);
            showToast('error', err.response?.data?.error || 'Account deletion failed');
        }
    };

    const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
        { key: 'profile', label: 'Identity', icon: <User size={14} /> },
        { key: 'activity', label: 'History', icon: <Clock size={14} /> },
        { key: 'sessions', label: 'Security', icon: <ShieldCheck size={14} /> },
        { key: 'data', label: 'Storage', icon: <Shield size={14} /> },
    ];

    const inputCls = "w-full px-5 py-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 focus:ring-4 focus:ring-white/10 transition-all";

    return (
        <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} className="max-w-4xl mx-auto pb-32 pt-20 px-4">

            {/* ── Cinematic Hero ────────────────────────────────────────── */}
            <motion.section variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }} className="relative mb-8 rounded-3xl border border-white/[0.06] glass-panel p-8 md:p-12 overflow-hidden shadow-2xl" style={{ boxShadow: '0 40px 100px -20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/10/[0.04] blur-[120px] pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-12">
                    <div className="relative group">
                        <div className="w-28 h-28 md:w-32 md:h-32 rounded-[2.5rem] glass-panel border-4 border-[#050508] overflow-hidden shadow-2xl relative">
                            {user?.picture ? (
                                <img src={user.picture} alt="Profile" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                                <div className="w-full h-full bg-white/10 flex items-center justify-center text-4xl font-black text-white/40 tracking-tighter uppercase relative">
                                    <div className="absolute inset-0 bg-white/[0.02] animate-pulse" />
                                    <span className="relative z-10">{(user?.name || 'P').charAt(0)}</span>
                                </div>
                            )}
                            {isEditingProfile && (
                                <label className={`absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer transition-opacity ${isUploadingPfp ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                    {isUploadingPfp ? <Loader size={20} /> : <Camera size={24} className="text-white" />}
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
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white border-4 border-[#050508] shadow-lg shadow-white/20"><ShieldCheck size={14} /></div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">{user?.name || 'Strategic Pilot'}</h1>
                            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white uppercase tracking-widest">Authenticated</span>
                        </div>
                        <p className="text-white/30 font-medium mb-6 flex flex-wrap justify-center md:justify-start items-center gap-x-4">
                            <span className="flex items-center gap-2"><Mail size={14} /> {user?.email}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-white/10 hidden md:block" />
                            <span className="flex items-center gap-2 font-mono"><Hash size={14} /> {user?.enrollment_number || 'ST-UNK'}</span>
                        </p>
                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                            <div className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center gap-2">
                                <Activity size={14} className="text-white" />
                                <span className="text-[11px] font-bold text-white/50 tracking-tight">{dashboardStats?.attendance.toFixed(1)}% Operational</span>
                            </div>
                            <div className="px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center gap-2">
                                <GraduationCap size={14} className="text-white" />
                                <span className="text-[11px] font-bold text-white/50 tracking-tight">Sem {user?.semester || currentSemester}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* ── Navigation ────────────────────────────────────────────── */}
            <div className="flex gap-2 mb-8 p-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] overflow-x-auto no-scrollbar">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex-1 flex gap-2 items-center justify-center px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === t.key ? 'bg-white/10 text-white shadow-xl shadow-white/10' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}>{t.icon} {t.label}</button>
                ))}
            </div>

            {/* ── Content ───────────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.2 }}>

                    {/* IDENTITY TAB */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6">
                            {/* Core Identity */}
                            <div className="rounded-[2.5rem] border border-white/[0.06] glass-panel p-8" style={{ boxShadow: '0 0 40px rgba(255,255,255,0.01), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white"><User size={20} /></div>
                                        <div><h3 className="text-base font-black text-white tracking-tight">Core Protocol</h3><p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Primary Identity Details</p></div>
                                    </div>
                                    <button onClick={() => isEditingProfile ? handleProfileSave() : setIsEditingProfile(true)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isEditingProfile ? 'bg-white/10 text-white shadow-lg shadow-white/10' : 'bg-white/5 text-white/50 hover:bg-white/10'}`}>{isEditingProfile ? 'Update Station' : 'Edit Protocol'}</button>
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
                                                <span className="text-[10px] font-black text-white">{profileForm.attendance_threshold}%</span>
                                            </div>
                                            <input type="range" min="50" max="100" value={profileForm.attendance_threshold} onChange={e => setProfileForm({ ...profileForm, attendance_threshold: parseInt(e.target.value) })} disabled={!isEditingProfile} className="w-full accent-white h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer" />
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
                        <SettingsDataSection
                            onLogout={logout}
                            onDeleteAllData={handleDeleteAllData}
                            onDeleteAccount={handleDeleteAccount}
                            showToast={showToast}
                        />
                    )}

                    {/* SESSIONS TAB */}
                    {activeTab === 'sessions' && (
                        <SessionsSection showToast={showToast} />
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
};

export default Settings;
