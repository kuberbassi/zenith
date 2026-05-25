# api/api.py

import calendar
import requests
import math
import traceback
from datetime import datetime, timedelta
from functools import wraps
from time import time
import os
import json
import base64
from bson import ObjectId, json_util

from api.rate_limiter import limiter, RELAXED_LIMIT, MODERATE_LIMIT
from flask import Flask, Blueprint, jsonify, request, session, send_from_directory, Response
from itertools import groupby
from werkzeug.utils import secure_filename
from pymongo import MongoClient, IndexModel, ASCENDING, DESCENDING
from api.database import db  # ✅ Import central db to avoid circularity
# try:
#     from pywebpush import webpush, WebPushException
# except ImportError:
#     print("pywebpush not installed")

# Performance: In-memory cache for frequently accessed data
CACHE = {}
CACHE_TTL = {}

def get_cached(key, ttl_seconds=300):
    """Get cached value if not expired"""
    if key in CACHE and key in CACHE_TTL:
        if time() - CACHE_TTL[key] < ttl_seconds:
            return CACHE[key]
    return None

def set_cached(key, value):
    """Set cached value with timestamp"""
    CACHE[key] = value
    CACHE_TTL[key] = time()


# --- Logging Helper ---
def create_system_log(user_email, action, description):
    """
    Creates a system log entry for user actions.
    Filters out duplicate logs that occur within 5 seconds.
    """
    try:
        if not user_email: return
        
        # Debounce: Check if identical log exists in last 5 seconds
        five_seconds_ago = datetime.utcnow() - timedelta(seconds=5)
        
        if db is None: return
        logs_col = db.get_collection('system_logs')

        exists = logs_col.find_one({
            'owner_email': user_email,
            'action': action,
            'description': description,
            'timestamp': {'$gte': five_seconds_ago}
        })
        
        if not exists:
            logs_col.insert_one({
                'owner_email': user_email,
                'action': action,
                'description': description,
                'timestamp': datetime.utcnow()
            })
    except Exception as e:
        print(f"⚠️ Failed to create system log: {e}")

# Alias for compatibility
log_user_action = create_system_log


api_bp = Blueprint('api', __name__, url_prefix='/api')

# Global Collection Definitions
# Global Collection Definitions
# preferences_collection = db.get_collection('user_preferences') # Moved inside functions

