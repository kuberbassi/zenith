import os
import requests
from flask import Blueprint, redirect, url_for, session, request, jsonify
from authlib.integrations.flask_client import OAuth
from urllib.parse import urlencode, quote_plus
from bson import ObjectId
import jwt
from datetime import datetime, timedelta
from api.database import db
import time
from functools import wraps

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login')
def login():
    """Shell login route to satisfy url_for('auth.login') and prevent BuildErrors"""
    return redirect('/')

# This will be initialized in our main __init__.py
oauth = OAuth()

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        
        user_email = session['user'].get('email')
        user = db.get_collection('users').find_one({"email": user_email})
        
        if not user or user.get('role') != 'admin':
            return jsonify({"error": "Forbidden: Admin access required"}), 403
            
        return f(*args, **kwargs)
    return decorated_function

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function

@auth_bp.route('/google', methods=['POST'])
def google_auth():
    data = request.json
    code = data.get('code')
    
    if not code:
        return jsonify({"error": "No authorization code provided"}), 400
        
    try:
        if db is None:
            return jsonify({"error": "Database connection failed"}), 500

        users_collection = db.get_collection('users')
        
        # 1. Exchange code for tokens
        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uri": data.get('redirect_uri', "postmessage"),
            "grant_type": "authorization_code"
        }
        
        token_resp = requests.post(token_url, data=token_data)
        
        if token_resp.status_code != 200:
            error_details = token_resp.json() if token_resp.headers.get('content-type') == 'application/json' else token_resp.text
            print(f"❌ Token exchange failed for client {os.getenv('GOOGLE_CLIENT_ID')[:10]}...: {error_details}")
            return jsonify({
                "error": "Failed to exchange token",
                "details": error_details,
                "client_id_used": os.getenv("GOOGLE_CLIENT_ID")[:15] + "..."
            }), 401
            
        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3599)
        
        if not access_token:
            return jsonify({"error": "No access token received"}), 401
            
        # 2. Get user info from Google
        userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        headers = {"Authorization": f"Bearer {access_token}"}
        userinfo_resp = requests.get(userinfo_url, headers=headers)
        
        if userinfo_resp.status_code != 200:
            return jsonify({"error": "Failed to fetch user info"}), 401
            
        user_info = userinfo_resp.json()
        email = user_info["email"].lower()  # ✅ Normalized to lowercase
        
        # 3. Fetch existing user to preserve custom PFP
        existing_user = users_collection.find_one({"email": email})
        
        # Hardcoded admin for the developer
        role = "student"
        if user_info["email"] == "kuberbassi@gmail.com": # Designated primary admin
            role = "admin"
        elif existing_user and "role" in existing_user:
            role = existing_user["role"]

        user_data = {
            "email": email,
            "name": user_info.get("name"),
            "google_id": user_info.get("id"),
            "last_login": datetime.utcnow(),
            "role": role,
            "google_token": access_token if access_token else None,
            "google_refresh_token": refresh_token if refresh_token else None,
            "token_expiry": datetime.utcnow() + timedelta(seconds=expires_in)
        }
        
        # Only set Google picture if user doesn't have one or it's a Google URL (not base64)
        current_pic = existing_user.get("picture") if existing_user else None
        if not current_pic or not current_pic.startswith("data:image/"):
            user_data["picture"] = user_info.get("picture")
        else:
            # Keep existing custom picture
            user_data["picture"] = current_pic
 
        users_collection.update_one(
            {"email": email},
            {"$set": user_data},
            upsert=True
        )
        
        # Refresh user object after upsert
        db_user = users_collection.find_one({"email": email})
        
        if not db_user:
            return jsonify({"error": "Failed to retrieve user after registration"}), 500
            
        # 4. Generate JWT for mobile/API usage
        token_payload = {
            'email': db_user['email'],
            'name': db_user.get('name', 'User'),
            'exp': datetime.utcnow() + timedelta(days=7),
            'iat': datetime.utcnow()
        }
        
        try:
            jwt_token = jwt.encode(
                token_payload,
                os.getenv('FLASK_SECRET_KEY', 'dev-secret-key'),
                algorithm='HS256'
            )
            # PyJWT 2.0+ returns str, but handle bytes just in case of environment mismatch
            if isinstance(jwt_token, bytes):
                jwt_token = jwt_token.decode('utf-8')
        except Exception as e:
            print(f"❌ JWT Encoding Error: {e}")
            return jsonify({"error": "Failed to generate security token"}), 500
            
        # 5. Also set session for web compatibility
        # Update: Store tokens INSIDE user dict for Classroom API compatibility
        
        # Avoid storing Base64 images in session
        session_picture = db_user.get('picture')
        if session_picture and session_picture.startswith('data:image'):
            session_picture = None # Fetch from API instead
            
        session['user'] = {
            'email': db_user['email'].lower(),  # ✅ Store lowercased email
            'name': db_user.get('name'),
            'picture': session_picture,
            'google_token': access_token,
            'google_refresh_token': refresh_token,
            'google_token_expiry': time.time() + expires_in
        }
        
        # Keep legacy session keys just in case other parts use them
        session['google_access_token'] = access_token
        if refresh_token:
            session['google_refresh_token'] = refresh_token
        
        # Convert non-serializable objects (ObjectId, datetime) to strings
        # Create a copy to avoid mutating the cursor result
        user_data = dict(db_user)
        
        if '_id' in user_data:
            user_data['_id'] = str(user_data['_id'])
        
        # Remove large fields to prevent session bloat and huge responses
        # These should be fetched separately via dedicated endpoints
        fields_to_exclude = ['subjects', 'timetable', 'assignments', 'profile_image', 'notifications']
        for field in fields_to_exclude:
            user_data.pop(field, None)  # Use pop with default to avoid KeyError
        
        if 'last_login' in user_data and isinstance(user_data['last_login'], datetime):
            user_data['last_login'] = user_data['last_login'].isoformat()
        if 'created_at' in user_data and isinstance(user_data['created_at'], datetime):
            user_data['created_at'] = user_data['created_at'].isoformat()
        if 'token_expiry' in user_data and isinstance(user_data['token_expiry'], datetime):
            user_data['token_expiry'] = user_data['token_expiry'].isoformat()

        return jsonify({
            "token": jwt_token,
            "user": user_data
        }), 200
        
    except Exception as e:
        import traceback
        error_msg = f"Error in google_auth: {str(e)}"
        print(f"❌ {error_msg}")
        traceback.print_exc()
        return jsonify({
            "error": "Internal Server Error during Google Auth",
            "details": str(e) if not os.getenv('VERCEL') else "Check server logs"
        }), 500

