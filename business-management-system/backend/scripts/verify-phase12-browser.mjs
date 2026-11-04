import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const COMPANY_CODE = 'P12UI';
const COMPANY_NAME = 'SHIVAM ENTERPRISE (PHASE 12 UI)';
const ART_DIR = 'C:\\Users\\Admin\\AppData\\Local\\Temp\\opencode\\phase12-ui';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9226;
const DEV_SERVER_PORT = 5173;
const BASE = `http://127.0.0.1:${DEV_SERVER_PORT}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let passed = 0;
let failed = 0;
const failures = [];

function check(condition, label) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.error(`  FAIL: ${label}`);
  }
}

function launchChrome() {
  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${path.join(ART_DIR, 'chrome-profile')}`,
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1500,950',
    '--no-first-run',
    '--no-default-browser-check',
    '--host-resolver-rules=MAP localhost 127.0.0.1',
    'about:blank',
  ];
  return spawn(CHROME_PATH, args, { stdio: 'ignore', detached: false });
}

async function connectCDP() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
      const tabs = await res.json();
      const page = tabs.find((tab) => tab.type === 'page');
      if (page?.webSocketDebuggerUrl) {
        const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          ws.onopen = resolve;
          ws.onerror = reject;
        });
        return ws;
      }
    } catch {
      /* retry */
    }
    await sleep(300);
  }
  throw new Error('Could not connect to Chrome DevTools.');
}

let cdpId = 1;
const consoleErrors = [];

function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = cdpId++;
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', handler);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolve(msg.result);
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function attachConsoleCapture(ws) {
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      const description = msg.params?.exceptionDetails?.exception?.description ?? 'Unhandled exception';
      consoleErrors.push(description.split('\n')[0]);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      const text = (msg.params.args ?? [])
        .map((arg) => arg.value ?? arg.description ?? arg.type)
        .join(' ');
      consoleErrors.push(text);
    }
  });
}

async function evaluate(ws, expression) {
  const result = await send(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`evaluate failed: ${result.exceptionDetails.exception?.description ?? 'unknown'}`);
  }
  return result.result?.value;
}

async function waitFor(ws, expression, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(ws, expression)) return true;
    } catch {
      /* page still loading */
    }
    await sleep(200);
  }
  return false;
}

async function navigate(ws, url) {
  await send(ws, 'Page.navigate', { url });
  await sleep(500);
  await waitFor(ws, `document.readyState === 'complete' && document.body && document.body.innerText.length > 40`, 20000);
}

const bodyText = (ws) => evaluate(ws, 'document.body.innerText');
const pathname = (ws) => evaluate(ws, 'location.pathname');

async function waitForText(ws, needle, timeout = 20000) {
  return waitFor(
    ws,
    `document.body.innerText.toLowerCase().includes(${JSON.stringify(needle.toLowerCase())})`,
    timeout
  );
}

async function waitForVoucherView(ws, pathPattern, timeout = 20000) {
  return waitFor(
    ws,
    `new RegExp(${JSON.stringify(pathPattern)}).test(location.pathname) && document.body.innerText.toLowerCase().includes('voucher information')`,
    timeout
  );
}

async function clickText(ws, selector, needle) {
  return evaluate(
    ws,
    `(() => {
      const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
      const target = nodes.find((node) => (node.innerText || node.textContent || '').includes(${JSON.stringify(needle)}));
      if (!target) return false;
      target.click();
      return true;
    })()`
  );
}

async function setInput(ws, selector, value) {
  return evaluate(
    ws,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`
  );
}

async function selectValue(ws, selector, value) {
  return evaluate(
    ws,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return el.value === ${JSON.stringify(value)};
    })()`
  );
}

async function screenshot(ws, name) {
  const res = await send(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(ART_DIR, name), Buffer.from(res.data, 'base64'));
}

