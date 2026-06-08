import React, { useState, useEffect } from 'react';
import { Download, Shield, ShieldAlert, Upload, Copy, Check, Cloud, RefreshCw, Unlink } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { attendanceService } from '@/services/attendance.service';

type SettingsDataSectionProps = {
    onLogout: () => void | Promise<void>;
    onDeleteAllData: () => void | Promise<void>;
    onDeleteAccount: () => void | Promise<void>;
    showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
};

const SettingsDataSection: React.FC<SettingsDataSectionProps> = ({ onLogout, onDeleteAllData, onDeleteAccount, showToast }) => {
    const [migrationKey, setMigrationKey] = useState('');
    const [copied, setCopied] = useState(false);
    const [inputKey, setInputKey] = useState('');
    const [migrating, setMigrating] = useState(false);

    // Google Drive Sync states
    const [driveStatus, setDriveStatus] = useState<any>(null);
    const [driveBackups, setDriveBackups] = useState<any[]>([]);
    const [driveLoading, setDriveLoading] = useState(false);

    const fetchDriveStatus = async () => {
        try {
            const status = await attendanceService.getDriveStatus();
            setDriveStatus(status);
            if (status.google_drive_linked) {
                const backupsRes = await attendanceService.listDriveBackups();
                setDriveBackups(backupsRes.backups || []);
            }
        } catch (err) {
            console.error('Failed to fetch Google Drive status:', err);
        }
    };

    useEffect(() => {
        fetchDriveStatus();
    }, []);

    const linkDrive = useGoogleLogin({
        flow: 'auth-code',
        scope: 'openid email profile https://www.googleapis.com/auth/drive.appdata',
        select_account: true,
        onSuccess: async (codeResponse) => {
            try {
                setDriveLoading(true);
                await attendanceService.linkGoogleDrive(codeResponse.code);
                showToast('success', 'Google Drive linked successfully!');
                await fetchDriveStatus();
            } catch (err: any) {
                console.error(err);
                showToast('error', err?.response?.data?.error || err?.message || 'Failed to link Google Drive');
            } finally {
                setDriveLoading(false);
            }
        },
        onError: () => {
            showToast('error', 'Google Drive authorization failed');
        }
    });

    const handleDriveBackup = async () => {
        try {
            setDriveLoading(true);
            await attendanceService.performDriveBackup();
            showToast('success', 'Backup saved to Google Drive!');
            await fetchDriveStatus();
        } catch (err: any) {
            showToast('error', err.message || 'Drive backup failed');
        } finally {
            setDriveLoading(false);
        }
    };

    const handleDriveRestore = async (fileId: string) => {
        if (!confirm('Warning: Restoring from backup will overwrite all current attendance logs, subjects, and timetables. Are you sure you want to proceed?')) {
            return;
        }
        try {
            setDriveLoading(true);
            await attendanceService.restoreDriveBackup(fileId);
            showToast('success', 'Backup restored successfully!');
            window.location.reload();
        } catch (err: any) {
            showToast('error', err.message || 'Drive restore failed');
        } finally {
            setDriveLoading(false);
        }
    };

    const handleDriveDownload = async (fileId: string, createdAt: string) => {
        try {
            setDriveLoading(true);
            const blob = await attendanceService.downloadDriveBackup(fileId);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            const dateStr = new Date(createdAt).toISOString().split('T')[0];
            anchor.download = `zenith_cloud_backup_${dateStr}_${fileId}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            showToast('success', 'Cloud backup downloaded successfully!');
        } catch (err: any) {
            showToast('error', err.message || 'Drive download failed');
        } finally {
            setDriveLoading(false);
        }
    };

    const handleUpdateFrequency = async (freq: string) => {
        try {
            setDriveLoading(true);
            await attendanceService.updateDriveSettings(freq);
            showToast('success', `Backup frequency set to ${freq}`);
            await fetchDriveStatus();
        } catch (err: any) {
            showToast('error', 'Failed to update frequency');
        } finally {
            setDriveLoading(false);
        }
    };

    const handleDisconnectDrive = async () => {
        if (!confirm('Are you sure you want to disconnect Google Drive? Auto-backups will be disabled.')) {
            return;
        }
        try {
            setDriveLoading(true);
            await attendanceService.disconnectDrive();
            showToast('success', 'Google Drive disconnected');
            setDriveStatus(null);
            setDriveBackups([]);
        } catch (err: any) {
            showToast('error', 'Failed to disconnect');
        } finally {
            setDriveLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const blob = await attendanceService.exportData();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `zenith_config_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        } catch {
            showToast('error', 'Export failed');
        }
    };

    const handleImportFile = async (file: File) => {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!confirm('⚠️ WARNING: Importing this backup will automatically WIPE all your current attendance, subjects, and results, replacing them with the backup data. A safety rollback backup will be created automatically. Do you want to proceed?')) return;

        showToast('info', 'Importing data...');
        await attendanceService.importData(data);
        showToast('success', 'Data Imported');
        setTimeout(() => window.location.reload(), 1000);
    };

    const handleGenerateKey = async () => {
        try {
            showToast('info', 'Generating migration key...');
            const res = await attendanceService.initiateMigration();
            setMigrationKey(res.key);
            showToast('success', 'Migration key generated! Copy it and use it on your destination account.');
        } catch (err: any) {
            showToast('error', err.response?.data?.error || 'Failed to generate key');
        }
    };

    const handleCopyKey = () => {
        if (!migrationKey) return;
        navigator.clipboard.writeText(migrationKey);
        setCopied(true);
        showToast('success', 'Key copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCompleteMigration = async () => {
        if (!inputKey.trim()) {
            showToast('error', 'Please enter a migration key');
            return;
        }
        if (!confirm('⚠️ CRITICAL WARNING: Complete migration? All current subjects, attendance logs, and results on this account will be permanently overwritten by the migrated data.')) {
            return;
        }
        setMigrating(true);
        try {
            showToast('info', 'Migrating account records...');
            await attendanceService.completeMigration(inputKey);
            showToast('success', 'Migration completed successfully! Reloading...');
            setTimeout(() => window.location.reload(), 1500);
        } catch (err: any) {
            showToast('error', err.response?.data?.error || 'Migration failed');
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="rounded-3xl border border-outline glass-panel p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-on-surface tracking-tight">Data & Storage</h3>
                            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Backup & Restore Management</p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 rounded-3xl bg-surface-container border border-outline-variant">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface"><Download size={18} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-on-surface tracking-tight">Backup Data</h4>
                                <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase">Export to .JSON</p>
                            </div>
                        </div>
                        <p className="text-xs text-on-surface-variant/70 mb-6 leading-relaxed">Save your entire profile, attendance logs, and settings to a secure offline file.</p>
                        <Button variant="secondary" className="w-full justify-center rounded-2xl h-11" onClick={handleExport}>Export Backup</Button>
                    </div>
                    <div className="p-6 rounded-3xl bg-surface-container border border-outline-variant">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface"><Upload size={18} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-on-surface tracking-tight">Restore Data</h4>
                                <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase">Load from .JSON</p>
                            </div>
                        </div>
                        <p className="text-xs text-on-surface-variant/70 mb-6 leading-relaxed">Overwrite current settings with a previously saved backup file.</p>
                        <label className="block w-full cursor-pointer transition-all border border-outline bg-surface hover:bg-surface-container h-11 rounded-2xl flex items-center justify-center text-on-surface text-[11px] font-bold uppercase tracking-wider">
                            Import Backup
                            <input
                                type="file"
                                className="hidden"
                                accept=".json"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                        await handleImportFile(file);
                                    } catch (err: any) {
                                        console.error('Import Error:', err);
                                        showToast('error', 'Import failed: ' + (err.message || 'Invalid JSON'));
                                    } finally {
                                        e.target.value = '';
                                    }
                                }}
                            />
                        </label>
                    </div>
                </div>

                {/* Cloud Sync & Migration */}
                <div className="mt-8 pt-8 border-t border-outline-variant">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-2xl bg-surface-container flex items-center justify-center text-on-surface">
                            <Cloud size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-on-surface tracking-tight">Cloud Sync & Backup</h3>
                            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Preserve & Port Academic Records</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Google Drive Sync & Backup */}
                        <div className="p-6 rounded-3xl bg-surface-container border border-outline-variant space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-on-surface tracking-tight">Google Drive Backup</h4>
                                {driveStatus?.google_drive_linked && (
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-bold uppercase tracking-wider">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        Linked
                                    </span>
                                )}
                            </div>
                            
                            {!driveStatus?.google_drive_linked ? (
                                <div className="space-y-4">
                                    <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                                        Securely back up all your academic data to your private Google Drive AppData folder. Backups are automatic and isolated.
                                    </p>
                                    <button
                                        disabled={driveLoading}
                                        onClick={() => linkDrive()}
                                        className="w-full h-11 rounded-2xl bg-on-surface text-surface hover:bg-on-surface/90 text-[11px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        <Cloud size={14} /> Connect Google Drive
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-on-surface-variant/40 mb-1.5">Frequency</p>
                                            <Select
                                                value={driveStatus.google_drive_backup_frequency}
                                                onChange={(e) => handleUpdateFrequency(e.target.value)}
                                                options={[
                                                    { value: 'daily', label: 'Daily' },
                                                    { value: 'weekly', label: 'Weekly' },
                                                    { value: 'monthly', label: 'Monthly' },
                                                    { value: 'never', label: 'Never (Manual)' }
                                                ]}
                                                className="!py-1.5 !px-3 !rounded-xl !text-xs !h-9"
                                                fullWidth={true}
                                            />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase text-on-surface-variant/40 mb-1">Last Sync</p>
                                            <p className="text-xs font-bold text-on-surface py-1.5 truncate">
                                                {driveStatus.google_drive_last_backup 
                                                    ? new Date(driveStatus.google_drive_last_backup).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                                                    : 'Never'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            disabled={driveLoading}
                                            onClick={handleDriveBackup}
                                            className="flex-1 h-10 rounded-xl bg-on-surface text-surface hover:bg-on-surface/90 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 animate-fade-in"
                                        >
                                            <RefreshCw size={13} className={driveLoading ? 'animate-spin' : ''} /> Backup Now
                                        </button>
                                        <button
                                            disabled={driveLoading}
                                            onClick={handleDisconnectDrive}
                                            className="px-3 h-10 rounded-xl border border-outline hover:border-red-500/30 hover:bg-red-500/5 text-on-surface-variant/60 hover:text-red-500 transition-all flex items-center justify-center cursor-pointer"
                                            title="Disconnect Drive"
                                        >
                                            <Unlink size={14} />
                                        </button>
                                    </div>

                                    {/* Backups List */}
                                    {driveBackups.length > 0 && (
                                        <div className="border-t border-outline-variant pt-3 space-y-2">
                                            <p className="text-[9px] font-bold uppercase text-on-surface-variant/40 tracking-wider">Available Cloud Backups</p>
                                            <div className="max-h-[100px] overflow-y-auto space-y-1.5 pr-1 text-xs select-none">
                                                {driveBackups.map((b) => (
                                                    <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-surface-container-high border border-outline-variant">
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-[10px] text-on-surface truncate">
                                                                {new Date(b.created_at).toLocaleDateString()} at {new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                            <p className="text-[9px] text-on-surface-variant/50">{(b.size / 1024).toFixed(1)} KB</p>
                                                        </div>
                                                        <div className="flex gap-1.5">
                                                            <button
                                                                disabled={driveLoading}
                                                                onClick={() => handleDriveDownload(b.id, b.created_at)}
                                                                className="px-2 py-1 text-[9px] font-extrabold uppercase border border-outline hover:bg-surface-container rounded transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1 text-on-surface"
                                                                title="Download Backup JSON"
                                                            >
                                                                <Download size={10} />
                                                                Download
                                                            </button>
                                                            <button
                                                                disabled={driveLoading}
                                                                onClick={() => handleDriveRestore(b.id)}
                                                                className="px-2 py-1 text-[9px] font-extrabold uppercase bg-on-surface text-surface hover:opacity-90 rounded transition-all cursor-pointer disabled:opacity-50"
                                                            >
                                                                Restore
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Migration tools */}
                        <div className="p-6 rounded-3xl bg-surface-container border border-outline-variant space-y-4">
                            <h4 className="text-sm font-bold text-on-surface tracking-tight">Migrate Account Data</h4>
                            <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                                Move all your academic history to a new Google login account seamlessly.
                            </p>

                            <div className="space-y-3">
                                {/* Generate Key */}
                                <div className="flex flex-col gap-2">
                                    {migrationKey ? (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={migrationKey}
                                                className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-outline bg-surface text-on-surface focus:outline-none"
                                            />
                                            <button
                                                onClick={handleCopyKey}
                                                className="px-3 py-2 rounded-lg border border-outline bg-surface text-on-surface hover:bg-surface-container transition-all"
                                            >
                                                {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleGenerateKey}
                                            className="w-full h-10 rounded-xl border border-outline bg-surface hover:bg-surface-container text-xs font-bold uppercase tracking-wider text-on-surface transition-all"
                                        >
                                            Generate Migration Key
                                        </button>
                                    )}
                                </div>

                                {/* Apply Key */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="Paste migration key here..."
                                            value={inputKey}
                                            onChange={(e) => setInputKey(e.target.value)}
                                            className="flex-1 px-3 py-2 text-xs rounded-lg border border-outline bg-surface text-on-surface focus:outline-none"
                                        />
                                        <button
                                            disabled={migrating}
                                            onClick={handleCompleteMigration}
                                            className="px-4 py-2 rounded-xl bg-on-surface text-surface hover:bg-on-surface/90 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                                        >
                                            Migrate
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-outline-variant">
                    <div className="p-6 rounded-3xl bg-red-500/[0.02] border border-red-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4 text-center md:text-left">
                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0"><ShieldAlert size={24} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-red-500 tracking-tight">Delete All Data</h4>
                                <p className="text-[10px] font-bold text-red-500/60 uppercase tracking-widest">Permanent Data Erasure</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <button onClick={() => void onLogout()} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-outline text-[10px] font-bold uppercase text-on-surface hover:bg-surface-container transition-all text-center animate-fade-in">Sign Out</button>
                            <button onClick={() => void onDeleteAllData()} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-500 text-white text-[10px] font-bold uppercase shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all text-center">Clear All Data</button>
                            <button onClick={() => void onDeleteAccount()} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-red-500/30 text-red-500 dark:text-red-400 text-[10px] font-bold uppercase hover:bg-red-500/10 transition-all text-center">Delete Account</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsDataSection;
