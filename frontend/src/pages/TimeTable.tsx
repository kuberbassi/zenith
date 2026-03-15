import React, { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
    Clock, LayoutGrid, List, Plus, Edit3, ShieldCheck
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { attendanceService } from '@/services/attendance.service';
import api from '@/services/api';
import { useSemester } from '@/contexts/SemesterContext';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import SlotModal from '@/components/modals/SlotModal';
import StructureModal from '@/components/modals/StructureModal';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const normalizeId = (value: unknown) => (value === null || value === undefined ? '' : String(value).trim());

const findSubjectForSlot = (subjects: any[], slot: any) => {
    const slotSubjectId = normalizeId(slot?.subject_id || slot?.subjectId || slot?.subject?._id || slot?.subject?.id);
    if (slotSubjectId) {
        const matchedById = subjects.find((sub: any) => normalizeId(sub._id || sub.id) === slotSubjectId);
        if (matchedById) return matchedById;
    }

    const subjectField = slot?.subject;
    if (typeof subjectField === 'string' && subjectField.trim()) {
        const needle = subjectField.trim().toLowerCase();
        const matchedByName = subjects.find((sub: any) => String(sub?.name || '').trim().toLowerCase() === needle);
        if (matchedByName) return matchedByName;
    }

    if (subjectField && typeof subjectField === 'object') {
        const subObj = subjectField as Record<string, unknown>;
        const objId = normalizeId(subObj._id || subObj.id);
        if (objId) {
            const matchedByObjId = subjects.find((sub: any) => normalizeId(sub._id || sub.id) === objId);
            if (matchedByObjId) return matchedByObjId;
        }
        const objName = String(subObj.name || '').trim().toLowerCase();
        if (objName) {
            const matchedByObjName = subjects.find((sub: any) => String(sub?.name || '').trim().toLowerCase() === objName);
            if (matchedByObjName) return matchedByObjName;
        }
    }

    const slotLabel = String(
        slot?.label
        || slot?.subject_name
        || slot?.subjectName
        || slot?.name
        || slot?.subject?.name
        || slot?.subject?.code
        || ''
    ).trim().toLowerCase();
    if (!slotLabel) return undefined;

    return subjects.find((sub: any) => {
        const subName = String(sub?.name || '').trim().toLowerCase();
        const subCode = String(sub?.code || '').trim().toLowerCase();
        
        if (subName === slotLabel || subCode === slotLabel) return true;
        
        const acronym = subName.split(/\s+/).map(w => w[0]).join('');
        if (acronym === slotLabel) return true;
        
        if (subName.includes(slotLabel) || subCode.includes(slotLabel) || slotLabel.includes(subCode)) return true;

        return false;
    });
};

const parseTimeForSort = (time12h: string) => {
    if (!time12h) return 0;
    try {
        const parts = time12h.split(' ');
        const time = parts[0];
        const modifier = parts[1] || '';
        let [hours, minutes] = time.split(':');
        let h = parseInt(hours, 10);
        if (modifier) {
            if (h === 12) h = 0;
            if (modifier.toLowerCase() === 'pm') h += 12;
        }
        return h * 60 + parseInt(minutes, 10);
    } catch { return 0; }
};

const normalizeTimeMatch = (t: string) => {
    if (!t) return '';
    try {
        const parts = t.trim().split(' ');
        if (parts.length === 1 && t.includes(':')) {
            let [hours, minutes] = t.split(':');
            let h = parseInt(hours, 10);
            let ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h.toString().padStart(2, '0')}:${minutes} ${ampm}`;
        }
        return t.trim().toUpperCase();
    } catch { return t.trim(); }
};

const TimeTable: React.FC = () => {
    const { currentSemester } = useSemester();
    const { showToast } = useToast();
    const [timetable, setTimetable] = useState<any>({});
    const [subjects, setSubjects] = useState<any[]>([]);
    const [periods, setPeriods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'grid' | 'list'>(() => (localStorage.getItem('acadhub_timetable_view') as 'grid' | 'list') || 'grid');

    const handleSetView = (v: 'grid' | 'list') => { setView(v); localStorage.setItem('acadhub_timetable_view', v); api.post('/api/profile/preferences', { timetable_view: v }).catch(() => {}); };

    usePageMeta({
        title: 'Timetable | AcadHub',
        description: 'View and manage your weekly class schedule. Customize periods and subjects per semester.',
    });

    // Modal state
    const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
    const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<any>(null);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<any>(null);

    useEffect(() => {
        fetchData();
    }, [currentSemester]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await attendanceService.getTimetable(currentSemester);
            const subjectsData = await attendanceService.getSubjects(currentSemester);
            setTimetable(data.schedule || {});
            setPeriods(data.periods || []);
            setSubjects(subjectsData || []);
        } catch (error) {
            console.error('Failed to load timetable', error);
            showToast('error', 'Sync Disruption');
        } finally {
            setLoading(false);
        }
    };

    const handleAddSlot = (day: string, period: any) => {
        setSelectedSlot(null);
        setSelectedDay(day);
        setSelectedPeriod(period);
        setIsSlotModalOpen(true);
    };

    const handleEditSlot = (slot: any) => {
        setSelectedSlot(slot);
        setSelectedDay(slot.day);
        setSelectedPeriod(periods.find((p: any) => p.startTime === slot.start_time));
        setIsSlotModalOpen(true);
    };

    return (
        <div className="pb-32 max-w-[1600px] mx-auto px-4 lg:px-8">
            {/* ── Cinematic Hero ────────────────────────────────────────── */}
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mb-12 relative rounded-[3rem] border border-white/[0.06] bg-[#0a0a0a] p-10 md:p-14 overflow-hidden shadow-2xl" style={{ boxShadow: '0 0 100px rgba(59,130,246,0.05), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                <div className="absolute top-0 right-0 w-[800px] h-[400px] bg-blue-500/[0.03] blur-[150px] pointer-events-none" />
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-12">
                    <div className="text-center lg:text-left">
                        <div className="flex items-center justify-center lg:justify-start gap-6 mb-6">
                            <div className="w-16 h-16 rounded-[2rem] bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/10">
                                <Clock size={32} />
                            </div>
                            <div>
                                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase leading-none mb-1">Weekly Mission</h1>
                                <div className="flex items-center justify-center lg:justify-start gap-3 text-blue-400/60 font-mono text-[10px] uppercase tracking-[0.3em] font-black">
                                    <ShieldCheck size={14} className="animate-pulse" />
                                    Synchronized // Sector {currentSemester}
                                </div>
                            </div>
                        </div>
                        <p className="text-white/30 font-bold text-xs md:text-sm tracking-[0.15em] uppercase max-w-xl leading-relaxed">Optimization of temporal resources for maximum cognitive output across the institutional grid.</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-4">
                        <div className="flex bg-[#050508] p-1.5 rounded-2xl border border-white/[0.04]">
                            <button onClick={() => handleSetView('grid')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'grid' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-white/20 hover:text-white/40'}`}>
                                <LayoutGrid size={14} className="inline mr-2" /> Grid
                            </button>
                            <button onClick={() => handleSetView('list')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'list' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-white/20 hover:text-white/40'}`}>
                                <List size={14} className="inline mr-2" /> Sequence
                            </button>
                        </div>
                        <Button variant="outlined" onClick={() => setIsStructureModalOpen(true)} className="h-14 px-8 rounded-2xl border-white/[0.08] text-white font-black tracking-widest uppercase text-[10px] hover:bg-white/[0.02] shadow-xl">
                            Calibration
                        </Button>
                    </div>
                </div>
            </motion.div>

            {loading ? (
                <div className="flex justify-center py-40"><LoadingSpinner /></div>
            ) : view === 'grid' ? (
                <div className="pb-10">
                    <div className="bg-[#0a0a0a] rounded-2xl border border-white/[0.06] overflow-hidden" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}>
                        <div className="grid grid-cols-[60px_repeat(5,_1fr)]">
                            <div className="h-10 flex items-center justify-center text-[9px] font-black text-white/20 uppercase tracking-widest border-b border-r border-white/[0.06] bg-white/[0.02]"></div>
                            {DAYS.map(day => (
                                <div key={day} className="h-10 flex items-center justify-center text-[10px] font-black text-white/50 tracking-widest uppercase border-b border-r border-white/[0.06] bg-white/[0.02] last:border-r-0">{day.slice(0, 3)}</div>
                            ))}

                            {periods.map((period: any) => (
                                <React.Fragment key={period.id}>
                                    <div className="flex flex-col justify-center items-center px-1 py-2 border-b border-r border-white/[0.06] bg-white/[0.01]">
                                        <span className="text-blue-400 font-black text-[9px] leading-none tracking-tight">{period.name}</span>
                                        <span className="text-[8px] font-bold text-white/25 mt-0.5 leading-none">{period.startTime}</span>
                                    </div>
                                    {DAYS.map(day => {
                                        const daySlots = timetable[day] || [];
                                        const slot = daySlots.find((s: any) => normalizeTimeMatch(s.start_time) === normalizeTimeMatch(period.startTime));
                                        const subject = slot ? findSubjectForSlot(subjects, slot) : undefined;
                                        const isBreak = slot?.type?.toLowerCase() === 'break';

                                        return (
                                            <div key={`${day}-${period.id}`} className="min-h-[72px] border-b border-r border-white/[0.06] last:border-r-0 p-0.5">
                                                {slot ? (
                                                    <motion.div onClick={() => handleEditSlot(slot)} whileHover={{ scale: 1.02 }} className={`h-full w-full rounded-lg p-2 flex flex-col justify-center items-center text-center cursor-pointer transition-all ${isBreak ? 'bg-white/[0.02] opacity-40 hover:opacity-60' : 'bg-blue-500/5 hover:bg-blue-500/10'}`}>
                                                        <span className={`text-[7px] font-bold uppercase tracking-wider opacity-60 ${isBreak ? 'text-white/40' : 'text-blue-400'}`}>{slot.type}</span>
                                                        <span className={`text-[10px] font-black uppercase tracking-tight leading-tight mt-0.5 ${isBreak ? 'text-white/40' : 'text-white'}`}>{subject?.name || slot.subject_name || slot.subjectName || slot.label || slot.name || (isBreak ? 'Break' : '—')}</span>
                                                        {slot.classroom && <span className="text-[7px] font-bold text-white/15 uppercase tracking-wider mt-0.5 leading-none">{slot.classroom}</span>}
                                                    </motion.div>
                                                ) : (
                                                    <button onClick={() => handleAddSlot(day, period)} className="h-full w-full rounded-lg hover:bg-white/[0.02] transition-all flex items-center justify-center group">
                                                        <Plus size={14} className="text-white/5 group-hover:text-blue-500/40 transition-colors" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-12">
                    {DAYS.map(day => (
                        <div key={day} className="space-y-6">
                            <div className="flex items-center gap-4 px-4">
                                <h2 className="text-xl font-black text-white uppercase tracking-[0.3em]">{day}</h2>
                                <div className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {([...(timetable[day] || [])]).sort((a: any, b: any) => parseTimeForSort(a.start_time) - parseTimeForSort(b.start_time)).map((slot: any, idx: number) => {
                                    const subject = findSubjectForSlot(subjects, slot);
                                    return (
                                        <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} onClick={() => handleEditSlot(slot)} className="p-6 rounded-[2rem] border border-white/[0.06] bg-[#0a0a0a] flex items-center justify-between group hover:border-blue-500/20 transition-all shadow-xl">
                                            <div className="flex items-center gap-6">
                                                <div className="w-14 h-14 rounded-2xl bg-white/5 flex flex-col items-center justify-center border border-white/5 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-all">
                                                    <span className="text-[10px] font-black text-white/40 group-hover:text-blue-400 transition-colors uppercase tracking-tighter leading-none">{slot.start_time}</span>
                                                    <div className="w-4 h-px bg-white/10 my-1 group-hover:bg-blue-500/20" />
                                                    <span className="text-[10px] font-black text-white/40 group-hover:text-blue-400 transition-colors uppercase tracking-tighter leading-none">{slot.end_time}</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{slot.type}</span>
                                                        {slot.classroom && (
                                                            <>
                                                                <span className="h-1 w-1 rounded-full bg-white/10" />
                                                                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{slot.classroom}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <h3 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors">{subject?.name || slot.subject_name || slot.subjectName || slot.label || slot.name || (slot.type?.toLowerCase() === 'break' ? 'Rest Interval' : 'Operational Unit')}</h3>
                                                </div>
                                            </div>
                                            <Edit3 size={16} className="text-white/10 group-hover:text-blue-500 transition-colors" />
                                        </motion.div>
                                    );
                                })}
                                {(!timetable[day] || timetable[day].length === 0) && (
                                    <div className="col-span-full py-12 text-center rounded-[2rem] border border-dashed border-white/[0.04] bg-[#050508]/40">
                                        <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.4em]">No operations scheduled</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <AnimatePresence>
                {isSlotModalOpen && (
                    <SlotModal
                        isOpen={isSlotModalOpen}
                        onClose={() => setIsSlotModalOpen(false)}
                        onSuccess={fetchData}
                        slot={selectedSlot}
                        day={selectedDay}
                        period={selectedPeriod}
                        subjects={subjects}
                        semester={currentSemester}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isStructureModalOpen && (
                    <StructureModal
                        isOpen={isStructureModalOpen}
                        onClose={() => setIsStructureModalOpen(false)}
                        onSuccess={fetchData}
                        currentPeriods={periods}
                        semester={currentSemester}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default TimeTable;
