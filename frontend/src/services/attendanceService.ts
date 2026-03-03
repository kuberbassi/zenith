import api from './api';

export interface DashboardData {
    overall_attendance: number;
    subjects_overview: Array<{
        subject: string;
        present: number;
        absent: number;
        total_lectures: number;
        percentage: number;
        code?: string;
    }>;
    recent_logs: Array<{
        date: string;
        subject: string;
        status: string;
    }>;
}

export const attendanceService = {
    getDashboardData: async (semester: number): Promise<DashboardData> => {
        const response = await api.get(`/api/dashboard/data?semester=${semester}`);
        return response.data;
    }
};
