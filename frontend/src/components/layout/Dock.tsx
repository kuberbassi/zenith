import { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, PieChart, GraduationCap, Trophy, Beaker,
    Target, CalendarClock, CalendarDays, LogOut, User
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Analytics', href: '/analytics', icon: PieChart },
    { name: 'Courses', href: '/courses', icon: GraduationCap },
    { name: 'Results', href: '/results', icon: Trophy },
    { name: 'Assignments', href: '/practicals', icon: Beaker },
    { name: 'Skills', href: '/skills', icon: Target },
    { name: 'Timetable', href: '/timetable', icon: CalendarClock },
    { name: 'Calendar', href: '/calendar', icon: CalendarDays },
];

const MAGNIFICATION = 112;
const DISTANCE = 160;
const BASE_SIZE = 56;
const MOBILE_SIZE = 40;

function DockItem({ item, mouseX, isHoveredGlobal, baseSize }: { item: typeof navItems[0], mouseX: any, isHoveredGlobal: boolean, baseSize: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const isActive = location.pathname === item.href;

    const distance = useTransform(mouseX, (val: number) => {
        const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
        return val - bounds.x - bounds.width / 2;
    });

    const widthSync = useTransform(distance, [-DISTANCE, 0, DISTANCE], [baseSize, MAGNIFICATION, baseSize]);
    const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });

    const [isHovered, setIsHovered] = useState(false);

    return (
        <Link to={item.href} className="relative z-10 flex items-center justify-center">
            <motion.div
                ref={ref}
                style={{ width: isHoveredGlobal ? width : baseSize, height: isHoveredGlobal ? width : baseSize }}
                animate={{ width: isHoveredGlobal ? undefined : baseSize, height: isHoveredGlobal ? undefined : baseSize }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`flex items-center justify-center rounded-2xl transition-colors duration-200 cursor-pointer ${isActive
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'text-white/30 hover:text-white/60 hover:bg-white/[0.05]'
                    }`}
            >
                <item.icon className="w-[44%] h-[44%]" />
            </motion.div>

            {/* Tooltip */}
            <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{
                    opacity: isHovered ? 1 : 0,
                    y: isHovered ? -56 : 8,
                    scale: isHovered ? 1 : 0.9
                }}
                className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#1a1a1a] border border-white/[0.1] text-white/80 px-3 py-1.5 rounded-xl text-sm font-medium shadow-xl pointer-events-none"
                style={{ originY: 1 }}
            >
                {item.name}
            </motion.div>
        </Link>
    );
}

export default function Dock() {
    const mouseX = useMotionValue(Infinity);
    const [isHoveredGlobal, setIsHoveredGlobal] = useState(false);
    const [pfpMenuOpen, setPfpMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const pfpRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Close PFP menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (pfpRef.current && !pfpRef.current.contains(e.target as Node)) {
                setPfpMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-16px)] overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
            <motion.div
                onMouseMove={(e) => mouseX.set(e.pageX)}
                onMouseEnter={() => setIsHoveredGlobal(true)}
                onMouseLeave={() => {
                    mouseX.set(Infinity);
                    setIsHoveredGlobal(false);
                }}
                className="flex items-center gap-1.5 md:gap-3 px-3 py-2 md:px-5 md:py-3 rounded-3xl bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/[0.1] shadow-2xl"
                style={{ boxShadow: '0 0 30px rgba(255,255,255,0.03), 0 -4px 20px rgba(59,130,246,0.04), inset 0 1px 0 rgba(255,255,255,0.06)' }}
            >
                {/* Avatar with Dropdown */}
                <div ref={pfpRef} className="relative mr-0 md:mr-2">
                    <button
                        onClick={() => setPfpMenuOpen(!pfpMenuOpen)}
                        className={`relative flex items-center justify-center rounded-full overflow-hidden transition-all cursor-pointer ${pfpMenuOpen ? 'ring-2 ring-blue-500/50 ring-offset-2 ring-offset-[#0a0a0a] opacity-100' : 'opacity-70 hover:opacity-100 border border-white/[0.1]'}`}
                        style={{ width: isMobile ? MOBILE_SIZE : BASE_SIZE, height: isMobile ? MOBILE_SIZE : BASE_SIZE }}
                    >
                        <img
                            src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=000&color=fff&size=64`}
                            alt="Profile"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                        />
                    </button>

                    {/* PFP Dropdown Menu */}
                    <AnimatePresence>
                        {pfpMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.92 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.92 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-56 rounded-2xl border border-white/[0.08] bg-[#0d0d0d] backdrop-blur-2xl overflow-hidden"
                                style={{ boxShadow: '0 -16px 48px rgba(0,0,0,0.7), 0 0 20px rgba(59,130,246,0.06), inset 0 1px 0 rgba(255,255,255,0.05)' }}
                            >
                                {/* User Info Header */}
                                <div className="p-4 flex items-center gap-3 bg-white/[0.02]">
                                    <div className="w-10 h-10 rounded-full overflow-hidden border border-white/[0.1] flex-shrink-0">
                                        <img
                                            src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=000&color=fff&size=64`}
                                            alt="Profile"
                                            referrerPolicy="no-referrer"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-white truncate">{user?.name || 'User'}</p>
                                        <p className="text-[10px] text-white/25 truncate">{user?.email || ''}</p>
                                    </div>
                                </div>

                                <div className="h-px bg-white/[0.05]" />

                                {/* Menu Items */}
                                <div className="py-1">
                                    <button
                                        onClick={() => { setPfpMenuOpen(false); navigate('/settings'); }}
                                        className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-white/60 hover:bg-white/[0.05] hover:text-white transition-colors flex items-center gap-3"
                                    >
                                        <User size={15} className="text-white/30" />
                                        Profile
                                    </button>
                                    <button
                                        onClick={() => { setPfpMenuOpen(false); logout(); }}
                                        className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-red-400/70 hover:bg-red-500/8 hover:text-red-400 transition-colors flex items-center gap-3"
                                    >
                                        <LogOut size={15} className="text-red-400/50" />
                                        Log Out
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Separator */}
                <div className="w-px h-7 md:h-10 bg-white/[0.08]" />

                {/* Nav Items */}
                {navItems.map((item) => (
                    <DockItem
                        key={item.name}
                        item={item}
                        mouseX={mouseX}
                        isHoveredGlobal={isHoveredGlobal}
                        baseSize={isMobile ? MOBILE_SIZE : BASE_SIZE}
                    />
                ))}
            </motion.div>
        </div>
    );
}
