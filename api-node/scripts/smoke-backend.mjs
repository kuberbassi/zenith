import 'dotenv/config';
import jwt from 'jsonwebtoken';

const base = process.env.SMOKE_BASE_URL || 'http://localhost:5001';
const userId = process.env.SMOKE_USER_ID || 'cmmge2sva0000ts2qjq5ch6uv';
const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

const state = {
  subjectId: null,
  slotId: null,
  attendanceLogId: null,
  courseId: null,
  oldPeriods: null,
};

const out = [];
const stamp = Date.now();
const rand = Math.floor(Math.random() * 99999);

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

async function step(name, fn) {
  try {
    const r = await fn();
    out.push({ name, pass: !!r.pass, status: r.status ?? null, note: r.note ?? '' });
  } catch (e) {
    out.push({ name, pass: false, status: null, note: String(e?.message || e) });
  }
}

await step('GET health', async () => {
  const r = await req('GET', '/api/health');
  return { pass: r.ok, status: r.status, note: r.ok ? 'ok' : JSON.stringify(r.json) };
});

await step('GET timetable snapshot', async () => {
  const r = await req('GET', '/api/timetable?semester=2');
  if (!r.ok) return { pass: false, status: r.status, note: JSON.stringify(r.json) };
  state.oldPeriods = r.json?.data?.periods ?? [];
  return { pass: true, status: r.status, note: `periods=${Array.isArray(state.oldPeriods) ? state.oldPeriods.length : 0}` };
});

await step('POST subject', async () => {
  const r = await req('POST', '/api/academic/subjects', {
    name: `SMOKE_SUB_${stamp}`,
    semester: 2,
    code: `SMK-${rand}`,
    categories: ['Theory'],
  });
  state.subjectId = r.json?.data?._id || r.json?.data?.id || null;
  return { pass: r.ok && !!state.subjectId, status: r.status, note: `subjectId=${state.subjectId}` };
});

await step('POST timetable custom slot', async () => {
  const r = await req('POST', '/api/timetable/slot?semester=2', {
    day: 'Friday',
    type: 'custom',
    label: `SMOKE_CUSTOM_${rand}`,
    start_time: '11:11 PM',
    end_time: '11:22 PM',
    subject_id: state.subjectId || '',
  });
  state.slotId = r.json?.data?.id || r.json?.id || null;
  return { pass: r.ok && !!state.slotId, status: r.status, note: `slotId=${state.slotId}` };
});

await step('PUT timetable custom slot', async () => {
  if (!state.slotId) return { pass: false, note: 'no slot id' };
  const r = await req('PUT', `/api/timetable/slot/${state.slotId}?semester=2`, {
    type: 'custom',
    label: `SMOKE_CUSTOM_EDITED_${rand}`,
    subject_id: state.subjectId || '',
  });
  return { pass: r.ok, status: r.status, note: r.ok ? 'updated' : JSON.stringify(r.json) };
});

await step('POST attendance mark', async () => {
  if (!state.subjectId) return { pass: false, note: 'no subject id' };
  const date = '2099-01-01';
  const r = await req('POST', '/api/attendance/mark', {
    subject_id: state.subjectId,
    status: 'present',
    date,
    semester: 2,
  });
  return { pass: r.ok, status: r.status, note: r.ok ? 'marked' : JSON.stringify(r.json) };
});

await step('GET attendance logs', async () => {
  if (!state.subjectId) return { pass: false, note: 'no subject id' };
  const r = await req('GET', '/api/attendance/logs?date=2099-01-01&limit=50&page=1');
  const logs = r.json?.data?.logs || r.json?.data || [];
  const found = Array.isArray(logs) ? logs.find((l) => String(l.subject_id || '') === String(state.subjectId)) : null;
  state.attendanceLogId = found?._id || found?.id || null;
  return { pass: r.ok && !!state.attendanceLogId, status: r.status, note: `logId=${state.attendanceLogId}` };
});

await step('POST manual course', async () => {
  const r = await req('POST', '/api/academic/courses/manual', {
    title: `SMOKE_COURSE_${stamp}`,
    platform: 'custom',
    url: 'https://example.com',
    progress: 15,
  });
  return { pass: r.ok, status: r.status, note: r.ok ? 'created' : JSON.stringify(r.json) };
});

await step('GET manual courses find smoke', async () => {
  const r = await req('GET', '/api/academic/courses/manual');
  const rows = Array.isArray(r.json?.data) ? r.json.data : [];
  const found = rows.find((c) => String(c.title || c.name || '').includes('SMOKE_COURSE_'));
  state.courseId = found?._id || found?.id || null;
  return { pass: r.ok && !!state.courseId, status: r.status, note: `courseId=${state.courseId}` };
});

await step('CLEANUP attendance log', async () => {
  if (!state.attendanceLogId) return { pass: true, note: 'none' };
  const r = await req('DELETE', `/api/attendance/logs/${state.attendanceLogId}`);
  return { pass: r.ok, status: r.status, note: r.ok ? 'deleted' : JSON.stringify(r.json) };
});

await step('CLEANUP slot', async () => {
  if (!state.slotId) return { pass: true, note: 'none' };
  const r = await req('DELETE', `/api/timetable/slot/${state.slotId}?semester=2`);
  return { pass: r.ok, status: r.status, note: r.ok ? 'deleted' : JSON.stringify(r.json) };
});

await step('CLEANUP course', async () => {
  if (!state.courseId) return { pass: true, note: 'none' };
  const r = await req('DELETE', `/api/academic/courses/manual/${state.courseId}`);
  return { pass: r.ok, status: r.status, note: r.ok ? 'deleted' : JSON.stringify(r.json) };
});

await step('CLEANUP subject', async () => {
  if (!state.subjectId) return { pass: true, note: 'none' };
  const r = await req('DELETE', `/api/academic/subjects/${state.subjectId}`);
  return { pass: r.ok, status: r.status, note: r.ok ? 'deleted' : JSON.stringify(r.json) };
});

await step('CLEANUP restore periods', async () => {
  if (!Array.isArray(state.oldPeriods)) return { pass: true, note: 'none' };
  const r = await req('POST', '/api/timetable/structure?semester=2', state.oldPeriods);
  return { pass: r.ok, status: r.status, note: r.ok ? 'restored' : JSON.stringify(r.json) };
});

const failed = out.filter((x) => !x.pass);
console.log('--- BACKEND SMOKE ---');
out.forEach((x) => {
  console.log(`${x.pass ? 'PASS' : 'FAIL'} | ${x.name} | status=${x.status ?? '-'} | ${x.note}`);
});
console.log('Summary:', { total: out.length, failed: failed.length });
if (failed.length) process.exitCode = 1;
