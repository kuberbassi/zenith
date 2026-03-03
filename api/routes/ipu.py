import base64
import io
import re
import traceback
from flask import Blueprint, session, request
from api.utils.response import success_response, error_response
import requests
from bs4 import BeautifulSoup
import logging

try:
    from PIL import Image, ImageFilter, ImageEnhance
    import pytesseract
    _OCR_AVAILABLE = True
except ImportError:
    _OCR_AVAILABLE = False

logger = logging.getLogger(__name__)

ipu_bp = Blueprint('ipu', __name__)

IPU_BASE = 'https://examweb.ggsipu.ac.in'
IPU_LOGIN_URL = f'{IPU_BASE}/web/login.jsp'
IPU_LOGIN_ACTION = f'{IPU_BASE}/web/loginaction.do'
IPU_HOME_URL = f'{IPU_BASE}/web/student/studenthome.jsp'
IPU_RESULT_URL = f'{IPU_BASE}/web/newStudentDashboard.jsp'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
}

# ─── In-memory session store (per user) ────────────────────────────────────────
_ipu_sessions: dict[str, requests.Session] = {}  # user_email ➝ requests.Session


def _get_ipu_session(user_email: str) -> requests.Session:
    """Return existing or create new requests.Session for this user."""
    if user_email not in _ipu_sessions:
        s = requests.Session()
        s.headers.update(HEADERS)
        _ipu_sessions[user_email] = s
    return _ipu_sessions[user_email]


# ─── GET /api/ipu/captcha ───────────────────────────────────────────────────────
@ipu_bp.route('/captcha', methods=['GET'])
def get_captcha():
    """
    Fetch the IPU login page, extract the CAPTCHA image, return it as base64.
    This also seeds the session cookies needed for the actual login POST.
    """
    if 'user' not in session:
        return error_response('Unauthorized', 'UNAUTHORIZED', 401)

    user_email = session['user']['email'].lower()
    ipu_sess = _get_ipu_session(user_email)

    try:
        # 1️⃣ Fetch login page to grab session cookies + detect CAPTCHA url
        resp = ipu_sess.get(IPU_LOGIN_URL, timeout=15, verify=False)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, 'html.parser')

        # Find captcha <img> tag — common patterns used by JSP portals
        captcha_img = (
            soup.find('img', {'id': 'captchaImage'}) or
            soup.find('img', {'id': 'captcha'}) or
            soup.find('img', {'class': re.compile(r'captcha', re.I)}) or
            soup.find('img', src=re.compile(r'captcha', re.I)) or
            soup.find('img', src=re.compile(r'kaptcha', re.I))
        )

        if not captcha_img:
            # Try to find any img under a security check section
            security = soup.find(string=re.compile(r'security\s*check', re.I))
            if security:
                container = security.find_parent(['div', 'td', 'tr'])
                if container:
                    captcha_img = container.find('img')

        if not captcha_img:
            return error_response('Could not locate CAPTCHA image on the IPU login page.', 'CAPTCHA_NOT_FOUND', 422)

        captcha_src = captcha_img.get('src', '')
        if not captcha_src.startswith('http'):
            captcha_src = IPU_BASE + ('/' if not captcha_src.startswith('/') else '') + captcha_src

        # 2️⃣ Download the CAPTCHA image bytes
        img_resp = ipu_sess.get(captcha_src, timeout=10, verify=False)
        img_resp.raise_for_status()
        img_b64 = base64.b64encode(img_resp.content).decode()
        content_type = img_resp.headers.get('Content-Type', 'image/jpeg')

        # 3️⃣ Extract hidden form fields (viewstate, tokens, etc.)
        hidden_fields = {}
        form = soup.find('form', {'action': re.compile(r'login', re.I)}) or soup.find('form')
        if form:
            for inp in form.find_all('input', {'type': 'hidden'}):
                name = inp.get('name')
                value = inp.get('value', '')
                if name:
                    hidden_fields[name] = value

        # 4️⃣ Detect field names for username / password / captcha
        username_field = _detect_field(form, ['username', 'j_username', 'userId', 'user_name', 'loginId'])
        password_field = _detect_field(form, ['password', 'j_password', 'passwd', 'pass'])
        captcha_field  = _detect_field(form, ['captcha', 'captchaValue', 'vcaptcha', 'kaptcha', 'captchaCode', 'securityCode'])

        return success_response({
            'captcha_image': f'data:{content_type};base64,{img_b64}',
            'hidden_fields': hidden_fields,
            'field_names': {
                'username': username_field or 'j_username',
                'password': password_field or 'j_password',
                'captcha':  captcha_field  or 'captcha',
            }
        })

    except requests.exceptions.RequestException as e:
        logger.error(f'IPU captcha fetch error: {e}')
        return error_response(f'Failed to connect to IPU portal: {str(e)}', 'NETWORK_ERROR', 502)
    except Exception as e:
        logger.error(f'IPU captcha general error: {e}')
        traceback.print_exc()
        return error_response(f'Unexpected error: {str(e)}', 'INTERNAL_ERROR', 500)


