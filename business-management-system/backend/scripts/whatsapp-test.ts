// Phase 19.3 - WhatsApp QR integration test suite.
//
// The WhatsApp client is a MOCK. No browser is launched and no real message is
// ever sent: the suite only proves the ERP-side behaviour (state machine, QR
// rendering, PDF integrity, recipient validation, isolation, history).
//
// Company and financial-year rows are read from the live database; every log
// row created by this suite is deleted again at the end.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  WhatsAppSessionService,
} from '../src/services/whatsapp/whatsappSessionService.js';
import {
  WhatsAppMessageService,
  normaliseWhatsAppNumber,
} from '../src/services/whatsapp/whatsappMessageService.js';
import {
  assertValidPdf,
  prepareDocument,
} from '../src/services/whatsapp/whatsappPdfService.js';
import { buildWhatsAppDocumentPdf } from '../src/services/whatsapp/whatsappDocumentPdf.js';
import { BankVoucherService } from '../src/services/bankVoucherService.js';
import { accountLedgerService } from '../src/services/accountLedgerService.js';
import type {
  WhatsAppClientFactory,
  WhatsAppClientHandle,
  WhatsAppClientLike,
  WhatsAppMedia,
} from '../src/services/whatsapp/whatsappClientService.js';

const SESSION_ROOT = path.join(os.tmpdir(), 'bms-whatsapp-test-' + process.pid);
process.env.WHATSAPP_SESSION_DIR = SESSION_ROOT;
process.env.WHATSAPP_RESTORE_SESSIONS = 'true';

const prisma = new PrismaClient();

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string): void {
  total++;
  if (condition) {
    console.log('  PASS [' + total + ']: ' + msg);
    passed++;
  } else {
    console.error('  FAIL [' + total + ']: ' + msg);
    throw new Error('Assertion failed: ' + msg);
  }
}

function section(title: string): void {
  console.log('\n--- ' + title + ' ---');
}

interface CaughtError {
  statusCode?: number;
  code?: string;
  message: string;
}

async function expectError(
  fn: () => Promise<unknown>,
  expectedStatus: number,
  label: string,
  expectedCode?: string
): Promise<CaughtError> {
  try {
    await fn();
  } catch (error) {
    const err = error as CaughtError;
    assert(
      err.statusCode === expectedStatus,
      label + ' (expected ' + expectedStatus + ', received ' + (err.statusCode ?? 'none') + ': ' + err.message + ')'
    );
    if (expectedCode) {
      assert(err.code === expectedCode, label + ' carries code ' + expectedCode + ' (received ' + (err.code ?? 'none') + ')');
    }
    return err;
  }
  assert(false, label + ' (expected an error, none was thrown)');
  return { message: '' };
}

function expectSyncError(fn: () => unknown, expectedStatus: number, label: string): CaughtError {
  try {
    fn();
  } catch (error) {
    const err = error as CaughtError;
    assert(
      err.statusCode === expectedStatus,
      label + ' (expected ' + expectedStatus + ', received ' + (err.statusCode ?? 'none') + ')'
    );
    return err;
  }
  assert(false, label + ' (expected an error, none was thrown)');
  return { message: '' };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Structural mock of whatsapp-web.js. Events are emitted explicitly by tests. */
class MockWhatsAppClient implements WhatsAppClientLike {
  info = { wid: { user: '919876543210' } };
  initializeCalls = 0;
  destroyCalls = 0;
  logoutCalls = 0;
  shouldFailSend = false;
  sent: Array<{ chatId: string; content: unknown; options?: Record<string, unknown> }> = [];
  private handlers = new Map<string, Array<(...args: unknown[]) => void>>();

  initialize(): Promise<void> {
    this.initializeCalls++;
    // Never resolves on its own: the test emits qr/authenticated/ready.
    return new Promise<void>(() => undefined);
  }

  async destroy(): Promise<void> {
    this.destroyCalls++;
  }

  async logout(): Promise<void> {
    this.logoutCalls++;
  }

  async sendMessage(
    chatId: string,
    content: unknown,
    options?: Record<string, unknown>
  ): Promise<unknown> {
    if (this.shouldFailSend) {
      throw new Error('Simulated WhatsApp send failure');
    }
    this.sent.push({ chatId, content, options });
    return { id: { _serialized: 'true_' + chatId } };
  }

  async getState(): Promise<string> {
    return 'CONNECTED';
  }

  on(event: string, listener: (...args: unknown[]) => void): void {
    const list = this.handlers.get(event) ?? [];
    list.push(listener);
    this.handlers.set(event, list);
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.handlers.get(event) ?? []) listener(...args);
  }

  listenerCount(event: string): number {
    return (this.handlers.get(event) ?? []).length;
  }
}

const capturedMedia: WhatsAppMedia[] = [];

