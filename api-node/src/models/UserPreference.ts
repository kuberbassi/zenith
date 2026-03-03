import { Schema, model, Document, Types } from 'mongoose'

export interface IUserPreference extends Document {
  user_id: Types.ObjectId
  preferences: Record<string, unknown>
  updated_at: Date
}

const UserPreferenceSchema = new Schema<IUserPreference>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    preferences: { type: Schema.Types.Mixed, default: {} },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
)

export const UserPreference = model<IUserPreference>('UserPreference', UserPreferenceSchema, 'user_preferences')
