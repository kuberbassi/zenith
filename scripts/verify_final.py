import psycopg2
import json

DATABASE_URL = 'postgresql://neondb_owner:npg_BfZNeVgzY3O4@ep-royal-resonance-a4tmdnsq-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'

def verify_final():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("\nFinal Verification Report:")
    print("-" * 30)
    
    # 1. Check Primary Account Manual Courses
    cur.execute("SELECT id FROM users WHERE email = 'kuber@hmritm.ac.in'")
    p_uid = cur.fetchone()[0]
    
    cur.execute("SELECT name, platform, progress, extra FROM manual_courses WHERE user_id = %s", (p_uid,))
    courses = cur.fetchall()
    print(f"\nAccount: kuber@hmritm.ac.in")
    print(f"  Manual Courses Count: {len(courses)}")
    for name, platform, progress, extra in courses[:3]: # Sample first 3
        print(f"  - Course: {name} ({platform}) | Progress: {progress}%")
        if extra:
            print(f"    Extra: {json.dumps(extra)}")

    # 2. Check Schema Pruning (Tables should be missing)
    tables_to_check = ['projects', 'experiences', 'certifications']
    print("\nSchema Cleanup Check:")
    for table in tables_to_check:
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = %s)", (table,))
        exists = cur.fetchone()[0]
        print(f"  Table '{table}' exists: {exists}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    verify_final()
