import { Schema, model, Document, Types } from 'mongoose'

interface PracticalInfo {
  total: number
  completed: number
  hardcopy: boolean
}

interface AssignmentInfo {
  total: number
  completed: number
  hardcopy: boolean
}

export interface ISubject extends Document {
  user_id: Types.ObjectId
  name: string
  code?: string
  professor?: string
  classroom?: string
  semester: number
  type?: string
  credits?: number
  attended: number
  total: number
  target: number
  categories?: string[]
  practicals?: PracticalInfo
  assignments?: AssignmentInfo
  syllabus?: string
  created_at: Date
  updated_at: Date
}

const SubjectSchema = new Schema<ISubject>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    code: { type: String, default: '' },
    professor: { type: String, default: '' },
    classroom: { type: String, default: '' },
    semester: { type: Number, required: true, default: 1 },
    type: { type: String, default: 'theory' },
    credits: { type: Number },
    attended: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    target: { type: Number, default: 75, min: 0, max: 100 },
    categories: [{ type: String }],
    practicals: {
      type: new Schema(
        { total: { type: Number, default: 10 }, completed: { type: Number, default: 0 }, hardcopy: { type: Boolean, default: false } },
        { _id: false },
      ),
    },
    assignments: {
      type: new Schema(
        { total: { type: Number, default: 4 }, completed: { type: Number, default: 0 }, hardcopy: { type: Boolean, default: false } },
        { _id: false },
      ),
    },
    syllabus: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

SubjectSchema.index({ user_id: 1, semester: 1 })
SubjectSchema.index({ user_id: 1, name: 1 })

export const Subject = model<ISubject>('Subject', SubjectSchema, 'subjects')
