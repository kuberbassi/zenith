from flask import Blueprint, session, request, jsonify, Response
from api.database import db
from api.utils.response import success_response, error_response
from api.calculations_v2 import AttendanceCalculator
from bson import ObjectId, json_util
from datetime import datetime, timedelta
import logging
import traceback

logger = logging.getLogger(__name__)

dashboard_bp = Blueprint('dashboard', __name__)

attendance_log_collection = db.get_collection('attendance_logs')
subjects_collection = db.get_collection('subjects')
system_logs_collection = db.get_collection('system_logs')

@dashboard_bp.route('/data', methods=['GET'])
def get_dashboard_data():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()  # ✅ Normalized
    semester = request.args.get('semester', type=int, default=1)
    
    subjects = list(subjects_collection.find({"owner_email": user_email, "semester": semester}))
    summary = AttendanceCalculator.get_attendance_summary(subjects)
    
    # Serialize subjects
    serialized_subjects = []
    for sub in subjects:
        sub['_id'] = str(sub['_id'])
        if 'attendance_percentage' not in sub:
             # Ensure percentage is calculated if not present (AttendanceCalculator does summary, but maybe we need per-subject too)
             # Frontend uses subject.attendance_percentage
             attended = sub.get('attended', 0)
             total = sub.get('total', 0)
             sub['attendance_percentage'] = AttendanceCalculator.calculate_percentage(attended, total)
             
             # Also status message
             guard = AttendanceCalculator.calculate_bunk_guard(attended, total, 75)
             sub['status_message'] = guard['status_message']
             
        serialized_subjects.append(sub)

    return success_response({
        "overall_attendance": summary['overall_percentage'],
        "total_subjects": len(subjects),
        "subjects": serialized_subjects,
        "summary": summary, # Keep for backward compat if needed
        "last_updated": datetime.utcnow().isoformat()
    })

@dashboard_bp.route('/reports_data', methods=['GET'])
def get_reports_data():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()  # ✅ Normalized
    semester = request.args.get('semester', type=int, default=1)
    
    # Fetch Data
    subjects = list(subjects_collection.find({"owner_email": user_email, "semester": semester}))
    logs = list(attendance_log_collection.find({"owner_email": user_email, "semester": semester}))
    
    # 1. Subject Breakdown
    processed_subjects = []
    total_absences = 0
    
    for sub in subjects:
        attended = sub.get('attended', 0)
        total = sub.get('total', 0)
        percentage = (attended / total * 100) if total > 0 else 0
        
        sub['percentage'] = round(percentage, 1)
        sub['_id'] = str(sub['_id'])
        processed_subjects.append(sub)
        
        total_absences += (total - attended)

    # 2. KPIs (Best/Worst)
    best_subject = max(processed_subjects, key=lambda x: x['percentage']) if processed_subjects else None
    worst_subject = min(processed_subjects, key=lambda x: x['percentage']) if processed_subjects else None
    
    # 3. Heatmap Data (Date -> Status[])
    heatmap_data = {}
    for log in logs:
        date = log.get('date')
        if date:
            if date not in heatmap_data: heatmap_data[date] = []
            heatmap_data[date].append(log.get('status', 'unknown'))

    response_data = {
        "kpis": {
            "best_subject_name": best_subject['name'] if best_subject else "N/A",
            "best_subject_percent": f"{best_subject['percentage']}%" if best_subject else "0%",
            "worst_subject_name": worst_subject['name'] if worst_subject else "N/A",
            "worst_subject_percent": f"{worst_subject['percentage']}%" if worst_subject else "0%",
            "total_absences": total_absences
        },
        "subject_breakdown": processed_subjects,
        "heatmap_data": heatmap_data
    }
    
    return success_response(response_data)

@dashboard_bp.route('/analytics/day-of-week')
def analytics_day_of_week():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    try:
        user_email = session['user']['email'].lower()  # ✅ Normalized
        semester = int(request.args.get('semester', 1))
        
        semester_subjects = list(subjects_collection.find({'owner_email': user_email, 'semester': semester}, {'_id': 1}))
        subject_ids = [s['_id'] for s in semester_subjects]
        
        if not subject_ids:
            return success_response({"days": []})

        logs = list(attendance_log_collection.find({
            'owner_email': user_email, 
            'subject_id': {'$in': subject_ids}
        }, {'date': 1, 'status': 1}))
        
        day_counts = {} 
        
        for log in logs:
            try:
                date_str = log.get('date')
                status = log.get('status')
                if not date_str or not status: continue
                dt = datetime.strptime(date_str, '%Y-%m-%d')
                w_idx = int(dt.strftime('%w'))
                mongo_day = w_idx + 1 # 1=Sun, 2=Mon...
                if mongo_day not in day_counts: day_counts[mongo_day] = {'present': 0, 'absent': 0}
                
                if status in ['present', 'late', 'approved_medical', 'substituted']:
                    day_counts[mongo_day]['present'] = day_counts[mongo_day].get('present', 0) + 1
                elif status == 'absent':
                    day_counts[mongo_day]['absent'] = day_counts[mongo_day].get('absent', 0) + 1
            except Exception:
                continue

        day_mapping = {
            2: 'Mon', 3: 'Tue', 4: 'Wed', 5: 'Thu', 6: 'Fri', 7: 'Sat', 1: 'Sun'
        }
        
        days_data = []
        for d_num in [2, 3, 4, 5, 6, 7, 1]:
            counts = day_counts.get(d_num, {})
            present = counts.get('present', 0)
            absent = counts.get('absent', 0)
            total = present + absent
            
            days_data.append({
                "day": day_mapping[d_num],
                "present": present,
                "total": total,
                "percentage": round((present / total * 100), 1) if total > 0 else 0
            })
            
        return success_response({"days": days_data})
    except Exception as e:
        logger.error(f"Failed to fetch analytics: {str(e)}")
        logger.debug(traceback.format_exc())
        return error_response("Failed to fetch analytics", "ANALYTICS_FAILED")

@dashboard_bp.route('/achievements')
def get_achievements():
    # Feature removed
    return jsonify({"error": "Achievements feature removed"}), 404

@dashboard_bp.route('/notifications')
def get_notifications():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()  # ✅ Normalized
    
    # Fetch recent important notifications
    notifications = []
    
    # 1. Bunk Alarms
    subjects = list(subjects_collection.find({'owner_email': user_email}))
    for sub in subjects:
        target = 75 # default
        attended = sub.get('attended', 0)
        total = sub.get('total', 0)
        guard = AttendanceCalculator.calculate_bunk_guard(attended, total, target)
        if not guard['can_bunk'] and guard['count'] > 0:
            notifications.append({
                "type": "warning",
                "title": "Attendance Warning",
                "message": f"Critical: {sub['name']} is at {guard['percentage']}%. {guard['status_message']}",
                "priority": "high"
            })

    return success_response(notifications)
