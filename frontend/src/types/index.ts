export interface User {
    _id?: string;
    email: string;
    name: string;
    picture?: string;
    course?: string;
    branch?: string;
    college?: string;
    semester?: number;
    current_semester?: number;
    batch?: string;
    enrollment_number?: string;
    attendance_threshold?: number;
    warning_threshold?: number;
    target_attendance?: number;
    google_id?: string;
    created_at?: string;
}

export interface IPUCaptchaResponse {
    captcha_image: string;
    hidden_fields: Record<string, string>;
    field_names: { username: string; password: string; captcha: string };
}

export interface IPUSubjectResult {
    name?: string;
    code?: string;
    credits?: string;
    internal?: string;
    external?: string;
    marks?: string;
    grade?: string;
    status?: string;
}

export interface IPUSemesterResult {
    subjects: IPUSubjectResult[];
}

export interface IPUFetchResult {
    enrollment_number: string;
    student_info: Record<string, string>;
    semesters: IPUSemesterResult[];
    raw_tables: { headers: string[]; rows: Record<string, string>[] }[];
}

export interface Subject {
    _id: string;
    owner_email: string;
    name: string;
    semester: number;
    attended: number;
    total: number;
    professor?: string;
    classroom?: string;
    code?: string;
    category?: string; // Legacy single category
    categories?: string[]; // e.g. ['Theory', 'Practical', 'Assignment']
    syllabus?: string;
    created_at: string;
    practicals?: {
        total: number;
        completed: number;
        hardcopy: boolean;
    };
    assignments?: {
        total: number;
        completed: number;
        hardcopy: boolean;
    };
}

export interface SystemLog {
    _id: string;
    action: string;
    description: string;
    timestamp: { $date: number } | string;
}

export interface AcademicRecord {
    _id?: string;
    semester: number;
    sgpa: number;
    cgpa: number;
    credits: number;
    timestamp?: string;
}

export interface SubjectResult {
    name: string;
    code?: string;
    credits: number;
    type: 'theory' | 'practical' | 'nues';
    internal_theory?: number;
    external_theory?: number;
    internal_practical?: number;
    external_practical?: number;
    total_marks?: number;
    max_marks?: number;
    percentage?: number;
    grade?: string;
    grade_point?: number;
}

export interface SemesterResult {
    _id?: string;
    semester: number;
    subjects: SubjectResult[];
    total_credits: number;
    sgpa: number;
    cgpa?: number;
    timestamp?: string;
}

export interface AttendanceLog {
    _id: string;
    owner_email: string;
    subject_id: string;
    date: string;
    status: 'present' | 'absent' | 'pending_medical' | 'approved_medical' | 'substituted' | 'substitution_resolved' | 'cancelled';
    timestamp: string;
    semester: number;
    notes?: string;
    subject_info?: Subject;
    substituted_by?: string;
}

export interface AcadHubStatus {
    status: 'safe' | 'danger' | 'neutral';
    status_message: string;
    percentage: number;
}

export interface SubjectOverview extends AcadHubStatus {
    id: string;
    name: string;
    code?: string;
    professor?: string;
    classroom?: string;
    attended: number;
    total: number;
}

export interface DashboardData {
    current_date: string;
    overall_attendance: number;
    subjects_overview: SubjectOverview[];
    subjects: Array<Subject & { attendance_percentage: number; status_message: string }>;
    recent_logs: Array<{ date: string; subject: string; status: string }>;
    current_semester: number;
    total_subjects: number;
}

export interface ReportsKPI {
    best_subject_name: string;
    best_subject_percent: string;
    worst_subject_name: string;
    worst_subject_percent: string;
    total_absences: number;
}

export interface ReportsData {
    kpis: ReportsKPI;
    subject_breakdown: Array<Subject & { percentage: number }>;
    heatmap_data: Record<string, string[]>;
}

export interface Deadline {
    _id: string;
    owner_email: string;
    title: string;
    due_date: string;
    completed: boolean;
    created_at: string;
}

export interface Holiday {
    _id: string;
    owner_email: string;
    date: string;
    name: string;
}

export interface TimetableSlot {
    _id?: string;
    id?: string;       // backend stores slots with 'id' field
    day: string;
    start_time: string; // HH:MM
    end_time: string;   // HH:MM
    subject_id?: string;
    type?: 'class' | 'break' | 'free' | 'custom';
    label?: string;     // Optional override label
}

export type TimetableSchedule = Record<string, TimetableSlot[]>;

export interface GridPeriod {
    id: string;
    name: string;      // "1", "2", "Lunch"
    startTime: string; // "08:30"
    endTime: string;   // "09:30"
    type: 'class' | 'break';
}


export interface Preferences {
    attendance_threshold?: number;
    warning_threshold?: number; // Legacy - being replaced by min_attendance
    min_attendance?: number;    // New field matching API/Mobile
    counting_mode?: 'classes' | 'percentage';
    notifications_enabled?: boolean;
    accent_color?: string;
    threshold?: number; // legacy
}
