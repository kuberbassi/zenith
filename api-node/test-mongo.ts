import mongoose from 'mongoose';
import { ENV } from './src/config/env.js';

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://kuber:kuber2005@cluster0.oevy1.mongodb.net/acadhub?retryWrites=true&w=majority').then(async () => {
  const db = mongoose.connection.db;
  const courses = await db!.collection('manual_courses').find({}).toArray();
  console.log('Mongo courses count:', courses.length);
  if (courses.length > 0) {
      console.log('Sample course:', JSON.stringify(courses[0], null, 2));
  }
  process.exit(0);
}).catch(console.error);