# --- Health Check (for debugging Vercel) ---
@api_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify DB and env vars"""
    status = {
        "status": "ok",
        "db_connected": db is not None,
        "mongo_uri_set": bool(os.getenv('MONGO_URI')),
        "flask_secret_set": bool(os.getenv('FLASK_SECRET_KEY'))
    }
    
    if db is not None:
        try:
            # Try a simple operation
            db.list_collection_names()
            status["db_pingable"] = True
        except Exception as e:
            status["db_pingable"] = False
            status["db_error"] = str(e)
    
    return jsonify(status)

# --- Preferences & Profile ---

@api_bp.route('/preferences', methods=['GET', 'POST'])
def update_preferences():
    """Get or Update user preferences"""
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401

    if db is None: return jsonify({"error": "Database not available"}), 500
    preferences_collection = db.get_collection('user_preferences')
    
    user_email = session['user']['email']
    
    if request.method == 'GET':
        existing = preferences_collection.find_one({'owner_email': user_email})
        current_prefs = existing.get('preferences', {}) if existing else {}
        return jsonify(current_prefs)

    new_prefs = request.json
    
    # Get existing preferences
    existing = preferences_collection.find_one({'owner_email': user_email})
    current_prefs = existing.get('preferences', {}) if existing else {}
    
    # Merge new with existing
    current_prefs.update(new_prefs)
    
    # CRITICAL FIX: Mobile uses 'attendance_threshold', Web uses 'min_attendance'/'warning_threshold'
    # We must keep all three in sync.
    val_threshold = None
    if 'attendance_threshold' in new_prefs:
        val_threshold = int(new_prefs['attendance_threshold'])
    elif 'warning_threshold' in new_prefs:
        val_threshold = int(new_prefs['warning_threshold'])
    elif 'min_attendance' in new_prefs:
        val_threshold = int(new_prefs['min_attendance'])
        
    if val_threshold is not None:
        current_prefs['attendance_threshold'] = val_threshold
        current_prefs['warning_threshold'] = val_threshold
        current_prefs['min_attendance'] = val_threshold
    
    preferences_collection.update_one(
        {'owner_email': user_email},
        {'$set': {
            'owner_email': user_email,
            'preferences': current_prefs,
            'updated_at': datetime.utcnow()
        }},
        upsert=True
    )
    
    return jsonify({"success": True, "preferences": current_prefs})

@api_bp.route('/profile', methods=['GET'])
def get_profile():
    """Get user profile information for mobile app"""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    if db is None:
        return jsonify({"error": "Database not available"}), 500
    
    user_email = session['user']['email']  # CRITICAL FIX: Define user_email before using it
    
    users_collection = db.get_collection('users')
    preferences_collection = db.get_collection('user_preferences')
    
    # Get Core User Data (Course, Batch, College, Picture)
    user_data = users_collection.find_one({'email': user_email}) or {}
    
    # Get User Preferences (Semester, Thresholds)
    user_prefs = preferences_collection.find_one({'owner_email': user_email})
    prefs = user_prefs.get('preferences', {}) if user_prefs else {}
    
    # Logic to get the effective value - Sync between Web/Mobile keys
    # Use attendance_threshold as primary, fallback to others
    base_val = prefs.get('attendance_threshold') or prefs.get('warning_threshold') or prefs.get('min_attendance') or 75
    warn_val = int(base_val)
    
    response_data = {
        "email": user_email,
        "name": user_data.get('name', session['user'].get('name', 'User')),
        "picture": user_data.get('picture'),
        "course": user_data.get('course'),
        "batch": user_data.get('batch'),
        "college": user_data.get('college'),
        
        # Preferences
        "semester": prefs.get('semester', 1),
        "attendance_threshold": warn_val, 
        "warning_threshold": warn_val,       # Mobile uses this
        "min_attendance": warn_val,          # Web uses this
        "notifications_enabled": prefs.get('notifications_enabled', False),
    }
    
    return jsonify(response_data)


@api_bp.route('/update_profile', methods=['PUT', 'POST'])
def update_profile():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    data = request.json
    
    # Allowed fields
    allowed = ['name', 'course', 'semester', 'batch', 'college', 'phone', 'gender', 'address', 'guardian_name', 'guardian_phone']
    update_data = {k: v for k, v in data.items() if k in allowed}
    
    if 'semester' in update_data:
        try:
            update_data['semester'] = int(update_data['semester'])
        except:
            pass
            
    if not update_data:
        return jsonify({"error": "No valid fields to update"}), 400
        
    users_collection.update_one(
        {'email': user_email},
        {'$set': update_data}
    )
    
    # Sync semester to preferences
    if 'semester' in update_data:
         preferences_collection.update_one(
            {'owner_email': user_email},
            {'$set': {'preferences.semester': update_data['semester']}},
            upsert=True
         )
    
    # Update Session
    # session['user'] is a dict, so we can update it
    # But strictly speaking session is immutable-ish in some contexts without reassignment
    # Flask session handles dict updates if modified=True
    for k, v in update_data.items():
        session['user'][k] = v
    session.modified = True
    
    return jsonify({"success": True})



# --- Collections (Global Scope) ---
subjects_collection = db.get_collection('subjects')
attendance_log_collection = db.get_collection('attendance_logs')
timetable_collection = db.get_collection('timetable')
system_logs_collection = db.get_collection('system_logs')
holidays_collection = db.get_collection('holidays')
academic_records_collection = db.get_collection('users_collection') # Legacy name check?
users_collection = db.get_collection('users')
# Collections for Persistence
manual_courses_collection = db.get_collection('manual_courses')
semester_results_collection = db.get_collection('semester_results')
skills_collection = db.get_collection('skills')
deadlines_collection = db.get_collection('deadlines')

@api_bp.route('/upload_pfp', methods=['POST'])
def upload_pfp():
    try:
        if db is None:
            return jsonify({"error": "Database not connected"}), 500

        if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
        if 'file' not in request.files: return jsonify({"error": "No file part"}), 400
            
        file = request.files['file']
        if file.filename == '': return jsonify({"error": "No selected file"}), 400

        if file:
            # Check file size (max 5MB)
            file.seek(0, os.SEEK_END)
            size = file.tell()
            file.seek(0)
            
            if size > 5 * 1024 * 1024:
                return jsonify({"error": "File too large. Max 5MB."}), 400
                
            # Read and Encode
            file_data = file.read()
            encoded_string = base64.b64encode(file_data).decode('utf-8')
            mime_type = file.content_type or 'image/jpeg'
            
            # Create Data URL
            data_url = f"data:{mime_type};base64,{encoded_string}"
            
            # Update User Profile in DB
            users_collection.update_one(
                {'email': session['user']['email']},
                {'$set': {'picture': data_url}}
            )
            
            # CRITICAL FIX: Do NOT store Base64 image in session cookie (too large, causes 500 error)
            # We keep it in DB only. Endpoints like current_user should fetch from DB if needed.
            # We can optionally store a flag or 'true' here if needed by frontend logic, 
            # but usually frontend re-fetches user or uses the returned URL.
            # session['user']['picture'] = data_url # REMOVED
            if 'picture' in session['user']:
                # Clear it from session if it was there to fix existing bloated cookies
                session['user']['picture'] = None 
                
            session.modified = True
            
            return jsonify({"url": data_url})
            
    except Exception as e:
        print(f"Upload Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to upload image: {str(e)}"}), 500
        
    return jsonify({"error": "Upload failed"}), 500


# --- Helper Functions ---


def calculate_percent(attended, total):
    """Calculates the attendance percentage."""
    return round((attended / total) * 100, 1) if total > 0 else 0

# --- IPU Grading Helper Functions ---
def get_ipu_grade(percentage):
    """Returns IPU grade and grade point based on percentage."""
    if percentage >= 90:
        return 'O', 10
    elif percentage >= 75:
        return 'A+', 9
    elif percentage >= 65:
        return 'A', 8
    elif percentage >= 55:
        return 'B+', 7
    elif percentage >= 50:
        return 'B', 6
    elif percentage >= 45:
        return 'C', 5
    elif percentage >= 40:
        return 'P', 4
    else:
        return 'F', 0

def calculate_subject_result(subject):
    """
    Calculates total marks, percentage, grade and grade point for a subject.
    IPU formula: Theory (40 internal + 60 external) + Practical (40 internal + 60 external)
    """
    subject_type = subject.get('type', 'theory')
    """Calculate total marks, percentage, grade, and grade point for a subject."""
    s_type = subject.get('type', 'theory')
    
    # Convert to int, handling both None and string values
    internal_theory = int(subject.get('internal_theory') or 0) if subject.get('internal_theory') else 0
    external_theory = int(subject.get('external_theory') or 0) if subject.get('external_theory') else 0
    internal_practical = int(subject.get('internal_practical') or 0) if subject.get('internal_practical') else 0
    external_practical = int(subject.get('external_practical') or 0) if subject.get('external_practical') else 0
    
    total_marks = 0
    max_marks = 0
    
    if s_type == 'theory':
        total_marks = internal_theory + external_theory
        max_marks = 100
    elif s_type == 'practical':
        total_marks = internal_practical + external_practical
        max_marks = 100
    elif s_type == 'nues':
        total_marks = internal_theory
        max_marks = 100
    
    percentage = (total_marks / max_marks * 100) if max_marks > 0 else 0
    grade, grade_point = get_ipu_grade(percentage)
    
    return {
        'total_marks': total_marks,
        'max_marks': max_marks,
        'percentage': round(percentage, 2),
        'grade': grade,
        'grade_point': grade_point
    }

def calculate_sgpa(subjects):
    """
    Calculates SGPA using IPU formula.
    SGPA = Σ(Grade Point × Credits) / Σ(Credits)
    """
    total_credits = 0
    weighted_sum = 0
    
    for subject in subjects:
        credits = subject.get('credits', 0) or 0
        grade_point = subject.get('grade_point', 0) or 0
        weighted_sum += grade_point * credits
        total_credits += credits
    
    return round(weighted_sum / total_credits, 2) if total_credits > 0 else 0

def calculate_cgpa(all_semester_results):
    """
    Calculates CGPA across all semesters using IPU Ordinance 11 formula.
    CGPA = ΣΣ(Cni × Gni) / ΣΣ(Cni)
    Where Cni = credits of ith course of nth semester
          Gni = grade point of ith course of nth semester
    This sums across ALL courses from ALL semesters.
    """
    total_credits = 0
    weighted_sum = 0
    
    for result in all_semester_results:
        # Sum across each subject in this semester
        subjects = result.get('subjects', [])
        for subject in subjects:
            credits = subject.get('credits', 0) or 0
            grade_point = subject.get('grade_point', 0) or 0
            weighted_sum += grade_point * credits
            total_credits += credits
    
    return round(weighted_sum / total_credits, 2) if total_credits > 0 else 0

def calculate_bunk_guard(attended, total, required_percent=75):
    """Calculates bunk status and messages using a potentially custom threshold."""
    required_percent = float(required_percent) / 100.0
    if total == 0:
        return {"status": "neutral", "status_message": "No classes yet", "percentage": 0}

    current_percent = attended / total
    if current_percent >= required_percent:
        safe_skips = math.floor((attended - required_percent * total) / required_percent) if required_percent > 0 else float('inf')
        return {"status": "safe", "status_message": f"You have {safe_skips} safe skips.", "percentage": round(current_percent * 100, 1)}
    else:
        classes_to_attend = math.ceil((required_percent * total - attended) / (1 - required_percent)) if (1 - required_percent) > 0 else -1
        status_msg = f"Attend the next {classes_to_attend} classes." if classes_to_attend != -1 else "Attend all upcoming classes."
        return {"status": "danger", "status_message": status_msg, "percentage": round(current_percent * 100, 1)}

def calculate_streak(user_email):
    """
    Calculates the user's current perfect attendance streak.
    A day counts towards the streak if all scheduled classes on that day were attended.
    Holidays are skipped and do not break the streak.
    """
    today = datetime.utcnow().date()
    current_streak = 0
    
    holidays = {h['date'] for h in holidays_collection.find({'owner_email': user_email}, {'date': 1})}
    
    logs = list(attendance_log_collection.find(
        {'owner_email': user_email},
        {'date': 1, 'status': 1, '_id': 0}
    ).sort('date', -1))

    if not logs:
        return 0

    logs_by_date = {k: list(v) for k, v in groupby(logs, key=lambda x: x['date'])}
    
    day_to_check = today
    while True:
        date_str = day_to_check.strftime("%Y-%m-%d")
        
        if date_str in holidays:
            day_to_check -= timedelta(days=1)
            continue

        if date_str in logs_by_date:
            day_logs = logs_by_date[date_str]
            was_absent = any(log['status'] in ['absent', 'pending_medical'] for log in day_logs)
            
            if was_absent:
                break
            else:
                current_streak += 1
        else:
            if day_to_check.weekday() < 5: # If it's a weekday with no logs, streak is broken
                 break

        day_to_check -= timedelta(days=1)
        
    return current_streak


# === CORE API ROUTES ===

@api_bp.route('/current_user')
def get_current_user():
    # print(f"🔍 /current_user called") # Reduce noise
    if 'user' not in session: 
        # print("❌ No user in session, returning None")
        return jsonify(None), 200 
    
    # CRITICAL SYNC FIX: Fetch EVERYTHING from DB
    # Session data is stale if another device (Mobile) updated the profile.
    # We only trust the session for the 'email' (Identity).
    user_email = session['user'].get('email')
    if not user_email:
        return jsonify(None), 200

    try:
        # Fetch latest user data from DB
        db_user = users_collection.find_one({'email': user_email})
        if db_user:
            # Convert ObjectId to string if needed (json_util handles it usually, but jsonify might not)
            if '_id' in db_user:
                db_user['_id'] = str(db_user['_id'])
            
            # Ensure email is set (it is, but for safety)
            db_user['email'] = user_email
            
            # Use this fresh DB data
            # print(f"✅ Returning fresh DB user: {user_email}")
            return jsonify(db_user)
            
    except Exception as e:
        print(f"⚠️ Error fetching current_user from DB: {e}")
        
    # Fallback to session if DB fails (shouldn't happen)
    print(f"⚠️ Fallback to session for: {user_email}")
    return jsonify(session['user'])

@api_bp.route('/dashboard_data')
@api_bp.route('/dashboard/data')  # Alias for frontend compatibility
def get_dashboard_data():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    try:
        user_email = session['user']['email']
        current_semester = int(request.args.get('semester', 1))

        # Parallel-ish: fetch preferences + subjects with projection (only needed fields)
        subject_projection = {
            '_id': 1, 'name': 1, 'code': 1, 'professor': 1, 'classroom': 1,
            'attended': 1, 'total': 1, 'semester': 1, 'owner_email': 1,
            'type': 1, 'color': 1, 'credits': 1
        }
        user_prefs_doc = preferences_collection.find_one(
            {'owner_email': user_email},
            {'preferences.attendance_threshold': 1}  # Only fetch what we need
        )
        prefs = user_prefs_doc.get('preferences', {}) if user_prefs_doc else {}
        required_percent = int(prefs.get('attendance_threshold', 75))

        query = {"owner_email": user_email, "semester": current_semester}
        subjects = list(subjects_collection.find(query, subject_projection))
        
        total_attended = sum(s.get('attended', 0) for s in subjects)
        total_classes = sum(s.get('total', 0) for s in subjects)
        overall_percent = calculate_percent(total_attended, total_classes)
        subjects_overview = [{
            "id": str(s['_id']), 
            "name": s.get('name', 'N/A'), 
            "code": s.get('code', ''),
            "professor": s.get('professor', ''),
            "classroom": s.get('classroom', ''),
            "attended": s.get('attended', 0),
            "total": s.get('total', 0),
            **calculate_bunk_guard(s.get('attended', 0), s.get('total', 0), required_percent)
        } for s in subjects]
        
        # Transform subjects — use jsonify instead of slow json_util.dumps
        transformed_subjects = []
        for s in subjects:
            stats = calculate_bunk_guard(s.get('attended', 0), s.get('total', 0), required_percent)
            s_dict = {
                **{k: v for k, v in s.items() if k != '_id'},
                "attendance_percentage": stats["percentage"],
                "status_message": stats["status_message"],
                "_id": str(s['_id'])
            }
            transformed_subjects.append(s_dict)

        response_data = {
            "current_date": datetime.now().strftime("%B %d, %Y"), 
            "overall_attendance": overall_percent, 
            "subjects_overview": subjects_overview,
            "subjects": transformed_subjects,
            "current_semester": current_semester,
            "total_subjects": len(subjects)
        }
        # Use jsonify (fast) instead of json_util.dumps (slow BSON serializer)
        resp = jsonify(response_data)
        resp.headers['Cache-Control'] = 'private, max-age=30'
        return resp
    except Exception as e:
        print(f"---! ERROR IN /api/dashboard_data: {e} !---")
        traceback.print_exc()
        return jsonify({"error": "A server error occurred."}), 500

@api_bp.route('/reports_data')
def get_reports_data():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    try:
        user_email = session['user']['email']
        current_semester = int(request.args.get('semester', 1))
        
        subjects = list(subjects_collection.find({"owner_email": user_email, "semester": current_semester}))
        
        best_subject, worst_subject = {}, {}
        total_absences = 0
        
        if subjects:
            for s in subjects:
                s['percentage'] = calculate_percent(s.get('attended', 0), s.get('total', 0))
            
            if subjects: # Ensure list is not empty before using max/min
                best_subject = max(subjects, key=lambda s: s['percentage'])
                worst_subject = min(subjects, key=lambda s: s['percentage'])
                total_absences = sum(s.get('total', 0) - s.get('attended', 0) for s in subjects)

        heatmap_data_sets = {}
        start_date = datetime.utcnow().replace(tzinfo=None) - timedelta(days=34)
        logs_for_heatmap = list(attendance_log_collection.find(
            {"owner_email": user_email, "timestamp": {'$gte': start_date}},
            {'date': 1, 'status': 1, '_id': 0}
        ))
        for log in logs_for_heatmap:
            date_str = log['date']
            status = log['status']
            if date_str not in heatmap_data_sets:
                heatmap_data_sets[date_str] = set()
            if status in ['present', 'approved_medical']:
                heatmap_data_sets[date_str].add('present')
            elif status in ['absent', 'pending_medical']:
                heatmap_data_sets[date_str].add('absent')

        heatmap_data_lists = {date: list(statuses) for date, statuses in heatmap_data_sets.items()}
        
        # --- Weekly Breakdown: Cumulative Attendance by Day of Week (Mon-Sun) ---
        # This shows average attendance for each day across the semester
        # More meaningful than "last 7 days" which fluctuates randomly
        weekly_logs = list(attendance_log_collection.find(
            {
                "owner_email": user_email, 
                "semester": current_semester,
                "status": {'$in': ['present', 'absent', 'late', 'approved_medical', 'approved_duty']}
            },
            {'date': 1, 'status': 1, 'timestamp': 1, '_id': 0}
        ))
        
        # Group by day of week
        day_stats = {}
        for log in weekly_logs:
            # Get day of week from timestamp
            if 'timestamp' in log and log['timestamp']:
                day_name = log['timestamp'].strftime('%A')  # 'Monday', 'Tuesday', etc.
                
                if day_name not in day_stats:
                    day_stats[day_name] = {'attended': 0, 'total': 0}
                
                day_stats[day_name]['total'] += 1
                if log['status'] in ['present', 'approved_medical', 'approved_duty']:
                    day_stats[day_name]['attended'] += 1
        
        # Convert to date format expected by frontend (using current week as reference)
        today = datetime.utcnow().date()
        # Find Monday of current week
        days_since_monday = today.weekday()  # 0=Monday, 6=Sunday
        monday = today - timedelta(days=days_since_monday)
        
        stats_map = {}
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        for i, day_name in enumerate(day_names):
            date_str = (monday + timedelta(days=i)).strftime("%Y-%m-%d")
            if day_name in day_stats:
                stats_map[date_str] = day_stats[day_name]
            else:
                stats_map[date_str] = {'attended': 0, 'total': 0}
        
        streak = calculate_streak(user_email)

        response_data = {
            "kpis": {
                "best_subject_name": best_subject.get('name', '--'),
                "best_subject_percent": f"{best_subject.get('percentage', 0):.1f}%",
                "worst_subject_name": worst_subject.get('name', '--'),
                "worst_subject_percent": f"{worst_subject.get('percentage', 0):.1f}%",
                "total_absences": total_absences,
                "streak": streak
            },
            "subject_breakdown": sorted(subjects, key=lambda s: s.get('percentage', 0), reverse=True),
            "heatmap_data": heatmap_data_lists,
            "weekly_breakdown": stats_map
        }
        
        return Response(json_util.dumps(response_data), mimetype='application/json')
    except Exception as e:
        print(f"---! UNEXPECTED ERROR IN /api/reports_data: {e} !---")
        traceback.print_exc()
        return jsonify({"error": "An internal error occurred."}), 500

@api_bp.route('/attendance_logs')
def get_attendance_logs():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 15))
        skip = (page - 1) * limit

        user_email = session['user']['email']
        query = {'owner_email': user_email}
        
        semester = request.args.get('semester')
        if semester:
            try:
                query['semester'] = int(semester)
            except ValueError:
                pass # Ignore invalid semester param

        total_logs = attendance_log_collection.count_documents(query)
        pipeline = [
            {'$match': query},
            {'$sort': {'timestamp': -1}},
            {'$skip': skip},
            {'$limit': limit},
            {'$lookup': {'from': 'subjects', 'localField': 'subject_id', 'foreignField': '_id', 'as': 'subject_info'}},
            {'$unwind': {'path': '$subject_info', 'preserveNullAndEmptyArrays': True}}
        ]
        logs = list(attendance_log_collection.aggregate(pipeline))
        
        # Post-process to ensure subject name exists if subject was deleted
        for log in logs:
            if 'subject_info' not in log:
                 log['subject_info'] = {'name': 'Deleted Subject', 'code': '---'}

        has_next_page = total_logs > (skip + len(logs))
        
        response_data = {"logs": logs, "has_next_page": has_next_page}
        return Response(json_util.dumps(response_data), mimetype='application/json')
    except Exception as e:
        print(f"---! ERROR IN /api/attendance_logs: {e} !---")
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch logs."}), 500

@api_bp.route('/get_attendance_logs')
def get_attendance_logs_by_date():
    """Simple endpoint to get attendance logs for a specific date"""
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({"error": "Date parameter required"}), 400
    
    user_email = session['user']['email']
    query = {'owner_email': user_email, 'date': date_str}
    
    semester = request.args.get('semester')
    if semester:
        query['semester'] = int(semester)
    
    logs = list(attendance_log_collection.find(query).sort('timestamp', 1))
    return Response(json_util.dumps(logs), mimetype='application/json')

@api_bp.route('/mark_attendance', methods=['POST'])
def mark_attendance():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    subject_id_str = data.get('subject_id')
    status = data.get('status')
    notes = data.get('notes', None)
    date_str = data.get('date', datetime.now().strftime("%Y-%m-%d"))
    substituted_by_id = data.get('substituted_by_id', None)
    
    try:
        subject_id = ObjectId(subject_id_str)
    except:
        return jsonify({"error": "Invalid Subject ID format"}), 400

    subject = subjects_collection.find_one({'_id': subject_id})
    if not subject: 
        return jsonify({"error": "Subject not found"}), 404
    
    # allow multiple marks per day (for multi-period subjects)
    # The get_classes_for_date logic matches logs to slots by order of timestamp.
    
    # 1. Handle Primary Log
    log_entry = {
        "subject_id": subject_id,
        "subject_name": subject.get('name'),
        "type": data.get('type', 'Lecture'), # Mobile can pass type
        "owner_email": session['user']['email'],
        "date": date_str,
        "status": status,
        "timestamp": datetime.utcnow(),
        "semester": subject.get('semester')
    }
    if notes: log_entry['notes'] = notes
    if substituted_by_id: log_entry['substituted_by'] = ObjectId(substituted_by_id)

    attendance_log_collection.insert_one(log_entry)
    
    # 2. Update stats for Original Subject
    update_query = {}
    if status in ['present', 'absent', 'late']:
        # Standard attendance
        update_query['$inc'] = {'total': 1}
        if status == 'present':
            update_query.setdefault('$inc', {})['attended'] = 1
    
    elif status in ['medical', 'approved_medical']:
        # Medical leaves usually don't count against you, or handled as present?
        # User requested "more options to add medical". Usually implies "Exempt" or "Present".
        # Let's treat 'medical' as Neutral (Total doesn't increase) OR Present.
        # Common academic policy: Medical is "Excused" (Total doesn't increase).
        # But if user wants it to count as attended, we can change.
        # Let's stick to "Excused" (Neutral) for now unless specified. 
        # Actually existing code handled 'approved_medical' as attended+1, total+1.
        # Let's keep consistency: Medical = Present effectively for attendance % usually?
        # Re-reading existing: if status == 'approved_medical': inc attended, inc total.
        update_query['$inc'] = {'total': 1, 'attended': 1} 

    elif status == 'substituted':
        # If substituted, original class didn't happen. Total stays same (Neutral).
        pass

    elif status == 'cancelled':
        # Class cancelled. Total stays same (Neutral).
        pass

    if update_query:
        subjects_collection.update_one({'_id': subject_id}, update_query)

    # 3. Handle Substitution Logic (The "Other" Subject)
    if status == 'substituted' and substituted_by_id:
        sub_id = ObjectId(substituted_by_id)
        sub_subject = subjects_collection.find_one({'_id': sub_id})
        if sub_subject:
            # Create a "Present" log for the substituting subject
            # Check if there's already a log for that sub subject on that day?
            # A subject can occur multiple times a day. We should allow it.
            # But the 'date + subject_id' unique constraint in logic might exist?
            # existing_log check above prevents duplicates.
            # We need to ensure we don't block multiple classes of same subject per day eventually.
            # For now, let's assume one class per subject per day scheme, OR strict check.
            # BunkGuard usually assumes 1 slot = 1 decision. 
            
            # We'll just insert a "Extra Class" log effectively.
             attendance_log_collection.insert_one({
                "subject_id": sub_id,
                "owner_email": session['user']['email'],
                "date": date_str,
                "status": "present", # Counts as present
                "type": "substitution_class", # Metadata
                "timestamp": datetime.utcnow(),
                "semester": sub_subject.get('semester'),
                "notes": f"Substituted {subject.get('name')}"
            })
             subjects_collection.update_one({'_id': sub_id}, {'$inc': {'total': 1, 'attended': 1}})
        
    from api import socketio
    socketio.emit('attendance_updated', {'email': session['user']['email'], 'date': date_str}, room=session['user']['email'])
    
    # Log to System Logs
    log_desc = f"Marked '{subject.get('name')}' as {status} for {date_str}."
    create_system_log(session['user']['email'], "Attendance Marked", log_desc)

    return jsonify({"success": True})


@api_bp.route('/mark_all_attendance', methods=['POST'])
def mark_all_attendance():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    subject_ids = [ObjectId(id) for id in data.get('subject_ids', [])]
    status = data.get('status')
    date_str = data.get('date', datetime.now().strftime("%Y-%m-%d"))
    user_email = session['user']['email']

    marked_count = 0
    for subject_id in subject_ids:
        if not attendance_log_collection.find_one({"subject_id": subject_id, "date": date_str}):
            subject = subjects_collection.find_one({'_id': subject_id})
            if subject:
                attendance_log_collection.insert_one({
                    "subject_id": subject_id, "owner_email": user_email,
                    "date": date_str, "status": status, "timestamp": datetime.utcnow(),
                    "semester": subject.get('semester')
                })
                update_query = {'$inc': {'total': 1}}
                if status == 'present':
                    update_query['$inc']['attended'] = 1
                subjects_collection.update_one({'_id': subject_id}, update_query)
                marked_count += 1

    from api import socketio
    socketio.emit('attendance_updated', {'email': user_email, 'date': date_str}, room=user_email)
    
    create_system_log(user_email, "Bulk Attendance", f"Marked {marked_count} classes as {status} for {date_str}.")
    return jsonify({"success": True, "message": f"Marked {marked_count} classes."})


@api_bp.route('/todays_classes')
def get_todays_classes():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    
    # Support overriding date for testing logic
    date_str = request.args.get('date')
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d")
        except:
            return jsonify({"error": "Invalid date format"}), 400
    else:
        target_date = datetime.now()

    # Python weekday: Mon=0 ... Sun=6
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    today_name = day_names[target_date.weekday()]
    today_str = target_date.strftime("%Y-%m-%d")
    
    semester = request.args.get('semester', type=int)
    timetable_doc = timetable_collection.find_one({'owner_email': user_email, 'semester': semester})
    if not timetable_doc and not semester:
        timetable_doc = timetable_collection.find_one({'owner_email': user_email})

    if not timetable_doc:
        return Response(json_util.dumps([]), mimetype='application/json')

    classes = []
    schedule = timetable_doc.get('schedule', {})

    # Fetch subjects in batch for performance
    subjects_cursor = subjects_collection.find({"owner_email": user_email})
    subjects_map = {str(s['_id']): s for s in subjects_cursor}

    day_slots = []
    if isinstance(schedule, dict):
        if any(d in schedule for d in day_names):
            day_slots = schedule.get(today_name, [])
        else:
            # Fallback for old nesting
            for time_slot, days in schedule.items():
                if isinstance(days, dict) and today_name in days:
                    day_slots.append({**days[today_name], 'time': time_slot})

    for slot in day_slots:
        if slot.get('type') in ['break', 'free']: continue
        
        sid = slot.get('subject_id') or slot.get('subjectId')
        if not sid: continue
        
        subject = subjects_map.get(str(sid))
        if subject:
            log = attendance_log_collection.find_one({"subject_id": ObjectId(sid), "date": today_str})
            classes.append({
                "_id": str(sid),
                "id": str(sid),
                "name": subject.get('name'),
                "start_time": slot.get('start_time') or (slot.get('time', '').split('-')[0].strip() if slot.get('time') else '09:00 AM'),
                "end_time": slot.get('end_time') or (slot.get('time', '').split('-')[1].strip() if slot.get('time') and '-' in slot.get('time') else '10:00 AM'),
                "marked_status": log["status"] if log else "pending",
                "log_id": str(log["_id"]) if log else None
            })

    return Response(json_util.dumps(classes), mimetype='application/json')


@api_bp.route('/classes_for_date')
def get_classes_for_date():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    date_str = request.args.get('date')
    if not date_str:
        return jsonify({"error": "Date parameter is required"}), 400

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

    user_email = session['user']['email']
    semester = request.args.get('semester', type=int)
    
    # Python's weekday(): Monday=0, Sunday=6
    # Map Python weekday to day names used in DB
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_name = day_names[target_date.weekday()]
    
    # Debug log
    print(f"📅 Classes for date: {target_date.strftime('%Y-%m-%d')} → {day_name} (weekday={target_date.weekday()})")
    
    timetable_doc = timetable_collection.find_one({'owner_email': user_email, 'semester': semester})
    if not timetable_doc and semester == 1:
        # Fallback for migration if not found
        timetable_doc = timetable_collection.find_one({'owner_email': user_email})

    if not timetable_doc:
        return Response(json_util.dumps([]), mimetype='application/json')

    slots_to_return = []
    schedule = timetable_doc.get('schedule', {})
    
    if isinstance(schedule, dict):
        day_slots = []
        if any(d in schedule for d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']):
            day_slots = schedule.get(day_name, [])
        else:
            # Fallback to Old Format
            for time_slot, days in schedule.items():
                if isinstance(days, dict) and day_name in days:
                    day_slots.append({**days[day_name], 'time': time_slot})
        
        for slot in day_slots:
            if slot.get('subject_id') or slot.get('subjectId'):
                sid = str(slot.get('subject_id') or slot.get('subjectId'))
                subject = subjects_collection.find_one({"_id": ObjectId(sid)})
                if subject:
                    slots_to_return.append({
                        "_id": sid,
                        "id": sid,
                        "name": subject.get('name'),
                        "time": slot.get('start_time') or (slot.get('time', '').split('-')[0].strip() if slot.get('time') else ''),
                        "end_time": slot.get('end_time') or (slot.get('time', '').split('-')[1].strip() if slot.get('time') and '-' in slot.get('time') else ''),
                        "type": slot.get('type', 'Lecture'),
                        "marked_status": "pending"
                    })
    
    # 2. Get Attendance Logs on this Date
    logs = list(attendance_log_collection.find({'owner_email': user_email, 'date': date_str}))
    
    if not slots_to_return and not logs:
        return Response(json_util.dumps([]), mimetype='application/json')
    
    processed_log_ids = set()
    # Improved matching: Share logs across consecutive same-type slots if only one log exists (e.g. Labs / Double Periods)
    for sid in set([s['id'] for s in slots_to_return]):
        # Sort slots by time to ensure consecutiveness check works
        subj_slots = sorted([s for s in slots_to_return if s['id'] == sid], key=lambda x: x.get('time', ''))
        # Sort logs by timestamp to match sequence
        subj_logs = sorted([l for l in logs if str(l.get('subject_id')) == sid], key=lambda x: x.get('timestamp', datetime.min))
        
        current_log_idx = -1
        for i, slot in enumerate(subj_slots):
            is_new_block = True
            if i > 0:
                prev = subj_slots[i-1]
                # If same type, we consider it part of the same "session block" (matches frontend grouping)
                if slot.get('type') == prev.get('type'):
                    is_new_block = False
            
            if current_log_idx == -1:
                if len(subj_logs) > 0: current_log_idx = 0
            else:
                # If it's a new block (not consecutive), we MUST try to move to the next log
                if is_new_block:
                    current_log_idx += 1
                # If it's the SAME block, we only move if we have more logs available 
                # (This preserves accurate display for legacy duplicates or manual multi-marks)
                elif current_log_idx + 1 < len(subj_logs):
                    current_log_idx += 1
            
            if current_log_idx >= 0 and current_log_idx < len(subj_logs):
                slot['marked_status'] = subj_logs[current_log_idx]['status']
                slot['log_id'] = str(subj_logs[current_log_idx]['_id'])
                processed_log_ids.add(subj_logs[current_log_idx]['_id'])
    
    return Response(json_util.dumps(slots_to_return), mimetype='application/json')







@api_bp.route('/edit_attendance/<log_id>', methods=['POST'])
def edit_attendance(log_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    new_status = data.get('status')
    new_notes = data.get('notes', None)
    new_date = data.get('date') # Support changing date
    
    log = attendance_log_collection.find_one({'_id': ObjectId(log_id)})
    if not log:
        return jsonify({"error": "Log not found"}), 404
        
    old_status = log['status']
    subject_id = log['subject_id'] # ObjectId
    
    # 1. Revert Old Stats
    revert_query = {}
    if old_status in ['present', 'approved_medical', 'late']:
        # These incremented Total and Attended
        revert_query['$inc'] = {'total': -1, 'attended': -1}
    elif old_status == 'absent':
        # Incremented Total only
        revert_query['$inc'] = {'total': -1}
    # 'substituted', 'cancelled', 'medical' (if neutral) -> No stats change to revert
    
    if revert_query:
        subjects_collection.update_one({'_id': subject_id}, revert_query)

    # 2. Handle Substituted Cleanup if changing FROM substituted
    if old_status == 'substituted' and log.get('substituted_by'):
       # We need to find the "Extra Class" log for the substitute and delete/revert it?
       # This is tricky. We'd have to find the log created at similiar time or by logic.
       # Improvement: Store `linked_log_id` in future.
       # For now: User manually fixes substitute subject if needed.
       pass

    # 3. Apply New Stats
    apply_query = {}
    if new_status in ['present', 'approved_medical', 'late']:
        apply_query['$inc'] = {'total': 1, 'attended': 1}
    elif new_status == 'absent':
        apply_query['$inc'] = {'total': 1}
    
    if apply_query:
        subjects_collection.update_one({'_id': subject_id}, apply_query)
        
    # 4. Update the log entry
    update_fields = {'status': new_status}
    if new_notes is not None: update_fields['notes'] = new_notes
    if new_date: update_fields['date'] = new_date

    attendance_log_collection.update_one({'_id': ObjectId(log_id)}, {'$set': update_fields})

    subject = subjects_collection.find_one({'_id': subject_id})
    create_system_log(session['user']['email'], "Attendance Edited", f"Changed '{subject.get('name')}' from {old_status} to {new_status}.")
    
    from api import socketio
    socketio.emit('attendance_updated', {'email': session['user']['email'], 'date': new_date or log['date']}, room=session['user']['email'])

    return jsonify({"success": True})


@api_bp.route('/delete_attendance/<log_id>', methods=['DELETE'])
def delete_attendance(log_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    log = attendance_log_collection.find_one({'_id': ObjectId(log_id)})
    if not log:
        return jsonify({"error": "Log not found"}), 404
        
    old_status = log['status']
    subject_id = log['subject_id'] # ObjectId
    
    # 1. Revert Stats for Original Subject
    revert_query = {}
    if old_status in ['present', 'approved_medical', 'late']:
        revert_query['$inc'] = {'total': -1, 'attended': -1}
    elif old_status == 'absent':
        revert_query['$inc'] = {'total': -1}
    
    if revert_query:
        subjects_collection.update_one({'_id': subject_id}, revert_query)

    # 2. Handle Substitution Clean-up
    # If this log says "substituted", there might be a corresponding "substitution_class" log 
    # for another subject on the same date/owner.
    if old_status == 'substituted' and 'substituted_by' in log:
        sub_subject_id = log['substituted_by']
        date_str = log['date']
        
        # Find the Extra Class log
        # We assume the one with type='substitution_class' and matching date/subject/owner
        # and notes containing the original subject name is the best match.
        # Ideally, we should have linked them by ID, but we didn't. 
        # But 'mark_attendance' creates it immediately.
        
        # Heuristic: Find specific sub class log
        sub_log = attendance_log_collection.find_one({
            'subject_id': sub_subject_id,
            'date': date_str,
            'type': 'substitution_class',
            'owner_email': session['user']['email']
        })
        
        if sub_log:
             # Delete it and revert ITS stats
             attendance_log_collection.delete_one({'_id': sub_log['_id']})
             # 'substitution_class' counts as Present (total+1, attended+1)
             subjects_collection.update_one({'_id': sub_subject_id}, {'$inc': {'total': -1, 'attended': -1}})


    # 3. Delete the main log
    attendance_log_collection.delete_one({'_id': ObjectId(log_id)})

    subject = subjects_collection.find_one({'_id': subject_id})
    subject_name = subject.get('name') if subject else "Unknown Subject"
    create_system_log(session['user']['email'], "Attendance Deleted", f"Removed attendance record for '{subject_name}' on {log['date']}.")
    
    from api import socketio
    socketio.emit('attendance_updated', {'email': session['user']['email'], 'date': log['date']}, room=session['user']['email'])
    
    return jsonify({"success": True})


@api_bp.route('/update_subject_full_details', methods=['POST'])
def update_subject_full_details():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    subject_id = ObjectId(data.get('subject_id'))
    user_email = session['user']['email']
    
    # Fetch current state first
    subject = subjects_collection.find_one({'_id': subject_id, 'owner_email': user_email})
    if not subject: return jsonify({"error": "Subject not found"}), 404
    
    update_fields = {}
    if 'name' in data: update_fields['name'] = data['name']
    if 'code' in data: update_fields['code'] = data['code']
    if 'categories' in data: update_fields['categories'] = data['categories']
    if 'syllabus' in data: update_fields['syllabus'] = data['syllabus']
    if 'professor' in data: update_fields['professor'] = data['professor']
    if 'classroom' in data: update_fields['classroom'] = data['classroom']
    if 'semester' in data: update_fields['semester'] = int(data['semester'])
    
    # Handle Totals (Practical/Assignment) safely
    # Check if object exists or is null
    current_practicals = subject.get('practicals')
    current_assignments = subject.get('assignments')
    
    # 1. Update Practical Total
    if 'practical_total' in data:
        new_total = int(data['practical_total'])
        if isinstance(current_practicals, dict):
            update_fields['practicals.total'] = new_total
        else:
            # Initialize if null/missing
            update_fields['practicals'] = {'total': new_total, 'completed': 0, 'hardcopy': False}
            current_practicals = update_fields['practicals'] # Update local state for subsequent checks

    # 2. Update Assignment Total
    if 'assignment_total' in data:
        new_total = int(data['assignment_total'])
        if isinstance(current_assignments, dict):
            update_fields['assignments.total'] = new_total
        else:
            # Initialize if null/missing
            update_fields['assignments'] = {'total': new_total, 'completed': 0, 'hardcopy': False}
            current_assignments = update_fields['assignments']

    # 3. Handle Category Additions (Ensure objects exist if category added)
    if 'categories' in data:
        cats = data['categories']
        
        # Ensure Practical Object
        if 'Practical' in cats and not isinstance(current_practicals, dict) and 'practicals' not in update_fields:
             update_fields['practicals'] = {'total': 10, 'completed': 0, 'hardcopy': False}
        
        # Ensure Assignment Object
        if 'Assignment' in cats and not isinstance(current_assignments, dict) and 'assignments' not in update_fields:
             update_fields['assignments'] = {'total': 4, 'completed': 0, 'hardcopy': False}
        
        # 4. Sync 'type' with categories (Theory/Practical/Both)
        is_theory = 'Theory' in cats
        is_practical = 'Practical' in cats
        if is_theory and is_practical:
            update_fields['type'] = 'both'
        elif is_practical:
            update_fields['type'] = 'practical'
        else:
            update_fields['type'] = 'theory'

    if not update_fields:
        return jsonify({"success": True}) 

    subjects_collection.update_one(
        {'_id': subject_id, 'owner_email': user_email},
        {'$set': update_fields}
    )

    return jsonify({"success": True})

    return jsonify({"success": True})


@api_bp.route('/subject/<subject_id>/practicals', methods=['PUT'])
def update_practicals(subject_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "No data provided"}), 400
        
        update_fields = {}
        
        if 'total' in data: update_fields['practicals.total'] = int(data['total'])
        if 'completed' in data: update_fields['practicals.completed'] = int(data['completed'])
        if 'hardcopy' in data: update_fields['practicals.hardcopy'] = bool(data['hardcopy'])
        
        if not update_fields: return jsonify({"success": True})
            
        result = subjects_collection.update_one(
            {'_id': ObjectId(subject_id), 'owner_email': session['user']['email']},
            {'$set': update_fields}
        )
        
        if result.matched_count == 0: return jsonify({"error": "Subject not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error updating practicals: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/subject/<subject_id>/assignments', methods=['PUT'])
def update_assignments(subject_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "No data provided"}), 400
        
        update_fields = {}
        
        if 'total' in data: update_fields['assignments.total'] = int(data['total'])
        if 'completed' in data: update_fields['assignments.completed'] = int(data['completed'])
        if 'hardcopy' in data: update_fields['assignments.hardcopy'] = bool(data['hardcopy'])
        
        if not update_fields: return jsonify({"success": True})
            
        result = subjects_collection.update_one(
            {'_id': ObjectId(subject_id), 'owner_email': session['user']['email']},
            {'$set': update_fields}
        )
        
        if result.matched_count == 0: return jsonify({"error": "Subject not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        print(f"Error updating assignments: {e}")
        return jsonify({"error": str(e)}), 500


@api_bp.route('/update_profile', methods=['POST'])
def update_profile_post():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    user_email = session['user']['email']
    
    # Fields allowed to be updated
    allowed_fields = ['name', 'branch', 'college', 'semester', 'batch', 'course']
    update_data = {}
    
    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]
            
    if not update_data:
        return jsonify({"success": True})

    # Update DB
    users_collection = db.get_collection('users')
    users_collection.update_one(
        {'email': user_email},
        {'$set': update_data},
        upsert=True
    )
    
    # Update Session
    session['user'].update(update_data)
    
    # CRITICAL FIX: Also update preferences (semester, thresholds)
    preferences_collection = db.get_collection('user_preferences')
    pref_updates = {}
    
    if 'semester' in data:
        pref_updates['preferences.semester'] = int(data['semester'])
    
    # Handle Attendance Threshold
    if 'attendance_threshold' in data:
        pref_updates['preferences.attendance_threshold'] = int(data['attendance_threshold'])
        
    # Handle Warning Threshold (Sync min_attendance and warning_threshold)
    # Allows both Web (min_attendance) and Mobile (warning_threshold) to work
    val_warning = None
    if 'warning_threshold' in data:
        val_warning = int(data['warning_threshold'])
    elif 'min_attendance' in data:
        val_warning = int(data['min_attendance'])
        
    if val_warning is not None:
        pref_updates['preferences.warning_threshold'] = val_warning
        pref_updates['preferences.min_attendance'] = val_warning # Save both for compatibility
        
    if pref_updates:
        preferences_collection.update_one(
            {'owner_email': user_email},
            {'$set': pref_updates},
            upsert=True
        )
        
    session.modified = True
    
    return jsonify({"success": True, "user": session['user']})


@api_bp.route('/delete_all_data', methods=['DELETE'])
def delete_all_data():
    """DEPRECATED: Use /api/v1/data/delete_all_data instead - this legacy route redirects"""
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    # Redirect to the new secure endpoint
    from api.routes.data_management import delete_all_data as secure_delete
    return secure_delete()


@api_bp.route('/notices')
def get_notices():
    try:
        # Check cache (simple: check if we have notices scraped today)
        today_str = datetime.now().strftime("%Y-%m-%d")
        
        # We can store cached notices in a separate 'notices' collection
        notices_collection = db.get_collection('notices')
        
        cached = notices_collection.find_one({"date_fetched": today_str})
        if cached:
            return jsonify(cached['data'])
            
        # Scrape
        from .scraper import scrape_ipu_notices
        notices = scrape_ipu_notices()
        
        if notices:
            # Cache it
            notices_collection.update_one(
                {"date_fetched": today_str},
                {"$set": {"data": notices, "date_fetched": today_str}},
                upsert=True
            )
            return jsonify(notices)
        else:
            # If scrape fails, try to return latest cached even if old?
            # For now return empty list or older cache
            latest = notices_collection.find_one(sort=[('date_fetched', -1)])
            return jsonify(latest['data'] if latest else [])

    except Exception as e:
        print(f"Notices Error: {e}")
        return jsonify([])

# === SETTINGS PAGE AND OTHER ROUTES ===

@api_bp.route('/full_subjects_data')
def get_full_subjects_data():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    semester = int(request.args.get('semester', 1))
    query = {"owner_email": session['user']['email'], "semester": semester}
    subjects = list(subjects_collection.find(query))
    return Response(json_util.dumps(subjects), mimetype='application/json')

# === PERSISTENCE ROUTES (NEW) ===

# 1. Board Persistence
@api_bp.route('/board', methods=['GET', 'POST'])
def handle_board():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']

    if request.method == 'GET':
        doc = board_collection.find_one({"owner_email": user_email})
        return jsonify(doc['snapshot'] if doc else {})

    if request.method == 'POST':
        snapshot = request.json
        board_collection.update_one(
            {"owner_email": user_email},
            {"$set": {"snapshot": snapshot, "updated_at": datetime.utcnow()}},
            upsert=True
        )
        return jsonify({"success": True})

# 2. Manual Courses Persistence
@api_bp.route('/courses/manual', methods=['GET', 'POST'])
def handle_manual_courses():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    # Critical: Check if database is available
    if db is None:
        print("❌ ERROR: Database is not available in handle_manual_courses")
        return jsonify({"error": "Database connection unavailable. Please check MONGO_URI environment variable."}), 500
    
    user_email = session['user']['email']
    manual_courses_collection = db.get_collection('manual_courses')

    if request.method == 'GET':
        try:
            courses = list(manual_courses_collection.find({'owner_email': user_email}))
            return Response(json_util.dumps(courses), mimetype='application/json')
        except Exception as e:
            print(f"ERROR in GET /courses/manual: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    if request.method == 'POST':
        try:
            data = request.json
            
            # Check if it's an array (full sync from web) or single object (mobile add)
            if isinstance(data, list):
                # Web version: Full sync - replace all courses
                
                # 1. Automatic Backup (Data Safety)
                # Fetch current courses before wiping them
                current_courses = list(manual_courses_collection.find({'owner_email': user_email}))
                if current_courses:
                    backup_doc = {
                        "owner_email": user_email,
                        "backup_timestamp": datetime.utcnow(),
                        "course_count": len(current_courses),
                        "courses": current_courses
                    }
                    # Save into backup collection
                    db.get_collection('manual_courses_backup').insert_one(backup_doc)
                    
                    # Optional: Keep only last 5 backups per user to save space
                    # (Implementation left simple for now: valid backup created)

                # 2. Process all courses first (Safe Step)
                courses_to_insert = []
                for course in data:
                    course_doc = {
                        "owner_email": user_email,
                        "title": course.get('title', 'Untitled'),
                        "platform": course.get('platform', 'custom'),
                        "url": course.get('url', ''),
                        "progress": course.get('progress', 0),
                        "instructor": course.get('instructor', ''),
                        "targetCompletionDate": course.get('targetCompletionDate', ''),
                        "enrolledDate": course.get('enrolledDate', datetime.now().strftime("%Y-%m-%d")),
                        "notes": course.get('notes', ''),
                        "certificateUrl": course.get('certificateUrl', ''),
                        "created_at": datetime.utcnow()
                    }
                    
                    # Safely handle _id
                    # Only use provided _id if it is a VALID ObjectId string
                    if '_id' in course and course['_id']:
                        oid_str = None
                        if isinstance(course['_id'], dict) and '$oid' in course['_id']:
                            oid_str = course['_id']['$oid']
                        elif isinstance(course['_id'], str):
                            oid_str = course['_id']
                            
                        # Validate ObjectId format (24 hex chars)
                        if oid_str and ObjectId.is_valid(oid_str):
                            course_doc['_id'] = ObjectId(oid_str)
                        else:
                            # Drop invalid IDs (like timestamps from frontend) -> Mongo will generate new ones
                            pass

                    courses_to_insert.append(course_doc)
                
                # 3. Database Operations (Atomic-ish)
                if len(courses_to_insert) > 0:
                    # Delete existing courses only if we have new valid data to insert
                    manual_courses_collection.delete_many({'owner_email': user_email})
                    manual_courses_collection.insert_many(courses_to_insert)
                elif len(data) == 0:
                    # If empty list sent, clear courses (Backup still saved above)
                    manual_courses_collection.delete_many({'owner_email': user_email})
                
                return jsonify({"success": True})
            else:
                # Mobile version: Add single course
                if not data.get('title'): 
                    return jsonify({"error": "Title required"}), 400
                
                new_course = {
                    "owner_email": user_email,
                    "title": data.get('title'),
                    "platform": data.get('platform', 'custom'),
                    "url": data.get('url', ''),
                    "progress": data.get('progress', 0),
                    "instructor": data.get('instructor', ''),
                    "targetCompletionDate": data.get('targetCompletionDate', ''),
                    "enrolledDate": data.get('enrolledDate', datetime.now().strftime("%Y-%m-%d")),
                    "notes": data.get('notes', ''),
                    "created_at": datetime.utcnow()
                }
                result = manual_courses_collection.insert_one(new_course)
                new_course['_id'] = result.inserted_id
                return Response(json_util.dumps(new_course), mimetype='application/json')
        except Exception as e:
            print(f"ERROR in POST /courses/manual: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

@api_bp.route('/courses/manual/<id>', methods=['PUT', 'DELETE'])
def manage_manual_course(id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    # Critical: Check if database is available
    if db is None:
        print("❌ ERROR: Database is not available in manage_manual_course")
        return jsonify({"error": "Database connection unavailable. Please check MONGO_URI environment variable."}), 500
    
    manual_courses_collection = db.get_collection('manual_courses')
    
    if request.method == 'DELETE':
        manual_courses_collection.delete_one({'_id': ObjectId(id), 'owner_email': session['user']['email']})
        create_system_log(session['user']['email'], "Course Deleted", f"Deleted manual course {id}")
        return jsonify({"success": True})

    if request.method == 'PUT':
        data = request.json
        # Allow all fields from web frontend
        allowed_fields = ['title', 'platform', 'url', 'progress', 'instructor', 'targetCompletionDate', 'notes', 'certificateUrl']
        update_fields = {k: v for k, v in data.items() if k in allowed_fields}
        
        manual_courses_collection.update_one(
            {'_id': ObjectId(id), 'owner_email': session['user']['email']},
            {'$set': update_fields}
        )
        create_system_log(session['user']['email'], "Course Updated", f"Updated manual course {id}")
        return jsonify({"success": True})

# Assignments uses 'subjects' collection via update_assignments/update_practicals (see above)

# 3. Timetable Structure (Periods)



@api_bp.route('/batch_update_subjects', methods=['POST'])
def batch_update_subjects():
    """Batch update attendance counts for multiple subjects at once."""
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    updates = data.get('updates', [])  # List of {subject_id, attended, total}
    user_email = session['user']['email']
    
    if not updates:
        return jsonify({"error": "No updates provided"}), 400
    
    updated_count = 0
    errors = []
    
    for update in updates:
        try:
            subject_id = ObjectId(update.get('subject_id'))
            attended = int(update.get('attended', 0))
            total = int(update.get('total', 0))
            
            if attended > total:
                errors.append(f"Subject {update.get('subject_id')}: attended cannot exceed total")
                continue
                
            result = subjects_collection.update_one(
                {'_id': subject_id, 'owner_email': user_email},
                {'$set': {'attended': attended, 'total': total}}
            )
            
            if result.matched_count > 0:
                updated_count += 1
        except Exception as e:
            errors.append(f"Subject {update.get('subject_id')}: {str(e)}")
    
    log_user_action(user_email, "Batch Update", f"Updated {updated_count} subjects in bulk.")
    
    return jsonify({
        "success": True,
        "updated_count": updated_count,
        "errors": errors if errors else None
    })

@api_bp.route('/pending_leaves')
def get_pending_leaves():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    pipeline = [
        {'$match': {'owner_email': session['user']['email'], 'status': 'pending_medical'}},
        {'$lookup': {'from': 'subjects', 'localField': 'subject_id', 'foreignField': '_id', 'as': 'subject_info'}},
        {'$unwind': '$subject_info'}
    ]
    leaves = list(attendance_log_collection.aggregate(pipeline))
    return Response(json_util.dumps(leaves), mimetype='application/json')

@api_bp.route('/approve_leave/<log_id>', methods=['POST'])
def approve_leave(log_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    log_oid = ObjectId(log_id)
    log = attendance_log_collection.find_one({'_id': log_oid})
    if not log: return jsonify({"error": "Log not found"}), 404
    
    result = attendance_log_collection.update_one(
        {'_id': log_oid, 'status': 'pending_medical'},
        {'$set': {'status': 'approved_medical'}}
    )
    if result.modified_count > 0:
        subjects_collection.update_one(
            {'_id': log['subject_id']},
            {'$inc': {'attended': 1}}
        )
        log_user_action(session['user']['email'], "Leave Approved", f"A medical leave for subject ID {log['subject_id']} was approved.")
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Leave could not be approved or was already approved."}), 400

# Removed duplicate handle_preferences




@api_bp.route('/import_data', methods=['POST'])
def import_data():
    """Import user data from exported JSON with comprehensive support for all data types."""
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    data = request.json
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    counts = {}
    errors = []
    
    try:
        # Import subjects
        if 'subjects' in data and data['subjects']:
            subject_count = 0
            for subject in data['subjects']:
                try:
                    subject['owner_email'] = user_email  # Ensure ownership
                    subjects_collection.update_one(
                        {'owner_email': user_email, 'name': subject.get('name'), 'semester': subject.get('semester')},
                        {'$set': subject},
                        upsert=True
                    )
                    subject_count += 1
                except Exception as e:
                    errors.append(f"Subject '{subject.get('name', 'unknown')}': {str(e)}")
            counts['subjects'] = subject_count
        
        # Import attendance logs
        # Note: Attendance logs will be skipped as they reference subject_ids from the old account
        # This is intentional - importing logs without proper subject mapping would create broken references
        # Users should use the export primarily for subjects and semester results
        if 'attendance_logs' in data and data['attendance_logs']:
            log_count = 0
            # We skip attendance logs as they contain subject_id references that won't exist in the new account
            # To properly import logs, subjects must be imported first and IDs would need to be remapped
            # For now, we skip this to avoid data corruption
            counts['attendance_logs'] = 0  # Indicate logs were skipped
            errors.append("Attendance logs skipped: subject_id references cannot be mapped to new account")
        
        # Import schedule, timetable periods, and preferences
        timetable_update = {}
        if 'schedule' in data and data['schedule']:
            timetable_update['schedule'] = data['schedule']
        if 'timetable_periods' in data and data['timetable_periods']:
            timetable_update['periods'] = data['timetable_periods']
        if 'preferences' in data and data['preferences']:
            timetable_update['preferences'] = data['preferences']
        
        if timetable_update:
            timetable_collection.update_one(
                {'owner_email': user_email},
                {'$set': timetable_update},
                upsert=True
            )
            counts['timetable'] = 1
        
        # Import semester results
        if 'semester_results' in data and data['semester_results']:
            result_count = 0
            for result in data['semester_results']:
                try:
                    result['owner_email'] = user_email
                    semester_results_collection.update_one(
                        {'owner_email': user_email, 'semester': result.get('semester')},
                        {'$set': result},
                        upsert=True
                    )
                    result_count += 1
                except Exception as e:
                    errors.append(f"Semester result {result.get('semester', 'unknown')}: {str(e)}")
            counts['semester_results'] = result_count

        
        # Import academic records
        if 'academic_records' in data and data['academic_records']:
            record_count = 0
            for record in data['academic_records']:
                try:
                    record['owner_email'] = user_email
                    academic_records_collection.update_one(
                        {'owner_email': user_email, 'semester': record.get('semester')},
                        {'$set': record},
                        upsert=True
                    )
                    record_count += 1
                except Exception as e:
                    errors.append(f"Academic record: {str(e)}")
            counts['academic_records'] = record_count
        
        # Import holidays
        if 'holidays' in data and data['holidays']:
            holiday_count = 0
            for holiday in data['holidays']:
                try:
                    holiday['owner_email'] = user_email
                    holidays_collection.update_one(
                        {'owner_email': user_email, 'date': holiday.get('date')},
                        {'$set': holiday},
                        upsert=True
                    )
                    holiday_count += 1
                except Exception as e:
                    errors.append(f"Holiday: {str(e)}")
            counts['holidays'] = holiday_count
        
        # Import deadlines (insert as new to avoid duplicates)
        if 'deadlines' in data and data['deadlines']:
            deadline_count = 0
            for deadline in data['deadlines']:
                try:
                    deadline['owner_email'] = user_email
                    deadline.pop('_id', None)  # Remove _id if present
                    deadlines_collection.insert_one(deadline)
                    deadline_count += 1
                except Exception as e:
                    errors.append(f"Deadline: {str(e)}")
            counts['deadlines'] = deadline_count
        
        # Import manual courses
        if 'manual_courses' in data and data['manual_courses']:
            try:
                manual_courses_collection.update_one(
                    {'owner_email': user_email},
                    {'$set': {'courses': data['manual_courses'], 'updated_at': datetime.utcnow()}},
                    upsert=True
                )
                counts['manual_courses'] = len(data['manual_courses'])
            except Exception as e:
                errors.append(f"Manual courses: {str(e)}")
        
        # Import skills
        if 'skills' in data and data['skills']:
            skill_count = 0
            for skill in data['skills']:
                try:
                    skill['owner_email'] = user_email
                    skill.pop('_id', None)  # Remove _id if present
                    # Upsert by name to avoid duplicates
                    skills_collection.update_one(
                        {'owner_email': user_email, 'name': skill.get('name')},
                        {'$set': skill},
                        upsert=True
                    )
                    skill_count += 1
                except Exception as e:
                    errors.append(f"Skill: {str(e)}")
            counts['skills'] = skill_count
        
        # Update user profile if included
        if 'user_profile' in data and data['user_profile']:
            try:
                profile_update = {k: v for k, v in data['user_profile'].items() if v is not None and v != ''}
                if profile_update:
                    users_collection.update_one(
                        {'email': user_email},
                        {'$set': profile_update}
                    )
                    counts['user_profile'] = 1
            except Exception as e:
                errors.append(f"User profile: {str(e)}")
        
        # Log the import action
        log_user_action(user_email, "Data Imported", f"Successfully imported: {counts}")
        
        return jsonify({
            "success": True,
            "message": f"Data imported successfully",
            "counts": counts,
            "errors": errors if errors else None
        })
        
    except Exception as e:
        print(f"Import error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"Import failed: {str(e)}"
        }), 500


# 4. Skills Persistence
# Removed duplicate handle_skills

# Removed duplicate handle_skill_item


@api_bp.route('/add_subject', methods=['POST'])
def add_subject():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    subject_name, semester = data.get('subject_name'), int(data.get('semester'))
    if not subject_name or not semester: return jsonify({"error": "Subject name and semester are required"}), 400
    
    # Check for duplicates
    existing_subject = subjects_collection.find_one({
        "owner_email": session['user']['email'],
        "name": subject_name,
        "semester": semester
    })
    
    if existing_subject:
        return jsonify({"success": True, "message": "Subject already exists", "id": str(existing_subject['_id'])})


    cats = data.get('categories', ['Theory'])
    is_theory = 'Theory' in cats
    is_practical = 'Practical' in cats
    
    # Helper to determine type
    subj_type = 'theory'
    if is_theory and is_practical: subj_type = 'both'
    elif is_practical: subj_type = 'practical'

    new_subject = {
        "name": subject_name,
        "owner_email": session['user']['email'],
        "semester": semester,
        "attended": 0,
        "total": 0,
        "created_at": datetime.utcnow(),
        "categories": cats,
        "type": subj_type, # Derived type for Results logic
        "code": data.get('code', ''),
        "professor": data.get('professor', ''),
        "classroom": data.get('classroom', ''),
        "practicals": { "total": int(data.get('practical_total', 10)), "completed": 0, "hardcopy": False } if 'Practical' in cats else None,
        "assignments": { "total": int(data.get('assignment_total', 4)), "completed": 0, "hardcopy": False } if 'Assignment' in cats else None,
    }
    
    subjects_collection.insert_one(new_subject)
    
    log_user_action(session['user']['email'], "Subject Added", f"Added '{subject_name}' to Semester {semester}")
    return jsonify({"success": True, "message": "Subject added successfully"})

@api_bp.route('/delete_subject/<subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    try:
        obj_id = ObjectId(subject_id)
        # Get subject name for logging
        subject = subjects_collection.find_one({'_id': obj_id, 'owner_email': session['user']['email']})
        if not subject:
            return jsonify({"error": "Subject not found"}), 404
        
        # Delete all attendance logs for this subject
        attendance_log_collection.delete_many({'subject_id': obj_id})
        
        # Delete the subject
        subjects_collection.delete_one({'_id': obj_id, 'owner_email': session['user']['email']})
        
        log_user_action(session['user']['email'], "Subject Deleted", f"Deleted '{subject.get('name')}'")
        return jsonify({"success": True, "message": "Subject and its attendance logs deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500




@api_bp.route('/update_subject_details', methods=['POST'])
def update_subject_details():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    subject_id = ObjectId(data.get('subject_id'))
    details = {
        'professor': data.get('professor'),
        'classroom': data.get('classroom'),
        'category': data.get('category'),
        'code': data.get('code')
    }
    # Remove None values to avoid overwriting with null if only partial update
    details = {k: v for k, v in details.items() if v is not None}
    
    subjects_collection.update_one(
        {'_id': subject_id, 'owner_email': session['user']['email']},
        {'$set': details}
    )
    create_system_log(session['user']['email'], "Subject Updated", f"Updated details for subject ID {subject_id}.")
    return jsonify({"success": True})


@api_bp.route('/update_attendance_count', methods=['POST'])
def update_attendance_count():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    subject_id, attended, total = ObjectId(data.get('subject_id')), int(data.get('attended')), int(data.get('total'))
    if attended > total: return jsonify({"success": False, "error": "Attended cannot be more than total."}), 400
    
    subjects_collection.update_one(
        {'_id': subject_id, 'owner_email': session['user']['email']},
        {'$set': {'attended': attended, 'total': total}}
    )
    
    subject = subjects_collection.find_one({'_id': subject_id})
    log_user_action(session['user']['email'], "Data Overridden", f"Manually set attendance for '{subject.get('name')}' to {attended}/{total}.")
    return jsonify({"success": True})

def normalize_time(time_str):
    """
    Normalizes time strings to 'hh:mm AM/PM' format (e.g., '09:00 AM').
    Handles '9:00 am', '9:00', '09:00', '14:00'.
    Returns None if invalid.
    """
    if not time_str: return None
    time_str = time_str.strip().upper()
    try:
        # Expect "09:00 AM" or "9:00 AM"
        dt = datetime.strptime(time_str, '%I:%M %p')
        return dt.strftime('%I:%M %p')
    except Exception as e:
        # print(f"DEBUG: normalize_time failed 1: {e}")
        pass
        
    try:
        # Fallback for 24h "14:00" -> "02:00 PM"
        dt = datetime.strptime(time_str, '%H:%M')
        return dt.strftime('%I:%M %p')
    except Exception as e:
        # print(f"DEBUG: normalize_time failed 2: {e}")
        return None # Return None if invalid format


@api_bp.route('/timetable', methods=['GET', 'POST'])
def handle_timetable():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    
    # Get semester (default to 1)
    try:
        semester = int(request.args.get('semester', 1))
    except (ValueError, TypeError):
        semester = 1
        
    if request.method == 'POST':
        data = request.json.get('schedule', {})
        # Update or create document for specific semester
        # Note: This replaces the entire schedule for that semester
        timetable_collection.update_one(
            {'owner_email': user_email, 'semester': semester}, 
            {'$set': {'schedule': data, 'semester': semester}}, 
            upsert=True
        )
        from api import socketio
        socketio.emit('timetable_updated', {'email': user_email, 'semester': semester}, room=user_email)
        
        log_user_action(user_email, "Schedule Updated", f"User saved changes to the class schedule for Semester {semester}.")
        return jsonify({"success": True})
        
    # GET Logic with Migration
    timetable_doc = timetable_collection.find_one({'owner_email': user_email, 'semester': semester})
    
    # Migration: If looking for Sem 1 and not found, check if legacy (non-semester) doc exists
    if not timetable_doc and semester == 1:
        legacy_doc = timetable_collection.find_one({'owner_email': user_email, 'semester': {'$exists': False}})
        if legacy_doc:
            print(f"⚠️ Migrating legacy timetable for {user_email} to Semester 1")
            timetable_collection.update_one(
                {'_id': legacy_doc['_id']},
                {'$set': {'semester': 1}}
            )
            timetable_doc = legacy_doc
            
    schedule = timetable_doc.get('schedule', {}) if timetable_doc else {}
    periods = timetable_doc.get('periods', []) if timetable_doc else []
    
    # Auto-fix bad data (e.g. "--:-- --" placeholders) on read
    for p in periods:
        start = normalize_time(p.get('startTime'))
        end = normalize_time(p.get('endTime'))
        p['startTime'] = start if start else '09:00 AM'
        p['endTime'] = end if end else '10:00 AM'
    
    print(f"📅 GET /timetable for {user_email} (Sem {semester}):")
    print(f"   Document exists: {timetable_doc is not None}")
    
    # Helper to convert ObjectIds to strings recursively
    def serialize_schedule(obj):
        if isinstance(obj, dict):
            return {k: serialize_schedule(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [serialize_schedule(item) for item in obj]
        elif isinstance(obj, ObjectId):
            return str(obj)
        else:
            return obj
    
    serialized_schedule = serialize_schedule(schedule)
    return jsonify({
        "schedule": serialized_schedule,
        "periods": periods
    })

@api_bp.route('/timetable/structure', methods=['POST'])
def save_timetable_structure():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    periods = request.json
    
    # Check if this is a bulk structure save which might include semester in args or legacy
    # The frontend usually sends just the array of periods. 
    # We should support 'semester' query param like GET /timetable
    try:
        semester = int(request.args.get('semester', 1))
    except (ValueError, TypeError):
        semester = 1

    # Normalize periods and Polyfill missing fields (Sync Fix)
    if isinstance(periods, list):
        for idx, p in enumerate(periods):
            # Time Normalization
            start = normalize_time(p.get('startTime'))
            end = normalize_time(p.get('endTime'))
            
            p['startTime'] = start if start else '09:00 AM'
            p['endTime'] = end if end else '10:00 AM'
            
            # Polyfill ID if missing (Essential for Web App key)
            if not p.get('id'):
                p['id'] = f"p-{int(time()*1000)}-{idx}"
            
            # Polyfill Name if missing (Essential for Web App label)
            if not p.get('name'):
                 p['name'] = str(idx + 1)
                 
            # Polyfill Type and Normalize
            raw_type = p.get('type', 'class')
            p['type'] = raw_type.lower() if raw_type else 'class'

    timetable_collection.update_one(
        {'owner_email': user_email, 'semester': semester},
        {'$set': {'periods': periods, 'semester': semester}}, # Ensure semester is set if upserting
        upsert=True
    )
    from api import socketio
    socketio.emit('timetable_updated', {'email': user_email, 'semester': semester}, room=user_email)
    
    return jsonify({"success": True})


# --- Timetable CRUD ---

@api_bp.route('/timetable/slot', methods=['POST'])
def add_timetable_slot():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    data = request.json
    
    day = data.get('day')
    if not day: return jsonify({"error": "Day is required"}), 400
    
    semester = data.get('semester', 1) # Expect semester in payload
    
    # Ensure _id for the slot
    data['_id'] = str(ObjectId())
    
    # Handle varying key formats (camelCase from frontend, snake_case in backend)
    raw_start = data.get('start_time') or data.get('startTime')
    raw_end = data.get('end_time') or data.get('endTime')
    
    start_time = normalize_time(raw_start)
    end_time = normalize_time(raw_end)
    
    if not start_time or not end_time:
         return jsonify({"error": "Invalid time format"}), 400
    
    # Standardize log data for DB
    slot_data = {k: v for k, v in data.items() if k not in ['semester', 'startTime', 'endTime']}
    slot_data['start_time'] = start_time
    slot_data['end_time'] = end_time
    
    print(f"➕ Adding timetable slot for {user_email} (Sem {semester}):")
    print(f"   Day: {day} | Time: {start_time} - {end_time}")
    
    # Remove any existing slot at the same time to prevent duplicates (Auto-replace)
    timetable_collection.update_one(
        {'owner_email': user_email, 'semester': semester},
        {'$pull': {f'schedule.{day}': {'start_time': start_time}}}
    )

    # Push to specific day array within the schedule object
    result = timetable_collection.update_one(
        {'owner_email': user_email, 'semester': semester},
        {'$push': {f'schedule.{day}': slot_data}},
        upsert=True
    )
    
    from api import socketio
    socketio.emit('timetable_updated', {'email': user_email, 'semester': semester}, room=user_email)
    
    return jsonify({"success": True, "slot": slot_data})

@api_bp.route('/timetable/slot/<slot_id>', methods=['PUT'])
def update_timetable_slot(slot_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    data = request.json
    
    day = data.get('day')
    if not day: return jsonify({"error": "Day is required"}), 400
    
    semester = data.get('semester', 1)
    
    # Pull existing with this ID from ANY day in THIS semester
    timetable = timetable_collection.find_one({'owner_email': user_email, 'semester': semester})
    if not timetable and semester == 1:
         # Fallback check for legacy during transition logic, though mainly handled in GET
         # If we are Updating, we likely already loaded the GET which did migration.
         pass

    schedule = timetable.get('schedule', {}) if timetable else {}
    
    # Find which day currently holds this slot
    old_day = None
    for d, slots in schedule.items():
        if isinstance(slots, list):
            for s in slots:
                if s.get('_id') == slot_id:
                    old_day = d
                    break
        if old_day: break
    
    if old_day:
        timetable_collection.update_one(
            {'owner_email': user_email, 'semester': semester},
            {'$pull': {f'schedule.{old_day}': {'_id': slot_id}}}
        )
    
    # Push new data to new day
    data['_id'] = slot_id # Ensure ID is preserved
    slot_data = {k: v for k, v in data.items() if k != 'semester'}
    
    timetable_collection.update_one(
        {'owner_email': user_email, 'semester': semester},
        {'$set': {'semester': semester}}, # Ensure doc exists
        upsert=True
    )
    timetable_collection.update_one(
         {'owner_email': user_email, 'semester': semester},
         {'$push': {f'schedule.{day}': slot_data}}
    )
    
    from api import socketio
    socketio.emit('timetable_updated', {'email': user_email, 'semester': semester}, room=user_email)
    
    return jsonify({"success": True})

@api_bp.route('/timetable/slot/<slot_id>', methods=['DELETE'])
def delete_timetable_slot(slot_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    
    # Get semester from query param
    try:
        semester = int(request.args.get('semester', 1))
    except:
        semester = 1
        
    # Remove from any day where it exists in that semester
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    for day in days:
        timetable_collection.update_one(
            {'owner_email': user_email, 'semester': semester},
            {'$pull': {f'schedule.{day}': {'_id': slot_id}}}
        )
    
    from api import socketio
    socketio.emit('timetable_updated', {'email': user_email, 'semester': semester}, room=user_email)
    
    return jsonify({"success": True})

@api_bp.route('/subjects')
def get_subjects():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    semester = int(request.args.get('semester', 1))
    query = {"owner_email": session['user']['email'], "semester": semester}
    
    # Fetch all fields (remove projection)
    subjects = list(subjects_collection.find(query))
    
    # Transform to match frontend expectations
    enriched_subjects = []
    for s in subjects:
        total = s.get('total', 0)
        attended = s.get('attended', 0)
        pct = calculate_percent(attended, total)
        
        enriched_subjects.append({
            "_id": str(s['_id']),
            "name": s.get('name'),
            "code": s.get('code', ''),
            "professor": s.get('professor', ''),
            "classroom": s.get('classroom', ''),
            "attended_classes": attended,
            "total_classes": total,
            "attendance_percentage": pct,
            "semester": s.get('semester'),
            "type": s.get('type', 'theory'),
            "categories": s.get('categories', ['Theory']),
            "practicals": s.get('practicals'),
            "assignments": s.get('assignments')
        })
        
    return jsonify(enriched_subjects)

@api_bp.route('/subject_details/<subject_id>')
def get_subject_details(subject_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    subject = subjects_collection.find_one({'_id': ObjectId(subject_id), 'owner_email': session['user']['email']})
    if not subject: return jsonify({"error": "Subject not found"}), 404
    return Response(json_util.dumps(subject), mimetype='application/json')

@api_bp.route('/export_data')
def export_data():
    """Export all user data for complete backup."""
    if 'user' not in session: return "Unauthorized", 401
    user_email = session['user']['email']
    
    # Get user profile
    user_doc = users_collection.find_one({'email': user_email}, {'_id': 0, 'password': 0, 'google_token': 0})
    
    # Get timetable document (contains schedule, periods, and preferences)
    timetable_doc = timetable_collection.find_one({'owner_email': user_email}, {'_id': 0})
    
    # Get manual courses document
    manual_courses_doc = manual_courses_collection.find_one({'owner_email': user_email}, {'_id': 0})
    
    data_to_export = {
        "version": "1.0",
        "exported_at": datetime.utcnow().isoformat(),
        "user_email": user_email,
        
        # Core attendance data
        "subjects": list(subjects_collection.find({"owner_email": user_email}, {'_id': 0})),
        "attendance_logs": list(attendance_log_collection.find({"owner_email": user_email}, {'_id': 0})),
        
        # Timetable
        "schedule": timetable_doc.get('schedule') if timetable_doc else {},
        "timetable_periods": timetable_doc.get('periods') if timetable_doc else [],
        
        # Preferences & Settings
        "preferences": timetable_doc.get('preferences') if timetable_doc else {},
        
        # Academic records
        "semester_results": list(semester_results_collection.find({"owner_email": user_email}, {'_id': 0})),
        "academic_records": list(academic_records_collection.find({"owner_email": user_email}, {'_id': 0})),
        
        # Other data
        "holidays": list(holidays_collection.find({"owner_email": user_email}, {'_id': 0})),
        "deadlines": list(deadlines_collection.find({"owner_email": user_email}, {'_id': 0})),
        
        # Manual courses
        "manual_courses": manual_courses_doc.get('courses', []) if manual_courses_doc else [],
        
        # Skills (portfolio/resume data)
        "skills": list(skills_collection.find({"owner_email": user_email}, {'_id': 0})),
        
        # User profile
        "user_profile": {
            "name": user_doc.get('name', '') if user_doc else '',
            "branch": user_doc.get('branch', '') if user_doc else '',
            "college": user_doc.get('college', '') if user_doc else '',
            "semester": user_doc.get('semester', 1) if user_doc else 1,
            "batch": user_doc.get('batch', '') if user_doc else '',
            "picture": user_doc.get('picture', '') if user_doc else ''
        }
    }
    
    return Response(
        json_util.dumps(data_to_export, indent=4), 
        mimetype="application/json", 
        headers={"Content-Disposition": "attachment;filename=zenith_data.json"}
    )

@api_bp.route('/deadlines', methods=['GET'])
def get_deadlines():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    # Return all deadlines, sort by 'completed' (pending first) then 'due_date'
    deadlines = list(deadlines_collection.find({'owner_email': session['user']['email']}).sort([('completed', 1), ('due_date', 1)]))
    return Response(json_util.dumps(deadlines), mimetype='application/json')

@api_bp.route('/add_deadline', methods=['POST'])
def add_deadline():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    if not data.get('title'): return jsonify({"error": "Title required"}), 400
    deadlines_collection.insert_one({'owner_email': session['user']['email'], 'title': data.get('title'), 'due_date': data.get('due_date'), 'completed': False, 'created_at': datetime.utcnow()})
    return jsonify({"success": True})

@api_bp.route('/toggle_deadline/<deadline_id>', methods=['POST'])
def toggle_deadline(deadline_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    deadline = deadlines_collection.find_one({'_id': ObjectId(deadline_id), 'owner_email': session['user']['email']})
    if not deadline: return jsonify({"error": "Deadline not found"}), 404
    
    new_status = not deadline.get('completed', False)
    deadlines_collection.update_one({'_id': ObjectId(deadline_id)}, {'$set': {'completed': new_status}})
    return jsonify({"success": True})

@api_bp.route('/deadlines/<deadline_id>', methods=['DELETE'])
def delete_deadline(deadline_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    result = deadlines_collection.delete_one({'_id': ObjectId(deadline_id), 'owner_email': session['user']['email']})
    if result.deleted_count == 0: return jsonify({"error": "Deadline not found"}), 404
    
    log_user_action(session['user']['email'], 'delete_deadline', f"Deleted deadline {deadline_id}")
    return jsonify({"success": True})

@api_bp.route('/deadlines/<deadline_id>', methods=['PUT'])
def update_deadline(deadline_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    update_fields = {}
    if 'title' in data: update_fields['title'] = data['title']
    if 'due_date' in data: update_fields['due_date'] = data['due_date']
    
    if not update_fields:
        return jsonify({"error": "No fields to update"}), 400
    
    result = deadlines_collection.update_one(
        {'_id': ObjectId(deadline_id), 'owner_email': session['user']['email']},
        {'$set': update_fields}
    )
    if result.matched_count == 0: return jsonify({"error": "Deadline not found"}), 404
    
    log_user_action(session['user']['email'], 'update_deadline', f"Updated deadline {deadline_id}")
    return jsonify({"success": True})

# Helper for percentage
# --- NOTIFICATIONS ---
@api_bp.route('/notifications')
def get_notifications():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    user_email = session['user']['email']
    user_data = session['user']
    notifications = []
    
    try:
        # 1. Attendance Alerts (<75%)
        subjects = list(subjects_collection.find({'owner_email': user_email}))
        threshold = 75 
        try:
             prefs = db.get_collection('user_preferences').find_one({'owner_email': user_email})
             if prefs and 'preferences' in prefs:
                  threshold = int(prefs['preferences'].get('min_attendance', 75))
        except: pass
        
        for subject in subjects:
            percentage = calculate_percent(subject.get('attended', 0), subject.get('total', 0))
            if percentage < threshold and subject.get('total', 0) > 0:
                 notifications.append({
                    "id": f"att_{subject['_id']}",
                    "title": "Attendance Alert 💡",
                    "message": f"{subject['name']}: {percentage}% (Below {threshold}%)",
                    "type": "attendance",
                    "timestamp": datetime.utcnow().isoformat(),
                    "read": False
                })

        # 2. Google Classroom Integration (Read from Cache)
        google_token = user_data.get('google_token')
        if google_token:
            try:
                # Read from MongoDB cache populated by background worker
                cache_collection = db.get_collection('cache')
                cached_notifications = cache_collection.find_one({"key": f"notifications_{user_email}"})
                
                if cached_notifications and datetime.utcnow() < cached_notifications.get('expires_at', datetime.utcnow()):
                    # Cache is valid
                    classroom_items = cached_notifications.get('data', {}).get('items', [])
                    for item in classroom_items[:10]:  # Limit to 10 items
                        notifications.append({
                            "id": item.get('id', str(hash(item.get('title', '')))),
                            "title": f"{'📢' if item.get('type') == 'announcement' else '📝'} {item.get('courseName', 'Classroom')}",
                            "message": item.get('text' if item.get('type') == 'announcement' else 'title', 'New Update')[:100],
                            "type": "classroom",
                            "timestamp": item.get('creationTime') or item.get('updateTime', datetime.utcnow().isoformat()),
                            "link": item.get('alternateLink'),
                            "read": False
                        })
            except Exception as e:
                print(f"⚠️ Error reading classroom cache: {e}")
                # Silently continue without classroom notifications

        # 3. University Notices (IPU)
        notices_col = db.get_collection('notices')
        today_notices = notices_col.find_one({"date_fetched": datetime.now().strftime("%Y-%m-%d")})
        university_notices = []
        if today_notices:
             university_notices = today_notices.get('data', [])
        else:
             latest = notices_col.find_one(sort=[('date_fetched', -1)])
             if latest: university_notices = latest.get('data', [])
        
        for notice in university_notices[:8]:
            notifications.append({
                "id": str(notice.get('title', hash(notice.get('link', '')))),
                "title": "University Notice",
                "message": notice.get('title', 'Notice'),
                "type": "university",
                "timestamp": datetime.utcnow().isoformat(), # Notices often don't have exact time, just date
                "link": notice.get('link'),
                "read": False
            })
            
        # 4. System Logs (Recent important ones)
        logs = list(system_logs_collection.find({'owner_email': user_email}).sort('timestamp', -1).limit(3))
        for log in logs:
            notifications.append({
                "id": str(log['_id']),
                "title": log.get('action', 'System Alert'),
                "message": log.get('description', ''),
                "type": "system",
                "timestamp": log.get('timestamp').isoformat() if isinstance(log.get('timestamp'), datetime) else datetime.utcnow().isoformat(),
                "read": True
            })

        # Sort by timestamp desc
        notifications.sort(key=lambda x: str(x.get('timestamp', '')), reverse=True)
        
        return jsonify(notifications[:30]) # Return top 30
        
    except Exception as e:
        print(f"Error fetching notifications: {e}")
        traceback.print_exc()
        return jsonify({"error": "Failed to fetch notifications"}), 500

# --- CALENDAR & LOGS ---

# Consolidated into the /api/todays_classes route at line ~756
@api_bp.route('/todays_classes_deprecated') 
def todays_classes_old():
    return jsonify({"error": "Use /api/todays_classes"}), 404

@api_bp.route('/calendar_data')
def calendar_data():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    try:
        user_email = session['user']['email']
        month = int(request.args.get('month'))
        year = int(request.args.get('year'))
        start_date = datetime(year, month, 1)
        end_date = datetime(year, month, calendar.monthrange(year, month)[1], 23, 59, 59)
        
        query = {
            'owner_email': user_email, 
            'timestamp': {'$gte': start_date, '$lte': end_date}
        }
        
        semester = request.args.get('semester')
        if semester:
            query['semester'] = int(semester)
            
        logs = list(attendance_log_collection.find(query))
        
        date_data = {}
        for log in logs:
            date_str = log['date']
            if date_str not in date_data:
                date_data[date_str] = []
            date_data[date_str].append({
                'status': log['status'],
                'subject_id': str(log['subject_id']),
                'log_id': str(log['_id'])
            })
            
        return jsonify(date_data)
    except Exception as e:
        print(f"---! ERROR IN /api/calendar_data: {e} !---")
        traceback.print_exc()
        return jsonify({"error": "Could not fetch calendar data."}), 500

@api_bp.route('/integrations/calendar')
def get_calendar_events():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    # We need to use the google_token from the session
    token = session['user'].get('google_token')
    if not token:
        return jsonify({"error": "No Google token found"}), 401
        
    try:
        # Use simple requests for now, or build a service object if complicated
        # Calendar API: list events from primary calendar
        # We need timeMin and timeMax to filter relevant events
        
        # Get query params or default to current month
        now = datetime.utcnow().isoformat() + 'Z'  # 'Z' indicates UTC time
        
        url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
        params = {
            'timeMin': now,
            'maxResults': 50,
            'singleEvents': True,
            'orderBy': 'startTime'
        }
        
        response = requests.get(url, headers={'Authorization': f'Bearer {token}'}, params=params)
        
        if response.status_code == 401:
            return jsonify({"error": "Token expired or invalid"}), 401
            
        return jsonify(response.json().get('items', []))
        
    except Exception as e:
        print(f"Calendar API Error: {e}")
        return jsonify({"error": "Failed to fetch calendar events"}), 500


@api_bp.route('/system_logs')
def get_system_logs():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    try:
        # Get last 50 logs
        logs = list(system_logs_collection.find({'owner_email': session['user']['email']}).sort('timestamp', -1).limit(50))
        return Response(json_util.dumps(logs), mimetype='application/json')
    except Exception as e:
        print(f"Error serving system logs: {e}")
        return jsonify([]), 200 # Return empty list on error to prevent app crash

@api_bp.route('/logs_for_date')
def get_logs_for_date():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    date_str = request.args.get('date')
    if not date_str: return jsonify({"error": "Date parameter is required"}), 400
    
    pipeline = [
        {'$match': {'owner_email': session['user']['email'], 'date': date_str}},
        {'$lookup': {'from': 'subjects', 'localField': 'subject_id', 'foreignField': '_id', 'as': 'subject_info'}},
        {'$unwind': {'path': '$subject_info', 'preserveNullAndEmptyArrays': True}},
        {'$project': {
            '_id': 1, 
            'subject_id': 1,
            'subject_name': {'$ifNull': ['$subject_name', '$subject_info.name']}, 
            'type': 1,
            'status': 1, 
            'notes': 1,
            'timestamp': 1
        }}
    ]
    logs = list(attendance_log_collection.aggregate(pipeline))
    # Convert ObjectIds to strings for JSON
    for log in logs:
        log['_id'] = str(log['_id'])
        if log.get('subject_id'): log['subject_id'] = str(log['subject_id'])
        
    return jsonify(logs)

# --- MANUAL COURSES ---

# Removed duplicate handle_manual_courses

# --- ACADEMIC RECORDS (CGPA) ---

# Removed duplicate handle_semester_results

@api_bp.route('/academic_records', methods=['GET'])
def get_academic_records():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    records = list(academic_records_collection.find({'owner_email': session['user']['email']}).sort('semester', 1))
    return Response(json_util.dumps(records), mimetype='application/json')

@api_bp.route('/update_academic_record', methods=['POST'])
def update_academic_record():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    semester = int(data.get('semester'))
    sgpa = float(data.get('sgpa', 0))
    cgpa = float(data.get('cgpa', 0))
    credits = int(data.get('credits', 0))
    
    academic_records_collection.update_one(
        {'owner_email': session['user']['email'], 'semester': semester},
        {'$set': {'sgpa': sgpa, 'cgpa': cgpa, 'credits': credits, 'timestamp': datetime.utcnow()}},
        upsert=True
    )
    
    log_user_action(session['user']['email'], "Academic Record Updated", f"Updated details for Semester {semester} (SGPA: {sgpa}, CGPA: {cgpa}).")
    return jsonify({"success": True})

@api_bp.route('/dashboard_summary')
def get_dashboard_summary():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    try:
        user_email = session['user']['email']
        current_semester = int(request.args.get('semester', 1))
        query = {"owner_email": user_email, "semester": current_semester}
        semester_subjects = list(subjects_collection.find(query))
        total_attended = sum(s.get('attended', 0) for s in semester_subjects)
        total_classes = sum(s.get('total', 0) for s in semester_subjects)
        
        response_data = {
            "semester_stats": {
                "percentage": calculate_percent(total_attended, total_classes), 
                "attended": total_attended, 
                "total": total_classes
            }
        }
        return Response(json_util.dumps(response_data), mimetype='application/json')
    except Exception as e:
        print(f"---! ERROR IN /api/dashboard_summary: {e} !---")
        traceback.print_exc()
        return jsonify({"error": "Could not process summary data."}), 500

@api_bp.route('/all_semesters_overview')
def all_semesters_overview():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    pipeline = [{'$match': {'owner_email': user_email}}, {'$group': {'_id': '$semester', 'total_attended': {'$sum': '$attended'}, 'total_classes': {'$sum': '$total'}}}, {'$sort': {'_id': 1}}]
    semester_data = list(subjects_collection.aggregate(pipeline))
    
    response_data = [{"semester": sem['_id'], "percentage": calculate_percent(sem['total_attended'], sem['total_classes'])} for sem in semester_data]
    return Response(json_util.dumps(response_data), mimetype='application/json')

@api_bp.route('/analytics/day_of_week')
def analytics_day_of_week():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    try:
        user_email = session['user']['email']
        semester = int(request.args.get('semester', 1))
        scope = request.args.get('scope', 'all') # 'all' or 'current_week'
        
        # Get subject IDs for this semester
        semester_subjects = list(subjects_collection.find(
            {'owner_email': user_email, 'semester': semester},
            {'_id': 1}
        ))
        subject_ids = [s['_id'] for s in semester_subjects]
        
        if not subject_ids:
            # No subjects for this semester, return empty data
            day_map = ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
            analytics = {"days": []}
            for i in [2, 3, 4, 5, 6, 7, 1]:
                analytics['days'].append({
                    "day": day_map[i], "present": 0, "total": 0, "percentage": 0
                })
            return Response(json_util.dumps(analytics), mimetype='application/json')
        
        match_stage = {'owner_email': user_email, 'subject_id': {'$in': subject_ids}}
        
        if scope == 'current_week':
            today = datetime.utcnow()
            start_of_week = today - timedelta(days=today.weekday())
            # Convert to string format YYYY-MM-DD for comparison with 'date' field
            start_str = start_of_week.strftime("%Y-%m-%d")
            end_of_week = start_of_week + timedelta(days=7)
            end_str = end_of_week.strftime("%Y-%m-%d")
            match_stage['date'] = {'$gte': start_str, '$lt': end_str}

        pipeline = [
            {'$match': match_stage},
            # Convert 'date' string (YYYY-MM-DD) to Date Object for dayOfWeek extraction
            {'$project': {
                'dateObj': {
                    '$dateFromString': {'dateString': '$date', 'format': '%Y-%m-%d'}
                },
                'status': '$status'
            }},
            {'$project': {'dayOfWeek': {'$dayOfWeek': '$dateObj'}, 'status': '$status'}},
            {'$group': {'_id': {'dayOfWeek': '$dayOfWeek', 'status': '$status'}, 'count': {'$sum': 1}}},
            {'$group': {'_id': '$_id.dayOfWeek', 'counts': {'$push': {'status': '$_id.status', 'count': '$count'}}}},
            {'$sort': {'_id': 1}}
        ]
        data = list(attendance_log_collection.aggregate(pipeline))
        day_map = ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        day_data = {i: {'present': 0, 'total': 0} for i in range(1, 8)}
        for day in data:
            for status_count in day['counts']:
                if status_count['status'] in ['present', 'approved_medical']:
                    day_data[day['_id']]['present'] += status_count['count']
                if status_count['status'] in ['present', 'absent', 'pending_medical', 'approved_medical']:
                    day_data[day['_id']]['total'] += status_count['count']
        analytics = {"days": []}
        # Order from Monday to Sunday
        # Monday=2 ... Saturday=7, Sunday=1
        day_indices = [2, 3, 4, 5, 6, 7, 1]
        
        for i in day_indices:
            total = day_data.get(i, {}).get('total', 0)
            present = day_data.get(i, {}).get('present', 0)
            percentage = calculate_percent(present, total)
            
            analytics['days'].append({
                "day": day_map[i],
                "present": present,
                "total": total,
                "percentage": percentage
            })
        
        return Response(json_util.dumps(analytics), mimetype='application/json')
    except Exception as e:
        print(f"---! ERROR IN /api/analytics/day_of_week: {e} !---")
        traceback.print_exc()
        return jsonify({"error": "Could not fetch analytics."}), 500
    

@api_bp.route('/mark_substituted', methods=['POST'])
def mark_substituted():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    original_subject_id = ObjectId(data.get('original_subject_id'))
    substitute_subject_id = ObjectId(data.get('substitute_subject_id'))
    date_str = data.get('date')
    user_email = session['user']['email']

    if not date_str:
        return jsonify({"error": "Date is required to resolve a substitution"}), 400

    original_log_update = attendance_log_collection.update_one(
        {"subject_id": original_subject_id, "date": date_str, "owner_email": user_email, "status": "substituted"},
        {'$set': {"status": "substitution_resolved"}}
    )

    if original_log_update.matched_count == 0:
        return jsonify({"error": "Could not find the original substituted log to resolve."}), 404

    substitute_log = attendance_log_collection.find_one(
        {"subject_id": substitute_subject_id, "date": date_str, "owner_email": user_email}
    )
    
    substitute_subject_info = subjects_collection.find_one({'_id': substitute_subject_id})
    sub_name = substitute_subject_info.get('name', 'Unknown')

    if substitute_log:
        if substitute_log['status'] in ['absent', 'pending_medical']:
            subjects_collection.update_one(
                {'_id': substitute_subject_id}, 
                {'$inc': {'attended': 1}}
            )
        
        attendance_log_collection.update_one(
            {'_id': substitute_log['_id']}, 
            {'$set': {'status': 'present'}}
        )
        create_system_log(user_email, "Substitution Resolved", f"Corrected attendance for '{sub_name}' on {date_str}.")

    else:
        attendance_log_collection.insert_one({
            "subject_id": substitute_subject_id,
            "owner_email": user_email,
            "date": date_str,
            "status": "present",
            "timestamp": datetime.utcnow(),
            "semester": substitute_subject_info.get('semester')
        })
        subjects_collection.update_one(
            {'_id': substitute_subject_id},
            {'$inc': {'attended': 1, 'total': 1}}
        )
        create_system_log(user_email, "Substitution Resolved", f"Added present mark for '{sub_name}' on {date_str}.")

    return jsonify({"success": True})

@api_bp.route('/unresolved_substitutions')
def get_unresolved_substitutions():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    pipeline = [
        {'$match': {'owner_email': session['user']['email'], 'status': 'substituted'}},
        {'$lookup': {'from': 'subjects', 'localField': 'subject_id', 'foreignField': '_id', 'as': 'subject_info'}},
        {'$unwind': '$subject_info'},
        {'$sort': {'date': -1}}
    ]
    unresolved_logs = list(attendance_log_collection.aggregate(pipeline))
    return Response(json_util.dumps(unresolved_logs), mimetype='application/json')

@api_bp.route('/holidays', methods=['GET', 'POST'])
def handle_holidays():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    if request.method == 'POST':
        data = request.json
        holidays_collection.insert_one({
            'owner_email': user_email,
            'date': data.get('date'),
            'name': data.get('name')
        })
        create_system_log(user_email, "Holiday Added", f"Added holiday: {data.get('name')} on {data.get('date')}")
        return jsonify({"success": True})
    
    holidays = list(holidays_collection.find({'owner_email': user_email}).sort('date', 1))
    return Response(json_util.dumps(holidays), mimetype='application/json')

@api_bp.route('/holidays/<holiday_id>', methods=['DELETE'])
def delete_holiday(holiday_id):
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    holidays_collection.delete_one({'_id': ObjectId(holiday_id)})
    return jsonify({"success": True})


@api_bp.route('/achievements')
def get_achievements():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    user_email = session['user']['email']
    achievements = []

    # Perfect Streak Achievements
    streak = calculate_streak(user_email)
    if streak >= 7:
        achievements.append({"name": "Perfect Week", "description": "7 consecutive days of perfect attendance."})
    if streak >= 30:
        achievements.append({"name": "On a Roll", "description": "30 consecutive days of perfect attendance."})

    # Comeback Kid Achievement
    subjects = list(subjects_collection.find({'owner_email': user_email}))
    for subject in subjects:
        # This is a simplified check. A real implementation would need to track historical data.
        if calculate_percent(subject.get('attended', 0), subject.get('total', 0)) > 75:
             # A placeholder for a more complex logic
             pass

    return jsonify(achievements)

@api_bp.route('/attendance_history', methods=['GET'])
def get_attendance_history():
    """Get all dates with attendance for a specific month"""
    if 'user' not in session:
        return jsonify({'success': False, 'error': 'Not authenticated'}), 401
    
    user_email = session['user']['userinfo']['email']
    
    # Get year and month from query parameters
    year = request.args.get('year', type=int)
    month = request.args.get('month', type=int)
    
    if not year or not month:
        return jsonify({'success': False, 'error': 'Year and month required'}), 400
    
    # Create start and end dates for the month
    from datetime import datetime
    import calendar
    
    # First day of the month
    start_date = datetime(year, month, 1)
    
    # Last day of the month
    last_day = calendar.monthrange(year, month)[1]
    end_date = datetime(year, month, last_day, 23, 59, 59)
    
    # Query attendance logs for this month
    logs = list(attendance_log_collection.find({
        'owner_email': user_email,
        'timestamp': {
            '$gte': start_date,
            '$lte': end_date
        }
    }))
    
    # Extract unique dates
    dates = set()
    for log in logs:
        date_str = log['timestamp'].strftime('%Y-%m-%d')
        dates.add(date_str)
        
    return jsonify({
        'success': True,
        'dates': list(dates)
    })

# --- BOARD API ---


    


@api_bp.route('/attendance_calendar', methods=['GET'])
def get_attendance_calendar():
    if 'user' not in session:
        return jsonify({'success': False}), 401
    email = session['user']['userinfo']['email']
    year = int(request.args['year'])
    month = int(request.args['month'])

    from datetime import datetime
    import calendar
    start = datetime(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    end = datetime(year, month, last_day, 23, 59, 59)
    # Assumes each log has: timestamp, status ('present'/'absent')
    logs = list(attendance_log_collection.find({
        'owner_email': email,
        'timestamp': {'$gte': start, '$lte': end}
    }))
    # Map dates to an array of statuses
    daily = {}
    for log in logs:
        key = log['timestamp'].strftime('%Y-%m-%d')
        if key not in daily: daily[key] = []
        daily[key].append(log['status'])
    result = {}
    for k, vals in daily.items():
        if all(v == 'present' for v in vals):
            result[k] = 'present'
        elif all(v == 'absent' for v in vals):
            result[k] = 'absent'
        else:
            result[k] = 'mixed'
    return jsonify({'success': True, 'dates': result})


def create_system_log_safe(user_email, action, description):
    five_seconds_ago = datetime.utcnow() - timedelta(seconds=5)
    exists = system_logs_collection.find_one({
        'owner_email': user_email,
        'action': action,
        'description': description,
        'timestamp': {'$gte': five_seconds_ago}
    })
    if not exists:
        system_logs_collection.insert_one({
            'owner_email': user_email,
            'action': action,
            'description': description,
            'timestamp': datetime.utcnow()
        })


# --- User Preferences ---
preferences_collection = db.get_collection('user_preferences')

@api_bp.route('/preferences', methods=['GET'])
def get_preferences():
    """Get user preferences"""
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_email = session['user']['email']
    prefs = preferences_collection.find_one({'owner_email': user_email})
    
    # Default preferences
    default_prefs = {
        'attendance_threshold': 75,
        'warning_threshold': 76,
        'counting_mode': 'percentage',
        'notifications_enabled': False,
        'accent_color': '#6750A4'
    }
    
    if prefs:
        # Merge with defaults (in case new fields are added)
        default_prefs.update(prefs.get('preferences', {}))
        return jsonify(default_prefs)
    
    return jsonify(default_prefs)









@api_bp.route('/notifications/subscribe', methods=['POST'])
def subscribe():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    
    subscription = request.json
    user_email = session['user']['email']
    
    # Store subscription
    users_collection.update_one(
        {'email': user_email},
        {'$set': {'push_subscription': subscription}},
        upsert=True
    )
    return jsonify({"success": True})

@api_bp.route('/notifications/send', methods=['POST'])
def send_notification():
    return jsonify({"success": True, "message": "Notification Logic Placeholder (pywebpush missing)"})


@api_bp.route('/analytics/monthly_trend')
def analytics_monthly_trend():
    if 'user' not in session: return jsonify({"error": "Unauthorized"}), 401
    try:
        user_email = session['user']['email']
        year = int(request.args.get('year', datetime.now().year))
        semester = int(request.args.get('semester', 1))
        
        # Get subject IDs for this semester
        semester_subjects = list(subjects_collection.find(
            {'owner_email': user_email, 'semester': semester},
            {'_id': 1}
        ))
        subject_ids = [s['_id'] for s in semester_subjects]
        
        month_map = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        monthly_data = []
        
        if not subject_ids:
            # No subjects, return empty months
            for i in range(1, 13):
                monthly_data.append({
                    "month": month_map[i], "present": 0, "total": 0, "percentage": 0
                })
            return Response(json_util.dumps({"monthly_trend": monthly_data}), mimetype='application/json')
        
        pipeline = [
            {'$match': {
                'owner_email': user_email,
                'subject_id': {'$in': subject_ids},
                'timestamp': {'$gte': datetime(year, 1, 1), '$lte': datetime(year, 12, 31, 23, 59, 59)}
            }},
            {'$project': {'month': {'$month': '$timestamp'}, 'status': '$status'}},
            {'$group': {'_id': {'month': '$month', 'status': '$status'}, 'count': {'$sum': 1}}},
            {'$group': {'_id': '$_id.month', 'counts': {'$push': {'status': '$_id.status', 'count': '$count'}}}},
            {'$sort': {'_id': 1}}
        ]
        
        data = list(attendance_log_collection.aggregate(pipeline))
        
        # Initialize all months with 0
        data_dict = {d['_id']: d for d in data}
        
        for i in range(1, 13):
            total = 0
            present = 0
            
            if i in data_dict:
                for status_count in data_dict[i]['counts']:
                    if status_count['status'] in ['present', 'approved_medical']:
                        present += status_count['count']
                    if status_count['status'] in ['present', 'absent', 'pending_medical', 'approved_medical']:
                        total += status_count['count']
            
            percentage = calculate_percent(present, total)
            monthly_data.append({
                "month": month_map[i],
                "present": present,
                "total": total,
                "percentage": percentage
            })
            
        return Response(json_util.dumps({"monthly_trend": monthly_data}), mimetype='application/json')
    except Exception as e:
        print(f"---! ERROR IN /api/analytics/monthly_trend: {e} !---")
        traceback.print_exc()
        return jsonify({"error": "Could not fetch monthly analytics."}), 500


# --- SEMESTER RESULTS (IPU Grading) ---

@api_bp.route('/semester_results', methods=['GET'])
def get_semester_results():
    """Get all semester results for the user."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_email = session['user']['email']
    results = list(semester_results_collection.find({'owner_email': user_email}).sort('semester', 1))
    
    # Recalculate CGPA for all results
    if results:
        cgpa = calculate_cgpa(results)
        for result in results:
            result['cgpa'] = cgpa
    
    return Response(json_util.dumps(results), mimetype='application/json')


