
import os
import time
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

_db_instance = None

def init_db():
    global _db_instance
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        print("❌ MONGO_URI is missing in environment!")
        return None
        
    try:
        # Serverless-optimized: minimal pool, tight timeouts for fast cold starts
        client = MongoClient(
            mongo_uri,
            maxPoolSize=10,      # Serverless doesn't need 200 — each invocation is short-lived
            minPoolSize=1,       # Just 1 warm connection
            serverSelectionTimeoutMS=3000,  # Fail fast if DB unreachable (was 5s)
            connectTimeoutMS=3000,          # 3s connect (was 5s)
            socketTimeoutMS=10000,          # 10s socket (was 30s — way too long for serverless)
            retryWrites=True,
            maxIdleTimeMS=45000,            # Close idle connections after 45s
            appName='zenith-vercel'        # Helps with Atlas monitoring
        )
        # Force a connection check to see if it fails immediately (DNS etc)
        # asking for a database is lazy in pymongo, but we want to know if it failed for the 'db' proxy logic
        # However, to be truly lazy we shouldn't block. 
        # But the original code relied on 'db' being valid or None.
        
        # We'll just assume it works or fail later. 
        # But to detect the 'None' case from original code:
        # We try to access it? No, keeping it simple.
        
        _db_instance = client.get_database('attendanceDB')
        return _db_instance
    except Exception as e:
        print(f"❌ MongoDB Connection Error: {e}")
        return None

# Proxy classes to handle lazy connection
class LazyCollection:
    def __init__(self, name):
        self._name = name
    
    def __getattr__(self, name):
        global _db_instance
        if _db_instance is None:
            # Try to reconnect on demand
            print(f"🔄 Attempting to reconnect to MongoDB for collection '{self._name}'...")
            if init_db() is None:
                 raise Exception(f"Database not connected. Cannot perform '{name}' on '{self._name}'")
        
        real_col = _db_instance.get_collection(self._name)
        return getattr(real_col, name)

class LazyDB:
    def get_collection(self, name):
        return LazyCollection(name)

# Initial Connection Attempt
_db_instance = init_db()

if _db_instance is not None:
    db = _db_instance
else:
    print("⚠️  Initial DB connection failed. Using LazyDB proxy to prevent crash.")
    db = LazyDB()