def _detect_field(form, candidates: list[str]) -> str | None:
    """Find the first matching form field name among candidates."""
    if not form:
        return None
    for name in candidates:
        inp = form.find('input', {'name': re.compile(name, re.I)})
        if inp:
            return inp['name']
    return None


def _auto_solve_captcha(img_bytes: bytes) -> str:
    """
    Use pytesseract OCR to auto-solve the GGSIPU CAPTCHA image.
    Returns the solved text (stripped, uppercase).
    Raises RuntimeError if OCR is not available or fails.
    """
    if not _OCR_AVAILABLE:
        raise RuntimeError('pytesseract/Pillow not installed')

    img = Image.open(io.BytesIO(img_bytes)).convert('L')  # grayscale

    # Upscale for better OCR accuracy
    w, h = img.size
    img = img.resize((w * 3, h * 3), Image.LANCZOS)

    # Sharpen + increase contrast
    img = ImageEnhance.Contrast(img).enhance(2.5)
    img = img.filter(ImageFilter.SHARPEN)

    # Binarise with a fixed threshold (GGSIPU captcha is dark text on light bg)
    img = img.point(lambda p: 0 if p < 140 else 255, '1')

    custom_config = r'--oem 3 --psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    text = pytesseract.image_to_string(img, config=custom_config)
    solved = re.sub(r'\s+', '', text).strip()
    if not solved:
        raise ValueError('OCR returned empty string')
    return solved


