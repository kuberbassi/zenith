export interface Subject {
  _id: string
  name: string
  code?: string
  attended: number
  total: number
  professor?: string
  categories?: string[]
  target?: number
}

export interface AttendanceLog {
  _id: string
  subject_id: string
  subject_name: string
  date: string
  status: 'present' | 'absent' | 'cancelled'
  marked_at: string
}

export interface SemesterResult {
  semester: number
  year: number
  sgpa?: number
  cgpa?: number
  subjects_results?: {
    name: string
    grade: string
    credits: number
  }[]
}

export interface DashboardData {
  overall_attendance: number
  subjects: Subject[]
  recent_logs: AttendanceLog[]
  current_semester: number
  total_subjects: number
  user?: {
    name: string
    email: string
    picture?: string
  }
}

export interface BunkGuardResult {
  percentage: number
  can_bunk: number
  count: number
  status_message: string
  risk: 'safe' | 'warning' | 'danger'
}

export interface User {
  _id: string
  name: string
  email: string
  picture?: string
  google_id: string
  current_semester?: number
  target_attendance?: number
  created_at: string
}

export type RiskLevel = 'safe' | 'warning' | 'danger'

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}
