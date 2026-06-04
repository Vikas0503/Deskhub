/**
 * Verifies the backend is up: GET /tickets (expects JSON).
 * Run with API running: npm run verify:api
 */
const base = process.env.API_BASE_URL ?? 'http://localhost:3001';

const url = `${base.replace(/\/$/, '')}/tickets`;

const res = await fetch(url);

if (!res.ok) {
  console.error(`FAIL: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const ct = res.headers.get('content-type') ?? '';
const body = await res.text();

if (!ct.includes('application/json')) {
  console.warn('Warning: Content-Type is not application/json:', ct);
}

try {
  const json = JSON.parse(body);
  console.log('OK', res.status, Array.isArray(json) ? `array length ${json.length}` : typeof json);
  console.log(JSON.stringify(json).slice(0, 500));
} catch {
  console.error('FAIL: response is not valid JSON');
  console.error(body.slice(0, 500));
  process.exit(1);
}
