import React, { useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell, ShieldAlert, FileText, ExternalLink, RefreshCw,
    Search, Inbox, ArrowRight
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useNotices } from '@/hooks/useNotices';
import { Link } from 'react-router-dom';
import GlassCard from '@/components/ui/GlassCard';

interface Notice {
    title: string;
    link: string;
    date: string;
}

interface NotificationItem {
    type: string;
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
}

function formatNoticeDate(date: string) {
    if (!date) return 'Date unavailable';
    const parts = String(date).split('-');
    if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        }
    }
    return date;
}

const Notifications: React.FC = () => {
    usePageMeta({
        title: 'Notifications & Notices | Zenith',
        description: 'Stay updated with critical attendance alerts, system notifications, and official university notices.',
    });

    const [activeTab, setActiveTab] = useState<'alerts' | 'notices'>('alerts');
    const [searchQuery, setSearchQuery] = useState('');

    const { data: alertsData, isLoading: loadingAlerts, refetch: refetchAlerts } = useNotifications();
    const { data: noticesData, isLoading: loadingNotices, refetch: refetchNotices } = useNotices();

    const alertsList = (alertsData as NotificationItem[]) || [];
    const noticesList = (noticesData as Notice[]) || [];

    const handleRefresh = () => {
        if (activeTab === 'alerts') void refetchAlerts();
        else void refetchNotices();
    };

    const filteredAlerts = alertsList.filter(alert =>
        alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredNotices = noticesList.filter(notice =>
        notice.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-4xl mx-auto pb-24 px-4 select-none">
            {/* Page Header */}
            <div className="mb-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/40 mb-2">
                    System / Updates
                </p>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-on-surface tracking-tight">Updates &amp; Notices</h1>
                        <p className="text-xs text-on-surface-variant/40 mt-0.5">
                            {activeTab === 'alerts' 
                                ? `${filteredAlerts.length} system warnings active` 
                                : `${filteredNotices.length} official notices scraped`}
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className={`p-2 rounded-xl bg-surface border border-outline hover:bg-surface-container transition-all cursor-pointer ${(loadingAlerts || loadingNotices) ? 'animate-spin' : ''}`}
                        title="Refresh"
                    >
                        <RefreshCw size={16} className="text-on-surface-variant" />
                    </button>
                </div>
                <div className="mt-4 h-px bg-outline" />
            </div>

            {/* Controls Row */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-6">
                {/* Tabs */}
                <div className="flex border border-outline rounded-xl overflow-hidden self-start bg-surface">
                    <button
                        onClick={() => { setActiveTab('alerts'); setSearchQuery(''); }}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'alerts' 
                                ? 'bg-on-surface text-surface' 
                                : 'text-on-surface-variant/50 hover:bg-surface-container hover:text-on-surface'
                        }`}
                    >
                        <ShieldAlert size={14} />
                        Alerts {alertsList.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold">{alertsList.length}</span>}
                    </button>
                    <button
                        onClick={() => { setActiveTab('notices'); setSearchQuery(''); }}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold transition-all border-l border-outline cursor-pointer ${
                            activeTab === 'notices' 
                                ? 'bg-on-surface text-surface' 
                                : 'text-on-surface-variant/50 hover:bg-surface-container hover:text-on-surface'
                        }`}
                    >
                        <FileText size={14} />
                        University Notices {noticesList.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{noticesList.length}</span>}
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
                    <input
                        type="text"
                        placeholder={activeTab === 'alerts' ? "Search alerts..." : "Search notices..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs font-medium bg-surface border border-outline rounded-xl focus:outline-none focus:border-on-surface transition-all text-on-surface placeholder-on-surface-variant/30"
                    />
                </div>
            </div>

            {/* List Content */}
            <GlassCard className="!bg-surface overflow-hidden">
                <div className="p-1 divide-y divide-outline">
                    <AnimatePresence mode="wait">
                        {activeTab === 'alerts' ? (
                            loadingAlerts ? (
                                <div className="p-8 space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 rounded-xl bg-surface-container/50 animate-pulse" />
                                    ))}
                                </div>
                            ) : filteredAlerts.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center justify-center text-on-surface-variant/40">
                                    <Inbox size={32} className="mb-3 opacity-30" />
                                    <p className="text-xs font-bold uppercase tracking-wider">No active warnings</p>
                                    <p className="text-[11px] font-medium text-on-surface-variant/30 mt-1">All subject attendance percentages look great!</p>
                                </div>
                            ) : (
                                filteredAlerts.map((alert, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="p-5 flex items-start gap-4 hover:bg-surface-container/10 transition-colors"
                                    >
                                        <div className={`p-2 rounded-xl shrink-0 ${
                                            alert.priority === 'high' 
                                                ? 'bg-red-500/10 text-red-500' 
                                                : 'bg-amber-500/10 text-amber-500'
                                        }`}>
                                            <ShieldAlert size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold text-on-surface">{alert.title}</h4>
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                                                    alert.priority === 'high' 
                                                        ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                                                        : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                                                }`}>
                                                    {alert.priority}
                                                </span>
                                            </div>
                                            <p className="text-xs text-on-surface-variant/70 mt-1 leading-relaxed">{alert.message}</p>
                                        </div>
                                        <Link
                                            to="/"
                                            className="p-2 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant/40 hover:text-on-surface"
                                            title="View Dashboard"
                                        >
                                            <ArrowRight size={14} />
                                        </Link>
                                    </motion.div>
                                ))
                            )
                        ) : (
                            loadingNotices ? (
                                <div className="p-8 space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 rounded-xl bg-surface-container/50 animate-pulse" />
                                    ))}
                                </div>
                            ) : filteredNotices.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center justify-center text-on-surface-variant/40">
                                    <Inbox size={32} className="mb-3 opacity-30" />
                                    <p className="text-xs font-bold uppercase tracking-wider">No notices found</p>
                                </div>
                            ) : (
                                filteredNotices.map((notice, i) => (
                                    <motion.a
                                        key={i}
                                        href={notice.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="p-5 flex items-start gap-4 hover:bg-surface-container/20 transition-all group relative overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                                            <Bell size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] uppercase tracking-wider font-extrabold text-on-surface-variant/50">
                                                    {formatNoticeDate(notice.date)}
                                                </span>
                                            </div>
                                            <p className="text-xs font-semibold text-on-surface mt-1 leading-snug group-hover:text-primary transition-colors">
                                                {notice.title}
                                            </p>
                                        </div>
                                        <div className="p-2 rounded-xl text-primary shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                                            <ExternalLink size={14} />
                                        </div>
                                    </motion.a>
                                ))
                            )
                        )}
                    </AnimatePresence>
                </div>
            </GlassCard>
        </div>
    );
};

export default Notifications;
