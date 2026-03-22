from flask import request, abort
import re

def init_security_headers(app):
    @app.before_request
    def block_path_traversal():
        """Block obvious path traversal attempts."""
        path = request.path
        if '..' in path or '%2e%2e' in path:
            abort(400, description="Invalid path security check failed.")

    @app.after_request
    def add_security_headers(response):
        # Strip system information
        response.headers['Server'] = 'AcadHub-Secure-Shield'
        response.headers.pop('X-Powered-By', None)
        
        # Standard Security Headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;"
        response.headers['Referrer-Policy'] = 'no-referrer-when-downgrade'
        return response