# ─── POST /api/ipu/auto-fetch ──────────────────────────────────────────────────
@ipu_bp.route('/auto-fetch', methods=['POST'])
def auto_fetch_results():
    """
    One-shot endpoint: enrollment_number + password → auto-solve CAPTCHA → results.
    Expects JSON: { enrollment_number, password }
    Returns results directly, or {captcha_required:true, ...} if OCR fails.
    """
    if 'user' not in session:
        return error_response('Unauthorized', 'UNAUTHORIZED', 401)

    user_email = session['user']['email'].lower()
    data = request.json or {}
    enrollment = data.get('enrollment_number', '').strip()
    password   = data.get('password', '').strip()

    if not enrollment or not password:
        return error_response('Enrollment number and password are required.', 'MISSING_FIELDS', 400)

    ipu_sess = _get_ipu_session(user_email)

    try:
        # 1. Fetch login page to grab cookies + CAPTCHA
        resp = ipu_sess.get(IPU_LOGIN_URL, timeout=15, verify=False)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')

        # 2. Find CAPTCHA image
        captcha_img = (
            soup.find('img', {'id': 'captchaImage'}) or
            soup.find('img', {'id': 'captcha'}) or
            soup.find('img', {'class': re.compile(r'captcha', re.I)}) or
            soup.find('img', src=re.compile(r'captcha', re.I)) or
            soup.find('img', src=re.compile(r'kaptcha', re.I))
        )
        if not captcha_img:
            return error_response('Could not locate CAPTCHA on login page.', 'CAPTCHA_NOT_FOUND', 422)

        captcha_src = captcha_img.get('src', '')
        if not captcha_src.startswith('http'):
            captcha_src = IPU_BASE + ('/' if not captcha_src.startswith('/') else '') + captcha_src

        # 3. Download CAPTCHA bytes
        img_resp = ipu_sess.get(captcha_src, timeout=10, verify=False)
        img_resp.raise_for_status()
        img_bytes = img_resp.content
        img_b64 = base64.b64encode(img_bytes).decode()
        content_type = img_resp.headers.get('Content-Type', 'image/jpeg')

        # 4. Extract hidden fields + detect field names
        hidden_fields = {}
        form = soup.find('form', {'action': re.compile(r'login', re.I)}) or soup.find('form')
        if form:
            for inp in form.find_all('input', {'type': 'hidden'}):
                name = inp.get('name')
                value = inp.get('value', '')
                if name:
                    hidden_fields[name] = value

        username_field = _detect_field(form, ['username', 'j_username', 'userId', 'user_name', 'loginId']) or 'j_username'
        password_field = _detect_field(form, ['password', 'j_password', 'passwd', 'pass']) or 'j_password'
        captcha_field  = _detect_field(form, ['captcha', 'captchaValue', 'vcaptcha', 'kaptcha', 'captchaCode', 'securityCode']) or 'captcha'

        field_names = {'username': username_field, 'password': password_field, 'captcha': captcha_field}

        # 5. Try to auto-solve the CAPTCHA with OCR
        try:
            captcha_code = _auto_solve_captcha(img_bytes)
            logger.info(f'CAPTCHA auto-solved: "{captcha_code}"')
        except Exception as ocr_err:
            logger.warning(f'OCR failed ({ocr_err}), returning captcha for manual entry')
            # Return captcha image for frontend fallback
            return success_response({
                'captcha_required': True,
                'captcha_image': f'data:{content_type};base64,{img_b64}',
                'hidden_fields': hidden_fields,
                'field_names': field_names,
            })

        # 6. Submit login form with auto-solved captcha
        payload = {**hidden_fields}
        payload[username_field] = enrollment
        payload[password_field] = password
        payload[captcha_field]  = captcha_code

        login_resp = ipu_sess.post(IPU_LOGIN_ACTION, data=payload, timeout=20, verify=False, allow_redirects=True)
        page_text = login_resp.text
        page_lower = page_text.lower()
        login_soup = BeautifulSoup(page_text, 'html.parser')

        # 7. Check if still on login page (wrong captcha / credentials)
        login_indicators = ['j_username', 'j_password', 'loginaction', 'login.jsp']
        still_on_login = any(ind in page_lower for ind in login_indicators)

        if still_on_login:
            # Could be wrong captcha — try once more with fresh captcha returned for manual entry
            logger.warning('Auto-login failed (still on login page). Returning captcha for manual entry.')
            return success_response({
                'captcha_required': True,
                'captcha_image': f'data:{content_type};base64,{img_b64}',
                'hidden_fields': hidden_fields,
                'field_names': field_names,
                'ocr_attempted': captcha_code,
            })

        # 8. Check for explicit error messages
        failure_signals = ['invalid', 'incorrect', 'wrong captcha', 'please try again', 'authentication failed', 'login failed']
        error_msgs = login_soup.find_all(class_=re.compile(r'error|alert|danger|warning', re.I))
        for em in error_msgs:
            em_text = em.get_text(strip=True).lower()
            if any(sig in em_text for sig in failure_signals):
                return error_response(em.get_text(strip=True) or 'Login failed — check credentials.', 'LOGIN_FAILED', 401)

        # 9. Navigate to studenthome.jsp and fetch all semester results
        results = _scrape_all_semesters(ipu_sess, enrollment)
        return success_response(results)

    except requests.exceptions.RequestException as e:
        logger.error(f'IPU auto-fetch network error: {e}')
        return error_response(f'Network error connecting to IPU portal: {str(e)}', 'NETWORK_ERROR', 502)
    except Exception as e:
        logger.error(f'IPU auto-fetch error: {e}')
        traceback.print_exc()
        return error_response(f'Unexpected error: {str(e)}', 'INTERNAL_ERROR', 500)


