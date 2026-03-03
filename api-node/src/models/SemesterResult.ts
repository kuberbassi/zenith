import { Schema, model, Document, Types } from 'mongoose'

interface ProcessedSubject {
  name: string
  code?: string
  credits: number
  grade?: string
  grade_point?: number
  total_marks?: number
  max_marks?: number
  percentage?: number
  internal?: string
  external?: string
  internal_theory?: number
  external_theory?: number
  internal_practical?: number
  external_practical?: number
  status?: string
  [key: string]: unknown
}

export interface ISemesterResult extends Document {
  user_id: Types.ObjectId
  owner_email?: string
  enrollment_number?: string
  semester: number
  semester_label?: string
  subjects: ProcessedSubject[]
  sgpa: number
  total_credits: number
  total_marks?: string
  max_marks?: string
  student_info?: Record<string, string>
  source?: 'manual' | 'ipu_scraper'
  updated_at: Date
}

const SemesterResultSchema = new Schema<ISemesterResult>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    owner_email: { type: String, index: true },
    enrollment_number: { type: String, index: true },
    semester: { type: Number, required: true },
    semester_label: { type: String },
    subjects: { type: Schema.Types.Mixed, default: [] },
    sgpa: { type: Number, default: 0 },
    total_credits: { type: Number, default: 0 },
    total_marks: { type: String },
    max_marks: { type: String },
    student_info: { type: Schema.Types.Mixed },
    source: { type: String, enum: ['manual', 'ipu_scraper'], default: 'manual' },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
)

SemesterResultSchema.index({ user_id: 1, semester: 1 }, { unique: true })

export const SemesterResult = model<ISemesterResult>('SemesterResult', SemesterResultSchema, 'semester_results')
