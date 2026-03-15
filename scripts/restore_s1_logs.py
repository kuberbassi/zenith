import json
import psycopg2
from psycopg2.extras import execute_values
import os
import re
import random
import string

def generate_cuid():
    # Mimicking a cuid-like ID (starts with 'c', followed by alphanumeric)
    return 'c' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=24))

# Database connection details from .env (hardcoded for simplicity in this script, or parsed)

DATABASE_URL = "postgresql://neondb_owner:npg_BfZNeVgzY3O4@ep-royal-resonance-a4tmdnsq-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
BACKUP_FILE = r'c:\Users\kuber\Documents\Dev\Projects\acadhub\acadhub-data-2026-03-03.json'
USER_EMAIL = 'kuber@hmritm.ac.in'

def main():
    print("Starting restoration process...")
    
    # 1. Connect to DB
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        # 2. Get User ID
        cur.execute("SELECT id FROM users WHERE email = %s", (USER_EMAIL,))
        res = cur.fetchone()
        if not res:
            print(f"User {USER_EMAIL} not found!")
            return
        user_id = res[0]
        print(f"Found User ID: {user_id}")
        
        # 3. Get Current Subjects for mapping
        cur.execute("SELECT id, name, semester FROM subjects WHERE user_id = %s", (user_id,))
        db_subjects = cur.fetchall()
        # Mapping: {(name.lower(), semester): id}
        subject_map = {(s[1].lower().strip(), s[2]): s[0] for s in db_subjects}
        print(f"Mapped {len(subject_map)} internal subjects.")
        
        # 4. Load Backup JSON
        with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
        
        # Mapping old subject IDs to names from backup
        old_subject_id_to_name = {}
        for sub in backup_data['data'].get('subjects', []):
            old_id = sub['_id']['$oid'] if isinstance(sub['_id'], dict) else sub['_id']
            old_subject_id_to_name[old_id] = (sub['name'].lower().strip(), sub.get('semester', 1))

        # 5. Extract and Remap Semester 1 Logs
        all_logs = backup_data['data'].get('attendance_logs', [])
        s1_logs_to_insert = []
        
        print(f"Total logs in backup: {len(all_logs)}")
        
        for log in all_logs:
            if log.get('semester') != 1:
                continue
            
            old_sub_id = log['subject_id']['$oid'] if isinstance(log['subject_id'], dict) else log['subject_id']
            if old_sub_id not in old_subject_id_to_name:
                # Try by subject_name if available in log
                sub_name = log.get('subject_name', '').lower().strip()
                sub_key = (sub_name, 1)
            else:
                sub_key = old_subject_id_to_name[old_sub_id]
            
            new_sub_id = subject_map.get(sub_key)
            
            if new_sub_id:
                # Prepare for bulk insert: (id, user_id, subject_id, subject_name, date, status, type, notes, semester, substituted_by, timestamp)
                # Prisma cuid() is ~25 chars. We'll generate a dummy ID for the table if not handled by default, 
                # but better to let DB handle it or use a random one.
                # Table schema: user_id, subject_id, subject_name, date, status, type, notes, semester, substituted_by, timestamp
                
                # Format timestamp from $date dict if needed
                ts = log.get('timestamp')
                if isinstance(ts, dict) and '$date' in ts:
                    ts = ts['$date']
                
                s1_logs_to_insert.append((
                    generate_cuid(),
                    user_id,
                    new_sub_id,
                    log.get('subject_name', sub_key[0].title()),
                    log['date'],
                    log['status'],
                    log.get('type', 'Lecture'),
                    log.get('notes'),
                    1, # semester
                    log.get('substituted_by'),
                    ts
                ))
        
        print(f"Extracted {len(s1_logs_to_insert)} Semester-1 logs for insertion.")
        
        # 6. Bulk Insert with Conflict Handling
        if s1_logs_to_insert:
            # We use %s for values to be handled by psycopg2. Extras execute_values handles the tuple.
            insert_query = """
                INSERT INTO attendance_logs (id, user_id, subject_id, subject_name, date, status, type, notes, semester, substituted_by, timestamp)
                VALUES %s
                ON CONFLICT (user_id, subject_id, date, type) DO NOTHING
            """
            execute_values(cur, insert_query, s1_logs_to_insert)
            print(f"Bulk insertion completed.")


        
        # 7. Recalculate Subject Stats
        print("Recalculating subject stats...")
        for name_sem, sub_id in subject_map.items():
            if name_sem[1] == 1:
                # Total
                cur.execute("SELECT COUNT(*) FROM attendance_logs WHERE subject_id = %s", (sub_id,))
                total = cur.fetchone()[0]
                # Attended (present, late, duty, medical, approved_medical)
                cur.execute("""
                    SELECT COUNT(*) FROM attendance_logs 
                    WHERE subject_id = %s AND status IN ('present', 'late', 'duty', 'medical', 'approved_medical')
                """, (sub_id,))
                attended = cur.fetchone()[0]
                
                cur.execute("UPDATE subjects SET attended = %s, total = %s WHERE id = %s", (attended, total, sub_id))
        
        conn.commit()
        print("Restoration and stats update successful!")

    except Exception as e:
        conn.rollback()
        print(f"Error occurred: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