# ─── POST /api/ipu/fetch-results ───────────────────────────────────────────────
@ipu_bp.route('/fetch-results', methods=['POST'])
def fetch_ipu_results():
    """
    Submit IPU login form and scrape the student's result/dashboard page.
    Expects JSON: { enrollment_number, password, captcha, hidden_fields, field_names }
    """
    if 'user' not in session:
        return error_response('Unauthorized', 'UNAUTHORIZED', 401)

    user_email = session['user']['email'].lower()
    data = request.json or {}

    enrollment = data.get('enrollment_number', '').strip()
    password   = data.get('password', '').strip()
    captcha    = data.get('captcha', '').strip()
    hidden_fields = data.get('hidden_fields', {})
    field_names   = data.get('field_names', {})

    if not all([enrollment, password, captcha]):
        return error_response('Enrollment number, password and CAPTCHA are required.', 'MISSING_FIELDS', 400)

    ipu_sess = _get_ipu_session(user_email)

    try:
        # Build login payload
        payload = {**hidden_fields}
        payload[field_names.get('username', 'j_username')] = enrollment
        payload[field_names.get('password', 'j_password')] = password
        payload[field_names.get('captcha',  'captcha')]    = captcha

        login_resp = ipu_sess.post(
            IPU_LOGIN_ACTION,
            data=payload,
            timeout=20,
            verify=False,
            allow_redirects=True
        )

        page_text = login_resp.text
        soup = BeautifulSoup(page_text, 'html.parser')

        # Check for login failure signals
        failure_signals = [
            'invalid', 'incorrect', 'wrong captcha', 'please try again',
            'authentication failed', 'login failed', 'error', 'unsuccess'
        ]
        page_lower = page_text.lower()

        # If we're still on the login page, it failed
        login_indicators = ['j_username', 'j_password', 'loginaction', 'login.jsp']
        still_on_login = any(ind in page_lower for ind in login_indicators)

        error_msgs = soup.find_all(class_=re.compile(r'error|alert|danger|warning', re.I))
        for em in error_msgs:
            em_text = em.get_text(strip=True).lower()
            if any(sig in em_text for sig in failure_signals):
                return error_response(em.get_text(strip=True) or 'Login failed — check your credentials or CAPTCHA.', 'LOGIN_FAILED', 401)

        if still_on_login:
            return error_response('Login failed — incorrect credentials or CAPTCHA. Please try again.', 'LOGIN_FAILED', 401)

        # ── Successful login ── now scrape all semester results ─────────────
        results = _scrape_all_semesters(ipu_sess, enrollment)
        return success_response(results)

    except requests.exceptions.RequestException as e:
        logger.error(f'IPU login network error: {e}')
        return error_response(f'Network error connecting to IPU portal: {str(e)}', 'NETWORK_ERROR', 502)
    except Exception as e:
        logger.error(f'IPU fetch results error: {e}')
        traceback.print_exc()
        return error_response(f'Unexpected error: {str(e)}', 'INTERNAL_ERROR', 500)


