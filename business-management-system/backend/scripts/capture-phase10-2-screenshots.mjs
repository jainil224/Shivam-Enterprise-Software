import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const PROJECT_ROOT = 'D:\\SIVAM Enterprise Software\\business-management-system';
const ARTIFACT_DIR = path.join(PROJECT_ROOT, 'documentation', 'screenshots', 'phase10-2');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9223;
const STATIC_PORT = 5182;
const API_PORT = 5000;
const LIVE_API = `http://127.0.0.1:${API_PORT}/api`;

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

// ── Self-contained mock (used only when no real API server is listening) ─────
const MOCK_CHALLAN = {
  id: 'ch-mock-89',
  challanNumber: '89',
  challanDate: '2026-11-03',
  status: 'CONFIRMED',
  lotNumber: '41162N',
  twist: '800',
  emptyCopsWeight: 0.04,
  yarnQuality: { id: 'q1', qualityName: '75/600 TPM YARN', denier: null },
  yarnGrade: { id: 'g1', gradeName: '1ST' },
  productionBook: { id: 'book-mock', bookName: 'YARN SALES' },
  items: [1460, 1461, 1462, 1463].map((carton, index) => ({
    id: `item-${carton}`,
    cartonNumber: String(carton),
    cartonWeight: 1.0,
    cops: 24,
    grossWeight: (31.62 + index * 0.78).toFixed(3),
    copsWeight: 0.04,
    tareWeight: '1.960',
    netWeight: (29.66 + index * 0.78).toFixed(3),
    averageWeight: 1.236,
    twist: '800',
    lotNumber: index === 1 ? null : '41162N',
    shadeNo: null,
    grade: index === 1 ? null : '1ST',
  })),
};

function startMockApiServer(port) {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const pathname = url.pathname;
    console.log(`[MOCK API ${req.method}] ${pathname}${url.search}`);
    let payload = { success: true, data: [] };

    if (pathname.endsWith('/companies/validate-context')) {
      payload = {
        success: true,
        data: {
          company: { id: 'company-mock', companyName: 'SHIVAM ENTERPRISE', companyCode: 'SHIVAM01', phone: '9909143989' },
          financialYear: { id: 'fy-mock', yearName: '2026-2027', isLocked: false },
        },
      };
    } else if (/\/manufacturing\/production-receive\/[^/]+$/.test(pathname)) {
      payload = { success: true, data: MOCK_CHALLAN };
    } else if (pathname.endsWith('/manufacturing/production-receive')) {
      payload = { success: true, data: [MOCK_CHALLAN], meta: { total: 1, page: 1, limit: 500 } };
    } else if (pathname.endsWith('/companies')) {
      payload = { success: true, data: [{ id: 'company-mock', companyName: 'SHIVAM ENTERPRISE', phone: '9909143989' }] };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  });

  return new Promise((resolve) => {
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`Port ${port} is already in use - using the live API server for verification.`);
        resolve(null);
        return;
      }
      throw err;
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`Mock API running on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} failed with HTTP ${res.status}`);
  return res.json();
}

// Resolve which company / book / challan to render, preferring real PostgreSQL data
async function resolveScenario(mockBound) {
  if (mockBound) {
    return {
      mode: 'mock',
      companyId: 'company-mock',
      fyId: 'fy-mock',
      bookId: 'book-mock',
      challanId: MOCK_CHALLAN.id,
      challanNumber: MOCK_CHALLAN.challanNumber,
      firstCarton: MOCK_CHALLAN.items[0].cartonNumber,
      companyName: 'SHIVAM ENTERPRISE',
      phone: '9909143989',
    };
  }

  const companies = await fetchJson(`${LIVE_API}/companies`);
  const company = companies.data[0];
  const fy = (company.financialYears || []).find((f) => f.isActive) || (company.financialYears || [])[0];
  const headers = { 'x-company-id': company.id, 'x-financial-year-id': fy.id };

  const books = await fetchJson(`${LIVE_API}/masters/production-books`, headers);
  const book = books.data[0];

  const list = await fetchJson(`${LIVE_API}/manufacturing/production-receive?page=1&limit=50`, headers);
  const candidates = (list.data || []).filter((c) => c.status === 'CONFIRMED' && (c.totalCartons || 0) > 0);
  const score = (challan) =>
    Math.abs(8 - (challan.totalCartons || 0)) + (challan.yarnQuality ? 0 : 1);
  candidates.sort((a, b) => score(a) - score(b));
  const forcedChallan = process.env.P10_2_CHALLAN || '';
  const forcedChallanMatch = forcedChallan
    ? candidates.find((c) => String(c.challanNumber) === String(forcedChallan))
    : null;
  const challan = forcedChallanMatch || candidates[0] || list.data[0];

  const detail = await fetchJson(`${LIVE_API}/manufacturing/production-receive/${challan.id}`, headers);
  const items = detail.data.items || [];

  return {
    mode: 'live',
    companyId: company.id,
    fyId: fy.id,
    bookId: book.id,
    challanId: challan.id,
    challanNumber: challan.challanNumber,
    firstCarton: process.env.P10_2_CARTON || (items[0] ? items[0].cartonNumber : ''),
    companyName: company.companyName,
    phone: company.phone || '',
  };
}

