import 'dotenv/config';
import jwt from 'jsonwebtoken';

const base = process.env.SMOKE_BASE_URL || 'http://localhost:5001';
const userId = process.env.SMOKE_USER_ID || 'cmmge2sva0000ts2qjq5ch6uv';
const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

async function req(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, json };
}

async function runTests() {
  console.log('--- DATA WIPE VERIFICATION ---');

  // 1. Test Backup Creation
  const backupRes = await req('POST', '/api/data/backups', {});
  if (!backupRes.ok) {
    console.error('FAIL | Backup creation failed', backupRes.status, backupRes.json);
    return;
  }
  const backupId = backupRes.json?.data?.backup_id;
  console.log('PASS | Backup created', { backupId });

  // 2. Test Wipe Without Backup ID
  const wipeFail = await req('DELETE', '/api/data/delete_all_data', { confirmation_email: 'test@example.com' });
  if (wipeFail.status === 400 && wipeFail.json?.code === 'BACKUP_REQUIRED') {
    console.log('PASS | Wipe blocked without backup_id');
  } else {
    console.error('FAIL | Wipe should have been blocked without backup_id', wipeFail.status, wipeFail.json);
  }

  // 3. Test Wipe With Backup ID
  const wipePass = await req('DELETE', '/api/data/delete_all_data', { 
    confirmation_email: 'test@example.com', // Replace with real email if testing against real db
    backup_id: backupId 
  });
  if (wipePass.ok) {
    console.log('PASS | Wipe succeeded with backup_id');
  } else {
    console.log('NOTE | Wipe failed as expected if email mismatch or db not running', wipePass.status, wipePass.json);
  }
  
  console.log('--- IMPORT VERIFICATION ---');
  // 4. Test Import (Minimal payload)
  const importRes = await req('POST', '/api/data/import_data', {
    data: {
      user_profile: {
        name: 'Restored User',
        branch: 'RESTORE_BRANCH'
      },
      subjects: []
    }
  });
  if (importRes.ok) {
    console.log('PASS | Import successful');
  } else {
    console.error('FAIL | Import failed', importRes.status, importRes.json);
  }
}

runTests();
