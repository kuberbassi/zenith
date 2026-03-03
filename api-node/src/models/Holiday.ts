import { Schema, model, Document, Types } from 'mongoose'

export interface IHoliday extends Document {
  user_id: Types.ObjectId
  date: string
  name: string
  created_at: Date
}

const HolidaySchema = new Schema<IHoliday>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    name: { type: String, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

HolidaySchema.index({ user_id: 1, date: 1 })

export const Holiday = model<IHoliday>('Holiday', HolidaySchema, 'holidays')
