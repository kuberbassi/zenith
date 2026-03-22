import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, ExternalLink, RefreshCw } from 'lucide-react';
import GlassCard from '@/components/ui/GlassCard';
import { useNotices } from '@/hooks/useNotices';

interface Notice {
    title: string;
    link: string;
    date: string;
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

const NoticesWidget: React.FC = () => {
    const { data: noticesData, isLoading: loading, refetch } = useNotices();
    const notices = (noticesData as Notice[]) || [];
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <GlassCard className="h-full flex flex-col p-6 !bg-surface">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Bell size={18} />
                        </div>
                        <h3 className="font-bold text-on-surface">University Notices</h3>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="text-xs font-medium px-2 py-1 rounded-md bg-surface-container hover:bg-surface-container-high transition-colors text-primary"
                        >
                            View All
                        </button>
                        <button
                            onClick={() => refetch()}
                            className={`p-2 rounded-full hover:bg-surface-container ${loading ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw size={16} className="text-on-surface-variant" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                    {loading && notices.length === 0 ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-20 rounded-2xl bg-surface-container/50 animate-pulse" />
                            ))}
                        </div>
                    ) : notices.length > 0 ? (
                        notices.slice(0, 3).map((notice, i) => (
                            <motion.a
                                key={i}
                                href={notice.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="block p-4 rounded-2xl bg-surface-container-low/50 hover:bg-surface-container hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border border-outline-variant/10 hover:border-outline-variant/30 group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="relative z-10">
                                    <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                                        <p className="text-sm font-medium text-on-surface line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                                            {notice.title}
                                        </p>
                                        <ExternalLink size={14} className="text-primary mt-0.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                    </div>
                                    <div className="flex items-center gap-2 mt-3">
                                        <div className="h-1 w-1 rounded-full bg-primary/50" />
                                        <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/70">
                                            {formatNoticeDate(notice.date)}
                                        </p>
                                    </div>
                                </div>
                            </motion.a>
                        ))
                    ) : (
                        <div className="text-center py-12 flex flex-col items-center justify-center text-on-surface-variant/50">
                            <Bell size={24} className="mb-2 opacity-50" />
                            <p className="text-sm">No new notices</p>
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* View All Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-surface w-full max-w-2xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-outline-variant/20"
                    >
                        <div className="p-6 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-low">
                            <div>
                                <h2 className="text-2xl font-bold font-display text-on-surface">University Notices</h2>
                                <p className="text-on-surface-variant text-sm">All latest updates from IPU</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 hover:bg-surface-container rounded-full transition-colors"
                            >
                                <span className="sr-only">Close</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                            {notices.map((notice, i) => (
                                <a
                                    key={i}
                                    href={notice.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-4 rounded-xl bg-surface-container/30 hover:bg-surface-container transition-colors border border-outline-variant/20 group"
                                >
                                    <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                                        <p className="text-sm font-medium text-on-surface font-sans group-hover:text-primary transition-colors">
                                            {notice.title}
                                        </p>
                                        <ExternalLink size={16} className="text-on-surface-variant mt-1 opacity-50 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                                            {formatNoticeDate(notice.date)}
                                        </span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </>
    );
};

export default NoticesWidget;
