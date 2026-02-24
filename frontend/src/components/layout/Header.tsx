import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell, Search, X,
    LayoutDashboard, PieChart, CalendarDays, CalendarClock,
    GraduationCap, Trophy, Beaker, Settings, Target
} from 'lucide-react';

interface HeaderProps {
    notificationCount?: number;
}

// Route to title mapping
const routeTitles: Record<string, { title: string; icon: React.ElementType }> = {
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

// Quick navigation items for search
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

    // Get current page info
    const currentPage = routeTitles[location.pathname] || { title: 'Page', icon: LayoutDashboard };
    const PageIcon = currentPage.icon;

    // Filter search results
    const filteredNav = quickNavItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Close search on route change
    useEffect(() => {
        setSearchOpen(false);
        setSearchQuery('');
    }, [location.pathname]);

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
            if (e.key === 'Escape') {
                setSearchOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            <header className="hidden lg:flex sticky top-0 z-30 h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant/10 px-6 items-center justify-between">
                {/* Page Title */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <PageIcon className="w-5 h-5" />
                    </div>
                    <h1 className="text-xl font-display font-bold text-on-surface">
                        {currentPage.title}
                    </h1>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                    {/* Search Button */}
                    <button
                        onClick={() => setSearchOpen(true)}
                        className="flex items-center gap-2 h-10 px-4 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant text-sm"
                    >
                        <Search size={16} />
                        <span className="hidden xl:inline">Search...</span>
                        <kbd className="hidden xl:inline ml-2 px-1.5 py-0.5 rounded bg-surface-container-high text-[10px] font-mono">
                            ⌘K
                        </kbd>
                    </button>

                    {/* Notifications */}
                    <Link
                        to="/notifications"
                        className="relative w-10 h-10 rounded-full flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant"
                    >
                        <Bell size={18} />
                        {notificationCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-on-primary text-[10px] font-bold rounded-full flex items-center justify-center">
                                {notificationCount > 9 ? '9+' : notificationCount}
                            </span>
                        )}
                    </Link>
                </div>
            </header>

            {/* Search Modal */}
            <AnimatePresence>
                {searchOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                            onClick={() => setSearchOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-lg bg-surface-container rounded-2xl shadow-2xl border border-outline-variant/20 z-50 overflow-hidden"
                        >
                            <div className="flex items-center gap-3 p-4 border-b border-outline-variant/10">
                                <Search size={20} className="text-on-surface-variant" />
                                <input
                                    type="text"
                                    placeholder="Search pages..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant outline-none text-lg"
                                    autoFocus
                                />
                                <button
                                    onClick={() => setSearchOpen(false)}
                                    className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="p-2 max-h-80 overflow-y-auto">
                                {filteredNav.length === 0 ? (
                                    <p className="text-center text-on-surface-variant py-8">No results found</p>
                                ) : (
                                    filteredNav.map(item => (
                                        <Link
                                            key={item.href}
                                            to={item.href}
                                            onClick={() => setSearchOpen(false)}
                                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-container-high text-on-surface transition-colors"
                                        >
                                            <item.icon size={20} className="text-primary" />
                                            <span className="font-medium">{item.name}</span>
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
