import re
import threading
from flask import Blueprint, jsonify, request
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from api.utils.response import success_response, error_response
from api.database import db

scraper_bp = Blueprint('scraper', __name__)

CATEGORY_MAP = {
    "Exam": ["exam", "datesheet", "examination", "viva", "theory", "practical"],
    "Admission": ["admission", "counseling", "seat", "cet", "cutoff"],
    "Result": ["result", "grade", "marks", "declared"],
    "Holiday": ["holiday", "closed", "break", "vacation"],
    "Placement": ["placement", "job", "recruitment", "drive", "interview", "career"],
    "Fee": ["fee", "payment", "challan", "dues", "scholarship"],
    "Hostel": ["hostel", "mess", "accommodation"],
    "Campus Event": ["event", "seminar", "workshop", "festival", "cult", "competition"],
    "COVID": ["covid", "vaccination", "mask", "pandemic"]
}

def categorize_notice(title):
    title_lower = title.lower()
    for cat, keywords in CATEGORY_MAP.items():
        if any(kw in title_lower for kw in keywords):
            return cat
    return "General"

# ── Persistent cache via MongoDB ──────────────────────────────────
# In-memory cache is just a fast layer; MongoDB is the durable store.
# On cold start, we load from MongoDB instantly (~200ms) instead of
# scraping ipu.ac.in (~5-10s or timeout).
CACHE_TIMEOUT = 600  # 10 minutes
_notice_cache = {
    "data": [],
    "last_updated": None
}
_refresh_lock = threading.Lock()
_refreshing = False

CACHE_COLLECTION = 'notice_cache'
CACHE_DOC_ID = 'ipu_notices'

def _load_from_mongo():
    """Load cached notices from MongoDB (survives Vercel cold starts)."""
    try:
        doc = db.get_collection(CACHE_COLLECTION).find_one({"_id": CACHE_DOC_ID})
        if doc and doc.get("notices"):
            _notice_cache["data"] = doc["notices"]
            _notice_cache["last_updated"] = doc.get("updated_at", datetime.now())
            print(f"✅ Loaded {len(doc['notices'])} notices from MongoDB cache")
            return True
    except Exception as e:
        print(f"⚠️ MongoDB cache load failed: {e}")
    return False

def _save_to_mongo(notices):
    """Persist notices to MongoDB so next cold start is instant."""
    try:
        db.get_collection(CACHE_COLLECTION).update_one(
            {"_id": CACHE_DOC_ID},
            {"$set": {
                "notices": notices,
                "updated_at": datetime.now(),
                "count": len(notices)
            }},
            upsert=True
        )
    except Exception as e:
        print(f"⚠️ MongoDB cache save failed: {e}")

def _background_refresh():
    """Refresh notices in background, persist to MongoDB."""
    global _refreshing
    try:
        notices = scrape_ipu_notices()
        if notices:
            _notice_cache["data"] = notices
            _notice_cache["last_updated"] = datetime.now()
            _save_to_mongo(notices)
            print(f"✅ Background refresh done — {len(notices)} notices saved")
    except Exception as e:
        print(f"Background scraper refresh failed: {e}")
    finally:
        with _refresh_lock:
            _refreshing = False

@scraper_bp.route('/notices', methods=['GET'])
def get_notices():
    global _refreshing
    category_filter = request.args.get('category')
    force_refresh = request.args.get('force') == 'true'
    
    now = datetime.now()

    # Cold start: memory is empty → load from MongoDB first
    if not _notice_cache["data"]:
        _load_from_mongo()

    cache_expired = not _notice_cache["last_updated"] or (now - _notice_cache["last_updated"]).total_seconds() > CACHE_TIMEOUT

    if force_refresh or cache_expired:
        # Always kick off background refresh — never block the response
        with _refresh_lock:
            if not _refreshing:
                _refreshing = True
                threading.Thread(target=_background_refresh, daemon=True).start()

        # If still no data after trying MongoDB, do a quick inline fetch
        if not _notice_cache["data"]:
            print("Cold start with empty MongoDB — inline fetch with 5s ceiling")
            result = [None]
            def _fetch():
                try:
                    result[0] = scrape_ipu_notices()
                except Exception as e:
                    print(f"Inline scraper fetch failed: {e}")
            
            t = threading.Thread(target=_fetch, daemon=True)
            t.start()
            t.join(timeout=5)
            
            if result[0]:
                _notice_cache["data"] = result[0]
                _notice_cache["last_updated"] = now
                _save_to_mongo(result[0])
    
    notices = _notice_cache["data"]
    
    if category_filter:
        notices = [n for n in notices if n.get('category') == category_filter]
        
    return success_response(notices)

