import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, PieChart, GraduationCap, Trophy, Beaker,
    Target, CalendarClock, CalendarDays, LogOut, Settings,
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

/* ══════════════════════════════════════════════════════
   DESKTOP: macOS-style magnetic dock
   ══════════════════════════════════════════════════════ */
const MAGNIFICATION = 112;
const DISTANCE = 160;
const BASE_SIZE = 56;

function DockItem({ item, mouseX, isHoveredGlobal }: {
    item: typeof navItems[0];
    mouseX: any;
    isHoveredGlobal: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const isActive = location.pathname === item.href;

    const distance = useTransform(mouseX, (val: number) => {
        const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
        return val - bounds.x - bounds.width / 2;
    });
    const widthSync = useTransform(distance, [-DISTANCE, 0, DISTANCE], [BASE_SIZE, MAGNIFICATION, BASE_SIZE]);
    const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Link to={item.href} className="relative z-10 flex items-center justify-center">
            <motion.div
                ref={ref}
                style={{ width: isHoveredGlobal ? width : BASE_SIZE, height: isHoveredGlobal ? width : BASE_SIZE }}
                animate={{ width: isHoveredGlobal ? undefined : BASE_SIZE, height: isHoveredGlobal ? undefined : BASE_SIZE }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`flex items-center justify-center rounded-2xl transition-colors duration-200 cursor-pointer ${
                    isActive ? 'bg-blue-500/15 text-blue-400' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.05]'
                }`}
            >
                <item.icon className="w-[44%] h-[44%]" />
            </motion.div>
            <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? -56 : 8, scale: isHovered ? 1 : 0.9 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#1a1a1a] border border-white/[0.1] text-white/80 px-3 py-1.5 rounded-xl text-sm font-medium shadow-xl pointer-events-none"
                style={{ originY: 1 }}
            >
                {item.name}
            </motion.div>
        </Link>
    );
}

