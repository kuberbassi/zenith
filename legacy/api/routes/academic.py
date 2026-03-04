from flask import Blueprint, request, session, jsonify, Response, send_file
from api.database import db
from api.utils.response import success_response, error_response

from api.calculations_v2 import GradeCalculator
from bson import ObjectId, json_util
from datetime import datetime
import logging
import traceback

logger = logging.getLogger(__name__)
import io

academic_bp = Blueprint('academic', __name__)

subjects_collection = db.get_collection('subjects')
semester_results_collection = db.get_collection('semester_results')
manual_courses_collection = db.get_collection('manual_courses')

def log_user_action(user_email, action, description):
    db.get_collection('system_logs').insert_one({
        'owner_email': user_email,
        'action': action,
        'description': description,
        'timestamp': datetime.utcnow()
    })

@academic_bp.route('/subjects', methods=['GET'])
def get_subjects():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    semester = request.args.get('semester', type=int)
    
    query = {"owner_email": user_email}
    if semester: query["semester"] = semester
    
    subjects = list(subjects_collection.find(query))
    import json
    return success_response(json.loads(json_util.dumps(subjects)))

@academic_bp.route('/full_subjects_data', methods=['GET'])
def get_full_subjects_data():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    semester = request.args.get('semester', type=int)
    
    query = {"owner_email": user_email}
    if semester: query["semester"] = semester
    
    subjects = list(subjects_collection.find(query))
    
    # Enrich with calculated data (percentage, status)
    for sub in subjects:
        attended = sub.get('attended', 0)
        total = sub.get('total', 0)
        percentage = (attended / total * 100) if total > 0 else 0
        sub['percentage'] = round(percentage, 1)
        
        # Simple status message (can be enhanced with AttendanceCalculator)
        if percentage < 75:
            sub['status_message'] = "Low Attendance"
        else:
            sub['status_message'] = "On Track"
            
    import json
    return success_response(json.loads(json_util.dumps(subjects)))

@academic_bp.route('/subjects', methods=['POST'])
def add_subject():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    data = request.json
    user_email = session['user']['email'].lower()
    
    name = data.get('name')
    semester = data.get('semester')
    if not name or not semester: return error_response("Name and semester required", "MISSING_FIELDS")
    
    new_subject = {
        "name": name,
        "owner_email": user_email,
        "semester": int(semester),
        "attended": 0,
        "total": 0,
        "created_at": datetime.utcnow(),
        "categories": data.get('categories', ['Theory']),
        "type": data.get('type', 'theory'),
        "code": data.get('code', ''),
        "professor": data.get('professor', ''),
        "classroom": data.get('classroom', '')
    }
    
    result = subjects_collection.insert_one(new_subject)
    log_user_action(user_email, "Subject Added", f"Added '{name}' to semester {semester}")
    
    return success_response({"id": str(result.inserted_id)})

@academic_bp.route('/subjects/<subject_id>', methods=['GET'])
def get_subject_details(subject_id):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    try:
        user_email = session['user']['email'].lower()
        subject = subjects_collection.find_one({"_id": ObjectId(subject_id), "owner_email": user_email})
        if not subject: return error_response("Subject not found", "NOT_FOUND", 404)
        import json
        return success_response(json.loads(json_util.dumps(subject)))
    except Exception as e:
        logger.error(f"Failed to get subject details {subject_id}: {str(e)}")
        traceback.print_exc()
        return error_response("Invalid ID or fetch failed", "INVALID_ID")

