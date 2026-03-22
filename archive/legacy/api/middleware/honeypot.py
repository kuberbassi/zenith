from flask import request, abort
from functools import wraps
from api.database import db
from datetime import datetime
import ipaddress

# Paths that are commonly targeted by bots/scanners
HONEYPOT_PATHS = {
    '/phpmyadmin', '/wp-admin', '/.env', '/config.php', '/config.py',
    '/admin/config.php', '/admin/.env', '/backup', '/backup.zip',
    '/.git/config', '/api/.env', '/api/config.py', '/cgi-bin'
}

def init_honeypot(app):
    """
    Initializes a honeypot middleware.
    Any IP accessing a honeypot path is blacklisted.
    """
    
    @app.before_request
    def check_honeypot():
        # 1. Check if IP is already blacklisted
        client_ip = request.remote_addr
        # Check against Redis/MongoDB (using MongoDB for persistence here)
        blacklist_col = db.get_collection('ip_blacklist')
        is_blocked = blacklist_col.find_one({'ip': client_ip})
        
        if is_blocked:
            abort(403, description="Access Denied: Network Security Violation Detected.")

        # 2. Check if current path is a honeypot path
        # Normalize path
        path = request.path.lower()
        if any(path.startswith(hp) for hp in HONEYPOT_PATHS):
            # Log violation
            db.get_collection('system_logs').insert_one({
                'action': 'HONEYPOT_HIT',
                'ip': client_ip,
                'path': path,
                'user_agent': request.headers.get('User-Agent'),
                'timestamp': datetime.utcnow(),
                'severity': 'CRITICAL'
            })
            
            # Blacklist for 24 hours
            blacklist_col.update_one(
                {'ip': client_ip},
                {'$set': {
                    'ip': client_ip,
                    'reason': 'Honeypot violation',
                    'timestamp': datetime.utcnow()
                }},
                upsert=True
            )
            
            abort(403, description="Access Denied: Network Security Violation Detected.")

    return app
