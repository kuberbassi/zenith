import axios from 'axios'

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach JWT token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('acadhub_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Handle 401 — clear token & redirect
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('acadhub_token')
        localStorage.removeItem('acadhub_user')
        window.location.href = '/'
      }
    }
    return Promise.reject(err)
  },
)

export default api

/* -------------------------------- Auth -------------------------------- */
export const authApi = {
  googleLogin: (credential: string) =>
    api.post('/api/auth/google', { credential }),
  getMe: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
}

/* ----------------------------- Dashboard ------------------------------ */
export const dashboardApi = {
  getDashboard: () => api.get('/api/attendance/dashboard'),
}

/* ----------------------------- Subjects ------------------------------- */
export const subjectsApi = {
  getAll: () => api.get('/api/subjects'),
  create: (data: { name: string; code?: string; professor?: string; target?: number }) =>
    api.post('/api/subjects', data),
  update: (id: string, data: Partial<{ name: string; code: string; professor: string; target: number }>) =>
    api.put(`/api/subjects/${id}`, data),
  delete: (id: string) => api.delete(`/api/subjects/${id}`),
}

/* --------------------------- Attendance ------------------------------- */
export const attendanceApi = {
  mark: (subjectId: string, status: 'present' | 'absent' | 'cancelled') =>
    api.post('/api/attendance/mark', { subject_id: subjectId, status }),
  getLogs: (params?: { limit?: number; page?: number; subject_id?: string }) =>
    api.get('/api/attendance/logs', { params }),
  bulkMark: (records: { subject_id: string; status: 'present' | 'absent' | 'cancelled' }[]) =>
    api.post('/api/attendance/bulk', { records }),
}
