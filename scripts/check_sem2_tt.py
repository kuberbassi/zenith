import psycopg2
import json

DATABASE_URL = 'postgresql://neondb_owner:npg_BfZNeVgzY3O4@ep-royal-resonance-a4tmdnsq-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'

def check_sem2():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM users WHERE email = 'kuber@hmritm.ac.in'")
    uid = cur.fetchone()[0]
    
    cur.execute("SELECT schedule FROM timetable WHERE user_id = %s AND semester = 2", (uid,))
    res = cur.fetchone()
    if res:
        print("Semester 2 Timetable Found:")
        print(json.dumps(res[0], indent=2))
        
        # Check integrity
        sched = res[0]
        for day, slots in sched.items():
            for slot in slots:
                sub_id = slot.get('subject_id')
                if sub_id:
                    cur.execute("SELECT name FROM subjects WHERE id = %s", (sub_id,))
                    sub_res = cur.fetchone()
                    print(f"  {day} Slot: {slot.get('name', 'N/A')} -> Subject: {sub_res[0] if sub_res else 'NOT FOUND (' + sub_id + ')'}")
    else:
        print("No Semester 2 Timetable Found")
        
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_sem2()
