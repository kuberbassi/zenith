import psycopg2
from psycopg2.extras import execute_values
import uuid

DATABASE_URL = 'postgresql://neondb_owner:npg_BfZNeVgzY3O4@ep-royal-resonance-a4tmdnsq-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'

def test():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Use real IDs from your DB if possible, or placeholders
    user_id = 'clzwfuvx50000r39vnt60iynw'
    subject_id = 'clzwfvv5c0001r39vpxp8v9f6'
    
    data = [(
        str(uuid.uuid4())[:25], # mimicking cuid() length
        user_id,
        subject_id,
        'Test Subject',
        '2025-01-01',
        'present',
        'Lecture',
        'Notes',
        1,
        None,
        '2025-01-01 10:00:00'
    )]
    
    query = """
    INSERT INTO attendance_logs (id, user_id, subject_id, subject_name, date, status, type, notes, semester, substituted_by, timestamp)
    VALUES %s
    ON CONFLICT (user_id, subject_id, date, type) DO NOTHING
    """
    
    try:
        execute_values(cur, query, data)
        conn.commit()
        print("Success!")
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    test()
