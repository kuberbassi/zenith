import React, { useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShieldAlert, RefreshCw, Search, Inbox, ArrowRight
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { Link } from 'react-router-dom';
import GlassCard from '@/components/ui/GlassCard';

interface NotificationItem {
    type: string;
    title: string;
    message: string;
    priority: 'high' | 'medium' | 'low';
}

const Notifications: React.FC = () => {
    usePageMeta({
        title: 'System Notifications | Zenith',
        description: 'Stay updated with critical attendance alerts and system notifications.',
    });

    const [searchQuery, setSearchQuery] = useState('');
    const { data: alertsData, isLoading: loadingAlerts, refetch: refetchAlerts } = useNotifications();
    const alertsList = (alertsData as NotificationItem[]) || [];

    const handleRefresh = () => {
        void refetchAlerts();
    };

    const filteredAlerts = alertsList.filter(alert =>
        alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.message.toLowerCase().includes(searchQuery.toLowerCase())
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
                        <h1 className="text-2xl font-bold text-on-surface tracking-tight">System Alerts</h1>
                        <p className="text-xs text-on-surface-variant/40 mt-0.5">
                            {filteredAlerts.length} system warnings active
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        className={`p-2 rounded-xl bg-surface border border-outline hover:bg-surface-container transition-all cursor-pointer ${loadingAlerts ? 'animate-spin' : ''}`}
                        title="Refresh"
                    >
                        <RefreshCw size={16} className="text-on-surface-variant" />
                    </button>
                </div>
                <div className="mt-4 h-px bg-outline" />
            </div>

            {/* Controls Row */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-6">
                <div className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-outline rounded-xl bg-surface text-on-surface">
                    <ShieldAlert size={14} className="text-red-500" />
                    Alerts {alertsList.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold">{alertsList.length}</span>}
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 max-w-sm">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/40" />
                    <input
                        type="text"
                        placeholder="Search alerts..."
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
                        {loadingAlerts ? (
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
                                        to="/dashboard"
                                        className="p-2 rounded-xl hover:bg-surface-container transition-colors text-on-surface-variant/40 hover:text-on-surface"
                                        title="View Dashboard"
                                    >
                                        <ArrowRight size={14} />
                                    </Link>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </GlassCard>
        </div>
    );
};

export default Notifications;
