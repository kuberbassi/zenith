# api/decorators.py

import os
import jwt
from functools import wraps
from flask import request, session, jsonify, g

def require_auth(f):
    """
    Unified authentication decorator supporting both:
    - Session-based auth (web, cookies)
    - JWT token auth (mobile, Authorization header)
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_email = None
        
        # 1. Check for JWT token in Authorization header (Mobile)
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            try:
                payload = jwt.decode(
                    token,
                    os.getenv('FLASK_SECRET_KEY', 'dev-secret-key'),
                    algorithms=['HS256']
                )
                user_email = payload.get('email')
                # Store in Flask's request-scoped `g` object for use in route
                g.user_email = user_email
                g.auth_method = 'jwt'
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "Token expired"}), 401
            except jwt.InvalidTokenError as e:
                print(f"Invalid JWT: {e}")
                return jsonify({"error": "Invalid token"}), 401
        
        # 2. Fallback to session-based auth (Web)
        elif 'user' in session:
            user_email = session['user']['email']
            g.user_email = user_email
            g.auth_method = 'session'
        
        # 3. No valid authentication found
        if not user_email:
            return jsonify({"error": "Unauthorized"}), 401
        
        return f(*args, **kwargs)
    
    return decorated_function
