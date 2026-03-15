
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_u1K7xXJpsWdb@ep-billowing-sky-a5a4j584-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require' });

async function run() {
  const { rows } = await pool.query('SELECT user_id FROM manual_courses LIMIT 1');
  const userId = rows[0].user_id;
  const token = jwt.sign({ id: userId, version: 1 }, process.env.JWT_SECRET || 'your-secret-key');
  pool.end();
  
  const res = await fetch('http://localhost:5001/api/academic/courses/manual', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', res.status);
  const json = await res.json();
  console.log('JSON Output:', JSON.stringify(json));
}
run().catch(console.error);