@api_bp.route('/semester_results/<int:semester>', methods=['GET'])
def get_semester_result(semester):
    """Get a specific semester result."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_email = session['user']['email']
    result = semester_results_collection.find_one({'owner_email': user_email, 'semester': semester})
    
    if not result:
        return jsonify({"error": "Semester result not found"}), 404
    
    # Get all results to calculate CGPA
    all_results = list(semester_results_collection.find({'owner_email': user_email}))
    result['cgpa'] = calculate_cgpa(all_results)
    
    return Response(json_util.dumps(result), mimetype='application/json')


@api_bp.route('/semester_results', methods=['POST'])
def save_semester_result():
    """Save or update a semester result with auto-calculations."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_email = session['user']['email']
    data = request.json
    semester = int(data.get('semester', 0))
    
    if not semester or semester < 1 or semester > 8:
        return jsonify({"error": "Invalid semester (must be 1-8)"}), 400
    
    subjects = data.get('subjects', [])
    if not subjects:
        return jsonify({"error": "At least one subject is required"}), 400
    
    # Calculate results for each subject
    processed_subjects = []
    total_credits = 0
    
    for subject in subjects:
        result = calculate_subject_result(subject)
        processed_subject = {
            'name': subject.get('name', 'Unnamed Subject'),
            'code': subject.get('code', ''),
            'credits': int(subject.get('credits', 0) or 0),
            'type': subject.get('type', 'theory'),
            'internal_theory': subject.get('internal_theory'),
            'external_theory': subject.get('external_theory'),
            'internal_practical': subject.get('internal_practical'),
            'external_practical': subject.get('external_practical'),
            'total_marks': result['total_marks'],
            'max_marks': result['max_marks'],
            'percentage': result['percentage'],
            'grade': result['grade'],
            'grade_point': result['grade_point']
        }
        processed_subjects.append(processed_subject)
        total_credits += processed_subject['credits']
    
    # Calculate SGPA
    sgpa = calculate_sgpa(processed_subjects)
    
    # Create result document
    result_doc = {
        'owner_email': user_email,
        'semester': semester,
        'subjects': processed_subjects,
        'total_credits': total_credits,
        'sgpa': sgpa,
        'timestamp': datetime.utcnow()
    }
    
    # Upsert the result
    semester_results_collection.update_one(
        {'owner_email': user_email, 'semester': semester},
        {'$set': result_doc},
        upsert=True
    )
    
    # Get all results to calculate CGPA
    all_results = list(semester_results_collection.find({'owner_email': user_email}))
    cgpa = calculate_cgpa(all_results)
    result_doc['cgpa'] = cgpa
    
    create_system_log(user_email, "Result Updated", f"Updated semester {semester} result (SGPA: {sgpa}, CGPA: {cgpa})")
    
    return Response(json_util.dumps({"success": True, "result": result_doc}), mimetype='application/json')