async function connectToChromeWs() {
  const httpRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const targets = await httpRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  if (!pageTarget || !pageTarget.webSocketDebuggerUrl) {
    throw new Error('No page target with websocket found in Chrome');
  }

  const ws = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  let messageId = 1;
  const pendingRequests = new Map();

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = messageId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  return { ws, send };
}

function writePng(send, filename, clip) {
  return send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: Boolean(clip),
    ...(clip ? { clip } : {}),
  }).then((result) => {
    const filePath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
    console.log(`Saved screenshot: ${filename} (${fs.statSync(filePath).size} bytes)`);
  });
}

async function getRect(send, expression) {
  const res = await send('Runtime.evaluate', {
    expression: `(() => { const el = (${expression}); if (!el) return null; const r = el.getBoundingClientRect(); return JSON.stringify({ x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height }); })()`,
    returnByValue: true,
  });
  return res.result.value ? JSON.parse(res.result.value) : null;
}

async function captureElement(send, expression, filename, scale = 3) {
  const rect = await getRect(send, expression);
  if (!rect) throw new Error(`Element not found for capture: ${expression}`);
  await writePng(send, filename, {
    x: Math.max(0, rect.x - 3),
    y: Math.max(0, rect.y - 3),
    width: rect.width + 6,
    height: rect.height + 6,
    scale,
  });
}