def _scrape_all_semesters(ipu_sess: requests.Session, enrollment: str) -> dict:
    """
    After login, navigate to studenthome.jsp, find the semester <select>,
    iterate all options, POST the form for each, and parse each result page.
    Returns the combined results dict.
    """
    result: dict = {
        'enrollment_number': enrollment,
        'student_info': {},
        'semesters': [],
    }

    try:
        home_resp = ipu_sess.get(IPU_HOME_URL, timeout=15, verify=False)
        home_resp.raise_for_status()
    except Exception as e:
        logger.error(f'Could not load studenthome.jsp: {e}')
        return result

    home_soup = BeautifulSoup(home_resp.text, 'html.parser')

    # Extract student info from home page (header area)
    result['student_info'] = _extract_student_info(home_soup)

    # Find the semester <select> element
    sem_select = (
        home_soup.find('select', {'name': re.compile(r'sem|term|annual|extype', re.I)}) or
        home_soup.find('select')
    )
    if not sem_select:
        logger.warning('No semester select found on studenthome.jsp')
        return result

    # Get all meaningful options (skip blanks / "-- Select --")
    options = [
        opt for opt in sem_select.find_all('option')
        if opt.get('value', '').strip() and opt.get('value', '').strip() not in ('', '0', '-1')
        and '--' not in opt.get_text(strip=True)
    ]
    logger.info(f'Found {len(options)} semester options: {[(o.get("value"),o.get_text(strip=True)) for o in options]}')

    # Find the form and its action
    sem_form = sem_select.find_parent('form')
    if sem_form:
        action = sem_form.get('action', '').strip()
        if not action.startswith('http'):
            action = IPU_BASE + ('/' if not action.startswith('/') else '') + action
        form_method = sem_form.get('method', 'post').lower()
    else:
        action = IPU_HOME_URL
        form_method = 'post'

    # Hidden fields on the home form
    home_hidden = {}
    if sem_form:
        for inp in sem_form.find_all('input', {'type': 'hidden'}):
            nm = inp.get('name')
            if nm:
                home_hidden[nm] = inp.get('value', '')

    select_name = sem_select.get('name', 'semester')

    # Fetch result for each semester option
    for opt in options:
        sem_value = opt.get('value', '').strip()
        sem_label = opt.get_text(strip=True)  # e.g. "Semester-I", "Annual-I"
        sem_num   = _sem_label_to_number(sem_label, sem_value)

        try:
            payload = {**home_hidden, select_name: sem_value}
            if form_method == 'get':
                sem_resp = ipu_sess.get(action, params=payload, timeout=15, verify=False)
            else:
                sem_resp = ipu_sess.post(action, data=payload, timeout=15, verify=False, allow_redirects=True)

            if sem_resp.status_code != 200 or len(sem_resp.text) < 200:
                logger.warning(f'Skipping sem {sem_label}: bad response ({sem_resp.status_code})')
                continue

            sem_soup = BeautifulSoup(sem_resp.text, 'html.parser')
            sem_data = _parse_semester_result_page(sem_soup, sem_num, sem_label)

            # Only add if we got actual subject data
            if sem_data.get('subjects') or sem_data.get('total_marks'):
                result['semesters'].append(sem_data)
                # Update student info if not yet populated
                if not result['student_info']:
                    result['student_info'] = _extract_student_info(sem_soup)

        except Exception as e:
            logger.error(f'Error fetching semester {sem_label}: {e}')
            continue

    # Sort semesters by number
    result['semesters'].sort(key=lambda s: s.get('semester_num', 99))
    return result


def _sem_label_to_number(label: str, value: str) -> str:
    """Convert semester label/value to a canonical number string."""
    # Try Roman numerals first
    roman = {'i': 1, 'ii': 2, 'iii': 3, 'iv': 4, 'v': 5, 'vi': 6, 'vii': 7, 'viii': 8}
    label_clean = label.strip().lower()
    for rom, num in roman.items():
        if label_clean.endswith(f'-{rom}') or label_clean.endswith(f' {rom}') or label_clean == rom:
            return str(num)
    # Try digits in label
    digits = re.findall(r'\d+', label)
    if digits:
        return digits[0]
    # Try digits in value
    digits = re.findall(r'\d+', value)
    if digits:
        return digits[0]
    return label


def _extract_student_info(soup: BeautifulSoup) -> dict:
    """Extract student name, programme, institution, batch from any IPU page."""
    info: dict = {}
    patterns = {
        'name':        ['student name', 'name'],
        'programme':   ['programme', 'program', 'course', 'branch'],
        'institution': ['institution', 'college', 'school', 'institute'],
        'batch':       ['batch', 'year'],
    }
    for key, labels in patterns.items():
        for label in labels:
            el = soup.find(string=re.compile(label, re.I))
            if not el:
                continue
            parent = el.find_parent(['td', 'th', 'div', 'span', 'label', 'p'])
            if not parent:
                continue
            # Sibling td
            sib = parent.find_next_sibling(['td', 'div', 'span'])
            if sib and sib.get_text(strip=True):
                info[key] = sib.get_text(strip=True)
                break
            # Next td in same tr
            tr = parent.find_parent('tr')
            if tr:
                tds = tr.find_all('td')
                for i, td in enumerate(tds):
                    if label in td.get_text(strip=True).lower() and i + 1 < len(tds):
                        val = tds[i + 1].get_text(strip=True)
                        if val:
                            info[key] = val
                            break
            if key in info:
                break
    return info


