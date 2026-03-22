# dev.py (local development only)

from run import app

if __name__ == '__main__':
    print("🚀 Starting BunkGuard Development Server...")
    print(f"📍 Visit: http://localhost:5000")
    print(f"🛑 Press Ctrl+C to stop")
    
    app.run(
        debug=True,
        host='0.0.0.0',
        port=5000
    )
