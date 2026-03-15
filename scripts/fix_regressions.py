import json
import psycopg2
from psycopg2.extras import execute_values
import uuid
import random
import string

DATABASE_URL = "postgresql://neondb_owner:npg_BfZNeVgzY3O4@ep-royal-resonance-a4tmdnsq-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
BACKUP_FILE = r'C:\Users\kuber\Downloads\acadhub-data-2026-03-03.json'

EMAILS = {
    'primary': 'kuber@hmritm.ac.in',
    'secondary': 'kuberbassi2007@gmail.com'
}

STATUS_MAP = {
    'Present': 'present', 'Absent': 'absent', 'Cancelled': 'cancelled', 'Late': 'late',
    'p': 'present', 'a': 'absent', 'c': 'cancelled', 'l': 'late'
}

LOG_TYPE_MAP = {
    'Lecture': 'Lecture', 'Practical': 'class', 'Tutorial': 'Lecture', 'Substitution': 'substitution_class'
}

def generate_cuid():
    return 'c' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=24))

def parse_semester(val):
    if val is None: return 1
    if isinstance(val, int): return val
    if isinstance(val, str):
        val = val.lower()
        if 'sem' in val:
            try: return int(val.replace('sem', '').strip())
            except: pass
        try: return int(val)
        except: return 1
    return 1

