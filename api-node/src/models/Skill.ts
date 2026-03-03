import { Schema, model, Document, Types } from 'mongoose'

export interface ISkill extends Document {
  user_id: Types.ObjectId
  name: string
  category?: string
  level?: string
  progress: number
  notes?: string
  created_at: Date
  updated_at: Date
}

const SkillSchema = new Schema<ISkill>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    category: { type: String },
    level: { type: String },
    progress: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

export const Skill = model<ISkill>('Skill', SkillSchema, 'skills')
