# Security Middleware for AcadHub

from flask import request, jsonify
from functools import wraps
from datetime import datetime, timedelta
import hashlib
import hmac
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

class SecurityMiddleware:
    """Security & validation middleware"""
    
    # Rate limits for different endpoints
    RATE_LIMITS = {
        'auth': '10 per minute',
        'api': '100 per minute',
        'export': '5 per hour',
        'admin': '20 per minute'
    }
    
    @staticmethod
    def validate_input(data: dict, schema: dict) -> tuple[bool, str]:
        """
        Validate input against schema
        Args:
            data: Request data to validate
            schema: {'field': {'type': str, 'required': True, 'max_length': 100}}
        Returns:
            (is_valid, error_message)
        """
        for field, rules in schema.items():
            if field not in data:
                if rules.get('required', False):
                    return False, f"Missing required field: {field}"
                continue
            
            value = data[field]
            
            # Type validation
            expected_type = rules.get('type')
            if expected_type and not isinstance(value, expected_type):
                return False, f"Invalid type for {field}: expected {expected_type.__name__}"
            
            # Length validation
            if isinstance(value, str):
                max_len = rules.get('max_length')
                if max_len and len(value) > max_len:
                    return False, f"Field {field} exceeds max length of {max_len}"
            
            # Custom validation
            validator = rules.get('validator')
            if validator and not validator(value):
                return False, f"Invalid value for {field}"
        
        return True, ""
    
    @staticmethod
    def sanitize_input(data: dict) -> dict:
        """Remove dangerous characters from input"""
        sanitized = {}
        for key, value in data.items():
            if isinstance(value, str):
                # Remove SQL injection attempts
                value = value.replace("'", "").replace('"', "").replace(";", "")
                # Remove XSS attempts
                value = value.replace("<", "&lt;").replace(">", "&gt;")
            sanitized[key] = value
        return sanitized
    
    @staticmethod
    def verify_request_signature(request_data: bytes, signature: str, secret: str) -> bool:
        """Verify HMAC signature for request integrity"""
        expected_signature = hmac.new(
            secret.encode(),
            request_data,
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    
    @staticmethod
    def create_request_signature(request_data: bytes, secret: str) -> str:
        """Create HMAC signature for response"""
        return hmac.new(
            secret.encode(),
            request_data,
            hashlib.sha256
        ).hexdigest()


def require_rate_limit(endpoint_type='api'):
    """Decorator for rate limiting endpoints"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            limit = SecurityMiddleware.RATE_LIMITS.get(endpoint_type, '100 per minute')
            limiter.limit(limit)(f)
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_admin(f):
    """Decorator to require admin access"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask import session
        if not session.get('is_admin'):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function


def log_audit(action: str, description: str = ""):
    """Decorator to log all admin/sensitive actions"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from flask import session
            from api.models import db, AuditLog
            
            user_email = session.get('email', 'unknown')
            
            # Log before action
            AuditLog(
                owner_email=user_email,
                action=action,
                description=description,
                timestamp=datetime.utcnow(),
                status='initiated'
            ).save()
            
            # Execute action
            try:
                result = f(*args, **kwargs)
                
                # Log success
                audit = AuditLog.objects(
                    owner_email=user_email,
                    action=action
                ).order_by('-timestamp').first()
                if audit:
                    audit.status = 'success'
                    audit.save()
                
                return result
            except Exception as e:
                # Log failure
                audit = AuditLog.objects(
                    owner_email=user_email,
                    action=action
                ).order_by('-timestamp').first()
                if audit:
                    audit.status = 'failed'
                    audit.error_message = str(e)
                    audit.save()
                raise
        
        return decorated_function
    return decorator