@scraper_bp.route('/stats', methods=['GET'])
def get_notice_stats():
    # Use cached data — load from mongo if memory is empty
    if not _notice_cache["data"]:
        _load_from_mongo()
    notices = _notice_cache["data"]
    if not notices:
        notices = scrape_ipu_notices() or []
    stats = {}
    for n in notices:
        cat = n.get('category', 'General')
        stats[cat] = stats.get(cat, 0) + 1
    return success_response(stats)

def scrape_ipu_notices():
    """Optimized hybrid Regex + BS4 scraper for the 4MB IPU notices page."""
    url = "http://www.ipu.ac.in/notices.php"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        # Increase timeout slightly as the page is huge
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        # Use regex to find table rows — extremely fast even on 4MB
        row_pattern = re.compile(r'<tr[^>]*>(.*?)</tr>', re.IGNORECASE | re.DOTALL)
        rows = list(row_pattern.finditer(response.text))
        
        notices = []
        # Process first 150 rows (typically contains last 2-3 months of notices)
        for row_match in rows[:150]:
            try:
                row_html = row_match.group(1)
                row_soup = BeautifulSoup(row_html, 'html.parser')
                
                link = row_soup.find('a', href=True)
                if not link:
                    continue
                    
                title = link.get_text(strip=True)
                href = link.get('href', '').strip()
                
                # Validation
                if not title or len(title) < 5:
                    continue
                
                href_lower = href.lower()
                # Ensure it looks like a document/notice
                if not any(kw in href_lower for kw in ['.pdf', 'notice', 'upload', 'circular', 'download', 'order', 'datesheet']):
                    continue
                
                # Fix relative URLs
                if not href.startswith('http'):
                    href = f"http://www.ipu.ac.in/{href.lstrip('/')}"
                
                # Extract date from other cells in the same row
                date_str = None
                cols = row_soup.find_all('td')
                for col in cols:
                    col_text = col.get_text(strip=True)
                    # Look for DD-MM-YYYY or similar patterns
                    date_match = re.search(r'(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2,4})', col_text)
                    if date_match:
                        date_str = date_match.group(0)
                        break
                
                if not date_str:
                    # Fallback 1: search in title
                    date_match = re.search(r'(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2,4})', title)
                    if date_match:
                        date_str = date_match.group(0)
                    else:
                        # Fallback 2: search in filename (e.g. nt240226)
                        # IPU puts dates like YYMMDD or DDMMYY in filename
                        date_match = re.search(r'(\d{2})(\d{2})(\d{2})', href)
                        if date_match:
                            d, m, y = date_match.groups()
                            # Basic heuristic: if d > 31, it's probably yymmdd
                            if int(d) > 31: 
                                date_str = f"{y}-{m}-20{d}"
                            else:
                                date_str = f"{d}-{m}-20{y}"
                
                notices.append({
                    "title": title[:250],
                    "link": href,
                    "date": date_str or datetime.now().strftime("%d-%m-%Y"),
                    "category": categorize_notice(title)
                })
            except Exception as row_err:
                print(f"Skipping row due to error: {row_err}")
                continue
                
        return notices if notices else []

    except Exception as e:
        print(f"Scraper Error: {e}")
        return []
