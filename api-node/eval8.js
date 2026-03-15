
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
async function run() {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql.query('SELECT * FROM \subjects\ LIMIT 1');  
  console.log('Columns:', Object.keys(rows[0] || {}));
  console.log('Value:', rows[0]);
}
run();