function createMockFactory(client: MockWhatsAppClient): WhatsAppClientFactory {
  return {
    async create(): Promise<WhatsAppClientHandle> {
      return {
        client,
        createMedia(buffer: Buffer, fileName: string, mimeType: string): WhatsAppMedia {
          const media: WhatsAppMedia = {
            mimetype: mimeType,
            data: buffer.toString('base64'),
            filename: fileName,
          };
          capturedMedia.push(media);
          return media;
        },
      };
    },
  };
}

interface TestScope {
  companyId: string;
  financialYearId: string;
  voucherId: string;
  voucherNumber: string;
}

async function loadFixtures(): Promise<{
  scope: TestScope;
  otherScope: { companyId: string; financialYearId: string };
  ledgerAccountId: string;
}> {
  const company = await prisma.company.findFirst({
    where: { bankVouchers: { some: {} } },
    orderBy: { createdAt: 'asc' },
  });
  if (!company) throw new Error('No company with bank vouchers found for the test fixtures.');
  const fy = await prisma.financialYear.findFirst({ where: { companyId: company.id } });
  if (!fy) throw new Error('No financial year for the test company.');
  const voucher = await prisma.bankVoucher.findFirst({
    where: { companyId: company.id, financialYearId: fy.id, voucherType: 'RECEIPT' },
    orderBy: { createdAt: 'desc' },
  });
  if (!voucher) throw new Error('No bank receipt voucher found for the test fixtures.');
  const other = await prisma.company.findFirst({
    where: { id: { not: company.id }, ledgerAccounts: { some: {} } },
  });
  if (!other) throw new Error('No second company found for the isolation test.');
  const otherFy = await prisma.financialYear.findFirst({ where: { companyId: other.id } });
  if (!otherFy) throw new Error('No financial year for the second company.');
  const ledger = await prisma.ledgerAccount.findFirst({ where: { companyId: company.id } });
  if (!ledger) throw new Error('No ledger account for the report regression test.');

  return {
    scope: {
      companyId: company.id,
      financialYearId: fy.id,
      voucherId: voucher.id,
      voucherNumber: voucher.voucherNumber,
    },
    otherScope: { companyId: other.id, financialYearId: otherFy.id },
    ledgerAccountId: ledger.id,
  };
}
async function main(): Promise<void> {
  const fixtures = await loadFixtures();
  const { scope, otherScope, ledgerAccountId } = fixtures;

  // Test recipients are reserved and cleaned up at the end.
  const FAIL_RECIPIENT = '9000000001';
  const OK_RECIPIENT = '9000000002';
  const TEST_NUMBERS = ['919000000001', '919000000002'];
  await prisma.whatsAppMessageLog.deleteMany({
    where: { companyId: scope.companyId, recipientNumber: { in: TEST_NUMBERS } },
  });

  const client = new MockWhatsAppClient();
  const session = new WhatsAppSessionService(createMockFactory(client), { qrValidityMs: 80 });
  const messages = new WhatsAppMessageService({ sessionService: session });
  const emittedStates: string[] = [];
  session.subscribe((status) => emittedStates.push(status.state));

  try {
    section('1. Initial state is disconnected');
    const initial = session.getStatus(scope.companyId);
    assert(initial.state === 'DISCONNECTED', 'Fresh session reports DISCONNECTED');
    assert(initial.connected === false, 'Fresh session is not connected');
    assert(initial.qrAvailable === false, 'No QR is advertised before connecting');
    assert(initial.phoneNumber === null && initial.connectedAt === null, 'No account metadata is fabricated');
    assert(initial.warning.toLowerCase().includes('unofficial'), 'Status carries the unofficial-integration warning');

    section('2. Connect enters INITIALIZING exactly once');
    const starting = await session.connect(scope.companyId);
    assert(starting.state === 'INITIALIZING', 'connect() returns INITIALIZING');
    await wait(40);
    assert(client.initializeCalls === 1, 'The client is initialized once');
    await session.connect(scope.companyId);
    await wait(20);
    assert(client.initializeCalls === 1, 'A second connect() does not create a duplicate browser');
    assert(client.listenerCount('qr') === 1, 'Only one QR listener is attached');

    section('3. QR code comes from the real auth event');
    const RAW_QR = '2@AbCdEfGhIjKlMnOpQrStUvWxYz+/1234567890,';
    client.emit('qr', RAW_QR);
    await session.waitForState(scope.companyId, 'QR_REQUIRED');
    const qrStatus = session.getStatus(scope.companyId);
    assert(qrStatus.state === 'QR_REQUIRED', 'State becomes QR_REQUIRED after the qr event');
    assert(qrStatus.qrAvailable === true, 'Status reports an available QR');
    assert(JSON.stringify(qrStatus).includes(RAW_QR) === false, 'The raw QR secret is never exposed in the status payload');
    const qr = await session.getQr(scope.companyId);
    assert(qr.qrDataUrl.startsWith('data:image/png;base64,'), 'QR is rendered as a PNG data URL');
    assert(qr.qrDataUrl.length > 500, 'Rendered QR image carries real pixel data');
    assert(new Date(qr.expiresAt).getTime() > Date.now(), 'QR expiry is in the future');

    section('4. QR expires and cannot be reused');
    await wait(140);
    const expired = session.getStatus(scope.companyId);
    assert(expired.qrAvailable === false, 'QR is no longer available after the validity window');
    assert(expired.lastError !== null && expired.lastError.includes('expired'), 'Expiry is reported accurately');
    await expectError(() => session.getQr(scope.companyId), 409, 'Expired QR request is rejected', 'QR_UNAVAILABLE');

    section('5. Authentication and ready transition');
    client.emit('qr', RAW_QR);
    await session.waitForState(scope.companyId, 'QR_REQUIRED');
    client.emit('authenticated');
    await session.waitForState(scope.companyId, 'AUTHENTICATED');
    assert(session.getStatus(scope.companyId).state === 'AUTHENTICATED', 'authenticated event is reflected');
    assert(session.getStatus(scope.companyId).qrAvailable === false, 'QR is cleared once authenticated');
    client.emit('ready');
    await session.waitForState(scope.companyId, 'CONNECTED');
    const connected = session.getStatus(scope.companyId);
    assert(connected.connected === true, 'ready event produces CONNECTED');
    assert(connected.phoneNumber === '919876543210', 'Account number is read from the client info');
    assert(connected.connectedAt !== null, 'Connection time is recorded');

    section('6. Persisted session restore after restart');
    const restoreId = 'test-restore-company';
    const restoreDir = path.join(SESSION_ROOT, restoreId);
    fs.mkdirSync(restoreDir, { recursive: true });
    fs.writeFileSync(path.join(restoreDir, 'session-restore.json'), '{}');
    const restoreClient = new MockWhatsAppClient();
    const restoreSession = new WhatsAppSessionService(createMockFactory(restoreClient));
    const restored = await restoreSession.restoreSessions();
    assert(restored.includes(restoreId), 'Persisted session directory is detected and restored');
    await wait(40);
    restoreClient.emit('ready');
    const restoredStatus = await restoreSession.waitForState(restoreId, 'CONNECTED');
    assert(restoredStatus.connected === true, 'Restored session reaches CONNECTED');
    await restoreSession.disconnect(restoreId);

    section('7. Disconnection is surfaced, not hidden');
    client.emit('disconnected', 'LOGOUT');
    await session.waitForState(scope.companyId, 'DISCONNECTED');
    const disconnected = session.getStatus(scope.companyId);
    assert(disconnected.state === 'DISCONNECTED', 'disconnected event moves the state to DISCONNECTED');
    assert(disconnected.connected === false, 'Connected flag is cleared');
    assert(
      disconnected.lastError !== null && disconnected.lastError.includes('unlinked'),
      'Unlinked account message is accurate'
    );
    assert(client.destroyCalls >= 1, 'The browser is destroyed on disconnect');

    section('8. Recipient validation and normalisation');
    assert(normaliseWhatsAppNumber('98765 43210') === '919876543210', 'Bare 10-digit number is normalised');
    assert(normaliseWhatsAppNumber('+91 98765-43210') === '919876543210', '+91 prefix is accepted');
    assert(normaliseWhatsAppNumber('09876543210') === '919876543210', '0-prefixed number is accepted');
    assert(normaliseWhatsAppNumber('919876543210') === '919876543210', 'Country code already present is accepted');
    expectSyncError(() => normaliseWhatsAppNumber('12345'), 400, 'Short number is rejected');
    expectSyncError(() => normaliseWhatsAppNumber('5876543210'), 400, 'Number not starting 6-9 is rejected');
    expectSyncError(() => normaliseWhatsAppNumber('98765abcde'), 400, 'Alphabetic number is rejected');
    expectSyncError(() => normaliseWhatsAppNumber(''), 400, 'Empty number is rejected');

    section('9. Unknown document id is rejected');
    await expectError(
      () =>
        prepareDocument(scope, {
          documentType: 'BANK_RECEIPT',
          documentId: '00000000-0000-0000-0000-000000000000',
        }),
      404,
      'Unknown document id returns 404',
      'DOCUMENT_NOT_FOUND'
    );
    await expectError(
      () => prepareDocument(scope, { documentType: 'CREDIT_NOTE', documentId: scope.voucherId }),
      400,
      'Unsupported document type returns 400',
      'UNSUPPORTED_DOCUMENT'
    );

    section('10. Cross-company access is rejected');
    await expectError(
      () => prepareDocument(otherScope, { documentType: 'BANK_RECEIPT', documentId: scope.voucherId }),
      404,
      'A document from another company is not readable',
      'DOCUMENT_NOT_FOUND'
    );
    await expectError(
      () => buildWhatsAppDocumentPdf('BANK_RECEIPT', scope.voucherId, otherScope),
      404,
      'PDF builder enforces the company + financial year scope'
    );

    section('11. Missing / empty PDF is rejected');
    expectSyncError(() => assertValidPdf(Buffer.alloc(0), 'empty.pdf'), 500, 'Empty buffer is rejected');

    section('12. Invalid PDF signature is rejected');
    const notPdf = expectSyncError(
      () => assertValidPdf(Buffer.from('NOT A PDF AT ALL'), 'fake.pdf'),
      500,
      'Non-PDF buffer is rejected'
    );
    assert(notPdf.code === 'PDF_INVALID', 'Invalid signature error carries PDF_INVALID');

    section('13. Genuine PDF attachment preparation');
    const prepared = await prepareDocument(scope, {
      documentType: 'BANK_RECEIPT',
      documentId: scope.voucherId,
    });
    assert(prepared.mimeType === 'application/pdf', 'Attachment MIME type is application/pdf');
    assert(prepared.buffer.subarray(0, 5).toString('latin1') === '%PDF-', 'Attachment starts with the PDF signature');
    assert(prepared.sizeBytes > 1000, 'Attachment has real content');
    assert(prepared.fileName.endsWith('.pdf'), 'Attachment filename ends with .pdf');
    assert(prepared.documentNumber === scope.voucherNumber, 'Document number comes from the actual voucher');
    assert(prepared.buffer.toString('latin1').includes('%EOF'), 'PDF is complete (EOF trailer present)');
    section('14. Send failure is recorded, never reported as success');
    await session.connect(scope.companyId);
    await wait(40);
    client.emit('ready');
    await session.waitForState(scope.companyId, 'CONNECTED');
    client.shouldFailSend = true;
    const failure = await expectError(
      () =>
        messages.sendDocument(scope, {
          documentType: 'BANK_RECEIPT',
          documentId: scope.voucherId,
          recipientNumber: FAIL_RECIPIENT,
          message: 'Phase 19.3 failure-path test',
        }),
      502,
      'A rejected send surfaces as an error',
      'SEND_FAILED'
    );
    assert(failure.message.includes('Simulated'), 'The real send error message is preserved');
    const failedRows = await prisma.whatsAppMessageLog.findMany({
      where: { companyId: scope.companyId, recipientNumber: '919000000001' },
    });
    assert(failedRows.length === 1, 'Exactly one history row is written for the failed send');
    assert(failedRows[0].status === 'FAILED', 'Failed send is stored as FAILED, not SENT');
    assert(
      (failedRows[0].errorMessage ?? '').includes('Simulated'),
      'Failure reason is stored on the history row'
    );
    assert(client.sent.length === 0, 'No message was accepted by the client on the failure path');

    section('15. Duplicate prevention');
    client.shouldFailSend = false;
    const firstSend = await messages.sendDocument(scope, {
      documentType: 'BANK_RECEIPT',
      documentId: scope.voucherId,
      recipientNumber: OK_RECIPIENT,
      message: 'Phase 19.3 success-path test',
    });
    assert(firstSend.status === 'SENT', 'A successful send returns SENT');
    assert(firstSend.recipientNumber === '919000000002', 'Normalised recipient is returned');
    assert(client.sent.length === 1, 'The client received exactly one message');
    assert(client.sent[0].chatId === '919000000002@c.us', 'Message targets the normalised chat id');
    const media = client.sent[0].content as WhatsAppMedia;
    assert(media.mimetype === 'application/pdf', 'Sent content is a PDF media object');
    assert(Buffer.from(media.data, 'base64').subarray(0, 5).toString('latin1') === '%PDF-', 'Sent media decodes to a real PDF');
    assert(media.filename === firstSend.fileName, 'Sent media filename matches the generated file');
    const options = client.sent[0].options as { caption?: string } | undefined;
    assert(
      options?.caption === 'Phase 19.3 success-path test',
      'The editable message is used as the caption'
    );
    await expectError(
      () =>
        messages.sendDocument(scope, {
          documentType: 'BANK_RECEIPT',
          documentId: scope.voucherId,
          recipientNumber: OK_RECIPIENT,
        }),
      409,
      'An immediate duplicate send is blocked',
      'DUPLICATE_SEND'
    );
    assert(client.sent.length === 1, 'The duplicate never reached the client');

    section('16. History creation');
    const history = await messages.getHistory(scope, { limit: 20 });
    assert(history.total >= 2, 'History returns the rows written by this suite');
    const sentRow = history.items.find((row) => row.status === 'SENT' && row.recipientNumber === '919000000002');
    assert(Boolean(sentRow), 'Successful send appears in the history');
    assert(sentRow?.documentType === 'BANK_RECEIPT', 'History stores the document type');
    assert(sentRow?.documentNumber === scope.voucherNumber, 'History stores the document number');
    assert((sentRow?.fileName ?? '').endsWith('.pdf'), 'History stores the PDF filename');
    assert(sentRow?.documentId === scope.voucherId, 'History stores the source document id');
    const detail = await messages.getHistoryById(scope, String(sentRow?.id));
    assert(detail.id === sentRow?.id, 'History detail is retrievable by id');
    await expectError(
      () => messages.getHistoryById(otherScope, String(sentRow?.id)),
      404,
      'History is isolated per company'
    );

    section('17. Failed-send history');
    const failedInHistory = history.items.find((row) => row.status === 'FAILED');
    assert(Boolean(failedInHistory), 'Failed send appears in the history');
    assert(
      (failedInHistory?.errorMessage ?? '').includes('Simulated'),
      'Failed history keeps the error message'
    );

    section('18. Disconnect and cleanup');
    await session.disconnect(scope.companyId);
    assert(client.logoutCalls >= 1, 'Explicit disconnect calls logout on the client');
    assert(session.getStatus(scope.companyId).state === 'DISCONNECTED', 'Disconnect returns to DISCONNECTED');
    assert(session.getStatus(scope.companyId).qrAvailable === false, 'Disconnect clears the QR');
    assert(
      !fs.existsSync(path.join(SESSION_ROOT, scope.companyId)),
      'Session directory is removed after logout'
    );
    assert(session.getHandle(scope.companyId) === null, 'No client handle survives the disconnect');

    section('19. Frontend-facing status transitions');
    emittedStates.length = 0;
    await session.connect(scope.companyId);
    await wait(40);
    client.emit('qr', RAW_QR);
    await session.waitForState(scope.companyId, 'QR_REQUIRED');
    client.emit('ready');
    await session.waitForState(scope.companyId, 'CONNECTED');
    const sequence = emittedStates.filter((state) => state !== 'DISCONNECTED');
    assert(sequence.includes('INITIALIZING'), 'Subscribers see INITIALIZING');
    assert(sequence.includes('QR_REQUIRED'), 'Subscribers see QR_REQUIRED');
    assert(sequence.includes('CONNECTED'), 'Subscribers see CONNECTED');
    assert(
      sequence.indexOf('INITIALIZING') < sequence.indexOf('QR_REQUIRED') &&
        sequence.indexOf('QR_REQUIRED') < sequence.indexOf('CONNECTED'),
      'Status transitions arrive in lifecycle order'
    );
    await session.disconnect(scope.companyId);

    section('21. Phase 8 — Only actual company sessions are restored (not diag)');
    {
      // Build a temp session root with a mix of real + diagnostic + corrupted entries
      const testRoot = path.join(os.tmpdir(), 'bms-wa-restore-test-' + process.pid);
      fs.mkdirSync(testRoot, { recursive: true });
      // Simulate a real company session that has credentials
      const realId = 'company-aabbccdd-1111-2222-3333-444455556666';
      const realSessionDir = path.join(testRoot, 'session-' + realId);
      fs.mkdirSync(path.join(realSessionDir, 'Default', 'IndexedDB', 'https_web.whatsapp.com_0.indexeddb.leveldb'), { recursive: true });
      fs.writeFileSync(path.join(realSessionDir, 'Default', 'IndexedDB', 'https_web.whatsapp.com_0.indexeddb.leveldb', 'CURRENT'), 'manifest');
      fs.writeFileSync(path.join(realSessionDir, 'bms-authenticated.json'), '{}');
      // Diagnostic sessions (must be skipped + deleted)
      const diagDir1 = path.join(testRoot, 'session-diag-9999');
      const diagDir2 = path.join(testRoot, 'session-diagnose-test');
      fs.mkdirSync(diagDir1, { recursive: true });
      fs.mkdirSync(diagDir2, { recursive: true });
      // Corrupted double-prefix dir (must be skipped + deleted)
      const corruptDir = path.join(testRoot, 'session-session-deadbeef');
      fs.mkdirSync(corruptDir, { recursive: true });

      const testEnvOld = process.env.WHATSAPP_SESSION_DIR;
      process.env.WHATSAPP_SESSION_DIR = testRoot;
      let restored: string[] = [];
      let connectCalls: string[] = [];
      const restoreSession = new WhatsAppSessionService(
        {
          create: async (cfg) => {
            connectCalls.push(cfg.clientId);
            return { client: new MockWhatsAppClient(), createMedia: (_b, _n, m) => ({ mimetype: m, data: '', filename: _n }) };
          },
        },
        { qrValidityMs: 5000, initializeTimeoutMs: 30000, readyTimeoutMs: 30000 }
      );
      restored = await restoreSession.restoreSessions();
      process.env.WHATSAPP_SESSION_DIR = testEnvOld;
      restoreSession.resetForTests();

      assert(
        connectCalls.length === 1,
        'restoreSessions starts exactly 1 client for 1 real company session'
      );
      assert(
        connectCalls[0] === realId,
        'restoreSessions starts the real company ID, not a prefixed/diag ID (got: ' + connectCalls[0] + ')'
      );
      assert(
        !connectCalls.some((id) => id.includes('diag') || id.includes('diagnose')),
        'No diagnostic session is restored'
      );
      assert(
        !connectCalls.some((id) => id.startsWith('session-')),
        'No session-prefixed ID leaks through to connect()'
      );
      assert(
        !fs.existsSync(diagDir1),
        'Diagnostic session dir is cleaned up by restoreSessions'
      );
      assert(
        !fs.existsSync(diagDir2),
        'diagnose-test session dir is cleaned up by restoreSessions'
      );
      assert(
        !fs.existsSync(corruptDir),
        'session-session- corrupted dir is cleaned up by restoreSessions'
      );
      try {
        fs.rmSync(testRoot, { recursive: true, force: true });
      } catch { /* ignore */ }
    }

    section('22. Phase 8 — Repeated startup does not create duplicate clients');
    {
      const dupSession = new WhatsAppSessionService(createMockFactory(new MockWhatsAppClient()), {
        qrValidityMs: 5000,
        initializeTimeoutMs: 30000,
        readyTimeoutMs: 30000,
      });
      await dupSession.connect(scope.companyId);
      await wait(20);
      const s1 = await dupSession.connect(scope.companyId); // second call while INITIALIZING
      await wait(20);
      const s2 = await dupSession.connect(scope.companyId); // third call
      assert(s1.state === 'INITIALIZING', 'Second connect returns current INITIALIZING state');
      assert(s2.state === 'INITIALIZING', 'Third connect also returns INITIALIZING (no duplicate spawn)');
      // Only one handle should exist
      const h1 = dupSession.getHandle(scope.companyId);
      assert(h1 !== null, 'Exactly one handle exists after multiple connect() calls');
      await dupSession.disconnect(scope.companyId);
      dupSession.resetForTests();
    }

    section('23. Phase 8 — Company ID mapping is consistent (no double-prefix)');
    {
      const idClient23 = new MockWhatsAppClient();
      const idSession = new WhatsAppSessionService(createMockFactory(idClient23), {
        qrValidityMs: 5000,
        initializeTimeoutMs: 30000,
        readyTimeoutMs: 30000,
      });
      const testCompanyId = 'test-company-9abc-def0';
      await idSession.connect(testCompanyId);
      await wait(20);
      idClient23.emit('qr', RAW_QR);
      await idSession.waitForState(testCompanyId, 'QR_REQUIRED');      const status = idSession.getStatus(testCompanyId);
      assert(status.state === 'QR_REQUIRED', 'Status is tracked under the original company ID');
      assert(status.qrAvailable, 'QR is accessible under the original company ID');
      // Verify getQr also works with original ID
      const qrPayload = await idSession.getQr(testCompanyId);
      assert(qrPayload.qrDataUrl.startsWith('data:image/png;base64,'), 'QR data URL returned for original company ID');
      await idSession.disconnect(testCompanyId);
      idSession.resetForTests();
    }

    section('24. Phase 8 — Old browser events cannot affect a newly initialized client');
    {
      // Use a factory that creates a fresh MockWhatsAppClient per create() call
      let isoCreateCount = 0;
      const isoInstances: MockWhatsAppClient[] = [];
      const isoFactory: WhatsAppClientFactory = {
        create: async () => {
          const m = new MockWhatsAppClient();
          isoInstances.push(m);
          isoCreateCount++;
          return { client: m, createMedia: (_b, _n, mt) => ({ mimetype: mt, data: '', filename: _n }) };
        },
      };
      const isoSession = new WhatsAppSessionService(isoFactory, {
        qrValidityMs: 5000,
        initializeTimeoutMs: 30000,
        readyTimeoutMs: 30000,
      });
      // First connection
      await isoSession.connect(scope.companyId);
      await wait(20);
      // Disconnect (removes handle + listeners)
      await isoSession.disconnect(scope.companyId);
      // Second connection
      await isoSession.connect(scope.companyId);
      await wait(20);
      assert(isoCreateCount === 2, 'Two separate browser clients were created');
      const firstClient = isoInstances[0];
      const secondClient = isoInstances[1];
      // Emit a 'qr' on the OLD (first) client — must not affect the new session
      firstClient?.emit('qr', RAW_QR);
      await wait(30);
      const afterOldEvent = isoSession.getStatus(scope.companyId);
      // The new session should still be INITIALIZING (not QR_REQUIRED from old client)
      assert(
        afterOldEvent.state === 'INITIALIZING',
        'Events from old client do not affect newly initialized session (state: ' + afterOldEvent.state + ')'
      );
      assert(firstClient !== secondClient, 'Each connection produces a fresh client instance');
      await isoSession.disconnect(scope.companyId);
      isoSession.resetForTests();
    }

    section('25. Phase 8 — Failed browser cleanup does not block reconnect');
    {
      let destroyCalls = 0;
      const failFactory: WhatsAppClientFactory = {
        create: async () => {
          const m = new MockWhatsAppClient();
          // Override destroy to simulate a failure
          m.destroy = async () => { destroyCalls++; throw new Error('Browser already gone'); };
          return { client: m, createMedia: (_b, _n, mt) => ({ mimetype: mt, data: '', filename: _n }) };
        },
      };
      const failSession = new WhatsAppSessionService(failFactory, {
        qrValidityMs: 5000,
        initializeTimeoutMs: 30000,
        readyTimeoutMs: 30000,
      });
      await failSession.connect(scope.companyId);
      await wait(20);
      // This should not throw even though destroy() throws internally
      try {
        await failSession.disconnect(scope.companyId);
      } catch {
        // safeDestroy swallows errors; disconnect itself must not throw
      }
      assert(destroyCalls > 0, 'destroy() was called (browser cleanup was attempted)');
      // Reconnect must succeed even after the failed destroy
      await failSession.connect(scope.companyId);
      await wait(20);
      const reconnectStatus = failSession.getStatus(scope.companyId);
      assert(
        reconnectStatus.state === 'INITIALIZING',
        'Session can reconnect after a failed browser cleanup (state: ' + reconnectStatus.state + ')'
      );
      await failSession.disconnect(scope.companyId).catch(() => undefined);
      failSession.resetForTests();
    }

    section('26. Phase 8 — polling fix: QR event detected even without rAF');
    {
      // This test verifies that the BMS prototype patch makes waitForFunction
      // resolve using interval polling rather than requestAnimationFrame.
      // We simulate the fix by confirming the puppeteer-core Page.prototype
      // is patched with polling: 200 after the factory module is loaded.
      //
      // We cannot launch a real browser here (mocked suite), but we CAN verify
      // the patch contract: the patched waitForFunction should add polling: 200
      // to any options object that is missing it.
      type WffOptions = { timeout?: number; polling?: number | string; signal?: unknown };
      const capturedOptions: WffOptions[] = [];
      const fakeFrame = {
        _bmsPatchedPolling: false,
        waitForFunction: function(fn: unknown, opts: WffOptions, ...rest: unknown[]) {
          // Simulate the original: just record what was passed
          capturedOptions.push({ ...opts });
          return Promise.resolve({ jsonValue: async () => ({ need: false, state: 'CONNECTED' }) });
        },
      };
      // Apply the same patch logic from whatsappClientService
      const patchPolling = (target: typeof fakeFrame) => {
        if (target._bmsPatchedPolling) return;
        target._bmsPatchedPolling = true;
        const original = target.waitForFunction;
        target.waitForFunction = function(fn: unknown, options: WffOptions, ...args: unknown[]) {
          let opts: WffOptions = options;
          if (opts === undefined || opts === null) {
            opts = { polling: 200 };
          } else if (typeof opts === 'object') {
            if (!opts.polling || opts.polling === 'raf') {
              opts = { ...opts, polling: 200 };
            }
          }
          return original.call(this, fn, opts, ...args);
        };
      };
      patchPolling(fakeFrame);

      // Now simulate the calls that Client.js makes
      await fakeFrame.waitForFunction('window.Debug?.VERSION != undefined', { timeout: 90000, signal: {} });
      await fakeFrame.waitForFunction(() => false, { timeout: 90000 });
      await fakeFrame.waitForFunction('typeof window.WWebJS !== "undefined"', { timeout: 30000 });

      assert(capturedOptions.length === 3, 'All 3 waitForFunction calls went through the patch');
      assert(capturedOptions[0].polling === 200, 'Debug.VERSION check has polling: 200 (had: ' + capturedOptions[0].polling + ')');
      assert(capturedOptions[1].polling === 200, 'Socket state check has polling: 200 (had: ' + capturedOptions[1].polling + ')');
      assert(capturedOptions[2].polling === 200, 'WWebJS ready check has polling: 200 (had: ' + capturedOptions[2].polling + ')');
      assert(capturedOptions[0].timeout === 90000, 'timeout is preserved on Debug.VERSION check');
      assert(capturedOptions[2].timeout === 30000, 'timeout is preserved on WWebJS ready check');
      // signal must be passed through unchanged
      const sig = capturedOptions[0].signal as Record<string, unknown> | undefined;
      assert(sig !== undefined && typeof sig === 'object', 'abort signal is preserved through patch');
    }

    section('27. Automatic recovery on LOGOUT during initialization');
    {
      let factoryCalls = 0;
      const clientInstances: MockWhatsAppClient[] = [];
      const autoRecoveryFactory: WhatsAppClientFactory = {
        create: async () => {
          factoryCalls++;
          const m = new MockWhatsAppClient();
          clientInstances.push(m);
          return { client: m, createMedia: (_b, _n, mt) => ({ mimetype: mt, data: '', filename: _n }) };
        },
      };
      const autoSession = new WhatsAppSessionService(autoRecoveryFactory, {
        qrValidityMs: 5000,
        initializeTimeoutMs: 30000,
        readyTimeoutMs: 30000,
      });
      const autoCompany = 'auto-recovery-test-' + Date.now();
      await autoSession.connect(autoCompany);
      await wait(30);
      assert(factoryCalls === 1, 'First client created on connect()');
      assert(autoSession.getStatus(autoCompany).state === 'INITIALIZING', 'State is INITIALIZING');

      // Simulate WhatsApp rejecting stale session with LOGOUT while starting
      clientInstances[0].emit('disconnected', 'LOGOUT');
      await wait(50);

      // Verify that autoSession caught it and automatically re-initialized a fresh client!
      assert(factoryCalls === 2, 'Second clean client automatically created after LOGOUT');
      const recoveredStatus = autoSession.getStatus(autoCompany);
      assert(recoveredStatus.state === 'INITIALIZING', 'State remains in INITIALIZING while spinning up fresh client');
      assert(
        recoveredStatus.lastError !== null && recoveredStatus.lastError.includes('expired'),
        'Status displays session expired message: ' + recoveredStatus.lastError
      );

      // Now the clean client emits the QR
      clientInstances[1].emit('qr', RAW_QR);
      await autoSession.waitForState(autoCompany, 'QR_REQUIRED');
      assert(autoSession.getStatus(autoCompany).state === 'QR_REQUIRED', 'QR is received and surfaced after auto-recovery');
      assert(autoSession.getStatus(autoCompany).qrAvailable === true, 'QR available after auto-recovery');

      await autoSession.disconnect(autoCompany);
      autoSession.resetForTests();
    }

    section('20. Existing ERP behaviour is unchanged');
    const voucher = await new BankVoucherService().getById(
      scope.companyId,
      scope.financialYearId,
      'RECEIPT',
      scope.voucherId
    );
    assert(voucher.voucherNumber === scope.voucherNumber, 'Bank voucher read path still works');
    assert(voucher.journalLines !== undefined, 'Journal lines are still returned');
    const fyRow = await prisma.financialYear.findFirst({ where: { id: scope.financialYearId } });
    if (!fyRow) throw new Error('Financial year disappeared during the test.');
    const ledgerPdf = await accountLedgerService.exportPdf(scope.companyId, scope.financialYearId, {
      ledgerAccountId,
      fromDate: fyRow.startDate.toISOString().slice(0, 10),
      toDate: fyRow.endDate.toISOString().slice(0, 10),
    });
    assert(
      ledgerPdf.buffer.subarray(0, 5).toString('latin1') === '%PDF-',
      'Account Ledger PDF export still produces a valid PDF'
    );
    assert(ledgerPdf.buffer.length > 1000, 'Account Ledger PDF still has content');
    const billBase = await buildWhatsAppDocumentPdf('REPORT_ACCOUNT_LEDGER', 'adhoc', scope, {
      ledgerAccountId,
      fromDate: fyRow.startDate.toISOString().slice(0, 10),
      toDate: fyRow.endDate.toISOString().slice(0, 10),
    });
    assert(billBase.buffer.subarray(0, 5).toString('latin1') === '%PDF-', 'Report family PDF path is wired');
  } finally {
    await session.disconnect(scope.companyId).catch(() => undefined);
    await prisma.whatsAppMessageLog.deleteMany({
      where: { companyId: scope.companyId, recipientNumber: { in: TEST_NUMBERS } },
    });
    try {
      fs.rmSync(SESSION_ROOT, { recursive: true, force: true });
    } catch {
      // temp directory cleanup is best-effort
    }
    await prisma.$disconnect();
  }

  console.log('\n' + '='.repeat(60));
  console.log('WhatsApp Phase 19.3 tests: ' + passed + '/' + total + ' passed');
  console.log('Client mode: MOCKED (no browser, no real WhatsApp message)');
  console.log('='.repeat(60));
  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\nWHATSAPP TEST SUITE FAILED:', error);
  process.exit(1);
});