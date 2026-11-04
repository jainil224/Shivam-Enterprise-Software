/**
 * Phase 11 - GSTINAPI provider integration test.
 *
 * Runs the REAL GSTINAPIProvider (real fetch, real header, real status-code
 * handling) against a local HTTP server that replays the provider's documented
 * payloads. No credits are spent and no database rows are created.
 *
 * The GSTIN used throughout is the free test number published in the provider
 * documentation: 00AAAAA0000A1ZT.
 *
 * Optional live check (spends one credit, needs a real key):
 *   GSTIN_LIVE_TEST=1 npx tsx scripts/gstin-api-integration-test.ts
 */

import http from 'http';
import { AddressInfo } from 'net';
import {
  GSTINAPIProvider,
  DOCUMENTED_TEST_GSTIN,
} from '../src/services/gstin/providers/gstinApiProvider.js';

const TEST_KEY = 'gak_sandbox_test_key';

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

function section(title: string): void {
  console.log(`\n[${title}]`);
}

// ---------------------------------------------------------------------------
// Local stand-in for https://www.gstinapi.in
// ---------------------------------------------------------------------------
let requestCount = 0;
let lastRequestPath = '';
let lastApiKey: string | undefined;
let lastAccept: string | undefined;

type Responder = (req: http.IncomingMessage, res: http.ServerResponse) => void;

const reply = (status: number, body: unknown): Responder => (_req, res) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

let responder: Responder = reply(500, { success: false, error: 'no responder configured' });

const server = http.createServer((req, res) => {
  requestCount += 1;
  lastRequestPath = req.url || '';
  lastApiKey = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : undefined;
  lastAccept = typeof req.headers.accept === 'string' ? req.headers.accept : undefined;

  responder(req, res);
});

const useResponder = (next: Responder): void => {
  responder = next;
  requestCount = 0;
  lastRequestPath = '';
};

/** One documented success payload (shape copied verbatim from the docs). */
const successPayload = () => ({
  success: true,
  gstin: DOCUMENTED_TEST_GSTIN,
  credits_remaining: 487,
  response_ms: 312,
  data: {
    gstin: DOCUMENTED_TEST_GSTIN,
    legal_name: 'CENTRAL WAREHOUSING CORPORATION',
    trade_name: 'CENTRAL WAREHOUSING CORPORATION',
    status: 'Active',
    taxpayer_type: 'Regular',
    business_constitution: null,
    registration_date: '2017-07-01',
    cancellation_date: null,
    state_code: '33',
    address: 'No.4, Thiruvalar Illam, North Avenue, Srinagar Colony, Saidapet, Chennai',
    city: 'Saidapet, Chennai',
    address_details: {
      building_number: 'No.4',
      building_name: 'Thiruvalar Illam',
      floor: null,
      street: 'North Avenue',
      locality: 'Srinagar Colony, Saidapet, Chennai',
      district: null,
      city: null,
      state: null,
      landmark: null,
      pincode: '600015',
    },
    pincode: '600015',
    nature_of_business: null,
    block_status: 'Unblocked',
  },
});

interface RaisedError extends Error {
  code?: string;
  statusCode?: number;
}

/** Runs a call expected to fail and reports the error code it produced. */
async function captureError(call: () => Promise<unknown>): Promise<RaisedError | null> {
  try {
    await call();
    return null;
  } catch (thrown) {
    return thrown as RaisedError;
  }
}

