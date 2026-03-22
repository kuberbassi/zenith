import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import Sparkles from '@/components/ui/Sparkles';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AttendanceModal from '@/components/modals/AttendanceModal';
import { attendanceService } from '@/services/attendance.service';
import { useSemester } from '@/contexts/SemesterContext';
import { useToast } from '@/components/ui/Toast';

interface AttendanceRecord {
    date: string;
    subject_id: string;
    subject_name: string;
    status: 'present' | 'absent';
}

const Calendar: React.FC = () => {
    const { showToast } = useToast();
    const { currentSemester } = useSemester();
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [attendanceData, setAttendanceData] = useState<Record<string, AttendanceRecord[]>>({});
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
    const fetchToken = React.useRef(0);

    usePageMeta({
        title: 'Calendar | AcadHub',
        description: 'View and mark your daily attendance on a calendar. Log present, absent, or cancelled classes.',
    });

    useEffect(() => { loadData(); }, [currentDate, currentSemester]);

    const loadData = async (showLoading = true) => {
        const token = ++fetchToken.current;
        try {
            if (showLoading) setLoading(true);
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const calendarData = await attendanceService.getCalendarData(year, month, currentSemester);

            if (token !== fetchToken.current) return;

            const dataMap: Record<string, AttendanceRecord[]> = {};
            if (Array.isArray(calendarData)) {
                calendarData.forEach((log: any) => {
                    const date = log.date;
                    if (!dataMap[date]) dataMap[date] = [];
                    dataMap[date].push(log);
                });
            }
            setAttendanceData(dataMap);
        } catch (error) {
            console.error(error);
            showToast('error', 'Sync Failed');
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        let startingDayOfWeek = firstDay.getDay() - 1;
        if (startingDayOfWeek === -1) startingDayOfWeek = 6;
        return { daysInMonth, startingDayOfWeek, year, month };
    };

    const getAttendanceForDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return attendanceData[`${year}-${month}-${day}`] || [];
    };

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

    const handleDayClick = (day: number) => {
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        setSelectedDate(clickedDate);
        setIsMarkModalOpen(true);
    };

    const handleLogsUpdate = React.useCallback((dateStr: string, logs: any[]) => {
        setAttendanceData(prev => ({ ...prev, [dateStr]: logs }));
    }, []);

    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
    const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    if (loading) return <LoadingSpinner fullScreen />;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto pb-32">

            {/* ── Cinematic Hero ────────────────────────────────────────── */}
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-12 relative rounded-[2.5rem] border border-white/[0.06] glass-panel p-8 md:p-12 overflow-hidden shadow-2xl" style={{ boxShadow: '0 0 80px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-white/10/[0.02] blur-[150px] pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-4 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white border border-white/10 shadow-lg shadow-white/5">
                                <CalendarIcon size={24} />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase">Operational Grid</h1>
                        </div>
                        <p className="text-white/30 font-bold text-xs md:text-sm tracking-[0.2em] uppercase max-w-md">Temporal mapping of academic engagements and attendance protocols.</p>
                    </div>

                    <div className="flex items-center gap-2 p-2 rounded-2xl glass-panel border border-white/[0.04] shadow-[inset_0_1px_10px_rgba(255,255,255,0.02)]">
                        <button onClick={handlePrevMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"><ChevronLeft size={18} /></button>
                        <div className="px-6 text-center min-w-[180px]">
                            <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">{currentDate.getFullYear()}</p>
                            <p className="text-lg font-black text-white tracking-widest uppercase">{currentDate.toLocaleString('default', { month: 'long' })}</p>
                        </div>
                        <button onClick={handleNextMonth} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"><ChevronRight size={18} /></button>
                    </div>
                </div>
            </motion.div>

            {/* ── Calendar Grid ─────────────────────────────────────────── */}
            <div className="rounded-[2.5rem] border border-white/[0.06] glass-panel p-4 md:p-8 relative overflow-hidden shadow-2xl" style={{ boxShadow: '0 40px 100px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-6">
                    {weekDays.map(day => (
                        <div key={day} className="text-center text-[10px] font-black text-white/20 uppercase tracking-[0.3em] py-2">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2 md:gap-4 lg:gap-6">
                    {/* Empty Slots */}
                    {Array.from({ length: startingDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square opacity-0" />
                    ))}

                    {/* Days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const date = new Date(year, month, day);
                        const attendance = getAttendanceForDate(date);
                        const isToday = new Date().toDateString() === date.toDateString();
                        const present = attendance.filter(a => a.status === 'present');
                        const absent = attendance.filter(a => a.status === 'absent');
                        const total = attendance.length;

                        return (
                            <motion.button
                                key={day}
                                whileHover={{ scale: 1.05, y: -4 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDayClick(day)}
                                className={`aspect-square rounded-2xl md:rounded-3xl p-2 md:p-4 relative flex flex-col items-center justify-center transition-all border ${isToday
                                    ? 'bg-white/5 border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.15)] z-10'
                                    : total > 0
                                        ? 'bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.04]'
                                        : 'bg-transparent border-transparent hover:bg-white/[0.01] hover:border-white/[0.04]'
                                    }`}
                            >
                                <span className={`text-base md:text-2xl font-black ${isToday ? 'text-white' : 'text-white/80'}`}>
                                    {day}
                                </span>

                                <div className="absolute bottom-2 md:bottom-4 flex flex-wrap justify-center gap-1 px-1">
                                    {present.slice(0, 4).map((_, idx) => (
                                        <div key={`p-${idx}`} className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                                    ))}
                                    {absent.slice(0, 4).map((_, idx) => (
                                        <div key={`a-${idx}`} className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                                    ))}
                                    {total > 8 && <Sparkles size={8} className="text-white/20" />}
                                </div>
                            </motion.button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="mt-12 pt-8 border-t border-white/[0.04] flex flex-wrap justify-center gap-10">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Present Scan</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Absent Signal</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-3 py-1 rounded-lg border border-white/20 bg-white/5 text-[10px] font-black text-white uppercase tracking-widest">Temporal Origin</div>
                        <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">(Current Date)</span>
                    </div>
                </div>
            </div>

            <AttendanceModal 
                isOpen={isMarkModalOpen} 
                onClose={() => setIsMarkModalOpen(false)} 
                defaultDate={selectedDate || new Date()} 
                onSuccess={() => loadData(false)} 
                onLogsUpdate={handleLogsUpdate}
            />
        </motion.div >
    );
};

export default Calendar;