def _parse_semester_result_page(soup: BeautifulSoup, sem_num: str, sem_label: str) -> dict:
    """
    Parse a single semester's result page from examweb.ggsipu.ac.in.
    Returns { semester, semester_num, semester_label, subjects, sgpa, total_marks, max_marks }
    """
    sem_data: dict = {
        'semester': sem_num,
        'semester_num': int(re.sub(r'\D', '', sem_num) or 0) if sem_num.isdigit() else 0,
        'semester_label': sem_label,
        'subjects': [],
        'sgpa': None,
        'total_marks': None,
        'max_marks': None,
    }

    # Fix semester_num for sort
    digits = re.findall(r'\d+', sem_num)
    if digits:
        sem_data['semester_num'] = int(digits[0])

    # ── Look for SGPA / result summary ──────────────────────────────────────
    sgpa_el = soup.find(string=re.compile(r'sgpa|s\.g\.p\.a', re.I))
    if sgpa_el:
        parent = sgpa_el.find_parent(['td', 'th', 'div', 'span', 'p'])
        if parent:
            sib = parent.find_next_sibling(['td', 'div', 'span'])
            if sib:
                val = re.search(r'[\d.]+', sib.get_text())
                if val:
                    sem_data['sgpa'] = val.group()

    # ── Extract subject table ────────────────────────────────────────────────
    tables = soup.find_all('table')
    for tbl in tables:
        rows = tbl.find_all('tr')
        if len(rows) < 2:
            continue

        # Get headers from first row (th or td)
        header_row = rows[0]
        headers = [cell.get_text(strip=True).lower() for cell in header_row.find_all(['th', 'td'])]
        if not headers:
            continue

        # Skip tables without subject-like columns
        has_subject = any('paper' in h or 'subject' in h or 'title' in h or 'course' in h for h in headers)
        has_marks   = any('mark' in h or 'grade' in h or 'score' in h or 'total' in h or 'credit' in h for h in headers)
        if not (has_subject or has_marks):
            continue

        subjects = []
        for row in rows[1:]:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 2:
                continue
            cell_texts = [c.get_text(strip=True) for c in cells]

            # Skip empty rows or total/summary rows
            if all(not t for t in cell_texts):
                continue
            first = cell_texts[0].lower()
            if any(kw in first for kw in ['total', 'sgpa', 'cgpa', 'result', 'grand']):
                # Try to extract total marks from summary row
                for i, h in enumerate(headers):
                    if 'total' in h and i < len(cell_texts):
                        val = re.search(r'[\d.]+', cell_texts[i])
                        if val and not sem_data['total_marks']:
                            sem_data['total_marks'] = cell_texts[i]
                    if 'max' in h and i < len(cell_texts):
                        val = re.search(r'[\d.]+', cell_texts[i])
                        if val and not sem_data['max_marks']:
                            sem_data['max_marks'] = cell_texts[i]
                continue

            subj: dict = {}
            for i, h in enumerate(headers):
                if i >= len(cell_texts):
                    break
                v = cell_texts[i]
                if not v:
                    continue
                if 'paper' in h and 'title' not in h and 'name' not in h:
                    subj['code'] = v
                elif any(kw in h for kw in ['title', 'subject', 'paper name', 'paper title', 'course']):
                    subj['name'] = v
                elif any(kw in h for kw in ['internal', 'sessional', 'minor', 'ia']):
                    subj['internal'] = v
                elif any(kw in h for kw in ['external', 'theory', 'major', 'ea']):
                    subj['external'] = v
                elif any(kw in h for kw in ['total', 'marks obtained', 'marks']):
                    subj['marks'] = v
                elif any(kw in h for kw in ['max', 'maximum']):
                    subj['max_marks'] = v
                elif any(kw in h for kw in ['grade point', 'gp']):
                    subj['grade_points'] = v
                elif 'grade' in h:
                    subj['grade'] = v
                elif any(kw in h for kw in ['credit', 'cr']):
                    subj['credits'] = v
                elif any(kw in h for kw in ['status', 'result', 'pass', 'fail']):
                    subj['status'] = v

            if subj.get('name') or subj.get('code'):
                subjects.append(subj)

        if subjects:
            sem_data['subjects'] = subjects
            break  # Use first matching table

    return sem_data


