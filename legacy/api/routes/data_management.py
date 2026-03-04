from flask import Blueprint, request, session, jsonify, Response, make_response
from api.database import db
from api.utils.response import success_response, error_response
from bson import ObjectId, json_util
import json
from datetime import datetime, timedelta
import logging
import os
import hashlib
import secrets

data_mgmt_bp = Blueprint('data_management', __name__)
logger = logging.getLogger(__name__)

# Rate limiting for dangerous operations
DELETE_COOLDOWN_MINUTES = 5
_delete_attempts = {}  # In-memory rate limit (use Redis in production)

# Collections to export/import
COLLECTIONS_MAP = {
    'subjects': 'subjects',
    'attendance_logs': 'attendance_logs',
    'timetable': 'timetable',
    'semester_results': 'semester_results',
    'manual_courses': 'manual_courses',
    'user_preferences': 'user_preferences',
    'academic_records': 'academic_records',
    'skills': 'skills',
    # holidays? If user specific. The service has addHoliday so yes.
    'holidays': 'holidays'
}

@data_mgmt_bp.route('/export_data', methods=['GET'])
def export_data():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()

    try:
        export_payload = {
            'metadata': {
                'version': '1.0',
                'exported_at': datetime.utcnow().isoformat(),
                'source_email': user_email # For reference, avoiding sensitive data if shared
            },
            'data': {}
        }

        # Export User Profile (Generic info)
        user_doc = db.get_collection('users').find_one({'email': user_email}, {'password_hash': 0, '_id': 0, 'google_id': 0})
        if user_doc:
            export_payload['data']['user_profile'] = user_doc

        # Export Collections
        for key, coll_name in COLLECTIONS_MAP.items():
            # Check if holiday collection has owner_email (it usually does for user items)
            # Some might be global? Assuming structure follows owner_email pattern.
            items = list(db.get_collection(coll_name).find({'owner_email': user_email}))
            export_payload['data'][key] = json.loads(json_util.dumps(items))

        # Create JSON File Response
        response_json = json.dumps(export_payload, default=str)
        
        sanitized_email = user_email.replace('@', '_at_').replace('.', '_')
        filename = f"acadhub_export_{sanitized_email}_{datetime.now().strftime('%Y%m%d')}.json"
        
        response = make_response(response_json)
        response.headers["Content-Disposition"] = f"attachment; filename={filename}"
        response.headers["Content-Type"] = "application/json"
        return response

    except Exception as e:
        logger.error(f"Export Data Failed: {str(e)}")
        return error_response(f"Export failed: {str(e)}", "EXPORT_FAILED")

