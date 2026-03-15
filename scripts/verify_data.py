import psycopg2

DATABASE_URL = 'postgresql://neondb_owner:npg_BfZNeVgzY3O4@ep-royal-resonance-a4tmdnsq-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'

def verify():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    emails = ['kuber@hmritm.ac.in', 'kuberbassi2007@gmail.com']
    print("\nData Verification Report:")
    print("-" * 30)
    
    for email in emails:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        user_res = cur.fetchone()
        if not user_res:
            print(f"User {email} not found!")
            continue
        
        uid = user_res[0]
        print(f"\nAccount: {email}")
        
        cur.execute("SELECT count(*) FROM subjects WHERE user_id = %s", (uid,))
        print(f"  Subjects: {cur.fetchone()[0]}")
        
        cur.execute("SELECT count(*) FROM attendance_logs WHERE user_id = %s", (uid,))
        print(f"  Attendance Logs: {cur.fetchone()[0]}")
        
        cur.execute("SELECT count(*) FROM manual_courses WHERE user_id = %s", (uid,))
        print(f"  Manual Courses: {cur.fetchone()[0]}")
        
        cur.execute("SELECT semester, schedule FROM timetable WHERE user_id = %s", (uid,))
        tt = cur.fetchall()
        print(f"  Timetables (Semesters): {[t[0] for t in tt]}")
        if tt:
            # Check for broken subject IDs in the first timetable found
            sched = tt[0][1]
            broken = 0
            total_slots = 0
            for day, slots in sched.items():
                if isinstance(slots, list):
                    for slot in slots:
                        sub_id = slot.get('subject_id')
                        if sub_id:
                            total_slots += 1
                            cur.execute("SELECT id FROM subjects WHERE id = %s", (sub_id,))
                            if not cur.fetchone(): broken += 1
            print(f"  Timetable Integrity: {total_slots - broken}/{total_slots} valid slots")

    cur.close()
    conn.close()

if __name__ == "__main__":
    verify()
