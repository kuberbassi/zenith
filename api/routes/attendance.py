from flask import Blueprint, request, session, jsonify, Response
import json
from api.database import db
from api.utils.response import success_response, error_response
from api.calculations_v2 import AttendanceCalculator
from bson import ObjectId, json_util
from datetime import datetime
import calendar
import logging
import traceback

logger = logging.getLogger(__name__)

attendance_bp = Blueprint('attendance', __name__)

attendance_log_collection = db.get_collection('attendance_logs')
subjects_collection = db.get_collection('subjects')
timetable_collection = db.get_collection('timetable')

def create_system_log(user_email, action, description):
    """Internal helper for logging."""
    db.get_collection('system_logs').insert_one({
        'owner_email': user_email,
        'action': action,
        'description': description,
        'timestamp': datetime.utcnow()
    })

@attendance_bp.route('/mark', methods=['POST'])
def mark_attendance():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    
    try:
        data = request.json or {}
        user_email = session['user']['email'].lower()  # ✅ Normalized
        print(f"DEBUG: /mark called with data: {data}")
        
        # Validation
        subject_id_str = data.get('subject_id')
        status = data.get('status')
        if not subject_id_str or not status:
            return error_response("Subject ID and Status are required", "MISSING_FIELDS", status_code=400)
            
        try:
            subject_id = ObjectId(subject_id_str)
        except:
            return error_response("Invalid Subject ID", "INVALID_ID")

        notes = data.get('notes')
        date_str = data.get('date', datetime.now().strftime("%Y-%m-%d"))
        substituted_by_id = data.get('substituted_by_id')

        subject = subjects_collection.find_one({'_id': subject_id})
        if not subject: return error_response("Subject not found", "NOT_FOUND", 404)
        
        # 1. Handle Primary Log
        log_entry = {
            "subject_id": subject_id,
            "subject_name": subject.get('name'),
            "type": data.get('type', 'Lecture'),
            "owner_email": user_email,
            "date": date_str,
            "status": status,
            "timestamp": datetime.utcnow(),
            "semester": subject.get('semester')
        }
        if notes: log_entry['notes'] = notes
        
        # Valid Substitution ID check
        sub_oid = None
        if substituted_by_id and isinstance(substituted_by_id, str) and len(substituted_by_id) == 24:
            try:
                sub_oid = ObjectId(substituted_by_id)
                log_entry['substituted_by'] = sub_oid
            except: pass 
        
        attendance_log_collection.insert_one(log_entry)
        
        # 2. Update stats
        update_query = {}
        # Statuses that count towards Total
        if status in ['present', 'absent', 'late', 'approved_medical', 'medical', 'duty']:
            update_query.setdefault('$inc', {})['total'] = 1
            # Statuses that count towards Attended
            if status in ['present', 'late', 'approved_medical', 'medical', 'duty']:
                update_query.setdefault('$inc', {})['attended'] = 1
        
        if update_query:
            subjects_collection.update_one({'_id': subject_id}, update_query)

        # 3. Handle Substitution Logic
        if status == 'substituted' and sub_oid:
            sub_id = sub_oid
            sub_subject = subjects_collection.find_one({'_id': sub_id})
            if sub_subject:
                 attendance_log_collection.insert_one({
                    "subject_id": sub_id,
                    "subject_name": sub_subject.get('name'), # Added for visibility
                    "owner_email": user_email,
                    "date": date_str,
                    "status": "present",
                    "type": "substitution_class",
                    "timestamp": datetime.utcnow(),
                    "semester": sub_subject.get('semester'),
                    "notes": f"Substituted {subject.get('name')}"
                })
                 subjects_collection.update_one({'_id': sub_id}, {'$inc': {'total': 1, 'attended': 1}})
            
        create_system_log(user_email, "Attendance Marked", f"Marked '{subject.get('name')}' as {status} for {date_str}.")
        return success_response({"message": "Attendance marked successfully"})

    except Exception as e:
        logger.error(f"Mark attendance failed: {e}")
        return error_response("Internal Server Error while marking attendance", "INTERNAL_ERROR", 500)

