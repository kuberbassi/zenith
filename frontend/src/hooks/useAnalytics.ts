
import { useQuery } from '@tanstack/react-query';
import { attendanceService } from '@/services/attendance.service';
import { useSemester } from '@/contexts/SemesterContext';

export const useAnalytics = () => {
    const { currentSemester } = useSemester();

    const dayOfWeekQuery = useQuery({
        queryKey: ['analytics', 'dayOfWeek', currentSemester],
        queryFn: () => attendanceService.getDayOfWeekAnalytics(currentSemester),
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true,
    });

    const reportsQuery = useQuery({
        queryKey: ['analytics', 'reports', currentSemester],
        queryFn: () => attendanceService.getReportsData(currentSemester),
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true,
    });

    return {
        dayOfWeekData: dayOfWeekQuery.data,
        reportsData: reportsQuery.data,
        loading: dayOfWeekQuery.isLoading || reportsQuery.isLoading,
        error: dayOfWeekQuery.error || reportsQuery.error,
        refetch: async () => {
            await Promise.all([dayOfWeekQuery.refetch(), reportsQuery.refetch()]);
        }
    };
};
