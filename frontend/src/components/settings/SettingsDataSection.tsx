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
            anchor.download = `acadhub_config_${new Date().toISOString().split('T')[0]}.json`;
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
        showToast('success', 'Terminal Updated');
        setTimeout(() => window.location.reload(), 1000);
    };

    return (
        <div className="space-y-4">
            <div className="rounded-3xl border border-white/[0.06] glass-panel p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white tracking-tight">Encryption & Storage</h3>
                            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Local Records Management</p>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white"><Download size={18} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-white tracking-tight">Backup Records</h4>
                                <p className="text-[10px] font-bold text-white/20 uppercase">Export to .JSON</p>
                            </div>
                        </div>
                        <p className="text-xs text-white/30 mb-6 leading-relaxed">Save your entire profile, attendance logs, and settings to a secure offline file.</p>
                        <Button variant="secondary" className="w-full justify-center rounded-2xl h-11" onClick={handleExport}>Extract Data</Button>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.04]">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white"><Upload size={18} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-white tracking-tight">Restore Session</h4>
                                <p className="text-[10px] font-bold text-white/20 uppercase">Load from .JSON</p>
                            </div>
                        </div>
                        <p className="text-xs text-white/30 mb-6 leading-relaxed">Overwrite current terminal records with a previously saved backup file.</p>
                        <label className="block w-full cursor-pointer transition-all border border-white/10 bg-white/2 hover:bg-white/5 h-11 rounded-2xl flex items-center justify-center text-white text-[11px] font-black uppercase tracking-widest">
                            Initialize Load
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
                <div className="mt-8 pt-8 border-t border-white/[0.03]">
                    <div className="p-6 rounded-3xl bg-red-500/[0.02] border border-red-500/[0.06] flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4 text-center md:text-left">
                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shrink-0"><ShieldAlert size={24} /></div>
                            <div>
                                <h4 className="text-sm font-bold text-red-500 tracking-tight">Zero Purge Protocol</h4>
                                <p className="text-[10px] font-bold text-red-500/40 uppercase tracking-widest">Permanent Data Erasure</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => void onLogout()} className="px-5 py-2.5 rounded-xl border border-white/[0.06] text-[10px] font-black uppercase text-white hover:bg-white/5 transition-all">Detach Session</button>
                            <button onClick={() => void onDeleteAllData()} className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-[10px] font-black uppercase shadow-xl shadow-red-500/20 hover:bg-red-600 transition-all">Wipe Terminal</button>
                            <button onClick={() => void onDeleteAccount()} className="px-5 py-2.5 rounded-xl border border-red-500/30 text-red-300 text-[10px] font-black uppercase hover:bg-red-500/10 transition-all">Delete Account</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsDataSection;
