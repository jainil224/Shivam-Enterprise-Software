/**
 * Phase 11 - HTTP endpoint check for the GSTIN routes.
 *
 * Boots the real Express app (in-process, sandbox provider, no API key, no
 * credits) and exercises GET /api/gstin/* over real HTTP exactly the way the
 * React client calls it.
 *
 *   npx tsx scripts/gstin-http-endpoint-test.ts
 */

const TEST_PORT = process.env.GSTIN_HTTP_TEST_PORT || '5099';
const COMPANY_ID = process.env.GSTIN_TEST_COMPANY_ID || 'b5f484da-fc82-46c0-8ea2-b171dcc0c78c';
const BASE = `http://127.0.0.1:${TEST_PORT}/api`;

// Must be set before the app modules are imported: env.ts reads process.env once.
process.env.PORT = TEST_PORT;
process.env.GSTIN_PROVIDER = 'sandbox';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${message}`);
  } else {
    failed += 1;
    failures.push(message);
    console.error(`  FAIL  ${message}`);
  }
}

interface ApiResult {
  status: number;
  body: any;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function call(path: string, withCompanyHeader = true): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (withCompanyHeader) headers['x-company-id'] = COMPANY_ID;
  const response = await fetch(BASE + path, { headers });
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function waitForServer(): Promise<boolean> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.status < 500) return true;
    } catch {
      // not listening yet
    }
    await sleep(300);
  }
  return false;
}

async function main(): Promise<void> {
  // Importing the server module starts the HTTP listener on process.env.PORT.
  await import('../src/server.js');

  const up = await waitForServer();
  if (!up) {
    console.error(`Server did not start on port ${TEST_PORT}.`);
    process.exit(1);
  }

  console.log('================================================================');
  console.log(' PHASE 11 - GSTIN HTTP ENDPOINT CHECK (sandbox provider)');
  console.log(` Base: ${BASE}`);
  console.log('================================================================');

  console.log('\n[Provider status]');
  const status = await call('/gstin/status');
  assert(status.status === 200, 'GET /api/gstin/status -> 200');
  assert(status.body?.data?.provider === 'sandbox', 'Status names the active provider');
  assert(status.body?.data?.isConfigured === true, 'Status reports the provider as configured');
  assert(typeof status.body?.data?.portalUrl === 'string', 'Status exposes the official portal link');

  console.log('\n[Local validation happens before any provider call]');
  const badFormat = await call('/gstin/verify/12345INVALID');
  assert(badFormat.status === 400, 'Malformed GSTIN -> HTTP 400');
  assert(badFormat.body?.error?.code === 'INVALID_FORMAT', 'Error code INVALID_FORMAT returned');

  const noHeader = await call('/gstin/verify/00AAAAA0000A1ZT', false);
  assert(noHeader.status === 400, 'Missing x-company-id -> HTTP 400');

  console.log('\n[Successful lookup]');
  const ok = await call('/gstin/verify/00AAAAA0000A1ZT');
  assert(ok.status === 200, 'Valid GSTIN -> HTTP 200');
  assert(ok.body?.data?.gstin === '00AAAAA0000A1ZT', 'Response echoes the requested GSTIN');
  assert(Boolean(ok.body?.data?.legalName), 'Response carries a legal name');
  assert(Boolean(ok.body?.data?.stateCode), 'Response carries a state code');
  assert(ok.body?.data?.isVerified === true, 'Response marked verified');
  assert(ok.body?.data?.source === 'EXTERNAL_API', 'First lookup source = EXTERNAL_API');

  console.log('\n[Cache and manual refresh]');
  const cached = await call('/gstin/verify/00AAAAA0000A1ZT');
  assert(cached.body?.data?.source === 'CACHED', 'Second lookup source = CACHED');
  assert(typeof cached.body?.data?.cachedAt === 'string', 'Cached response includes cachedAt');

  const refreshed = await call('/gstin/verify/00AAAAA0000A1ZT?refresh=true');
  assert(refreshed.body?.data?.source === 'EXTERNAL_API', '?refresh=true bypasses the cache');

  console.log('\n[Not found]');
  const notFound = await call('/gstin/verify/24NOTFD0001A1Z8');
  assert(notFound.status === 404, 'Unregistered GSTIN -> HTTP 404');
  assert(notFound.body?.error?.code === 'NOT_FOUND', 'Error code NOT_FOUND returned');
  assert(typeof notFound.body?.error?.portalUrl === 'string', '404 offers the official portal link');

  console.log('\n[Party Master stays optional]');
  const partyCount = await fetch(`${BASE}/masters/parties`, { headers: { 'x-company-id': COMPANY_ID } });
  assert(partyCount.status === 200, 'GET /api/masters/parties reachable');

  console.log('\n================================================================');
  console.log(` RESULT: ${failed === 0 ? 'PASS' : 'FAIL'} - ${passed} passed, ${failed} failed`);
  console.log(' Credits spent: 0 (sandbox provider)');
  console.log('================================================================');
  if (failed > 0) {
    for (const failure of failures) console.error('  - ' + failure);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('HTTP endpoint test crashed:', err);
  process.exit(1);
});