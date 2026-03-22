import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Settings } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { attendanceService } from '@/services/attendance.service';

const to24Hour = (time12h: string) => {
    if (!time12h) return '';
    try {
        const parts = time12h.split(' ');
        if (parts.length !== 2) return time12h;
        const [time, modifier] = parts;
        let [hours, minutes] = time.split(':');
        if (hours === '12') hours = '00';
        if (modifier.toLowerCase() === 'pm') hours = (parseInt(hours, 10) + 12).toString();
        return `${hours.padStart(2, '0')}:${minutes}`;
    } catch { return time12h; }
};

const to12Hour = (time24h: string) => {
    if (!time24h) return '';
    try {
        const parts = time24h.split(':');
        if (parts.length !== 2) return time24h;
        let [hours, minutes] = parts;
        let h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${h.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    } catch { return time24h; }
};

interface StructureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentPeriods: any[];
    semester: number;
}

const StructureModal: React.FC<StructureModalProps> = ({ isOpen, onClose, onSuccess, currentPeriods, semester }) => {
    const [periods, setPeriods] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setPeriods(currentPeriods.map(p => ({
            ...p,
            id: p.id || Math.random().toString(36).substr(2, 9),
            startTime: to24Hour(p.startTime || p.start_time || ''),
            endTime: to24Hour(p.endTime || p.end_time || '')
        })));
    }, [currentPeriods, isOpen]);

    const handleAddPeriod = () => {
        const newPeriod = { id: Math.random().toString(36).substr(2, 9), name: `Period ${periods.length + 1}`, startTime: '09:00', endTime: '10:00' };
        setPeriods([...periods, newPeriod]);
    };

    const handleRemovePeriod = (id: string) => {
        setPeriods(periods.filter(p => p.id !== id));
    };

    const handleUpdatePeriod = (id: string, field: string, value: string) => {
        setPeriods(periods.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const formattedPeriods = periods.map(p => ({
                ...p,
                startTime: to12Hour(p.startTime),
                endTime: to12Hour(p.endTime)
            }));
            await attendanceService.saveTimetableStructure(formattedPeriods, semester);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save structure', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-2xl glass-panel rounded-[2.5rem] border border-white/[0.06] p-8 md:p-12 shadow-2xl overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

                        <div className="flex items-center justify-between mb-10">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 border border-white/5">
                                    <Settings size={28} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Temporal Grid</h3>
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Institutional Calibration // Sector {semester}</p>
                                </div>
                            </div>
                            <Button onClick={handleAddPeriod} variant="outlined" className="h-12 px-6 rounded-xl border-white/[0.08] text-white font-black tracking-widest uppercase text-[10px] hover:bg-white/5">
                                Add Interval
                            </Button>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto pr-4 no-scrollbar space-y-4">
                            {periods.map((period, idx) => (
                                <motion.div key={period.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className="flex items-center gap-4 p-5 rounded-2xl glass-panel border border-white/[0.04] group hover:border-white/[0.1] transition-all">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[10px] font-black text-white/20 border border-white/5">{idx + 1}</div>
                                    <div className="flex-1 grid grid-cols-3 gap-4">
                                        <Input value={period.name} onChange={e => handleUpdatePeriod(period.id, 'name', e.target.value)} placeholder="Interval ID" className="bg-transparent border-none p-0 h-8" />
                                        <Input type="time" value={period.startTime} onChange={e => handleUpdatePeriod(period.id, 'startTime', e.target.value)} className="bg-transparent border-none p-0 h-8" />
                                        <Input type="time" value={period.endTime} onChange={e => handleUpdatePeriod(period.id, 'endTime', e.target.value)} className="bg-transparent border-none p-0 h-8" />
                                    </div>
                                    <button onClick={() => handleRemovePeriod(period.id)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/10 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                                </motion.div>
                            ))}
                            {periods.length === 0 && (
                                <div className="py-20 text-center border border-dashed border-white/[0.04] rounded-3xl">
                                    <p className="text-xs font-black text-white/10 uppercase tracking-widest">No temporal nodes detected</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-4 mt-10">
                            <Button variant="outlined" onClick={onClose} className="flex-1 h-14 rounded-2xl border-white/10 text-white font-black uppercase tracking-widest text-[10px]">Abort</Button>
                            <Button onClick={handleSave} isLoading={loading} className="flex-[2] h-14 rounded-2xl bg-white/10 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-white/10">Commit Calibration</Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default StructureModal;
