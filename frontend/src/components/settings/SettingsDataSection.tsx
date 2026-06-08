import React from 'react';
import { Download, Shield, ShieldAlert, Upload } from 'lucide-react';
import Button from '@/components/ui/Button';
import { attendanceService } from '@/services/attendance.service';

type SettingsDataSectionProps = {
    onLogout: () => void | Promise<void>;
    onDeleteAllData: () => void | Promise<void>;
    onDeleteAccount: () => void | Promise<void>;
    showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
};

const SettingsDataSection: React.FC<SettingsDataSectionProps> = ({ onLogout, onDeleteAllData, onDeleteAccount, showToast }) => {
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
        if (!confirm('Are you sure you want to import this data? Current data will be merged/overwritten and a safety backup will be created.')) return;

        showToast('info', 'Importing data...');
        await attendanceService.importData(data);
        showToast('success', 'Data Imported');
        setTimeout(() => window.location.reload(), 1000);
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
                            <button onClick={() => void onLogout()} className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-outline text-[10px] font-bold uppercase text-on-surface hover:bg-surface-container transition-all text-center">Sign Out</button>
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
