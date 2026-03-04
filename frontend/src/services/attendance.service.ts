import api from './api';
import type {
    DashboardData,
    ReportsData,
    Subject,
    TimetableSchedule,
    Preferences,
    Holiday,
    SystemLog,
    AcademicRecord,
    SemesterResult
} from '@/types';

export const attendanceService = {
    // Preferences & Profile
    getPreferences: async (): Promise<Preferences> => {
        const response = await api.get('/api/profile/preferences');
        return response.data;
    },

    updatePreferences: async (data: Partial<Preferences>): Promise<void> => {
        await api.post('/api/profile/preferences', data);
    },

    uploadPfp: async (formData: FormData): Promise<{ url: string }> => {
        const response = await api.post('/api/profile/upload_pfp', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    // Dashboard
    getDashboardData: async (semester: number = 1): Promise<DashboardData> => {
        const response = await api.get(`/api/dashboard/data?semester=${semester}`);
        return response.data.data;
    },

    getDashboardSummary: async (semester: number = 1) => {
        const response = await api.get(`/api/dashboard/data?semester=${semester}`);
        return response.data.data;
    },

    // Reports
    getReportsData: async (semester: number = 1): Promise<ReportsData> => {
        const response = await api.get(`/api/dashboard/reports_data?semester=${semester}`);
        return response.data.data;
    },

    // Attendance logs
    getAttendanceLogs: async (page: number = 1, limit: number = 15) => {
        const response = await api.get(`/api/attendance/logs?page=${page}&limit=${limit}`);
        return response.data.data;
    },

    // Mark attendance
    markAttendance: async (
        subjectId: string,
        status: string,
        date?: string,
        notes?: string,
        substitutedById?: string,
        semester?: number
    ): Promise<void> => {
        await api.post('/api/attendance/mark', {
            subject_id: subjectId,
            status,
            date,
            notes,
            substituted_by: substitutedById,
            semester,
        });
    },

    markAllAttendance: async (
        subjectIds: string[],
        status: string,
        date?: string,
        semester?: number
    ): Promise<void> => {
        const results = await Promise.allSettled(
            subjectIds.map(subject_id =>
                api.post('/api/attendance/mark', { subject_id, status, date, semester })
            )
        );
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            throw new Error(`${failures.length} of ${subjectIds.length} marks failed`);
        }
    },

    getCalendarData: async (year: number, month: number, semester?: number) => {
        const m = String(month).padStart(2, '0');
        const monthStr = `${year}-${m}`;
        const url = semester
            ? `/api/attendance/calendar_data?month=${monthStr}&semester=${semester}`
            : `/api/attendance/calendar_data?month=${monthStr}`;
        const response = await api.get(url);
        const data = response.data.data;

        // Node backend returns { calendar: { "YYYY-MM-DD": { logs, total, attended } }, start_date, end_date }
        // Calendar.tsx expects a flat array of log objects — normalise here
        if (data && typeof data === 'object' && !Array.isArray(data) && data.calendar) {
            const flatLogs: any[] = [];
            for (const entry of Object.values(data.calendar as Record<string, any>)) {
                if (Array.isArray(entry?.logs)) {
                    flatLogs.push(...entry.logs);
                }
            }
            return flatLogs;
        }

        // Legacy Flask format: flat array already
        return Array.isArray(data) ? data : [];
    },

    editAttendance: async (logId: string, status: string, notes?: string, date?: string): Promise<void> => {
        await api.put(`/api/attendance/logs/${logId}`, {
            status,
            notes,
            date
        });
    },

    deleteAttendance: async (logId: string): Promise<void> => {
        await api.delete(`/api/attendance/logs/${logId}`);
    },

    // Classes
    getTodaysClasses: async (): Promise<Subject[]> => {
        const response = await api.get('/api/attendance/classes-for-date?date=' + new Date().toISOString().split('T')[0]);
        return response.data.data;
    },

    getClassesForDate: async (date: string, semester?: number) => {
        const url = semester ? `/api/attendance/classes-for-date?date=${date}&semester=${semester}` : `/api/attendance/classes-for-date?date=${date}`;
        const response = await api.get(url);
        const data = response.data.data;

        // Backend returns { classes: [{ slot, subject, log, marked }], extra_logs, ... }
        // AttendanceModal expects a flat array of objects with _id, subject_id, name, marked_status, log_id, time, type
        if (data && Array.isArray(data.classes)) {
            return data.classes.map((c: any) => {
                const subj = c.subject || {};
                const slot = c.slot || {};
                const log = c.log || null;
                const subjId = subj._id || subj.id || slot.subject_id || '';
                return {
                    _id: typeof subjId === 'object' ? (subjId.$oid || String(subjId)) : String(subjId),
                    subject_id: typeof subjId === 'object' ? (subjId.$oid || String(subjId)) : String(subjId),
                    name: subj.name || slot.name || 'Unknown',
                    time: slot.time || '',
                    type: slot.type || 'Lecture',
                    semester: subj.semester || slot.semester,
                    marked: c.marked || false,
                    marked_status: log ? log.status : 'pending',
                    log_id: log ? (typeof log._id === 'object' ? (log._id.$oid || String(log._id)) : String(log._id)) : null,
                    notes: log?.notes || '',
                    attended: subj.attended || 0,
                    total: subj.total || 0,
                };
            });
        }

        // Fallback: if already flat array (Flask format)
        return Array.isArray(data) ? data : [];
    },

    // Subjects
    getSubjects: async (semester: number = 1): Promise<Subject[]> => {
        const response = await api.get(`/api/academic/subjects?semester=${semester}`);
        return response.data.data;
    },

    getFullSubjectsData: async (semester: number = 1): Promise<Subject[]> => {
        const response = await api.get(`/api/academic/full_subjects_data?semester=${semester}`);
        return response.data.data;
    },

    getSubjectDetails: async (subjectId: string): Promise<Subject> => {
        const response = await api.get(`/api/academic/subjects/${subjectId}`);
        return response.data.data;
    },

    addSubject: async (
        subjectName: string,
        semester: number,
        categories?: string[],
        code?: string,
        professor?: string,
        classroom?: string
    ): Promise<void> => {
        // Use modern REST endpoint
        await api.post('/api/academic/subjects', {
            name: subjectName, // Backend expects 'name', not 'subject_name'
            semester,
            categories,
            code,
            professor,
            classroom
        });
    },

    deleteSubject: async (subjectId: string): Promise<void> => {
        await api.delete(`/api/academic/subjects/${subjectId}`);
    },

    updateSubjectDetails: async (
        subjectId: string,
        professor?: string,
        classroom?: string
    ): Promise<void> => {

        await api.put(`/api/academic/subjects/${subjectId}`, {
            professor,
            classroom,
        });
    },

    updateSubjectFullDetails: async (
        subjectId: string,
        data: Partial<Subject>
    ): Promise<void> => {

        await api.put(`/api/academic/subjects/${subjectId}`, data);
    },

    updateAttendanceCount: async (
        subjectId: string,
        attended: number,
        total: number
    ): Promise<void> => {

        await api.post(`/api/academic/subjects/${subjectId}/attendance-count`, {
            attended,
            total,
        });
    },

    updatePracticals: async (
        subjectId: string,
        data: { total?: number; completed?: number; hardcopy?: boolean }
    ): Promise<void> => {

        await api.put(`/api/academic/subjects/${subjectId}`, { practicals: data });
    },

    updateAssignments: async (
        subjectId: string,
        data: { total?: number; completed?: number }
    ): Promise<void> => {

        await api.put(`/api/academic/subjects/${subjectId}`, { assignments: data });
    },

    // Timetable
    getTimetable: async (semester: number = 1): Promise<{ schedule: TimetableSchedule; periods?: any[] }> => {
        const response = await api.get(`/api/timetable?semester=${semester}`);
        return response.data.data;
    },

    saveTimetable: async (schedule: TimetableSchedule, semester: number = 1): Promise<void> => {
        await api.post(`/api/timetable?semester=${semester}`, { schedule });
    },

    saveTimetableStructure: async (periods: any[], semester: number = 1): Promise<void> => {
        await api.post(`/api/timetable/structure?semester=${semester}`, periods);
    },

    addTimetableSlot: async (slotData: any, semester: number = 1): Promise<void> => {
        await api.post(`/api/timetable/slot?semester=${semester}`, slotData);
    },

    updateTimetableSlot: async (slotId: string, slotData: any, semester: number = 1): Promise<void> => {
        await api.put(`/api/timetable/slot/${slotId}?semester=${semester}`, slotData);
    },

    deleteTimetableSlot: async (slotId: string, semester: number = 1): Promise<void> => {
        await api.delete(`/api/timetable/slot/${slotId}?semester=${semester}`);
    },

    getLogsForDate: async (date: string) => {
        const response = await api.get(`/api/attendance/logs?date=${date}`);
        return response.data.data;
    },

    // Analytics
    getDayOfWeekAnalytics: async (semester: number = 1) => {
        const response = await api.get(`/api/dashboard/analytics/day-of-week?semester=${semester}`);
        return response.data.data;
    },





    getHolidays: async (): Promise<Holiday[]> => {
        const response = await api.get('/api/timetable/holidays');
        return response.data.data;
    },

    addHoliday: async (date: string, name: string): Promise<void> => {
        await api.post('/api/timetable/holidays', { date, name });
    },

    deleteHoliday: async (holidayId: string): Promise<void> => {
        await api.delete(`/api/timetable/holidays/${holidayId}`);
    },

    // Medical leaves (not yet ported to Node — return empty stubs)
    getPendingLeaves: async () => {
        return [];
    },

    approveLeave: async (_logId: string): Promise<void> => {
        // stub
    },

    // Substitutions
    getUnresolvedSubstitutions: async () => {
        // Not ported to Node — return empty
        return [];
    },

    markSubstituted: async (
        originalSubjectId: string,
        substituteSubjectId: string,
        date: string
    ): Promise<void> => {
        await api.post('/api/attendance/mark', {
            subject_id: originalSubjectId,
            status: 'substituted',
            substituted_by: substituteSubjectId,
            date,
        });
    },

    // Data management
    exportData: async () => {
        const response = await api.get('/api/data/export_data', {
            responseType: 'blob',
        });
        return response.data;
    },

    importData: async (data: any): Promise<void> => {
        await api.post('/api/data/import_data', data);
    },

    deleteAllData: async (confirmationEmail?: string) => {
        const response = await api.delete('/api/data/delete_all_data', {
            data: { confirmation_email: confirmationEmail }
        });
        // Return full response for success field checking
        return { ...response.data, ...(response.data?.data || {}) };
    },

    // Backup Management
    listBackups: async () => {
        const response = await api.get('/api/data/backups');
        return response.data?.data?.backups || [];
    },

    restoreBackup: async (backupId: string) => {
        const response = await api.post(`/api/data/restore_backup/${backupId}`);
        return response.data;
    },

    // User Profile
    getProfile: async () => {
        const response = await api.get('/api/profile/');
        return response.data.data;
    },

    updateProfile: async (data: any) => {
        const response = await api.put('/api/profile/', data);
        return response.data;
    },

    syncThresholds: async (semester?: number): Promise<{ modified: number; threshold: number }> => {
        const response = await api.post('/api/profile/sync-thresholds', { semester });
        return response.data.data;
    },

    // System logs
    getSystemLogs: async (): Promise<SystemLog[]> => {
        const response = await api.get('/api/profile/logs');
        return response.data.data;
    },

    // Academic Records (not ported — stub)
    getAcademicRecords: async (): Promise<AcademicRecord[]> => {
        return [];
    },

    updateAcademicRecord: async (_data: AcademicRecord): Promise<void> => {
        // stub
    },

    // Semester Results (IPU Grading)
    getSemesterResults: async (): Promise<SemesterResult[]> => {
        const response = await api.get('/api/academic/results');
        return response.data.data;
    },

    getSemesterResult: async (semester: number): Promise<SemesterResult> => {
        const response = await api.get('/api/academic/results');
        const results: SemesterResult[] = response.data.data ?? [];
        const found = results.find((r) => r.semester === semester);
        if (!found) throw new Error(`No result for semester ${semester}`);
        return found;
    },

    saveSemesterResult: async (data: Omit<SemesterResult, '_id' | 'timestamp'>): Promise<{ success: boolean; result: SemesterResult }> => {
        const response = await api.post('/api/academic/results', data);
        return response.data.data;
    },

    deleteSemesterResult: async (semester: number): Promise<void> => {
        await api.delete(`/api/academic/results/${semester}`);
    },

    // Notices
    getNotices: async (category?: string) => {
        const params = category ? `?category=${encodeURIComponent(category)}` : '';
        const response = await api.get(`/api/scraper/notices${params}`);
        return response.data.data;
    },

    // Notifications
    getNotifications: async () => {
        const response = await api.get('/api/dashboard/notifications');
        return response.data.data;
    },

    // Manual Course Manager
    getManualCourses: async () => {
        const response = await api.get('/api/academic/courses/manual');
        return response.data.data;
    },

    saveManualCourses: async (courses: any[]) => {
        const response = await api.post('/api/academic/courses/manual', courses);
        return response.data;
    },

    // IPU Exam Portal
    getIPUCaptcha: async () => {
        const response = await api.get('/api/ipu/captcha');
        return response.data.data;
    },

    fetchIPUResults: async (payload: {
        enrollment_number: string;
        password: string;
        captcha: string;
        hidden_fields: Record<string, string>;
        field_names: Record<string, string>;
        login_action?: string;
    }) => {
        const response = await api.post('/api/ipu/fetch-results', payload);
        return response.data.data;
    },

    // One-shot: auto-solves CAPTCHA via OCR, falls back to manual if OCR unavailable
    autoFetchIPUResults: async (payload: {
        enrollment_number: string;
        password: string;
    }) => {
        const response = await api.post('/api/ipu/auto-fetch', payload);
        return response.data.data;
    },

    // Get previously saved IPU results from DB (no login needed)
    getSavedIPUResults: async () => {
        const response = await api.get('/api/ipu/saved-results');
        return response.data.data;
    },
};
