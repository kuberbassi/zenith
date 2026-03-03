import api from './api';

export const dashboardService = {
    getData: async (semester: number) => {
        const response = await api.get(`/api/dashboard/data?semester=${semester}`);
        return response.data;
    }
};
