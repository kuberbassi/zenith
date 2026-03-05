import { Schema, model, Document, Types } from 'mongoose'

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'approved_medical'
  | 'medical'
  | 'duty'
  | 'substituted'
  | 'cancelled'

export const COUNTED_STATUSES: AttendanceStatus[] = [
  'present', 'absent', 'late', 'approved_medical', 'medical', 'duty',
]
export const ATTENDED_STATUSES: AttendanceStatus[] = [
  'present', 'late', 'approved_medical', 'medical', 'duty',
]

export interface IAttendanceLog extends Document {
  user_id: Types.ObjectId
  subject_id: Types.ObjectId
  subject_name: string
  date: string              // YYYY-MM-DD
  status: AttendanceStatus
  type?: string             // Lecture | Lab | Tutorial | substitution_class
  notes?: string
  semester?: number
  substituted_by?: Types.ObjectId
  timestamp: Date
}

const AttendanceLogSchema = new Schema<IAttendanceLog>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject_id: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    subject_name: { type: String, required: true },
    date: { type: String, required: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'approved_medical', 'medical', 'duty', 'substituted', 'cancelled'],
      required: true,
    },
    type: { type: String, default: 'Lecture' },
    notes: { type: String },
    semester: { type: Number },
    substituted_by: { type: Schema.Types.ObjectId, ref: 'Subject' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false },
)

AttendanceLogSchema.index({ user_id: 1, date: -1 })
AttendanceLogSchema.index({ user_id: 1, subject_id: 1 })
AttendanceLogSchema.index({ user_id: 1, semester: 1, date: 1 })
// UNIQUE INDEX: Prevents race conditions during rapid /mark API calls
AttendanceLogSchema.index({ user_id: 1, subject_id: 1, date: 1, type: 1 }, { unique: true })

export const AttendanceLog = model<IAttendanceLog>('AttendanceLog', AttendanceLogSchema, 'attendance_logs')
