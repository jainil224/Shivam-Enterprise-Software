import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const COMPANY_CODE = 'P13UI';
const COMPANY_NAME = 'SHIVAM ENTERPRISE (PHASE 13 UI)';
const ART_DIR = 'C:\\Users\\Admin\\AppData\\Local\\Temp\\opencode\\phase13-ui';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9227;
const BASE = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:5000/api';

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
  return spawn(
    CHROME_PATH,
    [
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
    ],
    { stdio: 'ignore', detached: false }
  );
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
  await waitFor(
    ws,
    `document.readyState === 'complete' && document.body && document.body.innerText.length > 40`,
    20000
  );
  await sleep(700);
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

async function clickCard(ws, title) {
  return evaluate(
    ws,
    `(() => {
      const heading = Array.from(document.querySelectorAll('h3')).find((el) => el.textContent.trim() === ${JSON.stringify(title)});
      if (!heading) return false;
      const card = heading.closest('div.cursor-pointer') || heading.parentElement;
      if (!card) return false;
      card.click();
      return true;
    })()`
  );
}

async function screenshot(ws, name) {
  const res = await send(ws, 'Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(ART_DIR, name), Buffer.from(res.data, 'base64'));
}

async function apiCall(method, route, payload, context) {
  const response = await fetch(`${API}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-company-id': context.companyId,
      'x-financial-year-id': context.financialYearId,
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
}

async function cleanup() {
  const companies = await prisma.company.findMany({
    where: { companyCode: { startsWith: COMPANY_CODE } },
    select: { id: true },
  });
  const companyIds = companies.map((row) => row.id);
  if (companyIds.length === 0) return;
  await prisma.orderStatusHistory.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.orderFulfilmentLink.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.salesOrder.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.purchaseOrder.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.orderSequence.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.item.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.journalLine.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.bankVoucher.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.voucherSequence.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.ledgerAccount.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.location.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.party.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.financialYear.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

async function seed() {
  await cleanup();
  fs.mkdirSync(ART_DIR, { recursive: true });

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

  const customer = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P13UI-CUST',
      partyName: 'Gujarat Yarn Traders',
      partyType: 'CUSTOMER',
      gstin: '24AAACC1111A1Z5',
      address: 'Ring Road',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395002',
      openingBalance: '0.00',
      balanceType: 'DEBIT',
    },
  });

  const supplier = await prisma.party.create({
    data: {
      companyId: company.id,
      partyCode: 'P13UI-SUPP',
      partyName: 'Surat Textile Suppliers',
      partyType: 'SUPPLIER',
      gstin: '24AAACC3333C1Z7',
      address: 'Sahara Darwaja',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395003',
      openingBalance: '0.00',
      balanceType: 'CREDIT',
    },
  });

  const location = await prisma.location.create({
    data: { companyId: company.id, locationName: 'Main Godown' },
  });

  const itemA = await prisma.item.create({
    data: {
      companyId: company.id,
      itemCode: 'P13-YARN-01',
      itemName: 'Cotton Yarn 40s',
      itemType: 'YARN',
      unit: 'KG',
      hsnCode: '5205',
      gstRate: '5.00',
      defaultSalesRate: '250.0000',
      defaultPurchaseRate: '100.0000',
      colour: 'Natural',
    },
  });

  const itemB = await prisma.item.create({
    data: {
      companyId: company.id,
      itemCode: 'P13-FAB-01',
      itemName: 'Dyed Fabric Roll',
      itemType: 'FABRIC',
      unit: 'METER',
      hsnCode: '5208',
      gstRate: '12.00',
      defaultSalesRate: '100.0000',
      defaultPurchaseRate: '200.0000',
    },
  });

  const context = { companyId: company.id, financialYearId: fy.id };

  const sales = await apiCall('POST', '/sales-orders', {
    orderDate: '2026-05-10',
    partyId: customer.id,
    expectedDeliveryDate: '2026-05-25',
    paymentTerms: '30 Days Credit',
    deliveryTerms: 'Door Delivery',
    freightTerms: 'To Pay',
    freightAmount: '250.40',
    packingAmount: '100.00',
    otherCharges: '0',
    narration: 'Phase 13 browser verification',
    termsAndConditions: 'Goods once sold will not be taken back.',
    lines: [
      { itemId: itemA.id, quantity: '100', rate: '250', discountPercent: '2', gstRate: '5' },
      { itemId: itemB.id, quantity: '50.5', rate: '100', discountPercent: '0', gstRate: '12' },
    ],
  }, context);
  if (sales.status !== 201 && sales.status !== 200) {
    throw new Error(`Sales order seed failed (${sales.status}): ${JSON.stringify(sales.json)}`);
  }

  const purchase = await apiCall('POST', '/purchase-orders', {
    orderDate: '2026-05-12',
    partyId: supplier.id,
    expectedDeliveryDate: '2026-05-30',
    buyerName: 'Jainil Patel',
    paymentTerms: '100% Advance',
    deliveryTerms: 'Ex-Works',
    freightTerms: 'Paid',
    deliveryLocationId: location.id,
    freightAmount: '500',
    packingAmount: '0',
    otherCharges: '0',
    narration: 'Phase 13 browser verification',
    lines: [
      { itemId: itemA.id, quantity: '100', rate: '100', discountPercent: '10', gstRate: '18' },
      { itemId: itemB.id, quantity: '20', rate: '200', discountPercent: '0', gstRate: '5' },
    ],
  }, context);
  if (purchase.status !== 201 && purchase.status !== 200) {
    throw new Error(`Purchase order seed failed (${purchase.status}): ${JSON.stringify(purchase.json)}`);
  }

  return {
    ...context,
    companyName: COMPANY_NAME,
    salesOrderId: sales.json.data.id,
    salesOrderNumber: sales.json.data.orderNumber,
    purchaseOrderId: purchase.json.data.id,
    purchaseOrderNumber: purchase.json.data.orderNumber,
  };
}
(async () => {
  let chrome = null;
  let ws = null;
  try {
    const context = await seed();
    console.log(`Seeded ${context.salesOrderNumber} and ${context.purchaseOrderNumber}`);

    chrome = launchChrome();
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

    await navigate(ws, `${BASE}/`);
    await evaluate(
      ws,
      `(() => {
        localStorage.setItem('bms_active_company_id', ${JSON.stringify(context.companyId)});
        localStorage.setItem('bms_active_fy_id', ${JSON.stringify(context.financialYearId)});
        localStorage.setItem('bms_active_company', JSON.stringify({
          id: ${JSON.stringify(context.companyId)},
          companyName: ${JSON.stringify(context.companyName)},
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

    // ---------- Dashboard ----------
    await navigate(ws, `${BASE}/`);
    await waitForText(ws, 'sales order', 20000);
    const dash = await bodyText(ws);
    check(dash.includes('Sales Order'), 'Dashboard lists the Sales Order card');
    check(dash.includes('Purchase Order'), 'Dashboard lists the Purchase Order card');
    check(dash.includes('Item Master'), 'Dashboard lists the Item Master card');
    check(
      dash.includes('Advance sales bookings, buyer order confirmations and yarn delivery commitments.'),
      'Sales Order card keeps its original description'
    );
    check(
      dash.includes('Raw material procurement orders and yarn purchase contracts.'),
      'Purchase Order card keeps its original description'
    );
    check(
      dash.includes('Yarn, raw material and fabric item definitions with HSN codes, units, GST rates and default pricing.'),
      'Item Master card keeps its original description'
    );

    const clicked = await clickCard(ws, 'Sales Order');
    check(Boolean(clicked), 'Sales Order dashboard card is clickable (implemented, not Coming Soon)');
    await waitFor(ws, `location.pathname === '/transactions/sales-orders'`, 10000);
    check((await pathname(ws)) === '/transactions/sales-orders', 'Clicking the card opens the Sales Order register');
    await waitForText(ws, context.salesOrderNumber, 20000);
    const salesRegister = await bodyText(ws);
    check(salesRegister.includes(context.salesOrderNumber), 'Sales Order register lists the created order');
    check(salesRegister.includes('Gujarat Yarn Traders'), 'Sales Order register shows the customer');
    await screenshot(ws, 'phase13-01-sales-register.png');

    // ---------- Sales entry ----------
    await navigate(ws, `${BASE}/transactions/sales-orders/new`);
    await waitForText(ws, 'new sales order', 20000);
    const salesEntry = await bodyText(ws);
    check(salesEntry.includes('New Sales Order'), 'Sales Order entry page renders the new order form');
    check(
      salesEntry.includes('F10 Save') && salesEntry.includes('F5 Register') && salesEntry.includes('Esc Back'),
      'Sales Order entry page exposes the keyboard-first shortcut bar'
    );
    await screenshot(ws, 'phase13-02-sales-entry.png');

    // ---------- Sales detail ----------
    await navigate(ws, `${BASE}/transactions/sales-orders/${context.salesOrderId}`);
    await waitForText(ws, context.salesOrderNumber, 20000);
    const salesDetail = await bodyText(ws);
    check(salesDetail.includes(context.salesOrderNumber), 'Sales Order detail page loads the order');
    check(salesDetail.toLowerCase().includes('grand total'), 'Sales Order detail page shows totals');
    check(salesDetail.includes('31,731.00') || salesDetail.includes('31731.00'), 'Sales Order detail shows the rounded grand total');
    check(salesDetail.includes('Confirm Order') || salesDetail.includes('Confirm'), 'Draft Sales Order offers the confirm action');
    await screenshot(ws, 'phase13-03-sales-detail.png');

    // ---------- Sales print ----------
    await navigate(ws, `${BASE}/transactions/sales-orders/${context.salesOrderId}/print`);
    const printOk = await waitForText(ws, 'rupees thirty one thousand seven hundred thirty one only', 20000);
    const salesPrint = await bodyText(ws);
    check(printOk, 'Sales Order print page renders the amount in words');
    check(salesPrint.includes(context.salesOrderNumber), 'Sales Order print page shows the order number');
    check(salesPrint.includes('CGST') && salesPrint.includes('SGST'), 'Sales Order print page shows the GST breakup');
    await screenshot(ws, 'phase13-04-sales-print.png');

    // ---------- Sales reports ----------
    await navigate(ws, `${BASE}/transactions/sales-orders/reports`);
    await waitForText(ws, 'pending sales orders', 20000);
    const salesReports = await bodyText(ws);
    check(salesReports.includes('Pending Sales Orders'), 'Sales reports page lists the Pending Sales Orders report');
    check(salesReports.includes('Customer-wise Orders'), 'Sales reports page lists the Customer-wise Orders report');
    check(salesReports.includes('Fulfilment Summary'), 'Sales reports page lists the Fulfilment Summary report');
    await screenshot(ws, 'phase13-05-sales-reports.png');

    // ---------- Purchase register / detail ----------
    await navigate(ws, `${BASE}/transactions/purchase-orders`);
    await waitForText(ws, context.purchaseOrderNumber, 20000);
    const poRegister = await bodyText(ws);
    check(poRegister.includes(context.purchaseOrderNumber), 'Purchase Order register lists the created order');
    check(poRegister.includes('Surat Textile Suppliers'), 'Purchase Order register shows the supplier');
    await screenshot(ws, 'phase13-06-purchase-register.png');

    await navigate(ws, `${BASE}/transactions/purchase-orders/${context.purchaseOrderId}`);
    await waitForText(ws, context.purchaseOrderNumber, 20000);
    const poDetail = await bodyText(ws);
    check(poDetail.includes(context.purchaseOrderNumber), 'Purchase Order detail page loads the order');
    check(poDetail.toLowerCase().includes('approve'), 'Draft Purchase Order offers the approve action');
    check(poDetail.toLowerCase().includes('grand total'), 'Purchase Order detail page shows totals');
    await screenshot(ws, 'phase13-07-purchase-detail.png');

    // ---------- Item master ----------
    await navigate(ws, `${BASE}/masters/items`);
    await waitForText(ws, 'cotton yarn 40s', 20000);
    const items = await bodyText(ws);
    check(items.includes('P13-YARN-01'), 'Item Master lists the seeded yarn item code');
    check(items.includes('Cotton Yarn 40s'), 'Item Master lists the seeded yarn item name');
    await screenshot(ws, 'phase13-08-item-master.png');

    // ---------- Mobile responsive ----------
    await send(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await navigate(ws, `${BASE}/transactions/sales-orders`);
    await waitForText(ws, context.salesOrderNumber, 20000);
    const mobileRegister = await evaluate(
      ws,
      `({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, text: document.body.innerText.length })`
    );
    check(mobileRegister.text > 100, 'Sales Order register renders on a 390px mobile viewport');
    check(
      mobileRegister.scroll <= mobileRegister.width + 4,
      `Sales Order register has no horizontal overflow on mobile (scroll ${mobileRegister.scroll} / width ${mobileRegister.width})`
    );
    await screenshot(ws, 'phase13-09-mobile-register.png');

    await navigate(ws, `${BASE}/transactions/sales-orders/new`);
    await waitForText(ws, 'new sales order', 20000);
    const mobileEntry = await evaluate(
      ws,
      `({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, text: document.body.innerText.length })`
    );
    check(mobileEntry.text > 100, 'Sales Order entry form renders on a 390px mobile viewport');
    check(
      mobileEntry.scroll <= mobileEntry.width + 4,
      `Sales Order entry form has no horizontal overflow on mobile (scroll ${mobileEntry.scroll} / width ${mobileEntry.width})`
    );
    await screenshot(ws, 'phase13-10-mobile-entry.png');
    await send(ws, 'Emulation.clearDeviceMetricsOverride');

    const relevantErrors = consoleErrors.filter(
      (entry) => !entry.includes('DevTools') && !entry.includes('favicon')
    );
    check(
      relevantErrors.length === 0,
      `no console errors on the Phase 13 pages${relevantErrors.length ? `: ${relevantErrors.slice(0, 3).join(' | ')}` : ''}`
    );

    console.log(`\nPhase 13 browser verification: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
      console.error(`Failures:\n${failures.map((item) => ` - ${item}`).join('\n')}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Phase 13 browser verification aborted:', error);
    process.exitCode = 1;
  } finally {
    try {
      if (ws) ws.close();
    } catch {
      /* ignore */
    }
    if (chrome) chrome.kill();
    await cleanup();
    await prisma.$disconnect();
  }
})();
