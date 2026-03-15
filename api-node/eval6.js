
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
async function run() {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql.query('SELECT schedule, periods FROM timetable LIMIT 1');
  console.log('Type of schedule:', typeof rows[0].schedule);
  console.log('Value:', JSON.stringify(rows[0].schedule).substring(0, 100));    
}
run();