@attendance_bp.route('/logs', methods=['GET'])
def get_attendance_logs():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    
    try:
        # Safe Parameter Parsing
        try:
            page = int(request.args.get('page', 1))
            limit = int(request.args.get('limit', 15))
            semester = request.args.get('semester')
            if semester: semester = int(semester)
        except ValueError:
            return error_response("Invalid parameters", "INVALID_PARAMS")

        skip = (page - 1) * limit
        user_email = session['user']['email'].lower()  # ✅ Normalized
        query = {'owner_email': user_email}
        
        if semester: query['semester'] = semester

        date_filter = request.args.get('date')
        if date_filter: query['date'] = date_filter

        total_logs = attendance_log_collection.count_documents(query)
        
        pipeline = [
            {'$match': query},
            {'$sort': {'timestamp': -1}},
            {'$skip': skip},
            {'$limit': limit},
            {'$lookup': {
                'from': 'subjects',
                'localField': 'subject_id',
                'foreignField': '_id',
                'as': 'subject_info'
            }},
            {'$unwind': {
                'path': '$subject_info',
                'preserveNullAndEmptyArrays': True
            }},
            # Lookup substituted subject if any
            {'$lookup': {
                'from': 'subjects',
                'localField': 'substituted_by',
                'foreignField': '_id',
                'as': 'sub_subject_info'
            }},
            {'$unwind': {
                'path': '$sub_subject_info',
                'preserveNullAndEmptyArrays': True
            }},
            {'$project': {
                '_id': {'$toString': '$_id'},
                'subject_id': {'$toString': '$subject_id'},
                'date': 1,
                'status': 1,
                'type': 1,
                'notes': 1,
                'timestamp': {'$toString': '$timestamp'},
                'subject_name': {'$ifNull': ['$subject_info.name', 'Unknown Subject']},
                'subject_code': {'$ifNull': ['$subject_info.code', '']},
                'substituted_by_name': {'$ifNull': ['$sub_subject_info.name', None]}
            }}
        ]
        
        logs = list(attendance_log_collection.aggregate(pipeline))
        
        return Response(
            json_util.dumps({"success": True, "data": {"logs": logs, "has_next_page": total_logs > (skip + len(logs))}}),
            mimetype='application/json'
        )

    except Exception as e:
        logger.error(f"Failed to fetch logs: {str(e)}")
        # Don't return 500, return empty list or specific error to prevent app crash
        return error_response("Failed to fetch logs", "FETCH_FAILED")

