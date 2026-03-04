import os
import sys

# Ensure the parent directory (project root) is in sys.path
# This allows Python to find the 'api' package
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)

# Add parent to the beginning of sys.path if not already there
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Now import the app factory from the api package
from api import create_app

app = create_app()

# For local testing with Flask dev server
if __name__ == '__main__':
    import os
    is_dev = os.getenv('FLASK_ENV', 'production') == 'development'
    app.run(debug=is_dev, host='0.0.0.0', port=5000)
