from flask import request, session
from api.database import db
from datetime import datetime

def init_activity_logger(app):
    @app.before_request
    def log_activity():
        # Only log API requests and ignore static/assets
        if not request.path.startswith('/api'):
            return
            
        user = session.get('user')
        user_email = user.get('email') if user else 'anonymous'
        
        log_entry = {
            "user_email": user_email,
            "method": request.method,
            "path": request.path,
            "ip": request.remote_addr,
            "timestamp": datetime.utcnow(),
            "user_agent": request.user_agent.string
        }
        
        # Optional: Log to DB asynchronously if possible, or just insert for now
        try:
            db.get_collection('activity_logs').insert_one(log_entry)
        except:
            pass # Don't block request on logging failure
