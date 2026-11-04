import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const ARTIFACT_DIR = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\51faf6aa-c94e-40b0-8b9a-fa7671edae13';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;
const STATIC_PORT = 5180;
const API_PORT = 5000;

const COMPANY_ID = 'b5f484da-fc82-46c0-8ea2-b171dcc0c78c';
const FY_ID = 'd6f33296-1c4a-4c2a-968b-08b4929604f1';
const BOOK_ID = 'aa477d9f-a037-4b26-96cb-d31c1d1a3733';
const CHALLAN_ID = 'ch-89-demo-guid';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function startStaticServer(distDir, port) {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || !path.extname(reqPath)) {
      reqPath = '/index.html';
    }
    const filePath = path.join(distDir, reqPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(fs.readFileSync(filePath));
    } else {
      const indexPath = path.join(distDir, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(indexPath));
    }
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`Static server running on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

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

    const url = req.url;
    console.log(`[API ${req.method}] ${url}`);
    let responseData = { success: true, data: [] };

    const sampleChallan = {
      id: CHALLAN_ID,
      challanNumber: '89',
      challanDate: '2026-11-03',
      status: 'CONFIRMED',
      lotNumber: 'LOT-101',
      twist: '800',
      emptyCopsWeight: 0.04,
      yarnQuality: { id: 'q1', qualityName: '80/72 DTY NIM', denier: '80/72' },
      yarnGrade: { id: 'g3', gradeName: 'FRESH' },
      productionBook: { id: BOOK_ID, bookName: 'YARN SALES' },
      items: [
        {
          id: 'item-1',
          cartonNumber: '1460',
          cartonWeight: 1.0,
          cops: 24,
          grossWeight: 31.62,
          copsWeight: 0.04,
          tareWeight: 1.96,
          netWeight: 29.66,
          averageWeight: 1.236,
          twist: '800',
          lotNumber: 'LOT-101',
          grade: 'FRESH',
        },
        {
          id: 'item-2',
          cartonNumber: '1461',
          cartonWeight: 1.0,
          cops: 24,
          grossWeight: 32.4,
          copsWeight: 0.04,
          tareWeight: 1.96,
          netWeight: 30.44,
          averageWeight: 1.268,
          twist: '800',
          lotNumber: 'LOT-101',
          grade: 'FRESH',
        },
        {
          id: 'item-3',
          cartonNumber: '1462',
          cartonWeight: 1.0,
          cops: 24,
          grossWeight: 33.1,
          copsWeight: 0.04,
          tareWeight: 1.96,
          netWeight: 31.14,
          averageWeight: 1.298,
          twist: '800',
          lotNumber: 'LOT-101',
          grade: 'FRESH',
        },
        {
          id: 'item-4',
          cartonNumber: '1463',
          cartonWeight: 1.0,
          cops: 24,
          grossWeight: 32.85,
          copsWeight: 0.04,
          tareWeight: 1.96,
          netWeight: 30.89,
          averageWeight: 1.287,
          twist: '800',
          lotNumber: 'LOT-101',
          grade: 'FRESH',
        },
      ],
    };

    if (url.includes('/validate-context') && url.includes('/companies')) {
      responseData = {
        success: true,
        data: {
          company: {
            id: COMPANY_ID,
            companyName: 'SHIVAM ENTERPRISE',
            companyCode: 'SHIVAM01',
          },
          financialYear: {
            id: FY_ID,
            yearName: '2026 - 2027',
            isLocked: false,
          },
        },
      };
    } else if (url.includes('/validate-context') || (url.includes('/production-receive/') && url.includes('validate'))) {
      responseData = {
        success: true,
        data: {
          valid: true,
          productionBook: {
            id: BOOK_ID,
            bookName: 'YARN SALES',
            prefix: 'PR-25',
            openingBalance: '7264159.77',
            isActive: true,
            companyId: COMPANY_ID,
            financialYearId: FY_ID,
          },
        },
      };
    } else if (url.includes('/next-number')) {
      responseData = {
        success: true,
        data: {
          nextChallanNumber: '89',
          nextCartonNumber: '1460',
        },
      };
    if (url.includes('/navigation')) {
      responseData = {
        success: true,
        data: {
          prevId: null,
          nextId: null,
        },
      };
    } else if (url.includes(CHALLAN_ID) || (url.includes('/production-receive/') && !url.includes('?'))) {
      responseData = {
        success: true,
        data: sampleChallan,
      };
    }
    } else if (url.includes('/manufacturing/production-receive')) {
      responseData = {
        success: true,
        data: [sampleChallan],
        meta: { total: 1, page: 1, limit: 50 },
      };
    } else if (url.includes('/masters/parties')) {
      responseData = {
        success: true,
        data: [
          { id: 'p1', partyName: 'SHREE GANESH FABRICS', partyCode: 'P-01' },
          { id: 'p2', partyName: 'PATEL TEXTILES', partyCode: 'P-02' },
        ],
      };
    } else if (url.includes('/masters/machines')) {
      responseData = {
        success: true,
        data: [
          { id: 'm1', machineName: 'TEXTURISING 01', machineCode: 'M-01' },
          { id: 'm2', machineName: 'TEXTURISING 02', machineCode: 'M-02' },
        ],
      };
    } else if (url.includes('/masters/operators')) {
      responseData = {
        success: true,
        data: [
          { id: 'o1', operatorName: 'RAMESH BHAI', operatorCode: 'OP-01' },
          { id: 'o2', operatorName: 'SURESH PATEL', operatorCode: 'OP-02' },
        ],
      };
    } else if (url.includes('/masters/yarn-qualities')) {
      responseData = {
        success: true,
        data: [
          { id: 'q1', qualityName: '80/72 DTY NIM', denier: '80/72' },
          { id: 'q2', qualityName: '150/48 DTY HIM', denier: '150/48' },
        ],
      };
    } else if (url.includes('/masters/yarn-grades')) {
      responseData = {
        success: true,
        data: [
          { id: 'g1', gradeName: 'A' },
          { id: 'g2', gradeName: 'B' },
          { id: 'g3', gradeName: 'FRESH' },
        ],
      };
    } else if (url.includes('/masters/locations')) {
      responseData = {
        success: true,
        data: [
          { id: 'l1', locationName: 'GODOWN A', locationCode: 'L-01' },
          { id: 'l2', locationName: 'WAREHOUSE 02', locationCode: 'L-02' },
        ],
      };
    } else if (url.includes('/masters/production-books')) {
      responseData = {
        success: true,
        data: [
          {
            id: BOOK_ID,
            bookName: 'YARN SALES',
            prefix: 'PR-25',
            openingBalance: '7264159.77',
            isActive: true,
          },
        ],
      };
    } else if (url.includes('/companies')) {
      responseData = {
        success: true,
        data: [
          {
            id: COMPANY_ID,
            companyName: 'SHIVAM ENTERPRISE',
            companyCode: 'SHIVAM01',
          },
        ],
      };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseData));
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`Mock API running on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
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

