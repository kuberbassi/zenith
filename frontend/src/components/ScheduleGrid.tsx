import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '@/components/ui/GlassCard';
import type { TimetableSlot, GridPeriod } from '@/types';

interface ScheduleGridProps {
    timetable: Record<string, TimetableSlot[]>;
    subjects: any[];
    onEdit: (slot: TimetableSlot) => void;
    onDelete: (id: string) => void;
    onAdd: (day: string, period: GridPeriod) => void;
    periods: GridPeriod[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Helper to check if a slot overlaps/belongs to a period
const isSlotInPeriod = (slot: TimetableSlot, period: GridPeriod) => {
    const getMinutes = (t: string) => {
        if (!t) return -1;
        const [time, modifier] = t.split(' ');
        let [h, m] = time.split(':', 2).map(Number);
        if (isNaN(h) || isNaN(m)) return -1;
        if (modifier === 'PM' && h < 12) h += 12;
        if (modifier === 'AM' && h === 12) h = 0;
        return h * 60 + m;
    };

    const slotStart = getMinutes(slot.start_time);
    const pStart = getMinutes(period.startTime);

    // Robust match: Start times within 5 mins of each other
    return Math.abs(slotStart - pStart) < 5;
};

const ScheduleGrid: React.FC<ScheduleGridProps> = ({
    timetable,
    subjects,
    onEdit,
    onDelete,
    onAdd,
    periods
}) => {

    const getSubjectName = (id: string) => {
        const subject = subjects.find(s => String(s.id || s._id) === String(id));
        return subject?.name || 'Unknown';
    };



    return (
        <GlassCard className="p-0 overflow-hidden">
            <div className="p-6 overflow-x-auto">
                <div className="min-w-max">
                    {/* Header Rows */}
                    <div className="flex gap-2 mb-4">
                        {/* Corner */}
                        <div className="w-[100px] shrink-0 text-on-surface-variant/50 font-bold text-xs uppercase tracking-wide place-self-end pb-2">
                            Day / Time
                        </div>

                        {/* Columns */}
                        {periods.map((period) => (
                            <div key={period.id} className="flex-1 min-w-0 flex flex-col items-center justify-end pb-2 border-b border-outline-variant/10">
                                <div className="text-sm font-bold text-primary mb-1.5">{period.name}</div>
                                <div className="flex flex-col items-center text-[10px] font-medium text-on-surface-variant/70 leading-tight">
                                    <span>{period.startTime}</span>
                                    <span className="h-3 w-[1px] bg-outline-variant/20 my-0.5 transform rotate-12"></span>
                                    <span>{period.endTime}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Days Rows */}
                    <div className="space-y-3">
                        {DAYS.map((day) => {
                            const daySlots = timetable[day] || [];

                            return (
                                <div key={day} className="flex gap-2 items-stretch h-20">
                                    {/* Day Label */}
                                    <div className="w-[100px] shrink-0 flex items-center font-bold text-sm text-on-surface-variant uppercase tracking-wider">
                                        {day.slice(0, 3)}
                                    </div>

                                    {/* Period Cells */}
                                    {periods.map((period) => {
                                        // Find if there is a slot in this day for this period
                                        const slot = daySlots.find(s => isSlotInPeriod(s, period));



                                        return (
                                            <div
                                                key={period.id}
                                                className="flex-1 min-w-0 relative group"
                                                onClick={() => !slot && onAdd(day, period)}
                                            >
                                                {/* Empty State / Add Placeholder */}
                                                {!slot && (
                                                    <div className="absolute inset-0 rounded-lg bg-surface-container-low/50 border border-outline-variant/10 hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                                                            <span className="text-lg leading-none">+</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Active Slot */}
                                                <AnimatePresence>
                                                    {slot && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            className={`absolute inset-0.5 rounded-lg border flex flex-col justify-center px-1 cursor-pointer transition-colors overflow-hidden group/slot
                                                            ${slot.type === 'break' ? 'bg-orange-500/10 border-orange-500/20' :
                                                                    slot.type === 'free' ? 'bg-green-500/10 border-green-500/20' :
                                                                        slot.type === 'custom' ? 'bg-purple-500/10 border-purple-500/20' :
                                                                            'bg-primary/20 hover:bg-primary/30 border-primary/30'}`
                                                            }
                                                            onClick={(e) => { e.stopPropagation(); onEdit(slot); }}
                                                        >
                                                            <div className="font-bold text-xs truncate text-center text-on-surface w-full">
                                                                {slot.type === 'break' ? 'Break' :
                                                                    slot.type === 'free' ? 'Free' :
                                                                        slot.type === 'custom' ? (slot.label || 'Custom') :
                                                                            getSubjectName(slot.subject_id || '')}
                                                            </div>
                                                            {slot.type === 'class' && (
                                                                <div className="text-[10px] text-on-surface-variant/80 text-center truncate w-full px-1">
                                                                    {slot.label || ''}
                                                                </div>
                                                            )}

                                                            {/* Delete Overlay */}
                                                            <div className="absolute top-1 right-1 opacity-0 group-hover/slot:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); const deleteId = slot._id || slot.id; if (deleteId) onDelete(deleteId); }}
                                                                    className="p-1 rounded bg-error/10 text-error hover:bg-error hover:text-white transition-colors"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </GlassCard>
    );
};

export default ScheduleGrid;