@attendance_bp.route('/classes-for-date', methods=['GET'])
def get_classes_for_date():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    date_str = request.args.get('date')
    if not date_str: return error_response("Date parameter required", "MISSING_PARAM")

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d")
    except: return error_response("Invalid date format", "INVALID_DATE")

    user_email = session['user']['email'].lower()  # ✅ Normalized
    semester = request.args.get('semester', type=int)
    
    print(f"DTO Classes Fetch: {date_str} (sem: {semester}) user: {user_email}")
    
    # Use hardcoded English day names to match Timetable.tsx exactly
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_name = days[target_date.weekday()]
    
    timetable_doc = timetable_collection.find_one({'owner_email': user_email, 'semester': semester})
    if not timetable_doc and semester == 1:
        timetable_doc = timetable_collection.find_one({'owner_email': user_email})

    if not timetable_doc: 
        print("DTO No Timetable found")
        return success_response([])

    slots_to_return = []
    schedule = timetable_doc.get('schedule', {})
    day_slots = schedule.get(day_name, []) if isinstance(schedule, dict) else []

    print(f"DTO Found {len(day_slots)} slots for {day_name}")

    for slot in day_slots:
        sid = slot.get('subject_id') or slot.get('subjectId')
        if sid:
            # Handle ObjectId conversion if string
            if isinstance(sid, str):
                try: sid = ObjectId(sid)
                except: pass
                
            subject = subjects_collection.find_one({"_id": sid})
            if subject:
                slots_to_return.append({
                    "id": str(sid),
                    "name": subject.get('name'),
                    "time": slot.get('start_time', '09:00 AM'),
                    "end_time": slot.get('end_time', '10:00 AM'),
                    "type": slot.get('type', 'Lecture'),
                    "marked_status": "pending"
                })
            else:
                 print(f"DTO Subject not found for ID: {sid}")

    logs = list(attendance_log_collection.find({'owner_email': user_email, 'date': date_str}))
    processed_log_ids = set()
    
    # Matching logic: Assign logs to slots based on chronological order of same subject
    for sid in set([s['id'] for s in slots_to_return]):
        # Get slots for this specific subject, sorted by time
        subj_slots = sorted([s for s in slots_to_return if s['id'] == sid], key=lambda x: x.get('time', ''))
        # Get logs for this specific subject on this date, sorted by mark-time (timestamp)
        # CRITICAL: Exclude 'substitution_class' from regular slot matching to prevent clashing
        subj_logs = sorted([l for l in logs if str(l.get('subject_id')) == sid and l.get('type') != 'substitution_class'], key=lambda x: x.get('timestamp', datetime.min))
        
        current_log_idx = 0
        for i, slot in enumerate(subj_slots):
            status = "pending"
            log_id = None
            
            if current_log_idx < len(subj_logs):
                log = subj_logs[current_log_idx]
                status = log.get('status', 'pending')
                log_id = str(log.get('_id'))
                processed_log_ids.add(log_id)
                
                # Logic for incrementing:
                # 1. If next slot is a new block (not contiguous in time), always move to next log
                # 2. If next slot is same block, move to next log only if we have extra logs available
                # (This handles double blocks with 1 mark vs separate marks)
                if (i + 1) < len(subj_slots):
                    next_slot = subj_slots[i+1]
                    # Simple continuity check: if end_time of current == start_time of next
                    # We normalize "09:30 AM" -> "09:30" for comparison if needed, 
                    # but usually they match exactly if from same system
                    is_contiguous = (slot.get('end_time') == next_slot.get('time'))
                    
                    logs_remaining = len(subj_logs) - (current_log_idx + 1)
                    if not is_contiguous or logs_remaining > 0:
                        current_log_idx += 1
            
            slot['marked_status'] = status
            if log_id: 
                slot['log_id'] = log_id
                slot['notes'] = log.get('notes', '')
                if log.get('substituted_by'):
                    slot['substituted_by'] = str(log.get('substituted_by'))

    # 3. Add any unmatched logs as extra slots (e.g. substitutions, extra classes)
    unmatched_logs = [l for l in logs if str(l.get('_id')) not in processed_log_ids]
    for log in unmatched_logs:
        sid = str(log.get('subject_id'))
        # Use Subject Name from log if exists, else fallback to name in current subjects
        name = log.get('subject_name')
        if not name:
             subject = subjects_collection.find_one({"_id": ObjectId(sid)})
             name = subject.get('name') if subject else "Extra Class"
             
        slots_to_return.append({
            "id": sid,
            "log_id": str(log.get('_id')),
            "name": name,
            "time": "Extra / Sub",
            "type": log.get('type', 'Lecture'),
            "marked_status": log.get('status', 'pending'),
            "notes": log.get('notes', ''),
            "is_extra": True
        })

    import json
    return success_response(json.loads(json_util.dumps(slots_to_return)))

@attendance_bp.route('/logs/<log_id>', methods=['PUT'])
@attendance_bp.route('/edit_attendance/<log_id>', methods=['POST'])
def edit_attendance(log_id):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()  # ✅ Normalized
    data = request.json
    print(f"DEBUG: /edit_attendance/{log_id} called with data: {data}")
    
    try:
        log = attendance_log_collection.find_one({"_id": ObjectId(log_id), "owner_email": user_email})
        if not log: return error_response("Log not found", "NOT_FOUND", 404)
        
        old_status = log.get('status')
        new_status = data.get('status', old_status)
        new_notes = data.get('notes', log.get('notes'))
        
        # Update Log
        update_fields = {'timestamp': datetime.utcnow()}
        if 'status' in data: update_fields['status'] = new_status
        if 'notes' in data: update_fields['notes'] = new_notes
        if 'date' in data: update_fields['date'] = data['date']
        if 'type' in data: update_fields['type'] = data['type']
        
        # Handle Substituted By update
        sub_id_val = data.get('substituted_by_id')
        if sub_id_val:
            try:
                update_fields['substituted_by'] = ObjectId(sub_id_val)
            except: pass
        elif 'substituted_by_id' in data: # Explicitly clearing it
            update_fields['substituted_by'] = None
        
        attendance_log_collection.update_one(
            {"_id": ObjectId(log_id)},
            {'$set': update_fields}
        )
        
        # Update Stats if status changed
        if old_status != new_status:
            subject_id = log.get('subject_id')
            inc_updates = {}
            
            # Revert old effect
            if old_status in ['present', 'absent', 'late', 'approved_medical', 'medical', 'duty']:
                inc_updates['total'] = inc_updates.get('total', 0) - 1
                if old_status in ['present', 'late', 'approved_medical', 'medical', 'duty']:
                    inc_updates['attended'] = inc_updates.get('attended', 0) - 1
            
            # Apply new effect
            if new_status in ['present', 'absent', 'late', 'approved_medical', 'medical', 'duty']:
                inc_updates['total'] = inc_updates.get('total', 0) + 1
                if new_status in ['present', 'late', 'approved_medical', 'medical', 'duty']:
                    inc_updates['attended'] = inc_updates.get('attended', 0) + 1
            
            if inc_updates:
                # Remove 0 updates to avoid no-op or errors
                final_inc = {k: v for k, v in inc_updates.items() if v != 0}
                if final_inc:
                    subjects_collection.update_one({'_id': subject_id}, {'$inc': final_inc})

        create_system_log(user_email, "Attendance Updated", f"Updated record for {log.get('subject_name')}")
        return success_response({"message": "Updated successfully"})
        
    except Exception as e:
        logger.error(f"Edit failed: {e}")
        return error_response("Failed to update", "UPDATE_FAILED")

