import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { useSemester } from '@/contexts/SemesterContext';
import { attendanceService } from '@/services/attendance.service';
import api from '@/services/api';
import { Check, X, MoreHorizontal, Calendar as CalendarIcon, Trash2 } from 'lucide-react';


interface AttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    // If provided, default to this date, otherwise today
    defaultDate?: Date;
    onSuccess?: () => void;
}

const AttendanceModal: React.FC<AttendanceModalProps> = ({ isOpen, onClose, defaultDate, onSuccess }) => {
    const { showToast } = useToast();
    const { currentSemester } = useSemester();
    const [selectedDate, setSelectedDate] = useState<Date>(defaultDate || new Date());
    const [loading, setLoading] = useState(false);
    const [scheduledClasses, setScheduledClasses] = useState<any[]>([]);
    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [actionInProgress, setActionInProgress] = useState(false);

    // Detailed marking state
    const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
    const [detailStatus, setDetailStatus] = useState<string>('present');
    const [detailNotes, setDetailNotes] = useState('');
    const [detailSubstitutedBy, setDetailSubstitutedBy] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setSelectedDate(defaultDate || new Date());
            loadClassesForDate(defaultDate || new Date());
            fetchAttendanceLogs(defaultDate || new Date());
        }
    }, [isOpen, defaultDate]);

    const loadClassesForDate = async (date: Date, silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Fix timezone issue: Avoid toISOString() which shifts day for regions like India
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            const [scheduled, subjects] = await Promise.all([
                attendanceService.getClassesForDate(dateStr, currentSemester),
                attendanceService.getSubjects(currentSemester)
            ]);
            setScheduledClasses(scheduled);
            setAllSubjects(subjects);
        } catch (error) {
            console.error(error);
            showToast('error', 'Failed to load classes');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDate = new Date(e.target.value);
        if (!isNaN(newDate.getTime())) {
            setSelectedDate(newDate);
            loadClassesForDate(newDate);
            fetchAttendanceLogs(newDate);
        }
    };

    const getDateStr = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const fetchAttendanceLogs = async (date: Date) => {
        try {
            const dateStr = getDateStr(date);
            // Fetch ALL logs for this date (no semester filter — we want every record for the day)
            const response = await api.get(`/api/attendance/logs?date=${dateStr}&limit=100`);

            // Backend returns success_response({"logs": [...], ...}) 
            // So response.data.data is the payload we want
            const data = response.data.data;
            setAttendanceLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to fetch attendance logs:', error);
        }
    };

    const deleteLog = async (logId: string) => {
        try {
            await attendanceService.deleteAttendance(logId);
            showToast('success', 'Log deleted');
            fetchAttendanceLogs(selectedDate);
            loadClassesForDate(selectedDate, true);
            if (onSuccess) onSuccess();
        } catch (error) {
            showToast('error', 'Failed to delete log');
        }
    };

    const markSimple = async (subject: any, status: 'present' | 'absent') => {
        if (actionInProgress) return;
        setActionInProgress(true);
        try {
            const dateStr = getDateStr(selectedDate);
            if (subject.log_id) {
                await attendanceService.editAttendance(subject.log_id, status, undefined, dateStr);
                showToast('success', `Updated to ${status}`);
            } else {
                await attendanceService.markAttendance(subject._id || subject.id, status, dateStr);
                showToast('success', `Marked ${status}`);
            }

            await loadClassesForDate(selectedDate, true);
            await fetchAttendanceLogs(selectedDate);
            if (onSuccess) onSuccess();
        } catch (error: any) {
            showToast('error', error.response?.data?.error || 'Failed to mark');
        } finally {
            setActionInProgress(false);
        }
    };

    const handleDelete = async (subject: any) => {
        if (actionInProgress) return;
        if (!subject.log_id) {
            showToast('error', 'No attendance record found to delete.');
            return;
        }
        setActionInProgress(true);
        try {
            await attendanceService.deleteAttendance(subject.log_id);
            showToast('success', 'Attendance cleared');
            await loadClassesForDate(selectedDate, true);
            await fetchAttendanceLogs(selectedDate);
            if (onSuccess) onSuccess();
        } catch (error: any) {
            showToast('error', error.response?.data?.error || 'Failed to delete');
        } finally {
            setActionInProgress(false);
        }
    };

    const submitDetailedMark = async (subject: any) => {
        try {
            const dateStr = getDateStr(selectedDate);
            const subjectId = subject._id || subject.id;

            // If substituted, ensure we selected a substitute subject
            if (detailStatus === 'substituted' && !detailSubstitutedBy) {
                showToast('error', 'Please select the substituting subject');
                return;
            }

            // Special handling for Substitution or if switching TO/FROM substitution:
            // Since editAttendance doesn't support changing substitution details easily,
            // we delete and re-mark if substitution is involved.
            // Check if backend response has log_id
            const isSubstitution = detailStatus === 'substituted' || (subject.marked_status === 'substituted');

            if (subject.log_id && !isSubstitution) {
                // Regular Edit (Status/Notes)
                await attendanceService.editAttendance(
                    subject.log_id,
                    detailStatus,
                    detailNotes,
                    dateStr
                );
                showToast('success', 'Attendance updated');
            } else {
                // New Mark OR Substitution (Delete + Mark)
                if (subject.log_id && isSubstitution) {
                    await attendanceService.deleteAttendance(subject.log_id);
                }

                await attendanceService.markAttendance(
                    subjectId,
                    detailStatus,
                    dateStr,
                    detailNotes,
                    detailStatus === 'substituted' ? detailSubstitutedBy : undefined
                );
                showToast('success', 'Attendance marked successfully');
            }

            setExpandedSubjectId(null);
            resetDetailForm();
            loadClassesForDate(selectedDate, true);
            fetchAttendanceLogs(selectedDate); // Refresh logs section
            if (onSuccess) onSuccess();
        } catch (error: any) {
            showToast('error', error.response?.data?.error || 'Failed to mark');
        }
    };

    const resetDetailForm = () => {
        setDetailStatus('present');
        setDetailNotes('');
        setDetailSubstitutedBy('');
    };

    const openDetails = (subjectId: string, currentStatus?: string, currentNotes?: string) => {
        setExpandedSubjectId(subjectId);
        // Pre-fill if needed, mostly default
        setDetailStatus(currentStatus === 'pending' ? 'present' : currentStatus || 'present');
        setDetailNotes(currentNotes || '');
        setDetailSubstitutedBy('');
    };



    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Mark Attendance"
            className="max-w-xl"
        >
            <div className="space-y-6">
                {/* Date Picker */}
                <div className="flex items-center gap-4 p-3 bg-[#111] rounded-2xl border border-white/[0.08]">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                        <CalendarIcon size={20} />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-1">
                            Date
                        </label>
                        <input
                            type="date"
                            className="bg-transparent border-none p-0 text-white font-sans font-medium focus:ring-0 w-full"
                            value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`}
                            onChange={handleDateChange}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 flex justify-center">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1 custom-scrollbar">
                        {/* Scheduled List */}
                        <div>
                            <h3 className="text-sm font-bold text-white/50 mb-3 uppercase tracking-wider">Scheduled Classes</h3>
                            {scheduledClasses.length > 0 ? (
                                <div className="space-y-3">
                                    {groupConsecutiveClasses(scheduledClasses).map((subject, idx) => {
                                        const subId = subject._id; // Is now the ID of the first slot (or merged ID logic?)
                                        return (
                                            <SubjectRow
                                                key={`scheduled-${subId}-${idx}`} // Unique key using Index
                                                subject={subject}
                                                status={subject.marked_status}
                                                expanded={expandedSubjectId === subId}
                                                // Wrapper for bulk mark
                                                onSimpleMark={(subj: any, status: string) => {
                                                    if (subject.isMerged) {
                                                        // Mark only the first slot; backend/get_classes_for_date handles the rest
                                                        const primary = subject.originalClasses[0];
                                                        markSimple(primary, status as any);
                                                    } else {
                                                        markSimple(subj, status as any);
                                                    }
                                                }}
                                                onDelete={(subj: any) => {
                                                    // Only delete the PRIMARY log — merged classes share ONE log
                                                    const primary = subj.isMerged ? subj.originalClasses[0] : subj;
                                                    if (primary.log_id) {
                                                        handleDelete(primary);
                                                    } else {
                                                        showToast('error', 'No attendance record found to delete.');
                                                    }
                                                }}
                                                onOpenDetails={(id: string, status: string) => openDetails(id, status, subject.notes)}
                                                onCloseDetails={() => setExpandedSubjectId(null)}

                                                // Detail Props
                                                detailStatus={detailStatus}
                                                setDetailStatus={setDetailStatus}
                                                detailNotes={detailNotes}
                                                setDetailNotes={setDetailNotes}
                                                detailSubstitutedBy={detailSubstitutedBy}
                                                setDetailSubstitutedBy={setDetailSubstitutedBy}
                                                allSubjects={allSubjects}
                                                onSubmitDetail={() => {
                                                    if (subject.isMerged) {
                                                        const primary = subject.originalClasses[0];
                                                        submitDetailedMark(primary);
                                                    } else {
                                                        submitDetailedMark(subject);
                                                    }
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-white/40 italic text-center py-4">No classes scheduled.</p>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="my-6 border-t border-white/[0.08]"></div>

                        {/* All Attendance Logs Section */}
                        <div>
                            <h3 className="text-sm font-bold text-white/50 mb-3 uppercase tracking-wider flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                All Marked Records ({attendanceLogs.length})
                            </h3>
                            {attendanceLogs.length > 0 ? (
                                <div className="space-y-2">
                                    {attendanceLogs.map((log: any, idx: number) => {
                                        // Robust ID Extraction Helper
                                        const getSafeId = (val: any) => {
                                            if (!val) return '';
                                            if (typeof val === 'string') return val;
                                            if (typeof val === 'object') return val.$oid || String(val);
                                            return String(val);
                                        };

                                        const logSubjectId = getSafeId(log.subject_id);

                                        // Find subject by matching robust IDs
                                        const logSubject = allSubjects.find((s: any) => {
                                            const sId = getSafeId(s._id || s.id);
                                            return sId === logSubjectId;
                                        });

                                        const statusColors: any = {
                                            'present': 'text-green-400 bg-green-500/10',
                                            'absent': 'text-red-400 bg-red-500/10',
                                            'late': 'text-orange-400 bg-orange-500/10',
                                            'medical': 'text-blue-400 bg-blue-500/10',
                                            'approved_medical': 'text-blue-400 bg-blue-500/10',
                                            'cancelled': 'text-white/60 bg-white/5',
                                            'substituted': 'text-purple-400 bg-purple-500/10'
                                        };
                                        const statusColor = statusColors[log.status] || 'text-white/60 bg-white/5';

                                        const logId = getSafeId(log._id);

                                        return (
                                            <div
                                                key={`log-entry-${logId}-${idx}`}
                                                className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/[0.08]"
                                            >
                                                <div className="flex-1">
                                                    <div className="font-semibold text-sm text-white/90">{log.subject_name || log.subject_info?.name || logSubject?.name || 'Unknown Subject'}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${statusColor}`}>
                                                            {String(log.status).toUpperCase()}
                                                        </span>
                                                        {log.notes && (
                                                            <span className="text-xs text-white/50">• {log.notes}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const subName = log.subject_name || log.subject_info?.name || logSubject?.name || 'this subject';
                                                        if (confirm(`Delete this ${log.status} entry for ${subName}?`)) {
                                                            deleteLog(logId);
                                                        }
                                                    }}
                                                    className="p-2 hover:bg-red-500/10 rounded-xl transition-colors"
                                                    title="Delete this log entry"
                                                >
                                                    <Trash2 size={18} className="text-red-400" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-2 opacity-50">📋</div>
                                    <p className="text-sm text-white/40 italic">No attendance marked for this date</p>
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </Modal>
    );
};

