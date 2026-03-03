import { Schema, model, Document, Types } from 'mongoose'

export interface IUserBackup extends Document {
  user_id: Types.ObjectId
  backup_type: string
  data: Record<string, unknown>
  created_at: Date
  expires_at: Date
}

const UserBackupSchema = new Schema<IUserBackup>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    backup_type: { type: String, default: 'pre_delete_auto' },
    data: { type: Schema.Types.Mixed, default: {} },
    created_at: { type: Date, default: Date.now },
    expires_at: { type: Date, required: true },
  },
  { timestamps: false },
)

UserBackupSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 })

export const UserBackup = model<IUserBackup>('UserBackup', UserBackupSchema, 'user_backups')
