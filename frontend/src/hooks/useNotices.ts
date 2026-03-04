
import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '@/services/attendance.service';

export const useNotices = () => {
    return useQuery({
        queryKey: ['notices'],
        queryFn: async () => {
            const notices = await attendanceService.getNotices();
            if (Array.isArray(notices)) {
                return notices.sort((a: any, b: any) => {
                    if (!a.date || !b.date) return 0;
                    const pA = String(a.date).split('-');
                    const pB = String(b.date).split('-');
                    if (pA.length === 3 && pB.length === 3) {
                        const dA = new Date(`${pA[2]}-${pA[1]}-${pA[0]}`).getTime();
                        const dB = new Date(`${pB[2]}-${pB[1]}-${pB[0]}`).getTime();
                        return dB - dA;
                    }
                    return 0;
                });
            }
            return notices;
        },
        staleTime: 30 * 60 * 1000, // 30 minutes cache
        refetchOnWindowFocus: false,
    });
};
