import { Schema, model, Document, Types } from 'mongoose'

export interface ICertification extends Document {
    user_id: Types.ObjectId
    name: string
    issuer: string
    issue_date?: string
    url?: string
    credential_id?: string
    created_at: Date
    updated_at: Date
}

const CertificationSchema = new Schema<ICertification>(
    {
        user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        name: { type: String, required: true },
        issuer: { type: String, required: true },
        issue_date: { type: String },
        url: { type: String },
        credential_id: { type: String },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

export const Certification = model<ICertification>('Certification', CertificationSchema, 'certifications')
