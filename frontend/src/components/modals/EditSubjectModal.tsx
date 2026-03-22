import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/services/attendance.service';
import { BookOpen, User, MapPin, Hash, FileText, Save } from 'lucide-react';


interface EditSubjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    subject: any; // Accommodate SubjectOverview (id) and Subject (_id)
    onSuccess: () => void;
}

const EditSubjectModal: React.FC<EditSubjectModalProps> = ({ isOpen, onClose, subject, onSuccess }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        professor: '',
        classroom: '',
        syllabus: '',
        semester: 1,
        attended: 0,
        total: 0,
        practical_total: 10,
        assignment_total: 4
    });

    useEffect(() => {
        if (subject && isOpen) {
            setFormData({
                name: subject.name || '',
                code: subject.code || '',
                professor: subject.professor || '',
                classroom: subject.classroom || '',
                syllabus: subject.syllabus || '',
                semester: subject.semester || 1,
                attended: subject.attended || 0,
                total: subject.total || 0,
                practical_total: 10,
                assignment_total: 4
            });

            // Fetch latest details
            const id = subject.id || subject._id;

            if (id) fetchDetails(id);
        }
    }, [subject, isOpen]);

    const fetchDetails = async (id: string) => {
        try {
            const details = await attendanceService.getSubjectDetails(id);
            if (details) {
                setFormData(prev => ({
                    ...prev,
                    code: details.code || prev.code,
                    categories: details.categories || (prev as any).categories || ['Theory'],
                    professor: details.professor || prev.professor,
                    classroom: details.classroom || prev.classroom,
                    syllabus: details.syllabus || prev.syllabus,
                    semester: details.semester || prev.semester,
                    attended: details.attended ?? prev.attended,
                    total: details.total ?? prev.total,
                    practical_total: details.practicals?.total ?? 10,
                    assignment_total: details.assignments?.total ?? 4
                }));
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['attended', 'total', 'practical_total', 'assignment_total'].includes(name);
        setFormData(prev => ({ ...prev, [name]: isNumeric ? parseInt(value) || 0 : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject) return;

        setLoading(true);
        try {
            const id = subject.id || subject._id;

            await attendanceService.updateSubjectFullDetails(id, formData);

            showToast('success', 'Subject details updated successfully');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            showToast('error', 'Failed to update subject details');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Edit Subject Details"
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Subject Name */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/50 uppercase ml-1">Subject Name</label>
                    <div className="relative">
                        <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] focus:border-white/25 focus:bg-white/[0.06] focus:outline-none transition-all text-white placeholder:text-white/30"
                            placeholder="e.g. Data Structures"
                            required
                        />
                    </div>
                </div>

                {/* Categories & Code Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Categories Multi-Select */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/50 uppercase ml-1">Categories</label>
                        <div className="flex flex-wrap gap-2 p-2 bg-white/[0.02] border border-white/[0.08] rounded-2xl min-h-[46px]">
                            {['Theory', 'Practical', 'Assignment'].map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => {
                                        const current = (formData as any).categories || [];
                                        if (current.includes(cat)) {
                                            setFormData(prev => ({ ...prev, categories: current.filter((c: string) => c !== cat) }));
                                        } else {
                                            setFormData(prev => ({ ...prev, categories: [...current, cat] }));
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all
                                        ${((formData as any).categories || []).includes(cat)
                                            ? 'bg-white/7 border-white/15 text-white'
                                            : 'bg-white/[0.02] border-transparent text-white/40 hover:bg-white/[0.06] hover:text-white/70'
                                        }
                                    `}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subject Code */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/50 uppercase ml-1">Subject Code</label>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                            <input
                                type="text"
                                name="code"
                                value={formData.code}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] focus:border-white/25 focus:bg-white/[0.06] focus:outline-none transition-all text-white placeholder:text-white/30"
                                placeholder="e.g. CS-101"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Professor */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/50 uppercase ml-1">Professor</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                            <input
                                type="text"
                                name="professor"
                                value={formData.professor}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] focus:border-white/25 focus:bg-white/[0.06] focus:outline-none transition-all text-white placeholder:text-white/30"
                                placeholder="Prof. Name"
                            />
                        </div>
                    </div>

                    {/* Classroom */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-white/50 uppercase ml-1">Classroom</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                            <input
                                type="text"
                                name="classroom"
                                value={formData.classroom}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] focus:border-white/25 focus:bg-white/[0.06] focus:outline-none transition-all text-white placeholder:text-white/30"
                                placeholder="Room 301"
                            />
                        </div>
                    </div>
                </div>

                {/* Syllabus */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/50 uppercase ml-1">Syllabus / Notes</label>
                    <div className="relative">
                        <FileText className="absolute left-3 top-3 w-5 h-5 text-white/40" />
                        <textarea
                            name="syllabus"
                            value={formData.syllabus}
                            onChange={handleChange}
                            rows={3}
                            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.08] focus:border-white/25 focus:bg-white/[0.06] focus:outline-none transition-all text-white placeholder:text-white/30 resize-none"
                            placeholder="Enter syllabus topics or important notes..."
                        />
                    </div>
                </div>

                {/* Attendance Count Override */}
                <div className="p-4 rounded-2xl bg-[#2a1a0f] border border-orange-500/30">
                    <label className="text-xs font-bold text-orange-400 uppercase mb-2 block">⚠️ Manual Attendance Override</label>
                    <p className="text-xs text-white/50 mb-3">Use this to fix incorrect counts. Be careful!</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-white/50 uppercase ml-1">Classes Attended</label>
                            <input
                                type="number"
                                name="attended"
                                value={formData.attended}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-2.5 rounded-2xl bg-black/40 border border-white/[0.08] focus:border-orange-500/50 focus:outline-none transition-all text-white text-center font-bold text-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-white/50 uppercase ml-1">Total Classes</label>
                            <input
                                type="number"
                                name="total"
                                value={formData.total}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-2.5 rounded-2xl bg-black/40 border border-white/[0.08] focus:border-orange-500/50 focus:outline-none transition-all text-white text-center font-bold text-lg"
                            />
                        </div>

                        {/* Assignment & Practical Totals Override */}
                        <div className="col-span-2 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
                            <label className="text-xs font-bold text-white/60 uppercase mb-2 block">🎯 Target Totals</label>
                            <div className="grid grid-cols-2 gap-4">
                                {((formData as any).categories?.includes('Practical')) && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-white/50 uppercase ml-1">Practical Total</label>
                                        <input
                                            type="number"
                                            name="practical_total"
                                            value={(formData as any).practical_total || 10}
                                            onChange={handleChange}
                                            min="1"
                                            className="w-full px-4 py-2.5 rounded-2xl bg-black/40 border border-white/[0.08] focus:border-white/25 focus:outline-none transition-all text-white text-center font-bold text-lg"
                                        />
                                    </div>
                                )}
                                {((formData as any).categories?.includes('Assignment')) && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-white/50 uppercase ml-1">Assignment Total</label>
                                        <input
                                            type="number"
                                            name="assignment_total"
                                            value={(formData as any).assignment_total || 4}
                                            onChange={handleChange}
                                            min="1"
                                            className="w-full px-4 py-2.5 rounded-2xl bg-black/40 border border-white/[0.08] focus:border-white/25 focus:outline-none transition-all text-white text-center font-bold text-lg"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-2">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full"
                        icon={!loading && <Save size={18} />}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default EditSubjectModal;