@api_bp.route('/semester_results/<int:semester>', methods=['DELETE'])
def delete_semester_result(semester):
    """Delete a semester result."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_email = session['user']['email']
    result = semester_results_collection.delete_one({'owner_email': user_email, 'semester': semester})
    
    if result.deleted_count == 0:
        return jsonify({"error": "Semester result not found"}), 404
    
    create_system_log(user_email, "Result Deleted", f"Deleted semester {semester} result")
    
    return jsonify({"success": True})


# === SKILLS API ROUTES ===

@api_bp.route('/skills', methods=['GET'])
@limiter.limit(RELAXED_LIMIT)
def get_skills():
    """Get all skills for the current user."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_email = session['user']['email']
    skills = list(skills_collection.find({'owner_email': user_email}).sort('created_at', -1))
    
    return Response(json_util.dumps(skills), mimetype='application/json')


@api_bp.route('/skills', methods=['POST'])
@limiter.limit(MODERATE_LIMIT)
def add_skill():
    """Add a new skill."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    user_email = session['user']['email']
    
    skill = {
        'owner_email': user_email,
        'name': data.get('name'),
        'category': data.get('category'),
        'level': data.get('level'),
        'progress': data.get('progress', 0),
        'notes': data.get('notes', ''),
        'created_at': datetime.utcnow(),
        'updated_at': datetime.utcnow()
    }
    
    result = skills_collection.insert_one(skill)
    skill['_id'] = result.inserted_id
    
    create_system_log(user_email, "Skill Added", f"Added skill: {skill['name']}")
    
    return Response(json_util.dumps({'success': True, 'skill': skill}), mimetype='application/json')


@api_bp.route('/skills/<skill_id>', methods=['PUT'])
@limiter.limit(MODERATE_LIMIT)
def update_skill(skill_id):
    """Update an existing skill."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    user_email = session['user']['email']
    
    update_data = {
        'updated_at': datetime.utcnow()
    }
    
    if 'name' in data:
        update_data['name'] = data['name']
    if 'category' in data:
        update_data['category'] = data['category']
    if 'level' in data:
        update_data['level'] = data['level']
    if 'progress' in data:
        update_data['progress'] = data['progress']
    if 'notes' in data:
        update_data['notes'] = data['notes']
    
    result = skills_collection.update_one(
        {'_id': ObjectId(skill_id), 'owner_email': user_email},
        {'$set': update_data}
    )
    
    if result.matched_count == 0:
        return jsonify({"error": "Skill not found"}), 404
    
    create_system_log(user_email, "Skill Updated", f"Updated skill: {data.get('name', skill_id)}")
    
    return jsonify({'success': True})


@api_bp.route('/skills/<skill_id>', methods=['DELETE'])
@limiter.limit(MODERATE_LIMIT)
def delete_skill(skill_id):
    """Delete a skill."""
    if 'user' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    user_email = session['user']['email']
    
    result = skills_collection.delete_one({'_id': ObjectId(skill_id), 'owner_email': user_email})
    
    if result.deleted_count == 0:
        return jsonify({"error": "Skill not found"}), 404
    
    create_system_log(user_email, "Skill Deleted", f"Deleted skill: {skill_id}")
    
    return jsonify({'success': True})