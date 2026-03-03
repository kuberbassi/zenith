# run.py (complete version with dev server)

import os
import sys

# Fix Windows console encoding for emoji/unicode output
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

from api import create_app

# Create the app instance
app = create_app()
from api import socketio

# Run the development server
if __name__ == '__main__':
    import os
    is_dev = os.getenv('FLASK_ENV', 'production') == 'development'
    
    print("🚀 Starting AcadHub Flask Server...")
    print(f"📍 Server running at: http://localhost:5000")
    print(f"🔧 Mode: {'Development' if is_dev else 'Production'}")
    print(f"🛑 Press Ctrl+C to stop")
    
    # Start Background Worker (Notification Polling)
    # Background worker removed as Classroom integration is disabled

    socketio.run(
        app,
        debug=is_dev,
        host='0.0.0.0',
        port=5000,
        use_reloader=is_dev,
        log_output=True,
        allow_unsafe_werkzeug=is_dev
    )
