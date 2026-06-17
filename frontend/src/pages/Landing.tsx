import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePageMeta } from '@/hooks/usePageMeta';
import { getCopyrightYears } from '@/utils/copyright';
import { 
    Sun, Moon, ArrowRight, ShieldAlert, Sparkles, BookOpen, 
    TrendingUp, CalendarDays, Beaker, Target, FileText, ChevronDown, Check,
    Menu, X
} from 'lucide-react';
import Button from '@/components/ui/Button';
import ThreeBackground from '@/components/ui/ThreeBackground';

const Landing: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({});
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    // Detect scroll position — nav goes transparent at top, gains bg on scroll
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    usePageMeta({
        title: 'Zenith | Your Academic Operating System',
        description: 'Track attendance, manage assignments, organize notes, monitor performance, and stay ahead throughout the semester. All-in-one student workspace.',
        indexable: true,
    });

    // Auto-redirect authenticated users directly to the dashboard
    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    const toggleFaq = (index: number) => {
        setFaqOpen(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const features = [
        {
            icon: <BookOpen className="w-5 h-5 text-primary" />,
            title: "Attendance Tracker",
            desc: "Simulate buffer classes, track present/absent logs, and receive automatic alerts when approaching the 75% shortage threshold."
        },
        {
            icon: <TrendingUp className="w-5 h-5 text-primary" />,
            title: "Academic Analytics",
            desc: "Monitor your grades, project dynamic SGPA calculations, and view visual performance trends across semesters."
        },
        {
            icon: <CalendarDays className="w-5 h-5 text-primary" />,
            title: "Interactive Schedule",
            desc: "A fluid, 120Hz-scrolling class schedule mapped specifically to your semester structure. Never walk into the wrong room again."
        },
        {
            icon: <Beaker className="w-5 h-5 text-primary" />,
            title: "Assignment Board",
            desc: "Direct tracking for practical sheets, files, write-ups, and syllabus updates. Keep statuses clear and never miss deadlines."
        },
        {
            icon: <FileText className="w-5 h-5 text-primary" />,
            title: "Document Workspace",
            desc: "Write rich text class notes, format syllabi, and coordinate checkable lists in one integrated place."
        },
        {
            icon: <Target className="w-5 h-5 text-primary" />,
            title: "Skill Development",
            desc: "Set programming tracks, track certifications, and map your target career paths directly alongside coursework."
        }
    ];

    const faqs = [
        {
            q: "Is Zenith free?",
            a: "Yes, Zenith is a fully public-use student utility. You can use it right here or self-host your own instance using the source codebase."
        },
        {
            q: "Does it work on mobile?",
            a: "Absolutely. Zenith is built as an installable Progressive Web App (PWA). You can install it on iOS or Android directly from Safari or Chrome, featuring tactile haptic feedback."
        },
        {
            q: "Can I manage multiple subjects?",
            a: "Yes. Zenith lets you configure as many subjects, laboratories, and assignment criteria per semester as your course catalog requires."
        },
        {
            q: "How does the attendance shortage alert work?",
            a: "Zenith automatically flags any subject dropping below the standard 75% attendance criteria. It highlights the target classes you must attend to restore compliance."
        },
        {
            q: "Can I migrate my data if I change Google accounts?",
            a: "Yes. Zenith supports secure token-based account migrations, allowing you to move all semester logs and results to a different login in seconds."
        }
    ];

    return (
        <div 
            className="min-h-screen text-on-background select-none relative overflow-x-hidden"
        >
            {/* Solid background layer */}
            <div className="fixed inset-0 bg-background -z-30 pointer-events-none" />

            {/* ── Navbar ────────────────────────────────────────────── */}
            <nav className={[
                'sticky top-0 z-50 w-full transition-all duration-300 ease-in-out',
                scrolled
                    ? 'border-b border-outline bg-surface/80 backdrop-blur-md shadow-sm'
                    : 'border-b border-transparent bg-transparent backdrop-blur-none',
            ].join(' ')}>
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link to="/" className="flex items-center gap-3 group">
                            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center border border-outline/10 shadow-sm">
                                <img src="/zenith-logo.png" alt="Z" className="w-6 h-6 object-contain invert dark:invert-0" />
                            </div>
                            <span className="font-extrabold text-lg tracking-tight text-on-surface">Zenith</span>
                        </Link>
                        
                        <div className="hidden md:flex items-center gap-6">
                            <a href="#features" className="text-xs font-semibold text-on-surface-variant/70 hover:text-on-surface transition-colors">Features</a>
                            <a href="#showcase" className="text-xs font-semibold text-on-surface-variant/70 hover:text-on-surface transition-colors">Showcase</a>
                            <a href="#faq" className="text-xs font-semibold text-on-surface-variant/70 hover:text-on-surface transition-colors">FAQ</a>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleTheme}
                            className="w-9 h-9 flex items-center justify-center rounded-lg border border-outline bg-surface hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all duration-200 cursor-pointer shadow-sm"
                            title="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                        </button>
                        
                        <Link to="/login" className="hidden sm:inline-block">
                            <Button variant="text" size="sm">Sign In</Button>
                        </Link>
                        <Link to="/login" className="hidden xs:inline-block">
                            <Button variant="filled" size="sm" icon={<ArrowRight size={13} />}>Get Started</Button>
                        </Link>

                        {/* Mobile Hamburger Button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-outline bg-surface hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-all duration-200 cursor-pointer shadow-sm"
                            title="Toggle menu"
                        >
                            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation Drawer */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: 'easeInOut' }}
                            className="md:hidden border-t border-outline bg-surface w-full overflow-hidden"
                        >
                            <div className="flex flex-col gap-4 px-6 py-5">
                                <a 
                                    href="#features" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/70 hover:text-on-surface py-2.5 border-b border-outline/30 transition-colors"
                                >
                                    Features
                                </a>
                                <a 
                                    href="#showcase" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/70 hover:text-on-surface py-2.5 border-b border-outline/30 transition-colors"
                                >
                                    Showcase
                                </a>
                                <a 
                                    href="#faq" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/70 hover:text-on-surface py-2.5 border-b border-outline/30 transition-colors"
                                >
                                    FAQ
                                </a>
                                <div className="flex flex-col gap-3 pt-3">
                                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
                                        <Button variant="outlined" size="lg" className="w-full justify-center">Sign In</Button>
                                    </Link>
                                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="w-full">
                                        <Button variant="filled" size="lg" className="w-full justify-center" icon={<ArrowRight size={13} />}>Get Started</Button>
                                    </Link>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* ── Hero Section ──────────────────────────────────────── */}
            <header className="relative py-20 sm:py-28 md:py-36 max-w-5xl mx-auto px-6 text-center flex flex-col items-center overflow-visible">

                {/* 3D Background — contained to hero section only */}
                <div className="absolute inset-x-[-50vw] top-[-80px] h-[calc(100%+80px)] pointer-events-none overflow-hidden -z-10">
                    <ThreeBackground contained />
                    {/* Gradient fade-out at bottom so 3D dissolves into page */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                </div>

                {/* Ambient Radial Spotlight */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] pointer-events-none -z-10 overflow-hidden">
                    <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[350px] bg-gradient-to-b from-primary/10 via-indigo-500/5 to-transparent rounded-full blur-[120px] opacity-85 dark:from-primary/10 dark:via-purple-900/5" />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center"
                >
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline bg-surface-container/50 text-[10px] font-bold uppercase tracking-wider mb-8 text-primary shadow-sm">
                        <Sparkles size={11} className="text-primary animate-pulse" />
                        <span>INTELLIGENT ACADEMIC WORKSPACE</span>
                    </div>

                    <h1 className="text-4xl xs:text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tighter text-on-surface max-w-4xl leading-[1.05] mb-8 bg-clip-text text-transparent bg-gradient-to-b from-on-surface via-on-surface to-on-surface-variant/70">
                        Your Academic <br className="hidden md:inline" /> Operating System.
                    </h1>

                    <p className="text-sm sm:text-base md:text-lg text-on-surface-variant/70 max-w-2xl leading-relaxed mb-10">
                        Track attendance, manage assignments, organize notes, monitor performance, and stay ahead throughout the semester.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center justify-center">
                        <Link to="/login" className="w-full sm:w-auto">
                            <Button variant="filled" size="lg" className="w-full sm:w-56 justify-center text-sm font-semibold tracking-tight shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_25px_rgba(0,0,0,0.22)] transition-all">
                                Create Free Account
                            </Button>
                        </Link>
                        <Link to="/login" className="w-full sm:w-auto">
                            <Button variant="outlined" size="lg" className="w-full sm:w-36 justify-center text-sm font-semibold tracking-tight">
                                Sign In
                            </Button>
                        </Link>
                    </div>
                </motion.div>
            </header>

            {/* ── Dashboard Showcase Mockup ─────────────────────────── */}
            <motion.section 
                id="showcase" 
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-6xl mx-auto px-6 pb-20 md:pb-28"
            >
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7 }}
                    className="border border-outline rounded-xl bg-surface-container overflow-hidden shadow-2xl dark:shadow-[0_0_50px_rgba(255,255,255,0.02)] p-4 md:p-6 transition-all duration-300 hover:border-primary/20"
                >
                    {/* Simulated OS Frame bar */}
                    <div className="flex items-center justify-between pb-4 border-b border-outline/50 mb-4 md:mb-6">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-outline-variant/60" />
                            <div className="w-3 h-3 rounded-full bg-outline-variant/60" />
                            <div className="w-3 h-3 rounded-full bg-outline-variant/60" />
                        </div>
                        <div className="text-[10px] font-mono text-on-surface-variant/40 bg-surface px-4 py-0.5 rounded border border-outline/50">zenith.run/dashboard</div>
                        <div className="w-12" />
                    </div>

                    {/* Mockup Dashboard Body */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                        {/* Attendance Simulator Card mockup */}
                        <div className="p-5 rounded-lg border border-outline bg-surface">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/40">Compliance Optimizer</span>
                                <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded">79.2%</span>
                            </div>
                            <h4 className="text-sm font-extrabold text-on-surface mb-1">Advanced Mathematics</h4>
                            <p className="text-[11px] text-on-surface-variant/50 mb-4">19 / 24 Lectures Marked</p>
                            
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between text-xs border-t border-outline/40 pt-2">
                                    <span className="text-on-surface-variant/60">Status</span>
                                    <span className="font-semibold text-on-surface">Compliance Verified</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-on-surface-variant/60">Bunk Margin</span>
                                    <span className="font-bold text-primary">Can bunk 1 class</span>
                                </div>
                            </div>
                        </div>

                        {/* Schedule Tracker grid mockup */}
                        <div className="p-5 rounded-lg border border-outline bg-surface lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/40">Active Timetable Grid</span>
                                <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase bg-surface-container px-2 py-0.5 rounded border border-outline/50">Semester 4</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-4 p-2.5 rounded border border-outline bg-surface-container/30">
                                    <span className="font-mono text-[10px] font-semibold text-on-surface-variant/60">09:00 AM</span>
                                    <div className="h-4 w-px bg-outline-variant" />
                                    <div>
                                        <h5 className="text-xs font-bold text-on-surface">Data Structures & Algos</h5>
                                        <p className="text-[10px] text-on-surface-variant/50">Room 302 • Prof. V. Sharma</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-2.5 rounded border border-outline bg-surface-container/30">
                                    <span className="font-mono text-[10px] font-semibold text-on-surface-variant/60">10:00 AM</span>
                                    <div className="h-4 w-px bg-outline-variant" />
                                    <div>
                                        <h5 className="text-xs font-bold text-on-surface">Database Management Systems</h5>
                                        <p className="text-[10px] text-on-surface-variant/50">Lab 3 • Prof. S. Sen</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.section>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-outline to-transparent opacity-60" />

            {/* ── Problem Section ───────────────────────────────────── */}
            <motion.section 
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="bg-surface-container/20 py-20"
            >
                <div className="max-w-5xl mx-auto px-6">
                    <div className="max-w-xl mb-12">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">The Student Struggle</span>
                        <h2 className="text-3xl font-extrabold tracking-tight mt-2 text-on-surface">
                            Scattered trackers lead to missed deadlines.
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="p-6 rounded-lg premium-card">
                            <div className="w-8 h-8 rounded bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mb-4">
                                <ShieldAlert size={16} />
                            </div>
                            <h4 className="text-base font-bold text-on-surface mb-2">Shortage Surprises</h4>
                            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
                                Discovering you are short on attendance days before final examinations because calculations are scattered.
                            </p>
                        </div>
                        <div className="p-6 rounded-lg premium-card">
                            <div className="w-8 h-8 rounded bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mb-4">
                                <ShieldAlert size={16} />
                            </div>
                            <h4 className="text-base font-bold text-on-surface mb-2">Spreadsheet Chaos</h4>
                            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
                                Manually managing logs, marks, and SGPA formulas in clunky Excel sheets that break easily on mobile screens.
                            </p>
                        </div>
                        <div className="p-6 rounded-lg premium-card sm:col-span-2 lg:col-span-1">
                            <div className="w-8 h-8 rounded bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mb-4">
                                <ShieldAlert size={16} />
                            </div>
                            <h4 className="text-base font-bold text-on-surface mb-2">Document Bloat</h4>
                            <p className="text-xs text-on-surface-variant/60 leading-relaxed">
                                Storing class notes in one app, assignments in a calendar, study checklists in another, and losing trace of files.
                            </p>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-outline to-transparent opacity-60" />

            {/* ── Solution Section ──────────────────────────────────── */}
            <motion.section 
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="py-20 max-w-5xl mx-auto px-6"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">The Solution</span>
                        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-2 text-on-surface mb-6">
                            Zenith replaces the app bloat.
                        </h2>
                        <p className="text-sm text-on-surface-variant/70 leading-relaxed mb-6">
                            Zenith brings your academic records under one system. We consolidate four disparate processes into a single unified workspace.
                        </p>
                        <ul className="space-y-3.5">
                            {[
                                { old: "Clunky Excel Spreadsheets", new: "Dynamic Attendance Simulator" },
                                { old: "Separate Calendars", new: "120Hz Integrated Schedule Grid" },
                                { old: "Disorganized Notes Apps", new: "Document & Task Board Workspace" },
                                { old: "Manual Mark Projectors", new: "Academic Analytics Dashboard" }
                            ].map((item, idx) => (
                                <li key={idx} className="flex items-center gap-3 text-xs font-semibold text-on-surface">
                                    <div className="w-4 h-4 rounded-full bg-green-500/15 border border-green-500/30 text-green-500 flex items-center justify-center flex-shrink-0">
                                        <Check size={10} />
                                    </div>
                                    <span>{item.old} ➔ <strong className="text-primary font-bold">{item.new}</strong></span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[340px] premium-card">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full blur-xl" />
                        <div className="space-y-4 relative z-10 text-left">
                            <h4 className="text-sm font-extrabold text-on-surface flex items-center gap-2">
                                <Sparkles size={14} className="text-primary animate-pulse" /> Integrated Framework
                            </h4>
                            <p className="text-xs text-on-surface-variant/70 leading-relaxed">
                                Because your courses, schedule, notes, and records are mapped together database-side, changes in your timetable automatically update class compliance logs and target checklists immediately.
                            </p>
                        </div>
                        
                        {/* Visual connection mockup to utilize card space and add immersion */}
                        <div className="relative z-10 mt-6 border border-outline/35 rounded-lg p-4 bg-surface-container/30 overflow-hidden shadow-inner">
                            <div className="flex items-center justify-between gap-2 text-[10px] font-bold tracking-tight uppercase text-on-surface-variant/50">
                                <div className="flex flex-col items-center gap-1.5 flex-1 p-2 rounded border border-outline bg-surface text-center shadow-sm">
                                    <CalendarDays size={14} className="text-primary" />
                                    <span>Timetable</span>
                                </div>
                                <div className="text-primary/30 animate-pulse text-[14px]">➔</div>
                                <div className="flex flex-col items-center gap-1.5 flex-1 p-2 rounded border border-outline bg-surface text-center shadow-sm">
                                    <BookOpen size={14} className="text-green-500" />
                                    <span>Attendance</span>
                                </div>
                                <div className="text-primary/30 animate-pulse text-[14px]">➔</div>
                                <div className="flex flex-col items-center gap-1.5 flex-1 p-2 rounded border border-outline bg-surface text-center shadow-sm">
                                    <FileText size={14} className="text-blue-500" />
                                    <span>Workspace</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-outline to-transparent opacity-60" />

            {/* ── Features Section (Bento Grid) ──────────────────────── */}
            <motion.section 
                id="features" 
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="bg-surface-container/20 py-20"
            >
                <div className="max-w-5xl mx-auto px-6">
                    <div className="text-center max-w-xl mx-auto mb-16">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Modular Capabilities</span>
                        <h2 className="text-3xl font-extrabold tracking-tight mt-2 text-on-surface">
                            Engineered for high performance.
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map((f, idx) => (
                            <div key={idx} className="p-6 rounded-lg flex flex-col premium-card">
                                <div className="w-9 h-9 rounded bg-surface-container-high border border-outline flex items-center justify-center mb-4">
                                    {f.icon}
                                </div>
                                <h3 className="text-base font-bold text-on-surface mb-2">{f.title}</h3>
                                <p className="text-xs text-on-surface-variant/60 leading-relaxed flex-1">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.section>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-outline to-transparent opacity-60" />

            {/* ── Why Zenith / Outcomes Section ─────────────────────── */}
            <motion.section 
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="py-20 max-w-5xl mx-auto px-6 text-center"
            >
                <div className="max-w-xl mx-auto mb-12">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Student Benefits</span>
                    <h2 className="text-3xl font-extrabold tracking-tight mt-2 text-on-surface">
                        Outcomes that matter.
                    </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="flex flex-col items-center p-6 rounded-lg premium-card">
                        <h3 className="text-3xl font-black text-on-surface mb-2">0%</h3>
                        <h4 className="text-sm font-bold text-on-surface mb-1">Unforeseen Shortages</h4>
                        <p className="text-xs text-on-surface-variant/60 max-w-[240px] text-center">
                            Receive warnings and calculate needed attendance days before it affects your exam registration.
                        </p>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-lg premium-card">
                        <h3 className="text-3xl font-black text-on-surface mb-2">150ms</h3>
                        <h4 className="text-sm font-bold text-on-surface mb-1">Response Time</h4>
                        <p className="text-xs text-on-surface-variant/60 max-w-[240px] text-center">
                            Optimized composite PostgreSQL indices deliver instant loads without lag.
                        </p>
                    </div>
                    <div className="flex flex-col items-center p-6 rounded-lg premium-card sm:col-span-2 lg:col-span-1">
                        <h3 className="text-3xl font-black text-on-surface mb-2">100%</h3>
                        <h4 className="text-sm font-bold text-on-surface mb-1">Data Ownership</h4>
                        <p className="text-xs text-on-surface-variant/60 max-w-[240px] text-center">
                            Securely back up all your records to your private Google Drive folder with single-click restore.
                        </p>
                    </div>
                </div>
            </motion.section>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-outline to-transparent opacity-60" />

            {/* ── FAQ Section (Accordions) ──────────────────────────── */}
            <motion.section 
                id="faq" 
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="py-20"
            >
                <div className="max-w-3xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Common Questions</span>
                        <h2 className="text-3xl font-extrabold tracking-tight mt-2 text-on-surface">Frequently Asked Questions</h2>
                    </div>

                    <div className="border border-outline rounded-lg bg-surface divide-y divide-outline overflow-hidden shadow-sm">
                        {faqs.map((faq, idx) => {
                            const isOpen = !!faqOpen[idx];
                            return (
                                <div key={idx} className="w-full text-left">
                                    <button
                                        onClick={() => toggleFaq(idx)}
                                        className="w-full px-6 py-4 flex items-center justify-between font-bold text-sm text-on-surface hover:bg-surface-container/30 transition-colors"
                                    >
                                        <span>{faq.q}</span>
                                        <ChevronDown size={16} className={`text-on-surface-variant/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    <AnimatePresence initial={false}>
                                        {isOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden bg-surface-container/10"
                                            >
                                                <p className="px-6 pb-4 pt-1 text-xs text-on-surface-variant/70 leading-relaxed">
                                                    {faq.a}
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.section>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-outline to-transparent opacity-60" />

            {/* ── Final CTA Section ─────────────────────────────────── */}
            <motion.section 
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="bg-surface-container/20 py-20 text-center relative overflow-hidden"
            >
                {/* Ambient glow container */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] bg-primary/5 rounded-full blur-[80px] pointer-events-none -z-10" />

                <div className="max-w-4xl mx-auto px-6 flex flex-col items-center">
                    <h2 className="text-3xl md:text-5xl font-extrabold tracking-tighter text-on-surface mb-4">
                        Take control of your semester.
                    </h2>
                    <p className="text-sm md:text-base text-on-surface-variant/70 max-w-xl leading-relaxed mb-8">
                        Start organizing your academic life with Zenith. Free, open, and optimized for student workflows.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <Link to="/login" className="w-full sm:w-auto">
                            <Button variant="filled" size="lg" className="w-full justify-center">Create Free Account</Button>
                        </Link>
                        <Link to="/login" className="w-full sm:w-auto">
                            <Button variant="outlined" size="lg" className="w-full justify-center">Sign In</Button>
                        </Link>
                    </div>
                </div>
            </motion.section>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-outline to-transparent opacity-60" />

            {/* ── Footer ────────────────────────────────────────────── */}
            <footer className="bg-surface py-10">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center border border-outline/10">
                            <img src="/zenith-logo.png" alt="" className="w-4.5 h-4.5 object-contain invert dark:invert-0" />
                        </div>
                        <span className="font-bold text-xs tracking-tight text-on-surface">Zenith</span>
                    </div>

                    <p className="text-[10px] text-on-surface-variant/40 font-medium">
                        &copy; {getCopyrightYears(2025)} Zenith &mdash; made something cool by{' '}
                        <a 
                            href="https://kuberbassi.com" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="glow-link font-semibold transition-all duration-300 hover:text-primary"
                        >
                            Kuber Bassi
                        </a>
                    </p>

                    <div className="flex gap-4">
                        <a href="/terms" className="text-[10px] text-on-surface-variant/40 hover:text-on-surface hover:underline transition-colors font-medium">Terms</a>
                        <a href="/privacy" className="text-[10px] text-on-surface-variant/40 hover:text-on-surface hover:underline transition-colors font-medium">Privacy</a>
                    </div>
                </div>
            </footer>

        </div>
    );
};

export default Landing;
