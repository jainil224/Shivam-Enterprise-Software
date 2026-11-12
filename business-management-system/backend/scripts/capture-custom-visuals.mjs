import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const PROJECT_ROOT = 'D:\\SIVAM Enterprise Software\\business-management-system';
const ARTIFACT_DIR = path.join(PROJECT_ROOT, 'documentation', 'screenshots', 'phase10-2');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9226;
const STATIC_PORT = 5186;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startStaticServer(distDir, port) {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || !path.extname(reqPath)) {
      reqPath = '/index.html';
    }
    const filePath = path.join(distDir, reqPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(path.join(distDir, 'index.html')));
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`Static server running on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

const MOCK_COMPANY = {
  id: 'company-mock',
  companyName: 'SHIVAM ENTERPRISE',
  companyCode: 'SHIVAM01',
  phone: '9909143989',
  address: '204, Ring Road, Surat',
  city: 'Surat',
  pincode: '395002',
  gstin: '24AABCS1234F1Z8',
};

const MOCK_FY = {
  id: 'fy-mock',
  yearName: '2026-2027',
  startDate: '2026-04-01T00:00:00.000Z',
  endDate: '2027-03-31T23:59:59.000Z',
  isActive: true,
  isLocked: false,
};

const MOCK_CHALLAN = {
  id: 'ch-mock-89',
  challanNumber: '1004',
  challanDate: '2026-11-12',
  status: 'CONFIRMED',
  lotNumber: 'LOT-80/72-MP',
  twist: '800 TPM',
  emptyCopsWeight: 0.04,
  companyId: 'company-mock',
  financialYearId: 'fy-mock',
  productionBookId: 'book-mock',
  productionBook: { id: 'book-mock', bookName: 'WEAVING SHED A - PRODUCTION', bookPrefix: 'PR-A' },
  machineId: 'm1',
  machine: { id: 'm1', machineNumber: 'LOOM-04', machineType: 'RAPIER' },
  operatorId: 'op1',
  operator: { id: 'op1', operatorName: 'RAMESHBHAI PATEL' },
  locationId: 'loc1',
  location: { id: 'loc1', locationName: 'MAIN GODOWN - BAY 2' },
  yarnQualityId: 'q1',
  yarnQuality: { id: 'q1', qualityName: '80/72 MICRO FILAMENT YARN', denier: '80' },
  yarnGradeId: 'g1',
  yarnGrade: { id: 'g1', gradeName: '1ST QUALITY' },
  totalCartons: 4,
  totalCops: 96,
  grossWeight: 128.090,
  tareWeight: 8.640,
  netWeight: 119.450,
  items: [
    { id: 'item-101', cartonNumber: '101', cartonWeight: 1.200, cops: 24, grossWeight: 31.620, copsWeight: 0.040, tareWeight: 2.160, netWeight: 29.460, averageWeight: 1.228, twist: '800', lotNumber: 'LOT-80/72-MP', shadeNo: 'NATURAL', grade: '1ST' },
    { id: 'item-102', cartonNumber: '102', cartonWeight: 1.200, cops: 24, grossWeight: 32.180, copsWeight: 0.040, tareWeight: 2.160, netWeight: 30.020, averageWeight: 1.251, twist: '800', lotNumber: 'LOT-80/72-MP', shadeNo: 'NATURAL', grade: '1ST' },
    { id: 'item-103', cartonNumber: '103', cartonWeight: 1.200, cops: 24, grossWeight: 31.840, copsWeight: 0.040, tareWeight: 2.160, netWeight: 29.680, averageWeight: 1.237, twist: '800', lotNumber: 'LOT-80/72-MP', shadeNo: 'NATURAL', grade: '1ST' },
    { id: 'item-104', cartonNumber: '104', cartonWeight: 1.200, cops: 24, grossWeight: 32.450, copsWeight: 0.040, tareWeight: 2.160, netWeight: 30.290, averageWeight: 1.262, twist: '800', lotNumber: 'LOT-80/72-MP', shadeNo: 'NATURAL', grade: '1ST' },
  ],
};

const MOCK_DEBIT_NOTE = {
  id: 'dn-101',
  noteNumber: 'DN-2026-0042',
  noteDate: '2026-11-12T00:00:00.000Z',
  debitNoteBookId: 'dnb-1',
  debitNoteBook: { id: 'dnb-1', bookName: 'PURCHASE RETURN & RATE DIFF', bookPrefix: 'DN' },
  partyId: 'party-1',
  party: {
    id: 'party-1',
    partyName: 'SHREE GANESH TEXTILE PROCESSORS',
    partyCode: 'P-SGT-01',
    city: 'Surat',
    gstin: '24AAAPG1234H1Z5',
    address: 'Ring Road, Surat',
  },
  reason: 'Rate Difference and Quality Shortage on Bill #PB-8821',
  totalAmount: 18450.00,
  taxableAmount: 17571.43,
  cgstAmount: 439.29,
  sgstAmount: 439.28,
  igstAmount: 0.00,
  netAmount: 18450.00,
  status: 'CONFIRMED',
  lines: [
    {
      id: 'dnl-1',
      description: 'Quality Shortage Claim - Denier deviation in Lot #41162N',
      quantity: 125.00,
      rate: 140.00,
      amount: 17500.00,
      hsnCode: '5402',
    },
    {
      id: 'dnl-2',
      description: 'Rate Difference on invoice PB-8821',
      quantity: 1.00,
      rate: 71.43,
      amount: 71.43,
      hsnCode: '9988',
    },
  ],
  bills: [
    {
      id: 'dnb-bill-1',
      purchaseBill: {
        id: 'pb-8821',
        billNumber: 'PB-8821',
        billDate: '2026-11-01T00:00:00.000Z',
        netAmount: 185000.00,
      },
      adjustedAmount: 18450.00,
    },
  ],
};

const MOCK_BANK_RECON = {
  bankLedger: { id: 'ledger-sbi', accountName: 'STATE BANK OF INDIA - C/A 3849102941', accountCode: '1101' },
  asOfDate: '2026-11-12',
  bookBalance: 485230.50,
  bankStatementBalance: 512480.50,
  unreconciledDifference: 0.00,
  unclearedDepositsCount: 3,
  unclearedDepositsAmount: 84250.00,
  unclearedChecksCount: 4,
  unclearedChecksAmount: 111500.00,
  transactions: [
    { id: 'tx-1', voucherNumber: 'BR-2026-0089', date: '2026-11-08', partyName: 'AMBICA WEAVING MILLS', chequeNumber: '448201', debit: 45000.00, credit: 0.00, clearanceDate: '2026-11-10', isCleared: true },
    { id: 'tx-2', voucherNumber: 'BP-2026-0112', date: '2026-11-09', partyName: 'RELIANCE INDUSTRIES YARN DIV', chequeNumber: '001923', debit: 0.00, credit: 75000.00, clearanceDate: '2026-11-11', isCleared: true },
    { id: 'tx-3', voucherNumber: 'BR-2026-0094', date: '2026-11-11', partyName: 'KRISHNA FABRICS', chequeNumber: '581290', debit: 39250.00, credit: 0.00, clearanceDate: null, isCleared: false },
    { id: 'tx-4', voucherNumber: 'BP-2026-0118', date: '2026-11-12', partyName: 'MODERN POWER TRANSMISSIONS', chequeNumber: '001924', debit: 0.00, credit: 36500.00, clearanceDate: null, isCleared: false },
  ],
  payments: [
    { id: 'p-1', date: '2026-11-12', chequeNo: '001924', partyName: 'MODERN POWER TRANSMISSIONS', amount: '36500.00', clearDate: null },
    { id: 'p-2', date: '2026-11-11', chequeNo: '001925', partyName: 'SARVODAYA TEXTILE LOGISTICS', amount: '22000.00', clearDate: null },
    { id: 'p-3', date: '2026-11-10', chequeNo: '001926', partyName: 'GUJARAT ELECTRICITY BOARD', amount: '53000.00', clearDate: null },
  ],
  receipts: [
    { id: 'r-1', date: '2026-11-11', chequeNo: '581290', partyName: 'KRISHNA FABRICS', amount: '39250.00', clearDate: null },
    { id: 'r-2', date: '2026-11-12', chequeNo: '719022', partyName: 'TIRUPATI TEXTILES', amount: '45000.00', clearDate: null },
  ],
  summary: {
    balanceAsPerCompany: 485230.50,
    addUnpresentedCheques: 111500.00,
    lessUncreditedCheques: 84250.00,
    balanceAsPerBank: 512480.50,
  },
};

function handleApiRequest(urlStr) {
  const url = new URL(urlStr);
  const pathname = url.pathname;
  let payload = { success: true, data: [] };

  if (pathname.includes('/companies/validate-context')) {
    payload = { success: true, data: { company: MOCK_COMPANY, financialYear: MOCK_FY } };
  } else if (pathname.endsWith('/companies')) {
    payload = { success: true, data: [MOCK_COMPANY] };
  } else if (pathname.endsWith('/financial-years')) {
    payload = { success: true, data: [MOCK_FY] };
  } else if (pathname.includes('/manufacturing/production-receive/next-numbers')) {
    payload = { success: true, data: { nextChallanNumber: 1004, nextCartonNumber: 101 } };
  } else if (pathname.includes('/manufacturing/production-receive/navigation')) {
    payload = { success: true, data: { previousId: null, nextId: null, firstId: 'ch-mock-89', lastId: 'ch-mock-89' } };
  } else if (pathname.includes('/manufacturing/production-receive/ch-mock-89')) {
    payload = { success: true, data: MOCK_CHALLAN };
  } else if (pathname.endsWith('/manufacturing/production-receive')) {
    payload = { success: true, data: [MOCK_CHALLAN], meta: { total: 1, page: 1, limit: 500 } };
  } else if (pathname.endsWith('/masters/production-books')) {
    payload = { success: true, data: [MOCK_CHALLAN.productionBook] };
  } else if (pathname.endsWith('/masters/machines')) {
    payload = { success: true, data: [MOCK_CHALLAN.machine] };
  } else if (pathname.endsWith('/masters/operators')) {
    payload = { success: true, data: [MOCK_CHALLAN.operator] };
  } else if (pathname.endsWith('/masters/locations')) {
    payload = { success: true, data: [MOCK_CHALLAN.location] };
  } else if (pathname.endsWith('/masters/yarn-qualities')) {
    payload = { success: true, data: [MOCK_CHALLAN.yarnQuality] };
  } else if (pathname.endsWith('/masters/yarn-grades')) {
    payload = { success: true, data: [MOCK_CHALLAN.yarnGrade] };
  } else if (pathname.endsWith('/masters/parties')) {
    payload = { success: true, data: [MOCK_DEBIT_NOTE.party] };
  } else if (pathname.includes('/transactions/debit-note-books')) {
    payload = { success: true, data: [MOCK_DEBIT_NOTE.debitNoteBook] };
  } else if (pathname.includes('/transactions/debit-notes/dn-101')) {
    payload = { success: true, data: MOCK_DEBIT_NOTE };
  } else if (pathname.includes('/transactions/debit-notes/next-number')) {
    payload = { success: true, data: { nextNoteNumber: 'DN-2026-0042' } };
  } else if (pathname.includes('/transactions/debit-notes/navigation')) {
    payload = { success: true, data: { previousId: null, nextId: null, firstId: 'dn-101', lastId: 'dn-101' } };
  } else if (pathname.includes('/transactions/debit-notes/print-range')) {
    payload = { success: true, data: [MOCK_DEBIT_NOTE] };
  } else if (pathname.includes('/transactions/debit-notes')) {
    payload = { success: true, data: [MOCK_DEBIT_NOTE], meta: { total: 1, page: 1, limit: 100 } };
  } else if (pathname.includes('/reports/bank-reconciliation/banks')) {
    payload = { success: true, data: [{ ledgerId: 'ledger-sbi', accountName: MOCK_BANK_RECON.bankLedger.accountName, accountCode: '1101' }] };
  } else if (pathname.includes('/reports/bank-reconciliation/statement')) {
    payload = {
      success: true,
      data: {
        scope: { asOfDate: '2026-11-12', bankLedgerId: 'ledger-sbi', companyId: 'company-mock' },
        company: MOCK_COMPANY,
        bankLedger: MOCK_BANK_RECON.bankLedger,
        balanceAsPerCompany: '485230.50',
        balanceAsPerBank: '512480.50',
        addUnpresentedPayments: '111500.00',
        lessUncreditedReceipts: '84250.00',
        payments: MOCK_BANK_RECON.payments,
        receipts: MOCK_BANK_RECON.receipts,
      },
    };
  } else if (pathname.includes('/reports/bank-reconciliation/transactions')) {
    payload = { success: true, data: { transactions: MOCK_BANK_RECON.transactions, meta: { total: 4 } } };
  } else if (pathname.includes('/reports/bank-reconciliation/summary')) {
    payload = { success: true, data: MOCK_BANK_RECON.summary };
  } else if (pathname.includes('/reports/bank-reconciliation')) {
    payload = { success: true, data: MOCK_BANK_RECON };
  }

  return payload;
}

async function connectToCdp(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) break;
    } catch {}
    await sleep(300);
  }

  const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let messageId = 1;
  const pendingRequests = new Map();

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.addEventListener('message', async (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }

    if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params;
      const url = request.url;
      try {
        if (url.includes('/api/')) {
          const bodyData = handleApiRequest(url);
          const bodyBuf = Buffer.from(JSON.stringify(bodyData), 'utf-8');
          await send('Fetch.fulfillRequest', {
            requestId,
            responseCode: 200,
            responseHeaders: [
              { name: 'Content-Type', value: 'application/json' },
              { name: 'Access-Control-Allow-Origin', value: '*' },
            ],
            body: bodyBuf.toString('base64'),
          });
        } else {
          await send('Fetch.continueRequest', { requestId });
        }
      } catch (err) {
        console.error('Error fulfilling fetch:', err);
        await send('Fetch.continueRequest', { requestId });
      }
    }
  });

  return { ws, send };
}

function writePng(send, filename) {
  return send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  }).then((result) => {
    const filePath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    console.log(`Saved screenshot: ${filename} (${fs.statSync(filePath).size} bytes)`);
  });
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const distDir = path.join(PROJECT_ROOT, 'frontend', 'dist');
  const staticServer = await startStaticServer(distDir, STATIC_PORT);

  console.log('Launching headless Chrome...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--disable-web-security',
      `--user-data-dir=${path.join(process.env.TEMP || 'C:\\Users\\Admin\\AppData\\Local\\Temp', 'bms-cdp-profile')}`,
      '--window-size=1480,1050',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  try {
    const { send } = await connectToCdp(DEBUG_PORT);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });

    const setContextScript = `
      sessionStorage.setItem('activeCompany', JSON.stringify(${JSON.stringify(MOCK_COMPANY)}));
      sessionStorage.setItem('activeFinancialYear', JSON.stringify(${JSON.stringify(MOCK_FY)}));
      sessionStorage.setItem('selectedBookId', 'book-mock');
      sessionStorage.setItem('selectedProductionBook', JSON.stringify(${JSON.stringify(MOCK_CHALLAN.productionBook)}));
    `;

    // 1. Production Receive Entry with populated rows and columns
    console.log('\n[1/5] Capturing Production Receive Entry (with data in rows and columns)...');
    await send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/manufacturing/production-receive/entry?id=ch-mock-89&bookId=book-mock` });
    await sleep(1500);
    await send('Runtime.evaluate', { expression: setContextScript });
    await sleep(500);
    await send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/manufacturing/production-receive/entry?id=ch-mock-89&bookId=book-mock` });
    await sleep(2500);
    await writePng(send, 'p10_2_shell_production_receive_entry.png');

    // 2. Bank Reconciliation Dashboard / Section View
    console.log('\n[2/5] Capturing Bank Reconciliation Section View...');
    await send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/reports/bank-reconciliation/ledger-sbi` });
    await sleep(2500);
    await writePng(send, 'bank_reconciliation_section.png');

    // 3. Bank Reconciliation Print Preview
    console.log('\n[3/5] Capturing Bank Reconciliation Print Preview...');
    await send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/reports/bank-reconciliation/ledger-sbi/print?asOfDate=2026-11-12` });
    await sleep(2500);
    await writePng(send, 'bank_reconciliation_print_preview.png');

    // 4. Debit Note Entry Screen
    console.log('\n[4/5] Capturing Debit Note Entry Screen...');
    await send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/transactions/debit-notes/dn-101/edit` });
    await sleep(2500);
    await writePng(send, 'debit_note_entry_section.png');

    // 5. Debit Note Print Preview (with formal Date)
    console.log('\n[5/5] Capturing Debit Note Print Preview (with date)...');
    await send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/transactions/debit-notes/dn-101/print` });
    await sleep(2500);
    await writePng(send, 'debit_note_print_preview.png');

    console.log('\nAll 5 visual captures completed successfully!');
  } finally {
    try { chromeProcess.kill(); } catch {}
    try { staticServer.close(); } catch {}
  }
}

main().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
