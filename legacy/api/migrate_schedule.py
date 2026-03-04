import os
import sys
import uuid
from pymongo import MongoClient
from dotenv import load_dotenv

# Load env from root
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    print("Error: MONGO_URI not found in .env")
    sys.exit(1)

try:
    client = MongoClient(MONGO_URI)
    db = client.get_database('attendanceDB')
    timetable_collection = db.get_collection('timetable')
    print("Connected to MongoDB.")
except Exception as e:
    print(f"Connection failed: {e}")
    sys.exit(1)

def migrate():
    # Find all timetables
    cursor = timetable_collection.find({})
    count = 0
    migrated_count = 0
    
    days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    for doc in cursor:
        count += 1
        schedule = doc.get('schedule', {})
        if not schedule:
            continue
            
        # Check if it's already new format (Day keys)
        # New format: keys are days, values are lists
        # Old format: keys are times e.g. "09:00", values are dicts { "Monday": ... }
        
        is_new_format = False
        if any(d in schedule for d in days_of_week):
            # Check if value structure is list
            for d in days_of_week:
                if d in schedule and isinstance(schedule[d], list):
                    is_new_format = True
                    break
        
        if is_new_format:
            print(f"Skipping {doc.get('owner_email')}: Already in new format or mixed.")
            continue
            
        print(f"Migrating {doc.get('owner_email')}...")
        
        # Convert Old (Time -> Day -> Slot) to New (Day -> List of Slots)
        new_schedule = {day: [] for day in days_of_week}
        
        # Iterate over times
        # Old structure detected: keys are times e.g. "09:00 - 10:00" or just keys
        for time_key, days_map in schedule.items():
            if not isinstance(days_map, dict):
                continue
                
            for day_name, slot_data in days_map.items():
                if day_name in days_of_week and isinstance(slot_data, dict):
                    # Check if it's a class
                    if slot_data.get('type') == 'class':
                        
                        start_time = slot_data.get('startTime') or "09:00"
                        end_time = slot_data.get('endTime') or "10:00"
                        
                        # Try to parse time_key if it looks like "09:00-10:00"
                        if '-' in time_key:
                            parts = time_key.split('-')
                            if len(parts) == 2:
                                start_time = parts[0].strip()
                                end_time = parts[1].strip()
                        
                        new_slot = {
                            "_id": str(slot_data.get('id') or slot_data.get('_id') or str(uuid.uuid4())),
                            "subject_id": slot_data.get('subjectId'),
                            "day": day_name,
                            "start_time": start_time,
                            "end_time": end_time,
                            "label": slot_data.get('subjectName') # Optional fallback
                        }
                        
                        new_schedule[day_name].append(new_slot)
        
        # Update the document
        timetable_collection.update_one(
            {'_id': doc['_id']},
            {'$set': {'schedule': new_schedule}}
        )
        migrated_count += 1
        
    print(f"Migration complete. Processed {count} docs, Migrated {migrated_count}.")

if __name__ == "__main__":
    migrate()
