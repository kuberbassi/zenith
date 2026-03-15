
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
async function run() {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql.query('SELECT id, name FROM \subjects\ LIMIT 5');  
  console.log('Subjects:', rows);
}
run();

