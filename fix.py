import re

with open('frontend/src/components/modals/AttendanceModal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace actionInProgress
old_action = "const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);\n    const [actionInProgress, setActionInProgress] = useState(false);"
new_action = '''const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

    const debounceTimer = React.useRef<NodeJS.Timeout | null>(null);
    const debouncedOnSuccess = React.useCallback(() => {
        if (!onSuccess) return;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => onSuccess(), 500);
    }, [onSuccess]);'''

content = content.replace(old_action, new_action)

# 2. markSimple
old_mark = '''    const markSimple = async (subject: any, status: 'present' | 'absent') => {
        if (actionInProgress) return;
        setActionInProgress(true);
        const dateStr = getDateStr(selectedDate);
        const snapshot = applyOptimisticMark(subject, status, dateStr);
        try {
            if (subject.log_id) {
                await attendanceService.editAttendance(subject.log_id, status, undefined, dateStr);
                showToast('success', Updated to );
            } else {
                await attendanceService.markAttendance(subject._id || subject.id, status, dateStr, undefined, undefined, currentSemester);
                showToast('success', Marked );
            }
            refreshAttendanceState();
        } catch (error: any) {
            setScheduledClasses(snapshot.prevScheduled);
            setAttendanceLogs(snapshot.prevLogs);
            showToast('error', error.response?.data?.error || 'Failed to mark');
        } finally {
            setActionInProgress(false);
        }
    };'''
new_mark = '''    const markSimple = async (subject: any, status: 'present' | 'absent') => {
        const subjectId = String(subject?._id || subject?.id || subject?.subject_id || '');
        if (processingIds.has(subjectId)) return;
        setProcessingIds(prev => new Set(prev).add(subjectId));
        const dateStr = getDateStr(selectedDate);
        const snapshot = applyOptimisticMark(subject, status, dateStr);
        try {
            let res;
            if (subject.log_id && !subject.log_id.startsWith('optimistic-')) {
                res = await attendanceService.editAttendance(subject.log_id, status, undefined, dateStr);
                showToast('success', Updated to );
            } else {
                res = await attendanceService.markAttendance(subjectId, status, dateStr, undefined, undefined, currentSemester);
                showToast('success', Marked );
            }
            if (res?.log?._id) {
                setScheduledClasses(prev => prev.map(r => String(r._id) === subjectId ? { ...r, log_id: res.log._id } : r));
                setAttendanceLogs(prev => prev.map(l => String(l.subject_id) === subjectId ? { ...l, _id: res.log._id } : l));
            }
            debouncedOnSuccess();
        } catch (error: any) {
            setScheduledClasses(snapshot.prevScheduled);
            setAttendanceLogs(snapshot.prevLogs);
            showToast('error', error.response?.data?.error || 'Failed to mark');
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(subjectId);
                return next;
            });
        }
    };'''
content = content.replace(old_mark, new_mark)

# 3. handleDelete
old_del = '''    const handleDelete = async (subject: any) => {
        if (actionInProgress) return;
        if (!subject.log_id) {
            showToast('error', 'No attendance record found to delete.');
            return;
        }
        setActionInProgress(true);
        const prevScheduled = [...scheduledClasses];
        const prevLogs = [...attendanceLogs];
        const subjectId = String(subject?._id || subject?.id || subject?.subject_id || '');
        const logId = String(subject?.log_id || '');
        setScheduledClasses((prev) => prev.map((row) => {
            const rowId = String(row?._id || row?.id || row?.subject_id || '');
            if (rowId !== subjectId) return row;
            return { ...row, marked: false, marked_status: 'pending', log_id: null };
        }));
        setAttendanceLogs((prev) => prev.filter((log: any) => String(log?._id || log?.id) !== logId));
        try {
            await attendanceService.deleteAttendance(subject.log_id);
            showToast('success', 'Attendance cleared');
            refreshAttendanceState();
        } catch (error: any) {
            setScheduledClasses(prevScheduled);
            setAttendanceLogs(prevLogs);
            showToast('error', error.response?.data?.error || 'Failed to delete');
        } finally {
            setActionInProgress(false);
        }
    };'''
new_del = '''    const handleDelete = async (subject: any) => {
        const subjectId = String(subject?._id || subject?.id || subject?.subject_id || '');
        if (processingIds.has(subjectId)) return;
        if (!subject.log_id) {
            showToast('error', 'No attendance record found to delete.');
            return;
        }
        setProcessingIds(prev => new Set(prev).add(subjectId));
        const prevScheduled = [...scheduledClasses];
        const prevLogs = [...attendanceLogs];
        const logId = String(subject?.log_id || '');
        setScheduledClasses((prev) => prev.map((row) => {
            const rowId = String(row?._id || row?.id || row?.subject_id || '');
            if (rowId !== subjectId) return row;
            return { ...row, marked: false, marked_status: 'pending', log_id: null };
        }));
        setAttendanceLogs((prev) => prev.filter((log: any) => String(log?._id || log?.id) !== logId));
        try {
            if (!logId.startsWith('optimistic-')) {
                await attendanceService.deleteAttendance(logId);
            }
            showToast('success', 'Attendance cleared');
            debouncedOnSuccess();
        } catch (error: any) {
            setScheduledClasses(prevScheduled);
            setAttendanceLogs(prevLogs);
            showToast('error', error.response?.data?.error || 'Failed to delete');
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(subjectId);
                return next;
            });
        }
    };'''
content = content.replace(old_del, new_del)

# 4. submitDetailedMark
old_submit = '''    const submitDetailedMark = async (subject: any) => {
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
                    detailStatus === 'substituted' ? detailSubstitutedBy : undefined,
                    currentSemester
                );
                showToast('success', 'Attendance marked successfully');
            }

            setExpandedSubjectId(null);
            resetDetailForm();
            refreshAttendanceState();
        } catch (error: any) {
            showToast('error', error.response?.data?.error || 'Failed to mark');
        }
    };'''
new_submit = '''    const submitDetailedMark = async (subject: any) => {
        const subjectId = String(subject?._id || subject?.id || subject?.subject_id || '');
        if (processingIds.has(subjectId)) return;
        
        try {
            const dateStr = getDateStr(selectedDate);
            // If substituted, ensure we selected a substitute subject
            if (detailStatus === 'substituted' && !detailSubstitutedBy) {
                showToast('error', 'Please select the substituting subject');
                return;
            }

            setProcessingIds(prev => new Set(prev).add(subjectId));
            const isSubstitution = detailStatus === 'substituted' || (subject.marked_status === 'substituted');

            let res;
            if (subject.log_id && !subject.log_id.startsWith('optimistic-') && !isSubstitution) {
                res = await attendanceService.editAttendance(subject.log_id, detailStatus, detailNotes, dateStr);
                showToast('success', 'Attendance updated');
            } else {
                if (subject.log_id && !subject.log_id.startsWith('optimistic-') && isSubstitution) {
                    await attendanceService.deleteAttendance(subject.log_id);
                }
                res = await attendanceService.markAttendance(
                    subjectId, detailStatus, dateStr, detailNotes,
                    detailStatus === 'substituted' ? detailSubstitutedBy : undefined, currentSemester
                );
                showToast('success', 'Attendance marked successfully');
            }

            if (res?.log?._id) {
                setScheduledClasses(prev => prev.map(r => String(r._id) === subjectId ? { ...r, log_id: res.log._id, marked_status: detailStatus } : r));
                setAttendanceLogs(prev => {
                    const existingIndex = prev.findIndex((l: any) => String(l.subject_id) === subjectId);
                    if (existingIndex >= 0) {
                        const next = [...prev];
                        next[existingIndex] = { ...next[existingIndex], _id: res.log._id, status: detailStatus };
                        return next;
                    }
                    return [{
                        _id: res.log._id,
                        subject_id: subjectId,
                        subject_name: subject.name || subject.subject_name || 'Unknown Subject',
                        date: dateStr,
                        status: detailStatus,
                        type: String(subject.type || 'class'),
                    }, ...prev];
                });
            }

            setExpandedSubjectId(null);
            resetDetailForm();
            debouncedOnSuccess();
        } catch (error: any) {
            showToast('error', error.response?.data?.error || 'Failed to mark');
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(subjectId);
                return next;
            });
        }
    };'''
content = content.replace(old_submit, new_submit)

with open('frontend/src/components/modals/AttendanceModal.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Replaced')
