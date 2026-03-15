
import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_u1K7xXJpsWdb@ep-billowing-sky-a5a4j584-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require' });
async function start() {
    const res = await pool.query('SELECT id, name FROM subjects LIMIT 5');      
    console.log('Subjects:', res.rows);
    pool.end();
}   
start();

