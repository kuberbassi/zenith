import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dashboardApi, attendanceApi } from '@/lib/api'
import type { DashboardData } from '@/types'

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await dashboardApi.getDashboard()
      return res.data
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function useMarkAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      subjectId,
      status,
    }: {
      subjectId: string
      status: 'present' | 'absent' | 'cancelled'
    }) => attendanceApi.mark(subjectId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