async function main(): Promise<void> {
  console.log('================================================================');
  console.log(' PHASE 11 - GSTINAPI PROVIDER INTEGRATION TEST');
  console.log(' Documented test GSTIN: ' + DOCUMENTED_TEST_GSTIN);
  console.log('================================================================');

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const provider = new GSTINAPIProvider({ apiKey: TEST_KEY, baseUrl });

  // ---------------------------------------------------------------- success
  section('1. Success response mapping (all required supplier fields)');
  useResponder(reply(200, successPayload()));
  const ok = await provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN);

  assert(ok !== null, 'Returns a result object for a registered GSTIN');
  assert(ok?.gstin === DOCUMENTED_TEST_GSTIN, 'GSTIN mapped');
  assert(ok?.legalName === 'CENTRAL WAREHOUSING CORPORATION', 'Legal Name mapped');
  assert(ok?.tradeName === 'CENTRAL WAREHOUSING CORPORATION', 'Trade Name mapped');
  assert(ok?.status === 'ACTIVE', 'Registration Status normalised to ACTIVE');
  assert(ok?.taxpayerType === 'Regular', 'Taxpayer Type mapped');
  assert(ok?.registrationDate === '2017-07-01', 'Registration Date mapped');
  assert(
    (ok?.address ?? '').includes('Thiruvalar Illam'),
    'Registered Address mapped'
  );
  assert(ok?.stateCode === '33', 'State Code mapped');
  assert(ok?.state === 'Tamil Nadu', 'State Code resolved to a state name');
  assert(ok?.pincode === '600015', 'PIN Code mapped');
  assert(ok?.city === 'Saidapet, Chennai', 'City mapped as the GST locality');
  assert(ok?.blockStatus === 'Unblocked', 'block_status surfaced');
  assert(ok?.creditsRemaining === 487, 'credits_remaining captured from the response');
  assert(provider.lastCreditsRemaining === 487, 'Last credit balance retained on the provider');
  assert(ok?.source === 'EXTERNAL_API', 'Source marked EXTERNAL_API');
  assert(ok?.isVerified === true, 'Result marked verified');
  assert((ok?.providerName ?? '').includes('GSTINAPI'), 'Provider name reported');
  assert(lastApiKey === TEST_KEY, 'x-api-key header sent exactly as configured');
  assert(lastRequestPath === `/v1/gstin/${DOCUMENTED_TEST_GSTIN}`, 'Correct endpoint /v1/gstin/{gstin} called');
  assert(lastAccept === 'application/json', 'Accept: application/json sent');

  // ------------------------------------------------- structured address only
  section('2. Structured address_details fallback');
  useResponder(
    reply(200, {
      success: true,
      gstin: DOCUMENTED_TEST_GSTIN,
      credits_remaining: 486,
      data: {
        gstin: DOCUMENTED_TEST_GSTIN,
        legal_name: 'SURAT YARN TRADERS PRIVATE LIMITED',
        status: 'Active',
        state_code: '24',
        address: null,
        city: null,
        pincode: null,
        address_details: {
          building_number: '12',
          building_name: 'Ring Road House',
          floor: null,
          street: 'Ring Road',
          locality: 'Surat',
          district: null,
          city: null,
          state: null,
          landmark: null,
          pincode: '395002',
        },
      },
    })
  );
  const structured = await provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN);
  assert((structured?.address ?? '').includes('Ring Road'), 'Address rebuilt from address_details');
  assert(structured?.pincode === '395002', 'PIN code taken from address_details');
  assert(structured?.state === 'Gujarat', 'State name resolved from state code 24');
  assert(structured?.pincode !== undefined && !(structured?.address ?? '').includes('null'), 'Null address parts are skipped');

  // ------------------------------------------------------------ error codes
  section('3. Documented failure responses');
  useResponder(reply(400, { success: false, error: 'Invalid GSTIN format. Must be 15 characters.' }));
  const e400 = await captureError(() => provider.verifyGSTIN('24AAAAA0000A1Z'));
  assert(e400?.code === 'INVALID_FORMAT' && e400?.statusCode === 400, 'HTTP 400 -> INVALID_FORMAT (400)');
  assert(requestCount === 1, 'HTTP 400 is not retried (1 request only)');

  useResponder(reply(401, { success: false, error: 'Invalid API key' }));
  const e401 = await captureError(() => provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN));
  assert(e401?.code === 'INVALID_API_KEY' && e401?.statusCode === 401, 'HTTP 401 -> INVALID_API_KEY (401)');

  useResponder(reply(402, { success: false, error: 'Out of credits' }));
  const e402 = await captureError(() => provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN));
  assert(e402?.code === 'INSUFFICIENT_CREDITS' && e402?.statusCode === 402, 'HTTP 402 -> INSUFFICIENT_CREDITS (402)');
  assert(requestCount === 1, 'HTTP 402 is not retried');

  useResponder(reply(403, { success: false, error: 'Account deactivated' }));
  const e403 = await captureError(() => provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN));
  assert(e403?.code === 'ACCOUNT_DEACTIVATED' && e403?.statusCode === 403, 'HTTP 403 -> ACCOUNT_DEACTIVATED (403)');

  useResponder(reply(404, { success: false, error: 'GSTIN not registered' }));
  const notFound = await provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN);
  assert(notFound === null, 'HTTP 404 -> null (GSTIN not found, no fake record)');

  // 429 and 502 are the only retryable codes: 3 attempts, then surface the error.
  section('4. Retry policy (429 / 502 only)');
  useResponder(reply(429, { success: false, error: 'Rate limit exceeded' }));
  const e429 = await captureError(() => provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN));
  assert(e429?.code === 'RATE_LIMIT' && e429?.statusCode === 429, 'HTTP 429 -> RATE_LIMIT (429)');
  assert(requestCount === 3, 'HTTP 429 retried exactly 3 times before failing');

  useResponder(reply(502, { success: false, error: 'Provider unavailable' }));
  const e502 = await captureError(() => provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN));
  assert(e502?.code === 'PROVIDER_UNAVAILABLE' && e502?.statusCode === 502, 'HTTP 502 -> PROVIDER_UNAVAILABLE (502)');
  assert(requestCount === 3, 'HTTP 502 retried exactly 3 times before failing');

  // ------------------------------------------------------- malformed bodies
  section('5. Malformed and inconsistent payloads are never accepted');
  useResponder(reply(200, { success: false, error: 'GSTIN not found in database' }));
  const softNotFound = await provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN);
  assert(softNotFound === null, 'success:false "not found" -> null');

  useResponder(reply(200, { success: false, error: 'Something else broke' }));
  const softError = await captureError(() => provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN));
  assert(softError?.code === 'LOOKUP_FAILED', 'success:false (other) -> LOOKUP_FAILED');

  useResponder(reply(200, { success: true, gstin: '24ZZZZZ9999Z1Z9', data: { legal_name: 'WRONG CO' } }));
  const mismatch = await captureError(() => provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN));
  assert(mismatch?.code === 'GSTIN_MISMATCH', 'Returned GSTIN that differs from the request is rejected');

  useResponder(reply(200, { success: true, gstin: DOCUMENTED_TEST_GSTIN, data: { status: 'Active' } }));
  const noName = await captureError(() => provider.verifyGSTIN(DOCUMENTED_TEST_GSTIN));
  assert(noName?.code === 'PROVIDER_ERROR', 'Missing legal_name is an error, not an invented name');

  // ------------------------------------------------------------ config guard
  section('6. Missing provider configuration');
  const unconfigured = new GSTINAPIProvider({ apiKey: '', baseUrl });
  const e503 = await captureError(() => unconfigured.verifyGSTIN(DOCUMENTED_TEST_GSTIN));
  assert(e503?.code === 'NOT_CONFIGURED' && e503?.statusCode === 503, 'No API key -> NOT_CONFIGURED (503)');
  assert(unconfigured.getProviderStatus().isConfigured === false, 'Provider status reports not configured');

  // ----------------------------------------------------- cache + refresh ---
  section('7. Cache and manual refresh (Requirement 12)');
  try {
    const { PrismaClient } = await import('@prisma/client');
    const { GSTINService } = await import('../src/services/gstin/gstinService.js');
    const prisma = new PrismaClient();
    const company = await prisma.company.findFirst({ select: { id: true } });

    if (!company) {
      console.log('  SKIP  no company row available for the cache test');
    } else {
      const service = new GSTINService();
      service.setProvider(provider);
      service.clearCache();

      useResponder(reply(200, successPayload()));
      const first = await service.verify(company.id, DOCUMENTED_TEST_GSTIN);
      assert(first.source === 'EXTERNAL_API', 'First call is a fresh provider lookup');

      const firstCount = requestCount;
      const second = await service.verify(company.id, DOCUMENTED_TEST_GSTIN);
      assert(second.source === 'CACHED', 'Second call is served from cache');
      assert(typeof second.cachedAt === 'string', 'Cached result carries cachedAt');
      assert(requestCount === firstCount, 'Cached call makes no additional HTTP request');

      const refreshed = await service.verify(company.id, DOCUMENTED_TEST_GSTIN, true);
      assert(refreshed.source === 'EXTERNAL_API', 'Manual refresh bypasses the cache');
      assert(requestCount === firstCount + 1, 'Manual refresh performs exactly one provider call');

      const invalid = await captureError(() => service.verify(company.id, '12345INVALID'));
      assert(invalid?.statusCode === 400, 'Format validation runs before any provider call');
    }
    await prisma.$disconnect();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log('  SKIP  cache/refresh test needs the local database: ' + message);
  }

  // ------------------------------------------------------------- live check
  if (process.env.GSTIN_LIVE_TEST === '1') {
    section('8. Live provider check (spends 1 credit)');
    const live = new GSTINAPIProvider();
    const status = live.getProviderStatus();
    if (!status.isConfigured) {
      console.log('  SKIP  GSTIN_API_KEY is empty in backend/.env');
    } else {
      try {
        const result = await live.verifyGSTIN(DOCUMENTED_TEST_GSTIN);
        console.log('  live legal name      : ' + (result?.legalName ?? '(not found)'));
        console.log('  live status          : ' + (result?.status ?? '-'));
        console.log('  credits_remaining    : ' + String(live.lastCreditsRemaining));
      } catch (err) {
        const code = (err as RaisedError).code;
        console.log('  live check failed    : ' + code + ' - ' + (err as Error).message);
      }
    }
  } else {
    section('8. Live provider check');
    console.log('  SKIP  set GSTIN_LIVE_TEST=1 to spend one credit on the documented test GSTIN');
  }

  server.close();
  console.log('\n================================================================');
  console.log(` RESULT: ${failed === 0 ? 'PASS' : 'FAIL'} - ${passed} passed, ${failed} failed`);
  console.log(' Credits spent: 0 (all responses replayed locally)');
  console.log('================================================================');
  if (failed > 0) {
    for (const failure of failures) console.error('  - ' + failure);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Test harness crashed:', err);
  server.close();
  process.exit(1);
});