@data_mgmt_bp.route('/import_data', methods=['POST'])
def import_data():
    if 'user' not in session: return error_response("Unauthorized", "UNAUTHORIZED", 401)
    user_email = session['user']['email'].lower()
    
    import traceback
    
    try:
        data = request.json
        if not data or 'data' not in data:
            return error_response("Invalid import file format", "INVALID_FORMAT")

        import_data = data['data']
        id_map = {}

        # 1. Clear Existing Data
        for key, coll_name in COLLECTIONS_MAP.items():
            db.get_collection(coll_name).delete_many({'owner_email': user_email})

        # Helper: Recursive BSON restorer (Handles nested $oid, $date)
        def restore_bson_types(obj):
            if isinstance(obj, dict):
                # Check for $oid
                if '$oid' in obj: return ObjectId(obj['$oid'])
                # Check for $date
                if '$date' in obj:
                    val = obj['$date']
                    # Handle timestamp (int/long) or ISO string
                    if isinstance(val, (int, float)):
                        return datetime.utcfromtimestamp(val / 1000.0) # ms to s
                    elif isinstance(val, str):
                         # Try parsing ISO format
                         try: return datetime.fromisoformat(val.replace('Z', '+00:00'))
                         except: return val
                    return val
                
                return {k: restore_bson_types(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [restore_bson_types(i) for i in obj]
            return obj

        # Helper to Sanitize and Insert
        def sanitize_and_insert(collection_name, items):
            if not items: return
            
            clean_items = []
            for item in items:
                try:
                    # 1. Restore Native Types
                    native_item = restore_bson_types(item)
                    
                    # 2. Update Ownership
                    native_item['owner_email'] = user_email
                    
                    # 3. Remap IDs
                    if collection_name == 'subjects':
                        old_id = str(native_item.get('_id', ''))
                        new_id = ObjectId()
                        if old_id: id_map[old_id] = new_id
                        native_item['_id'] = new_id
                    
                    elif collection_name == 'attendance_logs':
                        sub_ref = native_item.get('subject_id')
                        if sub_ref:
                            sub_ref_str = str(sub_ref)
                            if sub_ref_str in id_map:
                                native_item['subject_id'] = id_map[sub_ref_str]
                        native_item['_id'] = ObjectId() 

                    else:
                        # Timetable Subject ID remapping
                        if collection_name == 'timetable' and 'schedule' in native_item:
                            schedule = native_item['schedule']
                            for day, slots in schedule.items():
                                for slot in slots:
                                    s_ref = slot.get('subjectId') or slot.get('subject_id')
                                    if s_ref and str(s_ref) in id_map:
                                        # Enforce snake_case 'subject_id' for consistency with frontend Timetable.tsx
                                        new_id = str(id_map[str(s_ref)])
                                        slot['subject_id'] = new_id
                                        
                                        # Remove camelCase if it existed to avoid confusion
                                        if 'subjectId' in slot:
                                            del slot['subjectId']
                        
                        native_item['_id'] = ObjectId()

                    clean_items.append(native_item)
                except Exception as e:
                    logger.error(f"Failed to process item in {collection_name}: {e}")
                    # Continue best effort

            if clean_items:
                try:
                    db.get_collection(collection_name).insert_many(clean_items)
                except Exception as e:
                    logger.error(f"Batch insert failed for {collection_name}: {e}")
                    raise e

        # 3. Execution Order (Subjects MUST be first to populate ID Map)
        # Import Subjects
        if 'subjects' in import_data:
            sanitize_and_insert('subjects', import_data['subjects'])
        
        # Import Others
        for key, coll_name in COLLECTIONS_MAP.items():
            if key == 'subjects': continue # Already done
            if key in import_data:
                sanitize_and_insert(coll_name, import_data[key])
        
        # Import Profile/Preferences (Update User Doc)
        if 'user_profile' in import_data:
            profile = import_data['user_profile']
            # Clean fields
            if '_id' in profile: del profile['_id']
            if 'email' in profile: del profile['email'] # Don't overwrite email
            if 'password_hash' in profile: del profile['password_hash']
            if 'biometrics' in profile: del profile['biometrics'] # Keep security credentials
            
            db.get_collection('users').update_one(
                {'email': user_email},
                {'$set': profile}
            )

        return success_response({"message": "Data imported successfully"})
        
    except Exception as e:
        logger.error(f"Import Data Failed: {str(e)}")
        # traceback.print_exc()


def _create_backup_before_delete(user_email):
    """Create automatic backup before deletion - saves to MongoDB backups collection"""
    try:
        backup_data = {
            'backup_type': 'pre_delete_auto',
            'owner_email': user_email,
            'created_at': datetime.utcnow(),
            'expires_at': datetime.utcnow() + timedelta(days=30),  # Keep for 30 days
            'data': {}
        }
        
        # Collect all user data
        for key, coll_name in COLLECTIONS_MAP.items():
            items = list(db.get_collection(coll_name).find({'owner_email': user_email}))
            backup_data['data'][key] = json.loads(json_util.dumps(items))
        
        # Also backup user profile
        user_doc = db.get_collection('users').find_one(
            {'email': user_email}, 
            {'password_hash': 0, 'google_id': 0}
        )
        if user_doc:
            backup_data['data']['user_profile'] = json.loads(json_util.dumps(user_doc))
        
        # Store in backups collection
        result = db.get_collection('user_backups').insert_one(backup_data)
        logger.info(f"📦 Auto-backup created for {user_email}: {result.inserted_id}")
        
        return str(result.inserted_id)
    except Exception as e:
        logger.error(f"❌ Backup creation failed for {user_email}: {e}")
        return None


def _check_delete_rate_limit(user_email):
    """Rate limit delete operations - max 1 per 5 minutes"""
    now = datetime.utcnow()
    
    if user_email in _delete_attempts:
        last_attempt = _delete_attempts[user_email]
        if now - last_attempt < timedelta(minutes=DELETE_COOLDOWN_MINUTES):
            remaining = DELETE_COOLDOWN_MINUTES - int((now - last_attempt).total_seconds() / 60)
            return False, remaining
    
    _delete_attempts[user_email] = now
    return True, 0


@data_mgmt_bp.route('/delete_all_data', methods=['DELETE'])
def delete_all_data():
    from flask import request as flask_request
    
    if 'user' not in session: 
        return error_response("Unauthorized", "UNAUTHORIZED", 401)
    
    user_email = session['user']['email'].lower()  # ✅ Ensure lowercase
    
    # 🔒 EXTRA SECURITY: Also check JWT token if present
    auth_header = flask_request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        try:
            import jwt
            import os
            token = auth_header.split(' ')[1]
            decoded = jwt.decode(token, os.environ.get('JWT_SECRET', 'dev-secret'), algorithms=['HS256'])
            jwt_email = decoded.get('email', '').lower()
            
            if jwt_email and jwt_email != user_email:
                logger.error(f"🚨 CRITICAL: JWT email ({jwt_email}) != Session email ({user_email})")
                return error_response(
                    "Security violation: Token email doesn't match session. Please re-login.",
                    "TOKEN_MISMATCH",
                    403
                )
        except Exception as jwt_error:
            logger.warning(f"JWT verification skipped: {jwt_error}")
    
    # 🔒 SECURITY: Verify the confirmation email matches session
    data = request.json or {}
    confirmation_email = data.get('confirmation_email', '').lower().strip()
    
    if confirmation_email and confirmation_email != user_email:
        logger.warning(f"⚠️ DELETE MISMATCH: Session={user_email}, Confirmation={confirmation_email}")
        return error_response(
            "Email mismatch. The confirmation email doesn't match your account.",
            "EMAIL_MISMATCH",
            403
        )
    
    # 🔒 SECURITY: Rate limiting
    can_proceed, wait_minutes = _check_delete_rate_limit(user_email)
    if not can_proceed:
        return error_response(
            f"Please wait {wait_minutes} more minutes before attempting to delete again.",
            "RATE_LIMITED",
            429
        )
    
    logger.warning(f"🚨 DELETE ALL DATA INITIATED for {user_email} from IP: {request.remote_addr}")
    
    collections_to_wipe = [
        'subjects', 'attendance_logs', 'timetable', 'semester_results', 
        'manual_courses', 'user_preferences', 'academic_records', 'skills', 
        'holidays', 'system_logs', 'notifications'
    ]
    
    deleted_summary = {}
    
    # 📦 STEP 1: Create automatic backup BEFORE deletion
    backup_id = _create_backup_before_delete(user_email)
    if not backup_id:
        logger.error(f"❌ Backup failed, aborting delete for {user_email}")
        return error_response(
            "Failed to create safety backup. Delete aborted for your protection.",
            "BACKUP_FAILED"
        )
    
    # 2. Reset User Profile fields
    try:
        profile_result = db.get_collection('users').update_one(
            {'email': user_email},
            {'$set': {
                'course': '',
                'college': '',
                'semester': 1,
                'batch': '',
                'picture': None
            }}
        )
        logger.info(f"✅ Profile reset for {user_email}: {profile_result.matched_count} matched")
    except Exception as e:
        logger.error(f"❌ Failed to reset profile {user_email}: {e}")
    
    # 3. Delete from collections - STRICT email filtering
    try:
        for coll_name in collections_to_wipe:
            # Double-check the query is for THIS user only
            query = {'owner_email': user_email}
            
            # Count before delete for verification
            count_before = db.get_collection(coll_name).count_documents(query)
            
            result = db.get_collection(coll_name).delete_many(query)
            deleted_summary[coll_name] = result.deleted_count
            
            # Verify counts match
            if result.deleted_count != count_before:
                logger.warning(f"⚠️ Count mismatch in {coll_name}: expected {count_before}, deleted {result.deleted_count}")
            
            logger.info(f"🗑️ Deleted {result.deleted_count} records from {coll_name} for {user_email}")
            
        logger.info(f"✅ User {user_email} wiped their data: {deleted_summary}")
        
        # Log the action (RE-INSERT after wipe)
        db.get_collection('system_logs').insert_one({
            'owner_email': user_email,
            'action': 'Account Reset',
            'description': f'All personal data deleted. Backup ID: {backup_id}. Summary: {deleted_summary}',
            'timestamp': datetime.utcnow(),
            'ip_address': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', 'Unknown')
        })
        
        return success_response({
            "message": "All data wiped successfully.",
            "backup_id": backup_id,
            "backup_expires": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "summary": deleted_summary
        })
    except Exception as e:
        logger.error(f"❌ Delete All Data Failed for {user_email}: {e}")
        import traceback
        traceback.print_exc()
        return error_response(f"Failed to delete data: {str(e)}", "DELETE_FAILED")


@data_mgmt_bp.route('/restore_backup/<backup_id>', methods=['POST'])
def restore_backup(backup_id):
    """Restore data from a backup"""
    if 'user' not in session: 
        return error_response("Unauthorized", "UNAUTHORIZED", 401)
    
    user_email = session['user']['email'].lower()
    
    try:
        # Find the backup
        backup = db.get_collection('user_backups').find_one({
            '_id': ObjectId(backup_id),
            'owner_email': user_email
        })
        
        if not backup:
            return error_response("Backup not found or access denied", "NOT_FOUND", 404)
        
        if backup.get('expires_at') and backup['expires_at'] < datetime.utcnow():
            return error_response("This backup has expired", "EXPIRED", 410)
        
        # Restore the data (similar to import)
        backup_data = backup.get('data', {})
        
        # Clear current data first
        for key, coll_name in COLLECTIONS_MAP.items():
            db.get_collection(coll_name).delete_many({'owner_email': user_email})
        
        # Restore from backup
        for key, coll_name in COLLECTIONS_MAP.items():
            if key in backup_data and backup_data[key]:
                items = backup_data[key]
                for item in items:
                    if isinstance(item, str):
                        item = json.loads(item)
                    # Restore BSON types
                    if '_id' in item and isinstance(item['_id'], dict) and '$oid' in item['_id']:
                        item['_id'] = ObjectId(item['_id']['$oid'])
                    else:
                        item['_id'] = ObjectId()
                    item['owner_email'] = user_email
                
                if items:
                    db.get_collection(coll_name).insert_many(items)
        
        logger.info(f"✅ Backup {backup_id} restored for {user_email}")
        
        return success_response({"message": "Backup restored successfully"})
        
    except Exception as e:
        logger.error(f"❌ Restore failed for {user_email}: {e}")
        import traceback
        traceback.print_exc()
        return error_response(f"Restore failed: {str(e)}", "RESTORE_FAILED")


@data_mgmt_bp.route('/backups', methods=['GET'])
def list_backups():
    """List available backups for the user"""
    if 'user' not in session: 
        return error_response("Unauthorized", "UNAUTHORIZED", 401)
    
    user_email = session['user']['email'].lower()
    
    try:
        backups = list(db.get_collection('user_backups').find(
            {'owner_email': user_email, 'expires_at': {'$gt': datetime.utcnow()}},
            {'data': 0}  # Don't return the actual data, just metadata
        ).sort('created_at', -1).limit(10))
        
        for b in backups:
            b['_id'] = str(b['_id'])
        
        return success_response({"backups": json.loads(json_util.dumps(backups))})
    except Exception as e:
        logger.error(f"❌ List backups failed: {e}")
        return error_response("Failed to list backups", "LIST_FAILED")
