import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '@/services/attendance.service';
import { useSemester } from '@/contexts/SemesterContext';

export const useNotifications = () => {
    const { currentSemester } = useSemester();
    return useQuery({
        queryKey: ['notifications', currentSemester],
        queryFn: () => attendanceService.getNotifications(currentSemester),
        staleTime: 15 * 1000, // 15 seconds stale time
        refetchOnWindowFocus: true,
    });
};
