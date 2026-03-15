
import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '@/services/attendance.service';

export const useNotices = () => {
    return useQuery({
        queryKey: ['notices'],
        queryFn: async () => {
            const notices = await attendanceService.getNotices();
            if (Array.isArray(notices)) {
                return notices.sort((a: any, b: any) => {
                    const toTime = (value: string) => {
                        const [dd, mm, yyyy] = String(value || '').split('-');
                        if (!dd || !mm || !yyyy) return 0;
                        return new Date(`${yyyy}-${mm}-${dd}T00:00:00`).getTime();
                    };
                    return toTime(b.date) - toTime(a.date);
                });
            }
            return notices;
        },
        staleTime: 30 * 60 * 1000, // 30 minutes cache
        refetchOnWindowFocus: false,
    });
};
