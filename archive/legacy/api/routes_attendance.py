# Complete Attendance Endpoints with Calculations

from flask import Blueprint, request, jsonify
from datetime import datetime
from api.calculations import AttendanceCalculator
from api.security_middleware import require_rate_limit, require_admin, log_audit, SecurityMiddleware

attendance_bp = Blueprint('attendance', __name__)

# ... existing code ...

@attendance_bp.route('/api/subjects/<subject_id>/attendance-analysis', methods=['GET'])
@require_rate_limit('api')
def get_attendance_analysis(subject_id):
    """
    Get detailed attendance analysis for a subject
    Returns: percentage, trend, prediction, days needed for target
    """
    try:
        from api.models import Subject, AttendanceLog
        
        subject = Subject.objects(id=subject_id).first()
        if not subject:
            return jsonify({'error': 'Subject not found'}), 404
        
        # Get attendance logs
        logs = AttendanceLog.objects(subject_id=subject_id).order_by('date')
        
        attended = sum(1 for log in logs if log.attended)
        total = len(logs)
        
        # Calculate percentage
        percentage = AttendanceCalculator.calculate_attendance_percentage(attended, total)
        
        # Predict trend
        records = [{'date': log.date, 'attended': log.attended} for log in logs]
        trend = AttendanceCalculator.predict_attendance_trend(records)
        
        # Calculate days needed for 75% target
        days_needed_75 = AttendanceCalculator.calculate_days_needed_for_target(attended, total, 75)
        days_needed_85 = AttendanceCalculator.calculate_days_needed_for_target(attended, total, 85)
        
        # Risk assessment
        if percentage < 75:
            risk_level = 'Critical'
            color = 'red'
        elif percentage < 80:
            risk_level = 'Warning'
            color = 'orange'
        else:
            risk_level = 'Safe'
            color = 'green'
        
        return jsonify({
            'subject_id': subject_id,
            'subject_name': subject.name,
            'attendance': {
                'attended': attended,
                'total': total,
                'percentage': round(percentage, 2)
            },
            'analysis': {
                'trend': trend['trend'],
                'confidence': trend['confidence'],
                'risk_level': risk_level,
                'color': color
            },
            'targets': {
                'days_needed_for_75': days_needed_75,
                'days_needed_for_85': days_needed_85
            }
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/api/subjects/<subject_id>/mark-attendance', methods=['POST'])
@require_rate_limit('api')
@log_audit('MARK_ATTENDANCE', 'User marked attendance for subject')
def mark_attendance(subject_id):
    """Mark attendance for a specific class"""
    try:
        data = request.get_json()
        
        # Validate input
        schema = {
            'attended': {'type': bool, 'required': True},
            'date': {'type': str, 'required': True}
        }
        is_valid, error = SecurityMiddleware.validate_input(data, schema)
        if not is_valid:
            return jsonify({'error': error}), 400
        
        from api.models import AttendanceLog, Subject
        from flask import session
        
        # Check if subject exists
        subject = Subject.objects(id=subject_id).first()
        if not subject:
            return jsonify({'error': 'Subject not found'}), 404
        
        # Check for duplicate attendance on same date
        existing = AttendanceLog.objects(
            subject_id=subject_id,
            date=data['date'],
            owner_email=session['email']
        ).first()
        
        if existing:
            return jsonify({'error': 'Attendance already marked for this date'}), 400
        
        # Create attendance log
        log = AttendanceLog(
            subject_id=subject_id,
            owner_email=session['email'],
            date=data['date'],
            attended=data['attended'],
            timestamp=datetime.utcnow()
        )
        log.save()
        
        return jsonify({
            'message': 'Attendance marked',
            'log_id': str(log.id)
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
