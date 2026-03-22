import { useRef, useState, useEffect, useMemo } from 'react';
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
                    isActive ? 'bg-emerald-500/15 text-emerald-400' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.05]'
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
    const location = useLocation();
    const mouseX = useMotionValue(Infinity);
    const [isHoveredGlobal, setIsHoveredGlobal] = useState(false);
    const [pfpMenuOpen, setPfpMenuOpen] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ bottom: 0, left: 0 });
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const dockRef = useRef<HTMLDivElement>(null);
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

    useEffect(() => {
        const syncHoverFromPointer = (clientX: number, clientY: number) => {
            const bounds = dockRef.current?.getBoundingClientRect();
            if (!bounds) return;
            const inside =
                clientX >= bounds.left &&
                clientX <= bounds.right &&
                clientY >= bounds.top &&
                clientY <= bounds.bottom;

            setIsHoveredGlobal(inside);
            mouseX.set(inside ? clientX : Infinity);
        };

        const handlePointerMove = (event: PointerEvent) => {
            syncHoverFromPointer(event.clientX, event.clientY);
        };

        window.addEventListener('pointermove', handlePointerMove, { passive: true });

        return () => window.removeEventListener('pointermove', handlePointerMove);
    }, [mouseX]);

    useEffect(() => {
        // Route transitions can preserve pointer position without firing mouseenter again.
        const lastPointer = window as Window & { __acadhubPointer?: { x: number; y: number } };
        if (lastPointer.__acadhubPointer) {
            const { x, y } = lastPointer.__acadhubPointer;
            const bounds = dockRef.current?.getBoundingClientRect();
            const inside = !!bounds &&
                x >= bounds.left &&
                x <= bounds.right &&
                y >= bounds.top &&
                y <= bounds.bottom;
            setIsHoveredGlobal(inside);
            mouseX.set(inside ? x : Infinity);
        }
    }, [location.pathname, mouseX]);

    useEffect(() => {
        const rememberPointer = (event: PointerEvent) => {
            (window as Window & { __acadhubPointer?: { x: number; y: number } }).__acadhubPointer = {
                x: event.clientX,
                y: event.clientY,
            };
        };
        window.addEventListener('pointermove', rememberPointer, { passive: true });
        return () => window.removeEventListener('pointermove', rememberPointer);
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
                    ref={dockRef}
                    onMouseMove={(e) => mouseX.set(e.clientX)}
                    onMouseEnter={() => setIsHoveredGlobal(true)}
                    onMouseLeave={() => { mouseX.set(Infinity); setIsHoveredGlobal(false); }}
                    className="flex items-center gap-3 px-5 py-3 rounded-3xl bg-[#080808]/92 backdrop-blur-2xl border border-white/[0.1] shadow-2xl"
                    style={{ boxShadow: '0 0 30px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)' }}
                >
                    <div ref={pfpRef} className="relative mr-2">
                        <button
                            ref={pfpBtnRef}
                            onClick={handlePfpClick}
                            className={`w-14 h-14 rounded-full overflow-hidden transition-all cursor-pointer ${
                                pfpMenuOpen
                                    ? 'ring-2 ring-white/30 ring-offset-2 ring-offset-[#080808]'
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
                                boxShadow: '0 -16px 48px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.05)',
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
   8 nav items fanned in a semicircle (160° → 20°, r=120px)
   Long-press FAB 2s → profile/logout menu
   ══════════════════════════════════════════════════════ */
const MIN_BUBBLE_R = 92;
const MAX_BUBBLE_R = 128;
const HOLD_DURATION = 1200;
const CIRCUMFERENCE = 2 * Math.PI * 25;

function getNavArc(radius: number) {
    return navItems.map((item, i) => {
        const deg = 160 - (i / (navItems.length - 1)) * 140;
        const rad = (deg * Math.PI) / 180;
        return {
            ...item,
            tx: parseFloat((Math.cos(rad) * radius).toFixed(1)),
            ty: parseFloat((-Math.sin(rad) * radius).toFixed(1)),
        };
    });
}

function MobileBubble() {
    const [isOpen, setIsOpen] = useState(false);
    const [pfpMenuOpen, setPfpMenuOpen] = useState(false);
    const [holding, setHolding] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const location = useLocation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const didHold = useRef(false);
    const pfpMenuRef = useRef<HTMLDivElement>(null);
    const bubbleRadius = useMemo(
        () => Math.min(MAX_BUBBLE_R, Math.max(MIN_BUBBLE_R, Math.round(viewportWidth * 0.32))),
        [viewportWidth],
    );
    const navArc = useMemo(() => getNavArc(bubbleRadius), [bubbleRadius]);
    const itemBottom = 'calc(env(safe-area-inset-bottom, 0px) + 24px)';
    const fabBottom = 'calc(env(safe-area-inset-bottom, 0px) + 20px)';

    useEffect(() => { setIsOpen(false); setPfpMenuOpen(false); }, [location.pathname]);

    useEffect(() => {
        const onResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (!pfpMenuOpen) return;
        const close = (e: PointerEvent) => {
            if (pfpMenuRef.current?.contains(e.target as Node)) return;
            setPfpMenuOpen(false);
        };
        document.addEventListener('pointerdown', close);
        return () => document.removeEventListener('pointerdown', close);
    }, [pfpMenuOpen]);

    useEffect(() => {
        const shouldLock = isOpen || pfpMenuOpen;
        document.body.style.overflow = shouldLock ? 'hidden' : '';
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                setPfpMenuOpen(false);
            }
        };
        if (shouldLock) window.addEventListener('keydown', onEsc);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onEsc);
        };
    }, [isOpen, pfpMenuOpen]);

    const startHold = () => {
        didHold.current = false;
        setHolding(true);
        holdTimer.current = setTimeout(() => {
            didHold.current = true;
            setHolding(false);
            setIsOpen(false);
            setPfpMenuOpen(true);
            navigator.vibrate?.(12);
        }, HOLD_DURATION);
    };

    const endHold = () => {
        setHolding(false);
        if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    };

    const handleClick = () => {
        if (didHold.current) { didHold.current = false; return; }
        setPfpMenuOpen(false);
        setIsOpen(p => !p);
    };

    return createPortal(
        <>
            {/* Backdrop */}
            <AnimatePresence>
                {(isOpen || pfpMenuOpen) && (
                    <motion.div
                        key="bubble-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-40"
                        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
                        onClick={() => { setIsOpen(false); setPfpMenuOpen(false); }}
                    />
                )}
            </AnimatePresence>

            {/* PFP menu — appears above FAB on 2s hold */}
            <AnimatePresence>
                {pfpMenuOpen && (
                    <motion.div
                        ref={pfpMenuRef}
                        initial={{ opacity: 0, scale: 0.88, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.88, y: 16 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                        style={{
                            position: 'fixed',
                            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
                            left: '50%',
                            zIndex: 60,
                            width: 220,
                            marginLeft: -110,
                            boxShadow: '0 -8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                        className="rounded-3xl bg-[#0c0c0f]/98 backdrop-blur-2xl overflow-visible"
                    >
                        <div className="p-4 flex items-center gap-3">
                            <img
                                src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=000&color=fff&size=64`}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                            />
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold text-white truncate">{user?.name || 'User'}</p>
                                <p className="text-[10px] text-white/30 truncate">{user?.email || ''}</p>
                            </div>
                        </div>
                        <div className="h-px bg-white/[0.06]" />
                        <div className="py-1.5 px-1.5 flex flex-col gap-0.5">
                            <button
                                onClick={() => { setPfpMenuOpen(false); navigate('/settings'); }}
                                className="w-full px-3 py-2.5 text-left text-[13px] font-medium text-white/60 hover:bg-white/[0.06] rounded-2xl transition-colors flex items-center gap-3"
                            >
                                <Settings size={15} className="text-white/30" />
                                Profile & Settings
                            </button>
                            <button
                                onClick={() => { setPfpMenuOpen(false); logout(); }}
                                className="w-full px-3 py-2.5 text-left text-[13px] font-medium text-red-400/70 hover:bg-red-500/[0.08] rounded-2xl transition-colors flex items-center gap-3"
                            >
                                <LogOut size={15} className="text-red-400/50" />
                                Log Out
                            </button>
                        </div>
                        {/* Caret pointing down toward FAB */}
                        <div className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#0c0c0f] rotate-45 border-r border-b border-white/[0.07]" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Radial nav items */}
            <AnimatePresence>
                {isOpen && navArc.map((item, i) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <motion.div
                            key={item.href}
                            initial={{ opacity: 0, x: 0, y: 0, scale: 0.2 }}
                            animate={{ opacity: 1, x: item.tx, y: item.ty, scale: 1 }}
                            exit={{ opacity: 0, x: 0, y: 0, scale: 0.2 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 28, delay: i * 0.025 }}
                            style={{
                                position: 'fixed',
                                bottom: itemBottom,
                                left: '50%',
                                marginLeft: -26,
                                zIndex: 50,
                            }}
                        >
                            <Link
                                to={item.href}
                                onClick={() => setIsOpen(false)}
                                className="flex flex-col items-center gap-1 select-none"
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                            >
                                <div
                                    className={`w-[52px] h-[52px] rounded-[18px] flex items-center justify-center border transition-all ${
                                        isActive
                                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                            : 'bg-[#111]/95 border-white/[0.09] text-white/55'
                                    }`}
                                    style={{
                                        boxShadow: isActive
                                            ? '0 4px 20px rgba(16,185,129,0.2), 0 0 0 1px rgba(16,185,129,0.08)'
                                            : '0 4px 20px rgba(0,0,0,0.55)',
                                        backdropFilter: 'blur(20px)',
                                    }}
                                >
                                    <item.icon size={20} strokeWidth={1.75} />
                                </div>
                                <span className={`text-[8.5px] font-semibold tracking-wide leading-none ${
                                    isActive ? 'text-emerald-400' : 'text-white/40'
                                }`}>{item.name}</span>
                            </Link>
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {/* FAB trigger */}
            <motion.div
                style={{ position: 'fixed', bottom: fabBottom, left: '50%', marginLeft: -28, zIndex: 52 }}
                animate={holding ? { scale: 0.94 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
                <button
                    aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    onClick={handleClick}
                    onPointerDown={startHold}
                    onPointerUp={endHold}
                    onPointerLeave={endHold}
                    onPointerCancel={endHold}
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-14 h-14 rounded-full overflow-hidden relative select-none outline-none"
                    style={{
                        boxShadow: isOpen
                            ? '0 0 32px rgba(255,255,255,0.15), 0 4px 20px rgba(0,0,0,0.6)'
                            : pfpMenuOpen
                            ? '0 0 28px rgba(255,255,255,0.12), 0 4px 20px rgba(0,0,0,0.6)'
                            : '0 4px 24px rgba(0,0,0,0.5)',
                        border: isOpen
                            ? '2px solid rgba(255,255,255,0.25)'
                            : pfpMenuOpen
                            ? '2px solid rgba(255,255,255,0.2)'
                            : '2px solid rgba(255,255,255,0.12)',
                    }}
                >
                    <img
                        src={user?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=000&color=fff&size=64`}
                        alt="Menu"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                    />
                    {/* 2s hold progress ring */}
                    {holding && (
                        <svg
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            style={{ transform: 'rotate(-90deg)' }}
                            viewBox="0 0 56 56"
                        >
                            <motion.circle
                                cx="28" cy="28" r="25"
                                fill="none"
                                stroke="rgba(139,92,246,0.85)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeDasharray={CIRCUMFERENCE}
                                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                                animate={{ strokeDashoffset: 0 }}
                                transition={{ duration: HOLD_DURATION / 1000, ease: 'linear' }}
                            />
                        </svg>
                    )}
                    {/* Close overlay */}
                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.6 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.6 }}
                                className="absolute inset-0 flex items-center justify-center rounded-full"
                                style={{ background: 'rgba(0,0,0,0.6)' }}
                            >
                                <span className="text-white text-[15px] font-black leading-none">✕</span>
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
