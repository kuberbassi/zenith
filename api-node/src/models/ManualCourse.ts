import { Schema, model, Document, Types } from 'mongoose'

export interface IManualCourse extends Document {
  user_id: Types.ObjectId
  name?: string
  platform?: string
  status?: string
  progress?: number
  url?: string
  notes?: string
  [key: string]: unknown
  created_at: Date
}

const ManualCourseSchema = new Schema<IManualCourse>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String },
    platform: { type: String },
    status: { type: String },
    progress: { type: Number, default: 0 },
    url: { type: String },
    notes: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, strict: false },
)

export const ManualCourse = model<IManualCourse>('ManualCourse', ManualCourseSchema, 'manual_courses')
