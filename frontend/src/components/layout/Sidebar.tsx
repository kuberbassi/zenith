import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, PieChart, GraduationCap, Trophy, Beaker,
    Target, CalendarClock, CalendarDays, Settings, LogOut,
    Sun, Moon, Search, X, StickyNote
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSemester } from '@/contexts/SemesterContext';

interface SidebarProps {
    notificationCount?: number;
}

const quickNavItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Notes', href: '/notes', icon: StickyNote },
    { name: 'Analytics', href: '/analytics', icon: PieChart },
    { name: 'Schedule', href: '/timetable', icon: CalendarClock },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
    { name: 'Courses', href: '/courses', icon: GraduationCap },
    { name: 'Results', href: '/results', icon: Trophy },
    { name: 'Assignments', href: '/practicals', icon: Beaker },
    { name: 'Skills', href: '/skills', icon: Target },
    { name: 'Settings', href: '/settings', icon: Settings },
];

const Sidebar: React.FC<SidebarProps> = ({ notificationCount: _notificationCount = 0 }) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { currentSemester, setCurrentSemester } = useSemester();
    const location = useLocation();

    const [pfpMenuOpen, setPfpMenuOpen] = useState(false);
    const [semDropOpen, setSemDropOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [imgError, setImgError] = useState(false);

    const pfpRef = useRef<HTMLDivElement>(null);
    const semRef = useRef<HTMLDivElement>(null);

    const userAvatar = !imgError && user?.picture
        ? user.picture
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=000&color=fff&size=64`;

    const filteredNav = quickNavItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Close menus on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (pfpRef.current && !pfpRef.current.contains(t)) setPfpMenuOpen(false);
            if (semRef.current && !semRef.current.contains(t)) setSemDropOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Listen for search shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
            if (e.key === 'Escape') { setSearchOpen(false); setSemDropOpen(false); setPfpMenuOpen(false); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => { setSearchOpen(false); setSearchQuery(''); }, [location.pathname]);

    return (
        <>
            {/* ── Fixed Left Sidebar (Desktop only) ── */}
            <aside className="fixed left-0 top-0 bottom-0 w-64 bg-surface border-r border-outline flex flex-col justify-between z-40 hidden lg:flex select-none">
                
                {/* Top Section */}
                <div className="flex flex-col flex-1 min-h-0">
                    
                    {/* Brand / Semester Picker */}
                    <div ref={semRef} className="relative border-b border-outline/50 px-4 py-3.5 flex items-center justify-between hover:bg-surface-container/20 transition-colors cursor-pointer" onClick={() => setSemDropOpen(!semDropOpen)}>
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-[28px] h-[28px] rounded-md border border-outline flex items-center justify-center shrink-0 overflow-hidden bg-surface-variant">
                                <img src="/zenith-logo.png" alt="Zenith" className="w-[18px] h-[18px] object-contain invert dark:invert-0" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-on-surface truncate leading-none">Zenith</p>
                                <span className="text-[9px] font-semibold text-on-surface-variant/40 uppercase tracking-wider mt-1 block">Semester {currentSemester}</span>
                            </div>
                        </div>
                        <div className="text-on-surface-variant/30 shrink-0 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[14px] leading-none">unfold_more</span>
                        </div>
                        
                        {/* Semester Selection Dropdown */}
                        <AnimatePresence>
                            {semDropOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.1 }}
                                    className="absolute left-4 top-12 w-[calc(100%-32px)] bg-surface border border-outline/50 rounded-md p-1 shadow-lg z-50 text-on-surface"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <p className="text-[8px] font-bold uppercase tracking-wider text-on-surface-variant/30 px-2 py-1.5 border-b border-outline-variant/30 mb-1">Select Semester</p>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { setCurrentSemester(s); setSemDropOpen(false); }}
                                            className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer flex justify-between items-center ${s === currentSemester
                                                ? 'bg-primary text-on-primary font-bold'
                                                : 'text-on-surface-variant hover:bg-surface-container'
                                                }`}
                                        >
                                            <span>Semester {s}</span>
                                            {s === currentSemester && <span className="material-symbols-outlined text-xs leading-none">check</span>}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Search Bar Action Box */}
                    <div className="px-4 py-3">
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="w-full flex items-center justify-between px-3 py-1.5 bg-surface border border-outline hover:border-on-surface/20 rounded-md text-left text-xs font-semibold text-on-surface-variant/50 transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <Search size={13} className="text-on-surface-variant/40" />
                                <span className="text-on-surface-variant/60 font-medium">Search pages...</span>
                            </div>
                            <kbd className="h-4.5 px-1 flex items-center justify-center bg-surface-container border border-outline/65 text-[9px] font-semibold font-mono rounded opacity-50">Ctrl+K</kbd>
                        </button>
                    </div>

                    {/* Navigation Scroll Area */}
                    <div className="flex-1 overflow-y-auto px-2 space-y-6 py-2 custom-scrollbar">
                        
                        {/* Group: Overview */}
                        <div>
                            <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest px-3 mb-2">Overview</p>
                            <div className="space-y-0.5">
                                {[
                                    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
                                    { name: 'Notes & Todos', href: '/notes', icon: StickyNote },
                                    { name: 'Analytics', href: '/analytics', icon: PieChart },
                                    { name: 'Schedule', href: '/timetable', icon: CalendarClock },
                                    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
                                ].map(item => {
                                    const isActive = location.pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name} to={item.href}
                                            className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md border border-transparent transition-all ${
                                                isActive
                                                    ? 'bg-primary/5 text-on-surface border-outline/20 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.01)]'
                                                    : 'text-on-surface-variant/70 hover:bg-surface-container/20 hover:text-on-surface'
                                            }`}
                                        >
                                            <item.icon size={13} className={isActive ? 'text-on-surface' : 'text-on-surface-variant/50'} />
                                            <span>{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Group: Academics */}
                        <div>
                            <p className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-widest px-3 mb-2">Academics</p>
                            <div className="space-y-0.5">
                                {[
                                    { name: 'Courses', href: '/courses', icon: GraduationCap },
                                    { name: 'Assignments', href: '/practicals', icon: Beaker },
                                    { name: 'Results', href: '/results', icon: Trophy },
                                    { name: 'Skill Tracker', href: '/skills', icon: Target },
                                ].map(item => {
                                    const isActive = location.pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name} to={item.href}
                                            className={`flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md border border-transparent transition-all ${
                                                isActive
                                                    ? 'bg-primary/5 text-on-surface border-outline/20 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.01)]'
                                                    : 'text-on-surface-variant/70 hover:bg-surface-container/20 hover:text-on-surface'
                                            }`}
                                        >
                                            <item.icon size={13} className={isActive ? 'text-on-surface' : 'text-on-surface-variant/50'} />
                                            <span>{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Profile Section */}
                <div className="border-t border-outline p-3 bg-surface-container/10">
                    <div className="flex items-center justify-between gap-2.5">
                        <div ref={pfpRef} className="relative flex-1 min-w-0">
                            <button
                                onClick={() => setPfpMenuOpen(!pfpMenuOpen)}
                                className="w-full flex items-center gap-2 p-1 rounded hover:bg-surface-container transition-colors cursor-pointer text-left"
                            >
                                <img
                                    src={userAvatar}
                                    alt="Avatar"
                                    onError={() => setImgError(true)}
                                    className="w-7 h-7 rounded object-cover border border-outline shrink-0"
                                />
                                <div className="flex-1 min-w-0 leading-tight">
                                    <p className="text-xs font-bold text-on-surface truncate">{user?.name || 'User'}</p>
                                    <p className="text-[9px] text-on-surface-variant/40 truncate mt-0.5">{user?.email}</p>
                                </div>
                            </button>

                            {/* Dropdown Menu */}
                            <AnimatePresence>
                                {pfpMenuOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 4 }}
                                        transition={{ duration: 0.1 }}
                                        className="absolute bottom-11 left-0 w-full bg-surface border border-outline rounded-lg p-1 shadow-lg z-50 text-on-surface"
                                    >
                                        <Link
                                            to="/settings"
                                            onClick={() => setPfpMenuOpen(false)}
                                            className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-on-surface rounded transition-colors flex items-center gap-2"
                                        >
                                            <Settings size={13} className="opacity-60" />
                                            Settings
                                        </Link>
                                        <button
                                            onClick={() => { setPfpMenuOpen(false); logout(); }}
                                            className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-red-500 hover:bg-red-500/5 rounded transition-colors flex items-center gap-2 cursor-pointer"
                                        >
                                            <LogOut size={13} className="opacity-80" />
                                            Log Out
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                            <button
                                onClick={toggleTheme}
                                className="w-7 h-7 flex items-center justify-center text-on-surface-variant/50 hover:bg-surface-container hover:text-on-surface rounded transition-colors cursor-pointer"
                                title="Toggle Theme"
                            >
                                {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── Command Palette Modal ── */}
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
                            className="fixed top-24 left-1/2 -translate-x-1/2 w-[calc(100%-32px)] md:w-full max-w-md bg-surface border border-outline rounded-lg shadow-2xl z-50 overflow-hidden text-on-surface"
                        >
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-outline bg-surface-container/30">
                                <Search size={15} className="text-on-surface-variant/50" />
                                <input
                                    type="text"
                                    placeholder="Search pages..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/40 outline-none text-xs font-semibold"
                                    autoFocus
                                />
                                <button onClick={() => setSearchOpen(false)} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant/40 hover:text-on-surface transition-colors cursor-pointer">
                                    <X size={15} />
                                </button>
                            </div>
                            <div className="p-1 max-h-72 overflow-y-auto custom-scrollbar">
                                {filteredNav.length === 0 ? (
                                    <p className="text-center text-on-surface-variant/30 py-8 text-xs italic">No results found...</p>
                                ) : (
                                    filteredNav.map(item => (
                                        <Link
                                            key={item.href} to={item.href}
                                            onClick={() => setSearchOpen(false)}
                                            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors group"
                                        >
                                            <div className="p-1.5 rounded bg-surface-container group-hover:bg-surface-container-high transition-colors">
                                                <item.icon size={13} className="text-on-surface-variant group-hover:text-on-surface transition-colors" />
                                            </div>
                                            <span className="text-xs font-semibold">{item.name}</span>
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

export default Sidebar;