async function cleanup() {
  const companies = await prisma.company.findMany({
    where: { companyCode: { startsWith: COMPANY_CODE } },
    select: { id: true },
  });
  const companyIds = companies.map((row) => row.id);
  if (companyIds.length === 0) return;
  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankVoucher.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.voucherSequence.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.party.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.financialYear.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

async function seed() {
  await cleanup();

  const company = await prisma.company.create({
    data: {
      companyCode: COMPANY_CODE,
      companyName: COMPANY_NAME,
      gstin: '24AABCS1234F1Z8',
      address: 'Plot 12, Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      phone: '9876543210',
      email: 'accounts@shivam.example',
    },
  });

  const fy = await prisma.financialYear.create({
    data: {
      companyId: company.id,
      yearName: '2026 - 2027',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T00:00:00.000Z'),
      isActive: true,
      isLocked: false,
    },
  });

  const bank = await prisma.ledgerAccount.create({
    data: {
      companyId: company.id,
      accountCode: '1001',
      accountName: 'HDFC Bank Current A/c',
      accountGroup: 'BANK',
      accountType: 'ASSET',
      balanceType: 'DEBIT',
      openingBalance: '0.00',
      isBankAccount: true,
      bankName: 'HDFC Bank',
      branchName: 'Ring Road, Surat',
      accountHolderName: COMPANY_NAME,
      ifscCode: 'HDFC0001234',
      bankAccountNumber: '50200012345678',
    },
  });

  const secondBank = await prisma.ledgerAccount.create({
    data: {
      companyId: company.id,
      accountCode: '1002',
      accountName: 'ICICI Bank Current A/c',
      accountGroup: 'BANK',
      accountType: 'ASSET',
      balanceType: 'DEBIT',
      openingBalance: '0.00',
      isBankAccount: true,
      bankName: 'ICICI Bank',
      branchName: 'Adajan, Surat',
      ifscCode: 'ICIC0004567',
    },
  });

  const expense = await prisma.ledgerAccount.create({
    data: {
      companyId: company.id,
      accountCode: '5001',
      accountName: 'Office Rent',
      accountGroup: 'INDIRECT_EXPENSES',
      accountType: 'EXPENSE',
      balanceType: 'DEBIT',
      openingBalance: '0.00',
    },
  });

  const party = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P12UI01',
      partyName: 'Patel Yarn Traders',
      partyType: 'CUSTOMER',
      openingBalance: '0.00',
      balanceType: 'DEBIT',
    },
  });

  return {
    companyId: company.id,
    financialYearId: fy.id,
    bankId: bank.id,
    secondBankId: secondBank.id,
    expenseId: expense.id,
    partyId: party.id,
  };
}

async function apiBalance(bankId, context) {
  const res = await fetch(`http://127.0.0.1:5000/api/ledger-accounts/${bankId}`, {
    headers: {
      'x-company-id': context.companyId,
      'x-financial-year-id': context.financialYearId,
    },
  });
  const payload = await res.json();
  return payload?.data?.currentBalance ?? null;
}

