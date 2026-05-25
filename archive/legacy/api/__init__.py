import os
from flask import Flask, request, session, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import nest_asyncio
from datetime import datetime
from flask_socketio import SocketIO

socketio = SocketIO(cors_allowed_origins="*", async_mode='threading')

nest_asyncio.apply()


load_dotenv()

from api.database import db

def create_app():
    app = Flask(__name__)
    
    app.secret_key = os.getenv("FLASK_SECRET_KEY", "change-in-production")
    
    # Session Config
    is_production = os.getenv('FLASK_ENV') == 'production' or os.getenv('VERCEL') == '1'
    app.config['SESSION_COOKIE_SAMESITE'] = 'None' if is_production else 'Lax'
    app.config['SESSION_COOKIE_SECURE'] = is_production # Secure in production
    
     # Enable CORS for React frontend (Explicit ports for stability)
    CORS(app, 
         resources={r"/*": {
             "origins": [
                 "http://localhost:5173", 
                 "http://127.0.0.1:5173",
                 "http://localhost:8081",     # Expo Web
                 "http://localhost:19006",    # Expo Legacy
                 "http://192.168.0.159:8081", # Network IP
                 "https://zenithkb.vercel.app",
                 "https://zenith.kuberbassi.com"
             ],
             "supports_credentials": True,
             "allow_headers": ["Content-Type", "Authorization", "Accept"],
             "expose_headers": ["Content-Type", "Authorization"],
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]
         }})

    # JWT-to-Session middleware for mobile app compatibility
    @app.before_request
    def inject_jwt_into_session():
        """
        Middleware: If JWT token is present in Authorization header (mobile),
        inject user data into session so existing session-based endpoints work.
        """
        import jwt as jwt_lib
        
        # Skip if already have session
        if 'user' in session:
            return
        
        # Check for JWT token
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = jwt_lib.decode(
                    token,
                    os.getenv('FLASK_SECRET_KEY', 'dev-secret-key'),
                    algorithms=['HS256']
                )
                
                # Inject full user data from DB into session
                # This ensures course, semester, batch, etc. are available
                user_email = payload.get('email', '').lower()  # ✅ Normalized to lowercase
                if user_email:
                    from api.database import db
                    users_collection = db.get_collection('users')
                    db_user = users_collection.find_one({'email': user_email})
                    
                    if db_user:
                        # Convert ObjectId and datetimes to serializable
                        from bson import ObjectId
                        # Create copy to avoid mutating cursor
                        user_data = dict(db_user)
                        
                        if '_id' in user_data: user_data['_id'] = str(user_data['_id'])
                        
                        # Remove typically large fields to prevent cookie bloat (4KB limit)
                        # CRITICAL: Allow picture if it's a URL (Google PFP, etc.).
                        # Only strip if it's a massive Base64 string.
                        fields_to_exclude = ['subjects', 'timetable', 'assignments', 'profile_image', 'notifications']
                        for field in fields_to_exclude:
                            user_data.pop(field, None)
                        
                        # Handle 'picture' separately
                        if 'picture' in user_data:
                            pic = user_data['picture']
                            if pic and len(str(pic)) > 2000 and str(pic).startswith('data:'):
                                user_data.pop('picture')
                        
                        for k, v in user_data.items():
                            if isinstance(v, datetime): user_data[k] = v.isoformat()
                        
                        session['user'] = user_data
                    else:
                        # Fallback to minimal data if user not in DB yet
                        session['user'] = {
                            'email': user_email,
                            'name': payload.get('name', 'Mobile User')
                        }
                
                # Mark as JWT-based for debugging
                session['auth_method'] = 'jwt'
                
            except Exception as e:
                # Log the error but don't crash the request. 
                # The route will return 401 if 'user' is missing from session.
                print(f"⚠️ JWT middleware error: {e}")

    # Security, Scalability & Logging Middleware
    from api.middleware.compression import init_compression
    from api.middleware.security import init_security_headers
    from api.middleware.logging import init_activity_logger
    from api.middleware.honeypot import init_honeypot
    
    init_compression(app)
    init_security_headers(app)
    init_activity_logger(app)
    init_honeypot(app)

    @app.errorhandler(Exception)
    def handle_exception(e):
        import traceback
        print(f"🔥 SERVER ERROR: {str(e)}")
        traceback.print_exc()
        response = jsonify({"error": str(e), "trace": traceback.format_exc()})
        response.status_code = 500
        # Determine origin for CORS
        request_origin = request.headers.get('Origin')
        allowed_origins = [
            "http://localhost:5173", "http://127.0.0.1:5173",
            "http://localhost:8081", "http://localhost:19006",
            "https://zenithkb.vercel.app", "https://zenith.kuberbassi.com"
        ]
        if request_origin in allowed_origins or (request_origin and request_origin.startswith("http://localhost:")):
            response.headers['Access-Control-Allow-Origin'] = request_origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = "Content-Type, Authorization, Accept"
        return response

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get('Origin')
        if origin and (origin.startswith('http://localhost') or origin.startswith('https://zenith')):
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
        return response
    
    from api.routes.attendance import attendance_bp, mark_attendance, get_attendance_logs, get_classes_for_date, get_calendar_data, delete_attendance, edit_attendance
    from api.routes.dashboard import dashboard_bp, get_dashboard_data, get_notifications, get_reports_data, analytics_day_of_week
    from api.routes.profile import profile_bp, handle_profile, handle_preferences, get_system_logs, upload_pfp
    from api.routes.academic import academic_bp, handle_results, handle_manual_courses, handle_manual_course_item, get_full_subjects_data, get_subjects, get_subject_details, delete_subject, update_subject_details, update_attendance_count
    from api.routes.timetable import timetable_bp, handle_timetable, handle_holidays, save_structure, add_slot, update_slot, delete_slot, delete_holiday
    from api.routes.skills import skills_bp, get_skills, add_skill, update_skill, delete_skill
    from api.auth import auth_bp
    from api.keep import keep_bp
    from api.scraper import scraper_bp, get_notices

    from api.rate_limiter import init_limiter

    app.register_blueprint(attendance_bp, url_prefix='/api/v1/attendance')
    app.register_blueprint(dashboard_bp, url_prefix='/api/v1/dashboard')
    app.register_blueprint(profile_bp, url_prefix='/api/v1/profile')
    app.register_blueprint(academic_bp, url_prefix='/api/v1/academic')
    app.register_blueprint(timetable_bp, url_prefix='/api/v1/timetable')
    app.register_blueprint(skills_bp, url_prefix='/api/v1/skills')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(keep_bp)
    app.register_blueprint(scraper_bp, url_prefix='/api/scraper')

    # LEGACY ROUTES (Frontend Compatibility)
    app.add_url_rule('/api/current_user', view_func=handle_profile, methods=['GET'])
    app.add_url_rule('/api/preferences', view_func=handle_preferences, methods=['GET', 'POST'])
    app.add_url_rule('/api/dashboard_data', view_func=get_dashboard_data, methods=['GET'])
    app.add_url_rule('/api/notifications', view_func=get_notifications, methods=['GET'])
    app.add_url_rule('/api/semester_results', view_func=handle_results, methods=['GET', 'POST', 'DELETE'])
    app.add_url_rule('/api/semester_results/<int:semester>', view_func=handle_results, methods=['DELETE'])
    app.add_url_rule('/api/analytics/day_of_week', view_func=analytics_day_of_week, methods=['GET'])
    app.add_url_rule('/api/all_semesters_overview', view_func=handle_results, methods=['GET'])
    app.add_url_rule('/api/reports_data', view_func=get_reports_data, methods=['GET'])
    app.add_url_rule('/api/notices', view_func=get_notices, methods=['GET'])
    app.add_url_rule('/api/full_subjects_data', view_func=get_full_subjects_data, methods=['GET'])
    app.add_url_rule('/api/courses/manual', view_func=handle_manual_courses, methods=['GET', 'POST'])
    app.add_url_rule('/api/courses/manual/<course_id>', view_func=handle_manual_course_item, methods=['PUT', 'DELETE'])
    app.add_url_rule('/api/skills', view_func=get_skills, methods=['GET'])
    app.add_url_rule('/api/skills', view_func=add_skill, methods=['POST'])
    app.add_url_rule('/api/skills/<skill_id>', view_func=update_skill, methods=['PUT'])
    app.add_url_rule('/api/skills/<skill_id>', view_func=delete_skill, methods=['DELETE'])
    
    # Missing Legacy Routes for data visibility
    app.add_url_rule('/api/subjects', view_func=get_subjects, methods=['GET'])
    app.add_url_rule('/api/timetable', view_func=handle_timetable, methods=['GET', 'POST'])
    app.add_url_rule('/api/timetable/structure', view_func=save_structure, methods=['POST'])
    app.add_url_rule('/api/timetable/slot', view_func=add_slot, methods=['POST'])
    app.add_url_rule('/api/timetable/slot/<slot_id>', view_func=update_slot, methods=['PUT'])
    app.add_url_rule('/api/timetable/slot/<slot_id>', view_func=delete_slot, methods=['DELETE'])
    app.add_url_rule('/api/attendance_logs', view_func=get_attendance_logs, methods=['GET'])
    app.add_url_rule('/api/get_attendance_logs', view_func=get_attendance_logs, methods=['GET'])
    app.add_url_rule('/api/mark_attendance', view_func=mark_attendance, methods=['POST'])
    app.add_url_rule('/api/edit_attendance/<log_id>', view_func=edit_attendance, methods=['POST'])
    app.add_url_rule('/api/classes_for_date', view_func=get_classes_for_date, methods=['GET'])
    app.add_url_rule('/api/calendar_data', view_func=get_calendar_data, methods=['GET'])
    app.add_url_rule('/api/holidays', view_func=handle_holidays, methods=['GET', 'POST'])
    app.add_url_rule('/api/holidays/<holiday_id>', view_func=delete_holiday, methods=['DELETE'])
    app.add_url_rule('/api/profile', view_func=handle_profile, methods=['GET', 'POST', 'PUT'])
    app.add_url_rule('/api/update_profile', view_func=handle_profile, methods=['POST'])
    app.add_url_rule('/api/upload_pfp', view_func=upload_pfp, methods=['POST'])
    app.add_url_rule('/api/system_logs', view_func=get_system_logs, methods=['GET'])
    
    # Final Academic Management Legacy Rules
    app.add_url_rule('/api/subject_details/<subject_id>', view_func=get_subject_details, methods=['GET'])
    app.add_url_rule('/api/delete_subject/<subject_id>', view_func=delete_subject, methods=['DELETE'])
    app.add_url_rule('/api/update_subject_details', view_func=update_subject_details, methods=['POST', 'PUT'])
    app.add_url_rule('/api/update_subject_full_details', view_func=update_subject_details, methods=['POST', 'PUT'])
    app.add_url_rule('/api/update_attendance_count', view_func=update_attendance_count, methods=['POST'])
    app.add_url_rule('/api/delete_attendance/<log_id>', view_func=delete_attendance, methods=['DELETE'])
    app.add_url_rule('/api/logs/<log_id>', view_func=delete_attendance, methods=['DELETE'])

    from api.routes.data_management import data_mgmt_bp, export_data, import_data, delete_all_data, restore_backup, list_backups
    app.register_blueprint(data_mgmt_bp, url_prefix='/api/v1/data')
    app.add_url_rule('/api/export_data', view_func=export_data, methods=['GET'])
    app.add_url_rule('/api/import_data', view_func=import_data, methods=['POST'])
    app.add_url_rule('/api/delete_all_data', view_func=delete_all_data, methods=['DELETE'])
    app.add_url_rule('/api/backups', view_func=list_backups, methods=['GET'])
    app.add_url_rule('/api/restore_backup/<backup_id>', view_func=restore_backup, methods=['POST'])

    # IPU Exam Portal Routes
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    from api.routes.ipu import ipu_bp
    app.register_blueprint(ipu_bp, url_prefix='/api/ipu')

    
    # Initialize Rate Limiter
    init_limiter(app)
    
    # Initialize SocketIO
    socketio.init_app(app)
    
    return app
