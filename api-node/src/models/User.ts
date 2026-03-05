import { Schema, model, Document } from 'mongoose'

export interface IUser extends Document {
  google_id: string
  email: string
  name: string
  picture?: string
  // profile fields
  branch?: string
  course?: string
  college?: string
  batch?: string
  enrollment_number?: string
  phone_number?: string
  headline?: string
  linkedin_url?: string
  github_url?: string
  portfolio_url?: string
  semester?: number          // Flask legacy field
  current_semester: number
  target_attendance: number
  attendance_threshold: number
  warning_threshold: number
  // biometrics: keyed by device_id
  biometrics?: Record<string, { public_key: string; registered_at: Date }>
  created_at: Date
  updated_at: Date
}

const UserSchema = new Schema<IUser>(
  {
    google_id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    picture: { type: String },
    branch: { type: String },
    course: { type: String },
    college: { type: String },
    batch: { type: String },
    enrollment_number: { type: String },
    phone_number: { type: String },
    headline: { type: String },
    linkedin_url: { type: String },
    github_url: { type: String },
    portfolio_url: { type: String },
    current_semester: { type: Number, default: 1 },
    target_attendance: { type: Number, default: 75 },
    attendance_threshold: { type: Number, default: 75 },
    warning_threshold: { type: Number, default: 76 },
    biometrics: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform: (_doc, ret: any) => {
        delete ret.google_id
        delete ret.biometrics
        delete ret.__v
        return ret
      }
    },
    toObject: {
      transform: (_doc, ret: any) => {
        delete ret.google_id
        delete ret.biometrics
        delete ret.__v
        return ret
      }
    }
  },
)

export const User = model<IUser>('User', UserSchema, 'users')