const SubjectRow = ({
    subject, status, expanded, onSimpleMark, onDelete, onOpenDetails, onCloseDetails,
    detailStatus, setDetailStatus, detailNotes, setDetailNotes, detailSubstitutedBy, setDetailSubstitutedBy, allSubjects, onSubmitDetail
}: any) => {

    const isMarked = status && status !== 'pending';

    if (expanded) {
        return (
            <div className="bg-[#111] rounded-2xl p-4 border border-white/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                <div className="flex justify-between items-center mb-4 border-b border-white/[0.08] pb-3">
                    <h4 className="font-bold text-white/90">{subject.name}</h4>
                    <button onClick={onCloseDetails} className="text-white/40 hover:text-white/80 p-1 rounded-xl hover:bg-white/[0.06] transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Status Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'present', label: 'Present', color: 'bg-green-500/15 text-green-400 border border-green-500/30' },
                            { id: 'absent', label: 'Absent', color: 'bg-red-500/15 text-red-400 border border-red-500/30' },
                            { id: 'medical', label: 'Medical Leave', color: 'bg-blue-500/15 text-blue-400 border border-blue-500/30' }, // Map to approved_medical
                            { id: 'cancelled', label: 'Cancelled', color: 'bg-white/10 text-white/70 border border-white/20' },
                            { id: 'substituted', label: 'Substituted', color: 'bg-purple-500/15 text-purple-400 border border-purple-500/30' },
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setDetailStatus(opt.id === 'medical' ? 'approved_medical' : opt.id)}
                                className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${(detailStatus === opt.id || (opt.id === 'medical' && detailStatus === 'approved_medical'))
                                    ? opt.color
                                    : 'bg-white/[0.02] border border-transparent text-white/40 hover:bg-white/[0.06] hover:text-white/70'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Substitution Dropdown */}
                    {detailStatus === 'substituted' && (() => {
                        const filteredSubjects = allSubjects.filter((s: any) => {
                            const sId = String(s._id || s.id);
                            const currentId = String(subject._id || subject.id);
                            return sId !== currentId;
                        });
                        const selectedSub = filteredSubjects.find((s: any) => {
                            const rawId = s._id || s.id;
                            const sId = (rawId && typeof rawId === 'object' && rawId.$oid) ? rawId.$oid : String(rawId);
                            return sId === detailSubstitutedBy;
                        });
                        return (
                            <div className="animate-fade-in p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                                <label className="text-xs font-bold text-purple-400 uppercase block mb-2">
                                    Substituted By
                                </label>
                                <SubstitutionDropdown
                                    subjects={filteredSubjects}
                                    value={detailSubstitutedBy}
                                    selectedName={selectedSub?.name}
                                    onChange={setDetailSubstitutedBy}
                                />
                            </div>
                        );
                    })()}

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-semibold text-white/50 uppercase block mb-1">
                            Notes (Optional)
                        </label>
                        <textarea
                            className="w-full bg-white/[0.02] border border-white/[0.08] focus:border-blue-500/50 focus:bg-white/[0.06] rounded-xl p-3 text-sm resize-none text-white placeholder:text-white/30 focus:outline-none transition-all"
                            placeholder="Add details..."
                            rows={2}
                            value={detailNotes}
                            onChange={(e) => setDetailNotes(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2">
                        {isMarked && (
                            <Button variant="ghost" className="text-red-400 hover:bg-red-500/10 hover:text-red-300" onClick={() => onDelete(subject)}>
                                Clear Mark
                            </Button>
                        )}
                        <Button className="flex-1" onClick={() => onSubmitDetail(subject._id || subject.id)}>
                            Confirm Mark
                        </Button>
                    </div>
                </div>
            </div >
        );
    }

    // Collapsed View
    return (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#111] hover:bg-white/[0.04] transition-colors border border-white/[0.08] hover:border-white/[0.15] group">
            <span className="font-bold text-white/90">{subject.name}</span>
            <div className="flex gap-2">
                {!isMarked ? (
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSimpleMark(subject, 'present')}
                            className="h-8 w-8 p-0 rounded-full text-green-400 hover:bg-green-500/10"
                            title="Mark Present"
                        >
                            <Check size={16} />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSimpleMark(subject, 'absent')}
                            className="h-8 w-8 p-0 rounded-full text-red-400 hover:bg-red-500/10"
                            title="Mark Absent"
                        >
                            <X size={16} />
                        </Button>
                    </>
                ) : (
                    <div className="flex items-center gap-2 mr-2">
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded-md font-bold ${status === 'present' ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
                            status === 'absent' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
                                'bg-white/[0.05] text-white/50 border border-white/10'
                            }`}>
                            {status === 'approved_medical' ? 'Medical' : status}
                        </span>

                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(subject)}
                            className="h-8 w-8 p-0 rounded-full text-white/40 hover:text-red-400 hover:bg-red-500/10"
                            title="Delete/Clear"
                        >
                            <Trash2 size={16} />
                        </Button>
                    </div>
                )}

                <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenDetails(subject._id || subject.id, status, subject.notes)}
                    className="h-8 w-8 p-0 rounded-full text-white/40 hover:text-white hover:bg-white/[0.06]"
                >
                    <MoreHorizontal size={16} />
                </Button>
            </div>
        </div>
    );
};

const parseTime = (timeStr: string) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return 0;
    let [_, h, m, ampm] = match;
    let hours = parseInt(h, 10);
    const minutes = parseInt(m, 10);
    if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

const groupConsecutiveClasses = (classes: any[]) => {
    if (!classes || classes.length === 0) return [];

    // Sort classes by starting time before grouping
    const sortedClasses = [...classes].sort((a, b) => {
        return parseTime(a.time) - parseTime(b.time);
    });

    const grouped: any[] = [];
    let currentGroup: any = null;

    sortedClasses.forEach((slot) => {
        // Robust ID Extraction
        const getSafeId = (val: any) => {
            if (!val) return '';
            if (typeof val === 'object') return val.$oid || val.toString();
            return String(val);
        };

        const slotId = getSafeId(slot._id || slot.id);
        const subjectId = getSafeId(slot.subject_id || slot.subjectId);

        const currentGroupSubId = currentGroup ? getSafeId(currentGroup.subject_id || currentGroup.subjectId) : null;

        // Merge Condition:
        // 1. Same Subject ID (if present)
        // 2. OR Same Name (Fallback if IDs missing/messy) - Strong signal for consecutive slots
        // 3. MUST be same Type
        const isSameSubject = (subjectId && currentGroupSubId && subjectId === currentGroupSubId) ||
            (slot.name === currentGroup?.name);

        if (currentGroup && isSameSubject && slot.type === currentGroup.type) {
            // Merge
            currentGroup.originalClasses.push(slot);
            // Update time range
            if (slot.time && currentGroup.startTime) {
                const parts = slot.time.split(' - ');
                const end = parts[1] || parts[0];
                currentGroup.time = `${currentGroup.startTime} - ${end}`;
            }
            // Status Priority: Show first slot's status
            currentGroup.marked_status = currentGroup.originalClasses[0].marked_status;
            // Notes priority? First slot notes?
            currentGroup.notes = currentGroup.originalClasses[0].notes || currentGroup.notes; // Keep notes from first log

        } else {
            // New Group
            const timeParts = slot.time ? slot.time.split(' - ') : [];
            const startTime = timeParts[0] || '';

            currentGroup = {
                ...slot,
                _id: slotId,
                isMerged: true,
                originalClasses: [slot],
                startTime: startTime
            };
            grouped.push(currentGroup);
        }
    });

    return grouped.map(g => ({
        ...g,
        isMerged: g.originalClasses.length > 1,
    }));
};

const SubstitutionDropdown = ({ subjects, value, selectedName, onChange }: {
    subjects: any[];
    value: string;
    selectedName?: string;
    onChange: (val: string) => void;
}) => {
    const [open, setOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full bg-[#111] border border-white/[0.08] text-white rounded-xl px-4 py-2.5 text-sm text-left flex items-center justify-between hover:border-purple-500/30 transition-all"
            >
                <span className={value ? 'text-white' : 'text-white/30'}>{selectedName || 'Select Subject...'}</span>
                <svg className={`w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {open && (
                <div className="absolute left-0 right-0 z-[60] mt-1 rounded-xl border border-white/[0.1] bg-[#111] shadow-2xl overflow-hidden max-h-[180px] overflow-y-auto custom-scrollbar" style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}>
                    <button
                        type="button"
                        onClick={() => { onChange(''); setOpen(false); }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${!value ? 'bg-purple-500/15 text-purple-400' : 'text-white/50 hover:bg-white/[0.05] hover:text-white'}`}
                    >
                        Select Subject...
                    </button>
                    {subjects.map((s: any) => {
                        const rawId = s._id || s.id;
                        const sId = (rawId && typeof rawId === 'object' && rawId.$oid) ? rawId.$oid : String(rawId);
                        const isSelected = sId === value;
                        return (
                            <button
                                key={`sub-drop-${sId}`}
                                type="button"
                                onClick={() => { onChange(sId); setOpen(false); }}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${isSelected ? 'bg-purple-500/15 text-purple-400' : 'text-white/70 hover:bg-white/[0.05] hover:text-white'}`}
                            >
                                {s.name}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AttendanceModal;
