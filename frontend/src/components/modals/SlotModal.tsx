import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { attendanceService } from '@/services/attendance.service';
import type { TimetableSlot } from '@/types';

interface SlotModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    slot: TimetableSlot | null;
    day: string | null;
    period: any | null;
    subjects: any[];
    semester: number;
}

const SlotModal: React.FC<SlotModalProps> = ({ isOpen, onClose, onSuccess, slot, day, period, subjects, semester }) => {
    const [formData, setFormData] = useState<Partial<TimetableSlot>>({
        type: 'class',
        subject_id: '',
        label: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (slot) {
            setFormData({
                type: slot.type || 'class',
                subject_id: slot.subject_id?.$oid || slot.subject_id || '',
                label: slot.label || ''
            });
        } else {
            setFormData({ type: 'class', subject_id: '', label: '' });
        }
    }, [slot, isOpen]);

    const handleSave = async () => {
        try {
            setLoading(true);
            const slotData = {
                ...formData,
                day: day || slot?.day,
                start_time: period?.startTime || slot?.start_time,
                end_time: period?.endTime || slot?.end_time,
                semester
            };

            if (slot?._id || slot?.id) {
                await attendanceService.updateTimetableSlot(slot._id || slot.id!, slotData, semester);
            } else {
                await attendanceService.addTimetableSlot(slotData, semester);
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to save slot', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        const slotId = slot?._id || slot?.id;
        if (!slotId) return;
        try {
            setLoading(true);
            await attendanceService.deleteTimetableSlot(slotId, semester);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Failed to delete slot', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-[#0a0a0a] rounded-[2.5rem] border border-white/[0.06] p-8 md:p-10 shadow-2xl">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                                <Clock size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">{slot ? 'Recalibrate Sequence' : 'Initiate Sequence'}</h3>
                                <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">{day} // {period?.startTime || slot?.start_time}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <Select label="Type" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as any })} options={[
                                    { value: 'class', label: 'Class' },
                                    { value: 'break', label: 'Break' },
                                    { value: 'free', label: 'Free' },
                                    { value: 'custom', label: 'Custom' }
                                ]} />
                                {formData.type === 'class' ? (
                                    <Select label="Subject" value={formData.subject_id} onChange={e => setFormData({ ...formData, subject_id: e.target.value })} options={subjects.map(s => ({ value: s._id, label: s.name }))} />
                                ) : (
                                    <Input label="Label" value={formData.label} onChange={e => setFormData({ ...formData, label: e.target.value })} placeholder="Mission Objective" />
                                )}
                            </div>

                            <div className="flex gap-3 pt-6">
                                {slot && (
                                    <Button variant="outlined" onClick={handleDelete} className="w-14 h-14 rounded-2xl border-white/[0.06] text-red-500 hover:bg-red-500/10 transition-all">
                                        <Trash2 size={20} />
                                    </Button>
                                )}
                                <Button variant="outlined" onClick={onClose} className="flex-1 h-14 rounded-2xl border-white/10 text-white font-black uppercase tracking-widest text-[10px]">Abort</Button>
                                <Button onClick={handleSave} isLoading={loading} className="flex-[2] h-14 rounded-2xl bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-500/20">Commit</Button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SlotModal;