function DesktopDock() {
    const mouseX = useMotionValue(Infinity);
    const [isHoveredGlobal, setIsHoveredGlobal] = useState(false);
    const [pfpMenuOpen, setPfpMenuOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ bottom: 0, left: 0 });
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const pfpRef = useRef<HTMLDivElement>(null);
    const pfpBtnRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (
                pfpRef.current && !pfpRef.current.contains(t) &&
                dropdownRef.current && !dropdownRef.current.contains(t)
            ) setPfpMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handlePfpClick = () => {
        if (pfpBtnRef.current) {
            const rect = pfpBtnRef.current.getBoundingClientRect();
            const w = 224;
            const cx = rect.left + rect.width / 2;
            setDropdownPos({
                bottom: window.innerHeight - rect.top + 12,
                left: Math.max(8, Math.min(cx - w / 2, window.innerWidth - w - 8)),
            });
        }
        setPfpMenuOpen(p => !p);
    };

    return (
        <>
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
                <motion.div
                    onMouseMove={(e) => mouseX.set(e.pageX)}
                    onMouseEnter={() => setIsHoveredGlobal(true)}
                    onMouseLeave={() => { mouseX.set(Infinity); setIsHoveredGlobal(false); }}
                    className="flex items-center gap-3 px-5 py-3 rounded-3xl bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/[0.1] shadow-2xl"
                    style={{ boxShadow: '0 0 30px rgba(255,255,255,0.03), 0 -4px 20px rgba(59,130,246,0.04), inset 0 1px 0 rgba(255,255,255,0.06)' }}
                >
                    <div ref={pfpRef} className="relative mr-2">
                        <button
                            ref={pfpBtnRef}
                            onClick={handlePfpClick}
                            className={`w-14 h-14 rounded-full overflow-hidden transition-all cursor-pointer ${
                                pfpMenuOpen
                                    ? 'ring-2 ring-blue-500/50 ring-offset-2 ring-offset-[#0a0a0a]'
                                    : 'opacity-70 hover:opacity-100 border border-white/[0.1]'
                            }`}
                        >
                            <img
                                src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=000&color=fff&size=64`}
                                alt="Profile"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                            />
                        </button>
                    </div>
                    <div className="w-px h-10 bg-white/[0.08]" />
                    {navItems.map((item) => (
                        <DockItem key={item.name} item={item} mouseX={mouseX} isHoveredGlobal={isHoveredGlobal} />
                    ))}
                </motion.div>
            </div>

            {createPortal(
                <AnimatePresence>
                    {pfpMenuOpen && (
                        <motion.div
                            ref={dropdownRef}
                            initial={{ opacity: 0, y: 8, scale: 0.92 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.92 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            style={{
                                position: 'fixed',
                                bottom: dropdownPos.bottom,
                                left: dropdownPos.left,
                                zIndex: 9999,
                                width: 224,
                                boxShadow: '0 -16px 48px rgba(0,0,0,0.8), 0 0 20px rgba(59,130,246,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
                            }}
                            className="rounded-2xl border border-white/[0.08] bg-[#0d0d0d] backdrop-blur-2xl overflow-hidden"
                        >
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
                            <div className="py-1">
                                <button
                                    onClick={() => { setPfpMenuOpen(false); navigate('/settings'); }}
                                    className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-white/60 hover:bg-white/[0.05] hover:text-white transition-colors flex items-center gap-3"
                                >
                                    <Settings size={15} className="text-white/30" />
                                    Profile & Settings
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
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}

/* ══════════════════════════════════════════════════════
   MOBILE: Bubble FAB + radial fan menu
   8 nav items fanned in a semicircle (150° → 30°, r=110px)
   ══════════════════════════════════════════════════════ */
const BUBBLE_R = 110;
// FAB: bottom-6 (24px), h-14 (56px) → center at 52px from bottom
// Items: h-11 (44px), centered at FAB center → bottom = 52-22 = 30px
const ITEM_BOTTOM = 30;

const NAV_ARC = navItems.map((item, i) => {
    const deg = 150 - (i / (navItems.length - 1)) * 120; // 150°→30°
    const rad = (deg * Math.PI) / 180;
    return {
        ...item,
        tx: parseFloat((Math.cos(rad) * BUBBLE_R).toFixed(1)),
        ty: parseFloat((-Math.sin(rad) * BUBBLE_R).toFixed(1)), // negative = up
    };
});

function MobileBubble() {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();
    const { user } = useAuth();

    // Close on route change
    useEffect(() => { setIsOpen(false); }, [location.pathname]);

    return createPortal(
        <>
            {/* Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="bubble-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="fixed inset-0 z-40"
                        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)' }}
                        onClick={() => setIsOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Radial nav items */}
            <AnimatePresence>
                {isOpen && NAV_ARC.map((item, i) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
                            animate={{ opacity: 1, x: item.tx, y: item.ty, scale: 1 }}
                            exit={{ opacity: 0, x: 0, y: 0, scale: 0.3 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 26, delay: i * 0.03 }}
                            style={{
                                position: 'fixed',
                                bottom: ITEM_BOTTOM,
                                left: '50%',
                                marginLeft: -22,
                                zIndex: 50,
                            }}
                        >
                            <Link
                                to={item.href}
                                onClick={() => setIsOpen(false)}
                                className="flex flex-col items-center gap-[3px] select-none"
                            >
                                <div className={`w-11 h-11 rounded-[16px] flex items-center justify-center border shadow-xl transition-colors ${
                                    isActive
                                        ? 'bg-blue-500/25 border-blue-500/40 text-blue-400 shadow-blue-500/20'
                                        : 'bg-[#0e0e0e]/95 border-white/10 text-white/60'
                                }`}>
                                    <item.icon size={19} />
                                </div>
                                <span className={`text-[8px] font-bold tracking-wide leading-none ${
                                    isActive ? 'text-blue-400' : 'text-white/35'
                                }`}>{item.name}</span>
                            </Link>
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {/* FAB trigger */}
            <motion.div
                style={{
                    position: 'fixed',
                    bottom: 24,
                    left: '50%',
                    marginLeft: -28,
                    zIndex: 52,
                }}
                whileTap={{ scale: 0.88 }}
            >
                <button
                    onClick={() => setIsOpen(p => !p)}
                    className={`w-14 h-14 rounded-full overflow-hidden relative transition-all ${
                        isOpen
                            ? 'ring-2 ring-blue-500/50 ring-offset-2 ring-offset-black'
                            : 'border-2 border-white/15'
                    }`}
                    style={{
                        boxShadow: isOpen
                            ? '0 0 32px rgba(59,130,246,0.4), 0 4px 20px rgba(0,0,0,0.6)'
                            : '0 4px 20px rgba(0,0,0,0.5)',
                    }}
                >
                    <img
                        src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=000&color=fff&size=64`}
                        alt="Menu"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                    />
                    {/* Close overlay */}
                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.7 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.7 }}
                                className="absolute inset-0 flex items-center justify-center rounded-full"
                                style={{ background: 'rgba(0,0,0,0.55)' }}
                            >
                                <span className="text-white text-base font-black leading-none">✕</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </button>
            </motion.div>
        </>,
        document.body
    );
}

/* Main export */
export default function Dock() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    useEffect(() => {
        const fn = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', fn);
        return () => window.removeEventListener('resize', fn);
    }, []);
    return isMobile ? <MobileBubble /> : <DesktopDock />;
}