@academic_bp.route('/subjects/<subject_id>', methods=['DELETE'])
def delete_subject(subject_id):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    try:
        sid = ObjectId(subject_id)
        subject = subjects_collection.find_one({"_id": sid, "owner_email": user_email})
        if not subject: return error_response("Subject not found", "NOT_FOUND", 404)
        
        subjects_collection.delete_one({"_id": sid})
        # Cleanup logs
        db.get_collection('attendance_logs').delete_many({"subject_id": sid})
        
        log_user_action(user_email, "Subject Deleted", f"Deleted subject '{subject.get('name')}'")
        return success_response({"message": "Subject deleted"})
    except Exception as e:
        logger.error(f"Failed to delete subject {subject_id}: {str(e)}")
        traceback.print_exc()
        return error_response("Invalid ID or deletion failed", "INVALID_ID")

@academic_bp.route('/subjects/<subject_id>', methods=['PUT', 'PATCH'])
def update_subject_details(subject_id):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    try:
        sid = ObjectId(subject_id)
        data = request.json
        user_email = session['user']['email'].lower()
        
        # Verify ownership first
        subject = subjects_collection.find_one({"_id": sid, "owner_email": user_email})
        if not subject:
            return error_response("Subject not found or unauthorized", "NOT_FOUND", 404)

        allowed_fields = ['name', 'semester', 'categories', 'type', 'code', 'professor', 'classroom', 'credits', 'syllabus']
        update_data = {k: v for k, v in data.items() if k in allowed_fields}
        
        # Standardize semester
        if 'semester' in update_data: update_data['semester'] = int(update_data['semester'])

        # Robust Nested Updates for Practicals
        if 'practicals' in data and isinstance(data['practicals'], dict):
            # If current field is null/missing, we must set the whole object or initialize it
            if not subject.get('practicals'):
                # Initialize with defaults merged with updates
                base = {'total': 10, 'completed': 0, 'hardcopy': False}
                base.update(data['practicals'])
                update_data['practicals'] = base
            else:
                for k, v in data['practicals'].items():
                    update_data[f'practicals.{k}'] = v
        elif 'practical_total' in data:
            update_data['practicals.total'] = int(data['practical_total'])
            
        # Robust Nested Updates for Assignments
        if 'assignments' in data and isinstance(data['assignments'], dict):
            if not subject.get('assignments'):
                base = {'total': 4, 'completed': 0, 'hardcopy': False}
                base.update(data['assignments'])
                update_data['assignments'] = base
            else:
                for k, v in data['assignments'].items():
                    update_data[f'assignments.{k}'] = v
        elif 'assignment_total' in data:
            update_data['assignments.total'] = int(data['assignment_total'])

        result = subjects_collection.update_one({"_id": sid, "owner_email": user_email}, {"$set": update_data})
        
        if result.matched_count == 0:
            return error_response("Subject not found during update", "UPDATE_FAILED", status_code=404)
            
        return success_response({"message": "Subject updated"})
    except Exception as e:
        logger.error(f"Failed to update subject {subject_id}: {str(e)}")
        traceback.print_exc()
        return error_response(f"Failed to update subject: {str(e)}", "UPDATE_FAILED")

@academic_bp.route('/subjects/<subject_id>/attendance-count', methods=['POST'])
def update_attendance_count(subject_id):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    try:
        sid = ObjectId(subject_id)
        data = request.json
        user_email = session['user']['email'].lower()
        
        attended = int(data.get('attended', 0))
        total = int(data.get('total', 0))
        
        subjects_collection.update_one(
            {"_id": sid, "owner_email": user_email},
            {"$set": {"attended": attended, "total": total}}
        )
        return success_response({"message": "Attendance count updated"})
    except Exception as e:
        logger.error(f"Failed to update attendance count {subject_id}: {str(e)}")
        traceback.print_exc()
        return error_response("Failed to update count", "UPDATE_FAILED")