@auth_bp.route('/logout', methods=['POST', 'GET'])
def logout():
    try:
        session.clear()
        
        if request.method == 'POST':
            return jsonify({"message": "Logged out successfully"}), 200
        
        domain = os.getenv('AUTH0_DOMAIN')
        client_id = os.getenv('AUTH0_CLIENT_ID')
        return_to = url_for("auth.login", _external=True)
        logout_url = f"https://{domain}/v2/logout?{urlencode({'returnTo': return_to, 'client_id': client_id}, quote_via=quote_plus)}"
        return redirect(logout_url)
        
    except Exception as e:
        print(f"Error in logout: {e}")
        return jsonify({"error": str(e)}), 500

# DEV/TESTING ONLY - Remove in production
@auth_bp.route('/dev_login', methods=['POST'])
def dev_login():
    """Generate a valid JWT token for testing without OAuth"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400
            
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON body"}), 400
            
        email = data.get('email', '').lower()  # ✅ Normalized to lowercase with safety check
        
        if not email:
            return jsonify({"error": "Email required"}), 400
            
        if db is None:
            print("❌ Dev Login Error: Database connection is None")
            return jsonify({"error": "Database not connected"}), 500
            
        users_collection = db.get_collection('users')
        user = users_collection.find_one({"email": email})
        
        # Auto-create user if doesn't exist (dev mode convenience)
        if not user:
            print(f"📝 Dev Login: Creating new user for {email}")
            user_data = {
                "email": email,
                "name": email.split('@')[0].title(),
                "picture": None,
                "created_via": "dev_login"
            }
            users_collection.insert_one(user_data)
            user = user_data
            
        # Generate JWT token
        token_payload = {
            'email': user['email'],
            'exp': datetime.utcnow() + timedelta(days=7),
            'iat': datetime.utcnow()
        }
        
        token = jwt.encode(
            token_payload,
            os.getenv('FLASK_SECRET_KEY', 'dev-secret-key'),
            algorithm='HS256'
        )
        
        # PyJWT < 2.0 returns bytes, >= 2.0 returns string
        if isinstance(token, bytes):
            token = token.decode('utf-8')
        
        user_data = {
            'email': user['email'],
            'name': user.get('name', 'User'),
            'picture': user.get('picture')
        }
        
        print(f"✅ Dev Login successful for {email}")
        return jsonify({
            "token": token,
            "user": user_data
        }), 200
        
    except Exception as e:
        print(f"Dev login error: {e}")
        return jsonify({"error": str(e)}), 500