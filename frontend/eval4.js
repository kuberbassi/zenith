
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_u1K7xXJpsWdb@ep-billowing-sky-a5a4j584-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require' });
async function start() {
    const res = await pool.query('SELECT schedule, periods FROM timetables LIMIT 1');
    console.log(typeof res.rows[0].schedule);
    pool.end();
}
start();

