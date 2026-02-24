import re
import threading
from flask import Blueprint, jsonify, request
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from api.utils.response import success_response, error_response

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

# In-memory cache with background refresh
CACHE_TIMEOUT = 600  # 10 minutes (was 3600)
_notice_cache = {
    "data": [],
    "last_updated": None
}
_refresh_lock = threading.Lock()
_refreshing = False

def _background_refresh():
    """Refresh notices in a background thread so the main request isn't blocked."""
    global _refreshing
    try:
        notices = scrape_ipu_notices()
        if notices:
            _notice_cache["data"] = notices
            _notice_cache["last_updated"] = datetime.now()
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
    cache_expired = not _notice_cache["last_updated"] or (now - _notice_cache["last_updated"]).total_seconds() > CACHE_TIMEOUT

    if force_refresh or cache_expired:
        if _notice_cache["data"] and not force_refresh:
            # Serve stale data immediately, refresh in background
            with _refresh_lock:
                if not _refreshing:
                    _refreshing = True
                    threading.Thread(target=_background_refresh, daemon=True).start()
        else:
            # Cold start or force — fetch with hard timeout to avoid Vercel 504
            print("Fetching fresh notices via scraper (cold start)...")
            result = [None]
            def _fetch():
                try:
                    result[0] = scrape_ipu_notices()
                except Exception as e:
                    print(f"Scraper fetch failed: {e}")
            
            t = threading.Thread(target=_fetch, daemon=True)
            t.start()
            t.join(timeout=6)  # Hard 6s ceiling — Vercel has 30s limit
            
            if result[0]:
                _notice_cache["data"] = result[0]
                _notice_cache["last_updated"] = now
            else:
                print("Scraper timed out or returned empty — serving empty response")
    
    notices = _notice_cache["data"]
    
    if category_filter:
        notices = [n for n in notices if n.get('category') == category_filter]
        
    return success_response(notices)

@scraper_bp.route('/stats', methods=['GET'])
def get_notice_stats():
    # Use cached data if available, don't re-scrape
    notices = _notice_cache["data"] if _notice_cache["data"] else scrape_ipu_notices()
    stats = {}
    for n in notices:
        cat = n.get('category', 'General')
        stats[cat] = stats.get(cat, 0) + 1
    return success_response(stats)

def scrape_ipu_notices():
    url = "http://www.ipu.ac.in/notices.php"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        notices = []
        
        # Try to find the main notice table first for better accuracy
        # The IPU site often uses multiple nested tables
        links = []
        
        # Priority 1: Specifically targeted areas
        notice_container = soup.find('div', id='content') or soup.find('div', class_='content')
        if notice_container:
            links = notice_container.find_all('a', href=True)
            
        # Priority 2: Tables that look like they contain notices (often have many rows)
        if not links:
            for table in soup.find_all('table'):
                row_count = len(table.find_all('tr'))
                if row_count > 10:
                    links = table.find_all('a', href=True)
                    if links: break
        
        # Fallback 3: All links (original strategy)
        if not links:
            links = soup.find_all('a', href=True)
        
        notice_count = 0
        for link in links:
            if notice_count >= 50: # Increased for better categorization coverage
                break
                
            title = link.get_text(strip=True)
            href = link.get('href', '')
            
            if not href or not title or len(title) < 5:
                continue
            
            if not any(keyword in href.lower() for keyword in ['pdf', 'notice', 'upload', 'download', '.php']):
                continue
                
            if not href.startswith('http'):
                href = f"http://www.ipu.ac.in/{href.lstrip('/')}"
            
            date_str = datetime.now().strftime("%Y-%m-%d")
            
            # Improved date extraction
            try:
                # 1. Look in the same table row
                row = link.find_parent('tr')
                if row:
                    cols = row.find_all('td')
                    for col in cols:
                        text = col.get_text(strip=True)
                        # Look for date patterns: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
                        # Or even just numbers with separators
                        match = re.search(r'(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2,4})', text)
                        if match:
                            date_str = match.group(0)
                            break
                
                # 2. Look in the text itself if not found
                if date_str == datetime.now().strftime("%Y-%m-%d"):
                    match = re.search(r'(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2,4})', title)
                    if match:
                        date_str = match.group(0)
                
                # 3. Look at preceding/following elements lightly
                if date_str == datetime.now().strftime("%Y-%m-%d"):
                    prev_text = link.find_previous(string=True)
                    if prev_text:
                        match = re.search(r'(\d{1,2})[-/\.](\d{1,2})[-/\.](\d{2,4})', prev_text)
                        if match:
                            date_str = match.group(0)
            except:
                pass

            notices.append({
                "title": title[:250],
                "link": href,
                "date": date_str,
                "category": categorize_notice(title)
            })
            notice_count += 1
            
        return notices if notices else []

    except Exception as e:
        print(f"Scraper Error: {e}")
        return []
