import { Schema, model, Document, Types } from 'mongoose'

export interface ISystemLog extends Document {
  user_id: Types.ObjectId
  action: string
  description: string
  ip?: string
  user_agent?: string
  timestamp: Date
}

const SystemLogSchema = new Schema<ISystemLog>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true },
    description: { type: String, required: true },
    ip: { type: String },
    user_agent: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false },
)

SystemLogSchema.index({ user_id: 1, timestamp: -1 })

export const SystemLog = model<ISystemLog>('SystemLog', SystemLogSchema, 'system_logs')
