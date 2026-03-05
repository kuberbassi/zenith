import mongoose from 'mongoose';
import { Subject } from './src/models/Subject.js';
import './src/config/env.js';

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const subjects = await Subject.find({}).limit(5);
    console.log('Sample Subjects:', JSON.stringify(subjects, null, 2));
    const counts = await Subject.aggregate([
        { $group: { _id: '$semester', count: { $sum: 1 } } }
    ]);
    console.log('Counts by Semester:', counts);
    process.exit(0);
}
check();
