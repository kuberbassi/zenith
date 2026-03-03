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
        try {
            const dateStr = getDateStr(selectedDate);
            // Check for existing log to Edit instead of Mark
            if (subject.log_id) {
                await attendanceService.editAttendance(subject.log_id, status, undefined, dateStr);
                showToast('success', `Updated to ${status}`);
            } else {
                await attendanceService.markAttendance(subject._id || subject.id, status, dateStr);
                showToast('success', `Marked ${status}`);
            }

            loadClassesForDate(selectedDate, true); // Silent reload
            fetchAttendanceLogs(selectedDate); // Refresh logs section
            if (onSuccess) onSuccess();
        } catch (error: any) {
            showToast('error', error.response?.data?.error || 'Failed to mark');
        }
    };

    const handleDelete = async (subject: any) => {
        try {
            // We need the log_id. getClassesForDate returns it.
            if (!subject.log_id) {
                showToast('error', 'No attendance record found to delete.');
                return;
            }

            await attendanceService.deleteAttendance(subject.log_id);
            showToast('success', 'Attendance cleared');
            loadClassesForDate(selectedDate, true);
            fetchAttendanceLogs(selectedDate); // Refresh logs section
            if (onSuccess) onSuccess();
        } catch (error: any) {
            showToast('error', error.response?.data?.error || 'Failed to delete');
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
                <div className="flex items-center gap-4 p-3 bg-surface-container rounded-xl border border-outline-variant/30">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <CalendarIcon size={20} />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
                            Date
                        </label>
                        <input
                            type="date"
                            className="bg-transparent border-none p-0 text-on-surface font-sans font-medium focus:ring-0 w-full"
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
                            <h3 className="text-sm font-bold text-on-surface-variant mb-3 uppercase tracking-wider">Scheduled Classes</h3>
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
                                                    if (subj.isMerged) {
                                                        // Clear all associated logs for robustness
                                                        subj.originalClasses.forEach((cls: any) => {
                                                            if (cls.log_id) handleDelete(cls);
                                                        });
                                                    } else {
                                                        handleDelete(subj);
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
                                <p className="text-sm text-on-surface-variant/70 italic text-center py-4">No classes scheduled.</p>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="my-6 border-t border-stroke"></div>

                        {/* All Attendance Logs Section */}
                        <div>
                            <h3 className="text-sm font-bold text-on-surface-variant mb-3 uppercase tracking-wider flex items-center gap-2">
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
                                            'present': 'text-green-600 bg-green-50',
                                            'absent': 'text-red-600 bg-red-50',
                                            'late': 'text-orange-600 bg-orange-50',
                                            'medical': 'text-blue-600 bg-blue-50',
                                            'approved_medical': 'text-blue-600 bg-blue-50',
                                            'cancelled': 'text-gray-600 bg-gray-50',
                                            'substituted': 'text-purple-600 bg-purple-50'
                                        };
                                        const statusColor = statusColors[log.status] || 'text-gray-600 bg-gray-50';

                                        const logId = getSafeId(log._id);

                                        return (
                                            <div
                                                key={`log-entry-${logId}-${idx}`}
                                                className="flex items-center justify-between p-3 rounded-lg bg-surface-variant/30 border border-stroke"
                                            >
                                                <div className="flex-1">
                                                    <div className="font-semibold text-sm">{log.subject_name || log.subject_info?.name || logSubject?.name || 'Unknown Subject'}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                                                            {String(log.status).toUpperCase()}
                                                        </span>
                                                        {log.notes && (
                                                            <span className="text-xs text-on-surface-variant">• {log.notes}</span>
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
                                                    className="p-2 hover:bg-error/10 rounded-lg transition-colors"
                                                    title="Delete this log entry"
                                                >
                                                    <Trash2 size={18} className="text-error" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-4xl mb-2">📋</div>
                                    <p className="text-sm text-on-surface-variant/70 italic">No attendance marked for this date</p>
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
            <div className="bg-surface-container rounded-xl p-4 border border-primary/30 shadow-md">
                <div className="flex justify-between items-center mb-4 border-b border-outline-variant/10 pb-3">
                    <h4 className="font-bold text-on-surface">{subject.name}</h4>
                    <button onClick={onCloseDetails} className="text-on-surface-variant hover:text-on-surface p-1 rounded-full hover:bg-surface-dim">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Status Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'present', label: 'Present', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
                            { id: 'absent', label: 'Absent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
                            { id: 'medical', label: 'Medical Leave', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' }, // Map to approved_medical
                            { id: 'cancelled', label: 'Cancelled', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
                            { id: 'substituted', label: 'Substituted', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
                        ].map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setDetailStatus(opt.id === 'medical' ? 'approved_medical' : opt.id)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${(detailStatus === opt.id || (opt.id === 'medical' && detailStatus === 'approved_medical'))
                                    ? `ring-2 ring-primary ${opt.color}`
                                    : 'bg-surface-dim text-on-surface hover:bg-surface-container-high'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Substitution Dropdown */}
                    {detailStatus === 'substituted' && (
                        <div className="animate-fade-in p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800/30">
                            <label className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase block mb-2">
                                Substituted By
                            </label>
                            <select
                                className="w-full bg-white dark:bg-black border border-outline rounded-lg p-2 text-sm"
                                value={detailSubstitutedBy}
                                onChange={(e) => setDetailSubstitutedBy(e.target.value)}
                            >
                                <option value="">Select Subject...</option>
                                {allSubjects.filter((s: any) => {
                                    const sId = String(s._id || s.id);
                                    const currentId = String(subject._id || subject.id);
                                    return sId !== currentId;
                                }).map((s: any) => {
                                    // Robust ID extraction for unique key
                                    const rawId = s._id || s.id;
                                    const sId = (rawId && typeof rawId === 'object' && rawId.$oid) ? rawId.$oid : String(rawId);
                                    return (
                                        <option key={`sub-opt-${sId}`} value={sId}>{s.name}</option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-semibold text-on-surface-variant uppercase block mb-1">
                            Notes (Optional)
                        </label>
                        <textarea
                            className="w-full bg-surface-dim border border-transparent focus:border-primary/50 rounded-lg p-3 text-sm resize-none"
                            placeholder="Add details..."
                            rows={2}
                            value={detailNotes}
                            onChange={(e) => setDetailNotes(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2">
                        {isMarked && (
                            <Button variant="ghost" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10" onClick={() => onDelete(subject)}>
                                <Trash2 size={18} className="mr-2" /> Clear Mark
                            </Button>
                        )}
                        <Button className="flex-1" onClick={() => onSubmitDetail(subject._id || subject.id)}>
                            Confirm Mark
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Collapsed View
    return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors border border-transparent hover:border-outline-variant/20 group">
            <span className="font-bold text-on-surface">{subject.name}</span>
            <div className="flex gap-2">
                {!isMarked ? (
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSimpleMark(subject, 'present')}
                            className="h-8 w-8 p-0 rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20"
                            title="Mark Present"
                        >
                            <Check size={16} />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSimpleMark(subject, 'absent')}
                            className="h-8 w-8 p-0 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
                            title="Mark Absent"
                        >
                            <X size={16} />
                        </Button>
                    </>
                ) : (
                    <div className="flex items-center gap-2 mr-2">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${status === 'present' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                            status === 'absent' ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' :
                                'bg-surface-dim text-on-surface-variant'
                            }`}>
                            {status === 'approved_medical' ? 'Medical' : status}
                        </span>

                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(subject)}
                            className="h-8 w-8 p-0 rounded-full text-on-surface-variant hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
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
                    className="h-8 w-8 p-0 rounded-full text-on-surface-variant hover:bg-surface-dim"
                >
                    <MoreHorizontal size={16} />
                </Button>
            </div>
        </div>
    );
};

const groupConsecutiveClasses = (classes: any[]) => {
    if (!classes || classes.length === 0) return [];

    const grouped: any[] = [];
    let currentGroup: any = null;

    classes.forEach((slot) => {
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
        isMerged: g.originalClasses.length > 1, // Only true if actually merged > 1
        // If meant to be single, revert isMerged? No, consistent struct is fine.
        // Actually if length is 1, treat as normal?
        // Logic above sets isMerged=true always. Let's fix.
    }));
};

export default AttendanceModal;