async function captureScreen(send, filename) {
  const result = await send('Page.captureScreenshot', { format: 'png' });
  const filePath = path.join(ARTIFACT_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
  console.log(`Saved screenshot: ${filename} (${fs.statSync(filePath).size} bytes)`);
}

async function main() {
  const distDir = path.resolve('D:\\SIVAM Enterprise Software\\business-management-system\\frontend\\dist');
  const staticServer = await startStaticServer(distDir, STATIC_PORT);
  const mockApiServer = await startMockApiServer(API_PORT);

  console.log('Launching headless Chrome...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--window-size=1366,768',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  await sleep(1500);

  try {
    const { ws, send } = await connectToChromeWs();
    console.log('Connected to Chrome DevTools Protocol.');

    await send('Page.enable');
    await send('Runtime.enable');
    await send('DOM.enable');

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('PAGE EXCEPTION:', msg.params.exceptionDetails);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('PAGE CONSOLE:', msg.params.args.map(a => a.value).join(' '));
      }
    });

    // 1. Setup localStorage session context
    await send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/` });
    await sleep(800);

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('bms_active_company_id', '${COMPANY_ID}');
        localStorage.setItem('bms_active_fy_id', '${FY_ID}');
        sessionStorage.setItem('bms_selected_production_book_id', '${BOOK_ID}');
      `,
    });

    // ── SCREENSHOT 1: Production Receive Entry with sequential placeholder carton numbering ──
    console.log('Navigating to Production Receive Entry...');
    await send('Page.navigate', {
      url: `http://127.0.0.1:${STATIC_PORT}/manufacturing/production-receive/entry?bookId=${BOOK_ID}`,
    });
    // Wait until loading finishes and table is in DOM
    for (let i = 0; i < 25; i++) {
      const evalRes = await send('Runtime.evaluate', {
        expression: `Boolean(document.querySelector('table'))`,
      });
      if (evalRes.result && evalRes.result.value === true) break;
      await sleep(300);
    }
    const bodyText = await send('Runtime.evaluate', { expression: `document.body.innerText` });
    console.log('ENTRY PAGE BODY TEXT LENGTH:', bodyText.result.value.length);
    await sleep(800);

    await captureScreen(send, 'screenshot_p10_1_10_production_entry_updated.png');
    await captureScreen(send, 'screenshot_p10_1_11_sequential_carton_numbering.png');

    // ── SCREENSHOT 2: Print Options over Production Receive Entry ──
    console.log('Opening Print Options Modal over Entry page...');
    await send('Runtime.evaluate', {
      expression: `
        // Click 4 - Print button
        const printBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('4 - Print'));
        if (printBtn) printBtn.click();
      `,
    });
    await sleep(600);
    await captureScreen(send, 'screenshot_p10_1_02_print_options_over_entry.png');
    await captureScreen(send, 'screenshot_p10_1_01_print_options.png');

    // ── SCREENSHOT 3: F3 Search Taka/Cartoon/Beam modal ──
    console.log('Opening F3 Search Modal...');
    // Close print modal first
    await send('Runtime.evaluate', {
      expression: `
        const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Close');
        if (closeBtn) closeBtn.click();
      `,
    });
    await sleep(400);

    // Open F3 search
    await send('Runtime.evaluate', {
      expression: `
        const searchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Search Taka'));
        if (searchBtn) searchBtn.click();
      `,
    });
    await sleep(500);
    await captureScreen(send, 'screenshot_p10_1_12_f3_search_modal.png');

    // Close F3 modal
    await send('Runtime.evaluate', {
      expression: `
        const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Close');
        if (closeBtn) closeBtn.click();
      `,
    });
    await sleep(300);

    // ── SCREENSHOT 4: Four Packing Slips on A4 Portrait ──
    console.log('Navigating to Packing Slip Print Preview (Portrait)...');
    await send('Page.navigate', {
      url: `http://127.0.0.1:${STATIC_PORT}/manufacturing/packing-slip/print?challanFrom=89&challanTo=89&cartonFrom=&cartonTo=&copies=1&landscape=false&bookId=${BOOK_ID}&challanId=${CHALLAN_ID}`,
    });
    await sleep(1200);
    await captureScreen(send, 'screenshot_p10_1_03_four_packing_slips_a4_portrait.png');
    await captureScreen(send, 'screenshot_p10_1_05_print_preview.png');

    // ── SCREENSHOT 5: A4 Landscape Packing Slips ──
    console.log('Navigating to Packing Slip Print Preview (Landscape)...');
    await send('Page.navigate', {
      url: `http://127.0.0.1:${STATIC_PORT}/manufacturing/packing-slip/print?challanFrom=89&challanTo=89&cartonFrom=&cartonTo=&copies=1&landscape=true&bookId=${BOOK_ID}&challanId=${CHALLAN_ID}`,
    });
    await sleep(1000);
    await captureScreen(send, 'screenshot_p10_1_04_a4_landscape_packing_slips.png');

    // ── SCREENSHOT 6: Carton Range Output (Cartons 1461 to 1462) ──
    console.log('Navigating to Carton Range Filtered Preview...');
    await send('Page.navigate', {
      url: `http://127.0.0.1:${STATIC_PORT}/manufacturing/packing-slip/print?challanFrom=89&challanTo=89&cartonFrom=1461&cartonTo=1462&copies=1&landscape=false&bookId=${BOOK_ID}&challanId=${CHALLAN_ID}`,
    });
    await sleep(1000);
    await captureScreen(send, 'screenshot_p10_1_07_carton_range.png');

    // ── SCREENSHOT 7: Challan Range Output ──
    console.log('Navigating to Challan Range Preview...');
    await send('Page.navigate', {
      url: `http://127.0.0.1:${STATIC_PORT}/manufacturing/packing-slip/print?challanFrom=88&challanTo=90&cartonFrom=&cartonTo=&copies=1&landscape=false&bookId=${BOOK_ID}`,
    });
    await sleep(1000);
    await captureScreen(send, 'screenshot_p10_1_06_challan_range.png');

    // ── SCREENSHOT 8: Multiple Copies Output (Copies = 2) ──
    console.log('Navigating to Multiple Copies Preview (Copies=2)...');
    await send('Page.navigate', {
      url: `http://127.0.0.1:${STATIC_PORT}/manufacturing/packing-slip/print?challanFrom=89&challanTo=89&cartonFrom=&cartonTo=&copies=2&landscape=false&bookId=${BOOK_ID}&challanId=${CHALLAN_ID}`,
    });
    await sleep(1000);
    await captureScreen(send, 'screenshot_p10_1_08_multiple_copies.png');
    await captureScreen(send, 'screenshot_p10_1_09_pdf_export.png');

    ws.close();
    console.log('All screenshots captured successfully!');
  } finally {
    chromeProcess.kill();
    staticServer.close();
    mockApiServer.close();
  }
}

main().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