def _parse_ipu_result_page(soup: BeautifulSoup, enrollment: str) -> dict:
    """
    Parse the IPU result/dashboard page and return structured data.
    Handles various table layouts used by examweb.ggsipu.ac.in.
    """
    results: dict = {
        'enrollment_number': enrollment,
        'student_info': {},
        'semesters': [],
        'raw_tables': []
    }

    # ── Student info extraction ─────────────────────────────────────────────
    info_patterns = {
        'name':        ['student name', 'name'],
        'program':     ['program', 'course', 'branch'],
        'institution': ['institution', 'college', 'school'],
        'batch':       ['batch', 'year'],
    }

    for key, labels in info_patterns.items():
        for label in labels:
            el = soup.find(string=re.compile(label, re.I))
            if el:
                parent = el.find_parent(['td', 'th', 'div', 'span', 'label'])
                if parent:
                    sibling = parent.find_next_sibling(['td', 'div', 'span'])
                    if sibling:
                        results['student_info'][key] = sibling.get_text(strip=True)
                        break
                    # Try next td in same tr
                    tr = parent.find_parent('tr')
                    if tr:
                        tds = tr.find_all('td')
                        for i, td in enumerate(tds):
                            if label in td.get_text(strip=True).lower() and i + 1 < len(tds):
                                results['student_info'][key] = tds[i + 1].get_text(strip=True)
                                break

    # ── Table extraction ────────────────────────────────────────────────────
    tables = soup.find_all('table')
    for tbl in tables:
        rows = tbl.find_all('tr')
        if len(rows) < 2:
            continue

        headers = [th.get_text(strip=True) for th in (rows[0].find_all('th') or rows[0].find_all('td'))]
        if not headers:
            continue

        table_data = []
        for row in rows[1:]:
            cells = row.find_all(['td', 'th'])
            if not cells:
                continue
            row_dict = {}
            for i, cell in enumerate(cells):
                key = headers[i] if i < len(headers) else f'col_{i}'
                row_dict[key] = cell.get_text(strip=True)
            if any(v for v in row_dict.values()):
                table_data.append(row_dict)

        if table_data:
            results['raw_tables'].append({
                'headers': headers,
                'rows': table_data
            })

    # ── Try to identify semester result tables ─────────────────────────────
    results['semesters'] = _parse_semester_tables(results['raw_tables'])

    return results


def _parse_semester_tables(raw_tables: list) -> list:
    """
    Attempt to identify and structure semester-wise result tables.
    """
    semester_results = []

    subject_keywords = ['subject', 'paper', 'course', 'title']
    marks_keywords   = ['marks', 'score', 'total', 'obtained']
    grade_keywords   = ['grade', 'gp', 'grade point']

    for tbl in raw_tables:
        headers_lower = [h.lower() for h in tbl['headers']]

        has_subjects = any(any(kw in h for kw in subject_keywords) for h in headers_lower)
        has_marks    = any(any(kw in h for kw in marks_keywords)   for h in headers_lower)

        if not (has_subjects or has_marks):
            continue

        subjects = []
        for row in tbl['rows']:
            # Try to map columns to standard fields
            subj: dict = {}
            for col, val in row.items():
                col_l = col.lower()
                if any(kw in col_l for kw in subject_keywords):
                    subj['name'] = val
                elif any(kw in col_l for kw in ['code', 'paper code']):
                    subj['code'] = val
                elif any(kw in col_l for kw in grade_keywords):
                    subj['grade'] = val
                elif any(kw in col_l for kw in marks_keywords):
                    subj['marks'] = val
                elif any(kw in col_l for kw in ['credit', 'cr']):
                    subj['credits'] = val
                elif any(kw in col_l for kw in ['internal', 'sessional', 'int']):
                    subj['internal'] = val
                elif any(kw in col_l for kw in ['external', 'theory', 'ext']):
                    subj['external'] = val
                elif any(kw in col_l for kw in ['status', 'result', 'pass']):
                    subj['status'] = val

            if subj.get('name'):
                subjects.append(subj)

        if subjects:
            semester_results.append({'subjects': subjects})

    return semester_results
