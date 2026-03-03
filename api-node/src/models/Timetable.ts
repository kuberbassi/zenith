import { Schema, model, Document, Types } from 'mongoose'

interface TimetableSlot {
  id?: string
  subject_id?: string
  start_time?: string
  end_time?: string
  type?: string
  [key: string]: unknown
}

export interface ITimetable extends Document {
  user_id: Types.ObjectId
  semester: number
  schedule: Record<string, TimetableSlot[]>
  periods?: unknown[]
  updated_at: Date
}

const TimetableSchema = new Schema<ITimetable>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    semester: { type: Number, required: true, default: 1 },
    schedule: { type: Schema.Types.Mixed, default: {} },
    periods: { type: [Schema.Types.Mixed] },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
)

TimetableSchema.index({ user_id: 1, semester: 1 }, { unique: true })

export const Timetable = model<ITimetable>('Timetable', TimetableSchema, 'timetable')
