import { Schema, model, Document, Types } from 'mongoose'

export interface IProject extends Document {
    user_id: Types.ObjectId
    name: string
    description: string
    url?: string
    github_url?: string
    start_date?: string
    end_date?: string
    current: boolean
    technologies: string[]
    created_at: Date
    updated_at: Date
}

const ProjectSchema = new Schema<IProject>(
    {
        user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        name: { type: String, required: true },
        description: { type: String, required: true },
        url: { type: String },
        github_url: { type: String },
        start_date: { type: String },
        end_date: { type: String },
        current: { type: Boolean, default: false },
        technologies: [{ type: String }],
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
)

export const Project = model<IProject>('Project', ProjectSchema, 'projects')
