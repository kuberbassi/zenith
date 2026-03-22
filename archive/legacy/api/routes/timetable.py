from flask import Blueprint, request, session, jsonify, Response
from api.database import db
from api.utils.response import success_response, error_response
from bson import ObjectId, json_util
from datetime import datetime
import logging
import traceback

logger = logging.getLogger(__name__)

timetable_bp = Blueprint('timetable', __name__)
timetable_collection = db.get_collection('timetable')

def log_user_action(user_email, action, description):
    db.get_collection('system_logs').insert_one({
        'owner_email': user_email,
        'action': action,
        'description': description,
        'timestamp': datetime.utcnow()
    })

@timetable_bp.route('/', methods=['GET', 'POST'])
def handle_timetable():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()  # ✅ Normalized
    semester = request.args.get('semester', type=int, default=1)

    if request.method == 'POST':
        data = request.json.get('schedule', {})
        timetable_collection.update_one(
            {'owner_email': user_email, 'semester': semester}, 
            {'$set': {'schedule': data, 'semester': semester, 'updated_at': datetime.utcnow()}}, 
            upsert=True
        )
        log_user_action(user_email, "Schedule Updated", f"User updated timetable for Semester {semester}.")
        return success_response({"message": "Timetable updated"})

    doc = timetable_collection.find_one({'owner_email': user_email, 'semester': semester})
    if not doc and semester == 1:
        # Check for legacy non-semester doc
        doc = timetable_collection.find_one({'owner_email': user_email, 'semester': {'$exists': False}})

    import json
    return success_response(json.loads(json_util.dumps(doc or {})))

@timetable_bp.route('/structure', methods=['POST'])
def save_structure():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()  # ✅ Normalized
    semester = request.args.get('semester', type=int, default=1)
    data = request.json # Expects list of slots/periods
    
    timetable_collection.update_one(
        {'owner_email': user_email, 'semester': semester},
        {'$set': {'periods': data, 'updated_at': datetime.utcnow()}},
        upsert=True
    )
    return success_response({"message": "Timetable structure saved"})

@timetable_bp.route('/holidays', methods=['GET', 'POST'])
def handle_holidays():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()  # ✅ Normalized
    holidays_collection = db.get_collection('holidays')

    if request.method == 'POST':
        data = request.json
        result = holidays_collection.insert_one({
            'owner_email': user_email,
            'date': data.get('date'),
            'name': data.get('name'),
            'timestamp': datetime.utcnow()
        })
        return success_response({"message": "Holiday added", "id": str(result.inserted_id)})
    
    holidays = list(holidays_collection.find({'owner_email': user_email}).sort('date', 1))
    import json
    return success_response(json.loads(json_util.dumps(holidays)))

@timetable_bp.route('/holidays/<holiday_id>', methods=['DELETE'])
def delete_holiday(holiday_id):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    holidays_collection = db.get_collection('holidays')
    
    try:
        result = holidays_collection.delete_one({'_id': ObjectId(holiday_id), 'owner_email': user_email})
        if result.deleted_count == 0:
            return error_response("Holiday not found", "NOT_FOUND", 404)
        return success_response({"message": "Holiday deleted"})
    except Exception as e:
        return error_response("Invalid holiday ID", "INVALID_ID")

@timetable_bp.route('/slot', methods=['POST'])
def add_slot():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()  # ✅ Normalized
    semester = request.args.get('semester', type=int, default=1)
    slot_data = request.json
    
    # Needs a day to know where to insert
    day = slot_data.get('day')
    if not day: return error_response("Day required", "MISSING_FIELD")
    
    # Ensure ID
    if 'id' not in slot_data and '_id' not in slot_data:
        slot_data['id'] = str(ObjectId())
        
    doc = timetable_collection.find_one({'owner_email': user_email, 'semester': semester})
    if not doc:
        # Create new
        schedule = {day: [slot_data]}
        timetable_collection.insert_one({
            'owner_email': user_email, 
            'semester': semester, 
            'schedule': schedule,
            'updated_at': datetime.utcnow()
        })
    else:
        schedule = doc.get('schedule', {})
        if day not in schedule: schedule[day] = []
        schedule[day].append(slot_data)
        
        timetable_collection.update_one(
            {'_id': doc['_id']},
            {'$set': {'schedule': schedule, 'updated_at': datetime.utcnow()}}
        )
        
    return success_response({"message": "Slot added", "id": slot_data.get('id')})

@timetable_bp.route('/slot/<slot_id>', methods=['PUT'])
def update_slot(slot_id):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    semester = request.args.get('semester', type=int, default=1)
    updates = request.json or {}
    
    try:
        doc = timetable_collection.find_one({'owner_email': user_email, 'semester': semester})
        if not doc or 'schedule' not in doc:
            return error_response("Timetable not found", "NOT_FOUND", 404)

        # Normalise to plain Python dicts — avoids BSON ObjectId re-serialisation errors
        import json
        schedule = json.loads(json_util.dumps(doc['schedule']))
        
        found = False
        for day, slots in schedule.items():
            for i, slot in enumerate(slots):
                current_id = str(slot.get('id') or slot.get('_id') or '')
                if current_id == slot_id:
                    schedule[day][i] = {**slot, **updates}
                    found = True
                    break
            if found:
                break

        if not found:
            return error_response("Slot not found", "NOT_FOUND", 404)

        timetable_collection.update_one(
            {'_id': doc['_id']},
            {'$set': {'schedule': schedule, 'updated_at': datetime.utcnow()}}
        )
        return success_response({"message": "Slot updated", "slot": schedule[day][i]})

    except Exception as e:
        logger.error("update_slot error: %s\n%s", e, traceback.format_exc())
        return error_response(f"Server error: {str(e)}", "SERVER_ERROR", 500)

@timetable_bp.route('/slot/<slot_id>', methods=['DELETE'])
def delete_slot(slot_id):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()  # ✅ Normalized
    semester = request.args.get('semester', type=int, default=1)
    
    doc = timetable_collection.find_one({'owner_email': user_email, 'semester': semester})
    if not doc or 'schedule' not in doc:
        return error_response("Timetable not found", "NOT_FOUND", 404)
        
    schedule = doc['schedule']
    found = False
    
    # Iterate keys to allow modification
    for day in list(schedule.keys()):
        slots = schedule[day]
        original_len = len(slots)
        # Filter out slot with matching ID
        schedule[day] = [s for s in slots if str(s.get('id') or s.get('_id') or '') != slot_id]
        if len(schedule[day]) < original_len:
            found = True
            
    if found:
        timetable_collection.update_one(
            {'_id': doc['_id']},
            {'$set': {'schedule': schedule, 'updated_at': datetime.utcnow()}}
        )
        return success_response({"message": "Slot deleted"})
    else:
        return error_response("Slot not found", "NOT_FOUND", 404)
