import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';
import { Bell, Info, ExternalLink, Calendar, RefreshCw, AlertCircle, ShieldCheck, Zap } from 'lucide-react';
import Loader from '@/components/ui/Loader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { attendanceService } from '@/services/attendance.service';

interface Notice {
    title: string;
    link: string;
    date: string;
}

const NOTICE_CACHE_KEY = 'zenith_cache:notices:all';

const parseNoticeDate = (raw: string) => {
    if (!raw) return 0;
    const normalized = raw.trim();
    const dmy = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
    if (dmy) {
        const day = Number(dmy[1]);
        const month = Number(dmy[2]);
        let year = Number(dmy[3]);
        if (year < 100) year += 2000;
        const value = new Date(year, month - 1, day).getTime();
        return Number.isNaN(value) ? 0 : value;
    }
    const generic = new Date(normalized).getTime();
    return Number.isNaN(generic) ? 0 : generic;
};

const formatNoticeDate = (raw: string) => {
    const ts = parseNoticeDate(raw);
    if (!ts) return 'Date unavailable';
    return new Date(ts).toLocaleDateString('en-GB');
};

const Notifications: React.FC = () => {
    const [notices, setNotices] = useState<Notice[]>(() => {
        try {
            const raw = localStorage.getItem(NOTICE_CACHE_KEY);
            const parsed = raw ? JSON.parse(raw) as { data?: Notice[] } : null;
            return parsed?.data || [];
        } catch {
            return [];
        }
    });
    const [loading, setLoading] = useState(notices.length === 0);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<boolean>(false);

    usePageMeta({
        title: 'Notices | Zenith',
        description: 'Stay updated with the latest university notices and announcements from IPU.',
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async (force = false) => {
        try {
            if (force || notices.length === 0) setLoading(true);
            else setRefreshing(true);
            setError(false);
            const data = await attendanceService.getNotices(undefined, force);
            const sorted = (data || []).slice().sort((a: Notice, b: Notice) => parseNoticeDate(b.date) - parseNoticeDate(a.date));
            setNotices(sorted);
        } catch (error) {
            console.error('Failed to load notices', error);
            setError(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    return (
        <div className="pb-32 max-w-5xl mx-auto px-4">
            {/* ── Cinematic Header ────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 relative rounded-[2.5rem] border border-white/[0.06] glass-panel p-8 md:p-12 overflow-hidden shadow-2xl"
                style={{ boxShadow: '0 0 80px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)' }}
            >
                <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-white/10/[0.02] blur-[120px] pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white border border-white/10">
                                <Bell size={24} />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase leading-none">Signal Intelligence</h1>
                        </div>
                        <p className="text-white/30 font-bold text-xs md:text-sm tracking-[0.2em] uppercase max-w-md">Real-time telemetry and notices from the institutional core.</p>
                    </div>

                    <button
                        onClick={() => loadData(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl glass-panel border border-white/[0.04] text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-white hover:border-white/10 transition-all group"
                    >
                        <RefreshCw size={16} className={refreshing || loading ? 'animate-spin' : ''} />
                        {refreshing || loading ? 'Refreshing Feed' : 'Refresh Feed'}
                    </button>
                </div>
            </motion.div>

            {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 md:p-8 mb-8 rounded-3xl border border-red-500/20 bg-red-500/5 backdrop-blur-md">
                    <div className="flex items-start gap-4">
                        <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={24} />
                        <div className="flex-1">
                            <h3 className="font-black text-white uppercase tracking-widest text-sm mb-2">Comms Disruption</h3>
                            <button onClick={() => loadData(true)} className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-300 transition-colors flex items-center gap-2">
                                <RefreshCw size={12} /> Attempt Reconnection
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {loading && notices.length === 0 ? (
                <div className="flex justify-center py-20"><LoadingSpinner /></div>
            ) : (
                <div className="space-y-4">
                    {refreshing && notices.length > 0 && (
                        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-white/[0.04] glass-panel text-[10px] font-black text-white/35 uppercase tracking-[0.2em]">
                            <Loader size={16} />
                            Updating notice cache in background
                        </div>
                    )}
                    {notices.length > 0 ? (
                        notices.map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                            >
                                <div
                                    onClick={() => window.open(item.link, '_blank')}
                                    className="group relative rounded-[2rem] border border-white/[0.04] glass-panel p-5 md:p-6 cursor-pointer hover:bg-white/[0.02] hover:border-white/[0.1] transition-all overflow-hidden shadow-lg"
                                    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
                                >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-white/10 group-hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100" />

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-start gap-5">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/20 group-hover:text-white group-hover:bg-white/5 transition-all border border-white/5">
                                                <Info size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-1.5">
                                                    <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.2em] flex items-center gap-1.5">
                                                        <ShieldCheck size={10} /> Official Release
                                                    </span>
                                                    <span className="h-1 w-1 rounded-full bg-white/10" />
                                                    <div className="flex items-center gap-1.5 text-[9px] font-black text-white/20 uppercase tracking-widest">
                                                        <Calendar size={10} />
                                                        {formatNoticeDate(item.date)}
                                                    </div>
                                                </div>
                                                <h3 className="font-bold text-sm md:text-base text-white/80 group-hover:text-white transition-colors line-clamp-2 leading-tight uppercase tracking-tight">
                                                    {item.title}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-full border border-white/5 opacity-0 group-hover:opacity-100 transition-all">
                                            <ExternalLink size={14} className="text-white" />
                                        </div>
                                    </div>

                                    {/* Ambient Background Detail */}
                                    <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-white/10/[0.02] rounded-full blur-2xl group-hover:bg-white/10/[0.05] transition-all" />
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        <div className="text-center py-24 rounded-[3rem] border border-white/[0.04] glass-panel/40 shadow-inner">
                            <Zap className="w-12 h-12 mx-auto mb-4 text-white/5" />
                            <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">No signals detected in this sector</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Notifications;
