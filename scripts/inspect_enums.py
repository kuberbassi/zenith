import psycopg2

DATABASE_URL = 'postgresql://neondb_owner:npg_BfZNeVgzY3O4@ep-royal-resonance-a4tmdnsq-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'

def inspect_enums():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    enums = ['AttendanceStatus', 'ClassType']
    for enum_name in enums:
        try:
            print(f"\nValues for {enum_name}:")
            cur.execute("""
                SELECT enumlabel 
                FROM pg_enum 
                JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
                WHERE pg_type.typname = %s
            """, (enum_name.lower(),)) # Postgres stores type names in lowercase internally usually
            res = cur.fetchall()
            if not res:
                # Try with exact name
                cur.execute("""
                    SELECT enumlabel 
                    FROM pg_enum 
                    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
                    WHERE pg_type.typname = %s
                """, (enum_name,))
                res = cur.fetchall()
            
            for row in res:
                print(f"  - {row[0]}")
        except Exception as e:
            print(f"Error inspecting {enum_name}: {e}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    inspect_enums()