@academic_bp.route('/results', methods=['GET', 'POST', 'DELETE'])
@academic_bp.route('/results/<int:semester>', methods=['DELETE']) 
def handle_results(semester=None):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    
    if request.method == 'GET':
        results = list(semester_results_collection.find({'owner_email': user_email}).sort('semester', 1))
        # Recalculate CGPA for the response
        if results:
            # Prepare data for CGPA calculation: list of list of courses
            semesters_data = [res.get('subjects', []) for res in results]
            cgpa_calc = GradeCalculator.calculate_cgpa(semesters_data)
            for res in results:
                res['cgpa'] = cgpa_calc['cgpa']
        import json
        return success_response(json.loads(json_util.dumps(results)))
    
    if request.method == 'POST':
        data = request.json
        semester = int(data.get('semester'))
        subjects_data = data.get('subjects', [])
        
        processed_subjects = []
        for sub in subjects_data:
            processed = GradeCalculator.calculate_subject_result(sub)
            # Preserve original input data (marks)
            final_sub = sub.copy()
            final_sub.update(processed)
            final_sub.update({
                'name': sub.get('name'),
                'code': sub.get('code', ''),
                'credits': int(sub.get('credits', 0))
            })
            processed_subjects.append(final_sub)
            
        sgpa_calc = GradeCalculator.calculate_sgpa(processed_subjects)
        
        result_doc = {
            'owner_email': user_email,
            'semester': semester,
            'subjects': processed_subjects,
            'sgpa': sgpa_calc['sgpa'],
            'total_credits': sgpa_calc['total_credits'],
            'updated_at': datetime.utcnow()
        }
        
        semester_results_collection.update_one(
            {'owner_email': user_email, 'semester': semester},
            {'$set': result_doc},
            upsert=True
        )
        
        log_user_action(user_email, "Result Updated", f"Semester {semester} result saved. SGPA: {sgpa_calc['sgpa']}")
        return success_response({"sgpa": sgpa_calc['sgpa']})

    if request.method == 'DELETE':
        if semester is None:
            # Try getting from JSON if not in URL? Or error.
            # Frontend calls DELETE /api/semester_results/1
            return error_response("Semester required", "MISSING_FIELD")
        
        semester_results_collection.delete_one({'owner_email': user_email, 'semester': semester})
        log_user_action(user_email, "Result Deleted", f"Deleted results for Semester {semester}")
        return success_response({"message": f"Semester {semester} results deleted"})

@academic_bp.route('/courses/manual', methods=['GET', 'POST'])
def handle_manual_courses():
    """Handles online courses (Python, Digital Marketing, etc.) distinct from academic subjects."""
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    
    if request.method == 'GET':
        courses = list(manual_courses_collection.find({'owner_email': user_email}))
        import json
        return success_response(json.loads(json_util.dumps(courses)))
    
    if request.method == 'POST':
        data = request.json
        if isinstance(data, list):
            manual_courses_collection.delete_many({'owner_email': user_email})
            for c in data: 
                c['owner_email'] = user_email
                if '_id' in c: c.pop('_id')
            if data: manual_courses_collection.insert_many(data)
        else:
            data['owner_email'] = user_email
            manual_courses_collection.insert_one(data)
        return success_response()

@academic_bp.route('/courses/manual/<course_id>', methods=['PUT', 'DELETE'])
def handle_manual_course_item(course_id):
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    
    try:
        cid = ObjectId(course_id)
        if request.method == 'PUT':
            data = request.json
            update_data = {k: v for k, v in data.items() if k != '_id' and k != 'owner_email'}
            
            result = manual_courses_collection.update_one(
                {'_id': cid, 'owner_email': user_email},
                {'$set': update_data}
            )
            
            if result.matched_count == 0:
                return error_response("Course not found", "NOT_FOUND", 404)
                
            return success_response({"message": "Course updated"})
            
        if request.method == 'DELETE':
            result = manual_courses_collection.delete_one({'_id': cid, 'owner_email': user_email})
            
            if result.deleted_count == 0:
                return error_response("Course not found", "NOT_FOUND", 404)
                
            return success_response({"message": "Course deleted"})
            
    except Exception as e:
        return error_response("Invalid ID or Operation Failed", "INVALID_REQUEST")
