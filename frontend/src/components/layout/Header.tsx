import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell, Search, X, ChevronDown,
    LayoutDashboard, PieChart, CalendarDays, CalendarClock,
    GraduationCap, Trophy, Beaker, Settings, Target
} from 'lucide-react';
import { useSemester } from '@/contexts/SemesterContext';

interface HeaderProps {
    notificationCount?: number;
}

const routeTitles: Record<string, { title: string; icon: any }> = {
    '/': { title: 'Dashboard', icon: LayoutDashboard },
    '/analytics': { title: 'Analytics', icon: PieChart },
    '/timetable': { title: 'Schedule', icon: CalendarClock },
    '/calendar': { title: 'Calendar', icon: CalendarDays },
    '/courses': { title: 'Courses', icon: GraduationCap },
    '/results': { title: 'Results', icon: Trophy },
    '/practicals': { title: 'Assignments', icon: Beaker },
    '/skills': { title: 'Skills', icon: Target },
    '/settings': { title: 'Settings', icon: Settings },
    '/notifications': { title: 'Notifications', icon: Bell },
};

const quickNavItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Analytics', href: '/analytics', icon: PieChart },
    { name: 'Schedule', href: '/timetable', icon: CalendarClock },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Courses', href: '/courses', icon: GraduationCap },
    { name: 'Results', href: '/results', icon: Trophy },
    { name: 'Assignments', href: '/practicals', icon: Beaker },
    { name: 'Skills', href: '/skills', icon: Target },
    { name: 'Settings', href: '/settings', icon: Settings },
];

const Header: React.FC<HeaderProps> = ({ notificationCount = 0 }) => {
    const location = useLocation();
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [semDropOpen, setSemDropOpen] = useState(false);
    const { currentSemester, setCurrentSemester } = useSemester();

    const currentPage = routeTitles[location.pathname] || { title: 'Page', icon: LayoutDashboard };
    const PageIcon = currentPage.icon;

    const filteredNav = quickNavItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    useEffect(() => { setSearchOpen(false); setSearchQuery(''); }, [location.pathname]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
            if (e.key === 'Escape') { setSearchOpen(false); setSemDropOpen(false); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close semester dropdown on outside click
    useEffect(() => {
        if (!semDropOpen) return;
        const close = () => setSemDropOpen(false);
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [semDropOpen]);

    return (
        <>
            {/* ── Floating Pill Header — fixed to viewport (all screen sizes) ── */}
            <div className="flex fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-24px)]">
                <div className="flex items-center h-11 md:h-14 px-2 md:px-3 rounded-full bg-[#111]/90 backdrop-blur-2xl border border-white/[0.1]" style={{ boxShadow: '0 0 30px rgba(255,255,255,0.03), 0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                    {/* Page icon + title */}
                    <div className="flex items-center gap-1.5 md:gap-3 px-2 md:px-4">
                        <PageIcon size={16} className="text-white/40 shrink-0" />
                        <span className="text-[13px] md:text-[15px] font-medium text-white/70 truncate max-w-[62px] sm:max-w-[90px] md:max-w-none">{currentPage.title}</span>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-6 md:h-8 bg-white/[0.08]" />

                    {/* Semester Selector */}
                    <div className="relative px-0.5 md:px-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setSemDropOpen(!semDropOpen); }}
                            className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 rounded-full hover:bg-white/[0.06] transition-colors text-xs md:text-sm font-medium text-white/50 hover:text-white/70 whitespace-nowrap"
                        >
                            Sem {currentSemester}
                            <ChevronDown size={12} className={`transition-transform ${semDropOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                            {semDropOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-[#111] border border-white/[0.08] rounded-2xl p-1.5 shadow-xl shadow-black/50 min-w-[130px]"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { setCurrentSemester(s); setSemDropOpen(false); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${s === currentSemester
                                                ? 'bg-blue-500/15 text-blue-400'
                                                : 'text-white/50 hover:bg-white/[0.05] hover:text-white/70'
                                                }`}
                                        >
                                            Semester {s}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Divider */}
                    <div className="w-px h-6 md:h-8 bg-white/[0.08]" />

                    {/* Search */}
                    <button
                        onClick={() => setSearchOpen(true)}
                        className="flex items-center gap-2 md:gap-3 px-2 md:px-4 py-1.5 md:py-2 rounded-full hover:bg-white/[0.06] transition-colors"
                    >
                        <Search size={15} className="text-white/35" />
                        <span className="hidden md:block text-xs text-white/20">⌘K</span>
                    </button>

                    {/* Divider */}
                    <div className="w-px h-6 md:h-8 bg-white/[0.08]" />

                    {/* Notifications */}
                    <div className="px-1 md:px-2 flex items-center gap-0.5 md:gap-2">
                        <Link
                            to="/notifications"
                            className="relative flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full hover:bg-white/[0.06] transition-colors text-white/35 hover:text-white/60"
                        >
                            <Bell size={16} />
                            {notificationCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full" />
                            )}
                        </Link>

                        {/* Settings */}
                        <Link
                            to="/settings"
                            className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full hover:bg-white/[0.06] transition-colors text-white/35 hover:text-white/60 mr-0.5 md:mr-1"
                        >
                            <Settings size={16} />
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── Command Palette ───────────────────────────────────── */}
            <AnimatePresence>
                {searchOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                            onClick={() => setSearchOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0a0a0a] rounded-[2rem] border border-white/[0.06] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)] z-50 overflow-hidden"
                        >
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
                                <Search size={18} className="text-blue-500/50" />
                                <input
                                    type="text"
                                    placeholder="Search pages..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent text-white placeholder:text-white/30 outline-none text-sm font-medium"
                                    autoFocus
                                />
                                <button onClick={() => setSearchOpen(false)} className="p-1.5 rounded-xl hover:bg-white/[0.06] text-white/30 hover:text-white/70 transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-2 max-h-72 overflow-y-auto custom-scrollbar">
                                {filteredNav.length === 0 ? (
                                    <p className="text-center text-white/20 py-8 text-sm italic">No results found...</p>
                                ) : (
                                    filteredNav.map(item => (
                                        <Link
                                            key={item.href} to={item.href}
                                            onClick={() => setSearchOpen(false)}
                                            className="flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-white/[0.04] text-white/50 hover:text-white transition-colors group"
                                        >
                                            <div className="p-2 rounded-xl bg-white/[0.02] group-hover:bg-blue-500/10 transition-colors">
                                                <item.icon size={18} className="text-white/40 group-hover:text-blue-400 transition-colors" />
                                            </div>
                                            <span className="text-sm font-bold tracking-wide">{item.name}</span>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

export default Header;
