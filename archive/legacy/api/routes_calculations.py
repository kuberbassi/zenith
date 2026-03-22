# Complete Calculation Endpoints

from flask import Blueprint, request, jsonify
from functools import wraps
from flask_limiter.util import get_remote_address
from api.calculations_v2 import AttendanceCalculator, GradeCalculator
from api.models import db, Subject, SemesterResult, User
from bson import ObjectId

calc_bp = Blueprint('calculations', __name__)

# ... existing code ...

@calc_bp.route('/api/attendance/analysis', methods=['GET'])
def get_attendance_analysis():
    """Complete attendance analysis for all subjects"""
    try:
        from flask import session
        
        user_email = session.get('email')
        if not user_email:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Get all subjects for user
        subjects = Subject.objects(owner_email=user_email)
        
        # Calculate for each subject
        subject_data = []
        for subject in subjects:
            # ... existing code ...
            attended = subject.attended_count or 0
            total = subject.total_classes or 0
            
            percentage = AttendanceCalculator.calculate_percentage(attended, total)
            risk_level, color = AttendanceCalculator.get_risk_level(percentage)
            days_75 = AttendanceCalculator.calculate_days_needed(attended, total, 75)
            days_85 = AttendanceCalculator.calculate_days_needed(attended, total, 85)
            
            subject_data.append({
                'id': str(subject.id),
                'name': subject.name,
                'code': subject.code,
                'attended': attended,
                'total': total,
                'percentage': percentage,
                'risk_level': risk_level,
                'color': color,
                'targets': {
                    'for_75_percent': days_75,
                    'for_85_percent': days_85
                }
            })
        
        # Overall summary
        summary = AttendanceCalculator.get_attendance_summary(subject_data)
        
        return jsonify({
            'subjects': subject_data,
            'summary': summary
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@calc_bp.route('/api/grades/sgpa', methods=['POST'])
def calculate_sgpa():
    """Calculate SGPA for a semester"""
    try:
        data = request.get_json()
        semester = data.get('semester')
        courses = data.get('courses', [])
        
        if not semester or not courses:
            return jsonify({'error': 'Missing semester or courses'}), 400
        
        result = GradeCalculator.calculate_sgpa(courses)
        
        return jsonify({
            'semester': semester,
            'sgpa': result
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@calc_bp.route('/api/grades/cgpa', methods=['GET'])
def calculate_cgpa():
    """Calculate CGPA from all semesters"""
    try:
        from flask import session
        
        user_email = session.get('email')
        if not user_email:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Get all results
        results = SemesterResult.objects(owner_email=user_email).order_by('semester')
        
        # Group by semester
        semesters = {}
        for result in results:
            sem = result.semester
            if sem not in semesters:
                semesters[sem] = []
            
            semesters[sem].append({
                'grade': result.grade,
                'credits': result.credits,
                'name': result.subject_name
            })
        
        # Calculate CGPA
        all_semesters = [semesters[s] for s in sorted(semesters.keys())]
        cgpa_result = GradeCalculator.calculate_cgpa(all_semesters)
        
        return jsonify(cgpa_result), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@calc_bp.route('/api/grades/predict', methods=['POST'])
def predict_grade():
    """Predict final grade based on assessments"""
    try:
        data = request.get_json()
        assessments = data.get('assessments', [])
        
        if not assessments:
            return jsonify({'error': 'No assessments provided'}), 400
        
        prediction = GradeCalculator.predict_final_grade(assessments)
        
        return jsonify(prediction), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@calc_bp.route('/api/attendance/trend', methods=['GET'])
def get_attendance_trend():
    """Get attendance trend for a subject"""
    try:
        from flask import session
        
        subject_id = request.args.get('subject_id')
        if not subject_id:
            return jsonify({'error': 'Missing subject_id'}), 400
        
        subject = Subject.objects(id=ObjectId(subject_id)).first()
        if not subject:
            return jsonify({'error': 'Subject not found'}), 404
        
        # Get attendance logs
        logs = subject.attendance_logs or []
        records = [log.get('attended', False) for log in logs]
        
        trend = AttendanceCalculator.predict_trend(records)
        
        return jsonify(trend), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
