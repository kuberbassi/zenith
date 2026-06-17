import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell, Search, X, ChevronDown, Menu,
    LayoutDashboard, PieChart, CalendarDays, CalendarClock,
    GraduationCap, Trophy, Beaker, Settings, Target
} from 'lucide-react';
import { useSemester } from '@/contexts/SemesterContext';

interface HeaderProps {
    notificationCount?: number;
    onMenuClick?: () => void;
}

const routeTitles: Record<string, { title: string; icon: any }> = {
    '/dashboard': { title: 'Dashboard', icon: LayoutDashboard },
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
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Analytics', href: '/analytics', icon: PieChart },
    { name: 'Schedule', href: '/timetable', icon: CalendarClock },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Courses', href: '/courses', icon: GraduationCap },
    { name: 'Results', href: '/results', icon: Trophy },
    { name: 'Assignments', href: '/practicals', icon: Beaker },
    { name: 'Skills', href: '/skills', icon: Target },
    { name: 'Settings', href: '/settings', icon: Settings },
];

const Header: React.FC<HeaderProps> = ({ notificationCount = 0, onMenuClick }) => {
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
            {/* ── Sticky Top Header Bar ── */}
            <header className="sticky top-0 z-30 h-16 w-full bg-surface/85 backdrop-blur-md border-b border-outline flex items-center justify-between px-4 md:px-8">
                {/* Left section: Hamburger (mobile) + Page Title */}
                <div className="flex items-center gap-2">
                    {onMenuClick && (
                        <button
                            onClick={onMenuClick}
                            className="lg:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                            aria-label="Toggle navigation menu"
                        >
                            <Menu size={20} />
                        </button>
                    )}
                    <div className="flex items-center gap-2.5">
                        <PageIcon size={18} className="text-primary shrink-0" />
                        <span className="text-sm font-semibold text-on-surface">{currentPage.title}</span>
                    </div>
                </div>

                {/* Right section: Semester, Search, Notifications, Settings */}
                <div className="flex items-center gap-3">
                    {/* Semester Selector */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setSemDropOpen(!semDropOpen); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline hover:bg-surface-container-high transition-colors text-xs font-semibold text-on-surface-variant hover:text-on-surface whitespace-nowrap"
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
                                    className="absolute top-full mt-2 right-0 bg-surface border border-outline rounded-xl p-1.5 shadow-lg min-w-[130px] z-50"
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { setCurrentSemester(s); setSemDropOpen(false); }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${s === currentSemester
                                                ? 'bg-primary/10 text-primary font-bold'
                                                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                                                }`}
                                        >
                                            Semester {s}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="h-4 w-px bg-outline-variant" />

                    {/* Search */}
                    <button
                        onClick={() => setSearchOpen(true)}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant/70 hover:text-on-surface transition-colors"
                        title="Search (Ctrl+K)"
                    >
                        <Search size={16} />
                        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-outline px-1.5 font-mono text-[9px] font-medium text-on-surface-variant/40 bg-surface-container">Ctrl K</kbd>
                    </button>

                    <div className="h-4 w-px bg-outline-variant" />

                    {/* Notifications */}
                    <Link
                        to="/notifications"
                        className="relative flex items-center justify-center p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant/70 hover:text-on-surface"
                        title="Notifications"
                    >
                        <Bell size={16} />
                        {notificationCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-surface" />
                        )}
                    </Link>

                    {/* Settings */}
                    <Link
                        to="/settings"
                        className="flex items-center justify-center p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant/70 hover:text-on-surface"
                        title="Settings"
                    >
                        <Settings size={16} />
                    </Link>
                </div>
            </header>

            {/* ── Command Palette ───────────────────────────────────── */}
            <AnimatePresence>
                {searchOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                            onClick={() => setSearchOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            className="fixed top-24 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] md:w-full max-w-md bg-surface border border-outline rounded-xl shadow-2xl z-50 overflow-hidden text-on-surface"
                        >
                            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-outline bg-surface-container/30">
                                <Search size={18} className="text-on-surface-variant/50" />
                                <input
                                    type="text"
                                    placeholder="Search pages..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/40 outline-none text-sm font-medium"
                                    autoFocus
                                />
                                <button onClick={() => setSearchOpen(false)} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant/40 hover:text-on-surface transition-colors">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="p-2 max-h-72 overflow-y-auto custom-scrollbar">
                                {filteredNav.length === 0 ? (
                                    <p className="text-center text-on-surface-variant/30 py-8 text-sm italic">No results found...</p>
                                ) : (
                                    filteredNav.map(item => (
                                        <Link
                                            key={item.href} to={item.href}
                                            onClick={() => setSearchOpen(false)}
                                            className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors group"
                                        >
                                            <div className="p-2 rounded-lg bg-surface-container group-hover:bg-surface-container-highest transition-colors">
                                                <item.icon size={18} className="text-on-surface-variant group-hover:text-on-surface transition-colors" />
                                            </div>
                                            <span className="text-sm font-semibold">{item.name}</span>
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
