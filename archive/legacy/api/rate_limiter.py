from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Rate limiting for production use (50+ concurrent users)
# Create global limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["2000 per day", "500 per hour"],
    storage_uri="memory://",  # Use Redis in production for distributed systems
    strategy="fixed-window"
)

def init_limiter(app):
    """Initialize the limiter with the app"""
    limiter.init_app(app)
    return limiter

# Rate limit decorators with Burst Protection
# Format: "X per minute; Y per second" ensures robots can't fire 10 reqs in 1ms
STRICT_LIMIT = "10 per minute; 2 per second"      # Auth, sensitive operations
MODERATE_LIMIT = "30 per minute; 5 per second"    # Data mutations (POST/PUT/DELETE)
RELAXED_LIMIT = "300 per minute; 50 per second"   # Read operations (GET)
