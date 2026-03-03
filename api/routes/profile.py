from flask import Blueprint, session, request, jsonify, Response
from api.database import db
from api.utils.response import success_response, error_response
from bson import ObjectId, json_util
from datetime import datetime
import logging
import traceback
import base64
import json

logger = logging.getLogger(__name__)

profile_bp = Blueprint('profile', __name__)

users_collection = db.get_collection('users')
system_logs_collection = db.get_collection('system_logs')
preferences_collection = db.get_collection('user_preferences')

def create_system_log(user_email, action, description):
    system_logs_collection.insert_one({
        'owner_email': user_email,
        'action': action,
        'description': description,
        'timestamp': datetime.utcnow()
    })

@profile_bp.route('/', methods=['GET', 'PUT', 'POST'])
def handle_profile():
    try:
        if 'user' not in session: 
            return error_response("Unauthorized", "UNAUTHORIZED", 401)
        
        user_session = session.get('user', {})
        user_email = user_session.get('email', '').lower()
        
        if not user_email:
            logger.error("Session user missing email")
            return error_response("Invalid session state", "INVALID_SESSION", 401)

        if request.method == 'GET':
            try:
                user = users_collection.find_one({"email": user_email})
                if not user:
                    return error_response("User profile not found", "USER_NOT_FOUND", status_code=404)
                
                # CRITICAL: Merge thresholds from preferences collection if missing or newer
                # This ensures settings changed on Web (which uses /preferences) reflect on Mobile (which uses /profile)
                prefs_doc = preferences_collection.find_one({'owner_email': user_email})
                if prefs_doc and 'preferences' in prefs_doc:
                    p = prefs_doc['preferences']
                    # Standardize names: Web might send 'min_attendance' instead of 'warning_threshold'
                    if 'attendance_threshold' in p: user['attendance_threshold'] = p['attendance_threshold']
                    if 'warning_threshold' in p: user['warning_threshold'] = p['warning_threshold']
                    elif 'min_attendance' in p: user['warning_threshold'] = p['min_attendance'] # Alias for web

                # Sync field aliases for cross-platform matching
                if user.get('course') and not user.get('branch'): user['branch'] = user['course']
                if user.get('branch') and not user.get('course'): user['course'] = user['branch']
                
                return success_response(json.loads(json_util.dumps(user)))
            except Exception as e:
                logger.error(f"Error fetching profile for {user_email}: {e}")
                traceback.print_exc()
                return error_response(f"Failed to fetch profile: {str(e)}", "PROFILE_FETCH_FAILED")
        
        if request.method in ['PUT', 'POST']:
            data = request.json
            allowed_fields = ['name', 'branch', 'college', 'semester', 'batch', 'course', 'attendance_threshold', 'warning_threshold', 'enrollment_number']
            update_data = {k: v for k, v in data.items() if k in allowed_fields}
            
            # Handle Semester specifically if it's a string
            if 'semester' in update_data:
                try: update_data['semester'] = int(update_data['semester'])
                except: pass

            # CRITICAL: Sync 'course' and 'branch' for web/mobile compatibility
            if 'course' in update_data and 'branch' not in update_data:
                update_data['branch'] = update_data['course']
            elif 'branch' in update_data and 'course' not in update_data:
                update_data['course'] = update_data['branch']

            users_collection.update_one({'email': user_email}, {'$set': update_data})
            
            # Update session safely
            if 'user' in session:
                session['user'].update(update_data)
                session.modified = True
            
            create_system_log(user_email, "Profile Updated", "User updated their profile information.")
            return success_response({"message": "Profile updated"})
            
    except Exception as e:
        logger.error(f"Handle Profile Critical Error: {e}")
        traceback.print_exc()
        return error_response(f"Internal error: {str(e)}", "INTERNAL_ERROR")

@profile_bp.route('/upload_pfp', methods=['POST'])
def upload_pfp():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    
    if 'file' not in request.files:
        return error_response("No file uploaded", "MISSING_FILE")
    
    file = request.files['file']
    if file.filename == '':
        return error_response("No file selected", "EMPTY_FILE")
    
    try:
        # Convert to Base64 (Vercel-compatible storage)
        file_content = file.read()
        base64_content = base64.b64encode(file_content).decode('utf-8')
        mime_type = file.content_type or 'image/jpeg'
        pfp_url = f"data:{mime_type};base64,{base64_content}"
        
        # Update user in DB
        users_collection.update_one(
            {'email': user_email},
            {'$set': {'picture': pfp_url}}
        )
        
        # Do NOT put base64 image in session cookie (overflows 4kb limit)
        # session['user']['picture'] = pfp_url 
        # session.modified = True 
        
        create_system_log(user_email, "PFP Updated", "User uploaded a new profile picture.")
        
        return success_response({"url": pfp_url})
    except Exception as e:
        logger.error(f"PFP Upload error: {str(e)}")
        return error_response("Failed to upload profile picture", "UPLOAD_FAILED")

@profile_bp.route('/preferences', methods=['GET', 'POST'])
def handle_preferences():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    
    if request.method == 'GET':
        prefs = preferences_collection.find_one({'owner_email': user_email})
        # Default fallback for new users
        default_prefs = {
            'attendance_threshold': 75,
            'warning_threshold': 76,
            'notifications_enabled': False,
            'accent_color': '#6750A4'
        }
        if prefs:
            default_prefs.update(prefs.get('preferences', {}))
        return success_response(default_prefs)
        
    if request.method == 'POST':
        data = request.json
        # Standardize: Map 'min_attendance' to 'warning_threshold' if sent from web
        if 'min_attendance' in data:
            data['warning_threshold'] = data.pop('min_attendance')

        # CRITICAL FIX: Merge with existing preferences instead of replacing entirely
        # This prevents mobile from wiping accent_color when it only sends thresholds
        existing = preferences_collection.find_one({'owner_email': user_email})
        existing_prefs = existing.get('preferences', {}) if existing else {}
        merged_prefs = {**existing_prefs, **data}  # New values override existing

        preferences_collection.update_one(
            {'owner_email': user_email},
            {'$set': {'preferences': merged_prefs, 'updated_at': datetime.utcnow()}},
            upsert=True
        )

        # Mirror core thresholds back to the user object for mobile sync
        mirror_data = {}
        if 'attendance_threshold' in data: mirror_data['attendance_threshold'] = data['attendance_threshold']
        if 'warning_threshold' in data: mirror_data['warning_threshold'] = data['warning_threshold']
        
        if mirror_data:
            users_collection.update_one({'email': user_email}, {'$set': mirror_data})

        return success_response({"message": "Preferences saved"})



@profile_bp.route('/biometric/register', methods=['POST'])
def register_biometric():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    data = request.json
    pub_key = data.get('public_key')
    device_id = data.get('device_id', 'default')
    
    if not pub_key: return error_response("Public key required", "KEY_REQUIRED")
        
    users_collection.update_one(
        {"email": user_email},
        {"$set": {f"biometrics.{device_id}": {
            "public_key": pub_key,
            "registered_at": datetime.utcnow()
        }}}
    )
    return success_response(message="Biometric credential registered")

@profile_bp.route('/logs', methods=['GET'])
def get_system_logs():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    try:
        logs = list(system_logs_collection.find({'owner_email': user_email}).sort('timestamp', -1).limit(50))
        from bson import json_util
        import json
        return success_response(json.loads(json_util.dumps(logs)))
    except Exception as e:
        logger.error(f"Failed to fetch system logs: {e}")
        return error_response("Failed to fetch logs.", "FETCH_FAILED")
