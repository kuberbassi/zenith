import psycopg2
import json

DATABASE_URL = 'postgresql://neondb_owner:npg_BfZNeVgzY3O4@ep-royal-resonance-a4tmdnsq-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'

def check_primary_timetable():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM users WHERE email = 'kuber@hmritm.ac.in'")
    uid = cur.fetchone()[0]
    
    cur.execute("SELECT semester, schedule FROM timetable WHERE user_id = %s", (uid,))
    res = cur.fetchall()
    print(f"Count: {len(res)}")
    for sem, schedule in res:
        print(f"\nSemester {sem}:")
        print(json.dumps(schedule, indent=2))
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_primary_timetable()
