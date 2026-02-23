import api from './api';
import offlineStorage from '../lib/offlineStorage';

// Persistent Cache Strategy using MMKV
const setCached = async (key, data) => {
    await offlineStorage.saveData(key, data);
};

const getCached = async (key) => {
    return await offlineStorage.getData(key);
};

const clearCache = (key) => {
    offlineStorage.clearData(key);
};

// Clear all calendar caches (wildcard pattern)
const clearCalendarCaches = () => {
    // Clear known calendar cache patterns for semesters 1-8 and recent months
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Clear current and adjacent months for all semesters
    for (let sem = 1; sem <= 8; sem++) {
        for (let m = month - 1; m <= month + 1; m++) {
            const adjustedMonth = m < 1 ? 12 : (m > 12 ? 1 : m);
            const adjustedYear = m < 1 ? year - 1 : (m > 12 ? year + 1 : year);
            clearCache(`cal_${adjustedYear}_${adjustedMonth}_${sem}`);
        }
    }
};

export const attendanceService = {
    // ==================== Preferences & Profile ====================
    uploadPfp: async (formData) => {
        const response = await api.post('/api/upload_pfp', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    updateProfile: async (data) => {
        const response = await api.post('/api/update_profile', data);
        clearCache('dash_1');
        clearCache('dash_2');
        return response.data;
    },

    // ==================== Dashboard ====================
    getDashboardData: async (semester = 1, force = false) => {
        const key = `dash_${semester}`;
        if (!force) {
            const cached = await getCached(key);
            if (cached) return cached;
        }
        const response = await api.get(`/api/dashboard_data?semester=${semester}`);
        await setCached(key, response.data.data);
        return response.data.data;
    },

    getDashboardSummary: async (semester = 1) => {
        const response = await api.get(`/api/dashboard_data?semester=${semester}`);
        return response.data.data;
    },

    // ==================== Reports ====================
    getReportsData: async (semester = 1, force = false) => {
        const key = `reports_${semester}`;
        if (!force) {
            const cached = await getCached(key);
            if (cached) return cached;
        }
        const response = await api.get(`/api/reports_data?semester=${semester}`);
        await setCached(key, response.data.data);
        return response.data.data;
    },

    // ==================== Attendance Logs ====================
    getAttendanceLogs: async (page = 1, limit = 15) => {
        const response = await api.get(`/api/attendance_logs?page=${page}&limit=${limit}`);
        return response.data.data;
    },

    getLogsForDate: async (date) => {
        const response = await api.get(`/api/attendance_logs?date=${date}&limit=100`);
        return response.data.data.logs || response.data.data;
    },

    // ==================== Mark Attendance ====================
    markAttendance: async (subjectId, status, date, notes, substitutedById, type) => {
        await api.post('/api/mark_attendance', {
            subject_id: subjectId,
            status,
            date,
            notes,
            substituted_by_id: substitutedById,
            type: type
        });
        clearCache('dash_1');
        clearCache('dash_2');
        clearCalendarCaches(); // Clear calendar to show updated dots
    },

    markAllAttendance: async (subjectIds, status, date) => {
        await api.post('/api/mark_all_attendance', {
            subject_ids: subjectIds,
            status,
            date,
        });
        clearCache('dash_1');
        clearCache('dash_2');
        clearCalendarCaches();
    },

    editAttendance: async (logId, status, notes, date, substitutedById = null, type = 'Lecture') => {
        await api.post(`/api/edit_attendance/${logId}`, { status, notes, date, substituted_by_id: substitutedById, type });
        clearCache('dash_1');
        clearCache('dash_2');
        clearCache('reports_1');
        clearCache('reports_2');
        clearCalendarCaches();
    },

    deleteAttendance: async (logId) => {
        await api.delete(`/api/logs/${logId}`);
        clearCache('dash_1');
        clearCache('dash_2');
        clearCache('reports_1');
        clearCache('reports_2');
        clearCalendarCaches();
    },

    // ==================== Calendar ====================
    getCalendarData: async (year, month, semester) => {
        const key = `cal_${year}_${month}_${semester}`;
        const cached = await getCached(key);
        if (cached) return cached;

        const url = semester
            ? `/api/calendar_data?year=${year}&month=${month}&semester=${semester}`
            : `/api/calendar_data?year=${year}&month=${month}`;

        try {
            const response = await api.get(url);
            const rawLogs = response.data.data || [];

            // Transform List to Map: { "YYYY-MM-DD": [log1, log2] }
            const dataMap = {};
            rawLogs.forEach(log => {
                const date = log.date;
                if (!dataMap[date]) dataMap[date] = [];
                dataMap[date].push(log);
            });

            await setCached(key, dataMap);
            return dataMap;
        } catch (error) {
            console.error("Calendar fetch error:", error);
            throw error;
        }
    },

    // ==================== Classes ====================
    getTodaysClasses: async () => {
        const today = new Date().toISOString().split('T')[0];
        const response = await api.get(`/api/classes_for_date?date=${today}`);
        return response.data.data;
    },

    getClassesForDate: async (date, semester) => {
        const url = semester
            ? `/api/classes_for_date?date=${date}&semester=${semester}`
            : `/api/classes_for_date?date=${date}`;
        const response = await api.get(url);
        return response.data.data;
    },

    // ==================== Subjects ====================
    getSubjects: async (semester = 1) => {
        const response = await api.get(`/api/subjects?semester=${semester}`);
        return response.data.data;
    },

    getFullSubjectsData: async (semester = 1) => {
        const response = await api.get(`/api/full_subjects_data?semester=${semester}`);
        return response.data.data;
    },

    getSubjectDetails: async (subjectId) => {
        const response = await api.get(`/api/subject_details/${subjectId}`);
        return response.data.data;
    },

    addSubject: async (subjectName, semester, categories, code, professor, classroom, practical_total, assignment_total, syllabus) => {
        console.log('📚 Adding subject:', { subjectName, semester, syllabus: syllabus ? 'provided' : 'none' });
        await api.post('/api/v1/academic/subjects', {
            name: subjectName,
            semester,
            categories,
            code,
            professor,
            classroom,
            practical_total,
            assignment_total,
            syllabus
        });
        clearCache(`dash_${semester}`);
    },

    deleteSubject: async (subjectId) => {
        await api.delete(`/api/v1/academic/subjects/${subjectId}`);
        clearCache('dash_1');
        clearCache('dash_2');
    },

    updateSubjectDetails: async (subjectId, professor, classroom) => {
        console.log('✏️ Updating subject:', { subjectId, professor, classroom });
        await api.put(`/api/v1/academic/subjects/${subjectId}`, { professor, classroom });
    },

    updateSubjectFullDetails: async (subjectId, data) => {
        console.log('📝 Updating full subject:', { subjectId, data });
        await api.put(`/api/v1/academic/subjects/${subjectId}`, data);
        clearCache('dash_1');
        clearCache('dash_2');
    },

    updateAttendanceCount: async (subjectId, attended, total) => {
        console.log('🔢 Updating count:', { subjectId, attended, total });
        await api.post(`/api/v1/academic/subjects/${subjectId}/attendance-count`, { attended, total });
        clearCache('dash_1');
        clearCache('dash_2');
    },

    updatePracticals: async (subjectId, data) => {
        await api.put(`/api/v1/academic/subjects/${subjectId}`, { practicals: data });
        // Clear dashboard cache so refresh shows updated values
        clearCache('dash_1');
        clearCache('dash_2');
    },

    updateAssignments: async (subjectId, data) => {
        await api.put(`/api/v1/academic/subjects/${subjectId}`, { assignments: data });
        // Clear dashboard cache so refresh shows updated values
        clearCache('dash_1');
        clearCache('dash_2');
    },

    // ==================== Timetable ====================
    getTimetable: async (semester = 1) => {
        const response = await api.get(`/api/timetable?semester=${semester}`);
        return response.data.data;
    },

    saveTimetable: async (schedule, semester = 1) => {
        await api.post(`/api/timetable?semester=${semester}`, { schedule });
    },

    saveTimetableStructure: async (periods, semester = 1) => {
        await api.post(`/api/timetable/structure?semester=${semester}`, periods);
    },

    addTimetableSlot: async (slotData) => {
        await api.post('/api/timetable/slot', slotData);
    },

    updateTimetableSlot: async (slotId, slotData) => {
        await api.put(`/api/timetable/slot/${slotId}`, slotData);
    },

    deleteTimetableSlot: async (slotId, semester = 1) => {
        await api.delete(`/api/timetable/slot/${slotId}?semester=${semester}`);
    },

    // ==================== Analytics ====================
    getDayOfWeekAnalytics: async (semester = 1) => {
        const response = await api.get(`/api/analytics/day_of_week?semester=${semester}`);
        return response.data.data;
    },

    getMonthlyAnalytics: async (semester = 1, year) => {
        const response = await api.get(`/api/analytics/monthly_trend?year=${year || new Date().getFullYear()}&semester=${semester}`);
        return response.data.data;
    },

    getAllSemestersOverview: async () => {
        const response = await api.get('/api/all_semesters_overview');
        return response.data.data;
    },

    // ==================== Preferences ====================
    getPreferences: async () => {
        const response = await api.get('/api/preferences');
        return response.data.data;
    },

    updatePreferences: async (preferences) => {
        await api.post('/api/preferences', preferences);
        clearCache('dash_1');
        clearCache('dash_2');
    },

    // ==================== Holidays ====================
    getHolidays: async () => {
        const response = await api.get('/api/holidays');
        return response.data.data;
    },

    addHoliday: async (date, name) => {
        await api.post('/api/holidays', { date, name });
    },

    deleteHoliday: async (holidayId) => {
        await api.delete(`/api/holidays/${holidayId}`);
    },

    // ==================== Medical Leaves ====================
    getPendingLeaves: async () => {
        const response = await api.get('/api/pending_leaves');
        return response.data.data;
    },

    approveLeave: async (logId) => {
        await api.post(`/api/approve_leave/${logId}`);
    },

    // ==================== Substitutions ====================
    getUnresolvedSubstitutions: async () => {
        const response = await api.get('/api/unresolved_substitutions');
        return response.data.data;
    },

    markSubstituted: async (originalSubjectId, substituteSubjectId, date) => {
        await api.post('/api/mark_substituted', {
            original_subject_id: originalSubjectId,
            substitute_subject_id: substituteSubjectId,
            date,
        });
    },

    // ==================== Data Management ====================
    exportData: async () => {
        const response = await api.get('/api/v1/data/export_data');
        return response.data;
    },

    importData: async (data) => {
        await api.post('/api/v1/data/import_data', data);
    },

    deleteAllData: async (confirmationEmail = null) => {
        console.log('🗑️ Calling delete all data API with confirmation:', confirmationEmail);
        const response = await api.delete('/api/v1/data/delete_all_data', {
            data: { confirmation_email: confirmationEmail }
        });
        console.log('✅ Delete response:', response.data);
        clearCache('dash_1');
        clearCache('dash_2');
        clearCache('reports_1');
        clearCache('reports_2');
        return response.data?.data || response.data;
    },

    // ==================== Backup Management ====================
    listBackups: async () => {
        const response = await api.get('/api/backups');
        return response.data?.data?.backups || [];
    },

    restoreBackup: async (backupId) => {
        const response = await api.post(`/api/restore_backup/${backupId}`);
        clearCache('dash_1');
        clearCache('dash_2');
        return response.data;
    },

    // ==================== System Logs ====================
    getSystemLogs: async () => {
        try {
            const response = await api.get('/api/system_logs');
            return response.data.data || [];
        } catch (error) {
            console.error("Failed to fetch system logs:", error);
            return [];
        }
    },

    // ==================== Semester Results (IPU Grading) ====================
    getSemesterResults: async () => {
        const response = await api.get('/api/semester_results');
        return response.data.data;
    },

    getSemesterResult: async (semester) => {
        const response = await api.get('/api/semester_results');
        const results = response.data.data || [];
        return results.find(r => r.semester == semester);
    },

    saveSemesterResult: async (data) => {
        const response = await api.post('/api/semester_results', data);
        return response.data.data;
    },

    deleteSemesterResult: async (semester) => {
        await api.delete(`/api/semester_results/${semester}`);
    },

    // ==================== Notices & Notifications ====================
    // Notices have a 4-hour cache TTL to reduce slow scraper calls
    getNotices: async (force = false) => {
        const key = 'uni_notices';
        const timestampKey = 'uni_notices_timestamp';
        const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

        if (!force) {
            const cached = await getCached(key);
            const cachedTimestamp = await getCached(timestampKey);

            // Check if cache is valid (within TTL)
            if (cached && cachedTimestamp) {
                const age = Date.now() - parseInt(cachedTimestamp, 10);
                if (age < CACHE_TTL) {
                    console.log(`📋 Notices served from cache (${Math.round(age / 60000)}min old)`);
                    return cached;
                }
            }
        }

        // Fetch fresh data - this may be slow due to IPU scraper
        console.log('🌐 Fetching fresh notices from server...');
        const response = await api.get('/api/notices');
        await setCached(key, response.data.data);
        await setCached(timestampKey, String(Date.now()));
        return response.data.data;
    },

    getNotifications: async () => {
        const response = await api.get('/api/notifications');
        return response.data.data;
    },

    // ==================== Manual Course Manager ====================
    getManualCourses: async () => {
        const response = await api.get('/api/courses/manual');
        return response.data.data;
    },

    saveManualCourses: async (courses) => {
        const response = await api.post('/api/courses/manual', courses);
        return response.data;
    },

    updateManualCourse: async (id, data) => {
        const response = await api.put(`/api/courses/manual/${id}`, data);
        return response.data;
    },

    deleteManualCourse: async (id) => {
        const response = await api.delete(`/api/courses/manual/${id}`);
        return response.data;
    },

    // ==================== Skills ====================
    getSkills: async () => {
        const response = await api.get('/api/skills');
        return response.data.data;
    },

    addSkill: async (skillData) => {
        const response = await api.post('/api/skills', skillData);
        return response.data.data;
    },

    updateSkill: async (id, skillData) => {
        const response = await api.put(`/api/skills/${id}`, skillData);
        return response.data.data;
    },

    deleteSkill: async (id) => {
        const response = await api.delete(`/api/skills/${id}`);
        return response.data.data;
    },
};
