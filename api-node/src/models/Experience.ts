import { Schema, model, Document, Types } from 'mongoose'

export interface IExperience extends Document {
    user_id: Types.ObjectId
    company: string
    role: string
    start_date: string
    end_date?: string
    current: boolean
    description?: string
    location?: string
    created_at: Date
    updated_at: Date
}

const ExperienceSchema = new Schema<IExperience>(
    {
        user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        company: { type: String, required: true },
        role: { type: String, required: true },
        start_date: { type: String, required: true },
        end_date: { type: String },
        current: { type: Boolean, default: false },
        description: { type: String },
        location: { type: String },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

export const Experience = model<IExperience>('Experience', ExperienceSchema, 'experiences')