async function run() {
  fs.mkdirSync(ART_DIR, { recursive: true });
  const context = await seed();
  console.log('Seeded Phase 12 UI test company + bank ledgers + party.');
  console.log(`Company: ${context.companyId} / FY: ${context.financialYearId}`);

  const chrome = launchChrome();
  let ws = null;

  try {
    ws = await connectCDP();
    await send(ws, 'Page.enable');
    await send(ws, 'Runtime.enable');
    attachConsoleCapture(ws);
    await send(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1500,
      height: 950,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // ---------- 1. Session context ----------
    await navigate(ws, `${BASE}/`);
    await evaluate(
      ws,
      `(() => {
        localStorage.setItem('bms_active_company_id', ${JSON.stringify(context.companyId)});
        localStorage.setItem('bms_active_fy_id', ${JSON.stringify(context.financialYearId)});
        localStorage.setItem('bms_active_company', JSON.stringify({
          id: ${JSON.stringify(context.companyId)},
          companyName: ${JSON.stringify(COMPANY_NAME)},
          gstin: '24AABCS1234F1Z8',
          address: 'Plot 12, Ring Road',
          city: 'Surat',
          state: 'Gujarat',
          pincode: '395002'
        }));
        localStorage.setItem('bms_active_financial_year', JSON.stringify({
          id: ${JSON.stringify(context.financialYearId)},
          yearName: '2026 - 2027',
          startDate: '2026-04-01T00:00:00.000Z',
          endDate: '2027-03-31T23:59:59.999Z',
          isLocked: false
        }));
        return true;
      })()`
    );

    // ---------- 2. Dashboard ----------
    await navigate(ws, `${BASE}/`);
    await waitForText(ws, 'bank receipt', 20000);
    const dash = await bodyText(ws);
    check(dash.includes('Bank Receipt'), 'Dashboard lists the Bank Receipt card');
    check(dash.includes('Bank Payment'), 'Dashboard lists the Bank Payment card');
    check(dash.includes('Ledger & Bank Accounts'), 'Dashboard lists the Ledger & Bank Accounts card');
    check(
      dash.includes('Customer RTGS, NEFT, cheque receipts and bank account ledger credits.'),
      'Bank Receipt dashboard card keeps its original description'
    );
    const clicked = await evaluate(
      ws,
      `(() => {
        const heading = Array.from(document.querySelectorAll('h3')).find((el) => el.textContent.trim() === 'Bank Receipt');
        if (!heading) return false;
        const card = heading.closest('div.cursor-pointer');
        if (!card) return false;
        card.click();
        return true;
      })()`
    );
    check(Boolean(clicked), 'Bank Receipt dashboard card is clickable (implemented, not a Coming Soon modal)');
    await waitFor(ws, `location.pathname === '/transactions/bank-receipts'`, 10000);
    check((await pathname(ws)) === '/transactions/bank-receipts', 'Clicking the card opens the Bank Receipt register');
    await screenshot(ws, 'phase12-01-register-empty.png');

    // ---------- 3. Empty register -> entry ----------
    await waitForText(ws, 'vouchers found', 15000);
    let reg = await bodyText(ws);
    check(reg.includes('Bank Receipt Register'), 'Bank Receipt Register page renders with its heading');
    check(reg.includes('No bank receipt vouchers found'), 'Register shows the empty state before any voucher exists');
    check(reg.includes('Filtered total') && reg.includes('0.00'), 'Register shows a zero filtered total for the empty state');

    await clickText(ws, 'button', 'New Receipt (F10)');
    await waitForText(ws, 'new entry', 20000);
    let form = await bodyText(ws);
    check(form.includes('New Entry'), 'Entry form opens in New Entry mode');
    check(form.includes('Debit bank account'), 'Entry form explains the receipt posting direction before saving');
    check(form.includes('F10 Save'), 'Entry form advertises the page-scoped shortcuts');

    // ---------- 4. Fill the receipt voucher ----------
    const bankSelected = await selectValue(ws, '#bankAccount', context.bankId);
    check(Boolean(bankSelected), 'Bank account selector accepts the seeded HDFC ledger');
    await clickText(ws, 'button', 'Search party or ledger account');
    await waitFor(ws, `Boolean(document.querySelector('input[placeholder^="Type party"]'))`, 5000);
    await setInput(ws, 'input[placeholder^="Type party"]', 'Patel');
    await sleep(400);
    const pickedParty = await clickText(ws, 'button', 'Patel Yarn Traders');
    check(Boolean(pickedParty), 'Counterparty picker selects the party from Party Master');
    await setInput(ws, '#amount', '25000.50');
    await setInput(ws, '#referenceNumber', 'UTR123456789');
    await setInput(ws, '#narration', 'Browser verification receipt');
    await sleep(300);

    form = await bodyText(ws);
    check(form.includes('Debit = Credit'), 'Posting preview confirms debit equals credit before save');
    check(form.includes('Rupees Twenty Five Thousand And Paise Fifty Only'), 'Posting preview shows the amount in words');
    check(form.includes('Bank balance increases'), 'Posting preview states the exact bank balance impact');
    await screenshot(ws, 'phase12-02-entry-filled.png');

    const balanceBeforeSave = await apiBalance(context.bankId, context);
    check(balanceBeforeSave === '0.00', 'Bank ledger starts at 0.00 before the first posting');

    await clickText(ws, 'button', 'Save (F10)');
    await waitForVoucherView(ws, '^\\/transactions\\/bank-receipts\\/[0-9a-f-]{36}$', 25000);
    const detailPath = await pathname(ws);
    check(
      /^\/transactions\/bank-receipts\/[0-9a-f-]{36}$/.test(detailPath),
      `Saving navigates to the voucher view page (path ${detailPath})`
    );
    const detail = await bodyText(ws);
    check(detail.includes('BR-2026-0001'), 'Saved voucher number uses the BR-YYYY-0001 sequence');
    check(detail.includes('Patel Yarn Traders'), 'Saved voucher shows the receiving party');
    check(detail.includes('HDFC Bank Current A/c'), 'Saved voucher shows the bank account ledger');
    check(detail.includes('Balanced'), 'Voucher view confirms the posting is balanced');
    check(detail.includes('Revision 1'), 'Voucher view shows the initial journal revision');
    await screenshot(ws, 'phase12-03-view.png');

    const balanceAfterSave = await apiBalance(context.bankId, context);
    check(balanceAfterSave === '25000.50', `Bank ledger balance increased to 25000.50 after the receipt (received ${balanceAfterSave})`);

    // ---------- 5. Register with data ----------
    await clickText(ws, 'button', 'Register');
    await waitFor(ws, `location.pathname === '/transactions/bank-receipts' && document.body.innerText.includes('BR-2026-0001')`, 20000);
    reg = await bodyText(ws);
    check(reg.includes('BR-2026-0001'), 'Register lists the newly saved voucher');
    check(reg.includes('25,000.50'), 'Register shows the voucher amount');
    check(reg.includes('POSTED'), 'Register shows the posted status');
    check(reg.includes('Filtered total'), 'Register shows a filtered total row');
    await screenshot(ws, 'phase12-04-register.png');

    // ---------- 6. Print view ----------
    await navigate(ws, `${BASE}${detailPath}/print`);
    await waitForText(ws, 'authorised signatory', 25000);
    const printText = await bodyText(ws);
    check(printText.includes(COMPANY_NAME), 'Print view renders the company letterhead name');
    check(printText.includes('Plot 12, Ring Road'), 'Print view renders the company address');
    check(printText.includes('GSTIN: 24AABCS1234F1Z8'), 'Print view renders the company GSTIN');
    check(printText.toLowerCase().includes('bank receipt voucher'), 'Print view shows the voucher title');
    check(printText.includes('BR-2026-0001'), 'Print view shows the voucher number and date block');
    check(printText.includes('Amount in words'), 'Print view includes the amount in words section');
    check(printText.includes('Rupees Twenty Five Thousand And Paise Fifty Only'), 'Print view renders the correct amount in words');
    const printHeaders = await evaluate(
      ws,
      `Array.from(document.querySelectorAll('th')).map(function (th) { return th.textContent.trim(); }).join('|')`
    );
    check(
      String(printHeaders).includes('Debit') && String(printHeaders).includes('Credit'),
      'Print view shows the debit and credit columns'
    );
    check(printText.includes('Authorised Signatory'), 'Print view includes signature areas');
    check(printText.includes('Print / Save as PDF'), 'Print view offers Print / Save as PDF');
    await screenshot(ws, 'phase12-05-print.png');

    // ---------- 7. Edit (reversal + corrected posting) ----------
    await navigate(ws, `${BASE}${detailPath}/edit`);
    await waitFor(ws, `location.pathname.endsWith('/edit') && document.body.innerText.includes('Bank Receipt Voucher')`, 25000);
    await setInput(ws, '#amount', '26000.50');
    await sleep(250);
    await clickText(ws, 'button', 'Save (F10)');
    await waitFor(
      ws,
      `new RegExp('^\\/transactions\\/bank-receipts\\/[0-9a-f-]{36}$').test(location.pathname) && document.body.innerText.toLowerCase().includes('revision 2')`,
      25000
    );
    const edited = await bodyText(ws);
    check(edited.includes('Revision 2'), 'Editing the voucher creates journal revision 2');
    check(
      edited.toLowerCase().includes('revision 1') && edited.toLowerCase().includes('revision 2'),
      'Edited voucher view keeps revision 1 and appends revision 2 in the audit trail'
    );
    check(edited.includes('26,000.50'), 'Edited voucher shows the corrected amount');

    const balanceAfterEdit = await apiBalance(context.bankId, context);
    check(
      balanceAfterEdit === '26000.50',
      `Editing replaces the posting instead of stacking it (bank balance is ${balanceAfterEdit}, expected 26000.50)`
    );
    await screenshot(ws, 'phase12-06-edited.png');

    // ---------- 8. Cancel (reversal, no delete) ----------
    await clickText(ws, 'button', 'Cancel');
    await waitFor(ws, `Boolean(document.querySelector('#detailCancelReason'))`, 10000);
    await setInput(ws, '#detailCancelReason', 'Browser verification duplicate entry');
    await clickText(ws, 'button', 'Confirm Cancellation');
    await waitForText(ws, 'voucher cancelled', 25000);
    const cancelled = await bodyText(ws);
    check(cancelled.includes('Voucher cancelled') && cancelled.includes('posting reversed'), 'Cancellation banner confirms the posting was reversed');
    check(cancelled.includes('Browser verification duplicate entry'), 'Cancellation reason is stored and displayed');
    check(cancelled.includes('CANCELLED'), 'Voucher status is CANCELLED');
    const balanceAfterCancel = await apiBalance(context.bankId, context);
    check(balanceAfterCancel === '0.00', `Cancelling restores the bank ledger balance to 0.00 (received ${balanceAfterCancel})`);
    await screenshot(ws, 'phase12-07-cancelled.png');

    await navigate(ws, `${BASE}/transactions/bank-receipts`);
    await waitFor(ws, `document.body.innerText.includes('BR-2026-0001')`, 20000);
    const cancelledRegister = await bodyText(ws);
    check(cancelledRegister.includes('CANCELLED'), 'Register shows the cancelled status for the voucher');

    // ---------- 9. Bank Payment flow ----------
    await navigate(ws, `${BASE}/transactions/bank-payments/new`);
    await waitForText(ws, 'bank payment voucher', 25000);
    const paymentForm = await bodyText(ws);
    check(paymentForm.includes('Debit paying ledger'), 'Payment entry form explains the opposite posting direction');
    const bankSelected2 = await selectValue(ws, '#bankAccount', context.secondBankId);
    check(Boolean(bankSelected2), 'Bank account selector accepts the seeded ICICI ledger');
    await clickText(ws, 'button', 'Search party or ledger account');
    await waitFor(ws, `Boolean(document.querySelector('input[placeholder^="Type party"]'))`, 5000);
    await setInput(ws, 'input[placeholder^="Type party"]', 'Office Rent');
    await sleep(400);
    const pickedLedger = await clickText(ws, 'button', 'Office Rent');
    check(Boolean(pickedLedger), 'Payment counterparty accepts a non-party expense ledger');
    await selectValue(ws, '#paymentMode', 'BANK_TRANSFER');
    await setInput(ws, '#amount', '1800.25');
    await setInput(ws, '#narration', 'Browser verification payment');
    await sleep(300);
    await clickText(ws, 'button', 'Save (F10)');
    await waitForVoucherView(ws, '^\\/transactions\\/bank-payments\\/[0-9a-f-]{36}$', 25000);
    const paymentView = await bodyText(ws);
    check(paymentView.includes('BP-2026-0001'), 'Bank payment saved with the BP-YYYY-0001 sequence');
    check(paymentView.includes('Office Rent'), 'Bank payment shows the paying ledger');
    check(paymentView.includes('ICICI Bank Current A/c'), 'Bank payment shows the credited bank account');
    check(paymentView.includes('Bank balance decreased'), 'Bank payment view states the reduced bank balance');
    check(paymentView.includes('Balanced'), 'Bank payment posting is balanced');
    const paymentPath = await pathname(ws);
    await screenshot(ws, 'phase12-08-payment-view.png');

    const secondBankBalance = await apiBalance(context.secondBankId, context);
    check(
      secondBankBalance === '-1800.25',
      `Payment reduced the ICICI bank ledger by the payment amount (received ${secondBankBalance})`
    );

    await navigate(ws, `${BASE}${paymentPath}/print`);
    await waitForText(ws, 'authorised signatory', 25000);
    const paymentPrint = await bodyText(ws);
    check(
      paymentPrint.includes('BP-2026-0001') && paymentPrint.toLowerCase().includes('authorised signatory'),
      'Bank payment print view renders fully'
    );

    // ---------- 10. Mobile responsiveness ----------
    await send(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await navigate(ws, `${BASE}/transactions/bank-payments`);
    await waitFor(ws, `document.body.innerText.includes('BP-2026-0001')`, 25000);
    const mobileRegister = await bodyText(ws);
    check(mobileRegister.includes('Bank Payment Register'), 'Register renders at 390x844 mobile viewport');
    const overflow = await evaluate(ws, 'document.documentElement.scrollWidth - window.innerWidth');
    check(overflow <= 2, `Register does not overflow horizontally on mobile (overflow ${overflow}px)`);
    await screenshot(ws, 'phase12-09-mobile-register.png');

    await navigate(ws, `${BASE}/transactions/bank-payments/new`);
    await waitForText(ws, 'bank payment voucher', 25000);
    const mobileForm = await bodyText(ws);
    check(mobileForm.toLowerCase().includes('posting preview'), 'Entry form keeps the posting preview visible on mobile');
    const mobileOverflow = await evaluate(ws, 'document.documentElement.scrollWidth - window.innerWidth');
    check(mobileOverflow <= 2, `Entry form does not overflow horizontally on mobile (overflow ${mobileOverflow}px)`);
    await screenshot(ws, 'phase12-10-mobile-entry.png');

    await send(ws, 'Emulation.clearDeviceMetricsOverride');

    // ---------- 11. Console health ----------
    await sleep(500);
    const relevantErrors = consoleErrors.filter(
      (line) => !line.includes('Download the React DevTools') && !line.includes('favicon') && !line.includes('[vite]')
    );
    check(relevantErrors.length === 0, `Browser console has no errors (${relevantErrors.length} found)`);
    if (relevantErrors.length > 0) {
      for (const line of relevantErrors.slice(0, 8)) console.error(`    console> ${line}`);
    }
  } finally {
    try {
      if (ws) ws.close();
    } catch {
      /* ignore */
    }
    try {
      chrome.kill();
    } catch {
      /* ignore */
    }
    await cleanup();
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`BROWSER VERIFICATION: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('Failures:');
    for (const item of failures) console.log(` - ${item}`);
  }
  console.log(`Screenshots: ${ART_DIR}`);
  console.log('====================================================');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(async (error) => {
  console.error('Browser verification crashed:', error);
  try {
    await cleanup();
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});