@attendance_bp.route('/logs/<log_id>', methods=['DELETE'])
@attendance_bp.route('/delete_attendance/<log_id>', methods=['DELETE'])
def delete_attendance(log_id):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()  # ✅ Normalized
    
    try:
        try:
            log_oid = ObjectId(log_id)
        except:
            return error_response("Invalid Log ID", "INVALID_ID")
            
        log = attendance_log_collection.find_one({"_id": log_oid, "owner_email": user_email})
        if not log: return error_response("Log not found", "NOT_FOUND", 404)
        
        # Decrement stats from subject
        status = log.get('status')
        subject_id = log.get('subject_id')
        
        update_query = {}
        if status in ['present', 'absent', 'late', 'approved_medical']:
            update_query.setdefault('$inc', {})['total'] = -1
            if status in ['present', 'late', 'approved_medical']:
                update_query.setdefault('$inc', {})['attended'] = -1
        
        if update_query and subject_id:
            try:
                 subjects_collection.update_one({'_id': subject_id}, update_query)
            except Exception as e:
                 logger.error(f"Failed to update stats on delete: {e}")
        
        attendance_log_collection.delete_one({"_id": log_oid})
        create_system_log(user_email, "Attendance Deleted", f"Deleted record for {log.get('subject_name', 'Unknown Class')}")
        
        return success_response({"message": "Deleted successfully"})
    except Exception as e:
        logger.error(f"Delete failed: {e}")
        return error_response("Failed to delete", "DELETE_FAILED")

@attendance_bp.route('/calendar_data', methods=['GET'])
def get_calendar_data():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    
    try:
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)
        semester = request.args.get('semester', type=int)
        user_email = session['user']['email'].lower()  # ✅ Normalized

        if not year or not month: 
            return error_response("Year and Month required", "MISSING_PARAMS")
            
        start_date_str = f"{year}-{month:02d}-01"
        if month == 12:
            end_year, end_month = year + 1, 1
        else:
            end_year, end_month = year, month + 1
        end_date_str = f"{end_year}-{end_month:02d}-01"
            
        match_query = {
            'owner_email': user_email,
            'date': {'$gte': start_date_str, '$lt': end_date_str}
        }
        if semester: match_query['semester'] = semester

        pipeline = [
            {'$match': match_query},
            # Join with Subjects
            {'$lookup': {
                'from': 'subjects',
                'localField': 'subject_id',
                'foreignField': '_id',
                'as': 'subject_info'
            }},
            {'$unwind': {
                'path': '$subject_info',
                'preserveNullAndEmptyArrays': True
            }},
            # Project final shape
            {'$project': {
                '_id': {'$toString': '$_id'},
                'subject_id': {'$toString': '$subject_id'},
                'status': 1,
                'date': 1,
                'notes': 1,
                'type': 1,
                'timestamp': {'$toString': '$timestamp'},
                'subject_name': {'$ifNull': ['$subject_info.name', 'Unknown Subject']},
                'subject_code': {'$ifNull': ['$subject_info.code', '']}
            }}
        ]
        
        logs = list(attendance_log_collection.aggregate(pipeline))
        return success_response(logs)

    except Exception as e:
        logger.error(f"Calendar data error: {e}")
        traceback.print_exc()
        return error_response(f"Failed to fetch calendar data: {str(e)}", "FETCH_ERROR")