def clean_val(obj):
    if isinstance(obj, dict):
        if '$oid' in obj: return obj['$oid']
        if '$date' in obj: return obj['$date']
        if '$numberInt' in obj: return int(obj['$numberInt'])
        if '$numberLong' in obj: return int(obj['$numberLong'])
        if '$numberDouble' in obj: return float(obj['$numberDouble'])
        if '$numberDecimal' in obj: return float(obj['$numberDecimal'])
        return {k: clean_val(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_val(i) for i in obj]
    return obj

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        # 1. Get or Create User IDs
        users = {}
        for role, email in EMAILS.items():
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            res = cur.fetchone()
            if res:
                users[role] = res[0]
                print(f"Found {role} user: {email} -> {res[0]}")
            else:
                uid = generate_cuid()
                # Create a minimal user record
                name = email.split('@')[0].capitalize()
                google_id = f"auto_{uid}"
                cur.execute(
                    "INSERT INTO users (id, email, name, google_id, created_at, updated_at) VALUES (%s, %s, %s, %s, NOW(), NOW())",
                    (uid, email, name, google_id)
                )
                users[role] = uid
                print(f"Created {role} user: {email} -> {uid}")
        
        if 'primary' not in users: return print("Primary user not found!")

        # 2. Load and Clean Backup JSON
        print("Loading and cleaning backup JSON...")
        with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
        backup_data = clean_val(raw_data)
        
        subjects_data = backup_data['data'].get('subjects', [])
        old_id_to_meta = {}
        for s in subjects_data:
            sem = parse_semester(s.get('semester', 1))
            old_id_to_meta[s['_id']] = {'name': s['name'].lower().strip(), 'semester': sem, 'raw_name': s['name']}

        # ─── PRIMARY ACCOUNT FIXES ───
        p_uid = users['primary']
        print(f"\nFixing Primary Account: {EMAILS['primary']}")
        
        cur.execute("SELECT id, name, semester FROM subjects WHERE user_id = %s", (p_uid,))
        p_sub_map = {(s[1].lower().strip(), s[2]): s[0] for s in cur.fetchall()}
        p_subs_to_create = []
        for s in subjects_data:
            sem = parse_semester(s.get('semester', 1))
            key = (s['name'].lower().strip(), sem)
            if key not in p_sub_map:
                nid = generate_cuid()
                stype = s.get('type', 'theory').lower()
                if stype not in ['theory', 'practical']: stype = 'theory'
                
                # Categories is String[] in Prisma, so pass as list for psycopg2
                cats = s.get('categories')
                if not isinstance(cats, list): cats = ['Theory']
                
                row = (nid, p_uid, s['name'], s.get('code') or '', s.get('professor') or '', s.get('classroom') or '', sem, stype, s.get('credits'), int(s.get('attended', 0)), int(s.get('total', 0)), int(s.get('target', 75)), cats, json.dumps(s.get('practicals')), json.dumps(s.get('assignments')), json.dumps(s.get('syllabus')))
                p_subs_to_create.append(row)
                p_sub_map[key] = nid
        if p_subs_to_create:
            print(f"Creating {len(p_subs_to_create)} missing subjects for primary...")
            # print(f"Sample row: {p_subs_to_create[0]}")
            execute_values(cur, "INSERT INTO subjects (id, user_id, name, code, professor, classroom, semester, type, credits, attended, total, target, categories, practicals, assignments, syllabus) VALUES %s ON CONFLICT DO NOTHING", p_subs_to_create)

        manual_courses = backup_data['data'].get('manual_courses', [])
        if manual_courses:
            print(f"Restoring {len(manual_courses)} manual courses with correct mapping...")
            mc_data = []
            for c in manual_courses:
                course_name = c.get('title') or c.get('name') # Fix: map title to name
                extra = c.get('extra') or {}
                if not isinstance(extra, dict): extra = {}
                
                # Consolidate instructor and dates into extra
                if c.get('instructor'): extra['instructor'] = c['instructor']
                if c.get('enrolledDate'): extra['enrolledDate'] = c['enrolledDate']
                if c.get('targetCompletionDate'): extra['targetCompletionDate'] = c['targetCompletionDate']
                if c.get('certificateUrl'): extra['certificateUrl'] = c['certificateUrl']
                
                mc_data.append((
                    str(uuid.uuid4()), 
                    p_uid, 
                    course_name, 
                    c.get('platform') or c.get('provider'), 
                    c.get('status'), 
                    float(c.get('progress') or c.get('percentage') or 0), 
                    c.get('url'), 
                    c.get('notes'), 
                    json.dumps(extra)
                ))
            
            cur.execute("DELETE FROM manual_courses WHERE user_id = %s", (p_uid,))
            execute_values(cur, "INSERT INTO manual_courses (id, user_id, name, platform, status, progress, url, notes, extra) VALUES %s", mc_data)

        backup_timetable = backup_data['data'].get('timetable', [])
        if backup_timetable:
            print("Fixing Timetable for Primary...")
            for t in backup_timetable:
                sem = parse_semester(t.get('semester', 1))
                cur.execute("DELETE FROM timetable WHERE user_id = %s AND semester = %s", (p_uid, sem))
                schedule = t.get('schedule', {})
                for day, slots in schedule.items():
                    if isinstance(slots, list):
                        for slot in slots:
                            old_ref = slot.get('subject_id') or slot.get('subjectId')
                            if old_ref in old_id_to_meta:
                                meta = old_id_to_meta[old_ref]
                                new_id = p_sub_map.get((meta['name'], meta['semester']))
                                if new_id: slot['subject_id'] = new_id
                                if 'subjectId' in slot: del slot['subjectId']
                cur.execute("INSERT INTO timetable (id, user_id, semester, schedule, periods) VALUES (%s, %s, %s, %s, %s)", (str(uuid.uuid4()), p_uid, sem, json.dumps(schedule), json.dumps(t.get('periods'))))

        # ─── SECONDARY ACCOUNT SYNC ───
        if 'secondary' in users:
            s_uid = users['secondary']
            print(f"\nSyncing Secondary Account: {EMAILS['secondary']}")
            cur.execute("SELECT id, name, semester FROM subjects WHERE user_id = %s", (s_uid,))
            s_sub_map = {(s[1].lower().strip(), s[2]): s[0] for s in cur.fetchall()}
            s_subs_to_create = []
            for s in subjects_data:
                sem = parse_semester(s.get('semester', 1))
                key = (s['name'].lower().strip(), sem)
                if key not in s_sub_map:
                    nid = generate_cuid()
                    stype = s.get('type', 'theory').lower()
                    if stype not in ['theory', 'practical']: stype = 'theory'
                    s_subs_to_create.append((nid, s_uid, s['name'], s.get('code'), s.get('professor'), s.get('classroom'), sem, stype, s.get('credits'), s.get('attended', 0), s.get('total', 0), s.get('target', 75), json.dumps(s.get('categories', ['Theory'])), json.dumps(s.get('practicals')), json.dumps(s.get('assignments')), json.dumps(s.get('syllabus'))))
                    s_sub_map[key] = nid
            if s_subs_to_create:
                print(f"Creating {len(s_subs_to_create)} subjects for secondary...")
                execute_values(cur, "INSERT INTO subjects (id, user_id, name, code, professor, classroom, semester, type, credits, attended, total, target, categories, practicals, assignments, syllabus) VALUES %s ON CONFLICT DO NOTHING", s_subs_to_create)
                cur.execute("SELECT id, name, semester FROM subjects WHERE user_id = %s", (s_uid,))
                s_sub_map = {(s[1].lower().strip(), s[2]): s[0] for s in cur.fetchall()}

            all_logs = backup_data['data'].get('attendance_logs', [])
            logs_to_sync = []
            for log in all_logs:
                old_sub_id = log.get('subject_id')
                if old_sub_id in old_id_to_meta:
                    meta = old_id_to_meta[old_sub_id]
                    new_sub_id = s_sub_map.get((meta['name'], meta['semester']))
                    if new_sub_id:
                        status = STATUS_MAP.get(log.get('status'), 'present')
                        ctype = LOG_TYPE_MAP.get(log.get('type'), 'Lecture')
                        sem = parse_semester(log.get('semester', meta['semester']))
                        def safe_val(v, default=None):
                            if v == "" or v is None: return default
                            return v
                        
                        ts = safe_val(log.get('timestamp'))
                        dt = safe_val(log.get('date'))
                        sub_by = safe_val(log.get('substituted_by'))
                        
                        try:
                            s_val = int(sem)
                        except:
                            s_val = 1
                            
                        row = (generate_cuid(), s_uid, new_sub_id, str(log.get('subject_name', meta['raw_name'])), safe_val(dt, ""), str(status), str(ctype), safe_val(log.get('notes')), s_val, sub_by, ts)
                        logs_to_sync.append(row)
            if logs_to_sync:
                print(f"Syncing {len(logs_to_sync)} logs for secondary... Sample: {logs_to_sync[0]}")
                execute_values(cur, "INSERT INTO attendance_logs (id, user_id, subject_id, subject_name, date, status, type, notes, semester, substituted_by, timestamp) VALUES %s ON CONFLICT DO NOTHING", logs_to_sync)

            if backup_timetable:
                print("Syncing Timetable for secondary...")
                for t in backup_timetable:
                    sem = parse_semester(t.get('semester', 1))
                    cur.execute("DELETE FROM timetable WHERE user_id = %s AND semester = %s", (s_uid, sem))
                    schedule = t.get('schedule', {})
                    for day, slots in schedule.items():
                        if isinstance(slots, list):
                            for slot in slots:
                                old_ref = slot.get('subject_id') or slot.get('subjectId')
                                if old_ref in old_id_to_meta:
                                    meta = old_id_to_meta[old_ref]
                                    new_id = s_sub_map.get((meta['name'], meta['semester']))
                                    if new_id: slot['subject_id'] = new_id
                    cur.execute("INSERT INTO timetable (id, user_id, semester, schedule, periods) VALUES (%s, %s, %s, %s, %s)", (str(uuid.uuid4()), s_uid, sem, json.dumps(schedule), json.dumps(t.get('periods'))))

        conn.commit()
        print("\nAll remediations and syncs completed successfully!")

    except Exception as e:
        conn.rollback(); print(f"Error: {e}"); import traceback; traceback.print_exc()
    finally:
        cur.close(); conn.close()

if __name__ == "__main__": main()