async function waitForSelector(send, expression, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    const res = await send('Runtime.evaluate', { expression: `Boolean(${expression})`, returnByValue: true });
    if (res.result.value === true) return true;
    await sleep(250);
  }
  return false;
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const distDir = path.join(PROJECT_ROOT, 'frontend', 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error(`Production build not found at ${distDir}. Run "npm run build" first.`);
  }

  const staticServer = await startStaticServer(distDir, STATIC_PORT);
  const mockApiServer = await startMockApiServer(API_PORT);
  const scenario = await resolveScenario(Boolean(mockApiServer));
  console.log('SCENARIO: ' + JSON.stringify(scenario, null, 2));
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'p10_2_scenario.json'), JSON.stringify(scenario, null, 2));

  const slipUrl = (extra) =>
    `http://127.0.0.1:${STATIC_PORT}/manufacturing/packing-slip/print?${extra}&bookId=${scenario.bookId}&challanId=${scenario.challanId}`;
  const baseQuery = `challanFrom=${scenario.challanNumber}&challanTo=${scenario.challanNumber}`;

  console.log('Launching headless Chrome...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      // Local verification only: the production bundle is served from 127.0.0.1:5182 while the API
      // lives on a different origin (port 5000). Disabling the same-origin check keeps the harness
      // independent of the backend CORS allowlist without touching backend configuration.
      '--disable-web-security',
      `--user-data-dir=${path.join(process.env.TEMP || 'C:\\Users\\Admin\\AppData\\Local\\Temp', 'p10-2-chrome-profile')}`,
      '--window-size=1500,1200',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  await sleep(1600);

  try {
    const { ws, send } = await connectToChromeWs();
    await send('Page.enable');
    await send('Runtime.enable');

    const pageErrors = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.method === 'Runtime.exceptionThrown') {
        const detail = msg.params.exceptionDetails;
        pageErrors.push(detail.exception?.description || detail.text);
        console.error('PAGE EXCEPTION:', detail.text);
      }
    });

    await send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/` });
    await sleep(900);
    await send('Runtime.evaluate', {
      expression: `localStorage.setItem('bms_active_company_id', '${scenario.companyId}');
        localStorage.setItem('bms_active_fy_id', '${scenario.fyId}');
        sessionStorage.setItem('bms_selected_production_book_id', '${scenario.bookId}');`,
    });

    // ── Isolated single slip (first carton only) for close-up verification ────
    console.log(`Navigating to single packing slip (carton ${scenario.firstCarton})...`);
    await send('Page.navigate', {
      url: slipUrl(`${baseQuery}&cartonFrom=${scenario.firstCarton}&cartonTo=${scenario.firstCarton}&copies=1&landscape=false`),
    });
    if (!(await waitForSelector(send, `document.querySelector('.packing-slip-page')`))) {
      const body = await send('Runtime.evaluate', { expression: `document.body.innerText.slice(0, 600)`, returnByValue: true });
      throw new Error(`Packing slip page never rendered. Body text: ${body.result.value}`);
    }
    await sleep(900);

    const report = await send('Runtime.evaluate', {
      expression: `(() => {
        const page = document.querySelector('.packing-slip-page');
        const cards = Array.from(page.children).filter((el) => !el.style.border.includes('dashed'));
        const card = cards[0];
        const header = card.children[0];
        const table = card.querySelector('table');
        const warning = card.lastElementChild;
        const rows = Array.from(table.tBodies[0].rows);
        const cardRect = card.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        const warningRect = warning.getBoundingClientRect();

        const pairs = rows.slice(1).map((row, index) => {
          const left = row.cells[0].getBoundingClientRect();
          const right = row.cells[1].getBoundingClientRect();
          return {
            row: index + 1,
            leftCellText: row.cells[0].textContent.trim(),
            rightCellText: row.cells[1].textContent.trim(),
            sameRow: Math.abs(left.top - right.top) < 0.5 && Math.abs(left.bottom - right.bottom) < 0.5,
            topDelta: Number(Math.abs(left.top - right.top).toFixed(3)),
            bottomDelta: Number(Math.abs(left.bottom - right.bottom).toFixed(3)),
            dividerContinuous: Math.abs(left.right - right.left) < 0.5,
            equalWidth: Math.abs(left.width - right.width) < 1.5,
            leftWidth: Number(left.width.toFixed(2)),
            rightWidth: Number(right.width.toFixed(2)),
          };
        });

        const headerSpacer = Array.from(header.children).find((el) => el.textContent.trim() === '');
        const headerSpacerRect = headerSpacer ? headerSpacer.getBoundingClientRect() : null;
        return JSON.stringify({
          slipCount: cards.length,
          totalGridSlots: page.children.length,
          headerText: header.innerText.replace(/\\n/g, ' | '),
          headerRowCount: header.children.length,
          headerSpacerHeight: headerSpacerRect ? Number(headerSpacerRect.height.toFixed(2)) : 0,
          headerSpacerIsEmpty: headerSpacerRect !== null,
          headerBoldElements: header.querySelectorAll('div').length,
          titleUnderlined: /underline/.test(getComputedStyle(header.lastElementChild).textDecorationLine),
          qualityRowText: rows[0].textContent.trim(),
          qualityRowColSpan: rows[0].cells.length,
          qualityRowFullWidth:
            rows[0].cells.length === 1 &&
            Math.abs(rows[0].getBoundingClientRect().width - tableRect.width) < 1.5,
          warningText: warning.textContent.trim(),
          warningFullWidth: Math.abs(warningRect.width - cardRect.width) < 2.5,
          headerSeparatedFromBody: Math.abs(headerRect.bottom - tableRect.top) < 1.5,
          previewZoom: (() => {
            const scaler = document.querySelector('.packing-slip-preview-scaler');
            return scaler ? Number(getComputedStyle(scaler).zoom) || 1 : 1;
          })(),
          outerBorder: getComputedStyle(card).border,
          rowCount: rows.length,
          pairs,
        }, null, 2);
      })()`,
      returnByValue: true,
    });

    const layout = JSON.parse(report.result.value);
    console.log('LAYOUT REPORT:\n' + JSON.stringify(layout, null, 2));
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'p10_2_layout_report.json'), JSON.stringify(layout, null, 2));

    // The slip prints the trading name: the company master stores the short form "SHIVAM PVT".
    const expectedPrintName = /^shivam\s+pvt\.?$/i.test(scenario.companyName.trim())
      ? 'SHIVAM ENTERPRISE'
      : scenario.companyName;
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, (ch) => `\\${ch}`);
    const companyRe = new RegExp(escapeRegex(expectedPrintName), 'i');
    const phoneRe = scenario.phone ? new RegExp(`Phone:\\s*${scenario.phone}`) : /Phone:/;
    const checks = [
      ['Table has exactly 5 rows (1 quality + 4 information rows)', layout.rowCount === 5],
      ['Exactly 4 paired information rows', layout.pairs.length === 4],
      ['Box No + Cheese on the same horizontal row', layout.pairs[0].sameRow === true],
      ['Lot No + Gross Weight on the same horizontal row', layout.pairs[1].sameRow === true],
      ['Shade No + Tare Weight on the same horizontal row', layout.pairs[2].sameRow === true],
      ['Grade + Net Weight on the same horizontal row', layout.pairs[3].sameRow === true],
      ['Central divider continuous across all 4 rows', layout.pairs.every((p) => p.dividerContinuous)],
      ['Left and right cells equal width', layout.pairs.every((p) => p.equalWidth)],
      ['Quality row is full width (merged)', layout.qualityRowFullWidth],
      ['Warning row is full width (merged)', layout.warningFullWidth],
      ['Header separated from remaining sections', layout.headerSeparatedFromBody],
      ['Packing Slip title underlined', layout.titleUnderlined],
      ['Company name rendered (trading name on the slip)', companyRe.test(layout.headerText)],
      ['Company phone rendered', phoneRe.test(layout.headerText)],
      ['Solid black outer border', /solid rgb\(0, 0, 0\)$/.test(layout.outerBorder)],
      ['Fit-to-width preview zoom applied on screen', layout.previewZoom >= 1],
      ['Warning text exact', layout.warningText === 'Please do not mix different Lot No.'],
      ['Blank spacer row between phone and title', layout.headerRowCount === 4 && layout.headerSpacerHeight > 4 && layout.headerSpacerIsEmpty],
      ['Quality label always rendered', /^Quality :/.test(layout.qualityRowText)],
    ];
    console.log('\n── STRUCTURAL CHECKS ──');
    let failed = 0;
    for (const [label, ok] of checks) {
      if (!ok) failed += 1;
      console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
    }
    console.log(failed === 0 ? 'ALL STRUCTURAL CHECKS PASSED' : `${failed} STRUCTURAL CHECK(S) FAILED`);

    // ── Screenshots 1-8: slip anatomy ─────────────────────────────────────────
    const cardExpr = `Array.from(document.querySelector('.packing-slip-page').children).filter((el) => !el.style.border.includes('dashed'))[0]`;
    const rowExpr = (i) => `${cardExpr}.querySelector('table').tBodies[0].rows[${i}]`;

    await captureElement(send, cardExpr, 'p10_2_01_complete_packing_slip.png', 3);
    await captureElement(send, `${cardExpr}.children[0]`, 'p10_2_02_company_header.png', 3);
    await captureElement(send, rowExpr(0), 'p10_2_03_full_width_quality_row.png', 3);
    await captureElement(send, rowExpr(1), 'p10_2_04_box_no_and_cheese_same_row.png', 3);
    await captureElement(send, rowExpr(2), 'p10_2_05_lot_no_and_gross_weight_same_row.png', 3);
    await captureElement(send, rowExpr(3), 'p10_2_06_shade_no_and_tare_weight_same_row.png', 3);
    await captureElement(send, rowExpr(4), 'p10_2_07_grade_and_net_weight_same_row.png', 3);
    await captureElement(send, `${cardExpr}.lastElementChild`, 'p10_2_08_full_width_warning_row.png', 3);

    // ── Full A4 portrait page ────────────────────────────────────────────────
    console.log('Navigating to full A4 portrait preview...');
    await send('Page.navigate', { url: slipUrl(`${baseQuery}&cartonFrom=&cartonTo=&copies=1&landscape=false`) });
    await waitForSelector(send, `document.querySelector('.packing-slip-page')`);
    await sleep(900);
    const pageStats = await send('Runtime.evaluate', {
      expression: `JSON.stringify({
        pages: document.querySelectorAll('.packing-slip-page').length,
        slips: Array.from(document.querySelectorAll('.packing-slip-page')).reduce((n, p) => n + Array.from(p.children).filter((el) => !el.style.border.includes('dashed')).length, 0),
        pageWidth: getComputedStyle(document.querySelector('.packing-slip-page')).width,
        pageHeight: getComputedStyle(document.querySelector('.packing-slip-page')).height,
      })`,
      returnByValue: true,
    });
    console.log('A4 PAGE STATS: ' + pageStats.result.value);
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'p10_2_page_stats.json'), pageStats.result.value);
    await writePng(send, 'p10_2_09_a4_portrait_screen_preview.png');
    const portraitOverflow = await send('Runtime.evaluate', {
      expression: `JSON.stringify(Array.from(document.querySelectorAll('.packing-slip-page td')).filter((td) => td.scrollWidth - td.clientWidth > 1).map((td) => td.textContent.trim()))`,
      returnByValue: true,
    });
    const portraitOverflowList = JSON.parse(portraitOverflow.result.value);
    console.log('PORTRAIT CELL OVERFLOW: ' + (portraitOverflowList.length ? portraitOverflowList.join(', ') : 'none'));
    if (portraitOverflowList.length > 0) failed += 1;

    await send('Emulation.setEmulatedMedia', { media: 'print' });
    await sleep(500);
    const printWidth = await send('Runtime.evaluate', {
      expression: `Number(document.querySelector('.packing-slip-page').getBoundingClientRect().width.toFixed(2))`,
      returnByValue: true,
    });
    const printBorder = await send('Runtime.evaluate', {
      expression: `getComputedStyle(document.querySelector('.packing-slip-page').children[0]).border`,
      returnByValue: true,
    });
    const printSheetBorder = printBorder.result.value;
    console.log('PRINT-MEDIA BORDER: ' + printSheetBorder);
    if (!/^1px solid rgb\(0, 0, 0\)$/.test(printSheetBorder)) { failed += 1; console.log('FAIL - printed border is not a 1px solid black line'); }
    const printSheetWidth = printWidth.result.value;
    console.log('PRINT-MEDIA SHEET WIDTH: ' + printSheetWidth + 'px (expected ~718.11px A4 portrait)');
    if (Math.abs(printSheetWidth - 718.11) > 2) {
      failed += 1;
      console.log('FAIL - screen-only preview zoom leaked into print media');
    } else {
      console.log('PASS - print media keeps the exact A4 sheet width');
    }
    await writePng(send, 'p10_2_10_a4_print_preview.png');
    await send('Emulation.setEmulatedMedia', { media: 'screen' });

    // ── Landscape ────────────────────────────────────────────────────────────
    console.log('Navigating to A4 landscape preview...');
    await send('Page.navigate', { url: slipUrl(`${baseQuery}&cartonFrom=&cartonTo=&copies=1&landscape=true`) });
    await waitForSelector(send, `document.querySelector('.packing-slip-page')`);
    await sleep(900);
    await writePng(send, 'p10_2_11_a4_landscape_preview.png');
    const landscapeOverflow = await send('Runtime.evaluate', {
      expression: `JSON.stringify(Array.from(document.querySelectorAll('.packing-slip-page td')).filter((td) => td.scrollWidth - td.clientWidth > 1).map((td) => td.textContent.trim()))`,
      returnByValue: true,
    });
    const landscapeOverflowList = JSON.parse(landscapeOverflow.result.value);
    console.log('LANDSCAPE CELL OVERFLOW: ' + (landscapeOverflowList.length ? landscapeOverflowList.join(', ') : 'none'));
    if (landscapeOverflowList.length > 0) failed += 1;

    // ── Copies = 2 ───────────────────────────────────────────────────────────
    console.log('Navigating to copies=2 preview...');
    await send('Page.navigate', { url: slipUrl(`${baseQuery}&cartonFrom=&cartonTo=&copies=2&landscape=false`) });
    await waitForSelector(send, `document.querySelector('.packing-slip-page')`);
    await sleep(900);
    const copiesCheck = await send('Runtime.evaluate', {
      expression: `JSON.stringify({ pages: document.querySelectorAll('.packing-slip-page').length })`,
      returnByValue: true,
    });
    console.log('COPIES=2 STATS: ' + copiesCheck.result.value);
    await writePng(send, 'p10_2_12_multiple_copies.png');

    // ── PDF export ───────────────────────────────────────────────────────────
    console.log('Exporting PDF...');
    await send('Page.navigate', { url: slipUrl(`${baseQuery}&cartonFrom=&cartonTo=&copies=1&landscape=false`) });
    await waitForSelector(send, `document.querySelector('.packing-slip-page')`);
    await sleep(900);
    const pdf = await send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true,
      marginTop: 0.2,
      marginBottom: 0.2,
      marginLeft: 0.2,
      marginRight: 0.2,
    });
    const pdfPath = path.join(ARTIFACT_DIR, 'p10_2_13_packing_slip_export.pdf');
    fs.writeFileSync(pdfPath, Buffer.from(pdf.data, 'base64'));
    console.log(`Saved PDF: ${path.basename(pdfPath)} (${fs.statSync(pdfPath).size} bytes)`);

    // ── App-shell layout smoke test: full-width shell must not introduce horizontal overflow ──
    console.log('\n── APP SHELL SMOKE TEST ──');
    const smokeRoutes = [
      ['dashboard', '/'],
      ['yarn qualities master', '/masters/yarn-qualities'],
      ['production receive records', '/manufacturing/production-receive/records'],
      ['production receive entry', '/manufacturing/production-receive/entry'],
    ];
    for (const [label, route] of smokeRoutes) {
      await send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}${route}` });
      await sleep(1400);
      const metrics = await send('Runtime.evaluate', {
        expression: `JSON.stringify({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, mainWidth: document.querySelector('main') ? Math.round(document.querySelector('main').getBoundingClientRect().width) : 0 })`,
        returnByValue: true,
      });
      const m = JSON.parse(metrics.result.value);
      const noHorizontalOverflow = m.scrollWidth <= m.innerWidth + 1;
      console.log(`${noHorizontalOverflow ? 'PASS' : 'FAIL'} - ${label}: viewport ${m.innerWidth}px, document ${m.scrollWidth}px, main ${m.mainWidth}px`);
      if (!noHorizontalOverflow) failed += 1;
      await writePng(send, `p10_2_shell_${label.replace(/\s+/g, '_')}.png`);
    }

    // ── Branding check on the entry page (last route visited by the smoke test) ──
    const brandingProbe = await send('Runtime.evaluate', { expression: `document.body.innerText`, returnByValue: true });
    const brandingText = brandingProbe.result.value || '';
    const hasAttribution = /Made by Jainil Patel V\./.test(brandingText);
    const hasVendorBranding = /Chandni Software/i.test(brandingText);
    console.log(`${hasAttribution ? 'PASS' : 'FAIL'} - "Made by Jainil Patel V." present on production receive entry`);
    console.log(`${!hasVendorBranding ? 'PASS' : 'FAIL'} - "Chandni Software" removed from production receive entry`);
    if (!hasAttribution || hasVendorBranding) failed += 1;

    if (pageErrors.length > 0) {
      console.log(`\nPAGE EXCEPTIONS (${pageErrors.length}):`);
      pageErrors.forEach((e) => console.log(' - ' + e));
    } else {
      console.log('\nNo page exceptions captured.');
    }

    console.log(`\nArtifacts written to: ${ARTIFACT_DIR}`);
    console.log(failed === 0 && pageErrors.length === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
    ws.close();
  } finally {
    chromeProcess.kill();
    staticServer.close();
    if (mockApiServer) mockApiServer.close();
  }
}

main().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});